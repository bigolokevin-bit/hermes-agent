/**
 * 人员与访问（/identity 三屏）读数层 —— 只有真读口，没有样例。
 *
 * 当前真读口（带 cookie 的 GET）：
 *   - 成员台账：每位成员的姓名 / 岗位 / 部门 / 生命周期态 / 更新时刻。
 *   - 身份：本租户 org_id（不上屏，id 只进 title）。
 *   - 部门名册：试两次，实测 404「该读口尚未接入」→ 记为未接线，不当错误态。
 *
 * 没有读口的一律交回 null（页面画「—」并在卡底写缺读口），本文件不产生任何
 * 占位数字：没有 0、没有示例行、没有假比例。
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
  /** 本租户标识：只进 title，不上屏。 */
  orgId: string | null;
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
 * 逐读口取数。成员台账失败会抛出（页面走错误态）；部门名册失败一律收敛成
 * 「未接线」，不把部门读口的问题传染给整页。
 */
export async function loadIdentity(): Promise<IdentityData> {
  const [employees, departments, me] = await Promise.allSettled([
    fetchJSON<unknown>("/api/employees"),
    fetchJSON<unknown>("/api/departments"),
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

  const orgId =
    me.status === "fulfilled" && isRec(me.value) ? pickString((me.value as Rec).org_id) : null;

  return {
    membersReady: true,
    members: membersFrom(employees.value),
    departmentsWired: wired,
    departments: wired ? departmentsFrom(deptBody) : [],
    orgId,
  };
}