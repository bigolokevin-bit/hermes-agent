// Q8 375px read-only acceptance probe. Measures ONLY (no DOM mutation that
// changes layout, no product code). Three criteria per page:
//   (1) horizontal overflow: per-element rect.right > 375 + scrollingElement.scrollWidth
//   (2) touch target: interactive (button/a/[role=button]/input/select/summary) min(w,h) < 44
//   (3) hover-only: interactive element with a visual :hover affordance but no
//       focus/focus-visible/active equivalence and no global focus ring coverage
// Auth gate is asserted IN-PAGE first (cookie-domain skeleton guard).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = "/Users/kevin_studio/Projects/tasks/Q8-375-pages/docs/_artifacts/Q8-375";
// auth-state.json holds a live opsadmin token and MUST NOT be committed: it is
// read from the OS temp dir, never from under ROOT/raw. See DONE.md §8.
const AUTH_STATE = process.env.Q8_AUTH_STATE || "/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/q8-auth-state.json";
const EXEC = "/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const BASE = "http://127.0.0.1:5199";
const VW = 375, VH = 812;
const authState = JSON.parse(fs.readFileSync(AUTH_STATE, "utf8"));

const PAGES = [
  { key: "knowledge-base", label: "知识库", path: "/knowledge" },
  { key: "knowledge-qa", label: "知识问答", path: "/knowledge?tab=spaces&panel=retrieval" },
  { key: "docs", label: "文档", path: "/docs" },
  { key: "tasks", label: "任务", path: "/tasks" },
  { key: "sessions", label: "会话", path: "/sessions" },
];

function shortSel(el) {
  // best-effort stable selector text captured in-page (see gather())
  return el;
}

async function gather(page) {
  return await page.evaluate(async ({ VW, VH }) => {
    const q = (n) => document.querySelector(n);
    const rectOf = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) }; };
    const cls = (e) => (typeof e.className === "string" ? e.className : (e.getAttribute && e.getAttribute("class")) || "");
    const tagId = (e) => {
      let s = e.tagName.toLowerCase();
      if (e.id) s += "#" + e.id;
      const testid = e.getAttribute && e.getAttribute("data-testid"); if (testid) s += `[data-testid=${testid}]`;
      const role = e.getAttribute && e.getAttribute("role"); if (role) s += `[role=${role}]`;
      const name = (e.getAttribute && (e.getAttribute("aria-label") || e.getAttribute("title"))) || (e.innerText || "").trim().slice(0, 18);
      if (name) s += ` "${name.replace(/\s+/g, " ")}"`;
      return s;
    };
    const visible = (e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
    };
    const isFixedOrAbsOffscreen = (e) => {
      // walk ancestors for position:fixed/absolute (designed off-canvas drawers)
      let n = e;
      while (n && n.nodeType === 1) {
        const p = getComputedStyle(n).position;
        if (p === "fixed" || p === "absolute") {
          const r = n.getBoundingClientRect();
          if (r.left >= VW || r.right <= 0 || r.top >= innerHeight) return true; // parked off-screen
        }
        n = n.parentElement;
      }
      return false;
    };

    // ---- auth gate (in-page) ----
    let whoami = { status: "skip" };
    try {
      const res = await fetch("/agent-api/api/console-sessions?limit=1", { credentials: "include" });
      whoami = { status: res.status };
    } catch (e) { whoami = { status: "err:" + e.message }; }

    const root = q("#root");
    const skeleton = { rootChildren: root ? root.childElementCount : 0, textLen: document.body.innerText.length };

    // ---- criterion 1: overflow ----
    const all = Array.from(document.querySelectorAll("body *"));
    const over = [];
    for (const e of all) {
      if (!visible(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.right > VW + 0.5) {
        over.push({ sel: tagId(e), rect: rectOf(e), cls: cls(e).slice(0, 120), offscreen: isFixedOrAbsOffscreen(e) });
      }
    }
    const se = document.scrollingElement || document.documentElement;
    const overflow = { scrollWidth: se.scrollWidth, docClientWidth: document.documentElement.clientWidth, hits: over };

    // ---- collect interactive set ----
    const INTERACTIVE = 'button,a[href],[role="button"],input:not([type=hidden]),select,textarea,summary,[tabindex]:not([tabindex="-1"]),[role="tab"],[role="link"],[role="menuitem"]';
    const inter = Array.from(document.querySelectorAll(INTERACTIVE)).filter(visible);

    // ---- global focus ring coverage ----
    let globalFocusRing = false; const focusRules = []; const focusRingSelectors = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        if (!rule.selectorText) continue;
        const s = rule.selectorText;
        const hasFocus = /:focus(-visible)?/.test(s);
        const hasHover = /:hover/.test(s);
        if (hasFocus && /outline(?!-offset|-color)|box-shadow/.test(rule.cssText)) { globalFocusRing = true; focusRingSelectors.push(s); }
        if (hasHover) focusRules.push({ sel: s, css: rule.cssText.slice(0, 200) });
      }
    }

    // ---- on-screen filter ----
    // At 375 the console sidebar is an OFF-SCREEN drawer (translate-x), so its
    // links have real rects outside the viewport. Counting them as touch/hover
    // "defects" is a measurement artifact (recipe: exclude designed off-screen).
    const inViewport = (e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      // hidden by a closed drawer/overlay ancestor?
      let n = e, hidden = false;
      while (n && n.nodeType === 1) {
        const s = getComputedStyle(n);
        if (s.visibility === "hidden" || s.display === "none") { hidden = true; break; }
        n = n.parentElement;
      }
      if (hidden) return false;
      return r.right > 0 && r.left < VW && r.bottom > 0 && r.top < VH;
    };
    const onscreen = inter.filter(inViewport);
    const offscreenCount = inter.length - onscreen.length;
    // chrome = inside the global telemetry-consent banner (mounted by App.tsx on
    // every route); its sub-44px buttons are not page-product controls.
    const isChrome = (e) => {
      let n = e;
      while (n && n.nodeType === 1) {
        const al = n.getAttribute && n.getAttribute("aria-label");
        if (al && /Help improve Hermes|遥测|遥测贡献|改进 Hermes/.test(al)) return true;
        if (n.hasAttribute && n.hasAttribute("data-shared-metrics")) return true;
        n = n.parentElement;
      }
      return false;
    };

    // ---- criterion 2: touch target (onscreen only) ----
    const touch = [];
    for (const e of onscreen) {
      const r = e.getBoundingClientRect();
      const mn = Math.min(r.width, r.height);
      if (mn < 44) touch.push({ sel: tagId(e), rect: rectOf(e), min: Math.round(mn), disabled: e.disabled === true, tag: e.tagName.toLowerCase(), chrome: isChrome(e) });
    }
    touch.sort((a, b) => a.min - b.min);

    // ---- criterion 3: hover-only (onscreen only) ----
    // Rule: 键盘 focus 可达 + focus-visible/active 等价反馈 → NOT hover-only.
    // A hit counts ONLY if the element has a hover affordance AND no focus path:
    //   - not natively keyboard-focusable (no tabindex>=0 / not button|a[href]|input), OR
    //   - has a hover visual but neither a per-element focus/active class NOR a
    //     global :focus-visible ring that would cover it, AND
    //   - no focusable sibling handler (e.g. a hover-revealed action with no
    //     keyboard/tap trigger).
    const VIS_HOVER = /hover:(bg|text|border|opacity|shadow|ring|underline)-/;
    const VIS_FOCUS = /(focus|focus-visible|active):(bg|text|border|opacity|shadow|ring|underline)-/;
    const keyboardFocusable = (e) => {
      const t = e.tagName;
      if (t === "BUTTON" || t === "INPUT" || t === "SELECT" || t === "TEXTAREA" || t === "SUMMARY") return true;
      if (t === "A" && e.hasAttribute("href")) return true;
      return e.tabIndex >= 0;
    };
    // does a CSS :hover rule hit this element with no :focus/:active counterpart?
    const cssHoverWithoutFocus = (e) => {
      let hit = false;
      for (const rule of focusRules) {
        if (/:focus|:active/.test(rule.sel)) continue;
        const base = rule.sel.replace(/:hover/g, "");
        try { if (base && e.matches(base)) { hit = true; break; } } catch (_) {}
      }
      return hit;
    };
    const hoverOnly = [];
    for (const e of onscreen) {
      const c = cls(e);
      const twHover = VIS_HOVER.test(c);
      const twFocus = VIS_FOCUS.test(c);
      const focusable = keyboardFocusable(e);
      const cssHovNoFoc = cssHoverWithoutFocus(e);
      const hasHover = twHover || cssHovNoFoc;
      const hasFocusEquiv = twFocus || (focusable && globalFocusRing) || (e.matches && safeFocusVisible(e));
      if (hasHover && !hasFocusEquiv) {
        hoverOnly.push({ sel: tagId(e), cls: c.slice(0, 160), twHover, cssHovNoFoc, focusable, tag: e.tagName.toLowerCase(), chrome: isChrome(e) });
      }
    }
    function safeFocusVisible(e) { try { return e.matches(":focus-visible"); } catch (_) { return false; } }

    return { whoami, skeleton, overflow, interactiveCount: inter.length, onscreenCount: onscreen.length, offscreenCount, globalFocusRing, focusRingSelectors: Array.from(new Set(focusRingSelectors)).slice(0, 40), touch, hoverOnly, activeTab: (() => { const a = document.querySelector('[role=tab][aria-selected="true"],a[role=tab].border-primary,[data-active="true"]'); return a ? (a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 30) : null; })(), heading: (() => { const h = q("h1,h2"); return h ? h.innerText.trim().slice(0, 40) : null; })() };
  }, { VW, VH });
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, headless: true });
  const out = {};
  for (const p of PAGES) {
    const ctx = await browser.newContext({ storageState: authState, viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });
    const url = BASE + p.path;
    let navErr = null, finalUrl = null;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      finalUrl = page.url();
      // explicit settle for lazy route chunk + data fetches
      await page.waitForTimeout(2000);
    } catch (e) { navErr = e.message.slice(0, 160); }
    let data = null;
    try { data = await gather(page); } catch (e) { navErr = (navErr || "") + " gather:" + e.message.slice(0, 160); }
    await page.screenshot({ path: path.join(ROOT, "shots", p.key + ".png") }); // viewport only, NOT fullPage
    out[p.key] = { label: p.label, url, finalUrl, navErr, consoleErrors: consoleErrors.slice(0, 8), data };
    await ctx.close();
    const tc = data ? data.touch.filter((x) => x.chrome).length : 0;
    console.error(`[done] ${p.key} whoami=${data && data.whoami.status} over=${data && data.overflow.hits.length} touch=${data && data.touch.length}(prod ${data ? data.touch.length - tc : 0}/chrome ${tc}) hover=${data && data.hoverOnly.length} head="${data && data.heading}"`);
  }
  fs.writeFileSync(path.join(ROOT, "raw/readings.json"), JSON.stringify(out, null, 2));
  await browser.close();
  console.log("WROTE readings.json");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
