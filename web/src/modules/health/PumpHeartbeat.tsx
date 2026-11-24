import { useEffect, useState } from "react";
import { Badge, Button } from "@nous-research/ui";
import {
  PUMP_GAP,
  PUMP_NOT_WIRED_TITLE,
  PUMP_STALE_MS,
  isPumpNotWired,
  loadPumpStatus,
  pumpFailureDetail,
  pumpVerdict,
  readPumpStatus,
  type PumpVerdict,
} from "./pumpStatus";
import { beijingMinute } from "./systemHealth";

/**
 * 出站 pump 心跳面（sysP）—— HealthPage 状态区里的一行。
 *
 * 三条纪律：
 * 1. 读不到就说读不到。只有 404 带结构化「没有这条路由 / 未接线」code 才写
 *    「pump 状态未接入」；500、超时、假 200 的 HTML 一律是「这次没读到」+ 单腿重试，
 *    既不冒充未接入，也不冒充正常。
 * 2. 绿色只能来自数据。没有可解析的 tick 就没有「正常」；读取在飞时整行不渲染，
 *    所以屏上不会出现 spinner 顶替结论，也不会出现空白当作答案。
 * 3. 不进读源矩阵（sys6）：矩阵的行集是四条既有读口的契约，pump 是本页第五腿，
 *    只在自己的行里说话，也不向刷新协调器报数（页级 busy 的笔数是契约）。
 */

/** `idle` = 还没有结论（在飞或预览态）：此时整行不渲染。 */
type PumpKind = PumpVerdict | "failed";

interface PumpView {
  kind: PumpKind;
  /** Beijing-minute rendering of the upstream tick; null when there is none. */
  moment: string | null;
  /** Upstream's own state word — side evidence for the tooltip, never a verdict. */
  state: string | null;
  /** Engineering context; title tooltip only. */
  detail: string;
}

interface PumpHeartbeatProps {
  preview?: "loading" | "empty" | "error" | null;
  refreshTick?: number;
}

const STALE_SECONDS = Math.round(PUMP_STALE_MS / 1000);

/** One table, one render path: every state is words + a tone, never a bare icon. */
const PRESENTATION: Record<PumpKind, {
  badge: string;
  tone: "success" | "warning" | "destructive" | "outline";
  line: (moment: string) => string;
  note: string | null;
  retry: boolean;
}> = {
  notWired: {
    badge: "未接入",
    tone: "outline",
    line: () => "出站 pump 状态未接入",
    note: "控制台还没有可读的 pump 心跳口；这里不猜它是活着还是停了。",
    retry: false,
  },
  alive: {
    badge: "正常",
    tone: "success",
    line: (moment) => `出站 pump 心跳正常 · 最近 tick ${moment}`,
    note: null,
    retry: false,
  },
  stale: {
    badge: "超期",
    tone: "destructive",
    line: (moment) => `出站 pump 超过 ${STALE_SECONDS} 秒未心跳 · 最近 tick ${moment}`,
    note: "最近一次 tick 已超出 90 秒：出站这一侧可能已经堆住，这里不给它绿色结论。",
    retry: false,
  },
  unknown: {
    badge: "未提供",
    tone: "outline",
    line: () => "出站 pump 没有给出心跳时刻",
    note: "接口答了，但没有可判活的最近 tick；没有时刻就不说它正常。",
    retry: false,
  },
  failed: {
    badge: "未读到",
    tone: "warning",
    line: () => "这次没读到 pump 状态",
    note: "只说明这一腿没读成功，不等于 pump 未接入，也不等于它停了。",
    retry: true,
  },
};

function wrapperTitle(view: PumpView): string | undefined {
  if (view.kind === "notWired") return `${PUMP_GAP} · ${PUMP_NOT_WIRED_TITLE}`;
  if (view.kind === "failed") return view.detail || undefined;
  return [view.detail, view.state ? `上游自报：${view.state}` : null].filter(Boolean).join(" · ") || undefined;
}

export function PumpHeartbeat({ preview = null, refreshTick = 0 }: PumpHeartbeatProps) {
  const [view, setView] = useState<PumpView | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    // 预览态是刻意造的模型：不碰网络，也不给结论。
    if (preview !== null) return;
    let live = true;
    const controller = new AbortController();
    void loadPumpStatus(controller.signal)
      .then((payload) => {
        if (!live) return;
        const status = readPumpStatus(payload);
        // 本机时钟只用来判「还有没有心跳」；上屏的时刻仍是上游写的那一个。
        const kind = pumpVerdict(status, Date.now());
        setView({
          kind,
          moment: beijingMinute(status.tickAt),
          state: status.state,
          detail: status.tickAt ? `上游原文：${status.tickAt}` : "响应里没有可解析的心跳时刻。",
        });
      })
      .catch((error: unknown) => {
        if (!live || controller.signal.aborted) return;
        setView(isPumpNotWired(error)
          ? { kind: "notWired", moment: null, state: null, detail: PUMP_NOT_WIRED_TITLE }
          : { kind: "failed", moment: null, state: null, detail: pumpFailureDetail(error) });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [preview, reload, refreshTick]);

  if (view === null) return null;

  const face = PRESENTATION[view.kind];
  return (
    <div
      className="sysP-pump text-xs"
      data-testid="sysP-pump"
      data-state={view.kind}
      title={wrapperTitle(view)}
    >
      <Badge tone={face.tone} data-testid="sysP-pump-badge">{face.badge}</Badge>
      <span className="sysP-pump-line" data-testid="sysP-pump-text">
        {face.line(view.moment ?? "—")}
      </span>
      {face.note ? <span className="sysP-pump-note">{face.note}</span> : null}
      {face.retry ? (
        <Button size="sm" outlined onClick={() => setReload((n) => n + 1)} data-testid="sysP-pump-retry">重试</Button>
      ) : null}
    </div>
  );
}
