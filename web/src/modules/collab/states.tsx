/**
 * COLLAB whole-panel states, in this page's own words. No engineering
 * language on the surface: HTTP codes, field names, ISO instants and raw ids
 * live in `title` attributes and the collapsed 「技术详情」 only.
 *
 * The denied body is ONE body: 403 and 404 arrive as different raw answers
 * but the pane receives a request id and nothing else, so it cannot repeat
 * what the two differ on — no code word, no route, no row above it.
 *
 * The login body is its own leg: a 401 is not a failure of this page, it is
 * the absence of an identity, and it reads that way (「需要登录」, no alert
 * styling, no invented rows).
 *
 * R32 fixture debt burn: the `?state=` repro leg and its `data-fixture` marker
 * were removed. Every panel below is painted from a real read; the delegations
 * route answered 200 on this deployment (an empty tenant), so no state here is
 * ever a stand-in.
 */
import { useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Copy, Inbox, LogIn, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { themedBody } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";

import { NO_REQUEST_ID } from "./delegations";

/**
 * A value a person can quote to support: shown in full, copyable, allowed to
 * wrap so a 32-character hex inside a 375px column cannot push the page
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

/** The 请求编号 line every non-ready panel owes: copyable when there is one. */
export function RequestIdLine({ requestId, testId }: { requestId: string | null; testId: string }): ReactNode {
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground" data-testid={testId}>
      {requestId ? <span>请求编号：</span> : null}
      <CopyValue value={requestId} reason="这次回答没有带编号" label="请求编号" testId={`${testId}-value`} />
    </p>
  );
}

/** The only place engineering values reach the screen: closed means absent from the DOM. */
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

export function LoadingPanel(): ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="col5-loading" aria-busy="true">
      {[0, 1, 2].map((row) => (
        <div key={row} className="animate-pulse rounded-md border border-border bg-card px-4 py-4" aria-hidden="true">
          <div className="h-3 w-1/3 rounded-sm bg-muted" />
          <div className="mt-3 h-2.5 w-2/3 rounded-sm bg-muted/70" />
        </div>
      ))}
    </div>
  );
}

/**
 * The service answered and the tenant really has no delegations. That is not
 * a failure: the panel says so, gives the reason, and names where such a
 * request is made — a read-only page still owes a next step.
 */
export function EmptyPanel({
  onRetry,
  filtered,
}: {
  onRetry: () => void;
  filtered: boolean;
}): ReactNode {
  return (
    <Card className="border-border bg-card" data-testid="col5-empty">
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
        <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={`min-w-0 break-words text-sm ${themedBody}`}>
          {filtered ? "这个筛选条件下没有委托" : "读取成功，这个租户目前没有委托记录"}
        </p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          {filtered
            ? "这是读取成功后的空清单，不代表委托丢了。换一个筛选条件，或清除筛选后重新读取。"
            : "这是读取成功后的空清单，不代表接口坏了。新的委托要由发起方在任务上指派受托员工后才会出现在这里。"}
        </p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          {"要发起一份委托，请到任务详情里指派受托员工（本页只读，不提供发起入口）。"}
        </p>
        <Button
          size="sm"
          outlined
          onClick={onRetry}
          title="重新向服务要一次委托清单"
          prefix={<RefreshCw className="h-3.5 w-3.5" />}
          data-testid="col5-empty-retry"
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
  testId = "col5-error",
  title = "协作委托清单没能加载出来",
}: {
  failure: { sentence: string; requestId: string | null; technical: string | null };
  onRetry: () => void;
  testId?: string;
  title?: string;
}): ReactNode {
  return (
    <Card role="alert" className="border-destructive/40 bg-destructive/5" data-testid={testId}>
      <CardContent className="flex min-w-0 flex-col items-start gap-2 px-4 py-6">
        <div className="flex min-w-0 items-center gap-2 text-sm text-destructive">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{title}</span>
        </div>
        <p className="max-w-prose break-words text-xs text-muted-foreground">{failure.sentence}</p>
        <RequestIdLine requestId={failure.requestId} testId={`${testId}-request-id`} />
        {failure.technical ? <TechnicalDisclosure lines={[failure.technical]} testId={`${testId}-details`} /> : null}
        <Button
          size="sm"
          outlined
          onClick={onRetry}
          title="再向服务要一次"
          prefix={<RefreshCw className="h-3.5 w-3.5" />}
          data-testid={`${testId}-retry`}
        >
          重试
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * 403 and 404 both land here and read byte-for-byte the same: the pane takes
 * the request id only, so it cannot repeat anything the two answers differ
 * on. No row, no count line, and no route above or inside it.
 */
export function DeniedPanel({
  requestId,
  testId = "col5-denied",
}: {
  requestId: string | null;
  testId?: string;
}): ReactNode {
  return (
    <Card role="alert" aria-label="协作委托不可见" className="border-border bg-card" data-testid={testId}>
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
        <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={`min-w-0 break-words text-sm ${themedBody}`}>现在看不到协作委托</p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          这块内容要么尚未对你开放，要么当前环境还没有提供它。这里不会显示任何猜测的委托，也不会把没读到的东西写成零个。
          需要看到这份清单时，请联系工作区管理员开通。
        </p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          {"这份委托清单的读取路由已经接通；这一屏只说明当前账号读不到它。开通后这里自动显示真实内容。"}
        </p>
        <RequestIdLine requestId={requestId} testId={`${testId}-request-id`} />
      </CardContent>
    </Card>
  );
}

/**
 * The 401 leg. Not an error, not empty: the page cannot see anything until
 * the person in front of it has a session. It says what to do, keeps the
 * request id when the answer carried one, and offers the same re-read.
 */
export function LoginPanel({
  requestId,
  sentence,
  onRetry,
}: {
  requestId: string | null;
  sentence: string;
  onRetry: () => void;
}): ReactNode {
  return (
    <Card aria-label="需要登录" className="border-border bg-card" data-testid="col5-login">
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
        <LogIn className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={`min-w-0 break-words text-sm ${themedBody}`}>需要登录</p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">{sentence}</p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          登录后回到本页重新读取，就能看到本租户的真实委托；在此之前这一页不显示任何示例委托。
        </p>
        <RequestIdLine requestId={requestId} testId="col5-login-request-id" />
        <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />} data-testid="col5-login-retry">
          已登录，重新读取
        </Button>
      </CardContent>
    </Card>
  );
}
