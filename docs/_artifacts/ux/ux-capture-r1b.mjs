#!/usr/bin/env node
// UX 总审 r1b — 补腿：r1 里 spaces 着陆页用的是 kn6-* testid（现网代际比仓库新），
// 且 #/knowledge?tab=evidence 深链被归一后仍渲染 spaces 内容 → 证据 Tab 未取到。
// 本腿全部走真实用户点击路径，并记录 4xx/5xx 资源 URL 与 testid 清单。只读，不改产品码。
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, renameSync, statSync } from 'node:fs';
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

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 2600 },
  { name: '375', width: 375, height: 3200 },
];

const req = createRequire(PW_HOST);
const { chromium } = req('playwright');
const browser = await chromium.launch({ executablePath: CHROMIUM });
const rows = [];

const settle = async (page, maxMs = 12000) => {
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
  await page.waitForTimeout(2000);
  return prev;
};

const probes = (page) =>
  page
    .evaluate(() => {
      const de = document.documentElement;
      const main = document.querySelector('main');
      const txt = (main?.innerText || '').trim();
      const taps = [];
      for (const el of document.querySelectorAll('main button, main a, main input, main select, main [role="button"]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.height < 44 || r.width < 44)
          taps.push(`${(el.getAttribute('data-testid') || el.tagName + ':' + (el.innerText || '').trim().slice(0, 12)).replace(/\s+/g, ' ')} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      const ids = [];
      const pat = [
        [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/gi, 'uuid'],
        [/请求编号[:：]?\s*[0-9a-zA-Z_-]{6,}/g, 'rid-on-screen'],
        [/\b20\d\d-\d\d-\d\dT\d\d:\d\d(:\d+)?/g, 'iso-ts'],
        [/not_wired|not wired|GAP-\d+|TODO|undefined|NaN|\[object /gi, 'eng-language'],
      ];
      for (const [re, name] of pat) {
        const m = txt.match(re);
        if (m) ids.push(`${name}x${m.length}: ${m[0].slice(0, 60)}`);
      }
      const testids = {};
      for (const el of document.querySelectorAll('[data-testid]')) {
        const k = el.getAttribute('data-testid').replace(/-[0-9a-f]{6,}.*$/, '-*');
        testids[k] = (testids[k] || 0) + 1;
      }
      return {
        mainChars: txt.length,
        head: txt.slice(0, 160).replace(/\s+/g, ' '),
        overflowX: de.scrollWidth - de.clientWidth,
        smallTapTargets: taps.length,
        smallTapSample: taps.slice(0, 12),
        rawIdsTech: ids,
        emptyHits: /暂无|未接入|没有|无结果|无匹配/.test(txt),
        errorHits: /失败|错误|不可用|异常|无法|出错|被拒|无权限/.test(txt),
        testidKeys: Object.fromEntries(Object.entries(testids).slice(0, 40)),
      };
    })
    .catch((e) => ({ evalError: String(e.message).slice(0, 120) }));

const shot = async (vp, name, fn) => {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    storageState: AUTH_STATE,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const errs = [];
  const badRes = [];
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 140)));
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e.message ?? e).slice(0, 140)));
  page.on('response', (r) => {
    if (r.status() >= 400) badRes.push(`${r.status()} ${r.url().replace(BASE, '')}`);
  });
  const rec = { state: name, vp: vp.name, consoleErrors: errs.length };
  try {
    rec.settleChars = await fn(page, rec, errs);
    rec.badResponses = [...new Set(badRes)];
    const file = path.join(OUT, `knowledge-${name}-${vp.width}-r1b.png`);
    await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {});
    await page.screenshot({ path: file, fullPage: false, timeout: 45000 });
    rec.png = path.relative(REPO, file);
    rec.pngBytes = statSync(file).size;
    rows.push(rec);
    console.log(`SHOT ${name}@${vp.name} chars=${rec.settleChars} bytes=${rec.pngBytes} overflow=${rec.probe?.overflowX} errs=${errs.length} bad=${rec.badResponses.join('|')}`);
  } catch (e) {
    rec.error = String(e.message ?? e).slice(0, 200);
    rows.push(rec);
    console.log(`SHOT-FAIL ${name}@${vp.name}: ${rec.error}`);
  }
  await ctx.close();
  return rec;
};

for (const vp of VIEWPORTS) {
  // A) 着陆页 testid 普查 + 检索命中/未命中（真实输入 kn6-search-input）
  let docNeedle = '人事';
  await shot(vp, 'spaces-dom', async (page, rec) => {
    const res = await page.goto(`${BASE}/#/knowledge`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    rec.http = res && res.status();
    const chars = await settle(page);
    rec.probe = await probes(page);
    rec.url = page.url();
    // 从可见行拿一个真实文档名做命中 needle
    docNeedle = await page
      .evaluate(() => {
        const cand = document.querySelector('[data-testid*="row"] [data-testid*="name"], [data-testid*="doc-name"], main tbody tr td:first-child, [data-testid*="row"]');
        const t = (cand?.innerText || '').trim().split(/\s+/)[0] || '';
        return t.slice(0, 6);
      })
      .catch(() => '');
    if (!docNeedle || docNeedle.length < 2) docNeedle = '人事';
    rec.docNeedle = docNeedle;
    return chars;
  });

  await shot(vp, 'search-hit2', async (page, rec) => {
    await page.goto(`${BASE}/#/knowledge`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await settle(page);
    const input = page.locator('main input[type="search"], main [data-testid*="search"] input, main input[placeholder*="搜索"]').first();
    if ((await input.count()) === 0) {
      rec.note = 'no visible search input';
      rec.probe = await probes(page);
      return rec.probe.mainChars;
    }
    rec.inputTestId = await input.getAttribute('data-testid');
    rec.placeholder = await input.getAttribute('placeholder');
    await input.fill(docNeedle);
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(3500);
    await settle(page, 6000);
    rec.probe = await probes(page);
    rec.url = page.url();
    rec.needle = docNeedle;
    return rec.probe.mainChars;
  });

  await shot(vp, 'search-miss2', async (page, rec) => {
    await page.goto(`${BASE}/#/knowledge`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await settle(page);
    const input = page.locator('main input[type="search"], main [data-testid*="search"] input, main input[placeholder*="搜索"]').first();
    if ((await input.count()) === 0) {
      rec.note = 'no visible search input';
      rec.probe = await probes(page);
      return rec.probe.mainChars;
    }
    await input.fill('zzz不存在词zzz');
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(3500);
    rec.probe = await probes(page);
    rec.url = page.url();
    return rec.probe.mainChars;
  });

  // B) 点击行 → 详情
  await shot(vp, 'detail2', async (page, rec) => {
    await page.goto(`${BASE}/#/knowledge`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await settle(page);
    const row = page.locator('main [data-testid*="row"]').first();
    if ((await row.count()) === 0) {
      rec.note = 'no rows at all';
      rec.probe = await probes(page);
      return rec.probe.mainChars;
    }
    rec.rowTestId = await row.getAttribute('data-testid');
    await row.click();
    await page.waitForTimeout(3000);
    await settle(page, 6000);
    rec.probe = await probes(page);
    rec.url = page.url();
    // 若在详情内还有点开的下一层（文档正文），再截一层
    const deep = page.locator('main [data-testid*="detail-open"], main a:has-text("打开")').first();
    if ((await deep.count()) > 0) {
      rec.deepText = (await deep.innerText().catch(() => '')).slice(0, 30);
    }
    return rec.probe.mainChars;
  });

  // C) 真实点击 nav → 证据与引用列表
  await shot(vp, 'evidence2', async (page, rec) => {
    const res = await page.goto(`${BASE}/#/knowledge`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    rec.http = res && res.status();
    await settle(page);
    const link = page.locator('a:has-text("证据与引用"), button:has-text("证据与引用")').first();
    rec.navFound = (await link.count()) > 0;
    if (!rec.navFound) {
      rec.probe = await probes(page);
      return rec.probe.mainChars;
    }
    await link.click();
    await page.waitForTimeout(2500);
    await settle(page, 10000);
    rec.probe = await probes(page);
    rec.url = page.url();
    rec.evRows = await page.locator('[data-testid^="ev5-row"], main tbody tr').count().catch(() => -1);
    return rec.probe.mainChars;
  });

  // D) 证据条目打开
  await shot(vp, 'evidence-open2', async (page, rec) => {
    await page.goto(`${BASE}/#/knowledge`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await settle(page);
    const link = page.locator('a:has-text("证据与引用")').first();
    if ((await link.count()) === 0) {
      rec.note = 'nav missing';
      rec.probe = await probes(page);
      return rec.probe.mainChars;
    }
    await link.click();
    await settle(page, 10000);
    const open = page.locator('[data-testid^="ev5-open"], main tbody tr td:last-child a, main tbody tr button').first();
    if ((await open.count()) === 0) {
      rec.note = 'no open control in evidence list';
      rec.probe = await probes(page);
      return rec.probe.mainChars;
    }
    await open.click();
    await page.waitForTimeout(3000);
    await settle(page, 6000);
    rec.probe = await probes(page);
    rec.url = page.url();
    return rec.probe.mainChars;
  });

  // E) 冷深链行为取证（r1 记录 ?tab=evidence 归一后仍见 spaces）
  await shot(vp, 'deeplink-evidence', async (page, rec) => {
    await page.goto(`${BASE}/#/knowledge?tab=evidence`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await settle(page);
    rec.probe = await probes(page);
    rec.url = page.url();
    rec.isEvidenceContent = await page
      .evaluate(() => /证据|引用|verification|unverified/.test((document.querySelector('main')?.innerText || '').slice(0, 400)))
      .catch(() => false);
    return rec.probe.mainChars;
  });
}

await browser.close();
const summary = { base: BASE, mode: 'auth(ui-qa) r1b click-path', viewports: ['1440x2600', '375x3200'], shots: rows, ok: rows.length > 0 && rows.every((r) => !r.error) };
atomicWrite(path.join(REPO, 'docs/_artifacts/ux/ux-capture-r1b.summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(`DONE r1b shots=${rows.length}`);
process.exit(summary.ok ? 0 : 1);
