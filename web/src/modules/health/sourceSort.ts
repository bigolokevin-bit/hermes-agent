import type { SourceRow, SourceStatus } from "./sourceReads";

export type SourceSortKey = "name" | "state" | "ms" | "asof";
export type SourceSortDir = "asc" | "desc";
export interface SourceSortState {
  key: SourceSortKey;
  dir: SourceSortDir;
}

export const DEFAULT_SOURCE_SORT: SourceSortState = { key: "name", dir: "asc" };
export const SOURCE_SORT_KEYS: SourceSortKey[] = ["name", "state", "ms", "asof"];

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

function queryOf(search: string, hash: string): URLSearchParams {
  if (hash.startsWith("#/")) {
    const at = hash.indexOf("?");
    return new URLSearchParams(at >= 0 ? hash.slice(at + 1) : "");
  }
  return new URLSearchParams(search);
}

/** Default is 口径名 ascending; an absent or invalid pair falls back to it. */
export function readSourceSort(search: string, hash: string): SourceSortState {
  const params = queryOf(search, hash);
  const raw = (params.get("ssort") ?? "").trim().toLowerCase();
  const key = SOURCE_SORT_KEYS.includes(raw as SourceSortKey) ? (raw as SourceSortKey) : DEFAULT_SOURCE_SORT.key;
  const dir: SourceSortDir = (params.get("sdir") ?? "").toLowerCase() === "desc" ? "desc" : "asc";
  return { key, dir };
}

/**
 * Inactive status/elapsed/asOf headers are "none". The active one toggles
 * ascending → descending → back to the default 口径名 ascending order.
 */
export function nextSourceSort(current: SourceSortState, key: Exclude<SourceSortKey, "name">): SourceSortState {
  if (current.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  return { ...DEFAULT_SOURCE_SORT };
}

export function ariaSourceSort(state: SourceSortState, key: SourceSortKey): "ascending" | "descending" | "none" {
  if (state.key !== key) return "none";
  return state.dir === "asc" ? "ascending" : "descending";
}

/** Default 口径名 ascending is the clean URL; other states persist both params. */
export function applySourceSort(params: URLSearchParams, state: SourceSortState): URLSearchParams {
  if (state.key === "name" && state.dir === "asc") {
    params.delete("ssort");
    params.delete("sdir");
    return params;
  }
  params.set("ssort", state.key);
  params.set("sdir", state.dir);
  return params;
}

/**
 * Writes only the hash query for the hash-routed console, otherwise the normal
 * search string. Other params (tab/state/...) are preserved.
 */
export function writeSourceSort(state: SourceSortState): void {
  const { pathname, search, hash } = window.location;
  if (hash.startsWith("#/")) {
    const at = hash.indexOf("?");
    const path = at >= 0 ? hash.slice(0, at) : hash;
    const params = applySourceSort(new URLSearchParams(at >= 0 ? hash.slice(at + 1) : ""), state);
    const query = params.toString();
    const next = `${pathname}${search}${path}${query ? `?${query}` : ""}`;
    window.history.replaceState({}, "", next);
    return;
  }
  const params = applySourceSort(new URLSearchParams(search), state);
  const query = params.toString();
  window.history.replaceState({}, "", `${pathname}${query ? `?${query}` : ""}${hash}`);
}

const STATUS_RANK: Partial<Record<SourceStatus, number>> = {
  ok: 0,
  degraded: 1,
  failed: 2,
  unwired: 3,
};

interface SortableValue {
  text: string | null;
  number: number | null;
}

function valueOf(row: SourceRow, key: SourceSortKey): SortableValue {
  if (key === "name") return { text: row.label.trim() || null, number: null };
  if (key === "state") {
    const rank = STATUS_RANK[row.status];
    return { text: null, number: typeof rank === "number" ? rank : null };
  }
  if (key === "ms") return { text: null, number: typeof row.durationMs === "number" ? row.durationMs : null };
  const iso = row.asOfIso;
  if (typeof iso !== "string" || !ISO.test(iso) || Number.isNaN(new Date(iso).getTime())) {
    return { text: null, number: null };
  }
  return { text: iso, number: null };
}

/** Missing values always trail in both directions; equal rows keep source order. */
export function sortSourceRows(rows: SourceRow[], state: SourceSortState): SourceRow[] {
  const dir = state.dir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: valueOf(row, state.key) }))
    .sort((a, b) => {
      const aMissing = a.value.text === null && a.value.number === null;
      const bMissing = b.value.text === null && b.value.number === null;
      if (aMissing && bMissing) return a.index - b.index;
      if (aMissing) return 1;
      if (bMissing) return -1;
      if (a.value.number !== null && b.value.number !== null) {
        if (a.value.number !== b.value.number) return (a.value.number - b.value.number) * dir;
        return a.index - b.index;
      }
      const cmp = (a.value.text ?? "").localeCompare(b.value.text ?? "", "zh-Hans", {
        numeric: true,
        sensitivity: "base",
      });
      if (cmp !== 0) return cmp * dir;
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}