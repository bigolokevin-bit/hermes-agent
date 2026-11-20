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
import { Check, ChevronDown, ChevronUp, Copy, Filter, Inbox, Link, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { themedBody } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";
import { requestIdLine, type FailureCopy } from "./copy";
import {
  DENIED_BODY_SENTENCE,
  STATE_LABEL,
  stateMark,
  stateSentenceFor,
  unwiredReasonFor,
  type StatePhase,
  type StateSlot,
} from "./stateCopy";
import { SUMMARY_COPY_LABEL } from "./summary";
import { PERMALINK_COPY_LABEL, permalinkFromEvent } from "./permalink";
import type { Gate } from "./auditGates";
import { FILTER_SUMMARY_COPY_LABEL } from "./filterSummary";
import { AUDIT_RESOURCE_NO_LINK_TEXT, resourceLinkOf } from "./resourceLinks";
import { AUDJ_TIME_MISSING } from "./timeActor";
import type { ResourceView } from "./model";
import type { AuditChip } from "./filterChips";

/**
 * audW — 「打开资源」, rendered by BOTH legs (the inline preview and the event
 * detail) from the ONE table in resourceLinks.ts.
 *
 * A real anchor: focusable, openable in a new tab, and its `href` is the address
 * the landing page itself reads. Never an onClick that only looks like a link.
 * A type with no page, or a record whose id never came back, is said in words
 * instead — a dead link reads as a defect in the ledger rather than in the
 * mapping, and the ledger has done nothing wrong.
 */
export function AuditResourceLink({ resource }: { resource: ResourceView }): ReactNode {
  const link = resourceLinkOf(resource);
  const shell =
    "flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground";
  if (link.kind === "link") {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer noopener"
        className="min-w-0 max-w-full break-words rounded-md border border-border bg-card px-2 py-1 text-xs underline underline-offset-2"
        data-testid="aud-resource-link"
        data-aud-resource={resource.type ?? undefined}
        title={link.title}
      >
        {link.label}
      </a>
    );
  }
  if (link.kind === "missing") {
    return (
      <span className={shell} data-testid="aud-resource-missing" title={link.title}>
        {AUDJ_TIME_MISSING}
      </span>
    );
  }
  return (
    <span className={shell} data-testid="aud-resource-nolink" title={link.title}>
      {AUDIT_RESOURCE_NO_LINK_TEXT}
    </span>
  );
}

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
          data-testid="audC-copy-fallback"
          className="min-h-[3rem] w-full min-w-0 break-words rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </div>
  );
}

/**
 * audE: the fixed link for one event, offered by BOTH legs (the inline row
 * preview and the record body). Same three honest states as the 结论行 copy:
 * nothing asked yet, 链接已复制 (announced), and the clipboard refusing — then
 * a read-only textarea holds the exact link. No request is made to build it:
 * the identifier is the one already on screen, and when a row carries none the
 * control is disabled instead of inventing one.
 */
export function PermalinkCopy({ eventId, gate }: { eventId: string | null; gate: Gate }): ReactNode {
  const link = permalinkFromEvent(eventId);
  // audQ: enabled/disabled and the reason are handed in by auditGates — the
  // component no longer decides for itself, so a preview and the pane beside it
  // cannot disagree about one failure.
  const ready = gate.enabled && link !== null;
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid="audE-link-block">
      <Button
        size="sm"
        outlined
        aria-label={PERMALINK_COPY_LABEL}
        title={gate.title}
        data-testid="audE-link"
        disabled={!ready}
        aria-disabled={!ready}
        prefix={
          state === "copied" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Link className="h-3.5 w-3.5" aria-hidden="true" />
        }
        onClick={() => {
          if (!ready || !link) return;
          void copyTextToClipboard(link).then((ok) => {
            setState(ok ? "copied" : "manual");
          });
        }}
      >
        {PERMALINK_COPY_LABEL}
      </Button>
      <span className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite" data-testid="audE-link-status">
        {state === "copied" ? "链接已复制" : state === "manual" ? "剪贴板不可用，这个链接可以直接选中复制" : ""}
      </span>
      {/* audP: what the fixed link does NOT carry, said where it is handed out.
          The permalink pins ONE record; the window, the size, the filters and
          the paging are this screen's business and stay here. Whoever opens the
          link arrives with the defaults and lands in the 深链档, which is the
          honest reading — not a copy of the sender's page. */}
      <span className="min-w-0 basis-full break-words text-xs text-muted-foreground" data-testid="audE-link-scope">
        这条链接只钉住这一条事件：不带这一页的时间窗、每页条数与筛选。粘出去的人会用默认档读到它，命中就在页里展开，读不到会说明原因，不会看到我这边的页。
      </span>
      {state === "manual" && link ? (
        <textarea
          readOnly
          value={link}
          aria-label="事件固定链接（可手动选中复制）"
          data-testid="audE-link-fallback"
          className="min-h-[3rem] w-full min-w-0 break-all rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </div>
  );
}

/**
 * audG: the current reading question, in one shareable line — plus the path
 * this page really asked. Same three states as the other copy controls, and
 * the same rule that nothing here sends a request: the line is made of the
 * address and of the question already asked.
 */
export function FilterSummaryCopy({
  line,
  gate,
  rule,
}: {
  line: string | null;
  /** audQ: the derived availability and its sentence, from auditGates. */
  gate: Gate;
  /** audQ: the mount rule printed on the card, also from auditGates. */
  rule: string;
}): ReactNode {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const ready = gate.enabled && line !== null;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid="audG-filter-copy-block">
      <Button
        size="sm"
        outlined
        aria-label={FILTER_SUMMARY_COPY_LABEL}
        title={gate.title}
        data-testid="audG-filter-copy"
        disabled={!ready}
        aria-disabled={!ready}
        prefix={
          state === "copied" ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          )
        }
        onClick={() => {
          if (!ready || !line) return;
          void copyTextToClipboard(line).then((ok) => {
            setState(ok ? "copied" : "manual");
          });
        }}
      >
        {FILTER_SUMMARY_COPY_LABEL}
      </Button>
      <span className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite" data-testid="audG-filter-copy-status">
        {state === "copied" ? "筛选条件已复制" : state === "manual" ? "剪贴板不可用，这一行可以直接选中复制" : ""}
      </span>
      {/* audL: the mount rule is also said out loud, not only when the button
          is already off. A permanent control that explains itself once is
          cheaper than a probe wondering why nothing is there. */}
      <span className="min-w-0 basis-full break-words text-xs text-muted-foreground" data-testid="audG-filter-copy-rule">
        {rule}
      </span>
      {state === "manual" && line ? (
        <textarea
          readOnly
          value={line}
          aria-label="筛选条件摘要（可手动选中复制）"
          data-testid="audG-filter-copy-fallback"
          className="min-h-[3rem] w-full min-w-0 break-all rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </div>
  );
}

/**
 * audT — the chips for the filters that are on right now, directly under the
 * filter bar. The words come from the shared seat map and the keys the × deletes
 * come from the chip (see filterChips.ts), so this row cannot disagree with the
 * copied summary above it or with the address below it.
 *
 * The row is PERMANENT in the sense that it reads the address and not the
 * answer: it is there while a read is outstanding and there when a read was
 * refused, because 「现在按什么在读」 is a fact about the question. It is absent
 * only when nothing is on — no filter, no non-default size, no page beyond the
 * first — and then there is nothing to remove.
 */
export function AuditFilterChips({
  chips,
  onRemove,
}: {
  chips: AuditChip[];
  onRemove: (chip: AuditChip) => void;
}): ReactNode {
  if (chips.length === 0) return null;
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-2"
      data-testid="aud-filter-chips"
      role="group"
      aria-label="生效筛选"
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground"
          data-testid={`aud-chip-${chip.key}`}
          title={chip.title}
        >
          <span className="min-w-0 break-words">{chip.label}</span>
          {/* A real button, because a chip a keyboard person cannot remove is a filter they cannot leave. */}
          <button
            type="button"
            className="rounded-sm underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label={`移除「${chip.label}」`}
            onClick={() => onRemove(chip)}
            data-testid={`aud-chip-${chip.key}-clear`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

/**
 * aud8: the chips for the two handle filters. aud9 kept them (same ids) and
 * made the handles selectable: the chip is what a pasted `?actor=` /
 * `?resource=` looks like when no option in the pickers matches it, and its
 * 取消 is still the way out. The raw handle stays in the `title`, like every
 * other id on this surface.
 */
export function AuditUrlFilterChips({
  actor,
  resource,
  onClear,
}: {
  actor: string;
  resource: string;
  onClear: (key: "actor" | "resource") => void;
}): ReactNode {
  if (!actor && !resource) return null;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid="aud8-url-filters">
      {actor ? (
        <span
          className="flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground"
          data-testid="aud8-actor-chip"
          title={`地址栏带入的操作者句柄（原值 ${actor}）已作为 actorId 发给服务；实测该参数生效，但它只吃机器句柄，界面上不铺原始值`}
        >
          操作者已按句柄筛选
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => onClear("actor")}
            data-testid="aud8-actor-clear"
          >
            取消
          </button>
        </span>
      ) : null}
      {resource ? (
        <span
          className="flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground"
          data-testid="aud8-resource-chip"
          title={`地址栏带入的资源编号（原值 ${resource}）已作为 resourceId 发给服务；该参数由路由接受，但其过滤效果本环境未单独实测，条数以服务回答为准`}
        >
          资源已按编号筛选
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => onClear("resource")}
            data-testid="aud8-resource-clear"
          >
            取消
          </button>
        </span>
      ) : null}
    </div>
  );
}

/** 请求编号 has its own honest word: the answer simply did not carry one — the
 * same word the missing 时间 and the copied 结论行 use, so one absent field
 * never reads two different things on three surfaces. */
export const NO_REQUEST_ID = "该字段未返回";

/**
 * 请求编号 on the surface, copyable, and honest when it is missing: 「该字段未返回」
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

/**
 * audF: the state marker every panel carries. One label per phase, the same
 * words in all three surfaces, so 「列表说没能加载、预览说读取错误」 cannot
 * happen again, and a probe can pin one surface in one state without reading
 * source. It is visually hidden on purpose: the panel's own text already says
 * what is happening, and a second visible line would be noise.
 */
function StateMark({ slot, phase, sentence }: { slot: StateSlot; phase: StatePhase; sentence?: string | null }): ReactNode {
  // An empty node on purpose: the label lives in attributes so a state marker
  // can never change a panel's visible words — 403 and 404 must stay ONE body,
  // and a marker is not a sentence.
  return (
    <span
      aria-hidden="true"
      data-testid={stateMark(slot, phase)}
      data-audf-phase={phase}
      data-audf-slot={slot}
      data-audf-label={STATE_LABEL[phase]}
      data-aud-face={slot}
      data-aud-sentence={stateSentenceFor(phase, sentence)}
    />
  );
}

export function LoadingPanel({
  testId = "audit-loading",
  slot,
}: {
  testId?: string;
  /** audF: which surface is reading, for the shared state label. */
  slot?: StateSlot;
}): ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid={testId}>
      {slot ? <StateMark slot={slot} phase="loading" /> : null}
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
  slot,
}: {
  reason: string;
  nextStep: string;
  onRefresh: () => void;
  testId?: string;
  /**
   * audF: which surface is answering. This panel is ONLY the filtered empty —
   * a real answer of zero records to a real question. A read route that is not
   * here does not come through this panel at all (it is the denied/unwired
   * body), because zero records and no route are not the same statement.
   */
  slot?: StateSlot;
}): ReactNode {
  return (
    <Card className="border-border bg-card" data-testid={testId}>
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
        {slot ? <StateMark slot={slot} phase="empty" /> : null}
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
  slot,
}: {
  failure: FailureCopy;
  onRetry: () => void;
  title?: string;
  testId?: string;
  /** audF: which surface failed, for the shared state label. */
  slot?: StateSlot;
}): ReactNode {
  return (
    <Card
      role="alert"
      title={failure.technical ?? undefined}
      className="border-destructive/40 bg-destructive/5"
      data-testid={testId}
    >
      <CardContent className="flex min-w-0 flex-col items-start gap-2 px-4 py-6">
        {slot ? <StateMark slot={slot} phase="error" sentence={failure.sentence} /> : null}
        <div className="flex min-w-0 items-center gap-2 text-sm text-destructive">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{title}</span>
        </div>
        <p className="max-w-prose break-words text-xs text-muted-foreground" data-testid={`${testId}-sentence`}>
          {failure.sentence}
        </p>
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
  slot = "list",
  onRetry,
  retryLabel = "再读一次",
}: {
  failure: FailureCopy | null;
  testId?: string;
  /** audF: which surface was denied, for the shared state label. */
  slot?: StateSlot;
  /**
   * audF: a closed door is not a locked screen. The way out is one more read
   * of THIS read口 at the SAME address — the filters, the page and the folds
   * are all still in the URL — so a session that came back can be seen coming
   * back without reloading the app.
   */
  onRetry?: () => void;
  retryLabel?: string;
}): ReactNode {
  // audF: 403 and 404 stay ONE body. A 404 that names a missing route also
  // says the honest reason — without splitting the two codes apart.
  const unwired = unwiredReasonFor(failure?.status ?? null, failure?.technical ?? null);
  return (
    <Card
      role="alert"
      aria-label="审计事件不可用"
      title={unwired ?? undefined}
      className="border-border bg-card"
      data-testid={testId}
    >
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
        <StateMark slot={slot} phase="denied" sentence={DENIED_BODY_SENTENCE} />
        {/* audF: a missing route is also marked as 未接入, WITHOUT painting a
            number: 403 and 404 keep one body, and 「0 条」 never appears for a
            read口 that simply is not here. */}
        {unwired ? <StateMark slot={slot} phase="unwired" sentence={unwired} /> : null}
        <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={`min-w-0 break-words text-sm ${themedBody}`}>暂时无法查看审计事件</p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          {DENIED_BODY_SENTENCE}
        </p>
        <RequestIdLine requestId={failure?.requestId ?? null} testId={`${testId}-request-id`} />
        {onRetry ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid={`${testId}-retry-block`}>
            <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
              {retryLabel}
            </Button>
            <span className="min-w-0 break-words text-xs text-muted-foreground">筛选、页码与地址都还在原处</span>
          </div>
        ) : null}
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
  slot = "verify",
}: {
  failure: FailureCopy;
  onRetry: () => void;
  testId?: string;
  /** audF: which surface could not run its read. */
  slot?: StateSlot;
}): ReactNode {
  return (
    // No `title` here on purpose: the raw answer differs between a 403 and a
    // 404, and this body must not. The technical line is reachable collapsed.
    <Card
      role="status"
      className="border-border bg-card"
      data-testid={testId}
    >
      <CardContent className="flex min-w-0 flex-col items-start gap-2 px-4 py-8">
        <StateMark slot={slot} phase="unwired" />
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <ShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={`min-w-0 break-words ${themedBody}`}>本环境未启用</span>
        </div>
        <p className="max-w-prose break-words text-xs text-muted-foreground" data-testid={`${testId}-sentence`}>
          {failure.sentence}
        </p>
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
