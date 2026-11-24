/**
 * 人员与访问 · 人员目录（`/identity?tab=people`）。
 *
 * 真读口：成员台账（`/api/employees`）+ 本租户身份。表列逐字照骨架：
 * 成员 | 部门 / 岗位 | 角色 | 可管理员工 | 最近登录 | 状态。
 * 角色、可管理员工、最近登录没有读口 → 每格「—」，卡底一行 11px 缺读口。
 * 管理员名单与管理员操作两张卡保留骨架列名，表体写缺读口整行：本页不点名
 * 任何管理员、不补一行操作日志。副行数字全部来自本次读到的行，不写 0 占位。
 */
import { useId, useMemo, useState } from "react";

import { ConsoleCard } from "@/components/console/ConsoleCard";
import { Pill } from "@/components/console/Pill";

import {
  DASH,
  GapNote,
  GapRow,
  IdentityHead,
  PlannedButton,
  CardFoot,
} from "./bits";
import {
  departmentBuckets,
  filterMembers,
  lifecyclePill,
  memberSummary,
  shortCode,
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

function MemberCell({ row }: { row: MemberRow }) {
  const initial = Array.from(row.name)[0] ?? "·";
  return (
    <span className="id-who" title={row.id}>
      <span className="id-ava" aria-hidden="true">
        {initial}
      </span>
      <span className="id-who__text">
        <span className="id-who__name">{row.name}</span>
        <span className="id-who__sub">{shortCode(row.id)}</span>
      </span>
    </span>
  );
}

/** 部门 / 岗位：两截都可缺，缺哪截就是哪截的破折号。 */
function deptTitle(row: MemberRow) {
  const dept = row.department ?? DASH;
  const title = row.title ?? DASH;
  return (
    <span className="id-dept" title={row.department ? undefined : "台账这一行没有填部门"}>
      {dept}
      <span className="id-dept__sep" aria-hidden="true">
        {" · "}
      </span>
      {title}
    </span>
  );
}

export function IdentityPeoplePage() {
  const { phase, data, message, denied, requestId, reload } = useIdentity();
  const [keyword, setKeyword] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const searchId = useId();

  const members = useMemo(() => data?.members ?? [], [data]);
  const summary = useMemo(() => memberSummary(members), [members]);
  const buckets = useMemo(() => departmentBuckets(members), [members]);

  const visible = useMemo(() => {
    const byKeyword = filterMembers(members, keyword);
    const byDept = dept ? byKeyword.filter((row) => (row.department ?? "未归属") === dept) : byKeyword;
    return status ? byDept.filter((row) => (row.lifecycle ?? "未标注") === status) : byDept;
  }, [members, keyword, dept, status]);

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

  return (
    <section className="id-page" data-testid="identity-people">
      <IdentityHead
        testId="identity-people-sub"
        sub={sub}
        acts={
          <>
            <PlannedButton testId="identity-people-import">导入成员</PlannedButton>
            <PlannedButton primary testId="identity-people-invite">
              邀请成员
            </PlannedButton>
          </>
        }
      />

      <ConsoleCard
        label="人员目录"
        action={<span>来源：数字员工台账</span>}
        flush
        data-testid="identity-people-card"
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
            disabled={phase !== "ready"}
          />
          <select
            className="id-select"
            aria-label="部门"
            value={dept}
            onChange={(event) => setDept(event.target.value)}
            disabled={phase !== "ready"}
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
            disabled={phase !== "ready"}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="id-grow" />
          {phase === "ready" ? (
            <span className="id-meta" data-testid="identity-people-count">
              {summary.total} 条 · 显示 {visible.length}
            </span>
          ) : null}
        </div>

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
          <div className="id-tw">
            <table className="id-table id-table--people" data-testid="identity-people-table">
              <thead>
                <tr>
                  <th scope="col" className="id-th-who">
                    成员
                  </th>
                  <th scope="col">部门 / 岗位</th>
                  <th scope="col" className="id-hidesm">
                    角色
                  </th>
                  <th scope="col" className="id-hidesm">
                    可管理员工
                  </th>
                  <th scope="col" className="id-right id-hidesm">
                    最近登录
                  </th>
                  <th scope="col" className="id-col-st">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <GapRow colSpan={6}>
                    {members.length === 0
                      ? "台账里没有成员：这是真为空，不是没读到。"
                      : "当前筛选没有命中成员，上面三处条件放宽即可。"}
                  </GapRow>
                ) : (
                  visible.map((row) => {
                    const pill = lifecyclePill(row.lifecycle);
                    return (
                      <tr key={row.id}>
                        <td>
                          <MemberCell row={row} />
                        </td>
                        <td className="id-cell-sm">{deptTitle(row)}</td>
                        <td className="id-hidesm id-cell-sm" title="缺读口：角色">
                          {DASH}
                        </td>
                        <td className="id-hidesm id-cell-sm" title="缺读口：成员管理关系">
                          {DASH}
                        </td>
                        <td className="id-right id-hidesm id-mono" title="缺读口：最近登录时间">
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
        )}

        <CardFoot
          note="缺读口：角色、可管理员工、最近登录。真人成员名录未接入，本表来自数字员工台账，不冒充真人名单。"
          right={phase === "ready" ? `共 ${summary.total} 行` : undefined}
        />
      </ConsoleCard>

      <ConsoleCard
        label="管理员名单"
        action={<span>高危：可改策略与密钥</span>}
        flush
        data-testid="identity-admins-card"
      >
        <div className="id-tw">
          <table className="id-table id-table--admins">
            <thead>
              <tr>
                <th scope="col">成员</th>
                <th scope="col">级别</th>
                <th scope="col">MFA</th>
                <th scope="col" className="id-hidesm">
                  最近操作
                </th>
                <th scope="col" className="id-right id-hidesm">
                  近 30 天高危操作
                </th>
              </tr>
            </thead>
            <tbody>
              <GapRow colSpan={5}>
                缺读口：角色与管理级别、MFA 绑定状态、最近操作、近 30 天高危操作计数。没有角色读口，
                本页不点名任何一位管理员。
              </GapRow>
            </tbody>
          </table>
        </div>
        <CardFoot note="缺读口：管理员级别、MFA、最近操作、高危操作计数。" right="无匿名管理员" />
      </ConsoleCard>

      <ConsoleCard
        label="最近管理员操作"
        action={<span>近 7 天 · 全部留痕</span>}
        flush
        data-testid="identity-audit-card"
      >
        <div className="id-tw">
          <table className="id-table id-table--audit">
            <thead>
              <tr>
                <th scope="col">时间</th>
                <th scope="col">操作人</th>
                <th scope="col">动作</th>
                <th scope="col" className="id-hidesm">
                  对象
                </th>
                <th scope="col">结果</th>
              </tr>
            </thead>
            <tbody>
              <GapRow colSpan={5}>
                缺读口：管理员操作日志。这一屏没有一行操作记录，也不补样例记录。
              </GapRow>
            </tbody>
          </table>
        </div>
        <CardFoot note="缺读口：管理员操作日志。" right="近 7 天" />
      </ConsoleCard>

      <ConsoleCard label="口径" action={<span>成员与数字员工的分工</span>}>
        <GapNote>
          本页成员是数字员工台账里的执行主体（有模型、技能、预算）；真人成员有部门、角色与登录方式，是 HR
          主体。两者不共用一份名单——这是过去最容易混的一处，所以这一屏只显示台账里确实写着的字段。
        </GapNote>
        <GapNote>部门名册与角色读口接通后，本页的「角色」「可管理员工」「最近登录」才由「—」变成真读数。</GapNote>
      </ConsoleCard>
    </section>
  );
}

export default IdentityPeoplePage;