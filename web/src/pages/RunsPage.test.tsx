// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-error";

const apiMocks = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: apiMocks.fetchJSON }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function waitFor(cond: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor: condition never became true");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

/** One page at a time: the previous mount is torn down and the body cleared. */
async function render(page: ReactNode): Promise<void> {
  await act(async () => {
    root?.unmount();
  });
  document.body.replaceChildren();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(page);
  });
  // Wait out the loading skeleton (the only aria-hidden pulse block).
  await waitFor(() => !document.querySelector("[aria-hidden='true'] .animate-pulse"));
}

function mountWith(handler: (url: string) => Promise<unknown>): Promise<void> {
  apiMocks.fetchJSON.mockImplementation(handler);
  return import("./RunsPage").then(({ default: Page }) => render(<Page />));
}

const text = (): string => document.body.textContent ?? "";
const labels = (): string[] =>
  [...document.querySelectorAll("button")].map((b) => (b.textContent ?? "").trim());

beforeEach(() => {
  apiMocks.fetchJSON.mockReset();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

describe("RunsPage denied state", () => {
  const deniedBody = '{"detail":"nope","request_id":"req-7f2a"}';

  const denied = (status: number) =>
    mountWith(async () => {
      throw new ApiError("denied", { status, body: deniedBody, url: "/agent-api/api/runs" });
    });

  it("renders one whole panel for 403 and carries the trace id", async () => {
    await denied(403);
    expect(text()).toContain("暂时无法查看运行记录");
    expect(text()).toContain("请求编号：req-7f2a");
    expect(document.querySelectorAll("dl")).toHaveLength(0);
    expect(labels()).toEqual([]); // no refresh beside a panel that cannot load
  });

  it("does not distinguish 404 from 403", async () => {
    await denied(403);
    const forbidden = document.body.innerHTML;
    await denied(404);
    expect(document.body.innerHTML).toBe(forbidden);
  });

  it("says 「未提供」 when the gateway sends no request id", async () => {
    await mountWith(async () => {
      throw new ApiError("gate", { status: 403, body: "<html>bad gateway</html>", url: "/x" });
    });
    expect(text()).toContain("请求编号：未提供");
    expect(text()).not.toContain("bad gateway");
  });
});

describe("RunsPage rows", () => {
  it("shows Beijing time, USD and a masked employee, never the raw handle", async () => {
    await mountWith(async () => ({
      items: [
        {
          runId: "run_9e1c4f",
          title: "整理上周的巡检记录",
          status: "succeeded",
          employee: "emp_7f3a91b2",
          startedAt: "2026-11-18T00:00:00Z",
          finishedAt: "2026-11-18T00:42:00Z",
          costUsd: 1234.5,
          steps: 7,
        },
      ],
    }));
    expect(text()).toContain("整理上周的巡检记录");
    expect(text()).toContain("已完成");
    expect(text()).toContain("2026-11-18 08:00");
    expect(text()).toContain("$1,234.50");
    expect(text()).toContain("7 步");
    expect(text()).toContain("员工 · 91b2");
    expect(text()).not.toContain("emp_7f3a91b2");
    expect(text()).not.toContain("succeeded");
    expect(text()).not.toContain("2026-11-18T00:00:00Z");
    expect(text()).not.toMatch(/undefined|NaN/);
    // The raw handle stays available to support in a title attribute only.
    const titles = [...document.querySelectorAll<HTMLElement>("[title]")].map((el) => el.title);
    expect(titles).toContain("emp_7f3a91b2");
  });

  it("marks missing values as 「—」 instead of a fake zero", async () => {
    await mountWith(async () => ({ runs: [{ id: "r-1", title: "只有一条标题的运行" }] }));
    expect(text()).toContain("未指派");
    expect(text()).toContain("状态未知");
    expect(text()).toContain("—");
    expect(text()).not.toContain("$0.00");
    expect(text()).not.toContain("0 步");
  });

  it("keeps a real zero at zero", async () => {
    await mountWith(async () => ({ items: [{ id: "r-0", title: "零成本运行", costUsd: 0, steps: 0 }] }));
    expect(text()).toContain("$0.00");
    expect(text()).toContain("0 步");
  });

  it("reports unreadable records with their denominator", async () => {
    await mountWith(async () => ({ items: [{ id: "r-1", title: "可读" }, "garbage", "garbage"] }));
    expect(text()).toContain("有 2 / 3 条记录缺少可显示的内容");
  });

  it("explains an empty queue and offers the next step", async () => {
    await mountWith(async () => ({ items: [] }));
    expect(text()).toContain("还没有运行记录");
    expect(text()).toContain("每一次运行都会按时间出现在这里");
    expect(labels()).toContain("刷新");
  });

  it("surfaces a plain sentence and a retry for a server failure", async () => {
    await mountWith(async () => {
      throw new ApiError("boom", { status: 500, body: '{"detail":"内部处理失败"}', url: "/x" });
    });
    expect(text()).toContain("运行记录没能加载出来");
    expect(text()).toContain("服务在处理时出了错");
    expect(text()).not.toMatch(/\b500\b/);
    expect(labels()).toContain("重试");
    // The technical detail is still reachable — in a title, not on screen.
    const titles = [...document.querySelectorAll<HTMLElement>("[title]")].map((el) => el.title);
    expect(titles.join("\n")).toContain("内部处理失败");
  });

  it("keeps an unparseable answer off the screen", async () => {
    // What a dev server's SPA fallback does: HTTP 200 with an HTML body, so
    // fetchJSON rejects on JSON.parse before any ApiError exists.
    await mountWith(async () => {
      throw new SyntaxError(`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`);
    });
    expect(text()).toContain("服务回的内容认不出来");
    expect(text()).toContain("请求编号：未提供");
    expect(text()).not.toContain("DOCTYPE");
    expect(text()).not.toContain("JSON");
    expect(labels()).toContain("重试");
  });

  it("pages with the cursor the service returned", async () => {
    const seen: string[] = [];
    await mountWith(async (url: string) => {
      seen.push(url);
      return url.includes("cursor=")
        ? { items: [{ id: "r-2", title: "第二页的运行" }] }
        : { items: [{ id: "r-1", title: "第一页的运行" }], nextCursor: "cur abc/+" };
    });
    expect(text()).toContain("第一页的运行");
    const more = [...document.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("加载更多"),
    );
    expect(more).toBeTruthy();
    await act(async () => {
      more?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await waitFor(() => text().includes("第二页的运行"));
    expect(seen[0]).toBe("/agent-api/api/runs");
    expect(seen[1]).toBe("/agent-api/api/runs?cursor=cur%20abc%2F%2B");
    expect(text()).toContain("已显示 2 条运行记录");
  });
});
