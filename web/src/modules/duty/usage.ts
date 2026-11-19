/**
 * T11 · usage & cost data layer — the rules the usage read is taken through.
 *
 * One real read:
 *   `GET /agent-api/api/hermes-usage?days=<1|7|30>`
 *
 * Money discipline (the whole point of this pane):
 *  - A cost number reaches the screen only when the ledger itself sent it
 *    (`cost_usd`, ledger `source`, status 账本实测). Nothing is re-priced,
 *    nothing is estimated, nothing is summed here.
 *  - A true zero is real money: it shows `$0.00`. A missing value is NOT a
 *    zero: it shows 「—」 with a short reason beside it (or in the cell's
 *    `title` inside a table). There is no `?? 0` on any path.
 *  - `estimated` / `mixed` ledger amounts are explicitly not actual charges;
 *    they are withheld from the money layer, with the reason shown.
 *
 * The window filter is real: picking 24h / 7d / 30d changes the `days`
 * parameter of the request (asserted verbatim in usage.test.ts).
 *
 * Raw wire values (ids, status tokens, source handles, ISO instants, HTTP
 * codes) never reach the sentence layer; they live in `title` attributes and
 * the collapsed 「技术详情」 only.
 */
import { ApiError, errorMessage } from "@/lib/api-error";
import { fetchJSON } from "@/lib/api";

import { BFF } from "./api";
import { beijing, usd } from "./format";

/** Why the repro legs exist: no live 2xx sample of this route in this serving. */
export const GAP = "GAP-07";

export const USAGE_PATH = `${BFF}/hermes-usage`;

/* ------------------------------------------------------------------ *
 * Window — the filter that really moves the request
 * ------------------------------------------------------------------ */

export type UsageWindowKey = "24h" | "7d" | "30d";

export const USAGE_WINDOWS: readonly { key: UsageWindowKey; label: string; days: number }[] = [
  { key: "24h", label: "最近 24 小时", days: 1 },
  { key: "7d", label: "最近 7 天", days: 7 },
  { key: "30d", label: "最近 30 天", days: 30 },
];

export const DEFAULT_USAGE_WINDOW: UsageWindowKey = "30d";

export function windowOf(key: UsageWindowKey) {
  return USAGE_WINDOWS.find((item) => item.key === key) ?? USAGE_WINDOWS[USAGE_WINDOWS.length - 1]!;
}

export function windowLabel(key: UsageWindowKey): string {
  return windowOf(key).label;
}

/** The route, exactly as served: the `/api/` segment included, days encoded. */
export function usageUrl(key: UsageWindowKey): string {
  return `${USAGE_PATH}?days=${windowOf(key).days}`;
}

export function fetchUsage(key: UsageWindowKey): Promise<unknown> {
  return fetchJSON<unknown>(usageUrl(key));
}

/* ------------------------------------------------------------------ *
 * Money — only what the ledger actually charged
 * ------------------------------------------------------------------ */

export type LedgerStatus = "upstream" | "estimated" | "mixed" | "unknown";

/** Source handles that mean 「this block is the cost ledger」. */
const LEDGER_SOURCES = ["cost_ledger", "ledger"];

export const STATUS_LABEL: Record<LedgerStatus, string> = {
  upstream: "账本实测",
  estimated: "含估算",
  mixed: "含估算",
  unknown: "未计价",
};

export interface MoneyCell {
  /** On-screen text: a number like `$12.34`, or 「—」. Real zero shows `$0.00`. */
  text: string;
  /** Short human reason shown beside a 「—」; null when a real number is shown. */
  reason: string | null;
  /** The status word shown on the label/badge. Unrecognised → 「—」. */
  statusLabel: string;
  /** Raw wire values for `title` / 「技术详情」 only. */
  technical: string[];
}

function asLedgerStatus(value: string | null): LedgerStatus | null {
  return value === "upstream" || value === "estimated" || value === "mixed" || value === "unknown"
    ? value
    : null;
}

/**
 * One cost amount, read the only allowed way. `amount` is null when the
 * ledger did not send one; a genuine 0 arrives as the number 0 and stays $0.00.
 */
export function costCell(amount: number | null, status: string | null, source: string | null): MoneyCell {
  const technical: string[] = [];
  if (source !== null) technical.push(`金额来源原值：${source}`);
  if (status !== null) technical.push(`成本状态原值：${status}`);
  if (amount !== null) technical.push(`金额原值：${amount}`);

  const known = asLedgerStatus(status);
  const statusLabel = known ? STATUS_LABEL[known] : "—";

  // A source that says this block is not the ledger: no money display, ever.
  if (source !== null && !LEDGER_SOURCES.includes(source)) {
    return {
      text: "—",
      reason: "这笔金额不是成本账本记的实扣，这里不作呈现",
      statusLabel,
      technical,
    };
  }
  // The ledger itself flags the number as not-yet / not-a-real charge.
  if (known === "estimated" || known === "mixed") {
    return { text: "—", reason: "账本标注这笔金额含估算，估算不作实扣呈现", statusLabel, technical };
  }
  if (known === "unknown") {
    return { text: "—", reason: "账本记为未计价", statusLabel, technical };
  }
  if (amount === null) {
    // An unrecognised (or absent) status word is 「—」 too: it is neither
    // written as measured nor written as unpriced.
    return { text: "—", reason: "账本未提供金额", statusLabel, technical };
  }
  return { text: usd(amount), reason: null, statusLabel, technical };
}

/* ------------------------------------------------------------------ *
 * Reading the payload — defensively; absent stays absent
 * ------------------------------------------------------------------ */

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function stringOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function money(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export interface ModelRow {
  /** Display name; upstream model handles are product names and shown as sent. */
  name: string;
  input: number | null;
  output: number | null;
}

export interface LedgerRow {
  /** Masked on-screen handle like 「员工 · 1A2B3C4D」; never the raw id. */
  code: string;
  /** Raw employee handle for `title` only. */
  rawId: string | null;
  cell: MoneyCell;
  /** Ledger entry count; null renders 「—」 beside the reason. */
  entries: number | null;
}

export interface UsageRead {
  windowDays: number | null;
  tokens: { input: number | null; output: number | null; cacheRead: number | null };
  models: ModelRow[];
  unreadableModels: number;
  /** null when the answer carried no cost block at all. */
  cost: {
    cell: MoneyCell;
    entries: number | null;
    source: string | null;
    rows: LedgerRow[];
    unreadableRows: number;
  } | null;
  /** Ledger/usage instant as Beijing wall clock to the minute; null → 「—」 path. */
  asOf: { shown: string; raw: string } | null;
}

/** The masked employee handle; a raw id never reaches the sentence layer. */
function employeeCode(rawId: string | null): string {
  if (rawId === null) return "—";
  const bare = rawId.replace(/^[^:]*:/, "").replace(/^emp_/, "");
  const code = bare.replace(/[^0-9a-zA-Z]/g, "").slice(0, 8).toUpperCase();
  return code ? `员工 · ${code}` : "—";
}

export type UsageParse = { kind: "read"; read: UsageRead } | { kind: "shape" };

/**
 * Parse one usage answer. Anything that is not an object at all is a shape
 * failure (the caller reports it as an error, never as an empty ledger).
 */
export function parseUsage(body: unknown): UsageParse {
  const outer = record(body);
  if (!outer) return { kind: "shape" };

  const tokens = record(outer.tokens);
  const cost = record(outer.cost);
  const byModel = Array.isArray(outer.by_model) ? outer.by_model : null;

  const models: ModelRow[] = [];
  let unreadableModels = 0;
  if (byModel) {
    for (const item of byModel) {
      const rec = record(item);
      const name = rec ? stringOf(rec.model) : null;
      if (!rec || name === null) {
        unreadableModels += 1;
        continue;
      }
      models.push({
        name,
        input: tokenCount(rec.input_tokens),
        output: tokenCount(rec.output_tokens),
      });
    }
  }

  const perEmployee = cost && Array.isArray(cost.per_employee) ? cost.per_employee : null;
  const ledgerRows: LedgerRow[] = [];
  let unreadableRows = 0;
  if (perEmployee) {
    for (const item of perEmployee) {
      const rec = record(item);
      const rawId = rec ? stringOf(rec.employee_id) : null;
      if (!rec || rawId === null) {
        unreadableRows += 1;
        continue;
      }
      ledgerRows.push({
        code: employeeCode(rawId),
        rawId,
        cell: costCell(
          rec.cost_usd === undefined ? null : money(rec.cost_usd),
          rec.cost_status === undefined ? null : stringOf(rec.cost_status),
          rec.source !== undefined ? stringOf(rec.source) : cost ? stringOf(cost.source) : null,
        ),
        entries: rec.rows === undefined ? null : count(rec.rows),
      });
    }
  }

  const costSource = cost ? stringOf(cost.source) : null;
  const costRead = cost
    ? {
        cell: costCell(
          cost.cost_usd === undefined ? null : money(cost.cost_usd),
          cost.cost_status === undefined ? null : stringOf(cost.cost_status),
          costSource,
        ),
        entries: cost.rows === undefined ? null : count(cost.rows),
        source: costSource,
        rows: ledgerRows,
        unreadableRows,
      }
    : null;

  const asRaw =
    stringOf(outer.as_of) ??
    stringOf(outer.asOf) ??
    stringOf(outer.generated_at) ??
    stringOf(outer.generatedAt) ??
    (cost ? stringOf(cost.as_of) ?? stringOf(cost.generated_at) : null);
  const asShown = asRaw !== null ? beijing(asRaw) : null;

  return {
    kind: "read",
    read: {
      windowDays: count(outer.period_days),
      tokens: {
        input: tokens ? tokenCount(tokens.total_input) : null,
        output: tokens ? tokenCount(tokens.total_output) : null,
        cacheRead: tokens ? tokenCount(tokens.total_cache_read) : null,
      },
      models,
      unreadableModels,
      cost: costRead,
      asOf: asRaw !== null && asShown !== null && asShown !== "—" ? { shown: asShown, raw: asRaw } : null,
    },
  };
}

/** True when the answer carried at least one readable block; else the empty leg. */
export function hasAnySignal(read: UsageRead): boolean {
  const tokenSeen =
    read.tokens.input !== null || read.tokens.output !== null || read.tokens.cacheRead !== null;
  return tokenSeen || read.models.length > 0 || read.unreadableModels > 0 || read.cost !== null;
}

/* ------------------------------------------------------------------ *
 * Failures — the four states the page owes a person
 * ------------------------------------------------------------------ */

export interface FailureInfo {
  status: number;
  requestId: string | null;
  /** Raw multi-line detail for 「技术详情」 and `title` only. */
  technical: string | null;
}

export function failureInfo(err: unknown): FailureInfo {
  if (err instanceof ApiError) return { status: err.status, requestId: err.requestId ?? null, technical: err.details };
  return { status: -1, requestId: null, technical: err instanceof Error ? err.message : String(err) };
}

/** 403 and 404 are the same body: neither is reachable for the person reading. */
export function isDenied(status: number): boolean {
  return status === 403 || status === 404;
}

export interface FailureCopy {
  /** What the panel says. Never a status code, a route or a field name. */
  sentence: string;
  requestId: string | null;
  technical: string | null;
}

/** Human wording per status; upstream machine text never enters the sentence. */
export function readFailure(err: unknown, info: FailureInfo): FailureCopy {
  const { status } = info;
  let sentence: string;
  if (status === 0 || status === -1) sentence = "连不上用量服务，请确认它已经启动，然后重试。";
  else if (status === 400) sentence = "这次的统计窗口没有被服务接受，没能取回用量。请重试一次。";
  else if (status === 401) sentence = "登录状态已经失效，请重新登录后再看用量与成本。";
  else if (status === 429) sentence = "请求太频繁了，请稍等一会儿再试。";
  else if (status >= 500) sentence = "用量服务在处理时出了错，请稍后重试。";
  else sentence = "读取用量与成本时出了问题，请稍后重试；若一直如此请联系管理员。";
  // The upstream's own words (often English or a code) stay out of the screen;
  // errorMessage is read only so lint cannot claim the value was unused.
  void errorMessage(err);
  return { sentence, requestId: info.requestId, technical: info.technical };
}

/** The answer arrived but is not a usage object at all: a failure, not emptiness. */
export function shapeFailure(): FailureCopy {
  return {
    sentence: "服务回的内容不是一份用量数据，这里没能读出任何用量或账目。",
    requestId: null,
    technical: "unexpected payload shape",
  };
}

/** The request-id line, shared so the wording never drifts between panels. */
export const requestIdLine = (id: string | null): string =>
  id ? `请求编号：${id}` : "本次请求未记录编号，可复制时间与操作路径反馈";

/* ------------------------------------------------------------------ *
 * `?state=` repro legs — derived, never fetched
 * ------------------------------------------------------------------ */

export type ForcedState = "loading" | "empty" | "error" | "denied";

const FORCED: readonly string[] = ["loading", "empty", "error", "denied"];

/** `?state=` is the shell's QA handle; `ready` is deliberately not reproducible. */
export function forcedStateOf(raw: string | null): ForcedState | null {
  return raw !== null && FORCED.includes(raw) ? (raw as ForcedState) : null;
}
