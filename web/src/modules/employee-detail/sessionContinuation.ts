/**
 * SE-05 · 会话续跑写口封装 — POST /agent-api/api/console-sessions/{sessionId}/messages
 *
 * 契约（CONSOLE-SESSIONS-SHAPE.md §4 + 主仓 BFF `apps/console/server.py`
 * `_session_messages_write` L2293-2307「L7 首刀 A」，2026-11-24 真 BFF
 * 127.0.0.1:8092 opsadmin 实测，原文存本卡 worktree evidence/）：
 *
 *  - **幂等凭据 = 请求体 `requestId`**（客户端生成、≤200 字符、同一条消息重试
 *    必须复用同一个）。BFF 源码自述「契约体自带 requestId，因此不要求
 *    Idempotency-Key 头」；实测带不带该头行为一致（首送 201、同 requestId
 *    重放 200、库内恒一对）。本封装两样都发：body requestId 是唯一的真凭据，
 *    `Idempotency-Key` 头取同一值，对齐仓内既有写门形制
 *    （employees/tasks 的 `_resource_write` 腿），绝不假称另有一把锁。
 *  - 体只有 `requestId`/`content` 两键——**没有 role**：角色由服务端成对落库
 *    决定（user=MAX(seq)+1、assistant=+2，同事务），表单因此不提供角色选择，
 *    前端也不写 role（工单「仅 assistant/user 两角色」= 词汇面只有这两个，
 *    第三个角色值属于造假，屏上未知 role 只照实+待核实）。
 *  - BFF 门序：身份 fail-closed → CSRF 同源+双提交（`X-Console-CSRF` 双提交
 *    头，复用 `@/lib/csrf` 单点）→ 体校验（requestId 非空、content 1..4000）
 *    → 原样单次转发，不重试。**详情裸路径的 POST 维持 405**（既有服务端
 *    事实，非审批开关），本封装只 POST `/messages`，测试钉死。
 *  - 成功（201/200）回 turn 载荷；上游任何失败 **一行不落**；502 属
 *    「未落库可重试」，网络断连属「结果未知」——两者重试都复用同一 requestId。
 *  - 前向兼容：turn 载荷与详情响应里未知字段一律忽略不崩。
 */
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { csrfFailureCopy, csrfWriteHeaders } from "@/lib/csrf";

export const CONTENT_MAX = 4000; // BFF `_session_messages_write` 关三口径（实测 ≤4000 放行）

export const sessionDetailPath = (sessionId: string): string =>
  `/agent-api/api/console-sessions/${encodeURIComponent(sessionId)}`;

/** 唯一的续跑写口。裸详情路径 POST 会拿 405（只读），禁对那个形态发送。 */
export const sessionMessagesUrl = (sessionId: string): string =>
  `${sessionDetailPath(sessionId)}/messages`;

/** 每轮编辑一把新请求号；重试同一条必须复用（这是防重复落库的唯一凭据）。 */
export function newRequestId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return `se05-${c.randomUUID()}`;
  return `se05-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type TurnPayload = {
  /** null ⇒ 载荷没带可解析的 sessionId（不编造）。 */
  sessionId: string | null;
  requestId: string | null;
  userSeq: number | null;
  assistantSeq: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function seqOf(value: unknown): number | null {
  const rec = isRecord(value) ? value : {};
  return typeof rec.seq === "number" && Number.isFinite(rec.seq) ? rec.seq : null;
}

/** turn 载荷读取：未知字段忽略；缺键不折 0、不猜。 */
export function parseTurnPayload(body: unknown): TurnPayload {
  const rec = isRecord(body) ? body : {};
  return {
    sessionId: typeof rec.sessionId === "string" && rec.sessionId ? rec.sessionId : null,
    requestId: typeof rec.requestId === "string" && rec.requestId ? rec.requestId : null,
    userSeq: seqOf(rec.userMessage),
    assistantSeq: seqOf(rec.assistantMessage),
  };
}

export type SendOutcome =
  | { ok: true; turn: TurnPayload }
  | {
      ok: false;
      /** 人话句（单点，见 copy 表）。裸码/裸英文信封绝不上屏。 */
      sentence: string;
      /** 「结果未知」＝断连/超时：可能已落库，重试复用同键、禁改体。 */
      unknown: boolean;
      requestId: string | null;
    };

export type SendFailureCopy = { sentence: string; unknown: boolean };

/**
 * 状态码→专句单点。每句都来自实测/源码事实：
 * - 405：`console.read_only` 逐字实测于裸详情路径（curl 腿②），消息口拿 405
 *   只可能是部署未放行——诚实告知「这一形态没开」，不假装排队；
 * - 409：`console_session.conflict`（形状文档 §5 ULID 碰撞族）——本次零新增；
 * - 502：`hermes.unavailable`——契约明写「一行消息都不落」，可放心同键重试；
 * - 403 拆 CSRF 两种（复用 `@/lib/csrf` 单点句）与授权拒绝；
 * - 0/断连：结果未知，屏上绝不显「已发送」。
 */
export function sendFailureCopy(err: unknown): SendFailureCopy {
  if (err instanceof ApiError) {
    const csrf = csrfFailureCopy(err.status, err.body, err.requestId);
    if (csrf) return { sentence: csrf.sentence, unknown: false };
    switch (err.status) {
      case 401:
        return { sentence: "登录状态缺失或已过期，请先重新登录再续跑。", unknown: false };
      case 403:
        return {
          sentence: "服务端拒绝这次写入：当前账号没有该会话的写入授权（或页面令牌不匹配）。",
          unknown: false,
        };
      case 404:
        return {
          sentence: "这个会话写不进去：它不存在，或你没有权限看到它——两种情况的答复完全相同，这里不做区分。",
          unknown: false,
        };
      case 405:
        return {
          sentence:
            "这个部署没有对当前形态放行写入（服务端逐字答复：first console is read-only; only GET/HEAD allowed）。" +
            "消息没有发出去，本页不会排队重发。",
          unknown: false,
        };
      case 409:
        return {
          sentence: "这一条与会话里已有的一次写入冲突（同一请求号已落库），本次没有新增消息。",
          unknown: false,
        };
      case 422:
        return { sentence: "服务端认为这条消息不合形状，已在校验阶段拒绝，没有落库。", unknown: false };
      case 502:
      case 503:
        return {
          sentence: "上游这一轮没有答上来。按契约，失败的一轮一行消息都不落库；稍后可用同一请求号重试。",
          unknown: false,
        };
      case 0:
        return {
          sentence: "请求没有拿到答复（连接中断或超时）——发送结果未知，不能算成功也不能算失败。重试会复用同一请求号。",
          unknown: true,
        };
      default:
        return { sentence: `发送没有成功（HTTP ${err.status}）。`, unknown: false };
    }
  }
  return {
    sentence: "发送没有成功：本机没能完成这次请求。重试会复用同一请求号。",
    unknown: true,
  };
}

export type SendInput = {
  requestId: string;
  content: string;
  signal?: AbortSignal;
};

/** 无会话写入令牌（缺 CSRF cookie）⇒ 不发网络，直接一句人话（与 approvals 同款纪律）。 */
export class NoWriteSessionError extends Error {
  constructor() {
    super("需要登录后才能提交。当前没有可用的写入会话，请先登录。");
    this.name = "NoWriteSessionError";
  }
}

/** 一次发送。成功返回 turn 载荷；失败返回人话句。绝不 throw 给未接住的地方。 */
export async function sendSessionMessage(sessionId: string, input: SendInput): Promise<SendOutcome> {
  const trimmed = input.content.trim();
  if (!trimmed) {
    return { sentence: "内容为空，没有发送。", unknown: false, ok: false, requestId: null };
  }
  if (trimmed.length > CONTENT_MAX) {
    return {
      sentence: `内容超过 ${CONTENT_MAX} 字上限，服务端会拒；已裁到发送前，请缩短后再发。`,
      unknown: false,
      ok: false,
      requestId: input.requestId,
    };
  }
  const csrf = csrfWriteHeaders();
  if (!csrf) {
    return { sentence: new NoWriteSessionError().message, unknown: false, ok: false, requestId: null };
  }
  try {
    const body = await fetchJSON<unknown>(sessionMessagesUrl(sessionId), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // 同一把凭据两处一致：body 的 requestId 是真凭据，头形制对齐既有写门。
        "Idempotency-Key": input.requestId,
        ...csrf,
      },
      body: JSON.stringify({ requestId: input.requestId, content: trimmed }),
      signal: input.signal,
    });
    return { ok: true, turn: parseTurnPayload(body) };
  } catch (err) {
    const copy = sendFailureCopy(err);
    const requestId = err instanceof ApiError ? (err.requestId ?? null) : null;
    return { ok: false, sentence: copy.sentence, unknown: copy.unknown, requestId };
  }
}

/* ------------------------------------------------------------------ *
 * B 半 · 状态机/压缩态：前端零处自造徽章（契约硬红线）
 *
 * 形状文档 §1-§3 的 session 形状没有任何 status/压缩字段；后端补字段之前，
 * 任何「活跃/已压缩」标记都是造假。下面两个哨兵只服务一个目的：源码级钉住
 * 「本模块没有第二套状态词汇」，并给提案落地时的唯一挂载点（届时替换为
 * 真字段读取，仍然不推断）。
 * ------------------------------------------------------------------ */

/**
 * 永不渲染的假徽章词汇表——测试用它扫本抽屉 DOM，出现即红。
 * 词表只收「会话状态/压缩态」这类断言；「最近活跃」是既有页面锚点词汇
 * （EMP-03 在岗区），不属于本红线，故意不收，免得日后误伤。
 */
export const FORBIDDEN_STATUS_BADGES = ["已压缩", "压缩态", "未压缩", "活跃会话", "会话已压缩"] as const;

/** 占位契约：后端补 status/压缩字段之前恒为 null（不推断、不显徽章）。 */
export const SESSION_STATUS_FIELDS: { status: null; compressed: null } = { status: null, compressed: null };
