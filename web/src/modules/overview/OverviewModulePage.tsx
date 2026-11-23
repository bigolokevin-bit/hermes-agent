/**
 * Q11 总览 KPI 真读数页（task/Q11-overview-kpi）。
 *
 * 合同：所有 KPI 卡只来自现网 BFF 已存在的两个端点——
 * `/api/overview/summary`（员工/今日运行/今日成本/待审批/健康，字段自带口径原文）
 * 与 `/api/run-stats?from&to&bucket=day`（今日失败数/失败率、14 日趋势；
 * 现网没有独立 daily-trend 端点，实测 404，趋势即 run-stats 的日桶序列）。
 *
 * 诚实口径：读不到 → 「未接」置 null，不以 0 冒充；真 0 → 附接口自带 source 说明；
 * 不引 fixture；原始 JSON 在「本次读数」面板原样可见（无 innerHTML 注入面）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { fetchRunStats, load } from '../duty/api';
import { DEFAULT_DUTY_RANGE, DUTY_RANGES, parseDutyRange, type DutyRangeId } from '../duty/dutyRange';
import { beijingDayWindow, daysAgoWindow, usd } from '../duty/format';
import type { Loadable, RunStatsBody } from '../duty/types';
import {
  fetchBlockedTasks,
  fetchFailedRuns,
  fetchOverviewSummary,
  fetchRecentRuns,
  fetchWorkbenchQueue,
  type OverviewSummaryBody,
  type QueueBody,
  type RunsBody,
  type TasksBody,
} from './api';
import {
  OVERVIEW_GAP,
  activityRows,
  blockerCounts,
  blockerRows,
  buildKpis,
  last24hWindow,
  sourceStamp,
  todayBucketRun,
  trendPoints,
  type KpiDatum,
  type SourceStamp,
} from './overview';
import './overview.css';

const RETRY_MS = 20_000;

export interface OverviewState {
  summary: Loadable<OverviewSummaryBody>;
  today: Loadable<RunStatsBody>;
  trend: Loadable<RunStatsBody>;
  /** OM-07 最近运行（runs?since&limit）。 */
  act?: Loadable<RunsBody>;
  /** OM-08 阻塞三路。 */
  fail?: Loadable<RunsBody>;
  blocked?: Loadable<TasksBody>;
  queue?: Loadable<QueueBody>;
}

const INITIAL: OverviewState = {
  summary: { k: 'loading' },
  today: { k: 'loading' },
  trend: { k: 'loading' },
  act: { k: 'loading' },
  fail: { k: 'loading' },
  blocked: { k: 'loading' },
  queue: { k: 'loading' },
};

const LOADING: Loadable<never> = { k: 'loading' };

function RequestId({ id }: { id: string | null }) {
  if (!id) return null;
  return (
    <span className="ov5-req" data-testid="ov6-copy-req" title="排查时请提供此编号">
      请求编号 {id}
    </span>
  );
}

function Freshness({ stamp, id }: { stamp: SourceStamp; id: string }) {
  return (
    <div className="ov5-stamps" data-testid={id}>
      {stamp.shown ? (
        <span className="ov5-stamp">数据截至 {stamp.shown}</span>
      ) : (
        <span className="ov5-stamp ov5-stamp-unknown">时间未知（{stamp.reason}）</span>
      )}
    </div>
  );
}

interface KpiIssue {
  label: string;
  state: Loadable<unknown>;
  gap: string;
}

function KpiCard(props: {
  testid: string;
  title: string;
  value: string;
  /** 值缺失时的口径原因（未接说明）。 */
  missingReason?: string | null;
  datum: KpiDatum;
  foot?: React.ReactNode;
  stamp: SourceStamp;
  issue?: KpiIssue | null;
  onRetry: () => void;
  children?: React.ReactNode;
}) {
  const { testid, title, value, datum, foot, stamp, issue, onRetry, children } = props;
  const errored = issue?.state.k === 'error';
  const notWired = !errored && datum.value === null;
  const isZero = datum.value === 0 || datum.value === '0';
  const sourceShown = datum.value === null ? '来源未读取到' : datum.source ?? '来源未标注';
  const note = errored
    ? null
    : notWired
      ? props.missingReason ?? '接口未返回该读数；置 null，不以 0 冒充。'
      : isZero
        ? `0 来自接口真实返回：${datum.source ?? '来源未标注'}。`
        : null;

  return (
    <section className="ov5-kpi" data-testid={testid} data-duty-testid={testid.replace('ov6-', 'duty-')}>
      <header className="ov5-kpi-hd">
        <span>{title}</span>
        <span className="ov5-kpi-src">{sourceShown}</span>
      </header>
      <div className={`ov5-kpi-value${notWired && !errored ? ' ov5-unknown' : ''}`} data-testid={`${testid}-value`}>
        {value}
      </div>
      <div className="ov5-kpi-foot" data-testid={`${testid}-foot`}>
        {foot}
      </div>
      {note ? (
        <p className="ov5-note" data-testid={`${testid}-note`} title={datum.source ?? undefined}>
          {note}
        </p>
      ) : null}
      <Freshness stamp={stamp} id={`${testid}-stamp`} />
      {issue && issue.state.k === 'error' ? (
        <div className="ov5-kpi-issue" data-testid={`${testid}-issue`} role="alert">
          <span>
            {issue.label}未接入：{issue.state.message}
          </span>
          <RequestId id={issue.state.requestId} />
          <button type="button" onClick={onRetry} data-testid={`${testid}-issue-retry`}>
            重试
          </button>
        </div>
      ) : null}
      {children}
    </section>
  );
}

const HEALTH_LABEL: Record<string, string> = { ok: '正常', degraded: '降级', down: '异常' };

function numText(d: KpiDatum): string {
  return d.value === null ? '未接' : String(d.value);
}

interface OverviewViewProps {
  state: OverviewState;
  todayDate: string;
  onRetry: () => void;
  /** OM-04 时间窗档位；缺省 14 日（与旧页默认一致）。 */
  rangeId?: DutyRangeId;
  /** 非法 ?range= 原值：如实回显并说明已回落默认档。 */
  rangeFallback?: string | null;
  /** 切换档位（写 ?range=）；演示分支不传即只读。 */
  onRange?: (id: DutyRangeId) => void;
  /** 演示状态（?state=）标记：本次未请求接口，一切读数显示未接。 */
  demo?: boolean;
}

export function OverviewView({
  state,
  todayDate,
  onRetry,
  rangeId = DEFAULT_DUTY_RANGE,
  rangeFallback = null,
  onRange,
  demo = false,
}: OverviewViewProps) {
  const rangeDef = DUTY_RANGES.find((r) => r.id === rangeId) ?? DUTY_RANGES[2];
  const hourBucket = rangeDef.id === '24h';
  const bucketUnit = hourBucket ? '小时' : '日';
  // OM-07/08：可选腿缺省按读取中处理（旧测试构造的三腿 state 不受影响）。
  const act = state.act ?? LOADING;
  const fail = state.fail ?? LOADING;
  const blockedL = state.blocked ?? LOADING;
  const queueL = state.queue ?? LOADING;
  const actRows = activityRows(act.k === 'ready' ? act.data : null);
  const bCounts = blockerCounts(fail, blockedL, queueL);
  const bRows = blockerRows(
    fail.k === 'ready' ? fail.data : null,
    blockedL.k === 'ready' ? blockedL.data : null,
    queueL.k === 'ready' ? queueL.data : null,
  );
  const kpis = useMemo(
    () =>
      buildKpis(
        state.summary.k === 'ready' ? state.summary.data : null,
        state.today.k === 'ready' ? state.today.data : null,
      ),
    [state.summary, state.today],
  );
  const points = useMemo(
    () =>
      trendPoints(state.trend.k === 'ready' ? state.trend.data : null, {
        bucket: hourBucket ? 'hour' : 'day',
        cap: hourBucket ? 24 : rangeDef.days,
      }),
    [state.trend, hourBucket, rangeDef.days],
  );

  const summaryStamp = sourceStamp(state.summary);
  const todayStamp = sourceStamp(state.today);
  const trendStamp = sourceStamp(state.trend);

  const asof = useMemo(() => {
    const candidates = [summaryStamp.shown, todayStamp.shown, trendStamp.shown]
      .filter((v): v is string => !!v)
      .sort();
    return candidates.length ? candidates[candidates.length - 1] : null;
  }, [summaryStamp, todayStamp, trendStamp]);

  const allError =
    state.summary.k === 'error' && state.today.k === 'error' && state.trend.k === 'error';

  const rawBodies = useMemo(() => {
    const ready: Array<{ name: string; body: unknown }> = [];
    if (state.summary.k === 'ready') ready.push({ name: 'GET /api/overview/summary', body: state.summary.data });
    if (state.today.k === 'ready') ready.push({ name: 'GET /api/run-stats（今日窗）', body: state.today.data });
    if (act.k === 'ready') ready.push({ name: 'GET /api/runs?since&limit（近 7 天）', body: act.data });
    if (fail.k === 'ready') ready.push({ name: 'GET /api/runs?status=failed', body: fail.data });
    if (blockedL.k === 'ready') ready.push({ name: 'GET /api/tasks?status=blocked', body: blockedL.data });
    if (queueL.k === 'ready') ready.push({ name: 'GET /api/workbench/queue', body: queueL.data });
    return ready;
  }, [state.summary, state.today, act, fail, blockedL, queueL]);

  return (
    <div className="ov5-page" data-testid="overview-page" data-demo-state={demo ? '1' : undefined}>
      {demo ? <div className="ov5-watermark" data-testid="ov6-watermark">演示状态：本次未请求接口，所有读数如实显示未接</div> : null}
      <header className="ov5-head">
        <h1>数字员工总览</h1>
        <p className="ov5-sub" data-testid="ov6-asof" title="取各来源响应自带的采集时间，不拿前端时间冒充">
          {asof ? `数据截至 ${asof}（北京时间）` : '数据截至 —（只认上游采集时间，前端时钟不顶替）'}
          <Link to="/overview" data-testid="ov6-back-duty">返回旧总览</Link>
        </p>
        <nav className="ov5-range" aria-label="时间窗切换" data-testid="ov6-range">
          {DUTY_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              data-testid={`ov6-range-${r.id}`}
              aria-pressed={r.id === rangeDef.id}
              className={r.id === rangeDef.id ? 'is-active' : undefined}
              onClick={() => onRange?.(r.id)}
              disabled={!onRange}
            >
              {r.label}
            </button>
          ))}
        </nav>
        {rangeFallback ? (
          <p className="ov5-note" data-testid="ov6-range-fallback">
            时间窗「{rangeFallback}」不是可用档位，已按默认档（{rangeDef.label}）显示。
          </p>
        ) : null}
      </header>

      {allError ? (
        <div className="ov5-error-card" data-testid="ov6-error" role="alert">
          <p>两条读数链路都没有接通，这一屏没有任何数字是编造的。</p>
          <RequestId id={state.summary.k === 'error' ? state.summary.requestId : null} />
          <button type="button" onClick={onRetry} data-testid="ov6-retry">重新读取</button>
        </div>
      ) : (
        <section className="ov5-kpis" data-testid="ov6-kpis">
          <KpiCard
            testid="ov6-kpi-employees"
            title="员工总数"
            value={numText(kpis.employees)}
            datum={kpis.employees}
            foot={
              <span data-testid="ov6-employees-detail">
                在岗 {kpis.active.value === null ? '未接' : kpis.active.value}
              </span>
            }
            stamp={summaryStamp}
            issue={{ label: '聚合总览', state: state.summary, gap: OVERVIEW_GAP.employees }}
            onRetry={onRetry}
          />
          <KpiCard
            testid="ov6-kpi-runs"
            title="今日运行"
            value={numText(kpis.todayRuns)}
            datum={kpis.todayRuns}
            missingReason={
              state.summary.k === 'ready' && kpis.todayRuns.value === null
                ? '接口未返回今日运行读数；未用 run-stats 桶合计冒充（口径不同）。'
                : null
            }
            foot={
              <span data-testid="ov6-runs-detail">
                失败 {kpis.failed.value === null ? '未接' : kpis.failed.value} · 失败率{' '}
                {kpis.failureRate.value === null ? '未接' : `${kpis.failureRate.value}%`}
              </span>
            }
            stamp={summaryStamp}
            issue={{ label: '运行统计（今日）', state: state.today, gap: OVERVIEW_GAP.runs }}
            onRetry={onRetry}
          />
          <KpiCard
            testid="ov6-kpi-pending"
            title="待审批"
            value={numText(kpis.pending)}
            datum={kpis.pending}
            stamp={summaryStamp}
            issue={{ label: '聚合总览', state: state.summary, gap: OVERVIEW_GAP.approvals }}
            onRetry={onRetry}
          />
          <KpiCard
            testid="ov6-kpi-cost"
            title="今日成本"
            value={kpis.costUsd.value === null ? '未接' : usd(Number(kpis.costUsd.value))}
            datum={kpis.costUsd}
            stamp={summaryStamp}
            issue={{ label: '聚合总览', state: state.summary, gap: OVERVIEW_GAP.cost }}
            onRetry={onRetry}
          />
          <KpiCard
            testid="ov6-kpi-health"
            title="整体健康"
            value={
              kpis.health.value === null
                ? '未接'
                : HEALTH_LABEL[String(kpis.health.value)] ?? String(kpis.health.value)
            }
            datum={kpis.health}
            foot={<span>本请求三路上游探测的合成状态</span>}
            stamp={summaryStamp}
            issue={{ label: '聚合总览', state: state.summary, gap: OVERVIEW_GAP.health }}
            onRetry={onRetry}
          />
        </section>
      )}

      <section className="ov5-block" data-testid="ov6-trend" aria-label={`${rangeDef.label}运行趋势`}>
        <header className="ov5-block-hd">
          <span>{rangeDef.label}运行趋势（run-stats {bucketUnit}桶）</span>
          <span className="ov5-kpi-src">GET /api/run-stats?from&to&bucket={hourBucket ? 'hour' : 'day'}</span>
        </header>
        {state.trend.k === 'error' ? (
          <div className="ov5-kpi-issue" data-testid="ov6-trend-issue" role="alert">
            <span>趋势读数未接入：{state.trend.message}</span>
            <RequestId id={state.trend.requestId} />
            <button type="button" onClick={onRetry} data-testid="ov6-trend-issue-retry">重试</button>
          </div>
        ) : points.length === 0 ? (
          <div className="ov5-empty-line" data-testid="ov6-trend-empty">
            {state.trend.k === 'loading'
              ? '读取中…'
              : `${rangeDef.label}内接口没有返回任何${bucketUnit}桶，这里不放柱子图。`}
          </div>
        ) : points.every((p) => p.runs === null) ? (
          <div className="ov5-empty-line" data-testid="ov6-trend-empty">
            {`${rangeDef.label}内接口返回的${bucketUnit}桶没有可用的运行数，这里不放柱子图。`}
          </div>
        ) : points.every((p) => p.runs === 0) ? (
          <div className="ov5-empty-line" data-testid="ov6-trend-empty">
            {`${rangeDef.label}内接口真数为 0，还没有运行记录，这里不放柱子图。`}
          </div>
        ) : (
          <div className="ov5-bars" data-testid="ov6-bars">
            {points.map((p) => (
              <div
                className={`ov5-bar${p.runs === null ? ' is-missing' : ''}`}
                key={p.day}
                title={`${p.label} · 运行 ${p.runs === null ? '未接' : p.runs} · 失败 ${p.failed === null ? '未接' : p.failed}`}
              >
                <span className="ov5-bar-track">
                  {p.runs !== null && p.runs > 0 ? (
                    <i style={{ height: `${Math.max(2, Math.min(100, (p.runs / Math.max(1, ...points.map((x) => x.runs ?? 0)))) * 100)}%` }} />
                  ) : null}
                </span>
                <em>{p.label}</em>
              </div>
            ))}
          </div>
        )}
        <Freshness stamp={trendStamp} id="ov6-trend-stamp" />
        <p className="ov5-note">
          今日桶计数 {todayBucketRun(state.today.k === 'ready' ? state.today.data : null, todayDate) === null
            ? '未接'
            : todayBucketRun(state.today.k === 'ready' ? state.today.data : null, todayDate)}（今日窗现查，
            与上方{rangeDef.label}分开请求）。
        </p>
      </section>

      <section className="ov5-block" data-testid="ov6-activity" aria-label="最近运行">
        <header className="ov5-block-hd">
          <span>近 7 天 · 最近运行</span>
          <span className="ov5-source">GET /api/runs?since&amp;limit</span>
        </header>
        {act.k === 'error' ? (
          <div className="ov5-kpi-issue" data-testid="ov6-activity-issue">
            最近运行未接入：{act.message}
            <RequestId id={act.requestId} />
            <button type="button" onClick={onRetry} data-testid="ov6-activity-issue-retry">重试</button>
          </div>
        ) : act.k !== 'ready' ? (
          <div className="ov5-empty-line" data-testid="ov6-activity-loading">读取中…</div>
        ) : actRows.length === 0 ? (
          <div className="ov5-empty-line" data-testid="ov6-activity-empty">
            近 7 天接口没有返回任何运行记录（真 0，不是占位）。
          </div>
        ) : (
          <ul className="ov5-rows" data-testid="ov6-activity-rows">
            {actRows.map((r) => (
              <li key={r.runId} data-testid="ov6-activity-row">
                <Link to={`/runs/${r.runId}`}>{r.runId}</Link>
                <span className="ov5-obj">{r.status ?? '状态未带'}</span>
                <span className="ov5-obj">{r.time ?? '时间未带'}</span>
              </li>
            ))}
          </ul>
        )}
        <Freshness stamp={sourceStamp(act)} id="ov6-activity-stamp" />
      </section>

      <section className="ov5-block" data-testid="ov6-blockers" aria-label="阻塞项">
        <header className="ov5-block-hd">
          <span>阻塞项（三路接口合并）</span>
          <span className="ov5-source">runs?status=failed · tasks?status=blocked · workbench/queue</span>
        </header>
        {([
          { leg: fail, label: '失败运行', testid: 'fail' },
          { leg: blockedL, label: '受阻任务', testid: 'blocked' },
          { leg: queueL, label: '待审批队列', testid: 'queue' },
        ] as Array<{ leg: Loadable<unknown>; label: string; testid: string }>)
          .filter((e) => e.leg.k === 'error')
          .map((e) => (
            <div className="ov5-kpi-issue" data-testid={`ov6-blockers-issue-${e.testid}`} key={e.testid}>
              {e.label}未接入：
              {e.leg.k === 'error' ? e.leg.message : ''}
              <RequestId id={e.leg.k === 'error' ? e.leg.requestId : null} />
              <button type="button" onClick={onRetry} data-testid="ov6-blockers-issue-retry">
                重试
              </button>
            </div>
          ))}
        {bRows.length === 0 ? (
          fail.k === 'ready' && blockedL.k === 'ready' && queueL.k === 'ready' ? (
            <div className="ov5-empty-line" data-testid="ov6-blockers-empty">
              三路接口都接通了，当前没有阻塞项（真 0，不是占位）。
            </div>
          ) : (
            <div className="ov5-empty-line" data-testid="ov6-blockers-pending">
              三路读数未全部接通，这里只列已接通部分的阻塞项，不合并猜测。
            </div>
          )
        ) : (
          <ul className="ov5-rows" data-testid="ov6-blocker-rows">
            {bRows.map((r) => (
              <li key={r.key} data-testid="ov6-blocker-row">
                {r.to ? (
                  <Link to={r.to}>{r.title}</Link>
                ) : (
                  <span>{r.title}</span>
                )}
                <span className="ov5-obj">{r.origin}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="ov5-note" data-testid="ov6-blockers-count">
          失败运行 {bCounts.failed ?? '未接'} · 受阻任务 {bCounts.blocked ?? '未接'} · 待审批{' '}
          {bCounts.queue ?? '未接'}（计数来自各接口返回条数，真 0 来自接口）。
        </p>
      </section>

      <section className="ov5-block" data-testid="ov6-source">
        <header className="ov5-block-hd">
          <span>本次读数（接口原文，未加工）</span>
        </header>
        {rawBodies.length === 0 ? (
          <div className="ov5-empty-line">还没有成功的接口响应可展示。</div>
        ) : (
          rawBodies.map((r) => (
            <details key={r.name} data-testid={`ov6-raw-${r.name.slice(4, 12)}`}>
              <summary>{r.name}</summary>
              <pre className="ov5-rows">{JSON.stringify(r.body, null, 2)}</pre>
            </details>
          ))
        )}
        <p className="ov5-note" title="前端到页面的时间只是本机加载时间，不代表新鲜度">
          页面时间不参与新鲜度判定；新鲜度只认各来源响应自带的「数据截至」采集时间。
        </p>
      </section>
    </div>
  );
}

export function OverviewModulePage() {
  const [params, setParams] = useSearchParams();
  const forced = params.get('state');
  const [state, setState] = useState<OverviewState>(INITIAL);
  const summarySeq = useRef(0);
  const trendSeq = useRef(0);
  // 北京日窗在挂载时现查；重试沿用同窗，跨午夜后的窗口由下次整页加载刷新。
  const win = useMemo(() => beijingDayWindow(), []);
  // OM-04：时间窗档位以 ?range= 深链为准，非法值回落默认档并给说明。
  const rawRange = params.get('range');
  const rangeId = parseDutyRange(rawRange);
  const rangeFallback = rawRange && rawRange !== rangeId ? rawRange : null;
  const rangeDef = DUTY_RANGES.find((r) => r.id === rangeId) ?? DUTY_RANGES[2];
  const trendWin = useMemo(() => {
    if (rangeDef.id === '24h') {
      // 24h 档走 hour 桶（现网 run-stats bucket=hour 实测 200，空桶如实空态）。
      const w = last24hWindow();
      return { from: w.from, to: w.to, bucket: 'hour' as const };
    }
    const w = daysAgoWindow(rangeDef.days - 1);
    return { ...w, bucket: 'day' as const };
  }, [rangeDef]);

  // OM-07：近 7 天窗在挂载时定窗；重试沿用同窗（daysAgoWindow 内部取时，保持渲染纯度）。
  const since7d = useMemo(() => daysAgoWindow(7).from, []);

  const loadSummaryToday = useCallback(async () => {
    summarySeq.current += 1;
    const seq = summarySeq.current;
    const [s, t] = await Promise.all([
      load(fetchOverviewSummary),
      load(() => fetchRunStats(win.from, win.to)),
    ]);
    if (seq !== summarySeq.current) return; // 迟到的旧响应不得覆盖新结果（防闪烁规则）。
    setState((prev) => ({ ...prev, summary: s, today: t }));
  }, [win]);

  const loadTrend = useCallback(async () => {
    trendSeq.current += 1;
    const seq = trendSeq.current;
    setState((prev) => ({ ...prev, trend: { k: 'loading' } }));
    const tr = await load(() => fetchRunStats(trendWin.from, trendWin.to, trendWin.bucket));
    if (seq !== trendSeq.current) return;
    setState((prev) => ({ ...prev, trend: tr }));
  }, [trendWin]);

  const extrasSeq = useRef(0);
  const loadExtras = useCallback(async () => {
    extrasSeq.current += 1;
    const seq = extrasSeq.current;
    const [a, f, b, q] = await Promise.all([
      load(() => fetchRecentRuns(since7d)),
      load(fetchFailedRuns),
      load(fetchBlockedTasks),
      load(fetchWorkbenchQueue),
    ]);
    if (seq !== extrasSeq.current) return;
    setState((prev) => ({ ...prev, act: a, fail: f, blocked: b, queue: q }));
  }, [since7d]);

  const retryAll = useCallback(() => {
    void loadSummaryToday();
    void loadTrend();
    void loadExtras();
  }, [loadSummaryToday, loadTrend, loadExtras]);

  const selectRange = useCallback(
    (id: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('range', id);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  useEffect(() => {
    if (forced === 'loading' || forced === 'empty' || forced === 'error') return;
    void loadSummaryToday();
  }, [loadSummaryToday, forced]);

  // 换档只重发趋势腿：loadTrend 依赖 trendWin，档位变化即且仅即触发一次新请求。
  useEffect(() => {
    if (forced === 'loading' || forced === 'empty' || forced === 'error') return;
    void loadTrend();
  }, [loadTrend, forced]);

  // OM-07/08：列表腿挂载一次 + 手动/定时重试；换档不重发（与趋势无关）。
  useEffect(() => {
    if (forced === 'loading' || forced === 'empty' || forced === 'error') return;
    void loadExtras();
  }, [loadExtras, forced]);

  // 自动重试：任一路失败时静默周期重读；成功即停表。
  const anyError =
    state.summary.k === 'error' ||
    state.today.k === 'error' ||
    state.trend.k === 'error' ||
    state.act?.k === 'error' ||
    state.fail?.k === 'error' ||
    state.blocked?.k === 'error' ||
    state.queue?.k === 'error';
  useEffect(() => {
    if (!anyError || forced) return;
    const timer = window.setInterval(retryAll, RETRY_MS);
    return () => window.clearInterval(timer);
  }, [anyError, retryAll, forced]);

  if (forced === 'loading') {
    return (
      <div className="ov5-page" data-testid="overview-page" data-fixture="1">
        <div className="ov5-skeleton" data-testid="ov6-loading" />
      </div>
    );
  }
  if (forced === 'empty') {
    return (
      <OverviewView
        state={{
          summary: { k: 'ready', data: {} },
          today: { k: 'ready', data: {} },
          trend: { k: 'ready', data: {} },
          act: { k: 'ready', data: {} },
          fail: { k: 'ready', data: {} },
          blocked: { k: 'ready', data: {} },
          queue: { k: 'ready', data: {} },
        }}
        todayDate={win.date}
        onRetry={retryAll}
        rangeId={rangeId}
        rangeFallback={rangeFallback}
        onRange={selectRange}
        demo
      />
    );
  }
  if (forced === 'error') {
    return (
      <OverviewView
        state={{
          summary: { k: 'error', status: 503, message: '演示错误态（未请求接口）', requestId: null },
          today: { k: 'error', status: 503, message: '演示错误态（未请求接口）', requestId: null },
          trend: { k: 'error', status: 503, message: '演示错误态（未请求接口）', requestId: null },
          act: { k: 'error', status: 503, message: '演示错误态（未请求接口）', requestId: null },
          fail: { k: 'error', status: 503, message: '演示错误态（未请求接口）', requestId: null },
          blocked: { k: 'error', status: 503, message: '演示错误态（未请求接口）', requestId: null },
          queue: { k: 'error', status: 503, message: '演示错误态（未请求接口）', requestId: null },
        }}
        todayDate={win.date}
        onRetry={retryAll}
        rangeId={rangeId}
        rangeFallback={rangeFallback}
        onRange={selectRange}
        demo
      />
    );
  }
  return (
    <OverviewView
      state={state}
      todayDate={win.date}
      onRetry={retryAll}
      rangeId={rangeId}
      rangeFallback={rangeFallback}
      onRange={selectRange}
    />
  );
}

export default OverviewModulePage;
