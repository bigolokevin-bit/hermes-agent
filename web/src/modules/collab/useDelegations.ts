/**
 * COLLAB list read — the states, driven only by what the service said.
 *
 * There is no sample data anywhere in this module. The frozen contract's read
 * route answers 401 without an identity on this machine (probed, recorded in
 * `docs/_artifacts/aud/DONE.md`), so the honest local screen is the 「需要登录」
 * leg — not a painted list, and not a hard failure either.
 *
 * The effect never sets state synchronously: a read is stored against the
 * (attempt) key that asked for it, and anything that does not match renders as
 * loading. So 「重新读取」 really asks again, and a slow answer cannot arrive
 * after a newer one and pretend to be current.
 *
 * R32 fixture debt burn: the `?state=` repro leg was removed. Every state this
 * pane paints comes from a real read of `/agent-api/api/delegations`; a missing
 * answer degrades to the honest panel, never to sample rows.
 */
import { useCallback, useEffect, useState } from "react";

import { loadDelegations, type ListState } from "./delegations";

export const PENDING_LIST: ListState = {
  phase: "loading",
  rows: [],
  unreadable: 0,
  failure: null,
};

export interface DelegationData extends ListState {
  reload: () => void;
  /** True while a real re-read is in flight. */
  reloading: boolean;
}

export function useDelegations(): DelegationData {
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<{ key: number; settled: ListState } | null>(null);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let alive = true;
    const asked = attempt;
    void loadDelegations().then((settled) => {
      if (alive) setRead({ key: asked, settled });
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const current = read !== null && read.key === attempt ? read.settled : PENDING_LIST;
  return { ...current, reload, reloading: current.phase === "loading" && read !== null };
}
