import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const req = createRequire('/Users/kevin_studio/Projects/seakoi-console-web/package.json');
const { chromium } = req('playwright');
const CHROMIUM = path.join(os.homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/' +
  'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const BASE = 'http://127.0.0.1:9131';
const TOKEN = readFileSync(path.join(os.homedir(), '.seakoi/opsadmin-token.txt'), 'utf8').trim();
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROMIUM });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies([{ name: 'access_token_cookie', value: TOKEN, url: BASE }]);
const page = await context.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
const api = [];
page.on('response', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api') || u.pathname.includes('whoami')) api.push(`${r.status()} ${u.pathname}`); });

await page.goto(`${BASE}/#/metrics`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await settle(6000);
const info = await page.evaluate(() => {
  const ids = [...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid'));
  return {
    hash: location.hash,
    h1: [...document.querySelectorAll('h1,h2')].map((e) => e.textContent).slice(0, 8),
    metPrefixes: [...new Set(ids.filter((i) => i && /^met/.test(i)))].slice(0, 40),
    hasMetBM: ids.some((i) => i === 'metBM-by-model'),
    bodyHead: document.body.innerText.slice(0, 400),
  };
});
writeFileSync('/Users/kevin_studio/Projects/tasks/Q14-metrics-bymodel/evidence/q14-debug.json', JSON.stringify({ info, api: api.slice(0, 40), errs: errs.slice(0, 20) }, null, 2));
await page.screenshot({ path: '/Users/kevin_studio/Projects/tasks/Q14-metrics-bymodel/evidence/q14-debug.png', timeout: 30000 });
console.log(JSON.stringify(info, null, 1).slice(0, 1200));
console.log('API:', api.join(' | ').slice(0, 600));
console.log('ERRS:', errs.slice(0, 6).join(' || '));
await browser.close();
