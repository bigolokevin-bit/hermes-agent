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
    { role_id: "role_12345678", role_name: "内容运营", permission_source: "role" },
  ],
};

describe("AccessModulePage", () => {
  it("renders roles with name + short code + human permission source", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(url.includes("/role") ? roles : people),
    );
    await render();
    const text = container.textContent ?? "";
    expect(text).toContain("内容运营");
    expect(text).toContain("角色授权");
    expect(text).toMatch(/[0-9A-F]{8}/);
    expect(text).not.toContain("role_12345678");
    expect(text).not.toContain("u_1234567890abcdef");
  });

  it("shows 未接入 + GAP-02 + a real application route when endpoints are absent", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("missing", { status: 404, body: "{}", url })),
    );
    await render();
    const text = container.textContent ?? "";
    expect(text).toContain("未接入");
    expect(text).toContain("GAP-02");
    expect(container.querySelector('a[href="/approvals"]')?.textContent).toContain("提交开通申请");
  });

  it("shows a request id and retry on 500", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-acc" })),
    );
    await render();
    expect(container.textContent).toContain("req-acc");
    expect(container.textContent).toContain("重试");
    expect(container.textContent).not.toContain("HTTP");
  });

  it("403 and 404 both use the same denied body, with no fake rows", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("denied", { status: 403, body: "{}", url })),
    );
    await render("/access?state=denied");
    const text = container.textContent ?? "";
    expect(text).toContain("无权访问");
    expect(container.querySelectorAll('[data-testid="acc4-role-row"]').length).toBe(0);
  });
});
