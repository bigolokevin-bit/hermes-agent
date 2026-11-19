// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchJsonStrict = vi.fn();
vi.mock("@/modules/models/fetchJson", () => ({ fetchJsonStrict: (...args: unknown[]) => fetchJsonStrict(...args) }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));
import { ApiError } from "@/lib/api-error";
import { SkillsPage } from "./SkillsPage";
import { resetCapabilityCounts } from "../capabilities/counts";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  fetchJsonStrict.mockReset();
  resetCapabilityCounts();
  window.history.replaceState({}, "", "/");
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function render() {
  const entry = window.location.pathname + window.location.search;
  await act(async () => { root.render(<MemoryRouter initialEntries={[entry]}><SkillsPage /></MemoryRouter>); });
  await act(async () => {});
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
    expect(headers).toEqual(["技能名", "来源/类型", "启用态", "最近更新", "共享范围"]);
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
    const button = [...container.querySelectorAll("button")].find((node) => node.textContent?.includes("重试"));
    await act(async () => { button?.click(); });
    await act(async () => {});
    expect(text()).toContain("恢复后的技能");
  });

  it("renders the empty state for an empty list without a fake count", async () => {
    fetchJsonStrict.mockResolvedValue({ items: [] });
    await render();
    expect(container.querySelector('[data-testid="skl4-empty"]')).toBeTruthy();
    expect(text()).toContain("不补样例行");
  });

  it("puts the GAP id only in the title when the endpoint is missing", async () => {
    fetchJsonStrict.mockRejectedValue(new ApiError("missing", { status: 404, body: "", url: "/agent-api/api/skills" }));
    await render();
    expect(text()).toContain("技能读口未接入");
    expect(document.querySelector('[data-testid="skl4-error"] p[title]')?.getAttribute("title")).toBe("GAP-SKL4-01");
    expect(text()).not.toContain("GAP-");
    expect(text()).not.toContain("404");
    expect(container.querySelector('[data-testid="skl4-retry"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="skl4-apply"]')).toBeTruthy();
  });

  it("renders 403 and 404 with the same neutral body and no status code", async () => {
    fetchJsonStrict.mockRejectedValue(new ApiError("denied", { status: 403, body: "", url: "/agent-api/api/skills" }));
    await render();
    expect(text()).toContain("技能读口未接入");
    expect(text()).toContain("当前账号无权查看");
    expect(text()).not.toContain("403");
    expect(document.querySelector('[data-testid="skl4-error"] p[title]')?.getAttribute("title")).toBe("GAP-SKL4-01");
    expect(container.querySelector('[data-testid="skl4-apply"]')).toBeTruthy();
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
      expect(text()).toContain(state === "loading" ? "正在读取技能" : "还没有已登记的技能");
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
    expect(container.querySelector("[data-testid='cap6-export-count']")?.textContent).toContain("1 条");
    expect(container.querySelector<HTMLButtonElement>("[data-testid='cap6-export']")?.disabled).toBe(false);
  });

  it("shows a no-match state with a clear exit", async () => {
    window.history.replaceState({}, "", "/capabilities?tab=skills&q=不存在");
    fetchJsonStrict.mockResolvedValue({ items: [{ skillId: "s1", name: "资料整理" }] });
    await render();
    expect(text()).toContain("没有匹配项");
    expect(container.querySelector("[data-testid='skl4-clear']")).toBeTruthy();
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
    expect(container.querySelector("[data-testid='cap7-detail-asof']")?.textContent).toContain("该字段未返回");
    expect(container.querySelector("[data-testid='cap7-detail-asof']")?.getAttribute("title")).toContain("没有 asOf");
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
    expect(asof?.getAttribute("title")).toBe("asOfSource：台账快照");
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
    expect(asof?.textContent).toBe("该字段未返回");
    expect(asof?.getAttribute("title")).toContain("不是 ISO");
    expect(container.textContent).not.toContain("2026/11/19");
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
});