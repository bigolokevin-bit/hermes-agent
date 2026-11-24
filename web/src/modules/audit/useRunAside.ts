/**
 * AU-07 — read-once hook behind the 「这次运行」 aside.
 *
 * Lifecycle mirrors the pane's own record: when the opened event changes (the
 * caller passes a fresh `ticket` = the detail's identity), the outstanding run
 * read is invalidated by the seq guard — no card of the previous record may
 * paint under the new one (AU-05 race lineage). No runId → idle and zero
 * requests; the aside never asks "just in case".
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchJSON } from "@/lib/api";
import {
  normalizeRunAside,
  runAsideFailureOf,
  runDetailUrl,
  type RunAside,
  type RunAsideFailure,
} from "./runAside";

export type RunAsidePhase = "idle" | "loading" | "ready" | "error";

export interface RunAsideApi {
  phase: RunAsidePhase;
  aside: RunAside | null;
  failure: RunAsideFailure | null;
  retry: () => void;
}

export function useRunAside(
  runId: string | null,
  ticket: string,
): RunAsideApi {
  const [phase, setPhase] = useState<RunAsidePhase>("idle");
  const [aside, setAside] = useState<RunAside | null>(null);
  const [failure, setFailure] = useState<RunAsideFailure | null>(null);
  const seq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const ask = useCallback((): void => {
    if (!runId) {
      ++seq.current;
      abortRef.current?.abort();
      setPhase("idle");
      setAside(null);
      setFailure(null);
      return;
    }
    const my = ++seq.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("loading");
    setAside(null);
    setFailure(null);
    void (async () => {
      try {
        const raw = await fetchJSON<unknown>(runDetailUrl(runId), {
          signal: controller.signal,
        });
        if (my !== seq.current) return;
        const next = normalizeRunAside(raw);
        if (!next) {
          setFailure({ text: "运行回答的形状不认识，这张卡不猜内容。", requestId: null });
          setPhase("error");
          return;
        }
        setAside(next);
        setPhase("ready");
      } catch (err) {
        if (controller.signal.aborted || my !== seq.current) return;
        setFailure(runAsideFailureOf(err));
        setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, ticket]);

  useEffect(() => {
    ask();
    return () => {
      ++seq.current;
      abortRef.current?.abort();
    };
  }, [ask]);

  const retry = useCallback((): void => {
    ask();
  }, [ask]);

  return { phase, aside, failure, retry };
}
