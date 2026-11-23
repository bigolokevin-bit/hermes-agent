// @vitest-environment jsdom
/**
 * AP-05 — 审批决定幂等与安全提交（前端腿三件事的钉）。
 *
 * 现场裁决（禁臆造，先盘读后落锚）：
 * - 域 decide_approval 幂等键＝(approval_id, user_id)：同键重放（含双击）⇒
 *   200 带回整张票面（回填票面，非错误）；三条 200 路径都以「该键的票在单上」
 *   为前提 ⇒「你已经投过票」为真话（services/domain/approvals.py L784-793、
 *   L842-850，2026-11-24 盘读）。
 * - 409 只可能来自 idempotency key 复用且请求体不一致（先例 T03-ENDPOINT-
 *   RECONCILIATION.md L137-141，本 worktree 盘上无该文件，口径按总控转述）
 *   ⇒ 人话冲突句、不重试（无第二次 POST、无第二次读回）。
 * - 超时/断连＝结果未知 ⇒ 先 GET /api/approval?id= 读回再决定，**绝不盲发
 *   第二次 POST**——本文件用请求计数钉死 decision URL 调用数=1。
 * - ①指纹缺失句为数据侧禁用原因：与 DECISION_GATE.title 同屏并存；按钮三
 *   属性仍只读 DECISION_GATE（本轮未开闸，合取属 AP-04 开闸波，见
 *   DONE-AP-05 偏差裁定）。
 * 测试面 stub fetch 返回值合法（形制取 evidence/raw-detail-ap_AEEC….json
 * 真响应：camel 键族、decisions[] 带 verdict/userId/decidedAt/comment）；
 * 现网渲染禁 fixture，本文件不新增任何样例行。
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";
import { CsrfMissingError, postDecision, readBackDecisionTicket } from "@/modules/approvals/api";
import { DECISION_GATE, ACTION_HASH_MISSING_REASON } from "@/modules/approvals/writeGate";
import { TRAIL_FACE_RECORDED } from "@/modules/approvals/copy";
import { submitDecisionWithRecovery } from "@/modules/approvals/decisionOutcome";
import { approvalDetailFrom } from "@/modules/approvals/model";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import ApprovalsPendingModulePage from "@/modules/approvals/ApprovalsPendingModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/* ────────────────────────── 票面形制（实测形制的合法 stub） ────────────────────────── */

const APPROVED_FACE = {
  approvalId: "ap_IDEM0001",
  title: "给外部发送本周报表",
  status: "approved",
  type: "business_action",
  riskLevel: "medium",
  requestedBy: { type: "user", id: "1" },
  approvers: [{ userId: "human:10", name: "郑涛" }],
  decisions: [
    {
      approval_id: "ap_IDEM0001",
      user_id: "human:10",
      userId: "human:10",
      name: "郑涛",
      verdict: "approve",
      comment: "同意",
      decided_at: "2026-11-24T01:00:00Z",
    },
  ],
  argsDigest: "6d39a99d3d435a268bbb448ee333ee02e35c93cc7f9ed2a",
};

const PENDING_TICKET = {
  approvalId: "ap_IDEM0002",
  title: "提高外勤权限",
  status: "pending",
  approvers: [{ userId: "human:10", name: "郑涛" }],
  decisions: [],
  argsDigest: "f613ef0847a7bff6ba820c4faf098788de866184f75bf0d",
};

const netError = () => new ApiError("network", { status: 0, body: "", url: "/agent-api/api/approval/decision?id=ap_IDEM0001" });

/* ───────────────────────────── A. 状态机（纯逻辑腿） ───────────────────────────── */

describe("AP-05 ② 同键重放/双击 ⇒ 成功侧回填票面", () => {
  it("200＋票面已落定＝replay：「你已经投过票」句、票面已记录措辞、不读回、POST 恰一次", async () => {
    let posts = 0;
    let reads = 0;
    const outcome = await submitDecisionWithRecovery("ap_IDEM0001", "approve", "同意", {
      post: async () => {
        posts += 1;
        return APPROVED_FACE;
      },
      readBack: async () => {
        reads += 1;
        return approvalDetailFrom(PENDING_TICKET);
      },
    });
    expect(outcome.kind).toBe("replay");
    expect(posts).toBe(1);
    expect(reads).toBe(0);
    if (outcome.kind !== "replay") throw new Error("unreachable");
    expect(outcome.face.sentence.startsWith("你已经投过票：")).toBe(true);
    expect(outcome.face.sentence).toContain(TRAIL_FACE_RECORDED);
    expect(outcome.face.sentence).toContain("通过");
    expect(outcome.face.sentence).toContain("意见：同意");
    expect(outcome.face.sentence).toContain("不会产生第二票");
    // 成功侧措辞：不出现失败词，不进错误弹窗语义。
    expect(outcome.face.sentence).not.toMatch(/失败|出错|没能|没有提交/);
  });

  it("200＋票面仍在等人＝recorded：正常成功腿，不误报回填", async () => {
    const outcome = await submitDecisionWithRecovery("ap_IDEM0002", "approve", undefined, {
      post: async () => PENDING_TICKET,
      readBack: async () => approvalDetailFrom(PENDING_TICKET),
    });
    expect(outcome.kind).toBe("recorded");
  });

  it("200 但响应读不出票面＝recorded：重读交还给服务，不假装票面存在", async () => {
    const outcome = await submitDecisionWithRecovery("ap_IDEM0003", "approve", undefined, {
      post: async () => ({ echo: "ok" }),
      readBack: async () => approvalDetailFrom(PENDING_TICKET),
    });
    expect(outcome.kind).toBe("recorded");
  });

  it("409＝key 复用且请求体不一致：人话冲突句、不重试（无第二次 POST、无读回）", async () => {
    let posts = 0;
    let reads = 0;
    const outcome = await submitDecisionWithRecovery("ap_IDEM0001", "approve", "同意", {
      post: async () => {
        posts += 1;
        throw new ApiError("conflict", { status: 409, body: '{"code":"approval.key_conflict"}', url: "/x" });
      },
      readBack: async () => {
        reads += 1;
        return approvalDetailFrom(APPROVED_FACE);
      },
    });
    expect(outcome.kind).toBe("failure");
    expect(posts).toBe(1);
    expect(reads).toBe(0);
    if (outcome.kind !== "failure") throw new Error("unreachable");
    expect(outcome.copy.sentence).toContain("已经被处理过了");
    expect(outcome.copy.sentence).not.toMatch(/自动重发|再来一次/);
    // 409 语义：票动过了→重读（GET）在 UI 侧发生，此处只锁「不自动重试提交」。
    expect(outcome.reloadTicket).toBe(true);
  });

  it("CsrfMissingError＝拦在网络前：确定没送出，走失败句、不进读回腿", async () => {
    let reads = 0;
    const outcome = await submitDecisionWithRecovery("ap_IDEM0001", "approve", undefined, {
      post: async () => {
        throw new CsrfMissingError();
      },
      readBack: async () => {
        reads += 1;
        return approvalDetailFrom(APPROVED_FACE);
      },
    });
    expect(outcome.kind).toBe("failure");
    expect(reads).toBe(0);
  });
});

describe("AP-05 ③ 超时/结果未知 ⇒ 读回优先，绝不盲发第二次 POST", () => {
  it("POST 超时（status 0）⇒ 恰好一次 GET 读回；POST 计数=1；票面已落定走成功侧", async () => {
    let posts = 0;
    let reads = 0;
    const outcome = await submitDecisionWithRecovery("ap_IDEM0001", "approve", "同意", {
      post: async () => {
        posts += 1;
        throw netError();
      },
      readBack: async () => {
        reads += 1;
        return approvalDetailFrom(APPROVED_FACE);
      },
    });
    expect(posts).toBe(1);
    expect(reads).toBe(1);
    expect(outcome.kind).toBe("readback-settled");
    if (outcome.kind !== "readback-settled") throw new Error("unreachable");
    expect(outcome.face.sentence).toContain("以服务读回的票面为准");
    expect(outcome.face.sentence).toContain("不自动重发");
    // 读回落定腿不认领投票人：「你已经投过票」只属于 200 重放。
    expect(outcome.face.sentence).not.toContain("你已经投过票");
  });

  it("读回票面未落定＝readback-pending：如实未知、交人工、不重发", async () => {
    const outcome = await submitDecisionWithRecovery("ap_IDEM0001", "approve", undefined, {
      post: async () => {
        throw netError();
      },
      readBack: async () => approvalDetailFrom(PENDING_TICKET),
    });
    expect(outcome.kind).toBe("readback-pending");
    if (outcome.kind !== "readback-pending") throw new Error("unreachable");
    expect(outcome.copy.sentence).toContain("不会自动重发");
    expect(outcome.copy.sentence).toContain("人工核对");
    // 未知腿绝不写成「决定没有提交」式的确定失败。
    expect(outcome.copy.sentence).not.toContain("没有覆盖");
  });

  it("读回自身也失败＝readback-unreadable：未知如实说，仍无第二次 POST", async () => {
    let posts = 0;
    const outcome = await submitDecisionWithRecovery("ap_IDEM0001", "approve", undefined, {
      post: async () => {
        posts += 1;
        throw new Error("socket hang up");
      },
      readBack: async () => {
        throw netError();
      },
    });
    expect(posts).toBe(1);
    expect(outcome.kind).toBe("readback-unreadable");
    if (outcome.kind !== "readback-unreadable") throw new Error("unreachable");
    expect(outcome.copy.sentence).toContain("结果未知");
    expect(outcome.copy.sentence).toContain("不会自动重发");
  });

  it("线级证据：真 postDecision＋真 readBackDecisionTicket 打 fetchJSON stub——decision URL 恰一次、approval 详情 URL 恰一次", async () => {
    document.cookie = "console_csrf=test-token";
    try {
      api.fetchJSON.mockImplementation(async (url: string) => {
        if (String(url).includes("/api/approval/decision")) throw netError();
        return APPROVED_FACE; // GET /api/approval?id= 读回落定
      });
      const outcome = await submitDecisionWithRecovery("ap_IDEM0001", "approve", "同意", {
        post: postDecision,
        readBack: readBackDecisionTicket,
      });
      const calls = api.fetchJSON.mock.calls.map((c) => String(c[0]));
      expect(calls.filter((u) => u.includes("/api/approval/decision")).length).toBe(1);
      expect(calls.filter((u) => u.startsWith("/agent-api/api/approval?")).length).toBe(1);
      expect(outcome.kind).toBe("readback-settled");
    } finally {
      document.cookie = "console_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
  });
});

/* ────────────────────────── B. ① 指纹缺失句（页面渲染腿） ────────────────────────── */

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

async function render(entry: string, page: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter>);
  });
}

const qa = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);

const QUEUE = {
  items: [{ approvalId: "ap_HASHPROBE", title: "发布数字员工新版本", status: "pending" }],
  nextCursor: null,
};

/** 详情 stub：带/不带指纹族键由 hash 参数决定（形制=实测 camel 键族）。 */
const detailOf = (withHash: boolean): Record<string, unknown> => {
  const base: Record<string, unknown> = {
    approvalId: "ap_HASHPROBE",
    title: "发布数字员工新版本",
    status: "pending",
    riskLevel: "medium",
    requestedBy: { type: "user", id: "1" },
    approvers: [{ userId: "human:10", name: "郑涛" }],
    decisions: [],
  };
  return withHash ? { ...base, argsDigest: "53bca72b46ca642e8b82eadebf362ee755bc3836814afa4" } : base;
};

const openDrawer = async (withHash: boolean): Promise<void> => {
  api.fetchJSON.mockImplementation(async (url: string) => {
    if (String(url).includes("/api/approval?")) return detailOf(withHash);
    return QUEUE;
  });
  await render("/approvals", <ApprovalsPendingModulePage />);
  await waitFor(() => !document.querySelector(".animate-pulse"), "queue settled");
  const opener = document.querySelector("[data-testid='apr5-row-ap_HASHPROBE'] button:not([data-testid^='apv9'])") as HTMLButtonElement;
  expect(opener, "row opener present").toBeTruthy();
  await act(async () => {
    opener.click();
  });
  await waitFor(() => !!qa("apr5-actions-readonly-note"), "drawer actions settled");
};

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  api.fetchJSON.mockReset();
});

describe("AP-05 ① 动作指纹缺失＝禁用原因段的第二条数据侧原因", () => {
  it("详情无指纹族键：源句出现在决策区，与 DECISION_GATE.title 同屏并存；钮禁用形制不动", async () => {
    await openDrawer(false);
    const missing = qa("apr5-actions-hash-missing-note");
    expect(missing, "hash-missing reason rendered").toBeTruthy();
    // 源句逐字（工单①与总控裁定同源句，不许漂移）。
    expect(missing!.textContent?.trim()).toBe(ACTION_HASH_MISSING_REASON);
    expect(missing!.textContent).toBe("这张单没给出动作指纹，无法确认批的就是当前动作。");
    // 并存：写通道关闭句原样在同屏，且仍单源 DECISION_GATE.title。
    const gateNote = qa("apr5-actions-readonly-note");
    expect(gateNote?.textContent?.trim()).toBe(DECISION_GATE.title);
    // DECISION_GATE 决策钮默认禁用一行不碰：三属性仍只读 gate。
    const approve = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("批准")) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    expect(approve.getAttribute("aria-disabled")).toBe("true");
    expect(approve.getAttribute("title")).toBe(DECISION_GATE.title);
  });

  it("详情带指纹键（现网实态=argsDigest 恒在）：缺失句不出现，不假报", async () => {
    await openDrawer(true);
    expect(qa("apr5-actions-hash-missing-note")).toBeNull();
    expect(qa("apr5-actions-readonly-note")).toBeTruthy();
  });
});
