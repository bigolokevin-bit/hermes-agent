import type { ReactNode } from "react";

/** Every /capabilities state branch reads its one sentence from here, so the
 * announced text can never drift between loading, empty, filtered-empty,
 * error, denied and login. R52/R53 OBS-4: the anchors used to be `sr-only`
 * spans sitting next to a duplicate visible paragraph — now the anchor itself
 * is the visible line and the duplicate is gone. */
export type StateAnchorKind = "loading" | "empty" | "filter-empty" | "error" | "denied" | "login";

export type StateAnchorInput = {
  kind: StateAnchorKind;
  /** Which read口 the anchor talks about, e.g. 技能 or 工具与 MCP 清单. */
  subject: string;
  /** Per-page heading. It stays inside the anchor text so the read口 name is
   * announced together with the state, not only in a tooltip. */
  heading?: string | null;
  /** Upstream reason sentence, or the search word for a filtered-empty list. */
  reason?: string | null;
  requestId?: string | null;
  /** Gap identifier for this read口. Title only — it must never reach visible
   * text, which the frozen `not.toContain("GAP-")` assertions enforce. */
  gap?: string | null;
  /** Rows already loaded; a filtered-empty list still has them. */
  loaded?: number | null;
};

export type StateAnchor = {
  /** Visible lead — the fixed sentence for this state. */
  lead: string;
  /** Visible continuation carrying heading / reason / 去处. */
  detail: string;
  /** Kept for the empty branch, whose second testid is frozen by R47 tests. */
  detailTestid: string | null;
  /** Tooltip: cause plus where to go next. */
  title: string;
};

const RETRY_AHEAD = "去处：点下方重试；持续失败的话，带上请求编号找运维道。";

export function stateAnchor(input: StateAnchorInput): StateAnchor {
  const heading = input.heading?.trim() ?? "";
  const reason = input.reason?.trim() ?? "";
  /** Upstream sentences already end in 「。」; the templates add their own, so strip it once here
   * instead of shipping 「…。。」 on screen. Only the reason slots use this — a search word keeps
   * its own characters inside 「」. */
  const reasonText = reason.replace(/[。；;.\s]+$/, "");
  const requestId = input.requestId?.trim() ?? "";
  const idText = `请求编号：${requestId || "未提供"}。`;
  const gap = input.gap?.trim() ?? "";
  const gapText = gap ? `缺口：${gap}。` : "";
  switch (input.kind) {
    case "loading":
      return {
        lead: `正在读取${input.subject}…`,
        detail: "",
        detailTestid: null,
        title: `原因：${input.subject}读口还没返回。${idText}去处：等读取完成，读完成前这里的空不算没有条目。`,
      };
    case "empty":
      return {
        lead: "这个读口已接入，但目前没有条目。",
        detail: `读口已接入，本次返回 0 条；${input.subject}没有返回任何条目，这里不补样例行。`,
        detailTestid: "capF-state-empty-text",
        title: `原因：读口通了、返回 0 条，不是读取失败。${idText}去处：在原生侧登记后点下方重新读取。`,
      };
    case "filter-empty": {
      const loaded = typeof input.loaded === "number" ? `已加载的 ${input.loaded} 项里` : "当前列表里";
      return {
        lead: "当前条件下没有匹配项。",
        detail: reason
          ? `${loaded}没有名称包含「${reason}」的条目。`
          : `${loaded}没有匹配的条目。`,
        detailTestid: null,
        title: `原因：搜索词只在已经加载的行内筛选，筛空不等于读口没有条目。去处：清空搜索词恢复完整列表。`,
      };
    }
    case "error":
      return {
        lead: "读取失败：",
        detail: `${heading || `读取${input.subject}`}${reason ? `。原因：${reasonText}` : ""}（可用下方重试）`,
        detailTestid: null,
        title: `原因：${heading || "读口没能返回"}。${gapText}${idText}${RETRY_AHEAD}`,
      };
    case "denied":
      return {
        lead: "无权读取这条数据。",
        detail: `${heading || `${input.subject}读口未接入`}${reason ? `。原因：${reasonText}` : ""}`,
        detailTestid: null,
        title: `原因：${reasonText || "当前账号拿不到这份数据"}。${gapText}${idText}去处：到审批中心提交开通申请，链接在下方；这里不显示猜测的行，也不补样例。`,
      };
    case "login":
      return {
        lead: "需要重新登录。",
        detail: `${heading || "登录状态已经失效"}。原因：${reasonText || "会话不再被接受"}`,
        detailTestid: null,
        title: `原因：${reasonText || "登录态失效"}。${gapText}${idText}去处：刷新页面重新登录后再回到这份清单。`,
      };
  }
}

/** The one visible anchor node every state branch renders. */
export function CapStateAnchor({
  testid,
  anchor,
  className,
}: {
  testid: string;
  anchor: StateAnchor;
  className?: string;
}): ReactNode {
  return (
    <p
      className={`capF-state-text${className ? ` ${className}` : ""}`}
      data-testid={testid}
      aria-live="polite"
      title={anchor.title}
    >
      {anchor.lead}
      {anchor.detail ? (
        <span data-testid={anchor.detailTestid ?? undefined} className="capF-state-detail">
          {anchor.detail}
        </span>
      ) : null}
    </p>
  );
}
