import { test, expect } from "@playwright/test";

/**
 * lane-D e2e — IA smoke over the 8 modules x 22 visible tabs.
 *
 * DATA SOURCE: the 22 rows below are the `visible: true` entries of the frozen
 * route table in `web/src/shell/routes.ts` (CONSOLE_TABS, PRD v4.1 appendix A
 * rows 1-22; the +1 hidden 详情 pane is excluded, exactly like the 22-tab count
 * asserted by `web/scripts/assert-ia.mjs`). Module grouping = routes.ts
 * `module` field; tab grouping = module `manifest.ts` `tabs[]`. If lane A
 * changes a route, that file is the source of truth and this table follows it —
 * the counts (8 modules / 22 tabs) are the contract, not this copy.
 *
 * RUNTIME STATE (lane-D handoff, do not silently "fix"):
 *  - `@playwright/test` is NOT a dependency of this fork (checked:
 *    `node -e require.resolve('@playwright/test')` from web/ -> MODULE_NOT_FOUND;
 *    nothing in web/package.json or the root package.json declares it).
 *    The spec is delivered as specified; the run leg is reported TOOL_MISSING.
 *    Adding the dependency is a lane-orchestrator decision (it changes
 *    package.json / pnpm-lock, both outside this lane's write domain).
 *  - Four-state selectors are PLACEHOLDER-LOOSE until the lane-A shell lands
 *    `data-state` (see fourStateSelector below).
 *  - 9119 currently serves the pre-shell Hermes dashboard build; the hash
 *    routes below are the shell forms, so expect failures until stage 2 mounts
 *    AppShell — that is the point of this gate.
 */

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://127.0.0.1:9119";

/**
 * Hash-route form (the PRD appendix A literal). NOTE: routes.ts carries both
 * `hash` and `path` forms, and web/src/main.tsx mounts a BrowserRouter — if the
 * shell ends up browser-routing only, switch BASE to `${BASE_URL}${path}`; the
 * 22-tab / 8-module contract stays identical. Probed first: `${BASE_URL}/#/overview`.
 */
const tabUrl = (hash: string): string => `${BASE_URL}/${hash}`;

type Tab = { readonly module: string; readonly tabId: string; readonly hash: string; readonly label: string };

const TABS: readonly Tab[] = [
  { module: "overview", tabId: "duty", hash: "#/overview", label: "值班台" },
  { module: "overview", tabId: "usage", hash: "#/overview?tab=usage", label: "用量与成本" },
  { module: "employees", tabId: "list", hash: "#/employees", label: "列表" },
  { module: "employees", tabId: "matrix", hash: "#/employees?tab=matrix", label: "能力与权限" },
  { module: "work", tabId: "board", hash: "#/work", label: "任务" },
  { module: "work", tabId: "runs", hash: "#/work?tab=runs", label: "运行" },
  { module: "approvals", tabId: "pending", hash: "#/approvals", label: "待处理" },
  { module: "approvals", tabId: "history", hash: "#/approvals?tab=history", label: "历史决策" },
  { module: "identity", tabId: "people", hash: "#/identity", label: "人员目录" },
  { module: "identity", tabId: "departments", hash: "#/identity?tab=departments", label: "组织与部门" },
  { module: "identity", tabId: "roles", hash: "#/identity?tab=roles", label: "角色与权限" },
  { module: "knowledge", tabId: "spaces", hash: "#/knowledge", label: "知识空间" },
  { module: "knowledge", tabId: "sources", hash: "#/knowledge?tab=sources", label: "数据源" },
  { module: "knowledge", tabId: "evidence", hash: "#/knowledge?tab=evidence", label: "证据与引用" },
  { module: "capabilities", tabId: "skills", hash: "#/capabilities", label: "技能" },
  { module: "capabilities", tabId: "tools", hash: "#/capabilities?tab=tools", label: "工具与 MCP" },
  { module: "capabilities", tabId: "models", hash: "#/capabilities?tab=models", label: "模型与单价" },
  { module: "capabilities", tabId: "channels", hash: "#/capabilities?tab=channels", label: "平台接入" },
  { module: "system", tabId: "health", hash: "#/system", label: "系统健康" },
  { module: "system", tabId: "defaults", hash: "#/system?tab=defaults", label: "默认设置" },
  { module: "system", tabId: "version", hash: "#/system?tab=version", label: "版本" },
  { module: "system", tabId: "events", hash: "#/system?tab=events", label: "审计事件" },
] as const;

const MODULES = [...new Set(TABS.map((t) => t.module))];

/**
 * PLACEHOLDER selector — to be pinned when lane A's shell lands.
 * Contract wanted: every pane renders exactly one element carrying
 * `data-state="loading" | "ready" | "empty" | "error"` (the four states), and
 * this becomes a hard `expect(pane).toHaveAttribute("data-state", /…/)`.
 * Accepted today, loosely and in this order: the data-state attribute in any
 * spelling, the equivalent aria/role markers, and the honest 规划中 placeholder
 * wording the skeleton uses for unwired data sources. Deliberately tolerant so
 * a missing shell shows up as "0/22 four-state hits" rather than a crash.
 */
const FOUR_STATES = ["loading", "ready", "empty", "error"] as const;
const fourStateSelector = `[data-state], [data-console-state], [data-view-state], [role="status"], [aria-live="polite"], .state-empty, .state-error`;

/** Console noise that is not a page defect. Keep empty unless justified. */
const IGNORED_CONSOLE_ERRORS: readonly RegExp[] = [];

test("ia-smoke: 8/8 modules and 22/22 tabs reachable, 0 console errors, four-state per pane", async ({ browser }) => {
  expect(MODULES).toHaveLength(8);
  expect(TABS).toHaveLength(22);

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED_CONSOLE_ERRORS.some((re) => re.test(text))) return;
    consoleErrors.push(text.slice(0, 400));
  });
  page.on("pageerror", (err) => {
    const text = String(err && err.stack ? err.stack : err);
    if (IGNORED_CONSOLE_ERRORS.some((re) => re.test(text))) return;
    consoleErrors.push(text.slice(0, 400));
  });

  const unreachable: string[] = [];
  const noFourState: string[] = [];
  const reachableModules = new Set<string>();

  for (const tab of TABS) {
    const url = tabUrl(tab.hash);
    let response = null;
    try {
      response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForTimeout(250); // hashchange -> route render settle
    } catch (error) {
      unreachable.push(`${url} (${String(error).slice(0, 120)})`);
      continue;
    }

    const status = response?.status() ?? 0;
    // A hash route always returns the shell document; a non-2xx means the
    // server is not answering at all, which is not an IA problem.
    if (status >= 500) {
      unreachable.push(`${url} HTTP ${status}`);
      continue;
    }

    const stateHits = await page
      .locator(fourStateSelector)
      .evaluateAll((els) =>
        els
          .map((el) =>
            (
              el.getAttribute("data-state") ??
              el.getAttribute("data-console-state") ??
              el.getAttribute("data-view-state") ??
              ""
            ).trim(),
          )
          .filter((v) => v.length > 0),
      )
      .catch(() => [] as string[]);

    const hasSemanticState = FOUR_STATES.some((s) => stateHits.some((hit) => hit === s));
    const hasAnyState = stateHits.length > 0;
    const placeholderCount = await page.getByText("规划中").count();
    const ariaStateCount = await page.locator('[role="status"], [aria-live="polite"]').count();

    if (!(hasSemanticState || hasAnyState || placeholderCount > 0 || ariaStateCount > 0)) {
      noFourState.push(`${tab.module}.${tab.tabId} ${url} states=${JSON.stringify(stateHits)}`);
      continue;
    }
    reachableModules.add(tab.module);
  }

  expect(unreachable, `unreachable tabs: ${unreachable.join(" | ")}`).toEqual([]);
  expect(noFourState, `panes with no four-state marker: ${noFourState.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toHaveLength(0);
  expect(reachableModules.size, `modules reachable: ${reachableModules.size}/8`).toBe(8);
  expect(TABS.length, "tabs probed: 22/22").toBe(22);

  await context.close();
});

test("ia-smoke: probe the documented first hash route before anything else", async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/#/overview`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  expect(response?.ok() ?? false, `GET ${BASE_URL}/#/overview -> HTTP ${response?.status() ?? "no response"}`).toBe(true);
});
