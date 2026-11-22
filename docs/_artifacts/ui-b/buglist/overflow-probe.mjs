// overflow-probe.mjs — 定向验证：①metrics/system@375 越界元素是否有 overflow-x 壳可滚达；②sessions「NaN」可见性；③metrics 顶部数据源注记是否可见
import { chromium } from "/Users/kevin_studio/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
const BASE = process.argv[2] || "http://127.0.0.1:9122";
let cookie = null;
try {
  const st = JSON.parse(readFileSync("/Users/kevin_studio/.local/state/sekoi-ops/ui-qa-auth-state.json", "utf8"));
  const v = st.access_token_cookie || (Array.isArray(st.cookies) && (st.cookies.find((c) => c.name === "access_token_cookie") || {}).value);
  if (v) cookie = { name: "access_token_cookie", value: v, url: BASE, httpOnly: true, sameSite: "Lax", secure: false };
} catch {}
const browser = await chromium.launch({ headless: true });
const mk = async (route, vw) => {
  const ctx = await browser.newContext({ viewport: { width: vw, height: 900 } });
  if (cookie) await ctx.addCookies([cookie]);
  const page = await ctx.newPage();
  await page.goto(BASE + "/" + route, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(6000);
  return { ctx, page };
};
// ① metrics@375: heat cell + sys-row-copy 祖先滚动壳检查
{
  const { ctx, page } = await mk("metrics", 375);
  const r = await page.evaluate(() => {
    const probe = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return { sel, missing: true };
      const rect = el.getBoundingClientRect();
      let anc = el.parentElement, shell = null, docScroll = document.scrollingElement.scrollWidth;
      while (anc) {
        const cs = getComputedStyle(anc);
        if (/(auto|scroll)/.test(cs.overflowX)) { shell = { tag: anc.tagName, tid: anc.getAttribute("data-testid"), scrollW: anc.scrollWidth, clientW: anc.clientWidth, canScroll: anc.scrollWidth > anc.clientWidth }; break; }
        anc = anc.parentElement;
      }
      return { sel, rect: [Math.round(rect.left), Math.round(rect.right)], shell, docScroll, pageHScrollable: document.scrollingElement.scrollWidth > innerWidth + 1 };
    };
    return { heat: probe("[data-testid^='met6-heat-cell']"), copy: probe("[data-testid='sys-row-copy-0'], [id*='sys-row-copy']"), rowsNote: (document.querySelector("main")?.innerText || "").includes("合计：该窗口无可渲染行") };
  });
  console.log("METRICS375 " + JSON.stringify(r));
  await ctx.close();
}
{
  const { ctx, page } = await mk("system", 375);
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll("[data-testid^='sys-row-copy']")];
    return els.slice(0, 3).map((el) => {
      const rect = el.getBoundingClientRect();
      let anc = el.parentElement, shell = null;
      while (anc) { const cs = getComputedStyle(anc); if (/(auto|scroll)/.test(cs.overflowX)) { shell = { tid: anc.getAttribute("data-testid"), scrollW: anc.scrollWidth, clientW: anc.clientWidth }; break; } anc = anc.parentElement; }
      return { rect: [Math.round(rect.left), Math.round(rect.right)], shell, pageHScrollable: document.scrollingElement.scrollWidth > innerWidth + 1 };
    });
  });
  console.log("SYSTEM375 " + JSON.stringify(r));
  await ctx.close();
}
{
  const { ctx, page } = await mk("sessions", 1440);
  const r = await page.evaluate(() => {
    const hits = [];
    document.querySelectorAll("*").forEach((el) => {
      if (el.children.length === 0 && /NaN/.test(el.textContent || "")) {
        const cs = getComputedStyle(el); const rect = el.getBoundingClientRect();
        hits.push({ text: el.textContent.trim().slice(0, 60), tid: el.getAttribute("data-testid"), visible: cs.display !== "none" && cs.visibility !== "hidden" && rect.width > 0 && rect.height > 0, rect: [Math.round(rect.left), Math.round(rect.top)] });
      }
    });
    const cards = document.querySelectorAll("[data-testid*='session']").length;
    return { hits: hits.slice(0, 6), cardCount: cards };
  });
  console.log("SESSIONS1440 " + JSON.stringify(r));
  await ctx.close();
}
// ③ metrics 顶部「跳到主要内容」与数据源注记块可见性
{
  const { ctx, page } = await mk("metrics", 1440);
  const r = await page.evaluate(() => {
    const vis = (el) => { if (!el) return "missing"; const cs = getComputedStyle(el); const rect = el.getBoundingClientRect(); return { display: cs.display, vis: cs.visibility, clip: cs.clip, w: Math.round(rect.width), h: Math.round(rect.height), top: Math.round(rect.top) }; };
    const skip = document.querySelector("a") && [...document.querySelectorAll("a")].find((a) => (a.textContent || "").includes("跳到主要内容"));
    const src = [...document.querySelectorAll("p,div,section")].find((el) => el.children.length === 0 && (el.textContent || "").includes("/api/run-activity"));
    return { skip: vis(skip), srcNote: vis(src), srcNoteTop: src ? (src.closest("details") ? "inside-details" : "direct") : null };
  });
  console.log("METRICS1440VIS " + JSON.stringify(r));
  await ctx.close();
}
await browser.close();
console.log("PROBE-DONE");
