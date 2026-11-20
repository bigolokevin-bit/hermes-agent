/**
 * R127 — 队列表体每行末的「复制这一行」。文本由单一 helper
 * approvalRowCopyText(row) 拼出：单号 / 标题 / 状态人话 / 风险人话 /
 * 更新时间（缺「—」）/ 短码（requestId 后 8 位，禁裸内部 id）。
 * 只读已加载行数据——零额外请求；与 apd11-copy（预览详情）、
 * apd8-copy（决策链路）、apv7-export（CSV）四种文本各走各的单点 helper。
 * 反馈走 role="status"（隐式 polite），遵守 R86 单播报器契约
 * （全页显式 aria-live=polite 只保留 apv-live 一个）。
 */
import { useState } from "react";

import { Button } from "@nous-research/ui/ui/components/button";

import type { ApprovalRow } from "./model";

/** 行末复制的单一拼装点：每段 标签：值，缺值不补 0 也不取本机时钟。 */
export function approvalRowCopyText(row: ApprovalRow): string {
  const short = row.requestId ? row.requestId.slice(-8) : "—";
  return [
    `单号：${row.rawId ?? "—"}`,
    `标题：${row.title}`,
    `状态：${row.status.label}`,
    `风险：${row.risk.label}`,
    `更新时间：${row.clock ?? "—"}`,
    `短码：${short}`,
  ].join("\n");
}

export function RowCopy({ row, index }: { row: ApprovalRow; index: number }) {
  const [status, setStatus] = useState<"idle" | "done" | "failed">("idle");
  const text = approvalRowCopyText(row);
  const label = row.title || row.rawId || `第 ${index + 1} 行`;
  const copy = () => {
    const write = navigator.clipboard?.writeText;
    if (!write) {
      setStatus("failed");
      return;
    }
    write.call(navigator.clipboard, text).then(
      () => setStatus("done"),
      () => setStatus("failed"),
    );
  };
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-2 text-xs"
      // 行末钮不触发卡片打开详情/键盘导航——只服务复制本身。
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Button
        size="sm"
        outlined
        data-testid={`apr-row-copy-${index}`}
        aria-label={`复制${label}这一行`}
        title="复制这一行的六段纯文本（单号/标题/状态/风险/更新时间/短码）；只读已加载行数据，不产生请求。"
        onClick={copy}
      >
        复制这一行
      </Button>
      <span data-testid="apr-row-copy-status" role="status" className="min-w-0 break-words text-muted-foreground">
        {status === "done" ? "已复制" : status === "failed" ? "剪贴板写入被拒绝，可用下方文本框手动复制。" : ""}
      </span>
      {status === "failed" ? (
        <textarea
          data-testid="apr-row-copy-fallback"
          readOnly
          rows={6}
          value={text}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full min-w-0 rounded-sm border border-white/15 bg-transparent p-2 font-mono text-xs"
          aria-label="行复制兜底文本框"
          title="内容与复制按钮给出的文本逐字相同；手动选择后复制。"
        />
      ) : null}
    </div>
  );
}
