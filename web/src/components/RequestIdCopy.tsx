import { useState } from "react";

/**
 * R9-1: every error/401 state that carries a request id must expose a
 * copyable control next to it. Without an id we keep the honest sentence and
 * render no button (there is nothing to copy).
 */
export function RequestIdCopy({
  requestId,
  fallback,
}: {
  requestId: string | null | undefined;
  fallback: string;
}) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  if (!requestId) {
    return <span data-testid="req-copy-fallback">{fallback}</span>;
  }

  const copy = () => {
    const clip = navigator.clipboard;
    if (!clip?.writeText) {
      setCopied("fail");
      return;
    }
    clip.writeText(requestId).then(
      () => setCopied("ok"),
      () => setCopied("fail"),
    );
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      请求编号：<code className="break-all">{requestId}</code>
      <button
        type="button"
        data-testid="req-copy"
        className="rounded-sm border border-white/15 px-1.5 py-0.5 text-[11px] text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/40"
        onClick={copy}
      >
        复制
      </button>
      {copied === "ok" ? (
        <span data-testid="req-copy-state" className="text-[11px] text-emerald-300">
          已复制
        </span>
      ) : copied === "fail" ? (
        <span data-testid="req-copy-state" className="text-[11px] text-amber-300">
          复制失败，请手动选择
        </span>
      ) : null}
    </span>
  );
}
