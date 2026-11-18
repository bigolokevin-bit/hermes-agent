#!/usr/bin/env node
// lane-D gate — fetch-based route probe (replaces the playwright crawler).
//
// WHY: this fork does not install playwright/@playwright/test (pnpm-lock pins
// 1.64.0, but `require.resolve('playwright')` from web/ is MODULE_NOT_FOUND)
// and lane D must not add dependencies. A plain HTTP probe answers the
// question crawl-routes exists for on a client-routed SPA: does the server
// answer each address form, with which status and content type.
//
// Address forms come from web/src/shell/routes.ts as it is actually written:
//   * 51 appendix-A rows = CONSOLE_TABS(22) + DETAIL_TAB(1)
//     + DETAIL_ZONES_EXTRA(4) + VIEW_DEEP_LINKS(5) + COMPAT_TABS(14)
//     + COMPAT_MODULES(5); every row carries `hash` (PRD literal) and `path`
//     (react-router form).
//   * REDIRECTS is excluded from the 51 and probed as the 23 redirect-only
//     forms, via each row's `from` object.
//   * `:employeeId` in a path form is substituted with a live id from
//     GET /api/employees?limit=1 when one exists (recorded in
//     `paramSubstitution`); if none can be resolved the literal is probed and
//     the row is marked paramUnresolved.
//
// Judgement (per the lane-D brief's known pitfall: bare /hermes and deep links
// return 200 text/html from the SPA fallback, not 301):
//   * deadLinks counts ONLY 4xx/5xx responses and transport failures.
//   * 200 text/html            -> 'spa-fallback' (client route; server cannot 404 it)
//   * 2xx application/json     -> 'api'
//   * 3xx                      -> 'redirect'
// Exit 0 when deadLinks is empty, 1 otherwise.
//
// Usage: node web/scripts/crawl-routes.mjs [--base http://127.0.0.1:9119]
//                                          [--timeout 8000] [--concurrency 6]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // web/
const ROUTES_TS = path.join(ROOT, 'src', 'shell', 'routes.ts');

// --- args -------------------------------------------------------------------

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log('usage: crawl-routes.mjs [--base URL] [--timeout MS] [--concurrency N]');
  console.log('  reads web/src/shell/routes.ts and probes 51 appendix-A forms + 23 redirect forms');
  process.exit(0);
}
const flagOf = (name, dflt) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};

const BASE = String(flagOf('base', 'http://127.0.0.1:9119')).replace(/\/+$/, '');
const TIMEOUT = Number(flagOf('timeout', '8000'));
const CONCURRENCY = Math.max(1, Number(flagOf('concurrency', '6')));

// --- scanner helpers --------------------------------------------------------

/**
 * Given text and the index of an opening bracket, return the balanced slice
 * `[text, endIdxAfterClose]`. Quote- and escape-aware.
 */
function balancedSlice(src, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < src.length; i += 1) {
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
      if (depth === 0) return [src.slice(open, i + 1), i + 1];
    }
  }
  return [src.slice(open), src.length];
}

/** Find the `[` that opens the array literal of `const NAME … = [`. */
function declArrayOpen(src, name) {
  const at = src.search(new RegExp(`\\b(?:export\\s+)?const\\s+${name}\\b`));
  if (at === -1) return -1;
  const assign = /=\s*\[/.exec(src.slice(at));
  if (!assign) return -1;
  return at + assign.index + assign[0].length - 1;
}

/** Object literals at the top level of the array `NAME = [...]`. */
function arrayObjects(src, name) {
  const open = declArrayOpen(src, name);
  if (open === -1) return null;
  const [body] = balancedSlice(src, open);
  return topLevelObjects(src, open, open + body.length);
}

/** The single object of `const NAME … = { ... }`. */
function objectOfDecl(src, name) {
  const at = src.search(new RegExp(`\\b(?:export\\s+)?const\\s+${name}\\b`));
  if (at === -1) return null;
  const assign = /=\s*\{/.exec(src.slice(at));
  if (!assign) return null;
  const open = at + assign.index + assign[0].length - 1;
  const [body] = balancedSlice(src, open);
  return body;
}

/** Object literals one level inside src[open] (which must be `[`). */
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
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === '{') {
      if (depth === 1) {
        const [text, next] = balancedSlice(src, i);
        out.push(text);
        i = next - 1;
        depth = 1; // balancedSlice left depth at its own base; array stays at 1
        continue;
      }
      depth += 1;
      continue;
    }
    if (c === '[' || c === '(') depth += 1;
    else if (c === ']' || c === ')' || c === '}') depth -= 1;
  }
  return out;
}

/**
 * Blank out `//` and block comments while preserving length and newlines.
 * String-aware: an apostrophe inside a comment (e.g. "appendix A's") must not
 * be mistaken for a quote, and `//` inside a string must not look like a
 * comment — routes.ts has both, and getting it wrong silently drops rows.
 */
function stripComments(text) {
  const out = [];
  let quote = null;
  let i = 0;
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  while (i < text.length) {
    const c = text[i];
    if (quote) {
      if (c === '\\') {
        out.push(text.slice(i, i + 2));
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      out.push(c);
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out.push(c);
      i += 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      const end = nl === -1 ? text.length : nl;
      out.push(blank(text.slice(i, end)));
      i = end;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      const end = close === -1 ? text.length : close + 2;
      out.push(blank(text.slice(i, end)));
      i = end;
      continue;
    }
    out.push(c);
    i += 1;
  }
  return out.join('');
}

/** First string literal value for `key: "…"|'…'|`…`` inside an object text. */
function strField(objText, key) {
  const m = new RegExp(`\\b${key}\\s*:\\s*(['"\`])([^'"\`]*)\\1`).exec(objText);
  return m ? m[2] : null;
}

/** The `{ … }` object assigned to `key:` inside an object text. */
function objectField(objText, key) {
  const m = new RegExp(`\\b${key}\\s*:\\s*\\{`).exec(objText);
  if (!m) return null;
  const open = objText.indexOf('{', m.index);
  const [text] = balancedSlice(objText, open);
  return text;
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

// --- probe ------------------------------------------------------------------

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
    try {
      bytes = (await res.arrayBuffer()).byteLength;
    } catch {
      /* body unreadable; the status still counts */
    }
    return { status: res.status, contentType: ct.split(';')[0].trim(), bytes, ms: Date.now() - startedAt, location: res.headers.get('location') };
  } catch (err) {
    const cause = err && err.cause ? ` (${String(err.cause.message ?? err.cause).slice(0, 80)})` : '';
    return { status: null, contentType: null, bytes: 0, ms: Date.now() - startedAt, error: `${err.name}: ${err.message}${cause}`.slice(0, 200) };
  }
}

function verdictOf(r) {
  if (r.status === null) return 'transport-error';
  if (r.status >= 400) return 'dead';
  if (r.status >= 300) return 'redirect';
  if (/application\/json/.test(r.contentType || '')) return 'api';
  if (/text\/html/.test(r.contentType || '')) return 'spa-fallback';
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
  return {
    ...row,
    pathProbe,
    paramUnresolved: parametrized && !params.id,
    // A fragment is never sent to the server, so every form is probed through
    // its react-router `path`; `hash` is kept for traceability.
    url: `${BASE}${pathProbe}`,
  };
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
      results.push({ ...t, ...r, verdict: verdictOf(r) });
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

const out = {
  script: 'crawl-routes',
  mode: 'fetch',
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
  parseErrors,
  note: '200 text/html = the SPA shell served the deep link (client routing); only 4xx/5xx and transport failures count as deadLinks.',
  ok: deadLinks.length === 0 && parseErrors.length === 0 && mainRows.length === 51 && redirectRows.length === 23,
};
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
