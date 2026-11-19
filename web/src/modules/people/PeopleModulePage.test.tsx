// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

// @nous-research/ui ships .webp assets vitest cannot load (same reason as the
// employee-detail suite — see docs/_artifacts/emp-detail/DONE.md).
vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children?: ReactNode;
    onClick?: () => void;
    [k: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} {...(rest as Record<string, never>)}>
      {children}
    </button>
  ),
  Card: ({ children, ...rest }: { children?: ReactNode; [k: string]: unknown }) => (
    <div {...(rest as Record<string, never>)}>{children}</div>
  ),
  CardContent: ({ children, className, ...rest }: { children?: ReactNode; className?: string; [k: string]: unknown }) => (
    <div className={className} {...(rest as Record<string, never>)}>{children}</div>
  ),
}));

import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import PeopleModulePage from "@/modules/people/PeopleModulePage";

let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function mockApi(handler: (url: string) => Promise<unknown>) {
  vi.mocked(fetchJSON).mockImplementation(((url: string) => handler(url)) as never);
}

const silent502 = (url: string, requestId = "req-default") =>
  Promise.reject(new ApiError("服务暂时不可用。", { status: 502, body: "", url, requestId }));
const missing = (url: string) =>
  Promise.reject(new ApiError("not found", { status: 404, body: "", url }));
const forbidden = (url: string) =>
  Promise.reject(new ApiError("forbidden", { status: 403, body: "", url }));

async function render() {
  await act(async () => {
    root.render(<PeopleModulePage />);
  });
  for (let i = 0; i < 5; i += 1) await act(async () => {});
}

const ROWS = {
  items: [
    {
      user_id: 42,
      realname: "李鲤",
      user_name: "lili",
      dept_name: "客服中心",
      status: 1,
      last_login: "2026-11-18T02:30:00Z",
    },
    {
      user_id: 43,
      realname: "阿澜",
      user_name: "alan",
      dept_name: "平台组",
      status: 0,
      last_login: "2026-11-17T16:05:00Z",
    },
  ],
};

describe("PeopleModulePage — T20 人员目录", () => {
  it("loading: skeleton, no engineering text", async () => {
    mockApi(() => new Promise(() => {}));
    await act(async () => {
      root.render(<PeopleModulePage />);
    });
    expect(container.querySelector('[data-testid="ppl4-loading"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(/undefined|NaN|user_id/);
  });

  it("ready: words, 北京时间到分, raw ids stay out of visible text", async () => {
    mockApi((url) => (url.includes("/user/list") ? Promise.resolve(ROWS) : missing(url)));
    await render();
    const list = container.querySelector('[data-testid="ppl4-list"]');
    expect(list?.textContent).toContain("李鲤");
    expect(list?.textContent).toContain("lili");
    expect(list?.textContent).toContain("客服中心");
    expect(list?.textContent).toContain("已启用");
    expect(list?.textContent).toContain("已停用");
    expect(list?.textContent).toContain("2026-11-18 10:30");
    expect(list?.textContent).not.toMatch(/user_id|42/);
    expect(container.querySelector('[data-testid="ppl4-row"]')?.getAttribute("title")).toBe("记录号 42");
    expect(container.textContent).toContain("共 2 人");
  });

  it("unknown status codes render 待核实, never a fake word", async () => {
    mockApi(() =>
      Promise.resolve({ items: [{ user_id: 7, realname: "测试", user_name: "test", status: 99 }] }),
    );
    await render();
    const list = container.querySelector('[data-testid="ppl4-list"]');
    expect(list?.textContent).toContain("待核实");
    expect(list?.textContent).not.toMatch(/status|99(?!人)/);
  });

  it("missing dept and last-active show 待核实", async () => {
    mockApi((url) =>
      url.includes("/user/all")
        ? Promise.resolve({ data: [{ user_id: 8, realname: "小鲤", user_name: "xiaoli", status: 1 }] })
        : missing(url),
    );
    await render();
    const row = container.querySelector('[data-testid="ppl4-row"]');
    expect(row?.textContent).toContain("待核实");
  });

  it("search narrows rows; a miss names the cause", async () => {
    mockApi((url) => (url.includes("/user/list") ? Promise.resolve(ROWS) : missing(url)));
    await render();
    const input = container.querySelector('[data-testid="ppl4-search"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(input, "阿澜");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelectorAll('[data-testid="ppl4-row"]').length).toBe(1);
    await act(async () => {
      setter?.call(input, "不存在的人");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const nomatch = container.querySelector('[data-testid="ppl4-nomatch"]');
    expect(nomatch?.textContent).toContain("没有匹配");
  });

  it("empty roster names the reason, never a blank pane", async () => {
    mockApi(() => Promise.resolve({ items: [] }));
    await render();
    const empty = container.querySelector('[data-testid="ppl4-empty"]');
    expect(empty?.textContent).toContain("后台还没有登记在册人员");
  });

  it("GAP-02: every candidate 404 → honest 待核实, no fabricated rows", async () => {
    mockApi((url) => missing(url));
    await render();
    const denied = container.querySelector('[data-testid="ppl4-denied"]');
    expect(denied?.textContent).toContain("待核实");
    expect(denied?.textContent).toContain("上游用户中心接口尚未接入");
    expect(denied?.textContent).toContain("重试");
    expect(container.querySelector('[data-testid="ppl4-list"]')).toBeNull();
  });

  it("403 → permission sentence, not a fake empty", async () => {
    mockApi((url) => forbidden(url));
    await render();
    const denied = container.querySelector('[data-testid="ppl4-denied"]');
    expect(denied?.textContent).toContain("你没有查看这块数据的权限");
  });

  it("5xx → plain sentence with request id and retry", async () => {
    mockApi((url) => silent502(url, "req-91"));
    await render();
    const err = container.querySelector('[data-testid="ppl4-error"]');
    expect(err?.textContent).toContain("请求编号：req-91");
    expect(err?.textContent).toContain("重试");
    expect(err?.textContent).not.toMatch(/HTTP 502|ApiError/);
  });
});
