/**
 * 人员与访问 · 角色与权限（`/identity?tab=roles`）。
 *
 * 角色定义、权限矩阵、条件权限、提权记录都没有读口：矩阵表保留骨架列名
 * （角色 | 查看 | 运行任务 | 写入配置 | 审批 | 安装 | 删除），表体一行缺读口，
 * 不画示例勾叉。成员侧的卡用真台账行填成员与状态，角色/范围/最近操作每格「—」。
 * 页头副行不含任何数字：算不出的段一律省略，不写 0。
 */
import { useMemo } from "react";

import { ConsoleCard } from "@/components/console/ConsoleCard";
import { Pill } from "@/components/console/Pill";

import { CardFoot, DASH, GapNote, GapRow, IdentityHead, PlannedButton } from "./bits";
import { lifecyclePill, shortCode } from "./model";
import { useIdentity } from "./useIdentity";
import "./identity.css";

const MATRIX_COLS = ["角色", "查看", "运行任务", "写入配置", "审批", "安装", "删除"] as const;

export function IdentityRolesPage() {
  const { phase, data, message, denied, requestId, reload } = useIdentity();
  const members = useMemo(() => data?.members ?? [], [data]);

  return (
    <section className="id-page" data-testid="identity-roles">
      <IdentityHead
        testId="identity-roles-sub"
        sub={
          phase === "ready"
            ? "角色定义与权限矩阵没有读口：本页不列角色、不画示例矩阵，也不写条件权限的处数。"
            : "角色与权限读取中…"
        }
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
          <ConsoleCard
            label="角色 × 动作"
            action={<span>✓ 允许 · ◐ 条件 · — 禁止</span>}
            flush
            data-testid="identity-matrix-card"
          >
            <div className="id-tw">
              <table className="id-table id-table--matrix" data-testid="identity-matrix-table">
                <thead>
                  <tr>
                    {MATRIX_COLS.map((col, index) => (
                      <th key={col} scope="col" className={index === 0 ? undefined : "id-center"}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <GapRow colSpan={MATRIX_COLS.length}>
                    缺读口：角色定义与权限矩阵。这一屏不出现一行角色，也不补示例勾叉。
                  </GapRow>
                </tbody>
              </table>
            </div>
            <CardFoot note="缺读口：角色定义、权限矩阵、条件权限。" right="条件权限处数不可算" />
          </ConsoleCard>

          <div className="console-split">
            <ConsoleCard
              label="按角色"
              action={<span>成员 × 角色</span>}
              flush
              data-testid="identity-role-members-card"
            >
              <div className="id-tw">
                <table className="id-table id-table--role-member">
                  <thead>
                    <tr>
                      <th scope="col">成员</th>
                      <th scope="col" className="id-hidexs">
                        操作
                      </th>
                      <th scope="col" className="id-colsm">
                        角色
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.length === 0 ? (
                      <GapRow colSpan={3}>台账里没有成员：这一屏不列角色，也没有可挂靠的人。</GapRow>
                    ) : (
                      members.map((row) => (
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
                          <td className="id-hidexs id-cell-sm" title="缺读口：可执行操作">
                            {DASH}
                          </td>
                          <td className="id-colsm id-cell-sm" title="缺读口：角色">
                            {DASH}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <CardFoot note="缺读口：角色、可执行操作。人员来自成员台账。" />
            </ConsoleCard>

            <ConsoleCard label="角色规模" action={<span>人数与范围</span>} flush data-testid="identity-role-size-card">
              <div className="id-tw">
                <table className="id-table id-table--role-size">
                  <thead>
                    <tr>
                      <th scope="col">成员</th>
                      <th scope="col" className="id-right">
                        人数
                      </th>
                      <th scope="col" className="id-hidexs">
                        范围
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <GapRow colSpan={3}>缺读口：角色清单、每个角色的人数与作用范围。这里没有角色行可数。</GapRow>
                  </tbody>
                </table>
              </div>
              <CardFoot note="缺读口：角色清单、成员数、作用范围。" />
            </ConsoleCard>
          </div>

          <ConsoleCard
            label="成员权限视角"
            action={<span>成员 · 角色 · 范围 · 状态</span>}
            flush
            data-testid="identity-role-detail-card"
          >
            <div className="id-tw">
              <table className="id-table id-table--role-detail" data-testid="identity-role-detail-table">
                <thead>
                  <tr>
                    <th scope="col">成员</th>
                    <th scope="col" className="id-hidesm">
                      角色
                    </th>
                    <th scope="col">部门范围</th>
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
                    <GapRow colSpan={5}>台账里没有成员：这一屏没有可展示的权限视角。</GapRow>
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
                          <td className="id-hidesm id-cell-sm" title="缺读口：角色">
                            {DASH}
                          </td>
                          <td className="id-cell-sm" title={row.department ? undefined : "台账这一行没有填部门"}>
                            {row.department ?? DASH}
                          </td>
                          <td className="id-right id-mono id-hidesm" title="缺读口：最近操作">
                            {DASH}
                          </td>
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
            <CardFoot
              note="缺读口：角色、最近操作。部门范围取成员台账的部门字段，未填即「—」。"
              right={phase === "ready" ? `共 ${members.length} 行` : undefined}
            />
          </ConsoleCard>

          <ConsoleCard label="权限来源" action={<span>三层叠加</span>}>
            <p className="id-formula">（角色权限 并 部门范围） 交 门禁状态</p>
            <GapNote>
              先并后交：角色与部门给的范围合并，再由门禁收紧；门禁双人模式下单人仍不可执行。权限变更应在访问控制里做，
              不在员工配置里做——员工配置只决定「这个数字员工用哪套角色」。
            </GapNote>
          </ConsoleCard>
        </>
      )}
    </section>
  );
}

export default IdentityRolesPage;