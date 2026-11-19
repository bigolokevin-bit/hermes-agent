// @vitest-environment jsdom
// 数据保留与清理（/system?tab=retention 的只读面）：缺源按未接入列四区而不是记 0、
// 真回答按原样显示（北京时间到分、字节、占用比例不进位）、四态齐且 403 与 404 同体、
// 两个写动作只占位（disabled + aria-disabled + data-planned + title）。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import RetentionModulePage from "@/modules/audit/RetentionModulePage";

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

async function render(entry = "/system?tab=retention"): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <RetentionModulePage />
      </MemoryRouter>,
    );
  });
}

const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
/** A field wrapper carries its label; the value is the `dd` inside it. */
const val = (id: string): string | null => q(id)?.querySelector("dd")?.textContent ?? null;
const text = (): string => document.body.textContent ?? "";
const calls = (): number => api.fetchJSON.mock.calls.length;

function unknownRoute(): ApiError {
  return new ApiError("missing route", {
    status: 404,
    body: JSON.stringify({ code: "console.unknown_route", message: "unknown console API route" }),
    url: "/agent-api/api/retention",
    requestId: "rid-unwired",
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockRejectedValue(unknownRoute());
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe("an environment with no retention route", () => {
  it("lists all four areas as 未接入 and never prints a 0 for a missing number", async () => {
    await render();
    await waitFor(() => q("ret4-unwired-note") !== null, "unwired note");

    expect(api.fetchJSON).toHaveBeenCalledTimes(1);
    expect(String(api.fetchJSON.mock.calls[0][0])).toBe("/agent-api/api/retention");

    for (const key of ["audit", "runs", "sessions", "uploads"]) {
      expect(q(`ret4-section-${key}`)).not.toBeNull();
      expect(q(`ret4-unwired-${key}`)?.textContent).toContain("未接入");
      for (const field of ["days", "last", "next", "used", "limit", "share"]) {
        const cell = q(`ret4-${field}-${key}`);
        expect(cell, `${field}/${key}`).not.toBeNull();
        expect(val(`ret4-${field}-${key}`)).toBe("—");
        expect(cell!.querySelector("dd")?.getAttribute("data-missing")).toBe("true");
        expect(cell!.querySelector("dd")?.getAttribute("title")).toBeTruthy();
      }
    }
    expect(q("ret4-summary")?.textContent).toContain("4 个区块都未接入");
    // No *value cell* may carry a fabricated zero — the reason sentence may
    // name the zeros this page refuses to print, which is not a measurement.
    const values = Array.from(document.querySelectorAll('[data-testid^="ret4-section-"] dd')).map((dd) => dd.textContent ?? "");
    expect(values.length).toBe(24);
    for (const value of values) expect(value).toBe("—");
  });

  it("keeps both write actions as declared, disabled placeholders", async () => {
    await render();
    await waitFor(() => q("ret4-planned") !== null, "planned block");

    for (const id of ["ret4-planned-cleanup", "ret4-planned-policy"]) {
      const button = q(id) as HTMLButtonElement | null;
      expect(button, id).not.toBeNull();
      expect(button!.disabled).toBe(true);
      expect(button!.getAttribute("aria-disabled")).toBe("true");
      expect(button!.getAttribute("data-planned")).toBe("true");
      expect(button!.getAttribute("title")).toBeTruthy();
    }
    const before = calls();
    await act(async () => {
      (q("ret4-planned-cleanup") as HTMLButtonElement).click();
      (q("ret4-planned-policy") as HTMLButtonElement).click();
    });
    expect(calls()).toBe(before);
    expect(text()).not.toContain("清理完成");
    expect(text()).not.toContain("已保存");
  });

  it("shows the gap only inside a title and the technical fold, never as surface copy", async () => {
    await render();
    await waitFor(() => q("ret4-unwired-note") !== null, "unwired note");
    const surface = document.querySelector('[data-testid="ret4-sections"]');
    expect(surface?.textContent ?? "").not.toContain("GAP-");
    expect(surface?.textContent ?? "").not.toContain("404");
    expect(q("ret4-unwired-audit")?.getAttribute("title")).toContain("GAP-13");
    const toggle = q("ret4-tech-details")?.querySelector("button");
    expect(toggle, "technical toggle").not.toBeNull();
    await act(async () => {
      toggle!.click();
    });
    expect(q("ret4-tech-details")?.textContent).toContain("console.unknown_route");
  });
});

describe("a real answer", () => {
  it("prints days, Beijing clean-up times, bytes and a share that never rounds up to 100", async () => {
    api.fetchJSON.mockResolvedValue({
      sections: [
        {
          key: "audit",
          retentionDays: 180,
          lastCleanupAt: "2026-11-19T12:05:00Z",
          nextRunAt: "2026-11-20T01:00:00Z",
          usedBytes: 996,
          limitBytes: 1000,
        },
        { key: "runs", days: 30, usedBytes: 0, limitBytes: 1024 },
      ],
      asOf: "2026-11-19T12:10:00Z",
    });
    await render();
    await waitFor(() => val("ret4-days-audit") === "180 天", "audit days");

    expect(val("ret4-last-audit")).toBe("2026-11-19 20:05");
    expect(val("ret4-next-audit")).toBe("2026-11-20 09:00");
    expect(val("ret4-used-audit")).toBe("996 B");
    expect(val("ret4-limit-audit")).toBe("1000 B");
    expect(val("ret4-share-audit")).toBe("99%");
    expect(val("ret4-used-runs")).toBe("0 B");
    expect(val("ret4-share-runs")).toBe("0%");
    expect(q("ret4-summary")?.textContent).toContain("已接入 2 / 4");
    expect(q("ret4-asof")?.textContent).toContain("2026-11-19 20:10");
    // The two areas the answer skipped stay on screen, marked 未接入.
    expect(q("ret4-unwired-sessions")).not.toBeNull();
    expect(q("ret4-unwired-uploads")).not.toBeNull();
  });
});

describe("four states", () => {
  it("403 and 404 land on the same denied body with the same copyable id", async () => {
    const denied = (status: number) =>
      new ApiError("denied", {
        status,
        body: JSON.stringify({ code: status === 403 ? "console.forbidden" : "console.not_found" }),
        url: "/agent-api/api/retention",
        requestId: "rid-denied",
      });
    api.fetchJSON.mockRejectedValueOnce(denied(403));
    await render();
    await waitFor(() => q("ret4-denied") !== null, "denied 403");
    const first = q("ret4-denied")!.outerHTML;
    expect(q("ret4-denied-request-id")?.textContent).toContain("rid-denied");
    expect(first).not.toContain("console.forbidden");

    api.fetchJSON.mockRejectedValueOnce(denied(404));
    await render();
    await waitFor(() => q("ret4-denied") !== null, "denied 404");
    expect(q("ret4-denied")!.outerHTML).toBe(first);
    expect(q("ret4-section-audit")).toBeNull();
  });

  it("a failure carries a human sentence, the request id and a retry that asks again", async () => {
    api.fetchJSON.mockRejectedValue(
      new ApiError("boom", {
        status: 503,
        body: JSON.stringify({ code: "console.upstream_unavailable" }),
        url: "/agent-api/api/retention",
        requestId: "rid-err",
      }),
    );
    await render();
    await waitFor(() => q("ret4-error") !== null, "error panel");
    expect(q("ret4-error")!.textContent).toContain("数据保留与清理没能读出来");
    expect(q("ret4-error")!.textContent).not.toContain("503");
    expect(q("ret4-error-request-id")?.textContent).toContain("rid-err");

    api.fetchJSON.mockRejectedValue(unknownRoute());
    const before = calls();
    await act(async () => {
      (q("ret4-error-retry") as HTMLButtonElement).click();
    });
    await waitFor(() => q("ret4-unwired-note") !== null, "unwired after retry");
    expect(calls()).toBe(before + 1);
  });

  it("paints a skeleton while the request is outstanding", async () => {
    let settle: (value: unknown) => void = () => undefined;
    api.fetchJSON.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    await render();
    await waitFor(() => q("ret4-loading") !== null, "skeleton");
    expect(q("ret4-sections")).toBeNull();
    expect(text()).not.toContain("180 天");
    await act(async () => {
      settle({ sections: [] });
      await Promise.resolve();
    });
    await waitFor(() => q("ret4-unwired-note") !== null, "unwired after settle");
  });
});

describe("?state= repro legs", () => {
  it("ready paints the four sections without a single request and marks the page", async () => {
    await render("/system?tab=retention&state=ready");
    await waitFor(() => q("ret4-sections") !== null, "sections");
    expect(calls()).toBe(0);
    expect(q("ret4-unwired-audit")).not.toBeNull();
  });

  it("denied paints one body with the repro id and never calls the service", async () => {
    await render("/system?tab=retention&state=denied");
    await waitFor(() => q("ret4-denied") !== null, "denied");
    expect(calls()).toBe(0);
    expect(q("ret4-denied-request-id")?.textContent).toContain("ret4-repro-rid");
  });
});