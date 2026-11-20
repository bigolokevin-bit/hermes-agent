export type SortKey = "name" | "type" | "updated";
export type SortDir = "asc" | "desc";
export type SortState = { key: SortKey | null; dir: SortDir };

export const SORT_KEYS: SortKey[] = ["name", "type", "updated"];

export function readSort(params: URLSearchParams): SortState {
  const raw = (params.get("sort") ?? "").trim();
  if (!SORT_KEYS.includes(raw as SortKey)) return { key: null, dir: "asc" };
  const dir = (params.get("dir") ?? "").toLowerCase() === "desc" ? "desc" : "asc";
  return { key: raw as SortKey, dir };
}

/** none -> ascending -> descending -> none. */
export function cycleSort(current: SortState, key: SortKey): SortState {
  if (current.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  return { key: null, dir: "asc" };
}

export function applySort(params: URLSearchParams, state: SortState): URLSearchParams {
  if (!state.key) {
    params.delete("sort");
    params.delete("dir");
    return params;
  }
  params.set("sort", state.key);
  params.set("dir", state.dir);
  return params;
}

export function ariaSort(state: SortState, key: SortKey): "ascending" | "descending" | "none" {
  if (state.key !== key) return "none";
  return state.dir === "asc" ? "ascending" : "descending";
}


function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text === "—") return null;
  return text;
}

/**
 * Missing values sort last in both directions; ties keep the ledger order.
 * The returned array never mutates the input.
 */
export function sortRows<T>(rows: T[], state: SortState, pick: (row: T, key: SortKey) => string | null): T[] {
  if (!state.key) return rows.slice();
  const key = state.key;
  const dir = state.dir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: clean(pick(row, key)) }))
    .sort((a, b) => {
      if (a.value === null && b.value === null) return a.index - b.index;
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      const cmp = a.value.localeCompare(b.value, "zh-Hans", { numeric: true, sensitivity: "base" });
      if (cmp !== 0) return cmp * dir;
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}

