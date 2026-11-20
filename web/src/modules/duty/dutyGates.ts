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

export interface DutyGatesInput {
  /** The first read is still running and nothing is on screen yet. */
  loading: boolean;
  /** A manual refresh batch is in flight; old numbers are still shown. */
  refreshing: boolean;
  /** Every block on the page failed in the same batch. */
  allFailed: boolean;
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
  const { loading, refreshing, allFailed } = input;

  // Refresh is always the way back: it stays clickable during loading and
  // during its own batch (the handler swallows a second press synchronously).
  const refresh: DutyGate = refreshing
    ? { enabled: true, title: "这一批还在读，按钮不会重复发请求" }
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