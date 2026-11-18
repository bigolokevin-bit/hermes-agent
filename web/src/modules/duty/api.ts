import { fetchJSON } from "@/lib/api";
import { ApiError, errorMessage } from "@/lib/api-error";
import type {
  ApprovalRow,
  ApprovalStatsBody,
  BudgetBody,
  EmployeeRow,
  Loadable,
  MatrixBody,
  RunRow,
  RunStatsBody,
  TaskRow,
} from "./types";
import { asArray, normalizeApproval, normalizeEmployee, normalizeRun, normalizeTask } from "./types";

export const BFF = "/agent-api/api";

function url(path: string, params?: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return `${BFF}${path}${s ? `?${s}` : ""}`;
}

async function get(path: string, params?: Record<string, string | number | undefined>): Promise<unknown> {
  return fetchJSON<unknown>(url(path, params));
}

export function requestIdOf(err: unknown): string | null {
  return err instanceof ApiError ? err.requestId ?? null : null;
}

export function statusOf(err: unknown): number {
  return err instanceof ApiError ? err.status : 0;
}

/** Chinese, actionable error line. Never includes HTTP codes or raw bodies. */
export function humanError(err: unknown): string {
  const status = statusOf(err);
  if (status === 401) return "登录状态已过期，请重新登录后再刷新。";
  if (status === 403 || status === 404) return "你没有查看这块数据的权限，或该数据尚未接入。";
  if (status === 0) return "当前网络不可达，请检查连接后重试。";
  if (status === 429) return "请求太频繁，请稍后再重试。";
  if (status >= 500) return "数据服务暂时没有响应，请稍后重试。";
  // Upstream detail is often English or a code; keep it out of the visible line.
  void errorMessage(err);
  return "本次数据读取失败，请重试。";
}

export async function fetchEmployees(): Promise<EmployeeRow[]> {
  const body = await get("/employees", { limit: 100 });
  return asArray(body).map(normalizeEmployee).filter((x): x is EmployeeRow => x !== null);
}

export async function fetchEmployeeStats(): Promise<Record<string, unknown>> {
  const body = await get("/employee-stats");
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

export async function fetchRunStats(from: string, to: string, bucket = "day"): Promise<RunStatsBody> {
  const body = await get("/run-stats", { from, to, bucket });
  return body && typeof body === "object" ? (body as RunStatsBody) : {};
}

export async function fetchActivity(weeks = 1): Promise<{ cells?: { dow: number; hour: number; count: number }[]; max?: number }> {
  const body = await get("/run-activity", { weeks, tz: "Asia/Shanghai" });
  return body && typeof body === "object" ? (body as { cells?: { dow: number; hour: number; count: number }[]; max?: number }) : {};
}

export async function fetchBudget(employeeIds: string[], periodKind: "day" | "month", period: string): Promise<BudgetBody> {
  const body = await get("/budget-usage", {
    employeeId: employeeIds.join(","),
    periodKind,
    period,
  });
  return body && typeof body === "object" ? (body as BudgetBody) : {};
}

export async function fetchApprovalStats(dueWithinSeconds = 86400): Promise<ApprovalStatsBody> {
  const body = await get("/approval-stats", { dueWithinSeconds });
  return body && typeof body === "object" ? (body as ApprovalStatsBody) : {};
}

export async function fetchApprovals(limit = 3): Promise<ApprovalRow[]> {
  const body = await get("/approvals", { status: "pending", limit });
  return asArray(body).map(normalizeApproval).filter((x): x is ApprovalRow => x !== null);
}

export async function fetchRuns(limit: number, since: string, status?: string): Promise<RunRow[]> {
  const body = await get("/runs", { since, limit, status });
  return asArray(body).map(normalizeRun).filter((x): x is RunRow => x !== null);
}

export async function fetchBlockedTasks(limit = 3): Promise<TaskRow[]> {
  const body = await get("/tasks", { status: "blocked", limit });
  return asArray(body).map(normalizeTask).filter((x): x is TaskRow => x !== null);
}

export async function fetchMatrix(limit = 50): Promise<MatrixBody> {
  const body = await get("/matrix", { limit });
  return body && typeof body === "object" ? (body as MatrixBody) : {};
}

/** Convert a promise into a card-sized Loadable; the loader never throws. */
export async function load<T>(fn: () => Promise<T>): Promise<Loadable<T>> {
  try {
    return { k: "ready", data: await fn() };
  } catch (err) {
    return {
      k: "error",
      status: statusOf(err),
      message: humanError(err),
      requestId: requestIdOf(err),
    };
  }
}