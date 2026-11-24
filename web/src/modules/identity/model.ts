/**
 * 人员与访问（/identity 三屏）读数层 —— 只有真读口，没有样例。
 *
 * 当前真读口（带 cookie 的 GET，2026-11-24 实测）：
 *   - 成员台账：姓名 / 岗位 / 部门 / 生命周期态 / 更新时刻 / 归属后台账号。
 *   - 成员计数：总数 + 六种生命周期态的本轮计数。
 *   - 数字员工矩阵：每位成员的技能数、日 token 上限、月费上限、单次上限。
 *   - 本租户身份：账号名与 org_id（org_id 只进 title，不上屏）。
 *   - 部门名册：实测 404「该读口尚未接入」→ 记为未接线，不当错误态。
 *
 * 读口之外的字段一律交回 null，由页面「整列不渲染 + 卡底可用性清单」承接；
 * 本文件不产生任何占位数字：没有示例行、没有假比例。可选读口本轮没读到就按
 * 「未取到」降级（丢列 + 可用性一条），不把整页打成错误态。
 */
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

/** 成员台账一行的规范化形态；缺字段保 null，不补空串冒充有值。 */
export interface MemberRow {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  lifecycle: string | null;
  updatedAt: string | null;
  /** 归属的后台账号 id（读得到即「已绑定」，null 即未绑定）。 */
  owner: string | null;
  /**
   * 台账里显式给出的角色键/角色名；没有角色字段就是 null。
   * 不从 title 推断：岗位不等于角色，推断出来的行就是编的。
   */
  role: string | null;
}

/** 数字员工矩阵一行：只取本轮确实读到的额度与预算字段。 */
export interface MatrixRow {
  id: string;
  name: string;
  lifecycle: string | null;
  skillCount: number | null;
  dailyTokens: number | null;
  monthlyCostUsd: number | null;
  perRunMaxUsd: number | null;
  effectiveFrom: string | null;
}

/** 成员计数的本轮读数。 */
export interface MemberStats {
  total: number | null;
  /** 生命周期态 → 计数，只收读到的键。 */
  byLifecycle: Record<string, number>;
}

/** 本租户身份；orgId 只进 title，不上屏。 */
export interface TenantIdentity {
  userId: string | null;
  displayName: string | null;
  provider: string | null;
  orgId: string | null;
}

/** 部门名册一行（读口接通后才有值；未接通时 items 为空）。 */
export interface DeptRow {
  id: string | null;
  name: string;
  owner: string | null;
  members: number | null;
  monthlyBudget: number | null;
  monthlyFee: number | null;
  parent: string | null;
}

export interface IdentityData {
  /** 成员台账是否真的读到了（false = 读失败，页面走错误态）。 */
  membersReady: boolean;
  members: MemberRow[];
  /** 部门名册读口是否接线（false = 404 未接入，不是错误）。 */
  departmentsWired: boolean;
  departments: DeptRow[];
  /** 成员计数读口本轮是否读到。 */
  statsReady: boolean;
  stats: MemberStats | null;
  /** 数字员工矩阵读口本轮是否读到。 */
  matrixReady: boolean;
  matrix: MatrixRow[];
  /** 本租户身份（orgId 只进 title）。 */
  identity: TenantIdentity | null;
}

type Rec = Record<string, unknown>;

function isRec(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function itemsOf(body: unknown): Rec[] {
  if (Array.isArray(body)) return body.filter(isRec);
  if (isRec(body) && Array.isArray(body.items)) return body.items.filter(isRec);
  return [];
}

/** 台账一行 → 成员行；没有 id 也没有姓名的行整行丢弃（不造「未命名」占位）。 */
export function toMember(raw: Rec): MemberRow | null {
  const id = pickString(raw.employeeId, raw.id, raw.userId);
  const name = pickString(raw.name, raw.displayName, raw.display_name);
  if (!id || !name) return null;
  return {
    id,
    name,
    title: pickString(raw.title, raw.roleTitle, raw.position),
    department: pickString(raw.department, raw.departmentName, raw.dept),
    lifecycle: pickString(raw.lifecycleState, raw.lifecycle),
    updatedAt: pickString(raw.updatedAt, raw.updated_at),
    owner: pickString(raw.ownerUserId, raw.owner_user_id, raw.ownerId),
    role: pickString(raw.role, raw.roleName, raw.role_name, raw.roleKey, raw.role_key),
  };
}

export function membersFrom(body: unknown): MemberRow[] {
  return itemsOf(body)
    .map(toMember)
    .filter((row): row is MemberRow => row !== null);
}

export function departmentsFrom(body: unknown): DeptRow[] {
  return itemsOf(body).flatMap((raw) => {
    const name = pickString(raw.name, raw.departmentName);
    if (!name) return [];
    return [
      {
        id: pickString(raw.departmentId, raw.id),
        name,
        owner: pickString(raw.ownerName, raw.owner, raw.managerName),
        members: pickNumber(raw.memberCount, raw.members),
        monthlyBudget: pickNumber(raw.monthlyBudgetUsd, raw.monthlyBudget),
        monthlyFee: pickNumber(raw.monthlyCostUsd, raw.monthlyCost),
        parent: pickString(raw.parentName, raw.parentId),
      },
    ];
  });
}

/** 矩阵一行 → 额度行；没有 id 的行丢弃。技能数优先计数字段，其次引用数组长度。 */
export function toMatrixRow(raw: Rec): MatrixRow | null {
  const id = pickString(raw.employeeId, raw.id);
  if (!id) return null;
  const refs = Array.isArray(raw.skillRefs) ? (raw.skillRefs as unknown[]) : null;
  const budget = isRec(raw.budget) ? (raw.budget as Rec) : {};
  return {
    id,
    name: pickString(raw.name, raw.displayName) ?? id,
    lifecycle: pickString(raw.lifecycleState, raw.lifecycle),
    skillCount: pickNumber(raw.skillCount) ?? (refs ? refs.length : null),
    dailyTokens: pickNumber(budget.dailyTokens, raw.dailyTokens),
    monthlyCostUsd: pickNumber(budget.monthlyCostUsd, raw.monthlyCostUsd),
    perRunMaxUsd: pickNumber(budget.perRunMaxUsd, raw.perRunMaxUsd),
    effectiveFrom: pickString(raw.effectiveFrom, raw.effective_from),
  };
}

export function matrixFrom(body: unknown): MatrixRow[] {
  return itemsOf(body)
    .map(toMatrixRow)
    .filter((row): row is MatrixRow => row !== null);
}

/** 成员计数：total 与 byLifecycle 都没读到就返回 null（页面按未取到降级）。 */
export function statsFrom(body: unknown): MemberStats | null {
  if (!isRec(body)) return null;
  const total = pickNumber(body.total, body.count);
  const by = isRec(body.byLifecycle) ? (body.byLifecycle as Rec) : null;
  const counts: Record<string, number> = {};
  if (by) {
    for (const [key, value] of Object.entries(by)) {
      const n = pickNumber(value);
      if (n !== null) counts[key] = n;
    }
  }
  if (total === null && Object.keys(counts).length === 0) return null;
  return { total, byLifecycle: counts };
}

/** 身份读数：全空则 null。 */
export function identityFrom(body: unknown): TenantIdentity | null {
  if (!isRec(body)) return null;
  const row: TenantIdentity = {
    userId: pickString(body.user_id, body.userId),
    displayName: pickString(body.display_name, body.displayName, body.email),
    provider: pickString(body.provider),
    orgId: pickString(body.org_id, body.orgId),
  };
  return row.userId || row.displayName || row.orgId ? row : null;
}

/** 工号短码：取 id 尾部 8 位字符，和员工列表同一形制（完整 id 只进 title）。 */
export function shortCode(id: string): string {
  const tail = id.replace(/[^0-9a-zA-Z]/g, "").slice(-8).toUpperCase();
  return tail || id;
}

export interface MemberSummary {
  total: number;
  /** 生命周期 active 的人数。 */
  active: number;
  /** 生命周期 draft（发出邀请尚未激活）的人数。 */
  pending: number;
  /** 其余生命周期（暂停 / 停用 / 未标注）。 */
  other: number;
}

export function memberSummary(rows: MemberRow[]): MemberSummary {
  let active = 0;
  let pending = 0;
  for (const row of rows) {
    if (row.lifecycle === "active") active += 1;
    else if (row.lifecycle === "draft") pending += 1;
  }
  return { total: rows.length, active, pending, other: rows.length - active - pending };
}

export type StatusTone = "ok" | "warn" | "bad" | "info" | "mut";

/** 生命周期态 → 状态胶囊的人话标签；未知态不把代码搬上屏。 */
export function lifecyclePill(state: string | null): { tone: StatusTone; label: string } {
  switch (state) {
    case "active":
      return { tone: "ok", label: "在职" };
    case "draft":
      return { tone: "warn", label: "待激活" };
    case "paused":
      return { tone: "warn", label: "已暂停" };
    case "suspended":
      return { tone: "mut", label: "已停用" };
    default:
      return { tone: "mut", label: "未标注" };
  }
}

export interface DeptBucket {
  /** 部门名；未填部门的一组固定排最后。 */
  name: string;
  count: number;
  /** true = 台账里这一行没有部门，不是「无部门」这个真实部门。 */
  unassigned: boolean;
}

/** 按部门分桶：只数台账里写了的部门，未写的归「未归属」。 */
export function departmentBuckets(rows: MemberRow[]): DeptBucket[] {
  const counts = new Map<string, number>();
  let unassigned = 0;
  for (const row of rows) {
    if (row.department) counts.set(row.department, (counts.get(row.department) ?? 0) + 1);
    else unassigned += 1;
  }
  const named = [...counts.entries()]
    .map(([name, count]) => ({ name, count, unassigned: false }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-Hans-CN"));
  return unassigned > 0 ? [...named, { name: "未归属", count: unassigned, unassigned: true }] : named;
}

export interface RoleBucket {
  name: string;
  members: MemberRow[];
}

/**
 * 按台账里**显式给出**的角色值分桶。角色读口没有时，这里是矩阵行唯一的真来源：
 * 台账不带角色字段 → 空数组（页面渲染一行占位行，不从岗位编角色）。
 */
export function roleBuckets(rows: MemberRow[]): RoleBucket[] {
  const byRole = new Map<string, MemberRow[]>();
  for (const row of rows) {
    if (!row.role) continue;
    const list = byRole.get(row.role);
    if (list) list.push(row);
    else byRole.set(row.role, [row]);
  }
  return [...byRole.entries()]
    .map(([name, members]) => ({ name, members }))
    .sort((a, b) => b.members.length - a.members.length || a.name.localeCompare(b.name, "zh-Hans-CN"));
}

/** 本地检索：姓名 / 岗位 / 部门三处包含即命中（空词返回全量）。 */
export function filterMembers(rows: MemberRow[], keyword: string): MemberRow[] {
  const k = keyword.trim().toLowerCase();
  if (!k) return rows;
  return rows.filter((row) =>
    [row.name, row.title ?? "", row.department ?? ""].some((field) => field.toLowerCase().includes(k)),
  );
}

/** 读失败是否 = 「这一项没有读口」（404/501/503 统一按未接线处理）。 */
export function isUnwired(error: unknown): boolean {
  return error instanceof ApiError && [404, 501, 503].includes(error.status);
}

/** 读失败是否 = 「你没有权限」；403 与未接线是两条互斥的话术腿。 */
export function isDenied(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/**
 * 逐读口取数。成员台账失败会抛出（页面走错误态）；计数、矩阵、部门名册与身份
 * 都是可选腿——失败一律收敛成「本轮没读到」，由页面的可用性清单承接，不把
 * 部门读口的问题传染给整页。
 */
export async function loadIdentity(): Promise<IdentityData> {
  const [employees, departments, stats, matrix, me] = await Promise.allSettled([
    fetchJSON<unknown>("/api/employees"),
    fetchJSON<unknown>("/api/departments"),
    fetchJSON<unknown>("/api/employee-stats"),
    fetchJSON<unknown>("/api/matrix"),
    fetchJSON<unknown>("/api/auth/me"),
  ]);

  if (employees.status === "rejected") throw employees.reason;

  let deptBody: unknown = null;
  let wired = false;
  if (departments.status === "fulfilled") {
    deptBody = departments.value;
    wired = true;
  } else if (!isUnwired(departments.reason)) {
    // 名册端点存在但读失败（5xx 之外）时再试一次兼容路径，仍失败则按未接线记。
    try {
      deptBody = await fetchJSON<unknown>("/api/v1/departments");
      wired = true;
    } catch {
      wired = false;
    }
  }

  const parsedStats = stats.status === "fulfilled" ? statsFrom(stats.value) : null;
  const parsedMatrix = matrix.status === "fulfilled" ? matrixFrom(matrix.value) : [];
  const identity = me.status === "fulfilled" ? identityFrom(me.value) : null;

  return {
    membersReady: true,
    members: membersFrom(employees.value),
    departmentsWired: wired,
    departments: wired ? departmentsFrom(deptBody) : [],
    statsReady: parsedStats !== null,
    stats: parsedStats,
    matrixReady: matrix.status === "fulfilled",
    matrix: parsedMatrix,
    identity,
  };
}

/* ------------------------------------------------------------------ *
 * 派生读数：全部由上面读到的行现算，不引入任何外部常量。
 * ------------------------------------------------------------------ */

/** 成员 id → 矩阵行，供台账表按 id 取额度；矩阵没有的 id 取不到（返回 null）。 */
export function indexMatrix(rows: MatrixRow[]): Map<string, MatrixRow> {
  return new Map(rows.map((row) => [row.id, row]));
}

export interface BindSummary {
  total: number;
  bound: number;
  unbound: number;
  /** 已绑定行指向的后台账号 id（去重，最多两三个）。 */
  ownerIds: string[];
}

export function bindSummary(rows: MemberRow[]): BindSummary {
  const ownerIds: string[] = [];
  let bound = 0;
  for (const row of rows) {
    if (!row.owner) continue;
    bound += 1;
    if (!ownerIds.includes(row.owner)) ownerIds.push(row.owner);
  }
  return { total: rows.length, bound, unbound: rows.length - bound, ownerIds };
}

/** 生命周期态的人话名（与本页状态胶囊同一套词，不搬代码上屏）。 */
const STATS_ORDER: { key: string; label: string }[] = [
  { key: "active", label: "在职" },
  { key: "draft", label: "待激活" },
  { key: "onboarding", label: "入职中" },
  { key: "paused", label: "已暂停" },
  { key: "offboarding", label: "离职中" },
  { key: "suspended", label: "已停用" },
  { key: "archived", label: "已归档" },
];

export interface StatLine {
  key: string;
  label: string;
  value: number;
}

/** 计数读数按固定顺序铺成行：只铺本轮真有读数的态，不铺 0 行凑数。 */
export function statLines(stats: MemberStats | null, rows: MemberRow[]): StatLine[] {
  const fromLedger = new Map<string, number>();
  for (const row of rows) {
    const key = row.lifecycle ?? "";
    fromLedger.set(key, (fromLedger.get(key) ?? 0) + 1);
  }
  const source = stats && Object.keys(stats.byLifecycle).length > 0 ? stats.byLifecycle : null;
  const keys = STATS_ORDER.map((entry) => entry.key).filter(
    (key) => (source?.[key] ?? 0) > 0 || (fromLedger.get(key) ?? 0) > 0,
  );
  const extra = [...fromLedger.keys()].filter(
    (key) => key && !STATS_ORDER.some((entry) => entry.key === key) && (fromLedger.get(key) ?? 0) > 0,
  );
  const lines: StatLine[] = [];
  for (const key of [...keys, ...extra]) {
    const label = STATS_ORDER.find((entry) => entry.key === key)?.label ?? "其它态";
    const value = source?.[key] ?? fromLedger.get(key) ?? 0;
    lines.push({ key, label, value });
  }
  return lines;
}

export interface LedgerTotals {
  /** 月费上限合计；一行都没读到金额即 null（不写 0）。 */
  monthlyCost: number | null;
  dailyTokens: number | null;
  perRunMax: number | null;
  /** 有金额读数的行数。 */
  costLines: number;
  skillLines: number;
}

export function ledgerTotals(rows: MatrixRow[]): LedgerTotals {
  let monthlyCost: number | null = null;
  let dailyTokens: number | null = null;
  let perRunMax: number | null = null;
  let costLines = 0;
  let skillLines = 0;
  for (const row of rows) {
    if (row.monthlyCostUsd !== null) {
      monthlyCost = (monthlyCost ?? 0) + row.monthlyCostUsd;
      costLines += 1;
    }
    if (row.dailyTokens !== null) dailyTokens = (dailyTokens ?? 0) + row.dailyTokens;
    if (row.perRunMaxUsd !== null) perRunMax = Math.max(perRunMax ?? 0, row.perRunMaxUsd);
    if (row.skillCount !== null) skillLines += 1;
  }
  return { monthlyCost, dailyTokens, perRunMax, costLines, skillLines };
}

export interface DeptStat {
  name: string;
  unassigned: boolean;
  members: MemberRow[];
  active: number;
  pending: number;
  /** 该组月费上限合计；组内一行金额都没有即 null。 */
  monthlyCost: number | null;
  dailyTokens: number | null;
}

/** 按部门归组并按 id 关联矩阵额度；分组顺序沿用 departmentBuckets。 */
export function deptStats(members: MemberRow[], matrixIndex: Map<string, MatrixRow>): DeptStat[] {
  const byName = new Map<string, MemberRow[]>();
  for (const row of members) {
    const key = row.department ?? UNASSIGNED;
    const list = byName.get(key);
    if (list) list.push(row);
    else byName.set(key, [row]);
  }
  return departmentBuckets(members).map((bucket) => {
    const list = byName.get(bucket.name) ?? [];
    let monthlyCost: number | null = null;
    let dailyTokens: number | null = null;
    for (const member of list) {
      const row = matrixIndex.get(member.id);
      if (row?.monthlyCostUsd !== null && row?.monthlyCostUsd !== undefined) {
        monthlyCost = (monthlyCost ?? 0) + (row?.monthlyCostUsd ?? 0);
      }
      if (row?.dailyTokens !== null && row?.dailyTokens !== undefined) {
        dailyTokens = (dailyTokens ?? 0) + (row?.dailyTokens ?? 0);
      }
    }
    return {
      name: bucket.name,
      unassigned: bucket.unassigned,
      members: list,
      active: list.filter((member) => member.lifecycle === "active").length,
      pending: list.filter((member) => member.lifecycle === "draft").length,
      monthlyCost,
      dailyTokens,
    };
  });
}

/** 未归属桶的固定名（不是真部门名）。 */
export const UNASSIGNED = "未归属";

/** 台账里最近变动的几行（按更新时刻倒序）；读不到时刻的行不进榜。 */
export function recentChanges(rows: MemberRow[], limit = 3): MemberRow[] {
  return rows
    .filter((row) => row.updatedAt !== null)
    .slice()
    .sort((a, b) => (a.updatedAt! < b.updatedAt! ? 1 : a.updatedAt! > b.updatedAt! ? -1 : 0))
    .slice(0, limit);
}

/** 金额：读不到就是空串交由调用方裁列，这里不写「—」。 */
export function money(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : `$${value.toFixed(2)}`;
}

/** 千分位整数。 */
export function thousands(value: number | null | undefined): string | null {
  return value === null || value === undefined || !Number.isFinite(value) ? null : value.toLocaleString("en-US");
}

/** 北京时间「月-日 时:分」；读不到返回 null，不拿当前时刻冒充数据时刻。 */
export function stampShort(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const bj = new Date(ms + 480 * 60_000);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}`;
}
