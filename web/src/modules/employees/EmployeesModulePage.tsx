import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Clock, Inbox, Pencil, Plus, RefreshCw, Search, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button } from "@nous-research/ui";
import { useToast } from "@nous-research/ui/hooks/use-toast";
import { Toast } from "@nous-research/ui/ui/components/toast";

import { RequestIdCopy } from "@/components/RequestIdCopy";
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { Pill } from "@/components/console/Pill";

import { fetchJSON } from "@/lib/api";
import { API_UNREACHABLE_MESSAGE, ApiError, errorMessage, humanizeStatus } from "@/lib/api-error";
import { csrfWriteHeaders } from "@/lib/csrf";
import { ConsoleSelect } from "@/shell/ConsoleSelect";
import { CreateEmployeeModal, EMP_NAME_MAX, type CreatedRef, type VerifyOutcome } from "./CreateEmployeeModal";
import {
  BATCH_CONCURRENCY,
  batchHeadline,
  batchLine,
  EMPLOYEE_TRANSITION_ENDPOINT,
  LIFECYCLE_TARGET_STATES,
  runBatchTransitions,
  TRANSITION_WRITE_NOTE,
  type BatchSummary,
} from "./employees-batch";
import "./employees-density.css";

/** PE-08①：编辑保存的写口现实（PATCH 405 console.read_only，现网实测 2026-11-24）——
 *  抽屉与编辑钮如实渲染，保存钮 disabled+title 把原因钉在触点上；解除等 T-PE-D。 */
const EDIT_WRITE_NOTE =
  "写接口未接入（等 T-PE-D，PATCH 现 405 console.read_only）";

/** PE-09：批量流转的写口现实。域 `POST /v1/employees/{id}/transitions` 已活
 *  （services/domain/http_app.py:166-184），BFF 侧 `/api/employee-transition`
 *  未注册（curl 实测 405 console.read_only，原文见 DONE-PE-09.md）⇒ 按钮
 *  disabled + aria-disabled + title 原因，点击零请求零 toast；解除等 T-PE-E。 */
const BATCH_TRANSITION_ENABLED = false;

/** PE-09①：选择口径句。游标分页下服务端不回传「这一页之外还选了谁」，
 *  跨页记忆只能靠前端缓存——那会让「已选 n 人」与屏上所见脱节，故当场清空并写明。 */
const BATCH_SELECTION_SCOPE =
  "选择只在当前已加载的行内有效：翻页即清空，换筛选与刷新同样清空，不跨页记忆。";

/** PE-09：分母披露（CONSOLE-PRD-v4 §2）。draft/onboarding/archived 不入可上岗率分母。 */
const BATCH_DENOMINATOR_NOTE =
  "流转到「在岗 / 已暂停 / 离职中」计入可上岗率分母；「草稿 / 入职中 / 已归档」不入分母。";

/** PE-09：目标态词汇 = employee_models.py:102-108 冻结六态，文案报目标态本身，
 *  禁「启用/停用」这类臆造动作词。 */
const BATCH_TARGET_STATES = LIFECYCLE_TARGET_STATES.map((value) => ({
  value,
  label: `${lifecycleLabel(value)}（${value}）`,
}));

/** 冻结集里「不入分母」的三态，与 BATCH_DENOMINATOR_NOTE 同一词汇源。 */
const OUT_OF_DENOMINATOR = new Set(["draft", "onboarding", "archived"]);

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

/** PE-01: 带 ?cursor= 挂载时，从第一页起最多自动续取这么多页去找链接位置。
 *  现网实测（docs/_artifacts/PE-01/DONE.md）游标可按同参重复取回同集合，
 *  所以恢复不必依赖「一次性令牌还认不认」；上限只是防止数据异常时链式跑飞。 */
const RESTORE_MAX_HOPS = 10;

/** PE-01: 挂载时按链接游标恢复翻页位置的结果，只用于计数区的诚实说明。 */
type RestoreInfo = {
  hops: number;
  outcome: "reached" | "shortened" | "capped" | "failed";
};

/** PE-01: 链接游标恢复后的诚实说明 —— 计数区一行，只报「实际发生了什么」。 */
function restoreNoteText(info: RestoreInfo): string {
  if (info.outcome === "reached")
    return info.hops === 0
      ? "已从链接位置恢复（首页即到该位）"
      : `已从链接位置恢复 · 自动续取 ${info.hops} 页`;
  if (info.outcome === "shortened") return "原链接位置超出当前数据：已停在真实末页";
  if (info.outcome === "capped")
    return `原链接位置过远：续取 ${RESTORE_MAX_HOPS} 页仍未到，已如实停在续到的位置`;
  return "原链接位置续取失败：已显示此前加载的行";
}

const PAGE_SIZE = 50;

/** PE-09: 选择集合的空值单例——所有「当场清空」走同一引用，React 能认出无变化。 */
const EMPTY_SELECTED: ReadonlySet<string> = new Set<string>();

/** ② / ③ 数据与动作的形状分工：计数用胶囊（等宽数字、无 hover、不可点），
 *  动作才用按钮三级。标题行与导出组共用同一枚形状，避免「共 N 行」被读成幽灵按钮。 */
const COUNT_CHIP =
  "inline-flex h-6 items-center justify-center whitespace-nowrap rounded-full bg-white/5 px-2 text-xs tabular-nums text-white/60";

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
      department: raw.department === undefined ? undefined : pickString(raw.department),
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
  ariaLabel,
  sortKey,
  active,
  dir,
  onCycle,
  tip,
}: {
  label: ReactNode;
  ariaLabel?: string;
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
        aria-label={ariaLabel}
        className="inline-flex min-w-0 items-center gap-1 rounded-sm hover:text-[var(--color-text-ls)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--color-border-strong-ls)]"
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

/* ------------------------------------------------------------------ *
 * 2026-11-24 密度车道：列表页第二腿读数（矩阵 + 运行）。
 * 真读数、只认读口回传的形状：任何一腿失败/形状不认识 → 该列整列「—」，
 * 不补 0、不写示例数。运行窗口按最近 7 天、每页上限 100 条；
 * 服务端还给了下一页游标时，次数前缀「≥」并在 title 里写明窗口未取全。
 * ------------------------------------------------------------------ */

/** 矩阵读口一条：技能数与预算档（金额上限，不是已花金额）。 */
type MatrixFacts = {
  skillCount: number | null;
  monthlyCostUsd: number | null;
  perRunMaxUsd: number | null;
  dailyTokens: number | null;
};

/** 运行读口一条：窗口内次数、成功/失败计数、今日已花成本。 */
type RunFacts = { runs: number; completed: number; failed: number; costToday: number };

const RUNS_WINDOW_DAYS = 7;
const RUNS_LIMIT = 100;

const BUDGET_NOTE =
  "今日预算＝今天（北京时间）运行记录里的 costUsd 求和；日成本上限读口未按员工维度返回，斜杠后留「—」，不拿 token 档冒充美元。";
const RUNS_NOTE =
  `近 7 天运行次数：GET /api/runs 最近 ${RUNS_WINDOW_DAYS} 天窗口按 employeeId 归组；窗口未取全时前缀「≥」。`;

/** 北京时间当天 00:00 对应的 UTC 毫秒。 */
function beijingDayStartMs(nowMs: number): number {
  const bj = new Date(nowMs + 8 * 3_600_000);
  return Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate()) - 8 * 3_600_000;
}

/** 矩阵读口：只认 items[].employeeId；skillRefs 是引用编号，不上屏。 */
function readMatrixFacts(body: unknown): Map<string, MatrixFacts> {
  const map = new Map<string, MatrixFacts>();
  if (!isRecord(body) || !Array.isArray(body.items)) return map;
  for (const raw of body.items) {
    if (!isRecord(raw)) continue;
    const id = pickString(raw.employeeId);
    if (!id) continue;
    const budget = isRecord(raw.budget) ? raw.budget : null;
    const refs = Array.isArray(raw.skillRefs)
      ? raw.skillRefs.filter((ref): ref is string => typeof ref === "string")
      : [];
    const declared = pickNumber(raw.skillCount);
    map.set(id, {
      skillCount: declared ?? (refs.length > 0 ? refs.length : 0),
      monthlyCostUsd: budget ? pickNumber(budget.monthlyCostUsd) : null,
      perRunMaxUsd: budget ? pickNumber(budget.perRunMaxUsd) : null,
      dailyTokens: budget ? pickNumber(budget.dailyTokens) : null,
    });
  }
  return map;
}

/** 运行读口：形状不认识就整腿放弃（recognized=false），不拿行数冒充运行数。 */
function readRunsFacts(
  body: unknown,
  nowMs: number,
): { items: Map<string, RunFacts>; partial: boolean; recognized: boolean } {
  const items = new Map<string, RunFacts>();
  if (!isRecord(body) || !Array.isArray(body.items)) {
    return { items, partial: false, recognized: false };
  }
  const dayStart = beijingDayStartMs(nowMs);
  let valid = 0;
  for (const raw of body.items) {
    if (!isRecord(raw)) continue;
    const empId = pickString(raw.employeeId);
    const status = pickString(raw.status);
    if (!empId || !status) continue;
    valid += 1;
    const agg = items.get(empId) ?? { runs: 0, completed: 0, failed: 0, costToday: 0 };
    agg.runs += 1;
    if (status === "completed") agg.completed += 1;
    else if (status === "failed") agg.failed += 1;
    const started = Date.parse(String(raw.startedAt ?? raw.createdAt ?? ""));
    const cost = pickNumber(raw.costUsd);
    if (Number.isFinite(started) && started >= dayStart && cost !== null) agg.costToday += cost;
    items.set(empId, agg);
  }
  // 空窗口是真实答案（0 次）；有行却一条都不认识=读口形状变了，整腿放弃。
  const recognized = valid > 0 || body.items.length === 0;
  return { items, partial: Boolean(body.nextCursor ?? body.next_cursor), recognized };
}

/** 成功率 = completed ÷（completed + failed）；没有样本 → null（不补 0）。 */
function runRate(run: RunFacts | null): number | null {
  if (!run) return null;
  const denom = run.completed + run.failed;
  return denom > 0 ? run.completed / denom : null;
}

/* ------------------------------------------------------------------ *
 * 2026-11-24 密度车道③：页头摘要与页脚状态的真读数。
 * 名册口径取 GET /api/employee-stats（E14，全量、不受本页筛选影响），
 * 网关读数取 GET /api/health/sources。任一读口失败：数字位「—」，
 * 绝不拿已加载行数冒充全量之前先写明范围（见 title）。
 * ------------------------------------------------------------------ */

/** 名册四桶：与骨架 `N 名 · N 可上岗 · N 受限 · N 停用` 同序、同分母（合计=名册总数）。 */
export type RosterCounts = { total: number; active: number; limited: number; stopped: number };

export function readRosterCounts(body: unknown): RosterCounts | null {
  if (!isRecord(body)) return null;
  const total = pickNumber(body.total);
  const by = isRecord(body.byLifecycle) ? body.byLifecycle : null;
  if (total === null || by === null) return null;
  const at = (key: string) => pickNumber(by[key]) ?? 0;
  // 受限＝已暂停/离职中/草稿/入职中：四者都在派工之外，并起来才与名册总数对得上。
  return {
    total,
    active: at("active"),
    limited: at("paused") + at("offboarding") + at("draft") + at("onboarding"),
    stopped: at("suspended") + at("archived"),
  };
}

/** 网关读数：只认 sources[] 的 state 与条数；客户端数/队列长度没有读口，不显示也不编。 */
export type GatewayFacts = { ok: boolean; services: number; asOf: string | null };

export function readGatewayFacts(body: unknown): GatewayFacts | null {
  if (!isRecord(body) || !Array.isArray(body.sources) || body.sources.length === 0) return null;
  const states = body.sources.map((row) => (isRecord(row) ? pickString(row.state) : null));
  return {
    ok: states.every((state) => state === "ok"),
    services: states.length,
    asOf: pickString(body.asOf),
  };
}

/** 头像字：姓名首字（中文姓氏直接取第一个字符）。 */
function initialOf(row: EmployeeRow): string {
  const name = row.name?.trim();
  return name ? Array.from(name)[0] ?? "?" : "?";
}

function lifeTone(value?: string | null): "ok" | "warn" | "mut" | "info" {
  if (value === "active") return "ok";
  if (value === "paused" || value === "offboarding") return "warn";
  if (value === "suspended" || value === "archived") return "mut";
  if (value === "draft" || value === "onboarding") return "info";
  return "info";
}

function lifeTitle(value?: string | null): string {
  if (value === "active") return "可上岗：状态正常且未超日配额。";
  if (value === "paused") return "受限：已暂停，被策略挡在派工之外。";
  if (value === "suspended") return "停用：保留配置与历史，不接新任务。";
  if (value === "archived") return "已归档：保留历史，不出现在派工范围。";
  if (value === "draft") return "草稿：尚未入职，不在派工范围。";
  if (value === "onboarding") return "入职中：尚未进入派工范围。";
  if (value === "offboarding") return "离职中：不再接新任务。";
  return "该状态不在冻结六态内，按「待核实」展示，不猜语义。";
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
/** R96: 部门口径单点——列表桶与详情身份卡共用同一三态判据。 */
export const DEPT_UNLABELED_LABEL = "未标注部门";

export function departmentView(
  hasKey: boolean,
  value: string | null,
): { label: string; title: string | null } {
  if (!hasKey) return { label: FIELD_MISSING, title: FIELD_MISSING_TITLE };
  const trimmed = value?.trim() ?? "";
  if (!trimmed)
    return { label: DEPT_UNLABELED_LABEL, title: "读口带了部门键，但值为空：该员工未标注部门。" };
  return { label: trimmed, title: null };
}

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

const COPY_HEADER = "name,employee_no,lifecycle,last_active,department";

/** RFC4180：含逗号/引号/换行的值加引号，内部引号双写。 */
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** R110: 部门列——复制与 CSV 同 helper 同串，三态直接复用 R96
 * departmentView（真值原样 / 键在值空=未标注部门 / 键缺失=该字段未返回）；
 * CSV 里也写该句，不写空、不写「—」——缺的是语义值，不是格式字符。 */
function deptCopyValue(row: EmployeeRow): string {
  return departmentView(row.department !== undefined, row.department ?? null).label;
}

/** 屏上行序（sortedItems 已含当前排序）逐行拼表；缺值「—」不补 0。 */
function buildEmployeesCopyText(rows: EmployeeRow[]): { text: string; count: number } {
  const lines = rows.map((row) =>
    [
      csvCell(displayName(row)),
      csvCell(`员工 · ${shortCode(row.employeeId)}`),
      csvCell(lifecycleLabel(row.lifecycleState)),
      csvCell(beijingMinute(row.updatedAt) ?? "—"),
      csvCell(deptCopyValue(row)),
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
    <span className="flex min-w-0 flex-wrap items-center gap-[var(--space-2)]" role="group" aria-label="复制列表">
      <Button
        size="sm"
        data-testid="emp-list-copy"
        disabled={empty || phase !== "ready"}
        className="bg-transparent text-white/70 shadow-none hover:bg-white/5 hover:text-white active:invert-0"
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
        // R110: 部门列与复制同 helper 同串（缺值写三态句，不写空）。
        csvCell(deptCopyValue(row)),
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
    <span className="flex min-w-0 flex-wrap items-center gap-[var(--space-2)]" role="group" aria-label="导出 CSV">
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
      {/* 计数不是动作：胶囊形状、等宽数字，不再夹在两个按钮之间冒充幽灵按钮。 */}
      <span data-testid="emp-list-export-count" className={COUNT_CHIP} title="行数与屏上列表同源">
        共 {rows.length} 行
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * PE-08①：编辑抽屉（写路径预接）。T-PE-D 才开放 PATCH，本次只渲染形状：
 * 字段预填可读值，保存钮 disabled + aria-disabled + title 写明原因；
 * 点击零请求零 toast（jsdom 钉在 employees.create-modal.test.tsx）。
 * ------------------------------------------------------------------ */
function EditEmployeeDrawer({ row, onClose }: { row: EmployeeRow; onClose: () => void }) {
  const [name, setName] = useState(row.name ?? "");
  const [title, setTitle] = useState(row.title ?? "");
  const [department, setDepartment] = useState(row.department ?? "");
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`编辑员工：${displayName(row)}`}
        data-testid="emp-edit-drawer"
        className="flex h-full w-full max-w-sm flex-col gap-3 overflow-y-auto border-l border-white/15 bg-[#141414] p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-mondwest text-base">编辑员工</h2>
          <span className="font-mono text-xs text-white/45" title={row.employeeId}>
            员工 · {shortCode(row.employeeId)}
          </span>
        </div>
        <label className="flex min-w-0 flex-col gap-1 text-xs">
          <span className="text-white/55">姓名</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={EMP_NAME_MAX}
            className="min-w-0 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm"
            data-testid="emp-edit-name"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs">
          <span className="text-white/55">岗位</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="min-w-0 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm"
            data-testid="emp-edit-title"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs">
          <span className="text-white/55">部门</span>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            maxLength={120}
            className="min-w-0 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm"
            data-testid="emp-edit-department"
          />
        </label>
        <p className="text-xs text-white/45" data-testid="emp-edit-note">
          编辑保存写入口尚未开放（现网 PATCH 一律 405 console.read_only）。表单先就位，接入随 T-PE-D 一并放开，改动不会被静默丢弃。
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled
            aria-disabled="true"
            title={EDIT_WRITE_NOTE}
            data-testid="emp-edit-save"
            onClick={() => {
              /* 禁用预接：解锁前点击必须零请求零 toast；此处刻意什么都不做。 */
            }}
          >
            保存
          </Button>
          <Button size="sm" outlined onClick={onClose} data-testid="emp-edit-close">
            关闭
          </Button>
        </div>
      </div>
    </div>,
    document.body,
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
  // 2026-11-24 密度车道：矩阵/运行第二腿（列读数）。独立失败：不影响列表本身。
  const [enrichment, setEnrichment] = useState<{
    matrix: Map<string, MatrixFacts>;
    runs: Map<string, RunFacts>;
    runsPartial: boolean;
    runsPhase: "loading" | "ready" | "failed";
    budgetNote: string;
    runsNote: string;
  }>({
    matrix: new Map(),
    runs: new Map(),
    runsPartial: false,
    runsPhase: "loading",
    budgetNote: BUDGET_NOTE,
    runsNote: RUNS_NOTE,
  });
  // PE-01: URL 里的 cursor 语义 = 「上一页响应给出的下一页游标」。挂载时一次性
  // 取走它当恢复目标（之后由翻页写回，不再回读 URL），失败/换筛选即丢弃。
  const restoreTargetRef = useRef<string | null>(params.get("cursor"));
  const [restoreInfo, setRestoreInfo] = useState<RestoreInfo | null>(null);
  // 密度车道③：页头摘要（名册全量）与页脚网关读数，两条独立读口。
  const [roster, setRoster] = useState<RosterCounts | null>(null);
  const [gateway, setGateway] = useState<GatewayFacts | null>(null);
  // 已加载页数：页码位按真实加载页计（游标分页没有总页数，末页未知时显示 …）。
  const [pages, setPages] = useState(1);
  // 批量动作收进「更多」入口后，面板开合是页面本地状态。
  const [batchOpen, setBatchOpen] = useState(false);
  // R63: at most one row carries the inline preview (page-local state:
  // the URL is untouched and a reload collapses everything back).
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  // R67: roving tabindex — 行级只有一个 tab 位；↑/↓/Home/End 移焦，
  // Enter 展开该行预览（拦截跳转），Esc 收起并把焦点还给该行。
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLAnchorElement>());
  // PE-08①：新建模态 + 编辑抽屉（禁用预接）。
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<EmployeeRow | null>(null);
  // PE-09：行选择模型。键=employeeId，值集合只描述「当前已加载且当前可见」的行；
  // 任何列表替换（首页取数、翻页续取、换筛选、刷新）都当场清空 —— 见 BATCH_SELECTION_SCOPE。
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [batchTarget, setBatchTarget] = useState<string>("");
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchCopyStatus, setBatchCopyStatus] = useState<"idle" | "done" | "failed">("idle");
  // success toast 归页面：模态关闭卸载吞不掉回执（toast 仅在重读确认后由 onConfirmed 触发）。
  const { toast, showToast } = useToast();
  /** PE-09: 列表替换点的统一清空（选择 + 上一批回执 + 复制读数）。引用恒等，重复调用不触发额外渲染。 */
  const clearSelection = useCallback(() => {
    setSelected(EMPTY_SELECTED);
    setBatchSummary(null);
    setBatchError(null);
    setBatchCopyStatus("idle");
  }, []);
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

  /** PE-01: 同一套筛选参数下拼一页请求 —— 首页不带 cursor，续页带上游标。 */
  const pageQuery = (cursor: string | null) => {
    const query = new URLSearchParams();
    query.set("limit", String(PAGE_SIZE));
    query.set("expand", "version,knowledge");
    if (q) query.set("keyword", q);
    if (lifecycle) query.set("lifecycleState", lifecycle);
    if (cursor) query.set("cursor", cursor);
    return `/agent-api/api/employees?${query.toString()}`;
  };

  /** R58/PE-01 共用的续取处置：按工号去重追加，并把服务端最新给出的下一页游标
   *  写回 URL（null 即清键 —— 与「已到末页」同一口径，不留陈旧位置）。
   *  PE-09：翻页即清空选择（口径句 BATCH_SELECTION_SCOPE 同步上屏）。 */
  const mergeAppended = (parsed: ReturnType<typeof readRows>) => {
    clearSelection();
    setPages((n) => n + 1);
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
    patchParams({ cursor: parsed.nextCursor });
  };

  /** PE-01 恢复：从首屏起，只用「本页响应自己给出的 nextCursor」逐页续取，直到它
   *  等于链接里的目标游标（= 回到原位）或撞到真实末页/上限。链接里那个 cursor 值
   *  本身一次都不发出去 —— 那是拿外部输入猜服务端状态，猜歪就是半屏错位数据。 */
  const resumeFromLink = async (from: string | null, target: string, isCancelled: () => boolean) => {
    let cursor = from;
    let hops = 0;
    while (cursor && cursor !== target && hops < RESTORE_MAX_HOPS) {
      hops += 1;
      setState((prev) => ({ ...prev, loadingMore: true }));
      let parsed: ReturnType<typeof readRows>;
      try {
        parsed = readRows(await fetchJSON<unknown>(pageQuery(cursor)));
      } catch (err) {
        if (isCancelled()) return;
        // 失败态不碰 URL：已写回的键位仍对应已加载的行。
        setState((prev) => ({ ...errorState(err), items: prev.items }));
        setRestoreInfo({ hops: hops - 1, outcome: "failed" });
        return;
      }
      if (isCancelled()) return;
      mergeAppended(parsed);
      cursor = parsed.nextCursor;
    }
    if (isCancelled()) return;
    if (cursor === target) setRestoreInfo({ hops, outcome: "reached" });
    else if (!cursor) setRestoreInfo({ hops, outcome: "shortened" });
    else setRestoreInfo({ hops, outcome: "capped" });
    // 数据变短/超出上限：链接位置在当前数据里已不存在，键位如实清掉。
    if (cursor !== target) patchParams({ cursor: null });
  };

  useEffect(() => {
    // PE-01: 关键词一变，已加载位置即作废——同一次写回里清掉 cursor 键。
    if (debounced !== q) patchParams({ q: debounced || null, cursor: null });
  }, [debounced]);

  // PE-09: 换筛选（keyword / lifecycle / 部门桶）即清空选择。部门桶是前端本地过滤、
  // 不走取数腿，单列在这里；取数腿自己也会清，两处同引用不产生额外渲染。
  useEffect(() => {
    clearSelection();
  }, [q, lifecycle, dept, clearSelection]);

  useEffect(() => {
    // PE-01: 恢复目标只在挂载那一趟生效；换筛选/重试都算从头开始。
    const target = restoreTargetRef.current;
    restoreTargetRef.current = null;
    setRestoreInfo(null);
    // PE-09: 列表一换（首取/换筛选/刷新）即清空选择与上一批回执——
    // 屏上的行已经不是刚才那批行了。
    clearSelection();
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
    setPages(1);
    fetchJSON<unknown>(pageQuery(null))
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
        // PE-01: 只有取数成功才碰 URL；失败腿（下面 catch）一律不写。
        if (target && parsed.nextCursor === target) setRestoreInfo({ hops: 0, outcome: "reached" });
        else if (target) void resumeFromLink(parsed.nextCursor, target, () => cancelled);
        else if (parsed.nextCursor === null) patchParams({ cursor: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState((prev) => ({ ...errorState(err), items: prev.items }));
      });
    return () => {
      cancelled = true;
    };
  }, [q, lifecycle, reload, forced, forcedRid]);

  // 第二腿：矩阵（技能/预算档）+ 运行（近 7 天次数、成功率、今日已花）。
  // 失败不冒泡到列表：列一律「—」。请求顺序上列表腿先发（calls[0] 恒为 employees）。
  useEffect(() => {
    let cancelled = false;
    const nowMs = Date.now();
    const since = new Date(nowMs - RUNS_WINDOW_DAYS * 86_400_000).toISOString();
    setEnrichment((prev) => ({ ...prev, runsPhase: "loading" }));
    fetchJSON<unknown>("/agent-api/api/matrix")
      .then((body) => {
        if (cancelled) return;
        const matrix = readMatrixFacts(body);
        setEnrichment((prev) => ({ ...prev, matrix }));
      })
      .catch(() => {
        if (cancelled) return;
        setEnrichment((prev) => ({ ...prev, matrix: new Map() }));
      });
    fetchJSON<unknown>(`/agent-api/api/runs?since=${encodeURIComponent(since)}&limit=${RUNS_LIMIT}`)
      .then((body) => {
        if (cancelled) return;
        const parsed = readRunsFacts(body, nowMs);
        setEnrichment((prev) => ({
          ...prev,
          runs: parsed.items,
          runsPartial: parsed.partial,
          runsPhase: parsed.recognized ? "ready" : "failed",
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setEnrichment((prev) => ({ ...prev, runs: new Map(), runsPartial: false, runsPhase: "failed" }));
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  // 密度车道③：页头摘要（名册全量）与页脚网关读数。两条独立读口，各自失败各自「—」：
  // 名册读口失败时不拿「已加载 N 人」冒充全量，网关读口失败时整段中性「—」。
  useEffect(() => {
    let cancelled = false;
    fetchJSON<unknown>("/agent-api/api/employee-stats")
      .then((body) => {
        if (!cancelled) setRoster(readRosterCounts(body));
      })
      .catch(() => {
        if (!cancelled) setRoster(null);
      });
    fetchJSON<unknown>("/agent-api/api/health/sources")
      .then((body) => {
        if (!cancelled) setGateway(readGatewayFacts(body));
      })
      .catch(() => {
        if (!cancelled) setGateway(null);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const counts = useMemo(() => {
    let active = 0;
    let limited = 0;
    let stopped = 0;
    for (const row of state.items) {
      if (row.lifecycleState === "active") active += 1;
      else if (row.lifecycleState === "suspended" || row.lifecycleState === "archived") stopped += 1;
      else limited += 1;
    }
    return { active, limited, stopped };
  }, [state.items]);

  const filtered = Boolean(q || lifecycle || dept);

  /** 页头摘要：优先进名册全量读口；读口未回时按已加载行计数（title 写明范围）；
   *  列表未就绪且无名册读数 → null（上屏「—」，不补 0）。 */
  const summary = useMemo<RosterCounts | null>(() => {
    if (roster) return roster;
    if (state.phase === "ready" || state.phase === "empty") {
      return {
        total: state.items.length,
        active: counts.active,
        limited: counts.limited,
        stopped: counts.stopped,
      };
    }
    return null;
  }, [roster, state.phase, state.items.length, counts]);

  // R62: column sorting. Measured GET /api/employees with sort=name&order=desc,
  // sortBy=lifecycleState or sort=createdAt&dir=asc all return the same order
  // (200, same 3 rows) — the read port ignores sort parameters. To avoid
  // pretending a server sort, only the loaded rows are ordered locally and the
  // scope is stated above the table.
  const sort = params.get("sort");
  const dir: "asc" | "desc" = params.get("dir") === "desc" ? "desc" : "asc";
  const sortActive = sort === "name" || sort === "code" || sort === "state" || sort === "time";
  const cycleSort = (key: SortKey) => {
    // PE-01: 视图口径一变即清位置键，防筛选后残留旧位。
    if (sort !== key) patchParams({ sort: key, dir: "asc", cursor: null });
    else if (dir === "asc") patchParams({ sort: key, dir: "desc", cursor: null });
    else patchParams({ sort: null, dir: null, cursor: null });
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

  /* ------------------------------------------------------------------ *
   * PE-09①：选择模型。键=employeeId，计数只认屏上可见行——被部门桶滤掉的行
   * 不记进「已选 n」，免得读数与一屏所见自相矛盾。列表替换点（首取/翻页/
   * 换筛选/刷新）统一 clearSelection()，口径句见 BATCH_SELECTION_SCOPE。
   * ------------------------------------------------------------------ */
  const selectedRows = useMemo(
    () => visibleItems.filter((row) => selected.has(row.employeeId)),
    [visibleItems, selected],
  );
  const selectedCount = selectedRows.length;
  const allVisibleSelected =
    state.phase === "ready" && visibleItems.length > 0 && selectedCount === visibleItems.length;

  const toggleRow = (employeeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
    setBatchSummary(null);
    setBatchCopyStatus("idle");
  };

  const toggleAllVisible = () => {
    setSelected(
      allVisibleSelected ? EMPTY_SELECTED : new Set(visibleItems.map((row) => row.employeeId)),
    );
    setBatchSummary(null);
    setBatchCopyStatus("idle");
  };

  /* PE-09②：批量复制/导出——纯前端，值与屏上逐字同源（同一个 copy/CSV builder），
   * 只作用在勾选行上；零新端点、零额外请求，剪贴板被拒时给可手动复制的文本框。 */
  const batchCopyText = useMemo(
    () => buildEmployeesCopyText(selectedRows),
    [selectedRows],
  );
  const copySelected = () => {
    const write = navigator.clipboard?.writeText;
    if (!write) {
      setBatchCopyStatus("failed");
      return;
    }
    write.call(navigator.clipboard, batchCopyText.text).then(
      () => setBatchCopyStatus("done"),
      () => setBatchCopyStatus("failed"),
    );
  };

  const exportSelected = () => {
    if (typeof URL.createObjectURL !== "function") return;
    const blob = new Blob([buildEmployeesCsv(selectedRows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvTimestamp(new Date());
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /* PE-09③④：批量流转。写路由未注册期直接返回——零请求、零 toast、零改写；
   * 按钮另以 disabled + aria-disabled + title 把原因钉在触点上。
   * 接入后：逐 id 串行提交、前端限并发 BATCH_CONCURRENCY、一单失败不断整批、
   * 聚合报「成功 n / 失败 m」并逐字附各失败原因；成功后重读列表（禁乐观改写）。 */
  const submitBatchTransition = async () => {
    if (!BATCH_TRANSITION_ENABLED) return;
    if (selectedCount === 0 || !batchTarget) return;
    const csrf = csrfWriteHeaders();
    if (!csrf) {
      setBatchError("需要登录后才能提交流转。当前没有可用的写入会话，请先登录。");
      return;
    }
    setBatchRunning(true);
    setBatchError(null);
    setBatchSummary(null);
    const summary = await runBatchTransitions(
      selectedRows.map((row) => row.employeeId),
      {
        to: batchTarget,
        reason: `管理台批量流转 → ${lifecycleLabel(batchTarget)}`,
        concurrency: BATCH_CONCURRENCY,
        post: async (_employeeId, body) => {
          // 幂等键按「这一单」生成（每轮新键）；_employeeId 已在 body.employeeId 里，
          // 路由是 path_from_body 形制，URL 本身不带 id。
          const idem =
            typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `idem-${Date.now()}`;
          return fetchJSON<unknown>(EMPLOYEE_TRANSITION_ENDPOINT, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "Idempotency-Key": idem,
              "X-Request-Id": idem,
              ...csrf,
            },
            body: JSON.stringify(body),
          });
        },
      },
    );
    setBatchSummary(summary);
    setBatchRunning(false);
    // 屏上在职态仍是本次读取时的值：写口不给「新状态」读列，故不乐观改写、也不自动重取，
    // 由人点「刷新」按服务端重读（刷新会按口径清掉这批回执）。
  };

  const batchTargetLabel = BATCH_TARGET_STATES.find((s) => s.value === batchTarget)?.label ?? null;

  const retry = () => {
    // PE-01: 刷新是从第一页重取，链接里的位置键当场作废（不留陈旧游标冒充原位）。
    restoreTargetRef.current = null;
    patchParams({ cursor: null });
    setReload((n) => n + 1);
  };

  // ③ 「加载更多」在没有下一页（或非 ready）时保留文案与原因，但既不响应、
  // 也不进 tab 序列：原生 disabled 已不可聚焦，这里再显式坐实 tabIndex=-1。
  const moreDisabled = state.phase !== "ready" || !state.nextCursor || state.loadingMore;

  // R58: real cursor paging. Same filter query plus the server's nextCursor;
  // appended rows are deduplicated by employeeId (never repeat a row).
  // PE-01: 成功后由 mergeAppended 把下一页游标写进 URL，刷新即回此位。
  const loadMore = () => {
    if (state.phase !== "ready" || !state.nextCursor || state.loadingMore) return;
    setState((prev) => ({ ...prev, loadingMore: true }));
    fetchJSON<unknown>(pageQuery(state.nextCursor))
      .then((body) => mergeAppended(readRows(body)))
      .catch((err: unknown) => setState((prev) => ({ ...errorState(err), items: prev.items })));
  };

  /** PE-08① 成功语义：POST 2xx 后重读列表第一页（禁乐观插入——行只可能来自
   *  这次真实应答），按回执 id 或提交名核对新员工是否在列。 */
  const verifyCreated = async (created: CreatedRef): Promise<VerifyOutcome> => {
    if (forced) {
      // ?state= 预览壳没有真列表可重读：不假验，如实回报。
      return { k: "refetch-failed", message: "当前是状态预览（?state=），列表未真实重读。" };
    }
    try {
      const body = await fetchJSON<unknown>(pageQuery(null));
      const parsed = readRows(body);
      setPages(1);
      setState({
        phase: parsed.rows.length ? "ready" : "empty",
        items: parsed.rows,
        status: 200,
        nextCursor: parsed.nextCursor,
        total: parsed.total,
        loadingMore: false,
      });
      const targetName = created.name.trim();
      const found = parsed.rows.some(
        (row) => (created.id !== null && row.employeeId === created.id) || row.name?.trim() === targetName,
      );
      return found ? { k: "found" } : { k: "absent" };
    } catch (err: unknown) {
      return { k: "refetch-failed", message: errorMessage(err) };
    }
  };

  /* 密度车道④：批量动作（全选 / 复制所选 / 导出所选 / 批量流转）收进页头右端的
     「更多」入口，不再占一整块高度；口径句随面板展开，默认屏上只有一枚入口钮。 */
  const moreMenu =
    state.phase === "ready" && visibleItems.length > 0 ? (
      <span className="emp-more" data-testid="emp-more">
        <Button
          size="sm"
          outlined
          data-testid="emp-more-trigger"
          aria-expanded={batchOpen}
          aria-controls="emp-more-panel"
          onClick={() => setBatchOpen((open) => !open)}
          title="批量动作：全选 / 复制所选 / 导出所选 / 批量流转（写口未接入，禁用）"
        >
          更多
        </Button>
        {batchOpen ? (
          <div className="emp-more__panel" id="emp-more-panel" data-testid="emp-more-panel">
            <div className="emp-batch" data-testid="emp-batch-bar">
              <div className="emp-batch__body">
                <div className="emp-batch__row">
                  <button
                    type="button"
                    data-testid="emp-batch-select-all"
                    role="checkbox"
                    aria-checked={allVisibleSelected}
                    onClick={toggleAllVisible}
                    title={`勾选或取消屏上全部 ${visibleItems.length} 行（只作用当前可见行；不发请求）`}
                    className="emp-dept-chip"
                  >
                    {allVisibleSelected ? "取消全选" : "全选本页"}
                  </button>
                  <span className={COUNT_CHIP} data-testid="emp-batch-count">
                    已选 {selectedCount} / {visibleItems.length}
                  </span>
                  <Button
                    size="sm"
                    outlined
                    data-testid="emp-batch-copy"
                    disabled={selectedCount === 0}
                    onClick={copySelected}
                    title={
                      selectedCount === 0
                        ? "没有勾选任何行：先在左侧勾选，再复制。"
                        : `复制勾选的 ${selectedCount} 行（纯前端，按屏上行序，零新请求）；范围不含未勾选与未加载的人。`
                    }
                  >
                    复制所选
                  </Button>
                  <Button
                    size="sm"
                    outlined
                    data-testid="emp-batch-export"
                    disabled={selectedCount === 0}
                    onClick={exportSelected}
                    title={
                      selectedCount === 0
                        ? "没有勾选任何行：先在左侧勾选，再导出。"
                        : `导出勾选的 ${selectedCount} 行为 CSV（纯前端 Blob，零新端点）；导出的是所选，不是全量。`
                    }
                  >
                    导出所选 CSV
                  </Button>
                </div>
                <div className="emp-batch__row">
                  <ConsoleSelect
                    value={batchTarget}
                    onChange={(next) => {
                      setBatchTarget(next);
                      setBatchSummary(null);
                    }}
                    options={[
                      { value: "", label: "选择目标在职态", disabled: true },
                      ...BATCH_TARGET_STATES.map((item) => ({
                        value: item.value,
                        label: item.label,
                      })),
                    ]}
                    data-testid="emp-batch-target"
                    aria-label="批量流转目标在职态"
                    title={
                      "目标态取自域冻结六态（employee_models.py），文案报的是目标态本身；" +
                      `选到「草稿 / 入职中 / 已归档」会把该员工移出可上岗率分母。提交钮原因：${TRANSITION_WRITE_NOTE}`
                    }
                    className="emp-select"
                  />
                  <Button
                    size="sm"
                    data-testid="emp-batch-transition"
                    disabled
                    aria-disabled="true"
                    title={
                      `${TRANSITION_WRITE_NOTE}；` +
                      (selectedCount === 0
                        ? "并且没有勾选任何行。"
                        : `已勾 ${selectedCount} 行，接入后按目标态${batchTargetLabel ? `「${batchTargetLabel}」` : "（未选）"}逐单提交。`)
                    }
                    onClick={() => {
                      void submitBatchTransition();
                    }}
                  >
                    批量流转
                  </Button>
                  {batchTarget && OUT_OF_DENOMINATOR.has(batchTarget) ? (
                    <span data-testid="emp-batch-denominator-flag" className="emp-batch__prose emp-warn">
                      已选目标态「{batchTargetLabel}」不入分母。
                    </span>
                  ) : null}
                </div>
                <span className="emp-batch__prose" data-testid="emp-batch-copy-status" aria-live="polite">
                  {batchCopyStatus === "done"
                    ? `已复制 ${selectedCount} 行`
                    : batchCopyStatus === "failed"
                      ? "剪贴板写入被拒绝，可用下方文本框手动复制。"
                      : ""}
                </span>
                {batchCopyStatus === "failed" ? (
                  <textarea
                    data-testid="emp-batch-copy-fallback"
                    readOnly
                    rows={4}
                    value={batchCopyText.text}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full min-w-0 rounded-sm border border-[var(--color-border-ls)] bg-transparent p-2 font-mono text-xs"
                    aria-label="批量复制兜底文本框"
                    title="内容与点击复制的目标逐字相同；手动选择后复制。"
                  />
                ) : null}
                <p className="emp-batch__prose" data-testid="emp-batch-write-note">
                  {BATCH_TRANSITION_ENABLED
                    ? `接入后逐单提交：并发上限 ${BATCH_CONCURRENCY}，一单失败不断整批，回执逐字附原因。`
                    : `${TRANSITION_WRITE_NOTE}。按钮已禁用，点击不发请求也不报成功。`}
                </p>
                <p className="emp-batch__prose" data-testid="emp-batch-denominator">
                  {BATCH_DENOMINATOR_NOTE}
                </p>
                <p className="emp-batch__prose" data-testid="emp-batch-scope">
                  {BATCH_SELECTION_SCOPE} 勾选与批量动作都不出屏上所见：共 {state.items.length} 人已加载，
                  其中 {visibleItems.length} 行可见、{selectedCount} 行已选。
                </p>
                {batchError ? (
                  <p className="emp-batch__prose emp-warn" data-testid="emp-batch-error" role="alert">
                    {batchError}
                  </p>
                ) : null}
                {batchSummary ? (
                  <div className="min-w-0 space-y-1" data-testid="emp-batch-result">
                    <p className="text-xs" data-testid="emp-batch-result-headline">
                      {batchRunning ? "提交中…" : batchHeadline(batchSummary)}
                    </p>
                    <ul className="min-w-0 space-y-0.5 text-xs text-[var(--color-text-faint-ls)]" data-testid="emp-batch-result-lines">
                      {batchSummary.results.map((item) => (
                        <li key={item.employeeId}>
                          {batchLine(item, (id) => {
                            const row = state.items.find((r) => r.employeeId === id);
                            return row ? displayName(row) : shortCode(id);
                          })}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </span>
    ) : null;

return (
    <section className="employees-page" data-testid="employees-module">
      {/* 页头：骨架的一行副行 = 名册真读数（不是第二个 h1，h1 只在 shell TopBar）+
          右侧页面动作。读数来自 /api/employee-stats（全量名册），读口未回时按已加载行
          计数并在 title 里写明范围。 */}
      <div className="emp-pagehead" data-testid="emp-page-head">
        <p
          className="emp-pagehead__sum"
          data-testid="emp-page-summary"
          title={
            roster
              ? "口径：GET /api/employee-stats 全量名册，不受本页筛选影响。受限＝已暂停/离职中/草稿/入职中（都不在派工范围）；停用＝已停用/已归档。"
              : summary
                ? `统计读口未返回：这里按当前已加载 ${state.items.length} 人计数，不是全量名册。`
                : "统计读口未返回，列表也还没就绪：数字位以「—」占位，不是 0。"
          }
        >
          <b className="emp-pagehead__n">{summary ? summary.total : "—"}</b> 名
          <span className="emp-pagehead__sep" aria-hidden="true">·</span>
          <b className="emp-pagehead__n">{summary ? summary.active : "—"}</b> 可上岗
          <span className="emp-pagehead__sep" aria-hidden="true">·</span>
          <b className="emp-pagehead__n">{summary ? summary.limited : "—"}</b> 受限
          <span className="emp-pagehead__sep" aria-hidden="true">·</span>
          <b className="emp-pagehead__n">{summary ? summary.stopped : "—"}</b> 停用
        </p>
        <div className="emp-toolbar" role="group" aria-label="页面动作">
          <ListCopyButton rows={visibleItems} totalLoaded={state.items.length} phase={state.phase} />
          <ListExportButton rows={visibleItems} totalLoaded={state.items.length} phase={state.phase} />
          {moreMenu}
          <Button
            size="sm"
            outlined
            data-testid="employees-create-open"
            disabled={state.phase !== "ready" && state.phase !== "empty"}
            title={
              state.phase === "ready" || state.phase === "empty"
                ? "打开新建员工模态（POST 走员工服务真接口）"
                : `暂不能新建：${phaseReason(state.phase) ?? ""}列表恢复后自动可用。`
            }
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            新建员工
          </Button>
          <Button size="sm" data-testid="employees-refresh" onClick={retry}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            刷新
          </Button>
        </div>
      </div>

      <ConsoleCard data-testid="employees-list-card" flush>
        {/* filterbar —— 骨架一行：搜索 + 部门 + 状态 + 筛选 + 右侧条数与页码。
            部门保留本地过滤能力，但收成同一行里的下拉，不再占一行分段 chips。 */}
        <div className="emp-filterbar emp-filter-row" data-testid="emp-filter-row">
          <span data-testid="emp-l-search" className="emp-filter-search">
            <label className="emp-search">
              <Search className="emp-search__icon h-3.5 w-3.5" aria-hidden="true" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索名称、工号、技能"
                className="emp-search__input emp-filter-control"
                data-testid="employees-search"
                aria-label="搜索员工"
              />
            </label>
          </span>
          <span data-testid="emp-l-filter-dept" className="emp-filter-select">
            <ConsoleSelect
              value={dept ?? ""}
              onChange={(next) => patchParams({ dept: next || null, cursor: null })}
              className="emp-select"
              data-testid="emp-list-dept-select"
              aria-label="按部门筛选"
              disabled={state.phase !== "ready"}
              title={
                state.phase !== "ready"
                  ? `不能按部门筛选：${phaseReason(state.phase)}；恢复列表后自动可用。`
                  : "部门桶按当前已加载行现算；切换是前端本地过滤，不发新请求，也不影响服务端游标。"
              }
              options={[
                { value: "", label: "全部部门" },
                ...deptBuckets.map(([key, count]) => ({
                  value: key,
                  label: `${key === NONE_DEPT ? DEPT_UNLABELED_LABEL : key} · ${count}`,
                })),
              ]}
            />
          </span>
          <span data-testid="emp-l-filter-lifecycle" className="emp-filter-select">
            <ConsoleSelect
              value={lifecycle}
              onChange={(next) => patchParams({ lifecycle: next || null, cursor: null })}
              className="emp-select"
              data-testid="employees-lifecycle"
              aria-label="按在职态筛选"
              options={[
                { value: "", label: "全部状态" },
                { value: "active", label: "在岗" },
                { value: "paused", label: "已暂停" },
                { value: "suspended", label: "已停用" },
              ]}
            />
          </span>
          <Button
            size="sm"
            className="emp-filter-apply"
            data-testid="employees-filter"
            onClick={() => setDebounced(keyword.trim())}
            title="立即应用搜索词（输入本身已做 300ms 防抖）"
          >
            筛选
          </Button>
          {filtered ? (
            <Button
              size="sm"
              outlined
              className="emp-filter-apply"
              onClick={() => {
                setKeyword("");
                setDebounced("");
                patchParams({ q: null, lifecycle: null, dept: null, cursor: null });
              }}
              data-testid="employees-clear"
            >
              清除
            </Button>
          ) : null}
          <span className="emp-grow" />
          <span className="emp-meta mono" data-testid="emp-list-page-count-top">
            <span
              data-testid="emp-list-count"
              title={
                state.phase === "ready"
                  ? "计数与列表同源：当前屏上可见行数（服务端返回经本地部门过滤）"
                  : phaseReason(state.phase) ?? undefined
              }
            >
              {state.phase === "ready" ? visibleItems.length : "—"}
            </span>{" "}
            条 · 第 {state.phase === "ready" ? pages : "—"}/
            {state.phase === "ready" ? (state.nextCursor ? "…" : pages) : "—"} 页
          </span>
        </div>

        {/* R69: 四态+分页条统一容器，data-phase 供自动化锁定当前态。 */}
        <div className="emp-statewrap" data-testid="emp-list-state" data-phase={state.phase}>
          {state.phase === "loading" ? (
            <div className="emp-state" data-testid="employees-loading">
              <div className="emp-state__body" data-testid="emp-list-state-loading">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="emp-skeleton animate-pulse" />
                ))}
              </div>
            </div>
          ) : null}

          {state.phase === "denied" ? (
            <div className="emp-state" data-testid="employees-denied">
              <div className="emp-state__body emp-state__body--stack" data-testid="emp-list-state-denied">
                <ShieldAlert className="h-4 w-4 text-[var(--color-warning-ls)]" />
                <p className="text-sm">员工列表暂不可见</p>
                <p className="text-xs text-[var(--color-text-subtle-ls)]">
                  该数据源尚未开放，或你没有查看权限。请确认后台已接入对应服务，或联系管理员开通权限。
                </p>
                <Button size="sm" outlined onClick={retry} data-testid="employees-denied-retry">
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  重试
                </Button>
              </div>
            </div>
          ) : null}

          {state.phase === "error" ? (
            <div className="emp-state" data-testid="employees-error" data-emp-list-page-error="true">
              <div className="emp-state__body emp-state__body--stack" data-testid="emp-list-state-error">
                <TriangleAlert className="h-4 w-4 text-[var(--color-warning-ls)]" />
                <p className="text-sm">员工列表没能加载出来</p>
                <p className="text-xs text-[var(--color-text-subtle-ls)]">{state.message || humanizeStatus(state.status)}</p>
                <p className="font-mono text-xs text-[var(--color-text-faint-ls)]" data-testid="emp-list-state-rid">
                  <RequestIdCopy
                    requestId={state.requestId}
                    fallback="本次请求未记录编号，可复制时间与操作路径反馈"
                  />
                </p>
                <span data-testid="emp-list-state-retry">
                  <Button size="sm" outlined onClick={retry} data-testid="employees-error-retry">
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    重试
                  </Button>
                </span>
              </div>
            </div>
          ) : null}

          {state.phase === "empty" ? (
            <div className="emp-state" data-testid="employees-empty" data-emp-list-empty="true">
              <div className="emp-state__body emp-state__body--center" data-testid="emp-list-state-empty">
                <Inbox className="h-5 w-5 text-[var(--color-text-faint-ls)]" />
                <p className="text-sm" data-testid="emp-list-empty-text">
                  <span data-testid="emp-list-state-empty-text">{filtered ? "没有匹配的员工" : "还没有数字员工"}</span>
                </p>
                {filtered ? (
                  <>
                    <p className="text-xs text-[var(--color-text-subtle-ls)]">换个关键词或放宽筛选条件后再试。</p>
                    <Button
                      size="sm"
                      outlined
                      data-testid="emp-list-state-clear"
                      onClick={() => {
                        setKeyword("");
                        setDebounced("");
                        patchParams({ q: null, lifecycle: null, dept: null, cursor: null });
                      }}
                    >
                      清除筛选
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-[var(--color-text-subtle-ls)]">点「新建员工」创建第一位数字员工，创建确认后会出现在这里。</p>
                    <Button size="sm" data-testid="employees-empty-create" onClick={() => setCreateOpen(true)}>
                      <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                      新建员工
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {dept !== null && state.phase === "ready" && visibleItems.length === 0 ? (
            <div className="emp-state" data-testid="emp-list-dept-empty">
              <div className="emp-state__body emp-state__body--stack">
                <p className="text-sm">该部门下没有员工。</p>
                <p className="text-xs text-[var(--color-text-subtle-ls)]">
                  这是当前已加载 {state.items.length} 人里的真实结果：没有部门等于该筛选值的行（缺部门的行归「未标注部门」桶）；可清空部门筛选。
                </p>
                <Button size="sm" outlined data-testid="emp-list-dept-clear" onClick={() => patchParams({ dept: null, cursor: null })}>
                  清空部门筛选
                </Button>
              </div>
            </div>
          ) : null}

          {state.phase === "ready" ? (
            <div className="emp-table" data-testid="employees-table">
              <div className="emp-grid emp-grid--head" data-testid="employees-table-head">
                <span className="emp-head-who">
                  <SortHeader label="员工" sortKey="name" active={sort} dir={dir} onCycle={cycleSort} tip="按姓名排序（本地：仅当前已加载行）" />
                  <SortHeader label="工号" sortKey="code" active={sort} dir={dir} onCycle={cycleSort} tip="按工号短码排序（本地：仅当前已加载行）" />
                  <SortHeader
                    label={<Clock className="h-3 w-3" aria-hidden="true" />}
                    ariaLabel="按最近活跃排序"
                    sortKey="time"
                    active={sort}
                    dir={dir}
                    onCycle={cycleSort}
                    tip="按最近活跃（updatedAt）排序（本地：仅当前已加载行）；该列不单独占表格列，时间在行内预览可见。"
                  />
                </span>
                <span className="emp-col-dept">部门 / 岗位</span>
                <SortHeader label="可上岗" sortKey="state" active={sort} dir={dir} onCycle={cycleSort} tip="按在职态原始值排序（本地：仅当前已加载行）" />
                <span className="emp-col-skills emp-num">技能</span>
                <span className="emp-col-cost emp-num">今日花费</span>
                <span className="emp-col-runs emp-num">近 7 天</span>
                <span className="emp-col-rate emp-num">成功率</span>
              </div>

              <div data-testid="emp-list-nav" role="grid" aria-label="员工列表（方向键浏览行，Enter 展开预览）">
                <ul className="emp-list" data-testid="emp-l-list" data-emp-list-rows="true">
                  {visibleItems.map((row) => {
                    const empId = row.employeeId;
                    const mp = enrichment.matrix.get(empId) ?? null;
                    const run = enrichment.runs.get(empId) ?? null;
                    const runsReady = enrichment.runsPhase === "ready";
                    const skillCount = mp?.skillCount ?? null;
                    const rate = runRate(run);
                    const rateText = rate === null ? "—" : `${Math.round(rate * 100)}%`;
                    // 今日花费：有运行行就读它；没有运行行且窗口已取全 = 真零；
                    // 窗口未取全（游标未完）时不能断言零，留「—」。
                    const costCovered = runsReady && !enrichment.runsPartial;
                    const todayCost = run ? run.costToday : costCovered ? 0 : null;
                    return (
                      <li key={empId} data-testid={`employees-row-${empId}`} className="emp-rowwrap">
                        <div className="emp-row">
                          <label className="emp-row__pick" data-testid={`emp-row-select-label-${empId}`}>
                            <input
                              type="checkbox"
                              data-testid={`emp-row-select-${empId}`}
                              checked={selected.has(empId)}
                              onChange={() => toggleRow(empId)}
                              aria-label={`选择：${displayName(row)}`}
                              title={
                                selected.has(empId)
                                  ? "取消勾选这一行"
                                  : `勾选这一行进批量动作（当前已加载 ${state.items.length} 人内；翻页即清空）`
                              }
                              className="h-4 w-4 shrink-0 accent-[var(--color-text-ls)]"
                            />
                          </label>
                          <button
                            type="button"
                            data-testid={`emp-row-preview-toggle-${empId}`}
                            aria-expanded={previewKey === empId}
                            aria-label={`行内预览：${displayName(row)}`}
                            title="就地展开预览（不跳转、不产生新请求；Esc 或再点收起）"
                            className="emp-row__chev"
                            onClick={() => setPreviewKey((k) => (k === empId ? null : empId))}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setPreviewKey(null);
                              }
                            }}
                          >
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${previewKey === empId ? "rotate-90" : ""}`} />
                          </button>
                          <span data-testid={`emp-l-row-${empId}`} className="contents">
                            <Link
                              to={`/employees/${encodeURIComponent(empId)}`}
                              data-testid={`emp-l-name-link-${empId}`}
                              ref={(el) => {
                                if (el) rowRefs.current.set(empId, el);
                                else rowRefs.current.delete(empId);
                              }}
                              tabIndex={(activeRowKey ?? visibleItems[0]?.employeeId) === empId ? 0 : -1}
                              aria-expanded={previewKey === empId}
                              onFocus={() => setActiveRowKey(empId)}
                              onKeyDown={(e) => {
                                const ids = visibleItems.map((r) => r.employeeId);
                                const i = ids.indexOf(empId);
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
                                  e.preventDefault();
                                  setPreviewKey((k) => (k === empId ? null : empId));
                                } else if (e.key === "Escape" && previewKey !== null) {
                                  e.preventDefault();
                                  setPreviewKey(null);
                                  e.currentTarget.focus();
                                }
                              }}
                              className="emp-grid emp-grid--row"
                              title={
                                beijingMinute(row.updatedAt)
                                  ? `最近活跃 ${beijingMinute(row.updatedAt)}`
                                  : undefined
                              }
                            >
                              <span className="emp-who">
                                <b className="emp-ava" aria-hidden="true">
                                  {initialOf(row)}
                                </b>
                                <span className="emp-nm">{displayName(row)}</span>
                                <span
                                  className="emp-sub mono"
                                  title={empId}
                                  data-testid={`employees-code-${empId}`}
                                >
                                  员工 · {shortCode(empId)}
                                </span>
                              </span>
                              <span className="emp-dept emp-col-dept">
                                <span
                                  data-label="部门"
                                  title={departmentView(row.department !== undefined, row.department ?? null).title ?? undefined}
                                >
                                  {departmentView(row.department !== undefined, row.department ?? null).label}
                                </span>
                                <span className="emp-dept__role">{row.title?.trim() || "岗位未提供"}</span>
                              </span>
                              <span className="emp-life" data-testid={`emp-life-${empId}`}>
                                <Pill tone={lifeTone(row.lifecycleState)} title={lifeTitle(row.lifecycleState)}>
                                  {lifecycleLabel(row.lifecycleState)}
                                </Pill>
                              </span>
                              <span
                                className="emp-skills emp-col-skills emp-num mono"
                                data-testid={`emp-skills-${empId}`}
                                title={
                                  skillCount === null
                                    ? "矩阵读口没回传该员工的技能数：不补 0。"
                                    : skillCount === 0
                                      ? "矩阵读口如实返回 0（技能引用为空）；清单以能力与权限页为准。"
                                      : "技能引用数（GET /api/matrix skillCount）；引用只回编号，清单以能力与权限页为准。"
                                }
                              >
                                {skillCount === null ? <span className="emp-dim">—</span> : skillCount}
                              </span>
                              <span
                                className="emp-num emp-col-cost mono"
                                data-testid={`emp-cost-${empId}`}
                                title={`${enrichment.budgetNote}${costCovered ? " 今天没有该员工的运行记录即真零。" : " 运行窗口未取全，缺行时留「—」。"}`}
                              >
                                {todayCost === null ? <span className="emp-dim">—</span> : money(todayCost)}
                              </span>
                              <span
                                className="emp-num emp-col-runs mono"
                                data-testid={`emp-runs-${empId}`}
                                title={enrichment.runsNote}
                              >
                                {runsReady ? `${enrichment.runsPartial ? "≥" : ""}${run?.runs ?? 0}` : <span className="emp-dim">—</span>}
                              </span>
                              <span
                                className={`emp-num emp-col-rate mono${rate !== null && rate < 0.9 ? " emp-warn" : ""}`}
                                data-testid={`emp-rate-${empId}`}
                                title={rate === null ? "该员工维度没有已完成的运行样本，成功率不补 0。" : "口径：completed ÷（completed + failed），来自最近 7 天运行。"}
                              >
                                {rateText}
                              </span>
                            </Link>
                          </span>
                          <button
                            type="button"
                            data-testid={`emp-row-edit-${empId}`}
                            aria-label={`编辑：${displayName(row)}`}
                            title={`打开编辑抽屉（${EDIT_WRITE_NOTE}）`}
                            className="emp-row__edit"
                            onClick={() => setEditingRow(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        {previewKey === empId ? <RowPreview row={row} /> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ) : null}

          {/* 卡底一行 11px：把口径与缺读口压成一条，不再用段落压屏。 */}
          <div className="emp-notes" data-testid="emp-list-notes">
            <span
              className="emp-note"
              data-testid="emp-list-scope-note"
              title="白名单参数 keyword、lifecycleState 由服务端过滤；q/query/name 不被该读口接受（实测均返回全量），因此不存在本地过滤口径，也不会为搜索补发额外请求。"
            >
              关键字与状态筛选走服务端真参数
            </span>
            <span
              className="emp-note"
              data-testid="emp-list-sort-scope-note"
              title="实测：GET /api/employees 带 sort=name&order=desc、sortBy=lifecycleState、sort=createdAt&dir=asc 任一参数，均返回同一顺序的同一全量（200，3 条）——后台读口不支持排序参数。为避免假的服务端排序，这里只对已加载行做本地排序。"
            >
              排序仅在当前已加载 {state.items.length} 条内生效
            </span>
            <span
              className="emp-note"
              data-testid="emp-list-dept-scope-note"
              title="实测 GET /api/employees 带 department= 或 dept= 都返回同一全量（200），后台不做部门过滤；为避免假筛选，这里只对已加载的行做前端本地过滤，切换不产生新请求、也不影响服务端游标。"
            >
              按当前已加载 {state.items.length} 人统计，不是全量
            </span>
            <span
              className="emp-note"
              data-testid="emp-list-col-note"
              title="主模型：员工列表与 /api/matrix 都不回传模型路由，整列隐藏（以员工详情「模型路由」为准）；今日花费的日美元预算上限：读口未返回；客户端数与队列长度：无读口。"
            >
              缺读口：主模型 · 日预算上限
            </span>
          </div>

          {/* R69: 分页条常驻——非 ready 态下「加载更多」以 disabled+原因存在，不隐身。 */}
          <div className="emp-foot">
            <span
              className="emp-foot__status"
              data-testid="emp-foot-status"
              title="GET /api/health/sources 浅探针：HTTP 应答即 ok。客户端数与队列长度没有读口，故不显示也不补数。"
            >
              {gateway === null ? (
                <span className="emp-meta">—</span>
              ) : (
                <span className="emp-meta">
                  {gateway.ok ? "网关在线" : "网关降级"} · {gateway.services} 服务
                  {gateway.asOf ? ` · ${beijingMinute(gateway.asOf) ?? gateway.asOf}` : ""}
                </span>
              )}
            </span>
            <div className="emp-foot__right" data-testid="emp-list-page">
              <span
                data-testid="emp-list-page-count"
                className="emp-meta"
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
              {restoreInfo ? (
                <span
                  data-testid="emp-list-cursor-restored"
                  className="emp-meta"
                  title="URL 里的 cursor 是「上一页响应的 nextCursor」。刷新后从第一页起，按服务端每页自己给出的游标逐页续取到该位置；链接里那枚游标本身从不发出去。数据变短时如实停在真实末页并清掉键位。"
                >
                  {restoreNoteText(restoreInfo)}
                </span>
              ) : null}
              <Button
                size="sm"
                outlined
                className="emp-foot__more"
                data-testid="emp-list-page-more"
                disabled={moreDisabled}
                aria-disabled={moreDisabled || undefined}
                tabIndex={moreDisabled ? -1 : undefined}
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
                <span data-testid="emp-list-page-end" className="emp-meta">已到末页</span>
              ) : null}
            </div>
          </div>
        </div>
      </ConsoleCard>

      {createOpen ? (
        <CreateEmployeeModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onVerifyCreated={verifyCreated}
          onConfirmed={(createdName) => showToast(`新员工「${createdName}」已出现在名册`, "success")}
        />
      ) : null}
      <Toast toast={toast} />
      {editingRow ? (
        <EditEmployeeDrawer row={editingRow} onClose={() => setEditingRow(null)} key={editingRow.employeeId} />
      ) : null}
    </section>
  );
}

export default EmployeesModulePage;
