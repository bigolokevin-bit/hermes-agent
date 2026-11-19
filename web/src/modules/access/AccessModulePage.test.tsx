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

import AccessModulePage, { AdminsModulePage } from "./AccessModulePage";

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
      source: "builtin",
      member_count: 2,
      permissions: ["knowledge.read", "audit.read"],
      members: [
        { user_id: "u_1234567890abcdef", realname: "陈可" },
        { user_id: "" },
      ],
      updated_at: "2026-11-19T06:30:00Z",
    },
  ],
};

async function clickRole() {
  const button = container.querySelector('[data-testid="ac3-expand"]') as HTMLElement | null;
  expect(button).toBeTruthy();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("AccessModulePage roles", () => {
  it("renders role name, members, human permissions, source and Beijing updated time", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(url.includes("/role") ? roles : people),
    );
    await render();
    const table = container.querySelector('[data-testid="ac3-table"]');
    expect(table).toBeTruthy();
    for (const header of ["角色名", "成员数", "关键权限", "来源", "更新时间"]) {
      expect(table?.textContent).toContain(header);
    }
    expect(table?.textContent).toContain("内容运营");
    expect(table?.textContent).toContain("2");
    expect(table?.textContent).toContain("查看知识");
    expect(table?.textContent).toContain("查看审计");
    expect(table?.textContent).toContain("内置");
    expect(table?.textContent).toContain("2026-11-19 14:30");
    expect(container.textContent).not.toContain("knowledge.read");
    expect(container.textContent).not.toContain("role_12345678");
    expect(container.textContent).not.toContain("u_1234567890abcdef");
    await clickRole();
    expect(container.querySelectorAll('[data-testid="ac3-member-row"]')).toHaveLength(2);
    expect(container.textContent).toContain("陈可");
    expect(container.textContent).toContain("未指派");
  });

  it("uses — with a visible reason for fields the upstream omits", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.resolve(url.includes("/role") ? { items: [{ role_id: "role_missing" }] } : people),
    );
    await render();
    const row = container.querySelector('[data-testid="ac3-row"]');
    expect(row?.textContent).toContain("待核实");
    expect(row?.textContent).toContain("上游未提供角色名");
    expect(row?.textContent).toContain("—");
    expect(row?.textContent).toContain("上游未提供成员数");
    expect(row?.textContent).toContain("上游未提供关键权限");
    expect(row?.textContent).toContain("上游未提供来源");
    expect(row?.textContent).toContain("上游未提供更新时间");
  });

  it("shows 未接入 with the GAP only in the title and a real application route", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("missing", { status: 404, body: "{}", url })),
    );
    await render();
    const gap = container.querySelector('[data-testid="ac3-gap"]');
    expect(gap?.textContent).toContain("未接入");
    expect(gap?.getAttribute("title")).toContain("GAP-ROL5-01");
    expect(container.textContent).not.toContain("GAP-");
    expect(container.querySelector('a[href="/approvals"]')?.textContent).toContain("提交开通申请");
    expect(container.querySelector('[data-testid="ac3-fixture-note"]')).toBeNull();
    expect(container.querySelector('[data-testid="ac3-page"]')?.hasAttribute("data-fixture")).toBe(false);
    expect(container.querySelectorAll('[data-testid="ac3-row"]')).toHaveLength(0);
  });

  it("uses the same neutral body for 403 and 404", async () => {
    fetchJSON.mockImplementation((url: string) =>
      Promise.reject(new ApiError("forbidden", { status: 403, body: "{}", url, requestId: "req-403" })),
    );
    await render();
    const gap = container.querySelector('[data-testid="ac3-gap"]');
    expect(gap?.textContent).toContain("未接入");
    expect(gap?.textContent).toContain("角色与权限待核实");
    expect(gap?.getAttribute("title")).toBe("GAP-ROL5-01");
    expect(container.querySelector('[data-testid="ac3-fixture-note"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid="ac3-row"]')).toHaveLength(0);
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
    expect(container.querySelector('[data-testid="ac3-request-id"]')).toBeTruthy();
    expect(container.textContent).toContain("重试");
    expect(container.textContent).not.toContain("HTTP");
  });

  it("forced error is live-state only: no sample rows, no fixture mark and no fetch", async () => {
    await render("/access?state=error");
    expect(fetchJSON).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="ac3-page"]')?.hasAttribute("data-fixture")).toBe(false);
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
describe("AccessModulePage admins and high-risk operations", () => {
  it("reads administrators and renders real audit rows for high-risk operations", async () => {
    const adminPeople = {
      items: [
        {
          user_id: "u_abcdef1234567890",
          realname: "林一舟",
          is_admin: true,
          roles: ["平台管理员"],
          last_login_at: "2026-11-19T06:30:00Z",
          last_high_risk_at: "2026-11-19T06:20:00Z",
          status: "active",
        },
      ],
    };
    const edge = {
      events: [
        {
          eventId: "ev_1234567890ABCDEF",
          action: "grant.created",
          occurredAt: "2026-11-19T06:20:00Z",
          actor: { type: "human", id: "u_abcdef1234567890" },
          resource: { type: "grant", id: "gr_1234567890ABCDEF" },
          correlationId: "req-risk-12345678",
        },
      ],
    };
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/v1/user/")) return Promise.resolve(adminPeople);
      if (url.includes("/role")) return Promise.resolve({ items: [] });
      if (url.includes("action=grant.created")) return Promise.resolve(edge);
      if (url.includes("/api/audit")) return Promise.resolve({ events: [] });
      return Promise.resolve({ items: [] });
    });
    await render("/access?tab=admins");
    expect(container.querySelector('[data-testid="ac3-tab-admins"]')?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector('[data-testid="adm5-page"]')).toBeTruthy();
    const adminTable = container.querySelector('[data-testid="adm5-admin-table"]');
    expect(adminTable?.textContent).toContain("林一舟 · 34567890");
    expect(adminTable?.textContent).toContain("平台管理员");
    expect(adminTable?.textContent).toContain("2026-11-19 14:30");
    expect(adminTable?.textContent).toContain("正常");
    const riskTable = container.querySelector('[data-testid="adm5-risk-table"]');
    expect(riskTable?.textContent).toContain("授权变更");
    expect(riskTable?.textContent).toContain("新建授权");
    expect(riskTable?.textContent).toContain("grant · 90ABCDEF");
    expect(riskTable?.textContent).toContain("2026-11-19 14:20");
    expect(container.querySelector('[data-testid="adm5-risk-copy"]')).toBeTruthy();
    expect(container.textContent).not.toContain("u_abcdef1234567890");
    expect(container.textContent).not.toContain("gr_1234567890ABCDEF");
  });

  it("shows the same neutral 未接入 body for 403 and 404", async () => {
    for (const status of [403, 404]) {
      fetchJSON.mockImplementation((url: string) =>
        Promise.reject(new ApiError("missing", { status, body: "{}", url })),
      );
      await act(async () => root.unmount());
      root = createRoot(container);
      await render("/access?view=admins");
      const adminGap = container.querySelector('[data-testid="adm5-gap"]');
      expect(adminGap?.textContent).toContain("未接入");
      expect(adminGap?.getAttribute("title")).toBe("GAP-ADM5-01");
      expect(adminGap?.textContent).toContain("管理员名单未接入");
      expect(container.querySelector('[data-testid="adm5-risk-gap"]')?.getAttribute("title")).toBe("GAP-ADM5-02");
      expect(container.textContent).not.toContain("GAP-");
      expect(container.querySelectorAll('[data-testid="adm5-admin-row"]')).toHaveLength(0);
      fetchJSON.mockReset();
    }
  });

  it("keeps — with a reason for missing admin fields and has no write controls", async () => {
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/v1/user/")) {
        return Promise.resolve({ items: [{ user_id: "u_1234567890abcdef", realname: "陈可", is_admin: true }] });
      }
      if (url.includes("/role")) return Promise.resolve({ items: [] });
      if (url.includes("/api/audit")) return Promise.resolve({ events: [] });
      return Promise.resolve({ items: [] });
    });
    await render("/access?view=admins");
    const row = container.querySelector('[data-testid="adm5-admin-row"]');
    expect(row?.textContent).toContain("陈可 · 90ABCDEF");
    expect(row?.textContent).toContain("—");
    expect(row?.textContent).toContain("上游未提供角色");
    expect(row?.textContent).toContain("上游未提供最近登录");
    expect(row?.textContent).toContain("上游未提供最近高危操作");
    expect(row?.textContent).toContain("上游未提供账号状态");
    for (const button of container.querySelectorAll("button")) {
      expect(button.textContent?.trim()).not.toMatch(/新建|创建|编辑|删除|授权|撤销|新增/);
    }
    expect(container.querySelectorAll("input, textarea, select")).toHaveLength(0);
  });

  it("shows a copyable request id and retry when every high-risk source fails", async () => {
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/v1/user/")) return Promise.reject(new ApiError("missing", { status: 404, body: "{}", url }));
      return Promise.reject(new ApiError("boom", { status: 500, body: "{}", url, requestId: "req-risk-5" }));
    });
    await render("/access?view=admins");
    const error = container.querySelector('[data-testid="adm5-risk-error"]');
    expect(error?.textContent).toContain("req-risk-5");
    expect(error?.querySelector('[data-testid="adm5-risk-error-request-id"]')).toBeTruthy();
    expect(error?.textContent).toContain("重试");
    expect(container.textContent).not.toContain("HTTP");
  });
  it("exports AdminsModulePage for the shell's admins slot and honours ?tab=admins", async () => {
    fetchJSON.mockImplementation((url: string) => {
      if (url.includes("/v1/user/")) {
        return Promise.resolve({ items: [{ user_id: "u_1234567890abcdef", realname: "陈可", is_admin: true }] });
      }
      if (url.includes("/role")) return Promise.resolve({ items: [] });
      if (url.includes("/api/audit")) return Promise.resolve({ events: [] });
      return Promise.resolve({ items: [] });
    });
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/identity?tab=admins"]}>
          <AdminsModulePage />
        </MemoryRouter>,
      );
    });
    await act(async () => {});
    expect(container.querySelector('[data-testid="adm5-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="adm5-admin-row"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="ac3-tab-admins"]')?.getAttribute("aria-selected")).toBe("true");
  });

});
