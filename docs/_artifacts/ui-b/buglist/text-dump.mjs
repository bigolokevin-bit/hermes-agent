// text-dump.mjs — 指定页 main 全文导出（buglist 证据用）。用法: node text-dump.mjs [BASE]
import { chromium } from "/Users/kevin_studio/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const BASE = process.argv[2] || "http://127.0.0.1:9122";
const ROUTES = ["knowledge", "capabilities?tab=channels", "identity", "models", "system?tab=version", "metrics", "sessions", "matrix", "overview?tab=usage", "runs", "work"];
let cookie = null;
try {
  const st = JSON.parse(readFileSync("/Users/kevin_studio/.local/state/sekoi-ops/ui-qa-auth-state.json", "utf8"));
  const v = st.access_token_cookie || (Array.isArray(st.cookies) && (st.cookies.find((c) => c.name === "access_token_cookie") || {}).value);
  if (v) cookie = { name: "access_token_cookie", value: v, url: BASE, httpOnly: true, sameSite: "Lax", secure: false };
} catch {}
const browser = await chromium.launch({ headless: true });
let out = "";
for (const route of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (cookie) await ctx.addCookies([cookie]);
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + "/" + route, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(6000);
    const txt = await page.evaluate(() => { const m = document.querySelector("main") || document.body; return (m.innerText || "").replace(/\n{3,}/g, "\n\n").trim(); });
    out += "\n===== " + route + " =====\n" + txt.slice(0, 1800) + "\n";
  } catch (e) { out += "\n===== " + route + " ERR " + e.message + "\n"; }
  await ctx.close();
}
writeFileSync(new URL("./text-dump.txt", import.meta.url), out);
await browser.close();
console.log("DUMPED " + ROUTES.length);
