/**
 * audC — 结论行的构造：固定字段序、固定缺失词、两处（行内预览与详情）同一
 * 事件必须逐字符相同。缺字段写「该字段未返回」，不编造、不留空、不补 0。
 */
import { describe, expect, it } from "vitest";

import type { AuditDetail, AuditRow } from "./model";
import { SUMMARY_MISSING, summaryFromDetail, summaryFromRow, summaryLineOf } from "./summary";

const PARTS = {
  occurredAt: "2026-11-19 09:20",
  actorLabel: "李思 · 6d7e8f90",
  actionLabel: "批准审批",
  resourceLabel: "审批单 · 55667788",
  requestId: "req-20261119-0a7b3c",
};

const rowLike = {
  occurredAt: PARTS.occurredAt,
  occurredAtRaw: "2026-11-19T01:20:00Z",
  actor: { label: PARTS.actorLabel },
  action: { label: PARTS.actionLabel },
  resource: { label: PARTS.resourceLabel },
  requestId: PARTS.requestId,
};

const detailLike = {
  occurredAt: PARTS.occurredAt,
  occurredAtRaw: "2026-11-19T01:20:00Z",
  actor: { label: PARTS.actorLabel },
  action: { label: PARTS.actionLabel },
  resource: { label: PARTS.resourceLabel },
  requestId: PARTS.requestId,
};

describe("audC - the summary line is one contract", () => {
  it("keeps the fixed order 时间 · 操作者 · 动作 · 资源 · 请求编号", () => {
    const line = summaryLineOf({ occurredAtRaw: null, ...PARTS }, "2026-11-19 09:20:00");
    expect(line).toBe("2026-11-19 09:20:00 · 李思 · 6d7e8f90 · 批准审批 · 审批单 · 55667788 · req-20261119-0a7b3c");
    // the seats are fixed even though a human label carries its own 「 · 」
    expect(line.startsWith("2026-11-19 09:20:00 · ")).toBe(true);
    expect(line.endsWith(" · req-20261119-0a7b3c")).toBe(true);
    const seats = ["2026-11-19 09:20:00", "李思", "批准审批", "审批单", "req-20261119-0a7b3c"].map(
      (value) => line.indexOf(value),
    );
    expect(seats.every((index) => index >= 0)).toBe(true);
    expect([...seats].sort((a, b) => a - b)).toEqual(seats);
  });

  it("says 该字段未返回 for what the service did not send, in the field's own seat", () => {
    const noRid = summaryLineOf({ occurredAtRaw: null, ...PARTS, requestId: null }, "2026-11-19 09:20:00");
    expect(noRid.endsWith(`· ${SUMMARY_MISSING}`)).toBe(true);
    const noTime = summaryLineOf({ occurredAtRaw: null, ...PARTS, occurredAt: null }, null);
    expect(noTime.startsWith(`${SUMMARY_MISSING} · `)).toBe(true);
    const blankActor = summaryLineOf({ occurredAtRaw: null, ...PARTS, actorLabel: "  " }, "2026-11-19 09:20:00");
    expect(blankActor).toContain(`${SUMMARY_MISSING}`);
    expect(noRid).not.toMatch(/· ·|·\s*$|undefined|null/);
  });

  it("the row leg and the detail leg build the identical line for one event", () => {
    const seconds = "2026-11-19 09:20:00";
    expect(summaryFromRow(rowLike as unknown as AuditRow, seconds)).toBe(
      summaryFromDetail(detailLike as unknown as AuditDetail, seconds),
    );
  });

  it("the same two legs stay identical when fields are missing in both", () => {
    const sparse = {
      occurredAt: null,
      occurredAtRaw: null,
      actor: { label: "未指派" },
      action: { label: "dispatch.event" },
      resource: { label: "—" },
      requestId: null,
    };
    expect(summaryFromRow(sparse as unknown as AuditRow, null)).toBe(
      summaryFromDetail(sparse as unknown as AuditDetail, null),
    );
    const line = summaryFromRow(sparse as unknown as AuditRow, null);
    expect(line).toBe(`${SUMMARY_MISSING} · 未指派 · dispatch.event · — · ${SUMMARY_MISSING}`);
  });
});
