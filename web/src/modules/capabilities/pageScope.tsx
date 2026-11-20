import type { ReactNode } from "react";

export type PageScopeMode = "loading" | "full" | "capped" | "unavailable";

export interface PageScopeView {
  mode: PageScopeMode;
  shown: number;
  total: number | null;
  nextCursor: string | null;
  text: string;
  detail: string;
  title: string;
}

export function derivePageScope({
  shown,
  total = null,
  nextCursor = null,
  unavailableReason = null,
  loading = false,
}: {
  shown: number;
  total?: number | null;
  nextCursor?: string | null;
  unavailableReason?: string | null;
  loading?: boolean;
}): PageScopeView {
  if (loading) {
    return {
      mode: "loading",
      shown,
      total,
      nextCursor,
      text: "正在读取当前列表，总数暂不可用",
      detail: "读取完成后按读口回传判断是否分页；不按已加载条数推算总数。",
      title: "列表还在读取；这里不显示猜测的总数。",
    };
  }
  if (unavailableReason) {
    return {
      mode: "unavailable",
      shown,
      total,
      nextCursor,
      text: "读口未接入，无法判断总数",
      detail: "不把空列表当 0 项，也不按已加载条数推算总数。",
      title: `${unavailableReason}；总数不可用，不把空列表当 0 项。`,
    };
  }
  if (nextCursor || total !== null) {
    const totalLine = total === null ? "总数不可用" : `共 ${total} 项 / 已显示 ${shown} 项`;
    return {
      mode: "capped",
      shown,
      total,
      nextCursor,
      text: `本页按读口单页上限显示 ${shown} 项，总数以读口回传为准`,
      detail: total === null ? "总数不可用：读口带分页信号但没有回传 total。" : totalLine,
      title:
        total === null
          ? "读口响应带 nextCursor 或 total，但没有可用的 total；总数不可用，不按已加载条数推算。"
          : "读口响应带 nextCursor 或 total；总数与已显示数均按读口回传，不按已加载条数推算。",
    };
  }
  return {
    mode: "full",
    shown,
    total: null,
    nextCursor: null,
    text: `表内全量渲染，共 ${shown} 项`,
    detail: "读口没有回传 total 或 nextCursor；前端未对返回数组做 slice/limit。",
    title: "读口返回数组且没有 total/nextCursor；表内按收到的全部行渲染，不做前端截断。",
  };
}

export function CapabilityPageScope({
  scope,
  testid = "cap-page-scope",
}: {
  scope: PageScopeView;
  testid?: string;
}): ReactNode {
  return (
    <p className="cap-page-scope" data-testid={testid} data-mode={scope.mode} title={scope.title}>
      <span>{scope.text}</span>
      <span aria-hidden="true"> · </span>
      <span className="cap-page-scope-detail" data-testid={`${testid}-detail`}>{scope.detail}</span>
    </p>
  );
}
