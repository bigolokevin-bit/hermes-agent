// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));
vi.mock("@nous-research/ui/ui/components/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

import { CapabilityCopy, COPY_HEADER, toListText } from "./listCopy";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  clipboard.copyTextToClipboard.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const rows = [
  { name: "资料整理", type: "平台内置", enabled: "正常", updated_at: "2026-11-19 13:30" },
  { name: "待补字段", type: "团队自建", enabled: "停用", updated_at: null },
];

async function render(next = rows) {
  await act(async () => {
    root.render(<CapabilityCopy rows={next} />);
  });
}

describe("capability list copy", () => {
  it("prints the fixed header and every displayed value, using — for a missing cell", () => {
    expect(toListText(rows)).toBe(
      `${COPY_HEADER}\n资料整理,平台内置,正常,2026-11-19 13:30\n待补字段,团队自建,停用,—`,
    );
  });

  it("announces the row count after a successful copy and makes no request", async () => {
    clipboard.copyTextToClipboard.mockResolvedValue(true);
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>("[data-testid='capC-copy']")!.click());
    expect(clipboard.copyTextToClipboard).toHaveBeenCalledTimes(1);
    expect(clipboard.copyTextToClipboard.mock.calls[0][0]).toBe(toListText(rows));
    expect(container.querySelector("[data-testid='capC-copy-status']")!.textContent).toBe("已复制 2 行");
    expect(container.querySelector("[data-testid='capC-copy-fallback']")).toBeNull();
    expect(container.querySelector<HTMLButtonElement>("[data-testid='capC-copy']")!.title).toContain("不会再发请求");
  });

  it("offers the exact same text in a read-only textarea when the clipboard refuses", async () => {
    clipboard.copyTextToClipboard.mockResolvedValue(false);
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>("[data-testid='capC-copy']")!.click());
    expect(container.querySelector("[data-testid='capC-copy-status']")!.textContent).toContain("复制失败");
    const fallback = container.querySelector<HTMLTextAreaElement>("[data-testid='capC-copy-fallback']")!;
    expect(fallback.readOnly).toBe(true);
    expect(fallback.value).toBe(toListText(rows));
  });

  it("disables the control with a stated reason when the list is empty", async () => {
    await render([]);
    const button = container.querySelector<HTMLButtonElement>("[data-testid='capC-copy']")!;
    expect(button.disabled).toBe(true);
    expect(button.title).toBe("当前没有可导出的条目。");
  });
});