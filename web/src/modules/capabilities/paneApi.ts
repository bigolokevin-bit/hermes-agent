// 能力与接入（/capabilities）四页共用的读口层。
//
// 一条读口只有四种结局，页面照实呈现，不互相顶替：
//   ready    —— 200 且解析出了本次要用的形状
//   empty    —— 200，但这一份清单本来就是空的（真零）
//   missing  —— 404 / 501 / 503 / 502 / 未接线信封：这一项没有读口
//   error    —— 401、解析失败、请求被拒等，需要重试或重新登录
//
// missing 与 error 都渲染成「—」+ 卡底一行缺读口说明；工程语言（路由、状态码、
// 上游代号）只进 title，不进句子层。任何情况下都不补 0、不补百分比、不摆示例行。
import { useCallback, useEffect, useState } from "react";

export const DASH = "—";

export type Read<T> =
  | { k: "loading" }
  | { k: "empty"; asOf: string | null }
  | { k: "ready"; data: T; asOf: string | null }
  | { k: "missing"; note: string; title: string | null; asOf: string | null }
  | { k: "error"; note: string; requestId: string | null };

type Envelope = {
  ok: boolean;
  status: number;
  body: unknown;
  text: string;
  code: string | null;
  asOf: string | null;
  requestId: string | null;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickCode(body: unknown): string | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  return str(record.code);
}

function pickAsOf(body: unknown): string | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  return str((body as Record<string, unknown>).asOf);
}

async function request(url: string): Promise<Envelope> {
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: "include",
      mode: "same-origin",
      headers: { accept: "application/json" },
    });
  } catch {
    return { ok: false, status: 0, body: null, text: "", code: null, asOf: null, requestId: null };
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text.trim() ? (JSON.parse(text) as unknown) : null;
  } catch {
    body = null;
  }
  const requestId =
    response.headers.get("x-console-request-id") ?? response.headers.get("x-request-id") ?? null;
  return {
    ok: response.ok,
    status: response.status,
    body,
    text,
    code: pickCode(body),
    asOf: pickAsOf(body),
    requestId,
  };
}

/** 人话缺读口：说「这一项现在没有读口」，不把状态码或路由放到屏上。 */
function missingNote(env: Envelope): string {
  if (env.status === 0) return "缺读口：这项数据此刻读不到（服务没有回应）";
  if (env.status === 502 || /upstream_unavailable/.test(env.code ?? "")) {
    return "缺读口：上游服务此刻不可达，本次未取到数";
  }
  if (env.status === 503 || env.status === 501) return "缺读口：上游还没有提供这一项";
  return "缺读口：上游端点未接线";
}

function missingTitle(env: Envelope): string | null {
  const parts = [`HTTP ${env.status}`, env.code, env.requestId ? `rid ${env.requestId}` : null].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length ? parts.join(" · ") : null;
}

/** 读一次并解析；`parse` 返回 null 表示形状不可用（按 error 处理，不猜）。 */
export async function readPort<T>(url: string, parse: (body: unknown) => T | null): Promise<Read<T>> {
  const env = await request(url);
  if (env.status === 401) {
    return { k: "error", note: "登录状态已失效，重新登录后再看这项数据", requestId: env.requestId };
  }
  if (!env.ok) return { k: "missing", note: missingNote(env), title: missingTitle(env), asOf: env.asOf };
  const data = parse(env.body);
  if (data === null) {
    return { k: "error", note: "这项数据返回的内容读不出来，稍后重试", requestId: env.requestId };
  }
  return { k: "ready", data, asOf: env.asOf };
}

export function usePort<T>(
  url: string,
  parse: (body: unknown) => T | null,
  isEmpty: (data: T) => boolean,
): { read: Read<T>; reload: () => void } {
  const [read, setRead] = useState<Read<T>>({ k: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    void readPort(url, parse).then((next) => {
      if (!alive) return;
      setRead(next.k === "ready" && isEmpty(next.data) ? { k: "empty", asOf: next.asOf } : next);
    });
    return () => {
      alive = false;
    };
    // isEmpty/parse 是纯函数常量，不进依赖，避免每次渲染重读。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { read, reload };
}

/* ------------------------------------------------------------------ *
 * 读数格式化：缺数就是「—」，不补零
 * ------------------------------------------------------------------ */

export function count(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US") : DASH;
}

export function usd(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `$${value.toFixed(2)}` : DASH;
}

/** 北京时间到分钟；没有时刻就「—」，不拿页面时钟顶替。 */
export function beijingMinute(value: string | null | undefined): string {
  if (!value) return DASH;
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return DASH;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(at));
}

/** 页头右端的等宽读数：读取时刻；没有回传时刻就「—」。 */
export function asOfLabel(read: Read<unknown>): string {
  if (read.k === "ready" || read.k === "empty") return `截至 ${beijingMinute(read.asOf)}`;
  if (read.k === "missing" || read.k === "error") return "截至 —";
  return "读取中";
}

/* ------------------------------------------------------------------ *
 * 清单形状
 * ------------------------------------------------------------------ */

export function listOf(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body;
  if (body !== null && typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["items", "rows", "servers", "tools", "data"]) {
      const value = record[key];
      if (Array.isArray(value)) return value;
    }
  }
  return null;
}

export function recordOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function textOf(value: unknown): string | null {
  return str(value);
}

/** 表体唯一一行「为什么没有行」：读到了空写「真零」，读不到写缺读口。 */
export function gapText(read: Read<unknown>, loading: string, zero: string): string {
  if (read.k === "loading") return loading;
  if (read.k === "empty" || read.k === "ready") return zero;
  return read.note;
}