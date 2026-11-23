// mega-after.mjs — L0 派单「一页一 sha」五页 after 取证（2026-11-22）
// 用法: node mega-after.mjs [BASE] [OUTDIR]
//   BASE 默认 http://127.0.0.1:4180（本地 build dist 经 preview+forwarder，含 cookie 登录态；
//   9122 现网脸部署滞后，不能代表本车道 build——脸归属以 entry.txt 现算为准）。
// 每页 × {1440,375}：真实等待 7s → console error 计数 → 逐元素越界
//   （判据 right<=vw+1 且 left>=-1；负 x 抽屉类单独记账）→ 定向断言：
//   sessions: main 文本不得含 'NaN'（P0-2）
//   system@375: sys-row-copy-* rect 全在视口内（P0-5 sticky 列）
//   identity: 表头文本入档（P0-4 无值列不得在）
//   evidence/analytics: 迁移后采样 2 个带色元素的 computed color 入档（视觉零差对账用）
// 截图=壳撑高真 fullPage，落 OUTDIR/shots/；读数落 OUTDIR/readings.json + 逐行打印。
// evidence 页经壳层 tab 点击路径到达（冷链深链被 knowledge manifest 归一化改写，见 wave-127 记录）。
import { chromium } from "/Users/kevin_studio/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:4180";
const OUT = process.argv[3] || new URL(".", import.meta.url).pathname;
const SHOTS = join(OUT, "shots");
mkdirSync(SHOTS, { recursive: true });

let cookie = null;
try {
  const st = JSON.parse(readFileSync("/Users/kevin_studio/.local/state/sekoi-ops/ui-qa-auth-state.json", "utf8"));
  const v = st.access_token_cookie
    || (Array.isArray(st.cookies) && (st.cookies.find((c) => c.name === "access_token_cookie") || {}).value);
  if (v) cookie = { name: "access_token_cookie", value: v, url: BASE, httpOnly: true, sameSite: "Lax", secure: false };
} catch (e) { console.log("COOKIE-ERR " + e.message); }

// slug -> { path, clickTab? } ；evidence 需先落 /knowledge 再点壳层 tab
const PAGES = [
  { slug: "sessions", path: "/sessions" },
  { slug: "system", path: "/system" },
  { slug: "identity", path: "/identity" },
  { slug: "evidence", path: "/knowledge", clickTab: "[role='tab'][data-tab='evidence']" },
  { slug: "analytics", path: "/analytics" },
];

const browser = await chromium.launch({ headless: true });
const results = [];
for (const pg of PAGES) {
  for (const vw of [1440, 375]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 } });
    if (cookie) await ctx.addCookies([cookie]);
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
    page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 200)));
    let rec = { slug: pg.slug, vw };
    try {
      await page.goto(BASE + pg.path, { waitUntil: "domcontentloaded", timeout: 30000 });
      if (pg.clickTab) {
        await page.waitForSelector(pg.clickTab, { timeout: 15000 });
        await page.click(pg.clickTab);
        await page.waitForSelector("[data-testid='ev5-page']", { timeout: 15000 }).catch(() => {});
      }
      await page.waitForTimeout(7000);
      try { rec = { ...rec, ...(await page.evaluate((vw) => {
        const nodes = [...document.querySelectorAll("a[href],button,[role='button'],select,input,textarea")];
        const clip = [], offcanvas = [];
        for (const el of nodes) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          const id = el.getAttribute("data-testid") || el.getAttribute("aria-label") || (el.textContent || "").trim().slice(0, 24) || el.tagName;
          if (r.right > vw + 1) clip.push({ id, right: Math.round(r.right), left: Math.round(r.left) });
          else if (r.left < -1) offcanvas.push(id);
        }
        const main = document.querySelector("main") || document.body;
        const txt = (main.innerText || "").replace(/\s+/g, " ").trim();
        // 定向断言
        const hasNaN = /NaN/.test(txt);
        const sysCopy = [...document.querySelectorAll("[data-testid^='sys-row-copy']")].map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.getAttribute("data-testid"), left: Math.round(r.left), right: Math.round(r.right) };
        });
        const headerTxt = [...document.querySelectorAll("main thead, main [role='rowgroup'], main [data-testid$='-head'], main dt")].slice(0, 12).map((el) => (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 60));
        // 迁移采样：主文本前 400 字里带色的 2 个 span 的 computed color
        const sampled = [];
        for (const el of [...main.querySelectorAll("span,div,p")]) {
          const c = getComputedStyle(el).color;
          if (el.textContent && el.textContent.trim().length > 3 && c !== "rgb(0, 0, 0)") {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) { sampled.push({ t: el.textContent.trim().slice(0, 24), color: c, cls: (el.className || "").toString().slice(0, 60) }); if (sampled.length >= 2) break; }
          }
        }
        return { mainTextLen: txt.length, hasNaN, sysCopy, headerTxt, sampled, clipCount: clip.length, clip: clip.slice(0, 8), offCount: offcanvas.length };
      }, vw)) }; } catch (e) { rec.error = String(e).slice(0, 200); }
    // 真 fullPage：撑高内部滚动壳
    try {
      const h = await page.evaluate(() => {
        let best = null, bh = 0;
        for (const el of document.querySelectorAll("*")) {
          if (el.scrollHeight > el.clientHeight + 50 && el.clientHeight > 200 && el.scrollHeight > bh) { bh = el.scrollHeight; best = el; }
        }
        if (best) { best.style.setProperty("height", "auto", "important"); best.style.maxHeight = "none"; best.style.overflow = "visible"; }
        document.documentElement.style.height = "auto";
        document.body.style.height = "auto";
        return Math.max(document.body.scrollHeight, bh);
      });
      await page.setViewportSize({ width: vw, height: Math.min(h + 60, 20000) });
      await page.waitForTimeout(1200);
      const shot = join(SHOTS, pg.slug + "@" + vw + ".png");
      await page.screenshot({ path: shot, fullPage: true });
      rec.png = shot.split("/").pop();
      rec.pngH = await page.evaluate(() => document.body.scrollHeight);
    } catch (e) { rec.shotError = String(e).slice(0, 120); }
    } catch (e) { rec.error = "outer:" + String(e).slice(0, 150); }
    rec.consoleErrors = errors.length;
    rec.errors = [...new Set(errors)].slice(0, 4);
    results.push(rec);
    console.log("MEGA " + JSON.stringify(rec));
    await ctx.close();
  }
}
writeFileSync(join(OUT, "readings.json"), JSON.stringify(results, null, 2));
console.log("DONE " + results.length);
await browser.close();
