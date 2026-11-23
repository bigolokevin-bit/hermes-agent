// @vitest-environment jsdom
/**
 * AP-06 — 403 / 409 负例与折叠口径（ADR-0010 错误映射表逐码钉进 UI 与测试）。
 *
 * 形制真值（本件不猜，全部有盘读/实测来源）：
 * - BFF `apps/console/server.py`（主仓只读核对，2026-11-24 盘读）：
 *   `PASSTHROUGH_ERROR_CODES` L216-221 = not_approver｜already_decided｜expired｜
 *   service_unavailable 保留透传；`FOLDED_ERROR_CODES` L223-228 = not_found ＋
 *   consume 四码折叠为 404 `_UNAVAILABLE`（L230）＝换整实体，浏览器只见一个码；
 *   写腿 L1974-1977 即分流处；`_error_code_of` L298-304 只认顶层 `code`。
 * - 域 `services/domain/approvals.py`：not_approver 403（L759/769/778 三支同码同体，
 *   形态非法也不教格式）；expired 409 带 `details.expiredFrom`（L962-967、
 *   L1019-1026）；already_decided 409（L792/L850）；信封平铺 `{code,message,details?}`
 *   （`http_app.py:36-41`）。503 `approval.service_unavailable` 见 BFF 测试桩
 *   `conftest.py:729`、`stub_upstream.py:1076`。
 * - 响应头关联：`web/src/lib/api.ts:334-335` 真取 `x-console-request-id`（缺则
 *   `x-request-id`），ApiError.requestId 是唯一来源，本件不编号。
 *
 * 现网取证边界（诚实盘点，见 DONE-AP-06.md）：写开关 `CONSOLE_APPROVAL_WRITE_ENABLED`
 * 关＝写腿 POST 405 `console.read_only` 是常态，禁真写尝试 ⇒ 五码的真数据腿现网
 * 不可触达；这些句子与分流由本文件钉住形制。测试面 stub 的是 fetchJSON 返回值，
 * 不是新增端点、不进生产路径。
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";
import { CsrfMissingError, errorEnvelopeOf, failureInfo } from "@/modules/approvals/api";
import {
  CODE_ALREADY_DECIDED,
  CODE_EXPIRED,
  CODE_NOT_APPROVER,
  CODE_SERVICE_UNAVAILABLE,
  CODE_UNAVAILABLE,
  EXPIRED_SENTENCE,
  NOT_APPROVER_SENTENCE,
  SERVICE_UNAVAILABLE_SENTENCE,
  TRAIL_FACE_RECORDED,
  UNAVAILABLE_SENTENCE,
  alreadyDecidedFaceCopy,
  expiredDetailLines,
  negativeCodeSentence,
  readFailure,
  writeFailure,
  type FailureCopy,
} from "@/modules/approvals/copy";
import { submitDecisionWithRecovery } from "@/modules/approvals/decisionOutcome";
import { approvalDetailFrom } from "@/modules/approvals/model";
import { DeniedPanel, ErrorPanel, InlineFailure, RequestIdCopyField } from "@/modules/approvals/states";
import { APPROVAL_DENIED_BODY, APPROVAL_DENIED_TITLE, APPROVAL_RID_FALLBACK } from "@/modules/approvals/stateCopy";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import ApprovalsPendingModulePage from "@/modules/approvals/ApprovalsPendingModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/* ────────────────────────────── 真形制的错误构造 ────────────────────────────── */

const DECISION_URL = "/agent-api/api/approval/decision?id=ap_NEG0001";

/** BFF 透传腿：域信封逐字转发（`{code,message,details?}` 平铺）。 */
function bffError(status: number, code: string, message: string, details?: Record<string, unknown>, rid?: string): ApiError {
  const body: Record<string, unknown> = { code, message };
  if (details) body.details = details;
  return new ApiError(message, { status, body: JSON.stringify(body), url: DECISION_URL, requestId: rid });
}

/** 折叠腿唯一体（BFF `_UNAVAILABLE` L230 逐字）。 */
const folded404 = (rid = "req-folded-001") =>
  new ApiError("approval not found or not actionable", {
    status: 404,
    body: '{"code": "approval.unavailable", "message": "approval not found or not actionable"}',
    url: DECISION_URL,
    requestId: rid,
  });

/** 已决票面（形制取 evidence/raw-detail 真响应的 camel 键族）。 */
const DECIDED_FACE = {
  approvalId: "ap_NEG0001",
  title: "给外部发送本周报表",
  status: "approved",
  approvers: [{ userId: "human:10", name: "郑涛" }],
  decisions: [
    {
      approvalId: "ap_NEG0001",
      userId: "human:22",
      name: "周敏",
      verdict: "approve",
      comment: "同意对外",
      decidedAt: "2026-11-23T09:12:00Z",
    },
  ],
  argsDigest: "6d39a99d3d435a268bbb448ee333ee02e35c93cc7f9ed2a",
};

const PENDING_TICKET = {
  approvalId: "ap_NEG0001",
  title: "给外部发送本周报表",
  status: "pending",
  decisions: [],
};

const infoOf = (err: unknown) => failureInfo(err);

/* ══════════════════ A. 错误信封解析（api.ts 单点，形制=服务真给的样子） ══════════════════ */

describe("AP-06 A 服务错误信封解析", () => {
  it("平铺信封 {code,message,details} → 码与 details 都读到（域 http_app.py:36-41）", () => {
    const env = errorEnvelopeOf('{"code":"approval.expired","message":"approval expired","details":{"expiredFrom":"pending"}}');
    expect(env.code).toBe("approval.expired");
    expect(env.details).toEqual({ expiredFrom: "pending" });
  });

  it("折叠腿体只给 approval.unavailable，details 缺席＝null（不猜一个）", () => {
    const env = errorEnvelopeOf('{"code":"approval.unavailable","message":"approval not found or not actionable"}');
    expect(env.code).toBe(CODE_UNAVAILABLE);
    expect(env.details).toBeNull();
  });

  it("非 JSON 体（代理 HTML 错误页）→ 无码无 details，交状态码档兜底", () => {
    expect(errorEnvelopeOf("<html>502 Bad Gateway</html>")).toEqual({ code: null, details: null });
    expect(errorEnvelopeOf("")).toEqual({ code: null, details: null });
    expect(errorEnvelopeOf(null)).toEqual({ code: null, details: null });
  });

  it("JSON 但没有 code → 不推断（无码＝按状态说话）", () => {
    expect(errorEnvelopeOf('{"detail":"no such route"}').code).toBeNull();
  });

  it("嵌套 detail.code 作兼容腿仍可认码（csrf.ts 同款容忍）", () => {
    expect(errorEnvelopeOf('{"detail":{"code":"approval.not_approver"}}').code).toBe(CODE_NOT_APPROVER);
  });

  it("failureInfo 把码/details/响应头请求号一并带出；CsrfMissingError 拦在网前＝无码无号", () => {
    const err = bffError(409, CODE_EXPIRED, "approval expired", { expiredFrom: "approved" }, "req-exp-77");
    const info = infoOf(err);
    expect(info.code).toBe(CODE_EXPIRED);
    expect(info.details).toEqual({ expiredFrom: "approved" });
    expect(info.requestId).toBe("req-exp-77");
    const csrf = infoOf(new CsrfMissingError());
    expect(csrf.code).toBeNull();
    expect(csrf.details).toBeNull();
    expect(csrf.requestId).toBeNull();
  });
});

/* ══════════════════ B. 逐码专句（copy.ts 单点） ══════════════════ */

describe("AP-06 B 五类码各有唯一确定句子", () => {
  it("四个失败码 → 四句互不相同；already_decided 不在失败表里（它是回填票面）", () => {
    const sentences = [CODE_NOT_APPROVER, CODE_EXPIRED, CODE_UNAVAILABLE, CODE_SERVICE_UNAVAILABLE].map((c) => negativeCodeSentence(c));
    expect(new Set(sentences).size).toBe(4);
    expect(sentences.every((s) => typeof s === "string" && s.length > 0)).toBe(true);
    expect(negativeCodeSentence(CODE_ALREADY_DECIDED)).toBeNull();
    expect(negativeCodeSentence("approval.some_future_code")).toBeNull();
    expect(negativeCodeSentence(null)).toBeNull();
  });

  it("403 not_approver＝「你不在该单审批人名单」＋明说不自动改派、不代投", () => {
    expect(NOT_APPROVER_SENTENCE).toContain("你不在该单审批人名单");
    expect(NOT_APPROVER_SENTENCE).toContain("决定没有提交");
    expect(NOT_APPROVER_SENTENCE).toContain("不会自动改派");
    expect(NOT_APPROVER_SENTENCE).toContain("也不会替你代投");
  });

  it("409 expired＝过期句＋声明列表已重读（屏上以服务最新状态为准）", () => {
    expect(EXPIRED_SENTENCE).toContain("已经过期");
    expect(EXPIRED_SENTENCE).toContain("决定没有提交");
    expect(EXPIRED_SENTENCE).toContain("列表已重新读取");
  });

  it("404 折叠体＝「未找到或无权查看」（同一句既不说有也不说没有）", () => {
    expect(UNAVAILABLE_SENTENCE).toContain("未找到或无权查看");
    expect(UNAVAILABLE_SENTENCE).toContain("决定没有提交");
  });

  it("503＝「审批服务不可用，请稍后重试」，且绝不乐观放行（不含已提交/已生效/成功）", () => {
    expect(SERVICE_UNAVAILABLE_SENTENCE).toContain("审批服务不可用，请稍后重试");
    expect(SERVICE_UNAVAILABLE_SENTENCE).toContain("决定没有提交");
    expect(SERVICE_UNAVAILABLE_SENTENCE).not.toMatch(/已提交|已生效|成功|已完成|已记录/);
  });

  it("五句屏面词汇都不含裸码/裸枚举/英文原句", () => {
    const all = [NOT_APPROVER_SENTENCE, EXPIRED_SENTENCE, UNAVAILABLE_SENTENCE, SERVICE_UNAVAILABLE_SENTENCE];
    for (const s of all) {
      expect(s).not.toMatch(/approval[._]|not_approver|already_decided|expiredFrom|subject_mismatch|binding_invalid|already_consumed|not_approved|service_unavailable/i);
      expect(s).not.toMatch(/user is not an approver|approval not found|approval is /i);
    }
  });

  it("writeFailure 逐码优先于状态码档：同一 409 底下 expired 与无码 409 两句分明", () => {
    const expired = writeFailure(null, "approve", infoOf(bffError(409, CODE_EXPIRED, "approval expired", { expiredFrom: "pending" }, "req-e1")));
    const uncoded = writeFailure(null, "approve", infoOf(new ApiError("conflict", { status: 409, body: '{"code":"approval.key_conflict"}', url: DECISION_URL })));
    expect(expired.sentence).toBe(EXPIRED_SENTENCE);
    expect(uncoded.sentence).toContain("已经被处理过了");
    expect(expired.sentence).not.toBe(uncoded.sentence);
    // details 只进详情披露，不进句子。
    expect(expired.detailLines?.join(" ")).not.toBe(expired.sentence);
    expect(expired.detailLines?.[0]).toContain("expiredFrom=pending");
  });

  it("403 的 CSRF 拦截句仍优先（console.csrf_* 不被误读成非审批人）", () => {
    const csrf403 = new ApiError("origin", { status: 403, body: '{"code":"console.csrf_origin","message":"origin"}', url: DECISION_URL, requestId: "req-c" });
    const copy = writeFailure(null, "approve", infoOf(csrf403));
    expect(copy.sentence).not.toBe(NOT_APPROVER_SENTENCE);
    expect(copy.sentence).toContain("访问来源");
  });

  it("expiredDetailLines 三态：有值给原值／非字符串照实标／键缺失明说未带回／无 details 不摆行", () => {
    expect(expiredDetailLines({ expiredFrom: "approved" })).toEqual(["到期来源态 expiredFrom=approved（服务响应 details 原值）"]);
    expect(expiredDetailLines({ expiredFrom: null })).toEqual(["到期来源态 expiredFrom=null（服务响应 details 原值，非字符串）"]);
    expect(expiredDetailLines({ other: 1 })).toEqual(["到期来源态 expiredFrom 未随响应带回，这里不猜。"]);
    expect(expiredDetailLines(undefined)).toBeUndefined();
    expect(expiredDetailLines(null)).toBeUndefined();
  });

  it("readFailure 也走同一批单点句（读腿 503 与折叠码不分叉词汇）", () => {
    const read503 = readFailure(null, infoOf(bffError(503, CODE_SERVICE_UNAVAILABLE, "db down", undefined, "req-r503")));
    expect(read503.sentence).toBe(SERVICE_UNAVAILABLE_SENTENCE);
    const read404 = readFailure(null, infoOf(folded404()));
    expect(read404.sentence).toBe(UNAVAILABLE_SENTENCE);
    expect(read404.requestId).toBe("req-folded-001");
  });

  it("already_decided 回填票面复用 AP-05f 单点词汇，且不认领投票人（票可能不是本人投的）", () => {
    const detail = approvalDetailFrom(DECIDED_FACE);
    expect(detail).not.toBeNull();
    const face = alreadyDecidedFaceCopy(detail!, "approve", "req-409-rid");
    expect(face.sentence).toContain("已经被处理过了");
    expect(face.sentence).toContain(TRAIL_FACE_RECORDED);
    expect(face.sentence).toContain("不会产生第二票");
    // 票面三要素来自读回：投票人、结论、意见逐字进句子。
    expect(face.sentence).toContain("通过");
    expect(face.sentence).toContain("意见：同意对外");
    // 不写「你已经投过票」——那是 200 同键重放的话。
    expect(face.sentence).not.toContain("你已经投过票");
    // 回填票面是成功侧：措辞不出现失败词族。
    expect(face.sentence).not.toMatch(/失败|出错|没能/);
    expect(face.requestId).toBe("req-409-rid");
  });

  it("读回票面没有节点时不编票面：披露「票面节点未随响应带回」", () => {
    const detail = approvalDetailFrom({ ...DECIDED_FACE, decisions: [], status: "cancelled" });
    const face = alreadyDecidedFaceCopy(detail!, "reject", null);
    expect(face.sentence).toContain("票面节点未随响应带回");
    expect(face.requestId).toBeNull();
  });
});

/* ══════════════════ C. 分流（decisionOutcome：已决＝回填，不是失败） ══════════════════ */

describe("AP-06 C 写腿逐码分流", () => {
  it("409 already_decided → 回填票面（成功侧腿），POST 恰一次、GET 读回恰一次、触发列表重读", async () => {
    let posts = 0;
    let reads = 0;
    const outcome = await submitDecisionWithRecovery("ap_NEG0001", "approve", "同意", {
      post: async () => {
        posts += 1;
        throw bffError(409, CODE_ALREADY_DECIDED, "approval is approved", undefined, "req-dec-01");
      },
      readBack: async () => {
        reads += 1;
        return approvalDetailFrom(DECIDED_FACE);
      },
    });
    expect(outcome.kind).toBe("already-decided-face");
    expect(posts).toBe(1);
    expect(reads).toBe(1);
    if (outcome.kind !== "already-decided-face") throw new Error("unreachable");
    expect(outcome.reloadList).toBe(true);
    expect(outcome.face.sentence).toContain(TRAIL_FACE_RECORDED);
    expect(outcome.face.requestId).toBe("req-dec-01");
  });

  it("409 already_decided 但票面读不回 → 退回逐码失败句，不猜票面、仍不重试", async () => {
    let posts = 0;
    const outcome = await submitDecisionWithRecovery("ap_NEG0001", "approve", undefined, {
      post: async () => {
        posts += 1;
        throw bffError(409, CODE_ALREADY_DECIDED, "approval is approved");
      },
      readBack: async () => null,
    });
    expect(outcome.kind).toBe("failure");
    expect(posts).toBe(1);
    if (outcome.kind !== "failure") throw new Error("unreachable");
    expect(outcome.copy.sentence).toContain("已经被处理过了");
    expect(outcome.reloadTicket).toBe(true);
    expect(outcome.reloadList).toBe(true);
  });

  it("409 expired → 过期句＋列表重读＋票面重读，details 进披露，POST 恒一次", async () => {
    let posts = 0;
    const outcome = await submitDecisionWithRecovery("ap_NEG0001", "reject", undefined, {
      post: async () => {
        posts += 1;
        throw bffError(409, CODE_EXPIRED, "approval expired", { expiredFrom: "approved" }, "req-exp-02");
      },
      readBack: async () => approvalDetailFrom(PENDING_TICKET),
    });
    expect(outcome.kind).toBe("failure");
    expect(posts).toBe(1);
    if (outcome.kind !== "failure") throw new Error("unreachable");
    expect(outcome.copy.sentence).toBe(EXPIRED_SENTENCE);
    expect(outcome.copy.requestId).toBe("req-exp-02");
    expect(outcome.reloadList).toBe(true);
    expect(outcome.reloadTicket).toBe(true);
    expect(outcome.copy.detailLines?.[0]).toContain("expiredFrom=approved");
  });

  it("403 not_approver → 专句，不重读票面也不重读列表（更不改派代投）", async () => {
    const outcome = await submitDecisionWithRecovery("ap_NEG0001", "approve", undefined, {
      post: async () => {
        throw bffError(403, CODE_NOT_APPROVER, "user is not an approver", undefined, "req-403");
      },
      readBack: async () => approvalDetailFrom(DECIDED_FACE),
    });
    expect(outcome.kind).toBe("failure");
    if (outcome.kind !== "failure") throw new Error("unreachable");
    expect(outcome.copy.sentence).toBe(NOT_APPROVER_SENTENCE);
    expect(outcome.reloadTicket).toBe(false);
    expect(outcome.reloadList).toBe(false);
  });

  it("404 折叠体（not_found/consume 四码同体）→ 同一句，屏面分不出是哪一码", async () => {
    const folded = await submitDecisionWithRecovery("ap_NEG0001", "approve", undefined, {
      post: async () => {
        throw folded404("req-404");
      },
      readBack: async () => approvalDetailFrom(PENDING_TICKET),
    });
    expect(folded.kind).toBe("failure");
    if (folded.kind !== "failure") throw new Error("unreachable");
    expect(folded.copy.sentence).toBe(UNAVAILABLE_SENTENCE);
    expect(folded.copy.sentence).not.toMatch(/not_found|subject_mismatch|binding_invalid|already_consumed|not_approved/);
    expect(folded.reloadTicket).toBe(true);
    expect(folded.reloadList).toBe(false);
  });

  it("503 service_unavailable → 服务不可用句；不是成功腿、不重读、不乐观放行", async () => {
    const outcome = await submitDecisionWithRecovery("ap_NEG0001", "approve", undefined, {
      post: async () => {
        throw bffError(503, CODE_SERVICE_UNAVAILABLE, "db down", undefined, "req-503");
      },
      readBack: async () => approvalDetailFrom(DECIDED_FACE),
    });
    expect(outcome.kind).toBe("failure");
    if (outcome.kind !== "failure") throw new Error("unreachable");
    expect(outcome.copy.sentence).toBe(SERVICE_UNAVAILABLE_SENTENCE);
    expect(outcome.reloadTicket).toBe(false);
    expect(outcome.reloadList).toBe(false);
    expect(outcome.copy.requestId).toBe("req-503");
  });

  it("无码 409（AP-05f 的 key 冲突腿）形制不动：失败句＋零读回（回归护栏）", async () => {
    let reads = 0;
    const outcome = await submitDecisionWithRecovery("ap_NEG0001", "approve", "同意", {
      post: async () => {
        throw new ApiError("conflict", { status: 409, body: '{"code":"approval.key_conflict"}', url: DECISION_URL });
      },
      readBack: async () => {
        reads += 1;
        return approvalDetailFrom(DECIDED_FACE);
      },
    });
    expect(outcome.kind).toBe("failure");
    expect(reads).toBe(0);
  });
});

/* ══════════════════ D. 403≡404 同 body ＋ 强制态同形（真页面） ══════════════════ */

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

async function renderTree(entry: string, node: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter>);
  });
}

const qa = (id: string): Element | null => document.querySelector(`[data-testid="${id}"]`);

/** 队列直接答失败（读腿形制：列表/详情都按同一 isDenied 判据走 denied）。 */
const deniedHandler = (err: ApiError) => async (url: string) => {
  if (String(url).includes("/api/approvals")) throw err;
  throw err;
};

const deniedPanelText = async (err: ApiError): Promise<string> => {
  api.fetchJSON.mockImplementation(deniedHandler(err));
  await renderTree("/approvals", <ApprovalsPendingModulePage />);
  await waitFor(() => !!qa("apr5-denied"), "denied panel painted");
  return (qa("apr5-denied")?.textContent ?? "").replace(/\s+/g, " ").trim();
};

describe("AP-06 D 存在性折叠：403 与 404 渲染同一 body", () => {
  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    document.body.replaceChildren();
    api.fetchJSON.mockReset();
  });

  it("同请求号下 403 与 404 的面板文本逐字相等（不可用差异推断存在性）", async () => {
    const as403 = await deniedPanelText(new ApiError("nope", { status: 403, body: '{"code":"approval.not_approver","message":"user is not an approver"}', url: "/agent-api/api/approvals", requestId: "req-same" }));
    const as404 = await deniedPanelText(new ApiError("gone", { status: 404, body: '{"code":"approval.not_found","message":"approval not found"}', url: "/agent-api/api/approvals", requestId: "req-same" }));
    expect(as403).toBe(as404);
    expect(as403).not.toMatch(/403|404/);
  });

  it("denied 面板逐字＝stateCopy 单点（标题＋正文＋请求号行），且零行数据", async () => {
    await deniedPanelText(new ApiError("nope", { status: 403, body: '{"code":"approval.not_approver","message":"user is not an approver"}', url: "/agent-api/api/approvals", requestId: "req-same" }));
    const panel = qa("apr5-denied");
    expect(panel?.textContent).toContain(APPROVAL_DENIED_TITLE);
    expect(panel?.textContent).toContain(APPROVAL_DENIED_BODY);
    expect(panel?.textContent).toContain("req-same");
    expect(panel?.textContent).not.toContain("approval.not_approver");
    expect(panel?.querySelectorAll("[data-testid^='apr5-row-']")).toHaveLength(0);
    expect(document.querySelectorAll("[data-testid^='apr5-row-']")).toHaveLength(0);
  });

  it("?state=denied 强制态与真 403 同形（同一面板、同一批常量、同一请求号载体）", async () => {
    // 真 403 这次**没有**带回 X-Console-Request-Id：与强制态一样走「未记录编号」
    // 兜底 ⇒ 两面板整块文本必须逐字相等。带号的那次另测（下一条）：号是每次请求
    // 自己的真值，不同请求同号才是假的。
    const real = await deniedPanelText(new ApiError("nope", { status: 403, body: '{"code":"approval.not_approver","message":"user is not an approver"}', url: "/agent-api/api/approvals" }));
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => ({ items: [], nextCursor: null }));
    await renderTree("/approvals?state=denied", <ApprovalsPendingModulePage />);
    await waitFor(() => !!qa("apr5-denied"), "forced denied painted");
    const forced = (qa("apr5-denied")?.textContent ?? "").replace(/\s+/g, " ").trim();
    expect(forced).toBe(real);
    expect(forced).toContain(APPROVAL_DENIED_TITLE);
    expect(forced).toContain(APPROVAL_DENIED_BODY);
    expect(forced).toContain(APPROVAL_RID_FALLBACK);
    // 强制态仍是强制态：复现标注在同屏，不冒充服务的回答。
    expect(qa("apr5-forced-note")).toBeTruthy();
    expect(api.fetchJSON).not.toHaveBeenCalled();
  });

  it("真 403 带回请求号时，面板仍只有那一批常量句（号进号位、不改正文）", async () => {
    const withRid = await deniedPanelText(new ApiError("nope", { status: 403, body: '{"code":"approval.not_approver","message":"user is not an approver"}', url: "/agent-api/api/approvals", requestId: "req-real-403" }));
    expect(withRid).toContain("req-real-403");
    expect(withRid).toContain(APPROVAL_DENIED_TITLE);
    expect(withRid).toContain(APPROVAL_DENIED_BODY);
    expect(withRid).not.toContain(APPROVAL_RID_FALLBACK);
  });
});

/* ══════════════════ E. 渲染：失败句＋请求号可复制＋无裸码上屏 ══════════════════ */

const writeCopyOf = (err: ApiError): FailureCopy => writeFailure(err, "approve", infoOf(err));

async function mountPanel(node: ReactNode): Promise<void> {
  await renderTree("/approvals", node);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const stubClipboard = (): ReturnType<typeof vi.fn> => {
  const writeText = vi.fn(async () => {});
  Object.defineProperty(window.navigator, "clipboard", { configurable: true, value: { writeText } });
  return writeText;
};

describe("AP-06 E 逐码失败句的屏面实态", () => {
  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    document.body.replaceChildren();
  });

  const cases: Array<{ name: string; err: ApiError; sentence: string }> = [
    { name: "403 not_approver", err: bffError(403, CODE_NOT_APPROVER, "user is not an approver", undefined, "req-a403"), sentence: NOT_APPROVER_SENTENCE },
    { name: "409 expired", err: bffError(409, CODE_EXPIRED, "approval expired", { expiredFrom: "approved" }, "req-a409e"), sentence: EXPIRED_SENTENCE },
    { name: "404 folded unavailable", err: folded404("req-a404"), sentence: UNAVAILABLE_SENTENCE },
    { name: "503 service_unavailable", err: bffError(503, CODE_SERVICE_UNAVAILABLE, "db down", undefined, "req-a503"), sentence: SERVICE_UNAVAILABLE_SENTENCE },
  ];

  for (const c of cases) {
    it(`${c.name}：句子逐字上屏、请求号真值可复制、屏面无裸码/裸枚举/英文原句`, async () => {
      const copy = writeCopyOf(c.err);
      expect(copy.sentence).toBe(c.sentence);
      const clip = stubClipboard();
      await mountPanel(<InlineFailure failure={copy} action="决定没有提交" onRetry={() => {}} />);
      const surface = document.body.textContent ?? "";
      expect(surface).toContain(c.sentence);
      expect(qa("apr5-request-id")?.textContent).toBe(c.err.requestId);
      expect(surface).toContain("请求编号：");
      const button = qa("apr5-copy-request-id") as HTMLButtonElement | null;
      expect(button, "copy control present").toBeTruthy();
      await act(async () => {
        button!.click();
      });
      expect(clip).toHaveBeenCalledWith(c.err.requestId);
      // 折叠态屏面不含裸码/裸枚举/服务英文原句。
      expect(surface).not.toMatch(/approval\.[a-z_]+|expiredFrom|user is not an approver|approval expired|db down|not actionable/i);
      // 工程值没丢：展开「详情」后才出现。
      const toggle = document.querySelector(`[data-testid="apr5-inline-failure-details"] button`) as HTMLButtonElement | null;
      expect(toggle, "details disclosure present").toBeTruthy();
      await act(async () => {
        toggle!.click();
      });
      const opened = document.body.textContent ?? "";
      expect(opened).toMatch(/HTTP 40[349]|HTTP 503/);
      if (c.name === "409 expired") {
        expect(opened).toContain("expiredFrom=approved");
      }
    });
  }

  it("请求号缺席时出全站同形兜底句，且不给复制钮（值没来过就不编一个）", async () => {
    const copy = writeCopyOf(new ApiError("no rid", { status: 503, body: '{"code":"approval.service_unavailable","message":"db down"}', url: DECISION_URL }));
    expect(copy.requestId).toBeNull();
    await mountPanel(<InlineFailure failure={copy} action="决定没有提交" />);
    const surface = document.body.textContent ?? "";
    expect(surface).toContain(APPROVAL_RID_FALLBACK);
    expect(surface).not.toContain("未提供");
    expect(qa("apr5-request-id")).toBeNull();
    expect(qa("apr5-copy-request-id")).toBeNull();
  });

  it("回填票面腿（already_decided）的屏面：成功侧载体带句子与请求号，无 alert、无失败词", async () => {
    const detail = approvalDetailFrom(DECIDED_FACE);
    const face = alreadyDecidedFaceCopy(detail!, "approve", "req-face-01");
    await mountPanel(
      <div role="status" data-testid="apr5-decision-face">
        <p data-testid="apr5-decision-face-sentence">{face.sentence}</p>
        {face.requestId ? <RequestIdCopyField requestId={face.requestId} fallback={APPROVAL_RID_FALLBACK} /> : null}
      </div>,
    );
    const surface = document.body.textContent ?? "";
    expect(surface).toContain(TRAIL_FACE_RECORDED);
    expect(surface).not.toMatch(/失败|出错|没能/);
    expect(surface).not.toMatch(/approval\.already_decided|approval is approved/);
  });

  it("详情面板（ErrorPanel）走同一批载体：句子＋可复制请求号", async () => {
    const copy = readFailure(null, infoOf(folded404("req-detail-404")));
    const clip = stubClipboard();
    await mountPanel(<ErrorPanel failure={copy} onRetry={() => {}} />);
    expect(qa("apr5-request-id")?.textContent).toBe("req-detail-404");
    await act(async () => {
      (qa("apr5-copy-request-id") as HTMLButtonElement).click();
    });
    expect(clip).toHaveBeenCalledWith("req-detail-404");
    expect(document.body.textContent).toContain(UNAVAILABLE_SENTENCE);
  });

  it("DeniedPanel 即便带着逐码失败句也只有一个 body（句子不混进拒绝面）", async () => {
    const copy = writeCopyOf(bffError(403, CODE_NOT_APPROVER, "user is not an approver", undefined, "req-d403"));
    await mountPanel(<DeniedPanel failure={copy} />);
    const surface = document.body.textContent ?? "";
    expect(surface).toContain(APPROVAL_DENIED_BODY);
    expect(surface).not.toContain(NOT_APPROVER_SENTENCE);
    expect(surface).not.toMatch(/approval\.not_approver|user is not an approver/);
  });
});
