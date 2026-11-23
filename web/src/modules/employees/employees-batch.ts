/**
 * PE-09 · 员工批量操作的写侧形状（逐 id 流转 + 前端限并发 + 如实汇总）。
 *
 * 现网取证（2026-11-24 本机，curl 原文见 DONE-PE-09.md）：
 *  - 域 `POST /v1/employees/{id}/transitions` 已活（services/domain/http_app.py:166-184）；
 *  - BFF 侧写路由 **未注册**：`RESOURCE_WRITE_ROUTES`（apps/console/server.py:212-244）
 *    不含 `/api/employee-transition`，落到 `_reject_write` ⇒ 带会话 cookie 的 POST 恒回
 *    `405 {"code":"console.read_only","message":"first console is read-only; only GET/HEAD allowed"}`。
 *    所以本文件的 submit 在现网只会拿到 405；UI 侧按钮按「未接入」disabled+原因，
 *    点击零请求零 toast（PRD §8.1-5 假成功禁令）。解除等 T-PE-E（D 车道代理单）。
 *  - 目标态枚举冻结在 services/domain/schemas/employee_models.py:102-108 的六态
 *    （draft/onboarding/active/paused/offboarding/archived）。批量文案必须**报目标态**，
 *    禁用「启用/停用」这类读口里根本不存在的臆造动作词。
 *  - 流转影响可上岗率分母（PRD v4 §2）：分母 = lifecycle ∈ {active, paused, offboarding}，
 *    draft/onboarding/archived 不入分母 ⇒ 动作条必须把这条披露出来。
 *
 * 纪律：一单失败不断整批；前端限并发 `BATCH_CONCURRENCY`（与 PE-14 遍历限流同档）；
 * 不重试（400/409 是语义结论，重放只会撞幂等冲突）；失败原因逐字透传上游 code/message。
 */

/** 与 PE-14 同档的并发上限：批量写口在前端限流，不靠服务端 429 兜。 */
export const BATCH_CONCURRENCY = 2;

/** BFF 代理端点（path_from_body 形制：employeeId 从体里拼路径，同 identity-links 先例）。 */
export const EMPLOYEE_TRANSITION_ENDPOINT = "/agent-api/api/employee-transition";

/** 域冻结六态（employee_models.py:102-108）；顺序 = 动作条里目标态的呈现顺序。 */
export const LIFECYCLE_TARGET_STATES = [
  "draft",
  "onboarding",
  "active",
  "paused",
  "offboarding",
  "archived",
] as const;

export type LifecycleTarget = (typeof LIFECYCLE_TARGET_STATES)[number];

export type BatchItemResult = {
  employeeId: string;
  ok: boolean;
  /** 失败时的逐字原因（上游 code：message）；成功为 null。 */
  reason: string | null;
};

export type BatchSummary = {
  total: number;
  succeeded: number;
  failed: number;
  results: BatchItemResult[];
};

export type TransitionBody = {
  employeeId: string;
  to: string;
  reason: string;
};

/** 动作条的原因句（禁用腿逐字钉在触点上，与 title 同一来源）。 */
export const TRANSITION_WRITE_NOTE =
  "流转写接口未接入（POST /api/employee-transition 现 405 console.read_only，等 T-PE-E）";

/** 405 逐字来自现网应答体；只作「未接入」判据，不当成业务失败去重试。 */
export function isReadOnlyRejection(status: number): boolean {
  return status === 405;
}

/**
 * 逐 id 串行提交、并发上限 2 的批量流转执行器。
 * `post` 注入以便 jsdom 在无写路由的环境里锁聚合形态（成功 n/失败 m + 逐字原因），
 * 生产走 fetchJSON。永不因一单失败中断整批；不自动重试。
 */
export async function runBatchTransitions(
  ids: readonly string[],
  input: {
    to: string;
    reason: string;
    /** 一趟提交的应答形状由调用侧决定；抛错即判失败。 */
    post: (employeeId: string, body: TransitionBody) => Promise<unknown>;
    concurrency?: number;
  },
): Promise<BatchSummary> {
  const limit = Math.max(1, input.concurrency ?? BATCH_CONCURRENCY);
  const results: (BatchItemResult | undefined)[] = new Array(ids.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= ids.length) return;
      const employeeId = ids[index]!;
      const body: TransitionBody = { employeeId, to: input.to, reason: input.reason };
      try {
        await input.post(employeeId, body);
        results[index] = { employeeId, ok: true, reason: null };
      } catch (err: unknown) {
        results[index] = { employeeId, ok: false, reason: failureQuote(err) };
      }
    }
  };

  const pool: Promise<void>[] = [];
  for (let i = 0; i < Math.min(limit, ids.length); i += 1) pool.push(worker());
  await Promise.all(pool);

  const filled = results.filter((r): r is BatchItemResult => r !== undefined);
  return {
    total: ids.length,
    succeeded: filled.filter((r) => r.ok).length,
    failed: filled.filter((r) => !r.ok).length,
    results: filled,
  };
}

/** 「成功 n / 失败 m」主句：全成就只报成功数，绝不写「失败 0」这种凑数句。 */
export function batchHeadline(summary: BatchSummary): string {
  if (summary.failed === 0) return `成功 ${summary.succeeded} / 共 ${summary.total} 单`;
  return `成功 ${summary.succeeded} / 失败 ${summary.failed}`;
}

/** 逐单行：短码 + 结论 +（失败时）逐字原因。缺原因就写「未给出原因」，不编造。 */
export function batchLine(
  result: BatchItemResult,
  labelOf: (employeeId: string) => string,
): string {
  const who = labelOf(result.employeeId);
  if (result.ok) return `${who}：已提交`;
  return `${who}：${result.reason ?? "上游未给出原因"}`;
}

/** 失败原因逐字化：上游体的 code/message 优先，退回人话句；非 JSON 体原样（截 200）。 */
export function failureQuote(err: unknown): string {
  const api = err as { status?: number; body?: string; message?: string } | null;
  const body = api?.body;
  if (typeof body === "string" && body.trim()) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const rec = parsed as Record<string, unknown>;
        const code = typeof rec.code === "string" ? rec.code : null;
        const message = typeof rec.message === "string" ? rec.message : null;
        if (code && message) return `${code}：${message}`;
        if (message) return message;
        if (code) return code;
        const detail = rec.detail;
        if (typeof detail === "string" && detail.trim()) return detail.trim();
      }
    } catch {
      /* 非 JSON：下面退回 message */
    }
  }
  const message = api?.message;
  if (typeof message === "string" && message.trim()) {
    return message.trim().length > 200 ? `${message.trim().slice(0, 200)}…` : message.trim();
  }
  return "上游未给出原因";
}
