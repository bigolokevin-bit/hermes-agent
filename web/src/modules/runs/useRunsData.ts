/**
 * T15 (PRD v4.1) runs list read — the four states, driven only by what the
 * service said.
 *
 * There is no sample data anywhere: an earlier cut of this lane painted
 * rows when a read failed, which made a broken environment look like working
 * runs. A failure now reads as a failure, an empty answer as an empty
 * answer, and a denied answer as one denied body with no rows.
 *
 * The effect never sets state synchronously. A read is stored against the
 * (attempt, status, window) triple that asked for it, and anything that does
 * not match the current triple renders as loading — so changing a filter
 * cannot leave the previous answer on screen pretending to be the filtered
 * one, and 「重新读取」 really asks again. The window's ISO instant is
 * computed when the read runs, so deep links (`?window=30d`) are honoured
 * per ask, not painted from a stale moment.
 *
 * R30 burned the `?state=` repro leg; R39 restores it on purpose so QA can see
 * the four panels without a broken service. What makes a repro leg honest: it
 * returns before any fetch runs, so it issues zero network requests, the
 * controls that would ask are disabled, and it carries `data-fixture` plus an
 * on-screen note. Without `?state=` every state below still comes from a real
 * read of `/agent-api/api/runs`, and a missing route degrades to the honest
 * error/denied panels instead of sample rows.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { loadRuns, sinceIso, type ListState, type SinceKey } from "./runs";

export type ForcedState = "loading" | "empty" | "error" | "denied";

const FORCED: readonly string[] = ["loading", "empty", "error", "denied"];

/** `?state=` is the shell's QA handle; `ready` is deliberately not reproducible. */
export function forcedStateOf(raw: string | null): ForcedState | null {
  return raw !== null && FORCED.includes(raw) ? (raw as ForcedState) : null;
}

export const PENDING_LIST: ListState = {
  phase: "loading",
  rows: [],
  cursor: null,
  asOf: null,
  asOfSource: null,
  answeredBy: null,
  unreadable: 0,
  failure: null,
};

/** The settled state minus the parts a forced leg cannot honestly claim. */
function forcedResult(state: ForcedState): ListState {
  if (state === "loading") return PENDING_LIST;
  if (state === "empty") return { ...PENDING_LIST, phase: "empty" };
  const failure = {
    sentence: "这条腿是用 ?state= 复现的，服务此刻没有回答过。",
    requestId: null,
    technical: null,
  };
  return { ...PENDING_LIST, phase: state as ListState["phase"], failure };
}

export interface ListFilters {
  status: string | null;
  /** Sent to the BFF under the accepted `employeeId` name; null when no employee is addressed. */
  employeeId?: string | null;
  sinceKey: SinceKey;
}

export interface RunsRefresh {
  busy: boolean;
  /** ISO instant of the last manual refresh that finished well; null before one. */
  updatedAt: string | null;
  error: { sentence: string; requestId: string | null } | null;
  refresh: () => void;
  cancel: () => void;
}

export interface RunsListData extends ListState {
  /** True when the phase came from `?state=` instead of from the service. */
  forced: boolean;
  reload: () => void;
  refreshState: RunsRefresh;
}

export function useRunsData(forced: ForcedState | null, filters: ListFilters): RunsListData {
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<{ key: string; settled: ListState } | null>(null);
  const [busy, setBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<RunsRefresh["error"]>(null);
  const busyRef = useRef(false);
  const generationRef = useRef(0);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const key = `${attempt}|${filters.status ?? ""}|${filters.employeeId ?? ""}|${filters.sinceKey}`;

  useEffect(() => {
    if (forced !== null) return;
    let alive = true;
    const askedKey = key;
    void loadRuns({
      status: filters.status ?? undefined,
      employeeId: filters.employeeId ?? undefined,
      since: sinceIso(filters.sinceKey),
    }).then((settled) => {
      if (alive) setRead({ key: askedKey, settled });
    });
    return () => {
      alive = false;
    };
    // The filters are strings; `key` is the stable dependency that names the
    // ask, and `loadRuns` itself never throws (it folds every outcome into a
    // ListState), so this effect has nothing else to chase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, forced]);

  /**
   * A manual refresh keeps the rows already on screen and asks once. It is
   * not `reload`: bubbling `attempt` would put the page back into its loading
   * panel and drop the rows under the reader's cursor.
   */
  const refresh = useCallback(() => {
    if (forced !== null || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const askedKey = key;
    const generation = ++generationRef.current;
    void loadRuns({
      status: filters.status ?? undefined,
      employeeId: filters.employeeId ?? undefined,
      since: sinceIso(filters.sinceKey),
    }).then((settled) => {
      if (generation !== generationRef.current) return;
      busyRef.current = false;
      setBusy(false);
      if (settled.phase === "ready" || settled.phase === "empty") {
        setRead({ key: askedKey, settled });
        setRefreshError(null);
        setUpdatedAt(new Date().toISOString());
        return;
      }
      // A failed ask never replaces what is on screen with a fresh error
      // panel: the old rows stay, and this line says the refresh failed.
      setRefreshError({
        sentence: settled.failure?.sentence ?? "这次刷新没有读到运行记录。",
        requestId: settled.failure?.requestId ?? null,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, forced, filters.status, filters.employeeId, filters.sinceKey]);

  const cancel = useCallback(() => {
    generationRef.current += 1;
    busyRef.current = false;
    setBusy(false);
    setRefreshError(null);
  }, []);

  const refreshState: RunsRefresh = { busy, updatedAt, error: refreshError, refresh, cancel };

  if (forced !== null) {
    return { ...forcedResult(forced), forced: true, reload, refreshState };
  }

  const current = read !== null && read.key === key ? read.settled : PENDING_LIST;
  return { ...current, forced: false, reload, refreshState };
}