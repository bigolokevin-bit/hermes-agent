/**
 * UI-NAV L4-nav 条款 10（UI-DIRECTION-20261123 §e）：侧栏身份区一行——
 * 头像 + 显示名 + 角色；租户、主题、退出收进受控弹层。判定与 Auth5Session
 * 同源（/auth/whoami，2xx 为唯一已登录证据），并广播/监听既有
 * `auth5:verified` / `auth5:session` 事件，接线前与老 widget 状态一致。
 * 禁裸 ID：tenant_id 命中 `/^[a-z]+_[0-9A-Za-z]+$/` 形态即按「—」显示。
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { ThemeToggle } from "./ThemeToggle";

type Identity = { k: "loading" } | { k: "anon" } | { k: "ok"; display: string; role: string; tenant: string };

/** 与 Auth5Session 同口径：2xx 才有身份；随机串形态的租户 ID 上屏一律「—」。 */
export function identityFromWhoami(status: number, ok: boolean, body: Record<string, unknown> | null): Identity {
  if (status === 401 || !ok || !body) return { k: "anon" };
  const disp = typeof body.display === "string" && body.display.trim() ? body.display.trim() : "未命名账号";
  const role = typeof body.granted === "string" && body.granted.trim() ? body.granted.trim() : "—";
  const tid = typeof body.tenant_id === "string" ? body.tenant_id.trim() : "";
  const tenant = tid && !/^[a-z]+_[0-9A-Za-z]+$/.test(tid) ? tid : "—";
  return { k: "ok", display: disp, role, tenant };
}

export function IdentityMenu({ collapsed = false }: { collapsed?: boolean }): ReactNode {
  const navigate = useNavigate();
  const [who, setWho] = useState<Identity>({ k: "loading" });
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      setWho({ k: "loading" });
      fetch("/auth/whoami", { credentials: "same-origin" })
        .then(async (res) => {
          if (!alive) return;
          const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
          const next = identityFromWhoami(res.status, res.ok, body);
          setWho(next);
          if (next.k === "ok") window.dispatchEvent(new CustomEvent("auth5:verified"));
        })
        .catch(() => {
          if (alive) setWho({ k: "anon" });
        });
    };
    refresh();
    // 只监听 auth5:session（登录/登落定广播）；verified 是本件自己广播的，
    // 再监听会自激重读（Auth5Session 同形制：不监听 verified）。
    window.addEventListener("auth5:session", refresh);
    return () => {
      alive = false;
      window.removeEventListener("auth5:session", refresh);
    };
  }, []);

  // 点外层关闭（受控面板，不做 role=menu 的键盘栅格）。
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (triggerRef.current && e.target instanceof Node && triggerRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const logout = () => {
    setOpen(false);
    void fetch("/auth/logout", { method: "POST", credentials: "same-origin" })
      .catch(() => undefined)
      .finally(() => {
        // 与 Auth5Session 同链：清会话态、旧身份即刻消失，再回登录页。
        sessionStorage.removeItem("auth5.session");
        setWho({ k: "anon" });
        window.dispatchEvent(new CustomEvent("auth5:session"));
        navigate("/login");
      });
  };

  const initial = who.k === "ok" ? who.display.slice(0, 1).toUpperCase() : "";

  if (who.k === "anon") {
    // 匿名态：单一「去登录」出口（§e），不复述「未登录」——过期横幅是全站唯一陈述位。
    return (
      <div className="flex w-full items-center" data-testid="idn5-widget">
        <button
          type="button"
          data-testid="idn5-goto-login"
          className="w-full rounded-sm border border-border px-2 py-1 text-left text-xs whitespace-nowrap"
          onClick={() => navigate("/login")}
        >
          去登录
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full" data-testid="idn5-widget">
      <button
        ref={triggerRef}
        type="button"
        data-testid="idn5-account"
        aria-expanded={open}
        aria-controls="idn5-pop"
        title={who.k === "loading" ? "正在确认登录状态" : who.display}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            e.currentTarget.focus();
          }
        }}
        // 主入口高 44px（§e 触区）；collapsed=图标轨，只给头像。
        className={`flex h-11 w-full items-center gap-2 rounded-md px-2 text-left min-w-0 ${
          open ? "bg-white/5" : "hover:bg-white/5"
        }`}
      >
        {who.k === "loading" ? (
          <>
            <span className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-white/5" data-testid="idn5-avatar-skeleton" />
            {!collapsed && (
              <span className="flex min-w-0 flex-col gap-1">
                <span className="h-2.5 w-16 animate-pulse rounded bg-white/5" />
                <span className="h-2 w-10 animate-pulse rounded bg-white/5" />
              </span>
            )}
          </>
        ) : (
          <>
            <span
              aria-hidden="true"
              data-testid="idn5-avatar"
              className={
                collapsed
                  ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium"
                  : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-medium"
              }
            >
              {initial}
            </span>
            {!collapsed && (
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-medium " data-testid="idn5-display">
                  {who.display}
                </span>
                {/* 角色上屏一律原词，租户不进主行（禁裸 ID，租户只在弹层）。 */}
                <span className="truncate text-[10px] text-muted-foreground" data-testid="idn5-role">
                  {who.role}
                </span>
              </span>
            )}
            <span aria-hidden="true" className="material-symbols-outlined shrink-0 text-base text-muted-foreground">
              {open ? "expand_less" : "expand_more"}
            </span>
          </>
        )}
      </button>

      {open && who.k === "ok" ? (
        <section
          id="idn5-pop"
          data-testid="idn5-pop"
          className="absolute bottom-full left-2 z-50 mb-1 w-60 rounded-lg border border-border bg-[var(--color-surface-raised)] p-3"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              triggerRef.current?.focus();
            }
          }}
        >
          <dl className="mb-2 flex flex-col gap-1 text-xs">
            <dt className="text-[10px] uppercase text-muted-foreground">租户</dt>
            <dd className="break-all text-muted-foreground" data-testid="idn5-tenant">
              {who.tenant}
            </dd>
          </dl>
          <div className="flex flex-col gap-1 border-t border-border pt-2">
            <ThemeToggle />
            <button
              type="button"
              data-testid="idn5-logout"
              className="w-full rounded-sm border border-border px-2 py-1 text-left text-xs whitespace-nowrap"
              onClick={logout}
            >
              退出
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
