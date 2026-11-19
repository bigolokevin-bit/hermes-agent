// L0 十七轮重建：state-quad 腿此前脚本不在树内（git find 无 state-quad.mjs），
// 工件停留在 01:22/9122 旧代次。按旧工件 method 行口径重写：
// playwright hash-form /#/<route>?state=<s>，钩子 [data-fixture] + [data-testid=shell-fixture-badge]。
// 与 crawl/shots 同口径：base 9119、注入 __HERMES_AUTH_REQUIRED__ 防 401 reload-loop。
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// playwright 不在本仓 node_modules（同 shots.mjs 口径）：从 seakoi-console-web 宿主解析，
// 浏览器用 ~/Library/Caches/ms-playwright 已下载的 chromium。
const require_ = createRequire('/Users/kevin_studio/Projects/seakoi-console-web/package.json');
const { chromium } = require_('playwright');
const CHROMIUM = path.join(
  process.env.HOME || '',
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/' +
    'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);

const BASE = process.argv[2] || 'http://127.0.0.1:9119';
const ROUTES = ['#/employees', '#/work', '#/approvals', '#/sessions', '#/system'];
const STATES = ['loading', 'empty', 'error', 'ready'];

const browser = await chromium.launch({ executablePath: CHROMIUM });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { window.__HERMES_AUTH_REQUIRED__ = true; });
const page = await ctx.newPage();
const rows = [];
let passed = 0;
for (const route of ROUTES) {
  for (const state of STATES) {
    const url = `${BASE}/${route}?state=${state}`;
    let fixtureAttr = null, badge = null, err = null;
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 15000 });
      // 与 shots 腿同款 poll-until-stable，避免 lazy 模块未挂上就采样
      let prev = -1;
      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(150);
        const cur = await page.evaluate(() => document.querySelector('main')?.innerText.length ?? 0);
        if (cur > 0 && cur === prev) break;
        prev = cur;
      }
      fixtureAttr = await page.evaluate(() => document.querySelector('[data-fixture]')?.getAttribute('data-fixture') ?? null);
      badge = await page.evaluate(() => document.querySelector('[data-testid=shell-fixture-badge]')?.textContent ?? null);
    } catch (e) { err = String(e).slice(0, 120); }
    const ok = fixtureAttr === state;
    const badgeOk = !!badge && badge.includes('FIXTURE');
    if (ok) passed++;
    rows.push({ route, state, url, fixtureAttr, badge, ok, badgeOk, ...(err ? { err } : {}) });
  }
}
await browser.close();
const headHash = execSync('git rev-parse --short=8 HEAD', { encoding: 'utf8' }).trim();
const out = { base: BASE, method: 'playwright hash-form /#/<route>?state=<s>; hook=[data-fixture]+[data-testid=shell-fixture-badge] (web/src/shell/fixtures.ts)', headHash, sampled: rows.length, passed, rows };
fs.writeFileSync('docs/_artifacts/tonight/state-quad.json', JSON.stringify(out, null, 2) + '\n');
console.log(`state-quad: sampled=${rows.length} passed=${passed} base=${BASE} head=${headHash}`);
process.exit(passed === rows.length ? 0 : 1);
