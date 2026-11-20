import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Inbox, RefreshCw, Search, ShieldAlert, TriangleAlert, Users } from "lucide-react";
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
  /** R58: cursor/total read from the payload top level (no total key -> stated
    * honestly; never extrapolated from loaded rows). */
  nextCursor: string | null;
  total: number | null;
  loadingMore: boolean;
};

const PAGE_SIZE = 50;

/** R81: 「未标注部门」桶的 URL 键（真实部门名不会等于它）。 */
const NONE_DEPT = "__none__";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function pickNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readRows(body: unknown): { rows: EmployeeRow[]; nextCursor: string | null; total: number | null } {
  if (!isRecord(body) || !Array.isArray(body.items)) return { rows: [], nextCursor: null, total: null };
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
  const nextRaw = body.nextCursor ?? body.next_cursor;
  const nextCursor = typeof nextRaw === "string" && nextRaw.trim() ? nextRaw : null;
  const total = pickNumber(body.total ?? body.count);
  return { rows, nextCursor, total };
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

export function lifecycleLabel(value?: string | null): string {
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
    nextCursor: null,
    total: null,
    loadingMore: false,
  };
}

/** R63/R68: a missing field is stated, never invented. Shared with the
 * detail identity card so both surfaces use ONE wording source (parity). */
export const FIELD_MISSING = "该字段未返回";
/** R68: the hover reason for any missing field, list or detail alike. */
export const FIELD_MISSING_TITLE = "读口没有回传该字段。";
/** R68: 「label：该字段未返回」 one-line form. */
export function fieldMissing(label: string): string {
  return `${label}：${FIELD_MISSING}`;
}

/** R63: inline row preview — built only from the list row already loaded,
 * so expanding never fires a request. Same shape as apv9's preview. */
function RowPreview({ row }: { row: EmployeeRow }) {
  const missing = (label: string) => `${label}：${FIELD_MISSING}`;
  return (
    <div
      data-testid={`emp-row-preview-${row.employeeId}`}
      role="region"
      aria-label="行内预览"
      className="border-t border-white/5 px-4 pb-3 pt-2 text-xs"
    >
      <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
        <div className="flex min-w-0 gap-1.5">
          <dt className="shrink-0 text-white/40">姓名</dt>
          <dd className="min-w-0 truncate" title={row.name?.trim() ? undefined : FIELD_MISSING_TITLE}>
            {row.name?.trim() ?? FIELD_MISSING}
          </dd>
        </div>
        <div className="flex min-w-0 gap-1.5">
          <dt className="shrink-0 text-white/40">工号短码</dt>
          <dd className="min-w-0 truncate font-mono" title={row.employeeId}>
            员工 · {shortCode(row.employeeId)}
          </dd>
        </div>
        <div className="flex min-w-0 gap-1.5">
          <dt className="shrink-0 text-white/40">在职态</dt>
          <dd className="min-w-0 truncate" title={row.lifecycleState?.trim() ? `原始值：${row.lifecycleState}` : FIELD_MISSING_TITLE}>
            {lifecycleLabel(row.lifecycleState)}
          </dd>
        </div>
        <div className="flex min-w-0 gap-1.5">
          <dt className="shrink-0 text-white/40">角色/职称</dt>
          <dd className="min-w-0 truncate" title={row.title?.trim() ? undefined : FIELD_MISSING_TITLE}>
            {row.title?.trim() ?? FIELD_MISSING}
          </dd>
        </div>
        <div className="flex min-w-0 gap-1.5">
          <dt className="shrink-0 text-white/40">最近活跃</dt>
          <dd className="min-w-0 truncate font-mono" title={beijingMinute(row.updatedAt) ? "口径：updatedAt，北京时间到分。" : FIELD_MISSING_TITLE}>
            {beijingMinute(row.updatedAt) ?? FIELD_MISSING}
          </dd>
        </div>
        <div className="flex min-w-0 gap-1.5">
          <dt className="shrink-0 text-white/40">请求编号</dt>
          <dd className="min-w-0">
            <RequestIdCopy requestId={null} fallback={missing("请求编号")} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * R64: 复制列表为纯文本。值逐字取屏上（短码/人话/BJT 到分），
 * 只读已加载行、零额外请求；口径写明「当前已加载 N 人」，禁冒充全量。
 * ------------------------------------------------------------------ */

const COPY_HEADER = "name,employee_no,lifecycle,last_active";

/** RFC4180：含逗号/引号/换行的值加引号，内部引号双写。 */
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** 屏上行序（sortedItems 已含当前排序）逐行拼表；缺值「—」不补 0。 */
function buildEmployeesCopyText(rows: EmployeeRow[]): { text: string; count: number } {
  const lines = rows.map((row) =>
    [
      csvCell(displayName(row)),
      csvCell(`员工 · ${shortCode(row.employeeId)}`),
      csvCell(lifecycleLabel(row.lifecycleState)),
      csvCell(beijingMinute(row.updatedAt) ?? "—"),
    ].join(","),
  );
  return { text: [COPY_HEADER, ...lines].join("\n"), count: lines.length };
}

/** R69: 非 ready 态下计数位与复制/导出/加载更多统一的原因句。 */
function phaseReason(phase: Phase): string | null {
  switch (phase) {
    case "loading":
      return "加载中：没有可计数的行，这里以「—」占位而不是 0。";
    case "denied":
      return "没有查看权限（或读口未接入）：计数不作 0 处理，也不提供复制/导出/续取。";
    case "error":
      return "列表没能加载：计数不作 0 处理，也不提供复制/导出/续取。";
    case "empty":
      return "读口如实返回 0 人（真实空集）：计数位沿用「—」约定，不是缺数。";
    default:
      return null;
  }
}

function ListCopyButton({ rows, totalLoaded, phase }: { rows: EmployeeRow[]; totalLoaded: number; phase: Phase }) {
  const [status, setStatus] = useState<"idle" | "done" | "failed">("idle");
  const { text, count } = useMemo(() => buildEmployeesCopyText(rows), [rows]);
  const empty = rows.length === 0;
  const copy = () => {
    const write = navigator.clipboard?.writeText;
    if (!write) {
      setStatus("failed");
      return;
    }
    write.call(navigator.clipboard, text).then(
      () => setStatus("done"),
      () => setStatus("failed"),
    );
  };
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label="复制列表">
      <Button
        size="sm"
        outlined
        data-testid="emp-list-copy"
        disabled={empty || phase !== "ready"}
        onClick={copy}
        title={
          phase !== "ready"
            ? `不能复制：${phaseReason(phase)}`
            : empty
              ? "当前已加载 0 人：没有可复制的行。"
              : `按当前排序与筛选后的屏上行序复制；范围=当前已加载 ${totalLoaded} 人，不是全量；零额外请求。`
        }
      >
        复制列表
      </Button>
      <span data-testid="emp-list-copy-status" aria-live="polite" className="text-xs text-white/55">
        {status === "done" ? `已复制 ${count} 行` : status === "failed" ? "剪贴板写入被拒绝，可用下方文本框手动复制。" : ""}
      </span>
      {status === "failed" ? (
        <textarea
          data-testid="emp-list-copy-fallback"
          readOnly
          rows={4}
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full min-w-0 rounded-sm border border-white/15 bg-transparent p-2 font-mono text-xs"
          aria-label="复制内容兜底文本框"
          title="内容与点击复制的目标逐字相同；手动选择后复制。"
        />
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * R66: 导出 CSV。纯前端 Blob + a.download，零新端点；行与 emp-list-copy
 * 同一屏上来源（sortedItems）；last_active 缺值=空字段（禁「—」禁 0）；
 * 口径写明「导出当前已加载 N 人，不是全量」。
 * ------------------------------------------------------------------ */

/** 文件名时刻=导出时刻的北京时间（本机时钟只进文件名，不进数据列）。 */
export function csvTimestamp(now: Date): string {
  const bj = new Date(now.getTime() + 480 * 60000);
  const iso = bj.toISOString();
  return `employees-${iso.slice(0, 10).replace(/-/g, "")}-${iso.slice(11, 16).replace(":", "")}.csv`;
}

export function buildEmployeesCsv(rows: EmployeeRow[]): string {
  const lines = rows.map(
    (row) =>
      [
        csvCell(displayName(row)),
        csvCell(`员工 · ${shortCode(row.employeeId)}`),
        csvCell(lifecycleLabel(row.lifecycleState)),
        csvCell(beijingMinute(row.updatedAt) ?? ""),
      ].join(","),
  );
  // BOM 让 Excel 认中文；RFC4180 行尾 CRLF。
  return `\uFEFF${[COPY_HEADER, ...lines].join("\r\n")}\r\n`;
}

function ListExportButton({ rows, totalLoaded, phase }: { rows: EmployeeRow[]; totalLoaded: number; phase: Phase }) {
  const empty = rows.length === 0;
  const exportCsv = () => {
    if (typeof URL.createObjectURL !== "function") return;
    const blob = new Blob([buildEmployeesCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvTimestamp(new Date());
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label="导出 CSV">
      <Button
        size="sm"
        outlined
        data-testid="emp-list-export"
        disabled={empty || phase !== "ready"}
        onClick={exportCsv}
        title={
          phase !== "ready"
            ? `不能导出：${phaseReason(phase)}`
            : empty
              ? "当前已加载 0 人：没有可导出的行。"
              : `导出当前已加载 ${totalLoaded} 人，不是全量；行序与屏上一致，纯前端生成零新端点。`
        }
      >
        导出 CSV
      </Button>
      <span data-testid="emp-list-export-count" className="text-xs text-white/55" title="行数与屏上列表同源">
        共 {rows.length} 行
      </span>
    </span>
  );
}

export function EmployeesModulePage() {
  const [params, setParams] = useSearchParams();
  const forced = params.get("state");
  const forcedRid = params.get("rid") ?? params.get("requestId") ?? liveRid();
  // URL is the single source of truth (?q=&lifecycle=): a refresh or a back
  // step reopens exactly the same answer.
  const q = params.get("q") ?? "";
  const lifecycle = params.get("lifecycle") ?? "";
  // R81: 部门是本地维度——读口实测 department=/dept= 丢参（三组同集合），
  // ?dept= 只作用在已加载行上，切换不发请求、不污染服务端游标。
  const dept = params.get("dept");
  const [keyword, setKeyword] = useState(q);
  const [debounced, setDebounced] = useState(q);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<State>({ phase: "loading", items: [], status: 0, nextCursor: null, total: null, loadingMore: false });
  // R63: at most one row carries the inline preview (page-local state:
  // the URL is untouched and a reload collapses everything back).
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  // R67: roving tabindex — 行级只有一个 tab 位；↑/↓/Home/End 移焦，
  // Enter 展开该行预览（拦截跳转），Esc 收起并把焦点还给该行。
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLAnchorElement>());
  const focusRow = (id: string | undefined) => {
    if (!id) return;
    rowRefs.current.get(id)?.focus();
    setActiveRowKey(id);
  };

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
        nextCursor: null,
        total: null,
        loadingMore: false,
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
        const parsed = readRows(body);
        setState({
          phase: parsed.rows.length ? "ready" : "empty",
          items: parsed.rows,
          status: 200,
          nextCursor: parsed.nextCursor,
          total: parsed.total,
          loadingMore: false,
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState((prev) => ({ ...errorState(err), items: prev.items }));
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

  const filtered = Boolean(q || lifecycle || dept);

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
  // R81: 部门分桶从已加载行现算；缺部门的行归「未标注部门」一桶并计数。
  const deptBuckets = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of state.items) {
      const key = row.department?.trim() || NONE_DEPT;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"),
    );
  }, [state.items]);
  const visibleItems = useMemo(
    () =>
      dept === null
        ? sortedItems
        : sortedItems.filter((row) => (row.department?.trim() || NONE_DEPT) === dept),
    [sortedItems, dept],
  );

  const retry = () => setReload((n) => n + 1);

  // R58: real cursor paging. Same filter query plus the server's nextCursor;
  // appended rows are deduplicated by employeeId (never repeat a row).
  const loadMore = () => {
    if (state.phase !== "ready" || !state.nextCursor || state.loadingMore) return;
    const query = new URLSearchParams();
    query.set("limit", String(PAGE_SIZE));
    query.set("expand", "version,knowledge");
    if (q) query.set("keyword", q);
    if (lifecycle) query.set("lifecycleState", lifecycle);
    query.set("cursor", state.nextCursor);
    setState((prev) => ({ ...prev, loadingMore: true }));
    fetchJSON<unknown>(`/agent-api/api/employees?${query.toString()}`)
      .then((body) => {
        const parsed = readRows(body);
        setState((prev) => {
          const seen = new Set(prev.items.map((row) => row.employeeId));
          const fresh = parsed.rows.filter((row) => !seen.has(row.employeeId));
          return {
            ...prev,
            phase: "ready",
            items: [...prev.items, ...fresh],
            nextCursor: parsed.nextCursor,
            total: parsed.total ?? prev.total,
            loadingMore: false,
          };
        });
      })
      .catch((err: unknown) => setState((prev) => ({ ...errorState(err), items: prev.items })));
  };

  return (
    <section className="space-y-4" data-testid="employees-module">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-white/70" />
          <h1 className="font-mondwest text-xl">数字员工</h1>
          <span
            className="text-sm text-white/50"
            data-testid="emp-list-count"
            title={
              state.phase === "ready"
                ? "计数与列表同源：当前屏上行数（服务端返回经本地部门过滤）"
                : phaseReason(state.phase) ?? undefined
            }
          >
            {state.phase === "ready" ? visibleItems.length : "—"}
          </span>
        </div>
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <ListCopyButton rows={visibleItems} totalLoaded={state.items.length} phase={state.phase} />
          <ListExportButton rows={visibleItems} totalLoaded={state.items.length} phase={state.phase} />
          <Button size="sm" outlined onClick={retry} data-testid="employees-refresh">
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
        </span>
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
          <div
            className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs"
            role="group"
            aria-label="部门"
            data-testid="emp-list-dept-rail"
          >
            <span className="text-muted-foreground">部门：</span>
            <button
              type="button"
              data-testid="emp-list-dept-all"
              aria-pressed={dept === null}
              disabled={state.phase !== "ready"}
              title={state.phase === "ready" ? "显示全部部门" : `不能按部门筛选：${phaseReason(state.phase)}；恢复列表后自动可用。`}
              onClick={() => patchParams({ dept: null })}
              className="h-6 min-w-0 rounded-md border border-white/15 px-2 hover:bg-white/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              全部
            </button>
            {deptBuckets.map(([key, count], i) => (
              <button
                key={key}
                type="button"
                data-testid={`emp-list-dept-${i}`}
                aria-pressed={dept === key}
                disabled={state.phase !== "ready"}
                title={
                  state.phase !== "ready"
                    ? `不能按部门筛选：${phaseReason(state.phase)}；恢复列表后自动可用。`
                    : key === NONE_DEPT
                      ? "只看没有部门信息的行（本地过滤，不发新请求）"
                      : `筛选部门「${key}」（本地过滤，不发新请求）`
                }
                onClick={() => patchParams({ dept: dept === key ? null : key })}
                className="h-6 min-w-0 max-w-full truncate rounded-md border border-white/15 px-2 hover:bg-white/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {key === NONE_DEPT ? "未标注部门" : key}{" "}
                <b className="font-mono">{state.phase === "ready" ? count : "—"}</b>
              </button>
            ))}
          </div>
          <p
            className="min-w-0 break-words text-xs text-muted-foreground"
            data-testid="emp-list-dept-scope-note"
            title="实测 GET /api/employees 带 department= 或 dept= 都返回同一全量（200，3 条同集合），后台不做部门过滤；为避免假筛选，这里只对已加载的行做前端本地过滤，切换不产生新请求、也不影响服务端游标。"
          >
            按当前已加载 {state.items.length} 人统计，不是全量；部门切换是前端本地过滤，不发新请求。
          </p>
          {filtered ? (
            <Button
              size="sm"
              outlined
              onClick={() => {
                setKeyword("");
                setDebounced("");
                patchParams({ q: null, lifecycle: null, dept: null });
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

      {/* R69: 四态+分页条统一容器，data-phase 供自动化锁定当前态。 */}
      <div className="space-y-4" data-testid="emp-list-state" data-phase={state.phase}>
      {state.phase === "loading" ? (
        <Card data-testid="employees-loading">
          <CardContent className="space-y-2 p-4" data-testid="emp-list-state-loading">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-white/5" />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {state.phase === "denied" ? (
        <Card data-testid="employees-denied">
          <CardContent className="flex flex-col items-start gap-3 p-5" data-testid="emp-list-state-denied">
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
        <Card data-testid="employees-error" data-emp-list-page-error="true">
          <CardContent className="flex flex-col items-start gap-3 p-5" data-testid="emp-list-state-error">
            <TriangleAlert className="h-5 w-5 text-amber-400" />
            <p className="text-sm">员工列表没能加载出来</p>
            <p className="text-xs text-white/55">{state.message || humanizeStatus(state.status)}</p>
            <p className="font-mono text-xs text-white/45" data-testid="emp-list-state-rid">
              <RequestIdCopy
                requestId={state.requestId}
                fallback="本次请求未记录编号，可复制时间与操作路径反馈"
              />
            </p>
            <span data-testid="emp-list-state-retry">
              <Button size="sm" outlined onClick={retry} data-testid="employees-error-retry">
                <RefreshCw className="mr-2 h-4 w-4" />
                重试
              </Button>
            </span>
          </CardContent>
        </Card>
      ) : null}

      {state.phase === "empty" ? (
        <Card data-testid="employees-empty" data-emp-list-empty="true">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center" data-testid="emp-list-state-empty">
            <Inbox className="h-6 w-6 text-white/40" />
            <p className="text-sm" data-testid="emp-list-empty-text"><span data-testid="emp-list-state-empty-text">{filtered ? "没有匹配的员工" : "还没有数字员工"}</span></p>
            <p className="text-xs text-white/50">
              {filtered ? "换个关键词或放宽筛选条件后再试。" : "员工创建后会出现在这里。"}
            </p>
            {filtered ? (
              <Button
                size="sm"
                outlined
                data-testid="emp-list-state-clear"
                onClick={() => {
                  setKeyword("");
                  setDebounced("");
                  patchParams({ q: null, lifecycle: null, dept: null });
                }}
              >
                清除筛选
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {dept !== null && state.phase === "ready" && visibleItems.length === 0 ? (
        <Card data-testid="emp-list-dept-empty">
          <CardContent className="min-w-0 space-y-2 p-4 text-sm">
            <p>该部门下没有员工。</p>
            <p className="text-xs text-muted-foreground">
              这是当前已加载 {state.items.length} 人里的真实结果：没有部门等于该筛选值的行（缺部门的行归「未标注部门」桶）；可清空部门筛选。
            </p>
            <Button size="sm" outlined data-testid="emp-list-dept-clear" onClick={() => patchParams({ dept: null })}>
              清空部门筛选
            </Button>
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
            <div data-testid="emp-list-nav" role="grid" aria-label="员工列表（方向键浏览行，Enter 展开预览）">
            <ul className="divide-y divide-white/5" data-testid="emp-l-list" data-emp-list-rows="true">
              {visibleItems.map((row) => (
                <li key={row.employeeId} data-testid={`employees-row-${row.employeeId}`}>
                  <div className="flex min-w-0 items-stretch">
                    <button
                      type="button"
                      data-testid={`emp-row-preview-toggle-${row.employeeId}`}
                      aria-expanded={previewKey === row.employeeId}
                      aria-label={`行内预览：${displayName(row)}`}
                      title="就地展开预览（不跳转、不产生新请求；Esc 或再点收起）"
                      className="flex shrink-0 items-center border-r border-white/5 px-2 text-white/40 hover:text-white/80 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/60"
                      onClick={() => setPreviewKey((k) => (k === row.employeeId ? null : row.employeeId))}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setPreviewKey(null); // focus already sits on this button
                        }
                      }}
                    >
                      <ChevronRight className={`h-3.5 w-3.5 transition-transform ${previewKey === row.employeeId ? "rotate-90" : ""}`} />
                    </button>
                  <span data-testid={`emp-l-row-${row.employeeId}`} className="contents">
                  <Link
                    to={`/employees/${encodeURIComponent(row.employeeId)}`}
                    data-testid={`emp-l-name-link-${row.employeeId}`}
                    ref={(el) => {
                      if (el) rowRefs.current.set(row.employeeId, el);
                      else rowRefs.current.delete(row.employeeId);
                    }}
                    tabIndex={(activeRowKey ?? visibleItems[0]?.employeeId) === row.employeeId ? 0 : -1}
                    aria-expanded={previewKey === row.employeeId}
                    onFocus={() => setActiveRowKey(row.employeeId)}
                    onKeyDown={(e) => {
                      const ids = visibleItems.map((r) => r.employeeId);
                      const i = ids.indexOf(row.employeeId);
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        focusRow(ids[Math.min(i + 1, ids.length - 1)]);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        focusRow(ids[Math.max(i - 1, 0)]);
                      } else if (e.key === "Home") {
                        e.preventDefault();
                        focusRow(ids[0]);
                      } else if (e.key === "End") {
                        e.preventDefault();
                        focusRow(ids[ids.length - 1]);
                      } else if (e.key === "Enter") {
                        // Enter 展开/收起预览，不跳详情（行内预览是本区语义）。
                        e.preventDefault();
                        setPreviewKey((k) => (k === row.employeeId ? null : row.employeeId));
                      } else if (e.key === "Escape" && previewKey !== null) {
                        e.preventDefault();
                        setPreviewKey(null);
                        e.currentTarget.focus();
                      }
                    }}
                    className="grid min-w-0 flex-1 grid-cols-1 gap-1 px-4 py-3 hover:bg-white/5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.8fr)] md:items-center md:gap-2"
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
                  </div>
                  {previewKey === row.employeeId ? <RowPreview row={row} /> : null}
                </li>
              ))}
            </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* R69: 分页条常驻——非 ready 态下「加载更多」以 disabled+原因存在，不隐身。 */}
      <div className="flex min-w-0 flex-wrap items-center gap-2 px-1 text-xs" data-testid="emp-list-page">
        <span
          data-testid="emp-list-page-count"
          className="text-white/55"
          title={
            state.phase !== "ready"
              ? phaseReason(state.phase) ?? undefined
              : state.total === null
                ? "读口顶层只有 items/nextCursor（实测 200，无 total 键）；按已加载条数推算会撒谎，故不推算。"
                : undefined
          }
        >
          {state.phase !== "ready"
            ? "总数不可读 · 已显示 — 人"
            : state.total === null
              ? `总数不可用 · 已显示 ${state.items.length} 人`
              : `共 ${state.total} 人 / 已显示 ${state.items.length} 人`}
        </span>
        <Button
          size="sm"
          outlined
          data-testid="emp-list-page-more"
          disabled={state.phase !== "ready" || !state.nextCursor || state.loadingMore}
          onClick={loadMore}
          title={
            state.phase !== "ready"
              ? `不能续取：${phaseReason(state.phase)}`
              : state.nextCursor
                ? "带服务端游标续取下一页（追加按工号去重）"
                : "服务端没有给出下一页游标：已到末页。"
          }
        >
          {state.loadingMore ? "加载中…" : "加载更多"}
        </Button>
        {state.phase === "ready" && state.nextCursor === null && state.items.length > 0 ? (
          <span data-testid="emp-list-page-end" className="text-white/45">已到末页</span>
        ) : null}
      </div>
      </div>
    </section>
  );
}

export default EmployeesModulePage;