// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./LoginPage";

declare global {
  interface Window {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
}

const CAPTCHA_A = { captcha_key: "ck-a", captcha: "QUJD" };
const CAPTCHA_B = { captcha_key: "ck-b", captcha: "REVG" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const flush = async () => {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  sessionStorage.clear();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async () => undefined) },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function mountAt(entry: string, fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
  const spy = vi.fn(fetchImpl);
  vi.stubGlobal("fetch", spy);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/overview" element={<div>登录成功页</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
  return spy;
}

const mount = (fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) =>
  mountAt("/login", fetchImpl);

function setValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

async function fillForm() {
  const user = container.querySelector("[data-testid='auth5-user']") as HTMLInputElement;
  const pass = container.querySelector("[data-testid='auth5-password']") as HTMLInputElement;
  const captcha = container.querySelector("[data-testid='auth5-captcha-input']") as HTMLInputElement;
  await act(async () => {
    setValue(user, "alice");
    setValue(pass, "hunter2");
    setValue(captcha, "AB");
  });
}

async function submitForm() {
  const form = container.querySelector("[data-testid='auth5-form']") as HTMLFormElement;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("LoginPage (auth5 / R18)", () => {
  it("renders the captcha image as an inline png and refreshes on click", async () => {
    let captchaCount = 0;
    const spy = mount(async (url) => {
      if (url === "/auth/captcha") {
        captchaCount += 1;
        return jsonResponse(200, captchaCount === 1 ? CAPTCHA_A : CAPTCHA_B);
      }
      throw new Error(`unexpected call ${url}`);
    });
    await flush();
    const btn = container.querySelector("[data-testid='auth5-captcha-image']") as HTMLButtonElement;
    expect(btn, "captcha control missing").toBeTruthy();
    const img = btn.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")!.startsWith("data:image/png;base64,")).toBe(true);
    const before = img.getAttribute("src");
    await act(async () => {
      btn.click();
    });
    await flush();
    const after = (container.querySelector("[data-testid='auth5-captcha-image'] img") as HTMLImageElement).getAttribute("src");
    expect(after).not.toBe(before);
    expect(captchaCount).toBe(2);
    expect(spy).toBeTruthy();
  });

  it("posts credentials, confirms whoami, marks the session and lands on overview; double clicks send once", async () => {
    let loginCalls = 0;
    let resolveLogin: ((r: Response) => void) | null = null;
    const spy = mount(async (url, init) => {
      if (url === "/auth/captcha") return jsonResponse(200, CAPTCHA_A);
      if (url === "/auth/login" && init?.method === "POST") {
        loginCalls += 1;
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(body).toMatchObject({ user_name: "alice", password: "hunter2", captcha_key: "ck-a", captcha: "AB" });
        return await new Promise<Response>((resolve) => {
          resolveLogin = resolve;
        });
      }
      if (url === "/auth/whoami") return jsonResponse(200, { display: "爱丽丝" });
      throw new Error(`unexpected call ${url}`);
    });
    await flush();
    await fillForm();
    const submit = container.querySelector("[data-testid='auth5-submit']") as HTMLButtonElement;
    await act(async () => {
      submit.click();
      submit.click();
    });
    // still pending: busy and locked
    expect(spy.mock.calls.filter((c) => c[0] === "/auth/login")).toHaveLength(1);
    expect(container.querySelector("[data-testid='auth5-form']")?.getAttribute("aria-busy")).toBe("true");
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toContain("登录中");
    await act(async () => {
      resolveLogin?.(jsonResponse(200, { ok: true }));
      await Promise.resolve();
    });
    await flush();
    expect(loginCalls).toBe(1);
    expect(container.textContent).toContain("登录成功页");
    expect(sessionStorage.getItem("auth5.session")).toBe("1");
  });

  it("refuses to fake success when whoami stays 401", async () => {
    mount(async (url) => {
      if (url === "/auth/captcha") return jsonResponse(200, CAPTCHA_A);
      if (url === "/auth/login") return jsonResponse(200, { ok: true });
      if (url === "/auth/whoami") return jsonResponse(401, { error: "unauthenticated", request_id: "who-401" });
      throw new Error(`unexpected call ${url}`);
    });
    await flush();
    await fillForm();
    await submitForm();
    await flush();
    const error = container.querySelector("[data-testid='auth5-error']");
    expect(error?.textContent).toContain("登录成功但会话未建立，请重试。");
    expect(container.textContent).not.toContain("登录成功页");
    expect(sessionStorage.getItem("auth5.session")).toBeNull();
  });

  it("says 用户名或密码错误 for invalid credentials and offers a copyable request id", async () => {
    mount(async (url) => {
      if (url === "/auth/captcha") return jsonResponse(200, CAPTCHA_A);
      if (url === "/auth/login") return jsonResponse(401, { code: "auth.invalid_credentials", request_id: "req-9" });
      throw new Error(`unexpected call ${url}`);
    });
    await flush();
    await fillForm();
    await submitForm();
    await flush();
    const error = container.querySelector("[data-testid='auth5-error']");
    expect(error?.textContent).toContain("用户名或密码错误。");
    expect(error?.textContent).toContain("req-9");
    expect(container.querySelector("[data-testid='req-copy']")).toBeTruthy();
    expect(container.querySelector("[data-testid='auth5-captcha-image']")).toBeTruthy();
  });

  it("reloads the captcha after a wrong captcha answer", async () => {
    let captchaCalls = 0;
    mount(async (url) => {
      if (url === "/auth/captcha") {
        captchaCalls += 1;
        return jsonResponse(200, captchaCalls === 1 ? CAPTCHA_A : CAPTCHA_B);
      }
      if (url === "/auth/login") return jsonResponse(401, { code: "auth.captcha_invalid" });
      throw new Error(`unexpected call ${url}`);
    });
    await flush();
    expect(captchaCalls).toBe(1);
    await fillForm();
    await submitForm();
    await flush();
    const error = container.querySelector("[data-testid='auth5-error']");
    expect(error?.textContent).toContain("验证码不正确，点图刷新重试。");
    expect(error?.textContent).toContain("本次请求未记录编号，可复制时间与操作路径反馈");
    expect(captchaCalls).toBe(2);
    await act(async () => {
      await Promise.resolve();
    });
    const img = container.querySelector("[data-testid='auth5-captcha-image'] img") as HTMLImageElement;
    expect(img.src).toContain(CAPTCHA_B.captcha);
  });

  it("never fails silently when the captcha has not loaded", async () => {
    mount(async (url) => {
      if (url === "/auth/captcha") throw new Error("bridge down");
      throw new Error(`unexpected call ${url}`);
    });
    await flush();
    // captcha failed to load; pressing submit must speak
    const submit = container.querySelector("[data-testid='auth5-submit']") as HTMLButtonElement;
    await act(async () => {
      submit.click();
    });
    await flush();
    expect(container.querySelector("[data-testid='auth5-error']")).toBeTruthy();
    expect(container.textContent).toContain("验证码还没加载出来");
  });

  it("renders the four honest states from ?state= with the fixture badge", async () => {
    for (const state of ["error", "denied", "empty", "loading"] as const) {
      const entry = `/login?state=${state}`;
      mountAt(entry, async (url) => {
        if (url === "/auth/captcha") return jsonResponse(200, CAPTCHA_A);
        throw new Error(`unexpected call ${url}`);
      });
      await flush();
      const box = container.querySelector("[data-testid='auth5-forced-state']");
      expect(box, `forced ${state}`).toBeTruthy();
      expect(container.querySelector('[data-testid="auth5-page"]')?.getAttribute("data-fixture")).toBe("1");
      const title = container.querySelector("[data-testid='auth5-forced-title']")?.textContent ?? "";
      if (state === "error") expect(title).toContain("登录没能进行。");
      if (state === "denied") expect(title).toContain("无权限或未开放");
      if (state === "empty") expect(title).toContain("登录服务暂时没有可用通道。");
      if (state === "loading") expect(title).toContain("正在准备登录…");
      act(() => root.unmount());
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
    }
  });

  it("only ever calls the same-origin auth bridge", async () => {
    const spy = mount(async (url) => {
      if (url === "/auth/captcha") return jsonResponse(200, CAPTCHA_A);
      throw new Error(`unexpected call ${url}`);
    });
    await flush();
    const allowed = new Set(["/auth/captcha", "/auth/login", "/auth/logout", "/auth/whoami"]);
    for (const call of spy.mock.calls) {
      expect(allowed.has(String(call[0]))).toBe(true);
    }
  });
});
