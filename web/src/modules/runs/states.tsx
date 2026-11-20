/**
 * T15 (PRD v4.1) runs whole-panel states — the four, in this module's own
 * words. No engineering language: HTTP codes, field names, ISO instants and
 * raw ids live in `title` attributes and the collapsed 「技术详情」 only.
 *
 * The denied body is ONE body: 403 and 404 arrive with different raw answers
 * but the pane receives a request id and nothing else, so it cannot repeat
 * what the two differ on — no code word, no route, no row above it.
 *
 * R30 burned the `?state=` repro leg; R39 brings it back, marked. A panel here
 * is either the service's own answer or a repro the shell forced from the URL —
 * `data-fixture` carries the state name and travels with the on-screen note, so
 * a reviewer can tell the two apart at a glance. A forced leg asks nothing, so
 * the controls that would ask are disabled on it.
 */
import { useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Copy, Inbox, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { themedBody } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";

import { NO_REQUEST_ID } from "./runs";

export interface Marked {
  /** Set to the state name when the pane shows the `?state=` repro. */
  fixture?: string;
}

function fixtureAttr(fixture: string | undefined): { "data-fixture"?: string } {
  return fixture ? { "data-fixture": fixture } : {};
}

/**
 * What a repro panel says, so nobody reads it as a service answer. It names no
 * route, no code and no gap number — the surface stays in human words — and it
 * points at the way out: drop `?state=` and the page reads for real.
 */
export function ReproNote({ state }: { state: string }): ReactNode {
  return (
    <p className="min-w-0 break-words text-xs text-warning" data-testid="run5-forced-note">
      {`这是用 ?state=${state} 复现出来的状态，不是服务此刻的回答：这一条腿没有向服务要过任何东西。` +
        `去掉地址里的 ?state= 就是真实读取。`}
    </p>
  );
}

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
    <span className="ui-c-container flex min-w-0 flex-wrap items-center gap-2" data-testid={testId}>
      <span className={`ui-c-id ${themedBody}`}>{value}</span>
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
      <CopyValue value={requestId} reason="这次回答没有带编号" label="请求编号" testId={`${testId}-value`} />
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
    <div className="flex min-w-0 flex-col gap-2" data-testid="run5-loading" aria-busy="true" {...fixtureAttr(fixture)}>
      <span hidden data-testid="run-state-loading" data-phase="loading" />
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="animate-pulse rounded-md border border-border bg-card px-4 py-4" aria-hidden="true">
          <div className="h-3 w-1/3 rounded-sm bg-muted" />
          <div className="mt-3 h-2.5 w-2/3 rounded-sm bg-muted/70" />
        </div>
      ))}
    </div>
  );
}

/**
 * The service answered, and the window really was empty. That is different
 * from a failure: the panel says so, gives the reason, and names the next
 * step instead of leaving a blank area.
 */
export function EmptyPanel({
  onRetry,
  onClear,
  kind,
  fixture,
  guide,
}: Marked & {
  onRetry: () => void;
  onClear?: () => void;
  kind: "window" | "filter";
  /** Extra next-step block, shown only for the unfiltered empty window. */
  guide?: ReactNode;
}): ReactNode {
  const filtered = kind === "filter";
  return (
    <Card className="border-border bg-card" data-testid="run5-empty" {...fixtureAttr(fixture)}>
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
        <span hidden data-testid="run-state-empty" data-phase="empty" />
        <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={`min-w-0 break-words text-sm ${themedBody}`} data-testid="run-state-empty-text">
          {filtered ? "当前筛选下没有运行记录" : "服务回答了，这个时间窗口里确实没有运行"}
        </p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          {filtered
            ? "读取是成功的：状态或负责人筛选把这一页筛空了。清空筛选就能看到这个时间范围里的全部运行。"
            : "这是读取成功后的空清单，不代表接口坏了，也不代表运行丢了。下一步：把时间范围放宽一档，或等待新的运行产生后重新读取。"}
        </p>
        {!filtered && guide ? (
          <div className="mt-1 flex min-w-0 flex-col items-center gap-1" data-testid="run-empty-guide">
            {guide}
          </div>
        ) : null}
        {filtered && onClear ? (
          <Button
            size="sm"
            outlined
            onClick={onClear}
            disabled={Boolean(fixture)}
            title={fixture ? "复现腿不发起真实请求，去掉 ?state= 即为真实读取" : "清空状态与负责人筛选，保留时间范围"}
            data-testid="run-state-clear"
          >
            清空筛选
          </Button>
        ) : null}
        <Button
          size="sm"
          outlined
          onClick={onRetry}
          disabled={Boolean(fixture)}
          title={fixture ? "复现腿不发起真实请求，去掉 ?state= 即为真实读取" : "重新向服务要一次运行记录"}
          prefix={<RefreshCw className="h-3.5 w-3.5" />}
          data-testid="run5-empty-retry"
        >
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
  testId = "run5-error",
  title = "运行记录没能加载出来",
}: Marked & {
  failure: { sentence: string; requestId: string | null; technical: string | null };
  onRetry: () => void;
  testId?: string;
  title?: string;
}): ReactNode {
  return (
    <Card
      role="alert"
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
        <span hidden data-testid="run-state-error" data-phase="error" />
        <span data-testid="run-state-rid">
          <RequestIdLine requestId={failure.requestId} testId={`${testId}-request-id`} />
        </span>
        {failure.technical ? <TechnicalDisclosure lines={[failure.technical]} testId={`${testId}-details`} /> : null}
        <span data-testid="run-state-retry" data-disabled={fixture ? "1" : "0"}>
          <Button
            size="sm"
            outlined
            onClick={onRetry}
            disabled={Boolean(fixture)}
            title={fixture ? "复现腿不发起真实请求，去掉 ?state= 即为真实读取" : "再向服务要一次"}
            prefix={<RefreshCw className="h-3.5 w-3.5" />}
            data-testid={`${testId}-retry`}
          >
            重试
          </Button>
        </span>
      </CardContent>
    </Card>
  );
}

/**
 * 403 and 404 both land here and read byte-for-byte the same: the pane takes
 * the request id only, so it cannot repeat anything the two answers differ
 * on. No row and no count table is ever painted above it.
 */
export function DeniedPanel({
  requestId,
  fixture,
  testId = "run5-denied",
}: Marked & { requestId: string | null; testId?: string }): ReactNode {
  return (
    <Card
      role="alert"
      aria-label="运行记录不可见"
      className="border-border bg-card"
      data-testid={testId}
      {...fixtureAttr(fixture)}
    >
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
        <span hidden data-testid="run-state-denied" data-phase="denied" />
        <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={`min-w-0 break-words text-sm ${themedBody}`}>现在看不到运行记录</p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          这块内容要么尚未对你开放，要么当前环境还没有提供它。这里不会显示任何猜测的运行，
          也不会把没读到的东西写成零个。需要看到这份记录时，请联系工作区管理员开通。
        </p>
        <RequestIdLine requestId={requestId} testId={`${testId}-request-id`} />
      </CardContent>
    </Card>
  );
}
