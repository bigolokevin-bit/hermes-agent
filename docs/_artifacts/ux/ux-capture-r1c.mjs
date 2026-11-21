#!/usr/bin/env node
// UX 总审 r1c — L0 P0 纠偏令：旧 375 判据（document 级 overflowX）被 App 层
// overflow-x-hidden 掩盖，属假绿，撤销。本腿按新口径重测 knowledge 两 Tab 的 375：
//   ① 逐元素 boundingRect：right > 375+1 或 left < -1 记违规（分桶：右裁切/左出界）
//   ② 容器级：overflow-x hidden|clip 且 scrollWidth > clientWidth+1 记裁切容器
//   ③ 375 截图必须整页（fullPage 或视口拉伸回退），PNG 像素高 > 视口高，否则 NOT MEASURED
// 只读取证，不改产品码。
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';

const atomicWrite = (file, text) => {
  const tmp = `${file}.tmp.${process.pid}`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
};

const BASE = 'http://100.117.184.117:8183';
const AUTH_STATE = '/Users/kevin_studio/.local/state/sekoi-ops/ui-qa-auth-state.json';
const PW_HOST = '/Users/kevin_studio/Projects/seakoi-console-web/package.json';
const CHROMIUM = path.join(
  process.env.HOME || '',
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/' +
    'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);
const REPO = '/Users/kevin_studio/Projects/forks/console-ui-qa';
const OUT = path.join(REPO, 'docs/_artifacts/ux/shots');
mkdirSync(OUT, { recursive: true });

const VW = 375;
const VH = 800; // 真移动视口，不预拉伸

const pngSize = (file) => {
  const b = readFileSync(file);
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length };
};

const req = createRequire(PW_HOST);
const { chromium } = req('playwright');
const browser = await chromium.launch({ executablePath: CHROMIUM });
const context = await browser.newContext({
  storageState: AUTH_STATE,
  viewport: { width: VW, height: VH },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const rows = [];

const settle = async (maxMs = 12000) => {
  let prev = -1;
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    await page.waitForTimeout(200);
    const cur = await page
      .evaluate(() => (document.querySelector('main')?.innerText || '').trim().length)
      .catch(() => 0);
    if (cur > 0 && cur === prev) break;
    prev = cur;
  }
  await page.waitForTimeout(1500);
  return prev;
};

const audit375 = () =>
  page.evaluate(() => {
    const W = window.innerWidth;
    const visible = (el) => {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const label = (el) => {
      const r = el.getBoundingClientRect();
      const id = el.getAttribute('data-testid');
      const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
      return `${id ? id : el.tagName.toLowerCase()}${txt ? ' “' + txt + '”' : ''} [${Math.round(r.left)},${Math.round(r.right)}x${Math.round(r.width)}]`;
    };
    const inAriaHidden = (el) => {
      for (let n = el; n && n !== document.documentElement; n = n.parentElement)
        if (n.getAttribute && n.getAttribute('aria-hidden') === 'true') return true;
      return false;
    };
    const right = [];
    const leftOut = [];
    const leftOutHidden = [];
    for (const el of document.querySelectorAll(
      'a,button,input,select,textarea,[role="button"],[data-testid],h1,h2,h3,h4,p,li,td,th,label,code,summary,nav,section,header,footer,aside,main',
    )) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > W + 1) right.push(label(el));
      else if (r.left < -1) (inAriaHidden(el) ? leftOutHidden : leftOut).push(label(el));
    }
    const clippedContainers = [];
    for (const el of document.querySelectorAll('body *')) {
      const st = getComputedStyle(el);
      if (!/(hidden|clip)/.test(st.overflowX)) continue;
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
        clippedContainers.push(
          `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean)[0] : ''} sw=${el.scrollWidth} cw=${el.clientWidth}`,
        );
    }
    const scrollers = [];
    for (const el of document.querySelectorAll('body *')) {
      const st = getComputedStyle(el);
      if (!/(auto|scroll)/.test(st.overflowX)) continue;
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
        scrollers.push(
          `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean)[0] : ''} sw=${el.scrollWidth} cw=${el.clientWidth}`,
        );
    }
    const de = document.documentElement;
    return {
      W,
      docScrollW: de.scrollWidth,
      docClientW: de.clientWidth,
      docScrollH: Math.max(de.scrollHeight, document.body.scrollHeight),
      rightOverflow: right.slice(0, 40),
      rightOverflowCount: right.length,
      leftOut: leftOut.slice(0, 20),
      leftOutCount: leftOut.length,
      leftOutAriaHiddenCount: leftOutHidden.length,
      clippedContainers: clippedContainers.slice(0, 30),
      clippedContainersCount: clippedContainers.length,
      xScrollers: scrollers.slice(0, 15),
    };
  });

const contentHeight = () =>
  page.evaluate(() => {
    let max = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    for (const el of document.querySelectorAll('body *')) {
      const st = getComputedStyle(el);
      if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 200)
        max = Math.max(max, el.getBoundingClientRect().top + el.scrollHeight);
    }
    return Math.ceil(max);
  });

const shotFull375 = async (name) => {
  const file = path.join(OUT, `${name}.png`);
  // 先按真视口试 fullPage
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.screenshot({ path: file, fullPage: true });
  let sz = pngSize(file);
  let method = 'fullPage';
  if (!sz || sz.h <= VH) {
    // 内部滚动 SPA：fullPage 失效 → 量内容高，拉视口重截
    const h = Math.min(Math.max((await contentHeight()) + 40, VH + 200), 15000);
    await page.setViewportSize({ width: VW, height: h });
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: file });
    method = `viewport-stretch(${h})`;
    sz = pngSize(file);
    await page.setViewportSize({ width: VW, height: VH });
  }
  const measured = !!sz && sz.h > VH;
  return { png: `docs/_artifacts/ux/shots/${name}.png`, method, px: sz, fullPageVerified: measured };
};

const run = async (state, fn) => {
  const badResponses = [];
  const onResp = (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${new URL(r.url()).pathname}${new URL(r.url()).search}`);
  };
  page.on('response', onResp);
  const errors = [];
  const onErr = (e) => errors.push(String(e.message || e).slice(0, 120));
  page.on('console', (m) => m.type() === 'error' && onErr(m));
  page.on('pageerror', onErr);
  try {
    await fn();
    const chars = await settle();
    // 审计在拉伸截图之前、真视口之下做
    const probe = await audit375();
    const shot = await shotFull375(state + '-375-r1c');
    rows.push({ state, viewport: `${VW}x${VH}`, settleChars: chars, url: page.url(), probe, ...shot, consoleErrors: errors.length, errorSample: errors.slice(0, 3), badResponses: [...new Set(badResponses)].slice(0, 8) });
    console.log(`AUDIT ${state} right=${probe.rightOverflowCount} left=${probe.leftOutCount} clipC=${probe.clippedContainersCount} scrollers=${probe.xScrollers.length} shot=${shot.method} px=${shot.px && shot.px.w}x${shot.px && shot.px.h} verified=${shot.fullPageVerified}`);
  } catch (e) {
    rows.push({ state, error: String(e.message || e).slice(0, 300) });
    console.log(`FAIL ${state}: ${String(e.message || e).slice(0, 200)}`);
  } finally {
    page.off('response', onResp);
    page.off('console', onErr);
    page.off('pageerror', onErr);
  }
};

await run('knowledge-landing', async () => {
  await page.goto(`${BASE}/knowledge`, { waitUntil: 'networkidle', timeout: 30000 });
});

await run('knowledge-evidence-click', async () => {
  await page.goto(`${BASE}/knowledge`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.click('a:has-text("证据与引用")', { timeout: 8000 });
});

await run('knowledge-deeplink-evidence', async () => {
  await page.goto(`${BASE}/knowledge?tab=evidence`, { waitUntil: 'networkidle', timeout: 30000 });
});

await run('knowledge-search-miss', async () => {
  await page.goto(`${BASE}/knowledge`, { waitUntil: 'networkidle', timeout: 30000 });
  const input = page.locator('main input[placeholder*="搜索"]').first();
  await input.fill('zzz不存在词zzz');
  const form = page.locator('main form').first();
  await form.evaluate((f) => f.requestSubmit());
});

await browser.close();
atomicWrite(
  path.join(REPO, 'docs/_artifacts/ux/ux-capture-r1c.summary.json'),
  JSON.stringify({ base: BASE, mode: 'r1c strict-375 (L0 P0 纠偏新口径)', rows, ok: true }, null, 2),
);
console.log('DONE r1c rows=' + rows.length);
