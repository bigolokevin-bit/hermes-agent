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
        <span className="acc4-req">请求编号 {resource.requestId ?? "未提供"}</span>
        <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          重试
        </Button>
      </div>
    );
  }
  return <>{children(resource.data)}</>;
}

function RoleRow({ row }: { row: Rec }) {
  const view = roleView(row);
  return (
    <tr data-testid="role5-row" title={view.rawId || undefined}>
      <td data-testid="role5-name">
        {view.name}
        {view.nameReason ? <span className="acc4-meta">{view.nameReason}</span> : null}
      </td>
      <td data-testid="role5-scope" title={view.scopeRaw || undefined}>
        {view.scope}
        {view.scopeReason ? <span className="acc4-meta">{view.scopeReason}</span> : null}
      </td>
      <td data-testid="role5-members">
        {view.memberCount ?? "—"}
        {view.memberReason ? <span className="acc4-meta">{view.memberReason}</span> : null}
      </td>
      <td data-testid="role5-updated">
        {view.updatedAt ?? "—"}
        {view.updatedReason ? <span className="acc4-meta">{view.updatedReason}</span> : null}
      </td>
    </tr>
  );
}

function PersonRow({ row, admin }: { row: Rec; admin?: boolean }) {
  return (
    <li className="acc4-row" data-testid="acc4-person-row">
      <span className="acc4-name" title={rawId(row) || undefined}>{personName(row)}</span>
      <Badge tone="outline">{shortCode(row)}</Badge>
      <span className="acc4-meta">
        {admin ? "管理员" : permissionSource(row)}
      </span>
    </li>
  );
}

export default function AccessModulePage() {
  const [sp] = useSearchParams();
  const forced = (sp.get("state") ?? "").toLowerCase();
  const [view, setView] = useState<View>(sp.get("view") === "members" ? "members" : sp.get("view") === "admins" ? "admins" : "roles");
  const [people, setPeople] = useState<Resource<Rec[]>>({ phase: "loading" });
  const [roles, setRoles] = useState<Resource<Rec[]>>({ phase: "loading" });

  const reload = useCallback(() => {
    setPeople({ phase: "loading" });
    setRoles({ phase: "loading" });
    void loadList(PEOPLE_ENDPOINTS, GAP02_PEOPLE).then(setPeople);
    void loadList(ROLE_ENDPOINTS, GAP02_ROLES).then(setRoles);
  }, []);

  useEffect(() => {
    if (!FORCED.has(forced)) reload();
  }, [forced, reload]);

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
      <div className="acc4-page" data-testid="acc4-page" data-fixture="1">
        <header className="acc4-head">
          <ShieldCheck className="h-5 w-5" />
          <h1>访问控制</h1>
        </header>
        <Card>
          <CardContent>
            <ForcedBlock state={forced} onRetry={reload} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="acc4-page" data-testid="acc4-page">
      <header className="acc4-head">
        <div className="acc4-title">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          <h1>访问控制</h1>
          <span>角色、成员与管理员 · 只读</span>
        </div>
        <Button size="sm" outlined onClick={reload} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          刷新
        </Button>
      </header>

      <div className="acc4-seg" role="tablist" aria-label="访问控制分组">
        {([
          ["roles", "角色", "acc4-tab-roles"],
          ["members", "成员", "acc4-tab-members"],
          ["admins", "管理员", "acc4-tab-admins"],
        ] as const).map(([id, label, testid]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            data-testid={testid}
            onClick={() => setView(id)}
          >
            {label}
            <em>{counts[id] === null ? "—" : counts[id]}</em>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="acc4-body">
          {view === "roles" ? (
            <GroupState resource={roles} gap={GAP02_ROLES} onRetry={reload}>
              {(rows) => (
                <div className="role5-scroll">
                  <table className="role5-table" data-testid="role5-table">
                    <thead>
                      <tr>
                        <th>角色名</th>
                        <th>范围</th>
                        <th>成员数</th>
                        <th>更新时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <RoleRow key={rawId(row) || `role-${i}`} row={row} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GroupState>
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
          ) : people.phase === "ready" && !admins.known ? (
            <div className="acc4-gap">
              <b>管理员标识未提供</b>
              <span>人员接口没有返回管理员字段，本组不展示任何推断出来的管理员。</span>
            </div>
          ) : (
            <GroupState resource={people} gap={GAP02_PEOPLE} onRetry={reload}>
              {() =>
                admins.rows.length === 0 ? (
                  <div className="acc4-empty">接口已返回管理员标识，但当前没有管理员。</div>
                ) : (
                  <ul className="acc4-list">
                    {admins.rows.map((row, i) => (
                      <PersonRow key={rawId(row) || `admin-${i}`} row={row} admin />
                    ))}
                  </ul>
                )
              }
            </GroupState>
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