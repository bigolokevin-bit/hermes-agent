// @vitest-environment jsdom
// R220 — approvals empty-state × export guards, written ONLY for the gaps the
// corpus leaves open (ticket asked to cite coverage, not duplicate it).
//
// Already covered elsewhere (cited, not rewritten):
//   approvals.empty.test.tsx (R211):
//     ① empty-state export disabled + title + click → no createObjectURL,
//       no anchor click, no request (its case ②, L150-178);
//     ② row-copy rail absent on filtered empty and on a zero-row search,
//       present 1:1 with rows on the unfiltered screen (cases ①/④, L130/L190);
//     ③ clearing a filtered empty costs EXACTLY one status-free request and
//       apv5-count re-reads the restored row set (case ①, L113-148);
//     ④ error and empty anchors are exclusive, error rid anchor carries the
//       copy affordance (case ⑤, L204-230).
//   R70 (queue state consistency) / R54 / R72 for the shared gate copy.
//
// What this file adds:
//   A (ticket ② 逐值): with a search that keeps a NON-ZERO slice (3→1), the
//     apr-row-copy-* count equals the row count exactly — the rail tracks
//     visible rows through a partial filter, not just the two ends;
//   B (ticket ③): cursor hygiene — page into page 2, then filter to an empty
//     state, then clear: the restored request must carry neither the old
//     cursor= nor the dropped status=, fires exactly once, and rows and
//     apv5-count recompute together;
//   C (ticket ①/④ error half): on the ERROR phase the export control is still
//     disabled with a readable reason, and a forced click never reaches
//     createObjectURL nor fetches (R211 ⑤ pinned anchors, not the export gate).

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import ApprovalsHistoryModulePage from "@/modules/approvals/ApprovalsHistoryModulePage";

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

async function mount(handler: (url: string) => Promise<unknown>, entry = "/approvals?tab=history"): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  api.fetchJSON.mockImplementation(handler);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}><ApprovalsHistoryModulePage /></MemoryRouter>);
  });
  // 车道 B（审批筛选折叠）：本文件断言写在筛选墙全展开之上，挂载后统一点开新折叠开关。
  const historyToggle = document.querySelector(
    "[data-testid='apv-h-filter-toggle']",
  ) as HTMLButtonElement | null;
  if (historyToggle && historyToggle.getAttribute("aria-expanded") !== "true") {
    await act(async () => {
      historyToggle.click();
    });
  }
  await waitFor(() => !document.querySelector(".animate-pulse"), "first page settled");
}

const text = (): string => document.body.textContent ?? "";
const qa = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
const listUrls = (): string[] =>
  api.fetchJSON.mock.calls.map((call) => String(call[0])).filter((u) => u.startsWith("/agent-api/api/approvals"));
/** Row CARDS only (the 「详情」 disclosure shares the apr5-row- prefix). */
const rowNodes = (): HTMLElement[] =>
  Array.from(document.querySelectorAll("[data-testid^='apr5-row-']")).filter(
    (el) => !(el.getAttribute("data-testid") ?? "").includes("-details-"),
  ) as HTMLElement[];
/** The per-row copy BUTTONS only — status spans ride along but are not rail anchors. */
const copyRailNodes = (): HTMLElement[] =>
  Array.from(document.querySelectorAll("[data-testid]")).filter((el) =>
    /^apr-row-copy-\d+$/.test(el.getAttribute("data-testid") ?? ""),
  ) as HTMLElement[];

const rowA = { approvalId: "ap_x1", title: "季度预算复议", status: "approved", decidedAt: "2026-11-19T02:00:00Z" };
const rowB = { approvalId: "ap_x2", title: "密钥轮换", status: "approved", decidedAt: "2026-11-18T02:00:00Z" };
const rowC = { approvalId: "ap_x3", title: "渠道发布窗口", status: "rejected", decidedAt: "2026-11-17T02:00:00Z" };

const settle = async (url: string): Promise<{ items: unknown[]; nextCursor?: string }> => {
  const u = String(url);
  if (u.includes("/api/approval?id=")) return { items: [] };
  if (u.includes("cursor=")) return { items: [rowC] };
  if (u.includes("status=")) return { items: [] };
  return { items: [rowA, rowB], nextCursor: "c-r220" };
};

beforeEach(() => {
  api.fetchJSON.mockReset();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe("R220 approvals empty export guards (gap-only additions)", () => {
  it("A: a partial search keeps rail count and row count equal (not just 0 or full)", async () => {
    await mount(async (url) => settle(String(url)));
    await waitFor(() => rowNodes().length === 2, "two rows on screen");
    expect(copyRailNodes()).toHaveLength(2);

    const input = qa("apv8-search") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(input, "密钥");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await waitFor(() => rowNodes().length === 1, "search narrowed to one row");
    // the rail follows visible rows value-by-value, no stale button left behind
    expect(copyRailNodes()).toHaveLength(1);
    expect(qa("apr5-row-ap_x1"), "the filtered-out row left the screen").toBeNull();
    expect(qa("apv5-count")?.textContent?.trim()).toBe("1");

    await act(async () => {
      (qa("apv8-search-clear") as HTMLButtonElement).click();
    });
    await waitFor(() => rowNodes().length === 2, "search cleared");
    expect(copyRailNodes()).toHaveLength(2);
  });

  it("B: page into cursor history, filter to empty, clear — the restored request carries neither old cursor nor status", async () => {
    await mount(async (url) => settle(String(url)));
    await waitFor(() => rowNodes().length === 2, "page one rows");
    const more = qa("apv-page-more") as HTMLButtonElement;
    await act(async () => {
      more.click();
    });
    await waitFor(() => rowNodes().length === 3, "page two appended");
    expect(listUrls().at(-1)).toContain("cursor=c-r220");

    // filter to an empty state (status=pending leg returns nothing)
    await act(async () => {
      (qa("apr5-filter-pending") as HTMLButtonElement).click();
    });
    await waitFor(() => !!qa("apv-state-empty"), "empty panel after the switch");
    expect(rowNodes()).toHaveLength(0);

    const before = api.fetchJSON.mock.calls.length;
    await act(async () => {
      (qa("apv-state-clear") as HTMLButtonElement).click();
    });
    await waitFor(() => rowNodes().length === 2, "cleared back to the default first page");
    expect(api.fetchJSON.mock.calls.length).toBe(before + 1);
    const fresh = listUrls().at(-1) ?? "";
    // the in-memory page-2 cursor must not leak into the restored request
    expect(fresh).not.toContain("cursor=");
    expect(fresh).not.toContain("status=");
    // rows and count recompute together after the clear
    expect(qa("apv5-count")?.textContent?.trim()).toBe(String(rowNodes().length));
  });

  it("C: on the error phase the export gate stays shut — disabled, readable, click builds no Blob and fetches nothing", async () => {
    await mount(async (url) => {
      const u = String(url);
      if (u.includes("/api/approval?id=")) return Promise.resolve({});
      throw new ApiError("boom", {
        status: 500,
        body: "",
        url: "/agent-api/api/approvals",
        requestId: "req-r220-500",
      });
    });
    await waitFor(() => !!qa("apv-state-error"), "error panel");
    // (exclusivity anchors themselves stay with R211 ⑤ — cited, not repeated)
    expect(qa("apv-state-empty")).toBeNull();
    expect(text()).toContain("req-r220-500");

    const btn = qa("apv7-export") as HTMLButtonElement;
    expect(btn, "export control present on the error phase").toBeTruthy();
    expect(btn.disabled, "export disabled on errors too").toBe(true);
    expect(btn.title, "the disabled reason is readable").not.toBe("");

    const created = vi.fn(() => "blob:captured");
    const origCreate = URL.createObjectURL as unknown;
    const origRevoke = URL.revokeObjectURL as unknown;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = created;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
    const before = api.fetchJSON.mock.calls.length;
    try {
      await act(async () => {
        btn.click();
      });
    } finally {
      clickSpy.mockRestore();
      (URL as unknown as { createObjectURL: unknown }).createObjectURL = origCreate;
      (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = origRevoke;
    }
    expect(created, "createObjectURL never called on the error phase").not.toHaveBeenCalled();
    expect(clickSpy, "no download anchor was clicked").not.toHaveBeenCalled();
    expect(api.fetchJSON.mock.calls.length, "the gated export never fetches").toBe(before);
    expect(qa("apv7-export-count")?.textContent).toBe("—");
  });
});
