// @vitest-environment jsdom
// aud02 — 单条审计事件详情（独立一屏）。这里断言的是人话层：屏幕上的正文里没有任何
// 工程词（原始字段名、HTTP 码、ISO 串、undefined），技术值只在默认关闭的「技术详情」
// 里出现；四态各归服务的回答；403 与 404 同体；没有 id 就不发请求。

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditDetailModulePage from "@/modules/audit/AuditDetailModulePage";

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

async function render(entry: string): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<MemoryRouter initialEntries={[entry]}><AuditDetailModulePage /></MemoryRouter>);
  });
}

const text = (): string => document.body.textContent ?? "";
const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));
const skeleton = (): boolean => document.querySelector(".animate-pulse") !== null;

const DETAIL = {
  audit: {
    eventId: "evt_D6FC9A2B4E6F8012",
    event_type: "grant_escalation",
    occurredAt: "2026-11-18T03:00:00Z",
    recordedAt: "2026-11-18T03:00:05Z",
    outcome: "rejected",
    requestId: "req-20261118-77aa",
    actor: { type: "human", id: "user:1122334455667788", displayName: "郑涛" },
    resource: { type: "permission", id: "perm_99aabbccddeeff00" },
    sourceSystem: "agentos-core",
    tenantId: "tenant_0f1e2d3c4b5a6978",
    hash: "1a2b3c4d5e6f708192a3b4c5d6e7f809",
    prevHash: "0f1e2d3c4b5a6978a3b4c5d6e7f8091a",
    error: { code: "policy.denied", messageRedacted: "策略不允许在这台环境上提权" },
    change: { before: "只读", after: "可写" },
  },
};

async function openDetail(extra = ""): Promise<void> {
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation(async () => DETAIL);
  await render(`/audit/detail?id=evt_D6FC9A2B4E6F8012${extra}`);
  await waitFor(() => text().includes("结果与原因"), "detail painted");
}

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

describe("the read is the real route", () => {
  it("asks /api/audit/detail with the id from the URL", async () => {
    await openDetail();
    expect(urls()[0]).toBe("/agent-api/api/audit/detail?id=evt_D6FC9A2B4E6F8012");
    expect(document.querySelector("[data-testid='agent-v2-page-audit-detail']")).toBeTruthy();
  });

  it("without an id it asks nothing and says what it needs", async () => {
    await render("/audit/detail");
    await waitFor(() => text().includes("要先选中一条审计事件"), "no-id panel painted");
    expect(api.fetchJSON).not.toHaveBeenCalled();
    expect(document.querySelector("[data-testid='aud02-no-id']")).toBeTruthy();
    expect(text()).not.toContain("undefined");
  });
});

describe("the human layer speaks human", () => {
  it("shows who, when, what and why in words", async () => {
    await openDetail();
    expect(text()).toContain("提高权限");
    expect(text()).toContain("2026-11-18 11:00");
    expect(text()).toContain("郑涛 · 55667788");
    expect(text()).toContain("策略不允许在这台环境上提权");
    expect(text()).toContain("变更前");
    expect(text()).toContain("只读");
  });

  it("carries no engineering language on the surface", async () => {
    await openDetail();
    expect(text()).not.toMatch(/event_type|occurredAt|recordedAt|prevHash|tenantId|sourceSystem|policy\.denied|agentos-core|undefined|NaN|HTTP|\b40[0-9]\b/);
    // no ISO instant either
    expect(text()).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it("technical values live only behind 技术详情, closed by default", async () => {
    await openDetail();
    expect(text()).not.toContain("1a2b3c4d5e6f7081");
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='aud02-detail-details'] button")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      toggle.click();
    });
    expect(text()).toContain("前一条摘要：0f1e2d3c4b5a6978a3b4c5d6e7f8091a");
    expect(text()).toContain("失败代码：policy.denied");
  });

  it("请求编号 is shown in full and copyable", async () => {
    await openDetail();
    const cell = document.querySelector("[data-testid='aud02-detail-request-id']")!;
    expect(cell.textContent).toContain("req-20261118-77aa");
    expect(cell.querySelector("button")).toBeTruthy();
  });

  it("an answer with no request number says 未提供 with its reason", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => ({ audit: { eventId: "evt_1", action: "task_created", outcome: "success" } }));
    await render("/audit/detail?id=evt_1");
    await waitFor(() => text().includes("结果与原因"), "bare detail painted");
    const cell = document.querySelector("[data-testid='aud02-detail-request-id']")!;
    expect(cell.textContent).toContain("未提供");
    expect(cell.textContent).not.toMatch(/\b0\b/);
  });
});

describe("the four states", () => {
  it("loading is a skeleton", async () => {
    api.fetchJSON.mockImplementation(() => new Promise(() => {}));
    await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
    expect(skeleton()).toBe(true);
    expect(text()).toContain("正在读取这条审计事件…");
  });

  it("error is human words, a copyable request id and a retry", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => {
      throw new ApiError("gateway", { status: 500, body: "", url: "/agent-api/api/audit/detail", requestId: "dt-err" });
    });
    await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
    await waitFor(() => document.querySelector("[data-testid='aud02-detail-error']") !== null, "error painted");
    expect(text()).toContain("这条事件没能加载出来");
    expect(text()).toContain("请求编号：dt-err");
    expect(document.querySelector("[data-testid='aud02-detail-error-request-id-value'] button")).toBeTruthy();
    expect(text()).not.toMatch(/\b500\b|HTTP|gateway/);
    api.fetchJSON.mockImplementation(async () => DETAIL);
    await act(async () => {
      const retry = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("重试"));
      (retry as HTMLButtonElement).click();
    });
    await waitFor(() => text().includes("结果与原因"), "retry loaded");
  });

  it("403 and 404 draw one byte-identical body, and no record above it", async () => {
    const once = async (status: number): Promise<string> => {
      api.fetchJSON.mockReset();
      api.fetchJSON.mockImplementation(async () => {
        throw new ApiError("denied", { status, body: '{"code":"console.forbidden"}', url: "/x", requestId: "dt-deny" });
      });
      await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
      await waitFor(() => document.querySelector("[data-testid='aud02-detail-denied']") !== null, `denied ${status}`);
      return document.querySelector("[data-testid='aud02-detail-denied']")?.outerHTML ?? "";
    };
    const forbidden = await once(403);
    expect(forbidden).toContain("暂时无法查看审计事件");
    expect(forbidden).toContain("请求编号：");
    expect(forbidden).toContain("dt-deny");
    expect(await once(404)).toBe(forbidden);
  });

  it("an answer that is not a record is an error, not a blank detail", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => ({ note: "只有备注" }));
    await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
    await waitFor(() => document.querySelector("[data-testid='aud02-detail-error']") !== null, "shape error painted");
    expect(text()).toContain("服务回的内容不是一条审计记录");
  });

  it("each QA leg opens from the URL and is stamped as a repro", async () => {
    const open = async (state: string): Promise<void> => {
      api.fetchJSON.mockReset();
      await render(`/audit/detail?id=evt_D6FC9A2B4E6F8012&state=${state}`);
      await waitFor(() => text().includes("复现出来的状态") || state === "loading", `?state=${state}`);
    };
    await open("loading");
    expect(document.querySelector("[data-testid='aud02-detail-loading'][data-fixture='loading']")).toBeTruthy();
    expect(api.fetchJSON).not.toHaveBeenCalled();
    await open("error");
    expect(document.querySelector("[data-testid='aud02-detail-error'][data-fixture='error']")).toBeTruthy();
    await open("denied");
    expect(document.querySelector("[data-testid='aud02-detail-denied'][data-fixture='denied']")).toBeTruthy();
  });
});
