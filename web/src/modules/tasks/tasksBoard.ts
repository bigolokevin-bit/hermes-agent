/**
 * Task board data layer (T14). Read-only: the BFF exposes list/detail reads;
 * no transition or drag write is attempted here, so nothing can report a
 * success the backend never confirmed.
 */
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

export const BOARD_STATUSES = ["open", "in_progress", "blocked", "done", "cancelled"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export interface Actor {
  type?: string;
  id?: string;
}

export interface TaskRow {
  taskId: string;
  title: string;
  status: string;
  priority?: string;
  assignee?: Actor | null;
  dueAt?: string;
  updatedAt?: string;
  progressNote?: string;
}

export interface TaskDetail extends TaskRow {
  description?: string;
  statusReason?: string;
  createdBy?: Actor | null;
  source?: { kind?: string; channel?: string; runId?: string } | null;
  employeeVersionRef?: string;
  relatedTaskIds?: string[];
  createdAt?: string;
  closedAt?: string;
}

export type Phase = "loading" | "ready" | "empty" | "error" | "denied";

export interface BoardState {
  phase: Phase;
  rows: TaskRow[];
  status: number;
  message: string;
  requestId: string | null;
}

export const EMPTY_BOARD: BoardState = {
  phase: "loading",
  rows: [],
  status: 0,
  message: "",
  requestId: null,
};

function record(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function actor(v: unknown): Actor | null {
  if (!record(v)) return null;
  return { type: str(v.type), id: str(v.id) };
}

export function normalizeTask(v: unknown): TaskRow | null {
  if (!record(v)) return null;
  const taskId = str(v.taskId) ?? str(v.id);
  const title = str(v.title);
  if (!taskId || !title) return null;
  return {
    taskId,
    title,
    status: str(v.status) ?? "open",
    priority: str(v.priority),
    assignee: actor(v.assignee),
    dueAt: str(v.dueAt),
    updatedAt: str(v.updatedAt),
    progressNote: str(v.progressNote),
  };
}

export function normalizeDetail(v: unknown): TaskDetail | null {
  const base = normalizeTask(v);
  if (!base || !record(v)) return null;
  const source = record(v.source)
    ? {
        kind: str(v.source.kind),
        channel: str(v.source.channel),
        runId: str(v.source.runId),
      }
    : null;
  return {
    ...base,
    description: str(v.description),
    statusReason: str(v.statusReason),
    createdBy: actor(v.createdBy),
    source,
    employeeVersionRef: str(v.employeeVersionRef),
    relatedTaskIds: Array.isArray(v.relatedTaskIds)
      ? v.relatedTaskIds.filter((x): x is string => typeof x === "string")
      : [],
    createdAt: str(v.createdAt),
    closedAt: str(v.closedAt),
  };
}

export function rowsFrom(body: unknown): TaskRow[] {
  if (!record(body) || !Array.isArray(body.items)) return [];
  return body.items.map(normalizeTask).filter((x): x is TaskRow => x !== null);
}

export type ErrorInfo = { status: number; message: string; requestId: string | null };

/** Human Chinese copy; HTTP codes and raw bodies never reach the screen. */
export function errorInfo(err: unknown): ErrorInfo {
  const status = err instanceof ApiError ? err.status : 0;
  const requestId = err instanceof ApiError ? err.requestId ?? null : null;
  if (status === 401) return { status, message: "登录状态已过期，请重新登录后再刷新。", requestId };
  if (status === 403 || status === 404) {
    return { status, message: "没有查看任务看板的权限，或该数据源尚未接入。", requestId };
  }
  if (status === 0) return { status, message: "当前网络不可达，请检查连接后重试。", requestId };
  if (status === 429) return { status, message: "请求太频繁，请稍后再试。", requestId };
  if (status >= 500) return { status, message: "任务服务暂时没有响应，请稍后重试。", requestId };
  return { status, message: "任务数据读取失败，请重试。", requestId };
}

export async function loadBoard(): Promise<BoardState> {
  try {
    const bodies = await Promise.all(
      BOARD_STATUSES.map((status) =>
        fetchJSON<unknown>(`/agent-api/api/tasks?status=${status}&limit=50`),
      ),
    );
    const seen = new Set<string>();
    const rows: TaskRow[] = [];
    for (const body of bodies) {
      for (const row of rowsFrom(body)) {
        if (seen.has(row.taskId)) continue;
        seen.add(row.taskId);
        rows.push(row);
      }
    }
    return {
      phase: rows.length ? "ready" : "empty",
      rows,
      status: 200,
      message: "",
      requestId: null,
    };
  } catch (err) {
    const info = errorInfo(err);
    return {
      phase: info.status === 403 || info.status === 404 ? "denied" : "error",
      rows: [],
      status: info.status,
      message: info.message,
      requestId: info.requestId,
    };
  }
}

export async function loadDetail(taskId: string): Promise<TaskDetail> {
  const body = await fetchJSON<unknown>(
    `/agent-api/api/task-detail?id=${encodeURIComponent(taskId)}`,
  );
  const detail = normalizeDetail(body);
  if (!detail) throw new ApiError("任务详情形状不完整", { status: 502, body: "", url: "task-detail" });
  return detail;
}

/* ── formatting ─────────────────────────────────────────────────────── */

const BEIJING = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function beijing(iso?: string): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  const at = (t: Intl.DateTimeFormatPartTypes) =>
    BEIJING.formatToParts(d).find((p) => p.type === t)?.value ?? "";
  const [y, mo, da, hh, mi] = [at("year"), at("month"), at("day"), at("hour"), at("minute")];
  return y && mo && da ? `${y}-${mo}-${da} ${hh}:${mi}` : "—";
}

export function statusLabel(value: string): string {
  switch (value) {
    case "open": return "待处理";
    case "in_progress": return "进行中";
    case "blocked": return "阻塞";
    case "done": return "已完成";
    case "cancelled": return "已取消";
    default: return "未知状态";
  }
}

export function priorityLabel(value?: string): { text: string; tone: "warning" | "outline" | "secondary" } {
  switch (value) {
    case "high": return { text: "高优先级", tone: "warning" };
    case "normal": return { text: "普通", tone: "secondary" };
    case "low": return { text: "低优先级", tone: "outline" };
    default: return { text: "未定级", tone: "outline" };
  }
}

function tailOf(id: string): string {
  const bare = id.replace(/^[^:]*:/, "").replace(/[^0-9A-Za-z]/g, "");
  return bare.slice(-4).toUpperCase() || "————";
}

/** 「姓名」 if present, otherwise 「员工 · 末4」 — never a bare emp_ id. */
export function employeeLabel(id?: string, name?: string): string {
  if (name && name.trim()) return name.trim();
  if (!id) return "未指派";
  return `员工 · ${tailOf(id)}`;
}

export function actorLabel(actorValue: Actor | null | undefined): string {
  if (!actorValue?.id) return "未指派";
  if (actorValue.type === "human" || /^human:/i.test(actorValue.id)) return "人员";
  return employeeLabel(actorValue.id);
}

export function sourceLabel(source: TaskDetail["source"]): string {
  if (!source) return "—";
  if (source.kind === "manual") return "人工创建";
  const channel = source.channel === "feishu" ? "飞书" : source.channel;
  return channel ? `渠道 · ${channel}` : "渠道";
}

export function shortRef(id: string): string {
  const bare = id.replace(/^[^:]*:/, "");
  return bare.length > 12 ? `${bare.slice(0, 6)}…${bare.slice(-4)}` : bare;
}
/** Detail errors use the same Chinese copy and request id as the board. */
export const detailError = errorInfo;
