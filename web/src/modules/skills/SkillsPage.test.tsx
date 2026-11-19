// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
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

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  fetchJsonStrict.mockReset();
  window.history.replaceState({}, "", "/");
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function render() {
  await act(async () => { root.render(<SkillsPage />); });
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
    await act(async () => { root.render(<SkillsPage />); });
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
      await act(async () => { root.render(<SkillsPage />); });
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
    await act(async () => { root.render(<SkillsPage />); });
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