/**
 * ApprovalsPage — read-only queue of approval requests.
 *
 * Data source: `GET /agent-api/api/approvals`, reverse-proxied by Caddy to the
 * agent BFF on :8092. Cursor paged: the following page is the same path with
 * `?cursor=<opaque>` copied from the previous answer.
 *
 * The BFF is outside this repo, so its answer is read as unknown input: the list
 * is located under whichever container key the gateway uses, every field is
 * optional, and a record that cannot be read is counted and reported instead of
 * being dressed up as a row. Nothing here approves anything — the queue is a
 * window, decisions belong to the surfaces that own them.
 *
 * 403 and 404 are rendered as one identical whole-panel state (no rows first):
 * both mean this content is not reachable for this viewer.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleDashed, Inbox, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { fetchJSON } from "@/lib/api";
import { ApiError, errorMessage } from "@/lib/api-error";
import { cn, themedBody } from "@/lib/utils";

/** Same union the kit's Badge accepts (its own type is not exported). */
type Tone = "default" | "destructive" | "outline" | "secondary" | "success" | "warning";

const APPROVALS_PATH = "/agent-api/api/approvals";
// R4 item 5: honest copy when no trace id came back (replaces 「未提供」).
function reqLine(id: string | null | undefined): string {
  return id ? `请求编号：${id}` : "请求编号未记录，可复制时间与操作路径反馈";
}


// ── Formatting ───────────────────────────────────────────────────────
// One funnel for every user-facing value: no raw ISO string, `undefined`, `NaN`
// or machine identifier reaches the screen.

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

/** Beijing wall clock, `YYYY-MM-DD HH:mm`; null when absent or unreadable. */
function beijing(value: unknown): string | null {
  const raw = textOf(value);
  if (!raw) return null;
  let date: Date;
  if (/^\d{9,10}$/.test(raw)) date = new Date(Number(raw) * 1000);
  else if (/^\d{11,13}$/.test(raw)) date = new Date(Number(raw));
  else if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(raw)) date = new Date(raw);
  else return null; // free text is not a timestamp
  if (Number.isNaN(date.getTime())) return null;
  return BEIJING.format(date).replace(/,\s*/, " ");
}

function money(value: number | null): string {
  return value === null ? "—" : USD.format(value);
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
  const raw = typeof value === "string" ? value.trim().replace(/[$,\s]/g, "") : "";
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** First key that actually carries a value. Missing stays missing — never `?? 0`. */
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
// `emp_7f3a91b2`, `employee:42` and `human:1` are handles, not names, and are
// never printed: a resolved name wins, otherwise the last four characters of the
// trailing segment, otherwise an honest "未指派". The raw value only ever goes in
// the `title` attribute, where support can quote it back.

const SCHEME_PREFIX = /^(?:emp|employee|agent|human|user|member|staff|svc|service)[_:=@/#-]/i;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isMachineHandle(value: string): boolean {
  return SCHEME_PREFIX.test(value) || UUID_SHAPE.test(value) || /^emp_/i.test(value);
}

interface Person {
  label: string;
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

const STATE_COPY: Record<string, { label: string; tone: Tone; pending: boolean }> = {
  pending: { label: "待处理", tone: "warning", pending: true },
  awaiting: { label: "待处理", tone: "warning", pending: true },
  awaiting_approval: { label: "待处理", tone: "warning", pending: true },
  open: { label: "待处理", tone: "warning", pending: true },
  needs_decision: { label: "待处理", tone: "warning", pending: true },
  in_review: { label: "待处理", tone: "warning", pending: true },
  approved: { label: "已通过", tone: "success", pending: false },
  accept: { label: "已通过", tone: "success", pending: false },
  accepted: { label: "已通过", tone: "success", pending: false },
  granted: { label: "已通过", tone: "success", pending: false },
  allowed: { label: "已通过", tone: "success", pending: false },
  denied: { label: "已拒绝", tone: "destructive", pending: false },
  reject: { label: "已拒绝", tone: "destructive", pending: false },
  rejected: { label: "已拒绝", tone: "destructive", pending: false },
  declined: { label: "已拒绝", tone: "destructive", pending: false },
  blocked: { label: "已拒绝", tone: "destructive", pending: false },
  expired: { label: "已过期", tone: "secondary", pending: false },
  lapsed: { label: "已过期", tone: "secondary", pending: false },
  revoked: { label: "已撤销", tone: "secondary", pending: false },
  withdrawn: { label: "已撤销", tone: "secondary", pending: false },
  cancelled: { label: "已撤销", tone: "secondary", pending: false },
  canceled: { label: "已撤销", tone: "secondary", pending: false },
};

interface StatusView {
  label: string;
  tone: Tone;
  pending: boolean;
}

function statusView(raw: string | null): StatusView {
  const hit = raw ? STATE_COPY[raw.trim().toLowerCase()] : undefined;
  if (hit) return { label: hit.label, tone: hit.tone, pending: hit.pending };
  return { label: "状态未知", tone: "secondary", pending: false };
}

// ── Row model ────────────────────────────────────────────────────────

interface ApprovalRow {
  key: string;
  title: string;
  status: StatusView;
  rawStatus: string | null;
  requester: Person;
  worker: Person;
  submitted: string | null;
  deadline: string | null;
  amount: number | null;
  reason: string | null;
  rawId: string | null;
}

const ID_KEYS = ["approvalId", "approval_id", "id", "uuid"] as const;
const TITLE_KEYS = ["title", "summary", "subject", "name", "action", "tool", "request", "description"] as const;
const STATUS_KEYS = ["status", "state", "decision"] as const;
const REQUESTER_NAME_KEYS = ["requestedByName", "applicantName", "humanName", "requesterName", "ownerName"] as const;
const REQUESTER_ID_KEYS = ["requestedBy", "requested_by", "applicant", "human", "requester", "userId", "user_id"] as const;
const WORKER_NAME_KEYS = ["employeeName", "employee_name", "agentName", "agent_name", "assigneeName"] as const;
const WORKER_ID_KEYS = ["employee", "employeeId", "employee_id", "agent", "agentId", "agent_id", "assignee"] as const;
const SUBMITTED_KEYS = ["createdAt", "created_at", "submittedAt", "submitted_at", "requestedAt", "requested_at"] as const;
const DEADLINE_KEYS = ["expiresAt", "expires_at", "deadline", "validUntil", "valid_until", "expires"] as const;
const AMOUNT_KEYS = ["amountUsd", "amount_usd", "amount", "costUsd", "cost_usd", "cost"] as const;
const REASON_KEYS = ["reason", "note", "comment", "detail", "justification"] as const;
const LIST_KEYS = ["items", "approvals", "results", "entries", "data", "list"] as const;
const CURSOR_KEYS = ["nextCursor", "next_cursor", "next", "cursor", "nextPage", "next_page"] as const;

/** Sentences a person wrote. Stack traces, JSON and URLs are not sentences. */
function humanSentence(value: string | null): string | null {
  if (!value) return null;
  const oneLine = value.replace(/\s+/g, " ").trim();
  if (!oneLine || oneLine.length > 220) return null;
  if (/[{}<>]|\bat\s+\S+\.\S+|https?:\/\//i.test(oneLine)) return null;
  if (/^\d{3}\s/.test(oneLine)) return null;
  return oneLine;
}

function approvalRowFrom(item: unknown, index: number): ApprovalRow | null {
  const rec = asRecord(item);
  if (!rec) return null;
  const rawId = pickText(rec, ID_KEYS);
  const title = humanSentence(pickText(rec, TITLE_KEYS));
  // Neither handle nor caption: this row cannot be told apart from the next.
  if (!rawId && !title) return null;
  const rawStatus = pickText(rec, STATUS_KEYS);
  return {
    key: rawId ?? `approval-${index}`,
    title: title ?? "未写明事由的申请",
    status: statusView(rawStatus),
    rawStatus,
    requester: personView(rec, REQUESTER_NAME_KEYS, REQUESTER_ID_KEYS, "成员"),
    worker: personView(rec, WORKER_NAME_KEYS, WORKER_ID_KEYS, "员工"),
    submitted: beijing(pick(rec, SUBMITTED_KEYS)),
    deadline: beijing(pick(rec, DEADLINE_KEYS)),
    amount: pickNumber(rec, AMOUNT_KEYS),
    reason: humanSentence(pickText(rec, REASON_KEYS)),
    rawId,
  };
}

interface Page {
  rows: ApprovalRow[];
  unreadable: number;
  next: string | null;
}

/** null = the answer is not a list at all, which is a failure, not an empty queue. */
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
  const rows: ApprovalRow[] = [];
  let unreadable = 0;
  items.forEach((item, index) => {
    const row = approvalRowFrom(item, index);
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
 * The gateway's trace id, read from the error body — the shared fetch wrapper
 * hands callers the body, not the response headers. Absent falls back to the no-trace sentence; we
 * never invent an id.
 */
function requestIdFrom(body: string | undefined): string | null {
  if (!body) return null;
  const rec = asRecord(safeJson(body));
  if (!rec) return null;
  const direct = pickText(rec, REQUEST_ID_KEYS);
  if (direct) return direct;
  const detail = asRecord(rec.detail);
  return detail ? pickText(detail, REQUEST_ID_KEYS) : null;
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
  else sentence = humanSentence(errorMessage(err)) ?? "读取审批申请时出现问题，请稍后重试。";
  return { sentence, requestId, technical, authExpired: status === 401 };
}

function isDenied(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 403 || err.status === 404);
}

// ── Whole-panel states ───────────────────────────────────────────────

function DeniedPanel({ failure }: { failure: Failure | null }) {
  return (
    <Card role="alert" aria-label="审批申请不可用（403/404）" className="border-border bg-card">
      <CardContent className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={cn("text-sm", themedBody)}>暂时无法查看审批申请</p>
        <p className="max-w-prose text-xs text-muted-foreground">
          这块内容要么尚未对你开放，要么当前环境还没有提供它。这里不会显示任何猜测的内容。
          需要处理审批时，请联系工作区管理员为你开通。
        </p>
        <p className="text-xs text-muted-foreground">{reqLine(failure?.requestId)}</p>
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
          审批申请没能加载出来
        </div>
        <p className="text-xs text-muted-foreground">{failure.sentence}</p>
        <p className="text-xs text-muted-foreground">{reqLine(failure.requestId)}</p>
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
        <p className={cn("text-sm", themedBody)}>当前没有审批申请</p>
        <p className="max-w-prose text-xs text-muted-foreground">
          员工遇到需要你点头的操作时会提出申请，提出后立刻出现在这里。
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
          <div className="h-3 w-1/2 rounded-sm bg-muted" />
          <div className="mt-3 h-2.5 w-3/4 rounded-sm bg-muted/70" />
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

function ApprovalCard({ row }: { row: ApprovalRow }) {
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
            {row.status.label}
          </Badge>
        </div>

        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <Meta label="申请人" value={row.requester.label} title={row.requester.raw ?? undefined} />
          <Meta label="执行员工" value={row.worker.label} title={row.worker.raw ?? undefined} />
          <Meta label="提交" value={row.submitted ?? "—"} />
          <Meta
            label={row.status.pending ? "处理期限" : "原定期限"}
            value={row.deadline ?? "—"}
            title={row.deadline === null ? "服务未提供该时间" : undefined}
          />
          <Meta
            label="涉及金额"
            value={money(row.amount)}
            title={row.amount === null ? "服务未提供该数值" : undefined}
          />
        </dl>

        {row.reason && <p className="break-words text-xs text-muted-foreground">事由：{row.reason}</p>}
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

type Phase = "loading" | "ready" | "denied" | "error";

export default function ApprovalsPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [unreadable, setUnreadable] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pageFailure, setPageFailure] = useState<Failure | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // A stale answer must never overwrite a newer load (rapid refresh clicks).
  const seq = useRef(0);

  // Kicks off one request. It touches no state before the answer arrives, so the
  // mount effect stays a plain synchronization; the handlers below own the
  // "now loading" flags because a click is where that is a real user intent.
  const load = useCallback((cursor: string | null, append: boolean): Promise<void> => {
    const ticket = ++seq.current;
    const url = cursor ? `${APPROVALS_PATH}?cursor=${encodeURIComponent(cursor)}` : APPROVALS_PATH;
    const fresh = () => ticket === seq.current;
    return fetchJSON<unknown>(url)
      .then((payload) => {
        if (!fresh()) return;
        const page = pageFrom(payload);
        if (!page) {
          // A list we cannot locate is a failure, not an empty queue: painting
          // 「当前没有审批申请」 would claim the service said so.
          setRows([]);
          setUnreadable(0);
          setNext(null);
          setFailure({
            sentence: "服务返回的内容不是可识别的审批列表，未能读出任何记录。",
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

  const pending = rows.filter((row) => row.status.pending).length;

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground" aria-live="polite">
          {phase === "loading"
            ? "正在读取审批申请…"
            : phase === "ready"
              ? rows.length === 0
                ? "共 0 条审批申请"
                : `已显示 ${rows.length} 条审批申请，其中 ${pending} 条待处理${next ? "，下面还有更多" : ""}`
              : phase === "denied"
                ? "审批申请暂不可用"
                : "审批申请读取失败"}
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

      {phase === "denied" && <DeniedPanel failure={failure} />}

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
                <ApprovalCard key={row.key} row={row} />
              ))}
            </div>
          )}

          {unreadable > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              有 {unreadable} / {rows.length + unreadable} 条记录缺少可显示的内容，未列在上面。
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
            rows.length > 0 && <p className="text-xs text-muted-foreground">没有更多审批申请了。</p>
          )}
        </>
      )}
    </div>
  );
}
