// Module: models — 模型与单价
// reuse: /v1/models
// reuse: /v1/models/pricing
//
// 两条数据线严格分开：
//   ① 单价表（价目）：模型标价，来源是价格文件或模型目录，自带 asOf；
//   ② 实际扣费（ledger）：平台账本上真实发生的花费，自带 asOf。
// 两者不是同一条时间轴，也**不允许**用单价 × 用量反推「已花费」——那会在页面上
// 造出一个后端没有的数字。缺值一律 `—`，并在 title 里写清为什么缺。

export type PriceOrigin = 'catalog' | 'ledger' | 'fixture' | 'unknown';

export interface ModelPriceRow {
  /** 原始模型标识，只进 title。 */
  modelId: string;
  label: string;
  provider: string;
  inputPerMillion: number | null;
  outputPerMillion: number | null;
  currency: string | null;
  asOf: string | null;
  origin: PriceOrigin;
}

export interface ModelSpendRow {
  modelId: string;
  label: string;
  spent: number | null;
  currency: string | null;
  runs: number | null;
  asOf: string | null;
  origin: PriceOrigin;
}

export interface ModelsPayload {
  prices: ModelPriceRow[];
  spend: ModelSpendRow[];
  pricesAsOf: string | null;
  spendAsOf: string | null;
  origin: 'bff' | 'fixture';
}

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

export function spendLabel(row: ModelSpendRow): string {
  return row.label || row.modelId || '未命名模型';
}

function readPriceRow(raw: unknown): ModelPriceRow | null {
  if (!isRecord(raw)) return null;
  const modelId = pickString(raw, ['modelId', 'model_id', 'id', 'model', 'name']);
  const label = pickString(raw, ['label', 'displayName', 'display_name', 'title', 'name']);
  if (!modelId && !label) return null;
  return {
    modelId: modelId || label,
    label,
    provider: pickString(raw, ['provider', 'vendor', 'owner']),
    inputPerMillion: pickNumber(raw, ['inputPerMillion', 'input_per_million', 'inputPerMTok', 'inputPricePerMillion']),
    outputPerMillion: pickNumber(raw, ['outputPerMillion', 'output_per_million', 'outputPerMTok', 'outputPricePerMillion']),
    currency: pickString(raw, ['currency', 'unit']).toUpperCase() || null,
    asOf: pickString(raw, ['asOf', 'as_of', 'updatedAt', 'effectiveAt']) || null,
    origin: raw.origin === 'fixture' ? 'fixture' : 'catalog',
  };
}

function readSpendRow(raw: unknown): ModelSpendRow | null {
  if (!isRecord(raw)) return null;
  const modelId = pickString(raw, ['modelId', 'model_id', 'id', 'model', 'name']);
  const label = pickString(raw, ['label', 'displayName', 'display_name', 'title', 'name']);
  if (!modelId && !label) return null;
  return {
    modelId: modelId || label,
    label,
    spent: pickNumber(raw, ['spent', 'spentUsd', 'spent_usd', 'costUsd', 'cost_usd', 'totalCost']),
    currency: pickString(raw, ['currency']).toUpperCase() || 'USD',
    runs: pickNumber(raw, ['runs', 'runCount', 'run_count', 'requests']),
    asOf: pickString(raw, ['asOf', 'as_of', 'updatedAt']) || null,
    origin: 'ledger',
  };
}

/**
 * 宽容 reader：BFF 可能把价目与账本分两条路径返回，也可能合成一个对象。
 * 两种形状都接受，缺哪块就留空数组（页面自己走空态/降级，不猜）。
 */
export function readPrices(payload: unknown): { rows: ModelPriceRow[]; asOf: string | null } {
  if (!isRecord(payload)) return { rows: [], asOf: null };
  const holder = isRecord(payload.pricing) ? payload.pricing : payload;
  const rows = readArray(holder, ['prices', 'items', 'rows', 'models'])
    .map(readPriceRow)
    .filter((row): row is ModelPriceRow => row !== null);
  return { rows, asOf: pickString(holder, ['asOf', 'as_of', 'generatedAt']) || null };
}

export function readSpend(payload: unknown): { rows: ModelSpendRow[]; asOf: string | null } {
  if (!isRecord(payload)) return { rows: [], asOf: null };
  const holder = isRecord(payload.ledger) ? payload.ledger : payload;
  const rows = readArray(holder, ['spend', 'ledger', 'items', 'rows', 'models'])
    .map(readSpendRow)
    .filter((row): row is ModelSpendRow => row !== null);
  return { rows, asOf: pickString(holder, ['asOf', 'as_of', 'generatedAt']) || null };
}

/** 演示数据只在接口 404 或不可达时上场，页面会打「示例数据」角标。 */
export const MODELS_FIXTURE: ModelsPayload = {
  prices: [
    {
      modelId: 'mdl_deepseek_v41_flash',
      label: 'DeepSeek V4.1 Flash',
      provider: 'alibaba-cn',
      inputPerMillion: 0.14,
      outputPerMillion: 0.28,
      currency: 'USD',
      asOf: '2026-11-18T02:00:00.000Z',
      origin: 'fixture',
    },
    {
      modelId: 'mdl_qwen38_flash',
      label: 'Qwen3.8 Flash',
      provider: 'alibaba-cn',
      inputPerMillion: 0.21,
      outputPerMillion: 0.63,
      currency: 'USD',
      asOf: '2026-11-18T02:00:00.000Z',
      origin: 'fixture',
    },
    {
      modelId: 'mdl_local_strata',
      label: 'Strata（本地）',
      provider: 'self-hosted',
      inputPerMillion: null,
      outputPerMillion: null,
      currency: null,
      asOf: null,
      origin: 'fixture',
    },
  ],
  spend: [
    {
      modelId: 'mdl_deepseek_v41_flash',
      label: 'DeepSeek V4.1 Flash',
      spent: 12.48,
      currency: 'USD',
      runs: 214,
      asOf: '2026-11-18T02:00:00.000Z',
      origin: 'fixture',
    },
    {
      modelId: 'mdl_qwen38_flash',
      label: 'Qwen3.8 Flash',
      spent: null,
      currency: 'USD',
      runs: null,
      asOf: '2026-11-18T02:00:00.000Z',
      origin: 'fixture',
    },
  ],
  pricesAsOf: '2026-11-18T02:00:00.000Z',
  spendAsOf: '2026-11-18T02:00:00.000Z',
  origin: 'fixture',
};

/** 北京时间到分；无效/缺失给 `—`（不落空字符串）。 */
export function fmtStamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return '—';
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(time));
  return parts.replace('T', ' ');
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