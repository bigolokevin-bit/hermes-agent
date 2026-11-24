import { chromium } from "/Users/kevin_studio/Projects/forks/hermes-agent/web/node_modules/playwright/index.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:9122";
const suffix = process.env.SUFFIX ?? "";
const shots = [
  ["work", 1440, 900, `board-1440${suffix}.png`],
  ["work?tab=runs", 1440, 900, `runs-1440${suffix}.png`],
  ["work", 375, 812, `board-375${suffix}.png`],
  ["work?tab=runs", 375, 812, `runs-375${suffix}.png`],
];

const browser = await chromium.launch({ channel: "chrome" });
for (const [path, w, h, file] of shots) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    storageState: "docs/_artifacts/parity-own/storageState.json",
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const url = `${BASE}/#/${path}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="tsk4-columns"], [data-testid="run5-row-0"]') !== null,
    undefined,
    { timeout: 20000 },
  );
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => ({
    tablists: document.querySelectorAll('[role="tablist"]').length,
    tablistsInModule: document.querySelectorAll('[data-testid="tsk4-board"] [role="tablist"], [data-testid="run5-page"] [role="tablist"]').length,
    h1: document.querySelectorAll("h1").length,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    cards: document.querySelectorAll(".console-card").length,
    text: (document.querySelector("main")?.innerText || "").slice(0, 400),
  }));
  console.log(file, JSON.stringify(info));
  await page.screenshot({ path: `docs/_artifacts/work-parity/${file}`, timeout: 30000 });
  await ctx.close();
}
await browser.close();