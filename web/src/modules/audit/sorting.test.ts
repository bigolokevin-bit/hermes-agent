/**
 * audN — 本地排序的口径。断言的是：三态循环与地址写法、缺值恒排末（升降都排末）、
 * 比较用的是屏上同一显示值（与 audJ 的 helper 同源），以及稳定次序（同值不抖）。
 */
import { describe, expect, it } from "vitest";

import type { AuditRow } from "./model";
import { SORT_COLUMNS, ariaSort, nextSort, sortReading, sortRows, sortStateFromParams } from "./sorting";

const row = (over: Partial<AuditRow> & { key: string }): AuditRow => ({
  key: over.key,
  rawId: over.rawId ?? over.key,
  action: (over.action ?? { label: "创建任务", raw: "task.created", known: true, tone: "info" }) as AuditRow["action"],
  outcome: (over.outcome ?? { label: "成功", raw: "succeeded", kind: "success", tone: "success" }) as AuditRow["outcome"],
  actor: over.actor ?? { label: "未指派", raw: null, kind: null, kindLabel: null },
  resource: over.resource ?? { label: "—", raw: null },
  occurredAt: over.occurredAt ?? null,
  occurredAtRaw: over.occurredAtRaw ?? null,
  recordedAt: null,
  requestId: over.requestId ?? null,
  correlation: null,
  reason: null,
});

const ROWS = [
  row({ key: "r1", actor: { label: "李思 · 6d7e8f90", raw: "user:1", kind: null, kindLabel: null }, occurredAt: "2026-11-19 09:20", occurredAtRaw: "2026-11-19T01:20:00Z" }),
  row({ key: "r2", actor: { label: "员工 · 5b4a3f21", raw: "employee:2", kind: null, kindLabel: null }, occurredAt: "2026-11-18 08:00", occurredAtRaw: "2026-11-18T00:00:00Z" }),
  row({ key: "r3", actor: { label: "未指派", raw: null, kind: null, kindLabel: null } }),
  row({ key: "r4", actor: { label: "张珏 · a1b2c3d4", raw: "user:3", kind: null, kindLabel: null }, occurredAt: "2026-11-20 07:05", occurredAtRaw: "2026-11-19T23:05:00Z" }),
];

describe("audN - the local sort", () => {
  it("cycles asc → desc → cleared, per column", () => {
    const none = { column: null, direction: null } as const;
    expect(nextSort(none, "time")).toEqual({ column: "time", direction: "asc" });
    expect(nextSort({ column: "time", direction: "asc" }, "time")).toEqual({ column: "time", direction: "desc" });
    expect(nextSort({ column: "time", direction: "desc" }, "time")).toEqual({ column: null, direction: null });
    // another column starts over ascending
    expect(nextSort({ column: "time", direction: "desc" }, "actor")).toEqual({ column: "actor", direction: "asc" });
    expect(SORT_COLUMNS.map((item) => item.key)).toEqual(["time", "actor", "action", "resource"]);
  });

  it("reads only a complete pair from the address", () => {
    expect(sortStateFromParams(new URLSearchParams("asort=time&adir=asc"))).toEqual({ column: "time", direction: "asc" });
    expect(sortStateFromParams(new URLSearchParams("asort=actor&adir=desc"))).toEqual({ column: "actor", direction: "desc" });
    expect(sortStateFromParams(new URLSearchParams("asort=time"))).toEqual({ column: null, direction: null });
    expect(sortStateFromParams(new URLSearchParams("adir=asc"))).toEqual({ column: null, direction: null });
    expect(sortStateFromParams(new URLSearchParams("asort=salary&adir=asc"))).toEqual({ column: null, direction: null });
    expect(sortStateFromParams(new URLSearchParams("asort=time&adir=sideways"))).toEqual({ column: null, direction: null });
  });

  it("sorts by the words on the screen, and never moves an absent value to the top", () => {
    const asc = sortRows(ROWS, { column: "time", direction: "asc" });
    expect(asc.map((item) => item.key)).toEqual(["r2", "r1", "r4", "r3"]);
    const desc = sortRows(ROWS, { column: "time", direction: "desc" });
    expect(desc.map((item) => item.key)).toEqual(["r4", "r1", "r2", "r3"]);
    // r3 has no time: last in both directions, not treated as 0 or empty text
    expect(asc[asc.length - 1]!.key).toBe("r3");
    expect(desc[desc.length - 1]!.key).toBe("r3");
    const actorAsc = sortRows(ROWS, { column: "actor", direction: "asc" });
    expect(actorAsc[actorAsc.length - 1]!.key).toBe("r3");
    // a cleared sort returns the order the service gave, untouched
    expect(sortRows(ROWS, { column: null, direction: null }).map((item) => item.key)).toEqual(["r1", "r2", "r3", "r4"]);
  });

  it("is stable for ties and does not reorder the untouched set", () => {
    const tied = [
      row({ key: "t1", actor: { label: "同人 · 11111111", raw: "user:a", kind: null, kindLabel: null } }),
      row({ key: "t2", actor: { label: "同人 · 11111111", raw: "user:a", kind: null, kindLabel: null } }),
      row({ key: "t3", actor: { label: "同人 · 11111111", raw: "user:a", kind: null, kindLabel: null } }),
    ];
    expect(sortRows(tied, { column: "actor", direction: "asc" }).map((item) => item.key)).toEqual(["t1", "t2", "t3"]);
    expect(sortRows(tied, { column: "actor", direction: "desc" }).map((item) => item.key)).toEqual(["t1", "t2", "t3"]);
  });

  it("names the ARIA state and says what the order actually covers", () => {
    expect(ariaSort({ column: "time", direction: "asc" }, "time")).toBe("ascending");
    expect(ariaSort({ column: "time", direction: "desc" }, "time")).toBe("descending");
    expect(ariaSort({ column: "time", direction: "asc" }, "actor")).toBe("none");
    expect(ariaSort({ column: null, direction: null }, "actor")).toBe("none");
    const reading = sortReading({ column: "actor", direction: "asc" }, 40);
    expect(reading).toContain("只重排这一页已加载的 40 条");
    expect(reading).toContain("缺这个值的行恒排在最后");
    expect(sortReading({ column: null, direction: null }, 40)).toContain("服务给的回行顺序");
    // the words never carry a path or a status code onto the screen
    expect(reading).not.toMatch(/\/agent-api|console\.|\b40[134]\b/);
  });
});
