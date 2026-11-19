/**
 * R19 tail a: the sidebar identity widget, extracted from App.tsx so the
 * logout-clears-identity behavior is directly testable. Refreshes on
 * `auth5:session` (login success broadcast); logout drops it to anonymous.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";

export function Auth5Session(): ReactNode {
  const navigate = useNavigate();
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
        className="mx-3 mb-2 h-8 animate-pulse rounded-sm bg-white/5"
        data-testid="auth5-widget"
        aria-label="加载中"
      />
    );
  }
  if (who.k === "anon") {
    return (
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
        data-testid="auth5-widget"
      >
        <span className="min-w-0 break-words text-muted-foreground">未登录</span>
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
  return (
    <div
      className="flex min-w-0 flex-col gap-1 px-3 py-2 text-xs"
      data-testid="auth5-widget"
    >
      <span className="min-w-0 truncate font-medium" data-testid="auth5-display" title={who.display}>
        {who.display}
      </span>
      <span className="min-w-0 break-words text-muted-foreground" data-testid="auth5-role">
        角色：{who.role}
      </span>
      <span className="min-w-0 break-words text-muted-foreground" data-testid="auth5-tenant">
        租户：{who.tenant}
      </span>
      <button
        type="button"
        className="mt-1 shrink-0 self-start rounded-sm border border-border px-2 py-1"
        data-testid="auth5-logout"
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
        退出登录
      </button>
    </div>
  );
}

