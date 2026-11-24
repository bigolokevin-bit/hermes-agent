/**
 * 数据保留与清理 — /system?tab=retention 的只读面 (ret4-*).
 *
 * The page owns no write path. It reads one route (`RETENTION_PATH`) and tells
 * the truth about what came back:
 *   loading  skeleton, no numbers
 *   unwired  the route does not exist on this deployment → four areas are listed,
 *            each marked 未接入 with the reason; every field reads `—` (never 0)
 *   ready    the service answered with per-area rows (read defensively; a field
 *            it did not carry is `—` with its reason)
 *   error    a nameable failure: human sentence + copyable request id + retry
 *   denied   403/404 → ONE body for both, no area data in front of it
 *
 * 「立即清理」/「修改策略」 are declared write-shaped actions: rendered as real
 * buttons that are `disabled` + `aria-disabled` + `data-planned` and carry the
 * reason in `title`. They cannot run, and the page never reports a fake success.
 *
 * R32 fixture debt burn: the `?state=` repro leg was removed. No retention or
 * clean-up route exists on this deployment (eight candidates probed 404
 * `console.unknown_route`), so the honest screen is 「未接入」 with its reason —
 * never a painted 保留天数 table.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { CalendarClock, Database, Gauge, HardDrive, Inbox, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { fetchJSON } from "@/lib/api";
import { themedBody } from "@/lib/utils";

import {
  FIELD_REASON,
  GAP,
  PLANNED_ACTIONS,
  RETENTION_PATH,
  SECTIONS,
  UNWIRED_REASON,
  beijingMinute,
  failureSentence,
  formatBytes,
  occupancyShare,
  probeOf,
  readRetention,
  unwiredSections,
  type SectionKey,
  type SectionRow,
} from "./retention";
import { LoadingPanel, RequestIdLine, TechnicalDisclosure } from "./states";

export type Phase = "loading" | "ready" | "empty" | "unwired" | "error" | "denied";

interface Failure {
  status: number;
  requestId: string | null;
  technical: string | null;
  code: string | null;
}

interface Read {
  phase: Phase;
  sections: SectionRow[];
  asOf: string | null;
  failure: Failure | null;
  /** The path and status of the last probe — for the 技术详情 fold only. */
  probe: string;
}

const PENDING: Read = { phase: "loading", sections: [], asOf: null, failure: null, probe: RETENTION_PATH };
const EMPTY_PREVIEW: Read = { phase: "empty", sections: [], asOf: null, failure: null, probe: "preview" };

/** R41: the preview reproduces the state surface, never a sample policy. */
const FORCED_STATES = new Set(["loading", "empty", "error", "ready"] as const);
type ForcedState = "loading" | "empty" | "error" | "ready";

function readForced(value: string | null): ForcedState | null {
  const next = (value ?? "").trim().toLowerCase();
  return (FORCED_STATES as Set<string>).has(next) ? (next as ForcedState) : null;
}

/** One labelled field; a missing value is `—` with the reason in `title`. */
function Field({
  label,
  value,
  reason,
  testId,
}: {
  label: string;
  value: string | null;
  reason: string;
  testId: string;
}): ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-testid={testId}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`m-0 min-w-0 break-words text-sm ${value === null ? "text-muted-foreground" : themedBody}`}
        data-missing={value === null ? "true" : undefined}
        title={value === null ? reason : undefined}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

function SectionCard({ row }: { row: SectionRow }): ReactNode {
  const last = beijingMinute(row.lastCleanup);
  const next = beijingMinute(row.nextRun);
  const used = formatBytes(row.usedBytes);
  const limit = formatBytes(row.limitBytes);
  const share = occupancyShare(row.usedBytes, row.limitBytes);
  const reason = row.unwired ? row.note : FIELD_REASON;
  return (
    <article
      className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-4"
      data-testid={`ret4-section-${row.key}`}
      data-state={row.unwired ? "unwired" : "ready"}
    >
      <header className="flex min-w-0 flex-wrap items-center gap-2">
        <Database className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className={`m-0 min-w-0 break-words text-sm font-semibold ${themedBody}`}>{row.label}</h2>
        {row.unwired ? (
          <span
            className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground"
            data-testid={`ret4-unwired-${row.key}`}
            title={`${GAP}：${row.note}`}
          >
            未接入
          </span>
        ) : null}
      </header>
      <dl className="m-0 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Field
          label="保留天数"
          value={row.days === null ? null : `${row.days} 天`}
          reason={reason}
          testId={`ret4-days-${row.key}`}
        />
        <Field label="最近清理（北京时间）" value={last} reason={reason} testId={`ret4-last-${row.key}`} />
        <Field label="下次执行（北京时间）" value={next} reason={reason} testId={`ret4-next-${row.key}`} />
        <Field label="当前占用" value={used} reason={reason} testId={`ret4-used-${row.key}`} />
        <Field label="阈值" value={limit} reason={reason} testId={`ret4-limit-${row.key}`} />
        <Field
          label="占用比例"
          value={share === null ? null : `${share}%`}
          reason={reason}
          testId={`ret4-share-${row.key}`}
        />
      </dl>
      {row.usedBytes !== null && row.limitBytes !== null && row.limitBytes > 0 ? (
        row.usedBytes > row.limitBytes ? (
          <p className="m-0 break-words text-xs text-destructive" data-testid={`ret4-over-${row.key}`}>
            已超限：占用比阈值多 {formatBytes(row.usedBytes - row.limitBytes) ?? "—"}，请处理后再看下一轮清理。
          </p>
        ) : row.usedBytes === row.limitBytes ? (
          <p className="m-0 break-words text-xs text-amber-600" data-testid={`ret4-over-${row.key}`}>
            已达阈值：占用正好等于阈值，下一轮清理前请留意。
          </p>
        ) : null
      ) : null}
      {row.note ? (
        <p className="m-0 max-w-prose break-words text-xs text-muted-foreground" data-testid={`ret4-note-${row.key}`}>
          {row.note}
        </p>
      ) : null}
    </article>
  );
}

/**
 * AU-03③: the audit↔retention link. The list refuses an entirely-expired
 * custom range before it asks — but only ever off a horizon the ledger really
 * answered. This section says, on the retention face itself, whether that link
 * is live, reading the SAME audit days the section card already shows. When
 * there is no day count it says so (未接入) and states that nothing is blocked
 * — it never hands the list a number to fake.
 */
function RetentionWindowLink({ auditRow }: { auditRow: SectionRow | undefined }): ReactNode {
  const wired = auditRow !== undefined && !auditRow.unwired && auditRow.days !== null;
  return (
    <Card className="border-border bg-card" data-testid="ret4-window-link" data-state={wired ? "ready" : "unwired"}>
      <CardContent className="flex min-w-0 items-start gap-2 px-4 py-3">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {wired ? (
          <p className="m-0 max-w-prose break-words text-xs text-muted-foreground" data-testid="ret4-window-link-text">
            审计事件保留 {auditRow?.days} 天。事件列表的时间窗已与此联动：整段早于保留线的自定义区间会在发出请求前本地拦下，并写明「该时间窗超出保留期（{auditRow?.days} 天）」，不拿它去换一屏空表。
          </p>
        ) : (
          <p className="m-0 max-w-prose break-words text-xs text-muted-foreground" title={`${GAP}：${auditRow?.note ?? UNWIRED_REASON}`} data-testid="ret4-window-link-text">
            保留天数没有读到，这一联动按未接入处理：事件列表不猜天数、也不拦任何时间窗（绝不硬编码假 7 天）。天数一旦接通，链接自动生效。
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PlannedActions(): ReactNode {
  return (
    <Card className="border-border bg-card" data-testid="ret4-planned">
      <CardContent className="flex min-w-0 flex-col gap-2 px-4 py-4">
        <h2 className={`m-0 min-w-0 break-words text-sm font-semibold ${themedBody}`}>需要写入的动作</h2>
        <p className="m-0 max-w-prose break-words text-xs text-muted-foreground">
          这一页只读：清理与改策略都要写入，控制台还没有接通执行面，所以下面两个按钮只占位、不可点，也不会报告成功。
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {PLANNED_ACTIONS.map((action) => (
            <span key={action.id} className="inline-flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                disabled
                aria-disabled="true"
                data-planned="true"
                title={action.reason}
                data-testid={`ret4-planned-${action.id}`}
                className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground"
              >
                {action.id === "cleanup" ? <HardDrive className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {action.id === "policy" ? <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {action.label}
              </button>
              <span className="rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground">规划中</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DeniedPanel({ requestId }: { requestId: string | null }): ReactNode {
  return (
    <Card
      role="alert"
      aria-label="数据保留与清理不可用"
      className="border-border bg-card"
      data-testid="ret4-denied"
    >
      <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
        <ShieldAlert className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className={`m-0 min-w-0 break-words text-sm ${themedBody}`}>暂时看不到数据保留与清理</p>
        <p className="m-0 max-w-prose break-words text-xs text-muted-foreground">
          这块内容要么尚未对你开放，要么当前环境还没有提供它。这里不会显示任何猜测的保留天数、清理时间或占用。
          需要查看或调整保留策略时，请联系工作区管理员。
        </p>
        <RequestIdLine requestId={requestId} testId="ret4-denied-request-id" />
      </CardContent>
    </Card>
  );
}

function ErrorPanel({
  failure,
  onRetry,
}: {
  failure: Failure | null;
  onRetry: () => void;
}): ReactNode {
  return (
    <Card
      role="alert"
      title={failure?.technical ?? undefined}
      className="border-destructive/40 bg-destructive/5"
      data-testid="ret4-error"
    >
      <CardContent className="flex min-w-0 flex-col items-start gap-2 px-4 py-6">
        <div className="flex min-w-0 items-center gap-2 text-sm text-destructive">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">数据保留与清理没能读出来</span>
        </div>
        <p className="m-0 max-w-prose break-words text-xs text-muted-foreground">
          {failureSentence(failure?.status ?? -1)}
        </p>
        <RequestIdLine requestId={failure?.requestId ?? null} testId="ret4-error-request-id" />
        {failure?.technical ? (
          <TechnicalDisclosure lines={[failure.technical]} testId="ret4-error-details" />
        ) : null}
        <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />} data-testid="ret4-error-retry">
          重试
        </Button>
      </CardContent>
    </Card>
  );
}

export function RetentionModulePage(): ReactNode {
  const [sp, setSp] = useSearchParams();
  const forced = readForced(sp.get("state"));
  const forcedRid = (sp.get("rid") ?? "").trim() || null;
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<Read>(PENDING);

  const retry = useCallback(() => {
    if (forced) {
      const next = new URLSearchParams(sp);
      next.delete("state");
      setSp(next, { replace: true });
    }
    setAttempt((value) => value + 1);
  }, [forced, setSp, sp]);

  useEffect(() => {
    let alive = true;
    if (forced === "loading") {
      setRead(PENDING);
      return () => { alive = false; };
    }
    if (forced === "empty") {
      setRead(EMPTY_PREVIEW);
      return () => { alive = false; };
    }
    if (forced === "error") {
      setRead({
        phase: "error",
        sections: [],
        asOf: null,
        failure: { status: -1, requestId: forcedRid ?? "preview-request", technical: null, code: null },
        probe: "preview",
      });
      return () => { alive = false; };
    }
    setRead(PENDING);
    void fetchJSON<unknown>(RETENTION_PATH, undefined, { allowUnauthorized: true })
      .then((payload) => {
        if (!alive) return;
        const answer = readRetention(payload);
        if (answer === null) {
          setRead({
            phase: "error",
            sections: [],
            asOf: null,
            failure: { status: -1, requestId: null, technical: "unexpected payload shape", code: null },
            probe: `${RETENTION_PATH} -> 200 (shape)`,
          });
          return;
        }
        setRead({
          phase: answer.answered.length === 0 ? "unwired" : "ready",
          sections: answer.sections,
          asOf: answer.asOf,
          failure: null,
          probe: `${RETENTION_PATH} -> 200`,
        });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const outcome = probeOf(err);
        setRead({
          phase: outcome.kind,
          sections: outcome.kind === "unwired" ? unwiredSections() : [],
          asOf: null,
          failure: { status: outcome.status, requestId: outcome.requestId, technical: outcome.technical, code: outcome.code },
          probe: `${RETENTION_PATH} -> ${outcome.status}${outcome.code ? ` ${outcome.code}` : ""}`,
        });
      });
    return () => {
      alive = false;
    };
  }, [attempt, forced, forcedRid]);

  const answered = read.sections.filter((row) => !row.unwired).length;
  const total = SECTIONS.length;
  const summary =
    read.phase === "empty"
      ? "当前没有可展示的保留策略记录。"
      : read.phase === "unwired"
      ? `${total} 个区块都未接入：这个环境没有可读的保留策略源。`
      : read.phase === "ready"
        ? `已接入 ${answered} / ${total} 个区块${read.asOf ? "" : "；服务的回答没有带读取时刻"}`
        : null;
  const stamp = beijingMinute(read.asOf);

  return (
    <div
      className="flex min-w-0 flex-col gap-4"
      data-testid="ret4-page"
      data-page="retention"
    >
      <header className="flex min-w-0 flex-col gap-1">
        <h1 className={`m-0 min-w-0 break-words text-xl font-semibold ${themedBody}`}>数据保留与清理</h1>
        <p className="m-0 max-w-prose break-words text-xs text-muted-foreground">
          这一页只读：保留天数、清理时间与占用都按服务给出的原样显示，控制台不自算汇总，取不到就记未接入。
        </p>
      </header>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          size="sm"
          outlined
          onClick={retry}
          disabled={read.phase === "loading"}
          aria-busy={read.phase === "loading"}
          prefix={<RefreshCw className="h-3.5 w-3.5" />}
          data-testid="ret4-refresh"
        >
          重新读取
        </Button>
        {summary ? (
          <p className="m-0 min-w-0 break-words text-xs text-muted-foreground" data-testid="ret4-summary">
            {summary}
            {read.asOf ? (
              <span className="ml-2" data-testid="ret4-asof">
                读取于 {stamp ?? "—"}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      {read.phase === "empty" ? (
        <Card className="border-border bg-card" data-testid="ret4-empty">
          <CardContent className="flex min-w-0 flex-col items-start gap-2 px-4 py-8">
            <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <p className={`m-0 min-w-0 break-words text-sm ${themedBody}`}>当前没有可展示的保留策略记录。</p>
            <p className="m-0 max-w-prose break-words text-xs text-muted-foreground">
              这只表示本次没有读到记录，不代表保留天数是 0，也不代表没有数据需要清理。
            </p>
          </CardContent>
        </Card>
      ) : null}

      {read.phase === "loading" ? <LoadingPanel testId="ret4-loading" /> : null}
      {read.phase === "denied" ? <DeniedPanel requestId={read.failure?.requestId ?? null} /> : null}
      {read.phase === "error" ? <ErrorPanel failure={read.failure} onRetry={retry} /> : null}

      {read.phase === "unwired" ? (
        <Card className="border-border bg-card" data-testid="ret4-unwired-note">
          <CardContent className="flex min-w-0 items-start gap-2 px-4 py-3">
            <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="m-0 max-w-prose break-words text-xs text-muted-foreground" title={`${GAP}：${UNWIRED_REASON}`}>
              {UNWIRED_REASON}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {read.phase === "unwired" || read.phase === "ready" ? (
        <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2" data-testid="ret4-sections">
          {read.sections.map((row) => (
            <SectionCard key={row.key as SectionKey} row={row} />
          ))}
        </div>
      ) : null}

      {read.phase === "unwired" || read.phase === "ready" ? (
        <RetentionWindowLink auditRow={read.sections.find((row) => row.key === "audit")} />
      ) : null}

      {read.phase === "ready" || read.phase === "unwired" ? <PlannedActions /> : null}

      <TechnicalDisclosure
        lines={[
          `读取路径：${read.probe}`,
          `缺口：${GAP}`,
          `区块来源：${read.sections.map((row) => `${row.label}=${row.unwired ? "未接入" : "已接入"}`).join("；")}`,
        ]}
        testId="ret4-tech-details"
      />
    </div>
  );
}

export default RetentionModulePage;