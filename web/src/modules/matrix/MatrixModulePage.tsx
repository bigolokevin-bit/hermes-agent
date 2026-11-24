import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { RefreshCw, Search } from "lucide-react";

import { Chip } from "@/components/console/Chip";
import { ConsoleCard } from "@/components/console/ConsoleCard";

import {
  availabilityNote,
  DASH,
  fmtStamp,
  GAP_CALIBER,
  GAP_FILTER_TITLE,
  gateNotes,
  gateTable,
  lifecycleTone,
  missingPorts,
  PEOPLE_PIN_LABEL,
  peopleColumns,
  peopleOf,
  RESOURCE_KINDS,
  resourceHead,
  buildPeopleRows,
  buildResourceView,
  type MatrixCell,
  type PortNote,
  type Ports,
  type Read,
  type ResourceKind,
  type ResourceView,
} from "./matrix";
import { useMatrixPorts } from "./matrix.ports";

import "./matrix.css";

/**
 * 「能力与权限」矩阵（/employees?tab=matrix）。
 *
 * 骨架 2315–2385 的三张卡在这里同屏落地：
 *   ① 按员工覆盖 —— 行＝员工（30px 头像 + 姓名 + 工号短码），列＝员工 | 技能 |
 *      四道门 V1 群@ / V2 ReBAC / V3 引用 / V6 审批（逐格点灯） | 缺口（未达/可判定）|
 *      工具与接口 | 知识范围 | 部门；
 *   ② 按资源覆盖 —— 行＝技能/服务/空间，列＝员工，●/空；
 *   ③ 清点与口径 —— 一行 11px，真读数 + 口径。
 *
 * 两条硬规则贯穿全页：
 *   - 结构列（四道门 / 缺口 / 工具 / 知识 / 部门）读不到值也保留列名，格内写
 *     「未接 / 待核实 / —」，缺读口只在卡底声明一次；「技能」是数据列，没有读口才不渲染；
 *   - 全页只有外壳一个 h1，本模块标题是 h2；模块内零 role="tablist"
 *     （资源类型分段是 role="group" 的普通按钮）。
 */

const STATUS_FILTERS = [
  { value: "", label: "全部状态" },
  { value: "ok", label: "在岗" },
  { value: "warn", label: "受限" },
  { value: "mut", label: "停用" },
] as const;

const KIND_NOUN: Record<ResourceKind, string> = {
  skill: "技能",
  tool: "工具与接口",
  kb: "知识空间",
};

function asOfOf(read: Read<unknown>): string | null {
  return read.k === "ready" || read.k === "empty" || read.k === "missing" ? read.asOf : null;
}

/** 卡三的计数口径：ready 出条数，empty 出真零，其余出「—」（缺读口已单独声明）。 */
function countLabel(read: Read<unknown>): string {
  if (read.k === "ready" && Array.isArray(read.data)) return String(read.data.length);
  if (read.k === "empty") return "0";
  if (read.k === "loading") return "读取中";
  return DASH;
}

function renderCell(cell: MatrixCell | undefined) {
  if (!cell) return null;
  if (cell.k === "text") {
    return <span className={cell.mono ? "mtx-mono" : undefined}>{cell.text}</span>;
  }
  if (cell.k === "dash") {
    return (
      <span className="mtx-dash" title={cell.title}>
        {DASH}
      </span>
    );
  }
  if (cell.k === "chips") {
    return (
      <span className="mtx-chips" title={cell.title}>
        {cell.chips.map((chip) => (
          <Chip key={chip.title} title={chip.title}>
            {chip.label}
          </Chip>
        ))}
        {cell.more > 0 ? <span className="mtx-more">+{cell.more}</span> : null}
      </span>
    );
  }
  if (cell.k === "mark") {
    return cell.hit ? (
      <span className="mtx-mark" title={cell.title} aria-label="已挂载">
        ●
      </span>
    ) : (
      <span className="mtx-mark-empty" title={cell.title} aria-hidden="true" />
    );
  }
  if (cell.k === "gate") {
    return (
      <span className={`mtx-gate is-${cell.state}`} title={cell.title} data-gate={cell.state}>
        <span className="mtx-gate__lamp" aria-hidden="true" />
        {cell.text}
      </span>
    );
  }
  return (
    <span className={`mtx-state tone-${cell.tone}${cell.dashed ? " is-dashed" : ""}`} title={cell.title}>
      {cell.text}
    </span>
  );
}

/** 卡底一行 11px「缺读口：…」；全绿时不渲染。 */
function MissingLine({ notes, testId }: { notes: PortNote[]; testId: string }) {
  if (notes.length === 0) return null;
  return (
    <p className="mtx-note" data-testid={testId}>
      <span className="mtx-note__tag">缺读口</span>
      {notes.map((note) => (
        <span key={note.label} title={note.title ?? undefined}>
          {note.label}：{note.note}
        </span>
      ))}
    </p>
  );
}

function resourceEmptyText(
  view: ResourceView,
  kind: ResourceKind,
): { text: string; note: string; tone: "zero" | "gap" } {
  const noun = KIND_NOUN[kind];
  if (view.kindRead.k === "empty") {
    return {
      text: `${noun}读到真零：这个租户还没有登记${noun}，也没有任何员工挂载。`,
      note: "空集是真零，不是读取失败；行列保留，等有登记再回来看。",
      tone: "zero",
    };
  }
  if (view.kindRead.k === "missing") {
    return {
      text: `${noun}这一项本次没有读口：${view.kindRead.note}。`,
      note: "不补 0，也不摆示例行。",
      tone: "gap",
    };
  }
  if (view.kindRead.k === "error") {
    return {
      text: `${noun}这一项本次没有读到：${view.kindRead.note}。`,
      note: "刷新可以再试一次。",
      tone: "gap",
    };
  }
  return { text: `这个租户还没有${noun}条目。`, note: "", tone: "zero" };
}

function peopleEmptyText(ports: Ports, peopleCount: number): { text: string; note: string } {
  if (ports.matrix.k === "missing" || ports.roster.k === "missing") {
    return {
      text: "名单这一项没有读口，这一卡此刻摆不出员工行。",
      note: "矩阵与员工名单两条腿都没有回数：不补 0，也不摆示例行。",
    };
  }
  if (ports.matrix.k === "error" || ports.roster.k === "error") {
    return { text: "名单这一项此刻没有读到。", note: "刷新可以再试一次；这次读取没有改动任何东西。" };
  }
  if (peopleCount === 0) {
    return { text: "名单读到真零：这个租户还没有数字员工。", note: "空集是读到的真零，不是读取失败。" };
  }
  return { text: "该筛选下没有员工。", note: "清掉状态筛选或搜索关键字再看。" };
}

export function MatrixModulePage() {
  const [params, setParams] = useSearchParams();
  const kind: ResourceKind =
    params.get("res") === "tool" ? "tool" : params.get("res") === "kb" ? "kb" : "skill";
  const { ports, reload } = useMatrixPorts();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [dept, setDept] = useState("");

  const { people } = peopleOf(ports);
  // 逐条落位：卡一只等名单那两条腿，卡二只等本档资源那条腿。
  const peopleLoading = ports.matrix.k === "loading" && ports.roster.k === "loading";
  const activeCount = people.filter((person) => person.lifecycle === "active").length;

  const columns = useMemo(() => peopleColumns(ports), [ports]);
  const gates = useMemo(() => gateTable(ports), [ports]);
  const rows = useMemo(() => buildPeopleRows(ports, gates), [ports, gates]);
  const view = useMemo(() => buildResourceView(ports, kind), [ports, kind]);

  // 部门筛选的选项只从台账真值出（不造「全部部门」以外的空桶）。
  const deptOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) if (row.department) seen.add(row.department);
    return [...seen].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }, [rows]);
  const hasUnassigned = useMemo(() => rows.some((row) => !row.department), [rows]);

  const needle = query.trim().toLowerCase();
  const visiblePeople = useMemo(
    () =>
      rows.filter((row) => {
        if (status && lifecycleTone(row.lifecycle) !== status) return false;
        if (dept === "__none__" && row.department) return false;
        if (dept && dept !== "__none__" && row.department !== dept) return false;
        return !needle || row.haystack.includes(needle);
      }),
    [rows, status, dept, needle],
  );
  const visibleResources = useMemo(
    () => view.rows.filter((row) => !needle || row.haystack.includes(needle)),
    [view.rows, needle],
  );

  const asOf = asOfOf(ports.matrix) ?? asOfOf(ports.skills) ?? asOfOf(ports.spaces);
  const gapNotes = missingPorts(ports, ["matrix", "employees"]);
  const gatePortNotes = gateNotes(ports.gate);
  const availability = availabilityNote(ports);
  const kindNotes = missingPorts(
    ports,
    kind === "skill" ? ["skills"] : kind === "tool" ? ["tools"] : ["spaces"],
  );

  const chooseKind = (next: ResourceKind) => {
    const search = new URLSearchParams(params);
    search.set("tab", "matrix");
    if (next === "skill") search.delete("res");
    else search.set("res", next);
    setParams(search, { replace: true });
  };

  const clearFilters = () => {
    setQuery("");
    setStatus("");
    setDept("");
  };

  const peopleEmpty = peopleEmptyText(ports, people.length);
  const resourceEmpty = resourceEmptyText(view, kind);
  const head = resourceHead(kind, view.columns, view.dropColumns);
  const empOrder = new Map<string, number>(view.columns.map((column, index) => [`emp:${column.key}`, index]));

  return (
    <section className="mtx-page" data-testid="mtx-page" data-state={peopleLoading ? "loading" : "ready"}>
      <div className="mtx-head">
        <div className="mtx-head__text">
          <h2 className="mtx-title">能力与权限</h2>
          <p className="mtx-sub" data-testid="mtx-sub">
            <b className="mtx-num">{people.length}</b> 名数字员工
            <span className="mtx-sep" aria-hidden="true">
              ·
            </span>
            <b className="mtx-num">{activeCount}</b> 在岗
            <span className="mtx-sep" aria-hidden="true">
              ·
            </span>
            按员工或按资源看覆盖
          </p>
        </div>
        <div className="mtx-acts">
          <span className="mtx-read" title="取六条读口里最近的一次读取时刻">
            读取于 {fmtStamp(asOf)}
          </span>
          <button type="button" className="mtx-btn" onClick={reload} data-testid="mtx-refresh">
            <RefreshCw className="mtx-btn__icon" aria-hidden="true" />
            刷新
          </button>
        </div>
      </div>

      {/* ① 按员工覆盖 ------------------------------------------------ */}
      <ConsoleCard
        label="按员工覆盖"
        action={<span>四道门（V1·V2·V3·V6）逐格点灯 · 缺口取可判定门交集</span>}
        flush
        data-testid="mtx-people-card"
      >
        <div className="mtx-filterbar">
          <label className="mtx-search">
            <Search className="mtx-search__icon" aria-hidden="true" />
            <input
              type="search"
              className="mtx-input"
              aria-label="搜索员工、技能、工具、知识空间"
              placeholder="搜索员工、技能、工具、知识空间"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              data-testid="mtx-search"
            />
          </label>
          <select
            className="mtx-select"
            aria-label="部门（本地过滤）"
            title="部门取自员工台账，只在本页过滤，不发请求"
            value={dept}
            onChange={(event) => setDept(event.target.value)}
            data-testid="mtx-dept"
          >
            <option value="">全部部门</option>
            {deptOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            {hasUnassigned ? <option value="__none__">未登记部门</option> : null}
          </select>
          <select
            className="mtx-select"
            aria-label="状态"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            data-testid="mtx-status"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="mtx-switch is-off" title={GAP_FILTER_TITLE}>
            <input type="checkbox" disabled aria-label="只看有缺口" data-testid="mtx-gap-only" />
            只看有缺口
          </label>
          <span className="mtx-grow" />
          <span className="mtx-meta" data-testid="mtx-people-meta">
            {visiblePeople.length} / {rows.length} 人 · 部门本地过滤 · 缺口降序
          </span>
        </div>

        {peopleLoading ? (
          <div className="mtx-skeleton" aria-busy="true" aria-label="读取中" data-testid="mtx-loading">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div className="mtx-tw mtx5-scroll" data-testid="mtx-people-scroll">
            <table className="mtx-table mtx-table--people">
              <thead>
                <tr>
                  <th scope="col" className="mtx5-pin mtx-th-who">
                    {PEOPLE_PIN_LABEL}
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={column.right ? "mtx-right" : undefined}
                      data-testid={`mtx-col-${column.key}`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiblePeople.length === 0 ? (
                  <tr className="mtx-gap-row">
                    <td colSpan={columns.length + 1} data-testid="mtx-people-empty">
                      <b>{peopleEmpty.text}</b>
                      <span>{peopleEmpty.note}</span>
                      {rows.length > 0 ? (
                        <button type="button" className="mtx-linkbtn" onClick={clearFilters} data-testid="mtx-clear-filters">
                          清除筛选
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ) : (
                  visiblePeople.map((row) => (
                    <tr key={row.key} data-testid={`mtx-row-${row.key}`}>
                      <td className="mtx5-pin mtx-td-who">
                        <Link
                          className="mtx-who"
                          to={`/employees/${encodeURIComponent(row.key)}`}
                          title={row.rowTitle}
                          data-testid={`mtx-owner-${row.key}`}
                        >
                          <span className="mtx-ava" aria-hidden="true">
                            {row.initials}
                          </span>
                          <span className="mtx-who__text">
                            <span className="mtx-who__name">
                              <span
                                className={`mtx-dot tone-${row.lifecycleToneValue}`}
                                title={row.lifecycleText}
                                aria-hidden="true"
                              />
                              {row.name}
                            </span>
                            <span className="mtx-who__sub">{row.sub}</span>
                          </span>
                        </Link>
                      </td>
                      {columns.map((column) => (
                        <td key={column.key} className={column.right ? "mtx-right" : undefined}>
                          {renderCell(row.cells[column.key])}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <MissingLine notes={[...gapNotes, ...gatePortNotes]} testId="mtx-people-note" />
        {availability ? (
          <p className="mtx-note" data-testid="mtx-availability">
            <span className="mtx-note__tag">{availability.label}</span>
            <span title={availability.title ?? undefined}>{availability.note}</span>
          </p>
        ) : null}
        <p className="mtx-note" data-testid="mtx-gap-caliber">
          <span className="mtx-note__tag">缺口口径</span>
          <span>{GAP_CALIBER}</span>
        </p>
      </ConsoleCard>

      {/* ② 按资源覆盖 ------------------------------------------------ */}
      <ConsoleCard
        label="按资源覆盖"
        action={<span>行＝资源 · 列＝员工 · ● 已挂载</span>}
        flush
        data-testid="mtx-resource-card"
      >
        <div className="mtx-filterbar">
          <span className="mtx-seg" role="group" aria-label="资源类型">
            {RESOURCE_KINDS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={kind === option.id ? "is-on" : undefined}
                aria-pressed={kind === option.id}
                onClick={() => chooseKind(option.id)}
                data-testid={`mtx-kind-${option.id}`}
              >
                {option.label}
              </button>
            ))}
          </span>
          <span className="mtx-grow" />
          <span className="mtx-meta" data-testid="mtx-res-meta">
            {visibleResources.length} 项 · 覆盖分母 {view.denominator} 在岗 · 列 {view.columns.length}/{view.totalPeople}
          </span>
        </div>

        {view.kindRead.k === "loading" ? (
          <div className="mtx-skeleton" aria-busy="true" aria-label="读取中" data-testid="mtx-res-loading">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div className="mtx-tw mtx5-scroll" data-testid="mtx-resource-scroll">
            <table className={`mtx-table mtx-table--res mtx-table--${kind}`}>
              <thead>
                <tr>
                  {head.map((def, index) => (
                    <th
                      key={def.key}
                      scope="col"
                      className={[index === 0 ? "mtx5-pin" : "", def.right ? "mtx-right" : "", def.key.startsWith("emp:") ? "mtx-col-emp" : ""]
                        .filter(Boolean)
                        .join(" ") || undefined}
                      title={def.meta}
                      data-testid={`mtx-reshead-${def.key}`}
                    >
                      {def.key.startsWith("emp:") ? (
                        <>
                          <span className="mtx-emp-label">{def.label}</span>
                          <span className="mtx-th-meta">{def.meta}</span>
                        </>
                      ) : (
                        <>
                          {def.label}
                          {def.meta ? <span className="mtx-th-meta">{def.meta}</span> : null}
                        </>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleResources.length === 0 ? null : (
                  visibleResources.map((row) => {
                    const cellOf = (key: string): MatrixCell | undefined => {
                      if (key === "name") return row.name;
                      if (key === "count") return row.count;
                      if (key === "state") return row.state;
                      if (key.startsWith("emp:")) {
                        const order = empOrder.get(key);
                        return order === undefined ? undefined : row.hits[order];
                      }
                      return row.extras[key];
                    };
                    return (
                      <tr key={row.key} data-testid={`mtx-resrow-${row.key}`}>
                        {head.map((def, index) => {
                          const cell = cellOf(def.key);
                          return (
                            <td
                              key={def.key}
                              className={[
                                index === 0 ? "mtx5-pin mtx-td-name" : "",
                                def.right ? "mtx-right" : "",
                              ]
                                .filter(Boolean)
                                .join(" ") || undefined}
                            >
                              {def.key === "name" && cell?.k === "text" ? (
                                <span className="mtx-res-name" title={cell.title}>
                                  {cell.text}
                                </span>
                              ) : (
                                renderCell(cell)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {view.kindRead.k !== "loading" && visibleResources.length === 0 ? (
          <div
            className={`mtx-blank tone-${needle && view.rows.length > 0 ? "zero" : resourceEmpty.tone}`}
            data-testid="mtx-resource-empty"
          >
            <b>{needle && view.rows.length > 0 ? "该搜索下没有资源。" : resourceEmpty.text}</b>
            <span>{needle && view.rows.length > 0 ? "清掉搜索关键字再看。" : resourceEmpty.note}</span>
          </div>
        ) : null}
        <MissingLine notes={kindNotes} testId="mtx-resource-note" />
      </ConsoleCard>

      {/* ③ 清点与口径 ------------------------------------------------ */}
      <p className="mtx-nummeta" data-testid="mtx-summary">
        <span className="mtx-nummeta__k">清点</span>
        员工 <b>{people.length}</b>
        <span className="mtx-sep" aria-hidden="true">
          ·
        </span>
        在岗 <b>{activeCount}</b>
        <span className="mtx-sep" aria-hidden="true">
          ·
        </span>
        技能登记 <b>{countLabel(ports.skills)}</b>
        <span className="mtx-sep" aria-hidden="true">
          ·
        </span>
        知识空间 <b>{countLabel(ports.spaces)}</b>
        <span className="mtx-sep" aria-hidden="true">
          ·
        </span>
        缺口交集 <b>{gates.gap.denom ?? "待核实"}</b> 可判定 / <b>{gates.gap.denom === null || gates.gap.pass === null ? "待核实" : gates.gap.denom - gates.gap.pass}</b> 未达
        <span className="mtx-sep" aria-hidden="true">
          ·
        </span>
        四门证据覆盖 <b>{gates.coverage.covered}/{gates.coverage.requested}</b> 位员工
        <span className="mtx-sep" aria-hidden="true">
          ·
        </span>
        读取于 {fmtStamp(asOf)}
      </p>

    </section>
  );
}