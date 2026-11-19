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
 * Fixture debt burn (R30): the `?state=` repro leg was removed from this
 * page. It used to paint a state from the URL without asking the service,
 * which a reviewer could mistake for an answer; every state below now comes
 * from a real read of `/agent-api/api/runs`, and a missing route degrades to
 * the honest error/denied panels instead of sample rows.
 */
import { useCallback, useEffect, useState } from "react";

import { loadRuns, sinceIso, type ListState, type SinceKey } from "./runs";

export const PENDING_LIST: ListState = {
  phase: "loading",
  rows: [],
  cursor: null,
  answeredBy: null,
  unreadable: 0,
  failure: null,
};

export interface ListFilters {
  status: string | null;
  /** Sent to the BFF under the accepted `employeeId` name; null when no employee is addressed. */
  employeeId?: string | null;
  sinceKey: SinceKey;
}

export interface RunsListData extends ListState {
  reload: () => void;
}

export function useRunsData(filters: ListFilters): RunsListData {
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<{ key: string; settled: ListState } | null>(null);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const key = `${attempt}|${filters.status ?? ""}|${filters.employeeId ?? ""}|${filters.sinceKey}`;

  useEffect(() => {
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
  }, [key]);

  const current = read !== null && read.key === key ? read.settled : PENDING_LIST;
  return { ...current, reload };
}