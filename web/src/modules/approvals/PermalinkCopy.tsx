/**
 * R88 — permalink copy for an approval: the link is assembled ONLY from the
 * current address (pathname + search, i.e. the tab/status/q/actor/asort/adir/
 * since/risk parameters as they already are) plus the id of the opened ticket.
 * Copying never fires a request (the data is already on screen). When the
 * clipboard refuses, a read-only textarea offers the exact same string.
 *
 * The feedback uses role="status" (implicitly polite) on purpose: the page
 * keeps a single explicit [aria-live] announcer (the R86 contract), while
 * action feedback still reaches assistive tech.
 */
import { useMemo, useState } from "react";
import { useLocation } from "react-router";

import { Button } from "@nous-research/ui/ui/components/button";

export function PermalinkCopy({ target }: { target: string | null }) {
  const location = useLocation();
  const [status, setStatus] = useState<"idle" | "done" | "failed">("idle");
  const link = useMemo(() => {
    if (!target) return null;
    const sp = new URLSearchParams(location.search);
    sp.set("id", target);
    const qs = sp.toString();
    return qs ? `${location.pathname}?${qs}` : `${location.pathname}?id=${encodeURIComponent(target)}`;
  }, [location.pathname, location.search, target]);
  const copy = () => {
    if (!link) return;
    const write = navigator.clipboard?.writeText;
    if (!write) {
      setStatus("failed");
      return;
    }
    write.call(navigator.clipboard, link).then(
      () => setStatus("done"),
      () => setStatus("failed"),
    );
  };
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
      <Button
        size="sm"
        outlined
        data-testid="apd10-permalink"
        disabled={link === null}
        title={
          link === null
            ? "先打开一条审批再复制"
            : "复制这条审批的固定链接：保留当前页签/筛选/搜索/排序参数，粘链直达并打开详情；只读拼接，不产生二次请求。"
        }
        onClick={copy}
      >
        复制固定链接
      </Button>
      <span data-testid="apd10-status" role="status" className="min-w-0 break-words text-muted-foreground">
        {status === "done" ? "链接已复制" : status === "failed" ? "剪贴板写入被拒绝，可用下方文本框手动复制。" : ""}
      </span>
      {status === "failed" && link !== null ? (
        <textarea
          data-testid="apd10-fallback"
          readOnly
          rows={2}
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full min-w-0 rounded-sm border border-white/15 bg-transparent p-2 font-mono text-xs"
          aria-label="固定链接兜底文本框"
          title="内容与复制按钮给出的链接逐字相同；手动选择后复制。"
        />
      ) : null}
    </div>
  );
}
