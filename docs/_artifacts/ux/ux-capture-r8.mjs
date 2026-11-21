// ux-capture-r8 — H3 内容侧终判：chunk 已证，此处 DOM+读图双轨（collapsedHex / 375 labelCount / 旧同名标签 / 面题 / 冷链高亮）
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
  ];
  const { statSync: ss } = require('node:fs');
  for (const c of cands) { try { ss(c); return c; } catch {} }
  return undefined;
})();

const OUTDIR = 'docs/_artifacts/ux/r8';
const SHOTS = path.join(OUTDIR, 'shots');
mkdirSync(SHOTS, { recursive: true });
const out = { startedAt: new Date().toISOString(), notes: [], legs: {}, entry: {} };

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
function shot(page, name) { return (async () => { await settle(page); await page.screenshot({ path: `${SHOTS}/${name}.png` }); return { file: `shots/${name}.png`, bytes: statSync(`${SHOTS}/${name}.png`).size }; })(); }
function track(page, bag) {
  page.on('response', (r) => { if (r.status() >= 400) bag.badResponses.push({ url: r.url(), status: r.status() }); });
  page.on('console', (m) => { if (m.type() === 'error') bag.consoleErrors.push(m.text().slice(0, 140)); });
}
const bag = { badResponses: [], consoleErrors: [] };

// 收起态裸 hex 计数（负标记）+ 面题列表 + 内层标签 + req-toggle
const KNW = () => {
  const main = document.querySelector('main') || document.body;
  const txt = main.innerText || '';
  const hex = (txt.match(/\b[0-9a-f]{32}\b/gi) || []);
  const faces = [...main.querySelectorAll('.knw5-surface-title')].map((h) => h.textContent.trim());
  const togg = [...main.querySelectorAll('[data-testid*="req-toggle"], .knw5-req-toggle, button')].filter((b) => /请求编号|request/i.test(b.textContent || '') || /req/.test(b.getAttribute('data-testid') || ''));
  const tabs = [...main.querySelectorAll('[role="tab"]')].map((t) => ({ t: t.textContent.trim(), sel: t.getAttribute('aria-selected') }));
  const oldDup = tabs.filter((x) => x.t === '证据与引用' || x.t === '数据源').length;
  return { collapsedHex: hex.length, hexSample: hex.slice(0, 2), faces, reqToggleCount: togg.length, tabs, oldDup, head: (main.querySelector('h1,h2') || {}).textContent || '' };
};
// 375 runs 卡片 label 可见性
const RUNS375 = () => {
  const main = document.querySelector('main') || document.body;
  const labels = [...main.querySelectorAll('.ui-c-field-label')];
  const vis = labels.filter((l) => { const r = l.getBoundingClientRect(); const st = getComputedStyle(l); return r.width > 1 && r.height > 1 && st.display !== 'none' && st.visibility !== 'hidden'; });
  const over = [...main.querySelectorAll('a,button,select,input,[role="button"],[role="tab"]')].filter((el) => { const r = el.getBoundingClientRect(); return (r.right > 376 || r.left < -1) && r.width > 1 && el.closest('[class*="drawer"],[class*="sidebar"],nav') === null; }).length;
  return { labelCount: labels.length, visibleLabels: vis.length, visSample: vis.slice(0, 6).map((l) => l.textContent.trim()), over };
};

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: EXEC });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 2600 }, storageState: AUTH });
  const p = await ctx.newPage(); track(p, bag);

  await p.goto(`${BASE}/#/knowledge`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('main', { timeout: 15000 });
  out.entry.before = await p.evaluate(() => (document.querySelector('script[src*="assets/index-"]') || {}).src || 'NONE');
  out.legs.knw1440 = await p.evaluate(KNW);
  out.legs.knwShot1440 = await shot(p, 'knw1440-h3-r8');
  // req-toggle 展开一张（若存在）
  const tg = p.locator('button:has-text("请求编号"), [data-testid*="req-toggle"]').first();
  if (await tg.count()) { await tg.click(); await p.waitForTimeout(400); out.legs.reqAfterExpandHex = (await p.evaluate(KNW)).collapsedHex; await shot(p, 'knw1440-reqopen-r8'); } else out.notes.push('no req-toggle button found');

  // 375：knowledge + runs
  await p.setViewportSize({ width: 375, height: 800 });
  await p.goto(`${BASE}/#/knowledge`); await settle(p);
  out.legs.knw375 = await p.evaluate(KNW);
  await shot(p, 'knw375-h3-r8');
  await p.goto(`${BASE}/#/work?tab=runs`); await settle(p);
  out.legs.runs375 = await p.evaluate(RUNS375);
  await shot(p, 'runs375-h3-r8');

  // 冷链高亮（判词①验收钩）：tab=sources / ingest / evidence
  out.legs.deeplinks = {};
  await p.setViewportSize({ width: 1440, height: 2600 });
  for (const tab of ['sources', 'ingest', 'evidence']) {
    await p.goto(`${BASE}/#/knowledge?tab=${tab}`); await settle(p);
    out.legs.deeplinks[tab] = await p.evaluate(() => {
      const outer = [...document.querySelectorAll('a[role="tab"],button[role="tab"],[role="tab"]')].map((t) => ({ t: t.textContent.trim(), sel: t.getAttribute('aria-selected') })).filter((x) => x.sel === 'true');
      const heads = [...document.querySelectorAll('main h1, main h2')].map((h) => h.textContent.trim()).slice(0, 3);
      return { outerSelected: outer.map((x) => x.t), heads };
    });
  }
  out.entry.after = await p.evaluate(() => (document.querySelector('script[src*="assets/index-"]') || {}).src || 'NONE');
  out.finishedAt = new Date().toISOString();
  out.bag = bag;
  await browser.close();
  writeFileSync(path.join(OUTDIR, 'ux-capture-r8.summary.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
