/**
 * Duty / Matrix module — shared shapes for the console v4 read models.
 *
 * The BFF forwards upstream shapes verbatim, so every field below is optional:
 * a missing key renders "—" and never 0. Unknown enum values stay unknown.
 */

/** 员工目录单页读取上限；分母范围句在触顶时明写「非全量」（Q10 条目5）。 */
export const EMPLOYEES_PAGE_LIMIT = 100;

export type Loadable<T> =
  | { k: "loading" }
  | { k: "ready"; data: T }
  | {
      k: "error";
      status: number;
      message: string;
      requestId: string | null;
      /**
       * DU-05①：404/503 + `not_wired` 信封是正当的「未接入」，不是取数失败
       * （fetchKnowledgeProbe 同判据，api.ts `isNotWiredError` 判定）。缺省 false。
       */
      notWired?: boolean;
    };

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function asArray<T = Record<string, unknown>>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (isRecord(body) && Array.isArray(body.items)) return body.items as T[];
  return [];
}

export function text(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

export function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

export interface EmployeeRow {
  employeeId: string;
  name?: string;
  lifecycleState?: string;
  ownerUserId?: string;
  versionRef?: string;
  title?: string;
}

export function normalizeEmployee(v: unknown): EmployeeRow | null {
  if (!isRecord(v)) return null;
  const employeeId =
    text(v.employeeId) ?? text(v.employee_id) ?? text(v.id) ?? "";
  if (!employeeId) return null;
  return {
    employeeId,
    name: text(v.name) ?? text(v.displayName) ?? text(v.display_name) ?? undefined,
    lifecycleState:
      text(v.lifecycleState) ?? text(v.lifecycle) ?? text(v.state) ?? undefined,
    ownerUserId:
      text(v.ownerUserId) ?? text(v.owner_user_id) ?? text(v.owner) ?? undefined,
    versionRef:
      text(v.versionRef) ?? text(v.currentVersionId) ?? text(v.version) ?? undefined,
    title: text(v.title) ?? text(v.jobTitle) ?? undefined,
  };
}

export interface RunTotals {
  runs: number;
  succeeded?: number;
  failed?: number;
  cancelled?: number;
  interrupted?: number;
  running?: number;
  pending?: number;
  costUsd?: number;
  unknownRuns?: number;
  successRate?: number;
}

export interface RunBucket {
  bucketStart: string;
  /** null means the read model had no value for this bucket — not a real zero. */
  runs: number | null;
  succeeded?: number;
  failed?: number;
  costUsd?: number;
}

export interface RunStatsBody {
  buckets?: RunBucket[];
  totals?: RunTotals;
  /** Top-level collection time from the read model, when it sends one. */
  asOf?: string;
}

export interface RunRow {
  runId: string;
  employeeId?: string;
  status?: string;
  startedAt?: string;
  endedAt?: string;
  costUsd?: number;
}

export function normalizeRun(v: unknown): RunRow | null {
  if (!isRecord(v)) return null;
  const runId = text(v.runId) ?? text(v.run_id) ?? text(v.id) ?? "";
  if (!runId) return null;
  return {
    runId,
    employeeId: text(v.employeeId) ?? text(v.employee_id) ?? undefined,
    status: text(v.status) ?? text(v.state) ?? undefined,
    startedAt: text(v.startedAt) ?? text(v.started_at) ?? undefined,
    endedAt: text(v.endedAt) ?? text(v.ended_at) ?? undefined,
    costUsd: num(v.costUsd ?? v.cost_usd) ?? undefined,
  };
}

export interface BudgetItem {
  employeeId?: string;
  costUsd?: number | null;
  tokensUsed?: number | null;
  period?: string;
  periodKind?: string;
}

export interface BudgetBody {
  items?: BudgetItem[];
  missingEmployeeIds?: string[];
}

export interface ApprovalStatsBody {
  pending?: number;
  dueSoon?: number;
  /** Top-level collection time from the read model, when it sends one. */
  asOf?: string;
  /** Why the count is missing (failed source), human wording from the BFF. */
  reason?: string;
}

export interface ApprovalRow {
  approvalId: string;
  title?: string;
  status?: string;
  createdAt?: string;
  expiresAt?: string;
  riskLevel?: string;
}

export function normalizeApproval(v: unknown): ApprovalRow | null {
  if (!isRecord(v)) return null;
  const approvalId =
    text(v.approvalId) ?? text(v.approval_id) ?? text(v.id) ?? "";
  if (!approvalId) return null;
  return {
    approvalId,
    title: text(v.title) ?? text(v.name) ?? text(v.action) ?? undefined,
    status: text(v.status) ?? undefined,
    createdAt: text(v.createdAt) ?? text(v.created_at) ?? undefined,
    expiresAt: text(v.expiresAt) ?? text(v.expires_at) ?? undefined,
    riskLevel: text(v.riskLevel) ?? text(v.risk_level) ?? undefined,
  };
}

export interface TaskRow {
  taskId: string;
  title?: string;
  status?: string;
  dueAt?: string;
  updatedAt?: string;
}

export function normalizeTask(v: unknown): TaskRow | null {
  if (!isRecord(v)) return null;
  const taskId = text(v.taskId) ?? text(v.task_id) ?? text(v.id) ?? "";
  if (!taskId) return null;
  return {
    taskId,
    title: text(v.title) ?? text(v.name) ?? undefined,
    status: text(v.status) ?? text(v.state) ?? undefined,
    dueAt: text(v.dueAt) ?? text(v.due_at) ?? text(v.dueBefore) ?? undefined,
    updatedAt: text(v.updatedAt) ?? text(v.updated_at) ?? undefined,
  };
}

export interface ActivityCell {
  dow: number;
  hour: number;
  count: number;
}

export interface ActivityBody {
  cells?: ActivityCell[];
  max?: number;
}

export interface GateView {
  key: "V1" | "V2" | "V3" | "V6";
  name: string;
  pass: number | null;
  fail: number | null;
  /** "pass" | "fail" | "unknown" — unknown never enters the numerator. */
  state: "pass" | "fail" | "unknown";
  code: string;
  source: string;
  /** R31: Beijing-minute stamp of the source answer; null when the source
   * itself is not wired (the gate then states 未接入 with a reason). */
  asOf: string | null;
  inferred?: boolean;
  /** state=unknown 时在卡上直出的「为什么给不出」一句话结论；其它态为 null。 */
  whyNot?: string | null;
}

/** 可上岗三分态（工单 DU-01⑤）：按每个员工的真实证据归类，三桶之和=分母行数。 */
export interface ReadinessBuckets {
  /** 四门全部显式 pass 的人数。 */
  confirmed: number;
  /** 至少一门证据未回答或门本身 unknown（含扇出未覆盖行）的人数。 */
  pending: number;
  /** 至少一门有显式 fail 真读数的人数（真读数，不是猜测）。 */
  failing: number;
}

export interface ReadinessView {
  total: number | null;
  active: number | null;
  confirmed: number | null;
  /** 三分态；目录未到位时 null（此时不给任何计数，连 0 也不给）。 */
  buckets: ReadinessBuckets | null;
  /** 分母范围的可见披露：单页加载与逐员工扇出覆盖 n/N。 */
  denominatorNote: string | null;
  unknownGates: number;
  narrowest: GateView | null;
  deltaToNext: number | null;
  /** Q10 条目4：最窄限制门置顶，其余保持原序。 */
  gates: GateView[];
  /** Q10 条目4：四门叠加净效果的人话句（交集句）。 */
  netNote: string;
  /** Q10 条目5：比率分母的来源范围句——单页触顶时明写「非全量」。 */
  denomNote: string;
}

export interface BlockerItem {
  object: string;
  reason: string;
  responsibleModule: string;
  step: string;
  waitingOn: string;
  waitingSince?: string;
  nextAction: string;
  affectsReadiness: boolean;
  overSLA: boolean;
  href: string;
}

export interface MatrixCapabilities {
  skills?: string[];
  tools?: string[];
  knowledge?: string[];
}

export interface MatrixRow extends EmployeeRow {
  capabilities?: MatrixCapabilities;
  risk?: {
    blockedApprovals?: number;
    failedRuns?: number;
    budgetOver?: boolean;
  } | null;
}

export interface MatrixBody {
  items?: unknown[];
  stale?: boolean;
}