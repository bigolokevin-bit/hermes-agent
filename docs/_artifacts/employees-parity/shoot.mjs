// 员工列表密度车道截图：1440×900 与 375×812，登录态用 parity-own/storageState.json。
// 纪律：domcontentloaded + 显式 settle（禁 networkidle）；截图取视口图。
import { createRequire } from 'node:module';
import { statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const req = createRequire('/Users/kevin_studio/Projects/forks/hermes-agent/web/package.json');
const { chromium } = req('playwright');
const CANDIDATES = [
  path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
];
const executablePath = CANDIDATES.find((p) => { try { return statSync(p).isFile(); } catch { return false; } });
const BASE = 'http://127.0.0.1:9122';
const OUT = '/Users/kevin_studio/Projects/forks/hermes-agent/docs/_artifacts/employees-parity';
const STATE = '/Users/kevin_studio/Projects/forks/hermes-agent/docs/_artifacts/parity-own/storageState.json';
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(viewport, file) {
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const context = await browser.newContext({ viewport, storageState: STATE });
  const page = await context.newPage();
  const api = [];
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/agent-api/') || u.pathname.startsWith('/api/')) api.push(`${r.status()} ${u.pathname}${u.search}`);
  });
  page.on('console', (m) => { if (m.type() === 'error') console.log('console-error:', m.text().slice(0,300)); });
  page.on('pageerror', (e) => console.log('pageerror:', String(e).slice(0,500)));
  page.on('requestfailed', (r) => console.log('reqfail:', r.url().slice(0,200), r.failure()?.errorText));
  page.on('request', (r) => { if (r.url().includes('/agent-api/')) console.log('req:', r.url().slice(0,160)); });
  await page.goto(`${BASE}/employees`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('[data-testid="employees-module"]').waitFor({ state: 'visible', timeout: 30000 });
  await page
    .waitForFunction(
      () => document.querySelector('[data-testid="emp-list-state"]')?.getAttribute('data-phase') !== 'loading',
      null,
      { timeout: 30000 },
    )
    .catch(() => {});
  await settle(1200);
  const probe = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      tablists: document.querySelectorAll('[role="tablist"]').length,
      overflowX: doc.scrollWidth - doc.clientWidth,
      rows: document.querySelectorAll('[data-testid^="employees-row-"]').length,
      headers: Array.from(document.querySelectorAll('[data-testid="employees-table-head"] > *')).map((el) => el.textContent?.trim()),
      count: document.querySelector('[data-testid="emp-list-count"]')?.textContent,
      segbar: document.querySelectorAll('.console-segbar > i').length,
      text: document.querySelector('[data-testid="employees-list-card"]')?.innerText.slice(0, 4000),
      phase: document.querySelector('[data-testid="emp-list-state"]')?.getAttribute('data-phase'),
      skeleton: document.querySelectorAll('.animate-pulse').length,
    };
  });
  await page.screenshot({ path: `${OUT}/${file}`, timeout: 30000 });
  await browser.close();
  return { probe, api };
}

const only = process.argv[2] ?? 'both';
const wide = only === '375' ? { probe: {}, api: [] } : await shoot({ width: 1440, height: 900 }, 'list-1440.png');
const narrow = only === '1440' ? { probe: {}, api: [] } : await shoot({ width: 375, height: 812 }, 'list-375.png');
for (const [name, r] of [['1440', wide], ['375', narrow]]) {
  if (only !== 'both' && name !== only) continue;
  console.log(`--- ${name}`, JSON.stringify({ ...r.probe, text: undefined }, null, 0));
  console.log(`api(${name}):`, r.api.join(', '));
}
console.log('--- text 1440 ---');
console.log(wide.probe.text);