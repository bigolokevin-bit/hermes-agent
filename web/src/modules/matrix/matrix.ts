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
 * missing 与 error 一律渲染成「—」并在卡底写一行缺读口说明；只有 empty 才允许写 0。
 * 不补 0、不补百分比、不摆示例行：旧 PRD §12 的样例门随真读口接线一并撤除，
 * 面上不许再出现 data-fixture。
 */

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

/** null = 这一维没有回传（渲染「—」）；空数组 = 读到了且确实是空集（真零）。 */
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

/** `emp_217A91BA…` → `217A91BA`：面上不落原始 id（UI 契约 BANNED_TEXT 含 `emp_`）。 */
export function shortCode(employeeId: string | null | undefined): string {
  if (!employeeId) return DASH;
  const bare = employeeId.replace(/^emp_/i, "").replace(/[^a-z0-9]/gi, "");
  return bare.slice(0, 8).toUpperCase() || DASH;
}

/** 头像缩写：中文取前两字，拉丁取首字母对。 */
export function initials(name: string | null | undefined, code: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return code.slice(0, 2);
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

export const PEOPLE_COLUMNS: readonly ColumnDef[] = [
  { key: "skills", label: "技能" },
  { key: "tools", label: "工具与接口" },
  { key: "kb", label: "知识范围" },
  { key: "gates", label: "四道门（V1·V2·V3·V6）" },
  { key: "gap", label: "缺口（未挂必挂技能）", right: true },
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
 */
export function resourceHead(kind: ResourceKind, people: readonly ResourceColumn[]): ColumnDef[] {
  const base = RESOURCE_HEADS[kind];
  const head = [...base.slice(0, 1)];
  for (const column of base.slice(1, base.length - 2)) head.push(column);
  for (const person of people) {
    head.push({ key: `emp:${person.key}`, label: person.label, meta: person.code });
  }
  head.push(base[base.length - 2]!, base[base.length - 1]!);
  return head;
}

// ---------------------------------------------------------------- 单元

export type MatrixCell =
  | { k: "text"; text: string; title?: string; mono?: boolean }
  | { k: "dash"; title: string }
  | { k: "chips"; chips: { label: string; title: string }[]; more: number; title: string }
  | { k: "mark"; hit: boolean; title: string }
  | { k: "state"; tone: PillTone; text: string; title: string; dashed?: boolean };

export const UNKNOWN_CELL_TITLE =
  "待核实：后端没有给出这一格，按「无读口」显示——不猜授权，也不写 0。";

const NO_GATES_TITLE =
  "四道门（V1·V2·V3·V6）的判定结果没有读口：这一格后端不给，不猜放行也不猜拦截。";

const NO_BASELINE_TITLE =
  "缺口 = 岗位基线里没挂上的必挂技能数。岗位基线没有读口，口径不成立：不猜基线，也不写 0。";

// ---------------------------------------------------------------- 一次读取的合集

export interface Ports {
  matrix: Read<MatrixPayload>;
  roster: Read<RosterPerson[]>;
  skills: Read<SkillItem[]>;
  tools: Read<unknown[]>;
  mcp: Read<unknown[]>;
  spaces: Read<SpaceItem[]>;
}

export const IDLE_PORTS: Ports = {
  matrix: { k: "loading" },
  roster: { k: "loading" },
  skills: { k: "loading" },
  tools: { k: "loading" },
  mcp: { k: "loading" },
  spaces: { k: "loading" },
};

/** 名单（矩阵优先，兜底次之）——卡一与卡二共用。 */
export function peopleOf(ports: Ports): { people: MatrixPerson[]; source: "matrix" | "roster" | null } {
  if (ports.matrix.k === "ready") return { people: ports.matrix.data.people, source: "matrix" };
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

// ---------------------------------------------------------------- 卡一视图

export interface PeopleRow {
  /** 原始 employeeId：只进 data-testid 与 href，不上屏。 */
  key: string;
  name: string;
  code: string;
  initials: string;
  /** 第二行：工号短码（任务口径）+ 部门·岗位真读数。 */
  sub: string;
  lifecycle: string | null;
  lifecycleText: string;
  lifecycleToneValue: PillTone;
  isActive: boolean;
  /** 与 PEOPLE_COLUMNS 同序。 */
  cells: MatrixCell[];
  /** 行 title：生效时刻等真读数的落点，不占版面。 */
  rowTitle: string;
  haystack: string;
  source: "matrix" | "roster";
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
  return chipsCell(ids, names, `${label}：${ids.length} 项（GET /api/matrix capabilities）。`);
}

/**
 * 卡一：行 = 员工，列 = 骨架同名列。某一维只有后端真回传（skillRefs /
 * capabilities.*）才出真值；名单优先 `/api/matrix`，缺席时用 `/api/employees`
 * 兜底并在行 title 与卡底写明「兜底名单没有能力清单」。
 */
export function buildPeopleRows(ports: Ports): PeopleRow[] {
  const names = skillNameMap(ports);
  const { people, source } = peopleOf(ports);

  const rows: PeopleRow[] = people.map((person) => {
    const code = shortCode(person.employeeId);
    const name = (person.name ?? "").trim() || `员工 ${code}`;
    const refs = person.caps.skills;

    let skillsCell: MatrixCell;
    if (person.skillCount === null && refs === null) {
      skillsCell = {
        k: "dash",
        title:
          source === "roster"
            ? "员工名单兜底（GET /api/employees）只有身份，没有技能清单：矩阵读口本次没回这一格，不补 0。"
            : "矩阵读口这一格没有回传技能数：不补 0。",
      };
    } else if ((refs?.length ?? 0) === 0) {
      skillsCell = {
        k: "text",
        text: "0 项",
        mono: true,
        title: "该员工未挂载技能（GET /api/matrix skillRefs 空集，是读到的真零，不是读取失败）。",
      };
    } else {
      const ids = refs.map((ref) => ref.id);
      const count = person.skillCount ?? ids.length;
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
        title: `${count} 项已挂载（GET /api/matrix skillCount / skillRefs）；芯片最多 3 枚，其余进 +N。`,
      };
    }

    const deptRole =
      person.department && person.title
        ? `${person.department} · ${person.title}`
        : person.department ?? person.title ?? null;

    const rowTitleParts = [
      person.effectiveFrom ? `生效 ${fmtStamp(person.effectiveFrom)}` : null,
      person.versionId ? "当前版本读口已回传" : null,
      source === "roster" ? "名单来自 GET /api/employees 兜底：矩阵读口本次未回" : null,
    ].filter((part): part is string => Boolean(part));

    return {
      key: person.employeeId,
      name,
      code,
      initials: initials(person.name, code),
      sub: deptRole ? `${code} · ${deptRole}` : code,
      lifecycle: person.lifecycle,
      lifecycleText: lifecycleLabel(person.lifecycle),
      lifecycleToneValue: lifecycleTone(person.lifecycle),
      isActive: person.lifecycle === "active",
      cells: [
        skillsCell,
        countOrDash(person.caps.tools, "工具与接口", ports.tools, new Map()),
        countOrDash(person.caps.knowledge, "知识范围", ports.spaces, new Map()),
        { k: "dash", title: NO_GATES_TITLE },
        { k: "dash", title: NO_BASELINE_TITLE },
      ],
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

  // 骨架口径按缺口降序；缺口不成立时退成「已挂技能数升序 → 姓名」，meta 写明排序口径。
  rows.sort((a, b) => {
    const an = cellCount(a.cells[0]);
    const bn = cellCount(b.cells[0]);
    if (an !== bn) return an - bn;
    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });
  return rows;
}

function cellCount(cell: MatrixCell | undefined): number {
  if (!cell) return 0;
  if (cell.k === "chips") return cell.chips.length + cell.more;
  if (cell.k === "text") return Number.parseInt(cell.text, 10) || 0;
  return 0;
}

function skillNameMap(ports: Ports): Map<string, string> {
  const map = new Map<string, string>();
  if (ports.skills.k === "ready") {
    for (const item of ports.skills.data) map.set(item.id, item.name);
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
  /** 名称列与员工列之间的骨架原列（已挂版本 / 操作 + 接入状态 / 操作与范围）。 */
  extras: MatrixCell[];
  /** 与 resourceHead 里的员工列同序。 */
  hits: MatrixCell[];
  count: MatrixCell;
  state: MatrixCell;
  haystack: string;
}

export interface ResourceView {
  columns: ResourceColumn[];
  rows: ResourceRow[];
  /** 该资源类型的主读口结局：missing 时整段按缺读口说明，不摆空表。 */
  kindRead: Read<unknown>;
  /** 该类型是否有员工级挂载读口（matrix 回传了对应维度）。 */
  mountedRead: boolean;
  denominator: number;
  totalPeople: number;
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
 * 命中画 ●，未命中留空（读口回了才算「未挂载」），无读口画「—」——不拿 0 冒充覆盖。
 */
export function buildResourceView(ports: Ports, kind: ResourceKind): ResourceView {
  const columns = resourceColumns(ports);
  const denominator = columns.filter((column) => column.isActive).length;
  const { people, source } = peopleOf(ports);
  const names = skillNameMap(ports);
  const kindRead: Read<unknown> = kind === "skill" ? ports.skills : kind === "tool" ? ports.tools : ports.spaces;

  const field = kind === "skill" ? "skills" : kind === "tool" ? "tools" : "knowledge";
  const mountedRead = people.some((person) => person.caps[field] !== null);

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
    if (kind === "skill") {
      for (const ref of person.caps.skills ?? []) push(ref.id);
    } else {
      for (const id of person.caps[field] ?? []) push(id);
    }
  }

  const spaceMap = new Map<string, SpaceItem>();
  if (ports.spaces.k === "ready") {
    for (const item of ports.spaces.data) spaceMap.set(item.id, item);
  }

  const rows: ResourceRow[] = ids.map((id) => {
    const hits: MatrixCell[] = columns.map((column) => {
      const person = people.find((each) => each.employeeId === column.key);
      if (!person) return { k: "dash", title: UNKNOWN_CELL_TITLE };
      const list = person.caps[field];
      if (list === null) {
        const dim = kind === "skill" ? "技能" : kind === "tool" ? "工具与接口" : "知识范围";
        return {
          k: "dash",
          title: source === "roster"
            ? `${dim}：员工名单兜底腿没有能力清单，这一格后端没回，不猜挂没挂。`
            : `${dim}：矩阵读口对这位员工没有回传这一维，不猜挂没挂。`,
        };
      }
      const mounted = kind === "skill" ? list.some((ref) => ref.id === id) : (list as string[]).includes(id);
      return mounted
        ? { k: "mark", hit: true, title: `${column.label} 已挂载（GET /api/matrix）` }
        : { k: "mark", hit: false, title: `${column.label} 未挂载（读口已回，空集是真零）` };
    });

    const covered = hits.filter((cell) => cell.k === "mark" && cell.hit).length;
    const allKnown = hits.length > 0 && hits.every((cell) => cell.k === "mark");

    const name: MatrixCell = {
      k: "text",
      text: kind === "skill" ? names.get(id) ?? id : kind === "kb" ? spaceMap.get(id)?.name ?? id : id,
      title: id,
    };

    const extras: MatrixCell[] =
      kind === "skill"
        ? [
            {
              k: "text",
              mono: true,
              text: versionOf(people, id) ?? DASH,
              title: "已挂版本 = 员工 skillRefs 里带的版本号；矩阵读口未回版本时按「—」显示，不猜。",
            },
          ]
        : kind === "tool"
          ? [
              { k: "dash", title: "工具操作清单没有读口：GET /api/tools 本次未取到数。" },
              ports.tools.k === "missing"
                ? { k: "text", text: "不可达", title: `接入状态：${ports.tools.note}` }
                : { k: "dash", title: "接入状态没有读口。" },
            ]
          : [
              {
                k: "text",
                text: spaceScope(spaceMap.get(id) ?? null),
                title: "操作与范围取自 GET /api/knowledge/spaces 的文档数与最近同步时刻（租户级，非员工级归属）。",
              },
            ];

    const count: MatrixCell = allKnown
      ? { k: "text", mono: true, text: `${covered}`, title: `挂载 ${covered} 人 · 在岗分母 ${denominator}` }
      : { k: "dash", title: UNKNOWN_CELL_TITLE };

    return {
      key: id,
      name,
      extras,
      hits,
      count,
      state: coverageState(covered, denominator, allKnown),
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

  return {
    columns,
    rows,
    kindRead,
    mountedRead,
    denominator,
    totalPeople: columns.length,
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

/** 卡底一行 11px「缺读口：…」——只列真缺的腿；全绿时返回空数组。 */
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
export const GAP_FILTER_AVAILABLE = false;
export const GAP_FILTER_TITLE =
  "「只看有缺口」需要岗位基线（必挂技能清单）读口；该读口尚未接线，所以此项筛选暂不可用，不拿技能数当缺口。";
