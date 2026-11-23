/**
 * Q12 · 名册行内员工详情 — 五页签（档案 / 任职 / 权限 / 任务 / 审计）真数据视图。
 *
 * 页内呈现（零路由）：PeopleModulePage 的行打开本面板，「返回名册」即回到名单。
 * 每个页签首次激活时才发请求（lazy）、各自独立（一个页签失败不牵连其他），
 * 结果按员工 id 缓存；切回已取到的页签不重复打接口，重试按钮显式再取。
 *
 * 只读既有 BFF 端点（实测样本：q12 probe_*.json），不新造端点、不造数据：
 *   档案  /agent-api/api/employee?id=
 *   任职  /agent-api/api/workstations?id=&limit=20
 *   权限  /agent-api/api/effective-config?id=
 *   任务  /agent-api/api/tasks?assignee=employee:<id>&limit=20
 *   审计  /agent-api/api/audit?resourceId=&limit=50
 *
 * 三态纪律：失败=「未取到」+ humanizeStatus/ApiError 人话句，缺值一律「—」，
 * 绝不把缺失写成 0；真实空集=按页签写明原因的 empty 态；权限 409
 * `employee.no_effective_version` 是服务端的真实状态（尚无生效版本），
 * 走原因空态而不是错误崩溃；审计「共 N 条」只认 payload 顶层 total，
 * total 缺席就不写计数，不拿本页条数冒充总数。原始 id 不进可见文本，
 * 短码口径沿用全站 short8（tasksBoard），完整值留在 title。
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Inbox, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";

import { fetchJSON } from "@/lib/api";
import { API_UNREACHABLE_MESSAGE, ApiError, humanizeStatus } from "@/lib/api-error";
import { priorityLabel, short8, statusLabel } from "@/modules/tasks/tasksBoard";
import "./people.css";

type Rec = Record<string, unknown>;

type TabId = "profile" | "assignments" | "permissions" | "tasks" | "audit";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "profile", label: "档案" },
  { id: "assignments", label: "任职" },
  { id: "permissions", label: "权限" },
  { id: "tasks", label: "任务" },
  { id: "audit", label: "审计" },
];

/** 权限 409 的真实状态码：尚无生效版本，走原因空态，不是加载失败。 */
const NO_EFFECTIVE_CODE = "employee.no_effective_version";
const NO_EFFECTIVE_MESSAGE = "该员工尚无生效版本";

type TabState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; data: unknown }
  | { phase: "reason"; message: string }
  | { phase: "failed"; message: string; requestId: string | null };

function idleStates(): Record<TabId, TabState> {
  return {
    profile: { phase: "idle" },
    assignments: { phase: "idle" },
    permissions: { phase: "idle" },
    tasks: { phase: "idle" },
    audit: { phase: "idle" },
  };
}

/** 真实空集的逐页签原因句（档案无空态：要么对象、要么失败）。 */
const EMPTY_REASON: Record<TabId, string> = {
  profile: "",
  assignments: "该员工暂无绑定的工作站",
  permissions: "当前生效配置未返回任何授权",
  tasks: "暂无指派给该员工的任务",
  audit: "暂无该员工的审计事件",
};

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

/** 列表容器的容错读取：items/events 两形制 + 可选 data 外层包装。 */
function listOf(body: unknown, keys: Array<"items" | "events">): Rec[] {
  const buckets = [body, isRecord(body) ? body.data : null].filter(isRecord);
  for (const bucket of buckets) {
    for (const key of keys) {
      if (Array.isArray(bucket[key])) return bucket[key].filter(isRecord);
    }
  }
  return [];
}

/** ISO time → 北京时间到分；缺值与无法解析都是「—」，不补本机时钟。 */
function beijing(value: unknown): string {
  let date: Date | null = null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    date = new Date(value < 1e12 ? value * 1000 : value);
  } else if (typeof value === "string" && value.trim()) {
    date = new Date(value);
  }
  if (!date || Number.isNaN(date.getTime())) return "—";
  const t = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

function dash(value: string | null): string {
  return value ?? "—";
}

/**
 * id 显示口径：不透明 id（前缀_长随机串）→ short8 短码，完整值进 title；
 * 服务名一类可读值原样显示；过长值做首尾截断。绝不因截断丢整列。
 */
function idView(value: string | null): { text: string; title: string | undefined } {
  if (!value) return { text: "—", title: undefined };
  const opaque = /^[a-z]{1,10}_[0-9A-Za-z]{8,}$/.test(value);
  if (opaque) return { text: short8(value), title: value };
  const text = value.length > 28 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
  return { text, title: value === text ? undefined : value };
}

/** 生命周期词表与名册 statusLabel 同族（active→在岗），未知值待核实。 */
function lifecycleWord(value: string | null): { text: string; title?: string } {
  const word = (value ?? "").toLowerCase();
  if (word === "active") return { text: "在岗" };
  if (word === "onboarding") return { text: "入职中" };
  if (word === "draft") return { text: "草稿" };
  if (word === "paused") return { text: "暂停" };
  if (word === "suspended") return { text: "已停用" };
  if (word === "offboarding") return { text: "离职中" };
  if (word === "archived") return { text: "已归档" };
  if (!value) return { text: "—" };
  return { text: "待核实", title: `状态原值：${value}（未识别，不猜）` };
}

function lifecycleTone(value: string | null): "success" | "warning" | "destructive" | undefined {
  const word = (value ?? "").toLowerCase();
  if (word === "active") return "success";
  if (word === "draft" || word === "paused" || word === "suspended" || word === "offboarding") return "warning";
  if (word === "archived") return "destructive";
  return undefined;
}

/** 绑定状态词表：active→生效；未知值待核实，原值进 title。 */
function bindingWord(value: string | null): { text: string; title?: string } {
  const word = (value ?? "").toLowerCase();
  if (word === "active") return { text: "生效" };
  if (word === "inactive" || word === "disabled") return { text: "已停用" };
  if (word === "pending") return { text: "待生效" };
  if (word === "revoked") return { text: "已撤销" };
  if (!value) return { text: "—" };
  return { text: "待核实", title: `状态原值：${value}（未识别，不猜）` };
}

/** 授权名词表：已知类别给人话词，未知类别原样显示并保留 title。 */
function scopeWord(value: string | null): { text: string; title?: string } {
  const word = (value ?? "").toLowerCase();
  const known: Record<string, string> = {
    channel: "渠道",
    business_api: "业务接口",
    knowledge: "知识库",
    local_corpus: "本地语料",
    tool: "工具",
  };
  if (word && known[word]) return { text: known[word] };
  if (!value) return { text: "—" };
  return { text: value, title: `范围类别原值：${value}` };
}

function grantSourceWord(value: string | null): { text: string; title?: string } {
  const word = (value ?? "").toLowerCase();
  if (word === "role") return { text: "角色授予" };
  if (word === "temporary") return { text: "临时授予" };
  if (word === "permanent") return { text: "长期授予" };
  if (word === "policy") return { text: "策略授予" };
  if (word === "manual") return { text: "手动授予" };
  if (!value) return { text: "—" };
  return { text: value, title: `来源原值：${value}` };
}

function taskSourceWord(value: string | null): { text: string; title?: string } {
  const word = (value ?? "").toLowerCase();
  if (word === "manual") return { text: "手动" };
  if (word === "scheduled") return { text: "定时" };
  if (word === "system") return { text: "系统" };
  if (word === "agent") return { text: "智能体" };
  if (!value) return { text: "—" };
  return { text: value, title: `来源原值：${value}` };
}

function outcomeWord(value: string | null): { text: string; title?: string } {
  const word = (value ?? "").toLowerCase();
  if (word === "success") return { text: "成功", title: "outcome=success" };
  if (word === "denied") return { text: "被拒", title: "outcome=denied" };
  if (word === "error") return { text: "失败", title: "outcome=error" };
  if (word === "timeout") return { text: "超时", title: "outcome=timeout" };
  if (word === "pending") return { text: "待定", title: "outcome=pending" };
  if (!value) return { text: "—" };
  return { text: "待核实", title: `结果原值：${value}（未识别，不猜）` };
}

/** resourceSelector 两种实测形制：{types:[...]} 与 {type:"channel_event"}。 */
function selectorTypes(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (Array.isArray(value.types)) {
    const parts = value.types.filter((t): t is string => typeof t === "string" && t.trim() !== "");
    if (parts.length) return parts.join(" / ");
  }
  return pickString(value.type);
}

function joinStrings(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const parts = value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  return parts.length ? parts.join(" / ") : null;
}

function isNoEffectiveVersion(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 409 &&
    (err.body.includes(NO_EFFECTIVE_CODE) || err.message.includes(NO_EFFECTIVE_CODE))
  );
}

/** 失败原因人话句：ApiError 自带 humanize 句优先，其余落 humanizeStatus/不可达。 */
function failureMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return err.message || API_UNREACHABLE_MESSAGE;
    return err.message || humanizeStatus(err.status);
  }
  return "请求没有完成，服务端未给出回答。";
}

/* ------------------------------------------------------------------ *
 * 共用状态壳
 * ------------------------------------------------------------------ */

function PanelLoading({ testid }: { testid: string }) {
  return (
    <Card data-testid={testid} className="border-white/5 bg-white/[0.02]">
      <CardContent className="ppl5d-loading-body">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-white/5" />
        ))}
      </CardContent>
    </Card>
  );
}

function PanelFailed({
  tab,
  message,
  requestId,
  onRetry,
}: {
  tab: TabId;
  message: string;
  requestId: string | null;
  /** 没有可重试来源的形态异常不挂假重试钮。 */
  onRetry?: () => void;
}) {
  return (
    <Card data-testid="ppl5d-failed" className="border-white/5 bg-white/[0.02]">
      <CardContent className="ppl5d-state-body">
        <span className="ppl5d-state-title">
          <TriangleAlert className="h-4 w-4 text-rose-300/80" aria-hidden />
          未取到
        </span>
        <p className="ppl5d-state-text" data-testid="ppl5d-failed-reason">
          {message}
        </p>
        <p className="ppl5d-state-note">这一页签的数据没有拿到；其它页签不受影响，缺值不会写成 0。</p>
        {requestId ? (
          <p className="ppl5d-state-note" data-testid="ppl5d-failed-req">
            请求编号 {requestId}
          </p>
        ) : null}
        {onRetry ? (
          <Button size="sm" onClick={onRetry} data-testid={`ppl5d-retry-${tab}`}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            重试
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PanelEmpty({ label }: { label: string }) {
  return (
    <Card data-testid="ppl5d-empty" className="border-white/5 bg-white/[0.02]">
      <CardContent className="ppl5d-state-body">
        <span className="ppl5d-state-title">
          <Inbox className="h-4 w-4 text-white/30" aria-hidden />
          {label}
        </span>
        <p className="ppl5d-state-text">这是服务端的真实回答：请求成功返回，这一列表为空；不展示样例，也不把缺失写成 0。</p>
      </CardContent>
    </Card>
  );
}

/** 原因态（权限 409 尚无生效版本）：与真实空集同一类「如实说明」，不是错误。 */
function PanelReason({ message }: { message: string }) {
  return (
    <Card data-testid="ppl5d-empty" className="border-white/5 bg-white/[0.02]">
      <CardContent className="ppl5d-state-body">
        <span className="ppl5d-state-title">
          <Inbox className="h-4 w-4 text-white/30" aria-hidden />
          {message}
        </span>
        <p className="ppl5d-state-text">服务端回答该员工还没有生效版本；授权要等版本生效后才会有内容。</p>
      </CardContent>
    </Card>
  );
}

function KeyValues({ rows }: { rows: Array<{ key: string; label: string; text: string; title?: string; badge?: ReactNode }> }) {
  return (
    <dl className="ppl5d-kv">
      {rows.map((row) => (
        <div key={row.key} className="ppl5d-kv-row" data-testid={`ppl5d-row-${row.key}`} title={row.title}>
          <dt>{row.label}</dt>
          <dd>{row.badge ?? row.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ *
 * 五个页签的正文
 * ------------------------------------------------------------------ */

function ProfileBody({ data }: { data: unknown }) {
  if (!isRecord(data)) {
    return <PanelFailed tab="profile" message="返回的内容不是一个员工对象，无法核对档案。" requestId={null} />;
  }
  const lifecycle = pickString(data.lifecycleState, data.lifecycle_state, data.status);
  const revision = typeof data.revision === "number" && Number.isFinite(data.revision) ? data.revision : null;
  const versionCode = idView(pickString(data.currentVersionId, data.current_version_id));
  const versionText =
    revision !== null && versionCode.text !== "—"
      ? `第 ${revision} 版 · ${versionCode.text}`
      : revision !== null
        ? `第 ${revision} 版`
        : versionCode.text;
  const owner = pickString(data.ownerUserId, data.owner_user_id);
  const department = pickString(data.department, data.dept, data.dept_name);
  const rows = [
    { key: "id", label: "员工编号", text: idView(pickString(data.id, data.employeeId)).text, title: pickString(data.id, data.employeeId) ?? undefined },
    { key: "name", label: "姓名", text: dash(pickString(data.name)) },
    { key: "title", label: "职务", text: dash(pickString(data.title, data.role, data.position)) },
    {
      key: "status",
      label: "状态",
      text: lifecycleWord(lifecycle).text,
      title: lifecycleWord(lifecycle).title,
      badge: lifecycle === null ? undefined : <Badge tone={lifecycleTone(lifecycle)}>{lifecycleWord(lifecycle).text}</Badge>,
    },
    { key: "department", label: "部门", text: dash(department), title: department ? undefined : "上游未提供部门" },
    { key: "owner", label: "负责人", text: idView(owner).text, title: idView(owner).title ?? (owner ? owner : "上游未提供负责人") },
    { key: "version", label: "版本", text: versionText, title: versionCode.title },
    { key: "created", label: "创建时间", text: beijing(data.createdAt ?? data.created_at) },
    { key: "updated", label: "更新时间", text: beijing(data.updatedAt ?? data.updated_at) },
  ];
  return (
    <Card className="border-white/5 bg-white/[0.02]">
      <CardContent className="ppl5d-card-body">
        <KeyValues rows={rows} />
        <p className="ppl5d-footnote">只读档案 · 本页不开放编辑；原始编号悬停可见。</p>
      </CardContent>
    </Card>
  );
}

function AssignmentsBody({ data }: { data: unknown }) {
  const items = listOf(data, ["items", "events"]);
  if (items.length === 0) return <PanelEmpty label={EMPTY_REASON.assignments} />;
  return (
    <Card className="border-white/5 bg-white/[0.02]">
      <CardContent className="p-0">
        <div className="ppl5d-scroll">
          <table className="ppl5d-table">
            <thead>
              <tr>
                <th>渠道</th>
                <th>绑定类型</th>
                <th>外部引用</th>
                <th>能力</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const binding = pickString(item.bindingType, item.binding_type);
                const ref = idView(pickString(item.externalRef, item.external_ref));
                const status = bindingWord(pickString(item.status, item.state));
                return (
                  <tr key={pickString(item.id) ?? `ws-${i}`} data-testid={`ppl5d-row-assignment-${i}`} title={pickString(item.id) ?? undefined}>
                    <td>{dash(pickString(item.channel))}</td>
                    <td>{dash(binding)}</td>
                    <td className="ppl5d-cell-id" title={ref.title ?? undefined}>{ref.text}</td>
                    <td>{dash(joinStrings(item.capabilities))}</td>
                    <td title={status.title}>{status.text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="ppl5d-footnote ppl5d-pad">共列出本页返回的 {items.length} 条绑定（limit=20）。</p>
      </CardContent>
    </Card>
  );
}

function PermissionsBody({ data }: { data: unknown }) {
  if (!isRecord(data)) {
    return <PanelFailed tab="permissions" message="返回的内容不是生效配置对象，无法核对权限。" requestId={null} />;
  }
  const version = isRecord(data.version) ? data.version : null;
  const versionNo = version && typeof version.versionNo === "number" && Number.isFinite(version.versionNo) ? version.versionNo : null;
  // 实测形制：授权列表在顶层 grants；items 形制留作同页签兜底。
  const grants = Array.isArray(data.grants) ? data.grants.filter(isRecord) : listOf(data, ["items", "events"]);
  const snapshot = idView(pickString(data.snapshotRef, data.snapshot_ref));
  const summary = (
    <Card className="border-white/5 bg-white/[0.02]">
      <CardContent className="ppl5d-card-body">
        <KeyValues
          rows={[
            { key: "resolved", label: "解析时间", text: beijing(data.resolvedAt ?? data.resolved_at) },
            {
              key: "version",
              label: "生效版本",
              text: versionNo !== null ? `v${versionNo} · 生效自 ${beijing(version?.effectiveFrom ?? version?.effective_from)}` : "—",
              title: version ? pickString(version.id, version.versionId) ?? undefined : undefined,
            },
            { key: "snapshot", label: "配置快照", text: snapshot.text, title: snapshot.title },
          ]}
        />
      </CardContent>
    </Card>
  );
  const empty = <PanelEmpty label={EMPTY_REASON.permissions} />;
  return (
    <div className="ppl5d-stack">
      {summary}
      {grants.length === 0 ? (
        empty
      ) : (
        <Card className="border-white/5 bg-white/[0.02]">
          <CardContent className="p-0">
            <div className="ppl5d-scroll">
              <table className="ppl5d-table">
                <thead>
                  <tr>
                    <th>范围</th>
                    <th>资源类型</th>
                    <th>动作</th>
                    <th>来源</th>
                    <th>到期</th>
                  </tr>
                </thead>
                <tbody>
                  {grants.map((grant, i) => {
                    const scope = scopeWord(pickString(grant.scopeType, grant.scope_type));
                    const source = grantSourceWord(pickString(grant.source));
                    const expiresAt = pickString(grant.expiresAt, grant.expires_at);
                    return (
                      <tr key={pickString(grant.id) ?? `gr-${i}`} data-testid={`ppl5d-row-grant-${i}`} title={pickString(grant.id) ?? undefined}>
                        <td title={scope.title}>{scope.text}</td>
                        <td>{dash(selectorTypes(grant.resourceSelector ?? grant.resource_selector))}</td>
                        <td>{dash(joinStrings(grant.actions))}</td>
                        <td title={source.title}>{source.text}</td>
                        <td className="ppl5d-cell-time">{expiresAt ? beijing(expiresAt) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="ppl5d-footnote ppl5d-pad">只读解析结果 · 授权变更请到权限页进行，这里不提供写入口。</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TasksBody({ data }: { data: unknown }) {
  const items = listOf(data, ["items", "events"]);
  if (items.length === 0) return <PanelEmpty label={EMPTY_REASON.tasks} />;
  return (
    <Card className="border-white/5 bg-white/[0.02]">
      <CardContent className="p-0">
        <div className="ppl5d-scroll">
          <table className="ppl5d-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>状态</th>
                <th>优先级</th>
                <th>来源</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const sourceRec = isRecord(item.source) ? item.source : null;
                const source = taskSourceWord(sourceRec ? pickString(sourceRec.kind) : pickString(item.sourceKind, item.source_kind));
                const taskId = pickString(item.taskId, item.task_id, item.id);
                return (
                  <tr key={taskId ?? `tk-${i}`} data-testid={`ppl5d-row-task-${i}`} title={taskId ?? undefined}>
                    <td>{dash(pickString(item.title, item.name))}</td>
                    <td>{statusLabel(pickString(item.status, item.state) ?? "")}</td>
                    <td>{priorityLabel(pickString(item.priority) ?? undefined).text}</td>
                    <td title={source.title}>{source.text}</td>
                    <td className="ppl5d-cell-time">{beijing(item.createdAt ?? item.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="ppl5d-footnote ppl5d-pad">口径=按负责人过滤（assignee=employee:&lt;id&gt;，服务端执行）；共列出本页返回的 {items.length} 条（limit=20）。</p>
      </CardContent>
    </Card>
  );
}

function AuditBody({ data }: { data: unknown }) {
  const events = listOf(data, ["events", "items"]);
  const total = isRecord(data) && typeof data.total === "number" && Number.isFinite(data.total) ? data.total : null;
  const hasMore = isRecord(data) ? data.hasMore === true || data.has_more === true : false;
  if (events.length === 0) return <PanelEmpty label={EMPTY_REASON.audit} />;
  return (
    <Card className="border-white/5 bg-white/[0.02]">
      <CardContent className="p-0">
        {/* 「共 N 条」只认 payload 顶层 total；total 缺席就不写计数，
          * 本页条数绝不冒充总数。 */}
        {total !== null ? (
          <p className="ppl5d-total" data-testid="ppl5d-audit-total">共 {total} 条{hasMore ? "（当前仅返回最近 50 条）" : ""}</p>
        ) : null}
        {/* 六列的自然最小宽度在 375 档放不下（实测 594 > 340）：这里不缩列、
          * 不藏列，按全站宽表先例（metrics metW / health sys3）交还给横向滚动，
          * 并把「可以滑」做成看得见的三条：提示文案（仅窄屏显示）、首列粘性钉左、
          * 钉住列右缘投影。桌面 >760 三件全部不生效，视觉零差。 */}
        <p className="ppl5d-scrollhint" data-testid="ppl5d-scrollhint-audit">
          左右滑动查看全部列
        </p>
        <div className="ppl5d-scroll ppl5d-scroll--x" role="region" tabIndex={0} aria-label="审计事件表，可横向滚动">
          <table className="ppl5d-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>动作</th>
                <th>执行者</th>
                <th>对象</th>
                <th>结果</th>
                <th>来源系统</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, i) => {
                const actor = isRecord(event.actor) ? event.actor : null;
                const actorText = idView(actor ? pickString(actor.id, actor.name) : pickString(event.actorId, event.actor_id));
                const resource = isRecord(event.resource) ? event.resource : null;
                const resType = resource ? pickString(resource.type) : null;
                const resId = idView(resource ? pickString(resource.id) : pickString(event.resourceId, event.resource_id));
                const action = pickString(event.action, event.actionType, event.event);
                const outcome = outcomeWord(pickString(event.outcome, event.result));
                return (
                  <tr key={pickString(event.eventId, event.id) ?? `ev-${i}`} data-testid={`ppl5d-row-audit-${i}`} title={action ?? undefined}>
                    <td className="ppl5d-cell-time">{beijing(event.occurredAt ?? event.recordedAt ?? event.created_at)}</td>
                    <td>{dash(action)}</td>
                    <td className="ppl5d-cell-id" title={actorText.title ?? (actor ? pickString(actor.type) ?? undefined : undefined)}>{actorText.text}</td>
                    <td className="ppl5d-cell-id" title={resId.title}>
                      {dash(resType ? `${resType} · ${resId.text}` : resId.text)}
                    </td>
                    <td title={outcome.title}>{outcome.text}</td>
                    <td>{dash(pickString(event.sourceSystem, event.source_system))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="ppl5d-footnote ppl5d-pad">按返回顺序（新→旧）列出本页 {events.length} 条（limit=50）· 只读。</p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * 面板
 * ------------------------------------------------------------------ */

export default function EmployeeDetailPanel({ employeeId, onBack }: { employeeId: string; onBack: () => void }) {
  const enc = encodeURIComponent(employeeId);
  const urls: Record<TabId, string> = {
    profile: `/agent-api/api/employee?id=${enc}`,
    assignments: `/agent-api/api/workstations?id=${enc}&limit=20`,
    permissions: `/agent-api/api/effective-config?id=${enc}`,
    tasks: `/agent-api/api/tasks?assignee=${encodeURIComponent(`employee:${employeeId}`)}&limit=20`,
    audit: `/agent-api/api/audit?resourceId=${enc}&limit=50`,
  };

  const [tab, setTab] = useState<TabId>("profile");
  const [states, setStates] = useState<Record<TabId, TabState>>(idleStates);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  function load(next: TabId) {
    setStates((prev) => ({ ...prev, [next]: { phase: "loading" } }));
    fetchJSON<unknown>(urls[next])
      .then((data) => {
        if (!alive.current) return;
        setStates((prev) => ({ ...prev, [next]: { phase: "ready", data } }));
      })
      .catch((err: unknown) => {
        if (!alive.current) return;
        if (next === "permissions" && isNoEffectiveVersion(err)) {
          setStates((prev) => ({ ...prev, [next]: { phase: "reason", message: NO_EFFECTIVE_MESSAGE } }));
          return;
        }
        setStates((prev) => ({
          ...prev,
          [next]: {
            phase: "failed",
            message: failureMessage(err),
            requestId: err instanceof ApiError ? err.requestId ?? null : null,
          },
        }));
      });
  }

  // 首次激活才取数：idle → loading；ready/failed/reason 都保留缓存，
  // 切回不重复打接口，重试由页签内按钮显式触发。
  useEffect(() => {
    if (states[tab].phase === "idle") load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- urls/states 由本次渲染闭包提供，触发条件只有 tab 与 idle
  }, [tab, states]);

  const profile = states.profile;
  const name = profile.phase === "ready" && isRecord(profile.data) ? pickString(profile.data.name) : null;
  const titleJob =
    profile.phase === "ready" && isRecord(profile.data) ? pickString(profile.data.title, profile.data.role) : null;
  const lifecycle =
    profile.phase === "ready" && isRecord(profile.data)
      ? pickString(profile.data.lifecycleState, profile.data.lifecycle_state, profile.data.status)
      : null;

  const state = states[tab];
  const body =
    state.phase === "loading" || state.phase === "idle" ? (
      <PanelLoading testid={`ppl5d-loading-${tab}`} />
    ) : state.phase === "failed" ? (
      <PanelFailed tab={tab} message={state.message} requestId={state.requestId} onRetry={() => load(tab)} />
    ) : state.phase === "reason" ? (
      <PanelReason message={state.message} />
    ) : tab === "profile" ? (
      <ProfileBody data={state.data} />
    ) : tab === "assignments" ? (
      <AssignmentsBody data={state.data} />
    ) : tab === "permissions" ? (
      <PermissionsBody data={state.data} />
    ) : tab === "tasks" ? (
      <TasksBody data={state.data} />
    ) : (
      <AuditBody data={state.data} />
    );

  return (
    <section className="ppl5d-detail flex min-w-0 flex-col gap-4" data-testid="ppl5d-detail">
      <header className="ppl5d-head">
        <Button size="sm" outlined onClick={onBack} data-testid="ppl5d-back">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          返回名册
        </Button>
        <div className="min-w-0">
          <h2 className="truncate text-base text-white/90" title={employeeId}>
            {name ? `${name} · ${short8(employeeId)}` : `员工 · ${short8(employeeId)}`}
          </h2>
          <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/40">
            <span className="min-w-0">{dash(titleJob)}</span>
            {lifecycle ? <Badge tone={lifecycleTone(lifecycle)}>{lifecycleWord(lifecycle).text}</Badge> : null}
          </p>
        </div>
      </header>

      <div role="tablist" aria-label="员工详情分区" className="ppl5d-tablist" data-testid="ppl5d-tabs">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`ppl5d-tab-${t.id}`}
              aria-selected={active}
              aria-controls="ppl5d-panel"
              data-testid={`ppl5d-tab-${t.id}`}
              className={active ? "ppl5d-tab ppl5d-tab--active" : "ppl5d-tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="ppl5d-panel" aria-labelledby={`ppl5d-tab-${tab}`} data-testid={`ppl5d-panel-${tab}`}>
        {body}
      </div>
    </section>
  );
}
