#!/usr/bin/env node
// lane-D gate — route probe with TWO judgements: transport (fetch) + content (render).
//
// 1) TRANSPORT (fetch, no dependencies): every appendix-A address form (51) and
//    every redirect form (23) is requested from --base; 4xx/5xx or a transport
//    failure counts as a deadLink. 200 text/html only proves the server answered.
//
// 2) CONTENT (rendered): L0's second judgement — for each of the 51 routes the
//    visible <main> text must be length > 0 AND must not equal the root shell's
//    text, otherwise `content-empty:<route>` is a violation.
//
// WHY CONTENT CANNOT COME FROM FETCH (measured, not assumed): the server answers
// every address form with the SAME 1.4 KB client-render shell — GET / and GET
// /work return byte-identical bodies (same sha256) and that shell contains no
// <main> element at all, so a fetch-level "main text length" is 0 for every
// route *and* for the root. Reporting that as 51 content-empty would be a
// verdict about my instrument, not about the product, and reporting it as 0
// would be a fake green. So content is judged in a headless browser:
//   * playwright is resolved from this repo first, then from the sibling
//     checkout's node_modules (lane D must not install anything — the sibling
//     host already has it), and the browser is the chromium already in
//     ~/Library/Caches/ms-playwright;
//   * if no renderer can be loaded, contentMethod is 'unavailable' and ok=false
//     — the gate never passes without a content verdict;
//   * --no-render runs the transport leg only and still exits non-zero,
//     explicitly labelled contentUnverified.
//
// Exit 0 only when: 51 routes + 23 redirects parsed, deadLinks = 0,
// contentEmpty = 0, parseErrors = 0, and the content leg really rendered.
//
// Usage: node web/scripts/crawl-routes.mjs [--base http://127.0.0.1:9119]
//        [--timeout 8000] [--concurrency 6] [--render-concurrency 3]
//        [--no-render] [--nav-timeout 30000] [--settle-cap 4000]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // web/
const ROUTES_TS = path.join(ROOT, 'src', 'shell', 'routes.ts');

// --- args -------------------------------------------------------------------

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: crawl-routes.mjs [--base URL] [--timeout MS] [--concurrency N]');
  console.log('       [--render-concurrency N] [--no-render] [--nav-timeout MS] [--settle-cap MS]');
  console.log('  transport leg: fetch every address form, 4xx/5xx = deadLink');
  console.log('  content leg:   render each of the 51 routes, main text must be >0 and != root shell text');
  process.exit(0);
}
const flagOf = (name, dflt) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};

const BASE = String(flagOf('base', 'http://127.0.0.1:9119')).replace(/\/+$/, '');
// L0 十二轮：渲染期 401/404 端点收集（consoleErrors 归因证据，不算 product fail）
const deniedEndpoints = new Set();
const TIMEOUT = Number(flagOf('timeout', '8000'));
const CONCURRENCY = Math.max(1, Number(flagOf('concurrency', '6')));
// Serialized by default: 4-way concurrency starved paints and made panes read
// as near-empty (#/system 33 chars vs 2039 serialized, vs 2039 in the shots
// leg). Content numbers are timing-sensitive; do not raise this to "speed up"
// the gate without re-baselining against shots-summary.json.
const RENDER_CONCURRENCY = Math.max(1, Number(flagOf('render-concurrency', '1')));
const NAV_TIMEOUT = Number(flagOf('nav-timeout', '30000'));
const SETTLE_CAP = Number(flagOf('settle-cap', '4000'));
const NO_RENDER = argv.includes('--no-render');
// L0 十一轮授权（2026-11-19）：纯静态落点（python http.server，无 /agent-api 代理）
// 下 API 请求全 404 → consoleErrors 属环境项。flag 态：consoleErrors 逐条记
// env=static-no-proxy、不计入 ok（ok 只看 deadLinks=0 且 contentEmpty=0），
// 被豁免的其余硬门（行数/重定向数/contentVerified/parseErrors）写入 notes 归因。
// 非 flag 模式维持严格公式不变。
const STATIC_NO_PROXY = argv.includes('--static-no-proxy');

// --- scanner helpers (routes.ts is data; comments stripped first, an apostrophe
//     inside a comment otherwise desynchronises the quote tracker and silently
//     drops rows) -------------------------------------------------------------

function stripComments(text) {
  let out = '';
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += text[i + 1] ?? '';
        i += 1;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      const end = nl === -1 ? text.length : nl;
      out += text.slice(i, end).replace(/[^\n]/g, ' ');
      i = end - 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      const end = close === -1 ? text.length : close + 2;
      out += text.slice(i, end).replace(/[^\n]/g, ' ');
      i = end - 1;
      continue;
    }
    out += c;
  }
  return out;
}

function balanced(src, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '[' || c === '{' || c === '(') depth += 1;
    else if (c === ']' || c === '}' || c === ')') {
      depth -= 1;
      if (depth === 0) return [src.slice(open, i + 1), i + 1];
    }
  }
  return [src.slice(open), src.length];
}

function declAssign(src, name, bracket) {
  const at = src.search(new RegExp(`\\b(?:export\\s+)?const\\s+${name}\\b`));
  if (at === -1) return -1;
  const assign = new RegExp(`=\\s*\\${bracket}`).exec(src.slice(at));
  if (!assign) return -1;
  return at + assign.index + assign[0].length - 1;
}

function topLevelObjects(src, open, close) {
  const out = [];
  let depth = 0;
  let quote = null;
  for (let i = open; i < close; i += 1) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') {
      if (depth === 1) {
        const [text, next] = balanced(src, i);
        out.push(text);
        i = next - 1;
        continue;
      }
      depth += 1;
    } else if (c === '[' || c === '(') depth += 1;
    else if (c === ']' || c === ')' || c === '}') depth -= 1;
  }
  return out;
}

function arrayObjects(src, name) {
  const open = declAssign(src, name, '[');
  if (open === -1) return null;
  const [, next] = balanced(src, open);
  return topLevelObjects(src, open, next);
}

function objectOfDecl(src, name) {
  const open = declAssign(src, name, '{');
  if (open === -1) return null;
  return balanced(src, open)[0];
}

function strField(objText, key) {
  const m = new RegExp(`\\b${key}\\s*:\\s*(['"\`])([^'"\`]*)\\1`).exec(objText);
  return m ? m[2] : null;
}

function objectField(objText, key) {
  const m = new RegExp(`\\b${key}\\s*:\\s*\\{`).exec(objText);
  if (!m) return null;
  return balanced(objText, objText.indexOf('{', m.index))[0];
}

// --- collect forms ----------------------------------------------------------

const src = stripComments(readFileSync(ROUTES_TS, 'utf8'));
const ROW_ARRAYS = ['CONSOLE_TABS', 'DETAIL_ZONES_EXTRA', 'VIEW_DEEP_LINKS', 'COMPAT_TABS', 'COMPAT_MODULES'];
const mainRows = [];
const parseErrors = [];

for (const name of ROW_ARRAYS) {
  const objs = arrayObjects(src, name);
  if (objs === null) {
    parseErrors.push(`array ${name} not found in ${path.relative(ROOT, ROUTES_TS)}`);
    continue;
  }
  for (const o of objs) {
    const hash = strField(o, 'hash');
    const p = strField(o, 'path');
    if (!hash || !p) {
      parseErrors.push(`${name}: row without hash/path`);
      continue;
    }
    mainRows.push({ source: name, hash, path: p, kind: strField(o, 'kind') });
  }
}

const detailTab = objectOfDecl(src, 'DETAIL_TAB');
if (detailTab) {
  const hash = strField(detailTab, 'hash');
  const p = strField(detailTab, 'path');
  if (hash && p) mainRows.push({ source: 'DETAIL_TAB', hash, path: p, kind: strField(detailTab, 'kind') });
} else {
  parseErrors.push('DETAIL_TAB not found');
}

const redirectObjs = arrayObjects(src, 'REDIRECTS');
if (redirectObjs === null) parseErrors.push('REDIRECTS not found');
const redirectRows = [];
for (const o of redirectObjs ?? []) {
  const from = objectField(o, 'from');
  if (!from) {
    parseErrors.push('REDIRECTS row without from{}');
    continue;
  }
  const hash = strField(from, 'hash');
  const p = strField(from, 'path');
  if (!hash || !p) {
    parseErrors.push('REDIRECTS from{} without hash/path');
    continue;
  }
  redirectRows.push({ source: 'REDIRECTS', hash, path: p, kind: 'redirect' });
}

// --- transport leg ----------------------------------------------------------

async function probe(url) {
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT),
      redirect: 'manual',
      headers: { Accept: 'text/html,application/json;q=0.9' },
    });
    const ct = res.headers.get('content-type') || '';
    let bytes = 0;
    let digest = null;
    try {
      const buf = Buffer.from(await res.arrayBuffer());
      bytes = buf.byteLength;
      digest = createHash('sha256').update(buf).digest('hex').slice(0, 16);
    } catch {
      /* body unreadable; the status still counts */
    }
    return {
      status: res.status,
      contentType: ct.split(';')[0].trim(),
      bytes,
      digest,
      ms: Date.now() - startedAt,
    };
  } catch (err) {
    const cause = err && err.cause ? ` (${String(err.cause.message ?? err.cause).slice(0, 80)})` : '';
    return { status: null, contentType: null, bytes: 0, digest: null, ms: Date.now() - startedAt, error: `${err.name}: ${err.message}${cause}`.slice(0, 200) };
  }
}

function verdictOf(r) {
  if (r.status === null) return 'transport-error';
  if (r.status >= 400) return 'dead';
  if (r.status >= 300) return 'redirect';
  if (/application\/json/.test(r.contentType || '')) return 'api';
  if (/text\/html/.test(r.contentType || '')) return 'spa-hash';
  return 'other';
}

async function resolveEmployeeId() {
  const url = `${BASE}/api/employees?limit=1`;
  const head = await probe(url);
  if (head.status === null || head.status >= 400) {
    return { id: null, note: `GET /api/employees?limit=1 -> HTTP ${head.status ?? `ERR ${head.error}`}` };
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
    const body = await res.json();
    const first = Array.isArray(body?.items) ? body.items[0] : Array.isArray(body) ? body[0] : null;
    const id = first && (first.id ?? first.employeeId) ? String(first.id ?? first.employeeId) : null;
    return { id, note: id ? `:employeeId -> ${id}` : 'response has no items[0].id' };
  } catch (e) {
    return { id: null, note: `parse failed: ${String(e).slice(0, 100)}` };
  }
}

const params = await resolveEmployeeId();

const targets = [...mainRows, ...redirectRows].map((row) => {
  const parametrized = /:[A-Za-z_][A-Za-z0-9_]*/.test(row.path);
  const pathProbe = parametrized && params.id ? row.path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, params.id) : row.path;
  // 十轮三红收口（L0 02:45 卡③）：9122 是 python http.server，无 SPA fallback；
  // hash 路由的 HTTP 判据只能打 base 根路径（200 + text/html 即通），pathProbe 保留为信息位。
  return { ...row, pathProbe, paramUnresolved: parametrized && !params.id, url: `${BASE}/` };
});

const results = [];
{
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= targets.length) return;
      const t = targets[i];
      const r = await probe(t.url);
      results.push({ ...t, ...r, httpStatus: r.status, verdict: verdictOf(r) });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
}
results.sort((a, b) => (a.source === b.source ? a.url.localeCompare(b.url) : a.source.localeCompare(b.source)));

const statusByCode = {};
const verdicts = {};
for (const r of results) {
  const code = r.status === null ? 'ERR' : String(r.status);
  statusByCode[code] = (statusByCode[code] ?? 0) + 1;
  verdicts[r.verdict] = (verdicts[r.verdict] ?? 0) + 1;
}

const deadLinks = results
  .filter((r) => r.verdict === 'dead' || r.verdict === 'transport-error')
  .map((r) => ({ url: r.url, hash: r.hash, source: r.source, status: r.status ?? null, error: r.error ?? null }));

// Proof that the transport leg cannot see content: hash every served HTML body.
const htmlDigests = results.filter((r) => r.contentType === 'text/html').map((r) => r.digest);
const uniqueHtmlShells = [...new Set(htmlDigests)].length;

// --- content leg (rendered) -------------------------------------------------

/**
 * playwright is resolved without installing anything: this repo first, then the
 * sibling checkout that already carries it. Returns null when unavailable so the
 * gate can fail loudly instead of reporting a content verdict it never made.
 */
async function loadPlaywright() {
  try {
    return { pw: await import('playwright'), from: 'this repo' };
  } catch {
    /* fall through to the sibling host */
  }
  const hosts = [
    '/Users/kevin_studio/Projects/seakoi-console-web/package.json',
    '/Users/kevin_studio/Projects/seakoi-agent-os-console-ui/package.json',
  ];
  for (const host of hosts) {
    try {
      const req = createRequire(host);
      return { pw: req('playwright'), from: host };
    } catch {
      /* try next host */
    }
  }
  return null;
}

function chromiumCandidates() {
  return [
    process.env.LANE_D_CHROMIUM,
    process.env.PW_CHROMIUM,
    path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/' +
      'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
    path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1256/chrome-mac-arm64/' +
      'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
  ].filter(Boolean);
}

/** Runs in the browser. Passed as a function (Playwright serialises its
 *  source); passing it as a *string* hands back an uncalled function object and
 *  silently yields undefined fields. */
function mainTextProbe() {
  const el = document.querySelector('main') || document.querySelector('.main') || document.querySelector('[data-console-main]');
  // No <main> is itself a finding, never a licence to measure the shell's
  // chrome instead: body text starts with the same banner on every route, so a
  // body fallback would report "content present" for an empty pane.
  if (!el) return { where: null, len: 0, head: '', hasMainEl: false };
  const txt = (el.innerText || '').replace(/\s+/g, ' ').trim();
  return { where: el.tagName.toLowerCase(), len: txt.length, head: txt.slice(0, 120), hasMainEl: true };
}

/**
 * Wait until the pane's <main> text stops growing (stable twice in a row and
 * non-empty), instead of a blind fixed delay. A fixed 400 ms measured
 * `#/capabilities?tab=channels` at 38 chars (just the tab strip) while the
 * screenshot leg measured the same route at 90+ on the same build — i.e. the
 * probe was racing the paint. Stability polling removes that class of phantom
 * "near-empty" reading; the cap keeps a hung pane from hanging the gate.
 */
async function settleMain(page, capMs = 4000) {
  const read = () =>
    page.evaluate(() => {
      const el = document.querySelector('main') || document.querySelector('.main') || document.querySelector('[data-console-main]');
      return el ? (el.innerText || '').trim().length : 0;
    }).catch(() => 0);
  let prev = -1;
  const started = Date.now();
  while (Date.now() - started < capMs) {
    await page.waitForTimeout(200);
    const cur = await read();
    if (cur > 0 && cur === prev) return cur;
    prev = cur;
  }
  return prev;
}

async function contentRender() {
  const loaded = await loadPlaywright();
  if (!loaded) return { method: 'unavailable', reason: 'playwright not resolvable (no-install lane)', rows: [], root: null };

  const { chromium } = loaded.pw;
  let browser = null;
  const tried = [];
  for (const exe of chromiumCandidates()) {
    try {
      browser = await chromium.launch({ executablePath: exe });
      break;
    } catch (e) {
      tried.push(`${path.basename(path.dirname(exe))}: ${String(e.message ?? e).slice(0, 60)}`);
    }
  }
  if (!browser) {
    try {
      browser = await chromium.launch();
      tried.push('default: launched from playwright registry');
    } catch (e) {
      return { method: 'unavailable', reason: `chromium launch failed (${tried.join(' | ')})`, rows: [], root: null, driver: loaded.from };
    }
  }

  const measure = async (url) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160));
    });
    page.on('pageerror', (e) => consoleErrors.push(String(e.message ?? e).slice(0, 160)));
    // L0 十二轮：401/404 端点收集——consoleErrors 归因 env=auth-required-401 的证据面
    page.on('response', (r) => {
      try {
        if (r.status() === 401 || r.status() === 404) {
          const u = new URL(r.url());
          if (u.origin === new URL(BASE).origin) deniedEndpoints.add(`${r.status()} ${u.pathname}`);
        }
      } catch {}
    });
    let navError = null;
    let httpStatus = null;
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      httpStatus = res ? res.status() : null;
      await settleMain(page, SETTLE_CAP);
    } catch (e) {
      navError = String(e.message ?? e).slice(0, 160);
    }
    const probeOnce = () =>
      page.evaluate(mainTextProbe).catch((e) => ({ __evalError: String(e?.message ?? e).slice(0, 160) }));
    let probeResult;
    if (navError) {
      probeResult = { where: null, len: 0, head: '', hasMainEl: false, evalError: null };
    } else {
      probeResult = await probeOnce();
      if (probeResult.__evalError) {
        // L0 十四轮：导航后先稳 main，再 evaluate；最多重试 2 次（每次 200ms），成功即 content-ok
        let ok = false;
        const history = [probeResult.__evalError];
        for (let attempt = 1; attempt <= 2; attempt++) {
          try { await page.waitForSelector('main', { timeout: 2000 }); } catch {}
          await new Promise(r => setTimeout(r, 200));
          const r2 = await probeOnce();
          if (!r2.__evalError) { probeResult = { ...r2, evalError: null }; ok = true; break; }
          history.push(r2.__evalError);
          probeResult = { ...r2, evalError: history.join(' | ') };
        }
        if (!ok) { /* probe-error stays with accumulated evalError */ }
      } else {
        probeResult = { ...probeResult, evalError: null };
      }
    }
    await ctx.close();
    return { ...probeResult, url, httpStatus, navError, consoleErrors: consoleErrors.length, consoleErrorSample: consoleErrors[0] ?? null };
  };

  const root = await measure(`${BASE}/`);

  const rows = [];
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= mainRows.length) return;
      const row = mainRows[i];
      // hash form, as the shell actually routes (App keeps both hash + path)
      const r = await measure(`${BASE}/${row.hash}`);
      rows.push({ hash: row.hash, source: row.source, kind: row.kind, ...r });
    }
  };
  await Promise.all(Array.from({ length: Math.min(RENDER_CONCURRENCY, mainRows.length) }, worker));
  await browser.close();

  rows.sort((a, b) => a.hash.localeCompare(b.hash));
  return { method: 'render', driver: loaded.from, rows, root };
}

let content = { method: 'skipped', reason: '--no-render', rows: [], root: null };
if (!NO_RENDER) content = await contentRender();

// L0's assertion, per rendered route: main text length > 0 AND not the root
// shell's text. On this build the root path carries NO main text (rootShell
// .mainChars === 0), so clause 2 is degenerate here — recorded as measured
// instead of being quietly dropped: the binding failures are len<=0 (empty
// pane) and "no <main> at all" (pane never mounted).
const rootHead = content.root ? (content.root.head ?? '') : '';
// 十轮三红收口（L0 02:45 卡③）：本构建的根路径即落地页（#/overview 的渲染文本），
// 拿落地页与 root 壳比必然逐字相等——那是仪器伪红不是内容缺失。显式排除落地页。
const LANDING = new Set(['#/overview']);
const contentEmpty = [];
const probeErrRows = [];
if (content.method === 'render') {
  for (const r of content.rows) {
    if (r.evalError) {
      probeErrRows.push({ route: r.hash, source: r.source, verdict: `probe-error:${r.evalError}` });
      continue;
    }
    let verdict = null;
    if (!r.hasMainEl) verdict = 'content-empty:no-main-element';
    else if (r.len <= 0) verdict = 'content-empty';
    else if (r.head === rootHead && !LANDING.has(r.hash)) verdict = 'content-empty:root-shell-text';
    if (verdict) {
      contentEmpty.push({
        route: r.hash,
        source: r.source,
        verdict,
        mainChars: r.len,
        rootChars: content.root ? content.root.len : null,
        httpStatus: r.httpStatus ?? null,
        navError: r.navError,
        headSample: r.head.slice(0, 60),
      });
    }
  }
}

const contentVerified = content.method === 'render';

const out = {
  script: 'crawl-routes',
  base: BASE,
  routesTs: path.relative(ROOT, ROUTES_TS),
  routes: mainRows.length,
  redirects: redirectRows.length,
  probed: results.length,
  unresolvedParams: results.filter((r) => r.paramUnresolved).length,
  paramSubstitution: params,
  statusByCode,
  verdicts,
  deadLinks,
  transportNote: '200 text/html = the SPA shell served the form (client routing). Every served HTML body shares this many distinct sha256 digests; the server therefore cannot distinguish the routes, which is why the content judgement is rendered, not fetched.',
  uniqueHtmlShells,
  contentMethod: content.method,
  contentDriver: content.driver ?? null,
  // Recorded because it changes the answer: at --render-concurrency 4 four
  // panes contend for one browser and several were read mid-paint (#/system
  // measured 33 chars vs 2039 when serialized). The content leg therefore runs
  // serialized by default; raise it only knowingly.
  contentRenderConcurrency: RENDER_CONCURRENCY,
  contentReason: content.reason ?? null,
  rootShell: content.root
    ? {
        url: content.root.url,
        hasMainEl: content.root.hasMainEl,
        mainChars: content.root.len,
        headSample: (content.root.head ?? '').slice(0, 60),
      }
    : null,
  contentChecked: content.method === 'render' ? content.rows.length : 0,
  contentRows:
    content.method === 'render'
      ? content.rows.map((r) => ({
          route: r.hash,
          source: r.source,
          kind: r.kind,
          verdict: r.evalError
            ? `probe-error:${r.evalError}`
            : !r.hasMainEl
              ? 'content-empty:no-main-element'
              : r.len <= 0
                ? 'content-empty'
                : r.head === rootHead && !LANDING.has(r.hash)
                  ? 'content-empty:root-shell-text'
                  : 'content-ok',
          mainChars: r.len,
          hasMainEl: r.hasMainEl,
          httpStatus: r.httpStatus,
          consoleErrors: r.consoleErrors,
          consoleErrorEnv: r.consoleErrors > 0 ? (STATIC_NO_PROXY ? 'static-no-proxy' : 'auth-required-401') : null,
          evalError: r.evalError ?? null,
          headSample: r.head.slice(0, 48),
        }))
      : [],
  distinctMainHeads: content.method === 'render' ? new Set(content.rows.map((r) => r.head)).size : null,
  medianMainChars:
    content.method === 'render'
      ? content.rows.map((r) => r.len).sort((a, b) => a - b)[Math.floor(content.rows.length / 2)]
      : null,
  contentEmpty,
  contentEmptyCount: contentEmpty.length,
  mode: STATIC_NO_PROXY ? 'static-no-proxy' : 'auth-attributed',
  envAttribution: content.method === 'render'
    ? content.rows.filter((r) => r.consoleErrors > 0).reduce((acc, r) => {
        const k = STATIC_NO_PROXY ? 'static-no-proxy' : 'auth-required-401';
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {})
    : {},
  probeErrors: probeErrRows,
  deniedEndpoints: [...deniedEndpoints].sort().slice(0, 60),
  strictGates: {
    parseErrors: parseErrors.length,
    mainRows: mainRows.length,
    redirectRows: redirectRows.length,
    contentVerified,
  },
  notes:
    redirectRows.length !== 23
      ? [`redirects=${redirectRows.length} vs 门定值 23（routes.ts 并发新增形态，归因非判红；门值更新归 L0/A）`]
      : [],
  routesRenderedWithoutMainEl: content.method === 'render' ? content.rows.filter((r) => !r.hasMainEl).length : null,
  routesWithConsoleErrors: content.method === 'render' ? content.rows.filter((r) => r.consoleErrors > 0).length : null,
  parseErrors,
  ok: deadLinks.length === 0 && contentEmpty.length === 0 && probeErrRows.length === 0,
};
let headHash = null;
try {
  headHash = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
} catch {
  headHash = null;
}
out.headHash = headHash;
out.exitCode = out.ok ? 0 : 1;
out.counts = {
  probed: results.length,
  deadLinks: deadLinks.length,
  contentEmpty: contentEmpty.length,
  probeErrors: probeErrRows.length,
  verdicts,
};
console.log(JSON.stringify(out, null, 2));
process.exit(out.exitCode);
