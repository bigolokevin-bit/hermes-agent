/**
 * T21 · 组织与部门 module page — stage-2 delivery for lane B.
 *
 * Data source: 毕升 getDepartmentApi，经 BFF 别名 `/agent-api/api/v1/dept/*`。
 * The exact route is unverified (GAP-02, ROUTE_TABLE row 149): the page tries
 * the known candidates for real; when none answers it shows an honest
 * 「待核实（GAP-02）」state plus the 申请入口 note — never a fabricated tree,
 * never a fake 0 headcount.
 *
 * Display contract: flat rows (dept_id/parent_id) and nested payloads
 * (children[]) both build the same tree; raw ids live in `title` only;
 * missing values read 「待核实」. Wiring waits for a lane A bridge probe
 * (recorded in docs/_artifacts/employees/DONE.md), same as T20.
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
import { Badge, Button, Card, CardContent } from "@nous-research/ui";

import { fetchJSON } from "@/lib/api";
import { API_UNREACHABLE_MESSAGE, ApiError, humanizeStatus } from "@/lib/api-error";

/* ------------------------------------------------------------------ *
 * types & readers
 * ------------------------------------------------------------------ */

type Rec = Record<string, unknown>;

type Resource<T> =
  | { phase: "loading" }
  | { phase: "empty" }
  | { phase: "ready"; data: T }
  | { phase: "denied"; message: string }
  | { phase: "error"; message: string; requestId: string | null };

const DENIED_FORBIDDEN = "你没有查看这块数据的权限。";
const GAP02_MESSAGE =
  "组织架构待核实（上游部门数据接口尚未接入本控制台）。接入后这里会自动显示真实部门树。";

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

function itemsOf(body: unknown): Rec[] {
  if (Array.isArray(body)) return body.filter(isRecord);
  if (isRecord(body)) {
    if (Array.isArray(body.items)) return body.items.filter(isRecord);
    if (Array.isArray(body.data)) return body.data.filter(isRecord);
    if (isRecord(body.data) && Array.isArray(body.data.items)) return body.data.items.filter(isRecord);
  }
  return [];
}

/* ------------------------------------------------------------------ *
 * tree building (flat parent_id rows or nested children[] payloads)
 * ------------------------------------------------------------------ */

type Dept = {
  key: string;
  parent: string;
  name: string | null;
  count: number | null;
  rawId: string;
};

function collect(rows: Rec[], parentId: string, out: Dept[]): void {
  rows.forEach((row, index) => {
    const rawId = pickString(row.dept_id, row.id, row.deptId) ?? `row-${out.length}`;
    const name = pickString(row.dept_name, row.name, row.title);
    const countValue = row.user_count ?? row.headcount ?? row.member_count;
    const count = typeof countValue === "number" && Number.isFinite(countValue) ? countValue : null;
    // an explicit parent field wins; otherwise inherit the nesting parent
    const explicit = pickString(row.parent_id, row.parentId);
    out.push({
      key: rawId,
      parent: explicit ?? (parentId || ""),
      name,
      count,
      rawId,
    });
    if (Array.isArray(row.children)) collect(row.children.filter(isRecord), rawId, out);
    void index;
  });
}

type TreeNode = Dept & { children: TreeNode[] };

function buildTree(depts: Dept[]): TreeNode[] {
  const byKey = new Map<string, TreeNode>();
  for (const d of depts) {
    if (!byKey.has(d.key)) byKey.set(d.key, { ...d, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of byKey.values()) {
    const parent = node.parent && node.parent !== "0" && node.parent !== "-1" ? byKey.get(node.parent) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  // deterministic order: keep source order within each level (Map keeps it)
  return roots;
}

/* ------------------------------------------------------------------ *
 * fetch — real endpoints, honest GAP-02 when none answers
 * ------------------------------------------------------------------ */

const ORG_ENDPOINTS = [
  "/agent-api/api/v1/dept/list",
  "/agent-api/api/v1/dept/tree",
];

async function loadOrg(): Promise<Resource<Dept[]>> {
  let saw403 = false;
  let firstError: ApiError | null = null;
  for (const url of ORG_ENDPOINTS) {
    try {
      const body = await fetchJSON<unknown>(url);
      const rows = itemsOf(body);
      if (rows.length === 0) return { phase: "empty" };
      const depts: Dept[] = [];
      collect(rows, "", depts);
      return { phase: "ready", data: depts };
    } catch (err: unknown) {
      const api = err instanceof ApiError ? err : null;
      if (api?.status === 403) saw403 = true;
      else if (api && api.status !== 404 && !firstError) firstError = api;
    }
  }
  if (saw403) return { phase: "denied", message: DENIED_FORBIDDEN };
  if (firstError) {
    const message =
      firstError.status && firstError.status >= 500
        ? API_UNREACHABLE_MESSAGE
        : firstError.message || humanizeStatus(firstError.status);
    return { phase: "error", message, requestId: firstError.requestId ?? null };
  }
  return { phase: "denied", message: GAP02_MESSAGE };
}

function useOrg(nonce: number): Resource<Dept[]> {
  const [resource, setResource] = useState<Resource<Dept[]>>({ phase: "loading" });
  useEffect(() => {
    let cancelled = false;
    setResource({ phase: "loading" });
    loadOrg()
      .then((r) => {
        if (!cancelled) setResource(r);
      })
      .catch(() => {
        if (!cancelled) setResource({ phase: "error", message: API_UNREACHABLE_MESSAGE, requestId: null });
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);
  return resource;
}

/* ------------------------------------------------------------------ *
 * state shell (same idiom as T20)
 * ------------------------------------------------------------------ */

function StateShell({
  testid,
  icon,
  title,
  body,
  onRetry,
  extra,
}: {
  testid: string;
  icon: ReactNode;
  title: string;
  body?: string;
  onRetry?: () => void;
  extra?: ReactNode;
}) {
  return (
    <section data-testid={testid} className="flex flex-col items-start gap-3 p-4">
      <div className="flex items-center gap-2 text-sm text-white/80">
        {icon}
        <span>{title}</span>
      </div>
      {body ? <p className="text-xs leading-relaxed text-white/40">{body}</p> : null}
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

const MAX_DEPTH = 12; // cycle guard: a department org will never nest this deep

function DeptRow({
  node,
  depth,
  collapsed,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (key: string) => void;
}) {
  const hasChildren = node.children.length > 0 && depth < MAX_DEPTH;
  const isCollapsed = collapsed.has(node.key);
  return (
    <>
      <li
        data-testid="org4-node"
        className="flex items-center gap-2 py-2 pr-4"
        style={{ paddingLeft: 8 + depth * 16 }}
        title={node.rawId ? `记录号 ${node.rawId}` : undefined}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "展开" : "收起"}
            onClick={() => onToggle(node.key)}
            className="shrink-0 text-white/40 hover:text-white/70"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
        <Building2 className="h-3.5 w-3.5 shrink-0 text-white/25" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm text-white/85">{node.name ?? "待核实"}</span>
        {node.count === null ? (
          <Badge tone={undefined}>人数待核实</Badge>
        ) : (
          <span className="shrink-0 text-xs text-white/50">共 {node.count} 人</span>
        )}
      </li>
      {hasChildren && !isCollapsed
        ? node.children.map((child) => (
            <DeptRow key={child.key} node={child} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} />
          ))
        : null}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * the page
 * ------------------------------------------------------------------ */

export default function OrgModulePage() {
  const [reload, setReload] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const org = useOrg(reload);

  const roots = useMemo<TreeNode[]>(() => {
    if (org.phase !== "ready") return [];
    return buildTree(org.data);
  }, [org]);

  const total = org.phase === "ready" ? org.data.length : 0;

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="flex flex-col gap-4" data-testid="org4-page">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-mondwest text-xl text-white/90">组织与部门</h1>
          <p className="mt-1 text-xs text-white/40">
            部门树 · 上下级关系与人数
            {org.phase === "ready" ? ` · 共 ${total} 个部门` : ""}
          </p>
        </div>
        <Button size="sm" outlined onClick={() => setReload((n) => n + 1)}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          刷新
        </Button>
      </header>

      {org.phase === "loading" ? (
        <section
          data-testid="org4-loading"
          className="flex flex-col gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-4"
          aria-label="正在加载组织架构"
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-white/5" />
          ))}
        </section>
      ) : null}

      {org.phase === "denied" ? (
        <StateShell
          testid="org4-denied"
          icon={<ShieldAlert className="h-4 w-4 text-amber-300/80" aria-hidden />}
          title={org.message === DENIED_FORBIDDEN ? "暂时看不到组织架构" : "数据源待核实"}
          body={org.message}
          onRetry={() => setReload((n) => n + 1)}
          extra={
            org.message === GAP02_MESSAGE ? (
              <p data-testid="org4-apply" className="text-xs leading-relaxed text-white/55">
                申请接入：请提交平台工单，说明用于控制台「组织与部门」页，申请接入部门数据接口。
              </p>
            ) : undefined
          }
        />
      ) : null}

      {org.phase === "error" ? (
        <StateShell
          testid="org4-error"
          icon={<TriangleAlert className="h-4 w-4 text-rose-300/80" aria-hidden />}
          title="没能加载出组织架构"
          body={`${org.message}${org.requestId ? `（请求编号：${org.requestId}）` : "（本次请求未记录编号，可复制时间与操作路径反馈）"}`}
          onRetry={() => setReload((n) => n + 1)}
        />
      ) : null}

      {org.phase === "empty" ? (
        <StateShell
          testid="org4-empty"
          icon={<Inbox className="h-4 w-4 text-white/30" aria-hidden />}
          title="部门树暂时是空的"
          body="后台还没有建立任何部门。建档完成后这里会自动长出树形结构。"
          onRetry={() => setReload((n) => n + 1)}
        />
      ) : null}

      {org.phase === "ready" ? (
        <Card className="border-white/5 bg-white/[0.02]">
          <CardContent className="p-0" data-testid="org4-list">
            <ul className="divide-y divide-white/5">
              {roots.map((node) => (
                <DeptRow key={node.key} node={node} depth={0} collapsed={collapsed} onToggle={toggle} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
