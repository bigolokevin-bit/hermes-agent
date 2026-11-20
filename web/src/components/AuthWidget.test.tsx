// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthWidget } from "./AuthWidget";
import { shouldHideAuthWidget } from "./auth-widget-visibility";
import { clearSessionExpired, markSessionExpired } from "@/lib/session-expiry";

// --- Unit tests for the visibility helper ---

describe("AuthWidget loopback identity", () => {
  it("hides the auth and logout affordance for loopback identity", () => {
    expect(
      shouldHideAuthWidget({
        display_name: "Local",
        email: "",
        expires_at: 0,
        org_id: "",
        provider: "loopback",
        user_id: "local",
      }),
    ).toBe(true);
  });

  it("keeps the widget visible for gated identities", () => {
    expect(
      shouldHideAuthWidget({
        display_name: "",
        email: "",
        expires_at: 123,
        org_id: "org",
        provider: "portal",
        user_id: "user-1",
      }),
    ).toBe(false);
  });
});

// --- Integration tests: AuthWidget + real api.getAuthMe ---

/** Return a fetch mock that resolves with a JSON Response. */
function jsonFetchMock(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
        status,
      }),
  );
}

/** Wait one microtick for React to flush state updates. */
function flush() {
  return act(() => Promise.resolve());
}

describe("AuthWidget integration (real getAuthMe)", () => {
  let root: Root;
  let container: HTMLDivElement;

  afterEach(() => {
    clearSessionExpired();
    if (root) {
      root.unmount();
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function setupWindow(overrides: Partial<Window> = {}) {
    // The widget mounts a permanent `auth5:verified` listener (UI-QA P1);
    // the stubbed window carries a minimal event target so mount/unmount
    // and dispatch all work against this same registry.
    const listeners = new Map<string, Set<(event: Event) => void>>();
    vi.stubGlobal("window", {
      __HERMES_SESSION_TOKEN__: undefined,
      __HERMES_BASE_PATH__: "",
      location: { assign: vi.fn(), pathname: "/", search: "" },
      addEventListener: (type: string, fn: (event: Event) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: (event: Event) => void) => {
        listeners.get(type)?.delete(fn);
      },
      dispatchEvent: (event: Event) => {
        for (const fn of listeners.get(event.type) ?? []) fn(event);
        return true;
      },
      ...overrides,
    });
  }

  function render() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<AuthWidget />);
    });
  }

  it("hides itself when /api/auth/me returns a loopback identity", async () => {
    setupWindow({ __HERMES_SESSION_TOKEN__: "loopback-token" });
    const identity = {
      display_name: "Local",
      email: "",
      expires_at: 0,
      org_id: "",
      provider: "loopback",
      user_id: "local",
    };
    const fetchMock = jsonFetchMock(identity);
    vi.stubGlobal("fetch", fetchMock);

    render();

    // Wait for the async getAuthMe request to resolve and state to flush.
    await flush();

    // The widget should be hidden: no DOM, no logout button.
    expect(container.innerHTML).toBe("");
    expect(container.querySelector('[aria-label="Log out"]')).toBeNull();
    expect(container.textContent).not.toContain("via");

    // Prove the request went through the real getAuthMe → fetchJSON path.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/me");
    expect((init!.headers as Headers).get("X-Hermes-Session-Token")).toBe(
      "loopback-token",
    );
  });

  it("renders user info when /api/auth/me returns a non-loopback identity", async () => {
    setupWindow({ __HERMES_SESSION_TOKEN__: "portal-token" });
    const identity = {
      display_name: "Ada",
      email: "ada@example.com",
      expires_at: 9999999999,
      org_id: "org-1",
      provider: "portal",
      user_id: "user-ada-123",
    };
    const fetchMock = jsonFetchMock(identity);
    vi.stubGlobal("fetch", fetchMock);

    render();
    await flush();

    // The widget should be visible with the provider and logout button.
    expect(container.innerHTML).not.toBe("");
    expect(container.textContent).toContain("Ada");
    expect(container.textContent).toContain("via portal");
    expect(container.querySelector('[aria-label="Log out"]')).not.toBeNull();
  });

  it("hides on 401 (missing/invalid token in loopback mode)", async () => {
    setupWindow({ __HERMES_SESSION_TOKEN__: "bad-token" });
    // fetchJSON throws "401: Unauthorized" for non-OK without envelope.
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response("Unauthorized", {
          status: 401,
          statusText: "Unauthorized",
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render();
    await flush();

    // Widget should hide on 401.
    expect(container.innerHTML).toBe("");
    expect(container.querySelector('[aria-label="Log out"]')).toBeNull();
  });

  // 设计车道 ①（P0-①）：横幅在场时，侧栏不再重复播报不确定态。
  it("stays silent in the error state while the session banner shows", async () => {
    markSessionExpired();
    setupWindow({ __HERMES_SESSION_TOKEN__: "tok" });
    // 500 → ApiError(status 500) → error 分支（非 401/403 的隐藏路径）。
    vi.stubGlobal("fetch", jsonFetchMock({}, 500));

    render();
    await flush();
    expect(container.innerHTML).toBe("");

    // 横幅退场（结案），error 行恢复——静默只在横幅在场时生效。
    act(() => clearSessionExpired());
    await flush();
    expect(container.textContent).toContain("暂时确认不到登录状态");
  });

  // UI-QA P1 保底：既无横幅、也无登录证据时，错误行行为不回归。
  it("shows the error line when neither the banner nor verified evidence is present", async () => {
    setupWindow({ __HERMES_SESSION_TOKEN__: "tok" });
    vi.stubGlobal("fetch", jsonFetchMock({}, 500));

    render();
    await flush();
    expect(container.textContent).toContain("暂时确认不到登录状态");
  });

  // UI-QA P1：Auth5Session whoami 2xx 广播 auth5:verified 后，这句话必须收回。
  it("retracts the error line when auth5:verified arrives", async () => {
    setupWindow({ __HERMES_SESSION_TOKEN__: "tok" });
    vi.stubGlobal("fetch", jsonFetchMock({}, 500));

    render();
    await flush();
    expect(container.textContent).toContain("暂时确认不到登录状态");

    // 监听常驻：事件到达即重渲染隐藏（本件可能先于 whoami 完成挂载）。
    act(() => {
      window.dispatchEvent(new CustomEvent("auth5:verified"));
    });
    expect(container.innerHTML).toBe("");
  });
});
