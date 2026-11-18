import { useEffect, useState } from "react";
import { RefreshCw, Wrench } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";
import { fetchJSON } from "@/lib/api";
import { currentFixtureState, fixtureView, type FixtureState } from "../../shell/fixtures";
import { formatBeijingTime, readServers, SERVER_FIXTURE, type Server } from "./tools";

type State = { k: "loading" } | { k: "empty" } | { k: "error"; requestId: string } | { k: "ready"; rows: Server[]; fixture: boolean };

function fixtureState(state: FixtureState | null): State | null {
  if (state === "loading") return { k: "loading" };
  if (state === "empty") return { k: "empty" };
  if (state === "error") return { k: "error", requestId: "示例请求号" };
  return null;
}

export function ToolsPage() {
  const [state, setState] = useState<State>({ k: "loading" });
  const [attempt, setAttempt] = useState(0);
  const forced = currentFixtureState();
  const preview = fixtureView<State | null>(forced ?? "ready", {
    loading: () => ({ k: "loading" }), empty: () => ({ k: "empty" }),
    error: () => ({ k: "error", requestId: "示例请求号" }), ready: () => null,
  });

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const forcedNow = fixtureState(forced);
      if (forcedNow) { setState(forcedNow); return; }
      try {
        const rows = readServers(await fetchJSON<unknown>("/agent-api/api/mcp/servers"));
        if (alive) setState(rows.length ? { k: "ready", rows, fixture: false } : { k: "empty" });
      } catch {
        if (alive) setState({ k: "ready", rows: SERVER_FIXTURE, fixture: true });
      }
    };
    void run();
    return () => { alive = false; };
  }, [forced, attempt]);

  const view = preview ?? state;
  const retry = () => setAttempt((value) => value + 1);
  const fixture = view.k === "ready" && view.fixture;

  return (
    <section className="space-y-4" data-testid="tools-page" data-fixture={fixture ? "1" : forced ?? undefined}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-mondwest text-xl">工具与 MCP</h1>
          <p className="mt-1 text-sm text-white/55">查看已登记的连接及其状态</p>
        </div>
        <Button size="sm" outlined onClick={retry} disabled={view.k === "loading"}>
          <RefreshCw className="mr-1 size-3.5" aria-hidden="true" />重新读取
        </Button>
      </header>

      {fixture ? (
        <div className="flex flex-wrap items-start gap-2 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100" data-testid="tools-fixture-note">
          <Badge tone="warning">示例数据</Badge>
          <p className="min-w-0 flex-1">BFF 尚未注册 /api/mcp/servers 代理（GAP-04），接通后自动显示真实数据。</p>
        </div>
      ) : null}

      {view.k === "loading" ? (
        <Card><CardContent className="space-y-3 p-4" data-testid="tools-loading" aria-busy="true">
          <p className="text-sm text-white/55">正在读取连接…</p>
          {[1, 2, 3].map((row) => <div key={row} className="h-12 animate-pulse rounded bg-white/5" />)}
        </CardContent></Card>
      ) : view.k === "empty" ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center" data-testid="tools-empty">
          <Wrench className="size-7 text-white/35" aria-hidden="true" />
          <p className="text-sm text-white/80">还没有登记的连接</p>
          <p className="text-xs text-white/50">如需接入新连接，请在原生 MCP 管理页操作；控制台入口待接线。</p>
        </CardContent></Card>
      ) : view.k === "error" ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-10 text-center" data-testid="tools-error" role="alert">
          <p className="text-sm text-white/80">连接列表暂时无法读取</p>
          <p className="text-xs text-white/40">请求号：{view.requestId}</p>
          <Button size="sm" outlined onClick={retry}>重试</Button>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0" data-testid="tools-list">
          {view.rows.map((server) => {
            const unavailable = server.status === "unavailable";
            return (
              <div key={server.id} className={`flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 last:border-b-0 ${unavailable ? "opacity-55" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm text-white/85" title={server.id}>{server.name}</p>
                  {unavailable ? <p className="mt-1 break-words text-xs text-white/55">{server.reason ?? "—（上游未说明不可用原因）"}</p> : null}
                  <p className="mt-1 text-xs text-white/40">最近检查：{server.checkedAt ? formatBeijingTime(server.checkedAt) ?? "—（时间格式无法识别）" : "—（未提供检查时刻）"}</p>
                </div>
                <Badge tone={server.status === "available" ? "success" : server.status === "unavailable" ? "outline" : "outline"}>
                  {server.status === "available" ? "正常" : server.status === "unavailable" ? "不可用" : "—（上游未说明）"}
                </Badge>
                {server.status === "unknown" ? <p className="basis-full text-right text-xs text-white/40">上游未说明连接状态</p> : null}
              </div>
            );
          })}
        </CardContent></Card>
      )}
    </section>
  );
}
