// @vitest-environment jsdom
// AU-02 — 服务器导出（A5 建单 → A6 轮询 → 签名下载）前端消费面。
//
// 判据对应票面 DoD：
//   ①建单→轮询→下载全链（含 downloadUrl→BFF 路径改写逐字节）；
//   ②拒门族人话：403（角色）带请求编号、429（日上限）引导屏上快导/明日再试、
//     503（未开通）明说快导不受影响；
//   ③轮询预算用尽=slow 不是 failed，「再查一次」续同一单且绝不重复建单
//     （POST 恒为一问；幂等键随单）；
//   ④取消只停跟踪（canceled 词面不下「失败/完成」结论，AU-05 同词）；
//   ⑤两按钮语义不混：服务端单在飞时，「导出当前筛选 CSV」仍亮且文案不变，
//     服务端按钮文案恒带「整窗」。
//   ⑥草稿窗（customInvalid）按钮按不动且原因在 title；hook 层 exportBodyOf 兜底
//     不发请求（不造单）。
// 竞态纪律与 useAuditVerify 同源：迟到回答被 seq 票号吞掉。
//
// 查重：audit.export.* 既有件全部钉的是屏上快导族——本文件不动其任何行，
// 只新增 aud5-server-export-* 族与 useServerExport/serverExport 两个 owner 面。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditEventsModulePage from "./AuditEventsModulePage";
import {
  browserDownloadHref,
  exportBodyOf,
  exportFailCopyOf,
  SERVER_EXPORT_BASE,
} from "./serverExport";
import { useServerExport } from "./useServerExport";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---------------------------------------------------------------- pure table

describe("AU-02 serverExport pure legs", () => {
  it("窗完整才拼体；线名映射 action/actorId/resourceId；草稿窗 null", () => {
    const body = exportBodyOf({
      from: "2026-11-05T02:00:00Z",
      to: "2026-11-19T02:00:00Z",
      action: "task.created",
      actor: "employee-api",
      resource: null,
    });
    expect(body).toEqual({
      from: "2026-11-05T02:00:00Z",
      to: "2026-11-19T02:00:00Z",
      filters: { action: "task.created", actorId: "employee-api" },
    });
    expect(exportBodyOf({ from: null, to: "x", action: null })).toBeNull();
    expect(exportBodyOf({ from: "x", to: null, action: null })).toBeNull();
  });

  it("域 downloadUrl → BFF Q10 路径形态逐字节；不认识形状= null 不猜链", () => {
    expect(
      browserDownloadHref("/v1/audit/exports/exp_abc123/download?expires=1700000000&sig=deadbeef"),
    ).toBe(`${SERVER_EXPORT_BASE}/exp_abc123/download?expires=1700000000&sig=deadbeef`);
    expect(browserDownloadHref(null)).toBeNull();
    expect(browserDownloadHref("/v1/audit/exports/exp_1")).toBeNull();
    expect(browserDownloadHref("https://elsewhere.test/x")).toBeNull();
  });

  it("错误族各归其人话：403 给编号指引、429 指回屏上快导、503 说未开通", () => {
    const err = (status: number, code: string) =>
      new ApiError("x", { status, body: JSON.stringify({ code }), url: "/api/audit-export" });
    expect(exportFailCopyOf(err(403, "console.forbidden")).text).toContain("管理员");
    expect(exportFailCopyOf(err(403, "request.forbidden")).guide).toBe(true);
    expect(exportFailCopyOf(err(429, "audit.export_daily_limit")).text).toContain("导出当前筛选 CSV");
    expect(exportFailCopyOf(err(503, "audit.export_unavailable")).text).toContain("没有开通");
    expect(exportFailCopyOf(err(400, "audit.query_too_broad")).text).toContain("90 天");
    expect(exportFailCopyOf(new ApiError("gone", { status: 500, body: "<html>", url: "/u" })).text)
      .toContain("HTTP 500");
  });
});

// ---------------------------------------------------------------- hook chain

type Held = {
  url: string;
  init?: { method?: string; body?: string; headers?: Record<string, string>; signal?: AbortSignal };
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};

let held: Held[] = [];
let root: Root | null = null;

const WIN = {
  from: "2026-11-05T02:00:00Z",
  to: "2026-11-19T02:00:00Z",
  action: null,
  actor: null,
  resource: null,
};

const JOB = (status: string, extra: Record<string, unknown> = {}) => ({
  exportId: "exp_au02_0001",
  status,
  createdAt: "2026-11-24T03:00:00.000Z",
  downloadUrl: null,
  expiresAt: null,
  truncated: false,
  ...extra,
});

/** 直测钩子（AU-05 Probe 同谱系）：相位/下载锚走 DOM 断言，不重赋值外部变量。 */
function HookProbe({ opts }: { opts?: { intervalMs?: number; maxPolls?: number } }): ReactNode {
  const x = useServerExport(opts);
  return (
    <div>
      <span data-testid="probe-phase">{x.phase}</span>
      <span data-testid="probe-href">{x.downloadHref ?? "-"}</span>
      <span data-testid="probe-fail">{x.failure?.text ?? "-"}</span>
      <span data-testid="probe-rid">{x.failure?.requestId ?? "-"}</span>
      <button onClick={() => x.start(WIN)}>go</button>
      <button onClick={() => x.start({ from: null, to: null, action: null })}>go-draft</button>
      <button onClick={x.recheck}>recheck</button>
      <button onClick={x.cancel}>cancel</button>
    </div>
  );
}

function q(sel: string): Element | null {
  return document.querySelector(sel);
}
function phaseText(): string {
  return (q("[data-testid='probe-phase']")?.textContent ?? "").trim();
}
function clickText(label: string): void {
  const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === label);
  expect(btn, label).not.toBeUndefined();
  act(() => {
    (btn as HTMLElement).click();
  });
}

function mountHook(opts?: { intervalMs?: number; maxPolls?: number }): void {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <MemoryRouter initialEntries={["/audit"]}>
        <HookProbe opts={opts} />
      </MemoryRouter>,
    );
  });
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 4));
  });
}

const posts = (): Held[] => held.filter((h) => h.init?.method === "POST");
const polls = (): Held[] => held.filter((h) => !h.init?.method || h.init.method === "GET");

beforeEach(() => {
  document.body.replaceChildren();
  held = [];
  api.fetchJSON.mockReset();
  api.fetchJSON.mockImplementation((url: string, init?: Held["init"]) =>
    new Promise((resolve, reject) => {
      held.push({ url, init, resolve, reject });
    }));
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  const pending = held.splice(0);
  for (const h of pending) {
    try {
      h.resolve(null);
    } catch {
      /* settled */
    }
  }
});

describe("AU-02 useServerExport chain", () => {
  it("建单 pending → 轮询 completed → ready：下载锚是改写后的 BFF 路径", async () => {
    mountHook({ intervalMs: 1 });
    clickText("go");
    expect(posts()).toHaveLength(1);
    expect(posts()[0].url).toBe(SERVER_EXPORT_BASE);
    expect(posts()[0].init?.headers?.["Idempotency-Key"]).toMatch(/^au02-/);
    expect(JSON.parse(posts()[0].init?.body ?? "{}")).toEqual({
      from: WIN.from,
      to: WIN.to,
      filters: {},
    });
    expect(phaseText()).toBe("creating");

    await act(async () => {
      posts()[0].resolve(JOB("pending"));
    });
    expect(phaseText()).toBe("polling");

    await flush(); // interval fires
    expect(polls()).toHaveLength(1);
    expect(polls()[0].url).toBe(`${SERVER_EXPORT_BASE}?id=exp_au02_0001`);
    await act(async () => {
      polls()[0].resolve(
        JOB("completed", {
          downloadUrl: "/v1/audit/exports/exp_au02_0001/download?expires=1700000000&sig=ab12",
          expiresAt: "2026-11-24T03:15:00.000Z",
        }),
      );
    });
    expect(phaseText()).toBe("ready");
    expect(q("[data-testid='probe-href']")?.textContent).toBe(
      "/agent-api/api/audit-export/exp_au02_0001/download?expires=1700000000&sig=ab12",
    );
  });

  it("预算用尽=slow 不是失败；「再查一次」续同一单，POST 恒为一问", async () => {
    mountHook({ intervalMs: 1, maxPolls: 2 });
    clickText("go");
    await act(async () => {
      posts()[0].resolve(JOB("pending"));
    });
    await flush();
    await act(async () => {
      polls()[0].resolve(JOB("running"));
    });
    await flush();
    await act(async () => {
      polls()[1].resolve(JOB("running"));
    });
    await flush();
    expect(phaseText()).toBe("slow");
    expect(posts(), "slow 不是第二单").toHaveLength(1);
    const keyFirst = posts()[0].init?.headers?.["Idempotency-Key"];

    clickText("recheck");
    expect(phaseText()).toBe("polling");
    await flush();
    await act(async () => {
      polls()[2].resolve(JOB("completed", {
        downloadUrl: "/v1/audit/exports/exp_au02_0001/download?expires=2&sig=cd",
      }));
    });
    expect(phaseText()).toBe("ready");
    expect(posts()).toHaveLength(1);
    expect(posts()[0].init?.headers?.["Idempotency-Key"], "同一单同一幂等键").toBe(keyFirst);
  });

  it("轮询问被拒 429：失败文案带屏上快导指引与请求编号", async () => {
    mountHook({ intervalMs: 1 });
    clickText("go");
    await act(async () => {
      posts()[0].resolve(JOB("pending"));
    });
    await flush();
    await act(async () => {
      polls()[0].reject(
        new ApiError("limit", {
          status: 429,
          body: JSON.stringify({ code: "audit.export_daily_limit" }),
          url: SERVER_EXPORT_BASE,
          requestId: "req-au02-429",
        }),
      );
    });
    expect(phaseText()).toBe("failed");
    expect(q("[data-testid='probe-fail']")?.textContent).toContain("导出当前筛选 CSV");
    expect(q("[data-testid='probe-rid']")?.textContent).toBe("req-au02-429");
  });

  it("取消只停跟踪：迟到的 completed 被票号吞掉，状态不翻转", async () => {
    mountHook({ intervalMs: 1 });
    clickText("go");
    const post = posts()[0];
    clickText("cancel");
    expect(phaseText()).toBe("canceled");
    await act(async () => {
      post.resolve(JOB("completed", {
        downloadUrl: "/v1/audit/exports/exp_au02_0001/download?expires=9&sig=x",
      }));
    });
    expect(phaseText(), "取消后没有迟到的完成").toBe("canceled");
    expect(q("[data-testid='probe-href']")?.textContent).toBe("-");
  });

  it("卸载断在飞：resolve 不再触达（无 act 泄漏警告即通过）", async () => {
    mountHook({ intervalMs: 1 });
    clickText("go");
    await act(async () => {
      root?.unmount();
    });
    root = null;
    await act(async () => {
      posts()[0].resolve(JOB("pending"));
    });
    // 断言面：上一步若不吞迟到会触发 setState-on-unmounted 警告并让 flush 永挂。
    expect(posts()).toHaveLength(1);
  });

  it("job failed 态：文案指回屏上快导、不给下载", async () => {
    mountHook({ intervalMs: 1 });
    clickText("go");
    await act(async () => {
      posts()[0].resolve(JOB("failed"));
    });
    expect(phaseText()).toBe("failed");
    expect(q("[data-testid='probe-fail']")?.textContent).toContain("导出当前筛选 CSV");
    expect(q("[data-testid='probe-href']")?.textContent).toBe("-");
  });

  it("草稿窗不发单：exportBodyOf 兜底 + start 零请求", async () => {
    mountHook({ intervalMs: 1 });
    clickText("go-draft");
    expect(held).toHaveLength(0);
    expect(phaseText()).toBe("idle");
  });
});

// ---------------------------------------------------------------- page face

describe("AU-02 record page face", () => {
  const ROW = {
    eventId: "evt_au02_row_00000001",
    action: "task.created",
    occurredAt: "2026-11-19T01:20:00Z",
    recordedAt: "2026-11-19T01:20:05Z",
    outcome: "succeeded",
    actor: { type: "system", id: "employee-api" },
    resource: { type: "task", id: "tk_au02" },
    requestId: "req-au02-row",
  };
  const PAGE = "/audit?window=custom&from=2026-11-05T02:00:00Z&to=2026-11-19T02:00:00Z&limit=25";

  async function waitFor(cond: () => boolean, label: string): Promise<void> {
    const start = Date.now();
    while (!cond()) {
      if (Date.now() - start > 3000) throw new Error(`waitFor: ${label}`);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
      });
    }
  }

  let proot: Root | null = null;

  beforeEach(() => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async (url: string, init?: Held["init"]) => {
      const target = String(url);
      held.push({
        url: target,
        init,
        resolve: () => undefined,
        reject: () => undefined,
      });
      if (target.startsWith("/agent-api/api/audit-export")) {
        return init?.method === "POST"
          ? new Promise(() => undefined) // 挂住在飞：测按钮语义
          : JOB("running");
      }
      return { items: [ROW], nextCursor: null };
    });
  });

  afterEach(async () => {
    await act(async () => {
      proot?.unmount();
    });
    proot = null;
  });

  async function renderPage(entry: string): Promise<void> {
    document.body.replaceChildren();
    const container = document.createElement("div");
    document.body.append(container);
    proot = createRoot(container);
    await act(async () => {
      proot?.render(
        <MemoryRouter initialEntries={[entry]}>
          <AuditEventsModulePage />
        </MemoryRouter>,
      );
    });
    await waitFor(() => document.querySelector(".animate-pulse") === null, "skeleton gone");
  }

  it("服务端单在飞：两按钮语义不混——屏上快导仍亮、文案原样，服务端按钮禁用防叠发", async () => {
    await renderPage(PAGE);
    const serverBtn = document.querySelector("[data-testid='aud5-server-export']") as HTMLButtonElement;
    const localBtn = document.querySelector("[data-testid='aud5-export']") as HTMLButtonElement;
    expect(serverBtn, "整窗按钮在 bar 上").not.toBeNull();
    expect(serverBtn.textContent).toContain("整窗");
    expect(serverBtn.disabled).toBe(false);

    await act(async () => {
      serverBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(posts(), "一次点单一问建单").toHaveLength(1);

    await waitFor(
      () => document.querySelector("[data-testid='aud5-server-export-state']") !== null,
      "in-flight state line",
    );
    expect(localBtn.disabled, "服务端单不影响屏上快导").toBe(false);
    const scope = document.querySelector("[data-testid='audI-export-scope']");
    expect(scope?.textContent).toContain("导出的就是屏上这一份");
    expect(document.querySelector("[data-testid='aud5-server-export-cancel']")).not.toBeNull();
    const btn2 = document.querySelector("[data-testid='aud5-server-export']") as HTMLButtonElement;
    expect(btn2.disabled, "在飞不叠发第二单").toBe(true);
  });

  it("草稿窗（缺 to）：按钮按不动，原因写在 title，零请求", async () => {
    await renderPage("/audit?window=custom&from=2026-11-05T02:00:00Z&limit=25");
    const serverBtn = document.querySelector("[data-testid='aud5-server-export']") as HTMLButtonElement;
    expect(serverBtn.disabled).toBe(true);
    expect(serverBtn.getAttribute("title")).toContain("还不完整");
    expect(posts()).toHaveLength(0);
  });
});
