// Module: metrics — 运行分析（7×24 活动热力）
//
// One read: /agent-api/api/run-activity?weeks=N&tz=Asia/Shanghai. The endpoint
// aggregates whole weeks, so there is no 24-hour window here. Absent cells stay
// absent (—); only a returned count of 0 is a real zero. No count is inferred
// from another endpoint, and no raw field name or HTTP status reaches the page.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Copy, RefreshCw } from 'lucide-react';

import { Button } from '@nous-research/ui/ui/components/button';
import { Card, CardContent } from '@nous-research/ui/ui/components/card';

import { copyTextToClipboard } from '@/lib/clipboard';
import { ApiError } from '@/lib/api-error';
import { fetchJsonStrict } from '@/modules/models/fetchJson';

import {
  METRICS_GAP,
  USAGE_GAP,
  WEEKDAY_LABELS,
  WINDOWS,
  WINDOW_PRESETS,
  BUDGET_THRESHOLDS,
  budgetLines,
  beijingDayKey,
  buildHeatGrid,
  cellRangeLabel,
  chunkIds,
  csvFileName,
  deltaOf,
  formatDeltaCount,
  formatDeltaUsd,
  formatBeijing,
  aggregateByEmployee,
  employeeLabel,
  formatCount,
  formatRate,
  formatUnitPrice,
  formatUsd,
  heatCellLabel,
  heatDayRows,
  heatFromStats,
  heatGridSummary,
  isoOrNull,
  metricsSummaryText,
  withGapNote,
  type ExportGap,
  ledgerAsOf,
  ledgerTotal,
  readActivity,
  readLedger,
  readModelCost,
  readModelUsage,
  readPricing,
  readRunStats,
  previousRange,
  parseSortDir,
  parseSortKey,
  shareCsv,
  shareCsvFileName,
  shareOfCosts,
  runsDrill,
  shortCode,
  sortModelCost,
  toCsv,
  usageTone,
  shareOf,
  sparkSlots,
  sparkSummaryText,
  EMPTY_SOURCE_STAMP,
  latestSourceAsOf,
  mergeSourceStamp,
  readSourceStamp,
  sourceKeyOfPath,
  sourceRows,
  usageWindowOf,
  windowRange,
  windowOf,
  windowRangeLabel,
  type Activity,
  type HeatCell,
  type LedgerRow,
  type BudgetLine,
  type ModelCostRow,
  type ModelCostSort,
  type PriceRow,
  type StatHeatGrid,
  type RunStats,
  type SortDir,
  type SourceStamp,
  type UsageWindowId,
} from './metrics';
import './metrics.css';

type PageState =
  | { kind: 'loading' }
  | { kind: 'empty'; activity: Activity; loadedAt: string; weeks: number }
  | { kind: 'error'; message: string; requestId: string | null; gap: string | null }
  | { kind: 'ready'; activity: Activity; loadedAt: string; weeks: number };

type Forced = 'loading' | 'empty' | 'error' | 'denied';

const EMPTY_ACTIVITY: Activity = { cells: [], max: null, from: null, to: null, tz: 'Asia/Shanghai' };

function readForced(params: URLSearchParams): Forced | null {
  const raw = params.get('state');
  return raw === 'loading' || raw === 'empty' || raw === 'error' || raw === 'denied' ? raw : null;
}

/** One read-only source, already settled: what it returned or why it did not. */
type UsageBlock<T> =
  | { kind: 'ready'; value: T }
  | { kind: 'unavailable'; reason: string; gap: string | null; requestId: string | null };

/** The five reads behind the usage cards; each one can be retried alone. */
type UsageBlockKind = 'stats' | 'prevRuns' | 'day' | 'month' | 'pricing';

interface LedgerSnapshot {
  total: number | null;
  asOf: string | null;
  rows: LedgerRow[];
  missing: number;
  truncated: boolean;
  names: Record<string, string>;
}

interface TrendSnapshot {
  stats: RunStats;
  from: string;
  to: string;
}

interface BreakdownLine {
  key: string;
  label: string;
  sub: string | null;
  costUsd: number | null;
  count: number | null;
  countNote: string | null;
  share: number | null;
  asOf: string | null;
}

interface CmpRow {
  id: UsageWindowId;
  label: string;
  runs: number | null;
  prevRuns: number | null;
  cost: number | null;
  prevCost: number | null;
  basis: string;
}

type CmpState = { kind: 'loading' } | UsageBlock<CmpRow[]>;

type ShareState =
  | { kind: 'loading' }
  | UsageBlock<{ rows: ModelCostRow[]; asOf: string | null; days: number; source: 'model' | 'employee' }>;

type BudgetState =
  | { kind: 'loading' }
  | UsageBlock<{ lines: BudgetLine[]; asOf: string | null; total: number | null; windowLabel: string }>;

type HeatState = { kind: 'loading' } | UsageBlock<StatHeatGrid>;

type BreakdownState =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      view: 'employee' | 'model';
      lines: BreakdownLine[];
      total: number | null;
      prevTotal: number | null;
      asOf: string | null;
      source: string;
      note: string | null;
    }
  | { kind: 'unavailable'; reason: string; gap: string | null; requestId: string | null };

type UsageState =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      window: UsageWindowId;
      stats: UsageBlock<TrendSnapshot>;
      day: UsageBlock<LedgerSnapshot>;
      month: UsageBlock<LedgerSnapshot>;
      pricing: UsageBlock<{ rows: PriceRow[]; asOf: string | null }>;
      prevRuns: UsageBlock<number | null>;
      loadedAt: string;
    };

/** 403 and 404 share one sentence: the page never says whether a source
 *  exists, only that this account cannot read it right now. */
function blockFailure(error: unknown): { reason: string; gap: string | null; requestId: string | null } {
  const status = error instanceof ApiError ? error.status : null;
  const requestId = error instanceof ApiError ? (error.requestId ?? null) : null;
  if (status === 403 || status === 404) {
    return {
      reason: '这项数据当前读不到：可能还没有接入，也可能当前账号没有查看权限。',
      gap: USAGE_GAP,
      requestId,
    };
  }
  if (status === 401) {
    return { reason: '登录状态已经失效，重新登录后再看。', gap: null, requestId };
  }
  if (status === 0) {
    return { reason: '控制台暂时没有回应，请稍后重试。', gap: null, requestId };
  }
  return { reason: '这次没能读取这项数据，请稍后重试。', gap: null, requestId };
}

function employeeIdsOf(payload: unknown): { ids: string[]; names: Record<string, string>; truncated: boolean } {
  if (typeof payload !== 'object' || payload === null) return { ids: [], names: {}, truncated: false };
  const record = payload as { items?: unknown; nextCursor?: unknown };
  const ids: string[] = [];
  const names: Record<string, string> = {};
  if (Array.isArray(record.items)) {
    for (const item of record.items) {
      if (typeof item !== 'object' || item === null) continue;
      const row = item as { employeeId?: unknown; name?: unknown };
      if (typeof row.employeeId !== 'string') continue;
      ids.push(row.employeeId);
      if (typeof row.name === 'string' && row.name.trim()) names[row.employeeId] = row.name.trim();
    }
  }
  const truncated = typeof record.nextCursor === 'string' && record.nextCursor.trim().length > 0;
  return { ids, names, truncated };
}

function requestIdOf(error: unknown): string | null {
  return error instanceof ApiError ? (error.requestId ?? null) : null;
}

function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) return '这次没能读取运行活动，请稍后重试。';
  if (error.status === 401) return '需要登录：这个页面的登录状态已经失效，请重新登录后再看。';
  if (error.status === 403) return '当前账号没有查看运行活动的权限。';
  if (error.status === 404) return '这项数据还没有接入；请联系管理员开通后重试。';
  if (error.status === 0) return '控制台暂时没有回应，请稍后重试。';
  return '这次没能读取运行活动，请稍后重试。';
}

function RequestId({ id }: { id: string | null }): ReactNode {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  if (!id) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="met5-request-id">
        本次请求未记录编号，可复制时间与操作路径反馈。
      </p>
    );
  }
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground" data-testid="met5-request-id">
      <span>请求编号：</span>
      <code className="min-w-0 break-all" title={id}>{id}</code>
      <button
        type="button"
        className="inline-flex items-center gap-1 underline underline-offset-2"
        aria-label="复制请求编号"
        onClick={() => {
          void copyTextToClipboard(id).then((ok) => setCopied(ok ? 'done' : 'failed'));
        }}
      >
        <Copy className="size-3" aria-hidden="true" />
        {copied === 'done' ? '已复制' : copied === 'failed' ? '复制失败，请手动选择' : '复制'}
      </button>
    </p>
  );
}

/** The same request id the freshness block shows, inline beside a card gap. */
function GapRid({ id, testId }: { id: string | null; testId: string }): ReactNode {
  if (!id) return null;
  return (
    <span className="metD-gap-rid" data-testid={testId}>
      {' '}· 请求编号{' '}
      <code className="break-all" title={id}>
        {id}
      </code>
    </span>
  );
}

/** A compact copy control for the request id of one source row. */
function SourceRidButton({ id, label, testId }: { id: string; label: string; testId: string }): ReactNode {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  return (
    <button
      type="button"
      className="metB-rid"
      data-testid={testId}
      aria-label={`复制${label}的请求编号`}
      title={id}
      onClick={() => {
        void copyTextToClipboard(id).then((ok) => setCopied(ok ? 'done' : 'failed'));
      }}
    >
      {copied === 'done' ? '已复制' : copied === 'failed' ? '复制失败' : '复制编号'}
    </button>
  );
}

/** A card-level retry: it re-reads that card's own source and nothing else. */
function CardRetryButton({ busy, onClick, testId }: { busy: boolean; onClick: () => void; testId: string }): ReactNode {
  return (
    <Button
      size="sm"
      outlined
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={onClick}
      data-testid={testId}
      className="metH-retry"
    >
      {busy ? '正在重试…' : '重试这一项'}
    </Button>
  );
}

function cellTone(cell: HeatCell): string {
  if (!cell.present) return 'is-missing';
  if (cell.count === 0) return 'is-zero';
  return `is-l${cell.level}`;
}

function cellText(cell: HeatCell): string {
  return cell.present ? `${cell.count} 次` : '接口未返回这一格（—）';
}

export function MetricsModulePage() {
  const [params, setParams] = useSearchParams();
  const forced = readForced(params);
  const usageWindow = usageWindowOf(params.get('window'));
  const groupBy: 'model' | 'employee' = params.get('groupBy') === 'employee' ? 'employee' : 'model';
  const sortKey = parseSortKey(params.get('sort'));
  const sortDir = parseSortDir(params.get('dir'), sortKey);
  const activeWindow = windowOf(params.get('w'));
  const weeks = activeWindow.weeks;
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [usage, setUsage] = useState<UsageState>({ kind: 'loading' });
  const [breakdown, setBreakdown] = useState<BreakdownState>({ kind: 'loading' });
  const [heat, setHeat] = useState<HeatState>({ kind: 'loading' });
  const [budget, setBudget] = useState<BudgetState>({ kind: 'loading' });
  const [cmp, setCmp] = useState<CmpState>({ kind: 'loading' });
  const [share, setShare] = useState<ShareState>({ kind: 'loading' });
  const [heatAt, setHeatAt] = useState<string>(new Date().toISOString());
  const [attempt, setAttempt] = useState(0);
  const [retryingBlock, setRetryingBlock] = useState<UsageBlockKind | null>(null);
  const [selected, setSelected] = useState<{ dow: number; hour: number } | null>(null);
  const [heatTableOpen, setHeatTableOpen] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState<'idle' | 'done' | 'failed'>('idle');
  const [summaryText, setSummaryText] = useState('');
  const [sources, setSources] = useState<Record<string, SourceStamp>>({});
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourcesSeen, setSourcesSeen] = useState(false);

  // Every card reads through this wrapper, so the freshness block records the
  // same responses the cards got — no extra request, no separate bookkeeping.
  //
  // A response only counts while the batch it belongs to is still current: when
  // the window, the grouping or the retry counter changes, the epoch moves and a
  // late answer from the previous batch can no longer put a collection time next
  // to numbers it did not produce.
  const sourceEpoch = useRef(0);
  const loadJson = useCallback(async (path: string): Promise<unknown> => {
    const key = sourceKeyOfPath(path);
    const epoch = sourceEpoch.current;
    try {
      const payload = await fetchJsonStrict(path);
      if (key && epoch === sourceEpoch.current) {
        setSourcesSeen(true);
        setSources((prev) => ({ ...prev, [key]: mergeSourceStamp(prev[key], readSourceStamp(payload)) }));
      }
      return payload;
    } catch (error) {
      if (key && epoch === sourceEpoch.current) {
        const failure = blockFailure(error);
        setSourcesSeen(true);
        setSources((prev) => ({
          ...prev,
          [key]: { ...EMPTY_SOURCE_STAMP, error: failure.reason, gap: failure.gap, requestId: failure.requestId },
        }));
      }
      throw error;
    }
  }, []);

  const load = useCallback(async (signal: { live: boolean }) => {
    setState({ kind: 'loading' });
    try {
      const payload = await loadJson(`/agent-api/api/run-activity?weeks=${weeks}&tz=Asia/Shanghai`);
      if (!signal.live) return;
      const parsed = readActivity(payload);
      if (parsed.kind === 'invalid') {
        setState({ kind: 'error', message: parsed.reason, requestId: null, gap: null });
        return;
      }
      const loadedAt = new Date().toISOString();
      if (parsed.activity.cells.length === 0) {
        setState({ kind: 'empty', activity: parsed.activity, loadedAt, weeks });
        return;
      }
      setState({ kind: 'ready', activity: parsed.activity, loadedAt, weeks });
    } catch (error) {
      if (!signal.live) return;
      const gap = error instanceof ApiError && error.status === 404 ? METRICS_GAP : null;
      setState({ kind: 'error', message: messageFor(error), requestId: requestIdOf(error), gap });
    }
  }, [weeks, loadJson]);

  useEffect(() => {
    if (forced) return;
    const signal = { live: true };
    void load(signal);
    return () => {
      signal.live = false;
    };
  }, [attempt, forced, load]);

  // The heat card retries only its own read; the cards below keep their numbers.
  const retryHeat = useCallback(() => {
    void load({ live: true });
  }, [load]);

  // One block of the usage card set. Each read settles on its own, so a source
  // that fails leaves only its own card without numbers while the others keep
  // theirs — the page never turns a single failure into a blank section.
  const readBlock = useCallback(
    async <T,>(
      run: () => Promise<unknown>,
      parse: (body: unknown) => { ok: true; value: T } | { ok: false; reason: string },
    ): Promise<UsageBlock<T>> => {
      try {
        const body = await run();
        const parsed = parse(body);
        if (!parsed.ok) return { kind: 'unavailable', reason: parsed.reason, gap: null, requestId: null };
        return { kind: 'ready', value: parsed.value };
      } catch (error) {
        return { kind: 'unavailable', ...blockFailure(error) };
      }
    },
    [],
  );

  const ledgerSnapshot = useCallback(
    async (periodKind: 'day' | 'month', period: string): Promise<LedgerSnapshot> => {
      const directory = employeeIdsOf(await loadJson('/agent-api/api/employees?limit=200'));
      if (directory.ids.length === 0) {
        return {
          total: null,
          asOf: null,
          rows: [],
          missing: 0,
          truncated: directory.truncated,
          names: directory.names,
        };
      }
      const bodies = await Promise.all(
        chunkIds(directory.ids).map((ids) =>
          loadJson(
            `/agent-api/api/budget-usage?employeeId=${ids.map(encodeURIComponent).join(',')}` +
              `&periodKind=${periodKind}&period=${encodeURIComponent(period)}`,
          ),
        ),
      );
      const rows: LedgerRow[] = [];
      let missing = 0;
      for (const body of bodies) {
        const parsed = readLedger(body);
        if (parsed.kind === 'invalid') throw new ApiError(parsed.reason, { status: 200, body: '', url: 'budget-usage' });
        rows.push(...parsed.rows);
        missing += parsed.missing.length;
      }
      return {
        total: ledgerTotal(rows),
        asOf: ledgerAsOf(rows),
        rows,
        missing,
        truncated: directory.truncated,
        names: directory.names,
      };
    },
    [loadJson],
  );

  // One block, one read chain. Retrying a card calls this with that kind alone,
  // so a retry cannot re-request the other cards' sources.
  const fetchUsageBlock = useCallback(
    async (kind: UsageBlockKind, windowId: UsageWindowId): Promise<UsageBlock<unknown>> => {
      const preset = usageWindowOf(windowId);
      const now = new Date();
      const range = windowRange(now, windowId);
      const today = beijingDayKey(now);
      const monthKey = today.slice(0, 7);
      const prev = previousRange(now, windowId);
      switch (kind) {
        case 'stats':
          return readBlock(
            () =>
              loadJson(
                `/agent-api/api/run-stats?from=${encodeURIComponent(range.from)}` +
                  `&to=${encodeURIComponent(range.to)}&bucket=${preset.bucket}`,
              ),
            (body) => {
              const parsed = readRunStats(body);
              return parsed.kind === 'ok'
                ? { ok: true, value: { stats: parsed.stats, from: range.from, to: range.to } }
                : { ok: false, reason: parsed.reason };
            },
          );
        case 'prevRuns':
          return readBlock(
            () =>
              loadJson(
                `/agent-api/api/run-stats?from=${encodeURIComponent(prev.from)}` +
                  `&to=${encodeURIComponent(prev.to)}&bucket=${preset.bucket}`,
              ),
            (body) => {
              const parsed = readRunStats(body);
              return parsed.kind === 'ok'
                ? { ok: true, value: parsed.stats.totals.runs }
                : { ok: false, reason: parsed.reason };
            },
          );
        case 'day':
          return readBlock(
            () => ledgerSnapshot('day', today),
            (body) => ({ ok: true, value: body as LedgerSnapshot }),
          );
        case 'month':
          return readBlock(
            () => ledgerSnapshot('month', monthKey),
            (body) => ({ ok: true, value: body as LedgerSnapshot }),
          );
        case 'pricing':
          return readBlock(
            () => loadJson('/agent-api/api/models/pricing'),
            (body) => {
              const parsed = readPricing(body);
              return parsed.kind === 'ok'
                ? { ok: true, value: { rows: parsed.rows, asOf: parsed.asOf } }
                : { ok: false, reason: parsed.reason };
            },
          );
      }
    },
    [ledgerSnapshot, loadJson, readBlock],
  );

  const loadUsage = useCallback(
    async (signal: { live: boolean }, windowId: UsageWindowId) => {
      setUsage({ kind: 'loading' });
      const stats = (await fetchUsageBlock('stats', windowId)) as UsageBlock<TrendSnapshot>;
      const prevRuns = (await fetchUsageBlock('prevRuns', windowId)) as UsageBlock<number | null>;
      const day = (await fetchUsageBlock('day', windowId)) as UsageBlock<LedgerSnapshot>;
      const month = (await fetchUsageBlock('month', windowId)) as UsageBlock<LedgerSnapshot>;
      const pricing = (await fetchUsageBlock('pricing', windowId)) as UsageBlock<{
        rows: PriceRow[];
        asOf: string | null;
      }>;
      if (!signal.live) return;
      setUsage({
        kind: 'ready',
        window: windowId,
        stats,
        day,
        month,
        pricing,
        prevRuns,
        loadedAt: new Date().toISOString(),
      });
    },
    [fetchUsageBlock],
  );

  // A card retry replaces exactly one block in place; everything already on the
  // screen stays there, including the numbers of the blocks that did read.
  const retryUsageBlock = useCallback(
    async (kind: UsageBlockKind) => {
      setRetryingBlock(kind);
      const block = await fetchUsageBlock(kind, usageWindow.id);
      // The other cards keep their own read time: replacing one block must not
      // make the rest look freshly read.
      setUsage((prev) => {
        if (prev.kind !== 'ready') return prev;
        switch (kind) {
          case 'stats':
            return { ...prev, stats: block as UsageBlock<TrendSnapshot> };
          case 'prevRuns':
            return { ...prev, prevRuns: block as UsageBlock<number | null> };
          case 'day':
            return { ...prev, day: block as UsageBlock<LedgerSnapshot> };
          case 'month':
            return { ...prev, month: block as UsageBlock<LedgerSnapshot> };
          case 'pricing':
            return { ...prev, pricing: block as UsageBlock<{ rows: PriceRow[]; asOf: string | null }> };
        }
      });
      setRetryingBlock(null);
    },
    [fetchUsageBlock, usageWindow.id],
  );

  useEffect(() => {
    if (forced) return;
    const signal = { live: true };
    void loadUsage(signal, usageWindow.id);
    return () => {
      signal.live = false;
    };
  }, [attempt, forced, loadUsage, usageWindow.id]);

  const viewMode: 'employee' | 'model' = params.get('view') === 'model' ? 'model' : 'employee';

  // A new batch starts on any of these: the collection times from the previous
  // batch described numbers that are about to leave the screen. The expanded or
  // collapsed choice is the reader's and survives the switch.
  useEffect(() => {
    sourceEpoch.current += 1;
    setSources((prev) => (Object.keys(prev).length === 0 ? prev : {}));
  }, [attempt, usageWindow.id, viewMode, groupBy, weeks]);

  const loadBreakdown = useCallback(
    async (signal: { live: boolean }, windowId: UsageWindowId, view: 'employee' | 'model') => {
      setBreakdown({ kind: 'loading' });
      const preset = usageWindowOf(windowId);
      const days = Math.max(1, Math.round(preset.hours / 24));
      const now = new Date();
      const dayKeys: string[] = [];
      for (let back = days - 1; back >= 0; back -= 1) {
        dayKeys.push(beijingDayKey(new Date(now.getTime() - back * 86_400_000)));
      }
      const prevDayKeys: string[] = [];
      for (let back = days * 2 - 1; back >= days; back -= 1) {
        prevDayKeys.push(beijingDayKey(new Date(now.getTime() - back * 86_400_000)));
      }
      try {
        if (view === 'model') {
          const parsed = readModelUsage(await loadJson(`/agent-api/api/hermes-usage?days=${days}`));
          if (parsed.kind === 'invalid') {
            setBreakdown({ kind: 'unavailable', reason: parsed.reason, gap: null, requestId: null });
            return;
          }
          const lines: BreakdownLine[] = parsed.lines.map((line) => ({
            key: `model-${line.model}`,
            label: line.model,
            sub:
              [line.inputTokens === null ? null : `输入 ${line.inputTokens}`, line.outputTokens === null ? null : `输出 ${line.outputTokens}`]
                .filter((part): part is string => part !== null)
                .join(' · ') || null,
            costUsd: null,
            count: line.apiCalls ?? line.sessions,
            countNote: line.apiCalls === null && line.sessions === null ? '上游没有给调用次数' : null,
            share: null,
            asOf: parsed.asOf,
          }));
          if (!signal.live) return;
          setBreakdown({
            kind: 'ready',
            view,
            lines,
            total: parsed.costUsd,
            prevTotal: null,
            asOf: parsed.asOf,
            source: 'Hermes 用量（按模型）',
            note: '上游按模型只给 token 与调用次数，金额不按模型拆分，所以支出列显示「—」。',
          });
          return;
        }

        const directory = employeeIdsOf(await loadJson('/agent-api/api/employees?limit=200'));
        const readDays = async (keys: string[]): Promise<LedgerRow[]> => {
          const bodies = await Promise.all(
            keys.flatMap((day) =>
              chunkIds(directory.ids).map((ids) =>
                loadJson(
                  `/agent-api/api/budget-usage?employeeId=${ids.map(encodeURIComponent).join(',')}` +
                    `&periodKind=day&period=${encodeURIComponent(day)}`,
                ),
              ),
            ),
          );
          const out: LedgerRow[] = [];
          for (const body of bodies) {
            const parsed = readLedger(body);
            if (parsed.kind === 'invalid') {
              throw new ApiError(parsed.reason, { status: 200, body: '', url: 'budget-usage' });
            }
            out.push(...parsed.rows);
          }
          return out;
        };
        const rows = await readDays(dayKeys);
        const prevRows = await readDays(prevDayKeys);
        const total = ledgerTotal(rows);
        const prevTotal = ledgerTotal(prevRows);
        const lines: BreakdownLine[] = aggregateByEmployee(rows, directory.names).map((row, index) => ({
          key: `emp-${row.employeeId ?? index}`,
          label: employeeLabel(row.name, row.employeeId),
          sub: null,
          costUsd: row.costUsd,
          count: null,
          countNote: '账本只记金额与用量，不记运行次数',
          share: shareOf(row.costUsd, total),
          asOf: row.asOf,
        }));
        if (!signal.live) return;
        setBreakdown({
          kind: 'ready',
          view,
          lines,
          total,
          prevTotal,
          asOf: ledgerAsOf(rows),
          source: '平台扣费账本（按员工日账合计）',
          note: '次数不在账本里，所以这一列显示「—」；占比按同窗口账本合计计算。',
        });
      } catch (error) {
        if (!signal.live) return;
        setBreakdown({ kind: 'unavailable', ...blockFailure(error) });
      }
    },
    [loadJson],
  );

  useEffect(() => {
    if (forced) return;
    const signal = { live: true };
    void loadBreakdown(signal, usageWindow.id, viewMode);
    return () => {
      signal.live = false;
    };
  }, [attempt, forced, loadBreakdown, usageWindow.id, viewMode]);

  const loadHeat = useCallback(async (signal: { live: boolean }) => {
    setHeat({ kind: 'loading' });
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * 3_600_000);
    try {
      const parsed = readRunStats(
        await loadJson(
          `/agent-api/api/run-stats?from=${encodeURIComponent(from.toISOString())}` +
            `&to=${encodeURIComponent(to.toISOString())}&bucket=hour`,
        ),
      );
      if (!signal.live) return;
      if (parsed.kind === 'invalid') {
        setHeat({ kind: 'unavailable', reason: parsed.reason, gap: null, requestId: null });
        return;
      }
      setHeat({ kind: 'ready', value: heatFromStats(parsed.stats) });
      setHeatAt(new Date().toISOString());
    } catch (error) {
      if (!signal.live) return;
      setHeat({ kind: 'unavailable', ...blockFailure(error) });
    }
  }, [loadJson]);

  useEffect(() => {
    if (forced) return;
    const signal = { live: true };
    void loadHeat(signal);
    return () => {
      signal.live = false;
    };
  }, [attempt, forced, loadHeat]);

  const loadBudget = useCallback(async (signal: { live: boolean }, windowId: UsageWindowId) => {
    setBudget({ kind: 'loading' });
    const preset = usageWindowOf(windowId);
    const days = Math.max(1, Math.round(preset.hours / 24));
    const now = new Date();
    const dayKeys: string[] = [];
    for (let back = days - 1; back >= 0; back -= 1) {
      dayKeys.push(beijingDayKey(new Date(now.getTime() - back * 86_400_000)));
    }
    try {
      const directory = employeeIdsOf(await loadJson('/agent-api/api/employees?limit=200'));
      const bodies = await Promise.all(
        dayKeys.flatMap((day) =>
          chunkIds(directory.ids).map((ids) =>
            loadJson(
              `/agent-api/api/budget-usage?employeeId=${ids.map(encodeURIComponent).join(',')}` +
                `&periodKind=day&period=${encodeURIComponent(day)}`,
            ),
          ),
        ),
      );
      const rows: LedgerRow[] = [];
      for (const body of bodies) {
        const parsed = readLedger(body);
        if (parsed.kind === 'invalid') throw new ApiError(parsed.reason, { status: 200, body: '', url: 'budget-usage' });
        rows.push(...parsed.rows);
      }
      const limits = new Map<string, number>();
      for (const row of rows) {
        if (!row.employeeId || row.limitUsd === null) continue;
        limits.set(row.employeeId, Math.max(limits.get(row.employeeId) ?? 0, row.limitUsd));
      }
      const synthetic: LedgerRow[] = aggregateByEmployee(rows, directory.names).map((row) => ({
        employeeId: row.employeeId,
        period: preset.id,
        tokensUsed: null,
        costUsd: row.costUsd,
        limitUsd: row.employeeId ? limits.get(row.employeeId) ?? null : null,
        runs: null,
        updatedAt: row.asOf,
      }));
      if (!signal.live) return;
      setBudget({
        kind: 'ready',
        value: {
          lines: budgetLines(synthetic, directory.names),
          asOf: ledgerAsOf(rows),
          total: ledgerTotal(rows),
          windowLabel: preset.label,
        },
      });
    } catch (error) {
      if (!signal.live) return;
      setBudget({ kind: 'unavailable', ...blockFailure(error) });
    }
  }, [loadJson]);

  useEffect(() => {
    if (forced) return;
    const signal = { live: true };
    void loadBudget(signal, usageWindow.id);
    return () => {
      signal.live = false;
    };
  }, [attempt, forced, loadBudget, usageWindow.id]);

  const loadCmp = useCallback(async (signal: { live: boolean }) => {
    setCmp({ kind: 'loading' });
    const now = new Date();
    const today = beijingDayKey(now);
    const monthKey = today.slice(0, 7);
    const prevMonthDate = new Date(`${monthKey}-01T00:00:00+08:00`);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevMonth = beijingDayKey(prevMonthDate).slice(0, 7);
    const dayKeys = (count: number, offset = 0) =>
      Array.from({ length: count }, (_, index) =>
        beijingDayKey(new Date(now.getTime() - (offset + index) * 86_400_000)),
      );

    try {
      const directory = employeeIdsOf(await loadJson('/agent-api/api/employees?limit=200'));
      const sumLedger = async (kind: 'day' | 'month', keys: string[]): Promise<number | null> => {
        const bodies = await Promise.all(
          keys.flatMap((key) =>
            chunkIds(directory.ids).map((ids) =>
              loadJson(
                `/agent-api/api/budget-usage?employeeId=${ids.map(encodeURIComponent).join(',')}` +
                  `&periodKind=${kind}&period=${encodeURIComponent(key)}`,
              ),
            ),
          ),
        );
        const rows: LedgerRow[] = [];
        for (const body of bodies) {
          const parsed = readLedger(body);
          if (parsed.kind === 'invalid') {
            throw new ApiError(parsed.reason, { status: 200, body: '', url: 'budget-usage' });
          }
          rows.push(...parsed.rows);
        }
        return ledgerTotal(rows);
      };
      const runsFor = async (from: string, to: string): Promise<number | null> => {
        const parsed = readRunStats(
          await loadJson(
            `/agent-api/api/run-stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&bucket=day`,
          ),
        );
        if (parsed.kind !== 'ok') throw new ApiError(parsed.reason, { status: 200, body: '', url: 'run-stats' });
        return parsed.stats.totals.runs;
      };

      const to = now.toISOString();
      const specs = [
        { id: '24h' as const, label: '最近 24 小时', hours: 24, kind: 'day' as const, keys: dayKeys(1), prevKeys: dayKeys(1, 1) },
        { id: '7d' as const, label: '最近 7 天', hours: 168, kind: 'day' as const, keys: dayKeys(7), prevKeys: dayKeys(7, 7) },
        { id: '30d' as const, label: '最近 30 天', hours: 720, kind: 'month' as const, keys: [monthKey], prevKeys: [prevMonth] },
      ];

      const rows = await Promise.all(
        specs.map(async (spec) => {
          const from = new Date(now.getTime() - spec.hours * 3_600_000).toISOString();
          const prevFrom = new Date(now.getTime() - spec.hours * 2 * 3_600_000).toISOString();
          const [runs, prevRuns, cost, prevCost] = await Promise.all([
            runsFor(from, to),
            runsFor(prevFrom, from),
            sumLedger(spec.kind, spec.keys),
            sumLedger(spec.kind, spec.prevKeys),
          ]);
          return {
            id: spec.id,
            label: spec.label,
            runs,
            prevRuns,
            cost,
            prevCost,
            basis: spec.kind === 'month' ? '本月 vs 上月（账本按月落账）' : `${spec.hours / 24} 天 vs 前 ${spec.hours / 24} 天`,
          };
        }),
      );

      if (!signal.live) return;
      setCmp({ kind: 'ready', value: rows });
    } catch (error) {
      if (!signal.live) return;
      setCmp({ kind: 'unavailable', ...blockFailure(error) });
    }
  }, [loadJson]);

  useEffect(() => {
    if (forced) return;
    const signal = { live: true };
    void loadCmp(signal);
    return () => {
      signal.live = false;
    };
  }, [attempt, forced, loadCmp]);

  const loadShare = useCallback(async (signal: { live: boolean }, windowId: UsageWindowId, view: 'model' | 'employee') => {
    setShare({ kind: 'loading' });
    const preset = usageWindowOf(windowId);
    const days = Math.max(1, Math.round(preset.hours / 24));
    try {
      if (view === 'model') {
        const parsed = readModelCost(await loadJson(`/agent-api/api/hermes-usage?days=${days}`));
        if (!signal.live) return;
        if (parsed.kind === 'invalid') {
          setShare({ kind: 'unavailable', reason: parsed.reason, gap: USAGE_GAP, requestId: null });
          return;
        }
        setShare({ kind: 'ready', value: { rows: parsed.rows, asOf: parsed.asOf, days, source: 'model' } });
        return;
      }
      const directory = employeeIdsOf(await loadJson('/agent-api/api/employees?limit=200'));
      const now = new Date();
      const dayKeys: string[] = [];
      for (let back = days - 1; back >= 0; back -= 1) {
        dayKeys.push(beijingDayKey(new Date(now.getTime() - back * 86_400_000)));
      }
      const bodies = await Promise.all(
        dayKeys.flatMap((day) =>
          chunkIds(directory.ids).map((ids) =>
            loadJson(
              `/agent-api/api/budget-usage?employeeId=${ids.map(encodeURIComponent).join(',')}` +
                `&periodKind=day&period=${encodeURIComponent(day)}`,
            ),
          ),
        ),
      );
      const rows: LedgerRow[] = [];
      for (const body of bodies) {
        const parsed = readLedger(body);
        if (parsed.kind === 'invalid') throw new ApiError(parsed.reason, { status: 200, body: '', url: 'budget-usage' });
        rows.push(...parsed.rows);
      }
      const mapped: ModelCostRow[] = aggregateByEmployee(rows, directory.names).map((row) => ({
        model: row.name ?? (row.employeeId ? `员工 · ${shortCode(row.employeeId)}` : '未署名员工'),
        key: row.employeeId ? shortCode(row.employeeId) : undefined,
        rawId: row.employeeId ?? undefined,
        runs: row.runs,
        costUsd: row.costUsd,
      }));
      if (!signal.live) return;
      setShare({ kind: 'ready', value: { rows: mapped, asOf: ledgerAsOf(rows), days, source: 'employee' } });
    } catch (error) {
      if (!signal.live) return;
      setShare({ kind: 'unavailable', ...blockFailure(error) });
    }
  }, [loadJson]);

  useEffect(() => {
    if (forced) return;
    const signal = { live: true };
    void loadShare(signal, usageWindow.id, groupBy);
    return () => {
      signal.live = false;
    };
  }, [attempt, forced, groupBy, loadShare, usageWindow.id]);

  const view: PageState = forced
    ? forced === 'loading'
      ? { kind: 'loading' }
      : forced === 'empty'
        ? { kind: 'empty', activity: EMPTY_ACTIVITY, loadedAt: new Date().toISOString(), weeks }
        : { kind: 'error', message: '预览状态：这次没能读取运行活动，请稍后重试。', requestId: null, gap: null }
    : state;

  const grid = view.kind === 'ready' ? buildHeatGrid(view.activity) : null;
  const heatDays = grid ? heatDayRows(grid) : [];
  const heatSummary = grid ? heatGridSummary(grid) : '';
  const selectedCell = selected && grid ? grid.rows[selected.dow - 1]?.cells[selected.hour] ?? null : null;

  const forcedDown = {
    kind: 'unavailable' as const,
    reason:
      forced === 'denied'
        ? '这项数据当前读不到：可能还没有接入，也可能当前账号没有查看权限。'
        : '这次没能读取这项数据，请稍后重试。',
    gap: forced === 'denied' ? USAGE_GAP : null,
    requestId: null,
  };
  const forcedEmptyLedger: UsageBlock<LedgerSnapshot> = {
    kind: 'ready',
    value: { total: null, asOf: null, rows: [], missing: 0, truncated: false, names: {} },
  };

  const usageView: UsageState = forced
    ? forced === 'loading'
      ? { kind: 'loading' }
      : {
          kind: 'ready',
          window: usageWindow.id,
          stats:
            forced === 'empty'
              ? {
                  kind: 'ready',
                  value: {
                    stats: {
                      from: null,
                      to: null,
                      buckets: [],
                      totals: { runs: 0, succeeded: 0, failed: 0, running: 0, sampleCount: 0, successRate: null },
                    },
                    from: new Date().toISOString(),
                    to: new Date().toISOString(),
                  },
                }
              : forcedDown,
          day: forced === 'empty' ? forcedEmptyLedger : forcedDown,
          month: forced === 'empty' ? forcedEmptyLedger : forcedDown,
          pricing: forcedDown,
          prevRuns: forced === 'empty' ? { kind: 'ready', value: 0 } : forcedDown,
          loadedAt: new Date().toISOString(),
        }
    : usage;

  const usageReady = usageView.kind === 'ready' ? usageView : null;
  const usageBlocks = usageReady ? [usageReady.stats, usageReady.day, usageReady.pricing] : [];
  const usageDown = usageReady !== null && usageBlocks.every((block) => block.kind === 'unavailable');
  const usageDenied =
    usageDown && usageBlocks.every((block) => block.kind === 'unavailable' && block.gap === USAGE_GAP);
  const usageLeadFailure = usageBlocks.find((block) => block.kind === 'unavailable');
  const usageLeadReason =
    usageLeadFailure && usageLeadFailure.kind === 'unavailable' ? usageLeadFailure.reason : null;
  const usageLeadRid =
    usageLeadFailure && usageLeadFailure.kind === 'unavailable' ? usageLeadFailure.requestId : null;
  const usageQuiet =
    usageReady !== null &&
    !usageDown &&
    usageReady.stats.kind === 'ready' &&
    usageReady.stats.value.stats.totals.runs === 0 &&
    usageReady.stats.value.stats.buckets.length === 0 &&
    usageReady.day.kind === 'ready' &&
    usageReady.day.value.rows.length === 0;
  const spark =
    usageReady && usageReady.stats.kind === 'ready'
      ? sparkSlots(
          usageReady.stats.value.stats,
          usageReady.stats.value.from,
          usageReady.stats.value.to,
          usageWindowOf(usageReady.window).slots,
        )
      : null;
  const sparkPeak = spark && spark.max !== null && spark.max > 0 ? spark.max : 1;
  const sparkSummaryLine = spark ? sparkSummaryText(spark, usageWindow.label) : '';
  const monthSnapshot = usageReady && usageReady.month.kind === 'ready' ? usageReady.month.value : null;
  const cmpView: CmpState = forced
    ? forced === 'loading'
      ? { kind: 'loading' }
      : forced === 'empty'
        ? { kind: 'ready', value: [] }
        : {
            kind: 'unavailable',
            reason:
              forced === 'denied'
                ? '这项数据当前读不到：可能还没有接入，也可能当前账号没有查看权限。'
                : '这次没能读取这项数据，请稍后重试。',
            gap: forced === 'denied' ? USAGE_GAP : null,
            requestId: null,
          }
    : cmp;

  const budgetView: BudgetState = forced
    ? forced === 'loading'
      ? { kind: 'loading' }
      : forced === 'empty'
        ? { kind: 'ready', value: { lines: [], asOf: null, total: null, windowLabel: usageWindow.label } }
        : {
            kind: 'unavailable',
            reason:
              forced === 'denied'
                ? '这项数据当前读不到：可能还没有接入，也可能当前账号没有查看权限。'
                : '这次没能读取这项数据，请稍后重试。',
            gap: forced === 'denied' ? USAGE_GAP : null,
            requestId: null,
          }
    : budget;

  const heatView: HeatState = forced
    ? forced === 'loading'
      ? { kind: 'loading' }
      : forced === 'empty'
        ? { kind: 'ready', value: { rows: [], presentCells: 0, total: null, max: null } }
        : {
            kind: 'unavailable',
            reason:
              forced === 'denied'
                ? '这项数据当前读不到：可能还没有接入，也可能当前账号没有查看权限。'
                : '这次没能读取这项数据，请稍后重试。',
            gap: forced === 'denied' ? USAGE_GAP : null,
            requestId: null,
          }
    : heat;

  const breakdownView: BreakdownState = forced
    ? forced === 'loading'
      ? { kind: 'loading' }
      : forced === 'empty'
        ? { kind: 'ready', view: viewMode, lines: [], total: null, prevTotal: null, asOf: null, source: '—', note: null }
        : {
            kind: 'unavailable',
            reason:
              forced === 'denied'
                ? '这项数据当前读不到：可能还没有接入，也可能当前账号没有查看权限。'
                : '这次没能读取这项数据，请稍后重试。',
            gap: forced === 'denied' ? USAGE_GAP : null,
            requestId: null,
          }
    : breakdown;

  const shareView: ShareState = forced
    ? forced === 'loading'
      ? { kind: 'loading' }
      : forced === 'empty'
        ? { kind: 'ready', value: { rows: [], asOf: null, days: Math.max(1, Math.round(usageWindow.hours / 24)), source: groupBy } }
        : {
            kind: 'unavailable',
            reason:
              forced === 'denied'
                ? '这项数据当前读不到：可能还没有接入，也可能当前账号没有查看权限。'
                : '这次没能读取这项数据，请稍后重试。',
            gap: forced === 'denied' ? USAGE_GAP : null,
            requestId: null,
          }
    : share;

  const shareRows =
    shareView.kind === 'ready'
      ? (() => {
          const sorted = sortModelCost(shareView.value.rows, sortKey, sortDir);
          const shares = shareOfCosts(sorted.map((row) => row.costUsd));
          return sorted.map((row, index) => {
            const raw = row.key ?? row.model;
            const slug = raw.replace(/[^0-9a-zA-Z]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || `row-${index}`;
            return {
              ...row,
              sharePct: shares[index],
              slug,
              drill: runsDrill(row, groupBy, usageWindow.id),
            };
          });
        })()
      : [];
  const sharePrefix = groupBy === 'employee' ? 'met8' : 'met7';
  const sortColumnLabel = sortKey === 'runs' ? '运行数' : sortKey === 'cost' ? '成本' : groupBy === 'employee' ? '员工' : '模型';
  const shareTotal = shareView.kind === 'ready' ? shareView.value.rows.reduce<number | null>((sum, row) => {
    if (row.costUsd === null) return sum;
    return (sum ?? 0) + row.costUsd;
  }, null) : null;

  const chooseGroupBy = (next: 'model' | 'employee') => {
    const query = new URLSearchParams(params);
    if (next === 'employee') query.set('groupBy', 'employee');
    else query.delete('groupBy');
    setParams(query, { replace: true });
  };

  const chooseSort = (next: ModelCostSort) => {
    const query = new URLSearchParams(params);
    const nextDir: SortDir = next === sortKey ? (sortDir === 'desc' ? 'asc' : 'desc') : next === 'model' ? 'asc' : 'desc';
    if (next === 'cost' && nextDir === 'desc') query.delete('sort');
    else query.set('sort', next);
    if (next === 'cost' && nextDir === 'desc') query.delete('dir');
    else query.set('dir', nextDir);
    setParams(query, { replace: true });
  };

  const currentRuns =
    usageReady && usageReady.stats.kind === 'ready' ? usageReady.stats.value.stats.totals.runs : null;
  const previousRuns = usageReady && usageReady.prevRuns.kind === 'ready' ? usageReady.prevRuns.value : null;
  const runsDelta = deltaOf(currentRuns, previousRuns, 'runs');

  const currentCost = breakdownView.kind === 'ready' ? breakdownView.total : null;
  const previousCost = breakdownView.kind === 'ready' ? breakdownView.prevTotal : null;
  const costDelta =
    viewMode === 'model'
      ? { kind: 'none' as const, reason: '按模型视图不提供金额，无法比较' }
      : deltaOf(currentCost, previousCost, 'usd');

  // One ordered array feeds both the table and its export. The file is written
  // row by row from this array, so it can never disagree with what the table
  // shows — no re-reading, no sorting from a different source, no object keys.
  const detailLines = breakdownView.kind === 'ready' ? breakdownView.lines : [];
  const exportable = detailLines.length > 0;
  // Only the blocks this file actually pulls columns from are named in its note:
  // a source nobody exported from is not a gap in the file.
  const pageFailed = usageDown;
  const detailGaps: ExportGap[] =
    usageReady && usageReady.stats.kind === 'unavailable'
      ? [{ label: '运行统计', reason: usageReady.stats.reason }]
      : [];
  const shareGaps: ExportGap[] = [];

  const exportCsv = () => {
    if (breakdownView.kind !== 'ready' || detailLines.length === 0) return;
    const header =
      viewMode === 'model'
        ? ['模型', '支出USD', '次数', '占比%', '读取于', '窗口', '窗口开始', '窗口结束', 'as_of', 'window']
        : ['员工', '支出USD', '次数', '占比%', '账本截至', '窗口', '窗口开始', '窗口结束', 'as_of', 'window'];
    const batchAsOf = isoOrNull(breakdownView.asOf);
    const rows = detailLines.map((line) => [
      line.label,
      line.costUsd === null ? null : line.costUsd.toFixed(2),
      line.count,
      line.share,
      line.asOf ? formatBeijing(line.asOf) : null,
      usageWindow.label,
      usageReady && usageReady.stats.kind === 'ready' ? formatBeijing(usageReady.stats.value.from) : null,
      usageReady && usageReady.stats.kind === 'ready' ? formatBeijing(usageReady.stats.value.to) : null,
      batchAsOf,
      usageWindow.id,
    ]);
    const body = withGapNote(toCsv(header, rows), detailGaps);
    const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = csvFileName(viewMode, usageWindow.id, new Date());
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportShare = () => {
    // Same array the share table renders, in the same order (already sorted by
    // ?sort/?dir, default cost descending). The file never re-sorts.
    if (shareView.kind !== 'ready' || shareRows.length === 0) return;
    const shareBody = withGapNote(
      shareCsv(
        shareRows.map((row) => ({
          name: row.model,
          runs: row.runs,
          costUsd: row.costUsd,
          sharePct: row.sharePct,
          asOf: isoOrNull(shareView.value.asOf),
          window: usageWindow.id,
        })),
      ),
      shareGaps,
    );
    const blob = new Blob([`\uFEFF${shareBody}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = shareCsvFileName(groupBy, usageWindow.id, new Date());
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const chooseView = (next: 'employee' | 'model') => {
    const query = new URLSearchParams(params);
    if (next === 'employee') query.delete('view');
    else query.set('view', next);
    setParams(query, { replace: true });
  };

  const chooseUsageWindow = (next: UsageWindowId) => {
    const query = new URLSearchParams(params);
    if (next === '24h') query.delete('window');
    else query.set('window', next);
    setParams(query, { replace: true });
  };

  const chooseWindow = (nextWeeks: number) => {
    setSelected(null);
    const next = new URLSearchParams(params);
    next.set('w', String(nextWeeks));
    setParams(next, { replace: true });
  };

  const sourceList = sourceRows(sources);
  const newestSource = latestSourceAsOf(sourceList);

  // metL — the plain-text summary repeats what this page already shows. Both
  // numbers and the collection time come from the batch in hand; the copy
  // handler issues no request.
  const summaryRuns =
    usageReady && usageReady.stats.kind === 'ready' ? usageReady.stats.value.stats.totals.runs : null;
  const summaryCost = usageReady && usageReady.day.kind === 'ready' ? usageReady.day.value.total : null;
  const summaryAsOf =
    [sources['run-stats']?.asOf ?? null, sources['budget-usage']?.asOf ?? null]
      .filter((stamp): stamp is string => typeof stamp === 'string' && stamp.length > 0)
      .sort()
      .at(-1) ?? null;
  const copySummary = () => {
    const text = metricsSummaryText({
      windowId: usageWindow.id,
      windowLabel: usageWindow.label,
      runs: summaryRuns,
      costUsd: summaryCost,
      groupBy,
      asOf: summaryAsOf,
      generatedAt: new Date().toISOString(),
    });
    setSummaryText(text);
    void copyTextToClipboard(text).then((ok) => setSummaryStatus(ok ? 'done' : 'failed'));
  };

  return (
    <main className="met5-page" data-testid="met5-page">
      <div className="met5-head">
        <div>
          <h1>运行分析</h1>
          <p>按星期与小时看运行都落在什么时段。没有记录的格子显示「—」，不补 0。</p>
        </div>
        <div className="met5-acts">
          <Button size="sm" outlined onClick={copySummary} data-testid="metL-copy">
            <Copy className="size-3.5" aria-hidden="true" />
            复制摘要
          </Button>
          <Button
            size="sm"
            outlined
            disabled={view.kind === 'loading'}
            onClick={() => setAttempt((value) => value + 1)}
            data-testid="met5-refresh"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            刷新
          </Button>
          <span className="metL-status" role="status" aria-live="polite" data-testid="metL-copy-status">
            {summaryStatus === 'done' ? '已复制' : summaryStatus === 'failed' ? '复制没成功' : ''}
          </span>
        </div>
      </div>

      {summaryStatus === 'failed' ? (
        <div className="metL-fallback" data-testid="metL-fallback">
          <p>
            这次没能写入剪贴板，可能是浏览器没有给权限。下面这段文字可以直接选中复制，内容与刚才要复制的一样。
          </p>
          <textarea
            readOnly
            value={summaryText}
            aria-label="运行分析摘要文本"
            data-testid="metL-fallback-text"
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      ) : null}

      {usageView.kind === 'loading' ? (
        <Card data-testid="met6-loading">
          <CardContent className="space-y-2 p-6">
            <div className="met5-skeleton h-5 w-36" />
            <div className="met5-skeleton h-4 w-64" />
            <div className="met5-skeleton h-28 w-full" />
          </CardContent>
        </Card>
      ) : (
        <section className="met6" data-testid="met6-section">
          <div className="met6-head">
            <h2>用量与成本</h2>
            <p>
              运行数与金额分属两本账：运行统计给次数与成功率，平台扣费账本给实际扣掉的钱，模型价目表给单价。三者各说各的，不互相换算。
            </p>
          </div>

          <div className="met6-window" role="group" aria-label="统计时间窗">
            {WINDOW_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                size="sm"
                outlined={preset.id !== usageWindow.id}
                aria-pressed={preset.id === usageWindow.id}
                onClick={() => chooseUsageWindow(preset.id)}
                data-testid={`met6-window-${preset.id}`}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {usageDown ? (
            <div data-testid="metH-page-error">
            <Card data-testid={usageDenied ? 'met6-denied' : 'met6-error'}>
              <CardContent className="space-y-2 p-6">
                <p className="font-medium">{usageDenied ? '这几项数据暂时读不到' : '这次没能读取用量与成本'}</p>
                <p className="text-sm text-muted-foreground" data-testid="metD-card-reason">
                  {usageLeadReason ??
                    (usageDenied
                      ? '这项数据当前读不到：可能还没有接入，也可能当前账号没有查看权限。'
                      : '这次没能读取这项数据，请稍后重试。')}
                </p>
                <p className="text-xs text-muted-foreground">
                  上面这句和「数据来源与新鲜度」里对应读口的那句是同一句，请求编号也是同一个——两处不各说一词。
                </p>
                <div data-testid="metD-card-rid">
                  <RequestId id={usageLeadRid} />
                </div>
                <Button size="sm" outlined onClick={() => setAttempt((value) => value + 1)} data-testid="met6-retry">
                  重试
                </Button>
              </CardContent>
            </Card>
            </div>
          ) : null}

          {usageQuiet ? (
            <Card data-testid="met6-empty">
              <CardContent className="space-y-2 p-6">
                <p className="font-medium">这个窗口还没有用量记录</p>
                <p className="text-sm text-muted-foreground">
                  运行统计没有返回这个窗口的运行，账本也没有今天的实扣行，因此这里既没有次数也没有金额——不补 0，也不拿别的时段顶替。
                </p>
                <div className="metD-empty-acts">
                  {usageWindow.id !== '7d' ? (
                    <Button size="sm" outlined onClick={() => chooseUsageWindow('7d')} data-testid="metD-empty-window">
                      换到 7 天看看
                    </Button>
                  ) : null}
                  <Button size="sm" outlined onClick={() => setAttempt((value) => value + 1)} data-testid="metD-empty-retry">
                    重新读取
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="met6-grid">
            <Card className="met6-card" data-testid="met6-runs">
              <CardContent className="space-y-1 p-4">
                <p className="met6-label">{usageWindow.label}运行</p>
                <p className="met6-value" data-testid="met6-runs-value">
                  {usageReady && usageReady.stats.kind === 'ready'
                    ? formatCount(usageReady.stats.value.stats.totals.runs)
                    : '—'}
                </p>
                <p className="met6-sub">
                  成功率{' '}
                  <span data-testid="met6-rate-value">
                    {usageReady && usageReady.stats.kind === 'ready'
                      ? formatRate(usageReady.stats.value.stats.totals.successRate)
                      : '—'}
                  </span>
                </p>
                <p className="met6-sub" data-testid="met6-delta-runs" title={runsDelta.kind === 'none' ? runsDelta.reason : '与上一周期等长窗口比较'}>
                  较上一周期 <span className="font-mono">{formatDeltaCount(runsDelta)}</span>
                </p>
                <p className="met6-hint">
                  {usageReady && usageReady.stats.kind === 'ready'
                    ? `${formatBeijing(usageReady.stats.value.from)} — ${formatBeijing(usageReady.stats.value.to)}（北京时间）`
                    : '窗口按北京时间计算；没有可统计样本时成功率显示「—」。'}
                </p>
                <p className="met6-source" data-testid="met6-runs-source">
                  来源：运行统计 · 读取于 {usageReady ? formatBeijing(usageReady.loadedAt) : '—'}
                </p>
                {usageReady && usageReady.stats.kind === 'unavailable' ? (
                  <div className="metH-card-error" data-testid="metH-card-error-runs">
                    <p className="met6-gap" data-testid="met6-runs-gap" title={usageReady.stats.gap ?? undefined}>
                      {usageReady.stats.reason}
                      <GapRid id={usageReady.stats.requestId} testId="metD-gap-rid-runs" />
                    </p>
                    <CardRetryButton
                      busy={retryingBlock === 'stats'}
                      onClick={() => void retryUsageBlock('stats')}
                      testId="metH-card-retry-runs"
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="met6-card" data-testid="met6-cost">
              <CardContent className="space-y-1 p-4">
                <p className="met6-label">实扣金额（账本）</p>
                <p className="met6-value" data-testid="met6-cost-value">
                  {usageReady && usageReady.day.kind === 'ready' ? formatUsd(usageReady.day.value.total) : '—'}
                </p>
                <p className="met6-sub">
                  本月累计{' '}
                  <span className="font-mono" data-testid="met6-cost-month">
                    {usageReady && usageReady.month.kind === 'ready' ? formatUsd(usageReady.month.value.total) : '—'}
                  </span>
                </p>
                <p className="met6-sub" data-testid="met6-delta-cost" title={costDelta.kind === 'none' ? costDelta.reason : '与上一周期等长窗口比较'}>
                  较上一周期 <span className="font-mono">{formatDeltaUsd(costDelta)}</span>
                </p>
                <p className="met6-hint">
                  {usageReady && usageReady.day.kind === 'ready' && usageReady.day.value.rows.length > 0
                    ? `今日账本实扣，按 ${usageReady.day.value.rows.length} 条员工日账合计`
                    : '账本实扣；没有实扣行时显示「—」，不按 0 记。'}
                </p>
                <p className="met6-source" data-testid="met6-cost-source">
                  来源：平台扣费账本 · 截至{' '}
                  {usageReady && usageReady.day.kind === 'ready' && usageReady.day.value.asOf
                    ? formatBeijing(usageReady.day.value.asOf)
                    : '—'}
                  {usageReady && usageReady.day.kind === 'ready' && usageReady.day.value.truncated
                    ? ' · 只统计了前 200 名员工的账本'
                    : ''}
                </p>
                {usageReady && usageReady.day.kind === 'unavailable' ? (
                  <div className="metH-card-error" data-testid="metH-card-error-cost">
                    <p className="met6-gap" data-testid="met6-cost-gap" title={usageReady.day.gap ?? undefined}>
                      {usageReady.day.reason}
                      <GapRid id={usageReady.day.requestId} testId="metD-gap-rid-cost" />
                    </p>
                    <CardRetryButton
                      busy={retryingBlock === 'day'}
                      onClick={() => void retryUsageBlock('day')}
                      testId="metH-card-retry-cost"
                    />
                  </div>
                ) : null}
                {usageReady && usageReady.month.kind === 'unavailable' ? (
                  <div className="metH-card-error" data-testid="metH-card-error-month">
                    <p className="met6-gap">
                      本月累计这次没有读出来，显示「—」。
                      <GapRid id={usageReady.month.requestId} testId="metH-gap-rid-month" />
                    </p>
                    <CardRetryButton
                      busy={retryingBlock === 'month'}
                      onClick={() => void retryUsageBlock('month')}
                      testId="metH-card-retry-month"
                    />
                  </div>
                ) : null}
                {usageReady && usageReady.day.kind === 'ready' && usageReady.day.value.total === null ? (
                  <p className="met6-gap" data-testid="met6-cost-gap">
                    {usageReady.day.value.rows.length > 0
                      ? '账本行没有给出金额，所以显示「—」。'
                      : '今天还没有账本实扣记录，所以显示「—」。'}
                  </p>
                ) : null}
                {monthSnapshot && monthSnapshot.rows.length > 0 ? (
                  <ul className="met6-rows" data-testid="met6-cost-rows">
                    {monthSnapshot.rows.slice(0, 8).map((row, index) => (
                      <li key={`${row.employeeId ?? 'row'}-${index}`} className="met6-row">
                        <span className="met6-row-who">
                          {employeeLabel(row.employeeId ? monthSnapshot.names[row.employeeId] ?? null : null, row.employeeId)}
                        </span>
                        <span className="met6-row-period">{row.period ?? '—'}</span>
                        <span className="met6-row-amount font-mono">{formatUsd(row.costUsd)}</span>
                        <span className="met6-row-asof">{row.updatedAt ? formatBeijing(row.updatedAt) : '—'}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {monthSnapshot && monthSnapshot.rows.length > 0 ? (
                  <p className="met6-hint">明细只列账本行；金额原样来自账本，不做换算。</p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="met6-card" data-testid="met6-trend">
              <CardContent className="space-y-1 p-4">
                <p className="met6-label">{usageWindow.label}趋势</p>
                {spark && spark.observed > 0 ? (
                  <svg
                    className="met6-spark"
                    viewBox="0 0 240 48"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={`${usageWindow.label}每${usageWindow.bucket === 'hour' ? '小时' : '天'}运行数，共 ${spark.observed} 个时段有记录`}
                    aria-describedby="metK-trend-summary"
                    data-testid="met6-sparkline"
                  >
                    {spark.slots.map((slot) => {
                      if (slot.runs === null) return null;
                      const height = Math.max(2, Math.round(((slot.runs ?? 0) / sparkPeak) * 44));
                      const width = 240 / spark.slots.length;
                      return (
                        <rect
                          key={slot.hour}
                          x={slot.hour * width + width * 0.1}
                          y={48 - height}
                          width={width * 0.8}
                          height={height}
                          rx={1.5}
                        />
                      );
                    })}
                  </svg>
                ) : (
                  <p className="met6-value met6-value-small" data-testid="met6-trend-value">
                    {usageReady && usageReady.stats.kind === 'ready' ? '没有运行' : '—'}
                  </p>
                )}
                <p id="metK-trend-summary" className="sr-only" data-testid="metK-trend-summary">
                  {sparkSummaryLine || '趋势：这次没有可报告的数据。'}
                </p>
                <p className="met6-hint">
                  {spark && spark.observed > 0
                    ? `共 ${spark.observed} 个时段有记录；空档表示那个时段接口没有返回运行，不按 0 画。`
                    : `${usageWindow.label}没有运行记录，所以没有趋势可画。`}
                </p>
                <p className="met6-source" data-testid="met6-trend-source">
                  来源：运行统计（每{usageWindow.bucket === 'hour' ? '小时' : '天'}） · 读取于{' '}
                  {usageReady ? formatBeijing(usageReady.loadedAt) : '—'}
                </p>
                {usageReady && usageReady.stats.kind === 'unavailable' ? (
                  <div className="metH-card-error" data-testid="metH-card-error-trend">
                    <p className="met6-gap" data-testid="met6-trend-gap" title={usageReady.stats.gap ?? undefined}>
                      {usageReady.stats.reason}
                      <GapRid id={usageReady.stats.requestId} testId="metD-gap-rid-trend" />
                    </p>
                    <CardRetryButton
                      busy={retryingBlock === 'stats'}
                      onClick={() => void retryUsageBlock('stats')}
                      testId="metH-card-retry-trend"
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="met6-card" data-testid="met6-price">
              <CardContent className="space-y-1 p-4">
                <p className="met6-label">单价（价目表）</p>
                {usageReady && usageReady.pricing.kind === 'ready' && usageReady.pricing.value.rows.length > 0 ? (
                  <ul className="met6-rows" data-testid="met6-price-rows">
                    {usageReady.pricing.value.rows.slice(0, 5).map((row, index) => (
                      <li key={`${row.modelId ?? 'model'}-${index}`} className="met6-row">
                        <span className="met6-row-who">{row.label}</span>
                        <span className="met6-row-amount font-mono">{formatUnitPrice(row.inputPerMillion, row.currency)}</span>
                        <span className="met6-row-asof">{row.asOf ? formatBeijing(row.asOf) : '—'}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="met6-value met6-value-small" data-testid="met6-price-value">
                    {usageReady && usageReady.pricing.kind === 'ready' ? '价目表为空' : '—'}
                  </p>
                )}
                <p className="met6-hint">单价是标价，不是扣费；本页不拿单价乘用量。缺失的单价显示「—」。</p>
                <p className="met6-source" data-testid="met6-price-source">
                  来源：模型价目表 · 截至{' '}
                  {usageReady && usageReady.pricing.kind === 'ready' && usageReady.pricing.value.asOf
                    ? formatBeijing(usageReady.pricing.value.asOf)
                    : '—'}
                </p>
                {usageReady && usageReady.pricing.kind === 'unavailable' ? (
                  <div className="metH-card-error" data-testid="metH-card-error-price">
                    <p className="met6-gap" data-testid="met6-price-gap" title={usageReady.pricing.gap ?? undefined}>
                      {usageReady.pricing.reason}
                      <GapRid id={usageReady.pricing.requestId} testId="metD-gap-rid-price" />
                    </p>
                    <CardRetryButton
                      busy={retryingBlock === 'pricing'}
                      onClick={() => void retryUsageBlock('pricing')}
                      testId="metH-card-retry-price"
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="met6-cat" data-testid="met6-cat">
            <div className="met6-cat-head">
              <h3>成本明细</h3>
              <div className="met6-window" role="group" aria-label="成本明细视角">
                <Button
                  size="sm"
                  outlined={viewMode !== 'employee'}
                  aria-pressed={viewMode === 'employee'}
                  onClick={() => chooseView('employee')}
                  data-testid="met6-cat-employee"
                >
                  按员工
                </Button>
                <Button
                  size="sm"
                  outlined={viewMode !== 'model'}
                  aria-pressed={viewMode === 'model'}
                  onClick={() => chooseView('model')}
                  data-testid="met6-cat-model"
                >
                  按模型
                </Button>
                <Button
                  size="sm"
                  outlined
                  disabled={pageFailed || !exportable}
                  title={
                    pageFailed
                      ? '整页读取失败，这份导出暂时不生成；先重试上面的读取，读到数据再导。'
                      : exportable
                        ? '导出明细 CSV：当前窗口与当前分类下账本逐行的实扣明细，不是分摊汇总。'
                        : '当前没有可导出的行：账本没有实扣行或上游没有给出模型行'
                  }
                  onClick={exportCsv}
                  data-testid="met6-export"
                >
                  导出明细 CSV
                </Button>
                {breakdownView.kind === 'unavailable' ? (
                  <span className="metI-gap" data-testid="metI-detail-blocked">
                    成本明细这次没读出来，明细导出暂不生成。
                  </span>
                ) : null}
                {detailGaps.length > 0 ? (
                  <span className="metI-gap" data-testid="metI-detail-gap">
                    本次导出缺少：{detailGaps.map((gap) => gap.label).join('、')}——文件末尾会写明原因，缺的列留空，不填 0。
                  </span>
                ) : null}
              </div>
            </div>

            {breakdownView.kind === 'loading' ? (
              <Card data-testid="met6-cat-loading">
                <CardContent className="space-y-2 p-4">
                  <div className="met5-skeleton h-4 w-40" />
                  <div className="met5-skeleton h-24 w-full" />
                </CardContent>
              </Card>
            ) : null}

            {breakdownView.kind === 'unavailable' ? (
              <Card data-testid="met6-cat-unavailable">
                <CardContent className="space-y-2 p-4">
                  <p className="font-medium">这份成本明细暂时读不到</p>
                  <p className="text-sm text-muted-foreground" title={breakdownView.gap ?? undefined}>
                    {breakdownView.reason}
                  </p>
                  <RequestId id={breakdownView.requestId} />
                  <Button size="sm" outlined onClick={() => setAttempt((value) => value + 1)} data-testid="met6-cat-retry">
                    重试
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {breakdownView.kind === 'ready' && breakdownView.lines.length === 0 ? (
              <Card data-testid="met6-cat-empty">
                <CardContent className="space-y-2 p-4">
                  <p className="font-medium">
                    {breakdownView.view === 'model' ? '上游没有给出按模型的用量' : '这个窗口的账本没有实扣行'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {breakdownView.view === 'model'
                      ? '按模型的明细来自 Hermes 用量；上游这次没有返回任何模型行，页面不补空行、不按 0 记。'
                      : '账本在这个窗口没有任何实扣行，所以没有可列的员工；不补 0，也不拿别的时段顶替。'}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {breakdownView.kind === 'ready' && breakdownView.lines.length > 0 ? (
              <>
                <div className="met6-table-scroll">
                  <table className="met6-table" data-testid="met6-table">
                    <thead>
                      <tr>
                        <th scope="col">{breakdownView.view === 'model' ? '模型' : '员工'}</th>
                        <th scope="col">支出</th>
                        <th scope="col">次数</th>
                        <th scope="col" className="met6-num" data-testid="metG-a11y-th-share">占比</th>
                        <th scope="col">账本截至</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailLines.map((line, index) => (
                        <tr key={line.key} data-testid={`met6-row-${index}`}>
                          <td>
                            <span className="met6-rowname">{line.label}</span>
                            {line.sub ? <span className="met6-rowsub">{line.sub}</span> : null}
                          </td>
                          <td className="met6-num">{formatUsd(line.costUsd)}</td>
                          <td className="met6-num">
                            {line.count ?? '—'}
                            {line.countNote ? <span className="met6-rowsub">{line.countNote}</span> : null}
                          </td>
                          <td className="met6-num">{line.share === null ? '—' : `${line.share}%`}</td>
                          <td className="met6-num">{line.asOf ? formatBeijing(line.asOf) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="met6-source" data-testid="met6-cat-source">
                  来源：{breakdownView.source} · 截至{' '}
                  {breakdownView.asOf ? formatBeijing(breakdownView.asOf) : '—'}
                  {' · 合计 '}
                  <span className="font-mono" data-testid="met6-cat-total">
                    {formatUsd(breakdownView.total)}
                  </span>
                  {` · ${breakdownView.lines.length} 行`}
                </p>
                {breakdownView.note ? <p className="met6-hint">{breakdownView.note}</p> : null}
              </>
            ) : null}
          </div>

          <div className="met6-budget" data-testid="met6-budget">
            <div className="met6-cat-head">
              <h3>预算执行 vs 实扣</h3>
              <span className="met6-hint">{usageWindow.label}</span>
            </div>

            {budgetView.kind === 'loading' ? (
              <Card data-testid="met6-budget-loading">
                <CardContent className="p-4">
                  <div className="met5-skeleton h-24 w-full" />
                </CardContent>
              </Card>
            ) : null}

            {budgetView.kind === 'unavailable' ? (
              <Card data-testid="met6-budget-unavailable">
                <CardContent className="space-y-2 p-4">
                  <p className="font-medium">这份预算执行暂时读不到</p>
                  <p className="text-sm text-muted-foreground" title={budgetView.gap ?? undefined}>
                    {budgetView.reason}
                  </p>
                  <RequestId id={budgetView.requestId} />
                  <Button size="sm" outlined onClick={() => setAttempt((value) => value + 1)} data-testid="met6-budget-retry">
                    重试
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {budgetView.kind === 'ready' && budgetView.value.lines.length === 0 ? (
              <Card data-testid="met6-budget-empty">
                <CardContent className="space-y-2 p-4">
                  <p className="font-medium">预算读口未接入</p>
                  <p className="text-sm text-muted-foreground" title={USAGE_GAP}>
                    账本在这个窗口没有返回任何预算行，所以这块不画表、不补 0，也不放样例数据。
                  </p>
                  <RequestId id={null} />
                  <Button size="sm" outlined onClick={() => setAttempt((value) => value + 1)} data-testid="met6-budget-retry">
                    重试
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {budgetView.kind === 'ready' && budgetView.value.lines.length > 0 ? (
              <>
                <div className="met6-table-scroll">
                  <table className="met6-table" data-testid="met6-budget-table">
                    <thead>
                      <tr>
                        <th scope="col">科目</th>
                        <th scope="col">预算</th>
                        <th scope="col">已用</th>
                        <th scope="col">剩余</th>
                        <th scope="col">使用率</th>
                        <th scope="col">超支/结余</th>
                        <th scope="col">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetView.value.lines.map((line, index) => (
                        <tr key={line.key} data-testid={`met6-budget-row-${index}`}>
                          <td>
                            <span className="met6-rowname">{line.subject}</span>
                            <span className="met6-rowsub">{line.asOf ? formatBeijing(line.asOf) : '—'}</span>
                          </td>
                          <td className="met6-num" title={line.gap ?? undefined}>
                            {formatUsd(line.budget)}
                          </td>
                          <td className="met6-num">{formatUsd(line.used)}</td>
                          <td className="met6-num" title={line.gap ?? undefined}>
                            {formatUsd(line.remaining)}
                          </td>
                          <td
                            className={`met6-num met6-budget-pct is-${usageTone(line.usagePct) ?? 'none'}`}
                            title={line.gap ?? BUDGET_THRESHOLDS}
                          >
                            {line.usagePct === null ? '—' : `${line.usagePct}%`}
                          </td>
                          <td
                            className={`met6-num met6-budget-variance is-${line.variance ?? 'none'}`}
                            data-testid={`met6-budget-variance-${index}`}
                            title={line.gap ?? BUDGET_THRESHOLDS}
                          >
                            {line.variance === null
                              ? '—'
                              : line.variance === 'surplus'
                                ? `结余 ${formatUsd(line.remaining)}`
                                : line.variance === 'deficit'
                                  ? `超支 ${formatUsd(line.remaining === null ? null : Math.abs(line.remaining))}`
                                  : '刚好用完'}
                          </td>
                          <td data-testid={`met6-budget-status-${index}`}>
                            {line.status === null ? (
                              <span title={line.gap ?? undefined}>—</span>
                            ) : (
                              <span className={`met6-budget-badge is-${line.status}`} title={BUDGET_THRESHOLDS}>
                                {line.status === 'over' ? '超支' : line.status === 'warn' ? '接近' : '正常'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="met6-source" data-testid="met6-budget-source">
                  来源：平台扣费账本（{budgetView.value.windowLabel}） · 截至{' '}
                  {budgetView.value.asOf ? formatBeijing(budgetView.value.asOf) : '—'}
                  {' · 合计 '}
                  <span className="font-mono" data-testid="met6-budget-total">
                    {formatUsd(budgetView.value.total)}
                  </span>
                </p>
                <p className="met6-hint">
                  已用只认账本实扣；阈值：{BUDGET_THRESHOLDS}账本没有给出预算上限时，预算、剩余、使用率与超支结余都显示「—」，不按 0 记。
                </p>
              </>
            ) : null}
          </div>

          <div className="met6-heat" data-testid="met6-heat">
            <div className="met6-cat-head">
              <h3>7×24 活跃热力</h3>
              <span className="met6-hint">最近 7 天 · 北京时间</span>
            </div>
            {heatView.kind === 'loading' ? (
              <Card data-testid="met6-heat-loading">
                <CardContent className="p-4">
                  <div className="met5-skeleton h-32 w-full" />
                </CardContent>
              </Card>
            ) : null}
            {heatView.kind === 'unavailable' ? (
              <Card data-testid="met6-heat-unavailable">
                <CardContent className="space-y-2 p-4">
                  <p className="font-medium">这份活跃热力暂时读不到</p>
                  <p className="text-sm text-muted-foreground" title={heatView.gap ?? undefined}>
                    {heatView.reason}
                  </p>
                  <RequestId id={heatView.requestId} />
                  <Button size="sm" outlined onClick={() => setAttempt((value) => value + 1)} data-testid="met6-heat-retry">
                    重试
                  </Button>
                </CardContent>
              </Card>
            ) : null}
            {heatView.kind === 'ready' && heatView.value.presentCells === 0 ? (
              <Card data-testid="met6-heat-empty">
                <CardContent className="space-y-2 p-4">
                  <p className="font-medium">最近 7 天没有按小时的运行记录</p>
                  <p className="text-sm text-muted-foreground">
                    接口一个运行时段都没有返回，所以不画格子、不补 0，也不把空白当成「运行了 0 次」。
                  </p>
                  <Button size="sm" outlined onClick={() => setAttempt((value) => value + 1)} data-testid="met6-heat-retry">
                    重试
                  </Button>
                </CardContent>
              </Card>
            ) : null}
            {heatView.kind === 'ready' && heatView.value.presentCells > 0 ? (
              <>
                <div className="met5-scroll">
                  <div className="met5-gridwrap">
                    <div className="met5-grid" data-testid="met6-heat-grid">
                      <span className="met5-corner" aria-hidden="true" />
                      {Array.from({ length: 24 }, (_, hour) => (
                        <span key={hour} className="met5-hour" aria-hidden="true">
                          {String(hour).padStart(2, '0')}
                        </span>
                      ))}
                      {heatView.value.rows.map((row) => (
                        <div className="met5-rowline" key={row.dow} role="row">
                          <span className="met5-day" role="rowheader">{row.label}</span>
                          {row.cells.map((cell) => {
                            const tone = !cell.present ? 'is-missing' : cell.runs === 0 ? 'is-zero' : `is-l${cell.level}`;
                            const hh = String(cell.hour).padStart(2, '0');
                            const label = cell.present
                              ? `${cell.at ? formatBeijing(cell.at) : `${row.label} ${hh}:00`}（北京时间） · ${cell.runs} 次 · 强度 ${cell.level} 档（共 4 档） · 成本 —（账本按日/月记账，没有小时粒度）`
                              : `${row.label} ${hh}:00（北京时间） · 无数据（接口没有返回这一格，不当作 0 次）`;
                            return (
                              <button
                                key={cell.hour}
                                type="button"
                                role="gridcell"
                                className={`met5-cell ${tone}`}
                                data-testid={`met6-heat-cell-${cell.dow}-${cell.hour}`}
                                title={label}
                                aria-label={label}
                              >
                                <span className="met5-cell-dot" aria-hidden="true" />
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="met6-source" data-testid="met6-heat-source">
                  来源：运行统计（每小时，最近 7 天） · 读取于 {formatBeijing(heatAt)}
                  {' · 有记录 '}
                  <span className="font-mono" data-testid="met6-heat-count">{heatView.value.presentCells}</span>
                  {' 格 · 合计 '}
                  <span className="font-mono" data-testid="met6-heat-total">{formatCount(heatView.value.total)}</span>
                  {' 次'}
                </p>
                <div className="met5-legend" data-testid="met6-heat-legend">
                  <span>少</span>
                  {[1, 2, 3, 4].map((level) => (
                    <span key={level} className={`met5-swatch is-l${level}`} aria-hidden="true" />
                  ))}
                  <span>多</span>
                  <span className="met5-swatch is-zero" aria-hidden="true" />
                  <span>0 次</span>
                  <span className="met5-swatch is-missing" aria-hidden="true" />
                  <span>无数据</span>
                </div>
                <p className="met6-hint">
                  色阶只表达返回过的运行密度；返回 0 的格子是「这一小时真的没跑」，接口没返回的格子标「无数据」，两者不混。成本没有小时粒度，tooltip 里统一显示「—」。左右滑动看 12–23 点。
                </p>
              </>
            ) : null}
          </div>

          <div className="met6-cmp" data-testid="met6-cmp">
            <div className="met6-cat-head"><h3>窗口对比（较上一周期）</h3></div>
            {cmpView.kind === 'loading' ? (
              <Card data-testid="met6-cmp-loading"><CardContent className="p-4"><div className="met5-skeleton h-24 w-full" /></CardContent></Card>
            ) : null}
            {cmpView.kind === 'unavailable' ? (
              <Card data-testid="met6-cmp-unavailable">
                <CardContent className="space-y-2 p-4">
                  <p className="font-medium">这份窗口对比暂时读不到</p>
                  <p className="text-sm text-muted-foreground" title={cmpView.gap ?? undefined}>{cmpView.reason}</p>
                  <RequestId id={cmpView.requestId} />
                  <Button size="sm" outlined onClick={() => setAttempt((value) => value + 1)} data-testid="met6-cmp-retry">重试</Button>
                </CardContent>
              </Card>
            ) : null}
            {cmpView.kind === 'ready' && cmpView.value.length === 0 ? (
              <Card data-testid="met6-cmp-empty">
                <CardContent className="space-y-2 p-4">
                  <p className="font-medium">没有可对比的窗口</p>
                  <p className="text-sm text-muted-foreground">运行统计与账本都没有返回可比的数字，这里不补 0。</p>
                </CardContent>
              </Card>
            ) : null}
            {cmpView.kind === 'ready' && cmpView.value.length > 0 ? (
              <>
                <div className="met6-table-scroll">
                  <table className="met6-table" data-testid="met6-cmp-table">
                    <thead>
                      <tr>
                        <th scope="col">窗口</th>
                        <th scope="col">运行数</th>
                        <th scope="col">较上一周期</th>
                        <th scope="col">成本</th>
                        <th scope="col">较上一周期</th>
                        <th scope="col">口径</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cmpView.value.map((row) => {
                        const runsDelta = deltaOf(row.runs, row.prevRuns, 'runs');
                        const costDelta = deltaOf(row.cost, row.prevCost, 'usd');
                        return (
                          <tr key={row.id} data-testid={`met6-cmp-row-${row.id}`}>
                            <td>{row.label}</td>
                            <td className="met6-num">{formatCount(row.runs)}</td>
                            <td className="met6-num" data-testid={`met6-cmp-runs-delta-${row.id}`}
                              title={runsDelta.kind === 'none' ? runsDelta.reason : '与上一等长窗口的运行数比较'}>
                              {formatDeltaCount(runsDelta)}
                            </td>
                            <td className="met6-num" data-testid={`met6-cmp-cost-${row.id}`}
                              title={row.cost === null ? '这个窗口的账本没有实扣行' : '账本实扣 USD'}>
                              {formatUsd(row.cost)}
                            </td>
                            <td className="met6-num" data-testid={`met6-cmp-cost-delta-${row.id}`}
                              title={costDelta.kind === 'none' ? costDelta.reason : '账本实扣，与上一等长窗口比较'}>
                              {formatDeltaUsd(costDelta)}
                            </td>
                            <td className="met6-rowsub">{row.basis}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="met6-hint">成本只认账本实扣；没有实扣行显示「—」，真实 0 显示零额；差值只做对比，不是花费预测。</p>
              </>
            ) : null}
          </div>

          <div className="met7-share" data-testid="met7-share">
            <div className="met6-cat-head">
              <div>
                <h3>成本分摊</h3>
                <p className="met6-rowsub" data-testid="metA-scope-note">这里是聚合行；逐行明细用上方的「导出明细 CSV」。</p>
                <p className="met6-rowsub" data-testid="metJ-export-order-note">
                  两份导出逐行照屏上表体顺序写：屏上第一行就是文件第一行。分摊按当前排序（默认成本从高到低），明细照表体原序。
                </p>
                <p className="met6-rowsub" data-testid="metF-export-asof-note">两份导出末尾都带「采集时刻」与「时间窗」两列：采集时刻只取上游返回的值，上游没给就留空，不拿本机时间顶替；时间窗标出这份数据统计的是哪一段。行数与屏上一致。</p>
                <p className="met6-rowsub">只认账本实扣；上游没给出金额的行显示「—」，不按 0 计，也不拿估算金额顶替。</p>
              </div>
            </div>
            <div className="met7-view" role="group" aria-label="分摊视图">
              <Button
                size="sm"
                outlined={groupBy !== 'model'}
                aria-pressed={groupBy === 'model'}
                onClick={() => chooseGroupBy('model')}
                data-testid="met8-view-model"
              >
                按模型
              </Button>
              <Button
                size="sm"
                outlined={groupBy !== 'employee'}
                aria-pressed={groupBy === 'employee'}
                onClick={() => chooseGroupBy('employee')}
                data-testid="met8-view-employee"
              >
                按员工
              </Button>
              <Button
                size="sm"
                outlined
                disabled={pageFailed || shareRows.length === 0}
                title={
                  pageFailed
                    ? '整页读取失败，这份导出暂时不生成；先重试上面的读取，读到数据再导。'
                    : shareRows.length === 0
                      ? '当前视图无可导出数据'
                      : '导出分摊 CSV：当前窗口、分组与排序下的聚合行，含成本与占比，不是账本逐行明细。'
                }
                onClick={exportShare}
                data-testid="metA-export"
              >
                导出分摊 CSV
              </Button>
              <span className="metA-count" data-testid="metA-export-count">
                可导出 {shareRows.length} 行
              </span>
              {pageFailed ? (
                <span className="metI-gap" data-testid="metI-share-blocked">
                  整页读取失败，分摊导出暂不生成。
                </span>
              ) : null}
            </div>
            {shareView.kind === 'loading' ? (
              <Card data-testid={`${sharePrefix}-loading`}>
                <CardContent className="p-4"><div className="met5-skeleton h-24 w-full" /></CardContent>
              </Card>
            ) : null}
            {shareView.kind === 'unavailable' ? (
              <Card data-testid={`${sharePrefix}-error`}>
                <CardContent className="space-y-2 p-4">
                  <p className="font-medium">这份成本分摊暂时读不到</p>
                  <p className="text-sm text-muted-foreground" title={shareView.gap ?? undefined}>{shareView.reason}</p>
                  <RequestId id={shareView.requestId} />
                  <Button size="sm" outlined onClick={() => setAttempt((value) => value + 1)} data-testid={`${sharePrefix}-retry`}>重试</Button>
                </CardContent>
              </Card>
            ) : null}
            {shareView.kind === 'ready' && shareRows.length === 0 ? (
              <Card data-testid={`${sharePrefix}-empty`}>
                <CardContent className="space-y-2 p-4">
                  <p className="font-medium">
                    {groupBy === 'employee' ? '这个窗口没有按员工的实扣记录' : '这个窗口没有按模型的实扣记录'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    上游没有返回任何{groupBy === 'employee' ? '员工的账本行' : '模型的用量'}，因此不画空表、不报 0 条，也不把「没有记录」当成「花费 0」。
                  </p>
                </CardContent>
              </Card>
            ) : null}
            {shareView.kind === 'ready' && shareRows.length > 0 ? (
              <>
                <div className="met6-table-scroll">
                  <table className="met6-table" data-testid={`${sharePrefix}-table`}>
                    <caption className="metG-caption" data-testid="metG-a11y-caption">{`成本分摊：${usageWindow.label} · ${groupBy === 'employee' ? '按员工' : '按模型'} · 按${sortColumnLabel}${sortDir === 'asc' ? '升序' : '降序'}排列`}</caption>
                    <thead>
                      <tr>
                        <th scope="col" aria-sort={sortKey === 'model' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                          <button
                            type="button"
                            className="met7-sort"
                            onClick={() => chooseSort('model')}
                            data-testid={`${sharePrefix}-sort-${groupBy === 'employee' ? 'name' : 'model'}`}
                          >
                            {groupBy === 'employee' ? '员工' : '模型'}
                            {sortKey === 'model' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </button>
                        </th>
                        <th scope="col" className="met6-num" data-testid="metG-a11y-th-runs" aria-sort={sortKey === 'runs' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                          <button type="button" className="met7-sort" onClick={() => chooseSort('runs')} data-testid={`${sharePrefix}-sort-runs`}>
                            运行数{sortKey === 'runs' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </button>
                        </th>
                        <th scope="col" className="met6-num" data-testid="metG-a11y-th-cost" aria-sort={sortKey === 'cost' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                          <button type="button" className="met7-sort" onClick={() => chooseSort('cost')} data-testid={`${sharePrefix}-sort-cost`}>
                            成本{sortKey === 'cost' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </button>
                        </th>
                        <th scope="col">占比</th>
                        <th scope="col">运行</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shareRows.map((row) => (
                        <tr
                          key={`${row.model}-${row.slug}`}
                          className="met7-row"
                          tabIndex={0}
                          aria-label={`${row.model}：${formatCount(row.runs)} 次运行，${formatUsd(row.costUsd)}，占比 ${row.sharePct === null ? '—' : `${row.sharePct.toFixed(1)}%`}`}
                          data-testid={`${sharePrefix}-row-${row.slug}`}
                        >
                          <td className="met7-model" title={row.model}>{row.model}</td>
                          <td
                            className="met6-num"
                            data-testid={`${sharePrefix}-runs-${row.slug}`}
                            title={row.runs === null ? '上游没有返回这一行的运行计数' : '上游的运行/会话计数'}
                          >
                            {formatCount(row.runs)}
                          </td>
                          <td
                            className="met6-num"
                            data-testid={`${sharePrefix}-cost-${row.slug}`}
                            title={row.costUsd === null ? '这一行没有账本实扣；不按 0 计' : '账本实扣 USD'}
                          >
                            {formatUsd(row.costUsd)}
                          </td>
                          <td
                            className="met6-num"
                            data-testid={`${sharePrefix}-share-${row.slug}`}
                            title={row.sharePct === null ? '可读到的实扣金额为 0 或缺失，无法分摊' : '按可读到的实扣金额归一'}
                          >
                            {row.sharePct === null ? '—' : `${row.sharePct.toFixed(1)}%`}
                          </td>
                          <td className="met6-num">
                            <Link
                              to={row.drill.href}
                              className="met9-link"
                              data-testid={`met9-link-${row.slug}`}
                              title={row.drill.note ?? '让运行页只看这一项的运行'}
                              aria-label={`查看${row.model}的运行`}
                            >
                              查看运行
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="met6-source" data-testid={`${sharePrefix}-source`}>
                  来源：{groupBy === 'employee' ? '员工账本' : '模型用量'} · 截至{' '}
                  {shareView.value.asOf ? formatBeijing(shareView.value.asOf) : '—'} · 窗口 {shareView.value.days} 天 · 可读实扣合计{' '}
                  <span className="font-mono">{formatUsd(shareTotal)}</span>
                </p>
                <p className="met6-hint" data-testid={`${sharePrefix}-hint`}>
                  占比按可读到的实扣金额归一，合计 100%；缺金额的行不参与分摊，显示「—」。排序写在地址里，刷新与前进后退都保留。
                </p>
                {groupBy === 'employee' ? (
                  <p className="met6-hint" data-testid="met9-note">
                    「查看运行」按这位员工筛选，并带上同一个时间窗；它只做导航，不改这一页的任何数字。
                  </p>
                ) : (
                  <p className="met6-hint" data-testid="met9-note">
                    「查看运行」按同一个时间窗打开运行列表——运行页暂不支持按模型筛选，这里不假装过滤。
                  </p>
                )}
              </>
            ) : null}
          </div>
        </section>
      )}

      {forced ? (
        <p className="met5-preview" data-testid="met5-preview-note">
          预览状态：以下内容只用于验收布局，不是实时数据。
        </p>
      ) : null}

      <div className="met5-window" data-testid="met5-window" role="group" aria-label="统计时间窗">
        {WINDOWS.map((item) => (
          <Button
            key={item.weeks}
            size="sm"
            outlined={item.weeks !== weeks}
            aria-pressed={item.weeks === weeks}
            onClick={() => chooseWindow(item.weeks)}
            data-testid={`met5-window-${item.weeks}`}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <p className="met5-note">这个读取口按整周汇总，24 小时窗口不单独提供；最近 30 天按 4 周展示。</p>

      {view.kind === 'loading' ? (
        <Card data-testid="met5-loading">
          <CardContent className="space-y-2 p-6">
            <div className="met5-skeleton h-5 w-40" />
            <div className="met5-skeleton h-4 w-64" />
            <div className="met5-skeleton h-52 w-full" />
          </CardContent>
        </Card>
      ) : null}

      {view.kind === 'error' ? (
        <Card data-testid="met5-error">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">这次没能读取运行活动</p>
            <div data-testid="metH-card-error-heat">
              <p className="text-sm text-muted-foreground" title={view.gap ?? undefined}>{view.message}</p>
              <RequestId id={view.requestId} />
            </div>
            <div className="metH-card-acts">
              <CardRetryButton busy={false} onClick={retryHeat} testId="metH-card-retry-heat" />
              <Button size="sm" outlined onClick={() => setAttempt((value) => value + 1)} data-testid="met5-retry">
                全部重试
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {view.kind === 'empty' ? (
        <Card data-testid="met5-empty">
          <CardContent className="space-y-2 p-6">
            <p className="font-medium">这个窗口没有运行记录</p>
            <p className="text-sm text-muted-foreground">
              接口没有返回任何热力格，因此不画格子、不补 0，也不把「没有记录」当成「运行了 0 次」。
            </p>
            <p className="met5-source" data-testid="met5-source">
              来源：运行活动热力 · 读取于 {formatBeijing(view.loadedAt)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {view.kind === 'ready' && grid ? (
        <>
          <p className="met5-source" data-testid="met5-source">
            来源：运行活动热力 · 读取于 {formatBeijing(view.loadedAt)}
          </p>
          <div className="met5-summary">
            <Card className="met5-stat">
              <CardContent className="p-4">
                <p className="met5-label">窗口总运行</p>
                <p className="met5-value" data-testid="met5-count">
                  {grid.presentCells > 0 && grid.total !== null ? grid.total : '—'}
                </p>
                <p className="met5-hint">{windowRangeLabel(view.activity)}</p>
              </CardContent>
            </Card>
            <Card className="met5-stat">
              <CardContent className="p-4">
                <p className="met5-label">峰值格</p>
                <p className="met5-value met5-value-small" data-testid="met5-peak">
                  {grid.peak
                    ? `${WEEKDAY_LABELS[grid.peak.dow - 1]} ${String(grid.peak.hour).padStart(2, '0')}:00 · ${grid.peak.count} 次`
                    : '—'}
                </p>
                <p className="met5-hint">只比较接口返回了的格子</p>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="met5-heatmap">
            <CardContent className="space-y-3 p-4 md:p-6">
              <div className="met5-legend" data-testid="met5-legend">
                <span>少</span>
                {[1, 2, 3, 4].map((level) => (
                  <span key={level} className={`met5-swatch is-l${level}`} aria-hidden="true" />
                ))}
                <span>多</span>
                <span className="met5-swatch is-zero" aria-hidden="true" />
                <span>0 次</span>
                <span className="met5-swatch is-missing" aria-hidden="true" />
                <span>接口未返回（—）</span>
              </div>
              <div className="met5-scroll">
                <div
                  className="met5-gridwrap"
                  role="img"
                  aria-label="运行热力：星期与小时的运行次数"
                  aria-describedby="metK-heat-summary"
                  data-testid="metK-heat-figure"
                >
                  <div className="met5-grid" data-testid="met5-grid">
                    <span className="met5-corner" aria-hidden="true" />
                    {Array.from({ length: 24 }, (_, hour) => (
                      <span key={hour} className="met5-hour" aria-hidden="true">
                        {String(hour).padStart(2, '0')}
                      </span>
                    ))}
                    {grid.rows.map((row) => (
                      <div className="met5-rowline" key={row.dow} role="row">
                        <span className="met5-day" role="rowheader">{row.label}</span>
                        {row.cells.map((cell) => (
                          <button
                            key={cell.hour}
                            type="button"
                            role="gridcell"
                            className={`met5-cell ${cellTone(cell)}`}
                            data-testid={`met5-cell-${cell.dow}-${cell.hour}`}
                            title={`${row.label} ${String(cell.hour).padStart(2, '0')}:00–${String(cell.hour).padStart(2, '0')}:59 · ${cellText(cell)} · ${cellRangeLabel(row.dow, cell.hour, weeks, view.activity.to)}`}
                            aria-label={heatCellLabel(cell, weeks, view.activity.to)}
                            onClick={() => setSelected({ dow: cell.dow, hour: cell.hour })}
                          >
                            <span className="met5-cell-dot" aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p id="metK-heat-summary" className="sr-only" data-testid="metK-heat-summary">
                {heatSummary}
              </p>
              <div className="metK-table-block">
                <Button
                  size="sm"
                  outlined
                  data-testid="metK-table-toggle"
                  aria-expanded={heatTableOpen}
                  aria-controls="metK-table"
                  onClick={() => setHeatTableOpen((open) => !open)}
                >
                  以表格查看
                </Button>
                {heatTableOpen ? (
                  <div className="metK-tablewrap">
                    <table className="metK-table" id="metK-table" data-testid="metK-table">
                      <caption data-testid="metK-table-caption">
                        按星期汇总的运行次数（{windowRangeLabel(view.activity)}）
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">星期</th>
                          <th scope="col">运行数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heatDays.map((day) => (
                          <tr key={day.dow} data-testid={`metK-table-row-${day.dow}`}>
                            <td>{day.label}</td>
                            <td>{day.runs === null ? '—' : formatCount(day.runs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
              <p className="met5-scrollhint">左右滑动热力图，查看 12–23 点</p>
              <div className="met5-selected" data-testid="met5-selected" aria-live="polite">
                {selectedCell ? (
                  <>
                    <span className="font-medium">
                      {WEEKDAY_LABELS[selectedCell.dow - 1]} {String(selectedCell.hour).padStart(2, '0')}:00–{String(selectedCell.hour).padStart(2, '0')}:59
                    </span>
                    <span>{selectedCell.present ? `${selectedCell.count} 次` : '—（接口未返回这一格，不能当作 0）'}</span>
                    <span className="text-muted-foreground">{cellRangeLabel(selectedCell.dow, selectedCell.hour, weeks, view.activity.to)}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">点一个格子，看它的计数与时间范围。</span>
                )}
              </div>
              <p className="met5-note">
                颜色按本窗口内出现过的最大值分档；没出现的格子用斜纹标为「—」，不进入总数，也不参与峰值比较。
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    <section className="metB" data-testid="metB-source">
        {sourcesSeen ? (
          <>
            <div className="metB-head">
              <Button
                size="sm"
                outlined
                data-testid="metB-source-toggle"
                aria-expanded={sourcesOpen}
                aria-controls="metB-source-table"
                onClick={() => setSourcesOpen((open) => !open)}
              >
                数据来源与新鲜度
              </Button>
              <span className="met5-note">
                最近采集 {newestSource ? formatBeijing(newestSource) : '—'} · {sourceList.length} 个读口
              </span>
            </div>
            {sourcesOpen ? (
              <div className="metB-wrap">
                <div
                  className="metB-table"
                  id="metB-source-table"
                  data-testid="metB-source-table"
                  role="table"
                  aria-label="数据来源与新鲜度"
                >
                  <div className="metB-row metB-row-head" role="row">
                    <span role="columnheader">口径</span>
                    <span role="columnheader">来源</span>
                    <span role="columnheader">最近采集</span>
                    <span role="columnheader">状态</span>
                  </div>
                  {sourceList.map((row) => (
                    <div className="metB-row" role="row" data-testid={`metB-source-row-${row.key}`} key={row.key}>
                      <span className="metB-name" role="cell">
                        {row.label}
                      </span>
                      <code className="metB-path" role="cell">
                        {row.path}
                      </code>
                      <span
                        role="cell"
                        data-testid={`metB-source-asof-${row.key}`}
                        title={
                          row.asOf
                            ? row.asOfSource
                              ? `采集时刻来自 ${row.asOfSource}`
                              : '上游返回的采集时刻'
                            : '上游未返回采集时刻'
                        }
                      >
                        {row.asOf ? formatBeijing(row.asOf) : '—'}
                      </span>
                      <span
                        role="cell"
                        data-testid={`metB-source-state-${row.key}`}
                        title={
                          row.state === 'down'
                            ? `${row.error ?? '这次读取没有成功'}${row.requestId ? ` · 请求编号 ${row.requestId}` : ''}`
                            : row.state === 'degraded'
                              ? '上游未返回采集时刻：数据读到了，但说不清它新到什么程度'
                              : row.asOfSource
                                ? `采集时刻来源 ${row.asOfSource}`
                                : undefined
                        }
                      >
                        <span className="metB-state">
                          {row.state === 'down' ? '读不到' : row.state === 'degraded' ? '降级' : '正常'}
                        </span>
                        {row.state === 'down' && row.requestId ? (
                          <SourceRidButton
                            id={row.requestId}
                            label={row.label}
                            testId={`metC-source-rid-${row.key}`}
                          />
                        ) : null}
                        {row.state === 'down' && row.error ? (
                          <span className="metB-reason" data-testid={`metD-source-reason-${row.key}`}>
                            {row.error}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="met5-note">
                  时间只取上游返回的采集时刻；上游没给就是「—」，不拿本机时间顶替。降级项写明原因，不猜。
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="met5-note" data-testid="metB-source-empty">
            还没有读取记录：这一页还没向任何读口发起请求。
          </p>
        )}
      </section>
    </main>
  );
}

export default MetricsModulePage;