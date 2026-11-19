/**
 * audit view pieces — the ledger row, the event body, the window-check result.
 *
 * All three render the same funnel: every value is a sentence, a Beijing wall
 * clock, or a masked short code, and anything the service did not send shows
 * 「—」 with the reason in its `title`. Raw identifiers, digests, tenant ids,
 * event-type tokens and HTTP codes never reach the text of the page — they live
 * in `title` attributes and the collapsed 「技术详情」 disclosure.
 */
import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { themedBody, themedChrome } from "@/lib/utils";
import type { AuditChange, AuditDetail, AuditRow, VerifyResult } from "./model";
import { beijingSeconds, maskSensitive } from "./model";
import { CopyValue, TechnicalDisclosure } from "./states";

const MISSING_TIME = "服务未提供该时间";
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
function Field({
  label,
  value,
  reason,
  title,
  tone,
  testId,
}: {
  label: string;
  value: string;
  /** Why the value is missing, or the raw value it stands for. */
  reason?: string;
  title?: string;
  tone?: ReactNode;
  testId?: string;
}): ReactNode {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5" data-testid={testId}>
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground" title={title ?? reason}>
        {value}
        {tone}
      </dd>
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
  // Every technical line is present, including the ones the service did not
  // send: a fold that can open onto nothing is indistinguishable from a dead
  // control, and the whole point of this cell is that it really expands.
  const techLines = [
    `事件标识：${row.rawId ?? "服务未回传"}`,
    `事件类型原值：${row.action.raw ?? "服务未回传"}`,
    `结果原值：${row.outcome.raw ?? "服务未回传"}`,
    `发生时间原值：${row.occurredAt ?? "服务未回传"}`,
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
            title={[row.action.raw, row.rawId].filter(Boolean).join(" · ") || undefined}
            className="min-w-0 flex-1 break-words text-left text-sm hover:underline"
            data-testid={`aud01-cell-${row.key}-type`}
          >
            <span className={themedBody}>{row.action.label}</span>
          </button>
          <span data-testid={`aud01-cell-${row.key}-result`}>
            <Badge tone={row.outcome.tone} title={row.outcome.raw ?? undefined}>
              {row.outcome.label}
            </Badge>
          </span>
        </div>

        <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs">
          <Field
            testId={`aud01-cell-${row.key}-time`}
            label="时间（北京时间）"
            value={row.occurredAt ?? "—"}
            reason={row.occurredAt ? undefined : MISSING_TIME}
          />
          <Field testId={`aud01-cell-${row.key}-actor`} label="操作者" value={row.actor.label} title={row.actor.raw ?? undefined} />
          <Field testId={`aud01-cell-${row.key}-object`} label="对象" value={row.resource.label} title={row.resource.raw ?? undefined} />
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

        {row.reason ? <p className="min-w-0 break-words text-xs text-muted-foreground">原因：{row.reason}</p> : null}

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
  const before = changeSide(detail.change, "before");
  const after = changeSide(detail.change, "after");
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid={testId}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <h2
          className={`min-w-0 flex-1 break-words text-sm ${themedBody}`}
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
            label="发生时间"
            value={beijingSeconds(detail.occurredAtRaw) ?? detail.occurredAt ?? "—"}
            reason={beijingSeconds(detail.occurredAtRaw) || detail.occurredAt ? undefined : MISSING_TIME}
          />
          <Field
            label="记账时间"
            value={beijingSeconds(detail.recordedAtRaw) ?? detail.recordedAt ?? "—"}
            reason={beijingSeconds(detail.recordedAtRaw) || detail.recordedAt ? undefined : MISSING_TIME}
          />
        </dl>
        <div className="flex min-w-0 flex-col gap-1 text-xs" data-testid={`${testId}-request-id`}>
          <span className="shrink-0 text-muted-foreground">请求编号</span>
          <CopyValue
            value={detail.requestId}
            reason="服务这次没有回传请求编号"
            label="请求编号"
            testId={`${testId}-request-value`}
          />
        </div>
        <p className="min-w-0 break-words text-xs text-muted-foreground">以上时间均为北京时间，精确到秒。</p>
      </Section>

      <Section title="操作者">
        <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs">
          <Field label="谁" value={detail.actor.label} title={detail.actor.raw ?? undefined} />
          {detail.actor.kindLabel ? <Field label="身份" value={detail.actor.kindLabel} /> : null}
          <Field label="所属工作区" value={detail.tenant.label} title={detail.tenant.raw ?? undefined} />
        </dl>
      </Section>

      <Section title="资源">
        <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs">
          <Field label="被操作的对象" value={detail.resource.label} title={detail.resource.raw ?? undefined} />
        </dl>
      </Section>

      <Section title="结果与原因">
        <p className="min-w-0 break-words text-xs">{detail.outcome.label}</p>
        <p className="min-w-0 break-words text-xs text-muted-foreground">
          {detail.reason ?? (detail.outcome.kind === "failure" ? "服务没有说明失败原因。" : "这条记录没有额外原因。")}
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
export function AuditRowPreview({ row, testId }: { row: AuditRow; testId: string }): ReactNode {
  const at = beijingSeconds(row.occurredAtRaw) ?? row.occurredAt;
  return (
    <div
      className="flex min-w-0 flex-col gap-1 rounded-md border border-border bg-card px-3 py-2 text-xs"
      data-testid={testId}
      role="region"
      aria-label="行内预览"
    >
      <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1">
        <span className="min-w-0 break-words">
          <span className="text-muted-foreground">事件类型：</span>
          {row.action.label}
        </span>
        <span className="min-w-0 break-words">
          <span className="text-muted-foreground">操作者：</span>
          {row.actor.label}
        </span>
        <span className="min-w-0 break-words">
          <span className="text-muted-foreground">资源：</span>
          {row.resource.label}
        </span>
        <span className="min-w-0 break-words" data-testid={testId + "-time"} title={row.occurredAtRaw ?? undefined}>
          <span className="text-muted-foreground">时间（北京时间）：</span>
          {at ?? "该字段未返回"}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="min-w-0 break-words" data-testid={testId + "-rid"} title={row.requestId ?? undefined}>
          <span className="text-muted-foreground">请求编号：</span>
          {row.requestId ?? "该字段未返回"}
        </span>
        {row.rawId ? (
          <a className="underline" href={"/audit?detail=" + encodeURIComponent(row.rawId)} data-testid={testId + "-open"}>
            打开详情
          </a>
        ) : null}
      </div>
    </div>
  );
}
