// @vitest-environment jsdom
/**
 * audit-sort-p1（B2 表「排序本地降级 P1」收尾）——行级可判定形制。
 *
 * 表口径（docs/governance/parity/B2-audit.parity.md §2）：排序仅在已加载行内本地
 * 重排，服务端没有可用的排序参数 ⇒ P1。此前这条只在 `aud-sort-scope-note` 里用
 * 一句话披露，DOM 面上没有任何一行能自证它参与的是哪种顺序 ⇒ 判定形制＝每行带
 * `data-aud-sort-scope`（service-order / local-page）与 `data-aud-sort-position`
 * （屏上实序，1 起），且披露条数与实际参与重排的行数同源。
 *
 * 形制承 audit.sort.filter.test.tsx（同一 harness：createRoot + MemoryRouter +
 * 自写 waitFor，本仓无 @testing-library/react）。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { AuditEventsModulePage } from "./AuditEventsModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

const waitFor = async (cond: () => boolean, label: string): Promise<void> => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
};

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
      </MemoryRouter>,
    );
  });
  await waitFor(() => !document.querySelector(".animate-pulse"), "skeleton gone");
}

const rowsOrder = (): string[] =>
  [...document.querySelectorAll('[data-testid^="aud01-row-"]')].map((el) =>
    String(el.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

/** 行级探针（隐藏 span，与 audK 同一处）：scope 与 position。 */
const scopeOfRows = (): Array<{ key: string; scope: string | null; position: string | null }> =>
  [...document.querySelectorAll('[data-testid^="audK-row-"]')].map((el) => ({
    key: String(el.getAttribute("data-testid")).replace("audK-row-", ""),
    scope: el.getAttribute("data-aud-sort-scope"),
    position: el.getAttribute("data-aud-sort-position"),
  }));

const noteText = (): string =>
  document.querySelector('[data-testid="aud-sort-scope-note"]')?.textContent ?? "";

async function clickTestId(testid: string): Promise<void> {
  const node = document.querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;
  expect(node, testid).toBeTruthy();
  await act(async () => {
    node?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {});
}

const A = {
  eventId: "evt_aaa0000000000001",
  action: "task.created",
  occurredAt: "2026-11-19T01:20:00Z",
  recordedAt: "2026-11-19T01:20:01Z",
  outcome: "succeeded",
  actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" },
  resource: { type: "approval", id: "ap_1122334455667788" },
  requestId: "req-a-1",
};
const B = {
  eventId: "evt_bbb0000000000002",
  action: "approval.expired",
  occurredAt: "2026-11-19T03:40:00Z",
  recordedAt: "2026-11-19T03:40:01Z",
  outcome: "failed",
  actor: { type: "human", id: "user:9988776655443322", displayName: "王五" },
  resource: { type: "approval", id: "ap_9988776655443322" },
  requestId: "req-b-2",
};
const C = {
  eventId: "evt_ccc0000000000003",
  action: "login",
  // 故意缺 occurredAt —— 缺值行两向恒末。
  recordedAt: "2026-11-19T05:00:01Z",
  outcome: "succeeded",
  actor: { type: "human", id: "user:1010101010101010", displayName: "赵六" },
  resource: { type: "task", id: "tk_1010101010101010" },
  requestId: "req-c-3",
};
const SERVICE_ORDER = [A, B, C];
const KEYS = ["evt_aaa0000000000001", "evt_bbb0000000000002", "evt_ccc0000000000003"];

function answerRows(rows: unknown[]): void {
  api.fetchJSON.mockImplementation(async () => ({ items: rows }));
}

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

describe("audit-sort-p1：每行自证它参与的是哪种顺序", () => {
  it("无排序时每行标 service-order，position 与屏上实序逐位同源", async () => {
    answerRows(SERVICE_ORDER);
    await render("/audit");
    const rows = scopeOfRows();
    expect(rows.map((r) => r.key), "行集非空（空扫描面不算证据）").toEqual(KEYS);
    expect(rows.map((r) => r.scope)).toEqual(["service-order", "service-order", "service-order"]);
    expect(rows.map((r) => r.position)).toEqual(["1", "2", "3"]);
    expect(rows.map((r) => r.key)).toEqual(rowsOrder());
  });

  it("点列头后每行标 local-page，披露条数等于参与重排的行数", async () => {
    answerRows(SERVICE_ORDER);
    await render("/audit");
    await clickTestId("aud-sort-button-time"); // asc
    const rows = scopeOfRows();
    expect(rows.map((r) => r.scope), "本地重排必须逐行可判").toEqual(["local-page", "local-page", "local-page"]);
    expect(rows.map((r) => r.position)).toEqual(["1", "2", "3"]);
    expect(rows.map((r) => r.key)).toEqual(rowsOrder());
    expect(noteText(), "披露里的条数与实际参与行数同源").toContain(`${rows.length} 条`);
    // 升序：有值的在前，缺值恒末
    expect(rowsOrder()).toEqual(["evt_aaa0000000000001", "evt_bbb0000000000002", "evt_ccc0000000000003"]);
  });

  it("降序换向不换集合，行级 position 跟着屏上实序走", async () => {
    answerRows(SERVICE_ORDER);
    await render("/audit");
    await clickTestId("aud-sort-button-time");
    await clickTestId("aud-sort-button-time"); // desc
    const rows = scopeOfRows();
    expect([...rows.map((r) => r.key)].sort()).toEqual([...KEYS].sort());
    expect(rows.map((r) => r.scope)).toEqual(["local-page", "local-page", "local-page"]);
    expect(rows.map((r) => r.position)).toEqual(["1", "2", "3"]);
    expect(rows.map((r) => r.key)).toEqual(rowsOrder());
    expect(rowsOrder()).toEqual(["evt_bbb0000000000002", "evt_aaa0000000000001", "evt_ccc0000000000003"]);
  });

  it("第三次点击清除：回到服务回行序，行级 scope 同时改回 service-order", async () => {
    answerRows(SERVICE_ORDER);
    await render("/audit");
    await clickTestId("aud-sort-button-time");
    await clickTestId("aud-sort-button-time");
    await clickTestId("aud-sort-button-time"); // cleared
    expect(scopeOfRows().map((r) => r.scope)).toEqual(["service-order", "service-order", "service-order"]);
    expect(rowsOrder(), "清除后必须是服务给的那一个顺序，逐位相同").toEqual(KEYS);
  });
});
