// ux-capture-r3 — 销项复审取证：审批只读门复验 + 知识两页密度重评(fullPage) + 冷深链 + 证据页登录态 + 幽灵抽屉探针
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

const OUTDIR = 'docs/_artifacts/ux/r3';
const SHOTS = path.join(OUTDIR, 'shots');
mkdirSync(SHOTS, { recursive: true });
const out = { startedAt: new Date().toISOString(), notes: [], legs: {}, bags: {} };

const entryOf = (page) => page.evaluate(() => (document.querySelector('script[src*="assets/index-"]') || {}).src || 'NONE');
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
async function shot(page, name) {
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  let bytes = statSync(`${SHOTS}/${name}.png`).size;
  const vp = page.viewportSize() || { height: 0 };
  // fullPage 对内部滚动壳是 no-op：读 PNG 实际高度，若 ≤ 视口高则撑开重拍
  const sizeOf = () => { const b = require('fs').readFileSync(`${SHOTS}/${name}.png`); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
  let h0 = 0; try { h0 = sizeOf().h; } catch {}
  let stretched = false;
  if (h0 <= vp.height) {
    const ch = await page.evaluate(() => { const m = document.querySelector('main') || document.body; const shell = [...document.querySelectorAll('div')].reduce((a, d) => Math.max(a, d.scrollHeight), 0); return Math.min(9000, Math.max(m.scrollHeight, shell)); });
    await page.setViewportSize({ width: vp.width, height: Math.max(900, ch + 40) });
    await page.waitForTimeout(600);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
    bytes = statSync(`${SHOTS}/${name}.png`).size;
    stretched = true;
  }
  let hFinal = 0; try { hFinal = sizeOf().h; } catch {}
  return { file: `shots/${name}.png`, bytes, pngH: hFinal, stretched, tallEnough: hFinal > (vp.height || 0) };
}
const TAPS = () => {
  const bad = [];
  document.querySelectorAll('main a, main button, main select, main input, main [role="button"], main [role="tab"], main [role="link"]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none') return;
    if (r.width < 44 || r.height < 44) bad.push({ tag: el.tagName, t: (el.getAttribute('aria-label') || el.textContent || el.placeholder || '').trim().slice(0, 16), w: Math.round(r.width), h: Math.round(r.height) });
  });
  return { count: bad.length, sample: bad.slice(0, 12) };
};
function track(tag, page) {
  const bag = { badResponses: [], consoleErrors: [] };
  out.bags[tag] = bag;
  page.on('response', (res) => { if (res.status() >= 400) bag.badResponses.push({ url: res.url(), status: res.status() }); });
  page.on('console', (m) => { if (m.type() === 'error') bag.consoleErrors.push(m.text().slice(0, 140)); });
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: EXEC });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 2600 }, storageState: AUTH });
  const p1 = await ctx.newPage(); track('approvals', p1);
  await p1.goto(`${BASE}/#/approvals`, { waitUntil: 'domcontentloaded' });
  await p1.waitForSelector('[data-testid^="apr5-row-"], [data-testid="apv-page"]', { timeout: 15000 }).catch(() => out.notes.push('approvals rows absent'));
  out.entryStart = await entryOf(p1);

  // A. 只读门断言（不点击任何决定钮）
  out.legs.gate1440 = await p1.evaluate(() => {
    const note = document.querySelector('[data-testid="apr5-actions-readonly-note"]');
    const btns = [...document.querySelectorAll('main button')].filter((b) => /^(批准|驳回)$/.test((b.textContent || '').trim()));
    const firstRow = document.querySelector('[data-testid^="apr5-row-"]');
    if (firstRow) firstRow.scrollIntoView({ block: 'center' });
    return {
      readonlyNotePresent: !!note,
      readonlyNoteText: (note?.textContent || '').slice(0, 120),
      decisionBtns: btns.slice(0, 6).map((b) => ({ t: b.textContent.trim(), disabled: b.disabled, ariaDisabled: b.getAttribute('aria-disabled'), title: (b.getAttribute('title') || '').slice(0, 60) })),
      decisionBtnCount: btns.length,
    };
  });
  await p1.waitForTimeout(300);
  out.legs.gate1440.shot = await shot(p1, 'approvals-gate-1440-r3');

  // C/D. 知识两页（密度重评）1440 高视口 + 375
  const p2 = await ctx.newPage(); track('knowledge', p2);
  await p2.goto(`${BASE}/#/knowledge`, { waitUntil: 'domcontentloaded' });
  await p2.waitForSelector('main', { timeout: 15000 });
  out.legs.kn1440 = { taps: await p2.evaluate(TAPS), text: await p2.evaluate(() => document.querySelector('main')?.innerText.slice(0, 1800)), probes: await p2.evaluate(() => ({
    hexOnScreen: (document.querySelector('main')?.innerText.match(/请求编号[:：]?\s*[0-9a-f-]{16,}/g) || []).length,
    readKou: (document.querySelector('main')?.innerText.match(/读口/g) || []).length,
    mixedState: /未接入.{0,6}或.{0,6}没有权限/.test(document.querySelector('main')?.innerText || ''),
    innerTabs: [...document.querySelectorAll('[data-testid^="knw5-tab-"], main [role="tab"]')].map((t) => (t.textContent || '').trim()).slice(0, 10),
    rowFontPx: (() => { const el = document.querySelector('[class*="knw5"] [class*="row"], main table td, main [data-testid*="row"]'); return el ? getComputedStyle(el).fontSize : null; })(),
  })) };
  out.legs.kn1440.shot = await shot(p2, 'knowledge-list-1440-r3');

  const p3 = await ctx.newPage();
  await p3.setViewportSize({ width: 375, height: 800 }); track('kn375', p3);
  await p3.goto(`${BASE}/#/knowledge`);
  out.legs.kn375 = { taps: await p3.evaluate(TAPS), over: await p3.evaluate(() => { let n = 0, sample = []; document.querySelectorAll('main *').forEach((el) => { const r = el.getBoundingClientRect(); if (r.width < 1) return; const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.display === 'none') return; if (r.right > 376 && r.left >= -1) { n++; if (sample.length < 6) sample.push({ tag: el.tagName, t: (el.textContent || '').trim().slice(0, 14), right: Math.round(r.right) }); } }); return { rightOut: n, sample }; }) };
  out.legs.kn375.shot = await shot(p3, 'knowledge-list-375-r3');
  // G. 幽灵抽屉探针（375，知识页壳）
  out.legs.drawer375 = await p3.evaluate(() => [...document.querySelectorAll('nav, aside, [class*="drawer"], [class*="sidebar"]')].map((n) => ({ left: Math.round(n.getBoundingClientRect().left), ariaHidden: n.getAttribute('aria-hidden'), inert: !!n.closest('[inert]'), cls: (n.className || '').toString().slice(0, 30) })).filter((x) => x.left < -1));
  await p3.close();

  // E. 冷深链证据页
  const p4 = await ctx.newPage(); track('deeplink', p4);
  await p4.goto(`${BASE}/#/knowledge?tab=evidence`, { waitUntil: 'domcontentloaded' });
  await p4.waitForTimeout(1200);
  out.legs.deeplink = { finalUrl: p4.url(), head: await p4.evaluate(() => document.querySelector('main')?.innerText.slice(0, 400)) };
  out.legs.deeplink.shot = await shot(p4, 'knowledge-deeplink-1440-r3');

  // F. 点击进入证据页（r1 P0-1 登录矛盾复验）
  const ev = p4.locator('a:has-text("证据与引用"), [role="tab"]:has-text("证据与引用")').first();
  if (await ev.count()) {
    await ev.click(); await p4.waitForTimeout(1200);
    out.legs.evidenceClick = { finalUrl: p4.url(), text: await p4.evaluate(() => document.querySelector('main')?.innerText.slice(0, 700)) };
    out.legs.evidenceClick.loginContradiction = /需要登录/.test(out.legs.evidenceClick.text || '');
    out.legs.evidenceClick.shot = await shot(p4, 'evidence-click-1440-r3');
  } else out.notes.push('no evidence outer tab');

  // B. 审批 375 门复验
  const p5 = await ctx.newPage();
  await p5.setViewportSize({ width: 375, height: 800 }); track('appr375', p5);
  await p5.goto(`${BASE}/#/approvals`);
  out.legs.gate375 = await p5.evaluate(() => {
    const btns = [...document.querySelectorAll('main button')].filter((b) => /^(批准|驳回)$/.test((b.textContent || '').trim()));
    return { note: !!document.querySelector('[data-testid="apr5-actions-readonly-note"]'), btnCount: btns.length, allDisabled: btns.length > 0 && btns.every((b) => b.disabled), sample: btns.slice(0, 4).map((b) => ({ t: b.textContent.trim(), disabled: b.disabled, aria: b.getAttribute('aria-disabled') })) };
  });
  out.legs.gate375.shot = await shot(p5, 'approvals-gate-375-r3');
  await p5.close();

  out.entryEnd = await entryOf(p4);
  out.finishedAt = new Date().toISOString();
  await browser.close();
  writeFileSync(path.join(OUTDIR, 'ux-capture-r3.summary.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ entry: [out.entryStart, out.entryEnd], gate1440: out.legs.gate1440 && { note: out.legs.gate1440.readonlyNotePresent, btns: out.legs.gate1440.decisionBtnCount, disabledSample: out.legs.gate1440.decisionBtns.map((b) => b.disabled + '/' + b.ariaDisabled) }, gate375: out.legs.gate375, knProbes: out.legs.kn1440.probes, knTaps: [out.legs.kn1440.taps.count, out.legs.kn375.taps.count], kn375over: out.legs.kn375.over.rightOut, drawer: out.legs.drawer375, deeplinkUrl: out.legs.deeplink.finalUrl, loginContra: out.legs.evidenceClick && out.legs.evidenceClick.loginContradiction, bad: Object.values(out.bags).flatMap((b) => b.badResponses.map((x) => x.status + x.url.slice(-46))), errs: Object.values(out.bags).reduce((s, b) => s + b.consoleErrors.length, 0), notes: out.notes }, null, 1));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
