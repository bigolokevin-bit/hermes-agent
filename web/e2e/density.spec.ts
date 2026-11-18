import { test, expect } from "@playwright/test";

/**
 * lane-D e2e — horizontal-overflow density gate at three viewports.
 *
 * Same base URL and same frozen route set as ia-smoke.spec.ts. "主要 Tab" is
 * taken literally as the full 22-visible-tab set from
 * `web/src/shell/routes.ts` (CONSOLE_TABS, visible: true) — no subset is
 * hand-picked here, so nothing can be hidden by choosing easy tabs.
 *
 * Assertion per (viewport, tab): document.documentElement.scrollWidth must be
 * <= window.innerWidth, i.e. the pane must not force a horizontal scrollbar.
 * 1px of slack is tolerated for sub-pixel rounding (same rule as
 * `web/scripts/crawl-routes.mjs`, which flags `scrollWidth - clientWidth > 1`).
 *
 * RUNTIME STATE: `@playwright/test` is not a dependency of this fork
 * (MODULE_NOT_FOUND from web/), so this spec is delivered unrun — see the
 * TOOL_MISSING note in ia-smoke.spec.ts and docs/_artifacts/D/DONE.md.
 */

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://127.0.0.1:9119";
const OVERFLOW_TOLERANCE_PX = 1;

const VIEWPORTS = [
  { name: "desktop 1440x900", width: 1440, height: 900 },
  { name: "laptop 1280x720", width: 1280, height: 720 },
  { name: "mobile 375x667", width: 375, height: 667 },
] as const;

/** module / tabId / hash — the 22 visible tabs (routes.ts appendix A rows 1-22). */
const TABS = [
  { module: "overview", tabId: "duty", hash: "#/overview" },
  { module: "overview", tabId: "usage", hash: "#/overview?tab=usage" },
  { module: "employees", tabId: "list", hash: "#/employees" },
  { module: "employees", tabId: "matrix", hash: "#/employees?tab=matrix" },
  { module: "work", tabId: "board", hash: "#/work" },
  { module: "work", tabId: "runs", hash: "#/work?tab=runs" },
  { module: "approvals", tabId: "pending", hash: "#/approvals" },
  { module: "approvals", tabId: "history", hash: "#/approvals?tab=history" },
  { module: "identity", tabId: "people", hash: "#/identity" },
  { module: "identity", tabId: "departments", hash: "#/identity?tab=departments" },
  { module: "identity", tabId: "roles", hash: "#/identity?tab=roles" },
  { module: "knowledge", tabId: "spaces", hash: "#/knowledge" },
  { module: "knowledge", tabId: "sources", hash: "#/knowledge?tab=sources" },
  { module: "knowledge", tabId: "evidence", hash: "#/knowledge?tab=evidence" },
  { module: "capabilities", tabId: "skills", hash: "#/capabilities" },
  { module: "capabilities", tabId: "tools", hash: "#/capabilities?tab=tools" },
  { module: "capabilities", tabId: "models", hash: "#/capabilities?tab=models" },
  { module: "capabilities", tabId: "channels", hash: "#/capabilities?tab=channels" },
  { module: "system", tabId: "health", hash: "#/system" },
  { module: "system", tabId: "defaults", hash: "#/system?tab=defaults" },
  { module: "system", tabId: "version", hash: "#/system?tab=version" },
  { module: "system", tabId: "events", hash: "#/system?tab=events" },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`density @ ${vp.name}`, () => {
    for (const tab of TABS) {
      test(`${tab.module}.${tab.tabId} has no horizontal overflow`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await context.newPage();
        const url = `${BASE_URL}/${tab.hash}`;

        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
        expect(response?.ok() ?? false, `GET ${url} -> HTTP ${response?.status() ?? "no response"}`).toBe(true);
        await page.waitForTimeout(250); // hashchange -> route render settle

        const probe = await page.evaluate(() => {
          const de = document.documentElement;
          return {
            scrollWidth: de.scrollWidth,
            innerWidth: window.innerWidth,
            bodyScrollWidth: document.body ? document.body.scrollWidth : 0,
          };
        });

        expect(
          probe.scrollWidth - probe.innerWidth,
          `${url} @ ${vp.name}: scrollWidth=${probe.scrollWidth} innerWidth=${probe.innerWidth} bodyScrollWidth=${probe.bodyScrollWidth}`,
        ).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);

        await context.close();
      });
    }
  });
}
