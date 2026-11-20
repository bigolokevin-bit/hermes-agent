// @vitest-environment jsdom
// R222 — 深链直开详情这一条路：地址里带着 detail=/id= 冷启动，页面直接开这条记录。
// 既有钉子（只回证据，不重复）：
//  · 直开不存在的 id：audit.deeplink.test.tsx（aud9 R113）「says 该事件不存在或已过期
//    with its own copyable rid, and keeps the list」；
//  · 点行打开/关闭的计数契约：audit.detail.requests.test.tsx（R196）「asks for the
//    record exactly once, and never asks the list again」「closing asks nothing…」；
//  · 直开保留其它筛选逐字节：audit.deeplink R113「keeps every other filter byte for
//    byte, and asks the service once」；
//  · ?detail= 拼写冷开：AuditEventsModulePage.test.tsx「the documented ?detail=
//    spelling opens the same record on a cold load」（只断 toContain，未断双腿计数）。
// 本文件的增量：冷启动直开的双腿计数恰好（列表腿 1 + 详情腿 1，不多问第二次）、
// ?id= 拼写的同等地位（产品读 detail ?? id，两条拼写都必须能冷开且 URL 不被改写）、
// 直开后关闭零新增请求且行集/筛选参数一字不动。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map(
    (node) => node.getAttribute("data-testid")?.replace("aud01-row-", "") ?? "",
  );
const address = (): string =>
  document.querySelector("[data-testid='probe-location']")?.textContent ?? "";
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
const RID = "req-20261119-0a7b3c";
const FROM = "2026-11-05T02:00:00Z";
const TO = "2026-11-19T02:00:00Z";
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
  requestId: RID,
};

function answerOk(): void {
  api.fetchJSON.mockImplementation(async (url) =>
    String(url).startsWith("/agent-api/api/audit-detail") ? { audit: RECORD } : { items: [RECORD] },
  );
}

beforeEach(() => {
  api.fetchJSON.mockReset();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R222 - a cold link that names the record opens it, counted", () => {
  it("the ?detail= spelling: list leg once, detail leg once, no second ask", async () => {
    answerOk();
    await render(`${BASE}&detail=${ID}`);
    await waitFor(
      () => document.querySelector("[data-testid='aud02-detail']") !== null,
      "detail painted from ?detail=",
    );
    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(1);
    expect(urls()).toContain(`/agent-api/api/audit-detail?id=${ID}`);
    // the record's own rid is on the surface (fields.parity R208 已锁四处同值，这里锁直开态在场)
    expect(document.body.textContent ?? "").toContain(RID);
  });

  it("closing a directly-opened record asks nothing more and moves nothing", async () => {
    answerOk();
    await render(`${BASE}&detail=${ID}`);
    await waitFor(
      () => document.querySelector("[data-testid='aud02-detail']") !== null,
      "detail painted from ?detail=",
    );
    const callsBefore = urls().length;
    const rowsBefore = paintedRows();

    await clickNode(document.querySelector("[data-testid='aud8-back-to-list']"), "the way back");
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") === null, "record closed");

    expect(urls().length).toBe(callsBefore); // 关闭一个问题都不问
    expect(paintedRows()).toEqual(rowsBefore); // 行集一字不动
    expect(pairs()).toEqual([`from=${FROM}`, `to=${TO}`, "window=custom"].sort()); // 筛选原样，detail 落下
  });
});

describe("R222 - the ?id= spelling carries the same weight", () => {
  it("cold-open via id=: paints once, address untouched, close drops only id=", async () => {
    answerOk();
    await render(`${BASE}&id=${ID}`);
    await waitFor(
      () => document.querySelector("[data-testid='aud02-detail']") !== null,
      "detail painted from ?id=",
    );
    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(1);
    // 产品读 detail ?? id：直开不改写地址，页面不自己再补一份 detail=
    expect(pairs()).toContain(`id=${ID}`);
    expect(pairs()).not.toContain(`detail=${ID}`);

    await clickNode(document.querySelector("[data-testid='aud8-back-to-list']"), "the way back");
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") === null, "record closed");
    expect(pairs()).not.toContain(`id=${ID}`);
    expect(detailReads()).toBe(1); // 关闭不再补问
  });
});
