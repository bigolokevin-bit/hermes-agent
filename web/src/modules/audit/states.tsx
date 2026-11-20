/**
 * audit whole-panel states — one vocabulary for the list, the detail and the
 * window check (T33).
 *
 * The denied body is deliberately ONE body: 403 and 404 say the same sentence,
 * and no row is ever drawn above it. The error body always carries the human
 * sentence, 「请求编号：…」 (or the 「未记录编号」 fallback line since V4-R4), a
 * retry, and a 「详情」 disclosure that
 * is the only place raw technical lines appear.
 *
 */
import { useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Copy, Inbox, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { themedBody } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";
import { requestIdLine, type FailureCopy } from "./copy";
import { SUMMARY_COPY_LABEL } from "./summary";

/**
 * audC: the 结论行 copy control, rendered by BOTH legs (the inline row preview
 * and the event detail) from the same built line. Three honest states only:
 * nothing asked yet, 已复制 (announced through `aria-live`), and the clipboard
 * refusing — in which case a read-only textarea appears so the text can still
 * be selected by hand. It never sends a request: the line is made of what is
 * already on this screen.
 */
export function SummaryCopy({ line }: { line: string }): ReactNode {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid="audC-copy-block">
      <Button
        size="sm"
        outlined
        aria-label={SUMMARY_COPY_LABEL}
        title="复制这一条的结论行（时间·操作者·动作·资源·请求编号），不再向服务发任何请求"
        data-testid="audC-copy"
        prefix={state === "copied" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        onClick={() => {
          void copyTextToClipboard(line).then((ok) => {
            setState(ok ? "copied" : "manual");
          });
        }}
      >
        {SUMMARY_COPY_LABEL}
      </Button>
      <span className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite" data-testid="audC-copy-status">
        {state === "copied" ? "已复制" : state === "manual" ? "剪贴板不可用，这一行可以直接选中复制" : ""}
      </span>
      {state === "manual" ? (
        <textarea
          readOnly
          value={line}
          aria-label="结论行（可手动选中复制）"
          data-testid="audC-fallback"
          className="min-h-[3rem] w-full min-w-0 break-words rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </div>
  );
}

/** 请求编号 has its own honest word: the answer simply did not carry one. */
export const NO_REQUEST_ID = "未提供";

/**
 * 请求编号 on the surface, copyable, and honest when it is missing: 「未提供」
 * with the reason in its `title`. An id is quoted to support, so it is shown in
 * full and allowed to wrap — `break-all` keeps a 32-character hex inside a
 * 375px column instead of pushing the page sideways. `failure` switches the
 * missing word to the sentence a failure panel owes a person: what to quote
 * when there is no number at all.
 */
export function CopyValue({
  value,
  reason,
  label,
  testId,
  failure = false,
}: {
  value: string | null;
  /** What to say instead when the service sent nothing. */
  reason: string;
  /** The field name, for the button's accessible label. */
  label: string;
  testId: string;
  /** A failure panel speaks its own missing-id sentence instead of 「未提供」. */
  failure?: boolean;
}): ReactNode {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  if (!value) {
    if (failure) return <span className="min-w-0 break-words">{requestIdLine(null)}</span>;
    return (
      <span className="min-w-0 break-words text-muted-foreground" data-testid={`${testId}-absent`} title={reason}>
        {NO_REQUEST_ID}
      </span>
    );
  }
  // R31: a request number is quoted in full only in `title`; the line itself
  // shows a short form. A bare 32-hex digest shows its first 8 characters, and
  // a scheme handle (ap_…, ev_…, rn_…) shows the same 8-character tail every
  // other surface uses, so no long identifier is printed verbatim.
  const shown = /^[0-9a-f]{32}$/i.test(value)
    ? value.slice(0, 8)
    : /^[a-z][a-z0-9]{1,11}_[0-9A-Za-z]{9,}$/i.test(value)
      ? `${value.slice(0, value.indexOf("_") + 1)}…${value.slice(-8)}`
      : value;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid={testId}>
      <span className={`min-w-0 break-all font-mono text-xs ${themedBody}`} title={value}>{shown}</span>
      <button
        type="button"
        aria-label={`复制${label}`}
        title="复制"
        className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
        onClick={() => {
          void copyTextToClipboard(value).then((ok) => {
            setCopied(ok ? "done" : "failed");
            if (ok) window.setTimeout(() => setCopied("idle"), 2500);
          });
        }}
      >
        {copied === "done" ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
        {copied === "done" ? "已复制" : copied === "failed" ? "复制失败，请手动选择" : "复制"}
      </button>
    </span>
  );
}

/** The 请求编号 line of a failure panel: copyable when there is one, honest when there is not. */
export function RequestIdLine({ requestId, testId }: { requestId: string | null; testId: string }): ReactNode {
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground" data-testid={testId}>
      {requestId ? <span>请求编号：</span> : null}
      <CopyValue value={requestId} reason="" label="请求编号" testId={`${testId}-value`} failure />
    </p>
  );
}

/**
 * The only place engineering values reach the screen: collapsed until clicked,
 * and collapsed means the raw lines are not in the DOM at all.
 */
export function TechnicalDisclosure({
  lines,
  label = "详情",
  testId = "audit-details",
}: {
  lines: string[];
  label?: string;
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
        data-expanded={open ? "true" : "false"}
        className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-2"
      >
        {open ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
        {label}
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

export function LoadingPanel({ testId = "audit-loading" }: { testId?: string }): ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid={testId}>
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
  testId = "audit-empty",
}: { reason: string; nextStep: string; onRefresh: () => void; testId?: string }): ReactNode {
  return (
    <Card className="border-border bg-card" data-testid={testId}>
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
        <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={`min-w-0 break-words text-sm ${themedBody}`}>{reason}</p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">{nextStep}</p>
        <Button size="sm" outlined onClick={onRefresh} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          刷新
        </Button>
      </CardContent>
    </Card>
  );
}

export function ErrorPanel({
  failure,
  onRetry,
  title = "审计事件没能加载出来",
  testId = "audit-error",
}: { failure: FailureCopy; onRetry: () => void; title?: string; testId?: string }): ReactNode {
  return (
    <Card
      role="alert"
      title={failure.technical ?? undefined}
      className="border-destructive/40 bg-destructive/5"
      data-testid={testId}
    >
      <CardContent className="flex min-w-0 flex-col items-start gap-2 px-4 py-6">
        <div className="flex min-w-0 items-center gap-2 text-sm text-destructive">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{title}</span>
        </div>
        <p className="max-w-prose break-words text-xs text-muted-foreground">{failure.sentence}</p>
        <RequestIdLine requestId={failure.requestId} testId={`${testId}-request-id`} />
        {failure.technical ? <TechnicalDisclosure lines={[failure.technical]} testId={`${testId}-details`} /> : null}
        <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          重试
        </Button>
      </CardContent>
    </Card>
  );
}

/** 403 and 404 both land here, and they read exactly the same. */
export function DeniedPanel({
  failure,
  testId = "audit-denied",
}: { failure: FailureCopy | null; testId?: string }): ReactNode {
  return (
    <Card
      role="alert"
      aria-label="审计事件不可用"
      className="border-border bg-card"
      data-testid={testId}
    >
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
        <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={`min-w-0 break-words text-sm ${themedBody}`}>暂时无法查看审计事件</p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          这块内容要么尚未对你开放，要么当前环境还没有提供它。这里不会显示任何猜测的内容。
          需要查看审计记录时，请联系工作区管理员为你开通。
        </p>
        <RequestIdLine requestId={failure?.requestId ?? null} testId={`${testId}-request-id`} />
      </CardContent>
    </Card>
  );
}

/**
 * The check could not run. Same body for 403 and 404: both mean the capability
 * is not reachable here. It never claims the chain is intact.
 */
export function VerifyUnavailablePanel({
  failure,
  onRetry,
  testId = "aud03-unavailable",
}: { failure: FailureCopy; onRetry: () => void; testId?: string }): ReactNode {
  return (
    // No `title` here on purpose: the raw answer differs between a 403 and a
    // 404, and this body must not. The technical line is reachable collapsed.
    <Card
      role="status"
      className="border-border bg-card"
      data-testid={testId}
    >
      <CardContent className="flex min-w-0 flex-col items-start gap-2 px-4 py-8">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <ShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={`min-w-0 break-words ${themedBody}`}>本环境未启用</span>
        </div>
        <p className="max-w-prose break-words text-xs text-muted-foreground">{failure.sentence}</p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          下一步：让工作区管理员在审计服务里开通时间窗完整性校验，开通后回到这一页重新运行即可；这里不会先给一个「已通过」的结论。
        </p>
        <RequestIdLine requestId={failure.requestId} testId={`${testId}-request-id`} />
        {failure.technical ? <TechnicalDisclosure lines={[failure.technical]} testId={`${testId}-details`} /> : null}
        <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          再运行一次
        </Button>
      </CardContent>
    </Card>
  );
}

/** A failure that must not hide the pane behind it: paging, and a refused reload. */
export function InlineFailure({
  failure,
  action = "这次操作没有成功",
  onRetry,
  retryLabel = "重试",
  testId = "audit-inline-failure",
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
      <RequestIdLine requestId={failure.requestId} testId={`${testId}-request-id`} />
      <div className="flex flex-wrap items-center gap-2">
        {failure.technical ? <TechnicalDisclosure lines={[failure.technical]} testId={`${testId}-details`} /> : null}
        {onRetry ? (
          <Button size="sm" outlined onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
