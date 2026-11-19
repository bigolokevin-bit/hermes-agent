/**
 * tools & MCP read — the four states, driven only by what the service answered.
 *
 * There is no fallback leg any more. An earlier cut painted fixture rows when
 * the read failed; that made a broken environment look like working servers,
 * which is the one thing this pane must not do. A failure now shows a failure,
 * and the only rows ever drawn are rows the answer carried.
 *
 * The effect never sets state synchronously: a read is stored against the
 * attempt that asked for it, and anything that does not match the current
 * attempt simply renders as loading. That keeps retry honest without a
 * setState-in-effect hop.
 */
import { useCallback, useEffect, useState } from "react";

import {
  fetchServers,
  failureInfo,
  isDenied,
  readFailure,
  shapeFailure,
  type FailureCopy,
  type ServerRow,
} from "./tools";

export type ForcedState = "loading" | "empty" | "error" | "denied";

const FORCED: readonly string[] = ["loading", "empty", "error", "denied"];

/** `?state=` is the shell's QA handle; `ready` is deliberately not reproducible. */
export function forcedStateOf(raw: string | null): ForcedState | null {
  return raw !== null && FORCED.includes(raw) ? (raw as ForcedState) : null;
}

export type ToolsPhase = "loading" | "ready" | "empty" | "error" | "denied";

export interface ToolsState {
  phase: ToolsPhase;
  rows: ServerRow[];
  /** Total the answer declared; null renders 「—」 rather than a counted guess. */
  declaredTotal: number | null;
  /** Rows the answer carried that could not be read — counted, never shown as data. */
  unreadable: number;
  failure: FailureCopy | null;
  /** True when the phase came from `?state=` instead of from the service. */
  forced: boolean;
  reload: () => void;
}

/** The part of the state a read produces, before the reload handle is attached. */
type Settled = Omit<ToolsState, "reload" | "forced">;

const PENDING: Settled = { phase: "loading", rows: [], declaredTotal: null, unreadable: 0, failure: null };

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

function settledOf(read: Awaited<ReturnType<typeof fetchServers>>): Settled {
  if (read.kind === "shape") {
    return { ...PENDING, phase: "error", failure: shapeFailure() };
  }
  return {
    phase: read.rows.length ? "ready" : "empty",
    rows: read.rows,
    declaredTotal: read.declaredTotal,
    unreadable: read.unreadable,
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

export function useToolsData(forced: ForcedState | null): ToolsState {
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<{ attempt: number; settled: Settled } | null>(null);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (forced !== null) return;
    let alive = true;
    const asked = attempt;
    void (async () => {
      try {
        const settled = settledOf(await fetchServers());
        if (alive) setRead({ attempt: asked, settled });
      } catch (err) {
        if (alive) setRead({ attempt: asked, settled: failedOf(err) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt, forced]);

  if (forced !== null) return { ...FORCED_RESULT[forced], forced: true, reload };

  const current = read !== null && read.attempt === attempt ? read.settled : PENDING;
  return { ...current, forced: false, reload };
}
