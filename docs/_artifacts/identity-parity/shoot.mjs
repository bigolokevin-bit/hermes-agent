// 人员与访问三屏截图：1440×900 与 375×812，登录态用 parity-own/storageState.json。
// 纪律：domcontentloaded + 显式 settle（禁 networkidle）；截图取视口图；不 fullPage。
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
const OUT = '/Users/kevin_studio/Projects/forks/hermes-agent/docs/_artifacts/identity-parity';
const STATE = '/Users/kevin_studio/Projects/forks/hermes-agent/docs/_artifacts/parity-own/storageState.json';
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

const PANES = [
  { key: 'people', url: '/identity' },
  { key: 'departments', url: '/identity?tab=departments' },
  { key: 'roles', url: '/identity?tab=roles' },
];

async function shoot(viewport, pane) {
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const context = await browser.newContext({ viewport, storageState: STATE });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}${pane.url}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector(`[data-testid="identity-${pane.key}"]`, { state: 'visible', timeout: 30000 }).catch(() => {});
  // 等副行离开「读取中」：BFF 首读要等 profile 引导，短 settle 会拍到空壳。
  await page
    .waitForFunction(
      () => {
        const node = document.querySelector('[data-testid$="-sub"]');
        return Boolean(node) && !(node.textContent ?? '').includes('读取中');
      },
      null,
      { timeout: 25000 },
    )
    .catch(() => console.log('warn: sub 未离开读取中'));
  await settle(900);
  const probe = await page.evaluate(() => {
    const doc = document.documentElement;
    const pane = document.querySelector('[data-testid^="identity-"]');
    const tables = Array.from(document.querySelectorAll('[data-testid^="identity-"] .id-table'));
    const heads = tables.map((t) => Array.from(t.querySelectorAll('thead th')).map((th) => th.textContent?.trim()));
    const foots = Array.from(document.querySelectorAll('[data-testid^="identity-"] .id-foot__note')).map((n) => n.textContent?.trim());
    const subs = Array.from(document.querySelectorAll('[data-testid$="-sub"]')).map((n) => n.textContent?.replace(/\s+/g, ' ').trim());
    return {
      pane: pane?.getAttribute('data-testid'),
      subs,
      heads,
      foots,
      rows: tables.map((t) => t.querySelectorAll('tbody tr').length),
      tablists: document.querySelectorAll('[role="tablist"]').length,
      h1: document.querySelectorAll('h1').length,
      overflowX: doc.scrollWidth - doc.clientWidth,
      chars: document.querySelector('main')?.innerText.length ?? 0,
      dashes: (document.querySelector('main')?.innerText.match(/—/g) ?? []).length,
    };
  });
  await page.screenshot({ path: `${OUT}/${pane.key}-${viewport.width}.png`, timeout: 30000 });
  await browser.close();
  return { probe, errors: errors.filter((e) => !e.includes('favicon')) };
}

for (const pane of PANES) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
    const r = await shoot(viewport, pane);
    console.log(`--- ${pane.key} @${viewport.width}`);
    console.log(JSON.stringify(r.probe, null, 1));
    if (r.errors.length) console.log('console-errors:', r.errors.join(' | '));
  }
}