export type SettingState = "enabled" | "disabled" | "unknown" | "not-landed";
export type SwitchItem = { key: "approval" | "chat"; label: string; state: SettingState; reason: string };
export type UpstreamItem = { name: string; state: SettingState; reason: string };

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stateOf(value: unknown): SettingState {
  if (value === true || value === "enabled" || value === "on") return "enabled";
  if (value === false || value === "disabled" || value === "off") return "disabled";
  return "unknown";
}

export function readSettings(payload: unknown, unavailable = false): { switches: SwitchItem[]; upstreams: UpstreamItem[] } {
  const root = record(payload);
  const rawSwitches = record(root.writeSwitches);
  const unknownReason = "配置自检尚未接入，读取不到当前值";
  const landedReason = "来自当前配置（只读）";
  const reasonFor = (state: SettingState): string => {
    if (state === "not-landed") return "配置自检尚未接入，该项未启用";
    if (state === "unknown") return unknownReason;
    return landedReason;
  };
  const switches: SwitchItem[] = ([
    ["approval", "审批流变更提交"],
    ["chat", "会话发送"],
  ] as const).map(([key, label]) => {
    const state = unavailable ? "not-landed" : stateOf(rawSwitches[key]);
    return { key, label, state, reason: reasonFor(state) };
  });
  const upstreams: UpstreamItem[] = Array.isArray(root.upstreams)
    ? root.upstreams.map((value) => {
        const upstream = record(value);
        const state = stateOf(upstream.state);
        return {
          name: typeof upstream.name === "string" && upstream.name.trim() ? upstream.name : "—",
          state,
          reason:
            typeof upstream.reason === "string" && upstream.reason.trim()
              ? upstream.reason.trim()
              : reasonFor(state),
        };
      })
    : [];
  return { switches, upstreams };
}

export function statusLabel(state: SettingState): string {
  if (state === "enabled") return "已开启";
  if (state === "disabled") return "未开启";
  if (state === "not-landed") return "未启用";
  return "未知（本次未能读取）";
}

/* ------------------------------------------------------------------ *
 * 本环境实际生效的只读事实（`GET /agent-api/api/hermes-summary`）
 *
 * 2026-11-24：`/system?tab=defaults` 原先只有四行「未启用」，用户视角是
 * 空壳。默认设置的读口（`GET /api/config`）本环境确实没有注册（BFF 回
 * 404 console.unknown_route），所以**不造设置项、不放假开关**；改为把
 * 这台控制台此刻真实读得到的事实摊开：网关/平台/版本/连接/今日计数/
 * 数据源健康/采集时刻。缺哪个就说「—」和原因，绝不补 0、不猜值。
 * ------------------------------------------------------------------ */

export type FactRow = { key: string; label: string; value: string; reason: string | null };

export type RuntimeFacts = {
  /** loading = 还在读（不发假「没读到」）；unavailable = 读失败但如实说。 */
  phase: "loading" | "unavailable" | "ready";
  rows: FactRow[];
  /** 采集时刻（上游 updated_at），无法解析时为 null。 */
  collectedAt: string | null;
  note: string | null;
};

const ABSENT = (why: string): string => `—（${why}）`;

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** ISO 时刻 → 本机时区 `YYYY-MM-DD HH:mm:ss`；解析失败如实回 null。 */
export function fmtInstant(iso: unknown): string | null {
  const raw = text(iso);
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

function count(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-US")
    : ABSENT("上游未随回答发送");
}

function sourcesRow(sources: Record<string, unknown>): FactRow {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(sources)) {
    const entry = record(value);
    const state = text(entry.state) ?? "unknown";
    const reason = text(entry.reason);
    parts.push(reason ? `${name}=${state}（${reason}）` : `${name}=${state}`);
  }
  return parts.length
    ? { key: "sources", label: "数据源健康", value: parts.join(" · "), reason: null }
    : { key: "sources", label: "数据源健康", value: ABSENT("上游未随回答发送"), reason: null };
}

/**
 * 读 `runtime.hermes.summary.v1`。只搬运回答里的值，不推导、不补默认：
 * 缺字段就写「—」和原因，读不到（404/超时/形状不对）走 unavailable。
 */
export function readRuntimeFacts(payload: unknown): RuntimeFacts {
  const root = record(payload);
  const gateway = record(root.gateway);
  if (Object.keys(gateway).length === 0) {
    return { phase: "unavailable", rows: [], collectedAt: null, note: null };
  }
  const metrics = record(gateway.metrics_today);
  const platforms = record(gateway.platforms);
  const platformParts = Object.entries(platforms).map(([name, value]) => {
    const state = text(record(value).state) ?? "unknown";
    return `${name}=${state}`;
  });
  const version = text(gateway.version);
  const gatewayState = text(gateway.gateway_state);
  const status = text(gateway.status);
  const rows: FactRow[] = [
    {
      key: "gateway",
      label: "网关状态",
      value: gatewayState ?? ABSENT("上游未随回答发送"),
      reason: status ? `status=${status}` : null,
    },
    {
      key: "platform",
      label: "运行时",
      value: [text(gateway.platform), version && version !== "unknown" ? version : null]
        .filter((part): part is string => Boolean(part))
        .join(" · ") || ABSENT("上游未随回答发送"),
      reason: version === "unknown" ? "上游报版本为 unknown" : null,
    },
    {
      key: "platforms",
      label: "平台连接",
      value: platformParts.length ? platformParts.join(" · ") : ABSENT("上游未随回答发送"),
      reason: null,
    },
    {
      key: "metrics-today",
      label: "今日计数",
      value: Object.keys(metrics).length
        ? `请求 ${count(metrics.requests)} · 消息 ${count(metrics.messages)} · tokens ${count(metrics.tokens)}`
        : ABSENT("上游未随回答发送"),
      // 上游自己写明计数口径，照抄，不在前端改写成别的意思。
      reason: text(gateway.note),
    },
    sourcesRow(record(root.sources)),
  ];
  return {
    phase: "ready",
    rows,
    collectedAt: fmtInstant(gateway.updated_at),
    note: text(gateway.note),
  };
}
