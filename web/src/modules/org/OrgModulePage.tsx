/**
 * T21 / org5 · 组织与部门 module page.
 *
 * Data source: 毕升 getDepartmentApi via BFF aliases under
 * `/agent-api/api/v1/dept/*`. The route is still unverified (GAP-02): the page
 * tries the known candidates for real and, when none answers, shows an honest
 * 「未接入」 state plus an application link. It never fabricates a tree, a
 * headcount, a zero or a sample row.
 *
 * Display contract: flat rows (dept_id/parent_id) and nested payloads
 * (children[]) build the same tree; raw ids live in `title` only; missing
 * values read 「—」 with a reason; owners read 「姓名 · 8位短码」 or 「未指派」.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Inbox,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { Button, Card, CardContent } from "@nous-research/ui";

import { fetchJSON } from "@/lib/api";
import { API_UNREACHABLE_MESSAGE, ApiError, SESSION_REQUIRED_GUIDANCE } from "@/lib/api-error";

import "./org.css";

/* ------------------------------------------------------------------ *
 * types & readers
 * ------------------------------------------------------------------ */

type Rec = Record<string, unknown>;

type Resource<T> =
  | { phase: "loading" }
  | { phase: "empty" }
  | { phase: "ready"; data: T }
  | { phase: "unavailable"; reason: string; requestId: string | null }
  | { phase: "error"; message: string; requestId: string | null };

const GAP02 = "GAP-02";
const MISSING_REASON =
  "上游部门接口还没有接入本控制台，或当前账号无权查看。接入后这里会自动显示真实部门树，不显示样例或 0。";
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

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function itemsOf(body: unknown): Rec[] {
  if (Array.isArray(body)) return body.filter(isRecord);
  if (isRecord(body)) {
    if (Array.isArray(body.items)) return body.items.filter(isRecord);
    if (Array.isArray(body.data)) return body.data.filter(isRecord);
    if (isRecord(body.data) && Array.isArray(body.data.items)) return body.data.items.filter(isRecord);
  }
  return [];
}

const BEIJING = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function beijing(value: unknown): string | null {
  const raw = pickString(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return BEIJING.format(date);
}

function shortCode(value: string | null): string | null {
  if (!value) return null;
  const alnum = value.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
  if (!alnum) return null;
  return alnum.length <= 8 ? alnum : alnum.slice(-8);
}

/* ------------------------------------------------------------------ *
 * tree building (flat parent_id rows or nested children[] payloads)
 * ------------------------------------------------------------------ */

type Dept = {
  key: string;
  parent: string;
  rawId: string;
  name: string | null;
  nameReason: string | null;
  parentName: string | null;
  parentReason: string | null;
  count: number | null;
  countReason: string | null;
  ownerName: string | null;
  ownerCode: string | null;
  ownerReason: string | null;
  updatedAt: string | null;
  updatedReason: string | null;
};

function collect(rows: Rec[], parentId: string, out: Dept[]): void {
  rows.forEach((row) => {
    const owner = isRecord(row.owner) ? row.owner : null;
    const rawId = pickString(row.dept_id, row.deptId, row.id) ?? `row-${out.length}`;
    const name = pickString(row.dept_name, row.deptName, row.name, row.title);
    const explicitParent = pickString(row.parent_id, row.parentId);
    const ownerName = pickString(
      row.owner_name,
      row.ownerName,
      row.leader_name,
      row.leaderName,
      row.manager_name,
      row.managerName,
      owner?.name,
      owner?.realname,
    );
    const ownerId = pickString(
      row.owner_id,
      row.ownerId,
      row.leader_id,
      row.leaderId,
      row.manager_id,
      row.managerId,
      row.emp_id,
      row.employee_id,
      owner?.employeeId,
      owner?.emp_id,
      owner?.id,
    );
    const ownerCode = shortCode(ownerId);
    const updatedRaw = row.updated_at ?? row.updatedAt ?? row.modified_at ?? row.modifiedAt;
    const updatedAt = beijing(updatedRaw);
    const count = pickNumber(row.user_count, row.userCount, row.headcount, row.member_count, row.memberCount);

    out.push({
      key: rawId,
      parent: explicitParent ?? (parentId || ""),
      rawId,
      name,
      nameReason: name ? null : "上游未提供部门名",
      parentName: pickString(row.parent_name, row.parentName),
      parentReason: null,
      count,
      countReason: count === null ? "上游未返回人数" : null,
      ownerName,
      ownerCode,
      ownerReason:
        !ownerName && !ownerCode
          ? "上游未指定负责人"
          : ownerName && !ownerCode
            ? "上游未提供负责人短码"
            : null,
      updatedAt,
      updatedReason: updatedAt
        ? null
        : updatedRaw
          ? "更新时间无法解析"
          : "上游未返回更新时间",
    });

    if (Array.isArray(row.children)) collect(row.children.filter(isRecord), rawId, out);
  });
}

type TreeNode = Dept & { children: TreeNode[] };

function withParentNames(depts: Dept[]): Dept[] {
  const names = new Map<string, string | null>();
  for (const dept of depts) names.set(dept.key, dept.name);
  return depts.map((dept) => {
    if (dept.parentName) return dept;
    if (!dept.parent || dept.parent === "0" || dept.parent === "-1") {
      return { ...dept, parentName: null, parentReason: "顶级部门" };
    }
    const resolved = names.get(dept.parent) ?? null;
    return {
      ...dept,
      parentName: resolved,
      parentReason: resolved ? null : "上级部门未在返回中",
    };
  });
}

function buildTree(depts: Dept[]): TreeNode[] {
  const byKey = new Map<string, TreeNode>();
  for (const d of depts) {
    if (!byKey.has(d.key)) byKey.set(d.key, { ...d, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of byKey.values()) {
    const parent =
      node.parent && node.parent !== "0" && node.parent !== "-1" ? byKey.get(node.parent) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/* ------------------------------------------------------------------ *
 * fetch — real endpoints, honest 未接入 when none answers
 * ------------------------------------------------------------------ */

const ORG_ENDPOINTS = [
  "/agent-api/api/v1/departments",
  "/agent-api/api/v1/dept/list",
  "/agent-api/api/v1/dept/tree",
];

function errorMessage(status: number | null | undefined): string {
  if (status === 0) return "当前网络不可达，请检查网络后重试。";
  if (status === 401) return SESSION_REQUIRED_GUIDANCE;
  if (status === 429) return "请求太频繁，请稍后重试。";
  if (status && status >= 500) return API_UNREACHABLE_MESSAGE;
  return "本次数据读取失败，请重试。";
}

async function loadOrg(): Promise<Resource<Dept[]>> {
  let sawForbidden: ApiError | null = null;
  let firstError: ApiError | null = null;

  for (const url of ORG_ENDPOINTS) {
    try {
      const body = await fetchJSON<unknown>(url);
      const rows = itemsOf(body);
      if (rows.length === 0) return { phase: "empty" };
      const depts: Dept[] = [];
      collect(rows, "", depts);
      return { phase: "ready", data: withParentNames(depts) };
    } catch (err: unknown) {
      const api = err instanceof ApiError ? err : null;
      if (api?.status === 403) {
        sawForbidden = api;
        continue;
      }
      if (api?.status === 401) {
        return { phase: "error", message: errorMessage(401), requestId: api.requestId ?? null };
      }
      if (api && api.status !== 404 && !firstError) firstError = api;
    }
  }

  if (firstError) {
    return {
      phase: "error",
      message: errorMessage(firstError.status),
      requestId: firstError.requestId ?? null,
    };
  }
  if (sawForbidden) {
    return {
      phase: "unavailable",
      reason: MISSING_REASON,
      requestId: sawForbidden.requestId ?? null,
    };
  }
  return { phase: "unavailable", reason: MISSING_REASON, requestId: null };
}

function useOrg(nonce: number, enabled: boolean): Resource<Dept[]> {
  const [resource, setResource] = useState<Resource<Dept[]>>({ phase: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setResource({ phase: "loading" });
    loadOrg()
      .then((r) => {
        if (!cancelled) setResource(r);
      })
      .catch(() => {
        if (!cancelled)
          setResource({ phase: "error", message: API_UNREACHABLE_MESSAGE, requestId: null });
      });
    return () => {
      cancelled = true;
    };
  }, [nonce, enabled]);
  return resource;
}

/* ------------------------------------------------------------------ *
 * state shell / request id
 * ------------------------------------------------------------------ */

function RequestId({ id, testid = "org5-request-id" }: { id: string | null; testid?: string }) {
  const [copied, setCopied] = useState(false);
  if (!id) {
    return (
      <span className="org5-req" data-testid={testid}>
        本次请求未记录编号
      </span>
    );
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <span className="org5-req" data-testid={testid}>
      请求编号：<code>{id}</code>
      <button type="button" className="org5-copy" data-testid="org5-copy-req" onClick={copy}>
        {copied ? "已复制" : "复制"}
      </button>
    </span>
  );
}

function StateShell({
  testid,
  icon,
  title,
  body,
  reason,
  gapTitle,
  onRetry,
  extra,
}: {
  testid: string;
  icon: ReactNode;
  title: string;
  body?: string;
  reason?: string | null;
  gapTitle?: string;
  onRetry?: () => void;
  extra?: ReactNode;
}) {
  return (
    <section
      data-testid={testid}
      className="org5-state"
      title={gapTitle}
    >
      <div className="org5-state-title">
        {icon}
        <span>{title}</span>
      </div>
      {body ? <p className="org5-state-body">{body}</p> : null}
      {reason ? <p className="org5-state-body">{reason}</p> : null}
      {extra}
      {onRetry ? (
        <Button size="sm" outlined onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          重试
        </Button>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * tree rows
 * ------------------------------------------------------------------ */

const MAX_DEPTH = 12;

/**
 * PE-10 ②：按名搜索的命中集与要展开的路径。命中节点自身也展开，
 * DoD 的「命中节点 aria-expanded=true」由此成立；祖先一律展开。
 */
function locateHits(nodes: TreeNode[], needle: string, trail: string[], hits: Set<string>, expand: Set<string>): void {
  if (!needle) return;
  for (const node of nodes) {
    const name = (node.name ?? "").toLowerCase();
    if (name.includes(needle)) {
      hits.add(node.key);
      expand.add(node.key);
      for (const ancestor of trail) expand.add(ancestor);
    }
    if (node.children.length > 0) locateHits(node.children, needle, [...trail, node.key], hits, expand);
  }
}

/** 关键词分段只用 React 文本节点渲染（禁 innerHTML 注入），命中片段进 <mark class="org5-hit">。 */
function highlightName(text: string, needle: string): ReactNode {
  if (!needle) return text;
  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let at = 0;
  let index = lower.indexOf(needle, at);
  let key = 0;
  while (index >= 0) {
    if (index > at) parts.push(text.slice(at, index));
    parts.push(
      <mark key={key++} className="org5-hit" data-testid="org5-hit">
        {text.slice(index, index + needle.length)}
      </mark>,
    );
    at = index + needle.length;
    index = lower.indexOf(needle, at);
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}

function ownerText(dept: Dept): string {
  if (dept.ownerName && dept.ownerCode) return `${dept.ownerName} · ${dept.ownerCode}`;
  if (dept.ownerName) return `${dept.ownerName} · —`;
  if (dept.ownerCode) return `员工 · ${dept.ownerCode}`;
  return "未指派";
}

function DeptRow({
  node,
  depth,
  collapsed,
  onToggle,
  needle,
  hits,
}: {
  node: TreeNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (key: string) => void;
  needle: string;
  hits: Set<string>;
}) {
  const hasChildren = node.children.length > 0 && depth < MAX_DEPTH;
  const isCollapsed = collapsed.has(node.key);
  const isHit = hits.has(node.key);
  const indent = 8 + Math.min(depth, 4) * 14;

  return (
    <>
      <li
        data-testid="org5-node"
        className={`org5-node${isHit ? " org5-node-hit" : ""}`}
        data-hit={isHit ? "true" : undefined}
        title={node.rawId ? `记录号 ${node.rawId}` : undefined}
      >
        <div className="org5-namecell" style={{ paddingLeft: indent }}>
          {hasChildren ? (
            <button
              type="button"
              className="org5-toggle"
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? "展开" : "收起"}
              onClick={() => onToggle(node.key)}
            >
              {isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
          ) : (
            <span className="org5-toggle-spacer" aria-hidden />
          )}
          <Building2 className="org5-dept-icon" aria-hidden />
          <span className="org5-name" data-testid="org5-name">
            {node.name ? highlightName(node.name, needle) : "待核实"}
            {node.nameReason ? <span className="org5-reason">{node.nameReason}</span> : null}
          </span>
        </div>

        <div className="org5-cell" data-label="上级部门" data-testid="org5-parent">
          {node.parentName ?? "—"}
          {node.parentReason ? <span className="org5-reason">{node.parentReason}</span> : null}
        </div>

        <div className="org5-cell" data-label="人数" data-testid="org5-count">
          {node.count === null ? "—" : `${node.count} 人`}
          {node.countReason ? <span className="org5-reason">{node.countReason}</span> : null}
        </div>

        <div className="org5-cell" data-label="负责人" data-testid="org5-owner">
          {ownerText(node)}
          {node.ownerReason ? <span className="org5-reason">{node.ownerReason}</span> : null}
        </div>

        <div className="org5-cell" data-label="更新时间" data-testid="org5-updated">
          {node.updatedAt ?? "—"}
          {node.updatedReason ? <span className="org5-reason">{node.updatedReason}</span> : null}
        </div>
      </li>
      {hasChildren && !isCollapsed
        ? node.children.map((child) => (
            <DeptRow
              key={child.key}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              needle={needle}
              hits={hits}
            />
          ))
        : null}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * the page
 * ------------------------------------------------------------------ */

type Forced = "loading" | "empty" | "error" | "denied";

function readHashParam(value: string, name: string): string | null {
  const mark = value.indexOf("?");
  if (mark < 0) return null;
  try {
    return new URLSearchParams(value.slice(mark + 1)).get(name);
  } catch {
    return null;
  }
}

/** 强制参数：hash 内查询优先（深链壳形制），回落全局 search（PE-07 与 state 同源）。 */
function forcedParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return readHashParam(window.location.hash, name) ?? new URLSearchParams(window.location.search).get(name);
}

function forcedState(): Forced | null {
  const value = forcedParam("state");
  return value === "loading" || value === "empty" || value === "error" || value === "denied" ? value : null;
}

function leavePreview(): void {
  if (typeof window === "undefined") return;
  const search = new URLSearchParams(window.location.search);
  search.delete("state");
  const hash = window.location.hash;
  const mark = hash.indexOf("?");
  let nextHash = hash;
  if (mark >= 0) {
    const params = new URLSearchParams(hash.slice(mark + 1));
    params.delete("state");
    const qs = params.toString();
    nextHash = hash.slice(0, mark) + (qs ? `?${qs}` : "");
  }
  window.history.replaceState({}, "", `${window.location.pathname}${search.toString() ? `?${search}` : ""}${nextHash}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function OrgModulePage() {
  const [reload, setReload] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [term, setTerm] = useState("");
  const forced = forcedState();
  const org = useOrg(reload, forced === null);
  const refresh = () => {
    if (forced) leavePreview();
    setReload((n) => n + 1);
  };

  const roots = useMemo<TreeNode[]>(() => {
    if (org.phase !== "ready") return [];
    return buildTree(org.data);
  }, [org]);

  const total = org.phase === "ready" ? org.data.length : 0;

  // PE-10 ②：树搜索是已加载树上的一次本地定位（部门树本身没有检索读口），
  // 因此键入零请求；命中节点与祖先自动展开，展开态与 aria-expanded 同源。
  const needle = term.trim().toLowerCase();
  const { hits, expand } = useMemo(() => {
    const hitSet = new Set<string>();
    const expandSet = new Set<string>();
    locateHits(roots, needle, [], hitSet, expandSet);
    return { hits: hitSet, expand: expandSet };
  }, [roots, needle]);

  const visibleCollapsed = useMemo(() => {
    if (needle === "" || expand.size === 0) return collapsed;
    return new Set([...collapsed].filter((key) => !expand.has(key)));
  }, [collapsed, expand, needle]);

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const shell = (children: ReactNode) => (
    <section className="org5-page" data-testid="org5-page">
      <header className="org5-head-row">
        <div className="org5-heading">
          <h1 className="org5-h1">组织与部门</h1>
          <p className="org5-sub">
            部门树 · 上下级关系、人数、负责人与更新时间
            {org.phase === "ready" && !forced ? ` · 共 ${total} 个部门` : ""}
          </p>
        </div>
        <div className="org5-tools">
          {org.phase === "ready" && !forced ? (
            <input
              data-testid="org5-search"
              className="org5-search"
              type="search"
              aria-label="按部门名搜索"
              placeholder="搜索部门名"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
          ) : null}
          <Button size="sm" outlined onClick={refresh} data-testid="org5-refresh">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            刷新
          </Button>
        </div>
      </header>
      {children}
    </section>
  );

  const tree = (rows: TreeNode[]) => (
    <Card className="org5-card">
      <CardContent className="org5-card-content" data-testid="org5-list">
        <div className="org5-table-head" aria-hidden>
          <span>部门名</span>
          <span>上级部门</span>
          <span>人数</span>
          <span>负责人</span>
          <span>更新时间</span>
        </div>
        <ul className="org5-tree">
          {rows.map((node) => (
            <DeptRow
              key={node.key}
              node={node}
              depth={0}
              collapsed={visibleCollapsed}
              onToggle={toggle}
              needle={needle}
              hits={hits}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );

  if (forced === "loading") {
    return shell(
      <section className="org5-skeleton" data-testid="org5-loading" aria-label="正在加载组织架构">
        {[0, 1, 2].map((i) => (
          <div key={i} className="org5-skeleton-row" />
        ))}
      </section>,
    );
  }

  if (forced === "empty") {
    return shell(
      <StateShell
        testid="org5-empty"
        icon={<Inbox className="h-4 w-4 text-white/30" aria-hidden />}
        title="部门树暂时是空的"
        body="后台还没有建立任何部门。建档完成后这里会自动长出树形结构，不显示 0 个部门。"
      />,
    );
  }

  if (forced === "error") {
    return shell(
      <StateShell
        testid="org5-error"
        icon={<TriangleAlert className="h-4 w-4 text-rose-300/80" aria-hidden />}
        title="没能加载出组织架构"
        body="本次数据读取失败，请重试。"
        extra={<RequestId id={forcedParam("rid")} />}
        onRetry={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete("state");
          url.searchParams.delete("rid");
          window.location.assign(url.toString());
        }}
      />,
    );
  }

  // PE-07：denied 独立腿——话术逐字抄 EmployeesPage.tsx:625-655 标杆（403/404
  // 整页口径），屏上永不出现「未接入」；GAP-02 只属于活体 403/404 的未接入腿
  // （那条腿与其测试钉由 OrgModulePage.test.tsx L190 原样保留）。
  if (forced === "denied") {
    return shell(
      <StateShell
        testid="org5-denied"
        icon={<ShieldAlert className="h-4 w-4 text-amber-300/80" aria-hidden />}
        title="组织与部门暂不可见"
        body="该数据源尚未开放，或你没有查看权限。请确认后台已接入对应服务，或联系管理员开通权限。"
        extra={
          <>
            <a className="org5-apply" data-testid="org5-apply" href="#/approvals">
              去审批中心提交开通申请
            </a>
            <RequestId id={forcedParam("rid")} />
          </>
        }
        onRetry={refresh}
      />,
    );
  }

  if (org.phase === "loading") {
    return shell(
      <section className="org5-skeleton" data-testid="org5-loading" aria-label="正在加载组织架构">
        {[0, 1, 2].map((i) => (
          <div key={i} className="org5-skeleton-row" />
        ))}
      </section>,
    );
  }

  if (org.phase === "unavailable") {
    return shell(
      <StateShell
        testid="org5-denied"
        icon={<ShieldAlert className="h-4 w-4 text-amber-300/80" aria-hidden />}
        title="组织与部门未接入"
        reason={org.reason}
        gapTitle={GAP02}
        extra={
          <>
            <a className="org5-apply" data-testid="org5-apply" href="#/approvals">
              去审批中心提交开通申请
            </a>
            <RequestId id={org.requestId} />
          </>
        }
      />,
    );
  }

  if (org.phase === "error") {
    return shell(
      <StateShell
        testid="org5-error"
        icon={<TriangleAlert className="h-4 w-4 text-rose-300/80" aria-hidden />}
        title="没能加载出组织架构"
        body={org.message}
        extra={<RequestId id={org.requestId} />}
        onRetry={refresh}
      />,
    );
  }

  if (org.phase === "empty") {
    return shell(
      <StateShell
        testid="org5-empty"
        icon={<Inbox className="h-4 w-4 text-white/30" aria-hidden />}
        title="部门树暂时是空的"
        body="后台还没有建立任何部门。建档完成后这里会自动长出树形结构，不显示 0 个部门。"
      />,
    );
  }

  // PE-10 ③：org 三态之「检索空」——树已加载但关键词没命中，与未接入/真为空互斥。
  if (needle !== "" && hits.size === 0) {
    return shell(
      <StateShell
        testid="org5-nomatch"
        icon={<Inbox className="h-4 w-4 text-white/30" aria-hidden />}
        title={`没有匹配「${term.trim()}」的部门`}
        body="部门树里没有这个名字；不是没加载完，而是这棵树里确实没有。换个关键词，或清除搜索看全部部门。"
        extra={
          <Button size="sm" onClick={() => setTerm("")} data-testid="org5-search-clear">
            清除搜索
          </Button>
        }
      />,
    );
  }

  return shell(
    <>
      {needle !== "" && hits.size > 0 ? (
        <p className="org5-search-note" data-testid="org5-search-note">
          命中 {hits.size} 个部门，已自动展开所在路径。
        </p>
      ) : null}
      {tree(roots)}
    </>,
  );
}