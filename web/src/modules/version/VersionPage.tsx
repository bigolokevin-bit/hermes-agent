import { Badge, Card, CardContent } from "@nous-research/ui";
import { currentFixtureState, fixtureView } from "../../shell/fixtures";
import { readBuildRows, readDependencyRows, type BuildEnv, type BuildRow, type DependencyRow } from "./version";

type State = { k: "loading" } | { k: "empty" } | { k: "error"; requestId: string } | { k: "ready"; build: BuildRow[]; dependencies: DependencyRow[] };

function StateBadge({ unknown }: { unknown: boolean }) {
  return <Badge tone={unknown ? "outline" : "success"}>{unknown ? "未知" : "已提供"}</Badge>;
}

function BuildRows({ rows }: { rows: BuildRow[] }) {
  return <dl className="divide-y divide-white/10" data-testid="ver4-build-rows">
    {rows.map((row) => (
      <div key={row.label} className="flex min-w-0 flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0" title={row.title}>
        <dt className="text-sm text-white/70">{row.label}</dt>
        <dd className="min-w-0 text-right">
          {row.value ? <span className="break-all text-sm text-white/85">{row.value}</span> : <span className="inline-flex flex-wrap items-center justify-end gap-2"><StateBadge unknown /><span className="text-sm text-white/55">未知</span></span>}
          {row.reason ? <p className="mt-1 max-w-md text-left text-xs text-white/40">{row.reason}</p> : null}
        </dd>
      </div>
    ))}
  </dl>;
}

export function VersionPage() {
  const forced = currentFixtureState();
  const preview = fixtureView<State | null>(forced ?? "ready", {
    loading: () => ({ k: "loading" }), empty: () => ({ k: "empty" }),
    error: () => ({ k: "error", requestId: "—（本地信息，无请求号）" }), ready: () => null,
  });

  const build = readBuildRows(import.meta.env as unknown as BuildEnv);
  const dependencies = readDependencyRows();
  const allMissing = build.every((row) => row.value === null);
  const liveState: State = allMissing && dependencies.every((row) => row.version === null)
    ? { k: "empty" }
    : { k: "ready", build, dependencies };
  const view = preview ?? liveState;

  return (
    <section className="space-y-4" data-testid="ver4-page" data-fixture={forced ?? undefined}>
      <header>
        <h1 className="font-mondwest text-xl">版本</h1>
        <p className="mt-1 text-sm text-white/55">构建与依赖信息</p>
      </header>

      {view.k === "loading" ? (
        <Card><CardContent className="space-y-3 p-4" data-testid="ver4-loading" aria-busy="true">
          <p className="text-sm text-white/55">正在读取版本信息…</p>
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-10 animate-pulse rounded bg-white/5" />)}
        </CardContent></Card>
      ) : view.k === "empty" ? (
        <Card><CardContent className="py-10 text-center" data-testid="ver4-empty">
          <p className="text-sm text-white/80">这项信息未提供</p>
          <p className="mt-2 text-xs text-white/50">当前构建没有注入版本信息。</p>
        </CardContent></Card>
      ) : view.k === "error" ? (
        <Card><CardContent className="py-10 text-center" data-testid="ver4-error" role="status">
          <p className="text-sm text-white/80">本地版本信息暂不可用</p>
          <p className="mt-2 text-xs text-white/50">请求号：{view.requestId}</p>
        </CardContent></Card>
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2" data-testid="ver4-content">
          <Card><CardContent className="space-y-4 p-4" data-testid="ver4-build">
            <h2 className="text-sm font-medium text-white/85">构建与代码</h2>
            <BuildRows rows={view.build} />
          </CardContent></Card>
          <Card><CardContent className="space-y-4 p-4" data-testid="ver4-dependencies">
            <h2 className="text-sm font-medium text-white/85">依赖版本</h2>
            <dl className="divide-y divide-white/10">
              {view.dependencies.map((item) => (
                <div key={item.name} className="flex min-w-0 flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0" title={item.name}>
                  <dt className="break-all text-sm text-white/70">{item.name}</dt>
                  <dd className="min-w-0 text-right">
                    {item.version ? <span className="break-all text-sm text-white/85">{item.version}</span> : <span className="inline-flex flex-wrap items-center justify-end gap-2"><StateBadge unknown /><span className="text-sm text-white/55">未知</span></span>}
                    {item.reason ? <p className="mt-1 text-xs text-white/40">{item.reason}</p> : null}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent></Card>
        </div>
      )}
    </section>
  );
}
