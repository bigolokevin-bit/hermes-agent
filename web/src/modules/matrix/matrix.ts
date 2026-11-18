/**
 * T13 capability matrix — consumer contract for `/api/matrix` → domain
 * `/v1/matrix/employees`.
 *
 * reuse: /v1/matrix/employees
 *
 * Shape notes (tolerant on purpose):
 * - `employees[]` carries `employeeId`, display `name`, optional `title`, and
 *   the grant cells. The BFF may express cells as an array or as a record keyed
 *   by capability id; both are normalised here.
 * - `capabilities[]` is the column dictionary. A cell for a capability the
 *   dictionary does not describe is dropped; a capability the employee has no
 *   cell for stays `unknown` and reads 「待核实」 — never silently "denied".
 * - Nothing here invents a value: `null`/missing stays `unknown`, and callers
 *   must render that explicitly.
 */

export type MatrixCellState = 'granted' | 'denied' | 'unknown';

export type MatrixView = 'people' | 'resource';

export interface MatrixCell {
  capabilityId: string;
  state: MatrixCellState;
  /** Optional free-text explanation from the domain (never shown raw). */
  note: string | null;
}

export interface MatrixEmployeeRow {
  employeeId: string;
  name: string | null;
  title: string | null;
  lifecycle: string | null;
  cells: MatrixCell[];
}

export interface MatrixCapability {
  capabilityId: string;
  label: string | null;
  group: string | null;
}

export interface MatrixPayload {
  employees: MatrixEmployeeRow[];
  capabilities: MatrixCapability[];
  asOf: string | null;
  /** `fixture` only when the live endpoint could not answer. */
  origin: 'matrix' | 'fixture';
}

// ---------------------------------------------------------------- readers

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function readArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    for (const key of ['items', 'rows', 'employees', 'capabilities']) {
      if (Array.isArray(value[key])) return value[key] as unknown[];
    }
  }
  return [];
}

/** `emp_...` → 8 upper-case characters, the same short code used elsewhere. */
export function shortCode(employeeId: string | null | undefined): string {
  if (!employeeId) return '—';
  const bare = employeeId.replace(/^emp_/i, '').replace(/[^a-z0-9]/gi, '');
  return bare.slice(0, 8).toUpperCase() || '—';
}

/** 姓名 · 短码; a missing name degrades to 「员工 · 短码」, never the raw id. */
export function employeeLabel(employee: MatrixEmployeeRow): string {
  const code = shortCode(employee.employeeId);
  const name = (employee.name ?? '').trim();
  return name ? `${name} · ${code}` : `员工 · ${code}`;
}

/**
 * Normalises one employee's cells. Unknown states stay `unknown`; an unknown
 * capability id is irrelevant to this dictionary and is dropped by the caller.
 */
function readCells(raw: unknown): MatrixCell[] {
  const cells: MatrixCell[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!isRecord(entry)) continue;
      const capabilityId = pickString(entry, ['capabilityId', 'capability_id', 'id', 'key']);
      if (!capabilityId) continue;
      cells.push({ capabilityId, state: readState(entry['state'] ?? entry['granted']), note: pickString(entry, ['note', 'reason']) });
    }
    return cells;
  }
  if (isRecord(raw)) {
    for (const [capabilityId, value] of Object.entries(raw)) {
      if (typeof value === 'string' || typeof value === 'boolean' || value === null) {
        cells.push({ capabilityId, state: readState(value), note: null });
      } else if (isRecord(value)) {
        cells.push({ capabilityId, state: readState(value['state'] ?? value['granted']), note: pickString(value, ['note', 'reason']) });
      }
    }
  }
  return cells;
}

function readState(value: unknown): MatrixCellState {
  if (value === true || value === 'granted' || value === 'allow' || value === 'allowed') return 'granted';
  if (value === false || value === 'denied' || value === 'deny' || value === 'forbidden') return 'denied';
  return 'unknown';
}

export function readMatrixPayload(body: unknown): MatrixPayload {
  const root = isRecord(body) ? body : {};
  const employees: MatrixEmployeeRow[] = [];
  for (const entry of readArray(root['employees'] ?? root)) {
    if (!isRecord(entry)) continue;
    const employeeId = pickString(entry, ['employeeId', 'employee_id', 'id']);
    if (!employeeId) continue;
    employees.push({
      employeeId,
      name: pickString(entry, ['name', 'displayName', 'display_name']),
      title: pickString(entry, ['title', 'role', 'post']),
      lifecycle: pickString(entry, ['lifecycle', 'lifecycleState', 'lifecycle_state']),
      cells: readCells(entry['cells'] ?? entry['grants'] ?? entry['capabilities']),
    });
  }
  const capabilities: MatrixCapability[] = [];
  for (const entry of readArray(root['capabilities'] ?? root['columns'] ?? root['skills'])) {
    if (typeof entry === 'string') {
      capabilities.push({ capabilityId: entry, label: null, group: null });
      continue;
    }
    if (!isRecord(entry)) continue;
    const capabilityId = pickString(entry, ['capabilityId', 'capability_id', 'id', 'key']);
    if (!capabilityId) continue;
    capabilities.push({
      capabilityId,
      label: pickString(entry, ['label', 'name', 'title']),
      group: pickString(entry, ['group', 'category']),
    });
  }
  const asOf = pickString(root, ['asOf', 'as_of', 'generatedAt', 'generated_at']);
  return { employees, capabilities, asOf, origin: 'matrix' };
}

/** Column label: the dictionary label, or a humanised id tail — never raw key. */
export function capabilityLabel(capability: MatrixCapability): string {
  const label = (capability.label ?? '').trim();
  if (label) return label;
  const tail = capability.capabilityId.replace(/[^a-z0-9]/gi, ' ').trim();
  return tail || '未命名能力';
}

// ---------------------------------------------------------------- views

export interface MatrixAxisItem {
  key: string;
  label: string;
  /** Secondary line (岗位 / 分组); empty string when absent. */
  meta: string;
  /** Raw identity, only ever used in `title`. */
  rawTitle: string | null;
}

export interface MatrixAxisCell {
  key: string;
  state: MatrixCellState;
}

export interface MatrixAxisRow {
  key: string;
  label: string;
  meta: string;
  rawTitle: string | null;
  cells: MatrixAxisCell[];
}

export interface MatrixViewData {
  columns: MatrixAxisItem[];
  rows: MatrixAxisRow[];
}

/**
 * The two views are the same table transposed. Cells are keyed
 * `<employeeId>|<capabilityId>` so both directions read one lookup map; a cell
 * the payload does not mention stays `unknown`.
 */
export function buildMatrixView(payload: MatrixPayload, view: MatrixView): MatrixViewData {
  const lookup = new Map<string, MatrixCellState>();
  for (const employee of payload.employees) {
    for (const cell of employee.cells) {
      lookup.set(`${employee.employeeId}|${cell.capabilityId}`, cell.state);
    }
  }
  const stateOf = (employeeId: string, capabilityId: string): MatrixCellState =>
    lookup.get(`${employeeId}|${capabilityId}`) ?? 'unknown';

  if (view === 'resource') {
    const columns = payload.employees.map((employee) => ({
      key: employee.employeeId,
      label: employeeLabel(employee),
      meta: (employee.title ?? '').trim(),
      rawTitle: employee.employeeId,
    }));
    const rows = payload.capabilities.map((capability) => ({
      key: capability.capabilityId,
      label: capabilityLabel(capability),
      meta: (capability.group ?? '').trim(),
      rawTitle: capability.capabilityId,
      cells: payload.employees.map((employee) => ({
        key: employee.employeeId,
        state: stateOf(employee.employeeId, capability.capabilityId),
      })),
    }));
    return { columns, rows };
  }

  const columns = payload.capabilities.map((capability) => ({
    key: capability.capabilityId,
    label: capabilityLabel(capability),
    meta: (capability.group ?? '').trim(),
    rawTitle: capability.capabilityId,
  }));
  const rows = payload.employees.map((employee) => ({
    key: employee.employeeId,
    label: employeeLabel(employee),
    meta: (employee.title ?? '').trim(),
    rawTitle: employee.employeeId,
    cells: payload.capabilities.map((capability) => ({
      key: capability.capabilityId,
      state: stateOf(employee.employeeId, capability.capabilityId),
    })),
  }));
  return { columns, rows };
}

// ---------------------------------------------------------------- fixture

/**
 * FIXTURE — preview only. Used when `/api/matrix` answers 404 or cannot be
 * reached; the page must show the `data-fixture` badge and say so, and DONE.md
 * records 「等 /api/matrix」. No fixture value may ever replace a live answer.
 */
export const MATRIX_FIXTURE: MatrixPayload = {
  origin: 'fixture',
  asOf: null,
  capabilities: [
    { capabilityId: 'cap.run.inspect', label: '查看运行', group: '运行' },
    { capabilityId: 'cap.run.retry', label: '重试运行', group: '运行' },
    { capabilityId: 'cap.approve.decide', label: '审批决策', group: '审批' },
    { capabilityId: 'cap.audit.read', label: '查看审计', group: '治理' },
  ],
  employees: [
    {
      employeeId: 'emp_fixture04a1b2c3',
      name: '小鲤',
      title: '运营',
      lifecycle: 'active',
      cells: [
        { capabilityId: 'cap.run.inspect', state: 'granted', note: null },
        { capabilityId: 'cap.run.retry', state: 'granted', note: null },
        { capabilityId: 'cap.approve.decide', state: 'denied', note: null },
        { capabilityId: 'cap.audit.read', state: 'unknown', note: null },
      ],
    },
    {
      employeeId: 'emp_fixture05d4e5f6',
      name: '小满',
      title: '运营',
      lifecycle: 'active',
      cells: [
        { capabilityId: 'cap.run.inspect', state: 'granted', note: null },
        { capabilityId: 'cap.run.retry', state: 'unknown', note: null },
        { capabilityId: 'cap.approve.decide', state: 'denied', note: null },
        { capabilityId: 'cap.audit.read', state: 'denied', note: null },
      ],
    },
    {
      employeeId: 'emp_fixture07a8b9c0',
      name: '阿吉',
      title: '运营',
      lifecycle: 'active',
      cells: [
        { capabilityId: 'cap.run.inspect', state: 'unknown', note: null },
        { capabilityId: 'cap.run.retry', state: 'denied', note: null },
        { capabilityId: 'cap.approve.decide', state: 'granted', note: null },
        { capabilityId: 'cap.audit.read', state: 'granted', note: null },
      ],
    },
  ],
};