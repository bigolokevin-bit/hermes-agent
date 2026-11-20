// @vitest-environment jsdom
/**
 * R216 — /capabilities 筛选参数的到达、存活与清除（纯测试，零产品码改动）
 *
 * 派工单前提的现查更正（`git grep` 于基线 `fb94f95c`，上游 tip `804ad319`）：
 *  - `?kind=` 本代仍无人读（第 14 条道确认）：全仓命中的只有 React `kind` prop
 *    （`SystemHealthSurface.tsx:454/459/473/485/521`、`ToolsPage.tsx:500-502`、
 *    `RunsModulePage.tsx:1555`）、`data-knn-kind`（knowledge），以及我自己四处测试注释。
 *    没有 `params.get("kind")`，所以 ① 的「按类型筛」只能落在真实机制 `?q=`（名称本地过滤）
 *    上，而 `kind` 必须既不参与取值、也不被抹掉；③ 的「非法 kind」同理。
 *  - `capF` 只是状态锚（`capF-count-*` / `capF-row-*` 全仓零命中）；计数面是
 *    `cap4-count-<tab>`(+`-state`) / `cap6-export-count` / `cap-page-scope` / `cap5-scope-note`。
 *  - 能力面没有分页参数（R91 `capabilities.deeplink.test.tsx:204` 已守卫 `page/pageNum/
 *    pageNumber/page_size/cursor/nextCursor/offset/limit` 全不出现），所以 ② 的「页码回 1」
 *    本代无可复位之物，改为断言这些键一个都不出现。
 *  - ④ 的「清筛选恰 1 次新取数」与产品相反：搜索是本地过滤（BFF 读口不吃 q），
 *    清空只改地址、零请求。本文件按产品断言并在此如实登记。
 *
 * 已覆盖只回证据，不写重复用例：
 *  - R88 `capabilities.filterparity.test.tsx:281` 手工镜像壳条（字符串替换 tab）保 q/sort/dir
 *    并断言切回零新读；`:234`/`:260` 无匹配共享闸句与「—」支。
 *  - R199 `capabilities.requests.test.tsx` ② 真壳条 + 两个真页 live slot：行不共存、切回零新读
 *    （但它故意不带 q，以免 skills-only 关键词把 tools 列表清空）；① 请求 URL 无查询串。
 *  - R140 `capabilities.counts.test.tsx:186`/`:247` `cap4` 值进三值等式（首载 / 收窄 / 空结果真 0）。
 *  - R130 `capabilities.empty.test.tsx:197`/`:231` 清空后行数与 `cap-row-copy-*` 序号复原、零请求。
 *  - R91 `capabilities.deeplink.test.tsx:163` 落空行 `cap-row-missing` + 地址不改写 + `capF` 锚同屏。
 *  - R197 `capabilities.tab.persist.test.tsx` A1/A2 非法 `?tab=` 折叠与真壳条保参。
 *  - `tools/ToolsPage.test.tsx:536`/`:541` 已钉 `?q=网页` 时搜索框回填 `.value === "网页"`。
 *
 * 本文件补的真实缺口：
 *  (a) 外来 `kind` 与 `q` 同到：kind 不参与取值（若被读，`kind=mcp&q=网页` 应为空集），
 *      q 照常筛，且出去的六条请求 URL 一个字节都不带 kind=/查询串，地址里 kind 原样存活。
 *  (b) 真壳条带着 q 走一个来回：两个 tab 各自 honour 同一个 q，切回后搜索框仍是那个词，
 *      且这一整趟零新请求（R88 是手工镜像，R199 ② 是无 q 版）。
 *  (c) 非法 kind 单独到达：不改写地址、不制造空态、页级锚在；与无匹配 q 同到时可读空态
 *      只由 q 产生，kind 仍逐字留在地址里。
 *  (d) 清除筛选回全量后 `cap4-count-*` 也回到三值等式（行数 == 按钮数 == 计数值 == scope N）。
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
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const rest = { ...props } as Record<string, unknown>;
    delete rest.outlined;
    return <button {...rest}>{children}</button>;
  },
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

import { ApiError } from "@/lib/api-error";
import { ConsoleModulePage } from "@/shell/console";
import { SkillsPage, resetSkillsTabState } from "../skills/SkillsPage";
import { ToolsPage } from "../tools/ToolsPage";
import { resetToolsTabState } from "../tools/useToolsData";
import { resetCapabilityCounts } from "./counts";
import { stateAnchor } from "./stateAnchor";
import { resetTabView } from "./tabView";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

const AS_OF = "2026-11-19T06:00:00Z";
/** 「网页索引」这一条是刻意取的：它和 tools 的「网页搜索 / 网页内容提取」共用同一个关键词，
 * 这样 ② 才能用真壳条带着同一个 q 走一个来回，两边都有行可数。 */
const SKILL_ITEMS = [
  { skillId: "sk_web_index", name: "网页索引", source: "builtin", status: "active", updatedAt: "2026-11-19T05:30:00Z" },
  { skillId: "s2", name: "资料整理", scope: "tenant-shared", status: "active", updatedAt: "2026-11-19T04:00:00Z" },
  { skillId: "s3", name: "日报生成", scope: "tenant-shared", status: "active", updatedAt: "2026-11-19T04:30:00Z" },
];
const TOOLSETS = [
  { name: "web", label: "Web Search", enabled: true, configured: true, platform_label: "CLI", tools: ["web_search", "web_extract"] },
  { name: "kanban", label: "Kanban", enabled: false, configured: false, platform_label: "CLI", tools: ["kanban_create"] },
];
const SERVERS = { servers: [{ name: "文档检索", transport: "http", enabled: true, auth: "header" }] };
const TOOLSET_ROWS = TOOLSETS.reduce((sum, set) => sum + set.tools.length, 0);
const ALL_TOOL_ROWS = TOOLSET_ROWS + SERVERS.servers.length;
const NEEDLE = "网页";
const NO_MATCH = "不存在的词";

const SKILLS_URL = "/agent-api/api/skills";
/** tools 一趟走六条路径；段内顺序固定，两条腿并发，所以合并顺序不固定 —— 按集合断言。 */
const TOOL_URLS = [
  "/agent-api/api/tools",
  "/api/tools",
  "/agent-api/api/tools/toolsets",
  "/api/tools/toolsets",
  "/agent-api/api/mcp/servers",
  "/api/mcp/servers",
];
const INVENTORY_URLS = TOOL_URLS.slice(0, 4);
const SERVER_URLS = TOOL_URLS.slice(4);
const PAGE_LIKE = ["page", "pageNum", "pageNumber", "page_size", "cursor", "nextCursor", "offset", "limit"];
const FOREIGN_KEYS = ["toolset", "kind"];

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return document.querySelector<T>(`[data-testid='${testid}']`);
}
function all(selector: string): Element[] {
  return [...document.querySelectorAll(selector)];
}
function tabButton(tabId: string): HTMLButtonElement | HTMLAnchorElement | null {
  return document.querySelector<HTMLButtonElement | HTMLAnchorElement>(`[role="tab"][data-tab="${tabId}"]`);
}
const skillRows = () => all("[data-testid^='skl4-row-']");
const toolRows = () => all("[data-testid='tol5-row']");
const copyButtons = () => all("button[data-testid^='cap-row-copy-']");
function skillNames(): string[] {
  return skillRows().map((row) => {
    const cell = row.querySelectorAll(".skl4-cell")[0];
    return cell?.firstElementChild?.textContent?.trim() ?? "";
  });
}
function toolSources(): string[] {
  return toolRows().map((row) => row.getAttribute("data-source") ?? "");
}
function countValue(key: "skills" | "tools"): string {
  return q(`cap4-count-${key}`)?.querySelector(".cap4-count-value")?.textContent ?? "";
}
function scopeN(): number {
  const match = /(\d+)\s*项/.exec(q("cap-page-scope")?.textContent ?? "");
  return match ? Number(match[1]) : -1;
}
function inputValue(): string {
  return q<HTMLInputElement>("cap5-search")?.value ?? "";
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
/** 出去的请求必须是读口路径本身：无查询串、不分页键、不外来键。 */
function assertUrlsPure(urls: string[]): void {
  for (const url of urls) {
    expect(url, `request URL must be query-free: ${url}`).not.toContain("?");
    for (const key of [...PAGE_LIKE, ...FOREIGN_KEYS]) {
      expect(url, `request URL must never carry ${key}=`).not.toContain(`${key}=`);
    }
  }
}

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  // 迭代计数而非 Date.now() 截止：本仓有冻结时钟的用例，壁钟截止会永不触发。
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
  document.body.append(container);
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
function entryWith(fields: Record<string, string>): string {
  return `/capabilities?${new URLSearchParams(fields).toString()}`;
}
function notWired(url: string): ApiError {
  return new ApiError("unknown route", { status: 404, body: "{}", url });
}
/** 换 stub 但不 mockReset：跨 tab 的计量要靠同一份调用史。 */
function setSkillsHandler(payload: unknown) {
  api.fetchJsonStrict.mockImplementation(async (url?: unknown) => {
    if (url === undefined) return { servers: [] };
    const text = String(url);
    if (text === SKILLS_URL) return payload;
    throw notWired(text);
  });
}
function setToolsHandler() {
  api.fetchJsonStrict.mockImplementation(async (url?: unknown) => {
    if (url === undefined) return { servers: [] };
    const text = String(url);
    if (INVENTORY_URLS.includes(text)) {
      if (text === "/api/tools/toolsets") return TOOLSETS;
      throw notWired(text);
    }
    if (SERVER_URLS.includes(text)) {
      if (text === "/api/mcp/servers") return SERVERS;
      throw notWired(text);
    }
    throw notWired(text);
  });
}
function armSkills(payload: unknown) {
  api.fetchJsonStrict.mockReset();
  setSkillsHandler(payload);
}
function armTools() {
  api.fetchJsonStrict.mockReset();
  setToolsHandler();
}
async function settleTools(entry: string) {
  resetToolsTabState();
  resetCapabilityCounts();
  armTools();
  await render(entry, <ToolsPage />);
  await waitFor(() => toolRows().length > 0 || !!q("tol5-empty") || !!q("tol5-error") || !!q("tl3-no-match"), "tools settled");
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
  resetSkillsTabState();
  resetToolsTabState();
  resetTabView();
  window.history.replaceState({}, "", "/capabilities?tab=tools");
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

describe("R216 ① — 外来 kind 不参与取值，q 照常筛，请求一个字不多", () => {
  it("ignores ?kind= as a filter, honours ?q=, backfills the box, and asks the six bare paths", async () => {
    const fields = { tab: "tools", kind: "mcp", q: NEEDLE };
    await settleTools(entryWith(fields));

    // 判别式：若 kind=mcp 真被读，MCP 段里没有名称含「网页」的条目，表体应为空集。
    // 它不是空的 —— 说明筛的是 q，kind 只是地址上一个惰性令牌。
    expect(toolRows(), "kind=mcp 不得把表体收成 MCP 段").toHaveLength(2);
    expect(toolSources(), "命中的两行都来自工具集段，不是 mcp").toEqual(["toolset", "toolset"]);
    expect(inputValue(), "搜索框按 ?q= 回填").toBe(NEEDLE);
    expect(countValue("tools"), "计数位跟着筛后的表体走").toBe("2");
    expect(copyButtons(), "行复制按钮与表体同数").toHaveLength(2);
    expect(scopeN(), "scope N 也是同一个 2").toBe(2);

    const urls = reads();
    expect([...urls].sort(), "首载就是六条读口路径").toEqual([...TOOL_URLS].sort());
    assertUrlsPure(urls);

    expect(paramsOf(), "kind 原样存活，没有被读掉也没有被抹掉").toEqual(fields);
    for (const key of PAGE_LIKE) {
      expect(paramsOf(), `地址里不该出现 ${key}`).not.toHaveProperty(key);
    }
  });
});

describe("R216 ② — 真壳条带着同一个 q 走一个来回", () => {
  it("carries q across both real tabs, restores the box on return, and spends no second read", async () => {
    const entry = entryWith({ tab: "skills", q: NEEDLE });
    resetSkillsTabState();
    resetToolsTabState();
    resetCapabilityCounts();
    armSkills({ asOf: AS_OF, items: SKILL_ITEMS });
    await render(
      entry,
      <ConsoleModulePage
        module="capabilities"
        live={{ skills: <SkillsPage />, tools: <ToolsPage />, models: <div />, channels: <div /> }}
      />,
    );
    await waitFor(() => skillRows().length > 0, "skills live slot settled");
    expect(skillNames(), "skills 侧只有那一条名称含关键词的活着").toEqual(["网页索引"]);
    expect(inputValue()).toBe(NEEDLE);
    expect(countValue("skills")).toBe("1");
    expect(reads(), "skills 首载只有一条读口").toEqual([SKILLS_URL]);
    expect(tabButton("tools"), "壳条必须有 tools 这一档").toBeTruthy();

    // 换 tools 的 stub 而不清调用史：六条路径要叠在已记账的那一条之上。
    setToolsHandler();
    await click(tabButton("tools"), "the tools tab button");
    await waitFor(() => toolRows().length > 0, "tools live slot settled");
    expect(paramsOf(), "壳条只换 tab，q 一字不动").toEqual({ tab: "tools", q: NEEDLE });
    expect(toolRows(), "tools 侧 honour 同一个 q").toHaveLength(2);
    expect(inputValue(), "切过来的 tab 自己把 q 回填进搜索框").toBe(NEEDLE);
    expect(countValue("tools")).toBe("2");
    expect(copyButtons()).toHaveLength(2);
    expect(skillRows(), "切走后 skills 的行整体卸载").toHaveLength(0);

    const settled = reads().length;
    expect([...reads()].sort(), "tools 这一趟付它自己的六条").toEqual([...TOOL_URLS, SKILLS_URL].sort());

    await click(tabButton("skills"), "the skills tab button");
    await waitFor(() => skillRows().length > 0, "skills came back");
    expect(reads(), "切回零新请求（模块缓存）；派工单 ④ 的「恰 1 次」与产品相反，这里同口径").toHaveLength(settled);
    expect(skillNames(), "回来的行集逐字同").toEqual(["网页索引"]);
    expect(inputValue(), "回来后搜索框仍是同一个词，不是空串").toBe(NEEDLE);
    expect(countValue("skills"), "计数位也回到筛后的 1").toBe("1");
    expect(paramsOf(), "地址回到起点（默认 tab 的 tab= 由 useEnsureTabParam 写回）").toEqual({ tab: "skills", q: NEEDLE });
    // 参数集合与首载逐字同，但键序不是：壳条给默认 tab 的链接不带 `tab=`（routes.ts:173），
    // 落回后再由 `useEnsureTabParam` 把 `tab=skills` 追加在末尾，所以 q 在前、tab 在后。
    // 这是本代真实形状，R199 ② 只断言了集合，没有断言过字节序。
    expect(searchOf(), "整趟地址的键集与取值逐字，键序是 q 先 tab 后").toBe(
      "?" + new URLSearchParams({ q: NEEDLE, tab: "skills" }).toString(),
    );
    expect(Object.keys(paramsOf()).sort()).toEqual(["q", "tab"]);
  });
});

describe("R216 ③ — 非法 kind 不改写地址，可读空态只由 q 产生", () => {
  it("keeps an unread ?kind=__nope__ verbatim, renders the full list, and holds the page anchor", async () => {
    const fields = { tab: "tools", kind: "__nope__" };
    await settleTools(entryWith(fields));
    expect(toolRows(), "非法 kind 既不清屏也不筛，全量还在").toHaveLength(ALL_TOOL_ROWS);
    expect(q("tl3-no-match"), "没有空态").toBeNull();
    expect(q("cap-row-missing"), "没有落空通告").toBeNull();
    expect(q("tl3-page"), "页级锚还在").toBeTruthy();
    expect(countValue("tools")).toBe(String(ALL_TOOL_ROWS));
    expect(paramsOf(), "地址一个字没改").toEqual(fields);
    expect(searchOf()).toBe("?" + new URLSearchParams(fields).toString());
    const urls = reads();
    expect([...urls].sort()).toEqual([...TOOL_URLS].sort());
    assertUrlsPure(urls);

    // 同一个非法 kind 叠在无匹配 q 上：空态是 q 的，kind 仍逐字留在地址里。
    const both = { tab: "tools", kind: "__nope__", q: NO_MATCH };
    await settleTools(entryWith(both));
    const anchor = q("capF-state-filter-empty");
    expect(anchor, "可读空态锚在").toBeTruthy();
    const expected = stateAnchor({ kind: "filter-empty", subject: "工具与 MCP 清单", reason: NO_MATCH, loaded: ALL_TOOL_ROWS });
    expect(anchor?.textContent?.trim()).toBe(expected.lead + expected.detail);
    expect(anchor?.className).toContain("capF-state-text");
    expect(q("tl3-no-match"), "tools 的空态卡还在").toBeTruthy();
    expect(countValue("tools"), "空集是真 0，不是「—」").toBe("0");
    expect(paramsOf(), "kind 依然原样存活，页面没有把它吞掉").toEqual(both);
  });
});

describe("R216 ④ — 清筛选回全量后 cap4 也回到三值等式", () => {
  it("clearing the needle restores rows, copy buttons, the count slot and scope N with zero new reads", async () => {
    await settleTools(entryWith({ tab: "tools", q: NO_MATCH }));
    expect(toolRows()).toHaveLength(0);
    expect(countValue("tools")).toBe("0");
    const cleared = reads().length;

    await click(q("tl3-clear"), "空态里的清空按钮");
    await waitFor(() => toolRows().length === ALL_TOOL_ROWS, "全量行回来了");
    expect(copyButtons(), "行复制按钮与表体同数").toHaveLength(ALL_TOOL_ROWS);
    expect(countValue("tools"), "计数位跟着回全量").toBe(String(ALL_TOOL_ROWS));
    expect(scopeN(), "scope N 同一个数").toBe(ALL_TOOL_ROWS);
    expect(paramsOf(), "q 被抹掉，其余参数原样").toEqual({ tab: "tools" });
    expect(inputValue(), "搜索框清空").toBe("");
    expect(reads(), "清空是本地过滤的撤销，不加请求；派工单的「恰 1 次」与产品相反").toHaveLength(cleared);
    assertUrlsPure(reads());
  });
});
