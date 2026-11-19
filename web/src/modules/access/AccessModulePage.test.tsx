// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const fetchJSON = vi.fn();
vi.mock("@/lib/api", () => ({
  fetchJSON: (...args: unknown[]) => fetchJSON(...args),
}));

import AccessModulePage from "./AccessModulePage";

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
  fetchJSON.mockReset();
});

async function render(path = "/access") {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <AccessModulePage />
      </MemoryRouter>,
    );
  });
  await act(async () => {});
}

const people = {
  items: [
    { user_id: "u_1234567890abcdef", realname: "陈可", is_admin: false, permission_source: "role" },
    { user_id: "u_abcdef1234567890", realname: "林一舟", is_admin: true, permission_source: "menu" },
  ],
};
const roles = {
  items: [
    {
      role_id: "role_12345678",
      role_name: "内容运营",
      scope: "tenant",
      member_count: 3,
      updated_at: "2026-11-19T06:30:00Z",
    },
  ],
};

describe("AccessModulePage roles", () => {
  it("renders role name, scope, member count and Beijing updated time", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(url.includes("/role") ? roles : people),
    );
    await render();
    const table = container.querySelector('[data-testid="role5-table"]');
    expect(table).toBeTruthy();
    expect(table?.textContent).toContain("角色名");
    expect(table?.textContent).toContain("范围");
    expect(table?.textContent).toContain("成员数");
    expect(table?.textContent).toContain("更新时间");
    expect(table?.textContent).toContain("内容运营");
    expect(table?.textContent).toContain("全租户");
    expect(table?.textContent).toContain("3");
    expect(table?.textContent).toContain("2026-11-19 14:30");
    expect(container.textContent).not.toContain("role_12345678");
    expect(container.textContent).not.toContain("u_1234567890abcdef");
  });

  it("uses — with a visible reason for fields the upstream omits", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(url.includes("/role") ? { items: [{ role_id: "role_missing" }] } : people),
    );
    await render();
    const row = container.querySelector('[data-testid="role5-row"]');
    expect(row?.textContent).toContain("待核实");
    expect(row?.textContent).toContain("上游未提供角色名");
    expect(row?.textContent).toContain("—");
    expect(row?.textContent).toContain("上游未提供数据范围");
    expect(row?.textContent).toContain("上游未提供成员数");
    expect(row?.textContent).toContain("上游未提供更新时间");
  });

  it("shows 未接入 with the GAP only in the title and a real application route", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("missing", { status: 404, body: "{}", url })),
    );
    await render();
    const gap = container.querySelector('[data-testid="role5-gap"]');
    expect(gap?.textContent).toContain("未接入");
    expect(gap?.getAttribute("title")).toContain("GAP-ROL5-01");
    expect(container.textContent).not.toContain("GAP-");
    expect(container.querySelector('a[href="/approvals"]')?.textContent).toContain("提交开通申请");
  });

  it("distinguishes 401 with a request id and retry", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("需要登录：登录状态已经失效", { status: 401, body: "{}", url, requestId: "req-login" })),
    );
    await render();
    expect(container.textContent).toContain("需要登录");
    expect(container.textContent).toContain("req-login");
    expect(container.textContent).toContain("重试");
  });

  it("shows a request id and retry on 500 without an HTTP code", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-acc" })),
    );
    await render();
    expect(container.textContent).toContain("req-acc");
    expect(container.textContent).toContain("重试");
    expect(container.textContent).not.toContain("HTTP");
  });

  it("marks forced states as fixtures and does not fetch", async () => {
    await render("/access?state=error");
    expect(fetchJSON).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="acc4-page"]')?.getAttribute("data-fixture")).toBe("1");
    expect(container.querySelector('.acc4-error')).toBeTruthy();
  });

  it("renders no create/edit/delete controls and no raw ids", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(url.includes("/role") ? roles : people),
    );
    await render();
    const text = container.textContent ?? "";
    for (const button of container.querySelectorAll("button")) {
      expect(button.textContent?.trim()).not.toMatch(/新建|创建|编辑|删除|授权|撤销|新增/);
    }
    expect(container.querySelectorAll("input, textarea, select")).toHaveLength(0);
    expect(text).not.toContain("role_12345678");
    expect(text).not.toContain("u_1001");
  });
});