// ux-capture-r2b — 补腿：审批筛选面板内搜索三态 + runs 时间范围/清除筛选交互 + 仅交互件 <44px 精计
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const require = createRequire('/Users/kevin_studio/Projects/seakoi-console-web/package.json');
const { chromium } = require('playwright');

const BASE = 'http://100.117.184.117:8183';
const AUTH = '/Users/kevin_studio/.local/state/sekoi-ops/ui-qa-auth-state.json';
const EXEC = (() => {
  const home = process.env.HOME || '';
  const cands = [
    path.join(home, 'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
    path.join(home, 'Library/Caches/ms-playwright/chromium-1255/Chromium.app/Contents/MacOS/Chromium'),
  ];
  try { const { statSync } = require('node:fs'); for (const c of cands) { try { statSync(c); return c; } catch {} } } catch {}
  return undefined; // 让 playwright 自行解析
})();

const OUTDIR = 'docs/_artifacts/ux/r2';
const SHOTS = path.join(OUTDIR, 'shots');
mkdirSync(SHOTS, { recursive: true });
const out = { startedAt: new Date().toISOString(), notes: [], legs: {} };

async function settle(page) {
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.waitForTimeout(400);
  for (let i = 0; i < 15; i++) {
    const busy = await page.evaluate(() => !!document.querySelector('[aria-busy="true"], [class*="skeleton"]'));
    if (!busy) break;
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(250);
}

const TAPS = () => {
  const bad = [];
  document.querySelectorAll('main a, main button, main select, main input, main [role="button"], main [role="tab"], main [role="link"]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none') return;
    if (r.width < 44 || r.height < 44) bad.push({ tag: el.tagName, t: (el.getAttribute('aria-label') || el.textContent || el.placeholder || '').trim().slice(0, 18), w: Math.round(r.width), h: Math.round(r.height) });
  });
  return { count: bad.length, sample: bad.slice(0, 30) };
};

async function shot(page, name) {
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
  return { file: `shots/${name}.png`, bytes: statSync(`${SHOTS}/${name}.png`).size };
}

function track(page, bag) {
  page.on('response', (res) => { if (res.status() >= 400) bag.badResponses.push({ url: res.url(), status: res.status() }); });
  page.on('console', (m) => { if (m.type() === 'error') bag.consoleErrors.push(m.text().slice(0, 140)); });
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: EXEC });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 2600 }, storageState: AUTH });

  // ---- 审批：筛选面板 → 搜索三态 ----
  const bagA = { badResponses: [], consoleErrors: [] };
  const pA = await ctx.newPage();
  track(pA, bagA);
  await pA.goto(`${BASE}/#/approvals`, { waitUntil: 'domcontentloaded' });
  await pA.waitForSelector('[data-testid^="apr5-row-"], [data-testid="apv-page"]', { timeout: 15000 }).catch(() => out.notes.push('approvals: rows/apv-page absent'));
  const toggle = pA.locator('[data-testid="apv-filter-toggle"]').first();
  if (await toggle.count()) {
    await toggle.click();
    await pA.waitForTimeout(500);
    await shot(pA, 'approvals-filter-panel-1440-r2b');
    const inp = pA.locator('[data-testid="apv8-search"], #apv8-search, [data-testid="apv-filter-panel"] input, main input').first();
    if (await inp.count()) {
      await inp.click(); await inp.fill(''); await inp.pressSequentially('message.send', { delay: 15 });
      await pA.keyboard.press('Enter'); await pA.waitForTimeout(700);
      out.legs.hitRows = await pA.locator('[data-testid^="apr5-row-"]').count();
      await shot(pA, 'approvals-search-hit-1440-r2b');
      await inp.fill(''); await inp.pressSequentially('zzzqx-不存在', { delay: 15 });
      await pA.keyboard.press('Enter'); await pA.waitForTimeout(700);
      out.legs.missRows = await pA.locator('[data-testid^="apr5-row-"]').count();
      out.legs.missEmptyMarker = await pA.locator('[data-testid="apv8-search-empty"]').count();
      await shot(pA, 'approvals-search-miss-1440-r2b');
      const clr = pA.locator('[data-testid="apv8-search-clear"]').first();
      if (await clr.count()) { await clr.click(); await pA.waitForTimeout(500); }
      out.legs.clearedRows = await pA.locator('[data-testid^="apr5-row-"]').count();
      await shot(pA, 'approvals-search-cleared-1440-r2b');
    } else out.notes.push('approvals: still no search input after panel open');
    out.legs.panelState = await pA.evaluate(() => {
      const t = document.querySelector('[data-testid="apv-filter-toggle"]');
      return { toggleAria: t && (t.getAttribute('aria-expanded') || t.textContent || '').slice(0, 24) };
    });
  } else out.notes.push('approvals: no apv-filter-toggle');
  out.legs.approvalsTaps1440 = await pA.evaluate(TAPS);

  // ---- runs：时间范围 chip + 清除筛选 ----
  const bagR = { badResponses: [], consoleErrors: [] };
  const pR = await ctx.newPage();
  track(pR, bagR);
  await pR.goto(`${BASE}/#/work?tab=runs`, { waitUntil: 'domcontentloaded' });
  await pR.waitForSelector('[role="group"][aria-label="读取动作"], main', { timeout: 15000 }).catch(() => {});
  await settle(pR);
  const chip30 = pR.getByRole('button', { name: '近 30 天' }).first();
  if (await chip30.count()) {
    await chip30.click(); await pR.waitForTimeout(900); await settle(pR);
    out.legs.runsAfterChipRows = await pR.locator('[data-testid^="run5-row"], tr[data-testid^="run5-row"]').count();
    await shot(pR, 'runs-range30-1440-r2b');
    const clr2 = pR.getByRole('button', { name: /清除筛选/ }).first();
    if (await clr2.count()) {
      await clr2.click(); await pR.waitForTimeout(900); await settle(pR);
      out.legs.runsAfterClear = await pR.evaluate(() => document.querySelector('[role="group"][aria-label="读取动作"]')?.closest('main')?.innerText.slice(0, 240) || '');
      await shot(pR, 'runs-filter-clear-1440-r2b');
      out.legs.clearDisabledAfterClear = await pR.getByRole('button', { name: /清除筛选/ }).first().isDisabled().catch(() => null);
    } else out.notes.push('runs: no 清除筛选 button after chip click');
  } else out.notes.push('runs: no 近 30 天 chip');
  out.legs.runsTaps1440 = await pR.evaluate(TAPS);

  // ---- 375 仅交互件精计（两页） ----
  const pS = await ctx.newPage();
  await pS.setViewportSize({ width: 375, height: 800 });
  const bagS = { badResponses: [], consoleErrors: [] };
  track(pS, bagS);
  await pS.goto(`${BASE}/#/approvals`); await settle(pS);
  out.legs.approvalsTaps375 = await pS.evaluate(TAPS);
  await pS.goto(`${BASE}/#/work?tab=runs`); await settle(pS);
  out.legs.runsTaps375 = await pS.evaluate(TAPS);
  // 375 抽屉键盘可聚焦性复测（P1-2 复验）
  out.legs.drawerFocus375 = await pS.evaluate(() => {
    const drawer = [...document.querySelectorAll('nav, aside, [class*="drawer"], [class*="sidebar"]')]
      .map((n) => ({ cls: (n.className || '').toString().slice(0, 40), hidden: n.hidden, ariaHidden: n.getAttribute('aria-hidden'), inert: n.hasAttribute('inert') && n.closest('[inert]') !== null, left: Math.round(n.getBoundingClientRect().left) }))
      .filter((x) => x.left < -1);
    return drawer;
  });
  out.entry = await pS.evaluate(() => (document.querySelector('script[src*="assets/index-"]') || {}).src || 'NONE');
  out.finishedAt = new Date().toISOString();
  out.bags = { approvals: bagA, runs: bagR, small: bagS };
  await browser.close();
  writeFileSync(path.join(OUTDIR, 'ux-capture-r2b.summary.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ notes: out.notes, hit: out.legs.hitRows, miss: out.legs.missRows, missMarker: out.legs.missEmptyMarker, cleared: out.legs.clearedRows, runsChipRows: out.legs.runsAfterChipRows, clearDisabled: out.legs.clearDisabledAfterClear, taps: [out.legs.approvalsTaps1440?.count, out.legs.runsTaps1440?.count, out.legs.approvalsTaps375?.count, out.legs.runsTaps375?.count], drawer: out.legs.drawerFocus375, bad: [...bagA.badResponses, ...bagR.badResponses, ...bagS.badResponses].map((b) => b.status + b.url.slice(-40)), errs: bagA.consoleErrors.length + bagR.consoleErrors.length + bagS.consoleErrors.length, entry: out.entry }, null, 1));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
