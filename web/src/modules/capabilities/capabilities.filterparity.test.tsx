// @vitest-environment jsdom
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

const SKILL_ITEMS = [
  { skillId: "s1", name: "会议纪要", scope: "builtin", status: "active", updatedAt: "2026-11-19T05:00:00Z" },
  { skillId: "s2", name: "资料整理", scope: "tenant-shared", status: "active", updatedAt: "2026-11-19T05:30:00Z" },
  { skillId: "s3", name: "日报生成", scope: "builtin", status: "active", updatedAt: "2026-11-19T04:00:00Z" },
  { skillId: "s4", name: "周报汇总", scope: "builtin", status: "active", updatedAt: "2026-11-19T04:30:00Z" },
];
const TOOLSETS = [
  { name: "web", label: "网页搜索", enabled: true, configured: true, platform_label: "CLI", tools: ["web_search"] },
  { name: "kanban", label: "看板", enabled: false, configured: false, platform_label: "CLI", tools: ["kanban_create"] },
  { name: "report", label: "报表", enabled: true, configured: true, platform_label: "CLI", tools: ["report_build"] },
];
const SERVERS = { servers: [{ name: "文档检索", transport: "http", enabled: true, auth: "header" }] };

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
}
async function settleTools(entry: string) {
  api.fetchJsonStrict.mockReset();
  api.fetchJsonStrict.mockImplementation(toolsHandler);
  await render(entry, "tools");
}

const q = (testid: string) => container.querySelector<HTMLElement>(`[data-testid='${testid}']`);
const skillNames = () =>
  [...container.querySelectorAll("[data-testid^='skl4-row-']")].map(
    (tr) => tr.querySelectorAll(".skl4-cell")[0]?.firstElementChild?.textContent?.trim() ?? "",
  );
const toolNames = () =>
  [...container.querySelectorAll("[data-testid='tol5-row']")].map(
    (tr) => tr.querySelector("[data-testid='tl3-name']")?.textContent?.trim() ?? "",
  );
const calledUrls = () =>
  api.fetchJsonStrict.mock.calls.map((call) => call[0]).filter((url): url is string => typeof url === "string");
/** Numeric N the list caliber itself prints, first 「N 项」 in cap-page-scope. */
function scopeN(): number | null {
  const match = (q("cap-page-scope")?.textContent ?? "").match(/(\d+)\s*项/);
  return match ? Number(match[1]) : null;
}
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
    return "blob:filterparity";
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
/** Data rows only: header kept, trailing `#` scope note dropped, so N is comparable to the table. */
const dataLines = (csv: string) => csv.trim().split("\r\n").filter((line) => !line.startsWith("#"));
const firstColumn = (lines: string[]) => lines.slice(1).map((line) => line.split(",")[0]!.replace(/^"|"$/g, ""));
const cmp = (a: string, b: string) => a.localeCompare(b, "zh-Hans", { numeric: true, sensitivity: "base" });

beforeEach(() => {
  api.fetchJsonStrict.mockReset();
  resetCapabilityCounts();
  resetSkillsTabState();
  resetToolsTabState();
  resetTabView();
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  window.history.replaceState({}, "", "/capabilities?tab=skills");
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("filter state: copy and export follow the filtered, sorted table body", () => {
  it("skills — ?q= + ?sort=name&dir=desc: copy lines, CSV rows, table body and cap-page-scope agree on order and N", async () => {
    await settleSkills({ asOf: "2026-11-19T06:00:00Z", items: SKILL_ITEMS }, "/capabilities?tab=skills&q=%E6%8A%A5&sort=name&dir=desc");
    const body = skillNames();
    expect(body).toHaveLength(2);
    expect(body[0]).toBe("周报汇总");
    expect(scopeN()).toBe(2);
    expect(q("cap5-scope-note")?.textContent).toContain("仅在当前已加载 4 项内搜索");
    expect(q("cap-export-scope-note")?.getAttribute("data-shown")).toBe("2");

    const copied = (await copiedListText()).trim().split("\n").slice(1).map((line) => line.split(",")[0]);
    expect(copied).toEqual(body);

    const csv = await exportedCsv();
    const lines = dataLines(csv);
    expect(lines).toHaveLength(3);
    expect(firstColumn(lines)).toEqual(body);
    expect(csv.trim().split("\r\n").at(-1)).toBe(`#${q("cap-export-scope-note")!.textContent!.trim()}`);
    expect(calledUrls()).toEqual(["/agent-api/api/skills"]);
  });

  it("skills — ?sort=name&dir=asc without a query: the body really is ascending and the three faces match", async () => {
    await settleSkills({ asOf: "2026-11-19T06:00:00Z", items: SKILL_ITEMS }, "/capabilities?tab=skills&sort=name&dir=asc");
    const body = skillNames();
    expect(body).toHaveLength(4);
    expect([...body].sort(cmp)).toEqual(body);
    expect(scopeN()).toBe(4);
    const lines = dataLines(await exportedCsv());
    expect(firstColumn(lines)).toEqual(body);
    expect((await copiedListText()).trim().split("\n").slice(1).map((line) => line.split(",")[0])).toEqual(body);
    expect(calledUrls()).toEqual(["/agent-api/api/skills"]);
  });

  it("tools — sorted body, then the same body narrowed by ?q=: copy, CSV and cap-page-scope stay in lockstep", async () => {
    await settleTools("/capabilities?tab=tools&sort=name&dir=asc");
    const asc = toolNames();
    expect(asc.length).toBeGreaterThan(1);

    resetToolsTabState();
    await settleTools("/capabilities?tab=tools&sort=name&dir=desc");
    const all = toolNames();
    // Sort really takes effect: same rows, mirrored order, whichever field the pick reads.
    expect([...all].sort(cmp)).toEqual([...asc].sort(cmp));
    expect(all).not.toEqual(asc);
    expect(scopeN()).toBe(all.length);
    const one = all[0]!;

    resetToolsTabState();
    await settleTools(`/capabilities?tab=tools&q=${encodeURIComponent(one)}&sort=name&dir=desc`);
    const filtered = toolNames();
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered.length).toBeLessThanOrEqual(all.length);
    expect(filtered.every((name) => all.includes(name))).toBe(true);
    expect(scopeN()).toBe(filtered.length);
    const lines = dataLines(await exportedCsv());
    expect(lines.length - 1).toBe(filtered.length);
    expect(firstColumn(lines)).toEqual(filtered);
    expect((await copiedListText()).trim().split("\n").slice(1).map((line) => line.split(",")[0])).toEqual(filtered);
  });
});

describe("empty filter result and unknown reads", () => {
  it("skills — a ?q= with no match disables both actions on one shared gate sentence, and the count is a real 0", async () => {
    await settleSkills({ asOf: "2026-11-19T06:00:00Z", items: SKILL_ITEMS }, "/capabilities?tab=skills&q=%E4%B8%8D%E5%AD%98%E5%9C%A8%E7%9A%84%E8%AF%8D");
    expect(q("skl4-no-match")).toBeTruthy();
    expect(skillNames()).toHaveLength(0);
    const copyBtn = q("capC-copy") as HTMLButtonElement;
    const exportBtn = q("cap6-export") as HTMLButtonElement;
    expect(copyBtn.disabled).toBe(true);
    expect(exportBtn.disabled).toBe(true);
    const copyGate = q("cap-gates-copy")!;
    const exportGate = q("cap-gates-export")!;
    expect(copyGate.getAttribute("data-enabled")).toBe("false");
    expect(exportGate.getAttribute("data-enabled")).toBe("false");
    expect(copyGate.getAttribute("title")).toBe(exportGate.getAttribute("title"));
    expect(copyGate.getAttribute("title")).toBe("当前没有可导出的条目。");
    // The read succeeded, so 0 is a real count of the current view — not an unknown dressed as —.
    expect(q("cap6-export-count")?.textContent).toBe("0 条");
    expect(scopeN()).toBe(0);
    let clipboardCalls = 0;
    clipboard.copyTextToClipboard.mockImplementation(async () => {
      clipboardCalls += 1;
      return true;
    });
    await act(async () => copyBtn.click());
    expect(clipboardCalls).toBe(0);
  });

  it("skills — an unread read口 keeps the count at — and blocks both actions with the same reason", async () => {
    api.fetchJsonStrict.mockReset();
    api.fetchJsonStrict.mockRejectedValue(new ApiError("boom", { status: 500, body: "{}", url: "/agent-api/api/skills" }));
    await render("/capabilities?tab=skills", "skills");
    const copyGate = q("cap-gates-copy")!;
    const exportGate = q("cap-gates-export")!;
    expect((q("capC-copy") as HTMLButtonElement).disabled).toBe(true);
    expect((q("cap6-export") as HTMLButtonElement).disabled).toBe(true);
    expect(copyGate.getAttribute("title")).toBe(exportGate.getAttribute("title"));
    expect(copyGate.getAttribute("title")).not.toBe("当前没有可导出的条目。");
    expect(q("cap6-export-count")?.textContent).toBe("—");
    expect(q("cap-page-scope")?.textContent).toContain("无法判断总数");
    // The only 0 allowed here is the prose that refuses to dress an empty list as a count.
    expect(q("cap-page-scope")?.textContent).toContain("不把空列表当 0 项");
    expect(q("cap-page-scope")?.textContent).not.toMatch(/共 0 项|显示 0 项/);
    expect(q("cap-export-scope-note")?.getAttribute("data-mode")).toBe("unavailable");
    expect(q("cap-export-scope-note")?.textContent).toContain("不代表全量");
  });
});

describe("tab switch keeps the filter and costs no second read", () => {
  it("q / sort / dir survive the switch, the other tab honours the same q, and coming back re-renders from cache", async () => {
    const skillsEntry = "/capabilities?tab=skills&q=%E6%8A%A5&sort=name&dir=desc";
    await settleSkills({ asOf: "2026-11-19T06:00:00Z", items: SKILL_ITEMS }, skillsEntry);
    const firstBody = skillNames();
    expect(firstBody).toEqual(["周报汇总", "日报生成"]);
    const search = q("cap8-location")!.textContent!;
    expect(search).toContain("q=%E6%8A%A5");
    expect(search).toContain("sort=name");
    expect(search).toContain("dir=desc");
    const skillsUrls = calledUrls().length;
    expect(skillsUrls).toBe(1);

    // The shell's tab strip drops only tab/view/zone and carries the rest over, so the
    // tools tab mounts with this very search string.
    api.fetchJsonStrict.mockImplementation(toolsHandler);
    await render(search.replace("tab=skills", "tab=tools"), "tools");
    const toolsSearch = q("cap8-location")!.textContent!;
    expect(toolsSearch).toContain("q=%E6%8A%A5");
    expect(toolsSearch).toContain("sort=name");
    expect(toolsSearch).toContain("dir=desc");
    expect(q("cap5-search")?.getAttribute("value") ?? "").not.toBe("");

    const urlsBeforeReturn = calledUrls().length;
    await render(search, "skills");
    expect(skillNames()).toEqual(firstBody);
    expect(calledUrls().length).toBe(urlsBeforeReturn);
    expect(q("cap8-location")!.textContent!).toBe(search);
  });

  it("an entry without tab= gets tab=skills written without touching q or sort", async () => {
    await settleSkills({ asOf: "2026-11-19T06:00:00Z", items: SKILL_ITEMS }, "/capabilities?q=%E6%8A%A5&sort=name&dir=desc");
    const search = q("cap8-location")!.textContent!;
    expect(search).toContain("tab=skills");
    expect(search).toContain("q=%E6%8A%A5");
    expect(search).toContain("sort=name");
    expect(skillNames()).toEqual(["周报汇总", "日报生成"]);
  });
});

describe("asOf in a filtered row: six top-level aliases only, never the local clock", () => {
  const ALIASES = ["asOf", "as_of", "collectedAt", "collected_at", "generatedAt", "generated_at"];
  it.each(ALIASES)("%s — the filtered row shows the same Beijing minute on screen and in its copy", async (key) => {
    vi.useFakeTimers({ now: new Date("2031-03-01T00:00:00Z"), toFake: ["Date"] });
    await settleSkills(
      { [key]: "2026-11-19T06:00:00Z", items: [SKILL_ITEMS[1]!] },
      "/capabilities?tab=skills&q=%E8%B5%84%E6%96%99&sort=name&dir=asc",
    );
    expect(skillNames()).toEqual(["资料整理"]);
    await act(async () => q("cap7-detail-toggle")!.click());
    const asof = q("cap7-detail-asof")!;
    expect(asof.textContent?.trim()).toBe("2026-11-19 14:00");
    expect(asof.textContent).not.toContain("2031");
    const detail = await copiedDetailText();
    expect(detail).toContain("采集时刻：2026-11-19 14:00");
    expect(detail).not.toContain("2031");
    expect(q("cap-page-scope")?.textContent).not.toContain("2031");
  });

  it("a payload with no alias at all keeps — plus the no-local-clock reason, on screen and in the copy", async () => {
    vi.useFakeTimers({ now: new Date("2031-03-01T00:00:00Z"), toFake: ["Date"] });
    await settleSkills({ items: [SKILL_ITEMS[1]!] }, "/capabilities?tab=skills&q=%E8%B5%84%E6%96%99");
    await act(async () => q("cap7-detail-toggle")!.click());
    const asof = q("cap7-detail-asof")!;
    expect(asof.textContent?.trim()).toBe("—");
    expect(asof.getAttribute("title")).toContain("不用本机时间顶替");
    const detail = await copiedDetailText();
    expect(detail).toContain("采集时刻：—");
    expect(detail).not.toContain("2031");
  });

  it("a non-ISO alias value is refused the same way an absent one is", async () => {
    await settleSkills({ generatedAt: "昨天下午", items: [SKILL_ITEMS[1]!] }, "/capabilities?tab=skills&q=%E8%B5%84%E6%96%99");
    await act(async () => q("cap7-detail-toggle")!.click());
    expect(q("cap7-detail-asof")?.textContent?.trim()).toBe("—");
    expect(q("cap7-detail-asof")?.getAttribute("title")).toContain("不用本机时间顶替");
  });
});
