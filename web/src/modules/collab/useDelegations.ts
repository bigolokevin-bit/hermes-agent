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
 * The `?state=` repro leg returns before any fetch runs: it issues zero
 * network requests, and the control that would ask is disabled.
 */
import { useCallback, useEffect, useState } from "react";

import { loadDelegations, type ListState } from "./delegations";

export type ForcedState = "loading" | "empty" | "error" | "denied";

const FORCED: readonly string[] = ["loading", "empty", "error", "denied"];

/** `?state=` is the QA handle; `ready`/`login` are deliberately not reproducible. */
export function forcedStateOf(raw: string | null): ForcedState | null {
  return raw !== null && FORCED.includes(raw) ? (raw as ForcedState) : null;
}

export const PENDING_LIST: ListState = {
  phase: "loading",
  rows: [],
  unreadable: 0,
  failure: null,
};

/** The settled state minus what a forced leg cannot honestly claim. */
function forcedResult(state: ForcedState): ListState {
  if (state === "loading") return PENDING_LIST;
  if (state === "empty") return { ...PENDING_LIST, phase: "empty" };
  return {
    ...PENDING_LIST,
    phase: state,
    failure: {
      sentence: "这条腿是用 ?state= 复现的，服务此刻没有回答过。",
      requestId: null,
      technical: null,
    },
  };
}

export interface DelegationData extends ListState {
  /** True when the phase came from `?state=` instead of from the service. */
  forced: boolean;
  reload: () => void;
  /** True while a real re-read is in flight (never true on a repro leg). */
  reloading: boolean;
}

export function useDelegations(forced: ForcedState | null): DelegationData {
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<{ key: number; settled: ListState } | null>(null);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (forced !== null) return;
    let alive = true;
    const asked = attempt;
    void loadDelegations().then((settled) => {
      if (alive) setRead({ key: asked, settled });
    });
    return () => {
      alive = false;
    };
  }, [attempt, forced]);

  if (forced !== null) {
    return { ...forcedResult(forced), forced: true, reload, reloading: false };
  }

  const current = read !== null && read.key === attempt ? read.settled : PENDING_LIST;
  return { ...current, forced: false, reload, reloading: current.phase === "loading" && read !== null };
}
