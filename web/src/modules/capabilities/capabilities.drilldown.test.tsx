// @vitest-environment jsdom
/**
 * R184 — 能力页「工具集下钻」护栏（纯测试，零产品改动）。
 *
 * 派工单前提与实代的差（如实记录，不编造面）：
 *  - `?toolset=` 本代无人读：`git grep 'toolset=|params.get("toolset")|toolsetQuery|drilldown'` 全仓只两处，
 *    一处是 legacy `pages/SkillsPage.tsx:713` 的 JSX prop，一处是 knowledge 的注释；没有任何查询参数读取点。
 *  - 能力页没有「工具集卡片」也没有「子表」：tools 只有两段列表（`tol5-list` 工具集段 + `tol5-mcp-section` MCP 段），
 *    行是按工具铺开的 `tol5-row`，唯一的下钻是行详情 `cap7-detail-tools`（`?row=tools:<名称>` 深链）。
 *  - `capF` 只有状态锚一族（`capF-state-*`/`capF-state-text`/`capF-state-detail`/`capF-state-empty-text`/`capF-retry`）；
 *    `capF-count-*`、`capF-row-*` 全仓零命中，计数面是 `cap4-count-<tab>` / `cap6-export-count` / `cap-page-scope` /
 *    `cap5-scope-note` 与 tools 的段头 `tol5-tools-head` / `tol5-mcp-section`。
 *
 * 既有覆盖（只回证据，不重写）：
 *  - R140 `capabilities.counts.test.tsx` 例 ③：段计数 == 段内行数、两段之和 == `cap4-count-tools` == 复制钮 ==
 *    `cap-page-scope`，并在无筛选无排序下展开/收起一行、全部值复原逐字。
 *  - R91 `capabilities.deeplink.test.tsx` 例 1/2/4：`?row=tools:<存在>` 展开且其余参逐字不动、读口计数不变；
 *    `?row=tools:<不存在>` 给可读 `cap-row-missing`（title `GAP-CAPROW-01`）+ URL 一字不改 + 旁边 `capF-state-filter-empty` 可见；
 *    同 URL 重挂复原且零新读。R130 例 ⑥⑦ 补齐 skills 侧同样护栏。
 *  - `tools/ToolsPage.test.tsx` 「writes the open row to the URL and closes without losing q/sort/dir」：
 *    带 q/sort/dir 时开合只增删 `row`，请求数不变。
 *
 * 本文件只补两处真缺口：
 *  ① 工具集归属忠实性：同一工具集（行键 `toolset:<集>:<工具>` 的第二段）的行共用同一个类型人话格，且不同集不得共用；
 *     段头的条数是「工具集来源行」总数，本代不存在按集计数（如实断言不存在，不冒充）。
 *  ② 下钻往返在筛选 + 排序同时生效时保序、保参、不重取：展开一行后行序与全部计数逐字不动，收起后 URL 只少 `row`，
 *     全程 fetchJSON 计数不变（R140 ③ 是无筛选无排序，ToolsPage.test 查参不查行序与段计数）。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: (...args: unknown[]) => api.fetchJsonStrict(...args) }));
const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { children: React.ReactNode }) => <span {...props}>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const next = { ...props } as Record<string, unknown>;
    delete next.outlined;
    return <button {...next}>{children}</button>;
  },
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

import { ApiError } from "@/lib/api-error";
import { ToolsPage } from "../tools/ToolsPage";
import { resetToolsTabState } from "../tools/useToolsData";
import { resetCapabilityCounts } from "./counts";
import { resetTabView } from "./tabView";

const TOOLSETS = [
  { name: "web", label: "Web Search", enabled: true, configured: true, platform_label: "CLI", tools: ["web_search", "web_extract"] },
  { name: "kanban", label: "Kanban", enabled: false, configured: false, platform_label: "CLI", tools: ["kanban_create"] },
  { name: "report", label: "Report", enabled: true, configured: true, platform_label: "CLI", tools: ["report_build", "report_render"] },
];
const SERVERS = { servers: [{ name: "文档检索", transport: "http", enabled: true, auth: "header" }] };
const TOTAL_TOOLSET_ROWS = TOOLSETS.reduce((sum, set) => sum + set.tools.length, 0);
const TOTAL_ROWS = TOTAL_TOOLSET_ROWS + SERVERS.servers.length;

let container: HTMLDivElement | null = null;
let root: Root | null = null;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return document.querySelector<T>(`[data-testid='${testid}']`);
}
function textOf(testid: string): string {
  return q(testid)?.textContent?.trim() ?? "";
}
function rows(): Element[] {
  return [...document.querySelectorAll("[data-testid='tol5-row']")];
}
/** Per-row sr-only marker: `tl3-row-<key with [^a-zA-Z0-9_-]+ folded to ->`. */
function rowKeys(): string[] {
  return [...document.querySelectorAll("[data-testid^='tl3-row-']")].map((el) => el.getAttribute("data-testid")!.slice("tl3-row-".length));
}
function names(): string[] {
  return rows().map((row) => row.querySelector("[data-testid='tl3-name']")?.textContent?.trim() ?? "");
}
function types(): string[] {
  return rows().map((row) => row.querySelector("[data-testid='tl3-type']")?.textContent?.trim() ?? "");
}
function copyButtons(): number {
  return document.querySelectorAll("button[data-testid^='cap-row-copy-']").length;
}
function digits(text: string): number | null {
  const m = text.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}
function searchOf(): string {
  return textOf("cap8-location");
}
function paramsOf(): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(searchOf()));
}
function reads(): string[] {
  return api.fetchJsonStrict.mock.calls.map((call) => String(call[0])).filter((url) => url !== "undefined");
}
/** Everything a drill-down must not move. */
function faceSnapshot(): Record<string, string | number | null> {
  return {
    order: names().join("|"),
    types: types().join("|"),
    rowCount: rows().length,
    copyButtons: copyButtons(),
    toolsHead: textOf("tol5-tools-head"),
    mcpHead: String(digits(q("tol5-mcp-section")?.textContent ?? "")),
    countTools: textOf("cap4-count-tools"),
    scope: textOf("cap-page-scope"),
    exportCount: textOf("cap6-export-count"),
  };
}

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

async function mount(entry: string): Promise<void> {
  await act(async () => root?.unmount());
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        <ToolsPage />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
  await waitFor(() => rows().length > 0 || !!q("tol5-empty"), "tools list settled");
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="cap8-location">{loc.search}</span>;
}

async function armTools(): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(async (url?: unknown) => {
    if (url === undefined) return { servers: [] };
    const text = String(url);
    if (text.startsWith("/agent-api/")) throw new ApiError("missing", { status: 404, body: "{}", url: text });
    if (text.startsWith("/api/tools/toolsets")) return TOOLSETS;
    if (text.startsWith("/api/mcp/servers")) return SERVERS;
    throw new ApiError("unknown", { status: 404, body: "{}", url: text });
  });
}

beforeEach(async () => {
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  resetCapabilityCounts();
  resetToolsTabState();
  resetTabView();
  window.history.replaceState({}, "", "/capabilities?tab=tools");
  await armTools();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

describe("R184 — 工具集归属与下钻往返", () => {
  it("attributes every tool row to one source, gives each toolset one type wording, and shows no per-set count", async () => {
    await mount("/capabilities?tab=tools");
    const body = rows();
    // The row's own source marker is the only attribution the DOM publishes; the row key is folded
    // into the sr-only testid (`toolset:<set>:<tool>` → `toolset-<set>-<tool>`), so separators are
    // dashes there and the partition is read from `data-source` instead.
    const sources = body.map((row) => row.getAttribute("data-source"));
    expect(sources.length).toBe(TOTAL_ROWS);
    const toolsetRows = sources.filter((source) => source === "toolset");
    const mcpRows = sources.filter((source) => source === "mcp");
    expect(toolsetRows.length + mcpRows.length).toBe(sources.length);
    expect(toolsetRows.length).toBe(TOTAL_TOOLSET_ROWS);
    expect(mcpRows.length).toBe(SERVERS.servers.length);

    // Every row carries its folded key marker, prefixed by its source.
    const keys = rowKeys();
    expect(keys.length).toBe(body.length);
    keys.forEach((key, index) => {
      expect(key.startsWith(`${sources[index]}-`), key).toBe(true);
    });

    // One toolset → one wording: rows sharing a type cell are exactly one set's tools, and no two
    // sets share a cell. Per-cell row counts must equal the fixture's per-set tool counts.
    const typeByIndex = types();
    const perWording = new Map<string, number>();
    typeByIndex.forEach((wording, index) => {
      if (sources[index] !== "toolset") return;
      perWording.set(wording, (perWording.get(wording) ?? 0) + 1);
    });
    expect(perWording.size, [...perWording.keys()].join(" / ")).toBe(TOOLSETS.length);
    expect([...perWording.values()].sort()).toEqual(
      TOOLSETS.map((set) => set.tools.length).sort(),
    );
    expect([...perWording.values()].reduce((sum, n) => sum + n, 0)).toBe(TOTAL_TOOLSET_ROWS);
    for (const wording of perWording.keys()) expect(wording).toContain("内置 · ");
    typeByIndex.forEach((wording, index) => {
      if (sources[index] === "mcp") expect(wording, `mcp row ${index}`).toContain("MCP");
    });

    // The section head counts the toolset-sourced rows as a whole; a per-set count does not exist here.
    expect(digits(textOf("tol5-tools-head")), "tools head").toBe(TOTAL_TOOLSET_ROWS);
    expect(textOf("tol5-tools-head")).toContain(`${TOTAL_TOOLSET_ROWS} 条`);
    expect(textOf("tol5-mcp-section")).toContain(`${SERVERS.servers.length} 个`);
    expect(document.body.textContent).not.toMatch(/每集|按集|集合计数/);
  });

  it("keeps order, every count and every param through a drill-down round trip under a filter and a sort, without re-reading", async () => {
    const needle = "网页";
    const entry = `/capabilities?tab=tools&q=${encodeURIComponent(needle)}&sort=name&dir=desc`;
    await mount(entry);

    const filtered = names();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.length).toBeLessThan(TOTAL_ROWS);
    for (const name of filtered) expect(name).toContain(needle);
    const before = faceSnapshot();
    const firstReads = reads().length;
    expect(paramsOf()).toEqual({ tab: "tools", q: needle, sort: "name", dir: "desc" });

    // Drill down on the first visible row.
    await act(async () => {
      rows()[0]!.querySelector<HTMLButtonElement>("[data-testid='cap7-detail-toggle']")!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => document.querySelectorAll("[data-testid='cap7-detail-tools']").length === 1, "detail open");
    expect(q("cap-row-expanded")).toBeTruthy();
    expect(paramsOf()).toEqual({ tab: "tools", q: needle, sort: "name", dir: "desc", row: `tools:${filtered[0]}` });
    expect(faceSnapshot(), "while open").toEqual(before);
    expect(reads().length, "no read for the drill-down").toBe(firstReads);

    // Back up: the row closes, the list is byte-identical, only `row` leaves the URL, nothing is re-read.
    await act(async () => {
      q<HTMLButtonElement>("cap-row-close")!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => document.querySelectorAll("[data-testid='cap7-detail-tools']").length === 0, "detail closed");
    expect(paramsOf()).toEqual({ tab: "tools", q: needle, sort: "name", dir: "desc" });
    expect(Object.keys(paramsOf()).sort()).toEqual(["dir", "q", "sort", "tab"]);
    expect(new URLSearchParams(searchOf()).get("q")).toBe(needle);
    expect(names(), "order after the round trip").toEqual(filtered);
    expect(faceSnapshot(), "after the round trip").toEqual(before);
    expect(reads().length, "the round trip costs no read").toBe(firstReads);
  });
});
