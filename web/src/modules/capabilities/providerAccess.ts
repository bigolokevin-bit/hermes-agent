// 「接入模型供应商」的纯解析层（无 React，可单测）。
//
// 上游形状（2026-11-26 对 9122→54458 实测）：
//   GET  /api/env → 字典，键是环境变量名；每条 {is_set, redacted_value, description,
//        url, category, is_password, provider, provider_label, provider_profiles:[
//        {provider, provider_label, description, url, primary}], provider_primary, advanced}
//   category=="provider" && is_password 的条目就是供应商密钥位；profiles 里 primary
//   的每一项是一个「能用这把 key 的供应商名」（DASHSCOPE_API_KEY 同时服务 alibaba 与
//   alibaba-cn），所以目录按 profile 出行、按 envKey 标共用。
//   POST /api/providers/validate → {ok, reachable, message}
//        ok&&reachable     真探过，供应商接受
//        ok&&!reachable    该供应商没有联网探针：没校验，不是校验通过
//        !ok               被拒绝，message 是上游原话
//   POST /api/chat/send → 上游没有这个对话读口（实测 405 / 404），原文照贴。
import { listOf, recordOf, textOf } from "./paneApi";
import type { Note, WriteReply } from "./paneWrite";

export type ProviderEntry = {
  /** profile 的供应商 slug（一个 slug 一行）。 */
  provider: string;
  label: string;
  /** 写这把 key 用的环境变量名。 */
  envKey: string;
  isSet: boolean;
  /** 上游脱敏串，去掉 «redacted: … » 外壳后的截断形式。 */
  preview: string | null;
  description: string | null;
  url: string | null;
  /** 该供应商的 *_BASE_URL 环境变量名（没有就 null）。 */
  baseUrlKey: string | null;
  /** 同一把 envKey 还服务哪些供应商名。 */
  sharedBy: string[];
};

function str(value: unknown): string | null {
  return textOf(value);
}

/** «redacted:sk-t...real» → sk-t...real；不是这个形制就原样脱敏串端出。 */
export function formatPreview(redacted: unknown): string | null {
  const raw = str(redacted);
  if (raw === null) return null;
  const inner = raw.match(/^«redacted:(.*)»$/);
  return (inner ? inner[1] : raw).trim() || null;
}

type Slot = {
  envKey: string;
  provider: string;
  label: string;
  isSet: boolean;
  preview: string | null;
  description: string | null;
  url: string | null;
  primary: boolean;
  advanced: boolean;
};

export function parseProviderDirectory(body: unknown): ProviderEntry[] | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  const root = body as Record<string, unknown>;
  const slots: Slot[] = [];
  const baseUrlKeys = new Map<string, string>();

  for (const [name, value] of Object.entries(root)) {
    const meta = recordOf(value);
    if (meta.category !== "provider") continue;
    const provider = str(meta.provider);
    if (meta.is_password === true) {
      const profiles = Array.isArray(meta.provider_profiles) ? meta.provider_profiles : [];
      const primaries = profiles
        .map((item) => recordOf(item))
        .filter((profile) => profile.primary === true);
      const pairs =
        primaries.length > 0
          ? primaries.map((profile) => ({
              provider: str(profile.provider) ?? provider ?? "",
              label: str(profile.provider_label) ?? str(meta.provider_label) ?? "",
            }))
          : [{ provider: provider ?? "", label: str(meta.provider_label) ?? "" }];
      for (const pair of pairs) {
        if (!pair.provider) continue;
        slots.push({
          envKey: name,
          provider: pair.provider,
          label: pair.label || pair.provider,
          isSet: meta.is_set === true,
          preview: formatPreview(meta.redacted_value),
          description: str(meta.description),
          url: str(meta.url),
          primary: meta.provider_primary === true,
          advanced: meta.advanced === true,
        });
      }
      continue;
    }
    // 非密钥位的 provider 条目：只关心 *_BASE_URL（保存时一并写）。
    if (provider && /_BASE_URL$/.test(name) && !baseUrlKeys.has(provider)) {
      baseUrlKeys.set(provider, name);
    }
  }

  if (slots.length === 0) return [];

  // 同一个 slug 可能有多把可写的 key（zai：GLM_API_KEY / ZAI_API_KEY / Z_AI_API_KEY）。
  // 取「这个 provider 自己的、provider_primary 的、非 advanced 的」那把当主写入位，
  // 其余留作共用提示；is_set 看这个 slug 名下有没有任何一把已经配好。
  const byProvider = new Map<string, Slot[]>();
  for (const slot of slots) {
    const list = byProvider.get(slot.provider);
    if (list) list.push(slot);
    else byProvider.set(slot.provider, [slot]);
  }

  const rows: ProviderEntry[] = [];
  for (const [provider, group] of byProvider) {
    const chosen = group.slice().sort((a, b) => {
      if (a.isSet !== b.isSet) return a.isSet ? -1 : 1;
      if (a.primary !== b.primary) return a.primary ? -1 : 1;
      if (a.advanced !== b.advanced) return a.advanced ? 1 : -1;
      return a.envKey.localeCompare(b.envKey);
    })[0];
    // 同一把 key 还挂在哪些供应商名下（envKey 相同、slug 不同）。
    const sharedBy = new Set<string>();
    for (const other of slots) {
      if (other.envKey === chosen.envKey && other.provider !== provider) sharedBy.add(other.provider);
    }
    rows.push({
      provider,
      label: chosen.label,
      envKey: chosen.envKey,
      isSet: group.some((slot) => slot.isSet),
      preview: group.find((slot) => slot.isSet)?.preview ?? chosen.preview ?? null,
      description: chosen.description,
      url: chosen.url,
      baseUrlKey: baseUrlKeys.get(provider) ?? null,
      sharedBy: Array.from(sharedBy).sort(),
    });
  }
  // 排序：已配置的排前面，其余按「写哪把 key」再按 slug 聚拢。
  // 按 label 排会把共用同一把 key 的两家（alibaba / alibaba-cn）拆到列表两头——
  // 管理员照着下拉逐个填就会重复填同一把 key；按 envKey+slug 排，共用一把 key 的
  // 供应商始终相邻，且顺序不再依赖上游怎么起名。
  rows.sort((a, b) => {
    if (a.isSet !== b.isSet) return a.isSet ? -1 : 1;
    if (a.envKey !== b.envKey) return a.envKey.localeCompare(b.envKey);
    return a.provider.localeCompare(b.provider);
  });
  return rows;
}

/* ------------------------------------------------------------------ *
 * 校验三态
 * ------------------------------------------------------------------ */

export type ValidateState = {
  /** pass=真探过并被接受；reject=被拒绝；no-probe=该供应商没有联网校验口。 */
  state: "pass" | "reject" | "no-probe";
  message: string;
};

export function parseValidateReply(
  reply: WriteReply,
  mask: (raw: string) => string,
): ValidateState | null {
  if (!reply.ok) return null;
  const root = recordOf(reply.json);
  if (typeof root.ok !== "boolean") return null;
  const message = mask(str(root.message) ?? "");
  if (root.ok === true && root.reachable === true) return { state: "pass", message };
  if (root.ok === true) return { state: "no-probe", message };
  return { state: "reject", message: message || "上游没给原因" };
}

/**
 * 校验三态各自一句话，`no-probe` 绝不写成通过。向导卡与凭据池卡共用同一套措辞，
 * 免得两张卡对同一个「没有探针」给出两种说法。
 */
export function validateNote(state: ValidateState, envKey: string): Note {
  if (state.state === "pass") return { tone: "ok", text: `联网校验通过：供应商接受了这把 key（${envKey}）` };
  if (state.state === "no-probe") {
    return { tone: "info", text: `本次未校验：${envKey} 没有联网校验口，保存后要靠第三步的真打确认` };
  }
  return { tone: "bad", text: `这把 key 被拒绝：${state.message}` };
}

/* ------------------------------------------------------------------ *
 * 自定义供应商（OpenAI 兼容端点）
 * ------------------------------------------------------------------ */

export type CustomEndpointRow = {
  id: string;
  name: string | null;
  baseUrl: string | null;
  model: string | null;
  hasKey: boolean;
  isCurrent: boolean;
};

export type CustomEndpointsRead = {
  rows: CustomEndpointRow[];
  current: { provider: string | null; model: string | null; baseUrl: string | null } | null;
};

export function parseCustomEndpoints(body: unknown): CustomEndpointsRead | null {
  const root = recordOf(body);
  const items = Array.isArray(root.endpoints) ? root.endpoints : null;
  if (items === null) return null;
  const rows: CustomEndpointRow[] = [];
  for (const [index, item] of items.entries()) {
    const row = recordOf(item);
    const id = str(row.id) ?? `endpoint-${index}`;
    rows.push({
      id,
      name: str(row.name),
      baseUrl: str(row.base_url),
      model: str(row.model),
      hasKey: row.has_api_key === true,
      isCurrent: row.is_current === true,
    });
  }
  const current = root.current === null || root.current === undefined ? null : recordOf(root.current);
  return {
    rows,
    current: current
      ? { provider: str(current.provider), model: str(current.model), baseUrl: str(current.base_url) }
      : null,
  };
}

/** custom-endpoints 的写口把新列表整份回传，这里复用它取刚建好的那条 id。 */
export function parseCreatedEndpoint(reply: WriteReply): { id: string | null } | null {
  const root = recordOf(reply.json);
  if (root.ok !== true) return null;
  return { id: str(root.id) };
}

/* ------------------------------------------------------------------ *
 * 模型与配置
 * ------------------------------------------------------------------ */

export type ModelSettings = {
  model: string | null;
  /** 上游有没有给回退链这一项（有些构建根本没有这个键）。 */
  hasFallback: boolean;
  fallbacks: string[];
};

export function parseModelSettings(body: unknown): ModelSettings | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  const root = recordOf(body);
  const raw = root.fallback_providers;
  const fallbacks: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") {
        if (item.trim()) fallbacks.push(item.trim());
        continue;
      }
      const entry = recordOf(item);
      const provider = str(entry.provider);
      const model = str(entry.model);
      if (provider && model) fallbacks.push(`${provider}/${model}`);
      else if (model) fallbacks.push(model);
    }
  }
  return {
    model: str(root.model),
    hasFallback: "fallback_providers" in root,
    fallbacks,
  };
}

/** 回退链输入 → 上游形制：`provider/model` 拆成对象，裸名只给 model。 */
export function buildFallbackList(value: string): { provider?: string; model: string }[] | null {
  const parts = value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (parts.length === 0) return null;
  return parts.map((item) => {
    const slash = item.indexOf("/");
    return slash > 0
      ? { provider: item.slice(0, slash), model: item.slice(slash + 1) }
      : { model: item };
  });
}

/** 正在生效的模型读数（GET /api/model/info）。 */
export function parseModelInfo(body: unknown): { model: string | null; provider: string | null } | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  const root = recordOf(body);
  if (!("model" in root)) return null;
  return { model: str(root.model), provider: str(root.provider) };
}

/* ------------------------------------------------------------------ *
 * 「真打一次」：最小对话请求的读数
 * ------------------------------------------------------------------ */

const CHAT_TEXT_PATHS: ((root: Record<string, unknown>) => string | null)[] = [
  (root) => {
    const choices = listOf(root.choices ?? null) ?? (Array.isArray(root.choices) ? (root.choices as unknown[]) : null);
    const first = choices && choices.length > 0 ? recordOf(choices[0]) : null;
    if (!first) return null;
    const message = recordOf(first.message);
    return str(message.content) ?? str(first.text);
  },
  (root) => str(root.content) ?? str(root.text) ?? str(root.output_text) ?? str(root.response),
  (root) => {
    const output = listOf(root.output ?? null);
    if (!output || output.length === 0) return null;
    return str(recordOf(recordOf(output[0]).content));
  },
];

/** 2xx 才找回话文本；找不到就 null（按「没有可读回话」处理，不编）。 */
export function extractChatReply(reply: WriteReply): string | null {
  if (!reply.ok) return null;
  const root = recordOf(reply.json);
  for (const pick of CHAT_TEXT_PATHS) {
    const value = pick(root);
    if (value) return value;
  }
  return null;
}
