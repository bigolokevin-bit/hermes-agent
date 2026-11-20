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
  it("asks the probed /api/audit-detail route with the id from the URL", async () => {
    await openDetail();
    expect(urls()[0]).toBe("/agent-api/api/audit-detail?id=evt_D6FC9A2B4E6F8012");
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

  it("a machine-shaped change value is folded, never printed", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => ({
      audit: {
        eventId: "evt_1a2b3c4d5e6f7081",
        event_type: "policy_changed",
        outcome: "succeeded",
        actor: { displayName: "陈默", id: "user:5566778899aabbcc" },
        change: {
          // no displayable value: only field names, which is engineering text
          before: { budget_cap: "ten_thousand", owner: "emp_9c1f2a3b4d5e6f70" },
          // a raw JSON string is engineering text too
          after: '{"budget_cap":"twenty_thousand"}',
        },
      },
    }));
    await render("/audit/detail?id=evt_1a2b3c4d5e6f7081");
    await waitFor(() => text().includes("变更前"), "change painted");
    // the human layer says where the value went instead of showing wire text
    expect(text()).toContain("见「技术详情」");
    expect(text()).not.toMatch(/budget_cap|ten_thousand|emp_9c1f2a3b4d5e6f70/);
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='aud02-detail-details'] button")!;
    await act(async () => {
      toggle.click();
    });
    expect(text()).toContain("变更前原值：{budget_cap、owner}");
    expect(text()).toContain('变更后原值：{"budget_cap":"twenty_thousand"}');
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
      throw new ApiError("gateway", { status: 500, body: "", url: "/agent-api/api/audit-detail", requestId: "dt-err" });
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
    const once = async (status: number): Promise<{ panel: string; page: string }> => {
      api.fetchJSON.mockReset();
      api.fetchJSON.mockImplementation(async () => {
        throw new ApiError("denied", { status, body: '{"code":"console.forbidden"}', url: "/x", requestId: "dt-deny" });
      });
      await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
      await waitFor(() => document.querySelector("[data-testid='aud02-detail-denied']") !== null, `denied ${status}`);
      return {
        panel: document.querySelector("[data-testid='aud02-detail-denied']")?.outerHTML ?? "",
        // the WHOLE page too: same sentence, same code+request-id envelope,
        // no path echo, and nothing (no rows, no field names) drawn first
        page: document.body.innerHTML,
      };
    };
    const forbidden = await once(403);
    expect(forbidden.panel).toContain("暂时无法查看审计事件");
    expect(forbidden.panel).toContain("请求编号：");
    expect(forbidden.panel).toContain("dt-deny");
    expect(forbidden.panel).not.toMatch(/\/agent-api|api\/audit|console\.forbidden|\b40[34]\b/);
    expect(forbidden.page).not.toMatch(/\/agent-api|api\/audit|console\.forbidden|\b40[34]\b/);
    const missing = await once(404);
    expect(missing.panel).toBe(forbidden.panel);
    expect(missing.page).toBe(forbidden.page);
  });

  it("an answer that is not a record is an error, not a blank detail", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => ({ note: "只有备注" }));
    await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
    await waitFor(() => document.querySelector("[data-testid='aud02-detail-error']") !== null, "shape error painted");
    expect(text()).toContain("服务回的内容不是一条审计记录");
  });

  it("a stray ?state= no longer fakes a state: the record is read for real", async () => {
    // R37: the ?state= repro leg is gone. Whatever the address asks for, the
    // pane reads the record and paints what the service answered.
    for (const state of ["loading", "empty", "error", "denied"]) {
      api.fetchJSON.mockReset();
      api.fetchJSON.mockImplementation(async () => DETAIL);
      await render(`/audit/detail?id=evt_D6FC9A2B4E6F8012&state=${state}`);
      await waitFor(
        () => document.querySelector("[data-testid='aud02-detail']") !== null,
        `real read for ?state=${state}`,
      );
      expect(document.querySelector("[data-testid='aud02-forced-note']")).toBeNull();
      expect(text()).not.toContain("复现出来的状态");
      expect(api.fetchJSON).toHaveBeenCalledTimes(1);
      expect(String(api.fetchJSON.mock.calls[0]?.[0])).toContain(
        "/api/audit-detail?id=evt_D6FC9A2B4E6F8012",
      );
    }
  });
});

describe("R41 — seconds and the raw payload", () => {
  it("shows the event time to the second and says so", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => DETAIL);
    await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
    await waitFor(() => document.querySelector("[data-testid='aud3-time']") !== null, "time block");
    expect(document.querySelector("[data-testid='aud3-time']")?.textContent).toContain("2026-11-18 11:00:00");
    expect(text()).toContain("精确到秒");
  });

  it("says the raw payload is unavailable when the answer only carries differences", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => DETAIL);
    await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
    await waitFor(() => document.querySelector("[data-testid='aud3-payload-unavailable']") !== null, "payload note");
    expect(document.querySelector("[data-testid='aud3-payload-unavailable']")?.textContent).toContain("证据不可用");
  });

  it("masks credential-shaped keys and counts them", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => ({
      audit: { ...DETAIL.audit, payload: { token: "abc123", nested: { password: "x" }, safe: "ok" } },
    }));
    await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
    await waitFor(() => document.querySelector("[data-testid='aud3-payload-json']") !== null, "payload block");
    const shown = document.querySelector("[data-testid='aud3-payload-json']")?.textContent ?? "";
    expect(shown).toContain('"token": "***"');
    expect(shown).toContain('"password": "***"');
    expect(shown).not.toContain("abc123");
    expect(document.querySelector("[data-testid='aud3-payload-masked']")?.textContent).toContain("已隐去 2 项");
  });
});

/**
 * audC — 详情这一屏的「复制结论行」。断言的是：控件在真详情回答之后出现、
 * 复制不发任何第二次请求、复制出的一行与预览那侧同一口径（时间 BJT 到秒 ·
 * 操作者 · 动作 · 资源 · rid），剪贴板拒绝时给只读 textarea 兜底。
 */
describe("audC - the copyable conclusion line on the detail screen", () => {
  function stubClipboard(ok: boolean): { calls: string[] } {
    const box: { calls: string[] } = { calls: [] };
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          box.calls.push(text);
          if (!ok) throw new Error("denied");
        },
      },
    });
    return box;
  }

  it("copies the painted line and asks the service nothing more", async () => {
    const clip = stubClipboard(true);
    await openDetail();
    const node = document.querySelector<HTMLButtonElement>("[data-testid='audC-copy']")!;
    expect(node).not.toBeNull();
    expect(node.getAttribute("aria-label")).toBe("复制结论行");
    const before = urls().length;
    await act(async () => {
      node.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(urls()).toHaveLength(before);
    // 2026-11-18 11:00:00 · 郑涛 · 11223344 · 权限提权被拒 · 权限 · ddeeff00 · req-20261118-77aa
    expect(clip.calls).toHaveLength(1);
    expect(clip.calls[0].startsWith("2026-11-18 11:00:00 · ")).toBe(true);
    expect(clip.calls[0].endsWith(" · req-20261118-77aa")).toBe(true);
    expect(clip.calls[0]).not.toMatch(/undefined|null|Z\b/);
    expect(document.querySelector("[data-testid='audC-copy-status']")!.textContent).toBe("已复制");
    expect(document.querySelector("[data-testid='audC-copy-status']")!.getAttribute("aria-live")).toBe("polite");
  });

  it("a refused clipboard still leaves the sentence selectable", async () => {
    const clip = stubClipboard(false);
    await openDetail();
    const before = urls().length;
    await act(async () => {
      document.querySelector<HTMLButtonElement>("[data-testid='audC-copy']")!.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const box = document.querySelector<HTMLTextAreaElement>("[data-testid='audC-copy-fallback']")!;
    expect(box.getAttribute("readonly")).not.toBeNull();
    expect(box.value).toBe(clip.calls[0]);
    expect(urls()).toHaveLength(before);
  });

  it("no denial panel, no copy control: a line is only copied from a real answer", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => {
      throw new ApiError("gone", { status: 404, body: '{"code":"audit.event_not_found"}', url: "/agent-api/api/audit-detail" });
    });
    await render("/audit/detail?id=evt_nope");
    await waitFor(() => document.querySelector("[data-testid='aud02-detail-denied']") !== null, "denied painted");
    expect(document.querySelector("[data-testid='audC-copy']")).toBeNull();
    expect(text()).not.toContain("复制结论行");
  });
});

/**
 * audE — 详情屏（`/audit/detail`，记录体 aud3）的「复制事件链接」。断言的是：
 * 控件在真回答之后出现、拼的是 origin + `/audit?event=<id>`（列表页在读的深链键，
 * 粘过去由列表定位展开该事件）、复制前后请求计数不变、剪贴板被拒给只读 textarea、
 * 403 与 404 同体且都没有可复制的链接。
 */
describe("audE - the event permalink on the detail screen", () => {
  function stubClipboard(ok: boolean): { calls: string[] } {
    const box: { calls: string[] } = { calls: [] };
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          box.calls.push(text);
          if (!ok) throw new Error("denied");
        },
      },
    });
    return box;
  }

  async function copy(): Promise<void> {
    const node = document.querySelector<HTMLButtonElement>("[data-testid='audE-link']")!;
    await act(async () => {
      node.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  it("copies a link to the event on screen, asking nothing more", async () => {
    const clip = stubClipboard(true);
    await openDetail();
    const before = urls().length;
    await copy();
    expect(urls()).toHaveLength(before);
    expect(clip.calls).toEqual([`${window.location.origin}/audit?event=evt_D6FC9A2B4E6F8012`]);
    expect(document.querySelector("[data-testid='audE-link-status']")!.textContent).toBe("链接已复制");
    expect(document.querySelector("[data-testid='audE-link-status']")!.getAttribute("aria-live")).toBe("polite");
    expect(document.querySelector("[data-testid='audE-link-fallback']")).toBeNull();
  });

  it("a refused clipboard hands the same link back as selectable text", async () => {
    const clip = stubClipboard(false);
    await openDetail();
    const before = urls().length;
    await copy();
    const box = document.querySelector<HTMLTextAreaElement>("[data-testid='audE-link-fallback']")!;
    expect(box.getAttribute("readonly")).not.toBeNull();
    expect(box.value).toBe(clip.calls[0]);
    expect(urls()).toHaveLength(before);
  });

  it("a denied record has no link to hand out", async () => {
    const once = async (status: number): Promise<void> => {
      api.fetchJSON.mockReset();
      api.fetchJSON.mockImplementation(async (url) => {
        throw new ApiError("gone", { status, body: '{"code":"console.forbidden"}', url, requestId: "rid-deny-e" });
      });
      await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
      await waitFor(() => document.querySelector("[data-testid='aud02-detail-denied']") !== null, `denied ${status}`);
    };
    await once(403);
    expect(document.querySelector("[data-testid='audE-link']")).toBeNull();
    const body403 = document.querySelector("[data-testid='agent-v2-page-audit-detail']")!.textContent ?? "";
    await once(404);
    expect(document.querySelector("[data-testid='audE-link']")).toBeNull();
    // 403 and 404 are one body — including the absence of a link to copy
    expect(document.querySelector("[data-testid='agent-v2-page-audit-detail']")!.textContent).toBe(body403);
  });

  it("a record whose answer carries no identifier says the link is not available", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => ({ audit: { action: "task.created", outcome: "succeeded" } }));
    await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "record painted");
    const node = document.querySelector<HTMLButtonElement>("[data-testid='audE-link']")!;
    expect(node.disabled).toBe(true);
    expect(node.getAttribute("title")).toBe("该行没有可用的固定标识");
  });
});

/**
 * audF — 详情屏的四态与另外两处同一套话。断言的是：状态标记带同样的标签，
 * 失败原因句与列表那一处的同一句话一致，重试只重发 audit-detail 恰一次，
 * 被拒时给「再读一次」的出口且地址里的标识不动；403 与 404 同体。
 */
describe("audF - the same states on the detail screen", () => {
  const detailReads = (): number => urls().filter((u) => u.startsWith("/agent-api/api/audit-detail")).length;
  const markLabel = (phase: string): string | null =>
    document.querySelector(`[data-testid='audF-state-detail-${phase}']`)?.getAttribute("data-audf-label") ?? null;

  async function clickRetry(testId: string): Promise<void> {
    const panel = document.querySelector(`[data-testid='${testId}']`);
    const button = [...(panel?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((node) => {
      const words = node.textContent ?? "";
      return words.includes("重试") || words.includes("再读一次");
    });
    if (!button) throw new Error(`no retry button in ${testId}`);
    await act(async () => {
      button.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
  }

  it("a failing read says the shared sentence, marks the shared phase, and retries once", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) => {
      throw new ApiError("down", {
        status: 503,
        body: '{"code":"console.unavailable"}',
        url: String(url),
        requestId: "rid-detail-503",
      });
    });
    await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
    await waitFor(() => document.querySelector("[data-testid='aud02-detail-error']") !== null, "detail failed");
    expect(markLabel("error")).toBe("读取没有完成");
    expect(document.querySelector("[data-testid='aud02-detail-error-sentence']")!.textContent).toContain(
      "审计服务在处理时出了错",
    );
    expect(document.querySelector("[data-testid='aud02-detail-error-request-id']")!.textContent).toContain("rid-detail-503");
    // the same answer, the same sentence as the list pane uses
    expect(document.querySelector("[data-testid='aud02-detail-error-sentence']")!.textContent).toBe(
      "审计服务在处理时出了错，请稍后重试。",
    );
    const before = detailReads();
    await clickRetry("aud02-detail-error");
    expect(detailReads()).toBe(before + 1);
  });

  it("a denied record keeps its identifier in the address and offers one way back", async () => {
    const leg = async (status: number, code: string): Promise<string> => {
      api.fetchJSON.mockReset();
      api.fetchJSON.mockImplementation(async (url) => {
        throw new ApiError("no", { status, body: `{"code":"${code}"}`, url: String(url), requestId: "rid-deny-f" });
      });
      await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
      await waitFor(() => document.querySelector("[data-testid='aud02-detail-denied']") !== null, `denied ${status}`);
      return document.querySelector("[data-testid='aud02-detail-denied']")!.textContent ?? "";
    };
    const closed = await leg(403, "console.forbidden");
    const missing = await leg(404, "console.unknown_route");
    // one body for both codes, with the same way back and the same rid
    expect(missing).toBe(closed);
    expect(markLabel("denied")).toBe("暂时无法查看审计事件");
    expect(window.location.search).toBeDefined();
    expect(document.querySelector("[data-testid='aud02-detail-denied-retry-block']")).not.toBeNull();
    expect(document.querySelector("[data-testid='aud02-detail-denied']")!.textContent).toContain("rid-deny-f");
    // only a route that is not here is called 未接入, in the title
    expect(document.querySelector("[data-testid='audF-state-detail-unwired']")).not.toBeNull();
    expect(document.querySelector("[data-testid='aud02-detail-denied']")!.getAttribute("title")).toContain("读口未接入");
  });

  it("the loading leg carries the same label while the answer is outstanding", async () => {
    let release: ((value: unknown) => void) | null = null;
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
    await waitFor(() => document.querySelector("[data-testid='aud02-detail-loading']") !== null, "loading");
    expect(markLabel("loading")).toBe("正在读取");
    await act(async () => {
      release?.({ audit: { eventId: "evt_D6FC9A2B4E6F8012", action: "task.created", outcome: "succeeded" } });
    });
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "record painted");
    expect(document.querySelector("[data-testid='audF-state-detail-error']")).toBeNull();
  });
});

/**
 * audJ — 独立详情屏（aud3）的时间与操作者与列表行、行内预览同一 helper、同一句话。
 * 断言的是：到秒的绝对北京时间、title 里的原值与时区标注、缺失时「该字段未返回」，
 * 以及操作者的完整标识只在 title。
 */
describe("audJ - the detail screen reads time and operator the same way", () => {
  const markValue = (testId: string): string | null =>
    document.querySelector(`[data-testid='${testId}']`)?.getAttribute("data-audj-value") ?? null;
  const markTitle = (testId: string): string | null =>
    document.querySelector(`[data-testid='${testId}']`)?.getAttribute("data-audj-title") ?? null;

  it("one absolute Beijing instant, quoted to the second, with its UTC origin", async () => {
    await openDetail();
    // DETAIL carries occurredAt 2026-11-18T03:00:00Z → 北京 11:00:00
    expect(markValue("audJ-time-detail")).toBe("2026-11-18 11:00:00");
    expect(markTitle("audJ-time-detail")).toContain("2026-11-18T03:00:00Z");
    expect(markTitle("audJ-time-detail")).toContain("北京时间（UTC+8）");
    expect(markValue("audJ-actor-detail")).toBe("郑涛 · 55667788");
    expect(markTitle("audJ-actor-detail")).toContain("user:1122334455667788");
    const surface = document.querySelector("[data-testid='agent-v2-page-audit-detail']")!.textContent ?? "";
    expect(surface).not.toContain("user:1122334455667788");
    // the visible cells still say which clock they speak
    expect(surface).toContain("以上时间均为北京时间，精确到秒");
  });

  it("a record whose answer carries no time says 该字段未返回 in the title's own words", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => ({
      audit: { eventId: "evt_D6FC9A2B4E6F8012", action: "task.created", outcome: "succeeded" },
    }));
    await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "record painted");
    expect(markValue("audJ-time-detail")).toBe("该字段未返回");
    expect(markTitle("audJ-time-detail")).toContain("不拿浏览器时间顶替");
    expect(markValue("audJ-actor-detail")).toBe("未指派");
    expect(markTitle("audJ-actor-detail")).toContain("没有带回这条记录的操作者");
  });
});

/**
 * audS — 详情屏作为三面之一，与列表 / 行内预览说同一句话。
 * 断言：同一 503 桩下，本屏的原因句与状态标签等于其它两面的读数；403≡404 同体；
 * 加载中也有本面的在场标记（三档各自的读法不再靠推测）。
 */
describe("audS - the detail screen speaks the shared sentence", () => {
  const sentence = (face: string, phase: string): string | null =>
    document
      .querySelector(`[data-testid='audF-state-${face}-${phase}']`)
      ?.getAttribute("data-aud-sentence") ?? null;
  const label = (face: string, phase: string): string | null =>
    document.querySelector(`[data-testid='audF-state-${face}-${phase}']`)?.getAttribute("data-audf-label") ?? null;

  it("one 503 stub, one sentence, in every face that prints it", async () => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url) => {
      throw new ApiError("down", { status: 503, body: "{}", url: String(url), requestId: "rid-s-detail" });
    });
    await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
    await waitFor(() => document.querySelector("[data-testid='aud02-detail-error']") !== null, "the record failed");
    expect(sentence("detail", "error")).toBe("审计服务在处理时出了错，请稍后重试。");
    expect(label("detail", "error")).toBe("读取没有完成");
    expect(document.querySelector("[data-testid='aud02-detail-error-sentence']")!.textContent).toBe(sentence("detail", "error"));
    expect(document.querySelector("[data-testid='aud02-detail-error-request-id']")!.textContent).toContain("rid-s-detail");
  });

  it("403 and 404 paint the same body here too, and the label says it once", async () => {
    const once = async (status: number): Promise<string> => {
      api.fetchJSON.mockReset();
      api.fetchJSON.mockImplementation(async (url) => {
        throw new ApiError("closed", { status, body: '{"code":"console.forbidden"}', url: String(url), requestId: "rid-s-eq" });
      });
      await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
      await waitFor(() => document.querySelector("[data-testid='aud02-detail-denied']") !== null, `denied ${status}`);
      expect(sentence("detail", "denied")).toBe("暂时无法查看审计事件");
      return document.querySelector("[data-testid='aud02-detail-denied']")!.textContent ?? "";
    };
    const closed = await once(403);
    expect(await once(404)).toBe(closed);
  });

  it("the loading leg of this face is on the record, not inferred", async () => {
    let release: ((value: unknown) => void) | null = null;
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    await render("/audit/detail?id=evt_D6FC9A2B4E6F8012");
    await waitFor(() => document.querySelector("[data-testid='aud02-detail-loading']") !== null, "loading");
    expect(label("detail", "loading")).toBe("正在读取");
    await act(async () => {
      release?.(DETAIL);
    });
    await waitFor(() => document.querySelector("[data-testid='aud02-detail']") !== null, "the record painted");
    expect(document.querySelector("[data-testid='audF-state-detail-loading']")).toBeNull();
  });
});
