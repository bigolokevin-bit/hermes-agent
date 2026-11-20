// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";

import { Auth5Session } from "./Auth5Session";
import { clearSessionExpired, markSessionExpired } from "@/lib/session-expiry";

// R19 tail a: logout must clear the client-side identity immediately.
describe("Auth5Session (R19 tail a)", () => {
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
    clearSessionExpired();
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  it("logout drops the widget back to anonymous and leaves no identity text", async () => {
    let logoutCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/auth/logout") {
          logoutCalls += 1;
          return jsonResponse(200, { ok: true });
        }
        return jsonResponse(200, {
          display: "opsadmin",
          granted: "运维管理员",
          tenant_id: "t_seakoi_pilot",
        });
      }),
    );
    sessionStorage.setItem("auth5.session", "1");

    act(() => {
      root.render(
        <MemoryRouter>
          <Auth5Session />
        </MemoryRouter>,
      );
    });
    await flush();
    // signed-in view first
    const display = container.querySelector('[data-testid="auth5-display"]');
    expect(display?.textContent).toContain("opsadmin");
    expect(container.textContent).toContain("角色：运维管理员");

    const logout = container.querySelector<HTMLButtonElement>('[data-testid="auth5-logout"]');
    expect(logout).toBeTruthy();
    await act(async () => {
      logout!.click();
    });
    await flush();

    expect(logoutCalls).toBe(1);
    expect(sessionStorage.getItem("auth5.session")).toBeNull();
    expect(container.querySelector('[data-testid="auth5-display"]')).toBeNull();
    expect(container.textContent).not.toContain("opsadmin");
    expect(container.textContent).not.toContain("运维管理员");
    expect(container.textContent).toContain("未登录");
    expect(container.querySelector('[data-testid="auth5-goto-login"]')).toBeTruthy();
  });

  // 设计车道 ①（P0-①）：横幅在场时侧栏不再重复说「未登录」，出口保留。
  it("hides 未登录 while the session banner shows, keeps the login exit", async () => {
    markSessionExpired();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));

    act(() => {
      root.render(
        <MemoryRouter>
          <Auth5Session />
        </MemoryRouter>,
      );
    });
    await flush();

    expect(container.querySelector('[data-testid="auth5-widget"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="auth5-goto-login"]')).toBeTruthy();
    expect(container.textContent).not.toContain("未登录");

    // 横幅退场：「未登录」恢复，默认口径不回归。
    act(() => clearSessionExpired());
    await flush();
    expect(container.textContent).toContain("未登录");
  });

  // UI-QA P1：whoami 2xx 是登录证据，必须广播 auth5:verified 给同栏 AuthWidget。
  it("broadcasts auth5:verified when whoami confirms a login", async () => {
    const onVerified = vi.fn();
    window.addEventListener("auth5:verified", onVerified);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(200, {
          display: "opsadmin",
          granted: "运维管理员",
          tenant_id: "t_seakoi_pilot",
        }),
      ),
    );

    act(() => {
      root.render(
        <MemoryRouter>
          <Auth5Session />
        </MemoryRouter>,
      );
    });
    await flush();
    window.removeEventListener("auth5:verified", onVerified);

    expect(container.querySelector('[data-testid="auth5-display"]')?.textContent).toContain("opsadmin");
    expect(onVerified).toHaveBeenCalledTimes(1);
  });
});
