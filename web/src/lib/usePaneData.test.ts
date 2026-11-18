/**
 * T02 单测（vitest，fork web/package.json 已有 vitest@4.1.12，"test": "vitest run"）。
 * 只测纯函数层 fetchPane（React hook 部分由类型与页面冒烟覆盖）：
 * 四态判定、请求号透传、5xx retryable、4xx 不 retryable、网络错误 retryable。
 */
import { describe, expect, it } from "vitest";

import { fetchPane } from "./usePaneData";

function jsonResponse(
  body: unknown,
  init: { status?: number; requestId?: string } = {},
): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (init.requestId) headers.set("X-Console-Request-Id", init.requestId);
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

describe("fetchPane", () => {
  it("ready：非空 items 透传数据与请求号", async () => {
    const fetchImpl = (async () =>
      jsonResponse({ items: [{ id: "e1" }] }, { requestId: "req-abc" })) as typeof fetch;
    const out = await fetchPane<{ items: unknown[] }>("/api/employees", "items", fetchImpl);
    expect(out.state).toBe("ready");
    expect(out.ok).toBe(true);
    expect(out.data?.items).toHaveLength(1);
  });

  it("empty：items 为空数组判 empty 不算 error", async () => {
    const fetchImpl = (async () =>
      jsonResponse({ items: [] }, { requestId: "req-e" })) as typeof fetch;
    const out = await fetchPane("/api/runs", "items", fetchImpl);
    expect(out.state).toBe("empty");
    expect(out.ok).toBe(true);
    expect(out.error).toBeNull();
  });

  it("empty：无 items 字段的对象体判 ready（页面对象响应）", async () => {
    const fetchImpl = (async () =>
      jsonResponse({ summary: "ok" }, { requestId: "req-o" })) as typeof fetch;
    const out = await fetchPane("/api/hermes-summary", "items", fetchImpl);
    expect(out.state).toBe("ready");
  });

  it("error：401 人话文案且不可重试", async () => {
    const fetchImpl = (async () =>
      jsonResponse({ code: "console.unauthenticated" }, { status: 401, requestId: "req-401" })) as typeof
        fetch;
    const out = await fetchPane("/api/matrix", "items", fetchImpl);
    expect(out.state).toBe("error");
    expect(out.retryable).toBe(false);
    expect(out.error?.message).toContain("登录");
    expect(out.error?.requestId).toBe("req-401");
    expect(out.error?.status).toBe(401);
  });

  it("error：503 可重试一次并带 BFF 请求号", async () => {
    const fetchImpl = (async () =>
      jsonResponse({ code: "upstream.unavailable" }, { status: 502, requestId: "req-502" })) as typeof fetch;
    const out = await fetchPane("/api/tasks", "items", fetchImpl);
    expect(out.state).toBe("error");
    expect(out.retryable).toBe(true);
    expect(out.error?.requestId).toBe("req-502");
  });

  it("error：网络抛错判可重试，requestId 为 null 不崩", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const out = await fetchPane("/api/delegations", "items", fetchImpl);
    expect(out.state).toBe("error");
    expect(out.retryable).toBe(true);
    expect(out.error?.requestId).toBeNull();
    expect(out.error?.message).toContain("网络");
  });

  it("error：非 JSON 体（SPA 假 200）判格式错误不重试", async () => {
    const fetchImpl = (async () =>
      new Response("<!doctype html><html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      })) as typeof fetch;
    const out = await fetchPane("/api/grants", "items", fetchImpl);
    expect(out.state).toBe("error");
    expect(out.retryable).toBe(false);
    expect(out.error?.message).toContain("格式");
  });
});
