/**
 * AP-04 ③ — 页头写开关只读 chip（词汇单点在 writeGate.writeGateChipReadout，
 * 本组件零自算文案）。显示合取结果与两条来源＋采集时刻；缺数=「—」＋原因句
 * （tooltip），绝不猜。只读：不是按钮、不带 href、无 aria-live（它不是播报位，
 * apv-live 仍是本页唯一 live region）。
 *
 * 探测腿在挂载时恰好跑一次（runWriteProbe 幂等；探测只用 OPTIONS 读侧方法，
 * 永不发写——本轮零真写尝试红线由 api.probeWriteDecisionRoute 的请求形制钉死，
 * approvals.write.probe.test.tsx 以方法计数验收）。
 */
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import { plainMinute } from "./RelativeTime";
import {
  FRONTEND_WRITE_FLAG,
  getWriteGateSnapshot,
  runWriteProbe,
  subscribeWriteGate,
  writeGateChipReadout,
} from "./writeGate";

export function WriteGateChip(): ReactNode {
  const snap = useSyncExternalStore(subscribeWriteGate, getWriteGateSnapshot, getWriteGateSnapshot);
  useEffect(() => {
    void runWriteProbe();
  }, []);
  const readout = writeGateChipReadout(snap);
  const asOf = readout.asOfMs === null ? "—" : plainMinute(readout.asOfMs);
  const title = readout.missingReason
    ? `来源：${readout.sourceLabel}＋构建期旗标 VITE_AGENT_APPROVAL_WRITE=${FRONTEND_WRITE_FLAG ? "1" : "未设"}。${readout.missingReason}`
    : `来源：${readout.sourceLabel}＋构建期旗标 VITE_AGENT_APPROVAL_WRITE=${FRONTEND_WRITE_FLAG ? "1" : "未设"}；采集时刻为探测真拿到答复的北京时间读数。`;
  return (
    <span
      className="inline-flex h-6 items-center gap-1 rounded-md border border-white/15 px-2 text-xs text-muted-foreground"
      data-testid="apv-write-gate-chip"
      data-gate-state={readout.gate}
      data-probe-state={snap.state}
      data-flag-state={readout.flag}
      title={title}
    >
      写开关：{readout.gate} ｜ 服务端：{readout.server} ｜ 前端旗标：{readout.flag} ｜ 采集时刻：{asOf}
    </span>
  );
}
