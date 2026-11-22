// reshoot-tall.mjs — audit@375 / runs@375 超 9000px 真 fullPage 补拍（scan.mjs clamp 上限证据缺口）
import { chromium } from "/Users/kevin_studio/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
const BASE = process.argv[2] || "http://127.0.0.1:9122";
const st = JSON.parse(readFileSync("/Users/kevin_studio/.local/state/sekoi-ops/ui-qa-auth-state.json", "utf8"));
const cv = st.access_token_cookie || (st.cookies || []).find(c => c.name === "access_token_cookie")?.value;
const browser = await chromium.launch({ headless: true });
for (const route of ["audit", "runs"]) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 900 } });
  if (cv) await ctx.addCookies([{ name: "access_token_cookie", value: cv, url: BASE, httpOnly: true, sameSite: "Lax", secure: false }]);
  const page = await ctx.newPage();
  await page.goto(BASE + "/" + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(7000);
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
    return Math.max(document.documentElement.scrollHeight, max) + 80;
  });
  let hh = Math.min(h, 21000);
  await page.setViewportSize({ width: 375, height: hh });
  await page.waitForTimeout(600);
  const slug = route;
  await page.screenshot({ path: `docs/_artifacts/ui-b/buglist/shots/${slug}@375-tall.png`, fullPage: true });
  console.log("RESHOOT " + route + " h=" + hh);
  await ctx.close();
}
await browser.close();
