// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";

// ThemeToggle 用主题 context；测试里桩掉，不拖 Provider 全家桶（同 ThemeToggle.test 形制）。
vi.mock("../themes/context", () => ({
  useTheme: () => ({ themeName: "default", setTheme: vi.fn() }),
}));

import { IdentityMenu, identityFromWhoami } from "./IdentityMenu";

// UI-NAV L4-nav 条款 10：身份区一行（头像+姓名+角色），弹层含租户/主题/退出，禁裸 ID。
describe("IdentityMenu (L4-nav §e)", () => {
  let container: HTMLDivElement;
  let root: Root;
  const flush = async (times = 4) => {
    for (let i = 0; i < times; i += 1) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
    }
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    sessionStorage.clear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  const whoamiOk = (over: Record<string, unknown> = {}) =>
    jsonResponse(200, { display: "张三丰", granted: "运维管理员", tenant_id: "org_a1B2c3", ...over });

  const mount = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/runs"]}>
          <IdentityMenu />
        </MemoryRouter>,
      );
    });
    await flush();
  };

  it("renders one line: avatar + display + role, tenant only inside the popover", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => whoamiOk()));
    await mount();
    const trigger = container.querySelector('[data-testid="idn5-account"]');
    expect(trigger).not.toBeNull();
    expect(container.querySelector('[data-testid="idn5-avatar"]')?.textContent).toBe("张");
    expect(container.querySelector('[data-testid="idn5-display"]')?.textContent).toBe("张三丰");
    expect(container.querySelector('[data-testid="idn5-role"]')?.textContent).toBe("运维管理员");
    // 弹层收起时页面上没有租户位。
    expect(container.querySelector('[data-testid="idn5-tenant"]')).toBeNull();
    await act(async () => {
      (trigger as HTMLElement).click();
    });
    const tenant = container.querySelector('[data-testid="idn5-tenant"]');
    // 随机串形态的 tenant_id 一律不裸上屏。
    expect(tenant?.textContent).toBe("—");
    expect(container.textContent).not.toContain("org_a1B2c3");
    // 菜单含主题与退出。
    expect(container.querySelector('[data-testid="nav5-theme-toggle"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="idn5-logout"]')).not.toBeNull();
  });

  it("a human-readable tenant stays visible, a raw id never renders", () => {
    expect(identityFromWhoami(200, true, { display: "x", granted: "y", tenant_id: "SEAKOI 试点租户" }).k).toBe("ok");
    const masked = identityFromWhoami(200, true, { display: "x", granted: "y", tenant_id: "org_a1B2c3" });
    expect(masked.k === "ok" && masked.tenant).toBe("—");
  });

  it("maps known English roles to Chinese; unknown roles fall through verbatim", () => {
    const mapped = identityFromWhoami(200, true, { display: "x", granted: "AGENT", tenant_id: "SEAKOI 试点租户" });
    expect(mapped.k === "ok" && mapped.role).toBe("智能体");
    const admin = identityFromWhoami(200, true, { display: "x", granted: "admin", tenant_id: "t" });
    expect(admin.k === "ok" && admin.role).toBe("管理员");
    const unknown = identityFromWhoami(200, true, { display: "x", granted: "CHIEF_NOTARY", tenant_id: "t" });
    expect(unknown.k === "ok" && unknown.role).toBe("CHIEF_NOTARY"); // 未知回退原文，上报补表
  });

  it("role renders Chinese on screen and the gate finds an identity anchor", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => whoamiOk({ granted: "AGENT" })));
    await mount();
    expect(container.querySelector('[data-testid="idn5-role"]')?.textContent).toBe("智能体");
    // 验收闸选择器 [class*="identity"] 必须命中，且身份区文本零英文角色名。
    const anchor = container.querySelector('[class*="identity"]');
    expect(anchor).not.toBeNull();
    expect(anchor?.textContent).toMatch(/张三丰/);
    expect(anchor?.textContent).not.toMatch(/\b(admin|operator|viewer|owner|member|engineer|agent)\b/i);
  });

  it("anonymous whoami offers exactly one 去登录 exit and no identity text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(401, { detail: "no session" })));
    await mount();
    expect(container.querySelector('[data-testid="idn5-goto-login"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="idn5-account"]')).toBeNull();
    expect(container.textContent).not.toContain("opsadmin");
  });

  it("Escape closes the popover and returns focus to the trigger", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => whoamiOk()));
    await mount();
    const trigger = container.querySelector('[data-testid="idn5-account"]') as HTMLElement;
    await act(async () => {
      trigger.click();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await act(async () => {
      container.querySelector('[data-testid="idn5-pop"]')?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(container.querySelector('[data-testid="idn5-pop"]')).toBeNull();
    expect(container.querySelector('[data-testid="idn5-account"]')?.getAttribute("aria-expanded")).toBe("false");
  });

  it("logout clears identity text, session storage, and broadcasts the session event", async () => {
    let logoutCalls = 0;
    let loggedOut = false;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/auth/logout") {
        logoutCalls += 1;
        loggedOut = true;
        return jsonResponse(200, { ok: true });
      }
      // 登出后 whoami 如实 401（现网语义）。
      return loggedOut ? jsonResponse(401, { detail: "gone" }) : whoamiOk();
    }));
    const seen: string[] = [];
    const spy = (e: Event) => seen.push(e.type);
    window.addEventListener("auth5:session", spy);
    await mount();
    sessionStorage.setItem("auth5.session", "stale");
    const trigger = container.querySelector('[data-testid="idn5-account"]') as HTMLElement;
    await act(async () => {
      trigger.click();
    });
    await act(async () => {
      (container.querySelector('[data-testid="idn5-logout"]') as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 0));
    });
    await flush();
    expect(logoutCalls).toBe(1);
    expect(sessionStorage.getItem("auth5.session")).toBeNull();
    expect(container.textContent).not.toContain("张三丰");
    expect(container.querySelector('[data-testid="idn5-goto-login"]')).not.toBeNull();
    expect(seen).toContain("auth5:session");
    window.removeEventListener("auth5:session", spy);
  });
});
