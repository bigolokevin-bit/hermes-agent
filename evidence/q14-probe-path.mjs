import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const req = createRequire('/Users/kevin_studio/Projects/seakoi-console-web/package.json');
const { chromium } = req('playwright');
const CHROMIUM = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const BASE = 'http://127.0.0.1:9131';
const TOKEN = readFileSync(path.join(os.homedir(), '.seakoi/opsadmin-token.txt'), 'utf8').trim();
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'access_token_cookie', value: TOKEN, url: BASE }]);
for (const target of ['/metrics', '/#/metrics', '/analytics', '/overview?tab=metrics']) {
  const page = await ctx.newPage();
  await page.goto(BASE + target, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(3500);
  const has = await page.evaluate(() => !!document.querySelector('[data-testid=\"metBM-by-model\"]'));
  const h1 = await page.evaluate(() => document.querySelector('h1')?.textContent ?? '');
  console.log(target, '-> metBM:', has, '| h1:', h1, '| url:', page.url());
  await page.close();
}
await browser.close();
