/**
 * 人员与访问 · 人员目录（`/identity`）。
 *
 * 真读口（本轮实测）：成员台账 /api/employees、成员计数 /api/employee-stats、
 * 数字员工矩阵 /api/matrix、本租户身份 /api/auth/me。按骨架 density 排：
 * 绑定条 + 归属筛选 + 台账表 + 口径/待处理 + 状态/额度/最近变动。
 *
 * 纪律：整列没有读口就不渲染这一列，缺失在卡底「数据可用性」声明一次（走基元），
 * 正文只留单值的 `—`。角色、可管理员工、最近登录三列因此不出现在表头；管理员名单
 * 与最近管理员操作两张骨架卡没有任何读口，整块不渲染，缺口同样只声明一次。
 * 所有数字来自本轮读到的行，不补 0、不搬骨架的示例数字。
 */
import { useId, useMemo, useState } from "react";
import { Link } from "react-router";

import { Pill } from "@/components/console/Pill";

import {
  BindBar,
  DASH,
  DeclRow,
  GapNote,
  IdCard,
  IdentityHead,
  KvList,
  PlannedButton,
} from "./bits";
import {
  bindSummary,
  departmentBuckets,
  filterMembers,
  indexMatrix,
  ledgerTotals,
  lifecyclePill,
  memberSummary,
  money,
  recentChanges,
  shortCode,
  stampShort,
  statLines,
  thousands,
  UNASSIGNED,
  type MemberRow,
} from "./model";
import { useIdentity } from "./useIdentity";
import "./identity.css";

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "active", label: "在职" },
  { value: "draft", label: "待激活" },
  { value: "paused", label: "已暂停" },
  { value: "suspended", label: "已停用" },
] as const;

type BindView = "all" | "bound" | "unbound";

const BIND_VIEWS: { id: BindView; label: string }[] = [
  { id: "all", label: "全体成员" },
  { id: "bound", label: "已绑定账号" },
  { id: "unbound", label: "未绑定账号" },
];

function MemberCell({ row }: { row: MemberRow }) {
  const initial = Array.from(row.name)[0] ?? "·";
  return (
    <span className="id-who" title={row.id}>
      <span className="id-ava" aria-hidden="true">
        {initial}
      </span>
      <span className="id-who__text">
        <Link className="id-who__name id-rowlink" to={`/employees/${encodeURIComponent(row.id)}`}>
          {row.name}
        </Link>
        <span className="id-who__sub">{shortCode(row.id)}</span>
        {/* 窄屏裁掉部门列时，这一行顶上去，行高仍是 40px。 */}
        <span className="id-who__dept">
          {row.department ?? UNASSIGNED}
          <span className="id-dept__sep" aria-hidden="true">
            {" · "}
          </span>
          {row.title ?? "未填岗位"}
        </span>
      </span>
    </span>
  );
}

/** 部门 / 岗位：两截都是台账字段，空值写人话「未归属 / 未填岗位」，不占破折号。 */
function DeptCell({ row }: { row: MemberRow }) {
  return (
    <span className="id-dept" title={row.department ? row.department : "台账这一行没有填部门"}>
      {row.department ?? UNASSIGNED}
      <span className="id-dept__sep" aria-hidden="true">
        {" · "}
      </span>
      {row.title ?? "未填岗位"}
    </span>
  );
}

export function IdentityPeoplePage() {
  const { phase, data, message, denied, requestId, reload } = useIdentity();
  const [keyword, setKeyword] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<BindView>("all");
  const searchId = useId();

  const members = useMemo(() => data?.members ?? [], [data]);
  const summary = useMemo(() => memberSummary(members), [members]);
  const buckets = useMemo(() => departmentBuckets(members), [members]);
  const binds = useMemo(() => bindSummary(members), [members]);
  const matrixIndex = useMemo(() => indexMatrix(data?.matrix ?? []), [data]);
  const totals = useMemo(() => ledgerTotals(data?.matrix ?? []), [data]);
  const stats = useMemo(() => statLines(data?.stats ?? null, members), [data, members]);
  const changes = useMemo(() => recentChanges(members, 3), [members]);

  const visible = useMemo(() => {
    const byKeyword = filterMembers(members, keyword);
    const scoped =
      view === "bound"
        ? byKeyword.filter((row) => row.owner)
        : view === "unbound"
          ? byKeyword.filter((row) => !row.owner)
          : byKeyword;
    const byDept = dept ? scoped.filter((row) => (row.department ?? UNASSIGNED) === dept) : scoped;
    return status ? byDept.filter((row) => (row.lifecycle ?? "未标注") === status) : byDept;
  }, [members, keyword, dept, status, view]);

  const matrixReady = data?.matrixReady === true && (data?.matrix.length ?? 0) > 0;
  const anyCost = matrixReady && (data?.matrix ?? []).some((row) => row.monthlyCostUsd !== null);
  const anyTokens = matrixReady && (data?.matrix ?? []).some((row) => row.dailyTokens !== null);
  const anyUpdated = members.some((row) => row.updatedAt !== null);
  const cols = 3 + (anyCost ? 1 : 0) + (anyTokens ? 1 : 0) + (anyUpdated ? 1 : 0);

  const accountName = data?.identity?.displayName ?? null;
  const orgId = data?.identity?.orgId ?? null;

  const pending = useMemo(() => {
    const items: { key: string; text: string; action: string; tone: "warn" | "info" }[] = [];
    const draft = members.filter((row) => row.lifecycle === "draft");
    if (draft.length > 0) {
      items.push({
        key: "draft",
        text: `${draft.map((row) => row.name).join("、")} 尚未激活`,
        action: "重发邀请",
        tone: "warn",
      });
    }
    const unassigned = members.filter((row) => !row.department);
    if (unassigned.length > 0) {
      items.push({
        key: "unassigned",
        text: `${unassigned.map((row) => row.name).join("、")} 未填部门`,
        action: "补部门",
        tone: "info",
      });
    }
    if (binds.unbound > 0) {
      items.push({
        key: "unbound",
        text: `${binds.unbound} 名成员未绑定后台账号`,
        action: "提醒绑定",
        tone: "info",
      });
    }
    return items;
  }, [members, binds.unbound]);

  const sub =
    phase === "ready" ? (
      <>
        <b className="id-num">{summary.total}</b> 名成员
        <span className="id-sep" aria-hidden="true">
          ·
        </span>
        <b className="id-num">{summary.active}</b> 在职
        <span className="id-sep" aria-hidden="true">
          ·
        </span>
        <b className="id-num">{summary.pending}</b> 待激活
        {summary.other > 0 ? (
          <>
            <span className="id-sep" aria-hidden="true">
              ·
            </span>
            <b className="id-num">{summary.other}</b> 其它状态
          </>
        ) : null}
      </>
    ) : (
      "成员台账读取中…"
    );

  /** 同一块缺失只在这里出现一次：没有读口的列与被整块摘掉的骨架卡。 */
  const availability = [
    { label: "角色", reason: "角色定义没有读口" },
    { label: "可管理员工", reason: "成员管理关系没有读口" },
    { label: "最近登录", reason: "登录时刻没有读口" },
    { label: "管理员名单", reason: "角色与级别没有读口，故整块不渲染" },
    { label: "最近管理员操作", reason: "审计日志没有读口，故整块不渲染" },
    { label: "真人成员名录", reason: "统一用户名录没有读口，本表来自数字员工台账" },
    ...(matrixReady ? [] : [{ label: "月费上限与额度", reason: "本轮未取到数字员工矩阵" }]),
    ...(anyUpdated ? [] : [{ label: "台账更新时刻", reason: "本轮未取到更新字段" }]),
  ];

  return (
    <section className="id-page" data-testid="identity-people">
      <IdentityHead
        testId="identity-people-sub"
        sub={sub}
        title={orgId ? `租户 ${orgId}` : undefined}
        acts={
          <>
            <PlannedButton testId="identity-people-import">导入成员</PlannedButton>
            <PlannedButton primary testId="identity-people-invite">
              邀请成员
            </PlannedButton>
          </>
        }
      />

      {phase === "loading" ? (
        <div className="id-skeleton" aria-busy="true" aria-label="读取中">
          <span />
          <span />
          <span />
        </div>
      ) : phase === "error" ? (
        <div className="id-block" role={denied ? "status" : "alert"} data-testid="identity-people-state">
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
          <BindBar testId="identity-people-bind">
            <b>身份绑定</b>
            <span className="id-mono">{binds.total}</span> 行台账
            <span className="id-sep" aria-hidden="true">
              ·
            </span>
            <span className="id-bind-tag ok">已绑定 {binds.bound}</span>
            <span className="id-bind-tag warn">未绑定 {binds.unbound}</span>
            {accountName ? (
              <>
                <span className="id-sep" aria-hidden="true">
                  ·
                </span>
                <span className="id-bind-tag mut">指向账号 {accountName}</span>
              </>
            ) : null}
            <span className="id-grow" />
            <PlannedButton testId="identity-people-bind-open">查看绑定</PlannedButton>
          </BindBar>

          <div className="id-chips" role="group" aria-label="按绑定状态筛选">
            {BIND_VIEWS.map((item) => {
              const n =
                item.id === "bound" ? binds.bound : item.id === "unbound" ? binds.unbound : binds.total;
              return (
                <button
                  type="button"
                  key={item.id}
                  className="console-chip-btn"
                  aria-pressed={view === item.id}
                  onClick={() => setView(item.id)}
                >
                  {item.label} {n}
                </button>
              );
            })}
            <span className="id-chips__hint">绑定状态指台账里的归属后台账号，与角色无关。</span>
          </div>

          <IdCard
            title="成员台账"
            count={`${summary.total} 条 · 显示 ${visible.length}`}
            testId="identity-people-card"
            flush
            note="行与金额都取自本轮读到的成员台账和数字员工矩阵；金额按美元两位小数原样呈现，不做换算。"
            availability={availability}
          >
            <div className="id-filterbar">
              <input
                id={searchId}
                className="id-input"
                type="search"
                placeholder="搜索姓名、岗位、部门"
                aria-label="搜索成员"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
              <select
                className="id-select"
                aria-label="部门"
                value={dept}
                onChange={(event) => setDept(event.target.value)}
              >
                <option value="">全部部门</option>
                {buckets.map((bucket) => (
                  <option key={bucket.name} value={bucket.name}>
                    {bucket.name}
                  </option>
                ))}
              </select>
              <select
                className="id-select"
                aria-label="状态"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="id-grow" />
              <span className="id-meta" data-testid="identity-people-count">
                {summary.total} 条 · 显示 {visible.length}
              </span>
            </div>

            <div className="id-tw">
              <table className="id-table id-table--people" data-testid="identity-people-table">
                <thead>
                  <tr>
                    <th scope="col">成员</th>
                    <th scope="col" className="id-col-dept">
                      部门 / 岗位
                    </th>
                    {anyCost ? (
                      <th scope="col" className="id-right id-hidesm">
                        月费上限
                      </th>
                    ) : null}
                    {anyTokens ? (
                      <th scope="col" className="id-right id-hidesm">
                        日 token 上限
                      </th>
                    ) : null}
                    <th scope="col" className="id-col-st">
                      状态
                    </th>
                    {anyUpdated ? (
                      <th scope="col" className="id-right id-hidesm">
                        台账更新
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <DeclRow colSpan={cols}>
                      {members.length === 0
                        ? "台账里没有成员行：这是真为空，本轮一条也没读到。"
                        : "上面三处条件放宽后就会有行：当前筛选没有命中成员。"}
                    </DeclRow>
                  ) : (
                    visible.map((row) => {
                      const pill = lifecyclePill(row.lifecycle);
                      const line = matrixIndex.get(row.id);
                      return (
                        <tr key={row.id} data-testid={`identity-people-row-${row.id}`}>
                          <td>
                            <MemberCell row={row} />
                          </td>
                          <td className="id-cell-sm id-col-dept">
                            <DeptCell row={row} />
                          </td>
                          {anyCost ? (
                            <td
                              className="id-right id-mono id-hidesm"
                              title={line ? "数字员工矩阵同 id 行" : "矩阵里没有这一行"}
                            >
                              {money(line?.monthlyCostUsd) ?? DASH}
                            </td>
                          ) : null}
                          {anyTokens ? (
                            <td className="id-right id-mono id-hidesm">
                              {thousands(line?.dailyTokens) ?? DASH}
                            </td>
                          ) : null}
                          <td className="id-col-st">
                            <Pill tone={pill.tone}>{pill.label}</Pill>
                          </td>
                          {anyUpdated ? (
                            <td className="id-right id-mono id-hidesm">
                              {stampShort(row.updatedAt) ?? DASH}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </IdCard>

          <div className="id-grid2">
            <IdCard title="成员与数字员工的分工" count="口径" testId="identity-people-scope-card">
              <GapNote>
                人员目录里的人有部门、角色与登录方式，是 HR 主体；数字员工有模型、技能与预算，是执行主体。
                一个人可以管理多名数字员工，但两者不共用同一份列表：这是过去最容易混的一处。
              </GapNote>
              <GapNote>
                本轮台账读到的是数字员工主体，因此这一屏只写台账确实带着的字段：姓名、岗位、部门、
                生命周期态、归属账号与额度。角色与登录时刻等页面动作接通后才会出现。
              </GapNote>
            </IdCard>

            <IdCard
              title="待处理"
              count={pending.length > 0 ? `${pending.length} 项` : "本轮无"}
              testId="identity-people-todo-card"
              note="三项都由本轮台账现算：待激活、未填部门、未绑定后台账号。"
            >
              {pending.length === 0 ? (
                <GapNote>本轮台账里没有待处理项。</GapNote>
              ) : (
                <div className="id-todo">
                  {pending.map((item) => (
                    <div className="id-todo__row" key={item.key}>
                      <span className={`id-todo__dot id-todo__dot--${item.tone}`} aria-hidden="true" />
                      <span className="id-todo__text">{item.text}</span>
                      <PlannedButton testId={`identity-people-todo-${item.key}`}>{item.action}</PlannedButton>
                    </div>
                  ))}
                </div>
              )}
            </IdCard>
          </div>

          <div className="id-grid3">
            <IdCard
              title="成员状态"
              count={`${stats.length} 态`}
              testId="identity-people-stats-card"
              note="计数读口给的是本轮全台账的状态分布；合计与台账行数来自同一轮读取。"
            >
              <KvList
                rows={[
                  {
                    k: "成员合计",
                    v: <span className="id-hnum">{statsTotal(data?.stats?.total, summary.total)}</span>,
                  },
                  ...stats.map((line) => ({
                    k: line.label,
                    v: <span className="id-hnum id-hnum--sub">{line.value}</span>,
                  })),
                ]}
              />
            </IdCard>

            <IdCard
              title="额度与预算"
              count={matrixReady ? `${totals.costLines} 行有金额` : "本轮未取到"}
              testId="identity-people-budget-card"
              note="金额与额度取数字员工矩阵的预算字段，按本轮读到的行相加；读不到的行不进合计。"
            >
              {matrixReady ? (
                <KvList
                  rows={[
                    {
                      k: "月费上限合计",
                      v: <span className="id-hnum">{money(totals.monthlyCost) ?? "本轮无金额"}</span>,
                    },
                    { k: "日 token 上限合计", v: thousands(totals.dailyTokens) ?? "本轮无额度" },
                    { k: "单次上限最高", v: money(totals.perRunMax) ?? "本轮无单次值" },
                    { k: "覆盖成员", v: `${data?.matrix.length ?? 0} 行矩阵` },
                  ]}
                />
              ) : (
                <GapNote>本轮没有读到数字员工矩阵，这一卡不写金额，也不写零占位。</GapNote>
              )}
            </IdCard>

            <IdCard
              title="台账最近变动"
              count={`${changes.length} 行`}
              testId="identity-people-changes-card"
              flush
              note="变动时刻取成员台账的更新字段并按北京时间排序，不是管理员操作日志。"
            >
              <div className="id-tw">
                <table className="id-table id-table--changes">
                  <thead>
                    <tr>
                      <th scope="col" className="id-right">
                        更新
                      </th>
                      <th scope="col">成员</th>
                      <th scope="col" className="id-col-st">
                        状态
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {changes.length === 0 ? (
                      <DeclRow colSpan={3}>本轮台账里没有带更新时刻的行。</DeclRow>
                    ) : (
                      changes.map((row) => {
                        const pill = lifecyclePill(row.lifecycle);
                        return (
                          <tr key={`change-${row.id}`}>
                            <td className="id-right id-mono">{stampShort(row.updatedAt) ?? DASH}</td>
                            <td className="id-cell-sm">
                              <Link className="id-rowlink" to={`/employees/${encodeURIComponent(row.id)}`}>
                                {row.name}
                              </Link>
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
            </IdCard>
          </div>
        </>
      )}
    </section>
  );
}

/** 合计优先取计数读口，读不到就用台账行数（两者同源，不引入第三种口径）。 */
function statsTotal(fromStats: number | null | undefined, fromLedger: number): number {
  return typeof fromStats === "number" ? fromStats : fromLedger;
}

export default IdentityPeoplePage;