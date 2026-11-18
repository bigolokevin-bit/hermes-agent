/**
 * T11 · 用量与成本（`#/overview?tab=usage`） — duty module, read-only.
 *
 * Data:
 *  - `/api/hermes-usage?days=30` → runtime.hermes.usage.v1: tokens / by_model /
 *    cost block. The cost block is the ledger projection (`source: cost_ledger`);
 *    its `cost_usd` is rendered verbatim, null/unknown → 「未计价」, never 0.00.
 *  - No client-side re-pricing and no summing of money.
 *
 * Four states (loading / empty / error with request number + retry / denied
 * 403≡404) plus the shell's `?state=` preview override.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Gauge, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";
import { fetchJSON } from "@/lib/api";
import { ApiError, humanizeStatus } from "@/lib/api-error";

type CostStatus = "upstream" | "estimated" | "mixed" | "unknown";

interface UsageModelRow {
  model?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
}

interface CostEmployeeRow {
  employee_id?: string | null;
  cost_usd?: number | null;
  cost_status?: CostStatus | null;
  rows?: number | null;
}

interface HermesUsage {
  period_days?: number;
  tokens?: {
    total_input?: number | null;
    total_output?: number | null;
    total_cache_read?: number | null;
    total_reasoning?: number | null;
  } | null;
  by_model?: UsageModelRow[] | null;
  cost?: {
    source?: string | null;
    cost_usd?: number | null;
    cost_status?: CostStatus | null;
    rows?: number | null;
    per_employee?: CostEmployeeRow[] | null;
  } | null;
}

type Phase = "loading" | "ready" | "empty" | "error" | "denied";

interface State {
  phase: Phase;
  data: HermesUsage | null;
  status: number;
  message?: string;
  requestId?: string;
}

const IDLE: State = { phase: "loading", data: null, status: 0 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseUsage(body: unknown): HermesUsage {
  if (!isRecord(body)) return {};
  const tokens = isRecord(body.tokens) ? body.tokens : null;
  const cost = isRecord(body.cost) ? body.cost : null;
  const models = Array.isArray(body.by_model)
    ? body.by_model.filter(isRecord).map((row) => ({
        model: typeof row.model === "string" ? row.model : null,
        input_tokens: num(row.input_tokens),
        output_tokens: num(row.output_tokens),
      }))
    : null;
  const perEmployee = cost && Array.isArray(cost.per_employee)
    ? cost.per_employee.filter(isRecord).map((row) => ({
        employee_id: typeof row.employee_id === "string" ? row.employee_id : null,
        cost_usd: num(row.cost_usd),
        cost_status: typeof row.cost_status === "string" ? (row.cost_status as CostStatus) : null,
        rows: num(row.rows),
      }))
    : null;
  return {
    period_days: num(body.period_days) ?? undefined,
    tokens: tokens
      ? {
          total_input: num(tokens.total_input),
          total_output: num(tokens.total_output),
          total_cache_read: num(tokens.total_cache_read),
          total_reasoning: num(tokens.total_reasoning),
        }
      : null,
    by_model: models,
    cost: cost
      ? {
          source: typeof cost.source === "string" ? cost.source : null,
          cost_usd: num(cost.cost_usd),
          cost_status: typeof cost.cost_status === "string" ? (cost.cost_status as CostStatus) : null,
          rows: num(cost.rows),
          per_employee: perEmployee,
        }
      : null,
  };
}

function shortCode(value?: string | null): string {
  if (!value) return "—";
  const raw = value.replace(/^employee:/, "").replace(/^emp_/, "");
  const code = raw.replace(/[^0-9a-zA-Z]/g, "").slice(0, 8).toUpperCase();
  return code ? `员工 · ${code}` : "—";
}

function fmtInt(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US") : "—";
}

function money(value: number | null | undefined, status?: CostStatus | null): string {
  if (status === "unknown" || value === null || value === undefined || !Number.isFinite(value)) {
    return "未计价";
  }
  return `$${value.toFixed(2)}`;
}

const COST_STATUS_LABEL: Record<CostStatus, string> = {
  upstream: "账本实测",
  estimated: "含估算",
  mixed: "含估算",
  unknown: "未计价",
};

function Skeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="usage-skeleton">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="h-24 animate-pulse p-4" />
        </Card>
      ))}
    </div>
  );
}

function ErrorCard({
  state,
  title,
  onRetry,
}: {
  state: State;
  title: string;
  onRetry: () => void;
}) {
  const denied = state.phase === "denied";
  const Icon = denied ? ShieldAlert : TriangleAlert;
  return (
    <Card data-testid="usage-error">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-white/70" />
          <h2 className="text-base font-medium">{title}</h2>
        </div>
        <p className="text-sm text-white/60">
          {denied
            ? "该数据源尚未开放，或你没有查看权限。请确认后台已接入用量服务，或联系管理员开通权限。"
            : state.message || humanizeStatus(state.status)}
        </p>
        <p className="font-mono text-xs text-white/45">
          {state.requestId ? `请求编号：${state.requestId}` : "本次请求未记录编号，可复制时间与操作路径反馈"}
        </p>
        <div>
          <Button size="sm" outlined onClick={onRetry} data-testid="usage-retry">
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function UsagePage() {
  const [params] = useSearchParams();
  const forced = params.get("state");
  const rid = params.get("rid");
  const [state, setState] = useState<State>(IDLE);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, phase: "loading" }));
    (async () => {
      try {
        const body = await fetchJSON<unknown>("/agent-api/api/hermes-usage?days=30");
        if (cancelled) return;
        const data = parseUsage(body);
        const tokenValues = data.tokens
          ? [
              data.tokens.total_input,
              data.tokens.total_output,
              data.tokens.total_cache_read,
              data.tokens.total_reasoning,
            ]
          : [];
        const hasTokens = tokenValues.some((value) => typeof value === "number");
        const hasModels = Array.isArray(data.by_model) && data.by_model.length > 0;
        const hasCost = (data.cost?.rows ?? 0) > 0 || data.cost?.cost_usd !== null && data.cost?.cost_usd !== undefined;
        setState({
          phase: hasTokens || hasModels || hasCost ? "ready" : "empty",
          data,
          status: 200,
        });
      } catch (err) {
        if (cancelled) return;
        const api = err instanceof ApiError ? err : null;
        const status = api?.status ?? 0;
        const denied = status === 403 || status === 404;
        setState({
          phase: denied ? "denied" : "error",
          data: null,
          status,
          message: api?.message ?? (status === 0 ? "用量服务暂时不可达，请检查网络后重试。" : humanizeStatus(status)),
          requestId: api?.requestId ?? rid ?? undefined,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, rid]);

  const retry = useCallback(() => setReload((n) => n + 1), []);
  const data = state.data;
  const tokens = data?.tokens ?? null;
  const cost = data?.cost ?? null;
  const models = useMemo(
    () => (Array.isArray(data?.by_model) ? data.by_model : []),
    [data?.by_model],
  );

  const shown: Phase =
    forced === "loading" || forced === "empty" || forced === "error" || forced === "denied"
      ? forced
      : state.phase;

  if (shown === "loading") {
    return (
      <div className="space-y-4 p-4 md:p-6" data-testid="usage-page">
        <Skeleton />
      </div>
    );
  }

  if (shown === "error" || shown === "denied") {
    return (
      <div className="space-y-4 p-4 md:p-6" data-testid="usage-page">
        <ErrorCard
          state={{ ...state, phase: shown, requestId: state.requestId ?? rid ?? undefined }}
          title={shown === "denied" ? "用量数据暂不可见" : "用量数据没能加载出来"}
          onRetry={retry}
        />
      </div>
    );
  }

  if (shown === "empty") {
    return (
      <div className="space-y-4 p-4 md:p-6" data-testid="usage-page">
        <Card data-testid="usage-empty">
          <CardContent className="p-6">
            <h2 className="text-base font-medium">暂无用量记录</h2>
            <p className="mt-2 text-sm text-white/60">
              最近 30 天没有可读的用量或成本账目。用量源恢复后会在这里显示。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6" data-testid="usage-page">
      <div className="flex flex-wrap items-center gap-3">
        <Gauge className="h-5 w-5 text-white/70" />
        <h1 className="font-mondwest text-xl">用量与成本</h1>
        <span className="text-xs text-white/50">最近 {data?.period_days ?? 30} 天 · 金额仅来自成本账本</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-white/50">输入 Token</p>
            <p className="mt-2 text-2xl font-medium tabular-nums">{fmtInt(tokens?.total_input)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-white/50">输出 Token</p>
            <p className="mt-2 text-2xl font-medium tabular-nums">{fmtInt(tokens?.total_output)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-white/50">缓存读取</p>
            <p className="mt-2 text-2xl font-medium tabular-nums">{fmtInt(tokens?.total_cache_read)}</p>
          </CardContent>
        </Card>
        <Card data-testid="usage-cost">
          <CardContent className="p-4">
            <p className="text-xs text-white/50">成本（账本）</p>
            <p className="mt-2 text-2xl font-medium tabular-nums">
              {money(cost?.cost_usd, cost?.cost_status)}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {cost?.cost_status ? COST_STATUS_LABEL[cost.cost_status] : "成本状态未提供"}
              {typeof cost?.rows === "number" ? ` · ${cost.rows} 条账目` : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="usage-by-model">
        <CardContent className="p-0">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="text-sm font-medium">按模型</h2>
            <p className="mt-1 text-xs text-white/45">
              {models.length > 0 ? "用量源上报的模型明细；缺失字段显示 —" : "模型明细未提供（用量源降级或未接入）"}
            </p>
          </div>
          {models.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="text-xs text-white/45">
                    <th className="px-4 py-2 font-normal">模型</th>
                    <th className="px-4 py-2 font-normal">输入 Token</th>
                    <th className="px-4 py-2 font-normal">输出 Token</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((row, index) => (
                    <tr key={`${row.model ?? "unknown"}-${index}`} className="border-t border-white/8">
                      <td className="px-4 py-2">{row.model ?? "—"}</td>
                      <td className="px-4 py-2 tabular-nums">{fmtInt(row.input_tokens)}</td>
                      <td className="px-4 py-2 tabular-nums">{fmtInt(row.output_tokens)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-4 text-sm text-white/55">—</p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="usage-cost-rows">
        <CardContent className="p-0">
          <div className="border-b border-white/10 px-4 py-3">
            <h2 className="text-sm font-medium">账本明细</h2>
            <p className="mt-1 text-xs text-white/45">金额来自成本账本，按员工汇总；不做前端改价或求和。</p>
          </div>
          {Array.isArray(cost?.per_employee) && cost.per_employee.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="text-xs text-white/45">
                    <th className="px-4 py-2 font-normal">员工</th>
                    <th className="px-4 py-2 font-normal">账目</th>
                    <th className="px-4 py-2 font-normal">金额</th>
                    <th className="px-4 py-2 font-normal">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {cost.per_employee.map((row, index) => (
                    <tr key={`${row.employee_id ?? "unknown"}-${index}`} className="border-t border-white/8">
                      <td className="px-4 py-2" title={row.employee_id ?? undefined}>{shortCode(row.employee_id)}</td>
                      <td className="px-4 py-2 tabular-nums">{fmtInt(row.rows)}</td>
                      <td className="px-4 py-2 tabular-nums">{money(row.cost_usd, row.cost_status)}</td>
                      <td className="px-4 py-2">
                        <Badge tone={row.cost_status === "unknown" || row.cost_status == null ? "warning" : undefined}>
                          {row.cost_status ? COST_STATUS_LABEL[row.cost_status] : "未提供"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-4 text-sm text-white/55">— 账本暂无明细，金额不显示 0.00。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default UsagePage;