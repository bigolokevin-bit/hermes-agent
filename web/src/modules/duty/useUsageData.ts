/**
 * T11 usage read — the four states, driven only by what the service answered.
 *
 * Same discipline as the tools lane closeout: there is no fallback leg.
 * A failure reads as a failure; the only numbers ever drawn are numbers the
 * answer carried. The effect never sets state synchronously — a read is
 * stored against the attempt AND the window that asked for it, and anything
 * that does not match simply renders as loading. That keeps retry and the
 * window filter honest without a setState-in-effect hop.
 *
 * A `?state=` repro leg performs no request at all: the phase is derived,
 * never stored, so it cannot leak into a real read.
 */
import { useCallback, useEffect, useState } from "react";

import {
  fetchUsage,
  failureInfo,
  hasAnySignal,
  isDenied,
  parseUsage,
  readFailure,
  shapeFailure,
  type ForcedState,
  type UsageWindowKey,
  type UsageRead,
} from "./usage";

export type UsagePhase = "loading" | "ready" | "empty" | "error" | "denied";

export interface UsageState {
  phase: UsagePhase;
  /** The parsed answer; null in every non-ready leg. */
  read: UsageRead | null;
  failure: ReturnType<typeof shapeFailure> | null;
  /** True when the phase came from `?state=` instead of from the service. */
  forced: boolean;
  reload: () => void;
}

/** The part of the state a read produces, before the reload handle is attached. */
type Settled = Omit<UsageState, "reload" | "forced">;

const PENDING: Settled = { phase: "loading", read: null, failure: null };

/** A forced panel is derived, never stored: it must not survive into a real read. */
const FORCED_RESULT: Record<ForcedState, Settled> = {
  loading: PENDING,
  empty: { ...PENDING, phase: "empty" },
  error: {
    ...PENDING,
    phase: "error",
    failure: { sentence: "这条腿是用 ?state=error 复现的，服务此刻没有回答过。", requestId: null, technical: null },
  },
  denied: {
    ...PENDING,
    phase: "denied",
    failure: { sentence: "这条腿是用 ?state=denied 复现的，服务此刻没有回答过。", requestId: null, technical: null },
  },
};

function settledOf(body: unknown): Settled {
  const parsed = parseUsage(body);
  if (parsed.kind === "shape") {
    return { ...PENDING, phase: "error", failure: shapeFailure() };
  }
  return {
    phase: hasAnySignal(parsed.read) ? "ready" : "empty",
    read: hasAnySignal(parsed.read) ? parsed.read : null,
    failure: null,
  };
}

function failedOf(err: unknown): Settled {
  const info = failureInfo(err);
  return {
    ...PENDING,
    phase: isDenied(info.status) ? "denied" : "error",
    failure: readFailure(err, info),
  };
}

export function useUsageData(forced: ForcedState | null, windowKey: UsageWindowKey): UsageState {
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<{ attempt: number; windowKey: UsageWindowKey; settled: Settled } | null>(null);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (forced !== null) return;
    let alive = true;
    const asked = attempt;
    void (async () => {
      try {
        const settled = settledOf(await fetchUsage(windowKey));
        if (alive) setRead({ attempt: asked, windowKey, settled });
      } catch (err) {
        if (alive) setRead({ attempt: asked, windowKey, settled: failedOf(err) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt, windowKey, forced]);

  if (forced !== null) return { ...FORCED_RESULT[forced], forced: true, reload };

  const current = read !== null && read.attempt === attempt && read.windowKey === windowKey ? read.settled : PENDING;
  return { ...current, forced: false, reload };
}
