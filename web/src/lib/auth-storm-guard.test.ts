// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJSON } from "@/lib/api";
import {
  __resetAuthStormGuardForTests,
  attemptLoginRedirectOnce,
  authBackoffRemaining,
  clearLoginRedirectAttempt,
  dedupeInflight,
  registerAuthFailure,
} from "@/lib/auth-storm-guard";

describe("auth-storm-guard (L0 点单 401 无限跳登录环)", () => {
  beforeEach(() => {
    __resetAuthStormGuardForTests();
  });
  afterEach(() => {
    __resetAuthStormGuardForTests();
    vi.useRealTimers();
  });

  it("闸门①：跳转闩一世代只放行第一次，2xx 证明后复位", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    expect(attemptLoginRedirectOnce(storage)).toBe(true);
    expect(attemptLoginRedirectOnce(storage)).toBe(false);
    clearLoginRedirectAttempt(storage);
    expect(attemptLoginRedirectOnce(storage)).toBe(true);
  });

  it("闸门②：连续第二次 401 起冷却指数增长，30s 封顶，时间前进后放行；首击后的重试永远放行", () => {
    const t0 = 1_000_000;
    registerAuthFailure("/api/sessions", t0);
    // 首击不吃闸：页面「再证明一次」必须能碰网络。
    expect(authBackoffRemaining("/api/sessions", t0 + 500)).toBe(0);
    registerAuthFailure("/api/sessions", t0 + 1000);
    // 第二连击：delay=2s，until=(t0+1000)+2000 → t0+1500 时剩 1500。
    expect(authBackoffRemaining("/api/sessions", t0 + 1500)).toBe(1500);
    let big = t0;
    for (let i = 0; i < 8; i += 1) {
      registerAuthFailure("/api/sessions", big);
      big += 30_000;
    }
    expect(authBackoffRemaining("/api/sessions", big)).toBeLessThanOrEqual(30_000);
    expect(authBackoffRemaining("/api/other", t0)).toBe(0);
  });

  it("闸门③：并发同 key 共享一次网络调用，settle 后可再来一轮", async () => {
    const run = vi.fn(async () => "value");
    const [a, b] = await Promise.all([dedupeInflight("k", run), dedupeInflight("k", run)]);
    expect(a).toBe("value");
    expect(b).toBe("value");
    expect(run).toHaveBeenCalledTimes(1);
    await dedupeInflight("k", run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("闸门③：被去重的一方同样拿到 rejection", async () => {
    const boom = new Error("boom");
    const run = vi.fn(async () => {
      throw boom;
    });
    const results = await Promise.allSettled([dedupeInflight("k2", run), dedupeInflight("k2", run)]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
  });
});

// —— 环复现钉测：fetch 桩给出 gated 中间件的 unauthenticated+login_url 信封，
// 旧代码每一次 401 都 window.location.assign → 整页导航 → 重新加载再 401，
// 即实测的 framenavigated×2488 风暴。现在必须：assign ≤1、网络调用被冷却压住。
describe("fetchJSON 401 跳登录环（红→绿钉测，L0 点单）", () => {
  const SESSIONS_URL = "/agent-api/api/sessions?limit=20";
  let assign: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    __resetAuthStormGuardForTests();
    window.sessionStorage.removeItem("hermes.tokenReloadAttempted");
    // 点单现场是 gated 部署（cookie 会话、无注入 token）：如实置位，
    // 401 才走 login_url 分支而不是 loopback 重载分支。
    (window as { __HERMES_AUTH_REQUIRED__?: boolean }).__HERMES_AUTH_REQUIRED__ = true;
    assign = vi.fn();
    reload = vi.fn();
    originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { pathname: "/sessions", search: "", hash: "", href: "http://localhost/sessions", origin: "http://localhost", assign, reload },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    __resetAuthStormGuardForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function stubUnauthorizedEnvelope(fetchSpy = true) {
    const fn = vi.fn(async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      clone: () => ({ json: async () => ({ error: "unauthenticated", login_url: "/login?next=/sessions" }) }),
      text: async () => JSON.stringify({ error: "unauthenticated", request_id: "req-401-storm" }),
      headers: new Headers({ "x-request-id": "req-401-storm" }),
    }));
    vi.stubGlobal("fetch", fn);
    return fetchSpy ? fn : null;
  }

  it("第一次 401 跳一次登录；此后同一环内不再 assign、不再碰网络", async () => {
    vi.useFakeTimers();
    const fetchFn = stubUnauthorizedEnvelope();
    const first = fetchJSON(SESSIONS_URL);
    // 先把断言处理者挂上再拨表：宽限 reject 落在 advance 内部，
    // 事后 attach 会被 vitest 判成 Unhandled Rejection。
    const firstRejects = expect(first).rejects.toMatchObject({ status: 401 });
    await vi.advanceTimersByTimeAsync(6100);
    await firstRejects;
    expect(assign).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    // 环的第二圈：跳转闩已落 → 绝不再 assign。第一击后的那次重试放行到网络
    // （正当的再证明），它仍 401 → 连击数到二，第三次起被冷却闸压住零网络。
    await expect(fetchJSON(SESSIONS_URL)).rejects.toMatchObject({ status: 401 });
    await expect(fetchJSON(SESSIONS_URL)).rejects.toMatchObject({ status: 401 });
    expect(assign).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2); // 风暴被压成两次的证明机会，之后全闸
  });

  it("连续两击后冷却生效，窗过放行；但整页跳转依旧一世代最多一次", async () => {
    vi.useFakeTimers();
    const fetchFn = stubUnauthorizedEnvelope();
    const first = fetchJSON(SESSIONS_URL);
    const firstRejects = expect(first).rejects.toMatchObject({ status: 401 });
    await vi.advanceTimersByTimeAsync(6100);
    await firstRejects;
    expect(assign).toHaveBeenCalledTimes(1);
    // 第二击：首击后的正当重试放行 → 网络，仍 401 → 从此进入冷却。
    const second = fetchJSON(SESSIONS_URL);
    await expect(second).rejects.toMatchObject({ status: 401 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    // 冷却窗内：第三击不碰网络。
    await vi.advanceTimersByTimeAsync(1500);
    await expect(fetchJSON(SESSIONS_URL)).rejects.toMatchObject({ status: 401 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    // 把时钟拨过 2s 冷却档：网络再来一次，但跳转闩依旧挡死 assign。
    await vi.advanceTimersByTimeAsync(1200);
    const fourth = fetchJSON(SESSIONS_URL);
    await expect(fourth).rejects.toMatchObject({ status: 401 });
    expect(fetchFn).toHaveBeenCalledTimes(3); // 冷却过期，网络再来一次
    expect(assign).toHaveBeenCalledTimes(1); // 跳转仍然只此一次
  });

  it("一次 2xx 证明会话活着：跳转闩与冷却同时复位，下一世代可再跳", async () => {
    vi.useFakeTimers();
    stubUnauthorizedEnvelope();
    const first = fetchJSON(SESSIONS_URL);
    const firstRejects = expect(first).rejects.toMatchObject({ status: 401 });
    await vi.advanceTimersByTimeAsync(6100);
    await firstRejects;
    expect(assign).toHaveBeenCalledTimes(1);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } })),
    );
    await expect(fetchJSON("/agent-api/api/employees")).resolves.toEqual({ ok: true });
    stubUnauthorizedEnvelope();
    const next = fetchJSON(SESSIONS_URL);
    const nextRejects = expect(next).rejects.toMatchObject({ status: 401 });
    await vi.advanceTimersByTimeAsync(6100);
    await nextRejects;
    expect(assign).toHaveBeenCalledTimes(2); // 新过期世代：再放行一次跳转
  });

  it("并发同 target 只发一次网络请求（去重闸生效于 fetchJSON 层）", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ rows: [] }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchFn);
    const [a, b] = await Promise.all([fetchJSON(SESSIONS_URL), fetchJSON(SESSIONS_URL)]);
    expect(a).toEqual({ rows: [] });
    expect(b).toEqual({ rows: [] });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
