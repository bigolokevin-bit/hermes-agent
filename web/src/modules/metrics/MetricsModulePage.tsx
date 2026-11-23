// Module: metrics — 运行分析（7×24 活动热力）
//
// One read: /agent-api/api/run-activity?weeks=N&tz=Asia/Shanghai. The endpoint
// aggregates whole weeks, so there is no 24-hour window here. Absent cells stay
// absent (—); only a returned count of 0 is a real zero. No count is inferred
// from another endpoint, and no raw field name or HTTP status reaches the page.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Copy, RefreshCw } from 'lucide-react';

import { Button } from '@nous-research/ui/ui/components/button';
import { Card, CardContent } from '@nous-research/ui/ui/components/card';

import { copyTextToClipboard } from '@/lib/clipboard';
import { ApiError, SESSION_REQUIRED_GUIDANCE } from '@/lib/api-error';
import { fetchJsonStrict } from '@/modules/models/fetchJson';

import {
  costCaliber,
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
  csvFileStem,
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
  heatCopyText,
  HEAT_LEGEND_TEXT,
  heatGapNoteText,
  CALIBER_NOTES,
  caliberNoteText,
  heatSummaryParts,
  heatDayRows,
  heatFromStats,
  heatGridSummary,
  isoOrNull,
  metricsSummaryText,
  pricingFailure,
  sourceStaleness,
  sourceSummaryText,
  SOURCE_STALE_MS,
  withGapNote,
  withTotalsNote,
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
  parseDetailSort,
  parseSortDir,
  parseSortKey,
  sortDetailLines,
  shareCsv,
  shareCsvFileName,
  shareCsvStem,
  shareOfCosts,
  shareOfWhole,
  runsDrill,
  shortCode,
  sortModelCost,
  sumOrNull,
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
  formatSharePct,
  rowCopyText,
  usdDigits,
  usageWindowOf,
  windowRange,
  windowOf,
  windowRangeLabel,
  type Activity,
  type DetailSort,
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
  runsCaliberTitle,
  normalizeMetricsQuery,
  ignoredParamsNote,
} from './metrics';
import { COST_CALIBER_TEXT, costCaliberTitle } from './costCaliberNote';
import { asOfCell } from './asof';
import './metrics.css';

type PageState =
  | { kind: 'loading' }
  | { kind: 'empty'; activity: Activity; loadedAt: string; weeks: number }
  | { kind: 'error'; message: string; requestId: string | null; gap: string | null }
  | { kind: 'ready'; activity: Activity; loadedAt: string; weeks: number };

type Forced = 'loading' | 'empty' | 'error' | 'denied';

const EMPTY_ACTIVITY: Activity = { cells: [], max: null, from: null, to: null, tz: 'Asia/Shanghai' };

/** Cards that quote a read: two cards may describe the same read (trend and
 *  runs both come from run-stats), so the list is of keys, not of cards. */
const CARD_NOTE_KEYS: ReadonlyArray<string> = ['run-stats', 'budget-usage', 'pricing', 'run-activity'];

const TABLE_SCROLL_STEP = 48;

/**
 * metW — a wide table is a scroll region first: arrow keys move it sideways the
 * same way a drag does, and Home returns to the first column. Nothing else is
 * intercepted, so Tab and the page's own scrolling keep working.
 */
function handleTableScrollKeys(event: KeyboardEvent<HTMLDivElement>): void {
  const node = event.currentTarget;
  if (event.key === 'ArrowRight') {
    node.scrollLeft = Math.max(0, node.scrollLeft + TABLE_SCROLL_STEP);
    event.preventDefault();
  } else if (event.key === 'ArrowLeft') {
    node.scrollLeft = Math.max(0, node.scrollLeft - TABLE_SCROLL_STEP);
    event.preventDefault();
  } else if (event.key === 'Home') {
    node.scrollLeft = 0;
    event.preventDefault();
  }
}

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
  /** Model id in the model view; the employee view has none, and the unit
   *  price column only ever reads this in the model view. */
  modelId: string | null;
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
  if (error.status === 401) return SESSION_REQUIRED_GUIDANCE;
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
  // metAA — the heat window lives in its own `heat` key; `w` is only read as a
  // fallback for links copied before this change.
  const activeWindow = windowOf(params.get('heat') ?? params.get('w'));
  const weeks = activeWindow.weeks;
  const urlNormalization = normalizeMetricsQuery(params.toString());
  // The unusable values are folded away from the address; keep the first list so
  // the note does not blink out in the render that follows the rewrite.
  const [ignoredParams] = useState<string[]>(() =>
    normalizeMetricsQuery(params.toString()).ignored,
  );
  const ignoredNote = ignoredParamsNote(ignoredParams);
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [usage, setUsage] = useState<UsageState>({ kind: 'loading' });
  const [breakdown, setBreakdown] = useState<BreakdownState>({ kind: 'loading' });
  const [heat, setHeat] = useState<HeatState>({ kind: 'loading' });
  const [budget, setBudget] = useState<BudgetState>({ kind: 'loading' });
  const [cmp, setCmp] = useState<CmpState>({ kind: 'loading' });
  const [share, setShare] = useState<ShareState>({ kind: 'loading' });
  const [heatAt, setHeatAt] = useState<string>(new Date().toISOString());
  const [attempt, setAttempt] = useState(0);
  // Fold aliases and unusable values into the canonical spelling once, on the
  // link the page was opened with. Later view/groupBy choices stay independent,
  // so this must not run again after the first rewrite.
  const normalizedOnce = useRef(false);
  useEffect(() => {
    if (normalizedOnce.current) return;
    normalizedOnce.current = true;
    if (!urlNormalization.changed) return;
    setParams(new URLSearchParams(urlNormalization.query), { replace: true });
  }, [urlNormalization, setParams]);
  const [retryingBlock, setRetryingBlock] = useState<UsageBlockKind | null>(null);
  const [selected, setSelected] = useState<{ dow: number; hour: number } | null>(null);
  const [heatTableOpen, setHeatTableOpen] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState<'idle' | 'done' | 'failed'>('idle');
  const [heatCopyStatus, setHeatCopyStatus] = useState<'idle' | 'done' | 'failed'>('idle');
  const [heatCopyBody, setHeatCopyBody] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [refreshSnapshot, setRefreshSnapshot] = useState<null | {
    state: PageState;
    usage: UsageState;
    breakdown: BreakdownState;
    heat: HeatState;
    budget: BudgetState;
    cmp: CmpState;
    share: ShareState;
  }>(null);
  const [refreshAt, setRefreshAt] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<{ message: string; requestId: string | null } | null>(null);
  const refreshBusyRef = useRef(false);
  const refreshSignalRef = useRef<{ live: boolean } | null>(null);
  const sourcesRef = useRef<Record<string, SourceStamp>>({});
  const [sourceCopyStatus, setSourceCopyStatus] = useState<'idle' | 'done' | 'failed'>('idle');

  // met-rowcopy — one row of the cost detail table as a single line of plain text.
  // The text is computed from what the row already renders; pressing it never
  // re-reads anything, and a clipboard refusal leaves the same text selectable.
  const [rowCopy, setRowCopy] = useState<{ status: 'idle' | 'done' | 'failed'; body: string }>({
    status: 'idle',
    body: '',
  });

  // met-output — one visible line says what just happened. The signature gate is
  // deliberate: pressing the same export twice must not replay the same sentence,
  // and a disabled control must never announce a success it did not perform.
  type OutputAction = 'detail-export' | 'share-export' | 'copy-summary' | 'copy-sources';
  const [output, setOutput] = useState<{ action: OutputAction; text: string; tone: 'ok' | 'fail'; seq: number } | null>(
    null,
  );
  const outputSig = useRef<string | null>(null);
  const outputSeq = useRef(0);
  const announceOutput = (action: OutputAction, text: string, tone: 'ok' | 'fail' = 'ok') => {
    const signature = `${action}|${tone}|${text}`;
    if (outputSig.current === signature) return;
    outputSig.current = signature;
    outputSeq.current += 1;
    setOutput({ action, text, tone, seq: outputSeq.current });
  };
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
        setSources((prev) => ({
          ...prev,
          [key]: mergeSourceStamp(prev[key], { ...readSourceStamp(payload), fetchedAt: new Date().toISOString() }),
        }));
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
      onError: (error: unknown) => { reason: string; gap: string | null; requestId: string | null } = blockFailure,
    ): Promise<UsageBlock<T>> => {
      try {
        const body = await run();
        const parsed = parse(body);
        if (!parsed.ok) return { kind: 'unavailable', reason: parsed.reason, gap: null, requestId: null };
        return { kind: 'ready', value: parsed.value };
      } catch (error) {
        return { kind: 'unavailable', ...onError(error) };
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
            // 价目读口有自己的诚实句（标价未接）；其余状态回落通用句。
            (error) => pricingFailure(error) ?? blockFailure(error),
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
  }, [attempt, usageWindow.id, viewMode, groupBy]);

  // metAA — switching the heat window only invalidates the heat read. The other
  // blocks keep the stamps they already had, so their cards are not emptied.
  useEffect(() => {
    setSources((prev) => {
      if (prev['run-activity'] === undefined) return prev;
      const next = { ...prev };
      delete next['run-activity'];
      return next;
    });
  }, [weeks]);

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
            modelId: line.model,
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
          modelId: null,
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


  // metAK — one manual refresh reads the whole page once: the seven loaders run
  // together with a single signal. A second click while busy is ignored, and a
  // window or group switch retires the batch instead of letting it land late.
  const cancelRefresh = () => {
    if (refreshSignalRef.current) refreshSignalRef.current.live = false;
    refreshSignalRef.current = null;
    refreshBusyRef.current = false;
    setRefreshBusy(false);
    setRefreshSnapshot(null);
  };

  const refreshAll = async () => {
    if (refreshBusyRef.current) return;
    const signal = { live: true };
    refreshSignalRef.current = signal;
    refreshBusyRef.current = true;
    setRefreshSnapshot({ state, usage, breakdown, heat, budget, cmp, share });
    setRefreshBusy(true);
    setRefreshError(null);

    const errorsBefore = new Map(
      Object.entries(sourcesRef.current).map(([key, stamp]) => [key, stamp.error ?? '']),
    );

    await Promise.allSettled([
      load(signal),
      loadUsage(signal, usageWindow.id),
      loadBreakdown(signal, usageWindow.id, viewMode),
      loadHeat(signal),
      loadBudget(signal, usageWindow.id),
      loadCmp(signal),
      loadShare(signal, usageWindow.id, groupBy),
    ]);

    if (!signal.live) return;

    // Let the last state writes land before judging the batch.
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (!signal.live) return;

    const failures = Object.entries(sourcesRef.current).filter(([key, stamp]) => {
      if (!stamp.error) return false;
      return (errorsBefore.get(key) ?? '') !== stamp.error;
    });
    refreshSignalRef.current = null;
    refreshBusyRef.current = false;
    setRefreshSnapshot(null);
    setRefreshBusy(false);
    if (failures.length > 0) {
      const first = failures[0][1];
      setRefreshError({
        message: first.error ?? '这次刷新没成功',
        requestId: first.requestId,
      });
      return;
    }
    setRefreshError(null);
    setRefreshAt(new Date().toISOString());
  };

  // metAK — while a manual refresh is in flight the cards keep the batch they
  // already had; the new numbers replace them only when the batch settles.
  const shownState = refreshBusy && refreshSnapshot ? refreshSnapshot.state : state;
  const shownUsage = refreshBusy && refreshSnapshot ? refreshSnapshot.usage : usage;
  const shownBreakdown = refreshBusy && refreshSnapshot ? refreshSnapshot.breakdown : breakdown;
  const shownHeat = refreshBusy && refreshSnapshot ? refreshSnapshot.heat : heat;
  const shownBudget = refreshBusy && refreshSnapshot ? refreshSnapshot.budget : budget;
  const shownCmp = refreshBusy && refreshSnapshot ? refreshSnapshot.cmp : cmp;
  const shownShare = refreshBusy && refreshSnapshot ? refreshSnapshot.share : share;

  const view: PageState = forced
    ? forced === 'loading'
      ? { kind: 'loading' }
      : forced === 'empty'
        ? { kind: 'empty', activity: EMPTY_ACTIVITY, loadedAt: new Date().toISOString(), weeks }
        : { kind: 'error', message: '预览状态：这次没能读取运行活动，请稍后重试。', requestId: null, gap: null }
    : shownState;

  const grid = view.kind === 'ready' ? buildHeatGrid(view.activity) : null;
  const heatDays = grid ? heatDayRows(grid) : [];
  const heatSummary = grid ? heatGridSummary(grid) : '';

  // metZ — the heat summary goes to the clipboard from the same parts that draw
  // the on-screen sentence and the met5-count card; no reading is issued here.
  const copyHeatSummary = () => {
    const parts = grid
      ? heatSummaryParts(grid)
      : { total: null, peakLabel: null, peakRuns: null, lowLabel: null, lowRuns: null, coveredDays: 0, spanDays: 7 };
    const text = heatCopyText({
      weeks,
      windowLabel: WINDOWS.find((item) => item.weeks === weeks)?.label ?? `最近 ${weeks} 周`,
      rangeLabel: view.kind === 'ready' ? windowRangeLabel(view.activity) : null,
      parts,
    });
    setHeatCopyBody(text);
    void copyTextToClipboard(text).then((ok) => setHeatCopyStatus(ok ? 'done' : 'failed'));
  };
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
    : shownUsage;

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
    : shownCmp;

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
    : shownBudget;

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
    : shownHeat;

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
    : shownBreakdown;

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
    : shownShare;

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
  const shareRunsTotal = sumOrNull(shareRows.map((row) => row.runs));
  const shareCostTotal = sumOrNull(shareRows.map((row) => row.costUsd));
  const sharePctTotal = shareOfWhole(shareRows.map((row) => row.costUsd), shareCostTotal);
  // metU — one rendering of the totals serves both the table footer and the
  // copied summary, so the two can never drift apart.
  const shareTotals = {
    runs: formatCount(shareRunsTotal),
    cost: formatUsd(shareCostTotal),
    share: formatSharePct(sharePctTotal),
  };
  const summaryTotalLine =
    shareRows.length > 0
      ? `合计：运行 ${shareTotals.runs} · 成本 ${shareTotals.cost} · 占比 ${shareTotals.share}`
      : '合计：该窗口无可渲染行';
  const sortColumnLabel = sortKey === 'runs' ? '运行数' : sortKey === 'cost' ? '成本' : groupBy === 'employee' ? '员工' : '模型';
  const shareTotal = shareView.kind === 'ready' ? shareView.value.rows.reduce<number | null>((sum, row) => {
    if (row.costUsd === null) return sum;
    return (sum ?? 0) + row.costUsd;
  }, null) : null;

  // metS — a group switch keeps the time window and the share-table sort, but
  // the detail table's own sort returns to its default (cost, descending) and
  // says so once. `sort=model` always means the name column, so it stays valid
  // in both groups.
  const [groupResetNote, setGroupResetNote] = useState(false);
  const dropDetailSort = (query: URLSearchParams): boolean => {
    const had = query.has('dsort') || query.has('ddir');
    query.delete('dsort');
    query.delete('ddir');
    return had;
  };
  const chooseGroupBy = (next: 'model' | 'employee') => {
    if (next === groupBy) return;    cancelRefresh();

    const query = new URLSearchParams(params);
    if (next === 'employee') query.set('groupBy', 'employee');
    else query.delete('groupBy');
    setGroupResetNote(dropDetailSort(query));
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
  // metQ/metR — one polite sentence per status change. The copyable request id
  // lives in the card, never inside this live region, and the text is derived
  // rather than stored so an unchanged status cannot be announced twice.
  const liveUnavailable = usageBlocks.filter((block) => block.kind === 'unavailable').length;
  const liveMessage =
    usageView.kind !== 'ready'
      ? ''
      : usageDown
        ? '这一页的数据暂时都读不到，卡片上写着原因，可以重试。'
        : liveUnavailable > 0
          ? `有 ${liveUnavailable} 项数据暂时读不到，卡片上写着原因。`
          : usageQuiet
            ? '这个时间窗没有运行记录，也没有实扣。'
            : '数据已更新，卡片和下方的表格都读到了。';

  const detailLines = breakdownView.kind === 'ready' ? breakdownView.lines : [];
  const detailSort: DetailSort = parseDetailSort(params.get('dsort')) ?? 'cost';
  const detailDir: SortDir = params.get('ddir') === 'asc' ? 'asc' : 'desc';

  // metAL — the four things that decide what this page is showing, read straight
  // from the address so a pasted link reproduces the same line.
  const detailSortLabel = detailSort === 'cost' ? '成本' : detailSort === 'runs' ? '次数' : '占比';
  const shareSortLabel = sortKey === 'runs' ? '运行数' : sortKey === 'cost' ? '成本' : groupBy === 'employee' ? '员工' : '模型';
  const scopeLine =
    `当前视图：时间窗 ${usageWindow.label} · 分组 ${groupBy === 'employee' ? '按员工' : '按模型'}` +
    ` · 明细 ${detailSortLabel} ${detailDir === 'asc' ? '升序' : '降序'}` +
    ` · 分摊 ${shareSortLabel} ${sortDir === 'asc' ? '升序' : '降序'}` +
    ` · 热力 ${activeWindow.label}`;

  // metAO — the two export file names, derived from the very same URL values the
  // scope line reads, so the four tokens can never drift apart.
  const detailFilePreview = `${csvFileStem(viewMode, usageWindow.id, detailSort, detailDir)}-<生成时刻>.csv`;
  const shareFilePreview = `${shareCsvStem(groupBy, usageWindow.id, sortKey, sortDir)}-<生成时刻>.csv`;

  const resetScope = () => {
    cancelRefresh();
    const query = new URLSearchParams(params);
    for (const key of ['window', 'groupBy', 'view', 'dsort', 'ddir', 'sort', 'dir', 'heat', 'w']) {
      query.delete(key);
    }
    setGroupResetNote(false);
    setParams(query, { replace: true });
  };

  const detailRows = sortDetailLines(detailLines, detailSort, detailDir);
  // 标价列：只在「按模型」视图且价目表就绪有行时出现。它是只读展示列——
  // 支出、占比、合计、行复制与导出都不读它，页面不拿标价乘用量。
  const priceRows =
    usageReady !== null && usageReady.pricing.kind === 'ready' && usageReady.pricing.value.rows.length > 0
      ? usageReady.pricing.value.rows
      : null;
  const showPriceCol = viewMode === 'model' && priceRows !== null;
  const unitPriceOf = (line: BreakdownLine): string => {
    if (priceRows === null || line.modelId === null) return '—';
    const row = priceRows.find((p) => p.modelId === line.modelId || p.label === line.modelId);
    return row ? formatUnitPrice(row.inputPerMillion, row.currency) : '—';
  };
  // metT — the totals row is summed from the very rows the body renders, so a
  // reader can add them up and land on the same numbers. Sorting never moves it
  // or changes it, and a column nobody could read totals to «—», not 0.
  const detailCostTotal = sumOrNull(detailRows.map((line) => line.costUsd));
  const detailCountTotal = sumOrNull(detailRows.map((line) => line.count));
  const detailShareTotal = shareOfWhole(
    detailRows.map((line) => line.costUsd),
    breakdownView.kind === 'ready' ? breakdownView.total : null,
  );
  // metV — the footer and the exported comment line read one rendering of the totals.
  // metX — three readings of «how many runs»: the activity window total, the
  // sum of the heat cells, and the detail table's count total. All three come
  // from this batch; the note below says where they agree and where they do not.
  const heatCountSum = grid
    ? sumOrNull(grid.rows.flatMap((row) => row.cells.filter((cell) => cell.present).map((cell) => cell.count)))
    : null;
  const heatWindowTotal = grid && grid.presentCells > 0 ? grid.total : null;
  // HEAT — the legend is constant; the gap sentence only exists when this very
  // batch left cells unreturned. Count is cells, never days, never a sum of 0.
  const heatGapNote = grid ? heatGapNoteText(grid.missingCells) : null;
  const detailCountSum = detailCountTotal;
  const countDelta = heatCountSum !== null && detailCountSum !== null ? detailCountSum - heatCountSum : null;

  // metAS — the three cost faces, all read from this batch. The usage face only
  // exists when the model grouping read /api/hermes-usage; otherwise it is «—»
  // with the reason in its title, never a silent 0.
  const costDayTotal = usageReady && usageReady.day.kind === 'ready' ? usageReady.day.value.total : null;
  const costMonthTotal = usageReady && usageReady.month.kind === 'ready' ? usageReady.month.value.total : null;
  const costUsageTotal =
    groupBy === 'model' && shareView.kind === 'ready'
      ? sumOrNull(shareView.value.rows.map((row) => row.costUsd))
      : null;
  const costUsageMissing =
    costUsageTotal !== null
      ? null
      : groupBy === 'model'
        ? '模型聚合这次没读出来，不按 0 记。'
        : '当前按员工分组，这一批没有读取模型聚合；切到「按模型」就能三面一起看。';
  const costCaliberView = costCaliber({
    day: costDayTotal,
    month: costMonthTotal,
    usage: costUsageTotal,
    usageMissing: costUsageMissing,
  });
  const heatGapReason =
    view.kind === 'error'
      ? '热力这次没读出来，不按 0 记'
      : view.kind === 'loading'
        ? '热力还在读取，暂时没有数'
        : '这次读取没有带回任何可求和的格子，不按 0 记';
  const windowRunsReason = heatWindowTotal === null ? heatGapReason : undefined;
  const heatRunsReason = heatCountSum === null ? heatGapReason : undefined;
  const detailRunsReason =
    detailCountSum !== null
      ? undefined
      : viewMode === 'employee'
        ? '账本只记金额与用量，不记运行次数'
        : breakdownView.kind !== 'ready'
          ? '成本明细这次没有读出来'
          : '明细没有可求和的次数';
  const deltaReason = countDelta === null ? '三处没有同时读到数，算不出差' : undefined;
  // metAP — the one sentence that spells out how the three «run count» faces
  // differ. It reads only what this batch already returned.
  const runsCaliber = {
    heat: heatWindowTotal,
    heatRange: view.kind === 'ready' ? windowRangeLabel(view.activity) : '本期',
    detail: detailCountSum,
    detailRange: `${usageWindow.label} · ${groupBy === 'employee' ? '按员工' : '按模型'}`,
    detailSource:
      viewMode === 'employee'
        ? '/api/budget-usage 账本（只记金额与用量，不记录运行次数）'
        : '/api/hermes-usage 按模型的调用次数',
    delta: countDelta,
  };
  const runsCaliberHint = runsCaliberTitle(runsCaliber);

  const detailTotals = {
    cost: formatUsd(detailCostTotal),
    count: detailCountTotal === null ? '—' : String(detailCountTotal),
    share: formatSharePct(detailShareTotal),
  };
  const detailTotalLine =
    detailRows.length > 0
      ? `合计：成本 ${detailTotals.cost} · 次数 ${detailTotals.count} · 占比 ${detailTotals.share}`
      : '合计：该窗口无可渲染行';
  const exportable = detailRows.length > 0;
  const ariaSortFor = (key: DetailSort): 'ascending' | 'descending' | 'none' =>
    detailSort === key ? (detailDir === 'asc' ? 'ascending' : 'descending') : 'none';
  const chooseDetailSort = (next: DetailSort) => {
    const dir: SortDir = next === detailSort ? (detailDir === 'desc' ? 'asc' : 'desc') : 'desc';
    const query = new URLSearchParams(params);
    if (next === 'cost' && dir === 'desc') {
      query.delete('dsort');
      query.delete('ddir');
    } else {
      query.set('dsort', next);
      query.set('ddir', dir);
    }
    setParams(query, { replace: true });
  };
  // Only the blocks this file actually pulls columns from are named in its note:
  // a source nobody exported from is not a gap in the file.
  const pageFailed = usageDown;
  const detailGaps: ExportGap[] = [
    ...(breakdownView.kind === 'unavailable'
      ? [{ label: '成本明细', reason: breakdownView.reason }]
      : []),
    ...(usageReady && usageReady.stats.kind === 'unavailable'
      ? [{ label: '运行统计', reason: usageReady.stats.reason }]
      : []),
  ];
  const shareGaps: ExportGap[] = [];

  const exportCsv = () => {
    if (pageFailed || !exportable) return;
    const header =
      viewMode === 'model'
        ? ['模型', '支出USD', '次数', '占比%', '读取于', '窗口', '窗口开始', '窗口结束', 'as_of', 'window']
        : ['员工', '支出USD', '次数', '占比%', '账本截至', '窗口', '窗口开始', '窗口结束', 'as_of', 'window'];
    const batchAsOf = isoOrNull(breakdownView.kind === 'ready' ? breakdownView.asOf : null);
    const rows = detailRows.map((line) => [
      line.label,
      usdDigits(line.costUsd),
      line.count,
      line.share,
      line.asOf ? formatBeijing(line.asOf) : null,
      usageWindow.label,
      usageReady && usageReady.stats.kind === 'ready' ? formatBeijing(usageReady.stats.value.from) : null,
      usageReady && usageReady.stats.kind === 'ready' ? formatBeijing(usageReady.stats.value.to) : null,
      batchAsOf,
      usageWindow.id,
    ]);
    const body = withGapNote(withTotalsNote(toCsv(header, rows), detailTotalLine), detailGaps);
    const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8' });
    const fileName = csvFileName(viewMode, usageWindow.id, detailSort, detailDir, new Date());
    try {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      announceOutput('detail-export', `已导出明细 ${detailRows.length} 行：${fileName}。`);
    } catch {
      announceOutput('detail-export', '导出没成功：这份明细文件没有生成，重试一次看看。', 'fail');
    }
  };

  const exportShare = () => {
    // Same array the share table renders, in the same order (already sorted by
    // ?sort/?dir, default cost descending). The file never re-sorts.
    if (pageFailed || shareView.kind !== 'ready') return;
    const shareBody = withGapNote(
      withTotalsNote(
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
        summaryTotalLine,
      ),
      shareGaps,
    );
    const blob = new Blob([`\uFEFF${shareBody}`], { type: 'text/csv;charset=utf-8' });
    const fileName = shareCsvFileName(groupBy, usageWindow.id, sortKey, sortDir, new Date());
    try {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      announceOutput('share-export', `已导出分摊 ${shareRows.length} 行：${fileName}。`);
    } catch {
      announceOutput('share-export', '导出没成功：这份分摊文件没有生成，重试一次看看。', 'fail');
    }
  };

  const chooseView = (next: 'employee' | 'model') => {
    if (next === viewMode) return;    cancelRefresh();

    const query = new URLSearchParams(params);
    if (next === 'employee') query.delete('view');
    else query.set('view', next);
    setGroupResetNote(dropDetailSort(query));
    setParams(query, { replace: true });
  };

  const chooseUsageWindow = (next: UsageWindowId) => {
    cancelRefresh();
    const query = new URLSearchParams(params);
    if (next === '24h') query.delete('window');
    else query.set('window', next);
    setParams(query, { replace: true });
  };

  const chooseWindow = (nextWeeks: number) => {
    cancelRefresh();
    setSelected(null);
    const next = new URLSearchParams(params);
    next.set('heat', String(nextWeeks));
    next.delete('w');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  const sourceList = sourceRows(sources);
  const newestSource = latestSourceAsOf(sourceList);

  // metAG — the copied source summary is the freshness table in words; it reads
  // the rows already on screen and asks the service for nothing.
  // Disabled only when nothing was readable: a source this page never asked for
  // yet is «degraded», not a failure, and must not flip the button either way.
  const sourceCopyDisabled =
    sourceList.length > 0 && sourceList.filter((row) => sources[row.key] !== undefined).every((row) => row.state === 'down');
  const sourceCopyValue = sourceList.length > 0 ? sourceSummaryText(sourceList) : '';
  const copySourceSummary = () => {
    if (sourceCopyDisabled || sourceList.length === 0) return;
    // One value feeds both the clipboard call and the fallback box, so the box
    // can never show something other than what was handed to the clipboard.
    void copyTextToClipboard(sourceCopyValue).then((ok) => {
      setSourceCopyStatus(ok ? 'done' : 'failed');
      if (ok) announceOutput('copy-sources', `已复制数据来源摘要，共 ${sourceList.length} 行。`);
      else announceOutput('copy-sources', '复制没成功：浏览器没有把来源摘要放进剪贴板，下面的原文可以直接选中。', 'fail');
    });
  };

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
    if (pageFailed || usageView.kind !== 'ready') return;
    const text = metricsSummaryText({
      windowId: usageWindow.id,
      windowLabel: usageWindow.label,
      runs: summaryRuns,
      costUsd: summaryCost,
      groupBy,
      asOf: summaryAsOf,
      generatedAt: new Date().toISOString(),
      totalLine: summaryTotalLine,
    });
    setSummaryText(text);
    void copyTextToClipboard(text).then((ok) => {
      setSummaryStatus(ok ? 'done' : 'failed');
      if (ok) announceOutput('copy-summary', `已复制摘要：${summaryRuns ?? '—'} 次运行 · ${formatUsd(summaryCost)}。`);
      else announceOutput('copy-summary', '复制没成功：浏览器没有把摘要放进剪贴板，下面的原文可以直接选中。', 'fail');
    });
  };

  // Copy one rendered cost-detail row. The body is built by the same helper the
  // table uses for its numbers, so pressing the button never re-reads a source.
  const copyDetailRow = (line: { label: string; count: number | null; costUsd: number | null; share: number | null }) => {
    const text = rowCopyText(line);
    setRowCopy({ status: 'idle', body: text });
    void copyTextToClipboard(text).then((ok) => {
      setRowCopy({ status: ok ? 'done' : 'failed', body: text });
    });
  };

  // metAM — every action on this page asks one object for its availability, so a
  // single failing batch can never leave one button dead and its twin alive.
  type Gate = { enabled: boolean; title: string | null };
  const gates: {
    refresh: Gate;
    scope: Gate;
    detailExport: Gate;
    shareExport: Gate;
    copySummary: Gate;
    cardRetry: Gate;
  } = {
    // The refresh button stays reachable while it runs: it is the one control
    // that ignores a second click instead of going dim.
    refresh: { enabled: true, title: refreshBusy ? '这一批还在读，按钮不会重复发请求。' : '重新读取当前窗口与当前分组的全部读口。' },
    scope: { enabled: !refreshBusy, title: refreshBusy ? '刷新进行中，视图切换等这一批结束。' : null },
    detailExport: {
      enabled: !refreshBusy && !pageFailed && exportable,
      title: refreshBusy
        ? '刷新进行中，导出等这一批结束。'
        : pageFailed
          ? '整页读取失败，这份导出暂时不生成；先重试上面的读取，读到数据再导。'
          : exportable
            ? '导出明细 CSV：当前窗口与当前分类下账本逐行的实扣明细，不是分摊汇总。'
            : '当前窗口没有明细行：没有可导出的数据；空窗口用屏上的计数说明，不导一个只含表头的文件。',
    },
    shareExport: {
      enabled: !refreshBusy && !pageFailed && shareView.kind === 'ready',
      title: refreshBusy
        ? '刷新进行中，导出等这一批结束。'
        : pageFailed
          ? '整页读取失败，这份导出暂时不生成；先重试上面的读取，读到数据再导。'
          : shareView.kind === 'loading'
            ? '分摊数据还在读取，读到之后才能导出。'
            : shareView.kind === 'unavailable'
              ? `这份分摊现在读不到，导出暂不生成：${shareView.reason}`
              : shareRows.length === 0
                ? '当前视图没有分摊行：导出的文件只写表头，计数仍显示 0 行。'
                : '导出分摊 CSV：当前窗口、分组与排序下的聚合行，含成本与占比，不是账本逐行明细。',
    },
    copySummary: {
      enabled: !refreshBusy && !pageFailed && usageView.kind === 'ready',
      title: refreshBusy
        ? '刷新进行中，摘要等这一批结束。'
        : pageFailed
          ? '整页读取失败，摘要里的数字不完整，先重试上面的读取。'
          : usageView.kind !== 'ready'
            ? '还没读到运行数据，读到之后才能复制摘要。'
            : '把当前窗口的关键数字复制成纯文本。',
    },
    cardRetry: {
      enabled: !refreshBusy,
      title: refreshBusy ? '刷新进行中，单卡重试等这一批结束。' : null,
    },
  };

  return (
    <main className="met5-page" id="metY-main" tabIndex={-1} data-testid="met5-page">
      <a className="metY-skip" href="#metY-main" data-testid="metY-skiplink">
        跳到主要内容
      </a>
      <div className="sr-only">
        {CALIBER_NOTES.filter((note) => CARD_NOTE_KEYS.includes(note.key)).map((note) => (
          <p key={note.key} id={`metAD-note-${note.key}`} data-testid={`metAD-note-${note.key}`}>
            {caliberNoteText(note)}
          </p>
        ))}
      </div>
      <p className="sr-only" role="status" aria-live="polite" data-testid="metQ-live">
        {liveMessage}
      </p>
      <div className="met5-head">
        <div>
          <h1>运行分析</h1>
          <p>按星期与小时看运行都落在什么时段。没有记录的格子显示「—」，不补 0。</p>
        </div>
        <div className="met5-acts">
          <Button
            size="sm"
            outlined
            disabled={!gates.copySummary.enabled}
            title={gates.copySummary.title ?? undefined}
            onClick={copySummary}
            data-testid="metL-copy"
          >
            <Copy className="size-3.5" aria-hidden="true" />
            复制摘要
          </Button>
          <span className="metR-state" data-testid="metR-copy-state">
            {pageFailed
              ? '摘要不可复制：整页读取失败'
              : usageView.kind !== 'ready'
                ? '摘要不可复制：还没读到运行数据'
                : '摘要可复制'}
          </span>
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
          <span className="sr-only" data-testid="metU-copy-total">
            {summaryTotalLine}
          </span>
        </div>
      </div>

      <div className="metAL-bar">
        <p className="metAL-scope" data-testid="metAL-scope">
          {scopeLine}
        </p>
        <Button
            size="sm"
            outlined
            disabled={!gates.scope.enabled}
            title={gates.scope.title ?? undefined}
            onClick={resetScope}
            data-testid="metAL-reset"
          >
          回到默认视图
        </Button>
      </div>
      {ignoredNote ? (
        <p
          className="met6-hint metAQ-note"
          data-testid="metAQ-url-note"
          title={ignoredParams.join('、')}
        >
          {ignoredNote}
        </p>
      ) : null}

      <div className="metAO-bar" data-testid="metAO-filename-bar">
        <span className="metAO-file">
          <span className="metAO-file-label">明细导出文件</span>
          <code className="metAO-file-code" data-testid="metAO-filename-detail" title={detailFilePreview}>
            {detailFilePreview}
          </code>
        </span>
        <span className="metAO-file">
          <span className="metAO-file-label">分摊导出文件</span>
          <code className="metAO-file-code" data-testid="metAO-filename-share" title={shareFilePreview}>
            {shareFilePreview}
          </code>
        </span>
      </div>

      <p className="metAM-note" data-testid="metAM-matrix-note">
        可用性一句话：整页都读不出来的时候，只留「刷新」可用，导出与复制一起停下；只有某一块读不出来的时候，用到它的导出与复制停下，单卡重试照常；时间窗没有明细行时，明细导出停下、摘要复制照常（分摊为空仍可导出只含表头的文件）；刷新进行中，除刷新本身外都不点，刷新也不会重复发请求。
      </p>

      {output ? (
        <div
          className="met-output"
          data-testid="met-output-status"
          data-action={output.action}
          data-tone={output.tone}
          data-seq={output.seq}
          role="status"
          aria-live="polite"
        >
          <span data-testid={`met-output-${output.action}`}>{output.text}</span>
          {output.tone === 'fail' ? <RequestId id={null} /> : null}
        </div>
      ) : null}

      {usageQuiet ? (
        <div className="metAN-guide" data-testid="metAN-empty-guide">
          <p className="metAN-title">本窗没有运行记录</p>
          <p className="metAN-body">
            这一段时间没有运行，也没有产生实扣。卡片上的数字保留「—」，不拿空当 0 求和，也不编一个零元汇总出来。
          </p>
          <p className="metAN-body">
            想换个去处：去看 <Link to="/runs">运行列表</Link>，或者回 <Link to="/work">工作台</Link>；也可以点上面的时间窗，换一段再看看。
          </p>
        </div>
      ) : null}

      <div className="metAK-bar" data-testid="metAK-bar">
        <Button
          size="sm"
          outlined
          aria-busy={refreshBusy}
          onClick={() => {
            void refreshAll();
          }}
          data-testid="metAK-refresh"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          刷新
        </Button>
        {refreshBusy ? (
          <span className="metAK-busy" role="status" aria-live="polite" data-testid="metAK-busy-note">
            更新中…（卡片先保留上一次读到的数据）
          </span>
        ) : null}
        {!refreshBusy && refreshAt ? (
          <span className="metAK-stamp" data-testid="metAK-updated-at">
            刷新完成于 {formatBeijing(refreshAt)}（读取时刻，不是数据时刻）
          </span>
        ) : null}
      </div>

      {refreshError ? (
        <div className="metAK-error" data-testid="metAK-error" role="status">
          <p>这次刷新没成功，页面保留上一次读到的数据。</p>
          <RequestId id={refreshError.requestId} />
          <Button
            size="sm"
            outlined
            onClick={() => {
              void refreshAll();
            }}
            data-testid="metAK-refresh-retry"
          >
            再试
          </Button>
        </div>
      ) : null}

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
              {/* UI-B 错误态细化：留白走令牌（数值不变，口径与 collab/approvals 系一致）、
                * 标题抬到 text-base 台阶（Mondwest 死字重，字号是唯一可靠层级手段）。
                * 互斥=usageDown/空态分支单值 if 链；rid 可复制（RequestId 复制钮）与
                * 技术信息只进 title tooltip 为既有达标，本笔截图实测复核。 */}
              <CardContent className="flex min-w-0 flex-col gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-6)]">
                <p className="text-base font-medium">{usageDenied ? '这几项数据暂时读不到' : '这次没能读取用量与成本'}</p>
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
                {/* UI-B 错误态组合：卡内唯一主操作=重试（抬起实心）；rid 复制与技术信息
                    （gap 只进 title tooltip）为既有达标现状，本笔实测复核。denied 腿共用本卡，
                    重试同相抬起。单卡小错误腿与刷新条不抬起：整页读不出时「刷新」仍是唯一出口（R207）。 */}
                <Button size="sm" onClick={() => setAttempt((value) => value + 1)} data-testid="met6-retry">
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
                {/* UI-B 空态组合：空窗口只有一个主操作——可换窗时「换到 7 天看看」抬起为实心
                    （工单口径：主操作=切时间窗）；已是 7 天窗口时没有可切的窗，
                    「重新读取」接任唯一主操作（runs/approvals 同型条件互斥姿势）。 */}
                <div className="metD-empty-acts">
                  {usageWindow.id !== '7d' ? (
                    <Button size="sm" onClick={() => chooseUsageWindow('7d')} data-testid="metD-empty-window">
                      换到 7 天看看
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    outlined={usageWindow.id !== '7d' ? true : undefined}
                    onClick={() => setAttempt((value) => value + 1)}
                    data-testid="metD-empty-retry"
                  >
                    重新读取
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="met6-grid">
            <Card
              className="met6-card metQ-card"
              tabIndex={0}
              id="metQ-card-focus-runs"
              aria-describedby="metAD-note-run-stats"
              data-testid="met6-runs"
            >
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
                      busy={refreshBusy || retryingBlock === 'stats'}
                      onClick={() => void retryUsageBlock('stats')}
                      testId="metH-card-retry-runs"
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card
              className="met6-card metQ-card"
              tabIndex={0}
              id="metQ-card-focus-cost"
              aria-describedby="metAD-note-budget-usage"
              data-testid="met6-cost"
            >
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
                      busy={refreshBusy || retryingBlock === 'day'}
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
                      busy={refreshBusy || retryingBlock === 'month'}
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
                  <>
                    <p className="met6-hint">明细只列账本行；金额原样来自账本，不做换算。</p>
                    <p
                      className="met6-hint"
                      data-testid="metAJ-cost-row-caliber"
                      title={costCaliberTitle('metrics')}
                    >
                      {COST_CALIBER_TEXT}
                    </p>
                    <p
                      className="met6-hint"
                      data-testid="metAH-cap-note-snapshot"
                      title="判据：monthSnapshot.rows 先按金额降序，只取前 8 行渲染；完整账本行在下方「导出明细 CSV」与员工分摊表里，本卡片不做分页。"
                    >
                      这张快照只显示前 8 行（按金额从高到低）；完整数据用「导出明细 CSV」，或在下方分摊表按员工逐行看。
                    </p>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card
              className="met6-card metQ-card"
              tabIndex={0}
              id="metQ-card-focus-trend"
              aria-describedby="metAD-note-run-stats"
              data-testid="met6-trend"
            >
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
                      busy={refreshBusy || retryingBlock === 'stats'}
                      onClick={() => void retryUsageBlock('stats')}
                      testId="metH-card-retry-trend"
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card
              className="met6-card metQ-card"
              tabIndex={0}
              id="metQ-card-focus-price"
              aria-describedby="metAD-note-pricing"
              data-testid="met6-price"
            >
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
                {usageReady && usageReady.pricing.kind === 'ready' && usageReady.pricing.value.rows.length > 0 ? (
                  <p
                    className="met6-hint"
                    data-testid="metAH-cap-note-pricing"
                    title={`判据：价目表按服务返回顺序只取前 5 行渲染；本次共 ${usageReady.pricing.value.rows.length} 行，其余行本页不展示也不导出，完整价目以模型价目表读口为准。`}
                  >
                    价目表只显示前 5 行；本页不导出价目，完整价目以模型价目表为准。
                  </p>
                ) : null}
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
                      busy={refreshBusy || retryingBlock === 'pricing'}
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
                  disabled={!gates.detailExport.enabled}
                  title={gates.detailExport.title ?? undefined}
                  onClick={exportCsv}
                  data-testid="met6-export"
                >
                  导出明细 CSV
                </Button>
                {breakdownView.kind === 'unavailable' ? (
                  <span className="metI-gap" data-testid="metI-detail-blocked">
                    成本明细这次没读出来：导出文件只写表头，并在末尾注明缺这一块。
                  </span>
                ) : null}
                {detailGaps.length > 0 ? (
                  <span className="metI-gap" data-testid="metI-detail-gap">
                    本次导出缺少：{detailGaps.map((gap) => gap.label).join('、')}——文件末尾会写明原因，缺的列留空，不填 0。
                  </span>
                ) : null}
                <span className="metR-state" data-testid="metR-export-state">
                  {pageFailed
                    ? '导出：整页读取失败，两处 CSV 都暂停'
                    : `导出：明细可导 ${detailRows.length} 行${detailGaps.length > 0 ? `（含 ${detailGaps.length} 处缺块注记）` : ''}；分摊${
                        shareView.kind === 'ready'
                          ? `可导 ${shareRows.length} 行`
                          : shareView.kind === 'loading'
                            ? '读取中'
                            : '暂不可用'
                      }`}
                </span>
                <span
                  className="metI-gap"
                  data-testid="metAI-filename-note"
                  title="命名规则：metrics-detail-<窗口>-<分组>-<排序>-<方向>-<YYYYMMDD-HHmm>.csv 与 metrics-share-<窗口>-<分组>-<排序>-<方向>-<YYYYMMDD-HHmm>.csv；没动过排序时按 cost-desc 写；文件名只用小写字母、数字、短横与点，同一时刻两份文件名必然不同。"
                >
                  导出文件名：明细 metrics-detail-…、分摊 metrics-share-…，含窗口、分组、排序与生成时刻。
                </span>
                <span className="metI-gap" data-testid="metV-export-total-note">
                  两份导出都会在数据行之后、缺块注记之前附一条以「#」开头的合计注释行：它的数字与屏上合计行逐字相同，不计入「可导出 N 行」，也不进数据行。
                </span>
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
                <p className="metW-scroll-hint" data-testid="metW-scroll-hint">
                  左右滑动查看全部列
                </p>
                <a className="metY-skip" href="#metY-after-detail" data-testid="metY-skip-detail">
                  跳到明细表后面的说明
                </a>
                <div
                  className="met6-table-scroll metW-table"
                  role="region"
                  tabIndex={0}
                  aria-label="成本明细表，可横向滚动"
                  data-testid="metW-scroll-detail"
                  onKeyDown={handleTableScrollKeys}
                >
                  <table className="met6-table" data-testid="met6-table">
                    <thead className="metAF-sticky-detail" data-testid="metAF-sticky-detail">
                      <tr>
                        <th scope="col">{breakdownView.view === 'model' ? '模型' : '员工'}</th>
                        <th scope="col" aria-sort={ariaSortFor('cost')} title="金额单位：美元（USD），两位小数" className="met6-num metAF-nowrap" data-testid="metO-fmt-th-spend">
                          <button type="button" className="met6-sort" data-testid="metP-sort-cost" onClick={() => chooseDetailSort('cost')} aria-label="按支出排序">
                            支出（USD）
                          </button>
                        </th>
                        <th scope="col" aria-sort={ariaSortFor('runs')} title="调用次数，单位：次" className="met6-num metAF-nowrap" data-testid="metO-fmt-th-count">
                          <button type="button" className="met6-sort" data-testid="metP-sort-runs" onClick={() => chooseDetailSort('runs')} aria-label="按次数排序">
                            次数（次）
                          </button>
                        </th>
                        <th scope="col" className="met6-num metAF-nowrap" aria-sort={ariaSortFor('share')}  data-testid="metG-a11y-th-share" title="占本窗口合计的比例，单位：百分比，一位小数">
                          <button type="button" className="met6-sort" data-testid="metP-sort-share" onClick={() => chooseDetailSort('share')} aria-label="按占比排序">
                            占比（%）
                          </button>
                        </th>
                        {showPriceCol ? (
                          <th
                            scope="col"
                            className="met6-num metAF-nowrap"
                            data-testid="metO-fmt-th-price"
                            title="价目表里的输入标价，单位：美元/百万 token；是标价不是扣费，缺价的行显示「—」。"
                          >
                            标价（美元/百万token）
                          </th>
                        ) : null}
                        <th scope="col">账本截至</th>
                        <th scope="col">复制</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailRows.map((line, index) => (
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
                          <td className="met6-num">{formatSharePct(line.share)}</td>
                          {showPriceCol ? <td className="met6-num">{unitPriceOf(line)}</td> : null}
                          <td className="met6-num">{line.asOf ? formatBeijing(line.asOf) : '—'}</td>
                          <td className="met6-num">
                            <button
                              type="button"
                              className="met-rowcopy"
                              data-testid={`met-row-copy-${index}`}
                              aria-label={`复制${line.label}这一行`}
                              title="把这一行屏上已显示的分组、运行数、成本与占比复制成一行纯文本"
                              onClick={() => copyDetailRow(line)}
                            >
                              复制该行
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="metT-total" data-testid="metT-total-row">
                        <th scope="row">合计</th>
                        <td className="met6-num" data-testid="metT-detail-total-cost" title="表体各行支出相加；读不到的格子不计入，也不按 0 算">
                          {detailTotals.cost}
                        </td>
                        <td className="met6-num" data-testid="metT-detail-total-count" title="表体各行次数相加；读不到的格子不计入">
                          {detailTotals.count}
                        </td>
                        <td className="met6-num" data-testid="metT-detail-total-share" title="按未舍入的原值合计，逐行进位不影响这里">
                          {detailTotals.share}
                        </td>
                        {showPriceCol ? (
                          // 标价没有合计：单价格子相加不是任何人的钱。
                          <td className="met6-num" data-testid="metT-detail-total-price">—</td>
                        ) : null}
                        <td className="met6-num">—</td>
                        <td className="met6-num">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {rowCopy.status !== 'idle' ? (
                  <div className="met-rowcopy-bar">
                    <span className="met6-hint" role="status" aria-live="polite" data-testid="met-row-copy-status">
                      {rowCopy.status === 'done' ? '已复制' : '复制没成功：下面的文本可以自己选中复制。'}
                    </span>
                    {rowCopy.status === 'failed' ? (
                      <div data-testid="met-row-copy-fallback">
                        <textarea
                          readOnly
                          className="met-rowcopy-text"
                          data-testid="met-row-copy-fallback-text"
                          aria-label="这一行的纯文本"
                          value={rowCopy.body}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {groupResetNote && !pageFailed ? (
                  <p className="met6-hint" data-testid="metS-reset-note">
                    切换分组后，明细排序已回到默认的成本降序；时间窗与分摊的排序、分组选择保持不变。
                  </p>
                ) : null}
                <p className="met6-hint" data-testid="metP-export-order-note">
                  表头可以点着换排序：默认按支出从高到低；缺数据的行总是排在最后，真实的 0 照常参与排序。导出文件按屏上现在的顺序写，行数与这里列出的行数一致。
                </p>
                <p className="met6-hint" data-testid="metT-rounding-note-detail">
                  占比逐行按一位小数四舍五入，合计按未舍入的原值相加，因此合计恰好是全部可读部分之和（占满时即 100%），不会因为逐行进位变成 99.9% 或 100.1%；合计行不参与排序。导出文件的行仍是逐行明细，合计不写进数据行。
                </p>
                <p className="met6-source" id="metY-after-detail" tabIndex={-1} data-testid="met6-cat-source">
                  来源：{breakdownView.source} · 截至{' '}
                  {breakdownView.asOf ? formatBeijing(breakdownView.asOf) : '—'}
                  {' · 合计 '}
                  <span className="font-mono" data-testid="met6-cat-total">
                    {formatUsd(breakdownView.total)}
                  </span>
                  {` · ${detailRows.length} 行`}
                </p>
                <p
                  className="met6-hint"
                  data-testid="metAH-cap-note"
                  title={`判据：这张宽表的行取自当前批次，组件里没有 slice 或行数上限；这里的 ${detailRows.length} 行与上方来源行的计数同源。页面另有两处卡片式短列表（月度快照、价目表）确有截断，各自单独标注。`}
                >
                  宽表逐行全量渲染，共 {detailRows.length} 行；导出与屏上逐行一致。
                </p>
                <p
                  className="met6-hint"
                  data-testid="met-cost-caliber-note"
                  title={costCaliberTitle('metrics')}
                >
                  {COST_CALIBER_TEXT}
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
                disabled={!gates.shareExport.enabled}
                title={gates.shareExport.title ?? undefined}
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
                <p className="metW-scroll-hint" data-testid="metW-scroll-hint-share">
                  左右滑动查看全部列
                </p>
                <a className="metY-skip" href="#metY-after-share" data-testid="metY-skip-share">
                  跳到分摊表后面的说明
                </a>
                <div
                  className="met6-table-scroll metW-table"
                  role="region"
                  tabIndex={0}
                  aria-label="成本分摊表，可横向滚动"
                  data-testid="metW-scroll-share"
                  onKeyDown={handleTableScrollKeys}
                >
                  <table className="met6-table" data-testid={`${sharePrefix}-table`}>
                    <caption className="metG-caption" data-testid="metG-a11y-caption">{`成本分摊：${usageWindow.label} · ${groupBy === 'employee' ? '按员工' : '按模型'} · 按${sortColumnLabel}${sortDir === 'asc' ? '升序' : '降序'}排列`}</caption>
                    <thead className="metAF-sticky-share" data-testid="metAF-sticky-share">
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
                        <th scope="col" className="met6-num metAF-nowrap"  data-testid="metG-a11y-th-runs" data-metO-unit="次" title="运行计数，单位：次" aria-sort={sortKey === 'runs' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                          <button type="button" className="met7-sort" onClick={() => chooseSort('runs')} data-testid={`${sharePrefix}-sort-runs`}>
                            运行数{sortKey === 'runs' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </button>
                        </th>
                        <th scope="col" className="met6-num metAF-nowrap"  data-testid="metG-a11y-th-cost" data-metO-unit="USD" title="金额单位：美元（USD），两位小数" aria-sort={sortKey === 'cost' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                          <button type="button" className="met7-sort" onClick={() => chooseSort('cost')} data-testid={`${sharePrefix}-sort-cost`}>
                            成本{sortKey === 'cost' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </button>
                        </th>
                        <th scope="col" title="占本窗口可分摊实扣的比例，单位：百分比，一位小数" className="met6-num metAF-nowrap" data-testid="metO-fmt-th-pct">占比（%）</th>
                        <th scope="col">运行</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shareRows.map((row) => (
                        <tr
                          key={`${row.model}-${row.slug}`}
                          className="met7-row"
                          tabIndex={0}
                          aria-label={`${row.model}：${formatCount(row.runs)} 次运行，${formatUsd(row.costUsd)}，占比 ${formatSharePct(row.sharePct)}`}
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
                            {formatSharePct(row.sharePct)}
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
                    <tfoot>
                      <tr className="metT-total" data-testid="metT-total-row-share">
                        <th scope="row">合计</th>
                        <td className="met6-num" data-testid="metT-share-total-runs" title="表体各行运行数相加；读不到的格子不计入">
                          {shareTotals.runs}
                        </td>
                        <td className="met6-num" data-testid="metT-share-total-cost" title="表体各行成本相加；读不到的格子不计入，也不按 0 算">
                          {shareTotals.cost}
                        </td>
                        <td className="met6-num" data-testid="metT-share-total-share" title="按未舍入的原值合计，逐行进位不影响这里">
                          {shareTotals.share}
                        </td>
                        <td className="met6-num">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="met6-source" id="metY-after-share" tabIndex={-1} data-testid={`${sharePrefix}-source`}>
                  来源：{groupBy === 'employee' ? '员工账本' : '模型用量'} · 截至{' '}
                  {shareView.value.asOf ? formatBeijing(shareView.value.asOf) : '—'} · 窗口 {shareView.value.days} 天 · 可读实扣合计{' '}
                  <span className="font-mono">{formatUsd(shareTotal)}</span>
                </p>
                <p
                  className="met6-hint"
                  data-testid="metAH-cap-note-share"
                  title={`判据：这张宽表的行取自当前批次，只做排序，没有 slice 或行数上限；这里的 ${shareRows.length} 行与 metA-export-count 同源。页面另有两处卡片式短列表（月度快照、价目表）确有截断，各自单独标注。`}
                >
                  宽表逐行全量渲染，共 {shareRows.length} 行；导出含同一批行。
                </p>
                <p className="met6-hint" data-testid={`${sharePrefix}-hint`}>
                  占比按可读到的实扣金额归一，合计 100%；缺金额的行不参与分摊，显示「—」。排序写在地址里，刷新与前进后退都保留。
                </p>
                <p className="met6-hint" data-testid="metU-consistency-note">
                  上面的「复制摘要」里有一行合计，和这张表的合计行是同一处算出来的：{summaryTotalLine.replace(/^合计：/, '')}。缺失的格子写「—」，整表没有可渲染的行时不造合计。
                </p>
                <p className="met6-hint" data-testid="metT-rounding-note">
                  占比逐行按一位小数四舍五入，合计按未舍入的原值相加，因此合计恰好是全部可读部分之和（占满时即 100%），不会因为逐行进位变成 99.9% 或 100.1%；合计行不参与排序。导出文件的行仍是逐行明细，合计不写进数据行。
                </p>
                <p className="met6-hint" data-testid="metO-fmt-note">
                  数字口径：计数与金额按千分位分组（如 1,234 与 $1,234.56），占比保留一位小数（如 12.3%）；金额只以美元（USD）记，次数只以次记，不再混用别的单位。缺失显示「—」，真实的零显示 0 或 $0.00。导出文件沿用同一套小数位，只去掉符号与千分位，方便程序读取。
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
      <p className="met6-hint" data-testid="metAA-heat-window">
        热力窗口写在地址里：{activeWindow.label}（heat={weeks}）。刷新、前进后退和分享链接都会回到同一个窗口，其它卡片与筛选保持原样。
      </p>

      <div className="metZ-heat-copy">
        <Button size="sm" outlined onClick={copyHeatSummary} data-testid="metZ-copy-heat">
          <Copy className="size-3.5" aria-hidden="true" />
          复制热力摘要
        </Button>
        <span className="metL-status" role="status" aria-live="polite" data-testid="metZ-copy-status">
          {heatCopyStatus === 'done' ? '已复制' : heatCopyStatus === 'failed' ? '复制没成功' : ''}
        </span>
      </div>

      {heatCopyStatus === 'failed' ? (
        <div className="metL-fallback" data-testid="metZ-copy-fallback">
          <p>
            这次没能写入剪贴板，可能是浏览器没有给权限。下面这段文字可以直接选中复制，内容与刚才要复制的一样。
          </p>
          <textarea
            readOnly
            value={heatCopyBody}
            aria-label="热力摘要文本"
            data-testid="metZ-copy-fallback-text"
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      ) : null}

      <p className="met6-hint" data-testid="metX-consistency-note">
        运行数三处对照：窗口总运行{' '}
        <span data-testid="metX-window-runs" title={windowRunsReason}>
          {heatWindowTotal ?? '—'}
        </span>
        {' · '}热力格求和{' '}
        <span data-testid="metX-heat-runs" title={heatRunsReason}>
          {heatCountSum ?? '—'}
        </span>
        {' · '}明细合计{' '}
        <span data-testid="metX-detail-runs" title={detailRunsReason}>
          {detailCountSum ?? '—'}
        </span>
        {' · '}差{' '}
        <span data-testid="metX-delta" title={deltaReason}>
          {countDelta ?? '—'}
        </span>
        。三处都取自这一次读取、不发新请求；热力按{' '}
        {view.kind === 'ready' ? windowRangeLabel(view.activity) : '本期'}，明细按 {usageWindow.label}
        ，口径不同，数值不一致时以各自卡片为准。
      </p>

      <p className="met6-hint metAP-line" data-testid="metAP-runs-caliber" title={runsCaliberHint}>
        <span className="metAP-face">
          运行数口径：热力{' '}
          <span data-testid="metAP-heat">{runsCaliber.heat ?? '—'}</span>
        </span>
        {' · '}
        <span className="metAP-face">
          明细 <span data-testid="metAP-detail">{runsCaliber.detail ?? '—'}</span>
        </span>
        {' · '}
        <span className="metAP-face">
          运行页 <span data-testid="metAP-runs">—</span>
        </span>
        {'｜'}
        <span data-testid="metAP-verdict">
          {runsCaliber.heat !== null && runsCaliber.detail !== null
            ? runsCaliber.heat === runsCaliber.detail
              ? '热力与明细一致；运行页未核对，见 title'
              : '口径不同，见 title'
            : '有面缺数，见 title'}
        </span>
      </p>

      <p
        className="met6-hint metAP-duty-note"
        data-testid="metAP-duty-note"
        title="值班台的今日运行读 workbench/summary?range=1d（BFF 聚合的一日运行数），这一页的运行数读 /api/run-stats 当前时间窗；两页各读自己的口，跨页数值以各自卡片为准，为了对上不改任何一侧的取数。"
      >
        值班台的「今日运行」读的是 BFF 聚合的一日运行数，这一页读运行统计的当前时间窗；两页各读自己的口，跨页数值以各自卡片为准，为了对上不改任何一侧的取数。
      </p>

      <p className="met6-hint metAS-line" data-testid="metAS-cost-caliber" title={costCaliberView.title}>
        <span className="metAS-face">
          日累计 <span data-testid="metAS-day">{formatUsd(costCaliberView.faces[0].value)}</span>
        </span>
        {' · '}
        <span className="metAS-face">
          月累计 <span data-testid="metAS-month">{formatUsd(costCaliberView.faces[1].value)}</span>
        </span>
        {' · '}
        <span className="metAS-face">
          模型聚合 <span data-testid="metAS-usage">{formatUsd(costCaliberView.faces[2].value)}</span>
        </span>
        {'｜'}
        <span data-testid="metAS-verdict">{costCaliberView.verdict}</span>
        {costCaliberView.pairs.length > 0 ? (
          <>
            {'：'}
            <span data-testid="metAS-cost-delta">
              {costCaliberView.pairs.map((pair, index) => (
                <span key={pair.label}>
                  {index > 0 ? '；' : ''}
                  {pair.label} {pair.diff === 0 ? '$0.00' : formatUsd(pair.diff)}
                </span>
              ))}
            </span>
            {costCaliberView.widest ? <span>{`｜差值最大：${costCaliberView.widest}`}</span> : null}
          </>
        ) : null}
        。三面都取自这一次读取，不发新请求；记账与用量推算不是同一套账。
      </p>

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
          {/* UI-B 错误态细化：同 met6 口径——令牌留白（数值不变）+ 标题 text-base 台阶；
            * 唯一实心主操作=「全部重试」（上笔已抬起），单项 CardRetryButton 保持次级。 */}
          <CardContent className="flex min-w-0 flex-col gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-6)]">
            <p className="text-base font-medium">这次没能读取运行活动</p>
            <div data-testid="metH-card-error-heat">
              <p className="text-sm text-muted-foreground" title={view.gap ?? undefined}>{view.message}</p>
              <RequestId id={view.requestId} />
            </div>
            <div className="metH-card-acts">
              <CardRetryButton busy={refreshBusy} onClick={retryHeat} testId="metH-card-retry-heat" />
              {/* UI-B 错误态组合：卡内唯一主操作=「全部重试」（抬起实心），
                  单项重试保持次级；互斥=view.kind 单值枚举 by construction。 */}
              <Button size="sm" onClick={() => setAttempt((value) => value + 1)} data-testid="met5-retry">
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

          <Card
            className="metQ-card"
            tabIndex={0}
            id="metQ-card-focus-heatmap"
            aria-describedby="metAD-note-run-activity"
            data-testid="met5-heatmap"
          >
            <CardContent className="space-y-3 p-4 md:p-6">
              <div className="met5-legend met-heat-legend" data-testid="met-heat-legend">
                <span className="met5-swatch is-l2" aria-hidden="true" />
                <span>有运行</span>
                <span className="met5-swatch is-missing" aria-hidden="true" />
                <span>无数据</span>
                <span className="met-heat-legend-text">{HEAT_LEGEND_TEXT}</span>
              </div>
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
              {heatGapNote ? (
                <p className="met5-hint" data-testid="met-heat-gap-note" title="按这一批热力格里接口没返回的格子计数；缺格不进合计，也不当 0。">
                  {heatGapNote}
                </p>
              ) : null}
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
              <Button
                size="sm"
                outlined
                disabled={sourceCopyDisabled}
                title={sourceCopyDisabled ? '所有读口都没读出来，没有可复制的来源摘要' : '把这张表的内容复制成纯文本'}
                onClick={copySourceSummary}
                data-testid="metAG-copy-sources"
              >
                <Copy className="size-3.5" aria-hidden="true" />
                复制来源摘要
              </Button>
              <span className="metL-status" role="status" aria-live="polite" data-testid="metAG-copy-status">
                {sourceCopyStatus === 'done' ? `已复制 ${sourceList.length} 行` : sourceCopyStatus === 'failed' ? '复制没成功' : ''}
              </span>
            </div>

            {sourceCopyStatus === 'failed' ? (
              <div className="metL-fallback" data-testid="metAG-copy-fallback">
                <p>
                  这次没能写入剪贴板，可能是浏览器没有给权限。下面这段文字可以直接选中复制，内容与刚才要复制的一样。
                </p>
                <textarea
                  readOnly
                  value={sourceCopyValue}
                  aria-label="数据来源摘要文本"
                  data-testid="metAG-copy-fallback-text"
                  onFocus={(event) => event.currentTarget.select()}
                />
              </div>
            ) : null}
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
                  {sourceList.map((row) => {
                    const asof = asOfCell(row.asOf, row.asOfSource);
                    return (
                    <div className="metB-row" role="row" data-testid={`metB-source-row-${row.key}`} key={row.key}>
                      <span className="metB-name" role="cell">
                        {row.label}
                      </span>
                      <code className="metB-path" role="cell">
                        {row.path}
                      </code>
                      <span role="cell" className="metB-asofcell">
                        <span
                          data-testid={`metB-source-asof-${row.key}`}
                          title={asof.title}
                        >
                          {asof.text}
                        </span>
                        {sourceStaleness(row).stale ? (
                          <span
                            className="metM-stale"
                            data-testid={`metM-stale-${row.key}`}
                            title={`采集时刻 ${asOfCell(row.asOf).text} · 读取时刻 ${formatBeijing(row.fetchedAt)} · 判据：读取时刻比采集时刻晚超过 ${Math.round(
                              SOURCE_STALE_MS / 60_000,
                            )} 分钟就提示「数据可能滞后」。读取时刻是这次读取完成的时刻，不是数据时刻；缺失采集时刻的读口不判滞后。`}
                          >
                            数据可能滞后
                          </span>
                        ) : null}
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
                    );
                  })}
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
      <section className="metAB" data-testid="metAB-notes">
        <button
          type="button"
          className="metB-toggle"
          aria-expanded={notesOpen}
          aria-controls="metAB-notes-body"
          data-testid="metAB-notes-toggle"
          onClick={() => setNotesOpen((open) => !open)}
        >
          口径说明
        </button>
        <p className="met5-note">每个读口的名字、实际路径、计算范围，以及缺值怎么显示。</p>
        {notesOpen ? (
          <div id="metAB-notes-body" className="metAB-body" data-testid="metAB-notes-body">
            <ul className="metAB-list">
              {CALIBER_NOTES.map((note) => (
                <li key={note.key} className="metAB-item" data-testid={`metAB-note-${note.key}`}>
                  <p className="metAB-name">{note.label}。</p>
                  <p className="metAB-path">{note.path}。</p>
                  <p>计算范围：{note.scope}。</p>
                  <p>缺值策略：{note.missing}。</p>
                </li>
              ))}
            </ul>
            <p className="met6-hint">
              采集时刻只取上游顶层返回的 ISO 时间；上游没给就是「—」，不拿本机时间顶替。两份导出沿用同一套处理：真 0 写 0 或 $0.00，缺失留空。
            </p>
          </div>
        ) : null}
      </section>

    </main>
  );
}

export default MetricsModulePage;