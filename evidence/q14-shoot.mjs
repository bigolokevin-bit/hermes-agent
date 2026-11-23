// Q14 evidence shots — byModel 分组表真实渲染取图（1440×900 与 375×812）。
// 页面源：Q14 worktree vite build 产物，经 q14-proxy(9131) 同源服务；
// /agent-api/* 与 /api/* 走真 BFF(8092)，opsadmin 会话 cookie 注入（禁 fixture）。
// 导航纪律：domcontentloaded + 显式 settle，禁 networkidle；截图取视口图。
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const req = createRequire('/Users/kevin_studio/Projects/seakoi-console-web/package.json');
const { chromium } = req('playwright');
const CHROMIUM = path.join(
  os.homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/' +
    'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);

const BASE = 'http://127.0.0.1:9131';
const OUT = '/Users/kevin_studio/Projects/tasks/Q14-metrics-bymodel/evidence';
const TOKEN = readFileSync(path.join(os.homedir(), '.seakoi/opsadmin-token.txt'), 'utf8').trim();

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(viewport, file) {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const context = await browser.newContext({ viewport });
  await context.addCookies([
    { name: 'access_token_cookie', value: TOKEN, url: BASE },
  ]);
  const page = await context.newPage();
  const apiSeen = [];
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.pathname.includes('hermes-usage') || u.pathname.startsWith('/api/')) {
      apiSeen.push(`${r.status()} ${u.pathname}${u.search}`);
    }
  });
  await page.goto(`${BASE}/metrics?window=7d`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(2500);
  const block = page.locator('[data-testid="metBM-by-model"]');
  await block.waitFor({ state: 'visible', timeout: 25000 });
  await block.scrollIntoViewIfNeeded();
  await settle(800);
  // 表体读数留证（文本快照，供 DONE 引用）
  const snap = await block.evaluate((el) => el.innerText.slice(0, 2000));
  writeFileSync(`${OUT}/q14-dom-${viewport.width}.txt`, snap);
  await page.screenshot({ path: `${OUT}/${file}`, timeout: 30000 });
  console.log(`saved ${file} | hermes-usage calls: ${apiSeen.filter((s) => s.includes('hermes-usage')).join(', ') || 'NONE'}`);
  await browser.close();
}

await shoot({ width: 1440, height: 900 }, 'q14-metrics-bymodel-1440.png');
await shoot({ width: 375, height: 812 }, 'q14-metrics-bymodel-375.png');
