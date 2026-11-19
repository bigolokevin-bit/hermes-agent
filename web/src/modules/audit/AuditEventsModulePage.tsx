/**
 * 审计事件列表 — screen 1 of the audit surface (T33, lane console-approvals).
 * Page-level id `agent-v2-page-audit`; its own test ids are `aud01-*`, the
 * detail drawer's are `aud02-*`, the window check's are `aud03-*`.
 *
 * Two real reads, one screen:
 *   `GET /agent-api/api/audit?limit=50[&action=&from=&to=&cursor=]`           the ledger
 *   `GET /agent-api/api/audit-detail?id=<eventId>`                             one record
 *
 * The 时间窗 and 事件类型 filters change the request (asserted in
 * `AuditEventsModulePage.test.tsx` and `api.test.ts`); the event-type filter
 * carries the code under the wire name `action` (a live probe showed `event_type`
 * is accepted but IGNORED). Every window choice is bounded because `require_any`
 * rejects an unfiltered scan (400 `console.missing_filter`), so there is no
 * 不限时间 option. The 操作者 filter is rendered 未接入 (GAP-06): the real
 * parameter (`actorId`) exists but only takes machine handles, and there is no
 * named-operator directory to build a person-readable picker from.
 *
 * What the list says (PRD 每字段口径):
 *   时间     北京时间到分，标签写明「（北京时间）」；服务没给时间就显示「—」并说明原因
 *   操作者   「姓名 · 8位短码」或「员工 · 短码」，没有归属就写「未指派」；
 *            `emp_…` / `human:1` / UUID 只做 `title`
 *   类型     已知动作给中文；不认识的按原样显示，绝不机翻成我们没得到的说法
 *   结果     成功 / 失败（被拒）/ 待完成，失败再带一句人话原因
 *   请求编号 可复制；服务没给就写「未提供」，不留空、不写 0
 *
 * The detail body has zero raw field names on screen; every technical value
 * collapses into 「技术详情」, closed by default (closed means those strings are
 * not in the DOM at all). 403 and 404 draw one identical denied body and never
 * leave rows above it. Fixture debt burn (R30): this pane no longer reads
 * `?state=` — every list/detail state below comes from a real read, so there is
 * no `data-fixture` badge to mistake for an answer.
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { ReceiptText, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Spinner } from "@nous-research/ui/ui/components/spinner";

import { DeniedPanel, EmptyPanel, ErrorPanel, InlineFailure, LoadingPanel, TechnicalDisclosure, VerifyUnavailablePanel } from "./states";
import { AuditEventDetailBody, AuditEventRowCard, VerifyResultBody } from "./views";
import { useAuditDetail, useAuditList, useAuditVerify } from "./useAuditData";
import type { FailureCopy } from "./copy";
import type { VerifyFailure } from "./copy";
import { eventTypeChoices } from "./model";
import type { ListFilters } from "./api";
import { DEFAULT_WINDOW, WINDOW_CHOICES, windowBounds, type WindowKey } from "./window";

/**
 * The 时间窗 filter is a set of named windows, not two date inputs: the choice
 * converts to the same two instants the verify pane sends, and the choice that
 * is on screen is the choice that goes on the wire.
 *
 * There is deliberately NO 不限时间 option: the list route is gated by
 * `require_any` (one of seven filters) and the probe returned HTTP 400
 * `console.missing_filter` for a request that carried only `limit`. An
 * unbounded scan is rejected by the service, so the control does not offer
 * one — every window choice always sends a real `from`+`to` pair.
 */
const WINDOW_FILTER_CHOICES = WINDOW_CHOICES;

const DEFAULT_WINDOW_FILTER: WindowKey = DEFAULT_WINDOW;

export function AuditFilterBar({
  windowChoice,
  eventType,
  onWindowChange,
  onEventTypeChange,
}: {
  windowChoice: WindowKey;
  eventType: string;
  onWindowChange: (next: WindowKey) => void;
  onEventTypeChange: (next: string) => void;
}): ReactNode {
  const choices = useMemo(() => eventTypeChoices(), []);
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-2" role="group" aria-label="审计事件筛选" data-testid="aud01-filters">
      <label className="flex min-w-0 flex-col gap-1 text-xs" htmlFor="aud01-filter-window">
        <span className="text-muted-foreground">时间窗</span>
        <select
          id="aud01-filter-window"
          data-testid="aud01-filter-window"
          className="h-8 min-w-0 max-w-40 rounded-md border border-border bg-transparent px-2 text-sm"
          value={windowChoice}
          onChange={(event) => onWindowChange(event.target.value as WindowKey)}
        >
          {WINDOW_FILTER_CHOICES.map((item) => (
            <option key={item.value} value={item.value}>
              {`时间窗：${item.label}`}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-0 flex-col gap-1 text-xs" htmlFor="aud01-filter-type">
        <span className="text-muted-foreground">事件类型</span>
        <select
          id="aud01-filter-type"
          data-testid="aud01-filter-type"
          className="h-8 min-w-0 max-w-56 rounded-md border border-border bg-transparent px-2 text-sm"
          value={eventType}
          onChange={(event) => onEventTypeChange(event.target.value)}
        >
          <option value="">全部事件类型</option>
          {choices.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      {/* A control we cannot make real WITHOUT showing engineering language:
          the live probe found `actorId` filters correctly, but it only accepts
          machine handles (`employee-api`), and there is no named-operator
          directory to build a person-readable picker from. A free-text handle
          box would put raw ids on the human layer (against the zero-engineering
          rule), so it stays 未接入 until a named-operator source exists. */}
      <span
        className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
        title="GAP-06：操作者筛选参数 actorId 实测存在且生效，但只接受机器句柄（如 employee-api），本环境没有可展示真名的操作者目录，故不做原始句柄输入框"
      >
        <select
          aria-label="操作者筛选（未接入）"
          className="h-8 min-w-0 max-w-40 rounded-md border border-border bg-transparent px-2 text-sm"
          disabled
          data-testid="aud01-filter-operator"
        >
          <option>操作者</option>
        </select>
        <Badge tone="secondary" title="GAP-06：操作者筛选未接入（缺真名目录，非缺参数）">
          未接入
        </Badge>
      </span>
    </div>
  );
}

export function AuditEventsModulePage(): ReactNode {
  const [params, setParams] = useSearchParams();
  // The URL owns the selected record, so a shared link opens the same event.
  const selected = params.get("id");

  const [windowChoice, setWindowChoice] = useState<WindowKey>(DEFAULT_WINDOW_FILTER);
  const [eventType, setEventType] = useState("");

  const filters = useMemo<ListFilters>(() => {
    // The window is never unbounded (see AuditFilterBar); each choice carries a
    // real from+to pair, so a bare `?limit=` scan that the service 400s is
    // never asked. An unchosen type drops the `action` parameter entirely.
    const bounds = windowBounds(windowChoice);
    return { action: eventType || null, from: bounds.from, to: bounds.to };
  }, [windowChoice, eventType]);

  // No `?state=` leg on this pane: a list or detail state is only what the
  // service answered. A missing route degrades through readFailure() to an
  // honest sentence plus the request id, never to sample rows.
  const list = useAuditList(null, filters);
  const detail = useAuditDetail(selected, null);
  const [unaddressable, setUnaddressable] = useState(false);
  // One row at a time owns the technical fold: the panel id stays unique and
  // clicking 详情 really expands something every time (R19 tail b).
  const [openTech, setOpenTech] = useState<string | null>(null);
  // The window check is a read the person asks for; it never runs on load and
  // it is not driven by `?state=` (that repro belongs to the aud03 pane).
  const verify = useAuditVerify(null);

  const openRow = useCallback(
    (rawId: string | null) => {
      setUnaddressable(rawId === null);
      const draft = new URLSearchParams(params);
      if (rawId === null) draft.delete("id");
      else draft.set("id", rawId);
      setParams(draft, { replace: true });
    },
    [params, setParams],
  );

  const closeDetail = useCallback(() => {
    setUnaddressable(false);
    const draft = new URLSearchParams(params);
    draft.delete("id");
    setParams(draft, { replace: true });
  }, [params, setParams]);

  const windowLabel = WINDOW_FILTER_CHOICES.find((item) => item.value === windowChoice)?.label ?? "最近 7 天";

  const statusLine = (() => {
    if (list.phase === "loading") return `正在读取审计事件（${windowLabel}）…`;
    if (list.phase === "empty") return "这个筛选条件里没有审计事件";
    if (list.phase === "denied") return "审计事件暂不可用";
    if (list.phase === "error") return "审计事件读取失败";
    return `已显示 ${list.rows.length} 条审计事件（${windowLabel}）${list.next ? "，下面还有更多" : ""}`;
  })();

  const drawer = (() => {
    if (unaddressable) {
      return (
        <InlineFailure
          failure={{
            sentence: "这条记录没有给出可打开的事件标识，详情读不到。请刷新列表后再试。",
            requestId: null,
            technical: null,
          }}
          action="详情没有打开"
          onRetry={list.reload}
          retryLabel="刷新列表"
          testId="aud02-detail-unaddressable"
        />
      );
    }
    if (!selected) {
      return (
        <Card className="border-border bg-card" data-testid="aud02-detail-pick">
          <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
            <ReceiptText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">还没有选中事件</p>
            <p className="max-w-prose break-words text-xs text-muted-foreground">
              点开左侧任意一条可以看到它当时的操作者、对象、结果与原因。要核对整段时间的链是否接得上，请用「完整性校验」。
            </p>
          </CardContent>
        </Card>
      );
    }
    if (detail.phase === "loading") {
      return <LoadingPanel testId="aud02-detail-loading" />;
    }
    if (detail.phase === "denied") {
      return <DeniedPanel failure={detail.failure} testId="aud02-detail-denied" />;
    }
    if (detail.phase === "error" || !detail.detail) {
      return (
        <ErrorPanel
          failure={detail.failure ?? { sentence: "这条事件的详情没能加载出来。", requestId: null, technical: null }}
          onRetry={detail.reload}
          title="这条事件没能加载出来"
          testId="aud02-detail-error"
        />
      );
    }
    return (
      <div className="flex min-w-0 flex-col gap-3">
        <AuditEventDetailBody detail={detail.detail} testId="aud02-detail" />
        <button
          type="button"
          onClick={closeDetail}
          className="self-start text-xs text-muted-foreground underline underline-offset-2"
          data-testid="aud02-detail-close"
        >
          收起这条事件
        </button>
      </div>
    );
  })();

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-3" data-testid="agent-v2-page-audit" data-page="audit">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite" data-testid="aud01-status">
          {statusLine}
        </p>
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 break-words text-xs text-muted-foreground">时间为北京时间</span>
          <Button
            size="sm"
            outlined
            onClick={() => verify.run(filters.from, filters.to)}
            disabled={verify.phase === "loading"}
            data-testid="aud01-verify"
            prefix={
              verify.phase === "loading" ? <Spinner className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />
            }
          >
            完整性校验
          </Button>
          {list.phase !== "denied" ? (
            <Button
              size="sm"
              outlined
              onClick={list.reload}
              disabled={list.phase === "loading"}
              data-testid="aud01-refresh"
              prefix={list.phase === "loading" ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
            >
              刷新
            </Button>
          ) : null}
        </div>
      </div>

      <AuditFilterBar
        windowChoice={windowChoice}
        eventType={eventType}
        onWindowChange={setWindowChoice}
        onEventTypeChange={setEventType}
      />

      {/* The window check lives on the list too, and it says exactly one of
          four things: asking, the real counts, 本环境未启用 + why + where, or a
          plain failure. A 404 route answers 「本环境未启用」, never a generic
          error — see the copy in copy.ts. */}
      {(() => {
        if (verify.phase === "loading") {
          return <LoadingPanel testId="aud01-verify-loading" />;
        }
        if (verify.phase === "ready" && verify.result) {
          return (
            <div data-testid="aud01-verify-result">
              <VerifyResultBody
                result={verify.result}
                askedFrom={null}
                askedTo={null}
                testId="aud01-verify-result-body"
              />
            </div>
          );
        }
        if (verify.phase === "unavailable") {
          const failure: FailureCopy =
            (verify.failure as VerifyFailure | null) ?? {
              sentence: "完整性校验此刻没有可用结果。",
              requestId: null,
              technical: null,
            };
          return (
            <VerifyUnavailablePanel
              failure={failure}
              onRetry={() => verify.run(filters.from, filters.to)}
              testId="aud01-verify-not-enabled"
            />
          );
        }
        if (verify.phase === "error") {
          return (
            <ErrorPanel
              failure={
                verify.failure ?? {
                  sentence: "校验回答的形状不对，这里没能读出结论。",
                  requestId: null,
                  technical: null,
                }
              }
              onRetry={() => verify.run(filters.from, filters.to)}
              title="完整性校验没能给出结果"
              testId="aud01-verify-error"
            />
          );
        }
        return null;
      })()}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <section className="flex min-w-0 flex-col gap-2" aria-label="审计事件列表">
          {list.phase === "loading" ? <LoadingPanel testId="aud01-loading" /> : null}

          {list.phase === "denied" ? (
            <DeniedPanel failure={list.failure} testId="aud01-denied" />
          ) : null}

          {list.phase === "error" && list.failure ? (
            <ErrorPanel
              failure={list.failure}
              onRetry={list.reload}
              testId="aud01-error"
            />
          ) : null}

          {list.phase === "empty" ? (
            <EmptyPanel
              reason="按现在的筛选条件，这个时间窗里没有审计事件"
              nextStep="把时间窗放宽一格，或换一种事件类型再看。这个窗口确实没有记录，本身就是筛选后的真实答案——服务不接受不带任何筛选条件的全表扫描，所以这里始终有一个时间窗。"
              onRefresh={list.reload}
              testId="aud01-empty"
            />
          ) : null}

          {list.phase === "ready" ? (
            <>
              {list.rows.map((row) => (
                <AuditEventRowCard
                  key={row.key}
                  row={row}
                  selected={row.rawId !== null && row.rawId === selected}
                  onOpen={() => openRow(row.rawId)}
                  techOpen={openTech === row.key}
                  onToggleTech={() => setOpenTech((current) => (current === row.key ? null : row.key))}
                  testId={`aud01-row-${row.key}`}
                />
              ))}

              {list.unreadable > 0 ? (
                <p className="min-w-0 break-words text-xs text-warning">
                  有 {list.unreadable} / {list.rows.length + list.unreadable} 条记录缺少可显示的内容，未列在上面。
                </p>
              ) : null}

              {list.pageFailure ? (
                <InlineFailure failure={list.pageFailure} action="后续记录没有加载成功" onRetry={list.loadMore} testId="aud01-page-failure" />
              ) : null}

              {list.next ? (
                <div>
                  <Button
                    size="sm"
                    outlined
                    disabled={list.loadingMore}
                    onClick={list.loadMore}
                    data-testid="aud01-load-more"
                    prefix={list.loadingMore ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  >
                    加载更多
                  </Button>
                </div>
              ) : list.rows.length > 0 ? (
                <p className="text-xs text-muted-foreground">这一页就这些了。</p>
              ) : null}

              {/* The technical lines of a page as a whole: what was asked, what came back. */}
              <TechnicalDisclosure
                testId="aud01-tech-details"
                label="技术详情"
                lines={[
                  `本页读取条数：${list.rows.length + list.unreadable}`,
                  `筛选条件：${filters.action ? `action=${filters.action}` : "action 未带"}`,
                  `时间窗：${filters.from && filters.to ? `${filters.from} → ${filters.to}` : "未带"}`,
                  list.next ? "" : "服务端没有再给下一页的游标",
                ]}
              />
            </>
          ) : null}
        </section>

        <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start" aria-label="事件详情">
          {drawer}
        </aside>
      </div>
    </div>
  );
}

export default AuditEventsModulePage;
