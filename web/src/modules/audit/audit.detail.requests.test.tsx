// @vitest-environment jsdom
// R196（改窄后）— 详情这一腿的请求契约，三件事各钉一次：打开它只多问一次记录、
// 关闭它一个问题都不问、它出错时列表那一条腿照旧站着。
// 为什么只有三条：详情同值的更大那张网（四处逐字相等）在派单十分钟内没收口，
// 已按指令改成这一步；同值类的既有钉子由 R137（三处屏上同值）、R153（时间四处）、
// R177（操作者四处）、R192（导出转义与列序）钉着，这里不重复。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";
import { selectValue } from "@/shell/selectHarness";

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
    if (root) act(() => root?.unmount());
  });
  root = null;
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
const textOf = (testId: string): string | null =>
  document.querySelector(`[data-testid='${testId}']`)?.textContent ?? null;
const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map(
    (node) => node.getAttribute("data-testid")?.replace("aud01-row-", "") ?? "",
  );
const address = (): string =>
  document.querySelector("[data-testid='probe-location']")?.textContent ?? "";
/** Decoded, sorted `key=value` pairs — repeated keys each appear, so a cursor stack shows. */
function pairs(): string[] {
  const query = address().split("?")[1] ?? "";
  return [...new URLSearchParams(query)].map(([key, value]) => `${key}=${value}`).sort();
}

async function clickNode(node: Element | null | undefined, label: string): Promise<void> {
  expect(node, label).not.toBeNull();
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

const ID = "evt_present_00000001";
const ACTOR = "user:2f3a4b5c6d7e8f90";
const RESOURCE = "ap_1122334455667788";
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";
/** A stated interval: a quick window recomputes its bounds from the clock at ask
 * time, so only an interval address is byte-comparable across mounts. */
const BASE = `/audit?window=custom&from=${FROM}&to=${TO}`;

interface Row {
  eventId: string;
  action: string;
  occurredAt: string | null;
  outcome: string;
  actor: Record<string, unknown>;
  resource: Record<string, unknown>;
  requestId: string | null;
}

const RECORD: Row = {
  eventId: ID,
  action: "task.created",
  occurredAt: "2026-11-19T01:20:00Z",
  outcome: "succeeded",
  actor: { type: "human", id: ACTOR, displayName: "李思" },
  resource: { type: "approval", id: RESOURCE },
  requestId: "req-20261119-0a7b3c",
};

function answerOk(): void {
  api.fetchJSON.mockImplementation(async (url) =>
    String(url).startsWith("/agent-api/api/audit-detail") ? { audit: RECORD } : { items: [RECORD] },
  );
}

const CLIP = { calls: [] as string[] };

function stubClipboard(): void {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void CLIP.calls.push(text) },
  });
}

/** The row's own way into the record: the action cell is the open control. */
async function openRecord(): Promise<void> {
  await clickNode(document.querySelector(`[data-testid='aud01-cell-${ID}-type']`), "the row's open control");
  await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "record painted");
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  CLIP.calls = [];
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R196 - the record's own read, counted", () => {
  it("asks for the record exactly once, and never asks the list again", async () => {
    answerOk();
    await render(BASE);
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(0);
    const before = urls();

    await openRecord();

    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(1);
    // The one new call is the record route, naming this event.
    const added = urls().filter((url) => !before.includes(url));
    expect(added).toHaveLength(1);
    expect(added[0]).toContain("/agent-api/api/audit-detail");
    expect(added[0]).toContain(ID);
    expect(pairs()).toContain(`detail=${ID}`);
  });

  it("closing asks nothing, leaves the list and the filters where they were", async () => {
    answerOk();
    await render(`${BASE}&type=task.created`);
    await waitFor(() => paintedRows().length === 1, "the row is on screen");
    const rowsBefore = paintedRows();
    const callsBefore = urls();

    await openRecord();
    await clickNode(document.querySelector("[data-testid='aud8-back-to-list']"), "the way back");
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") === null, "record closed");

    // Opening costed one read; closing costs nothing on top of it.
    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(1);
    expect(urls().length).toBe(callsBefore.length + 1);
    // The list did not move, and no filter was lost or quietly re-asked.
    expect(paintedRows()).toEqual(rowsBefore);
    expect(pairs()).toEqual([`from=${FROM}`, `to=${TO}`, "type=task.created", `window=custom`].sort());
    expect(pairs()).not.toContain(`detail=${ID}`);
    // The picker still holds the filter it was handed — the control kept its value
    // while the record key left, which is the whole claim about closing.
    expect(selectValue("aud01-filter-type")).toBe("task.created");
  });
});

describe("R196 - a record that will not load", () => {
  it("says so in words, hands over a copyable rid, and leaves the list standing", async () => {
    stubClipboard();
    api.fetchJSON.mockImplementation(async (url) => {
      const target = String(url);
      if (target.startsWith("/agent-api/api/audit-detail")) {
        throw new ApiError("down", {
          status: 500,
          body: '{"code":"console.unavailable","rid":"req-aud-detail"}',
          url: target,
          requestId: "req-aud-detail",
        });
      }
      return { items: [RECORD] };
    });
    await render(BASE);
    const rowsBefore = paintedRows();
    expect(rowsBefore).toEqual([ID]);

    await clickNode(document.querySelector(`[data-testid='aud01-cell-${ID}-type']`), "the row's open control");
    await waitFor(() => document.querySelector("[data-testid='aud02-detail-error']") !== null, "the failure painted");

    // A sentence a person can act on, not a spinner and not an empty panel.
    const panel = document.querySelector("[data-testid='aud02-detail-error']") as HTMLElement;
    expect(panel.textContent).toContain("这条事件没能加载出来");
    expect(textOf("aud02-detail-error-sentence")).toBeTruthy();
    // The rid travels — from the body the service actually sent, and copyable.
    const rid = document.querySelector("[data-testid='aud02-detail-error-request-id']");
    expect(rid?.textContent).toContain("req-aud-detail");
    await clickNode(rid?.querySelector("button"), "the rid's copy control");
    await waitFor(() => CLIP.calls.length > 0, "the rid was copied");
    expect(CLIP.calls[0]).toContain("req-aud-detail");
    // The list leg is untouched by its failure.
    expect(paintedRows()).toEqual(rowsBefore);
    expect(listReads()).toBe(1);

    // And 重试 is exactly one more read of the record, nothing else.
    const retry = Array.from(panel.querySelectorAll("button")).find((node) =>
      (node.textContent ?? "").includes("重试"),
    );
    await clickNode(retry ?? null, "the retry");
    await waitFor(() => detailReads() === 2, "the record was asked for again");
    expect(detailReads()).toBe(2);
    expect(listReads()).toBe(1);
    expect(urls().length).toBe(3);
  });
});
