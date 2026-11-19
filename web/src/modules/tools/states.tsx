/**
 * tools & MCP whole-panel states — the four the PRD asks for, in this module's
 * own words.
 *
 * The denied body is ONE body: it receives a request id and nothing else,
 * because a 403 and a 404 differ in their raw answer, and the screen must not.
 * No route, no status number and no service code is in it, and no row is ever
 * drawn above it.
 *
 * `data-fixture` marks a state the shell forced from `?state=`, so a reviewer
 * can tell a repro apart from an answer the service actually gave. It always
 * travels with the GAP number it belongs to.
 */
import { useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Copy, Inbox, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { themedBody } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";

import { GAP, requestIdLine } from "./tools";

export interface Marked {
  /** Set to the state name when the pane shows the `?state=` repro. */
  fixture?: string;
}

/** What a repro panel says so nobody reads it as a service answer. */
export function ReproNote({ state }: { state: string }): ReactNode {
  return (
    <p className="min-w-0 break-words text-xs text-warning" data-testid="tools-forced-note">
      {`这是用 ?state=${state} 复现出来的状态，不是服务此刻的回答；数据源尚未接通（${GAP}）。`}
    </p>
  );
}

function fixtureAttr(fixture: string | undefined): { "data-fixture"?: string } {
  return fixture ? { "data-fixture": fixture } : {};
}

/** 请求编号's own honest word when the answer carried none. */
export const NO_REQUEST_ID = "未提供";

/**
 * A value that can be quoted to support: shown in full, copyable, and allowed
 * to wrap so a 32-character hex inside a 375px column cannot push the page
 * sideways. A missing one says 「未提供」 and keeps the reason in its `title`.
 */
export function CopyValue({
  value,
  reason,
  label,
  testId,
}: {
  value: string | null;
  reason: string;
  label: string;
  testId: string;
}): ReactNode {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  if (!value) {
    return (
      <span className="min-w-0 break-words text-muted-foreground" data-testid={`${testId}-absent`} title={reason}>
        {NO_REQUEST_ID}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid={testId}>
      <span className={`min-w-0 break-all font-mono text-xs ${themedBody}`}>{value}</span>
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

/** The 请求编号 line every failure panel owes: copyable when there is one. */
export function RequestIdLine({ requestId, testId }: { requestId: string | null; testId: string }): ReactNode {
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground" data-testid={testId}>
      {requestId ? <span>请求编号：</span> : null}
      <CopyValue
        value={requestId}
        reason={requestIdLine(null)}
        label="请求编号"
        testId={`${testId}-value`}
      />
    </p>
  );
}

/** The only place engineering values reach the screen: collapsed, and closed means absent from the DOM. */
export function TechnicalDisclosure({
  lines,
  label = "技术详情",
  testId,
}: {
  lines: string[];
  label?: string;
  testId: string;
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

export function LoadingPanel({ fixture }: Marked): ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="tools-loading" aria-busy="true" {...fixtureAttr(fixture)}>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="animate-pulse rounded-md border border-border bg-card px-4 py-4" aria-hidden="true">
          <div className="h-3 w-1/3 rounded-sm bg-muted" />
          <div className="mt-3 h-2.5 w-2/3 rounded-sm bg-muted/70" />
        </div>
      ))}
    </div>
  );
}

export function EmptyPanel({
  onRetry,
  fixture,
}: Marked & { onRetry: () => void }): ReactNode {
  return (
    <Card className="border-border bg-card" data-testid="tools-empty" {...fixtureAttr(fixture)}>
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
        <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={`min-w-0 break-words text-sm ${themedBody}`}>服务回了一份连接清单，里面一条连接也没有</p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          这说明这个环境还没有登记任何 MCP 连接，不代表读取失败。下一步：在原生 MCP 管理页登记连接后回到这里重新读取；
          本控制台只读这份清单，不会替你新建或改动连接。
        </p>
        <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          重新读取
        </Button>
      </CardContent>
    </Card>
  );
}

export function ErrorPanel({
  failure,
  onRetry,
  fixture,
}: Marked & { failure: { sentence: string; requestId: string | null; technical: string | null }; onRetry: () => void }): ReactNode {
  return (
    <Card
      role="alert"
      title={failure.technical ?? undefined}
      className="border-destructive/40 bg-destructive/5"
      data-testid="tools-error"
      {...fixtureAttr(fixture)}
    >
      <CardContent className="flex min-w-0 flex-col items-start gap-2 px-4 py-6">
        <div className="flex min-w-0 items-center gap-2 text-sm text-destructive">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">连接清单没能加载出来</span>
        </div>
        <p className="max-w-prose break-words text-xs text-muted-foreground">{failure.sentence}</p>
        <RequestIdLine requestId={failure.requestId} testId="tools-error-request-id" />
        {failure.technical ? <TechnicalDisclosure lines={[failure.technical]} testId="tools-error-details" /> : null}
        <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          重试
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * 403 and 404 both land here and read byte-for-byte the same: the pane takes
 * the request id only, so it cannot repeat anything the two answers differ on.
 */
export function DeniedPanel({ requestId, fixture }: Marked & { requestId: string | null }): ReactNode {
  return (
    <Card
      role="alert"
      aria-label="工具与 MCP 连接不可用"
      className="border-border bg-card"
      data-testid="tools-denied"
      {...fixtureAttr(fixture)}
    >
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
        <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={`min-w-0 break-words text-sm ${themedBody}`}>暂时看不到工具与 MCP 连接</p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          这块内容要么尚未对你开放，要么当前环境还没有提供它。这里不会显示任何猜测的连接，也不会把没读到的东西写成零个。
          需要看到这份清单时，请联系工作区管理员开通；连接本身仍在原生 MCP 管理页维护。
        </p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          这份清单的数据源尚未在本控制台接通（{GAP}），接通后自动显示真实数据。
        </p>
        <RequestIdLine requestId={requestId} testId="tools-denied-request-id" />
      </CardContent>
    </Card>
  );
}
