import { useEffect, useState } from "react";
import { Badge, Button } from "@nous-research/ui";
import { ConsoleCard } from "@/components/console/ConsoleCard";

import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { currentFixtureState, fixtureView, type FixtureState } from "../../shell/fixtures";
import { PILOT_ROW, PROBE_DEFINITIONS, probeResult, summarize, type ProbeRow, type ProbeStatus } from "./health";
import { EMPTY_KPI, readHealthKpi, type HealthKpi } from "./kpiRead";
import { SystemHealthSurface } from "./SystemHealthSurface";
import { PumpHeartbeat } from "./PumpHeartbeat";
import { SourceMatrix } from "./SourceMatrix";
import { SystemCaliberNotes } from "./SystemCaliberNotes";
import { SystemRefreshBar, useRefreshCoordinator } from "./systemRefresh";
import { beijingMinute } from "./systemHealth";
import {
  failureRead,
  markSourcesLoading,
  markSourcesSkipped,
  publishSourceRead,
  topLevelIsoAsOf,
} from "./sourceReads";
import "./health.css";

type State = { k: "loading" } | { k: "empty" } | { k: "error"; requestId: string } | { k: "ready"; rows: ProbeRow[] };

/** 骨架 health pane 的「维护操作」：五个写入口，全部是规划中占位（后端写接口未就绪）。 */
const MAINTENANCE_ACTIONS = [
  { label: "重启网关", tone: "danger" as const, note: "规划中：后端写接口未就绪" },
  { label: "重建知识索引", tone: "plain" as const, note: "接口已存在，待适配租户/版本/审批后开放" },
  { label: "创建检查点", tone: "plain" as const, note: "接口已存在，待适配租户/版本/审批后开放" },
  { label: "检查更新", tone: "plain" as const, note: "版本更新读口未接入，本页不提供检查" },
  { label: "清理归档数据", tone: "danger" as const, note: "规划中：后端写接口未就绪" },
];

/** 骨架 health pane 的「钩子」：四个运行钩子，启停状态没有读口。 */
const RUNTIME_HOOKS = [
  { name: "before_run", note: "注入预算与权限检查" },
  { name: "after_step", note: "写步骤时间线" },
  { name: "on_failure", note: "决定回退或报错" },
  { name: "on_approval", note: "审批通过后恢复运行" },
];

function fixtureState(value: FixtureState | null): State | null {
  if (value === "loading") return { k: "loading" };
  if (value === "empty") return { k: "empty" };
  if (value === "error") return { k: "error", requestId: "—（未收到响应，无请求号）" };
  return null;
}


function leavePreview(): void {
  if (typeof window === "undefined") return;
  const search = new URLSearchParams(window.location.search);
  search.delete("state");
  const hash = window.location.hash;
  const mark = hash.indexOf("?");
  let nextHash = hash;
  if (mark >= 0) {
    const params = new URLSearchParams(hash.slice(mark + 1));
    params.delete("state");
    const qs = params.toString();
    nextHash = hash.slice(0, mark) + (qs ? `?${qs}` : "");
  }
  window.history.replaceState({}, "", `${window.location.pathname}${search.toString() ? `?${search}` : ""}${nextHash}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function statusLabel(status: ProbeStatus): string {
  if (status === "healthy") return "正常";
  if (status === "error") return "异常";
  return "未知";
}

function statusTone(status: ProbeStatus): "success" | "destructive" | "warning" {
  if (status === "healthy") return "success";
  if (status === "error") return "destructive";
  return "warning";
}

function RowRequestId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(id).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };
  const short = id.length > 8 ? id.slice(0, 8) : id;
  return (
    <span className="hlt5-req" data-testid="hlt5-reqid">
      <span title={id} data-testid="hlt5-reqid-short">请求编号：{short}</span>
      <button
        type="button"
        aria-label="复制完整请求编号"
        className="hlt5-copy"
        onClick={copy}
      >
        {copied ? "已复制" : "复制"}
      </button>
    </span>
  );
}

function readRequestId(results: PromiseSettledResult<unknown>[]): string {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index];
    const reason = result?.status === "rejected" ? result.reason : null;
    if (reason instanceof ApiError && reason.requestId) return reason.requestId;
    if (reason && typeof reason === "object" && "requestId" in reason && typeof reason.requestId === "string" && reason.requestId) return reason.requestId;
  }
  return "—（未收到响应，无请求号）";
}

function Metric({ label, value, reason, testid }: { label: string; value: string; reason: string | null; testid: string }) {
  return (
    <div className="hlt5-metric">
      <dt>{label}</dt>
      <dd data-testid={testid} title={reason ?? undefined}>{value}</dd>
    </div>
  );
}

/**
 * 一格读数：11px 标签 + 大字 + 一行副行。缺读口时值就是「—」，
 * 缺口只由所在卡的可用性块声明一次，这里不再复述原因（副行留空）。
 */
function Kpi({
  label,
  value,
  detail,
  tone,
  testid,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "ok" | "warn" | "bad";
  testid: string;
}) {
  return (
    <div className="hlt5-kpi">
      <span className="hlt5-kpi-k">{label}</span>
      <b className={`hlt5-kpi-v${tone ? ` is-${tone}` : ""}`} data-testid={testid}>{value}</b>
      {detail ? <span className="hlt5-kpi-d" title={detail}>{detail}</span> : null}
    </div>
  );
}

export function HealthPage() {
  const [state, setState] = useState<State>({ k: "loading" });
  const [kpi, setKpi] = useState<HealthKpi>(EMPTY_KPI);
  const [slowestMs, setSlowestMs] = useState<number | null>(null);
  const refresh = useRefreshCoordinator(2);
  const forced = currentFixtureState();
  const preview = fixtureView<State | null>(forced ?? "ready", {
    loading: () => ({ k: "loading" }), empty: () => ({ k: "empty" }),
    error: () => ({ k: "error", requestId: "—（未收到响应，无请求号）" }), ready: () => null,
  });

  useEffect(() => {
    let alive = true;
    const probeIds = PROBE_DEFINITIONS.map((probe) => probe.id);
    const forcedState = fixtureState(forced);
    if (forcedState) {
      markSourcesSkipped(probeIds, "预览态不发起请求。");
      return () => { alive = false; };
    }
    const hadData = state.k === "ready" || state.k === "empty";
    if (!hadData) markSourcesLoading(probeIds);
    const run = async () => {
      const durations: Array<number | null> = [];
      const timed = PROBE_DEFINITIONS.map(async (probe, index) => {
        const started = performance.now();
        try {
          const value = await fetchJSON<unknown>(probe.path);
          durations[index] = Math.round(performance.now() - started);
          return value;
        } catch (error) {
          durations[index] = Math.round(performance.now() - started);
          throw error;
        }
      });
      const settled = await Promise.allSettled(timed);
      if (!alive) return;
      PROBE_DEFINITIONS.forEach((probe, index) => {
        const result = settled[index];
        const durationMs = durations[index] ?? null;
        if (result.status === "fulfilled") {
          publishSourceRead(probe.id, {
            status: "ok",
            statusReason: null,
            durationMs,
            durationReason: durationMs === null ? "没有记录到本次耗时。" : null,
            ...topLevelIsoAsOf(result.value),
            requestId: null,
          });
        } else {
          const read = failureRead(result.reason);
          publishSourceRead(probe.id, {
            ...read,
            durationMs,
            durationReason: durationMs === null ? read.durationReason : null,
          });
        }
      });
      // 顶部四格复用 runtime 那条探针已经拿到的 payload：本页的请求笔数不变。
      const measured = settled.map((_, index) => durations[index]).filter((ms): ms is number => typeof ms === "number");
      setSlowestMs(measured.length === 0 ? null : Math.max(...measured));
      const runtimeIndex = PROBE_DEFINITIONS.findIndex((probe) => probe.id === "runtime");
      const runtimeResult = runtimeIndex >= 0 ? settled[runtimeIndex] : undefined;
      setKpi(runtimeResult?.status === "fulfilled" ? readHealthKpi(runtimeResult.value) : EMPTY_KPI);
      const returnedAt = Date.now();
      const rows = PROBE_DEFINITIONS.map((probe, index) => probeResult(probe.id, settled[index] as PromiseSettledResult<unknown>, returnedAt));
      const allDown = settled.every((result) => result.status === "rejected" && result.reason instanceof ApiError && result.reason.status === 0);
      if (allDown) {
        const requestId = readRequestId(settled);
        if (!hadData) setState({ k: "error", requestId });
        if (refresh.tick > 0) refresh.finish({ message: "所有探针均未收到响应", requestId: requestId.startsWith("—") ? null : requestId });
      } else {
        setState({ k: "ready", rows: [...rows, PILOT_ROW] });
        if (refresh.tick > 0) refresh.finish(null);
      }
    };
    void run();
    return () => { alive = false; };
  }, [forced, refresh.tick, refresh.finish]);

  const view = preview ?? state;
  const retry = () => {
    if (forced) leavePreview();
    refresh.start();
  };
  const counts = view.k === "ready" ? summarize(view.rows) : { healthy: 0, error: 0, unknown: 0 };
  const total = view.k === "ready" ? view.rows.length : PROBE_DEFINITIONS.length + 1;
  const updatedAt = beijingMinute(kpi.asOf);

  // 副行只说这一屏真的数出来的东西：探针条数、三种结论的分布、刷新方式。
  const subline = view.k === "ready"
    ? `${total} 个探测项 · 正常 ${counts.healthy} · 异常 ${counts.error} · 未知 ${counts.unknown} · 手点刷新`
    : `${PROBE_DEFINITIONS.length} 个探测项 · 结论读取中 · 手点刷新`;

  const memoryValue = kpi.memoryPercent === null ? "—" : `${kpi.memoryPercent}%`;
  const memoryDetail = kpi.memoryUsedMb !== null && kpi.memoryTotalMb !== null
    ? `${kpi.memoryUsedMb} / ${kpi.memoryTotalMb} MB`
    : undefined;
  const gatewayDetail = kpi.agents === null
    ? undefined
    : `${kpi.agents} 个活跃运行 · 不含排期`;

  // 探针明细与读源矩阵是工程面，happy path 收进页底「读源与口径」折叠块：
  // 折叠时不上正文（骨架这一屏只有 KPI / 服务表 / 维护与钩子），
  // 出错态则直接摊开——读不出来时不把失败原因藏进折叠。
  const probeCard = (
    <ConsoleCard label="探针明细" action={<span className="hlt5-card-action">每条探针一行 · 手点刷新</span>} flush>
      {view.k === "loading" ? (
        <div className="hlt5-panel space-y-3" data-testid="hlt5-loading" aria-busy="true">
          <p className="text-sm text-white/55">正在检查服务…</p>
          {[1, 2, 3, 4].map((row) => <div key={row} className="hlt5-skeleton" />)}
        </div>
      ) : view.k === "empty" ? (
        <div className="hlt5-panel hlt5-panel--center" data-testid="hlt5-empty">
          <p className="text-sm text-white/80">探针未接入</p><p className="mt-2 text-xs text-white/50">请看接入说明。</p>
        </div>
      ) : view.k === "error" ? (
        <div className="hlt5-panel hlt5-panel--center flex flex-col items-center gap-3" data-testid="hlt5-error" role="alert">
          <p className="text-sm text-white/80">所有探针均未收到响应</p>
          {view.requestId.startsWith("—") ? (
            <p className="text-xs text-white/40">请求编号：未提供（这次没有收到可记录的请求编号）</p>
          ) : (
            <RowRequestId id={view.requestId} />
          )}
          <Button size="sm" outlined onClick={retry} data-testid="hlt5-retry">重试</Button>
        </div>
      ) : (
        <div data-testid="hlt5-list">
          {view.rows.map((row) => (
            <article key={row.id} title={row.detail ?? undefined} className="hlt5-row" data-testid={`hlt5-row-${row.id}`}>
              <div className="hlt5-main">
                <div className="hlt5-title">
                  <p>{row.name}</p>
                  <Badge tone={statusTone(row.status)} data-testid={`hlt5-status-${row.id}`}>{statusLabel(row.status)}</Badge>
                </div>
                {row.reason ? <p className="hlt5-reason">{row.reason}</p> : null}
                {row.requestId ? <div data-testid={`hlt5-reqid-${row.id}`}><RowRequestId id={row.requestId} /></div> : null}
              </div>
              <dl className="hlt5-meta">
                <Metric label="上次成功" value={row.lastSuccessAt ?? "—"} reason={row.lastSuccessReason} testid={`hlt5-last-success-${row.id}`} />
                <Metric label="上次失败" value={row.lastFailureAt ?? "—"} reason={row.lastFailureReason} testid={`hlt5-last-failure-${row.id}`} />
                <Metric label="连续成功" value={row.consecutiveSuccesses === null ? "—" : `${row.consecutiveSuccesses} 次`} reason={row.consecutiveReason} testid={`hlt5-streak-${row.id}`} />
                <Metric label="采集时间" value={row.asOf ?? "—"} reason={row.asOfReason} testid={`hlt5-asof-${row.id}`} />
              </dl>
            </article>
          ))}
        </div>
      )}
    </ConsoleCard>
  );

  return (
    <section className="hlt5-page" data-testid="hlt5-page">
      <header className="hlt5-head">
        <div className="min-w-0">
          <h2 className="hlt5-title" data-testid="hlt5-title">系统健康</h2>
          <p className="hlt5-sub" data-testid="hlt5-sub">{subline}</p>
        </div>
        <SystemRefreshBar coordinator={refresh} disabled={forced !== null} />
      </header>

      {/* 顶部四格照骨架（.g4 .kpi）：四块本身就是最外层，不再套卡。
          内存 / 检查点 / 更新 本环境没有读口：正文只留「—」，缺口在下面那条
          11px 口径行里点名一次，每格的具体原因只进悬停。 */}
      <div className="hlt5-kpis" data-testid="hlt5-kpis">
        <Kpi
          label="网关"
          testid="hlt5-kpi-gateway"
          value={kpi.gateway ?? "—"}
          tone={kpi.gateway === "在线" ? "ok" : kpi.gateway === null ? undefined : "warn"}
          detail={gatewayDetail}
        />
        <Kpi label="内存" testid="hlt5-kpi-memory" value={memoryValue} detail={memoryDetail} />
        <Kpi label="检查点" testid="hlt5-kpi-checkpoint" value="—" />
        <Kpi label="更新" testid="hlt5-kpi-update" value="—" />
      </div>

      <p
        className="hlt5-caliber"
        data-testid="hlt5-caliber"
        title="口径：探针=一次 HTTP 往返，延迟按浏览器侧计时；缺值不补 0、不估算，也不用本机时钟补采集时刻"
      >
        范围 本次读取 · 更新 {updatedAt ?? "未读到"}
        {slowestMs === null ? "" : ` · 最慢一条 ${slowestMs} ms`}
        {" · 对象 "}{total} 个探测项
        <span className="hlt5-caliber-gap" title="这三格没有读口：内存要运行时采样器，检查点要列表接口，更新要版本比对接口">
          {" · 无读口：内存 / 检查点 / 更新"}
        </span>
      </p>

      <ConsoleCard
        label="服务"
        action={<span className="hlt5-card-action">{state.k === "ready" ? "手点探测" : "手点刷新"}</span>}
        availability={[{
          label: "单服务延迟",
          reason: "健康读口只回状态与端口，不回每次握手耗时；行内「—」即此处开口",
        }]}
        flush
      >
        <SystemHealthSurface preview={forced && forced !== "ready" ? forced : null} onRetry={retry} refreshTick={refresh.tick} onRefreshResult={refresh.finish} hideRefresh />
      </ConsoleCard>

      <div className="hlt5-split">
        <ConsoleCard
          label="维护操作"
          action={<span className="hlt5-card-action">全部需管理员 · 二次确认</span>}
          availability={[{
            label: "维护写入口（重启 / 重建索引 / 检查点 / 更新 / 清理）",
            reason: "后端写接口未就绪，五个按钮都是占位；重启会中断进行中的运行",
          }]}
        >
          <div className="hlt5-ops">
            {MAINTENANCE_ACTIONS.map((action) => (
              <Button
                key={action.label}
                size="sm"
                outlined
                data-planned={action.note}
                aria-disabled="true"
                title={action.note}
                onClick={(event) => event.preventDefault()}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </ConsoleCard>

        <ConsoleCard
          label="钩子"
          action={<span className="hlt5-card-action">{RUNTIME_HOOKS.length} 个</span>}
          availability={[{
            label: "钩子启停状态",
            reason: "钩子注册表没有读口，四项的启用/停用读不出来",
          }]}
        >
          <ul className="hlt5-hooks">
            {RUNTIME_HOOKS.map((hook) => (
              <li key={hook.name} className="hlt5-hook">
                <span className="hlt5-hook-id">{hook.name}</span>
                <span className="hlt5-hook-note" title={hook.note}>{hook.note}</span>
              </li>
            ))}
          </ul>
        </ConsoleCard>
      </div>

      {/* 探针明细、读源矩阵与口径是工程面：读成功时收进页底折叠块（骨架这一屏
          只有 KPI / 服务表 / 维护与钩子）；探针读不出来时自动摊开——失败原因不藏。
          open 只在真失败时出现（React 对 open={false} 会写 open="false" 仍算开）。 */}
      <details className="hlt5-engine" data-testid="hlt5-engine" {...(view.k === "error" ? { open: true } : {})}>
        <summary className="hlt5-engine-summary">
          <span>读源与口径</span>
          <span className="hlt5-engine-meta">{total} 个探测项 · 读源矩阵 / 导出 / 口径</span>
        </summary>
        <div className="hlt5-engine-body">
          {probeCard}
          <PumpHeartbeat preview={forced && forced !== "ready" ? forced : null} refreshTick={refresh.tick} />
          <SourceMatrix />
          <SystemCaliberNotes />
        </div>
      </details>
    </section>
  );
}