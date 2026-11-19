/**
 * Lane work · T14 task board (`#/work`, board tab).
 *
 * Read-only: list reads five status columns, detail reads one task. There is
 * no drag/transition call, so the board can never show a state the backend
 * did not confirm. Missing values render "—"; unknown states stay unknown.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AlertTriangle, Inbox, RefreshCw, ShieldAlert, X } from "lucide-react";

import { Badge } from "@nous-research/ui/ui/components/badge";
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
  money,
  priorityLabel,
  shortRef,
  sourceLabel,
  statusLabel,
  type BoardState,
  type TaskDetail,
  type TaskRow,
} from "./tasksBoard";
import { TaskCreateForm } from "./TaskCreateForm";

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
function requestIdText(id: string | null): string {
  return id ? `请求编号 ${id}` : "本次请求未记录编号，可复制时间与操作路径反馈";
}

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

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 min-w-0 break-words text-sm">{children}</dd>
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
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold" title={title}>{title}</h2>
            {state.k === "ready" ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {statusLabel(state.data.status)} · 更新 {beijing(state.data.updatedAt)}
              </p>
            ) : null}
          </div>
          <Button size="sm" outlined onClick={onClose} prefix={<X className="h-3.5 w-3.5" />}>
            关闭
          </Button>
        </div>

        {state.k === "loading" ? (
          <div className="space-y-2" aria-busy="true">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ) : state.k === "error" ? (
          <div className="space-y-2" role="alert">
            <p className="text-sm">{state.message}</p>
            <p className="break-words text-xs text-muted-foreground">{requestIdText(state.requestId)}</p>
            {state.status !== 403 && state.status !== 404 ? (
              <Button size="sm" outlined onClick={onRetry} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
                重试
              </Button>
            ) : null}
          </div>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <DetailField label="优先级">{priorityLabel(state.data.priority).text}</DetailField>
            <DetailField label="负责人">{actorLabel(state.data.assignee, nameMap)}</DetailField>
            <DetailField label="截止时间">{beijing(state.data.dueAt)}</DetailField>
            <DetailField label="成本">{money(state.data.cost)}</DetailField>
            <DetailField label="来源">{sourceLabel(state.data.source)}</DetailField>
            <DetailField label="创建人">{actorLabel(state.data.createdBy, nameMap)}</DetailField>
            <DetailField label="创建时间">{beijing(state.data.createdAt)}</DetailField>
            <DetailField label="任务编号">
              <span className="font-mono text-xs" title={state.data.taskId}>{shortRef(state.data.taskId)}</span>
            </DetailField>
            <DetailField label="完成时间">{beijing(state.data.closedAt)}</DetailField>
            <DetailField label="关联任务">
              {state.data.relatedTaskIds?.length ? `${state.data.relatedTaskIds.length} 项` : "—"}
            </DetailField>
            <div className="sm:col-span-2 xl:col-span-3">
              <DetailField label="说明">{state.data.description ?? "—"}</DetailField>
            </div>
            <div className="sm:col-span-2 xl:col-span-3">
              <DetailField label="最近进展">{state.data.progressNote ?? "—"}</DetailField>
            </div>
            {state.data.status === "blocked" || state.data.status === "cancelled" ? (
              <div className="sm:col-span-2 xl:col-span-3">
                <DetailField label="状态原因">{state.data.statusReason ?? "—"}</DetailField>
              </div>
            ) : null}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

export function TasksBoardModulePage() {
  const [params] = useSearchParams();
  const forced = params.get("state");
  const forceRid = params.get("rid");
  const [board, setBoard] = useState<BoardState>(EMPTY_BOARD);
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState>({ k: "idle" });
  const [createOpen, setCreateOpen] = useState(false);

  const afterCreate = useCallback((taskId: string) => {
    // Refresh the board and open the new task's detail through the real link.
    setSelected(taskId);
    setTick((n) => n + 1);
  }, []);

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
    void loadBoard().then((next) => {
      if (alive) setBoard(next);
    });
    return () => { alive = false; };
  }, [forced, forceRid, tick]);

  useEffect(() => {
    if (!selected) {
      setDetail({ k: "idle" });
      return () => {};
    }
    let alive = true;
    setDetail({ k: "loading", id: selected });
    void loadDetail(selected)
      .then((data) => alive && setDetail({ k: "ready", id: selected, data }))
      .catch((err: unknown) => {
        if (!alive) return;
        const info = detailError(err);
        setDetail({ k: "error", id: selected, ...info });
      });
    return () => { alive = false; };
  }, [selected, tick]);

  const grouped = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const status of BOARD_STATUSES) map.set(status, []);
    for (const row of board.rows) {
      if (map.has(row.status)) map.get(row.status)!.push(row);
    }
    return map;
  }, [board.rows]);

  const counts = useMemo(() => {
    const open = grouped.get("open")?.length ?? 0;
    const blocked = grouped.get("blocked")?.length ?? 0;
    return { open, blocked };
  }, [grouped]);

  // QA V4-R4 条目1: 取数失败或还在加载时，汇总不给硬零——只有请求成功且
  // 数据确为空才允许显示 0。
  const countsUnknown = board.phase === "loading" || board.phase === "error" || board.phase === "denied";
  const countsUnreadable = board.phase === "error" || board.phase === "denied";

  const retry = useCallback(() => {
    setTick((n) => n + 1);
  }, []);

  return (
    <div className="min-w-0 space-y-4" data-testid="tsk4-board">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-mondwest text-2xl font-semibold">任务看板</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            按后端状态看任务；拖动排序未启用，状态不会被前端改写。
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
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

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm" data-testid="tsk4-summary">
        <span data-testid="status">
          待处理 <b>{countsUnknown ? "—" : counts.open}</b> · 阻塞 <b>{countsUnknown ? "—" : counts.blocked}</b>
        </span>
        {countsUnreadable ? (
          <span data-testid="tasks-summary-caveat" className="text-xs text-muted-foreground">
            {board.phase === "denied" ? "暂时读不到任务数据（没有查看权限）" : "暂时读不到任务数据（接口不可达）"}，数字不作零处理
          </span>
        ) : null}
        <span data-testid="next-action">下一步：处理阻塞任务</span>
        <span data-testid="owner">负责人：任务指派对象</span>
      </div>
      <p className="text-xs text-muted-foreground">
        仅显示本页已加载的任务，不是全量统计；新建走任务服务真接口，状态迁移待写入车间接线后开放。
      </p>

      <TaskDetailCard
        state={detail}
        nameMap={board.nameMap}
        onClose={() => setSelected(null)}
        onRetry={() => setTick((n) => n + 1)}
      />

      {board.phase === "loading" ? <BoardSkeleton /> : null}

      {board.phase === "empty" ? (
        <Card data-testid="tsk4-empty">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold">还没有任务</h2>
            <p className="text-sm text-muted-foreground">任务进入看板后会按状态出现在这里。</p>
          </CardContent>
        </Card>
      ) : null}

      {board.phase === "error" || board.phase === "denied" ? (
        <Card data-testid={`tsk4-${board.phase}`}>
          <CardContent className="flex flex-col items-start gap-3 p-5">
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
              <p className="mt-2 break-words text-xs text-muted-foreground">{requestIdText(board.requestId)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {board.phase === "error" ? (
                <Button size="sm" outlined onClick={retry} prefix={<RefreshCw className="h-4 w-4" />}>
                  重试
                </Button>
              ) : null}
              {/* QA V4-R4 条目2: 真出口 — hash 壳内 react-router 路由可达。 */}
              <Link
                to="/overview"
                data-testid="tsk4-back"
                className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm hover:bg-muted/40"
              >
                返回控制台
              </Link>
              <a
                href={CONTACT_ADMIN_HREF}
                data-testid="tsk4-contact"
                className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm hover:bg-muted/40"
              >
                联系管理员
              </a>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {board.phase === "ready" ? (
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5" data-testid="tsk4-columns">
          {BOARD_STATUSES.map((status) => {
            const rows = grouped.get(status) ?? [];
            return (
              <section key={status} className="min-w-0 space-y-2" data-testid={`tsk4-col-${status}`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{COLUMN_LABEL[status]}</h2>
                  <Badge>{rows.length}</Badge>
                </div>
                {rows.length === 0 ? (
                  <p className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
                    这一列暂无任务
                  </p>
                ) : (
                  rows.map((row) => {
                    const priority = priorityLabel(row.priority);
                    return (
                      <Card
                        key={row.taskId}
                        data-testid={`tsk4-card-${row.taskId}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`查看任务 ${row.title}`}
                        className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        onClick={() => setSelected(row.taskId)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelected(row.taskId);
                          }
                        }}
                      >
                        <CardContent className="space-y-2 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="min-w-0 flex-1 text-sm font-medium">{row.title}</h3>
                            <Badge tone={priority.tone}>{priority.text}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">截止 {beijing(row.dueAt)}</p>
                          <p className="text-xs text-muted-foreground">
                            更新 {beijing(row.updatedAt)} · 成本 {money(row.cost)}
                          </p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{row.progressNote ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{actorLabel(row.assignee, board.nameMap)}</p>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default TasksBoardModulePage;
