// Module: metrics — 运行分析（7×24 活动热力）
//
// One read: /agent-api/api/run-activity?weeks=N&tz=Asia/Shanghai. The endpoint
// aggregates whole weeks, so there is no 24-hour window here. Absent cells stay
// absent (—); only a returned count of 0 is a real zero. No count is inferred
// from another endpoint, and no raw field name or HTTP status reaches the page.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
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
  beijingDayKey,
  buildHeatGrid,
  cellRangeLabel,
  chunkIds,
  formatBeijing,
  employeeLabel,
  formatCount,
  formatRate,
  formatUnitPrice,
  formatUsd,
  ledgerAsOf,
  ledgerTotal,
  readActivity,
  readLedger,
  readPricing,
  readRunStats,
  sparkSlots,
  usageWindowOf,
  windowRange,
  windowOf,
  windowRangeLabel,
  type Activity,
  type HeatCell,
  type LedgerRow,
  type PriceRow,
  type RunStats,
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

type UsageState =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      window: UsageWindowId;
      stats: UsageBlock<TrendSnapshot>;
      day: UsageBlock<LedgerSnapshot>;
      month: UsageBlock<LedgerSnapshot>;
      pricing: UsageBlock<{ rows: PriceRow[]; asOf: string | null }>;
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
  const activeWindow = windowOf(params.get('w'));
  const weeks = activeWindow.weeks;
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [usage, setUsage] = useState<UsageState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<{ dow: number; hour: number } | null>(null);

  const load = useCallback(async (signal: { live: boolean }) => {
    setState({ kind: 'loading' });
    try {
      const payload = await fetchJsonStrict(`/agent-api/api/run-activity?weeks=${weeks}&tz=Asia/Shanghai`);
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
  }, [weeks]);

  useEffect(() => {
    if (forced) return;
    const signal = { live: true };
    void load(signal);
    return () => {
      signal.live = false;
    };
  }, [attempt, forced, load]);

  const loadUsage = useCallback(async (signal: { live: boolean }, windowId: UsageWindowId) => {
    setUsage({ kind: 'loading' });
    const preset = usageWindowOf(windowId);
    const now = new Date();
    const range = windowRange(now, windowId);
    const today = beijingDayKey(now);
    const monthKey = today.slice(0, 7);

    const readBlock = async <T,>(
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
    };

    const stats = await readBlock(
      () =>
        fetchJsonStrict(
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

    const ledgerSnapshot = async (periodKind: 'day' | 'month', period: string): Promise<LedgerSnapshot> => {
      const directory = employeeIdsOf(await fetchJsonStrict('/agent-api/api/employees?limit=200'));
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
          fetchJsonStrict(
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
    };

    const day = await readBlock(
      () => ledgerSnapshot('day', today),
      (body) => ({ ok: true, value: body as LedgerSnapshot }),
    );
    const month = await readBlock(
      () => ledgerSnapshot('month', monthKey),
      (body) => ({ ok: true, value: body as LedgerSnapshot }),
    );

    const pricing = await readBlock(
      () => fetchJsonStrict('/agent-api/api/models/pricing'),
      (body) => {
        const parsed = readPricing(body);
        return parsed.kind === 'ok'
          ? { ok: true, value: { rows: parsed.rows, asOf: parsed.asOf } }
          : { ok: false, reason: parsed.reason };
      },
    );

    if (!signal.live) return;
    setUsage({ kind: 'ready', window: windowId, stats, day, month, pricing, loadedAt: new Date().toISOString() });
  }, []);

  useEffect(() => {
    if (forced) return;
    const signal = { live: true };
    void loadUsage(signal, usageWindow.id);
    return () => {
      signal.live = false;
    };
  }, [attempt, forced, loadUsage, usageWindow.id]);

  const view: PageState = forced
    ? forced === 'loading'
      ? { kind: 'loading' }
      : forced === 'empty'
        ? { kind: 'empty', activity: EMPTY_ACTIVITY, loadedAt: new Date().toISOString(), weeks }
        : { kind: 'error', message: '预览状态：这次没能读取运行活动，请稍后重试。', requestId: null, gap: null }
    : state;

  const grid = view.kind === 'ready' ? buildHeatGrid(view.activity) : null;
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
          loadedAt: new Date().toISOString(),
        }
    : usage;

  const usageReady = usageView.kind === 'ready' ? usageView : null;
  const usageBlocks = usageReady ? [usageReady.stats, usageReady.day, usageReady.pricing] : [];
  const usageDown = usageReady !== null && usageBlocks.every((block) => block.kind === 'unavailable');
  const usageDenied =
    usageDown && usageBlocks.every((block) => block.kind === 'unavailable' && block.gap === USAGE_GAP);
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
  const monthSnapshot = usageReady && usageReady.month.kind === 'ready' ? usageReady.month.value : null;

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

  return (
    <main className="met5-page" data-testid="met5-page">
      <div className="met5-head">
        <div>
          <h1>运行分析</h1>
          <p>按星期与小时看运行都落在什么时段。没有记录的格子显示「—」，不补 0。</p>
        </div>
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
      </div>

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
            <Card data-testid={usageDenied ? 'met6-denied' : 'met6-error'}>
              <CardContent className="space-y-2 p-6">
                <p className="font-medium">{usageDenied ? '这几项数据暂时读不到' : '这次没能读取用量与成本'}</p>
                <p className="text-sm text-muted-foreground">
                  {usageDenied
                    ? '可能是这些数据还没有接入，也可能是当前账号没有查看权限。两种情况给同一句话，页面不回答「到底有没有」。'
                    : '读取的时候没有成功，页面没有用旧内容顶上，也没有按 0 补。'}
                </p>
                <RequestId
                  id={
                    usageBlocks
                      .map((block) => (block.kind === 'unavailable' ? block.requestId : null))
                      .find((id): id is string => typeof id === 'string' && id.length > 0) ?? null
                  }
                />
                <Button size="sm" outlined onClick={() => setAttempt((value) => value + 1)} data-testid="met6-retry">
                  重试
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {usageQuiet ? (
            <Card data-testid="met6-empty">
              <CardContent className="space-y-2 p-6">
                <p className="font-medium">这个窗口还没有用量记录</p>
                <p className="text-sm text-muted-foreground">
                  运行统计没有返回这个窗口的运行，账本也没有今天的实扣行，因此这里既没有次数也没有金额——不补 0，也不拿别的时段顶替。
                </p>
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
                <p className="met6-hint">
                  {usageReady && usageReady.stats.kind === 'ready'
                    ? `${formatBeijing(usageReady.stats.value.from)} — ${formatBeijing(usageReady.stats.value.to)}（北京时间）`
                    : '窗口按北京时间计算；没有可统计样本时成功率显示「—」。'}
                </p>
                <p className="met6-source" data-testid="met6-runs-source">
                  来源：运行统计 · 读取于 {usageReady ? formatBeijing(usageReady.loadedAt) : '—'}
                </p>
                {usageReady && usageReady.stats.kind === 'unavailable' ? (
                  <p className="met6-gap" data-testid="met6-runs-gap" title={usageReady.stats.gap ?? undefined}>
                    {usageReady.stats.reason}
                  </p>
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
                  <p className="met6-gap" data-testid="met6-cost-gap" title={usageReady.day.gap ?? undefined}>
                    {usageReady.day.reason}
                  </p>
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
                  <p className="met6-gap" data-testid="met6-trend-gap" title={usageReady.stats.gap ?? undefined}>
                    {usageReady.stats.reason}
                  </p>
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
                  <p className="met6-gap" data-testid="met6-price-gap" title={usageReady.pricing.gap ?? undefined}>
                    {usageReady.pricing.reason}
                  </p>
                ) : null}
              </CardContent>
            </Card>
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
            <p className="text-sm text-muted-foreground" title={view.gap ?? undefined}>{view.message}</p>
            <RequestId id={view.requestId} />
            <Button size="sm" outlined onClick={() => setAttempt((value) => value + 1)} data-testid="met5-retry">
              重试
            </Button>
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
                <div className="met5-gridwrap">
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
                            aria-label={`${row.label} ${String(cell.hour).padStart(2, '0')} 点，${cellText(cell)}`}
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
    </main>
  );
}

export default MetricsModulePage;