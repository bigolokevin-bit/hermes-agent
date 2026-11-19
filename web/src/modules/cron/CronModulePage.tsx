/**
 * 定时任务 — read-only door into Hermes `GET /api/cron/jobs`.
 *
 * This page never calls pause/resume/trigger. The two per-row controls are
 * rendered disabled on purpose, so a reader sees the capability without a
 * write path. Missing values are 「—」 with a reason; a 404/403 body is one
 * neutral body, and an absent route never becomes sample rows.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Check, Copy, Inbox, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { copyTextToClipboard } from "@/lib/clipboard";
import { themedBody } from "@/lib/utils";
import {
  CRON_GAP,
  fetchCronJobs,
  failureInfo,
  isForbidden,
  readFailure,
  type CronRow,
  type FailureCopy,
} from "./cron";
import "./cron.css";
type Phase = "loading" | "ready" | "empty" | "error" | "denied" | "login";
type Forced = "loading" | "empty" | "error" | "denied";
const FORCED = new Set<string>(["loading", "empty", "error", "denied"]);
const STATUS_LABEL = { enabled: "启用", disabled: "停用", unknown: "待核实" } as const;
function RequestId({ failure }: { failure: FailureCopy | null }): ReactNode {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const id = failure?.requestId ?? null;
  if (!id) {
    return (
      <span className="min-w-0 break-words text-xs text-muted-foreground" data-testid="cron5-request-id">
        请求编号：未提供
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground" data-testid="cron5-request-id">
      请求编号：
      <code className="min-w-0 break-all font-mono">{id}</code>
      <button
        type="button"
        aria-label="复制请求编号"
        className="inline-flex shrink-0 items-center gap-1 underline underline-offset-2"
        onClick={() => {
          void copyTextToClipboard(id).then((ok) => setCopied(ok ? "done" : "failed"));
        }}
      >
        {copied === "done" ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
        {copied === "done" ? "已复制" : copied === "failed" ? "复制失败" : "复制"}
      </button>
    </span>
  );
}
function JobRow({ row }: { row: CronRow }): ReactNode {
  const dimmed = row.status !== "enabled";
  return (
    <div
      className={`flex min-w-0 flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0 ${dimmed ? "opacity-60" : ""}`}
      data-testid="cron5-row"
      data-status={row.status}
      title={row.key}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 break-words text-sm" data-testid="cron5-name">{row.name}</p>
        <Badge tone={row.status === "enabled" ? "success" : row.status === "disabled" ? "destructive" : "secondary"} title={row.statusReason ?? undefined}>
          <span data-testid="cron5-status">{STATUS_LABEL[row.status]}</span>
        </Badge>
      </div>
      <div className="grid min-w-0 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        <p className="min-w-0 break-words" data-testid="cron5-schedule">
          调度：{row.schedule}
          {row.scheduleReason ? <span className="ml-1">{row.scheduleReason}</span> : null}
        </p>
        <p className="min-w-0 break-words" data-testid="cron5-result">
          最近结果：{row.resultLabel}
          {row.resultReason ? <span className="ml-1">{row.resultReason}</span> : null}
        </p>
        <p className="min-w-0 break-words" data-testid="cron5-last">
          上次运行：{row.lastRun ?? "—"}
          {row.lastRunReason ? <span className="ml-1">{row.lastRunReason}</span> : null}
        </p>
        <p className="min-w-0 break-words" data-testid="cron5-next">
          下次运行：{row.nextRun ?? "—"}
          {row.nextRunReason ? <span className="ml-1">{row.nextRunReason}</span> : null}
        </p>
      </div>
      <div className="flex min-w-0 flex-wrap gap-2" data-testid="cron5-actions">
        <button type="button" disabled aria-disabled="true" title="只读视图，不提供暂停或启用操作" data-testid="cron5-toggle" className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
          {row.status === "enabled" ? "暂停" : "启用"}
        </button>
        <button type="button" disabled aria-disabled="true" title="只读视图，不提供立即执行操作" data-testid="cron5-run-now" className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
          立即执行
        </button>
      </div>
    </div>
  );
}
export function CronModulePage(): ReactNode {
  const [params, setParams] = useSearchParams();
  const forcedRaw = params.get("state");
  const forced = forcedRaw && FORCED.has(forcedRaw) ? (forcedRaw as Forced) : null;
  const [phase, setPhase] = useState<Phase>("loading");
  const [rows, setRows] = useState<CronRow[]>([]);
  const [failure, setFailure] = useState<FailureCopy | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const retry = useCallback(() => {
    if (forced) {
      const next = new URLSearchParams(params);
      next.delete("state");
      setParams(next);
    }
    setAttempt((n) => n + 1);
  }, [forced, params, setParams]);
  useEffect(() => {
    if (forced) {
      if (forced === "loading") setPhase("loading");
      else if (forced === "empty") setPhase("empty");
      else if (forced === "error") {
        setPhase("error");
        setFailure({ sentence: "这条腿是用 ?state=error 复现的，服务此刻没有回答过。", requestId: null, technical: null });
      } else {
        setPhase("denied");
        setFailure({ sentence: "这条腿是用 ?state=denied 复现的，服务此刻没有回答过。", requestId: null, technical: null });
      }
      setRows([]);
      return;
    }
    let alive = true;
    setPhase("loading");
    setFailure(null);
    fetchCronJobs()
      .then((next) => {
        if (!alive) return;
        setRows(next);
        setPhase(next.length ? "ready" : "empty");
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const info = failureInfo(err);
        setFailure(readFailure(err, info));
        setPhase(info.status === 401 ? "login" : isForbidden(info.status) ? "denied" : "error");
      });
    return () => {
      alive = false;
    };
  }, [attempt, forced]);
  const body = (() => {
    if (phase === "loading") {
      return (
        <div className="flex min-w-0 flex-col gap-2" data-testid="cron5-loading" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-md border border-border bg-card px-4 py-4" aria-hidden>
              <div className="h-3 w-1/3 rounded-sm bg-muted" />
              <div className="mt-3 h-2.5 w-2/3 rounded-sm bg-muted/70" />
            </div>
          ))}
        </div>
      );
    }
    if (phase === "denied" || phase === "login" || phase === "error") {
      const denied = phase === "denied";
      const login = phase === "login";
      return (
        <Card
          role="alert"
          className={denied ? "border-border bg-card" : "border-destructive/40 bg-destructive/5"}
          data-testid={denied ? "cron5-denied" : login ? "cron5-login" : "cron5-error"}
          title={denied ? CRON_GAP : failure?.technical ?? undefined}
        >
          <CardContent className="flex min-w-0 flex-col items-start gap-2 px-4 py-6">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              {denied ? <ShieldAlert className="h-4 w-4" aria-hidden /> : <TriangleAlert className="h-4 w-4" aria-hidden />}
              <span className="min-w-0 break-words">
                {denied ? "定时任务读口未接入" : login ? "需要重新登录" : "定时任务没能加载出来"}
              </span>
            </div>
            <p className="max-w-prose break-words text-xs text-muted-foreground">
              {failure?.sentence ?? "读取定时任务时出了问题，请稍后重试。"}
            </p>
            {denied ? (
              <Link
                to="/approvals"
                data-testid="cron5-apply"
                className="inline-flex min-w-0 items-center gap-1 text-xs underline underline-offset-4"
              >
                去审批中心提交开通申请
              </Link>
            ) : null}
            <RequestId failure={failure} />
            <Button size="sm" outlined onClick={retry} prefix={<RefreshCw className="h-3.5 w-3.5" />} data-testid="cron5-retry">
              重试
            </Button>
          </CardContent>
        </Card>
      );
    }
    if (phase === "empty") {
      return (
        <Card className="border-border bg-card" data-testid="cron5-empty">
          <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden />
            <p className={`min-w-0 break-words text-sm ${themedBody}`}>服务已响应，没有定时任务</p>
            <p className="max-w-prose break-words text-xs text-muted-foreground">
              这不是加载失败，也不展示样例；在原生定时任务管理页创建后回到这里重新读取。
            </p>
            <Button size="sm" outlined onClick={retry} prefix={<RefreshCw className="h-3.5 w-3.5" />} data-testid="cron5-retry">
              重新读取
            </Button>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="border-border bg-card" data-testid="cron5-list">
        <CardContent className="p-0">
          {rows.map((row) => <JobRow key={row.key} row={row} />)}
        </CardContent>
      </Card>
    );
  })();
  return (
    <div
      className="cron5-page flex min-w-0 w-full max-w-full flex-col gap-3"
      data-testid="cron5-page"
      data-page="cron"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className={`min-w-0 break-words text-xl ${themedBody}`}>定时任务</h1>
          <p className="mt-1 min-w-0 break-words text-xs text-muted-foreground">
            只读查看任务调度、运行时刻与最近结果；本页不启停、不立即执行，也不显示任何凭据值。
          </p>
        </div>
        <Button
          size="sm"
          outlined
          onClick={reload}
          disabled={phase === "loading" || forced !== null}
          data-testid="cron5-refresh"
          prefix={phase === "loading" ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
        >
          重新读取
        </Button>
      </div>
      {forced ? (
        <p className="min-w-0 break-words text-xs text-warning" data-testid="cron5-forced-note" title={CRON_GAP}>
          {`这是用 ?state=${forced} 复现出来的状态，不是服务此刻的回答。`}
        </p>
      ) : null}
      <p className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite" data-testid="cron5-status-line">
        {phase === "loading"
          ? "正在读取定时任务…"
          : phase === "ready"
            ? `读取成功：${rows.length} 个定时任务`
            : phase === "empty"
              ? "读取成功，定时任务清单是空的"
              : phase === "denied" || phase === "login"
                ? "这一面当前看不到内容"
                : "这次读取没有成功"}
      </p>
      {body}
    </div>
  );
}
export default CronModulePage;
