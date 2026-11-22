// scan.mjs — UI-B bug 清扫取证爬虫（L0 战略直令 C 车道，2026-11-22）
// 用法: node scan.mjs [BASE]（默认 http://127.0.0.1:9122，登录态取 ui-qa-auth-state.json）
// 每页 × {1440, 375} 两档：真实等待 → 采集 console error / HTTP>=400 / 逐元素越界
// （判据 right<=vw+1 且 left>=-1；负 x 的离屏抽屉项单独归类）/ 原生 select 数 / mainTextLen，
// 并用「撑高内部滚动壳」法出真 fullPage 截图到 shots/。输出 SCAN 行 + scan.json。
import { chromium } from "/Users/kevin_studio/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || "http://127.0.0.1:9122";
const ROUTES = [
  "overview", "overview?tab=duty", "overview?tab=usage", "employees", "approvals",
  "audit", "runs", "knowledge", "matrix", "capabilities?tab=skills",
  "capabilities?tab=channels", "system", "system?tab=version", "sessions",
  "metrics", "identity", "work", "models",
];
const OUT = join(HERE, "shots");
mkdirSync(OUT, { recursive: true });

let cookie = null;
try {
  const st = JSON.parse(readFileSync("/Users/kevin_studio/.local/state/sekoi-ops/ui-qa-auth-state.json", "utf8"));
  const v = st.access_token_cookie
    || (Array.isArray(st.cookies) && (st.cookies.find((c) => c.name === "access_token_cookie") || {}).value);
  if (v) cookie = { name: "access_token_cookie", value: v, url: BASE, httpOnly: true, sameSite: "Lax", secure: false };
} catch (e) { console.log("COOKIE-ERR " + e.message); }

const browser = await chromium.launch({ headless: true });
const results = [];
for (const route of ROUTES) {
  for (const vw of [1440, 375]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 } });
    if (cookie) await ctx.addCookies([cookie]);
    const page = await ctx.newPage();
    const errors = [];
    const badHttp = {};
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
    page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 200)));
    page.on("response", (r) => { if (r.status() >= 400) { const k = r.status() + " " + r.url().replace(BASE, "").split("?")[0]; badHttp[k] = (badHttp[k] || 0) + 1; } });
    const slug = route.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    let rec = { route, vw };
    try {
      await page.goto(BASE + "/" + route, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(7000); // 真实等待：数据腿+渲染落定
      rec = { ...rec, ...(await page.evaluate((vw) => {
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
        return {
          mainTextLen: txt.length, mainTextHead: txt.slice(0, 50),
          nativeSelects: document.querySelectorAll("select").length,
          clipViolations: clip.slice(0, 25), clipCount: clip.length, offcanvasCount: offcanvas.length,
        };
      }, vw));
      // 真 fullPage：撑高内部滚动壳后整页截图
      const h = await page.evaluate(() => {
        let max = 0, best = null;
        document.querySelectorAll("*").forEach((el) => {
          if (el.scrollHeight > el.clientHeight + 50 && el.clientHeight > 200) {
            const cs = getComputedStyle(el);
            if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > max) { max = el.scrollHeight; best = el; }
          }
        });
        if (best) { best.style.height = max + "px"; best.style.maxHeight = "none"; best.style.overflow = "visible"; }
        document.documentElement.style.height = "auto";
        document.body.style.height = "auto";
        document.body.style.overflow = "visible";
        return Math.min(Math.max(document.documentElement.scrollHeight, max) + 60, 9000);
      });
      await page.setViewportSize({ width: vw, height: h });
      await page.waitForTimeout(500);
      const file = `${slug}@${vw}.png`;
      await page.screenshot({ path: join(OUT, file), fullPage: true });
      rec.shot = "shots/" + file;
    } catch (e) {
      rec.err = String(e).slice(0, 160);
    }
    const uniqErrs = [...new Set(errors)];
    rec.consoleErrors = uniqErrs.length;
    rec.consoleErrorSamples = uniqErrs.slice(0, 4);
    rec.badHttp = Object.entries(badHttp).sort((a, b) => b[1] - a[1]).slice(0, 8);
    results.push(rec);
    console.log("SCAN " + JSON.stringify(rec));
    await ctx.close();
  }
}
writeFileSync(join(HERE, "scan.json"), JSON.stringify({ base: BASE, entry: (() => { try { return (readFileSync(join(OUT, "..", "entry.txt"), "utf8") || "").trim(); } catch { return "CCLAG-mZ(见下)"; } })(), at: new Date().toISOString(), results }, null, 1));
await browser.close();
console.log("DONE " + results.length);
