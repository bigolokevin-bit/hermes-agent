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
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const hit = routes.get(url) ?? routes.get(new URL(url, "http://x").pathname);
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
  it("七块、副行与列名对齐骨架，缺读口的列写「—」", async () => {
    stub({
      "/api/skills": {
        status: 200,
        body: {
          items: [
            { name: "检索增强", version: "2.1.0", provenance: "bundled", enabled: true },
            { name: "表格计算", version: "0.3.0", provenance: "agent", enabled: false },
          ],
          asOf: "2026-11-24T06:30:00Z",
        },
      },
      "/api/skill-proposals": { status: 404, body: { detail: "Not Found" } },
    });
    await mount(<CapSkillsPane />);

    expect(cards()).toBe(7);
    expect(q(".cap-sub")!.textContent).toBe("2 个已发布 · — 个提案 · — 个可发现");
    expect(headers(0)).toEqual(["技能", "版本", "来源", "能力", "挂载", "7 天调用", "状态"]);
    expect(headers(1)).toEqual(["提案", "类型", "提出人", "影响", "状态"]);

    const row = all('[data-testid="cap-skill-row"]');
    expect(row).toHaveLength(2);
    const cells = Array.from(row[0]!.querySelectorAll("td")).map((td) => td.textContent?.trim());
    expect(cells[0]).toBe("检索增强");
    expect(cells[1]).toBe("2.1.0");
    expect(cells[2]).toBe("官方");
    expect(cells[3]).toBe("—");
    expect(cells[5]).toBe("—");
    expect(cells[6]).toBe("可用");

    // 提案端点未接线：队列里只有一行缺读口，没有编造的提案
    expect(all('[data-testid="cap-skill-row"]')).toHaveLength(2);
    expect(text()).toContain("缺读口：上游端点未接线");
    shapeGuards();
  });

  it("技能台账真零时写「真零」而不是编一行", async () => {
    stub({
      "/api/skills": { status: 200, body: { items: [], asOf: "2026-11-24T06:30:00Z" } },
      "/api/skill-proposals": { status: 404, body: { detail: "Not Found" } },
    });
    await mount(<CapSkillsPane />);
    expect(q(".cap-sub")!.textContent).toBe("0 个已发布 · — 个提案 · — 个可发现");
    expect(text()).toContain("技能台账里还没有已发布的技能");
  });
});

describe("能力与接入 · 工具与 MCP", () => {
  it("四块、副行与列名对齐骨架；上游不可达时整表缺读口", async () => {
    stub({
      "/api/tools": { status: 502, body: { code: "console.upstream_unavailable" } },
      "/api/mcp/servers": { status: 404, body: { code: "mcp.read_not_wired" } },
    });
    await mount(<CapToolsPane />);

    expect(cards()).toBe(4);
    expect(q(".cap-sub")!.textContent).toBe("— 个内置工具 · — 个 MCP 服务器 · — 个已授权工具");
    expect(headers(0)).toEqual(["工具", "作用", "风险", "沙箱", "7 天调用", "默认"]);
    expect(headers(1)).toEqual(["名称", "传输", "工具", "出站", "7 天调用", "状态"]);
    expect(text()).toContain("缺读口：上游服务此刻不可达");
    expect(text()).toContain("缺读口：接入请求队列未接线");
    shapeGuards();
  });
});

describe("能力与接入 · 模型与单价", () => {
  it("六块、两条表的列名对齐骨架；价目端点未接线时单价列全「—」", async () => {
    stub({
      "/api/models": {
        status: 200,
        body: { items: [{ id: "qwen3-max", name: "qwen3-max", provider: "dashscope", context_window: 131072 }] },
      },
      "/api/models/pricing": { status: 404, body: { code: "models.pricing_not_wired" } },
      "/api/hermes-usage?days=1": {
        status: 200,
        body: { period_days: 1, cost: { cost_usd: null, rows: 0 }, by_model: null },
      },
      "/api/hermes-usage?days=30": {
        status: 200,
        body: { period_days: 30, cost: { cost_usd: 1.27, rows: 85 }, by_model: null },
      },
    });
    await mount(<CapModelsPane />);

    expect(cards()).toBe(6);
    expect(q(".cap-sub")!.textContent).toBe("1 个可用模型 · — 条单价");
    expect(headers(0)).toEqual([
      "模型",
      "Provider",
      "上下文",
      "输入 $/1M",
      "输出 $/1M",
      "7 天调用",
      "状态",
    ]);
    expect(headers(1)).toEqual(["供应商", "模型", "输入 $/1M", "输出 $/1M", "货币", "生效日期", "版本"]);

    const modelCells = Array.from(
      all('[data-testid="cap-model-row"]')[0]!.querySelectorAll("td"),
    ).map((td) => td.textContent?.trim());
    expect(modelCells[3]).toBe("—");
    expect(modelCells[4]).toBe("—");

    expect(text()).toContain("缺读口：上游价目端点未接线");
    expect(text()).toContain("$1.27");
    expect(text()).toContain("近 24 小时");
    shapeGuards();
  });
});

describe("能力与接入 · 平台接入", () => {
  it("七块、副行与列名对齐骨架；凭证与限流没有读口时写「—」", async () => {
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
    expect(headers(0)).toEqual(["平台", "凭证", "模式", "限流 / 分钟", "最近调用", "操作"]);

    const rows = all('[data-testid="cap-channel-row"]');
    expect(rows).toHaveLength(2);
    expect(rows.map((tr) => tr.querySelector("td")!.textContent)).toEqual(["API 服务", "飞书"]);
    expect(rows[0]!.querySelectorAll("td")[1]!.textContent).toBe("—");
    expect(text()).toContain("缺读口：网关级凭证与发送开关未接线");
    shapeGuards();
  });
});