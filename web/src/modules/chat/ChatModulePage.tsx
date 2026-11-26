import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Spinner } from "@nous-research/ui/ui/components/spinner";

import { fetchJSON, setManagementProfile } from "@/lib/api";
import { ptyAttachToken } from "@/lib/pty-attach-token";
import { ProfileContext } from "@/contexts/profile-context";
import { useProfileScope } from "@/contexts/useProfileScope";
import "./chat-module.css";
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
 *  2. scopes the dashboard to it: resolves the employee id into a legal, real
 *     Hermes profile (`resolveChatProfile` — ids are frequently uppercase and
 *     therefore illegal), mirrors that into `setManagementProfile` during
 *     render (the same contract the root switcher uses,
 *     ProfileProvider.tsx:69-71), and re-provides ProfileContext with
 *     `profile: <resolved>` — so ChatPage's own `useProfileScope()`
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

// ── scoped profile 解析（右栏 WS 改不了帧，只能在派发前把 profile 修正）─────
//
// Hermes 的 profile 目录名有硬性形制：[a-z0-9][a-z0-9_-]{0,63}（后端列目录用的
// 就是这个正则，见 hermes_state_sessions.py 的 is_profile_dir 判定）。员工的
// 内部编号常带大写十六进制（emp_86A8…），原样塞进 profile 位就非法。左侧终端
// 之所以还能连，是代理侧 _sanitize_profile_query 把非法名当「未指定」转发了；
// 但右侧 ChatSidebar 的 session.create 走 WebSocket JSON-RPC 直连网关，代理改
// 不动帧体，于是网关回一句 `Profile '<大写id>' does not exist.` 把右栏打红。
//
// 所以派发前必须把工号规整成一个「合法且磁盘上真实存在」的 profile：候选取
// 原样 / 小写化 / 非法字符替换三种形制，只保留出现在 /api/profiles 列表里
// （即 outer.profiles，后端据磁盘目录而来）的那一个。一个都匹配不上就返回空串
// ——ChatPage 与 ChatSidebar 都只在 profile 为真值时才写进 session.create
// （ChatPage.tsx:1210 / sidecarSessionCreateParams），空串 = 不带 profile =
// 网关回落默认 profile，右栏照常可用且不报红。绝不臆造磁盘上没有的名字。
const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** 工号 → 合法 profile 候选（原样 / 小写化 / 非法字符替换），去重、只留合法形制。 */
function profileCandidates(employeeId: string): string[] {
  const raw = employeeId.trim();
  if (!raw) return [];
  const lowered = raw.toLowerCase();
  const slashed = lowered
    .replace(/[^a-z0-9_-]/g, "_") // 点、空格、冒号等非法字符 → 下划线
    .replace(/^[^a-z0-9]+/, "") // 首字符必须是字母/数字
    .slice(0, 64); // 总长 ≤ 64
  const out: string[] = [];
  for (const c of [raw, lowered, slashed]) {
    if (c && PROFILE_NAME_RE.test(c) && !out.includes(c)) out.push(c);
  }
  return out;
}

/**
 * 把员工工号解析成一个合法且真实存在的 profile 名；匹配不到返回 ""，
 * 表示「不带 profile」，由网关回落到默认 profile（缺失是事实，不是错误）。
 */
function resolveChatProfile(employeeId: string, knownProfiles: readonly string[]): string {
  if (!employeeId) return "";
  for (const c of profileCandidates(employeeId)) {
    if (knownProfiles.includes(c)) return c;
  }
  return "";
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
 * Re-provides the dashboard's profile scope pinned to the employee's resolved
 * Hermes profile (NOT its raw id — ids are frequently uppercase and therefore
 * illegal profile names; see resolveChatProfile above). The empty string means
 * "no dedicated profile on this host" and lets ChatPage/ChatSidebar omit
 * profile from session.create, so the gateway falls back to its default
 * profile instead of erroring. `setProfile` is passed through untouched —
 * re-targeting belongs to the sidebar switcher above, not to a scoped view.
 */
function ScopedToEmployee({
  profile,
  children,
}: {
  profile: string;
  children: ReactNode;
}) {
  const outer = useProfileScope();
  const value = useMemo(
    () => ({
      profile,
      currentProfile: outer.currentProfile,
      profiles: outer.profiles,
      setProfile: outer.setProfile,
    }),
    [profile, outer],
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

  // The employee's raw id is NOT a legal Hermes profile name (uppercase hex).
  // Resolve it to a real, valid profile before anything downstream reads the
  // scope — the right column's session.create goes over WS where the proxy
  // cannot rewrite the frame. "" = no dedicated profile on this host → the
  // gateway falls back to its default profile (honest, not an error).
  const chatProfile = employeeId ? resolveChatProfile(employeeId, outer.profiles) : "";

  // Render-phase mirror of the write target, the ProfileProvider contract
  // (ProfileProvider.tsx:69-71): child effects in the same commit must see
  // the scope or they would fire against the dashboard's own profile.
  if (employeeId) setManagementProfile(chatProfile);

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
        <>
          {/* 兜底说明：该员工在本机没有对应的合法 profile（工号非法或磁盘无此
              目录），右栏不带 profile 连默认 profile——这是配置事实，不是错误，
              故用一行中性小字说明，不报红、不夸大成「已就绪」。 */}
          {chatProfile === "" ? (
            <div className="chat-profile-fallback" role="note">
              该员工未配置独立 Hermes profile，当前使用默认 profile。
            </div>
          ) : null}
          <div
            data-chat-host
            data-profile={chatProfile}
            data-profile-fallback={chatProfile === "" ? "true" : undefined}
            data-scope="employee"
            className="chat-module-shell flex min-h-0 flex-1 flex-col"
          >
            <ScopedToEmployee key={employeeId} profile={chatProfile}>
              <Suspense fallback={<BusyHost />}>
                <ChatHost isActive={isActive} />
              </Suspense>
            </ScopedToEmployee>
          </div>
        </>
      )}
    </div>
  );
}
