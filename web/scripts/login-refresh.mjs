#!/usr/bin/env node
/**
 * login-refresh.mjs — 刷新控制台登录态并落 storageState（验收探针的唯一凭据来源）。
 *
 * 为什么需要它：`parity-probe` 的 storageState 里只有一枚 session cookie
 * （access_token_cookie）。它一过期，探针就以**匿名态**跑出全绿——页壳齐、svg 有数、
 * tablists=1，全是假读数（2026-11-26 实测踩过：44 PASS 全是匿名壳）。
 * 所以本脚本把「/auth/whoami == 200」当唯一成功判据，不成立就不写文件、非零退出。
 *
 * 为什么不走浏览器点登录：图形码明文只出现在 bisheng-backend 日志里，
 * 而 9122 /auth/login → 代理 → 上游 中间多一跳，取码与提交之间容易错配。
 * 这里直接打上游（public_key + get_captcha + login），拿到 token 再注入同源 cookie，
 * 与浏览器登录得到的是同一枚 access_token_cookie。
 *
 * 用法：node web/scripts/login-refresh.mjs
 * 环境：BASE(默认 http://127.0.0.1:9122) AUTH_UPSTREAM(默认 http://127.0.0.1:7860)
 *      USER_NAME(默认 opsadmin) PASS(默认 admin123)
 *      AUTH(默认 docs/_artifacts/parity-own/storageState.json)
 * 前置：本机 docker 在跑 bisheng-backend（图形码明文只在它日志里），否则退出码 2。
 */
import { execFileSync } from 'node:child_process';
import { publicEncrypt, constants } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const { chromium } = await import(`${REPO}/web/node_modules/playwright/index.mjs`);

const BASE = process.env.BASE || 'http://127.0.0.1:9122';
const UP = (process.env.AUTH_UPSTREAM || 'http://127.0.0.1:7860').replace(/\/$/, '');
const USER = process.env.USER_NAME || 'opsadmin';
const PASS = process.env.PASS || 'admin123';
const AUTH = process.env.AUTH || `${REPO}/docs/_artifacts/parity-own/storageState.json`;

const die = (code, msg) => {
  console.error(`LOGIN FAIL(${code}): ${msg}`);
  process.exit(code);
};

async function upJson(method, path, body) {
  const res = await fetch(`${UP}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON 原样带上判据 */
  }
  return { status: res.status, json, text: text.slice(0, 200) };
}

// 1) 取公钥 + 一枚图形码（先取码再读日志，顺序错就会拿到上一枚的明文）
const pk = await upJson('GET', '/api/v1/user/public_key');
const pem = pk.json?.data?.public_key;
if (!pem) die(2, `认证上游不可用（public_key ${pk.status}）——docker/colima 是否在跑？`);

const cap = await upJson('GET', '/api/v1/user/get_captcha');
const key = cap.json?.data?.captcha_key;
if (!key) die(2, `图形码取不到（${cap.status}）`);

// 2) 图形码明文：只从后端日志里取最后一条
let logs = '';
try {
  logs = execFileSync('docker', ['logs', '--tail', '120', 'bisheng-backend'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  die(2, `读不到 bisheng-backend 日志：${String(e).slice(0, 120)}`);
}
const all = [...logs.matchAll(/captcha_char=([A-Za-z0-9]+)/g)].map((m) => m[1]);
const code = all[all.length - 1];
if (!code) die(2, '后端日志里没有 captcha_char，无法自动登录');

// 3) 口令 RSA PKCS#1 v1.5 加密（上游 public_key 是 512-bit，够放短口令）
let enc;
try {
  enc = publicEncrypt(
    { key: pem, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(PASS, 'utf8'),
  ).toString('base64');
} catch (e) {
  die(3, `口令加密失败：${String(e).slice(0, 120)}`);
}

const login = await upJson('POST', '/api/v1/user/login', {
  user_name: USER,
  password: enc,
  captcha_key: key,
  captcha: code,
});
const token = login.json?.data?.access_token;
if (login.status !== 200 || !token) {
  die(4, `上游登录失败 status=${login.status} msg=${login.json?.status_message ?? login.text}`);
}

// 4) 把 token 当同源 cookie 注入浏览器，再以 whoami 为唯一判据
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([
  { name: 'access_token_cookie', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' },
]);
const page = await ctx.newPage();
// 必须先在目标源上打开一页，否则 about:blank 里打相对地址是跨源，cookie 不随行。
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
const who = await page.evaluate(async () => {
  const r = await fetch('/auth/whoami', { credentials: 'same-origin' });
  return { status: r.status, body: await r.json().catch(() => null) };
}).catch(() => ({ status: 0, body: null }));

if (who.status !== 200) {
  await browser.close();
  die(5, `会话未建立：whoami=${who.status}（token 拿到了但 BFF 不认，查 BFF 与域服务是否活）`);
}

mkdirSync(dirname(AUTH), { recursive: true });
await ctx.storageState({ path: AUTH });
const name = who.body?.user_name || who.body?.name || who.body?.userName || USER;
console.log(`LOGIN OK: whoami=200 user=${name} → ${AUTH}`);
await browser.close();
