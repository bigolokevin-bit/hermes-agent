/**
 * Console shell fixture mechanism — Wave-0 T03 (shell-alignment lane).
 *
 * Lets ANY pane reproduce the four PRD states (加载中/空态/错误/就绪) from
 * the URL alone, with a visible badge, and ZERO per-pane wiring required at
 * the shell level. Integration is three lines (see
 * docs/_artifacts/A/T03-CONTRACT.md): wrap the console layout in
 * <FixtureProvider>, mirror the override on the root element with
 * applyFixtureAttribute(), mount <FixtureBadge /> once. Panes MAY opt in to
 * state swapping with ONE fixtureView(...) call; everything else keeps
 * working through the data-fixture attribute (CSS/e2e hooks).
 *
 * URL forms (both must work):
 *   1. window.search  — '/web/?state=empty#/duty'  → the part BEFORE the
 *      hash, i.e. window.location.search (full-URL entry, hard refresh).
 *   2. hash-search    — '#/duty?state=empty'       → the query INSIDE the
 *      hash, i.e. window.location.hash after '?' (SPA-nav form; parseHash
 *      in ./routes.ts keeps unknown keys like `state` in ParsedLocation
 *      .params, so this file deliberately parses the RAW hash string itself
 *      rather than depend on routes.ts).
 *
 * Precedence: the hash-internal query WINS over window.search. Rationale:
 * window.search survives every SPA navigation untouched, so it acts as the
 * global fixture switch; the in-hash query is per-view and more specific.
 *
 * Invalid value → null (app behaves as 'ready' via resolveFixtureState) and
 * ONE console.warn per distinct bad value (module-level dedup set, never a
 * per-render spam). Missing → null, silent.
 *
 * Live updates: FixtureProvider re-reads on popstate + hashchange (back/
 * forward, manual hash edits, hash-based SPA nav). react-router pushState
 * navigations fire neither event — panes that also remount per route read
 * correct values anyway, and currentFixtureState() is always live.
 *
 * Constraints honoured: no imports from App/pages, react primitives only
 * (createElement, no JSX → stays .ts, per registry.ts 'no JSX in .ts'
 * precedent), everything tree-shakeable.
 */

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/* ------------------------------------------------------------------ *
 * Pure layer — parse / resolve / attribute / view selection
 * ------------------------------------------------------------------ */

export type FixtureState = 'loading' | 'empty' | 'error' | 'ready';

/** The four states in canonical order (e2e + docs reference this list). */
export const FIXTURE_STATES: readonly FixtureState[] = ['loading', 'empty', 'error', 'ready'];

/** URL query key carrying the fixture override. */
export const FIXTURE_QUERY_KEY = 'state';

/** PRD Section 4 state labels (skeleton tabnames) — badge text. */
export const FIXTURE_LABELS: Readonly<Record<FixtureState, string>> = {
  loading: '加载中',
  empty: '空态',
  error: '错误',
  ready: '就绪',
};

/** Warned-bad-value dedup: one console.warn per DISTINCT invalid value,
 * no spam across renders. resetFixtureWarnOnce() clears it (tests only). */
const warnedBadValues = new Set<string>();

export function resetFixtureWarnOnce(): void {
  warnedBadValues.clear();
}

function isFixtureState(value: string): value is FixtureState {
  return (FIXTURE_STATES as readonly string[]).includes(value);
}

/**
 * Extract the raw `state=` value from a URL piece. Tolerant input shapes:
 * '?state=empty' · 'state=empty' · '/web/?state=empty#/duty' ·
 * '#/duty?tab=x&state=empty' · '' → null. Empty value ('?state=') counts
 * as missing (null, no warn). The query region is everything after the
 * first '?' up to the next '#' (so a trailing '#/…' or a leading '#/'
 * hash prefix is handled symmetrically).
 */
function readStateParam(piece: string): string | null {
  const raw = piece.trim();
  if (raw === '') return null;
  const queryAt = raw.indexOf('?');
  let query = queryAt === -1 ? raw : raw.slice(queryAt + 1);
  const tailHash = query.indexOf('#');
  if (tailHash !== -1) query = query.slice(0, tailHash);
  let value: string | null;
  try {
    value = new URLSearchParams(query).get(FIXTURE_QUERY_KEY);
  } catch {
    return null;
  }
  return value === null || value === '' ? null : value;
}

/**
 * Parse the fixture override from a location's search + hash strings.
 * Accepts the two forms above; hash-internal query wins. Returns the valid
 * FixtureState, or null when absent/invalid (invalid also warns once per
 * distinct bad value).
 */
export function parseFixtureState(search: string, hash: string): FixtureState | null {
  const candidate = readStateParam(hash) ?? readStateParam(search);
  if (candidate === null) return null;
  if (isFixtureState(candidate)) return candidate;
  if (!warnedBadValues.has(candidate)) {
    warnedBadValues.add(candidate);
    console.warn(
      `[shell/fixtures] ignoring ?${FIXTURE_QUERY_KEY}='${candidate}' — expected one of ${FIXTURE_STATES.join('|')}`,
    );
  }
  return null;
}

/** Live read of window.location (search + hash). SSR-safe: null off-DOM. */
export function currentFixtureState(): FixtureState | null {
  if (typeof window === 'undefined') return null;
  return parseFixtureState(window.location.search, window.location.hash);
}

/** Consumers' default: an absent override means the real, ready view. */
export function resolveFixtureState(override: FixtureState | null): FixtureState {
  return override ?? 'ready';
}

/**
 * Host-attribute hook: the shell calls this on <html> (or the console
 * layout root) so CSS/e2e can key off [data-fixture] without any pane
 * code. null REMOVES the attribute (ready is the attribute-free default —
 * pass resolveFixtureState(null) if you want it explicit).
 */
export function applyFixtureAttribute(el: HTMLElement, s: FixtureState | null): void {
  if (s === null) el.removeAttribute('data-fixture');
  else el.setAttribute('data-fixture', s);
}

/** One-liner opt-in for panes: exactly ONE branch is evaluated per call. */
export type FixtureViews<T> = Record<FixtureState, () => T>;

export function fixtureView<T>(s: FixtureState, views: FixtureViews<T>): T {
  return views[s]();
}

/* ------------------------------------------------------------------ *
 * React layer — provider, hooks, badge
 * ------------------------------------------------------------------ */

/** Context value = raw override (null = no fixture in the URL). */
const FixtureContext = createContext<FixtureState | null>(null);

export interface FixtureProviderProps {
  children: ReactNode;
}

/**
 * Supplies the URL-driven fixture override and keeps it live on popstate +
 * hashchange. Mount ONCE around the console layout (inside BrowserRouter,
 * above <Routes> — see T03-CONTRACT.md).
 */
export function FixtureProvider({ children }: FixtureProviderProps): ReactNode {
  const [override, setOverride] = useState<FixtureState | null>(() => currentFixtureState());

  useEffect(() => {
    const sync = (): void => setOverride(currentFixtureState());
    sync(); // cover hydration/deferred-mount cases where the first read was stale
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  return createElement(FixtureContext.Provider, { value: override }, children);
}

function useFixtureOverride(): FixtureState | null {
  return useContext(FixtureContext);
}

/** { state, override } — override for host-attribute/badge effects,
 * state (override ?? 'ready') for view rendering. */
export function useFixtureState(): { state: FixtureState; override: FixtureState | null } {
  const override = useFixtureOverride();
  const state = resolveFixtureState(override);
  return useMemo(() => ({ state, override }), [state, override]);
}

/** Resolved state shortcut for panes (never null). */
export function useFixtureStateValue(): FixtureState {
  return resolveFixtureState(useFixtureOverride());
}

/** tokens.css accents with literal fallbacks (never edit tokens.css). */
const FIXTURE_ACCENTS: Readonly<Record<FixtureState, string>> = {
  loading: 'var(--info, #7fb3c8)',
  empty: 'var(--fg-3, #9aa49e)',
  error: 'var(--bad, #fb2c36)',
  ready: 'var(--ok, #4ade80)',
};

/**
 * Fixed-corner badge, rendered ONLY when a URL override is active.
 * data-testid="shell-fixture-badge" + data-fixture attr for e2e. Inline
 * styles, tokens.css vars with fallbacks only — no stylesheet edits.
 * `state` prop (router-accurate value from ConsoleFixtureChrome) wins over
 * the context override: react-router pushState navigations fire neither
 * popstate nor hashchange, so inside the Router the caller is the fresher
 * source (T03-CONTRACT caveat; deviation registered in T03-CONTRACT.md).
 */
export function FixtureBadge({
  state = undefined,
}: {
  state?: FixtureState | null;
} = {}): ReactNode {
  const { override } = useFixtureState();
  const active = state === undefined ? override : state;
  if (active === null) return null;
  const rootStyle = {
    position: 'fixed' as const,
    right: '12px',
    bottom: '12px',
    zIndex: 9999,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    borderRadius: 'var(--r-sm, 4px)',
    background: 'var(--panel-2, #082424)',
    border: '1px solid var(--line-2, rgba(255,230,203,0.30))',
    color: 'var(--fg, #ffe6cb)',
    fontFamily: 'var(--mono, ui-monospace, Menlo, Consolas, monospace)',
    fontSize: '11px',
    lineHeight: '16px',
    pointerEvents: 'none' as const,
  };
  const tagStyle = { color: 'var(--fg-3, #9aa49e)', letterSpacing: '0.08em' };
  const labelStyle = { color: FIXTURE_ACCENTS[active], fontWeight: 600 };
  return createElement(
    'div',
    {
      'data-testid': 'shell-fixture-badge',
      'data-fixture': active,
      role: 'status',
      'aria-live': 'polite',
      style: rootStyle,
    },
    createElement('span', { style: tagStyle }, 'FIXTURE'),
    createElement('span', { style: labelStyle }, FIXTURE_LABELS[active]),
  );
}

/** Callback helper so wiring lanes can mirror the override without
 * writing the null-branch themselves: useFixtureMirror(documentElement). */
export function useFixtureMirror(el: HTMLElement | null): FixtureState | null {
  const { override } = useFixtureState();
  useEffect(() => {
    if (el !== null) applyFixtureAttribute(el, override);
  }, [el, override]);
  return override;
}

