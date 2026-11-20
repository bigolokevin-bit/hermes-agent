/**
 * One reading of "when was this data collected" for the console.
 *
 * The metrics page and the runs page both show an upstream collection time.
 * They must say it the same way: same six key aliases, same Beijing-to-the-
 * minute text, same title carrying the raw ISO and the source, same sentence
 * when the upstream did not say. This module is the only place that decides
 * that, so neither page can drift into a third dialect.
 *
 * Rules (PRD v4):
 * - Only a top-level ISO-8601 stamp with an offset counts. A natural date, a
 *   bare number or a local wall clock is not a collection time.
 * - Missing or unreadable shows `—` and says so in the title; the browser's
 *   own clock is never substituted.
 * - `asOfSource` never reaches the visible text; it lives in the title only.
 */
export const ASOF_KEYS = [
  'asOf',
  'as_of',
  'collectedAt',
  'collected_at',
  'generatedAt',
  'generated_at',
] as const;

const ISO_STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

const SOURCE_KEYS = ['asOfSource', 'as_of_source', 'collectedFrom', 'collected_from'] as const;

/** `—` when the upstream did not give a collection time. */
export const ASOF_TEXT_MISSING = '—';

/** Title used for every missing / unreadable collection time, both pages. */
export const ASOF_TITLE_MISSING = '上游未返回采集时刻；不用本机时间顶替。';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A real ISO instant with an offset, or null. Never the local clock. */
export function isoAsOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!ISO_STAMP.test(raw)) return null;
  return Number.isNaN(Date.parse(raw)) ? null : raw;
}

export interface AsOfRead {
  asOf: string | null;
  source: string | null;
}

/** Top-level only: a nested stamp belongs to some other object, not to this read. */
export function readAsOf(payload: unknown): AsOfRead {
  if (!record(payload)) return { asOf: null, source: null };
  let asOf: string | null = null;
  for (const key of ASOF_KEYS) {
    const value = isoAsOf(payload[key]);
    if (value !== null) {
      asOf = value;
      break;
    }
  }
  let source: string | null = null;
  for (const key of SOURCE_KEYS) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim() !== '') {
      source = value.trim();
      break;
    }
  }
  return { asOf, source };
}

/** Beijing wall clock to the minute; `—` when there is no instant to show. */
export function asOfText(asOf: string | null): string {
  if (asOf === null) return ASOF_TEXT_MISSING;
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(asOf));
}

export interface AsOfView {
  text: string;
  title: string;
}

/**
 * The pair both pages render: visible Beijing time (or `—`), title carrying
 * the raw ISO in UTC plus the source, or the one shared missing sentence.
 */
export function asOfCell(asOf: string | null, source: string | null = null): AsOfView {
  const instant = isoAsOf(asOf);
  if (instant === null) return { text: ASOF_TEXT_MISSING, title: ASOF_TITLE_MISSING };
  return {
    text: asOfText(instant),
    title: `采集时刻 ${instant}（UTC）${source ? ` · 来源 ${source}` : ''}`,
  };
}

/** Convenience for pages that hold a raw payload: read, then render the pair. */
export function asOfFromPayload(payload: unknown): AsOfView & { source: string | null } {
  const read = readAsOf(payload);
  return { ...asOfCell(read.asOf, read.source), source: read.source };
}