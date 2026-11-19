// @vitest-environment node
// retention.ts 纯函数：分区归一、字段防御式读取、缺源分类、北京时间、字节口径与
// 「99.6% 不进位成 100%」的占用比例。这里不涉及渲染。

import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-error";

import {
  FIELD_REASON,
  GAP,
  PLANNED_ACTIONS,
  SECTIONS,
  UNWIRED_REASON,
  beijingMinute,
  codeOf,
  failureSentence,
  formatBytes,
  occupancyShare,
  probeOf,
  readRetention,
  sectionKeyOf,
  unwiredSections,
} from "./retention";

function apiError(status: number, body: string, requestId?: string): ApiError {
  return new ApiError("boom", { status, body, url: "/agent-api/api/retention", requestId });
}

describe("section names fold onto the four canonical areas", () => {
  it("accepts the spellings a service may use and rejects anything else", () => {
    expect(sectionKeyOf("audit_events")).toBe("audit");
    expect(sectionKeyOf("audit")).toBe("audit");
    expect(sectionKeyOf("events")).toBe("audit");
    expect(sectionKeyOf("runs")).toBe("runs");
    expect(sectionKeyOf("run_records")).toBe("runs");
    expect(sectionKeyOf("session-logs")).toBe("sessions");
    expect(sectionKeyOf("conversations")).toBe("sessions");
    expect(sectionKeyOf("uploads")).toBe("uploads");
    expect(sectionKeyOf("attachments")).toBe("uploads");
    expect(sectionKeyOf("billing")).toBeNull();
    expect(sectionKeyOf(null)).toBeNull();
    expect(sectionKeyOf(42)).toBeNull();
  });
});

describe("an answer is read defensively", () => {
  it("maps a full answer, keeps every number as given", () => {
    const answer = readRetention({
      sections: [
        {
          key: "audit",
          retentionDays: 180,
          lastCleanupAt: "2026-11-19T12:05:00Z",
          nextRunAt: "2026-11-20T01:00:00Z",
          usedBytes: "1536",
          limitBytes: 1048576,
        },
        { key: "runs", days: 30 },
      ],
      asOf: "2026-11-19T12:10:00Z",
    });
    expect(answer).not.toBeNull();
    const audit = answer!.sections.find((s) => s.key === "audit")!;
    expect(audit.unwired).toBe(false);
    expect(audit.days).toBe(180);
    expect(audit.lastCleanup).toBe("2026-11-19T12:05:00Z");
    expect(audit.usedBytes).toBe(1536);
    expect(audit.limitBytes).toBe(1048576);
    const runs = answer!.sections.find((s) => s.key === "runs")!;
    expect(runs.days).toBe(30);
    expect(runs.lastCleanup).toBeNull();
    expect(runs.unwired).toBe(false);
    // Areas the answer never mentioned are listed, but as 未接入 — a missing
    // area must not disappear and read as "nothing to retain".
    const sessions = answer!.sections.find((s) => s.key === "sessions")!;
    expect(sessions.unwired).toBe(true);
    expect(sessions.note).toContain("没有这一区");
    expect(answer!.answered).toEqual(["audit", "runs"]);
    expect(answer!.asOf).toBe("2026-11-19T12:10:00Z");
  });

  it("keeps a missing field absent instead of turning it into 0", () => {
    const answer = readRetention({ items: [{ section: "uploads" }] })!;
    const uploads = answer.sections.find((s) => s.key === "uploads")!;
    expect(uploads.days).toBeNull();
    expect(uploads.usedBytes).toBeNull();
    expect(uploads.limitBytes).toBeNull();
    expect(uploads.unwired).toBe(false);
  });

  it("calls a payload it cannot read a failure, not an empty ledger", () => {
    expect(readRetention(null)).toBeNull();
    expect(readRetention("nope")).toBeNull();
    expect(readRetention({ note: "nothing here" })).toBeNull();
    expect(readRetention([])).not.toBeNull();
    expect(readRetention([])!.answered).toEqual([]);
  });
});

describe("what an answer means: missing route vs denial vs failure", () => {
  it("a 404 console.unknown_route is 未接入, not a denial", () => {
    const outcome = probeOf(
      apiError(404, JSON.stringify({ code: "console.unknown_route", message: "unknown console API route" }), "rid-u"),
    );
    expect(outcome.kind).toBe("unwired");
    expect(outcome.status).toBe(404);
    expect(outcome.requestId).toBe("rid-u");
    expect(outcome.code).toBe("console.unknown_route");
  });

  it("403 and any other 404 are one denial", () => {
    expect(probeOf(apiError(403, JSON.stringify({ code: "console.forbidden" }), "rid-f")).kind).toBe("denied");
    expect(probeOf(apiError(404, JSON.stringify({ code: "console.not_found" }), "rid-n")).kind).toBe("denied");
    expect(probeOf(apiError(404, "", "rid-x")).kind).toBe("denied");
  });

  it("everything else is a failure that keeps its trace id", () => {
    const outcome = probeOf(apiError(503, "boom", "rid-503"));
    expect(outcome.kind).toBe("error");
    expect(outcome.status).toBe(503);
    expect(outcome.requestId).toBe("rid-503");
    const offline = probeOf(new Error("offline"));
    expect(offline.kind).toBe("error");
    expect(offline.requestId).toBeNull();
    expect(offline.code).toBeNull();
  });

  it("codeOf reads the envelope and survives a body that is not JSON", () => {
    expect(codeOf(apiError(404, JSON.stringify({ code: "console.unknown_route" })))).toBe("console.unknown_route");
    expect(codeOf(apiError(404, "<html>404</html>"))).toBeNull();
    expect(codeOf(new Error("x"))).toBeNull();
  });
});

describe("the numbers on screen stay honest", () => {
  it("formats bytes in binary units and keeps null absent", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
    expect(formatBytes(null)).toBeNull();
    expect(formatBytes(-1)).toBeNull();
  });

  it("never rounds a partial occupancy up to 100%", () => {
    expect(occupancyShare(996, 1000)).toBe(99);
    expect(occupancyShare(999, 1000)).toBe(99);
    expect(occupancyShare(1000, 1000)).toBe(100);
    expect(occupancyShare(2000, 1000)).toBe(100);
    expect(occupancyShare(1, 1000)).toBe(1);
    expect(occupancyShare(0, 10)).toBe(0);
    expect(occupancyShare(5, 0)).toBeNull();
    expect(occupancyShare(null, 10)).toBeNull();
    expect(occupancyShare(10, null)).toBeNull();
  });

  it("reads instants in Beijing time to the minute and refuses junk", () => {
    expect(beijingMinute("2026-11-19T12:05:00Z")).toBe("2026-11-19 20:05");
    expect(beijingMinute("2026-11-20T01:00:00.000Z")).toBe("2026-11-20 09:00");
    expect(beijingMinute("not-a-time")).toBeNull();
    expect(beijingMinute("")).toBeNull();
    expect(beijingMinute(null)).toBeNull();
  });
});

describe("stated gaps and planned writes", () => {
  it("lists the four areas as 未接入 with the reason, all fields empty", () => {
    const rows = unwiredSections();
    expect(rows).toHaveLength(SECTIONS.length);
    expect(rows.map((row) => row.label)).toEqual(["审计事件", "运行记录", "会话日志", "上传物"]);
    for (const row of rows) {
      expect(row.unwired).toBe(true);
      expect(row.days).toBeNull();
      expect(row.usedBytes).toBeNull();
      expect(row.note).toBe(UNWIRED_REASON);
    }
    expect(GAP).toBe("GAP-13");
    expect(FIELD_REASON).toContain("不替它猜");
  });

  it("keeps an HTTP code off the sentence and the two write actions declared", () => {
    expect(failureSentence(503)).not.toContain("503");
    expect(failureSentence(401)).toContain("登录");
    expect(failureSentence(0)).toContain("连不上");
    expect(PLANNED_ACTIONS.map((action) => action.label)).toEqual(["立即清理", "修改策略"]);
    expect(PLANNED_ACTIONS.every((action) => action.reason.includes("还没有接通"))).toBe(true);
  });
});