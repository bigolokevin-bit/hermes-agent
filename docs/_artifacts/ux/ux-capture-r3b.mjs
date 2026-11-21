// ux-capture-r3b — r3 补腿：审批详情面板只读门断言（禁点决定钮）+ 知识 375 触点精计复测
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
  for (const c of cands) { try { statSync(c); return c; } catch {} }
  return undefined;
})();

const OUTDIR = 'docs/_artifacts/ux/r3';
const SHOTS = path.join(OUTDIR, 'shots');
mkdirSync(SHOTS, { recursive: true });
const out = { startedAt: new Date().toISOString(), notes: [], legs: {}, badResponses: [], consoleErrors: [] };

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
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
  let pngH = (await import('node:fs')).statSync(`${SHOTS}/${name}.png`) && 0;
  const size = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  const buf = statSync(`${SHOTS}/${name}.png`);
  // 撑开回退：PNG 高度<=视口高时，按 shell scrollHeight 撑开重拍
  let { height } = await pngDims(`${SHOTS}/${name}.png`);
  if (height <= size.h + 4) {
    const shellH = await page.evaluate(() => {
      const s = document.querySelector('main') || document.scrollingElement;
      return Math.max(s.scrollHeight, document.body.scrollHeight);
    });
    if (shellH > size.h) {
      await page.setViewportSize({ width: size.w, height: Math.min(shellH + 40, 10000) });
      await settle(page);
      await page.screenshot({ path: `${SHOTS}/${name}.png` });
      height = (await pngDims(`${SHOTS}/${name}.png`)).height;
      out.legs[name] = { stretched: true, pngH: height, bytes: buf.size };
      return { file: `shots/${name}.png`, pngH: height, stretched: true };
    }
  }
  return { file: `shots/${name}.png`, pngH: height, stretched: false, bytes: buf.size };
}

async function pngDims(p) {
  const b = statSync(p);
  const buf = (await import('node:fs')).readFileSync(p);
  // PNG IHDR height at bytes 20..23 (big endian)
  const height = buf.readUInt32BE(20);
  return { bytes: b.size, height };
}

async function main() {
  const browser = await chromium.launch({ headless: true, ...(EXEC ? { executablePath: EXEC } : {}) });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 2600 }, storageState: AUTH });
  const page = await ctx.newPage();
  page.on('response', (r) => { if (r.status() >= 400) out.badResponses.push({ url: r.url(), status: r.status() }); });
  page.on('console', (m) => { if (m.type() === 'error') out.consoleErrors.push(m.text().slice(0, 140)); });

  // ---- gate-detail 腿：点开首行 → 断言只读门 ----
  await page.goto(`${BASE}/#/approvals`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  const row = page.locator('[data-testid^="apr5-row"]').first();
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(700);
    await settle(page);
    out.legs.gateDetail = await page.evaluate(() => {
      const note = document.querySelector('[data-testid="apr5-actions-readonly-note"]');
      const btns = [...document.querySelectorAll('button')].filter((b) => /^(批准|驳回)$/.test((b.textContent || '').trim()));
      const remark = document.querySelector('[data-testid*="remark"], [data-testid*="note-input"], textarea');
      return {
        readonlyNotePresent: !!note,
        readonlyNoteText: note ? note.textContent.trim().slice(0, 200) : '',
        decisionBtnCount: btns.length,
        btns: btns.map((b) => ({ t: b.textContent.trim(), disabled: b.disabled, ariaDisabled: b.getAttribute('aria-disabled'), title: (b.title || b.getAttribute('aria-describedby') || '').slice(0, 60), visible: b.getBoundingClientRect().width > 0 })),
        remarkDisabled: remark ? !!remark.disabled : null,
        detailUrl: location.href,
      };
    });
    out.legs.gateDetail.shot = await shot(page, 'approvals-gate-detail-1440-r3b');
  } else {
    out.notes.push('no apr5-row to open');
  }

  // ---- 知识 375 触点精计复测 ----
  const p2 = await ctx.newPage();
  await p2.setViewportSize({ width: 375, height: 800 });
  await p2.goto(`${BASE}/#/knowledge`, { waitUntil: 'domcontentloaded' });
  await settle(p2);
  out.legs.kn375Taps = await p2.evaluate(() => {
    const bad = [];
    document.querySelectorAll('main a, main button, main select, main input, main [role="button"], main [role="tab"], main [role="link"]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none') return;
      if (r.width < 44 || r.height < 44) bad.push({ tag: el.tagName, t: (el.getAttribute('aria-label') || el.textContent || el.placeholder || '').trim().slice(0, 18), w: Math.round(r.width), h: Math.round(r.height) });
    });
    return { count: bad.length, sample: bad.slice(0, 20), rowCount: document.querySelectorAll('[data-testid^="knw5-spaces-row"], [data-testid*="row"]').length };
  });

  out.entry = await p2.evaluate(() => (document.querySelector('script[src*="assets/index-"]') || {}).src || 'NONE');
  out.finishedAt = new Date().toISOString();
  await browser.close();
  writeFileSync(path.join(OUTDIR, 'ux-capture-r3b.summary.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.legs, null, 1));
  console.log('BAD', JSON.stringify(out.badResponses.map((b) => b.status + b.url.slice(-40))), 'ERRS', out.consoleErrors.length, 'ENTRY', out.entry.slice(-16), 'NOTES', JSON.stringify(out.notes));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
