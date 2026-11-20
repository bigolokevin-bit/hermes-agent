/**
 * 知识面复制/导出族的单点 gates（收成一处派生）。
 *
 * 规矩：每面（knI 空间列表 / knF 空间详情文档 / knG 全库文档名搜索 / knL 抽屉元信息）
 * 的复制入口、重试入口、导出类入口、计数位、状态句、兜底锚——同一个输入、同一张文案表、
 * 一次判出。页面侧只读这里的结果，不再持有各自的措辞分支（R62 的 copyBlockNotice /
 * blockedCopyReason 已收进来并删除）。
 *
 * 一致性硬约束：同一个面的失败绝不允许「一处 disabled、一处可点」；非 ready 时复制入口
 * 的 disabled/title、状态句「当前不可复制：<原因>」、计数位「—」、兜底不渲染全部同源。
 * 403 与 404 共用同一原因句（反枚举，与 knD/knN 口径一致）。
 *
 * 导出类入口：本模块历史上未提供过导出按钮，gates 表显式标 absent（git grep 核实），
 * 不借「统一」之名造新功能。
 */

export type GateSurfaceState = "loading" | "ready" | "error" | "unwired" | "denied" | "login";
export type GateFace = "knI" | "knF" | "knG" | "knL";
export type GateAct = "idle" | "copied" | "failed";

export interface GateInput {
  face: GateFace;
  /** 该面读口的当前状态。403→denied、404→unwired，两者对文案同权（同体）。 */
  state: GateSurfaceState;
  /** 当前可见行数（筛后/序后）。knL 传文档行是否已加载（1/0）：其复制可用性不看详情读态。 */
  rows: number;
  /** 该面当前生效的筛选/检索词（空串=没有筛）。 */
  filterText: string;
  /** knF 的筛空逐字句需要「筛前份数」。 */
  loadedTotal?: number;
}

export interface Gate {
  enabled: boolean;
  title: string;
  /** 禁用时的一句话原因（进「当前不可复制：<reason>」与 marker data-reason）。 */
  reason: string | null;
}

export interface EntryGates {
  copy: Gate;
  retry: Gate;
  /** 导出类入口：现在恒 absent，enabled 永 false；显式列出，不造功能。 */
  exportEntry: Gate;
  /** aria-live 状态句。 */
  status: string;
  /** 兜底 textarea 是否渲染（只有 enabled + failed 才渲染）。 */
  fallback: boolean;
  /** 计数位；knL 没有计数位。 */
  lines: { text: string; title?: string } | null;
}

const FAILED_TEXT = "复制失败，已展开可选文本，可手动复制";

/** 短原因表：403 与 404 同句；loading/error/login 各自一句。ready 无原因。 */
function blockedReasonByState(state: GateSurfaceState): string | null {
  switch (state) {
    case "loading":
      return "列表还在读取";
    case "unwired":
    case "denied":
      return "读口未接入或没有权限";
    case "error":
      return "这次读取没有成功";
    case "login":
      return "登录状态已经失效";
    default:
      return null;
  }
}

function retryGate(state: GateSurfaceState): Gate {
  const reason = blockedReasonByState(state);
  if (state === "loading") {
    return { enabled: false, title: "读取还没结束，先不用重试", reason };
  }
  if (reason !== null) {
    return { enabled: true, title: `重试这一次读取：${reason}`, reason };
  }
  return { enabled: false, title: "数据面正常，不需要重试", reason: null };
}

const NO_EXPORT: Gate = {
  enabled: false,
  title: "本面没有导出类入口（absent：历史上未提供，这里不新建）",
  reason: "导出入口不存在",
};

/** 各面文案表——所有句子都在这张表里生成，页面不留第二套分支。 */
const FACE_TABLE: Record<
  GateFace,
  {
    /** 禁用句主语名（knL 不用）。 */
    listName: string;
    /** 禁用句尾词：结果/内容。 */
    tail: string;
    /** 计数位单位；null=无计数位。 */
    unit: "行" | "条" | null;
    enabledTitle: string;
    copied: (rows: number) => string;
    zeroTitle: (filterText: string, loadedTotal: number) => string;
    zeroReason: (filterText: string) => string;
  }
> = {
  knI: {
    listName: "空间列表",
    tail: "内容",
    unit: "行",
    enabledTitle:
      "复制当前屏上的可见行：空间名 | 文档数 | 最近更新 | 短码。文本首行写明这份清单只覆盖已加载的空间，不冒充全库；屏上数据，不会再发请求。",
    copied: (rows) => `已复制 ${rows} 行`,
    zeroTitle: () => "当前没有可复制的空间",
    zeroReason: (f) => (f !== "" ? "筛选后没有留下的空间" : "这份回答里没有空间"),
  },
  knF: {
    listName: "文档列表",
    tail: "内容",
    unit: "行",
    enabledTitle:
      "复制当前排序与筛选后在屏幕上的这些行：文档名 | 类型 | 大小 | 更新。屏上数据，不会再发请求。",
    copied: () => "已复制",
    zeroTitle: (f, loaded) =>
      f !== ""
        ? `本地筛选没有留下行：这份列表里有 ${loaded} 份文档，按「${f}」一条都没留下。不编行，也就没有可复制的清单。`
        : "接口回答里没有文档：这份列表是空的。不编行，也就没有可复制的清单。",
    zeroReason: (f) => (f !== "" ? "筛选后没有留下的文档" : "这份回答里没有文档"),
  },
  knG: {
    listName: "文档列表",
    tail: "结果",
    unit: "条",
    enabledTitle: "复制当前检索词下的命中行：文档名 | 所属空间 | 类型 | 大小 | 更新。屏上数据，不会再发请求。",
    copied: (rows) => `已复制 ${rows} 条`,
    zeroTitle: () => "当前没有可复制的结果",
    zeroReason: (f) => (f !== "" ? "筛选后没有留下的文档" : "这份回答里没有文档"),
  },
  knL: {
    listName: "这条文档",
    tail: "内容",
    unit: null,
    enabledTitle:
      "复制这份文档在抽屉里的元信息：文档名、所属空间、类型、大小、更新、文档短码。屏上数据，不会再发请求。",
    copied: () => "已复制",
    zeroTitle: () => "这条文档不在已加载的列表里，抽屉里没有读到的元信息，没有可复制的内容。",
    zeroReason: () => "这条文档不在已加载的列表里",
  },
};

/** 非 ready 的禁用 title：一张表内按状态拼句（逐字保留 R62 落地时的句式）。 */
function blockedTitle(table: (typeof FACE_TABLE)[GateFace], state: GateSurfaceState): string {
  switch (state) {
    case "loading":
      return `${table.listName}还在读取，还没有可复制的${table.tail}。`;
    case "unwired":
    case "denied":
      return `${table.listName}没读到（读口未接入或没有权限），没有可复制的${table.tail}。`;
    case "error":
      return `这次没有读到${table.listName}，没有可复制的${table.tail}。`;
    case "login":
      return `登录状态已经失效，这次没有读到${table.listName}，没有可复制的${table.tail}。`;
    default:
      return table.zeroTitle("", 0);
  }
}

export function faceGates(input: GateInput, act: GateAct): EntryGates {
  const table = FACE_TABLE[input.face];
  // knL 的复制可用性只由「文档行是否已加载」决定：详情读口 404 不妨碍屏上列表字段被复制。
  const blocked = input.face === "knL" ? null : blockedReasonByState(input.state);
  let copy: Gate;
  if (blocked !== null) {
    copy = { enabled: false, title: blockedTitle(table, input.state), reason: blocked };
  } else if (input.rows <= 0) {
    copy = {
      enabled: false,
      title: table.zeroTitle(input.filterText, input.loadedTotal ?? 0),
      reason: table.zeroReason(input.filterText),
    };
  } else {
    copy = { enabled: true, title: table.enabledTitle, reason: null };
  }
  const status = !copy.enabled
    ? `当前不可复制：${copy.reason}`
    : act === "copied"
      ? table.copied(input.rows)
      : act === "failed"
        ? FAILED_TEXT
        : "";
  return {
    copy,
    retry: retryGate(input.state),
    exportEntry: NO_EXPORT,
    status,
    fallback: copy.enabled && act === "failed",
    lines:
      table.unit === null
        ? null
        : {
            text: copy.enabled ? `${input.rows} ${table.unit}` : "—",
            title: copy.enabled ? undefined : "没有可数条目时给「—」，不写 0 冒充空集。",
          },
  };
}

/** Surface 通用重试按钮的 title 同源句。 */
export function retryTitle(state: GateSurfaceState): string {
  return retryGate(state).title;
}
