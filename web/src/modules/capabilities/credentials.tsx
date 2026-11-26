// 凭据池的读数与写口（模型与单价页的第二张卡）。
//
// GET  /api/credentials/pool → {providers:[{provider, entries:[{index, id, label,
//      auth_type, source, priority, last_status, request_count, token_preview,
//      has_refresh}]}]}；index 是列表里 1 起的序号，DELETE 用的就是它。
// POST /api/credentials/pool → {ok, ...}，体是 {provider, api_key, label?}；这是「手工行」，
//      auth_type 固定 api_key，落进 ~/.hermes/auth.json。
// DELETE /api/credentials/pool/{provider}/{index} → {ok, provider, count, cleaned, hints}
//      env:* 行会顺带从 ~/.hermes/.env 清掉并抑制再种子化，否则下次 load_pool() 又种回来。
//
// 优先级口径（真机实测）：env 导出的同名 key 在池里是 priority 0，手工条目是 priority 1，
// fill_first 策略下 env 行先被选中。所以「换 key」的正确做法是写环境变量
// （见 ProviderAccessCard 第 2 步），往池里加手工行只是补一条备选。
import { useState } from "react";
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { CardTitle } from "./PaneBits";
import { DASH, count, gapText, recordOf, textOf, type Read } from "./paneApi";
import { maskSecret, sendJson, upstreamError, type Note } from "./paneWrite";
import { parseValidateReply, validateNote, type ProviderEntry } from "./providerAccess";

export type CredentialRow = {
  provider: string;
  index: number;
  label: string | null;
  source: string | null;
  priority: number | null;
  lastStatus: string | null;
  requestCount: number | null;
  tokenPreview: string | null;
};

const CRED_STATUS: Record<string, string> = {
  ok: "可用",
  exhausted: "已耗尽",
  dead: "已失效",
  throttled: "限流中",
  error: "出错",
};

/** last_status 为 null 就是「—」——不拿「正常」顶替一次没发生过的判定。 */
export function credStatus(raw: string | null): string {
  if (raw === null) return DASH;
  return CRED_STATUS[raw] ?? raw;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseCredentials(body: unknown): CredentialRow[] | null {
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

export const EMPTY_CREDENTIALS: CredentialRow[] = [];

export interface CredentialPoolCardProps {
  /** 池读数与接入卡共用，所以由父级持有；这里只管删行、加行与重读。 */
  read: Read<CredentialRow[]>;
  reload: () => void;
  /** 供应商目录（同一份 GET /api/env 读数）：手工行的校验要靠它把 provider 映射到键名。 */
  env: Read<ProviderEntry[]>;
}

export function CredentialPoolCard({ read, reload, env }: CredentialPoolCardProps) {
  const [busy, setBusy] = useState<"" | "validate" | "save" | "delete">("");
  const [note, setNote] = useState<Note | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [provider, setProvider] = useState("");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");

  const rows = read.k === "ready" ? read.data : EMPTY_CREDENTIALS;
  const poolCount =
    read.k === "ready"
      ? `池内 ${count(rows.length)} 条`
      : read.k === "empty"
        ? "池内 0 条"
        : read.k === "loading"
          ? "正在读取…"
          : "";

  const providerKey = provider.trim().toLowerCase();
  const typedKey = apiKey.trim();
  // 手工行没有联网校验口，要校验只能借第 1 步那张表的键名映射（provider → <PROVIDER>_API_KEY）。
  const validateKey =
    providerKey === "" || env.k !== "ready"
      ? null
      : (env.data.find((row) => row.provider === providerKey)?.envKey ?? null);
  const canValidate = busy === "" && validateKey !== null && typedKey.length > 0;
  const canSave = busy === "" && providerKey.length > 0 && typedKey.length > 0;

  async function onValidate() {
    if (validateKey === null || typedKey.length === 0) return;
    const secret = apiKey;
    setBusy("validate");
    setNote(null);
    const reply = await sendJson("/api/providers/validate", "POST", { key: validateKey, value: secret });
    setBusy("");
    if (!reply.ok) {
      setNote({ tone: "bad", text: upstreamError(reply, secret) });
      return;
    }
    const state = parseValidateReply(reply, (raw) => maskSecret(raw, secret));
    setNote(
      state === null
        ? { tone: "bad", text: `上游回的形状读不出来：${reply.text.slice(0, 120)}` }
        : validateNote(state, validateKey),
    );
  }

  async function onSave() {
    if (providerKey.length === 0 || typedKey.length === 0) return;
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
      // 失败不清空输入框：改完可以直接再存一次。
      setNote({ tone: "bad", text: upstreamError(reply, secret) });
      return;
    }
    setApiKey("");
    setLabel("");
    setNote({ tone: "ok", text: "已写入凭据池" });
    reload();
  }

  async function onDelete(name: string, index: number) {
    setBusy("delete");
    const reply = await sendJson(`/api/credentials/pool/${encodeURIComponent(name)}/${index}`, "DELETE");
    setBusy("");
    setConfirmKey(null);
    if (!reply.ok) {
      setNote({ tone: "bad", text: upstreamError(reply, null) });
      return;
    }
    setNote({ tone: "ok", text: `已删除 ${name} 的第 ${index} 条凭据` });
    reload();
  }

  return (
    <ConsoleCard
      label={<CardTitle title="正在服务的凭据" />}
      availability={
        read.k === "missing" || read.k === "error"
          ? [{ label: "凭据池", reason: "读不到凭据池，列表与删除暂时不可用" }]
          : []
      }
      note="env 导出的那条 priority 0、手工条目 priority 1：池按 fill_first 先取 env 行，所以换 key 要写环境变量（上面第 2 步），只加手工条目等于没换。"
    >
      <div className="cap-cred" data-testid="cap-cred-card">
        <div className="cap-cred-sec">
          <div className="cap-inline">
            <span className="cap-eyebrow">池内条目</span>
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
                    <span className="cap-cred-tag">优先级 {row.priority === null ? DASH : row.priority}</span>
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
                          <button
                            className="cap-btn"
                            type="button"
                            disabled={busy !== ""}
                            onClick={() => setConfirmKey(null)}
                          >
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
            <p className="cap-gap-note">{gapText(read, "正在读取凭据池…", "凭据池里还没有条目")}</p>
          )}
        </div>

        {/* 手工加一行：写 POST /api/credentials/pool。生效顺序排在 env 行后面（见卡底口径）。 */}
        <div className="cap-cred-sec">
          <span className="cap-eyebrow">手工加一行</span>
          <div className="cap-cred-form">
            <label className="cap-field">
              <span>供应商</span>
              <input
                className="cap-input"
                value={provider}
                placeholder="alibaba"
                autoComplete="off"
                spellCheck={false}
                disabled={busy !== ""}
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
                disabled={busy !== ""}
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
                disabled={busy !== ""}
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
                    : "第 1 步的目录里没有这个供应商，没有可用的校验键名；先保存，再在对话里真打一次"
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
              "这一行进凭据池（auth.json），排在 env 行之后；保存成功即清空 key，页面只回显脱敏预览。"}
          </p>
        </div>
      </div>
    </ConsoleCard>
  );
}
