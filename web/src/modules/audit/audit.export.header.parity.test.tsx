// @vitest-environment jsdom
// R262 — 审计导出列头与表体的双口径一致性。
//
// 已覆盖、这里不重写（只回证据）：
// - `audit.export.columns.test.tsx:269/:283`（R205 例①）钉住了列头逐字
//   `CSV_HEADER.join(",")` 与【每条记录恰好六列】——含缺值行不塌列的口径本体；
// - `audit.export.escape.test.tsx:5/:100`（R192）钉住了列头逐字、每行六列、
//   以及【列序与屏上表头顺序的一一对应】；
// - 空集导出 disabled+title 与 `URL.createObjectURL` 未调用：
//   `audit.export.columns.test.tsx` 例⑤、`audit.export.dims.test.tsx:356`（R248③）；
// - 「导出这一击不发任何请求」的账本形制：`audit.detail.copy.open.test.tsx`（R240）
//   与 `audit.actor.copy.test.tsx`（R235②）各自钉过 urls 逐字不变。
//
// 本文件只补真正没钉过的一枚拼接：一次【成功的】导出恰建一枚 Blob——
// 既有钉子全部是 0（空态/禁用），「恰调用一次」从未被钉；且在同一口气里核
// 两次导出击的 fetchJSON 账本逐字不动（零额外请求当场复跑）。缺值行不塌列
// 一腿以现场记录补强（列头/列数归件如上，这里只钉缺值行本身仍在、六列齐）。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { CSV_HEADER } from "@/modules/audit/csv";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTOR = "user:2f3a4b5c6d7e8f90";
const ACTION = "task.created";
const RESOURCE = "ap_1122334455667788";

const ROW_ONE = "evt_r262_first_000001";
const ROW_TWO = "evt_r262_second_00000";
const ROW_THIRD = "evt_r262_third_000001";

interface Row {
  eventId: string;
  action: string;
  occurredAt: string;
  outcome: string;
  actor: { type?: string; id?: string; displayName?: string };
  resource: { type?: string; id?: string };
  requestId: string | null;
}

function rowOf(eventId: string, occurredAt: string): Row {
  return {
    eventId,
    action: ACTION,
    occurredAt,
    outcome: "succeeded",
    actor: { type: "human", id: ACTOR, displayName: "李思" },
    resource: { type: "approval", id: RESOURCE },
    requestId: `req-${eventId}`,
  };
}

const FIRST = rowOf(ROW_ONE, "2026-11-19T01:20:00Z");
const SECOND = rowOf(ROW_TWO, "2026-11-19T01:21:00Z");
// 缺值行：requestId 为 null ⇒ CSV 请求编号一格里是真空字符串，但列数不塌。
const THIRD: Row = {
  eventId: ROW_THIRD,
  action: ACTION,
  occurredAt: "2026-11-19T01:22:00Z",
  outcome: "succeeded",
  actor: { type: "human", id: ACTOR, displayName: "李思" },
  resource: { type: "approval" },
  requestId: null,
};
const ALL = [FIRST, SECOND, THIRD];

const BASE = "/audit?window=custom&from=2026-11-05T02:00:00Z&to=2026-11-19T02:00:00Z&limit=25";

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
      </MemoryRouter>,
    );
  });
  await waitFor(() => document.querySelector(".animate-pulse") === null, "skeleton gone");
}

function node(testId: string): Element | null {
  return document.querySelector(`[data-testid='${testId}']`);
}

function textOf(testId: string): string {
  return node(testId)?.textContent?.trim() ?? "";
}

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number =>
  urls().filter((url) => url.startsWith("/agent-api/api/audit?")).length;

const paintedRows = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((element) =>
    String(element.getAttribute("data-testid")).replace("aud01-row-", ""),
  );

function shownCount(): number {
  const digits = /(\d+)/.exec(textOf("aud01-status"));
  return digits ? Number(digits[1]) : -1;
}

async function clickNodeSync(testId: string, label: string): Promise<void> {
  const target = node(testId);
  expect(target, label).not.toBeNull();
  await act(async () => {
    (target as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

// ── 文件怎么到手：Blob 计数是本波的主角 ────────────────────────────────────
const blobs = new Map<string, Blob>();
const made = { urls: 0 };
const captured = { name: "", text: "" };

function watchDownloads(): void {
  blobs.clear();
  made.urls = 0;
  captured.name = "";
  captured.text = "";
  URL.createObjectURL = ((blob: Blob) => {
    made.urls += 1;
    const url = `blob:r262-${blobs.size + 1}`;
    blobs.set(url, blob);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (!this.download) return;
    captured.name = this.download;
    const blob = blobs.get(this.href);
    if (blob) void blob.text().then((text) => (captured.text = text));
  });
}

/** RFC4180 回解析：带引号的字段里可以有一逗号和翻倍的双引号。 */
function parseRecord(line: string): string[] {
  const cells: string[] = [];
  let index = 0;
  while (index <= line.length) {
    if (line[index] === '"') {
      let value = "";
      index += 1;
      while (index < line.length) {
        if (line[index] === '"') {
          if (line[index + 1] === '"') {
            value += '"';
            index += 2;
            continue;
          }
          index += 1;
          break;
        }
        value += line[index];
        index += 1;
      }
      cells.push(value);
      if (line[index] === ",") index += 1;
      continue;
    }
    const next = line.indexOf(",", index);
    if (next === -1) {
      cells.push(line.slice(index));
      break;
    }
    cells.push(line.slice(index, next));
    index = next + 1;
  }
  return cells;
}

function dataLines(): string[] {
  return captured.text
    .replace(/^\\uFEFF/, "")
    .split("\r\n")
    .filter((line) => line !== "")
    .slice(1);
}

async function exportRecords(): Promise<string[][]> {
  captured.text = "";
  await clickNodeSync("aud01-export", "aud01-export");
  await waitFor(() => captured.text !== "", "the export was handed over");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return dataLines().map(parseRecord);
}

const COL_RID = CSV_HEADER.indexOf("请求编号");

function answer(): void {
  api.fetchJSON.mockImplementation(async (url) => {
    const target = String(url);
    if (target.startsWith("/agent-api/api/audit-detail")) {
      const id = new URL(target, "http://console.test").searchParams.get("id");
      return { audit: ALL.find((row) => row.eventId === id) ?? ALL[0] };
    }
    return { items: ALL, nextCursor: null };
  });
}

beforeEach(() => {
  api.fetchJSON.mockReset();
  answer();
  watchDownloads();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("R262 - a successful export builds exactly one file and asks nothing", () => {
  it("hands over one blob per export, with the ledger frozen and the sparse row intact", async () => {
    await render(BASE);
    expect(listReads()).toBe(1);
    expect(paintedRows()).toEqual([ROW_ONE, ROW_TWO, ROW_THIRD]);

    // 第一次导出：恰建一枚 Blob，账本纹丝不动（列头/每行六列本体归 R205/R192，
    // 这里只核【这一击】的当场现状）。
    const ledger = urls();
    const asks = listReads();
    const records = await exportRecords();
    expect(made.urls).toBe(1);
    expect(urls()).toEqual(ledger);
    expect(listReads()).toBe(asks);
    expect(records).toHaveLength(paintedRows().length);
    expect(shownCount()).toBe(records.length);

    // 缺值行不塌列（现场补强；口径本体归 R205①/R192）：第三行的请求编号是真空串，
    // 但六列齐、行没丢。
    const sparse = records.find((cells) => cells[COL_RID] === "");
    expect(sparse, "the row without a request id is still in the file").toBeDefined();
    for (const cells of records) expect(cells).toHaveLength(CSV_HEADER.length);

    // 第二次导出：再建一枚（计数从 0 起算的这一次击 = 恰一次），列表零重取。
    made.urls = 0;
    captured.text = "";
    const before = urls();
    const second = await exportRecords();
    expect(made.urls).toBe(1);
    expect(urls()).toEqual(before);
    expect(second).toEqual(records);
  });

  it("keeps the export door shut on an empty answer", async () => {
    // 空集一腿本体归 R205⑤/R248③——这里只按工单③的现场复跑最小形：
    // 服务空答 ⇒ 两枚导出 disabled+title、不建 Blob。
    api.fetchJSON.mockImplementation(async () => ({ items: [], nextCursor: null }));
    await render("/audit?window=custom&from=2026-11-05T02:00:00Z&to=2026-11-05T02:30:00Z&limit=25");
    expect(paintedRows()).toEqual([]);
    const csv = node("aud01-export") as HTMLButtonElement | null;
    const filtered = node("aud5-export") as HTMLButtonElement | null;
    expect(csv?.disabled).toBe(true);
    expect(csv?.getAttribute("title")).toBe("当前筛选没有可导出的记录");
    expect(filtered?.disabled).toBe(true);
    expect(filtered?.getAttribute("title")).toBe("当前筛选无事件可导出");
    await clickNodeSync("aud01-export", "aud01-export on an empty set");
    await clickNodeSync("aud5-export", "aud5-export on an empty set");
    expect(made.urls).toBe(0);
    expect(captured.text).toBe("");
  });
});
