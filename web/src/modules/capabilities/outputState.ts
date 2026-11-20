// Availability of the list's pure-view outputs (CSV export and text copy).
// The rows alone cannot tell "the read port is not wired" from "the port
// answered with zero rows", so each page passes its own read state here.
// GAP ids and request ids stay in the disabled control's title only.

export type CapabilityOutputState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "empty" }
  | { kind: "unavailable"; reason: string; gap: string }
  | { kind: "error"; reason: string; requestId: string | null };

function clean(reason: string): string {
  return reason.replace(/[。；;]+$/, "");
}

export function outputBlocked(state: CapabilityOutputState): boolean {
  return state.kind === "loading" || state.kind === "unavailable" || state.kind === "error";
}

export function outputCount(state: CapabilityOutputState, rows: number): string {
  return outputBlocked(state) ? "—" : `${rows} 条`;
}

export function outputTitle(state: CapabilityOutputState, action: "导出" | "复制", rows: number): string {
  if (state.kind === "loading") return `正在读取当前列表；读取完成后才能${action}。`;
  if (state.kind === "unavailable") {
    return `读口未接入：${clean(state.reason)}；请到审批中心提交开通申请（${state.gap}）。`;
  }
  if (state.kind === "error") {
    return `读取失败：${clean(state.reason)}；请求编号：${state.requestId ?? "未提供"}；重试成功后才能${action}。`;
  }
  if (rows === 0) return `当前视图没有可${action}的行`;
  return action === "导出"
    ? `导出当前视图 ${rows} 条`
    : "复制当前列表为纯文本；不会再发请求";
}