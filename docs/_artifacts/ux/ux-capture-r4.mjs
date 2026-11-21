// ux-capture-r4 — r4 复审腿：知识密度重评取图 + approvals P1-A2 三条销项复验（全只读，决定钮零点击）
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

const require = createRequire('/Users/kevin_studio/Projects/seakoi-console-web/package.json');
const { chromium } = require('playwright');

const BASE = 'http://100.117.184.117:8183';
const AUTH = '/Users/kevin_studio/.local/state/sekoi-ops/ui-qa-auth-state.json';
const EXEC = (() => {
  const home = process.env.HOME || '';
  const c = path.join(home, 'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  try { statSync(c); return c; } catch { return undefined; }
})();

const OUTDIR = 'docs/_artifacts/ux/r4';
const SHOTS = path.join(OUTDIR, 'shots');
mkdirSync(SHOTS, { recursive: true });
const out = { startedAt: new Date().toISOString(), notes: [], legs: {} };

async function settle(page) {
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.waitForTimeout(500);
  for (let i = 0; i < 18; i++) {
    const busy = await page.evaluate(() => !!document.querySelector('[aria-busy="true"], [class*="skeleton"]'));
    if (!busy) break;
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(300);
}

function pngH(p) { try { const b = require('node:fs').readFileSync(p); return b.readUInt32BE(20); } catch { return -1; } }

async function shotSmart(page, name, vw, vh) {
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  let h = pngH(`${SHOTS}/${name}.png`);
  if (h <= vh) {
    const docH = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
    await page.setViewportSize({ width: vw, height: Math.min(Math.max(docH + 60, vh), 9000) });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
    h = pngH(`${SHOTS}/${name}.png`);
    await page.setViewportSize({ width: vw, height: vh });
    return { file: `shots/${name}.png`, bytes: statSync(`${SHOTS}/${name}.png`).size, pngHeight: h, stretched: true };
  }
  return { file: `shots/${name}.png`, bytes: statSync(`${SHOTS}/${name}.png`).size, pngHeight: h, stretched: false };
}

const PROBES = () => {
  const t = document.body.innerText;
  const fontOf = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontSize : null; };
  const row = document.querySelector('[data-testid*="row"], main tr, [class*="knw"], [class*="kn6"]');
  return {
    hexOnScreen: (t.match(/请求编号[^\n]{0,40}[0-9a-f]{32}/gi) || []).length,
    readKou: (t.match(/读口/g) || []).length,
    mixedState: /未接入\s*或\s*没有权限/.test(t),
    rowFontPx: row ? getComputedStyle(row).fontSize : null,
    cellFontPx: (() => { const c = document.querySelector('main td, main [class*="cell"]'); return c ? getComputedStyle(c).fontSize : null; })(),
    innerTabs: [...document.querySelectorAll('[role="tab"]')].map((x) => x.textContent.trim()).filter(Boolean),
  };
};

const FOOTER = () => {
  const qa = (id) => document.querySelector(`[data-testid="${id}"]`);
  const txt = (el) => (el ? el.textContent.trim().slice(0, 80) : null);
  const count = qa('apv-page-count');
  const end = qa('apv-page-end');
  const more = qa('apv-page-more');
  const t = document.body.innerText;
  return {
    countText: txt(count),
    endPresent: !!end, endText: txt(end),
    morePresent: !!more, moreDisabled: more ? (more.disabled || more.getAttribute('aria-disabled') === 'true') : null,
    hasTotalUnavailable: t.includes('总数不可用'),
    hasEndOfList: t.includes('已到末页'),
    hasLoadMoreText: t.includes('加载更多'),
  };
};

function track(page, bag) {
  page.on('response', (res) => { if (res.status() >= 400) bag.badResponses.push({ url: res.url(), status: res.status() }); });
  page.on('console', (m) => { if (m.type() === 'error') bag.consoleErrors.push(m.text().slice(0, 140)); });
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: EXEC });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 2600 }, storageState: AUTH });
  const bag = { badResponses: [], consoleErrors: [] };

  // 入口代次
  const p0 = await ctx.newPage();
  await p0.goto(BASE + '/#/knowledge', { waitUntil: 'domcontentloaded' });
  out.entryStart = await p0.evaluate(() => (document.querySelector('script[src*="assets/index-"]') || {}).src || 'NONE');

  // ── ① 知识 1440 + 375 ──
  const pK = await ctx.newPage(); track(pK, bag);
  await pK.goto(`${BASE}/#/knowledge`, { waitUntil: 'domcontentloaded' });
  await pK.waitForSelector('main', { timeout: 15000 }).catch(() => out.notes.push('knowledge: no main'));
  out.legs.kn1440 = { probes: await pK.evaluate(PROBES), shot: await shotSmart(pK, 'knowledge-list-1440-r4', 1440, 2600) };

  await pK.setViewportSize({ width: 375, height: 800 });
  await pK.waitForTimeout(700);
  const over = await pK.evaluate(() => {
    let bad = 0; const s = [];
    document.querySelectorAll('main a, main button, main input, main select, main [role="button"]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.display === 'none') return;
      if (r.right > 376 || r.left < -1) { bad++; s.push({ t: (el.textContent || '').trim().slice(0, 14), l: Math.round(r.left), rgt: Math.round(r.right) }); }
    });
    return { overCount: bad, overSample: s.slice(0, 8) };
  });
  out.legs.kn375 = { over, shot: await shotSmart(pK, 'knowledge-list-375-r4', 375, 800) };

  // ── ② approvals 页脚状态机（pending + history）+ 时间一致性 + miss 空态 ──
  const pA = await ctx.newPage(); track(pA, bag);
  await pA.goto(`${BASE}/#/approvals`, { waitUntil: 'domcontentloaded' });
  await pA.waitForSelector('[data-testid^="apr5-row"]', { timeout: 15000 }).catch(() => out.notes.push('approvals: no rows'));
  out.legs.pendingFooter = await pA.evaluate(FOOTER);
  const row1 = pA.locator('[data-testid^="apr5-row"]').first();
  out.legs.pendingRowTime = await row1.evaluate((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200));
  await row1.click();
  await pA.waitForTimeout(900);
  out.legs.detailUrl = pA.url();
  out.legs.detailTimeText = await pA.evaluate(() => {
    const d = document.querySelector('[data-testid^="apd"], aside, [class*="detail"]');
    const t = (d || document.body).innerText;
    return t.split('\n').filter((L) => /小时前|分钟前|昨天|今天|\d{2}:\d{2}|2026-\d\d-\d\d|期限|倒计时|还剩/.test(L)).slice(0, 14);
  });
  out.legs.detailFooter = await pA.evaluate(FOOTER);
  out.legs.timeShot = await shotSmart(pA, 'approvals-time-detail-1440-r4', 1440, 2600);

  // miss 空态（筛选面板搜索不存在词；清除出口保留）
  const toggle = pA.locator('[data-testid="apv-filter-toggle"]').first();
  if (await toggle.count()) {
    await toggle.click(); await pA.waitForTimeout(500);
    const inp = pA.locator('[data-testid="apv8-search"], [data-testid="apv-filter-panel"] input, main input').first();
    if (await inp.count()) {
      await inp.click(); await inp.fill(''); await inp.pressSequentially('zzzqx-r4不存在', { delay: 12 });
      await pA.keyboard.press('Enter'); await pA.waitForTimeout(900);
      out.legs.missFooter = await pA.evaluate(FOOTER);
      out.legs.missEmptyMarker = await pA.locator('[data-testid="apv8-search-empty"]').count();
      out.legs.missRows = await pA.locator('[data-testid^="apr5-row"]').count();
      out.legs.missShot = await shotSmart(pA, 'approvals-miss-empty-1440-r4', 1440, 2600);
      const clr = pA.locator('[data-testid="apv8-search-clear"]').first();
      if (await clr.count()) { await clr.click(); await pA.waitForTimeout(400); }
    } else out.notes.push('approvals: no search input in panel');
  } else out.notes.push('approvals: no filter toggle');

  // history 页脚
  const hist = pA.locator('a:has-text("历史决策"), [role="tab"]:has-text("历史")').first();
  if (await hist.count()) {
    await hist.click(); await pA.waitForTimeout(1000); await settle(pA);
    out.legs.historyFooter = await pA.evaluate(FOOTER);
    out.legs.historyUrl = pA.url();
    out.legs.historyShot = await shotSmart(pA, 'approvals-history-footer-1440-r4', 1440, 2600);
  } else out.notes.push('approvals: no history tab link');

  out.entryAfter = await pA.evaluate(() => (document.querySelector('script[src*="assets/index-"]') || {}).src || 'NONE');
  out.bag = bag;
  out.finishedAt = new Date().toISOString();
  writeFileSync(path.join(OUTDIR, 'ux-capture-r4.summary.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
