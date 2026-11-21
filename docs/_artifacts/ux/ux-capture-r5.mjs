// ux-capture-r5 — r5 复审三腿：①knowledge 第四改上屏 ②approvals history 页尾同构 ③runs 375 卡片字段名/口径
// 纪律：读图为准、DOM 辅证；375 逐元素新判据（right<=376 && left>=-1，完全出画 left 除外）；禁写码、决定钮零点击。
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
  for (const c of cands) { try { statSync(c); return c; } catch {} }
  return undefined;
})();

const OUTDIR = 'docs/_artifacts/ux/r5';
const SHOTS = path.join(OUTDIR, 'shots');
mkdirSync(SHOTS, { recursive: true });
const out = { startedAt: new Date().toISOString(), notes: [], shots: [] };

async function entryHash() {
  const res = await fetch(`${BASE}/`, { headers: { cookie: await cookieHeader() } });
  const html = await res.text();
  return (html.match(/assets\/index-[^"]+\.js/) || ['NONE'])[0];
}
let COOKIES = null;
async function cookieHeader() {
  if (!COOKIES) {
    const st = JSON.parse(require('node:fs').readFileSync(AUTH, 'utf8'));
    COOKIES = st.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }
  return COOKIES;
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {});
  await page.waitForTimeout(400);
  for (let i = 0; i < 15; i++) {
    const busy = await page.evaluate(() => !!document.querySelector('[aria-busy="true"], [class*="skeleton"]'));
    if (!busy) break;
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(250);
}

async function shot(page, name) {
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }).catch(async () => {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
    out.notes.push(`${name}: fullPage failed, viewport shot`);
  });
  const pngH = (() => { const b = require('node:fs').readFileSync(`${SHOTS}/${name}.png`); return b.readUInt32BE(20); })();
  out.shots.push({ name, bytes: statSync(`${SHOTS}/${name}.png`).size, pngH });
  return { pngH };
}

function track(page, bag) {
  bag.badResponses = []; bag.consoleErrors = [];
  page.on('response', (r) => { if (r.status() >= 400) bag.badResponses.push({ url: r.url(), status: r.status() }); });
  page.on('console', (m) => { if (m.type() === 'error') bag.consoleErrors.push(m.text().slice(0, 140)); });
}

const OVERSCAN = (LIM) => {
  const over = [];
  let leftOut = 0;
  document.querySelectorAll('main a, main button, main input, main select, main [role="button"], main [role="tab"], main [role="link"], main h1, main h2, main h3, main th, main td, main p, main span[data-kn-face], main [class*="num"]').forEach((el) => {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if (r.width < 1 || r.height < 1 || st.visibility === 'hidden' || st.display === 'none') return;
    if (r.left >= -1 ? r.right > LIM + 1 : r.right > 1) { if (r.left < -1 && r.right <= 1) { leftOut++; return; } over.push({ t: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 22), right: Math.round(r.right), left: Math.round(r.left) }); }
  });
  return { overCount: over.length, overSamples: over.slice(0, 12), leftOut };
};

async function main() {
  out.entryBaseline = await entryHash();
  const browser = await chromium.launch({ headless: true, executablePath: EXEC });

  // ================= 腿① knowledge 第四改 =================
  const ctxB = { viewport: { width: 1440, height: 2600 }, storageState: AUTH };
  const ctx = await browser.newContext(ctxB);
  const bags = { knowledge: {}, approvals: {}, runs: {} };
  const pK = await ctx.newPage(); track(pK, bags.knowledge);
  await pK.goto(`${BASE}/#/knowledge`, { waitUntil: 'domcontentloaded' });
  await pK.waitForSelector('main', { timeout: 20000 }).catch(() => out.notes.push('knowledge: no main'));
  await settle(pK);

  const KN = await pK.evaluate(() => {
    const faces = [...document.querySelectorAll('main [data-kn-face]')].map((e) => e.getAttribute('data-kn-face'));
    const surfaceHeads = [...document.querySelectorAll('main h3.knw5-surface-title')].map((h) => ({ face: h.getAttribute('data-kn-face') || h.closest('[data-kn-face]')?.getAttribute('data-kn-face'), text: h.textContent.trim().slice(0, 24) }));
    const bodyText = document.querySelector('main')?.innerText || '';
    const hex = (bodyText.match(/[0-9a-f]{32}/g) || []).length;
    const reqTgl = [...document.querySelectorAll('[data-testid="knw5-req-toggle"], .knw5-req-toggle')].map((b) => ({ txt: b.textContent.trim().slice(0, 20), aria: b.getAttribute('aria-expanded') }));
    const fresh = [...document.querySelectorAll('[class*="knM-source-note"], [data-testid="knM-source-note"], [class*="knM-source-summary"], [data-testid="knM-source-summary"]')].map((n) => n.textContent.trim().slice(0, 80));
    const tabs = [...document.querySelectorAll('main [role="tab"], main [data-testid^="knw5-tab"]')].map((t) => { const r = t.getBoundingClientRect(); return { txt: t.textContent.trim().slice(0, 12), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
    return { faces, surfaceHeads, collapsedHex: hex, reqToggle: reqTgl, freshSample: fresh, freshLineCount: fresh.length, tabs1440: tabs };
  });

  await shot(pK, 'knowledge-collapsed-1440-r5');
  // 展开请求编号（只读 toggle，非决定钮）
  let expanded = {};
  const tgl = pK.locator('[data-testid="knw5-req-toggle"], .knw5-req-toggle').first();
  if (await tgl.count()) {
    await tgl.click(); await pK.waitForTimeout(500);
    expanded = await pK.evaluate(() => {
      const bodyText = document.querySelector('main')?.innerText || '';
      return {
        expandedHex: (bodyText.match(/[0-9a-f]{32}/g) || []).length,
        rawAfterClick: !!document.querySelector('[data-testid="request-id-raw"]'),
        reqValueText: (document.querySelector('[data-testid="knw5-req-value"], .knw5-req-value')?.textContent || '').trim().slice(0, 60),
      };
    });
    await shot(pK, 'knowledge-req-expanded-1440-r5');
  } else out.notes.push('knowledge: no req toggle found');
  const kOver1440 = await pK.evaluate(OVERSCAN, 1400);

  // 375 档 knowledge
  await pK.setViewportSize({ width: 375, height: 800 });
  await pK.reload({ waitUntil: 'domcontentloaded' }); await settle(pK);
  const kOver375 = await pK.evaluate(OVERSCAN, 375);
  const tabRows375 = await pK.evaluate(() => {
    const ys = [...document.querySelectorAll('main [role="tab"], main [data-testid^="knw5-tab"]')].map((t) => Math.round(t.getBoundingClientRect().y));
    return { tabCount: ys.length, distinctRows: [...new Set(ys)].length };
  });
  await shot(pK, 'knowledge-list-375-r5');
  out.kn1440 = { ...KN, ...expanded, over1440: kOver1440 };
  out.kn375 = { overCount: kOver375.overCount, overSamples: kOver375.overSamples, leftOut: kOver375.leftOut, tabRows: tabRows375 };

  // ================= 腿② approvals history 页尾同构 =================
  const pA = await ctx.newPage(); track(pA, bags.approvals);
  await pA.goto(`${BASE}/#/approvals`, { waitUntil: 'domcontentloaded' });
  await pA.waitForSelector('main', { timeout: 20000 });
  await settle(pA);
  const hist = pA.locator('a:has-text("历史决策"), [role="tab"]:has-text("历史"), button:has-text("历史决策")').first();
  if (await hist.count()) { await hist.click(); await pA.waitForTimeout(900); await settle(pA); }
  else out.notes.push('approvals: no history tab link');
  // 滚到底（内层滚动壳 + window 双保险）
  await pA.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    document.querySelectorAll('main *, [class*="overflow-y-auto"]').forEach((el) => { try { el.scrollTop = el.scrollHeight; } catch {} });
  });
  await pA.waitForTimeout(600);
  const histLeg = await pA.evaluate(() => {
    const main = document.querySelector('main');
    const txt = main?.innerText || '';
    const lines = txt.split('\n').map((l) => l.trim()).filter(Boolean);
    const tail = lines.slice(-18);
    const footerMatch = tail.filter((l) => /共\s*\d+\s*条|已到末页|已显示\s*\d+\s*条|没有更多|更多结果/.test(l));
    const moreBtn = [...main.querySelectorAll('button')].filter((b) => /加载更多|更多/.test(b.textContent || ''));
    return {
      url: location.hash,
      footerText: footerMatch,
      tailLines: tail,
      hasMore: moreBtn.length > 0,
      moreDisabled: moreBtn.map((b) => b.disabled),
      rows: main.querySelectorAll('[data-testid^="apr5-row"]').length,
    };
  });
  const histOver = await pA.evaluate(OVERSCAN, 1400);
  await shot(pA, 'approvals-history-foot-1440-r5');
  out.hist = { ...histLeg, over1440: histOver };

  // ================= 腿③ runs 375 卡片字段名 + 口径 =================
  const pR = await ctx.newPage(); track(pR, bags.runs);
  await pR.setViewportSize({ width: 375, height: 800 });
  await pR.goto(`${BASE}/#/work?tab=runs`, { waitUntil: 'domcontentloaded' });
  await pR.waitForSelector('main', { timeout: 20000 });
  await settle(pR);
  await pR.evaluate(() => { window.scrollTo(0, Math.min(document.body.scrollHeight, 1200)); document.querySelectorAll('[class*="overflow-y-auto"]').forEach((el) => { try { el.scrollTop = 600; } catch {} }); });
  await pR.waitForTimeout(400);
  const r375 = await pR.evaluate(() => {
    const labels = [...document.querySelectorAll('main .ui-c-field-label, main [class*="ui-c-field-label"]')].map((l) => {
      const st = getComputedStyle(l);
      const r = l.getBoundingClientRect();
      return { txt: l.textContent.trim().slice(0, 14), display: st.display, vis: r.width > 0 && r.height > 0 };
    });
    const cal = (document.querySelector('main')?.innerText.match(/.{0,30}(计价|口径|金额按未知).{0,40}/g) || []).slice(0, 5);
    const over = [];
    document.querySelectorAll('main a, main button, main input, main [role="button"], main [role="tab"], main span, main p, main th, main td').forEach((el) => {
      const r = el.getBoundingClientRect(); const st = getComputedStyle(el);
      if (r.width < 1 || r.height < 1 || st.visibility === 'hidden' || st.display === 'none') return;
      if (r.left >= -1 && r.right > 376) over.push({ t: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 22), right: Math.round(r.right) });
    });
    return { labelCount: labels.length, visibleLabels: labels.filter((l) => l.display !== 'none' && l.vis).length, labelSample: labels.slice(0, 6), caliber375: cal, overCount375: over.length, overSamples375: over.slice(0, 10) };
  });
  await shot(pR, 'runs-cards-375-r5');
  out.runs375 = r375;

  // 1440 档 runs（表头列名 + 卡 label 隐藏）
  await pR.setViewportSize({ width: 1440, height: 2600 });
  await pR.reload({ waitUntil: 'domcontentloaded' }); await settle(pR);
  out.runs1440 = await pR.evaluate(() => {
    const th = [...document.querySelectorAll('main th')].map((t) => t.textContent.trim().slice(0, 14));
    const labels = [...document.querySelectorAll('main .ui-c-field-label')].map((l) => ({ txt: l.textContent.trim().slice(0, 12), display: getComputedStyle(l).display }));
    return { th, labelCount: labels.length, labelHidden: labels.filter((l) => l.display === 'none').length, labelSample: labels.slice(0, 4) };
  });
  await shot(pR, 'runs-list-1440-r5');

  out.entryAfter = await entryHash();
  out.finishedAt = new Date().toISOString();
  out.bags = bags;
  writeFileSync(path.join(OUTDIR, 'ux-capture-r5.summary.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({
    entry: [out.entryBaseline, out.entryAfter],
    faces: out.kn1440.surfaceHeads.map((h) => h.text),
    collapsedHex: out.kn1440.collapsedHex, expandedHex: out.kn1440.expandedHex, rawAfterClick: out.kn1440.rawAfterClick,
    reqToggle: out.kn1440.reqToggle.slice(0, 3), freshCount: out.kn1440.freshLineCount, freshSample: (out.kn1440.freshSample || []).slice(0, 2),
    tabs1440: out.kn1440.tabs1440.length, kOver1440: out.kn1440.over1440.overCount,
    k375: out.kn375, hist: { url: out.hist.url, rows: out.hist.rows, footer: out.hist.footerText, hasMore: out.hist.hasMore, moreDisabled: out.hist.moreDisabled, tail: out.hist.tailLines.slice(-6) },
    r375: { labels: out.runs375.labelCount, vis: out.runs375.visibleLabels, caliber: out.runs375.caliber375, over: out.runs375.overCount375, samples: out.runs375.overSamples375.slice(0, 4) },
    r1440: { th: out.runs1440.th.slice(0, 8), labelHidden: out.runs1440.labelHidden, of: out.runs1440.labelCount },
    bad: Object.values(bags).flatMap((b) => b.badResponses.map((x) => x.status + ':' + x.url.slice(-28))),
    errs: Object.values(bags).reduce((s, b) => s + b.consoleErrors.length, 0),
    notes: out.notes, shots: out.shots,
  }, null, 1));
  await browser.close();
}
main().catch((e) => { console.error('FATAL', e); try { writeFileSync(path.join(OUTDIR, 'ux-capture-r5.summary.json'), JSON.stringify({ fatal: String(e), notes: out.notes }, null, 1)); } catch {} process.exit(1); });
