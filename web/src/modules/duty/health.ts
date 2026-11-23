/**
 * DU-05①：页头 health chip 的纯推导。
 *
 * 词表以主仓 `apps/console/server.py` `_overview_summary` 真形制为准（只读核对，
 * 零改动）：healthStatus 不是独立健康端点，而是「本请求 fan-out 取数结果的汇总」
 * （全 ok=ok / 一路败=degraded），三路全败时根本没有 healthStatus——502
 * `console.upstream_unavailable`。duty 页同样没有独立健康读口（不臆造第二真源），
 * 所以 chip 只汇总**本页批次自己读到的腿**：读到什么画什么。
 *
 * 三态词表严格不混用（工单①红线）：
 * - 「读取失败」＝连接通了但取数失败（5xx/网络/形状）；
 * - 「未接入」＝来源没接这个口（404/503 + not_wired 信封，fetchKnowledgeProbe
 *   同一判定；knowledge 腿 wired:false 也算）——未接入不是失败，降级不数它；
 * - 「无权限」＝401/403（登录/授权层，归入降级清单但用「无权限」措辞）。
 * 缺读数画「—」＋原因，禁假 0。
 */
import type { DutyData, DutyLegKey } from "./useDutyData";
import type { Loadable } from "./types";

export type DutyHealthLevel = "ok" | "degraded" | "unwired" | "pending";

export interface DutyHealthView {
  level: DutyHealthLevel;
  /** 读取失败的腿名（含无权限——都属「这一轮没读到」，措辞各说各的）。 */
  failed: string[];
  /** 无权限（401/403）的腿名：降级清单里单独措辞，不写「失败」。 */
  denied: string[];
  /** 未接入的腿名（not_wired 形制）：绝不计入失败，也绝不叫「失败」。 */
  unwired: string[];
  /** 还没有回答的腿名。 */
  pending: string[];
  /** 回答齐了的腿名。 */
  ok: string[];
}

/**
 * 七族腿按页面卡区分组——分组名就是屏上列的「腿名」，与卡片标题对得上，
 * 用户拿名字能找到卡。budget/readiness 在目录失败时是错误透传腿，会随
 * 「成本账本/就绪证据」一起列名，这与 _overview 的逐源 reason 同形制。
 */
export const DUTY_HEALTH_FAMILIES: ReadonlyArray<{ name: string; keys: readonly DutyLegKey[] }> = [
  { name: "员工目录", keys: ["employees", "stats"] },
  { name: "运行统计", keys: ["todayStats", "stats14", "activity"] },
  { name: "成本账本", keys: ["budgetDay", "budgetMonth"] },
  { name: "待审队列", keys: ["approvalStats", "approvals"] },
  { name: "运行明细", keys: ["todayRuns", "recentRuns", "failedRuns"] },
  { name: "阻塞事项", keys: ["blockedTasks"] },
  { name: "就绪证据", keys: ["readiness"] },
];

interface FamilyVerdict {
  state: "ok" | "failed" | "denied" | "unwired" | "pending";
  hasUnwired: boolean;
}

function familyState(legs: readonly Loadable<unknown>[]): FamilyVerdict {
  // 优先级：失败 > 无权限 > 未接入 > 就绪 > 未回答。一族里只要有一路真失败，
  // 整族就欠一个回答；未接入不算欠（它本来就是「没有这个口」）。
  let hasDenied = false;
  let hasUnwired = false;
  let hasReady = false;
  let hasPending = false;
  for (const leg of legs) {
    if (leg.k === "loading") hasPending = true;
    else if (leg.k === "ready") hasReady = true;
    else if (leg.notWired) hasUnwired = true;
    else if (leg.status === 401 || leg.status === 403) hasDenied = true;
    else return { state: "failed", hasUnwired };
  }
  if (hasDenied) return { state: "denied", hasUnwired };
  if (hasUnwired && !hasReady && !hasPending) return { state: "unwired", hasUnwired: true };
  if (hasPending) return { state: "pending", hasUnwired };
  if (hasReady) return { state: "ok", hasUnwired };
  return { state: "unwired", hasUnwired: true };
}

export function deriveDutyHealth(data: DutyData): DutyHealthView {
  const view: DutyHealthView = { level: "pending", failed: [], denied: [], unwired: [], pending: [], ok: [] };
  let seen = 0;
  for (const family of DUTY_HEALTH_FAMILIES) {
    const legs = family.keys
      .map((key) => data[key] as Loadable<unknown> | undefined)
      .filter((leg): leg is Loadable<unknown> => leg !== undefined);
    if (legs.length === 0) continue;
    seen += 1;
    const { state, hasUnwired } = familyState(legs);
    if (state === "failed") view.failed.push(family.name);
    else if (state === "denied") view.denied.push(family.name);
    else if (state === "unwired") view.unwired.push(family.name);
    else if (state === "pending") view.pending.push(family.name);
    else view.ok.push(family.name);
    // 族已回答但其中一路是 not_wired：族算回答、单腿具名进「未接入」清单，
    // 绝不因此把 chip 报成降级或失败。
    if (hasUnwired && state !== "unwired" && !view.unwired.includes(family.name)) {
      view.unwired.push(family.name);
    }
  }
  // 就绪证据腿里的知识门：wired:false 是「未接入」的具名腿（fetchKnowledgeProbe
  // 把它归未接非失败，这里同一词表列名），不改变就绪证据族自身的态。
  if (
    data.readiness?.k === "ready" &&
    data.readiness.data.knowledge.k === "ready" &&
    !data.readiness.data.knowledge.data.wired
  ) {
    view.unwired.push("知识检索");
  }
  if (view.failed.length > 0 || view.denied.length > 0) view.level = "degraded";
  else if (view.pending.length > 0) view.level = "pending";
  else if (view.ok.length > 0) view.level = "ok";
  else if (seen === 0 || view.unwired.length > 0) view.level = "unwired";
  else view.level = "pending";
  return view;
}

/** chip 的一句话屏上文本。词表钉死：failed→「读取失败」，unwired→「未接入」。 */
export function healthChipText(view: DutyHealthView): string {
  switch (view.level) {
    case "ok":
      return "健康 正常 · 本页读取腿已全部回答";
    case "degraded": {
      const parts: string[] = [];
      if (view.failed.length > 0) parts.push(`${view.failed.join("、")} 读取失败`);
      if (view.denied.length > 0) parts.push(`${view.denied.join("、")} 无权限`);
      return `健康 降级 · ${parts.join("；")}`;
    }
    case "unwired":
      return `健康 未接入 · ${view.unwired.join("、")}`;
    case "pending":
      return "健康 —";
  }
}

/** chip 的 title：把三套词各归各的清单，谁也不借用谁的说法；缺读数的原因写全。 */
export function healthChipTitle(view: DutyHealthView): string {
  const parts: string[] = ["汇总本页各读取腿的回答，非独立健康端点"];
  if (view.failed.length > 0) parts.push(`读取失败：${view.failed.join("、")}`);
  if (view.denied.length > 0) parts.push(`无权限：${view.denied.join("、")}`);
  if (view.unwired.length > 0) parts.push(`未接入：${view.unwired.join("、")}`);
  if (view.pending.length > 0) parts.push(`未回答：${view.pending.join("、")}（还在读取）`);
  return parts.join(" · ");
}
