import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { RequestIdCopy } from "@/components/RequestIdCopy";
import { Inbox, LayoutGrid, RefreshCw, ShieldAlert, TriangleAlert, Users } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";

import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

import {
  buildMatrixView,
  readMatrixPayload,
  type MatrixCellState,
  type MatrixPayload,
  type MatrixView,
} from "./matrix";

type Phase = "loading" | "ready" | "empty" | "error" | "denied";

const FORCED = new Set(["loading", "empty", "error", "denied"]);

function fmtStamp(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

/** Three cell states, three shapes; unknown is never drawn as "denied". */
function CellPill({ state }: { state: MatrixCellState }) {
  if (state === "granted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
        <span aria-hidden="true">●</span>已授权
      </span>
    );
  }
  if (state === "denied") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-white/45">
        <span aria-hidden="true">○</span>未授权
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/25 px-2 py-0.5 text-[11px] text-white/60"
      data-gap="1"
      title="GAP：后端没有给出这一格，按「待核实」显示，不猜授权"
    >
      <span aria-hidden="true">?</span>待核实
      <span className="rounded-sm bg-white/10 px-1 text-[9px] tracking-wide text-white/50">GAP</span>
    </span>
  );
}

export function MatrixModulePage() {
  const [params, setParams] = useSearchParams();
  const view: MatrixView = params.get("view") === "resource" ? "resource" : "people";
  const forced = params.get("state");
  const [phase, setPhase] = useState<Phase>("loading");
  const [payload, setPayload] = useState<MatrixPayload | null>(null);
  const [errorNote, setErrorNote] = useState<{ requestId: string | null; detail: string } | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    if (forced && FORCED.has(forced)) {
      setPhase(forced as Phase);
      setErrorNote(forced === "error" ? { requestId: params.get("rid"), detail: "读取没有成功" } : null);
      return;
    }
    let live = true;
    setPhase("loading");
    setErrorNote(null);
    // reuse: /v1/matrix/employees
    fetchJSON<unknown>("/agent-api/api/matrix")
      .then((body) => {
        if (!live) return;
        const next = readMatrixPayload(body);
        setPayload(next);
        setPhase(next.employees.length && next.capabilities.length ? "ready" : "empty");
      })
      .catch((error: unknown) => {
        if (!live) return;
        const status = error instanceof ApiError ? error.status : 0;
        const requestId = error instanceof ApiError ? (error.requestId ?? null) : null;
        if (status === 404 || status === 0) {
          // R7.1 item 2: an unwired or unreachable endpoint is reported as it
          // is — the page shows the honest「看不到/没接上」state with the
          // request number and a retry. No fixture table may impersonate live
          // data, ever.
          setPhase("denied");
          setErrorNote({ requestId, detail: "后台还没有提供这份矩阵（或暂时连不上）" });
          return;
        }
        if (status === 403) {
          setPhase("denied");
          setErrorNote({ requestId, detail: "当前账号没有查看这份矩阵的权限" });
          return;
        }
        setPhase("error");
        setErrorNote({
          requestId,
          detail: error instanceof ApiError ? error.message : "读取没有成功，稍后再试一次",
        });
      });
    return () => {
      live = false;
    };
  }, [forced, params, token]);

  const data = useMemo(
    () => (payload ? buildMatrixView(payload, view) : { columns: [], rows: [] }),
    [payload, view],
  );

  const setView = (next: MatrixView) => {
    const search = new URLSearchParams(params);
    if (next === "people") search.delete("view");
    else search.set("view", next);
    setParams(search, { replace: true });
  };

  const retry = () => {
    const search = new URLSearchParams(params);
    search.delete("state");
    search.delete("rid");
    setParams(search, { replace: true });
    setToken((n) => n + 1);
  };

  const origin = payload?.origin ?? "matrix";
  const counts = useMemo(() => {
    let granted = 0;
    let denied = 0;
    let unknown = 0;
    for (const row of data.rows) {
      for (const cell of row.cells) {
        if (cell.state === "granted") granted += 1;
        else if (cell.state === "denied") denied += 1;
        else unknown += 1;
      }
    }
    return { granted, denied, unknown };
  }, [data.rows]);

  return (
    <section className="space-y-4" data-testid="mtx5-module" data-fixture={origin === "fixture" ? "1" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mondwest text-xl">能力与权限矩阵</h1>
          <p className="mt-1 text-sm text-white/55">谁被授了什么、谁还没有，放在同一张表里看；点一行或一列换视角。</p>
        </div>
        <div className="flex items-center gap-2">
          {origin === "fixture" ? <Badge tone="warning">示例数据</Badge> : null}
          <Button size="sm" outlined onClick={retry} data-testid="mtx5-refresh">
            <RefreshCw className="mr-1 size-3.5" aria-hidden="true" />
            重新读取
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-white/10 p-1" role="tablist" aria-label="视角">
              <button
                type="button"
                role="tab"
                aria-selected={view === "people"}
                onClick={() => setView("people")}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs ${
                  view === "people" ? "bg-white/10 text-white" : "text-white/55 hover:text-white/80"
                }`}
                data-testid="mtx5-view-people"
              >
                <Users className="size-3.5" aria-hidden="true" />
                按员工
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "resource"}
                onClick={() => setView("resource")}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs ${
                  view === "resource" ? "bg-white/10 text-white" : "text-white/55 hover:text-white/80"
                }`}
                data-testid="mtx5-view-resource"
              >
                <LayoutGrid className="size-3.5" aria-hidden="true" />
                按能力
              </button>
            </div>
            {phase === "ready" ? (
              <p className="flex min-w-0 flex-wrap gap-x-2 text-xs text-white/45" data-testid="mtx5-summary">
                <span>员工 {payload?.employees.length ?? 0}</span>
                <span aria-hidden>·</span>
                <span>在岗 {payload ? payload.employees.filter((e) => e.lifecycle === "active").length : 0}</span>
                <span aria-hidden>·</span>
                <span title="风险数据源尚未接入，这里不做猜测。">有风险 —</span>
                <span aria-hidden>·</span>
                <span>技能引用 {counts.granted + counts.denied + counts.unknown}</span>
                <span aria-hidden>·</span>
                <span title="运行统计源尚未接入，接入后此栏自动显示真数。">今日运行 —</span>
                <span aria-hidden>·</span>
                <span>已授权 {counts.granted} / 未授权 {counts.denied} / 待核实 {counts.unknown}</span>
                <span>读取于 {fmtStamp(payload?.asOf ?? null)}</span>
              </p>
            ) : null}
          </div>

          {origin === "fixture" && phase === "ready" ? (
            <p className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200" data-testid="mtx5-fixture-note">
              真实矩阵接口还没接上，这张表用示例数据确认版面；接上后同一张表直接显示真实授权，「待核实」表示后端没有给出这一格。
            </p>
          ) : null}

          {phase === "loading" ? (
            <div className="space-y-2 py-6" data-testid="mtx5-loading" aria-busy="true">
              <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
              <div className="h-9 w-full rounded bg-white/5" />
              <div className="h-9 w-full rounded bg-white/5" />
              <div className="h-9 w-full rounded bg-white/5" />
              <p className="text-xs text-white/45">正在读取矩阵…</p>
            </div>
          ) : null}

          {phase === "empty" ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center" data-testid="mtx5-empty">
              <Inbox className="size-8 text-white/35" aria-hidden="true" />
              <p className="text-sm text-white/80">还没有可展示的矩阵</p>
              <p className="max-w-md text-xs text-white/50">
                要么还没有员工被授过能力，要么后端只返回了空表。先去员工页确认在岗员工，再回来查看。
              </p>
              <Link className="text-xs text-sky-300 hover:underline" to="/employees">
                回员工列表
              </Link>
            </div>
          ) : null}

          {phase === "denied" ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center" data-testid="mtx5-denied">
              <ShieldAlert className="size-8 text-amber-300/80" aria-hidden="true" />
              <p className="text-sm text-white/80">你看不到这份矩阵</p>
              <p className="max-w-md text-xs text-white/50">可能是这页不存在，也可能是你的账号还没有查看权限。</p>
              <p className="text-xs text-white/40">
                <RequestIdCopy requestId={errorNote?.requestId} fallback="本次请求未记录编号，可复制时间与操作路径反馈" />
              </p>
              <Button size="sm" outlined onClick={retry} data-testid="mtx5-denied-retry">
                刷新试试
              </Button>
            </div>
          ) : null}

          {phase === "error" ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center" data-testid="mtx5-error">
              <TriangleAlert className="size-8 text-rose-300/80" aria-hidden="true" />
              <p className="text-sm text-white/80">这份矩阵没能读出来</p>
              {/* 设计车道 ①：401 不再自绘「需要登录」专属卡（含 auth-reload-exit 出口）。
                  全站只有顶部一条 SessionExpiredBanner 说「会话已过期」（lib/session-expiry
                  置位），同一状态不再同屏双播。errorNote.detail 里 `lib/api-error` 给 401 的
                  那句人话因此也不上屏，这里只留通用错误 + 请求编号 + 重试。 */}
              <p className="max-w-md text-xs text-white/50">
                刚才的读取没有改动任何东西，可以重试一次。
              </p>
              <p className="text-xs text-white/40">
                <RequestIdCopy requestId={errorNote?.requestId} fallback="本次请求未记录编号，可复制时间与操作路径反馈" />
              </p>
              <Button size="sm" outlined onClick={retry} data-testid="mtx5-error-retry">
                重试
              </Button>
            </div>
          ) : null}

          {phase === "ready" ? (
            <div className="overflow-x-auto" data-testid="mtx5-scroll">
              <div className="min-w-[720px]">
                <div
                  className="grid items-center gap-2 border-b border-white/10 pb-2 text-[11px] text-white/40"
                  style={{ gridTemplateColumns: `minmax(180px, 1.4fr) repeat(${data.columns.length}, minmax(96px, 1fr))` }}
                >
                  <span>{view === "people" ? "员工" : "能力"}</span>
                  {data.columns.map((column) => (
                    <span key={column.key} className="truncate" title={column.rawTitle ?? undefined} data-testid={`mtx5-col-${column.key}`}>
                      {column.label}
                      {column.meta ? <span className="ml-1 normal-case text-white/30">{column.meta}</span> : null}
                    </span>
                  ))}
                </div>
                <ul className="divide-y divide-white/5" data-testid="mtx5-table">
                  {data.rows.map((row) => (
                    <li
                      key={row.key}
                      className="grid items-center gap-2 py-2"
                      style={{ gridTemplateColumns: `minmax(180px, 1.4fr) repeat(${data.columns.length}, minmax(96px, 1fr))` }}
                      data-testid={`mtx5-row-${row.key}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-white/85" title={row.rawTitle ?? undefined}>
                          {row.label}
                        </span>
                        <span className="block truncate text-xs text-white/40">{row.meta || "—"}</span>
                      </span>
                      {row.cells.map((cell) => (
                        <span key={cell.key} className="justify-self-start" data-testid={`mtx5-cell-${row.key}-${cell.key}`}>
                          <CellPill state={cell.state} />
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <p className="text-xs text-white/40">
        矩阵只读：这里不改授权。要改某位员工的职权，去员工详情页的授权区；这一页只负责把「谁有什么」摊开看。
      </p>
    </section>
  );
}