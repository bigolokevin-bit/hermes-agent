/**
 * 折叠档（56px 图标轨）的身份位：一枚 30px 的缩写圆点（2026-11-24）。
 *
 * 展开档的底部是「额度块 + 账号芯片（头像/姓名/租户/出口 + 主题/语言）」。
 * 折叠档只剩 53px，姓名、租户与额度数字都读不了，于是：
 *   - 额度块与账号芯片整块不渲染（App.tsx 的 lg:hidden 既有行为，保持不变）；
 *   - 身份留一颗缩写圆点，保留「当前登录是谁」这一个最省的信息。
 *
 * 身份判据与 Auth5Session / IdentityMenu 同源：`/auth/whoami` 2xx 且带
 * display 才是已登录证据，401 为匿名；未解析完成前画虚线空圆（骨架同款），
 * 绝不拿占位字符冒充姓名缩写。圆点不是按钮：折叠档没有账号弹层，画一个
 * 点不开的按钮比留一个只读标记更糟。
 */
import { useEffect, useState, type ReactNode } from "react";

/** 圆形缩写：与 Auth5Session 同一规则（拉丁姓名取前两段首字母，中文/单词取前两字）。 */
function initialsOf(display: string): string {
  const parts = display.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

type Who =
  | { k: "loading" }
  | { k: "anon" }
  | { k: "ok"; display: string; role: string };

export function SidebarRailIdentity(): ReactNode {
  const [who, setWho] = useState<Who>({ k: "loading" });

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
            const display =
              typeof body.display === "string" && body.display.trim()
                ? body.display.trim()
                : "未命名账号";
            const role =
              typeof body.granted === "string" && body.granted.trim()
                ? body.granted.trim()
                : "—";
            setWho({ k: "ok", display, role });
          } else {
            setWho({ k: "anon" });
          }
        })
        .catch(() => {
          if (alive) setWho({ k: "anon" });
        });
    };
    refresh();
    window.addEventListener("auth5:session", refresh);
    return () => {
      alive = false;
      window.removeEventListener("auth5:session", refresh);
    };
  }, []);

  if (who.k === "loading") {
    return (
      <span
        className="sidebar-rail-identity is-pending"
        data-testid="sidebar-rail-identity"
        aria-busy="true"
        title="正在确认登录状态"
      />
    );
  }
  if (who.k === "anon") {
    return (
      <span
        className="sidebar-rail-identity is-pending"
        data-testid="sidebar-rail-identity"
        role="img"
        aria-label="未登录"
        title="未登录"
      >
        ?
      </span>
    );
  }
  return (
    <span
      className="sidebar-rail-identity"
      data-testid="sidebar-rail-identity"
      role="img"
      aria-label={`当前账号：${who.display}`}
      title={who.role === "—" ? who.display : `${who.display} · ${who.role}`}
    >
      {initialsOf(who.display)}
    </span>
  );
}
