/**
 * One state vocabulary for /system's service list and its source matrix.
 * The panels carry the sys-state-* anchors; legacy sys3-* anchors are kept
 * by the caller's wrapper so older checks keep working.
 */
import { useState, type ReactNode } from "react";
import { Inbox, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { copyTextToClipboard } from "@/lib/clipboard";

export type SystemStateKind = "loading" | "empty" | "empty-filter" | "error" | "denied";

function RequestId({
  id,
  legacyTestId,
}: {
  id: string | null | undefined;
  legacyTestId?: string;
}): ReactNode {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  if (!id) {
    return (
      <span className="sys-state-rid" data-testid="sys-state-rid">
        <span data-testid={legacyTestId ?? "sys-state-rid-value"}>请求编号：未提供</span>
      </span>
    );
  }
  return (
    <span className="sys-state-rid" data-testid="sys-state-rid" title={id}>
      <span data-testid={legacyTestId ?? "sys-state-rid-value"}>请求编号：{id}</span>
      <button
        type="button"
        aria-label="复制请求编号"
        data-testid="sys-state-rid-copy"
        onClick={() => {
          void copyTextToClipboard(id).then(
            (ok) => setCopied(ok ? "ok" : "fail"),
            () => setCopied("fail"),
          );
        }}
      >
        {copied === "ok" ? "已复制" : copied === "fail" ? "复制失败" : "复制"}
      </button>
    </span>
  );
}

export function SystemStatePanel({
  kind,
  title,
  reason,
  requestId,
  onRetry,
  retryTestId,
  onClear,
  clearTestId,
  applyHref,
  applyTestId,
  legacyRidTestId,
  gapTitle,
}: {
  kind: SystemStateKind;
  title: string;
  reason?: string | null;
  requestId?: string | null;
  onRetry?: () => void;
  retryTestId?: string;
  onClear?: () => void;
  clearTestId?: string;
  applyHref?: string;
  applyTestId?: string;
  legacyRidTestId?: string;
  gapTitle?: string;
}): ReactNode {
  const loading = kind === "loading";
  const empty = kind === "empty" || kind === "empty-filter";
  return (
    <div
      className={`sys-state sys-state-${kind}`}
      data-testid="sys-state-state"
      data-state={kind}
      title={gapTitle}
      role={kind === "error" || kind === "denied" ? "alert" : undefined}
    >
      {loading ? (
        <>
          <p className="sys-state-title">正在读取服务健康清单…</p>
          {[1, 2, 3].map((n) => <div key={n} className="sys3-skeleton" />)}
        </>
      ) : empty ? (
        <div className="sys-state-empty" data-testid="sys-state-empty">
          <Inbox className="sys-state-icon" aria-hidden="true" />
          <p className="sys-state-title">{title}</p>
          <p className="sys-state-reason" data-testid="sys-state-empty-text">{reason ?? "本次没有可展示的记录；不补造行。"}</p>
          {kind === "empty-filter" && onClear ? (
            <span data-testid="sys-state-clear">
              <Button size="sm" outlined onClick={onClear} data-testid={clearTestId ?? "sys-state-clear-button"}>
                清除筛选
              </Button>
            </span>
          ) : null}
        </div>
      ) : kind === "denied" ? (
        <div className="sys-state-denied" data-testid="sys-state-denied">
          <ShieldAlert className="sys-state-icon" aria-hidden="true" />
          <p className="sys-state-title">{title}</p>
          <p className="sys-state-reason">{reason ?? "这块内容要么尚未接入本控制台，要么当前账号无权查看。"}</p>
          <RequestId id={requestId} legacyTestId={legacyRidTestId} />
          {applyHref ? (
            <a className="sys3-apply" href={applyHref} data-testid={applyTestId ?? "sys-state-apply"}>
              提交开通申请
            </a>
          ) : null}
        </div>
      ) : (
        <div className="sys-state-error" data-testid="sys-state-error">
          <TriangleAlert className="sys-state-icon" aria-hidden="true" />
          <p className="sys-state-title">{title}</p>
          <p className="sys-state-reason">{reason ?? "这次读取没有成功；请重试。"}</p>
          <RequestId id={requestId} legacyTestId={legacyRidTestId} />
          {onRetry ? (
            <span data-testid="sys-state-retry">
              <Button size="sm" outlined onClick={onRetry} data-testid={retryTestId ?? "sys-state-retry-button"}>
                <RefreshCw className="mr-1 size-3.5" aria-hidden="true" />重试
              </Button>
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
