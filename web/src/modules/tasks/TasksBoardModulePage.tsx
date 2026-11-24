/**
 * Lane work · T14 task board (`#/work`, board tab).
 *
 * Read-only: list reads five status columns, detail reads one task. There is
 * no drag/transition call, so the board can never show a state the backend
 * did not confirm. Missing values render "—"; unknown states stay unknown.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { RequestIdCopy } from "@/components/RequestIdCopy";
import { AlertTriangle, Inbox, RefreshCw, ShieldAlert, X } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import {
  actorLabel,
  beijing,
  BOARD_STATUSES,
  detailError,
  EMPTY_BOARD,
  loadBoard,
  loadDetail,
  loadFiltered,
  loadNamesOnly,
  money,
  priorityLabel,
  short8,
  shortRef,
  sourceLabel,
  statusLabel,
  type BoardState,
  type FilterResult,
  type TaskDetail,
  type TaskRow,
} from "./tasksBoard";
import { TaskCreateForm } from "./TaskCreateForm";
import { ConsoleSelect } from "@/shell/ConsoleSelect";
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { Pill } from "@/components/console/Pill";
import "./tasks-density.css";

/** 组内排序键：优先级高→低，同级按更新时间新→旧；未知按最后。 */
const PRIORITY_RANK: Record<string, number> = { high: 0, urgent: 0, normal: 1, low: 2 };

const COLUMN_LABEL: Record<(typeof BOARD_STATUSES)[number], string> = {
  open: "待处理",
  in_progress: "进行中",
  blocked: "阻塞",
  done: "已完成",
  cancelled: "已取消",
};

type DetailState =
  | { k: "idle" }
  | { k: "loading"; id: string }
  | { k: "ready"; id: string; data: TaskDetail }
  | { k: "error"; id: string; status: number; message: string; requestId: string | null };

/**
 * QA V4-R4 条目2: 错误面板要有真出口。壳与页脚没有既有联系入口（grep：
 * src/shell 内 0 个 mailto/联系），所以给带注释的 mailto 缺省，不是死链。
 * 运维给出真实地址后替换此常量。
 */
const CONTACT_ADMIN_HREF = "mailto:workspace-admin@hermes.local?subject=Hermes%20%E6%8E%A7%E5%88%B6%E5%8F%B0%E9%97%AE%E9%A2%98%E5%8F%8D%E9%A6%88";

/** QA V4-R4 条目5: 缺编号时给可执行的话术，不写「未提供」。 */
function BoardSkeleton() {
  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5" data-testid="tsk4-loading" aria-busy="true">
      {BOARD_STATUSES.map((status) => (
        <Card key={status} className="min-w-0">
          <CardContent className="space-y-3 p-4">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DetailField({ label, children, num }: { label: string; children: React.ReactNode; num?: boolean }) {
  return (
    <div className="ui-c-field">
      <dt className="ui-c-field-label">{label}</dt>
      <dd className={num ? "ui-c-field-value ui-c-num" : "ui-c-field-value"}>{children}</dd>
    </div>
  );
}

function TaskDetailCard({
  state,
  nameMap,
  onClose,
  onRetry,
}: {
  state: DetailState;
  nameMap: Record<string, string>;
  onClose: () => void;
  onRetry: () => void;
}) {
  if (state.k === "idle") return null;
  const title = state.k === "ready" ? state.data.title : "任务详情";
  return (
    <Card className="min-w-0" data-testid={`tsk4-detail-${state.k}`}>
      <CardContent className="ui-c-container min-w-0 space-y-4 p-4">
        <div className="ui-c-head ui-c-head--plain ui-c-head--start">
          <div className="ui-c-head-text">
            {state.k === "ready" ? (
              <Link
                to={`/tasks/${encodeURIComponent(state.data.taskId)}`}
                className="ui-c-head-title ui-c-head-title--lead hover:underline"
                title={state.data.taskId}
                data-testid="tsk4-detail-link"
              >
                {title}
              </Link>
            ) : (
              <h2 className="ui-c-head-title ui-c-head-title--lead" title={title}>{title}</h2>
            )}
            <p className="ui-c-head-sub" title="深链 /tasks/<任务编号> 可直开；分享与刷新都保持同一屏。" data-testid="tsk4-detail-note">
              详情支持按任务深链（/tasks/ 加任务编号）；页面里显示的是短码，完整编号在标题悬停。
            </p>
            {state.k === "ready" ? (
              <p className="ui-c-head-sub ui-c-num">
                {statusLabel(state.data.status)} · 更新 {beijing(state.data.updatedAt)}
              </p>
            ) : null}
          </div>
          <span className="ui-c-head-actions">
            <Button size="sm" outlined onClick={onClose} prefix={<X className="h-3.5 w-3.5" />}>
              关闭
            </Button>
          </span>
        </div>

        {state.k === "loading" ? (
          <div className="space-y-2" aria-busy="true">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ) : state.k === "error" ? (
          <div className="space-y-2" role="alert">
            <p className="text-sm">{state.message}</p>
            <p className="break-words text-xs text-muted-foreground">
              <RequestIdCopy requestId={state.requestId} fallback="本次请求未记录编号，可复制时间与操作路径反馈" />
            </p>
            <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />} data-testid="tsk4-detail-retry">
              重试
            </Button>
          </div>
        ) : (
          <dl className="ui-c-fields ui-c-fields--compact">
            <DetailField label="优先级">{priorityLabel(state.data.priority).text}</DetailField>
            <DetailField label="负责人">{actorLabel(state.data.assignee, nameMap)}</DetailField>
            <DetailField label="截止时间" num>{beijing(state.data.dueAt)}</DetailField>
            <DetailField label="成本" num>
              {typeof state.data.cost === "number" && Number.isFinite(state.data.cost)
                ? money(state.data.cost)
                : <span title="后台没有回传这条任务的成本。">—</span>}
            </DetailField>
            <DetailField label="来源">
              <span title={state.data.source ? undefined : "后台没有回传这条任务的来源信息。"}>{sourceLabel(state.data.source)}</span>
            </DetailField>
            <DetailField label="创建人">{actorLabel(state.data.createdBy, nameMap)}</DetailField>
            <DetailField label="创建时间" num>{beijing(state.data.createdAt)}</DetailField>
            <DetailField label="任务编号">
              <span className="ui-c-id" title={state.data.taskId}>{shortRef(state.data.taskId)}</span>
            </DetailField>
            <DetailField label="完成时间" num>{beijing(state.data.closedAt)}</DetailField>
            <DetailField label="关联任务" num>
              {state.data.relatedTaskIds?.length ? `${state.data.relatedTaskIds.length} 项` : "—"}
            </DetailField>
            <div className="ui-c-field--span">
              <DetailField label="说明">{state.data.description ?? "—"}</DetailField>
            </div>
            <div className="ui-c-field--span">
              <DetailField label="最近进展">{state.data.progressNote ?? "—"}</DetailField>
            </div>
            {state.data.status === "blocked" || state.data.status === "cancelled" ? (
              <div className="ui-c-field--span">
                <DetailField label="状态原因">{state.data.statusReason ?? "—"}</DetailField>
              </div>
            ) : null}
            <div className="ui-c-field--span">
              <DetailField label="最近事件">
                {state.data.events && state.data.events.length > 0 ? (
                  <ul className="ui-c-rows min-w-0">
                    {state.data.events.slice(0, 3).map((ev, i) => (
                      <li className="ui-c-row ui-c-num" key={ev.eventId ?? `ev-${i}`} title={ev.eventId ?? undefined}>
                        {beijing(ev.at)} · {ev.kind ?? "事件"}
                        {ev.note ? ` · ${ev.note}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span title="后台没有回传这条任务的事件记录。">无事件</span>
                )}
              </DetailField>
            </div>
          </dl>
        )}
        {state.k === "ready" ? (
          <div className="ui-c-section flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              outlined
              disabled
              data-planned="true"
              aria-disabled="true"
              title="状态迁移将在后续版本开放，这里暂时不能操作。"
              data-testid="tsk4-detail-transition"
            >
              迁移
            </Button>
            <span className="text-xs text-muted-foreground">状态迁移将在后续版本开放。</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function TasksBoardModulePage() {
  const [params, setParams] = useSearchParams();
  const forced = params.get("state");
  const forceRid = params.get("rid");
  const [board, setBoard] = useState<BoardState>(EMPTY_BOARD);
  const [tick, setTick] = useState(0);
  // R40 deep link: /tasks/<taskId> opens the drawer straight from the URL;
  // on the board the same drawer lives in ?task=, so refresh keeps state and
  // browser back closes (or reopens) it instead of losing it.
  const location = useLocation();
  const navigate = useNavigate();
  const deepTaskId = (() => {
    const m = location.pathname.match(/^\/tasks\/([^/]+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  })();
  const selected = deepTaskId ?? params.get("task");
  const [detail, setDetail] = useState<DetailState>({ k: "idle" });
  const [createOpen, setCreateOpen] = useState(false);
  // P2: real filter + cursor paging leg. The URL carries the filter state so
  // a refreshed or shared page reopens exactly the same answer.
  const fStatus = params.get("status");
  const fAssignee = params.get("assignee");
  const fCursor = params.get("cursor");
  const filterActive = Boolean(fStatus) || Boolean(fAssignee);
  // R41: the single-query panel view follows the STATUS filter only. An
  // assignee filter keeps the five-column board and is passed to each leg,
  // so column counts stay linked to the filter instead of hiding the board.
  const panelActive = Boolean(fStatus);
  const [filtered, setFiltered] = useState<FilterResult | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  // 骨架 filterbar：搜索只筛这一页已经读到的行，不冒充服务端搜索。
  const [q, setQ] = useState("");
  // 骨架来源 chip：全部任务 / 渠道任务（非人工来源）。
  const [sourceFilter, setSourceFilter] = useState<"all" | "channel">("all");

  const patchParams = useCallback((next: Record<string, string | null>) => {
    const draft = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null) draft.delete(k);
      else draft.set(k, v);
    }
    setParams(draft, { replace: true });
  }, [params, setParams]);

  const applyFilter = useCallback((next: { status?: string | null; assignee?: string | null }) => {
    patchParams({
      status: next.status === undefined ? fStatus : next.status,
      assignee: next.assignee === undefined ? fAssignee : next.assignee,
      cursor: null,
    });
    setCursorStack([]);
    setFiltered(null);
  }, [fStatus, fAssignee, patchParams]);

  const clearFilter = useCallback(() => {
    patchParams({ status: null, assignee: null, cursor: null });
    setCursorStack([]);
    setFiltered(null);
  }, [patchParams]);

  const nextPage = useCallback(() => {
    if (filtered?.phase !== "ready" || !filtered.nextCursor) return;
    setCursorStack((stack) => [...stack, fCursor ?? ""]);
    patchParams({ cursor: filtered.nextCursor });
    setFiltered(null);
  }, [filtered, fCursor, patchParams]);

  const prevPage = useCallback(() => {
    setCursorStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      patchParams({ cursor: prev === "" ? null : prev });
      setFiltered(null);
      return stack.slice(0, -1);
    });
  }, [patchParams]);

  useEffect(() => {
    if (!panelActive) {
      setFiltered(null);
      return;
    }
    let alive = true;
    void loadFiltered({ status: fStatus, assignee: fAssignee, cursor: fCursor }).then((res) => {
      if (alive) setFiltered(res);
    });
    return () => { alive = false; };
  }, [panelActive, fStatus, fAssignee, fCursor, tick]);

  const assigneeOptions = useMemo(
    () =>
      Object.entries(board.nameMap).map(([id, name]) => ({
        value: `employee:${id}`,
        label: `${name} · ${short8(id)}`,
      })),
    [board.nameMap],
  );

  const openTask = useCallback(
    (taskId: string) => {
      if (deepTaskId) {
        navigate(`/tasks/${encodeURIComponent(taskId)}`);
        return;
      }
      const draft = new URLSearchParams(params);
      draft.set("task", taskId);
      setParams(draft);
    },
    [deepTaskId, navigate, params, setParams],
  );

  const closeTask = useCallback(() => {
    if (deepTaskId) {
      navigate("/work?tab=board");
      return;
    }
    const draft = new URLSearchParams(params);
    draft.delete("task");
    setParams(draft);
  }, [deepTaskId, navigate, params, setParams]);

  const afterCreate = useCallback((taskId: string) => {
    // Refresh the board and open the new task's detail through the real link.
    openTask(taskId);
    setTick((n) => n + 1);
  }, [openTask]);

  useEffect(() => {
    let alive = true;
    if (forced === "loading") {
      setBoard({ ...EMPTY_BOARD, phase: "loading" });
      return () => { alive = false; };
    }
    if (forced === "empty") {
      setBoard({ phase: "empty", rows: [], status: 200, message: "", requestId: null, nameMap: {} });
      return () => { alive = false; };
    }
    if (forced === "denied") {
      setBoard({
        phase: "denied",
        rows: [],
        status: 403,
        message: "没有查看任务看板的权限，或该数据源尚未接入。",
        requestId: forceRid ?? null,
        nameMap: {},
      });
      return () => { alive = false; };
    }
    if (forced === "error") {
      setBoard({
        phase: "error",
        rows: [],
        status: 502,
        message: "任务服务暂时没有响应，请稍后重试。",
        requestId: forceRid ?? null,
        nameMap: {},
      });
      return () => { alive = false; };
    }
    setBoard((prev) => ({ ...prev, phase: "loading" }));
    // P2: the filter view replaces the columns, so only the directory leg
    // runs — one real /api/tasks query comes from loadFiltered below.
    const loader = panelActive ? loadNamesOnly : () => loadBoard(fAssignee);
    void loader().then((next) => {
      if (alive) setBoard(next);
    });
    return () => { alive = false; };
  }, [forced, forceRid, tick, panelActive, fAssignee]);

  useEffect(() => {
    if (!selected) {
      setDetail({ k: "idle" });
      return () => {};
    }
    let alive = true;
    // R40: ?state= swaps the detail content itself, not just the corner tag.
    if (forced === "loading") {
      setDetail({ k: "loading", id: selected });
      return () => { alive = false; };
    }
    if (forced === "error" || forced === "empty" || forced === "denied") {
      setDetail({
        k: "error",
        id: selected,
        status: forced === "denied" ? 403 : forced === "empty" ? 404 : 502,
        message:
          forced === "denied"
            ? "没有查看这条任务的权限，或该数据源尚未接入。"
            : forced === "empty"
              ? "这条任务没有可展示的内容：后台返回为空，不是加载失败。"
              : "任务详情没能加载出来：接口暂时不可达。",
        requestId: forceRid ?? "preview-request",
      });
      return () => { alive = false; };
    }
    setDetail({ k: "loading", id: selected });
    void loadDetail(selected)
      .then((data) => alive && setDetail({ k: "ready", id: selected, data }))
      .catch((err: unknown) => {
        if (!alive) return;
        const info = detailError(err);
        setDetail({ k: "error", id: selected, ...info });
      });
    return () => { alive = false; };
  }, [selected, tick, forced, forceRid]);

  const visibleRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return board.rows.filter((row) => {
      const isChannel = (row.sourceKind !== undefined && row.sourceKind !== "manual") || Boolean(row.sourceChannel);
      if (sourceFilter === "channel" && !isChannel) return false;
      if (!needle) return true;
      return (
        row.title.toLowerCase().includes(needle) ||
        actorLabel(row.assignee, board.nameMap).toLowerCase().includes(needle)
      );
    });
  }, [board.rows, board.nameMap, q, sourceFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const status of BOARD_STATUSES) map.set(status, []);
    for (const row of visibleRows) {
      if (map.has(row.status)) map.get(row.status)!.push(row);
    }
    for (const rows of map.values()) {
      rows.sort(
        (a, b) =>
          (PRIORITY_RANK[a.priority ?? ""] ?? 3) - (PRIORITY_RANK[b.priority ?? ""] ?? 3) ||
          String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
      );
    }
    return map;
  }, [visibleRows]);

  const counts = useMemo(() => {
    const open = board.rows.filter((row) => row.status === "open").length;
    const blocked = board.rows.filter((row) => row.status === "blocked").length;
    const inProgress = board.rows.filter((row) => row.status === "in_progress").length;
    return { open, blocked, inProgress };
  }, [board.rows]);

  // 今日完成按关闭时间落在北京时间今天算；没有关闭时间的不计，也不补数。
  const todayDone = useMemo(() => {
    const now = new Date();
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return board.rows.filter((row) => {
      if (row.status !== "done" || !row.closedAt) return false;
      const ms = Date.parse(row.closedAt);
      return Number.isFinite(ms) && fmt.format(new Date(ms)) === day;
    }).length;
  }, [board.rows]);

  const channelCount = useMemo(
    () =>
      board.rows.filter(
        (row) => (row.sourceKind !== undefined && row.sourceKind !== "manual") || Boolean(row.sourceChannel),
      ).length,
    [board.rows],
  );

  // QA V4-R4 条目1: 取数失败或还在加载时，汇总不给硬零——只有请求成功且
  // 数据确为空才允许显示 0。
  const countsUnknown = board.phase === "loading" || board.phase === "error" || board.phase === "denied";
  const countsUnreadable = board.phase === "error" || board.phase === "denied";
  const boardReady = board.phase === "ready" || board.phase === "empty";
  const subLine = boardReady
    ? `${board.rows.length} 个任务 · ${counts.open} 待处理 · ${counts.inProgress} 进行中 · ${todayDone} 今日完成`
    : null;

  const retry = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="tsk4-board">
      {/* 骨架页头：外壳已给唯一 H1；这里只放副行真读数与两个动作。 */}
      <header className="console-toolbar" data-testid="tsk4-head">
        <p className="console-sub" data-testid="tsk4-sub">
          {subLine ?? "按后端状态看任务；拖动排序未启用，状态不会被前端改写。"}
        </p>
        <span className="console-grow" />
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            outlined
            onClick={() => setCreateOpen((v) => !v)}
            data-testid="tsk4-create-open"
          >
            {createOpen ? "收起新建" : "新建任务"}
          </Button>
          <Button
            size="sm"
            outlined
            onClick={retry}
            disabled={board.phase === "loading"}
            prefix={<RefreshCw className={"h-4 w-4" + (board.phase === "loading" ? " animate-spin" : "")} />}
          >
            刷新
          </Button>
        </div>
      </header>

      {createOpen ? (
        <TaskCreateForm
          nameMap={board.nameMap}
          onCreated={afterCreate}
          onClose={() => setCreateOpen(false)}
        />
      ) : null}

      {/* 骨架 chips：来源筛选，不是页签；一屏仍只有外壳那一排 tab。 */}
      <div className="console-toolbar" data-testid="tsk4-chips">
        <button
          type="button"
          className="console-chip-btn"
          aria-pressed={sourceFilter === "all"}
          data-testid="tsk4-chip-all"
          onClick={() => setSourceFilter("all")}
        >
          全部任务 {boardReady ? board.rows.length : "—"}
        </button>
        <button
          type="button"
          className="console-chip-btn"
          aria-pressed={sourceFilter === "channel"}
          data-testid="tsk4-chip-channel"
          onClick={() => setSourceFilter("channel")}
        >
          渠道任务 {boardReady ? channelCount : "—"}
        </button>
        <span className="console-sub">来源是任务的一种筛选，不单独占一排页签</span>
      </div>

      {/* filterbar：状态与负责人是真参数；优先级服务端未开放，禁用并说明。 */}
      <ConsoleCard flush>
        <div
          className="console-filterbar"
          role="group"
          aria-label="任务筛选"
          data-testid="tsk4-filter"
        >
          <input
            type="search"
            className="console-input"
            placeholder="搜索任务或员工"
            aria-label="搜索任务"
            data-testid="tsk4-search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            title="只筛当前已加载的看板行；不会向服务再要一次数据"
          />
          <ConsoleSelect
            aria-label="按状态筛选"
            data-testid="tsk4-filter-status"
            className="console-select"
            value={fStatus ?? ""}
            onChange={(next) => applyFilter({ status: next === "" ? null : next })}
            options={[
              { value: "", label: "状态：按看板列展示" },
              { value: "all", label: "全部（单查询聚合）" },
              ...BOARD_STATUSES.map((st) => ({ value: st, label: statusLabel(st) })),
            ]}
          />
          <ConsoleSelect
            aria-label="按负责人筛选"
            data-testid="tsk4-filter-assignee"
            className="console-select"
            value={fAssignee ?? ""}
            onChange={(next) => applyFilter({ assignee: next === "" ? null : next })}
            options={[
              { value: "", label: "负责人：不限" },
              ...assigneeOptions,
            ]}
          />
          <ConsoleSelect
            aria-label="按优先级筛选"
            data-testid="tsk4-filter-priority"
            className="console-select opacity-60"
            value=""
            onChange={() => undefined}
            disabled
            title="服务端优先级筛选尚未开放：带上它后台会返回未过滤的全量，为避免假过滤此处暂不可用"
            options={[{ value: "", label: "优先级：暂不可筛" }]}
          />
          <Button
            size="sm"
            outlined
            data-testid="tsk4-filter-clear"
            disabled={!filterActive && q === "" && sourceFilter === "all"}
            onClick={() => {
              clearFilter();
              setQ("");
              setSourceFilter("all");
            }}
          >
            清空筛选
          </Button>
          <span className="console-grow" />
          <span className="console-sub console-mono" data-testid="status">
            {countsUnknown ? "待处理 — · 阻塞 —" : `待处理 ${counts.open} · 阻塞 ${counts.blocked}`}
          </span>
          {countsUnreadable ? (
            <span data-testid="tasks-summary-caveat" className="console-sub">
              {board.phase === "denied" ? "暂时读不到任务数据（没有查看权限）" : "暂时读不到任务数据，请稍后重试"}
            </span>
          ) : null}
          <span className="console-sub console-mono" data-testid="tsk4-filter-count">
            本页 {boardReady ? visibleRows.length : "—"} / {boardReady ? board.rows.length : "—"} 条
          </span>
        </div>
      </ConsoleCard>

      {countsUnreadable ? (
        <details className="console-sub" data-testid="tasks-summary-caveat-detail">
          <summary className="cursor-pointer">详情</summary>
          <p className="mt-1">
            {board.phase === "denied" ? "没有查看权限时数字不作零处理" : "接口不可达时数字不作零处理"}：读不到就是「—」，不按 0 算。
            {board.requestId ? `请求编号：${board.requestId}` : ""}
          </p>
        </details>
      ) : null}

      <TaskDetailCard
        state={detail}
        nameMap={board.nameMap}
        onClose={closeTask}
        onRetry={() => setTick((n) => n + 1)}
      />

      {panelActive ? (
        <section className="min-w-0 space-y-3" data-testid="tsk4-filter-view">
          {!filtered ? (
            <BoardSkeleton />
          ) : filtered.phase !== "ready" ? (
            <Card data-testid={`tsk4-filter-${filtered.phase}`}>
              <CardContent className="flex min-w-0 items-start gap-3 p-4">
                {filtered.phase === "denied" ? (
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                )}
                <div className="min-w-0">
                  <p className="text-sm">
                    {filtered.phase === "denied" ? "暂时看不到符合条件的任务" : "任务筛选没能加载出来"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{filtered.message || "后台没有给出原因。"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <RequestIdCopy requestId={filtered.requestId} fallback="本次请求未记录编号，可复制时间与操作路径反馈" />
                  </p>
                  <Button size="sm" outlined className="mt-2" data-testid="tsk4-filter-retry" onClick={() => setTick((n) => n + 1)}>
                    重试
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : filtered.rows.length === 0 ? (
            <Card data-testid="tsk4-filter-empty">
              <CardContent className="flex min-w-0 items-start gap-3 p-4">
                <Inbox className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm">没有符合条件的任务。</p>
                  <p className="mt-1 text-xs text-muted-foreground">这是服务端的真实回答：当前筛选组合下没有任务；不是加载失败。</p>
                  <Button size="sm" outlined className="mt-2" onClick={clearFilter}>清空筛选</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card data-testid="tsk4-filter-list">
              <CardContent className="p-0">
                <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.8fr)] gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground sm:grid">
                  <span>任务</span>
                  <span>负责人</span>
                  <span>优先级</span>
                  <span>状态</span>
                  <span>更新</span>
                  <span>花费</span>
                </div>
                <ul className="divide-y divide-border">
                  {filtered.rows.map((row) => (
                    <li
                      key={row.taskId}
                      data-testid={`tsk4-filter-row-${row.taskId}`}
                      className="grid grid-cols-1 gap-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.8fr)] sm:items-center sm:gap-2"
                    >
                      <button
                        type="button"
                        className="min-w-0 truncate text-left hover:underline focus-visible:underline"
                        onClick={() => openTask(row.taskId)}
                      >
                        {row.title}
                      </button>
                      <span className="min-w-0 truncate text-xs text-muted-foreground">{actorLabel(row.assignee, board.nameMap)}</span>
                      <span className="text-xs">{priorityLabel(row.priority).text}</span>
                      <span className="text-xs" title={row.status ?? undefined}>{statusLabel(row.status)}</span>
                      <span className="font-mono text-xs text-muted-foreground">{beijing(row.updatedAt)}</span>
                      <span className="text-xs">{money(row.cost)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="tsk4-page">
            <Button
              size="sm"
              outlined
              data-testid="tsk4-page-prev"
              disabled={cursorStack.length === 0}
              title={cursorStack.length === 0 ? "回放从当前页开始，上一页需要重新筛选进入" : undefined}
              onClick={prevPage}
            >
              上一页
            </Button>
            <span data-testid="tsk4-page-info">第 {cursorStack.length + 1} 页 · 本页最多 50 条{filtered?.phase === "ready" && filtered.nextCursor ? "" : " · 已到最后一页"}</span>
            <Button
              size="sm"
              outlined
              data-testid="tsk4-page-next"
              disabled={filtered?.phase !== "ready" || !filtered.nextCursor}
              onClick={nextPage}
            >
              下一页
            </Button>
          </div>
        </section>
      ) : null}

      {!panelActive && board.phase === "loading" ? <BoardSkeleton /> : null}

      {/* UI-B 空态组合：留白按令牌（p-10=40px 不在清单，收进 space-6/8）；
        * 单一主操作=「新建任务」——空态没有可清的筛选维度，根因出口就是创建
        * 第一条任务，所以主操作落进卡内（标题行按钮保持次级，屏上唯一实心）。 */}
      {!panelActive && board.phase === "empty" ? (
        <Card data-testid="tsk4-empty">
          <CardContent className="flex flex-col items-center gap-[var(--space-3)] px-[var(--space-6)] py-[var(--space-8)] text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold">还没有任务</h2>
            <p className="max-w-prose text-sm text-muted-foreground">任务进入看板后会按状态出现在这里。</p>
            <div className="flex flex-wrap items-center justify-center gap-[var(--space-2)] pt-[var(--space-2)]">
              <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="tsk4-empty-create">
                新建任务
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!panelActive && (board.phase === "error" || board.phase === "denied") ? (
        <Card data-testid={`tsk4-${board.phase}`}>
          <CardContent className="flex min-w-0 flex-col items-start gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-6)]">
            {board.phase === "denied" ? (
              <ShieldAlert className="h-5 w-5 text-amber-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-400" />
            )}
            <div className="min-w-0">
              <h2 className="text-base font-semibold">
                {board.phase === "denied" ? "任务看板暂不可见" : "任务没能加载出来"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{board.message}</p>
              <p className="mt-2 break-words text-xs text-muted-foreground">
                <RequestIdCopy
                  requestId={board.requestId}
                  fallback="本次请求未记录编号，可复制时间与操作路径反馈"
                />
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-[var(--space-2)]">
              <Button size="sm" onClick={retry} data-testid="tsk4-retry" prefix={<RefreshCw className="h-4 w-4" />}>
                重试
              </Button>
              <Link
                to="/overview"
                data-testid="tsk4-back"
                className="inline-flex h-8 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                返回控制台
              </Link>
              <a
                href={CONTACT_ADMIN_HREF}
                data-testid="tsk4-contact"
                className="inline-flex h-8 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                联系管理员
              </a>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!panelActive && board.phase === "ready" ? (
        <div className="console-board" data-testid="tsk4-columns">
          {BOARD_STATUSES.map((status) => {
            const rows = grouped.get(status) ?? [];
            return (
              <section key={status} className="console-board__col" data-testid={`tsk4-col-${status}`}>
                <div className="console-board__head">
                  <h2 className="console-board__title">{COLUMN_LABEL[status]}</h2>
                  {rows.length === 0 ? (
                    <span className="console-board__count" title="这一列当前是空的；空列不计数为 0">—</span>
                  ) : (
                    <span className="console-board__count" title="排序：优先级（高→低），同级按更新时间（新→旧）">
                      {rows.length} 条（本页已加载）
                    </span>
                  )}
                </div>
                {rows.length === 0 ? (
                  <p className="console-board__empty" data-testid={`tsk4-emptycol-${status}`}>
                    本列暂无任务{fAssignee ? "（当前正按负责人筛选，清空筛选或换一位负责人可见更多）" : ""}
                  </p>
                ) : (
                  rows.map((row) => {
                    const priority = priorityLabel(row.priority);
                    const tone = priority.tone === "warning" ? "warn" : "mut";
                    return (
                      <button
                        key={row.taskId}
                        type="button"
                        data-testid={`tsk4-card-${row.taskId}`}
                        aria-label={`查看任务 ${row.title}`}
                        className="console-board__card"
                        onClick={() => openTask(row.taskId)}
                      >
                        <h3 className="console-board__name">{row.title}</h3>
                        <div className="console-board__meta">
                          <span className="truncate">{actorLabel(row.assignee, board.nameMap)}</span>
                          <Pill tone={tone} dot={false} title={`优先级：${priority.text}`}>{priority.text}</Pill>
                        </div>
                        <div className="console-board__foot">
                          <span>{`更新 ${beijing(row.updatedAt)} · 成本 ${money(row.cost)}`}</span>
                        </div>
                        {row.progressNote ? (
                          <div className="console-board__foot">
                            <span title={row.progressNote}>{row.progressNote}</span>
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </section>
            );
          })}
        </div>
      ) : null}

      {!panelActive && board.phase === "ready" && visibleRows.length === 0 ? (
        <p className="console-sub" data-testid="tsk4-no-match">
          {board.rows.length === 0
            ? "看板这一页还没有任务。"
            : "没有匹配当前搜索或来源筛选的任务；搜索只筛已加载的看板行，清空即回到全部。"}
        </p>
      ) : null}

      {!panelActive && boardReady ? (
        <ConsoleCard>
          <div className="console-toolbar console-sub" data-testid="tsk4-board-foot">
            <span>拖动排序未启用；看板顺序按任务状态由后端决定</span>
            <span className="console-grow" />
            <span className="console-mono">今日完成 {todayDone} / 目标 —</span>
            <span className="console-mono">本页 {visibleRows.length} 条</span>
          </div>
        </ConsoleCard>
      ) : null}
    </div>
  );
}

export default TasksBoardModulePage;