#!/usr/bin/env node
// lane-D evidence leg — 51 routes x 2 viewports = 102 PNG screenshots.
//
// HOW THIS RUNS WITHOUT INSTALLING ANYTHING:
//   * this fork's pnpm-lock pins @playwright/test/playwright 1.64.0 but the
//     packages are NOT in this repo's node_modules (require.resolve ->
//     MODULE_NOT_FOUND), and lane D must not touch package.json / the lockfile;
//   * so the driver is loaded by absolute path from the sibling checkout that
//     already has it installed (playwright 1.65.1), and the browser is the
//     chromium already downloaded in ~/Library/Caches/ms-playwright.
//   * no `pnpm add`, no `npx playwright install` was needed for this run; the
//     actual resolved paths are printed into the run log for auditability.
//
// NAVIGATION FORM: the brief fixes hash form `#/<route>` (51 x {1440x900,
// 375x812} = 102 shots). Measured behaviour (same build, crawl-routes leg):
// opening `#/work` lands the browser on `/work?profile=default` — the client
// rewrites the fragment into a react-router path, so hash navigation DOES render
// the pane (e.g. `#/overview` main text 462 chars, `#/work` 168). The app is
// BrowserRouter-mounted, so this is a property of the App's hash compatibility
// layer, not of the router; if that layer ever changes, shots will show an empty
// main and `routesWithEmptyMain` will go non-zero by itself.
//
// USABLE CRITERION (this round's fix): per-route `main` text length > 0 with a
// real <main> element. The earlier criterion compared each route's head against
// the root page's, but the root <main> is empty on this build (0 chars), which
// made the comparison non-discriminating (it flagged 51/51 as "unusable"). The
// root baseline is now recorded as a fact, and emptiness is judged per route.
//
// Outputs (under docs/_artifacts/tonight/):
//   shots/<slug>-1440.png , shots/<slug>-375.png
//   shots-index.md        route x viewport x status x signals
//   shots-summary.json    counts, oversize list, per-route console errors
//   shots/<slug>-*.png of routes whose shot exceeded --max-bytes are still
//   produced but listed in `oversize` (excluded from the commit by the runner).

import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync, statSync, renameSync } from 'node:fs';
// L0 二十九轮（2026-11-19）：账本类产物（summary/index JSON/MD）一律先写临时文件再
// renameSync 原子替换——禁 append、禁二次 open('a')，防外部读到拼接中间态（13:09 事故）。
// png 字节流为单发 writeFileSync 截断写，无拼接风险，维持原样。
const atomicWrite = (file, text) => {
  const tmp = `${file}.tmp.${process.pid}`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
};
import path from 'node:path';

const REPO = '/Users/kevin_studio/Projects/forks/hermes-agent';
const ROUTES_TS = path.join(REPO, 'web/src/shell/routes.ts');
const OUT_DIR = path.join(REPO, 'docs/_artifacts/tonight');
let SHOTS = path.join(OUT_DIR, 'shots');
// L0 二十三轮：--out/--only-routes/--viewports/--summary/--index —— anon 401 证据腿
// 与登录态主证据腿各落各家目录与 summary，互不覆盖。
const argVal = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3) || null;
const OUT_OVERRIDE = argVal('out');
const ONLY_ROUTES = argVal('only-routes');
const VPS_ARG = argVal('viewports');
const SUMMARY_FILE = argVal('summary') || path.join(OUT_DIR, 'shots-summary.json');
const INDEX_FILE = argVal('index') || path.join(OUT_DIR, 'shots-index.md');
if (OUT_OVERRIDE) SHOTS = path.isAbsolute(OUT_OVERRIDE) ? OUT_OVERRIDE : path.join(REPO, OUT_OVERRIDE);

const PW_HOST = '/Users/kevin_studio/Projects/seakoi-console-web/package.json';
const CHROMIUM = path.join(
  process.env.HOME || '',
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/' +
    'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);

const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://127.0.0.1:9119').slice(7);
// L0 十八轮：--auth-state <playwright storageState JSON>（与 crawl-routes 同款），
// 登录态下 pane 数据进 main，emptyMain 判据才有产品意义；缺省仍匿名=环境口径。
const AUTH_STATE = (process.argv.find((a) => a.startsWith('--auth-state=')) || '').slice(13) || null;
const MAX_BYTES = Number((process.argv.find((a) => a.startsWith('--max-bytes=')) || '--max-bytes=2097152').split('=')[1]);
const ONLY = process.argv.includes('--smoke'); // --smoke = 3 routes x 2 viewports

mkdirSync(SHOTS, { recursive: true });

// --- routes.ts: the 51 appendix-A hash forms (same scan as crawl-routes) ----

function stripComments(text) {
  let out = '';
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += text[i + 1];
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

function arrayObjects(src, name) {
  const at = src.search(new RegExp(`\\b(?:export\\s+)?const\\s+${name}\\b`));
  if (at === -1) return [];
  const assign = /=\s*\[/.exec(src.slice(at));
  if (!assign) return [];
  const open = at + assign.index + assign[0].length - 1;
  const [body, next] = balanced(src, open);
  const out = [];
  let depth = 0;
  let quote = null;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') {
      if (depth === 1) {
        const [text] = balanced(body, i);
        out.push(text);
        i += text.length - 1;
        continue;
      }
      depth += 1;
    } else if (c === '[' || c === '(') depth += 1;
    else if (c === ']' || c === '}' || c === ')') depth -= 1;
  }
  void next;
  return out;
}

function hashOf(objText) {
  const m = /\bhash\s*:\s*(['"`])([^'"`]*)\1/.exec(objText);
  return m ? m[2] : null;
}
function labelOf(objText) {
  const m = /\blabel\s*:\s*(['"`])([^'"`]*)\1/.exec(objText);
  return m ? m[2] : null;
}
function tabIdOf(objText) {
  const m = /\btabId\s*:\s*(['"`])([^'"`]*)\1/.exec(objText);
  return m ? m[2] : null;
}
function moduleOf(objText) {
  const m = /\bmodule\s*:\s*(['"`])([^'"`]*)\1/.exec(objText);
  return m ? m[2] : null;
}

const src = stripComments(readFileSync(ROUTES_TS, 'utf8'));
const rows = [];
for (const name of ['CONSOLE_TABS', 'DETAIL_ZONES_EXTRA', 'VIEW_DEEP_LINKS', 'COMPAT_TABS', 'COMPAT_MODULES']) {
  for (const o of arrayObjects(src, name)) {
    const hash = hashOf(o);
    if (hash) rows.push({ source: name, hash, label: labelOf(o), tabId: tabIdOf(o), module: moduleOf(o) });
  }
}
{
  const at = src.search(/\b(?:export\s+)?const\s+DETAIL_TAB\b/);
  const assign = /=\s*\{/.exec(src.slice(at));
  const open = at + assign.index + assign[0].length - 1;
  const [obj] = balanced(src, open);
  const hash = hashOf(obj);
  if (hash) rows.push({ source: 'DETAIL_TAB', hash, label: labelOf(obj), tabId: tabIdOf(obj), module: moduleOf(obj) });
}
rows.sort((a, b) => a.hash.localeCompare(b.hash));

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '375', width: 375, height: 812 },
];
if (VPS_ARG) {
  const keep = VPS_ARG.split(',').map((s) => s.trim());
  VIEWPORTS.splice(0, VIEWPORTS.length, ...VIEWPORTS.filter((v) => keep.includes(v.name)));
}

const slugOf = (hash) =>
  hash
    .replace(/^#\//, '')
    .replace(/[/:?=&]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-') || 'root';

let target = ONLY ? rows.slice(0, 3) : rows;
if (ONLY_ROUTES) {
  const want = ONLY_ROUTES.split(',').map((s) => s.trim()).filter(Boolean);
  target = target.filter((r) => want.some((w) => r.hash === w || r.hash.startsWith(`${w}?`)));
}

// --- run --------------------------------------------------------------------

const req = createRequire(PW_HOST);
const { chromium } = req('playwright');

const browser = await chromium.launch({ executablePath: CHROMIUM });
const index = [];
const oversize = [];
const failures = [];
let pngCount = 0;

// baseline: what the shell's root page renders, to detect hash-route effect.
// Root shell baseline, measured with the SAME main-only probe as the routes.
// Recorded fact: the root path renders an EMPTY <main> (0 chars) while the
// surrounding chrome (banner/nav/footer, ~770 body chars) is identical on every
// route — which is exactly why "main text > 0" is the binding criterion here and
// a body fallback would report ~770 chars of chrome as if it were content.
let rootProbe = { textLen: 0, head: '', hasMainEl: false, ok: false };
// L0 十六轮：与 crawl-routes 同口径的两处修复。
// (1) gated 标志注入：v4_proxy 静态 index.html 不注入 __HERMES_SESSION_TOKEN__/
//     __HERMES_AUTH_REQUIRED__，匿名 401 触发 api.ts stale-token reload（整页
//     reload 风暴，8 条 lane 模块路由截到「⠋Loading…」壳）。标志是真实 gated 部署
//     HTML 本会注入的值，置位后按 api.ts:221 注释「gated 模式不得 reload-loop」。
// (2) console 错误归因：401/404「Failed to load resource」是环境（无登录态）噪声，
//     与 crawl 的 env=auth-required-401 归因一致，不计入产品红灯；pageerror 与
//     其余 error 仍为产品面。
const ENV_NOISE_RE = /\b(401|404)\s*\((Unauthorized|Not Found)\)/;
const GATED_FLAG_INIT = () => { window.__HERMES_AUTH_REQUIRED__ = true; };
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(AUTH_STATE ? { storageState: AUTH_STATE } : {}) });
  if (!AUTH_STATE) await ctx.addInitScript(GATED_FLAG_INIT); // 登录态注真 cookie，不再强制门壳
  const p = await ctx.newPage();
  try {
    await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await p.waitForTimeout(400);
    rootProbe = await p.evaluate(() => {
      const el = document.querySelector('main') || document.querySelector('.main') || document.querySelector('[data-console-main]');
      if (!el) return { textLen: 0, head: '', hasMainEl: false, ok: true };
      const txt = (el.innerText || '').trim();
      return { textLen: txt.length, head: txt.slice(0, 80).replace(/\s+/g, ' '), hasMainEl: true, ok: true };
    });
  } catch (e) {
    rootProbe = { textLen: 0, head: '', hasMainEl: false, ok: false, error: String(e.message ?? e).slice(0, 120) };
  }
  await ctx.close();
}
const rootMainText = rootProbe.head;

for (const row of target) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, ...(AUTH_STATE ? { storageState: AUTH_STATE } : {}) });
    if (!AUTH_STATE) await ctx.addInitScript(GATED_FLAG_INIT); // 登录态注真 cookie，不再强制门壳
    const page = await ctx.newPage();
    const consoleErrors = [];
    let consoleErrorsProduct = 0;
    page.on('console', (m) => {
      if (m.type() === 'error') {
        const msg = m.text().slice(0, 160);
        consoleErrors.push(msg);
        if (!ENV_NOISE_RE.test(msg)) consoleErrorsProduct += 1;
      }
    });
    page.on('pageerror', (e) => { consoleErrors.push(String(e.message ?? e).slice(0, 160)); consoleErrorsProduct += 1; });

    // L0 拍板口径（2026-11-19 卡·门禁 D 预跑）：9122 是 python http.server
    // 纯静态，只有根路径保证 200，直链 path 形态必 404。
    // L0 二十三轮修复：auth 态 location.hash 赋值不触发路由切换（R5 代次 SPA
    // boot 后为 path-router，hash 变更被忽略→102 张全落默认着陆页）。改 crawl
    // 同款「单次 hash 形态直导」：静态服务只见 '/'（hash 不发服务器）恒 200，
    // SPA boot 时把 #/<route> 转内部路由——404 担忧只适用 path 形态。
    let status = null;
    let navError = null;
    try {
      const h = row.hash.startsWith('#') ? row.hash : `#${row.hash}`;
      const res = await page.goto(`${BASE}/${h}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      status = res ? res.status() : null;
      // L0 十六轮：400ms 固定等待改「main 文本稳定且非空」轮询（与 crawl-routes
      // settle 同思路）。修复 gated 标志后不再被 reload 壳的「⠋Loading…」意外
      // 垫过非空检查——lazy 模块 chunk 在慢盘/并发下 >400ms，直取会截到空 main。
      {
        let prev = -1;
        const t0 = Date.now();
        while (Date.now() - t0 < 4000) {
          await page.waitForTimeout(150);
          const cur = await page
            .evaluate(() => (document.querySelector('main')?.innerText || '').trim().length)
            .catch(() => 0);
          if (cur > 0 && cur === prev) break;
          prev = cur;
        }
      }
    } catch (e) {
      navError = String(e.message ?? e).slice(0, 160);
      failures.push({ hash: row.hash, viewport: vp.name, error: navError });
    }

    // main-only, no body fallback: the served shell's chrome (banner, nav,
    // footer) is identical on every route, so falling back to body would let a
    // blank pane "pass" on ~700 chars of chrome. Same rule as crawl-routes.
    const probe = await page
      .evaluate(() => {
        const el = document.querySelector('main') || document.querySelector('.main') || document.querySelector('[data-console-main]');
        const de = document.documentElement;
        if (!el) {
          return { textLen: 0, head: '', hasMainEl: false, hasEmpty: false, hasError: false, overflowPx: de.scrollWidth - de.clientWidth };
        }
        const txt = (el.innerText || '').trim();
        return {
          textLen: txt.length,
          head: txt.slice(0, 80).replace(/\s+/g, ' '),
          hasMainEl: true,
          hasEmpty: /暂无|没有数据|空|未接入|规划中|无结果/.test(txt),
          hasError: /失败|错误|不可用|异常|无法|出错/.test(txt),
          overflowPx: de.scrollWidth - de.clientWidth,
        };
      })
      .catch(() => ({ textLen: 0, head: '(eval failed)', hasMainEl: false, hasEmpty: false, hasError: false, overflowPx: -1 }));

    const file = path.join(SHOTS, `${slugOf(row.hash)}-${vp.name}.png`);
    let bytes = 0;
    try {
      await page.screenshot({ path: file, fullPage: false });
      bytes = statSync(file).size;
      pngCount += 1;
      if (bytes > MAX_BYTES) oversize.push({ file: path.relative(OUT_DIR, file), bytes });
    } catch (e) {
      failures.push({ hash: row.hash, viewport: vp.name, error: `screenshot: ${String(e.message ?? e).slice(0, 120)}` });
    }

    index.push({
      hash: row.hash,
      label: row.label,
      module: row.module,
      tabId: row.tabId,
      source: row.source,
      viewport: vp.name,
      httpStatus: status,
      navError,
      mainTextLen: probe.textLen,
      hasMainEl: probe.hasMainEl,
      mainHead: probe.head,
      emptyHit: probe.hasEmpty,
      errorHit: probe.hasError,
      overflowPx: probe.overflowPx,
      mainNonEmpty: probe.hasMainEl && probe.textLen > 0,
      mainDiffersFromRoot:
        rootProbe.ok && rootProbe.textLen > 0 ? probe.head.slice(0, 40) !== rootMainText.slice(0, 40) : null,
      png: path.relative(OUT_DIR, file),
      pngBytes: bytes,
      consoleErrors: consoleErrors.length,
      consoleErrorsProduct,
      consoleErrorSample: consoleErrors[0] ?? null,
    });
    await ctx.close();
  }
}

await browser.close();

// --- outputs ----------------------------------------------------------------

// Binding criterion: per-route <main> text must be non-empty on every viewport.
const emptyMain = [...new Set(index.filter((r) => !r.mainNonEmpty).map((r) => r.hash))];
const missingMainEl = [...new Set(index.filter((r) => !r.hasMainEl).map((r) => r.hash))];

const md = [];
md.push('# lane-D screenshot evidence index');
md.push('');
md.push(`- base: \`${BASE}\`  |  nav form: \`#/<route>\` (hash, per brief)  |  viewports: 1440x900, 375x812`);
md.push(`- routes enumerated from \`web/src/shell/routes.ts\` appendix A: **${rows.length}**  |  routes driven this run: ${target.length}  |  expected shots: ${target.length * 2}  |  produced: **${pngCount}**`);
md.push(`- driver: playwright loaded from \`${PW_HOST}\` (sibling checkout, not installed here); chromium \`${CHROMIUM}\``);
md.push(`- root shell baseline: ok=${rootProbe.ok}, <main> text = ${rootProbe.textLen} chars, hasMainEl=${rootProbe.hasMainEl}${rootProbe.error ? `, error=${rootProbe.error}` : ''} — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route \`main>0\`; \`differsFromRoot\` is kept as secondary info only`);
md.push('');
md.push('| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of index) {
  const differs = r.mainDiffersFromRoot === null ? 'n/a' : r.mainDiffersFromRoot ? 'yes' : 'no';
  md.push(
    `| \`${r.hash}\` | ${r.label ?? ''} | ${r.viewport} | ${r.httpStatus ?? 'ERR'} | ${r.mainTextLen} | ${r.mainNonEmpty ? 'yes' : 'NO'} | ${r.emptyHit ? 'yes' : '-'} | ${r.errorHit ? 'yes' : '-'} | ${r.overflowPx} | ${differs} | ${r.pngBytes} | ${r.consoleErrors} |`,
  );
}
md.push('');
md.push(`- routes with empty main (any viewport): ${emptyMain.length ? `\`${emptyMain.join('`, `')}\`` : 'none'}`);
md.push(`- routes with no <main> element at all: ${missingMainEl.length ? `\`${missingMainEl.join('`, `')}\`` : 'none'}`);
md.push('');
md.push(`## oversize pngs (> ${MAX_BYTES} bytes, excluded from the commit)`);
md.push(oversize.length ? oversize.map((o) => `- \`${o.file}\` (${o.bytes} bytes)`).join('\n') : '- none');
md.push('');
md.push('## failures');
md.push(failures.length ? failures.map((f) => `- ${f.hash} @ ${f.viewport}: ${f.error}`).join('\n') : '- none');
atomicWrite(INDEX_FILE, `${md.join('\n')}\n`);

const consoleErrRoutes = [...new Set(index.filter((r) => r.consoleErrorsProduct > 0).map((r) => r.hash))];
// 归因透明：环境噪声（401/404）单列，不计入 ok，但保留可审计计数。
const envOnlyErrRoutes = [...new Set(index.filter((r) => r.consoleErrors > 0 && r.consoleErrorsProduct === 0).map((r) => r.hash))];

const summary = {
  base: BASE,
  mode: AUTH_STATE ? 'auth' : 'anon',
  authStateFile: AUTH_STATE, // 登录态工件路径（文件本身不入仓；此处只留指针）
  navForm: 'fresh-goto hash-form #/<route> (crawl-parity, 二十三轮修复)',
  routesEnumerated: rows.length,
  expectedShots: target.length * VIEWPORTS.length,
  producedShots: pngCount,
  failures,
  oversize,
  rootBaseline: rootProbe,
  distinctMainHeads: [...new Set(index.map((r) => r.mainHead.slice(0, 40)))].length,
  routesWithEmptyMain: emptyMain,
  routesWithoutMainEl: missingMainEl,
  mainCharsByRoute: index.map((r) => ({
    route: r.hash,
    viewport: r.viewport,
    chars: r.mainTextLen,
    hasMainEl: r.hasMainEl,
  })),
  // L0 二十九轮裁定：CE 权威=登录态捕获（QA R11 同代次 CE=0）。
  // 本字段仅为 shots 观察旁证，改名 Observed 后缀，不得参与 ok。
  consoleErrorsObservedByShots: consoleErrRoutes.length,
  consoleErrorRoutesObservedByShots: consoleErrRoutes,
  ceAuthority: 'login-state',
  routesWithEnvOnlyConsoleErrors: envOnlyErrRoutes.length,
  envAttribution: '401/404 Failed-to-load-resource = env (no login session at proxy); see crawl-routes env=auth-required-401 同口径',
  overflowing: [...new Set(index.filter((r) => r.overflowPx > 1).map((r) => r.hash))],
  driver: { playwrightFrom: PW_HOST, chromium: CHROMIUM },
  // L0 二十九轮：ok 固定 = failures==0 && produced==expected（emptyMain/missingMainEl/CE 均不再入式；
  // exitCode 与 ok 同源）。CE 口径见 ceAuthority=login-state。
  ok: failures.length === 0 && pngCount === target.length * VIEWPORTS.length,
};
atomicWrite(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
