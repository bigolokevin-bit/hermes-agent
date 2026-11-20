// @vitest-environment jsdom
/**
 * R197 — /capabilities 标签与深链的组合护栏（纯测试，零产品码改动）。
 *
 * 先按派工单纪律 `git grep` 现查既有用例（基线 `aa56db15`，上游 tip `1768f36c`）。
 *
 * 已覆盖，本文件不重写（只回证据）：
 *  - ①「深链打开即回填 + 其余筛选参逐字 + 不重取」→ `capabilities.deeplink.test.tsx:130`
 *    「opens the linked row on mount and leaves every other filter param byte-identical」，
 *    与 `:204`「switching the linked row changes only `row`, and there is no page param to reset」。
 *  - ②「切 tab 保参、页码归 1」的页面侧 → `capabilities.filterparity.test.tsx:281`
 *    「q / sort / dir survive the switch, the other tab honours the same q, and coming back
 *    re-renders from cache」+ `:310`「an entry without tab= gets tab=skills written…」；
 *    「页码归 1」在本代没有可归的页码：capabilities 无任何分页参（deeplink :239 的缺席守卫）。
 *  - ③「重挂同 URL 复原同一行集、零新请求」→ `capabilities.deeplink.test.tsx:248`
 *    「re-mounting the same URL restores the same link, filter and row count without reading again」。
 *  - ④「不存在的定位符 → 可读空态、不改写 URL」的同号面 → `capabilities.deeplink.test.tsx:163`
 *    「says a missing link is missing, rewrites nothing, and keeps the capF anchor beside it」，
 *    以及 `capabilities.empty.test.tsx` 的两侧 missing-row 用例。
 *
 * 三处前提与本代产品不符，如实记录（沿 R91/R93/R94/R96/R98/R101/R103/R104 的先例）：
 *  1. `?toolset=` 无人读：`git grep 'toolset=|get("toolset")'` 在基线 `aa56db15` 上只命中
 *     legacy 管理页的 JSX prop `pages/SkillsPage.tsx:713` 与我自己两处测试注释。行定位符的真机制是
 *     `?row=<tab>:<name>`（`capabilities/rowLink.tsx`）。
 *  2. 没有「工具集卡片」也没有「子表」：tools 只有两段列表（`tol5-list` / `tol5-mcp-section`），
 *     唯一的下钻是行详情 `cap7-detail-tools`（R184/R103 已钉）。
 *  3. 没有 `capF` 计数面：`capF-count-*` / `capF-row-*` 全仓零命中，`capF-*` 只是状态锚；
 *     计数活在 `cap4-count-<tab>`(+`-state`) / `cap6-export-count` / `cap-page-scope` / `cap5-scope-note`。
 *     另外能力面只有 skills / tools / models / channels 四个 tab（`shell/routes.ts:173,175,178,181`），
 *     没有 `servers` tab —— MCP 服务是 tools 里的一个分段，不是 tab。
 *
 * 因此本文件只补两处真实缺口（其余只回证据）：
 *  A. 非法 `?tab=` 在能力面的落点：`resolveTab("capabilities", …)` 无别名（`TAB_ALIAS` 没有 capabilities
 *     条目），壳层 `active = tabs.find(...) ?? tabs[0]` 折到第一个 tab；R135 的 `system.filters.test.tsx:223`
 *     只钉过 system 面，能力面此前无人测过，且要连「外部筛选参与行定位符一并保住、URL 一字不改」一起钉。
 *  B. 跨 tab 的行定位符隔离：`rowTargetFor(params, tab)` 只在 `target.tab === tab` 时返回目标
 *     （`rowLink.tsx:28-31`；`SkillsPage.tsx:270-272`、`ToolsPage.tsx:363-365`），所以在 skills 上带
 *     `?row=tools:<真实存在的工具名>` 既不展开、也不报「不在当前列表里」，更不把自己筛成 0 行；反之亦然。
 *     既有用例全部只测同号面（tools 的 row 挂在 tools 上），这条跨面组合是空白。
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock("@/modules/models/fetchJson", () => ({
  fetchJsonStrict: (...args: unknown[]) => api.fetchJsonStrict(...args),
}));
const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const { outlined, ...rest } = props as React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean };
    void outlined;
    return <button {...rest}>{children}</button>;
  },
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

import { ApiError } from "@/lib/api-error";
import { ConsoleModulePage } from "@/shell/console";
import { resolveTab } from "@/shell/routes";
import { SkillsPage, resetSkillsTabState } from "../skills/SkillsPage";
import { ToolsPage } from "../tools/ToolsPage";
import { resetToolsTabState } from "../tools/useToolsData";
import { resetCapabilityCounts } from "./counts";
import { resetTabView } from "./tabView";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SKILL_ITEMS = [
  { skillId: "sk_alpha42", name: "资料整理", scope: "builtin", status: "active", updatedAt: "2026-11-19T05:30:00Z" },
  { skillId: "s2", name: "日报生成", scope: "tenant-shared", status: "active", updatedAt: "2026-11-19T04:00:00Z" },
  { skillId: "s3", name: "周报汇总", scope: "tenant-shared", status: "active", updatedAt: "2026-11-19T04:30:00Z" },
];
const TOOLSETS = [
  { name: "web", label: "Web Search", enabled: true, configured: true, platform_label: "CLI", tools: ["web_search", "web_extract"] },
  { name: "kanban", label: "Kanban", enabled: false, configured: false, platform_label: "CLI", tools: ["kanban_create"] },
];
const SERVERS = { servers: [{ name: "文档检索", transport: "http", enabled: true, auth: "header" }] };
const SKILL_NAME = "资料整理";
const TOOL_NAME = "网页搜索";
const QUERY = "报";
/** A row locator that belongs to the OTHER tab and names a row that really exists there. */
const FOREIGN_TOOLS_ROW = `tools:${TOOL_NAME}`;
const FOREIGN_SKILLS_ROW = `skills:${SKILL_NAME}`;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return document.querySelector<T>(`[data-testid='${testid}']`);
}
function all(selector: string): Element[] {
  return [...document.querySelectorAll(selector)];
}
function textOf(testid: string): string {
  return (q(testid)?.textContent ?? "").trim();
}
function searchOf(): string {
  return textOf("cap8-location");
}
function paramsOf(): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(searchOf()));
}
function entryWith(fields: Record<string, string>): string {
  return `/capabilities?${new URLSearchParams(fields).toString()}`;
}
function reads(): string[] {
  return api.fetchJsonStrict.mock.calls.map((call) => String(call[0])).filter((url) => url !== "undefined");
}
function skillRowCount(): number {
  return all("[data-testid^='skl4-row-']").length;
}
function toolRowCount(): number {
  return all("[data-testid='tol5-row']").length;
}
function countValue(key: "skills" | "tools"): string {
  return (q(`cap4-count-${key}`)?.querySelector(".cap4-count-value")?.textContent ?? "").trim();
}
/** Every page-like key a 「页码归 1」 claim would need. None of them exists on this surface. */
const PAGE_LIKE = ["page", "pageNum", "pageNumber", "page_size", "cursor", "nextCursor", "offset", "limit"];

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  // Iteration-bounded on purpose: a `Date.now()` deadline is useless the moment a test
  // freezes the clock, and the loop then spins until vitest kills the file.
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

function LocationProbe(): ReactNode {
  const loc = useLocation();
  return <span data-testid="cap8-location">{loc.search}</span>;
}

async function render(entry: string, page: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        {page}
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

function armSkills(payload: unknown): void {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(async (url?: unknown) => {
    const text = String(url);
    if (url === undefined) return { servers: [] };
    if (text === "/agent-api/api/skills") return payload;
    throw new ApiError("unknown", { status: 404, body: "{}", url: text });
  });
}

function armTools(): void {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(async (url?: unknown) => {
    const text = String(url);
    if (url === undefined) return { servers: [] };
    if (text.startsWith("/agent-api/")) throw new ApiError("missing", { status: 404, body: "{}", url: text });
    if (text.startsWith("/api/tools/toolsets")) return TOOLSETS;
    if (text.startsWith("/api/mcp/servers")) return SERVERS;
    throw new ApiError("unknown", { status: 404, body: "{}", url: text });
  });
}

async function settleSkills(payload: unknown, entry: string): Promise<void> {
  resetSkillsTabState();
  resetCapabilityCounts();
  armSkills(payload);
  await render(entry, <SkillsPage />);
  await waitFor(
    () => skillRowCount() > 0 || !!q("skl4-empty") || !!q("skl4-error") || !!q("skl4-no-match"),
    "skills list settled",
  );
}

async function settleTools(entry: string): Promise<void> {
  resetToolsTabState();
  resetCapabilityCounts();
  armTools();
  await render(entry, <ToolsPage />);
  await waitFor(() => toolRowCount() > 0 || !!q("tol5-empty"), "tools list settled");
}

/** The real shell page for the capabilities module, mounted read-only (no live slot, so
 *  no upstream page is mounted and no request can be issued by the strip or the pane). */
async function mountShell(entry: string): Promise<void> {
  await render(entry, <ConsoleModulePage module="capabilities" />);
  await waitFor(() => document.querySelector(".pane") !== null, "capabilities pane rendered");
}

function tabIds(): string[] {
  return all('[role="tab"]').map((el) => el.getAttribute("data-tab") ?? "");
}

async function clickTab(tabId: string): Promise<void> {
  const button = document.querySelector<HTMLAnchorElement>(`[role="tab"][data-tab="${tabId}"]`);
  if (!button) throw new Error(`tab ${tabId} is not on screen`);
  await act(async () => {
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await waitFor(() => button.getAttribute("aria-selected") === "true", `tab ${tabId} selected`);
}

beforeEach(() => {
  api.fetchJsonStrict.mockReset();
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  resetCapabilityCounts();
  resetSkillsTabState();
  resetToolsTabState();
  resetTabView();
  window.history.replaceState({}, "", "/capabilities?tab=skills");
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

describe("R197 — 非法 ?tab= 落在能力面第一个 tab，外部参数一字不改", () => {
  it("resolveTab has no capabilities alias and the shell folds onto 技能 without rewriting the address", async () => {
    // `TAB_ALIAS` (shell/routes.ts:343-349) has no `capabilities` entry, so every value
    // passes through and `active = tabs.find(...) ?? tabs[0]` picks the first declared tab.
    expect(resolveTab("capabilities", "__nope__")).toEqual({ tab: "__nope__", view: "" });
    expect(resolveTab("capabilities", "servers")).toEqual({ tab: "servers", view: "" });
    expect(resolveTab("capabilities", "tools")).toEqual({ tab: "tools", view: "" });

    const fields = {
      tab: "__nope__",
      q: QUERY,
      row: FOREIGN_TOOLS_ROW,
      sort: "name",
      dir: "desc",
    };
    const entry = entryWith(fields);
    await mountShell(entry);

    expect(document.querySelector(".pane")?.getAttribute("data-tabname")).toBe("技能");
    // The address stands verbatim: the shell reads ?tab= but never writes it, so an
    // illegal tab is not silently corrected and no foreign param is dropped.
    expect(searchOf()).toBe(`?${new URLSearchParams(fields).toString()}`);
    expect(paramsOf()).toEqual(fields);
    for (const key of PAGE_LIKE) expect(searchOf(), key).not.toContain(`${key}=`);
    // No placeholder may invent rows, and no count slot may print a bare 0 for a pane
    // that was never read — the honest form here is「没有计数面」。
    expect(all("[data-testid^='skl4-row-']")).toHaveLength(0);
    expect(all("[data-testid^='cap4-count-']")).toHaveLength(0);
    expect(q("cap-row-missing")).toBeNull();
    // The strip and the pane issue no read of their own; a live slot would, so this
    // also proves the placeholder path is not quietly mounting a page.
    expect(reads()).toHaveLength(0);
  });

  it("the real tab strip carries q / sort / dir / row over byte-for-byte and selects the target tab", async () => {
    const fields = { tab: "skills", q: QUERY, sort: "name", dir: "desc", row: `skills:${SKILL_NAME}` };
    await mountShell(entryWith(fields));

    expect(tabIds()).toEqual(["skills", "tools", "models", "channels"]);
    expect(document.querySelector('[role="tab"][data-tab="servers"]')).toBeNull();
    expect(document.querySelector<HTMLAnchorElement>('[role="tab"][data-tab="skills"]')?.getAttribute("aria-selected")).toBe("true");

    await clickTab("tools");
    expect(paramsOf()).toEqual({ ...fields, tab: "tools" });
    expect(searchOf()).toBe(`?${new URLSearchParams({ ...fields, tab: "tools" }).toString()}`);
    expect(document.querySelector(".pane")?.getAttribute("data-tabname")).toBe("工具与 MCP");
    for (const key of PAGE_LIKE) expect(searchOf(), key).not.toContain(`${key}=`);
    expect(reads(), "the strip itself never reads").toHaveLength(0);

    await clickTab("skills");
    // `skills` is the module's default tab: its canonical hash is `#/capabilities` with no
    // `tab=` key (`shell/routes.ts:173` declares no `tab` field for it), so the strip drops
    // the key rather than writing `tab=skills`. That is not a param loss — every foreign
    // param survives byte-for-byte and the pane lands back on 技能.
    const back = { q: QUERY, sort: "name", dir: "desc", row: `skills:${SKILL_NAME}` };
    expect(paramsOf()).toEqual(back);
    expect(searchOf()).toBe(`?${new URLSearchParams(back).toString()}`);
    expect(document.querySelector(".pane")?.getAttribute("data-tabname")).toBe("技能");
    expect(reads()).toHaveLength(0);
  });
});

describe("R197 — 行定位符跨 tab 不串味", () => {
  it("skills ignores ?row=tools:<a tool that really exists> — nothing opens, nothing is reported missing, the list is not narrowed to 0", async () => {
    const fields = { tab: "skills", row: FOREIGN_TOOLS_ROW };
    await settleSkills({ asOf: "2026-11-19T06:00:00Z", items: SKILL_ITEMS }, entryWith(fields));

    const rows = skillRowCount();
    expect(rows).toBe(SKILL_ITEMS.length);
    expect(q("cap7-detail-skills"), "no detail may open from a foreign locator").toBeNull();
    expect(q("cap-row-expanded")).toBeNull();
    expect(q("cap-row-missing"), "a foreign locator is not this tab's missing row").toBeNull();
    // Counts stay the tab's own real number — never a bare 0 manufactured by the foreign param.
    expect(countValue("skills")).toBe(String(rows));
    expect(textOf("cap-page-scope")).toContain(`共 ${rows} 项`);
    expect(textOf("cap-page-scope")).not.toContain("共 0 项");
    expect(q<HTMLInputElement>("cap5-search")?.value).toBe("");
    // The address stands verbatim: skills neither consumes nor deletes the other tab's row.
    expect(paramsOf()).toEqual(fields);
    expect(reads()).toEqual(["/agent-api/api/skills"]);
  });

  it("tools ignores ?row=skills:<a skill that really exists> — same rows, same counts, address untouched, no extra read", async () => {
    const fields = { tab: "tools", row: FOREIGN_SKILLS_ROW };
    await settleTools(entryWith(fields));

    const rows0 = all("[data-testid='tol5-row']");
    const rows = rows0.length;
    expect(rows).toBe(TOOLSETS.reduce((sum, set) => sum + set.tools.length, 0) + SERVERS.servers.length);
    expect(q("cap7-detail-tools")).toBeNull();
    expect(q("cap-row-expanded")).toBeNull();
    expect(q("cap-row-missing")).toBeNull();
    expect(countValue("tools")).toBe(String(rows));
    expect(textOf("cap-page-scope")).toContain(`共 ${rows} 项`);
    expect(textOf("cap-page-scope")).not.toContain("共 0 项");
    expect(q<HTMLInputElement>("cap5-search")?.value).toBe("");
    for (const key of PAGE_LIKE) expect(searchOf(), key).not.toContain(`${key}=`);
    const settled = reads().length;
    expect(settled).toBeGreaterThan(0);
    // Round trip this tab's own first row. Opening it writes the row's own name over the
    // foreign locator; closing deletes `row` outright — the product does not resurrect the
    // other tab's value, and nothing else in the address moves. No read is added either way.
    const ownName = (rows0[0]?.querySelector("[data-testid='tl3-name']")?.textContent ?? "").trim();
    expect(ownName).not.toBe("");
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='cap7-detail-toggle']")?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => !!q("cap7-detail-tools"), "own detail opened");
    expect(paramsOf()).toEqual({ tab: "tools", row: `tools:${ownName}` });
    expect(reads()).toHaveLength(settled);
    await act(async () => {
      q<HTMLButtonElement>("cap-row-close")?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => !q("cap7-detail-tools"), "own detail closed");
    expect(paramsOf()).toEqual({ tab: "tools" });
    expect(searchOf()).not.toContain(FOREIGN_SKILLS_ROW);
    expect(toolRowCount()).toBe(rows);
    expect(reads()).toHaveLength(settled);
  });
});
