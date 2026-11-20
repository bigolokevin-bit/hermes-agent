/**
 * Row deep links for /capabilities.
 *
 * A row link is `?row=<tab>:<name>`; URLSearchParams performs the percent
 * encoding when the query is serialised. The name is matched against the rows
 * currently on screen (after search + sort), so a link never invents a row.
 */
import type { ReactNode } from "react";

export const ROW_QUERY_KEY = "row";
export const ROW_GAP = "GAP-CAPROW-01";
export type RowTab = "skills" | "tools";

export interface RowTarget {
  tab: RowTab;
  name: string;
}

export function parseRowTarget(value: string | null): RowTarget | null {
  if (!value) return null;
  const at = value.indexOf(":");
  if (at <= 0 || at === value.length - 1) return null;
  const tab = value.slice(0, at);
  if (tab !== "skills" && tab !== "tools") return null;
  return { tab, name: value.slice(at + 1) };
}

export function rowTargetFor(params: URLSearchParams, tab: RowTab): RowTarget | null {
  const target = parseRowTarget(params.get(ROW_QUERY_KEY));
  return target && target.tab === tab ? target : null;
}

export function withRowTarget(params: URLSearchParams, tab: RowTab, name: string): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set(ROW_QUERY_KEY, `${tab}:${name}`);
  return next;
}

export function withoutRowTarget(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(ROW_QUERY_KEY);
  return next;
}

/** A shareable hash href for one row, keeping the current tab/search/sort. */
export function rowHref(tab: RowTab, name: string, params: URLSearchParams): string {
  const next = withRowTarget(params, tab, name);
  return `#/capabilities?${next.toString()}`;
}

/** The current list without the row locator or a filtering search. */
export function listHref(params: URLSearchParams): string {
  const next = withoutRowTarget(params);
  next.delete("q");
  return `#/capabilities?${next.toString()}`;
}

export function RowMissingNotice({
  reason,
  href,
  onClear,
}: {
  reason: string;
  href: string;
  onClear: () => void;
}): ReactNode {
  return (
    <div className="cap-row-missing" data-testid="cap-row-missing" title={ROW_GAP} role="status">
      <b>该条目不在当前列表里</b>
      <span>{reason}</span>
      <a
        href={href}
        data-testid="cap-row-missing-clear"
        onClick={(event) => {
          event.preventDefault();
          onClear();
        }}
      >
        查看完整列表
      </a>
    </div>
  );
}