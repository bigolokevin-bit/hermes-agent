// storm-window-probe.mjs — 窗口翻倍判据探针（L0 wave-154 验收口径）
// 用法: node storm-window-probe.mjs [BASE] [route1,route2] [--no-auth]
// 判据: 同一新 context、15s vs 30s 两窗口，nav/401/total 不得随窗口线性翻倍；
//       窗口末 mainTextLen 须 ≥30（aud 骨架闸：skeleton-below-threshold 即 NM）。
// 诊断: 记录 document 导航 URL+时刻、401/200 按 URL 聚合、WS 关闭码、console 错误、
//       窗口末真渲染读数（mainTextLen/骨架节点数/脸 entry 名）。
import { chromium } from "/Users/kevin_studio/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const NO_AUTH = process.argv.includes("--no-auth");
const BASE = args[0] || "http://127.0.0.1:9122";
const ROUTES = (args[1] || "sessions,capabilities?tab=channels").split(",");

let cookie = null;
if (!NO_AUTH) {
  try {
    const st = JSON.parse(readFileSync("/Users/kevin_studio/.local/state/sekoi-ops/ui-qa-auth-state.json", "utf8"));
    // 两种落盘形制都认：{access_token_cookie} 或 playwright cookies 列表
    const v = st.access_token_cookie
      || (Array.isArray(st.cookies) && (st.cookies.find((c) => c.name === "access_token_cookie") || {}).value);
    if (v) {
      cookie = { name: "access_token_cookie", value: v, url: BASE, httpOnly: true, sameSite: "Lax", secure: false };
      console.log("COOKIE=injected(auth-state)");
    } else console.log("COOKIE=none(missing-field)");
  } catch (e) { console.log("COOKIE-ERR " + e.message); }
} else console.log("COOKIE=skipped(--no-auth)");

const browser = await chromium.launch({ headless: true });
async function measure(route, ms) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (cookie) await ctx.addCookies([cookie]);
  const page = await ctx.newPage();
  const t0 = Date.now();
  let navs = 0, http401 = 0, total = 0;
  const byUrl = {};
  const docNavs = [];
  const wsClosed = {};
  const errs = [];
  page.on("framenavigated", (f) => {
    if (f !== page.mainFrame()) return;
    navs++;
    if (docNavs.length < 12) docNavs.push({ t: Date.now() - t0, url: f.url() });
  });
  page.on("response", (r) => {
    total++;
    const s = r.status();
    if (s === 401) http401++;
    const key = r.url().replace(BASE, "").split("?")[0];
    const k = s + " " + key;
    byUrl[k] = (byUrl[k] || 0) + 1;
  });
  page.on("websocket", (ws) => {
    ws.on("close", () => { wsClosed["ws"] = (wsClosed["ws"] || 0) + 1; });
  });
  page.on("console", (m) => { if (m.type() === "error" && errs.length < 5) errs.push(m.text().slice(0, 160)); });
  let entry = "?";
  try {
    const html = await (await fetch(BASE + "/agent-v2/")).text();
    entry = (html.match(/assets\/index-[^"]+\.js/) || ["?"])[0];
  } catch {}
  try { await page.goto(BASE + "/" + route, { waitUntil: "domcontentloaded" }); } catch {}
  await new Promise((r) => setTimeout(r, ms));
  // 窗口末真渲染读数（aud 骨架闸同口径：main 的可见文本长度 + 骨架节点数）
  let render = {};
  try {
    render = await page.evaluate(() => {
      const main = document.querySelector("main") || document.body;
      const txt = (main.innerText || "").replace(/\s+/g, " ").trim();
      const skel = document.querySelectorAll("[class*=skeleton],[data-testid*=skeleton],[aria-busy=true]").length;
      return { mainTextLen: txt.length, mainTextHead: txt.slice(0, 60), skeletonNodes: skel };
    });
  } catch (e) { render = { renderErr: String(e).slice(0, 120) }; }
  await ctx.close();
  return { route, windowS: Math.round(ms / 1000), navs, http401, total, entry, ...render, byUrlTop: Object.entries(byUrl).sort((a, b) => b[1] - a[1]).slice(0, 10), docNavs, wsClosed, errs };
}
for (const route of ROUTES) {
  for (const ms of [15000, 30000]) {
    const out = await measure(route, ms);
    console.log("STORM " + JSON.stringify(out));
  }
}
await browser.close();
console.log("DONE");
