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
 * no fixture badge to mistake for an answer.
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Download, ReceiptText, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Spinner } from "@nous-research/ui/ui/components/spinner";

import { DeniedPanel, EmptyPanel, ErrorPanel, InlineFailure, LoadingPanel, TechnicalDisclosure, VerifyUnavailablePanel } from "./states";
import { AuditEventDetailBody, AuditEventRowCard, VerifyResultBody, AuditRowPreview, AuditTypeSummary } from "./views";
import RetentionModulePage from "./RetentionModulePage";
import { useAuditDetail, useAuditList, useAuditVerify } from "./useAuditData";
import type { FailureCopy } from "./copy";
import type { VerifyFailure } from "./copy";
import { eventTypeChoices } from "./model";
import type { ListFilters } from "./api";
import { downloadCsv, downloadText, exportName, filteredCsvText, filteredExportName } from "./csv";
import {
  FILTER_WINDOW_CHOICES,
  beijingInputValue,
  customBounds,
  filterWindowOf,
  parseBeijingInput,
  windowBounds,
  type FilterWindowKey,
} from "./window";

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
const WINDOW_FILTER_CHOICES = FILTER_WINDOW_CHOICES;

/**
 * aud8: a new question or a new page is a new answer set, so the cursor stack
 * and the two inline folds are dropped together. The folds survive the trip
 * into 详情 and back (that URL history is untouched); they do not survive a
 * changed filter, because a row opened under the wider question may not even
 * be on screen any more.
 */
function resetPagingAndFolds(draft: URLSearchParams): void {
  draft.delete("cursor");
  draft.delete("preview");
  draft.delete("tech");
}

export function AuditFilterBar({
  windowChoice,
  customFrom,
  customTo,
  customInvalid,
  eventType,
  onWindowChange,
  onCustomFrom,
  onCustomTo,
  onEventTypeChange,
}: {
  windowChoice: FilterWindowKey;
  customFrom: string;
  customTo: string;
  customInvalid: boolean;
  eventType: string;
  onWindowChange: (next: FilterWindowKey) => void;
  onCustomFrom: (next: string) => void;
  onCustomTo: (next: string) => void;
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
          onChange={(event) => onWindowChange(event.target.value as FilterWindowKey)}
        >
          {WINDOW_FILTER_CHOICES.map((item) => (
            <option key={item.value} value={item.value}>
              {`时间窗：${item.label}`}
            </option>
          ))}
        </select>
      </label>

      {windowChoice === "custom" ? (
        <div className="flex min-w-0 flex-wrap items-end gap-2" data-testid="aud01-custom-window">
          <label className="flex min-w-0 flex-col gap-1 text-xs" htmlFor="aud01-custom-from">
            <span className="text-muted-foreground">开始（北京时间）</span>
            <input
              id="aud01-custom-from"
              data-testid="aud01-custom-from"
              type="datetime-local"
              className="h-8 min-w-0 rounded-md border border-border bg-transparent px-2 text-sm"
              value={customFrom}
              onChange={(event) => onCustomFrom(event.target.value)}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs" htmlFor="aud01-custom-to">
            <span className="text-muted-foreground">结束（北京时间）</span>
            <input
              id="aud01-custom-to"
              data-testid="aud01-custom-to"
              type="datetime-local"
              className="h-8 min-w-0 rounded-md border border-border bg-transparent px-2 text-sm"
              value={customTo}
              onChange={(event) => onCustomTo(event.target.value)}
            />
          </label>
          {customInvalid ? (
            <p className="min-w-0 break-words text-xs text-warning" data-testid="aud01-custom-error">
              自定义时间窗需要两栏都填好，且开始早于结束；在那之前不会去读。
            </p>
          ) : null}
        </div>
      ) : null}

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

      {/* aud8: same honesty for 资源. The route names `resourceId` as one of
          its seven accepted filters, but this environment never probed what it
          filters by (DONE.md gap list) and there is no resource directory to
          pick a real id from — so no picker is offered, while a `?resource=`
          handed over in the address is passed through verbatim below. */}
      <span
        className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
        title="resourceId 由该路由的 400 体点名为可接受筛选，但本环境未单独验证其过滤效果，也没有可挑选的资源目录；不做假下拉"
      >
        <select
          aria-label="资源筛选（未接入）"
          className="h-8 min-w-0 max-w-40 rounded-md border border-border bg-transparent px-2 text-sm"
          disabled
          data-testid="aud8-filter-resource"
        >
          <option>资源</option>
        </select>
        <Badge tone="secondary" title="资源筛选未接入：缺资源目录，且过滤效果未单独实测">
          未接入
        </Badge>
      </span>
    </div>
  );
}

/**
 * aud8: the two filters that arrive through the address instead of a picker.
 * A handle the person pasted is honoured on the wire — and shown in human
 * words, the raw handle living in the `title` like every other id on this
 * surface. Clearing drops the parameter and re-reads without it.
 */
function AuditUrlFilterChips({
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

export function AuditEventsModulePage(): ReactNode {
  const [params] = useSearchParams();
  // `?tab=retention` resolves to the events live slot in shell/routes.ts;
  // render the retention surface here instead of pretending the audit list is it.
  if (params.get("tab") === "retention" || params.get("view") === "retention") {
    return <RetentionModulePage />;
  }
  return <AuditEventsSurface />;
}

function AuditEventsSurface(): ReactNode {
  const [params, setParams] = useSearchParams();
  const { state: locationState } = useLocation();
  const navigate = useNavigate();
  // R31: the URL owns the selected record, so a shared or refreshed link opens
  // the same event. `?detail=<eventId>` is the documented spelling; `?id=` is
  // still read because links handed out before this change must keep working.
  const selected = params.get("detail") ?? params.get("id");

  // R34: the filter set is URL-owned, so a refreshed or shared link keeps the
  // same window. `?window=custom` reads its instants from `?from=`/`?to=`.
  const windowChoice = filterWindowOf(params.get("window"));
  // aud8: the rest of the filter set joins the address, so 「详情→返回」 and a
  // pasted URL restore the same question, not just the same window. The wire
  // name of the type filter stays `action` (`event_type` is ignored upstream);
  // `?type=` is the human-side spelling.
  const eventType = params.get("type") ?? "";
  // aud8: honoured-only-from-the-address filters. No control invents a value.
  const actor = params.get("actor") ?? "";
  const resource = params.get("resource") ?? "";

  // aud8: the memo keys on the two instants it actually reads, not on the whole
  // address. `?preview=` and `?detail=` are navigation state, not a new
  // question: a fold opening must not re-ask the service for the same page.
  const customFromParam = params.get("from");
  const customToParam = params.get("to");
  const bounds = useMemo(
    () =>
      windowChoice === "custom"
        ? customBounds(customFromParam, customToParam)
        : windowBounds(windowChoice),
    [windowChoice, customFromParam, customToParam],
  );
  // An incomplete custom range is not a question the service can answer: the
  // screen says what is missing and no request is issued (the route rejects an
  // unbounded or inverted scan).
  const customInvalid = windowChoice === "custom" && bounds === null;
  const customFrom = windowChoice === "custom" ? beijingInputValue(params.get("from")) : "";
  const customTo = windowChoice === "custom" ? beijingInputValue(params.get("to")) : "";

  const filters = useMemo<ListFilters>(() => {
    // The window is never unbounded (see AuditFilterBar); each choice carries a
    // real from+to pair, so a bare `?limit=` scan that the service 400s is
    // never asked. An unchosen type drops the `action` parameter entirely.
    return {
      action: eventType || null,
      from: bounds?.from ?? "",
      to: bounds?.to ?? "",
      actor: actor || null,
      resource: resource || null,
    };
  }, [actor, bounds, eventType, resource]);

  // No `?state=` leg on this pane: a list or detail state is only what the
  // service answered. A missing route degrades through readFailure() to an
  // honest sentence plus the request id, never to sample rows.
  const cursors = params.getAll("cursor");
  const startCursor = cursors.length ? cursors[cursors.length - 1]! : null;
  const pageNo = cursors.length + 1;
  const list = useAuditList(null, filters, !customInvalid, startCursor);
  const detail = useAuditDetail(selected, null);
  const [unaddressable, setUnaddressable] = useState(false);
  // aud8: the two inline folds are URL-owned now (they used to be page-local),
  // so an opened preview or technical fold survives 详情→返回 and a pasted
  // address. One row owns each fold at a time, so the panel ids stay unique.
  // Changing the question (window / type / cursor) drops them: rows that were
  // read under a wider filter must not stay unfolded on a narrowed screen.
  const openTech = params.get("tech");
  const openPreview = params.get("preview");
  const [typesOpen, setTypesOpen] = useState(false);
  // The window check is a read the person asks for; it never runs on load and
  // it is not driven by `?state=` (that repro belongs to the aud03 pane).
  const verify = useAuditVerify(null);

  const openRow = useCallback(
    (rawId: string | null) => {
      setUnaddressable(rawId === null);
      const draft = new URLSearchParams(params);
      draft.delete("id");
      if (rawId === null) draft.delete("detail");
      else draft.set("detail", rawId);
      // R39: opening a record is its own history entry, so Back returns to the
      // list with its filters (and the browser's scroll position) intact.
      setParams(draft, { replace: false, state: { fromList: true } });
    },
    [params, setParams],
  );

  const closeDetail = useCallback(() => {
    setUnaddressable(false);
    // R39: a record opened from the list was pushed as its own entry, so closing
    // walks back to it. A deep-linked record has nothing behind it and clears in
    // place rather than leaving the app.
    if (locationState?.fromList === true) {
      navigate(-1);
      return;
    }
    const draft = new URLSearchParams(params);
    draft.delete("id");
    draft.delete("detail");
    setParams(draft, { replace: true, state: locationState ?? null });
  }, [locationState, navigate, params, setParams]);

  /** aud8: writes one address-owned state key in place, keeping the rest. */
  const writeParam = useCallback(
    (key: string, value: string | null) => {
      const draft = new URLSearchParams(params);
      if (value === null || value === "") draft.delete(key);
      else draft.set(key, value);
      setParams(draft, { replace: true, state: locationState ?? null });
    },
    [locationState, params, setParams],
  );

  /** One row at a time owns each fold, so the panel ids stay unique. */
  const setFold = useCallback(
    (key: "tech" | "preview", rowKey: string) => {
      writeParam(key, params.get(key) === rowKey ? null : rowKey);
    },
    [params, writeParam],
  );

  const setType = useCallback(
    (next: string) => {
      const draft = new URLSearchParams(params);
      if (next) draft.set("type", next);
      else draft.delete("type");
      resetPagingAndFolds(draft);
      setParams(draft, { replace: true, state: locationState ?? null });
    },
    [locationState, params, setParams],
  );

  /** aud8: the address-borne filters are cleared the same way they arrive. */
  const clearUrlFilter = useCallback(
    (key: "actor" | "resource") => {
      const draft = new URLSearchParams(params);
      draft.delete(key);
      resetPagingAndFolds(draft);
      setParams(draft, { replace: true, state: locationState ?? null });
    },
    [locationState, params, setParams],
  );

  const setWindow = useCallback(
    (next: FilterWindowKey) => {
      const draft = new URLSearchParams(params);
      draft.set("window", next);
      if (next !== "custom") {
        draft.delete("from");
        draft.delete("to");
      }
      resetPagingAndFolds(draft);
      setParams(draft, { replace: true, state: locationState ?? null });
    },
    [locationState, params, setParams],
  );

  const setCustomFrom = useCallback(
    (next: string) => {
      const draft = new URLSearchParams(params);
      resetPagingAndFolds(draft);
      draft.set("window", "custom");
      const iso = parseBeijingInput(next);
      if (iso) draft.set("from", iso);
      else draft.delete("from");
      setParams(draft, { replace: true, state: locationState ?? null });
    },
    [locationState, params, setParams],
  );

  const setCustomTo = useCallback(
    (next: string) => {
      const draft = new URLSearchParams(params);
      resetPagingAndFolds(draft);
      draft.set("window", "custom");
      const iso = parseBeijingInput(next);
      if (iso) draft.set("to", iso);
      else draft.delete("to");
      setParams(draft, { replace: true, state: locationState ?? null });
    },
    [locationState, params, setParams],
  );

  const goNext = useCallback(() => {
    if (!list.next) return;
    const draft = new URLSearchParams(params);
    resetPagingAndFolds(draft);
    draft.append("cursor", list.next);
    setParams(draft, { replace: true });
  }, [list.next, params, setParams]);

  const goPrev = useCallback(() => {
    const stack = params.getAll("cursor");
    if (!stack.length) return;
    const draft = new URLSearchParams(params);
    resetPagingAndFolds(draft);
    for (const value of stack.slice(0, -1)) draft.append("cursor", value);
    setParams(draft, { replace: true });
  }, [params, setParams]);

  const typeGroups = (() => {
    if (list.phase !== "ready" || list.rows.length === 0) return [];
    const counted = new Map<string, { key: string; label: string; count: number }>();
    for (const row of list.rows) {
      const key = row.action.raw ?? row.action.label;
      const found = counted.get(key);
      if (found) found.count += 1;
      else counted.set(key, { key, label: row.action.label, count: 1 });
    }
    return [...counted.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  })();

  const canExport = list.phase === "ready" && list.rows.length > 0;

  const windowLabel = WINDOW_FILTER_CHOICES.find((item) => item.value === windowChoice)?.label ?? "最近 7 天";

  const exportOff = customInvalid || list.phase !== "ready" || list.rows.length === 0;
  const exportTitle = exportOff
    ? customInvalid
      ? "自定义时间窗不完整，没有可导出的记录"
      : "当前筛选没有可导出的记录"
    : "导出当前筛选结果为 CSV（北京时间）";

  const statusLine = (() => {
    if (customInvalid) return "自定义时间窗还不完整：两栏都填好且开始早于结束才会去读";
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

  // aud8: the preview's 「打开详情」 link carries the reading state with it
  // (window, type, cursor stack, folds), so the record opens on the page it
  // was reached from instead of dropping back to a bare first page.
  const detailHref = useCallback(
    (rawId: string): string => {
      const draft = new URLSearchParams(params);
      draft.delete("id");
      draft.set("detail", rawId);
      return `/audit?${draft.toString()}`;
    },
    [params],
  );

  // aud8: a real way back. `aud02-detail-close` folds the record away; this is
  // the 「返回列表」 exit the workorder asks for — it walks to the list entry
  // the record was opened from, so the page, the filters and the row that was
  // unfolded are all still there, instead of leaning on the browser's Back.
  const backExit =
    selected || unaddressable ? (
      <Button
        size="sm"
        outlined
        onClick={closeDetail}
        data-testid="aud8-back-to-list"
        prefix={<ArrowLeft className="h-3.5 w-3.5" />}
        title="回到列表：筛选、页码与已展开的行都在原处"
      >
        返回列表
      </Button>
    ) : null;

  // aud8: one line that states the restored state in words, so 「恢复后的界面
  // 值」 is readable on the screen and assertable from the DOM.
  const restoredLine = [
    `时间窗：${windowLabel}`,
    eventType ? `类型：${eventType}` : "类型：全部",
    actor ? "操作者：按地址句柄" : "操作者：未筛",
    resource ? "资源：按地址编号" : "资源：未筛",
    `第 ${pageNo} 页`,
    openPreview ? "有一行预览展开" : "无展开行",
  ].join(" · ");

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
            onClick={() => downloadCsv(list.rows, exportName(windowLabel))}
            disabled={exportOff}
            aria-disabled={exportOff}
            title={exportTitle}
            data-testid="aud01-export"
            prefix={<Download className="h-3.5 w-3.5" />}
          >
            导出 CSV
          </Button>
          <Button
            size="sm"
            outlined
            onClick={() => verify.run(filters.from, filters.to)}
            disabled={verify.phase === "loading" || customInvalid}
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

      <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid="aud5-export-bar">
        <Button
          size="sm"
          outlined
          onClick={() => downloadText(filteredCsvText(list.rows), filteredExportName(windowChoice, "all", "all"))}
          disabled={!canExport}
          aria-disabled={!canExport}
          title={canExport ? "导出当前筛选为 CSV（北京时间）" : "当前筛选无事件可导出"}
          data-testid="aud5-export"
          prefix={<Download className="h-3.5 w-3.5" />}
        >
          导出当前筛选 CSV
        </Button>
        <span className="min-w-0 break-words text-xs text-muted-foreground" data-testid="aud5-export-count">将导出 {list.rows.length} 条</span>
      </div>

      <AuditTypeSummary open={typesOpen} onToggle={() => setTypesOpen((value) => !value)} groups={typeGroups} total={list.rows.length} />

      <AuditFilterBar
        windowChoice={windowChoice}
        customFrom={customFrom}
        customTo={customTo}
        customInvalid={customInvalid}
        eventType={eventType}
        onWindowChange={setWindow}
        onCustomFrom={setCustomFrom}
        onCustomTo={setCustomTo}
        onEventTypeChange={setType}
      />

      {/* aud8: every piece of reading state above is in the address, so this
          line is what a pasted link restores — stated in words, not implied. */}
      <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="aud8-state-line">
        {restoredLine}
      </p>

      <AuditUrlFilterChips actor={actor} resource={resource} onClear={clearUrlFilter} />

      {/* The window check lives on the list too, and it says exactly one of
          four things: asking, the real counts, 本环境未启用 + why + where, or a
          plain failure. A 404 route answers 「本环境未启用」, never a generic
          error — see the copy in copy.ts. */}
      {(() => {
        if (verify.phase === "loading") {
          return <LoadingPanel testId="aud01-verify-loading" />;
        }
        if (verify.phase === "ready" && verify.result) {
          // R38: the same anchors the verify screen carries are on this pane
          // too. The result body's counts/window/scanned/broken ids are handed
          // in, and status / window label / reading moment / re-run sit around
          // it, so a probe that looks for aud01-verify-* finds the whole family
          // after one real run — never a claim without a screen behind it.
          const result = verify.result;
          const countsKnown =
            result.scanned !== null || result.total !== null || result.broken !== null;
          const verifyStatus = !countsKnown
            ? "校验跑完了，但结论没有带上核对范围"
            : result.scanned === 0
              ? "这一段没有核对到记录"
              : result.verdict === "broken"
                ? "发现对不上的地方"
                : result.verdict === "intact"
                  ? "没有发现断点"
                  : "校验跑完了，但结论没说清楚";
          return (
            <div className="flex min-w-0 flex-col gap-2" data-testid="aud01-verify-result">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <p
                  className="min-w-0 break-words text-xs text-muted-foreground"
                  aria-live="polite"
                  data-testid="aud01-verify-status"
                >
                  {verifyStatus}
                </p>
                <Button
                  size="sm"
                  outlined
                  onClick={() => verify.run(filters.from, filters.to)}
                  data-testid="aud01-verify-rerun"
                >
                  重新校验
                </Button>
              </div>
              <VerifyResultBody
                result={result}
                askedFrom={null}
                askedTo={null}
                testId="aud01-verify-result-body"
                ids={{
                  counts: "aud01-verify-counts",
                  window: "aud01-verify-window",
                  scanned: "aud01-verify-scanned",
                  broken: "aud01-verify-broken",
                }}
              />
              <dl
                className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-xs"
                data-testid="aud01-verify-detail"
              >
                <div className="flex min-w-0 gap-1.5" data-testid="aud01-verify-window-label">
                  <dt className="shrink-0 text-muted-foreground">校验窗口（北京时间）</dt>
                  <dd className="min-w-0 break-words">{windowLabel}</dd>
                </div>
                <div className="flex min-w-0 gap-1.5" data-testid="aud01-verify-asof">
                  <dt className="shrink-0 text-muted-foreground">读取时刻（北京时间）</dt>
                  <dd
                    className="min-w-0 break-words"
                    title="服务的回答里没有带回读取时刻，本页不拿浏览器时间顶替"
                  >
                    —
                  </dd>
                </div>
              </dl>
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
          {customInvalid ? (
            <p className="min-w-0 break-words text-xs text-warning" data-testid="aud01-custom-hint">
              自定义时间窗还不完整，本页没有向服务发请求（不会退化成全表扫描）。把两栏填好、开始早于结束，就会去读。
            </p>
          ) : null}

          {!customInvalid && list.phase === "loading" ? <LoadingPanel testId="aud01-loading" /> : null}

          {!customInvalid && list.phase === "denied" ? (
            <DeniedPanel failure={list.failure} testId="aud01-denied" />
          ) : null}

          {!customInvalid && list.phase === "error" && list.failure ? (
            <ErrorPanel
              failure={list.failure}
              onRetry={list.reload}
              testId="aud01-error"
            />
          ) : null}

          {!customInvalid && list.phase === "empty" ? (
            <EmptyPanel
              reason="按现在的筛选条件，这个时间窗里没有审计事件"
              nextStep="把时间窗放宽一格，或换一种事件类型再看。这个窗口确实没有记录，本身就是筛选后的真实答案——服务不接受不带任何筛选条件的全表扫描，所以这里始终有一个时间窗。"
              onRefresh={list.reload}
              testId="aud01-empty"
            />
          ) : null}

          {!customInvalid && list.phase === "ready" ? (
            <>
              {list.rows.map((row) => (
                <div
                  className="flex min-w-0 flex-col gap-1"
                  key={row.key}
                  onKeyDown={(event) => { if (event.key === "Escape") writeParam("preview", null); }}
                >
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    aria-expanded={openPreview === row.key}
                    aria-controls={"aud6-preview-" + row.key}
                    data-testid={"aud6-toggle-" + row.key}
                    onClick={() => setFold("preview", row.key)}
                  >
                    {openPreview === row.key ? "收起预览" : "预览这一条"}
                  </button>
                  <AuditEventRowCard
                    row={row}
                    selected={row.rawId !== null && row.rawId === selected}
                    onOpen={() => openRow(row.rawId)}
                    techOpen={openTech === row.key}
                    onToggleTech={() => setFold("tech", row.key)}
                    testId={`aud01-row-${row.key}`}
                  />
                  {openPreview === row.key ? (
                    <AuditRowPreview row={row} testId={"aud6-preview-" + row.key} detailHref={detailHref} />
                  ) : null}
                </div>
              ))}

              {list.unreadable > 0 ? (
                <p className="min-w-0 break-words text-xs text-warning">
                  有 {list.unreadable} / {list.rows.length + list.unreadable} 条记录缺少可显示的内容，未列在上面。
                </p>
              ) : null}

              {list.pageFailure ? (
                <InlineFailure failure={list.pageFailure} action="后续记录没有加载成功" onRetry={list.loadMore} testId="aud01-page-failure" />
              ) : null}

              <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid="aud2-pagination">
                <span className="min-w-0 break-words text-xs text-muted-foreground" data-testid="aud2-page">
                  第 {pageNo} 页 · 已加载 {list.rows.length} 条
                </span>
                {list.total === null ? (
                  <span
                    className="min-w-0 break-words text-xs text-muted-foreground"
                    data-testid="aud2-total"
                    title="服务没有给出总数；游标分页不能自算总数，本页只数已加载的行"
                  >
                    总数不可用
                  </span>
                ) : (
                  <span
                    className="min-w-0 break-words text-xs text-muted-foreground"
                    data-testid="aud2-total"
                    title="这个数由服务在回答里带回（顶层 total），不是本页行数相加"
                  >
                    共 {list.total} 条
                  </span>
                )}
                <span className="contents" data-testid="aud2-prev">
                  <Button size="sm" outlined disabled={pageNo === 1} onClick={goPrev}>
                    上一页
                  </Button>
                </span>
                <span className="contents" data-testid="aud2-next">
                  <Button
                    size="sm"
                    outlined
                    disabled={!list.next}
                    onClick={goNext}
                    data-testid="aud01-load-more"
                    prefix={<RefreshCw className="h-3.5 w-3.5" />}
                  >
                    下一页
                  </Button>
                </span>
              </div>
              {!list.next && list.rows.length > 0 ? (
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
                  // aud8: the two address-borne filters are part of what was
                  // asked, so the fold says whether they went on the wire.
                  `操作者：${filters.actor ? `actorId=${filters.actor}` : "未带"}`,
                  `资源：${filters.resource ? `resourceId=${filters.resource}` : "未带"}`,
                  `总数：${list.total === null ? "服务未给" : String(list.total)}`,
                  list.next ? "" : "服务端没有再给下一页的游标",
                ]}
              />
            </>
          ) : null}
        </section>

        <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start" aria-label="事件详情">
          {backExit}
          {drawer}
        </aside>
      </div>
    </div>
  );
}

export default AuditEventsModulePage;
