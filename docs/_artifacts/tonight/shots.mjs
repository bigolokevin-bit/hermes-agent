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
import { readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO = '/Users/kevin_studio/Projects/forks/hermes-agent';
const ROUTES_TS = path.join(REPO, 'web/src/shell/routes.ts');
const OUT_DIR = path.join(REPO, 'docs/_artifacts/tonight');
const SHOTS = path.join(OUT_DIR, 'shots');

const PW_HOST = '/Users/kevin_studio/Projects/seakoi-console-web/package.json';
const CHROMIUM = path.join(
  process.env.HOME || '',
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/' +
    'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);

const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://127.0.0.1:9119').slice(7);
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

const slugOf = (hash) =>
  hash
    .replace(/^#\//, '')
    .replace(/[/:?=&]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-') || 'root';

const target = ONLY ? rows.slice(0, 3) : rows;

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
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160));
    });
    page.on('pageerror', (e) => consoleErrors.push(String(e.message ?? e).slice(0, 160)));

    const url = `${BASE}/${row.hash}`;
    let status = null;
    let navError = null;
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      status = res ? res.status() : null;
      await page.waitForTimeout(400);
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
writeFileSync(path.join(OUT_DIR, 'shots-index.md'), `${md.join('\n')}\n`);

const consoleErrRoutes = [...new Set(index.filter((r) => r.consoleErrors > 0).map((r) => r.hash))];

const summary = {
  base: BASE,
  navForm: 'hash #/<route>',
  routesEnumerated: rows.length,
  expectedShots: target.length * 2,
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
  routesWithConsoleErrors: consoleErrRoutes.length,
  consoleErrorRoutes: consoleErrRoutes,
  overflowing: [...new Set(index.filter((r) => r.overflowPx > 1).map((r) => r.hash))],
  driver: { playwrightFrom: PW_HOST, chromium: CHROMIUM },
  ok:
    failures.length === 0
    && pngCount === target.length * 2
    && emptyMain.length === 0
    && missingMainEl.length === 0
    && consoleErrRoutes.length === 0,
};
writeFileSync(path.join(OUT_DIR, 'shots-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
