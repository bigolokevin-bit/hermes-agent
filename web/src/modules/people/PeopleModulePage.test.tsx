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

    // P0-4 ②：数据源 backing 得住的列一律在场——五列表头与标题列名串维持现状。
    expect(Array.from(container.querySelectorAll(".ppl5-thead > span")).map((el) => el.textContent))
      .toEqual(["姓名", "账号", "部门", "状态", "最后活跃"]);
    expect(container.querySelector(".ppl5-thead")?.getAttribute("data-cols")).toBe("5");
    expect(container.textContent).toContain("在册人员名录 · 姓名 / 账号 / 部门 / 状态 / 最后活跃");

    // P0-4 ③：混合缺值（阿澜无部门、无活跃时刻）列保留，格内只剩 `—`，
    // 长说明退进 title，不再撑爆单元格。
    expect(list?.textContent).not.toContain("上游未提供");
    const deptCells = container.querySelectorAll('[data-testid="ppl5-dept"]');
    expect(deptCells[0]?.textContent).toBe("客服中心");
    expect(deptCells[1]?.textContent).toBe("—");
    expect(deptCells[1]?.getAttribute("title")).toBe("上游未提供部门");
    const activeCells = container.querySelectorAll('[data-testid="ppl5-last-active"]');
    expect(activeCells[1]?.textContent).toBe("—");
    expect(activeCells[1]?.getAttribute("title")).toContain("上游未提供最后活跃时间");
  });

  it("P0-4 ①: columns the source carries no values for drop out entirely", async () => {
    mockApi(() => Promise.resolve({ items: [{ user_id: "u_7", realname: "测试", status: 99 }] }));
    await render();
    // 三根可选列全缺 → 表头与单元格一起消失，不留「—+长注记」占位。
    expect(Array.from(container.querySelectorAll(".ppl5-thead > span")).map((el) => el.textContent))
      .toEqual(["姓名", "状态"]);
    expect(container.querySelector(".ppl5-thead")?.getAttribute("data-cols")).toBe("2");
    expect(container.textContent).toContain("在册人员名录 · 姓名 / 状态");
    expect(container.querySelector('[data-testid="ppl5-account"]')).toBeNull();
    expect(container.querySelector('[data-testid="ppl5-dept"]')).toBeNull();
    expect(container.querySelector('[data-testid="ppl5-last-active"]')).toBeNull();
    const row = container.querySelector('[data-testid="ppl5-row"]');
    expect(row?.textContent).toContain("测试");
    expect(row?.textContent).toContain("待核实");
    expect(row?.textContent).not.toContain("上游未提供");
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

  it("falls back to the real employee ledger and labels its source honestly", async () => {
    mockApi((url) =>
      url.includes("/employees")
        ? Promise.resolve({
            items: [
              { employeeId: "emp_217A91BA995044DFBB3E2E940B", name: "AgentOS 产品助理", lifecycleState: "active", updatedAt: "2026-11-17T05:52:48.030Z", department: null },
            ],
          })
        : missing(url),
    );
    await render();
    const list = container.querySelector('[data-testid="ppl5-list"]');
    expect(list?.textContent).toContain("AgentOS 产品助理 · 3E2E940B");
    expect(list?.textContent).toContain("在岗");
    // P0-4：台账给不出账号/部门/最后活跃——整列裁掉，不再逐格挂长注记，
    // 「—」占位也随之消失；裁列信息由下面这句来源注记一行承载。
    expect(list?.textContent).not.toContain("—");
    expect(list?.textContent).not.toContain("上游未提供");
    expect(Array.from(container.querySelectorAll(".ppl5-thead > span")).map((el) => el.textContent))
      .toEqual(["姓名", "状态"]);
    expect(container.textContent).toContain("在册人员名录 · 姓名 / 状态");
    const source = container.querySelector('[data-testid="ppl5-source"]')?.textContent ?? "";
    expect(source).toContain("数字员工台账");
    expect(source).toContain("真人用户中心接口尚未接入");
    expect(source).toContain("这里不冒充真人名单");
    expect(container.textContent).not.toContain("emp_217A91BA995044DFBB3E2E940B");
    expect(container.textContent).not.toContain("示例员工");
  });

  it("column presence is a property of the source, not of the search filter", async () => {
    mockApi((url) => (url.includes("/user/list") ? Promise.resolve(ROWS) : missing(url)));
    await render();
    // 阿澜没有部门，但李鲤有——筛到只剩阿澜时部门列也必须在场。
    await act(async () => {
      const input = container.querySelector<HTMLInputElement>('[data-testid="ppl5-search"]')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "阿澜");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(Array.from(container.querySelectorAll(".ppl5-thead > span")).map((el) => el.textContent))
      .toEqual(["姓名", "账号", "部门", "状态", "最后活跃"]);
    expect(container.querySelectorAll('[data-testid="ppl5-dept"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="ppl5-dept"]')?.textContent).toBe("—");
  });

  it("live view is not marked as a fixture", async () => {
    mockApi(() => Promise.resolve({ items: [] }));
    await render();
    expect(container.querySelector('[data-testid="ppl5-page"]')?.hasAttribute("data-" + "fixture")).toBe(false);
    expect(container.querySelector('[data-testid="ppl5-empty"]')).toBeTruthy();
  });
});
