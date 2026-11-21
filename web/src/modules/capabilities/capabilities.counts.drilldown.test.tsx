// @vitest-environment jsdom
/**
 * R215 — /capabilities 分区计数、行数与行复制控件的三值同源（纯测试，零产品码改动）
 *
 * 派工单前提的现查更正（`git grep` 于基线 `109585f2`，上游 tip `916b943b`）：
 *  - `?toolset=` 本代仍无人读（第 13 条道确认）：全仓只命中 legacy
 *    `web/src/pages/SkillsPage.tsx:713` 的 JSX prop `toolset={configToolset}`，以及我自己
 *    五处测试注释（`capabilities.drilldown.test.tsx:6`、`capabilities.export.test.tsx:13`、
 *    `capabilities.requests.test.tsx:22`/`:44`、`capabilities.tab.persist.test.tsx:22`）。
 *    没有 `params.get("toolset")`，所以 ③ 的「toolset 深链」只能落在真实机制
 *    `?row=tools:<名称>` 上；④ 的「不存在的 toolset」落在 `?q=` 无匹配与 `?row=` 落空上。
 *  - 没有「工具集卡片」也没有「子表」：tools 只有两张分区卡（`tol5-list` 工具集段 /
 *    `tol5-mcp-section` MCP 段），唯一下钻面是行详情 `cap7-detail-tools`。
 *  - `capF` 只是状态锚（`capF-count-*` / `capF-row-*` 全仓零命中）；计数面是
 *    `cap4-count-<tab>` / `cap6-export-count` / `cap-page-scope` / 段头 `tol5-tools-head`。
 *
 * 已覆盖只回证据，不写重复用例：
 *  - R184 `capabilities.drilldown.test.tsx:184` 逐行归属（`data-source` 分区 + 每集一条
 *    「内置 · X」措辞 + 段头 5 条 / 1 个 + 负面守卫「没有按集计数」）；`:230` 带筛带排的
 *    下钻往返（全局九面逐字 + `reads()` 不变，但没有分区面）。
 *  - R140 `capabilities.counts.test.tsx:212` 分区计数 vs 分区行数 vs 全局按钮数，以及
 *    展开/收起复原（不含请求计量）；`:186` `?q=` 收窄时三值同步（只到全局层）；`:247`
 *    空结果真 0 + 两闸 disabled 共享一句 + 零剪贴板 + 零请求。
 *  - R91 `capabilities.deeplink.test.tsx:130`/`:204`/`:248` `?row=tools:<存在>` 的参数逐字、
 *    只改 `row`、重挂零新读；`:163` 落空行的 `cap-row-missing` + URL 不改写。
 *  - R130 `capabilities.empty.test.tsx:214`/`:231` tools 无匹配禁用两闸、藏按钮、零请求，
 *    清空后行数与按钮序号一起复原。→ 派工单 ④ 的四个断言（可读空态、计数真 0、
 *    复制导出 disabled + title、零请求）已被 R140:247 + R130:214 + R88 `filterparity:234`
 *    覆盖三遍，本文件不再重写，只在下方如实登记。
 *
 * 本文件补的真实缺口：
 *  (a) 分区内的复制按钮数——R140 只把「全局按钮数」对撞「两段之和」，从来没有人断言
 *      `tol5-list` 里的按钮数 == 该段行数、`tol5-mcp-section` 同理；这正是 ① 要的三值。
 *  (b) 一段收窄到单一工具集后，该段行数 == 上游那一集的 `tools.length` == 该段按钮数，
 *      另一段自己的三值同步不动（R184 只数措辞，R140 只数全局）。
 *  (c) 下钻往返的分区面 + 零重取（R140 有分区面无请求计量，R184 有计量无分区面）。
 *  (d) `?row=tools:<存在>` 到达后分区三值仍相等且地址逐字（R91 断言参数与详情，不断言
 *      分区三值）。
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: (...args: unknown[]) => api.fetchJsonStrict(...args) }));
const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

import { ApiError } from "@/lib/api-error";
import { ToolsPage } from "../tools/ToolsPage";
import { resetToolsTabState } from "../tools/useToolsData";
import { resetCapabilityCounts } from "./counts";
import { resetTabView } from "./tabView";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

/** 与 R140 同一份夹具：工具集段 3 行（web 两把 + kanban 一把），MCP 段 2 行。 */
const TOOLSETS = [
  { name: "web", label: "Web Search", enabled: true, configured: true, platform_label: "CLI", tools: ["web_search", "web_extract"] },
  { name: "kanban", label: "Kanban", enabled: false, configured: false, platform_label: "CLI", tools: ["kanban_create"] },
];
const SERVERS = {
  servers: [
    { name: "docsearch", transport: "http", enabled: true, auth: "header" },
    { name: "legacy", transport: "stdio", enabled: false },
  ],
};
const TOOLSET_ROWS = TOOLSETS.reduce((sum, set) => sum + set.tools.length, 0);
const WEB_SET = TOOLSETS[0]!;

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return document.querySelector<T>(`[data-testid='${testid}']`);
}
function allIn(rootNode: Element | null | undefined, selector: string): Element[] {
  return rootNode ? [...rootNode.querySelectorAll(selector)] : [];
}
/** 段内行标记与段内复制按钮——本文件的核心缺口 (a)。 */
const sectionRows = (testid: string) => allIn(q(testid), "[data-testid='tol5-row']");
const sectionButtons = (testid: string) => allIn(q(testid), "button[data-testid^='cap-row-copy-']");
const toolRowsAll = () => [...document.querySelectorAll("[data-testid='tol5-row']")];
const copyButtons = () => [...document.querySelectorAll<HTMLButtonElement>("button[data-testid^='cap-row-copy-']")];
function rowName(row: Element): string {
  return row.querySelector("[data-testid='tl3-name']")?.textContent?.trim() ?? "";
}
function countValue(): string {
  return q("cap4-count-tools")?.querySelector(".cap4-count-value")?.textContent ?? "";
}
function sectionCount(testid: string): number {
  const match = /(\d+)/.exec(q(testid)?.textContent ?? "");
  return match ? Number(match[1]) : -1;
}
function scopeN(): number {
  const match = /(\d+)\s*项/.exec(q("cap-page-scope")?.textContent ?? "");
  return match ? Number(match[1]) : -1;
}
function reads(): string[] {
  return api.fetchJsonStrict.mock.calls.map((call) => String(call[0])).filter((url) => url !== "undefined");
}
function searchOf(): string {
  return q("cap8-location")?.textContent ?? "";
}
function paramsOf(): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(searchOf()));
}
/** 每张分区卡的三值：段头计数（MCP 段无 testid，取卡内句子）、段内行数、段内按钮数。 */
function faces() {
  const mcpCard = q("tol5-mcp-section");
  const mcpSentence = /MCP 连接：(\d+) 个/.exec(mcpCard?.textContent ?? "");
  return {
    toolsetHead: sectionCount("tol5-tools-head"),
    toolsetRows: sectionRows("tol5-list").length,
    toolsetButtons: sectionButtons("tol5-list").length,
    mcpHead: mcpSentence ? Number(mcpSentence[1]) : -1,
    mcpRows: sectionRows("tol5-mcp-section").length,
    mcpButtons: sectionButtons("tol5-mcp-section").length,
    globalButtons: copyButtons().length,
    globalRows: toolRowsAll().length,
    countValue: countValue(),
    scopeN: scopeN(),
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
function LocationProbe(): ReactNode {
  const loc = useLocation();
  return <span data-testid="cap8-location">{loc.search}</span>;
}
async function render(entry: string): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.append(container);
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
}
function toolsEntry(query: Record<string, string>): string {
  return `/capabilities?${new URLSearchParams({ tab: "tools", ...query }).toString()}`;
}
/** 每次都重挂：tools tab 有模块级缓存，不清缓存的第二挂零请求，三值就不是首载的三值。 */
async function settleTools(entry = toolsEntry({})): Promise<void> {
  resetToolsTabState();
  resetCapabilityCounts();
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(async (url?: unknown) => {
    if (url === undefined) return { servers: [] };
    const text = String(url);
    if (text.startsWith("/agent-api/")) throw new ApiError("missing", { status: 404, body: "{}", url: text });
    if (text.startsWith("/api/tools/toolsets")) return TOOLSETS;
    if (text.startsWith("/api/mcp/servers")) return SERVERS;
    throw new ApiError("unknown", { status: 404, body: "{}", url: text });
  });
  await render(entry);
  await waitFor(() => toolRowsAll().length > 0 || !!q("tol5-empty"), "tools settled");
}
async function click(node: Element | null | undefined, label: string): Promise<void> {
  if (!node) throw new Error(`missing clickable node: ${label}`);
  await act(async () => {
    (node as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  api.fetchJsonStrict.mockReset();
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  resetCapabilityCounts();
  resetToolsTabState();
  resetTabView();
  window.history.replaceState({}, "", "/capabilities?tab=tools");
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  container?.remove();
  container = null;
  vi.useRealTimers();
});

describe("R215 ① — 分区内三值同源：段头计数 == 段内行数 == 段内复制按钮数", () => {
  it("两段各自闭合，且两段之和就是全局计数与 scope N", async () => {
    await settleTools();
    const f = faces();
    expect(f.toolsetHead, "段头「工具与工具集：N 条」").toBe(TOOLSET_ROWS);
    expect(f.toolsetRows).toBe(TOOLSET_ROWS);
    expect(f.toolsetButtons, "缺口 (a)：段内按钮数此前无人断言").toBe(f.toolsetRows);
    expect(f.mcpHead, "MCP 段头没有 testid，只能读它自己卡里的句子").toBe(SERVERS.servers.length);
    expect(f.mcpRows).toBe(SERVERS.servers.length);
    expect(f.mcpButtons).toBe(f.mcpRows);
    expect(f.toolsetRows + f.mcpRows).toBe(f.globalRows);
    expect(f.toolsetButtons + f.mcpButtons).toBe(f.globalButtons);
    expect(f.countValue).toBe(String(f.globalRows));
    expect(f.scopeN).toBe(f.globalRows);
  });

  it("一段收窄到单一工具集后，该段行数 == 上游那一集的 tools.length == 该段按钮数，另一段自己同步", async () => {
    await settleTools();
    const webNames = sectionRows("tol5-list")
      .map(rowName)
      .filter((name) => name.includes("网页"));
    expect(webNames.length, "夹具里 web 集的两把工具都带「网页」二字").toBe(WEB_SET.tools.length);
    const needle = webNames[0]!.slice(0, 2);
    await settleTools(toolsEntry({ q: needle }));
    const f = faces();
    expect(f.toolsetRows, "收窄后工具集段只剩 web 这一集").toBe(WEB_SET.tools.length);
    expect(f.toolsetHead, "段头跟着段内行数走，不是首载的 3").toBe(f.toolsetRows);
    expect(f.toolsetButtons).toBe(f.toolsetRows);
    expect(f.mcpRows, "MCP 段没有「网页」命中，但它自己的三值必须仍然闭合").toBe(f.mcpButtons);
    expect(f.mcpHead === f.mcpRows || f.mcpHead === -1, "段卡整块撤下时句子读不到，此时行与按钮都是 0").toBe(true);
    expect(f.globalRows).toBe(f.toolsetRows + f.mcpRows);
    expect(f.globalButtons).toBe(f.globalRows);
    expect(f.countValue).toBe(String(f.globalRows));
    expect(f.scopeN).toBe(f.globalRows);
  });
});

describe("R215 ② — 下钻往返：分区面逐字复原，一次请求都不加", () => {
  it("展开一行的详情再收起，两段的头/行/按钮与全局计数原样回来，reads 不变", async () => {
    await settleTools();
    const before = faces();
    const firstReads = reads().length;
    expect(firstReads).toBeGreaterThan(0);

    await click(sectionRows("tol5-list")[0]?.querySelector("[data-testid='cap7-detail-toggle']"), "第一行的「详情」");
    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']")).toHaveLength(1);
    const open = faces();
    expect(open, "下钻不得改变任何分区面").toEqual(before);
    expect(reads().length, "下钻零重取").toBe(firstReads);

    await click(sectionRows("tol5-list")[0]?.querySelector("[data-testid='cap-row-close']"), "第一行的「关闭」");
    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']")).toHaveLength(0);
    expect(faces(), "返回上层后逐字复原").toEqual(before);
    expect(reads().length, "返回上层也是零重取").toBe(firstReads);
  });
});

describe("R215 ③ — 行定位符深链到达后，分区三值仍相等且地址逐字", () => {
  it("?row=tools:<存在的工具名> 打开详情、只带 tab 与 row、不加一次请求", async () => {
    await settleTools();
    const target = rowName(sectionRows("tol5-list")[0]!);
    expect(target).not.toBe("");
    const plainUrls = [...reads()].sort();
    const fields = { tab: "tools", row: `tools:${target}` };
    const entry = `/capabilities?${new URLSearchParams(fields).toString()}`;
    await settleTools(entry);
    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']"), "深链把这行展开了").toHaveLength(1);
    const f = faces();
    expect(f.toolsetButtons).toBe(f.toolsetRows);
    expect(f.mcpButtons).toBe(f.mcpRows);
    expect(f.globalButtons).toBe(f.globalRows);
    expect(f.countValue).toBe(String(f.globalRows));
    expect(f.scopeN).toBe(f.globalRows);
    expect(paramsOf(), "地址里只有粘贴的两个键，没有被改写或补参").toEqual(fields);
    expect(searchOf()).toBe(`?${new URLSearchParams(fields).toString()}`);
    // 深链只是把已加载的一行展开，不该比普通首载多付任何一次读。
    expect([...reads()].sort(), "深链首载的请求集合与普通首载相同").toEqual(plainUrls);
  });
});
