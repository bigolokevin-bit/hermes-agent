// @vitest-environment jsdom
/**
 * R188 — /capabilities 导出与筛选/排序同源（纯测试，零产品码改动）。
 *
 * 先 `git grep` 现查既有用面（派工单纪律），已覆盖只回证据与缺口：
 *  - ① 三值同源：`capabilities.rowparity.test.tsx` :196-210 已锁 `cap-page-scope` N == 表体行数 == 导出
 *    数据行数（注记排除）；`capabilities.counts.test.tsx`（R140）例①② 已锁 `cap4-count-<tab>` 值 == 表体
 *    == `cap-row-copy-*` 数 == `scopeN()`。缺的那一条边是「`cap4` 计数值直接进入导出等式」——两条链各自
 *    成立但从没在同一夹具里对撞。本文件例① 补这条边，并同夹具钉死表头逐字与 `cap6-export-count`。
 *  - ② 筛选/排序遵守：`capabilities.filterparity.test.tsx`（R88）三例已锁 skills `?q=&sort=&dir=`、skills
 *    仅排序、tools 排序后再 `?q=` 的「复制行序 == CSV 首列 == 表体 == scopeN」与 `calledUrls()` 不变。
 *    本文件不重写，只在例① 里把导出等式扩到四个面时沿用同一零请求判据。
 *    `?kind=` / `?toolset=` 本代无人读：`git grep 'get("kind")|kind=|get("toolset")|toolset='` 全仓命中的
 *    是 React 的 `kind` prop（`SystemHealthSurface.tsx`、`ToolsPage.tsx`、`RunsModulePage.tsx`）、
 *    knowledge/evidence 的注释与 `pages/SkillsPage.tsx:713` 的旧版 JSX prop，没有任何 URL 参读取。
 *    所以 ② 的「按 kind / toolset 筛选导出」在这一代没有对应机制，如实记录，不编造。
 *  - ③ 缺字段两面各自逐字：`csv.test.ts` 已在 helper 层钉了 null → 空单元格（`'"带""引号""",,待核实,'`），
 *    `rowparity` 例② 已在页面层钉了复制写「—」。缺口是「同一行在同一夹具里，导出空单元格与屏上/复制
 *    「—」并存且各自逐字、都不漏 undefined/null」——本文件例③ 补它。
 *    派工单点名的「描述 / 负责人 / 版本」在本面不存在：`CsvRow` 只有 name / type / enabled / updated_at
 *    四个槽位（`capabilities/csv.ts` :5-11），可缺的是 来源·类型 / 启用态 / 最近更新；名称缺失由
 *    `readSkills` 折成字面「—」而不是 null，这一不对称也如实断言。
 *  - ④ 空结果：已由 `filterparity` :239-249、`capabilities.empty.test.tsx`（R130）:184-223、
 *    `capabilities.counts.test.tsx`（R140）:253-261、`capabilities.stateanchor.test.tsx`（R101/R89）
 *    :198-200 四面覆盖（disabled + 同一 `EMPTY_EXPORT` 原因句 + `cap6-export-count`「0 条」+
 *    `cap4` 真 0 + 不渲染行与复制列 + 点击零剪贴板写入零新请求）。本文件不写重复用例，只回证据。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: (...args: unknown[]) => api.fetchJsonStrict(...args) }));
const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

import { SkillsPage, resetSkillsTabState } from "../skills/SkillsPage";
import { ToolsPage } from "../tools/ToolsPage";
import { resetToolsTabState } from "../tools/useToolsData";
import { resetCapabilityCounts } from "./counts";
import { resetTabView } from "./tabView";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root | null = null;

const AS_OF = "2026-11-19T06:00:00Z";
const SKILL_ITEMS = [
  { skillId: "s1", name: "会议纪要", scope: "builtin", status: "active", updatedAt: "2026-11-19T05:00:00Z" },
  { skillId: "s2", name: "资料整理", scope: "tenant-shared", status: "active", updatedAt: "2026-11-19T05:30:00Z" },
  { skillId: "s3", name: "日报生成", scope: "builtin", status: "active", updatedAt: "2026-11-19T04:00:00Z" },
  { skillId: "s4", name: "周报汇总", scope: "builtin", status: "active", updatedAt: "2026-11-19T04:30:00Z" },
];
/** One bare row: no name, no scope, no status, no updatedAt — every null-capable slot at once. */
const SPARSE_ITEMS = [{ skillId: "s9" }, SKILL_ITEMS[1]];
const TOOLSETS = [
  { name: "web", label: "网页搜索", enabled: true, configured: true, platform_label: "CLI", tools: ["web_search"] },
  { name: "kanban", label: "看板", enabled: false, configured: false, platform_label: "CLI", tools: ["kanban_create"] },
  { name: "report", label: "报表", enabled: true, configured: true, platform_label: "CLI", tools: ["report_build"] },
];
const SERVERS = { servers: [{ name: "文档检索", transport: "http", enabled: true, auth: "header" }] };
const HEADER = "name,type,enabled,updated_at";

function skillHandler(payload: unknown) {
  return (url?: string) => {
    if (!url) return Promise.resolve({ servers: [] });
    if (url.includes("/agent-api/api/skills")) return Promise.resolve(payload);
    return Promise.reject(new ApiError("unknown", { status: 404, body: "{}", url }));
  };
}
function toolsHandler(url?: string): Promise<unknown> {
  if (!url) return Promise.resolve({ servers: [] });
  if (url.startsWith("/agent-api/")) return Promise.reject(new ApiError("missing", { status: 404, body: "{}", url }));
  if (url.includes("/api/tools/toolsets")) return Promise.resolve(TOOLSETS);
  if (url.includes("/api/mcp/servers")) return Promise.resolve(SERVERS);
  return Promise.reject(new ApiError("unknown", { status: 404, body: "{}", url }));
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="cap8-location">{loc.search}</span>;
}
async function waitFor(cond: () => boolean, label: string): Promise<void> {
  // Iteration-bounded, never a Date.now() deadline: this file's fixtures are
  // plain but the shared idiom must survive a frozen clock in sibling suites.
  for (let i = 0; i < 600; i += 1) {
    if (cond()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`waitFor: ${label} never became true`);
}
async function render(entry: string, page: "skills" | "tools") {
  await act(async () => root?.unmount());
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        {page === "tools" ? <ToolsPage /> : <SkillsPage />}
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}
async function settleSkills(payload: unknown, entry: string) {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(skillHandler(payload));
  await render(entry, "skills");
  await waitFor(
    () => !!container.querySelector("[data-testid='skl4-table']") || !!container.querySelector("[data-testid='skl4-empty']"),
    "skills list settled",
  );
}
async function settleTools(entry: string) {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(toolsHandler);
  await render(entry, "tools");
  await waitFor(() => toolNames().length > 0 || !!q("tol5-empty"), "tools list settled");
}

const q = <T extends HTMLElement = HTMLElement>(testid: string) => container.querySelector<T>(`[data-testid='${testid}']`);
const skillRows = () => [...container.querySelectorAll("[data-testid^='skl4-row-']")];
const skillNames = () =>
  skillRows().map((tr) => tr.querySelectorAll(".skl4-cell")[0]?.firstElementChild?.textContent?.trim() ?? "");
/** The four visible cell values of one skills row, in export column order. */
function skillCells(index: number): string[] {
  const tr = skillRows()[index]!;
  return [0, 1, 2, 3].map((i) => tr.querySelectorAll(".skl4-cell")[i]?.firstElementChild?.textContent?.trim() ?? "");
}
const toolNames = () =>
  [...container.querySelectorAll("[data-testid='tol5-row']")].map(
    (tr) => tr.querySelector("[data-testid='tl3-name']")?.textContent?.trim() ?? "",
  );
const calledUrls = () =>
  api.fetchJsonStrict.mock.calls.map((call) => call[0]).filter((url): url is string => typeof url === "string");
function scopeN(): number | null {
  const match = (q("cap-page-scope")?.textContent ?? "").match(/(\d+)\s*项/);
  return match ? Number(match[1]) : null;
}
/** The number `cap4-count-<tab>` prints — the order's 「capF 计数」 has no such surface, this is the real one. */
function countValue(key: "skills" | "tools"): string {
  return q(`cap4-count-${key}`)?.querySelector(".cap4-count-value")?.textContent?.trim() ?? "";
}
/** Data rows only: header kept, trailing `#` scope note dropped, so N is comparable to the table. */
const dataLines = (csv: string) => csv.trim().split("\r\n").filter((line) => !line.startsWith("#"));
const firstColumn = (lines: string[]) => lines.slice(1).map((line) => line.split(",")[0]!);
async function copiedListText(): Promise<string> {
  let captured = "";
  clipboard.copyTextToClipboard.mockImplementation(async (text: string) => {
    captured = text;
    return true;
  });
  await act(async () => q("capC-copy")!.click());
  return captured;
}
async function copiedDetailText(): Promise<string> {
  let captured = "";
  clipboard.copyTextToClipboard.mockImplementation(async (text: string) => {
    captured = text;
    return true;
  });
  await act(async () => q("cap-row-copy")!.click());
  return captured;
}
async function exportedCsv(): Promise<string> {
  const blobs: Blob[] = [];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => {
    blobs.push(blob);
    return "blob:r188";
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = function click() {
    /* capture only */
  };
  try {
    await act(async () => q("cap6-export")!.click());
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    HTMLAnchorElement.prototype.click = originalClick;
  }
  expect(blobs[0]).toBeTruthy();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^\uFEFF/, ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blobs[0]!);
  });
}

beforeEach(() => {
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
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
});

describe("R188 — 导出行数与计数、表体在同一夹具里对撞", () => {
  it("skills — filtered and sorted: CSV data rows == table body == cap4 value == scope N, header verbatim, no extra read", async () => {
    await settleSkills({ asOf: AS_OF, items: SKILL_ITEMS }, "/capabilities?tab=skills&q=%E6%8A%A5&sort=name&dir=desc");
    const body = skillNames();
    expect(body).toEqual(["周报汇总", "日报生成"]);

    const csv = await exportedCsv();
    const lines = dataLines(csv);
    expect(lines[0]).toBe(HEADER);
    const n = lines.length - 1;
    // The edge no earlier file closed: the published count enters the export equation.
    expect(n).toBe(body.length);
    expect(countValue("skills")).toBe(String(n));
    expect(scopeN()).toBe(n);
    expect(q("cap6-export-count")?.textContent).toBe(`${n} 条`);
    expect(firstColumn(lines)).toEqual(body);
    // The export is a pure front-end projection: one read for the whole test.
    expect(calledUrls()).toEqual(["/agent-api/api/skills"]);
  });

  it("tools — sorted: the same four faces agree on the row count and the first exported row is the first row on screen", async () => {
    await settleTools("/capabilities?tab=tools&sort=name&dir=desc");
    const body = toolNames();
    // Three toolset tools (web / kanban / report, one each) plus one MCP server.
    expect(body.length).toBe(4);

    const csv = await exportedCsv();
    const lines = dataLines(csv);
    expect(lines[0]).toBe(HEADER);
    const n = lines.length - 1;
    expect(n).toBe(body.length);
    expect(countValue("tools")).toBe(String(n));
    expect(scopeN()).toBe(n);
    expect(q("cap6-export-count")?.textContent).toBe(`${n} 条`);
    expect(lines[1]!.split(",")[0]).toBe(body[0]);
    // The tools layer probes the gateway-prefixed variants first and falls back
    // to the same-origin paths, so six URLs are asked while only two answer; the
    // rows still come from those two. Pin the set, then pin that the export adds
    // nothing to it — the export is a pure front-end projection.
    expect(calledUrls().sort()).toEqual(
      [
        "/agent-api/api/tools",
        "/agent-api/api/mcp/servers",
        "/agent-api/api/tools/toolsets",
        "/api/tools",
        "/api/tools/toolsets",
        "/api/mcp/servers",
      ].sort(),
    );
    expect(calledUrls()).toContain("/api/tools/toolsets");
    expect(calledUrls()).toContain("/api/mcp/servers");
  });
});

describe("R188 — 缺字段在导出与屏上复制里各自逐字", () => {
  it("a bare row exports empty cells while the screen and the copy both say 「—」, and neither leaks undefined/null", async () => {
    await settleSkills({ asOf: AS_OF, items: SPARSE_ITEMS }, "/capabilities?tab=skills");
    // Screen: every absent slot renders the honest dash, and the name is folded
    // to 「—」 by readSkills rather than left null — that asymmetry is the product.
    expect(skillCells(0)).toEqual(["—", "—", "—", "—"]);
    expect(skillCells(1)).toEqual(["资料整理", "类型：团队共享", "正常", "2026-11-19 13:30"]);

    const csv = await exportedCsv();
    const lines = dataLines(csv);
    expect(lines[0]).toBe(HEADER);
    // Export: every slot is empty for a bare row. `SkillsPage.tsx:319` maps
    // `name === "—" ? null : name`, so the on-screen dash is folded back to an
    // empty cell on purpose — 「—」 is a display token, never CSV data.
    expect(lines[1]).toBe(",,,");
    expect(lines[2]).toBe("资料整理,类型：团队共享,正常,2026-11-19 13:30");
    expect(csv).not.toMatch(/undefined|null|NaN|\[object/);

    const copied = await copiedListText();
    const copyLines = copied.trim().split("\n");
    expect(copyLines[0]).toBe(HEADER);
    // Copy: the same row keeps the on-screen dash caliber in every slot.
    expect(copyLines[1]).toBe("—,—,—,—");
    expect(copyLines[2]).toBe("资料整理,类型：团队共享,正常,2026-11-19 13:30");
    expect(copied).not.toMatch(/undefined|null|NaN|\[object/);

    // The two faces differ only in how they spell absence; both are honest and
    // both are pinned verbatim, so neither can silently grow a fake 0.
    expect(lines.length).toBe(copyLines.length);
    expect(countValue("skills")).toBe("2");
    expect(calledUrls()).toEqual(["/agent-api/api/skills"]);
  });

  it("the row detail copy spells the same absences as labelled 「—」 lines without another read", async () => {
    await settleSkills({ asOf: AS_OF, items: SPARSE_ITEMS }, "/capabilities?tab=skills");
    await act(async () => {
      q("cap7-detail-toggle")!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => !!q("cap7-detail-skills"), "detail open");
    const detail = q("cap7-detail-skills")!;
    expect(detail.querySelector("[data-testid='cap7-detail-name']")?.textContent).toBe("—");
    expect(detail.querySelector("[data-testid='cap7-detail-type']")?.textContent).toBe("—");
    expect(detail.querySelector("[data-testid='cap7-detail-enabled']")?.textContent).toBe("—");
    expect(detail.querySelector("[data-testid='cap7-detail-updated']")?.textContent).toBe("—");
    const before = calledUrls().length;
    const copied = await copiedDetailText();
    expect(copied).toContain("口径名：—");
    expect(copied).toContain("类型或来源：—");
    expect(copied).toContain("启用态：—");
    expect(copied).toContain("最近更新：—");
    expect(copied).toContain("读口路径：/agent-api/api/skills");
    expect(copied).toContain("采集时刻：2026-11-19 14:00");
    expect(copied).not.toMatch(/undefined|null|NaN|\[object/);
    expect(calledUrls()).toHaveLength(before);
  });
});
