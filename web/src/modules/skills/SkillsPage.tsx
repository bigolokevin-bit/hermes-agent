import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { currentFixtureState, fixtureView, type FixtureState } from "../../shell/fixtures";
import { displayEnabled, formatBeijingTime, readDetail, readSkills, type SkillRow } from "./skills";

type State =
  | { k: "loading" }
  | { k: "empty" }
  | { k: "error"; requestId: string | null }
  | { k: "ready"; rows: SkillRow[] };

function requestId(error: unknown): string {
  if (error instanceof ApiError && error.requestId) return error.requestId;
  if (error !== null && typeof error === "object" && "requestId" in error && typeof error.requestId === "string" && error.requestId) {
    return error.requestId;
  }
  return "未提供";
}

function forcedState(state: FixtureState | null): State | null {
  if (state === "loading") return { k: "loading" };
  if (state === "empty") return { k: "empty" };
  if (state === "error") return { k: "error", requestId: "示例请求号" };
  return null;
}

export function SkillsPage() {
  const [state, setState] = useState<State>({ k: "loading" });
  const [selected, setSelected] = useState<SkillRow | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const fixture = currentFixtureState();

  const load = useCallback(async (showLoading = true) => {
    const forced = forcedState(fixture);
    if (forced) { setState(forced); return; }
    if (showLoading) setState({ k: "loading" });
    try {
      const rows = readSkills(await fetchJSON<unknown>("/agent-api/api/skills"));
      setState(rows.length ? { k: "ready", rows } : { k: "empty" });
    } catch (error) {
      setState({ k: "error", requestId: requestId(error) });
    }
  }, [fixture]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const forced = forcedState(fixture);
      if (forced) { setState(forced); return; }
      try {
        const rows = readSkills(await fetchJSON<unknown>("/agent-api/api/skills"));
        if (alive) setState(rows.length ? { k: "ready", rows } : { k: "empty" });
      } catch (error) {
        if (alive) setState({ k: "error", requestId: requestId(error) });
      }
    };
    void run();
    return () => { alive = false; };
  }, [fixture]);

  const openDetail = async (row: SkillRow) => {
    setSelected(row);
    setDetail(null);
    setDetailError(null);
    try {
      setDetail(readDetail(await fetchJSON<unknown>(`/agent-api/api/skills/${encodeURIComponent(row.id)}`)));
    } catch (error) {
      setDetailError(requestId(error));
    }
  };

  const retry = () => { void load(); };
  const page = fixtureView<State | null>(fixture ?? "ready", {
    loading: () => ({ k: "loading" }),
    empty: () => ({ k: "empty" }),
    error: () => ({ k: "error", requestId: "示例请求号" }),
    ready: () => null,
  });
  const visibleState = page ?? state;

  return (
    <section className="space-y-4" data-testid="skills-page" data-fixture={fixture ?? undefined}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-mondwest text-xl">技能</h1>
          <p className="mt-1 text-sm text-white/55">已登记的技能及其共享范围</p>
        </div>
        <Button size="sm" outlined onClick={retry} disabled={visibleState.k === "loading"}>
          <RefreshCw className="mr-1 size-3.5" aria-hidden="true" />重新读取
        </Button>
      </header>

      {selected ? (
        <Card>
          <CardContent className="space-y-4 p-4">
            <Button size="sm" outlined onClick={() => { setSelected(null); setDetail(null); }}>
              <ArrowLeft className="mr-1 size-3.5" aria-hidden="true" />返回列表
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 break-words text-base text-white/90">{selected.name}</h2>
              <Badge tone="outline">{selected.scope}</Badge>
              <Badge tone={selected.enabled === "enabled" ? "success" : "outline"}>{displayEnabled(selected.enabled)}</Badge>
            </div>
            {detailError ? (
              <div role="alert" className="space-y-2 text-sm text-white/70">
                <p>详情暂时无法读取。请求号：{detailError}</p>
                <Button size="sm" outlined onClick={() => void openDetail(selected)}>重试</Button>
              </div>
            ) : detail ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                {([
                  ["简介", detail.description],
                  ["创建时刻", formatBeijingTime(detail.createdAt) ?? "—（上游未提供创建时刻）"],
                  ["最新版本", detail.version],
                  ["状态", detail.status],
                  ["状态变更时刻", formatBeijingTime(detail.statusChangedAt) ?? "—（上游未提供状态变更时刻）"],
                ] as const).map(([label, value]) => (
                  <div key={label} className="min-w-0 border-t border-white/10 pt-2">
                    <dt className="text-xs text-white/45">{label}</dt>
                    <dd className="mt-1 break-words text-sm text-white/80">{typeof value === "string" && value ? value : "—（上游未提供此信息）"}</dd>
                  </div>
                ))}
              </dl>
            ) : <p className="text-sm text-white/50">正在读取详情…</p>}
            <p className="text-xs text-white/40" title={selected.id}>短码：{selected.id.slice(0, 8)}</p>
          </CardContent>
        </Card>
      ) : visibleState.k === "loading" ? (
        <Card><CardContent className="space-y-3 p-4" data-testid="skills-loading" aria-busy="true">
          <p className="text-sm text-white/55">正在读取技能…</p>
          {[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded bg-white/5" />)}
        </CardContent></Card>
      ) : visibleState.k === "empty" ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center" data-testid="skills-empty">
          <Sparkles className="size-7 text-white/35" aria-hidden="true" />
          <p className="text-sm text-white/80">暂时没有已登记的技能</p>
          <p className="max-w-md text-xs text-white/50">有技能加入后，会在这里显示名称、共享范围与版本状态。</p>
        </CardContent></Card>
      ) : visibleState.k === "error" ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-10 text-center" data-testid="skills-error" role="alert">
          <p className="text-sm text-white/80">技能列表暂时无法读取</p>
          <p className="text-xs text-white/50">请稍后重试。</p>
          <p className="text-xs text-white/40">请求号：{visibleState.requestId}</p>
          <Button size="sm" outlined onClick={retry}>重试</Button>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0" data-testid="skills-list">
          {(visibleState as Extract<State, { k: "ready" }>).rows.map((row) => (
            <button key={row.id} type="button" onClick={() => void openDetail(row)} className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-left last:border-b-0 hover:bg-white/5">
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm text-white/85">{row.name}</span>
                {row.nameReason ? <span className="mt-1 block text-xs text-white/40">{row.nameReason}</span> : null}
                {row.updatedAt ? <span className="mt-1 block text-xs text-white/40">更新于 {row.updatedAt}</span> : null}
              </span>
              <span className="flex max-w-full flex-wrap items-center gap-2">
                <span className="flex flex-col items-start gap-0.5">
                  <Badge tone="outline">{row.source}</Badge>
                  <span className="text-[11px] text-white/40">{row.sourceReason}</span>
                </span>
                <Badge tone="outline">{row.scope}</Badge>
                <Badge tone={row.enabled === "enabled" ? "success" : "outline"}>{displayEnabled(row.enabled)}</Badge>
                {row.enabled === "unknown" ? <span className="basis-full text-right text-[11px] text-white/40">台账列表未提供启用态</span> : null}
              </span>
            </button>
          ))}
        </CardContent></Card>
      )}
    </section>
  );
}
