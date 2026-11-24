/**
 * KPI 读数（骨架 health pane 的顶部四格）。
 *
 * 数据来源只有一处：本页三条探针里 `runtime` 那一条已经在打的
 * `/api/hermes-summary`。这里只把它「已经拿到的」payload 读成四格读数，
 * **不新开请求** —— HealthPage 的请求笔数是既有契约（多条测试按 4 笔断言）。
 *
 * 三条纪律：
 * 1. 拿不到就是 null，渲染成 `—`，不补 0、不拿浏览器时间顶替。
 * 2. 内存/检查点/更新在本环境没有读口时返回 null，并带上缺口声明键。
 * 3. 工程串（ISO、端口、内部键名）只进 title，不上屏。
 */

export interface HealthKpi {
  /** 网关结论字：在线 / 降级 / 离线 / null（没读到）。 */
  gateway: string | null;
  /** 网关副行的口径串（状态键 + 版本），missing 时 null。 */
  gatewayDetail: string | null;
  /** 进程内活跃运行数；null = 上游没给。 */
  agents: number | null;
  /** 内存百分比 / 已用 / 上限（MB）；三者同为 null 表示没有读口。 */
  memoryPercent: number | null;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  /** 上游顶层更新时刻（ISO）；null = 未提供。 */
  asOf: string | null;
}

export const EMPTY_KPI: HealthKpi = {
  gateway: null,
  gatewayDetail: null,
  agents: null,
  memoryPercent: null,
  memoryUsedMb: null,
  memoryTotalMb: null,
  asOf: null,
};

/** 检查点与版本更新没有读口，卡片自带缺口声明（禁编数字）。 */
export const KPI_GAP = {
  checkpoint: "检查点列表与占用：控制台还没有读口，本页不显示数量。",
  update: "版本更新检查：上游没有可用的更新读口，本页不显示可用版本。",
} as const;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function bytesToMb(value: number | null): number | null {
  if (value === null) return null;
  // 上游是字节；小于 1 MB 的余量按 1 位小数保留，不四舍五入成 0。
  return Math.round((value / 1024 / 1024) * 10) / 10;
}

/** 网关结论只由上游自己的状态字决定：ok + running 才说在线。 */
function gatewayWord(status: string | null, state: string | null): string | null {
  if (status === null && state === null) return null;
  if (status === "ok" && (state === null || state === "running")) return "在线";
  if (state === "running") return "在线";
  if (state === "draining" || state === "drainable") return "排空中";
  if (state === "stopped" || state === "down" || status === "down") return "离线";
  if (status === "degraded") return "降级";
  return null;
}

export function readHealthKpi(payload: unknown): HealthKpi {
  const root = record(payload);
  if (root === null) return { ...EMPTY_KPI };
  const gateway = record(root.gateway);
  const system = record(root.system);
  const memory = system ? record(system.memory) : null;

  const status = gateway ? str(gateway.status) : null;
  const state = gateway ? str(gateway.gateway_state) : null;
  const version = gateway ? str(gateway.version) : null;
  const word = gatewayWord(status, state);
  const detailParts = [state, version && version !== "unknown" ? version : null].filter(
    (part): part is string => part !== null,
  );

  const usedBytes = memory ? num(memory.used) : null;
  const totalBytes = memory ? num(memory.total) : null;
  const percent = memory ? num(memory.percent) : null;

  return {
    gateway: word,
    gatewayDetail: detailParts.length > 0 ? detailParts.join(" · ") : null,
    agents: gateway ? num(gateway.active_agents) : null,
    memoryPercent: percent,
    memoryUsedMb: bytesToMb(usedBytes),
    memoryTotalMb: bytesToMb(totalBytes),
    asOf: gateway ? str(gateway.updated_at) : null,
  };
}