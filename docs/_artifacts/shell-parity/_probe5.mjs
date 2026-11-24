import { chromium } from "/Users/kevin_studio/Projects/forks/hermes-agent/web/node_modules/playwright/index.mjs";
const BASE = process.env.BASE || "http://127.0.0.1:9122";
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: "docs/_artifacts/parity-own/storageState.json" });
const page = await ctx.newPage();
await page.goto(`${BASE}/#/overview`, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForFunction(() => document.querySelector(".console-nav-link[aria-current='page']") !== null, undefined, { timeout: 20000 });
await page.waitForTimeout(600);

await page.click('[data-testid="shell-sidebar-collapse"]');
await page.waitForTimeout(700);
await page.waitForFunction(() => {
  const d = document.querySelector("[data-testid='sidebar-rail-identity']");
  return d !== null && !d.classList.contains("is-pending");
}, undefined, { timeout: 15000 }).catch(() => console.log("identity still pending"));
const readout = await page.evaluate(() => {
  const aside = document.querySelector("#app-sidebar");
  const links = Array.from(aside.querySelectorAll(".console-nav-link"));
  const icons = links.map((l) => l.querySelector("svg.console-nav-icon"));
  const cur = aside.querySelector(".console-nav-link[aria-current='page']");
  const iconRects = icons.map((i) => { const r = i.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; });
  return {
    asideW: Math.round(aside.getBoundingClientRect().width),
    navIconCount: icons.length,
    navIconVisible: icons.filter((i) => getComputedStyle(i).display !== "none").length,
    iconRects,
    unselectedColor: getComputedStyle(icons[1]).color,
    selected: { mod: cur?.getAttribute("data-mod"), iconColor: getComputedStyle(cur.querySelector("svg.console-nav-icon")).color, borderLeft: `2px ${getComputedStyle(cur).borderLeftColor}` },
    titles: links.map((l) => l.getAttribute("title")),
    brandLetter: (() => { const el = aside.querySelector(".sidebar-brand-letter"); const r = el.getBoundingClientRect(); return { text: el.textContent, box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }; })(),
    dot: (() => { const el = aside.querySelector("[data-testid='sidebar-rail-identity']"); const r = el.getBoundingClientRect(); return { text: el.textContent, title: el.getAttribute("title"), box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }; })(),
    groupHeadsDisplay: Array.from(aside.querySelectorAll(".console-nav-group-h")).map((g) => getComputedStyle(g).display),
    badgesDisplay: Array.from(aside.querySelectorAll(".console-nav-badge")).map((b) => getComputedStyle(b).display),
    sectionSeparator: (() => { const s = aside.querySelectorAll(".console-nav-section")[1]; return `${getComputedStyle(s).borderTopWidth} ${getComputedStyle(s).borderTopColor}`; })(),
    usageTextVisible: getComputedStyle(aside.querySelector("[data-testid='sidebar-usage-today']")).display,
    ox: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  };
});
console.log("COLLAPSED", JSON.stringify(readout, null, 0));
await page.screenshot({ path: "docs/_artifacts/shell-parity/collapsed-1440.png", timeout: 30000 });
await page.click('[data-testid="shell-sidebar-collapse"]');
await page.waitForTimeout(900);
console.log("EXPANDED", JSON.stringify(await page.evaluate(() => {
  const aside = document.querySelector("#app-sidebar");
  return {
    asideW: Math.round(aside.getBoundingClientRect().width),
    brandTwoLine: aside.querySelector(".sidebar-brand")?.textContent,
    letter: aside.querySelector(".sidebar-brand-letter") ? "present" : "absent",
    navIconVisible: Array.from(aside.querySelectorAll("svg.console-nav-icon")).filter((i) => getComputedStyle(i).display !== "none").length,
    linkTexts: Array.from(aside.querySelectorAll(".console-nav-link")).map((l) => l.innerText.replace(/\n/g, " ").trim()),
    ox: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})));
await page.screenshot({ path: "docs/_artifacts/shell-parity/expanded-1440.png", timeout: 30000 });
await ctx.close(); await browser.close();
