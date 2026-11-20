/**
 * `?svc=` deep links for the /system service list.
 *
 * The console is hash routed (`#/system?tab=health&svc=...`), but tests and
 * standalone hosts may use a normal search string. Read/write the same place
 * the router does and preserve every other query parameter.
 */

export const SERVICE_GAP = "GAP-SYS14-01";

function queryOf(search: string, hash: string): URLSearchParams {
  if (hash.startsWith("#/")) {
    const at = hash.indexOf("?");
    return new URLSearchParams(at >= 0 ? hash.slice(at + 1) : "");
  }
  return new URLSearchParams(search);
}

/** Trimmed `svc` value, or null when absent/blank. */
export function readServiceParam(search: string, hash: string): string | null {
  const raw = (queryOf(search, hash).get("svc") ?? "").trim();
  return raw || null;
}

function applyServiceParam(params: URLSearchParams, value: string | null): URLSearchParams {
  if (value) params.set("svc", value);
  else params.delete("svc");
  return params;
}

/** Writes only `svc`; other params stay untouched. */
export function writeServiceParam(value: string | null): void {
  if (typeof window === "undefined") return;
  const { pathname, search, hash } = window.location;
  if (hash.startsWith("#/")) {
    const at = hash.indexOf("?");
    const path = at >= 0 ? hash.slice(0, at) : hash;
    const params = applyServiceParam(new URLSearchParams(at >= 0 ? hash.slice(at + 1) : ""), value);
    const query = params.toString();
    window.history.replaceState({}, "", `${pathname}${search}${path}${query ? `?${query}` : ""}`);
    return;
  }
  const params = applyServiceParam(new URLSearchParams(search), value);
  const query = params.toString();
  window.history.replaceState({}, "", `${pathname}${query ? `?${query}` : ""}${hash}`);
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("zh-Hans");
}

export interface ServiceCandidate {
  key: string;
  name: string | null;
}

/**
 * Match by stable key first, then by the human service name. Names may contain
 * spaces and parentheses, so compare the whole normalised string only.
 */
export function findService<T extends ServiceCandidate>(rows: T[], value: string | null): T | null {
  if (!value) return null;
  const wanted = normalize(value);
  return (
    rows.find((row) => normalize(row.key) === wanted) ??
    rows.find((row) => row.name !== null && normalize(row.name) === wanted) ??
    null
  );
}