import { useCallback, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@nous-research/ui";
import { copyTextToClipboard } from "@/lib/clipboard";

export interface RefreshFailure {
  message: string;
  requestId: string | null;
}

export interface RefreshCoordinator {
  busy: boolean;
  updatedAt: string | null;
  error: RefreshFailure | null;
  tick: number;
  start: () => void;
  finish: (failure: RefreshFailure | null) => void;
}

const BJT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function nowBeijing(): string {
  return BJT.format(new Date());
}

export function useRefreshCoordinator(expected: number): RefreshCoordinator {
  const busyRef = useRef(false);
  const pendingRef = useRef(0);
  const failedRef = useRef<RefreshFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<RefreshFailure | null>(null);
  const [tick, setTick] = useState(0);

  const start = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    pendingRef.current = expected;
    failedRef.current = null;
    setBusy(true);
    setError(null);
    setUpdatedAt(null);
    setTick((value) => value + 1);
  }, [expected]);

  const finish = useCallback((failure: RefreshFailure | null) => {
    if (!busyRef.current) return;
    if (failure && !failedRef.current) failedRef.current = failure;
    pendingRef.current -= 1;
    if (pendingRef.current > 0) return;
    const first = failedRef.current;
    busyRef.current = false;
    setBusy(false);
    if (first) setError(first);
    else setUpdatedAt(nowBeijing());
  }, []);

  return { busy, updatedAt, error, tick, start, finish };
}

function RequestId({ id }: { id: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!id) return <p className="text-xs text-white/45" data-testid="sys-refresh-request-id">请求编号：未提供</p>;
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-white/45" data-testid="sys-refresh-request-id">
      <span>请求编号：</span>
      <code className="min-w-0 break-all" title={id}>{id}</code>
      <button
        type="button"
        className="underline underline-offset-2"
        aria-label="复制请求编号"
        data-testid="sys-refresh-copy"
        onClick={() => { void copyTextToClipboard(id).then(setCopied); }}
      >
        {copied ? "已复制" : "复制"}
      </button>
    </p>
  );
}

export function SystemRefreshBar({
  coordinator,
  onRefresh,
  disabled = false,
}: {
  coordinator: RefreshCoordinator;
  onRefresh?: () => void;
  disabled?: boolean;
}): ReactNode {
  const start = onRefresh ?? coordinator.start;
  return (
    <div className="sys-refresh-bar" data-testid="sys-refresh-bar">
      <div className="sys-refresh-actions">
        <Button
          size="sm"
          outlined
          onClick={start}
          disabled={disabled || coordinator.busy}
          aria-busy={coordinator.busy}
          aria-disabled={disabled || coordinator.busy ? "true" : undefined}
          data-testid="sys-refresh"
        >
          <RefreshCw className={`mr-1 h-3.5 w-3.5${coordinator.busy ? " sys-refresh-spin" : ""}`} aria-hidden="true" />刷新
        </Button>
        {coordinator.busy ? (
          <span className="sys-refresh-note" data-testid="sys-busy-note" role="status">更新中…（先保留上一次读到的数据）</span>
        ) : null}
        {coordinator.updatedAt ? (
          <span className="sys-refresh-note" data-testid="sys-updated-at">刷新完成于 {coordinator.updatedAt}（读取时刻，不是数据时刻）</span>
        ) : null}
      </div>
      {coordinator.error ? (
        <div className="sys-refresh-error" data-testid="sys-refresh-error" role="alert">
          <p>{coordinator.error.message}</p>
          <RequestId id={coordinator.error.requestId} />
          <button type="button" className="sys-refresh-retry" data-testid="sys-refresh-retry" onClick={start}>重试</button>
        </div>
      ) : null}
    </div>
  );
}
