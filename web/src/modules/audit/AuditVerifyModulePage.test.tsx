// @vitest-environment jsdom
// T33 — 时间窗完整性校验页。这一页只说服务真的回答过的话：没跑过就写没跑过，
// 跑不动就写「本环境未启用」并给出原因与请求编号；条数带着分母显示，缺的那格写「—」。

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import AuditVerifyModulePage from "@/modules/audit/AuditVerifyModulePage";

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
const urls = (): string[] => api.fetchJSON.mock.calls.map((call) => String(call[0]));

const click = async (label: string): Promise<void> => {
  const node = Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes(label));
  if (!node) throw new Error(`button labelled ${label} not found`);
  await act(async () => {
    (node as HTMLButtonElement).click();
  });
};

/** Run the 24-hour window and wait for the pane to stop being busy. */
async function runWindow(entry = "/system?tab=events&view=verify"): Promise<void> {
  await render(entry, <AuditVerifyModulePage />);
  await waitFor(() => text().includes("还没有运行校验"), "idle painted");
  await click("最近 24 小时");
  await waitFor(
    () => !text().includes("正在按所选时间窗核对审计链…") && !document.querySelector(".animate-pulse"),
    "verify settled",
  );
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

describe("the check only runs when it is asked for", () => {
  it("opens idle, asks nothing, and says so", async () => {
    await render("/system?tab=events&view=verify", <AuditVerifyModulePage />);
    await waitFor(() => text().includes("还没有运行校验"), "idle");
    expect(api.fetchJSON).not.toHaveBeenCalled();
    expect(text()).toContain("没有跑过的校验，这里不会写「已通过」");
    expect(text()).not.toContain("没有发现断点");
  });

  it("sends the chosen window as two instants on the real route", async () => {
    api.fetchJSON.mockImplementation(async () => ({ ok: true, scanned: 12, total: 12, broken: 0 }));
    await runWindow();
    expect(urls()[0]).toMatch(/^\/agent-api\/api\/audit\/verify\?from=\d{4}-\d{2}-\d{2}T.*&to=\d{4}-\d{2}-\d{2}T/);
    expect(document.querySelector("[data-testid='agent-v2-page-audit-verify']")).toBeTruthy();
  });

  it("the window is shown as Beijing wall clock, never as the wire form", async () => {
    api.fetchJSON.mockImplementation(async () => ({ ok: true, scanned: 12, total: 12, broken: 0 }));
    await runWindow();
    expect(text()).toContain("校验窗口（北京时间）：2026");
    expect(text()).not.toMatch(/T\d{2}:\d{2}:\d{2}/);
    expect(text()).not.toMatch(/from=|to=/);
  });

  it("choosing 7 天 asks a wider window than 24 小时", async () => {
    api.fetchJSON.mockImplementation(async () => ({ ok: true, scanned: 1, total: 1, broken: 0 }));
    await runWindow();
    const narrow = urls()[0] ?? "";
    await click("最近 7 天");
    await waitFor(() => urls().length > 1, "second window asked");
    const wide = urls()[1] ?? "";
    const span = (url: string): number => {
      const from = Date.parse(decodeURIComponent(/from=([^&]*)/.exec(url)?.[1] ?? ""));
      const to = Date.parse(decodeURIComponent(/to=([^&]*)/.exec(url)?.[1] ?? ""));
      return to - from;
    };
    expect(span(wide) / span(narrow)).toBeCloseTo(7, 1);
  });
});

describe("what the answer can say", () => {
  it("an intact chain shows the counts with their denominator", async () => {
    api.fetchJSON.mockImplementation(async () => ({
      ok: true,
      scanned: 120,
      total: 200,
      broken: 0,
      from: "2026-11-18T00:00:00Z",
      to: "2026-11-19T00:00:00Z",
    }));
    await runWindow();
    expect(text()).toContain("没有发现断点");
    expect(text()).toContain("120 / 200");
    expect(text()).toContain("对不上的");
    expect(text()).toContain("2026-11-18 08:00 至 2026-11-19 08:00");
    // each count is addressable, and its denominator is part of the same line
    expect(document.querySelector("[data-testid='aud03-scanned']")?.textContent).toContain("120 / 200");
    expect(document.querySelector("[data-testid='aud03-broken']")?.textContent).toContain("0");
  });

  it("a broken chain says how many, and does not soften it", async () => {
    api.fetchJSON.mockImplementation(async () => ({ valid: false, checked: 300, mismatches: 4 }));
    await runWindow();
    expect(text()).toContain("发现对不上的地方");
    expect(text()).toContain("300");
    expect(text()).toContain("4");
    expect(text()).not.toContain("没有发现断点");
  });

  it("a count the service did not send stays 「—」 with the reason in its title", async () => {
    api.fetchJSON.mockImplementation(async () => ({ ok: true, scanned: 40 }));
    await runWindow();
    expect(text()).toContain("40");
    expect(text()).toContain("—");
    const titled = Array.from(document.querySelectorAll("[title]")).map((n) => n.getAttribute("title") ?? "").join(" ");
    expect(titled).toContain("服务未说明这个窗口里一共有多少条");
  });

  it("a conclusion with no numbers is said out loud, not smoothed over", async () => {
    api.fetchJSON.mockImplementation(async () => ({ verdict: "done" }));
    await runWindow();
    expect(text()).toContain("校验跑完了，但结论没说清楚");
    expect(text()).toContain("上面三格都只能写「—」");
    expect(text()).not.toContain("没有发现断点");
  });

  it("an answer that is not a check result at all is an error, with the trace id", async () => {
    api.fetchJSON.mockImplementation(async () => {
      throw new ApiError("weird", { status: 401, body: '{"code":"console.unauthenticated"}', url: "/x", requestId: "vf-expired" });
    });
    await runWindow();
    expect(text()).toContain("完整性校验没能给出结果");
    expect(text()).toContain("登录状态已经失效");
    expect(text()).toContain("请求编号：vf-expired");
    expect(text()).not.toMatch(/\b401\b|HTTP|console\./);
  });
});

describe("a check that cannot run", () => {
  const deniedOnce = async (status: number, requestId = "vf-deny"): Promise<string> => {
    api.fetchJSON.mockReset();
    api.fetchJSON.mockImplementation(async () => {
      throw new ApiError("nope", {
        status,
        body: '{"code":"console.unavailable"}',
        url: "/agent-api/api/audit/verify",
        requestId,
      });
    });
    await runWindow();
    return document.querySelector("[data-testid='aud03-unavailable']")?.outerHTML ?? "";
  };

  it("403 and 404 render one identical 本环境未启用 body, with reason and request id", async () => {
    const forbidden = await deniedOnce(403);
    expect(forbidden).toContain("本环境未启用");
    expect(forbidden).toContain("没有提供完整性校验");
    expect(forbidden).toContain("请求编号：vf-deny");
    // and it says where to go next, not just that it failed
    expect(forbidden).toContain("下一步");
    expect(text()).not.toContain("没有发现断点");
    // the same answer at a 404 draws the same markup, down to the byte
    expect(await deniedOnce(404)).toBe(forbidden);
  });

  it("a closed capability and an unreachable chain service read the same way", async () => {
    for (const status of [405, 501, 503]) {
      await deniedOnce(status);
      expect(text()).toContain("本环境未启用");
      expect(text()).toContain("请求编号：");
      expect(text()).not.toMatch(/\b(405|501|503)\b|HTTP/);
    }
  });

  it("the panel offers a way to try again and stamps the reason", async () => {
    await deniedOnce(404);
    const before = urls().length;
    api.fetchJSON.mockImplementation(async () => ({ ok: true, scanned: 1, total: 1, broken: 0 }));
    await click("再运行一次");
    await waitFor(() => urls().length > before, "retried");
    expect(text()).toContain("没有发现断点");
  });
});

describe("the QA legs", () => {
  it("each forced state renders, carries data-fixture, and asks nothing", async () => {
    const open = async (state: string): Promise<void> => {
      await render(`/system?tab=events&view=verify&state=${state}`, <AuditVerifyModulePage />);
      await waitFor(() => text().includes("复现出来的状态") || state === "loading", `?state=${state}`);
    };
    await open("loading");
    expect(document.querySelector("[data-testid='aud03-loading'][data-fixture='loading']")).toBeTruthy();
    await open("empty");
    expect(document.querySelector("[data-testid='aud03-idle'][data-fixture='empty']")).toBeTruthy();
    await open("error");
    expect(document.querySelector("[data-testid='aud03-error'][data-fixture='error']")).toBeTruthy();
    await open("denied");
    expect(document.querySelector("[data-testid='aud03-unavailable'][data-fixture='denied']")).toBeTruthy();
    expect(api.fetchJSON).not.toHaveBeenCalled();
  });

  it("the engineering words stay behind 技术详情", async () => {
    api.fetchJSON.mockImplementation(async () => ({
      ok: true,
      scanned: 120,
      total: 200,
      broken: 0,
      checkedWindow: "2026-11-18T00:00:00Z",
    }));
    await runWindow();
    expect(text()).not.toMatch(/scanned|checkedWindow|total_count|ok:/);
    const toggle = document.querySelector<HTMLButtonElement>("[data-testid='aud03-result-details'] button");
    if (!toggle) throw new Error("the result's own 技术详情 is missing");
    if (toggle) {
      await act(async () => {
        toggle.click();
      });
      expect(text()).toMatch(/checkedWindow|scanned/);
    }
  });
});
