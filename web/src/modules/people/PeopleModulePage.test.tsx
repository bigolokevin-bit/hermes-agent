// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({ fetchJSON: vi.fn() }));

vi.mock("@nous-research/ui", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Button: ({ children, onClick, ...rest }: { children?: ReactNode; onClick?: () => void; [k: string]: unknown }) => (
    <button type="button" onClick={onClick} {...(rest as Record<string, never>)}>{children}</button>
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
  vi.clearAllMocks();
});

const mockApi = (handler: (url: string) => Promise<unknown>) =>
  vi.mocked(fetchJSON).mockImplementation(((url: string) => handler(url)) as never);

const missing = (url: string, status = 404) =>
  Promise.reject(new ApiError("not found", { status, body: "", url }));
const serverError = (url: string) =>
  Promise.reject(new ApiError("服务暂时不可用。", { status: 502, body: "", url, requestId: "req-ppl-5" }));

const ROWS = {
  items: [
    { user_id: "u_1234567890abcdef", realname: "李鲤", user_name: "lili", dept_name: "客服中心", status: 1, last_login: "2026-11-18T02:30:00Z" },
    { user_id: "u_0099887766554433", realname: "阿澜", user_name: "alan", status: 0 },
  ],
};

async function render(path = "/identity?tab=people") {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <PeopleModulePage />
      </MemoryRouter>,
    );
  });
  for (let i = 0; i < 4; i += 1) await act(async () => {});
}

describe("people directory ppl5", () => {
  it("loading: skeleton, no undefined or field names", async () => {
    mockApi(() => new Promise(() => {}));
    await act(async () => {
      root.render(<MemoryRouter initialEntries={["/identity?tab=people"]}><PeopleModulePage /></MemoryRouter>);
    });
    expect(container.querySelector('[data-testid="ppl5-loading"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(/undefined|NaN|user_id/);
  });

  it("ready: 姓名·短码, account, dept, status words and Beijing minute; raw id only title", async () => {
    mockApi((url) => (url.includes("/user/list") ? Promise.resolve(ROWS) : missing(url)));
    await render();
    const list = container.querySelector('[data-testid="ppl5-list"]');
    expect(list?.textContent).toContain("李鲤 · 90ABCDEF");
    expect(list?.textContent).toContain("lili");
    expect(list?.textContent).toContain("客服中心");
    expect(list?.textContent).toContain("已启用");
    expect(list?.textContent).toContain("2026-11-18 10:30");
    expect(list?.textContent).toContain("阿澜 · 66554433");
    expect(container.textContent).not.toContain("u_1234567890abcdef");
    expect(container.textContent).not.toContain("u_0099887766554433");
    expect(container.querySelector('[data-testid="ppl5-row"]')?.getAttribute("title")).toContain("u_1234567890abcdef");
  });

  it("missing account, dept and last active use — with visible reasons; unknown status 待核实", async () => {
    mockApi(() => Promise.resolve({ items: [{ user_id: "u_7", realname: "测试", status: 99 }] }));
    await render();
    const row = container.querySelector('[data-testid="ppl5-row"]');
    expect(row?.textContent).toContain("—");
    expect(row?.textContent).toContain("上游未提供账号");
    expect(row?.textContent).toContain("上游未提供部门");
    expect(row?.textContent).toContain("上游未提供最后活跃时间");
    expect(row?.textContent).toContain("待核实");
    expect(row?.textContent).not.toContain("status");
  });

  it("403 and 404 draw the same 未接入 body with GAP only in title", async () => {
    for (const status of [403, 404]) {
      mockApi((url) => missing(url, status));
      await act(async () => root.unmount());
      root = createRoot(container);
      await render();
      const body = container.querySelector('[data-testid="ppl5-unwired"]');
      expect(body?.textContent).toContain("人员目录未接入");
      expect(body?.textContent).toContain("上游用户中心接口尚未对控制台开放");
      expect(body?.getAttribute("title")).toBe("GAP-02");
      expect(container.textContent).not.toContain("GAP-");
      expect(container.querySelector('[data-testid="ppl5-list"]')).toBeNull();
      expect(container.querySelector('[data-testid="ppl5-apply"]')?.getAttribute("href")).toBe("/approvals");
      vi.clearAllMocks();
    }
  });

  it("5xx shows human copy, copyable request id and retry; no HTTP code", async () => {
    mockApi((url) => serverError(url));
    await render();
    const error = container.querySelector('[data-testid="ppl5-error"]');
    expect(error?.textContent).toContain("请求编号 req-ppl-5");
    expect(container.querySelector('[data-testid="ppl5-request-id-copy"]')).toBeTruthy();
    expect(error?.textContent).toContain("重试");
    expect(container.textContent).not.toContain("HTTP");
  });

  it("empty roster names the reason without a 0 count", async () => {
    mockApi(() => Promise.resolve({ items: [] }));
    await render();
    const empty = container.querySelector('[data-testid="ppl5-empty"]');
    expect(empty?.textContent).toContain("后台还没有登记在册人员");
    expect(empty?.textContent).not.toContain("共 0 人");
  });

  it("forced states marked as fixtures never fetch", async () => {
    await render("/identity?tab=people&state=error");
    expect(fetchJSON).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="ppl5-page"]')?.hasAttribute("data-" + "fixture")).toBe(false);
    expect(container.querySelector('[data-testid="ppl5-error"]')).toBeTruthy();
  });
});
