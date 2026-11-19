// Module: models — 模型与单价
//
// 三块数据各读各的：模型目录、单价表、平台账本。缺一块就只说那一块未接入，
// 不拿别的数据补，也不把「单价 × 用量」当作已花费。所有未知值都是 `—` 或
// 「未计价」，没有示例数字、没有补 0。
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Copy, RefreshCw } from 'lucide-react';

import { Button } from '@nous-research/ui/ui/components/button';
import { Card, CardContent } from '@nous-research/ui/ui/components/card';

import { copyTextToClipboard } from '@/lib/clipboard';
import { ApiError } from '@/lib/api-error';
import { fetchJsonStrict } from './fetchJson';

import {
  MODELS_GAP,
  fmtStamp,
  fmtUnitPrice,
  ledgerMoney,
  ledgerStatusLabel,
  priceLabel,
  readCatalog,
  readLedger,
  readPrices,
  shortCode,
  type ModelCatalogRow,
  type ModelLedger,
  type ModelPriceRow,
} from './models';

type PagePhase = 'loading' | 'ready' | 'empty' | 'error' | 'denied';
type SourcePhase = 'ready' | 'empty' | 'unavailable' | 'denied' | 'error';

type Catalog = { rows: ModelCatalogRow[]; asOf: string | null };
type Pricelist = { rows: ModelPriceRow[]; asOf: string | null };

type Source<T> = {
  phase: SourcePhase;
  data: T | null;
  requestId: string | null;
  message: string | null;
};

type Loaded = {
  catalog: Source<Catalog>;
  prices: Source<Pricelist>;
  ledger: Source<ModelLedger>;
};

const FORCED = new Set<PagePhase>(['loading', 'empty', 'error', 'denied']);

function readForcedState(params: URLSearchParams): PagePhase | null {
  const raw = params.get('state');
  return raw && FORCED.has(raw as PagePhase) ? (raw as PagePhase) : null;
}

function requestIdOf(error: unknown): string | null {
  if (error instanceof ApiError) return error.requestId ?? null;
  return null;
}

function messageOf(error: unknown): string | null {
  if (error instanceof ApiError) return error.message;
  return null;
}

/** The BFF's “price not wired” envelope is a 200 with a code, not a 404. */
function notWired(payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as { code?: unknown }).code === 'models.pricing_not_wired'
  );
}

function sourceFrom<T>(
  result: PromiseSettledResult<unknown>,
  parse: (payload: unknown) => T,
  isEmpty: (value: T) => boolean,
): Source<T> {
  if (result.status === 'fulfilled') {
    if (notWired(result.value)) return { phase: 'unavailable', data: null, requestId: null, message: null };
    const data = parse(result.value);
    return { phase: isEmpty(data) ? 'empty' : 'ready', data, requestId: null, message: null };
  }
  const error = result.reason;
  const status = error instanceof ApiError ? error.status : 0;
  const requestId = requestIdOf(error);
  const message = messageOf(error);
  if (status === 403 || status === 404) return { phase: 'unavailable', data: null, requestId, message };
  if (status === 401) return { phase: 'denied', data: null, requestId, message };
  return { phase: 'error', data: null, requestId, message };
}

function phaseOf(loaded: Loaded): PagePhase {
  const sources = [loaded.catalog, loaded.prices, loaded.ledger];
  if (sources.every((source) => source.phase === 'error')) return 'error';
  if (sources.every((source) => source.phase === 'denied')) return 'denied';
  if (sources.every((source) => source.phase === 'empty')) return 'empty';
  return 'ready';
}

function sourceRequestId(sources: Source<unknown>[]): string | null {
  for (const source of sources) {
    if (source.requestId) return source.requestId;
  }
  return null;
}

function sourceMessage(sources: Source<unknown>[]): string | null {
  for (const source of sources) {
    if (source.message) return source.message;
  }
  return null;
}

function RequestId({ id, testId }: { id: string | null; testId: string }): ReactNode {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  if (!id) {
    return (
      <p className="text-xs text-muted-foreground" data-testid={testId}>
        本次请求未记录编号，可复制时间与操作路径反馈。
      </p>
    );
  }
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground" data-testid={testId}>
      <span>请求编号：</span>
      <code className="min-w-0 break-all" title={id}>{id}</code>
      <button
        type="button"
        className="inline-flex items-center gap-1 underline underline-offset-2"
        aria-label="复制请求编号"
        onClick={() => {
          void copyTextToClipboard(id).then((ok) => setCopied(ok ? 'done' : 'failed'));
        }}
      >
        <Copy className="size-3" aria-hidden="true" />
        {copied === 'done' ? '已复制' : copied === 'failed' ? '复制失败，请手动选择' : '复制'}
      </button>
    </p>
  );
}

function Missing({ title, body, testId, gap }: { title: string; body: string; testId: string; gap?: string }): ReactNode {
  return (
    <div className="space-y-1 text-sm" data-testid={testId} title={gap}>
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground">{body}</p>
    </div>
  );
}

function Failure({
  title,
  message,
  requestId,
  onRetry,
  testId,
}: {
  title: string;
  message: string | null;
  requestId: string | null;
  onRetry: () => void;
  testId: string;
}): ReactNode {
  return (
    <div className="space-y-2 text-sm" data-testid={testId}>
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground">
        {message ?? '服务暂时没有回答，稍后重试；这不影响已经读到的其他两块。'}
      </p>
      <RequestId id={requestId} testId={`${testId}-rid`} />
      <Button size="sm" outlined onClick={onRetry} data-testid={`${testId}-retry`}>
        重试
      </Button>
    </div>
  );
}

export function ModelsModulePage() {
  const [params, setParams] = useSearchParams();
  const forced = readForcedState(params);
  const [phase, setPhase] = useState<PagePhase>(forced ?? 'loading');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (forced) return;
    let live = true;
    setPhase('loading');
    setLoaded(null);
    const load = async () => {
      const [catalogResult, pricesResult, usageResult] = await Promise.allSettled([
        fetchJsonStrict('/agent-api/api/models'),
        fetchJsonStrict('/agent-api/api/models/pricing'),
        fetchJsonStrict('/agent-api/api/hermes-usage?days=30'),
      ]);
      if (!live) return;
      const next: Loaded = {
        catalog: sourceFrom(catalogResult, readCatalog, (value) => value.rows.length === 0),
        prices: sourceFrom(pricesResult, readPrices, (value) => value.rows.length === 0),
        ledger: sourceFrom(
          usageResult,
          readLedger,
          (value) => value.spent === null && value.rows === null && value.status === null,
        ),
      };
      setLoaded(next);
      setPhase(phaseOf(next));
    };
    void load();
    return () => {
      live = false;
    };
  }, [forced, token]);

  const retry = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete('state');
    next.delete('rid');
    setParams(next, { replace: true });
    setToken((value) => value + 1);
  }, [params, setParams]);

  const catalog = loaded?.catalog;
  const prices = loaded?.prices;
  const ledger = loaded?.ledger;
  const pageRequestId = loaded ? sourceRequestId([loaded.catalog, loaded.prices, loaded.ledger]) : null;
  const pageMessage = loaded ? sourceMessage([loaded.catalog, loaded.prices, loaded.ledger]) : null;

  return (
    <section className="space-y-4" data-testid="mdl4-page">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-mondwest text-xl">模型与单价</h1>
          <p className="text-sm text-muted-foreground">
            模型目录、价目表、平台账本各读各的：单价是标价，扣费是真实发生过的金额。
          </p>
        </div>
        <Button size="sm" outlined onClick={retry} data-testid="mdl4-refresh" disabled={phase === 'loading'}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          重新读取
        </Button>
      </header>

      {forced ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200" data-testid="mdl4-fixture-note" title={MODELS_GAP}>
          预览状态：这是用 `?state=` 复现出来的画面，不是服务此刻的回答。
        </div>
      ) : null}

      {phase === 'loading' ? (
        <Card>
          <CardContent className="space-y-2 p-4" data-testid="mdl4-loading" aria-busy="true">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <p className="pt-2 text-xs text-muted-foreground">正在读取模型目录、价目表与账本…</p>
          </CardContent>
        </Card>
      ) : null}

      {phase === 'empty' ? (
        <Card>
          <CardContent className="space-y-2 p-6 text-sm" data-testid="mdl4-empty">
            <p className="font-medium">还没有可展示的模型</p>
            <p className="text-muted-foreground">
              模型目录、价目表和账本都还没有条目。空不等于 0：这里不显示「0 个模型」或「$0.00」。
            </p>
            <Button size="sm" outlined onClick={retry} data-testid="mdl4-empty-retry">
              再看看
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === 'denied' ? (
        <Card>
          <CardContent className="space-y-2 p-6 text-sm" data-testid="mdl4-denied">
            <p className="font-medium">没有权限查看模型与单价</p>
            <p className="text-muted-foreground">这一页需要模型与计价的查看权限；请联系管理员开通后再来。</p>
            <RequestId id={pageRequestId ?? params.get('rid')} testId="mdl4-denied-rid" />
            <Button size="sm" outlined onClick={retry} data-testid="mdl4-denied-retry">
              刷新试试
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === 'error' ? (
        <Card>
          <CardContent className="space-y-2 p-6 text-sm" data-testid="mdl4-error" role="alert">
            <p className="font-medium">这次没能读取模型与账本</p>
            <p className="text-muted-foreground">
              {pageMessage ?? '服务暂时不可达或出错了，请稍后重试。'}
            </p>
            <RequestId id={pageRequestId ?? params.get('rid')} testId="mdl4-error-rid" />
            <Button size="sm" outlined onClick={retry} data-testid="mdl4-error-retry">
              重试
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === 'ready' ? (
        <>
          <Card>
            <CardContent className="space-y-3 p-4" data-testid="mdl4-catalog">
              <div>
                <h2 className="text-base font-medium">模型目录</h2>
                <p className="text-xs text-muted-foreground">
                  来源：模型目录 · 读取于 {fmtStamp(catalog?.data?.asOf ?? null)}
                </p>
              </div>
              {catalog?.phase === 'ready' && catalog.data ? (
                <div className="overflow-x-auto" data-testid="mdl4-catalog-scroll">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-normal">模型</th>
                        <th className="py-2 pr-3 font-normal">提供方</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {catalog.data.rows.map((row) => (
                        <tr key={row.modelId} data-testid={`mdl4-catalog-${row.modelId}`}>
                          <td className="py-2 pr-3" title={row.modelId}>
                            {row.label || shortCode(row.modelId)}
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">{row.provider ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : catalog?.phase === 'empty' ? (
                <Missing
                  title="模型目录里还没有模型"
                  body="目录是空的，不拿价格表或账本里的名字补；等模型登记后再看。"
                  testId="mdl4-catalog-empty"
                />
              ) : catalog?.phase === 'unavailable' ? (
                <Missing
                  title="模型目录未接入"
                  body="上游还没有提供模型清单读取口。这里不摆示例模型，也不显示「0 个模型」。"
                  testId="mdl4-catalog-unavailable"
                  gap={MODELS_GAP}
                />
              ) : catalog?.phase === 'denied' ? (
                <div className="space-y-2" data-testid="mdl4-catalog-denied">
                  <Missing title="没有权限查看模型目录" body="请联系管理员开通模型查看权限。" testId="mdl4-catalog-denied-body" />
                  <RequestId id={catalog.requestId} testId="mdl4-catalog-denied-rid" />
                </div>
              ) : (
                <Failure
                  title="模型目录读取失败"
                  message={catalog?.message ?? null}
                  requestId={catalog?.requestId ?? null}
                  onRetry={retry}
                  testId="mdl4-catalog-error"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4" data-testid="mdl4-prices">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-medium">单价（价目表）</h2>
                  <p className="text-xs text-muted-foreground">
                    来源：模型价格表 · 读取于 {fmtStamp(prices?.data?.asOf ?? null)}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">每百万 token</span>
              </div>
              {prices?.phase === 'ready' && prices.data ? (
                <div className="overflow-x-auto" data-testid="mdl4-price-scroll">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 font-normal">模型</th>
                        <th className="py-2 pr-3 font-normal">提供方</th>
                        <th className="py-2 pr-3 font-normal">输入</th>
                        <th className="py-2 pr-3 font-normal">输出</th>
                        <th className="py-2 pr-3 font-normal">价格生效</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {prices.data.rows.map((row) => (
                        <tr key={row.modelId} data-testid={`mdl4-price-${row.modelId}`}>
                          <td className="py-2 pr-3" title={row.modelId}>
                            {priceLabel(row)}
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">{row.provider ?? '—'}</td>
                          <td className="py-2 pr-3 tabular-nums" title={row.inputPerMillion === null ? '价格表没有给这一项标价' : undefined}>
                            {fmtUnitPrice(row.inputPerMillion, row.currency)}
                          </td>
                          <td className="py-2 pr-3 tabular-nums" title={row.outputPerMillion === null ? '价格表没有给这一项标价' : undefined}>
                            {fmtUnitPrice(row.outputPerMillion, row.currency)}
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">{fmtStamp(row.asOf)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : prices?.phase === 'empty' ? (
                <Missing
                  title="价目表还没有条目"
                  body="不按模型目录猜价，也不显示 0 元；等价格表生成后再看。"
                  testId="mdl4-prices-empty"
                />
              ) : prices?.phase === 'unavailable' ? (
                <Missing
                  title="单价表未接入"
                  body="上游还没有提供价目表。这里不显示 0 元，也不拿目录里的名字冒充价格。"
                  testId="mdl4-prices-unavailable"
                  gap={MODELS_GAP}
                />
              ) : prices?.phase === 'denied' ? (
                <div className="space-y-2" data-testid="mdl4-prices-denied">
                  <Missing title="没有权限查看单价" body="请联系管理员开通模型与计价查看权限。" testId="mdl4-prices-denied-body" />
                  <RequestId id={prices.requestId} testId="mdl4-prices-denied-rid" />
                </div>
              ) : (
                <Failure
                  title="单价表读取失败"
                  message={prices?.message ?? null}
                  requestId={prices?.requestId ?? null}
                  onRetry={retry}
                  testId="mdl4-prices-error"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4" data-testid="mdl4-ledger">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-medium">实际扣费（账本）</h2>
                  <p className="text-xs text-muted-foreground">
                    来源：平台扣费账本 · 截至 {fmtStamp(ledger?.data?.asOf ?? null)}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">USD</span>
              </div>
              {ledger?.phase === 'ready' && ledger.data ? (
                <div className="grid gap-3 sm:grid-cols-3" data-testid="mdl4-ledger-figures">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">账本合计</p>
                    <p className="break-words text-xl tabular-nums" data-testid="mdl4-ledger-total">{ledgerMoney(ledger.data)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">计价状态</p>
                    <p className="text-sm">{ledgerStatusLabel(ledger.data.status)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">账本行数</p>
                    <p className="text-sm tabular-nums">{ledger.data.rows === null ? '—' : ledger.data.rows}</p>
                  </div>
                </div>
              ) : ledger?.phase === 'empty' ? (
                <Missing
                  title="账本还没有记录"
                  body="没有扣费记录不等于 0 元；等账本落账后再看。"
                  testId="mdl4-ledger-empty"
                />
              ) : ledger?.phase === 'unavailable' ? (
                <Missing
                  title="扣费账本未接入"
                  body="上游还没有提供账本读取口。这里不显示零金额，也不按单价乘用量算一个数。"
                  testId="mdl4-ledger-unavailable"
                  gap={MODELS_GAP}
                />
              ) : ledger?.phase === 'denied' ? (
                <div className="space-y-2" data-testid="mdl4-ledger-denied">
                  <Missing title="没有权限查看扣费账本" body="请联系管理员开通账本查看权限。" testId="mdl4-ledger-denied-body" />
                  <RequestId id={ledger.requestId} testId="mdl4-ledger-denied-rid" />
                </div>
              ) : (
                <Failure
                  title="扣费账本读取失败"
                  message={ledger?.message ?? null}
                  requestId={ledger?.requestId ?? null}
                  onRetry={retry}
                  testId="mdl4-ledger-error"
                />
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            单价与扣费分两块看：单价是标价，扣费是账本里真实发生过的金额。本页不用单价乘用量，也不把两块数字相互换算；缺少的值显示「—」，不补零。
          </p>
        </>
      ) : null}
    </section>
  );
}