/**
 * Lane E · tasks board module (PRD v4.1 `#/work`, default open column).
 *
 * Read path only. Source: `/agent-api/api/tasks` with explicit status filters
 * (the BFF refuses unfiltered queries). Four real states are driven by the
 * request; the shell may force one with `?state=loading|empty|error|denied`.
 * No write path is exposed until lane C opens task creation.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { AlertTriangle, Inbox, RefreshCw, ShieldAlert, UserRound } from "lucide-react";

import { Badge, Button, Card, CardContent } from "@nous-research/ui";
import { fetchJSON } from "@/lib/api";
import { API_UNREACHABLE_MESSAGE, ApiError, humanizeStatus } from "@/lib/api-error";

type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "cancelled";
type TaskRow = {
  taskId: string;
  title: string;
  status: string;
  priority?: string | null;
  assignee?: { type?: string; id?: string } | null;
  dueAt?: string | null;
  updatedAt?: string | null;
  progressNote?: string | null;
};
type Phase = "loading" | "ready" | "empty" | "error" | "denied";
type BoardState = {
  phase: Phase;
  rows: TaskRow[];
  status: number;
  message: string;
  requestId?: string;
};

const SOURCE_URLS = [
  "/agent-api/api/tasks?status=open&limit=100",
  "/agent-api/api/tasks?status=blocked&limit=100",
];
const COLUMNS: Array<{ key: TaskStatus; label: string }> = [
  { key: "open", label: "待处理" },
  { key: "in_progress", label: "进行中" },
  { key: "blocked", label: "阻塞" },
];
const INITIAL: BoardState = { phase: "loading", rows: [], status: 0, message: "" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function errorInfo(err: unknown): { status: number; message: string; requestId?: string } {
  if (err instanceof ApiError) {
    const e = err as ApiError & { status?: number; requestId?: string };
    return {
      status: typeof e.status === "number" ? e.status : 0,
      message: e.message || API_UNREACHABLE_MESSAGE,
      requestId: e.requestId,
    };
  }
  return { status: 0, message: API_UNREACHABLE_MESSAGE };
}

function rowsFrom(body: unknown): TaskRow[] {
  if (!isRecord(body) || !Array.isArray(body.items)) return [];
  return body.items.flatMap((raw): TaskRow[] => {
    if (!isRecord(raw)) return [];
    const taskId = pickString(raw.taskId) ?? pickString(raw.id);
    const title = pickString(raw.title);
    if (!taskId || !title) return [];
    return [
      {
        taskId,
        title,
        status: pickString(raw.status) ?? "open",
        priority: pickString(raw.priority) ?? null,
        assignee: isRecord(raw.assignee) ? (raw.assignee as TaskRow["assignee"]) : null,
        dueAt: pickString(raw.dueAt) ?? null,
        updatedAt: pickString(raw.updatedAt) ?? null,
        progressNote: pickString(raw.progressNote) ?? null,
      },
    ];
  });
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function beijing(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms + 480 * 60_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function shortCode(id?: string | null): string | null {
  if (!id) return null;
  const bare = id.replace(/^employee:/, "").replace(/^emp_/, "");
  const code = bare.replace(/[^0-9a-z]/gi, "").slice(0, 8).toUpperCase();
  return code || null;
}

function assigneeLabel(task: TaskRow): string {
  const ref = task.assignee;
  if (!ref?.id) return "未指派";
  if (ref.type === "employee" || ref.id.startsWith("employee:") || ref.id.startsWith("emp_")) {
    const code = shortCode(ref.id);
    return code ? `员工 · ${code}` : "未指派";
  }
  if (ref.type === "human" || ref.id.startsWith("human:")) {
    return `用户 #${ref.id.replace(/^human:/, "")}`;
  }
  return "未指派";
}

function priorityLabel(value?: string | null): { text: string; tone?: "warning" } {
  switch (value) {
    case "high":
      return { text: "高优先级", tone: "warning" };
    case "normal":
      return { text: "普通" };
    case "low":
      return { text: "低优先级" };
    default:
      return { text: "未定级" };
  }
}

function statusLabel(value: string): string {
  switch (value) {
    case "open":
      return "待处理";
    case "in_progress":
      return "进行中";
    case "blocked":
      return "阻塞";
    case "done":
      return "已完成";
    case "cancelled":
      return "已取消";
    default:
      return "未知状态";
  }
}

function BoardSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3" data-testid="tasks-board-loading">
      {[0, 1, 2].map((index) => (
        <Card key={index} className="animate-pulse">
          <CardContent className="space-y-3 p-4">
            <div className="h-4 w-24 rounded bg-white/10" />
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-20 rounded-lg bg-white/5" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TasksBoardModulePage() {
  const [params] = useSearchParams();
  const forced = params.get("state");
  const [state, setState] = useState<BoardState>(INITIAL);
  const [notice, setNotice] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, phase: "loading" }));
    try {
      const bodies = await Promise.all(
        SOURCE_URLS.map((url) => fetchJSON<unknown>(url)),
      );
      const merged = new Map<string, TaskRow>();
      bodies.forEach((body: unknown) => rowsFrom(body).forEach((row) => merged.set(row.taskId, row)));
      const rows = Array.from(merged.values()).sort((a, b) =>
        (a.dueAt ?? "").localeCompare(b.dueAt ?? ""),
      );
      setState({
        phase: rows.length ? "ready" : "empty",
        rows,
        status: 200,
        message: "",
      });
    } catch (err) {
      const info = errorInfo(err);
      const denied = info.status === 403 || info.status === 404;
      setState({
        phase: denied ? "denied" : "error",
        rows: [],
        status: info.status,
        message: info.status ? humanizeStatus(info.status) : info.message,
        requestId: info.requestId,
      });
    }
  }, []);

  useEffect(() => {
    if (forced === "loading") {
      setState((prev) => ({ ...prev, phase: "loading" }));
      return;
    }
    if (forced === "empty") {
      setState({ phase: "empty", rows: [], status: 200, message: "" });
      return;
    }
    if (forced === "denied") {
      setState({ phase: "denied", rows: [], status: 403, message: "该数据源尚未开放，或你没有查看权限。", requestId: params.get("rid") ?? undefined });
      return;
    }
    if (forced === "error") {
      setState({ phase: "error", rows: [], status: 502, message: humanizeStatus(502), requestId: params.get("rid") ?? undefined });
      return;
    }
    void load();
  }, [forced, load, params, tick]);

  const counts = useMemo(() => {
    const open = state.rows.filter((row) => row.status === "open").length;
    const blocked = state.rows.filter((row) => row.status === "blocked").length;
    return { open, blocked };
  }, [state.rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    COLUMNS.forEach((column) => map.set(column.key, []));
    state.rows.forEach((row) => {
      if (map.has(row.status)) map.get(row.status)!.push(row);
    });
    return map;
  }, [state.rows]);

  const retry = () => setTick((value) => value + 1);

  return (
    <div className="space-y-6" data-testid="tasks-board">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mondwest text-2xl font-semibold">任务看板</h1>
          <p className="mt-1 text-sm text-white/60">看待处理与阻塞任务，先处理卡住的那一张。</p>
        </div>
        <Button
          size="sm"
          outlined
          onClick={() => setNotice(true)}
          data-testid="tasks-board-create"
        >
          新建任务
        </Button>
      </header>

      <div className="flex flex-wrap gap-4 text-sm" data-testid="tasks-board-summary">
        <span data-testid="status">
          待处理 <b>{counts.open}</b> · 阻塞 <b>{counts.blocked}</b>
        </span>
        <span data-testid="next-action">下一步：处理阻塞任务</span>
        <span data-testid="owner">负责人：任务指派对象</span>
      </div>

      {notice ? (
        <Card data-testid="tasks-board-create-notice">
          <CardContent className="p-4 text-sm text-white/70">
            创建入口由薄壳车道接线后开放；本页当前只读。
          </CardContent>
        </Card>
      ) : null}

      {state.phase === "loading" ? <BoardSkeleton /> : null}

      {state.phase === "error" || state.phase === "denied" ? (
        <Card data-testid={`tasks-board-${state.phase}`}>
          <CardContent className="flex flex-col items-start gap-3 p-5">
            {state.phase === "denied" ? (
              <ShieldAlert className="h-5 w-5 text-amber-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-400" />
            )}
            <div>
              <h2 className="text-base font-semibold">
                {state.phase === "denied" ? "任务看板暂不可见" : "任务没能加载出来"}
              </h2>
              <p className="mt-1 text-sm text-white/60">
                {state.phase === "denied"
                  ? "该数据源尚未开放，或你没有查看权限。请确认后台已接入对应服务，或联系管理员开通权限。"
                  : state.message}
              </p>
              <p className="mt-2 font-mono text-xs text-white/50">
                请求编号：{state.requestId ?? "未提供"}
              </p>
            </div>
            <Button size="sm" outlined onClick={retry} data-testid="tasks-board-retry">
              <RefreshCw className={"mr-2 h-4 w-4"} />
              重试
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {state.phase === "empty" ? (
        <Card data-testid="tasks-board-empty">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Inbox className="h-8 w-8 text-white/40" />
            <h2 className="text-lg font-semibold">没有待处理任务</h2>
            <p className="text-sm text-white/60">新的任务进入后会出现在这里。</p>
            <Button size="sm" outlined onClick={() => setNotice(true)}>
              新建任务
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {state.phase === "ready" ? (
        <div className="grid gap-4 lg:grid-cols-3" data-testid="tasks-board-columns">
          {COLUMNS.map((column) => {
            const rows = grouped.get(column.key) ?? [];
            return (
              <section key={column.key} className="space-y-3" data-testid={`tasks-column-${column.key}`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white/80">{column.label}</h2>
                  <Badge>{rows.length}</Badge>
                </div>
                {rows.length === 0 ? (
                  <p className="rounded-lg border border-white/10 p-4 text-xs text-white/45">
                    这一列暂无任务
                  </p>
                ) : (
                  rows.map((row) => {
                    const priority = priorityLabel(row.priority);
                    return (
                      <Card key={row.taskId} data-testid={`tasks-card-${row.taskId}`}>
                        <CardContent className="space-y-2 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-medium">{row.title}</h3>
                            <Badge tone={priority.tone}>{priority.text}</Badge>
                          </div>
                          <p className="text-xs text-white/55">
                            {statusLabel(row.status)} · 截止 {beijing(row.dueAt)}
                          </p>
                          <p className="text-xs text-white/55">{row.progressNote ?? "—"}</p>
                          <p className="flex items-center gap-1 text-xs text-white/45">
                            <UserRound className="h-3.5 w-3.5" />
                            {assigneeLabel(row)}
                          </p>
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