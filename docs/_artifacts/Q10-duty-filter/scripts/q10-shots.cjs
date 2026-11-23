// Q10 duty-filter-parity before/after evidence shots (viewport 1440 & 375).
// Recipe reused from Q8 probe legs: vite dev face + /agent-api proxy to 9122,
// opsadmin cookie domain rewritten to 127.0.0.1, whoami==200 asserted IN-PAGE
// right before every shot (401 baseline — unauthenticated = fake skeleton).
// fullPage first; this shell scrolls internally, so fullPage is a known no-op
// family here — the tall-viewport shot is the deliverable when
// scrollHeight <= clientHeight, and we record both so the choice is auditable.
// 375 judgment uses the split-shell rule: document-level (outside-shell)
// overflow is RED; overflow inside scrollable containers is recorded only.
const { chromium } = require("/Users/kevin_studio/Projects/tasks/Q10-duty-filter-parity/web/node_modules/playwright");
const fs = require("fs");
const path = require("path");

const ROOT = "/Users/kevin_studio/Projects/tasks/Q10-duty-filter-parity/docs/_artifacts/Q10-duty-filter";
// auth-state.json holds a live opsadmin token and MUST NOT be committed:
// read from the OS temp dir (same file as Q8, same guard).
const AUTH_STATE = process.env.Q10_AUTH_STATE || "/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/q8-auth-state.json";
const EXEC = "/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const BASE = "http://127.0.0.1:5299";
const PAGE = "/overview";
const TAG = process.argv[2] || "before"; // before | after

const authState = JSON.parse(fs.readFileSync(AUTH_STATE, "utf8"));
// cookie domain rewrite (Q8 recipe): point every cookie at 127.0.0.1.
for (const c of authState.cookies || []) c.domain = "127.0.0.1";

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true });
  const out = { tag: TAG, page: PAGE, base: BASE, shots: [], whoami: null, error: null };
  try {
    const ctx = await browser.newContext({ storageState: authState, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(BASE + PAGE, { waitUntil: "domcontentloaded", timeout: 45000 });
    // cold vite module graph can take a beat; settle on the mount marker,
    // then a fixed 2s for data legs (networkidle never converges on this face)
    try {
      await page.waitForSelector('[data-testid="ov6-page"]', { timeout: 30000 });
    } catch (e) { /* record as not mounted below */ }
    await page.waitForTimeout(2000);

    // whoami-equtight assertion — Q8's proven auth leg (401 without the
    // opsadmin cookie: verified by curl on this machine). v4_proxy does not
    // map /agent-api/auth/whoami (404), so we reuse the exact leg Q8 pinned:
    // console-sessions 200 == authenticated; anything else == fake skeleton.
    out.whoami = await page.evaluate(async () => {
      const r = await fetch("/agent-api/api/console-sessions?limit=1", { credentials: "include" });
      return { status: r.status, ok: r.status === 200 };
    });
    if (!out.whoami.ok) {
      out.error = `whoami=${out.whoami.status} — NOT logged in; shots would be fake skeleton, aborting`;
      console.error(out.error);
      await browser.close();
      process.exit(2);
    }

    // duty pane mounted?
    out.dutyMounted = await page.evaluate(() => Boolean(document.querySelector('[data-testid="ov6-page"]')));

    for (const w of [1440, 375]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(400);
      const metrics = await page.evaluate((VW) => {
        const se = document.scrollingElement || document.documentElement;
        const overDoc = se.scrollWidth > VW; // outside-shell overflow = RED (375 split-shell rule)
        return {
          VW,
          scrollWidth: se.scrollWidth,
          scrollHeight: se.scrollHeight,
          clientHeight: se.clientHeight,
          docLevelOverflow: overDoc,
          textLen: document.body.innerText.length,
        };
      }, w);
      const fp = path.join(ROOT, "shots", `q10-duty-${w}-${TAG}-fullpage.png`);
      await page.screenshot({ path: fp, fullPage: true });
      // tall viewport = guaranteed whole-page capture where fullPage no-ops
      await page.setViewportSize({ width: w, height: 2400 });
      await page.waitForTimeout(400);
      const tp = path.join(ROOT, "shots", `q10-duty-${w}-${TAG}-tall.png`);
      await page.screenshot({ path: tp }); // viewport only, NOT fullPage
      out.shots.push({ w, fp: path.relative(ROOT, fp), tp: path.relative(ROOT, tp), metrics });
    }
    await ctx.close();
  } catch (e) {
    out.error = String(e.message).slice(0, 300);
  }
  fs.mkdirSync(path.join(ROOT, "shots"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, `raw-${TAG}-readings.json`), JSON.stringify(out, null, 2));
  await browser.close();
  console.log(`WROTE raw-${TAG}-readings.json`, JSON.stringify(out.shots?.map(s => `${s.w}:doc${s.metrics.docLevelOverflow?"OVER":"ok"},sh${s.metrics.scrollHeight}`) || out.error));
  if (out.error) process.exit(1);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
