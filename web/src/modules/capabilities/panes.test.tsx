// @vitest-environment jsdom
//
// /capabilities 四页的形制闸（骨架对齐 + 诚实读数）：
//   1. 块数与骨架一致（技能 7 / 工具 4 / 模型 6 / 平台 7）；
//   2. 每个 pane 的页头副行、表格列名与骨架逐字对齐；
//   3. 没有读口的列写「—」，并有一条「缺读口」说明；真读数照实上屏；
//   4. 页内不出现第二套 h1、不出现 [role=tablist]、不出现 [data-fixture]。
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CapSkillsPane } from "./SkillsPane";
import { CapToolsPane } from "./ToolsPane";
import { CapModelsPane } from "./ModelsPane";
import { CapChannelsPane } from "./ChannelsPane";

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
      // 写口按「METHOD /url」注册，读口仍按裸 URL（老用例不用改）。
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
const cards = () => all(".console-card").length;
const headers = (index = 0) =>
  Array.from(container.querySelectorAll("table")[index]?.querySelectorAll("th") ?? []).map(
    (th) => th.textContent?.trim() ?? "",
  );
const text = () => container.textContent ?? "";

function shapeGuards() {
  expect(all("h1")).toHaveLength(0);
  expect(all('[role="tablist"]')).toHaveLength(0);
  expect(all("[data-fixture]")).toHaveLength(0);
}

describe("能力与接入 · 技能", () => {
  it("七块、副行对齐骨架；台账回传的列照实画，没有读口的列整列不画", async () => {
    stub({
      "/api/skills": {
        status: 200,
        body: {
          items: [
            {
              skillId: "skl_1",
              name: "检索增强",
              version: "2.1.0",
              sharedCount: 6,
              scope: "tenant-shared",
              enabled: true,
            },
            {
              skillId: "skl_2",
              name: "表格计算",
              version: "0.3.0",
              sharedCount: 0,
              scope: "unused",
              enabled: false,
            },
          ],
          asOf: "2026-11-24T06:30:00Z",
        },
      },
      "/api/skill-proposals": { status: 404, body: { detail: "Not Found" } },
    });
    await mount(<CapSkillsPane />);

    expect(cards()).toBe(7);
    expect(q(".cap-sub")!.textContent).toBe("2 个已发布 · — 个提案 · — 个可发现");
    // 骨架列序：技能 | 版本 | 来源 | 能力 | 挂载 | 7 天调用 | 状态
    // 台账只回传名称、版本、共享范围、挂载与启用状态，其余三列整列不出现。
    expect(headers(0)).toEqual(["技能", "版本", "共享范围", "挂载", "状态"]);
    expect(headers(1)).toEqual([]);

    const row = all('[data-testid="cap-skill-row"]');
    expect(row).toHaveLength(2);
    const cells = Array.from(row[0]!.querySelectorAll("td")).map((td) => td.textContent?.trim());
    expect(cells).toEqual(["检索增强", "2.1.0", "团队共享", "6", "可用"]);

    // 提案端点未接线：队列里只有一行缺读口，没有编造的提案
    expect(text()).toContain("缺读口：上游端点未接线");
    expect(text()).toContain("缺读口：来源、能力标签、7 天调用");
    shapeGuards();
  });

  it("台账只回名称与版本时，其余列连表头都不出现", async () => {
    stub({
      "/api/skills": {
        status: 200,
        body: {
          items: [{ skillId: "skl_1", name: "检索增强", version: "2.1.0" }],
          asOf: "2026-11-24T06:30:00Z",
        },
      },
      "/api/skill-proposals": { status: 404, body: { detail: "Not Found" } },
    });
    await mount(<CapSkillsPane />);

    expect(headers(0)).toEqual(["技能", "版本"]);
    const cells = Array.from(
      all('[data-testid="cap-skill-row"]')[0]!.querySelectorAll("td"),
    ).map((td) => td.textContent?.trim());
    expect(cells).toEqual(["检索增强", "2.1.0"]);
  });

  it("技能台账真零时写「真零」而不是编一行", async () => {
    stub({
      "/api/skills": { status: 200, body: { items: [], asOf: "2026-11-24T06:30:00Z" } },
      "/api/skill-proposals": { status: 404, body: { detail: "Not Found" } },
    });
    await mount(<CapSkillsPane />);
    expect(q(".cap-sub")!.textContent).toBe("0 个已发布 · — 个提案 · — 个可发现");
    expect(text()).toContain("技能台账里还没有已发布的技能");
    expect(cards()).toBe(7);
  });
});

describe("能力与接入 · 工具与 MCP", () => {
  it("四块、副行对齐骨架；上游不可达时不摆空表，只写缺读口", async () => {
    stub({
      "/api/tools/toolsets": { status: 502, body: { code: "console.upstream_unavailable" } },
      "/api/mcp/servers": { status: 404, body: { code: "mcp.read_not_wired" } },
    });
    await mount(<CapToolsPane />);

    expect(cards()).toBe(4);
    expect(q(".cap-sub")!.textContent).toBe("— 个内置工具 · — 个 MCP 服务器 · — 个已授权工具");
    expect(all("table")).toHaveLength(0);
    expect(text()).toContain("缺读口：上游服务此刻不可达");
    expect(text()).toContain("缺读口：接入请求队列未接线");
    shapeGuards();
  });

  it("工具登记回数时按读口裁列：沙箱与 7 天调用没有源就不画", async () => {
    stub({
      "/api/tools/toolsets": {
        status: 200,
        body: {
          items: [
            { name: "web_fetch", description: "抓取公开网页", risk: "low", default: true },
            { name: "shell", description: "执行命令", risk: "high", default: false },
          ],
          asOf: "2026-11-24T06:30:00Z",
        },
      },
      "/api/mcp/servers": {
        status: 200,
        body: {
          servers: [{ id: "srv_1", name: "notion-mcp", transport: "stdio", tools: ["search"], state: "connected" }],
          asOf: "2026-11-24T06:30:00Z",
        },
      },
    });
    await mount(<CapToolsPane />);

    expect(q(".cap-sub")!.textContent).toBe("2 个内置工具 · 1 个 MCP 服务器 · — 个已授权工具");
    expect(headers(0)).toEqual(["工具", "作用", "风险", "默认"]);
    expect(headers(1)).toEqual(["名称", "传输", "工具", "状态"]);
    const toolRow = Array.from(
      all('[data-testid="cap-tool-row"]')[0]!.querySelectorAll("td"),
    ).map((td) => td.textContent?.trim());
    expect(toolRow).toEqual(["web_fetch", "抓取公开网页", "低", "开"]);
    const serverRow = Array.from(
      all('[data-testid="cap-server-row"]')[0]!.querySelectorAll("td"),
    ).map((td) => td.textContent?.trim());
    expect(serverRow).toEqual(["notion-mcp", "stdio", "1", "已连接"]);
    shapeGuards();
  });
});

describe("能力与接入 · 模型与单价", () => {
  const liveStubs = {
    "/api/models": {
      status: 200,
      body: { items: [{ id: "qwen3-max", name: "qwen3-max", provider: "dashscope", context_window: 131072, status: "ok" }] },
    },
    "/api/models/pricing": { status: 404, body: { code: "models.pricing_not_wired" } },
    "/api/hermes-usage?days=1": {
      status: 200,
      body: { period_days: 1, cost: { cost_usd: null, rows: 0 }, by_model: null },
    },
    "/api/hermes-usage?days=7": {
      status: 200,
      body: { period_days: 7, cost: { cost_usd: 0.9, rows: 12 }, by_model: null },
    },
    "/api/hermes-usage?days=30": {
      status: 200,
      body: { period_days: 30, cost: { cost_usd: 1.27, rows: 85 }, by_model: null },
    },
  };

  /** 与 parity-probe 同一口径的破折号计数（— / 未接入 / 待核实）。 */
  function dashCount(): number {
    const t = text();
    return (t.match(/—/g) ?? []).length + (t.match(/未接入/g) ?? []).length + (t.match(/待核实/g) ?? []).length;
  }

  it("八块（首块是接入模型供应商写口，次块是正在服务的凭据池）；价目未接线时单价整列不画、缺列在卡底可用性点名，真读数照实上屏", async () => {
    stub({
      ...liveStubs,
      "/api/env": {
        status: 200,
        body: {
          DASHSCOPE_API_KEY: {
            is_set: true,
            redacted_value: "«redacted:sk-w...ufVG»",
            category: "provider",
            is_password: true,
            provider: "alibaba",
            provider_label: "Qwen Cloud",
            provider_primary: true,
            provider_profiles: [{ provider: "alibaba", provider_label: "Qwen Cloud", primary: true }],
          },
        },
      },
      "/api/config": { status: 200, body: { model: "qwen-plus", fallback_providers: [] } },
      "/api/model/info": { status: 200, body: { model: "qwen-plus", provider: "alibaba-cn" } },
      "/api/credentials/pool": { status: 200, body: { providers: [] } },
      "/api/providers/custom-endpoints": { status: 200, body: { endpoints: [], current: null } },
    });
    await mount(<CapModelsPane />);

    expect(cards()).toBe(8);
    expect(q(".cap-sub")!.textContent).toBe("1 个可用模型 · — 条单价");
    // 台账回了名称/供应商/上下文/状态；输入、输出、7 天调用整列无读口，不画。
    expect(headers(0)).toEqual(["模型", "Provider", "上下文", "状态"]);
    // 价目零行：保留骨架表头同序（含来源列；写口「编辑」在卡底点名）。
    expect(headers(1)).toEqual([
      "供应商",
      "模型",
      "输入 $/1M",
      "输出 $/1M",
      "货币",
      "生效日期",
      "版本",
      "来源",
    ]);
    const modelCells = Array.from(
      all('[data-testid="cap-model-row"]')[0]!.querySelectorAll("td"),
    ).map((td) => td.textContent?.trim());
    expect(modelCells).toEqual(["qwen3-max", "dashscope", "128k", "可用"]);

    expect(text()).toContain("数据可用性");
    expect(text()).toContain("列「输入 $/1M」");
    expect(text()).toContain("列「7 天调用」");
    expect(text()).toContain("$1.27");
    expect(text()).toContain("近 24 小时");
    expect(text()).toContain("无行");
    expect(dashCount()).toBeLessThanOrEqual(8);
    shapeGuards();
  });

  it("模型目录没有读口时保留骨架表头 + 一行声明，不抹掉整表", async () => {
    stub({
      ...liveStubs,
      "/api/models": { status: 404, body: { code: "console.unknown_route" } },
    });
    await mount(<CapModelsPane />);

    expect(headers(0)).toEqual([
      "模型",
      "Provider",
      "上下文",
      "输入 $/1M",
      "输出 $/1M",
      "7 天调用",
      "状态",
    ]);
    expect(all('[data-testid="cap-model-row"]')).toHaveLength(0);
    expect(text()).toContain("缺读口：上游端点未接线");
    expect(dashCount()).toBeLessThanOrEqual(8);
  });
});

describe("能力与接入 · 模型凭据写口", () => {
  const credStubs = {
    "/api/credentials/pool": {
      status: 200,
      body: {
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
              {
                index: 2,
                id: "a1b2c3",
                label: "主账号",
                auth_type: "api_key",
                source: "manual",
                priority: 1,
                last_status: "exhausted",
                request_count: 7,
                token_preview: "sk-w...9f2Q",
                has_refresh: false,
              },
            ],
          },
        ],
      },
    },
    "/api/config": { status: 200, body: { model: "qwen-plus" } },
    "/api/env": {
      status: 200,
      body: { DASHSCOPE_API_KEY: { provider: "alibaba", provider_primary: true, is_password: true } },
    },
  };

  const calls = () =>
    (fetch as unknown as { mock: { calls: Array<[string, RequestInit | undefined]> } }).mock.calls;

  function click(label: string) {
    const button = all("button")
      .map((node) => node as HTMLButtonElement)
      .find((node) => (node.textContent ?? "").trim() === label && !node.disabled);
    expect(button, `找不到可点的按钮：${label}`).toBeTruthy();
    button!.click();
  }

  function typeInto(selector: string, value: string) {
    const input = q(selector) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("凭据池真读数上屏：只显示脱敏预览，last_status 为空写「—」，页面没有明文 key", async () => {
    stub(credStubs);
    await mount(<CapModelsPane />);

    const rows = all('[data-testid="cap-cred-row"]');
    expect(rows).toHaveLength(2);
    const first = rows[0]!.textContent ?? "";
    expect(first).toContain("alibaba");
    expect(first).toContain("DASHSCOPE_API_KEY");
    expect(first).toContain("sk-w...ufVG");
    expect(first).toContain("env:DASHSCOPE_API_KEY");
    expect(first).toContain("优先级 0");
    expect(first).toContain("请求 1");
    // last_status 为 null 就是「—」，不能写「正常」。
    expect(first).toContain("状态 —");
    expect(rows[1]!.textContent).toContain("状态 已耗尽");
    // 默认模型是真读数，写口在手：第 3 步常驻「模型名」输入框（旧卡是先点「修改」
    // 才展开输入框；现在填 key 与填模型名在同一趟里完成，少一次点击）。
    expect(text()).toContain("qwen-plus");
    expect(q('.cap-prov-sec input[placeholder="qwen-plus"]')).toBeTruthy();
    // 写口是真能用的，不是摆设：填了模型名，「保存模型」就可点。
    typeInto('.cap-prov-sec input[placeholder="qwen-plus"]', "qwen3-max");
    await act(async () => {});
    expect(
      all("button").some(
        (node) => (node.textContent ?? "").trim() === "保存模型" && !(node as HTMLButtonElement).disabled,
      ),
    ).toBe(true);
    expect(text()).not.toMatch(/sk-[A-Za-z0-9]{8,}/);
    shapeGuards();
  });

  it("保存成功：key 输入框立刻清空，列表重读，页面只说「已写入凭据池」", async () => {
    stub({ ...credStubs, "POST /api/credentials/pool": { status: 200, body: { ok: true } } });
    await mount(<CapModelsPane />);

    typeInto('input[placeholder="alibaba"]', "alibaba");
    typeInto('input[type="password"]', "sk-ws-SECRET-123456");
    await act(async () => {});
    click("保存");
    await act(async () => {});
    await act(async () => {});

    expect(text()).toContain("已写入凭据池");
    expect((q('input[type="password"]') as HTMLInputElement).value).toBe("");
    const post = calls().find(([url, init]) => String(url) === "/api/credentials/pool" && init?.method === "POST");
    expect(post).toBeTruthy();
    expect(JSON.parse(String(post![1]!.body))).toEqual({
      provider: "alibaba",
      api_key: "sk-ws-SECRET-123456",
    });
    expect(all('[data-testid="cap-cred-row"]')).toHaveLength(2);
    shapeGuards();
  });

  it("保存失败：上游 detail 原文上屏（不提「保存失败」），且不回显明文 key", async () => {
    stub({
      ...credStubs,
      "POST /api/credentials/pool": {
        status: 422,
        body: { detail: [{ loc: ["body", "provider"], msg: "Field required", type: "missing" }] },
      },
    });
    await mount(<CapModelsPane />);

    typeInto('input[placeholder="alibaba"]', "alibaba");
    typeInto('input[type="password"]', "sk-ws-SECRET-123456");
    await act(async () => {});
    click("保存");
    await act(async () => {});
    await act(async () => {});

    expect(text()).toContain("Field required");
    expect(text()).toContain("HTTP 422");
    expect(text()).not.toContain("保存失败");
    expect(text()).not.toContain("sk-ws-SECRET-123456");
    expect(text()).not.toContain("已写入凭据池");
  });

  it("删除是二次确认：先点「删除」不发请求，点「确认删除」才发 DELETE 并重读", async () => {
    stub({
      ...credStubs,
      "DELETE /api/credentials/pool/alibaba/1": {
        status: 200,
        body: { ok: true, provider: "alibaba", count: 1, cleaned: [], hints: [] },
      },
    });
    await mount(<CapModelsPane />);

    const deletes = () => calls().filter(([, init]) => init?.method === "DELETE");
    expect(deletes()).toHaveLength(0);

    click("删除");
    await act(async () => {});
    expect(text()).toContain("确认删除");
    expect(deletes()).toHaveLength(0);

    click("确认删除");
    await act(async () => {});
    await act(async () => {});
    expect(deletes()).toHaveLength(1);
    expect(String(deletes()[0]![0])).toBe("/api/credentials/pool/alibaba/1");
    expect(text()).toContain("已删除 alibaba 的第 1 条凭据");
  });
});

describe("能力与接入 · 平台接入", () => {
  /** 与 parity-probe 同一口径的破折号计数。 */
  function dashCount(): number {
    const t = text();
    return (t.match(/—/g) ?? []).length + (t.match(/未接入/g) ?? []).length + (t.match(/待核实/g) ?? []).length;
  }

  it("七块；瓷片只画网关真报的平台，无读口的列整列不填、在卡底点名", async () => {
    stub({
      "/api/hermes-summary": {
        status: 200,
        body: {
          gateway: {
            state: "running",
            updated_at: "2026-11-24T06:28:57Z",
            platforms: {
              api_server: { state: "connected", needs_attention: false },
              feishu: { state: "connected", needs_attention: false },
            },
          },
        },
      },
    });
    await mount(<CapChannelsPane />);

    expect(cards()).toBe(7);
    expect(q(".cap-sub")!.textContent).toBe(
      "网关级凭证与运行状态 · 员工侧绑定在「员工配置 · 通信与身份」",
    );
    expect(all(".cap-readout")[0]!.textContent).toBe("平台 2 · 已连接 2");

    // 瓷片只画真平台，状态与更新时刻都是网关真读数。
    const tiles = all('[data-testid="cap-channel-row"]');
    expect(tiles).toHaveLength(2);
    expect(tiles.map((tile) => tile.querySelector(".cap-tile-name")!.textContent)).toEqual([
      "API 服务",
      "飞书",
    ]);
    expect(tiles[0]!.textContent).toContain("已连接");
    expect(tiles[0]!.textContent).not.toContain("—");

    // 凭证明细：除平台名外整列无读口 ⇒ 骨架表头 + 一行声明，缺列卡底点名。
    expect(headers(0)).toEqual(["平台", "凭证", "模式", "限流 / 分钟", "最近调用", "操作"]);
    expect(text()).toContain("凭证、模式、限流与调用时刻都没有读口");
    expect(all("table")[0]!.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(text()).toContain("5 项无读口");
    // 拦截明细同样保留骨架表头。
    expect(headers(1)).toEqual(["时间", "员工", "动作", "对象", "原因", "结果"]);

    expect(dashCount()).toBeLessThanOrEqual(8);
    shapeGuards();
  });
});