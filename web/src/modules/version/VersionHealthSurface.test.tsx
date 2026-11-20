// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-error";

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

const api = vi.hoisted(() => ({ fetchJsonStrict: vi.fn() }));
vi.mock("../models/fetchJson", () => ({ fetchJsonStrict: api.fetchJsonStrict }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn() }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));
import { VersionHealthSurface } from "./VersionHealthSurface";
import { COPY_SCOPE_TEXT } from "../health/copyScope";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement;
const text = () => container.textContent ?? "";

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 2500) throw new Error(`waitFor: ${label}`);
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  }
}

async function render(preview?: "loading" | "empty" | "error") {
  await act(async () => { root?.unmount(); });
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root?.render(<VersionHealthSurface preview={preview ?? null} />); });
}

const reject = (status: number, requestId?: string) => () =>
  Promise.reject(new ApiError("failed", { status, body: "{}", url: "/agent-api/api/version", requestId }));

beforeEach(() => {
  api.fetchJsonStrict.mockReset();
  clip.copyTextToClipboard.mockReset();
  clip.copyTextToClipboard.mockResolvedValue(true);
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe("VersionHealthSurface", () => {
  it("shows the version gap honestly and still renders the health row", async () => {
    api.fetchJsonStrict.mockImplementation((url: string) => {
      if (url.includes("/version")) return reject(404, "req-ver-404")();
      return Promise.resolve({ ok: true, asOf: "2026-11-19T15:17:09Z", sources: [] });
    });
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='ver5-gap']"), "gap");
    const gap = container.querySelector("[data-testid='ver5-gap']")!;
    expect(gap.textContent).toContain("版本读口未接入");
    expect(gap.getAttribute("title")).toBe("GAP-VER5-01");
    expect(gap.textContent).toContain("req-ver-404");
    expect(text()).not.toContain("GAP-VER5-01");
    expect(container.querySelector("[data-testid='ver5-apply']")?.getAttribute("href")).toBe("#/approvals");
    expect(container.querySelector("[data-testid='ver5-health-state']")?.textContent).toBe("正常");
    expect(container.querySelector("[data-testid='ver5-health-asof']")?.textContent).toContain("2026-11-19 23:17");
  });

  it("gives 403 and 404 the same neutral body", async () => {
    api.fetchJsonStrict.mockImplementation((url: string) => {
      if (url.includes("/version")) return reject(403, "req-ver-denied")();
      return Promise.resolve({ ok: false, asOf: "2026-11-19T15:17:09Z", sources: [] });
    });
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='ver5-gap']"), "gap");
    expect(container.querySelector("[data-testid='ver5-gap']")?.textContent).toContain("版本读口未接入");
    expect(text()).not.toContain("403");
    expect(container.querySelector("[data-testid='ver5-health-state']")?.textContent).toBe("降级");
  });

  it("renders real component rows with Beijing build time and per-field missing reasons", async () => {
    api.fetchJsonStrict.mockImplementation((url: string) => {
      if (url.includes("/version")) return Promise.resolve({
        components: [
          { name: "控制台", version: "4.2.1", builtAt: "2026-11-19T16:05:00Z", status: "ok" },
          { name: "运行时", status: "degraded" },
        ],
      });
      return Promise.resolve({ ok: true, asOf: "2026-11-19T16:00:00Z", sources: [] });
    });
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='ver5-table']"), "table");
    expect(text()).toContain("控制台");
    expect(text()).toContain("4.2.1");
    expect(text()).toContain("2026-11-20 00:05");
    expect(text()).toContain("正常");
    expect(text()).toContain("降级");
    const rows = container.querySelectorAll("[data-testid^='ver5-row-']");
    expect(rows).toHaveLength(2);
    expect(rows[1]!.querySelector("[data-testid='ver5-version']")?.textContent).toContain("—");
    expect(rows[1]!.querySelector("[data-testid='ver5-version']")?.getAttribute("title")).toContain("不编造版本号");
    expect(rows[1]!.querySelector("[data-testid='ver5-built']")?.getAttribute("title")).toContain("没有提供构建时刻");
  });

  it("keeps the version table when the health read fails", async () => {
    api.fetchJsonStrict.mockImplementation((url: string) => {
      if (url.includes("/version")) return Promise.resolve([{ name: "BFF", version: "1.0.0", status: "ok" }]);
      return reject(500, "req-health-500")();
    });
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='ver5-table']"), "table");
    expect(container.querySelector("[data-testid='ver5-health-state']")?.textContent).toBe("待核实");
    expect(container.querySelector("[data-testid='ver5-health']")?.textContent).toContain("不影响上方版本表");
    expect(container.querySelector("[data-testid='ver5-table']")?.textContent).toContain("BFF");
  });

  it("takes the version identifier from health so /system and ver5 agree", async () => {
    api.fetchJsonStrict.mockImplementation((url: string) => {
      if (url.includes("/health")) return Promise.resolve({
        ok: true,
        asOf: "2026-11-19T15:17:09Z",
        sources: [{ id: "console", name: "控制台", state: "ok", version: "9.9.9", build: "ignored-fallback" }],
      });
      if (url.includes("/version")) return Promise.resolve({ components: [{ name: "控制台", version: "1.1.1" }] });
      return Promise.reject(new Error("unexpected"));
    });
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='ver5-table']"), "table");
    expect(container.querySelector("[data-testid='ver5-version']")?.textContent).toBe("9.9.9");
    expect(api.fetchJsonStrict).toHaveBeenCalledTimes(1);
    expect(String(api.fetchJsonStrict.mock.calls[0]?.[0])).toContain("/health");
  });

  it("keeps a missing health version as a dash with a reason, never inventing one", async () => {
    api.fetchJsonStrict.mockImplementation((url: string) => {
      if (url.includes("/health")) return Promise.resolve({
        ok: true,
        asOf: "2026-11-19T15:17:09Z",
        sources: [{ id: "console", name: "控制台", state: "ok" }],
      });
      return Promise.reject(new Error("unexpected"));
    });
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='ver5-table']"), "table");
    const version = container.querySelector("[data-testid='ver5-version']")!;
    expect(version.textContent).toBe("—");
    expect(version.getAttribute("title")).toContain("不编造版本号");
  });

  it("copies the on-screen version rows without another request and keeps asOfSource in the title only", async () => {
    api.fetchJsonStrict.mockImplementation(() => Promise.resolve({
      ok: true,
      asOf: "2026-11-19T15:17:09Z",
      asOfSource: "bff-read-time",
      sources: [
        { id: "console", name: "控制台", state: "ok", version: "9.9.9" },
        { id: "worker", name: "工作进程", state: "degraded" },
      ],
    }));
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='ver5-table']"), "table");
    const before = api.fetchJsonStrict.mock.calls.length;
    expect(container.querySelector("[data-testid='sys-copy-scope']")?.textContent).toBe(COPY_SCOPE_TEXT);
    expect(container.querySelector("[data-testid='ver-copy']")?.getAttribute("title")).toContain(COPY_SCOPE_TEXT);
    expect(text()).not.toContain("bff-read-time");
    expect(container.querySelector("[data-testid='ver5-health-asof']")?.getAttribute("title")).toContain("bff-read-time");

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid='ver-copy']")!.click();
    });
    await waitFor(() => container.querySelector("[data-testid='ver-copy-status']")?.textContent === "已复制 2 行", "copied");
    const copied = clip.copyTextToClipboard.mock.calls[0]?.[0];
    expect(copied).toBe([
      "服务名 | 版本或构建标识 | 健康态 | 采集时刻",
      "控制台 | 9.9.9 | 正常 | 2026-11-19 23:17",
      "工作进程 | — | 降级 | 2026-11-19 23:17",
    ].join("\n"));
    expect(copied).not.toContain("bff-read-time");
    expect(container.querySelector("[data-testid='ver-copy-fallback']")).toBeNull();
    expect(api.fetchJsonStrict.mock.calls.length).toBe(before);
  });

  it("shows the identical read-only textarea when the clipboard rejects", async () => {
    clip.copyTextToClipboard.mockResolvedValue(false);
    api.fetchJsonStrict.mockImplementation(() => Promise.resolve({
      ok: true,
      asOf: "2026-11-19T15:17:09Z",
      sources: [{ id: "console", name: "控制台", state: "ok", version: "9.9.9" }],
    }));
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='ver5-table']"), "table");
    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid='ver-copy']")!.click();
    });
    await waitFor(() => !!container.querySelector("[data-testid='ver-copy-fallback']"), "fallback");
    const fallback = container.querySelector<HTMLTextAreaElement>("[data-testid='ver-copy-fallback']")!;
    expect(fallback.readOnly).toBe(true);
    expect(container.querySelector("[data-testid='ver-copy-status']")?.textContent).toContain("复制失败");
    expect(fallback.value).toBe(clip.copyTextToClipboard.mock.calls[0]?.[0]);
    expect(fallback.value).toContain("控制台 | 9.9.9 | 正常 | 2026-11-19 23:17");
  });

  it("disables copy with a reason when the whole version surface is unreadable", async () => {
    api.fetchJsonStrict.mockImplementation((url: string) => {
      if (url.includes("/version")) return reject(404, "req-ver-copy")();
      return Promise.resolve({ ok: true, asOf: "2026-11-19T15:17:09Z", sources: [] });
    });
    await render();
    await waitFor(() => !!container.querySelector("[data-testid='ver5-gap']"), "gap");
    const button = container.querySelector<HTMLButtonElement>("[data-testid='ver-copy']")!;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("title")).toContain("版本读口未接入");
    expect(button.getAttribute("title")).toContain("GAP-VER5-01");
    expect(button.getAttribute("title")).toContain(COPY_SCOPE_TEXT);
    expect(text()).not.toContain("GAP-VER5-01");
  });

  it("previews empty and error states without any request", async () => {
    await render("empty");
    expect(container.querySelector("[data-testid='ver5-empty']")).toBeTruthy();
    expect(container.querySelector("[data-testid='ver5-health']")).toBeTruthy();
    expect(api.fetchJsonStrict).not.toHaveBeenCalled();

    api.fetchJsonStrict.mockClear();
    await render("error");
    expect(container.querySelector("[data-testid='ver5-error']")).toBeTruthy();
    expect(container.querySelector("[data-testid='ver5-retry']")).toBeTruthy();
    expect(api.fetchJsonStrict).not.toHaveBeenCalled();
  });
});
