// One derivation for every action on /capabilities. The read state decides all
// six entry points together, so a failed read cannot leave one control enabled
// while another is disabled. GAP and request ids appear only in the control's
// title; nothing here fetches, formats a clock or invents a row.

export type GatePhase = "loading" | "ready" | "empty" | "no-match" | "denied" | "error";

export interface GateInput {
  phase: GatePhase;
  reason?: string | null;
  requestId?: string | null;
  gap?: string | null;
  rowsLoaded: number;
  rowsVisible: number;
  hasQuery: boolean;
  partialCounts?: string | null;
}

export interface ActionGate {
  enabled: boolean;
  title: string;
  /** Shown beside export; empty for the other entries. */
  count: string;
}

export interface CapabilityGates {
  counts: ActionGate;
  search: ActionGate;
  export: ActionGate;
  copy: ActionGate;
  sort: ActionGate;
  rowDetail: ActionGate;
}

const EMPTY_EXPORT = "当前没有可导出的条目。";
const EMPTY_SEARCH = "当前没有可搜索的条目。";
const EMPTY_DETAIL = "当前没有可展开的行。";
const SORT_READY = "按列排序当前列表；排序只改屏上行序，不会重新取数。";
const COUNT_READY = "计数与当前列表来自同一次读取。";

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/[。；;]+$/, "").trim();
}

function blocked(input: GateInput): { enabled: false; title: string; count: string } {
  if (input.phase === "loading") {
    return { enabled: false, title: "正在读取当前列表；读取完成前这些操作不可用。", count: "—" };
  }
  if (input.phase === "denied") {
    const gap = input.gap ? `（${input.gap}）` : "";
    const detail = clean(input.reason).replace(/^(?:技能|工具)?读口未接入[：:]\s*/, "");
    return {
      enabled: false,
      title: `读口未接入：${detail}${gap}；请到审批中心提交开通申请。`,
      count: "—",
    };
  }
  return {
    enabled: false,
    title: `读取失败：${clean(input.reason)}；请求编号：${input.requestId ?? "未提供"}；请重试。`,
    count: "—",
  };
}

export function deriveGates(input: GateInput): CapabilityGates {
  const success = input.phase === "ready" || input.phase === "empty" || input.phase === "no-match";
  const stop = success ? null : blocked(input);
  const rows = success ? input.rowsVisible : 0;
  const countText = success ? `${rows} 条` : "—";

  const counts: ActionGate = (() => {
    if (!success) return stop!;
    if (input.partialCounts) {
      return { enabled: false, title: input.partialCounts, count: "—" };
    }
    return { enabled: true, title: COUNT_READY, count: "—" };
  })();

  const search: ActionGate = (() => {
    if (!success) return stop!;
    if (input.phase === "no-match") {
      return { enabled: true, title: "修改或清空搜索词以恢复列表。", count: "" };
    }
    if (input.phase === "empty") {
      return { enabled: false, title: EMPTY_SEARCH, count: "" };
    }
    const canSearch = input.rowsLoaded > 0 || input.hasQuery;
    return {
      enabled: canSearch,
      title: canSearch ? "按名称搜索当前清单；只在已经加载的行内筛选。" : EMPTY_SEARCH,
      count: "",
    };
  })();

  const exportGate: ActionGate = {
    enabled: success && rows > 0,
    title: success
      ? rows > 0
        ? `导出当前视图 ${rows} 条；顺序与搜索和排序一致。`
        : EMPTY_EXPORT
      : stop!.title,
    count: countText,
  };

  const copyGate: ActionGate = {
    enabled: success && rows > 0,
    title: success
      ? rows > 0
        ? "复制当前列表为纯文本；不会再发请求。"
        : EMPTY_EXPORT
      : stop!.title,
    count: countText,
  };

  const sort: ActionGate = success
    ? { enabled: true, title: SORT_READY, count: "" }
    : stop!;

  const rowDetail: ActionGate = success
    ? input.phase === "ready" && rows > 0
      ? { enabled: true, title: "展开该行详情；同一时刻只展开一行。", count: "" }
      : { enabled: false, title: EMPTY_DETAIL, count: "" }
    : stop!;

  return { counts, search, export: exportGate, copy: copyGate, sort, rowDetail };
}

/** Default for standalone component tests: a successful view over N rows. */
export function rowsGate(rows: number, action: "导出" | "复制" = "导出"): ActionGate {
  return rows > 0
    ? {
        enabled: true,
        title: action === "复制" ? "复制当前列表为纯文本；不会再发请求。" : "当前视图有可导出的行。",
        count: `${rows} 条`,
      }
    : { enabled: false, title: EMPTY_EXPORT, count: "0 条" };
}