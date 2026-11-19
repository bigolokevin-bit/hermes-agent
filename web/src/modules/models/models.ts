// Module: models — 模型与单价
//
// 三条数据线各自独立，页面不把它们互相换算：
//   ① 模型目录（BFF `/api/models`）：有哪些模型、供应商是谁；
//   ② 单价表（BFF `/api/models/pricing`）：标价，自带 asOf；
//   ③ 实际扣费（BFF `/api/hermes-usage`，平台账本）：真实发生过的金额，自带 asOf。
// 单价 × 用量不是已花费；缺值一律 `—` / 「未计价」，绝不补 0，也不摆示例数字。

export type LedgerStatus = 'upstream' | 'estimated' | 'mixed' | 'unknown';

export interface ModelCatalogRow {
  /** 原始模型标识，只进 title。 */
  modelId: string;
  label: string;
  provider: string | null;
}

export interface ModelPriceRow {
  modelId: string;
  label: string;
  provider: string | null;
  inputPerMillion: number | null;
  outputPerMillion: number | null;
  currency: string | null;
  asOf: string | null;
}

export interface ModelLedger {
  spent: number | null;
  rows: number | null;
  status: LedgerStatus | null;
  asOf: string | null;
}

export const MODELS_GAP = 'GAP-07';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readArray(source: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

/** 模型短码：去掉常见前缀后取 8 位大写；只用于展示，原值进 title。 */
export function shortCode(value: string): string {
  const bare = value.replace(/^(emp_|mdl_|model_)/i, '').replace(/[^a-z0-9]/gi, '');
  return bare.slice(0, 8).toUpperCase() || '—';
}

export function priceLabel(row: ModelPriceRow): string {
  return row.label || row.modelId || '未命名模型';
}

function readCatalogRow(raw: unknown): ModelCatalogRow | null {
  if (!isRecord(raw)) return null;
  const modelId = pickString(raw, ['modelId', 'model_id', 'id', 'model', 'name']);
  const label = pickString(raw, ['label', 'displayName', 'display_name', 'title', 'name']);
  if (!modelId && !label) return null;
  return {
    modelId: modelId || label,
    label,
    provider: pickString(raw, ['provider', 'vendor', 'owner']) || null,
  };
}

function readPriceRow(raw: unknown): ModelPriceRow | null {
  if (!isRecord(raw)) return null;
  const modelId = pickString(raw, ['modelId', 'model_id', 'id', 'model', 'name']);
  const label = pickString(raw, ['label', 'displayName', 'display_name', 'title', 'name']);
  if (!modelId && !label) return null;
  return {
    modelId: modelId || label,
    label,
    provider: pickString(raw, ['provider', 'vendor', 'owner']) || null,
    inputPerMillion: pickNumber(raw, ['inputPerMillion', 'input_per_million', 'inputPerMTok', 'inputPricePerMillion']),
    outputPerMillion: pickNumber(raw, ['outputPerMillion', 'output_per_million', 'outputPerMTok', 'outputPricePerMillion']),
    currency: pickString(raw, ['currency', 'unit']).toUpperCase() || null,
    asOf: pickString(raw, ['asOf', 'as_of', 'updatedAt', 'effectiveAt']) || null,
  };
}

/** 模型目录：只认 BFF 的模型清单，不拿价格表或用量表冒充。 */
export function readCatalog(payload: unknown): { rows: ModelCatalogRow[]; asOf: string | null } {
  if (!isRecord(payload)) return { rows: [], asOf: null };
  const holder = isRecord(payload.catalog) ? payload.catalog : payload;
  const rows = readArray(holder, ['models', 'items', 'rows', 'data'])
    .map(readCatalogRow)
    .filter((row): row is ModelCatalogRow => row !== null);
  return { rows, asOf: pickString(holder, ['asOf', 'as_of', 'generatedAt']) || null };
}

/** 单价表：只认价格端点；没有价格就是空，不从目录猜。 */
export function readPrices(payload: unknown): { rows: ModelPriceRow[]; asOf: string | null } {
  if (!isRecord(payload)) return { rows: [], asOf: null };
  const holder = isRecord(payload.pricing) ? payload.pricing : payload;
  const rows = readArray(holder, ['prices', 'items', 'rows', 'models'])
    .map(readPriceRow)
    .filter((row): row is ModelPriceRow => row !== null);
  return { rows, asOf: pickString(holder, ['asOf', 'as_of', 'generatedAt']) || null };
}

/** 账本：金额来自成本账本投影，null/unknown 保持未知，绝不写成 0。 */
export function readLedger(payload: unknown): ModelLedger {
  if (!isRecord(payload)) return { spent: null, rows: null, status: null, asOf: null };
  const cost = isRecord(payload.cost) ? payload.cost : null;
  const rawStatus = cost ? pickString(cost, ['cost_status', 'status']) : '';
  const status: LedgerStatus | null =
    rawStatus === 'upstream' || rawStatus === 'estimated' || rawStatus === 'mixed' || rawStatus === 'unknown'
      ? rawStatus
      : null;
  return {
    spent: cost ? pickNumber(cost, ['cost_usd', 'costUsd']) : null,
    rows: cost ? pickNumber(cost, ['rows', 'rowCount', 'row_count']) : null,
    status,
    asOf: pickString(payload, ['asOf', 'as_of', 'generatedAt']) || null,
  };
}

/** 北京时间到分；无效/缺失给 `—`。 */
export function fmtStamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '—';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(time)).replace('T', ' ');
}

/** USD 两位小数；未知给 `—`（绝不写 0 冒充「没花钱」）。 */
const USD_FMT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return USD_FMT.format(value);
}

/** 每百万 token 单价；未知给 `—`。 */
export function fmtUnitPrice(value: number | null, currency: string | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const unit = currency === 'USD' || currency === null ? '$' : `${currency} `;
  return `${unit}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 百万 token`;
}

export function ledgerStatusLabel(status: LedgerStatus | null): string {
  if (status === 'upstream') return '账本实测';
  if (status === 'estimated' || status === 'mixed') return '含估算';
  if (status === 'unknown') return '未计价';
  return '计价状态未提供';
}

/** 账本金额：状态未知时显式「未计价」，不把 null/unknown 当 0。 */
export function ledgerMoney(ledger: ModelLedger): string {
  if (ledger.status === 'unknown') return '未计价';
  return fmtUsd(ledger.spent);
}
// ---- reconciliation: per-model usage tokens (reference only) ----------------

export type UsageLine = { model: string; inputTokens: number | null; outputTokens: number | null; apiCalls: number | null };

/** Read `by_model` from Hermes usage. Missing numbers stay null. */
export function readUsageLines(payload: unknown): UsageLine[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const rows = (payload as { by_model?: unknown }).by_model;
  if (!Array.isArray(rows)) return [];
  const lines: UsageLine[] = [];
  for (const raw of rows) {
    if (typeof raw !== 'object' || raw === null) continue;
    const row = raw as Record<string, unknown>;
    const model = typeof row.model === 'string' ? row.model : typeof row.modelId === 'string' ? row.modelId : null;
    if (!model) continue;
    const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
    lines.push({
      model,
      inputTokens: num(row.input_tokens ?? row.inputTokens),
      outputTokens: num(row.output_tokens ?? row.outputTokens),
      apiCalls: num(row.api_calls ?? row.apiCalls),
    });
  }
  return lines;
}

/** Reference-only estimate: unit price × tokens. Never called spend. */
export function estimateUsd(
  inputPerMillion: number | null,
  outputPerMillion: number | null,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  if (inputPerMillion === null || outputPerMillion === null) return null;
  if (inputTokens === null || outputTokens === null) return null;
  return (inputTokens / 1_000_000) * inputPerMillion + (outputTokens / 1_000_000) * outputPerMillion;
}
