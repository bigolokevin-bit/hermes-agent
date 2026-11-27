// 能力与接入 · 技能（骨架 console-v4-skeleton.html `data-mod="capabilities"` 第一页）
//
// 骨架给了 7 块：筛选条 / 技能账本 / 提案队列 / 提案差异 / 准入线 / 发现筛选条 / 发现。
// 七块都立起来，块里只放真读数：没有读口的列整列不画（不留空列），缺了哪几项在卡底
// 用一行 11px 写清，正文里不出现路由名与状态码。
//
// 真读口只有一个：技能台账。它回传 skillId / name / displayName / version /
// sharedCount（sharedWith 兜底）/ scope / enabled；它没回的（来源、能力标签、
// 7 天调用、提案、发现索引）一律不当 0，也不摆示例行。
import { useMemo, useState } from "react";
import { Pill } from "@/components/console/Pill";
import { CardFoot, CardHead, GapNote, GapRow, PaneHead } from "./PaneBits";
import { DASH, asOfLabel, count, gapText, listOf, recordOf, textOf, usePort } from "./paneApi";

type SkillRow = {
  id: string;
  name: string | null;
  version: string | null;
  /** 挂载 = 引用这个技能的员工数（台账的 sharedCount）。 */
  mounted: number | null;
  /** 共享范围的原始值，供筛选用。 */
  scopeKey: string | null;
  scope: string | null;
  status: "可用" | "已停用" | null;
};

type ProposalRow = {
  id: string;
  cells: Record<string, string | null>;
  /** 提交时刻，用于排序（台账按 submittedAt 倒序，影响面字段上游没有）。 */
  sortKey: string | null;
};

/** 提案台账的状态码 → 屏上中文；未知码原样上屏，不猜。 */
const PROPOSAL_STATUS: Record<string, string> = {
  pending_review: "待审",
  approved: "已批准",
  rejected: "已驳回",
  withdrawn: "已撤回",
};

const SCOPE_LABEL: Record<string, string> = {
  "tenant-shared": "团队共享",
  "employee-exclusive": "员工专属",
  unused: "未被引用",
};

const PROPOSAL_COLS = [
  { key: "title", label: "提案" },
  { key: "kind", label: "类型" },
  { key: "author", label: "提出人" },
  { key: "impact", label: "影响" },
  { key: "status", label: "状态" },
] as const;

function parseSkills(body: unknown): SkillRow[] | null {
  const items = listOf(body);
  if (items === null) return null;
  return items.map((item, index) => {
    const row = recordOf(item);
    const rawScope = (textOf(row.scope) ?? "").toLowerCase() || null;
    const rawMounted = row.sharedCount ?? row.shared_count;
    const sharedWith = Array.isArray(row.sharedWith) ? row.sharedWith.length : null;
    const enabled = row.enabled;
    return {
      id: textOf(row.skillId) ?? textOf(row.skill_id) ?? textOf(row.id) ?? `skill-${index}`,
      name: textOf(row.displayName) ?? textOf(row.name),
      version: textOf(row.version),
      mounted:
        typeof rawMounted === "number" && Number.isFinite(rawMounted)
          ? rawMounted
          : sharedWith,
      scopeKey: rawScope,
      scope: rawScope ? SCOPE_LABEL[rawScope] ?? "其他范围" : null,
      status: enabled === true ? "可用" : enabled === false ? "已停用" : null,
    };
  });
}

// 提案台账（/api/skill-proposals → 8104）回传 proposalId / name / summary /
// status / submittedBy / submittedAt；类型、影响面两项上游没有，对应列整列不画。
function parseProposals(body: unknown): ProposalRow[] | null {
  const items = listOf(body);
  if (items === null) return null;
  return items.map((item, index) => {
    const row = recordOf(item);
    const submittedBy = recordOf(row.submittedBy);
    const rawStatus = textOf(row.status);
    return {
      id: textOf(row.id) ?? textOf(row.proposalId) ?? `proposal-${index}`,
      sortKey: textOf(row.submittedAt),
      cells: {
        title: textOf(row.title) ?? textOf(row.name) ?? textOf(row.summary),
        kind: textOf(row.kind) ?? textOf(row.type),
        author: textOf(row.author) ?? textOf(row.proposedBy) ?? textOf(submittedBy?.id),
        impact: textOf(row.impact) ?? textOf(row.impactLabel),
        status: rawStatus ? PROPOSAL_STATUS[rawStatus] ?? rawStatus : null,
      },
    };
  });
}

const STATUS_TONE = { 可用: "ok", 已停用: "mut" } as const;
const SCOPE_TONE: Record<string, "info" | "mut" | "warn"> = {
  团队共享: "info",
  员工专属: "mut",
  未被引用: "warn",
};
const PROPOSAL_TONE: Record<string, "ok" | "warn" | "mut" | "info" | "bad"> = {
  待审: "warn",
  草稿: "mut",
  已批准: "ok",
  已驳回: "bad",
  升级: "info",
};

export function CapSkillsPane() {
  const skills = usePort("/api/skills", parseSkills, (rows) => rows.length === 0);
  const proposals = usePort("/api/skill-proposals", parseProposals, (rows) => rows.length === 0);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [scope, setScope] = useState("all");

  const rows = skills.read.k === "ready" ? skills.read.data : [];
  // 台账没有影响面字段：排序只认提交时刻倒序，「按影响面排序」的说法不成立。
  const proposalRows = useMemo(() => {
    const base = proposals.read.k === "ready" ? proposals.read.data : [];
    return [...base].sort((a, b) => (b.sortKey ?? "").localeCompare(a.sortKey ?? ""));
  }, [proposals.read]);
  const proposed =
    proposals.read.k === "ready"
      ? proposalRows.length
      : proposals.read.k === "empty"
        ? 0
        : null;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status === "可用" && row.status !== "可用") return false;
      if (status === "已停用" && row.status !== "已停用") return false;
      if (scope === "团队共享" && row.scope !== "团队共享") return false;
      if (scope === "员工专属" && row.scope !== "员工专属") return false;
      if (scope === "未被引用" && row.scope !== "未被引用") return false;
      if (!needle) return true;
      return [row.name, row.version, row.scope].some((v) => (v ?? "").toLowerCase().includes(needle));
    });
  }, [rows, query, status, scope]);

  const published = skills.read.k === "ready" ? rows.length : skills.read.k === "empty" ? 0 : null;

  // 列只在有源时才画：台账没有来源、能力标签、7 天调用三项，这三列整列不出现。
  const showScope = rows.some((row) => row.scope !== null);
  const showMounted = rows.some((row) => row.mounted !== null);
  const showStatus = rows.some((row) => row.status !== null);
  const skillCols = 2 + (showScope ? 1 : 0) + (showMounted ? 1 : 0) + (showStatus ? 1 : 0);

  const proposalCols = PROPOSAL_COLS.filter((col) =>
    proposalRows.some((row) => row.cells[col.key] !== null),
  );

  return (
    <div className="cap-pane" data-testid="cap-skills">
      <PaneHead
        showNative={false}
        sub={`${count(published)} 个已发布 · ${count(proposed)} 个提案 · ${DASH} 个可发现`}
        readout={asOfLabel(skills.read)}
        readoutTitle="技能台账的读取时刻（北京时间）"
      />

      {/* 1 筛选条 */}
      <div className="console-card">
        <div className="cap-filters">
          <input
            className="cap-input cap-search"
            type="search"
            value={query}
            placeholder="搜索技能、版本、共享范围"
            aria-label="搜索技能"
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="cap-input cap-select"
            aria-label="状态"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">全部状态</option>
            <option value="可用">可用</option>
            <option value="已停用">已停用</option>
          </select>
          <select
            className="cap-input cap-select"
            aria-label="共享范围"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
          >
            <option value="all">全部范围</option>
            <option value="团队共享">团队共享</option>
            <option value="员工专属">员工专属</option>
            <option value="未被引用">未被引用</option>
          </select>
          <span className="cap-grow" />
          <span className="cap-note">只读账本 · 写入按权限</span>
        </div>
      </div>

      {/* 2 技能账本 */}
      <div className="console-card">
        <CardHead title="技能账本" action="版本与挂载" />
        <div className="cap-tw">
          <table className="cap-t">
            <thead>
              <tr>
                <th>技能</th>
                <th>版本</th>
                {showScope ? <th className="cap-sm-hide">共享范围</th> : null}
                {showMounted ? <th className="cap-num">挂载</th> : null}
                {showStatus ? <th>状态</th> : null}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} data-testid="cap-skill-row">
                  <td>{row.name ?? DASH}</td>
                  <td className="cap-mono cap-mut">{row.version ?? DASH}</td>
                  {showScope ? (
                    <td className="cap-sm-hide">
                      {row.scope ? (
                        <Pill tone={SCOPE_TONE[row.scope] ?? "mut"}>{row.scope}</Pill>
                      ) : (
                        <span className="cap-mut">{DASH}</span>
                      )}
                    </td>
                  ) : null}
                  {showMounted ? (
                    <td className="cap-num" title="引用这个技能的员工数">
                      {row.mounted === null ? DASH : count(row.mounted)}
                    </td>
                  ) : null}
                  {showStatus ? (
                    <td>
                      {row.status ? (
                        <Pill tone={STATUS_TONE[row.status]}>{row.status}</Pill>
                      ) : (
                        <span className="cap-mut">{DASH}</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
              {visible.length === 0 ? (
                <GapRow colSpan={skillCols}>
                  {gapText(
                    skills.read,
                    "正在读取技能台账…",
                    rows.length === 0
                      ? "技能台账里还没有已发布的技能（真零，不是加载失败）"
                      : "没有符合当前筛选的技能",
                  )}
                </GapRow>
              ) : null}
            </tbody>
          </table>
        </div>
        <CardFoot
          note="缺读口：来源、能力标签、7 天调用（台账只回传名称、版本、共享范围与挂载数，缺的列整列不画）"
          right={`${visible.length} / ${published === null ? DASH : published} 行`}
        />
      </div>

      {/* 3 + 4 提案队列 / 提案差异，5 准入线 */}
      <div className="cap-split">
        <div className="cap-stack">
          <div className="console-card">
            <CardHead title="提案队列" action="按提交时间倒序" />
            {proposalCols.length > 0 ? (
              <div className="cap-tw">
                <table className="cap-t">
                  <thead>
                    <tr>
                      {proposalCols.map((col) => (
                        <th
                          key={col.key}
                          className={col.key === "impact" || col.key === "status" ? "cap-num" : undefined}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {proposalRows.map((row) => (
                      <tr key={row.id} data-testid="cap-proposal-row">
                        {proposalCols.map((col) => (
                          <td
                            key={col.key}
                            className={
                              col.key === "status"
                                ? "cap-num"
                                : col.key === "impact"
                                  ? "cap-num cap-mut"
                                  : col.key === "title"
                                    ? undefined
                                    : "cap-mut"
                            }
                          >
                            {col.key === "status" && row.cells.status ? (
                              <Pill tone={PROPOSAL_TONE[row.cells.status] ?? "mut"}>
                                {row.cells.status}
                              </Pill>
                            ) : (
                              row.cells[col.key] ?? DASH
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="console-card__body">
                <GapNote>
                  {gapText(
                    proposals.read,
                    "正在读取提案队列…",
                    "提案队列是空的（真零，不是加载失败）",
                  )}
                </GapNote>
              </div>
            )}
            <CardFoot
              note="提案只能来自提案台账（类型与影响面上游未回传，两列不出现）；本页只读，审核动作在治理面完成"
              right={
                proposals.read.k === "ready" || proposals.read.k === "empty"
                  ? `${count(proposed)} 条`
                  : undefined
              }
            />
          </div>

          <div className="console-card">
            <CardHead title="提案差异" action="版本对照" />
            <div className="console-card__body">
              <GapNote>缺读口：提案详情端点未接线，这一卡没有可对照的两版内容与评测读数。</GapNote>
              <p className="cap-para">
                接入后这里逐行给出两版的增删行，并按命中、延迟、单次成本三项读数对照。
              </p>
            </div>
          </div>
        </div>

        <div className="cap-rail">
          <div className="console-card">
            <CardHead title="准入线" action="技能升级" />
            <div className="console-card__body">
              <GapNote>缺读口：准入评测与门槛读数都由提案详情回传，本控制台读不到。</GapNote>
              <p className="cap-para">
                批准前要看五项：评测得分、成本增幅、延迟增幅、回滚方案、影响员工通知。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 6 发现筛选条 */}
      <div className="console-card">
        <div className="cap-filters">
          <input
            className="cap-input cap-search"
            type="search"
            placeholder="搜索可发现的技能、来源"
            aria-label="搜索可发现的技能"
            disabled
            title="外部技能索引未接线，筛选控件暂无可筛对象"
          />
          <select className="cap-input cap-select" aria-label="发现来源" disabled>
            <option>全部来源</option>
          </select>
          <span className="cap-grow" />
          <span className="cap-note">复制后进入草稿，不直接生效</span>
        </div>
      </div>

      {/* 7 发现 */}
      <div className="console-card">
        <CardHead title="发现" action="外部来源 · 许可证已标" />
        <div className="console-card__body">
          <GapNote>缺读口：外部技能索引未接线，这里既没有可复制的候选，也没有来源与许可证。</GapNote>
          <p className="cap-para">
            这里不做官方技能商店：复制只创建本租户草稿，二开与审批都在本租户内完成。
          </p>
        </div>
      </div>
    </div>
  );
}