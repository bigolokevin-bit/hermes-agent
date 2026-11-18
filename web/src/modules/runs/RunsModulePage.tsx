/**
 * Lane work · T15 runs list + read-only detail. Source: /api/runs,
 * /api/run-detail, /api/run-events. No retry/cancel write is exposed.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Activity, AlertTriangle, Inbox, RefreshCw, ShieldAlert, X } from "lucide-react";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { fetchJSON } from "@/lib/api";

import {
  beijing,
  duration,
  costBadgeLabel,
  costReason,
  costState,
  costText,
  errorInfo,
  eventLabel,
  loadRunDetail,
  loadRunEvents,
  loadRuns,
  reasonLabel,
  resultRef,
  shortId,
  taskLabel,
  statusLabel,
  statusTone,
  usd,
  type ListState,
  type RunDetail,
  type RunEvent,
  type RunRow,
} from "./runsPage";

const SINCE_OPTIONS = [
  { value: "24h", label: "近 24 小时", hours: 24 },
  { value: "7d", label: "近 7 天", hours: 24 * 7 },
  { value: "30d", label: "近 30 天", hours: 24 * 30 },
] as const;

type SinceKey = (typeof SINCE_OPTIONS)[number]["value"];

type DetailState =
  | { k: "idle" }
  | { k: "loading"; id: string }
  | { k: "ready"; id: string; run: RunDetail; events: RunEvent[]; eventsError: string | null }
  | { k: "error"; id: string; status: number; message: string; requestId: string | null };

type EmployeeMap = Map<string, string>;

function sinceIso(key: SinceKey): string {
  const hours = SINCE_OPTIONS.find((x) => x.value === key)?.hours ?? 24;
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

function rowLabel(row: RunRow, employees: EmployeeMap): string {
  const name = row.employeeId ? employees.get(row.employeeId) : undefined;
  if (name) return name;
  if (!row.employeeId) return "—";
  const tail = row.employeeId.replace(/^[^:]*:/, "").replace(/[^0-9A-Za-z]/g, "").slice(-4).toUpperCase();
  return tail ? `员工 · ${tail}` : "员工";
}

function Skeleton() {
  return (
    <Card data-testid="runs-loading" aria-busy="true">
      <CardContent className="space-y-3 p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </CardContent>
    </Card>
  );
}

function ErrorCard({
  state,
  onRetry,
  testid,
}: {
  state: { status: number; message: string; requestId: string | null };
  onRetry: () => void;
  testid: string;
}) {
  const denied = state.status === 403 || state.status === 404;
  return (
    <Card data-testid={testid}>
      <CardContent className="flex flex-col items-start gap-3 p-5">
        {denied ? <ShieldAlert className="h-5 w-5 text-amber-400" /> : <AlertTriangle className="h-5 w-5 text-rose-400" />}
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{denied ? "运行记录暂不可见" : "运行记录没能加载出来"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
          <p className="mt-2 break-all font-mono text-xs text-muted-foreground">请求编号 {state.requestId ?? "未提供"}</p>
        </div>
        {!denied ? (
          <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-4 w-4" />}>
            重试
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Detail({ state, onClose, onRetry }: { state: DetailState; onClose: () => void; onRetry: () => void }) {
  if (state.k === "idle") return null;
  return (
    <Card data-testid={`run-detail-${state.k}`}>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">
              {state.k === "ready" ? `运行 ${shortId(state.run.runId)}` : "运行详情"}
            </h2>
            {state.k === "ready" ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {statusLabel(state.run.status)} · 开始 {beijing(state.run.startedAt)} · 耗时 {duration(state.run.startedAt, state.run.endedAt)}
              </p>
            ) : null}
          </div>
          <Button size="sm" outlined onClick={onClose} prefix={<X className="h-3.5 w-3.5" />}>
            关闭
          </Button>
        </div>

        {state.k === "loading" ? (
          <div className="h-16 animate-pulse rounded bg-muted" aria-busy="true" />
        ) : state.k === "error" ? (
          <div className="space-y-2" role="alert">
            <p className="text-sm">{state.message}</p>
            <p className="break-all font-mono text-xs text-muted-foreground">请求编号 {state.requestId ?? "未提供"}</p>
            {state.status !== 403 && state.status !== 404 ? (
              <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>重试</Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div><span className="block text-[11px] uppercase tracking-wide text-muted-foreground">状态</span><Badge tone={statusTone(state.run.status)}>{statusLabel(state.run.status)}</Badge></div>
              <div>
                <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">成本</span>
                <span>{costText(state.run)}</span>{" "}
                <Badge tone={costState(state.run) === "known" ? "success" : costState(state.run) === "unknown" ? "warning" : "outline"}>{costBadgeLabel(state.run)}</Badge>
                <span className="mt-1 block text-[11px] text-muted-foreground">{costReason(state.run)}</span>
              </div>
              <div><span className="block text-[11px] uppercase tracking-wide text-muted-foreground">预算上限</span><span>{usd(state.run.budgetCapUsd)}</span></div>
              <div><span className="block text-[11px] uppercase tracking-wide text-muted-foreground">尝试</span><span>{state.run.attemptNo ?? "—"}</span></div>
              <div><span className="block text-[11px] uppercase tracking-wide text-muted-foreground">结束</span><span>{beijing(state.run.endedAt)}</span></div>
              <div><span className="block text-[11px] uppercase tracking-wide text-muted-foreground">失败原因</span><span>{reasonLabel(state.run.reasonCode)}</span></div>
              <div><span className="block text-[11px] uppercase tracking-wide text-muted-foreground">任务</span><span title={state.run.taskId}>{taskLabel(state.run.taskId)}</span></div>
              <div><span className="block text-[11px] uppercase tracking-wide text-muted-foreground">事件</span><span>{state.events.length} 条{state.eventsError ? "（部分读取失败）" : ""}</span></div>
              <div className="sm:col-span-2">
                <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">上游运行</span>
                {state.run.upstreamRunId ? (
                  <Link
                    className="text-sm underline decoration-dotted underline-offset-2"
                    to={`/runs?upstream=${encodeURIComponent(state.run.upstreamRunId)}`}
                    title={state.run.upstreamRunId}
                  >
                    上游运行 {shortId(state.run.upstreamRunId)}
                  </Link>
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>
            {state.eventsError ? <p className="text-xs text-muted-foreground">{state.eventsError}</p> : null}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">事件时间线</h3>
              {state.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">这条运行还没有读到事件。</p>
              ) : (
                <ol className="space-y-2" data-testid="run-events">
                  {state.events.map((ev) => (
                    <li key={ev.seq} className="flex min-w-0 flex-wrap items-baseline gap-2 border-b border-border pb-2 text-sm last:border-0">
                      <span className="font-mono text-xs text-muted-foreground">#{ev.seq}</span>
                      <span className="min-w-0 flex-1">
                        {eventLabel(ev.eventType)}
                        {ev.eventType === "tool_result" ? (
                          <span className="ml-2 text-xs text-muted-foreground" title={resultRef(ev) ?? undefined}>
                            结果引用：{resultRef(ev) ? shortId(resultRef(ev) as string) : "未记录"}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground">{beijing(ev.occurredAt)}</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button size="sm" outlined disabled data-testid="run-retry-planned" title="写入接口未开放">
                  重试（新建运行）
                </Button>
                <span className="text-xs text-muted-foreground">
                  重试会新建一次运行并生成新编号，不会复用本条 runId；写入接口尚未开放，本页不发送请求。
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function RunsModulePage() {
  const [sp, setSp] = useSearchParams();
  const runParam = sp.get("run");
  const upstream = sp.get("upstream");
  const [since, setSince] = useState<SinceKey>("7d");
  const [status, setStatus] = useState("");
  const [list, setList] = useState<ListState>({ phase: "loading", rows: [], cursor: null, status: 0, message: "", requestId: null });
  const [tick, setTick] = useState(0);
  const [employees, setEmployees] = useState<EmployeeMap>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState>({ k: "idle" });

  useEffect(() => {
    if (runParam) setSelected(runParam);
  }, [runParam]);

  useEffect(() => {
    if (upstream) setSelected(null);
  }, [upstream]);

  const openRun = useCallback((id: string) => {
    setSelected(id);
    setSp({ run: id }, { replace: true });
  }, [setSp]);

  const closeRun = useCallback(() => {
    setSelected(null);
    setSp({}, { replace: true });
  }, [setSp]);

  useEffect(() => {
    let alive = true;
    fetchJSON<unknown>("/agent-api/api/employees?limit=100")
      .then((body) => {
        if (!alive) return;
        const map: EmployeeMap = new Map();
        const items = body && typeof body === "object" && Array.isArray((body as { items?: unknown[] }).items)
          ? (body as { items: unknown[] }).items
          : [];
        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const r = item as Record<string, unknown>;
          const id = typeof r.employeeId === "string" ? r.employeeId : typeof r.id === "string" ? r.id : "";
          const name = typeof r.name === "string" ? r.name : typeof r.displayName === "string" ? r.displayName : "";
          if (id && name) map.set(id, name);
        }
        setEmployees(map);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setList({ phase: "loading", rows: [], cursor: null, status: 0, message: "", requestId: null });
    void loadRuns({ status: status || undefined, since: sinceIso(since) }).then((next) => {
      if (alive) setList(next);
    });
    return () => { alive = false; };
  }, [status, since, tick]);

  useEffect(() => {
    if (!selected) {
      setDetail({ k: "idle" });
      return () => {};
    }
    let alive = true;
    setDetail({ k: "loading", id: selected });
    void Promise.allSettled([loadRunDetail(selected), loadRunEvents(selected)]).then(([runRes, evRes]) => {
      if (!alive) return;
      if (runRes.status === "rejected") {
        const info = errorInfo(runRes.reason);
        setDetail({ k: "error", id: selected, ...info });
        return;
      }
      const events = evRes.status === "fulfilled" ? evRes.value.items : [];
      setDetail({
        k: "ready",
        id: selected,
        run: runRes.value,
        events,
        eventsError: evRes.status === "rejected" ? errorInfo(evRes.reason).message : null,
      });
    });
    return () => { alive = false; };
  }, [selected, tick]);

  const counts = useMemo(() => {
    const failed = list.rows.filter((r) => r.status === "failed").length;
    const running = list.rows.filter((r) => r.status === "running").length;
    return { failed, running };
  }, [list.rows]);

  const retry = useCallback(() => setTick((n) => n + 1), []);

  return (
    <div className="min-w-0 space-y-4" data-testid="runs-page">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-mondwest text-2xl font-semibold"><Activity className="h-5 w-5" />运行</h1>
          <p className="mt-1 text-sm text-muted-foreground">按时间看运行；失败原因只在详情里给，不用颜色代替事实。</p>
        </div>
        <Button
          size="sm"
          outlined
          onClick={retry}
          disabled={list.phase === "loading"}
          prefix={<RefreshCw className={"h-4 w-4" + (list.phase === "loading" ? " animate-spin" : "")} />}
        >
          刷新
        </Button>
      </header>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm" data-testid="runs-summary">
        <span data-testid="status">本页 {list.rows.length} 次 · 失败 {counts.failed} · 运行中 {counts.running}</span>
        <span data-testid="next-action">下一步：点一行看失败原因</span>
        <span data-testid="owner">负责人：运行所属员工</span>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <label className="flex items-center gap-2 text-sm">
            状态
            <select className="h-8 rounded-md border border-border bg-transparent px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">全部状态</option>
              <option value="running">运行中</option>
              <option value="completed">成功</option>
              <option value="failed">失败</option>
              <option value="cancelled">已取消</option>
              <option value="interrupted">已中断</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            时间
            <select className="h-8 rounded-md border border-border bg-transparent px-2 text-sm" value={since} onChange={(e) => setSince(e.target.value as SinceKey)}>
              {SINCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <span className="text-xs text-muted-foreground">仅本页已加载，不是全量统计</span>
        </CardContent>
      </Card>

      {upstream ? (
        <Card data-testid="upstream-panel">
          <CardContent className="flex flex-col items-start gap-2 p-4">
            <h2 className="text-base font-semibold">上游运行</h2>
            <p className="break-all font-mono text-xs text-muted-foreground" data-testid="upstream-run-id">{upstream}</p>
            <p className="text-sm text-muted-foreground">
              这是 Hermes 运行时的上游编号。控制台没有上游详情页，编号可用于运行时排查；本页不会伪造上游数据。
            </p>
            <Link className="text-sm underline decoration-dotted underline-offset-2" to="/runs">返回运行列表</Link>
          </CardContent>
        </Card>
      ) : null}

      <Detail state={detail} onClose={closeRun} onRetry={retry} />

      {list.phase === "loading" ? <Skeleton /> : null}
      {list.phase === "empty" ? (
        <Card data-testid="runs-empty">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold">这个窗口没有运行</h2>
            <p className="text-sm text-muted-foreground">换一个时间范围，或等待新的运行产生。</p>
          </CardContent>
        </Card>
      ) : null}
      {list.phase === "error" || list.phase === "denied" ? (
        <ErrorCard state={list} onRetry={retry} testid={`runs-${list.phase}`} />
      ) : null}

      {list.phase === "ready" ? (
        <Card data-testid="runs-table">
          <CardContent className="p-0">
            <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.8fr)] gap-3 border-b border-border px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground sm:grid">
              <span>运行</span><span>员工</span><span>任务</span><span>开始</span><span>耗时</span><span>成本</span><span>状态</span>
            </div>
            <ul className="divide-y divide-border">
              {list.rows.map((row) => (
                <li key={row.runId}>
                  <button
                    type="button"
                    className="grid w-full min-w-0 grid-cols-1 gap-x-3 gap-y-1 px-4 py-3 text-left text-sm hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.8fr)]"
                    data-testid={`run-row-${row.runId}`}
                    onClick={() => openRun(row.runId)}
                  >
                    <span className="font-mono text-xs" title={row.runId}>{shortId(row.runId)}</span>
                    <span className="min-w-0 truncate">{rowLabel(row, employees)}</span>
                    <span className="min-w-0 truncate" title={row.taskId}>{taskLabel(row.taskId)}</span>
                    <span>{beijing(row.startedAt)}</span>
                    <span>{duration(row.startedAt, row.endedAt)}</span>
                    <span className="flex min-w-0 flex-col items-start gap-0.5" title={costReason(row)}>
                      <span>{costText(row)}</span>
                      <Badge tone={costState(row) === "known" ? "success" : costState(row) === "unknown" ? "warning" : "outline"}>{costBadgeLabel(row)}</Badge>
                      {costState(row) !== "known" ? (
                        <span className="text-[10px] leading-tight text-muted-foreground">{costReason(row)}</span>
                      ) : null}
                    </span>
                    <span><Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge></span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
              <span>只读列表 · 点一行看详情与事件</span>
              <span>{list.cursor ? "还有更多，本页只展示前 30 条" : "已到本页末尾"}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default RunsModulePage;
