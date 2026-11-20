// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const fetchJsonStrict = vi.fn();
vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: (...args: unknown[]) => fetchJsonStrict(...args) }));
const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));
import { ApiError } from "@/lib/api-error";
import { SkillsPage } from "./SkillsPage";
import { resetSkillsTabState } from "./SkillsPage";
import { resetCapabilityCounts } from "../capabilities/counts";
import { resetTabView } from "../capabilities/tabView";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  fetchJsonStrict.mockReset();
  resetCapabilityCounts();
  resetSkillsTabState();
  resetTabView();
  clipboard.copyTextToClipboard.mockReset();
  clipboard.copyTextToClipboard.mockResolvedValue(true);
  window.history.replaceState({}, "", "/");
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="cap8-location">{loc.search}</span>;
}

async function render() {
  const entry = window.location.pathname + window.location.search;
  await act(async () => { root.render(<MemoryRouter initialEntries={[entry]}><LocationProbe /><SkillsPage /></MemoryRouter>); });
  await act(async () => {});
}


async function downloadedName(): Promise<string> {
  let name = "";
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (() => "blob:cap8") as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = function click() { name = this.download; };
  try {
    await act(async () => container.querySelector<HTMLButtonElement>("[data-testid='cap6-export']")!.click());
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    HTMLAnchorElement.prototype.click = originalClick;
  }
  return name;
}

async function exportCsv(): Promise<string> {
  const blobs: Blob[] = [];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = ((blob: Blob) => { blobs.push(blob); return "blob:cap8"; }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = function click() { /* capture only */ };
  try {
    await act(async () => container.querySelector<HTMLButtonElement>("[data-testid='cap6-export']")!.click());
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    HTMLAnchorElement.prototype.click = originalClick;
  }
  const blob = blobs[0];
  expect(blob).toBeTruthy();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob!);
  });
}

const text = () => container.textContent ?? "";

describe("SkillsPage", () => {
  it("renders the required columns and keeps missing source, status and update time honest", async () => {
    fetchJsonStrict.mockResolvedValue({
      asOf: "2026-11-19T06:00:00Z",
      items: [
        { skillId: "skill-12345678", name: "资料整理", scope: "tenant-shared", version: "2" },
        {
          skillId: "skill-87654321",
          name: "质检",
          source: "平台内置",
          status: "active",
          updatedAt: "2026-11-19T05:30:00Z",
          scope: "unused",
        },
      ],
    });
    await render();

    const headers = [...container.querySelectorAll("th")].map((node) => node.textContent);
    expect(headers).toEqual(["技能名↕", "来源/类型↕", "启用态", "最近更新↕", "共享范围"]);
    expect(text()).toContain("资料整理");
    expect(text()).toContain("团队共享");
    expect(text()).toContain("类型：团队共享");
    expect(text()).toContain("台账列表未提供启用状态");
    expect(text()).toContain("台账列表未提供更新时间");
    expect(text()).toContain("质检");
    expect(text()).toContain("平台内置");
    expect(text()).toContain("正常");
    expect(text()).toContain("2026-11-19 13:30");
    expect(text()).toContain("读取于 2026-11-19 14:00");
    const skillsCount = container.querySelector('[data-testid="cap4-count-skills"]')!;
    expect(skillsCount.textContent).toContain("2");
    expect(skillsCount.textContent).toContain("有源");
    expect(container.querySelector('[data-testid="cap4-count-tools"]')?.textContent).toContain("未取数");
  });

  it("explains a missing name without inventing one", async () => {
    fetchJsonStrict.mockResolvedValue({ items: [{ skillId: "skill-1", scope: "unused" }] });
    await render();
    expect(text()).toContain("—");
    expect(text()).toContain("台账未提供名称");
  });

  it("shows a copyable request id and retries after failure", async () => {
    fetchJsonStrict
      .mockRejectedValueOnce({ requestId: "req-skills-1" })
      .mockResolvedValueOnce({ items: [{ skillId: "s1", name: "恢复后的技能" }] });
    await render();
    expect(text()).toContain("请求编号：");
    expect(text()).toContain("req-skills-1");
    expect(container.querySelector('[data-testid="capF-state-error"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="capF-state-unavailable"]')).toBeNull();
    expect(container.querySelector('[data-testid="capF-state-error"]')?.textContent).toContain("技能列表暂时无法读取");
    expect(text()).toContain("技能列表暂时无法读取");
    const count = container.querySelector('[data-testid="cap4-count-skills"]')!;
    expect(count.textContent).toContain("—");
    expect(count.textContent).not.toContain("0");
    const csv = container.querySelector<HTMLButtonElement>('[data-testid="cap6-export"]')!;
    const copy = container.querySelector<HTMLButtonElement>('[data-testid="capC-copy"]')!;
    expect(csv.disabled).toBe(true);
    expect(copy.disabled).toBe(true);
    expect(csv.title).toContain("请求编号：req-skills-1");
    expect(copy.title).toContain("请求编号：req-skills-1");
    expect(container.querySelector('[data-testid="cap6-export-count"]')?.textContent).toBe("—");
    const before = fetchJsonStrict.mock.calls.length;
    const button = [...container.querySelectorAll("button")].find((node) => node.textContent?.includes("重试"));
    await act(async () => { button?.click(); });
    await act(async () => {});
    expect(text()).toContain("恢复后的技能");
    expect(fetchJsonStrict.mock.calls.length).toBe(before + 1);
    expect(csv.disabled).toBe(false);
    expect(copy.disabled).toBe(false);
    expect(container.querySelector('[data-testid="cap6-export-count"]')?.textContent).toBe("1 条");
  });

  it("keeps q/sort/dir in the URL through error and retry", async () => {
    window.history.replaceState({}, "", "/capabilities?tab=skills&q=资料&sort=name&dir=asc");
    fetchJsonStrict
      .mockRejectedValueOnce(new ApiError("boom", { status: 500, body: "", url: "/agent-api/api/skills", requestId: "req-skills-keep" }))
      .mockResolvedValueOnce({ items: [{ skillId: "s1", name: "资料整理" }] });
    await render();
    const loc = container.querySelector('[data-testid="cap8-location"]')?.textContent ?? "";
    expect(loc).toContain("tab=skills");
    expect(loc).toContain("sort=name");
    expect(loc).toContain("dir=asc");
    expect(decodeURIComponent(loc)).toContain("q=资料");
    expect(container.querySelector<HTMLButtonElement>('[data-testid="cap6-export"]')?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('[data-testid="capC-copy"]')?.disabled).toBe(true);
    const retry = container.querySelector<HTMLButtonElement>('[data-testid="skl4-retry"]')!;
    await act(async () => { retry.click(); });
    await act(async () => {});
    expect(container.querySelector('[data-testid="skl4-row-s1"]')).toBeTruthy();
    const after = container.querySelector('[data-testid="cap8-location"]')?.textContent ?? "";
    expect(decodeURIComponent(after)).toContain("q=资料");
    expect(after).toContain("sort=name");
    expect(after).toContain("dir=asc");
  });

  it("renders the empty state for an empty list without a fake count", async () => {
    fetchJsonStrict.mockResolvedValue({ items: [] });
    await render();
    expect(container.querySelector('[data-testid="skl4-empty"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cap9-state-empty"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="capF-state-empty"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="capF-state-empty"]')?.textContent).toContain("读口已接入，本次返回 0 条");
    expect(container.querySelector('[data-testid="capF-state-empty-text"]')?.textContent).toBe("读口已接入，本次返回 0 条；台账没有返回任何技能，这里不补样例行。");
    expect(container.querySelector('[data-testid="skl4-page"]')?.getAttribute("data-cap-state")).toBe("empty");
    expect(container.querySelector('[data-testid="skl4-error"]')).toBeNull();
    const count = container.querySelector('[data-testid="cap4-count-skills"]')!;
    expect(count.textContent).toContain("0");
    expect(count.textContent).toContain("有源（空）");
    expect(text()).toContain("不补样例行");
    const csv = container.querySelector<HTMLButtonElement>('[data-testid="cap6-export"]')!;
    const copy = container.querySelector<HTMLButtonElement>('[data-testid="capC-copy"]')!;
    expect(csv.disabled).toBe(true);
    expect(copy.disabled).toBe(true);
    expect(csv.title).toBe("当前没有可导出的条目。");
    expect(copy.title).toBe("当前没有可导出的条目。");
    expect(container.querySelector('[data-testid="cap6-export-count"]')?.textContent).toBe("0 条");
    const search = container.querySelector<HTMLInputElement>('[data-testid="cap5-search"]')!;
    expect(search.disabled).toBe(true);
    expect(search.title).toBe("当前没有可搜索的条目。");
    expect(container.querySelector('[data-testid="cap-gates-search"]')?.getAttribute("data-enabled")).toBe("false");
    expect(container.querySelector('[data-testid="cap-gates-counts"]')?.getAttribute("data-enabled")).toBe("true");
    expect(container.querySelector('[data-testid="cap-gates-sort"]')?.getAttribute("data-enabled")).toBe("true");
    expect(container.querySelector('[data-testid="cap-gates-detail"]')?.getAttribute("data-enabled")).toBe("false");
  });

  it("puts the GAP id only in the title when the endpoint is missing", async () => {
    fetchJsonStrict.mockRejectedValue(new ApiError("missing", { status: 404, body: "", url: "/agent-api/api/skills" }));
    await render();
    expect(text()).toContain("技能读口未接入");
    expect(document.querySelector('[data-testid="skl4-error"] p[title]')?.getAttribute("title")).toBe("GAP-SKL4-01");
    expect(text()).not.toContain("GAP-");
    expect(text()).not.toContain("404");
    expect(container.querySelector('[data-testid="skl4-retry"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="capF-retry"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="skl4-apply"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cap9-state-unavailable"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cap9-state-denied"]')).toBeNull();
    expect(container.querySelector('[data-testid="capF-state-unavailable"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="capF-state-unavailable"]')?.textContent).toContain("技能读口未接入");
    expect(container.querySelector('[data-testid="skl4-page"]')?.getAttribute("data-cap-state")).toBe("unavailable");
    expect(container.querySelector<HTMLInputElement>('[data-testid="cap5-search"]')?.disabled).toBe(true);
    expect(container.querySelector('[data-testid="cap-gates-counts"]')?.getAttribute("data-enabled")).toBe("false");
    expect(container.querySelector('[data-testid="cap-gates-sort"]')?.getAttribute("data-enabled")).toBe("false");
    expect(container.querySelector('[data-testid="cap-gates-detail"]')?.getAttribute("data-enabled")).toBe("false");
    const count = container.querySelector('[data-testid="cap4-count-skills"]')!;
    expect(count.textContent).toContain("—");
    expect(count.textContent).not.toContain("0");
    expect(count.getAttribute("title")).toContain("GAP-SKL4-01");
    const copy = container.querySelector<HTMLButtonElement>('[data-testid="capC-copy"]')!;
    const csv = container.querySelector<HTMLButtonElement>('[data-testid="cap6-export"]')!;
    expect(copy.disabled).toBe(true);
    expect(csv.disabled).toBe(true);
    expect(container.querySelectorAll("tr[data-testid^='skl4-row-'][tabindex]")).toHaveLength(0);
    expect(copy.title).toContain("读口未接入");
    expect(copy.title).toContain("审批中心");
    expect(copy.title).toContain("GAP-SKL4-01");
    expect(csv.title).toContain("读口未接入");
    expect(container.querySelector('[data-testid="cap6-export-count"]')?.textContent).toBe("—");
  });

  it("renders 403 and 404 with the same neutral body and no status code", async () => {
    fetchJsonStrict.mockRejectedValue(new ApiError("denied", { status: 403, body: "", url: "/agent-api/api/skills" }));
    await render();
    expect(text()).toContain("技能读口未接入");
    expect(text()).toContain("当前账号无权查看");
    expect(text()).not.toContain("403");
    expect(document.querySelector('[data-testid="skl4-error"] p[title]')?.getAttribute("title")).toBe("GAP-SKL4-01");
    expect(container.querySelector('[data-testid="skl4-apply"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cap9-state-denied"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="cap9-state-unavailable"]')).toBeNull();
    expect(container.querySelector('[data-testid="capF-state-unavailable"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="capF-state-unavailable"]')?.textContent).toContain("技能读口未接入");
    const count = container.querySelector('[data-testid="cap4-count-skills"]')!;
    expect(count.textContent).toContain("—");
    expect(count.textContent).not.toContain("0");
    expect(count.getAttribute("title")).toContain("GAP-SKL4-01");
    const copy = container.querySelector<HTMLButtonElement>('[data-testid="capC-copy"]')!;
    const csv = container.querySelector<HTMLButtonElement>('[data-testid="cap6-export"]')!;
    expect(copy.disabled).toBe(true);
    expect(csv.disabled).toBe(true);
    expect(copy.title).toContain("读口未接入");
    expect(copy.title).toContain("审批中心");
    expect(copy.title).toContain("GAP-SKL4-01");
    expect(csv.title).toContain("读口未接入");
    expect(container.querySelector('[data-testid="cap6-export-count"]')?.textContent).toBe("—");
  });

  it("keeps the row testid and humanizes source and status", async () => {
    fetchJsonStrict.mockResolvedValue({
      items: [{ skillId: "skill-12345678", name: "资料整理", source: "builtin", status: "disabled", scope: "tenant-shared" }],
    });
    await render();
    const row = container.querySelector('[data-testid="skl4-row-skill-12345678"]');
    expect(row).toBeTruthy();
    expect(row?.textContent).toContain("平台内置");
    expect(row?.textContent).toContain("停用");
  });

  it("previews the error fixture without fetching and marks data-fixture", async () => {
    window.history.replaceState({}, "", "/?state=error&rid=abc12345");
    await act(async () => { root.render(<MemoryRouter initialEntries={[window.location.pathname + window.location.search]}><SkillsPage /></MemoryRouter>); });
    await act(async () => {});
    expect(fetchJsonStrict).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="skl4-page"]')?.getAttribute("data-fixture")).toBe("error");
    expect(container.querySelector('[data-testid="skl4-error"]')).toBeTruthy();
    expect(text()).toContain("abc12345");
    expect(container.querySelector('[data-testid="skl4-error"] button[aria-label="复制请求编号"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="skl4-apply"]')).toBeTruthy();
  });

  it("switches loading and empty preview content without fetching", async () => {
    for (const state of ["loading", "empty"] as const) {
      window.history.replaceState({}, "", `/?state=${state}`);
      await act(async () => { root.render(<MemoryRouter initialEntries={[window.location.pathname + window.location.search]}><SkillsPage /></MemoryRouter>); });
      await act(async () => {});
      expect(fetchJsonStrict).not.toHaveBeenCalled();
      expect(container.querySelector(`[data-testid="skl4-${state}"]`)).toBeTruthy();
      expect(container.querySelector(`[data-testid="capF-state-${state}"]`)).toBeTruthy();
      expect(container.querySelector(`[data-testid="capF-state-${state}"]`)?.textContent?.trim().length).toBeGreaterThan(0);
      expect(container.querySelector('[data-testid="skl4-page"]')?.getAttribute("data-cap-state")).toBe(state);
      expect(text()).toContain(state === "loading" ? "正在读取技能" : "还没有已登记的技能");
      const search = container.querySelector<HTMLInputElement>('[data-testid="cap5-search"]');
      expect(search?.disabled).toBe(true);
      expect(container.querySelector('[data-testid="cap-gates-sort"]')?.getAttribute("data-enabled")).toBe(state === "empty" ? "true" : "false");
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  it("leaves the error preview and retries the live read", async () => {
    window.history.replaceState({}, "", "/?state=error&rid=abc12345");
    fetchJsonStrict.mockResolvedValue({ items: [{ skillId: "s2", name: "恢复后的技能", status: "active" }] });
    await act(async () => { root.render(<MemoryRouter initialEntries={[window.location.pathname + window.location.search]}><SkillsPage /></MemoryRouter>); });
    await act(async () => {});
    expect(fetchJsonStrict).not.toHaveBeenCalled();
    const retry = container.querySelector('[data-testid="skl4-retry"]') as HTMLButtonElement | null;
    await act(async () => { retry?.click(); });
    await act(async () => {});
    expect(window.location.search).not.toContain("state=");
    expect(fetchJsonStrict).toHaveBeenCalledWith("/agent-api/api/skills");
    expect(text()).toContain("恢复后的技能");
    expect(container.querySelector('[data-testid="skl4-error"]')).toBeNull();
  });

  it("filters the loaded rows locally and writes the query into the URL", async () => {
    window.history.replaceState({}, "", "/capabilities?tab=skills&q=资料");
    fetchJsonStrict.mockResolvedValue({
      asOf: "2026-11-19T06:00:00Z",
      items: [
        { skillId: "s1", name: "资料整理", scope: "tenant-shared" },
        { skillId: "s2", name: "质检", scope: "unused" },
      ],
    });
    await render();
    expect(container.querySelectorAll("[data-testid^='skl4-row-']")).toHaveLength(1);
    expect(text()).toContain("资料整理");
    expect(text()).not.toContain("质检");
    expect(container.querySelector("[data-testid='cap5-scope-note']")?.textContent).toContain("仅在当前已加载 2 项内搜索");
    expect(container.querySelector("[data-testid='cap4-count-skills']")?.textContent).toContain("1");
    expect(container.querySelector("[data-testid='cap-page-scope']")?.textContent).toContain("表内全量渲染，共 1 项");
    expect(container.querySelector("[data-testid='cap6-export-count']")?.textContent).toContain("1 条");
    expect(container.querySelector<HTMLButtonElement>("[data-testid='cap6-export']")?.disabled).toBe(false);
    expect(container.querySelector("[data-testid='capA-export-order-note']")?.textContent).toContain("导出按当前排序与搜索");
    const csv = await exportCsv();
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("name,type,enabled,updated_at");
    expect(lines[1]).toMatch(/^资料整理,/);
  });

  it("shows a no-match state with a clear exit", async () => {
    window.history.replaceState({}, "", "/capabilities?tab=skills&q=不存在");
    fetchJsonStrict.mockResolvedValue({ items: [{ skillId: "s1", name: "资料整理" }] });
    await render();
    expect(text()).toContain("没有匹配项");
    expect(container.querySelector("[data-testid='skl4-clear']")).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>('[data-testid="cap5-search"]')?.disabled).toBe(false);
    expect(container.querySelector('[data-testid="cap-gates-sort"]')?.getAttribute("data-enabled")).toBe("true");
    expect(container.querySelector('[data-testid="cap-gates-detail"]')?.getAttribute("data-enabled")).toBe("false");
  });

  it("expands one row detail at a time without changing the search state", async () => {
    window.history.replaceState({}, "", "/capabilities?tab=skills&q=");
    fetchJsonStrict.mockResolvedValue({
      items: [
        { skillId: "s1", name: "资料整理", scope: "tenant-shared" },
        { skillId: "s2", name: "质检", source: "platform", status: "active", updatedAt: "2026-11-19T05:30:00Z" },
      ],
    });
    await render();
    const searchBefore = window.location.search;
    const toggles = [...container.querySelectorAll<HTMLButtonElement>("[data-testid='cap7-detail-toggle']")];
    expect(toggles).toHaveLength(2);

    await act(async () => toggles[0]!.click());
    let details = [...container.querySelectorAll("[data-testid='cap7-detail-skills']")];
    expect(details).toHaveLength(1);
    expect(details[0]!.textContent).toContain("资料整理");
    expect(details[0]!.textContent).toContain("/agent-api/api/skills");
    expect(container.querySelector("[data-testid='cap7-detail-asof']")?.textContent).toContain("—");
    expect(container.querySelector("[data-testid='cap7-detail-asof']")?.getAttribute("title")).toContain("上游没带采集时刻，不用本机时间顶替");
    expect(window.location.search).toBe(searchBefore);

    await act(async () => toggles[1]!.click());
    details = [...container.querySelectorAll("[data-testid='cap7-detail-skills']")];
    expect(details).toHaveLength(1);
    expect(details[0]!.textContent).toContain("质检");
    expect(details[0]!.textContent).not.toContain("资料整理");
    expect(details[0]!.textContent).toContain("2026-11-19 13:30");

    await act(async () => toggles[1]!.click());
    expect(container.querySelectorAll("[data-testid='cap7-detail-skills']")).toHaveLength(0);
  });

  it("previews the contract filename and downloads exactly that string as query and sort change", async () => {
    window.history.replaceState({}, "", "/capabilities?tab=skills&q=a1&sort=name&dir=asc");
    fetchJsonStrict.mockResolvedValue({
      items: [
        { skillId: "s1", name: "A1", source: "platform", status: "active", updatedAt: "2026-11-19T06:00:00Z" },
        { skillId: "s2", name: "B2", source: "custom", status: "active", updatedAt: "2026-11-18T06:00:00Z" },
      ],
    });
    await render();
    const preview = () => container.querySelector("[data-testid='cap-export-name']")!;
    expect(preview().textContent).toMatch(/^capabilities-skills-a1-name-asc-\d{8}-\d{4}\.csv$/);
    expect(preview().getAttribute("title")).toContain("tab=skills");
    expect(preview().getAttribute("title")).toContain("q=a1");
    expect(preview().getAttribute("title")).toContain("sort=name");
    expect(preview().getAttribute("title")).toContain("dir=asc");
    expect(await downloadedName()).toBe(preview().textContent);
    expect(fetchJsonStrict).toHaveBeenCalledTimes(1);

    await act(async () => container.querySelector<HTMLButtonElement>("[data-testid='cap8-sort-name']")!.click());
    expect(preview().textContent).toMatch(/^capabilities-skills-a1-name-desc-\d{8}-\d{4}\.csv$/);
    expect(await downloadedName()).toBe(preview().textContent);
    expect(fetchJsonStrict).toHaveBeenCalledTimes(1);
  });

  it("sorts by URL, cycles aria-sort and never refetches on sort clicks", async () => {
    window.history.replaceState({}, "", "/capabilities?tab=skills&sort=name&dir=asc");
    fetchJsonStrict.mockResolvedValue({
      items: [
        { skillId: "s1", name: "B2", source: "platform", status: "active", updatedAt: "2026-11-18T06:00:00Z" },
        { skillId: "s2", name: "A1", source: "custom", status: "active", updatedAt: "2026-11-19T06:00:00Z" },
        { skillId: "s3", name: "C3", source: "external", status: "disabled", updatedAt: "2026-11-17T06:00:00Z" },
      ],
    });
    await render();
    const order = () => [...container.querySelectorAll("[data-testid^='skl4-row-']")].map((row) => row.textContent);
    expect(order()[0]).toContain("A1");
    expect(order()[2]).toContain("C3");
    const csv = await exportCsv();
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("name,type,enabled,updated_at");
    expect(lines[1]).toMatch(/^A1,/);
    expect(order()[0]).toMatch(/^A1/);
    expect(lines[3]).toMatch(/^C3,/);
    expect(order()[2]).toMatch(/^C3/);
    expect(container.querySelector("[data-testid='cap8-location']")?.textContent).toContain("sort=name");
    expect(container.querySelector("th[aria-sort='ascending']")?.textContent).toContain("技能名");

    await act(async () => container.querySelector<HTMLButtonElement>("[data-testid='cap8-sort-name']")!.click());
    expect(container.querySelector("[data-testid='cap8-location']")?.textContent).toContain("dir=desc");
    expect(order()[0]).toContain("C3");
    expect(order()[2]).toContain("A1");
    expect(container.querySelector("th[aria-sort='descending']")?.textContent).toContain("技能名");

    await act(async () => container.querySelector<HTMLButtonElement>("[data-testid='cap8-sort-name']")!.click());
    expect(container.querySelector("[data-testid='cap8-location']")?.textContent).not.toContain("sort=");
    expect(container.querySelector("th[aria-sort='ascending']")).toBeNull();
    expect(container.querySelector("th[aria-sort='descending']")).toBeNull();
    expect(container.querySelector("th[aria-sort='none']")?.textContent).toContain("技能名");
    expect(fetchJsonStrict).toHaveBeenCalledTimes(1);
    expect(order()[0]).toContain("B2");
    expect(order()[2]).toContain("C3");
    const csvDefault = await exportCsv();
    const defaultLines = csvDefault.trim().split("\r\n");
    expect(defaultLines[1]).toMatch(/^B2,/);
    expect(defaultLines[3]).toMatch(/^C3,/);

    const beforeCopy = fetchJsonStrict.mock.calls.length;
    await act(async () => container.querySelector<HTMLButtonElement>("[data-testid='capC-copy']")!.click());
    expect(container.querySelector("[data-testid='capC-copy-status']")!.textContent).toBe("已复制 3 行");
    const copied = String(clipboard.copyTextToClipboard.mock.calls[0][0]);
    expect(copied.split("\n")[0]).toBe("name,type,enabled,updated_at");
    expect(copied.split("\n")[1]).toMatch(/^B2,/);
    expect(copied.split("\n")[3]).toMatch(/^C3,/);
    expect(fetchJsonStrict.mock.calls.length).toBe(beforeCopy);
  });

  it("reads only a top-level ISO asOf for the detail and keeps asOfSource in the title", async () => {
    window.history.replaceState({}, "", "/capabilities?tab=skills&q=%E8%B5%84%E6%96%99");
    fetchJsonStrict.mockResolvedValue({
      asOf: "2026-11-19T06:00:00Z",
      asOfSource: "台账快照",
      generated_at: "2026-11-18T01:00:00Z",
      items: [{ skillId: "s1", name: "资料整理", scope: "tenant-shared" }],
    });
    await render();
    const searchBefore = window.location.search;
    await act(async () => container.querySelector<HTMLButtonElement>("[data-testid='cap7-detail-toggle']")!.click());
    const asof = container.querySelector("[data-testid='cap7-detail-asof']");
    expect(asof?.textContent).toBe("2026-11-19 14:00");
    expect(asof?.getAttribute("title")).toBe("UTC 原文：2026-11-19T06:00:00Z · 北京时间：2026-11-19 14:00 · 来源：台账快照");
    expect(container.textContent).not.toContain("asOfSource");
    expect(window.location.search).toBe(searchBefore);
    expect(searchBefore).toContain("tab=skills");
    expect(searchBefore).toContain("q=");

    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(container.querySelectorAll("[data-testid='cap7-detail-skills']")).toHaveLength(0);
  });

  it("shows a dash and a title reason for a non-ISO asOf instead of the browser clock", async () => {
    window.history.replaceState({}, "", "/capabilities?tab=skills");
    fetchJsonStrict.mockResolvedValue({
      asOf: "2026/11/19 14:00",
      items: [{ skillId: "s1", name: "资料整理", scope: "tenant-shared" }],
    });
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>("[data-testid='cap7-detail-toggle']")!.click());
    const asof = container.querySelector("[data-testid='cap7-detail-asof']");
    expect(asof?.textContent).toBe("—");
    expect(asof?.getAttribute("title")).toContain("上游没带采集时刻");
    expect(container.textContent).not.toContain("2026/11/19");
  });

  it("keeps name, source, status and update time identical across row, detail and copy", async () => {
    window.history.replaceState({}, "", "/capabilities?tab=skills");
    fetchJsonStrict.mockResolvedValue({
      items: [{ skillId: "s1", name: "资料整理", scope: "tenant-shared", status: "mystery", updatedAt: "not-a-date" }],
    });
    await render();

    const row = container.querySelector('[data-testid="skl4-row-s1"]')!;
    const cells = row.querySelectorAll("td");
    expect(cells[2]!.textContent).toContain("待核实");
    expect(cells[2]!.querySelector("[title]")?.getAttribute("title")).toBe("mystery");
    expect(cells[3]!.textContent).toContain("—");
    expect(cells[3]!.querySelector("[title]")?.getAttribute("title")).toContain("无法识别");

    await act(async () => container.querySelector<HTMLButtonElement>("[data-testid='cap7-detail-toggle']")!.click());
    const detail = container.querySelector("[data-testid='cap7-detail-skills']")!;
    expect(container.querySelector("[data-testid='cap7-detail-name']")?.textContent).toBe("资料整理");
    expect(container.querySelector("[data-testid='cap7-detail-type']")?.textContent).toBe("类型：团队共享");
    expect(container.querySelector("[data-testid='cap7-detail-enabled']")?.textContent).toBe("待核实");
    expect(container.querySelector("[data-testid='cap7-detail-enabled']")?.getAttribute("title")).toContain("mystery");
    expect(container.querySelector("[data-testid='cap7-detail-updated']")?.textContent).toBe("—");
    expect(container.querySelector("[data-testid='cap7-detail-updated']")?.getAttribute("title")).toContain("无法识别");
    expect(container.querySelector("[data-testid='cap7-detail-asof']")?.textContent).toBe("—");
    expect(container.querySelector("[data-testid='cap7-detail-asof']")?.getAttribute("title")).toContain("上游没带采集时刻，不用本机时间顶替");
    expect(container.querySelector("[data-testid='cap7-detail-endpoint']")?.textContent).toBe("/agent-api/api/skills");
    expect(detail.textContent).toContain("资料整理");

    const beforeCopy = fetchJsonStrict.mock.calls.length;
    await act(async () => container.querySelector<HTMLButtonElement>("[data-testid='capC-copy']")!.click());
    const copied = String(clipboard.copyTextToClipboard.mock.calls[0][0]).split("\n");
    expect(copied[1]).toBe("资料整理,类型：团队共享,待核实,—");
    expect(fetchJsonStrict.mock.calls.length).toBe(beforeCopy);
  });

  it("leaks no engineering names or raw ids into the page", async () => {
    fetchJsonStrict.mockResolvedValue({
      asOf: "2026-11-19T06:00:00Z",
      items: [{ skillId: "skill-12345678", name: "资料整理", scope: "tenant-shared", version: "2" }],
    });
    await render();
    expect(text()).not.toContain("skillId");
    expect(text()).not.toContain("ownerUserId");
    expect(text()).not.toContain("sharedWith");
    expect(text()).not.toContain("/api");
    expect(text()).not.toContain("HTTP");
    expect(text()).not.toMatch(/\bGAP-/);
    expect(text()).not.toContain("skill-12345678");
  });

  it("keeps the current tab, query and sort in the URL when the tab is the default", async () => {
    window.history.replaceState({}, "", "/capabilities?q=%E8%B5%84%E6%96%99&sort=name&dir=asc");
    fetchJsonStrict.mockResolvedValue({
      asOf: "2026-11-19T06:00:00Z",
      items: [
        { skillId: "s1", name: "资料整理", scope: "tenant-shared" },
        { skillId: "s2", name: "质检", scope: "unused" },
      ],
    });
    await render();
    await act(async () => {});

    const params = new URLSearchParams(container.querySelector("[data-testid='cap8-location']")?.textContent ?? "");
    expect(params.get("tab")).toBe("skills");
    expect(params.get("q")).toBe("资料");
    expect(params.get("sort")).toBe("name");
    expect(params.get("dir")).toBe("asc");
    expect(container.querySelectorAll("[data-testid^='skl4-row-']")).toHaveLength(1);
    expect(text()).toContain("资料整理");
    expect(text()).not.toContain("质检");
  });

  it("restores the settled rows and the open detail after a remount without another read", async () => {
    window.history.replaceState({}, "", "/capabilities?tab=skills");
    fetchJsonStrict.mockResolvedValue({
      asOf: "2026-11-19T06:00:00Z",
      items: [
        { skillId: "s1", name: "资料整理", scope: "tenant-shared", version: "2" },
        { skillId: "s2", name: "质检", scope: "unused", version: "1" },
      ],
    });
    await render();
    expect(fetchJsonStrict).toHaveBeenCalledTimes(1);

    await act(async () => container.querySelector<HTMLButtonElement>("[data-testid='cap7-detail-toggle']")!.click());
    expect(container.querySelectorAll("[data-testid='cap7-detail-skills']")).toHaveLength(1);

    const entry = window.location.pathname + window.location.search;
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => {
      root.render(<MemoryRouter initialEntries={[entry]}><LocationProbe /><SkillsPage /></MemoryRouter>);
    });
    await act(async () => {});

    expect(container.querySelectorAll("[data-testid^='skl4-row-']")).toHaveLength(2);
    expect(container.querySelectorAll("[data-testid='cap7-detail-skills']")).toHaveLength(1);
    expect(fetchJsonStrict).toHaveBeenCalledTimes(1);
  });

  it("moves row focus with arrows, Home and End, and toggles detail with Enter without another read", async () => {
    window.history.replaceState({}, "", "/capabilities?tab=skills");
    fetchJsonStrict.mockResolvedValue({
      asOf: "2026-11-19T06:00:00Z",
      items: [
        { skillId: "s1", name: "资料整理", scope: "tenant-shared", version: "2" },
        { skillId: "s2", name: "质检", scope: "unused", version: "1" },
      ],
    });
    await render();
    const calls = fetchJsonStrict.mock.calls.length;
    const rows = [...container.querySelectorAll<HTMLElement>("tr[data-testid^='skl4-row-']")];
    expect(rows).toHaveLength(2);
    expect(rows[0].tabIndex).toBe(0);
    expect(rows[1].tabIndex).toBe(-1);

    const press = async (node: HTMLElement, key: string) => {
      await act(async () => {
        node.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      });
    };

    await act(async () => rows[0].focus());
    expect(document.activeElement).toBe(rows[0]);

    await press(rows[0], "ArrowDown");
    expect(document.activeElement).toBe(rows[1]);
    expect(rows[1].tabIndex).toBe(0);
    expect(rows[0].tabIndex).toBe(-1);

    await press(rows[1], "Home");
    expect(document.activeElement).toBe(rows[0]);
    await press(rows[0], "End");
    expect(document.activeElement).toBe(rows[1]);
    await press(rows[1], "ArrowUp");
    expect(document.activeElement).toBe(rows[0]);
    await press(rows[0], "ArrowDown");

    await press(rows[1], "Enter");
    expect(container.querySelectorAll("[data-testid='cap7-detail-skills']")).toHaveLength(1);
    expect(rows[1].getAttribute("aria-expanded")).toBe("true");

    await press(rows[1], "Escape");
    expect(container.querySelectorAll("[data-testid='cap7-detail-skills']")).toHaveLength(0);
    expect(rows[1].getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(rows[1]);
    expect(fetchJsonStrict.mock.calls.length).toBe(calls);
    const css = readFileSync(`${process.cwd()}/src/modules/skills/skills.css`, "utf8");
    expect(css).toContain("tr[tabindex]:focus-visible");
    expect(css).toContain("var(--color-ring)");
    expect(css).toContain(".capF-state");
    expect(css).toMatch(/min-height:\s*220px/);
  });
});
describe("row deep link", () => {
  const deepSkills = {
    asOf: "2026-11-19T06:00:00Z",
    items: [
      { skillId: "s1", name: "资料整理", scope: "tenant-shared", version: "2" },
      { skillId: "s2", name: "质检", scope: "unused", version: "1" },
    ],
  };

  it("writes the open row to the URL and closes without losing q/sort/dir", async () => {
    window.history.replaceState({}, "", "/capabilities?tab=skills&q=%E8%B5%84%E6%96%99&sort=name&dir=asc");
    fetchJsonStrict.mockResolvedValue(deepSkills);
    await render();
    const calls = fetchJsonStrict.mock.calls.length;

    await act(async () => container.querySelector<HTMLButtonElement>("[data-testid='cap7-detail-toggle']")!.click());
    const afterOpen = new URLSearchParams(container.querySelector("[data-testid='cap8-location']")?.textContent ?? "");
    expect(afterOpen.get("row")).toBe("skills:资料整理");
    expect(afterOpen.get("q")).toBe("资料");
    expect(afterOpen.get("sort")).toBe("name");
    expect(afterOpen.get("dir")).toBe("asc");
    expect(container.querySelectorAll("[data-testid='cap7-detail-skills']")).toHaveLength(1);
    expect(container.querySelector("[data-testid='cap-row-expanded']")).toBeTruthy();
    expect(container.querySelector("tr[data-testid^='skl4-row-']")?.getAttribute("aria-current")).toBe("true");

    await act(async () => container.querySelector<HTMLButtonElement>("[data-testid='cap-row-close']")!.click());
    const afterClose = new URLSearchParams(container.querySelector("[data-testid='cap8-location']")?.textContent ?? "");
    expect(afterClose.get("row")).toBeNull();
    expect(afterClose.get("q")).toBe("资料");
    expect(afterClose.get("sort")).toBe("name");
    expect(afterClose.get("dir")).toBe("asc");
    expect(container.querySelectorAll("[data-testid='cap7-detail-skills']")).toHaveLength(0);
    expect(fetchJsonStrict.mock.calls.length).toBe(calls);
  });

  it("opens and scrolls a pasted row link without another read", async () => {
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll });
    window.history.replaceState({}, "", `/capabilities?tab=skills&${new URLSearchParams({ row: "skills:质检" }).toString()}`);
    fetchJsonStrict.mockResolvedValue(deepSkills);
    await render();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });

    expect(container.querySelectorAll("[data-testid='cap7-detail-skills']")).toHaveLength(1);
    const row = [...container.querySelectorAll<HTMLElement>("tr[data-testid^='skl4-row-']")].find((node) => node.textContent?.includes("质检"));
    expect(row?.getAttribute("aria-current")).toBe("true");
    expect(scroll).toHaveBeenCalled();
    expect(fetchJsonStrict).toHaveBeenCalledTimes(1);
    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("reports a missing row without inventing one", async () => {
    window.history.replaceState({}, "", `/capabilities?tab=skills&${new URLSearchParams({ row: "skills:不存在" }).toString()}`);
    fetchJsonStrict.mockResolvedValue(deepSkills);
    await render();

    const missing = container.querySelector("[data-testid='cap-row-missing']");
    expect(missing?.textContent).toContain("该条目不在当前列表里");
    expect(missing?.getAttribute("title")).toBe("GAP-CAPROW-01");
    expect(container.querySelectorAll("[data-testid='cap7-detail-skills']")).toHaveLength(0);
    expect(container.querySelectorAll("[data-testid^='skl4-row-']")).toHaveLength(2);
    expect(fetchJsonStrict).toHaveBeenCalledTimes(1);
  });
});

describe("capability page size scope", () => {
  it("shows the read-port cap and total without inferring from loaded rows", async () => {
    fetchJsonStrict.mockResolvedValue({
      asOf: "2026-11-19T06:00:00Z",
      items: [{ skillId: "s1", name: "资料整理", scope: "tenant-shared" }],
      total: 57,
      nextCursor: "cursor-2",
    });
    await render();
    const scope = container.querySelector("[data-testid='cap-page-scope']");
    expect(scope?.getAttribute("data-mode")).toBe("capped");
    expect(scope?.textContent).toContain("本页按读口单页上限显示 1 项，总数以读口回传为准");
    expect(container.querySelector("[data-testid='cap-page-scope-detail']")?.textContent).toBe("共 57 项 / 已显示 1 项");
    expect(scope?.getAttribute("title")).toContain("不按已加载条数推算");
  });
});
