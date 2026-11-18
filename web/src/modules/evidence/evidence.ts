/**
 * T25 evidence & citations data layer.
 *
 * Source of truth: BFF `/api/run-events` (citation rows) and `/api/audit`
 * (the audit trail a citation may point at). Domain behind it: run-events
 * citations + audit records.
 *
 * reuse: /v1/run-events/citations
 *
 * Reading rules (same discipline as the matrix module):
 * - tolerate several wire shapes, keep missing fields as null;
 * - an unknown reference stays 「待核实」 — never blank, never guessed;
 * - raw ids never render: labels use 「姓名 · 8 位短码」 and the raw value only
 *   lives in `title`;
 * - a citation without a real target is marked 「原文不可达」 with a reason; it
 *   is NOT rendered as a clickable control.
 */

export type CitationKind = 'run' | 'audit' | 'document' | 'unknown';

export type CitationState = 'verified' | 'unverified';

export interface CitationRow {
  id: string;
  kind: CitationKind;
  title: string;
  snippet: string | null;
  employeeId: string | null;
  employeeName: string | null;
  runId: string | null;
  auditId: string | null;
  /** Same-app path only; external or absent targets stay unreachable. */
  href: string | null;
  at: string | null;
  state: CitationState;
}

export interface CitationsPayload {
  items: CitationRow[];
  asOf: string | null;
  origin: 'bff' | 'fixture';
}

type Rec = Record<string, unknown>;

export function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickString(row: Rec, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickArray(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    for (const key of keys) {
      const candidate = value[key];
      if (Array.isArray(candidate)) return candidate;
    }
  }
  return [];
}

export function shortCode(id: string | null | undefined): string {
  if (!id) return '';
  const bare = id.startsWith('emp_') ? id.slice(4) : id;
  const alnum = bare.replace(/[^a-zA-Z0-9]/g, '');
  return alnum.slice(0, 8).toUpperCase();
}

/** 「姓名 · 8 位短码」 — no bare id, no missing label. */
export function employeeLabel(name: string | null, id: string | null): string {
  const code = shortCode(id);
  if (name && name.trim()) return code ? `${name.trim()} · ${code}` : name.trim();
  return code ? `员工 · ${code}` : '未署名员工';
}

function kindOf(value: string | null): CitationKind {
  if (!value) return 'unknown';
  const v = value.toLowerCase();
  if (v.includes('audit')) return 'audit';
  if (v.includes('run') || v.includes('event')) return 'run';
  if (v.includes('doc') || v.includes('knowledge')) return 'document';
  return 'unknown';
}

function readRow(raw: unknown, index: number): CitationRow | null {
  if (!isRecord(raw)) return null;
  const runId = pickString(raw, ['runId', 'run_id']);
  const auditId = pickString(raw, ['auditId', 'audit_id', 'eventId', 'event_id']);
  const citationId = pickString(raw, ['citationId', 'citation_id', 'id', 'refId', 'ref_id']);
  const id = citationId ?? runId ?? auditId ?? `row-${index + 1}`;
  const hrefRaw = pickString(raw, ['href', 'url', 'link']);
  const href = hrefRaw && hrefRaw.startsWith('/') && !hrefRaw.startsWith('//') ? hrefRaw : null;
  const title =
    pickString(raw, ['title', 'label', 'name', 'claim', 'quote']) ??
    (runId ? `运行记录 ${shortCode(runId)}` : auditId ? `审计记录 ${shortCode(auditId)}` : '未命名引用');
  const employeeId = pickString(raw, ['employeeId', 'employee_id', 'actorId', 'actor_id']);
  const employeeName = pickString(raw, ['employeeName', 'employee_name', 'actorName', 'actor_name']);
  const stateRaw = pickString(raw, ['state', 'status', 'verification']);
  const state: CitationState = stateRaw === 'unverified' || stateRaw === 'unknown' ? 'unverified' : 'verified';
  return {
    id,
    kind: kindOf(pickString(raw, ['kind', 'type', 'sourceType', 'source_type'])),
    title,
    snippet: pickString(raw, ['snippet', 'excerpt', 'summary', 'text']),
    employeeId,
    employeeName,
    runId,
    auditId,
    href,
    at: pickString(raw, ['at', 'createdAt', 'created_at', 'ts', 'time']),
    state,
  };
}

export function readCitations(payload: unknown): CitationsPayload {
  const rows = pickArray(payload, ['items', 'citations', 'rows', 'data']);
  const items = rows
    .map((raw, index) => readRow(raw, index))
    .filter((row): row is CitationRow => row !== null);
  const asOf = isRecord(payload)
    ? pickString(payload, ['asOf', 'as_of', 'generatedAt', 'generated_at'])
    : null;
  return { items, asOf, origin: 'bff' };
}

export const CITATION_KIND_LABEL: Record<CitationKind, string> = {
  run: '运行',
  audit: '审计',
  document: '知识',
  unknown: '其他',
};

export function citationKindLabel(kind: CitationKind): string {
  return CITATION_KIND_LABEL[kind];
}

/** Why a citation cannot be opened — shown instead of a dead link. */
export function unreachableReason(row: CitationRow): string {
  if (row.href) return '';
  if (row.runId) return '这条引用只带了运行编号，接口没有给出可跳转的原文地址。';
  if (row.auditId) return '这条引用只带审计编号，接口没有给出可跳转的原文地址。';
  return '接口没有给出这条引用的原文地址。';
}

/**
 * Fixture used ONLY when the live routes are missing (404) or the BFF cannot be
 * reached. Rows are copied verbatim from the T25 brief's shape study; the page
 * shows a 「示例数据」 badge and `data-fixture="1"` whenever these render.
 */
export const EVIDENCE_FIXTURE: CitationsPayload = {
  origin: 'fixture',
  asOf: null,
  items: [
    {
      id: 'cit_fixture_1',
      kind: 'run',
      title: '华东续费对账的结论引用了 11 月 16 日的运行记录',
      snippet: '对账差异 3 笔，已在第二轮核对中确认。',
      employeeId: 'emp_fixture_xiaoli',
      employeeName: '小鲤',
      runId: 'run_fixture_01',
      auditId: null,
      href: null,
      at: '2026-11-16T06:20:00.000Z',
      state: 'verified',
    },
    {
      id: 'cit_fixture_2',
      kind: 'audit',
      title: '这次交接的审计记录被引用为证据',
      snippet: '接受、交接两步都留了审计行。',
      employeeId: 'emp_fixture_xiaoman',
      employeeName: '小满',
      runId: null,
      auditId: 'aud_fixture_02',
      href: null,
      at: '2026-11-16T06:35:00.000Z',
      state: 'verified',
    },
    {
      id: 'cit_fixture_3',
      kind: 'document',
      title: '一段没有登记来源的说明',
      snippet: null,
      employeeId: null,
      employeeName: null,
      runId: null,
      auditId: null,
      href: null,
      at: null,
      state: 'unverified',
    },
  ],
};