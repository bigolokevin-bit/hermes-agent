// 能力与接入 · 模型与单价（骨架 #/capabilities?tab=models）
//
// 骨架 6 块：可用模型 / 调用分布 / 健康 / 未接入 / 当前单价 / 用量与账本。
// 本页 6 块都在。三份数据各读各的：模型目录、价目表、用量账本；
// 价目端点未接线时整页单价列一律「—」，卡底写明缺读口，不编任何价格。
import { Link } from "react-router";
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { Pill } from "@/components/console/Pill";
import { CardFoot, GapNote, GapRow, PaneHead } from "./PaneBits";
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
  currency: string | null;
  effective: string | null;
  version: string | null;
};

type Usage = { days: number; costUsd: number | null; rows: number | null };

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
      status: raw === "ok" || raw === "active" || raw === "available" ? "可用" : raw ? "待核实" : null,
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
      currency: textOf(row.currency),
      effective: textOf(row.effectiveAt) ?? textOf(row.effective_date) ?? textOf(row.asOf),
      version: textOf(row.version) ?? textOf(row.price_version),
    };
  });
}

function parseUsage(body: unknown): Usage | null {
  if (body === null || typeof body !== "object") return null;
  const root = recordOf(body);
  const days = typeof root.period_days === "number" ? root.period_days : null;
  if (days === null) return null;
  const cost = recordOf(root.cost);
  const amount = typeof cost.cost_usd === "number" && Number.isFinite(cost.cost_usd) ? cost.cost_usd : null;
  const rows = typeof cost.rows === "number" ? cost.rows : null;
  return { days, costUsd: amount, rows };
}

function emptyUsage(data: Usage): boolean {
  return data.costUsd === null && (data.rows === null || data.rows === 0);
}

export function CapModelsPane() {
  const models = usePort("/api/models", parseModels, (rows) => rows.length === 0);
  const prices = usePort("/api/models/pricing", parsePrices, (rows) => rows.length === 0);
  const today = usePort("/api/hermes-usage?days=1", parseUsage, emptyUsage);
  const month = usePort("/api/hermes-usage?days=30", parseUsage, emptyUsage);

  const modelRows = models.read.k === "ready" ? models.read.data : [];
  const priceRows = prices.read.k === "ready" ? prices.read.data : [];
  const modelCount = models.read.k === "ready" ? modelRows.length : models.read.k === "empty" ? 0 : null;
  const priceCount = prices.read.k === "ready" ? priceRows.length : prices.read.k === "empty" ? 0 : null;
  const priceVersion = priceRows.find((row) => row.version)?.version ?? null;

  const priceNote = "缺读口：上游价目端点未接线";
  const todayCost = today.read.k === "ready" ? today.read.data.costUsd : null;
  const monthCost = month.read.k === "ready" ? month.read.data.costUsd : null;

  return (
    <div className="cap-pane" data-testid="cap-models">
      <PaneHead
        sub={`${count(modelCount)} 个可用模型 · ${count(priceCount)} 条单价${priceVersion ? `（${priceVersion}）` : ""}`}
        readout={asOfLabel(models.read)}
        readoutTitle="模型目录的读取时刻（北京时间）"
      />

      {/* 1 可用模型 */}
      <ConsoleCard label="可用模型" action={<span className="cap-action">美元 / 1M token</span>} flush>
        <div className="cap-tw">
          <table className="cap-t">
            <thead>
              <tr>
                <th>模型</th>
                <th>Provider</th>
                <th className="cap-num">上下文</th>
                <th className="cap-num">输入 $/1M</th>
                <th className="cap-num">输出 $/1M</th>
                <th className="cap-num cap-sm-hide">7 天调用</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {modelRows.map((row) => (
                <tr key={row.id} data-testid="cap-model-row">
                  <td className="cap-mono">{row.name ?? DASH}</td>
                  <td className="cap-mut">{row.provider ?? DASH}</td>
                  <td className="cap-num">{row.context ?? DASH}</td>
                  <td className="cap-num" title={priceNote}>
                    {DASH}
                  </td>
                  <td className="cap-num" title={priceNote}>
                    {DASH}
                  </td>
                  <td className="cap-num cap-sm-hide" title="用量接口没有按模型拆分调用数">
                    {DASH}
                  </td>
                  <td>
                    {row.status ? (
                      <Pill tone={row.status === "可用" ? "ok" : "warn"}>{row.status}</Pill>
                    ) : (
                      <span className="cap-mut">{DASH}</span>
                    )}
                  </td>
                </tr>
              ))}
              {modelRows.length === 0 ? (
                <GapRow colSpan={7}>
                  {gapText(models.read, "正在读取模型目录…", "模型目录是空的（真零）")}
                </GapRow>
              ) : null}
            </tbody>
          </table>
        </div>
        <CardFoot
          note="单价由 provider 决定，平台只做展示与换算；实际账单以 provider 为准"
          right={modelCount === null ? DASH : `${modelCount} 个模型`}
        />
      </ConsoleCard>

      <div className="cap-g3">
        {/* 2 调用分布 */}
        <ConsoleCard label="调用分布" action={<span className="cap-action">7 天 · 前 4</span>}>
          <GapNote>缺读口：用量接口没有按模型拆分调用数，这里没有可排序的分布。</GapNote>
        </ConsoleCard>

        {/* 3 健康 */}
        <ConsoleCard label="健康" action={<span className="cap-action">探测 5 分钟</span>}>
          <GapNote>缺读口：没有按模型的成功率、限流次数与首字延迟。</GapNote>
        </ConsoleCard>

        {/* 4 未接入 */}
        <ConsoleCard label="未接入" action={<span className="cap-action">停用与无密钥</span>}>
          <GapNote>缺读口：模型目录未接线，判断不了哪些模型有密钥但没启用。</GapNote>
        </ConsoleCard>
      </div>

      {/* 5 当前单价 */}
      <ConsoleCard label="当前单价" action={<span className="cap-action">只用于估算与预检</span>} flush>
        <div className="cap-tw">
          <table className="cap-t">
            <thead>
              <tr>
                <th>供应商</th>
                <th>模型</th>
                <th className="cap-num">输入 $/1M</th>
                <th className="cap-num">输出 $/1M</th>
                <th>货币</th>
                <th>生效日期</th>
                <th>版本</th>
              </tr>
            </thead>
            <tbody>
              {priceRows.map((row) => (
                <tr key={row.id} data-testid="cap-price-row">
                  <td className="cap-mono">{row.vendor ?? DASH}</td>
                  <td>{row.model ?? DASH}</td>
                  <td className="cap-num">{DASH}</td>
                  <td className="cap-num">{DASH}</td>
                  <td className="cap-mut">{row.currency ?? DASH}</td>
                  <td className="cap-num">{row.effective ?? DASH}</td>
                  <td className="cap-mono cap-mut">{row.version ?? DASH}</td>
                </tr>
              ))}
              {priceRows.length === 0 ? (
                <GapRow colSpan={7}>
                  {prices.read.k === "missing"
                    ? `上游价目端点未接线；输入、输出、货币、生效日期、版本各列一律 ${DASH}，不填任何估算值。`
                    : gapText(
                        prices.read,
                        "正在读取价目表…",
                        `价目表是空的（真零）；本表各列一律 ${DASH}，不填任何估算值。`,
                      )}
                </GapRow>
              ) : null}
            </tbody>
          </table>
        </div>
        <CardFoot
          note={priceNote}
          right={priceCount === null ? DASH : `${priceCount} 条`}
        />
      </ConsoleCard>

      {/* 6 用量与账本 */}
      <ConsoleCard label="用量与账本" action={<span className="cap-action">明细在总览</span>}>
        <div className="cap-minis">
          <div className="cap-mini">
            <span className="cap-eyebrow">近 24 小时</span>
            <b className="cap-num-big">{usd(todayCost)}</b>
            <span className="cap-note">
              {today.read.k === "ready" && todayCost === null ? "账本这一窗没有行" : "扣费账本"}
            </span>
          </div>
          <div className="cap-mini">
            <span className="cap-eyebrow">近 30 天</span>
            <b className="cap-num-big">{usd(monthCost)}</b>
            <span className="cap-note">按 30 天窗口聚合，不是自然月</span>
          </div>
          <div className="cap-mini">
            <span className="cap-eyebrow">浪费</span>
            <b className="cap-num-big">{DASH}</b>
            <span className="cap-note">失败与重试没有拆账读口</span>
          </div>
          <div className="cap-mini">
            <span className="cap-eyebrow">最近对账</span>
            <b className="cap-num-big">{DASH}</b>
            <span className="cap-note">金额只认成本账本</span>
          </div>
        </div>
        <div className="cap-inline">
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