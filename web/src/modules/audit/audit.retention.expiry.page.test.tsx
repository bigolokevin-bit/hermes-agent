// @vitest-environment jsdom
// AU-03③ — 保留期联动的三态与过期窗本地拦，落在真实渲染的事件列表上。
// 断言的是屏上的话：保留天数没有读到就说未接入（不报任何天数、不拦任何窗口）；
// 读到了就报那个数；整段早于保留线的自定义区间在点「应用」时本地拦下，
// 不写进地址、不发请求。天数只从服务回答里取（auditRetentionDays），取不到不猜。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";

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
    root?.render(<MemoryRouter initialEntries={[entry]}><AuditEventsModulePage /></MemoryRouter>);
  });
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const text = (): string => document.body.textContent ?? "";

const ROW = { eventId: "evt_x1", action: "task.created", occurredAt: "2026-11-20T00:00:00Z", outcome: "succeeded" };

/** A list answer that states a retention horizon (the future-wired shape). */
function answerWithRetention(days: number | null): void {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async (url: string) => {
    if (url.startsWith("/agent-api/api/audit-detail")) return { audit: {} };
    const body: Record<string, unknown> = { events: [ROW], nextCursor: null, total: 1 };
    if (days !== null) body.auditRetentionDays = days;
    return body;
  });
}

const linkEl = (): HTMLElement | null => document.querySelector('[data-testid="aud03-retention-link"]');

describe("AU-03③ — the retention link, in three honest states", () => {
  afterEach(() => {
    act(() => root?.unmount());
    root = null;
  });

  it("no horizon answered → 未接入, no day count, no window blocked", async () => {
    answerWithRetention(null);
    await render("/system?tab=events");
    await waitFor(() => linkEl() !== null, "retention link");
    expect(linkEl()!.getAttribute("data-state")).toBe("unwired");
    expect(text()).toContain("保留期：未接入");
    // it never CLAIMS a retention period (the 「假 7 天」 in the negation is not
    // a claimed horizon, so match the claim shape only)
    expect(linkEl()!.textContent).not.toMatch(/保留 \d+ 天/);
    expect(linkEl()!.getAttribute("title")).toContain("GAP-13");
  });

  it("horizon answered → it reports THAT number, and a current window is 仍在期内", async () => {
    answerWithRetention(30);
    await render("/system?tab=events");
    await waitFor(() => linkEl() !== null, "retention link");
    expect(linkEl()!.getAttribute("data-state")).toBe("within");
    expect(linkEl()!.textContent).toContain("保留 30 天");
  });

  it("arriving on an entirely-expired custom range → says 超出保留期 with the real N", async () => {
    answerWithRetention(30);
    const from = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const to = new Date(Date.now() - 380 * 86_400_000).toISOString();
    await render(`/audit?window=custom&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    await waitFor(() => linkEl()?.getAttribute("data-state") === "expired", "expired link");
    expect(linkEl()!.textContent).toContain("该时间窗超出保留期（30 天）");
  });

  it("applying a draft entirely past the answered horizon is refused locally — not written to the address, not requested", async () => {
    answerWithRetention(30);
    await render("/audit?window=7d");
    await waitFor(() => linkEl() !== null, "retention link settled");
    const before = urls().length;

    // open the custom editor
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="aud01-filter-window-custom"]')!.click();
    });
    // type an expired Beijing range (≈ 400 days ago)
    const expiredFrom = new Date(Date.now() - 400 * 86_400_000);
    const expiredTo = new Date(Date.now() - 380 * 86_400_000);
    const localStamp = (d: Date): string => {
      const p = (n: number): string => String(n).padStart(2, "0");
      const bj = new Date(d.getTime() + 8 * 3_600_000);
      return `${bj.getUTCFullYear()}-${p(bj.getUTCMonth() + 1)}-${p(bj.getUTCDate())}T${p(bj.getUTCHours())}:${p(bj.getUTCMinutes())}`;
    };
    const fire = (id: string, value: string): void => {
      const input = document.getElementById(id)!;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    await act(async () => fire("aud01-custom-from", localStamp(expiredFrom)));
    await act(async () => fire("aud01-custom-to", localStamp(expiredTo)));
    // 应用 the expired range
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="audB-apply"]')!.click();
    });

    // refused: the block sentence is on screen, the address never carried it
    expect(text()).toContain("该时间窗超出保留期（30 天）");
    expect(document.querySelector('[data-testid="aud03-retention-block"]')).not.toBeNull();
    // and it asked nothing new for the dead window
    expect(urls()).toHaveLength(before);
    expect(urls().join(" ")).not.toMatch(/window=custom/);
  });

  it("with no horizon answered, applying a past range is NOT blocked (we do not guess a boundary)", async () => {
    answerWithRetention(null);
    await render("/audit?window=7d");
    await waitFor(() => linkEl() !== null, "retention link settled");
    const before = urls().length;
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="aud01-filter-window-custom"]')!.click();
    });
    const from = new Date(Date.now() - 400 * 86_400_000);
    const to = new Date(Date.now() - 380 * 86_400_000);
    const stamp = (d: Date): string => {
      const p = (n: number): string => String(n).padStart(2, "0");
      const bj = new Date(d.getTime() + 8 * 3_600_000);
      return `${bj.getUTCFullYear()}-${p(bj.getUTCMonth() + 1)}-${p(bj.getUTCDate())}T${p(bj.getUTCHours())}:${p(bj.getUTCMinutes())}`;
    };
    const fire = (id: string, value: string): void => {
      const input = document.getElementById(id)!;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    await act(async () => fire("aud01-custom-from", stamp(from)));
    await act(async () => fire("aud01-custom-to", stamp(to)));
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="audB-apply"]')!.click();
    });
    // no block, and the range WAS applied (a read was issued for it)
    expect(document.querySelector('[data-testid="aud03-retention-block"]')).toBeNull();
    expect(urls().length).toBeGreaterThan(before);
  });
});
