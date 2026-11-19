/**
 * approvals whole-panel states — one vocabulary for both panes (pending + history).
 *
 * The denied body is deliberately ONE body: 403 and 404 say the same sentence,
 * and no row is ever drawn above it. The error body always carries the human
 * sentence, 「请求编号：…」 (or the 「未记录编号」 fallback line since V4-R4),
 * a retry, and a 「详情」 disclosure that
 * is the only place raw technical lines appear.
 *
 * `data-fixture` marks a state that came from the shell's `?state=` repro, so a
 * reviewer can tell it apart from an answer the service actually gave.
 */
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronUp, Inbox, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { themedBody } from "@/lib/utils";
import { type FailureCopy } from "./copy";
import { RequestIdCopy } from "@/components/RequestIdCopy";

interface Marked {
  /** Set to the state name when the pane is showing the `?state=` repro. */
  fixture?: string;
}

const fixtureAttr = (fixture: string | undefined): { "data-fixture"?: string } =>
  fixture ? { "data-fixture": fixture } : {};

/**
 * QA V4-R4 条目2: 零结果与错误面板都要有真出口。壳与页脚没有既有联系入口
 * （grep：src/shell 内 0 个 mailto/联系），所以给带注释的 mailto 缺省，
 * 不是死链。运维给出真实地址后替换此常量。
 */
const CONTACT_ADMIN_HREF = "mailto:workspace-admin@hermes.local?subject=Hermes%20%E6%8E%A7%E5%88%B6%E5%8F%B0%E9%97%AE%E9%A2%98%E5%8F%8D%E9%A6%88";

/** The exit row shared by the zero-result and denied panels: a real route home. */
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
  testId = "approvals-details",
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

export function LoadingPanel({ testId = "approvals-loading", fixture }: Marked & { testId?: string }): ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid={testId} {...fixtureAttr(fixture)}>
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
  testId = "approvals-empty",
  fixture,
}: Marked & { reason: string; nextStep: string; onRefresh: () => void; testId?: string }): ReactNode {
  return (
    <Card className="border-border bg-card" data-testid={testId} {...fixtureAttr(fixture)}>
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
        <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={`min-w-0 break-words text-sm ${themedBody}`}>{reason}</p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">{nextStep}</p>
        <Button size="sm" outlined onClick={onRefresh} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          刷新
        </Button>
        <PanelExits testId={`${testId}-exits`} />
      </CardContent>
    </Card>
  );
}

export function ErrorPanel({
  failure,
  onRetry,
  title = "审批申请没能加载出来",
  testId = "approvals-error",
  fixture,
}: Marked & { failure: FailureCopy; onRetry: () => void; title?: string; testId?: string }): ReactNode {
  return (
    <Card
      role="alert"
      title={failure.technical ?? undefined}
      className="border-destructive/40 bg-destructive/5"
      data-testid={testId}
      {...fixtureAttr(fixture)}
    >
      <CardContent className="flex min-w-0 flex-col items-start gap-2 px-4 py-6">
        <div className="flex min-w-0 items-center gap-2 text-sm text-destructive">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{title}</span>
        </div>
        <p className="max-w-prose break-words text-xs text-muted-foreground">{failure.sentence}</p>
        <p className="break-words text-xs text-muted-foreground"><RequestIdCopy requestId={failure.requestId} fallback="本次请求未记录编号，可复制时间与操作路径反馈" /></p>
        {failure.technical ? <DetailsDisclosure lines={[failure.technical]} testId={`${testId}-details`} /> : null}
        <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          重试
        </Button>
      </CardContent>
    </Card>
  );
}

/** 403 and 404 both land here, and they read exactly the same. */
export function DeniedPanel({ failure, fixture }: Marked & { failure: FailureCopy | null }): ReactNode {
  return (
    <Card
      role="alert"
      aria-label="审批申请不可用"
      className="border-border bg-card"
      data-testid="approvals-denied"
      {...fixtureAttr(fixture)}
    >
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
        <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={`min-w-0 break-words text-sm ${themedBody}`}>暂时无法查看审批申请</p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          这块内容要么尚未对你开放，要么当前环境还没有提供它。这里不会显示任何猜测的内容。
          需要处理审批时，请联系工作区管理员为你开通。
        </p>
        <p className="break-words text-xs text-muted-foreground"><RequestIdCopy requestId={failure?.requestId ?? null} fallback="本次请求未记录编号，可复制时间与操作路径反馈" /></p>
        <PanelExits testId="approvals-denied-exits" />
      </CardContent>
    </Card>
  );
}

/** A failure that must not hide the pane behind it: paging, and a refused decision. */
export function InlineFailure({
  failure,
  action = "这次操作没有成功",
  onRetry,
  retryLabel = "重试",
  testId = "approvals-inline-failure",
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
      <p className="break-words text-xs text-muted-foreground"><RequestIdCopy requestId={failure.requestId} fallback="本次请求未记录编号，可复制时间与操作路径反馈" /></p>
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
