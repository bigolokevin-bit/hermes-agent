import { Fragment, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";
import { fetchJSON } from "@/lib/api";
import {
  SYS3_GAP,
  SYS3_PATH,
  readSystemHealth,
  sys3Failure,
  type SystemHealthRead,
  type SystemHealthRow,
  type Sys3State,
} from "./systemHealth";
import { failureRead, publishSourceRead, topLevelIsoAsOf } from "./sourceReads";
import { SERVICE_GAP, findService, readServiceParam, writeServiceParam } from "./serviceLink";

type Preview = "loading" | "empty" | "error" | null;
type CountKey = "normal" | "degraded" | "unreachable" | "unknown";

const COUNT_BUCKETS: Array<{ key: CountKey; state: Sys3State; label: string }> = [
  { key: "normal", state: "正常", label: "正常" },
  { key: "degraded", state: "降级", label: "降级" },
  { key: "unreachable", state: "不可达", label: "不可达" },
  { key: "unknown", state: "待核实", label: "待核实" },
];

type State =
  | { k: "loading" }
  | { k: "ready"; read: SystemHealthRead }
  | { k: "empty"; read: SystemHealthRead }
  | { k: "gap"; message: string; requestId: string | null }
  | { k: "error"; message: string; requestId: string | null }
  | { k: "login"; message: string };

function RequestId({ id }: { id: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!id) return <p className="sys3-req" data-testid="sys3-request-id">请求编号：未提供</p>;
  return (
    <p className="sys3-req" data-testid="sys3-request-id">
      <span>请求编号：</span>
      <code title={id}>{id}</code>
      <button
        type="button"
        aria-label="复制请求编号"
        onClick={() => { void navigator.clipboard?.writeText(id).then(() => setCopied(true), () => setCopied(false)); }}
      >
        {copied ? "已复制" : "复制"}
      </button>
    </p>
  );
}

function RowDetail({ row }: { row: SystemHealthRow }) {
  return (
    <div className="sys4-detail" data-testid={`sys4-detail-${row.key}`}>
      <dl className="sys4-grid">
        <div className="sys4-field">
          <dt>服务名</dt>
          <dd data-testid="sys4-service" title={row.nameReason ?? row.name ?? undefined}>
            <span className="sys15-full" data-testid="sys15-full-service">{row.name ?? "该字段未返回"}</span>
          </dd>
        </div>
        <div className="sys4-field">
          <dt>口径（读口路径）</dt>
          <dd data-testid="sys4-endpoint" title={row.endpoint ?? undefined}>
            <span className="sys15-full" data-testid="sys15-full-endpoint">{row.endpoint ?? "该字段未返回"}</span>
          </dd>
        </div>
        <div className="sys4-field sys4-wide">
          <dt>状态依据</dt>
          <dd data-testid="sys4-basis">
            <ul>{row.basis.map((line) => <li key={line}>{line}</li>)}</ul>
          </dd>
        </div>
        <div className="sys4-field">
          <dt>最近检查时刻</dt>
          <dd data-testid="sys4-checked" title={row.checkedReason ?? undefined}>{row.checkedAt ?? "该字段未返回"}</dd>
        </div>
        <div className="sys4-field">
          <dt>响应耗时</dt>
          <dd data-testid="sys4-latency" title={row.latencyReason ?? undefined}>{row.latency ?? "该字段未返回"}</dd>
        </div>
        <div className="sys4-field sys4-wide">
          <dt>最近一次错误摘要</dt>
          <dd data-testid="sys4-error" title={row.lastErrorReason ?? undefined}>
            <span className="sys15-full" data-testid="sys15-full-error">{row.lastError ?? "该字段未返回"}</span>
            {row.lastErrorRedactions > 0 ? <span className="sys4-redacted" data-testid="sys4-redacted">已脱敏 {row.lastErrorRedactions} 处</span> : null}
            {row.lastErrorTruncated ? <span className="sys4-redacted">摘要已截断</span> : null}
          </dd>
        </div>
      </dl>
      <p className="sys4-note">这里没有「重试该服务检查」写入口；详情只读，缺失字段不补值。</p>
    </div>
  );
}

function tone(state: Sys3State): "success" | "warning" | "destructive" | "outline" {
  if (state === "正常") return "success";
  if (state === "降级") return "warning";
  if (state === "不可达") return "destructive";
  return "outline";
}

export function SystemHealthSurface({ preview = null, onRetry }: { preview?: Preview; onRetry?: () => void }) {
  const [state, setState] = useState<State>(() => {
    if (preview === "loading") return { k: "loading" };
    if (preview === "empty") return { k: "empty", read: { rows: [], asOf: null, asOfReason: "预览空态没有采集时刻。", asOfTitle: "上游没带采集时刻，不用本机时间顶替", overall: "待核实", overallReason: "预览空态没有整体状态。", sources: 0 } };
    if (preview === "error") return { k: "error", message: "预览：健康清单读取失败。", requestId: null };
    return { k: "loading" };
  });
  const [reload, setReload] = useState(0);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<Sys3State | null>(null);
  const [svc, setSvc] = useState<string | null>(() => readServiceParam(window.location.search, window.location.hash));
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const dropService = () => {
    setSvc(null);
    setTargetKey(null);
    writeServiceParam(null);
  };

  const clearService = () => {
    setOpenKey(null);
    dropService();
  };

  useEffect(() => {
    const sync = () => setSvc(readServiceParam(window.location.search, window.location.hash));
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  const linkedRow = state.k === "ready" ? findService(state.read.rows, svc) : null;

  useEffect(() => {
    if (!svc || state.k !== "ready") {
      setTargetKey(null);
      return;
    }
    const match = findService(state.read.rows, svc);
    if (!match) {
      setTargetKey(null);
      setOpenKey(null);
      return;
    }
    setTargetKey(match.key);
    setOpenKey(match.key);
    setFilter(null);
  }, [svc, state]);

  useEffect(() => {
    if (!targetKey) return;
    const timer = window.setTimeout(() => {
      rowRefs.current[targetKey]?.scrollIntoView?.({ block: "center" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [targetKey, openKey]);

  const toggleRow = (key: string) => {
    setOpenKey((current) => (current === key ? null : key));
    if (svc) dropService();
  };

  useEffect(() => {
    if (!openKey) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenKey(null);
      if (svc) {
        setSvc(null);
        setTargetKey(null);
        writeServiceParam(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openKey, svc]);

  useEffect(() => {
    if (preview !== null) {
      publishSourceRead("health", {
        status: "skipped",
        statusReason: "预览态不发起请求。",
        durationMs: null,
        durationReason: "预览态没有发起请求，没有本次耗时。",
        asOf: null,
        asOfReason: "预览态没有发起请求，采集时刻未知。",
        requestId: null,
      });
      return;
    }
    let live = true;
    setState({ k: "loading" });
    publishSourceRead("health", {
      status: "loading",
      statusReason: null,
      durationMs: null,
      durationReason: "读取尚未结束，耗时未记录。",
      asOf: null,
      asOfReason: "读取尚未结束，采集时刻未知。",
      requestId: null,
    });
    const started = performance.now();
    void fetchJSON<unknown>(SYS3_PATH)
      .then((payload) => {
        const durationMs = Math.round(performance.now() - started);
        if (!live) return;
        const read = readSystemHealth(payload);
        if (read === null) {
          setState({ k: "error", message: "健康接口返回的内容无法解析为服务清单。", requestId: null });
          publishSourceRead("health", {
            status: "failed",
            statusReason: "健康接口返回的内容无法解析为服务清单。",
            durationMs,
            durationReason: null,
            asOf: null,
            asOfReason: "响应无法解析，读不到顶层 asOf。",
            requestId: null,
          });
          return;
        }
        publishSourceRead("health", {
          status: read.overall === "降级" ? "degraded" : "ok",
          statusReason: read.overallReason,
          durationMs,
          durationReason: null,
          ...topLevelIsoAsOf(payload),
          requestId: null,
        });
        setState(read.rows.length === 0 ? { k: "empty", read } : { k: "ready", read });
      })
      .catch((error: unknown) => {
        const durationMs = Math.round(performance.now() - started);
        if (!live) return;
        const info = sys3Failure(error);
        const read = failureRead(error);
        publishSourceRead("health", { ...read, durationMs, durationReason: null });
        if (info.status === 401) setState({ k: "login", message: info.text });
        else if (info.status === 403 || info.status === 404) setState({ k: "gap", message: info.text, requestId: info.requestId });
        else setState({ k: "error", message: info.text, requestId: info.requestId });
      });
    return () => { live = false; };
  }, [preview, reload]);

  const retry = () => {
    onRetry?.();
    setFilter(null);
    setOpenKey(null);
    setReload((n) => n + 1);
  };

  const countReason =
    state.k === "loading" ? "正在读取服务健康清单，计数尚未取数。"
      : state.k === "gap" ? `读口未接入：${state.message}`
        : state.k === "login" ? state.message
          : state.k === "error" ? `读取失败：${state.message}`
            : state.k === "empty" ? "健康接口返回了空清单，计数为 0；这不等于所有服务正常。"
              : null;
  const counts = COUNT_BUCKETS.map((bucket) => ({
    ...bucket,
    count: state.k === "ready" || state.k === "empty"
      ? state.read.rows.filter((row) => row.state === bucket.state).length
      : null,
  }));
  const filterable = state.k === "ready";
  const visibleRows = state.k === "ready" && filter
    ? state.read.rows.filter((row) => row.state === filter)
    : state.k === "ready" ? state.read.rows : [];

  const linkReason =
    state.k === "gap" ? `健康读口未接入，无法把「${svc ?? ""}」定位到服务行。`
      : state.k === "login" ? `需要登录后才能把「${svc ?? ""}」定位到服务行。`
        : state.k === "error" ? `健康清单读取失败，无法定位「${svc ?? ""}」。`
          : state.k === "empty" ? `健康接口返回了空清单，无法定位「${svc ?? ""}」。`
            : state.k === "ready" ? `本次健康清单里没有匹配「${svc ?? ""}」的服务；清单来自一次真实响应，不补行。`
              : "";

  return (
    <Card data-testid="sys3-page">
      <CardContent className="space-y-3 p-4" data-fixture={preview ?? undefined}>
        <div className="sys5-counts" data-testid="sys5-counts" aria-label="服务状态计数">
          {counts.map((bucket) => {
            const value = bucket.count === null ? "—" : String(bucket.count);
            const title = bucket.count === null
              ? countReason ?? "计数不可用。"
              : filterable && filter === bucket.state
                ? `取消「${bucket.label}」筛选，显示全部服务。`
                : filterable
                  ? `只看状态为「${bucket.label}」的服务；筛选只在本地生效，不改网址。`
                  : countReason ?? undefined;
            return filterable ? (
              <button
                key={bucket.key}
                type="button"
                className="sys5-count"
                data-testid={`sys5-count-${bucket.key}`}
                data-state={bucket.state}
                aria-pressed={filter === bucket.state}
                title={title}
                onClick={() => {
                  setOpenKey(null);
                  setFilter((current) => (current === bucket.state ? null : bucket.state));
                  if (svc) clearService();
                }}
              >
                <span className="sys5-count-label">{bucket.label}</span>
                <b className="sys5-count-value">{value}</b>
              </button>
            ) : (
              <span
                key={bucket.key}
                className="sys5-count is-muted"
                data-testid={`sys5-count-${bucket.key}`}
                data-state={bucket.state}
                title={title}
              >
                <span className="sys5-count-label">{bucket.label}</span>
                <b className="sys5-count-value">{value}</b>
              </span>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-white/85">服务健康清单</h2>
            <p className="mt-1 text-xs text-white/45">来源：健康读口 · 最近检查时刻只取接口顶层采集时间</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="sys3-planned"
              data-testid="sys3-planned-edit"
              data-planned="1"
              aria-disabled="true"
              title="控制台还没有探针写入口；接入后会提供编辑与启停管理。"
              onClick={(event) => event.preventDefault()}
            >
              编辑探针（计划中）
            </button>
            <Button size="sm" outlined onClick={retry} disabled={state.k === "loading"} data-testid="sys3-refresh">刷新</Button>
          </div>
        </div>

        {svc && state.k !== "loading" ? (
          linkedRow ? (
            <p className="sys14-link-note" data-testid="sys14-link-target" role="status">
              已定位到「{linkedRow.name ?? linkedRow.key}」。
              <a
                href="#/system?tab=health"
                data-testid="sys14-link-clear"
                onClick={(event) => { event.preventDefault(); clearService(); }}
              >
                清除定位
              </a>
            </p>
          ) : (
            <div className="sys14-link-missing" data-testid="sys14-link-missing" title={SERVICE_GAP} role="status">
              <b>该服务不在当前清单里</b>
              <span>{linkReason}</span>
              <a
                href="#/system?tab=health"
                data-testid="sys14-link-clear"
                onClick={(event) => { event.preventDefault(); clearService(); }}
              >
                回到全部服务
              </a>
            </div>
          )
        ) : null}

        {state.k === "loading" ? (
          <div className="sys3-loading" data-testid="sys3-loading" aria-busy="true">
            <p>正在读取服务健康清单…</p>
            {[1, 2, 3].map((n) => <div key={n} className="sys3-skeleton" />)}
          </div>
        ) : state.k === "gap" ? (
          <div className="sys3-gap" data-testid="sys3-gap" title={SYS3_GAP}>
            <p className="sys3-gap-title">健康读口未接入</p>
            <p className="sys3-gap-body">{state.message}</p>
            <RequestId id={state.requestId} />
            <a className="sys3-apply" href="#/approvals" data-testid="sys3-apply">提交开通申请</a>
          </div>
        ) : state.k === "login" ? (
          <p className="sys3-gap" data-testid="sys3-login">{state.message}</p>
        ) : state.k === "error" ? (
          <div className="sys3-gap" data-testid="sys3-error" role="alert">
            <p className="sys3-gap-title">健康清单暂时读不出来</p>
            <p className="sys3-gap-body">{state.message}</p>
            <RequestId id={state.requestId} />
            <Button size="sm" outlined onClick={retry} data-testid="sys3-retry">重试</Button>
          </div>
        ) : state.k === "empty" ? (
          <div className="sys3-gap" data-testid="sys3-empty">
            <p className="sys3-gap-title">健康接口返回了空清单</p>
            <p className="sys3-gap-body">这不等于所有服务正常；不补服务行，也不给绿色结论。</p>
          </div>
        ) : (
          <>
            <div className="sys3-summary" data-testid="sys3-summary">
              <span>整体状态</span>
              <Badge tone={tone(state.read.overall)} data-testid="sys3-overall">{state.read.overall}</Badge>
              <span data-testid="sys3-sources">来源 {state.read.sources ?? "—"} 项</span>
              <span data-testid="sys3-asof" title={state.read.asOfTitle}>{state.read.asOf ?? "—"}</span>
              {state.read.overallReason ? <span className="sys3-reason">{state.read.overallReason}</span> : null}
              {state.read.asOfReason ? <span className="sys3-reason">{state.read.asOfReason}</span> : null}
            </div>
            <p className="sys5-filter-note" data-testid="sys5-filter-note">
              {filter
                ? `已筛：${filter} · ${visibleRows.length} 项。筛选只在本地生效，不改网址；刷新后回到全部服务。`
                : "点上面的状态计数可只看该状态的服务；筛选只在本地生效，不改网址。"}
              {filter ? (
                <button type="button" data-testid="sys5-clear" onClick={() => { setFilter(null); setOpenKey(null); }}>
                  清除筛选
                </button>
              ) : null}
            </p>
            <p className="sys4-hint">点行或按 Enter 展开详情，Esc 收起；同时只展开一行。</p>
            {visibleRows.length === 0 ? (
              <p className="sys3-foot" data-testid="sys5-filter-empty">
                当前筛选下没有服务；计数来自同一次健康响应，这里不补服务行。
              </p>
            ) : (
            <>
            <p className="sys3-scrollhint" data-testid="sys3-scrollhint">左右滑动查看全部列</p>
            <div className="sys3-scroll">
              <table className="sys3-table" data-testid="sys3-table">
                <thead>
                  <tr>
                    <th>服务名</th><th>状态</th><th>版本或构建标识</th><th>最近检查时刻</th><th>响应耗时</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <Fragment key={row.key}>
                      <tr
                        ref={(node) => { rowRefs.current[row.key] = node; }}
                        data-testid={`sys3-row-${row.key}`}
                        data-open={openKey === row.key ? "1" : undefined}
                        tabIndex={0}
                        aria-expanded={openKey === row.key}
                        aria-current={targetKey === row.key ? "true" : undefined}
                        aria-controls={`sys4-detail-row-${row.key}`}
                        className={`sys3-row${targetKey === row.key ? " is-svc-target" : ""}`}
                        onClick={() => toggleRow(row.key)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleRow(row.key);
                          }
                        }}
                      >
                        <td data-testid="sys3-name" title={[row.name, row.nameReason].filter(Boolean).join(" · ") || undefined}>
                          <span className="sys15-trunc" data-testid="sys15-trunc-name">{row.name ?? "—"}</span>
                        </td>
                        <td data-testid="sys3-state" title={row.stateReason ?? row.stateRaw ?? undefined}>
                          <Badge tone={tone(row.state)}>{row.state}</Badge>
                        </td>
                        <td data-testid="sys3-version" title={[row.version, row.versionReason].filter(Boolean).join(" · ") || undefined}>
                          <span className="sys15-trunc" data-testid="sys15-trunc-version">{row.version ?? "—"}</span>
                        </td>
                        <td data-testid="sys3-checked" title={row.checkedReason ?? undefined}>{row.checkedAt ?? "—"}</td>
                        <td data-testid="sys3-latency" title={row.latencyReason ?? undefined}>{row.latency ?? "—"}</td>
                      </tr>
                      {openKey === row.key ? (
                        <tr data-testid={`sys4-detail-row-${row.key}`} id={`sys4-detail-row-${row.key}`}>
                          <td colSpan={5}><RowDetail row={row} /></td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            </>
            )}
            <p className="sys3-foot">缺失值显示「—」，原因在悬停说明里；不用本机时钟补采集时刻，也不把未知当正常。</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
