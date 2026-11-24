/**
 * R19 tail a: the sidebar identity widget, extracted from App.tsx so the
 * logout-clears-identity behavior is directly testable. Refreshes on
 * `auth5:session` (login success broadcast); logout drops it to anonymous.
 *
 * 2026-11-24 侧栏骨架对齐：登录态从四行（姓名 / 角色 / 租户 / 退出登录按钮）
 * 收成一枚紧凑账号芯片 —— 圆形姓名缩写 + 姓名 + 租户弱色一行 + 右端出口图标
 * （骨架 console-v4-skeleton.html 的 .account-btn 形态）。角色与租户仍在
 * DOM 里（sr-only，给读屏与验收读数），只是不再各占一行。
 */
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import { LogOut } from "lucide-react";
import { isSessionExpired, subscribeSessionExpired } from "@/lib/session-expiry";

/** 圆形缩写：拉丁姓名取前两段首字母（Kevin Lee → KL），中文/单词取前两字。 */
function initialsOf(display: string): string {
  const parts = display.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  const single = parts[0] ?? "?";
  return single.slice(0, 2).toUpperCase();
}

export interface Auth5SessionProps {
  /** 上游版本号（`/api/status` 回包才有）。骨架侧栏没有版本行，故只在
   * 账号芯片的 title 里出现；没有回包就整段不进 DOM。 */
  version?: string | null;
  /** 芯片右端的紧凑动作（主题/语言等），与头像/姓名同处一行。 */
  trailing?: ReactNode;
}

export function Auth5Session({
  version = null,
  trailing = null,
}: Auth5SessionProps = {}): ReactNode {
  const navigate = useNavigate();
  // 设计车道 ①（P0-① 收敛）：「会话已过期」已由全站唯一 SessionExpiredBanner
  // 陈述，anon 分支不再在侧栏重复说「未登录」；「去登录」出口保留。
  const bannerShowing = useSyncExternalStore(
    subscribeSessionExpired,
    isSessionExpired,
    isSessionExpired,
  );
  const [who, setWho] = useState<
    { k: "loading" } | { k: "anon" } | { k: "ok"; display: string; role: string; tenant: string | null }
  >({ k: "loading" });
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      setWho({ k: "loading" });
      fetch("/auth/whoami", { credentials: "same-origin" })
        .then(async (res) => {
          if (!alive) return;
          if (res.status === 401) {
            setWho({ k: "anon" });
            return;
          }
          const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
          if (res.ok && body) {
            const disp =
              typeof body.display === "string" && body.display.trim()
                ? body.display.trim()
                : "未命名账号";
            const role =
              typeof body.granted === "string" && body.granted.trim()
                ? body.granted.trim()
                : "—";
            const tid =
              typeof body.tenant_id === "string" ? body.tenant_id.trim() : "";
            // 租户 ID 本身就是给人看的归属标识（t_seakoi_pilot），不再按
            // 「像内部 id 就打成 —」的旧口径屏蔽；没有就是 null，整行不渲染。
            const tenant = tid === "" ? null : tid;
            setWho({ k: "ok", display: disp, role, tenant });
            // UI-QA P1: whoami 2xx 是本页唯一的「已登录证据」。广播出去，让同栏
            // 身份件的不确定态即刻闭嘴——两者同屏自相矛盾（下方已显示 opsadmin
            // 身份，上方却说确认不到登录）不能再现。
            window.dispatchEvent(new CustomEvent("auth5:verified"));
          } else {
            setWho({ k: "anon" });
          }
        })
        .catch(() => {
          if (alive) setWho({ k: "anon" });
        });
    };
    // R18: re-read the identity when a login (or logout) lands, so the
    // sidebar stops showing 「未登录」right after a successful sign-in.
    refresh();
    window.addEventListener("auth5:session", refresh);
    return () => {
      alive = false;
      window.removeEventListener("auth5:session", refresh);
    };
  }, []);
  if (who.k === "loading") {
    // 未解析态不留空壳：只画骨架同款的缩写圆点 + 一条 11px 弱色读数语，
    // 几何与账号芯片一致（不画边框、不画整块底色），解析到就原地换成真身份。
    return (
      <div className="sidebar-account" data-testid="auth5-widget" aria-busy="true">
        <span className="sidebar-avatar is-pending" aria-hidden="true" />
        <div className="sidebar-account-meta">
          <span className="sidebar-account-sub">读取中…</span>
        </div>
        {trailing !== null && (
          <span className="sidebar-chip-actions">{trailing}</span>
        )}
      </div>
    );
  }
  if (who.k === "anon") {
    return (
      <div
        className="flex items-center justify-between gap-2 px-1 py-1.5 text-xs"
        data-testid="auth5-widget"
      >
        {!bannerShowing && (
          <span className="min-w-0 break-words text-muted-foreground">未登录</span>
        )}
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="shrink-0 rounded-sm border border-border px-2 py-1"
          data-testid="auth5-goto-login"
        >
          去登录
        </button>
      </div>
    );
  }
  // 骨架该位置是「租户 · 邮箱前缀」。这里用「租户 ID · 用户名首段」：
  // 部署地址/端口/via bisheng 这类实现细节一律不上屏；租户取不到就整行不渲染。
  const firstSegment = who.display.split(/[\s@·/]+/).filter(Boolean)[0] ?? "";
  const sub =
    who.tenant === null
      ? null
      : firstSegment === ""
        ? who.tenant
        : `${who.tenant} · ${firstSegment}`;
  // 骨架的账号行只有「头像 + 姓名 + 弱色行」；版本号与角色一起收进 title。
  const chipTitle = [
    who.display,
    who.role !== "—" ? who.role : null,
    version ? `v${version}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
  return (
    <>
      <div
        className="sidebar-account"
        data-testid="auth5-widget"
        data-version={version ?? undefined}
        title={chipTitle}
      >
        <span className="sidebar-avatar" aria-hidden="true">
          {initialsOf(who.display)}
        </span>
        <div className="sidebar-account-meta">
          <b className="sidebar-account-name" data-testid="auth5-display">
            {who.display}
          </b>
          {sub !== null && (
            <span
              className="sidebar-account-sub"
              data-testid="auth5-tenant"
              title={sub}
            >
              {sub}
            </span>
          )}
        </div>
        {trailing !== null && (
          <span className="sidebar-chip-actions">{trailing}</span>
        )}
        <button
          type="button"
          className="sidebar-account-exit"
          data-testid="auth5-logout"
          aria-label="退出登录"
          title="退出登录"
          onClick={() => {
            void fetch("/auth/logout", { method: "POST", credentials: "same-origin" }).finally(() => {
              sessionStorage.removeItem("auth5.session");
              // R19 tail a: never leave a stale identity on the client after
              // logout — drop the widget to its anonymous state immediately.
              setWho({ k: "anon" });
              navigate("/login");
            });
          }}
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      {/* 芯片里压缩掉的两行仍在无障碍树里：读屏与验收读数都还能读到。 */}
      <span className="sr-only" data-testid="auth5-role">
        角色：{who.role}；租户：{who.tenant ?? "—"}
      </span>
    </>
  );
}