// @vitest-environment jsdom
//
// 「接入模型供应商」三段流程的行为闸（全用真形状，不打 fixture）：
//   第 1 段 供应商目录来自 GET /api/env 的 provider 类目，显示 label + 是否已配置 + env 键名；
//   第 2 段 校验三态分开表达、保存写 PUT /api/env、回读 is_set、提交后清空明文；
//   第 3 段 模型名写 PUT /api/config 并回读，「测试这次配置」真打一次且没有对话口时不装成功。
// 另加一条硬约束：明文 key 不许出现在页面文本里。
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CapModelsPane } from "./ModelsPane";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Reply = { status: number; body: unknown };

function reply(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    headers: new Headers({ "content-type": "application/json" }),
  } as unknown as Response;
}

const routes = new Map<string, Reply>();

function stub(routeset: Record<string, Reply>) {
  routes.clear();
  for (const [url, value] of Object.entries(routeset)) routes.set(url, value);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const hit =
        routes.get(`${method} ${url}`) ??
        routes.get(url) ??
        routes.get(`${method} ${new URL(url, "http://x").pathname}`) ??
        routes.get(new URL(url, "http://x").pathname);
      if (!hit) return reply(404, { code: "console.unknown_route" });
      return reply(hit.status, hit.body);
    }),
  );
}

const SECRET = "sk-test-not-real";

/** 真机 /api/env 的 provider 类目形状（alibaba 与 alibaba-cn 共用一把 key，deepseek 另有一把）。 */
function envBody(alibabaSet: boolean, alibabaPreview: string | null) {
  return {
    DASHSCOPE_API_KEY: {
      is_set: alibabaSet,
      redacted_value: alibabaPreview,
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
    DEEPSEEK_API_KEY: {
      is_set: false,
      redacted_value: null,
      description: "DeepSeek API key for direct DeepSeek access",
      category: "provider",
      is_password: true,
      advanced: false,
      provider: "deepseek",
      provider_label: "DeepSeek",
      provider_primary: true,
      provider_profiles: [],
    },
    TELEGRAM_BOT_TOKEN: {
      is_set: true,
      category: "channel",
      is_password: true,
      provider: "",
      provider_profiles: [],
    },
  };
}

const POOL_BODY = {
  providers: [
    {
      provider: "alibaba",
      entries: [
        {
          index: 1,
          id: "c99691",
          label: "DASHSCOPE_API_KEY",
          auth_type: "api_key",
          source: "env:DASHSCOPE_API_KEY",
          priority: 0,
          last_status: null,
          request_count: 1,
          token_preview: "sk-w...ufVG",
          has_refresh: false,
        },
      ],
    },
  ],
};

const BASE = {
  "/api/models": { status: 404, body: { detail: "No such API endpoint: /api/models" } },
  "/api/models/pricing": { status: 404, body: { code: "models.pricing_not_wired" } },
  "/api/hermes-usage?days=1": { status: 200, body: { period_days: 1, cost: { cost_usd: null, rows: 0 } } },
  "/api/hermes-usage?days=7": { status: 200, body: { period_days: 7, cost: { cost_usd: 0.9, rows: 12 } } },
  "/api/hermes-usage?days=30": { status: 200, body: { period_days: 30, cost: { cost_usd: 1.27, rows: 85 } } },
  "/api/credentials/pool": { status: 200, body: POOL_BODY },
  "/api/config": { status: 200, body: { model: "qwen-plus", fallback_providers: [] } },
  "/api/model/info": { status: 200, body: { model: "qwen-plus", provider: "alibaba-cn" } },
  "/api/providers/custom-endpoints": {
    status: 200,
    body: { endpoints: [], current: { provider: "alibaba-cn", model: "qwen-plus", base_url: "" } },
  },
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function mount(node: React.ReactNode) {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={["/capabilities"]}>{node}</MemoryRouter>);
  });
  await act(async () => {});
  await act(async () => {});
}

const q = (sel: string) => container.querySelector<HTMLElement>(sel);
const all = (sel: string) => Array.from(container.querySelectorAll<HTMLElement>(sel));
const text = () => container.textContent ?? "";

function click(label: string) {
  const button = all("button")
    .map((node) => node as HTMLButtonElement)
    .find((node) => (node.textContent ?? "").trim() === label && !node.disabled);
  expect(button, `找不到可点的按钮：${label}`).toBeTruthy();
  button!.click();
}

/** React 受控 input：走原生 setter，不然 onChange 不触发。 */
function typeInto(selector: string, value: string) {
  const input = q(selector) as HTMLInputElement;
  expect(input, `找不到输入框：${selector}`).toBeTruthy();
  const proto = input instanceof HTMLInputElement ? HTMLInputElement : HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function pickProvider(value: string) {
  const select = q('.cap-prov-pick select') as HTMLSelectElement;
  expect(select, "第一步的供应商下拉没渲染出来").toBeTruthy();
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
  setter.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function secretField() {
  return q('input[type="password"]') as HTMLInputElement;
}

const calls = () =>
  (fetch as unknown as { mock: { calls: Array<[string, RequestInit | undefined]> } }).mock.calls;

function bodyOf(method: string, url: string) {
  const hit = calls().find(
    ([target, init]) => String(target) === url && (init?.method ?? "GET").toUpperCase() === method,
  );
  return hit?.[1]?.body === undefined ? null : JSON.parse(String(hit![1]!.body));
}

describe("接入模型供应商 · 第 1 段 选供应商", () => {
  it("目录来自 /api/env 的 provider 类目：label + 是否已配置 + env 键名都上屏", async () => {
    stub({ ...BASE, "/api/env": { status: 200, body: envBody(false, null) } });
    await mount(<CapModelsPane />);

    expect(q('[data-testid="cap-provider-card"]')).toBeTruthy();
    expect(text()).toContain("接入模型供应商");
    const options = all(".cap-prov-pick option").map((node) => node.textContent?.trim());
    // 未配置的排后面；channel 类目不进目录；profiles 的 primary 各出一行。
    // 顺序口径：先已配置，再按「写哪把 key」（envKey）聚拢——共用一把 key 的两家
    // （alibaba / alibaba-cn）必须相邻，否则管理员会照着下拉把同一把 key 填两遍。
    expect(options).toEqual([
      "请选择",
      "Qwen Cloud · 未配置",
      "Alibaba Cloud DashScope (China) · 未配置",
      "DeepSeek · 未配置",
    ]);
    expect(options.indexOf("Alibaba Cloud DashScope (China) · 未配置")).toBe(
      options.indexOf("Qwen Cloud · 未配置") + 1,
    );

    pickProvider("alibaba");
    expect(text()).toContain("DASHSCOPE_API_KEY");
    expect(text()).toContain("未配置");
    expect(text()).toContain("这把 key 同时服务 alibaba-cn");
    // 工程语言不占正文主位：端点名只出现在小字/说明里。
    // 只数向导卡自己的小标题——同一页的凭据池卡与用量卡也有 cap-eyebrow，
    // 那是它们自己的小节名，不该被这条「三段一条直线」的断言算进来。
    expect(all('[data-testid="cap-provider-card"] .cap-eyebrow').map((node) => node.textContent)).toEqual([
      "第 1 步 · 选供应商",
      "第 2 步 · 填并校验 Key",
      "第 3 步 · 选模型并真验证",
    ]);
    expect(all("h1")).toHaveLength(0);
    expect(all('[role="tablist"]')).toHaveLength(0);
  });

  it("已配置的供应商直接把脱敏截断端出来，页面没有明文", async () => {
    stub({ ...BASE, "/api/env": { status: 200, body: envBody(true, "«redacted:sk-w...ufVG»") } });
    await mount(<CapModelsPane />);
    pickProvider("alibaba");
    expect(text()).toContain("已配置");
    expect(text()).toContain("sk-w...ufVG");
    expect(text()).not.toMatch(/sk-[A-Za-z0-9_-]{12,}/);
  });

  it("/api/env 没有读口时第一步点名缺读口，不摆空下拉", async () => {
    stub({ ...BASE, "/api/env": { status: 502, body: { code: "console.upstream_unavailable" } } });
    await mount(<CapModelsPane />);
    expect(all(".cap-prov-pick select")).toHaveLength(0);
    expect(text()).toContain("缺读口：上游服务此刻不可达");
  });
});

describe("接入模型供应商 · 第 2 段 填并校验 Key", () => {
  it("校验通过：ok+reachable 才说通过", async () => {
    stub({
      ...BASE,
      "/api/env": { status: 200, body: envBody(false, null) },
      "POST /api/providers/validate": { status: 200, body: { ok: true, reachable: true, message: "" } },
    });
    await mount(<CapModelsPane />);
    pickProvider("alibaba");
    typeInto('input[type="password"]', SECRET);
    await act(async () => {});
    click("校验");
    await act(async () => {});
    expect(text()).toContain("联网校验通过");
    expect(bodyOf("POST", "/api/providers/validate")).toEqual({ key: "DASHSCOPE_API_KEY", value: SECRET });
  });

  it("被拒绝：上游 message 原文上屏，页面不回显明文", async () => {
    stub({
      ...BASE,
      "/api/env": { status: 200, body: envBody(false, null) },
      "POST /api/providers/validate": {
        status: 200,
        body: { ok: false, reachable: true, message: "That API key was rejected. Double-check it and try again." },
      },
    });
    await mount(<CapModelsPane />);
    pickProvider("alibaba");
    typeInto('input[type="password"]', SECRET);
    await act(async () => {});
    click("校验");
    await act(async () => {});
    expect(text()).toContain("That API key was rejected. Double-check it and try again.");
    expect(text()).toContain("这把 key 被拒绝");
    expect(text()).not.toContain("联网校验通过");
    expect(text()).not.toContain(SECRET);
  });

  it("无探针：reachable:false 写「本次未校验」，不许显示成通过", async () => {
    stub({
      ...BASE,
      "/api/env": { status: 200, body: envBody(false, null) },
      "POST /api/providers/validate": { status: 200, body: { ok: true, reachable: false, message: "" } },
    });
    await mount(<CapModelsPane />);
    pickProvider("alibaba");
    typeInto('input[type="password"]', SECRET);
    await act(async () => {});
    click("校验");
    await act(async () => {});
    expect(text()).toContain("本次未校验");
    expect(text()).toContain("没有联网校验口");
    expect(text()).not.toContain("校验通过");
  });

  it("保存：PUT /api/env 写键名，回读 is_set=true 并端出脱敏，输入框当场清空", async () => {
    let alibabaSet = false;
    let alibabaPreview: string | null = null;
    stub({
      ...BASE,
      "/api/env": { status: 200, body: envBody(alibabaSet, alibabaPreview) },
      "PUT /api/env": { status: 200, body: { ok: true, key: "DASHSCOPE_API_KEY", config_updates: [] } },
    });
    await mount(<CapModelsPane />);
    pickProvider("alibaba");
    typeInto('input[type="password"]', SECRET);
    await act(async () => {});
    click("保存");
    // 保存成功后上游把这条键位置上了：改 stub 再让页面回读一次 /api/env。
    alibabaSet = true;
    alibabaPreview = "«redacted:sk-t...real»";
    routes.set("/api/env", { status: 200, body: envBody(alibabaSet, alibabaPreview) });
    await act(async () => {});
    await act(async () => {});

    expect(bodyOf("PUT", "/api/env")).toEqual({ key: "DASHSCOPE_API_KEY", value: SECRET });
    expect(secretField().value).toBe("");
    expect(text()).toContain("已写入 DASHSCOPE_API_KEY");
    expect(text()).toContain("回读 is_set=true");
    expect(text()).toContain("sk-t...real");
    expect(text()).toContain("已覆盖正在服务的凭据");
    expect(text()).not.toContain(SECRET);
  });

  it("保存失败：HTTP 码 + 上游 detail 原文上屏，明文不外泄", async () => {
    stub({
      ...BASE,
      "/api/env": { status: 200, body: envBody(false, null) },
      "PUT /api/env": { status: 401, body: { detail: "Unauthorized" } },
    });
    await mount(<CapModelsPane />);
    pickProvider("alibaba");
    typeInto('input[type="password"]', SECRET);
    await act(async () => {});
    click("保存");
    await act(async () => {});
    expect(text()).toContain("Unauthorized");
    expect(text()).toContain("HTTP 401");
    expect(text()).not.toContain(SECRET);
    // 失败不动输入框：用户可以直接改完再存。
    expect(secretField().value).toBe(SECRET);
  });

  it("上游回 200 但回读仍 is_set=false：说没置上，不报成功", async () => {
    stub({
      ...BASE,
      "/api/env": { status: 200, body: envBody(false, null) },
      "PUT /api/env": { status: 200, body: { ok: true, key: "DASHSCOPE_API_KEY", config_updates: [] } },
    });
    await mount(<CapModelsPane />);
    pickProvider("alibaba");
    typeInto('input[type="password"]', SECRET);
    await act(async () => {});
    click("保存");
    await act(async () => {});
    await act(async () => {});
    expect(text()).toContain("仍是 is_set=false");
    expect(text()).not.toContain("回读 is_set=true");
  });

  it("选了 Base URL 才一并写 *_BASE_URL 那一位", async () => {
    stub({
      ...BASE,
      "/api/env": { status: 200, body: envBody(true, "«redacted:sk-w...ufVG»") },
      "PUT /api/env": { status: 200, body: { ok: true } },
    });
    await mount(<CapModelsPane />);
    pickProvider("alibaba");
    typeInto('input[placeholder="https://…"]', "https://dashscope.example.cn/v1");
    typeInto('input[type="password"]', SECRET);
    await act(async () => {});
    click("保存");
    await act(async () => {});
    await act(async () => {});
    const writes = calls()
      .filter(([, init]) => (init?.method ?? "GET").toUpperCase() === "PUT" && String()[0] === undefined)
      .map(([, init]) => JSON.parse(String(init!.body)));
    expect(writes).toEqual([
      { key: "DASHSCOPE_API_KEY", value: SECRET },
      { key: "DASHSCOPE_BASE_URL", value: "https://dashscope.example.cn/v1" },
    ]);
    expect(text()).toContain("DASHSCOPE_BASE_URL 已写入");
  });
});

describe("接入模型供应商 · 自定义供应商", () => {
  it("切到自定义：建条目成功后启用，两段结果分开说", async () => {
    stub({
      ...BASE,
      "/api/env": { status: 200, body: envBody(false, null) },
      "POST /api/providers/custom-endpoints": {
        status: 200,
        body: {
          ok: true,
          id: "my-gateway",
          endpoints: [
            { id: "my-gateway", name: "我的网关", base_url: "http://127.0.0.1:4000/v1", model: "glm-4.6", is_current: false, has_api_key: true },
          ],
          current: { provider: "alibaba-cn", model: "qwen-plus", base_url: "" },
        },
      },
      "POST /api/providers/custom-endpoints/my-gateway/activate": {
        status: 200,
        body: { ok: true, provider: "my-gateway", model: "glm-4.6" },
      },
    });
    await mount(<CapModelsPane />);
    click("自定义供应商");
    await act(async () => {});
    typeInto('input[placeholder="我的网关"]', "我的网关");
    typeInto('input[placeholder="https://…/v1"]', "http://127.0.0.1:4000/v1");
    typeInto('input[placeholder="上游必填"]', "glm-4.6");
    typeInto('input[type="password"]', SECRET);
    await act(async () => {});
    // 保存前：明文只活在输入框里（就是刚敲进去的那份草稿），屏上没有第二份。
    expect(secretField().value).toBe(SECRET);
    expect(text()).not.toContain(SECRET);
    click("保存");
    await act(async () => {});
    await act(async () => {});
    expect(bodyOf("POST", "/api/providers/custom-endpoints")).toEqual({
      id: "",
      name: "我的网关",
      base_url: "http://127.0.0.1:4000/v1",
      model: "glm-4.6",
      api_key: SECRET,
      make_default: false,
    });
    expect(calls().some(([url, init]) => String(url).endsWith("/api/providers/custom-endpoints/my-gateway/activate") && init?.method === "POST")).toBe(true);
    expect(text()).toContain("已接入并启用：my-gateway");
    expect(text()).toContain("glm-4.6");
    // 建好之后输入框当场清空，页面不留明文。
    expect(secretField().value).toBe("");
    expect(text()).not.toContain(SECRET);
  });

  it("建好但启用失败：写明白文已丢，条目还在", async () => {
    stub({
      ...BASE,
      "/api/env": { status: 200, body: envBody(false, null) },
      "POST /api/providers/custom-endpoints": { status: 200, body: { ok: true, id: "my-gateway", endpoints: [] } },
      "POST /api/providers/custom-endpoints/my-gateway/activate": {
        status: 400,
        body: { detail: "custom endpoint is incomplete" },
      },
    });
    await mount(<CapModelsPane />);
    click("自定义供应商");
    await act(async () => {});
    typeInto('input[placeholder="我的网关"]', "我的网关");
    typeInto('input[placeholder="https://…/v1"]', "http://127.0.0.1:4000/v1");
    typeInto('input[placeholder="上游必填"]', "glm-4.6");
    typeInto('input[type="password"]', SECRET);
    await act(async () => {});
    click("保存");
    await act(async () => {});
    await act(async () => {});
    expect(text()).toContain("条目 my-gateway 已写入，但启用失败");
    expect(text()).toContain("custom endpoint is incomplete");
    expect(text()).toContain("HTTP 400");
    expect(text()).not.toContain(SECRET);
  });
});

describe("接入模型供应商 · 第 3 段 选模型并真验证", () => {
  it("保存模型名：PUT /api/config 只送 model，回读端出真正生效的那条", async () => {
    stub({
      ...BASE,
      "/api/env": { status: 200, body: envBody(false, null) },
      "PUT /api/config": { status: 200, body: { ok: true } },
    });
    await mount(<CapModelsPane />);
    typeInto('.cap-prov-sec:last-child input[placeholder="qwen-plus"]', "qwen3-max");
    await act(async () => {});
    click("保存模型");
    await act(async () => {});
    await act(async () => {});
    expect(bodyOf("PUT", "/api/config")).toEqual({ config: { model: "qwen3-max" } });
    expect(text()).toContain("已保存并回读：默认模型 qwen-plus");
    // 上游回读还是旧名 —— 这一句必须照实说，不能把 PUT 的 200 当成功。
    expect(text()).toContain("不是 qwen3-max");
  });

  it("回退链填了才写，且拆成 provider/model", async () => {
    stub({
      ...BASE,
      "/api/env": { status: 200, body: envBody(false, null) },
      "/api/config": { status: 200, body: { model: "qwen3-max", fallback_providers: [] } },
      "PUT /api/config": { status: 200, body: { ok: true } },
    });
    await mount(<CapModelsPane />);
    typeInto('.cap-prov-sec:last-child input[placeholder="qwen-plus"]', "qwen3-max");
    typeInto('.cap-prov-sec:last-child input[placeholder="provider/model, …"]', "xai/grok-4");
    await act(async () => {});
    click("保存模型");
    await act(async () => {});
    await act(async () => {});
    expect(bodyOf("PUT", "/api/config")).toEqual({
      config: { model: "qwen3-max", fallback_providers: [{ provider: "xai", model: "grok-4" }] },
    });
    expect(text()).toContain("已保存并回读：默认模型 qwen3-max");
    expect(text()).toContain("回退链 0 条");
  });

  it("真验证没有对话读口：把上游原话贴上来并写「没有测试对话读口」，不装成功", async () => {
    stub({
      ...BASE,
      "/api/env": { status: 200, body: envBody(false, null) },
      "/api/model/info": { status: 200, body: { model: "qwen-plus", provider: "alibaba-cn" } },
      "POST /api/chat/send": { status: 405, body: { detail: "Method Not Allowed" } },
    });
    await mount(<CapModelsPane />);
    click("测试这次配置");
    await act(async () => {});
    await act(async () => {});
    expect(bodyOf("POST", "/api/chat/send")).toEqual({
      messages: [{ role: "user", content: "只回一个字：好" }],
      model: "qwen-plus",
      max_tokens: 8,
    });
    expect(text()).toContain("本环境没有测试对话读口");
    expect(text()).toContain("Method Not Allowed");
    expect(text()).toContain("HTTP 405");
    expect(text()).toContain("此刻生效：qwen-plus @ alibaba-cn");
    expect(text()).not.toContain("模型回话");
  });

  it("真验证拿到回话：只显示前 80 字", async () => {
    const long = "好".repeat(120);
    stub({
      ...BASE,
      "/api/env": { status: 200, body: envBody(false, null) },
      "POST /api/chat/send": { status: 200, body: { choices: [{ message: { content: long } }] } },
    });
    await mount(<CapModelsPane />);
    click("测试这次配置");
    await act(async () => {});
    await act(async () => {});
    expect(text()).toContain(`模型回话：「${"好".repeat(80)}…」`);
    expect(text()).not.toContain(long);
  });

  it("凭据池卡只读 + 删除，并写明 env 行排在手工条目前面", async () => {
    stub({
      ...BASE,
      "/api/env": { status: 200, body: envBody(false, null) },
      "DELETE /api/credentials/pool/alibaba/1": { status: 200, body: { ok: true, provider: "alibaba", count: 0 } },
    });
    await mount(<CapModelsPane />);
    const row = all('[data-testid="cap-cred-row"]')[0]!;
    expect(row.textContent).toContain("env:DASHSCOPE_API_KEY");
    expect(row.textContent).toContain("优先级 0");
    expect(row.textContent).toContain("状态 —");
    expect(text()).toContain("换 key 要写环境变量");
    click("删除");
    await act(async () => {});
    expect(text()).toContain("确认删除");
    click("确认删除");
    await act(async () => {});
    await act(async () => {});
    expect(text()).toContain("已删除 alibaba 的第 1 条凭据");
  });
});
