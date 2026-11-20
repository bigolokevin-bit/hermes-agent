import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox, RefreshCw, Search, ShieldAlert, TriangleAlert, Users } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";

import { RequestIdCopy } from "@/components/RequestIdCopy";

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
  department?: string | null;
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
      department: pickString(raw.department),
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

/** R62: the four sortable columns, keyed by what the screen actually shows. */
type SortKey = "name" | "code" | "state" | "time";

/** Sort value for a row. Missing/blank yields null so it sorts last — a
 * missing value is never coerced into 0 or an empty-first position. */
function sortValue(row: EmployeeRow, key: SortKey): string | null {
  if (key === "name") return row.name?.trim() || null;
  if (key === "code") return shortCode(row.employeeId);
  if (key === "state") return row.lifecycleState?.trim() || null;
  return row.updatedAt?.trim() || null;
}

/** R62: one header cell — a real button (Enter/Space native), aria-sort on
 * the columnheader, focus ring visible. */
function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onCycle,
  tip,
}: {
  label: string;
  sortKey: SortKey;
  active: string | null;
  dir: "asc" | "desc";
  onCycle: (key: SortKey) => void;
  tip: string;
}) {
  const isActive = active === sortKey;
  return (
    <span
      role="columnheader"
      aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className="min-w-0"
    >
      <button
        type="button"
        data-testid={`emp-list-sort-${sortKey}`}
        onClick={() => onCycle(sortKey)}
        title={tip}
        className="inline-flex min-w-0 items-center gap-1 rounded-sm hover:text-white/75 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/50"
      >
        {label}
        {isActive ? (
          dir === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden="true" />
        )}
      </button>
    </span>
  );
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
      // 未识别的状态不猜：与其余面一致的「待核实」。
      return "待核实";
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



/** 最近活跃口径：上游只有 updatedAt，按北京时间切到分；缺值不假造。 */
function beijingMinute(value?: string | null): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms + 480 * 60_000);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** R40: rid 兜底从 window.location 实读（search 与 hash 两个容器都查），
 * 这样即使壳层在覆盖强制态 URL 时把 rid 参数从 router 快照里洗掉，模块
 * 仍然能真读到 QA 给的编号；取不到就交给 fallback 句，绝不编造。 */
function liveRid(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  const cut = hash.indexOf("?");
  for (const src of [window.location.search, cut === -1 ? "" : hash.slice(cut)]) {
    if (!src) continue;
    const v = new URLSearchParams(src).get("rid");
    if (v) return v;
  }
  return null;
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
  const [params, setParams] = useSearchParams();
  const forced = params.get("state");
  const forcedRid = params.get("rid") ?? params.get("requestId") ?? liveRid();
  // URL is the single source of truth (?q=&lifecycle=): a refresh or a back
  // step reopens exactly the same answer.
  const q = params.get("q") ?? "";
  const lifecycle = params.get("lifecycle") ?? "";
  const [keyword, setKeyword] = useState(q);
  const [debounced, setDebounced] = useState(q);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<State>({ phase: "loading", items: [], status: 0 });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(keyword.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  // Keep the local inputs aligned with the URL (back/forward, shared links).
  useEffect(() => {
    setKeyword(q);
    setDebounced(q);
  }, [q]);

  const patchParams = (next: Record<string, string | null>) => {
    const draft = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") draft.delete(k);
      else draft.set(k, v);
    }
    setParams(draft, { replace: true });
  };

  useEffect(() => {
    if (debounced !== q) patchParams({ q: debounced || null });
  }, [debounced]);

  useEffect(() => {
    if (forced === "loading" || forced === "empty" || forced === "error" || forced === "denied") {
      setState({
        phase: forced,
        items: [],
        status: forced === "denied" ? 403 : forced === "error" ? 502 : 0,
        message: forced === "error" ? humanizeStatus(502) : undefined,
        // state 与 rid 同源读取（同一 params 快照），见下方 forcedRid 依赖。
        requestId: forced === "error" ? (forcedRid ?? "preview-request") : undefined,
      });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, phase: "loading" }));
    const query = new URLSearchParams();
    query.set("limit", String(PAGE_SIZE));
    query.set("expand", "version,knowledge");
    if (q) query.set("keyword", q);
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
  }, [q, lifecycle, reload, forced, forcedRid]);

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

  const filtered = Boolean(q || lifecycle);

  // R62: column sorting. Measured GET /api/employees with sort=name&order=desc,
  // sortBy=lifecycleState or sort=createdAt&dir=asc all return the same order
  // (200, same 3 rows) — the read port ignores sort parameters. To avoid
  // pretending a server sort, only the loaded rows are ordered locally and the
  // scope is stated above the table.
  const sort = params.get("sort");
  const dir: "asc" | "desc" = params.get("dir") === "desc" ? "desc" : "asc";
  const sortActive = sort === "name" || sort === "code" || sort === "state" || sort === "time";
  const cycleSort = (key: SortKey) => {
    if (sort !== key) patchParams({ sort: key, dir: "asc" });
    else if (dir === "asc") patchParams({ sort: key, dir: "desc" });
    else patchParams({ sort: null, dir: null });
  };
  const sortedItems = useMemo(() => {
    if (!sortActive) return state.items;
    const key = sort as SortKey;
    const factor = dir === "desc" ? -1 : 1;
    return [...state.items].sort((a, b) => {
      const va = sortValue(a, key);
      const vb = sortValue(b, key);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return va.localeCompare(vb, "zh-Hans-CN") * factor;
    });
  }, [state.items, sort, sortActive, dir]);
  const retry = () => setReload((n) => n + 1);

  return (
    <section className="space-y-4" data-testid="employees-module">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-white/70" />
          <h1 className="font-mondwest text-xl">数字员工</h1>
          {state.phase === "ready" ? (
            <span className="text-sm text-white/50" data-testid="emp-list-count" title="计数与列表同源：同一份服务端返回的行数">
              {state.items.length}
            </span>
          ) : null}
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
          <span data-testid="emp-l-search" className="contents">
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
          </span>
          <span data-testid="emp-l-filter-lifecycle" className="contents">
          <select
            value={lifecycle}
            onChange={(e) => patchParams({ lifecycle: e.target.value || null })}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
            data-testid="employees-lifecycle"
          >
            <option value="">全部</option>
            <option value="active">在岗</option>
            <option value="paused">暂停</option>
            <option value="suspended">停用</option>
          </select>
          </span>
          {filtered ? (
            <Button
              size="sm"
              outlined
              onClick={() => {
                setKeyword("");
                setDebounced("");
                patchParams({ q: null, lifecycle: null });
              }}
              data-testid="employees-clear"
            >
              清除筛选
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* R53: the read port filters for real on keyword/lifecycleState
          (measured: bare 200/3, keyword=QA2 200/1, lifecycleState=active
          200/2; q/query/name are NOT whitelisted — all answer 200/3). */}
      <p className="text-xs text-white/45" data-testid="emp-list-scope-note" title="白名单参数 keyword、lifecycleState 由服务端过滤；q/query/name 不被该读口接受（实测均返回全量），因此不存在本地过滤口径，也不会为搜索补发额外请求。">
        关键字与在职态筛选走服务端真参数（命中数与本页计数同源）；不是「仅在当前已加载 N 人内搜索」的本地过滤。
      </p>

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
            <Button size="sm" outlined onClick={retry} data-testid="employees-denied-retry">
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
              <RequestIdCopy
                requestId={state.requestId}
                fallback="本次请求未记录编号，可复制时间与操作路径反馈"
              />
            </p>
            <Button size="sm" outlined onClick={retry} data-testid="employees-error-retry">
              <RefreshCw className="mr-2 h-4 w-4" />
              重试
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {state.phase === "empty" ? (
        <Card data-testid="employees-empty" data-emp-list-empty="true">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Inbox className="h-6 w-6 text-white/40" />
            <p className="text-sm" data-testid="emp-list-empty-text">{filtered ? "没有匹配的员工" : "还没有数字员工"}</p>
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
                  patchParams({ q: null, lifecycle: null });
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
            <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.8fr)] gap-2 border-b border-white/10 px-4 py-2 text-xs text-white/45 md:grid">
              <SortHeader label="员工" sortKey="name" active={sort} dir={dir} onCycle={cycleSort} tip="按姓名排序（本地：仅当前已加载行）" />
              <SortHeader label="短码" sortKey="code" active={sort} dir={dir} onCycle={cycleSort} tip="按工号短码排序（本地：仅当前已加载行）" />
              <SortHeader label="状态" sortKey="state" active={sort} dir={dir} onCycle={cycleSort} tip="按在职态原始值排序（本地：仅当前已加载行）" />
              <span>部门</span>
              <SortHeader label="最近活跃" sortKey="time" active={sort} dir={dir} onCycle={cycleSort} tip="口径：上游只返回记录更新时间 updatedAt，按北京时间切到分；排序为本地，仅当前已加载行。列表读口不回传创建时间，故不提供“创建时间”假列。" />
              <span>知识</span>
              <span>月度预算</span>
            </div>
            <p
              className="border-b border-white/5 px-4 py-1.5 text-xs text-white/45"
              data-testid="emp-list-sort-scope-note"
              title="实测：GET /api/employees 带 sort=name&order=desc、sortBy=lifecycleState、sort=createdAt&dir=asc 任一参数，均返回同一顺序的同一全量（200，3 条）——后台读口不支持排序参数。为避免假的服务端排序，这里只对已加载行做本地排序。"
            >
              排序仅在当前已加载 {state.items.length} 条内生效（本地排序；后台排序参数实测被忽略，不是全量排序）。
            </p>
            <ul className="divide-y divide-white/5" data-testid="emp-l-list" data-emp-list-rows="true">
              {sortedItems.map((row) => (
                <li key={row.employeeId} data-testid={`employees-row-${row.employeeId}`}>
                  <span data-testid={`emp-l-row-${row.employeeId}`} className="contents">
                  <Link
                    to={`/employees/${encodeURIComponent(row.employeeId)}`}
                    data-testid={`emp-l-name-link-${row.employeeId}`}
                    className="grid grid-cols-1 gap-1 px-4 py-3 hover:bg-white/5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.8fr)] md:items-center md:gap-2"
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
                    <span
                      className="min-w-0 truncate text-xs text-white/55"
                      data-label="部门"
                      title={row.department ? undefined : "上游响应没有带部门信息"}
                    >
                      {row.department ?? "—"}
                    </span>
                    <span
                      className="min-w-0 truncate font-mono text-xs text-white/55"
                      data-label="最近活跃"
                      title="口径：记录更新时间 updatedAt（北京时间）"
                    >
                      {beijingMinute(row.updatedAt) ?? "—"}
                    </span>
                    <span className="text-xs text-white/55" data-label="知识">
                      {row.enrichment?.knowledgeCount ?? "—"}
                    </span>
                    <span className="text-xs text-white/55" data-label="月度预算">
                      {money(row.enrichment?.effectiveBudget?.monthlyCostUsd)}
                    </span>
                  </Link>
                  </span>
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