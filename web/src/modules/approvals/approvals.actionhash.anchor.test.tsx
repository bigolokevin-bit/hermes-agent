// @vitest-environment jsdom
/**
 * AP-05 锚定腿 — 动作指纹「存在但核验不了／与票面记录对不上」的保守禁用。
 *
 * 工单 §AP-05 目标要求 action_hash 作为**读侧锚点参与可用性判定**：缺 hash 与
 * 形态非法都⇒禁用并给原因。已交付面（ebd88ad72f）只做了前者，本件钉后者。
 *
 * 判据不靠臆想，逐条锚在现网读腿实测上（2026-11-24，opsadmin 会话，
 * GET /api/approvals?status=all&limit=50 → 16 行 + 逐行 GET /api/approval?id=）：
 * - 真形制只有三族：64 位十六进制摘要（域 util.digest L47-48）、`sha256:`+64 位、
 *   `th_`+32 位（域 compute_target_hash L213）；屏上截断显示产生的 41/46 位前缀
 *   仍是十六进制摘要体 ⇒ 判可核验（把截断判非法会误伤现网）。
 * - 现网真有两行「体不是摘要」：`sha256:apr02`（体 5 位）、`sha256:p07grant`
 *   （体 8 位含 p/g/r/n/t）⇒ 这就是「存在但形态非法」的活体形制，不是假想敌。
 * - 票面指纹比对源：详情 `decisions[]` 全部 7 张真票的 key-set 恒为
 *   {comment,decidedAt,userId,verdict}（域 _decisions L337-346）⇒ 无任何可比来源，
 *   按诚实形制给「比对不可用」，**不声称一致、也不据此禁用**。
 * 测试面 stub 返回值合法（实测 camel 键族），不新增样例行。
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";
import { CsrfMissingError, failureInfo, isUnknownOutcome } from "@/modules/approvals/api";
import { submitDecisionWithRecovery } from "@/modules/approvals/decisionOutcome";
import { approvalDetailFrom } from "@/modules/approvals/model";
import {
  ACTION_HASH_COMPARE_UNAVAILABLE_NOTE,
  ACTION_HASH_INVALID_SHAPE_REASON,
  ACTION_HASH_MISSING_REASON,
  ACTION_HASH_MISMATCH_REASON,
  DECISION_GATE,
  decisionBlockReasons,
  hashConsistency,
  hashConsistencyNote,
  invalidShapeReasonFor,
  missingHashReasonFor,
} from "@/modules/approvals/writeGate";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import ApprovalsPendingModulePage from "@/modules/approvals/ApprovalsPendingModulePage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/* ───────────────── 现网实测的十六进制摘要（逐字符取自真响应） ───────────────── */

/** 全 64 位 sha256（detail ap_AEEC078E0C824E749513AFEC9A 的 argsDigest 原值）。 */
const REAL64 = "22eadfcebfdaa88b5451bb8622503c876ddfd7418e692056baa29786bb9fb63f";
/** 同一摘要带算法前缀（ap_7D484B3F…、ap_C4D72B02…）。 */
const SCHEMED64 = `sha256:${REAL64}`;
/** 域 compute_target_hash 的截断形制（16/16 行的 binding.targetHash）。 */
const TH32 = "th_613fa83410a35d2c90c0470882766528";
/** 屏上截断显示产生的 41/46 位十六进制前缀（既有测试与真值同族）。 */
const TRUNC46 = "6d39a99d3d435a268bbb448ee333ee02e35c93cc7f9ed2a";

/* ───────────────────── A. 形制判据（纯逻辑腿） ───────────────────── */

describe("AP-05 锚定腿 A：形态非法⇒无法核验，三族真形制⇒可核验", () => {
  it("现网三族真形制与截断显示全部判可核验：两条数据侧原因都不出现", () => {
    // 大写十六进制是同一摘要的另一种写法，可核验性不变（现网恒为小写）。
    for (const value of [REAL64, SCHEMED64, TH32, TRUNC46, REAL64.toUpperCase()]) {
      expect(missingHashReasonFor(value), `缺失句误报: ${value}`).toBeNull();
      expect(invalidShapeReasonFor(value), `非法句误报: ${value}`).toBeNull();
    }
  });

  it("现网真实的非摘要体（sha256:apr02 / sha256:p07grant）判无法核验并给原因；缺失句不与之并存", () => {
    for (const value of ["sha256:apr02", "sha256:p07grant"]) {
      expect(invalidShapeReasonFor(value)).toBe(ACTION_HASH_INVALID_SHAPE_REASON);
      // 互斥：有值就不是「没给出」，两句不许同时出现。
      expect(missingHashReasonFor(value)).toBeNull();
    }
  });

  it("其它非摘要形制一律保守判无法核验（裸词、前缀对体不对、短于摘要下限）", () => {
    for (const value of ["hash", "sha256:notadigest", "22ea", "sha256:", "th_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"]) {
      expect(invalidShapeReasonFor(value), `放过: ${value}`).toBe(ACTION_HASH_INVALID_SHAPE_REASON);
    }
  });

  it("null／空串／纯空白＝缺失腿（原判据不动），不落入非法腿", () => {
    for (const value of [null, "", "   "]) {
      expect(missingHashReasonFor(value)).toBe(ACTION_HASH_MISSING_REASON);
      expect(invalidShapeReasonFor(value)).toBeNull();
    }
  });

  it("禁用原因单点按序：写通道句在前，数据侧一句在后；可核验指纹只剩写通道句", () => {
    expect(decisionBlockReasons("sha256:apr02")).toEqual([
      DECISION_GATE.title,
      ACTION_HASH_INVALID_SHAPE_REASON,
    ]);
    expect(decisionBlockReasons(REAL64)).toEqual([DECISION_GATE.title]);
    expect(decisionBlockReasons(null)).toEqual([DECISION_GATE.title, ACTION_HASH_MISSING_REASON]);
  });
});

/* ───────────────── B. 票面记录一致性腿（诚实形制） ───────────────── */

describe("AP-05 锚定腿 B：与票面记录比对——无源不推断，有源才判", () => {
  it("票面没记录任何指纹（现网实态）＝比对不可用：既不声称一致，也不进禁用原因", () => {
    expect(hashConsistency(REAL64, [])).toEqual({ state: "unavailable" });
    expect(hashConsistency(REAL64, [null, "", "  "])).toEqual({ state: "unavailable" });
    expect(hashConsistencyNote(hashConsistency(REAL64, []))).toBe(ACTION_HASH_COMPARE_UNAVAILABLE_NOTE);
    expect(decisionBlockReasons(REAL64, [])).toEqual([DECISION_GATE.title]);
  });

  it("指纹本身缺失或核验不了＝一致性无从谈起，不许假装比对", () => {
    for (const value of [null, "sha256:apr02"]) {
      expect(hashConsistency(value, [REAL64])).toEqual({ state: "not-applicable" });
      expect(hashConsistencyNote(hashConsistency(value, [REAL64]))).toBe("");
    }
  });

  it("票面指纹与本单相同＝一致（实话，不进禁用原因）", () => {
    expect(hashConsistency(REAL64, [REAL64, `  ${REAL64} `])).toEqual({ state: "consistent" });
    const note = hashConsistencyNote(hashConsistency(REAL64, [REAL64]));
    expect(note).not.toBe("");
    expect(note).not.toBe(ACTION_HASH_COMPARE_UNAVAILABLE_NOTE);
    expect(decisionBlockReasons(REAL64, [REAL64])).toEqual([DECISION_GATE.title]);
  });

  it("任一票面指纹对不上＝不一致：保守禁用并给原因", () => {
    expect(hashConsistency(REAL64, [REAL64, TH32])).toEqual({ state: "mismatch" });
    expect(decisionBlockReasons(REAL64, [REAL64, TH32])).toEqual([
      DECISION_GATE.title,
      ACTION_HASH_MISMATCH_REASON,
    ]);
  });
});

/* ───────── C. 结果未知的两类（超时／断连）都先读回，不盲发第二次 ───────── */

describe("AP-05 ③ 核验：超时与断连两类未知都走读回腿", () => {
  /** 超时腿形制：请求出网没答复＝ApiError status 0（既有测试钉过 POST 计数）。 */
  const timeout = () =>
    new ApiError("network", { status: 0, body: "", url: "/agent-api/api/approval/decision?id=ap_ANCHOR1" });
  /**
   * 断连腿形制：传输层直接抛出**非 ApiError**（浏览器 `TypeError: Failed to fetch`），
   * failureInfo 归 status -1（api.ts:253）。已交付面只钉了超时那一类，这一类此前
   * 无测试——判据写着 0|-1，腿只测了 0，本件补上。
   */
  const disconnect = () => new TypeError("Failed to fetch");

  it("两类未知都判未知；服务答了话的失败与拦在网络前的 CSRF 都不算", () => {
    expect(isUnknownOutcome(timeout(), failureInfo(timeout()))).toBe(true);
    expect(isUnknownOutcome(disconnect(), failureInfo(disconnect()))).toBe(true);
    // 答了话＝已知结果，走逐码句，不许去读回。
    const answered = new ApiError("bad", { status: 502, body: "", url: "/x" });
    expect(isUnknownOutcome(answered, failureInfo(answered))).toBe(false);
    // CSRF 拦在网络前：确定没送出，读回是多余的。
    const csrf = new CsrfMissingError();
    expect(isUnknownOutcome(csrf, failureInfo(csrf))).toBe(false);
  });

  for (const [label, make] of [
    ["超时（status 0）", timeout],
    ["断连（非 ApiError 传输异常）", disconnect],
  ] as const) {
    it(`${label} ⇒ 恰好一次 GET 读回、POST 计数=1、不乐观放行`, async () => {
      let posts = 0;
      let reads = 0;
      const outcome = await submitDecisionWithRecovery("ap_ANCHOR1", "approve", undefined, {
        post: async () => {
          posts += 1;
          throw make();
        },
        readBack: async () => {
          reads += 1;
          return approvalDetailFrom({ approvalId: "ap_ANCHOR1", title: "发布数字员工新版本", status: "pending" });
        },
      });
      expect(posts).toBe(1);
      expect(reads).toBe(1);
      // 票面没落定＝如实未知，绝不替用户宣称成功。
      expect(outcome.kind).toBe("readback-pending");
    });
  }
});

/* ───────────────── D. 决策区渲染腿（页面级形制） ───────────────── */

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
  items: [{ approvalId: "ap_ANCHOR1", title: "发布数字员工新版本", status: "pending" }],
  nextCursor: null,
};

/** 详情 stub：指纹值与票面指纹由参数决定（键族形制=实测 camel 键）。 */
function detailOf(args: { hash: string | null; voteHashes?: (string | null)[] }): Record<string, unknown> {
  const base: Record<string, unknown> = {
    approvalId: "ap_ANCHOR1",
    title: "发布数字员工新版本",
    status: "pending",
    riskLevel: "medium",
    requestedBy: { type: "user", id: "1" },
    approvers: [{ userId: "human:10", name: "郑涛" }],
    decisions: (args.voteHashes ?? []).map((h, i) => ({
      userId: `human:${10 + i}`,
      verdict: "approve",
      decidedAt: "2026-11-24T01:00:00Z",
      ...(h === null ? {} : { actionHash: h }),
    })),
  };
  return args.hash === null ? base : { ...base, argsDigest: args.hash };
}

async function openDrawer(args: { hash: string | null; voteHashes?: (string | null)[] }): Promise<void> {
  api.fetchJSON.mockImplementation(async (url: string) => {
    if (String(url).includes("/api/approval?")) return detailOf(args);
    return QUEUE;
  });
  await render("/approvals", <ApprovalsPendingModulePage />);
  await waitFor(() => !document.querySelector(".animate-pulse"), "queue settled");
  const opener = document.querySelector(
    "[data-testid='apr5-row-ap_ANCHOR1'] button:not([data-testid^='apv9'])",
  ) as HTMLButtonElement;
  expect(opener, "row opener present").toBeTruthy();
  await act(async () => {
    opener.click();
  });
  await waitFor(() => !!qa("apr5-actions-readonly-note"), "drawer actions settled");
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
  api.fetchJSON.mockReset();
});

describe("AP-05 锚定腿 D：决策区把三条读数各说各的", () => {
  it("指纹存在但核验不了（现网 apr02/p07grant 形制）＝非法句上屏、缺失句不出现", async () => {
    await openDrawer({ hash: "sha256:apr02" });
    const note = qa("apr5-actions-hash-invalid-note");
    expect(note, "invalid-shape reason rendered").toBeTruthy();
    expect(note!.textContent?.trim()).toBe(ACTION_HASH_INVALID_SHAPE_REASON);
    expect(qa("apr5-actions-hash-missing-note"), "缺失句不与非法句并存").toBeNull();
  });

  it("票面没记录指纹＝只给「比对不可用」，不声称已确认一致", async () => {
    await openDrawer({ hash: REAL64 });
    const note = qa("apr5-actions-hash-compare-note");
    expect(note, "比对不可用句上屏").toBeTruthy();
    expect(note!.textContent?.trim()).toBe(ACTION_HASH_COMPARE_UNAVAILABLE_NOTE);
    // 诚实红线：无源时不许声称核对通过（句里可以说「比对做不了」，不能给出相符结论）。
    expect(note!.textContent).not.toMatch(/相符|一致通过|已确认|核对通过|没有差异/);
    expect(note!.textContent).toMatch(/做不了|无法/);
    expect(qa("apr5-actions-hash-invalid-note")).toBeNull();
  });

  it("票面指纹与本单对不上＝不一致句上屏（保守禁用并给原因）", async () => {
    await openDrawer({ hash: REAL64, voteHashes: [TH32] });
    const note = qa("apr5-actions-hash-mismatch-note");
    expect(note, "mismatch reason rendered").toBeTruthy();
    expect(note!.textContent?.trim()).toBe(ACTION_HASH_MISMATCH_REASON);
  });

  it("三条数据侧腿都不许把决策钮点亮：三属性仍单源 DECISION_GATE（AP-07② 契约）", async () => {
    for (const args of [
      { hash: "sha256:apr02" as string | null },
      { hash: null },
      { hash: REAL64, voteHashes: [TH32] },
    ]) {
      await openDrawer(args);
      const approve = Array.from(document.querySelectorAll("button")).find((b) =>
        (b.textContent ?? "").includes("批准"),
      ) as HTMLButtonElement;
      expect(approve.disabled).toBe(true);
      expect(approve.getAttribute("aria-disabled")).toBe("true");
      expect(approve.getAttribute("title")).toBe(DECISION_GATE.title);
    }
  });
});
