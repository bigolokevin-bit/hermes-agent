/**
 * retention surface data layer — 数据保留与清理（只读，/system?tab=retention）.
 *
 * LIVE PROBE (2026-11-19, session cookie via 127.0.0.1:8092, value never logged):
 *   GET /api/retention          -> 404 {"code":"console.unknown_route", …}
 *   GET /api/retention-policy   -> 404 console.unknown_route
 *   GET /api/data-retention     -> 404 console.unknown_route
 *   GET /api/storage            -> 404 console.unknown_route
 *   GET /api/storage-usage      -> 404 console.unknown_route
 *   GET /api/audit-retention    -> 404 console.unknown_route
 *   GET /api/cleanup            -> 404 console.unknown_route
 *   GET /api/maintenance        -> 404 console.unknown_route
 * The BFF route table (`apps/console/BFF-ROUTE-MATRIX.md`) carries no retention
 * or clean-up row at all, so on this deployment the honest answer per section is
 * 「未接入」 with a reason — never a fabricated 0-day policy, a guessed clean-up
 * time, or a 0-byte occupancy.
 *
 * A future 200 is read defensively: an absent field stays absent (rendered `—`
 * with its reason) and never becomes 0. A route that is missing (404 with
 * `console.unknown_route`) is NOT the same thing as an access denial: the first
 * paints the 未接入 surface, the second the one denied body shared by 403/404.
 */
import { ApiError } from "@/lib/api-error";

/** The one read this page would use once the surface is wired. */
export const RETENTION_PATH = "/agent-api/api/retention";

/** The gap ledger id for this surface; it only ever rides in a `title`. */
export const GAP = "GAP-13";

export const UNWIRED_REASON =
  "这个控制台还没有接通保留策略的读取，所以这里不显示天数、清理时间或占用；不拿 0 天或 0 字节去顶替。";

export const FIELD_REASON = "服务没有给出这一项，本页不替它猜，也不记作 0。";

export type SectionKey = "audit" | "runs" | "sessions" | "uploads";

export interface SectionSpec {
  key: SectionKey;
  label: string;
}

/** The four areas the surface must cover, in a fixed order. */
export const SECTIONS: readonly SectionSpec[] = [
  { key: "audit", label: "审计事件" },
  { key: "runs", label: "运行记录" },
  { key: "sessions", label: "会话日志" },
  { key: "uploads", label: "上传物" },
];

export interface SectionRow {
  key: SectionKey;
  label: string;
  /** Retention in days; null when the answer did not carry it. */
  days: number | null;
  /** Raw instants from the answer; the page formats them in Beijing time. */
  lastCleanup: string | null;
  nextRun: string | null;
  usedBytes: number | null;
  limitBytes: number | null;
  /** True when this area has no source at all (route missing / row absent). */
  unwired: boolean;
  /** Why it reads 未接入 or why a field is `—`. Never contains a wire key name. */
  note: string;
}

export interface RetentionAnswer {
  sections: SectionRow[];
  answered: SectionKey[];
  asOf: string | null;
}

const LIST_KEYS = ["sections", "items", "policies", "retention", "data", "list", "records"] as const;
const KEY_KEYS = ["key", "section", "area", "id", "name"] as const;
const DAYS_KEYS = ["retentionDays", "retention_days", "days", "keepDays", "keep_days", "ttlDays", "ttl_days"] as const;
const LAST_KEYS = [
  "lastCleanupAt",
  "last_cleanup_at",
  "lastPurgeAt",
  "last_purge_at",
  "lastRunAt",
  "last_run_at",
  "cleanedAt",
  "cleaned_at",
] as const;
const NEXT_KEYS = [
  "nextRunAt",
  "next_run_at",
  "nextCleanupAt",
  "next_cleanup_at",
  "scheduledAt",
  "scheduled_at",
] as const;
const USED_KEYS = ["usedBytes", "used_bytes", "usageBytes", "usage_bytes", "sizeBytes", "size_bytes", "used", "usage", "size"] as const;
const LIMIT_KEYS = [
  "limitBytes",
  "limit_bytes",
  "thresholdBytes",
  "threshold_bytes",
  "quotaBytes",
  "quota_bytes",
  "limit",
  "threshold",
  "quota",
] as const;
const ASOF_KEYS = ["asOf", "as_of", "generatedAt", "generated_at"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A string or a finite number; anything else is absent. */
function text(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pick(rec: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) if (key in rec) return rec[key];
  return undefined;
}

function listIn(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return null;
  for (const key of LIST_KEYS) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
  }
  return null;
}

/** The service's own area name folded onto the four canonical keys. */
export function sectionKeyOf(raw: unknown): SectionKey | null {
  const value = text(raw);
  if (!value) return null;
  const flat = value.toLowerCase().replace(/[^a-z]/g, "");
  if (flat.startsWith("audit") || flat === "events" || flat === "eventlog") return "audit";
  if (flat.startsWith("run") || flat.startsWith("execution")) return "runs";
  if (flat.startsWith("session") || flat.startsWith("conversation") || flat === "chatlogs") return "sessions";
  if (flat.startsWith("upload") || flat.startsWith("file") || flat.startsWith("attachment") || flat.startsWith("object")) {
    return "uploads";
  }
  return null;
}

function rowOf(raw: unknown, label: string, key: SectionKey): SectionRow {
  const rec = isRecord(raw) ? raw : {};
  return {
    key,
    label,
    days: numeric(pick(rec, DAYS_KEYS)),
    lastCleanup: text(pick(rec, LAST_KEYS)),
    nextRun: text(pick(rec, NEXT_KEYS)),
    usedBytes: numeric(pick(rec, USED_KEYS)),
    limitBytes: numeric(pick(rec, LIMIT_KEYS)),
    unwired: false,
    note: "",
  };
}

/**
 * Reads an answer into the four canonical sections. A section the answer says
 * nothing about is still listed — marked 未接入 with the reason — because a
 * missing area on screen would read as "nothing to retain".
 */
export function readRetention(payload: unknown): RetentionAnswer | null {
  const list = listIn(payload);
  if (list === null) return null;
  const rows = new Map<SectionKey, SectionRow>();
  for (const item of list) {
    const rec = isRecord(item) ? item : {};
    const key = sectionKeyOf(pick(rec, KEY_KEYS));
    if (!key || rows.has(key)) continue;
    const label = SECTIONS.find((s) => s.key === key)?.label ?? key;
    rows.set(key, rowOf(rec, label, key));
  }
  const sections = SECTIONS.map((spec) => {
    const found = rows.get(spec.key);
    if (found) return found;
    return {
      key: spec.key,
      label: spec.label,
      days: null,
      lastCleanup: null,
      nextRun: null,
      usedBytes: null,
      limitBytes: null,
      unwired: true,
      note: `服务的回答里没有这一区（${spec.label}）的保留信息，这一块按未接入记，不填默认值。`,
    } satisfies SectionRow;
  });
  const asOfRaw = isRecord(payload) ? pick(payload, ASOF_KEYS) : undefined;
  return {
    sections,
    answered: sections.filter((s) => !s.unwired).map((s) => s.key),
    asOf: text(asOfRaw),
  };
}

/** The unreachable surface, as the page paints it: four sections, all 未接入. */
export function unwiredSections(reason: string = UNWIRED_REASON): SectionRow[] {
  return SECTIONS.map((spec) => ({
    key: spec.key,
    label: spec.label,
    days: null,
    lastCleanup: null,
    nextRun: null,
    usedBytes: null,
    limitBytes: null,
    unwired: true,
    note: reason,
  }));
}

/** The error code inside a BFF failure body, when it carries one. */
export function codeOf(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  try {
    const parsed: unknown = JSON.parse(err.body);
    if (isRecord(parsed)) return text(parsed.code);
  } catch {
    return null;
  }
  return null;
}

export type ProbeKind = "unwired" | "denied" | "error";

export interface ProbeOutcome {
  kind: ProbeKind;
  status: number;
  requestId: string | null;
  technical: string | null;
  /** The envelope code (`console.unknown_route` …) — for the disclosure only. */
  code: string | null;
}

/**
 * What an answer means for this page.
 * - `console.unknown_route` 404: this deployment has no retention route → 未接入.
 * - any other 403/404: not reachable for this account → ONE denied body.
 * - everything else: a real failure, with its own sentence and trace id.
 */
export function probeOf(err: unknown): ProbeOutcome {
  if (err instanceof ApiError) {
    const status = err.status;
    const code = codeOf(err);
    const requestId = err.requestId ?? null;
    const technical = err.details;
    if (status === 404 && code === "console.unknown_route") return { kind: "unwired", status, requestId, technical, code };
    if (status === 403 || status === 404) return { kind: "denied", status, requestId, technical, code };
    return { kind: "error", status, requestId, technical, code };
  }
  return {
    kind: "error",
    status: -1,
    requestId: null,
    technical: err instanceof Error ? err.message : String(err),
    code: null,
  };
}

/** The sentence an error panel owes a person. No HTTP code, no wire field name. */
export function failureSentence(status: number): string {
  if (status === 0) return "连不上控制台服务，这一页的保留信息没有读到。请确认服务已经启动，然后重试。";
  if (status === 401) return "登录状态已经失效，请刷新页面重新登录后再看这一页。";
  if (status === 429) return "请求太频繁了，请稍等一会儿再重试。";
  if (status >= 500) return "控制台服务在处理这次读取时出了错，保留信息没有拿到，请稍后重试。";
  if (status === 400) return "这次读取的参数没有被服务接受，保留信息没有拿到。请重试一次。";
  return "保留策略这次没有读出来，请稍后重试。";
}

/** Beijing wall clock to the minute, or null when the instant cannot be read. */
export function beijingMinute(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ms));
  } catch {
    return null;
  }
}

/** Bytes in binary units, one decimal max; null stays null (never 0 B). */
export function formatBytes(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? String(Math.round(size)) : String(Math.round(size * 10) / 10);
  return `${rounded} ${units[unit]}`;
}

/**
 * Occupancy share as a whole percent. Never rounds a partial figure up to 100:
 * 99.6% reads 99%, and 100% only when the usage really reached the threshold.
 * Either side missing → null, because a ratio with no denominator is not 0%.
 */
export function occupancyShare(used: number | null, limit: number | null): number | null {
  if (used === null || limit === null) return null;
  if (!(limit > 0)) return null;
  if (used <= 0) return 0;
  if (used >= limit) return 100;
  return Math.min(99, Math.max(1, Math.floor((used / limit) * 100)));
}

export interface PlannedAction {
  id: "cleanup" | "policy";
  label: string;
  reason: string;
}

/** Write-shaped controls, declared here so the page can never claim they work. */
export const PLANNED_ACTIONS: readonly PlannedAction[] = [
  {
    id: "cleanup",
    label: "立即清理",
    reason: "清理执行面还没有接通：这个按钮不会真的清理任何数据，接线后才会启用。",
  },
  {
    id: "policy",
    label: "修改策略",
    reason: "保留策略的写入面还没有接通：这个按钮不会保存任何修改，接线后才会启用。",
  },
];