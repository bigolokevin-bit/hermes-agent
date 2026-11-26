import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Spinner } from "@nous-research/ui/ui/components/spinner";

import { fetchJSON, setManagementProfile } from "@/lib/api";
import { ptyAttachToken } from "@/lib/pty-attach-token";
import { ProfileContext } from "@/contexts/profile-context";
import { useProfileScope } from "@/contexts/useProfileScope";
import { loadEmployeeSoul, SOUL_MARKER } from "./employeeSoul";
import {
  employeeProfileDescription,
  employeeProfileName,
  isConsoleProfile,
} from "./employeeProfile";
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

// ── per-employee Hermes profile（2026-11-26 用户拍板走 A：同进程多 profile） ──
//
// 每个数字员工在自己的 profile 下开会话：会话、工作区、历史都互不可见，
// 但仍在同一个 Hermes 进程里跑（不新造容器，不新造第二套对话宿主）。
//
// 名字规则：员工 id 常带大写十六进制，不是合法 profile 名，所以取尾段 8 位转小写，
// 前缀 emp-。同一员工每次都映射到同一个名字（幂等，不随刷新变化）。
//
// 创建策略：只有在**打开这位员工的对话时**才确保 profile 存在（不在名册页批量建档）。
// 首次创建用 clone_from_default 继承当前可用的模型/凭据，但**人格不继承**：
// 建档请求同时带上按该员工岗位职责合成的人设（soul=，见 employeeSoul.ts），
// 否则克隆来的 system_prompt 会让它自称上一位员工。
// 人设素材读不齐（缺姓名/岗位/岗位职责）时不建档，退回默认档并如实说明；
// 绝不拿别人的开场白顶上去。

export { employeeProfileName };
export {
  CONSOLE_PROFILE_MARK,
  employeeProfileDescription,
  isConsoleProfile,
} from "./employeeProfile";

type ProfileState =
  | { k: "idle"; name: "" }
  | { k: "resolving"; name: "" }
  | { k: "ready"; name: string; created: boolean }
  | { k: "failed"; name: ""; reason: string };

function useEmployeeProfile(employeeId: string, enabled = true): ProfileState {
  const [state, setState] = useState<ProfileState>({ k: "idle", name: "" });

  useEffect(() => {
    const name = employeeProfileName(employeeId);
    if (!enabled || !employeeId || !name) {
      setState({ k: "idle", name: "" });
      return;
    }
    let alive = true;
    setState({ k: "resolving", name: "" });
    (async () => {
      const listed = await fetchJSON<{
        profiles?: Array<{ name?: string; description?: string }>;
      }>("/api/profiles");
      const rec = (listed?.profiles ?? []).find((p) => p?.name === name);
      const exists = !!rec;
      // 判断「这一档是不是控制台建的」：建档时我们写了带「控制台自动创建」的描述。
      // 是 → 人格归控制台管（可校正）；不是且没有受管标记 → 是用户自己的档，不碰。
      const managedByConsole = isConsoleProfile(rec?.description);
      if (exists) {
        // 已存在也要核对人格：现有的档案可能是「克隆默认档」造的，system_prompt 里
        // 是上一位员工；也可能员工改了岗位职责。两种都由 SOUL.md 校正。
        // 但只改带受管标记的文件 —— 用户手写的人格不抢笔。
        const cur = await fetchJSON<{ content?: string; exists?: boolean }>(
          `/api/profiles/${encodeURIComponent(name)}/soul`,
        ).catch(() => null);
        const content = typeof cur?.content === "string" ? cur.content : "";
        if (content.trim() && !content.includes(SOUL_MARKER) && !managedByConsole) {
          if (alive) setState({ k: "ready", name, created: false });
          return;
        }
        const { soul } = await loadEmployeeSoul(employeeId, (u) => fetchJSON<unknown>(u));
        if (content.trim() !== soul.trim()) {
          await fetchJSON<unknown>(`/api/profiles/${encodeURIComponent(name)}/soul`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: soul }),
          });
        }
        if (alive) setState({ k: "ready", name, created: false });
        return;
      }
      // 建档前先取这位员工自己的人设：clone_from_default 会把「上一位员工」的
      // system_prompt 一起复制过来（实测会自称别人），而 POST /api/profiles
      // 支持 soul= ，所以一次就把人格写对，不留补救步骤。
      const { soul } = await loadEmployeeSoul(employeeId, (u) => fetchJSON<unknown>(u));
      await fetchJSON<unknown>("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          clone_from_default: true,
          soul,
          description: employeeProfileDescription(employeeId),
        }),
      });
      if (alive) setState({ k: "ready", name, created: true });
    })().catch((err: unknown) => {
      if (!alive) return;
      const reason = err instanceof Error && err.message ? err.message : "创建独立对话档失败";
      setState({ k: "failed", name: "", reason });
    });
    return () => {
      alive = false;
    };
  }, [employeeId, enabled]);

  return state;
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
  // 2026-11-26 用户拍板走 A：每位员工一个独立 Hermes profile（同进程、会话隔离）。
  // profile 未解析完之前不挂对话宿主，避免先用默认档建出会话再切走（会留下脏会话）。
  // 解析失败时退回默认档（""），并在页面上写明「本次落在默认档」，不假装隔离已生效。
  const forced = searchParams.get("state");
  const profileState = useEmployeeProfile(employeeId, forced === null);
  const chatProfile = profileState.k === "ready" ? profileState.name : "";

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

  const forceRid = searchParams.get("rid");
  const { state, armedFor, reload } = useEmployeeGuard(forced ? "" : employeeId);

  // CHAT-04: ready only for the id this fetch cycle resolved, and only after
  // the attach token rotated; every other commit shows busy/error/empty. The
  // host subtree is keyed by id, so an id switch unmounts the old ChatPage —
  // closing its WebSocket (ChatPage.tsx:1546-1584 cleanup) — before a new
  // host can arm for the incoming employee.
  const showHost =
    forced === null &&
    employeeId !== "" &&
    state.k === "ready" &&
    armedFor === employeeId &&
    (profileState.k === "ready" || profileState.k === "failed");
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

      {/* 隔离口径上屏：让「这条会话归谁」这件事可见，而不是靠猜。
          失败时明说落回默认档 —— 不把共享档伪装成独立档。 */}
      {forced === null && employeeId !== "" && profileState.k === "ready" ? (
        <p className="text-xs text-muted-foreground" data-testid="chat-profile-scope">
          本对话运行在员工独立档 <code className="font-mono">{profileState.name}</code>
          {profileState.created ? "（首次打开时自动创建）" : ""}；会话与历史只属于这位员工。
        </p>
      ) : null}
      {forced === null && employeeId !== "" && profileState.k === "failed" ? (
        <p className="text-xs text-muted-foreground" data-testid="chat-profile-fallback">
          独立对话档创建失败（{profileState.reason}）：本次对话落在默认档，会话不会归属到该员工。
        </p>
      ) : null}

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
