/**
 * 人员与访问 · 组织与部门（`/identity?tab=departments`）。
 *
 * 真读口：成员台账 /api/employees + 数字员工矩阵 /api/matrix。部门名册
 * /api/departments 实测 404「该读口尚未接入」→ 层级、负责人、月度预算、本月已用
 * 四项因此整列不渲染（不画一整列 `—`），缺失只在卡底「数据可用性」声明一次。
 *
 * 有真值的部分做成真密度：部门由台账部门字段归组，员工数 / 在职 / 待激活按行现算，
 * 员工月费合计取矩阵的 monthlyCostUsd 相加，占月费总额的分母是全租户员工月费合计。
 * 副行只写算得出的段，预算那段直接省略（不写 0）。
 */
import { useMemo } from "react";
import { Link } from "react-router";

import { Pill, type PillTone } from "@/components/console/Pill";

import { DASH, DeclRow, IdCard, IdentityHead, KvList, PlannedButton } from "./bits";
import {
  deptStats,
  indexMatrix,
  ledgerTotals,
  lifecyclePill,
  money,
  thousands,
  type DeptStat,
} from "./model";
import { useIdentity } from "./useIdentity";
import "./identity.css";

/** 占比：分母为 0 或缺值时不编一个百分比。 */
function share(part: number | null, whole: number | null): string | null {
  if (part === null || whole === null || whole <= 0) return null;
  return `${((part / whole) * 100).toFixed(1)}%`;
}

/** 部门态由台账生命周期现算：全在职 / 含待激活 / 只有待激活 / 空部门。 */
function groupState(group: DeptStat): { tone: PillTone; label: string } {
  if (group.members.length === 0) return { tone: "mut", label: "空部门" };
  if (group.pending > 0 && group.active > 0) return { tone: "warn", label: `含待激活 ${group.pending}` };
  if (group.pending > 0) return { tone: "warn", label: `待激活 ${group.pending}` };
  return { tone: "ok", label: "全员在职" };
}

export function IdentityDepartmentsPage() {
  const { phase, data, message, denied, requestId, reload } = useIdentity();

  const members = useMemo(() => data?.members ?? [], [data]);
  const matrixIndex = useMemo(() => indexMatrix(data?.matrix ?? []), [data]);
  const groups = useMemo(() => deptStats(members, matrixIndex), [members, matrixIndex]);
  const totals = useMemo(() => ledgerTotals(data?.matrix ?? []), [data]);

  const named = groups.filter((group) => !group.unassigned);
  const active = members.filter((row) => row.lifecycle === "active").length;
  const pending = members.filter((row) => row.lifecycle === "draft").length;

  const hasCost = groups.some((group) => group.monthlyCost !== null);
  const hasTokens = groups.some((group) => group.dailyTokens !== null);
  const feeTotal = hasCost ? totals.monthlyCost : null;

  const cols = 3 + 2 + (hasCost ? 2 : 0);

  const sub =
    phase === "ready" ? (
      <>
        <b className="id-num">{named.length}</b> 个部门
        <span className="id-sep" aria-hidden="true">
          ·
        </span>
        <b className="id-num">{members.length}</b> 名成员
        {hasCost ? (
          <>
            <span className="id-sep" aria-hidden="true">
              ·
            </span>
            员工月费合计 <b className="id-num">{money(feeTotal)}</b>
          </>
        ) : null}
      </>
    ) : (
      "部门与成员读取中…"
    );

  /** 每块缺失只声明一次：树讲层级，表讲负责人与预算，构成卡讲消耗。 */
  const treeGaps = [
    { label: "部门层级与上下级", reason: "部门名册没有读口，树只按成员部门字段拼一层" },
    { label: "空部门", reason: "没有员工的名册行读不到" },
  ];
  const tableGaps = [
    { label: "部门负责人", reason: "部门名册没有读口，故整列不渲染" },
    { label: "月度预算", reason: "部门名册没有读口，故整列不渲染" },
    ...(hasCost ? [] : [{ label: "员工月费合计与占比", reason: "本轮未取到数字员工矩阵" }]),
  ];

  return (
    <section className="id-page" data-testid="identity-departments">
      <IdentityHead
        testId="identity-departments-sub"
        sub={sub}
        acts={
          <>
            <PlannedButton testId="identity-dept-hierarchy">调整层级</PlannedButton>
            <PlannedButton primary testId="identity-dept-create">
              新建部门
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
        <div className="id-block" role={denied ? "status" : "alert"} data-testid="identity-departments-state">
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
          <div className="console-split">
            <IdCard
              title="组织树"
              count={`${named.length} 个部门`}
              testId="identity-dept-tree-card"
              note="每一支都来自本轮台账的部门字段；没有写部门的行单独归为未归属，不给它编一个部门名。"
              availability={treeGaps}
            >
              <ul className="id-tree">
                <li className="id-tree__root">
                  <span className="id-tree__name">全部成员</span>
                  <span className="id-tree__n id-mono">{members.length}</span>
                </li>
                {groups.map((group) => (
                  <li key={group.name} className="id-tree__leaf">
                    <span className="id-tree__row">
                      <span className="id-tree__name">{group.name}</span>
                      <span className="id-tree__n id-mono">{group.members.length}</span>
                    </span>
                    <span className="id-tree__kids">
                      {group.members.map((member) => {
                        const pill = lifecyclePill(member.lifecycle);
                        return (
                          <span className="id-tree__kid" key={member.id}>
                            <Link className="id-rowlink id-tree__kid-name" to={`/employees/${encodeURIComponent(member.id)}`}>
                              {member.name}
                            </Link>
                            <span className="id-tree__kid-st">{pill.label}</span>
                          </span>
                        );
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </IdCard>

            <div className="id-stack">
              {hasCost ? (
                <IdCard
                  title="部门月费构成"
                  count={`合计 ${money(feeTotal) ?? "—"}`}
                  testId="identity-dept-cost-card"
                  note="每段是员工月费上限合计占全租户的比例；不是预算消耗，预算读口接通后才会有消耗口径。"
                  availability={[{ label: "本月已用", reason: "部门名册与用量聚合都没有读口" }]}
                >
                  <div className="id-bars">
                    {groups.map((group) => {
                      const ratio = share(group.monthlyCost, feeTotal);
                      return (
                        <div className="id-bar" key={group.name}>
                          <span className="id-bar__name">{group.name}</span>
                          <span className="id-bar__track" aria-hidden="true">
                            <i
                              style={{
                                width: ratio === null ? "0%" : ratio,
                              }}
                            />
                          </span>
                          <span className="id-bar__val">
                            {money(group.monthlyCost) ?? DASH}
                            {ratio ? ` · ${ratio}` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </IdCard>
              ) : null}

              <IdCard title="全租户合计" count="口径" testId="identity-dept-total-card">
                <KvList
                  rows={[
                    { k: "部门", v: <span className="id-hnum">{named.length}</span> },
                    { k: "成员", v: <span className="id-hnum">{members.length}</span> },
                    { k: "在职", v: <span className="id-hnum">{active}</span> },
                    { k: "待激活", v: <span className="id-hnum">{pending}</span> },
                    ...(hasCost
                      ? [{ k: "员工月费合计", v: <span className="id-hnum">{money(feeTotal) ?? DASH}</span> }]
                      : []),
                    ...(hasTokens
                      ? [
                          {
                            k: "日 token 上限合计",
                            v: <span className="id-hnum">{thousands(totals.dailyTokens) ?? DASH}</span>,
                          },
                        ]
                      : []),
                  ]}
                />
              </IdCard>
            </div>
          </div>

          <IdCard
            title="部门月费明细"
            count={`${groups.length} 行 · 按部门`}
            testId="identity-dept-table-card"
            flush
            note="员工数按本轮成员台账现算；员工月费合计 = 该部门成员 monthlyCostUsd 相加，占月费总额的分母是全租户员工月费合计。"
            availability={tableGaps}
          >
            <div className="id-tw">
              <table className="id-table id-table--dept" data-testid="identity-dept-table">
                <thead>
                  <tr>
                    <th scope="col">部门</th>
                    <th scope="col" className="id-right">
                      员工数
                    </th>
                    <th scope="col" className="id-right id-hidesm">
                      在职
                    </th>
                    <th scope="col" className="id-right id-hidesm">
                      待激活
                    </th>
                    {hasCost ? (
                      <th scope="col" className="id-right id-hidesm">
                        员工月费合计
                      </th>
                    ) : null}
                    {hasCost ? (
                      <th scope="col" className="id-right id-hidesm">
                        占月费总额
                      </th>
                    ) : null}
                    <th scope="col" className="id-col-st">
                      状态
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groups.length === 0 ? (
                    <DeclRow colSpan={cols}>台账里没有部门可数：这是真为空，不是没读到。</DeclRow>
                  ) : (
                    groups.map((group) => {
                      const state = groupState(group);
                      return (
                        <tr key={group.name}>
                          <td>{group.name}</td>
                          <td className="id-right id-mono">{group.members.length}</td>
                          <td className="id-right id-mono id-hidesm">{group.active}</td>
                          <td className="id-right id-mono id-hidesm">{group.pending}</td>
                          {hasCost ? (
                            <td className="id-right id-mono id-hidesm">{money(group.monthlyCost) ?? DASH}</td>
                          ) : null}
                          {hasCost ? (
                            <td className="id-right id-mono id-hidesm">
                              {share(group.monthlyCost, feeTotal) ?? DASH}
                            </td>
                          ) : null}
                          <td className="id-col-st">
                            <Pill tone={state.tone}>{state.label}</Pill>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </IdCard>
        </>
      )}
    </section>
  );
}

export default IdentityDepartmentsPage;