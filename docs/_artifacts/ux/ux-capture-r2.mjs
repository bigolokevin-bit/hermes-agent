// ux-capture-r2 — approvals + runs 两页取证（1440 加高 / 375 真视口+撑开回退）
// 纪律：直连 8183 现网 DTYdDF4J 代次；375 逐元素新判据；禁 document 级 overflowX 签绿。
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const require = createRequire('/Users/kevin_studio/Projects/seakoi-console-web/package.json');
const { chromium } = require('playwright');

const BASE = 'http://100.117.184.117:8183';
const AUTH = '/Users/kevin_studio/.local/state/sekoi-ops/ui-qa-auth-state.json';
const EXE = '/Users/kevinlee/Library/Caches/ms-playwright/chromium-1255/Chromium.app/Contents/MacOS/Chromium';
const EXEC = (() => {
  try { statSync(EXE); return EXE; } catch {
    const home = process.env.HOME || '';
    const alt = path.join(home, 'Library/Caches/ms-playwright/chromium-1255/Chromium.app/Contents/MacOS/Chromium');
    try { statSync(alt); return alt; } catch { return undefined; }
  }
})();

const OUTDIR = 'docs/_artifacts/ux/r2';
const SHOTS = path.join(OUTDIR, 'shots');
mkdirSync(SHOTS, { recursive: true });

const BIG = { width: 1440, height: 2600 };
const SMALL = { width: 375, height: 800 };
const summary = { startedAt: new Date().toISOString(), base: BASE, entryBaseline: null, entryAfter: null, states: [], notes: [], tiering: null };

async function settle(page, tag) {
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await page.waitForTimeout(400);
  for (let i = 0; i < 20; i++) {
    const busy = await page.evaluate(() => !!document.querySelector('[aria-busy="true"], .skeleton, [class*="skeleton"]'));
    if (!busy) break;
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(250);
}

const PROBE = () => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || parseFloat(st.opacity) === 0) return null;
    let p = el.parentElement, inSrOnly = false;
    while (p) { if ((p.className || '').toString().includes('sr-only')) { inSrOnly = true; break; } p = p.parentElement; }
    if (inSrOnly) return null;
    if (r.bottom < 0 || r.top > vh) return null;
    return r;
  };
  const rightOut = [], leftOut = [], tap = [], overflowContainers = [];
  document.querySelectorAll('a,button,input,select,textarea,[role="button"],[role="link"],label,th,td,[role="tab"],h1,h2,h3,p,span').forEach((el) => {
    const r = vis(el);
    if (!r) return;
    if (r.right > 376 && vw <= 420) rightOut.push({ tag: el.tagName, t: (el.textContent || '').trim().slice(0, 24), right: Math.round(r.right), w: Math.round(r.width) });
    if (r.left < -1 && r.right > 1 && vw <= 420) leftOut.push({ tag: el.tagName, t: (el.textContent || '').trim().slice(0, 24), left: Math.round(r.left) });
    if (r.width < 44 || r.height < 44) { const lab = (el.getAttribute('aria-label') || el.textContent || el.placeholder || '').trim().slice(0, 20); tap.push({ tag: el.tagName, lab, w: Math.round(r.width), h: Math.round(r.height) }); }
    if (r.width >= 24) {
      const st = getComputedStyle(el);
      if (/(auto|scroll)/.test(st.overflowX) && el.scrollWidth > el.clientWidth && vw <= 420) overflowContainers.push({ cls: (el.className || '').toString().slice(0, 40), sw: el.scrollWidth, cw: el.clientWidth });
    }
  });
  const bodyText = document.body.innerText;
  const reqIds = (bodyText.match(/请求编号[：:]\s*[0-9a-fA-F-]{8,}/g) || []);
  const hexRuns = (bodyText.match(/\b[0-9a-fA-F]{24,}\b/g) || []);
  const isoTimes = (bodyText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/g) || []);
  const doc = document.documentElement;
  return {
    vw, vh, rightOutCount: rightOut.length, rightOutSample: rightOut.slice(0, 12),
    leftOutCount: leftOut.length, leftOutSample: leftOut.slice(0, 8),
    overflowContainers: overflowContainers.slice(0, 10),
    domOverflowPx: doc.scrollWidth - doc.clientWidth, // 仅辅证，永不签绿
    smallTapTargets: tap.slice(0, 40), smallTapCount: tap.length,
    requestIds: reqIds.slice(0, 5), hexRunsCount: hexRuns.length, isoTimesCount: isoTimes.length,
    emptyHits: ['暂无', '没有', '未找到', '无匹配', '无结果', '不存在'].some((w) => bodyText.includes(w)),
    errorHits: ['出错了', '加载失败', '不可达', '未接入', '重试'].some((w) => bodyText.includes(w)),
    textSample: bodyText.slice(0, 700),
  };
};

async function focusProbe(page) {
  const stops = [];
  await page.evaluate(() => document.body.focus());
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return {
        tag: el.tagName, name: (el.getAttribute('aria-label') || el.textContent || el.placeholder || '').trim().slice(0, 30),
        outline: `${st.outlineStyle} ${st.outlineWidth} ${st.outlineColor}`, shadow: st.boxShadow.slice(0, 60),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        clipped: r.right > window.innerWidth + 1 || r.left < -1 || r.bottom > window.innerHeight + 1,
      };
    });
    stops.push(info);
  }
  return stops;
}

function pngHeight(p) {
  try { const b = readFileSync(p); if (b.slice(1, 4).toString() !== 'PNG') return -1; return b.readUInt32BE(20); } catch { return -1; }
}

async function entryHash(page) {
  return page.evaluate(() => {
    const s = document.querySelector('script[src*="assets/index-"]');
    return s ? s.src : 'NONE';
  });
}

async function shot(page, name, expectScrollH) {
  await settle(page, name);
  let info = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, vh: window.innerHeight, bodyChars: document.body.innerText.length }));
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
  let h = pngHeight(`${SHOTS}/${name}.png`);
  let fallback = false;
  if (h <= info.vh + 2 && info.sh > info.vh + 40) {
    const H = Math.min(info.sh + 40, 3200);
    await page.setViewportSize({ width: page.viewportSize().width, height: H });
    await page.waitForTimeout(350);
    await settle(page, name + ':fallback');
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
    h = pngHeight(`${SHOTS}/${name}.png`);
    fallback = true;
    await page.setViewportSize({ width: page.viewportSize().width, height: SMALL.height });
  }
  return { file: `shots/${name}.png`, bytes: statSync(`${SHOTS}/${name}.png`).size, pngHeight: h, fallback, scrollH: info.sh, bodyChars: info.bodyChars };
}

function track(page, bag) {
  page.on('response', (res) => { if (res.status() >= 400) bag.badResponses.push({ url: res.url(), status: res.status() }); });
  page.on('console', (m) => { if (m.type() === 'error') bag.consoleErrors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => bag.consoleErrors.push('PAGEERROR ' + String(e).slice(0, 160)));
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: EXEC });
  const ctx = await browser.newContext({ viewport: BIG, storageState: AUTH, ignoreHTTPSErrors: true });

  // ---------- 大视口交互腿（1440×2600） ----------
  const big = { size: '1440', badResponses: [], consoleErrors: [] };
  const pB = await ctx.newPage();
  track(pB, big);
  await pB.goto(`${BASE}/#/approvals`, { waitUntil: 'domcontentloaded' });
  await pB.waitForSelector('[data-testid="apr5-list"], [data-testid="apv-page"], [data-testid="apv8-search-empty"]', { timeout: 15000 }).catch(() => summary.notes.push('approvals: no list/skeleton marker'));
  summary.entryBaseline = await entryHash(pB);
  await shot(pB, 'approvals-list-1440-r2');

  // needle：首行文本
  const rowText = await pB.evaluate(() => {
    const row = document.querySelector('[data-testid^="apr5-row-"]');
    return row ? (row.textContent || '').trim().slice(0, 40) : null;
  });
  summary.rowText = rowText;
  const needle = rowText ? rowText.slice(0, 8) : 'ap_';
  const miss = 'zzzqx-不存在的关键词';

  const doSearch = async (text) => {
    const inp = pB.locator('[data-testid="apv8-search"], main input[type="search"], main input[placeholder*="搜索"]').first();
    if (!(await inp.count())) { summary.notes.push('approvals: no search input'); return false; }
    await inp.click();
    await inp.fill('');
    await inp.pressSequentially(text, { delay: 15 });
    await pB.keyboard.press('Enter');
    await pB.waitForTimeout(600);
    await settle(pB, 'search');
    return true;
  };
  if (await doSearch(needle)) await shot(pB, 'approvals-search-hit-1440-r2');
  const clearBtn = pB.locator('[data-testid="apv8-search-clear"]');
  if (await clearBtn.count()) { await clearBtn.first().click().catch(() => {}); await pB.waitForTimeout(300); }
  if (await doSearch(miss)) await shot(pB, 'approvals-search-miss-1440-r2');
  if (await clearBtn.count()) { await clearBtn.first().click().catch(() => {}); await pB.waitForTimeout(400); await settle(pB, 'cleared'); }

  // 行详情
  const firstRow = pB.locator('[data-testid^="apr5-row-"]').first();
  if (await firstRow.count()) {
    await firstRow.click();
    await pB.waitForTimeout(800);
    await settle(pB, 'detail');
    summary.detailUrl = pB.url();
    await shot(pB, 'approvals-row-detail-1440-r2');
    const back = pB.locator('[data-testid="apd7-back"]');
    if (await back.count()) { await back.first().click().catch(() => {}); await pB.waitForTimeout(500); }
  } else summary.notes.push('approvals: no rows for detail click');

  // runs 列表
  await pB.goto(`${BASE}/#/work?tab=runs`, { waitUntil: 'domcontentloaded' });
  await pB.waitForSelector('[data-testid*="run"], [data-testid="run5-breadcrumb"], main', { timeout: 15000 }).catch(() => {});
  await settle(pB, 'runs');
  summary.runsUrl = pB.url();
  await shot(pB, 'runs-list-1440-r2');

  // 分层验收 DOM 探针（④：9282bc85）
  summary.tiering = await pB.evaluate(() => {
    const groups = [...document.querySelectorAll('[role="group"][aria-label]')].map((g) => ({
      label: g.getAttribute('aria-label'),
      buttons: [...g.querySelectorAll('button,[role="button"]')].map((b) => ({ t: (b.textContent || '').trim().slice(0, 16), cls: (b.className || '').toString().slice(0, 60) })),
    }));
    const solidBtns = [...document.querySelectorAll('main button')].filter((b) => /solid/.test((b.className || '').toString())).map((b) => (b.textContent || '').trim().slice(0, 12));
    const groupsAt1440 = [...document.querySelectorAll('[role="group"][aria-label="列表操作"], [role="group"][aria-label="读取动作"]')].length;
    return { present: groupsAt1440, groups, solidButtons: solidBtns.slice(0, 10), solidCount1440: solidBtns.length };
  });

  // runs 筛选交互：点首枚筛选 chip，再清除
  const chip = pB.locator('[data-testid="run5-filter-status-pending"], [data-testid="run-filter-chips"] button, [data-testid="run5-filter-chip"]').first();
  if (await chip.count()) {
    await chip.click().catch(() => {});
    await pB.waitForTimeout(700);
    await settle(pB, 'runs-filter');
    await shot(pB, 'runs-filter-hit-1440-r2');
    const clr = pB.getByRole('button', { name: /清除筛选/ }).first();
    if (await clr.count()) { await clr.click().catch(() => {}); await pB.waitForTimeout(600); await settle(pB, 'runs-clear'); await shot(pB, 'runs-filter-clear-1440-r2'); }
  } else summary.notes.push('runs: no filter chip found for hit/clear legs');

  // runs 行打开（任务路径可达性）
  const openLink = pB.getByRole('link', { name: /查看.*详情|详情与事件/ }).first();
  const openBtn = pB.locator('[data-testid^="run5-row"]').first();
  const target = (await openLink.count()) ? openLink : (await openBtn.count() ? openBtn : null);
  if (target) {
    await target.click();
    await pB.waitForTimeout(900);
    await settle(pB, 'run-detail');
    summary.runDetailUrl = pB.url();
    await shot(pB, 'runs-row-open-1440-r2');
  } else summary.notes.push('runs: no row/detail action to click (possibly filtered-empty)');

  big.probe = await pB.evaluate(PROBE); // 末态留档（runs 详情）
  await pB.goto(`${BASE}/#/work?tab=runs`); await settle(pB, 're'); big.runsProbe = await pB.evaluate(PROBE);
  await pB.goto(`${BASE}/#/approvals`); await settle(pB, 're'); big.approvalsProbe = await pB.evaluate(PROBE);
  big.focus = await focusProbe(pB);

  // ---------- 小视口独立过（375×800 真视口，不并发） ----------
  const small = { size: '375', badResponses: [], consoleErrors: [] };
  const pS = await ctx.newPage();
  await pS.setViewportSize(SMALL);
  track(pS, small);
  await pS.goto(`${BASE}/#/approvals`, { waitUntil: 'domcontentloaded' });
  await pS.waitForSelector('[data-testid="apr5-list"], [data-testid="apv-page"], main', { timeout: 15000 }).catch(() => {});
  await settle(pS, 'small-approvals');
  small.approvalsShot = await shot(pS, 'approvals-list-375-r2');
  small.approvalsProbe = await pS.evaluate(PROBE);
  await pS.goto(`${BASE}/#/work?tab=runs`);
  await pS.waitForSelector('main', { timeout: 15000 }).catch(() => {});
  await settle(pS, 'small-runs');
  small.runsShot = await shot(pS, 'runs-list-375-r2');
  small.runsProbe = await pS.evaluate(PROBE);
  small.tiering375 = await pS.evaluate(() => {
    const out = [];
    for (const g of document.querySelectorAll('[role="group"][aria-label="列表操作"],[role="group"][aria-label="读取动作"]')) {
      for (const b of g.querySelectorAll('button,[role="button"]')) {
        const r = b.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        out.push({ group: g.getAttribute('aria-label'), t: (b.textContent || '').trim().slice(0, 14), right: Math.round(r.right), left: Math.round(r.left), clipped: r.right > 376 });
      }
    }
    return out;
  });
  small.focus = await focusProbe(pS);
  summary.entryAfter = await entryHash(pS);
  summary.finishedAt = new Date().toISOString();

  await browser.close();
  const out = { ...summary, big, small };
  writeFileSync(path.join(OUTDIR, 'ux-capture-r2.summary.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({
    entry: [summary.entryBaseline, summary.entryAfter],
    tiering: summary.tiering?.present, tier375Clipped: small.tiering375.filter((x) => x.clipped).length,
    approvals375RightOut: small.approvalsProbe.rightOutCount, runs375RightOut: small.runsProbe.rightOutCount,
    bad: big.badResponses.map((b) => b.status + ' ' + b.url.slice(-56)).concat(small.badResponses.map((b) => b.status + ' ' + b.url.slice(-56))),
    errs: big.consoleErrors.length + small.consoleErrors.length,
    notes: summary.notes,
  }, null, 1));
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
