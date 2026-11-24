/**
 * 人员与访问 · 角色与权限（`/identity?tab=roles`）。
 *
 * 立屏理由是角色 × 动作矩阵：结构照骨架九卡保留，只允许值缺。
 * 权限矩阵没有读口（`/api/roles` 404），矩阵行因此取成员台账里**显式给出**的
 * role 值；台账也没有角色字段时渲染一行「未读到角色定义」的占位行，列头与
 * 六类动作照样立着，不删表、不补示例勾叉。条件权限、成员角色与最近操作同样
 * 没有读口：格内留 `—`，缺读口只在卡底「数据可用性」声明一次。
 *
 * 有读口的部分按骨架密度做实：部门归组、成员明细（部门范围 / 状态）、异常与
 * 建议都由成员台账现算；副行按骨架形制写「角色 × 6 类动作 · 条件权限」。
 */
import { useMemo, type ReactNode } from "react";

import { Pill } from "@/components/console/Pill";

import { DASH, IdCard, IdentityHead, KvList, PlannedButton } from "./bits";
import {
  departmentBuckets,
  lifecyclePill,
  roleBuckets,
  shortCode,
  type MemberRow,
} from "./model";
import { useIdentity } from "./useIdentity";
import "./identity.css";

const ACTION_COLS = ["查看", "运行任务", "写入配置", "审批", "安装", "删除"] as const;
const MATRIX_COLS = ["角色", ...ACTION_COLS, "成员"] as const;
const ROSTER_COLS = ["角色", "成员", "人数", "范围"] as const;
const LEGEND = "✓ 允许 · ◐ 条件 · — 禁止";
const CHIP_MAX = 3;

interface DeptGroup {
  name: string;
  unassigned: boolean;
  members: MemberRow[];
  active: number;
  pending: number;
}

/** 按成员台账的部门字段归组，顺序沿用 departmentBuckets（多→少，未归属殿后）。 */
function groupByDepartment(rows: MemberRow[]): DeptGroup[] {
  const byName = new Map<string, MemberRow[]>();
  for (const row of rows) {
    const key = row.department ?? "未归属";
    const list = byName.get(key);
    if (list) list.push(row);
    else byName.set(key, [row]);
  }
  return departmentBuckets(rows).map((bucket) => {
    const list = byName.get(bucket.name) ?? [];
    return {
      name: bucket.name,
      unassigned: bucket.unassigned,
      members: list,
      active: list.filter((member) => member.lifecycle === "active").length,
      pending: list.filter((member) => member.lifecycle === "draft").length,
    };
  });
}

/** 在职 / 待激活是一句人话，不写「共 N 人」的重复数。 */
function groupStatus(group: DeptGroup): string {
  const parts: string[] = [];
  if (group.active > 0) parts.push(`在职 ${group.active}`);
  if (group.pending > 0) parts.push(`待激活 ${group.pending}`);
  const rest = group.members.length - group.active - group.pending;
  if (rest > 0) parts.push(`其他 ${rest}`);
  return parts.join(" · ") || "未标注";
}

interface Notice {
  tone: "warn" | "info" | "bad";
  title: string;
  sub: string;
}

/** 异常只报台账里数得出来的三件事：待激活、未归属部门、单人部门。 */
function ledgerNotices(members: MemberRow[], groups: DeptGroup[]): Notice[] {
  const notices: Notice[] = [];
  const pending = members.filter((member) => member.lifecycle === "draft");
  if (pending.length > 0) {
    notices.push({
      tone: "warn",
      title: `${pending.length} 名成员待激活`,
      sub: `${pending.map((member) => member.name).join("、")}：发出邀请后尚未激活。`,
    });
  }
  const unassigned = members.filter((member) => !member.department);
  if (unassigned.length > 0) {
    notices.push({
      tone: "info",
      title: `${unassigned.length} 名成员未归属部门`,
      sub: `${unassigned.map((member) => member.name).join("、")}：部门字段为空。`,
    });
  }
  const singles = groups.filter((group) => !group.unassigned && group.members.length === 1);
  if (singles.length > 0) {
    notices.push({
      tone: "info",
      title: `${singles.length} 个部门只有 1 名成员`,
      sub: `${singles.map((group) => group.name).join("、")}：部门范围只覆盖一人。`,
    });
  }
  return notices;
}

interface Advice {
  title: string;
  sub: string;
}

/** 建议只用台账里数得出来的事实（未归属部门 / 单人部门），没有就留卡壳。 */
function ledgerAdvice(members: MemberRow[], groups: DeptGroup[]): Advice[] {
  const advice: Advice[] = [];
  const unassigned = members.filter((member) => !member.department).length;
  if (unassigned > 0) {
    advice.push({
      title: `${unassigned} 名成员未归属部门`,
      sub: "部门字段为空，不计入任何部门范围。",
    });
  }
  const singles = groups.filter((group) => !group.unassigned && group.members.length === 1);
  if (singles.length > 0) {
    advice.push({
      title: `${singles.length} 个部门只有 1 名成员`,
      sub: `${singles.map((group) => group.name).join("、")}：部门范围只覆盖一人。`,
    });
  }
  return advice;
}

/** 矩阵/清单里没有值的格：等宽破折号，不补 0、不补示例。 */
function DashCell({ right }: { right?: boolean }) {
  return <td className={`${right ? "id-right " : ""}id-center id-mono`}>{DASH}</td>;
}

/** 占位行首格：灰字承载列宽，后六格与成员格留破折号。 */
/**
 * 占位行只写一次缺读事实，**不逐格铺 `—`**：格内 `—` 是「这一格的值没读到」，
 * 整行都没有数据时逐格铺破折号只会把页面画成报错图（2026-11-24 评审口径）。
 */
function EmptyRoleRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr className="id-row-empty">
      <td colSpan={cols}>{children}</td>
    </tr>
  );
}

export function IdentityRolesPage() {
  const { phase, data, message, denied, requestId, reload } = useIdentity();
  const members = useMemo(() => data?.members ?? [], [data]);
  const groups = useMemo(() => groupByDepartment(members), [members]);
  const notices = useMemo(() => ledgerNotices(members, groups), [members, groups]);
  const advice = useMemo(() => ledgerAdvice(members, groups), [members, groups]);
  const roles = useMemo(() => roleBuckets(members), [members]);

  const namedGroups = groups.filter((group) => !group.unassigned);
  const namedCount = namedGroups.length;
  const assignedCount = namedGroups.reduce((sum, group) => sum + group.members.length, 0);
  const unassignedCount = members.length - assignedCount;
  const actionCount = ACTION_COLS.length;

  const sub =
    phase === "ready" ? (
      <>
        {roles.length > 0 ? (
          <>
            <b className="id-num">{roles.length}</b> 个角色
          </>
        ) : (
          "角色定义未读到"
        )}{" "}
        × <b className="id-num">{actionCount}</b> 类动作
        <span className="id-sep" aria-hidden="true">
          ·
        </span>
        条件权限未读到
      </>
    ) : (
      "角色与权限读取中…"
    );

  return (
    <section className="id-page" data-testid="identity-roles">
      <IdentityHead
        testId="identity-roles-sub"
        sub={sub}
        acts={
          <>
            <PlannedButton testId="identity-roles-export">导出</PlannedButton>
            <PlannedButton primary testId="identity-roles-create">
              新建角色
            </PlannedButton>
          </>
        }
      />

      {phase === "loading" ? (
        <div className="id-skeleton" aria-busy="true" aria-label="读取中">
          <span />
          <span />
        </div>
      ) : phase === "error" ? (
        <div className="id-block" role={denied ? "status" : "alert"} data-testid="identity-roles-state">
          <b>{denied ? "无权查看" : "读不到成员台账"}</b>
          <span title={requestId ? `请求号 ${requestId}` : undefined}>{message}</span>
          {denied ? null : (
            <button type="button" className="id-btn" onClick={reload}>
              重试
            </button>
          )}
        </div>
      ) : (
        <>
          <IdCard
            title="角色 × 动作"
            count={<span className="id-legend">{LEGEND}</span>}
            testId="identity-matrix-card"
            flush
            note="行 = 角色 · 列 = 六类动作 · 右端 = 成员数"
            availability={[
              {
                label: "角色定义/权限矩阵",
                reason: "无读口：角色读口返回 404，六类动作的允许与条件权限都没有上游读数",
              },
            ]}
          >
            <div className="id-tw">
              <table className="id-table id-table--matrix" data-testid="identity-matrix-table">
                <thead>
                  <tr>
                    {MATRIX_COLS.map((col, index) => (
                      <th
                        key={col}
                        scope="col"
                        className={
                          index === 0 ? undefined : index === MATRIX_COLS.length - 1 ? "id-right" : "id-center"
                        }
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roles.length === 0 ? (
                    <EmptyRoleRow cols={MATRIX_COLS.length}>未读到角色定义</EmptyRoleRow>
                  ) : (
                    roles.map((role) => (
                      <tr key={role.name}>
                        <td>{role.name}</td>
                        {ACTION_COLS.map((col) => (
                          <DashCell key={col} />
                        ))}
                        <td className="id-right id-mono">{role.members.length}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </IdCard>

          <div className="id-grid2">
            <IdCard
              title="条件说明"
              count="按角色"
              testId="identity-role-cond-card"
              availability={[
                { label: "条件权限", reason: "部门范围、双人复核与金额阈值三类条件都没有上游读数" },
              ]}
            >
              <KvList
                rows={[
                  { k: "部门范围", v: <span className="id-mono">{DASH}</span> },
                  { k: "双人复核", v: <span className="id-mono">{DASH}</span> },
                  { k: "金额阈值", v: <span className="id-mono">{DASH}</span> },
                ]}
              />
            </IdCard>

            <IdCard title="权限来源" count="3 层叠加" testId="identity-role-source-card">
              <p className="id-formula">（角色权限 并 部门范围） 交 门禁状态</p>
              <p className="id-decl">
                先并后交：角色与部门给的范围合并，再由门禁收紧；双人模式下单人仍不可执行。
              </p>
              <p className="id-decl">
                权限变更应在访问控制里做，不在员工配置里做；员工配置只决定这个数字员工用哪套角色。
              </p>
            </IdCard>
          </div>

          <div className="console-split">
            <div className="id-stack">
              <IdCard
                title="按部门"
                count={`${namedCount} 个部门`}
                testId="identity-role-dept-card"
                flush
                note={`成员、部门与在职态取自成员台账；${members.length} 名成员${
                  unassignedCount > 0 ? ` · ${unassignedCount} 未归属` : ""
                }`}
              >
                <div className="id-tw">
                  <table className="id-table id-table--role-dept" data-testid="identity-role-dept-table">
                    <thead>
                      <tr>
                        <th scope="col">部门</th>
                        <th scope="col" className="id-right">
                          成员数
                        </th>
                        <th scope="col" className="id-hidesm">
                          成员
                        </th>
                        <th scope="col">在职/待激活</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.length === 0 ? (
                        <tr className="id-row-empty">
                          <td colSpan={4}>成员台账为空：没有可归组的成员。</td>
                        </tr>
                      ) : (
                        groups.map((group) => {
                          const hidden = group.members.length - CHIP_MAX;
                          return (
                            <tr key={group.name}>
                              <td>{group.name}</td>
                              <td className="id-right id-mono">{group.members.length}</td>
                              <td className="id-hidesm">
                                <span className="id-chips">
                                  {group.members.slice(0, CHIP_MAX).map((member) => (
                                    <span className="id-chip" key={member.id} title={member.name}>
                                      {member.name}
                                    </span>
                                  ))}
                                  {hidden > 0 ? (
                                    <span className="id-chip id-chip--more" title={`还有 ${hidden} 名成员`}>
                                      +{hidden}
                                    </span>
                                  ) : null}
                                </span>
                              </td>
                              <td className="id-cell-sm">{groupStatus(group)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </IdCard>

              <IdCard
                title="成员明细"
                count={`${members.length} 行`}
                testId="identity-role-detail-card"
                flush
                note="部门范围取成员台账的部门字段，未填写即写「未填写」。"
                availability={[
                  { label: "角色", reason: "成员台账未带角色字段，取不到成员的角色" },
                  { label: "最近操作", reason: "没有操作日志读口" },
                ]}
              >
                <div className="id-tw">
                  <table className="id-table id-table--roles-detail" data-testid="identity-role-detail-table">
                    <thead>
                      <tr>
                        <th scope="col">成员</th>
                        <th scope="col">角色</th>
                        <th scope="col" className="id-hidesm">
                          部门范围
                        </th>
                        <th scope="col" className="id-right id-hidesm">
                          最近操作
                        </th>
                        <th scope="col" className="id-col-st">
                          状态
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.length === 0 ? (
                        <tr className="id-row-empty">
                          <td colSpan={5}>成员台账为空：这一屏没有可展示的成员。</td>
                        </tr>
                      ) : (
                        members.map((row) => {
                          const pill = lifecyclePill(row.lifecycle);
                          return (
                            <tr key={row.id}>
                              <td>
                                <span className="id-who" title={row.id}>
                                  <span className="id-ava" aria-hidden="true">
                                    {Array.from(row.name)[0] ?? "·"}
                                  </span>
                                  <span className="id-who__text">
                                    <span className="id-who__name">{row.name}</span>
                                    <span className="id-who__sub">{shortCode(row.id)}</span>
                                  </span>
                                </span>
                              </td>
                              <td className="id-mono">{row.role ?? DASH}</td>
                              <td className="id-hidesm id-cell-sm">{row.department ?? "未填写"}</td>
                              <td className="id-right id-hidesm id-mono">{DASH}</td>
                              <td className="id-col-st">
                                <Pill tone={pill.tone}>{pill.label}</Pill>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </IdCard>
            </div>

            <div className="id-stack">
              <IdCard
                title="按角色"
                count="成员归属"
                testId="identity-role-roster-card"
                flush
                note="角色清单取成员台账的显式角色字段。"
                availability={[{ label: "角色范围", reason: "角色的范围与门禁都没有上游读数" }]}
              >
                <div className="id-tw">
                  <table className="id-table id-table--role-roster" data-testid="identity-role-roster-table">
                    <thead>
                      <tr>
                        {ROSTER_COLS.map((col, index) => (
                          <th
                            key={col}
                            scope="col"
                            className={index === 2 ? "id-right" : index === 3 ? "id-hidesm" : undefined}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {roles.length === 0 ? (
                        <tr className="id-row-empty">
                          <td colSpan={5}>未读到角色定义</td>
                        </tr>
                      ) : (
                        roles.map((role) => {
                          const hidden = role.members.length - CHIP_MAX;
                          return (
                            <tr key={role.name}>
                              <td>{role.name}</td>
                              <td>
                                <span className="id-chips">
                                  {role.members.slice(0, CHIP_MAX).map((member) => (
                                    <span className="id-chip" key={member.id} title={member.name}>
                                      {member.name}
                                    </span>
                                  ))}
                                  {hidden > 0 ? (
                                    <span className="id-chip id-chip--more" title={`还有 ${hidden} 名成员`}>
                                      +{hidden}
                                    </span>
                                  ) : null}
                                </span>
                              </td>
                              <td className="id-right id-mono">{role.members.length}</td>
                              <td className="id-hidesm id-mono">{DASH}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </IdCard>

              <IdCard
                title="异常"
                count={notices.length > 0 ? `${notices.length} 条` : "暂无"}
                testId="identity-role-alert-card"
                note="异常由成员台账现算：待激活、未归属部门、单人部门。"
              >
                {notices.length === 0 ? (
                  <p className="id-decl">成员台账里没有可报的异常。</p>
                ) : (
                  <div className="id-notices">
                    {notices.map((notice) => (
                      <div className="id-notice" data-tone={notice.tone} key={notice.title}>
                        <span className="id-notice__dot" aria-hidden="true" />
                        <span className="id-notice__body">
                          <b>{notice.title}</b>
                          <span>{notice.sub}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </IdCard>

              <IdCard
                title="最近提权"
                count={
                  <a className="id-link" href="#/audit">
                    去审计 →
                  </a>
                }
                testId="identity-role-escalation-card"
                note="提权记录没有读口：不列日期与操作人，也不补示例条目。"
              />

              <IdCard
                title="建议"
                count="最小权限"
                testId="identity-role-advice-card"
                note="建议由成员台账现算，不引入外部规则。"
              >
                {advice.length === 0 ? (
                  <p className="id-decl">暂无基于现有读口的建议。</p>
                ) : (
                  <div className="id-notices">
                    {advice.map((item) => (
                      <div className="id-notice" data-tone="info" key={item.title}>
                        <span className="id-notice__dot" aria-hidden="true" />
                        <span className="id-notice__body">
                          <b>{item.title}</b>
                          <span>{item.sub}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </IdCard>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default IdentityRolesPage;