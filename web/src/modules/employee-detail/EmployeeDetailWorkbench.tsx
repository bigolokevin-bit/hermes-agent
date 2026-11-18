/**
 * employee-detail 工作台 pane — lane A stage 2 honest placeholder
 * (PRD v4.1 §7 工作台; skeleton L845/871/2424-2505).
 *
 * Structure fact kept:
 *  - 60/40 split (.wbshell 3fr/2fr), single column at narrow widths;
 *  - left = the ONLY chat-host cell. The element carrying the [data-chat-host]
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

export interface EmployeeDetailWorkbenchProps {
  employeeId: string;
  /** App-provided element wrapper carrying the data-chat-host contract. */
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
    label: "身份与四道门",
    lines: [
      "身份绑定：待核实（GAP-02 毕升 /api/v1/user/* 未接）",
      "四道门：待核实（GAP-01 聚合端点未落地，unknown ≠ 可上岗）",
      "交集结论：接入前不判定",
    ],
  },
  {
    key: "budget",
    label: "预算",
    lines: [
      "额度/消耗：待核实（金额唯一来源 ledger；估算必须标「预估」）",
      "口径：budget-usage 聚合接入前保持本占位",
    ],
  },
  {
    key: "cap",
    label: "能力",
    lines: ["技能/工具/知识覆盖：待核实（fixture 门 BOUNDARY-12）"],
  },
  {
    key: "runs",
    label: "最近运行",
    lines: ["runs?employee=：接入后显示最近记录；cost 缺失渲染「—」"],
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
        className="flex min-h-[16rem] flex-1 flex-col items-start justify-center gap-2 rounded-[var(--r)] border p-5 text-sm"
        style={{
          background: "var(--panel)",
          borderColor: "var(--line)",
          color: "var(--fg-2)",
        }}
      >
        <span style={{ color: "var(--fg)" }}>Hermes 对话 · 同源挂载点</span>
        <span>
          {employeeId === ""
            ? "缺少员工编号，不建立任何终端连接（绑定之前零连接）。"
            : "生产环境在此 import Hermes ChatPage（同源部署，/api/pty WebSocket）；本壳不自绘消息流。"}
        </span>
        <span className="font-mono text-xs" style={{ color: "var(--fg-3)" }}>
          依赖：同源反代 · PTY 票据 · Profile scope
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
            className="rounded-[var(--r)] border"
            style={{
              background: "var(--panel)",
              borderColor: "var(--line)",
              color: "var(--fg-2)",
            }}
          >
            <button
              type="button"
              onClick={() => toggle(group.key)}
              aria-expanded={open[group.key]}
              className="flex w-full items-center justify-between px-4 py-2 text-sm"
              style={{ color: "var(--fg)", background: "transparent" }}
            >
              <span>{group.label}</span>
              <i aria-hidden style={{ color: "var(--fg-3)" }}>
                {open[group.key] ? "▾" : "▸"}
              </i>
            </button>
            {open[group.key] && (
              <ul className="flex flex-col gap-1 px-4 pb-3 text-xs">
                {group.lines.map((line) => (
                  <li
                    key={line}
                    style={{ color: "var(--fg-3)" }}
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
