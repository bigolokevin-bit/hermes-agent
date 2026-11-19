/**
 * 平台接入 / 数据源 read — the four states, driven only by what the service said.
 *
 * One read cycle asks every source, so the 数据源 ledger and the platform rows
 * come from the same moment and cannot disagree with each other. There is no
 * fallback leg and no sample data anywhere: an earlier cut of this lane painted
 * fixture rows when a read failed, which made a broken environment look like
 * working platforms. A failure now reads as a failure.
 *
 * The effect never sets state synchronously. A read is stored against the
 * (attempt, filter) pair that asked for it, and anything that does not match
 * the current pair simply renders as loading — so changing the filter cannot
 * leave the previous answer on screen pretending to be the filtered one, and
 * 「重新读取」 really asks again.
 *
 * R32 fixture debt burn: the `?state=` repro leg was removed. Every state this
 * pane paints now comes from a real read; a missing or failed source degrades
 * to the honest panel, never to sample rows.
 */
import { useCallback, useEffect, useState } from "react";

import {
  readAll,
  settle,
  PENDING_RESULT,
  type ChannelsReadResult,
  type StatusFilter,
} from "./channels";

export interface ChannelsState extends ChannelsReadResult {
  reload: () => void;
}

/**
 * The filter arrives from the URL (the page owns it, so a link to
 * `?status=unavailable` opens the same view), and it is part of the key a read
 * is stored under: choosing a filter asks the service again instead of
 * repainting the previous answer.
 */
export function useChannelsData(filter: StatusFilter): ChannelsState {
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<{ attempt: number; filter: StatusFilter; settled: ChannelsReadResult } | null>(
    null,
  );

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let alive = true;
    const asked = attempt;
    const askedFilter = filter;
    void (async () => {
      const checkedAt = new Date();
      try {
        const settled = settle(await readAll(askedFilter), checkedAt);
        if (alive) setRead({ attempt: asked, filter: askedFilter, settled });
      } catch {
        // `readAll` folds every source's own failure into its outcome, so this
        // only ever catches a defect in this file. It reads as a failure —
        // never as an empty list, and never as sample rows.
        if (alive) {
          setRead({
            attempt: asked,
            filter: askedFilter,
            settled: {
              ...PENDING_RESULT,
              phase: "error",
              failure: { sentence: "读取平台接入与数据源时出了问题，请稍后重试。", requestId: null, technical: null },
            },
          });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt, filter]);

  const current = read !== null && read.attempt === attempt && read.filter === filter ? read.settled : PENDING_RESULT;
  return { ...current, reload };
}
