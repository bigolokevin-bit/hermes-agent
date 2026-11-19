/**
 * T25 · 证据与引用 (`#/knowledge?tab=evidence`).
 *
 * Read-only list of citations produced by runs and audit rows. Each row either
 * jumps to its real source or says plainly why it cannot — a citation is never
 * rendered as a control that goes nowhere.
 *
 * reuse: /v1/run-events/citations
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Inbox, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react';
import { Badge, Button, Card, CardContent } from '@nous-research/ui';

import { fetchJSON } from '@/lib/api';
import { ApiError } from '@/lib/api-error';

import {
  EVIDENCE_FIXTURE,
  citationKindLabel,
  employeeLabel,
  readCitations,
  shortCode,
  unreachableReason,
  type CitationRow,
  type CitationsPayload,
} from './evidence';

type Phase = 'loading' | 'ready' | 'empty' | 'error' | 'denied';

const FORCED = new Set<Phase>(['loading', 'ready', 'empty', 'error', 'denied']);

function fmtStamp(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '—';
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms));
  return parts.replace('T', ' ');
}

function StateBlock({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <Card data-testid={testId}>
      <CardContent className="space-y-3 p-6">{children}</CardContent>
    </Card>
  );
}

function Cell({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5">
      <span className="text-xs" style={{ color: 'var(--fg-3)' }}>
        {label}
      </span>
      <span className="truncate text-sm" title={title}>
        {value}
      </span>
    </span>
  );
}

function CitationItem({ row }: { row: CitationRow }) {
  const reason = unreachableReason(row);
  const rawId = row.employeeId ?? '';
  return (
    <li className="min-w-0 px-3 py-3" data-testid={`evidence-row-${row.id}`}>
      <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className="rounded-full border px-2 py-0.5 text-[11px]"
              style={{ borderColor: 'var(--border)', color: 'var(--fg-2)' }}
            >
              {citationKindLabel(row.kind)}
            </span>
            {row.state === 'unverified' ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                style={{ borderColor: 'var(--border)', color: 'var(--fg-3)' }}
                data-gap="1"
                data-testid={`evidence-gap-${row.id}`}
                title="GAP：后端没有给出这条引用的核验状态，按「待核实」显示，不猜"
              >
                待核实
                <span className="rounded-sm px-1 text-[10px]" style={{ background: 'var(--surface-2)' }}>
                  GAP
                </span>
              </span>
            ) : null}
            <span className="text-sm font-medium break-words">{row.title}</span>
          </div>
          {row.snippet ? (
            <p className="max-w-[72ch] break-words text-sm" style={{ color: 'var(--fg-2)' }}>
              {row.snippet}
            </p>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <Cell
              label="员工"
              value={employeeLabel(row.employeeName, row.employeeId)}
              title={rawId || undefined}
            />
            {row.runId ? <Cell label="运行" value={shortCode(row.runId) || '—'} title={row.runId} /> : null}
            {row.auditId ? <Cell label="审计" value={shortCode(row.auditId) || '—'} title={row.auditId} /> : null}
            <Cell label="时间" value={fmtStamp(row.at)} />
          </div>
        </div>
        <div className="min-w-0 shrink-0 md:pl-4">
          {row.href ? (
            <Link
              className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
              to={row.href}
              data-testid={`evidence-open-${row.id}`}
            >
              打开原文
            </Link>
          ) : (
            <span
              className="inline-flex max-w-[36ch] flex-col gap-0.5 text-xs"
              style={{ color: 'var(--fg-3)' }}
              data-testid={`evidence-unreachable-${row.id}`}
            >
              <span className="font-medium">原文不可达</span>
              <span className="break-words">{reason}</span>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function EvidenceModulePage() {
  const [params, setParams] = useSearchParams();
  const forcedRaw = params.get('state');
  const forced = forcedRaw && FORCED.has(forcedRaw as Phase) ? (forcedRaw as Phase) : null;
  const forcedRid = params.get('rid');

  const [phase, setPhase] = useState<Phase>('loading');
  const [payload, setPayload] = useState<CitationsPayload | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  const load = useCallback(async () => {
    // reuse: /v1/run-events/citations
    const body = await fetchJSON<unknown>('/agent-api/api/run-events?kind=citation&limit=50');
    return readCitations(body);
  }, []);

  useEffect(() => {
    if (forced) {
      setPhase(forced === 'ready' ? 'ready' : forced);
      if (forcedRid) setRequestId(forcedRid);
      return;
    }
    let live = true;
    setPhase('loading');
    setRequestId(null);
    load()
      .then((next) => {
        if (!live) return;
        setPayload(next);
        setPhase(next.items.length === 0 ? 'empty' : 'ready');
      })
      .catch((error: unknown) => {
        if (!live) return;
        const apiError = error instanceof ApiError ? error : null;
        const status = apiError?.status ?? -1;
        setRequestId(apiError?.requestId ?? null);
        if (status === 403) {
          setPhase('denied');
          return;
        }
        // A missing route (404) or an unreachable BFF (0) still renders the
        // reviewed sample, clearly badged; it never pretends to be live data.
        if (status === 404 || status === 0) {
          setPayload(EVIDENCE_FIXTURE);
          setPhase('ready');
          return;
        }
        setPhase('error');
      });
    return () => {
      live = false;
    };
  }, [forced, forcedRid, load, token]);

  const retry = () => {
    const next = new URLSearchParams(params);
    next.delete('state');
    next.delete('rid');
    setParams(next, { replace: true });
    setToken((n) => n + 1);
  };

  const rows = useMemo(() => payload?.items ?? [], [payload]);
  const fixture = payload?.origin === 'fixture';
  const counts = useMemo(() => {
    let verified = 0;
    let unverified = 0;
    for (const row of rows) {
      if (row.state === 'verified') verified += 1;
      else unverified += 1;
    }
    return { verified, unverified };
  }, [rows]);

  return (
    <section className="space-y-4" data-testid="evidence-module" data-fixture={fixture ? '1' : undefined}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-mondwest text-xl">证据与引用</h1>
          <p className="text-sm" style={{ color: 'var(--fg-2)' }}>
            回答、运行与审计留下的引用都在这里；每一条要么点得回原文，要么说清为什么点不回去。
          </p>
        </div>
        <Button size="sm" outlined onClick={retry} data-testid="evidence-refresh">
          <RefreshCw className="mr-1 size-4" />
          重新读取
        </Button>
      </header>

      {fixture ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--warning)', background: 'var(--warning-soft)' }}
          data-testid="evidence-fixture-note"
        >
          <Badge tone="warning">示例数据</Badge>
          <span title="数据源缺口 GAP-1：等待 /api/run-events 与 /api/audit 接入">
            真实引用还没接上，下面展示的是格式样例，不是真实记录。接入后这里会自动换成真实引用。
          </span>
        </div>
      ) : null}

      {phase === 'ready' ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" data-testid="evidence-summary">
            <span>共 {rows.length} 条引用</span>
            <span style={{ color: 'var(--fg-2)' }}>已核验 {counts.verified}</span>
            <span style={{ color: 'var(--fg-2)' }}>待核实 {counts.unverified}</span>
            <span style={{ color: 'var(--fg-3)' }}>读取于 {fmtStamp(payload?.asOf ?? null)}</span>
          </div>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y" data-testid="evidence-list">
                {rows.map((row) => (
                  <CitationItem key={row.id} row={row} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : null}

      {phase === 'loading' ? (
        <StateBlock testId="evidence-loading">
          <div className="flex items-center gap-2 text-sm">
            <RefreshCw className="size-4 animate-spin" />
            正在读取引用…
          </div>
          <div className="h-3 w-2/3 rounded" style={{ background: 'var(--surface-2)' }} />
          <div className="h-3 w-1/2 rounded" style={{ background: 'var(--surface-2)' }} />
        </StateBlock>
      ) : null}

      {phase === 'empty' ? (
        <StateBlock testId="evidence-empty">
          <div className="flex items-center gap-2">
            <Inbox className="size-5" />
            <span className="font-medium">还没有引用</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--fg-2)' }}>
            运行或审计产生引用之后，这里才会出现记录。现在没有，是因为还没有人留下引用。
          </p>
          <Button size="sm" outlined onClick={retry} data-testid="evidence-empty-retry">
            再看看
          </Button>
        </StateBlock>
      ) : null}

      {phase === 'error' ? (
        <StateBlock testId="evidence-error">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-5" />
            <span className="font-medium">引用没能读出来</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--fg-2)' }}>
            这次读取没有成功，可能是服务一时忙。刚才的读取没有改动任何东西。
          </p>
          <p className="text-xs" style={{ color: 'var(--fg-3)' }}>
            {requestId ? `请求编号：${requestId}` : '本次请求未记录编号，可复制时间与操作路径反馈'}
          </p>
          <Button size="sm" onClick={retry} data-testid="evidence-error-retry">
            重试
          </Button>
        </StateBlock>
      ) : null}

      {phase === 'denied' ? (
        <StateBlock testId="evidence-denied">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5" />
            <span className="font-medium">你看不到这些引用</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--fg-2)' }}>
            可能是这页不存在，也可能是你的账号还没有查看证据的权限。
          </p>
          <p className="text-xs" style={{ color: 'var(--fg-3)' }}>
            {requestId ? `请求编号：${requestId}` : '本次请求未记录编号，可复制时间与操作路径反馈'}
          </p>
          <div className="flex gap-2">
            <Button size="sm" outlined onClick={retry} data-testid="evidence-denied-retry">
              刷新试试
            </Button>
            <Link
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--border)' }}
              to="/overview"
              data-testid="evidence-denied-back"
            >
              回总览
            </Link>
          </div>
        </StateBlock>
      ) : null}

      <p className="text-xs" style={{ color: 'var(--fg-3)' }}>
        引用只读：这里不改原文，也不补写来源；原文打不开时如实说明，不拿空白页顶替。
      </p>
    </section>
  );
}