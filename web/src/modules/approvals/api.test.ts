// @vitest-environment node
// T16/T17 pure layer: the requests the panes make, and the rules the answers
// are read through. No component, no DOM — these are the assertions that the
// endpoints are the real ones and that a missing value never becomes a 0.

import { describe, expect, it } from "vitest";

import { decisionUrl, detailUrl, failureInfo, isDenied, listUrl } from "./api";
import { readFailure, requestIdLine, writeFailure } from "./copy";
import {
  approvalDetailFrom,
  approvalsPageFrom,
  beijing,
  countdown,
  isKnownStatus,
  money,
  statusView,
} from "./model";

describe("approvals endpoints", () => {
  it("asks the list route with the state the pane chose", () => {
    expect(listUrl("pending", null)).toBe("/agent-api/api/approvals?status=pending&limit=50");
    expect(listUrl("consumed", null)).toBe("/agent-api/api/approvals?status=consumed&limit=50");
    // 「全部」 drops the parameter instead of inventing a value for it.
    expect(listUrl(null, null)).toBe("/agent-api/api/approvals?limit=50");
  });

  it("carries the cursor, encoded, to the next page", () => {
    expect(listUrl("expired", "cur abc/+")).toBe(
      "/agent-api/api/approvals?status=expired&limit=50&cursor=cur%20abc%2F%2B",
    );
  });

  it("names the ticket by id in the query, and the decision route the BFF exposes", () => {
    expect(detailUrl("ap_9F3A")).toBe("/agent-api/api/approval?id=ap_9F3A");
    expect(decisionUrl("ap_9F3A")).toBe("/agent-api/api/approval/decision?id=ap_9F3A");
  });

  it("403 and 404 are the same body; other failures are not", () => {
    expect(isDenied(403)).toBe(true);
    expect(isDenied(404)).toBe(true);
    expect(isDenied(500)).toBe(false);
    expect(isDenied(0)).toBe(false);
  });
});

describe("failure copy keeps the trace id and hides the wire", () => {
  it("passes ApiError.requestId through", async () => {
    const { ApiError } = await import("@/lib/api-error");
    const err = new ApiError("downstream not ready", {
      status: 503,
      body: '{"detail":"downstream not ready"}',
      url: listUrl("pending", null),
      requestId: "c0ffee99",
    });
    const read = readFailure(err, failureInfo(err));
    expect(read.requestId).toBe("c0ffee99");
    expect(read.sentence).toContain("审批服务在处理时出了错");
    expect(read.sentence).not.toContain("503");
    expect(read.technical).toContain("HTTP 503");

    const write = writeFailure(err, "approve", failureInfo(err));
    expect(write.requestId).toBe("c0ffee99");
    expect(write.sentence).toContain("批准");
    expect(write.sentence).not.toMatch(/503|HTTP/);
  });

  it("keeps the request id null when the answer carried none, and never invents one", async () => {
    const { ApiError } = await import("@/lib/api-error");
    const err = new ApiError("no", { status: 403, body: "", url: listUrl("pending", null) });
    const info = failureInfo(err);
    expect(info.requestId).toBeNull();
    expect(writeFailure(err, "reject", info).requestId).toBeNull();
    // QA V4-R4 条目5: the line a person reads when there is no id.
    expect(requestIdLine(null)).toBe("本次请求未记录编号，可复制时间与操作路径反馈");
    expect(requestIdLine("x-1")).toBe("请求编号：x-1");
  });

  it("a refused decision names what happened, not the code", () => {
    const cases: Array<[number, string]> = [
      [403, "不归你审批"],
      [404, "找不到了"],
      [405, "还没有开放审批写入"],
      [409, "已经被处理过"],
      [0, "连不上审批服务"],
      [500, "出了错"],
    ];
    for (const [status, want] of cases) {
      const copy = writeFailure(new Error("x"), "approve", { status, requestId: null, technical: null });
      expect(copy.sentence).toContain(want);
      expect(copy.sentence).not.toMatch(/\b(40[0-9]|41[0-9]|42[0-9]|50[0-9]|HTTP)\b/);
    }
  });
});

describe("read model", () => {
  it("finds the list under whichever key the gateway used, and counts what it cannot read", () => {
    const page = approvalsPageFrom({
      items: [
        { approvalId: "ap_1", title: "对外发送本周报表", status: "pending" },
        "not a record",
        { id: "ap_2", summary: "读取生产数据库", state: "rejected" },
      ],
      nextCursor: "cur_2",
    });
    expect(page?.rows.map((row) => row.key)).toEqual(["ap_1", "ap_2"]);
    expect(page?.unreadable).toBe(1);
    expect(page?.next).toBe("cur_2");
  });

  it("treats a non-list answer as no page at all", () => {
    expect(approvalsPageFrom({ message: "hello" })).toBeNull();
    expect(approvalsPageFrom("text")).toBeNull();
  });

  it("keeps a real zero as zero and a missing amount as missing", () => {
    const page = approvalsPageFrom({
      items: [
        { id: "a1", title: "没有金额的申请" },
        { id: "a2", title: "零金额的申请", amountUsd: 0 },
      ],
    });
    const rows = page?.rows ?? [];
    expect(money(rows[0]!.amount)).toBe("—");
    expect(money(rows[1]!.amount)).toBe("$0.00");
  });

  it("speaks Beijing time to the minute from a UTC instant", () => {
    expect(beijing("2026-11-18T01:20:00Z")).toBe("2026-11-18 09:20");
    expect(beijing("nonsense")).toBeNull();
    expect(beijing(null)).toBeNull();
  });

  it("turns a wait into a sentence, and an overdue wait into 已到时", () => {
    expect(countdown(3 * 3600 + 12 * 60)?.text).toBe("剩 3 小时 12 分");
    expect(countdown(2 * 86400 + 5 * 3600)?.text).toBe("剩 2 天 5 小时");
    expect(countdown(0)?.overdue).toBe(true);
    expect(countdown(null)).toBeNull();
  });

  it("names the eight states and keeps any other spelling honest but unrenamed", () => {
    expect(statusView("revise_requested").label).toBe("要求修改");
    expect(statusView("consumed").label).toBe("已执行");
    expect(statusView("superseded").label).toBe("已被新单替代");
    expect(statusView("denied").label).toBe("已拒绝"); // alias, same label
    const odd = statusView("teleported");
    expect(odd.label).toBe("状态未识别");
    expect(odd.raw).toBe("teleported");
    expect(isKnownStatus("teleported")).toBe(false);
    expect(isKnownStatus("cancelled")).toBe(true);
  });

  it("relables the clock once a ticket is settled, and never claims a time it did not get", () => {
    const [pending, settled] = approvalsPageFrom({
      items: [
        { id: "p", title: "待办", status: "pending", expiresAt: "2026-11-20T00:00:00Z" },
        { id: "s", title: "已办", status: "approved", decidedAt: "2026-11-19T02:05:00Z" },
      ],
    })!.rows;
    expect(pending.clockLabel).toBe("处理期限");
    expect(settled.clockLabel).toBe("处理于");
    expect(settled.clock).toBe("2026-11-19 10:05");
    const noTime = approvalsPageFrom({ items: [{ id: "n", title: "无时间" }] })!.rows[0]!;
    expect(noTime.clock).toBeNull();
    expect(noTime.submitted).toBeNull();
  });

  it("reads a detail answer wrapped or bare, and keeps digests for the disclosure only", () => {
    const body = {
      approvalId: "ap_D6FC",
      title: "发布数字员工新版本",
      status: "pending",
      changeKind: "employee_version_create",
      riskLevel: "high",
      requestedByName: "李思",
      employee: "employee:8812",
      amountUsd: 25,
      reason: "需要上线修订后的流程",
      remainingSeconds: 90,
      targetHash: "th_0123456789abcdef0123456789abcdef",
      approvers: [{ userId: "human:1", name: "郑涛" }],
      decisions: [{ userId: "human:2", verdict: "approve", decidedAt: "2026-11-18T03:00:00Z", comment: "同意" }],
    };
    const detail = approvalDetailFrom({ approval: body })!;
    expect(detail.title).toBe("发布数字员工新版本");
    expect(detail.kind.label).toBe("发布数字员工新版本");
    expect(detail.risk.label).toBe("高风险");
    expect(detail.worker.label).toBe("员工 · 8812");
    expect(detail.amount).toBe(25);
    expect(detail.remaining?.text).toBe("剩 1 分");
    expect(detail.approvers.labels).toEqual(["郑涛"]);
    // `human:2` is one character short of anything worth masking, so it reads
    // as the bare role rather than as a handle or a made-up name.
    expect(detail.decisions[0]).toMatchObject({ who: "审批人", verdict: "批准", at: "2026-11-18 11:00" });
    expect(detail.technical.join(" ")).toContain("th_0123456789abcdef");
    expect(JSON.stringify(detail).toLowerCase()).not.toContain("run_id");
  });

  it("does not read a record with neither an id nor a caption", () => {
    expect(approvalDetailFrom({ note: "只有备注" })).toBeNull();
  });
});
