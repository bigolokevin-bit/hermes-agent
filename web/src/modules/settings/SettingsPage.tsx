import { useEffect, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { copyTextToClipboard } from "@/lib/clipboard";
import { currentFixtureState, fixtureView, type FixtureState } from "../../shell/fixtures";
import { readSettings, statusLabel, type SettingState } from "./settings";
import "./settings.css";

type Content = ReturnType<typeof readSettings>;
type State = { k: "loading" } | { k: "empty" } | { k: "error"; requestId: string } | { k: "ready"; content: Content; degraded: boolean };

function forcedState(value: FixtureState | null): State | null {
  if (value === "loading") return { k: "loading" };
  if (value === "empty") return { k: "empty" };
  if (value === "error") return { k: "error", requestId: "示例请求号" };
  return null;
}


function RequestId({ id }: { id: string }) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  return (
    <p className="flex min-w-0 flex-wrap items-center justify-center gap-1 text-xs text-white/40" data-testid="set4-request-id">
      <span>请求号：</span>
      <code className="min-w-0 break-all" title={id}>{id}</code>
      <button
        type="button"
        aria-label="复制请求编号"
        className="inline-flex items-center gap-1 underline underline-offset-2"
        onClick={() => { void copyTextToClipboard(id).then((ok) => setCopied(ok ? "done" : "failed")); }}
      >
        <Copy className="size-3" aria-hidden="true" />
        {copied === "done" ? "已复制" : copied === "failed" ? "复制失败，请手动选择" : "复制"}
      </button>
    </p>
  );
}

function leavePreview(): void {
  if (typeof window === "undefined") return;
  const search = new URLSearchParams(window.location.search);
  search.delete("state");
  const hash = window.location.hash;
  const mark = hash.indexOf("?");
  let nextHash = hash;
  if (mark >= 0) {
    const params = new URLSearchParams(hash.slice(mark + 1));
    params.delete("state");
    const qs = params.toString();
    nextHash = hash.slice(0, mark) + (qs ? `?${qs}` : "");
  }
  window.history.replaceState({}, "", `${window.location.pathname}${search.toString() ? `?${search}` : ""}${nextHash}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function requestId(error: unknown): string {
  if (error instanceof ApiError && error.requestId) return error.requestId;
  if (error && typeof error === "object" && "requestId" in error && typeof error.requestId === "string" && error.requestId) return error.requestId;
  return "未提供";
}

function tone(state: SettingState): "success" | "outline" | "warning" {
  if (state === "enabled") return "success";
  if (state === "disabled" || state === "not-landed") return "outline";
  return "warning";
}

export function SettingsPage() {
  const [state, setState] = useState<State>({ k: "loading" });
  const [attempt, setAttempt] = useState(0);
  const forced = currentFixtureState();
  const preview = fixtureView<State | null>(forced ?? "ready", {
    loading: () => ({ k: "loading" }), empty: () => ({ k: "empty" }),
    error: () => ({ k: "error", requestId: "示例请求号" }), ready: () => null,
  });

  useEffect(() => {
    let alive = true;
    if (forcedState(forced)) return () => { alive = false; };
    const run = async () => {
      try {
        const payload = await fetchJSON<unknown>("/agent-api/api/config");
        if (!alive) return;
        if (payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).items) && ((payload as { items: unknown[] }).items.length === 0)) {
          setState({ k: "empty" });
          return;
        }
        const content = readSettings(payload);
        setState(content.switches.length + content.upstreams.length === 0
          ? { k: "empty" }
          : { k: "ready", content, degraded: false });
      } catch (error) {
        if (!alive) return;
        if (error instanceof ApiError && error.status === 404) {
          setState({ k: "ready", content: readSettings({}, true), degraded: true });
          return;
        }
        setState({ k: "error", requestId: requestId(error) });
      }
    };
    void run();
    return () => { alive = false; };
  }, [forced, attempt]);

  const view = preview ?? state;
  const retry = () => {
    if (forced) leavePreview();
    setAttempt((value) => value + 1);
  };
  const content = view.k === "ready" ? view.content : null;

  return (
    <section className="set4-page space-y-4" data-testid="set4-page">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-mondwest text-xl">默认设置</h1>
          <p className="mt-1 text-sm text-white/55">这台控制台连着什么、边界在哪、哪些事现在不能做</p>
        </div>
        <Button size="sm" outlined onClick={retry} disabled={view.k === "loading"}>
          <RefreshCw className="mr-1 size-3.5" aria-hidden="true" />重新读取
        </Button>
      </header>

      {view.k === "loading" ? (
        <Card><CardContent className="space-y-3 p-4" data-testid="set4-loading" aria-busy="true">
          <p className="text-sm text-white/55">正在读取默认设置…</p>
          {[1, 2, 3].map((row) => <div key={row} className="h-14 animate-pulse rounded bg-white/5" />)}
        </CardContent></Card>
      ) : view.k === "empty" ? (
        <Card><CardContent className="py-10 text-center" data-testid="set4-empty">
          <p className="text-sm text-white/80">这项配置未提供</p><p className="mt-2 text-xs text-white/50">当前没有可展示的默认设置。</p>
        </CardContent></Card>
      ) : view.k === "error" ? (
        <Card><CardContent className="flex flex-col items-center gap-3 py-10 text-center" data-testid="set4-error" role="alert">
          <p className="text-sm text-white/80">默认设置暂时无法读取</p>
          <RequestId id={view.requestId} />
          <Button size="sm" outlined onClick={retry} data-testid="set4-retry">重试</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-4" data-testid="set4-content">
          {view.degraded ? <p className="text-xs text-white/45" data-testid="set4-degraded">配置自检尚未接入，未落地项按未启用显示；读取到的值保留三态。</p> : null}
          <Card><CardContent className="space-y-3 p-4" data-testid="set4-switches">
            <h2 className="text-sm font-medium text-white/85">写入开关</h2>
            {content?.switches.map((item) => (
              <div key={item.key} className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-t border-white/10 pt-3" title={`配置项：${item.key}`} data-testid={`set4-switch-${item.key}`}>
                <div className="min-w-0 flex-1"><p className="break-words text-sm text-white/80">{item.label}</p><p className="mt-1 text-xs text-white/45">{item.reason}</p></div>
                <Badge tone={tone(item.state)}>{statusLabel(item.state)}</Badge>
              </div>
            ))}
          </CardContent></Card>

          <Card><CardContent className="space-y-3 p-4" data-testid="set4-upstreams">
            <h2 className="text-sm font-medium text-white/85">上游连通自检</h2>
            {content?.upstreams.length ? content.upstreams.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-t border-white/10 pt-3" title={`上游项目 ${index + 1}`}>
                <div className="min-w-0 flex-1"><p className="break-words text-sm text-white/80">{item.name}</p><p className="mt-1 text-xs text-white/45">{item.reason}</p></div>
                <Badge tone={tone(item.state)}>{statusLabel(item.state)}</Badge>
              </div>
            )) : (
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-t border-white/10 pt-3" title="上游自检">
                <div className="min-w-0 flex-1"><p className="text-sm text-white/80">上游连通自检</p><p className="mt-1 text-xs text-white/45">配置自检尚未接入，读取不到当前值</p></div>
                <Badge tone="outline">未启用</Badge>
              </div>
            )}
          </CardContent></Card>

          <Card><CardContent className="space-y-3 p-4" data-testid="set4-danger">
            <h2 className="text-sm font-medium text-white/85">高风险操作去处</h2>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-sm">
              <span>审批阈值调整</span><a className="text-sky-300 hover:underline" href="#/system">前往审批与发布门</a>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-sm">
              <span>员工激活</span><a className="text-sky-300 hover:underline" href="#/employees">前往数字员工</a>
            </div>
          </CardContent></Card>
        </div>
      )}
    </section>
  );
}
