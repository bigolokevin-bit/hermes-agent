// @vitest-environment jsdom
// Three faces of one run row — the inline preview, the copied text and the
// exported CSV — must say the same thing. The page, the clipboard and the
// download are all driven here so a drift between them fails a test instead of
// surprising a person reading the file later.

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
const clip = vi.hoisted(() => ({ copyTextToClipboard: vi.fn((text: string) => Promise.resolve(Boolean(text))) }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clip.copyTextToClipboard }));

import { RunsModulePage } from "./RunsModulePage";

const FIELD_MISSING = "该字段未返回";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function render(entry: string): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(createElement(MemoryRouter, { initialEntries: [entry] }, createElement(RunsModulePage)));
  });
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const rows = (): number => document.querySelectorAll("[data-testid^='run5-row-'][data-status]").length;
const node = (testid: string): HTMLElement | null =>
  document.querySelector(`[data-testid='${testid}']`) as HTMLElement | null;

const okList = (items: unknown[]) => async (url: string) => {
  if (url.includes("/api/runs") || url.includes("/api/run-stats")) return { items };
  return { items: [] };
};

const P_FULL = {
  runId: "rn_01M7822PARITY00000000001",
  status: "completed",
  costStatus: "upstream",
  costUsd: 0,
  startedAt: "2026-11-18T02:00:00Z",
  endedAt: "2026-11-18T02:11:00Z",
  employeeId: "emp_aaaabbbbcccc",
};
const P_HALF = {
  runId: "rn_01M7822PARITY00000000002",
  status: "running",
  costStatus: "unknown",
  costUsd: null,
  startedAt: "2026-11-18T03:30:00Z",
  employeeId: "emp_ddddeeeeffff",
};
const P_BARE = {
  runId: "rn_01M7822PARITY00000000003",
  startedAt: "2026-11-18T04:00:00Z",
};

async function openPreview(index: number): Promise<void> {
  const toggle = node(`run-row-toggle-${index}`) as HTMLButtonElement;
  await act(async () => {
    toggle.click();
  });
}

const previewField = (index: number, field: string): string =>
  node(`run-row-preview-${index}-${field}`)?.querySelector("dd")?.textContent ?? "";

async function copyText(): Promise<string[]> {
  const button = node("run-list-copy") as HTMLButtonElement;
  await act(async () => {
    button.click();
  });
  const last = clip.copyTextToClipboard.mock.calls.at(-1)?.[0];
  return String(last ?? "").split("\n");
}

let blobs: Blob[] = [];
let downloads: string[] = [];
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;

async function exportCsv(): Promise<string[]> {
  const button = node("run-list-export") as HTMLButtonElement;
  await act(async () => {
    button.click();
  });
  const blob = blobs.at(-1);
  const text = blob ? await blob.text() : "";
  return text.replace(/^\uFEFF/, "").split("\n");
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.copyTextToClipboard.mockReset();
  clip.copyTextToClipboard.mockImplementation((text: string) => Promise.resolve(Boolean(text)));
  blobs = [];
  downloads = [];
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (blob: Blob) => {
    blobs.push(blob);
    return "blob:parity";
  };
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});

describe("runs parity — one row, three faces", () => {
  it("says the same thing in the preview, the copied text and the CSV", async () => {
    api.fetchJSON.mockImplementation(okList([P_FULL, P_HALF, P_BARE]));
    await render("/runs");
    await waitFor(() => rows() === 3, "three rows");

    const copy = await copyText();
    const csv = await exportCsv();
    expect(copy).toHaveLength(4);
    expect(csv).toHaveLength(4);

    await openPreview(0);
    expect(previewField(0, "status")).toBe(copy[1].split(",")[1]);
    expect(previewField(0, "started")).toBe(copy[1].split(",")[2]);
    expect(previewField(0, "ended")).toBe(copy[1].split(",")[3]);
    expect(previewField(0, "elapsed")).toBe(copy[1].split(",")[4]);
    expect(previewField(0, "cost")).toBe(copy[1].split(",")[5]);
    expect(previewField(0, "employee")).toBe(copy[1].split(",")[6]);
    expect(csv[1].split(",")[1]).toBe(copy[1].split(",")[1]);
    expect(csv[1].split(",")[2]).toBe(copy[1].split(",")[2]);
    expect(csv[1].split(",")[3]).toBe(copy[1].split(",")[3]);
    expect(csv[1].split(",")[4]).toBe(copy[1].split(",")[4]);
    expect(csv[1].split(",")[5]).toBe("0.00");
    expect(copy[1].split(",")[5]).toBe("$0.00");
    expect(csv[1].split(",")[6]).toBe(copy[1].split(",")[6]);

    await openPreview(1);
    expect(previewField(1, "status")).toBe("运行中");
    expect(previewField(1, "elapsed")).toBe("—");
    expect(copy[2].split(",")[4]).toBe("—");
    expect(csv[2].split(",")[4]).toBe("");
    expect(previewField(1, "cost")).toBe("—");
    expect(copy[2].split(",")[5]).toBe("—");
    expect(csv[2].split(",")[5]).toBe("");
    expect(previewField(1, "ended")).toBe(FIELD_MISSING);
    expect(copy[2].split(",")[3]).toBe("—");
    expect(csv[2].split(",")[3]).toBe("");

    await openPreview(2);
    expect(previewField(2, "status")).toBe(FIELD_MISSING);
    expect(copy[3].split(",")[1]).toBe("—");
    expect(csv[3].split(",")[1]).toBe("");
    expect(previewField(2, "employee")).toBe("未指派");
    expect(copy[3].split(",")[6]).toBe("未指派");
    expect(csv[3].split(",")[6]).toBe("未指派");
  });

  it("counts and orders the CSV rows the way the table shows them", async () => {
    api.fetchJSON.mockImplementation(okList([P_FULL, P_HALF, P_BARE]));
    await render("/runs?window=7d&status=failed");
    await waitFor(() => rows() === 3, "three rows");
    const bodyOrder = Array.from(document.querySelectorAll("[data-testid^='run5-row-'][data-status]"))
      .map((el) => el.querySelector("[data-testid$='-code']")?.textContent ?? "");
    const csv = await exportCsv();
    const count = node("run-list-export-count")?.textContent ?? "";
    expect(csv[0]).toBe("run,status,started,ended,elapsed,cost,employee");
    expect(csv).toHaveLength(bodyOrder.length + 1);
    expect(count).toContain(String(bodyOrder.length));
    expect(csv.slice(1).map((line) => line.split(",")[0])).toEqual(bodyOrder);
    expect(downloads.at(-1)).toMatch(/^runs-7d-failed-\d{8}-\d{4}\.csv$/);
  });

  it("keeps the same count and order with no filters in the address", async () => {
    api.fetchJSON.mockImplementation(okList([P_HALF, P_FULL]));
    await render("/runs");
    await waitFor(() => rows() === 2, "two rows");
    const bodyOrder = Array.from(document.querySelectorAll("[data-testid^='run5-row-'][data-status]"))
      .map((el) => el.querySelector("[data-testid$='-code']")?.textContent ?? "");
    const csv = await exportCsv();
    expect(csv.slice(1).map((line) => line.split(",")[0])).toEqual(bodyOrder);
    expect(csv).toHaveLength(3);
    expect(node("run-list-export-count")?.textContent ?? "").toContain("2");
    expect(downloads.at(-1)).toMatch(/^runs-all-all-\d{8}-\d{4}\.csv$/);
  });

  it("keeps elapsed empty rather than borrowing the clock when one end is missing", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2031-03-04T05:06:07Z"));
    api.fetchJSON.mockImplementation(okList([P_HALF, P_BARE]));
    await render("/runs");
    await waitFor(() => rows() === 2, "two rows");
    const copy = await copyText();
    const csv = await exportCsv();
    await openPreview(0);
    expect(previewField(0, "elapsed")).toBe("—");
    expect(previewField(0, "elapsed")).not.toContain("2031");
    expect(copy[1].split(",")[4]).toBe("—");
    expect(csv[1].split(",")[4]).toBe("");
    await openPreview(1);
    expect(previewField(1, "elapsed")).toBe("—");
    expect(previewField(1, "started")).not.toContain("2031");
    expect(copy.join("\n")).not.toContain("2031");
    expect(csv.join("\n")).not.toContain("2031");
    // The file name carries the generation minute (the fake clock's), which is
    // not a data time; only the three value faces must stay free of it.
    expect(node("run-export-name")?.textContent ?? "").toContain("2031");
  });

  it("asks the service nothing beyond the first read", async () => {
    api.fetchJSON.mockImplementation(okList([P_FULL, P_HALF]));
    await render("/runs");
    await waitFor(() => rows() === 2, "two rows");
    const before = urls();
    const runsBefore = before.filter((url) => url.includes("/api/runs")).length;
    await openPreview(0);
    await copyText();
    await exportCsv();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(urls()).toEqual(before);
    expect(urls().filter((url) => url.includes("/api/runs")).length).toBe(runsBefore);
  });
});
