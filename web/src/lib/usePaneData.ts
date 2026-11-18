/**
 * T02 数据层地基（D 车道）：统一的面板数据 hook。
 *
 * 约定（对账表 docs/_artifacts/D/T02-ENDPOINT-RECONCILIATION.md）：
 * - 请求号透传：读取 BFF 响应头 X-Console-Request-Id，错误态必须能拿到并上屏。
 * - 失败重试一次：仅网络错误与 5xx 自动重试一次；4xx 不重试（重试不会变好，
 *   且写语义路由可能重复副作用——本 hook 只用于 GET 读面板）。
 * - 四态：loading / empty / error / ready。empty 判定 = JSON 含 items 数组且为空，
 *   或 data 为 null。降级显示（未接入/GAP）由页面按对账表决定，不在本层。
 * - ?state= 强制复现（T03 出口 22×4）：URL query 带 state=loading|empty|error|ready
 *   时短路真实请求，返回该状态骨架数据，供 QA 与截图腿逐态验收。
 *
 * 不做：缓存层、轮询、abort 竞态之外的任何智能。页面接入只需声明 URL。
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type PaneState = "loading" | "empty" | "error" | "ready";

export interface PaneError {
  /** 人话文案，禁止工程语言上屏；由页面负责展示 */
  message: string;
  /** BFF X-Console-Request-Id；上游不可达等场景可能为 null */
  requestId: string | null;
  status: number | null;
}

export interface PaneResult<T> {
  state: PaneState;
  data: T | null;
  error: PaneError | null;
  /** 手动重试（与自动重试共用同一次语义：retry() 后再失败不会再自动重试） */
  retry: () => void;
}

export interface PaneQuery {
  /** 端点 URL，参数用 buildUrl/URLSearchParams 预先拼好 */
  url: string;
  /** 可选：把空 items 判成 empty 的字段名，默认 "items" */
  itemsKey?: string;
  /** 可选：关闭 ?state= 强制复现（单测/服务端渲染用） */
  ignoreForceState?: boolean;
}

const FORCED_STATES: readonly PaneState[] = ["loading", "empty", "error", "ready"];

function forcedState(): PaneState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = new URLSearchParams(window.location.search).get("state");
    if (raw && (FORCED_STATES as readonly string[]).includes(raw)) {
      return raw as PaneState;
    }
  } catch {
    /* URL 解析失败视作无强制 */
  }
  return null;
}

export interface FetchPaneOutcome<T> {
  ok: boolean;
  state: PaneState;
  data: T | null;
  error: PaneError | null;
  /** 是否值得自动重试一次：网络错误或 5xx */
  retryable: boolean;
}

/** 纯函数获取层：与 React 解耦，可被 node 直测。 */
export async function fetchPane<T = unknown>(
  url: string,
  itemsKey = "items",
  fetchImpl: typeof fetch = fetch,
): Promise<FetchPaneOutcome<T>> {
  let res: Response;
  try {
    res = await fetchImpl(url, { credentials: "same-origin", headers: { Accept: "application/json" } });
  } catch {
    return {
      ok: false,
      state: "error",
      data: null,
      retryable: true,
      error: { message: "网络不可用，请稍后重试", requestId: null, status: null },
    };
  }
  const requestId = res.headers.get("X-Console-Request-Id");
  if (!res.ok) {
    const message =
      res.status === 401
        ? "登录态已失效，请重新登录"
        : res.status === 403
          ? "没有权限查看这项数据"
          : res.status === 404
            ? "这个数据源还不存在（未接入）"
            : res.status >= 500
              ? "服务暂时不可用，请稍后重试"
              : `数据加载失败（${res.status}）`;
    return {
      ok: false,
      state: "error",
      data: null,
      retryable: res.status >= 500,
      error: { message, requestId, status: res.status },
    };
  }
  let payload: T;
  try {
    payload = (await res.json()) as T;
  } catch {
    return {
      ok: false,
      state: "error",
      data: null,
      retryable: false,
      error: { message: "返回内容不是有效的数据格式", requestId, status: res.status },
    };
  }
  const rec = payload as Record<string, unknown> | null;
  const items = rec && typeof rec === "object" ? rec[itemsKey] : undefined;
  const isEmpty =
    (Array.isArray(items) && items.length === 0) || payload === null || payload === undefined;
  return {
    ok: true,
    state: isEmpty ? "empty" : "ready",
    data: payload,
    retryable: false,
    error: null,
  };
}

export function usePaneData<T = unknown>(query: PaneQuery): PaneResult<T> {
  const { url, itemsKey = "items", ignoreForceState = false } = query;
  const force = ignoreForceState ? null : forcedState();

  const [state, setState] = useState<PaneState>(force ?? "loading");
  const [data, setData] = useState<T | null>(
    force === "ready" ? ({ [itemsKey]: [{ id: "fixture-ready" }] } as unknown as T) : null,
  );
  const [error, setError] = useState<PaneError | null>(
    force === "error" ? { message: "（强制复现）服务暂时不可用，请稍后重试", requestId: "forced", status: 503 } : null,
  );
  const [nonce, setNonce] = useState(0);
  const seqRef = useRef(0);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (force) {
      // 强制态下不发真请求；nonce 变化也不解除强制（QA 复现语义优先）
      setState(force);
      return;
    }
    const seq = ++seqRef.current;
    let cancelled = false;
    setState("loading");
    setError(null);
    (async () => {
      let outcome = await fetchPane<T>(url, itemsKey);
      if (!outcome.ok && outcome.retryable) {
        outcome = await fetchPane<T>(url, itemsKey); // 失败自动重试，恰好一次
      }
      if (cancelled || seq !== seqRef.current) return;
      setState(outcome.state);
      setData(outcome.data);
      setError(outcome.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [url, itemsKey, nonce, force]);

  return { state, data, error, retry };
}
