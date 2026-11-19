import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import {
  GAP02_PEOPLE,
  GAP02_ROLES,
  PEOPLE_ENDPOINTS,
  ROLE_ENDPOINTS,
  ROLE_GAP,
  adminsOf,
  loadList,
  permissionSource,
  personName,
  rawId,
  roleView,
  shortCode,
  type Rec,
  type Resource,
} from "./access";
import {
  ADMIN_GAP,
  ADMIN_GAP_MESSAGE,
  RISK_GAP,
  adminView,
  loadHighRisk,
  type AdminState,
  type HighRiskRow,
} from "./admins";
import "./access.css";

type View = "roles" | "members" | "admins";

const FORCED = new Set(["loading", "empty", "error", "denied"]);

function ForcedBlock({ state, onRetry }: { state: string; onRetry: () => void }) {
  if (state === "loading") {
    return (
      <div className="acc4-skeleton" aria-busy="true" aria-label="加载中">
        <span /><span /><span />
      </div>
    );
  }
  if (state === "empty") {
    return <div className="acc4-empty">没有读到访问控制记录。这不是 0，是尚未返回。</div>;
  }
  if (state === "denied") {
    return (
      <div className="acc4-empty" role="status">
        <b>无权访问</b>
        <span>你没有查看访问控制数据的权限，或访问控制模块尚未开放。</span>
      </div>
    );
  }
  return (
    <div className="acc4-error" role="alert">
      <b>访问控制数据读取失败</b>
      <span>本次请求未记录编号，可复制时间与操作路径反馈。</span>
      <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
        重试
      </Button>
    </div>
  );
}

function GroupState({
  resource,
  gap,
  onRetry,
  children,
}: {
  resource: Resource<Rec[]>;
  gap: string;
  onRetry: () => void;
  children: (rows: Rec[]) => ReactNode;
}) {
  if (resource.phase === "loading") {
    return <div className="acc4-skeleton" aria-busy="true"><span /><span /><span /></div>;
  }
  if (resource.phase === "unavailable") {
    return (
      <div className="acc4-gap" data-testid={gap === GAP02_ROLES ? "role5-gap" : "acc4-gap"} title={gap === GAP02_ROLES ? ROLE_GAP : undefined}>
        <b>未接入</b>
        <span>{gap}</span>
        <Link className="acc4-link" to="/approvals">
          去审批中心提交开通申请
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }
  if (resource.phase === "denied") {
    return <div className="acc4-empty">{resource.message}</div>;
  }
  if (resource.phase === "empty") {
    return <div className="acc4-empty">接口已返回，但当前没有记录；这不是权限推断。</div>;
  }
  if (resource.phase === "error") {
    return (
      <div className="acc4-error" role="alert">
        <b>{resource.message}</b>
        <RequestId id={resource.requestId ?? null} />
        <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          重试
        </Button>
      </div>
    );
  }
  return <>{children(resource.data)}</>;
}

function RoleRow({
  row,
  open,
  onToggle,
}: {
  row: Rec;
  open: boolean;
  onToggle: () => void;
}) {
  const view = roleView(row);
  const shown = view.permissions.slice(0, 3).join("、");
  const more = view.permissions.length > 3 ? ` 等 ${view.permissions.length} 项` : "";
  return (
    <>
      <tr
        data-testid="ac3-row"
        title={view.rawId || undefined}
        className={open ? "is-open" : undefined}
        onClick={onToggle}
      >
        <td data-label="角色名" data-testid="ac3-name">
          <button
            type="button"
            className="role5-expand"
            data-testid="ac3-expand"
            aria-expanded={open}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            <span aria-hidden>{open ? "−" : "+"}</span>
            {view.name}
          </button>
          {view.nameReason ? <span className="acc4-meta">{view.nameReason}</span> : null}
        </td>
        <td data-label="成员数" data-testid="ac3-members">
          {view.memberCount ?? "—"}
          {view.memberReason ? <span className="acc4-meta">{view.memberReason}</span> : null}
        </td>
        <td
          data-label="关键权限"
          data-testid="ac3-perms"
          title={view.permissionsRaw.length ? view.permissionsRaw.join(" ") : undefined}
        >
          {view.permissions.length ? `${shown}${more}` : "—"}
          {view.permissionsReason ? <span className="acc4-meta">{view.permissionsReason}</span> : null}
        </td>
        <td data-label="来源" data-testid="ac3-source" title={view.sourceRaw || undefined}>
          {view.source}
          {view.sourceReason ? <span className="acc4-meta">{view.sourceReason}</span> : null}
        </td>
        <td data-label="更新时间" data-testid="ac3-updated">
          {view.updatedAt ?? "—"}
          {view.updatedReason ? <span className="acc4-meta">{view.updatedReason}</span> : null}
        </td>
      </tr>
      {open ? (
        <tr data-testid="ac3-member-panel">
          <td colSpan={5}>
            {view.members.length ? (
              <ul className="role5-members">
                {view.members.map((member, index) => (
                  <li key={member.rawId || `${member.name}-${index}`} data-testid="ac3-member-row">
                    <span>{member.name}</span>
                    <Badge tone="outline">{member.code}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="acc4-meta">{view.membersReason ?? "上游未提供成员明细"}</span>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function RoleTable({
  rows,
  expanded,
  onToggle,
}: {
  rows: Rec[];
  expanded: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="role5-scroll">
      <table className="role5-table" data-testid="ac3-table">
        <thead>
          <tr>
            <th>角色名</th>
            <th>成员数</th>
            <th>关键权限</th>
            <th>来源</th>
            <th>更新时间</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const id = rawId(row) || `role-${index}`;
            return (
              <RoleRow
                key={id}
                row={row}
                open={expanded === id}
                onToggle={() => onToggle(id)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AccessGap() {
  return (
    <div className="acc4-gap" data-testid="ac3-gap" title={ROLE_GAP}>
      <b>未接入</b>
      <span>{GAP02_ROLES}</span>
      <Link className="acc4-link" to="/approvals">
        去审批中心提交开通申请
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function RequestId({ id, testid = "ac3-request-id" }: { id: string | null; testid?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="acc4-req" data-testid={testid}>
      请求编号 {id ?? "未提供"}
      {id ? (
        <button
          type="button"
          className="acc4-copy"
          aria-label="复制请求编号"
          onClick={() => {
            void navigator.clipboard?.writeText(id).then(
              () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              },
              () => setCopied(false),
            );
          }}
        >
          {copied ? "已复制" : "复制"}
        </button>
      ) : null}
    </span>
  );
}

function AdminGap() {
  return (
    <div className="acc4-gap" data-testid="adm5-gap" title={ADMIN_GAP}>
      <b>未接入</b>
      <span>{ADMIN_GAP_MESSAGE}</span>
      <Link className="acc4-link" to="/approvals">
        去审批中心提交开通申请
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function AdminTable({ rows }: { rows: Rec[] }) {
  return (
    <div className="adm5-scroll">
      <table className="adm5-table" data-testid="adm5-admin-table">
        <thead>
          <tr>
            <th>账号</th>
            <th>角色</th>
            <th>最近登录</th>
            <th>最近高危操作</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const view = adminView(row);
            return (
              <tr key={view.rawId || `admin-${index}`} data-testid="adm5-admin-row" title={view.rawId || undefined}>
                <td data-label="账号" data-testid="adm5-admin-account">
                  {view.name}
                  {view.code !== "未指派" ? ` · ${view.code}` : ""}
                  {view.name === "未指派" ? <span className="acc4-meta">上游未提供姓名</span> : null}
                </td>
                <td data-label="角色" data-testid="adm5-admin-role">
                  {view.role}
                  {view.roleReason ? <span className="acc4-meta">{view.roleReason}</span> : null}
                </td>
                <td data-label="最近登录" data-testid="adm5-admin-login">
                  {view.lastLogin ?? "—"}
                  {view.lastLoginReason ? <span className="acc4-meta">{view.lastLoginReason}</span> : null}
                </td>
                <td data-label="最近高危操作" data-testid="adm5-admin-risk">
                  {view.lastRisk ?? "—"}
                  {view.lastRiskReason ? <span className="acc4-meta">{view.lastRiskReason}</span> : null}
                </td>
                <td data-label="状态" data-testid="adm5-admin-status">
                  {view.status}
                  {view.statusReason ? <span className="acc4-meta">{view.statusReason}</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RiskRequestId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const short = id.length <= 12 ? id : `${id.slice(0, 6)}…${id.slice(-4)}`;
  return (
    <span className="acc4-req" title={id} data-testid="adm5-risk-request-id">
      {short}
      <button
        type="button"
        className="acc4-copy"
        aria-label="复制请求编号"
        data-testid="adm5-risk-copy"
        onClick={() => {
          void navigator.clipboard?.writeText(id).then(
            () => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            },
            () => setCopied(false),
          );
        }}
      >
        {copied ? "已复制" : "复制"}
      </button>
    </span>
  );
}

function RiskTable({ rows }: { rows: HighRiskRow[] }) {
  return (
    <div className="adm5-scroll">
      <table className="adm5-table" data-testid="adm5-risk-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>类别</th>
            <th>操作</th>
            <th>对象</th>
            <th>操作者</th>
            <th>请求编号</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.eventId} data-testid="adm5-risk-row" title={row.rawAction}>
              <td data-label="时间" data-testid="adm5-risk-time">
                {row.at ?? "—"}
                {row.atReason ? <span className="acc4-meta">{row.atReason}</span> : null}
              </td>
              <td data-label="类别" data-testid="adm5-risk-category">{row.category}</td>
              <td data-label="操作" data-testid="adm5-risk-action">{row.action}</td>
              <td data-label="对象" data-testid="adm5-risk-object">
                {row.object}
                {row.objectReason ? <span className="acc4-meta">{row.objectReason}</span> : null}
              </td>
              <td data-label="操作者" data-testid="adm5-risk-actor">
                {row.actor}
                {row.actorReason ? <span className="acc4-meta">{row.actorReason}</span> : null}
              </td>
              <td data-label="请求编号"><RiskRequestId id={row.requestId} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HighRiskPanel({ state, onRetry }: { state: AdminState; onRetry: () => void }) {
  return (
    <section className="adm5-risk" data-testid="adm5-risk-panel">
      <div className="adm5-risk-head">
        <h2>高危操作</h2>
        <span className="acc4-meta">来源：审计事件（删除 / 授权变更 / 凭据变更）</span>
      </div>
      {state.phase === "loading" ? (
        <div className="acc4-skeleton" aria-busy="true" aria-label="正在加载高危操作"><span /><span /><span /></div>
      ) : state.phase === "denied" || state.phase === "unavailable" ? (
        <div className="acc4-gap" data-testid="adm5-risk-gap" title={RISK_GAP}>
          <b>未接入</b>
          <span>{state.message}</span>
        </div>
      ) : state.phase === "error" ? (
        <div className="acc4-error" role="alert" data-testid="adm5-risk-error">
          <b>{state.message}</b>
          <RequestId id={state.requestId} testid="adm5-risk-error-request-id" />
          <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
            重试
          </Button>
        </div>
      ) : state.phase === "empty" ? (
        <div className="acc4-empty" data-testid="adm5-risk-empty">
          接口已响应，没有删除、授权或凭据变更记录；不补 0，也不展示样例。
        </div>
      ) : (
        <RiskTable rows={state.rows} />
      )}
    </section>
  );
}

function PersonRow({ row, admin }: { row: Rec; admin?: boolean }) {
  return (
    <li className="acc4-row" data-testid="ac3-person-row">
      <span className="acc4-name" title={rawId(row) || undefined}>{personName(row)}</span>
      <Badge tone="outline">{shortCode(row)}</Badge>
      <span className="acc4-meta">
        {admin ? "管理员" : permissionSource(row)}
      </span>
    </li>
  );
}

export default function AccessModulePage() {
  const [sp, setSp] = useSearchParams();
  const forced = (sp.get("state") ?? "").toLowerCase();
  const requestedView = (sp.get("view") ?? sp.get("tab") ?? "").toLowerCase();
  const view: View = requestedView === "members" ? "members" : requestedView === "admins" ? "admins" : "roles";
  const [people, setPeople] = useState<Resource<Rec[]>>({ phase: "loading" });
  const [roles, setRoles] = useState<Resource<Rec[]>>({ phase: "loading" });
  const [risk, setRisk] = useState<AdminState>({ phase: "loading" });
  const [expanded, setExpanded] = useState<string | null>(null);

  const selectView = (next: View) => {
    const params = new URLSearchParams(sp);
    params.set("view", next);
    setSp(params);
  };

  const reload = useCallback(() => {
    setPeople({ phase: "loading" });
    setRoles({ phase: "loading" });
    void loadList(PEOPLE_ENDPOINTS, GAP02_PEOPLE).then(setPeople);
    void loadList(ROLE_ENDPOINTS, GAP02_ROLES).then(setRoles);
  }, []);

  const reloadRisk = useCallback(() => {
    setRisk({ phase: "loading" });
    void loadHighRisk().then(setRisk);
  }, []);

  const retry = useCallback(() => {
    if (FORCED.has(forced)) {
      const params = new URLSearchParams(sp);
      params.delete("state");
      setSp(params);
    }
    reload();
    if (view === "admins") reloadRisk();
  }, [forced, reload, reloadRisk, setSp, sp, view]);

  useEffect(() => {
    if (FORCED.has(forced)) return;
    reload();
    if (view === "admins") reloadRisk();
  }, [forced, reload, reloadRisk, view]);

  const admins = useMemo(
    () => adminsOf(people.phase === "ready" ? people.data : []),
    [people],
  );

  const counts = {
    roles: roles.phase === "ready" ? roles.data.length : null,
    members: people.phase === "ready" ? people.data.length : null,
    admins: people.phase === "ready" ? (admins.known ? admins.rows.length : null) : null,
  };

  if (FORCED.has(forced)) {
    return (
      <div
        className="acc4-page"
        data-testid={view === "admins" ? "adm5-page" : "ac3-page"}
        data-page={view === "admins" ? "admins" : undefined}
      >
        <header className="acc4-head">
          <ShieldCheck className="h-5 w-5" />
          <h1>访问控制</h1>
        </header>
        <Card>
          <CardContent>
            <ForcedBlock state={forced} onRetry={retry} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="acc4-page"
      data-testid={view === "admins" ? "adm5-page" : "ac3-page"}
      data-page={view === "admins" ? "admins" : undefined}
    >
      <header className="acc4-head">
        <div className="acc4-title">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          <h1>访问控制</h1>
          <span>角色、成员与管理员 · 只读</span>
        </div>
        <Button
          size="sm"
          outlined
          onClick={() => {
            reload();
            if (view === "admins") reloadRisk();
          }}
          prefix={<RefreshCw className="h-3.5 w-3.5" />}
        >
          刷新
        </Button>
      </header>

      <div className="acc4-seg" role="tablist" aria-label="访问控制分组">
        {([
          ["roles", "角色", "ac3-tab-roles"],
          ["members", "成员", "ac3-tab-members"],
          ["admins", "管理员", "ac3-tab-admins"],
        ] as const).map(([id, label, testid]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            data-testid={testid}
            onClick={() => selectView(id)}
          >
            {label}
            <em>{counts[id] === null ? "—" : counts[id]}</em>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="acc4-body">
          {view === "roles" ? (
            roles.phase === "unavailable" || roles.phase === "denied" ? (
              <AccessGap />
            ) : (
              <GroupState resource={roles} gap={GAP02_ROLES} onRetry={reload}>
                {(rows) => (
                  <RoleTable
                    rows={rows}
                    expanded={expanded}
                    onToggle={(id) => setExpanded((prev) => (prev === id ? null : id))}
                  />
                )}
              </GroupState>
            )
          ) : view === "members" ? (
            <GroupState resource={people} gap={GAP02_PEOPLE} onRetry={reload}>
              {(rows) => (
                <ul className="acc4-list">
                  {rows.map((row, i) => (
                    <PersonRow key={rawId(row) || `person-${i}`} row={row} />
                  ))}
                </ul>
              )}
            </GroupState>
          ) : (
            <div className="adm5-stack">
              {people.phase === "unavailable" || people.phase === "denied" ? (
                <AdminGap />
              ) : people.phase === "error" ? (
                <div className="acc4-error" role="alert" data-testid="adm5-admin-error">
                  <b>{people.message}</b>
                  <RequestId id={people.requestId ?? null} testid="adm5-request-id" />
                  <Button size="sm" outlined onClick={reload} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
                    重试
                  </Button>
                </div>
              ) : people.phase === "empty" ? (
                <div className="acc4-empty" data-testid="adm5-admin-empty">
                  接口已返回，但当前没有管理员记录；这不是权限推断。
                </div>
              ) : people.phase === "ready" && !admins.known ? (
                <div className="acc4-empty" data-testid="adm5-admin-unknown">
                  人员接口没有返回管理员标识，本组不展示任何推断出来的管理员。
                </div>
              ) : people.phase === "ready" && admins.rows.length === 0 ? (
                <div className="acc4-empty" data-testid="adm5-admin-empty">接口已返回管理员标识，但当前没有管理员。</div>
              ) : (
                <AdminTable rows={admins.rows} />
              )}
              <HighRiskPanel state={risk} onRetry={reloadRisk} />
            </div>
          )}
        </CardContent>
      </Card>

      <p className="acc4-note">
        权限来源按人话显示；角色或来源缺失时写「—（来源未提供）」，不补 0。
        本页只读，不提供授权、撤销或角色编辑入口。
      </p>
      <Link className="acc4-link" to="/identity">
        返回组织与人员
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/** R26 stable export for the /identity?tab=admins slot (R5 registration). */
export function AdminsModulePage() {
  return <AccessModulePage />;
}
