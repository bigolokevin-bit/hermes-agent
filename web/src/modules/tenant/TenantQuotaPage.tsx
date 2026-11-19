// Module: tenant — 租户与配额（identity tenant 槽）
//
// The tenant profile and quota limits have no BFF route yet. This page says so
// (GAP-TEN-01) and shows only live usage from employee-stats and run-stats.
// A missing limit or usage is —, never 0; the two usage rows carry their own
// source and read time. No App/shell/manifest files are touched.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Copy, RefreshCw } from 'lucide-react';

import { Button } from '@nous-research/ui/ui/components/button';
import { Card, CardContent } from '@nous-research/ui/ui/components/card';

import { copyTextToClipboard } from '@/lib/clipboard';
import { fetchJsonStrict } from '@/modules/models/fetchJson';

import {
  TENANT_GAP,
  formatBeijing,
  messageFor,
  readEmployeeUsage,
  readForced,
  readRunUsage,
  requestIdOf,
  runWindow,
  shortTenantId,
  type RowState,
  type UsageRead,
} from './tenant';
import './tenant.css';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; employee: RowState; runs: RowState }
  | { kind: 'empty' }
  | { kind: 'error'; message: string; requestId: string | null };

function RequestId({ id, testid = 'ten4-request-id' }: { id: string | null; testid?: string }): ReactNode {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  if (!id) {
    return (
      <p className="text-xs text-muted-foreground" data-testid={testid}>
        本次请求未记录编号，可复制时间与操作路径反馈。
      </p>
    );
  }
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground" data-testid={testid}>
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

function rowFrom(result: PromiseSettledResult<unknown>, reader: (payload: unknown) => UsageRead): RowState {
  if (result.status === 'rejected') {
    return { kind: 'error', message: messageFor(result.reason), requestId: requestIdOf(result.reason) };
  }
  return { kind: 'ready', usage: reader(result.value) };
}

function usageText(row: RowState): string {
  if (row.kind === 'loading') return '读取中';
  if (row.kind === 'error') return '—';
  return row.usage.value === null ? '—' : String(row.usage.value);
}

function UsageRow({
  id,
  label,
  hint,
  row,
  source,
  unit,
}: {
  id: string;
  label: string;
  hint: string;
  row: RowState;
  source: string;
  unit: string;
}): ReactNode {
  const usage = row.kind === 'ready' ? row.usage : null;
  const shown = usageText(row);
  return (
    <div className="ten4-quota-row" data-testid={`ten4-quota-${id}`}>
      <div className="ten4-quota-head">
        <span className="ten4-quota-name">{label}</span>
        <span className="ten4-limit" title={`配额上限接口尚未接入（${TENANT_GAP}）`}>
          配额上限 — · 来源：额度上限 · 待核实
        </span>
      </div>
      <p className="ten4-quota-hint">{hint}</p>
      <div className="ten4-quota-value">
        <span className="ten4-quota-label">当前用量</span>
        <strong>
          {shown}
          {shown === '—' ? '' : ` ${unit}`}
        </strong>
      </div>
      <p className="ten4-quota-source" data-testid={`ten4-source-${id}`}>
        来源：{source}
        {usage ? ` · 数据截至 ${usage.asOf ?? '时间未知'}` : ''}
      </p>
      {usage?.asOfReason ? (
        <p className="ten4-quota-error" data-testid={`ten4-asof-${id}`}>{usage.asOfReason}</p>
      ) : null}
      {row.kind === 'error' ? (
        <>
          <p className="ten4-quota-error">{row.message}</p>
          <RequestId id={row.requestId} testid={`ten4-request-id-${id}`} />
        </>
      ) : null}
      {usage?.reason ? <p className="ten4-quota-error">{usage.reason}</p> : null}
      <p className="ten4-quota-note">额度上限未接入，无法判断是否已用尽；不显示 0 额度。</p>
    </div>
  );
}

function TenantProfile(): ReactNode {
  return (
    <Card className="ten4-card" data-testid="ten4-profile">
      <CardContent className="ten4-card-body">
        <div className="ten4-card-head">
          <h2>租户基本信息</h2>
          <span className="ten4-gap-pill" title={`租户资料接口未接入（${TENANT_GAP}）`}>待核实</span>
        </div>
        <p className="ten4-quota-source" data-testid="ten4-profile-source">
          来源：租户资料 · 未接入 · 数据截至 时间未知
        </p>
        <dl className="ten4-kv">
          <div>
            <dt>租户名称</dt>
            <dd>—<span className="ten4-why">租户资料接口未接入，不显示占位名称</span></dd>
          </div>
          <div>
            <dt>租户 ID 短码</dt>
            <dd title="接口接入后只显示 8 位短码">{shortTenantId(null)}<span className="ten4-why">接口未接入，不显示占位编号</span></dd>
          </div>
          <div>
            <dt>创建时间</dt>
            <dd>—<span className="ten4-why">接口未接入，时间未知</span></dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function QuotaCard({ employee, runs }: { employee: RowState; runs: RowState }): ReactNode {
  const window = runWindow();
  const range = `${formatBeijing(window.from)} — ${formatBeijing(window.to)}`;
  return (
    <Card className="ten4-card" data-testid="ten4-quotas">
      <CardContent className="ten4-card-body">
        <div className="ten4-card-head">
          <h2>配额与当前用量</h2>
          <span className="ten4-readonly">只读</span>
        </div>
        <UsageRow
          id="employees"
          label="员工数"
          hint="按员工生命周期统计的全部员工"
          row={employee}
          source="员工统计"
          unit="人"
        />
        <UsageRow
          id="runs"
          label="运行数（近 7 天）"
          hint={`统计窗口：${range}`}
          row={runs}
          source="运行统计"
          unit="次"
        />
        <div className="ten4-quota-row" data-testid="ten4-quota-storage">
          <div className="ten4-quota-head">
            <span className="ten4-quota-name">存储与 token</span>
            <span className="ten4-limit" title={`配额上限接口尚未接入（${TENANT_GAP}）`}>
              配额上限 — · 来源：额度上限 · 待核实
            </span>
          </div>
          <p className="ten4-quota-hint">存储容量与模型 token 用量</p>
          <div className="ten4-quota-value">
            <span className="ten4-quota-label">当前用量</span>
            <strong>—</strong>
          </div>
          <p className="ten4-quota-source" data-testid="ten4-source-storage">
            来源：存储与 token 用量 · 未接入 · 数据截至 时间未知
          </p>
          <p className="ten4-quota-error">存储与 token 用量接口未接入，不显示 0。</p>
        </div>
        <p className="ten4-exhausted" data-testid="ten4-exhausted">
          额度上限未接入，无法判断是否已用尽。上限接入后，达到上限的运行会被拒绝，请以本页的「当前用量」和额度来源为准。
        </p>
      </CardContent>
    </Card>
  );
}

export function TenantQuotaPage() {
  const [params] = useSearchParams();
  const forced = readForced(params);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async (signal: { live: boolean }) => {
    setState({ kind: 'loading' });
    const window = runWindow();
    const [employee, runs] = await Promise.allSettled([
      fetchJsonStrict('/agent-api/api/employee-stats'),
      fetchJsonStrict(
        `/agent-api/api/run-stats?from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}&bucket=day`,
      ),
    ]);
    if (!signal.live) return;
    const employeeRow = rowFrom(employee, readEmployeeUsage);
    const runsRow = rowFrom(runs, readRunUsage);
    if (employeeRow.kind === 'error' && runsRow.kind === 'error') {
      setState({
        kind: 'error',
        message: employeeRow.message,
        requestId: employeeRow.requestId ?? runsRow.requestId,
      });
      return;
    }
    if (
      employeeRow.kind === 'ready' &&
      runsRow.kind === 'ready' &&
      employeeRow.usage.value === null &&
      runsRow.usage.value === null
    ) {
      setState({ kind: 'empty' });
      return;
    }
    setState({ kind: 'ready', employee: employeeRow, runs: runsRow });
  }, []);

  useEffect(() => {
    if (forced) return;
    const signal = { live: true };
    void load(signal);
    return () => {
      signal.live = false;
    };
  }, [attempt, forced, load]);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  if (forced === 'loading') {
    return (
      <div className="ten4-page" data-testid="ten4-page" data-fixture="1">
        <header className="ten4-head">
          <div>
            <h1>租户与配额</h1>
            <p>租户资料、额度上限与当前用量</p>
          </div>
        </header>
        <p className="ten4-preview" data-testid="ten4-preview-note">预览状态 · 仅用于检查加载样式，未读取接口。</p>
        <div className="ten4-skeleton" data-testid="ten4-loading">
          <div /><div /><div />
        </div>
      </div>
    );
  }

  if (forced === 'error') {
    return (
      <div className="ten4-page" data-testid="ten4-page" data-fixture="1">
        <header className="ten4-head">
          <div>
            <h1>租户与配额</h1>
            <p>租户资料、额度上限与当前用量</p>
          </div>
        </header>
        <p className="ten4-preview" data-testid="ten4-preview-note">预览状态 · 仅用于检查错误样式，未读取接口。</p>
        <Card className="ten4-card ten4-error" data-testid="ten4-error">
          <CardContent className="ten4-card-body">
            <h2>这次没能读取租户用量</h2>
            <p>控制台暂时没有回应，请稍后重试。</p>
            <RequestId id={null} />
            <Button onClick={refresh}>重试</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (forced === 'empty') {
    return (
      <div className="ten4-page" data-testid="ten4-page" data-fixture="1">
        <header className="ten4-head">
          <div>
            <h1>租户与配额</h1>
            <p>租户资料、额度上限与当前用量</p>
          </div>
        </header>
        <p className="ten4-preview" data-testid="ten4-preview-note">预览状态 · 仅用于检查空态样式，未读取接口。</p>
        <TenantProfile />
        <Card className="ten4-card" data-testid="ten4-empty">
          <CardContent className="ten4-card-body">
            <h2>这个账号当前还没有可展示的用量</h2>
            <p>员工统计与运行统计都没有给出可用的当前用量；额度上限仍未接入，不用 0 代替缺失的额度。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="ten4-page" data-testid="ten4-page">
      <header className="ten4-head">
        <div>
          <h1>租户与配额</h1>
          <p>租户资料、额度上限与当前用量</p>
        </div>
        <div className="ten4-head-actions">
          <span className="ten4-readonly">只读</span>
          <Button
            onClick={refresh}
            disabled={state.kind === 'loading'}
            aria-busy={state.kind === 'loading'}
            data-testid="ten4-refresh"
          >
            <RefreshCw className={state.kind === 'loading' ? 'ten4-spin' : undefined} aria-hidden="true" />
            刷新
          </Button>
        </div>
      </header>

      <p className="ten4-gap" data-testid="ten4-gap" title={`租户资料与配额上限接口尚未接入（${TENANT_GAP}）`}>
        租户资料与配额上限还没有接入，状态待核实。下面只展示可以读到的「当前用量」，缺失的额度一律显示「—」并说明原因，不补 0。
      </p>

      {state.kind === 'loading' ? (
        <div className="ten4-skeleton" data-testid="ten4-loading">
          <div /><div /><div />
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <Card className="ten4-card ten4-error" data-testid="ten4-error">
          <CardContent className="ten4-card-body">
            <h2>这次没能读取租户用量</h2>
            <p>{state.message}</p>
            <RequestId id={state.requestId} />
            <Button onClick={refresh}>重试</Button>
          </CardContent>
        </Card>
      ) : null}

      {state.kind === 'empty' ? (
        <>
          <TenantProfile />
          <Card className="ten4-card" data-testid="ten4-empty">
            <CardContent className="ten4-card-body">
              <h2>这个账号当前还没有可展示的用量</h2>
              <p>员工统计与运行统计都没有给出可用的当前用量；额度上限仍未接入，不用 0 代替缺失的额度。</p>
            </CardContent>
          </Card>
        </>
      ) : null}

      {state.kind === 'ready' ? (
        <>
          <TenantProfile />
          <QuotaCard employee={state.employee} runs={state.runs} />
        </>
      ) : null}

      <p className="ten4-foot">
        额度上限与租户资料接入后会在本页直接显示；需要开通请
        <a href="/approvals">前往审批中心提交申请</a>。
      </p>
    </div>
  );
}

export default TenantQuotaPage;