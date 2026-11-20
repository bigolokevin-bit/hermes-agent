// @vitest-environment jsdom
/**
 * R199 — /capabilities 读口请求契约护栏（纯测试，零产品码改动）
 *
 * 先查既有覆盖面（派工单纪律，逐条引用，不写重复）：
 * - ① 首载次数：`capabilities.tab.persist.test.tsx` 例 B1 钉了 skills 首载 `reads()`
 *   恰为 ["/agent-api/api/skills"]；`capabilities.export.test.tsx`（R188）钉了 tools
 *   排序后的六条 URL 全集（在导出点击之后）；`capabilities.filterparity.test.tsx`
 *   钉了 q 筛选下 skills 只有一条 URL 且复制/导出零请求。
 * - ② 切 tab：`filterparity` :281 用字符串替换 tab 手工重挂（断言 0 额外请求），
 *   从未挂真壳条；`tab.persist` A2 点了真壳条但挂的是无 live 槽的 ConsoleModulePage
 *   ⇒ PlannedBlock，零行零请求。
 * - ③ URL 保参：`deeplink` :204 与 `tab.persist` :125 的 PAGE_LIKE 守卫作用在**页面
 *   地址**上，没有任何用例检查**出去的请求 URL** 是否带参。
 * - ④ 失败与重试：`SkillsPage.test.tsx` :143-173 钉了首载失败（rid req-skills-1、
 *   capF-state-error、计数「—」不显 0、两个 gate disabled、重试恰 +1、恢复）；
 *   :175-196 钉了错误与重试之间 q/sort/dir 保参；:228-259 钉了 404 的 GAP 只在 title。
 *   `ToolsPage.test.tsx` :375-411 钉了 tools 500 的人话 + rid + 重试，但重试计数只
 *   断言 `> 0`（不精确），且从未钉过「一条腿失败、另一条腿的行留下」这半。
 *
 * 本文件只补四个真空：
 * (a) 出去的请求 URL 一律无查询串（无 cursor=/page=/limit=/toolset=/kind= 外溢），
 *     并在同一个契约里并列 skills 恰 1 条与 tools 恰 6 条；
 * (b) 真壳条 + 两个真页面挂 live 槽：行不共存（旧 tab 的行不残留），且切回**零新请求**
 *     （派工单写的「恰 +1 次」与产品相反，如实披露）；
 * (c) ④ 的「先成功后失败」序列 —— 既有失败用例全部是首载失败，屏上本来就没有旧行；
 *     产品行为是两侧都清行（与派工单「旧行保留」相反，披露），而 tools 的**部分**失败
 *     确实保留另一条腿的行 + 可见问题注记（没人钉过），并且此时计数说「—」不说局部数；
 * (d) tools 重试的精确请求数（今天只有 `> 0`）。
 *
 * 口径更正（派工单前提与本代产品不符处，一律按产品断言并在此留痕）：
 * - 「首屏恰 1 次读口请求」只对 skills 成立。tools 数据层一次挂载发六条路径：
 *   `fetchInventory()` 顺序探 `/agent-api/api/tools` → `/api/tools` →
 *   `/agent-api/api/tools/toolsets` → `/api/tools/toolsets`，`fetchServers()` 探
 *   `/agent-api/api/mcp/servers` → `/api/mcp/servers`；两条腿并发跑，六条 URL 的交错
 *   顺序不确定 ⇒ 按集合断言（`tools.ts` :19-24, :482-536）。本代只有后两条回答，
 *   前三条 404 ⇒ `fetchFirst` 继续走下一条。
 * - 「切 tab 恰 +1 次」与产品相反：两侧都有模块级缓存（`cachedSkillsState` /
 *   `cachedTools`），切回是 0 新请求 —— 壳条卸载非活动页，回来必须立刻还原同一视图且
 *   不再读那两个端点（`useToolsData.ts` 头注）。
 * - 「旧行保留」与产品相反：skills 的 `load()` 第一行就 `setState({k:"loading"})`，
 *   tools 的渲染行 `read.attempt === attempt ? read.settled : PENDING` 同理 —— 只要
 *   重新读取，行就先撤下；两侧都是这样，只有 tools 的**部分**失败保留活下来的那条腿。
 * - 能力面没有分页参数，也没有 `?toolset=` / `?kind=`（R91/R117、R184/R103、
 *   R197/R106 三条道各自 grep 确认；本代只有 `state`/`q`/`sort`/`dir`/`row` 被读）。
 * - `capF` 是状态锚族，没有计数面；计数在 `cap4-count-<tab>`(+`-state`)、
 *   `cap6-export-count`、`cap-page-scope`、`cap5-scope-note`。
 */
import { act } from "react";
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
    const rest = { ...props } as Record<string, unknown>;
    delete rest.outlined;
    return <button {...rest}>{children}</button>;
  },
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

import { ApiError } from "@/lib/api-error";
import { ConsoleModulePage } from "@/shell/console";
import { SkillsPage, resetSkillsTabState } from "../skills/SkillsPage";
import { ToolsPage } from "../tools/ToolsPage";
import { resetToolsTabState } from "../tools/useToolsData";
import { resetCapabilityCounts } from "./counts";
import { resetTabView } from "./tabView";

const AS_OF = "2026-11-19T06:00:00Z";
const SKILL_ITEMS = [
  { skillId: "sk_alpha42", name: "资料整理", source: "builtin", status: "active", updatedAt: "2026-11-19T05:30:00Z" },
  { skillId: "s2", name: "日报生成", scope: "tenant-shared", updatedAt: "2026-11-19T04:00:00Z" },
  { skillId: "s3", name: "周报汇总", scope: "tenant-shared", updatedAt: "2026-11-19T04:30:00Z" },
];
const TOOLSETS = [
  { name: "web", label: "Web Search", enabled: true, configured: true, platform_label: "CLI", tools: ["web_search", "web_extract"] },
  { name: "kanban", label: "Kanban", enabled: false, configured: false, platform_label: "CLI", tools: ["kanban_create"] },
];
const SERVERS = { servers: [{ name: "文档检索", transport: "http", enabled: true, auth: "header" }] };

const SKILLS_URL = "/agent-api/api/skills";
/** The six paths the tools data layer walks on one mount. Within a leg the order is
 * fixed; the two legs run concurrently, so the merged order is not — assert as a set. */
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
const EXTRA_KEYS = ["toolset", "kind"];
const RID = "req-cap-500";

let container: HTMLDivElement | null = null;
let root: Root | null = null;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return document.querySelector<T>(`[data-testid='${testid}']`);
}
function all(selector: string): Element[] {
  return [...document.querySelectorAll(selector)];
}
function tabButton(tabId: string): HTMLButtonElement | HTMLAnchorElement | null {
  return document.querySelector<HTMLButtonElement | HTMLAnchorElement>(`[role="tab"][data-tab="${tabId}"]`);
}
function textOf(testid: string): string {
  return q(testid)?.textContent?.trim() ?? "";
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
function skillRows(): Element[] {
  return all("[data-testid^='skl4-row-']");
}
function toolRows(): Element[] {
  return all("[data-testid='tol5-row']");
}
function skillNames(): string[] {
  return skillRows().map((row) => row.querySelectorAll(".skl4-cell")[0]?.firstElementChild?.textContent?.trim() ?? "");
}
function countValue(key: "skills" | "tools"): string {
  return q(`cap4-count-${key}`)?.querySelector(".cap4-count-value")?.textContent?.trim() ?? "";
}
function entryWith(fields: Record<string, string>): string {
  return `/capabilities?${new URLSearchParams(fields).toString()}`;
}
function skillsPayload(items: unknown[]) {
  return { asOf: AS_OF, items };
}
function serverError(rid: string) {
  return new ApiError("upstream exploded", { status: 500, body: "{}", url: "/api/tools/toolsets", requestId: rid });
}
function notWired(url: string) {
  return new ApiError("unknown route", { status: 404, body: "{}", url });
}

/** Iteration-bounded on purpose: no wall-clock deadline read via Date.now(). */
async function waitFor(cond: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="cap8-location">{loc.search}</span>;
}

async function render(entry: string, page: React.ReactNode) {
  await act(async () => root?.unmount());
  document.body.replaceChildren();
  const next = document.createElement("div");
  document.body.appendChild(next);
  container = next;
  root = createRoot(next);
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

/** Handler swap that KEEPS the call history — a contract test has to meter across
 * a tab switch, and `mockReset()` would erase the earlier tab's requests. */
function setSkillsHandler(payload: unknown) {
  api.fetchJsonStrict.mockImplementation(async (url?: unknown) => {
    if (url === undefined) return { servers: [] };
    const text = String(url);
    if (text === SKILLS_URL) return payload;
    throw notWired(text);
  });
}
function setToolsHandler(options: { inventoryError?: unknown; serversError?: unknown } = {}) {
  api.fetchJsonStrict.mockImplementation(async (url?: unknown) => {
    if (url === undefined) return { servers: [] };
    const text = String(url);
    if (INVENTORY_URLS.includes(text)) {
      if (options.inventoryError) throw options.inventoryError;
      // Only the last path answers this generation; the three probes before it 404.
      if (text === "/api/tools/toolsets") return TOOLSETS;
      throw notWired(text);
    }
    if (SERVER_URLS.includes(text)) {
      if (options.serversError) throw options.serversError;
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
function armTools(options: { inventoryError?: unknown; serversError?: unknown } = {}) {
  api.fetchJsonStrict.mockReset();
  setToolsHandler(options);
}

async function settleSkills(payload: unknown, entry: string) {
  resetSkillsTabState();
  resetCapabilityCounts();
  armSkills(payload);
  await render(entry, <SkillsPage />);
  await waitFor(() => skillRows().length > 0 || !!q("skl4-empty") || !!q("skl4-error") || !!q("skl4-no-match"), "skills settled");
}

async function settleTools(entry: string, options: { inventoryError?: unknown; serversError?: unknown } = {}) {
  resetToolsTabState();
  resetCapabilityCounts();
  armTools(options);
  await render(entry, <ToolsPage />);
  await waitFor(() => toolRows().length > 0 || !!q("tol5-empty") || !!q("tol5-error"), "tools settled");
}

async function click(node: Element | null, label: string) {
  if (!node) throw new Error(`${label} is not on screen`);
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
  window.history.replaceState({}, "", "/capabilities?tab=skills");
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

describe("R199 ① — 出去的请求就是读口路径本身", () => {
  it("skills asks its one read path and tools asks its six, and not one URL carries a query string", async () => {
    await settleSkills(skillsPayload(SKILL_ITEMS), entryWith({ tab: "skills", q: "报", sort: "name", dir: "desc" }));
    const skillsUrls = reads();
    expect(skillsUrls, "skills 首载必须恰好一条读口路径").toEqual([SKILLS_URL]);
    // The needle and the sort are local: two rows on screen, still one request.
    expect(skillNames()).toEqual(["周报汇总", "日报生成"]);
    expect(paramsOf(), "筛选与排序只写在页面地址上").toEqual({ tab: "skills", q: "报", sort: "name", dir: "desc" });
    for (const url of skillsUrls) {
      expect(url, `request URL must be query-free: ${url}`).not.toContain("?");
      for (const key of [...PAGE_LIKE, ...EXTRA_KEYS]) {
        expect(url, `request URL must never carry ${key}=`).not.toContain(`${key}=`);
      }
    }

    await settleTools(entryWith({ tab: "tools", q: "网页" }));
    const toolsUrls = reads();
    expect([...toolsUrls].sort(), "tools 首载必须恰好走完六条路径").toEqual([...TOOL_URLS].sort());
    for (const url of toolsUrls) {
      expect(url, `request URL must be query-free: ${url}`).not.toContain("?");
      for (const key of [...PAGE_LIKE, ...EXTRA_KEYS]) {
        expect(url, `request URL must never carry ${key}=`).not.toContain(`${key}=`);
      }
    }
    expect(toolRows(), "本地筛选不加请求").toHaveLength(2);
    expect(paramsOf()).toEqual({ tab: "tools", q: "网页" });
  });
});

describe("R199 ② — 真壳条切 tab：行不共存，切回零新请求", () => {
  it("unmounts the inactive page so the two tabs' rows never coexist, and coming back reads nothing again", async () => {
    // No `q` here on purpose: the shell preserves q across tabs, so a skills-only
    // needle would legitimately empty the tools list and the row non-coexistence
    // could not be metered positively. q-preservation is pinned by R88 filterparity.
    const entry = entryWith({ tab: "skills", sort: "name", dir: "desc" });
    resetSkillsTabState();
    resetToolsTabState();
    resetCapabilityCounts();
    armSkills(skillsPayload(SKILL_ITEMS));
    await render(
      entry,
      <ConsoleModulePage
        module="capabilities"
        live={{ skills: <SkillsPage />, tools: <ToolsPage />, models: <div />, channels: <div /> }}
      />,
    );
    await waitFor(() => skillRows().length > 0, "skills live slot settled");
    const skillsOrder = skillNames();
    expect(skillsOrder, "无 q 时三行全在，按 name desc").toEqual(["资料整理", "周报汇总", "日报生成"]);
    expect(toolRows(), "skills tab 上不得出现 tools 的行").toHaveLength(0);
    expect(reads()).toEqual([SKILLS_URL]);
    expect(tabButton("tools"), "壳条必须有 tools 这一档").toBeTruthy();

    // Swap the stub WITHOUT resetting: the six tools paths are metered on top of the
    // one skills read already on the ledger.
    setToolsHandler();
    await click(tabButton("tools"), "the tools tab button");
    await waitFor(() => toolRows().length > 0, "tools live slot settled");
    expect(skillRows(), "切走后 skills 的行必须整体卸载，不是藏在 DOM 里").toHaveLength(0);
    expect(q("skl4-table")).toBeNull();
    expect(toolRows()).toHaveLength(4);
    expect([...reads()].sort(), "切到 tools 只付它自己的六条路径").toEqual([...TOOL_URLS.slice(), SKILLS_URL].sort());
    expect(paramsOf(), "壳条把 sort/dir 原样带过去，只换 tab").toEqual({ tab: "tools", sort: "name", dir: "desc" });

    // Coming back is a cache read: zero new requests, same rows, same order.
    const settled = reads().length;
    await click(tabButton("skills"), "the skills tab button");
    await waitFor(() => skillRows().length > 0, "skills came back");
    expect(reads(), "切回不得再发请求（模块缓存）；派工单的「恰 +1 次」与产品相反").toHaveLength(settled);
    expect(toolRows()).toHaveLength(0);
    expect(skillNames(), "回来的行集与首载逐字同").toEqual(skillsOrder);
    // The strip link for the DEFAULT tab carries no `tab=` (routes.ts:173), but the
    // skills page that mounts behind it writes `tab=skills` back with `replace`
    // (`useEnsureTabParam`), so the address lands where it started. Both writes are
    // free of requests — the count above is the contract, this is the shape.
    expect(paramsOf()).toEqual({ tab: "skills", sort: "name", dir: "desc" });
  });
});

describe("R199 ③ — 搜索与排序只写页面地址，一次请求都不加", () => {
  it("typing a needle and cycling the sort changes only q/sort/dir, never adds a read", async () => {
    await settleSkills(skillsPayload(SKILL_ITEMS), entryWith({ tab: "skills" }));
    expect(reads()).toEqual([SKILLS_URL]);
    expect(skillRows()).toHaveLength(3);

    const input = q<HTMLInputElement>("cap5-search")!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(input, "报");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => skillRows().length === 2, "needle narrowed the list to two");
    expect(reads(), "本地筛选不发请求").toEqual([SKILLS_URL]);
    expect(paramsOf()).toEqual({ tab: "skills", q: "报" });

    await click(q("cap8-sort-name"), "the name sort head");
    expect(paramsOf()).toEqual({ tab: "skills", q: "报", sort: "name", dir: "asc" });
    expect(reads(), "排序也不发请求").toEqual([SKILLS_URL]);
    expect(skillNames()).toEqual(["日报生成", "周报汇总"]);

    await click(q("cap8-sort-name"), "the name sort head again");
    expect(paramsOf()).toEqual({ tab: "skills", q: "报", sort: "name", dir: "desc" });
    expect(reads()).toEqual([SKILLS_URL]);
    expect(skillNames()).toEqual(["周报汇总", "日报生成"]);

    const keys = Object.keys(paramsOf());
    for (const key of [...PAGE_LIKE, ...EXTRA_KEYS]) {
      expect(keys, `URL must never grow a ${key} key`).not.toContain(key);
    }

    await click(q("cap5-clear"), "the search clear button");
    await waitFor(() => skillRows().length === 3, "clearing restores every row");
    expect(paramsOf()).toEqual({ tab: "skills", sort: "name", dir: "desc" });
    expect(reads(), "清空搜索同样零请求").toEqual([SKILLS_URL]);
  });
});

describe("R199 ④ — 先成功后失败：行撤下是可读错误态，重试恰 +1", () => {
  it("a failed re-read withdraws the rows into an error anchor carrying the rid, and one retry is one request", async () => {
    await settleSkills(skillsPayload(SKILL_ITEMS), entryWith({ tab: "skills" }));
    expect(skillRows()).toHaveLength(3);
    expect(countValue("skills")).toBe("3");

    // Next read fails. The same handler backs 重新读取 and 重试 (SkillsPage.tsx:239).
    setSkillsHandler(null);
    api.fetchJsonStrict.mockImplementation(async (url?: unknown) => {
      if (url === undefined) return { servers: [] };
      throw serverError(RID);
    });
    await click(q("skl4-refresh"), "the 重新读取 button");
    await waitFor(() => !!q("skl4-error"), "the re-read landed in the error card");
    expect(skillRows(), "产品行为：重新读取先撤行（load 第一行就是 setState loading）；派工单的「旧行保留」与产品相反").toHaveLength(0);
    expect(q("skl4-loading")).toBeNull();
    expect(textOf("capF-state-error")).toContain("技能列表暂时无法读取");
    expect(q("capF-state-unavailable")).toBeNull();
    expect(document.body.textContent).toContain(RID);
    expect(countValue("skills")).toBe("—");
    expect(q<HTMLButtonElement>("cap6-export")!.disabled).toBe(true);
    expect(q<HTMLButtonElement>("capC-copy")!.disabled).toBe(true);

    // Restore the read, then retry exactly once.
    const atError = reads().length;
    setSkillsHandler(skillsPayload(SKILL_ITEMS));
    await click(q("skl4-retry"), "the 重试 button");
    await waitFor(() => skillRows().length === 3, "the retry brought the rows back");
    expect(reads(), "一次重试就是再一次该读口请求").toHaveLength(atError + 1);
    expect(reads().slice(atError), "重试走的路径还是那一条").toEqual([SKILLS_URL]);
    expect(q("skl4-error")).toBeNull();
    expect(q("capF-state-error")).toBeNull();
    expect(countValue("skills")).toBe("3");
    expect(document.body.textContent).not.toContain(RID);
    expect(q<HTMLButtonElement>("cap6-export")!.disabled).toBe(false);
  });

  it("tools keeps the surviving leg's rows when only one leg fails, and its retry is exactly six requests", async () => {
    await settleTools(entryWith({ tab: "tools" }));
    expect(toolRows()).toHaveLength(4);
    expect(countValue("tools")).toBe("4");
    expect(reads()).toHaveLength(6);

    // Only the MCP leg fails: the toolset rows stay, and the count says 「—」 rather
    // than publishing a partial total as if it were the whole list.
    setToolsHandler({ serversError: serverError(RID) });
    await click(q("tol5-refresh"), "the tools 重新读取 button");
    await waitFor(() => toolRows().length === 3, "the surviving leg keeps its three toolset rows");
    expect(q("tol5-error"), "一条腿失败不是整页失败").toBeNull();
    const issues = all("[data-testid^='tol5-issue-']");
    expect(issues, "失败的那条腿给一枚可见注记").toHaveLength(1);
    expect(issues[0]!.textContent).toContain("MCP 连接没有读到");
    expect(issues[0]!.textContent).toContain(RID);
    expect(countValue("tools"), "部分失败不折算局部数为总数：计数位是「—」").toBe("—");
    expect(textOf("cap-page-scope")).toContain("无法判断总数");
    expect(reads(), "部分失败仍然只付六条路径").toHaveLength(12);

    // Both legs fail: the whole list is withdrawn and the page panel speaks with the rid.
    setToolsHandler({ inventoryError: serverError(RID), serversError: serverError(RID) });
    await click(q("tol5-refresh"), "the tools 重新读取 button again");
    await waitFor(() => !!q("tol5-error"), "both legs down is a page failure");
    expect(toolRows(), "整页失败撤行（与 skills 同口径，派工单的「旧行保留」不成立）").toHaveLength(0);
    expect(textOf("capF-state-error")).toContain("工具与 MCP 清单没能加载出来");
    expect(document.body.textContent).toContain(RID);
    expect(countValue("tools")).toBe("—");
    expect(q<HTMLButtonElement>("cap6-export")!.disabled).toBe(true);
    const beforeRetry = reads().length;
    expect(beforeRetry).toBe(18);

    // Retry: exactly the six paths again — the count `ToolsPage.test.tsx` leaves as `> 0`.
    setToolsHandler();
    await click(q("tol5-retry"), "the tools 重试 button");
    await waitFor(() => toolRows().length === 4, "the retry restored both legs");
    const retried = reads().slice(beforeRetry);
    expect([...retried].sort(), "重试就是那六条路径，一条不多一条不少").toEqual([...TOOL_URLS].sort());
    expect(q("tol5-error")).toBeNull();
    expect(q("capF-state-error")).toBeNull();
    expect(all("[data-testid^='tol5-issue-']")).toHaveLength(0);
    expect(countValue("tools")).toBe("4");
  });
});
