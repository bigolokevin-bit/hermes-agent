// @vitest-environment jsdom
// R128: per-row copy buttons on the /capabilities list rows (skills table and
// tools list). Guards: five labelled segments verbatim, real 0 vs missing,
// index follows DOM order under filtering, zero extra requests, clipboard
// rejection fallback, empty set renders no copy column, and coexistence with
// the row-DETAIL copy node of the same testid name (disclosed in DONE R93).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
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
import { resetTabView } from "./tabView";

const AS_OF = "2026-11-19T06:00:00Z";
const SKILL_ITEMS = [
  { skillId: "sk_alpha42", name: "资料整理", source: "builtin", scope: "tenant-shared", status: "active", updatedAt: "2026-11-19T05:30:00Z" },
  { skillId: "s2", status: "mystery" },
  { name: "值守清理", enabled: false },
];
const LINE_0 = "名称：资料整理 · 类型：平台内置 · 状态：正常 · 调用次数：— · 短码：SKALPHA4";
const LINE_1 = "名称：— · 类型：— · 状态：待核实 · 调用次数：— · 短码：S2";
const LINE_2 = "名称：值守清理 · 类型：— · 状态：停用 · 调用次数：— · 短码：—";
const TOOLSETS = [{ name: "web", label: "Web Search", enabled: true, configured: true, tools: ["web_search"] }];
const SERVERS = { servers: [{ name: "文档检索", transport: "http", enabled: true, auth: "header" }] };

let root: Root | null = null;
let container: HTMLDivElement | null = null;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function q<T extends HTMLElement = HTMLElement>(testid: string): T | null {
  return document.querySelector<T>(`[data-testid='${testid}']`);
}
function reads(): string[] {
  return api.fetchJsonStrict.mock.calls.map((c) => String(c[0])).filter((u) => u !== "undefined");
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
        {page === "tools" ? <ToolsPage /> : <SkillsPage />}
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}
async function settleSkills(payload: unknown, entry = "/capabilities?tab=skills"): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation((url: unknown) =>
    String(url).includes("/agent-api/api/skills")
      ? Promise.resolve(payload)
      : Promise.reject(new ApiError("missing", { status: 404, body: "{}", url: String(url) })),
  );
  await render(entry, "skills");
  await waitFor(() => !!q("skl4-table") || !!q("skl4-empty") || !!q("skl4-error"), "skills settled");
}
async function settleTools(entry = "/capabilities?tab=tools"): Promise<void> {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation((url?: unknown) => {
    if (url === undefined) return Promise.resolve({ servers: [] });
    const u = String(url);
    if (u.includes("/agent-api/")) return Promise.reject(new ApiError("missing", { status: 404, body: "{}", url: u }));
    if (u.includes("/api/tools/toolsets")) return Promise.resolve(TOOLSETS);
    if (u.includes("/api/mcp/servers")) return Promise.resolve(SERVERS);
    return Promise.reject(new ApiError("unknown", { status: 404, body: "{}", url: u }));
  });
  await render(entry, "tools");
  await waitFor(() => document.querySelectorAll("[data-testid='tol5-row']").length > 0 || !!q("tol5-empty"), "tools settled");
}
async function clickCopy(index: number): Promise<void> {
  const btn = q<HTMLButtonElement>(`cap-row-copy-${index}`);
  if (!btn) throw new Error(`cap-row-copy-${index} not rendered`);
  await act(async () => { btn.click(); await Promise.resolve(); });
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

describe("skills row copy", () => {
  it("prints the five segments verbatim for named, nameless and synthetic-id rows", async () => {
    await settleSkills({ asOf: AS_OF, items: SKILL_ITEMS });
    const before = reads().length;
    for (const index of [0, 1, 2]) {
      const btn = q(`cap-row-copy-${index}`);
      expect(btn?.tagName).toBe("BUTTON");
      expect((btn as unknown as HTMLButtonElement).type).toBe("button");
    }
    expect(q("cap-row-copy-0")?.getAttribute("aria-label")).toBe("复制资料整理这一行");
    expect(q("cap-row-copy-1")?.getAttribute("aria-label")).toBe("复制未署名条目这一行");
    expect(q("cap-row-copy-2")?.getAttribute("aria-label")).toBe("复制值守清理这一行");
    expect(q("cap-row-copy-status")).toBeNull();

    await clickCopy(0);
    expect(clipboard.copyTextToClipboard).toHaveBeenLastCalledWith(LINE_0);
    expect(q("cap-row-copy-status")?.textContent).toBe("已复制");
    expect(q("cap-row-copy-status")?.getAttribute("role")).toBe("status");
    expect(q("cap-row-copy-status")?.getAttribute("aria-live")).toBe("polite");
    expect(q("cap-row-copy-fallback")).toBeNull();
    await clickCopy(1);
    expect(clipboard.copyTextToClipboard).toHaveBeenLastCalledWith(LINE_1);
    await clickCopy(2);
    expect(clipboard.copyTextToClipboard).toHaveBeenLastCalledWith(LINE_2);
    // Exactly one status node for the whole table: it followed the last click.
    expect(document.querySelectorAll("[data-testid='cap-row-copy-status']")).toHaveLength(1);
    expect(reads().length).toBe(before);
  });

  it("numbers the buttons in DOM order after a ?q= filter", async () => {
    await settleSkills({ asOf: AS_OF, items: SKILL_ITEMS }, "/capabilities?tab=skills&q=%E8%B5%84%E6%96%99");
    const bodyRows = [...document.querySelectorAll("[data-testid^='skl4-row-']")];
    expect(bodyRows).toHaveLength(1);
    expect(bodyRows[0].textContent).toContain("资料整理");
    expect(q("cap-row-copy-0")?.closest("tr")).toBe(bodyRows[0]);
    expect(q("cap-row-copy-1")).toBeNull();
    const before = reads().length;
    await clickCopy(0);
    expect(clipboard.copyTextToClipboard).toHaveBeenLastCalledWith(LINE_0);
    expect(reads().length).toBe(before);
  });

  it("renders no copy column at all for an empty ledger", async () => {
    await settleSkills({ asOf: AS_OF, items: [] });
    expect(document.querySelectorAll("[data-testid^='cap-row-copy-']")).toHaveLength(0);
    expect([...document.querySelectorAll("th")].some((th) => th.textContent === "复制")).toBe(false);
  });

  it("keeps the row status node beside the detail panel node without overwriting it", async () => {
    await settleSkills({ asOf: AS_OF, items: SKILL_ITEMS });
    await act(async () => { q<HTMLButtonElement>("cap7-detail-toggle")?.click(); });
    expect(q("cap7-detail-skills")).toBeTruthy();
    const before = reads().length;
    await clickCopy(0);
    const statuses = [...document.querySelectorAll("[data-testid='cap-row-copy-status']")];
    expect(statuses).toHaveLength(2);
    expect(statuses.some((s) => s.textContent === "已复制")).toBe(true);
    // The detail panel's own node stays idle — the row copy did not touch it.
    expect(statuses.some((s) => s.textContent === "")).toBe(true);
    expect(reads().length).toBe(before);
  });
});

describe("tools row copy", () => {
  it("indexes across both sections and never leaks the raw id", async () => {
    await settleTools();
    const rows = [...document.querySelectorAll("[data-testid='tol5-row']")];
    expect(rows).toHaveLength(2);
    expect(q("cap-row-copy-0")?.closest("div.tol5-row")).toBe(rows[0]);
    expect(q("cap-row-copy-1")?.closest("div.tol5-row")).toBe(rows[1]);
    expect(q("cap-row-copy-0")?.getAttribute("aria-label")).toBe("复制网页搜索这一行");
    const before = reads().length;
    await clickCopy(0);
    expect(clipboard.copyTextToClipboard).toHaveBeenLastCalledWith(
      "名称：网页搜索 · 类型：内置 · 网页搜索与抓取 · 状态：正常 · 调用次数：— · 短码：WEBSEARC",
    );
    const line0 = String(clipboard.copyTextToClipboard.mock.calls.at(-1)?.[0]);
    expect(line0).not.toContain("web_search");
    await clickCopy(1);
    const line1 = String(clipboard.copyTextToClipboard.mock.calls.at(-1)?.[0]);
    expect(line1).toContain("名称：文档检索");
    expect(line1).toContain("状态：正常 · 调用次数：— · 短码：—");
    expect(line1).toContain(`类型：${rows[1].querySelector("[data-testid='tl3-type']")?.textContent}`);
    expect(reads().length).toBe(before);
  });

  it("offers the identical text in a read-only textarea when the clipboard refuses", async () => {
    await settleTools();
    clipboard.copyTextToClipboard.mockResolvedValue(false);
    const before = reads().length;
    await clickCopy(0);
    expect(q("cap-row-copy-status")?.textContent).toBe("复制失败，已展开手动复制");
    const fallback = q<HTMLTextAreaElement>("cap-row-copy-fallback");
    expect(fallback?.readOnly).toBe(true);
    const line = String(clipboard.copyTextToClipboard.mock.calls.at(-1)?.[0]);
    expect(fallback?.value).toBe(line);
    expect(reads().length).toBe(before);
  });
});
