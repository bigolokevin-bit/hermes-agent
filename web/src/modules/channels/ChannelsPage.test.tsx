// @vitest-environment jsdom
// T29 + T24 page. The assertions are about what a person can check with their
// eyes: the real BFF routes are the ones asked (the `/api/` segment included),
// rows only ever come from an answer, a platform nobody explained is greyed and
// reads 「未知」 instead of a green 「已接入」, the four states are the service's
// answer and not a fallback, 403 and 404 draw one identical body with no row
// above it, the filter and the refresh both change what is asked, and a `?state=`
// repro asks for nothing at all.

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";
import { sourceUrl } from "./channels";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import { ChannelsPage } from "./ChannelsPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function waitFor(cond: () => boolean, label = "condition"): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`waitFor: ${label} never became true`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

async function render(entry: string, page: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter>);
  });
}

const text = (): string => document.body.textContent ?? "";
const html = (): string => document.body.innerHTML;
const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const skeleton = (): boolean => document.querySelector(".animate-pulse") !== null;
const statusRows = (): number => document.querySelectorAll("[data-testid^='chn4-row-'][data-status]").length;
const sourceRows = (): number => document.querySelectorAll("[data-testid^='chn4-source-'][data-status]").length;

const PLATFORMS = {
  platforms: [
    { id: "telegram", name: "Telegram 企业号", state: "connected", updated_at: "2026-11-19T01:20:00Z" },
    { id: "whatsapp", name: "微信客服", state: "not_configured", updated_at: "2026-11-19T02:05:00Z" },
    { id: "conn_9f8e7d6c5b4a3f21", state: "disabled" },
  ],
  total: 9,
};

/**
 * One answer for the platform route, today's real 404 for every other source.
 * Answering all four routes with the same payload would make the connector
 * source paint the same rows a second time, and the page would be counted
 * against a fixture instead of against its own reading.
 */
function ok(payload: unknown): (url: string) => Promise<unknown> {
  return async (url: string) => {
    if (url.startsWith("/agent-api/api/messaging/platforms")) return payload;
    throw new ApiError("missing", {
      status: 404,
      body: '{"code":"console.not_found"}',
      url,
      requestId: "chn-probe",
    });
  };
}

/** The platform list as one real answer; everything else stays missing. */
const byUrl = ok(PLATFORMS);

/** Mount the pane against a given answer. */
async function mount(
  handler: (url: string) => Promise<unknown>,
  entry = "/capabilities?tab=channels",
): Promise<void> {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(handler);
  await render(entry, <ChannelsPage />);
  await waitFor(() => !skeleton(), "state settled");
}

const denied = (status: number, requestId = "chn4-deny") => async (url: string): Promise<never> => {
  throw new ApiError("denied", {
    status,
    body: `{"code":"${status === 403 ? "console.forbidden" : "console.not_found"}","detail":"raw-${status}-${url}"}`,
    url,
    requestId,
  });
};

beforeEach(() => {
  api.fetchJSON.mockReset();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe("the read asks the real routes", () => {
  it("asks every candidate with the /api/ segment kept, and the limit stated", async () => {
    await mount(byUrl);
    expect(urls()).toContain("/agent-api/api/messaging/platforms?limit=50");
    expect(urls()).toContain("/agent-api/api/datasources?limit=50");
    expect(urls()).toContain("/agent-api/api/mcp/servers?limit=50");
    expect(urls()).toContain("/agent-api/api/gateway-connections?limit=50");
    // no request ever loses the /api/ segment, which is what makes it a BFF route
    for (const url of urls()) expect(url).toContain("/api/");
    expect(document.querySelector("[data-testid='chn4-page']")).toBeTruthy();
  });

  it("tries the other name for the same source only after the first one fails", async () => {
    await mount(byUrl);
    const order = urls();
    expect(order[0]).toBe("/agent-api/api/messaging/platforms?limit=50");
    // the first candidate answered, so its second name is not asked
    expect(order).not.toContain("/agent-api/api/channels?limit=50");
    // the connector source's first name 404s, so its second name is asked too
    expect(order).toContain("/agent-api/api/connectors?limit=50");
  });

  it("paints the rows the answer carried and nothing more", async () => {
    await mount(byUrl);
    expect(text()).toContain("Telegram 企业号");
    expect(text()).toContain("微信客服");
    expect(statusRows()).toBe(3);
    expect(sourceRows()).toBe(4);
  });
});

describe("the platform list keeps the bad rows visible", () => {
  it("an unconfigured platform stays on screen, greyed, with its reason", async () => {
    await mount(byUrl);
    const row = document.querySelector("[data-testid='chn4-row-1']")!;
    expect(row.getAttribute("data-status")).toBe("unavailable");
    expect(row.textContent).toContain("还缺必要的配置");
    expect(row.textContent).toContain("未接入");
    expect(row.className).toContain("opacity-60");
  });

  it("a platform the upstream switched off reads 未启用, with data-status to prove it", async () => {
    await mount(ok({ platforms: [{ id: "conn_7a7b", name: "被停用的渠道", state: "disabled" }] }));
    const row = document.querySelector("[data-testid='chn4-row-0']")!;
    expect(row.getAttribute("data-status")).toBe("disabled");
    expect(document.querySelector("[data-testid='chn4-row-0-badge']")?.textContent?.trim()).toBe("未启用");
    // the sentence says what to do, in plain Chinese, and never the raw token
    expect(row.textContent).toContain("已被禁用，需要先启用后再读取");
    expect(row.textContent).not.toContain("disabled");
    expect(row.className).toContain("opacity-60");
    // the count line carries the same word, so the one-liner adds up to the list
    expect(document.querySelector("[data-testid='chn4-counts']")?.textContent).toContain("未启用 1");
  });

  it("the 未启用 choice narrows the list to the switched-off rows only", async () => {
    await mount(byUrl, "/capabilities?tab=channels&status=disabled");
    expect(urls()).toContain("/agent-api/api/messaging/platforms?limit=50&status=disabled");
    expect(statusRows()).toBe(1);
    const row = document.querySelector("[data-testid='chn4-row-0']")!;
    expect(row.getAttribute("data-status")).toBe("disabled");
    expect(document.querySelector("[data-testid='chn4-row-0-badge']")?.textContent?.trim()).toBe("未启用");
  });

  it("a platform nobody explains reads 未知, never 正常 and never a green 已接入", async () => {
    await mount(ok({ platforms: [{ id: "x1", name: "探测中的渠道", state: "probe-v2" }] }));
    const row = document.querySelector("[data-testid='chn4-row-0']")!;
    expect(row.getAttribute("data-status")).toBe("unknown");
    expect(row.className).toContain("opacity-60");
    expect(row.textContent).toContain("既不写已接入，也不写未接入");
    expect(document.querySelector("[data-testid='chn4-row-0-badge']")?.textContent?.trim()).toBe("未知");
    expect(text()).not.toContain("正常");
  });

  it("a switched-on but unexplained platform is not called connected", async () => {
    await mount(ok({ platforms: [{ id: "y2", name: "开着但没连上", enabled: true, configured: true }] }));
    const row = document.querySelector("[data-testid='chn4-row-0']")!;
    expect(row.getAttribute("data-status")).toBe("unknown");
    expect(document.querySelector("[data-testid='chn4-row-0-badge']")?.textContent?.trim()).toBe("未知");
  });

  it("an unexplained reason reads 「—」 with the reason, not a zero and not a guess", async () => {
    await mount(ok({ platforms: [{ id: "z3", name: "旧渠道", state: "disconnected" }] }));
    const row = document.querySelector("[data-testid='chn4-row-0']")!;
    // 「disconnected」 has a documented meaning, so it is that meaning and not a dash
    expect(row.textContent).toContain("连接已经断开");
    expect(text()).not.toMatch(/共 0|: 0\b|\bECONNREFUSED\b/);
  });

  it("a row with no name shows the masked handle, never the raw id", async () => {
    await mount(ok({ platforms: [{ id: "conn_1f2e3d4c5b6a7789", state: "disabled" }] }));
    const row = document.querySelector("[data-testid='chn4-row-0']")!;
    expect(row.textContent).toContain("连接 · 后4位 7789");
    expect(text()).not.toContain("conn_1f2e3d4c5b6a7789");
    expect(row.querySelector("p")?.getAttribute("title")).toBe("conn_1f2e3d4c5b6a7789");
  });

  it("shows the last seen time in Beijing wall clock to the minute", async () => {
    await mount(byUrl);
    expect(text()).toContain("最近可见（北京时间）");
    expect(text()).toContain("2026-11-19 09:20");
    expect(text()).toContain("2026-11-19 10:05");
    // the wire form never reaches the sentence layer
    expect(text()).not.toMatch(/2026-11-19T01:20|:00Z/);
  });

  it("a missing last-seen is 「—」 plus why, not a blank and not epoch", async () => {
    await mount(byUrl);
    const row = document.querySelector("[data-testid='chn4-row-2']")!;
    expect(row.textContent).toContain("—");
    expect(row.querySelector("[title='服务未提供最近可见时间']")).toBeTruthy();
    expect(text()).not.toMatch(/1970|0000|NaN|undefined/);
  });

  it("counts against the denominator the answer declared", async () => {
    await mount(byUrl);
    expect(text()).toContain("共 9 条");
    expect(text()).toContain("列出 3 个渠道或平台");
  });

  it("says so out loud when the answer declared no total", async () => {
    await mount(ok({ platforms: [{ id: "a", name: "甲", state: "connected" }] }));
    expect(text()).toContain("上游未声明一共有多少条");
    expect(text()).not.toMatch(/\/ 0\b/);
  });

  it("counts an entry it could not read instead of painting it", async () => {
    await mount(ok({ platforms: [{ id: "a", name: "甲", state: "connected" }, "读不出"] }));
    expect(statusRows()).toBe(1);
    expect(text()).toContain("另有 1 条回的内容读不出是哪个平台");
  });
});

describe("engineering language stays off the human layer", () => {
  it("carries no field names, state tokens, routes or codes on the surface", async () => {
    await mount(byUrl);
    expect(text()).not.toMatch(/updated_at|not_configured|gateway_stopped|platforms:|console\.|HTTP|agent-api/);
    expect(text()).not.toMatch(/\b40[34]\b|\b50[02]\b/);
  });

  it("keeps the raw values behind 技术详情, closed by default", async () => {
    await mount(byUrl);
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='chn4-row-0-details'] button")!;
    expect(text()).not.toContain("状态原值");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      toggle.click();
    });
    expect(text()).toContain("标识原值：telegram");
    expect(text()).toContain("状态原值：connected");
    expect(text()).toContain("最近可见原值：2026-11-19T01:20:00Z");
  });

  it("the ledger names the gap instead of a route, and keeps the route collapsed", async () => {
    await mount(byUrl);
    const missing = document.querySelector("[data-testid='chn4-source-2']")!;
    expect(missing.getAttribute("data-status")).toBe("unavailable");
    expect(missing.getAttribute("data-gap")).toBe("GAP-08");
    expect(missing.textContent).toContain("缺口编号 GAP-08");
    expect(text()).not.toContain("/agent-api/api/datasources");
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='chn4-source-2-details'] button")!;
    await act(async () => {
      toggle.click();
    });
    expect(text()).toContain("读取地址：/agent-api/api/datasources");
  });

  it("keeps MCP's own gap number, since that route is T27's known hole", async () => {
    await mount(byUrl);
    const mcp = document.querySelector("[data-testid='chn4-source-3']")!;
    expect(mcp.getAttribute("data-gap")).toBe("GAP-04");
    expect(mcp.textContent).toContain("GAP-04");
  });

  it("says 已接入 only where entries really arrived", async () => {
    await mount(byUrl);
    const answered = document.querySelector("[data-testid='chn4-source-0']")!;
    expect(answered.getAttribute("data-status")).toBe("available");
    expect(answered.textContent).toContain("已接入");
    // and a route that is missing is never green anywhere on the page
    expect(document.querySelectorAll("[data-status='available']")).toHaveLength(2);
  });
});

describe("the data-source ledger carries its own ds4-* ids", () => {
  const WORD: Record<string, string> = { available: "已接入", unavailable: "未接入", unknown: "待核实" };

  /** Platforms answer; the 数据源目录 answers with an empty list; the rest 404. */
  const withEmptySource = async (url: string): Promise<unknown> => {
    if (url.startsWith("/agent-api/api/messaging/platforms")) return PLATFORMS;
    if (url.startsWith("/agent-api/api/datasources")) return { sources: [] };
    throw new ApiError("missing", { status: 404, body: "{}", url, requestId: "chn-probe" });
  };

  it("ds4-ledger wraps every ds4-row, and every chn4-* id is untouched", async () => {
    await mount(byUrl);
    const ledger = document.querySelector("[data-testid='ds4-ledger']")!;
    expect(ledger).toBeTruthy();
    // the wrapper sits inside the Card that still answers to chn4-sources
    expect(document.querySelector("[data-testid='chn4-sources']")).toBeTruthy();
    expect(ledger.closest("[data-testid='chn4-sources']")).toBeTruthy();
    const rows = ledger.querySelectorAll("[data-testid='ds4-row']");
    expect(rows).toHaveLength(4);
    expect(sourceRows()).toBe(4);
    // each ds4-row lives in its own chn4-source-N row, which still carries status
    for (const row of rows) {
      const outer = row.closest("[data-testid^='chn4-source-']");
      expect(outer).toBeTruthy();
      expect(outer?.hasAttribute("data-status")).toBe(true);
    }
    // the ids this change was not allowed to rename still resolve exactly
    expect(document.querySelector("[data-testid='chn4-source-2']")).toBeTruthy();
    expect(document.querySelector("[data-testid='chn4-source-2-details']")).toBeTruthy();
    expect(document.querySelector("[data-testid='chn4-row-0-badge']")).toBeTruthy();
  });

  it("every ledger row shows a status under ds4-status, matching its row", async () => {
    await mount(withEmptySource);
    const badges = document.querySelectorAll("[data-testid='ds4-status']");
    expect(badges).toHaveLength(4);
    for (const badge of badges) {
      const row = badge.closest("[data-status]");
      expect(row).toBeTruthy();
      expect(badge.textContent?.trim()).toBe(WORD[row?.getAttribute("data-status") ?? ""]);
    }
    // the badge's own chn4 id survives next to the ds4 marker
    expect(document.querySelector("[data-testid='chn4-source-0-badge']")).toBeTruthy();
  });

  it("an unverifiable source reads 待核实, never 未知, and never a shrug", async () => {
    await mount(withEmptySource);
    const row = document.querySelector("[data-testid='chn4-source-2']")!;
    expect(row.getAttribute("data-status")).toBe("unknown");
    expect(document.querySelector("[data-testid='chn4-source-2-badge']")?.textContent?.trim()).toBe("待核实");
    // it stays listed and greyed, with its reason and a gap number behind it
    expect(row.className).toContain("opacity-60");
    expect(row.textContent).toContain("一条也没有");
    expect(row.querySelector("[data-testid='ds4-gap']")?.textContent).toContain("GAP-11");
    // the word 未知 belongs to a platform row, not to a row speaking for a source
    expect(row.textContent).not.toContain("未知");
    expect(text()).not.toContain("正常");
  });

  it("a service error leaves the row 待核实 with its own gap number, not 未接入", async () => {
    await mount(async (url) => {
      if (url.startsWith("/agent-api/api/messaging/platforms")) return PLATFORMS;
      if (url.startsWith("/agent-api/api/datasources"))
        throw new ApiError("boom", { status: 500, body: '{"detail":"upstream exploded"}', url, requestId: "ds-500" });
      throw new ApiError("missing", { status: 404, body: "{}", url, requestId: "chn-probe" });
    });
    const row = document.querySelector("[data-testid='chn4-source-2']")!;
    expect(row.getAttribute("data-status")).toBe("unknown");
    expect(row.getAttribute("data-gap")).toBe("GAP-12");
    expect(row.textContent).toContain("处理时出了错");
    // no code, no route, no upstream sentence on the human layer
    expect(row.textContent).not.toMatch(/500|upstream exploded|agent-api|GAP-08/);
  });

  it("each row names its kind and 来源 in human words", async () => {
    await mount(byUrl);
    const mcp = document.querySelector("[data-testid='chn4-source-3']")!;
    expect(mcp.querySelector("[data-testid='ds4-kind']")?.textContent).toBe("类型：MCP 连接");
    expect(mcp.querySelector("[data-testid='ds4-origin']")?.textContent).toBe("来源：上游的工具与 MCP 服务清单");
    const datasources = document.querySelector("[data-testid='chn4-source-2']")!;
    expect(datasources.querySelector("[data-testid='ds4-kind']")?.textContent).toBe("类型：数据源");
    expect(datasources.querySelector("[data-testid='ds4-origin']")?.textContent).toBe("来源：本控制台的数据源目录");
    // engineering spellings stay out of both columns
    expect(text()).not.toMatch(/datasource|mcp\/servers|kind|source_id/);
  });

  it("最近同步 is the newest instant the answer carried, in Beijing minutes", async () => {
    await mount(byUrl);
    const answered = document.querySelector("[data-testid='chn4-source-0']")!;
    const sync = answered.querySelector("[data-testid='ds4-sync']")!;
    expect(sync.textContent).toContain("最近同步（北京时间）：");
    // 02:05Z is the newer of the two stamps the platforms answer sent
    expect(sync.textContent).toContain("2026-11-19 10:05");
    expect(sync.textContent).not.toMatch(/T\d{2}:\d{2}|Z\b/);
    // and this page's own clock keeps its own line, so the two cannot be confused
    const checked = answered.querySelector("[data-testid='ds4-checked']")!.textContent ?? "";
    expect(checked).toContain("本次核验（北京时间）：");
    expect(checked).not.toBe(sync.textContent);
  });

  it("a source whose answer had no timestamp shows 「—」 plus why, never now()", async () => {
    await mount(withEmptySource);
    const row = document.querySelector("[data-testid='chn4-source-2']")!;
    const sync = row.querySelector("[data-testid='ds4-sync']")!;
    expect(sync.textContent).toContain("—");
    expect(row.querySelector("[title='这份回答没有说它最近是什么时候同步的']")).toBeTruthy();
    // a dash here is not a zero, and the page's own instant did not move into it
    expect(sync.textContent).not.toMatch(/0\b|1970|NaN|undefined/);
    expect(text()).not.toMatch(/1970|NaN|undefined/);
  });

  it("where the endpoint is absent, ds4-gap carries the gap code on that row", async () => {
    await mount(byUrl);
    // connectors, datasources and MCP all 404 on this fixture; the answered row has no gap cell
    const gaps = document.querySelectorAll("[data-testid='ds4-gap']");
    expect(gaps).toHaveLength(3);
    for (const gap of gaps) expect(gap.textContent).toMatch(/^缺口编号 GAP-\d+$/);
    // the gap sits on the row whose endpoint is missing, with its number
    const datasources = document.querySelector("[data-testid='chn4-source-2']")!;
    expect(datasources.getAttribute("data-status")).toBe("unavailable");
    expect(datasources.querySelector("[data-testid='ds4-gap']")?.textContent).toContain("GAP-08");
    const mcp = document.querySelector("[data-testid='chn4-source-3']")!;
    expect(mcp.querySelector("[data-testid='ds4-gap']")?.textContent).toContain("GAP-04");
    // and a source that answered honestly shows no gap cell at all
    const answered = document.querySelector("[data-testid='chn4-source-0']")!;
    expect(answered.querySelector("[data-testid='ds4-gap']")).toBeNull();
    // the ids add nothing to the sentence layer either way
    expect(text()).not.toMatch(/agent-api|404/);
  });
});

describe("the four states", () => {
  it("loading is a skeleton, not a list of zero", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(() => new Promise(() => {}));
    await render("/capabilities?tab=channels", <ChannelsPage />);
    await waitFor(() => skeleton(), "skeleton painted");
    expect(document.querySelector("[data-testid='chn4-loading']")).toBeTruthy();
    expect(document.querySelector("[data-testid='chn4-list']")).toBeNull();
    expect(document.querySelector("[data-testid='chn4-sources']")).toBeNull();
  });

  it("an empty answer explains itself and names the next step", async () => {
    await mount(ok({ platforms: [] }));
    expect(document.querySelector("[data-testid='chn4-empty']")).toBeTruthy();
    // the platform rows are not painted, but the ledger is: those reads really
    // happened, so each source may say what it answered
    expect(document.querySelector("[data-testid='chn4-list']")).toBeNull();
    expect(statusRows()).toBe(0);
    expect(sourceRows()).toBe(4);
    expect(text()).toContain("这份接入清单是空的");
    expect(text()).toContain("原生「平台接入」页面");
    expect(text()).toContain("不代表读取失败");
  });

  it("an answer that is not a list is a failure, not an empty list", async () => {
    await mount(async (url) => {
      if (url.startsWith("/agent-api/api/messaging/platforms")) return { status: "ok", note: "nothing" };
      throw new ApiError("gone", { status: 404, body: "{}", url, requestId: "x" });
    });
    expect(document.querySelector("[data-testid='chn4-error']")).toBeTruthy();
    expect(document.querySelector("[data-testid='chn4-empty']")).toBeNull();
    expect(text()).toContain("不是一份接入清单");
  });

  it("an error speaks human words, quotes the request id, and offers a retry", async () => {
    await mount(async (url) => {
      throw new ApiError("boom", {
        status: 500,
        body: '{"detail":"upstream exploded"}',
        url,
        requestId: "chn4-gw-fail",
      });
    });
    expect(document.querySelector("[data-testid='chn4-error']")).toBeTruthy();
    expect(text()).toContain("接入清单没能加载出来");
    expect(text()).toContain("处理时出了错");
    expect(text()).toContain("请求编号：chn4-gw-fail");
    expect(text()).not.toMatch(/500|upstream exploded|agent-api/);
    expect(document.querySelector("[aria-label='复制请求编号']")).toBeTruthy();
    expect([...document.querySelectorAll("button")].some((b) => b.textContent?.includes("重试"))).toBe(true);
  });

  it("a failure with no request id says 「未提供」 and why", async () => {
    await mount(async (url) => {
      throw new ApiError("gone", { status: 502, body: "bad gateway", url });
    });
    expect(document.querySelector("[data-testid='chn4-error-request-id-value-absent']")).toBeTruthy();
    expect(text()).toContain("未提供");
    expect(text()).not.toMatch(/502|bad gateway|agent-api/);
  });

  it("a login gap tells the person what to do instead of showing a code", async () => {
    await mount(async (url) => {
      throw new ApiError("auth", { status: 401, body: '{"code":"console.unauthenticated"}', url, requestId: "a" });
    });
    expect(text()).toContain("重新登录");
    expect(text()).not.toMatch(/401|console\.unauthenticated|agent-api/);
  });

  it("a refused read shows no rows at all, never sample data", async () => {
    await mount(denied(403));
    expect(document.querySelector("[data-testid='chn4-list']")).toBeNull();
    expect(document.querySelector("[data-testid='chn4-sources']")).toBeNull();
    expect(statusRows()).toBe(0);
    expect(sourceRows()).toBe(0);
    expect(text()).not.toMatch(/Telegram 企业号|微信客服|示例数据|fixture/);
    expect(html()).not.toContain("data-fixture");
  });

  it("403 and 404 draw one identical body with no rows above it", async () => {
    const once = async (status: number): Promise<string> => {
      await mount(denied(status));
      return html();
    };
    const forbidden = await once(403);
    expect(text()).toContain("现在看不到平台接入与数据源");
    expect(text()).toContain("请求编号：chn4-deny");
    expect(statusRows()).toBe(0);
    // no echo of the wire in either body: no route, no status, no service code
    expect(forbidden).not.toMatch(/agent-api|console\.forbidden|console\.not_found|raw-40|\b40[34]\b/);
    expect(await once(404)).toBe(forbidden);
  });

  it("the denied body names the missing sources by their human labels", async () => {
    await mount(denied(404));
    expect(text()).toContain("GAP-08");
    expect(text()).toContain("平台与渠道接入");
    expect(text()).toContain("外部连接器");
    expect(text()).not.toMatch(/\/agent-api|api\/messaging/);
  });

  it("a data source that is silent does not make the arrived rows disappear", async () => {
    await mount(ok({ platforms: [{ id: "a", name: "甲", state: "connected" }] }));
    expect(statusRows()).toBe(1);
    expect(text()).toContain("甲");
  });
});

describe("the controls change what is asked", () => {
  it("each status choice rebuilds the URL, and the three URLs differ", async () => {
    await mount(byUrl);
    const before = urls();
    const select = document.querySelector<HTMLSelectElement>("[data-testid='chn4-filter-status']")!;

    await act(async () => {
      select.value = "available";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitFor(() => !skeleton(), "filtered read settled");
    const afterAvailable = urls();
    expect(afterAvailable).toContain("/agent-api/api/messaging/platforms?limit=50&status=available");
    expect(afterAvailable.at(-1)).not.toBe(before.at(-1));

    await act(async () => {
      const next = document.querySelector<HTMLSelectElement>("[data-testid='chn4-filter-status']")!;
      next.value = "unavailable";
      next.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitFor(() => !skeleton(), "second filtered read settled");
    const asked = urls();
    expect(asked).toContain("/agent-api/api/messaging/platforms?limit=50");
    expect(asked).toContain("/agent-api/api/messaging/platforms?limit=50&status=available");
    expect(asked).toContain("/agent-api/api/messaging/platforms?limit=50&status=unavailable");
    expect(new Set(asked.filter((url) => url.includes("messaging/platforms"))).size).toBe(3);
  });

  it("the filtered choice really changes the rows, not just the address", async () => {
    await mount(byUrl);
    expect(statusRows()).toBe(3);
    const select = document.querySelector<HTMLSelectElement>("[data-testid='chn4-filter-status']")!;
    await act(async () => {
      select.value = "available";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitFor(() => !skeleton(), "filtered read settled");
    // the platform list itself now holds only the connected one …
    expect(statusRows()).toBe(1);
    expect(document.querySelectorAll("[data-testid^='chn4-row-'][data-status='unavailable']")).toHaveLength(0);
    expect(text()).toContain("已按所选状态筛选");
    // … while the ledger keeps saying what each source did, unfiltered
    expect(sourceRows()).toBe(4);
  });

  it("a shared filter link opens the same view", async () => {
    await mount(byUrl, "/capabilities?tab=channels&status=unavailable");
    expect(urls()).toContain("/agent-api/api/messaging/platforms?limit=50&status=unavailable");
    expect(statusRows()).toBe(2);
  });

  it("the ledger is re-asked too, not repainted from the last answer", async () => {
    await mount(byUrl);
    const select = document.querySelector<HTMLSelectElement>("[data-testid='chn4-filter-status']")!;
    await act(async () => {
      select.value = "disabled";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitFor(() => !skeleton(), "filtered read settled");
    const asked = urls();
    // every source carries the condition, so no part of the page is a leftover
    expect(asked).toContain("/agent-api/api/datasources?limit=50&status=disabled");
    expect(asked).toContain("/agent-api/api/mcp/servers?limit=50&status=disabled");
    expect(asked).toContain("/agent-api/api/gateway-connections?limit=50&status=disabled");
    expect(asked).toContain("/agent-api/api/messaging/platforms?limit=50&status=disabled");
    // and the four choices are four different asks
    const paths = [
      sourceUrl("/agent-api/api/datasources", "all"),
      sourceUrl("/agent-api/api/datasources", "available"),
      sourceUrl("/agent-api/api/datasources", "unavailable"),
      sourceUrl("/agent-api/api/datasources", "disabled"),
    ];
    expect(new Set(paths).size).toBe(4);
    // the ledger still answers, on the row it always had, with its own gap
    expect(sourceRows()).toBe(4);
    expect(document.querySelector("[data-testid='chn4-source-2']")?.getAttribute("data-gap")).toBe("GAP-08");
  });

  it("重新读取 asks again instead of repainting what it already had", async () => {
    await mount(byUrl);
    const first = urls().length;
    const retry = document.querySelector<HTMLButtonElement>("[data-testid='chn4-retry']")!;
    expect(retry.disabled).toBe(false);
    await act(async () => {
      retry.click();
    });
    await waitFor(() => !skeleton(), "second read settled");
    expect(urls().length).toBeGreaterThan(first);
  });
});

describe("the repro legs the shell gives QA", () => {
  it("each forced state renders, carries data-fixture with its GAP, and asks nothing", async () => {
    api.fetchJSON.mockReset();
    const open = async (state: string): Promise<void> => {
      await render(`/capabilities?tab=channels&state=${state}`, <ChannelsPage />);
      await waitFor(
        () => (document.body.textContent ?? "").includes("复现出来的状态") || state === "loading",
        `${state} painted`,
      );
    };
    for (const state of ["loading", "empty", "error", "denied"]) {
      await open(state);
      const page = document.querySelector("[data-testid='chn4-page']")!;
      expect(page.getAttribute("data-fixture")).toBe(state);
      expect(text()).toContain("这是用 ?state=");
      expect(text()).toContain("GAP-08");
      expect(api.fetchJSON).not.toHaveBeenCalled();
      const retry = document.querySelector<HTMLButtonElement>("[data-testid='chn4-retry']")!;
      expect(retry.disabled).toBe(true);
      expect(document.querySelector<HTMLSelectElement>("[data-testid='chn4-filter-status']")!.disabled).toBe(true);
    }
  });

  it("a repro is never dressed up as real data", async () => {
    api.fetchJSON.mockReset();
    await render("/capabilities?tab=channels&state=ready", <ChannelsPage />);
    await waitFor(() => !skeleton(), "real read settled");
    // `ready` is not reproducible: the pane asks the service instead
    expect(api.fetchJSON).toHaveBeenCalled();
    expect(html()).not.toContain("data-fixture");
  });

  it("no repro leg paints a platform that nobody sent", async () => {
    api.fetchJSON.mockReset();
    for (const state of ["loading", "empty", "error", "denied"]) {
      await render(`/capabilities?tab=channels&state=${state}`, <ChannelsPage />);
      await waitFor(() => statusRows() === 0, `${state} paints no rows`);
      expect(statusRows()).toBe(0);
    }
  });
});

describe("the pane never writes", () => {
  it("has no enable, test, save or delete control", async () => {
    await mount(byUrl);
    const labels = [...document.querySelectorAll("button")].map((b) => (b.textContent ?? "").trim());
    // The only controls are the filter, the re-read, the collapsed details and
    // copying a request id. Nothing here changes anything upstream.
    expect(labels.some((label) => /启用|停用|保存|删除|测试|重启/.test(label))).toBe(false);
    expect(html()).not.toMatch(/<form|method="post"/i);
    expect(document.querySelectorAll("input, textarea").length).toBe(0);
    expect(labels.join("|")).toMatch(/重新读取/);
  });
});
