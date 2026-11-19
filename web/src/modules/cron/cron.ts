/**
 * 定时任务读口 — Hermes dashboard `GET /api/cron/jobs`.
 * Same-origin, authenticated by the dashboard fetch path; no write calls.
 * A missing value is 「—」 with a reason; a disabled job stays visible.
 */
import { ApiError, errorMessage } from "@/lib/api-error";
import { fetchJSON } from "@/lib/api";

export const CRON_PATH = "/api/cron/jobs";
export const CRON_GAP = "GAP-CRON-01";

export type JobStatus = "enabled" | "disabled" | "unknown";
export type JobResult = "ok" | "failed" | "running" | "unknown";

export interface CronRow {
  key: string;
  name: string;
  nameReason: string | null;
  schedule: string;
  scheduleRaw: string | null;
  scheduleReason: string | null;
  lastRun: string | null;
  lastRunReason: string | null;
  nextRun: string | null;
  nextRunReason: string | null;
  status: JobStatus;
  statusRaw: string | null;
  statusReason: string | null;
  result: JobResult;
  resultLabel: string;
  resultReason: string | null;
  resultDetail: string | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function pick(rec: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const found = text(rec[key]);
    if (found !== null) return found;
  }
  return null;
}

function bool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

export function beijingMinute(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  let date: Date | null = null;
  if (/^\d{9,10}$/.test(raw)) date = new Date(Number(raw) * 1000);
  else if (/^\d{11,13}$/.test(raw)) date = new Date(Number(raw));
  else if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(raw)) date = new Date(raw);
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

const WEEKDAY = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/** Turn the common five-field cron forms into a sentence; unknown stays generic. */
export function humanSchedule(value: string | null): { label: string; raw: string | null; reason: string | null } {
  const raw = value?.trim() || null;
  if (!raw) return { label: "—", raw: null, reason: "接口没有提供调度表达式。" };
  const parts = raw.split(/\s+/);
  if (parts.length !== 5) return { label: "自定义调度", raw, reason: "这不是常见的五段调度表达式，原值放在标题里。" };
  const [min, hour, dom, mon, dow] = parts;
  if (min.startsWith("*/") && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    const n = Number(min.slice(2));
    if (Number.isFinite(n) && n > 0) return { label: `每 ${n} 分钟`, raw, reason: null };
  }
  if (min === "0" && hour.startsWith("*/") && dom === "*" && mon === "*" && dow === "*") {
    const n = Number(hour.slice(2));
    if (Number.isFinite(n) && n > 0) return { label: `每 ${n} 小时`, raw, reason: null };
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === "*" && mon === "*" && dow === "*") {
    return { label: `每天 ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`, raw, reason: null };
  }
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === "*" && mon === "*" && /^\d$/.test(dow)) {
    const day = Number(dow);
    if (day >= 0 && day <= 7) {
      return { label: `每${WEEKDAY[day === 7 ? 0 : day]} ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`, raw, reason: null };
    }
  }
  return { label: "自定义调度", raw, reason: "这个调度表达式还没有可读的中文摘要，原值放在标题里。" };
}

function resultOf(rec: Record<string, unknown>): { result: JobResult; label: string; reason: string | null; detail: string | null } {
  const raw = (pick(rec, ["last_status", "lastStatus"]) ?? "").toLowerCase();
  const execution = record(rec.latest_execution) ?? record(rec.latestExecution);
  const execStatus = (pick(execution ?? {}, ["status"]) ?? "").toLowerCase();
  const error = pick(rec, ["last_error", "lastError"]) ?? pick(execution ?? {}, ["error"]);
  if (["ok", "success", "completed", "succeeded"].includes(raw) || (!raw && ["completed", "succeeded"].includes(execStatus))) {
    return { result: "ok", label: "成功", reason: null, detail: null };
  }
  if (["error", "failed", "failure"].includes(raw) || ["failed", "error"].includes(execStatus)) {
    return { result: "failed", label: "失败", reason: humanReason(error) ?? "上次运行失败，接口没有给出原因。", detail: error };
  }
  if (["running", "started", "queued", "pending"].includes(raw) || ["running", "started", "queued", "pending"].includes(execStatus)) {
    return { result: "running", label: "运行中", reason: null, detail: null };
  }
  if (!raw && !execStatus && !pick(rec, ["last_run_at", "lastRunAt"])) {
    return { result: "unknown", label: "—", reason: "这个任务还没有运行记录。", detail: null };
  }
  return { result: "unknown", label: "待核实", reason: "接口没有说明上次运行的结果。", detail: raw || execStatus || null };
}

function humanReason(value: string | null): string | null {
  if (!value) return null;
  if (/^[{[]/.test(value)) return null;
  if (/^\d{3}$/.test(value)) return null;
  if (/^[a-z][a-z0-9_.:-]{6,}$/i.test(value) && !/[。，、；\s]/.test(value)) return null;
  return value.length > 240 ? `${value.slice(0, 240)}…` : value;
}

export function readCronJobs(payload: unknown): CronRow[] | null {
  const list = Array.isArray(payload)
    ? payload
    : (() => {
        const outer = record(payload);
        if (!outer) return null;
        for (const key of ["jobs", "items", "data", "results", "list"]) {
          if (Array.isArray(outer[key])) return outer[key] as unknown[];
        }
        return null;
      })();
  if (list === null) return null;

  const rows: CronRow[] = [];
  list.forEach((value, index) => {
    const rec = record(value);
    if (!rec) return;
    const name = pick(rec, ["name", "job_name", "jobName", "title", "id"]);
    if (!name) return;
    const rawSchedule = (() => {
      const schedule = rec.schedule;
      if (typeof schedule === "string") return schedule;
      if (record(schedule)) return pick(schedule as Record<string, unknown>, ["display", "expr", "cron"]);
      return pick(rec, ["schedule_display", "scheduleDisplay", "schedule"]);
    })();
    const sched = humanSchedule(rawSchedule);
    const enabled = bool(rec.enabled ?? rec.active);
    const lastRaw = pick(rec, ["last_run_at", "lastRunAt"]);
    const nextRaw = pick(rec, ["next_run_at", "nextRunAt"]);
    const last = beijingMinute(lastRaw);
    const next = beijingMinute(nextRaw);
    const result = resultOf(rec);
    rows.push({
      key: pick(rec, ["id"]) ?? `${name}-${index}`,
      name,
      nameReason: null,
      schedule: sched.label,
      scheduleRaw: sched.raw,
      scheduleReason: sched.reason,
      lastRun: last,
      lastRunReason: last ? null : lastRaw ? "接口给的上次运行时间无法解析。" : "接口没有提供上次运行时间。",
      nextRun: next,
      nextRunReason: next ? null : nextRaw ? "接口给的下次运行时间无法解析。" : "接口没有提供下次运行时间。",
      status: enabled === true ? "enabled" : enabled === false ? "disabled" : "unknown",
      statusRaw: enabled === null ? null : String(enabled),
      statusReason: enabled === null ? "接口没有说明这个任务是否启用。" : null,
      result: result.result,
      resultLabel: result.label,
      resultReason: result.reason,
      resultDetail: result.detail,
    });
  });
  return rows;
}

export async function fetchCronJobs(): Promise<CronRow[]> {
  const rows = readCronJobs(await fetchJSON<unknown>(CRON_PATH));
  if (rows === null) throw new Error("定时任务回答不是一份清单");
  return rows;
}

export interface FailureInfo {
  status: number;
  requestId: string | null;
  technical: string | null;
}

export function failureInfo(err: unknown): FailureInfo {
  if (err instanceof ApiError) return { status: err.status, requestId: err.requestId ?? null, technical: err.details };
  return { status: -1, requestId: null, technical: err instanceof Error ? err.message : String(err) };
}

export interface FailureCopy {
  sentence: string;
  requestId: string | null;
  technical: string | null;
}

export function readFailure(err: unknown, info: FailureInfo): FailureCopy {
  const status = info.status;
  let sentence: string;
  if (status === 0 || status === -1) sentence = "连不上定时任务服务，请确认它已经启动，然后重试。";
  else if (status === 401) sentence = "登录状态已经失效，请刷新页面重新登录后再看定时任务。";
  else if (status === 403 || status === 404) sentence = "这块内容要么尚未接入本控制台，要么当前账号无权查看；这里不显示猜测的任务。";
  else if (status === 429) sentence = "请求太频繁了，请稍等一会儿再试。";
  else if (status >= 500) sentence = "定时任务服务在处理时出了错，请稍后重试。";
  else sentence = errorMessage(err) ?? "读取定时任务时出了问题，请稍后重试。";
  return { sentence, requestId: info.requestId, technical: info.technical };
}

export function isForbidden(status: number): boolean {
  return status === 403 || status === 404;
}
