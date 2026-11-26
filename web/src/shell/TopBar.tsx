/* ------------------------------------------------------------------ *
 * Console top bar — UI-DIRECTION-20261123-v2 §3 + UI-FOUNDATION-CONTRACT
 * clause 6 (`single-h1-in-topbar`).
 *
 * One 56px row carrying, in DOM order: the sidebar collapse control, an
 * optional back arrow (employee detail only), a 12px clickable breadcrumb, and
 * the page's single <h1>. Nothing else. The right-hand global tools (language /
 * theme / identity) still live in the sidebar footer — those are upstream files
 * outside this lane's write scope, so the right side is deliberately empty
 * rather than holding a look-alike dead control.
 *
 * 2026-11-26 — 面包屑改造（用户实机投诉：「进了员工详情不知道怎么返回，路径也不清晰」）：
 *   · 旧实现把面包屑写死成 `${group} · 控制台`，与真实路径无关，详情页也照旧；
 *   · 现在 `consoleSurface()` 返回 `{trail, title}`：
 *       模块列表页 → 运营
 *       员工详情工作台 → 运营 › 数字员工
 *       员工详情分区 → 运营 › 数字员工 › 员工详情
 *     前两段可点（回列表 / 回该员工工作台），h1 显示分区名。
 *   · 详情页左侧多一个显式返回钮（history.back），375 也可见——
 *     用户的原话是「不知道怎么返回」，所以不能只靠可点面包屑。
 *
 * Why a portal: the acceptance gate reads an h1's surface as
 *   inTopbar  = closest("header,[data-testid*='topbar'],[data-testid*='-head']")
 *   inContent = closest("[data-testid*='grid'],main,.duty-grid")
 * and passes only when there is exactly one h1, it sits in the top bar, and no
 * h1 is inside `main`. The routed body renders inside PageHeaderProvider's
 * <main>, and that provider is not this lane's file, so the bar cannot be
 * composed as a child of it. The portal moves the *DOM* into
 * `#shell-topbar-slot` — a direct child of the main column and a sibling of the
 * provider root — while the *React tree* stays where App mounted it, so the bar
 * still reads the router location and the i18n dictionary through normal
 * context. Without the portal the bar would either land inside <main> (clause 6
 * fails by duplicate) or require editing a file this lane does not own.
 *
 * The row height is the frozen skeleton geometry mirrored in shell-layout.ts
 * (TOPBAR_ROW_PX = 56). It is written as a px utility class rather than an
 * inline style attribute, because the direction bans inline sizing and Tailwind's
 * scanner cannot see a TS constant interpolated into a class. No CSS custom
 * property is minted here (the token freeze at 2026-11-23T20:57+08:00 puts any
 * new name behind L0).
 * ------------------------------------------------------------------ */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";

import { useI18n } from "@/i18n/context";
import { resolvePageTitle } from "@/lib/resolve-page-title";
import {
  CONSOLE_MODULES,
  ZONE_ALIAS,
  ZONE_TITLE,
  ZONES,
  findRoute,
  type DetailZone,
} from "./routes";
import "./console-chrome.css";

/** Mount point rendered by App.tsx in the main column, outside <main>. */
export const SHELL_TOPBAR_SLOT_ID = "shell-topbar-slot";

interface ConsoleTopBarProps {
  /** Sidebar collapse state, owned by App.tsx and persisted via shell-layout. */
  collapsed: boolean;
  onToggleCollapse: () => void;
}

/** One breadcrumb segment. `to` present ⇒ rendered as a link; absent ⇒ plain text. */
type Crumb = { label: string; to?: string };

/* Console routes own their title vocabulary. The shell's route table names every
 * module with a Chinese label, and that label is what the single <h1> must show.
 * The upstream resolver used to be the only source here rendered an English word
 * on the dev face: for /overview it misses the nav registry and falls through to
 * a pathname-derived string, so the shell table wins first and the resolver is
 * only consulted off-shell.
 *
 * 详情页的层级是真实路径，不是猜的：`findRoute` 已经解出 `zone` 与
 * `params.employeeId`，这里只把它们拼成「分组 › 模块 › 员工详情」。  */
function consoleSurface(
  pathname: string,
  search: string,
): { trail: Crumb[]; title: string } | null {
  const hit = findRoute(pathname + search);
  if (hit === null) return null;
  const meta = CONSOLE_MODULES.find((m) => m.module === hit.entry.module);
  if (meta === undefined) return null;

  // 模块列表页 / 模块 tab 页：一段分组，标题是模块名。
  if (hit.entry.kind !== "detail-zone") {
    return { trail: [{ label: meta.group }], title: meta.label };
  }

  const employeeId = hit.params.employeeId ?? "";
  // 分区可能写在路径段（/employees/:id/config），也可能写在查询串（?zone=config）。
  // 查询串形制是分区条自己生成的链接，而 `findRoute` 的路径匹配会先命中工作台那行，
  // 于是 entry.zone 恒为 workbench —— 这里必须自己读一次 query，否则点「配置」
  // 顶栏仍显示「员工详情」（2026-11-26 全局审查发现，29 条路由里唯一一处不一致）。
  const queryZone = new URLSearchParams(search).get("zone") ?? "";
  const aliased = ZONE_ALIAS[queryZone] ?? queryZone;
  const zone = (ZONES as readonly string[]).includes(aliased)
    ? (aliased as DetailZone)
    : ((hit.entry.zone ?? "workbench") as DetailZone);
  const employeesCrumb: Crumb = { label: meta.label, to: "/employees" };

  // 裸详情（工作台）：不再自己链自己，返回靠左侧箭头。
  if (zone === "workbench" || employeeId === "") {
    return {
      trail: [{ label: meta.group }, employeesCrumb],
      title: employeeId === "" ? meta.label : "员工详情",
    };
  }

  return {
    trail: [
      { label: meta.group },
      employeesCrumb,
      { label: "员工详情", to: `/employees/${encodeURIComponent(employeeId)}` },
    ],
    title: ZONE_TITLE[zone] ?? "员工详情",
  };
}

export function ConsoleTopBar({ collapsed, onToggleCollapse }: ConsoleTopBarProps) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById(SHELL_TOPBAR_SLOT_ID));
  }, []);

  if (slot === null) return null;

  const surface = consoleSurface(pathname, search);
  // Off-shell routes fall back to the shared resolver, which owns builtin nav
  // labels and residual zh titles. Plugin tabs are not passed down here: an
  // empty list means a plugin route shows the resolver's pathname-derived title
  // rather than a guessed one, and the upstream header still shows its own title
  // on those routes.
  const title = surface !== null ? surface.title : resolvePageTitle(pathname, t, []);
  // 详情页才给返回钮：模块页没有「上一层」，多一个箭头只会让层级更糊。
  const showBack = surface !== null && surface.trail.length >= 2;

  return createPortal(
    <header
      data-testid="shell-topbar"
      className="console-topbar z-1 flex h-[56px] shrink-0 items-center gap-3 border-b bg-background-base px-6"
    >
      <Button
        ghost
        size="icon"
        onClick={onToggleCollapse}
        data-testid="shell-sidebar-collapse"
        aria-label={collapsed ? t.common.expand : t.common.collapse}
        className="hidden lg:flex text-text-secondary hover:text-midground"
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </Button>

      {showBack ? (
        <Button
          ghost
          size="icon"
          onClick={() => navigate(-1)}
          data-testid="shell-topbar-back"
          aria-label="返回上一页"
          className="text-text-secondary hover:text-midground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      ) : null}

      <div className="flex min-w-0 flex-col justify-center">
        <nav
          aria-label="面包屑"
          data-testid="shell-topbar-crumb"
          className="console-note flex min-w-0 items-center gap-1 truncate text-[length:var(--font-size-ls-1)] leading-[var(--line-height-ls-2)]"
        >
          {surface === null ? (
            <span className="truncate">数字员工控制台</span>
          ) : (
            surface.trail.map((crumb, index) => (
              <span
                key={`${crumb.label}-${index}`}
                className="flex min-w-0 items-center gap-1"
              >
                {index > 0 ? <span aria-hidden="true">›</span> : null}
                {crumb.to !== undefined ? (
                  <Link to={crumb.to} className="truncate hover:text-midground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="truncate">{crumb.label}</span>
                )}
              </span>
            ))
          )}
        </nav>
        <h1
          data-testid="shell-topbar-title"
          className="truncate text-[length:var(--font-size-ls-5)] leading-[var(--line-height-ls-1)] font-medium text-midground"
        >
          {title}
        </h1>
      </div>
    </header>,
    slot,
  );
}
