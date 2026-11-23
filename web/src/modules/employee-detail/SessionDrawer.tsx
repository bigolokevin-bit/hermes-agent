/**
 * SE-03 · 会话详情抽屉 — GET /agent-api/api/console-sessions/{sessionId}
 * SE-05 · 底部续跑表单 — POST …/{sessionId}/messages（写口形制见 sessionContinuation.ts）
 *
 * 续跑纪律（工单 SE-05 步骤①②④ 原文口径）：
 *  - 表单只有 content 一个输入：角色词汇恒为 user/assistant 两个，由服务端
 *    成对落库决定（requestId 幂等），前端不提供第三个角色、也不写 role；
 *  - 幂等凭据 = 请求体 requestId（≤200）；同一条消息重试必须复用同一把，
 *    改体即换把（另一条消息）；
 *  - 发送后**重取详情**收敛到服务端 seq——乐观上屏只是占位气泡，绝不本地
 *    拼最终状态、绝不本地折 seq（防漂移，工单②）；
 *  - 403/405/409 各有专句（sessionContinuation.sendFailureCopy 单点）；
 *  - 后端补 status/压缩字段之前，本抽屉**零处**自造「活跃/已压缩」徽章。
 *
 * 契约（CONSOLE-SESSIONS-SHAPE.md §3，2026-11-22 现网 BFF 实测原文见
 * worktree evidence/raw-sessions-detail-real.json）：
 *  - 详情读口一次全量返回 messages[]（按 seq ASC，无服务端分页）；前端对
 *    长会话只做「渲染切片」，切片注记必须如实报总数，禁截断后谎称全量；
 *  - citations「有才出现」：仅 assistant 行、且 citations 键存在并是非空
 *    数组时渲染引用区；缺键 / 空数组 / 非数组一律无引用区（后端契约保证
 *    绝不返回 [] 冒充；前端同样绝不显空引用块）；user 行永不见引用
 *    （DB CHECK 同语义，前端 role 门禁双保险）；
 *  - 跨租户与不存在是逐字同体 404（console_session.not_found），前端文案
 *    不得区分两种情形（防枚举）；错误态恒带可复制请求编号。
 *  - 前向兼容：未知字段忽略不崩；seq/时间等不可解析时显「—」，绝不折 0。
 *
 * Markdown 复用 fork 既有 `@/components/Markdown`（named export
 * `Markdown`，props { content, highlightTerms?, streaming? }，2026-11-24
 * 读源码确认导出面）。
 */
import { useEffect, useRef, useState } from "react";
import { Inbox, RefreshCw, Send, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";

import { Markdown } from "@/components/Markdown";
import { RequestIdCopy } from "@/components/RequestIdCopy";
import { fetchJSON } from "@/lib/api";
import { ApiError, SESSION_REQUIRED_GUIDANCE } from "@/lib/api-error";
import {
  CONTENT_MAX,
  newRequestId,
  sendSessionMessage,
  type SendOutcome,
} from "@/modules/employee-detail/sessionContinuation";

/* ------------------------------------------------------------------ *
 * readers — 严格但不脆：形状不符契约即抛（交错误态），字段缺值显「—」
 * ------------------------------------------------------------------ */

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 每段渲染的消息行数；超过则切片 + 诚实注记 + 继续渲染按钮。 */
export const RENDER_WINDOW = 100;

export type CitationField = { key: string; text: string };
export type CitationRow = { fields: CitationField[]; raw: string };

export type SessionMessageRow = {
  seq: number | null;
  /** 原值；契约词汇只有 user/assistant，未知值照常显示并标待核实。 */
  role: string | null;
  /** null = content 键缺失或不是字符串（不编造渲染值）。 */
  content: string | null;
  requestId: string | null;
  createdAt: string | null;
  /**
   * null ⇒ 不渲染引用区。非 null ⇒ 有（assistant 行 + citations 键存在 +
   * 非空数组）。user 行恒 null（role 门禁），缺键/[]/非数组恒 null。
   */
  citations: CitationRow[] | null;
};

export type SessionDetail = {
  sessionId: string | null;
  employeeId: string | null;
  /** 读口声明的 messageCount（缺/非法 ⇒ null，不折 0）。 */
  declaredCount: number | null;
  /** 实际回传的消息行（渲染以此为准，绝不按 declaredCount 编行）。 */
  messages: SessionMessageRow[];
};

function safeJson(value: unknown): string {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? String(value) : text.length > 500 ? `${text.slice(0, 500)}…` : text;
  } catch {
    return String(value);
  }
}

export function citationRows(value: unknown): CitationRow[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value.map((entry) => {
    if (!isRecord(entry)) return { fields: [], raw: safeJson(entry) };
    const fields: CitationField[] = [];
    for (const [key, v] of Object.entries(entry)) {
      if (typeof v === "string" && v.trim()) fields.push({ key, text: v.trim() });
      else if (typeof v === "number" && Number.isFinite(v)) fields.push({ key, text: String(v) });
    }
    return { fields, raw: safeJson(entry) };
  });
}

export function parseSessionDetail(body: unknown): SessionDetail {
  if (!isRecord(body)) throw new Error("会话详情响应体不是对象");
  if (!Array.isArray(body.messages)) throw new Error("会话详情缺少 messages 数组");
  const messages: SessionMessageRow[] = body.messages.map((item) => {
    const rec = isRecord(item) ? item : {};
    const role = typeof rec.role === "string" && rec.role.trim() ? rec.role.trim() : null;
    // 「有才出现」判定：键存在性 + 非空数组 + assistant 门禁。未知字段忽略。
    const hasKey = isRecord(item) && Object.prototype.hasOwnProperty.call(item, "citations");
    const citations = role === "assistant" && hasKey ? citationRows(rec.citations) : null;
    return {
      seq: typeof rec.seq === "number" && Number.isFinite(rec.seq) ? rec.seq : null,
      role,
      content: typeof rec.content === "string" ? rec.content : null,
      requestId: typeof rec.requestId === "string" && rec.requestId.trim() ? rec.requestId.trim() : null,
      createdAt: typeof rec.createdAt === "string" && rec.createdAt.trim() ? rec.createdAt.trim() : null,
      citations,
    };
  });
  const count =
    typeof body.messageCount === "number" && Number.isFinite(body.messageCount)
      ? body.messageCount
      : null;
  return {
    sessionId: typeof body.sessionId === "string" && body.sessionId ? body.sessionId : null,
    employeeId: typeof body.employeeId === "string" && body.employeeId ? body.employeeId : null,
    declaredCount: count,
    messages,
  };
}

/* ------------------------------------------------------------------ *
 * copy — 防枚举：404 只有一句，不存在与跨租户逐字同体
 * ------------------------------------------------------------------ */

export const SESSION_NOT_FOUND_SENTENCE =
  "这个会话读不到：它不存在，或你没有权限看到它——两种情况的答复完全相同，这里不做区分。";
const SESSION_FORBIDDEN_SENTENCE = "当前账号没有读取该会话详情的权限，请联系管理员开通。";
const PARSE_FAIL_SENTENCE = "详情响应形状不符合预期，本抽屉没有渲染猜测内容。";

export const sessionDetailUrl = (sessionId: string): string =>
  `/agent-api/api/console-sessions/${encodeURIComponent(sessionId)}`;

type DrawerState =
  | { phase: "loading" }
  | { phase: "error"; title: string; message: string; requestId: string | null; notFound?: boolean }
  | { phase: "ready"; detail: SessionDetail };

function errorState(err: unknown): Extract<DrawerState, { phase: "error" }> {
  if (err instanceof ApiError) {
    const requestId = err.requestId ?? null;
    if (err.status === 404) {
      return { phase: "error", title: "会话不存在", message: SESSION_NOT_FOUND_SENTENCE, requestId, notFound: true };
    }
    if (err.status === 401) {
      return { phase: "error", title: "需要登录", message: SESSION_REQUIRED_GUIDANCE, requestId };
    }
    if (err.status === 403) {
      return { phase: "error", title: "没有权限", message: SESSION_FORBIDDEN_SENTENCE, requestId };
    }
    return { phase: "error", title: "会话详情没能加载出来", message: err.message, requestId };
  }
  return {
    phase: "error",
    title: "会话详情没能加载出来",
    message: err instanceof Error && err.message ? err.message : "未知错误，没有更多诊断信息。",
    requestId: null,
  };
}

function beijingText(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const t = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

function shortCode(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

function roleView(role: string | null): { label: string; title?: string } {
  if (!role) return { label: "—", title: "这条消息没有回传 role。" };
  if (role === "user") return { label: "用户" };
  if (role === "assistant") return { label: "助手" };
  return { label: `${role}（待核实）`, title: `role 原值：${role}（不在已知词汇 user/assistant 内，不猜）。` };
}

/* ------------------------------------------------------------------ *
 * drawer
 * ------------------------------------------------------------------ */

export default function SessionDrawer({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [state, setState] = useState<DrawerState>({ phase: "loading" });
  const [nonce, setNonce] = useState(0);
  const [shown, setShown] = useState(RENDER_WINDOW);

  /* SE-05 续跑表单态 ———————————————————————————————— */
  const [draft, setDraft] = useState("");
  /** 乐观占位气泡（发送中才存在；落库与否一律以重取的详情为准）。 */
  const [pending, setPending] = useState<{ requestId: string; content: string } | null>(null);
  const [sendError, setSendError] = useState<{ sentence: string; requestId: string | null } | null>(null);
  /** 服务端回执 seq 的口径句（重取详情完成后换成上屏行的真 seq 说话）。 */
  const [sendNote, setSendNote] = useState<string | null>(null);
  /** 这条草稿当前绑定的幂等凭据；重试复用、改体换新（工单①）。 */
  const keyRef = useRef<{ requestId: string; content: string } | null>(null);
  const inflightRef = useRef(false);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  async function submitContinuation(): Promise<void> {
    if (inflightRef.current) return;
    const content = draft.trim();
    if (!content || content.length > CONTENT_MAX) return;
    const held = keyRef.current;
    const requestId = held && held.content === content ? held.requestId : newRequestId();
    keyRef.current = { requestId, content };
    inflightRef.current = true;
    setPending({ requestId, content });
    setSendError(null);
    setSendNote(null);
    const outcome: SendOutcome = await sendSessionMessage(sessionId, { requestId, content });
    if (!aliveRef.current) return;
    inflightRef.current = false;
    if (outcome.ok) {
      // 工单②：以服务端返回 seq 收敛——重取详情，不在本地拼状态。
      const { userSeq, assistantSeq } = outcome.turn;
      setPending(null);
      keyRef.current = null;
      setDraft("");
      setSendNote(
        userSeq !== null && assistantSeq !== null
          ? `服务端已落库并回执 seq：user #${userSeq}、assistant #${assistantSeq}。详情读口已重取，上屏行以服务端回传为准。`
          : "服务端回执这一轮已落库，但载荷里没带可解析的 seq；屏上不猜，以重取的详情为准。",
      );
      setNonce((n) => n + 1);
      return;
    }
    // 失败/未知：占位气泡撤下（它从不代表已落库），草稿留在输入框里。
    // 同一条消息重试沿用同一把 requestId（keyRef 未清）；改动内容自动换新的一把。
    setPending(null);
    setSendError({ sentence: outcome.sentence, requestId: outcome.requestId });
  }

  useEffect(() => {
    let cancelled = false;
    setState({ phase: "loading" });
    setShown(RENDER_WINDOW);
    fetchJSON<unknown>(sessionDetailUrl(sessionId)).then(
      (body) => {
        if (cancelled) return;
        try {
          setState({ phase: "ready", detail: parseSessionDetail(body) });
        } catch {
          setState({
            phase: "error",
            title: "响应形状不认识",
            message: PARSE_FAIL_SENTENCE,
            requestId: null,
          });
        }
      },
      (err) => {
        if (!cancelled) setState(errorState(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [sessionId, nonce]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visible = state.phase === "ready" ? state.detail.messages.slice(0, shown) : [];

  return (
    <div className="fixed inset-0 z-50" data-testid="sd-root">
      <div
        data-testid="sd-backdrop"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="会话详情"
        data-testid="sd-drawer"
        className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col bg-[#141414] p-3 md:p-4"
      >
        <Card className="flex min-h-0 w-full flex-1 flex-col">
          <div className="flex items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-medium" title={sessionId}>
                会话详情 · {shortCode(sessionId)}
              </h2>
              <p data-testid="sd-scope" className="mt-0.5 text-xs text-white/45">
                消息流只读上屏 · 详情读口一次全量返回（无服务端分页）· 续跑走 /messages 写口
              </p>
            </div>
            <button
              type="button"
              data-testid="sd-close"
              aria-label="关闭会话详情"
              onClick={onClose}
              className="shrink-0 rounded-sm border border-white/15 p-1.5 text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* SE-05 · 续跑回执横幅：成功句与拒答句都常驻（重取详情失败时仍在，
              这样「已落库」与「详情没读到」两件事分得开，谁也不冒充谁）。 */}
          {sendNote || sendError ? (
            <div className="border-b border-white/10 px-4 py-2" data-testid="se05-banner">
              {sendNote ? (
                <p className="text-xs text-emerald-300/80" data-testid="se05-send-note">
                  {sendNote}
                </p>
              ) : null}
              {sendError ? (
                <div
                  className="flex flex-col gap-1 rounded-sm border border-amber-400/30 bg-amber-400/5 px-3 py-2"
                  data-testid="se05-send-error"
                >
                  <p className="text-xs" data-testid="se05-send-error-sentence">
                    {sendError.sentence}
                  </p>
                  <p className="font-mono text-xs text-white/45">
                    <RequestIdCopy
                      requestId={sendError.requestId}
                      fallback="本次写请求没有带回编号；可复制时间与页面路径反馈。"
                    />
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">
            {state.phase === "loading" ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-white/55" data-testid="sd-loading">
                <RefreshCw className="h-4 w-4 animate-spin" />
                正在读取该会话的全量消息…
              </div>
            ) : null}

            {state.phase === "error" ? (
              <div className="flex flex-col items-start gap-3 px-4 py-6" data-testid={state.notFound ? "sd-not-found" : "sd-error"}>
                {state.notFound ? (
                  <ShieldAlert className="h-5 w-5 text-amber-400" />
                ) : (
                  <TriangleAlert className="h-5 w-5 text-amber-400" />
                )}
                <p className="text-sm">{state.title}</p>
                <p className="text-xs text-white/55">{state.message}</p>
                <p className="font-mono text-xs text-white/45">
                  <RequestIdCopy
                    requestId={state.requestId}
                    fallback="本次请求没有带回编号；可复制时间与页面路径反馈。"
                  />
                </p>
                <Button size="sm" outlined onClick={() => setNonce((n) => n + 1)}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  重试
                </Button>
              </div>
            ) : null}

            {state.phase === "ready" && state.detail.messages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center" data-testid="sd-empty">
                <Inbox className="h-6 w-6 text-white/40" />
                <p className="text-sm">这个会话还没有消息。</p>
                <p className="text-xs text-white/50">
                  详情读口全量返回了 0 条消息（服务端真实空集，不是加载失败）。
                  {state.detail.declaredCount !== null && state.detail.declaredCount !== 0 ? (
                    <> 读口同时声明 messageCount={state.detail.declaredCount}，两个数都如实上屏，以实际回传为准。</>
                  ) : null}
                </p>
              </div>
            ) : null}

            {state.phase === "ready" && state.detail.messages.length > 0 ? (
              <>
                <ul className="divide-y divide-white/5" data-testid="sd-messages">
                  {visible.map((row, i) => {
                    const role = roleView(row.role);
                    return (
                      <li key={`${row.seq ?? "seq"}-${i}`} data-testid={`sd-msg-${i}`} className="px-4 py-3">
                        <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-white/50">
                          <span data-testid={`sd-msg-role-${i}`}>
                            <Badge>{role.label}</Badge>
                          </span>
                          <span
                            className="font-mono"
                            data-testid={`sd-msg-seq-${i}`}
                            title={row.seq === null ? "这条消息没有回传可解析的 seq。" : undefined}
                          >
                            {row.seq === null ? "seq —" : `#${row.seq}`}
                          </span>
                          <span
                            className="font-mono"
                            data-testid={`sd-msg-time-${i}`}
                            title={row.createdAt ?? "这条消息没有回传 createdAt。"}
                          >
                            {beijingText(row.createdAt)}
                          </span>
                          <span
                            className="break-all font-mono text-white/45"
                            data-testid={`sd-msg-rid-${i}`}
                            title={row.requestId ?? "这条消息没有回传 requestId。"}
                          >
                            {row.requestId ?? "req —"}
                          </span>
                        </div>
                        <div className="text-sm leading-relaxed" data-testid={`sd-msg-content-${i}`}>
                          {row.content === null ? (
                            <span className="text-white/45" title="content 键缺失或不是字符串，没有编造渲染值。">
                              —
                            </span>
                          ) : row.content === "" ? (
                            <span className="text-white/45" title="上游回传了空字符串内容。">
                              （空内容）
                            </span>
                          ) : (
                            <Markdown content={row.content} />
                          )}
                        </div>
                        {row.citations ? (
                          <div
                            className="mt-2 rounded-sm border border-white/10 bg-white/5 px-3 py-2"
                            data-testid={`sd-citations-${i}`}
                          >
                            <p className="text-xs text-white/55" data-testid={`sd-cit-count-${i}`}>
                              引用 · {row.citations.length} 条
                            </p>
                            <ul className="mt-1 space-y-1">
                              {row.citations.map((citation, j) => (
                                <li
                                  key={j}
                                  className="text-xs text-white/70"
                                  data-testid={`sd-citation-${i}-${j}`}
                                  title={citation.raw}
                                >
                                  {citation.fields.length > 0 ? (
                                    citation.fields.map((field) => (
                                      <span key={field.key} className="mr-3 break-all">
                                        <span className="text-white/45">{field.key}：</span>
                                        {field.text}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="break-all font-mono">{citation.raw}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <div className="px-4 py-3 text-xs text-white/50" data-testid="sd-footer">
                  {visible.length < state.detail.messages.length ? (
                    <>
                      <p data-testid="sd-slice-note">
                        服务端已一次全量回传 {state.detail.messages.length} 条消息（无分页）；
                        本屏只是前端渲染切片（已渲染 {visible.length} 条），数据没有被截断。
                      </p>
                      <Button
                        size="sm"
                        outlined
                        className="mt-2"
                        data-testid="sd-show-more"
                        onClick={() => setShown((s) => s + RENDER_WINDOW)}
                      >
                        继续渲染（还剩 {state.detail.messages.length - visible.length} 条）
                      </Button>
                    </>
                  ) : (
                    <p data-testid="sd-slice-note">本次全部 {state.detail.messages.length} 条消息已渲染上屏。</p>
                  )}
                  {state.detail.declaredCount !== null &&
                  state.detail.declaredCount !== state.detail.messages.length ? (
                    <p className="mt-1 text-white/45" data-testid="sd-count-mismatch">
                      口径核对：读口声明 messageCount={state.detail.declaredCount}，本次实际回传消息{" "}
                      {state.detail.messages.length} 条；两数不等，屏上以实际回传为准，不做折算。
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}

            {/* SE-05 · 乐观占位气泡：发送中才有；seq 一律显「待服务端回执」，
                绝不在本地预填序号（工单②防 seq 漂移）。 */}
            {state.phase === "ready" && pending ? (
              <div className="border-t border-white/5 px-4 py-3" data-testid="se05-pending">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-white/50">
                  <Badge>用户</Badge>
                  <span className="font-mono" data-testid="se05-pending-seq">
                    seq 待服务端回执
                  </span>
                  <span className="break-all font-mono text-white/45" data-testid="se05-pending-rid" title={pending.requestId}>
                    {pending.requestId}
                  </span>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed" data-testid="se05-pending-content">
                  {pending.content}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  这条是本地占位（乐观上屏），还没有拿到服务端 seq；落库与配对行以详情读口重取为准。
                </p>
              </div>
            ) : null}
          </CardContent>

          {/* SE-05 · 续跑表单。契约只认 user/assistant 两个角色词汇：这一轮以
              用户身份发言，服务端成对落 user+assistant——表单因此不给第三个
              角色入口，也不让手填 role（工单①）。 */}
          {state.phase === "ready" ? (
            <form
              className="border-t border-white/10 px-4 py-3"
              data-testid="se05-form"
              onSubmit={(event) => {
                event.preventDefault();
                void submitContinuation();
              }}
            >
              <label htmlFor="se05-draft" className="text-xs text-white/55">
                续跑这条会话（以用户身份发一轮 · 服务端成对落 user/assistant，别无第三种角色）
              </label>
              <textarea
                id="se05-draft"
                data-testid="se05-draft"
                className="mt-1 w-full resize-y rounded-sm border border-white/15 bg-white/5 px-2 py-1.5 text-sm outline-none placeholder:text-white/30"
                rows={2}
                value={draft}
                maxLength={CONTENT_MAX}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="例如：接着上面那条，补一句结论。"
              />
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-white/40" data-testid="se05-limit">
                  {draft.trim().length}/{CONTENT_MAX} 字 · 幂等凭据 requestId 绑定这条草稿（重试沿用、改体换新）
                </p>
                <Button
                  size="sm"
                  type="submit"
                  data-testid="se05-send"
                  disabled={pending !== null || !draft.trim() || draft.trim().length > CONTENT_MAX}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {pending ? "发送中…" : "发送"}
                </Button>
              </div>
            </form>
          ) : null}
        </Card>
      </aside>
    </div>
  );
}
