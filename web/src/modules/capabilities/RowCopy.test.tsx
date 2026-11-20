// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clipboard = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard.copyTextToClipboard }));
vi.mock("@nous-research/ui/ui/components/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: string; outlined?: boolean }) => {
    const { size, outlined, ...rest } = props; void size; void outlined; return <button {...rest}>{children}</button>;
  },
}));

import { CapabilityFieldCopy, toFieldText, type CopyField } from "./listCopy";

const fields: CopyField[] = [
  { label: "口径名", value: "资料整理" },
  { label: "类型或来源", value: "平台内置" },
  { label: "启用态", value: "正常" },
  { label: "最近更新", value: "2026-11-19 13:30" },
  { label: "读口路径", value: "/agent-api/api/skills" },
  { label: "采集时刻", value: null },
];
const expected = "口径名：资料整理\n类型或来源：平台内置\n启用态：正常\n最近更新：2026-11-19 13:30\n读口路径：/agent-api/api/skills\n采集时刻：—";

let root: Root | null = null;
let container: HTMLDivElement;
const q = (id: string) => container.querySelector(`[data-testid='${id}']`);
beforeEach(() => {
  clipboard.copyTextToClipboard.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe("CapabilityFieldCopy", () => {
  it("prints the six detail fields with missing values as — and copies them", async () => {
    expect(toFieldText(fields)).toBe(expected);
    clipboard.copyTextToClipboard.mockResolvedValue(true);
    await act(async () => { root?.render(<CapabilityFieldCopy fields={fields} />); });
    await act(async () => { (q("cap-row-copy") as HTMLButtonElement).click(); await Promise.resolve(); });
    expect(clipboard.copyTextToClipboard).toHaveBeenCalledWith(expected);
    expect(q("cap-row-copy-status")?.textContent).toBe("已复制");
    expect(q("cap-row-copy-fallback")).toBeNull();
  });

  it("shows an identical read-only textarea when the clipboard rejects", async () => {
    clipboard.copyTextToClipboard.mockResolvedValue(false);
    await act(async () => { root?.render(<CapabilityFieldCopy fields={fields} />); });
    await act(async () => { (q("cap-row-copy") as HTMLButtonElement).click(); await Promise.resolve(); });
    expect(q("cap-row-copy-status")?.textContent).toContain("复制失败");
    const fallback = q("cap-row-copy-fallback") as HTMLTextAreaElement;
    expect(fallback.readOnly).toBe(true);
    expect(fallback.value).toBe(expected);
  });
});
