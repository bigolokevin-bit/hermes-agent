// @vitest-environment jsdom
/**
 * R140 — /capabilities 计数与筛选后行数的三值同源护栏（纯测试，零产品码改动）。
 *
 * 现查（git grep）结论，如实记录：
 * - 派工单说的「capF 计数」这一面不存在：`capF-` 前缀只有状态锚（capF-state-* /
 *   capF-retry / capF-state-empty-text，见 stateAnchor.tsx 与 counts.css）。真正的计数面是
 *   `cap4-count-skills` / `cap4-count-tools`（counts.tsx 的 CountItem：值 + 来源态）、
 *   `cap6-export-count`、`cap-page-scope`、`cap5-scope-note`。本文件按真实面断言。
 * - 能力面没有「按类型筛选」：只有 `cap5-search` 的名称本地过滤（BFF 读口不吃 q）。
 *   ② 因此用 ?q= 收窄实现，并额外钉住「计数跟可见行走，不跟已加载行数走」。
 * - 工具集没有子表下钻：真实结构是两张分区卡（tol5-list 工具与工具集 / tol5-mcp-section
 *   MCP 连接）+ 每行可展开的 cap7-detail-tools。③ 用「分区计数 == 分区行数」与
 *   「展开→收起后三值复原」实现，即派工单的「下钻/返回上层」。
 * - 既有覆盖（只回证据不重复）：R128 rowcopybtn ②（q 过滤后 cap-row-copy-0 与表体同序、
 *   空集零按钮）、R130 empty ①②③④⑤⑥⑦（no-match 锚逐字、两钮 disabled 同因句、
 *   清空后行数与按钮数复原、深链不改 URL）、R88 filterparity（scopeN 三面向锁步）、
 *   R87 rowparity（scope N == 表体 == 导出行数）。本文件补的是「cap4 计数值」进入同一等式，
 *   以及分区级计数与空态下的真 0。
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
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
import { SkillsPage, resetSkillsTabState } from "../skills/SkillsPage";
import { ToolsPage } from "../tools/ToolsPage";
import { resetToolsTabState } from "../tools/useToolsData";
import { resetCapabilityCounts } from "./counts";
import { resetTabView } from "./tabView";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

const AS_OF = "2026-11-19T06:00:00Z";
const SKILL_ITEMS = [
  { skillId: "sk_alpha42", name: "资料整理", scope: "builtin", status: "active", updatedAt: "2026-11-19T05:30:00Z" },
  { skillId: "s2", name: "日报生成", scope: "tenant-shared", status: "active", updatedAt: "2026-11-19T04:00:00Z" },
  { skillId: "s3", name: "周报汇总", scope: "tenant-shared", status: "active", updatedAt: "2026-11-19T03:00:00Z" },
];
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
const NO_MATCH = "不存在的词";

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return document.querySelector<T>(`[data-testid='${testid}']`);
}
function reads(): string[] {
  return api.fetchJsonStrict.mock.calls.map((call) => String(call[0])).filter((url) => url !== "undefined");
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
async function render(entry: string, page: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter>);
  });
  await act(async () => {});
}
function skillsEntry(query: Record<string, string>): string {
  return `/capabilities?${new URLSearchParams({ tab: "skills", ...query }).toString()}`;
}
function toolsEntry(query: Record<string, string>): string {
  return `/capabilities?${new URLSearchParams({ tab: "tools", ...query }).toString()}`;
}
async function settleSkills(payload: unknown, entry = skillsEntry({})): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(async (url: unknown) => {
    if (String(url).startsWith("/agent-api/api/skills")) return payload;
    throw new ApiError("missing", { status: 404, body: "{}", url: String(url) });
  });
  await render(entry, <SkillsPage />);
  await waitFor(
    () => !!q("skl4-table") || !!q("skl4-empty") || !!q("skl4-error") || !!q("skl4-no-match"),
    "skills settled",
  );
}
async function settleTools(entry = toolsEntry({})): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(async (url?: unknown) => {
    if (url === undefined) return { servers: [] };
    const text = String(url);
    if (text.startsWith("/agent-api/")) throw new ApiError("missing", { status: 404, body: "{}", url: text });
    if (text.startsWith("/api/tools/toolsets")) return TOOLSETS;
    if (text.startsWith("/api/mcp/servers")) return SERVERS;
    throw new ApiError("unknown", { status: 404, body: "{}", url: text });
  });
  await render(entry, <ToolsPage />);
  await waitFor(() => toolRowsAll().length > 0 || !!q("tol5-empty"), "tools settled");
}

const bodyRows = () => [...document.querySelectorAll("[data-testid^='skl4-row-']")];
const toolRowsAll = () => [...document.querySelectorAll("[data-testid='tol5-row']")];
const copyButtons = () => [...document.querySelectorAll<HTMLButtonElement>("button[data-testid^='cap-row-copy-']")];
/** The number the count strip actually prints for one tab. */
function countValue(key: "skills" | "tools"): string {
  return q(key === "skills" ? "cap4-count-skills" : "cap4-count-tools")?.querySelector(".cap4-count-value")?.textContent ?? "";
}
function countState(key: "skills" | "tools"): string {
  return q(key === "skills" ? "cap4-count-skills-state" : "cap4-count-tools-state")?.textContent ?? "";
}
function sectionCount(testid: string): number {
  const match = /(\d+)/.exec(q(testid)?.textContent ?? "");
  return match ? Number(match[1]) : -1;
}
function scopeN(): number {
  const match = /(\d+)\s*项/.exec(q("cap-page-scope")?.textContent ?? "");
  return match ? Number(match[1]) : -1;
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
  document.body.replaceChildren();
  container?.remove();
  container = null;
  vi.useRealTimers();
});

describe("R140 — /capabilities 计数与行数的三值同源", () => {
  it("unfiltered: cap4 count == table body rows == cap-row-copy-* count on skills", async () => {
    await settleSkills({ asOf: AS_OF, items: SKILL_ITEMS });
    const rows = bodyRows().length;
    expect(rows).toBe(3);
    expect(countValue("skills")).toBe(String(rows));
    expect(countState("skills")).toBe("有源");
    expect(copyButtons().length).toBe(rows);
    expect(scopeN()).toBe(rows);
    // The other tab has not been read on this mount: its slot stays honest, not 0.
    expect(countValue("tools")).toBe("—");
    expect(countState("tools")).toBe("未取数");
    const before = reads().length;
    await copyButtons()[0].click();
    await act(async () => {
      await Promise.resolve();
    });
    expect(reads().length).toBe(before);
  });

  it("a ?q= narrowing moves all three values together, and the count follows visible rows not loaded rows", async () => {
    await settleSkills({ asOf: AS_OF, items: SKILL_ITEMS }, skillsEntry({ q: "报" }));
    const rows = bodyRows().length;
    expect(rows).toBe(2);
    expect(countValue("skills")).toBe(String(rows));
    expect(copyButtons().length).toBe(rows);
    expect(scopeN()).toBe(rows);
    // 已加载 3 项 / 可见 2 项 stay distinct: the count is the visible number.
    expect(q("cap5-scope-note")?.textContent).toContain("仅在当前已加载 3 项内搜索");
    expect(countValue("skills")).not.toBe("3");
    // Same triple on tools, driven by a needle taken from the rendered names.
    await settleTools(toolsEntry({}));
    const all = toolRowsAll().length;
    expect(all).toBe(3 + 2);
    expect(countValue("tools")).toBe(String(all));
    expect(copyButtons().length).toBe(all);
    const needle = (q("tl3-name")?.textContent ?? "").slice(0, 2);
    await settleTools(toolsEntry({ q: needle }));
    const filtered = toolRowsAll().length;
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(all);
    expect(countValue("tools")).toBe(String(filtered));
    expect(copyButtons().length).toBe(filtered);
    expect(scopeN()).toBe(filtered);
  });

  it("tools sections: each section count matches its own rows, and an expand-collapse round trip restores all three", async () => {
    await settleTools(toolsEntry({}));
    const sectionRows = [...(q("tol5-list")?.querySelectorAll("[data-testid='tol5-row']") ?? [])].length;
    const mcpSectionRows = [...(q("tol5-mcp-section")?.querySelectorAll("[data-testid='tol5-row']") ?? [])].length;
    expect(sectionCount("tol5-tools-head")).toBe(sectionRows);
    // The MCP header carries no testid, so its sentence is matched inside its own card.
    expect(q("tol5-mcp-section")?.textContent).toContain(`MCP 连接：${mcpSectionRows} 个`);
    expect(sectionRows + mcpSectionRows).toBe(toolRowsAll().length);
    expect(Number(countValue("tools"))).toBe(sectionRows + mcpSectionRows);
    expect(copyButtons().length).toBe(sectionRows + mcpSectionRows);

    // 下钻：展开一行详情（本代唯一的下钻面），三值不应被下钻改变。
    const firstToggle = toolRowsAll()[0].querySelector<HTMLButtonElement>("[data-testid='cap7-detail-toggle']")!;
    await act(async () => {
      firstToggle.click();
    });
    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']")).toHaveLength(1);
    expect(sectionCount("tol5-tools-head")).toBe(sectionRows);
    expect(Number(countValue("tools"))).toBe(sectionRows + mcpSectionRows);
    expect(copyButtons().length).toBe(sectionRows + mcpSectionRows);

    // 返回上层：收起后行数、分区计数、按钮数逐字复原。
    const close = toolRowsAll()[0].querySelector<HTMLButtonElement>("[data-testid='cap-row-close']")!;
    await act(async () => {
      close.click();
    });
    expect(document.querySelectorAll("[data-testid='cap7-detail-tools']")).toHaveLength(0);
    expect([...(q("tol5-list")?.querySelectorAll("[data-testid='tol5-row']") ?? [])].length).toBe(sectionRows);
    expect([...(q("tol5-mcp-section")?.querySelectorAll("[data-testid='tol5-row']") ?? [])].length).toBe(mcpSectionRows);
    expect(sectionCount("tol5-tools-head")).toBe(sectionRows);
    expect(Number(countValue("tools"))).toBe(sectionRows + mcpSectionRows);
    expect(copyButtons().length).toBe(sectionRows + mcpSectionRows);
    expect(scopeN()).toBe(sectionRows + mcpSectionRows);
  });

  it("empty result: the count shows a real 0, no row and no copy button render, and both gates stay disabled", async () => {
    await settleSkills({ asOf: AS_OF, items: SKILL_ITEMS }, skillsEntry({ q: NO_MATCH }));
    expect(bodyRows().length).toBe(0);
    expect(copyButtons().length).toBe(0);
    expect(countValue("skills")).toBe("0");
    expect(countState("skills")).toBe("有源（空）");
    expect(q("cap6-export-count")?.textContent).toBe("0 条");
    expect((q("cap6-export") as HTMLButtonElement).disabled).toBe(true);
    expect((q("capC-copy") as HTMLButtonElement).disabled).toBe(true);
    expect(q("cap-gates-export")?.getAttribute("title")).toBe("当前没有可导出的条目。");
    expect(q("cap-gates-copy")?.getAttribute("title")).toBe(q("cap-gates-export")?.getAttribute("title"));
    expect(scopeN()).toBe(0);
    const before = reads().length;
    await act(async () => {
      q<HTMLButtonElement>("cap6-export")?.click();
      q<HTMLButtonElement>("capC-copy")?.click();
      await Promise.resolve();
    });
    expect(clipboard.copyTextToClipboard).not.toHaveBeenCalled();
    expect(reads().length).toBe(before);

    // A genuinely empty read口 is the same honest 0, without a search term.
    // The skills tab caches its last settled read, so the cache must be dropped
    // before a second mount in the same test actually re-reads.
    resetSkillsTabState();
    await settleSkills({ asOf: AS_OF, items: [] });
    expect(bodyRows().length).toBe(0);
    expect(copyButtons().length).toBe(0);
    expect(countValue("skills")).toBe("0");
    expect(countState("skills")).toBe("有源（空）");
  });
});
