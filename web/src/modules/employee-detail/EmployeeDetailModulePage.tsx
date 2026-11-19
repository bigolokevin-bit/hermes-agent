/**
 * T18 · employee detail module page — five zones (概览 / 能力与权限 / 审批 /
 * 运行 / 审计), stage-2 delivery for lane B.
 *
 * Mount path: `shell/bridge.ts` probes `../modules/employee-detail/
 * EmployeeDetailModulePage.tsx` first (candidate 1 of DetailModulePage);
 * when this file exists, `ConsoleEmployeeDetailPage` renders it below the
 * shell zone strip and it owns the whole detail pane. The manifest stays
 * `kind: 'planned'` on purpose — the registry has no detail render path and
 * flipping it could break registry snapshot tests (assumption recorded in
 * manifest.ts and docs/_artifacts/emp-detail/DONE.md).
 *
 * Data-source reuse (lint-reuse R4):
 *   reuse: /v1/matrix/employees   ← 能力与权限区命中的真实数据源；本模块经
 *   BFF 别名 `/agent-api/api/matrix` 调用，端点缺失时如实展示「未接入」态。
 *
 * Deliberately NOT present here (lint-reuse R2/R3, zero-engineering language):
 * no shell chat-surface element or attribute, none of the five §11 shell
 * surface components are pulled in, no hardcoded per-employee capability
 * lists, and raw ids (employee / run / task prefixes) never leak into
 * visible text — they live in `title` attributes only.
 */
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ClipboardCheck, Gauge, Inbox, RefreshCw, ShieldAlert, TriangleAlert, Wallet } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";

import { RequestIdCopy } from "@/components/RequestIdCopy";
import { priorityLabel, short8, statusLabel } from "@/modules/tasks/tasksBoard";
import { fetchJSON } from "@/lib/api";
import { API_UNREACHABLE_MESSAGE, ApiError, humanizeStatus } from "@/lib/api-error";

/* ------------------------------------------------------------------ *
 * types & small readers
 * ------------------------------------------------------------------ */

type Rec = Record<string, unknown>;

type Resource<T> =
  | { phase: "loading" }
  | { phase: "empty" }
  | { phase: "ready"; data: T }
  | { phase: "denied"; message: string }
  | { phase: "error"; message: string; requestId: string | null };

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

/* ------------------------------------------------------------------ *
 * display formatting (zero engineering language)
 * ------------------------------------------------------------------ */

/** emp_A3F1B2C4D5… → "A3F1B2C4"; non-id-looking values pass through. */
function shortCode(value: string): string {
  const tail = value.replace(/^(emp|run|task|apr|aud)_/i, "").replace(/[^0-9a-z]/gi, "").slice(0, 8).toUpperCase();
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

function approvalStatusLabel(value: string | null): string {
  switch (value) {
    case "pending":
      return "待审批";
    case "approved":
      return "已通过";
    case "rejected":
      return "已驳回";
    case "cancelled":
      return "已撤回";
    case "processing":
      return "流转中";
    default:
      return "状态未知";
  }
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
 * fetch hook (one per zone; urls computed from the active zone only)
 * ------------------------------------------------------------------ */

function toResourceError(err: unknown): Resource<never> {
  const api = err instanceof ApiError ? err : null;
  const status = api?.status;
  if (status === 403) return { phase: "denied", message: DENIED_COPY };
  if (status === 404) return { phase: "denied", message: DENIED_COPY };
  const message = api?.message || (status ? humanizeStatus(status) : API_UNREACHABLE_MESSAGE);
  return { phase: "error", message, requestId: api?.requestId ?? null };
}

function useResourceList<T>(url: string, nonce: number, read: (body: unknown) => T[]): Resource<T[]> {
  const [resource, setResource] = useState<Resource<T[]>>({ phase: "loading" });

  useEffect(() => {
    // Inactive zones pass an empty url: no request, and the previous zone
    // state is kept so switching back shows cached rows until it refetches.
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

  return resource;
}

/* ------------------------------------------------------------------ *
 * zone row readers
 * ------------------------------------------------------------------ */

type CapabilityRow = { capability: string | null; risk: string | null; scope: string | null };

function readMatrix(body: unknown): CapabilityRow[] {
  const rows: CapabilityRow[] = [];
  for (const item of itemsOf(body)) {
    const caps = item.capabilities;
    if (Array.isArray(caps)) {
      for (const cap of caps) {
        if (typeof cap === "string" && cap.trim()) {
          rows.push({ capability: cap.trim(), risk: pickString(item.risk, item.riskLevel), scope: pickString(item.scope, item.source) });
        } else if (isRecord(cap)) {
          rows.push({
            capability: pickString(cap.name, cap.title, cap.id),
            risk: pickString(cap.risk, cap.riskLevel, item.risk),
            scope: pickString(cap.scope, item.scope),
          });
        } else {
          rows.push({ capability: null, risk: pickString(item.risk, item.riskLevel), scope: null });
        }
      }
    } else {
      const one: CapabilityRow = {
        capability: pickString(caps, item.capability),
        risk: pickString(item.risk, item.riskLevel),
        scope: pickString(item.scope, item.source),
      };
      if (one.capability || one.risk || one.scope) rows.push(one);
    }
  }
  return rows;
}

type ApprovalRow = { ref: string | null; status: string | null; title: string | null; at: string | null; amount: number | null };

function readApprovals(body: unknown): ApprovalRow[] {
  return itemsOf(body).map((item) => ({
    ref: pickString(item.taskId, item.taskRef, item.refId, item.approvalId, item.id),
    status: pickString(item.status, item.state),
    title: pickString(item.title, item.type, item.name, item.category),
    at: pickString(item.createdAt, item.created_at, item.submittedAt, item.applyTime),
    amount: pickNumber(item.amountUsd, item.amount, item.monthlyCostUsd),
  }));
}

type RunRow = { ref: string | null; status: string | null; startedAt: string | null; cost: number | null; tokens: number | null };

function readRuns(body: unknown): RunRow[] {
  return itemsOf(body).map((item) => ({
    ref: pickString(item.runId, item.id),
    status: pickString(item.status, item.state),
    startedAt: pickString(item.startedAt, item.started_at, item.createdAt, item.created_at),
    cost: pickNumber(item.costUsd, item.totalCostUsd, item.cost),
    tokens: pickNumber(item.totalTokens, item.tokens, item.tokenUsage),
  }));
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

/* ------------------------------------------------------------------ *
 * zone ids ↔ shell `?zone=` spellings
 * ------------------------------------------------------------------ */

const ZONES = [
  { id: "overview", label: "概览" },
  { id: "capability", label: "能力与权限" },
  { id: "approvals", label: "审批" },
  { id: "runs", label: "运行" },
  { id: "audit", label: "审计" },
] as const;

type ZoneId = (typeof ZONES)[number]["id"] | "chat" | "tasklist";

function mapShellZone(raw: string): ZoneId {
  switch (raw) {
    case "chat":
      // PRD 聊天区：只读会话摘要，深链 ?zone=chat 可达；导航条保持五区不变。
      return "chat";
    case "capability":
      return "capability";
    case "approvals":
      return "approvals";
    case "config":
      return "capability";
    case "tasks":
      // R43: the tasks zone got its own real-data body; it no longer
      // borrows the approvals view.
      return "tasklist";
    case "runs":
      return "runs";
    case "evidence":
    case "audit":
      return "audit";
    default:
      return "overview";
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

function ZoneDenied({ title, message, onRetry, testid }: { title: string; message: string; onRetry: () => void; testid: string }) {
  return (
    <Card data-testid={testid}>
      <CardContent className="flex flex-col items-start gap-3 p-5">
        <ShieldAlert className="h-5 w-5 text-amber-400" />
        <p className="text-sm">{title}暂不可见</p>
        <p className="text-xs text-white/55">{message}请确认后台已接入对应服务，或联系管理员开通权限。</p>
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

/* ------------------------------------------------------------------ *
 * chat zone (PRD 聊天区) — read-only session summary, never a host
 * ------------------------------------------------------------------ */

type TaskZoneRow = {
  taskId: string;
  title: string | null;
  status: string | null;
  priority: string | null;
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
    });
  }
  return rows;
}

function chatStatusLabel(raw: string | null): string {
  if (!raw) return "待核实";
  const s0 = raw.toLowerCase();
  if (s0 === "active" || s0 === "open") return "进行中";
  if (s0 === "archived" || s0 === "closed" || s0 === "ended") return "已结束";
  return "待核实";
}

function TasksZone({ resource, empId, onRetry }: { resource: Resource<TaskZoneRow[]>; empId: string; onRetry: () => void }) {
  if (!empId) {
    return (
      <ZoneEmpty
        testid="ed5-zone-tasks-empty"
        title="缺少员工编号，无法确定任务归属。"
        hint="本页只按该员工读取任务，不展示猜测内容。"
      />
    );
  }
  if (resource.phase === "loading") return <ZoneLoading testid="ed5-zone-tasks-loading" />;
  if (resource.phase === "denied") {
    return <ZoneDenied title="任务" message={resource.message} onRetry={onRetry} testid="ed5-zone-tasks-denied" />;
  }
  if (resource.phase === "error") {
    return (
      <ZoneError
        title="任务"
        message={resource.message}
        requestId={resource.requestId}
        onRetry={onRetry}
        testid="ed5-zone-tasks-error"
      />
    );
  }
  if (resource.phase === "empty") {
    return (
      <Card data-testid="ed5-zone-tasks-empty">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <Inbox className="h-6 w-6 text-white/40" />
          <p className="text-sm">该员工暂无任务。</p>
          <p className="text-xs text-white/50">
            这是服务端的真实回答：当前指派给该员工的任务为零；本页不放宽筛选来凑数。
          </p>
          <p className="text-xs text-white/50">口径=按负责人过滤（服务端执行）；其他负责人的任务请到任务看板查看。</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card data-testid="ed5-zone-tasks">
      <CardContent className="p-0">
        <div className="hidden grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-2 border-b border-white/10 px-4 py-2 text-xs text-white/45 md:grid">
          <span>标题</span>
          <span>状态</span>
          <span>优先级</span>
          <span>更新时间</span>
        </div>
        <ul className="divide-y divide-white/5" data-testid="ed5-zone-tasks-list">
          {resource.data.map((row) => (
            <li
              key={row.taskId}
              data-testid={`ed5-zone-tasks-row-${row.taskId}`}
              className="grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)] md:items-center md:gap-2"
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
              <span className="font-mono text-xs text-white/55">{beijing(row.updatedAt)}</span>
            </li>
          ))}
        </ul>
        <p className="px-4 py-2 text-xs text-white/45">
          只读 · 本页不提供建单与状态迁移；迁移在任务工作台。点击行标题打开任务详情深链。
        </p>
      </CardContent>
    </Card>
  );
}

function ChatZone({ resource, empId, onRetry }: { resource: Resource<ChatRow[]>; empId: string; onRetry: () => void }) {
  if (!empId) {
    return (
      <ZoneEmpty
        testid="ed5-zone-chat-empty"
        title="缺少员工编号，无法确定对话对象。"
        hint="本页只按员工读取会话摘要，不自行绘制消息流。"
      />
    );
  }
  if (resource.phase === "loading") return <ZoneLoading testid="ed5-zone-chat-loading" />;
  if (resource.phase === "denied") {
    return <ZoneDenied title="对话记录" message={resource.message} onRetry={onRetry} testid="ed5-zone-chat-denied" />;
  }
  if (resource.phase === "error") {
    return (
      <ZoneError
        title="对话记录"
        message={resource.message}
        requestId={resource.requestId}
        onRetry={onRetry}
        testid="ed5-zone-chat-error"
      />
    );
  }
  if (resource.phase === "empty") {
    return (
      <Card data-testid="ed5-zone-chat-empty">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <Inbox className="h-6 w-6 text-white/40" />
          <p className="text-sm">该员工的对话记录尚未接入。</p>
          <p className="text-xs text-white/50">
            接口确认可达，服务端确认该员工当前没有已落库的会话；本页不造数，也不在这里开启对话。
          </p>
          <p
            className="font-mono text-xs text-white/40"
            title="GAP：console-sessions 上游路由族由 L2 车道交付，尚未合入部署面；要聊天请去“对话”页（全站唯一对话承载）。"
          >
            原因与数据源缺口见悬停。
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card data-testid="ed5-zone-chat">
      <CardContent className="p-0">
        <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.5fr)_minmax(0,0.6fr)] gap-2 border-b border-white/10 px-4 py-2 text-xs text-white/45 md:grid">
          <span>会话</span>
          <span>最后消息时间</span>
          <span>消息数</span>
          <span>状态</span>
        </div>
        <ul className="divide-y divide-white/5" data-testid="ed5-zone-chat-list">
          {resource.data.map((row, i) => (
            <li
              key={`${row.ref ?? "chat"}-${i}`}
              data-testid="ed5-zone-chat-row"
              className="grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.5fr)_minmax(0,0.6fr)] md:items-center md:gap-2"
            >
              <span className="min-w-0 truncate text-sm" title={row.ref ?? undefined}>
                {row.title ?? `会话 · ${row.ref ? shortCode(row.ref) : "待核实"}`}
              </span>
              <span className="font-mono text-xs text-white/55">{beijing(row.lastAt)}</span>
              <span className="text-xs text-white/55">{row.messages === null ? "—" : `${row.messages} 条`}</span>
              <span title={row.status ?? undefined}>
                <Badge>{chatStatusLabel(row.status)}</Badge>
              </span>
            </li>
          ))}
        </ul>
        <p className="px-4 py-2 text-xs text-white/45">
          只读摘要 · 本页不提供对话写入入口；要继续聊天请前往“对话”页。
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * page
 * ------------------------------------------------------------------ */

export default function EmployeeDetailModulePage({ employeeId }: { employeeId?: string }) {
  const params = useParams<{ employeeId: string; id: string }>();
  const [sp] = useSearchParams();
  const empId =
    employeeId?.trim() ||
    (params.employeeId ? decodeURIComponent(params.employeeId) : "") ||
    (params.id ? decodeURIComponent(params.id) : "");
  const enc = encodeURIComponent(empId);
  const zone = mapShellZone(sp.get("zone") ?? "");

  const [reload, setReload] = useState<Record<ZoneId, number>>({ overview: 0, capability: 0, approvals: 0, runs: 0, audit: 0, chat: 0, tasklist: 0 });
  const retry = (z: ZoneId) => setReload((prev) => ({ ...prev, [z]: prev[z] + 1 }));

  const overview = useOverview(empId, reload.overview);
  const capability = useResourceList(zone === "capability" ? `/agent-api/api/matrix?employee=${enc}` : "", reload.capability, readMatrix);
  const approvals = useResourceList(zone === "approvals" ? `/agent-api/api/approvals?employeeId=${enc}` : "", reload.approvals, readApprovals);
  const runs = useResourceList(zone === "runs" ? `/agent-api/api/runs?employeeId=${enc}` : "", reload.runs, readRuns);
  const audit = useResourceList(zone === "audit" ? `/agent-api/api/audit?resourceId=${enc}&limit=50` : "", reload.audit, readAudit);
  const tasklist = useResourceList(
    zone === "tasklist" && empId ? `/agent-api/api/tasks?assignee=${encodeURIComponent(`employee:${empId}`)}&limit=20` : "",
    reload.tasklist,
    readTasks,
  );
  const chat = useResourceList(
    zone === "chat" && empId ? `/agent-api/api/console-sessions?employeeId=${enc}&limit=5` : "",
    reload.chat,
    readSessions,
  );

  const name = overview.phase === "ready" ? pickString(overview.data.name) : null;
  const titleJob = overview.phase === "ready" ? pickString(overview.data.title, overview.data.role, overview.data.position) : null;
  const lifecycle = overview.phase === "ready" ? pickString(overview.data.lifecycleState, overview.data.lifecycle) : null;

  const header = (
    <header className="flex min-w-0 flex-wrap items-center gap-3">
      <div className="min-w-0">
        <h1 className="truncate font-mondwest text-xl" title={empId || undefined}>
          {name ? `${name} · ${shortCode(empId)}` : empId ? `员工 · ${shortCode(empId)}` : "员工详情"}
        </h1>
        <p className="truncate text-xs text-white/50">{dash(titleJob)}</p>
      </div>
      {overview.phase === "ready" ? (
        <Badge tone={lifecycleTone(lifecycle)}>{lifecycleLabel(lifecycle)}</Badge>
      ) : null}
    </header>
  );

  return (
    <section className="min-w-0 space-y-4" data-testid="ed5-module">
      {header}

      <div
        role="tablist"
        aria-label="详情分区"
        className="flex min-w-0 flex-wrap gap-1 border-b pb-1"
        style={{ borderColor: "var(--line-2)" }}
        data-testid="ed5-tabs"
      >
        {ZONES.map((z) => {
          const active = z.id === zone;
          const search = z.id === "overview" ? "" : `?zone=${z.id}`;
          return (
            <Link
              key={z.id}
              to={`/employees/${enc}${search}`}
              role="tab"
              aria-selected={active}
              data-zone={z.id}
              className="rounded-t-[var(--r-sm)] border border-b-0 px-3 py-1.5 text-sm no-underline"
              style={{
                background: active ? "var(--panel-2)" : "transparent",
                color: active ? "var(--fg)" : "var(--fg-3)",
              }}
            >
              {z.label}
            </Link>
          );
        })}
      </div>

      {zone === "overview" ? <OverviewZone state={overview} onRetry={() => retry("overview")} empId={empId} /> : null}
      {zone === "capability" ? (
        <CapabilityZone resource={capability} onRetry={() => retry("capability")} />
      ) : null}
      {zone === "approvals" ? (
        <ApprovalsZone resource={approvals} onRetry={() => retry("approvals")} />
      ) : null}
      {zone === "runs" ? <RunsZone resource={runs} onRetry={() => retry("runs")} /> : null}
      {zone === "audit" ? <AuditZone resource={audit} onRetry={() => retry("audit")} /> : null}
      {zone === "chat" ? <ChatZone resource={chat} empId={empId} onRetry={() => retry("chat")} /> : null}
      {zone === "tasklist" ? <TasksZone resource={tasklist} empId={empId} onRetry={() => retry("tasklist")} /> : null}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * overview (identity / job / on-duty) — employees/:id, fallback matrix/:id
 * ------------------------------------------------------------------ */

type OverviewState =
  | { phase: "loading" }
  | { phase: "empty" }
  | { phase: "denied"; message: string }
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
          setState({ phase: "denied", message: DENIED_COPY });
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
            setState({ phase: "denied", message: DENIED_COPY });
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

function IdentityField({ id, label, children, title }: { id: string; label: string; children: React.ReactNode; title?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-white/45">{label}</dt>
      <dd className="min-w-0 truncate text-sm" data-testid={`ed1-identity-${id}`} title={title ?? undefined}>
        {children}
      </dd>
    </div>
  );
}

/**
 * R45 · the identity card on the default zone. Every field comes from the
 * same detail body the overview already trusts; anything the backend did
 * not answer renders "—" with the reason in the title — never a 0, never a
 * placeholder.
 */
function IdentityCard({ d, empId }: { d: Rec; empId: string }) {
  const name = pickString(d.name);
  const role = pickString(d.title, d.role, d.position);
  const stateRaw = lifecycleLabel(pickString(d.lifecycleState, d.lifecycle));
  const stateLabel = stateRaw === "状态未知" ? "待核实" : stateRaw;
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
        <dl className="grid gap-x-6 gap-y-3 px-4 py-3 sm:grid-cols-2 xl:grid-cols-3">
          <IdentityField id="name" label="姓名" title={name ? undefined : "后台没有回传这位员工的姓名。"}>
            {name ?? "—"}
          </IdentityField>
          <IdentityField id="code" label="工号" title={empId}>
            {shortCode(empId)}
          </IdentityField>
          <IdentityField id="role" label="角色" title={role ? undefined : "后台没有回传这位员工的角色。"}>
            {role ?? "—"}
          </IdentityField>
          <IdentityField id="state" label="在职态" title={pickString(d.lifecycleState, d.lifecycle) ?? "后台没有回传在职状态。"}>
            {stateLabel}
          </IdentityField>
          <IdentityField id="reports" label="汇报对象" title={reportsTo ? undefined : "后台没有回传这位员工的汇报对象。"}>
            {reportsValue}
          </IdentityField>
          <IdentityField id="created" label="创建时间" title={created ? "北京时间，精确到分" : "后台没有回传创建时间。"}>
            {created ? beijing(created) : "—"}
          </IdentityField>
        </dl>
      </CardContent>
    </Card>
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
    return <ZoneDenied title="员工档案" message={state.message} onRetry={onRetry} testid="ed5-overview-denied" />;
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
  const rows: Array<{ label: string; value: string; raw?: string | null }> = [
    { label: "身份", value: pickString(d.name) ? `${pickString(d.name)} · ${shortCode(empId)}` : `员工 · ${shortCode(empId)}`, raw: empId },
    { label: "岗位", value: dash(pickString(d.title, d.role, d.position)) },
    { label: "在岗状态", value: lifecycleLabel(pickString(d.lifecycleState, d.lifecycle)) },
    { label: "责任人", value: actorLabel(pickString(d.ownerUserId, d.owner, d.ownerName)) },
    { label: "最近活动", value: beijing(pickString(d.lastActiveAt, d.updatedAt, d.updated_at)) },
    { label: "月度预算", value: money(pickNumber(d.monthlyBudgetUsd, budget?.monthlyCostUsd)) },
  ];
  return (
    <div className="min-w-0 space-y-4" data-testid="ed5-overview-wrap">
      <IdentityCard d={d} empId={empId} />
      <Card data-testid="ed5-overview">
        <CardContent className="p-0">
          <dl className="divide-y divide-white/5">
            {rows.map((r) => (
              <div key={r.label} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
                <dt className="text-xs text-white/45">{r.label}</dt>
                <dd className="min-w-0 truncate text-sm" title={r.raw ?? undefined}>
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * capability & permissions (reuse: /v1/matrix/employees; missing → 待核实)
 * ------------------------------------------------------------------ */

function CapabilityZone({ resource, onRetry }: { resource: Resource<CapabilityRow[]>; onRetry: () => void }) {
  if (resource.phase === "loading") return <ZoneLoading testid="ed5-capability-loading" />;
  if (resource.phase === "empty") {
    return (
      <ZoneEmpty
        title="还没有这位员工的能力记录"
        hint="能力配置生效后会自动出现；如果已经配置，可能是后台还没接入该数据源。"
        testid="ed5-capability-empty"
      />
    );
  }
  if (resource.phase === "denied") {
    return <ZoneDenied title="能力与权限" message={resource.message} onRetry={onRetry} testid="ed5-capability-denied" />;
  }
  if (resource.phase !== "ready") {
    return (
      <ZoneError
        title="能力与权限"
        message={resource.phase === "error" ? resource.message : ""}
        requestId={resource.phase === "error" ? resource.requestId : null}
        onRetry={onRetry}
        testid="ed5-capability-error"
      />
    );
  }
  return (
    <Card data-testid="ed5-capability">
      <CardContent className="p-0">
        <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-2 border-b border-white/10 px-4 py-2 text-xs text-white/45 md:grid">
          <span>能力</span>
          <span>风险级别</span>
          <span>来源</span>
        </div>
        <ul className="divide-y divide-white/5">
          {resource.data.map((row, i) => (
            <li key={`${row.capability ?? "cap"}-${i}`} className="grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)] md:items-center md:gap-2">
              <span className="min-w-0 truncate text-sm">
                <Gauge className="mr-2 inline h-4 w-4 text-white/40" />
                {row.capability ?? "待核实"}
              </span>
              <span className="text-xs text-white/60">{row.risk ?? "待核实"}</span>
              <span className="truncate text-xs text-white/45">{row.scope ?? "待核实"}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * approvals (real jump: task rows link to the approvals surface)
 * ------------------------------------------------------------------ */

function ApprovalsZone({ resource, onRetry }: { resource: Resource<ApprovalRow[]>; onRetry: () => void }) {
  if (resource.phase === "loading") return <ZoneLoading testid="ed5-approvals-loading" />;
  if (resource.phase === "empty") {
    return (
      <ZoneEmpty
        title="这位员工还没有审批事项"
        hint="有新的申请或待办审批时，会出现在这里。"
        testid="ed5-approvals-empty"
      />
    );
  }
  if (resource.phase === "denied") {
    return <ZoneDenied title="审批" message={resource.message} onRetry={onRetry} testid="ed5-approvals-denied" />;
  }
  if (resource.phase !== "ready") {
    return (
      <ZoneError
        title="审批"
        message={resource.phase === "error" ? resource.message : ""}
        requestId={resource.phase === "error" ? resource.requestId : null}
        onRetry={onRetry}
        testid="ed5-approvals-error"
      />
    );
  }
  return (
    <Card data-testid="ed5-approvals">
      <CardContent className="p-0">
        <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,0.6fr)] gap-2 border-b border-white/10 px-4 py-2 text-xs text-white/45 md:grid">
          <span>事项</span>
          <span>状态</span>
          <span>提交时间</span>
          <span>涉及金额</span>
        </div>
        <ul className="divide-y divide-white/5">
          {resource.data.map((row, i) => {
            const label = row.title ?? (row.ref ? `审批单 · ${shortCode(row.ref)}` : "审批事项");
            const inner = (
              <>
                <span className="min-w-0 truncate text-sm">{label}</span>
                <span title={row.status ?? undefined}>
                  <Badge tone={approvalStatusTone(row.status)}>{approvalStatusLabel(row.status)}</Badge>
                </span>
                <span className="font-mono text-xs text-white/55">{beijing(row.at)}</span>
                <span className="text-xs text-white/55">{money(row.amount)}</span>
              </>
            );
            return row.ref ? (
              <li key={`${row.ref}-${i}`}>
                <Link
                  to="/approvals"
                  title={row.ref}
                  className="grid grid-cols-1 gap-1 px-4 py-3 hover:bg-white/5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,0.6fr)] md:items-center md:gap-2"
                >
                  {inner}
                </Link>
              </li>
            ) : (
              <li key={`row-${i}`} className="grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,0.6fr)] md:items-center md:gap-2">
                {inner}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * runs (real jump: rows link to the runs surface)
 * ------------------------------------------------------------------ */

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
      return "状态未知";
  }
}

function runStatusTone(value: string | null): "success" | "warning" | "destructive" | undefined {
  if (value === "completed" || value === "success") return "success";
  if (value === "running" || value === "in_progress") return "warning";
  if (value === "failed" || value === "error") return "destructive";
  return undefined;
}

function RunsZone({ resource, onRetry }: { resource: Resource<RunRow[]>; onRetry: () => void }) {
  if (resource.phase === "loading") return <ZoneLoading testid="ed5-runs-loading" />;
  if (resource.phase === "empty") {
    return (
      <ZoneEmpty
        title="还没有运行记录"
        hint="员工开始执行任务后，运行会出现在这里。"
        testid="ed5-runs-empty"
      />
    );
  }
  if (resource.phase === "denied") {
    return <ZoneDenied title="运行" message={resource.message} onRetry={onRetry} testid="ed5-runs-denied" />;
  }
  if (resource.phase !== "ready") {
    return (
      <ZoneError
        title="运行"
        message={resource.phase === "error" ? resource.message : ""}
        requestId={resource.phase === "error" ? resource.requestId : null}
        onRetry={onRetry}
        testid="ed5-runs-error"
      />
    );
  }
  return (
    <Card data-testid="ed5-runs">
      <CardContent className="p-0">
        <div className="hidden grid-cols-[minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.6fr)] gap-2 border-b border-white/10 px-4 py-2 text-xs text-white/45 md:grid">
          <span>运行</span>
          <span>状态</span>
          <span>开始时间</span>
          <span>花费</span>
          <span>用量</span>
        </div>
        <ul className="divide-y divide-white/5" data-testid="ed5-zone-runs-list">
          {resource.data.map((row, i) => (
            <li key={`${row.ref ?? "run"}-${i}`} data-testid="ed5-zone-runs-row">
              <Link
                to="/runs"
                title={row.ref ?? undefined}
                className="grid grid-cols-1 gap-1 px-4 py-3 hover:bg-white/5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.6fr)] md:items-center md:gap-2"
              >
                <span className="font-mono text-xs" title={row.ref ?? undefined}>
                  运行 · {row.ref ? shortCode(row.ref) : "—"}
                </span>
                <span title={row.status ?? undefined}>
                  <Badge tone={runStatusTone(row.status)}>{runStatusLabel(row.status)}</Badge>
                </span>
                <span className="font-mono text-xs text-white/55">{beijing(row.startedAt)}</span>
                <span className="text-xs text-white/55">
                  <Wallet className="mr-1 inline h-3.5 w-3.5 text-white/40" />
                  {money(row.cost)}
                </span>
                <span className="text-xs text-white/55">{dash(row.tokens)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * audit
 * ------------------------------------------------------------------ */

function AuditZone({ resource, onRetry }: { resource: Resource<AuditRow[]>; onRetry: () => void }) {
  if (resource.phase === "loading") return <ZoneLoading testid="ed5-audit-loading" />;
  if (resource.phase === "empty") {
    return (
      <ZoneEmpty
        title="还没有审计记录"
        hint="涉及这位员工的敏感操作会逐条记在这里。"
        testid="ed5-audit-empty"
      />
    );
  }
  if (resource.phase === "denied") {
    return <ZoneDenied title="审计" message={resource.message} onRetry={onRetry} testid="ed5-audit-denied" />;
  }
  if (resource.phase !== "ready") {
    return (
      <ZoneError
        title="审计"
        message={resource.phase === "error" ? resource.message : ""}
        requestId={resource.phase === "error" ? resource.requestId : null}
        onRetry={onRetry}
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
      </CardContent>
    </Card>
  );
}
