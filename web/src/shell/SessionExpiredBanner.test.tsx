// @vitest-environment jsdom
// 设计车道 ①：全站唯一的「会话已过期」横幅。
// 覆盖 store 口径（同一次失活只置位一次、结案后算新一轮）与组件口径（只出现一条、
// role=alert + aria-live、首次出现可聚焦、关闭只隐藏且不影响下一次失活）。
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearSessionExpired,
  isSessionExpired,
  markSessionExpired,
  subscribeSessionExpired,
} from "@/lib/session-expiry";
import { SessionExpiredBanner } from "@/shell/SessionExpiredBanner";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function mount() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<SessionExpiredBanner />));
}

const banner = () =>
  container.querySelector<HTMLElement>('[data-testid="session-expired-banner"]');

beforeEach(async () => {
  await act(async () => clearSessionExpired());
  await mount();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  await act(async () => clearSessionExpired());
});

describe("session-expiry store", () => {
  it("置位一次只通知一次：重复 401 不再刷屏", () => {
    const seen = vi.fn();
    const unsubscribe = subscribeSessionExpired(seen);
    markSessionExpired();
    markSessionExpired();
    markSessionExpired();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(isSessionExpired()).toBe(true);
    unsubscribe();
    // 退订后的重复置位同样不再制造通知。
    markSessionExpired();
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("未过期时 clear 是幂等的，不通知", () => {
    const seen = vi.fn();
    const unsubscribe = subscribeSessionExpired(seen);
    clearSessionExpired();
    clearSessionExpired();
    expect(seen).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe("SessionExpiredBanner", () => {
  it("没有失活时不渲染任何东西", () => {
    expect(banner()).toBeNull();
  });

  it("失活后出现一条横幅：role=alert + aria-live=assertive + 重新登录出口", async () => {
    await act(async () => markSessionExpired());
    const box = banner();
    expect(box).not.toBeNull();
    expect(document.querySelectorAll('[data-testid="session-expired-banner"]')).toHaveLength(1);
    expect(box?.getAttribute("role")).toBe("alert");
    expect(box?.getAttribute("aria-live")).toBe("assertive");
    expect(box?.textContent).toContain("会话已过期，请重新登录后继续。");
    expect(container.querySelector('[data-testid="session-expired-relogin"]')).not.toBeNull();
    expect(box?.textContent).not.toContain("登录状态已失效");
  });

  it("首次出现自动聚焦，之后重复置位不再抢焦点", async () => {
    await act(async () => markSessionExpired());
    expect(document.activeElement).toBe(banner());
    // 焦点被用户拿走后，同一次失活里的后续 401 不再把焦点抢回去。
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="session-expired-relogin"]')?.focus();
    });
    expect(document.activeElement).not.toBe(banner());
    await act(async () => markSessionExpired());
    expect(document.activeElement).not.toBe(banner());
  });

  it("重新登录走整页跳转", async () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      value: { ...original, assign },
      configurable: true,
      writable: true,
    });
    try {
      await act(async () => markSessionExpired());
      await act(async () => {
        container
          .querySelector<HTMLButtonElement>('[data-testid="session-expired-relogin"]')
          ?.click();
      });
      expect(assign).toHaveBeenCalledWith("/login");
    } finally {
      Object.defineProperty(window, "location", {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });

  it("关闭只隐藏提示：同一次失活不再出现，下一轮失活重新出现", async () => {
    await act(async () => markSessionExpired());
    expect(banner()).not.toBeNull();
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="session-expired-dismiss"]')
        ?.click();
    });
    expect(banner()).toBeNull();
    // 同一次失活里的轮询 401：保持安静，否则「关闭」按不动。
    await act(async () => markSessionExpired());
    expect(banner()).toBeNull();
    // 会话被证明可用（业务请求 2xx）→ 这一轮结案。
    await act(async () => clearSessionExpired());
    expect(banner()).toBeNull();
    // 真正的下一次失活：横幅重新出现，并且重新聚焦。
    await act(async () => markSessionExpired());
    expect(banner()).not.toBeNull();
    expect(document.activeElement).toBe(banner());
  });

  it("关闭按钮有无障碍名称", async () => {
    await act(async () => markSessionExpired());
    const dismiss = container.querySelector<HTMLButtonElement>(
      '[data-testid="session-expired-dismiss"]',
    );
    expect(dismiss?.getAttribute("aria-label")).toBe("关闭提示");
  });
});
