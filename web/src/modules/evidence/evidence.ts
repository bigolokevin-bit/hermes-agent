/**
 * T25 · 证据与引用 data layer (ev5).
 *
 * The real surface this pane can read today is the audit event list:
 *   GET /agent-api/api/audit?from=&to=&limit=50   → 200 { events: [...] }
 *
 * Probed 2026-11-19 (session cookie, via the console BFF):
 *   /api/run-events?kind=citation              → 400 console.missing_param (runId is required)
 *   /api/run-events?runId=<id>&limit=20        → 200, but the payload carries run deltas only,
 *                                                no citations array anywhere
 *   /api/audit?from=<7d>&to=<now>&limit=50     → 200, 50 events (the surface used here)
 *
 * So an "evidence row" is one audit event: who produced it, what object it
 * touched, when, and a link back to the event itself (/audit?detail=<eventId>,
 * the canonical deep link since R31). Every row also names which surface it is
 * evidence from — 知识库 / 运行 / 审计 — with 审计 being the honest answer for
 * an audit event.
 * Nothing is invented: a missing event id reads 「待核实」 and the link block
 * says 「原文不可达」 with the reason, rather than rendering a dead control.
 */

export interface CitationRow {
  /** Stable key for React and test ids. */
  id: string;
  /** The audit event this row stands for, raw (title / copy only). */
  eventId: string | null;
  /** 引用来源, one of the three surfaces this pane can cite: 知识库 / 运行 / 审计. */
  sourceKind: string;
  /** 引用来源 detail: which part of the system produced the record. */
  sourceLabel: string;
  /** 引用来源's actor, already masked: 「姓名 · 8 位短码」/「系统 · 服务名」/「未指派」. */
  actorLabel: string;
  /** Full raw actor reference; title attribute only, never a text node. */
  actorTitle: string | null;
  /** 目标对象: human word for the resource type. */
  targetTypeLabel: string;
  /** 目标对象: masked identifier, or 「未指派」/「待核实」. */
  targetLabel: string;
  /** Full raw resource id; title attribute only. */
  targetTitle: string | null;
  /** Event/record time, ISO as the service sent it. */
  at: string | null;
  /** Same-app link to the original record, or null when there is none. */
  href: string | null;
  /** True when an identifier the row needs is missing → 「待核实」. */
  unverified: boolean;
  /** Plain sentence for the 「原文不可达」 block; empty when href exists. */
  unreachableReason: string;
}

export interface CitationsPayload {
  items: CitationRow[];
  /** The service's own read stamp when it sends one; audit does not today. */
  asOf: string | null;
  origin: 'bff' | 'repro';
}

type Rec = Record<string, unknown>;

const isRecord = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

const pickArray = (value: unknown, keys: string[]): unknown[] | null => {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return null;
  for (const key of keys) {
    const found = value[key];
    if (Array.isArray(found)) return found;
  }
  return null;
};

const pickString = (row: unknown, keys: string[]): string => {
  if (!isRecord(row)) return '';
  for (const key of keys) {
    const found = text(row[key]).trim();
    if (found) return found;
  }
  return '';
};

/** 8-char short code: the id without its namespace prefix, first 8 alnum, upper. */
export function shortCode(id: string): string {
  const bare = id.replace(/^[a-z]+[_:]/i, '');
  const alnum = bare.replace(/[^0-9a-zA-Z]/g, '');
  return (alnum || bare).slice(0, 8).toUpperCase();
}

/** Mid-ellipsis for codes: `tk_01M7…V1XZ`, full value only in the title. */
export function midEllipsis(id: string): string {
  const raw = id.trim();
  if (!raw) return '—';
  if (raw.length <= 14) return raw;
  const cut = raw.indexOf('_');
  const prefix = cut > 0 && cut <= 4 ? raw.slice(0, cut + 1) : '';
  const body = prefix ? raw.slice(prefix.length) : raw;
  if (body.length <= 12) return raw;
  return `${prefix}${body.slice(0, 4)}…${body.slice(-4)}`;
}

/**
 * 引用来源 vocabulary (R33): a citation either lives in a knowledge base, in a
 * run record, or in the audit ledger. The audit route is the only surface that
 * answers on this deployment, so every live row honestly reads 审计; the other
 * two words are used the moment a row says it came from there.
 */
const SOURCE_KINDS: Record<string, string> = {
  knowledge: '知识库',
  kb: '知识库',
  document: '知识库',
  knowledge_base: '知识库',
  run: '运行',
  runs: '运行',
  audit: '审计',
  event: '审计',
};

export function sourceKindOf(raw: unknown): string {
  if (!isRecord(raw)) return '审计';
  const declared = pickString(raw, ['citationKind', 'citation_kind', 'sourceKind', 'source_kind', 'kind']);
  const mapped = SOURCE_KINDS[declared.trim().toLowerCase()];
  if (mapped) return mapped;
  const resource = isRecord(raw.resource) ? text(raw.resource.type).trim().toLowerCase() : '';
  if (resource.startsWith('knowledge')) return '知识库';
  if (resource === 'run') return '运行';
  return '审计';
}

/** Directory names for the ids an audit event carries: `{items:[{employeeId,name}]}`. */
export function employeeNames(payload: unknown): Map<string, string> {
  const names = new Map<string, string>();
  const list = pickArray(payload, ['items', 'employees', 'rows', 'data']);
  if (!list) return names;
  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const id = pickString(entry, ['employeeId', 'employee_id', 'id']);
    const name = pickString(entry, ['name', 'displayName', 'display_name']);
    if (id && name) names.set(id, name);
  }
  return names;
}

const SOURCE_LABELS: Record<string, string> = {
  employee: '员工操作',
  channel: '渠道消息',
  policy: '策略判定',
  approval: '审批流转',
  runtime: '运行时',
  bisheng: '毕昇',
  console: '控制台',
  system: '系统作业',
};

export function sourceLabel(sourceSystem: string): string {
  const key = sourceSystem.trim().toLowerCase();
  if (!key) return '来源未说明';
  return SOURCE_LABELS[key] ?? sourceSystem.trim();
}

const RESOURCE_LABELS: Record<string, string> = {
  employee: '员工',
  employee_version: '员工版本',
  grant: '权限授予',
  action: '动作',
  approval: '审批单',
  task: '任务',
  run: '运行',
  policy: '策略',
  policy_snapshot: '策略快照',
  knowledge_base: '知识库',
  channel: '渠道',
  workstation: '工位',
  creation_attempt: '创建尝试',
  conversation: '会话',
  message: '消息',
};

export function resourceLabel(type: string): string {
  const key = type.trim().toLowerCase();
  if (!key) return '对象未说明';
  return RESOURCE_LABELS[key] ?? type.trim();
}

/** 「姓名 · 8 位短码」/「系统 · 服务名」/「成员 · 后4位」/「未指派」 — never a bare id. */
export function actorLabel(
  actor: unknown,
  names?: Map<string, string>,
): { label: string; title: string | null } {
  if (!isRecord(actor)) return { label: '未指派', title: null };
  const type = text(actor.type).trim().toLowerCase();
  const id = text(actor.id).trim();
  const name = text(actor.displayName ?? actor.display_name).trim() || names?.get(id) || '';
  const title = id || name || null;
  if (name) return { label: `${name} · ${shortCode(id || name)}`, title };
  if (!id && !type) return { label: '未指派', title: null };
  if (type === 'employee') return { label: `员工 · ${shortCode(id)}`, title };
  if (type === 'human' || type === 'user') return { label: `成员 · ${shortCode(id).slice(-4)}`, title };
  if (type === 'system') return { label: `系统 · ${id || '未署名'}`, title };
  if (type === 'service') return { label: `服务 · ${id || '未署名'}`, title };
  if (id) return { label: `未指派 · ${shortCode(id)}`, title };
  return { label: '未指派', title: null };
}

/** 目标对象: employee ids get the same masked treatment, everything else a mid-ellipsis code. */
function targetOf(
  resource: unknown,
  names?: Map<string, string>,
): {
  typeLabel: string;
  label: string;
  title: string | null;
  missing: boolean;
} {
  if (!isRecord(resource)) {
    return { typeLabel: '对象未说明', label: '待核实', title: null, missing: true };
  }
  const type = text(resource.type).trim();
  const id = text(resource.id).trim();
  const typeLabel = resourceLabel(type);
  const person = type.toLowerCase() === 'employee';
  if (!id) {
    // A person-shaped target without an id reads 「未指派」 rather than inventing a code.
    return { typeLabel, label: person ? '未指派' : '待核实', title: null, missing: true };
  }
  const name = person ? names?.get(id) ?? '' : '';
  if (name) return { typeLabel, label: `${name} · ${shortCode(id)}`, title: id, missing: false };
  if (person) return { typeLabel, label: `员工 · ${shortCode(id)}`, title: id, missing: false };
  return { typeLabel, label: midEllipsis(id), title: id, missing: false };
}

const EVENT_LIST_KEYS = ['events', 'items', 'rows', 'data', 'records'];

/** One audit event → one evidence row. */
export function readRow(raw: unknown, index: number, names?: Map<string, string>): CitationRow {
  const eventId = pickString(raw, ['eventId', 'event_id', 'id']);
  const actor = isRecord(raw) ? actorLabel(raw.actor, names) : { label: '未指派', title: null };
  const resourceRaw = isRecord(raw) ? raw.resource : null;
  const target = targetOf(resourceRaw, names);
  const source = sourceLabel(pickString(raw, ['sourceSystem', 'source_system', 'source']));
  const at = pickString(raw, ['occurredAt', 'occurred_at', 'recordedAt', 'recorded_at', 'at', 'timestamp']);
  // R31 moved the audit detail deep link to `?detail=`; `?id=` stays supported
  // for old links, but this pane writes the canonical spelling only.
  const href = eventId ? `/audit?detail=${encodeURIComponent(eventId)}` : null;
  const unverified = !eventId || target.missing;
  return {
    id: eventId || `ev5-row-${index + 1}`,
    eventId: eventId || null,
    sourceKind: sourceKindOf(raw),
    sourceLabel: source,
    actorLabel: actor.label,
    actorTitle: actor.title,
    targetTypeLabel: target.typeLabel,
    targetLabel: target.label,
    targetTitle: target.title,
    at: at || null,
    href,
    unverified,
    unreachableReason: href
      ? ''
      : eventId
        ? '这条记录没有可跳转的原文地址。'
        : '服务的回答里没有给出这条记录的事件编号，所以点不回原文；编号补齐后这里会自动变成可跳转。',
  };
}

export function readCitations(payload: unknown, names?: Map<string, string>): CitationsPayload {
  const list = pickArray(payload, EVENT_LIST_KEYS) ?? [];
  const items = list.map((raw, index) => readRow(raw, index, names));
  const asOf = pickString(payload, ['asOf', 'as_of', 'generatedAt', 'generated_at']);
  return { items, asOf: asOf || null, origin: 'bff' };
}

/** Bounded window: the audit route refuses an unfiltered scan (400 console.missing_filter). */
export const WINDOW_DAYS = 7;

export function citationsUrl(now: Date): string {
  const to = now.toISOString();
  const from = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({ from, to, limit: '50' });
  return `/agent-api/api/audit?${params.toString()}`;
}

