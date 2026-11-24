/**
 * T13 「能力与权限」矩阵（/employees?tab=matrix）—— 读口契约 + 视图模型（纯函数）。
 *
 * 骨架基线：`docs/console-v4-skeleton.html` 2315–2385（三张卡：按员工覆盖矩阵、
 * 按资源覆盖矩阵、口径与图例说明带）。两张表的列名逐字抄自骨架的
 * `renderCapPeople()`（同文件 6992 行起的 thead）与 `renderCapRes()`（7058 行起），
 * 见下面的 PEOPLE_COLUMNS / RESOURCE_HEADS；要改列名先改骨架。
 *
 * 六条读口，一条腿只有四种结局，互不顶替：
 *   ready    —— 200 且解析出了本次要用的形状
 *   empty    —— 200，但这份清单本来就是空集（真零，可以据此判「未挂载」）
 *   missing  —— 404 / 405 / 501 / 502 / 503 / 未接线信封：这一项没有读口
 *   error    —— 401、形状不认识、请求被拒：需要重试或重新登录
 *
 * missing 与 error 一律写成缺读口声明；只有 empty 才允许写 0。
 * 不补 0、不补百分比、不摆示例行：面上不许出现 data-fixture，也不许有样例数据。
 *
 * 列的存在性口径（2026-11-24 第二轮修正）：四道门（V1 群@ / V2 ReBAC / V3 引用 /
 * V6 审批）、缺口、工具与接口、知识范围、部门是**结构性列**，值读不到也保留列名，
 * 格内写「未接 / 待核实 / —」并在卡底声明一次；只有「技能」是纯数据列，没有读口
 * 时整列不渲染。列是结构，不因为值读不到就删列。
 *
 * 四道门的真值不在这里重写：verdict 复用 `modules/duty/readiness.ts` 的
 * v1/v2/v6（V3 整门无读口，按 GATE_READ_PORTS 标注「未接」并排除出交集）。
 */

import {
  GATE_READ_PORTS,
  intersection,
  v1Verdict,
  v2Verdict,
  v6Verdict,
  type ApprovalEvidence,
  type ConfigView,
  type GateVerdict,
  type IntersectionResult,
  type StationBinding,
} from "../duty/readiness";

// ---------------------------------------------------------------- 读口四态

export const DASH = "—";

export type PillTone = "ok" | "warn" | "bad" | "info" | "mut";

export type Read<T> =
  | { k: "loading" }
  | { k: "ready"; data: T; asOf: string | null }
  | { k: "empty"; asOf: string | null }
  | { k: "missing"; note: string; title: string | null; asOf: string | null }
  | { k: "error"; note: string; requestId: string | null };

/** 工程语言（路由 / 状态码 / 上游代号）只进 title，不进句子层。 */
export function readTitle(status: number, code: string | null, requestId: string | null): string | null {
  const parts = [status > 0 ? `HTTP ${status}` : null, code, requestId ? `rid ${requestId}` : null];
  const kept = parts.filter((part): part is string => Boolean(part));
  return kept.length > 0 ? kept.join(" · ") : null;
}

/** 人话缺读口：说清「这一项现在没有读口」，并区分上游不可达与未接线。 */
export function missingNote(status: number, code: string | null): string {
  const tag = code ?? "";
  if (/upstream_unavailable/i.test(tag)) return "工具登记上游此刻不可达，本次未取到数";
  if (status === 0) return "服务没有回应，这一项此刻读不到";
  if (status === 502 || status === 504) return "上游此刻不可达，本次未取到数";
  if (status === 503 || status === 501) return "上游还没有提供这一项";
  if (/not_wired/i.test(tag)) return "这一项的读口尚未接线";
  if (status === 404 || status === 405) return "这一项没有可用的读口";
  return `这一项本次读不到（HTTP ${status}）`;
}

/**
 * 一次读取的结局归档。`picked === null` 表示形状不认识 ⇒ 按 error（不猜），
 * 绝不当成「读到了空集」。
 */
export function classifyRead<T>(input: {
  status: number;
  code: string | null;
  requestId: string | null;
  asOf: string | null;
  picked: T | null;
  isEmpty: (data: T) => boolean;
}): Read<T> {
  const { status, code, requestId, asOf, picked, isEmpty } = input;
  if (status === 401) return { k: "error", note: "登录状态需要重新确认，这一项没有读到", requestId };
  if (status === 403) return { k: "error", note: "当前账号没有查看这一项的权限", requestId };
  if (status < 200 || status >= 300) {
    return { k: "missing", note: missingNote(status, code), title: readTitle(status, code, requestId), asOf };
  }
  if (picked === null) return { k: "error", note: "返回的形状读不出来，不猜数据", requestId };
  if (isEmpty(picked)) return { k: "empty", asOf };
  return { k: "ready", data: picked, asOf };
}

/** 从 ApiError 取状态码与信封 code/asOf（`body` 是原始 JSON 文本）。 */
export function envelopeOf(error: unknown): {
  status: number;
  code: string | null;
  requestId: string | null;
  asOf: string | null;
} {
  const e = error as { status?: number; requestId?: string; body?: string };
  let code: string | null = null;
  let asOf: string | null = null;
  const raw = e?.body;
  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        if (typeof record.code === "string") code = record.code;
        if (typeof record.asOf === "string") asOf = record.asOf;
      }
    } catch {
      /* 非 JSON 错误体：只保留状态码 */
    }
  }
  return { status: e?.status ?? 0, code, requestId: e?.requestId ?? null, asOf };
}

// ---------------------------------------------------------------- 形状助手

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pick(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const hit = str(record[key]);
    if (hit) return hit;
  }
  return null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function listOf(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body;
  if (!isRecord(body)) return null;
  for (const key of ["items", "rows", "employees", "spaces", "servers"]) {
    if (Array.isArray(body[key])) return body[key] as unknown[];
  }
  return null;
}

function asOfOf(body: unknown): string | null {
  return isRecord(body) ? pick(body, ["asOf", "as_of", "generatedAt", "generated_at"]) : null;
}

/** 200 响应里的读取时刻（用于卡头「读取于」）；没有就 null，不拿页面时钟顶替。 */
export function readAsOf(body: unknown): string | null {
  return asOfOf(body);
}

// ---------------------------------------------------------------- 读口地址

/** 同源 9122 验收脸只认 /agent-api/ 前缀（裸 /api/* 会被 SPA 兜底成 index.html）。 */
export const PORTS = {
  matrix: "/agent-api/api/matrix",
  skills: "/agent-api/api/skills",
  tools: "/agent-api/api/tools",
  mcp: "/agent-api/api/mcp/servers",
  employees: "/agent-api/api/employees",
  spaces: "/agent-api/api/knowledge/spaces",
} as const;

export type PortKey = keyof typeof PORTS;

/** 面上只出中文标签，路由与状态码进 title。 */
export const PORT_LABELS: Record<PortKey, string> = {
  matrix: "员工能力矩阵",
  skills: "技能登记",
  tools: "工具登记",
  mcp: "MCP 服务器",
  employees: "员工名单",
  spaces: "知识空间",
};

/**
 * 四道门的逐员工证据读口（复用 duty/readiness.ts 的 verdict，不另起判据）。
 * 工位与有效配置按员工扇出；审批一次取全量再按 subjectId 归位。
 */
export const GATE_PORTS = {
  stations: (employeeId: string) => `/agent-api/api/workstations?id=${encodeURIComponent(employeeId)}`,
  config: (employeeId: string) => `/agent-api/api/effective-config?id=${encodeURIComponent(employeeId)}`,
  approvals: "/agent-api/api/approvals?status=all&limit=100",
} as const;

/** 与 duty 的 READINESS_FANOUT_LIMIT 同值：逐员工扇出上限，超出部分按待核实。 */
export const GATE_FANOUT_LIMIT = 32;

// ---------------------------------------------------------------- 四道门解析器

/** `GET /api/workstations?id=…` → 工位行（V1 只用工位这一腿）。 */
export function readStations(body: unknown): StationBinding[] | null {
  const items = listOf(body);
  if (items === null) return null;
  const out: StationBinding[] = [];
  for (const entry of items) {
    if (!isRecord(entry)) continue;
    out.push({
      bindingType: pick(entry, ["bindingType", "binding_type"]) ?? undefined,
      channel: pick(entry, ["channel"]) ?? undefined,
      status: pick(entry, ["status"]) ?? undefined,
    });
  }
  return out;
}

/** `GET /api/effective-config?id=…` → V2 需要的两腿 + 知识范围（version.knowledgeScopes）。 */
export function readConfigView(body: unknown): ConfigView | null {
  if (!isRecord(body) || !isRecord(body.version)) return null;
  const version = body.version;
  const scopes = Array.isArray(version.knowledgeScopes)
    ? version.knowledgeScopes.filter((scope): scope is string => typeof scope === "string")
    : [];
  const grants = Array.isArray(body.grants)
    ? body.grants.filter(isRecord).map((grant) => ({ expiresAt: str(grant.expiresAt) }))
    : [];
  return { scopes, grants, resolvedAt: str(body.resolvedAt) };
}

/** `GET /api/approvals?status=all` → 只留该员工 message_send 决策（V6 证据）。 */
export function readApprovalEvidence(body: unknown): ApprovalEvidence[] | null {
  const items = listOf(body);
  if (items === null) return null;
  const out: ApprovalEvidence[] = [];
  for (const row of items) {
    if (!isRecord(row) || !isRecord(row.binding)) continue;
    const binding = row.binding;
    if (str(binding.subjectType) !== "employee") continue;
    const kind = str(binding.changeKind) ?? str(row.action) ?? "";
    if (kind !== "message_send" && kind !== "message.send") continue;
    const subjectId = str(binding.subjectId);
    if (!subjectId) continue;
    out.push({
      subjectId,
      status: str(row.status) ?? "",
      expiresAt: str(row.expiresAt),
      hasApprover: Array.isArray(row.approvers) && row.approvers.length > 0,
    });
  }
  return out;
}

// ---------------------------------------------------------------- 解析器

/** 一条技能引用：`"skill:检索"` 与 `{skillId, version}` 两种形制都收。 */
export interface SkillRef {
  id: string;
  version: string | null;
}

function readRef(raw: unknown): SkillRef | null {
  if (typeof raw === "string") {
    const id = raw.trim();
    return id ? { id, version: null } : null;
  }
  if (!isRecord(raw)) return null;
  const id = pick(raw, ["skillId", "skill_id", "id", "ref", "name", "key"]);
  if (!id) return null;
  return { id, version: pick(raw, ["version", "versionNo", "version_no"]) };
}

/** null = 这一维没有回传（整格不进版面）；空数组 = 读到了且确实是空集（真零）。 */
function readRefs(value: unknown): SkillRef[] | null {
  if (!Array.isArray(value)) return null;
  const out: SkillRef[] = [];
  for (const entry of value) {
    const ref = readRef(entry);
    if (ref) out.push(ref);
  }
  return out;
}

function readStrings(value: unknown): string[] | null {
  const refs = readRefs(value);
  return refs === null ? null : refs.map((ref) => ref.id);
}

export interface PersonCapabilities {
  skills: SkillRef[] | null;
  tools: string[] | null;
  knowledge: string[] | null;
}

export interface MatrixPerson {
  employeeId: string;
  name: string | null;
  title: string | null;
  department: string | null;
  lifecycle: string | null;
  /** 原始 id 只进 title，不上屏。 */
  versionId: string | null;
  effectiveFrom: string | null;
  skillCount: number | null;
  caps: PersonCapabilities;
}

export interface Budget {
  dailyTokens: number | null;
  monthlyCostUsd: number | null;
  perRunMaxUsd: number | null;
}

export interface MatrixPayload {
  people: MatrixPerson[];
  budgets: Map<string, Budget>;
  asOf: string | null;
}

/**
 * `GET /api/matrix`。实测形状（2026-11-24 · BFF 8092 经 9122 同源）：
 * `items[{employeeId,name,title,lifecycleState,currentVersionId,effectiveFrom,
 *  skillRefs,skillCount,budget{dailyTokens,monthlyCostUsd,perRunMaxUsd}}]`
 * 另兼容旧域形状 `capabilities{skills,tools,knowledge}`：读到才算真值。
 */
export function readMatrixPayload(body: unknown): MatrixPayload | null {
  const items = listOf(body);
  if (items === null) return null;
  const people: MatrixPerson[] = [];
  const budgets = new Map<string, Budget>();
  for (const entry of items) {
    if (!isRecord(entry)) continue;
    const employeeId = pick(entry, ["employeeId", "employee_id", "id"]);
    if (!employeeId) continue;
    const caps = isRecord(entry.capabilities) ? entry.capabilities : entry;
    const refs = readRefs(entry.skillRefs ?? entry.skill_refs) ?? readRefs(caps.skills);
    const declared = num(entry.skillCount ?? entry.skill_count);
    people.push({
      employeeId,
      name: pick(entry, ["name", "displayName", "display_name"]),
      title: pick(entry, ["title", "role", "post", "duty"]),
      department: pick(entry, ["department"]),
      lifecycle: pick(entry, ["lifecycleState", "lifecycle_state", "lifecycle"]),
      versionId: pick(entry, ["currentVersionId", "versionRef", "version_ref"]),
      effectiveFrom: pick(entry, ["effectiveFrom", "effective_from"]),
      skillCount: declared ?? (refs ? refs.length : null),
      caps: {
        skills: refs,
        tools: readStrings(caps.tools ?? entry.toolRefs),
        knowledge: readStrings(caps.knowledge ?? entry.knowledgeScopes),
      },
    });
    if (isRecord(entry.budget)) {
      budgets.set(employeeId, {
        dailyTokens: num(entry.budget.dailyTokens),
        monthlyCostUsd: num(entry.budget.monthlyCostUsd),
        perRunMaxUsd: num(entry.budget.perRunMaxUsd),
      });
    }
  }
  return { people, budgets, asOf: asOfOf(body) };
}

/** `GET /api/employees`：矩阵读口缺席时的名单兜底（只有身份，没有能力清单）。 */
export interface RosterPerson {
  employeeId: string;
  name: string | null;
  title: string | null;
  department: string | null;
  lifecycle: string | null;
}

export function readRoster(body: unknown): RosterPerson[] | null {
  const items = listOf(body);
  if (items === null) return null;
  const out: RosterPerson[] = [];
  for (const entry of items) {
    if (!isRecord(entry)) continue;
    const employeeId = pick(entry, ["employeeId", "employee_id", "id"]);
    if (!employeeId) continue;
    out.push({
      employeeId,
      name: pick(entry, ["name", "displayName", "display_name"]),
      title: pick(entry, ["title", "duty", "role"]),
      department: pick(entry, ["department"]),
      lifecycle: pick(entry, ["lifecycleState", "lifecycle_state", "lifecycle"]),
    });
  }
  return out;
}

/** `GET /api/skills`。 */
export interface SkillItem {
  id: string;
  name: string;
  version: string | null;
  enabled: boolean | null;
}

export function readSkills(body: unknown): SkillItem[] | null {
  const items = listOf(body);
  if (items === null) return null;
  const out: SkillItem[] = [];
  for (const entry of items) {
    if (!isRecord(entry)) continue;
    const id = pick(entry, ["id", "skillId", "name", "key"]);
    if (!id) continue;
    out.push({
      id,
      name: pick(entry, ["name", "label", "title"]) ?? id,
      version: pick(entry, ["version", "versionNo", "version_no"]),
      enabled: typeof entry.enabled === "boolean" ? entry.enabled : null,
    });
  }
  return out;
}

/** `GET /api/knowledge/spaces`：租户级空间清单（员工↔空间归属无读口）。 */
export interface SpaceItem {
  id: string;
  name: string;
  documents: number | null;
  lastSyncAt: string | null;
}

export function readSpaces(body: unknown): SpaceItem[] | null {
  const items = listOf(body);
  if (items === null) return null;
  const out: SpaceItem[] = [];
  for (const entry of items) {
    if (!isRecord(entry)) continue;
    const id = pick(entry, ["space_id", "spaceId", "id"]) ?? String(out.length + 1);
    out.push({
      id,
      name: pick(entry, ["name", "title"]) ?? `空间 ${id}`,
      documents: num(entry.document_count ?? entry.documentCount),
      lastSyncAt: pick(entry, ["last_sync_at", "lastSyncAt"]),
    });
  }
  return out;
}

/** `GET /api/tools`、`GET /api/mcp/servers`：本屏只需要「有没有这一腿」与条数。 */
export function readCountedItems(body: unknown): unknown[] | null {
  return listOf(body);
}

// ---------------------------------------------------------------- 身份格式

/** `emp_217A91BA…` → `217A91BA`：面上不落原始 id。 */
export function shortCode(employeeId: string | null | undefined): string {
  if (!employeeId) return DASH;
  const bare = employeeId.replace(/^emp_/i, "").replace(/[^a-z0-9]/gi, "");
  return bare.slice(0, 8).toUpperCase() || DASH;
}

/** 头像缩写：中文取前两字，拉丁取首字母对。 */
export function initials(name: string | null | undefined, code: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return code.slice(0, 2);
  // 以拉丁字母开头（如「AgentOS 产品助理」「QA2 契约验证」）时取拉丁词首：
  // 两个拉丁词取首字母对（Ada Lovelace → AL），只有一个就取它的前两位
  // （AgentOS 产品助理 → AG）。这一支必须先于中文判断，否则「产品助理」
  // 全体员工都会缩成「产品」两个字，头像失去辨识度。
  if (/^[A-Za-z]/.test(trimmed)) {
    const latin = trimmed.split(/\s+/).filter((part) => /^[A-Za-z]/.test(part));
    if (latin.length >= 2) return latin.slice(0, 2).map((part) => part.slice(0, 1).toUpperCase()).join("");
    const head = latin[0] ?? trimmed;
    return head.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || trimmed.slice(0, 2).toUpperCase();
  }
  const cjk = trimmed.match(/[\u4e00-\u9fff]/g);
  if (cjk && cjk.length >= 2) return cjk.slice(0, 2).join("");
  if (cjk && cjk.length === 1) return cjk[0] ?? trimmed.slice(0, 1);
  const letters = trimmed.replace(/[^\p{L}\p{N}]/gu, " ").trim().split(/\s+/);
  const acro = letters.slice(0, 2).map((part) => part.slice(0, 1).toUpperCase()).join("");
  return acro || trimmed.slice(0, 2).toUpperCase();
}

const LIFECYCLE_LABEL: Record<string, string> = {
  active: "在岗",
  onboarding: "入职中",
  paused: "已暂停",
  offboarding: "离职中",
  draft: "草稿",
  archived: "已归档",
};

const LIFECYCLE_TONE: Record<string, PillTone> = {
  active: "ok",
  onboarding: "warn",
  paused: "warn",
  offboarding: "mut",
  draft: "mut",
  archived: "mut",
};

/** 冻结六态词汇；在岗 = lifecycleState === active（骨架覆盖分母口径）。 */
export function lifecycleLabel(value: string | null | undefined): string {
  if (!value) return DASH;
  return LIFECYCLE_LABEL[value] ?? value;
}

export function lifecycleTone(value: string | null | undefined): PillTone {
  if (!value) return "mut";
  return LIFECYCLE_TONE[value] ?? "mut";
}

/** 北京时间切到分；读不到就「—」，不拿当前时刻冒充数据时刻。 */
export function fmtStamp(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return DASH;
  const bj = new Date(ms + 480 * 60_000);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}`;
}

export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return value.toLocaleString("en-US");
}

/** 引用编号 → 芯片可读名：技能台账名优先，其次 id 尾段，最后「技能 N」。 */
export function refLabel(id: string, index: number, names: Map<string, string>): string {
  const known = names.get(id);
  if (known) return known;
  const tail = id.split(/[:/._-]+/).filter(Boolean).pop() ?? "";
  const human = tail.length > 0 && !/^[0-9a-f]{6,}$/i.test(tail) && /\p{L}/u.test(tail);
  return human ? tail : `技能 ${index + 1}`;
}

// ---------------------------------------------------------------- 列定义（骨架原文）

export interface ColumnDef {
  key: string;
  label: string;
  /** 骨架 thead 里 `<span class="meta">` 的括注。 */
  meta?: string;
  right?: boolean;
}

/** 卡一 thead 原文：员工 / 技能 / 工具与接口 / 知识范围 / 四道门（V1·V2·V3·V6） / 缺口（未挂必挂技能） */
export const PEOPLE_PIN_LABEL = "员工";

/**
 * 四道门展开成四列（工单 2026-11-24 第二轮）：V1 群@ / V2 ReBAC / V3 引用 / V6 审批。
 * 列名逐字取工单原文；骨架的合并表头「四道门（V1·V2·V3·V6）」留在卡头说明里。
 */
export const GATE_COLUMNS: readonly ColumnDef[] = [
  { key: "v1", label: "V1 群@" },
  { key: "v2", label: "V2 ReBAC" },
  { key: "v3", label: "V3 引用" },
  { key: "v6", label: "V6 审批" },
];

/** 结构性列：读不到值也保留列头（列是结构，格内写状态并在卡底说明）。 */
export const STRUCTURAL_COLUMNS: readonly ColumnDef[] = [
  ...GATE_COLUMNS,
  { key: "gap", label: "缺口（未达/可判定）", right: true },
  { key: "tools", label: "工具与接口" },
  { key: "kb", label: "知识范围" },
  { key: "dept", label: "部门" },
];

export const PEOPLE_COLUMNS: readonly ColumnDef[] = [
  { key: "skills", label: "技能" },
  ...STRUCTURAL_COLUMNS,
];

export type ResourceKind = "skill" | "tool" | "kb";

/** 卡二的资源类型分段（骨架 data-capres 三档，词汇与 CAP_RESOURCES 一致）。 */
export const RESOURCE_KINDS: readonly { id: ResourceKind; label: string }[] = [
  { id: "skill", label: "技能" },
  { id: "tool", label: "工具与接口" },
  { id: "kb", label: "知识空间" },
];

/** 卡二 thead 原文（骨架 renderCapRes 的三种 kind）。 */
export const RESOURCE_HEADS: Record<ResourceKind, readonly ColumnDef[]> = {
  skill: [
    { key: "name", label: "技能" },
    { key: "version", label: "已挂版本" },
    { key: "count", label: "挂载人数", right: true },
    { key: "state", label: "覆盖状态" },
  ],
  tool: [
    { key: "name", label: "服务" },
    { key: "ops", label: "操作" },
    { key: "access", label: "接入状态" },
    { key: "count", label: "已挂载人数", meta: "（有效授权未接入）", right: true },
    { key: "state", label: "覆盖状态" },
  ],
  kb: [
    { key: "name", label: "空间" },
    { key: "scope", label: "操作与范围" },
    { key: "count", label: "已确认人数", right: true },
    { key: "state", label: "覆盖状态" },
  ],
};

/**
 * 任务口径在名称列与计数列之间插入「列 = 员工」的 ●/空 命中面；
 * 骨架原列名一律不动，表头与表体由同一个函数产出，列数不可能错位。
 *
 * `drop` 里点名的是**没有读口**的骨架原列（已挂版本 / 操作 / 接入状态 /
 * 操作与范围，以及人数读不出的「挂载人数」）：这些列整列不渲染，
 * 而不是满列「—」。名称列、员工列与覆盖状态列永远保留。
 */
export function resourceHead(
  kind: ResourceKind,
  people: readonly ResourceColumn[],
  drop: readonly string[] = [],
): ColumnDef[] {
  const dropped = new Set(drop);
  const base = RESOURCE_HEADS[kind].filter((column) => !dropped.has(column.key));
  const name = base.slice(0, 1);
  const middles = base.slice(1).filter((column) => column.key !== "count" && column.key !== "state");
  const tail = base.filter((column) => column.key === "count" || column.key === "state");
  const empColumns: ColumnDef[] = people.map((person) => ({
    key: `emp:${person.key}`,
    label: person.label,
    meta: person.code,
  }));
  return [...name, ...middles, ...empColumns, ...tail];
}

// ---------------------------------------------------------------- 单元

export type MatrixCell =
  | { k: "text"; text: string; title?: string; mono?: boolean }
  | { k: "dash"; title: string }
  | { k: "chips"; chips: { label: string; title: string }[]; more: number; title: string }
  | { k: "mark"; hit: boolean; title: string }
  | { k: "gate"; state: "pass" | "fail" | "pending" | "unwired"; text: string; title: string }
  | { k: "state"; tone: PillTone; text: string; title: string; dashed?: boolean };

export const UNKNOWN_CELL_TITLE =
  "待核实：后端没有给出这一格，按「无读口」显示——不猜授权，也不写 0。";

// ---------------------------------------------------------------- 一次读取的合集

/** 四道门的证据合集：逐员工归档，谁没回就记在谁头上（不拿别人的判定顶替）。 */
export interface GateEvidence {
  k: "loading" | "settled";
  stations: Record<string, Read<StationBinding[]>>;
  configs: Record<string, Read<ConfigView>>;
  approvals: Read<ApprovalEvidence[]>;
}

export const IDLE_GATE: GateEvidence = {
  k: "loading",
  stations: {},
  configs: {},
  approvals: { k: "loading" },
};

export interface Ports {
  matrix: Read<MatrixPayload>;
  roster: Read<RosterPerson[]>;
  skills: Read<SkillItem[]>;
  tools: Read<unknown[]>;
  mcp: Read<unknown[]>;
  spaces: Read<SpaceItem[]>;
  gate: GateEvidence;
}

export const IDLE_PORTS: Ports = {
  matrix: { k: "loading" },
  roster: { k: "loading" },
  skills: { k: "loading" },
  tools: { k: "loading" },
  mcp: { k: "loading" },
  spaces: { k: "loading" },
  gate: IDLE_GATE,
};

/**
 * 名单（矩阵优先，兜底次之）——卡一与卡二共用。
 *
 * 矩阵读口本身不带 department（实测 shape 只有 employeeId/name/title/lifecycle/
 * skillRefs/budget），而员工台账 `/api/employees` 有：矩阵回了但部门为空的员工，
 * 按 employeeId 从台账补部门真值（只补这一个字段，不借台账的身份/能力）。
 */
export function peopleOf(ports: Ports): { people: MatrixPerson[]; source: "matrix" | "roster" | null } {
  if (ports.matrix.k === "ready") {
    const rosterDept = new Map<string, string>();
    if (ports.roster.k === "ready") {
      for (const person of ports.roster.data) {
        if (person.department) rosterDept.set(person.employeeId, person.department);
      }
    }
    const people = ports.matrix.data.people.map((person) =>
      person.department === null && rosterDept.has(person.employeeId)
        ? { ...person, department: rosterDept.get(person.employeeId)! }
        : person,
    );
    return { people, source: "matrix" };
  }
  if (ports.roster.k === "ready") {
    return {
      people: ports.roster.data.map((person) => ({
        employeeId: person.employeeId,
        name: person.name,
        title: person.title,
        department: person.department,
        lifecycle: person.lifecycle,
        versionId: null,
        effectiveFrom: null,
        skillCount: null,
        caps: { skills: null, tools: null, knowledge: null },
      })),
      source: "roster",
    };
  }
  return { people: [], source: null };
}

/** 员工级挂载读口：返回 null = 这位员工这一维没有回传（整格不进版面）。 */
export function mountedIds(person: MatrixPerson, kind: ResourceKind): string[] | null {
  if (kind === "skill") {
    return person.caps.skills === null ? null : person.caps.skills.map((ref) => ref.id);
  }
  return kind === "tool" ? person.caps.tools : person.caps.knowledge;
}

// ---------------------------------------------------------------- 四道门（卡一）

export interface GateEntry {
  /** null = 该员工这一门的证据源没有回答（待核实，绝不进分子分母）。 */
  v1: GateVerdict | null;
  v2: GateVerdict | null;
  v6: GateVerdict | null;
}

export interface GateTable {
  /** 逐员工的 V1/V2/V6 判定（V3 整门无读口，不在这里）。 */
  entries: Map<string, GateEntry>;
  /** 可判定门（V1/V2/V6）的交集：未达＝可判定里未能全过，可判定＝三门都有答的员工。 */
  gap: IntersectionResult;
  /** 三门证据都回来的员工数 / 员工总数。 */
  coverage: { covered: number; requested: number };
  /** 逐员工证据是否还在路上。 */
  pending: boolean;
}

/** 缺口口径的一句话（卡底只声明一次）：V3 不计入交集。 */
export const GAP_CALIBER =
  "缺口＝可判定门（V1 群@ / V2 ReBAC / V6 审批）取交集：未达是这些门未能全部通过的员工数，可判定是三道门都给出了判定的员工数；V3 引用门无读口，整门不计入。";

/**
 * 四道门的逐员工判定：verdict 全部复用 duty/readiness.ts，这里只负责归位与交集。
 * 某位员工某条证据腿没有回数 ⇒ 该门记 null（待核实），既不算通过也不算未过。
 */
export function gateTable(ports: Ports, now: number = Date.now()): GateTable {
  const { people } = peopleOf(ports);
  const gate = ports.gate;
  const entries = new Map<string, GateEntry>();
  const verdictSets: (GateVerdict | null)[][] = [[], [], []];
  const approvalsAnswered = gate.approvals.k === "ready" || gate.approvals.k === "empty";
  const approvalRows = gate.approvals.k === "ready" ? gate.approvals.data : [];

  for (const person of people) {
    const stationRead = gate.stations[person.employeeId];
    const configRead = gate.configs[person.employeeId];
    const stations =
      stationRead && stationRead.k === "ready"
        ? stationRead.data
        : stationRead && stationRead.k === "empty"
          ? []
          : null;
    const v1 = stations === null ? null : v1Verdict(stations);
    const v2 = configRead && configRead.k === "ready" ? v2Verdict(configRead.data, now) : null;
    const v6 = approvalsAnswered ? v6Verdict(approvalRows, person.employeeId, now) : null;
    entries.set(person.employeeId, { v1, v2, v6 });
    verdictSets[0]!.push(v1);
    verdictSets[1]!.push(v2);
    verdictSets[2]!.push(v6);
  }

  const pending = gate.k === "loading";
  const gap = pending ? { pass: null, denom: null } : intersection(verdictSets, people.length);
  const covered = people.filter((person) => {
    const entry = entries.get(person.employeeId);
    return Boolean(entry && entry.v1 !== null && entry.v2 !== null && entry.v6 !== null);
  }).length;

  return { entries, gap, coverage: { covered, requested: people.length }, pending };
}

const VERDICT_TEXT: Record<GateVerdict, { state: "pass" | "fail" | "pending"; text: string }> = {
  pass: { state: "pass", text: "通过" },
  fail: { state: "fail", text: "未过" },
  unknown: { state: "pending", text: "待核实" },
};

function gateCell(verdict: GateVerdict | null, basis: string, missingReason: string): MatrixCell {
  if (verdict === null) {
    return { k: "gate", state: "pending", text: "待核实", title: `${basis} 判定依据：${missingReason}` };
  }
  const shown = VERDICT_TEXT[verdict];
  return { k: "gate", state: shown.state, text: shown.text, title: `${basis} 判定依据：${basisDetail(verdict)}` };
}

function basisDetail(verdict: GateVerdict): string {
  if (verdict === "pass") return "证据齐且满足判据（通过）。";
  if (verdict === "fail") return "证据齐但不满足判据（未过）。";
  return "证据源回了但没有足够读数，按待核实计，不进缺口分子分母。";
}

/** V1 群@：工位里「群绑定 + active」这一腿（第二腿渠道事件读口有意不代理）。 */
function v1Cell(entry: GateEntry, read: Read<StationBinding[]> | undefined): MatrixCell {
  const basis = "V1 群@＝工位存在「群绑定 + active」；单腿口径（最近一次群内应答的第二腿读口有意不代理，本车道不补）。";
  if (read && read.k === "ready") {
    const groups = read.data.filter((station) => station.bindingType === "group");
    const live = groups.filter((station) => station.status === "active").length;
    return gateCell(entry.v1, `${basis} 工位 ${read.data.length} 条，群绑定 ${groups.length} 条、其中在用 ${live} 条。`, "");
  }
  if (read && read.k === "empty") {
    return gateCell(entry.v1, `${basis} 工位读口回的是空集（真零）。`, "");
  }
  if (read && read.k === "loading") {
    return gateCell(null, basis, "工位读口还在读取。");
  }
  return gateCell(
    null,
    basis,
    read && (read.k === "missing" || read.k === "error") ? read.note : "工位读口没有回数。",
  );
}

/** V2 ReBAC：有效配置里知识范围非空 ∧ 存在未过期授权。 */
function v2Cell(entry: GateEntry, read: Read<ConfigView> | undefined): MatrixCell {
  const basis = "V2 ReBAC＝有效配置里知识范围非空，且存在未过期的授权 grant。";
  if (read && read.k === "ready") {
    const alive = read.data.grants.filter((grant) => grant.expiresAt === null || Date.parse(grant.expiresAt) > Date.now()).length;
    return gateCell(entry.v2, `${basis} 知识范围 ${read.data.scopes.length} 个，未过期授权 ${alive} 条。`, "");
  }
  if (read && read.k === "loading") return gateCell(null, basis, "有效配置读口还在读取。");
  return gateCell(
    null,
    basis,
    read && (read.k === "missing" || read.k === "error") ? read.note : "有效配置读口没有回数。",
  );
}

/** V6 审批：该员工存在「message_send + 有审批人 + 已批准 + 未过期」。 */
function v6Cell(entry: GateEntry, approvals: Read<ApprovalEvidence[]>): MatrixCell {
  const basis = "V6 审批＝该员工有「message_send」决策且已由审批人批准、未过期。";
  if (approvals.k === "ready" || approvals.k === "empty") {
    const rows = approvals.k === "ready" ? approvals.data : [];
    const total = rows.length;
    return gateCell(entry.v6, `${basis} 全部决策行 ${total} 条（全量审批里属于数字员工 message_send 的部分）。`, "");
  }
  if (approvals.k === "loading") return gateCell(null, basis, "审批读口还在读取。");
  return gateCell(null, basis, approvals.note);
}

/** V3 引用：整门无读口，格内写「未接」（不是「—」），列头保留。 */
export function v3Cell(): MatrixCell {
  return {
    k: "gate",
    state: "unwired",
    text: "未接",
    title: `V3 引用＝${GATE_READ_PORTS.V3.reason}；这一门给不出通过数，也不计入缺口。`,
  };
}

/** 缺口格：未达 N / 可判定 M。判不出来时写「待核实」，不写 0。 */
export function gapCell(table: GateTable): MatrixCell {
  const unmet = table.gap.pass === null || table.gap.denom === null ? null : table.gap.denom - table.gap.pass;
  if (unmet === null || table.gap.denom === null) {
    return {
      k: "text",
      mono: true,
      text: table.pending ? "读取中" : "待核实",
      title: table.pending
        ? "四道门的证据还在路上，交集分母未定。"
        : `没有一道可判定门同时给出判定（证据覆盖 ${table.coverage.covered}/${table.coverage.requested} 位员工），交集给不出数。`,
    };
  }
  return {
    k: "text",
    mono: true,
    text: `${unmet} / ${table.gap.denom}`,
    title: `${GAP_CALIBER} 本次：可判定 ${table.gap.denom} 人，未达 ${unmet} 人，三门全过 ${table.gap.pass ?? 0} 人；证据覆盖 ${table.coverage.covered}/${table.coverage.requested} 位员工。`,
  };
}

/** 知识范围：员工级授权取自有效配置 version.knowledgeScopes；台账空间名用于换名。 */
function knowledgeCell(person: MatrixPerson, read: Read<ConfigView> | undefined, names: Map<string, string>): MatrixCell {
  const fromCaps = person.caps.knowledge;
  if (read && read.k === "ready") {
    const scopes = read.data.scopes;
    if (scopes.length === 0) {
      return {
        k: "text",
        text: "0 个",
        mono: true,
        title: "有效配置里的知识范围是空集（真零），不是读取失败。",
      };
    }
    const chips = scopes.slice(0, 2).map((scope) => ({ label: names.get(scope) ?? scope, title: scope }));
    return {
      k: "chips",
      chips,
      more: Math.max(0, scopes.length - chips.length),
      title: `知识范围 ${scopes.length} 个（员工级授权，取自有效配置）：${scopes.join("、")}`,
    };
  }
  if (fromCaps !== null) return countOrDash(fromCaps, "知识范围", { k: "empty", asOf: null }, names);
  if (read && read.k === "loading") return { k: "dash", title: "知识范围：员工级读口还在读取，这一格暂空，不代表 0。" };
  return {
    k: "dash",
    title: `知识范围：员工级授权没有读到（${
      read && (read.k === "missing" || read.k === "error") ? read.note : "有效配置读口没有回数"
    }），这一格按「—」显示，不等于 0。`,
  };
}

/** 工具与接口：员工级授权没有读口（/api/tools 上游不可达），格内「—」+ 卡底声明一次。 */
function toolsCell(person: MatrixPerson, ports: Ports): MatrixCell {
  if (person.caps.tools !== null) return countOrDash(person.caps.tools, "工具与接口", ports.tools, new Map());
  return {
    k: "dash",
    title: "工具与接口：员工级授权没有读口，工具登记上游此刻不可达；这一格按「—」显示，不代表 0。",
  };
}

function deptCell(department: string | null): MatrixCell {
  if (!department) {
    return { k: "text", text: "未登记", title: "员工台账里没有部门字段（null），按未登记显示，不猜。" };
  }
  return { k: "text", text: department, title: `部门：${department}（员工台账真值）` };
}

// ---------------------------------------------------------------- 卡底声明

/** 四道门证据腿的缺读口（逐员工扇出失败也在这里说一次）。 */
export function gateNotes(gate: GateEvidence): PortNote[] {
  if (gate.k === "loading") return [];
  const out: PortNote[] = [];
  const scan = <T,>(label: string, reads: Read<T>[], single: boolean) => {
    const total = reads.length;
    const bad = reads.filter((read) => read.k === "missing" || read.k === "error");
    if (bad.length === 0 || total === 0) return;
    const first = bad[0]!;
    const note = first.k === "missing" ? first.note : first.note;
    const title = first.k === "missing" ? first.title : first.requestId ? `rid ${first.requestId}` : null;
    out.push({
      label,
      note: single ? note : `${note}（${bad.length}/${total} 位员工的这一腿没有回数）`,
      title,
    });
  };
  scan("工位读口", Object.values(gate.stations), false);
  scan("有效配置读口", Object.values(gate.configs), false);
  scan("审批读口", [gate.approvals], true);
  return out;
}

/**
 * 卡底「可用性」声明：工具与 MCP 两条读口不可达时写一次，
 * 说清这两列不出值、不代表 0。可达时返回 null（不造声明）。
 */
export function availabilityNote(ports: Ports): PortNote | null {
  const toolsBad = ports.tools.k === "missing" || ports.tools.k === "error";
  const mcpBad = ports.mcp.k === "missing" || ports.mcp.k === "error";
  if (!toolsBad && !mcpBad) return null;
  const reasons: string[] = [];
  if (toolsBad) reasons.push("工具登记上游此刻不可达");
  if (mcpBad) reasons.push("MCP 服务器读口尚未接线");
  const who = toolsBad && mcpBad ? "工具与 MCP 读口不可达" : toolsBad ? "工具读口不可达" : "MCP 读口不可达";
  return {
    label: "可用性",
    note: `${who}：${reasons.join("、")}；这两列不出值，也不代表 0。`,
    title: null,
  };
}

// ---------------------------------------------------------------- 卡一视图

export interface PeopleRow {
  /** 原始 employeeId：只进 data-testid 与 href，不上屏。 */
  key: string;
  name: string;
  code: string;
  initials: string;
  /** 第二行：工号短码（任务口径）+ 部门·岗位真读数。 */
  sub: string;
  /** 部门台账真值（null = 台账没登记）：部门筛选与部门列共用。 */
  department: string | null;
  lifecycle: string | null;
  lifecycleText: string;
  lifecycleToneValue: PillTone;
  isActive: boolean;
  /** 按列 key 取；只渲染 peopleColumns() 里真的存在的那几列。 */
  cells: Partial<Record<string, MatrixCell>>;
  /** 已挂技能数（排序列的真读数）；null = 没有读口。 */
  skillsCount: number | null;
  /** 行 title：生效时刻等真读数的落点，不占版面。 */
  rowTitle: string;
  haystack: string;
  source: "matrix" | "roster" | null;
}

function dimensionDashTitle(leg: Read<unknown>, label: string): string {
  if (leg.k === "missing") return `${label}：缺读口——${leg.note}。员工级挂载也没有读口，这一格按「—」显示，不等于 0。`;
  if (leg.k === "error") return `${label}：这一项本次没有读到（${leg.note}），不等于 0。`;
  if (leg.k === "loading") return `${label}：还在读取。`;
  const size = leg.k === "ready" && Array.isArray(leg.data) ? leg.data.length : 0;
  return `${label}：员工级挂载没有读口（${label}登记表已读到 ${size} 项），这一格按「—」显示，不猜。`;
}

function chipsCell(ids: readonly string[], names: Map<string, string>, title: string): MatrixCell {
  const chips = ids.slice(0, 3).map((id, index) => ({
    label: refLabel(id, index, names),
    title: id,
  }));
  return { k: "chips", chips, more: Math.max(0, ids.length - chips.length), title };
}

function countOrDash(
  ids: string[] | null,
  label: string,
  leg: Read<unknown>,
  names: Map<string, string>,
): MatrixCell {
  if (ids === null) return { k: "dash", title: dimensionDashTitle(leg, label) };
  if (ids.length === 0) {
    return { k: "text", text: "0 项", mono: true, title: `${label}：读到的真零（空集），不是读取失败。` };
  }
  return chipsCell(ids, names, `${label}：${ids.length} 项（员工级挂载读口回传）。`);
}

/**
 * 卡一：行 = 员工，列 = 骨架同名列。
 *
 * 列的存在性由读口决定——技能数/技能引用、工具、知识三维只要有**任何一位**
 * 员工回传了，这一列才进版面；四道门与缺口没有读口，整列永不渲染。
 * 名单优先 `/api/matrix`，缺席时用 `/api/employees` 兜底（兜底只有身份）。
 */
export function buildPeopleRows(ports: Ports, table: GateTable = gateTable(ports)): PeopleRow[] {
  const names = skillNameMap(ports);
  const spaceNames = spaceNameMap(ports);
  const { people, source } = peopleOf(ports);

  const rows: PeopleRow[] = people.map((person) => {
    const code = shortCode(person.employeeId);
    const name = (person.name ?? "").trim() || `员工 ${code}`;
    const refs = person.caps.skills;
    const declared = person.skillCount;

    let skillsCell: MatrixCell;
    if (declared === null && refs === null) {
      skillsCell = {
        k: "dash",
        title:
          source === "roster"
            ? "员工名单兜底只有身份，没有技能清单：矩阵读口本次没回这一格，不补 0。"
            : "矩阵读口这一格没有回传技能数：不补 0。",
      };
    } else if (refs !== null && refs.length > 0) {
      const ids = refs.map((ref) => ref.id);
      skillsCell = {
        k: "chips",
        chips: ids.slice(0, 3).map((id, index) => {
          const ref = refs[index];
          return {
            label: refLabel(id, index, names),
            title: ref?.version ? `${id} · 版本 ${ref.version}` : id,
          };
        }),
        more: Math.max(0, ids.length - 3),
        title: `${declared ?? ids.length} 项已挂载（技能引用读口）；芯片最多 3 枚，其余进 +N。`,
      };
    } else if (declared !== null && declared > 0) {
      skillsCell = {
        k: "text",
        mono: true,
        text: `${declared} 项`,
        title: "只回传了技能数，没有回传技能清单：不猜挂的是哪几项。",
      };
    } else {
      skillsCell = {
        k: "text",
        text: "0 项",
        mono: true,
        title: "该员工未挂载技能（技能引用读口回的是空集，真零，不是读取失败）。",
      };
    }

    const deptRole =
      person.department && person.title
        ? `${person.department} · ${person.title}`
        : person.department ?? person.title ?? null;

    const rowTitleParts = [
      person.effectiveFrom ? `生效 ${fmtStamp(person.effectiveFrom)}` : null,
      source === "roster" ? "名单来自员工名单兜底：矩阵读口本次未回" : null,
    ].filter((part): part is string => Boolean(part));

    const entry = table.entries.get(person.employeeId) ?? { v1: null, v2: null, v6: null };
    const configRead = ports.gate.configs[person.employeeId];

    return {
      key: person.employeeId,
      name,
      code,
      initials: initials(person.name, code),
      sub: deptRole ? `${code} · ${deptRole}` : code,
      department: person.department,
      lifecycle: person.lifecycle,
      lifecycleText: lifecycleLabel(person.lifecycle),
      lifecycleToneValue: lifecycleTone(person.lifecycle),
      isActive: person.lifecycle === "active",
      cells: {
        skills: skillsCell,
        v1: v1Cell(entry, ports.gate.stations[person.employeeId]),
        v2: v2Cell(entry, configRead),
        v3: v3Cell(),
        v6: v6Cell(entry, ports.gate.approvals),
        gap: gapCell(table),
        tools: toolsCell(person, ports),
        kb: knowledgeCell(person, configRead, spaceNames),
        dept: deptCell(person.department),
      },
      skillsCount: declared ?? (refs ? refs.length : null),
      rowTitle: rowTitleParts.join(" · ") || name,
      haystack: [
        name,
        code,
        person.title ?? "",
        person.department ?? "",
        lifecycleLabel(person.lifecycle),
        ...(refs ?? []).map((ref) => `${ref.id} ${names.get(ref.id) ?? ""}`),
      ]
        .join(" ")
        .toLowerCase(),
      source,
    };
  });

  // 骨架口径按缺口降序（未达多者在前）；交集给不出数时退成「已挂技能数升序 → 姓名」。
  const unmetOf = (row: PeopleRow): number => {
    const cell = row.cells.gap;
    if (!cell || cell.k !== "text" || !/\d+\s*\/\s*\d+/.test(cell.text)) return -1;
    return Number(cell.text.split("/")[0]!.trim()) || 0;
  };
  rows.sort((a, b) => {
    const an = unmetOf(a);
    const bn = unmetOf(b);
    if (an !== bn) return bn - an;
    const as = a.skillsCount ?? -1;
    const bs = b.skillsCount ?? -1;
    if (as !== bs) return as - bs;
    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });
  return rows;
}

/**
 * 卡一进版面的列：结构列（四道门 / 缺口 / 工具 / 知识 / 部门）**永远保留**，
 * 值读不到只影响格内状态与卡底声明；「技能」是纯数据列，没有任何员工回传才整列不渲染。
 */
export function peopleColumns(ports: Ports): ColumnDef[] {
  const { people } = peopleOf(ports);
  const hasSkills = people.some((person) => person.skillCount !== null || person.caps.skills !== null);
  return PEOPLE_COLUMNS.filter((column) => column.key !== "skills" || hasSkills);
}

function skillNameMap(ports: Ports): Map<string, string> {
  const map = new Map<string, string>();
  if (ports.skills.k === "ready") {
    for (const item of ports.skills.data) map.set(item.id, item.name);
  }
  return map;
}

/** 知识空间台账的名字（按 space id 与名字双向落位，供知识范围的芯片换名）。 */
function spaceNameMap(ports: Ports): Map<string, string> {
  const map = new Map<string, string>();
  if (ports.spaces.k === "ready") {
    for (const item of ports.spaces.data) {
      map.set(item.id, item.name);
      map.set(item.name, item.name);
    }
  }
  return map;
}

// ---------------------------------------------------------------- 卡二视图

export interface ResourceColumn {
  key: string;
  label: string;
  code: string;
  isActive: boolean;
}

export interface ResourceRow {
  key: string;
  name: MatrixCell;
  /** 名称列与员工列之间的骨架原列，按骨架列 key 取（已挂版本 / 操作 / 接入状态 / 操作与范围）。 */
  extras: Partial<Record<string, MatrixCell>>;
  /** 与 view.columns 同序；只含读口回了这一维的员工。 */
  hits: MatrixCell[];
  count: MatrixCell;
  state: MatrixCell;
  haystack: string;
}

export interface ResourceView {
  /** 列 = 员工：只含这一维读口回了的（没回的员工整列不进版面）。 */
  columns: ResourceColumn[];
  rows: ResourceRow[];
  /** 该资源类型的主读口结局。 */
  kindRead: Read<unknown>;
  /** 该类型是否有员工级挂载读口。 */
  mountedRead: boolean;
  /** 覆盖分母（在岗人数，骨架口径）。 */
  denominator: number;
  totalPeople: number;
  /** 员工列是否覆盖了全部员工（否则挂载人数只能按「—」）。 */
  fullColumns: boolean;
  /** 没有读口、整列不进版面的骨架原列 key。 */
  dropColumns: string[];
}

/**
 * 覆盖状态四档（骨架口径原文：正常（绿）、单点（琥珀）、零覆盖（有业务下限为红，
 * 无下限为灰虚线）、待核实（琥珀 + ?））。业务下限没有读口 ⇒ 零覆盖一律灰虚线。
 */
export function coverageState(covered: number, denominator: number, known: boolean): MatrixCell {
  if (!known) {
    return { k: "state", tone: "warn", text: "待核实", title: UNKNOWN_CELL_TITLE };
  }
  if (covered === 0) {
    return {
      k: "state",
      tone: "mut",
      text: "零覆盖",
      dashed: true,
      title: `零覆盖：在岗 ${denominator} 人里没有一位挂载。业务下限没有读口，按骨架口径走灰虚线（不判红）。`,
    };
  }
  if (covered === 1) {
    return { k: "state", tone: "warn", text: "单点", title: `只有 1 人在岗挂载（在岗分母 ${denominator}）。` };
  }
  return { k: "state", tone: "ok", text: "正常", title: `${covered} 人在岗挂载（在岗分母 ${denominator}）。` };
}

export function resourceColumns(ports: Ports): ResourceColumn[] {
  const { people } = peopleOf(ports);
  return people.map((person) => ({
    key: person.employeeId,
    label: (person.name ?? "").trim() || `员工 ${shortCode(person.employeeId)}`,
    code: shortCode(person.employeeId),
    isActive: person.lifecycle === "active",
  }));
}

/**
 * 卡二：行 = 资源（技能 / 服务 / 空间），列 = 员工。
 * 命中画 ●，未命中留空（读口回了才算「未挂载」）；某位员工这一维没有回传，
 * 该列整列不进版面（而不是满列「—」）；空集真零 = 画空但保留行列。
 */
export function buildResourceView(ports: Ports, kind: ResourceKind): ResourceView {
  const { people, source } = peopleOf(ports);
  const allColumns = resourceColumns(ports);
  const columns = allColumns.filter((column) => {
    const person = people.find((each) => each.employeeId === column.key);
    return person ? mountedIds(person, kind) !== null : false;
  });
  const byKey = new Map(people.map((person) => [person.employeeId, person]));
  const denominator = allColumns.filter((column) => column.isActive).length;
  const names = skillNameMap(ports);
  const kindRead: Read<unknown> =
    kind === "skill" ? ports.skills : kind === "tool" ? ports.tools : ports.spaces;
  const mountedRead = columns.length > 0;
  const fullColumns = columns.length === allColumns.length;

  // 行集 = 登记表（ready/empty 都算读到）∪ 员工实际挂载的引用。
  const ids: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  };
  if (kind === "skill" && ports.skills.k === "ready") {
    for (const item of ports.skills.data) push(item.id);
  }
  if (kind === "kb" && ports.spaces.k === "ready") {
    for (const item of ports.spaces.data) push(item.id);
  }
  if (kind === "tool" && ports.tools.k === "ready") {
    for (const item of ports.tools.data) {
      const id = isRecord(item) ? pick(item, ["id", "name", "toolId", "key"]) : str(item);
      if (id) push(id);
    }
  }
  for (const person of people) {
    for (const id of mountedIds(person, kind) ?? []) push(id);
  }

  const spaceMap = new Map<string, SpaceItem>();
  if (ports.spaces.k === "ready") {
    for (const item of ports.spaces.data) spaceMap.set(item.id, item);
  }

  const countKnown = mountedRead && fullColumns;
  const rows: ResourceRow[] = ids.map((id) => {
    const hits: MatrixCell[] = columns.map((column) => {
      const person = byKey.get(column.key);
      const list = person ? mountedIds(person, kind) : null;
      if (!person || list === null) {
        return {
          k: "dash",
          title: source === "roster" ? "员工名单兜底腿没有能力清单，这一格不进版面。" : UNKNOWN_CELL_TITLE,
        };
      }
      const mounted = list.includes(id);
      return mounted
        ? { k: "mark", hit: true, title: `${column.label} 已挂载（员工级挂载读口回传）` }
        : { k: "mark", hit: false, title: `${column.label} 未挂载（读口已回，空集是真零）` };
    });

    const covered = hits.filter((cell) => cell.k === "mark" && cell.hit).length;

    const name: MatrixCell = {
      k: "text",
      text: kind === "skill" ? names.get(id) ?? id : kind === "kb" ? spaceMap.get(id)?.name ?? id : id,
      title: id,
    };

    const extras: Partial<Record<string, MatrixCell>> =
      kind === "skill"
        ? {
            version: {
              k: "text",
              mono: true,
              text: versionOf(people, id) ?? DASH,
              title: "已挂版本 = 员工技能引用里带的版本号；这一列没有版本读数时整列不渲染。",
            },
          }
        : kind === "tool"
          ? {
              ops: { k: "dash", title: "工具操作清单没有读口：这一项本次未取到数。" },
              access:
                ports.tools.k === "missing"
                  ? { k: "text", text: "不可达", title: `接入状态：${ports.tools.note}` }
                  : { k: "dash", title: "接入状态没有读口。" },
            }
          : {
              scope: {
                k: "text",
                text: spaceScope(spaceMap.get(id) ?? null),
                title: "操作与范围取自知识空间的文档数与最近同步时刻（租户级，非员工级归属）。",
              },
            };

    const count: MatrixCell = countKnown
      ? { k: "text", mono: true, text: `${covered}`, title: `挂载 ${covered} 人 · 在岗分母 ${denominator}` }
      : { k: "dash", title: `${UNKNOWN_CELL_TITLE} 部分员工没有这一维读口，人数只能按「—」。` };

    return {
      key: id,
      name,
      extras,
      hits,
      count,
      state: coverageState(covered, denominator, countKnown),
      haystack: `${String(name.k === "text" ? name.text : "")} ${id}`.toLowerCase(),
    };
  });

  rows.sort((a, b) => {
    const an = a.count.k === "text" ? Number(a.count.text) || 0 : Number.MAX_SAFE_INTEGER;
    const bn = b.count.k === "text" ? Number(b.count.text) || 0 : Number.MAX_SAFE_INTEGER;
    if (an !== bn) return an - bn;
    const at = a.name.k === "text" ? a.name.text : a.key;
    const bt = b.name.k === "text" ? b.name.text : b.key;
    return at.localeCompare(bt, "zh-Hans-CN");
  });

  const dropColumns: string[] = [];
  if (kind === "skill" && !rows.some((row) => versionOf(people, row.key) !== null)) {
    dropColumns.push("version");
  }
  if (kind === "tool") {
    // 操作清单与接入状态都没有员工级读口，整列不渲染。
    dropColumns.push("ops", "access");
  }
  if (!countKnown) dropColumns.push("count");

  return {
    columns,
    rows,
    kindRead,
    mountedRead,
    denominator,
    totalPeople: allColumns.length,
    fullColumns,
    dropColumns,
  };
}

function versionOf(people: readonly MatrixPerson[], id: string): string | null {
  const versions = new Set<string>();
  for (const person of people) {
    for (const ref of person.caps.skills ?? []) {
      if (ref.id === id && ref.version) versions.add(ref.version);
    }
  }
  return versions.size > 0 ? [...versions].join(" / ") : null;
}

function spaceScope(space: SpaceItem | null): string {
  if (!space) return DASH;
  const docs = space.documents === null ? "文档数未回传" : `${fmtInt(space.documents)} 篇文档`;
  const sync = space.lastSyncAt ? ` · 同步 ${fmtStamp(space.lastSyncAt)}` : "";
  return `${docs}${sync}`;
}

// ---------------------------------------------------------------- 卡底缺读口

export interface PortNote {
  label: string;
  note: string;
  title: string | null;
}

/** 卡底 / 卡三一行「缺读口：…」——只列真缺的腿；全绿时返回空数组。 */
export function missingPorts(ports: Ports, only?: readonly PortKey[]): PortNote[] {
  const legs: [PortKey, Read<unknown>][] = [
    ["matrix", ports.matrix],
    ["skills", ports.skills],
    ["tools", ports.tools],
    ["mcp", ports.mcp],
    ["employees", ports.roster],
    ["spaces", ports.spaces],
  ];
  const out: PortNote[] = [];
  for (const [key, read] of legs) {
    if (only && !only.includes(key)) continue;
    if (read.k === "missing") out.push({ label: PORT_LABELS[key], note: read.note, title: read.title });
    else if (read.k === "error") {
      out.push({ label: PORT_LABELS[key], note: read.note, title: read.requestId ? `rid ${read.requestId}` : null });
    }
  }
  return out;
}

/** 缺口筛选（骨架「只看有缺口」）成不成立：岗位基线读口不在 ⇒ 该筛选不可用。 */
export const GAP_FILTER_TITLE =
  "「只看有缺口」需要岗位基线（必挂技能清单）读口；该读口尚未接线，所以此项筛选暂不可用，不拿技能数当缺口。";