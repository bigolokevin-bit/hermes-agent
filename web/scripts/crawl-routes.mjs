#!/usr/bin/env node
// M0 gate 2/3 — headless crawl of every hash route in docs/console-v4-skeleton.html.
// For each route, at desktop (1440x900) and mobile (375x812) viewports:
//   * main text length < 40 chars        -> empty
//   * scrollWidth - clientWidth > 1      -> horizontal overflow
//   * pageerror / console.error          -> errors (entries mentioning :9119 are filtered)
// Exit 1 if any of the three lists is non-empty.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const require_ = createRequire(import.meta.url);
const { chromium } = require_('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML_PATH = path.join(ROOT, 'docs', 'console-v4-skeleton.html');
const FILE_URL = 'file://' + HTML_PATH;

const EXECUTABLE = path.join(
  os.homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/' +
    'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
];

// --- routes ----------------------------------------------------------------

const html = readFileSync(HTML_PATH, 'utf8');
const routes = [...new Set((html.match(/href="#\/[^"]*"/g) ?? []).map((m) => m.slice(6, -1)))].sort();

const isEmpty = (s) => s.includes(':9119'); // hermes chat endpoint not running is fine

// --- crawl -----------------------------------------------------------------

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  args: ['--allow-file-access-from-files'],
});

const empty = [];
const overflow = [];
const errors = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();

  let bucket = []; // active route's errors
  page.on('pageerror', (err) => {
    const text = String(err && err.stack ? err.stack : err);
    if (!isEmpty(text)) bucket.push({ viewport: vp.name, type: 'pageerror', text: text.slice(0, 400) });
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    const loc = (msg.location() && msg.location().url) || '';
    if (isEmpty(text) || isEmpty(loc)) return;
    bucket.push({ viewport: vp.name, type: 'console.error', text: text.slice(0, 400) });
  });

  for (const route of routes) {
    bucket = [];
    await page.goto(FILE_URL + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(150); // let hashchange -> route() settle

    const probe = await page.evaluate(() => {
      const el = document.querySelector('main') || document.querySelector('.main');
      const de = document.documentElement;
      return {
        len: el ? (el.innerText || '').trim().length : 0,
        overflowPx: de.scrollWidth - de.clientWidth,
      };
    });

    if (probe.len < 40) empty.push({ route, viewport: vp.name, len: probe.len });
    if (probe.overflowPx > 1) overflow.push({ route, viewport: vp.name, px: probe.overflowPx });
    for (const e of bucket) errors.push({ route, ...e });
  }

  await context.close();
}

await browser.close();

const ok = empty.length === 0 && overflow.length === 0 && errors.length === 0;
const result = { script: 'crawl-routes', routes: routes.length, empty, overflow, errors, ok };
console.log(JSON.stringify(result, null, 2));
process.exit(ok ? 0 : 1);
