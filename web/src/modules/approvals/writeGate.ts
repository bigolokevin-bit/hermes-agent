/**
 * AP-04 — 「能不能写」的合取判定单点（默认仍为关，本轮不开闸）。
 *
 * 前身（P0-1r, wave-126）：`DECISION_GATE` 是常量 `disabled: true`——L0 于 2026-11-21
 * 用终态单 ap_AEEC078E0C824E749513AFEC9A 实测 POST /agent-api/api/approval/decision?id=
 * → HTTP 405（服务端只允许 GET/HEAD）。批准/驳回若呈现可点，是「必然失败却不提示」的误导。
 * AP-04 把这个事实从硬编码升级为三个输入各自的证据腿，缺任一 ⇒ `disabled:true`，
 * 且**现有原因句原样保留**（batch.ts 的 writeOff 分支继续读同一句，禁第二套词汇）：
 *
 * 1. 服务端能力探测（`api.ts probeWriteDecisionRoute`，只对写路由发 OPTIONS 读侧方法）：
 *    405 console.read_only ⇒ 关；401 ⇒ 未鉴权；403 `approval.*` 专码 ⇒ 开且拒绝；
 *    其余（超时/502/不可达/2xx 代理替答）⇒ 未知。**探测失败/超时按关处理**（保守），
 *    「猜测成功」不是判据。
 * 2. 构建期前端旗标 `VITE_AGENT_APPROVAL_WRITE`（FRONTEND_WRITE_FLAG）：import 期
 *    读取一次、请求期不热读，默认值=关（见该处现状偏差注记）。
 * 3. AP-05＋AP-06 三负例证明（NEGATIVE_PROOFS_ACCEPTED）：工单 §三 硬门，源码常量，
 *    未附绿色输出原文进部署记录前恒 false——「开关开但未过 AP-05/AP-06 仍为关」
 *    的语义由它钉住。
 *
 * 这里取 runs 页 run5-retry-new 的同源形制：一个对象同时驱动 disabled / aria-disabled /
 * 人话原因，首帧即禁用，不拿用户的点击去撞 405（原因句不裸显服务端 code）。
 * send()、确认弹窗与 405 兜底路径原样保留，供写通道开闸的后代直接复用。
 *
 * 批量 P0 从本文件提取为模块内单点：逐单抽屉与批量条读同一个 DECISION_GATE，
 * 环境只读时两处禁用、两处同一句话，不再有第二套写开关词汇。
 */
import {
  PROBE_SOURCE,
  probeWriteDecisionRoute,
  type ProbeVerdict,
  type WriteProbeEvidence,
} from "./api";

/** 写通道关闭时的唯一句子（P0-1r 原句逐字保留；禁用态三属性、可见说明段与批量条同词）。 */
const READONLY_TITLE =
  "这个环境的控制台只读：实测决定提交一律被拒（服务端当前只允许读请求，写请求没有入口）。所以批准、驳回在这里以禁用态出现，点它不会发起任何请求；要处理这张单，请走它原本产生决定的渠道。";

/* ------------------------------------------------------------------ *
 * AP-04 ④ — 构建期前端旗标。
 *
 * 工单现状证据为实：`grep VITE_AGENT_APPROVAL_WRITE web/src` 在本 fork 命中 0，
 * 深度文档 §2.2 与记忆里的「前端开关」这一腿过去从未存在过（见 DONE-AP-04 偏差
 * 条目）。本轮按工单「若立项实现，走构建期常量、不热读」新建消费点：值在 import
 * 期读一次、固化进 bundle，改开关=重新构建（与 BFF 侧 CONSOLE_APPROVAL_WRITE_ENABLED
 * 的启动期纪律同形制，参谋裁定一·约束 A）。缺省、空串、"1" 之外一律为关——
 * **默认值不变=关**。
 * ------------------------------------------------------------------ */
export const FRONTEND_WRITE_FLAG: boolean = import.meta.env.VITE_AGENT_APPROVAL_WRITE === "1";

/* ------------------------------------------------------------------ *
 * AP-04 开闸硬门（工单 §三）：AP-05＋AP-06 三条负例（非审批人 403、缺 hash/形态
 * 非法折叠腿、幂等重放返回既有票）的绿色输出原文贴进部署记录之前，这条腿恒为
 * false。它不是「没人设的旗标」：DoD 的「开关开但未过 AP-05/AP-06 仍为关」由它
 * 在源码里成立，翻动它=开闸评估波改这一行并过审查门，前端运行时无法翻转。
 * ------------------------------------------------------------------ */
export const NEGATIVE_PROOFS_ACCEPTED = false;

export type WriteProbeState = "probing" | ProbeVerdict;

export interface WriteGateSnapshot {
  readonly state: WriteProbeState;
  /** 探测答复的真状态码；null = 没拿到答复（含未探）。只进 tooltip，不上屏。 */
  readonly status: number | null;
  /** 采集时刻（毫秒）；null = 未采集——屏上「—」＋原因，绝不拿当前时间冒充。 */
  readonly observedAt: number | null;
  /** 探测来源（method + path），未回话也带着——说清试的是哪张嘴。 */
  readonly source: string;
  /** 服务端腿：只有「开且拒绝」（403+approval.* 专码）为 true；未知/未鉴权/关/未探均 false。 */
  readonly serverOpen: boolean;
}

function snapshotOf(evidence: WriteProbeEvidence | null): WriteGateSnapshot {
  return {
    state: evidence === null ? "probing" : evidence.verdict,
    status: evidence?.status ?? null,
    observedAt: evidence?.observedAt ?? null,
    source: evidence?.source ?? PROBE_SOURCE,
    serverOpen: evidence?.verdict === "open-denied",
  };
}

let snapshot: WriteGateSnapshot = snapshotOf(null);
const listeners = new Set<() => void>();

/** 给 useSyncExternalStore 的稳定引用：只在探测落定时整体更换。 */
export function getWriteGateSnapshot(): WriteGateSnapshot {
  return snapshot;
}

export function subscribeWriteGate(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let probeRun: Promise<void> | null = null;

/**
 * 恰好探一次（幂等）：探测腿自身把一切失败收敛为 unknown、不抛不重试；
 * 结果写进快照后通知订阅者。页头 chip 挂载时调用，同一次加载不会有第二条探测。
 */
export function runWriteProbe(): Promise<void> {
  if (probeRun === null) {
    probeRun = probeWriteDecisionRoute().then((evidence) => {
      snapshot = snapshotOf(evidence);
      for (const listener of [...listeners]) listener();
    });
  }
  return probeRun;
}

/** 三输入合取的判据单点：缺任一 ⇒ disabled:true。消费端不得另写这条表达式。 */
function writeGateDisabled(): boolean {
  return !(snapshot.serverOpen && FRONTEND_WRITE_FLAG && NEGATIVE_PROOFS_ACCEPTED);
}

/**
 * 写门控单点。AP-04 起由常量改为活视图：每次读 disabled / title 都取当下合取
 * （batch.ts 在调用时读、页面在渲染时读，拿到的都是同一时刻的同一事实）。
 * 禁用时 title 即原句逐字；开态（本轮与本轮之后都不会到达）为空串——到达它
 * 需要 NEGATIVE_PROOFS_ACCEPTED 在源码被翻真，那属于开闸评估波，不在本道。
 */
export const DECISION_GATE: { readonly disabled: boolean; readonly title: string } = {
  get disabled(): boolean {
    return writeGateDisabled();
  },
  get title(): string {
    return writeGateDisabled() ? READONLY_TITLE : "";
  },
};

/* ------------------------------------------------------------------ *
 * AP-05 ① — 「动作指纹缺失」禁用原因（数据侧腿，单点措辞）。
 *
 * 总控裁定（2026-11-24，照实记入 DONE-AP-05）：工单步骤①假设决策钮可启用
 * （AP-04 形制），本轮未开闸，DECISION_GATE 一字不动、按钮三属性仍只读它；
 * 该腿落为「禁用原因列表里新增一条 hash 缺失原因」——由这条单的数据驱动，
 * 与 DECISION_GATE.title 同屏并存。开闸评估时，这句与人工门接成合取
 * （钮的 disabled = DECISION_GATE.disabled ∨ 本句命中），属 AP-04 后续波，
 * 不在本道改。
 *
 * 判据输入是详情读回的 `actionHash`（model.ts 读 actionHash/action_hash/
 * argsDigest 一族键，缺即 null）。现网实测（evidence/raw-detail-*.json，
 * 2026-11-24）：响应只带 argsDigest、恒有值 ⇒ 该句在现网恒不出现=诚实实态；
 * 禁为凑句造字段。缺字段显示「—」的呈现腿走 views.tsx 既有
 * apd5-field-action-hash（MISSING 原因位），本句管的是「为什么批不得」。
 * ------------------------------------------------------------------ */

export const ACTION_HASH_MISSING_REASON = "这张单没给出动作指纹，无法确认批的就是当前动作。";

/** 数据侧判据：详情响应没带回指纹族键 ⇒ 返回该句；带回 ⇒ null（不假报缺失）。 */
export function missingHashReasonFor(actionHash: string | null): string | null {
  return actionHash === null || actionHash.trim() === "" ? ACTION_HASH_MISSING_REASON : null;
}

/**
 * 禁用原因列表单点（按序）：写通道关闭句在前，数据侧指纹缺失句在后。
 * 消费点：决策区说明段逐条渲染；按钮 title 仍只读 DECISION_GATE.title
 * （AP-07② 同源契约不破，本函数不接线到钮上）。
 */
export function decisionBlockReasons(actionHash: string | null): string[] {
  const reasons: string[] = [];
  if (DECISION_GATE.disabled) reasons.push(DECISION_GATE.title);
  const missing = missingHashReasonFor(actionHash);
  if (missing) reasons.push(missing);
  return reasons;
}

/* ------------------------------------------------------------------ *
 * AP-04 ③ — 页头只读 chip 的读数单点（措辞全在这里，组件零字面量）。
 * 值=合取结果；来源=服务端探测腿＋构建旗标；时刻=探测真拿到答复的那一秒——
 * 缺数「—」＋原因句，绝不猜。
 * ------------------------------------------------------------------ */

export interface WriteGateChipReadout {
  /** 门控值：「关」/「开」。 */
  readonly gate: string;
  /** 服务端探测腿的人话档名（裸码不上屏：console.read_only 等永不出现）。 */
  readonly server: string;
  /** 构建期旗标档名。 */
  readonly flag: string;
  /**
   * 来源的屏面描述——**刻意不含路由字面量**：本页有钉死的「no path echo」契约
   * （ApprovalsPendingModulePage.test.tsx 对整页 innerHTML 验 /agent-api 不出现），
   * 完整路由留在数据层（PROBE_SOURCE）与 DONE/证据里，屏面只说人话。
   */
  readonly sourceLabel: string;
  /** 采集时刻（毫秒）；null ⇒ 屏上「—」。 */
  readonly asOfMs: number | null;
  /** 缺数原因句（进 tooltip）；有数时为空串。 */
  readonly missingReason: string;
}

const SERVER_LABEL: Record<WriteProbeState, string> = {
  probing: "探测未回",
  closed: "写路由未开",
  unauthenticated: "未鉴权（按关）",
  "open-denied": "已开且拒绝",
  unknown: "未知（按关）",
};

export function writeGateChipReadout(snap: WriteGateSnapshot = snapshot): WriteGateChipReadout {
  return {
    gate: writeGateDisabled() ? "关" : "开",
    server: SERVER_LABEL[snap.state],
    flag: FRONTEND_WRITE_FLAG ? "开" : "关",
    // 本页「no path echo」契约（整页 innerHTML 不含 /agent-api）优先于路由字面量上屏：
    // 屏面只说法形制，完整路由见 PROBE_SOURCE（数据层单点，DONE 与证据引用它）。
    sourceLabel: "对决定提交路由的 OPTIONS 只读探测",
    asOfMs: snap.observedAt,
    missingReason:
      snap.observedAt === null
        ? snap.state === "probing"
          ? "探测还没有回话，采集时刻不拿当前时间冒充。"
          : "探测没有拿到答复（超时/不可达/答复不可判），按关处理，没有采集时刻可言。"
        : "",
  };
}
