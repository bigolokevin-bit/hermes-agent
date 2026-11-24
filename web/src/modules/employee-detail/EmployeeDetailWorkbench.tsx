/**
 * employee-detail 工作台 pane — lane A stage 2 (PRD v4.1 §7 工作台).
 *
 * 2026-11-24 收口（用户投诉「三排 tab 叠在一起」）：
 *  - 本 pane 是裸 `/employees/:id` 的默认视图：左侧 Hermes 原生对话，
 *    右侧信息轨；页面不再出现第二个 role="tablist"。
 *  - 顶部标题固定「姓名 · 短码」；姓名来自详情读口，读不到就退成
 *    「员工 · 短码」，不把 uuid / run_id / CR-* 之类的工程串写进可见文本。
 *  - 分区入口仍是真 Link（概览 / 能力与权限 / 审批 / 运行 / 审计），
 *    只作 <nav> 普通链接，不写 tab 角色 —— 详情页唯一的 tablist 留给外壳。
 *  - 375：对话独占一列；信息轨默认在对话下方，可「对话全屏」一键收起。
 *
 * Structure fact kept:
 *  - 60/40 split (.wbshell 3fr/2fr), single column at narrow widths;
 *  - left = the ONLY chat-host cell. The element carrying the chat-host marker
 *    attribute is created in App.tsx and injected through `renderChatHost`
 *    (assert-ia scans shell/** + modules/** for the marker, where
 *    ChatModulePage's <ChatHost> mount is the single counted host — a
 *    second literal here would push chatHosts to 2);
 *  - right = wbrail, four collapsible groups (id 身份与四道门 / budget 预算
 *    expanded by default; cap 能力 / runs 最近运行 collapsed), per skeleton
 *    L2444-2505. Every unlanded field shows 待核实 — no fake values, and
 *    unknown ≠ pass (§4 duty law repeats here).
 *
 * When `renderChatHost` is absent (App wiring missing) or the employee id is
 * blank, the left cell degrades to the honest mount-point notice from the
 * skeleton ("生产环境在此 import Hermes ChatPage"), never a blank dead link.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { fetchJSON } from "@/lib/api";
import "./employee-detail.css";

export interface EmployeeDetailWorkbenchProps {
  employeeId: string;
  /** App-provided element wrapper carrying the chat-host contract. */
  renderChatHost?: (employeeId: string) => ReactNode;
}

interface RailGroup {
  key: "id" | "budget" | "cap" | "runs";
  label: string;
  lines: string[];
}

const RAIL_GROUPS: readonly RailGroup[] = [
  {
    key: "id",
    label: "身份与上岗检查",
    lines: [
      "身份绑定：待核实（上游用户中心接口尚未接入）",
      "上岗检查：待核实（汇总数据尚未接入，核实前不判定可上岗）",
      "汇总结论：数据接入前不判定",
    ],
  },
  {
    key: "budget",
    label: "预算",
    lines: [
      "额度/消耗：待核实（金额以计费账本为准，估算一律标「预估」）",
      "汇总数据接入前保持本提示",
    ],
  },
  {
    key: "cap",
    label: "能力",
    lines: ["技能/工具/知识覆盖：待核实（数据源尚未接入）"],
  },
  {
    key: "runs",
    label: "最近运行",
    lines: ["最近运行：接入后显示最近记录；费用缺失标「—」"],
  },
];

/** 与模块页同一口径：emp_A3F1B2C4… → "A3F1B2C4"；取不出码就「—」。 */
function shortCode(value: string): string {
  const tail = value
    .replace(/^(emp|run|rn|task|apr|aud|cs|session)_/i, "")
    .replace(/[^0-9a-z]/gi, "")
    .slice(0, 8)
    .toUpperCase();
  return tail || "—";
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

interface HeaderInfo {
  name: string | null;
  role: string | null;
  department: string | null;
}

const EMPTY_HEADER: HeaderInfo = { name: null, role: null, department: null };

/** 标题只用详情读口回传的字段；任何失败都静默退到「员工 · 短码」。 */
function useHeaderInfo(employeeId: string): HeaderInfo {
  // 用 id 一起存：换了员工就自动回到空档位，effect 里只处理异步回调。
  const [entry, setEntry] = useState<{ id: string; info: HeaderInfo }>({
    id: "",
    info: EMPTY_HEADER,
  });
  useEffect(() => {
    if (!employeeId) return;
    let alive = true;
    fetchJSON<unknown>(`/agent-api/api/employees/${encodeURIComponent(employeeId)}`)
      .then((body) => {
        if (!alive || !body || typeof body !== "object") return;
        const rec = body as Record<string, unknown>;
        setEntry({
          id: employeeId,
          info: {
            name: pickString(rec.name),
            role: pickString(rec.title, rec.role, rec.position),
            department: pickString(rec.department),
          },
        });
      })
      .catch(() => {
        // 读口不可达时标题退回「员工 · 短码」，不编造姓名。
      });
    return () => {
      alive = false;
    };
  }, [employeeId]);
  return entry.id === employeeId ? entry.info : EMPTY_HEADER;
}

/** 五个分区入口：真 Link，普通导航语义（不写 tab 角色）。 */
const WORKBENCH_ZONES = [
  { id: "overview", label: "概览" },
  { id: "capability", label: "能力与权限" },
  { id: "approvals", label: "审批" },
  { id: "runs", label: "运行" },
  { id: "audit", label: "审计" },
] as const;

export default function EmployeeDetailWorkbench({
  employeeId,
  renderChatHost,
}: EmployeeDetailWorkbenchProps) {
  const [open, setOpen] = useState<Record<RailGroup["key"], boolean>>(() => {
    // 375：信息轨默认收起（身份/预算两组也折叠），桌面维持原来的展开档。
    const wide =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 1024px)").matches;
    return { id: wide, budget: wide, cap: false, runs: false };
  });
  const [chatOnly, setChatOnly] = useState(false);
  const toggle = (key: RailGroup["key"]) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  const header = useHeaderInfo(employeeId);
  const code = employeeId ? shortCode(employeeId) : "—";
  const title = header.name ? `${header.name} · ${code}` : `员工 · ${code}`;
  const enc = encodeURIComponent(employeeId);

  const chatCell: ReactNode =
    employeeId !== "" && renderChatHost !== undefined ? (
      renderChatHost(employeeId)
    ) : (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[16rem] flex-1 flex-col items-start justify-center gap-2 rounded-[var(--r)] border p-5 text-sm edw-panel"
        data-testid="ed5-workbench-chat-placeholder"
      >
        <span className="edw-title">Hermes 对话</span>
        <span>
          {employeeId === ""
            ? "缺少员工编号，无法确定对话对象。"
            : "接入后，这里会打开与该员工的对话；本页不自行绘制消息流。"}
        </span>
        <span className="font-mono text-xs edw-muted">
          对话服务尚未接入
        </span>
      </div>
    );

  return (
    <section
      className="flex min-w-0 flex-col gap-3"
      data-testid="ed5-workbench"
      data-chat-only={chatOnly ? "1" : undefined}
    >
      <header className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1
            className="truncate font-mondwest text-xl"
            data-testid="ed5-workbench-title"
            title={employeeId || undefined}
          >
            {title}
          </h1>
          <p className="flex min-w-0 flex-wrap gap-x-2 text-xs edw-muted">
            <span className="min-w-0">{header.role ?? "岗位待核实"}</span>
            {header.department ? (
              <span className="min-w-0">部门 · {header.department}</span>
            ) : null}
            <span className="min-w-0">工作台 · 左侧对话，右侧档案</span>
          </p>
        </div>
        {employeeId ? (
          <Link
            className="rounded-[var(--r-sm)] border px-3 py-1.5 text-sm no-underline edw-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            to="/employees"
            data-testid="ed5-workbench-back"
          >
            返回列表
          </Link>
        ) : null}
      </header>

      <nav
        aria-label="详情分区入口"
        className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs edw-muted"
        data-testid="ed5-workbench-zones"
      >
        <span className="shrink-0">分区：</span>
        {employeeId
          ? WORKBENCH_ZONES.map((z) => (
              <Link
                key={z.id}
                to={`/employees/${enc}${z.id === "overview" ? `?zone=overview` : `?zone=${z.id}`}`}
                data-zone={z.id}
                data-testid={`ed5-workbench-zone-${z.id}`}
                className="rounded-sm underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {z.label}
              </Link>
            ))
          : null}
        <button
          type="button"
          onClick={() => setChatOnly((v) => !v)}
          aria-pressed={chatOnly}
          data-testid="ed5-workbench-fullscreen"
          className="ml-auto rounded-[var(--r-sm)] border px-2.5 py-1 text-xs edw-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {chatOnly ? "退出全屏" : "对话全屏"}
        </button>
      </nav>

      <div
        className={
          chatOnly
            ? "grid min-w-0 grid-cols-1 gap-3"
            : "grid min-w-0 gap-3 lg:grid-cols-[3fr_2fr]"
        }
      >
        <div
          className={
            chatOnly
              ? "flex min-w-0 flex-col h-[calc(100dvh-11rem)] min-h-[24rem]"
              : "flex min-w-0 flex-col h-[65dvh] min-h-[20rem] lg:h-[calc(100dvh-15rem)]"
          }
          data-testid="ed5-workbench-chat"
        >
          {chatCell}
        </div>
        <aside
          className={
            chatOnly ? "hidden" : "flex min-w-0 flex-col gap-2"
          }
          aria-label="工作台侧栏"
          data-testid="ed5-workbench-rail"
        >
          {RAIL_GROUPS.map((group) => (
            <div
              key={group.key}
              className="rounded-[var(--r)] border edw-panel"
            >
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={open[group.key]}
                className="flex w-full items-center justify-between px-4 py-2 text-sm edw-toggle"
              >
                <span>{group.label}</span>
                <i aria-hidden className="edw-muted">
                  {open[group.key] ? "▾" : "▸"}
                </i>
              </button>
              {open[group.key] && (
                <ul className="flex flex-col gap-1 px-4 pb-3 text-xs">
                  {group.lines.map((line) => (
                    <li
                      key={line}
                      className="edw-muted break-words"
                      {...(line.includes("待核实")
                        ? { "data-planned": "规划中：上游数据源未落地" }
                        : {})}
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
}