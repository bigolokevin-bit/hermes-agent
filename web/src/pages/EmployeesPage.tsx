import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  Inbox,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";

/**
 * 数字员工列表页（只读）。
 *
 * 数据来自 BFF（Caddy 代理到 8092）：先试 `/agent-api/api/matrix`，拿不到再退到
 * `/agent-api/api/employees`。两个都失败时如实降级，绝不编造行。本页不写任何数据，
 * 唯一可点的东西就是跳转。
 *
 * 路由约定（编排方接线）：本页 `/employees`，行点击 → `/employees/:id`。
 */

export type Rec = Record<string, unknown>;

// ── 取值 helper（纯函数，模块作用域，引用稳定） ───────────────────────────

export function isRecord(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function pickStr(obj: Rec, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// R5 item 7: one money format for the whole console — the same USD formatter
// RunsPage/ApprovalsPage use ($1,234.56, two decimals, locale grouping).
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 金额（美元）：缺失 → 「未计价」；真实 0 → $0.00。绝不把缺失当成 0。 */
export function money(value: unknown): string {
  let raw = value;
  if (isRecord(raw)) {
    raw = raw.amount ?? raw.total ?? raw.cost ?? raw.value ?? raw.spent ?? null;
  }
  const n = toNum(raw);
  if (n === null) return "未计价";
  return USD.format(n);
}

// R4 item 5: honest copy when no trace id came back (replaces 「未提供」).
function reqLine(id: string | null | undefined): string {
  return id ? `请求编号：${id}` : "请求编号未记录，可复制时间与操作路径反馈";
}

/** 计数：缺失 → 「—」；真实 0 → 「0」。 */
export function countDash(value: unknown): string {
  const n = toNum(value);
  if (n === null) return "—";
  return String(n);
}

const BEIJING = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** ISO 字符串或 epoch（秒/毫秒）→ 「YYYY-MM-DD HH:mm」（北京时间）；不可解析 → 「—」。 */
export function beijing(value: unknown): string {
  if (value == null || value === "") return "—";
  let ms: number | null = null;
  if (typeof value === "number") {
    ms = value > 1e11 ? value : value * 1000;
  } else if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{9,}$/.test(s)) {
      const n = Number(s);
      ms = n > 1e11 ? n : n * 1000;
    } else {
      const parsed = Date.parse(s);
      ms = Number.isNaN(parsed) ? null : parsed;
    }
  }
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  const at = (t: Intl.DateTimeFormatPartTypes) =>
    BEIJING.formatToParts(d).find((p) => p.type === t)?.value ?? "";
  const [y, mo, da, hh, mi] = [at("year"), at("month"), at("day"), at("hour"), at("minute")];
  if (!y || !mo || !da) return "—";
  return `${y}-${mo}-${da} ${hh}:${mi}`;
}

// ── 身份：屏幕上永不出现 emp_ / employee: / human: 原值 ───────────────────

function last4(raw: string): string {
  const tail = raw.includes(":") ? raw.slice(raw.lastIndexOf(":") + 1) : raw;
  const compact = tail.replace(/[^0-9A-Za-z]/g, "");
  return compact.slice(-4) || "————";
}

// R5 item 6: same-name employees need disambiguation — 「姓名 · 8位短码」
// (first 8 alphanumeric chars of the id, uppercased; never a bare emp_ id).
function short8(raw: string): string {
  let tail = raw.includes(":") ? raw.slice(raw.lastIndexOf(":") + 1) : raw;
  tail = tail.replace(/^[A-Za-z]{2,8}[_-]/, ""); // emp_ / agent_ / run_ 前缀
  const compact = tail.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return compact.slice(0, 8) || "--------";
}

function kindLabel(raw: string): string {
  if (/^human:/i.test(raw) || /^user:/i.test(raw)) return "人员";
  if (/^team:/i.test(raw) || /^group:/i.test(raw)) return "团队";
  return "员工";
}

/** 只把「像标识符」的值改写成 员工·末4位；可读名称（如 "alice"、"李工"）原样返回。 */
function looksLikeId(v: string): boolean {
  if (/^[A-Za-z][\w-]*:/.test(v)) return true; // employee:…, human:…, agent:…
  if (/^(emp|agent|user|human|team|group|run|task|sess|audit|evt)[_-]/i.test(v)) return true;
  if (v.length >= 10 && /^[0-9a-fA-F][0-9a-fA-F_-]+$/.test(v)) return true; // uuid / 哈希
  return false;
}

/** 标识 → 「员工 · 末4位」。空/无效 → null（由调用方决定「未指派」还是「—」）。 */
export function refLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v || v === "null" || v === "undefined") return null;
  return looksLikeId(v) ? `${kindLabel(v)} · ${last4(v)}` : v;
}

/** 名字 → 「姓名 · 8位短码」；无名字退到「员工 · 8位短码」；都没有 → 「—」。原始 id 只进 title。 */
export function displayName(
  name: string | null,
  id: string | null,
): { text: string; raw: string | null } {
  if (name && id) return { text: `${name} · ${short8(id)}`, raw: id };
  if (name) return { text: name, raw: null };
  if (id) {
    const ref = refLabel(id);
    if (ref && looksLikeId(id)) return { text: `${kindLabel(id)} · ${short8(id)}`, raw: id };
    if (ref) return { text: ref, raw: id };
  }
  return { text: "—", raw: null };
}

export function idOf(obj: Rec): string | null {
  return pickStr(obj, ["id", "employee_id", "emp_id", "agent_id", "user_id", "key"]);
}
export function nameOf(obj: Rec): string | null {
  return pickStr(obj, ["name", "display_name", "full_name", "label", "title", "nickname"]);
}

// ── 状态枚举 → 中文徽标（未知值不臆测，渲染「—」） ────────────────────────

export type Tone = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
export type StatusHit = { label: string; tone: Tone };

export const PRESENCE: Record<string, StatusHit> = {
  online: { label: "在岗", tone: "success" },
  active: { label: "在岗", tone: "success" },
  running: { label: "在岗", tone: "success" },
  enabled: { label: "在岗", tone: "success" },
  idle: { label: "空闲", tone: "secondary" },
  paused: { label: "已暂停", tone: "warning" },
  suspended: { label: "已停用", tone: "secondary" },
  offline: { label: "离线", tone: "secondary" },
  stopped: { label: "已停用", tone: "secondary" },
  disabled: { label: "已停用", tone: "secondary" },
  retired: { label: "已停用", tone: "secondary" },
  onboarding: { label: "试用", tone: "warning" },
  draft: { label: "试用", tone: "warning" },
  offboarding: { label: "离职中", tone: "warning" },
  archived: { label: "已归档", tone: "secondary" },
  error: { label: "异常", tone: "destructive" },
  fault: { label: "异常", tone: "destructive" },
  failed: { label: "异常", tone: "destructive" },
};

// R5 item 5: the authoritative field is the API lifecycle (lifecycleState),
// not a generic status blob. Unknown lifecycle values must read 「待核实」 —
// never a guess, and not a bare dash either.
export const LIFECYCLE: Record<string, StatusHit> = {
  active: { label: "在岗", tone: "success" },
  online: { label: "在岗", tone: "success" },
  running: { label: "在岗", tone: "success" },
  enabled: { label: "在岗", tone: "success" },
  onboarding: { label: "试用", tone: "warning" },
  draft: { label: "试用", tone: "warning" },
  paused: { label: "已停用", tone: "secondary" },
  suspended: { label: "已停用", tone: "secondary" },
  disabled: { label: "已停用", tone: "secondary" },
  stopped: { label: "已停用", tone: "secondary" },
  retired: { label: "已停用", tone: "secondary" },
  offboarding: { label: "离职中", tone: "warning" },
  archived: { label: "已归档", tone: "secondary" },
};

/** lifecycle 真值优先，再退到旧 status/state 字段。 */
export function lifecycleOf(row: Rec): unknown {
  return row.lifecycleState ?? row.lifecycle_state ?? row.lifecycle ?? row.status ?? row.state ?? row.presence ?? row.presence_state;
}

export const WORK: Record<string, StatusHit> = {
  queued: { label: "待处理", tone: "secondary" },
  pending: { label: "待处理", tone: "secondary" },
  scheduled: { label: "待处理", tone: "secondary" },
  open: { label: "待处理", tone: "secondary" },
  running: { label: "进行中", tone: "success" },
  in_progress: { label: "进行中", tone: "success" },
  started: { label: "进行中", tone: "success" },
  active: { label: "进行中", tone: "success" },
  completed: { label: "已完成", tone: "success" },
  succeeded: { label: "已完成", tone: "success" },
  success: { label: "已完成", tone: "success" },
  ok: { label: "已完成", tone: "success" },
  done: { label: "已完成", tone: "success" },
  closed: { label: "已完成", tone: "success" },
  failed: { label: "失败", tone: "destructive" },
  error: { label: "失败", tone: "destructive" },
  timeout: { label: "超时", tone: "destructive" },
  cancelled: { label: "已取消", tone: "secondary" },
  canceled: { label: "已取消", tone: "secondary" },
  aborted: { label: "已中止", tone: "warning" },
  paused: { label: "已暂停", tone: "warning" },
  waiting: { label: "等待中", tone: "warning" },
  blocked: { label: "已阻塞", tone: "warning" },
};

export function statusHit(value: unknown, table: Record<string, StatusHit>): StatusHit | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return table[value.trim().toLowerCase()] ?? null;
}

export function StatusBadge({
  value,
  table,
  unknownLabel,
}: {
  value: unknown;
  table: Record<string, StatusHit>;
  unknownLabel?: string;
}) {
  const hit = statusHit(value, table);
  if (!hit) {
    const known = typeof value === "string" && value.trim();
    if (unknownLabel && known) {
      // R5 item 5: an unrecognised API value is 「待核实」, never a guess.
      return (
        <Badge tone="outline" title={value}>
          {unknownLabel}
        </Badge>
      );
    }
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <Badge tone={hit.tone} title={typeof value === "string" ? value : undefined}>
      {hit.label}
    </Badge>
  );
}

// ── 错误：还原成人话 + 信封里带就提取请求编号 ─────────────────────────────

export function errStatus(err: unknown): number {
  return err instanceof ApiError ? err.status : 0;
}

/** 去掉句首可能被拼进来的 HTTP 码，屏上不留裸数字码（码只进 title/aria）。 */
export function humanize(err: unknown): string {
  let msg = err instanceof Error ? err.message || err.name : String(err);
  msg = msg.replace(/^\s*(?:HTTP\s*)?\d{3}\s*[:：-]\s*/i, "").trim();
  return msg || "服务返回了一个未识别的错误。";
}

export function requestIdOf(err: unknown): string | null {
  if (err instanceof ApiError && err.requestId) return err.requestId;
  const body = err instanceof ApiError ? err.body : "";
  if (!body.trim().startsWith("{")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const KEYS = [
    "request_id",
    "requestId",
    "x-request-id",
    "x_request_id",
    "trace_id",
    "traceId",
    "correlation_id",
    "correlationId",
  ];
  const scan = (o: unknown, depth: number): string | null => {
    if (depth > 2 || !isRecord(o)) return null;
    for (const k of KEYS) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
    for (const k of ["detail", "error", "meta", "context", "data"]) {
      const nested = scan(o[k], depth + 1);
      if (nested) return nested;
    }
    return null;
  };
  return scan(parsed, 0);
}

/** 兼容裸数组 / {employees} / {items} / {results} / {data} / {rows} / {matrix} 等信封。 */
export function asRows(raw: unknown): Rec[] {
  if (Array.isArray(raw)) return raw.filter(isRecord);
  if (isRecord(raw)) {
    for (const k of ["employees", "items", "results", "data", "rows", "list", "matrix", "members", "runs", "tasks", "audit", "sessions", "events"]) {
      const v = raw[k];
      if (Array.isArray(v)) return v.filter(isRecord);
    }
    // 单层 { <id>: {...} } 矩阵形状
    const vals = Object.values(raw);
    if (vals.length > 0 && vals.every(isRecord)) return vals as Rec[];
  }
  return [];
}

// ── 取数状态机 ───────────────────────────────────────────────────────────

export type BlockState<T> =
  | { k: "loading" }
  | { k: "ready"; data: T }
  | { k: "error"; status: number; message: string; requestId: string | null };

/** 403/404 → 无权限/未开放，整块替换，绝不先渲染数据再被替换。 */
function failed(err: unknown): BlockState<never> {
  return { k: "error", status: errStatus(err), message: humanize(err), requestId: requestIdOf(err) };
}

/** 列表数据块：依序试多个端点，任一成功即返回；全失败报最后一个端点的错。 */
export function useResourceList(urls: string[]): {
  state: BlockState<Rec[]>;
  reload: () => void;
} {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<BlockState<Rec[]>>({ k: "loading" });
  const key = urls.join("|");

  useEffect(() => {
    let alive = true;
    setState({ k: "loading" });
    const list = key.split("|");
    const attempt = (i: number): Promise<Rec[]> =>
      fetchJSON<unknown>(list[i]).then(asRows).catch((err: unknown) => {
        if (i + 1 < list.length) return attempt(i + 1);
        throw err;
      });
    attempt(0)
      .then((rows) => alive && setState({ k: "ready", data: rows }))
      .catch((err: unknown) => alive && setState(failed(err)));
    return () => {
      alive = false;
    };
  }, [key, nonce]);

  return { state, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

// ── 页面 ─────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { state, reload } = useResourceList(["/agent-api/api/matrix", "/agent-api/api/employees"]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
          <h1 className="font-mondwest text-base tracking-wider">数字员工</h1>
          {state.k === "ready" && state.data.length > 0 && (
            <span className="text-sm text-muted-foreground">（{state.data.length}）</span>
          )}
        </div>
        <Button
          size="sm"
          outlined
          onClick={reload}
          disabled={state.k === "loading"}
          prefix={<RefreshCw className={cn("h-3.5 w-3.5", state.k === "loading" && "animate-spin")} />}
        >
          刷新
        </Button>
      </header>

      {state.k === "loading" && <RowsSkeleton />}
      {state.k === "error" && (
        <ErrorStateBlock
          status={state.status}
          message={state.message}
          requestId={state.requestId}
          deniedTitle="无法打开数字员工列表"
          errorTitle="无法加载数字员工列表"
          onRetry={reload}
        />
      )}
      {state.k === "ready" &&
        (state.data.length === 0 ? (
          <EmptyBlock text="暂无数字员工" hint="这台机器还没有接入任何数字员工。请联系管理员在后台开通后再刷新本页。" />
        ) : (
          <EmployeesTable rows={state.data} />
        ))}
    </div>
  );
}

// ── 表格：sm+ 对齐成行，窄屏每行堆叠成卡片；容器内不出横向滚动 ─────────────

const COLS =
  "grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,3fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,1.6fr)]";
const HEAD_LABELS = ["员工", "状态", "工位", "模型", "支出", "最近活动"];

function EmployeesTable({ rows }: { rows: Rec[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className={cn(COLS, "hidden border-b border-border px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground sm:grid")}>
          {HEAD_LABELS.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <ul className="divide-y divide-border" data-testid="emp-l-list">
          {rows.map((row, i) => (
            <EmployeeRow key={idOf(row) ?? `row-${i}`} row={row} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function EmployeeRow({ row }: { row: Rec }) {
  const id = idOf(row);
  const dn = displayName(nameOf(row), id);

  const cells = (
    <>
      <Cell label="员工" strong>
        {id ? (
          // R5 item 4: the name itself is the real anchor to the detail page —
          // keyboard-focusable, with a stable testid for the acceptance probe.
          <Link
            to={`/employees/${encodeURIComponent(id)}`}
            data-testid="emp-l-name-link"
            className="block truncate text-inherit underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current"
            title={dn.raw ?? undefined}
          >
            {dn.text}
          </Link>
        ) : (
          <span className="block truncate" title={dn.raw ?? undefined}>
            {dn.text}
          </span>
        )}
      </Cell>
      <Cell label="状态">
        {/* R5 item 5: read the API lifecycle first; unknown values read 待核实. */}
        <StatusBadge value={lifecycleOf(row)} table={LIFECYCLE} unknownLabel="待核实" />
      </Cell>
      <Cell label="工位">{pickStr(row, ["station", "seat", "workspace", "role", "position", "desk", "title"]) ?? "—"}</Cell>
      <Cell label="模型">{pickStr(row, ["model", "model_name"]) ?? "—"}</Cell>
      <Cell label="支出">{money(row.spend ?? row.spent ?? row.cost ?? row.usage_cost ?? row.budget_spent)}</Cell>
      <Cell label="最近活动">
        {beijing(
          row.last_seen ?? row.last_active ?? row.last_active_at ?? row.updated_at ?? row.last_run_at ?? row.created_at,
        )}
      </Cell>
    </>
  );

  return (
    <li className={cn(COLS, "px-4 py-3 text-sm")} data-testid="emp-l-row">
      {cells}
    </li>
  );
}

/** 单元格：窄屏带行内标签，sm+ 只剩值（表头承担标签）。 */
function Cell({ label, strong, children }: { label: string; strong?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 sm:block">
      <span className="shrink-0 text-xs text-muted-foreground sm:hidden">{label}</span>
      <div className={cn("min-w-0", strong && "font-medium")}>{children}</div>
    </div>
  );
}

// ── 数据块四态 ───────────────────────────────────────────────────────────

export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="加载中">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 flex-[3] animate-pulse rounded-sm bg-muted/20" />
            <div className="h-4 flex-[2] animate-pulse rounded-sm bg-muted/20" />
            <div className="hidden h-4 flex-[2] animate-pulse rounded-sm bg-muted/20 sm:block" />
            <div className="hidden h-4 flex-[1] animate-pulse rounded-sm bg-muted/20 sm:block" />
            <div className="hidden h-4 flex-[2] animate-pulse rounded-sm bg-muted/20 sm:block" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function EmptyBlock({ text, hint }: { text: string; hint: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <Inbox className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">{text}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/**
 * 错误块。403/404 合并成同一套「无权限或未开放」话术——既诚实又不泄露资源是否
 * 存在，且整块替换、不先渲染数据。其它（5xx/断网/超时）显示后端的人话 + 请求编号。
 */
export function ErrorStateBlock({
  status,
  message,
  requestId,
  deniedTitle,
  errorTitle,
  onRetry,
}: {
  status: number;
  message: string;
  requestId: string | null;
  deniedTitle: string;
  errorTitle: string;
  onRetry: () => void;
}) {
  const denied = status === 403 || status === 404;
  const title = denied ? deniedTitle : errorTitle;
  const body = denied
    ? "该数据源尚未开放，或你没有查看权限。请确认后台已接入对应服务，或联系管理员开通权限。"
    : message;
  return (
    <Card role="alert" className={denied ? "border-border" : "border-destructive/40 bg-destructive/5"}>
      <CardContent className="flex items-start gap-3 py-4">
        {denied ? (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", !denied && "text-destructive")} title={status ? String(status) : undefined}>
            {title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{body}</p>
          <p className="mt-1 text-xs text-muted-foreground">{reqLine(requestId)}</p>
          <Button size="sm" outlined className="mt-2" onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
            重试
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
