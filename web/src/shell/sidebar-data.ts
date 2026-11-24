/**
 * 侧栏真数据（骨架侧栏对齐，2026-11-24）。
 *
 * 只做一件事：把侧栏要显示的三枚徽标与底部额度块接到**既有 BFF 读口**上，
 * 每个读数都保留「取不到 = null」的形状。侧栏绝不为空读数补 0、也不写死数字
 * ——调用方拿到 null 就不画（徽标不出现 / 金额显示 —）。
 *
 *   - 数字员工  /api/employees        → items.length（本树单页即全量：nextCursor 恒 null）
 *   - 任务与运行 /api/tasks           → 未完成（非终态）条数；任一行状态不可读则整体判 null
 *   - 审批与发布门 /api/approval-stats → pending
 *   - 今日成本  /api/run-stats（北京今日窗口，bucket=day）→ totals.costUsd
 *   - 本月已用  /api/run-stats（北京本月至今，bucket=day）→ totals.costUsd
 *   - 本月配额  /api/matrix            → Σ budget.monthlyCostUsd
 *
 * 今日上限（骨架的「今日全局上限」分母）在 BFF 没有真口径：dailyTokens 是
 * token 预算、不是美元上限。故 todayLimitUsd 恒为 null —— 侧栏据此只显示
 * 「今日 $X」，不编一个分母，也不画占比条。
 *
 * 时序（2026-11-24 二轮）：本树读口单次 0.6~9s（whoami 的 SWR 缓存已在
 * v4_proxy 侧落下），所以两个 hook 的读口各自 Promise.allSettled 并发发起、
 * 互不 await；读到之前徽标不画、额度块不画，绝不先画 0 或空壳。
 */
import { useEffect, useState } from "react";
import { fetchJSON } from "@/lib/api";

const BFF = "/agent-api/api";

/** 徽标取数用的一页上限：本树员工/任务规模远小于此，超出即视为取不到。 */
const PAGE = 200;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function finiteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function itemsOf(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body;
  if (isRecord(body) && Array.isArray(body.items)) return body.items;
  return null;
}

export interface SidebarBadges {
  /** 数字员工总数；null = 读不到（不画徽标）。 */
  employees: number | null;
  /** 未完成任务数（非终态）；null = 读不到。 */
  work: number | null;
  /** 待审批数；null = 读不到。 */
  approvals: number | null;
}

const NO_BADGES: SidebarBadges = { employees: null, work: null, approvals: null };

/** 任务终态：不计入「任务与运行」徽标。open / in_progress / blocked 都算未完成。 */
const TERMINAL_TASK_STATUS = new Set([
  "cancelled",
  "canceled",
  "done",
  "completed",
  "failed",
  "closed",
  "archived",
  "succeeded",
]);

async function loadEmployees(): Promise<number | null> {
  const body = await fetchJSON<unknown>(`${BFF}/employees?limit=${PAGE}`);
  const items = itemsOf(body);
  return items === null ? null : items.length;
}

async function loadOpenTasks(): Promise<number | null> {
  const body = await fetchJSON<unknown>(`${BFF}/tasks?limit=${PAGE}`);
  const items = itemsOf(body);
  if (items === null) return null;
  // 分页未取尽时长度只是下限，不能当全量报数。
  if (isRecord(body) && body.nextCursor != null) return null;
  let open = 0;
  for (const row of items) {
    if (!isRecord(row) || typeof row.status !== "string") return null;
    if (!TERMINAL_TASK_STATUS.has(row.status)) open += 1;
  }
  return open;
}

async function loadPendingApprovals(): Promise<number | null> {
  const body = await fetchJSON<unknown>(`${BFF}/approval-stats`);
  return isRecord(body) ? finiteNumber(body.pending) : null;
}

/** 北京时区的 YYYY-MM-DD（offsetDays 可跨日）。 */
function beijingDate(offsetDays = 0): string {
  const stamp = Date.now() + offsetDays * 86_400_000;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(stamp));
}

/** run-stats 一天的合计：优先 totals.costUsd，缺失时退回逐桶求和；都没有 = null。 */
function costOf(body: unknown): number | null {
  if (!isRecord(body)) return null;
  const totals = isRecord(body.totals) ? body.totals : null;
  const fromTotals = totals ? finiteNumber(totals.costUsd) : null;
  if (fromTotals !== null) return fromTotals;
  const buckets = Array.isArray(body.buckets) ? body.buckets : null;
  if (buckets === null) return null;
  let sum = 0;
  let seen = false;
  for (const bucket of buckets) {
    if (!isRecord(bucket)) continue;
    const cost = finiteNumber(bucket.costUsd);
    if (cost === null) continue;
    sum += cost;
    seen = true;
  }
  return seen ? sum : null;
}

async function loadWindowCost(from: string, to: string): Promise<number | null> {
  const body = await fetchJSON<unknown>(
    `${BFF}/run-stats?from=${from}&to=${to}&bucket=day`,
  );
  return costOf(body);
}

async function loadMonthlyQuota(): Promise<number | null> {
  const body = await fetchJSON<unknown>(`${BFF}/matrix?limit=${PAGE}`);
  const items = itemsOf(body);
  if (items === null) return null;
  let sum = 0;
  let seen = false;
  for (const row of items) {
    if (!isRecord(row) || !isRecord(row.budget)) continue;
    const quota = finiteNumber(row.budget.monthlyCostUsd);
    if (quota === null) continue;
    sum += quota;
    seen = true;
  }
  return seen ? sum : null;
}

/** 侧栏徽标：3 个读口一次性并发发起，任一失败只影响自己那一枚；
 * 读到之前保持 null（= 不画徽标），绝不先画 0。 */
export function useSidebarBadges(): SidebarBadges {
  const [badges, setBadges] = useState<SidebarBadges>(NO_BADGES);

  useEffect(() => {
    let alive = true;
    const settle = async () => {
      const [employees, work, approvals] = await Promise.allSettled([
        loadEmployees(),
        loadOpenTasks(),
        loadPendingApprovals(),
      ]);
      if (!alive) return;
      setBadges({
        employees: employees.status === "fulfilled" ? employees.value : null,
        work: work.status === "fulfilled" ? work.value : null,
        approvals: approvals.status === "fulfilled" ? approvals.value : null,
      });
    };
    void settle();
    return () => {
      alive = false;
    };
  }, []);

  return badges;
}

export interface SidebarUsage {
  /** 北京今日成本（美元）；null = 读不到。 */
  todayCostUsd: number | null;
  /** 本月至今成本（美元）；null = 读不到。 */
  monthCostUsd: number | null;
  /** 本月配额（各员工 budget.monthlyCostUsd 之和）；null = 读不到。 */
  monthQuotaUsd: number | null;
  /** 今日全局上限：BFF 无真口径，恒 null（不画分母、不画占比条）。 */
  todayLimitUsd: number | null;
}

const NO_USAGE: SidebarUsage = {
  todayCostUsd: null,
  monthCostUsd: null,
  monthQuotaUsd: null,
  todayLimitUsd: null,
};

/** 侧栏底部额度块：今日 / 本月两条真读数 + 本月配额真读数，3 个读口并发；
 * 读到之前保持 null（侧栏不画这一块，也不画空轨道）。 */
export function useSidebarUsage(): SidebarUsage {
  const [usage, setUsage] = useState<SidebarUsage>(NO_USAGE);

  useEffect(() => {
    let alive = true;
    const settle = async () => {
      const today = beijingDate(0);
      const tomorrow = beijingDate(1);
      const monthStart = `${today.slice(0, 8)}01`;
      const [todayCost, monthCost, quota] = await Promise.allSettled([
        loadWindowCost(today, tomorrow),
        loadWindowCost(monthStart, tomorrow),
        loadMonthlyQuota(),
      ]);
      if (!alive) return;
      const next: SidebarUsage = {
        todayCostUsd: todayCost.status === "fulfilled" ? todayCost.value : null,
        monthCostUsd: monthCost.status === "fulfilled" ? monthCost.value : null,
        monthQuotaUsd: quota.status === "fulfilled" ? quota.value : null,
        todayLimitUsd: null,
      };
      setUsage(next);
    };
    void settle();
    return () => {
      alive = false;
    };
  }, []);

  return usage;
}