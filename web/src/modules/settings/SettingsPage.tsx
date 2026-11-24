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

/** 骨架 defaults pane 的四张只读表：表头逐字照抄，无读口时用一行 colSpan 声明。 */
const KEY_TABLE = {
  label: "Provider 密钥",
  meta: "缺读口 · 本页不显示任何 provider",
  columns: ["供应商", "密钥", "用途", "最近轮换", "30 天调用", "状态"],
  gap: "缺读口：密钥库没有读口，provider 清单、末四位、用途与 30 天调用都读不到；本页不列假行，也不显示任何明文。",
} as const;

const ROTATION_TABLE = {
  label: "最近轮换",
  meta: "近 30 天 · 只记录动作，不记录值",
  columns: ["时间", "供应商", "操作人", "触发原因", "结果"],
  gap: "缺读口：轮换日志没有读口，本页不显示任何一次轮换动作。",
} as const;

const CHECKPOINT_TABLE = {
  label: "检查点",
  meta: "保留策略无读口",
  columns: ["时间", "类型", "大小", "包含", "耗时"],
  gap: "缺读口：检查点清单与保留策略都没有读口，本页不显示快照数量、大小与耗时。",
} as const;

const AUTO_RULE_TABLE = {
  label: "自动通过规则",
  meta: "按优先级自上而下匹配 · 无读口",
  columns: ["规则", "条件", "结果", "近 7 天命中"],
  gap: "缺读口：审批策略只读摘要没有读口，规则、条件与命中数都读不到。",
} as const;

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

/** 一张「表头逐字 + 一行缺读口声明」的只读表：不造行，也不留空表。 */
function GapTable({
  label,
  meta,
  columns,
  gap,
  testid,
}: {
  label: string;
  meta: string;
  columns: readonly string[];
  gap: string;
  testid: string;
}) {
  return (
    <ConsoleCard
      label={label}
      action={<span className="set5-card-action">{meta}</span>}
      flush
    >
      <div className="set5-tw">
        <table className="set5-table" data-testid={testid}>
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th key={column} className={index > 2 ? "set5-hide-sm" : undefined}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="set5-gap-cell" colSpan={columns.length} data-testid={`${testid}-gap`}>
                {gap}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="set5-card-foot">口径：缺读口的列不填数字，也不按 0 计算；接上读口后这里才有行。</div>
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
            value: "未接入（读口未注册，BFF 答 console.unknown_route）",
            // 术语纪律：屏上不写裸 HTTP 码，码只进 title（既有用例钉住）。
            note: "未注册（BFF 答 console.unknown_route），所以这里没有可改的开关；",
            writable: "0（读口未接入，本页不放任何假开关）",
          }
        : {
            value: "已接入",
            note: "已接入，读到的是服务端返回值；",
            writable: "见下方三态值（只读展示，本页不写）",
          }
      : view.k === "empty"
        ? { value: "已接入但无项", note: "读到了，但服务端没给任何默认项；", writable: "0（服务端无项）" }
        : view.k === "error"
          ? { value: "读取失败", note: "本次读取失败（请求号见上）；", writable: "未知（读取失败，不猜）" }
          : { value: "读取中…", note: "正在核对读口；", writable: "读取中…" };
  const retry = () => {
    if (forced) leavePreview();
    setAttempt((value) => value + 1);
  };
  const content = view.k === "ready" ? view.content : null;

  return (
    <section className="set4-page set5-page" data-testid="set4-page">
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
        范围 本环境只读事实 · 更新 {runtime.collectedAt ?? "—"} · 对象 1 个配置读口 + 1 个运行时摘要 ·
        口径 缺读口一律显示「—」并按缺口声明，不补 0、不估算
      </p>

      {/* 本环境实际生效的只读事实：全部来自真实读口，缺值写「—」+原因。
          2026-11-24：放在状态链之外——配置读口 404 时页面也不能是空壳。 */}
      <ConsoleCard
        label="运行时"
        action={<span className="set5-card-action">本环境只读事实 · 非设置项</span>}
        >
        <div className="set5-facts" data-testid="set4-facts">
        <div className="set5-facts-head">
          <span className="set5-facts-label">只读事实</span>
          <span className="set5-facts-stamp" data-testid="set4-facts-stamp">
            {runtime.collectedAt ? `采集于 ${runtime.collectedAt}` : "采集时刻 —（本次未读到）"}
          </span>
        </div>
        <p className="set5-facts-note">
          这一栏不是设置项：本环境的默认设置读口
          <span className="set5-inline-code" title="BFF 读代理清单里没有它">GET /api/config</span>
          {readPort.note}
          下面列的是这台控制台此刻真实读得到的事实。
        </p>

        <dl className="set5-fact-rows" data-testid="set4-facts-rows">
          <div className="set5-fact-row" title="默认设置读口自检：GET /api/config → 404 console.unknown_route（本环境未注册）">
            <dt>默认设置读口</dt>
            <dd data-testid="set4-fact-read-port">{readPort.value}</dd>
          </div>
          {runtime.phase === "ready" ? runtime.rows.map((row) => (
            <div key={row.key} className="set5-fact-row" title={row.reason ?? undefined} data-testid={`set4-fact-${row.key}`}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          )) : runtime.phase === "loading" ? (
            <div className="set5-fact-row" data-testid="set4-facts-loading" aria-busy="true">
              <dt>运行时摘要</dt>
              <dd>读取中…（/api/hermes-summary 本环境约 8 秒）</dd>
            </div>
          ) : (
            <div className="set5-fact-row" data-testid="set4-facts-unavailable">
              <dt>运行时摘要</dt>
              <dd>—（本次没读到 /api/hermes-summary，不代表 0）</dd>
            </div>
          )}
          <div className="set5-fact-row" title="浏览器侧只读边界：非白名单方法由 BFF 统一拒绝">
            <dt>只读边界</dt>
            <dd>浏览器侧仅 GET/HEAD；写面白名单在 BFF 启动期注册，其余方法一律 405 console.read_only</dd>
          </div>
          <div className="set5-fact-row" title="默认设置可写项计数">
            <dt>可改设置项</dt>
            <dd data-testid="set4-fact-writable">{readPort.writable}</dd>
          </div>
        </dl>

        <p className="set5-facts-source" data-testid="set4-facts-source">
          来源：GET /api/hermes-summary（runtime.hermes.summary.v1）。缺的值写「—」并给原因，不补 0、不估算。
        </p>
        </div>
        <div className="set5-card-foot">
          口径：只读事实取本次响应；设置项的默认值另有读口，未见接入前不显示任何「12 / 600s」这类当前值。
        </div>
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
          {view.degraded ? <p className="set5-degraded" data-testid="set4-degraded">配置自检尚未接入，未落地项按未启用显示；读取到的值保留三态。</p> : null}

          <ConsoleCard label="默认配置项" action={<span className="set5-card-action">读口 /api/config</span>}>
            <div className="set5-rows" data-testid="set4-switches">
              <h3 className="set5-h3">写入开关</h3>
              {content?.switches.map((item) => (
                <div key={item.key} className="set5-row" title={`配置项：${item.key}`} data-testid={`set4-switch-${item.key}`}>
                  <div className="set5-row-main"><p className="set5-row-label">{item.label}</p><p className="set5-row-note">{item.reason}</p></div>
                  <Badge tone={tone(item.state)}>{statusLabel(item.state)}</Badge>
                </div>
              ))}
            </div>
            <div className="set5-card-foot">口径：三态（启用/未启用/未知）照服务端返回值，缺失不当未启用，也不当已开启。</div>
          </ConsoleCard>

          <ConsoleCard label="上游连通自检" action={<span className="set5-card-action">读口 /api/config</span>}>
            <div className="set5-rows" data-testid="set4-upstreams">
              <h3 className="set5-h3">上游连通自检</h3>
              {content?.upstreams.length ? content.upstreams.map((item, index) => (
                <div key={`${item.name}-${index}`} className="set5-row" title={`上游项目 ${index + 1}`}>
                  <div className="set5-row-main"><p className="set5-row-label">{item.name}</p><p className="set5-row-note">{item.reason}</p></div>
                  <Badge tone={tone(item.state)}>{statusLabel(item.state)}</Badge>
                </div>
              )) : (
                <div className="set5-row" title="上游自检">
                  <div className="set5-row-main"><p className="set5-row-label">上游连通自检</p><p className="set5-row-note">配置自检尚未接入，读取不到当前值</p></div>
                  <Badge tone="outline">未启用</Badge>
                </div>
              )}
            </div>
            <div className="set5-card-foot">口径：自检只回答「这次探测通没通」，不代替服务健康清单。</div>
          </ConsoleCard>

          <GapTable {...KEY_TABLE} testid="set5-keys" />
          <GapTable {...ROTATION_TABLE} testid="set5-rotation" />

          <div className="set5-pair">
            <ConsoleCard label="轮换策略" action={<span className="set5-card-action">建议 · 无读口</span>}>
              <dl className="set5-kv">
                <dt>周期</dt><dd>—</dd>
                <dt>提前提醒</dt><dd>—</dd>
                <dt>过期动作</dt><dd>停用该 provider，运行前预检失败（设计口径，策略读口未接入）</dd>
              </dl>
              <div className="set5-card-foot">缺读口：轮换策略没有读口，本页不给周期与提醒天数。</div>
            </ConsoleCard>
            <ConsoleCard label="安全" action={<span className="set5-card-action">设计口径</span>}>
              <p className="set5-prose">
                密钥不进入提示词、不写日志、不出现在前端响应里。任何「查看明文」的请求都应被拒绝——这是设计，不是权限不足。
              </p>
              <div className="set5-card-foot">口径：本页永不回显密钥值，也不提供查看明文的入口。</div>
            </ConsoleCard>
          </div>

          <GapTable {...CHECKPOINT_TABLE} testid="set5-checkpoints" />

          <div className="set5-pair">
            <ConsoleCard label="存储" action={<span className="set5-card-action">检查点占用 · 无读口</span>}>
              <div className="set5-kv">
                <span>占用</span><span className="set5-kv-mono">—</span>
                <span>上限</span><span className="set5-kv-mono">—</span>
              </div>
              <div className="set5-card-foot">缺读口：检查点占用没有读口，本页不给 MB 与占比。</div>
            </ConsoleCard>
            <ConsoleCard label="恢复影响" action={<span className="set5-card-action">须知</span>}>
              <p className="set5-prose">恢复配置会重启网关；进行中的运行会中止并标记「因恢复中断」。</p>
              <div className="set5-card-foot">口径：恢复是写操作，本页不提供入口。</div>
            </ConsoleCard>
          </div>

          <GapTable {...AUTO_RULE_TABLE} testid="set5-approval-rules" />

          <ConsoleCard label="高风险操作去处" action={<span className="set5-card-action">只跳到该去的地方</span>}>
            <div className="set5-rows" data-testid="set4-danger">
              <h3 className="set5-h3">高风险操作去处</h3>
              <div className="set5-row">
                <span className="set5-row-label">审批阈值调整</span><a className="set5-link" href="#/system">前往审批与发布门</a>
              </div>
              <div className="set5-row">
                <span className="set5-row-label">员工激活</span><a className="set5-link" href="#/employees">前往数字员工</a>
              </div>
            </div>
            <div className="set5-card-foot">口径：本页只做只读摘要，写入口在目标页，不在设置页开假开关。</div>
          </ConsoleCard>

          <div className="set5-savebar-note" data-testid="set5-savebar">
            <span className="set5-savebar-count">无未保存改动</span>
            <span className="set5-card-action">本页只读：写入口在目标页，保存条属外壳未改项</span>
          </div>
        </div>
      )}

    </section>
  );
}