/**
 * 投影去向腿 — `hermes-usage` 回答里的 `sources[*].state`（读口状态）与
 * `attribution`（会话统计腿的未归属实测）。骨架 2068–2078 行的「投影去向」
 * 卡在现实现里没有对应物：它把这一屏只读的内容映射到真正承接写的资源域，
 * 并把各读取腿的实际状态写在行内小字里。
 *
 * 三条纪律：
 *  - 屏上正文用中文读口名（仪表盘用量 / 会话统计 / 成本账本）与状态中文词，
 *    骨架要求的行内短码 `degraded(timeout)` 一并落正文（它是状态词，不是
 *    HTTP 状态码）；英文端点腿名与原因原值只进 `title` 或卡底口径行。
 *  - 未归属 token 是会话统计腿的实测，**不是**总量：屏上把它定性为未归属，
 *    绝不当总计呈现。
 *  - `sources` 块整个没随回答发送时返回空表，调用方据此写「读口状态未随
 *    回答发送」，不假装都好。
 *
 * 从 /tmp/usage-wip 的 WIP 裁剪：月配额腿（/api/matrix 求和）本页未接线，
 * 不留死码。
 */

/** 读口原值 → 屏上中文名词（骨架「投影去向」的行名同源）。 */
const LEG_NAMES: Record<string, string> = {
  dashboard_usage: "仪表盘用量",
  gateway_sessions: "会话统计",
  cost_ledger: "成本账本",
};

/** 状态词 → 屏上中文（原始词短码形仍进正文，见上）。 */
const STATE_WORDS: Record<string, string> = {
  ok: "实读",
  degraded: "降级",
  unavailable: "不可用",
  missing: "未回",
  timeout: "超时",
};

export interface SourceLeg {
  /** 英文端点腿名，只进 title。 */
  rawKey: string;
  /** 屏上中文读口名。 */
  name: string;
  /** ok / degraded / … 原值，只进 title。 */
  rawState: string;
  /** 屏上状态中文词。 */
  stateWord: string;
  /** 骨架要求的行内短码，如 `degraded(timeout)`；实读腿为 null。 */
  shortCode: string | null;
  /** 原因原值（timeout 一类），只进 title。 */
  reason: string | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function word(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * `sources` → 读取腿列表。兼容两种发送形制：对象表
 * （`{"dashboard_usage":{"state":"ok"}}`）与数组
 * （`[{"source":"dashboard_usage","state":"ok"}]`）。回答没带这个块时
 * 返回空表。
 */
export function parseSourceLegs(body: unknown): SourceLeg[] {
  const outer = record(body);
  const sources = outer ? record(outer.sources) : null;
  const entries: [string, unknown][] = Array.isArray(outer?.sources)
    ? (outer.sources as unknown[]).map((item, index) => {
        const leg = record(item);
        const key = leg ? word(leg.source) ?? word(leg.name) ?? word(leg.key) : null;
        return [key ?? `leg-${index}`, item] as [string, unknown];
      })
    : sources
      ? Object.entries(sources)
      : [];
  return entries.map(([rawKey, entry]) => {
    const leg = record(entry);
    const rawState = (leg ? word(leg.state) : null) ?? "missing";
    const reason = leg ? word(leg.reason) : null;
    const stateWord = STATE_WORDS[rawState] ?? "状态未识别";
    // 短码只在「不是实读」时上屏：ok 腿不需要工程词。
    const shortCode = rawState === "ok" ? null : reason ? `${rawState}(${reason})` : rawState;
    return {
      rawKey,
      name: LEG_NAMES[rawKey] ?? "其它读口",
      rawState,
      stateWord,
      shortCode,
      reason,
    };
  });
}

/** 按腿名取一条；没有 → null（调用方写「未随回答发送」）。 */
export function legOf(legs: SourceLeg[], rawKey: string): SourceLeg | null {
  return legs.find((leg) => leg.rawKey === rawKey) ?? null;
}

/** 行内正文：`会话统计 degraded(timeout)`；实读腿只写中文读口名与状态词。 */
export function legShortText(leg: SourceLeg | null): string {
  if (!leg) return "读口状态未随回答发送";
  return leg.shortCode ? `${leg.name} ${leg.shortCode}` : `${leg.name} ${leg.stateWord}`;
}

/* ------------------------------------------------------------------ *
 * 未归属 token（会话统计腿的实测，不是总量）
 * ------------------------------------------------------------------ */

export interface AttributionTokens {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  /** 已映射到员工的会话数与未归属会话数，用来写「N 个会话未经归属」。 */
  mappedSessions: number | null;
  unattributedSessions: number | null;
  /** 服务自己的话（中文），只进 title。 */
  note: string | null;
  anyValue: boolean;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function parseAttribution(body: unknown): AttributionTokens | null {
  const outer = record(body);
  const attribution = outer ? record(outer.attribution) : null;
  if (!attribution) return null;
  const unattributed = record(attribution.unattributed);
  const tokens = record(unattributed?.tokens);
  const input = tokens ? count(tokens.total_input) : null;
  const output = tokens ? count(tokens.total_output) : null;
  const cacheRead = tokens ? count(tokens.total_cache_read) : null;
  return {
    input,
    output,
    cacheRead,
    mappedSessions: count(attribution.mapped_sessions),
    unattributedSessions: unattributed ? count(unattributed.sessions) : null,
    note: word(attribution.note),
    anyValue: input !== null || output !== null || cacheRead !== null,
  };
}
