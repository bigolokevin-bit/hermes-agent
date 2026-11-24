// AU-01 evidence shots — 事件详情三链实态（1440×900 与 375×812）。
// 页面源：本 worktree `vite build` 产物 hermes_cli/web_dist，经临时 au01-proxy(9262)
// 同源提供；/agent-api/* 反代真 BFF(8092)，/auth/* 走真 9122 登录层。
// 目标事件：p1 采样真库 dispatch.event（runId+policyDecisionId+machine actor）：
//   ev-dispatch-8af0c2546ed788cf251aeebe04 —— 三链实态 = 运行真锚 + 判定说而不链 + 机器主体说值不链。
// 纪律：domcontentloaded + settle ≥2s（禁 networkidle）；每图前 whoami==200 断言；
// 视口图不 fullPage；375 档同时验无横向溢出。Lineage: du01-shoot.mjs。
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const req = createRequire('/Users/kevin_studio/Projects/seakoi-console-web/package.json');
const { chromium } = req('playwright');
const CHROMIUM = path.join(
  os.homedir(),
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/' +
    'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);

const BASE = 'http://127.0.0.1:9262';
const OUT = '/Users/kevin_studio/Projects/tasks/AU-01-run/evidence';
const TOKEN = readFileSync(path.join(os.homedir(), '.seakoi/opsadmin-token.txt'), 'utf8').trim();
const DETAIL_URL =
  `${BASE}/#/audit?window=custom&from=2026-10-25T00:19:53Z&to=2026-11-24T00:19:53Z` +
  '&limit=25&detail=ev-dispatch-8af0c2546ed788cf251aeebe04';

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(viewport, file) {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const context = await browser.newContext({ viewport });
  await context.addCookies([{ name: 'access_token_cookie', value: TOKEN, url: BASE }]);
  const page = await context.newPage();

  const whoami = await page.request.get(`${BASE}/auth/whoami`);
  const who = await whoami.json();
  console.log(`whoami status=${whoami.status()} user=${who?.display ?? who?.user_id ?? '-'}`);
  if (whoami.status() !== 200) {
    await browser.close();
    throw new Error(`whoami!=200 (${whoami.status()}) — 拒绝出图`);
  }

  const seen = [];
  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('/agent-api/api/audit')) seen.push(`${res.status()} ${u.replace(BASE, '').slice(0, 120)}`);
  });

  await page.goto(DETAIL_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(2500);
  await page.waitForSelector('[data-testid="aud02-detail"]', { timeout: 30000 });
  await page.waitForSelector('[data-testid="aud3-chains"]', { timeout: 20000 });
  await settle(800);

  const line = async (sel) =>
    ((await page.evaluate((s) => document.querySelector(s)?.textContent ?? '<absent>', sel)) ?? '').trim();
  console.log(`  ${file} chains块=${await line('[data-testid="aud3-chains"]')}`);
  console.log(`  ${file} 链kind actor/run/decision=${[
    await line('[data-testid="aud3-chain-actor"]'),
    await line('[data-testid="aud3-chain-run"]'),
    await line('[data-testid="aud3-chain-decision"]'),
  ].join(' | ')}`);
  console.log(`  ${file} run锚href=${await page.evaluate(() => document.querySelector('[data-testid="aud3-chain-run"]')?.getAttribute('href') ?? '<none>')}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(`  ${file} 横向溢出(px)=${overflow}`);
  console.log(`  ${file} 审计读口: ${seen.join(' | ')}`);

  await page.evaluate(() => document.querySelector('[data-testid="aud3-chains"]')?.scrollIntoView({ block: 'center' }));
  await settle(300);
  await page.screenshot({ path: `${OUT}/${file}`, timeout: 30000 });
  console.log(`saved ${file}`);
  await browser.close();
  return overflow;
}

await shoot({ width: 1440, height: 900 }, 'au01-1440.png');
const o375 = await shoot({ width: 375, height: 812 }, 'au01-375.png');
if (o375 > 0) throw new Error(`375 档横向溢出 ${o375}px — 不合格`);
