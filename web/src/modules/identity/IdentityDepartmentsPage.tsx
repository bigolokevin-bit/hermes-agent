/**
 * 人员与访问 · 组织与部门（`/identity?tab=departments`）。
 *
 * 部门名册读口实测未接线：页头副行因此只写能从成员台账算出来的两段
 * （几个部门、多少人已归属/未归属），预算合计那段直接省略——不写 0。
 * 表列逐字照骨架：部门 | 负责人 | 员工数 | 月度预算 | 员工月费合计 |
 * 占月费总额 | 状态；没有读口的列每格「—」，卡底一行 11px 缺读口。
 */
import { useMemo } from "react";

import { ConsoleCard } from "@/components/console/ConsoleCard";
import { Pill } from "@/components/console/Pill";

import { CardFoot, DASH, GapNote, GapRow, IdentityHead, PlannedButton } from "./bits";
import { departmentBuckets, type DeptBucket } from "./model";
import { useIdentity } from "./useIdentity";
import "./identity.css";

interface DeptLine {
  name: string;
  owner: string | null;
  members: number | null;
  budget: number | null;
  fee: number | null;
  /** 真名册行 = 读口接通；派生行 = 只有部门名与人数可信。 */
  registered: boolean;
}

function money(value: number | null): string {
  return value === null ? DASH : `$${value.toFixed(2)}`;
}

function linesOf(
  registered: { name: string; owner: string | null; members: number | null; budget: number | null; fee: number | null }[],
  buckets: DeptBucket[],
): DeptLine[] {
  if (registered.length > 0) {
    return registered.map((row) => ({ ...row, registered: true }));
  }
  return buckets.map((bucket) => ({
    name: bucket.name,
    owner: null,
    members: bucket.count,
    budget: null,
    fee: null,
    registered: false,
  }));
}

export function IdentityDepartmentsPage() {
  const { phase, data, message, denied, requestId, reload } = useIdentity();

  const members = useMemo(() => data?.members ?? [], [data]);
  const buckets = useMemo(() => departmentBuckets(members), [members]);
  const named = buckets.filter((bucket) => !bucket.unassigned);
  const assigned = named.reduce((sum, bucket) => sum + bucket.count, 0);
  const unassigned = members.length - assigned;

  const lines = useMemo(
    () =>
      linesOf(
        (data?.departments ?? []).map((row) => ({
          name: row.name,
          owner: row.owner,
          members: row.members,
          budget: row.monthlyBudget,
          fee: row.monthlyFee,
        })),
        buckets,
      ),
    [data, buckets],
  );

  const wired = data?.departmentsWired === true && data.departments.length > 0;
  const totalBudget = lines.every((line) => line.budget !== null)
    ? lines.reduce((sum, line) => sum + (line.budget ?? 0), 0)
    : null;

  const deptCount = wired ? lines.length : named.length;

  const sub =
    phase === "ready" ? (
      <>
        <b className="id-num">{deptCount}</b> 个部门
        <span className="id-sep" aria-hidden="true">
          ·
        </span>
        <b className="id-num">{assigned}</b> 名成员有部门
        {unassigned > 0 ? (
          <>
            <span className="id-sep" aria-hidden="true">
              ·
            </span>
            <b className="id-num">{unassigned}</b> 名未归属
          </>
        ) : null}
        {totalBudget !== null ? (
          <>
            <span className="id-sep" aria-hidden="true">
              ·
            </span>
            月度预算合计 <b className="id-num">{money(totalBudget)}</b>
          </>
        ) : null}
      </>
    ) : (
      "部门与成员读取中…"
    );

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
            <ConsoleCard
              label="组织树"
              action={<span>按成员台账的部门字段拼出</span>}
              data-testid="identity-dept-tree-card"
            >
              <ul className="id-tree">
                <li className="id-tree__root">
                  <span className="id-tree__name">全部成员</span>
                  <span className="id-tree__n id-mono">{members.length}</span>
                </li>
                {buckets.map((bucket) => (
                  <li key={bucket.name} className="id-tree__leaf">
                    <span className="id-tree__name">{bucket.name}</span>
                    <span className="id-tree__n id-mono">{bucket.count}</span>
                  </li>
                ))}
              </ul>
              <GapNote>
                名册未接入：这棵树只有「谁在哪个部门」，层级、上下级与负责人读不到；空部门也不会出现在这里。
              </GapNote>
            </ConsoleCard>

            <ConsoleCard label="部门预算" action={<span>本月已用</span>} data-testid="identity-dept-budget-card">
              <GapNote>缺读口：部门月度预算与本月已用金额。这一块不画比例条，也不写零金额。</GapNote>
              <GapNote>预算读口接通后，每一行给「已用 / 预算」与占比条；没有预算的部门才显示「未设预算」。</GapNote>
            </ConsoleCard>
          </div>

          <ConsoleCard
            label="部门预算明细"
            action={<span>本月 · 按部门</span>}
            flush
            data-testid="identity-dept-table-card"
          >
            <div className="id-tw">
              <table className="id-table id-table--dept" data-testid="identity-dept-table">
                <thead>
                  <tr>
                    <th scope="col">部门</th>
                    <th scope="col" className="id-hidesm">
                      负责人
                    </th>
                    <th scope="col" className="id-right">
                      员工数
                    </th>
                    <th scope="col" className="id-right id-hidesm">
                      月度预算
                    </th>
                    <th scope="col" className="id-right id-hidesm">
                      员工月费合计
                    </th>
                    <th scope="col" className="id-right id-hidesm">
                      占月费总额
                    </th>
                    <th scope="col" className="id-col-st">
                      状态
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <GapRow colSpan={7}>台账里没有部门可数：这是真为空，不是没读到。</GapRow>
                  ) : (
                    lines.map((line) => (
                      <tr key={line.name}>
                        <td>{line.name}</td>
                        <td className="id-hidesm id-cell-sm" title="缺读口：部门负责人">
                          {line.owner ?? DASH}
                        </td>
                        <td className="id-right id-mono">{line.members ?? DASH}</td>
                        <td className="id-right id-mono id-hidesm" title="缺读口：月度预算">
                          {money(line.budget)}
                        </td>
                        <td className="id-right id-mono id-hidesm" title="缺读口：员工月费合计">
                          {money(line.fee)}
                        </td>
                        <td className="id-right id-mono id-hidesm" title="缺读口：月费占比">
                          {DASH}
                        </td>
                        <td className="id-col-st">
                          <Pill tone="mut">{line.registered ? "正常" : "名册未接入"}</Pill>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <CardFoot
              note="缺读口：部门负责人、月度预算、员工月费合计、占月费总额。员工数按成员台账现算，口径与上表逐行一致。"
              right={wired ? "名册读口已接通" : "名册读口未接通"}
            />
          </ConsoleCard>
        </>
      )}
    </section>
  );
}

export default IdentityDepartmentsPage;