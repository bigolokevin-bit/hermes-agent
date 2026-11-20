/**
 * approvals whole-panel states — one vocabulary for both panes (pending + history).
 *
 * The denied body is deliberately ONE body: 403 and 404 say the same sentence,
 * and no row is ever drawn above it. The error body always carries the human
 * sentence, 「请求编号：…」 (or the 「未记录编号」 fallback line since V4-R4),
 * a retry, and a 「详情」 disclosure that
 * is the only place raw technical lines appear.
 *
 * fixture attributes were retired (R29 fixture-debt burn); `?state=` repros stay marked by the on-screen note's `?state=` repro, so a
 * reviewer can tell it apart from an answer the service actually gave.
 */
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronUp, Inbox, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { themedBody } from "@/lib/utils";
import { type FailureCopy } from "./copy";

// R29 fixture-debt burn: the `?state=` repro is marked by the on-screen
// apr5-forced-note text; panels no longer carry a fixture attribute.
// Record<never, never> 保留「无额外 props」标记意图，又不会像
// Record<string, never> 那样与任何具名 prop 的交叉类型冲突。
type Marked = Record<never, never>;

/**
 * The request-id line, with a copy control that writes the SAME string that is
 * shown. This is the approvals-module (apr4) sibling of the shell's
 * `@/components/RequestIdCopy`: it keeps the lane's own testids (`apr5-request-id`
 * for the value, `apr5-copy-request-id` for the button) without touching the
 * shared component. A missing id keeps the honest fallback sentence and renders
 * NO button — a value is never invented so there is something to copy.
 */
export function RequestIdCopyField({
  requestId,
  fallback,
}: {
  requestId: string | null | undefined;
  fallback: string;
}): ReactNode {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  if (!requestId) {
    return (
      <span className="min-w-0 break-words" data-testid="apr5-request-id-missing">
        {fallback}
      </span>
    );
  }

  const copy = (): void => {
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
    <span className="inline-flex min-w-0 flex-wrap items-center gap-1">
      请求编号：<code className="break-all" data-testid="apr5-request-id">{requestId}</code>
      <button
        type="button"
        data-testid="apr5-copy-request-id"
        className="rounded-sm border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/40"
        onClick={copy}
      >
        复制
      </button>
      {copied === "ok" ? (
        <span data-testid="apr5-copy-state" className="text-[11px] text-muted-foreground">
          已复制
        </span>
      ) : copied === "fail" ? (
        <span data-testid="apr5-copy-state" className="text-[11px] text-warning">
          复制失败，请手动选择
        </span>
      ) : null}
    </span>
  );
}

/**
 * QA V4-R4 条目2: 零结果与错误面板都要有真出口。壳与页脚没有既有联系入口
 * （grep：src/shell 内 0 个 mailto/联系），所以给带注释的 mailto 缺省，
 * 不是死链。运维给出真实地址后替换此常量。
 */
const CONTACT_ADMIN_HREF = "mailto:workspace-admin@hermes.local?subject=Hermes%20%E6%8E%A7%E5%88%B6%E5%8F%B0%E9%97%AE%E9%A2%98%E5%8F%8D%E9%A6%88";

/** The exit row shared by the zero-result and denied panels: a real route home. */
import {
  APPROVAL_DENIED_BODY,
  APPROVAL_DENIED_TITLE,
  APPROVAL_FAILED_TITLE,
  APPROVAL_RID_FALLBACK,
  APPROVAL_RETRY_LABEL,
} from "./stateCopy";

function PanelExits({ testId }: { testId: string }): ReactNode {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-center gap-2" data-testid={testId}>
      <Link
        to="/overview"
        data-testid={`${testId}-back`}
        className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm hover:bg-muted/40"
      >
        返回控制台
      </Link>
      <a
        href={CONTACT_ADMIN_HREF}
        data-testid={`${testId}-contact`}
        className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm hover:bg-muted/40"
      >
        联系管理员
      </a>
    </div>
  );
}

/** The only place engineering values reach the screen: collapsed until clicked. */
export function DetailsDisclosure({
  lines,
  testId = "apr5-details",
}: {
  lines: string[];
  testId?: string;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const shown = lines.filter((line) => line);
  if (!shown.length) return null;
  return (
    <div className="min-w-0 text-xs" data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-2"
      >
        {open ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
        详情
      </button>
      {open ? (
        <ul className="mt-1 flex min-w-0 flex-col gap-0.5 break-words font-mono text-muted-foreground">
          {shown.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function LoadingPanel({ testId = "apr5-loading" }: Marked & { testId?: string }): ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid={testId} >
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="animate-pulse rounded-md border border-border bg-card px-4 py-4" aria-hidden="true">
          <div className="h-3 w-1/2 rounded-sm bg-muted" />
          <div className="mt-3 h-2.5 w-3/4 rounded-sm bg-muted/70" />
        </div>
      ))}
    </div>
  );
}

export function EmptyPanel({
  reason,
  nextStep,
  onRefresh,
  testId = "apr5-empty",
  clear,
}: Marked & {
  reason: string;
  nextStep: string;
  onRefresh: () => void;
  testId?: string;
  /** R70: 有服务器筛选时的清空出口（无筛选的真集空不给假出口）。 */
  clear?: { label: string; onClear: () => void };
}): ReactNode {
  return (
    <Card className="border-border bg-card" data-testid={testId} >
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center" data-testid="apv-state-empty">
        <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={`min-w-0 break-words text-sm ${themedBody}`} data-testid="apv-state-empty-text">{reason}</p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">{nextStep}</p>
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
          <Button size="sm" outlined onClick={onRefresh} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
            刷新
          </Button>
          {clear ? (
            <Button size="sm" outlined data-testid="apv-state-clear" onClick={clear.onClear}>
              {clear.label}
            </Button>
          ) : null}
        </div>
        <PanelExits testId={`${testId}-exits`} />
      </CardContent>
    </Card>
  );
}

export function ErrorPanel({
  failure,
  onRetry,
  title = APPROVAL_FAILED_TITLE,
  testId = "apr5-error",
  retryTestId,
}: Marked & { failure: FailureCopy; onRetry: () => void; title?: string; testId?: string; retryTestId?: string }): ReactNode {
  return (
    <Card
      role="alert"
      title={failure.technical ?? undefined}
      className="border-destructive/40 bg-destructive/5"
      data-testid={testId}
      
    >
      <CardContent className="flex min-w-0 flex-col items-start gap-2 px-4 py-6" data-testid="apv-state-error">
        <div className="flex min-w-0 items-center gap-2 text-sm text-destructive">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{title}</span>
        </div>
        <p className="max-w-prose break-words text-xs text-muted-foreground">{failure.sentence}</p>
        <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="apv-state-rid"><RequestIdCopyField requestId={failure.requestId} fallback={APPROVAL_RID_FALLBACK} /></p>
        {failure.technical ? <DetailsDisclosure lines={[failure.technical]} testId={`${testId}-details`} /> : null}
        <span data-testid="apv-state-retry">
          <Button size="sm" outlined onClick={onRetry} data-testid={retryTestId ?? `${testId}-retry`} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
            {APPROVAL_RETRY_LABEL}
          </Button>
        </span>
      </CardContent>
    </Card>
  );
}

/** 403 and 404 both land here, and they read exactly the same. */
export function DeniedPanel({ failure }: Marked & { failure: FailureCopy | null }): ReactNode {
  return (
    <Card
      role="alert"
      aria-label="审批申请不可用"
      className="border-border bg-card"
      data-testid="apr5-denied"
      
    >
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center" data-testid="apv-state-denied">
        <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={`min-w-0 break-words text-sm ${themedBody}`}>{APPROVAL_DENIED_TITLE}</p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">{APPROVAL_DENIED_BODY}</p>
        <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="apv-state-rid"><RequestIdCopyField requestId={failure?.requestId ?? null} fallback={APPROVAL_RID_FALLBACK} /></p>
        <PanelExits testId="apr5-denied-exits" />
      </CardContent>
    </Card>
  );
}

/** A failure that must not hide the pane behind it: paging, and a refused decision. */
export function InlineFailure({
  failure,
  action = "这次操作没有成功",
  onRetry,
  retryLabel = APPROVAL_RETRY_LABEL,
  testId = "apr5-inline-failure",
}: {
  failure: FailureCopy;
  action?: string;
  onRetry?: () => void;
  retryLabel?: string;
  testId?: string;
}): ReactNode {
  return (
    <div
      role="alert"
      title={failure.technical ?? undefined}
      className="flex min-w-0 flex-col items-start gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2"
      data-testid={testId}
    >
      <p className="max-w-prose break-words text-xs text-destructive">{`${action}：${failure.sentence}`}</p>
      <p className="min-w-0 break-words text-xs text-muted-foreground"><RequestIdCopyField requestId={failure.requestId} fallback={APPROVAL_RID_FALLBACK} /></p>
      <div className="flex flex-wrap items-center gap-2">
        {failure.technical ? <DetailsDisclosure lines={[failure.technical]} testId={`${testId}-details`} /> : null}
        {onRetry ? (
          <Button size="sm" outlined onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
