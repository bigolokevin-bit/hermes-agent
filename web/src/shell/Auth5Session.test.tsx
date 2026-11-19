// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";

import { Auth5Session } from "./Auth5Session";

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
});
