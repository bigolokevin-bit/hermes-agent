#!/usr/bin/env node
// UX 总审 r1 — knowledge 模块取图腿（只读；不改产品码/testid、不重启服务）
// 现网 http://100.117.184.117:8183，ui-qa 登录态；两档加高视口（内部滚动 SPA，--full-page 为 no-op）。
// 交互路径：列表 → 命中检索 → 未命中检索 → 行展开/详情 → 冷深链详情 → 证据列表 → 证据打开。
// 产物：docs/_artifacts/ux/shots/knowledge-<state>-<w>-r1.png + ux-capture-r1.summary.json
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, renameSync, statSync, readFileSync } from 'node:fs';
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

const entryOf = async () => {
  const res = await fetch(`${BASE}/`, { headers: { cookie: cookieHeader() } }).catch(() => null);
  if (!res) return null;
  const html = await res.text();
  const m = /assets\/index-[A-Za-z0-9_-]+\.js/.exec(html);
  return m ? m[0] : null;
};
function cookieHeader() {
  try {
    const st = JSON.parse(readFileSync(AUTH_STATE, 'utf8'));
    return (st.cookies || []).map((c) => `${c.name}=${c.value}`).join('; ');
  } catch {
    return '';
  }
}

const browser = await chromium.launch({ executablePath: CHROMIUM });
const rows = [];
const consoleErrs = new Map();

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
  await page.waitForTimeout(2000); // 懒数据/字体
  return prev;
};

const probes = (page) =>
  page
    .evaluate(() => {
      const de = document.documentElement;
      const main = document.querySelector('main');
      const txt = (main?.innerText || '').trim();
      const expired = /会话已过期|重新登录|未登录/.test(txt);
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
      const sel = [...document.querySelectorAll('main select')].map((s) => {
        const r = s.getBoundingClientRect();
        return `${(s.getAttribute('data-testid') || 'select')}:${Math.round(r.width)}x${Math.round(r.height)}`;
      });
      return {
        mainChars: txt.length,
        head: txt.slice(0, 120).replace(/\s+/g, ' '),
        expiredShell: expired,
        overflowX: de.scrollWidth - de.clientWidth,
        smallTapTargets: taps.length,
        smallTapSample: taps.slice(0, 12),
        rawIdsTech: ids,
        selects: sel.slice(0, 8),
        emptyHits: /暂无|未接入|没有|无结果|无匹配/.test(txt),
        errorHits: /失败|错误|不可用|异常|无法|出错|被拒|无权限/.test(txt),
      };
    })
    .catch((e) => ({ evalError: String(e.message).slice(0, 120) }));

const focusProbe = async (page, tag) => {
  const out = [];
  await page.evaluate(() => document.body.focus?.());
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page
      .evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          testid: el.getAttribute('data-testid') || null,
          label: (el.innerText || el.value || '').trim().slice(0, 24),
          outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
          shadow: (cs.boxShadow || 'none').slice(0, 60),
          rect: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
          clipped: r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth,
        };
      })
      .catch(() => null);
    if (!info) break;
    out.push(info);
  }
  return { stage: tag, stops: out };
};

const shot = async (vp, name, fn) => {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    storageState: AUTH_STATE,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 140)));
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e.message ?? e).slice(0, 140)));
  const rec = { state: name, vp: vp.name, url: null, consoleErrors: errs.length, errorSample: null };
  try {
    rec.settleChars = await fn(page, rec, errs);
    if (rec.expiredShell) {
      console.log('EXPIRED-SHELL-DETECTED — aborting');
      await ctx.close();
      consoleErrs.set('expired', '1');
    }
    const file = path.join(OUT, `knowledge-${name}-${vp.width}-r1.png`);
    await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => {});
    await page.screenshot({ path: file, fullPage: false, timeout: 45000 });
    rec.png = path.relative(REPO, file);
    rec.pngBytes = statSync(file).size;
    rec.consoleErrorSample = errs[0] ?? null;
    rows.push(rec);
    console.log(`SHOT ${name}@${vp.name} chars=${rec.settleChars} bytes=${rec.pngBytes} overflow=${rec.probe?.overflowX} errs=${errs.length}`);
  } catch (e) {
    rec.error = String(e.message ?? e).slice(0, 200);
    rows.push(rec);
    console.log(`SHOT-FAIL ${name}@${vp.name}: ${rec.error}`);
  }
  await ctx.close();
  return rec;
};

const entryBefore = await entryOf();

for (const vp of VIEWPORTS) {
  // 1) 知识空间列表（着陆 Tab）
  await shot(vp, 'list', async (page, rec) => {
    const res = await page.goto(`${BASE}/#/knowledge`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    rec.http = res && res.status();
    const chars = await settle(page);
    const p = await probes(page);
    rec.probe = p;
    rec.url = page.url();
    rec.expiredShell = p.expiredShell;
    rec.spacesRows = await page.locator('[data-testid="knw5-spaces-row"]').count().catch(() => -1);
    rec.docRows = await page.locator('[data-testid^="knw5-docs-row"]').count().catch(() => -1);
    rec.focus = await focusProbe(page, 'list');
    rec.needle = await page
      .evaluate(() => {
        const r = document.querySelector('[data-testid="knw5-spaces-row"]');
        const t = (r?.innerText || '').trim().split(/\s+/)[0] || '';
        return t.slice(0, 4);
      })
      .catch(() => '');
    if (!rec.needle) rec.needle = '人事';
    return chars;
  });

  const listRec = rows.filter((r) => r.vp === vp.name && r.state === 'list')[0] || {};
  const needle = listRec.needle || '人事';

  // 2) 检索命中
  await shot(vp, 'search-hit', async (page, rec) => {
    await page.goto(`${BASE}/#/knowledge`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await settle(page);
    const input = page.locator('[data-testid="knw5-search-input"]');
    if ((await input.count()) === 0) {
      rec.note = 'no knw5-search-input on landing tab';
      return (await probes(page)).mainChars;
    }
    await input.fill(needle);
    await page.locator('[data-testid="knw5-search-submit"]').click().catch(() => input.press('Enter'));
    await page.waitForTimeout(3500);
    const p = await probes(page);
    rec.probe = p;
    rec.url = page.url();
    rec.needle = needle;
    rec.resultRows = await page.locator('[data-testid="knw5-search-results"] li, [data-testid="knw5-search-results"] tr').count().catch(() => -1);
    return p.mainChars;
  });

  // 3) 检索未命中（空态话术取证）
  await shot(vp, 'search-miss', async (page, rec) => {
    await page.goto(`${BASE}/#/knowledge`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await settle(page);
    const input = page.locator('[data-testid="knw5-search-input"]');
    if ((await input.count()) === 0) {
      rec.note = 'no knw5-search-input';
      return (await probes(page)).mainChars;
    }
    await input.fill('zzz不存在词zzz');
    await page.locator('[data-testid="knw5-search-submit"]').click().catch(() => input.press('Enter'));
    await page.waitForTimeout(3500);
    const p = await probes(page);
    rec.probe = p;
    rec.noMatchCitations = await page.locator('[data-testid="knw5-search-empty-citations"]').count().catch(() => -1);
    return p.mainChars;
  });

  // 4) 行展开/详情（点击首个空间行）
  await shot(vp, 'detail', async (page, rec) => {
    await page.goto(`${BASE}/#/knowledge`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await settle(page);
    const row = page.locator('[data-testid="knw5-spaces-row"]').first();
    if ((await row.count()) === 0) {
      rec.note = 'no spaces rows to open';
      return (await probes(page)).mainChars;
    }
    await row.click();
    await page.waitForTimeout(3000);
    const p = await probes(page);
    rec.probe = p;
    rec.url = page.url();
    rec.docLink = await page
      .locator('[data-testid="kn3-docs-detail-open"], [data-testid$="-detail-open"]')
      .first()
      .getAttribute('href')
      .catch(() => null);
    return p.mainChars;
  });

  // 5) 证据与引用 Tab
  await shot(vp, 'evidence', async (page, rec) => {
    const res = await page.goto(`${BASE}/#/knowledge?tab=evidence`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    rec.http = res && res.status();
    const chars = await settle(page);
    const p = await probes(page);
    rec.probe = p;
    rec.url = page.url();
    rec.evRows = await page.locator('[data-testid^="ev5-row-"]').count().catch(() => -1);
    rec.focus = await focusProbe(page, 'evidence');
    return chars;
  });

  // 6) 证据条目打开（第一条 ev5-open）
  await shot(vp, 'evidence-open', async (page, rec) => {
    await page.goto(`${BASE}/#/knowledge?tab=evidence`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await settle(page);
    const link = page.locator('[data-testid^="ev5-open-"]').first();
    if ((await link.count()) === 0) {
      rec.note = 'no ev5-open links (empty/denied state?)';
      return (await probes(page)).mainChars;
    }
    rec.href = await link.getAttribute('href');
    await link.click();
    await page.waitForTimeout(3500);
    const p = await probes(page);
    rec.probe = p;
    rec.url = page.url();
    return p.mainChars;
  });
}

await browser.close();
const entryAfter = await entryOf();

const summary = {
  base: BASE,
  mode: 'auth(ui-qa storageState)',
  entryBefore,
  entryAfter,
  entryDrift: entryBefore !== entryAfter,
  viewports: ['1440x2600', '375x3200'],
  shots: rows,
  ok: rows.length > 0 && rows.every((r) => !r.error),
};
atomicWrite(path.join(REPO, 'docs/_artifacts/ux/ux-capture-r1.summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(entryDriftLine(entryAfter, entryBefore));
function entryDriftLine(a, b) {
  return `DONE shots=${rows.length} entry=${a}${a !== b ? ' DRIFT-FROM ' + b : ''}`;
}
process.exit(summary.ok ? 0 : 1);
