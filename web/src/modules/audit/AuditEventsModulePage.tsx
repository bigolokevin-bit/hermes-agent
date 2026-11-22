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
 *   请求编号 可复制；服务没给就写「该字段未返回」，不留空、不写 0
 *
 * The detail body has zero raw field names on screen; every technical value
 * collapses into 「技术详情」, closed by default (closed means those strings are
 * not in the DOM at all). 403 and 404 draw one identical denied body and never
 * leave rows above it. Fixture debt burn (R30): this pane no longer reads
 * `?state=` — every list/detail state below comes from a real read, so there is
 * no fixture badge to mistake for an answer.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Download, ReceiptText, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Spinner } from "@nous-research/ui/ui/components/spinner";

import { AuditFilterChips, AuditUrlFilterChips, DeniedPanel, DetailCopy, EmptyPanel, ErrorPanel, FilterSummaryCopy, InlineFailure, LoadingPanel, RequestIdLine, TechnicalDisclosure, VerifyUnavailablePanel } from "./states";
import { AuditEventDetailBody, AuditEventRowCard, VerifyResultBody, AuditRowPreview, AuditTypeSummary } from "./views";
import RetentionModulePage from "./RetentionModulePage";
import { useAuditDetail, useAuditList, useAuditVerify } from "./useAuditData";
import type { DetailPhase } from "./useAuditData";
import type { FailureCopy } from "./copy";
import type { VerifyFailure } from "./copy";
import { eventTypeChoices } from "./model";
import type { ListFilters } from "./api";
import { PAGE_LIMIT, PAGE_SIZE_CHOICES, readPageSize } from "./api";
import {
  filterSeatsForScreen,
  filterSummaryLineOf,
  hasFilterSummary,
  pageShareHref,
} from "./filterSummary";
import { filterChipsOf, type AuditChip } from "./filterChips";
import { auditGatesOf, gateMirror } from "./auditGates";
import type { SortColumn, SortState } from "./sorting";
import { SORT_COLUMNS, ariaSort, nextSort, sortReading, sortRows, sortScopeOf, sortStateOf } from "./sorting";
import { applyScroll, clearScrollMark, readScrollMark, readScrollY, saveScrollMark, scrollFingerprint } from "./scrollMemory";
import type { AuditRow } from "./model";
import { downloadCsv, downloadText, exportName, filteredCsvText, filterSnapshotExportName } from "./csv";
import {
  FILTER_WINDOW_CHOICES,
  beijingInputValue,
  customBounds,
  filterWindowOf,
  parseBeijingInput,
  windowBounds,
  type FilterWindowKey,
} from "./window";
import { ConsoleSelect } from "@/shell/ConsoleSelect";

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

/** audL: the three quick windows, spelled out again inside the custom card. */
const WINDOW_PRESET_CHOICES = FILTER_WINDOW_CHOICES.filter((item) => item.value !== "custom");

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
  draft.delete("event");
  draft.delete("tech");
}

/**
 * audP: the same reset for a page-size change, EXCEPT the deep link.
 *
 * `?event=` is not a fold the person opened on this page — it is the link they
 * arrived with, a pointer at one record. Changing how many rows a page holds is
 * a decision about the page, and silently dropping the pointer would mean the
 * page decided to forget why the person is here. The located row may or may not
 * be inside the new, larger/smaller set; that is what the 深链档 already says
 * out loud (「已定位」 / 「在服务端还在，只是不在当前页」 / 「不存在或已过期」),
 * so keeping the key costs nothing and lying about it costs the link.
 *
 * Turning a page (下一页/上一页) still drops the fold and the pointer: aud8/aud9
 * registered 翻页＝换页, and this round was asked only about the size selector.
 */
function resetPagingKeepingLink(draft: URLSearchParams): void {
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
  actor,
  resource,
  actorChoices,
  resourceChoices,
  onWindowChange,
  onCustomFrom,
  onCustomTo,
  onApplyCustom,
  onClearCustom,
  draftError,
  draftInvalid,
  onEventTypeChange,
  onActorChange,
  onResourceChange,
}: {
  windowChoice: FilterWindowKey;
  customFrom: string;
  customTo: string;
  customInvalid: boolean;
  eventType: string;
  /** aud9: the chosen operator handle, straight from `?actor=`. */
  actor: string;
  /** aud9: the chosen resource value, straight from `?resource=`. */
  resource: string;
  /** The operators this page read back — the only ones offered. */
  actorChoices: { handle: string; label: string }[];
  /** The resources this page read back — the only ones offered. */
  resourceChoices: { handle: string; label: string }[];
  onWindowChange: (next: FilterWindowKey) => void;
  onCustomFrom: (next: string) => void;
  onCustomTo: (next: string) => void;
  onEventTypeChange: (next: string) => void;
  onActorChange: (next: string) => void;
  onResourceChange: (next: string) => void;
  /** audB: commit the typed range into the address (one read), or drop it. */
  onApplyCustom: () => void;
  onClearCustom: () => void;
  /** audB: why the typed range cannot be applied yet, in words. */
  draftError: string | null;
  /** True while the draft range is not a question the service can answer. */
  draftInvalid: boolean;
}): ReactNode {
  const choices = useMemo(() => eventTypeChoices(), []);
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-2" role="group" aria-label="审计事件筛选" data-testid="aud01-filters">
      {/* audB: the quick windows are a pressed-state group, so 「当前是哪一档」
          is readable by a keyboard probe, and choosing 自定义 visibly un-presses
          the three quick ones. The container keeps the aud01 id; each choice is
          `aud01-filter-window-<key>`. */}
      <div className="flex min-w-0 flex-wrap items-end gap-2" role="group" aria-label="时间窗" data-testid="aud01-filter-window">
        <span className="min-w-0 text-xs text-muted-foreground">时间窗</span>
        {WINDOW_FILTER_CHOICES.map((item) => (
          <button
            key={item.value}
            type="button"
            data-testid={`aud01-filter-window-${item.value}`}
            aria-pressed={windowChoice === item.value}
            className={`h-8 min-w-0 rounded-md border px-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
              windowChoice === item.value ? "border-primary text-foreground" : "border-border text-muted-foreground hover:bg-muted/40"
            }`}
            onClick={() => onWindowChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {windowChoice === "custom" ? (
        <div className="flex min-w-0 flex-wrap items-end gap-2" data-testid="aud01-custom-window">
          <div className="flex min-w-0 flex-col gap-1 max-md:w-full" data-testid="audB-from">
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
          </div>
          <div className="flex min-w-0 flex-col gap-1 max-md:w-full" data-testid="audB-to">
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
          </div>
          {/* audL: the custom card carries its own quick presets, because a
              person who got here by typing instants should be able to leave by
              one click. These are NOT a second window control: each button is
              the same setter the quick group above uses, so `?window=` moves,
              `from`/`to` drop, and one read follows. Nothing here is pressed
              while the custom range is open — the pressed one lives in the
              group above, which is what `aria-pressed` on those mirrors. */}
          <div
            className="flex min-w-0 flex-wrap items-center gap-2"
            role="group"
            aria-label="自定义区间的快捷预设"
            data-testid="audB-presets"
            title="这三个与上方时间窗快捷档同源：点一下就离开自定义区间，重读一次，对应的快捷档随之按下"
          >
            <span className="min-w-0 text-xs text-muted-foreground">快捷预设</span>
            {WINDOW_PRESET_CHOICES.map((item) => (
              <button
                key={item.value}
                type="button"
                data-testid={`audB-preset-${item.value}`}
                aria-pressed={windowChoice === item.value}
                className={`h-8 min-w-0 rounded-md border px-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  windowChoice === item.value ? "border-primary text-foreground" : "border-border text-muted-foreground hover:bg-muted/40"
                }`}
                onClick={() => onWindowChange(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {/* audB: the range is a draft until it is applied. Typing two
              instants must not fire a read per keystroke — the question the
              service answers is the one that is applied. */}
          <Button
            size="sm"
            outlined
            onClick={onApplyCustom}
            disabled={draftInvalid}
            aria-disabled={draftInvalid}
            title={draftInvalid ? "两栏都填好、且开始早于结束，才能应用这个区间" : "用这个起止时间去读（一次读取）"}
            data-testid="audB-apply"
          >
            应用这个区间
          </Button>
          <Button size="sm" outlined onClick={onClearCustom} data-testid="audB-clear" title="丢掉自定义区间，回到最近 7 天">
            清空区间
          </Button>
          {draftError ? (
            <p className="min-w-0 break-words text-xs text-warning" data-testid="audB-range-error">
              {draftError}
            </p>
          ) : null}
          {customInvalid ? (
            <p className="min-w-0 break-words text-xs text-warning" data-testid="aud01-custom-error">
              自定义时间窗需要两栏都填好，且开始早于结束；在那之前不会去读。
            </p>
          ) : null}
          {/* audB: what this range actually filters. The service honours the
              two instants itself (probed live: each window answers its own
              span, an inverted pair is refused with 400 request.invalid_query),
              so the note says 服务端整窗过滤 and NOT 「只在已加载的行里挑」. */}
          <p className="min-w-0 basis-full break-words text-xs text-muted-foreground" data-testid="audB-scope-note">
            {customInvalid
              ? "这一段还没应用：应用后由服务端按起止时间过滤整个时间窗，不是在本页已加载的行里挑。"
              : "这一段由服务端按起止时间过滤（from/to 直接进请求），筛的是整个区间的账本，不是只在这页已加载的行里挑；输入框里的时间是北京时间，落到地址栏是 ISO 瞬间。"}
          </p>
        </div>
      ) : null}

      <label className="flex min-w-0 flex-col gap-1 text-xs max-md:basis-full" htmlFor="aud01-filter-type">
        <span className="text-muted-foreground">事件类型</span>
        <ConsoleSelect
          id="aud01-filter-type"
          data-testid="aud01-filter-type"
          className="h-8 min-w-0 max-w-56 rounded-md border border-border bg-transparent px-2 text-sm"
          value={eventType}
          onChange={(next) => onEventTypeChange(next)}
          options={[
            { value: "", label: "全部事件类型" },
            // audD: a bucket hands over the code it counted under, which may
            // be one the sampled list never carried. The control must show it
            // instead of pretending the filter is off.
            ...(eventType && !choices.some((item) => item.value === eventType)
              ? [{ value: eventType, label: "按地址带入的类型" }]
              : []),
            ...choices,
          ]}
        />
      </label>

      {/* aud9: 操作者与资源都是可用控件，但可用范围写在控件下方明说。
          操作者走服务端：探针 #11（2026-11-19）`actorId=employee-api` → 200，
          50/50 行 actor.id 全等于该句柄，故筛选值上线（?actor= → actorId=）。
          选项来自本页读到的操作者：本环境没有可展示真名的目录（GAP-06），
          人话标签上屏，机器句柄只进 option 的 value 与地址栏。 */}
      <label className="flex min-w-0 flex-col gap-1 text-xs max-md:basis-full" htmlFor="aud01-filter-operator">
        <span className="text-muted-foreground">操作者</span>
        <ConsoleSelect
          id="aud01-filter-operator"
          data-testid="aud01-filter-operator"
          className="h-8 min-w-0 max-w-44 rounded-md border border-border bg-transparent px-2 text-sm"
          value={actor}
          onChange={(next) => onActorChange(next)}
          title="GAP-06：服务端参数 actorId 实测生效（2026-11-19 探针 #11：200，50/50 行命中），但它只吃机器句柄，本环境没有可展示真名的操作者目录，故选项取自本页已读到的操作者"
          options={[
            { value: "", label: "全部操作者" },
            // an address-borne handle nothing on this page answers is still a
            // handle the service was asked about — the control must not
            // silently drop it, or the address and the screen would disagree.
            ...(actor && !actorChoices.some((item) => item.handle === actor)
              ? [{ value: actor, label: "按地址带入的操作者" }]
              : []),
            ...actorChoices.map((item) => ({ value: item.handle, label: item.label })),
          ]}
        />
      </label>

      {/* aud9: 资源也做成可用控件。`resourceId` 只被该路由的 400 体点名为七个
          可接受筛选之一，过滤效果本环境未单独实测，所以这一条既上线（值来自
          地址栏，可分享），也在本地按已加载的行再筛一遍 —— 范围写在下面的
          aud9-scope-note 上，不假装它是服务端整窗筛选。 */}
      <label className="flex min-w-0 flex-col gap-1 text-xs max-md:basis-full" htmlFor="aud8-filter-resource">
        <span className="text-muted-foreground">资源</span>
        <ConsoleSelect
          id="aud8-filter-resource"
          data-testid="aud8-filter-resource"
          className="h-8 min-w-0 max-w-44 rounded-md border border-border bg-transparent px-2 text-sm"
          value={resource}
          onChange={(next) => onResourceChange(next)}
          title="resourceId 由该路由的 400 体点名为可接受筛选，但本环境未单独实测其过滤效果，故同时在本页已加载的行里本地匹配"
          options={[
            { value: "", label: "全部资源" },
            ...(resource && !resourceChoices.some((item) => item.handle === resource)
              ? [{ value: resource, label: "按地址带入的资源" }]
              : []),
            ...resourceChoices.map((item) => ({ value: item.handle, label: item.label })),
          ]}
        />
      </label>
    </div>
  );
}

/**
 * aud9: how wide each filter really reaches. Stated under the controls, in
 * words, because 操作者 is answered by the service for the whole window while
 * 资源 is only proven against the rows this page already loaded.
 */
function AuditFilterScope({
  actor,
  resource,
  loaded,
  matched,
}: {
  actor: string;
  resource: string;
  loaded: number;
  matched: number;
}): ReactNode {
  if (!actor && !resource) return null;
  return (
    <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="aud9-scope-note">
      {actor && resource
        ? `操作者这一条由服务端在整个时间窗里筛（实测生效）；资源这一条只在本页已加载的 ${loaded} 条里本地匹配，筛出 ${matched} 条——服务端的资源筛选效果本环境没有单独实测过。`
        : actor
          ? "操作者这一条由服务端在整个时间窗里筛（实测生效）；本环境没有真名操作者目录，下拉里的选项来自本页读到的操作者。"
          : `资源这一条只在本页已加载的 ${loaded} 条里本地匹配，筛出 ${matched} 条——服务端的资源筛选效果本环境没有单独实测过，所以这里不做整窗保证。`}
    </p>
  );
}

/**
 * aud9: what `?event=<id>` got. Three honest legs and nothing in between:
 * the row is on this page, the service said this event is not reachable
 * (403 and 404 are the same body, 「该事件不存在或已过期」 with a copyable
 * request id from that very answer), or the event exists but sits outside
 * the rows this page loaded. No invented id, no silent nothing.
 */
function AuditEventDeepLink({
  found,
  phase,
  failure,
  onClear,
  onRetry,
  onOpen,
}: {
  /** The address-borne event id is among the rows on screen. */
  found: boolean;
  /** The detail read that settles whether the event exists at all. */
  phase: DetailPhase;
  failure: FailureCopy | null;
  onClear: () => void;
  onRetry: () => void;
  onOpen: () => void;
}): ReactNode {
  if (found) {
    return (
      <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="aud9-deeplink-found">
        已按链接定位到这条事件并展开
        <button type="button" className="ml-2 underline underline-offset-2" onClick={onClear} data-testid="aud9-deeplink-close">
          收起定位
        </button>
      </p>
    );
  }
  if (phase === "loading" || phase === "idle") {
    return (
      <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="aud9-deeplink-checking">
        这一条不在当前页里，正在向服务确认它还在不在…
      </p>
    );
  }
  if (phase === "denied") {
    return (
      <div
        role="alert"
        className="flex min-w-0 flex-col items-start gap-1 rounded-md border border-border bg-card px-3 py-2"
        data-testid="aud9-event-missing"
      >
        <p className="max-w-prose break-words text-xs">该事件不存在或已过期</p>
        <p className="max-w-prose break-words text-xs text-muted-foreground">
          服务对这个标识给了「读不到」的回答；链接可能记错了编号，也可能记录已经离开这个窗口。清除定位就回到当前筛选与页码。
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <RequestIdLine requestId={failure?.requestId ?? null} testId="aud9-event-rid" />
          <Button size="sm" outlined onClick={onRetry}>
            再确认一次
          </Button>
          <Button size="sm" outlined onClick={onClear}>
            清除定位
          </Button>
        </div>
      </div>
    );
  }
  if (phase === "error") {
    return (
      <ErrorPanel
        failure={failure ?? { sentence: "这条事件没能确认。", requestId: null, technical: null }}
        onRetry={onRetry}
        title="这条事件没能确认"
        testId="aud9-event-error"
      />
    );
  }
  return (
    <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="aud9-event-elsewhere">
      这条事件在服务端还在，只是不在当前页或当前筛选里。
      <button type="button" className="ml-1 underline underline-offset-2" onClick={onOpen} data-testid="aud9-event-open">
        直接打开它
      </button>
      <button type="button" className="ml-2 underline underline-offset-2" onClick={onClear} data-testid="aud9-event-clear">
        清除定位
      </button>
    </p>
  );
}

/**
 * audA: the row wrapper owns the keyboard loop for its own preview, so a
 * person who never touches the mouse can open it, close it, and land back on
 * the control they closed. Focus returns to the row's toggle because that is
 * the handle the row is read through; leaving it on a vanished panel would
 * dump the next Tab into the middle of the page.
 */
/**
 * audK — one row inside a roving tab stop.
 *
 * A keyboard person reads this ledger row by row: the list is ONE Tab stop, and
 * ↑ ↓ Home End move inside it. The row that holds the stop is the one the
 * person last reached (the first row before that), so Tab into the list lands
 * where the reading is, not at the bottom of the page.
 *
 * Enter opens or closes that row's preview — the same fold `aud6-toggle-*` and
 * the mouse use, so one keystroke cannot flip two rows. Esc closes it and hands
 * the focus back to the row, because the next keystroke is a question about
 * that row. Nothing here sends a request or touches a filter, a page or the
 * address beyond the fold's own key.
 */
function AuditRowKeyboard({
  row,
  open,
  deepLink,
  isRoving,
  /** audit-sort-p1: 这一行参与的是哪一种顺序（service-order / local-page）。 */
  sortScope,
  /** audit-sort-p1: 屏上实序，1 起——与 `aud-sort-scope-note` 的条数同源。 */
  sortPosition,
  onToggle,
  onClose,
  onRoving,
  onMove,
  onEdge,
  children,
}: {
  row: AuditRow;
  /** The preview of this row is the open fold. */
  open: boolean;
  /** `?event=` landed on this row. */
  deepLink: boolean;
  /** audK: this row holds the list's single tab stop right now. */
  isRoving: boolean;
  sortScope: string;
  sortPosition: number;
  onToggle: () => void;
  onClose: () => void;
  /** audK: the person reached this row by keyboard, so it takes the stop. */
  onRoving: (key: string) => void;
  /** audK: ↑ ↓ — the row to land on, or null when the edge was reached. */
  onMove: (key: string, delta: number) => string | null;
  /** audK: Home / End. */
  onEdge: (edge: "first" | "last") => string | null;
  children: ReactNode;
}): ReactNode {
  const focusBy = (key: string | null): void => {
    if (!key) return;
    const node = document.querySelector<HTMLElement>(`[data-audk-row='${key}']`);
    if (node) {
      onRoving(key);
      node.focus();
    }
  };

  return (
    <div
      className="flex min-w-0 flex-col gap-1 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      data-testid={`audA-row-shell-${row.key}`}
      data-aud9-deeplink={deepLink ? "true" : undefined}
      // audK: roving tabIndex — the whole list is one Tab stop, and this is the
      // row that holds it. `data-audk-row` is how the list finds a row to move
      // focus to without reaching for a test id.
      data-audk-row={row.key}
      data-audk-roving={isRoving ? "true" : "false"}
      role="listitem"
      tabIndex={isRoving ? 0 : -1}
      onFocus={() => onRoving(row.key)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) {
          // The row itself is not a Tab stop; Enter here is for a row that was
          // focused programmatically. Inside the row the real buttons already
          // answer Enter, so this never double-fires.
          event.preventDefault();
          onToggle();
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
          // The arrow keys belong to the list only while the row itself is the
          // thing under focus; inside a control they keep their own behaviour.
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          if (event.key === "Home" || event.key === "End") focusBy(onEdge(event.key === "Home" ? "first" : "last"));
          else focusBy(onMove(row.key, event.key === "ArrowDown" ? 1 : -1));
          return;
        }
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        onClose();
        const toggle = (event.currentTarget as HTMLElement).querySelector<HTMLButtonElement>(
          `[data-testid='aud6-toggle-${row.key}']`,
        );
        toggle?.focus();
      }}
    >
      {/* audK: the probe handle for this row — where it sits in the list and
          whether it is the one holding the tab stop right now. */}
      <span
        aria-hidden="true"
        data-testid={`audK-row-${row.key}`}
        data-audk-roving={isRoving ? "true" : "false"}
        data-audk-open={open ? "true" : "false"}
        data-aud-sort-scope={sortScope}
        data-aud-sort-position={sortPosition}
      />
      {children}
    </div>
  );
}

/**
 * audN — the column handles. Four real buttons, one `aria-sort` per column in
 * three states (ascending → descending → none), keyboard on Enter and Space
 * like every other control on this page.
 *
 * `aria-sort` belongs on a columnheader, so the strip carries the minimal
 * table shape (table → row → columnheader). That is deliberate and limited:
 * the ledger rows below are cards with `role=list`/`listitem` (audK/audM
 * contracts), and turning 50 cards into table rows is not this round's work —
 * the header describes what the buttons do, nothing more.
 */
function AuditSortBar({
  state,
  count,
  disabled,
  reason,
  onPick,
}: {
  state: SortState;
  count: number;
  /** audN: the four states that have no order to speak of. */
  disabled: boolean;
  reason: string;
  onPick: (column: SortColumn) => void;
}): ReactNode {
  const reading = sortReading(state, count);
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid="aud-sort-bar-block">
      <div role="table" aria-label="排序控件（只重排这一页已加载的行）" data-testid="aud-sort-bar" className="min-w-0">
        <div role="row" data-testid="aud-sort-row" className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 text-xs text-muted-foreground">排序</span>
          {SORT_COLUMNS.map((item) => (
            <span
              key={item.key}
              role="columnheader"
              aria-sort={ariaSort(state, item.key)}
              data-testid={`aud-sort-head-${item.key}`}
            >
              <button
                type="button"
                data-testid={`aud-sort-button-${item.key}`}
                disabled={disabled}
                title={
                  disabled
                    ? reason
                    : state.column === item.key
                      ? `${item.label}：${state.direction === "asc" ? "升序，再点变降序" : "降序，再点清除排序"}`
                      : `按${item.label}排这一页（升序→降序→清除）`
                }
                className={`flex min-w-0 items-center gap-1 rounded-md border px-2 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  state.column === item.key
                    ? "border-primary text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                } ${disabled ? "opacity-60" : ""}`}
                onClick={() => onPick(item.key)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
                  event.preventDefault();
                  onPick(item.key);
                }}
              >
                {item.label}
                <span aria-hidden="true">
                  {state.column === item.key ? (state.direction === "asc" ? "↑" : "↓") : "⇅"}
                </span>
              </button>
            </span>
          ))}
        </div>
      </div>
      <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="aud-sort-status">
        {reading}
      </p>
      <p
        className="min-w-0 break-words text-xs text-muted-foreground"
        data-testid="aud-sort-scope-note"
        title="为什么只做本地排序：本轮朝活体读口试过排序参数，服务端没有给出可以核对的生效回答（拿不到排序前后台账顺序变化的证据），所以这里只重排已经读到的行。原始探码记在交付文档的 audN 一节，不搬上屏——屏上出现路径或状态码会让人以为在读日志"
      >
        仅在当前已加载的 {count} 条内排序——服务端没有可用的排序参数（本轮实测拿不到生效证据），清掉排序就回到服务给的回行顺序。
      </p>
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

/**
 * audH — how many records one page asks for.
 *
 * One component, two homes: the pagination bar (live) and the empty answer
 * (disabled, with the reason on the control). The value it shows is the size
 * the ANSWER said it served when it said one — a page clamped by the service
 * reports the number that was really in force, not the one that was wished
 * for. When the answer stated nothing, the note says exactly that and quotes
 * the two numbers the screen actually has: the requested size and the rows it
 * received. Nothing here computes an effective size.
 */
function AuditPageSizeSelector({
  effective,
  asked,
  disabled,
  rejectedNote,
  clampedNote,
  silentNote,
  onPick,
}: {
  /** The size in force on screen (the answer's, else what was asked). */
  effective: number;
  /** The size this page sent. */
  asked: number;
  /** The empty answer has nothing to page through. */
  disabled: boolean;
  /** The address asked for a size this page will not send. */
  rejectedNote: string | null;
  /** The service said it served a different size. */
  clampedNote: string | null;
  /** The service said nothing; only the counted rows are quotable. */
  silentNote: string | null;
  onPick: (size: number) => void;
}): ReactNode {
  const offered = (PAGE_SIZE_CHOICES as readonly number[]).includes(effective);
  const note = rejectedNote ?? clampedNote ?? silentNote;
  return (
    <>
      <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" htmlFor="audH-page-size">
        每页
        <ConsoleSelect
          id="audH-page-size"
          data-testid="audH-page-size"
          aria-label="每页条数"
          className="h-8 min-w-0 rounded-md border border-border bg-transparent px-2 text-sm"
          value={String(effective)}
          disabled={disabled}
          title={
            disabled
              ? "这个筛选下没有事件，每页条数暂时用不上"
              : rejectedNote
                ? rejectedNote
                : clampedNote
                  ? clampedNote
                  : `改每页条数会重新读取一次，并回到第 1 页（当前请求 limit=${asked}）`
          }
          onChange={(next) => onPick(Number(next))}
          options={[
            ...PAGE_SIZE_CHOICES.map((size) => ({ value: String(size), label: `${size} 条` })),
            ...(offered ? [] : [{ value: String(effective), label: `服务带回 ${effective} 条` }]),
          ]}
        />
      </label>
      {note ? (
        <span className="min-w-0 break-words text-xs text-warning" data-testid="audH-clamp-note">
          {note}
        </span>
      ) : null}
    </>
  );
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

  // audB: the custom range is a DRAFT. Typing two instants asks nothing; the
  // read happens when 应用 puts them into the address. `null` means the inputs
  // still say what the address says, so a pasted or refreshed link paints its
  // own range without any local copy to keep in step.
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const rangeDraftFrom = range?.from ?? beijingInputValue(customFromParam);
  const rangeDraftTo = range?.to ?? beijingInputValue(customToParam);
  const rangeFromIso = parseBeijingInput(rangeDraftFrom);
  const rangeToIso = parseBeijingInput(rangeDraftTo);
  // The applied range is what the screen shows on the wire; the draft only
  // blocks 应用 while it is not a question the service could answer.
  const rangePending = useMemo(
    () => (rangeFromIso && rangeToIso ? { from: rangeFromIso, to: rangeToIso } : null),
    [rangeFromIso, rangeToIso],
  );
  const rangeError =
    range === null
      ? customInvalid
        ? "开始和结束都要填上，这一区间才能应用；在那之前本页不去读它，也不会退化成全表扫描。"
        : null
      : !rangeFromIso || !rangeToIso
        ? "开始和结束都要填，这一区间才能应用；在应用之前本页不去读它。"
        : rangeFromIso > rangeToIso
          ? "开始时间不能晚于结束时间；把两头调对再应用，本页不会拿倒置的区间去问服务。"
          : null;

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
  // audH: the page size lives in the address too. What the address wrote and
  // what this page is willing to send are kept apart on purpose: an offered
  // size goes out as asked, anything else is reported and the default is read.
  const sizeReading = readPageSize(params.get("limit"));
  const list = useAuditList(null, filters, !customInvalid, startCursor, sizeReading.asked);
  // The size on screen is the one the ANSWER says it served, when it says one.
  const servedLimit = list.servedLimit;
  const effectiveLimit = servedLimit ?? sizeReading.asked;
  const clamped = servedLimit !== null && servedLimit !== sizeReading.asked;
  // A silent answer that brought back fewer rows than asked is the same story
  // told without a number: the screen says what it counted, and never claims
  // the service agreed to a size it never stated.
  const silentShortPage =
    servedLimit === null && list.phase === "ready" && list.rows.length > 0 && list.rows.length < sizeReading.asked;
  const sizeNote =
    sizeReading.note ??
    (clamped
      ? `请求按每页 ${sizeReading.asked} 条发出，服务这一页带回的是每页 ${servedLimit} 条（回答里写明的生效值），控件已按生效值回显。`
      : silentShortPage
        ? `服务没有带回这一页按多少条读；请求路径写的是 limit=${sizeReading.asked}，屏上实收 ${list.rows.length} 条 —— 这里只报这两个数，不替服务认一个生效值。`
        : null);
  const detail = useAuditDetail(selected, null);
  const [unaddressable, setUnaddressable] = useState(false);
  // aud8: the two inline folds are URL-owned now (they used to be page-local),
  // so an opened preview or technical fold survives 详情→返回 and a pasted
  // address. One row owns each fold at a time, so the panel ids stay unique.
  // Changing the question (window / type / cursor) drops them: rows that were
  // read under a wider filter must not stay unfolded on a narrowed screen.
  // aud9: `?event=<id>` is the deep link onto one row. It is NOT a third fold:
  // on read it is the same opened preview, and touching either spelling drops
  // the other, so a row is never unfolded twice from two sources of truth.
  const deepLinkId = params.get("event");
  const openTech = params.get("tech");
  const openPreview = params.get("preview") ?? deepLinkId;
  const [typesOpen, setTypesOpen] = useState(false);
  // The window check is a read the person asks for; it never runs on load and
  // it is not driven by `?state=` (that repro belongs to the aud03 pane).
  const verify = useAuditVerify(null);

  // aud9: the two handle filters only have real values to offer from what this
  // page actually read back — there is no operator or resource directory, so
  // nothing is invented and an address-borne handle is honoured regardless.
  const actorChoices = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of list.rows) {
      const handle = row.actor.raw;
      if (handle && !seen.has(handle)) seen.set(handle, row.actor.label);
    }
    return [...seen].map(([handle, label]) => ({ handle, label }));
  }, [list.rows]);

  const resourceChoices = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of list.rows) {
      const handle = row.resource.raw;
      if (handle && !seen.has(handle)) seen.set(handle, row.resource.label);
    }
    return [...seen].map(([handle, label]) => ({ handle, label }));
  }, [list.rows]);

  // aud9: 资源的本地匹配。服务端 resourceId 的过滤效果本环境未单独实测（只有该
  // 路由 400 体点名它可接受），所以地址里的值既原样上线，也在已加载的行上再筛
  // 一遍：屏幕上留下的行一定符合选择，范围由 aud9-scope-note 明说。
  const visibleRows = useMemo(
    () =>
      resource
        ? list.rows.filter((row) =>
            (row.resource.raw ?? row.resource.label).toLowerCase().includes(resource.toLowerCase()),
          )
        : list.rows,
    [list.rows, resource],
  );

  // audN: the order this page shows the rows in. Local, on the rows already
  // in hand — see sorting.ts for the probe that says why. Sorting is not a new
  // question, so it touches no cursor, no page and no filter, and asks nothing.
  const sortState = sortStateOf(params.get("asort"), params.get("adir"));
  // A plain derivation, the way 类型分布 counts are: the set is at most one
  // page of rows, and a memo keyed on a freshly built object would only be a
  // second place for the same truth to drift.
  const listedRows = sortRows(visibleRows, sortState);

  const pickSort = useCallback(
    (column: SortColumn) => {
      const next = nextSort(sortStateOf(params.get("asort"), params.get("adir")), column);
      const draft = new URLSearchParams(params);
      // cleared is BOTH keys gone, not a direction hanging on its own
      draft.delete("asort");
      draft.delete("adir");
      if (next.column && next.direction) {
        draft.set("asort", next.column);
        draft.set("adir", next.direction);
      }
      setParams(draft, { replace: true, state: locationState ?? null });
    },
    [locationState, params, setParams],
  );

  // audK: the list's single tab stop. `null` means the person has not moved
  // inside the list yet, so the first row holds the stop — Tab into the ledger
  // lands where the reading starts, not past the last row. A row that is no
  // longer on screen (a new page, a narrowed filter) hands the stop back to the
  // first row of what came instead.
  const [rovingKey, setRovingKey] = useState<string | null>(null);
  const roving = (rovingKey !== null && listedRows.some((row) => row.key === rovingKey)
    ? rovingKey
    : listedRows[0]?.key) ?? null;

  const moveRowFocus = useCallback(
    (key: string, delta: number): string | null => {
      const index = listedRows.findIndex((row) => row.key === key);
      if (index === -1) return null;
      const next = listedRows[Math.min(listedRows.length - 1, Math.max(0, index + delta))];
      return next?.key ?? null;
    },
    [listedRows],
  );

  const edgeRowFocus = useCallback(
    (edge: "first" | "last"): string | null => {
      if (!listedRows.length) return null;
      return (edge === "first" ? listedRows[0] : listedRows[listedRows.length - 1])?.key ?? null;
    },
    [listedRows],
  );

  // aud9: the deep link. A row that is on this page IS the opened fold; a link
  // no loaded row answers is a question for the service, and whatever it
  // answers — denied, an unreadable body, a record that lives on another page
  // — is what the screen says, with the request id it came back with.
  const deepLinkRow = deepLinkId
    ? listedRows.find((row) => row.key === deepLinkId || row.rawId === deepLinkId)
    : undefined;
  const existence = useAuditDetail(
    deepLinkId && !deepLinkRow && (list.phase === "ready" || list.phase === "empty") ? deepLinkId : null,
    null,
  );

  // audM: the question being read, as one string. Navigation state is not in
  // it, so opening a record is not a new question and the place the list stood
  // still belongs to the question being read.
  const fingerprint = scrollFingerprint(params);
  const lastFingerprint = useRef(fingerprint);
  const scrollProbe = useRef<HTMLSpanElement | null>(null);
  // The mark is spent once: applied, then dropped, so a later return to the
  // same question does not yank the window back to a place nobody left it at.
  const restoreArmed = useRef(false);

  const say = (name: string, value: string): void => {
    scrollProbe.current?.setAttribute(name, value);
  };

  const openRow = useCallback(
    (rawId: string | null) => {
      setUnaddressable(rawId === null);
      // audM: remember where the list stood, and which row was walked into.
      // A row without an identifier opens no record, so there is no way back
      // to remember — and a mark nobody can spend is just a stale promise.
      // audM: the mark is saved by the effect below, on the way INTO any
      // record — this row, the preview's own link, or a pasted record address.
      // A row without an identifier opens no record, so nothing is remembered.
      if (rawId === null) say("data-audl-saved", "这一行没有标识，没有可回去的详情");
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

  // audM: the way in and the way back, for every path into a record — this
  // row's own handle, the preview's 「打开详情」 link, or a pasted record
  // address. The mark is saved when a record becomes the thing being read, and
  // spent when the list is the thing being read again.
  const previousSelected = useRef<string | null>(selected);
  const mountedWithRecord = useRef(selected !== null);
  useEffect(() => {
    if (lastFingerprint.current !== fingerprint) {
      // A different question is a different place. The mark left behind is
      // dropped, never applied here: 「换个筛选还回到刚才的滚动条」 is how a
      // list starts lying about where a record is.
      clearScrollMark(lastFingerprint.current);
      say("data-audl-cleared", lastFingerprint.current);
      lastFingerprint.current = fingerprint;
      restoreArmed.current = false;
    }
    if (mountedWithRecord.current) {
      // This load started inside a record — a pasted address or a full page
      // navigation from the preview's link. The list was never on screen in
      // this load, so any mark is somebody else's position: drop it and say
      // so instead of pretending a return has a place to go back to.
      mountedWithRecord.current = false;
      clearScrollMark(fingerprint);
      restoreArmed.current = false;
      say("data-audl-cleared", "整页加载直接落在记录上，这一页没有离开过列表");
      return;
    }
    const was = previousSelected.current;
    previousSelected.current = selected;
    if (selected && !was) {
      const standing = readScrollY();
      saveScrollMark(fingerprint, { y: standing, rowKey: selected });
      restoreArmed.current = true;
      say("data-audl-saved", `${standing}|${selected}`);
      return;
    }
    const wentBack = was !== null && selected === null;
    if (!wentBack) return;
    if (params.get("event")) {
      // The deep link owns its own arrival: it locates a row, and a window
      // thrown back to an old offset would fight that.
      clearScrollMark(fingerprint);
      restoreArmed.current = false;
      say("data-audl-restored", "深链定位优先，不回到旧位置");
      return;
    }
    if (!restoreArmed.current) return;
    // The rows have to be on screen before a position or a focus means
    // anything; an empty or failed answer keeps the person where they are.
    if (list.phase !== "ready" || visibleRows.length === 0) return;
    const mark = readScrollMark(fingerprint);
    restoreArmed.current = false;
    if (!mark) {
      say("data-audl-restored", "没有留下可回去的位置");
      return;
    }
    clearScrollMark(fingerprint);
    applyScroll(mark.y);
    say("data-audl-restored", String(mark.y));
    if (!mark.rowKey) {
      say("data-audl-focus", "留下的行标识为空，焦点留在原处");
      return;
    }
    const node = document.querySelector<HTMLElement>(`[data-audk-row='${mark.rowKey}']`);
    if (node) {
      // The focus is what moves the roving stop (the row answers it with its
      // own onFocus), so there is no second copy of that state to keep in step.
      node.focus();
      say("data-audl-focus", mark.rowKey);
    } else {
      say("data-audl-focus", `${mark.rowKey} 不在这一页`);
    }
  }, [fingerprint, list.phase, params, selected, visibleRows.length]);

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

  /** One row at a time owns each fold, so the panel ids stay unique. */
  const setFold = useCallback(
    (key: "tech" | "preview", rowKey: string) => {
      const draft = new URLSearchParams(params);
      const open = key === "preview" ? openPreview : params.get("tech");
      // aud9: `?event=` is the same fold reached from a link, so touching
      // either spelling clears the other — one row, one source of truth.
      draft.delete("event");
      if (open === rowKey) draft.delete(key);
      else draft.set(key, rowKey);
      setParams(draft, { replace: true, state: locationState ?? null });
    },
    [locationState, openPreview, params, setParams],
  );

  /** aud9: closing a deep link drops the定位 and keeps filters and page. */
  const clearFold = useCallback(
    (key: "preview" | "tech") => {
      const draft = new URLSearchParams(params);
      draft.delete(key);
      draft.delete("event");
      setParams(draft, { replace: true, state: locationState ?? null });
    },
    [locationState, params, setParams],
  );

  /**
   * aud9: the operator filter is a real control now. Choosing one rewrites the
   * address (`?actor=`), drops the paging stack and the folds, and asks the
   * service exactly once — the same rule the window and the type follow.
   */
  const setActor = useCallback(
    (next: string) => {
      const draft = new URLSearchParams(params);
      if (next) draft.set("actor", next);
      else draft.delete("actor");
      resetPagingAndFolds(draft);
      setParams(draft, { replace: true, state: locationState ?? null });
    },
    [locationState, params, setParams],
  );

  /** aud9: 资源同理落 `?resource=`（本地匹配 + 上线透传）。 */
  const setResource = useCallback(
    (next: string) => {
      const draft = new URLSearchParams(params);
      if (next) draft.set("resource", next);
      else draft.delete("resource");
      resetPagingAndFolds(draft);
      setParams(draft, { replace: true, state: locationState ?? null });
    },
    [locationState, params, setParams],
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

  /**
   * audD: a bucket click is the type filter, so it goes through the SAME
   * setter the 事件类型 dropdown uses — one key (`?type=`), one wire parameter
   * (`action`), never two filters answering each other. Pressed again → 全部类型.
   */
  const pendingBucketFocus = useRef<string | null>(null);
  // The answer to the pick has to arrive before the focus is handed back: the
  // rows on screen are still the old ones until then, and the pressed button
  // is replaced by the new distribution right after.
  const bucketSettled = useRef(false);
  const pickType = useCallback(
    (code: string) => {
      pendingBucketFocus.current = code;
      bucketSettled.current = false;
      setType(eventType === code ? "" : code);
    },
    [eventType, setType],
  );

  // audD: a pick replaces the very rows the buckets were counted from, so the
  // button that answered Enter is unmounted while the new page is outstanding.
  // Once the answer lands, focus goes back to the pressed bucket — and if that
  // type turned out to have no records, to the way out of the empty answer.
  // Without this, every Enter would dump the keyboard person at the top.
  useEffect(() => {
    const code = pendingBucketFocus.current;
    if (code === null) return;
    if (list.phase === "loading") {
      bucketSettled.current = true;
      return;
    }
    if (!bucketSettled.current) return;
    pendingBucketFocus.current = null;
    bucketSettled.current = false;
    const pressed = document.querySelector<HTMLButtonElement>(`[data-testid="audD-bucket-${code}"]`);
    if (pressed) {
      pressed.focus();
      return;
    }
    document.querySelector<HTMLButtonElement>("[data-testid='audD-empty-clear']")?.focus();
  }, [list.phase, eventType, typesOpen]);

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
      setRange(null); // audB: a quick window replaces any typed draft
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
    (next: string) => setRange({ from: next, to: range?.to ?? beijingInputValue(customToParam) }),
    [range, customToParam],
  );

  const setCustomTo = useCallback(
    (next: string) => setRange({ from: range?.from ?? beijingInputValue(customFromParam), to: next }),
    [range, customFromParam],
  );

  /**
   * audB: the typed range is a draft. Typing asks nothing; 应用 writes the two
   * instants into the address once, and one read follows. An inverted or
   * half-filled range is not a question the service can answer (it 400s
   * `request.invalid_query`), so 应用 is refused and the reason is on screen.
   */
  const applyCustom = useCallback(() => {
    if (rangeError !== null || rangePending === null) return;
    const draftUrl = new URLSearchParams(params);
    resetPagingAndFolds(draftUrl);
    draftUrl.set("window", "custom");
    draftUrl.set("from", rangePending.from);
    draftUrl.set("to", rangePending.to);
    setRange(null);
    setParams(draftUrl, { replace: true, state: locationState ?? null });
  }, [locationState, params, rangeError, rangePending, setParams]);

  /** audB: 清空区间 — drop the custom range, go back to the 7-day quick window. */
  const clearCustom = useCallback(() => {
    setRange(null);
    setWindow("7d");
  }, [setWindow]);

  /**
   * audH: choosing a size rewrites `?limit=`, drops the cursor stack (a new
   * size is a new question, so page 1 again) and asks exactly once.
   */
  const setPageSize = useCallback(
    (next: number) => {
      const draft = new URLSearchParams(params);
      // audP: a new size is a new page, so the cursor stack goes and page 1
      // starts — but an arrived-with `?event=` pointer stays. Only the person
      // closing the定位 (or changing a filter) takes it away.
      resetPagingKeepingLink(draft);
      draft.set("limit", String(next));
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

  /**
   * audT: a chip's × removes exactly the address keys the chip itself carries.
   * The keys sit beside the words (filterChips.ts), so this is one write path
   * for every chip and there is no second list of parameter names to drift; the
   * page never re-derives what a chip means from the chip's label.
   *
   * Deleting is not clearing by hand: `resetPagingAndFolds` is the same call the
   * filter bar's own setters make, so a removal lands on page 1 with the cursor
   * stack and the open folds dropped, and the smaller question is asked ONCE.
   * A range is a pair, so removing the 自定义 chip drops `window`, `from` and
   * `to` together and the picked-up draft goes with them.
   */
  const removeFilterChip = useCallback(
    (chip: AuditChip) => {
      const draft = new URLSearchParams(params);
      for (const key of chip.params) draft.delete(key);
      if (chip.params.includes("from")) setRange(null);
      resetPagingAndFolds(draft);
      setParams(draft, { replace: true, state: locationState ?? null });
    },
    [locationState, params, setParams],
  );

  // audI: the type the address chose, spoken the way the picker speaks it, so
  // the export line can name the set in human words (an unsampled code reads
  // verbatim, exactly like the 类型 column does).
  const typeChoices = useMemo(() => eventTypeChoices(), []);
  const eventTypeLabel = eventType
    ? typeChoices.find((choice) => choice.value === eventType)?.label ?? eventType
    : "";

  const typeGroups = (() => {
    if (list.phase !== "ready" || listedRows.length === 0) return [];
    const counted = new Map<string, { key: string; label: string; count: number }>();
    for (const row of listedRows) {
      const key = row.action.raw ?? row.action.label;
      const found = counted.get(key);
      if (found) found.count += 1;
      else counted.set(key, { key, label: row.action.label, count: 1 });
    }
    return [...counted.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  })();

  // aud9: everything on screen and everything exported follows the rows the
  // person is actually looking at, not the raw page the service returned.


  const windowLabel = WINDOW_FILTER_CHOICES.find((item) => item.value === windowChoice)?.label ?? "最近 7 天";

  const statusLine = (() => {
    if (customInvalid) return "自定义时间窗还不完整：两栏都填好且开始早于结束才会去读";
    if (list.phase === "loading") return `正在读取审计事件（${windowLabel}）…`;
    if (list.phase === "empty") return "这个筛选条件里没有审计事件";
    if (list.phase === "denied") return "审计事件暂不可用";
    if (list.phase === "error") return "审计事件读取失败";
    return `已显示 ${listedRows.length} 条审计事件（${windowLabel}）${list.next ? "，下面还有更多" : ""}`;
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
            {/* R121: nothing is selected, so there is nothing to copy — the control
             * is still here, disabled, and says why. A hidden control teaches the
             * person to hunt; a disabled one with a reason answers the question. */}
            <DetailCopy event={null} />
            <p className="max-w-prose break-words text-xs text-muted-foreground">
              点开左侧任意一条可以看到它当时的操作者、对象、结果与原因。要核对整段时间的链是否接得上，请用「完整性校验」。
            </p>
          </CardContent>
        </Card>
      );
    }
    if (detail.phase === "loading") {
      return <LoadingPanel testId="aud02-detail-loading" slot="detail" />;
    }
    if (detail.phase === "denied") {
      // audS: this leg carried no face mark, so 「三面同体」 was really two faces
      // and a guess. Same panel, same slot as its loading/error neighbours.
      return <DeniedPanel failure={detail.failure} testId="aud02-detail-denied" slot="detail" />;
    }
    if (detail.phase === "error" || !detail.detail) {
      return (
        <ErrorPanel
          failure={detail.failure ?? { sentence: "这条事件的详情没能加载出来。", requestId: null, technical: null }}
          onRetry={detail.reload}
          title="这条事件没能加载出来"
          testId="aud02-detail-error"
          slot="detail"
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
    windowChoice === "custom"
      ? `时间窗：自定义（${beijingInputValue(customFromParam) || "未填"} → ${beijingInputValue(customToParam) || "未填"}）`
      : `时间窗：${windowLabel}`,
    eventType ? `类型：${eventType}` : "类型：全部",
    actor ? "操作者：按句柄筛（服务端）" : "操作者：未筛",
    resource ? `资源：按编号本地筛（${listedRows.length}/${list.rows.length}）` : "资源：未筛",
    `第 ${pageNo} 页`,
    openPreview ? "有一行展开" : "无展开行",
  ].join(" · ");

  /** aud9: 与 `?detail=`（右侧整条详情）分开的地址语义，映射表在 DONE.md。 */
  const deepLinkBlock =
    deepLinkId === null || (list.phase !== "ready" && list.phase !== "empty") ? null : (
      <AuditEventDeepLink
        found={deepLinkRow !== undefined}
        phase={existence.phase}
        failure={existence.failure}
        onClear={() => clearFold("preview")}
        onRetry={existence.reload}
        onOpen={() => openRow(deepLinkId)}
      />
    );

  // audG: one line describing HOW the ledger is being read right now, quoting
  // the path this page actually asked (relative, credential-free). Built from
  // the address and the data layer's own builder — reading it copies nothing
  // new. No memo on purpose: it is a string built from values this render
  // already holds, and a shared summary must never be one render stale.
  const summaryInput = {
    windowLabel,
    custom: windowChoice === "custom",
    fromBeijing: beijingInputValue(customFromParam),
    toBeijing: beijingInputValue(customToParam),
    type: eventType,
    actor,
    resource,
    resourceNote: "本页已加载的记录里本地匹配，服务端 resourceId 效果未单独实测",
    page: pageNo,
    cursorCount: cursors.length,
    // audH: the size in force (the answer's stated one when it stated one).
    limit: servedLimit ?? sizeReading.asked,
    defaultLimit: PAGE_LIMIT,
    // An incomplete custom range is never asked, so the summary has no request
    // to quote — 「未设置」, not the last valid window's path.
    askedPath: customInvalid ? null : list.askedPath,
  };
  const filterSummary = filterSummaryLineOf(summaryInput);
  // audR: the same question, as a link. Origin-free by construction.
  const shareHref = pageShareHref(params);
  // audT: the same question again, one piece at a time, for removal. The chips
  // are seats of THIS `summaryInput` — the object audG pastes and audR shows —
  // plus the three things only the address knows: how the window and the size
  // were written, and whether the type code is one the picker offers.
  const filterChips = filterChipsOf({
    ...summaryInput,
    rawWindow: params.get("window") ?? "",
    typeKnown: eventType === "" || typeChoices.some((choice) => choice.value === eventType),
    rawLimit: sizeReading.rejected ? sizeReading.written ?? "" : "",
  });

  // audQ: one object decides every entry's availability — the two exports, the
  // two copy controls, the row fold and the retry — with the sentences that
  // used to be written separately in each widget. Derived only from what the
  // screen already holds: no request, no side effect, no second truth.
  const gates = auditGatesOf({
    phase: list.phase,
    customInvalid,
    rows: listedRows.length,
    question: hasFilterSummary(summaryInput),
    record: detail.phase,
    hasIdentifier: listedRows.some((row) => row.rawId !== null),
  });
  // audQ: the availability and the reason come from the gates, not from a
  // ternary living next to the button.
  const exportOff = !gates.exportCsv.enabled;
  const exportTitle = gates.exportCsv.title;

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
            onClick={() => downloadCsv(listedRows, exportName(windowLabel))}
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
              disabled={!gates.retry.enabled}
              aria-disabled={!gates.retry.enabled}
              title={gates.retry.title}
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
          onClick={() =>
            // audI: name first, then the body — `downloadText(name, text)`.
            // The two were swapped here: the file came out named with its own
            // CSV text and filled with the file name, which no test could see
            // because nothing compared both sides until now.
            downloadText(
              filterSnapshotExportName({
                window: windowChoice,
                actor: actor || "all",
                resource: resource || "all",
                action: eventType || "all",
                rows: listedRows.length,
              }),
              filteredCsvText(listedRows),
            )
          }
          disabled={!gates.exportFiltered.enabled}
          aria-disabled={!gates.exportFiltered.enabled}
          title={gates.exportFiltered.title}
          data-testid="aud5-export"
          prefix={<Download className="h-3.5 w-3.5" />}
        >
          导出当前筛选 CSV
        </Button>
        <span className="min-w-0 break-words text-xs text-muted-foreground" data-testid="aud5-export-count">将导出 {listedRows.length} 条</span>
        {/* audI: the export set is named out loud, because 「导出当前筛选」 is only
            honest if the screen says which rows that means: the same rows on
            screen, with the same type the bucket filter put in the address. */}
        <span className="min-w-0 basis-full break-words text-xs text-muted-foreground" data-testid="audI-export-scope">
          导出的就是屏上这一份：{eventType ? `只含「${eventTypeLabel}」这一类` : "当前时间窗与筛选下的全部类型"}，共 {listedRows.length} 行，与上面「已显示」和类型分布的计数同一个集合；文件名带齐时间窗、操作者、资源、动作与行数，时间为北京时间到分。
        </span>
      </div>

      {/* audD: the distribution is the filter. Picking a bucket writes the
          type into the address (and asks once); picking the pressed one again
          goes back to all types. */}
      <AuditTypeSummary
        open={typesOpen}
        onToggle={() => setTypesOpen((value) => !value)}
        groups={typeGroups}
        total={listedRows.length}
        selected={eventType}
        onPick={pickType}
      />

      <AuditFilterBar
        windowChoice={windowChoice}
        customFrom={rangeDraftFrom}
        customTo={rangeDraftTo}
        draftError={rangeError}
        draftInvalid={rangeError !== null || rangePending === null}
        customInvalid={customInvalid}
        eventType={eventType}
        actor={actor}
        resource={resource}
        actorChoices={actorChoices}
        resourceChoices={resourceChoices}
        onWindowChange={setWindow}
        onCustomFrom={setCustomFrom}
        onCustomTo={setCustomTo}
        onApplyCustom={applyCustom}
        onClearCustom={clearCustom}
        onEventTypeChange={setType}
        onActorChange={setActor}
        onResourceChange={setResource}
      />

      {/*
       * audT: 生效筛选 chip 摘要 — one chip per filter that is on, directly under
       * the bar that put it there. The row is read off the address, not off the
       * rows, so it is there while a read is outstanding and there when a read
       * was refused; it is absent only when nothing is on. × is a real button.
       */}
      <AuditFilterChips chips={filterChips} onRemove={removeFilterChip} />

      {/* aud9: how far each filter really reaches, right under the controls. */}
      <AuditFilterScope
        actor={actor}
        resource={resource}
        loaded={list.rows.length}
        matched={listedRows.length}
      />

      {/* aud8: every piece of reading state above is in the address, so this
          line is what a pasted link restores — stated in words, not implied. */}
      <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="aud8-state-line">
        {restoredLine}
      </p>

      {/* audR: the address is the single source, and this line is that claim
          said out loud: the same seats the copied summary is built from, plus
          the link a person can hand over. The href is same-origin (no host, no
          port), credential parameters are stripped by the same rule that
          guards the copied request path, and the text is produced by the very
          function the clipboard uses — so the sentence on the card and the
          sentence in the paste cannot be two different sentences. */}
      <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="aud-source">
        <span data-testid="aud-source-seats">{filterSeatsForScreen(summaryInput)}</span>
        <a
          className="ml-1 rounded-sm underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          href={shareHref}
          data-testid="aud-source-href"
          title="同源相对路径的可分享形态；不带 origin，也不带任何凭据参数"
        >
          分享这一问
        </a>
      </p>

      {/* audM: a probe line, not prose. It carries what was saved when a
          record was opened, what the way back restored, which row got the
          focus, and which question's mark was dropped for being another
          question's place. Empty attributes mean nothing happened — the
          restore never claims a position it did not apply. */}
      {/* audP: the combination, readable. What the size selector shows, what was
          asked of the service, which page and cursor stack that implies, and
          whether an arrived-with deep link is still holding its place. Nothing
          here is inferred: an empty `data-aud-limit-event` means no pointer was
          on the address, 「不在本页」 means the pointer survived but the row is
          not inside what this page loaded. */}
      {/* audQ: the whole decision, readable at a glance. `on`/`off` per entry,
          so a probe sees the matrix without poking at five widgets — and can
          prove one failure is never on in one place and off in another. */}
      <span aria-hidden="true" data-testid="aud-gates" {...gateMirror(gates)} />

      <span
        aria-hidden="true"
        data-testid="aud-limit-restore"
        data-aud-limit-size={String(effectiveLimit)}
        data-aud-limit-asked={String(sizeReading.asked)}
        data-aud-limit-page={String(pageNo)}
        data-aud-limit-cursors={String(cursors.length)}
        data-aud-limit-event={deepLinkId ?? ""}
        data-aud-limit-located={deepLinkId === null ? "" : deepLinkRow ? "在本页已展开" : "不在本页"}
      />

      <span
        aria-hidden="true"
        data-testid="audL-scroll"
        ref={scrollProbe}
        data-audl-fingerprint={fingerprint}
      />

      <AuditUrlFilterChips actor={actor} resource={resource} onClear={clearUrlFilter} />

      {/* audL: the summary control is PERMANENT, and that is its mount
          condition, written where a person and a probe can both read it. It is
          off (with the reason on the button) when the address carries no
          reading question at all — the default quick window alone is nothing to
          hand over — and it is live in every state of the ledger, including
          loading and denied: the question this page asked exists before the
          answer does, and a refused read is exactly what a ticket needs. */}
      <FilterSummaryCopy line={filterSummary} gate={gates.copyFilter} rule={gates.copyFilterRule} />

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

          {!customInvalid && list.phase === "loading" ? <LoadingPanel testId="aud01-loading" slot="list" /> : null}

          {!customInvalid && list.phase === "denied" ? (
            <DeniedPanel failure={list.failure} testId="aud01-denied" slot="list" onRetry={list.reload} />
          ) : null}

          {!customInvalid && list.phase === "error" && list.failure ? (
            <ErrorPanel
              failure={list.failure}
              onRetry={list.reload}
              testId="aud01-error"
              slot="list"
            />
          ) : null}

          {!customInvalid && list.phase === "empty" ? (
            <>
              <AuditPageSizeSelector
                effective={effectiveLimit}
                asked={sizeReading.asked}
                disabled
                rejectedNote={sizeReading.rejected ? sizeReading.note : null}
                clampedNote={null}
                silentNote={null}
                onPick={setPageSize}
              />
              <EmptyPanel
                slot="list"
                reason={
                  windowChoice === "custom"
                    ? "该时间段内无事件——这个起止区间里没有审计事件"
                    : "按现在的筛选条件，这个时间窗里没有审计事件"
                }
                nextStep="把时间窗放宽一格，或换一种事件类型再看。这个窗口确实没有记录，本身就是筛选后的真实答案——服务不接受不带任何筛选条件的全表扫描，所以这里始终有一个时间窗。"
                onRefresh={list.reload}
                testId="aud01-empty"
                // 单一主操作=清筛选：优先对应面板标题所述的那一维，处理函数
                // 复用卡下两条既有出口各自的（不新增复合清除）；另一维的具名
                // 出口仍在卡下原处。
                clear={
                  windowChoice === "custom"
                    ? { label: "清空区间，回到最近 7 天", onClear: clearCustom }
                    : eventType
                      ? { label: "清掉类型筛选，回到全部类型", onClear: () => setType("") }
                      : undefined
                }
              />
              {/* audB: the empty answer carries its own way out, named for the
                  window that produced it. 清空区间 drops the custom range and
                  re-reads the 7-day quick window (once). */}
              {eventType ? (
                <p
                  className="min-w-0 break-words text-xs text-muted-foreground"
                  data-testid="audD-empty-exit"
                >
                  该条件下无事件——这个类型在当前的时间窗与页里没有记录。
                  <button
                    type="button"
                    className="ml-1 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    onClick={() => setType("")}
                    data-testid="audD-empty-clear"
                  >
                    清掉类型筛选，回到全部类型
                  </button>
                </p>
              ) : null}
              <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="audB-empty-exit">
                {windowChoice === "custom" ? "这一段里没有记录。" : "这一档里没有记录。"}
                <button
                  type="button"
                  className="ml-1 underline underline-offset-2"
                  onClick={clearCustom}
                  data-testid="audB-empty-clear"
                >
                  清空区间，回到最近 7 天
                </button>
              </p>
            </>
          ) : null}

          {/* audN: the column handles sit with the list they order, and they
              are honest about the states with nothing to order: disabled, with
              the reason on the control (the four-state rule from audF). */}
          <AuditSortBar
            state={sortState}
            count={listedRows.length}
            disabled={customInvalid || list.phase === "loading" || list.phase === "denied" || list.phase === "error" || list.phase === "empty"}
            reason={
              customInvalid
                ? "自定义区间还没应用，这一页没有可读到的行可排"
                : list.phase === "loading"
                  ? "正在读取这一页，读到之后才有可排的行"
                  : list.phase === "denied"
                    ? "审计事件暂不可读，这一页没有可排的行"
                    : list.phase === "error"
                      ? "这一页没能读到；先重试，读到了再排序"
                      : "这一页没有记录可排"
            }
            onPick={pickSort}
          />

          {/* aud9: the deep-link verdict sits with the list it speaks about. */}
          {!customInvalid ? deepLinkBlock : null}

          {!customInvalid && list.phase === "ready" ? (
            <>
              {resource && list.rows.length > 0 && visibleRows.length === 0 ? (
                <p className="min-w-0 break-words text-xs text-warning" data-testid="aud9-local-empty">
                  这一页里没有对得上的记录；本页只在已加载的 {list.rows.length} 条里做本地匹配。把时间窗放宽、换一页，或清除资源这一条再看。
                </p>
              ) : null}

              {/* audK: one Tab stop for the whole list; ↑ ↓ Home End move inside
                  it, Enter opens the row's preview, Esc closes it and comes
                  back. The list only exists while rows exist, so the loading,
                  error and empty answers keep their own arrow keys — nothing
                  here is listening when there is nothing to move through. */}
              <div
                className="flex min-w-0 flex-col gap-1"
                data-testid="audK-list"
                role="list"
                aria-label="审计事件行：用上下方向键逐行移动，Home 与 End 到首尾，Enter 展开或收起这一条的预览，Esc 收起"
              >
                {listedRows.map((row, index) => (
                <AuditRowKeyboard
                  key={row.key}
                  row={row}
                  sortScope={sortScopeOf(sortState)}
                  sortPosition={index + 1}
                  open={openPreview === row.key}
                  deepLink={row.key === deepLinkId || row.rawId === deepLinkId}
                  isRoving={row.key === roving}
                  onToggle={() => setFold("preview", row.key)}
                  onClose={() => clearFold("preview")}
                  onRoving={setRovingKey}
                  onMove={moveRowFocus}
                  onEdge={edgeRowFocus}
                >
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    aria-expanded={openPreview === row.key}
                    aria-controls={"aud6-preview-" + row.key}
                    title={gates.toggle.title}
                    data-testid={"aud6-toggle-" + row.key}
                    onClick={() => setFold("preview", row.key)}
                    // audA: Enter on the row's own handle opens the preview.
                    // preventDefault keeps the browser's synthesized click from
                    // toggling the same fold a second time.
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      setFold("preview", row.key);
                    }}
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
                    <AuditRowPreview
                      row={row}
                      testId={"aud6-preview-" + row.key}
                      detailHref={detailHref}
                      // audF: the preview is not a fourth reading. When this row
                      // is the record that is open, its in-flight / failed / denied
                      // answer is shown here with the SAME sentence the record pane
                      // uses, so one failure cannot be named two ways on one screen.
                      record={
                        row.rawId !== null && row.rawId === selected
                          ? { phase: detail.phase, failure: detail.failure, onRetry: detail.reload }
                          : null
                      }
                    />
                  ) : null}
                </AuditRowKeyboard>
                ))}
              </div>

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
                <AuditPageSizeSelector
                  effective={effectiveLimit}
                  asked={sizeReading.asked}
                  disabled={false}
                  rejectedNote={sizeReading.rejected ? sizeReading.note : null}
                  clampedNote={clamped ? sizeNote : null}
                  silentNote={silentShortPage ? sizeNote : null}
                  onPick={setPageSize}
                />
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
