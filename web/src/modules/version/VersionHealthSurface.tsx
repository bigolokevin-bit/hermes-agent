import { useEffect, useState } from "react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";
import { fetchJsonStrict } from "../models/fetchJson";
import {
  HEALTH_API_PATH,
  HEALTH_GAP,
  VERSION_API_PATH,
  VERSION_GAP,
  healthMessage,
  readHealth,
  readVersionRows,
  versionMessage,
  type HealthView,
  type VersionRow,
} from "./versionHealth";

type Preview = "loading" | "empty" | "error" | null;
type VersionState =
  | { k: "loading" }
  | { k: "ready"; rows: VersionRow[] }
  | { k: "empty" }
  | { k: "gap"; message: string; requestId: string | null }
  | { k: "error"; message: string; requestId: string | null }
  | { k: "login"; message: string };
type HealthState =
  | { k: "loading" }
  | { k: "ready"; view: HealthView }
  | { k: "unknown"; message: string };

function RequestId({ id }: { id: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!id) {
    return <p className="text-xs text-white/45" data-testid="ver5-request-id">请求编号：未提供</p>;
  }
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-white/45" data-testid="ver5-request-id">
      <span>请求编号：</span>
      <code className="min-w-0 break-all" title={id}>{id}</code>
      <button
        type="button"
        className="underline underline-offset-2"
        aria-label="复制请求编号"
        onClick={() => {
          void navigator.clipboard?.writeText(id).then(() => setCopied(true), () => setCopied(false));
        }}
      >
        {copied ? "已复制" : "复制"}
      </button>
    </p>
  );
}

function HealthLine({ state }: { state: HealthState }) {
  if (state.k === "loading") {
    return <p className="text-xs text-white/45" data-testid="ver5-health" aria-busy="true">正在读取整体健康…</p>;
  }
  if (state.k === "unknown") {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs" data-testid="ver5-health" title={HEALTH_GAP}>
        <span className="text-white/70">整体健康</span>
        <Badge tone="outline"><span data-testid="ver5-health-state">待核实</span></Badge>
        <span className="min-w-0 break-words text-white/45">{state.message}</span>
      </div>
    );
  }
  const view = state.view;
  const tone = view.state === "正常" ? "success" : view.state === "降级" ? "warning" : "outline";
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs" data-testid="ver5-health">
      <span className="text-white/70">整体健康</span>
      <Badge tone={tone}><span data-testid="ver5-health-state">{view.state}</span></Badge>
      <span className="text-white/45" data-testid="ver5-health-asof" title={view.asOfTitle}>
        {view.asOf ? `采集于 ${view.asOf}` : "采集时间未知"}
      </span>
      {view.sources !== null ? <span className="text-white/40">来源 {view.sources} 项</span> : null}
      {view.reason ? <span className="min-w-0 break-words text-white/40">{view.reason}</span> : null}
      {view.asOfReason ? <span className="min-w-0 break-words text-white/40">{view.asOfReason}</span> : null}
    </div>
  );
}

export function VersionHealthSurface({ preview = null }: { preview?: Preview }) {
  const [version, setVersion] = useState<VersionState>(preview === "loading" ? { k: "loading" } : preview === "empty" ? { k: "empty" } : preview === "error" ? { k: "error", message: "预览：版本表读取失败。", requestId: null } : { k: "loading" });
  const [health, setHealth] = useState<HealthState>({ k: "loading" });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (preview !== null) return;
    let live = true;
    setVersion({ k: "loading" });
    setHealth({ k: "loading" });
    void fetchJsonStrict(VERSION_API_PATH)
      .then((payload) => {
        if (!live) return;
        const rows = readVersionRows(payload);
        if (rows === null) {
          setVersion({ k: "error", message: "版本接口返回的内容无法解析为组件清单。", requestId: null });
          return;
        }
        setVersion(rows.length === 0 ? { k: "empty" } : { k: "ready", rows });
      })
      .catch((error: unknown) => {
        if (!live) return;
        const info = versionMessage(error);
        if (info.status === 401) setVersion({ k: "login", message: info.text });
        else if (info.status === 403 || info.status === 404) setVersion({ k: "gap", message: info.text, requestId: info.requestId });
        else setVersion({ k: "error", message: info.text, requestId: info.requestId });
      });
    void fetchJsonStrict(HEALTH_API_PATH)
      .then((payload) => {
        if (!live) return;
        const view = readHealth(payload);
        setHealth(view === null ? { k: "unknown", message: "健康接口返回的内容无法解析；不影响版本表。" } : { k: "ready", view });
      })
      .catch((error: unknown) => {
        if (!live) return;
        setHealth({ k: "unknown", message: healthMessage(error) });
      });
    return () => {
      live = false;
    };
  }, [preview, reload]);

  return (
    <Card data-testid="ver5-page">
      <CardContent className="space-y-3 p-4">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-white/85">组件版本与健康</h2>
          <span className="text-xs text-white/45">来源：版本读口 / 健康读口</span>
        </div>
        <HealthLine state={health} />

        {version.k === "loading" ? (
          <div className="space-y-2" data-testid="ver5-loading" aria-busy="true">
            <p className="text-sm text-white/55">正在读取组件版本…</p>
            {[1, 2, 3].map((item) => <div key={item} className="h-8 animate-pulse rounded bg-white/5" />)}
          </div>
        ) : version.k === "empty" ? (
          <div data-testid="ver5-empty">
            <p className="text-sm text-white/70">版本清单为空；不补版本号。</p>
            <p className="mt-1 text-xs text-white/40">接口已响应，但没有返回任何组件行。</p>
          </div>
        ) : version.k === "gap" ? (
          <div className="space-y-2" data-testid="ver5-gap" title={VERSION_GAP}>
            <p className="text-sm text-white/80">版本读口未接入</p>
            <p className="text-xs text-white/50">{version.message}</p>
            <RequestId id={version.requestId} />
            <a className="inline-block text-xs text-white/65 underline underline-offset-2" href="#/approvals" data-testid="ver5-apply">提交开通申请</a>
          </div>
        ) : version.k === "login" ? (
          <p className="text-sm text-white/70" data-testid="ver5-login">{version.message}</p>
        ) : version.k === "error" ? (
          <div className="space-y-2" data-testid="ver5-error" role="alert">
            <p className="text-sm text-white/80">版本表暂时读不出来</p>
            <p className="text-xs text-white/50">{version.message}</p>
            <RequestId id={version.requestId} />
            <Button size="sm" outlined onClick={() => setReload((n) => n + 1)} data-testid="ver5-retry">重试</Button>
          </div>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm" data-testid="ver5-table">
              <thead className="text-xs text-white/45">
                <tr>
                  <th className="py-2 pr-3 font-normal">组件名</th>
                  <th className="py-2 pr-3 font-normal">版本</th>
                  <th className="py-2 pr-3 font-normal">构建时刻</th>
                  <th className="py-2 font-normal">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {version.rows.map((row) => (
                  <tr key={row.key} data-testid={`ver5-row-${row.key}`} title={row.statusRaw ?? undefined}>
                    <td className="py-2 pr-3" data-testid="ver5-name">{row.name ?? "—"}{row.nameReason ? <span className="ml-1 text-xs text-white/40">{row.nameReason}</span> : null}</td>
                    <td className="py-2 pr-3" data-testid="ver5-version" title={row.versionReason ?? undefined}>{row.version ?? "—"}</td>
                    <td className="py-2 pr-3" data-testid="ver5-built" title={row.builtReason ?? undefined}>{row.builtAt ?? "—"}</td>
                    <td className="py-2" data-testid="ver5-status" title={row.statusReason ?? row.statusRaw ?? undefined}>
                      <Badge tone={row.status === "正常" ? "success" : row.status === "降级" ? "warning" : "outline"}>{row.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-white/40">版本与健康各读各的；缺失值显示「—」，不补 0，也不编造版本号。健康读口失败不会挡住版本表。</p>
      </CardContent>
    </Card>
  );
}
