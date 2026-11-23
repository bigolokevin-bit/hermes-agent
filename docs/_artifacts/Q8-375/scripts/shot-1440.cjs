// FIX-Q8: 1440 full-height evidence shots for the five high-frequency pages.
// Measurement + screenshots only; NO product code, NO DOM mutation that changes layout.
// Recipe (per in-book pitfalls):
//  - face = vite dev 5199 serving THIS tree (merged to current face), /agent-api -> :9122
//  - goto waitUntil domcontentloaded (networkidle never converges on this face)
//  - explicit settle 1800ms; goto/screenshot each carry their own timeout
//  - auth asserted IN-PAGE immediately before each shot: console-sessions must be 200
//    (unauthenticated baseline is 401; skeleton-with-401 = cookie early-decay artifact)
//  - real full height via VIEWPORT-HEIGHTENING: measure max(doc scrollHeight, scroll
//    shell top+scrollHeight), resize viewport to that height, then plain viewport
//    screenshot. fullPage is a known no-op + timeout-hazard family on this face.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = "/Users/kevin_studio/Projects/tasks/Q8-375-pages/docs/_artifacts/Q8-375";
const AUTH_STATE = process.env.Q8_AUTH_STATE || "/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/q8-auth-state.json";
const EXEC = "/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const BASE = "http://127.0.0.1:5199";
const VW = 1440, VH0 = 900, VMAX = 6000;
const OUTDIR = path.join(ROOT, "shots-1440");
fs.mkdirSync(OUTDIR, { recursive: true });

const PAGES = [
  { key: "knowledge-base", label: "知识库", path: "/knowledge" },
  { key: "knowledge-qa", label: "知识问答", path: "/knowledge?tab=spaces&panel=retrieval" },
  { key: "docs", label: "文档", path: "/docs" },
  { key: "tasks", label: "任务", path: "/tasks" },
  { key: "sessions", label: "会话", path: "/sessions" },
];

const MEASURE_FN = () => {
  const se = document.scrollingElement || document.documentElement;
  const docH = Math.max(se.scrollHeight, document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  let shellH = 0;
  for (const e of Array.from(document.querySelectorAll("*"))) {
    if (e.scrollHeight > e.clientHeight + 8 && e.clientHeight > 200) {
      const cs = getComputedStyle(e);
      if (/(auto|scroll)/.test(cs.overflowY)) {
        const top = e.getBoundingClientRect().top + window.scrollY;
        shellH = Math.max(shellH, Math.ceil(top + e.scrollHeight));
      }
    }
  }
  return { docH, shellH, inner: { w: window.innerWidth, h: window.innerHeight } };
};

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length };
}

(async () => {
  const authState = JSON.parse(fs.readFileSync(AUTH_STATE, "utf8"));
  const browser = await chromium.launch({ executablePath: EXEC });
  const ctx = await browser.newContext({ storageState: authState, viewport: { width: VW, height: VH0 }, deviceScaleFactor: 1 });
  const readings = [];
  for (const p of PAGES) {
    const page = await ctx.newPage();
    const rec = { key: p.key, label: p.label, url: BASE + p.path };
    try {
      await page.goto(BASE + p.path, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1800);
      rec.whoami = await page.evaluate(async () => {
        try { const r = await fetch("/agent-api/api/console-sessions?limit=1", { credentials: "include" }); return r.status; }
        catch (e) { return "err:" + e.message; }
      });
      if (rec.whoami !== 200) throw new Error("auth-gate: whoami=" + rec.whoami);
      const m = await page.evaluate(MEASURE_FN);
      rec.measured = m;
      const H = Math.min(Math.max(m.docH, m.shellH) + 60, VMAX);
      rec.shotViewport = { w: VW, h: H };
      await page.setViewportSize({ width: VW, height: H });
      await page.waitForTimeout(1500);
      const m2 = await page.evaluate(MEASURE_FN); // post-resize: content must fit (no clipped scroll)
      rec.afterResize = m2;
      rec.fitsViewport = m2.docH <= H + 2 && m2.shellH <= H + 2;
      const file = path.join(OUTDIR, p.key + ".png");
      await page.screenshot({ path: file, timeout: 60000 }); // viewport shot, NOT fullPage
      rec.png = pngSize(file);
      rec.status = "OK";
    } catch (e) {
      rec.status = "FAIL";
      rec.error = String(e && e.message ? e.message : e).slice(0, 300);
    }
    readings.push(rec);
    console.log(p.key, rec.status, JSON.stringify({ whoami: rec.whoami, fits: rec.fitsViewport, view: rec.shotViewport, png: rec.png, err: rec.error }));
    await page.close();
  }
  fs.writeFileSync(path.join(ROOT, "raw", "readings-1440.json"), JSON.stringify(readings, null, 2));
  await browser.close();
  const bad = readings.filter((r) => r.status !== "OK");
  console.log(bad.length ? "VERIFY_FAILED " + bad.map((b) => b.key + ":" + b.error).join(" | ") : "ALL_OK");
  process.exit(bad.length ? 1 : 0);
})();
