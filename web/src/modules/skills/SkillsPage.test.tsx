// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({ fetchJSON: (...args: unknown[]) => fetchJSON(...args) }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));
import { SkillsPage } from "./SkillsPage";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  fetchJSON.mockReset();
  window.history.replaceState({}, "", "/");
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function render() {
  await act(async () => { root.render(<SkillsPage />); });
  await act(async () => {});
}

describe("SkillsPage", () => {
  it("renders normalized skills", async () => {
    fetchJSON.mockResolvedValue({ items: [{ skillId: "skill-12345678", name: "资料整理", scope: "tenant-shared", version: "2" }] });
    await render();
    expect(container.textContent).toContain("资料整理");
    expect(container.textContent).toContain("团队共享");
    expect(container.textContent).toContain("台账未提供来源");
    expect(container.textContent).toContain("—（台账列表未提供）");
    fetchJSON.mockResolvedValueOnce({ skill: { skillId: "skill-12345678", name: "资料整理", description: "整理资料摘要", createdAt: "2026-11-18T02:30:00Z" }, versions: [{ version: "3.1", status: "active", statusChangedAt: "2026-11-18T03:00:00Z" }] });
    await act(async () => { (container.querySelector('[data-testid="skills-list"] button') as HTMLButtonElement).click(); });
    await act(async () => {});
    expect(container.textContent).toContain("整理资料摘要");
    expect(container.textContent).toContain("3.1");
    expect(container.textContent).toContain("启用");
    expect(container.textContent).toContain("2026/11/18 11:00");
  });

  it("explains a missing name", async () => {
    fetchJSON.mockResolvedValue({ items: [{ skillId: "skill-1", scope: "unused" }] });
    await render();
    expect(container.textContent).toContain("—");
    expect(container.textContent).toContain("上游未提供名称");
  });

  it("shows request id and retries after failure", async () => {
    fetchJSON.mockRejectedValueOnce({ requestId: "req-skills-1" }).mockResolvedValueOnce({ items: [{ id: "s1", name: "恢复后的技能" }] });
    await render();
    expect(container.textContent).toContain("请求号：req-skills-1");
    const button = [...container.querySelectorAll("button")].find((node) => node.textContent?.includes("重试"));
    await act(async () => { button?.click(); });
    await act(async () => {});
    expect(container.textContent).toContain("恢复后的技能");
  });

  it("renders the empty state for an empty list", async () => {
    fetchJSON.mockResolvedValue({ items: [] });
    await render();
    expect(container.querySelector('[data-testid="skills-empty"]')).toBeTruthy();
  });

  it("picks latest version by semver, not by row order", async () => {
    // 上游同毫秒时 version 文本升序：1.10.0 排在 1.2.0 之前（末行并非最新），
    // 详情必须按语义化版本取 1.10.0。
    fetchJSON.mockResolvedValue({ items: [{ skillId: "skill-semver", name: "版本对比", scope: "unused" }] });
    await render();
    fetchJSON.mockResolvedValueOnce({
      skill: { skillId: "skill-semver", name: "版本对比" },
      versions: [
        { version: "1.10.0", status: "active", statusChangedAt: "2026-11-18T04:00:00Z" },
        { version: "1.2.0", status: "archived", statusChangedAt: "2026-11-18T04:00:00Z" },
      ],
    });
    await act(async () => { (container.querySelector('[data-testid="skills-list"] button') as HTMLButtonElement).click(); });
    await act(async () => {});
    expect(container.textContent).toContain("1.10.0");
    expect(container.textContent).toContain("启用");
  });
});
