/**
 * employee-detail 信息轨 — 20 卡骨架密度（2026-11-24）。
 *
 * 视觉基线：tasks/AP-01-pending-truth/web/docs/console-v4-skeleton.html
 * `section[data-mod="employees"] .pane[data-tab="detail"]`（源文件 2086–3047）。
 * 骨架 detail pane 共 20 个 `class="card"`，其中 15 张带 `<h2>` 卡头
 * （基本 / 通信与身份 / 模型路由 / 对话与唤起 / 提示词性格 / 技能挂载 /
 * 工具与 MCP / 知识与范围 / 访问与预算 / 审批策略 / 最近修改 / 派给 /
 * 运行记录 / run 步骤 / 与该员工相关的事件）；本轨把工作台右侧的
 * 4 个折叠组（身份与四道门 / 预算 / 能力 / 最近运行）与 15 张配置卡、
 * 1 张版本链卡并成 20 张同形制卡，卡头一律走 ConsoleCard 的 11px 微标签。
 *
 * 数据纪律（本轨最重要的一条）：
 *  - 每个字段只从真读口取值；取不到写 `—`，并在卡底 11px「缺读口：…」
 *    写明是哪个读口、什么代次原因。禁编数字、禁 data-fixture。
 *  - 按员工过滤要如实：`/api/matrix` 与 `/api/approvals` 本代次忽略
 *    employee 参数（实测），所以本轨按 employeeId / requestedBy 于前端
 *    匹配，并把「服务端未过滤、本卡前端匹配」写进卡内小字，绝不把
 *    全量读成「该员工的」。
 *  - 全页唯一个 `<h1>` 在工作台头部；卡头是 span 微标签，不是 heading。
 *  - 全页唯一 `role="tablist"` 是外壳 zone 条：本轨只有按钮与 `<Link>`。
 *  - 不许三层套框：一张卡 + 卡体；卡体内部只用 dl 行 / 分隔线 / 行列表。
 */

import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { ConsoleCard } from "@/components/console/ConsoleCard";
import { Pill, type PillTone } from "@/components/console/Pill";
import { fetchJSON } from "@/lib/api";
import "./employee-detail.css";

/* ------------------------------------------------------------------ *
 * small value helpers — 每个取值都允许缺，缺就是 null，不补默认数
 * ------------------------------------------------------------------ */

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => Boolean(v) && typeof v === "object" && !Array.isArray(v);

function rec(v: unknown): Rec | null {
  return isRec(v) ? v : null;
}

function listOf(v: unknown): Rec[] {
  if (Array.isArray(v)) return v.filter(isRec);
  const items = rec(v)?.items;
  return Array.isArray(items) ? items.filter(isRec) : [];
}

function s(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function n(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function strs(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x !== "") : [];
}

const DASH = "—";

function fmtInt(v: number | null): string {
  return v === null ? DASH : v.toLocaleString("en-US");
}

function fmtUsd(v: number | null): string {
  return v === null ? DASH : `$${v.toFixed(2)}`;
}

/** ISO → 北京时间的 `MM-DD HH:mm`；非法/缺失一律 `—`（不拿本机时钟补）。 */
function fmtWhen(v: unknown): string {
  const iso = s(v);
  if (!iso || Number.isNaN(Date.parse(iso))) return DASH;
  const d = new Date(Date.parse(iso) + 480 * 60_000);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** 工程串只取短尾码，不把整串 uuid 铺到卡里（可悬停看原文）。 */
function shortRef(v: unknown): string {
  const raw = s(v);
  if (!raw) return DASH;
  const tail = raw.replace(/^[a-z]+_/i, "");
  return tail.slice(0, 8).toUpperCase() || DASH;
}

function durationLabel(startedAt: unknown, endedAt: unknown): string {
  const a = s(startedAt);
  const b = s(endedAt);
  if (!a || !b) return DASH;
  const from = Date.parse(a);
  const to = Date.parse(b);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return DASH;
  const sec = Math.round((to - from) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

const LIFECYCLE: Record<string, string> = {
  active: "在岗",
  draft: "草稿",
  suspended: "停用",
  disabled: "停用",
  archived: "归档",
};

function lifecycleLabel(v: string | null): string {
  if (!v) return DASH;
  return LIFECYCLE[v] ?? v;
}

const RUN_STATUS: Record<string, { label: string; tone: PillTone }> = {
  running: { label: "运行中", tone: "warn" },
  completed: { label: "已完成", tone: "ok" },
  success: { label: "已完成", tone: "ok" },
  failed: { label: "失败", tone: "bad" },
  cancelled: { label: "已取消", tone: "mut" },
  pending: { label: "排队中", tone: "mut" },
  queued: { label: "排队中", tone: "mut" },
  interrupted: { label: "中断", tone: "bad" },
};

function runStatus(v: string | null): { label: string; tone: PillTone } {
  if (!v) return { label: DASH, tone: "mut" };
  return RUN_STATUS[v] ?? { label: v, tone: "mut" };
}

const TASK_STATUS: Record<string, string> = {
  open: "待开始",
  in_progress: "进行中",
  running: "进行中",
  done: "完成",
  completed: "完成",
  blocked: "阻塞",
  cancelled: "已取消",
};

const APPROVAL_STATUS: Record<string, { label: string; tone: PillTone }> = {
  pending: { label: "待批", tone: "warn" },
  approved: { label: "已批", tone: "ok" },
  rejected: { label: "驳回", tone: "bad" },
  expired: { label: "过期", tone: "mut" },
};

const OUTCOME: Record<string, { label: string; tone: PillTone }> = {
  success: { label: "成功", tone: "ok" },
  failure: { label: "失败", tone: "bad" },
  denied: { label: "拒绝", tone: "bad" },
  pending: { label: "待定", tone: "warn" },
};

/** responsePolicy.fallback 的四个原因码 → 人话；未识别照写原始码。 */
const FALLBACK: Record<string, string> = {
  deny_with_guidance: "拒绝并给指引",
  ask_clarifying: "先澄清再答",
  explain_and_escalate: "解释并升级",
  denied_with_notification: "拒绝并通知",
  deny: "拒绝",
};

const TRIGGER: Record<string, string> = {
  mention: "@ 提及",
  dm: "私聊",
  all: "全部消息",
  command: "指令",
};

/* ------------------------------------------------------------------ *
 * read layer — 一次并发读，逐源记失败原因（缺读口按源点名）
 * ------------------------------------------------------------------ */

interface Dossier {
  done: boolean;
  emp: Rec | null;
  cfg: Rec | null;
  version: Rec | null;
  versions: Rec[];
  matrix: Rec | null;
  skills: Rec[] | null;
  tools: Rec[] | null;
  mcp: Rec[] | null;
  runs: Rec[];
  tasks: Rec[];
  approvals: Rec[];
  events: Rec[];
  auditTotal: number | null;
  statsDay: Rec | null;
  usageMonth: Rec | null;
  usageDay: Rec | null;
  fails: Record<string, string>;
}

const EMPTY_DOSSIER: Dossier = {
  done: false,
  emp: null,
  cfg: null,
  version: null,
  versions: [],
  matrix: null,
  skills: null,
  tools: null,
  mcp: null,
  runs: [],
  tasks: [],
  approvals: [],
  events: [],
  auditTotal: null,
  statsDay: null,
  usageMonth: null,
  usageDay: null,
  fails: {},
};

/** 失败原因写成一句可读的短句：`502 上游不可用` / `404 未接线` / `网络不可达`。 */
function failNote(reason: unknown): string {
  const r = rec(reason);
  const status = n(r?.status);
  const code = s(r?.code);
  if (status !== null) return code ? `${status} ${code}` : `${status}`;
  return "不可达";
}

interface Periods {
  day: string;
  month: string;
  fromDay: string;
  toDay: string;
  fromMonth: string;
  toMonth: string;
}

/** 周期只决定「问服务端哪一天/哪一月」；页面上所有时间仍取自服务端回包。 */
function periods(): Periods {
  const bj = new Date(Date.now() + 480 * 60_000);
  const day = bj.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const y = Number(day.slice(0, 4));
  const mo = Number(day.slice(5, 7));
  const d = Number(day.slice(8, 10));
  return {
    day,
    month,
    fromDay: new Date(Date.UTC(y, mo - 1, d)).toISOString(),
    toDay: new Date(Date.UTC(y, mo - 1, d + 1)).toISOString(),
    fromMonth: new Date(Date.UTC(y, mo - 1, 1)).toISOString(),
    toMonth: new Date(Date.UTC(y, mo, 1)).toISOString(),
  };
}

function useDossier(employeeId: string): Dossier {
  const [state, setState] = useState<Dossier>(EMPTY_DOSSIER);

  useEffect(() => {
    if (!employeeId) {
      setState({ ...EMPTY_DOSSIER, done: true });
      return;
    }
    let alive = true;
    setState(EMPTY_DOSSIER);
    const enc = encodeURIComponent(employeeId);
    const p = periods();
    const reqs: Array<[string, string]> = [
      ["emp", `/agent-api/api/employees/${enc}`],
      ["cfg", `/agent-api/api/effective-config?id=${enc}`],
      ["vers", `/agent-api/api/employee-versions?id=${enc}`],
      ["matrix", `/agent-api/api/matrix?employee=${enc}`],
      ["skills", "/agent-api/api/skills"],
      ["tools", "/agent-api/api/tools"],
      ["mcp", "/agent-api/api/mcp/servers"],
      ["runs", `/agent-api/api/runs?employeeId=${enc}&limit=12`],
      ["statsDay", `/agent-api/api/run-stats?employeeId=${enc}&from=${p.fromDay}&to=${p.toDay}&bucket=day`],
      ["usageDay", `/agent-api/api/budget-usage?employeeId=${enc}&periodKind=day&period=${p.day}`],
      ["usageMonth", `/agent-api/api/budget-usage?employeeId=${enc}&periodKind=month&period=${p.month}`],
      ["tasks", `/agent-api/api/tasks?assignee=${encodeURIComponent(`employee:${employeeId}`)}&limit=20`],
      ["approvals", "/agent-api/api/approvals?status=all&limit=20"],
      ["events", `/agent-api/api/audit?resourceId=${enc}&limit=50`],
    ];

    void Promise.allSettled(reqs.map(([, url]) => fetchJSON<unknown>(url))).then((results) => {
      if (!alive) return;
      const bodies: Record<string, unknown> = {};
      const fails: Record<string, string> = {};
      results.forEach((res, i) => {
        const key = reqs[i][0];
        if (res.status === "fulfilled") bodies[key] = res.value;
        else fails[key] = failNote(res.reason);
      });

      const cfg = rec(bodies.cfg);
      const cfgEmployee = rec(cfg?.employee);
      const cfgVersion = rec(cfg?.version);
      const versionRows = listOf(bodies.vers);
      const currentVersion =
        cfgVersion ??
        versionRows.find((row) => s(row.id) === s(rec(bodies.emp)?.currentVersionId)) ??
        versionRows[0] ??
        null;
      // matrix 本代次忽略 employee 参数（实测三行全量）：这里按 employeeId 于前端匹配，
      // 匹配不到就是 null（不拿别人员工的行冒充）。
      const matrixRow =
        listOf(bodies.matrix).find(
          (row) => s(row.employeeId, row.employee_id, row.id) === employeeId,
        ) ?? null;
      const auditBody = rec(bodies.events);

      setState({
        done: true,
        emp: rec(bodies.emp) ?? cfgEmployee,
        cfg,
        version: currentVersion,
        versions: versionRows,
        matrix: matrixRow,
        skills: "skills" in bodies ? listOf(bodies.skills) : null,
        tools: "tools" in bodies ? listOf(bodies.tools) : null,
        mcp: "mcp" in bodies ? listOf(bodies.mcp) : null,
        runs: listOf(bodies.runs),
        tasks: listOf(bodies.tasks),
        approvals: listOf(bodies.approvals),
        events: Array.isArray(auditBody?.events) ? (auditBody.events as unknown[]).filter(isRec) : [],
        auditTotal: n(auditBody?.total),
        statsDay: rec(bodies.statsDay),
        usageDay: rec(bodies.usageDay),
        usageMonth: rec(bodies.usageMonth),
        fails,
      });
    });

    return () => {
      alive = false;
    };
  }, [employeeId]);

  return state;
}

/* ------------------------------------------------------------------ *
 * card atoms — 一卡一表体；卡内只有 dl 行 / 分隔线 / 行列表
 * ------------------------------------------------------------------ */

function RailKv({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="console-kv">
      {rows.map(([k, v]) => (
        <div key={k} className="edw-rail-pair">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function RailRows({
  rows,
  empty,
}: {
  rows: Array<{ main: ReactNode; aside?: ReactNode; title?: string }>;
  empty: string;
}) {
  if (rows.length === 0) return <p className="edw-rail-missing">{empty}</p>;
  return (
    <ul className="edw-rail-list">
      {rows.map((row, i) => (
        <li key={`${i}-${row.title ?? ""}`} title={row.title}>
          <span className="edw-rail-main">{row.main}</span>
          {row.aside ? <span className="edw-rail-aside">{row.aside}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function Missing({ children }: { children: ReactNode }) {
  return <p className="edw-rail-missing">缺读口：{children}</p>;
}

function Meter({ label, value, cap, money }: { label: string; value: number | null; cap: number | null; money: boolean }) {
  const pct = value !== null && cap !== null && cap > 0 ? Math.min(100, Math.round((value / cap) * 100)) : null;
  return (
    <div className="console-bar edw-rail-meter">
      <span>{label}</span>
      <span className="console-bar__track">
        {pct !== null ? <i className={pct >= 100 ? "tone-bad" : pct >= 80 ? "tone-warn" : "tone-ok"} style={{ width: `${pct}%` }} /> : null}
      </span>
      <span className="console-bar__value">
        {money ? fmtUsd(value) : fmtInt(value)}
        {cap === null ? "" : money ? ` / $${cap.toFixed(2)}` : ` / ${fmtInt(cap)}`}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * card registry — 20 卡，顺序照骨架 detail pane 自上而下
 * ------------------------------------------------------------------ */

type CardId =
  | "id"
  | "budget"
  | "cap"
  | "recentRuns"
  | "facts"
  | "comms"
  | "route"
  | "talk"
  | "soul"
  | "skills"
  | "tools"
  | "knowledge"
  | "access"
  | "approval"
  | "versions"
  | "changes"
  | "tasks"
  | "runs"
  | "steps"
  | "events";

const RAIL_CARD_IDS: readonly CardId[] = [
  "id",
  "budget",
  "cap",
  "recentRuns",
  "facts",
  "comms",
  "route",
  "talk",
  "soul",
  "skills",
  "tools",
  "knowledge",
  "access",
  "approval",
  "versions",
  "changes",
  "tasks",
  "runs",
  "steps",
  "events",
];

/* ------------------------------------------------------------------ *
 * rail
 * ------------------------------------------------------------------ */

export interface EmployeeDetailRailProps {
  employeeId: string;
  /** 工作台把「对话全屏」状态带下来：全屏时整条信息轨不占位。 */
  hidden?: boolean;
}

export function EmployeeDetailRail({ employeeId, hidden }: EmployeeDetailRailProps) {
  const d = useDossier(employeeId);
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    // 契约：375 信息轨默认收起（整条 + 每张卡）；桌面维持 20 卡展开的密度档。
    const wide =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 1024px)").matches;
    return Object.fromEntries(RAIL_CARD_IDS.map((id) => [id, wide]));
  });
  const allOpen = RAIL_CARD_IDS.every((id) => open[id]);
  const toggle = (id: CardId) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleAll = () =>
    setOpen(Object.fromEntries(RAIL_CARD_IDS.map((id) => [id, !allOpen])));
  const enc = encodeURIComponent(employeeId || "_");

  const emp = d.emp;
  const version = d.version;
  const budget = rec(version?.budget);
  const policy = rec(version?.responsePolicy);
  const loopGuard = rec(policy?.loopGuard);
  const fallback = rec(policy?.fallback);
  const memoryScope = rec(version?.memoryScope);
  const knowledgeScopes = strs(version?.knowledgeScopes);
  const skillRefs = strs(version?.skillRefs);
  const grants = Array.isArray(d.cfg?.grants) ? (d.cfg.grants as unknown[]).filter(isRec) : [];
  const channelGrants = grants.filter((g) => s(g.scopeType) === "channel");
  const grantedWithApproval = grants.filter((g) => Boolean(s(g.approvalRef)));
  const statsTotals = rec(d.statsDay?.totals);
  const dayRow = rec((Array.isArray(d.usageDay?.items) ? d.usageDay.items : []).filter(isRec)[0]);
  const monthRow = rec((Array.isArray(d.usageMonth?.items) ? d.usageMonth.items : []).filter(isRec)[0]);
  const dayCost = n(dayRow?.costUsd, dayRow?.cost_usd);
  const monthCost = n(monthRow?.costUsd, monthRow?.cost_usd);
  const myApprovals = d.approvals.filter(
    (row) => s(rec(row.requestedBy)?.id) === employeeId,
  );
  const latestRun = d.runs[0] ?? null;

  /** 每张卡的卡头：11px 微标签 + 右端 meta / 真链接。 */
  const card = (
    id: CardId,
    label: string,
    meta: ReactNode,
    action: ReactNode,
    body: ReactNode,
  ) => (
    <ConsoleCard
      key={id}
      data-testid={`edr-card-${id}`}
      label={
        <button
          type="button"
          onClick={() => toggle(id)}
          aria-expanded={open[id]}
          data-testid={`edr-toggle-${id}`}
          className="edw-rail-toggle"
        >
          <span>{label}</span>
          <i aria-hidden className="edw-rail-chev">
            {open[id] ? "▾" : "▸"}
          </i>
        </button>
      }
      action={
        <span className="edw-rail-actions">
          {meta ? <span className="edw-rail-meta">{meta}</span> : null}
          {action}
        </span>
      }
    >
      {open[id] ? <div data-testid={`edr-body-${id}`}>{body}</div> : null}
    </ConsoleCard>
  );

  const link = (to: string, text: string, title?: string) => (
    <Link to={to} className="edw-rail-link" title={title}>
      {text}
    </Link>
  );

  const fail = (key: string) => d.fails[key];

  return (
    <aside
      className={hidden ? "hidden" : "flex min-w-0 flex-col gap-2"}
      aria-label="工作台侧栏 · 20 卡档案信息轨"
      data-testid="ed5-workbench-rail"
      data-card-count={RAIL_CARD_IDS.length}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="text-xs edw-muted" data-testid="ed5-workbench-rail-title">
          档案信息轨 · {RAIL_CARD_IDS.length} 卡{d.done ? "" : " · 读取中…"}
        </span>
        <button
          type="button"
          onClick={toggleAll}
          aria-expanded={allOpen}
          data-testid="ed5-workbench-rail-all"
          className="rounded-[var(--r-sm)] border px-2 py-0.5 text-xs edw-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {allOpen ? "全部收起" : "全部展开"}
        </button>
      </div>

      {/* 1 身份与四道门 */}
      {card(
        "id",
        "身份与四道门",
        lifecycleLabel(s(emp?.lifecycleState)),
        link(`/employees/${enc}?zone=capability`, "去配置 →", "访问与能力的真数据面"),
        <>
          <RailKv
            rows={[
              ["姓名", s(emp?.name) ?? DASH],
              ["工号", <span className="edw-rail-mono" title={employeeId}>{shortRef(employeeId)}</span>],
              ["部门", s(emp?.department) ?? DASH],
              ["岗位", s(emp?.title, emp?.duty) ?? DASH],
              ["负责人", s(emp?.ownerUserId) ? `账号 ${s(emp?.ownerUserId)}` : DASH],
              ["生命周期", lifecycleLabel(s(emp?.lifecycleState))],
            ]}
          />
          <div className="console-divider" />
          <RailKv
            rows={[
              ["四道门", DASH],
              ["门禁结论", "核实前不判定"],
            ]}
          />
          <Missing>门禁判定（V1/V2/V3/V6）本代次未提供读口；四道门各自独立判定，未核实不判可上岗</Missing>
        </>,
      )}

      {/* 2 预算 */}
      {card(
        "budget",
        "预算",
        s(version?.versionNo) ? `v${s(version?.versionNo)} 额度` : DASH,
        link(`/employees/${enc}?zone=usage`, "成本 →", "预算账本 + 运行统计只读聚合"),
        <>
          <div className="flex flex-col gap-2">
            <Meter label="今日" value={dayCost} cap={null} money />
            <Meter label="本月" value={monthCost} cap={n(budget?.monthlyCostUsd)} money />
          </div>
          <div className="console-divider" />
          <RailKv
            rows={[
              ["日 token 上限", fmtInt(n(budget?.dailyTokens))],
              ["月成本上限", fmtUsd(n(budget?.monthlyCostUsd))],
              ["单次上限", fmtUsd(n(budget?.perRunMaxUsd))],
              ["今日运行", fmtInt(n(statsTotals?.runs))],
            ]}
          />
          {dayCost === null || monthCost === null ? (
            <Missing>
              实扣金额（
              {dayCost === null ? "今日" : ""}
              {dayCost === null && monthCost === null ? " / " : ""}
              {monthCost === null ? "本月" : ""}
              无该员工行，missingEmployeeIds 实证；缺行不作 $0.00）
            </Missing>
          ) : null}
          {fail("usageDay") || fail("usageMonth") ? (
            <Missing>预算账本 {fail("usageDay") ?? fail("usageMonth")}</Missing>
          ) : null}
        </>,
      )}

      {/* 3 能力 */}
      {card(
        "cap",
        "能力",
        n(d.matrix?.skillCount) !== null ? `${s(d.matrix?.skillCount)} 技能` : DASH,
        link(`/employees/${enc}?zone=capability`, "能力 →", "员工 × 技能的覆盖面"),
        <>
          <RailKv
            rows={[
              ["挂载技能", fmtInt(n(d.matrix?.skillCount) ?? skillRefs.length)],
              ["技能目录", d.skills === null ? DASH : `${d.skills.length} 条`],
              ["知识分区", `${knowledgeScopes.length} 个`],
              ["工具 / MCP", DASH],
            ]}
          />
          {d.skills === null ? <Missing>/api/skills {fail("skills")}</Missing> : null}
          {fail("tools") ? <Missing>/api/tools {fail("tools")}（诚实不可用信封）</Missing> : null}
          {fail("mcp") ? <Missing>/api/mcp/servers {fail("mcp")}</Missing> : null}
        </>,
      )}

      {/* 4 最近运行 */}
      {card(
        "recentRuns",
        "最近运行",
        `${d.runs.length} 条`,
        link(`/employees/${enc}?zone=runs`, "看全部 →"),
        <RailRows
          empty="该员工没有运行记录（按 employeeId 真过滤，非加载失败）"
          rows={d.runs.slice(0, 4).map((run) => ({
            main: `运行 · ${shortRef(run.runId ?? run.id)}`,
            aside: (
              <Pill tone={runStatus(s(run.status)).tone} dot={false}>
                {runStatus(s(run.status)).label}
              </Pill>
            ),
            title: s(run.runId) ?? undefined,
          }))}
        />,
      )}

      {/* 5 基本 */}
      {card(
        "facts",
        "基本",
        `修订 ${s(emp?.revision) ?? DASH}`,
        link(`/employees/${enc}?zone=overview`, "概览 →"),
        <>
          <RailKv
            rows={[
              ["名称", s(emp?.name) ?? DASH],
              ["工号", <span className="edw-rail-mono" title={employeeId}>{shortRef(employeeId)}</span>],
              ["部门", s(emp?.department) ?? DASH],
              ["岗位", s(emp?.title, emp?.duty) ?? DASH],
              ["时区", DASH],
              ["语言", DASH],
              ["创建时间", fmtWhen(emp?.createdAt)],
              ["最近更新", fmtWhen(emp?.updatedAt)],
            ]}
          />
          <Missing>时区 / 语言（员工读口未回传这两个字段）</Missing>
        </>,
      )}

      {/* 6 通信与身份 */}
      {card(
        "comms",
        "通信与身份",
        `${channelGrants.length} 条通信授予`,
        link("/capabilities?tab=channels", "渠道 →", "平台接入与发送回执在这里维护"),
        <>
          <RailRows
            empty="—（该员工没有 channel 类授予）"
            rows={channelGrants.map((g) => {
              const selector = rec(g.resourceSelector);
              const types = strs(selector?.types) ;
              const single = s(selector?.type);
              return {
                main: `${types.join("/") || single || s(g.scopeType) || DASH} · ${strs(g.actions).join("/") || DASH}`,
                aside: `${s(g.source) ?? DASH}${s(g.expiresAt) ? ` · 至 ${fmtWhen(g.expiresAt)}` : ""}`,
                title: s(g.id) ?? undefined,
              };
            })}
          />
          <div className="console-divider" />
          <RailKv
            rows={[
              ["App ID / 凭据", DASH],
              ["权限清单", DASH],
              ["负责人绑定", s(emp?.ownerUserId) ? `账号 ${s(emp?.ownerUserId)}` : DASH],
            ]}
          />
          <Missing>员工通信绑定与飞书权限清单（本代次无读口；授予只来自 effective-config 的 grant 账本）</Missing>
        </>,
      )}

      {/* 7 模型路由 */}
      {card(
        "route",
        "模型路由",
        DASH,
        link("/capabilities?tab=models", "模型 →"),
        <>
          <RailKv
            rows={[
              ["主模型", DASH],
              ["备用模型", DASH],
              ["温度", DASH],
              ["最大输出 token", DASH],
              ["单次超时", DASH],
              ["失败重试", DASH],
            ]}
          />
          <Missing>模型路由（员工读口与 effective-config 均未回传模型字段；不猜当前路由）</Missing>
        </>,
      )}

      {/* 8 对话与唤起 */}
      {card(
        "talk",
        "对话与唤起",
        strs(policy?.triggers).length ? `${strs(policy?.triggers).map((t) => TRIGGER[t] ?? t).join(" · ")}` : DASH,
        link(`/employees/${enc}?zone=approvals`, "策略 →", "拉起策略落在审批/门禁面"),
        <>
          <RailKv
            rows={[
              ["触发方式", strs(policy?.triggers).map((t) => TRIGGER[t] ?? t).join(" · ") || DASH],
              ["响应模式", s(policy?.mode) ?? DASH],
              ["单次最大轮次", fmtInt(n(loopGuard?.maxTurnsPerConversation))],
              ["单次最多工具调用", fmtInt(n(loopGuard?.maxToolCallsPerRun))],
            ]}
          />
          <div className="console-divider" />
          <RailKv
            rows={[
              ["未知发送者", FALLBACK[s(fallback?.onUnknownSender) ?? ""] ?? s(fallback?.onUnknownSender) ?? DASH],
              ["低置信", FALLBACK[s(fallback?.onLowConfidence) ?? ""] ?? s(fallback?.onLowConfidence) ?? DASH],
              ["策略拒绝", FALLBACK[s(fallback?.onPolicyDeny) ?? ""] ?? s(fallback?.onPolicyDeny) ?? DASH],
              ["预算耗尽", FALLBACK[s(fallback?.onBudgetExhausted) ?? ""] ?? s(fallback?.onBudgetExhausted) ?? DASH],
            ]}
          />
          {!policy ? <Missing>响应策略（当前版本未回传 responsePolicy）</Missing> : null}
        </>,
      )}

      {/* 9 提示词性格 */}
      {card(
        "soul",
        "提示词性格",
        "SOUL · 影响所有会话",
        null,
        <>
          <p className="edw-rail-prose" title={s(version?.jobDescription) ?? undefined}>
            {s(version?.jobDescription) ?? DASH}
          </p>
          <div className="console-divider" />
          <RailKv
            rows={[
              ["语气", DASH],
              ["回复长度", DASH],
              ["禁止项", DASH],
            ]}
          />
          <Missing>性格字段（人设取当前版本岗位说明；语气/长度/禁止项未随读口回传）</Missing>
        </>,
      )}

      {/* 10 技能挂载 */}
      {card(
        "skills",
        "技能挂载",
        `${skillRefs.length} 项已挂载`,
        link(`/employees/${enc}?zone=capability`, "能力 →"),
        <>
          <RailRows
            empty="当前版本没有挂载任何技能（skillRefs 为空集，非加载失败）"
            rows={skillRefs.map((ref) => ({ main: ref, aside: "已挂载", title: ref }))}
          />
          <div className="console-divider" />
          <RailKv rows={[["技能目录", d.skills === null ? DASH : `${d.skills.length} 条`]]} />
          {d.skills === null ? <Missing>/api/skills {fail("skills")}</Missing> : null}
        </>,
      )}

      {/* 11 工具与 MCP */}
      {card(
        "tools",
        "工具与 MCP",
        "读口未接线",
        link("/capabilities?tab=tools", "工具 →"),
        <>
          <RailKv
            rows={[
              ["内置工具", DASH],
              ["MCP 服务器", DASH],
            ]}
          />
          <Missing>/api/tools {fail("tools") ?? DASH}（登记上游探测未获真数据）</Missing>
          <Missing>/api/mcp/servers {fail("mcp") ?? DASH}</Missing>
        </>,
      )}

      {/* 12 知识与范围 */}
      {card(
        "knowledge",
        "知识与范围",
        `${knowledgeScopes.length} 分区`,
        link("/knowledge", "知识 →"),
        <>
          <RailRows
            empty="当前版本没有声明知识分区（knowledgeScopes 为空集）"
            rows={knowledgeScopes.map((scope) => ({ main: scope, aside: "只读", title: scope }))}
          />
          <div className="console-divider" />
          <RailKv
            rows={[
              ["记忆范围", memoryScope?.employeeScope === true ? "员工级" : DASH],
              ["保留天数", fmtInt(n(memoryScope?.retentionDays))],
            ]}
          />
          {!memoryScope ? <Missing>记忆范围（当前版本未回传 memoryScope）</Missing> : null}
        </>,
      )}

      {/* 13 访问与预算 */}
      {card(
        "access",
        "访问与预算",
        `${grants.length} 条授予`,
        link(`/employees/${enc}?zone=usage`, "成本 →"),
        <>
          <RailRows
            empty="—（有效配置里没有授予行）"
            rows={grants.map((g) => ({
              main: `${s(g.scopeType) ?? DASH} · ${strs(g.actions).join("/") || DASH}`,
              aside: `${s(g.source) ?? DASH}${s(g.expiresAt) ? ` · 至 ${fmtWhen(g.expiresAt)}` : ""}`,
              title: s(g.id) ?? undefined,
            }))}
          />
          <div className="console-divider" />
          <RailKv
            rows={[
              ["日 token 上限", fmtInt(n(budget?.dailyTokens))],
              ["月成本上限", fmtUsd(n(budget?.monthlyCostUsd))],
              ["单次上限", fmtUsd(n(budget?.perRunMaxUsd))],
            ]}
          />
          {fail("cfg") ? <Missing>有效配置 {fail("cfg")}</Missing> : null}
        </>,
      )}

      {/* 14 审批策略 */}
      {card(
        "approval",
        "审批策略",
        `${myApprovals.length} 条本人员工审批`,
        link("/approvals?status=all", "队列 →"),
        <>
          <RailRows
            empty="该员工没有审批请求（按 requestedBy 于本页匹配，非服务端过滤）"
            rows={myApprovals.slice(0, 6).map((row) => {
              const st = APPROVAL_STATUS[s(row.status) ?? ""] ?? { label: s(row.status) ?? DASH, tone: "mut" as PillTone };
              return {
                main: s(row.action) ?? DASH,
                aside: (
                  <Pill tone={st.tone} dot={false}>
                    {st.label}
                  </Pill>
                ),
                title: s(row.approvalId) ?? undefined,
              };
            })}
          />
          <div className="console-divider" />
          <RailKv
            rows={[
              ["带审批引用的授予", `${grantedWithApproval.length} 条`],
              ["风险档", DASH],
            ]}
          />
          <p className="edw-rail-missing">
            口径：审批读口不按员工过滤（实测），本卡按 requestedBy 于本页匹配自全量 20 条
          </p>
        </>,
      )}

      {/* 15 版本链 */}
      {card(
        "versions",
        "版本链",
        s(version?.versionNo) ? `v${s(version?.versionNo)} 已生效` : DASH,
        null,
        <>
          <RailKv
            rows={[
              ["已生效版本", s(version?.versionNo) ? `v${s(version?.versionNo)}` : DASH],
              ["生效时间", fmtWhen(version?.effectiveFrom)],
              ["版本号", <span className="edw-rail-mono" title={s(version?.id) ?? undefined}>{shortRef(version?.id)}</span>],
              ["策略快照", <span className="edw-rail-mono" title={s(d.cfg?.snapshotRef) ?? undefined}>{shortRef(d.cfg?.snapshotRef)}</span>],
              ["草稿", DASH],
            ]}
          />
          <Missing>草稿 / 待发布版本（写接口未接入；本页只读已生效版本）</Missing>
        </>,
      )}

      {/* 16 最近修改 */}
      {card(
        "changes",
        "最近修改",
        `${Math.max(0, d.versions.length - 1)} 次版本变更`,
        link(`/employees/${enc}?zone=audit`, "审计 →"),
        <RailRows
          empty="—（版本读口没有回传任何版本）"
          rows={d.versions.slice(0, 5).map((v) => ({
            main: `v${s(v.versionNo) ?? DASH} · ${s(v.changeNote) ?? "（无变更说明）"}`,
            aside: fmtWhen(v.effectiveFrom),
            title: s(v.changeNote) ?? undefined,
          }))}
        />,
      )}

      {/* 17 派给的任务 */}
      {card(
        "tasks",
        "派给的任务",
        `${d.tasks.length} 条`,
        link(`/employees/${enc}?zone=tasklist`, "任务 →"),
        <RailRows
          empty="该员工没有被派发的任务（assignee=employee:<id> 真过滤）"
          rows={d.tasks.slice(0, 6).map((task) => ({
            main: s(task.title) ?? DASH,
            aside: s(task.status) ? (TASK_STATUS[s(task.status)!] ?? s(task.status)) : DASH,
            title: s(task.taskId) ?? undefined,
          }))}
        />,
      )}

      {/* 18 运行记录 */}
      {card(
        "runs",
        "运行记录",
        `今日 ${fmtInt(n(statsTotals?.runs))} · 列表 ${d.runs.length}`,
        link(`/employees/${enc}?zone=runs`, "运行 →"),
        <RailRows
          empty="该员工没有运行记录（按 employeeId 真过滤）"
          rows={d.runs.slice(0, 6).map((run) => ({
            main: (
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="edw-rail-mono">{shortRef(run.runId ?? run.id)}</span>
                <span className="edw-rail-dim">{durationLabel(run.startedAt, run.endedAt)}</span>
              </span>
            ),
            aside: (
              <Pill tone={runStatus(s(run.status)).tone} dot={false}>
                {runStatus(s(run.status)).label}
              </Pill>
            ),
            title: s(run.runId) ?? undefined,
          }))}
        />,
      )}

      {/* 19 run 步骤 */}
      {card(
        "steps",
        "run 步骤",
        latestRun ? shortRef(latestRun.runId ?? latestRun.id) : DASH,
        null,
        <>
          <RailKv
            rows={[
              ["样本运行", latestRun ? shortRef(latestRun.runId ?? latestRun.id) : DASH],
              ["状态", latestRun ? runStatus(s(latestRun.status)).label : DASH],
              ["耗时", latestRun ? durationLabel(latestRun.startedAt, latestRun.endedAt) : DASH],
              ["步骤明细", DASH],
            ]}
          />
          <Missing>单次运行步骤（/api/runs 只回运行头，不含 steps；步骤读口未接入）</Missing>
        </>,
      )}

      {/* 20 与该员工相关的事件 */}
      {card(
        "events",
        "与该员工相关的事件",
        `${d.auditTotal ?? d.events.length} 条`,
        link(`/employees/${enc}?zone=audit`, "审计 →"),
        <RailRows
          empty="该员工没有审计事件（resourceId 真过滤）"
          rows={d.events.slice(0, 8).map((ev) => {
            const oc = OUTCOME[s(ev.outcome) ?? ""] ?? { label: s(ev.outcome) ?? DASH, tone: "mut" as PillTone };
            return {
              main: (
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="edw-rail-dim">{fmtWhen(ev.occurredAt)}</span>
                  <span className="edw-rail-mono">{s(ev.action) ?? DASH}</span>
                </span>
              ),
              aside: (
                <Pill tone={oc.tone} dot={false}>
                  {oc.label}
                </Pill>
              ),
              title: s(ev.eventId) ?? undefined,
            };
          })}
        />,
      )}
    </aside>
  );
}

export default EmployeeDetailRail;