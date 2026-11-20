// Shared local search for the /system page. Both the service list and the
// source matrix read the same ?q= value; filtering never issues a request.

export function queryOf(search: string, hash: string): string {
  if (hash.startsWith("#/")) {
    const mark = hash.indexOf("?");
    return mark >= 0 ? hash.slice(mark + 1) : "";
  }
  return (search || "").replace(/^\?/, "");
}

export function readServiceQuery(search: string, hash: string): string {
  return (new URLSearchParams(queryOf(search, hash)).get("q") ?? "").trim();
}

export function writeServiceQuery(value: string | null): void {
  if (typeof window === "undefined") return;
  const q = (value ?? "").trim();
  const hash = window.location.hash;
  if (hash.startsWith("#/")) {
    const mark = hash.indexOf("?");
    const path = mark >= 0 ? hash.slice(0, mark) : hash;
    const params = new URLSearchParams(mark >= 0 ? hash.slice(mark + 1) : "");
    if (q) params.set("q", q);
    else params.delete("q");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}${path}${qs ? `?${qs}` : ""}`);
  } else {
    const params = new URLSearchParams(window.location.search);
    if (q) params.set("q", q);
    else params.delete("q");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${hash}`);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function matchesServiceSearch(
  label: string | null | undefined,
  key: string | null | undefined,
  path: string | null | undefined,
  query: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [label, key, path].some((value) => (value ?? "").toLocaleLowerCase().includes(needle));
}