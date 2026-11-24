/**
 * Workbench read models (BFF: GET /api/workbench/{summary,agents,queue,timeseries}).
 *
 * The duty page's read-only statistics, queue and trend now read these four
 * endpoints instead of stitching the same numbers from /run-stats,
 * /approvals and /approval-stats. Each body carries a top-level `asOf`;
 * that value is the only collection time shown on screen — never the
 * browser clock. Missing numbers stay null («—»), never 0.
 */
import { fetchJSON } from "@/lib/api";
import type { ApprovalRow, ApprovalStatsBody, RunBucket, RunStatsBody } from "./types";

const WB = "/agent-api/api/workbench";

export interface WorkbenchStamp {
  asOf: string | null;
  asOfSource: string | null;
  available: boolean | null;
  degraded: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** ISO-8601 with a zone; anything else is not a collection time. */
export function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(v)) return null;
  return Number.isFinite(Date.parse(v)) ? v : null;
}

const ASOF_KEYS = ["asOf", "as_of", "collectedAt", "collected_at", "generatedAt", "generated_at"] as const;

export function readStamp(body: unknown): WorkbenchStamp {
  const b = isRecord(body) ? body : {};
  const stamp = ASOF_KEYS.map((key) => isoOrNull(b[key])).find((value) => value !== null) ?? null;
  const degradedRaw = Array.isArray(b.degraded) ? b.degraded : [];
  const degraded = degradedRaw
    .map((d) => (isRecord(d) ? text(d.error) ?? text(d.source) : null))
    .filter((x): x is string => x !== null);
  return {
    asOf: stamp,
    asOfSource: text(b.asOfSource),
    available: typeof b.available === "boolean" ? b.available : null,
    degraded,
  };
}

export async function fetchWorkbenchSummary(range = "1d"): Promise<unknown> {
  return fetchJSON<unknown>(`${WB}/summary?range=${encodeURIComponent(range)}`);
}

/** The ranges the workbench timeseries accepts; anything else is a 400. */
export const WB_TS_RANGES = ["24h", "1d", "7d", "30d"] as const;
export const WB_TS_METRICS = ["runs", "failed", "costUsd"] as const;

/**
 * The reader only serves 24h/1d/7d/30d, so a 14 day window asks for 30d and
 * keeps the last 14 day buckets. Totals are dropped: they describe the wider
 * window and must be recomputed from the kept points.
 */
export function trimTimeseries(body: unknown, days: number): unknown {
  if (!isRecord(body) || !Array.isArray(body.points)) return body;
  const points = body.points.slice(-Math.max(1, Math.trunc(days)));
  return { ...body, points, totals: null };
}

export async function fetchWorkbenchTimeseries(
  params: { range?: string; bucket?: string; metric?: string } = {},
): Promise<unknown> {
  const q = new URLSearchParams({
    range: params.range ?? "7d",
    bucket: params.bucket ?? "day",
    metric: params.metric ?? "runs",
  });
  return fetchJSON<unknown>(`${WB}/timeseries?${q.toString()}`);
}

export async function fetchWorkbenchQueue(params: { page_size?: number } = {}): Promise<unknown> {
  const q = new URLSearchParams({ page_size: String(params.page_size ?? 100) });
  return fetchJSON<unknown>(`${WB}/queue?${q.toString()}`);
}

interface Kpi {
  key: string;
  label: string | null;
  value: number | null;
  available: boolean;
  reason: string | null;
}

function readKpis(body: unknown): Kpi[] {
  const rows = isRecord(body) && Array.isArray(body.kpis) ? body.kpis : [];
  return rows.filter(isRecord).map((row) => ({
    key: text(row.key) ?? "",
    label: text(row.label),
    value: num(row.value),
    available: row.available !== false,
    reason: text(row.reason),
  }));
}

/**
 * Summary KPIs → the run-stats shape the「今日运行」card already renders.
 * `runs`/`failed`/`costUsd` come straight from the KPI values; fields the
 * read model does not carry (succeeded/running) stay null and print «—».
 */
export function summaryStats(body: unknown): RunStatsBody {
  const stamp = readStamp(body);
  const kpis = readKpis(body);
  const pick = (key: string) => kpis.find((k) => k.key === key)?.value ?? null;
  return {
    asOf: stamp.asOf ?? undefined,
    totals: {
      runs: pick("runs"),
      failed: pick("failed"),
      costUsd: pick("costUsd"),
    } as RunStatsBody["totals"],
  };
}

/** Timeseries points → run-stats buckets, skipping buckets the server left empty. */
export function timeseriesStats(body: unknown): RunStatsBody {
  const stamp = readStamp(body);
  const points = isRecord(body) && Array.isArray(body.points) ? body.points : [];
  const buckets: RunBucket[] = [];
  for (const point of points) {
    if (!isRecord(point)) continue;
    const bucketStart = text(point.ts);
    if (bucketStart === null) continue;
    // A null value is «no reading for this bucket», not 0: keep the point so the
    // axis keeps its length, and let the trend summary skip it.
    buckets.push({ bucketStart, runs: num(point.value) });
  }
  const totalsValue =
    isRecord(body) && isRecord(body.totals) ? num(body.totals.value) : null;
  const known = buckets.filter((b): b is typeof b & { runs: number } => b.runs !== null);
  const runs =
    totalsValue ?? (known.length > 0 ? known.reduce((sum, b) => sum + b.runs, 0) : null);
  return {
    asOf: stamp.asOf ?? undefined,
    totals: runs === null ? undefined : ({ runs } as RunStatsBody["totals"]),
    buckets,
  };
}

/** Queue items → approval rows (id/title/created/expires only; nothing invented). */
export function queueApprovals(body: unknown): ApprovalRow[] {
  const rows = isRecord(body) && Array.isArray(body.items) ? body.items : [];
  return rows
    .filter(isRecord)
    .map((row) => ({
      approvalId: text(row.id) ?? "",
      title: text(row.title) ?? undefined,
      status: text(row.status) ?? undefined,
      createdAt: isoOrNull(row.createdAt) ?? undefined,
      expiresAt: isoOrNull(row.timeoutAt) ?? undefined,
    }))
    .filter((row) => row.approvalId !== "");
}

/**
 * Queue total → the approval-stats shape. A failed source is not an empty
 * queue: `available:false` keeps the count null and passes the reason on.
 */
export function queueStats(body: unknown): ApprovalStatsBody & { asOf?: string; reason?: string } {
  const stamp = readStamp(body);
  const total = isRecord(body) ? num(body.total) : null;
  const available = stamp.available !== false && total !== null;
  return {
    asOf: stamp.asOf ?? undefined,
    pending: available ? total : undefined,
    dueSoon: undefined,
    // OM-19 T2D：degraded 在 available:true 时也要透传，partial 覆盖才能上屏。
    degraded: stamp.degraded,
    reason: available ? undefined : stamp.degraded[0] ?? (isRecord(body) ? text(body.reason) ?? undefined : undefined),
  };
}