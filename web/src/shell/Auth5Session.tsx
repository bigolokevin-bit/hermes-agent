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
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
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

export function Auth5Session(): ReactNode {
  const navigate = useNavigate();
  // 设计车道 ①（P0-① 收敛）：「会话已过期」已由全站唯一 SessionExpiredBanner
  // 陈述，anon 分支不再在侧栏重复说「未登录」；「去登录」出口保留。
  const bannerShowing = useSyncExternalStore(
    subscribeSessionExpired,
    isSessionExpired,
    isSessionExpired,
  );
  const [who, setWho] = useState<
    { k: "loading" } | { k: "anon" } | { k: "ok"; display: string; role: string; tenant: string }
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
            const tid = typeof body.tenant_id === "string" ? body.tenant_id.trim() : "";
            const tenant = tid && !/^[a-z]+_[0-9A-Za-z]+$/.test(tid) ? tid : "—";
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
    return (
      <div
        className="mx-1 h-9 animate-pulse rounded-sm bg-white/5"
        data-testid="auth5-widget"
        aria-label="加载中"
      />
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
  const sub =
    who.tenant !== "—"
      ? who.tenant
      : who.role !== "—"
        ? who.role
        : typeof window !== "undefined"
          ? window.location.host
          : "—";
  return (
    <>
      <div className="sidebar-account" data-testid="auth5-widget">
        <span className="sidebar-avatar" aria-hidden="true">
          {initialsOf(who.display)}
        </span>
        <div className="sidebar-account-meta">
          <b
            className="sidebar-account-name"
            data-testid="auth5-display"
            title={who.display}
          >
            {who.display}
          </b>
          <span className="sidebar-account-sub" data-testid="auth5-tenant" title={sub}>
            {sub}
          </span>
        </div>
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
        角色：{who.role}；租户：{who.tenant}
      </span>
    </>
  );
}