/**
 * T15 runs data layer. Read-only list/detail/event reads; no retry/cancel
 * write. A 400 from the BFF is surfaced as a filter-reading problem, not as
 * an empty list or a fake success.
 */
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

export interface RunRow {
  runId: string;
  employeeId?: string;
  taskId?: string;
  status?: string;
  reasonCode?: string;
  costUsd?: number | null;
  costStatus?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  employeeVersionNo?: number;
  attemptNo?: number;
  budgetCapUsd?: number | null;
}

export interface RunEvent {
  seq: number;
  eventType?: string;
  occurredAt?: string;
  payload?: Record<string, unknown>;
}

export interface RunListBody {
  items?: unknown[];
  nextCursor?: string;
}

export interface RunDetail extends RunRow {
  upstreamRunId?: string;
  channelEventId?: string;
  previousRunId?: string;
  policySnapshotRef?: string;
  lastEventSeq?: number;
}

export type Phase = "loading" | "ready" | "empty" | "error" | "denied";
export interface ListState {
  phase: Phase;
  rows: RunRow[];
  cursor: string | null;
  status: number;
  message: string;
  requestId: string | null;
}

function rec(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function n(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

export function normalizeRun(v: unknown): RunRow | null {
  if (!rec(v)) return null;
  const runId = str(v.runId) ?? str(v.id);
  if (!runId) return null;
  return {
    runId,
    employeeId: str(v.employeeId),
    taskId: str(v.taskId),
    status: str(v.status),
    reasonCode: str(v.reasonCode),
    costUsd: n(v.costUsd),
    costStatus: str(v.costStatus),
    startedAt: str(v.startedAt),
    endedAt: str(v.endedAt),
    createdAt: str(v.createdAt),
    updatedAt: str(v.updatedAt),
    employeeVersionNo: n(v.employeeVersionNo) ?? undefined,
    attemptNo: n(v.attemptNo) ?? undefined,
    budgetCapUsd: n(v.budgetCapUsd),
  };
}

export function normalizeDetail(v: unknown): RunDetail | null {
  const base = normalizeRun(v);
  if (!base || !rec(v)) return null;
  return {
    ...base,
    upstreamRunId: str(v.upstreamRunId),
    channelEventId: str(v.channelEventId),
    previousRunId: str(v.previousRunId),
    policySnapshotRef: str(v.policySnapshotRef),
    lastEventSeq: n(v.lastEventSeq) ?? undefined,
  };
}

export function normalizeEvent(v: unknown): RunEvent | null {
  if (!rec(v)) return null;
  const seq = n(v.seq);
  if (seq === null) return null;
  return {
    seq,
    eventType: str(v.eventType),
    occurredAt: str(v.occurredAt),
    payload: rec(v.payload) ? v.payload : undefined,
  };
}

export type ErrorInfo = { status: number; message: string; requestId: string | null };

export function errorInfo(err: unknown): ErrorInfo {
  const status = err instanceof ApiError ? err.status : 0;
  const requestId = err instanceof ApiError ? err.requestId ?? null : null;
  if (status === 401) return { status, message: "登录状态已过期，请重新登录后再刷新。", requestId };
  if (status === 403 || status === 404) return { status, message: "没有查看运行记录的权限，或该运行不存在。", requestId };
  if (status === 400) return { status, message: "这次筛选没有被接受，请调整状态或时间范围后重试。", requestId };
  if (status === 0) return { status, message: "当前网络不可达，请检查连接后重试。", requestId };
  if (status === 429) return { status, message: "请求太频繁，请稍后再试。", requestId };
  if (status >= 500) return { status, message: "运行服务暂时没有响应，请稍后重试。", requestId };
  return { status, message: "运行数据读取失败，请重试。", requestId };
}

export interface ListQuery {
  status?: string;
  since: string;
  cursor?: string;
}

export async function loadRuns(q: ListQuery): Promise<ListState> {
  try {
    const params = new URLSearchParams({ since: q.since, limit: "30" });
    if (q.status) params.set("status", q.status);
    if (q.cursor) params.set("cursor", q.cursor);
    const body = await fetchJSON<unknown>(`/agent-api/api/runs?${params.toString()}`);
    if (!rec(body) || (body.items !== undefined && !Array.isArray(body.items))) {
      return { phase: "error", rows: [], cursor: null, status: 502, message: "运行列表形状不完整，暂不展示。", requestId: null };
    }
    const rows = (Array.isArray(body.items) ? body.items : []).map(normalizeRun).filter((x): x is RunRow => x !== null);
    return {
      phase: rows.length ? "ready" : "empty",
      rows,
      cursor: str(body.nextCursor) ?? null,
      status: 200,
      message: "",
      requestId: null,
    };
  } catch (err) {
    const info = errorInfo(err);
    return {
      phase: info.status === 403 || info.status === 404 ? "denied" : "error",
      rows: [],
      cursor: null,
      status: info.status,
      message: info.message,
      requestId: info.requestId,
    };
  }
}

export async function loadRunDetail(runId: string): Promise<RunDetail> {
  const body = await fetchJSON<unknown>(`/agent-api/api/run-detail?id=${encodeURIComponent(runId)}`);
  const detail = normalizeDetail(body);
  if (!detail) throw new ApiError("运行详情形状不完整", { status: 502, body: "", url: "run-detail" });
  return detail;
}

export async function loadRunEvents(runId: string): Promise<{ items: RunEvent[]; hasMore: boolean }> {
  const body = await fetchJSON<unknown>(
    `/agent-api/api/run-events?runId=${encodeURIComponent(runId)}&limit=50`,
  );
  if (!rec(body) || !Array.isArray(body.items)) {
    throw new ApiError("运行事件形状不完整", { status: 502, body: "", url: "run-events" });
  }
  return {
    items: body.items.map(normalizeEvent).filter((x): x is RunEvent => x !== null),
    hasMore: body.hasMore === true,
  };
}

/* ── display ────────────────────────────────────────────────────────── */

const BEIJING = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
export function beijing(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  const at = (t: Intl.DateTimeFormatPartTypes) => BEIJING.formatToParts(d).find((p) => p.type === t)?.value ?? "";
  const [y, mo, da, hh, mi] = [at("year"), at("month"), at("day"), at("hour"), at("minute")];
  return y && mo && da ? `${y}-${mo}-${da} ${hh}:${mi}` : "—";
}

export function duration(start?: string, end?: string): string {
  if (!start) return "—";
  const a = Date.parse(start);
  const b = end ? Date.parse(end) : Date.now();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return "—";
  const sec = Math.round((b - a) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  return min < 60 ? `${min}m ${sec % 60}s` : `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function usd(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function shortId(raw?: string): string {
  if (!raw) return "—";
  const bare = raw.replace(/^[^:]*:/, "");
  return bare.length > 12 ? `${bare.slice(0, 6)}…${bare.slice(-4)}` : bare;
}

export function statusLabel(raw?: string): string {
  switch (raw) {
    case "pending": return "待派发";
    case "running": return "运行中";
    case "completed": return "成功";
    case "failed": return "失败";
    case "cancelled": return "已取消";
    case "interrupted": return "已中断";
    default: return "—";
  }
}

export function statusTone(raw?: string): "success" | "warning" | "destructive" | "secondary" | "outline" {
  if (raw === "completed") return "success";
  if (raw === "failed") return "destructive";
  if (raw === "running" || raw === "pending") return "secondary";
  if (raw === "interrupted") return "warning";
  return "outline";
}

export function reasonLabel(raw?: string): string {
  switch (raw) {
    case "run.budget_exhausted": return "预算耗尽";
    case "run.timeout": return "运行超时";
    case "run.cancelled": return "运行已取消";
    case "run.approval_rejected": return "审批被拒";
    default: return "—";
  }
}

export function eventLabel(raw?: string): string {
  switch (raw) {
    case "token": return "模型输出";
    case "tool_call": return "工具调用";
    case "tool_result": return "工具结果";
    case "approval_requested": return "发起审批";
    case "message": return "消息";
    case "started": return "开始";
    case "completed": return "完成";
    case "failed": return "失败";
    case "in_progress": return "进行中";
    default: return "其他事件";
  }
}

/** Task handles are technical ids; show a short labelled tail, full value in title. */
export function taskLabel(raw?: string): string {
  if (!raw) return "—";
  const bare = raw.replace(/^[^:]*:/, "").replace(/[^0-9A-Za-z]/g, "");
  return bare ? `任务 · ${bare.slice(-4).toUpperCase()}` : "任务";
}
