/**
 * AuthWidget — sidebar "Logged in as …" affordance for the dashboard
 * OAuth gate (Phase 7 of .hermes/plans/2026-05-21-dashboard-oauth-auth.md).
 *
 * Renders nothing in loopback / --insecure mode. In gated mode, fetches
 * /api/auth/me on mount and surfaces:
 *
 *   - the user_id (truncated to 14 chars + ellipsis) since the Nous Portal
 *     contract V1 doesn't emit email/display_name claims (Contract Anchor
 *     C4 in the plan; the API responds with empty strings for those
 *     fields, so we use user_id as the display value)
 *   - the provider's display_name (looked up from /api/auth/providers,
 *     defaults to the bare provider key)
 *   - a logout button that POSTs /auth/logout and full-page-navigates to
 *     /login (the dashboard becomes inaccessible again)
 *
 * Failure modes:
 *   - 401 from /api/auth/me means we're not gated (or the gate is on but
 *     we have no cookie — in that case the gate's middleware would have
 *     redirected us before App.tsx renders, so we won't see this). The
 *     widget renders nothing.
 *   - Network error: shows a minimal "auth status unavailable" message
 *     so the user knows the widget tried. It is silenced while the app-wide
 *     session-expiry banner is showing (design lane ①) or once Auth5Session
 *     has verified a login via `auth5:verified` (UI-QA P1) — in both cases
 *     the widget would contradict what the screen already says.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { api, type AuthMeResponse } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { isSessionExpired, subscribeSessionExpired } from "@/lib/session-expiry";
import { shouldHideAuthWidget } from "./auth-widget-visibility";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { LogOut } from "lucide-react";

interface AuthWidgetProps {
  className?: string;
}

/** Truncate ``user_id`` to fit a small UI without revealing the full
 *  opaque identifier. 14 chars is enough to disambiguate users in a
 *  small org and short enough to fit a single sidebar row. */
function truncateUserId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 14)}…`;
}

export function AuthWidget({ className }: AuthWidgetProps) {
  const { t } = useI18n();
  // 设计车道 ①（P0-① 收敛）：会话失效已由全站唯一 SessionExpiredBanner 陈述，
  // 横幅在场时本件不再重复播报「暂时确认不到登录状态」这个不确定态。
  const bannerShowing = useSyncExternalStore(
    subscribeSessionExpired,
    isSessionExpired,
    isSessionExpired,
  );
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState(false);
  // UI-QA P1: Auth5Session 在 whoami 2xx 时广播 `auth5:verified`。同栏已经展示
  // 登录身份（opsadmin / 角色 / 租户）时，本件的「暂时确认不到登录状态」与它自
  // 相矛盾，一律不再渲染。监听常驻：本件可能先于 whoami 完成挂载，事件到达即
  // 重渲染隐藏。
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const onVerified = () => setVerified(true);
    window.addEventListener("auth5:verified", onVerified);
    return () => window.removeEventListener("auth5:verified", onVerified);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getAuthMe()
      .then((data) => {
        if (cancelled) return;
        if (shouldHideAuthWidget(data)) {
          setHidden(true);
          return;
        }
        setMe(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // 401/403 from /api/auth/me means the gate isn't engaged in this
        // process (loopback mode) or the session is gone — render nothing.
        // fetchJSON throws an ApiError whose humanized message no longer
        // carries the status prefix, so read the status off the error
        // object itself.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setHidden(true);
          return;
        }
        setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden) return null;

  if (error) {
    if (verified || bannerShowing) return null;
    return (
      <div
        className={cn(
          "px-5 py-2 text-[0.65rem] tracking-[0.05em] text-muted-foreground/70",
          className,
        )}
      >
        {t.app.auth?.statusUnavailable ?? "auth status unavailable"}
      </div>
    );
  }

  if (!me) {
    // Loading. Reserve the row height so the sidebar doesn't flicker
    // when the data arrives.
    return (
      <div
        className={cn(
          "h-9 px-5 py-2 text-[0.65rem] text-muted-foreground/40",
          className,
        )}
        aria-busy="true"
      >
        …
      </div>
    );
  }

  const handleLogout = () => {
    void api.logout();
  };

  // Prefer display_name → email → truncated user_id. Contract V1 only
  // populates user_id; the fallthroughs are forward-compat for a future
  // Portal that adds a userinfo endpoint (OQ-C1 in the plan).
  const label = me.display_name || me.email || truncateUserId(me.user_id);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-2",
        "px-5 py-2",
        "border-t border-current/10",
        "text-[0.65rem] tracking-[0.05em]",
        className,
      )}
      role="status"
      aria-label={(t.app.auth?.loggedInAs ?? "Logged in as {{name}}").replace("{{name}}", label)}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-mono text-foreground/90" title={me.user_id}>
          {label}
        </span>
        <span className="truncate text-muted-foreground/70">
          {(t.app.auth?.viaProvider ?? "via {{provider}}").replace("{{provider}}", me.provider)}
        </span>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className={cn(
          "shrink-0 rounded p-1.5 text-muted-foreground/70",
          "min-h-[24px] min-w-[24px]",
          "transition-colors hover:bg-current/10 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current/40",
        )}
        aria-label={t.app.auth?.logout ?? "Log out"}
        title={t.app.auth?.logout ?? "Log out"}
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
