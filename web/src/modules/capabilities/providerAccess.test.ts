// providerAccess.ts 的纯函数用例：全部拿 2026-11-26 从 9122→54458 抓下来的真形状当料。
import { describe, expect, it } from "vitest";

import type { WriteReply } from "./paneWrite";
import {
  buildFallbackList,
  extractChatReply,
  formatPreview,
  parseCustomEndpoints,
  parseModelInfo,
  parseModelSettings,
  parseProviderDirectory,
  parseValidateReply,
} from "./providerAccess";

/** 真机 /api/env 的三条代表：一把 key 两个供应商名、一个供应商三把 key、只有 BASE_URL。 */
const ENV_BODY = {
  DASHSCOPE_API_KEY: {
    is_set: false,
    redacted_value: null,
    description: "Alibaba Cloud DashScope API key (Qwen + multi-provider models)",
    url: "https://modelstudio.console.alibabacloud.com/",
    category: "provider",
    is_password: true,
    advanced: false,
    provider: "alibaba",
    provider_label: "Qwen Cloud",
    provider_primary: true,
    provider_profiles: [
      { provider: "alibaba", provider_label: "Qwen Cloud", primary: true },
      { provider: "alibaba-cn", provider_label: "Alibaba Cloud DashScope (China)", primary: true },
      { provider: "alibaba-coding-plan", provider_label: "Alibaba Cloud (Coding Plan)", primary: false },
    ],
  },
  DASHSCOPE_BASE_URL: {
    is_set: false,
    redacted_value: null,
    category: "provider",
    is_password: false,
    provider: "alibaba",
    provider_label: "Qwen Cloud",
    provider_profiles: [],
  },
  DASHSCOPE_CN_BASE_URL: {
    is_set: false,
    redacted_value: null,
    category: "provider",
    is_password: false,
    provider: "alibaba-cn",
    provider_label: "Alibaba Cloud DashScope (China)",
    provider_profiles: [],
  },
  ZAI_API_KEY: {
    is_set: false,
    category: "provider",
    is_password: true,
    advanced: true,
    provider: "zai",
    provider_label: "Z.AI (GLM)",
    provider_primary: false,
    provider_profiles: [],
  },
  GLM_API_KEY: {
    is_set: true,
    // 真机 redacted 形制：«redacted:sk-t...real»
    redacted_value: "«redacted:sk-g...7Qd2»",
    category: "provider",
    is_password: true,
    advanced: true,
    provider: "zai",
    provider_label: "Z.AI (GLM)",
    provider_primary: true,
    provider_profiles: [],
  },
  // 非 provider 类目不能进目录（工具密钥、渠道托管凭证都排除在外）。
  TELEGRAM_BOT_TOKEN: {
    is_set: true,
    category: "channel",
    is_password: true,
    provider: "",
    provider_profiles: [],
  },
  OPENAI_BASE_URL: {
    is_set: false,
    category: "provider",
    is_password: false,
    provider: "openai-api",
    provider_label: "OpenAI API",
    provider_profiles: [],
  },
};

describe("parseProviderDirectory", () => {
  const rows = parseProviderDirectory(ENV_BODY) ?? [];

  it("按 provider_profiles 的 primary 出行：一把 key 出两行，并标出共用", () => {
    expect(rows.map((row) => row.provider)).toEqual(["zai", "alibaba", "alibaba-cn"]);
    const alibaba = rows.find((row) => row.provider === "alibaba");
    expect(alibaba?.envKey).toBe("DASHSCOPE_API_KEY");
    expect(alibaba?.sharedBy).toEqual(["alibaba-cn"]);
    // primary:false 的 profile（coding-plan）不单独成行。
    expect(rows.some((row) => row.provider === "alibaba-coding-plan")).toBe(false);
  });

  it("同一供应商多把 key 时取 provider_primary 那把，且 is_set 看名下任意一把", () => {
    const zai = rows.find((row) => row.provider === "zai");
    expect(zai?.envKey).toBe("GLM_API_KEY");
    expect(zai?.isSet).toBe(true);
    expect(zai?.preview).toBe("sk-g...7Qd2");
  });

  it("已配置的排前面；非 provider 类目与非密钥位条目不进目录", () => {
    expect(rows[0]?.provider).toBe("zai");
    expect(rows.some((row) => row.provider === "openai-api")).toBe(false);
    expect(rows.some((row) => row.envKey === "TELEGRAM_BOT_TOKEN")).toBe(false);
  });

  it("*_BASE_URL 同 provider 才有，作为可选的第二写入位", () => {
    const rows2 = parseProviderDirectory(ENV_BODY) ?? [];
    expect(rows2.find((row) => row.provider === "alibaba")?.baseUrlKey).toBe("DASHSCOPE_BASE_URL");
    expect(rows2.find((row) => row.provider === "alibaba-cn")?.baseUrlKey).toBe("DASHSCOPE_CN_BASE_URL");
    expect(rows2.find((row) => row.provider === "zai")?.baseUrlKey).toBe(null);
  });

  it("形状不对就 null（不猜），空字典给空清单", () => {
    expect(parseProviderDirectory([])).toBe(null);
    expect(parseProviderDirectory(null)).toBe(null);
    expect(parseProviderDirectory({})).toEqual([]);
  });

  it("formatPreview 只脱敏外壳，认不出形制就原样端出", () => {
    expect(formatPreview("«redacted:sk-a...1234»")).toBe("sk-a...1234");
    expect(formatPreview("sk-a...1234")).toBe("sk-a...1234");
    expect(formatPreview(null)).toBe(null);
    expect(formatPreview("   ")).toBe(null);
  });
});

describe("parseValidateReply", () => {
  const mask = (raw: string) => raw;
  const reply = (json: unknown, status = 200): WriteReply => ({
    ok: status < 400,
    status,
    json,
    text: JSON.stringify(json),
  });

  it("ok+reachable = 通过", () => {
    expect(parseValidateReply(reply({ ok: true, reachable: true, message: "" }), mask)?.state).toBe("pass");
  });

  it("ok+!reachable = 没有校验口，不是通过", () => {
    expect(parseValidateReply(reply({ ok: true, reachable: false, message: "" }), mask)?.state).toBe("no-probe");
  });

  it("!ok = 被拒绝，message 原样端出", () => {
    const state = parseValidateReply(
      reply({ ok: false, reachable: true, message: "That API key was rejected. Double-check it and try again." }),
      mask,
    );
    expect(state?.state).toBe("reject");
    expect(state?.message).toBe("That API key was rejected. Double-check it and try again.");
  });

  it("HTTP 非 2xx 或形状不认识都给 null，交给调用方贴原文", () => {
    expect(parseValidateReply(reply({ detail: "boom" }, 401), mask)).toBe(null);
    expect(parseValidateReply(reply({ reachable: true }, 200), mask)).toBe(null);
  });
});

describe("自定义端点 / 配置 / 回退链", () => {
  it("custom-endpoints 回读 rows + current", () => {
    const read = parseCustomEndpoints({
      endpoints: [
        {
          id: "probe",
          name: "probe-临时",
          base_url: "http://127.0.0.1:59999/v1",
          model: "probe-model",
          has_api_key: true,
          is_current: false,
          source: "providers",
        },
      ],
      current: { provider: "alibaba-cn", model: "qwen-plus", base_url: "" },
    });
    expect(read?.rows[0]?.id).toBe("probe");
    expect(read?.rows[0]?.hasKey).toBe(true);
    expect(read?.current?.model).toBe("qwen-plus");
    expect(parseCustomEndpoints({ detail: "no" })).toBe(null);
  });

  it("PUT /api/config 的回读：model 与 fallback_providers 两种形制都收", () => {
    expect(parseModelSettings({ model: "qwen-plus", fallback_providers: [] })).toEqual({
      model: "qwen-plus",
      hasFallback: true,
      fallbacks: [],
    });
    const mixed = parseModelSettings({
      model: "qwen-plus",
      fallback_providers: ["openrouter/deepseek-r1", { provider: "xai", model: "grok-4" }, { model: "glm-4.6" }],
    });
    expect(mixed?.fallbacks).toEqual(["openrouter/deepseek-r1", "xai/grok-4", "glm-4.6"]);
    expect(parseModelSettings({})?.hasFallback).toBe(false);
  });

  it("回退链输入：provider/model 拆对象，裸名只给 model，留空不写", () => {
    expect(buildFallbackList("xai/grok-4, openrouter/deepseek-r1")).toEqual([
      { provider: "xai", model: "grok-4" },
      { provider: "openrouter", model: "deepseek-r1" },
    ]);
    expect(buildFallbackList("glm-4.6")).toEqual([{ model: "glm-4.6" }]);
    expect(buildFallbackList("  ,  ")).toBe(null);
  });

  it("model/info 只收有 model 键的形状", () => {
    expect(parseModelInfo({ model: "qwen-plus", provider: "alibaba-cn", auto_context_length: 131072 })).toEqual({
      model: "qwen-plus",
      provider: "alibaba-cn",
    });
    expect(parseModelInfo({ detail: "No such API endpoint" })).toBe(null);
  });
});

describe("extractChatReply", () => {
  const ok = (json: unknown): WriteReply => ({ ok: true, status: 200, json, text: JSON.stringify(json) });

  it("OpenAI / Responses / 裸文本三种形状都认", () => {
    expect(extractChatReply(ok({ choices: [{ message: { content: "好" } }] }))).toBe("好");
    expect(extractChatReply(ok({ output_text: "收到" }))).toBe("收到");
    expect(extractChatReply(ok({ text: "在" }))).toBe("在");
  });

  it("200 但没回话、或非 2xx 一律 null（不许拿空壳冒充成功）", () => {
    expect(extractChatReply(ok({ choices: [] }))).toBe(null);
    expect(extractChatReply({ ok: false, status: 405, json: { detail: "Method Not Allowed" }, text: "" })).toBe(null);
  });
});
