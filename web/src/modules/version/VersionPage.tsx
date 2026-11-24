import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { ApiError } from "@/lib/api-error";
import { fetchJsonStrict } from "../models/fetchJson";
import { MODELS_GAP, fmtStamp, fmtUnitPrice, readPrices, type ModelPriceRow } from "../models/models";
import { currentFixtureState, fixtureView } from "../../shell/fixtures";
import { readBuildRows, readDependencyRows, type BuildEnv, type BuildRow, type DependencyRow } from "./version";
import { VersionHealthSurface } from "./VersionHealthSurface";
import { SystemCaliberNotes } from "../health/SystemCaliberNotes";
import { SystemRefreshBar, useRefreshCoordinator } from "../health/systemRefresh";
import "./version.css";

type State = { k: "loading" } | { k: "empty" } | { k: "error"; requestId: string | null } | { k: "ready"; build: BuildRow[]; dependencies: DependencyRow[] };
type PriceState =
  | { k: "loading" }
  | { k: "ready"; rows: ModelPriceRow[]; asOf: string | null }
  | { k: "empty" }
  | { k: "error"; message: string; requestId: string | null; status: number };

/** 骨架 version pane「变更记录」的列名（同骨架同序）：整表无读口时不渲染空列，缺哪列在卡底可用性块点名。 */
const CHANGELOG_COLUMNS = ["版本", "日期", "变更", "类型", "操作人"] as const;

function CopyRequestId({ id }: { id: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!id) {
    return <p className="text-xs text-white/45" data-testid="ver4-prices-request-id">请求编号：未提供</p>;
  }
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-white/45" data-testid="ver4-prices-request-id">
      <span>请求编号：</span>
      <code className="min-w-0 break-all" title={id}>{id}</code>
      <button
        type="button"
        className="underline underline-offset-2"
        aria-label="复制请求编号"
        onClick={() => {
          void navigator.clipboard?.writeText(id).then(() => setCopied(true), () => setCopied(false));
        }}
      >
        {copied ? "已复制" : "复制"}
      </button>
    </p>
  );
}

function StateBadge({ unknown }: { unknown: boolean }) {
  return <Badge tone={unknown ? "outline" : "success"}>{unknown ? "未知" : "已提供"}</Badge>;
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

function BuildRows({ rows }: { rows: BuildRow[] }) {
  return <dl className="ver5-kv-rows" data-testid="ver4-build-rows">
    {rows.map((row) => (
      <div key={row.label} className="ver5-kv-row" title={row.title}>
        <dt>{row.label}</dt>
        <dd>
          {row.value ? <span className="ver5-kv-value">{row.value}</span> : <span className="ver5-kv-unknown"><StateBadge unknown />{" "}未知</span>}
          {row.reason ? <p className="ver5-kv-reason">{row.reason}</p> : null}
        </dd>
      </div>
    ))}
  </dl>;
}

export function VersionPage() {
  const forced = currentFixtureState();
  const preview = fixtureView<State | null>(forced ?? "ready", {
    loading: () => ({ k: "loading" }), empty: () => ({ k: "empty" }),
    error: () => ({ k: "error", requestId: null }), ready: () => null,
  });

  const build = readBuildRows(import.meta.env as unknown as BuildEnv);
  const dependencies = readDependencyRows();
  const allMissing = build.every((row) => row.value === null);
  const liveState: State = allMissing && dependencies.every((row) => row.version === null)
    ? { k: "empty" }
    : { k: "ready", build, dependencies };
  const view = preview ?? liveState;
  const [prices, setPrices] = useState<PriceState>({ k: "loading" });
  const [priceReload, setPriceReload] = useState(0);
  const refresh = useRefreshCoordinator(2);
  const pricesRef = useRef<PriceState>(prices);
  pricesRef.current = prices;
  const [, setPreviewTick] = useState(0);
  const leaveForLive = () => { leavePreview(); setPreviewTick((n) => n + 1); };

  useEffect(() => {
    if (forced && forced !== "ready") return;
    let live = true;
    fetchJsonStrict("/agent-api/api/models/pricing")
      .then((payload) => {
        if (!live) return;
        const parsed = readPrices(payload);
        setPrices(parsed.rows.length === 0 ? { k: "empty" } : { k: "ready", rows: parsed.rows, asOf: parsed.asOf });
        if (refresh.tick > 0) refresh.finish(null);
      })
      .catch((error: unknown) => {
        if (!live) return;
        const apiError = error instanceof ApiError ? error : null;
        const failure = {
          message:
            apiError?.status === 403 || apiError?.status === 404
              ? "单价表未接入，或当前账号无权读取；这里不显示猜测的单价。"
              : apiError?.message ?? "单价表暂时读不出来，请稍后重试。",
          requestId: apiError?.requestId ?? null,
        };
        if (refresh.tick > 0) refresh.finish(failure);
        if (pricesRef.current.k === "ready" || pricesRef.current.k === "empty") return;
        setPrices({ k: "error", ...failure, status: apiError?.status ?? 0 });
      });
    return () => {
      live = false;
    };
  }, [forced, priceReload, refresh.tick, refresh.finish]);

  // 当前构建的读数：构建号是「运行代码」的那一条，缺注入时整格是「—」，不编版本号。
  const running: BuildRow | undefined = view.k === "ready"
    ? view.build.find((row) => row.label === "构建号")
    : undefined;
  const channel = view.k === "ready" ? view.build.find((row) => row.label === "运行代码") : undefined;
  const commit = view.k === "ready" ? view.build.find((row) => row.label === "提交号") : undefined;
  const builtAt = view.k === "ready" ? view.build.find((row) => row.label === "构建时间") : undefined;
  const runningLabel = running?.value ?? "未注入";
  const subline = `当前 ${runningLabel} · 可用更新 无读口 · 通道 ${channel?.value ?? "未注入"}`;

  return (
    <section className="ver5-page" data-testid="ver4-page">
      <header className="ver5-head">
        <div className="min-w-0">
          <h2 className="ver5-title" data-testid="ver5-title">版本</h2>
          <p className="ver5-sub" data-testid="ver5-sub">{subline}</p>
          <div className="mt-3"><SystemRefreshBar coordinator={refresh} disabled={forced !== null} /></div>
        </div>
        <button
          type="button"
          className="ver5-planned"
          data-planned="1"
          aria-disabled="true"
          title="下载诊断包还没有接上：等打包与脱敏通道就绪后再开放"
          data-testid="ver4-planned-export"
          onClick={(event) => event.preventDefault()}
        >
          下载诊断包（计划中）
        </button>
      </header>

      <p className="ver5-caliber" data-testid="ver5-caliber">
        范围 当前构建注入 + 包清单 · 更新 {builtAt?.value ?? "未注入"} · 对象 {view.k === "ready" ? view.build.length + view.dependencies.length : 0} 项 ·
        口径 版本只读构建注入与包清单，缺注入按缺口声明，不编版本号
      </p>

      <div className="ver5-pair">
        <ConsoleCard label="当前版本" action={<span className="ver5-card-action">{running?.value ? "运行中" : "构建信息未注入"}</span>}>
          <div className="ver5-now">
            <span className="ver5-now-version" data-testid="ver5-running">{runningLabel}</span>
            <span className="ver5-card-action" title={builtAt?.title ?? undefined}>构建时刻 {builtAt?.value ?? "未注入"}</span>
          </div>
          <div className="ver5-divider" />
          <dl className="ver5-kv">
            <dt>构建</dt><dd>{running?.value ?? "未注入"}</dd>
            <dt>通道</dt><dd>{channel?.value ?? "未注入"}</dd>
            <dt>提交号</dt><dd>{commit?.value ?? "未注入"}</dd>
            <dt>构建时间</dt><dd>{builtAt?.value ?? "未注入"}</dd>
          </dl>
          {allMissing ? <p className="ver5-gap">构建时没有写入这项信息；请让发布流程补齐构建标识</p> : null}
        </ConsoleCard>

        <ConsoleCard
          label="可用更新"
          action={<span className="ver5-card-action">无读口</span>}
          availability={[
            { label: "最新版本", reason: "上游没有「最新版本」读口，不显示可用版本号" },
            { label: "变更说明", reason: "没有变更说明读口，不给升级建议" },
          ]}
          note="口径：不拿构建号推断线上版本。"
        >
          <div className="ver5-ops">
            <button type="button" className="ver5-planned" data-planned="1" aria-disabled="true" title="版本更新读口未接入" data-testid="ver5-check-update" onClick={(event) => event.preventDefault()}>检查更新</button>
            <button type="button" className="ver5-planned" data-planned="1" aria-disabled="true" title="变更说明随更新读口一起接入" data-testid="ver5-view-changes" onClick={(event) => event.preventDefault()}>查看变更</button>
          </div>
        </ConsoleCard>
      </div>

      <ConsoleCard
        label="变更记录"
        action={<span className="ver5-card-action">近 5 个版本</span>}
        availability={CHANGELOG_COLUMNS.map((column) => ({ label: `列「${column}」` }))}
        note="口径：变更记录只记录已发布版本；本页不按提交号拼时间线，不列假行。"
      >
        <p className="ver5-dash" data-testid="ver5-changelog">—</p>
      </ConsoleCard>

      <ConsoleCard
        label="版本读口"
        action={<a className="ver5-card-action ver5-card-link" href="#/system" title="系统健康页与本页共用同一健康读口">组件健康行</a>}
        flush
      >
        <VersionHealthSurface preview={forced && forced !== "ready" ? forced : null} refreshTick={refresh.tick} onRefreshResult={refresh.finish} />
      </ConsoleCard>

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
          <CopyRequestId id={view.requestId} />
          <Button size="sm" outlined onClick={leaveForLive} data-testid="ver4-retry">重试</Button>
        </CardContent></Card>
      ) : (
        <div className="ver5-pair" data-testid="ver4-content">
          <ConsoleCard label="构建与代码" action={<span className="ver5-card-action">构建注入</span>} note="口径：只读构建时注入的四项；没注入就是「未知」，不拿 package.json 的版本顶替。">
            <div data-testid="ver4-build">
              <BuildRows rows={view.build} />
            </div>
          </ConsoleCard>
          <ConsoleCard label="依赖版本" action={<span className="ver5-card-action">包清单</span>} note="口径：依赖版本取包清单声明值，不是运行时实际加载的版本。">
            <div className="ver5-deps" data-testid="ver4-dependencies">
              <dl className="ver5-kv-rows">
                {view.dependencies.map((item) => (
                  <div key={item.name} className="ver5-kv-row" title={item.name} data-testid={`ver4-dep-${item.name.replace(/[^a-z0-9]+/gi, '-')}`}>
                    <dt className="ver5-dep-name">{item.name}</dt>
                    <dd>
                      {item.version ? <span className="ver5-kv-value">{item.version}</span> : <span className="ver5-kv-unknown"><StateBadge unknown />{" "}未知</span>}
                      {item.reason ? <p className="ver5-kv-reason">{item.reason}</p> : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </ConsoleCard>
        </div>
      )}

      {view.k === "ready" ? <ConsoleCard
        label="模型单价"
        action={<span className="ver5-card-action">价目表</span>}
        note={`来源：模型价格表${prices.k === "ready" ? ` · 读取于 ${fmtStamp(prices.asOf)}` : ""} · 单价是价目表标价；实际扣费在「模型与单价」页的账本卡，不用单价乘次数推算。`}
      >
        <div data-testid="ver4-prices">
          {prices.k === "loading" ? (
            <p className="text-sm text-white/55" aria-busy="true">正在读取单价…</p>
          ) : prices.k === "error" ? (
            <div className="space-y-2 text-sm" data-testid="ver4-prices-error" role="alert" title={prices.status === 403 || prices.status === 404 ? MODELS_GAP : undefined}>
              <p className="text-white/80">{prices.message}</p>
              <CopyRequestId id={prices.requestId} />
              <button
                type="button"
                className="ver5-planned"
                data-planned="1"
                aria-disabled="true"
                data-testid="ver4-prices-retry"
                onClick={() => setPriceReload((n) => n + 1)}
              >
                重试
              </button>
            </div>
          ) : prices.k === "empty" ? (
            <p className="text-sm text-white/55" data-testid="ver4-prices-empty">还没有单价记录；不显示 0 元。</p>
          ) : (
            <div className="min-w-0 overflow-x-auto">
              <table className="ver5-price-table" data-testid="ver4-price-table">
                <thead>
                  <tr>
                    <th>模型</th>
                    <th>提供方</th>
                    <th>输入</th>
                    <th>输出</th>
                    <th>价格生效</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.rows.map((row) => (
                    <tr key={row.modelId} data-testid={`ver4-price-${row.modelId}`} title={row.modelId}>
                      <td>{row.label || row.modelId}</td>
                      <td>{row.provider ?? "—"}</td>
                      <td className="ver5-num">{fmtUnitPrice(row.inputPerMillion, row.currency)}</td>
                      <td className="ver5-num">{fmtUnitPrice(row.outputPerMillion, row.currency)}</td>
                      <td className="ver5-num">{fmtStamp(row.asOf)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ConsoleCard> : null}
      <SystemCaliberNotes />
    </section>
  );
}