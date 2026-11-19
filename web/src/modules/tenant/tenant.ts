// Module: tenant — 租户与配额（identity tenant 槽）
//
// The BFF has no tenant, quota or identity read route yet. Tenant profile and
// quota limits therefore stay explicitly unavailable (GAP-TEN-01); only the
// two live usage reads below are shown, each with its own source and read time.
// A missing number is never replaced by 0.

import { daysAgoWindow } from '../duty/format';

export const TENANT_GAP = 'GAP-TEN-01';

export interface UsageRead {
  /** null means the endpoint answered but the shape did not carry a usable total. */
  value: number | null;
  /** Why the value is null, in human language. */
  reason: string | null;
  /** Source timestamp from the payload, or the fetch time. */
  asOf: string;
  requestId: string | null;
}

export type RowState =
  | { kind: 'loading' }
  | { kind: 'ready'; usage: UsageRead }
  | { kind: 'error'; message: string; requestId: string | null };

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function stamp(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function formatBeijing(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

/** 8-character short code; IDs never reach the page in full. */
export function shortTenantId(value: string | null): string {
  if (!value) return '—';
  const compact = value.replace(/[^0-9a-zA-Z]/g, '');
  if (!compact) return '—';
  return compact.length <= 8 ? compact.toUpperCase() : compact.slice(-8).toUpperCase();
}

export function readEmployeeUsage(payload: unknown): UsageRead {
  const body = record(payload);
  const asOf = formatBeijing(
    stamp(body?.asOf) ?? stamp(body?.as_of) ?? stamp(body?.generatedAt) ?? stamp(body?.generated_at) ?? new Date().toISOString(),
  );
  const total = count(body?.total);
  if (total !== null) {
    return { value: total, reason: null, asOf, requestId: null };
  }
  const by = record(body?.byLifecycle) ?? record(body?.by_lifecycle);
  if (by) {
    const active = count(by.active);
    const paused = count(by.paused);
    const offboarding = count(by.offboarding);
    if (active !== null && paused !== null && offboarding !== null) {
      return { value: active + paused + offboarding, reason: null, asOf, requestId: null };
    }
  }
  return {
    value: null,
    reason: '员工统计已返回，但没有给出可用的员工总数；这里不补 0。',
    asOf,
    requestId: null,
  };
}

export function readRunUsage(payload: unknown): UsageRead {
  const body = record(payload);
  const asOf = formatBeijing(
    stamp(body?.asOf) ?? stamp(body?.as_of) ?? stamp(body?.generatedAt) ?? stamp(body?.generated_at) ?? new Date().toISOString(),
  );
  const totals = record(body?.totals);
  const total = count(totals?.runs);
  if (total !== null) {
    return { value: total, reason: null, asOf, requestId: null };
  }
  return {
    value: null,
    reason: '运行统计已返回，但没有给出可用的运行总数；这里不补 0。',
    asOf,
    requestId: null,
  };
}

export function runWindow(): { from: string; to: string } {
  return daysAgoWindow(7);
}

export function requestIdOf(error: unknown): string | null {
  const candidate = error as { requestId?: unknown };
  return typeof candidate?.requestId === 'string' && candidate.requestId ? candidate.requestId : null;
}

export function statusOf(error: unknown): number {
  const candidate = error as { status?: unknown };
  return typeof candidate?.status === 'number' ? candidate.status : 0;
}

/** Human sentence, never an HTTP code or upstream body. */
export function messageFor(error: unknown): string {
  const status = statusOf(error);
  if (status === 401) return '需要登录：这个页面的登录状态已经失效，重新登录后再看。';
  if (status === 403) return '当前账号没有查看租户用量的权限。';
  if (status === 404) return '这项数据还没有接入；请联系管理员开通后重试。';
  if (status === 0) return '控制台暂时没有回应，请稍后重试。';
  if (status >= 500) return '数据服务暂时没有响应，请稍后重试。';
  return '这次没能读取租户用量，请稍后重试。';
}

export interface ForcedState {
  kind: 'loading' | 'empty' | 'error';
}

export function readForced(params: URLSearchParams): ForcedState['kind'] | null {
  const raw = params.get('state');
  return raw === 'loading' || raw === 'empty' || raw === 'error' ? raw : null;
}