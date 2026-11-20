// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { CSV_HEADER, csvText, downloadCsv, exportName } from "./csv";
import type { AuditRow } from "./model";

/**
 * A minimal row in the shape the model hands the surface. `kind`/`tone` are
 * string unions in the module, so they are widened here rather than guessed.
 */
function row(over: Partial<AuditRow> = {}): AuditRow {
  return {
    key: "k1",
    rawId: "evt_1",
    action: { label: "审批通过", raw: "approval.approved", known: true },
    outcome: { label: "成功", kind: "success" as never, tone: "success" as never, raw: "succeeded" },
    actor: { label: "李思 · 6d7e8f90", raw: "user:2f3a4b5c6d7e8f90", kind: "human", kindLabel: "成员" },
    resource: { label: "审批单 · 55667788", raw: "ap_1122334455667788" },
    occurredAt: "2026-11-19 09:20",
    recordedAt: "2026-11-19 09:21",
    requestId: null,
    correlation: null,
    reason: null,
    ...over,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the audit CSV (R34)", () => {
  it("names the six Chinese columns the page shows", () => {
    expect([...CSV_HEADER]).toEqual(["时间", "类型", "结果", "操作者", "对象", "请求编号"]);
  });

  it("writes a BOM, the header, and one line per row with blanks for what the service did not send", () => {
    const text = csvText([row(), row({ key: "k2", occurredAt: null, requestId: "req-20261119-0a7b3c" })]);

    expect(text.startsWith("\uFEFF")).toBe(true);
    const lines = text.replace(/^\uFEFF/, "").split("\r\n");
    expect(lines[0]).toBe("时间,类型,结果,操作者,对象,请求编号");
    expect(lines[1]).toBe("2026-11-19 09:20,审批通过,成功,李思 · 6d7e8f90,审批单 · 55667788,");
    expect(lines[2]).toBe(",审批通过,成功,李思 · 6d7e8f90,审批单 · 55667788,req-20261119-0a7b3c");
    // a missing value is an empty cell — never a zero that reads as data.
    expect(text).not.toContain(",0,");
    expect(text).not.toContain("0.00");
  });

  it("quotes a cell that carries a comma or a quote", () => {
    const text = csvText([row({ actor: { label: "李思, 复核人", raw: null, kind: null, kindLabel: null } })]);
    expect(text).toContain('"李思, 复核人"');
  });

  it("names the file after the window and the Beijing minute", () => {
    expect(exportName("最近 7 天", new Date("2026-11-19T17:05:00Z"))).toBe("audit-最近7天-20261120-0105.csv");
    expect(exportName("自定义", new Date("2026-11-19T01:00:00Z"))).toBe("audit-自定义-20261119-0900.csv");
    expect(exportName("", new Date("2026-11-19T01:00:00Z"))).toBe("audit-审计事件-20261119-0900.csv");
  });

  it("hands the file to the browser and releases the object URL", () => {
    const make = vi.fn(() => "blob:audit-r34");
    const revoke = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const realCreate = URL.createObjectURL;
    const realRevoke = URL.revokeObjectURL;
    URL.createObjectURL = make as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revoke as unknown as typeof URL.revokeObjectURL;
    try {
      downloadCsv([row()], "audit-最近7天-20261120-0105.csv");
      expect(make).toHaveBeenCalledTimes(1);
      expect(click).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledWith("blob:audit-r34");
      // the anchor is removed again, so nothing lingers in the document
      expect(document.querySelector("a[download]")).toBeNull();
    } finally {
      URL.createObjectURL = realCreate;
      URL.revokeObjectURL = realRevoke;
    }
  });
});
describe("the filtered export (R43)", () => {
  it("writes the five English keys and one line per row", () => {
    const rows = [row({ requestId: "req-1" }), row({ occurredAt: null, requestId: null })];
    const text = filteredCsvText(rows);
    const lines = text.replace(/^\uFEFF/, "").trimEnd().split("\r\n");
    expect(lines[0]).toBe("time,actor,action,resource,rid");
    expect(lines.length).toBe(rows.length + 1);
  });

  it("quotes a field with a comma and a quote, RFC 4180 style", () => {
    const base = row({});
    const text = filteredCsvText([{ ...base, actor: { ...base.actor, label: 'Li, "A"' } }]);
    expect(text).toContain('"Li, ""A"""');
  });

  it("names the file after the window and the Beijing minute, ASCII only", () => {
    const name = filteredExportName("7d", "all", "all", new Date("2026-11-19T22:47:00Z"));
    expect(name).toBe("audit-7d-all-all-20261120-0647.csv");
    expect(name).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});

import { filteredCsvText, filteredExportName, filterSnapshotExportName } from "./csv";

/**
 * audI — 文件名带当前筛选快照（时间窗/actor/资源/动作/条数），非法字符折叠，
 * BJT 到分；旧的三 token 拼法不变（既有断言仍成立）。
 */
describe("audI - the export name carries the whole filter snapshot", () => {
  const NOW = new Date("2026-11-19T22:47:00Z"); // 北京时间 2026-11-20 06:47

  it("adds the action type and the row count, in order, before the stamp", () => {
    expect(
      filterSnapshotExportName(
        { window: "7d", actor: "all", resource: "all", action: "task.created", rows: 25 },
        NOW,
      ),
    ).toBe("audit-7d-all-all-task-created-n25-20261120-0647.csv");
  });

  it("keeps the three-token shape when nothing else was chosen", () => {
    expect(filterSnapshotExportName({ window: "7d", actor: "all", resource: "all", rows: 2 }, NOW)).toBe(
      "audit-7d-all-all-all-n2-20261120-0647.csv",
    );
    // the older spelling is still exactly what it was
    expect(filteredExportName("7d", "all", "all", NOW)).toBe("audit-7d-all-all-20261120-0647.csv");
  });

  it("folds anything that is not a file-name character, including a full width space", () => {
    const name = filterSnapshotExportName(
      { window: "custom", actor: "employee api/张三", resource: "ap_1 22", action: "预算.流水 记一笔", rows: 7 },
      NOW,
    );
    // every non [A-Za-z0-9_-] run collapses to one `-`, edges trimmed
    expect(name).toBe("audit-custom-employee-api-ap_1-22-x-n7-20261120-0647.csv");
    expect(name).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(name).not.toMatch(/--/);
    // a value that folds to nothing is marked, never renamed into 「all」
    expect(filterSnapshotExportName({ window: "7d", actor: "张三", resource: "all", action: "all", rows: 1 }, NOW)).toBe(
      "audit-7d-x-all-all-n1-20261120-0647.csv",
    );
  });

  it("writes the Beijing minute, not the browser's clock", () => {
    const name = filterSnapshotExportName({ window: "24h", actor: "all", resource: "all", action: "all", rows: 0 }, NOW);
    expect(name.endsWith("-20261120-0647.csv")).toBe(true);
    expect(name).toContain("n0-");
  });
});
