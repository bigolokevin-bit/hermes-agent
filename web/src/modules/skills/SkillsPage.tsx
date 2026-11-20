// Module: skills — read-only skill ledger (SKL4).
//
// One list read: /agent-api/api/skills. The ledger has name, version and
// sharing scope. Source, runtime status and update time are not in the list
// payload, so those cells are "—" with a reason; no value is invented and no
// sample row is shown. A missing route is reported as 未接入 with the GAP id
// only in a tooltip. No raw field name or HTTP status reaches the page.
import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router";

import { Badge, Button, Card, CardContent } from "@nous-research/ui";
import { fetchJsonStrict } from "@/modules/models/fetchJson";
import { ApiError, SESSION_REQUIRED_GUIDANCE } from "@/lib/api-error";
import { copyTextToClipboard } from "@/lib/clipboard";
import { currentFixtureRid, currentFixtureState, fixtureView, type FixtureState } from "../../shell/fixtures";
import { SKILLS_GAP, formatBeijingTime, readSkills, type SkillRow } from "./skills";
import { CapabilityCounts, publishCapabilityCount } from "../capabilities/counts";
import { CapabilityRowDetail } from "../capabilities/rowDetail";
import { CapabilitySearch } from "../capabilities/search";
import { CapabilityExport } from "../capabilities/csvExport";
import { CapabilityCopy } from "../capabilities/listCopy";
import { CapabilityPageScope, derivePageScope } from "../capabilities/pageScope";
import { deriveGates, type GatePhase } from "../capabilities/gates";
import { applySort, ariaSort, cycleSort, readSort, sortRows, type SortKey } from "../capabilities/sorting";
import { useEnsureTabParam } from "../capabilities/tabParam";
import { captureTabView, focusTabButton, noteTabMount, restoreTabView } from "../capabilities/tabView";
import { RowMissingNotice, listHref, rowHref, rowTargetFor, withRowTarget, withoutRowTarget } from "../capabilities/rowLink";
import { CapStateAnchor, stateAnchor } from "../capabilities/stateAnchor";
import { CapabilityRowCopyButton, type CapRowCopyResult } from "../capabilities/rowCopyButton";
import { capRowCopyText } from "../capabilities/rowCopyText";
import "./skills.css";

type State =
  | { k: "loading" }
  | { k: "empty" }
  | { k: "error"; message: string; requestId: string | null; gap: string | null; status: number | null }
  | { k: "ready"; rows: SkillRow[]; asOf: string | null; asOfReason: string | null; asOfTitle: string | null; total: number | null; nextCursor: string | null };

// The capabilities tab strip unmounts the inactive page. Keep the last settled
// read and the expanded row in module memory so switching back shows the same
// view immediately, without reading the ledger again. A manual refresh still
// calls `load` because it increments `attempt` past 0.
let cachedSkillsState: State | null = null;
let cachedSkillsOpen: string | null = null;

export function resetSkillsTabState() {
  cachedSkillsState = null;
  cachedSkillsOpen = null;
}

function requestIdOf(error: unknown): string | null {
  if (error instanceof ApiError && error.requestId) return error.requestId;
  if (error !== null && typeof error === "object" && "requestId" in error && typeof error.requestId === "string" && error.requestId) {
    return error.requestId;
  }
  return null;
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return SESSION_REQUIRED_GUIDANCE;
    if (error.status === 403 || error.status === 404) {
      return "技能读口未接入：上游技能接口还没有接入本控制台，或当前账号无权查看。接入后这里会自动显示真实技能。";
    }
    if (error.status === 0) return "控制台暂时没有回应，请稍后重试。";
    if (error.message) return error.message;
  }
  return "这次没能读取技能台账，请稍后重试。";
}

function RequestId({ id }: { id: string | null }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle");
  const copy = async () => {
    if (!id) return;
    setCopied((await copyTextToClipboard(id)) ? "ok" : "failed");
  };
  return (
    <p className="skl4-reqid" data-testid="skl4-request-id">
      请求编号：<code title={id ?? undefined}>{id ?? "本次请求未记录编号"}</code>
      {id ? (
        <button type="button" onClick={() => void copy()} aria-label="复制请求编号">
          {copied === "ok" ? "已复制" : copied === "failed" ? "复制失败" : "复制"}
        </button>
      ) : null}
    </p>
  );
}

function forcedState(state: FixtureState | null, rid: string | null): State | null {
  if (state === "loading") return { k: "loading" };
  if (state === "empty") return { k: "empty" };
  if (state === "error") {
    return {
      k: "error",
      message: "技能读口未接入：上游技能接口还没有接入本控制台，或当前账号无权查看。接入后这里会自动显示真实技能。",
      requestId: rid,
      gap: SKILLS_GAP,
      status: 404,
    };
  }
  return null;
}

/** Remove the preview switch from both window and hash search, keeping other params. */
function leavePreview() {
  const url = new URL(window.location.href);
  url.searchParams.delete("state");
  const [hashPath, hashQuery] = url.hash.split("?");
  if (hashQuery) {
    const params = new URLSearchParams(hashQuery);
    params.delete("state");
    url.hash = `${hashPath}${params.toString() ? `?${params}` : ""}`;
  }
  window.history.replaceState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function Cell({ value, reason, title }: { value: string | null; reason: string; title?: string | null }) {
  return (
    <span className="skl4-cell">
      <span className={value ? "" : "skl4-missing"} title={title ?? (!value ? reason : undefined)}>{value ?? "—"}</span>
      {!value ? <span className="skl4-reason">{reason}</span> : null}
    </span>
  );
}

export function SkillsPage() {
  const [sp, setSp] = useSearchParams();
  useEnsureTabParam("skills");
  const q = (sp.get("q") ?? "").trim();
  const sort = readSort(sp);
  const [state, setState] = useState<State>(() => cachedSkillsState ?? { k: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [openSkill, setOpenSkill] = useState<string | null>(() => cachedSkillsOpen);
  const [rovingKey, setRovingKey] = useState<string | null>(null);
  // One result for the whole table: only the last-copied row shows its node.
  const [rowCopyResult, setRowCopyResult] = useState<CapRowCopyResult | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const rootRef = useRef<HTMLElement | null>(null);
  const fixture = currentFixtureState();
  const forced = forcedState(fixture, currentFixtureRid());
  const retry = () => {
    if (fixture) leavePreview();
    setAttempt((value) => value + 1);
  };

  const setRowParam = (row: SkillRow | null) => {
    setSp(row ? withRowTarget(sp, "skills", row.name) : withoutRowTarget(sp), { replace: true });
  };
  const openSkillRow = (row: SkillRow) => {
    setOpenSkill(row.id);
    setRowParam(row);
  };
  const closeSkillRow = () => {
    setOpenSkill(null);
    setRowParam(null);
  };
  const toggleSkillRow = (row: SkillRow) => {
    if (openSkill === row.id) closeSkillRow();
    else openSkillRow(row);
  };
  const clearRowLookup = () => {
    const next = withoutRowTarget(sp);
    next.delete("q");
    setSp(next, { replace: true });
  };

  useEffect(() => {
    cachedSkillsOpen = openSkill;
  }, [openSkill]);

  useEffect(() => {
    const root = rootRef.current;
    if (noteTabMount("skills")) {
      restoreTabView("skills", root);
      focusTabButton("skills");
    }
    const capture = () => {
      if (rootRef.current) {
        captureTabView("skills", rootRef.current, '[data-testid^="skl4-row-"]');
      }
    };
    window.addEventListener("scroll", capture, true);
    return () => {
      capture();
      window.removeEventListener("scroll", capture, true);
    };
  }, []);

  useEffect(() => {
    if (!openSkill) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSkillRow();
        rowRefs.current[openSkill]?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openSkill, sp]);

  const load = useCallback(async (signal: { live: boolean }) => {
    setState({ k: "loading" });
    publishCapabilityCount("skills", { value: null, source: "loading", reason: null, gap: null });
    try {
      const body = await fetchJsonStrict("/agent-api/api/skills");
      if (!signal.live) return;
      const { rows, asOf, asOfReason, asOfTitle, total, nextCursor } = readSkills(body);
      publishCapabilityCount("skills", {
        value: rows.length,
        source: rows.length ? "ready" : "empty",
        reason: null,
        gap: null,
      });
      const next: State = rows.length
        ? { k: "ready", rows, asOf, asOfReason, asOfTitle, total, nextCursor }
        : { k: "empty" };
      cachedSkillsState = next;
      setState(next);
    } catch (error) {
      if (!signal.live) return;
      const gap = error instanceof ApiError && (error.status === 403 || error.status === 404) ? SKILLS_GAP : null;
      const message = messageFor(error);
      publishCapabilityCount("skills", { value: null, source: "missing", reason: message, gap });
      const next: State = {
        k: "error",
        message,
        requestId: requestIdOf(error),
        gap,
        status: error instanceof ApiError ? error.status : null,
      };
      cachedSkillsState = next;
      setState(next);
    }
  }, []);

  useEffect(() => {
    if (forced) return;
    if (attempt === 0 && cachedSkillsState) return;
    const signal = { live: true };
    void load(signal);
    return () => {
      signal.live = false;
    };
  }, [attempt, forced, load]);

  const page = forced ?? fixtureView<State | null>(fixture ?? "ready", {
    loading: () => ({ k: "loading" }),
    empty: () => ({ k: "empty" }),
    error: () => forcedState("error", currentFixtureRid()),
    ready: () => null,
  }) ?? state;
  const visibleRows = page.k === "ready" && q
    ? page.rows.filter((row) => row.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()))
    : page.k === "ready" ? page.rows : [];
  const sortedRows = sortRows(visibleRows, sort, (row: SkillRow, key) =>
    key === "name" ? row.name : key === "type" ? row.source : row.updatedAt);
  const pageScope = derivePageScope({
    shown: sortedRows.length,
    total: page.k === "ready" ? page.total : null,
    nextCursor: page.k === "ready" ? page.nextCursor : null,
    loading: page.k === "loading",
    unavailableReason: page.k === "error" ? page.message : null,
  });
  const activeSkillKey =
    rovingKey && sortedRows.some((row) => row.id === rovingKey)
      ? rovingKey
      : sortedRows[0]?.id ?? null;
  const linkTarget = rowTargetFor(sp, "skills");
  const linkedRow = linkTarget ? sortedRows.find((row) => row.name === linkTarget.name) ?? null : null;
  const rowMissing = Boolean(linkTarget && (page.k === "ready" || page.k === "empty") && !linkedRow);
  const rowMissingReason = linkTarget
    ? q
      ? `当前搜索词「${q}」把这个条目隐藏了，或它已不在台账里。`
      : "当前台账里没有这个条目；它可能已被删除或改名。"
    : "";
  const onRowKeyDown = (
    event: ReactKeyboardEvent<HTMLTableRowElement>,
    row: SkillRow,
    index: number,
  ) => {
    if (event.target !== event.currentTarget) return;
    const move = (nextIndex: number) => {
      const target = sortedRows[nextIndex];
      if (!target) return;
      event.preventDefault();
      setRovingKey(target.id);
      rowRefs.current[target.id]?.focus();
    };
    if (event.key === "ArrowDown") move(Math.min(index + 1, sortedRows.length - 1));
    else if (event.key === "ArrowUp") move(Math.max(index - 1, 0));
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(sortedRows.length - 1);
    else if (event.key === "Enter") {
      event.preventDefault();
      toggleSkillRow(row);
    } else if (event.key === "Escape") {
      if (openSkill === row.id) {
        event.preventDefault();
        closeSkillRow();
      }
      rowRefs.current[row.id]?.focus();
    }
  };
  const onSort = (key: SortKey) => {
    const next = cycleSort(sort, key);
    const params = new URLSearchParams(sp);
    applySort(params, next);
    setSp(params);
  };
  const setQ = (next: string) => {
    const params = new URLSearchParams(sp);
    if (next) params.set("q", next); else params.delete("q");
    setSp(params, { replace: true });
  };

  const exportRows = sortedRows.map((row) => ({
    name: row.name === "—" ? null : row.name,
    type: row.source,
    enabled: row.status,
    updated_at: row.updatedAt,
  }));
  const copyRows = sortedRows.map((row) => ({
    name: row.name,
    type: row.source,
    enabled: row.status,
    updated_at: row.updatedAt,
  }));
  const unavailable = page.k === "error" && (page.status === 403 || page.status === 404);
  const capState = page.k === "error" ? (unavailable ? "unavailable" : "error") : page.k;
  const gatePhase: GatePhase =
    page.k === "error"
      ? unavailable ? "denied" : "error"
      : page.k === "ready" && q && visibleRows.length === 0
        ? "no-match"
        : page.k;
  const gates = deriveGates({
    phase: gatePhase,
    reason: page.k === "error" ? page.message : null,
    requestId: page.k === "error" ? page.requestId : null,
    gap: page.k === "error" ? page.gap : null,
    rowsLoaded: page.k === "ready" ? page.rows.length : 0,
    rowsVisible: visibleRows.length,
    hasQuery: Boolean(q),
  });

  useEffect(() => {
    if (page.k === "ready") {
      publishCapabilityCount("skills", {
        value: visibleRows.length,
        source: visibleRows.length ? "ready" : "empty",
        reason: gates.counts.title,
        gap: null,
      });
      return;
    }
    if (page.k === "empty") {
      publishCapabilityCount("skills", { value: 0, source: "empty", reason: gates.counts.title, gap: null });
      return;
    }
    publishCapabilityCount("skills", {
      value: null,
      source: page.k === "loading" ? "loading" : "missing",
      reason: gates.counts.title,
      gap: null,
    });
  }, [page.k, gates.counts.title, visibleRows.length]);

  useEffect(() => {
    if (!linkTarget) return;
    if (linkedRow) {
      setOpenSkill(linkedRow.id);
      const timer = window.setTimeout(() => {
        rowRefs.current[linkedRow.id]?.scrollIntoView?.({ block: "center" });
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (page.k === "ready" || page.k === "empty") setOpenSkill(null);
  }, [linkTarget?.tab, linkTarget?.name, linkedRow?.id, page.k]);

  return (
    <section ref={rootRef} className="skl4-page capH-scroll" data-testid="skl4-page" data-fixture={fixture ?? undefined} data-cap-state={capState}>
      <span className="sr-only" data-testid="capH-page-skills" />
      <span className="sr-only" data-testid="cap-gates-counts" data-enabled={gates.counts.enabled ? "true" : "false"} title={gates.counts.title} />
      <span className="sr-only" data-testid="cap-gates-sort" data-enabled={gates.sort.enabled ? "true" : "false"} title={gates.sort.title} />
      <span className="sr-only" data-testid="cap-gates-detail" data-enabled={gates.rowDetail.enabled ? "true" : "false"} title={gates.rowDetail.title} />
      <CapabilityCounts />
      <CapabilitySearch value={q} total={page.k === "ready" ? page.rows.length : 0} onChange={setQ} gate={gates.search} />
      <CapabilityPageScope scope={pageScope} />
      {rowMissing ? (
        <RowMissingNotice reason={rowMissingReason} href={listHref(sp)} onClear={clearRowLookup} />
      ) : null}
      <header className="skl4-head">
        <div className="min-w-0">
          <h1>技能</h1>
          <p className="skl4-sub">已登记的技能、共享范围与版本状态。只读。</p>
        </div>
        <div className="skl4-actions">
          <CapabilityExport tab="skills" rows={exportRows} scope={pageScope} gate={gates.export} q={q} sort={sort.key} dir={sort.key ? sort.dir : null} />
          <CapabilityCopy rows={copyRows} gate={gates.copy} />
          <span className="capA-export-note" data-testid="capA-export-order-note">导出按当前排序与搜索</span>
          <Button
            size="sm"
            outlined
            disabled
            aria-disabled="true"
            data-planned="true"
            title="控制台还没有技能写入口；接入后会提供新建与管理。"
            data-testid="skl4-planned-create"
          >
            新建技能
          </Button>
          <Button size="sm" outlined onClick={retry} disabled={page.k === "loading"} data-testid="skl4-refresh">
            <RefreshCw className="mr-1 size-3.5" aria-hidden="true" />重新读取
          </Button>
        </div>
      </header>

      {fixture ? <p className="skl4-preview" data-testid="skl4-preview-note">预览状态：以下内容只用于验收布局，不是实时数据。</p> : null}

      {page.k === "loading" ? (
        <Card className="capF-state"><CardContent className="space-y-3 p-4" data-testid="skl4-loading" aria-busy="true">
          <CapStateAnchor testid="capF-state-loading" anchor={stateAnchor({ kind: "loading", subject: "技能" })} />
          {[1, 2, 3, 4].map((item) => <div key={item} className="skl4-skeleton" />)}
        </CardContent></Card>
      ) : null}

      {page.k === "empty" ? (
        <Card className="capF-state"><CardContent className="space-y-2 p-8 text-center" data-testid="skl4-empty">
          <span className="sr-only" data-testid="cap9-state-empty" />
          <p className="skl4-empty-title">还没有已登记的技能</p>
          <CapStateAnchor testid="capF-state-empty" anchor={stateAnchor({ kind: "empty", subject: "技能" })} />
        </CardContent></Card>
      ) : null}

      {page.k === "error" ? (
        <Card className="capF-state"><CardContent className="space-y-3 p-6" data-testid="skl4-error" role="alert">
          {(page.status === 403 || page.status === 404) ? (
            <span className="sr-only" data-testid={page.status === 403 ? "cap9-state-denied" : "cap9-state-unavailable"} />
          ) : null}
          <CapStateAnchor
            testid={unavailable ? "capF-state-unavailable" : "capF-state-error"}
            anchor={stateAnchor({
              kind: unavailable ? "denied" : "error",
              subject: "技能",
              heading: unavailable ? "技能读口未接入" : "技能列表暂时无法读取",
              reason: page.message,
              gap: page.gap,
              requestId: page.requestId,
            })}
          />
          <RequestId id={page.requestId} />
          <div className="skl4-actions">
            <span className="contents" data-testid="capF-retry">
              <Button size="sm" outlined onClick={retry} data-testid="skl4-retry">重试</Button>
            </span>
            {page.gap ? <a className="skl4-apply" href="#/approvals" data-testid="skl4-apply">提交开通申请</a> : null}
          </div>
        </CardContent></Card>
      ) : null}

      {page.k === "ready" ? (
        <Card>
          <CardContent className="p-0">
            <p className="skl4-source" data-testid="skl4-source">来源：技能台账 · 读取于 {page.asOf ?? "—（未提供读取时刻）"}</p>
            {q && visibleRows.length === 0 ? (
              <div className="cap5-no-match" data-testid="skl4-no-match">
                <CapStateAnchor
                  testid="capF-state-filter-empty"
                  anchor={stateAnchor({
                    kind: "filter-empty",
                    subject: "技能",
                    reason: q,
                    loaded: page.rows.length,
                  })}
                />
                <button type="button" className="cap5-clear" onClick={() => setQ("")} data-testid="skl4-clear">清空搜索</button>
              </div>
            ) : (
            <div className="skl4-scroll">
              <table className="skl4-table" data-testid="skl4-table">
                <thead>
                  <tr>
                    <th scope="col" aria-sort={ariaSort(sort, "name")}>
                      <button type="button" className="cap8-sort" data-testid="cap8-sort-name" disabled={!gates.sort.enabled} title={gates.sort.title} onClick={() => onSort("name")}>
                        技能名<span className="cap8-indicator" data-testid="cap8-indicator-name">{ariaSort(sort, "name") === "ascending" ? "↑" : ariaSort(sort, "name") === "descending" ? "↓" : "↕"}</span>
                      </button>
                    </th>
                    <th scope="col" aria-sort={ariaSort(sort, "type")}>
                      <button type="button" className="cap8-sort" data-testid="cap8-sort-type" disabled={!gates.sort.enabled} title={gates.sort.title} onClick={() => onSort("type")}>
                        来源/类型<span className="cap8-indicator" data-testid="cap8-indicator-type">{ariaSort(sort, "type") === "ascending" ? "↑" : ariaSort(sort, "type") === "descending" ? "↓" : "↕"}</span>
                      </button>
                    </th>
                    <th scope="col">启用态</th>
                    <th scope="col" aria-sort={ariaSort(sort, "updated")}>
                      <button type="button" className="cap8-sort" data-testid="cap8-sort-updated" disabled={!gates.sort.enabled} title={gates.sort.title} onClick={() => onSort("updated")}>
                        最近更新<span className="cap8-indicator" data-testid="cap8-indicator-updated">{ariaSort(sort, "updated") === "ascending" ? "↑" : ariaSort(sort, "updated") === "descending" ? "↓" : "↕"}</span>
                      </button>
                    </th>
                    <th scope="col">共享范围</th>
                    {sortedRows.length > 0 ? <th scope="col">复制</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, index) => (
                    <Fragment key={row.id}>
                    <tr
                      data-testid={`skl4-row-${row.id}`}
                      title={row.id}
                      ref={(node) => { rowRefs.current[row.id] = node; }}
                      tabIndex={row.id === activeSkillKey ? 0 : -1}
                      aria-expanded={openSkill === row.id}
                      aria-current={openSkill === row.id ? "true" : undefined}
                      onFocus={() => setRovingKey(row.id)}
                      onKeyDown={(event) => onRowKeyDown(event, row, index)}
                    >
                      <td>
                        <span className="skl4-cell">
                          <span className={row.name === "—" ? "skl4-missing" : ""} title={row.nameReason ?? undefined}>{row.name}</span>
                          {row.nameReason ? <span className="skl4-reason">{row.nameReason}</span> : null}
                          {row.version ? <span className="skl4-reason">版本 {row.version}</span> : null}
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="cap7-toggle"
                              aria-expanded={openSkill === row.id}
                              disabled={!gates.rowDetail.enabled}
                              title={gates.rowDetail.title}
                              onClick={() => toggleSkillRow(row)}
                              data-testid="cap7-detail-toggle"
                            >
                              {openSkill === row.id ? "收起" : "详情"}
                            </button>
                            <a
                              className="cap-row-link"
                              href={rowHref("skills", row.name, sp)}
                              data-testid="cap-row-link"
                              onClick={(event) => {
                                event.preventDefault();
                                openSkillRow(row);
                              }}
                            >
                              链接
                            </a>
                            {openSkill === row.id ? (
                              <button
                                type="button"
                                className="cap-row-close"
                                onClick={closeSkillRow}
                                data-testid="cap-row-close"
                              >
                                关闭
                              </button>
                            ) : null}
                          </span>
                        </span>
                      </td>
                      <td><Cell value={row.source} reason={row.sourceReason} /></td>
                      <td><Cell value={row.status} reason={row.statusReason} title={row.statusRaw} /></td>
                      <td><Cell value={row.updatedAt} reason={row.updatedAtReason} /></td>
                      <td><Badge tone="outline">{row.scope}</Badge></td>
                      {sortedRows.length > 0 ? (
                        <td>
                          <CapabilityRowCopyButton
                            index={index}
                            rowKey={row.id}
                            name={row.name === "—" ? "未署名条目" : row.name}
                            text={capRowCopyText({
                              name: row.name,
                              type: row.source,
                              status: row.status,
                              calls: null,
                              id: row.id,
                            })}
                            result={rowCopyResult}
                            onResult={setRowCopyResult}
                          />
                        </td>
                      ) : null}
                    </tr>
                    {openSkill === row.id ? (
                      <tr data-testid="cap7-detail-row-skills">
                        <td colSpan={sortedRows.length > 0 ? 6 : 5}>
                          <span className="sr-only" data-testid="cap-row-expanded" />
                          <CapabilityRowDetail
                            name={row.name === "—" ? null : row.name}
                            nameReason={row.nameReason}
                            type={row.source}
                            typeReason={row.sourceReason}
                            enabled={row.status}
                            enabledReason={row.statusReason}
                            enabledTitle={row.statusRaw}
                            updatedAt={row.updatedAt}
                            updatedReason={row.updatedAtReason}
                            endpoint="/agent-api/api/skills"
                            asOf={page.asOf}
                            asOfReason=""
                            asOfTitle={page.asOfTitle}
                            testid="cap7-detail-skills"
                          />
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            <p className="skl4-note skl4-foot">列表未提供的来源、启用态与最近更新一律显示「—」，不从前端补造；无法归类的状态显示「待核实」。</p>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

export const formatSkillTime = formatBeijingTime;
export default SkillsPage;