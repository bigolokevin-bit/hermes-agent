#!/usr/bin/env node
// M0 gate 1/3 — Information-architecture assertions over docs/console-v4-skeleton.html.
// Pure static parse (no browser). Exit 0 only if every assertion passes.
//
// Expected per spec: routes>=51, tabs===22, chatHosts===1, modules===8, badCode=[].
// NOTE: the shipped sidebar markup uses `data-mod` (not `data-module`); we accept
// either and count <a> elements inside <aside class="side">.
//
// --- lane-D extension --------------------------------------------------------
// `--source=react` runs the SAME assertions against the React sources instead of
// the HTML baseline:
//   * web/src/shell/routes.ts        -> appendix-A route rows (see countRoutes doc)
//   * web/src/modules/*/manifest.ts  -> module count + sum of `tabs:` arrays
//   * chat host markers              -> `data-chat-host` attrs / `<ChatHost` mounts
//   * badCode                        -> TODO|FIXME|@ts-ignore|@ts-expect-error|
//                                       console.log|debugger lines under src/shell/**
//                                       and src/modules/**
// Expected in react mode: routes===51, tabs===22, chatHosts===1, modules===8,
// badCode=[] (exact 51, not >=51: the route table is enumerated data, and the
// file's own count law excludes the 23 redirect-only forms).
// Parsing is regex/scanner based — nothing is imported from TypeScript.
// If a source file/dir is absent the script prints a `MISSING <path>` list and
// exits 1 (fail loud; never a silent 0).
// Default (no `--source`) and `--source=html` keep the shipped HTML baseline
// behaviour below unchanged.
// -----------------------------------------------------------------------------

import { readFileSync, readdirSync, existsSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// L0 二十九轮（2026-11-19）：--out=<path> 时以 tmp+rename 原子替换本脚本唯一一份账本
// console.log 载荷（禁 append，防 13:09 类拼接中间态被读到）；缺省维持 stdout 供重定向。
const OUT_FILE = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6) || null;
if (OUT_FILE) {
  console.log = (s) => {
    const tmp = `${OUT_FILE}.tmp.${process.pid}`;
    writeFileSync(tmp, `${s}\n`);
    renameSync(tmp, OUT_FILE);
  };
}
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 十轮三红收口（L0 02:45 卡②）：单文件单 JSON 产物内嵌代次与真实退出码。
const HEAD_HASH = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
})();
const HTML_PATH = path.join(ROOT, 'docs', 'console-v4-skeleton.html');

// --- mode ------------------------------------------------------------------

const MODE_FLAG = '--source=';
const modeArg = process.argv.slice(2).find((a) => a.startsWith(MODE_FLAG));
const MODE = modeArg ? modeArg.slice(MODE_FLAG.length) : 'html';

if (MODE !== 'html' && MODE !== 'react') {
  console.error(`assert-ia: unknown --source=${MODE} (expected "html" or "react")`);
  process.exit(2);
}

// React-source mode paths (declarations hoisted above the dispatch: module-level
// `const` lives in a TDZ, and assertReactSource() runs synchronously from here).
const SRC_ROOT = path.join(ROOT, 'src'); // web/src (ROOT == web/)
const SHELL_DIR = path.join(SRC_ROOT, 'shell');
const MODULES_DIR = path.join(SRC_ROOT, 'modules');
const ROUTES_TS = path.join(SHELL_DIR, 'routes.ts');
const REL = (p) => path.relative(path.resolve(ROOT, '..'), p); // display from repo root

const SRC_BAD_PATTERNS = [
  { name: 'TODO', re: /\bTODO\b/ },
  { name: 'FIXME', re: /\bFIXME\b/ },
  { name: '@ts-ignore', re: /@ts-ignore/ },
  { name: '@ts-expect-error', re: /@ts-expect-error/ },
  { name: 'console.log', re: /console\.log\s*\(/ },
  { name: 'debugger', re: /^\s*debugger\b|[^.\w]debugger\b/ },
];

if (MODE === 'react') process.exit(assertReactSource());

// --- HTML baseline (verbatim from scripts/assert-ia.mjs, upstream console-web) ---

const html = readFileSync(HTML_PATH, 'utf8');

// --- counts ---------------------------------------------------------------

// routes: unique href="#/…" values
const routeMatches = html.match(/href="#\/[^"]*"/g) ?? [];
const routes = new Set(routeMatches.map((m) => m.slice(6, -1))).size;

// tabs: every data-tabname= occurrence; visible tabs exclude data-hidetab panes
const tabTags = [...html.matchAll(/<div\b[^>]*data-tabname="[^"]*"[^>]*>/g)].map((m) => m[0]);
const tabsAll = tabTags.length;
const tabs = tabTags.filter((t) => !/data-hidetab/.test(t)).length;

// chatHosts: data-chat-host markers
const chatHosts = (html.match(/data-chat-host/g) ?? []).length;

// modules: <a …data-module…|…data-mod…> inside the sidebar <aside class="side">
let modules = 0;
const sideStart = html.indexOf('<aside class="side"');
if (sideStart !== -1) {
  const sideEnd = html.indexOf('</aside>', sideStart);
  const side = html.slice(sideStart, sideEnd === -1 ? html.length : sideEnd);
  modules = (side.match(/<a\b[^>]*\bdata-(?:module|mod)=/g) ?? []).length;
}

// badCode: removed chat/session implementation must not reappear
const BAD_PATTERNS = ['renderSession(', 'class="msg', 'class="bub', 'sessInput', 'composer'];
const badCode = BAD_PATTERNS.filter((p) => html.includes(p));

// --- assertions -----------------------------------------------------------

const checks = [
  { name: 'routes', ok: routes >= 51, actual: routes, expected: '>=51' },
  { name: 'tabs', ok: tabs === 22, actual: tabs, expected: 22 },
  { name: 'chatHosts', ok: chatHosts === 1, actual: chatHosts, expected: 1 },
  { name: 'modules', ok: modules === 8, actual: modules, expected: 8 },
  { name: 'badCode', ok: badCode.length === 0, actual: badCode, expected: [] },
];

const failed = checks.filter((c) => !c.ok);
const summary = {
  script: 'assert-ia',
  file: path.relative(ROOT, HTML_PATH),
  counts: { routes, tabs, tabsAll, chatHosts, modules },
  badCode,
  checks,
  ok: failed.length === 0,
  headHash: HEAD_HASH,
  exitCode: failed.length === 0 ? 0 : 1,
};

console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);

// ===========================================================================
// React-source mode (lane-D) — static parse only, see header for the contract.
// Everything it reads (SRC_ROOT / SHELL_DIR / MODULES_DIR / ROUTES_TS / REL /
// SRC_BAD_PATTERNS) is declared up with the mode dispatch, above the HTML
// baseline, because assertReactSource() is called from there.
// ===========================================================================

/** Recursive list of .ts/.tsx files (skips node_modules / dot dirs / tests). */
function listSourceFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      out.push(...listSourceFiles(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.tsx?$/.test(entry.name)) continue;
    // Doc-comment contract: tests are NOT source — marker literals inside
    // *.test.tsx (e.g. querySelector('[data-chat-host]') in the chat module
    // test) were being counted as hosts. Integration-lane fix, matches the
    // header comment; D please co-review.
    if (/\.(test|spec)\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out.sort();
}

/**
 * Blank one balanced `[...]` block, so its contents stop matching entry regexes.
 * `fromIdx` is the start of the declaration, NOT the array: the opening bracket
 * is the `[` that follows the declaration's `=` (a type annotation such as
 * `readonly ConsoleRedirect[]` contains a `[` that must not be mistaken for it).
 * Quote-aware.
 */
function blankArray(src, fromIdx) {
  const assign = /=\s*\[/.exec(src.slice(fromIdx));
  if (!assign) return src;
  const open = fromIdx + assign.index + assign[0].length - 1;
  let depth = 0;
  let quote = null;
  let i = open;
  for (; i < src.length; i += 1) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === '[' || c === '{' || c === '(') depth += 1;
    else if (c === ']' || c === '}' || c === ')') {
      depth -= 1;
      if (depth === 0) {
        i += 1;
        break;
      }
    }
  }
  return `${src.slice(0, open)}/*[blanked balanced array]*/${src.slice(i)}`;
}

/** Line/block comments blanked (length preserved) — docs must not fake a hit. */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

/**
 * Route rows in web/src/shell/routes.ts.
 *
 * Format on disk (lane A stage 1, routes.ts header "SHAPE NOTE"): every
 * appendix-A row is an object whose FIRST key is `hash:` and it also carries a
 * `path:` form, and the 23 REDIRECTS rows nest `{ hash, path }` endpoint objects.
 * The file's own count law is 51 counted rows (22 tabs + 1 detail + 4 zones +
 * 5 views + 14 tab-compat + 5 module-compat), REDIRECTS excluded — so the
 * REDIRECTS array is blanked first, then rows are counted by their leading key:
 *   1. `{ hash: '…'`  — the actual fork form            -> form "hash-rows"
 *   2. `{ path: '…'`  — the form the brief assumed      -> form "path-rows"
 *   3. any `path:` value, deduplicated                  -> form "path-keys-unique"
 * Nothing is imported from TypeScript; counts stay 0 when nothing parses, which
 * fails the routes===51 check out loud.
 */
function countRoutes(text) {
  let body = text;
  const redirectDecl = body.search(/\b(?:export\s+)?const\s+REDIRECTS\b/);
  if (redirectDecl !== -1) body = blankArray(body, redirectDecl);

  const hashRows = (body.match(/\{\s*hash\s*:\s*(['"`])/g) ?? []).length;
  if (hashRows > 0) return { routes: hashRows, form: 'hash-rows' };

  const pathRows = (body.match(/\{\s*path\s*:\s*(['"`])/g) ?? []).length;
  if (pathRows > 0) return { routes: pathRows, form: 'path-rows' };

  const unique = new Set(
    (body.match(/\bpath\s*:\s*(['"`])([^'"`]+)\1/g) ?? []).map((m) => m.slice(m.indexOf(':') + 1)),
  );
  return { routes: unique.size, form: unique.size ? 'path-keys-unique' : 'none' };
}

/** Number of top-level entries in every `tabs: [...]` array in a manifest. */
function countTabs(text) {
  let total = 0;
  for (const m of text.matchAll(/\btabs\s*:\s*\[/g)) {
    total += countArrayEntries(text, text.indexOf('[', m.index));
  }
  return total;
}

/**
 * Scanner: counts elements declared at the top level of the array starting at
 * `open` (src[open] === '['). Handles nested []/{}/(), quoted strings with
 * escapes, whitespace and trailing commas. Entry forms counted: object literal,
 * nested array, string literal, bare identifier/number.
 */
function countArrayEntries(src, open) {
  const startsEntry = (prev) => prev === '[' || prev === ',';
  let depth = 0;
  let prev = '[';
  let count = 0;
  let quote = null;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      if (depth === 1 && startsEntry(prev)) count += 1;
      quote = c;
      prev = c;
      continue;
    }
    if (c === '[' || c === '{') {
      if (depth === 1 && startsEntry(prev)) count += 1;
      depth += 1;
      prev = c;
      continue;
    }
    if (c === '(') {
      depth += 1;
      prev = c;
      continue;
    }
    if (c === ']' || c === '}' || c === ')') {
      depth -= 1;
      if (depth === 0) break;
      prev = c;
      continue;
    }
    if (c === ',') {
      prev = ',';
      continue;
    }
    if (/\s/.test(c)) continue;
    if (depth === 1 && startsEntry(prev) && /[A-Za-z0-9_$.]/.test(c)) count += 1;
    prev = c;
  }
  return count;
}

/**
 * Chat hosts: one host = one place that mounts the chat runtime. Comments are
 * blanked first (routes/manifest doc-strings quote `[data-chat-host]` from the
 * skeleton and must not count as a mount). A file counts
 * max(`data-chat-host` attrs, `<ChatHost` mounts) so the common
 * `<ChatHost …><div data-chat-host>` pairing counts once, not twice.
 */
function countChatHosts(files) {
  let hosts = 0;
  const markers = [];
  for (const file of files) {
    const text = stripComments(readFileSync(file, 'utf8'));
    const attrs = (text.match(/data-chat-host/g) ?? []).length;
    const mounts = (text.match(/<ChatHost\b/g) ?? []).length;
    const n = Math.max(attrs, mounts);
    if (n > 0) {
      hosts += n;
      markers.push(`${REL(file)} attrs=${attrs} mounts=${mounts}`);
    }
  }
  return { hosts, markers };
}

/** Source lines under shell/ and modules/ matching the banned patterns. */
function scanBadCode(files) {
  const hits = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const { name, re } of SRC_BAD_PATTERNS) {
        if (re.test(line)) {
          hits.push(`${REL(file)}:${i + 1} ${name} ${line.trim().slice(0, 120)}`);
        }
      }
    });
  }
  return hits;
}

function assertReactSource() {
  const missing = [];
  if (!existsSync(ROUTES_TS)) missing.push(REL(ROUTES_TS));

  let manifests = [];
  if (existsSync(MODULES_DIR)) {
    manifests = readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
      .map((d) => path.join(MODULES_DIR, d.name, 'manifest.ts'))
      .filter((p) => existsSync(p))
      .sort();
    if (manifests.length === 0) missing.push(`${REL(MODULES_DIR)}/*/manifest.ts`);
  } else {
    missing.push(REL(MODULES_DIR));
  }

  const scanFiles = [...listSourceFiles(SHELL_DIR), ...listSourceFiles(MODULES_DIR)];

  const routeInfo = existsSync(ROUTES_TS)
    ? countRoutes(readFileSync(ROUTES_TS, 'utf8'))
    : { routes: 0, form: 'missing-routes-ts' };
  const routes = routeInfo.routes;
  let tabs = 0;
  for (const manifest of manifests) tabs += countTabs(readFileSync(manifest, 'utf8'));
  const modules = manifests.length;
  const chat = existsSync(SHELL_DIR) || existsSync(MODULES_DIR)
    ? countChatHosts(scanFiles)
    : { hosts: 0, markers: [] };
  const badCode = scanBadCode(scanFiles);

  const checks = [
    { name: 'routes', ok: routes === 51, actual: routes, expected: 51 },
    { name: 'tabs', ok: tabs === 22, actual: tabs, expected: 22 },
    { name: 'chatHosts', ok: chat.hosts === 1, actual: chat.hosts, expected: 1 },
    { name: 'modules', ok: modules === 8, actual: modules, expected: 8 },
    { name: 'badCode', ok: badCode.length === 0, actual: badCode, expected: [] },
  ];
  const ok = missing.length === 0 && checks.every((c) => c.ok);

  for (const m of missing) console.error(`MISSING ${m}`);

  console.log(
    JSON.stringify(
      {
        script: 'assert-ia',
        mode: 'react',
        file: [REL(ROUTES_TS), `${REL(MODULES_DIR)}/*/manifest.ts`],
        sources: {
          routesTs: existsSync(ROUTES_TS),
          routeForm: routeInfo.form,
          manifests: manifests.map(REL),
          scannedFiles: scanFiles.length,
          chatHostMarkers: chat.markers,
        },
        missing,
        counts: { routes, tabs, chatHosts: chat.hosts, modules },
        badCode,
        checks,
        ok,
        headHash: HEAD_HASH,
        exitCode: ok ? 0 : 1,
      },
      null,
      2,
    ),
  );
  return ok ? 0 : 1;
}
