#!/usr/bin/env node
/**
 * parity-probe.mjs — 控制台逐页视觉验收探针（我自己的闸，不依赖车道自述）。
 *
 * 用法：
 *   node web/scripts/parity-probe.mjs                       # 全部 22 路由，1440 与 375
 *   node web/scripts/parity-probe.mjs /overview /employees   # 只跑指定路由
 *   ONLY=/work W=1440 H=1000 node web/scripts/parity-probe.mjs
 *
 * 环境：
 *   BASE  默认 http://127.0.0.1:9122
 *   AUTH  默认 docs/_artifacts/parity-own/storageState.json（Playwright 形状）
 *   OUT   默认 docs/_artifacts/parity-probe
 *
 * 闸（任一红即视为该页不可验收）：
 *   tablists > 1    一屏只允许一排 tab，且只能由外壳拥有
 *   ox != 0         横向溢出
 *   fixture > 0     真租户页不许出现示例数据
 *   pageerror > 0   运行时报错
 * 读数（不设闸，供人判密度）：
 *   h1 / svg / cards / dash（破折号 + 未接入 + 待核实 计数）/ textLen / 页高
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const { chromium } = await import(`${REPO}/web/node_modules/playwright/index.mjs`);

const BASE = process.env.BASE || 'http://127.0.0.1:9122';
const AUTH = process.env.AUTH || `${REPO}/docs/_artifacts/parity-own/storageState.json`;
const OUT = process.env.OUT || `${REPO}/docs/_artifacts/parity-probe`;

const ROUTES = [
  ['overview', '/overview'],
  ['overview-usage', '/overview?tab=usage'],
  ['employees', '/employees'],
  ['employees-matrix', '/employees?tab=matrix'],
  ['work', '/work'],
  ['work-runs', '/work?tab=runs'],
  ['approvals', '/approvals'],
  ['approvals-history', '/approvals?tab=history'],
  ['identity', '/identity'],
  ['identity-departments', '/identity?tab=departments'],
  ['identity-roles', '/identity?tab=roles'],
  ['knowledge', '/knowledge'],
  ['knowledge-sources', '/knowledge?tab=sources'],
  ['knowledge-evidence', '/knowledge?tab=evidence'],
  ['capabilities', '/capabilities'],
  ['capabilities-tools', '/capabilities?tab=tools'],
  ['capabilities-models', '/capabilities?tab=models'],
  ['capabilities-channels', '/capabilities?tab=channels'],
  ['system', '/system'],
  ['system-defaults', '/system?tab=defaults'],
  ['system-version', '/system?tab=version'],
  ['system-events', '/system?tab=events'],
];

const only = process.env.ONLY
  ? process.env.ONLY.split(',').map((s) => s.trim()).filter(Boolean)
  : process.argv.slice(2);
// ONLY 既接受路由名（overview、work-runs），也接受真实路径（/employees?tab=matrix）。
// 早前直接把选择项当路径用，导致 `${BASE}overview` 这种非法 URL（全页 LOAD FAIL）。
const byName = new Map(ROUTES.map(([n, p]) => [n, p]));
const targets = only.length
  ? only.map((sel) => {
      if (byName.has(sel)) return [sel, byName.get(sel)];
      if (sel.startsWith('/')) {
        return [sel.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''), sel];
      }
      throw new Error(`ONLY 无法识别：${sel}（用路由名或 /path）`);
    })
  : ROUTES;

const VIEWPORTS = [
  { w: Number(process.env.W || 1440), h: Number(process.env.H || 1000) },
  ...(process.env.SKIP_375 ? [] : [{ w: 375, h: 812 }]),
];

const state = JSON.parse(readFileSync(AUTH, 'utf8'));
mkdirSync(OUT, { recursive: true });

const probe = async (page) =>
  page.evaluate(() => {
    const doc = document.documentElement;
    const txt = document.body.innerText || '';
    const count = (re) => (txt.match(re) || []).length;
    return {
      h1: document.querySelectorAll('h1').length,
      tablists: document.querySelectorAll('[role="tablist"]').length,
      svg: document.querySelectorAll('svg').length,
      cards: document.querySelectorAll('.card,[class*="console-card"],[class*="ov5-c"]').length,
      fixture: document.querySelectorAll('[data-fixture]').length,
      dash: count(/—/g) + count(/未接入/g) + count(/待核实/g),
      pageH: Math.max(doc.scrollHeight, document.body.scrollHeight),
      ox: Math.max(0, doc.scrollWidth - doc.clientWidth),
      textLen: txt.length,
      head: txt.slice(0, 160).replace(/\s+/g, ' '),
    };
  });

const browser = await chromium.launch({ channel: 'chrome' });
const rows = [];
for (const { w, h } of VIEWPORTS) {
  const ctx = await browser.newContext({
    storageState: state,
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
  });
  for (const [name, path] of targets) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
    let r;
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // 等「出数」而不是定长等待：正文不再含「读取中」且长度连续两次不变才算稳定。
      let prev = -1;
      let stable = 0;
      await page.waitForTimeout(1500);
      for (let i = 0; i < 38; i += 1) {
        await page.waitForTimeout(400);
        const snap = await page.evaluate(() => {
          const t = document.body.innerText || '';
          return { len: t.length, busy: /读取中|正在读/.test(t) };
        });
        if (snap.len === prev && !snap.busy) stable += 1;
        else stable = 0;
        prev = snap.len;
        if (stable >= 2) break;
      }
      r = await probe(page);
      r.settlePolls = prev >= 0 ? 'ok' : 'none';
    } catch (e) {
      r = { error: String(e).slice(0, 120) };
    }
    // TALL=1：控制台的正文在内部滚动壳里，document 高恒等于视口高 ⇒ fullPage 是 no-op。
    // 取「最深可滚动容器」的 scrollHeight 把视口撑到整页高再拍，才能拿到首屏以下的证据。
    if (process.env.TALL && !r.error) {
      try {
        const inner = await page.evaluate(() => {
          let best = 0;
          for (const el of document.querySelectorAll('*')) {
            const s = getComputedStyle(el);
            if (!/auto|scroll/.test(s.overflowY)) continue;
            if (el.scrollHeight > el.clientHeight + 8) best = Math.max(best, el.scrollHeight);
          }
          return Math.min(best + 80, 6000);
        });
        if (inner > h + 40) {
          await page.setViewportSize({ width: w, height: inner });
          await page.waitForTimeout(700);
          r.tall = inner;
        }
      } catch {
        r.tallFailed = true;
      }
    }
    const shot = `${OUT}/${name}-${w}.png`;
    try {
      await page.screenshot({ path: shot, fullPage: true, timeout: 20000 });
    } catch {
      r.shotFailed = true;
    }
    const gate = [];
    if (r.error) gate.push('LOAD');
    if ((r.tablists ?? 0) > 1) gate.push(`TABS=${r.tablists}`);
    if ((r.ox ?? 0) > 0) gate.push(`OX=${r.ox}`);
    if ((r.fixture ?? 0) > 0) gate.push(`FIXTURE=${r.fixture}`);
    if (errors.length) gate.push(`ERR=${errors.length}`);
    rows.push({ name, w, ...r, errors: errors.slice(0, 3), shot, gate: gate.join(' ') || 'PASS' });
    console.log(
      `${gate.length ? 'FAIL' : 'PASS'} ${name.padEnd(22)} @${w}  ` +
        `tabs=${r.tablists} h1=${r.h1} svg=${r.svg} dash=${r.dash} len=${r.textLen} h=${r.pageH}` +
        (gate.length ? `  ⟵ ${gate.join(' ')}` : ''),
    );
    await page.close();
  }
  await ctx.close();
}
await browser.close();

writeFileSync(`${OUT}/probe.json`, JSON.stringify(rows, null, 1));
const bad = rows.filter((r) => r.gate !== 'PASS');
console.log(`\n闸：${rows.length - bad.length} PASS / ${bad.length} FAIL  → ${OUT}/probe.json`);