// 能力与接入 · 技能（骨架 #/capabilities 第一页）
//
// 骨架给了 7 块：筛选条 / 技能账本 / 提案队列 / 提案差异 / 准入线 / 发现筛选条 / 发现。
// 本页 7 块都画出来，块里只放真读数；没有读口的块照实写缺读口。
//
// 真读口只有一个：技能台账。它给的字段（名称、版本、来源、启用状态）如实上屏；
// 它没给的（能力标签、挂载数、7 天调用）一律「—」，并在卡脚说清缺哪一项。
import { useMemo, useState } from "react";
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { Pill } from "@/components/console/Pill";
import { CardFoot, GapNote, GapRow, PaneHead } from "./PaneBits";
import { DASH, asOfLabel, count, gapText, listOf, recordOf, textOf, usePort } from "./paneApi";

type SkillRow = {
  id: string;
  name: string | null;
  version: string | null;
  source: string | null;
  status: "可用" | "已停用" | null;
  scope: string | null;
};

const SOURCE_LABEL: Record<string, string> = {
  bundled: "官方",
  builtin: "官方",
  platform: "官方",
  hub: "社区",
  external: "外部",
  agent: "自建",
  custom: "自建",
  tenant: "自建",
};

const SCOPE_LABEL: Record<string, string> = {
  "tenant-shared": "团队共享",
  "employee-exclusive": "员工专属",
  unused: "未被引用",
};

function parseSkills(body: unknown): SkillRow[] | null {
  const items = listOf(body);
  if (items === null) return null;
  return items.map((item, index) => {
    const row = recordOf(item);
    const rawSource = textOf(row.provenance) ?? textOf(row.source);
    const enabled = row.enabled;
    const rawScope = textOf(row.scope);
    return {
      id: textOf(row.id) ?? textOf(row.name) ?? `skill-${index}`,
      name: textOf(row.name),
      version: textOf(row.version),
      source: rawSource ? SOURCE_LABEL[rawSource.toLowerCase()] ?? "其他来源" : null,
      status: enabled === true ? "可用" : enabled === false ? "已停用" : null,
      scope: rawScope ? SCOPE_LABEL[rawScope.toLowerCase()] ?? "其他范围" : null,
    };
  });
}

export function CapSkillsPane() {
  const skills = usePort("/api/skills", parseSkills, (rows) => rows.length === 0);
  const proposals = usePort("/api/skill-proposals", (body) => listOf(body), (rows) => rows.length === 0);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");

  const rows = skills.read.k === "ready" ? skills.read.data : [];
  const proposed = proposals.read.k === "ready" ? proposals.read.data.length : null;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (status === "可用" && row.status !== "可用") return false;
      if (status === "已停用" && row.status !== "已停用") return false;
      if (source !== "all" && row.source !== source) return false;
      if (!needle) return true;
      return [row.name, row.source, row.scope].some((v) => (v ?? "").toLowerCase().includes(needle));
    });
  }, [rows, query, status, source]);

  const missingCalls = "缺读口：调用计数未按 7 天窗口回传";
  const published =
    skills.read.k === "ready" ? rows.length : skills.read.k === "empty" ? 0 : null;

  return (
    <div className="cap-pane" data-testid="cap-skills">
      <PaneHead
        sub={`${count(published)} 个已发布 · ${count(proposed)} 个提案 · ${DASH} 个可发现`}
        readout={asOfLabel(skills.read)}
        readoutTitle="技能台账的读取时刻（北京时间）"
      />

      {/* 1 筛选条 */}
      <ConsoleCard flush>
        <div className="cap-filters">
          <input
            className="cap-input"
            type="search"
            value={query}
            placeholder="搜索技能、来源、共享范围"
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
            aria-label="来源"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          >
            <option value="all">全部来源</option>
            <option value="官方">官方</option>
            <option value="自建">自建</option>
            <option value="社区">社区</option>
            <option value="外部">外部</option>
          </select>
          <span className="cap-grow" />
          <span className="cap-note">只读账本 · 写入按权限</span>
        </div>
      </ConsoleCard>

      {/* 2 技能账本 */}
      <ConsoleCard label="技能账本" action={<span className="cap-action">版本与来源</span>} flush>
        <div className="cap-tw">
          <table className="cap-t">
            <thead>
              <tr>
                <th>技能</th>
                <th>版本</th>
                <th>来源</th>
                <th>能力</th>
                <th className="cap-num">挂载</th>
                <th className="cap-num cap-sm-hide">7 天调用</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} data-testid="cap-skill-row">
                  <td>{row.name ?? DASH}</td>
                  <td className="cap-mono cap-mut">{row.version ?? DASH}</td>
                  <td className="cap-mut">{row.source ?? DASH}</td>
                  <td className="cap-mut" title="技能台账没有能力标签字段">
                    {DASH}
                  </td>
                  <td className="cap-num" title="技能台账没有挂载数">
                    {DASH}
                  </td>
                  <td className="cap-num cap-sm-hide" title={missingCalls}>
                    {DASH}
                  </td>
                  <td>
                    {row.status ? (
                      <Pill tone={row.status === "可用" ? "ok" : "mut"}>{row.status}</Pill>
                    ) : (
                      <span className="cap-mut">{DASH}</span>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <GapRow colSpan={7}>
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
          note="能力、挂载、7 天调用三列没有读口；台账只回传名称、版本、来源与启用状态"
          right={`${visible.length} / ${published === null ? DASH : published} 行`}
        />
      </ConsoleCard>

      {/* 3 + 4 提案队列 / 提案差异，5 准入线 */}
      <div className="cap-split">
        <div className="cap-stack">
          <ConsoleCard label="提案队列" action={<span className="cap-action">按影响面排序</span>} flush>
            <div className="cap-tw">
              <table className="cap-t">
                <thead>
                  <tr>
                    <th>提案</th>
                    <th>类型</th>
                    <th>提出人</th>
                    <th className="cap-num">影响</th>
                    <th className="cap-num">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.read.k === "ready" && proposals.read.data.length > 0 ? (
                    proposals.read.data.map((item, index) => {
                      const row = recordOf(item);
                      return (
                        <tr key={textOf(row.id) ?? `proposal-${index}`}>
                          <td>{textOf(row.title) ?? DASH}</td>
                          <td className="cap-mut">{textOf(row.kind) ?? DASH}</td>
                          <td className="cap-mut">{textOf(row.author) ?? DASH}</td>
                          <td className="cap-num">{textOf(row.impact) ?? DASH}</td>
                          <td className="cap-num">
                            <Pill tone="warn">{textOf(row.status) ?? "待审"}</Pill>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <GapRow colSpan={5}>
                      {gapText(proposals.read, "正在读取提案队列…", "提案队列是空的（真零）")}
                    </GapRow>
                  )}
                </tbody>
              </table>
            </div>
            <CardFoot note="提案端点未接线时，队列为空不代表没有提案" right={DASH} />
          </ConsoleCard>

          <ConsoleCard label="提案差异" action={<span className="cap-action">版本对照</span>}>
            <GapNote>缺读口：提案详情端点未接线，这一页没有可对照的两版内容与评测读数。</GapNote>
          </ConsoleCard>
        </div>

        <div className="cap-rail">
          <ConsoleCard label="准入线" action={<span className="cap-action">技能升级</span>}>
            <GapNote>缺读口：准入评测、成本与延迟门槛都由提案详情回传，本控制台读不到。</GapNote>
          </ConsoleCard>
        </div>
      </div>

      {/* 6 发现筛选条 */}
      <ConsoleCard flush>
        <div className="cap-filters">
          <input
            className="cap-input"
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
      </ConsoleCard>

      {/* 7 发现 */}
      <ConsoleCard label="发现" action={<span className="cap-action">外部来源 · 许可证已标</span>}>
        <GapNote>缺读口：外部技能索引未接线，这里既没有可复制的候选，也没有来源与许可证。</GapNote>
        <p className="cap-para">
          这里不做官方技能商店：复制只创建本租户草稿，二开与审批都在本租户内完成。
        </p>
      </ConsoleCard>
    </div>
  );
}