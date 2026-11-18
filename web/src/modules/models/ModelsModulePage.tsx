// Module: models — 模型与单价
// reuse: /v1/models
// reuse: /v1/models/pricing
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button, Card, CardContent } from '@nous-research/ui';

import { fetchJSON } from '@/lib/api';
import { API_UNREACHABLE_MESSAGE, ApiError, humanizeStatus } from '@/lib/api-error';

import {
  MODELS_FIXTURE,
  fmtStamp,
  fmtUnitPrice,
  fmtUsd,
  priceLabel,
  readPrices,
  readSpend,
  spendLabel,
  type ModelPriceRow,
  type ModelSpendRow,
  type ModelsPayload,
} from './models';

type Phase = 'loading' | 'ready' | 'empty' | 'error' | 'denied';

const FORCED = new Set(['loading', 'empty', 'error', 'denied']);

function readForcedState(params: URLSearchParams): Phase | null {
  const raw = params.get('state');
  return raw && FORCED.has(raw) ? (raw as Phase) : null;
}

function requestIdOf(error: unknown): string | null {
  if (error instanceof ApiError) return error.requestId ?? null;
  return null;
}

export function ModelsModulePage() {
  const [params, setParams] = useSearchParams();
  const forced = readForcedState(params);
  const [phase, setPhase] = useState<Phase>(forced ?? 'loading');
  const [payload, setPayload] = useState<ModelsPayload | null>(null);
  const [failure, setFailure] = useState<{ message: string; requestId: string | null } | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (forced) {
      setPhase(forced);
      return;
    }
    let live = true;
    setPhase('loading');
    setFailure(null);

    const load = async () => {
      try {
        // reuse: /v1/models
        const catalog = await fetchJSON<unknown>('/agent-api/api/models');
        // reuse: /v1/models/pricing
        const pricing = await fetchJSON<unknown>('/agent-api/api/models/pricing').catch(() => null);
        if (!live) return;

        const pricePart = readPrices(pricing ?? catalog);
        const spendPart = readSpend(pricing ?? catalog);
        const next: ModelsPayload = {
          prices: pricePart.rows,
          spend: spendPart.rows,
          pricesAsOf: pricePart.asOf,
          spendAsOf: spendPart.asOf,
          origin: 'bff',
        };
        if (!next.prices.length && !next.spend.length) {
          setPhase('empty');
          return;
        }
        setPayload(next);
        setPhase('ready');
      } catch (error) {
        if (!live) return;
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
          setPhase(error.status === 403 ? 'denied' : 'empty');
          return;
        }
        // 接口还没接上时给示例数据，但页面明确标「示例数据」，不冒充真实值。
        if (error instanceof ApiError && (error.status === 0 || error.status === 404)) {
          setPayload(MODELS_FIXTURE);
          setPhase('ready');
          return;
        }
        setFailure({
          message: error instanceof ApiError && error.status ? humanizeStatus(error.status) : API_UNREACHABLE_MESSAGE,
          requestId: requestIdOf(error),
        });
        setPhase('error');
      }
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

  const fixture = payload?.origin === 'fixture';
  const prices = useMemo(() => payload?.prices ?? [], [payload]);
  const spend = useMemo(() => payload?.spend ?? [], [payload]);

  return (
    <section className="space-y-4" data-testid="models-module" data-fixture={fixture ? '1' : undefined}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mondwest text-xl">模型与单价</h1>
          <p className="text-sm text-muted-foreground">
            价目表和账本各说各的：单价是标价，扣费是真实发生过的花费。
          </p>
        </div>
        <Button size="sm" outlined onClick={retry} data-testid="models-refresh">
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          重新读取
        </Button>
      </header>

      {fixture ? (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
          data-testid="models-fixture-note"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            示例数据：模型目录和价格表还没接上。接上后同一张表直接显示真实标价与账本扣费，本页不改任何数字。
          </span>
        </div>
      ) : null}

      {phase === 'loading' ? (
        <Card>
          <CardContent className="space-y-2 p-4" data-testid="models-loading">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <p className="pt-2 text-xs text-muted-foreground">正在读取模型目录与账本…</p>
          </CardContent>
        </Card>
      ) : null}

      {phase === 'empty' ? (
        <Card>
          <CardContent className="space-y-2 p-6 text-sm" data-testid="models-empty">
            <p className="font-medium">还没有可展示的模型</p>
            <p className="text-muted-foreground">
              模型目录里暂时没有任何模型，或者这一份价格表还没生成。等有模型登记之后，这里会出现它的标价与账本扣费。
            </p>
            <Button size="sm" outlined onClick={retry}>
              再看看
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === 'denied' ? (
        <Card>
          <CardContent className="space-y-2 p-6 text-sm" data-testid="models-denied">
            <p className="font-medium">你看不到这组单价</p>
            <p className="text-muted-foreground">
              可能是这一页不存在，也可能是当前账号没有查看模型与计价的权限。
            </p>
            <p className="text-xs text-muted-foreground">
              {params.get('rid') ? `请求编号：${params.get('rid')}` : '本次请求未记录编号，可复制时间与操作路径反馈'}
            </p>
            <Button size="sm" outlined onClick={retry}>
              刷新试试
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === 'error' ? (
        <Card>
          <CardContent className="space-y-2 p-6 text-sm" data-testid="models-error">
            <p className="font-medium">这几条单价没能读出来</p>
            <p className="text-muted-foreground">{failure?.message ?? API_UNREACHABLE_MESSAGE}</p>
            <p className="text-xs text-muted-foreground">
              {failure?.requestId ? `请求编号：${failure.requestId}` : '本次请求未记录编号，可复制时间与操作路径反馈'}
            </p>
            <Button size="sm" outlined onClick={retry}>
              重试
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {phase === 'ready' && payload ? (
        <>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-medium">单价（价目表）</h2>
                  <p className="text-xs text-muted-foreground">
                    来源：{fixture ? '示例价格表' : '模型价格表'} · 读取于 {fmtStamp(payload.pricesAsOf)}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">每百万 token</span>
              </div>
              <div className="overflow-x-auto" data-testid="models-price-scroll">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-normal">模型</th>
                      <th className="py-2 pr-3 font-normal">供应商</th>
                      <th className="py-2 pr-3 font-normal">输入</th>
                      <th className="py-2 pr-3 font-normal">输出</th>
                      <th className="py-2 pr-3 font-normal">价格生效</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {prices.map((row: ModelPriceRow) => (
                      <tr key={row.modelId} data-testid={`models-price-${row.modelId}`}>
                        <td className="py-2 pr-3" title={row.modelId}>
                          {priceLabel(row)}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{row.provider || '—'}</td>
                        <td className="py-2 pr-3 tabular-nums">
                          {fmtUnitPrice(row.inputPerMillion, row.currency)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">
                          {fmtUnitPrice(row.outputPerMillion, row.currency)}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{fmtStamp(row.asOf)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {prices.length === 0 ? (
                <p className="text-xs text-muted-foreground" data-testid="models-prices-empty">
                  这份价格表还没有条目。
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-medium">实际扣费（账本）</h2>
                  <p className="text-xs text-muted-foreground">
                    来源：{fixture ? '示例账本' : '平台扣费账本'} · 截至 {fmtStamp(payload.spendAsOf)}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">USD</span>
              </div>
              <div className="overflow-x-auto" data-testid="models-spend-scroll">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-normal">模型</th>
                      <th className="py-2 pr-3 font-normal">扣费</th>
                      <th className="py-2 pr-3 font-normal">运行数</th>
                      <th className="py-2 pr-3 font-normal">账本截至</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {spend.map((row: ModelSpendRow) => (
                      <tr key={row.modelId} data-testid={`models-spend-${row.modelId}`}>
                        <td className="py-2 pr-3" title={row.modelId}>
                          {spendLabel(row)}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{fmtUsd(row.spent)}</td>
                        <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                          {row.runs === null ? '—' : row.runs}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{fmtStamp(row.asOf)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {spend.length === 0 ? (
                <p className="text-xs text-muted-foreground" data-testid="models-spend-empty">
                  本期账本没有这个模型的扣费记录。
                </p>
              ) : null}
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