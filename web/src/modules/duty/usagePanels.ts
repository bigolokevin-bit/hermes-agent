/**
 * 用量与成本的面板腿 — 骨架这一屏除主读口外的三条辅助腿。
 *
 * 与 `useUsageData` 的分工：那条腿管「账本金额 + token + 模型明细」这份回答
 * 本身的四态；这里三条腿各自落地，永远不把整屏降级成错误页——任何一条挂掉
 * 只让它自己那一块写明「这一路没能读完」，正文该处只留「—」并进卡底
 * 「数据可用性」。
 *
 * 纪律：
 *  - `?state=` 复现腿一条请求都不发（`live=false`），面板不会带着真实数字。
 *  - 趋势腿与近 24 小时腿的 URL 当天之内恒定：切统计窗口既不重复发起、
 *    也不产生新参数（统计窗口只挪主读口与替代指标腿的窗参）。
 *  - 金额口径不变：今日已花仍只取 `hermes-usage?days=1` 的成本账本块；
 *    run-stats 的日成本是运行侧汇总，只进趋势卡的表与线，不写进账本口径。
 */
import { useEffect, useState } from "react";

import { fetchJSON } from "@/lib/api";
import { humanError, requestIdOf } from "./api";
import { parseUsage, usageUrl, type MoneyCell, type UsageWindowKey } from "./usage";

import {
  beijingDayWindow,
  runStatsUrl,
  trendDays,
  trendSummary,
} from "./usageTrend";
import type { DayWindow, TrendDay, TrendSummary } from "./usageTrend";
import { parseAttribution, parseSourceLegs } from "./usageSources";
import type { AttributionTokens, SourceLeg } from "./usageSources";

export type PanelPhase = "loading" | "ready" | "error";

export interface Panel<T> {
  phase: PanelPhase;
  data: T | null;
  /** 中文句子；工程原值不进这里。 */
  message: string | null;
  requestId: string | null;
  /** 请求原文，只配 `title` 与折叠的「技术详情」。 */
  url: string;
}

export interface TrendPanel {
  days: TrendDay[];
  summary: TrendSummary;
  /** 落在窗外或读不出日期的桶数（不画、不补 0）。 */
  offWindow: number;
  window: DayWindow;
}

/** 近 24 小时腿：今日实扣（账本）＋读口状态＋未归属实测，一份回答三处用。 */
export interface NearDayPanel {
  /** 账本成本块；回答没带时 null。 */
  cost: { cell: MoneyCell; entries: number | null } | null;
  sources: SourceLeg[];
  attribution: AttributionTokens | null;
  asOf: { shown: string; raw: string } | null;
}

/** 替代指标腿：workbench/summary 的计数类 KPI（金额类一律不进这张卡）。 */
export interface SummaryKpi {
  key: string;
  label: string | null;
  value: number | null;
  available: boolean;
  reason: string | null;
}

export interface UsagePanels {
  trend: Panel<TrendPanel>;
  nearDay: Panel<NearDayPanel>;
  summary: Panel<SummaryKpi[]>;
}

const WEEK_DAYS = 7;

const SUMMARY_RANGES: Record<UsageWindowKey, string> = {
  "24h": "1d",
  "7d": "7d",
  "30d": "30d",
};

function pending<T>(url = ""): Panel<T> {
  return { phase: "loading", data: null, message: null, requestId: null, url };
}

function settled<T>(url: string, data: T): Panel<T> {
  return { phase: "ready", data, message: null, requestId: null, url };
}

function failed<T>(url: string, err: unknown): Panel<T> {
  return { phase: "error", data: null, message: humanError(err), requestId: requestIdOf(err), url };
}

function summaryUrl(windowKey: UsageWindowKey): string {
  return `/agent-api/api/workbench/summary?range=${SUMMARY_RANGES[windowKey]}`;
}

/** kpis 块逐条收成计数；金额类（costUsd）由金额卡按账本口径处理，这里不收。 */
export function readSummaryKpis(body: unknown): SummaryKpi[] {
  const rows =
    body !== null && typeof body === "object" && Array.isArray((body as { kpis?: unknown }).kpis)
      ? ((body as { kpis: unknown[] }).kpis as unknown[])
      : [];
  return rows
    .filter((row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row))
    .map((row) => ({
      key: typeof row.key === "string" ? row.key : "",
      label: typeof row.label === "string" && row.label.trim() ? row.label.trim() : null,
      value: typeof row.value === "number" && Number.isFinite(row.value) ? row.value : null,
      available: row.available !== false,
      reason: typeof row.reason === "string" && row.reason.trim() ? row.reason.trim() : null,
    }))
    .filter((kpi) => kpi.key !== "" && kpi.key !== "costUsd" && kpi.key !== "cost_usd");
}

const BLANK_TREND: Panel<TrendPanel> = pending<TrendPanel>();
const BLANK_NEAR: Panel<NearDayPanel> = pending<NearDayPanel>();
const BLANK_SUMMARY: Panel<SummaryKpi[]> = pending<SummaryKpi[]>();

/**
 * 三条腿并发发起、各自落地。`live=false`（`?state=` 复现腿）时不发请求，
 * 并把读数清成空白，复现面板不会带着真实数字。`nonce` 由页头「重新读取」
 * 与主读口的重试一并推进。
 */
export function useUsagePanels(live: boolean, windowKey: UsageWindowKey, nonce: number): UsagePanels {
  const [trend, setTrend] = useState<Panel<TrendPanel>>(BLANK_TREND);
  const [nearDay, setNearDay] = useState<Panel<NearDayPanel>>(BLANK_NEAR);
  const [summary, setSummary] = useState<Panel<SummaryKpi[]>>(BLANK_SUMMARY);

  /* 趋势腿：只随 nonce 走，切统计窗口不重复发起。 */
  useEffect(() => {
    if (!live) {
      setTrend(BLANK_TREND);
      return;
    }
    let alive = true;
    // 每次重读都重算日界：跨零点刷新要拿新的北京日窗（URL 当天内稳定）。
    const week = beijingDayWindow(WEEK_DAYS, new Date());
    const url = runStatsUrl(week);
    setTrend(pending<TrendPanel>(url));
    void (async () => {
      try {
        const body = await fetchJSON<unknown>(url);
        const { days, offWindow } = trendDays(body, week.slots);
        if (alive) setTrend(settled(url, { days, summary: trendSummary(days), offWindow, window: week }));
      } catch (err) {
        if (alive) setTrend(failed(url, err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [nonce, live]);

  /* 近 24 小时腿：URL 恒为 days=1，窗口切换不重复发起。 */
  useEffect(() => {
    if (!live) {
      setNearDay(BLANK_NEAR);
      return;
    }
    let alive = true;
    const url = usageUrl("24h");
    setNearDay(pending<NearDayPanel>(url));
    void (async () => {
      try {
        const body = await fetchJSON<unknown>(url);
        const parsed = parseUsage(body);
        if (!alive) return;
        if (parsed.kind === "shape") {
          setNearDay({
            phase: "error",
            data: null,
            message: "这一路回的内容不是一份用量数据。",
            requestId: null,
            url,
          });
          return;
        }
        const read = parsed.read;
        setNearDay(
          settled(url, {
            cost: read.cost ? { cell: read.cost.cell, entries: read.cost.entries } : null,
            sources: parseSourceLegs(body),
            attribution: parseAttribution(body),
            asOf: read.asOf,
          }),
        );
      } catch (err) {
        if (alive) setNearDay(failed(url, err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [nonce, live]);

  /* 替代指标腿：窗参随统计窗口走，这是它该动的地方。 */
  useEffect(() => {
    if (!live) {
      setSummary(BLANK_SUMMARY);
      return;
    }
    let alive = true;
    const url = summaryUrl(windowKey);
    setSummary(pending<SummaryKpi[]>(url));
    void (async () => {
      try {
        const body = await fetchJSON<unknown>(url);
        if (alive) setSummary(settled(url, readSummaryKpis(body)));
      } catch (err) {
        if (alive) setSummary(failed(url, err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [nonce, live, windowKey]);

  return { trend, nearDay, summary };
}

/** 供页脚「技术详情」收拢三条腿的请求原文。 */
export function panelUrls(panels: Pick<UsagePanels, "trend" | "nearDay" | "summary">): string[] {
  return [panels.trend.url, panels.nearDay.url, panels.summary.url].filter((url) => url !== "");
}
