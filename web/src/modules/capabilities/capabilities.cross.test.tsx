// @vitest-environment jsdom
/**
 * R223 — /capabilities 工具集与筛选交叉一致性（纯测试，零产品码改动）
 *
 * 派工单前提的现查更正（`git grep` 于基线 `07cd6d00`，上游 tip `65882219` = wave-60）：
 *  - ① 的「请求逐字带三参」与产品相反：出去的请求就是读口路径本身，无查询串
 *    （R199 `capabilities.requests.test.tsx:275` 已钉 URL 纯净；R216
 *    `capabilities.filter.persist.test.tsx:263` 已钉 kind=mcp&q=网页 叠加时六条裸路径 +
 *    kind 惰性 + 四个计数面同数）。参数只活在页面地址上，本文件不复写，只补技能侧缺口。
 *  - ③ 的 `?toolset=` 本代仍无人读（第 15 条道确认）：全仓没有 `params.get("toolset")`；
 *    tools 段也没有「工具集卡片 / 子表」——只有 `tol5-list` 与 `tol5-mcp-section` 两段
 *    （R184/R215 已登记）。诚实改写：kind 叠在一段收窄的 q 上时，分区内三值
 *    （段头 == 段内行数 == 段内按钮数）仍同源，且 kind 不参与取值。
 *  - `capF` 只是状态锚族（`capF-count-*` / `capF-row-*` 不存在）；「capF==表体==按钮数」
 *    落在真实计数面 `cap4-count-<tab>` / `cap-page-scope` 上（R140/R216 同口径）。
 *
 * 已覆盖只回证据，不写重复用例：
 *  - R216 ① :263 —— tools 侧 kind+q 叠加的全局四值与六条裸路径（本文件不重写 tools 全局半）。
 *  - R216 ② :288 —— 真壳条 + live slot 带同一个 q 往返、切回零新读（但只带 q，不带 kind）。
 *  - R216 ③ :340 —— 非法 kind 单独到达不改地址；kind 叠无匹配 q 时空态锚逐字、计数真 0
 *    （但没有钉叠加地址下的导出/复制闸与「点击什么都不发」）。
 *  - R130 `capabilities.empty.test.tsx:214` —— q 单独无匹配（不带 kind）时两闸 disabled 共享句。
 *  - R215 `capabilities.counts.drilldown.test.tsx:226` —— q 单独收窄到一集时的分区三值。
 *  - R199 ① :275 —— 请求 URL 无查询串；R91 :204 —— 地址无分页键。
 *
 * 本文件补的三个真实缺口：
 *  (a) 真壳条 + live slot 下 kind 与 q 一起走一个来回：kind 逐字存活两侧，
 *      分区三值在 tools 腿闭合，整趟零新请求（R216 ② 只带 q；R197 A2 无 live slot）。
 *  (b) 非法 kind 叠无匹配 q 的叠加地址：闸位 disabled + 共享原因句 + 强点零写入零请求
 *      且地址一字不改（R216 ③ 钉了锚与参，没钉闸）。
 *  (c) skills 侧的外来 kind：没人钉过 `?tab=skills&kind=…&q=…` —— 一跳读口、kind 惰性、
 *      四值同数、地址保参（R216 ① 只做了 tools 侧）。
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
/** 「网页索引」刻意与 tools 的「网页搜索 / 网页内容提取」共用关键词，让 (a) 两侧都有行可数。 */
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
const WEB_SET = TOOLSETS[0]!;
const TOOLSET_ROWS = TOOLSETS.reduce((sum, set) => sum + set.tools.length, 0);
const ALL_TOOL_ROWS = TOOLSET_ROWS + SERVERS.servers.length;
const NEEDLE = "网页";
const NO_MATCH = "不存在的词";

const SKILLS_URL = "/agent-api/api/skills";
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
const EMPTY_GATE_TITLE = "当前没有可导出的条目。";

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return document.querySelector<T>(`[data-testid='${testid}']`);
}
function all(selector: string): Element[] {
  return [...document.querySelectorAll(selector)];
}
function allIn(node: Element | null, selector: string): Element[] {
  return node ? [...node.querySelectorAll(selector)] : [];
}
function tabButton(tabId: string): HTMLButtonElement | HTMLAnchorElement | null {
  return document.querySelector<HTMLButtonElement | HTMLAnchorElement>(`[role="tab"][data-tab="${tabId}"]`);
}
const skillRows = () => all("[data-testid^='skl4-row-']");
const toolRows = () => all("[data-testid='tol5-row']");
const copyButtons = () => all("button[data-testid^='cap-row-copy-']");
const sectionRows = (testid: string) => allIn(q(testid), "[data-testid='tol5-row']");
const sectionButtons = (testid: string) => allIn(q(testid), "button[data-testid^='cap-row-copy-']");
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
function mcpHead(): number {
  const match = /MCP 连接：(\d+) 个/.exec(q("tol5-mcp-section")?.textContent ?? "");
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
function assertUrlsPure(urls: string[]): void {
  for (const url of urls) {
    expect(url, `request URL must be query-free: ${url}`).not.toContain("?");
    for (const key of [...PAGE_LIKE, ...FOREIGN_KEYS]) {
      expect(url, `request URL must never carry ${key}=`).not.toContain(`${key}=`);
    }
  }
}

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  // 迭代计数而非 Date.now() 截止：壁钟截止在冻结时钟的用例里永不触发（R135 教训）。
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
function armTools() {
  api.fetchJsonStrict.mockReset();
  setToolsHandler();
}
async function settleTools(entry: string): Promise<void> {
  resetToolsTabState();
  resetCapabilityCounts();
  armTools();
  await render(entry, <ToolsPage />);
  await waitFor(
    () => toolRows().length > 0 || !!q("tol5-empty") || !!q("tol5-error") || !!q("tl3-no-match"),
    "tools settled",
  );
}
async function settleSkills(payload: unknown, entry: string): Promise<void> {
  resetSkillsTabState();
  resetCapabilityCounts();
  api.fetchJsonStrict.mockReset();
  setSkillsHandler(payload);
  await render(entry, <SkillsPage />);
  await waitFor(
    () => skillRows().length > 0 || !!q("skl4-empty") || !!q("skl4-error") || !!q("skl4-no-match"),
    "skills settled",
  );
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

describe("R223 (a) — 真壳条 + live slot：kind 与 q 一起走一个来回，分区三值在 tools 腿闭合", () => {
  it("carries an unread kind across both real tabs byte-for-byte, closes the sections on the way, and spends no second read", async () => {
    const fields = { tab: "tools", kind: "mcp", q: NEEDLE };
    resetSkillsTabState();
    resetToolsTabState();
    resetCapabilityCounts();
    armTools();
    await render(
      entryWith(fields),
      <ConsoleModulePage
        module="capabilities"
        live={{ skills: <SkillsPage />, tools: <ToolsPage />, models: <div />, channels: <div /> }}
      />,
    );
    await waitFor(() => toolRows().length > 0, "tools live slot settled");

    // 判别式：若 kind=mcp 真被读，名称含「网页」的都是工具集段，表体应为空集 —— 它不是空的。
    expect(toolRows(), "kind 不把表体收成 MCP 段").toHaveLength(WEB_SET.tools.length);
    expect(toolSources(), "命中的行全部来自工具集段").toEqual(["toolset", "toolset"]);
    // 分区内三值：段头 == 段内行数 == 段内按钮数（q 收窄后 web 集的两条）。
    expect(sectionRows("tol5-list"), "工具集段行数跟 q 走").toHaveLength(WEB_SET.tools.length);
    expect(sectionButtons("tol5-list"), "段内复制按钮与段内行数同数").toHaveLength(WEB_SET.tools.length);
    const mcpRows = sectionRows("tol5-mcp-section");
    expect(sectionButtons("tol5-mcp-section"), "MCP 段自己闭合").toHaveLength(mcpRows.length);
    expect(mcpRows, "夹具里 MCP 段没有名称含「网页」的条目").toHaveLength(0);
    const head = mcpHead();
    expect(head === 0 || head === -1, "MCP 段头要么写 0 个要么整卡收起").toBe(true);
    // 全局四个面跟同一个数。
    expect(countValue("tools"), "计数位跟筛后的表体走").toBe(String(WEB_SET.tools.length));
    expect(copyButtons(), "按钮总数就是段内那两个").toHaveLength(WEB_SET.tools.length);
    expect(scopeN(), "scope N 也是同一个数").toBe(WEB_SET.tools.length);
    expect(inputValue(), "搜索框按 ?q= 回填").toBe(NEEDLE);
    expect(paramsOf(), "kind 与 q 都在地址上").toEqual(fields);
    const firstLeg = [...reads()].sort();
    expect(firstLeg, "tools 这一趟就是六条裸路径").toEqual([...TOOL_URLS].sort());
    assertUrlsPure(reads());

    // 换 skills 的 stub 而不清调用史：那条读口要叠在已记账的六条之上。
    setSkillsHandler({ asOf: AS_OF, items: SKILL_ITEMS });
    await click(tabButton("skills"), "the skills tab button");
    await waitFor(() => skillRows().length > 0, "skills live slot settled");
    expect(toolRows(), "切走后 tools 的行整体卸载").toHaveLength(0);
    expect(skillNames(), "skills 侧 honour 同一个 q").toEqual(["网页索引"]);
    expect(countValue("skills"), "skills 计数位跟同一个筛后表体走").toBe("1");
    expect(copyButtons(), "屏上只剩 skills 那一枚行复制按钮").toHaveLength(1);
    expect(inputValue(), "切过来的 tab 自己把 q 回填").toBe(NEEDLE);
    // kind 逐字存活：地址上的参数集合仍是 kind+q+tab=skills。壳条给默认 tab 的链接不带
    // `tab=`（routes.ts:173），落回后 `useEnsureTabParam` 把 `tab=skills` 追加在末尾 ——
    // 键序 kind→q→tab，集合与取值不变（R216 ② 对 q 记过同一形状）。
    expect(paramsOf(), "kind 与 q 原样穿过壳条").toEqual({ kind: "mcp", q: NEEDLE, tab: "skills" });
    expect(searchOf(), "整趟地址的键序是 kind→q→tab").toBe(
      "?" + new URLSearchParams({ kind: "mcp", q: NEEDLE, tab: "skills" }).toString(),
    );
    const settled = reads().length;
    expect([...reads()].sort(), "skills 这一跳只付它自己的一条读口").toEqual([...TOOL_URLS, SKILLS_URL].sort());

    await click(tabButton("tools"), "the tools tab button");
    await waitFor(() => toolRows().length > 0, "tools came back");
    expect(reads(), "切回零新请求（模块缓存）；派工单 ② 的「零重复取数」就是这个数").toHaveLength(settled);
    expect(skillRows(), "回来之后 skills 的行再次整体卸载").toHaveLength(0);
    expect(sectionRows("tol5-list"), "工具集段的行回到筛后的两条").toHaveLength(WEB_SET.tools.length);
    expect(sectionButtons("tol5-list"), "段内按钮跟着回来").toHaveLength(WEB_SET.tools.length);
    expect(countValue("tools"), "计数位回到同一个 2").toBe(String(WEB_SET.tools.length));
    expect(scopeN(), "scope N 同步").toBe(WEB_SET.tools.length);
    expect(inputValue(), "搜索框仍是同一个词").toBe(NEEDLE);
    expect(paramsOf(), "kind 在 tools 侧也逐字活着").toEqual(fields);
    assertUrlsPure(reads());
  });
});

describe("R223 (b) — 非法 kind 叠无匹配 q：空态可读、地址不改、闸位不交文件", () => {
  it("says the empty in one readable sentence, keeps the stacked address byte-identical, and both gates refuse without spending a request", async () => {
    const fields = { tab: "tools", kind: "__nope__", q: NO_MATCH };
    await settleTools(entryWith(fields));

    expect(toolRows(), "无匹配 q 把表体收成空集").toHaveLength(0);
    expect(copyButtons(), "空集不渲染任何行复制按钮").toHaveLength(0);
    expect(countValue("tools"), "空集是真 0，不是「—」").toBe("0");
    const anchor = q("capF-state-filter-empty");
    expect(anchor, "可读空态锚在").toBeTruthy();
    const expected = stateAnchor({
      kind: "filter-empty",
      subject: "工具与 MCP 清单",
      reason: NO_MATCH,
      loaded: ALL_TOOL_ROWS,
    });
    expect(anchor?.textContent?.trim()).toBe(expected.lead + expected.detail);
    expect(anchor?.className).toContain("capF-state-text");
    expect(q("tl3-no-match"), "tools 的空态卡还在").toBeTruthy();

    // 叠加地址一字不改：kind 没被吞、q 没被抹。
    expect(paramsOf(), "两个参数都原样存活").toEqual(fields);
    expect(searchOf(), "整条地址逐字等于粘贴的那条").toBe("?" + new URLSearchParams(fields).toString());

    // 闸位：导出与复制都 disabled，共享同一句原因（gates 单点）。
    const exportButton = q<HTMLButtonElement>("cap6-export");
    const copyButton = q<HTMLButtonElement>("capC-copy");
    expect(exportButton, "导出闸 disabled").toBeTruthy();
    expect(copyButton, "复制闸 disabled").toBeTruthy();
    expect(exportButton!.disabled).toBe(true);
    expect(copyButton!.disabled).toBe(true);
    expect(q("cap-gates-export")?.getAttribute("title"), "导出闸原因句来自 gates 单点").toBe(EMPTY_GATE_TITLE);
    expect(q("cap-gates-copy")?.getAttribute("title"), "复制闸与导出闸同句").toBe(EMPTY_GATE_TITLE);

    const before = reads().length;
    expect(before, "首载就是六条裸路径").toBe(TOOL_URLS.length);
    await click(exportButton, "被禁用的导出钮（强点）");
    await click(copyButton, "被禁用的复制钮（强点）");
    expect(clipboard.copyTextToClipboard, "强点不写剪贴板").not.toHaveBeenCalled();
    expect(reads(), "强点不发任何请求").toHaveLength(TOOL_URLS.length);
    assertUrlsPure(reads());
    expect(q("cap-row-copy-fallback"), "没有偷偷展开兜底文本域").toBeNull();
  });
});

describe("R223 (c) — skills 侧的外来 kind：一跳读口、kind 惰性、四值同数、地址保参", () => {
  it("asks its single read path with an unread kind stacked on q, and keeps every param verbatim", async () => {
    const fields = { tab: "skills", kind: "__nope__", q: NEEDLE };
    await settleSkills({ asOf: AS_OF, items: SKILL_ITEMS }, entryWith(fields));

    expect(reads(), "skills 首载只有一条读口，kind/q 都不产生请求").toEqual([SKILLS_URL]);
    assertUrlsPure(reads());
    expect(skillNames(), "筛的是 q，不是 kind").toEqual(["网页索引"]);
    expect(countValue("skills"), "计数位跟筛后表体走").toBe("1");
    expect(copyButtons(), "行复制按钮与表体同数").toHaveLength(1);
    expect(scopeN(), "scope N 也是同一个 1").toBe(1);
    expect(inputValue(), "搜索框按 ?q= 回填").toBe(NEEDLE);
    expect(paramsOf(), "非法 kind 原样存活，没被读掉也没被抹掉").toEqual(fields);
    expect(searchOf(), "地址逐字等于粘贴的那条").toBe("?" + new URLSearchParams(fields).toString());
    for (const key of PAGE_LIKE) {
      expect(paramsOf(), `地址里不该出现 ${key}`).not.toHaveProperty(key);
    }
  });
});
