// 能力与接入 · 模型与单价（骨架 #/capabilities?tab=models）
//
// 骨架 6 块：可用模型 / 调用分布 / 健康 / 未接入 / 当前单价 / 用量与账本。
// 6 块都在。读口真相（2026-11-24 实测）：模型目录没有读口；价目表未接线
// （输入、输出、货币、生效日期、版本各列一律无值）；用量只回全局金额，
// 不按模型拆分。规则统一为：
//   · 同一缺失只在卡底「数据可用性」声明一次，正文只留「—」；
//   · 整列无读口就不画该列，缺的列在卡底点名；
//   · 一行真读数都没有时保留骨架表头 + 一行声明，不把整表抹掉。
import { Link } from "react-router";
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { Pill } from "@/components/console/Pill";
import { CardTitle, GapRow, PaneHead } from "./PaneBits";
import { DASH, asOfLabel, count, gapText, listOf, recordOf, textOf, usd, usePort } from "./paneApi";

type ModelRow = {
  id: string;
  name: string | null;
  provider: string | null;
  context: string | null;
  status: string | null;
};

type PriceRow = {
  id: string;
  vendor: string | null;
  model: string | null;
  input: number | null;
  output: number | null;
  currency: string | null;
  effective: string | null;
  version: string | null;
  source: string | null;
};

type Usage = {
  days: number;
  costUsd: number | null;
  rows: number | null;
  /** by_model 有拆分才有值；上游给 null 就是没有拆分读口。 */
  byModel: { name: string; calls: number }[] | null;
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseModels(body: unknown): ModelRow[] | null {
  const items = listOf(body);
  if (items === null) return null;
  return items.map((item, index) => {
    const row = recordOf(item);
    const window = row.context_window ?? row.contextWindow ?? row.context;
    const raw = (textOf(row.status) ?? "").toLowerCase();
    return {
      id: textOf(row.id) ?? textOf(row.model) ?? textOf(row.name) ?? `model-${index}`,
      name: textOf(row.name) ?? textOf(row.model) ?? textOf(row.id),
      provider: textOf(row.provider) ?? textOf(row.vendor),
      context: typeof window === "number" && Number.isFinite(window) ? `${Math.round(window / 1024)}k` : null,
      status:
        raw === "ok" || raw === "active" || raw === "available"
          ? "可用"
          : raw === "throttled"
            ? "限流中"
            : raw
              ? "状态未知"
              : null,
    };
  });
}

function parsePrices(body: unknown): PriceRow[] | null {
  const items = listOf(body);
  if (items === null) return null;
  return items.map((item, index) => {
    const row = recordOf(item);
    return {
      id: textOf(row.id) ?? textOf(row.model) ?? `price-${index}`,
      vendor: textOf(row.provider) ?? textOf(row.vendor),
      model: textOf(row.model) ?? textOf(row.name),
      input: num(row.input_usd_per_1m ?? row.input_per_1m ?? row.input),
      output: num(row.output_usd_per_1m ?? row.output_per_1m ?? row.output),
      currency: textOf(row.currency),
      effective: textOf(row.effectiveAt) ?? textOf(row.effective_date) ?? textOf(row.asOf),
      version: textOf(row.version) ?? textOf(row.price_version),
      source: textOf(row.source) ?? textOf(row.origin),
    };
  });
}

function parseUsage(body: unknown): Usage | null {
  if (body === null || typeof body !== "object") return null;
  const root = recordOf(body);
  const days = typeof root.period_days === "number" ? root.period_days : null;
  if (days === null) return null;
  const cost = recordOf(root.cost);
  const by = recordOf(root.by_model);
  let byModel: Usage["byModel"] = null;
  if (root.by_model !== null && typeof root.by_model === "object" && !Array.isArray(root.by_model)) {
    const rows = Object.entries(by)
      .map(([name, value]) => {
        const cell = recordOf(value);
        const calls = num(cell.calls) ?? num(cell.requests) ?? num(cell.total);
        return calls === null ? null : { name, calls };
      })
      .filter((row): row is { name: string; calls: number } => row !== null);
    byModel = rows.length > 0 ? rows : null;
  }
  return {
    days,
    costUsd: num(cost.cost_usd),
    rows: typeof cost.rows === "number" ? cost.rows : null,
    byModel,
  };
}

function emptyUsage(data: Usage): boolean {
  return data.costUsd === null && (data.rows === null || data.rows === 0);
}

/** $/1M 一律两位小数；没有读数就是「—」，不补 0。 */
function perM(value: number | null): string {
  return value === null ? DASH : `$${value.toFixed(2)}`;
}

const STATUS_TONE = { 可用: "ok", 限流中: "warn" } as const;

export function CapModelsPane() {
  const models = usePort("/api/models", parseModels, (rows) => rows.length === 0);
  const prices = usePort("/api/models/pricing", parsePrices, (rows) => rows.length === 0);
  const today = usePort("/api/hermes-usage?days=1", parseUsage, emptyUsage);
  const month = usePort("/api/hermes-usage?days=30", parseUsage, emptyUsage);
  const week = usePort(
    "/api/hermes-usage?days=7",
    parseUsage,
    (data) => data.byModel === null && data.costUsd === null,
  );

  const modelRows = models.read.k === "ready" ? models.read.data : [];
  const priceRows = prices.read.k === "ready" ? prices.read.data : [];
  const modelCount = models.read.k === "ready" ? modelRows.length : models.read.k === "empty" ? 0 : null;
  const priceCount = prices.read.k === "ready" ? priceRows.length : prices.read.k === "empty" ? 0 : null;
  const priceVersion = priceRows.find((row) => row.version)?.version ?? null;

  // 单价按模型名对接价目行；价目没有读口时整列不画。
  const priceOf = (row: ModelRow): PriceRow | null =>
    priceRows.find((p) => p.model !== null && (p.model === row.name || p.model === row.id)) ?? null;
  const callsOf = (row: ModelRow): number | null => {
    const dist = week.read.k === "ready" ? week.read.data.byModel : null;
    if (!dist) return null;
    const hit = dist.find((d) => d.name === row.name || d.name === row.id);
    return hit ? hit.calls : null;
  };

  const hasRows = modelRows.length > 0;
  const showProvider = !hasRows || modelRows.some((r) => r.provider !== null);
  const showContext = !hasRows || modelRows.some((r) => r.context !== null);
  const showIn = !hasRows || modelRows.some((r) => priceOf(r)?.input != null);
  const showOut = !hasRows || modelRows.some((r) => priceOf(r)?.output != null);
  const showCalls = !hasRows || modelRows.some((r) => callsOf(r) !== null);
  const showStatus = !hasRows || modelRows.some((r) => r.status !== null);
  const modelCols =
    1 + [showProvider, showContext, showIn, showOut, showCalls, showStatus].filter(Boolean).length;

  const dist = week.read.k === "ready" ? week.read.data.byModel : null;

  // 价目表列裁形：零行时保留骨架表头 + 一行声明。
  const priceShow = (get: (row: PriceRow) => string | number | null) =>
    priceRows.length === 0 || priceRows.some((row) => get(row) !== null);
  const priceShowVendor = priceShow((r) => r.vendor);
  const priceShowModel = priceShow((r) => r.model);
  const priceShowIn = priceShow((r) => r.input);
  const priceShowOut = priceShow((r) => r.output);
  const priceShowCurrency = priceShow((r) => r.currency);
  const priceShowEffective = priceShow((r) => r.effective);
  const priceShowVersion = priceShow((r) => r.version);
  const priceShowSource = priceShow((r) => r.source);
  const priceCols =
    [priceShowVendor, priceShowModel, priceShowIn, priceShowOut, priceShowCurrency, priceShowEffective, priceShowVersion, priceShowSource].filter(Boolean).length;

  const todayUsage = today.read.k === "ready" ? today.read.data : null;
  const monthUsage = month.read.k === "ready" ? month.read.data : null;

  return (
    <div className="cap-pane" data-testid="cap-models">
      <PaneHead
        showNative={false}
        sub={`${count(modelCount)} 个可用模型 · ${count(priceCount)} 条单价${priceVersion ? `（${priceVersion}）` : ""}`}
        readout={asOfLabel(models.read)}
        readoutTitle="模型目录的读取时刻（北京时间）"
      />

      {/* 1 可用模型 */}
      <ConsoleCard
        label={<CardTitle title="可用模型" />}
        action={<span className="cap-action">美元 / 1M token</span>}
        flush
        availability={[
          ...(showIn ? [] : [{ label: "列「输入 $/1M」", reason: "价目读数未接线" }]),
          ...(showOut ? [] : [{ label: "列「输出 $/1M」", reason: "价目读数未接线" }]),
          ...(showCalls ? [] : [{ label: "列「7 天调用」", reason: "用量读数不按模型拆分" }]),
        ]}
        note="单价由 provider 决定，平台只做展示与换算；实际账单以 provider 为准"
      >
        <div className="cap-tw">
          <table className="cap-t">
            <thead>
              <tr>
                <th>模型</th>
                {showProvider ? <th>Provider</th> : null}
                {showContext ? <th className="cap-num">上下文</th> : null}
                {showIn ? <th className="cap-num">输入 $/1M</th> : null}
                {showOut ? <th className="cap-num">输出 $/1M</th> : null}
                {showCalls ? <th className="cap-num cap-sm-hide">7 天调用</th> : null}
                {showStatus ? <th>状态</th> : null}
              </tr>
            </thead>
            <tbody>
              {modelRows.map((row) => {
                const price = priceOf(row);
                const calls = callsOf(row);
                return (
                  <tr key={row.id} data-testid="cap-model-row">
                    <td className="cap-mono">{row.name ?? DASH}</td>
                    {showProvider ? <td className="cap-mut">{row.provider ?? DASH}</td> : null}
                    {showContext ? <td className="cap-num">{row.context ?? DASH}</td> : null}
                    {showIn ? <td className="cap-num">{perM(price?.input ?? null)}</td> : null}
                    {showOut ? <td className="cap-num">{perM(price?.output ?? null)}</td> : null}
                    {showCalls ? (
                      <td className="cap-num cap-sm-hide">{calls === null ? DASH : count(calls)}</td>
                    ) : null}
                    {showStatus ? (
                      <td>
                        {row.status ? (
                          <Pill tone={STATUS_TONE[row.status as keyof typeof STATUS_TONE] ?? "warn"}>
                            {row.status}
                          </Pill>
                        ) : (
                          <span className="cap-mut">{DASH}</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              {modelRows.length === 0 ? (
                <GapRow colSpan={modelCols}>
                  {gapText(models.read, "正在读取模型目录…", "模型目录是空的（真零）")}
                </GapRow>
              ) : null}
            </tbody>
          </table>
        </div>
      </ConsoleCard>

      <div className="cap-g3">
        {/* 2 调用分布 */}
        <ConsoleCard
          label={<CardTitle title="调用分布" />}
          action={<span className="cap-action">近 7 天</span>}
          availability={dist ? [] : [{ label: "按模型拆分的调用数", reason: "用量读数没有模型维度" }]}
        >
          {dist ? (
            dist
              .slice()
              .sort((a, b) => b.calls - a.calls)
              .slice(0, 4)
              .map((row) => (
                <div className="cap-inline" key={row.name}>
                  <span className="cap-note cap-mono">{row.name}</span>
                  <span className="cap-grow" />
                  <span className="cap-mono cap-num">{count(row.calls)}</span>
                </div>
              ))
          ) : (
            <p className="cap-dash">—</p>
          )}
        </ConsoleCard>

        {/* 3 健康 */}
        <ConsoleCard
          label={<CardTitle title="健康" />}
          action={<span className="cap-action">成功率 · 限流 · 首字</span>}
          availability={[
            { label: "成功率", reason: "没有按模型的探测读数" },
            { label: "429 次数", reason: "限流事件没有单独计数" },
            { label: "P95 首字延迟", reason: "首字时间未回传" },
          ]}
        >
          <p className="cap-dash">—</p>
        </ConsoleCard>

        {/* 4 未接入 */}
        <ConsoleCard
          label={<CardTitle title="未接入" />}
          action={<span className="cap-action">有密钥未启用</span>}
          availability={[{ label: "密钥与启用状态清单", reason: "模型目录没有读口" }]}
        >
          <p className="cap-para">启用新模型前需确认数据合规与出站范围；清单等模型目录接回来再列。</p>
        </ConsoleCard>
      </div>

      {/* 5 当前单价 */}
      <ConsoleCard
        label={<CardTitle title="当前单价" />}
        action={<span className="cap-action">只用于估算与预检</span>}
        flush
        availability={[
          { label: "价目表", reason: "上游没有可用的价目读数" },
          { label: "写口「编辑」", reason: "价格写入未开放" },
        ]}
        note="单价在此定义，只用于成本估算与预算预检；实际金额以成本账本为准"
      >
        <div className="cap-tw">
          <table className="cap-t">
            <thead>
              <tr>
                {priceShowVendor ? <th>供应商</th> : null}
                {priceShowModel ? <th>模型</th> : null}
                {priceShowIn ? <th className="cap-num">输入 $/1M</th> : null}
                {priceShowOut ? <th className="cap-num">输出 $/1M</th> : null}
                {priceShowCurrency ? <th>货币</th> : null}
                {priceShowEffective ? <th>生效日期</th> : null}
                {priceShowVersion ? <th>版本</th> : null}
                {priceShowSource ? <th>来源</th> : null}
              </tr>
            </thead>
            <tbody>
              {priceRows.map((row) => (
                <tr key={row.id} data-testid="cap-price-row">
                  {priceShowVendor ? <td className="cap-mono">{row.vendor ?? DASH}</td> : null}
                  {priceShowModel ? <td>{row.model ?? DASH}</td> : null}
                  {priceShowIn ? <td className="cap-num">{perM(row.input)}</td> : null}
                  {priceShowOut ? <td className="cap-num">{perM(row.output)}</td> : null}
                  {priceShowCurrency ? <td className="cap-mut">{row.currency ?? DASH}</td> : null}
                  {priceShowEffective ? <td className="cap-num">{row.effective ?? DASH}</td> : null}
                  {priceShowVersion ? <td className="cap-mono cap-mut">{row.version ?? DASH}</td> : null}
                  {priceShowSource ? <td className="cap-mut">{row.source ?? DASH}</td> : null}
                </tr>
              ))}
              {priceRows.length === 0 ? (
                <GapRow colSpan={priceCols}>
                  {gapText(prices.read, "正在读取价目表…", "价目表是空的（真零）")}
                </GapRow>
              ) : null}
            </tbody>
          </table>
        </div>
      </ConsoleCard>

      {/* 6 用量与账本 */}
      <ConsoleCard
        label={<CardTitle title="用量与账本" />}
        action={<span className="cap-action">明细在总览</span>}
        availability={[
          { label: "浪费拆账", reason: "失败与重试没有单独入账" },
          { label: "最近对账", reason: "对账结果没有读口" },
        ]}
      >
        <div className="cap-minis cap-minis--2">
          <div className="cap-mini">
            <span className="cap-eyebrow">近 24 小时</span>
            {todayUsage === null && today.read.k === "empty" ? (
              <b className="cap-mini-text">无行</b>
            ) : (
              <b className="cap-num-big">{usd(todayUsage?.costUsd ?? null)}</b>
            )}
            <span className="cap-note">
              {today.read.k === "empty" ? "扣费账本这一窗没有行" : "扣费账本"}
            </span>
          </div>
          <div className="cap-mini">
            <span className="cap-eyebrow">近 30 天</span>
            <b className="cap-num-big">{usd(monthUsage?.costUsd ?? null)}</b>
            <span className="cap-note">
              {monthUsage?.rows != null ? `账本 ${count(monthUsage.rows)} 行 · 30 天窗` : "按 30 天窗口聚合，不是自然月"}
            </span>
          </div>
        </div>
        <div className="cap-inline cap-mt">
          <Link className="cap-link" to="/overview?tab=usage">
            看用量与成本投影 →
          </Link>
          <span className="cap-grow" />
          <span className="cap-note">使用量与账本明细在总览</span>
        </div>
      </ConsoleCard>
    </div>
  );
}
