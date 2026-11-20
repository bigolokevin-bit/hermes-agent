import { useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api-error";
import { SYS3_PATH, beijingMinute } from "./systemHealth";

/**
 * The /system page reads four endpoints in total: the health list on this page
 * and the three probes below it. The source matrix reuses those results — it
 * never issues a request of its own.
 */
export const SYS6_GAP = "GAP-SYS6-01";

export type SourceStatus = "idle" | "loading" | "ok" | "degraded" | "failed" | "unwired" | "skipped";

export const SOURCE_STATUS_LABEL: Record<SourceStatus, string> = {
  idle: "未读取",
  loading: "读取中",
  ok: "成功",
  degraded: "降级",
  failed: "失败",
  unwired: "读口未接入",
  skipped: "预览未读取",
};

export interface SourceRead {
  status: SourceStatus;
  statusReason: string | null;
  durationMs: number | null;
  durationReason: string | null;
  asOf: string | null;
  /** Raw top-level ISO from the payload; the only value the CSV may export. */
  asOfIso: string | null;
  /** Optional top-level `asOfSource` label supplied by the payload. */
  asOfSource?: string | null;
  asOfReason: string | null;
  requestId: string | null;
  /** Raw upstream failure text; only ever rendered as a title. */
  statusDetail?: string | null;
}

export interface SourceRow extends SourceRead {
  id: string;
  label: string;
  path: string;
  /** Real in-app route for this read point, or null when it has no page. */
  href?: string | null;
}

export interface SourceMatrixSnapshot {
  rows: SourceRow[];
  expanded: boolean;
}

const SOURCE_DEFS: Array<{ id: string; label: string; path: string; href: string | null }> = [
  { id: "health", label: "系统健康清单", path: SYS3_PATH, href: "#/system?tab=health" },
  { id: "console", label: "控制台服务探针", path: "/agent-api/api/__health-probe__", href: null },
  { id: "runtime", label: "Hermes 运行时探针", path: "/agent-api/api/hermes-summary", href: "#/capabilities?tab=channels" },
  { id: "domain", label: "域服务探针", path: "/agent-api/api/skills", href: "#/capabilities?tab=skills" },
];

const IDLE: SourceRead = {
  status: "idle",
  statusReason: null,
  durationMs: null,
  durationReason: "这次还没有发起读取。",
  asOf: null,
  asOfIso: null,
  asOfReason: "这次还没有发起读取，采集时刻未知。",
  requestId: null,
  statusDetail: null,
};

function cloneIdle(): SourceRead {
  return { ...IDLE };
}

let reads: Record<string, SourceRead> = {};
let expanded = false;
let snapshot: SourceMatrixSnapshot = buildSnapshot();
const listeners = new Set<() => void>();

function buildSnapshot(): SourceMatrixSnapshot {
  return {
    expanded,
    rows: SOURCE_DEFS.map((def) => ({ ...def, ...(reads[def.id] ?? cloneIdle()) })),
  };
}

function emit(): void {
  snapshot = buildSnapshot();
  listeners.forEach((listener) => listener());
}

export function resetSourceMatrix(): void {
  reads = {};
  expanded = false;
  emit();
}

export function publishSourceRead(id: string, patch: Partial<SourceRead>): void {
  const base = reads[id] ?? cloneIdle();
  reads = { ...reads, [id]: { ...base, ...patch } };
  emit();
}

export function markSourcesLoading(ids: string[]): void {
  ids.forEach((id) => publishSourceRead(id, {
    status: "loading",
    statusReason: null,
    durationMs: null,
    durationReason: "读取尚未结束，耗时未记录。",
    asOf: null,
    asOfIso: null,
    asOfReason: "读取尚未结束，采集时刻未知。",
    requestId: null,
  }));
}

export function markSourcesSkipped(ids: string[], reason: string): void {
  ids.forEach((id) => publishSourceRead(id, {
    status: "skipped",
    statusReason: reason,
    durationMs: null,
    durationReason: "预览态没有发起请求，没有本次耗时。",
    asOf: null,
    asOfIso: null,
    asOfReason: "预览态没有发起请求，采集时刻未知。",
    requestId: null,
  }));
}

export function toggleSourceMatrix(): void {
  expanded = !expanded;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SourceMatrixSnapshot {
  return snapshot;
}

export function useSourceMatrix(): SourceMatrixSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Only `payload.asOf` at the top level counts, and it must be an ISO timestamp. */
export function topLevelIsoAsOf(payload: unknown): {
  asOf: string | null;
  asOfIso: string | null;
  asOfSource: string | null;
  asOfReason: string | null;
} {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { asOf: null, asOfIso: null, asOfSource: null, asOfReason: "响应不是对象，读不到顶层 asOf，采集时刻未知。" };
  }
  const record = payload as Record<string, unknown>;
  const rawSource = record.asOfSource;
  const asOfSource = typeof rawSource === "string" && rawSource.trim() ? rawSource.trim() : null;
  const raw = record.asOf;
  if (typeof raw !== "string" || !raw.trim()) {
    return { asOf: null, asOfIso: null, asOfSource, asOfReason: "响应顶层没有 asOf，采集时刻未知。" };
  }
  const value = raw.trim();
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.test(value);
  if (!iso || Number.isNaN(new Date(value).getTime())) {
    return { asOf: null, asOfIso: null, asOfSource, asOfReason: "响应顶层 asOf 不是 ISO 时间，采集时刻未知。" };
  }
  const shown = beijingMinute(value);
  if (!shown) return { asOf: null, asOfIso: null, asOfSource, asOfReason: "响应顶层 asOf 无法解析，采集时刻未知。" };
  return { asOf: shown, asOfIso: value, asOfSource, asOfReason: null };
}

export function failureRead(error: unknown): SourceRead {
  const api = error instanceof ApiError ? error : null;
  const requestId = api?.requestId ?? null;
  if (api && (api.status === 403 || api.status === 404)) {
    return {
      status: "unwired",
      statusReason: "读口未接入：这个读取口还没有对控制台开放。",
      durationMs: null,
      durationReason: "请求失败，没有可用的本次耗时。",
      asOf: null,
      asOfIso: null,
      asOfReason: "请求失败，没有可读取的采集时刻。",
      requestId,
      statusDetail: api?.message ?? null,
    };
  }
  return {
    status: "failed",
    statusReason: "本次读取失败；请稍后重试或联系管理员。",
    durationMs: null,
    durationReason: "请求失败，没有可用的本次耗时。",
    asOf: null,
    asOfIso: null,
    asOfReason: "请求失败，没有可读取的采集时刻。",
    requestId,
    statusDetail: api?.message?.trim() || null,
  };
}

export function sourceDefinitions(): Array<{ id: string; label: string; path: string; href: string | null }> {
  return SOURCE_DEFS.map((def) => ({ ...def }));
}