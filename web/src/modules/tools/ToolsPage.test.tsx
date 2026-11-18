// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({ fetchJSON: (...args: unknown[]) => fetchJSON(...args) }));
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { outlined?: boolean }) => {
    const { outlined, ...rest } = props;
    void outlined;
    return <button {...rest}>{children}</button>;
  },
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));
import { ToolsPage } from "./ToolsPage";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  fetchJSON.mockReset(); window.history.replaceState({}, "", "/");
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function render() {
  await act(async () => { root.render(<ToolsPage />); });
  await act(async () => {});
}

describe("ToolsPage", () => {
  it("falls back to labeled fixture rows when the live read fails", async () => {
    fetchJSON.mockRejectedValue(new Error("unavailable"));
    await render();
    expect(container.querySelector('[data-fixture="1"]')).toBeTruthy();
    expect(container.textContent).toContain("示例数据");
    expect(container.textContent).toContain("工具连接的数据接口尚未接入本控制台");
    expect(container.textContent).toContain("远端拒绝");
    expect(container.textContent).toContain("未提供检查时刻");
  });

  it("keeps unavailable servers visible with their reason", async () => {
    fetchJSON.mockResolvedValue({ items: [
      { id: "unavail-123", name: "归档服务", status: "unavailable", reason: "上游返回连接失败：远端拒绝" },
    ] });
    await render();
    expect(container.textContent).toContain("归档服务");
    expect(container.textContent).toContain("不可用");
    expect(container.textContent).toContain("远端拒绝");
  });

  it("explains a missing unavailable reason", async () => {
    fetchJSON.mockResolvedValue({ items: [{ id: "srv-1", name: "旧连接", status: "unavailable" }] });
    await render();
    expect(container.textContent).toContain("—（上游未说明不可用原因）");
  });

  it("shows request id and retry in the forced error preview", async () => {
    window.history.replaceState({}, "", "/?state=error");
    await render();
    expect(container.textContent).toContain("请求号：示例请求号");
    expect([...container.querySelectorAll("button")].some((button) => button.textContent?.includes("重试"))).toBe(true);
  });
});
