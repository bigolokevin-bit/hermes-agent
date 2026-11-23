/**
 * R72 — 审批面动作可用性矩阵（单点集中）。
 *
 * 六个入口（导出 CSV、行内展开、打开详情、列排序、汇总桶点选、重试/刷新）的
 * enabled/disabled 与 title 文案都由 actionGates(phase, rowCount) 一处派生；
 * 原因句只有 gateReason 一套措辞，组件不得再自算。
 */
import type { Phase } from "./useApprovalsData";

export interface Gate {
  enabled: boolean;
  title: string;
}

export interface ApprovalsGates {
  export: Gate;
  sort: Gate;
  toggle: Gate;
  detail: Gate;
  summary: Gate;
  retry: Gate;
}

/**
 * AP-07① — 本地过滤器「跨页需先加载」提示的单点措辞。
 *
 * 读口实测只有 status/limit/cursor 真发服务端（见 api.ts listUrl）；q/actor/since/
 * risk/排序全是「当前已加载行」上的本地过滤。服务端还给着下一页游标（hasMore）时，
 * 本地过滤的范围本身就还没到底，光说「已加载 n 条内」不够——必须再点一句「需先加载」，
 * 否则用户会以为筛完的就是全部。这里给唯一一句措辞，各过滤器接在同一句后头。
 * 返回空串＝没有下一页（到底/无游标），不追加任何假提示。
 */
export function crossPageLoadHint(hasMore: boolean): string {
  return hasMore
    ? "还有未加载的行不在本次过滤范围内：先点「加载更多」把它们取回来，才谈得上按这个条件筛全量。"
    : "";
}

export function gateReason(phase: Phase): string {
  switch (phase) {
    case "loading":
      return "正在读取列表";
    case "error":
      return "列表读取失败";
    case "denied":
      return "没有读取权限（或该面尚未开放）";
    case "empty":
      return "读口返回的是真实空集";
    default:
      return "";
  }
}

/**
 * R86 — 单点播报句：文本由 (phase, count) 派生而非存储，同一状态未变化时
 * DOM 文本不变，屏幕阅读器不会二次播报；快速切换只播最后一帧。请求编号
 * 留在卡片上可复制，不进播报文本。
 */
export function announcement(phase: Phase, count: number): string {
  switch (phase) {
    case "loading":
      return "";
    case "ready":
      return `已加载 ${count} 条`;
    case "empty":
      return "该条件下无审批";
    case "error":
      return `${gateReason("error")}，可复制请求编号重试`;
    case "denied":
      return `${gateReason("denied")}，暂时看不到审批列表。`;
    default:
      return "";
  }
}

export function actionGates(phase: Phase, rowCount: number): ApprovalsGates {
  const reason = gateReason(phase);
  const deny = (action: string, suffix = "；恢复列表后自动可用。"): Gate => ({
    enabled: false,
    title: `不能${action}：${reason}${suffix}`,
  });
  const go = (title: string): Gate => ({ enabled: true, title });
  if (phase === "loading") {
    return {
      export: deny("导出"),
      sort: deny("排序"),
      toggle: deny("行内展开"),
      detail: deny("打开详情"),
      summary: deny("点选状态桶"),
      retry: { enabled: false, title: `不能刷新：${reason}；这一轮读完成前重复点没有意义。` },
    };
  }
  if (phase === "error") {
    return {
      export: deny("导出"),
      sort: deny("排序"),
      toggle: deny("行内展开"),
      detail: deny("打开详情"),
      summary: deny("点选状态桶"),
      retry: go("重试读取：再向读口要一次。"),
    };
  }
  if (phase === "denied") {
    return {
      export: deny("导出"),
      sort: deny("排序"),
      toggle: deny("行内展开"),
      detail: deny("打开详情"),
      summary: deny("点选状态桶"),
      retry: { enabled: false, title: `不能刷新：${reason}；找管理员开通后这里才读得到列表。` },
    };
  }
  if (phase === "empty") {
    return {
      export: { enabled: false, title: `不能导出：${reason}，没有可导出的行；恢复列表后自动可用。` },
      // 真实空集不锁排序控件：排序态保留，刷新出数据后即刻可用。
      sort: go(`按当前已加载 ${rowCount} 条本地排序（空集下排序态保留，恢复数据后即可用）。`),
      toggle: { enabled: false, title: `不能行内展开：${reason}，没有可展开的行。` },
      detail: { enabled: false, title: `不能打开详情：${reason}，没有可打开的记录。` },
      summary: go("点击＝把该状态写进既有的 ?status= 筛选（刷新与分享可复现）。"),
      retry: go("重新向读口取一次（真实空集也值得刷新确认；这不是失败重试入口）。"),
    };
  }
  return {
    export:
      rowCount > 0
        ? go(`导出当前已显示的 ${rowCount} 行为 CSV（纯前端 Blob，零新后端端点；updated_at 用屏上同一值）。`)
        : { enabled: false, title: "当前没有可导出的审批：该条件下没有可导出的审批。" },
    sort: go(`按当前已加载的 ${rowCount} 条本地排序（非服务端排序，缺值的行恒排末）。`),
    toggle: go("就地展开预览（不跳转、不产生新请求；Esc 或再点收起）。"),
    detail: go("点开行主体打开详情（URL 写入 ?id=，粘贴链接可复现）。"),
    summary: go("点击＝把该状态写进既有的 ?status= 筛选（刷新与分享可复现）。"),
    retry: go("刷新列表：再向读口要一次。"),
  };
}
