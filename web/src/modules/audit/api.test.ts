// @vitest-environment node
// T33 pure layer: the three requests the audit panes make, and the rules the
// answers are read through. No component, no DOM — these are the assertions
// that the endpoints are the real ones (the `/api/` segment included), that a
// missing value never becomes a 0, and that nothing machine-shaped becomes a
// label.

import { describe, expect, it } from "vitest";

import { detailUrl, isDenied, isVerifyUnavailable, listUrl, verifyUrl, LIST_PATH, VERIFY_PATH, PAGE_LIMIT } from "./api";
import { readFailure, verifyFailure, verifyUnavailableReason, requestIdLine } from "./copy";
import {
  actionView,
  actorView,
  auditDetailFrom,
  auditPageFrom,
  beijing,
  maskedDigest,
  maskedRef,
  outcomeView,
  shortCode,
  verifyResultFrom,
} from "./model";
import { windowBounds } from "./window";

describe("audit endpoints", () => {
  it("keeps the /api/ segment on all three routes", () => {
    expect(LIST_PATH).toBe("/agent-api/api/audit");
    expect(VERIFY_PATH).toBe("/agent-api/api/audit/verify");
    expect(listUrl()).toBe(`/agent-api/api/audit?limit=${PAGE_LIMIT}`);
    expect(detailUrl("evt_9F3A")).toBe("/agent-api/api/audit/detail?id=evt_9F3A");
  });

  it("carries the cursor, encoded, to the next page", () => {
    expect(listUrl("cur abc/+")).toBe(`/agent-api/api/audit?limit=${PAGE_LIMIT}&cursor=cur%20abc%2F%2B`);
  });

  it("sends the window as two encoded instants", () => {
    const bounds = windowBounds("7d", new Date("2026-11-19T02:00:00Z"));
    expect(bounds.from).toBe("2026-11-12T02:00:00.000Z");
    expect(verifyUrl(bounds.from, bounds.to)).toBe(
      "/agent-api/api/audit/verify?from=2026-11-12T02%3A00%3A00.000Z&to=2026-11-19T02%3A00%3A00.000Z",
    );
  });

  it("drops a bound it was not given instead of inventing one", () => {
    expect(verifyUrl(null, null)).toBe("/agent-api/api/audit/verify");
    expect(verifyUrl("2026-11-12T02:00:00.000Z", null)).toBe(
      "/agent-api/api/audit/verify?from=2026-11-12T02%3A00%3A00.000Z",
    );
  });

  it("403 and 404 are one body; the check treats them as not-reachable-here", () => {
    expect(isDenied(403)).toBe(true);
    expect(isDenied(404)).toBe(true);
    expect(isDenied(500)).toBe(false);
    for (const status of [403, 404, 405, 501, 0, 503]) expect(isVerifyUnavailable(status)).toBe(true);
    // a stale login or a refused window is a nameable failure, not a missing feature
    for (const status of [400, 401, 429]) expect(isVerifyUnavailable(status)).toBe(false);
  });
});

describe("event vocabulary", () => {
  it("relables the actions this repo names, in Chinese", () => {
    expect(actionView("approval_approved").label).toBe("批准审批");
    expect(actionView("employee_version_created").label).toBe("发布数字员工新版本");
    // dotted, dashed and camelCase spellings fold onto the same code
    expect(actionView("ApprovalRejected").label).toBe("驳回审批");
    expect(actionView("approval-rejected").label).toBe("驳回审批");
    expect(actionView("run.failed").label).toBe("运行失败");
  });

  it("shows an unknown action verbatim and says it is unmapped", () => {
    const odd = actionView("quantum.recalibration");
    expect(odd.label).toBe("quantum.recalibration");
    expect(odd.known).toBe(false);
    expect(odd.raw).toBe("quantum.recalibration");
    expect(actionView(null).label).toBe("—");
  });

  it("has exactly the three outcome words, plus an honest fourth", () => {
    expect(outcomeView("succeeded").label).toBe("成功");
    expect(outcomeView("rejected").label).toBe("失败（被拒）");
    expect(outcomeView("error").label).toBe("失败（被拒）");
    expect(outcomeView("in_progress").label).toBe("待完成");
    const odd = outcomeView("teleported");
    expect(odd.label).toBe("结果未识别");
    expect(odd.raw).toBe("teleported");
  });
});

describe("identity never reaches the screen bare", () => {
  it("masks an employee handle to eight characters", () => {
    expect(shortCode("emp_9c1f2a3b4d5e6f70")).toBe("4d5e6f70");
    const actor = actorView({ actorType: "employee", actorId: "employee:8812ff00a1" });
    expect(actor.label).toBe("员工 · 12ff00a1");
    expect(actor.raw).toBe("employee:8812ff00a1");
  });

  it("keeps a real name and still shows the code", () => {
    const actor = actorView({ actor: { type: "human", id: "user:2f3a4b5c6d7e8f90", displayName: "李思" } });
    expect(actor.label).toBe("李思 · 6d7e8f90");
    expect(actor.label).not.toMatch(/user:|2f3a4b5c/);
    expect(actor.raw).toBe("user:2f3a4b5c6d7e8f90");
  });

  it("reads the flat spellings too, and a UUID never becomes the label", () => {
    const actor = actorView({ actor_id: "4f1a2b3c-5d6e-7f80-91a2-b3c4d5e6f708" });
    expect(actor.label.startsWith("操作者 · ")).toBe(true);
    expect(actor.label).not.toMatch(/4f1a2b3c-5d6e/);
    expect(actor.raw).toBe("4f1a2b3c-5d6e-7f80-91a2-b3c4d5e6f708");
  });

  it("a handle with nothing worth masking reads as the bare role", () => {
    expect(actorView({ actor: { type: "human", id: "human:1" } }).label).toBe("成员");
  });

  it("digests and refs keep their whole value off the label", () => {
    expect(maskedDigest("a1b2c3d4e5f60718293a4b5c").label).toBe("a1b2c3d4e5…");
    expect(maskedDigest(null).label).toBe("—");
    expect(maskedRef("run_77aaee33ff001122", "运行").label).toBe("运行 · ff001122");
    expect(maskedRef("knowledge-space-a", "知识空间").label).toBe("knowledge-space-a");
  });
});

describe("read model", () => {
  it("finds the list under whichever key the gateway used, and counts what it cannot read", () => {
    const page = auditPageFrom({
      items: [
        { event_id: "e1", action: "approval_approved", occurredAt: "2026-11-19T01:20:00Z", outcome: "succeeded" },
        "not a record",
        { eventId: "e2", eventType: "run.failed", occurred_at: "2026-11-19T02:05:00Z", result: "error" },
      ],
      nextCursor: "cur_e2",
    });
    expect(page?.rows.map((row) => row.key)).toEqual(["e1", "e2"]);
    expect(page?.unreadable).toBe(1);
    expect(page?.next).toBe("cur_e2");
    expect(page?.rows[0]?.occurredAt).toBe("2026-11-19 09:20");
  });

  it("treats a non-list answer as no page at all", () => {
    expect(auditPageFrom({ message: "hello" })).toBeNull();
    expect(auditPageFrom("text")).toBeNull();
  });

  it("speaks Beijing time to the minute from a UTC instant", () => {
    expect(beijing("2026-11-18T01:20:00Z")).toBe("2026-11-18 09:20");
    expect(beijing(1763488800)).toBe("2025-11-19 02:00");
    expect(beijing("nonsense")).toBeNull();
    expect(beijing(null)).toBeNull();
  });

  it("reads an actor and a resource on a row without leaking either id", () => {
    const row = auditPageFrom({
      items: [
        {
          id: "e7",
          action: "message_sent",
          outcome: "success",
          actor: { type: "employee", id: "emp_3b9c8d7e6f5a4b3c", displayName: "小鲤" },
          resource: { type: "message", id: "msg_9f8e7d6c5b4a3f21" },
        },
      ],
    })!.rows[0]!;
    expect(row.actor.label).toBe("小鲤 · 6f5a4b3c");
    expect(row.resource.label).toBe("消息 · 5b4a3f21");
    expect(row.resource.raw).toBe("msg_9f8e7d6c5b4a3f21");
    // The label never carries a handle; the raw side of the row does, and that
    // is what a `title` attribute shows on demand.
    expect(`${row.actor.label} ${row.resource.label}`).not.toMatch(/emp_|msg_|3b9c8d7e6f5a4b3c|9f8e7d6c5b4a3f21/);
    expect(row.actor.raw).toBe("emp_3b9c8d7e6f5a4b3c");
  });

  it("keeps a failure reason in human words and drops a stack trace", () => {
    const rows = auditPageFrom({
      items: [
        { id: "a", action: "run_failed", outcome: "failed", error: { code: "runtime.oom", messageRedacted: "内存不足，运行被中断" } },
        { id: "b", action: "run_failed", outcome: "failed", error: { code: "x", messageRedacted: "TypeError: Cannot read properties of undefined (reading 'x')\n    at Object.<anonymous> (/srv/a.js:3:1)" } },
      ],
    })!.rows;
    expect(rows[0]!.reason).toBe("内存不足，运行被中断");
    expect(rows[1]!.reason).toBeNull();
  });

  it("reads a detail answer wrapped or bare, and keeps technical keys for the disclosure", () => {
    const body = {
      eventId: "evt_D6FC9A2B4E6F8012",
      event_type: "grant_escalation",
      occurred_at: "2026-11-18T03:00:00Z",
      recorded_at: "2026-11-18T03:00:05Z",
      outcome: "rejected",
      actor: { type: "human", id: "user:1122334455667788", displayName: "郑涛" },
      resource: { type: "permission", id: "perm_99aabbccddeeff00" },
      sourceSystem: "agentos-core",
      tenantId: "tenant_0f1e2d3c4b5a6978",
      run_id: "run_77aaee33ff001122",
      taskId: "task_554433221100ffeedd",
      approvalId: "ap_1122334455667788",
      policyDecisionId: "pd_8899aabbccddeeff",
      hash: "1a2b3c4d5e6f708192a3b4c5d6e7f809",
      prevHash: "0f1e2d3c4b5a6978a3b4c5d6e7f8091a",
      error: { code: "policy.denied", messageRedacted: "策略不允许在这台环境上提权" },
      change: { fields: [{ field: "level", before: "read", after: "write" }] },
    };
    const detail = auditDetailFrom({ audit: body })!;
    expect(detail.action.label).toBe("提高权限");
    expect(detail.outcome.label).toBe("失败（被拒）");
    expect(detail.reason).toBe("策略不允许在这台环境上提权");
    expect(detail.actor.label).toBe("郑涛 · 55667788");
    expect(detail.occurredAt).toBe("2026-11-18 11:00");
    expect(detail.recordedAt).toBe("2026-11-18 11:00");
    expect(detail.change.present).toBe(true);
    expect(detail.change.technical.join(" ")).toContain("level：read → write");
    expect(detail.integrity.hash.label).toBe("1a2b3c4d5e…");
    expect(detail.links.map((link) => link.label)).toEqual([
      "运行 · ff001122",
      "任务 · 00ffeedd",
      "审批单 · 55667788",
      "策略判定 · ccddeeff",
    ]);
    // The whole values live on the technical side, and in `raw` for a `title`;
    // no label carries one.
    expect(detail.links.map((link) => link.raw)).toEqual([
      "run_77aaee33ff001122",
      "task_554433221100ffeedd",
      "ap_1122334455667788",
      "pd_8899aabbccddeeff",
    ]);
    expect(detail.technical.join(" ")).toContain("事件标识：evt_D6FC9A2B4E6F8012");
    expect(detail.technical.join(" ")).toContain("失败代码：policy.denied");
    expect(detail.technical.join(" ")).toContain("前一条摘要：0f1e2d3c4b5a6978a3b4c5d6e7f8091a");
    expect(detail.integrity.hash.raw).toBe("1a2b3c4d5e6f708192a3b4c5d6e7f809");
    expect(detail.tenant.raw).toBe("tenant_0f1e2d3c4b5a6978");
    expect(detail.resource.label).toBe("权限 · ddeeff00");
    expect([detail.actor.label, detail.resource.label, ...detail.links.map((l) => l.label)].join(" ")).not.toMatch(/[a-f0-9]{16,}|run_|emp_|user:/i);
  });

  it("does not read a record with neither an id nor an event type", () => {
    expect(auditDetailFrom({ note: "只有备注" })).toBeNull();
  });

  it("omits sections the answer did not fill rather than inventing them", () => {
    const detail = auditDetailFrom({ id: "e1", action: "task_created" })!;
    expect(detail.change.present).toBe(false);
    expect(detail.links).toEqual([]);
    expect(detail.integrity.present).toBe(false);
    expect(detail.occurredAt).toBeNull();
    expect(detail.tenant.label).toBe("—");
    expect(detail.reason).toBeNull();
  });
});

describe("verify answer reading", () => {
  it("takes the service's own verdict when it gives one", () => {
    const ok = verifyResultFrom({ ok: true, scanned: 120, total: 120, broken: 0, from: "2026-11-18T00:00:00Z", to: "2026-11-19T00:00:00Z" })!;
    expect(ok.verdict).toBe("intact");
    expect(ok.scanned).toBe(120);
    expect(ok.total).toBe(120);
    expect(ok.broken).toBe(0);
    expect(ok.windowFrom).toBe("2026-11-18 08:00");
    expect(ok.windowTo).toBe("2026-11-19 08:00");
  });

  it("a real zero stays zero, and a counted zero is intact", () => {
    const derived = verifyResultFrom({ scanned: 0, broken: 0 })!;
    expect(derived.stated).toBeNull();
    expect(derived.scanned).toBe(0);
    expect(derived.verdict).toBe("intact");
  });

  it("counts it says nothing about stay missing, not zero", () => {
    const sparse = verifyResultFrom({ result: "broken", gaps: 3 })!;
    expect(sparse.verdict).toBe("broken");
    expect(sparse.broken).toBe(3);
    expect(sparse.scanned).toBeNull();
    expect(sparse.total).toBeNull();
    expect(sparse.denominator).toBeNull();
  });

  it("refuses to call an unreadable conclusion intact", () => {
    const unsure = verifyResultFrom({ note: "we ran something" })!;
    expect(unsure.verdict).toBe("unsure");
    expect(unsure.stated).toBeNull();
    expect(verifyResultFrom("text")).toBeNull();
  });
});

describe("failure copy keeps the trace id and hides the wire", () => {
  it("passes ApiError.requestId through", async () => {
    const { ApiError } = await import("@/lib/api-error");
    const err = new ApiError("downstream not ready", {
      status: 503,
      body: '{"detail":"downstream not ready"}',
      url: listUrl(),
      requestId: "c0ffee99",
    });
    const read = readFailure(err, { status: 503, requestId: "c0ffee99", technical: err.details });
    expect(read.requestId).toBe("c0ffee99");
    expect(read.sentence).toContain("审计服务在处理时出了错");
    expect(read.sentence).not.toContain("503");
    expect(read.technical).toContain("HTTP 503");
  });

  it("says 未提供 when the answer carried no id, and never invents one", async () => {
    const { ApiError } = await import("@/lib/api-error");
    const err = new ApiError("no", { status: 403, body: "", url: listUrl() });
    expect(err.requestId).toBeUndefined();
    expect(requestIdLine(null)).toBe("请求编号：未提供");
    expect(requestIdLine("rid-1")).toBe("请求编号：rid-1");
  });

  it("a check that cannot run names why, and never reads as a pass", () => {
    const cases: Array<[number, string]> = [
      [403, "没有提供完整性校验"],
      [404, "没有提供完整性校验"],
      [405, "尚未开通"],
      [501, "尚未开通"],
      [0, "连不上审计服务"],
      [503, "连不上"],
    ];
    for (const [status, want] of cases) {
      const info = { status, requestId: `rid-${status}`, technical: null };
      const copy = verifyFailure(new Error("x"), info);
      expect(copy.unavailable).toBe(true);
      expect(copy.sentence).toContain(want);
      expect(copy.sentence).not.toMatch(/\b(40[0-9]|41[0-9]|42[0-9]|50[0-9])\b/);
      expect(copy.sentence).not.toContain("已通过");
      expect(verifyUnavailableReason(status)).toBe(copy.sentence);
    }
  });

  it("a stale login is an error the person can act on, not a missing feature", () => {
    const copy = verifyFailure(new Error("x"), { status: 401, requestId: null, technical: null });
    expect(copy.unavailable).toBe(false);
    expect(copy.sentence).toContain("重新登录");
  });
});
