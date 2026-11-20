// @vitest-environment jsdom
// R130: filtered-empty and empty-set guards on /capabilities (skills + tools).
// Only gaps are covered — the pre-check found existing cases elsewhere:
// * filterparity ② already pins the disabled copy/export gates + shared gate
//   sentence on skills no-match (this file adds the zero-request half and the
//   tools side, and the R128 indexed buttons being absent);
// * deeplink test 2 already pins tools missing-row + q (this file adds the
//   missing-row WITHOUT q, and the skills URL-rewrites-nothing guard that
//   SkillsPage.test 「reports a missing row」 never asserted);
// * the clear buttons were clicked on tools only (rows restored, no copy-count
//   check) and never clicked on skills at all (this file restores both, and
//   asserts cap-row-copy-* counts and zero refetch).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { ApiError } from "@/lib/api-error";
import { SkillsPage, resetSkillsTabState } from "../skills/SkillsPage";
import { ToolsPage } from "../tools/ToolsPage";
import { resetToolsTabState } from "../tools/useToolsData";
import { resetCapabilityCounts } from "./counts";
import { ROW_GAP } from "./rowLink";
import { stateAnchor } from "./stateAnchor";
import { resetTabView } from "./tabView";

const AS_OF = "2026-11-19T06:00:00Z";
const SKILL_ITEMS = [
  { skillId: "sk_alpha42", name: "资料整理", source: "builtin", scope: "tenant-shared", status: "active", updatedAt: "2026-11-19T05:30:00Z" },
  { skillId: "s2", status: "mystery" },
  { name: "值守清理", enabled: false },
];
const LINE_0 = "名称：资料整理 · 类型：平台内置 · 状态：正常 · 调用次数：— · 短码：SKALPHA4";
const TOOLSETS = [{ name: "web", label: "Web Search", enabled: true, configured: true, tools: ["web_search"] }];
const SERVERS = { servers: [{ name: "文档检索", transport: "http", enabled: true, auth: "header" }] };
const NO_MATCH = "不存在的词";

let root: Root | null = null;
let container: HTMLDivElement | null = null;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return document.querySelector<T>(`[data-testid='${testid}']`);
}
function LocationProbe(): React.ReactElement {
  const loc = useLocation();
  return <span data-testid="cap8-location">{loc.search}</span>;
}
function reads(): string[] {
  return api.fetchJsonStrict.mock.calls.map((c) => String(c[0])).filter((u) => u !== "undefined");
}
function searchOf(): string {
  return q("cap8-location")?.textContent ?? "";
}
function paramsOf(): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(searchOf()));
}
function skillRows(): Element[] {
  return [...document.querySelectorAll("[data-testid^='skl4-row-']")];
}
function toolRows(): Element[] {
  return [...document.querySelectorAll("[data-testid='tol5-row']")];
}
function copyButtons(): NodeListOf<Element> {
  return document.querySelectorAll("[data-testid^='cap-row-copy-']");
}
async function waitFor(cond: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 3000;
  while (!cond()) {
    if (Date.now() > deadline) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  }
}
async function render(entry: string, page: "skills" | "tools"): Promise<void> {
  await act(async () => { root?.unmount(); });
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
function armSkills(payload: unknown): void {
  api.fetchJsonStrict.mockImplementation((url: unknown) =>
    String(url).includes("/agent-api/api/skills")
      ? Promise.resolve(payload)
      : Promise.reject(new ApiError("missing", { status: 404, body: "{}", url: String(url) })),
  );
}
function armTools(): void {
  api.fetchJsonStrict.mockImplementation((url?: unknown) => {
    if (url === undefined) return Promise.resolve({ servers: [] });
    const u = String(url);
    if (u.includes("/agent-api/")) return Promise.reject(new ApiError("missing", { status: 404, body: "{}", url: u }));
    if (u.includes("/api/tools/toolsets")) return Promise.resolve(TOOLSETS);
    if (u.includes("/api/mcp/servers")) return Promise.resolve(SERVERS);
    return Promise.reject(new ApiError("unknown", { status: 404, body: "{}", url: u }));
  });
}
async function settleSkills(payload: unknown, entry = "/capabilities?tab=skills"): Promise<void> {
  api.fetchJsonStrict.mockReset();
  armSkills(payload);
  await render(entry, "skills");
  await waitFor(
  () => !!q("skl4-table") || !!q("skl4-empty") || !!q("skl4-error") || !!q("skl4-no-match"),
  "skills settled",
);
}
async function settleTools(entry = "/capabilities?tab=tools"): Promise<void> {
  api.fetchJsonStrict.mockReset();
  armTools();
  await render(entry, "tools");
  await waitFor(
  () => toolRows().length > 0 || !!q("tol5-empty") || !!q("tl3-no-match"),
  "tools settled",
);
}
function skillsEntry(extra: Record<string, string>): string {
  return `/capabilities?${new URLSearchParams({ tab: "skills", ...extra }).toString()}`;
}
function toolsEntry(extra: Record<string, string>): string {
  return `/capabilities?${new URLSearchParams({ tab: "tools", ...extra }).toString()}`;
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
  act(() => { root?.unmount(); });
  root = null;
  document.body.replaceChildren();
  container?.remove();
  container = null;
  vi.useRealTimers();
});

describe("filtered empty state on skills", () => {
  it("reads the filter-empty anchor aloud and never counts the loaded rows as 0", async () => {
    await settleSkills({ asOf: AS_OF, items: SKILL_ITEMS }, skillsEntry({ q: NO_MATCH }));
    expect(q("skl4-no-match")).toBeTruthy();
    expect(skillRows()).toHaveLength(0);
    const anchor = q("capF-state-filter-empty");
    const expected = stateAnchor({ kind: "filter-empty", subject: "技能", reason: NO_MATCH, loaded: SKILL_ITEMS.length });
    expect(anchor?.textContent?.trim()).toBe(expected.lead + expected.detail);
    // The anchor speaks the LOADED count, not the filtered 0 — 「不计入 0 行」.
    expect(anchor?.textContent).not.toContain("0 项");
    expect(q("cap5-scope-note")?.textContent).toContain("仅在当前已加载 3 项内搜索");
    // The readable exit: a clear button plus a destination in the anchor title.
    expect(q("skl4-clear")).toBeTruthy();
    expect(anchor?.getAttribute("title")).toContain("去处：清空搜索词恢复完整列表。");
  });

  it("disables copy and export with the shared gate sentence and spends no request", async () => {
    await settleSkills({ asOf: AS_OF, items: SKILL_ITEMS }, skillsEntry({ q: NO_MATCH }));
    const before = reads().length;
    expect(before).toBe(1);
    const copyBtn = q<HTMLButtonElement>("capC-copy");
    const exportBtn = q<HTMLButtonElement>("cap6-export");
    expect(copyBtn?.disabled).toBe(true);
    expect(exportBtn?.disabled).toBe(true);
    const reason = q("cap-gates-copy")?.getAttribute("title");
    expect(reason).toBe("当前没有可导出的条目。");
    expect(q("cap-gates-export")?.getAttribute("title")).toBe(reason);
    // R128: an empty filtered view renders no per-row copy buttons at all.
    expect(copyButtons()).toHaveLength(0);
    await act(async () => { copyBtn?.click(); exportBtn?.click(); });
    expect(clipboard.copyTextToClipboard).not.toHaveBeenCalled();
    expect(reads().length).toBe(before);
  });

  it("restores every row and every cap-row-copy index when the search is cleared", async () => {
    await settleSkills({ asOf: AS_OF, items: SKILL_ITEMS }, skillsEntry({ q: NO_MATCH }));
    expect(skillRows()).toHaveLength(0);
    const before = reads().length;
    await act(async () => { q<HTMLButtonElement>("skl4-clear")?.click(); });
    await waitFor(() => skillRows().length === SKILL_ITEMS.length, "skills rows restored");
    expect(copyButtons()).toHaveLength(SKILL_ITEMS.length);
    expect(paramsOf().q).toBeUndefined();
    // Clearing filters locally — it must not read the ledger again.
    expect(reads().length).toBe(before);
    await act(async () => { q<HTMLButtonElement>("cap-row-copy-0")?.click(); await Promise.resolve(); });
    expect(clipboard.copyTextToClipboard).toHaveBeenLastCalledWith(LINE_0);
    expect(reads().length).toBe(before);
  });
});

describe("filtered empty state on tools", () => {
  it("disables copy and export, hides the copy buttons and spends no request", async () => {
    await settleTools(toolsEntry({ q: NO_MATCH }));
    expect(q("tl3-no-match")).toBeTruthy();
    expect(toolRows()).toHaveLength(0);
    const before = reads().length;
    const copyBtn = q<HTMLButtonElement>("capC-copy");
    const exportBtn = q<HTMLButtonElement>("cap6-export");
    expect(copyBtn?.disabled).toBe(true);
    expect(exportBtn?.disabled).toBe(true);
    expect(q("cap-gates-copy")?.getAttribute("title")).toBe("当前没有可导出的条目。");
    expect(q("cap-gates-export")?.getAttribute("title")).toBe(q("cap-gates-copy")?.getAttribute("title"));
    expect(copyButtons()).toHaveLength(0);
    await act(async () => { copyBtn?.click(); exportBtn?.click(); });
    expect(clipboard.copyTextToClipboard).not.toHaveBeenCalled();
    expect(reads().length).toBe(before);
  });

  it("restores both rows and both copy indices when the search is cleared", async () => {
    await settleTools(toolsEntry({ q: NO_MATCH }));
    const before = reads().length;
    await act(async () => { q<HTMLButtonElement>("tl3-clear")?.click(); });
    await waitFor(() => toolRows().length === 2, "tools rows restored");
    expect(copyButtons()).toHaveLength(2);
    expect(paramsOf().q).toBeUndefined();
    expect(reads().length).toBe(before);
  });
});

describe("missing deep link", () => {
  it("reports a missing tools row without q, rewrites nothing and keeps the full list", async () => {
    const fields = { tab: "tools", row: "tools:不存在的集" };
    await settleTools(toolsEntry({ row: fields.row }));
    const missing = q("cap-row-missing");
    expect(missing?.textContent).toContain("该条目不在当前列表里");
    expect(missing?.getAttribute("title")).toBe(ROW_GAP);
    // Without a search word the reason is the deletion/renaming sentence.
    expect(missing?.textContent).toContain("当前清单里没有这个条目；它可能已被删除或改名。");
    expect(q("cap7-detail-tools")).toBeNull();
    expect(toolRows()).toHaveLength(2);
    expect(paramsOf()).toEqual(fields);
    expect(searchOf()).toBe("?" + new URLSearchParams(fields).toString());
  });

  it("keeps the skills URL byte-identical when the linked row is missing", async () => {
    const fields = { tab: "skills", row: "skills:不存在的技能" };
    await settleSkills({ asOf: AS_OF, items: SKILL_ITEMS }, skillsEntry({ row: fields.row }));
    const missing = q("cap-row-missing");
    expect(missing?.textContent).toContain("该条目不在当前列表里");
    expect(missing?.getAttribute("title")).toBe(ROW_GAP);
    expect(q("cap7-detail-skills")).toBeNull();
    expect(skillRows()).toHaveLength(SKILL_ITEMS.length);
    // SkillsPage.test 「reports a missing row」 never pinned the URL itself.
    expect(paramsOf()).toEqual(fields);
    expect(searchOf()).toBe("?" + new URLSearchParams(fields).toString());
  });
});
