import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AlertTriangle, ArrowRight, Gauge, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { Badge } from '@nous-research/ui/ui/components/badge';
import { Button } from '@nous-research/ui/ui/components/button';
import { Card, CardContent } from '@nous-research/ui/ui/components/card';

import { fetchMatrix, load } from '../duty/api';
import { beijing, dashed, employeeLabel, shortId, usd } from '../duty/format';
import { useDutyData, type DutyData } from '../duty/useDutyData';
import type { Loadable, MatrixBody, RunStatsBody } from '../duty/types';
import { buildKpis, blockerRows, trendPoints, OVERVIEW_GAP } from './overview';
import './overview.css';

type Forced = 'loading' | 'empty' | 'error';

function readAtNow(): string {
  return beijing(new Date().toISOString());
}

function RequestId({ id }: { id: string | null }) {
  const [copied, setCopied] = useState(false);
  const text = id ?? '未提供';
  const copy = async () => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeText();
    } catch {
      setCopied(false);
    }
  };
  const setTimeText = () => window.setTimeout(() => setCopied(false), 1800);
  return (
    <span className="ov5-req">
      请求编号 {text}
      {id ? (
        <button type="button" onClick={copy} data-testid="ov5-copy-req">
          {copied ? '已复制' : '复制'}
        </button>
      ) : null}
    </span>
  );
}

function Source({ children }: { children: ReactNode }) {
  return <span className="ov5-source">{children}</span>;
}

type KpiIssue = { label: string; state: Loadable<unknown>; gap?: string };

function KpiCard({
  title,
  value,
  foot,
  source,
  readAt,
  testid,
  note,
  noteTitle,
  issues,
  onRetry,
  children,
}: {
  title: string;
  value: ReactNode;
  foot?: ReactNode;
  source: string;
  readAt: string;
  testid: string;
  note?: ReactNode;
  noteTitle?: string;
  issues?: KpiIssue[];
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <Card className="ov5-kpi" data-testid={testid}>
      <CardContent className="ov5-kpi-bd">
        <div className="ov5-kpi-hd">
          <span>{title}</span>
          <Source>{source}</Source>
        </div>
        <div className="ov5-kpi-value">{value}</div>
        {foot ? <div className="ov5-kpi-foot">{foot}</div> : null}
        {children}
        {issues?.map((issue) =>
          issue.state.k === 'error' ? (
            <div className="ov5-kpi-issue" title={issue.gap} key={issue.label}>
              <span>
                {issue.label}未接入：{issue.state.message}
              </span>
              <RequestId id={issue.state.requestId} />
              {onRetry ? (
                <Button size="sm" outlined onClick={onRetry} data-testid={`${testid}-issue-retry`}>
                  重试
                </Button>
              ) : null}
            </div>
          ) : null,
        )}
        <div className="ov5-asof">读取于 {readAt}</div>
        {note ? <div className="ov5-note" title={noteTitle}>{note}</div> : null}
      </CardContent>
    </Card>
  );
}

function Trend({ stats, readAt, onRetry }: { stats: Loadable<RunStatsBody>; readAt: string; onRetry: () => void }) {
  const points = stats.k === 'ready' ? trendPoints(stats.data) : [];
  const max = Math.max(1, ...points.map((p) => p.runs ?? 0));
  return (
    <Card className="ov5-block" data-testid="ov5-trend">
      <CardContent className="ov5-block-bd">
        <div className="ov5-block-hd">
          <h2>近 14 天运行趋势</h2>
          <Source>运行统计 · 读取于 {readAt}</Source>
        </div>
        {stats.k === 'loading' ? (
          <div className="ov5-skeleton" aria-busy="true" aria-label="趋势加载中"><span /><span /><span /></div>
        ) : stats.k === 'error' ? (
          <div className="ov5-inline-error" role="alert">
            <span>趋势数据没有读出来。</span>
            <RequestId id={stats.requestId} />
            <Button size="sm" outlined onClick={onRetry} data-testid="ov5-trend-retry">重试</Button>
          </div>
        ) : points.length === 0 ? (
          <div className="ov5-empty-line">
            <span>这 14 天还没有运行记录，所以没有趋势可画。</span>
            <Link to="/runs">去看运行记录<ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        ) : (
          <>
            <div className="ov5-bars" role="img" aria-label="近 14 天运行趋势">
              {points.map((point) => (
                <div
                  className={point.runs === null ? 'ov5-bar is-missing' : 'ov5-bar'}
                  key={point.label}
                  title={
                    point.runs === null
                      ? `${point.label} · 当日运行数未返回，显示 —`
                      : `${point.label} · ${point.runs} 次运行 · 失败 ${point.failed ?? '—'}`
                  }
                >
                  <span className="ov5-bar-track">
                    {point.runs === null ? null : (
                      <i style={{ height: `${Math.max(4, Math.round((point.runs / max) * 100))}%` }} />
                    )}
                  </span>
                  <em>{point.label}</em>
                </div>
              ))}
            </div>
            <p className="ov5-block-foot">柱高表示当日运行次数；失败次数在悬停说明里，不与单价相乘。</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivity({ data, onRetry }: { data: DutyData; onRetry: () => void }) {
  const runs = data.recentRuns;
  return (
    <Card className="ov5-block" data-testid="ov5-activity">
      <CardContent className="ov5-block-bd">
        <div className="ov5-block-hd">
          <h2>最近活动</h2>
          <Link to="/runs">全部运行<ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        {runs.k === 'loading' ? (
          <div className="ov5-skeleton" aria-busy="true" aria-label="最近活动加载中"><span /><span /><span /></div>
        ) : runs.k === 'error' ? (
          <div className="ov5-inline-error" role="alert">
            <span>最近活动没有读出来。</span>
            <RequestId id={runs.requestId} />
            <Button size="sm" outlined onClick={onRetry} data-testid="ov5-activity-retry">重试</Button>
          </div>
        ) : runs.data.length === 0 ? (
          <div className="ov5-empty-line">
            <span>近 7 天没有运行记录。</span>
            <Link to="/employees">去看数字员工<ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        ) : (
          <ul className="ov5-rows">
            {runs.data.slice(0, 3).map((run) => (
              <li key={run.runId} data-testid="ov5-activity-row">
                <Link to={`/runs/${encodeURIComponent(run.runId)}`} title={run.runId}>
                  {run.employeeId ? employeeLabel(undefined, run.employeeId) : `运行 ${shortId(run.runId)}`}
                </Link>
                <Badge tone={run.status === 'failed' ? 'destructive' : run.status === 'completed' ? 'success' : 'outline'}>
                  {run.status === 'failed' ? '失败' : run.status === 'completed' ? '成功' : run.status === 'running' ? '运行中' : run.status ?? '—'}
                </Badge>
                <span>{beijing(run.startedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Blockers({ data, onRetry }: { data: DutyData; onRetry: () => void }) {
  const failed = data.failedRuns.k === 'ready' ? data.failedRuns.data : null;
  const tasks = data.blockedTasks.k === 'ready' ? data.blockedTasks.data : null;
  const approvals = data.approvals.k === 'ready' ? data.approvals.data : null;
  const rows = data.recentRuns.k === 'loading' ? [] : blockerRows({ failedRuns: failed, blockedTasks: tasks, approvals });
  const unavailable = [data.failedRuns, data.blockedTasks, data.approvals].some((s) => s.k === 'error');
  return (
    <Card className="ov5-block" data-testid="ov5-blockers">
      <CardContent className="ov5-block-bd">
        <div className="ov5-block-hd">
          <h2>阻塞队列</h2>
          <Source>失败运行 / 阻塞任务 / 待审批</Source>
        </div>
        {unavailable ? (
          <div className="ov5-inline-error" role="alert">
            <span>有阻塞源未接入，下面是已读到的部分，不代表全部。</span>
            <Button size="sm" outlined onClick={onRetry} data-testid="ov5-blockers-retry">重试</Button>
          </div>
        ) : null}
        {rows.length === 0 ? (
          <div className="ov5-empty-line">
            <span>当前没有读到阻塞项。</span>
            <Link to="/approvals">去审批中心<ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        ) : (
          <ul className="ov5-rows ov5-rows-blocker">
            {rows.map((row) => (
              <li key={`${row.responsibleModule}-${row.object}`}>
                <Badge tone={row.overSLA ? 'destructive' : 'warning'}>{row.responsibleModule}</Badge>
                <span className="ov5-obj">{row.object}</span>
                <span>{row.waitingOn}</span>
                {row.href ? <Link to={row.href}>处理<ArrowRight className="h-3.5 w-3.5" /></Link> : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function OverviewView({
  data,
  matrix,
  readAt,
  loading,
  onRetry,
}: {
  data: DutyData;
  matrix: Loadable<MatrixBody>;
  readAt: string;
  loading: boolean;
  onRetry: () => void;
}) {
  const stats = data.stats.k === 'ready' ? data.stats.data : null;
  const today = data.todayStats.k === 'ready' ? data.todayStats.data : null;
  const budgetDay = data.budgetDay.k === 'ready' ? data.budgetDay.data : null;
  const budgetMonth = data.budgetMonth.k === 'ready' ? data.budgetMonth.data : null;
  const approvalStats = data.approvalStats.k === 'ready' ? data.approvalStats.data : null;
  const employees = data.employees.k === 'ready' ? data.employees.data.length : null;
  const kpis = buildKpis({
    stats,
    todayStats: today,
    approvalStats,
    budgetDay,
    budgetMonth,
    totalEmployeesFallback: employees,
    matrix,
  });
  const coreStates = [data.employees, data.stats, data.todayStats, data.approvalStats, data.budgetDay];
  const allError = coreStates.every((state) => state.k === 'error');
  const anyLoading = coreStates.some((state) => state.k === 'loading');
  const firstError = coreStates.find((state) => state.k === 'error');

  const allReady = coreStates.every((state) => state.k === 'ready');
  if (allReady && kpis.total === 0 && kpis.runs === 0 && kpis.pending === 0) {
    return (
      <section className="ov5-page" data-testid="ov5-page">
        <Card className="ov5-empty-card" data-testid="ov5-empty"><CardContent>
          <h1>还没有可汇总的数据</h1>
          <p>员工、运行与审批都为空时，总览没有数字可展示。</p>
          <Link to="/employees">先看数字员工<ArrowRight className="h-3.5 w-3.5" /></Link>
        </CardContent></Card>
      </section>
    );
  }

  if (allError) {
    return (
      <section className="ov5-page" data-testid="ov5-page">
        <Card className="ov5-error-card" data-testid="ov5-error" role="alert">
          <CardContent>
            <div className="ov5-inline-error">
              <AlertTriangle className="h-5 w-5" />
              <b>总览没能读出来</b>
            </div>
            <p>这次聚合的所有来源都没有返回数据，页面没有编造任何数字。</p>
            <RequestId id={firstError?.requestId ?? null} />
            <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />} data-testid="ov5-retry">重试</Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="ov5-page" data-testid="ov5-page">
      <header className="ov5-head">
        <div>
          <p className="ov5-eyebrow">运营 · 控制台</p>
          <h1>运营总览</h1>
          <p className="ov5-sub">员工、运行、审批与成本各读各的；缺失值显示「—」，不补零。</p>
        </div>
        <Button size="sm" outlined onClick={onRetry} disabled={loading || anyLoading} aria-busy={loading || anyLoading} data-testid="ov5-refresh" prefix={<RefreshCw className={`h-3.5 w-3.5 ${loading || anyLoading ? 'ov5-spin' : ''}`} />}>
          刷新
        </Button>
      </header>

      {anyLoading ? <div className="ov5-skeleton" aria-busy="true" aria-label="总览加载中" data-testid="ov5-loading"><span /><span /><span /></div> : null}

      <div className="ov5-kpis">
        <KpiCard title="员工" value={dashed(kpis.total)} foot={<>在岗 <b>{dashed(kpis.active)}</b> · 有风险 <b>{dashed(kpis.atRisk)}</b></>} source="员工统计 / 风险矩阵" readAt={readAt} testid="ov5-kpi-employees" issues={[{ label: '员工统计', state: data.employees }, ...(matrix.k === 'error' ? [{ label: '风险矩阵', state: matrix, gap: OVERVIEW_GAP.risk }] : [])]} onRetry={onRetry} note={kpis.atRisk === null ? '风险口径未接入' : null} noteTitle={kpis.atRisk === null ? OVERVIEW_GAP.risk : undefined}>
          <Users className="ov5-watermark" aria-hidden />
        </KpiCard>
        <KpiCard title="今日运行" value={dashed(kpis.runs)} foot={<>失败 <b>{dashed(kpis.failed)}</b> · 失败率 <b>{kpis.failureRate === null ? '—' : `${kpis.failureRate}%`}</b></>} source="运行统计（今日）" readAt={readAt} testid="ov5-kpi-runs" issues={[{ label: '运行统计', state: data.todayStats, gap: OVERVIEW_GAP.runs }]} onRetry={onRetry} note={kpis.runs === 0 && kpis.failureRate === null ? '今天还没有运行，失败率不计算' : null} noteTitle={kpis.runs === 0 && kpis.failureRate === null ? OVERVIEW_GAP.runs : undefined}>
          <Gauge className="ov5-watermark" aria-hidden />
        </KpiCard>
        <KpiCard title="待审批" value={dashed(kpis.pending)} foot={<Link to="/approvals">去审批中心<ArrowRight className="h-3.5 w-3.5" /></Link>} source="审批统计" readAt={readAt} testid="ov5-kpi-pending" issues={[{ label: '审批统计', state: data.approvalStats, gap: OVERVIEW_GAP.approvals }]} onRetry={onRetry}>
          <ShieldAlert className="ov5-watermark" aria-hidden />
        </KpiCard>
        <KpiCard title="今日成本" value={kpis.costUsd === null ? '—' : usd(kpis.costUsd)} foot={kpis.costPartial ? <>账本未覆盖全部员工{kpis.costMissing > 0 ? `（${kpis.costMissing} 人缺账本）` : ''}</> : <>美元 · 账本实扣</>} source="成本账本（日）" readAt={readAt} testid="ov5-kpi-cost" issues={[{ label: '成本账本', state: data.budgetDay, gap: OVERVIEW_GAP.cost }]} onRetry={onRetry} note={kpis.costUsd === null ? '成本口径未齐' : null} noteTitle={kpis.costUsd === null ? OVERVIEW_GAP.cost : undefined} />
      </div>

      <div className="ov5-grid">
        <Trend stats={data.stats14} readAt={readAt} onRetry={onRetry} />
        <RecentActivity data={data} onRetry={onRetry} />
        <Blockers data={data} onRetry={onRetry} />
      </div>
    </section>
  );
}

function LiveOverview() {
  const { data, reload, loading } = useDutyData();
  const [matrix, setMatrix] = useState<Loadable<MatrixBody>>({ k: 'loading' });
  const [readAt, setReadAt] = useState(readAtNow);

  const loadMatrix = useCallback(() => {
    setMatrix({ k: 'loading' });
    void load(fetchMatrix).then(setMatrix);
  }, []);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  const retry = useCallback(() => {
    setReadAt(readAtNow());
    loadMatrix();
    reload();
  }, [loadMatrix, reload]);

  return <OverviewView data={data} matrix={matrix} readAt={readAt} loading={loading} onRetry={retry} />;
}

export function OverviewPage() {
  const [params, setParams] = useSearchParams();
  const forcedRaw = (params.get('state') ?? '').toLowerCase();
  const forced: Forced | null =
    forcedRaw === 'loading' || forcedRaw === 'empty' || forcedRaw === 'error'
      ? (forcedRaw as Forced)
      : null;

  const clearForced = () => {
    const next = new URLSearchParams(params);
    next.delete('state');
    setParams(next, { replace: true });
  };

  if (forced === 'loading') {
    return (
      <section className="ov5-page" data-testid="ov5-page" data-fixture="1">
        <div className="ov5-skeleton" aria-busy="true" aria-label="总览加载中" data-testid="ov5-loading"><span /><span /><span /></div>
      </section>
    );
  }
  if (forced === 'empty') {
    return (
      <section className="ov5-page" data-testid="ov5-page" data-fixture="1">
        <Card className="ov5-empty-card" data-testid="ov5-empty"><CardContent>
          <h1>还没有可汇总的数据</h1>
          <p>员工、运行与审批都为空时，总览没有数字可展示。</p>
          <Link to="/employees">先看数字员工<ArrowRight className="h-3.5 w-3.5" /></Link>
        </CardContent></Card>
      </section>
    );
  }
  if (forced === 'error') {
    return (
      <section className="ov5-page" data-testid="ov5-page" data-fixture="1">
        <Card className="ov5-error-card" data-testid="ov5-error" role="alert"><CardContent>
          <div className="ov5-inline-error"><AlertTriangle className="h-5 w-5" /><b>总览没能读出来</b></div>
          <p>这次聚合的所有来源都没有返回数据，页面没有编造任何数字。</p>
          <RequestId id={null} />
          <Button size="sm" outlined onClick={clearForced} data-testid="ov5-retry">重试</Button>
        </CardContent></Card>
      </section>
    );
  }
  return <LiveOverview />;
}

export default OverviewPage;