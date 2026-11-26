/**
 * T18 · employee detail module page — five shell zones (工作台 / 配置 / 任务 /
 * 运行 / 证据), navigation-collapsed per the 2026-11-24 user complaint.
 *
 * Mount path: `shell/bridge.ts` probes `../modules/employee-detail/
 * EmployeeDetailModulePage.tsx` first (candidate 1 of DetailModulePage);
 * when this file exists, `ConsoleEmployeeDetailPage` renders it below the
 * shell zone strip and it owns the whole detail pane. The manifest stays
 * `kind: 'planned'` on purpose — the registry has no detail render path and
 * flipping it could break registry snapshot tests (assumption recorded in
 * manifest.ts and docs/_artifacts/emp-detail/DONE.md).
 *
 * 2026-11-26 导航收口（用户原话：「把 tab 项统一到上面那一行去吧；配置这边
 * 做竖向排布的左侧侧边栏」）：
 *  - 模块内原先的两排导航（SEGMENTS「分区」条 + 两处「小节」锚点条 +
 *    AnchorChip）全部删除。全页唯一 role="tablist" 是外壳 zone 条；本文件
 *    不再出现任何 tab 角色。
 *  - 外壳五格各自落到真内容：`?zone=workbench|config|tasks|runs|evidence`；
 *    历史拼写按别名兼容：capability→config（能力节）、tasklist→tasks、
 *    usage→runs、approvals/audit→evidence（对应小节）、overview/chat→workbench、
 *    sessions→evidence（会话节）。未知 `?zone=zzz` 落工作台并声明一句
 *    「未识别的分区，已回到工作台」，不留空白。
 *  - 配置与证据两区用左侧竖向 `<nav>` 分类栏（普通按钮 + aria-current，
 *    不是 tablist）；375 收进「分类」下拉（ConsoleSelect），绝不横向成排。
 *  - 每个分类一节、每节都有真读口与失败回落：4xx/5xx 显示「未接/不可用」
 *    + 上游 code，缺值「—」且同一缺失只声明一次；禁 data-fixture、禁假 0。
 *
 * Data-source reuse (lint-reuse R4):
 *   reuse: /api/matrix、/api/effective-config、/api/employee-versions、
 *   /api/workstations、/api/knowledge/{spaces,documents}、/api/skills、
 *   /api/tools、/api/mcp/servers、/api/budget-usage、/api/runs、/api/tasks、
 *   /api/approvals、/api/audit、/api/console-sessions —— 全部经 BFF 别名
 *   `/agent-api/api/*` 调用；四门判定复用 modules/duty/readiness.ts 的纯函数。
 *
 * Deliberately NOT present here (lint-reuse R2/R3, zero-engineering language):
 * no shell chat-surface element or attribute, none of the five §11 shell
 * surface components are pulled in, no hardcoded per-employee capability
 * lists, and raw ids (employee / run / task prefixes) never leak into
 * visible text — they live in `title` attributes only.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { ClipboardCheck, Inbox, RefreshCw, ShieldAlert, TriangleAlert, Wallet } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";

import { ConsoleSelect } from "@/shell/ConsoleSelect";
import { RequestIdCopy } from "@/components/RequestIdCopy";
import { Pill, type PillTone } from "@/components/console/Pill";
import SessionDrawer from "@/modules/employee-detail/SessionDrawer";
import { employeeProfileName } from "@/modules/chat/employeeProfile";
import { priorityLabel, short8, statusLabel } from "@/modules/tasks/tasksBoard";
import { riskView, statusView } from "@/modules/approvals/model";
import { RelativeTime } from "@/modules/approvals/RelativeTime";
import { announcement } from "@/modules/approvals/gates";
import {
  APPROVAL_DENIED_BODY,
  APPROVAL_DENIED_TITLE,
  APPROVAL_EMPTY_SENTENCE,
  APPROVAL_FAILED_TITLE,
  APPROVAL_RETRY_LABEL,
  APPROVAL_RID_FALLBACK,
} from "@/modules/approvals/stateCopy";
// R68 parity: the list row preview and this identity card share ONE
// missing-field wording source and ONE lifecycle vocabulary.
import { departmentView, employeeCode, FIELD_MISSING, FIELD_MISSING_TITLE, fieldMissing, lifecycleLabel as rosterLifecycleLabel } from "@/modules/employees/EmployeesModulePage";
import { fetchApprovalsEvidence, fetchWorkstations } from "@/modules/duty/api";
import {
  GATE_READ_PORTS,
  v1Verdict,
  v2Verdict,
  v6Verdict,
  type ApprovalEvidence,
  type ConfigView,
  type GateVerdict,
  type StationBinding,
} from "@/modules/duty/readiness";
import { fetchJSON } from "@/lib/api";
import { API_UNREACHABLE_MESSAGE, ApiError, humanizeStatus } from "@/lib/api-error";
import {
  DEPARTMENT_MAX,
  GRANT_SOURCES,
  NAME_MAX,
  NoWriteSessionError,
  SCOPE_LABEL,
  TITLE_MAX,
  SCOPE_TYPES,
  SOURCE_LABEL,
  buildIdentityPatch,
  buildGrantBody,
  createGrant,
  defaultExpiryLocal,
  failureLine,
  newGrantIds,
  newIdempotencyKey,
  parseListText,
  patchIsEmpty,
  postTransition,
  publishVersion,
  readVersionDraft,
  validateVersionDraft,
  versionFailure,
  readHandoverCandidates,
  readIdentityDraft,
  readRevision,
  revokeGrant,
  saveEmployeeIdentity,
  transitionNeedsHandover,
  transitionOptions,
  validateGrantDraft,
  validateIdentityDraft,
  writeFailure,
  type GrantDraft,
  type GrantIssue,
  type GrantSource,
  type HandoverCandidate,
  type IdentityDraft,
  type ScopeType,
  type TransitionOption,
  type VersionDraft,
  type VersionFieldIssue,
} from "./employeeEdits";
import "./employee-detail.css";

/* ------------------------------------------------------------------ *
 * types & small readers
 * ------------------------------------------------------------------ */

type Rec = Record<string, unknown>;

type Resource<T> =
  | { phase: "loading" }
  | { phase: "empty" }
  | { phase: "ready"; data: T }
  | { phase: "denied"; message: string; requestId: string | null; code: string | null }
  | { phase: "error"; message: string; requestId: string | null; code: string | null };

/* R-ed5: 403 and 404 share ONE body — the same sentence and code, no path
 * echo — so the screen never leaks whether the data or the permission is
 * what is missing. */
const DENIED_COPY = "这块数据还没接入，或你没有查看权限。请联系工作区管理员确认数据源与权限。";

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function itemsOf(body: unknown): Rec[] {
  if (isRecord(body)) {
    if (Array.isArray(body.items)) return body.items.filter(isRecord);
    // T18: the audit channel wraps its list in `{ events: [...] }`.
    if (Array.isArray(body.events)) return body.events.filter(isRecord);
  }
  return [];
}

/** 有些读口把行数组放在具名键下（mcp/servers → `servers`，knowledge/
 * spaces → `spaces`，knowledge/documents → `documents`，tools → `tools`）。 */
function listAt(body: unknown, key: string): Rec[] {
  if (isRecord(body) && Array.isArray(body[key])) return (body[key] as unknown[]).filter(isRecord);
  return itemsOf(body);
}

/** 上游信封里的机器码（`{"code":"mcp.read_not_wired"}`）；非 JSON 回包 null。 */
function upstreamCode(body: string | null | undefined): string | null {
  if (!body) return null;
  try {
    return pickString((JSON.parse(body) as Rec).code);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * display formatting (zero engineering language)
 * ------------------------------------------------------------------ */

/** emp_A3F1B2C4D5… → "A3F1B2C4"; non-id-looking values pass through. */
function shortCode(value: string): string {
  const tail = value.replace(/^(emp|run|rn|task|apr|aud|cs|session|ws|snap|empv)_/i, "").replace(/[^0-9a-z]/gi, "").slice(0, 8).toUpperCase();
  return tail || "—";
}

/** Missing → "—"; zero stays 0 (never fake a dash, never fake a number). */
function dash(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `$${value.toFixed(2)}`;
}

/** ISO time → 北京时间到分 (YYYY-MM-DD HH:mm, UTC+8); invalid → "—". */
function beijing(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const t = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

function lifecycleLabel(value?: string | null): string {
  switch (value) {
    case "active":
      return "在岗";
    case "onboarding":
      return "入职中";
    case "paused":
      return "已暂停";
    case "suspended":
      return "已停用";
    case "offboarding":
      return "离职中";
    case "draft":
      return "草稿";
    case "archived":
      return "已归档";
    default:
      return "状态未知";
  }
}

function lifecycleTone(value?: string | null): "success" | "warning" | undefined {
  if (value === "active") return "success";
  if (value === "paused" || value === "suspended") return "warning";
  return undefined;
}

function approvalStatusTone(value: string | null): "success" | "warning" | "destructive" | undefined {
  if (value === "approved") return "success";
  if (value === "pending" || value === "processing") return "warning";
  if (value === "rejected" || value === "cancelled") return "destructive";
  return undefined;
}

/** Audit actor: emp_… → short code; human:… → 「真人」; other → as-is. */
function actorLabel(value: string | null): string {
  if (!value) return "—";
  if (/^human:/i.test(value)) return "真人操作";
  if (/^emp_/i.test(value)) return shortCode(value);
  return value;
}

const ACTION_COPY: Record<string, string> = {
  login: "登录",
  logout: "退出",
  create: "创建",
  update: "更新",
  delete: "删除",
  approve: "审批通过",
  reject: "驳回",
  assign: "指派",
  pause: "暂停",
  resume: "恢复",
  stop: "停止",
  start: "启动",
  suspend: "停用",
  budget_change: "预算调整",
  budget_update: "预算调整",
  permission_change: "权限调整",
  permission_update: "权限调整",
};

/** Audit action codes are machine verbs; show words, keep raw in title.
 * Lookup order: whole code → segments joined by "_" (budget.update →
 * budget_update) → last segment → generic fallback. */
function actionLabel(value: string | null): string {
  if (!value) return "相关操作";
  const lower = value.toLowerCase();
  if (ACTION_COPY[lower]) return ACTION_COPY[lower];
  const segs = lower.split(/[.:/]/).filter(Boolean);
  const joined = ACTION_COPY[segs.join("_")];
  if (joined) return joined;
  const last = segs[segs.length - 1] ?? lower;
  return ACTION_COPY[last] ?? "相关操作";
}

/* ------------------------------------------------------------------ *
 * fetch hooks (每节自带；未挂载的分节一个请求都不发)
 * ------------------------------------------------------------------ */

/** 只可能落到这两个失败档：denied 与 error（403/404 同一句话，R-ed5）。 */
function toResourceError(err: unknown): Extract<Resource<never>, { phase: "denied" | "error" }> {
  const api = err instanceof ApiError ? err : null;
  const status = api?.status;
  const code = api ? upstreamCode(api.body) : null;
  if (status === 403) return { phase: "denied", message: DENIED_COPY, requestId: api?.requestId ?? null, code };
  if (status === 404) return { phase: "denied", message: DENIED_COPY, requestId: api?.requestId ?? null, code };
  const message = api?.message || (status ? humanizeStatus(status) : API_UNREACHABLE_MESSAGE);
  return { phase: "error", message, requestId: api?.requestId ?? null, code };
}

/** 列表腿：空回包是真实空集（empty），不是失败。
 *  第三个返回值：后台静默重读（不进 loading，不卸载已渲染的面板）；
 *  用于写口成功后刷新列表，同时保住表单里的回执与用户输入。 */
function useList<T>(url: string, read: (body: unknown) => T[]): [Resource<T[]>, () => void, () => void] {
  const [resource, setResource] = useState<Resource<T[]>>({ phase: "loading" });
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const refresh = useCallback(() => {
    fetchJSON<unknown>(url)
      .then((body) => {
        const rows = read(body);
        setResource(rows.length ? { phase: "ready", data: rows } : { phase: "empty" });
      })
      .catch(() => {
        /* 静默重读失败不覆盖现有内容；用户仍看得到旧列表与写口回执 */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reader is a module-level pure function
  }, [url]);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setResource({ phase: "loading" });
    fetchJSON<unknown>(url)
      .then((body) => {
        if (cancelled) return;
        const rows = read(body);
        setResource(rows.length ? { phase: "ready", data: rows } : { phase: "empty" });
      })
      .catch((err: unknown) => {
        if (!cancelled) setResource(toResourceError(err));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- readers are module-level pure functions
  }, [url, nonce]);

  return [resource, retry, refresh];
}

/** 单对象腿：整包（含信封键）交给分节自己投影；空对象不算 empty。
 *  第三个返回值：写口成功后用回包就地替换（不用再打一次读口）。
 *  第四个返回值：后台静默重读（保留当前内容与用户输入，只更新基线；用于
 *  409 revision 过期后取新 revision，绝不把编辑器打回骨架屏）。 */
function useOne<T>(
  url: string,
  read: (body: unknown) => T,
): [Resource<T>, () => void, (data: T) => void, () => void] {
  const [resource, setResource] = useState<Resource<T>>({ phase: "loading" });
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  const replace = useCallback((data: T) => setResource({ phase: "ready", data }), []);
  const refresh = useCallback(() => {
    fetchJSON<unknown>(url)
      .then((body) => setResource({ phase: "ready", data: read(body) }))
      .catch(() => {
        /* 静默重读失败不覆盖现有内容；用户可继续看旧值与错误提示 */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reader is a module-level pure function
  }, [url]);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setResource({ phase: "loading" });
    fetchJSON<unknown>(url)
      .then((body) => {
        if (!cancelled) setResource({ phase: "ready", data: read(body) });
      })
      .catch((err: unknown) => {
        if (!cancelled) setResource(toResourceError(err));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- readers are module-level pure functions
  }, [url, nonce]);

  return [resource, retry, replace, refresh];
}

/** 异步加载 duty 纯读口的共用状态（fetchWorkstations / fetchApprovalsEvidence）。 */
type DutyState<T> =
  | { phase: "loading" }
  | { phase: "ready"; data: T }
  | { phase: "failed"; message: string };

function useDuty<T>(loader: () => Promise<T>, enabled: boolean): [DutyState<T>, () => void] {
  const [state, setState] = useState<DutyState<T>>({ phase: "loading" });
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ phase: "loading" });
    loader()
      .then((data) => {
        if (!cancelled) setState({ phase: "ready", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ phase: "failed", message: toResourceError(err).message });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loader identity is stable per call-site closure
  }, [enabled, nonce]);
  return [state, retry];
}

/* ------------------------------------------------------------------ *
 * zone readers (row projections)
 * ------------------------------------------------------------------ */

type ApprovalRow = { ref: string | null; status: string | null; title: string | null; at: string | null; updatedAt: string | null; risk: string | null; amount: number | null; requesterId: string | null };

function readApprovals(body: unknown): ApprovalRow[] {
  return itemsOf(body).map((item) => {
    const requester = isRecord(item.requestedBy) ? item.requestedBy : isRecord(item.requester) ? item.requester : null;
    const requesterRaw = pickString(
      requester ? pickString(requester.id, requester.userId, requester.user_id) : null,
      typeof item.requestedBy === "string" ? item.requestedBy : null,
      typeof item.requester === "string" ? item.requester : null,
    );
    return {
      ref: pickString(item.taskId, item.taskRef, item.refId, item.approvalId, item.id),
      status: pickString(item.status, item.state),
      // R78 parity: same head keys as the queue TITLE_KEYS (type/category kept as tail extras).
      title: pickString(item.title, item.summary, item.subject, item.actionLabel, item.action, item.name, item.tool, item.request, item.type, item.category),
      at: pickString(item.createdAt, item.created_at, item.submittedAt, item.applyTime),
      updatedAt: pickString(item.updatedAt, item.updated_at, item.decidedAt, item.changedAt),
      risk: pickString(item.riskLevel, item.risk_level, item.risk),
      amount: pickNumber(item.amountUsd, item.amount, item.monthlyCostUsd),
      requesterId: requesterRaw ? requesterRaw.replace(/^employee:/i, "") : null,
    };
  });
}

type RunRow = { ref: string | null; status: string | null; startedAt: string | null; endedAt: string | null; cost: number | null; tokens: number | null };

function readRuns(body: unknown): RunRow[] {
  return itemsOf(body).map((item) => ({
    ref: pickString(item.runId, item.id),
    status: pickString(item.status, item.state),
    startedAt: pickString(item.startedAt, item.started_at, item.createdAt, item.created_at),
    endedAt: pickString(item.endedAt, item.ended_at, item.finishedAt, item.completedAt),
    cost: pickNumber(item.costUsd, item.totalCostUsd, item.cost),
    tokens: pickNumber(item.totalTokens, item.tokens, item.tokenUsage),
  }));
}

function readRunsPage(body: unknown): { rows: RunRow[]; capped: boolean } {
  const rows = readRuns(body);
  const cursor = isRecord(body) ? body.nextCursor : null;
  return { rows, capped: cursor !== null && cursor !== undefined };
}

type AuditRow = { at: string | null; actor: string | null; actorType: string | null; action: string | null; detail: string | null; outcome: string | null; requestId: string | null };

function readAudit(body: unknown): AuditRow[] {
  return itemsOf(body).map((item) => {
    const actorRec = isRecord(item.actor) ? (item.actor as Rec) : null;
    return {
      at: pickString(item.createdAt, item.created_at, item.time, item.timestamp, item.occurredAt),
      actor: actorRec
        ? pickString(actorRec.name, actorRec.id)
        : pickString(item.actor, item.actorId, item.userId, item.operator),
      actorType: actorRec ? pickString(actorRec.type) : null,
      action: pickString(item.action, item.actionType, item.event, item.kind),
      detail: pickString(item.detail, item.summary, item.message),
      // R32: the real event answer carries outcome, not a prose detail.
      outcome: pickString(item.outcome, item.result),
      requestId: pickString(item.requestId, item.request_id),
    };
  });
}

type TaskZoneRow = {
  taskId: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

/** Multi-key tolerant reader for /api/tasks rows (E-series envelope). */
function readTasks(body: unknown): TaskZoneRow[] {
  const rows: TaskZoneRow[] = [];
  for (const item of itemsOf(body)) {
    const taskId = pickString(item.taskId, item.task_id, item.id);
    if (!taskId) continue;
    rows.push({
      taskId,
      title: pickString(item.title),
      status: pickString(item.status),
      priority: pickString(item.priority),
      createdAt: pickString(item.createdAt, item.created_at),
      updatedAt: pickString(item.updatedAt, item.updated_at),
    });
  }
  return rows;
}

type ChatRow = {
  title: string | null;
  lastAt: string | null;
  messages: number | null;
  status: string | null;
  ref: string | null;
  /** R52: channel of the session when the runtime returns one. */
  channel?: string | null;
};

function readSessions(body: unknown): ChatRow[] {
  const rows: ChatRow[] = [];
  for (const item of itemsOf(body)) {
    const counts = [item.messageCount, item.message_count];
    const num = counts.find((v): v is number => typeof v === "number" && Number.isFinite(v));
    rows.push({
      title: pickString(item.title, item.name, item.sessionTitle),
      lastAt: pickString(item.lastMessageAt, item.last_message_at, item.updatedAt, item.updated_at, item.createdAt),
      messages: num === undefined ? null : num,
      status: pickString(item.status, item.state),
      ref: pickString(item.sessionId, item.session_id, item.id),
      channel: pickString(item.channel, item.source, item.platform, item.channelType),
    });
  }
  return rows;
}

/** R52: 渠道人话；未知值「待核实」，缺值「—」+原因，绝不猜。 */
function channelLabel(raw: string | null | undefined): { text: string; title?: string } {
  if (!raw) return { text: "—", title: "上游没有回传该会话的渠道信息。" };
  const c = raw.trim().toLowerCase();
  if (c === "feishu" || c === "lark") return { text: "飞书" };
  if (c === "wecom" || c === "wechatwork") return { text: "企业微信" };
  if (c === "web") return { text: "网页" };
  if (c === "console") return { text: "控制台" };
  if (c === "api") return { text: "接口" };
  return { text: "待核实", title: `渠道原值：${raw}（未识别，不猜）` };
}

/** 会话状态人话：已知取值给字，未知「待核实」+ 原值 title，缺值「—」。 */
function sessionStatusLabel(raw: string | null): { text: string; title?: string } {
  if (!raw) return { text: "—", title: "上游没有回传该会话的状态。" };
  switch (raw.trim().toLowerCase()) {
    case "active":
    case "open":
      return { text: "进行中" };
    case "archived":
    case "closed":
    case "ended":
      return { text: "已结束" };
    default:
      return { text: "待核实", title: `状态原值：${raw}（未识别，不猜）` };
  }
}

/* ------------------------------------------------------------------ *
 * zone ids ↔ shell `?zone=` spellings (2026-11-26 collapse)
 * ------------------------------------------------------------------ */

type ZoneKey = "workbench" | "config" | "tasks" | "runs" | "evidence";
type ConfigSub = "identity" | "lifecycle" | "permission" | "capability" | "tools" | "budget" | "versions" | "knowledge" | "model";
type EvidenceSub = "approvals" | "audit" | "sessions";

/** 配置左竖栏八节（飞书设置式：一列文字分类 + 右侧对应内容）。 */
// writable 是这个分类在当前代次**有没有写口**（不是「该不该能改」）：
// 左栏直接标出来，管理员一眼知道点进去是能改还是只能看，不用逐节试。
const CONFIG_SUBS: ReadonlyArray<{ id: ConfigSub; label: string; writable: boolean }> = [
  { id: "identity", label: "身份与组织", writable: true },
  { id: "lifecycle", label: "生命周期", writable: true },
  { id: "permission", label: "权限与授权", writable: true },
  { id: "capability", label: "能力与技能", writable: false },
  { id: "tools", label: "工具与 MCP", writable: false },
  { id: "budget", label: "预算与成本", writable: false },
  { id: "versions", label: "版本与变更", writable: true },
  { id: "knowledge", label: "知识与范围", writable: false },
  { id: "model", label: "模型与提示词", writable: false },
];

const EVIDENCE_SUBS: ReadonlyArray<{ id: EvidenceSub; label: string }> = [
  { id: "approvals", label: "审批" },
  { id: "audit", label: "审计" },
  { id: "sessions", label: "会话" },
];

/**
 * 外壳五格词 + 历史拼写别名 + 未知兜底。
 * capability→config（并直接落在「能力与技能」节）、tasklist→tasks、
 * usage→runs、approvals|audit→evidence（各自打开对应小节）、
 * overview|chat→workbench、sessions→evidence（会话节）。
 * 其它未知词 → workbench 且 unknown=true（页面必须声明一句）。
 */
function parseShellZone(raw: string): {
  zone: ZoneKey;
  unknown: boolean;
  configSub: ConfigSub;
  evidenceSub: EvidenceSub;
} {
  const base = { unknown: false, configSub: "identity" as ConfigSub, evidenceSub: "approvals" as EvidenceSub };
  switch (raw) {
    case "":
    case "workbench":
    case "overview":
    case "chat":
      return { zone: "workbench", ...base };
    case "config":
      return { zone: "config", ...base };
    case "capability":
      return { zone: "config", ...base, configSub: "capability" };
    case "tasks":
    case "tasklist":
      return { zone: "tasks", ...base };
    case "runs":
    case "usage":
      return { zone: "runs", ...base };
    case "evidence":
    case "approvals":
      return { zone: "evidence", ...base };
    case "audit":
      return { zone: "evidence", ...base, evidenceSub: "audit" };
    case "sessions":
      return { zone: "evidence", ...base, evidenceSub: "sessions" };
    default:
      return { zone: "workbench", unknown: true, configSub: "identity", evidenceSub: "approvals" };
  }
}

/* ------------------------------------------------------------------ *
 * shared zone-body pieces (four honest states)
 * ------------------------------------------------------------------ */

function ZoneLoading({ testid }: { testid: string }) {
  return (
    <Card data-testid={testid}>
      <CardContent className="space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-white/5" />
        ))}
      </CardContent>
    </Card>
  );
}

function ZoneEmpty({ title, hint, testid }: { title: string; hint: string; testid: string }) {
  return (
    <Card data-testid={testid}>
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <Inbox className="h-6 w-6 text-white/40" />
        <p className="text-sm">{title}</p>
        <p className="text-xs text-white/50">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ZoneDenied({ title, message, requestId, onRetry, testid }: { title: string; message: string; requestId?: string | null; onRetry: () => void; testid: string }) {
  return (
    <Card data-testid={testid}>
      <CardContent className="flex flex-col items-start gap-3 p-5">
        <ShieldAlert className="h-5 w-5 text-amber-400" />
        <p className="text-sm">{title}暂不可见</p>
        <p className="text-xs text-white/55">{message}请确认后台已接入对应服务，或联系管理员开通权限。</p>
        <p className="font-mono text-xs text-white/45">
          <RequestIdCopy requestId={requestId ?? null} fallback="本次请求没有带回编号；可复制时间与页面路径反馈。" />
        </p>
        <Button size="sm" outlined onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          重试
        </Button>
      </CardContent>
    </Card>
  );
}

function ZoneError({ title, message, requestId, onRetry, testid }: { title: string; message: string; requestId: string | null; onRetry: () => void; testid: string }) {
  return (
    <Card data-testid={testid}>
      <CardContent className="flex flex-col items-start gap-3 p-5">
        <TriangleAlert className="h-5 w-5 text-amber-400" />
        <p className="text-sm">{title}没能加载出来</p>
        <p className="text-xs text-white/55">{message}</p>
        <p className="font-mono text-xs text-white/45">
          <RequestIdCopy requestId={requestId} fallback="本次请求未记录编号，可复制时间与操作路径反馈" />
        </p>
        <Button size="sm" outlined onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          重试
        </Button>
      </CardContent>
    </Card>
  );
}

/** 分节里单对象腿的四态包装：denied/error 走同款诚实卡，ready 交 render。 */
function SectionState<T>({ resource, retry, title, prefix, render }: {
  resource: Resource<T>;
  retry: () => void;
  title: string;
  prefix: string;
  render: (value: T) => ReactNode;
}) {
  if (resource.phase === "loading") return <ZoneLoading testid={`${prefix}-loading`} />;
  if (resource.phase === "denied") {
    return <ZoneDenied title={title} message={resource.message} requestId={resource.requestId} onRetry={retry} testid={`${prefix}-denied`} />;
  }
  if (resource.phase === "error") {
    return <ZoneError title={title} message={resource.message} requestId={resource.requestId} onRetry={retry} testid={`${prefix}-error`} />;
  }
  if (resource.phase === "empty") {
    return <ZoneEmpty title={`${title}暂无内容`} hint="这是服务端的真实回答，不是加载失败。" testid={`${prefix}-empty`} />;
  }
  return <>{render(resource.data)}</>;
}

function SectionKv({ rows, prefix }: { rows: Array<{ id: string; label: string; value: ReactNode; title?: string | null; num?: boolean }>; prefix: string }) {
  return (
    <dl className="ui-c-fields ui-c-fields--two">
      {rows.map((r) => (
        <div key={r.id} className="ui-c-field">
          <dt className="ui-c-field-label">{r.label}</dt>
          <dd className={r.num ? "ui-c-field-value ui-c-num" : "ui-c-field-value"} data-testid={`${prefix}-${r.id}`} title={r.title ?? undefined}>
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ *
 * 竖向分类栏（配置 / 证据共用形制）
 *  <nav> + 按钮 + aria-current；不是 tablist。375 收进「分类」下拉。
 * ------------------------------------------------------------------ */

function RailGrid<A extends string>({
  navLabel,
  testid,
  items,
  active,
  onSelect,
  children,
}: {
  navLabel: string;
  testid: string;
  items: ReadonlyArray<{ id: A; label: string; writable?: boolean }>;
  active: A;
  onSelect: (id: A) => void;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-[10.5rem_minmax(0,1fr)]" data-testid={testid}>
      <nav aria-label={navLabel} className="edw-nav hidden md:flex">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => onSelect(it.id)}
            aria-current={it.id === active ? "true" : undefined}
            data-sub={it.id}
            data-testid={`${testid}-item-${it.id}`}
            className={`edw-nav-item${it.id === active ? " edw-nav-item--active" : ""}`}
          >
            <span className="min-w-0 truncate">{it.label}</span>
            {it.writable === undefined ? null : (
              <span
                className={it.writable ? "edw-nav-tag edw-nav-tag--yes" : "edw-nav-tag"}
                data-testid={`${testid}-tag-${it.id}`}
                title={it.writable ? "本节有写口，改动立即生效" : "本节当前只有读口，改动需先接写口"}
              >
                {it.writable ? "可改" : "只读"}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="min-w-0 md:hidden" data-testid={`${testid}-select`}>
        <ConsoleSelect
          aria-label={navLabel}
          data-testid={`${testid}-select-control`}
          value={active}
          onChange={(v) => onSelect(v as A)}
          options={items.map((it) => ({ value: it.id, label: it.label }))}
        />
      </div>
      <div className="min-w-0 space-y-4" data-testid={`${testid}-body`}>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 配置区：九个分类，一列一内容，一节一真读口（身份/生命周期/授权三节可真写）
 * ------------------------------------------------------------------ */

type SaveState =
  | { k: "idle" }
  | { k: "saving" }
  | { k: "ok"; text: string }
  | { k: "error"; text: string; requestId: string | null };

/** 写失败一句话：上游 code 与 message 原样带上，不翻译、不吞。 */
function writeErrorText(err: unknown, lead: string): { text: string; requestId: string | null; stale: boolean; readOnly: boolean } {
  if (err instanceof NoWriteSessionError) {
    return { text: err.message, requestId: null, stale: false, readOnly: false };
  }
  const f = writeFailure(err);
  const prefix = f.staleRevision
    ? "别处已更新，已为你刷新。"
    : f.missingPrecondition
      ? "保存缺少版本前置条件（If-Match）。"
      : f.readOnly
        ? "写口未接，已降级为只读。"
        : lead;
  return { text: `${prefix}${failureLine(f)}`, requestId: f.requestId, stale: f.staleRevision, readOnly: f.readOnly };
}

function IdentitySection({ empId }: { empId: string }) {
  const enc = encodeURIComponent(empId);
  const [res, retry, replace, refresh] = useOne(`/agent-api/api/employee?id=${enc}`, (b) => (isRecord(b) ? b : {}));
  return (
    <SectionState
      resource={res}
      retry={retry}
      title="身份与组织"
      prefix="edcfg-id"
      render={(d) => <IdentityEditor d={d} empId={empId} onSaved={replace} onReload={refresh} />}
    />
  );
}

function IdentityEditor({
  d,
  empId,
  onSaved,
  onReload,
}: {
  d: Rec;
  empId: string;
  onSaved: (next: Rec) => void;
  onReload: () => void;
}) {
  const original = readIdentityDraft(d);
  const [draft, setDraft] = useState<IdentityDraft>(original);
  const [state, setState] = useState<SaveState>({ k: "idle" });
  const [readOnly, setReadOnly] = useState(false);

  // revision 始终取当前 prop 里的档案：写口回包/静默重读会更新 d，下次保存就用新值。
  const rev = readRevision(d);

  const issues = validateIdentityDraft(draft);
  const issueOf = (field: "name" | "title" | "department") => issues.find((i) => i.field === field)?.message ?? null;
  const patch = buildIdentityPatch(original, draft);
  const dirty = !patchIsEmpty(patch);
  const saving = state.k === "saving";
  const version = pickString(d.currentVersionId);
  const owner = pickString(d.ownerUserId);

  const fill = (field: keyof IdentityDraft) => (value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    if (state.k === "error") setState({ k: "idle" });
  };

  async function submit() {
    if (saving || readOnly) return;
    if (issues.length > 0) {
      setState({ k: "error", text: issues[0]!.message, requestId: null });
      return;
    }
    if (!dirty) return;
    if (rev === null) {
      setState({
        k: "error",
        text: "档案没有回传 revision，无法安全保存（缺 If-Match 会被服务端 428 拒）。请重读后再试。",
        requestId: null,
      });
      return;
    }
    setState({ k: "saving" });
    try {
      const body = await saveEmployeeIdentity(empId, rev, patch);
      onSaved(body);
      setDraft(readIdentityDraft(body));
      const nextRev = readRevision(body) ?? rev + 1;
      setState({ k: "ok", text: `已保存（revision ${nextRev}）` });
    } catch (err: unknown) {
      const e = writeErrorText(err, "保存没有成功：");
      if (e.readOnly) setReadOnly(true);
      setState({ k: "error", text: e.text, requestId: e.requestId });
      // revision 过期：按契约重读，让下一次保存用新 revision；草稿保持不动。
      if (e.stale) onReload();
    }
  }

  return (
    <Card data-testid="edcfg-id">
      <CardContent className="p-0">
        <div className="ui-c-head">
          <h3 className="ui-c-head-title">身份与组织</h3>
          <span className="text-[11px] text-white/45" data-testid="edcfg-id-revision">
            {rev === null ? "revision 未回传" : `revision ${rev}`}
          </span>
        </div>
        <div className="edw-form">
          <div className="edw-form-grid">
            <label className="edw-form-field">
              <span className="edw-form-label">姓名</span>
              <input
                className="edw-input"
                data-testid="edcfg-id-input-name"
                value={draft.name}
                onChange={(e) => fill("name")(e.target.value)}
                maxLength={NAME_MAX}
                disabled={saving || readOnly}
                aria-invalid={issueOf("name") ? "true" : undefined}
              />
              {issueOf("name") ? (
                <span className="edw-field-error" data-testid="edcfg-id-issue-name">{issueOf("name")}</span>
              ) : null}
            </label>
            <label className="edw-form-field">
              <span className="edw-form-label">岗位</span>
              <input
                className="edw-input"
                data-testid="edcfg-id-input-title"
                value={draft.title}
                onChange={(e) => fill("title")(e.target.value)}
                maxLength={TITLE_MAX}
                disabled={saving || readOnly}
                aria-invalid={issueOf("title") ? "true" : undefined}
              />
              {issueOf("title") ? (
                <span className="edw-field-error" data-testid="edcfg-id-issue-title">{issueOf("title")}</span>
              ) : null}
            </label>
            <label className="edw-form-field">
              <span className="edw-form-label">部门</span>
              <input
                className="edw-input"
                data-testid="edcfg-id-input-department"
                value={draft.department}
                onChange={(e) => fill("department")(e.target.value)}
                maxLength={DEPARTMENT_MAX}
                placeholder="留空表示清空部门"
                disabled={saving || readOnly}
                aria-invalid={issueOf("department") ? "true" : undefined}
              />
              {issueOf("department") ? (
                <span className="edw-field-error" data-testid="edcfg-id-issue-department">{issueOf("department")}</span>
              ) : null}
            </label>
          </div>
          <div className="edw-form-actions">
            <Button
              size="sm"
              onClick={() => void submit()}
              disabled={saving || readOnly || !dirty || issues.length > 0}
              aria-disabled={saving || readOnly || !dirty || issues.length > 0 ? "true" : undefined}
              data-testid="edcfg-id-save"
            >
              {saving ? "保存中…" : "保存"}
            </Button>
            {dirty && !saving ? (
              <span className="text-[11px] text-white/60" data-testid="edcfg-id-dirty">未保存改动</span>
            ) : null}
            <Button
              size="sm"
              outlined
              disabled
              aria-disabled="true"
              title="责任人转交需要域侧审批验证，当前恒 409 employee.approval_verification_unavailable，故不开放。"
              data-testid="edcfg-id-transfer"
            >
              转交责任人
            </Button>
            <span className="text-[11px] text-white/45">姓名 ≤ {NAME_MAX} 字，岗位 ≤ {TITLE_MAX} 字，部门 ≤ {DEPARTMENT_MAX} 字。</span>
          </div>
          {state.k === "ok" ? (
            <p className="edw-write-ok" role="status" data-testid="edcfg-id-status">{state.text}</p>
          ) : null}
          {state.k === "ok" ? (
            <p className="edw-write-note" data-testid="edcfg-id-next">
              {version
                ? `改动已立即生效；当前生效版本仍是 v${shortCode(version)}（保存不生成新版本）。`
                : "改动已立即生效；该员工当前没有生效版本，发布后才会形成版本。"}
              本次改动如需留痕成版，请到「版本与变更」发布。
            </p>
          ) : null}
          {state.k === "error" ? (
            <p className="edw-write-error" role="alert" data-testid="edcfg-id-error">
              {state.text}
              {state.requestId ? <span className="edw-write-rid">请求编号 {state.requestId}</span> : null}
            </p>
          ) : null}
          {readOnly ? (
            <p className="edw-write-note" data-testid="edcfg-id-readonly">
              写口未接：本环境的后端没有接员工的保存接口，本节已降级为只读；上面的值仍按真实读口显示。
            </p>
          ) : null}
          <p className="edw-write-note" data-testid="edcfg-id-transfer-note">
            责任人转交走审批验证，当前不可用（ownerUserId 写入恒 409）；如需换责任人，请走审批流程。
          </p>
        </div>
        <div className="console-divider" />
        <SectionKv
          prefix="edcfg-id-field"
          rows={[
            { id: "code", label: "工号", value: employeeCode(empId), title: empId },
            {
              id: "state",
              label: "在职态",
              value: rosterLifecycleLabel(pickString(d.lifecycleState)),
              title: pickString(d.lifecycleState) ? `原始值：${pickString(d.lifecycleState)}` : FIELD_MISSING_TITLE,
            },
            { id: "version", label: "当前版本", value: version ? shortCode(version) : FIELD_MISSING, title: version ?? FIELD_MISSING_TITLE },
            { id: "owner", label: "责任账号", value: owner ?? FIELD_MISSING, title: owner ? undefined : FIELD_MISSING_TITLE },
            { id: "created", label: "创建时间", num: true, value: pickString(d.createdAt) ? beijing(pickString(d.createdAt)) : FIELD_MISSING, title: pickString(d.createdAt) ? "北京时间，精确到分" : FIELD_MISSING_TITLE },
            { id: "updated", label: "更新时间", num: true, value: pickString(d.updatedAt) ? beijing(pickString(d.updatedAt)) : FIELD_MISSING, title: pickString(d.updatedAt) ? "北京时间，精确到分" : FIELD_MISSING_TITLE },
          ]}
        />
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * 生命周期：当前态 + 可达下一步（每步一个小确认）
 * ------------------------------------------------------------------ */

function LifecycleSection({ empId }: { empId: string }) {
  const enc = encodeURIComponent(empId);
  const [res, retry, replace, refresh] = useOne(`/agent-api/api/employee?id=${enc}`, (b) => (isRecord(b) ? b : {}));
  const [pending, setPending] = useState<TransitionOption | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (res.phase === "loading") return <ZoneLoading testid="edcfg-life-loading" />;
  if (res.phase === "denied") {
    return <ZoneDenied title="生命周期" message={res.message} requestId={res.requestId} onRetry={retry} testid="edcfg-life-denied" />;
  }
  if (res.phase === "error") {
    return <ZoneError title="生命周期" message={res.message} requestId={res.requestId} onRetry={retry} testid="edcfg-life-error" />;
  }
  if (res.phase === "empty") {
    return <ZoneEmpty testid="edcfg-life-empty" title="档案里没有生命周期状态" hint="这是服务端的真实回答，不猜在职态。" />;
  }

  const d = res.data;
  const rawState = pickString(d.lifecycleState);
  const options = transitionOptions(rawState);
  return (
    <>
      <Card data-testid="edcfg-life">
        <CardContent className="p-0">
          <div className="ui-c-head">
            <h3 className="ui-c-head-title">生命周期</h3>
          </div>
          <SectionKv
            prefix="edcfg-life-field"
            rows={[
              {
                id: "state",
                label: "当前状态",
                value: rosterLifecycleLabel(rawState),
                title: rawState ? `原始值：${rawState}` : FIELD_MISSING_TITLE,
              },
            ]}
          />
          <div className="console-divider" />
          <div className="edw-life-actions">
            {options.length === 0 ? (
              <p className="edw-write-note" data-testid="edcfg-life-terminal">
                {rawState === "archived"
                  ? "已归档是终态，没有可执行的迁移。"
                  : "当前状态没有已登记的合法迁移。"}
              </p>
            ) : (
              options.map((opt) => (
                <Button
                  key={opt.to}
                  size="sm"
                  outlined
                  disabled={!opt.enabled || readOnly}
                  aria-disabled={!opt.enabled || readOnly ? "true" : undefined}
                  title={opt.reason ?? undefined}
                  data-testid={`edcfg-life-to-${opt.to}`}
                  onClick={() => {
                    setPending(opt);
                    setNotice(null);
                  }}
                >
                  {opt.label}
                </Button>
              ))
            )}
          </div>
          {options.some((o) => !o.enabled) ? (
            <p className="edw-write-note" data-testid="edcfg-life-disabled-note">
              「归档」按钮置灰：域侧尚未实现「离职中 → 已归档」这条迁移（调用恒 409）。
            </p>
          ) : null}
          {notice ? (
            <p className="edw-write-ok" role="status" data-testid="edcfg-life-status">{notice}</p>
          ) : null}
          {readOnly ? (
            <p className="edw-write-note" data-testid="edcfg-life-readonly">
              写口未接：本环境的后端没有接生命周期迁移接口，本节已降级为只读。
            </p>
          ) : null}
          <p className="edw-write-note">
            只显示当前状态可达的下一步；每次迁移都要填原因，开始离职还要选交接到谁。
          </p>
        </CardContent>
      </Card>
      {pending ? (
        <TransitionConfirm
          empId={empId}
          option={pending}
          onCancel={() => setPending(null)}
          onDone={(next, message) => {
            setPending(null);
            setNotice(message);
            if (next) replace(next);
            else refresh();
          }}
          onBlocked={() => setReadOnly(true)}
        />
      ) : null}
    </>
  );
}

function TransitionConfirm({
  empId,
  option,
  onCancel,
  onDone,
  onBlocked,
}: {
  empId: string;
  option: TransitionOption;
  onCancel: () => void;
  onDone: (next: Rec | null, message: string) => void;
  onBlocked: () => void;
}) {
  const needsHandover = transitionNeedsHandover(option.to);
  const [reason, setReason] = useState("");
  const [handover, setHandover] = useState("");
  const [candidates, setCandidates] = useState<HandoverCandidate[]>([]);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>({ k: "idle" });

  useEffect(() => {
    if (!needsHandover) return;
    let cancelled = false;
    fetchJSON<unknown>("/agent-api/api/employees?limit=200")
      .then((body) => {
        if (!cancelled) setCandidates(readHandoverCandidates(body, empId));
      })
      .catch((err: unknown) => {
        if (!cancelled) setCandidateError(writeFailure(err).message);
      });
    return () => {
      cancelled = true;
    };
  }, [needsHandover, empId]);

  const saving = state.k === "saving";
  const reasonOk = reason.trim().length > 0;
  const handoverOk = !needsHandover || handover.trim().length > 0;

  async function submit() {
    if (saving) return;
    if (!reasonOk) {
      setState({ k: "error", text: "原因必填：请写一句这次迁移为什么发生。", requestId: null });
      return;
    }
    if (!handoverOk) {
      setState({ k: "error", text: "开始离职必须选一个交接对象。", requestId: null });
      return;
    }
    setState({ k: "saving" });
    try {
      const body = await postTransition(empId, option.to, reason, handover || null);
      const next = pickString(body.lifecycleState, body.lifecycle) ? (isRecord(body.employee) ? body.employee : body) : null;
      onDone(next, `已提交迁移：${option.label}。`);
    } catch (err: unknown) {
      const e = writeErrorText(err, "迁移没有成功：");
      if (e.readOnly) onBlocked();
      setState({ k: "error", text: e.text, requestId: e.requestId });
    }
  }

  return (
    <Card data-testid="edcfg-life-confirm" role="dialog" aria-label="确认生命周期迁移">
      <CardContent className="p-0">
        <div className="ui-c-head">
          <h3 className="ui-c-head-title">确认迁移：{option.label}</h3>
        </div>
        <div className="edw-form">
          <label className="edw-form-field">
            <span className="edw-form-label">原因（必填）</span>
            <input
              className="edw-input"
              data-testid="edcfg-life-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (state.k === "error") setState({ k: "idle" });
              }}
              maxLength={200}
              disabled={saving}
            />
          </label>
          {needsHandover ? (
            <div className="edw-form-field">
              <span className="edw-form-label">交接给（必填）</span>
              {candidates.length > 0 ? (
                <ConsoleSelect
                  aria-label="交接对象"
                  data-testid="edcfg-life-handover"
                  value={handover}
                  onChange={setHandover}
                  options={[
                    { value: "", label: "选一位交接对象" },
                    ...candidates.map((c) => ({
                      value: c.employeeId,
                      label: c.name ? `${c.name} · ${employeeCode(c.employeeId)}` : employeeCode(c.employeeId),
                    })),
                  ]}
                />
              ) : (
                <input
                  className="edw-input"
                  data-testid="edcfg-life-handover-input"
                  value={handover}
                  onChange={(e) => setHandover(e.target.value)}
                  placeholder="员工读口不可用时可填交接人工号"
                  disabled={saving}
                />
              )}
              {candidateError ? (
                <span className="edw-field-error" data-testid="edcfg-life-handover-error">
                  交接对象列表读取失败（{candidateError}），可直接填工号。
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="edw-form-actions">
            <Button
              size="sm"
              onClick={() => void submit()}
              disabled={saving}
              data-testid="edcfg-life-confirm-submit"
            >
              {saving ? "提交中…" : "确认迁移"}
            </Button>
            <Button size="sm" outlined onClick={onCancel} disabled={saving} data-testid="edcfg-life-cancel">
              取消
            </Button>
          </div>
          {state.k === "error" ? (
            <p className="edw-write-error" role="alert" data-testid="edcfg-life-error-line">
              {state.text}
              {state.requestId ? <span className="edw-write-rid">请求编号 {state.requestId}</span> : null}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function gatePill(v: GateVerdict | "policy"): { text: string; tone: PillTone } {
  if (v === "pass") return { text: "通过", tone: "ok" };
  if (v === "fail") return { text: "未通过", tone: "bad" };
  if (v === "policy") return { text: "未接策略", tone: "mut" };
  return { text: "待核实", tone: "mut" };
}

/** effective-config 回包 → duty readiness 的 ConfigView 投影（与 duty/api 同判据）。 */
function configViewFrom(body: Rec): ConfigView {
  const version = isRecord(body.version) ? body.version : {};
  return {
    scopes: Array.isArray(version.knowledgeScopes)
      ? (version.knowledgeScopes as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    grants: itemsOf({ items: body.grants }).map((g) => ({ expiresAt: pickString(g.expiresAt) })),
    resolvedAt: pickString(body.resolvedAt),
  };
}

function PermissionSection({ empId }: { empId: string }) {
  const enc = encodeURIComponent(empId);
  const [res, retry] = useOne(`/agent-api/api/effective-config?id=${enc}`, (b) => (isRecord(b) ? b : {}));
  const [stations, stationsRetry] = useDuty<StationBinding[]>(() => fetchWorkstations(empId), res.phase === "ready");
  const [evidence, evidenceRetry] = useDuty<ApprovalEvidence[]>(() => fetchApprovalsEvidence(200), res.phase === "ready");
  // 判门用的「现在」只在挂载时取一次（渲染期禁读时钟：react-hooks/purity）。
  const [now] = useState(() => Date.now());

  return (
    <SectionState
      resource={res}
      retry={retry}
      title="权限与授权"
      prefix="edcfg-perm"
      render={(cfg) => {
        const grants = itemsOf({ items: cfg.grants });
        const version = isRecord(cfg.version) ? cfg.version : null;
        const snapshot = pickString(cfg.snapshotRef);
        const resolvedAt = pickString(cfg.resolvedAt);
        const evidenceKeys = isRecord(cfg.evidence) ? Object.keys(cfg.evidence).length : null;
        const v1 = stations.phase === "ready" ? v1Verdict(stations.data) : "unknown";
        const v2 = v2Verdict(configViewFrom(cfg), now);
        const v6 = evidence.phase === "ready" ? v6Verdict(evidence.data, empId, now) : "unknown";
        // V3：GATE_READ_PORTS 登记该门不可判定（上游无强制引用策略读口），
        // 按门位口径整门标「未接策略」，不给 pass/fail（readiness.ts 2026-11-24 口径）。
        const gates: Array<{ key: string; name: string; verdict: GateVerdict | "policy"; source: string }> = [
          { key: "V1", name: "群@可达", verdict: v1, source: stations.phase === "failed" ? `工位读口不可用：${stations.message}` : stations.phase === "ready" ? `工位读口 items=${stations.data.length}（单腿判定）` : "工位读口读取中…" },
          { key: "V2", name: "授权有效", verdict: v2, source: `有效配置 ${grants.length} 条授予 · 知识分区 ${configViewFrom(cfg).scopes.length} 个` },
          { key: "V3", name: "引用合规", verdict: GATE_READ_PORTS.V3.decidable ? v3Gate() : "policy", source: GATE_READ_PORTS.V3.reason ?? "强制引用策略无读口" },
          { key: "V6", name: "发送审批", verdict: v6, source: evidence.phase === "failed" ? `审批证据不可用：${evidence.message}` : evidence.phase === "ready" ? `决策证据 ${evidence.data.length} 条` : "审批证据读取中…" },
        ];
        return (
          <>
            <Card data-testid="edcfg-perm-gates">
              <CardContent className="p-0">
                <div className="ui-c-head">
                  <h3 className="ui-c-head-title">上岗四门判定</h3>
                </div>
                <ul className="edw-gate-list" data-testid="edcfg-perm-gate-list">
                  {gates.map((g) => {
                    const p = gatePill(g.verdict);
                    return (
                      <li key={g.key} className="edw-gate-row" data-testid={`edcfg-perm-gate-${g.key}`}>
                        <span className="edw-gate-top">
                          <span className="edw-rail-mono">{g.key}</span>
                          <span className="edw-gate-name">{g.name}</span>
                          <Pill tone={p.tone} dot={false}>{p.text}</Pill>
                        </span>
                        <span className="edw-gate-source" title={g.source}>{g.source}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="px-4 py-2 text-[11px] text-white/45">
                  判定函数复用值班台四门（readiness 纯函数）；V1 单腿（工位）、V3 策略腿未接线，整门如实标「未接策略」。
                  {stations.phase === "failed" || evidence.phase === "failed" ? (
                    <button type="button" onClick={() => { stationsRetry(); evidenceRetry(); }} className="ml-1 underline underline-offset-2">重试证据腿</button>
                  ) : null}
                </p>
              </CardContent>
            </Card>
            <Card data-testid="edcfg-perm">
              <CardContent className="p-0">
                <div className="ui-c-head">
                  <h3 className="ui-c-head-title">有效授权</h3>
                </div>
                <SectionKv
                  prefix="edcfg-perm-field"
                  rows={[
                    { id: "version", label: "生效版本", value: version && pickString(version.versionNo) ? `v${pickString(version.versionNo)}` : "—", title: version ? undefined : "有效配置没有回传版本行" },
                    { id: "snapshot", label: "策略快照", value: snapshot ? shortCode(snapshot) : "—", title: snapshot ?? "有效配置没有回传 snapshotRef" },
                    { id: "resolved", label: "解析时刻", num: true, value: resolvedAt ? beijing(resolvedAt) : "—", title: resolvedAt ? "payload resolvedAt，北京时间到分" : "有效配置没有回传 resolvedAt" },
                    { id: "evidence", label: "判定证据", value: evidenceKeys === null ? "—" : `${evidenceKeys} 项`, title: evidenceKeys === null ? "有效配置没有回传 evidence 对象" : undefined },
                  ]}
                />
                <div className="console-divider" />
                <GrantPanel empId={empId} grants={grants} />
              </CardContent>
            </Card>
          </>
        );
      }}
    />
  );
}

/**
 * 授权面板：列出 effective-config.grants[]（唯一读口），每条可撤销；
 * 下方「新增授权」写 POST /api/employee-grants。
 *
 * 可见性必须如实说：域侧没有 grant 列表读口，新建的 grant 不会立刻出现在
 * grants[] 里 —— 它要随下一次发版（grantIds）才可见。页面不把「已创建」演成
 * 「已生效」，也不在本地把新行塞进有效授权列表充数。
 */
function GrantPanel({ empId, grants }: { empId: string; grants: Rec[] }) {
  const [revoked, setRevoked] = useState<Record<string, string | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokeState, setRevokeState] = useState<SaveState>({ k: "idle" });
  const [created, setCreated] = useState<Array<{ id: string | null }>>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [formState, setFormState] = useState<SaveState>({ k: "idle" });
  const [attempted, setAttempted] = useState(false);
  const [draft, setDraft] = useState<GrantDraft>(() => ({
    scopeType: "tool",
    source: "role",
    actions: "",
    expiresAt: defaultExpiryLocal(Date.now()),
    approvalRef: "",
    selectorText: '{"types":["tool"]}',
  }));

  const issues = validateGrantDraft(draft);
  // 只在用户点过「创建授权」后才把校验红字摆出来；空白表单不该一开始全红。
  const issueOf = (field: GrantIssue["field"]) =>
    attempted ? issues.find((i) => i.field === field)?.message ?? null : null;
  const saving = formState.k === "saving";
  const rows = grants.filter((g) => {
    const id = pickString(g.id);
    return !id || revoked[id] === undefined;
  });

  const fill = <K extends keyof GrantDraft>(field: K) => (value: GrantDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    if (formState.k === "error") setFormState({ k: "idle" });
  };

  async function create() {
    if (saving || readOnly) return;
    setAttempted(true);
    if (issues.length > 0) {
      setFormState({ k: "error", text: issues[0]!.message, requestId: null });
      return;
    }
    // 先本地构体（buildGrantBody 会再做一次选择器/时间校验）。
    let valid = true;
    try {
      buildGrantBody(empId, draft);
    } catch (err: unknown) {
      valid = false;
      setFormState({ k: "error", text: err instanceof Error ? err.message : String(err), requestId: null });
    }
    if (!valid) return;
    setFormState({ k: "saving" });
    try {
      const grant = await createGrant(empId, draft);
      setCreated((prev) => [...prev, { id: grant.id }]);
      // 成功一次就回到干净表单（保留范围/有效期），校验红字随之收起。
      setDraft((prev) => ({ ...prev, source: "role", actions: "", approvalRef: "" }));
      setAttempted(false);
      setFormState({
        k: "ok",
        text: grant.id
          ? `已创建（${grant.id}），需随下一版发布才会出现在有效授权中。`
          : "后台确认已创建，但回包没有 grant 编号；需随下一版发布后在有效授权中核对。",
      });
    } catch (err: unknown) {
      const e = writeErrorText(err, "新增授权没有成功：");
      if (e.readOnly) setReadOnly(true);
      setFormState({ k: "error", text: e.text, requestId: e.requestId });
    }
  }

  async function revoke(grantId: string) {
    if (busyId || readOnly) return;
    setBusyId(grantId);
    setRevokeState({ k: "idle" });
    try {
      const res = await revokeGrant(empId, grantId);
      setRevoked((prev) => ({ ...prev, [grantId]: res.revokedAt }));
      setRevokeState({
        k: "ok",
        text: `已撤销（${grantId}）${res.revokedAt ? ` · ${beijing(res.revokedAt)}` : ""}`,
      });
    } catch (err: unknown) {
      const e = writeErrorText(err, "撤销没有成功：");
      if (e.readOnly) setReadOnly(true);
      setRevokeState({ k: "error", text: e.text, requestId: e.requestId });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-xs text-white/50" data-testid="edcfg-perm-grants-empty">
          {grants.length === 0
            ? "有效配置里没有授予行（grants 空集）——这是服务端的真实回答，不是加载失败。"
            : "本次已撤销全部授予行；有效配置要等下一次解析才会反映（撤销结果见下方提示）。"}
        </p>
      ) : (
        <ul className="divide-y divide-white/5" data-testid="edcfg-perm-grants">
          {rows.map((g, i) => {
            const id = pickString(g.id);
            const scope = pickString(g.scopeType);
            const source = pickString(g.source);
            const actions = Array.isArray(g.actions) ? (g.actions as unknown[]).filter((x): x is string => typeof x === "string") : [];
            const expires = pickString(g.expiresAt);
            const scopeLabel = scope && scope in SCOPE_LABEL ? SCOPE_LABEL[scope as ScopeType] : scope;
            const sourceLabel = source && source in SOURCE_LABEL ? SOURCE_LABEL[source as GrantSource] : source;
            return (
              <li
                key={`${id ?? i}`}
                className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto] sm:items-center"
                data-testid={`edcfg-perm-grant-${i}`}
              >
                <span className="text-sm" title={scope ?? undefined}>{scopeLabel ?? "—"}</span>
                <span className="min-w-0 truncate text-xs text-white/60" title={actions.join(", ")}>{actions.join("/") || "—"}</span>
                <span className="text-xs text-white/55" title={source ?? undefined}>{sourceLabel ?? "—"}</span>
                <span className="text-xs text-white/55" title={expires ?? undefined}>
                  {expires ? `至 ${beijing(expires)}` : "长期"}
                </span>
                <button
                  type="button"
                  className="edw-inline-btn"
                  disabled={!id || busyId === id || readOnly}
                  aria-disabled={!id || busyId === id || readOnly ? "true" : undefined}
                  title={id ? `撤销 ${id}` : "有效授权行没有回传 grant 编号，无法撤销。"}
                  data-testid={`edcfg-perm-revoke-${i}`}
                  onClick={() => {
                    if (id) void revoke(id);
                  }}
                >
                  {busyId === id ? "撤销中…" : "撤销"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {created.filter((c) => !c.id || revoked[c.id] === undefined).length > 0 ? (
        <div className="px-4 py-2 text-[11px] text-white/55" data-testid="edcfg-perm-grant-created-list">
          <span>本次新建（尚未进入有效授权）：</span>
          {created
            .filter((c) => !c.id || revoked[c.id] === undefined)
            .map((c, i) => (
              <span key={`${c.id ?? i}`} className="ml-1 inline-flex items-center gap-1">
                <span className="font-mono">{c.id ?? "编号未回传"}</span>
                {c.id ? (
                  <button
                    type="button"
                    className="edw-inline-btn"
                    disabled={busyId === c.id || readOnly}
                    aria-disabled={busyId === c.id || readOnly ? "true" : undefined}
                    data-testid={`edcfg-perm-created-revoke-${i}`}
                    onClick={() => void revoke(c.id!)}
                  >
                    {busyId === c.id ? "撤销中…" : "撤销"}
                  </button>
                ) : null}
              </span>
            ))}
        </div>
      ) : null}
      {revokeState.k === "ok" ? (
        <p className="edw-write-ok" role="status" data-testid="edcfg-perm-revoke-status">{revokeState.text}</p>
      ) : null}
      {revokeState.k === "error" ? (
        <p className="edw-write-error" role="alert" data-testid="edcfg-perm-revoke-error">
          {revokeState.text}
          {revokeState.requestId ? <span className="edw-write-rid">请求编号 {revokeState.requestId}</span> : null}
        </p>
      ) : null}

      <div className="console-divider" />
      <div className="edw-form" data-testid="edcfg-perm-grant-form">
        <h4 className="edw-form-title">新增授权</h4>
        <div className="edw-form-grid edw-form-grid--three">
          <div className="edw-form-field">
            <span className="edw-form-label">授权范围</span>
            <ConsoleSelect
              aria-label="授权范围"
              data-testid="edcfg-perm-grant-scope"
              value={draft.scopeType}
              onChange={fill("scopeType")}
              options={SCOPE_TYPES.map((s) => ({ value: s, label: `${SCOPE_LABEL[s]}（${s}）` }))}
            />
          </div>
          <div className="edw-form-field">
            <span className="edw-form-label">来源</span>
            <ConsoleSelect
              aria-label="授权来源"
              data-testid="edcfg-perm-grant-source"
              value={draft.source}
              onChange={fill("source")}
              options={GRANT_SOURCES.map((s) => ({ value: s, label: `${SOURCE_LABEL[s]}（${s}）` }))}
            />
          </div>
          <label className="edw-form-field">
            <span className="edw-form-label">有效期</span>
            <input
              type="datetime-local"
              className="edw-input"
              data-testid="edcfg-perm-grant-expiry"
              value={draft.expiresAt}
              onChange={(e) => fill("expiresAt")(e.target.value)}
              disabled={saving}
              aria-invalid={issueOf("expiresAt") ? "true" : undefined}
            />
            {issueOf("expiresAt") ? (
              <span className="edw-field-error" data-testid="edcfg-perm-grant-issue-expires">{issueOf("expiresAt")}</span>
            ) : null}
          </label>
          <label className="edw-form-field edw-form-field--wide">
            <span className="edw-form-label">动作（逗号或空格分隔）</span>
            <input
              className="edw-input"
              data-testid="edcfg-perm-grant-actions"
              value={draft.actions}
              onChange={(e) => fill("actions")(e.target.value)}
              placeholder="例如 send, read"
              disabled={saving}
              aria-invalid={issueOf("actions") ? "true" : undefined}
            />
            {issueOf("actions") ? (
              <span className="edw-field-error" data-testid="edcfg-perm-grant-issue-actions">{issueOf("actions")}</span>
            ) : null}
          </label>
          <label className="edw-form-field edw-form-field--wide">
            <span className="edw-form-label">资源选择器（JSON 对象，禁通配 *）</span>
            <textarea
              className="edw-input edw-textarea"
              data-testid="edcfg-perm-grant-selector"
              value={draft.selectorText}
              onChange={(e) => fill("selectorText")(e.target.value)}
              rows={2}
              disabled={saving}
              aria-invalid={issueOf("selectorText") ? "true" : undefined}
            />
            {issueOf("selectorText") ? (
              <span className="edw-field-error" data-testid="edcfg-perm-grant-issue-selector">{issueOf("selectorText")}</span>
            ) : null}
          </label>
          <label className="edw-form-field edw-form-field--wide">
            <span className="edw-form-label">审批引用（来源≠角色时必填）</span>
            <input
              className="edw-input"
              data-testid="edcfg-perm-grant-approval"
              value={draft.approvalRef}
              onChange={(e) => fill("approvalRef")(e.target.value)}
              disabled={saving}
              aria-invalid={issueOf("approvalRef") ? "true" : undefined}
            />
            {issueOf("approvalRef") ? (
              <span className="edw-field-error" data-testid="edcfg-perm-grant-issue-approval">{issueOf("approvalRef")}</span>
            ) : null}
          </label>
        </div>
        <div className="edw-form-actions">
          <Button
            size="sm"
            onClick={() => void create()}
            disabled={saving || readOnly}
            aria-disabled={saving || readOnly ? "true" : undefined}
            data-testid="edcfg-perm-grant-submit"
          >
            {saving ? "创建中…" : "创建授权"}
          </Button>
          <span className="text-[11px] text-white/45">有效期没有默认值，表单预填 7 天后，请按实际需要调整。</span>
        </div>
        {formState.k === "ok" ? (
          <p className="edw-write-ok" role="status" data-testid="edcfg-perm-grant-status">{formState.text}</p>
        ) : null}
        {formState.k === "error" ? (
          <p className="edw-write-error" role="alert" data-testid="edcfg-perm-grant-error">
            {formState.text}
            {formState.requestId ? <span className="edw-write-rid">请求编号 {formState.requestId}</span> : null}
          </p>
        ) : null}
        {readOnly ? (
          <p className="edw-write-note" data-testid="edcfg-perm-readonly">
            写口未接：本环境的后端没有接授权创建/撤销接口，本节已降级为只读。
          </p>
        ) : null}
        <p className="edw-write-note" data-testid="edcfg-perm-grant-visibility">
          说明：新建或撤销的授权不会立刻改上面这份「有效授权」——它只在下一次发版（grantIds）解析后才会出现或消失。
        </p>
      </div>
    </>
  );
}

/** V3 可判定分支的占位：策略腿从未接线（api.ts 恒 wired:false），该函数实际
 *  不会在现网执行；保留调用形状，判定仍来自 readiness 文档腿口径。 */
function v3Gate(): GateVerdict {
  return "unknown";
}

function CapabilitySection({ empId }: { empId: string }) {
  const [matrix, matrixRetry] = useOne(`/agent-api/api/matrix?limit=50`, (b) =>
    itemsOf(b).find((row) => pickString(row.employeeId, row.employee_id, row.id) === empId) ?? null,
  );
  // 技能按「这位员工」的档案读：`/api/skills?profile=` 回裸数组，每行带
  // name/enabled/locked；开关写 `PUT /api/skills/toggle`，同样带 profile。
  const profileName = employeeProfileName(empId) ?? "";
  const profileQuery = profileName ? `?profile=${encodeURIComponent(profileName)}` : "";
  const [skills, skillsRetry, skillsRefresh] = useList(`/api/skills${profileQuery}`, (b) =>
    Array.isArray(b) ? (b as Rec[]) : [],
  );
  const [skillBusy, setSkillBusy] = useState<string | null>(null);
  const [skillError, setSkillError] = useState<string | null>(null);
  const toggleSkill = async (name: string, enabled: boolean) => {
    if (skillBusy) return;
    if (!profileName) {
      setSkillError("这位员工没有可用的档案名，不能按员工保存技能开关。");
      return;
    }
    setSkillBusy(name);
    setSkillError(null);
    try {
      await fetchJSON<unknown>(`/api/skills/toggle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, enabled, profile: profileName }),
      });
      skillsRefresh();
    } catch (err: unknown) {
      const e = writeErrorText(err, "技能开关没有保存成功：");
      setSkillError(`${name}：${e.text}`);
    } finally {
      setSkillBusy(null);
    }
  };

  return (
    <>
      <SectionState
        resource={matrix}
        retry={matrixRetry}
        title="能力与技能"
        prefix="edcfg-cap"
        render={(row) => {
          if (!row) {
            return (
              <ZoneEmpty
                testid="edcfg-cap"
                title="矩阵里没有这位员工的行"
                hint="矩阵读口返回全量行，本页按 employeeId 前端匹配；匹配不到就是没有该员工的能力行，不拿别人的行冒充。"
              />
            );
          }
          const refs = Array.isArray(row.skillRefs) ? (row.skillRefs as unknown[]).filter((x): x is string => typeof x === "string") : [];
          const count = pickNumber(row.skillCount);
          return (
            <Card data-testid="edcfg-cap">
              <CardContent className="p-0">
                <div className="ui-c-head">
                  <h3 className="ui-c-head-title">能力与技能</h3>
                </div>
                <SectionKv
                  prefix="edcfg-cap-field"
                  rows={[
                    { id: "count", label: "技能数", num: true, value: count === null ? "—" : `${count} 项`, title: count === 0 ? "真 0：矩阵行 skillCount=0，不是加载失败" : undefined },
                    { id: "refs", label: "挂载引用", value: refs.length ? refs.join(" · ") : "0 项挂载（真 0）", title: refs.length ? undefined : "当前矩阵行 skillRefs 为空集" },
                  ]}
                />
                <p className="px-4 py-2 text-[11px] text-white/45" data-testid="edcfg-cap-note">
                  矩阵读口不支持按员工过滤，本页为前端筛选。
                </p>
              </CardContent>
            </Card>
          );
        }}
      />
      <Card data-testid="edcfg-skills">
        <CardContent className="p-0">
          <div className="ui-c-head">
            <h3 className="ui-c-head-title">技能目录</h3>
          </div>
          {skills.phase === "loading" ? (
            <p className="px-4 py-3 text-xs text-white/50">读取中…</p>
          ) : skills.phase === "denied" || skills.phase === "error" ? (
            <p className="px-4 py-3 text-xs text-white/55" data-testid="edcfg-skills-failed">
              {skills.message}
              {skills.code ? `（上游 code=${skills.code}）` : ""}
              <button type="button" onClick={skillsRetry} className="ml-2 underline underline-offset-2">重试</button>
            </p>
          ) : skills.phase === "empty" ? (
            <p className="px-4 py-3 text-xs text-white/55" data-testid="edcfg-skills-empty">
              本租户暂无已发布技能（服务端返回空集，是真 0，不是加载失败）。
            </p>
          ) : (
            <ul className="divide-y divide-white/5" data-testid="edcfg-skills-list">
              {skills.data.map((r, i) => {
                const name = pickString(r.name, r.id) ?? "";
                const enabled = r.enabled === true;
                const locked = r.locked === true;
                return (
                  <li key={`${name || i}`} className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-4 py-2" data-testid={`edcfg-skills-row-${i}`}>
                    <span className="min-w-0 flex-1 truncate text-sm" title={name}>{name || "—"}</span>
                    <span className="flex items-center gap-2 text-[11px] text-white/50">
                      {locked ? <span data-testid={`edcfg-skills-locked-${i}`}>已锁定</span> : null}
                      {yesNo(enabled)}
                      <Button
                        size="sm"
                        outlined
                        disabled={locked || !name || skillBusy === name}
                        onClick={() => toggleSkill(name, !enabled)}
                        data-testid={`edcfg-skills-toggle-${i}`}
                      >
                        {skillBusy === name ? "保存中…" : enabled ? "停用" : "启用"}
                      </Button>
                    </span>
                  </li>
                );
              })}
              <li className="px-4 py-2 text-[11px] text-white/45">
                共 {skills.data.length} 条；开关写的是这位员工的档案，下一次新会话生效。
              </li>
            </ul>
          )}
          {skillError ? (
            <p className="px-4 pb-2 text-[11px] text-red-300/80" data-testid="edcfg-skills-toggle-error">{skillError}</p>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

function yesNo(v: unknown): string {
  if (typeof v === "boolean") return v ? "是" : "否";
  return "—";
}

function ToolsSection({ empId }: { empId: string }) {
  // 工具组按「这位员工」的运行时档案读：`/api/tools/toolsets?profile=` 直接问
  // Hermes（不经 BFF），回包是裸数组，每行带 enabled/available/configured。
  // MCP 仍是租户级清单（本代次没有按档案的 MCP 读口）。
  const profileName = employeeProfileName(empId) ?? "";
  const profileQuery = profileName ? `?profile=${encodeURIComponent(profileName)}` : "";
  const [mcp, mcpRetry] = useList(`/agent-api/api/mcp/servers`, (b) => listAt(b, "servers"));
  // 实测回包是 `{toolsets: [...]}`（不是裸数组）；裸数组写法会静默落 empty，
  // 界面上看起来像"真 0"——那是读法错误，不是数据为空。
  const [tools, toolsRetry, toolsRefresh] = useList(`/api/tools/toolsets${profileQuery}`, (b) =>
    listAt(b, "toolsets"),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const toggleToolset = async (name: string, enabled: boolean) => {
    if (busy) return;
    if (!profileName) {
      setToggleError("这位员工没有可用的档案名，不能按员工保存工具开关。");
      return;
    }
    setBusy(name);
    setToggleError(null);
    try {
      await fetchJSON<unknown>(`/api/tools/toolsets/${encodeURIComponent(name)}${profileQuery}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, profile: profileName }),
      });
      toolsRefresh();
    } catch (err: unknown) {
      const e = writeErrorText(err, "工具组开关没有保存成功：");
      setToggleError(`${name}：${e.text}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card data-testid="edcfg-tools">
        <CardContent className="p-0">
          <div className="ui-c-head">
            <h3 className="ui-c-head-title">工具清单（按工具组）</h3>
          </div>
          {tools.phase === "loading" ? (
            <p className="px-4 py-3 text-xs text-white/50">读取中…</p>
          ) : tools.phase === "denied" || tools.phase === "error" ? (
            <p className="px-4 py-3 text-xs text-white/55" data-testid="edcfg-tools-failed">
              工具清单上游暂不可用。
              {tools.code ? `（上游 code=${tools.code}）` : ""}
              <button type="button" onClick={toolsRetry} className="ml-2 underline underline-offset-2">重试</button>
            </p>
          ) : tools.phase === "empty" ? (
            <p className="px-4 py-3 text-xs text-white/55" data-testid="edcfg-tools-empty">
              工具读口返回空集（真 0，不是加载失败）。
            </p>
          ) : (
            <ul className="divide-y divide-white/5" data-testid="edcfg-tools-groups">
              {tools.data.map((t, i) => {
                const inner = Array.isArray(t.tools) ? (t.tools as unknown[]).filter((x): x is string => typeof x === "string") : [];
                return (
                  <li key={`${pickString(t.name) ?? i}`} className="px-4 py-3" data-testid={`edcfg-tools-group-${i}`}>
                    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
                      <span className="min-w-0 text-sm">{pickString(t.label, t.name) ?? "—"}</span>
                      <span className="flex items-center gap-2 text-[11px] text-white/50">
                        已启用 {yesNo(t.enabled)} · 可用 {yesNo(t.available)}
                        <Button
                          size="sm"
                          outlined
                          disabled={busy === pickString(t.name) || !pickString(t.name)}
                          onClick={() => toggleToolset(pickString(t.name)!, t.enabled !== true)}
                          data-testid={`edcfg-tools-toggle-${i}`}
                        >
                          {busy === pickString(t.name) ? "保存中…" : t.enabled === true ? "停用" : "启用"}
                        </Button>
                      </span>
                    </div>
                    <div className="mt-1 flex min-w-0 flex-wrap gap-1">
                      {inner.length ? (
                        inner.map((name) => (
                          <span key={name} className="rounded-[var(--r-sm)] border px-1.5 py-0.5 font-mono text-[11px] text-white/60">
                            {name}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-white/45">组内无子工具</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="px-4 py-2 text-[11px] text-white/45">
            口径：按工具组（toolset）分组展示该员工档案的真回包字段；开关写的是这位员工的档案，下一次新会话生效（已打开的会话仍用旧工具面）。
          </p>
          {toggleError ? (
            <p className="px-4 pb-2 text-[11px] text-red-300/80" data-testid="edcfg-tools-toggle-error">
              {toggleError}
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card data-testid="edcfg-mcp">
        <CardContent className="p-0">
          <div className="ui-c-head">
            <h3 className="ui-c-head-title">MCP 服务器</h3>
          </div>
          {mcp.phase === "loading" ? (
            <p className="px-4 py-3 text-xs text-white/50">读取中…</p>
          ) : mcp.phase === "denied" || mcp.phase === "error" ? (
            <p className="px-4 py-3 text-xs text-white/55" data-testid="edcfg-mcp-failed">
              MCP 服务器读口未接线。
              {mcp.code ? `（上游 code=${mcp.code}）` : ""}
              <button type="button" onClick={mcpRetry} className="ml-2 underline underline-offset-2">重试</button>
            </p>
          ) : mcp.phase === "empty" ? (
            <p className="px-4 py-3 text-xs text-white/55" data-testid="edcfg-mcp-empty">
              本租户尚未配置 MCP 服务器（服务端返回空集，是真 0）。
            </p>
          ) : (
            <ul className="divide-y divide-white/5" data-testid="edcfg-mcp-list">
              {mcp.data.map((sv, i) => (
                <li key={`${pickString(sv.name, sv.id) ?? i}`} className="flex min-w-0 items-baseline justify-between gap-2 px-4 py-3" data-testid={`edcfg-mcp-row-${i}`}>
                  <span className="min-w-0 truncate text-sm">{pickString(sv.name, sv.id) ?? "—"}</span>
                  <span className="text-xs text-white/55">{pickString(sv.transport, sv.url) ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function BudgetSection({ empId }: { empId: string }) {
  const enc = encodeURIComponent(empId);
  // 月档必须显式 periodKind=month（缺 periodKind 走日档形制；缺 period 400）。
  // 周期串只决定问服务端哪一月，屏上时刻全部取自回包。
  const [monthPeriod] = useState(() => new Date(Date.now() + 480 * 60_000).toISOString().slice(0, 7));
  const [usage, usageRetry] = useOne(
    `/agent-api/api/budget-usage?employeeId=${enc}&periodKind=month&period=${monthPeriod}`,
    (b) => b,
  );
  const [runs, runsRetry] = useOne(`/agent-api/api/runs?employeeId=${enc}&limit=100`, readRunsPage);

  return (
    <>
      <SectionState
        resource={usage}
        retry={usageRetry}
        title="预算与成本"
        prefix="edcfg-budget"
        render={(body) => {
          const rec = isRecord(body) ? body : {};
          const row = itemsOf(rec)[0] ?? null;
          const missing = Array.isArray(rec.missingEmployeeIds) && rec.missingEmployeeIds.length > 0;
          const asOf = pickString(rec.asOf);
          return (
            <Card data-testid="edcfg-budget">
              <CardContent className="p-0">
                <div className="ui-c-head">
                  <h3 className="ui-c-head-title">预算与成本（本月账本）</h3>
                </div>
                <SectionKv
                  prefix="edcfg-budget-field"
                  rows={[
                    { id: "period", label: "账期", num: true, value: row ? pickString(row.period) ?? monthPeriod : "—", title: undefined },
                    {
                      id: "cost",
                      label: "实扣成本",
                      num: true,
                      value: row ? money(pickNumber(row.costUsd, row.cost_usd)) : "—",
                      title: row ? "预算账本本月行的实扣金额（只认真实扣费）。" : missing ? "账本本月没有这位员工的行：缺失不作 $0.00。" : "账本没有回传本月行。",
                    },
                    { id: "tokens", label: "本月 token", num: true, value: row ? fmtIntLocal(pickNumber(row.tokensUsed, row.tokens_used)) : "—", title: row ? undefined : "缺行不作 0" },
                    { id: "reserved", label: "预留", num: true, value: row ? money(pickNumber(row.reserved)) : "—", title: row ? undefined : "缺行不作 0" },
                    { id: "asof", label: "采集时刻", num: true, value: asOf ? beijing(asOf) : "—", title: asOf ? `payload asOf=${asOf} · 来源 ${pickString(rec.asOfSource) ?? "—"}` : "payload 顶层没有 ISO 格式的 asOf：不用本机时钟补时。" },
                  ]}
                />
              </CardContent>
            </Card>
          );
        }}
      />
      <SectionState
        resource={runs}
        retry={runsRetry}
        title="运行成本汇总"
        prefix="edcfg-runcost"
        render={(page) => {
          const sum = page.rows.reduce((acc, r) => acc + (r.cost ?? 0), 0);
          const anyCost = page.rows.some((r) => r.cost !== null);
          return (
            <Card data-testid="edcfg-runcost">
              <CardContent className="p-0">
                <div className="ui-c-head">
                  <h3 className="ui-c-head-title">运行成本汇总</h3>
                </div>
                <SectionKv
                  prefix="edcfg-runcost-field"
                  rows={[
                    { id: "count", label: "取数运行", num: true, value: `${page.rows.length} 次`, title: "口径：/api/runs 按 employeeId 真过滤，本页取最近 100 次" },
                    { id: "sum", label: "costUsd 合计", num: true, value: anyCost ? money(sum) : "—", title: anyCost ? "按运行明细 costUsd 前端求和；与预算账本口径相互独立。" : "运行明细里没有任何 costUsd 字段：缺值不作 $0.00。" },
                    { id: "cap", label: "截断披露", value: page.capped ? "服务端提示还有更多运行（本页仅最近 100 次的合计）" : "无（运行已读完）", title: undefined },
                  ]}
                />
              </CardContent>
            </Card>
          );
        }}
      />
    </>
  );
}

function fmtIntLocal(v: number | null): string {
  return v === null ? "—" : v.toLocaleString("en-US");
}

/** 最新一版：按 effectiveFrom 取最大，不依赖读口返回顺序。 */
function latestVersionRow(rows: Rec[]): Rec | null {
  let best: Rec | null = null;
  let bestMs = -Infinity;
  for (const row of rows) {
    const ms = Date.parse(pickString(row.effectiveFrom) ?? "");
    if (!Number.isFinite(ms)) {
      if (best === null) best = row;
      continue;
    }
    if (ms > bestMs) {
      bestMs = ms;
      best = row;
    }
  }
  return best;
}

function VersionsSection({ empId }: { empId: string }) {
  const enc = encodeURIComponent(empId);
  const [versions, retry, refreshVersions] = useList(`/agent-api/api/employee-versions?id=${enc}`, (b) => itemsOf(b));
  const [publishing, setPublishing] = useState(false);
  // 「以此为底稿」：从历史版本起草新版本。域侧没有原地回滚的写口，也不该有——
  // 回滚等于改写历史版本的语义，历史必须可追溯。所以这里做的是「复制旧版 → 发布新版」，
  // 与 agent-pilot 的 rollback 在结果上等价（当前生效配置回到旧值），但留下完整版本链。
  const [seed, setSeed] = useState<Rec | null>(null);
  if (versions.phase === "loading") return <ZoneLoading testid="edcfg-vers-loading" />;
  if (versions.phase === "denied") return <ZoneDenied title="版本与变更" message={versions.message} requestId={versions.requestId} onRetry={retry} testid="edcfg-vers-denied" />;
  if (versions.phase === "error") return <ZoneError title="版本与变更" message={versions.message} requestId={versions.requestId} onRetry={retry} testid="edcfg-vers-error" />;
  if (versions.phase === "empty") {
    return <ZoneEmpty testid="edcfg-vers-empty" title="该员工暂无版本记录" hint="版本读口按员工 id 查询，空集是服务端的真实回答；没有基础版本时域侧会拒绝首版发布，需先由管理员建档。" />;
  }
  const latest = latestVersionRow(versions.data);
  return (
    <Card data-testid="edcfg-vers">
      <CardContent className="p-0">
        <div className="ui-c-head">
          <h3 className="ui-c-head-title">版本与变更</h3>
          <div className="ui-c-head-actions">
            <Button
              size="sm"
              outlined
              aria-expanded={publishing ? "true" : "false"}
              onClick={() => setPublishing((v) => !v)}
              data-testid="edcfg-vers-publish-toggle"
            >
              {publishing ? "收起发布表单" : "发布新版本"}
            </Button>
          </div>
        </div>
        {publishing && seed ? (
          <p className="px-4 py-2 text-[11px] text-white/55" data-testid="edcfg-vers-seed-note">
            正在以 v{pickString(seed.versionNo) ?? pickNumber(seed.versionNo) ?? "?"} 为底稿起草：
            发布后生成<strong>新版本</strong>，历史版本不被改写。
            <button
              type="button"
              className="ml-2 underline underline-offset-2 hover:text-white"
              onClick={() => setSeed(null)}
              data-testid="edcfg-vers-seed-clear"
            >
              改回用最近一版
            </button>
          </p>
        ) : null}
        {publishing ? (
          <PublishVersionPanel
            key={seed ? `seed-${pickString(seed.id) ?? pickNumber(seed.versionNo) ?? "x"}` : "latest"}
            empId={empId}
            latest={seed ?? latest}
            onPublished={() => {
              setSeed(null);
              refreshVersions();
            }}
          />
        ) : (
          <p className="px-4 py-2 text-[11px] text-white/45" data-testid="edcfg-vers-publish-hint">
            新建的授权要随一次发版写进 grantIds 才会进入有效授权；点右上「发布新版本」，表单按最近一版的真字段起草。
            要把当前生效配置退回某个历史版本，点该行的「以此为底稿」，它会复制那一版再发一次新版本。
          </p>
        )}
        <div className="console-divider" />
        <ul className="divide-y divide-white/5" data-testid="edcfg-vers-list">
          {versions.data.map((v, i) => (
            <li key={`${pickString(v.id) ?? i}`} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[minmax(0,0.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-2" data-testid={`edcfg-vers-row-${i}`}>
              <span className="text-sm">v{dash(pickString(v.versionNo) ?? pickNumber(v.versionNo))}</span>
              <span className="min-w-0 truncate text-xs text-white/60" title={pickString(v.changeNote) ?? undefined}>
                {pickString(v.changeNote) ?? "（无变更说明）"}
              </span>
              <span className="font-mono text-xs text-white/55" title={`生效时间 ${pickString(v.effectiveFrom) ?? "未回传"}`}>
                {beijing(pickString(v.effectiveFrom))} · {actorLabel(pickString(v.createdBy))}
              </span>
              <Button
                size="sm"
                outlined
                onClick={() => {
                  setSeed(v);
                  setPublishing(true);
                }}
                data-testid={`edcfg-vers-seed-${i}`}
                title="复制这一版的字段到发布表单；发布后是新版本，历史不改写"
              >
                以此为底稿
              </Button>
            </li>
          ))}
        </ul>
        <p className="px-4 py-2 text-[11px] text-white/45">只读版本链；发布在上方「发布新版本」，回滚不在本页进行。</p>
      </CardContent>
    </Card>
  );
}

/**
 * 发布新版本表单。
 *
 * 预填纪律：全部初值来自最近一版真回包（readVersionDraft），缺哪个键就留空
 * 并标「上一版无此字段」。授权 ID 可多行填写：从 effective-config.grants[]
 * 里点选补入是「已生效」的候选，管理员自己新建的 gr_… 直接粘进来；提交前
 * 实时显示「本次新增 N 条」——提权分支会让域侧 409 要审批引用，界面在原
 * 地提示，不假装成功。
 */
function PublishVersionPanel({
  empId,
  latest,
  onPublished,
}: {
  empId: string;
  latest: Rec | null;
  onPublished: () => void;
}) {
  const enc = encodeURIComponent(empId);
  const prefill = readVersionDraft(latest);
  const [draft, setDraft] = useState<VersionDraft>(prefill.draft);
  const [state, setState] = useState<SaveState>({ k: "idle" });
  const [readOnly, setReadOnly] = useState(false);
  const [attempted, setAttempted] = useState(false);
  // 幂等键按「一次发布意图」走：失败重试复用同一条（避免重复发版），
  // 成功后再换一条，免得第二次发布被后端当成同一次请求的缓存回包。
  const [idemKey, setIdemKey] = useState(() => newIdempotencyKey());
  const [cfg, , , cfgRefresh] = useOne(`/agent-api/api/effective-config?id=${enc}`, (b) => (isRecord(b) ? b : {}));

  const previousGrantIds = Array.isArray(latest?.grantIds)
    ? (latest!.grantIds as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const selectedGrants = parseListText(draft.grantIdsText);
  const addedGrants = newGrantIds(selectedGrants, previousGrantIds);
  const effectiveGrants =
    cfg.phase === "ready"
      ? itemsOf({ items: cfg.data.grants })
          .map((g) => pickString(g.id))
          .filter((id): id is string => Boolean(id))
      : [];
  const grantCandidates = effectiveGrants.filter((id) => !selectedGrants.includes(id));

  const issues = validateVersionDraft(draft, prefill.sourceEffectiveFrom);
  const issueOf = (field: VersionFieldIssue["field"]) =>
    attempted ? issues.find((i) => i.field === field)?.message ?? null : null;
  const saving = state.k === "saving";
  const latestLabel =
    prefill.sourceEffectiveFrom === null
      ? null
      : prefill.sourceVersionNo !== null
        ? `v${prefill.sourceVersionNo} · ${beijing(prefill.sourceEffectiveFrom)}`
        : beijing(prefill.sourceEffectiveFrom);

  const fill = <K extends keyof VersionDraft>(field: K) => (value: VersionDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    if (state.k === "error") setState({ k: "idle" });
  };

  function addGrantId(id: string) {
    setDraft((prev) => ({ ...prev, grantIdsText: [...parseListText(prev.grantIdsText), id].join("\n") }));
    if (state.k === "error") setState({ k: "idle" });
  }

  async function submit() {
    if (saving || readOnly) return;
    setAttempted(true);
    if (issues.length > 0) {
      setState({ k: "error", text: issues[0]!.message, requestId: null });
      return;
    }
    if (!latest) {
      setState({
        k: "error",
        text: "还没有基础版本，域侧会拒绝第一版发布；请先让管理员建一版基础版本。",
        requestId: null,
      });
      return;
    }
    setState({ k: "saving" });
    try {
      const pub = await publishVersion(empId, draft, idemKey);
      setIdemKey(newIdempotencyKey());
      // 成功后刷新版本链与有效配置：刚纳入的 grant 才会出现在有效授权里。
      onPublished();
      cfgRefresh();
      const head = pub.id
        ? `已发布${pub.versionNo === null ? "" : ` v${pub.versionNo}`}（${pub.id}）`
        : "后台确认已发布，但回包没有版本编号；请在下方版本列表核对。";
      setState({
        k: "ok",
        text: `${head}${pub.effectiveFrom ? ` · 生效 ${beijing(pub.effectiveFrom)}` : ""} · 本次新增 ${addedGrants.length} 条授权`,
      });
      setAttempted(false);
    } catch (err: unknown) {
      const e = versionFailure(err, latestLabel);
      if (e.readOnly) setReadOnly(true);
      setState({ k: "error", text: e.text, requestId: e.requestId });
    }
  }

  const missing = (key: string) => (prefill.missing.includes(key) ? "（上一版无此字段）" : "");
  const src = prefill.sourceVersionNo === null ? "无基础版本" : `v${prefill.sourceVersionNo}`;

  return (
    <div className="edw-form" data-testid="edcfg-vers-publish">
      <h4 className="edw-form-title" data-testid="edcfg-vers-publish-src">
        发布新版本 · 初值来自 {src}
        {prefill.sourceEffectiveFrom ? `（生效 ${beijing(prefill.sourceEffectiveFrom)}）` : ""}
      </h4>
      <div className="edw-form-grid">
        <label className="edw-form-field edw-form-field--wide">
          <span className="edw-form-label">岗位职责{missing("jobDescription")}</span>
          <textarea
            className="edw-input edw-textarea"
            data-testid="edcfg-vers-f-job"
            value={draft.jobDescription}
            onChange={(e) => fill("jobDescription")(e.target.value)}
            rows={3}
            disabled={saving || readOnly}
            aria-invalid={issueOf("jobDescription") ? "true" : undefined}
          />
          {issueOf("jobDescription") ? (
            <span className="edw-field-error" data-testid="edcfg-vers-issue-job">{issueOf("jobDescription")}</span>
          ) : null}
        </label>
        <label className="edw-form-field">
          <span className="edw-form-label">知识范围（一行一个）{missing("knowledgeScopes")}</span>
          <textarea
            className="edw-input edw-textarea"
            data-testid="edcfg-vers-f-scopes"
            value={draft.knowledgeScopesText}
            onChange={(e) => fill("knowledgeScopesText")(e.target.value)}
            rows={3}
            placeholder="例如 product_assistant"
            disabled={saving || readOnly}
          />
        </label>
        <label className="edw-form-field">
          <span className="edw-form-label">技能引用（一行一个）{missing("skillRefs")}</span>
          <textarea
            className="edw-input edw-textarea"
            data-testid="edcfg-vers-f-skills"
            value={draft.skillRefsText}
            onChange={(e) => fill("skillRefsText")(e.target.value)}
            rows={3}
            placeholder="没有就留空"
            disabled={saving || readOnly}
          />
        </label>
        <label className="edw-form-field edw-form-field--wide">
          <span className="edw-form-label">
            授权 ID（一行一个）{missing("grantIds")} · 本次新增 {addedGrants.length} 条
          </span>
          <textarea
            className="edw-input edw-textarea"
            data-testid="edcfg-vers-f-grants"
            value={draft.grantIdsText}
            onChange={(e) => fill("grantIdsText")(e.target.value)}
            rows={4}
            placeholder="gr_…（新建的授权在「权限与授权」节创建后把编号粘到这里）"
            disabled={saving || readOnly}
          />
          <span className="text-[11px] text-white/45" data-testid="edcfg-vers-added">
            {addedGrants.length === 0
              ? `相对 ${src} 没有新增授权（不构成提权）。`
              : `相对 ${src} 新增 ${addedGrants.length} 条授权：${addedGrants.join("、")}——提权发布需要审批引用。`}
          </span>
          {grantCandidates.length > 0 ? (
            <span className="edw-form-actions" data-testid="edcfg-vers-grant-candidates">
              <span className="text-[11px] text-white/45">有效授权里还没写进本表的：</span>
              {grantCandidates.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="edw-inline-btn"
                  disabled={saving || readOnly}
                  aria-disabled={saving || readOnly ? "true" : undefined}
                  data-testid={`edcfg-vers-add-grant-${id}`}
                  onClick={() => addGrantId(id)}
                >
                  ＋{shortCode(id)}
                </button>
              ))}
            </span>
          ) : null}
        </label>
        <label className="edw-form-field">
          <span className="edw-form-label">回复策略（JSON 对象）{missing("responsePolicy")}</span>
          <textarea
            className="edw-input edw-textarea"
            data-testid="edcfg-vers-f-policy"
            value={draft.responsePolicyText}
            onChange={(e) => fill("responsePolicyText")(e.target.value)}
            rows={6}
            disabled={saving || readOnly}
            aria-invalid={issueOf("responsePolicyText") ? "true" : undefined}
          />
          {issueOf("responsePolicyText") ? (
            <span className="edw-field-error" data-testid="edcfg-vers-issue-policy">{issueOf("responsePolicyText")}</span>
          ) : null}
        </label>
        <label className="edw-form-field">
          <span className="edw-form-label">记忆范围（JSON 对象）{missing("memoryScope")}</span>
          <textarea
            className="edw-input edw-textarea"
            data-testid="edcfg-vers-f-memory"
            value={draft.memoryScopeText}
            onChange={(e) => fill("memoryScopeText")(e.target.value)}
            rows={6}
            disabled={saving || readOnly}
            aria-invalid={issueOf("memoryScopeText") ? "true" : undefined}
          />
          {issueOf("memoryScopeText") ? (
            <span className="edw-field-error" data-testid="edcfg-vers-issue-memory">{issueOf("memoryScopeText")}</span>
          ) : null}
        </label>
        <label className="edw-form-field">
          <span className="edw-form-label">预算（JSON 对象，留空取默认预算）{missing("budget")}</span>
          <textarea
            className="edw-input edw-textarea"
            data-testid="edcfg-vers-f-budget"
            value={draft.budgetText}
            onChange={(e) => fill("budgetText")(e.target.value)}
            rows={3}
            placeholder="留空 = 后端默认预算"
            disabled={saving || readOnly}
            aria-invalid={issueOf("budgetText") ? "true" : undefined}
          />
          {issueOf("budgetText") ? (
            <span className="edw-field-error" data-testid="edcfg-vers-issue-budget">{issueOf("budgetText")}</span>
          ) : null}
        </label>
        <label className="edw-form-field">
          <span className="edw-form-label">生效时间（必须晚于上一版，留空取现在）</span>
          <input
            type="datetime-local"
            className="edw-input"
            data-testid="edcfg-vers-f-effective"
            value={draft.effectiveFrom}
            onChange={(e) => fill("effectiveFrom")(e.target.value)}
            disabled={saving || readOnly}
            aria-invalid={issueOf("effectiveFrom") ? "true" : undefined}
          />
          {issueOf("effectiveFrom") ? (
            <span className="edw-field-error" data-testid="edcfg-vers-issue-effective">{issueOf("effectiveFrom")}</span>
          ) : null}
        </label>
        <label className="edw-form-field edw-form-field--wide">
          <span className="edw-form-label">变更说明</span>
          <input
            className="edw-input"
            data-testid="edcfg-vers-f-note"
            value={draft.changeNote}
            onChange={(e) => fill("changeNote")(e.target.value)}
            placeholder="一句话说明这一版改了什么"
            disabled={saving || readOnly}
          />
        </label>
      </div>
      <div className="edw-form-actions">
        <Button
          size="sm"
          onClick={() => void submit()}
          disabled={saving || readOnly}
          aria-disabled={saving || readOnly ? "true" : undefined}
          data-testid="edcfg-vers-submit"
        >
          {saving ? "发布中…" : "发布新版本"}
        </Button>
        <span className="text-[11px] text-white/45">
          发布后版本链会多一条；新增的授权随这一版进入有效授权。
        </span>
      </div>
      {state.k === "ok" ? (
        <p className="edw-write-ok" role="status" data-testid="edcfg-vers-status">{state.text}</p>
      ) : null}
      {state.k === "error" ? (
        <p className="edw-write-error" role="alert" data-testid="edcfg-vers-error">
          {state.text}
          {state.requestId ? <span className="edw-write-rid">请求编号 {state.requestId}</span> : null}
        </p>
      ) : null}
      {readOnly ? (
        <p className="edw-write-note" data-testid="edcfg-vers-readonly">
          写口未接：本环境的后端没有接版本发布接口，本节已降级为只读；下方版本链仍按真实读口显示。
        </p>
      ) : null}
      <p className="edw-write-note">
        说明：新增授权写进 grantIds 属于提权，域侧要求审批引用才放行；没有审批引用时发布会 409，界面会如实提示。
      </p>
    </div>
  );
}

function KnowledgeSection() {
  const [spaces, spacesRetry] = useOne(`/agent-api/api/knowledge/spaces`, (b) => listAt(b, "spaces"));
  const [docs, docsRetry] = useOne(`/agent-api/api/knowledge/documents`, (b) => ({
    rows: listAt(b, "documents"),
    count: isRecord(b) ? pickNumber(b.count) : null,
    asOf: isRecord(b) ? pickString(b.asOf) : null,
  }));
  return (
    <>
      <SectionState
        resource={spaces}
        retry={spacesRetry}
        title="平台知识分区"
        prefix="edcfg-spaces"
        render={(rows) =>
          rows.length === 0 ? (
            <ZoneEmpty testid="edcfg-spaces" title="本租户暂无知识分区" hint="分区读口返回空集是服务端的真实回答，不是加载失败。" />
          ) : (
            <Card data-testid="edcfg-spaces">
              <CardContent className="p-0">
                <div className="ui-c-head">
                  <h3 className="ui-c-head-title">平台知识分区</h3>
                </div>
                <ul className="divide-y divide-white/5" data-testid="edcfg-spaces-list">
                  {rows.map((sp, i) => {
                    const status = pickString(sp.status);
                    return (
                      <li key={`${pickString(sp.space_id, sp.id) ?? i}`} className="flex min-w-0 flex-wrap items-baseline justify-between gap-2 px-4 py-3" data-testid={`edcfg-spaces-row-${i}`}>
                        <span className="min-w-0 truncate text-sm">{pickString(sp.name) ?? shortCode(pickString(sp.space_id, sp.id) ?? "")}</span>
                        <span className="text-xs text-white/55" title={status === "unverified" ? pickString(sp.failure_detail) ?? undefined : undefined}>
                          {pickNumber(sp.document_count) === null ? "文档数未回传" : `${pickNumber(sp.document_count)} 文档`}
                          {status ? ` · 校验${status === "unverified" ? "未通过" : status}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="px-4 py-2 text-[11px] text-white/45">分区为租户级列表，与单个员工的挂载范围不是一回事。</p>
              </CardContent>
            </Card>
          )
        }
      />
      <SectionState
        resource={docs}
        retry={docsRetry}
        title="知识文档"
        prefix="edcfg-docs"
        render={(page) => (
          <Card data-testid="edcfg-docs">
            <CardContent className="p-0">
              <div className="ui-c-head">
                <h3 className="ui-c-head-title">知识文档</h3>
              </div>
              {page.rows.length === 0 ? (
                <p className="px-4 py-3 text-xs text-white/55" data-testid="edcfg-docs-empty">
                  文档读口返回空集（真 0，不是加载失败）。
                </p>
              ) : (
                <ul className="divide-y divide-white/5" data-testid="edcfg-docs-list">
                  {page.rows.map((d, i) => (
                    <li key={`${pickString(d.id, d.document_id) ?? i}`} className="flex min-w-0 items-baseline justify-between gap-2 px-4 py-3" data-testid={`edcfg-docs-row-${i}`}>
                      <span className="min-w-0 truncate text-sm">{pickString(d.name, d.title) ?? "—"}</span>
                      <span className="text-xs text-white/55">{beijing(pickString(d.updatedAt, d.updated_at))}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="px-4 py-2 text-[11px] text-white/45" data-testid="edcfg-docs-count">
                共 {page.count === null ? `${page.rows.length}（count 字段未回传，按行数）` : page.count} 条{page.asOf ? ` · 采集时刻 ${beijing(page.asOf)}` : ""}
              </p>
            </CardContent>
          </Card>
        )}
      />
    </>
  );
}

/**
 * 模型与提示词 —— 真读数 + 可写的身份正文。
 *
 * 数据都在 Hermes 自己的档案接口上（同一员工 = 同一档案 `emp-<8位>`）：
 *   GET /api/profiles              模型 / provider / 显示名 / 描述
 *   GET /api/profiles/<n>/soul     身份正文（SOUL.md）
 *   PUT /api/profiles/<n>/soul     保存身份正文
 * 此前这一节写「没有任何按员工的只读读口」，是因为只查了员工域与版本域；
 * 实际上运行时档案里就有，接上即可，不需要新增后端写口。
 *
 * 纪律：档案不存在时如实说明「打开对话即自动创建」，不在这里抢先建；
 * 保存只走 PUT soul，不改 model/provider（那是运行时分的活，本页只读）。
 */
function ModelSection({ empId }: { empId: string }) {
  const profileName = employeeProfileName(empId);
  const [profiles, , , profilesRefresh] = useOne("/api/profiles", (b) => {
    const list = isRecord(b) && Array.isArray(b.profiles) ? (b.profiles as unknown[]) : [];
    return list.filter((x): x is Rec => isRecord(x));
  });
  const soulUrl = profileName ? `/api/profiles/${encodeURIComponent(profileName)}/soul` : "";
  const [soul, , replaceSoul] = useOne(soulUrl, (b) => ({
    content: isRecord(b) ? (pickString(b.content) ?? "") : "",
    exists: isRecord(b) ? b.exists === true : false,
  }));
  const [draft, setDraft] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>({ k: "idle" });

  const rec = profiles.phase === "ready" && profileName
    ? profiles.data.find((p) => pickString(p.name) === profileName) ?? null
    : null;
  const text = draft ?? (soul.phase === "ready" ? soul.data.content : "");
  const saved = soul.phase === "ready" ? soul.data.content : "";
  const soulExists = soul.phase === "ready" && soul.data.exists;
  const dirty = draft !== null && draft !== saved;
  const saving = state.k === "saving";

  const save = async () => {
    if (!profileName || saving || !dirty) return;
    setState({ k: "saving" });
    try {
      await fetchJSON<unknown>(soulUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      replaceSoul({ content: text, exists: true });
      setDraft(null);
      profilesRefresh();
      setState({ k: "ok", text: "已保存。下一次新会话生效（已打开的会话仍用旧的人格）。" });
    } catch (err: unknown) {
      const e = writeErrorText(err, "身份正文没有保存成功：");
      setState({ k: "error", text: e.text, requestId: e.requestId });
    }
  };

  if (!profileName) {
    return (
      <Card data-testid="edcfg-model">
        <CardContent className="flex flex-col items-start gap-2 p-5">
          <div className="ui-c-head"><h3 className="ui-c-head-title">模型与提示词</h3></div>
          <p className="text-xs text-white/55" data-testid="edcfg-model-note">
            这位员工的编号无法映射到运行时档案名（需要至少一位数字或字母），因此本页不展示模型与人设。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="edcfg-model">
      <CardContent className="p-0">
        <div className="ui-c-head">
          <h3 className="ui-c-head-title">模型与提示词</h3>
          <span className="font-mono text-[11px] text-white/45" data-testid="edcfg-model-profile">{profileName}</span>
        </div>

        {profiles.phase === "loading" || soul.phase === "loading" ? (
          <p className="px-4 py-3 text-xs text-white/50" data-testid="edcfg-model-loading">正在读取该员工的运行时档案…</p>
        ) : profiles.phase === "error" || soul.phase === "error" ? (
          <p className="px-4 py-3 text-xs text-white/60" data-testid="edcfg-model-error">
            运行时档案读不到（{profiles.phase === "error" ? profiles.message : soul.phase === "error" ? soul.message : ""}），
            此处不猜值；恢复后重开本节即可。
          </p>
        ) : rec === null ? (
          <p className="px-4 py-3 text-xs text-white/55" data-testid="edcfg-model-absent">
            该员工还没有运行时档案（<code className="font-mono">{profileName}</code>）：打开一次它的对话会自动创建，
            创建时按员工档案写入身份。这里不抢先建档，避免出现没有对话的空档案。
          </p>
        ) : (
          <>
            <SectionKv
              prefix="edcfg-model"
              rows={[
                { id: "model", label: "模型", value: pickString(rec.model) ?? FIELD_MISSING, title: pickString(rec.model) ? undefined : FIELD_MISSING_TITLE },
                { id: "provider", label: "提供方", value: pickString(rec.provider) ?? FIELD_MISSING, title: pickString(rec.provider) ? undefined : FIELD_MISSING_TITLE },
                { id: "display", label: "显示名", value: pickString(rec.display_name, rec.displayName) ?? FIELD_MISSING },
                { id: "desc", label: "档案说明", value: pickString(rec.description) ?? FIELD_MISSING },
              ]}
            />
            <div className="console-divider" />
            <div className="edw-form">
              <label className="edw-form-field">
                <span className="edw-form-label">身份正文（SOUL.md）</span>
                <textarea
                  className="edw-input min-h-[220px] font-mono text-xs"
                  data-testid="edcfg-model-soul"
                  value={text}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (state.k !== "idle") setState({ k: "idle" });
                  }}
                  disabled={saving}
                  spellCheck={false}
                />
              </label>
              <div className="edw-form-actions">
                <Button size="sm" onClick={() => void save()} disabled={saving || !dirty} data-testid="edcfg-model-save">
                  {saving ? "保存中…" : "保存身份正文"}
                </Button>
                {dirty && !saving ? (
                  <span className="text-[11px] text-white/60" data-testid="edcfg-model-dirty">未保存改动</span>
                ) : null}
                <Button size="sm" outlined disabled={!dirty || saving} onClick={() => { setDraft(null); setState({ k: "idle" }); }} data-testid="edcfg-model-reset">
                  放弃改动
                </Button>
              </div>
              {state.k === "ok" ? <p className="edw-write-ok" role="status" data-testid="edcfg-model-status">{state.text}</p> : null}
              {state.k === "error" ? (
                <p className="edw-write-error" role="alert" data-testid="edcfg-model-error-save">
                  {state.text}
                  {state.requestId ? <span className="edw-write-rid">请求编号 {state.requestId}</span> : null}
                </p>
              ) : null}
              <p className="edw-write-note" data-testid="edcfg-model-soul-note">
                {soulExists
                  ? "这份正文决定它「是谁」。保存后只影响新会话；正在进行的会话沿用旧值。"
                  : "该档案还没有身份正文，保存会把上面的内容写入。"}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ConfigZone({ empId, initial }: { empId: string; initial: ConfigSub }) {
  const [sub, setSub] = useState<ConfigSub>(initial);
  return (
    <RailGrid navLabel="配置分类" testid="edcfg-rail" items={CONFIG_SUBS} active={sub} onSelect={setSub}>
      {/* 保存语义先讲清楚：本页没有「草稿 → 发布」两步，保存即生效。
          用户此前反复问「保存了为什么版本没变」，根因是这层没说。 */}
      <p className="edw-write-note" data-testid="edcfg-save-semantics">
        本页的保存是<strong>立即生效</strong>，没有「草稿 → 发布」两步，也不会自动生成新版本；
        需要留版或回滚，请到「版本与变更」发布一次。
      </p>
      {sub === "identity" ? <IdentitySection empId={empId} /> : null}
      {sub === "lifecycle" ? <LifecycleSection empId={empId} /> : null}
      {sub === "permission" ? <PermissionSection empId={empId} /> : null}
      {sub === "capability" ? <CapabilitySection empId={empId} /> : null}
      {sub === "tools" ? <ToolsSection empId={empId} /> : null}
      {sub === "budget" ? <BudgetSection empId={empId} /> : null}
      {sub === "versions" ? <VersionsSection empId={empId} /> : null}
      {sub === "knowledge" ? <KnowledgeSection /> : null}
      {sub === "model" ? <ModelSection empId={empId} /> : null}
    </RailGrid>
  );
}

/* ------------------------------------------------------------------ *
 * tasks zone — 服务端按 assignee=employee:<id> 真过滤
 * ------------------------------------------------------------------ */

function TasksZone({ empId }: { empId: string }) {
  const url = empId ? `/agent-api/api/tasks?assignee=${encodeURIComponent(`employee:${empId}`)}&status=all` : "";
  const [resource, retry] = useList(url, readTasks);
  if (!empId) {
    return <ZoneEmpty testid="ed5-zone-tasks-empty" title="缺少员工编号，无法确定任务归属。" hint="本页只按该员工读取任务，不展示猜测内容。" />;
  }
  if (resource.phase === "loading") return <ZoneLoading testid="ed5-zone-tasks-loading" />;
  if (resource.phase === "denied") {
    return <ZoneDenied title="任务" message={resource.message} requestId={resource.requestId} onRetry={retry} testid="ed5-zone-tasks-denied" />;
  }
  if (resource.phase === "error") {
    return <ZoneError title="任务" message={resource.message} requestId={resource.requestId} onRetry={retry} testid="ed5-zone-tasks-error" />;
  }
  if (resource.phase === "empty") {
    return (
      <Card data-testid="ed5-zone-tasks-empty">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <Inbox className="h-6 w-6 text-white/40" />
          <p className="text-sm">该员工暂无任务。</p>
          <p className="text-xs text-white/50">
            这是服务端的真实回答：当前指派给该员工的任务为零（status=all 全状态）；本页不放宽筛选来凑数。
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card data-testid="ed5-zone-tasks">
      <CardContent className="p-0">
        <div className="hidden grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] gap-2 border-b border-white/10 px-4 py-2 text-xs text-white/45 md:grid">
          <span>任务</span>
          <span>状态</span>
          <span>优先级</span>
          <span>创建</span>
          <span>更新</span>
        </div>
        <ul className="divide-y divide-white/5" data-testid="ed5-zone-tasks-list">
          {resource.data.map((row) => (
            <li
              key={row.taskId}
              data-testid={`ed5-zone-tasks-row-${row.taskId}`}
              className="grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] md:items-center md:gap-2"
            >
              <Link
                to={`/tasks/${encodeURIComponent(row.taskId)}`}
                data-testid={`ed5-zone-tasks-name-${row.taskId}`}
                className="min-w-0 truncate text-sm hover:underline focus-visible:underline"
                title={row.taskId}
              >
                {row.title ?? `任务 · ${short8(row.taskId)}`}
              </Link>
              <span title={row.status ?? undefined}>
                <Badge>{statusLabel(row.status ?? "")}</Badge>
              </span>
              <span className="text-xs text-white/55">{priorityLabel(row.priority ?? undefined).text}</span>
              <span className="font-mono text-xs text-white/55">{beijing(row.createdAt)}</span>
              <span className="font-mono text-xs text-white/55">{beijing(row.updatedAt)}</span>
            </li>
          ))}
        </ul>
        <p className="px-4 py-2 text-[11px] text-white/45" data-testid="ed5-zone-tasks-scope">
          口径：服务端按 assignee=employee:&lt;工号&gt; 与 status=all 过滤（实测全量 20 行 → 该员工 10 行）；只读列表，迁移在任务工作台。
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * runs zone — existing run table + cost summary (usage merged in)
 * ------------------------------------------------------------------ */

/** 耗时人话：只有起止都真才计算；缺任何一段都是「—」+原因，不估。 */
function runDuration(startedAt: string | null, endedAt: string | null): { text: string; title?: string } {
  if (!startedAt || !endedAt) return { text: "—", title: endedAt ? "上游没有回传开始时间" : "运行还没有结束（或未回传结束时间）" };
  const a = Date.parse(startedAt);
  const b = Date.parse(endedAt);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return { text: "—", title: "起止时间无法计算耗时" };
  const mins = Math.max(0, Math.round((b - a) / 60_000));
  const text = mins < 60 ? `${mins} 分钟` : `${Math.floor(mins / 60)} 小时 ${mins % 60} 分`;
  return { text };
}

function runStatusLabel(value: string | null): string {
  switch (value) {
    case "completed":
    case "success":
      return "已完成";
    case "running":
    case "in_progress":
      return "运行中";
    case "failed":
    case "error":
      return "失败";
    case "cancelled":
      return "已取消";
    case "queued":
    case "pending":
      return "排队中";
    default:
      // 未识别的状态不猜：与全站口径一致「待核实」。
      return "待核实";
  }
}

function runStatusTone(value: string | null): "success" | "warning" | "destructive" | undefined {
  if (value === "completed" || value === "success") return "success";
  if (value === "running" || value === "in_progress") return "warning";
  if (value === "failed" || value === "error") return "destructive";
  return undefined;
}

function RunsZone({ empId }: { empId: string }) {
  const enc = encodeURIComponent(empId);
  const [resource, retry] = useOne(`/agent-api/api/runs?employeeId=${enc}&limit=100`, readRunsPage);
  if (resource.phase === "loading") return <ZoneLoading testid="ed5-runs-loading" />;
  if (resource.phase === "denied") {
    return <ZoneDenied title="运行" message={resource.message} requestId={resource.requestId} onRetry={retry} testid="ed5-runs-denied" />;
  }
  if (resource.phase === "error") {
    return <ZoneError title="运行" message={resource.message} requestId={resource.requestId} onRetry={retry} testid="ed5-runs-error" />;
  }
  if (resource.phase === "empty") return null; // handled inside ready branch below
  const { rows, capped } = resource.data;
  if (rows.length === 0) {
    return (
      <ZoneEmpty
        testid="ed5-runs-empty"
        title="该员工暂无运行记录"
        hint="这是按员工筛选后的真实结果（运行读口按 employeeId 过滤），不是加载失败；没有拿别人的运行凑数。"
      />
    );
  }
  return (
    <Card data-testid="ed5-runs">
      <CardContent className="p-0">
        <div className="hidden grid-cols-[minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,0.6fr)] gap-2 border-b border-white/10 px-4 py-2 text-xs text-white/45 md:grid">
          <span>运行</span>
          <span>状态</span>
          <span>开始时间</span>
          <span>耗时</span>
          <span>花费</span>
          <span>用量</span>
        </div>
        <ul className="divide-y divide-white/5" data-testid="ed5-zone-runs-list">
          {rows.map((row, i) => (
            <li key={`${row.ref ?? "run"}-${i}`} data-testid="ed5-zone-runs-row">
              <Link
                to={row.ref ? `/runs?run=${encodeURIComponent(row.ref)}` : "/runs"}
                data-testid={`ed7-runs-link-${i}`}
                title={row.ref ?? undefined}
                className="grid grid-cols-1 gap-1 px-4 py-3 hover:bg-white/5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,0.6fr)] md:items-center md:gap-2"
              >
                <span className="font-mono text-xs" title={row.ref ?? undefined} data-testid={`ed7-runs-code-${i}`}>
                  运行 · {row.ref ? shortCode(row.ref) : "—"}
                </span>
                <span title={row.status ?? undefined}>
                  <Badge tone={runStatusTone(row.status)}>{runStatusLabel(row.status)}</Badge>
                </span>
                <span className="font-mono text-xs text-white/55">{beijing(row.startedAt)}</span>
                <span
                  className="text-xs text-white/55"
                  data-testid={`ed7-runs-duration-${i}`}
                  title={runDuration(row.startedAt, row.endedAt).title}
                >
                  {runDuration(row.startedAt, row.endedAt).text}
                </span>
                <span className="text-xs text-white/55" data-testid={`ed7-runs-cost-${i}`}>
                  <Wallet className="mr-1 inline h-3.5 w-3.5 text-white/40" />
                  {money(row.cost)}
                </span>
                <span className="text-xs text-white/55">{dash(row.tokens)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="px-4 py-2 text-[11px] text-white/45" data-testid="ed5-zone-runs-scope">
          {capped
            ? "本页取最近 100 次运行（服务端提示仍有更早记录）；全量口径请到运行页查看。"
            : "本页按 employeeId 真过滤取回该员工全部运行（最近 100 次以内）。"}
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * R57: usage / cost summary — budget ledger + run stats, real data only
 * （2026-11-26 起并入 ?zone=runs，不再有独立 usage 词）
 * ------------------------------------------------------------------ */

type UsageState =
  | { phase: "loading" }
  | { phase: "error"; message: string; requestId: string | null }
  | { phase: "denied"; requestId: string | null }
  | { phase: "ready"; day: unknown; month: unknown; statsDay: unknown; statsMonth: unknown; today: string };

function usageRows(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== "object") return [];
  const items = (body as Record<string, unknown>).items;
  if (!Array.isArray(items)) return [];
  return items.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object");
}

function usageNum(obj: Record<string, unknown> | undefined, keys: string[]): number | null {
  if (!obj) return null;
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

/** ISO only (YYYY-MM-DDTHH:mm…); missing or malformed → null. Never the
 * local clock — the on-screen collection minute must come from the payload. */
function usageIso(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const v = (body as Record<string, unknown>).asOf;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
}

function usageSource(body: unknown): string {
  if (!body || typeof body !== "object") return "—";
  const v = (body as Record<string, unknown>).asOfSource;
  return typeof v === "string" && v ? v : "—";
}

function UsageZone({ empId, onRetry }: { empId: string; onRetry?: () => void }) {
  const [state, setState] = useState<UsageState>({ phase: "loading" });
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!empId) return;
    let alive = true;
    setState({ phase: "loading" });
    const enc = encodeURIComponent(empId);
    // The BJT period strings only choose WHICH day/month to ask the server
    // about (same precedent as the R54 export filename); every timestamp
    // rendered below comes from server payloads.
    const bjNow = new Date(Date.now() + 480 * 60000);
    const dayPeriod = bjNow.toISOString().slice(0, 10);
    const monthPeriod = dayPeriod.slice(0, 7);
    // R45-P0: run-stats demands full ISO-8601 timestamps (measured: a bare
    // "2026-11" is rejected with 422 Invalid isoformat string), so the day
    // and month windows are built with Date.UTC — month 12 rolls into next
    // year on its own. budget-usage keeps its YYYY-MM-DD / YYYY-MM periods.
    const y = Number(dayPeriod.slice(0, 4));
    const mo = Number(dayPeriod.slice(5, 7));
    const d = Number(dayPeriod.slice(8, 10));
    const statsFromDay = new Date(Date.UTC(y, mo - 1, d)).toISOString();
    const statsToDay = new Date(Date.UTC(y, mo - 1, d + 1)).toISOString();
    const statsFromMonth = new Date(Date.UTC(y, mo - 1, 1)).toISOString();
    const statsToMonth = new Date(Date.UTC(y, mo, 1)).toISOString();
    Promise.all([
      fetchJSON<unknown>(`/agent-api/api/budget-usage?employeeId=${enc}&periodKind=day&period=${dayPeriod}`),
      fetchJSON<unknown>(`/agent-api/api/budget-usage?employeeId=${enc}&periodKind=month&period=${monthPeriod}`),
      fetchJSON<unknown>(`/agent-api/api/run-stats?employeeId=${enc}&from=${statsFromDay}&to=${statsToDay}&bucket=day`),
      fetchJSON<unknown>(`/agent-api/api/run-stats?employeeId=${enc}&from=${statsFromMonth}&to=${statsToMonth}&bucket=day`),
    ])
      .then(([day, month, statsDay, statsMonth]) => {
        if (alive) setState({ phase: "ready", day, month, statsDay, statsMonth, today: dayPeriod });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const r = toResourceError(err);
        if (r.phase === "denied") setState({ phase: "denied", requestId: r.requestId ?? null });
        else setState({ phase: "error", message: r.message ?? "成本数据没能加载出来。", requestId: r.requestId ?? null });
      });
    return () => { alive = false; };
  }, [empId, nonce]);

  if (!empId) {
    return (
      <ZoneEmpty
        testid="ed10-usage-empty"
        title="缺少员工编号，无法确定成本归属。"
        hint="本页只按该员工读取预算账本与运行统计，不展示猜测内容。"
      />
    );
  }
  if (state.phase === "loading") return <ZoneLoading testid="ed10-usage-loading" />;
  if (state.phase === "denied") {
    return (
      <ZoneDenied
        testid="ed10-usage-denied"
        title="成本"
        message={DENIED_COPY}
        requestId={state.requestId}
        onRetry={onRetry ?? retry}
      />
    );
  }
  if (state.phase === "error") {
    return (
      <ZoneError
        testid="ed10-usage-error"
        title="成本数据没能加载出来"
        message={state.message}
        requestId={state.requestId}
        onRetry={onRetry ?? retry}
      />
    );
  }

  // R45-P0: each window reads its own run-stats leg (full ISO from/to);
  // the totals of that leg answer for that row — no bucket matching left.
  const statsDayObj = state.statsDay && typeof state.statsDay === "object" ? (state.statsDay as Record<string, unknown>) : {};
  const statsMonthObj = state.statsMonth && typeof state.statsMonth === "object" ? (state.statsMonth as Record<string, unknown>) : {};
  const dayTotals = statsDayObj.totals && typeof statsDayObj.totals === "object" ? (statsDayObj.totals as Record<string, unknown>) : undefined;
  const monthTotals = statsMonthObj.totals && typeof statsMonthObj.totals === "object" ? (statsMonthObj.totals as Record<string, unknown>) : undefined;
  const dayRuns = usageNum(dayTotals, ["runs"]);
  const monthRuns = usageNum(monthTotals, ["runs"]);

  const dayRow = usageRows(state.day)[0];
  const monthRow = usageRows(state.month)[0];
  const dayCost = usageNum(dayRow, ["costUsd", "cost_usd"]);
  const monthCost = usageNum(monthRow, ["costUsd", "cost_usd"]);

  // 全局空集=两条账本腿都没有该员工行，且运行统计的真实合计为 0（不是缺值）。
  if (!dayRow && !monthRow && monthRuns === 0) {
    return (
      <ZoneEmpty
        testid="ed10-usage-empty"
        title="该员工暂无成本记录。"
        hint="预算账本与运行统计都按该员工的 employeeId 查询（读口白名单参数，实测真过滤）；两边一致为空是服务端的真实回答，不是加载失败，也没有放宽窗口凑数。"
      />
    );
  }

  const legs = [
    {
      key: "day" as const,
      label: "今日",
      runs: dayRuns,
      runsTitle: dayRuns === null
        ? "运行统计今日窗（from/to=当日与次日 00:00:00Z）没有返回 runs 合计：缺值不作 0 处理。"
        : "来自运行统计今日窗的合计（bucket=day，employeeId 真过滤）。",
      cost: dayCost,
      costTitle: dayRow ? "预算账本该日行的实扣金额（只认真实扣费）。" : "账本在该日没有这位员工的行（missingEmployeeIds 实证）：缺失不作 $0.00。",
      body: state.day,
    },
    {
      key: "month" as const,
      label: "本月",
      runs: monthRuns,
      runsTitle: monthRuns === null
        ? "运行统计没有返回本月合计 runs：缺值不作 0。"
        : "来自运行统计本月窗口的合计（服务端真实数值，0 照写）。",
      cost: monthCost,
      costTitle: monthRow ? "预算账本本月行的实扣金额（只认真实扣费）。" : "账本在本月没有这位员工的行（missingEmployeeIds 实证）：缺失不作 $0.00。",
      body: state.month,
    },
  ];

  return (
    <Card data-testid="ed10-usage">
      <CardContent className="p-0">
        {/* UI-C2 预算区：区块头 + 数值等宽（与其余 ui-c 族同口径）。 */}
        <div className="ui-c-head">
          <h3 className="ui-c-head-title">预算与成本</h3>
        </div>
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.1fr)] gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground sm:grid">
          <span>周期</span>
          <span title="运行数取 /api/run-stats（employeeId 白名单参数，实测真过滤）。">运行数</span>
          <span title="实扣成本只认真实扣费账本 /api/budget-usage 的 costUsd：真 0 写 $0.00，缺行写「—」。">实扣成本 USD</span>
          <span title="采集时刻只取 payload 顶层 ISO asOf，绝不取本机时钟；asOfSource 见悬停。">采集时刻</span>
        </div>
        <ul className="divide-y divide-border">
          {legs.map((leg) => {
            const iso = usageIso(leg.body);
            return (
              <li
                key={leg.key}
                data-testid={`ed10-usage-row-${leg.key}`}
                className="grid grid-cols-1 gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.1fr)] sm:items-center sm:gap-2"
              >
                <span className="min-w-0 truncate" title="周期聚合行：本页没有按成本行的专属深链；单条运行见上方运行表。">
                  {leg.label}
                </span>
                <span className="font-mono ui-c-num text-xs" data-testid={`ed10-usage-runs-${leg.key}`} title={leg.runsTitle}>
                  {leg.runs === null ? "—" : leg.runs}
                </span>
                <span className="font-mono ui-c-num text-xs" data-testid={`ed10-usage-cost-${leg.key}`} title={leg.costTitle}>
                  {money(leg.cost ?? undefined)}
                </span>
                <span
                  className="font-mono ui-c-num text-xs text-muted-foreground"
                  data-testid={`ed10-usage-asof-${leg.key}`}
                  title={iso ? `payload asOf=${iso} · 来源 ${usageSource(leg.body)}` : "payload 顶层没有 ISO 格式的 asOf（或形态非法）：不用本机时钟补时。"}
                >
                  {iso ? beijing(iso) : "—"}
                </span>
              </li>
            );
          })}
        </ul>
        {/* R87: 成本口径互指。ui2 的 COST_CALIBER_TEXT 语义相同但各写常量
            （用例以 ?raw 断言两处关键短语同族），不做跨模块 import。 */}
        <p
          className="px-4 pb-1 text-xs text-muted-foreground"
          data-testid="ed10-cost-caliber"
          title="口径互指：/metrics 的成本视图同样只认平台扣费账本的实扣金额（「实扣」「平台扣费账本」句族）；运行次数来自运行统计，与成本不同口径。"
        >
          成本为账本实扣金额；与 /metrics 的成本视图口径一致，与运行次数口径不同
        </p>
        <p
          className="px-4 py-2 text-xs text-muted-foreground"
          title="BFF 白名单：budget-usage 必带 employeeId+period（实测缺 period 400 console.missing_param；periodKind 缺省按 day），run-stats 必带 from/to（实测 bucket=month 422）。"
        >
          只读聚合：实扣认预算账本、运行数认运行统计，两读口均按 employeeId 真过滤；这里只提供查看，操作暂不在本页进行。
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * evidence zone — 左竖栏（审批 / 审计 / 会话）+ 右内容
 * ------------------------------------------------------------------ */

function ApprovalsZone({ empId }: { empId: string }) {
  // 上游确认（2026-11-26 实测）：employeeId/assignee/requestedBy 都不改变返回
  // 集合（聚合 16 行含他人行）。因此这里读聚合、在本页按 requestedBy/requester
  // 的 id 前端筛选，并把口径 11px 写在屏上，不把「全量」伪装成「该员工的」。
  const [resource, retry] = useOne(`/agent-api/api/approvals?status=all&limit=200`, (b) => {
    const all = readApprovals(b);
    return { all, mine: all.filter((r) => r.requesterId !== null && r.requesterId === empId) };
  });
  // R86: 单一播报节点（签名派生句）——每相都挂同一个 apv-live。
  const count = resource.phase === "ready" ? resource.data.mine.length : 0;
  const live = (
    <p className="sr-only" role="status" aria-live="polite" data-testid="apv-live">
      {announcement(resource.phase === "empty" ? "empty" : resource.phase, count)}
    </p>
  );
  if (resource.phase === "loading") {
    return (
      <>
        {live}
        <ZoneLoading testid="ed5-approvals-loading" />
      </>
    );
  }
  if (resource.phase === "denied") {
    return (
      <>
        {live}
        {/* R93: 与队列 DeniedPanel 同一句族（stateCopy 单点）；403≡404 同体。 */}
        <Card data-testid="ed5-approvals-denied">
          <CardContent className="flex flex-col items-start gap-3 p-5">
            <ShieldAlert className="h-5 w-5 text-amber-400" />
            <p className="text-sm">{APPROVAL_DENIED_TITLE}</p>
            <p className="text-xs text-white/55">{APPROVAL_DENIED_BODY}</p>
            <p className="font-mono text-xs text-white/45">
              <RequestIdCopy requestId={resource.requestId ?? null} fallback={APPROVAL_RID_FALLBACK} />
            </p>
            <Button size="sm" outlined onClick={retry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {APPROVAL_RETRY_LABEL}
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }
  if (resource.phase === "error") {
    return (
      <>
        {live}
        {/* R93: 首句与队列 ErrorPanel 同值（stateCopy 单点）；动态原因句各读口自出。 */}
        <Card data-testid="ed5-approvals-error">
          <CardContent className="flex flex-col items-start gap-3 p-5">
            <TriangleAlert className="h-5 w-5 text-amber-400" />
            <p className="text-sm">{APPROVAL_FAILED_TITLE}</p>
            <p className="text-xs text-white/55">{resource.message}</p>
            <p className="font-mono text-xs text-white/45">
              <RequestIdCopy requestId={resource.requestId} fallback={APPROVAL_RID_FALLBACK} />
            </p>
            <Button size="sm" outlined onClick={retry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {APPROVAL_RETRY_LABEL}
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }
  if (resource.phase === "empty") return null;
  const { all, mine } = resource.data;
  if (mine.length === 0) {
    return (
      <>
        {live}
        <Card data-testid="ed5-approvals-empty">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Inbox className="h-6 w-6 text-white/40" />
            <p className="text-sm">{all.length === 0 ? APPROVAL_EMPTY_SENTENCE : "该员工没有审批请求"}</p>
            <p className="text-xs text-white/50">
              {all.length === 0
                ? "审批读口聚合为空集：不是加载失败，也不是把缺失当 0。"
                : `服务端返回聚合 ${all.length} 条，本页按申请人前端筛选后为 0 条；不放宽口径凑数。`}
            </p>
            {/* 口径常驻：无论有行还是空集，审批读口都不是按员工过滤的。 */}
            <p
              className="px-4 pb-3 pt-1 text-[11px] text-white/45"
              data-testid="ed8-appr-note"
              title="实测（本代次）：requestedBy/employeeId/assignee 参数都不改变返回集合（聚合 16 行含他人行）；本页按 requestedBy 的 id 前端筛选，该员工 9 条口径由回包派生。"
            >
              服务端未按员工过滤，本页为前端筛选（聚合 {all.length} 条中该员工 0 条）。
            </p>
          </CardContent>
        </Card>
      </>
    );
  }
  return (
    <>
      {live}
      <Card data-testid="ed5-approvals">
        <CardContent className="p-0">
          <p
            className="px-4 pt-3 text-[11px] text-white/45"
            data-testid="ed8-appr-note"
            title="实测（本代次）：requestedBy/employeeId/assignee 参数都不改变返回集合（聚合 16 行含他人行）；本页按 requestedBy 的 id 前端筛选，该员工 9 条口径由回包派生。"
          >
            服务端未按员工过滤，本页为前端筛选（聚合 {all.length} 条中该员工 {mine.length} 条）。
          </p>
          {/* R89: 聚合读口有游标回包（nextCursor），本页取单页上限内全部行做前端筛；
              上限如实写在 data 属性与句子里，不伪造「加载更多」。 */}
          <p
            className="border-t border-white/5 px-4 pb-3 pt-2 text-xs text-muted-foreground"
            data-testid="ed8-appr-scope"
            data-ed8-appr-scope="aggregate-cap-200"
            title="实测（本代次）：status=all&limit=200 返回聚合 16 行；本页单页上限按请求口径为 200 条，超出部分请到审批队列查看，不在这里伪造加载更多。"
          >
            本区按聚合口径单页最多 200 条，超出部分请到
            <Link to="/approvals?status=all" className="mx-1 underline underline-offset-2" data-testid="ed8-appr-scope-queue">
              审批队列
            </Link>
            按状态筛选查看。
          </p>
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_minmax(0,0.8fr)] gap-2 border-b border-white/10 px-4 py-2 text-xs text-white/45 md:grid">
            <span>事项</span>
            <span>状态</span>
            <span>风险档</span>
            <span title="口径：更新时间 updatedAt（缺则「该字段未返回」），与审批队列同一相对时间显示；悬停看绝对北京时间到秒与 ISO 原文">更新时间</span>
          </div>
          <ul className="divide-y divide-white/5">
            {mine.map((row, i) => {
              const label = row.title ?? (row.ref ? `审批单 · ${shortCode(row.ref)}` : "审批事项");
              // R78 parity: 队列单点助手 riskView/statusView/RelativeTime — 同值同句。
              const risk = riskView(row.risk);
              const sv = statusView(row.status);
              // R78 parity: 更新时间与队列同一来源键（不再回退提交时间）；
              // 缺值=RelativeTime 的「该字段未返回」句，两处同形制。
              const updated = row.updatedAt;
              const inner = (
                <>
                  <span className="min-w-0 truncate text-sm" data-testid={`ed8-appr-title-${i}`}>{label}</span>
                  <span data-testid={`ed8-appr-status-${i}`} title={sv.raw ?? "原始状态值未返回"}>
                    <Badge tone={approvalStatusTone(row.status)}>{sv.label}</Badge>
                  </span>
                  <span className="text-xs text-white/55" data-testid={`ed8-appr-risk-${i}`} title={risk.raw ?? "该字段未返回"}>
                    {risk.label}
                  </span>
                  <span className="font-mono text-xs text-white/55">
                    <RelativeTime iso={updated} testid={`ed8-appr-time-${i}`} />
                  </span>
                </>
              );
              const grid = "grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_minmax(0,0.8fr)] md:items-center md:gap-2";
              // 行出口：既有可达落点 = 审批队列并保留该行状态筛选（本代次无 /approvals/:id 详情路由）。
              const href = row.status ? `/approvals?status=${encodeURIComponent(row.status)}` : "/approvals";
              return row.ref ? (
                <li key={`${row.ref}-${i}`} data-testid={`ed8-appr-row-${i}`}>
                  <Link to={href} title={row.ref} className={grid} data-testid={`ed8-appr-link-${i}`}>
                    {inner}
                  </Link>
                </li>
              ) : (
                <li key={`row-${i}`} className={grid} data-testid={`ed8-appr-row-${i}`}>
                  {inner}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function AuditZone({ empId }: { empId: string }) {
  const enc = encodeURIComponent(empId);
  const [resource, retry] = useList(`/agent-api/api/audit?resourceId=${enc}&limit=200`, readAudit);
  if (resource.phase === "loading") return <ZoneLoading testid="ed5-audit-loading" />;
  if (resource.phase === "empty") {
    return (
      <ZoneEmpty
        title="还没有审计记录"
        hint="涉及这位员工的敏感操作会逐条记在这里（服务端按 resourceId=该员工工号过滤）。"
        testid="ed5-audit-empty"
      />
    );
  }
  if (resource.phase === "denied") {
    return <ZoneDenied title="审计" message={resource.message} requestId={resource.requestId} onRetry={retry} testid="ed5-audit-denied" />;
  }
  if (resource.phase !== "ready") {
    return (
      <ZoneError
        title="审计"
        message={resource.phase === "error" ? resource.message : ""}
        requestId={resource.phase === "error" ? resource.requestId : null}
        onRetry={retry}
        testid="ed5-audit-error"
      />
    );
  }
  return (
    <Card data-testid="ed5-audit">
      <CardContent className="p-0">
        <div className="hidden grid-cols-[minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,0.7fr)_minmax(0,1fr)] gap-2 border-b border-white/10 px-4 py-2 text-xs text-white/45 md:grid">
          <span>时间</span>
          <span>操作人</span>
          <span>动作</span>
          <span>说明</span>
        </div>
        <ul className="divide-y divide-white/5" data-testid="ed5-zone-audit-list">
          {resource.data.map((row, i) => (
            <li key={`${row.at ?? "at"}-${i}`} data-testid="ed5-zone-audit-row" className="grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,0.7fr)_minmax(0,1fr)] md:items-center md:gap-2">
              <span className="font-mono text-xs text-white/60">
                <ClipboardCheck className="mr-2 inline h-4 w-4 text-white/35" />
                {beijing(row.at)}
              </span>
              <span className="min-w-0 truncate text-xs" title={row.actor ?? undefined}>
                {row.actorType === "system" ? "系统操作" : actorLabel(row.actor)}
              </span>
              <span className="text-sm" title={row.action ?? undefined}>
                {actionLabel(row.action)}
              </span>
              <span className="text-xs text-white/60" title={row.outcome ?? undefined}>
                {row.outcome === "success" ? "成功" : row.outcome === "failure" ? "失败" : row.outcome === "denied" ? "拒绝" : row.outcome ? "待核实" : "—"}
              </span>
              <span className="min-w-0 truncate text-xs text-white/55">{dash(row.detail)}</span>
              <span className="min-w-0 text-xs">
                <RequestIdCopy requestId={row.requestId} fallback="这条记录未携带编号" />
              </span>
            </li>
          ))}
        </ul>
        <p className="px-4 py-2 text-[11px] text-white/45" data-testid="ed5-zone-audit-scope">
          口径：审计读口按 resourceId=该员工工号做服务端过滤（实测不同工号返回不同集合），与审批区的前端筛选不是一回事。
        </p>
      </CardContent>
    </Card>
  );
}

function SessionsZone({ empId }: { empId: string }) {
  // SE-03: 行内「详情」打开消息流抽屉；抽屉自己拉详情读口，列表数据零复制。
  const enc = encodeURIComponent(empId);
  const [resource, retry] = useList(`/agent-api/api/console-sessions?employeeId=${enc}&limit=20`, readSessions);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  if (!empId) {
    return <ZoneEmpty testid="ed9-sessions-empty" title="缺少员工编号，无法确定会话归属。" hint="本页只按该员工读取会话列表，不展示猜测内容。" />;
  }
  if (resource.phase === "loading") return <ZoneLoading testid="ed9-sessions-loading" />;
  if (resource.phase === "denied") {
    return <ZoneDenied title="会话列表" message={resource.message} requestId={resource.requestId} onRetry={retry} testid="ed9-sessions-denied" />;
  }
  if (resource.phase === "error") {
    return <ZoneError title="会话列表" message={resource.message} requestId={resource.requestId} onRetry={retry} testid="ed9-sessions-error" />;
  }
  if (resource.phase === "empty") {
    return (
      <Card data-testid="ed9-sessions-empty">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <Inbox className="h-6 w-6 text-white/40" />
          <p className="text-sm">该员工暂无可查会话。</p>
          <p className="text-xs text-white/50">
            请求带了该员工的 employeeId（读口白名单参数），这是服务端的真实空集；不是加载失败，也不在这里造会话。
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <>
      <Card data-testid="ed9-sessions">
        <CardContent className="p-0">
          <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_minmax(0,0.7fr)_minmax(0,0.9fr)] gap-2 border-b border-white/10 px-4 py-2 text-xs text-white/45 md:grid">
            <span>会话</span>
            <span>渠道</span>
            <span>消息数</span>
            <span>状态</span>
            <span title="口径：updated_at（北京时间切到分）">最近活动</span>
          </div>
          <ul className="divide-y divide-white/5" data-testid="ed9-sessions-list">
            {resource.data.map((row, i) => {
              const ch = channelLabel(row.channel);
              const st = sessionStatusLabel(row.status);
              return (
                <li
                  key={`${row.ref ?? "session"}-${i}`}
                  data-testid={`ed9-sessions-row-${i}`}
                  className="grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)_minmax(0,0.6fr)_minmax(0,0.7fr)_minmax(0,0.9fr)] md:items-center md:gap-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Link
                      to="/chat"
                      data-testid={`ed9-sessions-link-${i}`}
                      title={row.ref ?? undefined}
                      className="min-w-0 flex-1 truncate text-sm no-underline hover:underline focus-visible:underline"
                    >
                      {row.title ?? `会话 · ${row.ref ? shortCode(row.ref) : "待核实"}`}
                    </Link>
                    {row.ref ? (
                      <button
                        type="button"
                        data-testid={`ed9-sessions-detail-${i}`}
                        onClick={() => setDrawerId(row.ref)}
                        title={`读取会话 ${row.ref} 的全量消息`}
                        className="shrink-0 rounded-sm border border-white/15 px-1.5 py-1 text-[11px] text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/40"
                      >
                        详情
                      </button>
                    ) : null}
                  </div>
                  <span className="text-xs text-white/55" data-testid={`ed9-sessions-channel-${i}`} title={ch.title}>
                    {ch.text}
                  </span>
                  <span
                    className="text-xs text-white/55"
                    data-testid={`ed9-sessions-count-${i}`}
                    title={row.messages === null ? "上游没有回传该会话的消息数或轮次。" : undefined}
                  >
                    {row.messages === null ? "—" : `${row.messages} 条`}
                  </span>
                  <span className="text-xs text-white/55" data-testid={`ed9-sessions-state-${i}`} title={st.title}>
                    {st.text}
                  </span>
                  <span className="font-mono text-xs text-white/55" data-testid={`ed9-sessions-time-${i}`}>
                    {beijing(row.lastAt)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="px-4 py-2 text-xs text-white/45">
            只读列表 · 本页不提供会话创建或消息写入；要继续聊天请前往“对话”页（全站唯一承载）。
            点行内「详情」读取该会话的全量消息流与引用，并在抽屉底部续跑下一轮（SE-03 读 / SE-05 写）。
          </p>
        </CardContent>
      </Card>
      {drawerId ? <SessionDrawer sessionId={drawerId} onClose={() => setDrawerId(null)} /> : null}
    </>
  );
}

function EvidenceZone({ empId, initial }: { empId: string; initial: EvidenceSub }) {
  const [sub, setSub] = useState<EvidenceSub>(initial);
  return (
    <RailGrid navLabel="证据分类" testid="edevi-rail" items={EVIDENCE_SUBS} active={sub} onSelect={setSub}>
      {sub === "approvals" ? <ApprovalsZone empId={empId} /> : null}
      {sub === "audit" ? <AuditZone empId={empId} /> : null}
      {sub === "sessions" ? <SessionsZone empId={empId} /> : null}
    </RailGrid>
  );
}

/* ------------------------------------------------------------------ *
 * page
 * ------------------------------------------------------------------ */

export default function EmployeeDetailModulePage({ employeeId }: { employeeId?: string }) {
  const params = useParams<{ employeeId: string; id: string }>();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const empId =
    employeeId?.trim() ||
    (params.employeeId ? decodeURIComponent(params.employeeId) : "") ||
    (params.id ? decodeURIComponent(params.id) : "");
  // 分区来源两处：?zone= 查询词，以及外壳的分段路由
  // /employees/:id/config|tasks|runs|evidence（那里没有查询词，
  // 全靠路径段；不读它就会出现「外壳亮着配置、内容却是概览」）。
  const location = useLocation();
  const segmentZone = location.pathname.split("/").filter(Boolean).pop() ?? "";
  const rawZone = sp.get("zone") ?? (["config", "tasks", "runs", "evidence"].includes(segmentZone) ? segmentZone : "");
  const parsed = parseShellZone(rawZone ?? "");

  const [overviewNonce, setOverviewNonce] = useState(0);
  const overview = useOverview(empId, overviewNonce);

  const name = overview.phase === "ready" ? pickString(overview.data.name) : null;
  const titleJob = overview.phase === "ready" ? pickString(overview.data.title, overview.data.role, overview.data.position) : null;
  const lifecycle = overview.phase === "ready" ? pickString(overview.data.lifecycleState, overview.data.lifecycle) : null;
  // UI-C2: 头部补部门。三态与列表桶/身份卡共用同一 departmentView helper，
  // 禁第二套判据；未 ready 时整段不渲，不占「—」位。
  const headerDept =
    overview.phase === "ready"
      ? departmentView(
          "department" in overview.data,
          typeof overview.data.department === "string" ? overview.data.department : null,
        )
      : null;

  const header = (
    <header className="flex min-w-0 flex-wrap items-center gap-3">
      {/* 全页唯一 h1 归外壳页面标题；分区页标题同为 h2，视觉与文本契约不变。 */}
      <div className="min-w-0">
        <h2 className="truncate font-mondwest text-xl" title={empId || undefined}>
          {name ? `${name} · ${shortCode(empId)}` : empId ? `员工 · ${shortCode(empId)}` : "员工详情"}
        </h2>
        <p className="flex min-w-0 flex-wrap gap-x-2 text-xs text-white/50">
          <span className="min-w-0">{dash(titleJob)}</span>
          {headerDept ? (
            <span className="min-w-0" title={headerDept.title ?? undefined}>
              部门 · {headerDept.label}
            </span>
          ) : null}
        </p>
      </div>
      {overview.phase === "ready" ? (
        <Badge tone={lifecycleTone(lifecycle)}>{lifecycleLabel(lifecycle)}</Badge>
      ) : null}
      {/* R47: 返回走真实历史后退，来源列表的筛选 query 原样保留；
          直开无栈时由页内 Link 出口兜底（带本页可见的 query）。 */}
      <Button
        size="sm"
        outlined
        data-testid="edx-back"
        onClick={() => navigate(-1)}
        title="返回上一页（保留列表筛选条件）"
      >
        返回
      </Button>
    </header>
  );

  return (
    <section className="min-w-0 space-y-4" data-testid="ed5-module">
      {header}

      {/* 2026-11-26 收口：模块内两排导航（SEGMENTS「分区」条 + 「小节」锚点条）
          全部删除。全页唯一 role="tablist" 是外壳 zone 条；本组件零 tab 角色，
          配置与证据用左侧竖向 <nav> 分类栏（375 收进「分类」下拉）。 */}
      {parsed.unknown ? (
        <p className="text-xs text-amber-400" data-testid="ed5-zone-unknown" title={`原始 zone 词：${rawZone ?? "—"}（未识别，不猜）`}>
          未识别的分区，已回到工作台
        </p>
      ) : null}

      {parsed.zone === "workbench" ? <OverviewZone state={overview} onRetry={() => setOverviewNonce((n) => n + 1)} empId={empId} /> : null}
      {parsed.zone === "config" ? <ConfigZone key={`cfg:${parsed.configSub}`} empId={empId} initial={parsed.configSub} /> : null}
      {parsed.zone === "tasks" ? <TasksZone empId={empId} /> : null}
      {parsed.zone === "runs" ? (
        <div className="min-w-0 space-y-4" data-testid="ed5-zone-runs-wrap">
          <RunsZone empId={empId} />
          <UsageZone empId={empId} />
        </div>
      ) : null}
      {parsed.zone === "evidence" ? <EvidenceZone key={`evi:${parsed.evidenceSub}`} empId={empId} initial={parsed.evidenceSub} /> : null}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * overview (identity / job / on-duty) — employees/:id, fallback matrix/:id
 * ------------------------------------------------------------------ */

type OverviewState =
  | { phase: "loading" }
  | { phase: "empty" }
  | { phase: "denied"; message: string; requestId: string | null }
  | { phase: "error"; message: string; requestId: string | null }
  /** R28-1: the backend said this id does not exist (or we may not see it). */
  | { phase: "notfound"; requestId: string | null }
  | { phase: "ready"; data: Rec };

function useOverview(empId: string, nonce: number): OverviewState {
  const [state, setState] = useState<OverviewState>({ phase: "loading" });

  useEffect(() => {
    if (!empId) {
      setState({ phase: "empty" });
      return;
    }
    let cancelled = false;
    setState({ phase: "loading" });
    fetchJSON<unknown>(`/agent-api/api/employees/${encodeURIComponent(empId)}`)
      .then((body) => {
        if (cancelled) return;
        // `{}` from the detail route means "no profile here" — say it as an
        // empty state, never render a card of dashes.
        if (isRecord(body) && Object.keys(body).length > 0) {
          // R28-1: even a 200 body must BE this employee — a borrowed
          // record (name or budget) for an unknown id is fabrication.
          const gotKey = pickString(body.employeeId, body.employee_id, body.id);
          if (gotKey && gotKey !== empId) {
            setState({ phase: "notfound", requestId: null });
            return;
          }
          setState({ phase: "ready", data: body });
        } else {
          setState({ phase: "empty" });
        }
      })
      .catch(async (err: unknown) => {
        if (cancelled) return;
        // The list endpoint is the employee source of truth; if the detail
        // route is not wired yet, fall back to the matrix row (same source
        // the capability zone reuses — see file header).
        const status = err instanceof ApiError ? err.status : undefined;
        if (status === 403) {
          setState({ phase: "denied", message: DENIED_COPY, requestId: err instanceof ApiError ? (err.requestId ?? null) : null });
          return;
        }
        try {
          const body = await fetchJSON<unknown>(`/agent-api/api/matrix?employee=${encodeURIComponent(empId)}`);
          if (cancelled) return;
          const first = itemsOf(body)[0];
          // R28-1: only a row that IS this employee may render. Borrowing a
          // real name or budget for an unknown id is fabrication, so an
          // absent/401'd/404'd detail with a mismatched row says not-found.
          const rowKey = first ? pickString(first.employeeId, first.employee_id, first.id) : null;
          if (first && (rowKey === null || rowKey === empId)) setState({ phase: "ready", data: first });
          else if (status === 404 || status === 401)
            setState({
              phase: "notfound",
              requestId: err instanceof ApiError ? (err.requestId ?? null) : null,
            });
          // No detail row and no matrix row for this id: the employee simply
          // is not in the directory — say so plainly (empty), do not blame
          // the wiring.
          else setState({ phase: "empty" });
        } catch (err2: unknown) {
          if (cancelled) return;
          const r = toResourceError(err2);
          if (r.phase === "denied" && status === 404) {
            setState({ phase: "denied", message: DENIED_COPY, requestId: r.requestId ?? null });
          } else if (r.phase === "error") {
            setState({ phase: "error", message: r.message, requestId: r.requestId });
          } else {
            setState(status ? toResourceError(err) : r);
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [empId, nonce]);

  return state;
}

/**
 * R45 · the identity card on the workbench zone. Every field comes from the
 * same detail body the overview already trusts; anything the backend did
 * not answer renders "—" with the reason in the title — never a 0, never a
 * placeholder.
 */
function IdentityCard({ d, empId }: { d: Rec; empId: string }) {
  const name = pickString(d.name);
  const role = pickString(d.title, d.role, d.position);
  const stateRaw = pickString(d.lifecycleState, d.lifecycle);
  const stateLabel = rosterLifecycleLabel(stateRaw);
  const ridRaw = pickString(d.requestId, d.request_id);
  // R96: 部门三态与列表桶同一 helper（禁第二套判据）。
  const dept = departmentView("department" in d, typeof d.department === "string" ? d.department : null);
  const reportsTo = pickString(d.reportsTo, d.reports_to, d.managerEmployeeId, d.manager);
  const reportsName = pickString(d.reportsToName, d.managerName);
  const created = pickString(d.createdAt, d.created_at);
  const reportsValue = reportsTo ? (
    <Link
      className="underline underline-offset-2"
      to={`/employees/${encodeURIComponent(reportsTo.replace(/^employee:/i, ""))}`}
      title={reportsTo}
    >
      {reportsName ? `${reportsName} · ${shortCode(reportsTo.replace(/^employee:/i, ""))}` : shortCode(reportsTo.replace(/^employee:/i, ""))}
    </Link>
  ) : (
    <span>—</span>
  );
  return (
    <Card className="min-w-0" data-testid="ed1-identity">
      <CardContent className="p-0">
        <div className="ui-c-head">
          <h3 className="ui-c-head-title">身份与组织</h3>
        </div>
        {/* UI-C2: 卡内三段（身份/组织/生命周期）；2026-11-26 收口后原
            「小节」锚点条已删，段标题直接上屏，字段、testid、缺值话术零改动。 */}
        <div>
          <h4 className="ui-c-subhead">身份</h4>
          <dl className="ui-c-fields ui-c-fields--two">
            <IdentityField id="name" label="姓名" title={name ? undefined : FIELD_MISSING_TITLE}>
              {name ?? FIELD_MISSING}
            </IdentityField>
            <IdentityField id="code" label="工号" title={empId}>
              {employeeCode(empId)}
            </IdentityField>
            <IdentityField id="role" label="角色" title={role ? undefined : FIELD_MISSING_TITLE}>
              {role ?? FIELD_MISSING}
            </IdentityField>
            <IdentityField id="rid" label="请求编号" title={ridRaw ? undefined : FIELD_MISSING_TITLE}>
              <RequestIdCopy requestId={ridRaw ?? null} fallback={fieldMissing("请求编号")} />
            </IdentityField>
          </dl>
        </div>
        <div>
          <h4 className="ui-c-subhead">组织</h4>
          <dl className="ui-c-fields ui-c-fields--two">
            <IdentityField id="department" label="部门" title={dept.title ?? undefined}>
              {dept.label}
            </IdentityField>
            <IdentityField id="reports" label="汇报对象" title={reportsTo ? undefined : "后台没有回传这位员工的汇报对象。"}>
              {reportsValue}
            </IdentityField>
          </dl>
        </div>
        <div>
          <h4 className="ui-c-subhead">生命周期</h4>
          <dl className="ui-c-fields ui-c-fields--two">
            <IdentityField id="state" label="在职态" title={stateRaw ? `原始值：${stateRaw}` : FIELD_MISSING_TITLE}>
              {stateLabel}
            </IdentityField>
            <IdentityField id="created" label="创建时间" num title={created ? "北京时间，精确到分" : FIELD_MISSING_TITLE}>
              {created ? beijing(created) : FIELD_MISSING}
            </IdentityField>
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

function IdentityField({ id, label, children, title, num }: { id: string; label: string; children: React.ReactNode; title?: string | null; num?: boolean }) {
  return (
    <div className="ui-c-field">
      <dt className="ui-c-field-label">{label}</dt>
      <dd className={num ? "ui-c-field-value ui-c-num" : "ui-c-field-value"} data-testid={`ed1-identity-${id}`} title={title ?? undefined}>
        {children}
      </dd>
    </div>
  );
}

function OverviewZone({ state, onRetry, empId }: { state: OverviewState; onRetry: () => void; empId: string }) {
  if (state.phase === "loading") return <ZoneLoading testid="ed5-overview-loading" />;
  if (state.phase === "empty") {
    return (
      <ZoneEmpty
        title="还没找到这位员工的档案"
        hint="可能刚被移除，或后台还没同步。稍后重试，或回到列表确认。"
        testid="ed5-overview-empty"
      />
    );
  }
  if (state.phase === "denied") {
    return <ZoneDenied title="员工档案" message={state.message} requestId={state.requestId} onRetry={onRetry} testid="ed5-overview-denied" />;
  }
  if (state.phase === "notfound") {
    return (
      <Card data-testid="ed5-overview-notfound">
        <CardContent className="flex flex-col items-start gap-2 p-4">
          <p className="text-sm">员工不存在或无权查看。</p>
          <p className="text-xs text-white/45">
            <RequestIdCopy
              requestId={state.requestId}
              fallback="本次请求没有带回编号；可复制时间与页面路径反馈。"
            />
          </p>
          <Link className="text-xs underline underline-offset-2" to="/employees">
            返回员工列表
          </Link>
        </CardContent>
      </Card>
    );
  }
  if (state.phase === "error") {
    return (
      <ZoneError
        title="员工档案"
        message={state.message}
        requestId={state.requestId}
        onRetry={onRetry}
        testid="ed5-overview-error"
      />
    );
  }
  const d = state.data;
  const budget = isRecord(d.budget) ? d.budget : null;
  const rows: Array<{ label: string; value: string; raw?: string | null; num?: boolean }> = [
    { label: "身份", value: pickString(d.name) ? `${pickString(d.name)} · ${shortCode(empId)}` : `员工 · ${shortCode(empId)}`, raw: empId },
    { label: "岗位", value: dash(pickString(d.title, d.role, d.position)) },
    { label: "在岗状态", value: lifecycleLabel(pickString(d.lifecycleState, d.lifecycle)) },
    { label: "责任人", value: actorLabel(pickString(d.ownerUserId, d.owner, d.ownerName)) },
    { label: "最近活动", value: beijing(pickString(d.lastActiveAt, d.updatedAt, d.updated_at)), num: true },
    { label: "月度预算", value: money(pickNumber(d.monthlyBudgetUsd, budget?.monthlyCostUsd)), num: true },
  ];
  return (
    <div className="min-w-0 space-y-4" data-testid="ed5-overview-wrap">
      <IdentityCard d={d} empId={empId} />
      <div>
      <Card className="min-w-0" data-testid="ed5-overview">
        <CardContent className="p-0">
          <div className="ui-c-head">
            <h3 className="ui-c-head-title">在岗与最近活跃</h3>
          </div>
          {/* UI-C2 在岗区：行式改两列标签值栅格（RUBRIC 同族），
              行序/dd 的 title 契约逐字保留，缺值仍「—」，375 单列。 */}
          <dl className="ui-c-fields ui-c-fields--two">
            {rows.map((r) => (
              <div key={r.label} className="ui-c-field">
                <dt className="ui-c-field-label">{r.label}</dt>
                <dd className={r.num ? "ui-c-field-value ui-c-num" : "ui-c-field-value"} title={r.raw ?? undefined}>
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
