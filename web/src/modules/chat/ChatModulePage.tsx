import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Spinner } from "@nous-research/ui/ui/components/spinner";

import { fetchJSON, setManagementProfile } from "@/lib/api";
import { ptyAttachToken } from "@/lib/pty-attach-token";
import { ProfileContext } from "@/contexts/profile-context";
import { useProfileScope } from "@/contexts/useProfileScope";
import {
  EmptyBlock,
  ErrorStateBlock,
  errStatus,
  humanize,
  isRecord,
  requestIdOf,
  type BlockState,
  type Rec,
} from "@/pages/EmployeesPage";

/**
 * Chat module page — the employee-scoped 「对话」 surface (PRD v4.1 §9.2-B,
 * CHAT-01..04/10/11).
 *
 * A deliberately THIN mount. The single chat host in this app is the upstream
 * `web/src/pages/ChatPage.tsx` — session list, xterm terminal, PTY/WebSocket
 * auth, mobile drawer, Router/PageHeader/i18n/theme plumbing all live there.
 * This module renders no second chat UI, no hand-drawn bubbles, and no own
 * useChat. It only:
 *
 *  1. resolves the bound employee id (prop → route param → `?employee=`),
 *  2. scopes the dashboard to it: `setManagementProfile(employeeId)` mirrored
 *     during render, the same contract the root switcher uses
 *     (ProfileProvider.tsx:69-71), plus a ProfileContext re-provider carrying
 *     `profile: employeeId` — so ChatPage's own `useProfileScope()`
 *     (ChatPage.tsx:334) spawns the PTY under that profile
 *     (ChatPage.tsx:1210 `if (scopedProfile) params.profile = scopedProfile`),
 *  3. gates the four page states around the host: the host mounts ONLY after
 *     the employee's BFF detail resolved (loading / empty / error / denied).
 *
 * Teardown contract (CHAT-04): the host subtree is keyed by employee id, so
 * switching employees unmounts the old ChatPage first — its PTY-effect
 * cleanup closes the WebSocket (ChatPage.tsx:1584 `wsRef.current?.close()`)
 * — and the per-tab attach token is rotated (`ptyAttachToken(true)`) BEFORE
 * the new host arms, so the new mount cannot reattach the previous
 * employee's keep-alive PTY (ChatPage.tsx:1206 reads this module's token).
 *
 * Copy rules (§9.2): this page renders no numeric fields, so missing values
 * never appear as `?? 0` here — any field added later must go through the
 * EmployeesPage dash helpers, and any timestamp through `beijing()` (to the
 * minute). No bare `emp_…` ids, `human:1` markers, HTTP codes or raw field
 * names are ever printed: the numeric status lives only in the `title`
 * attribute inside ErrorStateBlock, and the request id comes from the error
 * envelope via `requestIdOf()`.
 */

// Lazy on purpose: an unbound or denied visit must not even download the
// xterm/ChatPage chunk. `/api/pty` only exists once this host is mounted,
// because ChatPage's connect effect is gated on mount (ChatPage.tsx:150-160).
const ChatHost = lazy(() => import("@/pages/ChatPage"));

export interface ChatModulePageProps {
  /**
   * The employee this chat is bound to. Falls back to the route param
   * (`:employeeId` / `:id`), then to `?employee=` / `?employee_id=` for
   * deep links. Empty/absent means unbound → empty panel, no host.
   */
  employeeId?: string | null;
  /** Passed through to ChatPage's isActive gate (default true). */
  isActive?: boolean;
}

/** prop → route param → query param, first non-blank wins. */
function resolveEmployeeId(
  prop: string | null | undefined,
  routeParam: string | undefined,
  routeLegacy: string | undefined,
  search: URLSearchParams,
): string {
  const query = search.get("employee") ?? search.get("employee_id") ?? "";
  return (prop ?? "").trim() || (routeParam ?? "").trim() || (routeLegacy ?? "").trim() || query.trim();
}

// ── employee guard（宿主挂载前的四态门） ──────────────────────────────────

type GuardState = BlockState<Rec>;

function failed(err: unknown): GuardState {
  return {
    k: "error",
    status: errStatus(err),
    message: humanize(err),
    requestId: requestIdOf(err),
  };
}

/**
 * Does this employee exist and may this user see it? Same endpoint ladder
 * and envelope unwrap as EmployeeDetailPage.tsx:78-91 — the BFF may serve
 * the record from either route, and neither answer is fabricated.
 *
 * Also owns host arming (CHAT-04): a resolved fetch rotates this tab's
 * attach token and only then arms the host FOR THE ID THIS RUN FETCHED
 * (`armedFor === employeeId` at render). Rotation lives in the promise
 * closure, not a state-watching effect, so a mid-flight employee switch can
 * never arm the new id off the old id's "ready" state (the fetch cleanup
 * drops `alive`, the late arm dies with it).
 */
function useEmployeeGuard(employeeId: string): {
  state: GuardState;
  armedFor: string | null;
  reload: () => void;
} {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<GuardState>({ k: "loading" });
  const [armedFor, setArmedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) return;
    let alive = true;
    setState({ k: "loading" });
    setArmedFor(null);
    const id = encodeURIComponent(employeeId);
    const primary = `/agent-api/api/employees/${id}`;
    const fallback = `/agent-api/api/matrix/${id}`;
    const unwrap = (raw: unknown): Rec => {
      if (isRecord(raw) && isRecord(raw.employee)) return raw.employee as Rec;
      if (isRecord(raw) && isRecord(raw.data)) return raw.data as Rec;
      return isRecord(raw) ? raw : {};
    };
    // ptyAttachToken(true) writes a fresh token (pty-attach-token.ts:60-76)
    // before the host can mount, so ChatPage's ptyAttachToken(false) read
    // (ChatPage.tsx:1206) gets the NEW one and the previous employee's
    // keep-alive PTY is not reattached — the registry reaps it.
    const arm = () =>
      ptyAttachToken(true).then(() => {
        if (alive) setArmedFor(employeeId);
      });
    fetchJSON<unknown>(primary)
      .then((raw) => {
        if (!alive) return;
        setState({ k: "ready", data: unwrap(raw) });
        return arm();
      })
      .catch((err1: unknown) =>
        fetchJSON<unknown>(fallback)
          .then((raw) => {
            if (!alive) return;
            setState({ k: "ready", data: unwrap(raw) });
            return arm();
          })
          .catch((err2: unknown) => {
            if (alive)
              setState(failed(err1 instanceof Error && errStatus(err1) ? err1 : err2));
          }),
      );
    return () => {
      alive = false;
    };
  }, [employeeId, nonce]);

  return { state, armedFor, reload: () => setNonce((n) => n + 1) };
}

// ── scoped profile（对话主机只认这个上下文，不新造第二套） ────────────────

/**
 * Re-provides the dashboard's profile scope pinned to one employee. The
 * profile value IS the employee id (the console's contract: 员工即档案).
 * `setProfile` is passed through untouched — re-targeting belongs to the
 * sidebar switcher above, not to a scoped view.
 */
function ScopedToEmployee({ employeeId, children }: { employeeId: string; children: ReactNode }) {
  const outer = useProfileScope();
  const value = useMemo(
    () => ({
      profile: employeeId,
      currentProfile: outer.currentProfile,
      profiles: outer.profiles,
      setProfile: outer.setProfile,
    }),
    [employeeId, outer],
  );
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

function BusyHost() {
  return (
    <div
      className="flex min-h-[12rem] flex-1 items-center justify-center"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        <span>正在打开对话…</span>
      </div>
    </div>
  );
}

// ── 页面 ─────────────────────────────────────────────────────────────────

export default function ChatModulePage({
  employeeId: employeeIdProp,
  isActive = true,
}: ChatModulePageProps = {}) {
  const { employeeId: routeParam, id: routeLegacy } = useParams();
  const [searchParams] = useSearchParams();
  const outer = useProfileScope();
  const employeeId = resolveEmployeeId(employeeIdProp, routeParam, routeLegacy, searchParams);

  // Render-phase mirror of the write target, the ProfileProvider contract
  // (ProfileProvider.tsx:69-71): child effects in the same commit must see
  // the scope or they would fire against the dashboard's own profile.
  if (employeeId) setManagementProfile(employeeId);

  // Leaving the module hands the scope back to the global selection. The
  // root provider only re-asserts on its own renders, so restore here too.
  // (Ref synced in an effect, the ChatPage.tsx:134-136 pattern — never
  // mutated during render.)
  const outerProfileRef = useRef(outer.profile);
  useEffect(() => {
    outerProfileRef.current = outer.profile;
  }, [outer.profile]);
  useEffect(() => () => setManagementProfile(outerProfileRef.current), []);

  const forced = searchParams.get("state");
  const forceRid = searchParams.get("rid");
  const { state, armedFor, reload } = useEmployeeGuard(forced ? "" : employeeId);

  // CHAT-04: ready only for the id this fetch cycle resolved, and only after
  // the attach token rotated; every other commit shows busy/error/empty. The
  // host subtree is keyed by id, so an id switch unmounts the old ChatPage —
  // closing its WebSocket (ChatPage.tsx:1546-1584 cleanup) — before a new
  // host can arm for the incoming employee.
  const showHost = forced === null && employeeId !== "" && state.k === "ready" && armedFor === employeeId;
  const showBusy = forced === null && employeeId !== "" && !showHost && state.k !== "error";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {forced !== null ? (
        <div data-testid={`chat-forced-${forced}`}>
          {forced === "loading" ? <BusyHost /> : null}
          {forced === "empty" ? (
            <>
              <EmptyBlock
                text="还没有可打开的对话"
                hint="先绑定一位数字员工，再从员工详情进入对话；绑定之前不会建立任何终端连接。"
              />
              <div className="flex justify-center">
                <Link className="text-sm underline decoration-dotted underline-offset-2" to="/employees">
                  去选择数字员工
                </Link>
              </div>
            </>
          ) : null}
          {forced === "error" ? (
            <ErrorStateBlock
              status={502}
              message="对话暂时不可用。"
              requestId={forceRid}
              deniedTitle="无法打开对话"
              errorTitle="对话暂时不可用"
              onRetry={reload}
            />
          ) : null}
          {forced === "denied" ? (
            <ErrorStateBlock
              status={403}
              message="forbidden"
              requestId={forceRid}
              deniedTitle="无法打开对话"
              errorTitle="对话暂时不可用"
              onRetry={reload}
            />
          ) : null}
        </div>
      ) : null}

      {/* Empty (CHAT-02): no bound employee → neutral panel, and NO host
          mounted at all, so zero /api/pty requests can leave this page. */}
      {forced === null && employeeId === "" && (
        <>
          <EmptyBlock
            text="尚未绑定数字员工"
            hint="从「数字员工」列表打开一位员工，再切到它的「对话」Tab；绑定之前不会建立任何终端连接。"
          />
          <div className="flex justify-center">
            <Link className="text-sm underline decoration-dotted underline-offset-2" to="/employees">
              去选择数字员工
            </Link>
          </div>
        </>
      )}

      {showBusy && <BusyHost />}

      {/* Error / denied (CHAT-03): human words + request id + retry;
          403/404 collapse into the honest 「无权限或未开放」 wording. */}
      {forced === null && employeeId !== "" && state.k === "error" && (
        <ErrorStateBlock
          status={state.status}
          message={state.message}
          requestId={state.requestId}
          deniedTitle="无法打开对话"
          errorTitle="对话暂时不可用"
          onRetry={reload}
        />
      )}

      {/* Ready (CHAT-01): the upstream page IS the chat. Keyed by employee
          id so a switch tears the old WS down before the new host arms. */}
      {showHost && (
        <div
          data-chat-host
          data-profile={employeeId}
          data-scope="employee"
          className="flex min-h-0 flex-1 flex-col"
        >
          <ScopedToEmployee key={employeeId} employeeId={employeeId}>
            <Suspense fallback={<BusyHost />}>
              <ChatHost isActive={isActive} />
            </Suspense>
          </ScopedToEmployee>
        </div>
      )}
    </div>
  );
}
