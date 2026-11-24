/* ------------------------------------------------------------------ *
 * 默认设置（`/system?tab=defaults`）——骨架形制的只读表单数据层。
 *
 * 骨架是一张可编辑配置表单（时区下拉 / 并发输入 / 保存按钮 / 17 卡），
 * 本环境 BFF 只读（`POST /api/config` → 405），所以这里**只搬运真实读到
 * 的值**、控件一律 disabled 骨架化：
 *   - `/api/hermes-summary`  → 运行时（平台 / 版本 / 网关 / 活动员工）
 *   - `/api/health/sources`  → 服务与端口（真实端口与连通态）
 *   - 其余配置项本环境无读口   → 值写「未读到」，控制形状保留，卡底声明一次
 *
 * 纪律：缺值不补 0、不估算、不猜默认；工程枚举（hermes-agent / running /
 * ok）一律转人话，原始键值只进 title。
 * ------------------------------------------------------------------ */

export type FieldKind = "select" | "input" | "switch";

export type FieldSpec = {
  key: string;
  /** 行左的字段名（13px）。 */
  label: string;
  kind: FieldKind;
  /** 控件里显示的当前值（只读）；缺读口时为「未读到」。 */
  value: string;
  /** select 的选项；缺读口时只有「未读到」一项。 */
  options?: string[];
  /** switch 的当前状态；缺读口时 false 不代表关闭。 */
  checked?: boolean;
  /** 行下 12px 弱色说明（骨架字段说明 / 口径）。 */
  hint?: string;
  /** 该行是否接了真读口。 */
  real?: boolean;
};

export type BlockSpec = {
  id: string;
  /** 卡头小标题。 */
  label: string;
  /** 卡头右端微读数。 */
  meta: string;
  fields: FieldSpec[];
  /** 缺读口只在卡底声明一次。 */
  availability?: { label: string; reason?: string }[];
  note: string;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

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

/* ------------------------------------------------------------------ *
 * 运行时摘要（`GET /agent-api/api/hermes-summary`）
 * ------------------------------------------------------------------ */

export type RuntimeFacts = {
  /** loading = 还在读；unavailable = 读失败但如实说；ready = 读到。 */
  phase: "loading" | "unavailable" | "ready";
  /** 字段 → 屏上人话值；缺键即「未读到」。 */
  values: Record<string, string>;
  collectedAt: string | null;
};

const PLATFORM_LABELS: Record<string, string> = {
  "hermes-agent": "Hermes 运行时",
};
const GATEWAY_LABELS: Record<string, string> = {
  running: "运行中",
  draining: "排空中",
  stopped: "已停止",
};
const STATUS_LABELS: Record<string, string> = {
  ok: "正常",
  degraded: "降级",
  connected: "已连接",
  disconnected: "已断开",
};

const human = (map: Record<string, string>, value: string | null): string | null =>
  value ? map[value] ?? null : null;

/**
 * 只搬运运行时摘要里的值，不推导、不补默认：
 * 缺字段不建档（渲染成「未读到」），工程枚举翻成人话。
 */
export function readRuntimeFacts(payload: unknown): RuntimeFacts {
  const root = record(payload);
  const gateway = record(root.gateway);
  if (Object.keys(gateway).length === 0) {
    return { phase: "unavailable", values: {}, collectedAt: null };
  }
  const values: Record<string, string> = {};
  const platform = human(PLATFORM_LABELS, text(gateway.platform));
  if (platform) values.platform = platform;
  const version = text(gateway.version);
  if (version && version !== "unknown") values.version = version;
  const gatewayState = human(GATEWAY_LABELS, text(gateway.gateway_state));
  if (gatewayState) values.gateway = gatewayState;
  const status = human(STATUS_LABELS, text(gateway.status));
  if (status) values.status = status;
  if (typeof gateway.active_agents === "number" && Number.isFinite(gateway.active_agents)) {
    values.active = String(gateway.active_agents);
  }
  return { phase: "ready", values, collectedAt: fmtInstant(gateway.updated_at) };
}

/* ------------------------------------------------------------------ *
 * 服务探测（`GET /agent-api/api/health/sources`）
 * ------------------------------------------------------------------ */

export type SourceRow = { id: string; name: string; port: string; state: string };
export type SourcesFacts = {
  phase: "loading" | "unavailable" | "ready";
  rows: SourceRow[];
  collectedAt: string | null;
};

/** 已知服务的屏上人话名（上游 id 是工程键，不上屏）。 */
export const SOURCE_NAMES: Record<string, string> = {
  console: "控制台服务",
  runtime: "Hermes 运行时",
  bisheng: "毕升知识库",
};
const SOURCE_ORDER = ["console", "runtime", "bisheng"] as const;

const SOURCE_STATE: Record<string, string> = {
  ok: "正常",
  down: "探测失败",
  degraded: "降级",
};
const sourceState = (value: string | null): string => (value ? SOURCE_STATE[value] ?? "未读到" : "未读到");

export function readSourcePorts(payload: unknown): SourcesFacts {
  const root = record(payload);
  const list = Array.isArray(root.sources) ? root.sources : [];
  if (list.length === 0) {
    return { phase: "unavailable", rows: [], collectedAt: null };
  }
  const rows: SourceRow[] = list.map((value, index) => {
    const entry = record(value);
    const id = text(entry.id) ?? `source-${index}`;
    return {
      id,
      name: SOURCE_NAMES[id] ?? "其他服务",
      port: text(entry.port) ?? "未读到",
      state: sourceState(text(entry.state)),
    };
  });
  const rank = (id: string): number => {
    const at = SOURCE_ORDER.indexOf(id as (typeof SOURCE_ORDER)[number]);
    return at < 0 ? SOURCE_ORDER.length : at;
  };
  rows.sort((a, b) => rank(a.id) - rank(b.id));
  return { phase: "ready", rows, collectedAt: fmtInstant(root.asOf) };
}

/* ------------------------------------------------------------------ *
 * 卡片装配
 * ------------------------------------------------------------------ */

const noRead = (key: string, label: string, kind: FieldKind, hint?: string): FieldSpec => {
  if (kind === "switch") {
    return {
      key,
      label,
      kind,
      value: "未读到",
      checked: false,
      hint: hint ? `${hint} · 当前值未读到` : "当前值未读到（不代表关闭）",
      real: false,
    };
  }
  return {
    key,
    label,
    kind,
    value: "未读到",
    options: kind === "select" ? ["未读到"] : undefined,
    hint,
    real: false,
  };
};

export function buildBlocks(runtime: RuntimeFacts, sources: SourcesFacts): BlockSpec[] {
  const v = runtime.values;
  // 读取中不下「未读到」的结论：读口 8 秒才回来，先喊没读到就是假话。
  const runtimePending = runtime.phase === "loading";
  const sourcesPending = sources.phase === "loading";
  const runtimeValue = (value: string | undefined): string =>
    value ?? (runtimePending ? "读取中…" : "未读到");

  const runtimeFields: FieldSpec[] = [
    { key: "runtime-platform", label: "平台", kind: "input", value: runtimeValue(v.platform), hint: "来自运行时摘要", real: Boolean(v.platform) },
    { key: "runtime-version", label: "版本", kind: "input", value: runtimeValue(v.version), hint: v.version ? "取自运行时摘要" : "上游未给出可用版本", real: Boolean(v.version) },
    { key: "runtime-gateway", label: "网关状态", kind: "input", value: runtimeValue(v.gateway), real: Boolean(v.gateway) },
    { key: "runtime-status", label: "运行状态", kind: "input", value: runtimeValue(v.status), real: Boolean(v.status) },
    { key: "runtime-active", label: "活动员工", kind: "input", value: runtimeValue(v.active), hint: "当前活动员工数，缺值不补 0", real: Boolean(v.active) },
  ];

  const sourceFields: FieldSpec[] = SOURCE_ORDER.map((id) => {
    const row = sources.phase === "ready" ? sources.rows.find((entry) => entry.id === id) : undefined;
    return {
      key: `source-${id}`,
      label: SOURCE_NAMES[id]!,
      kind: "input",
      value: row ? `${row.port} · ${row.state}` : sourcesPending ? "读取中…" : "未读到",
      real: Boolean(row),
    };
  });

  return [
    {
      id: "runtime",
      label: "运行时",
      meta: "读取自运行时摘要",
      fields: runtimeFields,
      availability:
        runtime.phase === "unavailable"
          ? [{ label: "运行时摘要", reason: "本次未读到，不代表 0 或停止" }]
          : undefined,
      note:
        runtime.phase === "loading"
          ? "来源：运行时摘要；正在读取…"
          : runtime.collectedAt
            ? `采集于 ${runtime.collectedAt} · 来源：运行时摘要，缺值按缺口标注`
            : "来源：运行时摘要；本次未读到，缺值按缺口标注，不补 0、不估算",
    },
    {
      id: "schedule",
      label: "调度与并发",
      meta: "全局调度器",
      fields: [
        noRead("sched-concurrency", "最大并发运行", "input"),
        noRead("sched-timeout", "单次运行超时", "input"),
        noRead("sched-interval", "最小间隔", "input"),
        noRead("sched-miss", "错过触发策略", "select", "合并为一次 / 逐次补跑 / 跳过"),
        noRead("sched-retry", "失败重试", "input"),
      ],
      availability: [{ label: "调度默认值", reason: "配置值当前不可读，不显示并发 / 超时 / 重试的当前值" }],
      note: "只读：本版本写入口未开放；当前值未读到，不按默认值填充。",
    },
    {
      id: "retrieval",
      label: "知识检索",
      meta: "默认值，可按员工覆盖",
      fields: [
        noRead("ret-topk", "默认 Top-K", "input"),
        noRead("ret-score", "最低相关度", "input"),
        noRead("ret-chunk", "切分长度", "input"),
        noRead("ret-overlap", "重叠", "input"),
        noRead("ret-cite", "强制带引用", "switch", "无引用的答案标记为「未证实」"),
      ],
      availability: [{ label: "检索默认值", reason: "配置值当前不可读，不显示 Top-K / 相关度 / 切分参数" }],
      note: "只读：本版本写入口未开放；缺值按缺口标注。",
    },
    {
      id: "models",
      label: "模型默认",
      meta: "按员工覆盖优先",
      fields: [
        noRead("model-text", "默认文本模型", "select"),
        noRead("model-embed", "默认嵌入模型", "select"),
        noRead("model-fallback", "回退链", "select"),
        noRead("model-degrade", "自动降级并继续任务", "switch", "模型不可用时按回退链切换"),
      ],
      availability: [
        { label: "模型默认与回退链", reason: "配置值当前不可读" },
        { label: "模型价目", reason: "价目当前不可读，不显示单价与额度" },
      ],
      note: "只读：本版本写入口未开放；默认模型与价目均未读到。",
    },
    {
      id: "notify",
      label: "通知与界面",
      meta: "控制台",
      fields: [
        noRead("notify-density", "默认密度", "select", "紧凑 / 舒适"),
        noRead("notify-timefmt", "时间格式", "select", "24 小时 / 12 小时"),
        noRead("notify-sla", "审批超时提醒", "switch", "超过 SLA 一半时提醒一次"),
        noRead("notify-digest", "每日摘要", "switch", "09:00 发到值班群"),
      ],
      availability: [{ label: "通知与界面默认值", reason: "配置值当前不可读" }],
      note: "只读：本版本写入口未开放；当前值未读到。",
    },
    {
      id: "network",
      label: "网络与出站",
      meta: "门禁联动",
      fields: [
        noRead("net-egress", "出站模式", "select", "白名单 / 全部阻断 / 全部允许"),
        noRead("net-proxy", "代理", "input"),
        noRead("net-log", "记录全部出站请求", "switch", "含被拒绝的，用于排查"),
        noRead("net-window", "维护窗口", "input"),
      ],
      availability: [{ label: "出站与代理", reason: "配置值当前不可读，不显示代理地址与出站模式" }],
      note: "只读：本版本写入口未开放；缺值按缺口标注。",
    },
    {
      id: "services",
      label: "服务与端口",
      meta: "2 秒连通探测",
      fields: sourceFields,
      availability:
        sources.phase === "unavailable"
          ? [{ label: "服务探测", reason: "本次未读到，不代表服务停止" }]
          : undefined,
      note:
        sourcesPending
          ? "来源：服务探测；正在读取…"
          : sources.phase === "ready"
            ? "来源：服务探测；浅探针非深健康检查，探测口径为 2 秒连通。"
            : "来源：服务探测；本次未读到，不补 0。",
    },
    {
      id: "keys",
      label: "密钥库",
      meta: "只写不读",
      fields: [
        noRead("key-providers", "已配置供应商", "input"),
        noRead("key-store", "密钥库", "select", "AES-256 加密存储"),
        noRead("key-last", "最近轮换", "input"),
        noRead("key-cycle", "轮换周期", "input", "建议 90 天"),
      ],
      availability: [{ label: "供应商与密钥状态", reason: "密钥只写不读，本页不显示明文、长度或指纹" }],
      note: "只读：密钥只写不读；任何「查看明文」的请求都会被拒绝，这是设计，不是权限不足。",
    },
    {
      id: "checkpoints",
      label: "检查点",
      meta: "每 2 小时自动",
      fields: [
        noRead("cp-keep", "保留数量", "input", "保留最近 20 个，超出自动清理"),
        noRead("cp-auto", "自动检查点", "switch", "每 2 小时自动"),
        noRead("cp-last", "最近检查点", "input"),
        noRead("cp-size", "占用容量", "input"),
      ],
      availability: [{ label: "检查点列表与占用", reason: "检查点当前不可读，不显示快照数量、大小与耗时" }],
      note: "只读：本版本写入口未开放；检查点不含会话与运行日志。",
    },
    {
      id: "storage",
      label: "存储与校验",
      meta: "检查点占用",
      fields: [
        noRead("st-used", "当前占用", "input"),
        noRead("st-limit", "存储上限", "input"),
        noRead("st-verify", "最近校验", "select", "校验通过 / 校验失败"),
        noRead("st-manual", "手动快照", "switch", "升级前建议手动快照"),
      ],
      availability: [
        { label: "存储占用", reason: "存储占用当前不可读，不显示已用 / 上限" },
        { label: "快照校验", reason: "校验结果当前不可读，不显示校验结果与耗时" },
      ],
      note: "只读：本版本写入口未开放；占用量未读到。",
    },
    {
      id: "approval",
      label: "审批链",
      meta: "只读摘要",
      fields: [
        noRead("ap-chain", "默认审批链", "select"),
        noRead("ap-lead", "直属上级 SLA", "input"),
        noRead("ap-security", "安全复核 SLA", "input"),
        noRead("ap-escalate", "超时自动升级", "switch", "超时升级，不静默通过"),
      ],
      availability: [{ label: "审批链与 SLA", reason: "审批链路当前不可读，不显示链路与时长" }],
      note: "只读：本版本写入口未开放；审批链不在此页修改。",
    },
    {
      id: "rules",
      label: "自动通过规则",
      meta: "按优先级自上而下匹配",
      fields: [
        noRead("rule-small", "小额工具调用", "select", "自动通过 / 人工"),
        noRead("rule-read", "只读知识检索", "select", "自动通过 / 人工"),
        noRead("rule-send", "对外发送", "select", "人工，不可跳过"),
        noRead("rule-delete", "删除与覆盖", "select", "双人复核"),
      ],
      availability: [{ label: "自动通过规则与命中数", reason: "规则当前不可读，不显示条件与近 7 天命中" }],
      note: "只读：本版本写入口未开放；策略改动无法撤销，只能新增版本回滚。",
    },
    {
      id: "hooks",
      label: "钩子",
      meta: "运行时钩子",
      fields: [
        noRead("hook-before", "运行前检查", "switch", "注入预算与权限检查"),
        noRead("hook-step", "步骤写时间线", "switch", "写步骤时间线"),
        noRead("hook-failure", "失败处置", "switch", "决定回退或报错"),
        noRead("hook-approval", "审批后恢复", "switch", "审批通过后恢复运行"),
      ],
      availability: [{ label: "钩子列表", reason: "服务器列表当前不可读，不显示钩子启停状态" }],
      note: "只读：本版本写入口未开放；钩子状态未读到。",
    },
  ];
}