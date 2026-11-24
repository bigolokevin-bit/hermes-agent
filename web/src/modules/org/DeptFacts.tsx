/**
 * DeptFacts · 组织与部门页的「真实可读事实」块（2026-11-24）。
 *
 * 背景：`/identity?tab=departments` 的部门接口（GAP-02）在本环境没有读口
 * （BFF 读代理清单里没有 departments，实测 `/api/v1/dept/*` 全 404），页面
 * 只剩一张「未接入」卡，用户视角就是「点进去什么都没有」。
 *
 * 这一块不伪造部门树、不编负责人、不补 0：它只做一件能被证据支撑的事——
 * 把**员工档案里已经写着的** `department` 字段按人数归拢，并反复说明
 * 「这不是组织树」。数据来自 E11 名录 `/agent-api/api/employees`（BFF 只读
 * 代理），读不到时如实说读不到。
 */
import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent } from "@nous-research/ui";

import { fetchJSON } from "@/lib/api";

type RosterPhase = "loading" | "ready" | "none" | "unavailable";

type Roster = {
  phase: RosterPhase;
  /** 已标注部门的员工数。 */
  tagged: number;
  /** 名录里读到的员工总数。 */
  total: number;
  /** 部门名 → 人数（按人数降序）。 */
  groups: Array<{ name: string; count: number }>;
};

const LOADING: Roster = { phase: "loading", tagged: 0, total: 0, groups: [] };

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function itemsOf(body: unknown): Record<string, unknown>[] {
  const root = record(body);
  const raw = Array.isArray(root.items) ? root.items : Array.isArray(body) ? body : [];
  return raw.map(record);
}

function deptOf(row: Record<string, unknown>): string | null {
  const value = row.department ?? row.deptName ?? row.dept_name;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** 只做归拢，不做层级推断：部门名就是员工档案里的原字符串。 */
function buildRoster(body: unknown): Roster {
  const rows = itemsOf(body);
  if (rows.length === 0) return { phase: "none", tagged: 0, total: 0, groups: [] };
  const tally = new Map<string, number>();
  let tagged = 0;
  for (const row of rows) {
    const dept = deptOf(row);
    if (dept === null) continue;
    tagged += 1;
    tally.set(dept, (tally.get(dept) ?? 0) + 1);
  }
  const groups = [...tally.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"));
  return { phase: groups.length ? "ready" : "none", tagged, total: rows.length, groups };
}

export default function DeptFacts() {
  const [roster, setRoster] = useState<Roster>(LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const body = await fetchJSON<unknown>("/agent-api/api/employees?limit=200");
        if (!alive) return;
        setRoster(buildRoster(body));
      } catch {
        if (!alive) return;
        setRoster({ phase: "unavailable", tagged: 0, total: 0, groups: [] });
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  const summary = useMemo(() => {
    if (roster.phase !== "ready") return "";
    return `员工 ${roster.total} 人 · 已标注部门 ${roster.tagged} 人 · 部门 ${roster.groups.length} 个`;
  }, [roster]);

  return (
    <Card className="mt-4">
      <CardContent className="space-y-3 p-4" data-testid="org5-facts">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[11px] tracking-[0.12em] text-white/45">
            员工档案里的部门分布
          </span>
          <span className="flex items-center gap-2 text-xs text-white/40">
            {roster.phase === "ready" ? <span data-testid="org5-facts-summary">{summary}</span> : null}
            <button
              type="button"
              className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-white/70"
              onClick={() => {
                // 重读前先回到骨架态（放在事件里，避免 effect 内同步 setState）。
                setRoster(LOADING);
                setAttempt((value) => value + 1);
              }}
              data-testid="org5-facts-reload"
            >
              <RefreshCw className="size-3" aria-hidden="true" />
              重读
            </button>
          </span>
        </div>

        <p className="text-xs text-white/45">
          这不是组织树：部门接口尚未接入，这里只把员工档案里已写着
          <span className="mx-1 break-all font-mono text-[0.72rem] text-white/60">department</span>
          字段的员工按部门名归拢。层级、负责人、更新时间一概不推测。
        </p>

        {roster.phase === "loading" ? (
          <div className="space-y-2" data-testid="org5-facts-loading" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-white/5" />
            ))}
          </div>
        ) : roster.phase === "unavailable" ? (
          <p className="text-sm text-white/60" data-testid="org5-facts-unavailable">
            —（本次没读到员工名录 /api/employees，不代表 0 个部门）
          </p>
        ) : roster.phase === "none" ? (
          <p className="text-sm text-white/60" data-testid="org5-facts-none">
            —（员工档案里没有任何部门字段：{roster.total} 名员工全部未标注部门）
          </p>
        ) : (
          <div data-testid="org5-facts-rows">
            {roster.groups.map((group) => (
              <div
                key={group.name}
                className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-t border-white/5 py-1.5"
                data-testid="org5-facts-row"
              >
                <span className="min-w-0 break-words text-sm text-white/80">{group.name}</span>
                <span className="shrink-0 text-sm tabular-nums text-white/60">{group.count} 人</span>
              </div>
            ))}
            {roster.total > roster.tagged ? (
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-t border-white/5 py-1.5">
                <span className="min-w-0 break-words text-sm text-white/55">未标注部门</span>
                <span className="shrink-0 text-sm tabular-nums text-white/50">
                  {roster.total - roster.tagged} 人
                </span>
              </div>
            ) : null}
          </div>
        )}

        <p className="text-[11px] text-white/35">
          来源：GET /api/employees（E11 名录，只读）。员工档案没写的部门，这里不补。
        </p>
      </CardContent>
    </Card>
  );
}