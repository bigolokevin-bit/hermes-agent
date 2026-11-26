// 「接入模型供应商」：模型与单价页唯一的接入写口（2026-11-26 对 9122→54458 实测）。
//
// 三段一条直线：选供应商 → 填并校验 key → 选模型并真验证。三段的落点各不相同：
//   · 供应商密钥写 PUT /api/env（<PROVIDER>_API_KEY）——这才是 Hermes 真正解析的那条路；
//     凭据池里 env:<KEY> 那条 priority 0，排在手工条目（priority 1）之前，
//     所以只往池里加等于没换，写 env 才覆盖正在服务的那把。
//   · 自定义供应商走 POST /api/providers/custom-endpoints，成功后 activate。
//   · 模型名与回退链写 PUT /api/config。
// 明文 key 只活在输入框里：提交后立刻清空、错误原文先脱敏、屏上永远只有 redacted_value
// 的截断形制。校验与真验证各自把三种结局分开表达，不许把「没校验」写成「通过」。
import { useState } from "react";
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { Pill } from "@/components/console/Pill";
import { CardTitle, GapNote } from "./PaneBits";
import { DASH, count, readPort, recordOf, textOf, usePort, type Read } from "./paneApi";
import { maskSecret, sendJson, upstreamError, clip, type Note, type WriteReply } from "./paneWrite";
import {
  buildFallbackList,
  extractChatReply,
  parseCustomEndpoints,
  parseModelInfo,
  parseModelSettings,
  parseProviderDirectory,
  parseValidateReply,
  validateNote,
  type ProviderEntry,
} from "./providerAccess";
import type { CredentialRow } from "./credentials";

/**
 * 模型名输入框的示例值。不拿「当前生效的模型」当 placeholder：上面一行已经把它当
 * 真读数端出来了，再拿它当提示会让空输入框看起来像已经填过，用户分不清是值还是例子。
 * qwen-plus 取自 2026-11-26 实测 GET /api/config 的默认值。
 */
const MODEL_EXAMPLE = "qwen-plus";

function isSetLabel(read: Read<ProviderEntry[]>, entry: ProviderEntry | null): string {
  if (entry === null) return DASH;
  if (read.k === "loading") return "读取中";
  return entry.isSet ? "已配置" : "未配置";
}

export interface ProviderAccessCardProps {
  /** 供应商目录（GET /api/env）由页级持有：向导卡与凭据池卡共用同一份读口，只读一次。 */
  env: { read: Read<ProviderEntry[]>; reload: () => void };
  /** 凭据池读数由父级共用：这里只用它说清「哪条正在服务」。 */
  pool: Read<CredentialRow[]>;
  onPoolReload: () => void;
}

export function ProviderAccessCard({ env, pool, onPoolReload }: ProviderAccessCardProps) {
  const endpoints = usePort("/api/providers/custom-endpoints", parseCustomEndpoints, (read) => read.rows.length === 0);
  const settings = usePort("/api/config", parseModelSettings, () => false);
  const info = usePort("/api/model/info", parseModelInfo, () => false);

  const [mode, setMode] = useState<"builtin" | "custom">("builtin");
  const [selected, setSelected] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [draftModel, setDraftModel] = useState("");
  const [draftFallback, setDraftFallback] = useState("");
  const [busy, setBusy] = useState<"" | "validate" | "save" | "model" | "test">("");
  const [keyNote, setKeyNote] = useState<Note | null>(null);
  const [modelNote, setModelNote] = useState<Note | null>(null);
  const [testNote, setTestNote] = useState<Note | null>(null);

  const rows = env.read.k === "ready" ? env.read.data : env.read.k === "empty" ? [] : null;
  const entry = mode === "builtin" ? (rows ?? []).find((row) => row.provider === selected) ?? null : null;
  // 自定义供应商不写环境变量键位（它走 custom-endpoints 的 api_key），所以这里不给假键名。
  const envKey: string | null = mode === "custom" ? null : entry?.envKey ?? null;
  const secret = apiKey.trim();
  const baseUrlKey = entry?.baseUrlKey ?? null;
  // 第 2 步的 key 输入框只在「知道写去哪儿」之后才出现：没选供应商也没有切自定义时，
  // 摆一个填了也没法保存的密码框只会让人以为可以直接贴 key。
  const hasTarget = mode === "custom" || entry !== null;
  const poolRows = pool.k === "ready" ? pool.data : pool.k === "empty" ? [] : [];
  const servingEnvRow =
    entry === null ? null : poolRows.find((row) => row.source === `env:${entry.envKey}`) ?? null;
  const customRows =
    endpoints.read.k === "ready" ? endpoints.read.data.rows : endpoints.read.k === "empty" ? [] : null;
  const currentModel = settings.read.k === "ready" ? settings.read.data.model : null;
  const currentFallbacks = settings.read.k === "ready" ? settings.read.data.fallbacks : null;
  const liveModel = info.read.k === "ready" ? info.read.data : null;

  const canValidate =
    busy === "" &&
    secret.length > 0 &&
    (mode === "custom" ? customUrl.trim().length > 0 : entry !== null);
  const canSaveKey =
    busy === "" &&
    secret.length > 0 &&
    (mode === "custom"
      ? customName.trim().length > 0 && customUrl.trim().length > 0 && customModel.trim().length > 0
      : entry !== null);
  const canSaveModel =
    busy === "" && settings.read.k !== "loading" && draftModel.trim().length > 0;

  function selectMode(next: "builtin" | "custom") {
    if (busy !== "") return;
    setMode(next);
    setKeyNote(null);
    setTestNote(null);
  }

  async function onValidate() {
    if (!canValidate) return;
    const typed = secret;
    setBusy("validate");
    setKeyNote(null);
    let reply: WriteReply;
    if (mode === "custom") {
      reply = await sendJson("/api/providers/custom-endpoints/validate", "POST", {
        name: customName.trim() || "自定义端点",
        base_url: customUrl.trim(),
        model: customModel.trim(),
        api_key: typed,
      });
    } else {
      reply = await sendJson("/api/providers/validate", "POST", { key: envKey, value: typed });
    }
    setBusy("");
    if (!reply.ok) {
      setKeyNote({ tone: "bad", text: upstreamError(reply, typed) });
      return;
    }
    if (mode === "custom") {
      const state = parseValidateReply(reply, (raw) => maskSecret(raw, typed));
      if (state === null) {
        setKeyNote({ tone: "bad", text: `上游回的形状读不出来：${clip(reply.text, 120)}` });
        return;
      }
      const models = recordOf(reply.json).models;
      const found = Array.isArray(models) ? models.length : null;
      const note = validateNote(state, customUrl.trim() || "这个端点");
      setKeyNote({
        tone: note.tone,
        text: found === null ? note.text : `${note.text}；它回传 ${count(found)} 个模型名`,
      });
      return;
    }
    const state = parseValidateReply(reply, (raw) => maskSecret(raw, typed));
    if (state === null) {
      setKeyNote({ tone: "bad", text: `上游回的形状读不出来：${clip(reply.text, 120)}` });
      return;
    }
    setKeyNote(validateNote(state, envKey ?? "这个键位"));
  }

  /** 自定义供应商：建条目 → 成功就 activate；两段结果分开说。 */
  async function saveCustom() {
    const typed = secret;
    const body = {
      id: "",
      name: customName.trim(),
      base_url: customUrl.trim(),
      model: customModel.trim(),
      api_key: typed,
      make_default: false,
    };
    const created = await sendJson("/api/providers/custom-endpoints", "POST", body);
    if (!created.ok) {
      setKeyNote({ tone: "bad", text: upstreamError(created, typed) });
      return;
    }
    const root = recordOf(created.json);
    const id = textOf(root.id) ?? null;
    if (id === null) {
      setKeyNote({ tone: "bad", text: `已建好条目，但上游没回 id，无法启用（HTTP ${created.status}）` });
      return;
    }
    const activated = await sendJson(
      `/api/providers/custom-endpoints/${encodeURIComponent(id)}/activate`,
      "POST",
    );
    endpoints.reload();
    settings.reload();
    info.reload();
    if (!activated.ok) {
      setKeyNote({
        tone: "bad",
        text: `条目 ${id} 已写入，但启用失败：${upstreamError(activated, typed)}`,
      });
      return;
    }
    const live = recordOf(activated.json);
    const model = textOf(live.model);
    setKeyNote({
      tone: "ok",
      text: `已接入并启用：${id}${model ? ` · 模型 ${model}` : ""}。端点 key 存进配置的环境变量引用，页面不留明文。`,
    });
    setTestNote(null);
  }

  async function onSaveKey() {
    if (!canSaveKey) return;
    const typed = secret;
    setBusy("save");
    setKeyNote(null);
    setTestNote(null);
    if (mode === "custom") {
      await saveCustom();
      setBusy("");
      setApiKey("");
      setRevealed(false);
      return;
    }
    if (entry === null || envKey === null) {
      setBusy("");
      return;
    }
    const reply = await sendJson("/api/env", "PUT", { key: entry.envKey, value: typed });
    if (!reply.ok) {
      setBusy("");
      setKeyNote({ tone: "bad", text: upstreamError(reply, typed) });
      return;
    }
    let urlNote = "";
    if (baseUrlKey !== null && baseUrl.trim().length > 0) {
      const urlReply = await sendJson("/api/env", "PUT", { key: baseUrlKey, value: baseUrl.trim() });
      urlNote = urlReply.ok
        ? `；${baseUrlKey} 已写入`
        : `；${baseUrlKey} 写入失败：${upstreamError(urlReply, null)}`;
    }
    // 提交后立刻清空明文，再回读一次 /api/env 确认这条键位真的置上了。
    setApiKey("");
    setRevealed(false);
    setBaseUrl("");
    const after = await readPort("/api/env", parseProviderDirectory);
    env.reload();
    onPoolReload();
    setBusy("");
    if (after.k !== "ready") {
      setKeyNote({
        tone: "info",
        text: `已写入 ${entry.envKey}，但回读没成功（${after.k === "error" ? after.note : "这一份清单是空的"}），刷新后核对`,
      });
      return;
    }
    const next = after.data.find((row) => row.provider === entry.provider) ?? null;
    const nowSet = next?.isSet === true;
    const preview = next?.preview ?? null;
    const covered =
      servingEnvRow === null
        ? ""
        : `；已覆盖正在服务的凭据（池里 ${servingEnvRow.provider} 的 env 行，它排在手工条目前面）`;
    setKeyNote({
      tone: nowSet ? "ok" : "bad",
      text: nowSet
        ? `已写入 ${entry.envKey}：回读 is_set=true${preview ? `（${preview}）` : ""}${urlNote}${covered}`
        : `上游回 200，但回读 ${entry.envKey} 仍是 is_set=false${urlNote}`,
    });
  }

  async function onSaveModel() {
    if (!canSaveModel) return;
    const next = draftModel.trim();
    const fallbacks = buildFallbackList(draftFallback);
    const config: Record<string, unknown> = { model: next };
    if (fallbacks !== null) config.fallback_providers = fallbacks;
    setBusy("model");
    setModelNote(null);
    const reply = await sendJson("/api/config", "PUT", { config });
    if (!reply.ok) {
      setBusy("");
      setModelNote({ tone: "bad", text: upstreamError(reply, null) });
      return;
    }
    // 回读 PUT 之后配置里真的写进去的那条。
    const after = await readPort("/api/config", parseModelSettings);
    settings.reload();
    info.reload();
    setBusy("");
    if (after.k !== "ready") {
      setModelNote({ tone: "info", text: `已保存 ${next}，但回读配置没成功，刷新后核对` });
      return;
    }
    const saved = after.data.model;
    const savedFallbacks = after.data.fallbacks;
    if (saved !== next) {
      // 回读到的还是旧名：PUT 的 200 不等于生效，这句必须照实说。
      setModelNote({
        tone: "bad",
        text: `已保存并回读：默认模型 ${saved ?? DASH}，不是 ${next} —— 上游回了 200，这一改没落地。`,
      });
      return;
    }
    setDraftModel("");
    setDraftFallback("");
    setModelNote({
      tone: "ok",
      text: `已保存并回读：默认模型 ${saved}${
        fallbacks === null
          ? ""
          : `；回退链 ${count(savedFallbacks.length)} 条${savedFallbacks.length > 0 ? `（${savedFallbacks.join("、")}）` : ""}`
      }`,
    });
  }

  /**
   * 真打一次，三段各留一行原话：① 有明文 key 在手就向供应商做一次只读探测；
   * ② 回读上游此刻生效的模型；③ 发一次最小对话请求——上游答什么就写什么，
   * 没有这个口（实测 405/404）就写「本环境没有测试对话读口」，不拿探测绿冒充回话。
   */
  async function onTest() {
    if (busy !== "") return;
    const typed = secret;
    const target = draftModel.trim() || currentModel || liveModel?.model || "";
    setBusy("test");
    setTestNote(null);
    const lines: string[] = [];

    if (typed.length > 0 && mode === "builtin" && envKey !== null) {
      const probe = await sendJson("/api/providers/validate", "POST", { key: envKey, value: typed });
      if (probe.ok) {
        const state = parseValidateReply(probe, (raw) => maskSecret(raw, typed));
        if (state !== null) lines.push(validateNote(state, envKey).text);
      } else {
        lines.push(`供应商校验没走通：${upstreamError(probe, typed)}`);
      }
    }

    const live = await readPort("/api/model/info", parseModelInfo);
    if (live.k === "ready" && live.data.model !== null) {
      lines.push(`此刻生效：${live.data.model}${live.data.provider ? ` @ ${live.data.provider}` : ""}`);
    } else {
      lines.push(`生效读数没拿到：${live.k === "error" || live.k === "missing" ? live.note : "上游没回模型名"}`);
    }

    const chat = await sendJson("/api/chat/send", "POST", {
      messages: [{ role: "user", content: "只回一个字：好" }],
      model: target,
      max_tokens: 8,
    });
    setBusy("");
    const head = lines.length > 0 ? `${lines.join("；")}。` : "";
    const text = extractChatReply(chat);
    if (text !== null) {
      setTestNote({ tone: "ok", text: `${head}模型回话：「${clip(text)}」` });
      return;
    }
    if (chat.status === 0) {
      setTestNote({ tone: "info", text: `${head}未接：最小对话请求没有发出去（连不上控制台服务）` });
      return;
    }
    if (chat.ok) {
      setTestNote({
        tone: "info",
        text: `${head}未接：对话口回了 200 但没有可读回话（${clip(chat.text, 60)}）`,
      });
      return;
    }
    setTestNote({
      tone: "bad",
      text: `${head}本环境没有测试对话读口：最小对话请求原样回 ${upstreamError(chat, typed)}`,
    });
  }

  const availability = [
    ...(env.read.k === "missing" || env.read.k === "error"
      ? [{ label: "供应商目录", reason: "读不到环境变量清单，第一步与写 key 都不可用" }]
      : []),
    ...(endpoints.read.k === "missing" || endpoints.read.k === "error"
      ? [{ label: "自定义端点清单", reason: "读不到已建好的端点，只能新建" }]
      : []),
    ...(info.read.k === "missing" || info.read.k === "error"
      ? [{ label: "正在生效的模型", reason: "上游没有可用的生效读数" }]
      : []),
    ...(currentFallbacks !== null && currentFallbacks.length === 0
      ? [{ label: "回退链", reason: "配置里回退链是空的（真零），留空就不写这一项" }]
      : []),
  ];

  return (
    <ConsoleCard
      label={<CardTitle title="接入模型供应商" />}
      action={
        // 目录读不到时不端「— 个供应商可选」：卡底的「数据可用性」已经声明过一次缺读口，
        // 正文不再重复铺一个没有数的计数。
        rows === null ? undefined : <span className="cap-action">{`${count(rows.length)} 个供应商可选`}</span>
      }
      availability={availability}
      note="写的是环境变量密钥位（Hermes 真正解析的那条路），不是凭据池的手工行：池里 env 行 priority 0，排在手工条目之前。"
    >
      <div className="cap-prov" data-testid="cap-provider-card">
        {/* 第一段：选供应商 */}
        <section className="cap-prov-sec">
          <div className="cap-inline">
            <span className="cap-eyebrow">第 1 步 · 选供应商</span>
            <span className="cap-grow" />
            <span className="cap-prov-mode" role="group" aria-label="接入方式">
              <button
                className="cap-btn"
                type="button"
                aria-pressed={mode === "builtin"}
                disabled={busy !== ""}
                onClick={() => selectMode("builtin")}
              >
                目录里的供应商
              </button>
              <button
                className="cap-btn"
                type="button"
                aria-pressed={mode === "custom"}
                disabled={busy !== ""}
                onClick={() => selectMode("custom")}
              >
                自定义供应商
              </button>
            </span>
          </div>

          {mode === "builtin" ? (
            env.read.k === "loading" ? (
              <p className="cap-gap-note">正在读取供应商目录…</p>
            ) : env.read.k === "missing" || env.read.k === "error" ? (
              <GapNote>{env.read.note}</GapNote>
            ) : (
              <>
                <div className="cap-prov-pick">
                  <label className="cap-field">
                    <span>供应商</span>
                    <select
                      className="cap-input cap-select"
                      value={selected}
                      disabled={busy !== ""}
                      onChange={(event) => {
                        setSelected(event.target.value);
                        setKeyNote(null);
                      }}
                    >
                      <option value="">请选择</option>
                      {(rows ?? []).map((row) => (
                        <option key={row.provider} value={row.provider}>
                          {row.label} · {row.isSet ? "已配置" : "未配置"}
                        </option>
                      ))}
                    </select>
                  </label>
                  {entry === null ? (
                    <span className="cap-note">选一个供应商后才能填 key。</span>
                  ) : (
                    <span className="cap-prov-state">
                      <Pill tone={entry.isSet ? "ok" : "mut"}>{isSetLabel(env.read, entry)}</Pill>
                      <span className="cap-mono cap-mut" title="写这把 key 用的环境变量名">
                        {entry.envKey}
                      </span>
                      {entry.isSet && entry.preview ? (
                        <span className="cap-mono cap-mut">{entry.preview}</span>
                      ) : null}
                    </span>
                  )}
                </div>
                {entry !== null ? (
                  <p className="cap-prov-desc">
                    {entry.description ?? "上游没给这一家的说明。"}
                    {entry.sharedBy.length > 0
                      ? ` 这把 key 同时服务 ${entry.sharedBy.join("、")}。`
                      : ""}
                    {entry.url ? (
                      <>
                        {" "}
                        <a className="cap-link" href={entry.url} target="_blank" rel="noreferrer">
                          去供应商建 key ↗
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </>
            )
          ) : (
            <>
              <div className="cap-cred-form">
                <label className="cap-field">
                  <span>名称</span>
                  <input
                    className="cap-input"
                    value={customName}
                    placeholder="我的网关"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy !== ""}
                    onChange={(event) => setCustomName(event.target.value)}
                  />
                </label>
                <label className="cap-field">
                  <span>Base URL</span>
                  <input
                    className="cap-input"
                    value={customUrl}
                    placeholder="https://…/v1"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy !== ""}
                    onChange={(event) => setCustomUrl(event.target.value)}
                  />
                </label>
                <label className="cap-field">
                  <span>模型名</span>
                  <input
                    className="cap-input"
                    value={customModel}
                    placeholder="上游必填"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy !== ""}
                    onChange={(event) => setCustomModel(event.target.value)}
                  />
                </label>
              </div>
              {customRows !== null && customRows.length > 0 ? (
                <p className="cap-prov-desc">
                  已建好 {count(customRows.length)} 个端点：
                  {customRows.map((row) => (
                    <span className="cap-mono" key={row.id}>
                      {row.id}
                      {row.isCurrent ? "（正在用）" : ""}{" "}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="cap-prov-desc">
                  {customRows === null ? "自定义端点清单读不到，只能新建。" : "还没有建过自定义端点。"}
                </p>
              )}
            </>
          )}
        </section>

        {/* 第二段：填并校验 key */}
        <section className="cap-prov-sec">
          <span className="cap-eyebrow">第 2 步 · 填并校验 Key</span>
          <div className="cap-cred-form">
            {hasTarget ? (
              <label className="cap-field">
                <span>API Key</span>
                <span className="cap-prov-key">
                  <input
                    className="cap-input cap-prov-key-input"
                    type={revealed ? "text" : "password"}
                    value={apiKey}
                    placeholder={mode === "custom" ? "端点要求的 key（可留空）" : "sk-…"}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy !== ""}
                    onChange={(event) => setApiKey(event.target.value)}
                  />
                  <button
                    className="cap-btn"
                    type="button"
                    disabled={secret.length === 0}
                    aria-pressed={revealed}
                    onClick={() => setRevealed((value) => !value)}
                  >
                    {revealed ? "隐藏" : "显示"}
                  </button>
                </span>
              </label>
            ) : (
              <p className="cap-gap-note">
                {env.read.k === "loading"
                  ? "正在读取供应商目录，读完再选。"
                  : "先在第 1 步选一个供应商，或切到「自定义供应商」，这里才出现 key 输入框。"}
              </p>
            )}
            {mode === "builtin" && baseUrlKey !== null ? (
              <label className="cap-field">
                <span>Base URL（留空不动）</span>
                <input
                  className="cap-input"
                  value={baseUrl}
                  placeholder="https://…"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy !== ""}
                  onChange={(event) => setBaseUrl(event.target.value)}
                />
              </label>
            ) : null}
            <div className="cap-cred-btns">
              <button className="cap-btn" type="button" disabled={!canValidate} onClick={() => void onValidate()}>
                {busy === "validate" ? "校验中…" : "校验"}
              </button>
              <button
                className="cap-btn cap-btn--primary"
                type="button"
                disabled={!canSaveKey}
                onClick={() => void onSaveKey()}
              >
                {busy === "save" ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
          <p className="cap-write-note" data-tone={keyNote?.tone ?? "info"} role="status">
            {keyNote?.text ??
              (mode === "custom"
                ? "保存＝建条目 + 启用；校验＝向这个端点真打一次探测。"
                : `保存写入 ${entry?.envKey ?? "所选供应商的环境变量"}，页面只回显脱敏截断，不显示明文。`)}
          </p>
        </section>

        {/* 第三段：选模型 + 真验证 */}
        <section className="cap-prov-sec">
          <span className="cap-eyebrow">第 3 步 · 选模型并真验证</span>
          <div className="cap-prov-live">
            <span className="cap-note">默认模型</span>
            <span className="cap-mono">{currentModel ?? DASH}</span>
            <span className="cap-note">正在生效</span>
            <span className="cap-mono">
              {liveModel === null ? DASH : `${liveModel.model ?? DASH}${liveModel.provider ? ` @ ${liveModel.provider}` : ""}`}
            </span>
          </div>
          <div className="cap-cred-form">
            <label className="cap-field">
              <span>模型名</span>
              <input
                className="cap-input"
                value={draftModel}
                placeholder={MODEL_EXAMPLE}
                autoComplete="off"
                spellCheck={false}
                disabled={busy !== ""}
                onChange={(event) => setDraftModel(event.target.value)}
              />
            </label>
            <label className="cap-field">
              <span>回退链（留空不写）</span>
              <input
                className="cap-input"
                value={draftFallback}
                placeholder={currentFallbacks && currentFallbacks.length > 0 ? currentFallbacks.join(", ") : "provider/model, …"}
                autoComplete="off"
                spellCheck={false}
                disabled={busy !== ""}
                onChange={(event) => setDraftFallback(event.target.value)}
              />
            </label>
            <div className="cap-cred-btns">
              <button
                className="cap-btn cap-btn--primary"
                type="button"
                disabled={!canSaveModel}
                onClick={() => void onSaveModel()}
              >
                {busy === "model" ? "保存中…" : "保存模型"}
              </button>
              <button
                className="cap-btn"
                type="button"
                disabled={busy !== ""}
                onClick={() => void onTest()}
              >
                {busy === "test" ? "真打中…" : "测试这次配置"}
              </button>
            </div>
          </div>
          <p className="cap-write-note" data-tone={modelNote?.tone ?? "info"} role="status">
            {modelNote?.text ?? "只写默认模型与（填了才写的）回退链，其它配置项不动。"}
          </p>
          <p className="cap-write-note" data-tone={testNote?.tone ?? "info"} role="status">
            {testNote?.text ??
              "「测试这次配置」会真打一次：先探供应商，再发一次最小对话请求；打不通就写打不通。"}
          </p>
        </section>
      </div>
    </ConsoleCard>
  );
}
