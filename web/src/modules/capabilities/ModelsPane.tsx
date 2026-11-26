// 能力与接入 · 模型与单价（骨架 #/capabilities?tab=models）
//
// 骨架 6 块：可用模型 / 调用分布 / 健康 / 未接入 / 当前单价 / 用量与账本。
// 6 块都在。读口真相（2026-11-24 实测）：模型目录没有读口；价目表未接线
// （输入、输出、货币、生效日期、版本各列一律无值）；用量只回全局金额，
// 不按模型拆分。规则统一为：
//   · 同一缺失只在卡底「数据可用性」声明一次，正文只留「—」；
//   · 整列无读口就不画该列，缺的列在卡底点名；
//   · 一行真读数都没有时保留骨架表头 + 一行声明，不把整表抹掉。
import { useState } from "react";
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

/* ------------------------------------------------------------------ *
 * 模型凭据：本页唯一的写口（2026-11-26 对 54458 实测的形状）
 *
 *   GET  /api/credentials/pool
 *        → {providers:[{provider, entries:[{index, id, label, auth_type, source,
 *            priority, last_status, request_count, token_preview, has_refresh}]}]}
 *        index 是列表里的 1 起序号，DELETE 用的就是它。
 *   POST /api/credentials/pool    体 {provider, api_key, label?}（CredentialPoolAdd）
 *        缺 provider/api_key 回 422，detail 是 FastAPI 的校验数组。
 *   DELETE /api/credentials/pool/{provider}/{index}
 *        → {ok, provider, count, cleaned, hints}；env:* 行会被从 ~/.hermes/.env 清掉
 *          并抑制再种子化，否则下一次 load_pool() 会把它重新种回来。
 *   POST /api/providers/validate  体 {key:"<ENV_VAR>", value:"<key>"}（EnvVarUpdate）
 *        → {ok, reachable, message}。key 是环境变量名而不是供应商名：alibaba →
 *          DASHSCOPE_API_KEY。只有 OPENROUTER/OPENAI/XAI/GEMINI 有联网探针，其余
 *          供应商回 ok=true / reachable=false（没校验，不是校验通过）。
 *   PUT  /api/config              体 {config:{model}}（ConfigUpdate，深层合并）
 *        → {ok:true}，只覆盖送去的键。
 * ------------------------------------------------------------------ */

type CredentialRow = {
  provider: string;
  index: number;
  label: string | null;
  source: string | null;
  priority: number | null;
  lastStatus: string | null;
  requestCount: number | null;
  tokenPreview: string | null;
};

type ModelConfig = { model: string | null };

const CRED_STATUS: Record<string, string> = {
  ok: "可用",
  exhausted: "已耗尽",
  dead: "已失效",
  throttled: "限流中",
  error: "出错",
};

/** last_status 为 null 就是「—」——不拿「正常」顶替一次没发生过的判定。 */
function credStatus(raw: string | null): string {
  if (raw === null) return DASH;
  return CRED_STATUS[raw] ?? raw;
}

function parseCredentials(body: unknown): CredentialRow[] | null {
  const root = recordOf(body);
  if (!Array.isArray(root.providers)) return null;
  const rows: CredentialRow[] = [];
  for (const group of root.providers) {
    const record = recordOf(group);
    const provider = textOf(record.provider);
    if (!provider) continue;
    const entries = Array.isArray(record.entries) ? record.entries : [];
    for (const entry of entries) {
      const cell = recordOf(entry);
      const index = num(cell.index);
      if (index === null) continue;
      rows.push({
        provider,
        index,
        label: textOf(cell.label),
        source: textOf(cell.source),
        priority: num(cell.priority),
        lastStatus: textOf(cell.last_status),
        requestCount: num(cell.request_count),
        tokenPreview: textOf(cell.token_preview),
      });
    }
  }
  return rows;
}

function parseModelConfig(body: unknown): ModelConfig | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  return { model: textOf(recordOf(body).model) };
}

/** /api/env 的供应商目录：provider → 主 API key 的环境变量名。 */
function parseProviderEnvKeys(body: unknown): Map<string, string> | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  const keys = new Map<string, string>();
  for (const [name, value] of Object.entries(body as Record<string, unknown>)) {
    const meta = recordOf(value);
    const provider = textOf(meta.provider);
    if (!provider || meta.provider_primary !== true || meta.is_password !== true) continue;
    if (!keys.has(provider)) keys.set(provider, name);
  }
  return keys;
}

type WriteReply = { ok: boolean; status: number; json: unknown; text: string };

async function sendJson(url: string, method: string, body?: unknown): Promise<WriteReply> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "include",
      mode: "same-origin",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, json: null, text: "" };
  }
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text.trim() ? (JSON.parse(text) as unknown) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json, text };
}

/** 上游错误原文：detail / code / message 逐字取出，不改写成人话。 */
function upstreamError(reply: WriteReply, secret: string | null): string {
  const withSecretHidden = (raw: string): string =>
    secret && secret.length > 0 ? raw.split(secret).join("[已隐去 key]") : raw;
  if (reply.status === 0) return "连不上控制台服务（请求没有发出去）";
  const root = recordOf(reply.json);
  const parts = [root.detail, root.code, root.message]
    .map((value) => {
      if (typeof value === "string") return value.trim();
      if (value === null || value === undefined) return "";
      try {
        return JSON.stringify(value);
      } catch {
        return "";
      }
    })
    .filter((value) => value.length > 0);
  const message = parts.length > 0 ? parts.join(" · ") : reply.text.trim();
  return withSecretHidden(message ? `${message}（HTTP ${reply.status}）` : `HTTP ${reply.status}`);
}

type Note = { tone: "ok" | "bad" | "info"; text: string };

/**
 * 模型凭据卡：读池 → 写池 → 删行 → 改默认模型。明文 key 只存在于受控输入框的
 * value 里，提交后立刻清空；页面与错误行都只出现 token_preview 或脱敏后的原文。
 */
function ModelCredentialsCard() {
  const pool = usePort("/api/credentials/pool", parseCredentials, (rows) => rows.length === 0);
  const config = usePort("/api/config", parseModelConfig, () => false);
  const env = usePort("/api/env", parseProviderEnvKeys, () => false);

  const [provider, setProvider] = useState("");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [draftModel, setDraftModel] = useState("");
  const [editingModel, setEditingModel] = useState(false);
  const [busy, setBusy] = useState<"" | "validate" | "save" | "delete" | "model">("");
  const [note, setNote] = useState<Note | null>(null);
  const [modelNote, setModelNote] = useState<Note | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  const rows = pool.read.k === "ready" ? pool.read.data : [];
  const providerKey = provider.trim().toLowerCase();
  const envKeys = env.read.k === "ready" ? env.read.data : null;
  const validateKey = providerKey && envKeys ? (envKeys.get(providerKey) ?? null) : null;
  const hasSecret = apiKey.trim().length > 0;
  const canValidate = validateKey !== null && hasSecret && busy === "";
  const canSave = providerKey.length > 0 && hasSecret && busy === "";
  const currentModel = config.read.k === "ready" ? config.read.data.model : null;

  const poolCount =
    pool.read.k === "ready"
      ? `池内 ${count(pool.read.data.length)} 条`
      : pool.read.k === "empty"
        ? "池内 0 条"
        : pool.read.k === "loading"
          ? "正在读取…"
          : "";

  async function onValidate() {
    if (!validateKey) return;
    const secret = apiKey;
    setBusy("validate");
    setNote(null);
    const reply = await sendJson("/api/providers/validate", "POST", { key: validateKey, value: secret });
    setBusy("");
    if (!reply.ok) {
      setNote({ tone: "bad", text: upstreamError(reply, secret) });
      return;
    }
    const root = recordOf(reply.json);
    const ok = root.ok === true;
    const reachable = root.reachable === true;
    const message = textOf(root.message);
    if (ok && reachable) {
      setNote({ tone: "ok", text: `联网校验通过：供应商接受了这把 key（${validateKey}）` });
      return;
    }
    if (ok && !reachable) {
      setNote({
        tone: "info",
        text: `该供应商没有联网校验口（${validateKey} 无探针），本次未校验；保存后直接进池`,
      });
      return;
    }
    const detail = message ? message.split(secret).join("[已隐去 key]") : "上游没给原因";
    setNote({ tone: "bad", text: `校验未通过：${detail}` });
  }

  async function onSave() {
    const secret = apiKey;
    const body: { provider: string; api_key: string; label?: string } = {
      provider: providerKey,
      api_key: secret,
    };
    if (label.trim()) body.label = label.trim();
    setBusy("save");
    setNote(null);
    const reply = await sendJson("/api/credentials/pool", "POST", body);
    setBusy("");
    if (!reply.ok) {
      setNote({ tone: "bad", text: upstreamError(reply, secret) });
      return;
    }
    // 提交后立刻清空 key 输入框；供应商留着，方便同一个 provider 连加第二条。
    setApiKey("");
    setLabel("");
    setNote({ tone: "ok", text: "已写入凭据池" });
    pool.reload();
  }

  async function onDelete(name: string, index: number) {
    setBusy("delete");
    setNote(null);
    const reply = await sendJson(`/api/credentials/pool/${encodeURIComponent(name)}/${index}`, "DELETE");
    setBusy("");
    setConfirmKey(null);
    if (!reply.ok) {
      setNote({ tone: "bad", text: upstreamError(reply, null) });
      return;
    }
    setNote({ tone: "ok", text: `已删除 ${name} 的第 ${index} 条凭据` });
    pool.reload();
  }

  async function onSaveModel() {
    const next = draftModel.trim();
    if (!next) return;
    setBusy("model");
    setModelNote(null);
    const reply = await sendJson("/api/config", "PUT", { config: { model: next } });
    setBusy("");
    if (!reply.ok) {
      setModelNote({ tone: "bad", text: upstreamError(reply, null) });
      return;
    }
    setEditingModel(false);
    setModelNote({ tone: "ok", text: `已保存默认模型：${next}` });
    config.reload();
  }

  const availability = [
    ...(pool.read.k === "missing" || pool.read.k === "error"
      ? [{ label: "凭据池", reason: "读不到凭据池，列表与删除暂时不可用" }]
      : []),
    ...(config.read.k === "missing" || config.read.k === "error"
      ? [{ label: "默认模型", reason: "配置读不到，无法展示与修改" }]
      : []),
  ];

  return (
    <ConsoleCard
      label={<CardTitle title="模型凭据" />}
      action={
        <a
          className="cap-link"
          href="http://127.0.0.1:54458/models"
          target="_blank"
          rel="noreferrer"
        >
          打开原生仪表盘 ↗
        </a>
      }
      availability={availability}
      note="优先级数字越小越先用：env 里导出的同名 key 与手工行同时存在时，env 行会先被选中；要用手工 key 请先删掉 env 那行。"
    >
      <div className="cap-cred" data-testid="cap-cred-card">
        <div className="cap-cred-sec">
          <div className="cap-inline">
            <span className="cap-eyebrow">现有凭据</span>
            {poolCount ? <span className="cap-note">{poolCount}</span> : null}
          </div>
          {rows.length > 0 ? (
            <div className="cap-cred-list">
              {rows.map((row) => {
                const key = `${row.provider}:${row.index}`;
                return (
                  <div className="cap-cred-row" data-testid="cap-cred-row" key={key}>
                    <span className="cap-mono">{row.provider}</span>
                    <span>{row.label ?? DASH}</span>
                    <span className="cap-mono cap-mut" title="只显示脱敏预览，页面不保存明文">
                      {row.tokenPreview || DASH}
                    </span>
                    <span className="cap-mut">{row.source ?? DASH}</span>
                    <span className="cap-cred-tag">
                      优先级 {row.priority === null ? DASH : row.priority}
                    </span>
                    <span className="cap-cred-tag">
                      请求 {row.requestCount === null ? DASH : count(row.requestCount)}
                    </span>
                    <span className="cap-cred-tag">状态 {credStatus(row.lastStatus)}</span>
                    <span className="cap-cred-actions">
                      {confirmKey === key ? (
                        <>
                          <button
                            className="cap-btn cap-btn--danger"
                            type="button"
                            disabled={busy !== ""}
                            onClick={() => void onDelete(row.provider, row.index)}
                          >
                            {busy === "delete" ? "删除中…" : "确认删除"}
                          </button>
                          <button className="cap-btn" type="button" onClick={() => setConfirmKey(null)}>
                            取消
                          </button>
                        </>
                      ) : (
                        <button
                          className="cap-btn"
                          type="button"
                          disabled={busy !== ""}
                          onClick={() => setConfirmKey(key)}
                        >
                          删除
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="cap-gap-note">{gapText(pool.read, "正在读取凭据池…", "凭据池里还没有条目")}</p>
          )}
        </div>

        <div className="cap-cred-sec">
          <span className="cap-eyebrow">新增</span>
          <div className="cap-cred-form">
            <label className="cap-field">
              <span>供应商</span>
              <input
                className="cap-input"
                value={provider}
                placeholder="alibaba"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setProvider(event.target.value)}
              />
            </label>
            <label className="cap-field">
              <span>标签（可留空）</span>
              <input
                className="cap-input"
                value={label}
                placeholder="主账号"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setLabel(event.target.value)}
              />
            </label>
            <label className="cap-field">
              <span>API Key</span>
              <input
                className="cap-input"
                type="password"
                value={apiKey}
                placeholder="sk-…"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
            <div className="cap-cred-btns">
              <button
                className="cap-btn"
                type="button"
                disabled={!canValidate}
                title={
                  validateKey
                    ? `用 ${validateKey} 向供应商做一次只读探测；不是所有供应商都有探针`
                    : "该供应商没有可用的校验键名映射（/api/env 未列出），先保存，再在原生仪表盘核对"
                }
                onClick={() => void onValidate()}
              >
                {busy === "validate" ? "校验中…" : "校验"}
              </button>
              <button
                className="cap-btn cap-btn--primary"
                type="button"
                disabled={!canSave}
                onClick={() => void onSave()}
              >
                {busy === "save" ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
          <p className="cap-write-note" data-tone={note?.tone ?? "info"} role="status">
            {note?.text ??
              "保存成功后 key 进凭据池（auth.json），页面只回显脱敏预览；失败时这里显示上游原文。"}
          </p>
        </div>

        <div className="cap-cred-sec">
          <div className="cap-cred-model">
            <span className="cap-eyebrow">默认模型</span>
            {config.read.k === "ready" ? (
              editingModel ? (
                <>
                  <input
                    className="cap-input cap-input--model"
                    value={draftModel}
                    placeholder="qwen-plus"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => setDraftModel(event.target.value)}
                  />
                  <button
                    className="cap-btn cap-btn--primary"
                    type="button"
                    disabled={busy !== "" || draftModel.trim().length === 0}
                    onClick={() => void onSaveModel()}
                  >
                    {busy === "model" ? "保存中…" : "保存"}
                  </button>
                  <button
                    className="cap-btn"
                    type="button"
                    disabled={busy !== ""}
                    onClick={() => setEditingModel(false)}
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <span className="cap-mono">{currentModel ?? DASH}</span>
                  <button
                    className="cap-btn"
                    type="button"
                    disabled={busy !== ""}
                    onClick={() => {
                      setDraftModel(currentModel ?? "");
                      setEditingModel(true);
                    }}
                  >
                    修改
                  </button>
                </>
              )
            ) : (
              <span className="cap-gap-note">
                {gapText(config.read, "正在读取配置…", "配置里还没有默认模型")}
              </span>
            )}
          </div>
          {modelNote ? (
            <p className="cap-write-note" data-tone={modelNote.tone} role="status">
              {modelNote.text}
            </p>
          ) : null}
          <p className="cap-note">只改默认模型这一项，其它配置项不动。</p>
        </div>
      </div>
    </ConsoleCard>
  );
}

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

      {/* 0 模型凭据（写口：池的增删 + 默认模型） */}
      <ModelCredentialsCard />

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
