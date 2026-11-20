// @vitest-environment jsdom
// R113 — `?event=` 深链的异常腿与保参护栏（纯测试，不改产品行为）。
// 定位到本页的行：不开第二套地址、不再问一次服务；
// 定位不到的行：说「该事件不存在或已过期」+ 可复制 rid，筛选与列表一个字都不掉；
// 关闭定位：只删 `event`，不新增请求；
// 详情返回列表：只清详情键，时间窗、筛选、页码游标与定位都留在原处。
// 已有的同类钉子（:1450 / :2416 / :4464 / :1172 / :1315）这里不重复，只补地址保真与请求计数这一段。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

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

/** Where the page put the address, so the guards can compare it pair for pair. */
function LocationProbe(): ReactNode {
  const location = useLocation();
  return <span data-testid="probe-location">{`${location.pathname}${location.search}`}</span>;
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
    root?.render(
      <MemoryRouter initialEntries={[entry]}>
        <AuditEventsModulePage />
        <LocationProbe />
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), "skeleton gone");
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const detailReads = (): number => urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;

const ID = "evt_present_00000001";
const GONE = "evt_gone_000000000000";
const FILTERS = [
  "window=30d",
  "type=task.created",
  "actor=user%3A2f3a4b5c6d7e8f90",
  "resource=ap_1122334455667788",
  "limit=25",
];

const COMPLETE = {
  eventId: ID,
  action: "task.created",
  occurredAt: "2026-11-19T01:20:00Z",
  recordedAt: "2026-11-19T01:20:01Z",
  outcome: "succeeded",
  actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
  resource: { type: "approval", id: "ap_1122334455667788" },
  requestId: "req-20261119-0a7b3c",
};

/** The address as the page now holds it, as a sorted set of `key=value` pairs. */
function pairs(search = window.location.search): string[] {
  const text = document.querySelector("[data-testid='probe-location']")?.textContent ?? search;
  const query = text.includes("?") ? text.slice(text.indexOf("?") + 1) : "";
  return [...new URLSearchParams(query)].map(([key, value]) => `${key}=${value}`).sort();
}

function answerListWith(body: unknown): void {
  api.fetchJSON.mockImplementation(async (url) =>
    String(url).startsWith("/agent-api/api/audit-detail") ? { audit: body } : { items: [body] },
  );
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  // jsdom only exposes navigator.clipboard in a secure context.
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("aud9 R113 - a deep link that lands on this page", () => {
  it("locates and opens the row without writing a second address key", async () => {
    answerListWith(COMPLETE);
    await render(`/audit?${FILTERS.join("&")}&event=${ID}`);
    // the honest sentence for a row that is right here
    expect(document.querySelector("[data-testid='aud9-deeplink-found']")?.textContent).toContain(
      "已按链接定位到这条事件并展开",
    );
    // …and the fold really opened, from `event=` alone
    expect(document.querySelector(`[data-testid='aud6-preview-${ID}']`)).not.toBeNull();
    expect(document.querySelector(`[data-testid='aud01-row-${ID}']`)).not.toBeNull();
  });

  it("keeps every other filter byte for byte, and asks the service once", async () => {
    answerListWith(COMPLETE);
    const before = [
      ["actor", "user:2f3a4b5c6d7e8f90"],
      ["event", ID],
      ["limit", "25"],
      ["resource", "ap_1122334455667788"],
      ["type", "task.created"],
      ["window", "30d"],
    ].map(([key, value]) => `${key}=${value}`).sort();
    await render(`/audit?${FILTERS.join("&")}&event=${ID}`);
    expect(pairs()).toEqual(before);
    // a located row needs no existence check: the list read is the only request
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(0);
  });

  it("收起定位 drops only the deep link and costs no new request", async () => {
    answerListWith(COMPLETE);
    await render(`/audit?${FILTERS.join("&")}&event=${ID}`);
    const before = urls();
    const close = document.querySelector<HTMLButtonElement>("[data-testid='aud9-deeplink-close']");
    await act(async () => {
      close?.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud9-deeplink-found']") === null, "定位 dropped");
    const kept = before.slice();
    // every filter is still in the address, and only `event` is gone
    expect(pairs()).toEqual(FILTERS.map((pair) => decodeURIComponent(pair)).sort());
    expect(pairs().join("&")).not.toContain("event=");
    expect(urls()).toEqual(kept);
    expect(listReads()).toBe(1);
  });
});

describe("aud9 R113 - a deep link the service cannot answer", () => {
  it("says 该事件不存在或已过期 with its own copyable rid, and keeps the list", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) => {
      if (String(url).startsWith("/agent-api/api/audit-detail")) {
        throw new ApiError("gone", {
          status: 403,
          body: '{"code":"console.forbidden"}',
          url: String(url),
          requestId: "rid-aud9-deeplink",
        });
      }
      return { items: [COMPLETE] };
    });
    await render(`/audit?${FILTERS.join("&")}&event=${GONE}`);
    const panel = document.querySelector("[data-testid='aud9-event-missing']");
    expect(panel?.textContent).toContain("该事件不存在或已过期");
    // the rid is on the surface and copyable, because that is what a person reports
    expect(panel?.textContent).toContain("rid-aud9-deeplink");
    const clip: { calls: string[] } = { calls: [] };
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => void clip.calls.push(text) },
    });
    const copy = document.querySelector<HTMLButtonElement>("[data-testid='aud9-event-rid'] button");
    expect(copy).not.toBeNull();
    await act(async () => {
      copy?.click();
    });
    await waitFor(() => clip.calls.length === 1, "rid copied");
    expect(clip.calls[0]).toContain("rid-aud9-deeplink");
    // and the ledger behind the link is still the ledger it was
    expect(document.querySelector(`[data-testid='aud01-row-${ID}']`)).not.toBeNull();
    expect(document.querySelector("[data-testid='aud01-empty']")).toBeNull();
    expect(pairs()).toEqual(
      [...FILTERS.map((pair) => decodeURIComponent(pair)), `event=${GONE}`]
        .map((pair) => pair.split("=").slice(0, 2))
        .map(([key, value]) => `${key}=${value}`)
        .sort(),
    );
  });

  it("清除定位 drops only the deep link, keeps every filter, and asks for nothing", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) => {
      if (String(url).startsWith("/agent-api/api/audit-detail")) {
        throw new ApiError("gone", {
          status: 404,
          body: '{"code":"console.not_found"}',
          url: String(url),
          requestId: "rid-aud9-404",
        });
      }
      return { items: [COMPLETE] };
    });
    await render(`/audit?${FILTERS.join("&")}&event=${GONE}`);
    await waitFor(() => document.querySelector("[data-testid='aud9-event-missing']") !== null, "missing said");
    const before = urls();
    const clear = document.querySelector<HTMLButtonElement>(
      "[data-testid='aud9-event-missing'] button",
    );
    // 再确认一次 is the first button, 清除定位 the second — pick it by its words
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("[data-testid='aud9-event-missing'] button"),
    );
    const clearButton =
      buttons.find((button) => button.textContent?.includes("清除定位")) ?? clear ?? undefined;
    await act(async () => {
      clearButton?.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud9-event-missing']") === null, "定位 cleared");
    expect(pairs()).toEqual(FILTERS.map((pair) => decodeURIComponent(pair)).sort());
    expect(urls()).toEqual(before);
    // a refusal is still a refusal: the row list never re-read because the link broke
    expect(listReads()).toBe(1);
  });
});

describe("aud9 R113 - the record pane and the way back", () => {
  it("返回列表 clears only the record keys, and the page, filters and 定位 stay", async () => {
    answerListWith(COMPLETE);
    await render(
      `/audit?${FILTERS.join("&")}&cursor=cur_page1&cursor=cur_page2&event=${ID}&detail=${ID}`,
    );
    // the record is open…
    expect(document.querySelector("[data-testid='aud02-detail']")).not.toBeNull();
    // …the page it came from is still page 3
    expect(document.querySelector("[data-testid='aud2-page']")?.textContent).toContain("第 3 页");
    expect(document.querySelector("[data-testid='aud9-deeplink-found']")).not.toBeNull();
    const back = document.querySelector<HTMLButtonElement>("[data-testid='aud8-back-to-list']");
    expect(back).not.toBeNull();
    await act(async () => {
      back?.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") === null, "record closed");
    const kept = [
      ...FILTERS.map((pair) => decodeURIComponent(pair)),
      "cursor=cur_page1",
      "cursor=cur_page2",
      `event=${ID}`,
    ].sort();
    expect(pairs()).toEqual(kept);
    expect(document.querySelector("[data-testid='aud2-page']")?.textContent).toContain("第 3 页");
    // walking back re-reads nothing: the record was asked once for the address
    // that named it, and the list was asked once and never again
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(1);
  });
});
