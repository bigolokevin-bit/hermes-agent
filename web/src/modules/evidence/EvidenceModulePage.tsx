/**
 * T25 · 证据与引用 (`#/knowledge?tab=evidence` / `#/audit?tab=evidence`).
 *
 * Live surface: GET /agent-api/api/audit?from=&to=&limit=50 (bounded 7-day
 * window — the route refuses an unfiltered scan). Each row is one audit event:
 * 引用来源 (source system + actor), 目标对象 (resource type + masked id),
 * 时间 (Beijing, to the minute) and a real link back to /audit?detail=<eventId>.
 * A row whose event id is missing reads 「待核实」 and its link block says
 * 「原文不可达」 with the reason; no control is ever rendered that goes nowhere.
 *
 * Fixture debt burn (R30): the `?state=` repro leg and its sample rows were
 * removed. This pane only paints what the audit route answered; a missing or
 * unreadable route degrades to the honest four states, never to sample data.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Inbox, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react';
import { Badge, Button, Card, CardContent } from '@nous-research/ui';

import { fetchJSON } from '@/lib/api';
import { ApiError } from '@/lib/api-error';
import { hasEvidenceSession } from './useEvidenceSession';
import './evidence.css';

import {
  WINDOW_DAYS,
  citationsUrl,
  employeeNames,
  readCitations,
  type CitationRow,
  type CitationsPayload,
} from './evidence';

/** Directory names only: the ids stay masked, the names make 「姓名 · 短码」 possible. */
const EMPLOYEES_URL = '/agent-api/api/employees?limit=100';

type Phase = 'checking' | 'loading' | 'ready' | 'empty' | 'error' | 'denied' | 'login';

export function fmtStamp(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '—';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(ms))
    .replace('T', ' ');
}

function StateBlock({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <Card data-testid={testId}>
      <CardContent className="space-y-3 p-6">{children}</CardContent>
    </Card>
  );
}

function RequestIdLine({ requestId, testId }: { requestId: string | null; testId: string }) {
  const [copied, setCopied] = useState(false);
  if (!requestId) {
    return (
      <p className="text-xs ev5-subtle" data-testid={`${testId}-absent`}>
        本次请求未记录编号，可复制时间与操作路径反馈
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs ev5-subtle">
      <span data-testid={testId}>请求编号：{requestId}</span>
      <button
        type="button"
        className="rounded border px-1.5 py-0.5 ev5-bordered"
        data-testid={`${testId}-copy`}
        onClick={() => {
          const write = navigator.clipboard?.writeText?.(requestId);
          if (write && typeof write.then === 'function') {
            void write.then(() => setCopied(true)).catch(() => setCopied(false));
          }
        }}
      >
        {copied ? '已复制' : '复制'}
      </button>
    </p>
  );
}

function Cell({ label, value, title, testId }: { label: string; value: string; title?: string; testId: string }) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5" data-testid={testId} title={title}>
      <span className="text-xs ev5-subtle">
        {label}
      </span>
      <span className="truncate text-sm">{value}</span>
    </span>
  );
}

function CitationItem({ row }: { row: CitationRow }) {
  return (
    <li className="min-w-0 px-3 py-3" data-testid={`ev5-row-${row.id}`} data-unverified={row.unverified ? 'true' : undefined}>
      <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span data-testid={`ev5-source-${row.id}`}>
              <Badge tone="secondary">来源 · {row.sourceKind}</Badge>
            </span>
            <span className="text-xs ev5-subtle">
              {row.sourceLabel}
            </span>
            {row.unverified ? (
              <span
                className="rounded-full border px-2 py-0.5 text-[11px] ev5-bordered ev5-subtle"
                data-testid={`ev5-unverified-${row.id}`}
                title={`数据源缺口 GAP-1：这条记录缺少可核实的编号（事件编号或对象编号），如实显示「待核实」，不猜`}
              >
                待核实
              </span>
            ) : null}
            <span
              className="break-words text-sm font-medium"
              data-testid={`ev5-actor-${row.id}`}
              title={row.actorTitle ?? undefined}
            >
              {row.actorLabel}
            </span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <Cell
              label="目标对象"
              value={`${row.targetTypeLabel} · ${row.targetLabel}`}
              title={row.targetTitle ?? undefined}
              testId={`ev5-target-${row.id}`}
            />
            <Cell label="时间" value={fmtStamp(row.at)} title={row.at ?? undefined} testId={`ev5-at-${row.id}`} />
          </div>
        </div>
        <div className="min-w-0 shrink-0 md:pl-4">
          {row.href ? (
            <Link
              className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
              to={row.href}
              data-testid={`ev5-open-${row.id}`}
            >
              打开原文
            </Link>
          ) : (
            <span
              className="inline-flex max-w-[36ch] flex-col gap-0.5 text-xs ev5-subtle"
              data-testid={`ev5-unreachable-${row.id}`}
            >
              <span className="font-medium">原文不可达</span>
              <span className="break-words">{row.unreachableReason}</span>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function EvidenceModulePage() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [payload, setPayload] = useState<CitationsPayload | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  const load = useCallback(async () => {
    const body = await fetchJSON<unknown>(citationsUrl(new Date()));
    // Side read for display names: a failure never blocks the citations, it
    // only means the rows fall back to 「员工 · 短码」.
    const names = await fetchJSON<unknown>(EMPLOYEES_URL)
      .then((payload) => employeeNames(payload))
      .catch(() => new Map<string, string>());
    return readCitations(body, names);
  }, []);

  useEffect(() => {
    let live = true;
    setPhase('checking');
    setRequestId(null);
    // P0-1: decide the session exactly like the shell's identity widget does —
    // injected token counts, otherwise a 2xx /auth/whoami is the evidence.
    // Only after that may a data read be sent; never before.
    void hasEvidenceSession().then((hasSession) => {
      if (!live) return;
      if (!hasSession) {
        setPayload(null);
        setRequestId(null);
        setPhase('login');
        return;
      }
      setPhase('loading');
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
          setPayload(null);
          // 403 and 404 are one answer: the pane must not say which.
          if (status === 403 || status === 404) {
            setPhase('denied');
            return;
          }
          setPhase('error');
        });
    });
    return () => {
      live = false;
    };
  }, [load, token]);

  const retry = () => setToken((n) => n + 1);

  const rows = useMemo(() => payload?.items ?? [], [payload]);
  const counts = useMemo(() => {
    let unverified = 0;
    let unreachable = 0;
    for (const row of rows) {
      if (row.unverified) unverified += 1;
      if (!row.href) unreachable += 1;
    }
    return { unverified, unreachable };
  }, [rows]);

  return (
    <section className="min-w-0 space-y-4" data-testid="ev5-page">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-mondwest text-xl">证据与引用</h1>
          <p className="text-sm ev5-muted">
            每条记录都写明谁留下的、动了什么对象、什么时候；能点回原文的给链接，点不回去的说清原因。
          </p>
        </div>
        <Button size="sm" outlined onClick={retry} data-testid="ev5-refresh" aria-busy={phase === 'loading'}>
          <RefreshCw className={phase === 'loading' ? 'mr-1 size-4 animate-spin' : 'mr-1 size-4'} />
          重新读取
        </Button>
      </header>

      {phase === 'ready' ? (
        <>
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm" data-testid="ev5-summary">
            <span>共 {rows.length} 条记录（最近 {WINDOW_DAYS} 天）</span>
            <span className="ev5-muted">待核实 {counts.unverified}</span>
            <span className="ev5-muted">可回原文 {rows.length - counts.unreachable}</span>
            <span className="ev5-muted">原文不可达 {counts.unreachable}</span>
            <span className="ev5-subtle" title="服务没有在这份回答里给出读取时刻，本页不用浏览器时间顶替">
              读取于 {fmtStamp(payload?.asOf ?? null)}
            </span>
          </div>
          <Card>
            <CardContent className="min-w-0 p-0">
              <ul className="divide-y" data-testid="ev5-list">
                {rows.map((row) => (
                  <CitationItem key={row.id} row={row} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : null}

      {phase === 'checking' ? (
        <StateBlock testId="ev5-checking">
          <div className="flex items-center gap-2 text-sm">
            <RefreshCw className="size-4 animate-spin" />
            正在确认登录状态…
          </div>
          <p className="text-sm ev5-muted">
            确认结束前，这一页不会发出任何数据读取。
          </p>
        </StateBlock>
      ) : null}

      {phase === 'loading' ? (
        <StateBlock testId="ev5-loading">
          <div className="flex items-center gap-2 text-sm">
            <RefreshCw className="size-4 animate-spin" />
            正在读取引用…
          </div>
          <div className="h-3 w-2/3 rounded ev5-skeleton" />
          <div className="h-3 w-1/2 rounded ev5-skeleton" />
        </StateBlock>
      ) : null}

      {phase === 'empty' ? (
        <StateBlock testId="ev5-empty">
          <div className="flex items-center gap-2">
            <Inbox className="size-5" />
            <span className="font-medium">最近 {WINDOW_DAYS} 天没有留下记录</span>
          </div>
          <p className="text-sm ev5-muted">
            读取成功，只是这段时间里还没有可引用的审计记录。产生记录后这里会自动出现。
          </p>
          <Button size="sm" outlined onClick={retry} data-testid="ev5-empty-retry">
            再看看
          </Button>
        </StateBlock>
      ) : null}

      {phase === 'error' ? (
        <StateBlock testId="ev5-error">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-5" />
            <span className="font-medium">引用没能读出来</span>
          </div>
          <p className="text-sm ev5-muted">
            这次读取没有成功，可能是服务一时忙。刚才的读取没有改动任何东西。
          </p>
          <RequestIdLine requestId={requestId} testId="ev5-error-request-id" />
          <Button size="sm" onClick={retry} data-testid="ev5-error-retry">
            重试
          </Button>
        </StateBlock>
      ) : null}

      {phase === 'denied' ? (
        <StateBlock testId="ev5-denied">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5" />
            <span className="font-medium">你看不到这些引用</span>
          </div>
          <p className="text-sm ev5-muted">
            可能是这页不存在，也可能是你的账号还没有查看证据的权限。两种情况在这里显示一样，不透露有没有这条记录。
          </p>
          <RequestIdLine requestId={requestId} testId="ev5-denied-request-id" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" outlined onClick={retry} data-testid="ev5-denied-retry">
              刷新试试
            </Button>
            <Link
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm ev5-bordered"
              to="/overview"
              data-testid="ev5-denied-back"
            >
              回总览
            </Link>
          </div>
        </StateBlock>
      ) : null}

      {phase === 'login' ? (
        <StateBlock testId="ev5-login">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5" />
            <span className="font-medium">需要登录</span>
          </div>
          <p className="text-sm ev5-muted">
            当前浏览器没有控制台会话，引用读取没有发出；登录后再打开这一页。
          </p>
          <p className="text-xs ev5-subtle">
            本页没有发出数据读取，也没有改动任何数据。
          </p>
          <Button size="sm" outlined onClick={retry} data-testid="ev5-login-retry">
            重新检查登录状态
          </Button>
        </StateBlock>
      ) : null}

      <p className="text-xs ev5-subtle">
        引用只读：这里不改原文，也不补写来源；原文打不开时如实说明，不拿空白页顶替。
      </p>
    </section>
  );
}