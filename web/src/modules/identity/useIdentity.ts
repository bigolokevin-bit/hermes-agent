/**
 * 三屏共用的取数 hook：一次取成员台账 + 部门名册 + 本租户身份，三屏各自派生。
 *
 * 失败只有两种人话腿，互斥：
 *   - 无权限（403）：说「未开放或没有权限」，不出现「读不到 / 未接入」；
 *   - 读不到（网络、5xx）：说「此刻读不到」，不说「没有权限」。
 * 工程语言（路由、状态码、请求号）不进屏；请求号留在 title 里供排障。
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api-error";
import { isDenied, loadIdentity, type IdentityData } from "./model";

export type IdentityPhase = "loading" | "ready" | "error";

export interface IdentityState {
  phase: IdentityPhase;
  data: IdentityData | null;
  /** 错误态的一句人话。 */
  message: string | null;
  denied: boolean;
  /** 排障用：BFF 请求号（只进 title，不上屏）。 */
  requestId: string | null;
  reload: () => void;
}

export const IDENTITY_DENIED_MESSAGE =
  "该数据源尚未开放，或你没有查看权限。请确认后台已接入对应服务，或联系管理员开通权限。";
export const IDENTITY_ERROR_MESSAGE = "成员台账此刻读不到，这一屏先不显示任何行；稍后重试即可。";

export function useIdentity(): IdentityState {
  const [phase, setPhase] = useState<IdentityPhase>("loading");
  const [data, setData] = useState<IdentityData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setMessage(null);
    setDenied(false);
    setRequestId(null);

    loadIdentity()
      .then((next) => {
        if (cancelled || !alive.current) return;
        setData(next);
        setPhase("ready");
      })
      .catch((error: unknown) => {
        if (cancelled || !alive.current) return;
        const noAccess = isDenied(error);
        setDenied(noAccess);
        setMessage(noAccess ? IDENTITY_DENIED_MESSAGE : IDENTITY_ERROR_MESSAGE);
        setRequestId(error instanceof ApiError ? error.requestId ?? null : null);
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { phase, data, message, denied, requestId, reload };
}