/**
 * /api/run-stats 读口（运行构成卡）。只做两件事：把窗口内的分桶与合计读成
 * 界面要的四个数，缺字段就留空——不拿 0 顶替读不到的值。
 *
 * 约束：`to > from`（同日区间会被 BFF 422），所以 from 直接取列表窗口的
 * since（「全部时间」= 纪元），to 取本次读取时刻；bucket=day。
 * `?state=` 复现腿不发起任何请求：enabled=false 时 hook 直接返回 error，
 * 由卡面写明「没有读数」。
 */
import { useEffect, useState } from "react";

import { fetchJSON } from "@/lib/api";
import { sinceIso, type SinceKey } from "./runs";

export interface RunStatsTotals {
  runs: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  interrupted: number;
  running: number;
  pending: number;
  costUsd: number | null;
  p95: number | null;
  successRate: number | null;
}

export interface RunStatsData {
  phase: "loading" | "ready" | "error";
  totals: RunStatsTotals | null;
  /** 今天（北京时间）这一桶的成本；没有今日分桶时是 null。 */
  todayCostUsd: number | null;
  /** 读不到时的原因句，直接上屏。 */
  reason: string | null;
}

const EMPTY: RunStatsData = { phase: "loading", totals: null, todayCostUsd: null, reason: null };

/** 复现腿的静态读数：不发请求，首次渲染就是这句。 */
const DISABLED: RunStatsData = {
  phase: "error",
  totals: null,
  todayCostUsd: null,
  reason: "复现腿不发起真实请求，这里不给统计读数。",
};

function record(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** 北京时间的 YYYY-MM-DD，用来认「今天」这一桶。 */
export function beijingDayKey(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function parseRunStats(
  body: unknown,
  todayKey: string,
): { totals: RunStatsTotals; todayCostUsd: number | null } | null {
  if (!record(body)) return null;
  const raw = record(body.totals) ? body.totals : null;
  if (raw === null) return null;
  const totals: RunStatsTotals = {
    runs: num(raw.runs) ?? 0,
    succeeded: num(raw.succeeded) ?? 0,
    failed: num(raw.failed) ?? 0,
    cancelled: num(raw.cancelled) ?? 0,
    interrupted: num(raw.interrupted) ?? 0,
    running: num(raw.running) ?? 0,
    pending: num(raw.pending) ?? 0,
    costUsd: num(raw.costUsd),
    p95: num(raw.p95),
    successRate: num(raw.successRate),
  };
  let todayCostUsd: number | null = null;
  if (Array.isArray(body.buckets)) {
    for (const bucket of body.buckets) {
      if (!record(bucket)) continue;
      const start = typeof bucket.bucketStart === "string" ? Date.parse(bucket.bucketStart) : NaN;
      if (!Number.isFinite(start)) continue;
      if (beijingDayKey(new Date(start)) !== todayKey) continue;
      todayCostUsd = num(bucket.costUsd);
    }
  }
  return { totals, todayCostUsd };
}

export function useRunStats(sinceKey: SinceKey, enabled: boolean): RunStatsData {
  const [state, setState] = useState<RunStatsData>(() => (enabled ? EMPTY : DISABLED));

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const to = new Date();
    const from = new Date(sinceIso(sinceKey));
    const qs = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      bucket: "day",
    });
    setState((prev) => ({ ...prev, phase: "loading", reason: null }));
    fetchJSON<unknown>(`/agent-api/api/run-stats?${qs.toString()}`)
      .then((body) => {
        if (!alive) return;
        const parsed = parseRunStats(body, beijingDayKey(to));
        if (parsed === null) {
          setState({
            phase: "error",
            totals: null,
            todayCostUsd: null,
            reason: "这次读到的运行统计形状不完整，数字留空。",
          });
          return;
        }
        setState({ phase: "ready", ...parsed, reason: null });
      })
      .catch(() => {
        if (!alive) return;
        setState({
          phase: "error",
          totals: null,
          todayCostUsd: null,
          reason: "运行统计这次没读到，数字留空，不按 0 算。",
        });
      });
    return () => {
      alive = false;
    };
  }, [sinceKey, enabled]);

  return state;
}