/**
 * 批量 P0 — 待办页批量门控的单一事实源（B2 对勾表第 4 项缺口的接线处）。
 *
 * 三个纯函数只消费 model.ts 已解析的行字段（status / risk / binding.changeKind /
 * 剩余秒 / 审批人名单 / 本人票），不新增任何线上契约：字段缺了就是缺了，
 * 门控按「判不了就保守禁用」处置（2026-11-16 批量保守启用验收口径），绝不推断。
 * 每个非 ok 键固定配一条诚实文案，组件不得再自算原因句；writeOff 态整句复用
 * DECISION_GATE——逐单抽屉与批量条说的是同一个环境事实，同一句话的两个出口。
 */
import type { ApprovalRow } from "./model";
import { DECISION_GATE } from "./writeGate";

export type BatchGateKey =
  | "empty"
  | "writeOff"
  | "noKind"
  | "outbound"
  | "ended"
  | "notApprover"
  | "voted"
  | "ok";

export interface BatchGate {
  key: BatchGateKey;
  /** 批量钮的 title：非 ok 态是禁用原因句，ok 态说明这一批会怎么提交。 */
  title: string;
}

/** 既有词汇里的「对外发送」高风险变更类：model.ts CHANGE_KIND_LABEL 的 message_send。 */
const OUTBOUND_KINDS: readonly string[] = ["message_send"];
/** 既有 riskView 里的高风险档。参考件「删除」类在本域词汇表没有对应变更类型，不臆造 token。 */
const HIGH_RISKS: readonly string[] = ["high", "critical"];

const lower = (raw: string | null): string => raw?.trim().toLowerCase() ?? "";

export function isOutboundHighRisk(row: ApprovalRow): boolean {
  return OUTBOUND_KINDS.includes(lower(row.changeKind.raw)) || HIGH_RISKS.includes(lower(row.risk.raw));
}

/** 剩余秒判得了且 ≤0 才算到时；服务没给任何时间口径时不自行判死。 */
function isEnded(row: ApprovalRow): boolean {
  return !row.status.pending || (row.remainingSeconds !== null && row.remainingSeconds <= 0);
}

/**
 * 该行勾选框为什么禁用（null = 可勾选）。拦三类：没有单据标识（无法提交决定）、
 * 已终态（不能再改结论，词汇同抽屉「这张单已经是…」句）、高风险/对外发送类
 * （参考件口径：这类不可批量）。缺类型/已到时/非审批人/已投过不改勾选——
 * 它们由批量钮的门控句表达，保住「勾了也能看到为什么不行」的出口。
 */
export function batchCheckboxReason(row: ApprovalRow): string | null {
  if (row.rawId === null) return "这条记录没有给出可打开的单据标识，无法批量提交决定。";
  if (!row.status.pending) return `这张单已经是「${row.status.label}」，不能再在这里改结论，不参与批量。`;
  const kind = lower(row.changeKind.raw);
  if (OUTBOUND_KINDS.includes(kind)) return "高风险的「对外发送消息」类单据不可批量，请打开详情逐单处理。";
  if (HIGH_RISKS.includes(lower(row.risk.raw))) return `「${row.risk.label}」单据不可批量，请打开详情逐单处理。`;
  return null;
}

/**
 * 该行是否是「让批量区出现」的积极候选：可勾选之外还须类型明确、判得可决、
 * 与当前 actor（?actor= 既有口径）不冲突。队列里一条都没有时批量区整个不出现，
 * 不放一排永远点不动的死按钮。
 */
export function batchCandidate(row: ApprovalRow, actor: string | null): boolean {
  if (batchCheckboxReason(row) !== null) return false;
  if (row.changeKind.raw === null) return false;
  if (isEnded(row)) return false;
  if (actor !== null) {
    if (row.approverIds.length > 0 && !row.approverIds.includes(actor)) return false;
    if (row.decidedByIds.includes(actor)) return false;
  }
  return true;
}

export function batchGateKey(selected: readonly ApprovalRow[], actor: string | null): BatchGateKey {
  if (selected.length === 0) return "empty";
  if (DECISION_GATE.disabled) return "writeOff";
  if (selected.some((row) => row.changeKind.raw === null)) return "noKind";
  if (selected.some(isOutboundHighRisk)) return "outbound";
  if (selected.some(isEnded)) return "ended";
  if (actor !== null) {
    if (selected.some((row) => row.approverIds.length > 0 && !row.approverIds.includes(actor))) return "notApprover";
    if (selected.some((row) => row.decidedByIds.includes(actor))) return "voted";
  }
  return "ok";
}

export function batchGateCopy(key: BatchGateKey, count: number): string {
  switch (key) {
    case "empty":
      return "还没有勾选单据：先在队列里勾选要一起处理的行。";
    case "writeOff":
      // 与逐单抽屉同一句同源话：环境只读这一个事实，不换第二套词汇。
      return DECISION_GATE.title;
    case "noKind":
      return "选中的单里有没写明变更类型的：批量无法确认它是否可发，不做推断，请打开详情逐单处理。";
    case "outbound":
      return "选中的单里有高风险「对外发送消息」类的：这类单据不可批量，请取消勾选，打开详情逐单处理。";
    case "ended":
      return "选中的单里有已经处理过或已到时（期限已过）的：已经处理过的单不会被覆盖，请取消勾选这些单。";
    case "notApprover":
      return "选中的单里有审批人名单不包括你的：决定不会被接受，请取消勾选这些单，转给名单上的审批人。";
    case "voted":
      return "选中的单里有你已经投过票的：已经处理过的单不会被覆盖，请取消勾选这些单。";
    case "ok":
      return `逐单顺序提交选中的 ${count} 单：按列表顺序一单一发，任一单失败立即停止；已经处理过的单不会被覆盖。`;
  }
}

export function batchGate(selected: readonly ApprovalRow[], actor: string | null): BatchGate {
  const key = batchGateKey(selected, actor);
  return { key, title: batchGateCopy(key, selected.length) };
}
