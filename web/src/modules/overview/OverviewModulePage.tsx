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
import { beijing, beijingDayWindow, daysAgoWindow, usd } from '../duty/format';
import type { Loadable, RunStatsBody } from '../duty/types';
import { fetchOverviewSummary, type OverviewSummaryBody } from './api';
import {
  OVERVIEW_GAP,
  buildKpis,
  sourceStamp,
  todayBucketRun,
  trendPoints,
  type KpiDatum,
  type SourceStamp,
} from './overview';
import './overview.css';

const RETRY_MS = 20_000;

interface OverviewState {
  summary: Loadable<OverviewSummaryBody>;
  today: Loadable<RunStatsBody>;
  trend: Loadable<RunStatsBody>;
}

const INITIAL: OverviewState = {
  summary: { k: 'loading' },
  today: { k: 'loading' },
  trend: { k: 'loading' },
};

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
  /** 演示状态（?state=）标记：本次未请求接口，一切读数显示未接。 */
  demo?: boolean;
}

export function OverviewView({ state, todayDate, onRetry, demo = false }: OverviewViewProps) {
  const kpis = useMemo(
    () =>
      buildKpis(
        state.summary.k === 'ready' ? state.summary.data : null,
        state.today.k === 'ready' ? state.today.data : null,
      ),
    [state.summary, state.today],
  );
  const points = useMemo(
    () => trendPoints(state.trend.k === 'ready' ? state.trend.data : null),
    [state.trend],
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
    return ready;
  }, [state.summary, state.today]);

  return (
    <div className="ov5-page" data-testid="overview-page" data-demo-state={demo ? '1' : undefined}>
      {demo ? <div className="ov5-watermark" data-testid="ov6-watermark">演示状态：本次未请求接口，所有读数如实显示未接</div> : null}
      <header className="ov5-head">
        <h1>数字员工总览</h1>
        <p className="ov5-sub" data-testid="ov6-asof" title="取各来源响应自带的采集时间，不拿前端时间冒充">
          {asof ? `数据截至 ${asof}（北京时间）` : '数据截至时间未知'}
          <Link to="/overview" data-testid="ov6-back-duty">返回旧总览</Link>
        </p>
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

      <section className="ov5-block" data-testid="ov6-trend">
        <header className="ov5-block-hd">
          <span>近 14 日运行趋势（run-stats 日桶）</span>
          <span className="ov5-kpi-src">GET /api/run-stats?from&to&bucket=day</span>
        </header>
        {state.trend.k === 'error' ? (
          <div className="ov5-kpi-issue" data-testid="ov6-trend-issue" role="alert">
            <span>趋势读数未接入：{state.trend.message}</span>
            <RequestId id={state.trend.requestId} />
            <button type="button" onClick={onRetry} data-testid="ov6-trend-issue-retry">重试</button>
          </div>
        ) : points.length === 0 ? (
          <div className="ov5-empty-line" data-testid="ov6-trend-empty">
            {state.trend.k === 'loading' ? '读取中…' : '未接到任何日桶，这里不放柱子图。'}
          </div>
        ) : (
          <div className="ov5-bars" data-testid="ov6-bars">
            {points.map((p) => (
              <div className="ov5-bar" key={p.day} title={`${p.label} · 运行 ${p.runs === null ? '未接' : p.runs}`}>
                <span className="ov5-bar-track">
                  <i style={{ height: p.runs === null ? '2%' : `${Math.max(2, Math.min(100, (p.runs / Math.max(1, ...points.map((x) => x.runs ?? 0)))) * 100)}%` }} />
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
            与上方 14 日窗分开请求）。
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
          页面时间 <span className="ov5-obj">{beijing(new Date().toISOString())}</span> 仅作加载记录；
          新鲜度以「数据截至」为准。
        </p>
      </section>
    </div>
  );
}

export function OverviewModulePage() {
  const [params] = useSearchParams();
  const forced = params.get('state');
  const [state, setState] = useState<OverviewState>(INITIAL);
  const inFlight = useRef(0);
  // 北京日窗在挂载时现查；重试沿用同窗，跨午夜后的窗口由下次整页加载刷新。
  const win = useMemo(() => beijingDayWindow(), []);
  const trendWin = useMemo(() => daysAgoWindow(13), []);

  const loadAll = useCallback(async () => {
    inFlight.current += 1;
    const seq = inFlight.current;
    const [s, t, tr] = await Promise.all([
      load(fetchOverviewSummary),
      load(() => fetchRunStats(win.from, win.to)),
      load(() => fetchRunStats(trendWin.from, trendWin.to)),
    ]);
    // 迟到的旧响应不得覆盖新结果（防闪烁规则）。
    if (seq !== inFlight.current) return;
    setState({ summary: s, today: t, trend: tr });
  }, [win, trendWin]);

  useEffect(() => {
    if (forced === 'loading' || forced === 'empty' || forced === 'error') return;
    void loadAll();
  }, [loadAll, forced]);

  // 自动重试：任一路失败时静默周期重读；成功即停表。
  const anyError =
    state.summary.k === 'error' || state.today.k === 'error' || state.trend.k === 'error';
  useEffect(() => {
    if (!anyError || forced) return;
    const timer = window.setInterval(() => void loadAll(), RETRY_MS);
    return () => window.clearInterval(timer);
  }, [anyError, loadAll, forced]);

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
        }}
        todayDate={win.date}
        onRetry={() => void loadAll()}
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
        }}
        todayDate={win.date}
        onRetry={() => void loadAll()}
        demo
      />
    );
  }
  return <OverviewView state={state} todayDate={win.date} onRetry={() => void loadAll()} />;
}

export default OverviewModulePage;
