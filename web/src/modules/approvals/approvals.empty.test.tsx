// @vitest-environment jsdom
// R211 — the pending-filtered empty state and the way back out, asserted only
// where the existing corpus leaves a gap.
//
// Already covered elsewhere (cited, not rewritten):
//   R70 (ApprovalsHistoryModulePage.test.tsx "R70 queue state consistency"):
//     empty with a filter → 该条件下无审批 sentence + apv-state-clear restores
//     the list; error → sentence + copyable rid + retry; 403 ≡ 404 one body.
//   R54 "button mirrors the rendered rows": empty filters disable apv7-export
//     with a stated reason; R72 "ready with a zero-row filter": clicking gated
//     actions never fetches.
//   R70 "copies the displayed request id verbatim on the error leg": the rid
//     copy round-trip on errors.
// This file adds the pieces those tests do not pin down:
//   ① filtered empty never shows bare 0/undefined tokens, and clearing costs
//      EXACTLY one request with the status parameter dropped, the filter chips
//      returning to the default press state, rows and apv5-count same-source;
//   ② an empty-state export click never reaches createObjectURL (no Blob is
//      built at all) and fires no request;
//   ④ the row-copy rail (apr-row-copy-*) simply does not exist when there are
//      no rows — both for the filtered empty phase and a zero-row search;
//   ⑤ the error panel and the empty panel are mutually exclusive anchors: an
//      error never paints the empty sentence or its clear exit.

import { act, type ReactNode } from "react";
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

async function render(entry: string, page: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter>);
  });
}

async function mount(handler?: (url: string) => Promise<unknown>, entry = "/approvals?tab=history"): Promise<void> {
  api.fetchJSON.mockImplementation(
    handler ??
      (async (url: string) => {
        const match = /[?&]status=([^&]*)/.exec(url);
        const state = match ? decodeURIComponent(match[1]) : null;
        return { items: state === null ? EMPTY_FILTERED_BACK : [] };
      }),
  );
  await render(entry, <ApprovalsHistoryModulePage />);
  await waitFor(() => !document.querySelector(".animate-pulse"), "first page settled");
}

const text = (): string => document.body.textContent ?? "";
const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listUrls = (): string[] => urls().filter((u) => u.startsWith("/agent-api/api/approvals"));
const qa = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
/** Row CARDS only (not their 「详情」 disclosure, whose id also starts apr5-row-). */
const rowNodes = (): HTMLElement[] =>
  Array.from(document.querySelectorAll("[data-testid^='apr5-row-']")).filter(
    (el) => !(el.getAttribute("data-testid") ?? "").includes("-details-"),
  ) as HTMLElement[];
/** The per-row copy BUTTONS only — the status span (apr-row-copy-status) rides
 * along with each row but is not the rail anchor itself. */
const copyRailNodes = (): HTMLElement[] =>
  Array.from(document.querySelectorAll("[data-testid]")).filter((el) =>
    /^apr-row-copy-\d+$/.test(el.getAttribute("data-testid") ?? ""),
  ) as HTMLElement[];

/** One row per state so that a cleared filter demonstrably repaints. */
const BACK: Record<string, unknown[]> = {
  pending: [{ approvalId: "ap_e1", title: "重开后的待办单", status: "pending" }],
  approved: [{ approvalId: "ap_e2", title: "重开后的批准单", status: "approved", decidedAt: "2026-11-17T02:00:00Z" }],
};
const EMPTY_FILTERED_BACK = Object.values(BACK).flat();

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

describe("R211 approvals empty state and clear guards", () => {
  it("① a filtered empty reads as a real answer, and clearing costs exactly one request", async () => {
    await mount(
      async (url: string) => {
        const u = String(url);
        if (u.includes("/api/approval?id=")) return Promise.resolve({});
        if (u.includes("status=pending")) return { items: [] };
        return { items: EMPTY_FILTERED_BACK };
      },
      "/approvals?tab=history&status=pending",
    );
    await waitFor(() => !!qa("apv-state-empty"), "empty panel");
    expect(qa("apv-state")?.getAttribute("data-phase")).toBe("empty");
    expect(qa("apv-state-empty-text")?.textContent).toContain("该条件下无审批");
    // honest copy: no bare engineering tokens leak into the sentence
    expect(text()).not.toMatch(/undefined|null/);
    expect(qa("apv-state-empty-text")?.textContent).not.toMatch(/\b0\b/);
    // the row-copy rail and the table are simply absent (gap ④, same scene)
    expect(copyRailNodes()).toHaveLength(0);
    expect(rowNodes()).toHaveLength(0);

    const before = api.fetchJSON.mock.calls.length;
    const clear = qa("apv-state-clear") as HTMLButtonElement | null;
    expect(clear, "clear exit for filtered empty").toBeTruthy();
    await act(async () => {
      clear!.click();
    });
    await waitFor(() => rowNodes().length === 2, "restored list");
    // exactly one extra request, and it carries no status parameter
    expect(api.fetchJSON.mock.calls.length).toBe(before + 1);
    const fresh = listUrls().slice(-1)[0];
    expect(fresh).not.toContain("status=");
    // the filter press state returns to the default (pending released)
    expect(qa("apr5-filter-pending")?.getAttribute("aria-pressed")).toBe("false");
    // rows and apv5-count read the same set after the clear
    expect(qa("apv5-count")?.textContent?.trim()).toBe(String(rowNodes().length));
  });

  it("② an empty-state export click builds no Blob and asks for nothing", async () => {
    await mount(async () => ({ items: [] }));
    await waitFor(() => !!qa("apv-state-empty"), "empty panel");
    const btn = qa("apv7-export") as HTMLButtonElement;
    expect(btn, "export control present").toBeTruthy();
    expect(btn.disabled, "export disabled on the empty set").toBe(true);
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
    expect(created, "createObjectURL never called").not.toHaveBeenCalled();
    expect(clickSpy, "no download anchor was clicked").not.toHaveBeenCalled();
    expect(api.fetchJSON.mock.calls.length, "gated export never fetches").toBe(before);
    expect(qa("apv7-export-count")?.textContent).toBe("—");
  });

  it("④ a zero-row search also paints no row-copy rail (the rail follows rows, never the header)", async () => {
    await mount(
      async (url: string) => {
        const u = String(url);
        if (u.includes("/api/approval?id=")) return Promise.resolve({});
        return { items: EMPTY_FILTERED_BACK };
      },
      "/approvals?tab=history",
    );
    await waitFor(() => rowNodes().length === 2, "rows on screen");
    expect(copyRailNodes()).toHaveLength(2); // 有行时 rail 在位（对照态）

    const input = qa("apv8-search") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(input, "无此内容zz");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await waitFor(() => !!qa("apv8-search-empty"), "zero visible rows");
    expect(copyRailNodes()).toHaveLength(0);
    expect(rowNodes()).toHaveLength(0);
    expect(qa("apv-state-empty"), "search-empty, not the server-empty panel").toBeNull();
  });

  it("⑤ an error never borrows the empty state's face: anchors are exclusive", async () => {
    await mount(
      async (url: string) => {
        const u = String(url);
        if (u.includes("/api/approval?id=")) return Promise.resolve({});
        throw new ApiError("boom", {
          status: 500,
          body: "",
          url: "/agent-api/api/approvals",
          requestId: "req-r211-500",
        });
      },
      "/approvals?tab=history&status=pending",
    );
    await waitFor(() => !!qa("apv-state-error"), "error panel");
    expect(qa("apv-state")?.getAttribute("data-phase")).toBe("error");
    // the empty trio is absent — no fake 「无审批」 sentence, no fake clear exit
    expect(qa("apv-state-empty"), "empty panel not painted on errors").toBeNull();
    expect(qa("apv-state-empty-text"), "empty sentence not painted on errors").toBeNull();
    expect(qa("apv-state-clear"), "clear exit not painted on errors").toBeNull();
    expect(text()).not.toContain("该条件下无审批");
    // the rid is on the error panel and carries the copy affordance (R70 pins
    // the clipboard round-trip; here only the anchor presence)
    expect(qa("apv-state-rid")?.textContent).toContain("req-r211-500");
    expect(qa("apv-state-rid")?.querySelector('[data-testid="apr5-copy-request-id"]'), "copyable rid").toBeTruthy();
    expect(copyRailNodes()).toHaveLength(0);
  });
});
