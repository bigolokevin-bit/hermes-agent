import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { currentFixtureState, fixtureView, type FixtureState } from "../../shell/fixtures";
import { PILOT_ROW, PROBE_DEFINITIONS, probeResult, summarize, type ProbeRow, type ProbeStatus } from "./health";

type State = { k: "loading" } | { k: "empty" } | { k: "error"; requestId: string } | { k: "ready"; rows: ProbeRow[] };

function fixtureState(value: FixtureState | null): State | null {
  if (value === "loading") return { k: "loading" };
  if (value === "empty") return { k: "empty" };
  if (value === "error") return { k: "error", requestId: "—（未收到响应，无请求号）" };
  return null;
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

function readRequestId(results: PromiseSettledResult<unknown>[]): string {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index];
    const reason = result?.status === "rejected" ? result.reason : null;
    if (reason instanceof ApiError && reason.requestId) return reason.requestId;
    if (reason && typeof reason === "object" && "requestId" in reason && typeof reason.requestId === "string" && reason.requestId) return reason.requestId;
  }
  return "—（未收到响应，无请求号）";
}

export function HealthPage() {
  const [state, setState] = useState<State>({ k: "loading" });
  const [attempt, setAttempt] = useState(0);
  const forced = currentFixtureState();
  const preview = fixtureView<State | null>(forced ?? "ready", {
    loading: () => ({ k: "loading" }), empty: () => ({ k: "empty" }),
    error: () => ({ k: "error", requestId: "—（未收到响应，无请求号）" }), ready: () => null,
  });

  const runProbes = useCallback(async () => {
    if (fixtureState(forced)) return;
    setState({ k: "loading" });
    const settled = await Promise.allSettled(PROBE_DEFINITIONS.map((probe) => fetchJSON<unknown>(probe.path)));
    const returnedAt = Date.now();
    const rows = PROBE_DEFINITIONS.map((probe, index) => probeResult(probe.id, settled[index] as PromiseSettledResult<unknown>, returnedAt));
      if (settled.every((result) => result.status === "rejected" && result.reason instanceof ApiError && result.reason.status === 0)) {
      setState({ k: "error", requestId: readRequestId(settled) });
      return;
    }
    setState({ k: "ready", rows: [...rows, PILOT_ROW] });
  }, [forced]);

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
  const retry = () => setAttempt((value) => value + 1);
  const counts = view.k === "ready" ? summarize(view.rows) : { healthy: 0, error: 0, unknown: 0 };

  return (
    <section className="space-y-4" data-testid="hlt4-page" data-fixture={forced ?? undefined}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-mondwest text-xl">系统健康</h1>
          <p className="mt-1 text-sm text-white/55">实例活着吗</p>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/55" data-testid="hlt4-counts">
            <span>健康 {counts.healthy}</span><span>异常 {counts.error}</span><span>未知 {counts.unknown}</span>
          </p>
        </div>
        <Button size="sm" outlined onClick={retry} disabled={view.k === "loading"}>
          <RefreshCw className="mr-1 size-3.5" aria-hidden="true" />刷新
        </Button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/50">
        <span>运维负责人</span><span>处理异常探针</span>
      </div>

      {view.k === "loading" ? (
        <Card><CardContent className="space-y-3 p-4" data-testid="hlt4-loading" aria-busy="true">
          <p className="text-sm text-white/55">正在检查服务…</p>
          {[1, 2, 3, 4].map((row) => <div key={row} className="h-16 animate-pulse rounded bg-white/5" />)}
        </CardContent></Card>
      ) : view.k === "empty" ? (
        <Card><CardContent className="py-10 text-center" data-testid="hlt4-empty">
          <p className="text-sm text-white/80">探针未接入</p><p className="mt-2 text-xs text-white/50">请看接入说明。</p>
        </CardContent></Card>
      ) : view.k === "error" ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-10 text-center" data-testid="hlt4-error" role="alert">
          <p className="text-sm text-white/80">所有探针均未收到响应</p>
          <p className="text-xs text-white/40">请求号：{view.requestId}</p>
          <Button size="sm" outlined onClick={() => { void runProbes(); }}>重试</Button>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0" data-testid="hlt4-list">
          {view.rows.map((row) => (
            <div key={row.id} title={row.detail ?? undefined} className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-3 last:border-b-0" data-testid={`hlt4-row-${row.id}`}>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm text-white/85">{row.name}</p>
                {row.reason ? <p className="mt-1 break-words text-xs text-white/55">{row.reason}</p> : null}
                <p className="mt-1 text-xs text-white/40">采集时刻：{row.collectedAt ?? "—（未采集）"}</p>
              </div>
              <Badge tone={statusTone(row.status)} data-testid={`hlt4-status-${row.id}`}>{statusLabel(row.status)}</Badge>
            </div>
          ))}
        </CardContent></Card>
      )}
    </section>
  );
}
