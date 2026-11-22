#!/usr/bin/env node
// L0 P0 判据纠偏令（2026-11-21，wave-124 基线 8a21b712）：375 溢出+截图腿的新判据载体。
//
// 为什么存在：旧截图/溢出腿（docs/_artifacts/tonight/shots.mjs，本车道无写域）的
// 溢出判据是 DOM 级 `de.scrollWidth - de.clientWidth`（:333/:342），且截图
// fullPage:false（:358/:372）。App.tsx 根容器 overflow-x-hidden 使 DOM 级读数
// 恒 ≤0 —— 375「无横向溢出」假绿坐实：知识页刷新按钮/seg 右列、系统页「编辑探…」
// 实被裁；四页 375 素材高恰 812，只捕首屏；matrix 375 整张缺失。
//
// 新判据（L0 令原文，逐条落实）：
//  ① 逐元素：每个可见元素 boundingRect.right <= 375+1 且 left >= -1；
//     可滚动容器（overflow-x: auto|scroll）单独查 scrollWidth <= clientWidth；
//     DOM 级 scrollWidth 只作辅助读数（domOverflowPx）报告，永不签绿。
//     wave-150 判据修复（L0 令，UI-KD 撤回件 f8c9c229 坐实）：越界元素按最近
//     可滚祖先拆两路——位于「自带 overflow-x:auto|scroll 且 scrollWidth>clientWidth
//     的真滚壳」内者记 violInsideScrollableShell（rubric 表格豁免=容器内滚动，合规，
//     只记录不判红）；壳外者记 violOutsideShell，只有后者判 FAIL。禁放宽成恒真：
//     壳必须真的能滚（scrollWidth>clientWidth+1），文档级溢出 domOverflowPx 照常报数。
//  ② 截图 fullPage:true，且产图高度必须 > 视口高（812）；否则该页 375 腿记
//     NOT_MEASURED，不许签绿（恰 812 = 只捕首屏的可疑形态）。
//     回退：内部滚动壳（h-screen + overflow-y:auto 面板）使文档恒 812；
//     先临时撑开全部纵向滚动容器（运行时 DOM 改写，不动产品码）再重拍，
//     仍 ≤812 才记 NOT_MEASURED。
//  可见性细化：完全推出画布左侧（right≤1，如收起的抽屉）无横向可见性，
//  不计违规，另记 offscreenLeft；左缘违规只算"部分可见却被裁"。
//  判定次序：逐元素违规独立于截图质量 —— FAIL 优先于 NOT_MEASURED。
//  ③ matrix（#/employees?tab=matrix，#/matrix 的重定向目标）375 必须产图；
//     缺失/零字节 = 红灯，整腿不绿。
//
// 运行形态沿用同仓既有仪器（不重发明）：playwright 由兄弟检出绝对路径 require
// （本仓 node_modules 无 playwright，禁碰 package.json/lockfile），chromium 取
// ~/Library/Caches/ms-playwright 已下载副本；路由表从 web/src/shell/routes.ts 静态
// 解析（与 crawl-routes/shots 同一套 stripComments/balanced/arrayObjects）；
// 导航用「单次 hash 形态直导」（静态根只保证 '/' 200）；登录态 --auth-state
// storageState，缺省注 gated 标志防匿名 reload 风暴；main 文本稳定轮询 4s。
//
// 用法：
//   node web/scripts/assert-375.mjs --base=http://127.0.0.1:9122 \
//     --auth-state=~/.local/state/sekoi-ops/ui-qa-auth-state.json \
//     [--out=<png/汇总目录>] [--only-routes='#/knowledge,#/system'] [--smoke]
// 产物（--out 目录下）：assert375/<slug>-375.png · assert-375-summary.json ·
//   assert-375-index.md（均先写 .tmp.<pid> 再 renameSync 原子替换，账本纪律）。
// 退出码：0 = 全腿 PASS 且 matrix 有图；1 = 任一 FAIL / NOT_MEASURED / matrix 缺图。

import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, writeFileSync, statSync, renameSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REPO = path.resolve(new URL('.', import.meta.url).pathname, '../..');
const ROUTES_TS = path.join(REPO, 'web/src/shell/routes.ts');

const atomicWrite = (file, text) => {
  const tmp = `${file}.tmp.${process.pid}`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
};

const argVal = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3) || null;
const OUT_DIR = argVal('out') || path.join(os.tmpdir(), 'opencode', 'assert-375');
const ONLY_ROUTES = argVal('only-routes');
const AUTH_STATE = argVal('auth-state')?.replace(/^~/, os.homedir()) || null;
const BASE = argVal('base') || 'http://127.0.0.1:9122';
const SMOKE = process.argv.includes('--smoke');
const SHOTS = path.join(OUT_DIR, 'assert375');

const PW_HOST = '/Users/kevin_studio/Projects/seakoi-console-web/package.json';
const CHROMIUM = path.join(
  process.env.HOME || '',
  'Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/' +
    'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
);

const VW = 375;
const VH = 812;
const MATRIX_HASH = '#/employees?tab=matrix';

mkdirSync(SHOTS, { recursive: true });

// --- routes.ts 解析（与 shots.mjs 同一套机制，内联以保证自包含） --------------

function stripComments(text) {
  let out = '';
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += text[i + 1];
        i += 1;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      const end = nl === -1 ? text.length : nl;
      out += text.slice(i, end).replace(/[^\n]/g, ' ');
      i = end - 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      const end = close === -1 ? text.length : close + 2;
      out += text.slice(i, end).replace(/[^\n]/g, ' ');
      i = end - 1;
      continue;
    }
    out += c;
  }
  return out;
}

function balanced(src, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '[' || c === '{' || c === '(') depth += 1;
    else if (c === ']' || c === '}' || c === ')') {
      depth -= 1;
      if (depth === 0) return [src.slice(open, i + 1), i + 1];
    }
  }
  return [src.slice(open), src.length];
}

function arrayObjects(src, name) {
  const at = src.search(new RegExp(`\\b(?:export\\s+)?const\\s+${name}\\b`));
  if (at === -1) return [];
  const assign = /=\s*\[/.exec(src.slice(at));
  if (!assign) return [];
  const open = at + assign.index + assign[0].length - 1;
  const [body] = balanced(src, open);
  const out = [];
  let depth = 0;
  let quote = null;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') {
      if (depth === 1) {
        const [text] = balanced(body, i);
        out.push(text);
        i += text.length - 1;
        continue;
      }
      depth += 1;
    } else if (c === '[' || c === '(') depth += 1;
    else if (c === ']' || c === '}' || c === ')') depth -= 1;
  }
  return out;
}

const hashOf = (o) => {
  const m = /\bhash\s*:\s*(['"`])([^'"`]*)\1/.exec(o);
  return m ? m[2] : null;
};
const labelOf = (o) => {
  const m = /\blabel\s*:\s*(['"`])([^'"`]*)\1/.exec(o);
  return m ? m[2] : null;
};

const src = stripComments(readFileSync(ROUTES_TS, 'utf8'));
const rows = [];
for (const name of ['CONSOLE_TABS', 'DETAIL_ZONES_EXTRA', 'VIEW_DEEP_LINKS', 'COMPAT_TABS', 'COMPAT_MODULES']) {
  for (const o of arrayObjects(src, name)) {
    const hash = hashOf(o);
    if (hash) rows.push({ source: name, hash, label: labelOf(o) });
  }
}
{
  const at = src.search(/\b(?:export\s+)?const\s+DETAIL_TAB\b/);
  if (at !== -1) {
    const assign = /=\s*\{/.exec(src.slice(at));
    const open = at + assign.index + assign[0].length - 1;
    const [obj] = balanced(src, open);
    const hash = hashOf(obj);
    if (hash) rows.push({ source: 'DETAIL_TAB', hash, label: labelOf(obj) });
  }
}
rows.sort((a, b) => a.hash.localeCompare(b.hash));

const slugOf = (hash) =>
  hash
    .replace(/^#\//, '')
    .replace(/[/:?=&]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-') || 'root';

let target = SMOKE ? rows.slice(0, 3) : rows;
if (ONLY_ROUTES) {
  const want = ONLY_ROUTES.split(',').map((s) => s.trim()).filter(Boolean);
  target = target.filter((r) => want.some((w) => r.hash === w || r.hash.startsWith(`${w}?`)));
}

// --- 375 判据探针 -------------------------------------------------------------

const PROBE = (VW_) => {
  const viol = [];
  const scrollOverflow = [];
  let checked = 0;
  let offscreenLeft = 0;
  let insideShell = 0;
  const de = document.documentElement;
  // 最近可滚祖先（wave-150）：overflow-x auto|scroll 且内容真能横滚才算壳
  const shellOf = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      if (/(auto|scroll)/.test(pcs.overflowX) && p.scrollWidth > p.clientWidth + 1) return p;
    }
    return null;
  };
  for (const el of document.querySelectorAll('body *')) {
    if (!el.isConnected) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) continue;
    checked += 1;
    const rec = {
      tag: el.tagName.toLowerCase(),
      tid: el.getAttribute('data-testid') || '',
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 80),
      left: Math.round(r.left),
      right: Math.round(r.right),
      w: Math.round(r.width),
      txt: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40),
    };
    if (r.right <= 1) {
      offscreenLeft += 1; // 完全出画布（收起抽屉），无横向可见性，不计违规
    } else if (r.right > VW_ + 1 || r.left < -1) {
      const shell = shellOf(el);
      if (shell) {
        insideShell += 1; // 真滚壳内越界 = rubric 表格豁免，只记录不判红
        viol.push({
          ...rec,
          inShell: 1,
          shellTid: shell.getAttribute('data-testid') || '',
          shellCls: (typeof shell.className === 'string' ? shell.className : '').slice(0, 60),
        });
      } else {
        viol.push({ ...rec, inShell: 0 });
      }
    }
    const ox = cs.overflowX;
    if (/(auto|scroll)/.test(ox) && el.scrollWidth > el.clientWidth + 1) {
      scrollOverflow.push({ ...rec, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflowX: ox });
    }
  }
  return {
    checked,
    offscreenLeft,
    violCount: viol.length,
    violInsideScrollableShell: insideShell, // wave-150：壳内只记录，不判红
    violOutsideShell: viol.length - insideShell, // 只有壳外判 FAIL
    viol: viol.slice(0, 30),
    scrollOverflowCount: scrollOverflow.length,
    scrollOverflow: scrollOverflow.slice(0, 30),
    domOverflowPx: de.scrollWidth - de.clientWidth, // 旧判据读数：只作辅助对照，永不签绿
  };
};

const pngDims = (file) => {
  const buf = readFileSync(file);
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
};

// --- run ----------------------------------------------------------------------

const req = createRequire(PW_HOST);
const { chromium } = req('playwright');
const browser = await chromium.launch({ executablePath: CHROMIUM });
const ENV_NOISE_RE = /\b(401|404)\s*\((Unauthorized|Not Found)\)/;
const GATED_FLAG_INIT = () => {
  window.__HERMES_AUTH_REQUIRED__ = true;
};

// L0 令 151 牙齿自检：ASSERT375_TEETH=1 时在 body 级注入 600px 宽元素（无任何可滚壳祖先），
// 走同一 PROBE + 同一判据梯子，必须得 violOutsideShell>=1 且 verdict=FAIL——
// 用来区分「壳内被正确分流」与「探针丢了判定维度」。正常跑不设此 env 即零影响。
const TEETH = process.env.ASSERT375_TEETH === '1';
const TEETH_INIT = () => {
  const put = () => {
    if (document.querySelector('[data-selftest="teeth-600"]')) return;
    const d = document.createElement('div');
    d.setAttribute('data-selftest', 'teeth-600');
    d.style.cssText = 'width:600px;height:8px';
    document.body.appendChild(d);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put, { once: true });
  else put();
};

// L0 令 151 缺失即 NM 兜底：violOutsideShell 非数字（undefined/null）时禁静默放绿——
// JS 里 null > 0 === false，字段丢了会假 PASS；一律判 NOT_MEASURED 并记因。
const criteriaMissing = (probe) => probe !== null && typeof probe.violOutsideShell !== 'number';

const index = [];
let red = 0;
let notMeasured = 0;

for (const row of target) {
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    ...(AUTH_STATE ? { storageState: AUTH_STATE } : {}),
  });
  if (!AUTH_STATE) await ctx.addInitScript(GATED_FLAG_INIT);
  if (TEETH) await ctx.addInitScript(TEETH_INIT);
  const page = await ctx.newPage();
  let consoleErrorsProduct = 0;
  page.on('console', (m) => {
    if (m.type() === 'error' && !ENV_NOISE_RE.test(m.text().slice(0, 160))) consoleErrorsProduct += 1;
  });
  page.on('pageerror', () => {
    consoleErrorsProduct += 1;
  });

  let navError = null;
  let mainLen = 0;
  try {
    const h = row.hash.startsWith('#') ? row.hash : `#${row.hash}`;
    // 模板路由代入在岗真实 ID（L0：EMP-01/EMP-02 现网可用）
    const nav = h.includes(':employeeId') ? h.replace(':employeeId', 'EMP-01') : h;
    await page.goto(`${BASE}/${nav}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    let prev = -1;
    const t0 = Date.now();
    while (Date.now() - t0 < 4000) {
      await page.waitForTimeout(150);
      mainLen = await page
        .evaluate(() => (document.querySelector('main')?.innerText || '').trim().length)
        .catch(() => 0);
      if (mainLen > 0 && mainLen === prev) break;
      prev = mainLen;
    }
  } catch (e) {
    navError = String(e.message ?? e).slice(0, 160);
  }

  const file = path.join(SHOTS, `${slugOf(row.hash)}-375.png`);
  let verdict;
  let probe = null;
  let dims = null;
  let bytes = 0;
  let expanded = false;
  let scrollerCount = 0;
  let contentFit = false; // 视口加高回退后实测内容高 <= 视口：整页已在一帧内
  let targetHeight = null; // 视口加高法目标高（null=未触发）

  if (navError || mainLen === 0) {
    verdict = 'NOT_MEASURED';
    notMeasured += 1;
  } else {
    probe = await page.evaluate(PROBE, VW).catch(() => null);
    try {
      await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => false);
      try {
        await page.screenshot({ path: file, fullPage: true, timeout: 60_000 });
      } catch {
        await page.screenshot({ path: file, fullPage: true, timeout: 60_000 });
      }
      bytes = statSync(file).size;
      dims = pngDims(file);
      // 判据②回退·视口加高法（记忆配方）：宽度不动，视口高度抬到实测内容高再重拍；
      // 抬高后仍 <=812 = 文档级无溢出且内容本就在折叠下——逐元素判据照常裁决，
      // 内容完整可见时按 fit 记录（证据仍为首屏高，如实入表）
      if (dims && dims.h <= VH) {
        const grow = await page.evaluate(() => {
          const de = document.documentElement;
          const b = document.body;
          const force = (el) => {
            el.style.setProperty('overflow', 'visible', 'important');
            el.style.setProperty('height', 'auto', 'important');
            el.style.setProperty('max-height', 'none', 'important');
            el.style.setProperty('min-height', '0', 'important');
          };
          force(de);
          force(b);
          const rootEl = document.getElementById('root');
          if (rootEl) force(rootEl);
          let required = de.scrollHeight;
          let scrollers = 0;
          for (const el of document.querySelectorAll('body *')) {
            const cs = getComputedStyle(el);
            if (!/(auto|scroll)/.test(cs.overflowY)) continue;
            if (el.scrollHeight <= el.clientHeight + 1) continue;
            force(el);
            let p = el.parentElement;
            while (p && p !== de) {
              force(p);
              p = p.parentElement;
            }
            scrollers += 1;
            required = Math.max(required, el.scrollHeight + (window.innerHeight - el.clientHeight));
          }
          return { required: Math.min(required, 10_000), scrollers };
        }).catch(() => null);
        if (grow && grow.required > VH) {
          expanded = true;
          scrollerCount = grow.scrollers;
          targetHeight = grow.required;
          try {
            await page.setViewportSize({ width: VW, height: grow.required });
            await page.waitForTimeout(400);
            await page.screenshot({ path: file, fullPage: true, timeout: 60_000 });
            bytes = statSync(file).size;
            dims = pngDims(file);
          } catch {
            /* 保留首拍 */
          }
        } else if (grow) {
          expanded = true;
          scrollerCount = grow.scrollers;
          targetHeight = grow.required;
          contentFit = true; // 展开后实测内容高 <= 视口：整页已在一帧内
        }
      }
    } catch (e) {
      dims = null;
      navError = navError || `screenshot: ${String(e.message ?? e).slice(0, 120)}`;
    }
    if (probe && probe.violOutsideShell > 0) { // wave-150（L0 令）：只判壳外违规；真滚壳内=表格豁免仍记录，滚动壳明细仍入账
      // 逐元素违规独立于截图质量：FAIL 优先于 NOT_MEASURED
      verdict = 'FAIL';
      red += 1;
    } else if (criteriaMissing(probe)) {
      // L0 令 151：判据字段缺失＝探针丢了维度，禁静默 PASS，判 NOT_MEASURED 并记因
      verdict = 'NOT_MEASURED';
      notMeasured += 1;
      navError = navError || 'criteria-field-missing: violOutsideShell not numeric';
    } else if (!probe || !dims) {
      verdict = 'NOT_MEASURED';
      notMeasured += 1;
    } else if (dims.h <= VH && contentFit) {
      // 视口加高法后实测内容高 <= 视口：整页已在一帧内，逐元素判据照常生效；
      // fit 如实入表（pngH==812 但无折叠内容），不属『旧 document 级假绿』家族
      verdict = 'PASS';
    } else if (dims.h <= VH) {
      // 判据②：产图高度必须 > 视口高（含视口加高回退后），恰 812 且非 fit = 不签绿
      verdict = 'NOT_MEASURED';
      notMeasured += 1;
    } else {
      verdict = 'PASS';
    }
  }

  // 字体等待旁路复测腿（L0 授权「字体等待绕过腿」，只动脚本不动产品）：
  // 截图死于 font/Timeout 时，另开一个 fresh context，用 route 拦掉字体文件让
  // 挂起的 @font-face 立即落定，再按同一判据梯子复测；判据阈值不变、FAIL 优先不变。
  let fontBypass = false;
  if (verdict === 'NOT_MEASURED' && !dims && mainLen > 0 && navError && /Timeout|font/i.test(navError)) {
    fontBypass = true;
    try {
      const fbCtx = await browser.newContext({
        viewport: { width: VW, height: VH },
        ...(AUTH_STATE ? { storageState: AUTH_STATE } : {}),
      });
      if (!AUTH_STATE) await fbCtx.addInitScript(GATED_FLAG_INIT);
      if (TEETH) await fbCtx.addInitScript(TEETH_INIT);
      await fbCtx.route('**/*', (route) => {
        const u = route.request().url();
        if (/\.(?:woff2?|ttf|otf|eot)(?:[?#]|$)/i.test(u)) {
          void route.abort();
        } else {
          void route.continue();
        }
      });
      const fbPage = await fbCtx.newPage();
      const fbH = row.hash.startsWith('#') ? row.hash : `#${row.hash}`;
      const fbNav = fbH.includes(':employeeId') ? fbH.replace(':employeeId', 'EMP-01') : fbH;
      await fbPage.goto(`${BASE}/${fbNav}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      let fbPrev = -1;
      const fbT0 = Date.now();
      while (Date.now() - fbT0 < 4000) {
        await fbPage.waitForTimeout(150);
        const l = await fbPage
          .evaluate(() => (document.querySelector('main')?.innerText || '').trim().length)
          .catch(() => 0);
        if (l > 0 && l === fbPrev) {
          mainLen = l;
          break;
        }
        fbPrev = l;
      }
      probe = await fbPage.evaluate(PROBE, VW).catch(() => null);
      await fbPage.evaluate(() => document.fonts.ready.then(() => true)).catch(() => false);
      await fbPage.screenshot({ path: file, fullPage: true, timeout: 45_000 });
      bytes = statSync(file).size;
      dims = pngDims(file);
      if (dims && dims.h <= VH) {
        const grow = await fbPage
          .evaluate(() => {
            const de = document.documentElement;
            const force = (el) => {
              el.style.setProperty('overflow', 'visible', 'important');
              el.style.setProperty('height', 'auto', 'important');
              el.style.setProperty('max-height', 'none', 'important');
              el.style.setProperty('min-height', '0', 'important');
            };
            force(de);
            force(document.body);
            const rootEl = document.getElementById('root');
            if (rootEl) force(rootEl);
            let required = de.scrollHeight;
            let scrollers = 0;
            for (const el of document.querySelectorAll('body *')) {
              const cs = getComputedStyle(el);
              if (!/(auto|scroll)/.test(cs.overflowY)) continue;
              if (el.scrollHeight <= el.clientHeight + 1) continue;
              force(el);
              let p = el.parentElement;
              while (p && p !== de) {
                force(p);
                p = p.parentElement;
              }
              scrollers += 1;
              required = Math.max(required, el.scrollHeight + (window.innerHeight - el.clientHeight));
            }
            return { required: Math.min(required, 10_000), scrollers };
          })
          .catch(() => null);
        if (grow && grow.required > VH) {
          expanded = true;
          scrollerCount = grow.scrollers;
          targetHeight = grow.required;
          try {
            await fbPage.setViewportSize({ width: VW, height: grow.required });
            await fbPage.waitForTimeout(400);
            await fbPage.screenshot({ path: file, fullPage: true, timeout: 45_000 });
            bytes = statSync(file).size;
            dims = pngDims(file);
          } catch {
            /* 保留复测腿首拍 */
          }
        } else if (grow) {
          expanded = true;
          scrollerCount = grow.scrollers;
          targetHeight = grow.required;
          contentFit = true;
        }
      }
      navError = null;
      await fbCtx.close();
    } catch (e) {
      navError = `font-bypass: ${String(e.message ?? e).slice(0, 140)}`;
    }
    // 撤销原 NM 计数，按同一判据梯子重判（FAIL 优先）
    notMeasured -= 1;
    if (probe && probe.violOutsideShell > 0) { // wave-150（L0 令）：只判壳外违规；真滚壳内=表格豁免仍记录，滚动壳明细仍入账
      verdict = 'FAIL';
      red += 1;
    } else if (criteriaMissing(probe)) {
      // L0 令 151：判据字段缺失＝探针丢了维度，禁静默 PASS，判 NOT_MEASURED 并记因
      verdict = 'NOT_MEASURED';
      notMeasured += 1;
      navError = navError || 'criteria-field-missing: violOutsideShell not numeric';
    } else if (!probe || !dims) {
      verdict = 'NOT_MEASURED';
      notMeasured += 1;
    } else if (dims.h <= VH && contentFit) {
      verdict = 'PASS';
    } else if (dims.h <= VH) {
      verdict = 'NOT_MEASURED';
      notMeasured += 1;
    } else {
      verdict = 'PASS';
    }
  }

  index.push({
    hash: row.hash,
    label: row.label,
    source: row.source,
    viewport: '375',
    verdict,
    mainTextLen: mainLen,
    navError,
    png: path.basename(file),
    pngBytes: bytes,
    pngW: dims ? dims.w : null,
    pngH: dims ? dims.h : null,
    elementsChecked: probe ? probe.checked : null,
    offscreenLeft: probe ? probe.offscreenLeft : null,
    expandApplied: expanded,
    scrollersExpanded: scrollerCount,
    contentFit,
    targetHeight, // 视口加高法目标高（null=未触发）
    violCount: probe ? probe.violCount : null,
    violInsideScrollableShell: probe ? probe.violInsideScrollableShell : null,
    violOutsideShell: probe ? probe.violOutsideShell : null,
    viol: probe ? probe.viol : [],
    scrollOverflowCount: probe ? probe.scrollOverflowCount : null,
    scrollOverflow: probe ? probe.scrollOverflow : [],
    domOverflowPx: probe ? probe.domOverflowPx : null, // 旧判据辅助对照位
    fontBypass,
    consoleErrorsProduct,
  });
  await ctx.close();
}

await browser.close();

// 判据③：matrix 375 必须产图（仅在全覆盖跑里仲裁；--only-routes/--smoke 记 skipped-scope）
const fullScope = !ONLY_ROUTES && !SMOKE;
const matrixRow = index.find((r) => r.hash === MATRIX_HASH);
const matrixPng = matrixRow ? path.join(SHOTS, matrixRow.png) : null;
const matrixOk = fullScope
  ? Boolean(matrixRow && matrixRow.verdict !== 'NOT_MEASURED' && matrixPng && statSync(matrixPng).size > 0)
  : null;

const summary = {
  schema: 'assert-375/1',
  base: BASE,
  authState: AUTH_STATE ? 'provided' : 'gated-flag-anon',
  criteria: {
    perElement: 'right<=376 && left>=-1 for every visible element; inside a genuinely scrollable overflow-x shell recorded as violInsideScrollableShell, only violOutsideShell FAILs (wave-150); violOutsideShell 非数字判 NOT_MEASURED 禁静默 PASS（151）',
    scrollContainers: 'scrollWidth<=clientWidth for overflow-x:auto|scroll, reported separately — compliant shell-scroll evidence, does not FAIL; 退出判红依据＝UI-RUBRIC「表格除外且须有容器内滚动」（wave-150/151）',
    teethSelftest: TEETH ? 'ASSERT375_TEETH=1：body 级注入 width:600px 元素（data-selftest=teeth-600，无可滚壳祖先），同一梯子必须判壳外违规' : null,
    domScrollWidth: 'auxiliary only (domOverflowPx column), never greens a page',
    shot: 'fullPage:true && pngH>812 else NOT_MEASURED',
    matrix: fullScope ? 'required png, nonzero' : 'skipped-scope',
  },
  routes: index.length,
  pass: index.filter((r) => r.verdict === 'PASS').length,
  fail: red,
  notMeasured,
  matrixHash: MATRIX_HASH,
  matrixPresent: Boolean(matrixRow),
  matrixOk,
  rows: index,
};

atomicWrite(path.join(OUT_DIR, 'assert-375-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
atomicWrite(
  path.join(OUT_DIR, 'assert-375-index.md'),
  [
    '# assert-375 index（L0 P0 判据纠偏令 · 新判据）',
    '',
    '| route | verdict | viol(out/in) | scrollOvf | domOvf(旧) | pngH | main |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...index.map(
      (r) =>
        `| ${r.hash} | ${r.verdict} | ${(r.violOutsideShell ?? '-') + ' / ' + (r.violInsideScrollableShell ?? '-')} | ${r.scrollOverflowCount ?? '-'} | ${r.domOverflowPx ?? '-'} | ${r.pngH ?? '-'} | ${r.mainTextLen} |`,
    ),
    '',
    `matrix(${MATRIX_HASH}) present=${Boolean(matrixRow)} ok=${matrixOk ?? 'skipped-scope'}`,
    '',
  ].join('\n'),
);

const exitRed = red > 0 || notMeasured > 0 || (fullScope && !matrixOk);
console.log(
  `ASSERT375 routes=${index.length} pass=${summary.pass} fail=${red} notMeasured=${notMeasured} ` +
    `matrixPresent=${Boolean(matrixRow)} matrixOk=${matrixOk ?? 'skipped-scope'} out=${OUT_DIR}`,
);
process.exit(exitRed ? 1 : 0);
