// @vitest-environment jsdom
// R137 — 列表行、详情面板、`aud-detail-copy` 文本三处同值护栏（纯测试）。
//
// 这个文件只问一件事：同一件事在三个面上是不是同一句话。
//  - actor 显示名 + 8 位短码、action 人话、时间（北京时间到秒）、resource「类型 · 短码」
//    在行上、详情里、复制出去的那一行上逐字相等（不是相似，是 toBe）。
//  - 服务没带回的字段，三处用同一个词；带回了类型没带回编号时，三处都是那声名词，
//    不是缺位句——「没编号」是一次真实的回答，不是空缺。
//  - correlation 在行与详情读的是同一个原值，屏面只给短码。
//  - 打开再返回列表，只多那一笔详情读，行序与筛选一个字都不动。
//
// 不重复的既有钉子：`audit.crosssurface.test.tsx`（三面时间与 rid、四态句族、请求计数）、
// `detailCopy.test.tsx`（复制件本身：文案、status、fallback、disabled）、
// `audit.filters.test.tsx`（地址回填与请求参）。这里新增的是 actor/action/resource
// 跨三面（含复制文本）的逐字相等、correlation 行↔详情同源，以及开→关后的行序与 chip 原样。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "@/modules/audit/AuditEventsModulePage";
import { auditCopyText } from "@/modules/audit/detailCopy";
import { auditDetailFrom, auditPageFrom, shortCode } from "@/modules/audit/model";

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
    if (root) act(() => root?.unmount());
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

const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const listReads = (): number => urls().filter((url) => /^\/agent-api\/api\/audit\?/.test(url)).length;
const detailReads = (): number => urls().filter((url) => url.startsWith("/agent-api/api/audit-detail")).length;

/** A Field prints its label and its value; only the value may be compared across faces. */
function fieldValue(testId: string): string | null {
  return document.querySelector(`[data-testid='${testId}'] dd`)?.textContent?.trim() ?? null;
}

/** The same reading the hidden parity probe carries. */
function markValue(mark: string): string | null {
  return document.querySelector(`[data-testid='${mark}']`)?.getAttribute("data-audj-value") ?? null;
}

function textOf(testId: string): string | null {
  return document.querySelector(`[data-testid='${testId}']`)?.textContent?.trim() ?? null;
}

/** The rows as the screen lays them out, in DOM order. */
const rowOrder = (): string[] =>
  Array.from(document.querySelectorAll("[data-testid^='aud01-row-']")).map((node) =>
    String(node.getAttribute("data-testid")),
  );

/** The live filter chips, with the × glyphs stripped so only words are compared. */
const chipRow = (): string | null =>
  document.querySelector("[data-testid='aud-filter-chips']")?.textContent?.replace("×", "").trim() ?? null;

const ID = "evt_present_00000001";
const ACTOR = "user:2f3a4b5c6d7e8f90";
const RESOURCE = "ap_1122334455667788";
const RID = "req-20261119-0a7b3c";
const CORRELATION = "cor-00112233445566";

/** The one event, as the service answers it. */
const RECORD = {
  eventId: ID,
  action: "task.created",
  occurredAt: "2026-11-19T01:20:00Z",
  recordedAt: "2026-11-19T01:20:01Z",
  outcome: "succeeded",
  actor: { type: "human", id: ACTOR, displayName: "李思" },
  resource: { type: "approval", id: RESOURCE },
  requestId: RID,
  correlationId: CORRELATION,
};

/** What every face is expected to print for that event. */
const TIME = "2026-11-19 09:20:00";
const WHO = "李思 · 6d7e8f90";
const ACTION = "创建任务";
const OBJECT = "审批单 · 55667788";
const CODE = "33445566";

function answer(body: Record<string, unknown> = RECORD): void {
  api.fetchJSON.mockImplementation(async (url) =>
    String(url).startsWith("/agent-api/api/audit-detail") ? { audit: body } : { items: [body], nextCursor: null },
  );
}

const clip: { calls: string[] } = { calls: [] };

beforeEach(() => {
  api.fetchJSON.mockReset();
  clip.calls = [];
  // jsdom only hands a page the clipboard in a secure context; without this the
  // copy would fall to the manual branch and the test would prove the wrong thing.
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void clip.calls.push(text) },
  });
});

afterEach(async () => {
  await act(async () => {
    if (root) act(() => root?.unmount());
  });
  root = null;
});

describe("R137 - the row, the record and the copied line", () => {
  it("say one actor, one action, one object, byte for byte", async () => {
    answer();
    await render(`/audit?window=7d&detail=${ID}`);
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "record painted");

    // The row's own cells.
    expect(fieldValue(`aud01-cell-${ID}-actor`)).toBe(WHO);
    expect(fieldValue(`aud01-cell-${ID}-object`)).toBe(OBJECT);
    expect(fieldValue(`aud01-cell-${ID}-time`)).toBe(TIME);
    expect(textOf(`aud01-cell-${ID}-type`)).toContain(ACTION);

    // The record pane, the same words.
    expect(fieldValue("audA-detail-actor")).toBe(WHO);
    expect(fieldValue("audA-detail-resource")).toBe(OBJECT);
    expect(fieldValue("audA-detail-time")).toBe(TIME);
    expect(textOf("audA-detail-type")).toContain(ACTION);

    // And face to face, not just against my own arithmetic.
    expect(fieldValue("audA-detail-actor")).toBe(fieldValue(`aud01-cell-${ID}-actor`));
    expect(fieldValue("audA-detail-resource")).toBe(fieldValue(`aud01-cell-${ID}-object`));
    expect(fieldValue("audA-detail-time")).toBe(fieldValue(`aud01-cell-${ID}-time`));
    expect(markValue(`audJ-time-list-${ID}`)).toBe(markValue("audJ-time-detail"));
  });

  it("copies the same three answers into one line, in the same spelling", async () => {
    answer();
    await render(`/audit?window=7d&detail=${ID}`);
    await waitFor(() => document.querySelector(`[data-testid='aud-detail-copy']`) !== null, "copy control");

    await act(async () => {
      document.querySelector<HTMLButtonElement>(`[data-testid='aud-detail-copy']`)?.click();
    });
    expect(clip.calls).toHaveLength(1);
    const line = clip.calls[0];

    // The line carries the faces' exact words, not a second reading of them.
    expect(line).toContain(TIME);
    expect(line).toContain(WHO);
    expect(line).toContain(ACTION);
    expect(line).toContain(OBJECT);
    expect(line).toContain(CODE);
    // What the row shows is what the line carries, in the order the fields are named.
    expect(fieldValue(`aud01-cell-${ID}-actor`)).toBe(WHO);
    const order = [TIME, WHO, ACTION, OBJECT, CODE].map((piece) => line.indexOf(piece));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // One helper, both faces: the same call over the same record gives the same string.
    expect(line).toBe(auditCopyText(auditDetailFrom({ audit: RECORD }) as never));
    expect(textOf("aud-detail-copy-status")).toBe("已复制");
  });

  it("keeps every machine handle off all three faces", async () => {
    answer();
    await render(`/audit?window=7d&detail=${ID}`);
    await waitFor(() => document.querySelector(`[data-testid='aud-detail-copy']`) !== null, "copy control");
    await act(async () => {
      document.querySelector<HTMLButtonElement>(`[data-testid='aud-detail-copy']`)?.click();
    });

    for (const raw of [ACTOR, RESOURCE, CORRELATION]) {
      expect(document.body.textContent ?? "").not.toContain(raw);
      expect(clip.calls[0]).not.toContain(raw);
    }
    // …and the short codes are there instead, on the faces and in the line.
    expect(textOf(`aud01-row-${ID}`)).toContain("6d7e8f90");
    expect(clip.calls[0]).toContain("6d7e8f90");
    expect(clip.calls[0]).toContain("55667788");
    expect(clip.calls[0]).toContain(CODE);
  });
});

describe("R137 - a field the service did not send", () => {
  it("reads the same missing word in all three places", async () => {
    answer({ ...RECORD, occurredAt: undefined, recordedAt: undefined } as Record<string, unknown>);
    await render(`/audit?window=7d&detail=${ID}`);
    await waitFor(() => document.querySelector(`[data-testid='aud-detail-copy']`) !== null, "copy control");
    await act(async () => {
      document.querySelector<HTMLButtonElement>(`[data-testid='aud-detail-copy']`)?.click();
    });

    expect(fieldValue(`aud01-cell-${ID}-time`)).toBe("该字段未返回");
    expect(fieldValue("audA-detail-time")).toBe("该字段未返回");
    expect(clip.calls[0].startsWith("该字段未返回 · ")).toBe(true);
    // nothing on any face is a clock the page made up
    expect(clip.calls[0]).not.toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });

  it("gives a type without a number the plain name, everywhere, and not a dash", async () => {
    // 「没带回编号」 is a real answer about this record, not an empty field.
    answer({ ...RECORD, resource: { type: "approval" } } as Record<string, unknown>);
    await render(`/audit?window=7d&detail=${ID}`);
    await waitFor(() => document.querySelector(`[data-testid='aud-detail-copy']`) !== null, "copy control");
    await act(async () => {
      document.querySelector<HTMLButtonElement>(`[data-testid='aud-detail-copy']`)?.click();
    });

    expect(fieldValue(`aud01-cell-${ID}-object`)).toBe("审批单");
    expect(fieldValue("audA-detail-resource")).toBe("审批单");
    expect(clip.calls[0]).toContain(" · 审批单 · ");
    expect(clip.calls[0]).not.toContain("—");
  });

  it("leaves an object with nothing at all the same dash in all three", async () => {
    answer({ ...RECORD, resource: undefined, correlationId: undefined } as Record<string, unknown>);
    await render(`/audit?window=7d&detail=${ID}`);
    await waitFor(() => document.querySelector(`[data-testid='aud-detail-copy']`) !== null, "copy control");
    await act(async () => {
      document.querySelector<HTMLButtonElement>(`[data-testid='aud-detail-copy']`)?.click();
    });

    expect(fieldValue(`aud01-cell-${ID}-object`)).toBe("—");
    expect(fieldValue("audA-detail-resource")).toBe("—");
    expect(clip.calls[0].endsWith(" · — · —")).toBe(true);
  });
});

describe("R137 - one correlation, two readings", () => {
  it("takes the same value from the page and from the record, and masks it the same way", () => {
    const page = auditPageFrom({ items: [RECORD], nextCursor: null });
    const row = page?.rows[0];
    const detail = auditDetailFrom({ audit: RECORD });

    // Both faces read the identical original out of the service's own answer.
    expect(row?.correlation).toBe(CORRELATION);
    expect(detail?.correlation).toBe(row?.correlation);
    // The screen shows the tail, never the handle — from the same masking rule.
    expect(shortCode(String(row?.correlation))).toBe(CODE);
    expect(shortCode(String(detail?.correlation))).toBe(CODE);
    expect(auditCopyText(detail as never).endsWith(` · ${CODE}`)).toBe(true);
    expect(auditCopyText(detail as never)).not.toContain(CORRELATION);
  });
});

describe("R137 - opening and closing the record", () => {
  it("costs one read and moves nothing else on the list", async () => {
    answer();
    await render("/audit?window=7d&type=task.created");
    const before = urls();
    const rowsBefore = rowOrder();
    const chipsBefore = chipRow();
    expect(listReads()).toBe(1);
    expect(detailReads()).toBe(0);
    // the chip row is there to be compared, so this walk proves something about it
    expect(chipsBefore).not.toBeNull();
    expect(chipsBefore).toContain("动作类型");

    const open = document.querySelector<HTMLButtonElement>(`[data-testid='aud01-cell-${ID}-type']`);
    await act(async () => {
      open?.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "record opened");
    const opened = urls();
    expect(detailReads()).toBe(1);
    expect(listReads()).toBe(1);

    const back = document.querySelector<HTMLButtonElement>("[data-testid='aud8-back-to-list']");
    await act(async () => {
      back?.click();
    });
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") === null, "record closed");

    // Closing asked for nothing new: only the one record read separates the two sets.
    expect(urls()).toEqual(opened);
    expect(urls().length).toBe(before.length + 1);
    expect(listReads()).toBe(1);
    // …and the list is exactly where it was: same rows, same order, same filters.
    expect(rowOrder()).toEqual(rowsBefore);
    expect(chipRow()).toBe(chipsBefore);
  });
});
