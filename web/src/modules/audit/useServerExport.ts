/**
 * AU-02 — the state machine behind 「服务器导出」:
 *   idle → creating(POST A5) → polling(A6 轮询) → ready(下载锚)
 *                                    ↘ failed(人话+请求编号)
 *                                    ↘ slow(轮询预算用尽，可「再查一次」)
 *   任何在飞态可 cancel（只停本页跟踪；服务端作业生死本页不推断——AU-05 同词）。
 *
 * 竞态与成本纪律逐字沿用 useAuditVerify（AU-05 定版形制）：seq 票号作废迟到回答、
 * AbortController 断在飞、卸载即掐、轮询串行不叠发（上一问未答不发下一问）。
 * fetchJSON 走 @/lib/api —— 401/403 语义、rid 回显、请求编号纪律都是现成的。
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchJSON } from "@/lib/api";
import {
  SERVER_EXPORT_BASE,
  browserDownloadHref,
  exportBodyOf,
  exportFailCopyOf,
  newIdempotencyKey,
  type ExportFailureCopy,
  type ExportJob,
} from "./serverExport";
import type { ListFilters } from "./api";

export const EXPORT_POLL_INTERVAL_MS = 1_200;
/** 轮询预算：50 问 ×1.2s ≈ 一分钟。用尽=slow 态，不是失败也不是完成。 */
export const EXPORT_POLL_MAX = 50;

export type ServerExportPhase =
  | "idle"
  | "creating"
  | "polling"
  | "ready"
  | "failed"
  | "slow"
  | "canceled";

export interface ServerExportApi {
  phase: ServerExportPhase;
  job: ExportJob | null;
  failure: (ExportFailureCopy & { requestId: string | null; technical: string | null }) | null;
  /** A6 给了 completed 但 URL 形状不认识时为 null——此时屏上不下发假锚。 */
  downloadHref: string | null;
  start: (filters: ListFilters) => void;
  recheck: () => void;
  cancel: () => void;
}

function ridOf(err: unknown): string | null {
  if (err && typeof err === "object" && "requestId" in err) {
    const v = (err as { requestId?: string }).requestId;
    return typeof v === "string" && v ? v : null;
  }
  return null;
}

function normalizeJob(raw: unknown): ExportJob | null {
  if (!raw || typeof raw !== "object") return null;
  const j = raw as Record<string, unknown>;
  if (typeof j.exportId !== "string" || typeof j.status !== "string") return null;
  return {
    exportId: j.exportId,
    status: j.status,
    createdAt: typeof j.createdAt === "string" ? j.createdAt : "",
    downloadUrl: typeof j.downloadUrl === "string" ? j.downloadUrl : null,
    expiresAt: typeof j.expiresAt === "string" ? j.expiresAt : null,
    truncated: j.truncated === true,
  };
}

export function useServerExport(opts?: {
  intervalMs?: number;
  maxPolls?: number;
}): ServerExportApi {
  const intervalMs = opts?.intervalMs ?? EXPORT_POLL_INTERVAL_MS;
  const maxPolls = opts?.maxPolls ?? EXPORT_POLL_MAX;

  const [phase, setPhase] = useState<ServerExportPhase>("idle");
  const [job, setJob] = useState<ExportJob | null>(null);
  const [failure, setFailure] = useState<ServerExportApi["failure"]>(null);
  const [downloadHref, setDownloadHref] = useState<string | null>(null);

  const seq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idemRef = useRef<string | null>(null);
  const exportIdRef = useRef<string | null>(null);
  const pollsRef = useRef(0);

  const stopTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const settle = useCallback(
    (ticket: number, fn: () => void): void => {
      if (ticket !== seq.current) return;
      fn();
    },
    [],
  );

  // accept ↔ schedulePoll 互引：accept 经 ref 交给轮询回调，解声明环。
  const acceptRef = useRef<(ticket: number, next: ExportJob) => void>(() => {});

  const schedulePoll = useCallback(
    (ticket: number, exportId: string): void => {
      if (ticket !== seq.current) return;
      if (pollsRef.current >= maxPolls) {
        setPhase("slow");
        return;
      }
      stopTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (ticket !== seq.current) return;
        pollsRef.current += 1;
        void (async () => {
          try {
            const raw = await fetchJSON<unknown>(
              `${SERVER_EXPORT_BASE}?id=${encodeURIComponent(exportId)}`,
              { signal: abortRef.current?.signal },
            );
            const next = normalizeJob(raw);
            if (!next) {
              settle(ticket, () => {
                setFailure({
                  text: "导出进度回答的形状不认识，本页不猜。引用请求编号反馈；稍后可「再查一次」。",
                  guide: false,
                  requestId: null,
                  technical: "A6 shape unknown",
                });
                setPhase("failed");
                idemRef.current = null;
              });
              return;
            }
            settle(ticket, () => acceptRef.current(ticket, next));
          } catch (err) {
            if (abortRef.current?.signal.aborted) return;
            settle(ticket, () => {
              setFailure({ ...exportFailCopyOf(err), requestId: ridOf(err), technical: null });
              setPhase("failed");
              idemRef.current = null;
            });
          }
        })();
      }, intervalMs);
    },
    [intervalMs, maxPolls, settle, stopTimer],
  );

  const accept = useCallback(
    (ticket: number, next: ExportJob): void => {
      setJob(next);
      if (next.status === "completed") {
        setDownloadHref(browserDownloadHref(next.downloadUrl));
        setPhase("ready");
        idemRef.current = null; // 收口：下一次点单是新作业新键
        return;
      }
      if (next.status === "failed") {
        setDownloadHref(null);
        setFailure({
          text: "服务端把这单导出标为失败，且没有带回原因。引用请求编号或作业编号反馈；屏上的「导出当前筛选 CSV」不受影响。",
          guide: true,
          requestId: null,
          technical: `job ${next.exportId} failed`,
        });
        setPhase("failed");
        idemRef.current = null;
        return;
      }
      setPhase("polling");
      schedulePoll(ticket, next.exportId);
    },
    [schedulePoll],
  );
  acceptRef.current = accept;

  const start = useCallback(
    (filters: ListFilters): void => {
      const body = exportBodyOf(filters);
      if (!body) return; // 草稿窗没有可发的 from/to；按钮层已禁，这里再兜一层不造请求
      const ticket = ++seq.current;
      abortRef.current?.abort();
      stopTimer();
      const controller = new AbortController();
      abortRef.current = controller;
      pollsRef.current = 0;
      if (!idemRef.current) idemRef.current = newIdempotencyKey();
      setPhase("creating");
      setJob(null);
      setFailure(null);
      setDownloadHref(null);
      void (async () => {
        try {
          const raw = await fetchJSON<unknown>(SERVER_EXPORT_BASE, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": idemRef.current as string,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          const next = normalizeJob(raw);
          if (!next) {
            settle(ticket, () => {
              setFailure({
                text: "建单回答的形状不认识，本页不猜它成功了。稍后「再查一次」或引用请求编号反馈。",
                guide: false,
                requestId: null,
                technical: "A5 shape unknown",
              });
              setPhase("failed");
            });
            return;
          }
          settle(ticket, () => {
            exportIdRef.current = next.exportId;
            accept(ticket, next);
          });
        } catch (err) {
          if (controller.signal.aborted) return;
          settle(ticket, () => {
            setFailure({ ...exportFailCopyOf(err), requestId: ridOf(err), technical: null });
            setPhase("failed");
            idemRef.current = null;
          });
        }
      })();
    },
    [accept, settle, stopTimer],
  );

  const recheck = useCallback((): void => {
    const exportId = exportIdRef.current;
    if (!exportId) return;
    const ticket = ++seq.current;
    if (!abortRef.current || abortRef.current.signal.aborted) {
      abortRef.current = new AbortController();
    }
    pollsRef.current = 0; // 「再查一次」= 新预算，不是无限续
    setPhase("polling");
    setFailure(null);
    schedulePoll(ticket, exportId);
  }, [schedulePoll]);

  const cancel = useCallback((): void => {
    ++seq.current; // 在飞回答作废：取消之后没有「迟到的结果」
    abortRef.current?.abort();
    abortRef.current = null;
    stopTimer();
    idemRef.current = null;
    setPhase("canceled");
  }, [stopTimer]);

  // 卸载即掐表断连：不留下会在组件死后 setState 的定时器/回调。
  useEffect(
    () => () => {
      ++seq.current;
      abortRef.current?.abort();
      stopTimer();
    },
    [stopTimer],
  );

  return { phase, job, failure, downloadHref, start, recheck, cancel };
}
