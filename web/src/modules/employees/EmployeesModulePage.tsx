import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Inbox, RefreshCw, Search, ShieldAlert, TriangleAlert, Users } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";

import { fetchJSON } from "@/lib/api";
import { API_UNREACHABLE_MESSAGE, ApiError, humanizeStatus } from "@/lib/api-error";

/** T12 · employee list module (`#/employees`). Read-only. */

type Budget = {
  monthlyCostUsd?: number | null;
};

type EmployeeRow = {
  employeeId: string;
  name?: string | null;
  title?: string | null;
  lifecycleState?: string | null;
  ownerUserId?: string | null;
  updatedAt?: string | null;
  enrichment?: {
    currentVersionNo?: number | null;
    knowledgeCount?: number | null;
    effectiveBudget?: Budget | null;
  } | null;
};

type Phase = "loading" | "ready" | "empty" | "error" | "denied";

type State = {
  phase: Phase;
  items: EmployeeRow[];
  status: number;
  message?: string;
  requestId?: string;
};

const PAGE_SIZE = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function pickNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readRows(body: unknown): EmployeeRow[] {
  if (!isRecord(body) || !Array.isArray(body.items)) return [];
  const rows: EmployeeRow[] = [];
  for (const raw of body.items) {
    if (!isRecord(raw)) continue;
    const id = pickString(raw.employeeId);
    if (!id) continue;
    const enrichment = isRecord(raw.enrichment) ? raw.enrichment : null;
    const budget = enrichment && isRecord(enrichment.effectiveBudget) ? enrichment.effectiveBudget : null;
    rows.push({
      employeeId: id,
      name: pickString(raw.name),
      title: pickString(raw.title),
      lifecycleState: pickString(raw.lifecycleState),
      ownerUserId: pickString(raw.ownerUserId),
      updatedAt: pickString(raw.updatedAt),
      enrichment: enrichment
        ? {
            currentVersionNo: pickNumber(enrichment.currentVersionNo),
            knowledgeCount: pickNumber(enrichment.knowledgeCount),
            effectiveBudget: budget ? { monthlyCostUsd: pickNumber(budget.monthlyCostUsd) } : null,
          }
        : null,
    });
  }
  return rows;
}

function shortCode(id: string): string {
  const tail = id.replace(/^emp_/i, "").replace(/[^0-9a-z]/gi, "").slice(0, 8).toUpperCase();
  return tail || "—";
}

function displayName(row: EmployeeRow): string {
  return row.name?.trim() || "未命名员工";
}

function lifecycleLabel(value?: string | null): string {
  switch (value) {
    case "active":
      return "在岗";
    case "onboarding":
      return "入职中";
    case "paused":
      return "已暂停";
    case "suspended":
      return "已停用";
    case "offboarding":
      return "离职中";
    case "draft":
      return "草稿";
    case "archived":
      return "已归档";
    default:
      return "未知";
  }
}

function lifecycleTone(value?: string | null): "success" | "warning" | undefined {
  if (value === "active") return "success";
  if (value === "paused" || value === "suspended") return "warning";
  return undefined;
}

const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return USD_FMT.format(value);
}



function errorState(err: unknown): State {
  const api = err instanceof ApiError ? err : null;
  const status = api?.status ?? 0;
  const denied = status === 403 || status === 404;
  return {
    phase: denied ? "denied" : "error",
    items: [],
    status,
    message: api?.message || (status ? humanizeStatus(status) : API_UNREACHABLE_MESSAGE),
    requestId: (api as unknown as { requestId?: string } | null)?.requestId,
  };
}

export function EmployeesModulePage() {
  const [params] = useSearchParams();
  const forced = params.get("state");
  const [keyword, setKeyword] = useState("");
  const [debounced, setDebounced] = useState("");
  const [lifecycle, setLifecycle] = useState("");
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<State>({ phase: "loading", items: [], status: 0 });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(keyword.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    if (forced === "loading" || forced === "empty" || forced === "error" || forced === "denied") {
      setState({
        phase: forced,
        items: [],
        status: forced === "denied" ? 403 : forced === "error" ? 502 : 0,
        message: forced === "error" ? humanizeStatus(502) : undefined,
        requestId: forced === "error" ? (params.get("rid") ?? "preview-request") : undefined,
      });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, phase: "loading" }));
    const query = new URLSearchParams();
    query.set("limit", String(PAGE_SIZE));
    query.set("expand", "version,knowledge");
    if (debounced) query.set("keyword", debounced);
    if (lifecycle) query.set("lifecycleState", lifecycle);
    fetchJSON<unknown>(`/agent-api/api/employees?${query.toString()}`)
      .then((body) => {
        if (cancelled) return;
        const items = readRows(body);
        setState({ phase: items.length ? "ready" : "empty", items, status: 200 });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState(errorState(err));
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, lifecycle, reload, forced, params]);

  const counts = useMemo(() => {
    let active = 0;
    let limited = 0;
    let paused = 0;
    for (const row of state.items) {
      if (row.lifecycleState === "active") active += 1;
      else if (row.lifecycleState === "paused" || row.lifecycleState === "suspended") paused += 1;
      else limited += 1;
    }
    return { active, limited, paused };
  }, [state.items]);

  const filtered = Boolean(keyword.trim() || lifecycle);
  const retry = () => setReload((n) => n + 1);

  return (
    <section className="space-y-4" data-testid="employees-module">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-white/70" />
          <h1 className="font-mondwest text-xl">数字员工</h1>
          {state.phase === "ready" ? <span className="text-sm text-white/50">{state.items.length}</span> : null}
        </div>
        <Button size="sm" outlined onClick={retry} data-testid="employees-refresh">
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="employees-summary">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-white/50">在岗 / 受限 / 暂停</p>
            <p className="mt-1 text-sm" data-testid="status">
              {counts.active} · {counts.limited} · {counts.paused}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-white/50">下一步</p>
            <p className="mt-1 text-sm" data-testid="next-action">
              {counts.paused > 0 ? "处理暂停或停用的员工" : "查看员工明细"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-white/50">责任人</p>
            <p className="mt-1 text-sm" data-testid="owner">
              各部门负责人
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <label className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-white/40" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索姓名或岗位"
              className="w-full rounded-md border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm outline-none"
              data-testid="employees-search"
            />
          </label>
          <select
            value={lifecycle}
            onChange={(e) => setLifecycle(e.target.value)}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
            data-testid="employees-lifecycle"
          >
            <option value="">全部</option>
            <option value="active">在岗</option>
            <option value="paused">暂停</option>
            <option value="suspended">停用</option>
          </select>
          {filtered ? (
            <Button
              size="sm"
              outlined
              onClick={() => {
                setKeyword("");
                setDebounced("");
                setLifecycle("");
              }}
              data-testid="employees-clear"
            >
              清除筛选
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {state.phase === "loading" ? (
        <Card data-testid="employees-loading">
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-white/5" />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {state.phase === "denied" ? (
        <Card data-testid="employees-denied">
          <CardContent className="flex flex-col items-start gap-3 p-5">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            <p className="text-sm">员工列表暂不可见</p>
            <p className="text-xs text-white/55">
              该数据源尚未开放，或你没有查看权限。请确认后台已接入对应服务，或联系管理员开通权限。
            </p>
            <Button size="sm" outlined onClick={retry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              重试
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {state.phase === "error" ? (
        <Card data-testid="employees-error">
          <CardContent className="flex flex-col items-start gap-3 p-5">
            <TriangleAlert className="h-5 w-5 text-amber-400" />
            <p className="text-sm">员工列表没能加载出来</p>
            <p className="text-xs text-white/55">{state.message || humanizeStatus(state.status)}</p>
            <p className="font-mono text-xs text-white/45">
              {state.requestId ? `请求编号：${state.requestId}` : "本次请求未记录编号，可复制时间与操作路径反馈"}
            </p>
            <Button size="sm" outlined onClick={retry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              重试
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {state.phase === "empty" ? (
        <Card data-testid="employees-empty">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Inbox className="h-6 w-6 text-white/40" />
            <p className="text-sm">{filtered ? "没有匹配的员工" : "还没有数字员工"}</p>
            <p className="text-xs text-white/50">
              {filtered ? "换个关键词或放宽筛选条件后再试。" : "员工创建后会出现在这里。"}
            </p>
            {filtered ? (
              <Button
                size="sm"
                outlined
                onClick={() => {
                  setKeyword("");
                  setDebounced("");
                  setLifecycle("");
                }}
              >
                清除筛选
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {state.phase === "ready" ? (
        <Card data-testid="employees-table">
          <CardContent className="p-0">
            <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.8fr)] gap-2 border-b border-white/10 px-4 py-2 text-xs text-white/45 md:grid">
              <span>员工</span>
              <span>短码</span>
              <span>状态</span>
              <span>知识</span>
              <span>月度预算</span>
            </div>
            <ul className="divide-y divide-white/5">
              {state.items.map((row) => (
                <li key={row.employeeId} data-testid={`employees-row-${row.employeeId}`}>
                  <Link
                    to={`/employees/${encodeURIComponent(row.employeeId)}`}
                    className="grid grid-cols-1 gap-1 px-4 py-3 hover:bg-white/5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.8fr)] md:items-center md:gap-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{displayName(row)}</span>
                      <span className="block truncate text-xs text-white/45">{row.title?.trim() || "岗位未提供"}</span>
                    </span>
                    <span
                      className="font-mono text-xs text-white/60"
                      title={row.employeeId}
                      data-testid={`employees-code-${row.employeeId}`}
                    >
                      员工 · {shortCode(row.employeeId)}
                    </span>
                    <span>
                      <Badge tone={lifecycleTone(row.lifecycleState)}>{lifecycleLabel(row.lifecycleState)}</Badge>
                    </span>
                    <span className="text-xs text-white/55" data-label="知识">
                      {row.enrichment?.knowledgeCount ?? "—"}
                    </span>
                    <span className="text-xs text-white/55" data-label="月度预算">
                      {money(row.enrichment?.effectiveBudget?.monthlyCostUsd)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

export default EmployeesModulePage;