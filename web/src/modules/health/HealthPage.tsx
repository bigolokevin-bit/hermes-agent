import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { currentFixtureState, fixtureView, type FixtureState } from "../../shell/fixtures";
import { PILOT_ROW, PROBE_DEFINITIONS, probeResult, summarize, type ProbeRow, type ProbeStatus } from "./health";
import "./health.css";

type State = { k: "loading" } | { k: "empty" } | { k: "error"; requestId: string } | { k: "ready"; rows: ProbeRow[] };

function fixtureState(value: FixtureState | null): State | null {
  if (value === "loading") return { k: "loading" };
  if (value === "empty") return { k: "empty" };
  if (value === "error") return { k: "error", requestId: "—（未收到响应，无请求号）" };
  return null;
}


function leavePreview(): void {
  if (typeof window === "undefined") return;
  const search = new URLSearchParams(window.location.search);
  search.delete("state");
  const hash = window.location.hash;
  const mark = hash.indexOf("?");
  let nextHash = hash;
  if (mark >= 0) {
    const params = new URLSearchParams(hash.slice(mark + 1));
    params.delete("state");
    const qs = params.toString();
    nextHash = hash.slice(0, mark) + (qs ? `?${qs}` : "");
  }
  window.history.replaceState({}, "", `${window.location.pathname}${search.toString() ? `?${search}` : ""}${nextHash}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function statusLabel(status: ProbeStatus): string {
  if (status === "healthy") return "正常";
  if (status === "error") return "异常";
  return "未知";
}

function statusTone(status: ProbeStatus): "success" | "destructive" | "warning" {
  if (status === "healthy") return "success";
  if (status === "error") return "destructive";
  return "warning";
}

function RowRequestId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(id).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };
  const short = id.length > 8 ? id.slice(0, 8) : id;
  return (
    <span className="hlt5-req" data-testid="hlt5-reqid">
      <span title={id} data-testid="hlt5-reqid-short">请求编号：{short}</span>
      <button
        type="button"
        aria-label="复制完整请求编号"
        className="hlt5-copy"
        onClick={copy}
      >
        {copied ? "已复制" : "复制"}
      </button>
    </span>
  );
}

function readRequestId(results: PromiseSettledResult<unknown>[]): string {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index];
    const reason = result?.status === "rejected" ? result.reason : null;
    if (reason instanceof ApiError && reason.requestId) return reason.requestId;
    if (reason && typeof reason === "object" && "requestId" in reason && typeof reason.requestId === "string" && reason.requestId) return reason.requestId;
  }
  return "—（未收到响应，无请求号）";
}

function Metric({ label, value, reason, testid }: { label: string; value: string; reason: string | null; testid: string }) {
  return (
    <div className="hlt5-metric">
      <dt>{label}</dt>
      <dd data-testid={testid} title={reason ?? undefined}>{value}</dd>
    </div>
  );
}

export function HealthPage() {
  const [state, setState] = useState<State>({ k: "loading" });
  const [attempt, setAttempt] = useState(0);
  const forced = currentFixtureState();
  const preview = fixtureView<State | null>(forced ?? "ready", {
    loading: () => ({ k: "loading" }), empty: () => ({ k: "empty" }),
    error: () => ({ k: "error", requestId: "—（未收到响应，无请求号）" }), ready: () => null,
  });

  useEffect(() => {
    let alive = true;
    const forcedState = fixtureState(forced);
    if (forcedState) return () => { alive = false; };
    const run = async () => {
      const settled = await Promise.allSettled(PROBE_DEFINITIONS.map((probe) => fetchJSON<unknown>(probe.path)));
      if (!alive) return;
      const returnedAt = Date.now();
      const rows = PROBE_DEFINITIONS.map((probe, index) => probeResult(probe.id, settled[index] as PromiseSettledResult<unknown>, returnedAt));
      if (settled.every((result) => result.status === "rejected" && result.reason instanceof ApiError && result.reason.status === 0)) setState({ k: "error", requestId: readRequestId(settled) });
      else setState({ k: "ready", rows: [...rows, PILOT_ROW] });
    };
    void run();
    return () => { alive = false; };
  }, [forced, attempt]);

  const view = preview ?? state;
  const retry = () => {
    if (forced) leavePreview();
    setAttempt((value) => value + 1);
  };
  const counts = view.k === "ready" ? summarize(view.rows) : { healthy: 0, error: 0, unknown: 0 };

  return (
    <section className="hlt5-page" data-testid="hlt5-page" data-fixture={forced ? "1" : undefined}>
      <header className="hlt5-head">
        <div className="min-w-0">
          <h1 className="font-mondwest text-xl">系统健康</h1>
          <p className="mt-1 text-sm text-white/55">实例活着吗</p>
          <p className="hlt5-counts" data-testid="hlt5-counts">
            <span>正常 {counts.healthy}</span><span>异常 {counts.error}</span><span>未知 {counts.unknown}</span>
          </p>
        </div>
        <Button size="sm" outlined onClick={retry} disabled={view.k === "loading"} data-testid="hlt5-refresh">
          <RefreshCw className="mr-1 size-3.5" aria-hidden="true" />刷新
        </Button>
      </header>

      <div className="hlt5-owner">
        <span>运维负责人</span><span>处理异常探针</span>
      </div>

      {view.k === "loading" ? (
        <Card><CardContent className="space-y-3 p-4" data-testid="hlt5-loading" aria-busy="true">
          <p className="text-sm text-white/55">正在检查服务…</p>
          {[1, 2, 3, 4].map((row) => <div key={row} className="hlt5-skeleton" />)}
        </CardContent></Card>
      ) : view.k === "empty" ? (
        <Card><CardContent className="py-10 text-center" data-testid="hlt5-empty">
          <p className="text-sm text-white/80">探针未接入</p><p className="mt-2 text-xs text-white/50">请看接入说明。</p>
        </CardContent></Card>
      ) : view.k === "error" ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-10 text-center" data-testid="hlt5-error" role="alert">
          <p className="text-sm text-white/80">所有探针均未收到响应</p>
          {view.requestId.startsWith("—") ? (
            <p className="text-xs text-white/40">请求编号：未提供（这次没有收到可记录的请求编号）</p>
          ) : (
            <RowRequestId id={view.requestId} />
          )}
          <Button size="sm" outlined onClick={retry} data-testid="hlt5-retry">重试</Button>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0" data-testid="hlt5-list">
          {view.rows.map((row) => (
            <article key={row.id} title={row.detail ?? undefined} className="hlt5-row" data-testid={`hlt5-row-${row.id}`}>
              <div className="hlt5-main">
                <div className="hlt5-title">
                  <p>{row.name}</p>
                  <Badge tone={statusTone(row.status)} data-testid={`hlt5-status-${row.id}`}>{statusLabel(row.status)}</Badge>
                </div>
                {row.reason ? <p className="hlt5-reason">{row.reason}</p> : null}
                {row.requestId ? <div data-testid={`hlt5-reqid-${row.id}`}><RowRequestId id={row.requestId} /></div> : null}
              </div>
              <dl className="hlt5-meta">
                <Metric label="上次成功" value={row.lastSuccessAt ?? "—"} reason={row.lastSuccessReason} testid={`hlt5-last-success-${row.id}`} />
                <Metric label="上次失败" value={row.lastFailureAt ?? "—"} reason={row.lastFailureReason} testid={`hlt5-last-failure-${row.id}`} />
                <Metric label="连续成功" value={row.consecutiveSuccesses === null ? "—" : `${row.consecutiveSuccesses} 次`} reason={row.consecutiveReason} testid={`hlt5-streak-${row.id}`} />
                <Metric label="采集时间" value={row.asOf ?? "—"} reason={row.asOfReason} testid={`hlt5-asof-${row.id}`} />
              </dl>
            </article>
          ))}
          <p className="hlt5-foot" data-testid="hlt5-foot">字段缺失显示「—」，原因在悬停说明里；不用浏览器时间补齐，也不把未知当成功。</p>
        </CardContent></Card>
      )}
    </section>
  );
}