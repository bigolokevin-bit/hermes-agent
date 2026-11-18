/**
 * approvals data hooks — the four states, driven by what the BFF actually did.
 *
 *   loading  the request is outstanding (skeleton; stale rows are cleared first)
 *   empty    the service answered with a list of zero — the page adds the reason
 *   error    the answer failed in a nameable way (human sentence + trace id + retry)
 *   denied   403 or 404 — ONE body, and no rows are drawn before it
 *   ready    rows exist
 *
 * `forced` is the shell's `?state=` QA repro (web/src/shell/fixtures.ts): it
 * short-circuits the request so a reviewer can open a state the live backend
 * will not produce right now. It never fabricates a row.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { failureInfo, fetchDetail, fetchList, isDenied } from "./api";
import { readFailure, type FailureCopy } from "./copy";
import type { ApprovalDetail, ApprovalRow } from "./model";

export type ForcedState = "loading" | "empty" | "error" | "denied" | null;
export type Phase = "loading" | "ready" | "empty" | "error" | "denied";

export interface ListApi {
  phase: Phase;
  rows: ApprovalRow[];
  /** Rows the answer carried but that could not be read — counted, never shown as data. */
  unreadable: number;
  next: string | null;
  failure: FailureCopy | null;
  /** A later page failed while the loaded rows stay on screen. */
  pageFailure: FailureCopy | null;
  loadingMore: boolean;
  /** True when the state came from `?state=` rather than from the service. */
  forced: boolean;
  reload: () => void;
  loadMore: () => void;
}

interface ListState {
  phase: Phase;
  rows: ApprovalRow[];
  unreadable: number;
  next: string | null;
  failure: FailureCopy | null;
  pageFailure: FailureCopy | null;
  loadingMore: boolean;
  forced: boolean;
}

const INITIAL: ListState = {
  phase: "loading",
  rows: [],
  unreadable: 0,
  next: null,
  failure: null,
  pageFailure: null,
  loadingMore: false,
  forced: false,
};

/** The answer arrived but is not a list at all: that is a failure, not an empty queue. */
class UnreadableList extends Error {
  constructor() {
    super("approvals: answer is not a list");
    this.name = "UnreadableList";
  }
}

function shapeFailure(): FailureCopy {
  return {
    sentence: "服务回的内容不是一份审批列表，这里没能读出任何记录。",
    requestId: null,
    technical: "unexpected payload shape",
  };
}

function copyOf(err: unknown): FailureCopy {
  if (err instanceof UnreadableList) return shapeFailure();
  return readFailure(err, failureInfo(err));
}

function forcedCopy(kind: "error" | "denied", forced: ForcedState): FailureCopy {
  return {
    sentence:
      kind === "denied"
        ? "这块内容要么尚未对你开放，要么当前环境还没有提供它。"
        : "（复现）审批服务在处理时出了错，请稍后重试。",
    requestId: null,
    technical: `?state=${forced}`,
  };
}

export function useApprovalsList(status: string | null, forced: ForcedState): ListApi {
  const [state, setState] = useState<ListState>(INITIAL);
  const seq = useRef(0);
  const nextRef = useRef<string | null>(null);

  const run = useCallback(
    (cursor: string | null, append: boolean): void => {
      const ticket = ++seq.current;
      void (async () => {
        try {
          const page = await fetchList(status, cursor);
          if (ticket !== seq.current) return;
          if (!page) throw new UnreadableList();
          nextRef.current = page.next && page.next !== cursor ? page.next : null;
          setState((prev) => ({
            phase: !append && page.rows.length === 0 && page.unreadable === 0 ? "empty" : "ready",
            rows: append ? [...prev.rows, ...page.rows] : page.rows,
            unreadable: append ? prev.unreadable + page.unreadable : page.unreadable,
            next: nextRef.current,
            failure: null,
            pageFailure: append ? prev.pageFailure : null,
            loadingMore: false,
            forced: false,
          }));
        } catch (err) {
          if (ticket !== seq.current) return;
          const failure = copyOf(err);
          if (append) {
            setState((prev) => ({ ...prev, pageFailure: failure, loadingMore: false }));
            return;
          }
          // Denied and error both clear the rows: nothing may sit above the panel.
          nextRef.current = null;
          setState({
            ...INITIAL,
            phase: isDenied(failureInfo(err).status) ? "denied" : "error",
            failure,
          });
        }
      })();
    },
    [status],
  );

  useEffect(() => {
    if (forced === "loading" || forced === "empty" || forced === "denied" || forced === "error") {
      ++seq.current; // an in-flight answer must not overwrite the repro
      if (forced === "loading") {
        setState({ ...INITIAL, forced: true });
        return;
      }
      if (forced === "empty") {
        setState({ ...INITIAL, phase: "empty", forced: true });
        return;
      }
      setState({ ...INITIAL, phase: forced, failure: forcedCopy(forced, forced), forced: true });
      return;
    }
    run(null, false);
  }, [forced, run]);

  const reload = useCallback(
    () => {
      setState((prev) => ({ ...prev, phase: "loading", rows: [], forced: false }));
      run(null, false);
    },
    [run],
  );

  const loadMore = useCallback(() => {
    const cursor = nextRef.current;
    if (!cursor) return;
    setState((prev) => ({ ...prev, loadingMore: true }));
    run(cursor, true);
  }, [run]);

  return { ...state, reload, loadMore };
}

export type DetailPhase = "idle" | "loading" | "ready" | "error" | "denied";

export interface DetailApi {
  phase: DetailPhase;
  detail: ApprovalDetail | null;
  failure: FailureCopy | null;
  forced: boolean;
  reload: () => void;
}

/** One ticket for the drawer. A new id resets the body before the answer arrives. */
export function useApprovalDetail(id: string | null, forced: ForcedState): DetailApi {
  const [phase, setPhase] = useState<DetailPhase>(id ? "loading" : "idle");
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [failure, setFailure] = useState<FailureCopy | null>(null);
  const [isForced, setIsForced] = useState(false);
  const seq = useRef(0);

  const load = useCallback(() => {
    if (!id) return;
    const ticket = ++seq.current;
    void (async () => {
      setPhase("loading");
      setDetail(null);
      setFailure(null);
      try {
        const next = await fetchDetail(id);
        if (ticket !== seq.current) return;
        if (!next) {
          setFailure(shapeFailure());
          setPhase("error");
          return;
        }
        setDetail(next);
        setPhase("ready");
      } catch (err) {
        if (ticket !== seq.current) return;
        setFailure(copyOf(err));
        setPhase(isDenied(failureInfo(err).status) ? "denied" : "error");
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!id) {
      ++seq.current;
      setPhase("idle");
      setDetail(null);
      setFailure(null);
      setIsForced(false);
      return;
    }
    if (forced === "loading" || forced === "empty") {
      ++seq.current;
      setPhase("loading");
      setDetail(null);
      setFailure(null);
      setIsForced(true);
      return;
    }
    if (forced === "denied" || forced === "error") {
      ++seq.current;
      setPhase(forced);
      setDetail(null);
      setFailure(forcedCopy(forced, forced));
      setIsForced(true);
      return;
    }
    setIsForced(false);
    load();
  }, [id, forced, load]);

  return { phase, detail, failure, forced: isForced, reload: load };
}
