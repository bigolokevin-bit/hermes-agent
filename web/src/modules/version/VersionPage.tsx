import { useEffect, useState } from "react";
import { Badge, Card, CardContent } from "@nous-research/ui";
import { ApiError } from "@/lib/api-error";
import { fetchJsonStrict } from "../models/fetchJson";
import { MODELS_GAP, fmtStamp, fmtUnitPrice, readPrices, type ModelPriceRow } from "../models/models";
import { currentFixtureState, fixtureView } from "../../shell/fixtures";
import { readBuildRows, readDependencyRows, type BuildEnv, type BuildRow, type DependencyRow } from "./version";

type State = { k: "loading" } | { k: "empty" } | { k: "error"; requestId: string | null } | { k: "ready"; build: BuildRow[]; dependencies: DependencyRow[] };
type PriceState =
  | { k: "loading" }
  | { k: "ready"; rows: ModelPriceRow[]; asOf: string | null }
  | { k: "empty" }
  | { k: "error"; message: string; requestId: string | null; status: number };

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
  const [retried, setRetried] = useState(false);
  const forced = retried ? null : currentFixtureState();
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

  useEffect(() => {
    if (forced) return;
    let live = true;
    fetchJsonStrict("/agent-api/api/models/pricing")
      .then((payload) => {
        if (!live) return;
        const parsed = readPrices(payload);
        setPrices(parsed.rows.length === 0 ? { k: "empty" } : { k: "ready", rows: parsed.rows, asOf: parsed.asOf });
      })
      .catch((error: unknown) => {
        if (!live) return;
        const apiError = error instanceof ApiError ? error : null;
        setPrices({
          k: "error",
          message:
            apiError?.status === 403 || apiError?.status === 404
              ? "单价表未接入，或当前账号无权读取；这里不显示猜测的单价。"
              : apiError?.message ?? "单价表暂时读不出来，请稍后重试。",
          requestId: apiError?.requestId ?? null,
          status: apiError?.status ?? 0,
        });
      });
    return () => {
      live = false;
    };
  }, [forced, priceReload]);

  return (
    <section className="space-y-4" data-testid="ver4-page">
      <header>
        <h1 className="font-mondwest text-xl">版本</h1>
        <p className="mt-1 text-sm text-white/55">构建与依赖信息</p>
        <button
          type="button"
          className="mt-3 rounded-md border border-white/15 px-2.5 py-1 text-xs text-white/45"
          data-planned="1"
          aria-disabled="true"
          title="下载诊断包还没有接上：等打包与脱敏通道就绪后再开放"
          data-testid="ver4-planned-export"
          onClick={(event) => event.preventDefault()}
        >
          下载诊断包（计划中）
        </button>
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
        <Card><CardContent className="space-y-3 py-10 text-center" data-testid="ver4-error" role="status">
          <p className="text-sm text-white/80">这次没能读出构建与依赖信息</p>
          <p className="text-xs text-white/50">
            页面没有把旧内容顶上来充数，也没有编造版本号；重试只会再读一次本机构建信息。
          </p>
          <p className="flex min-w-0 flex-wrap items-center justify-center gap-1 text-xs text-white/45" data-testid="ver4-error-request-id">
            <span>请求编号：</span>
            {view.requestId ? <code className="min-w-0 break-all" title={view.requestId}>{view.requestId}</code> : <span>未提供</span>}
            {view.requestId ? (
              <button
                type="button"
                className="underline underline-offset-2"
                aria-label="复制请求编号"
                data-testid="ver4-error-copy"
                onClick={() => { void navigator.clipboard?.writeText(view.requestId ?? ""); }}
              >
                复制
              </button>
            ) : null}
          </p>
          <button
            type="button"
            className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-white/70"
            data-testid="ver4-error-retry"
            onClick={() => setRetried(true)}
          >
            重试
          </button>
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
                <div key={item.name} className="flex min-w-0 flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0" title={item.name} data-testid={`ver4-dep-${item.name.replace(/[^a-z0-9]+/gi, '-')}`}>
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

      <Card data-testid="ver4-prices">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium text-white/85">模型单价</h2>
            <span className="text-xs text-white/45">
              来源：模型价格表{prices.k === "ready" ? ` · 读取于 ${fmtStamp(prices.asOf)}` : ""}
            </span>
          </div>
          {prices.k === "loading" ? (
            <p className="text-sm text-white/55" aria-busy="true">正在读取单价…</p>
          ) : prices.k === "error" ? (
            <div className="space-y-2 text-sm" data-testid="ver4-prices-error" role="alert" title={prices.status === 403 || prices.status === 404 ? MODELS_GAP : undefined}>
              <p className="text-white/80">{prices.message}</p>
              <CopyRequestId id={prices.requestId} />
              <button
                type="button"
                className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-white/70"
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
              <table className="w-full min-w-[560px] text-left text-sm" data-testid="ver4-price-table">
                <thead className="text-xs text-white/45">
                  <tr>
                    <th className="py-2 pr-3 font-normal">模型</th>
                    <th className="py-2 pr-3 font-normal">提供方</th>
                    <th className="py-2 pr-3 font-normal">输入</th>
                    <th className="py-2 pr-3 font-normal">输出</th>
                    <th className="py-2 font-normal">价格生效</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {prices.rows.map((row) => (
                    <tr key={row.modelId} data-testid={`ver4-price-${row.modelId}`} title={row.modelId}>
                      <td className="py-2 pr-3">{row.label || row.modelId}</td>
                      <td className="py-2 pr-3">{row.provider ?? "—"}</td>
                      <td className="py-2 pr-3">{fmtUnitPrice(row.inputPerMillion, row.currency)}</td>
                      <td className="py-2 pr-3">{fmtUnitPrice(row.outputPerMillion, row.currency)}</td>
                      <td className="py-2">{fmtStamp(row.asOf)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-white/40">单价是价目表标价；实际扣费在「模型与单价」页的账本卡，不用单价乘次数推算。</p>
        </CardContent>
      </Card>
    </section>
  );
}
