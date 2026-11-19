/**
 * RunsPage — read-only list of agent runs.
 *
 * Data source: `GET /agent-api/api/runs`, reverse-proxied by Caddy to the agent
 * BFF on :8092. Cursor paged: the following page is the same path with
 * `?cursor=<opaque>` copied verbatim from the previous answer.
 *
 * That BFF lives outside this repo, so its payload is treated as unknown input
 * rather than a known type: lists are found under whichever of the usual
 * container keys the gateway happens to use, every field is optional, and a
 * record we cannot read is counted and reported — never replaced with a
 * plausible-looking row. 403 and 404 both mean "this is not reachable for you",
 * so they render one identical whole-panel state with no rows painted first.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleDashed, Inbox, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { RequestIdCopy } from "@/components/RequestIdCopy";
import { fetchJSON } from "@/lib/api";
import { ApiError, errorMessage } from "@/lib/api-error";
import { cn, themedBody } from "@/lib/utils";

/** Same union the kit's Badge accepts (its own type is not exported). */
type Tone = "default" | "destructive" | "outline" | "secondary" | "success" | "warning";

const RUNS_PATH = "/agent-api/api/runs";
// R4 item 5: honest copy when no trace id came back (replaces 「未提供」).
function reqLine(id: string | null | undefined): string {
  return id ? `请求编号：${id}` : "请求编号未记录，可复制时间与操作路径反馈";
}


// ── Formatting ───────────────────────────────────────────────────────
// Every user-facing value is rendered through one of these so no raw ISO
// string, `undefined`, `NaN` or bare identifier ever reaches the screen.

const BEIJING = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Beijing wall clock, `YYYY-MM-DD HH:mm`; null when the value is absent or unreadable. */
function beijing(value: unknown): string | null {
  const raw = textOf(value);
  if (!raw) return null;
  let date: Date;
  if (/^\d{9,10}$/.test(raw)) date = new Date(Number(raw) * 1000);
  else if (/^\d{11,13}$/.test(raw)) date = new Date(Number(raw));
  else if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(raw)) date = new Date(raw);
  else return null; // free text is not a timestamp; show 「—」 instead of echoing it
  const ms = date.getTime();
  if (Number.isNaN(ms)) return null;
  return BEIJING.format(date).replace(/,\s*/, " ");
}

function money(value: number | null): string {
  return value === null ? "—" : USD.format(value);
}

function countUnit(value: number | null, unit: string): string {
  return value === null ? "—" : `${value} ${unit}`;
}

// ── Defensive readers ────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function numberOf(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = typeof value === "string" ? value.trim().replace(/,/g, "") : "";
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** First key that actually carries a value. Missing stays missing — no `?? 0`. */
function pick(rec: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    const value = rec[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function pickText(rec: Record<string, unknown>, keys: readonly string[]): string | null {
  return textOf(pick(rec, keys));
}

function pickNumber(rec: Record<string, unknown>, keys: readonly string[]): number | null {
  return numberOf(pick(rec, keys));
}

// ── Identity ─────────────────────────────────────────────────────────
// Machine identifiers (`emp_7f3a91b2`, `employee:42`, `human:1`) are never
// printed. A resolved name wins; otherwise the last four characters of the
// trailing segment; otherwise an honest "nobody assigned". The raw value is
// kept for the `title` attribute so support can still ask for it.

const SCHEME_PREFIX = /^(?:emp|employee|agent|human|user|member|staff|svc|service)[_:=@/#-]/i;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isMachineHandle(value: string): boolean {
  return SCHEME_PREFIX.test(value) || UUID_SHAPE.test(value) || /^emp_/i.test(value);
}

interface Person {
  /** What the operator reads. */
  label: string;
  /** What goes in `title` only. */
  raw: string | null;
}

function personView(
  rec: Record<string, unknown>,
  nameKeys: readonly string[],
  idKeys: readonly string[],
  noun: string,
): Person {
  const rawId = pickText(rec, idKeys);
  const name = pickText(rec, nameKeys);
  if (name && !isMachineHandle(name)) return { label: name, raw: rawId };
  const handle = name ?? rawId;
  if (handle) {
    const tail = handle
      .split(/[:_/@#-]/)
      .filter(Boolean)
      .pop();
    const clean = (tail ?? "").replace(/[^0-9A-Za-z]/g, "");
    if (clean.length >= 4) return { label: `${noun} · ${clean.slice(-4)}`, raw: handle };
  }
  return { label: "未指派", raw: rawId };
}

// ── Status vocabulary ────────────────────────────────────────────────

const STATE_COPY: Record<string, { label: string; tone: Tone }> = {
  completed: { label: "已完成", tone: "success" },
  succeeded: { label: "已完成", tone: "success" },
  success: { label: "已完成", tone: "success" },
  finished: { label: "已完成", tone: "success" },
  ok: { label: "已完成", tone: "success" },
  running: { label: "进行中", tone: "outline" },
  in_progress: { label: "进行中", tone: "outline" },
  active: { label: "进行中", tone: "outline" },
  streaming: { label: "进行中", tone: "outline" },
  queued: { label: "排队中", tone: "secondary" },
  pending: { label: "排队中", tone: "secondary" },
  scheduled: { label: "排队中", tone: "secondary" },
  failed: { label: "失败", tone: "destructive" },
  error: { label: "失败", tone: "destructive" },
  crashed: { label: "失败", tone: "destructive" },
  timed_out: { label: "已超时", tone: "destructive" },
  timeout: { label: "已超时", tone: "destructive" },
  cancelled: { label: "已终止", tone: "secondary" },
  canceled: { label: "已终止", tone: "secondary" },
  aborted: { label: "已终止", tone: "secondary" },
  stopped: { label: "已终止", tone: "secondary" },
};

interface StatusView {
  label: string;
  tone: Tone;
  /** True for states that are still moving — the only reason to auto-refresh. */
  live: boolean;
}

function statusView(raw: string | null): StatusView {
  const hit = raw ? STATE_COPY[raw.trim().toLowerCase()] : undefined;
  if (hit) return { ...hit, live: hit.label === "进行中" };
  return { label: "状态未知", tone: "secondary", live: false };
}

// ── Row model ────────────────────────────────────────────────────────

interface RunRow {
  key: string;
  title: string;
  status: StatusView;
  rawStatus: string | null;
  worker: Person;
  started: string | null;
  finished: string | null;
  cost: number | null;
  steps: number | null;
  failure: string | null;
  rawId: string | null;
}

const ID_KEYS = ["runId", "run_id", "id", "uuid"] as const;
const TITLE_KEYS = ["title", "name", "summary", "label", "task", "description"] as const;
const STATUS_KEYS = ["status", "state"] as const;
const WORKER_NAME_KEYS = ["employeeName", "employee_name", "agentName", "agent_name", "assigneeName"] as const;
const WORKER_ID_KEYS = ["employee", "employeeId", "employee_id", "agent", "agentId", "agent_id", "assignee"] as const;
const START_KEYS = ["startedAt", "started_at", "startTime", "start_time", "createdAt", "created_at"] as const;
const END_KEYS = ["finishedAt", "finished_at", "completedAt", "completed_at", "endTime", "end_time"] as const;
const COST_KEYS = ["costUsd", "cost_usd", "totalCostUsd", "amountUsd", "spend", "cost"] as const;
const STEP_KEYS = ["steps", "stepCount", "step_count", "turns"] as const;
const FAILURE_KEYS = ["error", "errorMessage", "error_message", "failureReason"] as const;
const LIST_KEYS = ["items", "runs", "results", "entries", "data", "list"] as const;
const CURSOR_KEYS = ["nextCursor", "next_cursor", "next", "cursor", "nextPage", "next_page"] as const;

/** Sentences the operator wrote; anything shaped like a stack trace or JSON body is not one. */
function humanSentence(value: string | null): string | null {
  if (!value) return null;
  const oneLine = value.replace(/\s+/g, " ").trim();
  if (!oneLine || oneLine.length > 220) return null;
  if (/[{}<>]|\bat\s+\S+\.\S+|https?:\/\//i.test(oneLine)) return null;
  if (/^\d{3}\s/.test(oneLine)) return null;
  return oneLine;
}

function runRowFrom(item: unknown, index: number): RunRow | null {
  const rec = asRecord(item);
  if (!rec) return null;
  const rawId = pickText(rec, ID_KEYS);
  const title = humanSentence(pickText(rec, TITLE_KEYS));
  // A row with neither a handle nor a caption cannot be told apart from the
  // next one, so it is unreadable rather than anonymous.
  if (!rawId && !title) return null;
  const rawStatus = pickText(rec, STATUS_KEYS);
  return {
    key: rawId ?? `run-${index}`,
    title: title ?? "未命名的运行",
    status: statusView(rawStatus),
    rawStatus,
    worker: personView(rec, WORKER_NAME_KEYS, WORKER_ID_KEYS, "员工"),
    started: beijing(pick(rec, START_KEYS)),
    finished: beijing(pick(rec, END_KEYS)),
    cost: pickNumber(rec, COST_KEYS),
    steps: pickNumber(rec, STEP_KEYS),
    failure: humanSentence(pickText(rec, FAILURE_KEYS)),
    rawId,
  };
}

interface Page {
  rows: RunRow[];
  unreadable: number;
  next: string | null;
}

/** null = the answer is not a list at all, which is an error, not an empty page. */
function pageFrom(payload: unknown): Page | null {
  let items: unknown[] | null = null;
  let next: string | null = null;
  if (Array.isArray(payload)) {
    items = payload;
  } else {
    const rec = asRecord(payload);
    if (!rec) return null;
    for (const key of LIST_KEYS) {
      const value = rec[key];
      if (Array.isArray(value)) {
        items = value;
        break;
      }
    }
    next = pickText(rec, CURSOR_KEYS);
    if (!items) return null;
  }
  const rows: RunRow[] = [];
  let unreadable = 0;
  items.forEach((item, index) => {
    const row = runRowFrom(item, index);
    if (row) rows.push(row);
    else unreadable += 1;
  });
  return { rows, unreadable, next };
}

// ── Error copy ───────────────────────────────────────────────────────

interface Failure {
  sentence: string;
  requestId: string | null;
  technical: string | null;
  /** R5 item 1: a 401 gets an explicit re-login exit next to 重试. */
  authExpired?: boolean;
}

const REQUEST_ID_KEYS = ["request_id", "requestId", "trace_id", "traceId", "x-request-id", "correlation_id"] as const;

/**
 * The gateway's trace id, read out of the error body (the shared fetch wrapper
 * exposes the body, not the headers). Absent means "not provided" — we never
 * synthesise one.
 */
function requestIdFrom(body: string | undefined): string | null {
  if (!body) return null;
  const rec = asRecord(safeJson(body));
  if (rec) {
    const direct = pickText(rec, REQUEST_ID_KEYS);
    if (direct) return direct;
    const detail = asRecord(rec.detail);
    if (detail) {
      const nested = pickText(detail, REQUEST_ID_KEYS);
      if (nested) return nested;
    }
  }
  return null;
}

function safeJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function failureFrom(err: unknown): Failure {
  // Anything that is not an ApiError never reached a readable answer: the
  // dev server's SPA fallback handing back HTML, a body that is not JSON, an
  // aborted request. Its text is for the console, never for the screen.
  if (!(err instanceof ApiError)) {
    return {
      sentence: "没有读到可用的结果，服务回的内容认不出来。请稍后重试。",
      requestId: null,
      technical: errorMessage(err),
    };
  }
  const status = err.status;
  const requestId = (err instanceof ApiError && err.requestId ? err.requestId : requestIdFrom(err.body));
  const technical = err.details;
  let sentence: string;
  if (status === 0) sentence = "连不上提供这些数据的服务，请确认它已启动后重试。";
  else if (status === 401) sentence = "登录状态已失效，请刷新页面重新登录后再看。";
  else if (status === 429) sentence = "请求太频繁，请稍等一会儿再试。";
  else if (status >= 500) sentence = "服务在处理时出了错，请稍后重试。";
  else sentence = humanSentence(errorMessage(err)) ?? "读取运行记录时出现问题，请稍后重试。";
  return { sentence, requestId, technical, authExpired: status === 401 };
}

function isDenied(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 403 || err.status === 404);
}

// ── Whole-panel states ───────────────────────────────────────────────

function DeniedPanel({ subject, failure }: { subject: string; failure: Failure | null }) {
  return (
    <Card role="alert" aria-label={`${subject}不可用（403/404）`} className="border-border bg-card">
      <CardContent className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={cn("text-sm", themedBody)}>暂时无法查看{subject}</p>
        <p className="max-w-prose text-xs text-muted-foreground">
          这块内容要么尚未对你开放，要么当前环境还没有提供它。这里不会显示任何猜测的内容。
          需要查看时，请联系工作区管理员为你开通。
        </p>
        <p className="text-xs text-muted-foreground">
          <RequestIdCopy requestId={failure?.requestId} fallback="请求编号未记录，可复制时间与操作路径反馈" />
        </p>
      </CardContent>
    </Card>
  );
}

function ErrorPanel({ failure, onRetry }: { failure: Failure; onRetry: () => void }) {
  return (
    <Card
      role="alert"
      title={failure.technical ?? undefined}
      className="border-destructive/40 bg-destructive/5"
    >
      <CardContent className="flex flex-col items-start gap-2 px-4 py-6">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          运行记录没能加载出来
        </div>
        <p className="text-xs text-muted-foreground">{failure.sentence}</p>
        <p className="text-xs text-muted-foreground">
          <RequestIdCopy requestId={failure.requestId} fallback="请求编号未记录，可复制时间与操作路径反馈" />
        </p>
        <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          重试
        </Button>
        {failure.authExpired && (
          <Button
            size="sm"
            outlined
            data-testid="auth-reload-exit"
            onClick={() => window.location.reload()}
          >
            刷新重新登录
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyPanel({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={cn("text-sm", themedBody)}>还没有运行记录</p>
        <p className="max-w-prose text-xs text-muted-foreground">
          员工开始执行任务后，每一次运行都会按时间出现在这里。
        </p>
        <Button size="sm" outlined onClick={onRefresh} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          刷新
        </Button>
      </CardContent>
    </Card>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="animate-pulse rounded-md border border-border bg-card px-4 py-4">
          <div className="h-3 w-2/5 rounded-sm bg-muted" />
          <div className="mt-3 h-2.5 w-4/5 rounded-sm bg-muted/70" />
        </div>
      ))}
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────

function Meta({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground" title={title}>
        {value}
      </dd>
    </div>
  );
}

function RunCard({ row }: { row: RunRow }) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="flex flex-col gap-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn("min-w-0 flex-1 break-words text-sm", themedBody)}
            title={row.rawId ?? undefined}
          >
            {row.title}
          </span>
          <Badge tone={row.status.tone} title={row.rawStatus ?? undefined}>
            {row.status.live && (
              <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current align-middle" />
            )}
            {row.status.label}
          </Badge>
        </div>

        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <Meta label="执行员工" value={row.worker.label} title={row.worker.raw ?? undefined} />
          <Meta label="开始" value={row.started ?? "—"} />
          <Meta label="结束" value={row.finished ?? "—"} />
          <Meta label="花费" value={money(row.cost)} title={row.cost === null ? "服务未提供该数值" : undefined} />
          <Meta label="步骤" value={countUnit(row.steps, "步")} title={row.steps === null ? "服务未提供该数值" : undefined} />
        </dl>

        {row.failure && <p className="break-words text-xs text-destructive">未完成原因：{row.failure}</p>}
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

type Phase = "loading" | "ready" | "denied" | "error";

export default function RunsPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [rows, setRows] = useState<RunRow[]>([]);
  const [unreadable, setUnreadable] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pageFailure, setPageFailure] = useState<Failure | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Stale answers must never overwrite a newer load (fast refresh clicks).
  const seq = useRef(0);

  // Kicks off one request. It touches no state before the answer arrives, so the
  // mount effect stays a plain synchronization; the handlers below own the
  // "now loading" flags because a click is where that is a real user intent.
  const load = useCallback((cursor: string | null, append: boolean): Promise<void> => {
    const ticket = ++seq.current;
    const url = cursor ? `${RUNS_PATH}?cursor=${encodeURIComponent(cursor)}` : RUNS_PATH;
    const fresh = () => ticket === seq.current;
    return fetchJSON<unknown>(url)
      .then((payload) => {
        if (!fresh()) return;
        const page = pageFrom(payload);
        if (!page) {
          // A list we cannot locate is a failure, not an empty queue: painting
          // 「还没有运行记录」 would claim the service said so.
          setRows([]);
          setUnreadable(0);
          setNext(null);
          setFailure({
            sentence: "服务返回的内容不是可识别的运行列表，未能读出任何记录。",
            requestId: null,
            technical: "unexpected payload shape",
          });
          setPhase("error");
          return;
        }
        setRows((prev) => (append ? [...prev, ...page.rows] : page.rows));
        setUnreadable((prev) => (append ? prev + page.unreadable : page.unreadable));
        // A gateway that echoes the same cursor back would page forever.
        setNext(page.next && page.next !== cursor ? page.next : null);
        setPageFailure(null);
        setFailure(null);
        setPhase("ready");
      })
      .catch((err: unknown) => {
        if (!fresh()) return;
        if (append) {
          setPageFailure(failureFrom(err));
          return;
        }
        setRows([]);
        setUnreadable(0);
        setNext(null);
        setFailure(failureFrom(err));
        setPhase(isDenied(err) ? "denied" : "error");
      })
      .finally(() => {
        if (fresh()) setLoadingMore(false);
      });
  }, []);

  // A click is where "now loading" belongs: it is a real user intent, and the
  // mount effect below stays a plain synchronization with the service.
  const reload = useCallback(() => {
    setPhase("loading");
    void load(null, false);
  }, [load]);

  const loadMore = useCallback(() => {
    if (!next) return;
    setLoadingMore(true);
    void load(next, true);
  }, [load, next]);

  useEffect(() => {
    void load(null, false);
  }, [load]);

  const received = rows.length + unreadable;

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground" aria-live="polite">
          {phase === "loading"
            ? "正在读取运行记录…"
            : phase === "ready"
              ? rows.length === 0
                ? "共 0 条运行记录"
                : `已显示 ${rows.length} 条运行记录${next ? "，下面还有更多" : "，已全部加载"}`
              : phase === "denied"
                ? "运行记录暂不可用"
                : "运行记录读取失败"}
        </p>
        {phase !== "denied" && (
          <Button
            size="sm"
            outlined
            onClick={reload}
            prefix={<RefreshCw className={cn("h-3.5 w-3.5", phase === "loading" && "animate-spin")} />}
          >
            刷新
          </Button>
        )}
      </div>

      {phase === "loading" && <SkeletonRows />}

      {phase === "denied" && <DeniedPanel subject="运行记录" failure={failure} />}

      {phase === "error" && failure && (
        <ErrorPanel failure={failure} onRetry={reload} />
      )}

      {phase === "ready" && rows.length === 0 && unreadable === 0 && (
        <EmptyPanel onRefresh={reload} />
      )}

      {phase === "ready" && (
        <>
          {rows.length > 0 && (
            <div className="flex min-w-0 flex-col gap-2">
              {rows.map((row) => (
                <RunCard key={row.key} row={row} />
              ))}
            </div>
          )}

          {unreadable > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              有 {unreadable} / {received} 条记录缺少可显示的内容，未列在上面。
            </p>
          )}

          {pageFailure && (
            <p className="break-words text-xs text-destructive">
              后续记录没有加载成功：{pageFailure.sentence}（{reqLine(pageFailure.requestId)}）
            </p>
          )}

          {next ? (
            <div>
              <Button
                size="sm"
                outlined
                disabled={loadingMore}
                onClick={loadMore}
                prefix={loadingMore ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />}
              >
                加载更多
              </Button>
            </div>
          ) : (
            rows.length > 0 && <p className="text-xs text-muted-foreground">没有更多运行记录了。</p>
          )}
        </>
      )}
    </div>
  );
}
