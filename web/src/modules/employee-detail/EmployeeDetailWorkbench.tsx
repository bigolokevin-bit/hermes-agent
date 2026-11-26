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
 *  - right = wbrail：20 卡信息轨（EmployeeDetailRail，骨架 detail pane 的
 *    15 张配置/任务/运行/事件卡 + 工作台 4 组 + 版本链卡），卡头一律 11px
 *    微标签；取不到的字段写 —，卡底 11px「缺读口：…」，不编数字、不吃
 *    别人员工的行（unknown ≠ pass，§4 duty law 在这里重复）。
 *
 * When `renderChatHost` is absent (App wiring missing) or the employee id is
 * blank, the left cell degrades to the honest mount-point notice from the
 * skeleton ("生产环境在此 import Hermes ChatPage"), never a blank dead link.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { ChatSessionsMini } from "./ChatSessionsMini";
import { fetchJSON } from "@/lib/api";
import EmployeeDetailRail from "./EmployeeDetailRail";
import "./employee-detail.css";

export interface EmployeeDetailWorkbenchProps {
  employeeId: string;
  /** App-provided element wrapper carrying the chat-host contract. */
  renderChatHost?: (employeeId: string) => ReactNode;
}

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
  /** 生命周期原值（active / draft / suspended …）；读不到就是 null，不猜。 */
  lifecycle: string | null;
}

const EMPTY_HEADER: HeaderInfo = { name: null, role: null, department: null, lifecycle: null };

/**
 * 生命周期词表：只用于「为什么这一屏全是 —」的说明句，不替换字段原值。
 * 未在册的值一律显示原值本身（待核实），不硬翻译。
 */
const LIFECYCLE_COPY: Record<string, string> = {
  draft: "草稿",
  pending: "待启用",
  active: "在岗",
  suspended: "已停用",
  offboarded: "已离职",
  retired: "已归档",
};

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
            lifecycle: pickString(rec.lifecycleState, rec.lifecycle),
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

export default function EmployeeDetailWorkbench({
  employeeId,
  renderChatHost,
}: EmployeeDetailWorkbenchProps) {
  const [chatOnly, setChatOnly] = useState(false);
  // 2026-11-26：上游 ChatPage 的桌面直排分支不带会话列表（只有移动抽屉里
  // 才有 ChatSessionList），所以我们把同一个组件挂到工作台右栏：它自己读写
  // `?resume=<id>`，选中即让对话宿主重开该会话。「新会话」清空该参数。
  const header = useHeaderInfo(employeeId);
  const code = employeeId ? shortCode(employeeId) : "—";
  const title = header.name ? `${header.name} · ${code}` : `员工 · ${code}`;

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
          {/* 全页唯一 h1 是外壳的页面标题「数字员工」；本页标题降为 h2，
              视觉不变（同一组类），标题文本契约仍是「姓名 · 短码」。 */}
          <h2
            className="truncate font-mondwest text-xl"
            data-testid="ed5-workbench-title"
            title={employeeId || undefined}
          >
            {title}
          </h2>
          <p className="flex min-w-0 flex-wrap gap-x-2 text-xs edw-muted">
            <span className="min-w-0">{header.role ?? "岗位待核实"}</span>
            {header.department ? (
              <span className="min-w-0">部门 · {header.department}</span>
            ) : null}
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

      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs edw-muted">
        <button
          type="button"
          onClick={() => setChatOnly((v) => !v)}
          aria-pressed={chatOnly}
          data-testid="ed5-workbench-fullscreen"
          className="ml-auto rounded-[var(--r-sm)] border px-2.5 py-1 text-xs edw-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {chatOnly ? "退出全屏" : "对话全屏"}
        </button>
      </div>

      {/* 未上岗员工的「空」要说清楚：名册里第一条常常是草稿态员工，
          点进来右侧大半是「—」。那不是加载失败，是还没有任何记账与运行。
          这句话只在生命周期不是 active 时出现，在岗员工不受影响。 */}
      {header.lifecycle && header.lifecycle !== "active" ? (
        <p className="edw-write-note" data-testid="ed5-workbench-lifecycle-note">
          该员工当前是「{LIFECYCLE_COPY[header.lifecycle] ?? header.lifecycle}」状态：
          运行、费用、任务等记录尚未产生，右侧的「—」是真实空集，不是加载失败。
          到「配置 → 生命周期」切换到在岗后，这些分区才会开始记账。
        </p>
      ) : null}

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
          className={chatOnly ? "hidden" : "min-w-0"}
          aria-label="工作台侧栏"
          data-testid="ed5-workbench-rail-slot"
        >
          <ChatSessionsMini />
          <EmployeeDetailRail employeeId={employeeId} hidden={chatOnly} />
        </aside>
      </div>
    </section>
  );
}