/**
 * Duty page action gates — one derivation for every clickable action:
 * refresh, per-card retry, per-card request-id copy, and in-card links.
 *
 * The same failure must never leave one control disabled and another
 * clickable: every control asks this module, and every reason lives here.
 */
export interface DutyGate {
  enabled: boolean;
  /** Why it is not available, in one sentence a reader can act on. */
  title: string | null;
}

/**
 * DU-06①：刷新钮最小间隔（ms）。取值依据是现网真测量，不是拍脑袋：
 * 真 console BFF(8092) ＋ opsadmin 真登录腿，按 `collect()` 的形状跑完整批
 * （phase1 十路并发 + 目录依赖腿），n=5：热批 p50=37ms / max=41ms，
 * 冷启动首批 419ms，最慢单腿 396ms。窗口远高于「一批读完」所需时间，
 * 所以约束来自上游压力与「重复点拿不到新数据」，不是时延——沿用工单建议下限 5s。
 * 测量脚本与原始读数：`evidence/du06-measure.mjs` / `evidence/du06-measure.log`。
 */
export const DUTY_REFRESH_MIN_INTERVAL_MS = 5000;

/**
 * DU-06①：在飞原因句沿用 approvals `gates.ts:75` 的同词汇。
 * 那是跨模块字符串——AP-06 车道正在写 approvals，本车道既不 import 也不改它，
 * 只复制这一句。**单点约束**：本句与 approvals `gates.ts:75` 必须同措辞，
 * 将来收口成一处由板仓裁定（见 DONE-DU-06.md）。
 */
export const DUTY_REFRESH_INFLIGHT_REASON = "这一轮读完成前重复点没有意义";

const REFRESH_INTERVAL_SECONDS = Math.round(DUTY_REFRESH_MIN_INTERVAL_MS / 1000);

export interface DutyGatesInput {
  /** The first read is still running and nothing is on screen yet. */
  loading: boolean;
  /** A manual refresh batch is in flight; old numbers are still shown. */
  refreshing: boolean;
  /** Every block on the page failed in the same batch. */
  allFailed: boolean;
  /**
   * DU-06①：上一批已经读完，但距今还在 `DUTY_REFRESH_MIN_INTERVAL_MS` 窗口内。
   * 可选：旧调用（首读相）不必为节流相补参数。
   */
  cooling?: boolean;
}

export interface DutyGates {
  refresh: DutyGate;
  retry: DutyGate;
  copy: DutyGate;
  link: DutyGate;
}

const ALL: DutyGates = {
  refresh: { enabled: true, title: null },
  retry: { enabled: true, title: null },
  copy: { enabled: true, title: null },
  link: { enabled: true, title: null },
};

export function dutyGates(input: DutyGatesInput): DutyGates {
  const { loading, refreshing, allFailed, cooling } = input;

  // DU-06①：在飞与节流窗口内都 aria-disabled ＋原因句——按钮不靠「点了没反应」
  // 说话，而是说清为什么现在点没有意义。首读相仍是出路（DU-03 不变量）：那一批
  // 已经占住单飞锁，重复点不会叠第二批发（useDutyData 的 busyRef 兜住）。
  const refresh: DutyGate = refreshing
    ? { enabled: false, title: `不能刷新：这一批还在读；${DUTY_REFRESH_INFLIGHT_REASON}。` }
    : cooling
      ? {
          enabled: false,
          title: `不能刷新：这一批刚读完；${REFRESH_INTERVAL_SECONDS} 秒内再点一次读不到新数据，稍后再刷新。`,
        }
      : { enabled: true, title: null };

  // Retry belongs to a failed card. It is only held back while a refresh
  // batch is in flight — otherwise a single failed source can be re-read at once.
  const retry: DutyGate = refreshing
    ? { enabled: false, title: "更新中：正在刷新，这一批读完后再重试" }
    : { enabled: true, title: null };

  // Copy has nothing to copy before the first answer, is held back while a
  // batch is in flight, and is not offered when the whole page failed: the
  // recovery path there is one refresh, and the number stays readable.
  const copy: DutyGate = loading
    ? { enabled: false, title: "还在读取，暂时没有可复制的请求编号" }
    : refreshing
      ? { enabled: false, title: "更新中：正在刷新，等这一批读完再复制请求编号" }
      : allFailed
        ? { enabled: false, title: "整页都没有读出来，先重取这一批；编号仍在卡上可见" }
        : { enabled: true, title: null };

  // Links only navigate; nothing on this read-only page blocks them.
  const link: DutyGate = { enabled: true, title: null };

  return { refresh, retry, copy, link };
}

export const DUTY_GATES_OPEN: DutyGates = ALL;