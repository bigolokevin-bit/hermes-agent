/**
 * employee-detail 工作台 pane — lane A stage 2 honest placeholder
 * (PRD v4.1 §7 工作台; skeleton L845/871/2424-2505).
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

import { useState, type ReactNode } from "react";
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

export default function EmployeeDetailWorkbench({
  employeeId,
  renderChatHost,
}: EmployeeDetailWorkbenchProps) {
  const [open, setOpen] = useState<Record<RailGroup["key"], boolean>>({
    id: true,
    budget: true,
    cap: false,
    runs: false,
  });
  const toggle = (key: RailGroup["key"]) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const chatCell: ReactNode =
    employeeId !== "" && renderChatHost !== undefined ? (
      renderChatHost(employeeId)
    ) : (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[16rem] flex-1 flex-col items-start justify-center gap-2 rounded-[var(--r)] border p-5 text-sm edw-panel"
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
    <div className="grid min-w-0 gap-3 lg:grid-cols-[3fr_2fr]">
      <div className="flex min-w-0 flex-col">{chatCell}</div>
      <aside
        className="flex min-w-0 flex-col gap-2"
        aria-label="工作台侧栏"
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
                    className="edw-muted"
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
  );
}
