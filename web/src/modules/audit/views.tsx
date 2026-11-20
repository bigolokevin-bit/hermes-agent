/**
 * audit view pieces — the ledger row, the event body, the window-check result.
 *
 * All three render the same funnel: every value is a sentence, a Beijing wall
 * clock, or a masked short code, and anything the service did not send shows
 * 「—」 with the reason in its `title`. Raw identifiers, digests, tenant ids,
 * event-type tokens and HTTP codes never reach the text of the page — they live
 * in `title` attributes and the collapsed 「技术详情」 disclosure.
 */
import { type ReactNode, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { themedBody, themedChrome } from "@/lib/utils";
import type { AuditChange, AuditDetail, AuditRow, VerifyResult } from "./model";
import { beijingSeconds, maskSensitive } from "./model";
import { AUDJ_TIME_ZONE, auditActorView, auditTimeView } from "./timeActor";
import {
  TRUNC_CELL,
  TRUNC_COLLAPSE_LABEL,
  TRUNC_EXPAND_LABEL,
  TRUNC_LINE,
  joinTitles,
  truncatedView,
} from "./truncation";
import { AuditResourceCell, AuditResourceLink, CopyValue, DetailCopy, DeniedPanel, ErrorPanel, LoadingPanel, PermalinkCopy, SummaryCopy, TechnicalDisclosure } from "./states";
import { copyLinkGate } from "./auditGates";
import type { FailureCopy } from "./copy";
import { summaryFromDetail, summaryFromRow } from "./summary";

const MISSING_VALUE = "服务未提供该信息";
/** A change side that exists but is engineering text: pointed at the fold, not printed. */
const FOLDED_VALUE = "见「技术详情」";
const FOLDED_REASON = "变更内容是机器格式（字段名或原始 JSON），不放在人话层，已收进「技术详情」";

/**
 * One side of a change. Exactly three honest outcomes: a readable value, a
 * pointer to 「技术详情」 when the service's value was engineering text, and
 * 「—」 with the reason when nothing was sent. Never a field-name list.
 */
function changeSide(change: AuditChange, which: "before" | "after"): { value: string; reason?: string } {
  const text = change[which]?.trim();
  if (text) return { value: text };
  if (change.folded[which]) return { value: FOLDED_VALUE, reason: FOLDED_REASON };
  if (text === "") return { value: "（空值）" };
  return {
    value: "—",
    reason: which === "before" ? "服务未提供变更前的值" : "服务未提供变更后的值",
  };
}

/** A label/value pair that never overflows its column at 375px. */
/**
 * audO: one displayed value that may not fit the line.
 *
 * With `truncate` (the list's cells) the line shows a head slice, the full
 * value plus the honest omission count goes in `title`, and nothing else is
 * offered — the row already has enough handles. With `expandName` (the preview
 * and the record pane) the same line also gets a real button, because a
 * `title` cannot be reached by keyboard or on a touch screen.
 *
 * Expansion is local state, nothing more: it changes no filter, no page, no
 * address key and asks the service nothing. A value short enough to fit gets
 * no ellipsis and no button — no affordance that promises more than it has.
 */
function LongValue({
  value,
  limit,
  expandName,
  extraTitle,
  className,
}: {
  value: string;
  limit: number;
  /** Set when the line offers 展开全文; the button is `aud-trunc-toggle-<name>`. */
  expandName?: string;
  /** Anything the field already put in `title` (a raw id, a stated reason). */
  extraTitle?: string | null;
  className?: string;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const view = truncatedView(value, limit);
  if (!view.truncated) {
    return <span className={`min-w-0 break-words ${className ?? ""}`}>{value}</span>;
  }
  const shown = open ? value : view.shown;
  return (
    <>
      <span
        className={`min-w-0 ${open ? "break-words" : "truncate"} ${className ?? ""}`}
        data-testid="aud-trunc"
        data-aud-trunc-omitted={String(view.omitted)}
        data-aud-trunc-expanded={open ? "true" : "false"}
        title={joinTitles(view.title, extraTitle)}
      >
        {shown}
      </span>
      {expandName ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? `${TRUNC_COLLAPSE_LABEL}：这一条的完整值` : `${TRUNC_EXPAND_LABEL}：这一条的完整值`}
          title={open ? "收起这一条的完整值（筛选、页码与地址都不受影响）" : "展开这一条的完整值（筛选、页码与地址都不受影响）"}
          data-testid={`aud-trunc-toggle-${expandName}`}
          className="shrink-0 rounded-sm text-xs text-muted-foreground underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? TRUNC_COLLAPSE_LABEL : TRUNC_EXPAND_LABEL}
        </button>
      ) : null}
    </>
  );
}

function Field({
  label,
  value,
  reason,
  title,
  tone,
  testId,
  mark,
  truncate,
  expandName,
}: {
  label: string;
  value: string;
  /** Why the value is missing, or the raw value it stands for. */
  reason?: string;
  title?: string;
  tone?: ReactNode;
  testId?: string;
  /**
   * audJ: a probe locator for the SAME value this cell shows. It carries the
   * text and the `title` as attributes instead of a second visible line — the
   * screen must read the field once, and a comparison between surfaces has to
   * be able to see what each surface actually printed.
   */
  mark?: string;
  /** audO: the list口径 — one line, the whole value in `title`. */
  truncate?: boolean;
  /** audO: the preview/record口径 — one line, plus 展开全文. */
  expandName?: string;
}): ReactNode {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5" data-testid={testId}>
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-baseline gap-1.5 text-foreground" title={title ?? reason}>
        {truncate || expandName ? (
          <LongValue
            value={value}
            limit={expandName ? TRUNC_LINE : TRUNC_CELL}
            expandName={expandName}
            extraTitle={title ?? reason}
          />
        ) : (
          value
        )}
        {tone}
      </dd>
      {mark ? (
        <span
          aria-hidden="true"
          data-testid={mark}
          data-audj-value={value}
          data-audj-title={title ?? reason ?? ""}
        />
      ) : null}
    </div>
  );
}

/** A section heading that stays on one side of its column at any width. */
function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <section className="flex min-w-0 flex-col gap-1.5" aria-label={title}>
      <h3 className={`min-w-0 break-words text-xs text-muted-foreground ${themedChrome}`}>{title}</h3>
      {children}
    </section>
  );
}

export function AuditEventRowCard({
  row,
  selected,
  onOpen,
  techOpen,
  onToggleTech,
  testId,
}: {
  row: AuditRow;
  selected: boolean;
  onOpen: () => void;
  /** The technical fold is page-owned so only one row can hold it open at a time. */
  techOpen: boolean;
  onToggleTech: () => void;
  /** `aud01-row-<key>` from the list page; every column test id hangs off it. */
  testId: string;
}): ReactNode {
  const cells = `aud01-cell-${row.key}`;
  // audJ: one presentation for WHEN and WHO, shared by all three surfaces.
  const time = auditTimeView(row.occurredAtRaw, row.occurredAt);
  const actor = auditActorView(row.actor);
  // audO: one reading of the action label decides three things about this cell:
  // what it shows, what its title promises, and whether it clips at all.
  const action = truncatedView(row.action.label, TRUNC_CELL);
  const rawHandle = [row.action.raw, row.rawId].filter(Boolean).join(" · ") || undefined;
  // Every technical line is present, including the ones the service did not
  // send: a fold that can open onto nothing is indistinguishable from a dead
  // control, and the whole point of this cell is that it really expands.
  const techLines = [
    `事件标识：${row.rawId ?? "服务未回传"}`,
    `事件类型原值：${row.action.raw ?? "服务未回传"}`,
    `结果原值：${row.outcome.raw ?? "服务未回传"}`,
    `发生时间原值：${(row.occurredAtRaw ?? "").trim() || row.occurredAt || "服务未回传"}`,
    `发生时间（${AUDJ_TIME_ZONE}）：${time.text}`,
    `记账时间原值：${row.recordedAt ?? "服务未回传"}`,
    `请求编号：${row.requestId ?? "服务未回传"}`,
    `同一次操作原值：${row.correlation ?? "服务未回传"}`,
  ];
  return (
    <Card className={`border-border bg-card ${selected ? "ring-1 ring-primary/60" : ""}`} data-testid={testId}>
      <CardContent className="flex min-w-0 flex-col gap-2 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={onOpen}
            // audO: a short label is left in peace — no note, no count, no
            // promise of more text than there is. A long one gets one line, the
            // whole text in `title` and the counted omission next to it.
            title={joinTitles(action.truncated ? action.title : undefined, rawHandle) ?? rawHandle}
            className={`min-w-0 flex-1 text-left text-sm hover:underline ${action.truncated ? "truncate" : "break-words"}`}
            data-testid={`aud01-cell-${row.key}-type`}
            data-aud-trunc-omitted={action.truncated ? String(action.omitted) : undefined}
          >
            <span className={themedBody}>{action.truncated ? action.shown : row.action.label}</span>
          </button>
          <span data-testid={`aud01-cell-${row.key}-result`}>
            <Badge tone={row.outcome.tone} title={row.outcome.raw ?? undefined}>
              {row.outcome.label}
            </Badge>
          </span>
        </div>

        <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs">
          {/* audJ: the same two helpers the preview and the record pane call,
              so one event cannot be read at two different precisions on one
              screen, at the same precision, with the same missing word. */}
          <Field
            testId={`aud01-cell-${row.key}-time`}
            mark={`audJ-time-list-${row.key}`}
            label="时间（北京时间）"
            value={time.text}
            title={time.title}
          />
          <Field
            testId={`aud01-cell-${row.key}-actor`}
            mark={`audJ-actor-list-${row.key}`}
            label="操作者"
            value={actor.text}
            title={actor.title}
            truncate
          />
          <Field
            testId={`aud01-cell-${row.key}-object`}
            label="对象"
            value={row.resource.label}
            title={row.resource.raw ?? undefined}
            truncate
          />
          {/* R106: 关联资源 — the way out of the ledger, as a column. The 对象 line
           * above says what the event touched; this says where a person can go
           * read the thing itself, and it asks the same one table the preview and
           * the record pane ask, so the three faces cannot promise two different
           * destinations for one resource. The anchor replaces the value cell
           * rather than dressing up the label, and nothing here is fetched. */}
          <div className="flex min-w-0 flex-col gap-1" data-testid={`aud01-cell-${row.key}-resource`}>
            <dt className="shrink-0 text-muted-foreground">关联资源</dt>
            <dd className="min-w-0">
              <AuditResourceCell resource={row.resource} />
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1" data-testid={`aud01-cell-${row.key}-request-id`}>
            <dt className="shrink-0 text-muted-foreground">请求编号</dt>
            <dd className="min-w-0">
              <CopyValue
                value={row.requestId}
                reason="服务这次没有回传请求编号"
                label="请求编号"
                testId={`aud01-cell-${row.key}-request-value`}
              />
            </dd>
          </div>
        </dl>

        {/* audO: the 动作说明 is the value most likely to be a whole sentence.
            One line, the whole text in `title`, counted — the row is a card,
            not a document, and the fold already carries the rest. */}
        {row.reason ? (
          <p className="flex min-w-0 flex-wrap items-baseline gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0">原因：</span>
            <LongValue value={row.reason} limit={TRUNC_CELL} />
          </p>
        ) : null}

        {/* The whole cell toggles, not a 12px word inside it: a reviewer who
            clicks the 详情 cell must see the fold open (R19 tail b). */}
        <button
          type="button"
          onClick={onToggleTech}
          aria-expanded={techOpen}
          data-expanded={techOpen ? "true" : "false"}
          className="flex w-full min-w-0 items-center gap-1 text-left text-xs text-muted-foreground underline underline-offset-2"
          data-testid={`${cells}-details`}
        >
          {techOpen ? (
            <ChevronUp className="h-3 w-3 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
          )}
          技术详情
        </button>
        {techOpen ? (
          <div
            className="min-w-0 rounded-sm border border-border bg-muted/40 px-2 py-1.5"
            data-testid="aud01-row-tech-details"
          >
            <ul className="flex min-w-0 flex-col gap-0.5 break-words font-mono text-xs text-muted-foreground">
              {techLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** The record itself: seven human sections, no field names, one disclosure. */
export function AuditEventDetailBody({
  detail,
  testId = "audit-detail",
}: {
  detail: AuditDetail;
  testId?: string;
}): ReactNode {
  const lines = detail.technical.filter((line) => line);
  // audJ: the same two helpers as the list row and the inline preview.
  const occurred = auditTimeView(detail.occurredAtRaw, detail.occurredAt);
  const recorded = auditTimeView(detail.recordedAtRaw, detail.recordedAt);
  const who = auditActorView(detail.actor);
  const before = changeSide(detail.change, "before");
  const after = changeSide(detail.change, "after");
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid={testId}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <h2
          className={`min-w-0 flex-1 break-words text-sm ${themedBody}`}
          data-testid="audA-detail-type"
          title={[detail.action.raw, detail.rawId].filter(Boolean).join(" · ") || undefined}
        >
          {detail.action.label}
        </h2>
        <Badge tone={detail.outcome.tone} title={detail.outcome.raw ?? undefined}>
          {detail.outcome.label}
        </Badge>
      </div>

      <Section title="事件">
        <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs" data-testid="aud3-time">
          <Field
            testId="audA-detail-time"
            mark="audJ-time-detail"
            label="发生时间"
            value={occurred.text}
            title={occurred.title}
          />
          <Field
            label="记账时间"
            value={recorded.text}
            title={recorded.title}
          />
        </dl>
        <div className="flex min-w-0 flex-col gap-1 text-xs" data-testid={`${testId}-request-id`} data-auda-parity="rid">
          <span className="shrink-0 text-muted-foreground">请求编号</span>
          <CopyValue
            value={detail.requestId}
            reason="服务这次没有回传请求编号"
            label="请求编号"
            testId={`${testId}-request-value`}
          />
        </div>
        <p className="min-w-0 break-words text-xs text-muted-foreground">以上时间均为北京时间，精确到秒。</p>
        {/* audC: the 结论行, from the same builder the inline preview uses. */}
        <SummaryCopy line={summaryFromDetail(detail, beijingSeconds(detail.occurredAtRaw) ?? detail.occurredAt)} />

        {/* R121: the same event, as ONE line, copied from the record pane. The text
         * is built by a single helper (detailCopy.ts) out of the values the model
         * already parsed for THIS screen — 时间 · 操作者 · 动作 · 资源 · 同一次操作 —
         * so the words a person pastes cannot be a second, luckier reading of the
         * record. It sends nothing: a copy is not a reason to ask again. */}
        <DetailCopy event={detail} />
        {/* audE: the fixed link for this record, built from the identifier the
            answer itself carried — never from a guessed one. */}
        {/* audQ: availability comes from the same gates the ledger uses; a
            record that is on screen answered, so the link is for real. */}
        <PermalinkCopy eventId={detail.rawId} gate={copyLinkGate("ready", detail.rawId !== null)} />
      </Section>

      <Section title="操作者">
        <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs">
          <Field
            testId="audA-detail-actor"
            mark="audJ-actor-detail"
            label="谁"
            value={who.text}
            title={who.title}
            expandName="detail-actor"
          />
          {detail.actor.kindLabel ? <Field label="身份" value={detail.actor.kindLabel} /> : null}
          <Field label="所属工作区" value={detail.tenant.label} title={detail.tenant.raw ?? undefined} />
        </dl>
      </Section>

      <Section title="资源">
        <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs">
          <Field
            testId="audA-detail-resource"
            label="被操作的对象"
            value={detail.resource.label}
            title={detail.resource.raw ?? undefined}
            expandName="detail-resource"
          />
        </dl>
        {/* audW: the way out of the ledger to the resource itself. One table
         * (resourceLinks.ts) decides the href for both this pane and the inline
         * preview, and a type with no page says so instead of linking nowhere.
         * Read off the screen only: a link is never worth a request. Outside the
         * `dl` because a definition list holds terms and definitions, not anchors. */}
        <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
          <AuditResourceLink resource={detail.resource} />
        </p>
      </Section>

      <Section title="结果与原因">
        <p className="flex min-w-0 flex-wrap items-baseline gap-1.5 text-xs">
          <LongValue value={detail.outcome.label} limit={TRUNC_LINE} expandName="detail-outcome" />
        </p>
        <p className="flex min-w-0 flex-wrap items-baseline gap-1.5 text-xs text-muted-foreground">
          <LongValue
            value={detail.reason ?? (detail.outcome.kind === "failure" ? "服务没有说明失败原因。" : "这条记录没有额外原因。")}
            limit={TRUNC_LINE}
            expandName="detail-reason"
          />
        </p>
      </Section>

      {detail.change.present ? (
        <Section title="变更">
          <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs">
            <Field label="变更前" value={before.value} reason={before.reason} />
            <Field label="变更后" value={after.value} reason={after.reason} />
          </dl>
        </Section>
      ) : null}

      {detail.links.length ? (
        <Section title="关联">
          <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs">
            {detail.links.map((link) => (
              <Field key={`${link.noun}-${link.label}`} label={link.noun} value={link.label} title={link.raw ?? undefined} />
            ))}
          </dl>
        </Section>
      ) : null}

      <Section title="完整性">
        {detail.integrity.present ? (
          <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs">
            <Field label="本条摘要" value={detail.integrity.hash.label} title={detail.integrity.hash.raw ?? undefined} />
            <Field label="上一条摘要" value={detail.integrity.prevHash.label} title={detail.integrity.prevHash.raw ?? undefined} />
          </dl>
        ) : (
          <p className="min-w-0 break-words text-xs text-muted-foreground">这条记录没有带上完整性摘要，无法在这里判断它是否接得上前一条。</p>
        )}
      </Section>

      <Section title="原始载荷">
        {detail.rawPayload === null || detail.rawPayload === undefined ? (
          <p className="min-w-0 break-words text-xs text-warning" data-testid="aud3-payload-unavailable">
            证据不可用：这条事件的回答里没有带回原始载荷——审计只保存字段差异。可以去「技术详情」看服务回传的字段，或联系管理员核对。
          </p>
        ) : (
          (() => {
            const masked = maskSensitive(detail.rawPayload);
            const text = JSON.stringify(masked.value, null, 2).slice(0, 2000);
            return (
              <div className="flex min-w-0 flex-col gap-2" data-testid="aud3-payload">
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-2 text-xs" data-testid="aud3-payload-json">{text}</pre>
                <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="aud3-payload-masked">
                  {"已隐去 " + masked.masked + " 项敏感字段"}
                </p>
              </div>
            );
          })()
        )}
      </Section>

      <TechnicalDisclosure testId={`${testId}-details`} label="技术详情" lines={lines} />
    </div>
  );
}

/** A count, honestly: 「—」 plus why, when the service did not give one. */
function countValue(value: number | null): string {
  return value === null ? "—" : `${value}`;
}

/** The ids the counts block carries; the standalone pane hands in its own family. */
export interface VerifyCountIds {
  counts: string;
  window: string;
  scanned: string;
  broken: string;
}

const AUD03_IDS: VerifyCountIds = {
  counts: "aud03-counts",
  window: "aud03-window",
  scanned: "aud03-scanned",
  broken: "aud03-broken",
};

export function VerifyResultBody({
  result,
  askedFrom,
  askedTo,
  testId = "aud03-result",
  ids = AUD03_IDS,
}: {
  result: VerifyResult;
  /** The window the person asked for, already Beijing wall clock. */
  askedFrom: string | null;
  askedTo: string | null;
  testId?: string;
  ids?: VerifyCountIds;
}): ReactNode {
  const from = result.windowFrom ?? askedFrom;
  const to = result.windowTo ?? askedTo;
  const scanned = countValue(result.scanned);
  const total = countValue(result.total);
  const broken = countValue(result.broken);
  const counted = result.scanned;
  const nothingScanned = counted === 0;
  const countsKnown = result.scanned !== null || result.total !== null || result.broken !== null;
  const headline = nothingScanned
    ? "这一段没有核对到记录"
    : result.verdict === "intact"
      ? countsKnown
        ? "没有发现断点"
        : "结论没有带上核对范围"
      : result.verdict === "broken"
        ? countsKnown
          ? "发现对不上的地方"
          : "结论没有带上核对范围"
        : "校验跑完了，但结论没说清楚";
  const tone = nothingScanned
    ? "secondary"
    : countsKnown && result.verdict === "intact"
      ? "success"
      : countsKnown && result.verdict === "broken"
        ? "destructive"
        : "secondary";
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid={testId}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className={`min-w-0 flex-1 break-words text-sm ${themedBody}`}>时间窗完整性校验</h2>
        <Badge tone={tone}>{headline}</Badge>
      </div>

      <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs" data-testid={ids.counts}>
        <Field
          testId={ids.window}
          label="校验窗口（北京时间）"
          value={from && to ? `${from} 至 ${to}` : "服务未回窗口"}
          reason={from && to ? undefined : MISSING_VALUE}
        />
        <Field
          testId={ids.scanned}
          label="已核对"
          value={result.total === null ? scanned : `${scanned} / ${total}`}
          reason={result.total === null ? "服务未说明这个窗口里一共有多少条" : "窗口内的总条数来自服务的回答"}
        />
        <Field
          testId={ids.broken}
          label="对不上的"
          value={broken}
          reason={result.broken === null ? "服务没有给出对不上的条数" : undefined}
        />
      </dl>

      {nothingScanned ? (
        <p className="min-w-0 break-words text-xs text-warning">
          服务的回答里已核对 0 条：这不等于「完整」，只是这一段没有可核对的内容。
        </p>
      ) : null}

      {!countsKnown ? (
        <p className="min-w-0 break-words text-xs text-warning">
          服务回了一个结论，但没有带上任何条数，所以上面三格都只能写「—」。这个结论没法核对范围。
        </p>
      ) : null}

      {result.verdict === "unsure" ? (
        <p className="min-w-0 break-words text-xs text-warning">
          回答里没有可直接判断的结论，所以这里不下「完整」或「断了」的断言。请找管理员确认这个环境的校验服务是否真的跑完。
        </p>
      ) : null}

      {result.message ? <p className="min-w-0 break-words text-xs text-muted-foreground">服务附言：{result.message}</p> : null}

      <TechnicalDisclosure testId={`${testId}-details`} label="技术详情" lines={result.technical} />
    </div>
  );
}

/** R50: the inline preview a row opens in place - the same loaded row, no request. */
export function AuditRowPreview({
  row,
  testId,
  detailHref,
  record,
}: {
  row: AuditRow;
  testId: string;
  /**
   * audF: the record read this row's own 「打开详情」 answers, when it is the
   * record that is open. `null` means no read is attached to this preview, so
   * the preview says nothing about states it does not have.
   */
  record?: {
    phase: "idle" | "loading" | "ready" | "error" | "denied";
    failure: FailureCopy | null;
    onRetry: () => void;
  } | null;
  /**
   * aud8: where 「打开详情」 goes. The list passes a link that carries its own
   * reading state (window, type, cursor stack, folds) so returning lands back
   * on the same page; the default keeps the bare spelling for any other host.
   */
  detailHref?: (rawId: string) => string;
}): ReactNode {
  // audA: the preview and the detail must not speak two different values for
  // one field, so every line here takes its text from the SAME expression the
  // detail body uses: `beijingSeconds(raw) ?? beijing(raw)` for the instant
  // (seconds, with 服务未提供该时间 as the stated reason) and the same
  // CopyValue control, with the same missing-rid sentence, for 请求编号.
  const at = beijingSeconds(row.occurredAtRaw) ?? row.occurredAt;
  // audJ: the preview, the list row and the record pane all print through
  // these two calls, so one event has one reading everywhere.
  const time = auditTimeView(row.occurredAtRaw, row.occurredAt);
  const actor = auditActorView(row.actor);
  return (
    <div
      className="flex min-w-0 flex-col gap-1 rounded-md border border-border bg-card px-3 py-2 text-xs"
      data-testid={testId}
      role="region"
      aria-label="行内预览"
    >
      <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1">
        <span className="flex min-w-0 flex-wrap items-baseline gap-1.5" data-testid="audA-preview-type">
          <span className="text-muted-foreground">事件类型：</span>
          <LongValue value={row.action.label} limit={TRUNC_LINE} expandName="preview-action" />
        </span>
        <span
          className="flex min-w-0 flex-wrap items-baseline gap-1.5"
          data-testid="audA-preview-actor"
          title={actor.title}
        >
          <span className="text-muted-foreground">操作者：</span>
          <LongValue value={actor.text} limit={TRUNC_LINE} expandName="preview-actor" extraTitle={actor.title} />
        </span>
        <span aria-hidden="true" data-testid="audJ-actor-preview" data-audj-value={actor.text} data-audj-title={actor.title} />
        <span
          className="flex min-w-0 flex-wrap items-baseline gap-1.5"
          data-testid="audA-preview-resource"
          title={row.resource.raw ?? undefined}
        >
          <span className="text-muted-foreground">资源：</span>
          <LongValue
            value={row.resource.label}
            limit={TRUNC_LINE}
            expandName="preview-resource"
            extraTitle={row.resource.raw ?? undefined}
          />
        </span>
        <span
          className="min-w-0 break-words"
          data-testid={testId + "-time"}
          data-auda-parity="time"
          title={time.title}
        >
          <span className="text-muted-foreground">时间（北京时间）：</span>
          {time.text}
        </span>
        <span aria-hidden="true" data-testid="audJ-time-preview" data-audj-value={time.text} data-audj-title={time.title} />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-col gap-1" data-testid={testId + "-rid"}>
          <span className="text-muted-foreground">请求编号</span>
          <CopyValue
            value={row.requestId}
            reason="服务这次没有回传请求编号"
            label="请求编号"
            testId="audA-preview-rid"
          />
        </div>
        {row.rawId ? (
          <a
            className="rounded-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href={detailHref ? detailHref(row.rawId) : `/audit?detail=${encodeURIComponent(row.rawId)}`}
            data-testid={testId + "-open"}
          >
            打开详情
          </a>
        ) : null}
        {/* audW: the way out, next to the other way out. 打开详情 is the record
         * itself and 打开资源 is the thing the record acted on — both are exits
         * from the ledger, so they sit in one row, while the row above stays what
         * the event says. One table (resourceLinks.ts) decides the href for this
         * face and the record pane, so the two cannot promise different places; a
         * type with no page says so instead of linking nowhere. Nothing here is
         * worth a request: it is read off the row already on screen. */}
        <AuditResourceLink resource={row.resource} />
      </div>
      {/* audC: the same 结论行 the detail offers, built by the same function,
          so both legs copy one sentence for one event. */}
      <SummaryCopy line={summaryFromRow(row, at)} />
      {/* audE: and the same fixed link for the same record. */}
      {/* audQ: the preview's link follows the record read this row points at —
          while that read is outstanding, failed or refused the link is off here
          too, so the two legs can never disagree about one failure. */}
      <PermalinkCopy
        eventId={row.rawId}
        gate={copyLinkGate(record?.phase ?? "idle", row.rawId !== null)}
      />
      {/* audF: the state of the record read this row points at, in the same
          panels and the same sentences the record pane uses. */}
      {record && record.phase !== "idle" && record.phase !== "ready" ? (
        record.phase === "loading" ? (
          <LoadingPanel testId="audF-preview-loading" slot="preview" />
        ) : record.phase === "denied" ? (
          <DeniedPanel failure={record.failure} testId="audF-preview-denied" slot="preview" />
        ) : (
          <ErrorPanel
            failure={record.failure ?? { sentence: "这条事件的详情没能加载出来。", requestId: null, technical: null }}
            onRetry={record.onRetry}
            title="这条事件没能加载出来"
            testId="audF-preview-error"
            slot="preview"
          />
        )
      ) : null}
    </div>
  );
}

/** R51: the event-type distribution of the rows already in hand - no extra request. */
export function AuditTypeSummary({
  open,
  onToggle,
  groups,
  total,
  selected,
  onPick,
  testId = "aud7-types",
}: {
  open: boolean;
  onToggle: () => void;
  groups: { key: string; label: string; count: number }[];
  total: number;
  /** audD: the type the ledger is currently filtered by (its raw code). */
  selected: string;
  /** audD: picking a bucket is the type filter; picking the pressed one again clears it. */
  onPick: (code: string) => void;
  testId?: string;
}): ReactNode {
  if (total === 0) return null;
  return (
    <section
      className="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-card px-3 py-2"
      data-testid={testId}
      aria-label="事件类型分布"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-expanded={open}
          aria-controls={testId + "-panel"}
          data-testid={testId + "-toggle"}
          onClick={onToggle}
        >
          {open ? "收起事件类型分布" : "展开事件类型分布"}
        </button>
        <span
          className="min-w-0 break-words text-xs text-muted-foreground"
          data-testid="audI-scope-note"
          title={
            selected
              ? "已经按这一类筛选：这一份分布只有这一个桶，它数的是服务端在这一窗里回给本页的记录，不是整窗各类的原样分布"
              : "服务端没有按类型的聚合读口，也没有带回整窗总数；这一块数的是本页已加载的记录，放宽时间窗或翻页后按同一口径重算"
          }
        >
          按已加载的 {total} 条统计
          {selected ? "（已按这一类筛，所以只剩这一个桶）" : "（不是整窗全量：这一页读到几条就数几条）"}
        </span>
      </div>
      {open ? (
        <>
          <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="audD-filter-hint">
            点一个类型就按这个桶的类型去读（与时间窗、操作者、资源、页码一起组合），再点一次回到全部类型。下面的计数只数这一页已加载的记录。
          </p>
          <ul className="flex min-w-0 flex-col gap-1" id={testId + "-panel"} data-testid={testId + "-panel"}>
            {groups.map((group) => {
              const share =
                group.count >= total
                  ? 100
                  : Math.max(1, Math.min(99, Math.floor((group.count / total) * 100)));
              const active = group.key === selected;
              return (
                <li
                  key={group.key}
                  className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs"
                  data-testid={testId + "-row"}
                >
                  {/* audD: the bucket IS the filter. A real button, so Enter and
                      Space do what a click does, and `aria-pressed` says which
                      type the ledger is answering right now. The code the
                      button hands over is the same value the row was counted
                      under, so the count and the filter cannot disagree. */}
                  <button
                    type="button"
                    aria-pressed={active}
                    title={`按这一类去读（原值 ${group.key}）；再点一次回到全部类型`}
                    className={`min-w-0 flex-1 rounded-md px-1.5 py-1 text-left hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      active ? "border border-primary/60 text-foreground" : "text-muted-foreground"
                    }`}
                    data-testid={`audD-bucket-${group.key}`}
                    onClick={() => onPick(group.key)}
                    // audD: the keyboard reaches the same filter. preventDefault
                    // keeps the browser's own button activation from firing a
                    // second pick on the same keystroke.
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
                      event.preventDefault();
                      onPick(group.key);
                    }}
                  >
                    <span className="min-w-0 break-words">{group.label}</span>
                  </button>
                  <span className="shrink-0 font-mono" data-testid={testId + "-count"}>
                    {group.count}
                  </span>
                  <span className="shrink-0 text-muted-foreground" data-testid={testId + "-share"}>
                    {String(share) + "%"}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </section>
  );
}
