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
import { asArray, isRecord, normalizeApproval, normalizeEmployee, normalizeRun, normalizeTask, text, EMPLOYEES_PAGE_LIMIT } from "./types";
import type {
  ApprovalEvidence,
  ConfigView,
  KnowledgeProbe,
  ReadinessEvidence,
  StationBinding,
} from "./readiness";

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
  const body = await get("/employees", { limit: EMPLOYEES_PAGE_LIMIT });
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

/* ── 四门证据读口（PRD v4 §2）：V1 工位 / V2 有效配置 / V3 知识 / V6 审批 ── */

function normalizeStation(v: unknown): StationBinding | null {
  if (!isRecord(v)) return null;
  return {
    bindingType: text(v.bindingType) ?? undefined,
    channel: text(v.channel) ?? undefined,
    status: text(v.status) ?? undefined,
    capabilities: Array.isArray(v.capabilities)
      ? v.capabilities.filter((c): c is string => typeof c === "string")
      : undefined,
  };
}

export async function fetchWorkstations(employeeId: string): Promise<StationBinding[]> {
  const body = await get("/workstations", { id: employeeId });
  return asArray(body)
    .map(normalizeStation)
    .filter((x): x is StationBinding => x !== null);
}

export async function fetchEffectiveConfig(employeeId: string): Promise<ConfigView> {
  const body = await get("/effective-config", { id: employeeId });
  const rec = isRecord(body) ? body : {};
  const version = isRecord(rec.version) ? rec.version : {};
  return {
    scopes: Array.isArray(version.knowledgeScopes)
      ? version.knowledgeScopes.filter((s): s is string => typeof s === "string")
      : [],
    grants: asArray(rec.grants).map((g) => ({
      expiresAt: isRecord(g) ? text(g.expiresAt) : null,
    })),
    resolvedAt: text(rec.resolvedAt),
  };
}

/** 全部审批里属于「该员工 message_send 决策」的行；其余行与四门无关，丢弃。 */
export async function fetchApprovalsEvidence(limit = 100): Promise<ApprovalEvidence[]> {
  const body = await get("/approvals", { status: "all", limit });
  const out: ApprovalEvidence[] = [];
  for (const row of asArray(body)) {
    if (!isRecord(row)) continue;
    const binding = isRecord(row.binding) ? row.binding : {};
    if (text(binding.subjectType) !== "employee") continue;
    const subjectId = text(binding.subjectId) ?? "";
    const kind = text(binding.changeKind) ?? text(row.action) ?? "";
    if (!subjectId || (kind !== "message_send" && kind !== "message.send")) continue;
    out.push({
      subjectId,
      status: text(row.status) ?? "",
      expiresAt: text(row.expiresAt),
      hasApprover: Array.isArray(row.approvers) ? row.approvers.length > 0 : false,
    });
  }
  return out;
}

/**
 * V3 文档腿探测。读侧未接线时 BFF 返回 404 `*.not_wired` 信封——那不是失败，
 * 是「未接」：返回 wired=false 且不编造 count。其它错误照抛，由 load() 落 error。
 */
export async function fetchKnowledgeProbe(): Promise<KnowledgeProbe> {
  try {
    const body = await get("/knowledge/documents", { limit: 100 });
    const rec = isRecord(body) ? body : {};
    return { wired: true, count: asArray(body).length, asOf: text(rec.asOf) };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 503) && err.body.includes("not_wired")) {
      let asOf: string | null = null;
      try {
        asOf = text((JSON.parse(err.body) as Record<string, unknown>).asOf);
      } catch {
        /* 信封没带采集时间就是没有，不猜。 */
      }
      return { wired: false, count: null, asOf };
    }
    throw err;
  }
}

/** 分母员工逐一读工位与有效配置；单员工失败只影响该员工该门。 */
export async function fetchReadinessEvidence(employeeIds: string[]): Promise<ReadinessEvidence> {
  const ids = employeeIds.slice(0, 32);
  const perEmployee = await Promise.all(
    ids.map(async (id) => {
      const [stations, config] = await Promise.all([
        load(() => fetchWorkstations(id)),
        load(() => fetchEffectiveConfig(id)),
      ]);
      return [id, stations, config] as const;
    }),
  );
  const [approvals, knowledge] = await Promise.all([
    load(() => fetchApprovalsEvidence()),
    load(fetchKnowledgeProbe),
  ]);
  const stations: Record<string, Loadable<StationBinding[]>> = {};
  const configs: Record<string, Loadable<ConfigView>> = {};
  for (const [id, st, cfg] of perEmployee) {
    stations[id] = st;
    configs[id] = cfg;
  }
  return { stations, configs, approvals, knowledge };
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