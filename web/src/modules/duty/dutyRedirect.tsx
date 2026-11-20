import { Navigate, useLocation } from "react-router";

/**
 * `/duty` is the old name for the duty console, which now lives on
 * `/overview`. A bare `<Navigate to="/overview">` drops the query string, so
 * the range the caller picked is lost. This carries the one parameter both
 * pages understand, and translates the older `window` spelling onto it.
 *
 * `window`/`range` -> `range`. `14d` becomes `30d` because the trend read
 * fetches thirty days and trims to fourteen (the same rule as dutyRange).
 * Nothing else is mapped: `view`, `groupBy` and `q` have no meaning on
 * `/overview`, and inventing one would put a value on screen that the page
 * never read.
 */
export interface DutyRedirectTarget {
  pathname: string;
  search: string;
}

const RANGE_VALUES = ["24h", "7d", "30d"] as const;

function asRange(value: string | null): string | null {
  if (value === null) return null;
  if (value === "14d") return "30d";
  return (RANGE_VALUES as readonly string[]).includes(value) ? value : null;
}

export function dutyRedirectTarget(search: string): DutyRedirectTarget {
  const incoming = new URLSearchParams(search);
  const range = asRange(incoming.get("range")) ?? asRange(incoming.get("window"));
  const query = range === null ? "" : `?range=${range}`;
  return { pathname: "/overview", search: query };
}

/** The redirect element for the `/duty` route. */
export function DutyRedirect() {
  const location = useLocation();
  return <Navigate to={dutyRedirectTarget(location.search)} replace />;
}
