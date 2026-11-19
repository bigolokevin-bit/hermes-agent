/**
 * audit view pieces — the ledger row, the event body, the window-check result.
 *
 * All three render the same funnel: every value is a sentence, a Beijing wall
 * clock, or a masked short code, and anything the service did not send shows
 * 「—」 with the reason in its `title`. Raw identifiers, digests, tenant ids,
 * event-type tokens and HTTP codes never reach the text of the page — they live
 * in `title` attributes and the collapsed 「技术详情」 disclosure.
 */
import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { copyTextToClipboard } from "@/lib/clipboard";
import { themedBody, themedChrome } from "@/lib/utils";
import type { AuditDetail, AuditRow, VerifyResult } from "./model";
import { TechnicalDisclosure } from "./states";

const MISSING_TIME = "服务未提供该时间";
const MISSING_VALUE = "服务未提供该信息";
/** 请求编号 has its own honest word: the answer simply did not carry one. */
export const NO_REQUEST_ID = "未提供";

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

/**
 * 请求编号 on the surface, copyable, and honest when it is missing: 「未提供」
 * with the reason in its `title`. An id is quoted to support, so it is shown in
 * full and allowed to wrap — `break-all` keeps a 32-character hex inside a
 * 375px column instead of pushing the page sideways.
 */
export function CopyValue({
  value,
  reason,
  label,
  testId,
}: {
  value: string | null;
  /** What to say instead when the service sent nothing. */
  reason: string;
  /** The field name, for the button's accessible label. */
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
  testId,
}: {
  row: AuditRow;
  selected: boolean;
  onOpen: () => void;
  /** `aud01-row-<key>` from the list page; every column test id hangs off it. */
  testId: string;
}): ReactNode {
  const cells = `aud01-cell-${row.key}`;
  return (
    <Card className={`border-border bg-card ${selected ? "ring-1 ring-primary/60" : ""}`} data-testid={testId}>
      <CardContent className="flex min-w-0 flex-col gap-2 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={onOpen}
            title={row.rawId ?? undefined}
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

        <TechnicalDisclosure
          testId={`${cells}-details`}
          label="详情"
          lines={[
            row.rawId ? `事件标识：${row.rawId}` : "",
            row.action.known ? "" : `事件类型原值：${row.action.raw ?? "未提供"}`,
            row.outcome.raw ? `结果原值：${row.outcome.raw}` : "",
            row.requestId ? "" : "请求编号：服务未回传",
          ]}
        />
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
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid={testId}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className={`min-w-0 flex-1 break-words text-sm ${themedBody}`} title={detail.rawId ?? undefined}>
          {detail.action.label}
        </h2>
        <Badge tone={detail.outcome.tone} title={detail.outcome.raw ?? undefined}>
          {detail.outcome.label}
        </Badge>
      </div>

      <Section title="事件">
        <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs">
          <Field
            label="发生时间"
            value={detail.occurredAt ?? "—"}
            reason={detail.occurredAt ? undefined : MISSING_TIME}
          />
          <Field
            label="记账时间"
            value={detail.recordedAt ?? "—"}
            reason={detail.recordedAt ? undefined : MISSING_TIME}
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
        <p className="min-w-0 break-words text-xs text-muted-foreground">以上时间均为北京时间，精确到分。</p>
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
            <Field label="变更前" value={detail.change.before?.trim() || "—"} reason={detail.change.before ? undefined : "服务未提供变更前的值"} />
            <Field label="变更后" value={detail.change.after?.trim() || "—"} reason={detail.change.after ? undefined : "服务未提供变更后的值"} />
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

      <TechnicalDisclosure testId={`${testId}-details`} label="技术详情" lines={lines} />
    </div>
  );
}

/** A count, honestly: 「—」 plus why, when the service did not give one. */
function countValue(value: number | null): string {
  return value === null ? "—" : `${value}`;
}

export function VerifyResultBody({
  result,
  askedFrom,
  askedTo,
  testId = "aud03-result",
}: {
  result: VerifyResult;
  /** The window the person asked for, already Beijing wall clock. */
  askedFrom: string | null;
  askedTo: string | null;
  testId?: string;
}): ReactNode {
  const from = result.windowFrom ?? askedFrom;
  const to = result.windowTo ?? askedTo;
  const scanned = countValue(result.scanned);
  const total = countValue(result.total);
  const broken = countValue(result.broken);
  const headline =
    result.verdict === "intact"
      ? "没有发现断点"
      : result.verdict === "broken"
        ? "发现对不上的地方"
        : "校验跑完了，但结论没说清楚";
  const tone = result.verdict === "intact" ? "success" : result.verdict === "broken" ? "destructive" : "secondary";
  const countsKnown = result.scanned !== null || result.total !== null || result.broken !== null;
  return (
    <div className="flex min-w-0 flex-col gap-3" data-testid={testId}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className={`min-w-0 flex-1 break-words text-sm ${themedBody}`}>时间窗完整性校验</h2>
        <Badge tone={tone}>{headline}</Badge>
      </div>

      <dl className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs" data-testid="aud03-counts">
        <Field
          testId="aud03-window"
          label="校验窗口（北京时间）"
          value={from && to ? `${from} 至 ${to}` : "服务未回窗口"}
          reason={from && to ? undefined : MISSING_VALUE}
        />
        <Field
          testId="aud03-scanned"
          label="已核对"
          value={result.total === null ? scanned : `${scanned} / ${total}`}
          reason={result.total === null ? "服务未说明这个窗口里一共有多少条" : "窗口内的总条数来自服务的回答"}
        />
        <Field
          testId="aud03-broken"
          label="对不上的"
          value={broken}
          reason={result.broken === null ? "服务没有给出对不上的条数" : undefined}
        />
      </dl>

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
