/**
 * audit data hooks — the four states, driven by what the BFF actually did.
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
 *
 * The verify hook adds one more outcome: a check that could not run is
 * `unavailable`, and the panel for it says 「本环境未启用」. A 403 and a 404
 * reach that same panel with the same body.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  PAGE_LIMIT,
  failureInfo,
  fetchDetail,
  fetchList,
  fetchVerify,
  isDenied,
  isVerifyUnavailable,
  listUrl,
  type ListFilters,
} from "./api";
import { detailShapeFailure, readFailure, shapeFailure, verifyFailure, type FailureCopy, type VerifyFailure } from "./copy";
import type { AuditDetail, AuditRow, VerifyResult } from "./model";

export type ForcedState = "loading" | "empty" | "error" | "denied" | null;
export type Phase = "loading" | "ready" | "empty" | "error" | "denied";

const FORCED: readonly string[] = ["loading", "empty", "error", "denied"];

export function forcedStateOf(raw: string | null): ForcedState {
  return raw !== null && FORCED.includes(raw) ? (raw as ForcedState) : null;
}

export interface ListApi {
  phase: Phase;
  rows: AuditRow[];
  /** Rows the answer carried but that could not be read — counted, never shown as data. */
  unreadable: number;
  next: string | null;
  /**
   * aud8: the denominator the answer itself stated, or `null` when it said no
   * total. `null` is rendered 总数不可用 with the reason — the loaded row count
   * is never printed in its place.
   */
  total: number | null;
  failure: FailureCopy | null;
  /** A later page failed while the loaded rows stay on screen. */
  pageFailure: FailureCopy | null;
  loadingMore: boolean;
  /** True when the state came from `?state=` rather than from the service. */
  forced: boolean;
  /** The filters the current rows were read with, echoed back so the screen can say what it asked. */
  filters: ListFilters;
  /** audH: the size this page is asking with (the address's, or the default). */
  askedLimit: number;
  /**
   * audG: the path THIS page actually sent for the rows on screen, from the
   * data layer's own builder — relative, no origin, nothing invented. A shared
   * summary quotes the real question instead of a description of it.
   */
  askedPath: string | null;
  /**
   * audH: the size the answer says it served, when it says one — the number
   * the selector echoes after a clamp. `null` = the answer said nothing, and
   * the screen reports the rows it got instead of claiming an effective size.
   */
  servedLimit: number | null;
  reload: () => void;
  loadMore: () => void;
}

interface ListState {
  phase: Phase;
  rows: AuditRow[];
  unreadable: number;
  next: string | null;
  total: number | null;
  failure: FailureCopy | null;
  pageFailure: FailureCopy | null;
  loadingMore: boolean;
  forced: boolean;
  /** audG: the path the rows on screen were asked with (state, not a ref). */
  askedPath: string | null;
  /** audH: the size the answer itself said it served, when it said one. */
  servedLimit: number | null;
}

const INITIAL: ListState = {
  phase: "loading",
  rows: [],
  unreadable: 0,
  next: null,
  total: null,
  failure: null,
  pageFailure: null,
  loadingMore: false,
  forced: false,
  askedPath: null,
  servedLimit: null,
};

function listCopy(err: unknown): FailureCopy {
  return readFailure(err, failureInfo(err));
}

function forcedCopy(kind: "error" | "denied", forced: ForcedState): FailureCopy {
  return {
    sentence:
      kind === "denied"
        ? "这块内容要么尚未对你开放，要么当前环境还没有提供它。"
        : "（复现）审计服务在处理时出了错，请稍后重试。",
    requestId: null,
    technical: `?state=${forced}`,
  };
}

/**
 * One page of the ledger, re-read whenever the filter set changes. `null`
 * answer = the payload is not a list: a failure. A filter change clears the
 * previous rows before asking again, so a narrowed screen never shows rows
 * that were read under the wider question.
 *
 * `asked` is part of `run`'s identity, so the caller must pass a stable object
 * (the page memoises it): a re-render with the same filters asks nothing new.
 */
export function useAuditList(
  forced: ForcedState,
  asked: ListFilters,
  enabled: boolean = true,
  startCursor: string | null = null,
  /** audH: the size this page asks with, from `?limit=`. */
  limit: number = PAGE_LIMIT,
): ListApi {
  const [state, setState] = useState<ListState>(INITIAL);
  const seq = useRef(0);
  const nextRef = useRef<string | null>(null);

  const run = useCallback(
    (cursor: string | null, append: boolean): void => {
      const ticket = ++seq.current;
      // audG: the path recorded is the one `fetchList` is about to build from
      // the same inputs, so a shared summary quotes the real question.
      const askedPath = listUrl(cursor, asked, limit);
      void (async () => {
        try {
          const page = await fetchList(cursor, asked, limit);
          if (ticket !== seq.current) return;
          if (!page) throw new Error("audit: answer is not a list");
          nextRef.current = page.next && page.next !== cursor ? page.next : null;
          setState((prev) => ({
            phase: !append && page.rows.length === 0 && page.unreadable === 0 ? "empty" : "ready",
            rows: append ? [...prev.rows, ...page.rows] : page.rows,
            unreadable: append ? prev.unreadable + page.unreadable : page.unreadable,
            next: nextRef.current,
            // aud8: a stated total is kept across pages (same window, same
            // denominator); a page that states none never overwrites a value
            // that was stated, and never invents one from the row count.
            total: append ? (prev.total ?? page.total) : page.total,
            failure: null,
            pageFailure: append ? prev.pageFailure : null,
            loadingMore: false,
            forced: false,
            askedPath,
            // audH: a later page states its own size; keep the first stated one
            // only while nothing was said, so a silent answer never overwrites.
            servedLimit: page.pageSize ?? (append ? prev.servedLimit : null),
          }));
        } catch (err) {
          if (ticket !== seq.current) return;
          const failure = listCopy(err);
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
            askedPath,
          });
        }
      })();
    },
    [asked, limit],
  );

  useEffect(() => {
    // R34: an incomplete custom window is not a question the service can
    // answer, so nothing is asked. The screen says what is missing instead of
    // falling back to an unbounded scan (which the route 400s).
    if (!enabled) {
      ++seq.current;
      return;
    }
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
    // A new filter set is a new question: drop the old rows before asking.
    setState((prev) => (prev.rows.length === 0 && prev.phase === "loading" && !prev.forced ? prev : { ...INITIAL }));
    run(startCursor, false);
  }, [forced, run, enabled, startCursor]);

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, phase: "loading", rows: [], forced: false }));
    run(startCursor, false);
  }, [run, startCursor]);

  const loadMore = useCallback(() => {
    const cursor = nextRef.current;
    if (!cursor) return;
    setState((prev) => ({ ...prev, loadingMore: true }));
    run(cursor, true);
  }, [run]);

  return { ...state, filters: asked, askedLimit: limit, reload, loadMore };
}

export type DetailPhase = "idle" | "loading" | "ready" | "error" | "denied";

export interface DetailApi {
  phase: DetailPhase;
  detail: AuditDetail | null;
  failure: FailureCopy | null;
  forced: boolean;
  reload: () => void;
}

/** One event for the drawer. A new id resets the body before the answer arrives. */
export function useAuditDetail(id: string | null, forced: ForcedState): DetailApi {
  const [phase, setPhase] = useState<DetailPhase>(id ? "loading" : "idle");
  const [detail, setDetail] = useState<AuditDetail | null>(null);
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
          setFailure(detailShapeFailure());
          setPhase("error");
          return;
        }
        setDetail(next);
        setPhase("ready");
      } catch (err) {
        if (ticket !== seq.current) return;
        setFailure(readFailure(err, failureInfo(err)));
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

/**
 * `unavailable` is the verify pane's denied leg: 403 and 404 reach it with the
 * SAME body (one panel, one sentence), and so do 405/501 (capability closed)
 * and an unreachable service. `idle` is the honest empty: nobody has asked for
 * a window yet, so there is nothing to report.
 */
export type VerifyPhase = "idle" | "loading" | "ready" | "error" | "unavailable";

export interface VerifyApi {
  phase: VerifyPhase;
  result: VerifyResult | null;
  failure: VerifyFailure | FailureCopy | null;
  /** The window the last run asked for, as ISO instants (never on screen). */
  asked: { from: string | null; to: string | null };
  forced: boolean;
  run: (from: string | null, to: string | null) => void;
}

/**
 * The window check only runs when a person asks for it: there is no implicit
 * verify on page load, because a chain check is work the service has to do.
 */
export function useAuditVerify(forced: ForcedState): VerifyApi {
  const [phase, setPhase] = useState<VerifyPhase>("idle");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [failure, setFailure] = useState<VerifyFailure | FailureCopy | null>(null);
  const [asked, setAsked] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });
  const [isForced, setIsForced] = useState(false);
  const seq = useRef(0);
  const lastRef = useRef<{ from: string | null; to: string | null }>({ from: null, to: null });

  const runWindow = useCallback((from: string | null, to: string | null): void => {
    lastRef.current = { from, to };
    setAsked({ from, to });
    const ticket = ++seq.current;
    setPhase("loading");
    setResult(null);
    setFailure(null);
    setIsForced(false);
    void (async () => {
      try {
        const next = await fetchVerify(from, to);
        if (ticket !== seq.current) return;
        if (!next) {
          setFailure(shapeFailure());
          setPhase("error");
          return;
        }
        setResult(next);
        setPhase("ready");
      } catch (err) {
        if (ticket !== seq.current) return;
        const info = failureInfo(err);
        const copy = verifyFailure(err, info);
        setFailure(copy);
        // 403 and 404 are both "not reachable here": one body for both, and it
        // reads 本环境未启用, never a green chain.
        setPhase(isVerifyUnavailable(info.status) ? "unavailable" : "error");
      }
    })();
  }, []);

  useEffect(() => {
    if (forced === null) {
      // The repro switched off: no live answer exists for a check nobody ran,
      // so the pane goes back to 还没有运行 rather than keeping a fake state.
      if (isForced) {
        ++seq.current;
        setIsForced(false);
        setPhase("idle");
        setResult(null);
        setFailure(null);
      }
      return;
    }
    ++seq.current; // an in-flight answer must not overwrite the repro
    setIsForced(true);
    setResult(null);
    if (forced === "loading") {
      setPhase("loading");
      setFailure(null);
      return;
    }
    if (forced === "empty") {
      // The verify pane's empty is「还没有运行」: no request has been asked for.
      setPhase("idle");
      setFailure(null);
      return;
    }
    if (forced === "denied") {
      setFailure({ ...forcedCopy("denied", forced), unavailable: true });
      setPhase("unavailable");
      return;
    }
    setFailure({ ...forcedCopy("error", forced), unavailable: false });
    setPhase("error");
  }, [forced, isForced]);

  return { phase, result, failure, asked, forced: isForced, run: runWindow };
}
