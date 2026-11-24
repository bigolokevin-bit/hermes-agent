import { useEffect, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { copyTextToClipboard } from "@/lib/clipboard";
import { currentFixtureState, fixtureView, type FixtureState } from "../../shell/fixtures";
import { readSettings, readRuntimeFacts, statusLabel, type RuntimeFacts, type SettingState } from "./settings";
import "./settings.css";

type Content = ReturnType<typeof readSettings>;
type State = { k: "loading" } | { k: "empty" } | { k: "error"; requestId: string } | { k: "ready"; content: Content; degraded: boolean };

/** 骨架 defaults pane 各表的列名（同骨架同序）：整表无读口时不渲染空列，缺哪列在卡底「数据可用性」点名。 */
const KEY_COLUMNS = ["供应商", "密钥", "用途", "最近轮换", "30 天调用", "状态"] as const;
const ROTATION_COLUMNS = ["时间", "供应商", "操作人", "触发原因", "结果"] as const;
const CHECKPOINT_COLUMNS = ["时间", "类型", "大小", "包含", "耗时"] as const;
const RULE_COLUMNS = ["规则", "条件", "结果", "近 7 天命中"] as const;

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

/** 整表无读口的只读卡：正文一行「—」，缺的列在卡底可用性块点名，口径在卡底一行。 */
function GapCard({
  label,
  meta,
  columns,
  extra,
  note,
  testid,
}: {
  label: string;
  meta: string;
  columns: readonly string[];
  extra?: { label: string; reason?: string }[];
  note: string;
  testid: string;
}) {
  return (
    <ConsoleCard
      label={label}
      action={<span className="set5-card-action">{meta}</span>}
      availability={[...columns.map((column) => ({ label: `列「${column}」` })), ...(extra ?? [])]}
      note={note}
    >
      <p className="set5-dash" data-testid={testid}>—</p>
    </ConsoleCard>
  );
}

export function SettingsPage() {
  const [state, setState] = useState<State>({ k: "loading" });
  // 起步是「读取中」：读口要 8s 才回来，不能先喊「没读到」（那是假话）。
  const [runtime, setRuntime] = useState<RuntimeFacts>({ phase: "loading", rows: [], collectedAt: null, note: null });
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

  // 2026-11-24：默认设置的读口（/api/config）在本环境没注册，页面不能再只剩
  // 四行「未启用」。这里补一条真实读口：runtime.hermes.summary.v1（网关/平台/
  // 连接/今日计数），把「这台机器此刻是什么状态」摊开；读不到就说读不到。
  useEffect(() => {
    let alive = true;
    if (forcedState(forced)) return () => { alive = false; };
    void (async () => {
      try {
        const summary = await fetchJSON<unknown>("/agent-api/api/hermes-summary");
        if (!alive) return;
        setRuntime(readRuntimeFacts(summary));
      } catch {
        if (!alive) return;
        setRuntime({ phase: "unavailable", rows: [], collectedAt: null, note: null });
      }
    })();
    return () => { alive = false; };
  }, [forced, attempt]);

  const view = preview ?? state;
  // 读口状态四种：读到（degraded=404 未注册）、读到但没项、读取失败、读取中。
  // 只在有实际证据时给结论，页面任何一态都不会落成空白。
  const readPort =
    view.k === "ready"
      ? view.degraded
        ? {
            value: "未接入",
            // 工程语言不上屏：路由码与错误码只进 title。
            title: "默认设置读口自检：GET /api/config → 404 console.unknown_route（本环境未注册）",
            writable: "0（读口未注册，本页不放任何假开关）",
          }
        : {
            value: "已接入",
            title: "已接入，读到的是服务端返回值",
            writable: "见下方三态值（只读展示，本页不写）",
          }
      : view.k === "empty"
        ? { value: "已接入但无项", title: "读到了，但服务端没给任何默认项", writable: "0（服务端无项）" }
        : view.k === "error"
          ? { value: "读取失败", title: "本次读取失败（请求号见上）", writable: "未知（读取失败，不猜）" }
          : { value: "读取中…", title: "正在核对读口", writable: "读取中…" };
  const retry = () => {
    if (forced) leavePreview();
    setAttempt((value) => value + 1);
  };
  const content = view.k === "ready" ? view.content : null;

  return (
    <section className="set5-page" data-testid="set4-page">
      <header className="set5-head">
        <div className="min-w-0">
          <h2 className="set5-title" data-testid="set5-title">默认设置</h2>
          <p className="set5-sub" data-testid="set5-sub">运行时 · 密钥 · 插件 · 检查点</p>
        </div>
        <Button size="sm" outlined onClick={retry} disabled={view.k === "loading"} data-testid="set5-refresh">
          <RefreshCw className="mr-1 size-3.5" aria-hidden="true" />重新读取
        </Button>
      </header>

      <p className="set5-caliber" data-testid="set5-caliber">
        范围 本环境只读事实 · 更新 {runtime.collectedAt ?? "未读到"} · 对象 1 个配置读口 + 1 个运行时摘要 ·
        口径 缺读口按缺口声明，不补 0、不估算
      </p>

      {/* 本环境实际生效的只读事实：全部来自真实读口。两层套框就到顶：页底 → 卡 → 行横线。 */}
      <ConsoleCard
        label="运行时"
        action={<span className="set5-card-action">本环境只读事实 · 非设置项</span>}
        availability={[{
          label: "默认设置项当前值（时区 · 并发 · 超时 · 保留）",
          reason: "配置读口本环境未注册，不显示任何「12 / 600s」这类当前值",
        }]}
        note={
          <span title="runtime.hermes.summary.v1">
            <span data-testid="set4-facts-stamp">
              {runtime.collectedAt ? `采集于 ${runtime.collectedAt}` : "采集时刻 —（本次未读到）"}
            </span>
            {" · 来源：运行时摘要读口，缺值按缺口标注，不补 0、不估算"}
          </span>
        }
      >
        <dl className="set5-fact-rows" data-testid="set4-facts" data-facts-phase={runtime.phase}>
          <div className="set5-fact-row" title={readPort.title}>
            <dt>默认设置读口</dt>
            <dd data-testid="set4-fact-read-port">{readPort.value}</dd>
          </div>
          {runtime.phase === "ready" ? runtime.rows.map((row) => (
            <div key={row.key} className="set5-fact-row" title={row.reason ?? undefined} data-testid={`set4-fact-${row.key}`}>
              <dt>{row.label}</dt>
              {row.key === "metrics-today" && row.stats ? (
                <dd className="set5-stats">
                  {row.stats.map((stat, index) => (
                    <span key={stat.label} className="set5-stat">
                      {index > 0 ? <span className="set5-stat-sep" aria-hidden="true"> · </span> : null}
                      <span className="set5-stat-k">{stat.label} </span>
                      <b className="set5-stat-v">{stat.value}</b>
                    </span>
                  ))}
                </dd>
              ) : (
                <dd>{row.display ?? row.value}</dd>
              )}
            </div>
          )) : runtime.phase === "loading" ? (
            <div className="set5-fact-row" data-testid="set4-facts-loading" aria-busy="true">
              <dt>运行时摘要</dt>
              <dd>读取中…（运行时摘要本环境约 8 秒）</dd>
            </div>
          ) : (
            <div className="set5-fact-row" data-testid="set4-facts-unavailable">
              <dt>运行时摘要</dt>
              <dd>本次没读到运行时摘要，不代表 0</dd>
            </div>
          )}
          <div className="set5-fact-row" title="浏览器侧仅 GET/HEAD；写面白名单在 BFF 启动期注册，其余方法一律 405 console.read_only">
            <dt>只读边界</dt>
            <dd>浏览器侧只允许读取类请求，其余方法一律被网关拒绝</dd>
          </div>
          <div className="set5-fact-row" title="默认设置可写项计数">
            <dt>可改设置项</dt>
            <dd data-testid="set4-fact-writable">{readPort.writable}</dd>
          </div>
        </dl>
      </ConsoleCard>

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
        <div className="set5-stack" data-testid="set4-content">
          <ConsoleCard
            label="配置自检"
            action={<span className="set5-card-action">读口 /api/config</span>}
            availability={view.degraded ? [{
              label: "配置自检结果",
              reason: "配置自检尚未接入，未落地项按未启用显示；读取到的值保留三态",
            }] : undefined}
            note="口径：三态（启用/未启用/未知）照服务端返回值，缺失不当未启用，也不当已开启。"
          >
            <div className="set5-rows" data-testid="set4-switches">
              <p className="set5-subhead">写入开关</p>
              {content?.switches.map((item) => (
                <div key={item.key} className="set5-row" title={item.reason} data-testid={`set4-switch-${item.key}`}>
                  <span className="set5-row-label">{item.label}</span>
                  <Badge tone={tone(item.state)}>{statusLabel(item.state)}</Badge>
                </div>
              ))}
            </div>
            <div className="set5-rows" data-testid="set4-upstreams">
              <p className="set5-subhead">上游连通自检</p>
              {content?.upstreams.length ? content.upstreams.map((item, index) => (
                <div key={`${item.name}-${index}`} className="set5-row" title={item.reason}>
                  <span className="set5-row-label">{item.name}</span>
                  <Badge tone={tone(item.state)}>{statusLabel(item.state)}</Badge>
                </div>
              )) : (
                <div className="set5-row" title="配置自检尚未接入，读取不到当前值">
                  <span className="set5-row-label">上游连通自检</span>
                  <Badge tone="outline">未启用</Badge>
                </div>
              )}
            </div>
          </ConsoleCard>

          <GapCard
            label="Provider 密钥"
            meta="只写不读"
            columns={KEY_COLUMNS}
            extra={[{ label: "凭据新增 / 轮换 / 删除", reason: "后端写接口未就绪，本页不放假按钮" }]}
            note="口径：密钥只写不读，任何「查看明文」的请求都会被拒绝；本页不列假行。"
            testid="set5-keys"
          />

          <GapCard
            label="最近轮换"
            meta="近 30 天"
            columns={ROTATION_COLUMNS}
            extra={[{ label: "轮换策略（周期 · 提前提醒）", reason: "没有读口，不编天数" }]}
            note="口径：只记录动作，不记录值。"
            testid="set5-rotation"
          />

          <ConsoleCard
            label="安全"
            action={<span className="set5-card-action">设计口径</span>}
            note="口径：任何「查看明文」的请求都会被拒绝；这是设计，不是权限不足。"
          >
            <p className="set5-prose">密钥不进入提示词、不写日志、不出现在前端响应里。</p>
          </ConsoleCard>

          <GapCard
            label="检查点"
            meta="只追加 · 每 2 小时自动"
            columns={CHECKPOINT_COLUMNS}
            extra={[{ label: "检查点占用与保留策略", reason: "没有读口，不显示快照数量、大小与耗时" }]}
            note="口径：检查点不含会话与运行日志；恢复后运行历史按原样保留。"
            testid="set5-checkpoints"
          />

          <ConsoleCard
            label="恢复影响"
            action={<span className="set5-card-action">须知</span>}
            note="口径：恢复是写操作，本页不提供入口。"
          >
            <p className="set5-prose">恢复配置会重启网关；进行中的运行会中止并标记「因恢复中断」。</p>
          </ConsoleCard>

          <GapCard
            label="审批策略摘要"
            meta="只读"
            columns={RULE_COLUMNS}
            extra={[
              { label: "默认审批链", reason: "没有读口，不画步骤图" },
              { label: "流程覆盖与策略变更", reason: "没有读口，不给百分比" },
            ]}
            note="口径：自动通过规则按优先级自上而下匹配；策略改动无法撤销，只能新增版本回滚。"
            testid="set5-approval-rules"
          />

          <ConsoleCard
            label="高风险操作去处"
            action={<span className="set5-card-action">只跳到该去的地方</span>}
            note="口径：本页只做只读摘要，写入口在目标页，不在设置页开假开关。"
          >
            <div className="set5-rows" data-testid="set4-danger">
              <div className="set5-row">
                <span className="set5-row-label">审批阈值调整</span><a className="set5-link" href="#/system">前往审批与发布门</a>
              </div>
              <div className="set5-row">
                <span className="set5-row-label">员工激活</span><a className="set5-link" href="#/employees">前往数字员工</a>
              </div>
            </div>
          </ConsoleCard>

          <div className="set5-savebar-note" data-testid="set5-savebar">
            <span className="set5-savebar-count">无未保存改动</span>
            <span className="set5-card-action">本页只读：写入口在目标页</span>
          </div>
        </div>
      )}

    </section>
  );
}
