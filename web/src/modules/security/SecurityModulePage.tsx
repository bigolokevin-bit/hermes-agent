import { useCallback, useEffect, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";
import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { currentFixtureState, fixtureView } from "../../shell/fixtures";
import {
  SEC_GAP,
  SEC_SOURCE,
  itemLabel,
  loadRisk,
  readSecurity,
  type RiskState,
  type SecurityItem,
} from "./security";
import "./security.css";

type ConfigState =
  | { phase: "loading" }
  | { phase: "ready"; items: SecurityItem[] }
  | { phase: "empty" }
  | { phase: "gap"; requestId: string | null }
  | { phase: "error"; message: string; requestId: string | null };


function RequestId({ id, testid = "sec5-request-id" }: { id: string | null; testid?: string }): ReactNode {
  const [copied, setCopied] = useState(false);
  if (!id) return <span className="sec5-note" data-testid={testid}>请求编号：未提供</span>;
  return (
    <span className="sec5-req" data-testid={testid} title={id}>
      请求编号：{id.length > 8 ? id.slice(0, 8) : id}
      <button
        type="button"
        className="sec5-copy"
        aria-label="复制完整请求编号"
        onClick={() => {
          void navigator.clipboard?.writeText(id).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          });
        }}
      >
        {copied ? "已复制" : "复制"}
      </button>
    </span>
  );
}

function ItemRow({ item }: { item: SecurityItem }): ReactNode {
  return (
    <div className="sec5-row" data-testid={`sec5-item-${item.key}`} title={item.state === "configured" ? undefined : `${SEC_GAP}：${item.reason}`}>
      <div className="sec5-row-main">
        <b>{item.label}</b>
        <span>{item.reason}</span>
        <span>
          来源：{item.source} · 数据截至 {item.asOf ?? "时间未知"}
          {item.asOfReason ? `（${item.asOfReason}）` : ""}
        </span>
      </div>
      <Badge tone={item.state === "configured" ? "success" : item.state === "missing" ? "warning" : "secondary"}>
        <span data-testid={`sec5-state-${item.key}`}>{itemLabel(item.state)}</span>
      </Badge>
    </div>
  );
}

function Section({ title, testid, children }: { title: string; testid: string; children: ReactNode }): ReactNode {
  return (
    <Card className="sec5-card">
      <CardContent data-testid={testid}>
        <h2>{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

function RiskList({ state, onRetry }: { state: RiskState; onRetry: () => void }): ReactNode {
  if (state.phase === "loading") return <p className="sec5-note" data-testid="sec5-risk-loading">正在读取高危操作…</p>;
  if (state.phase === "gap") {
    return (
      <div className="sec5-error" data-testid="sec5-risk-gap" title={SEC_GAP}>
        <b>高危操作未接入</b>
        <p>{state.message}</p>
        <RequestId id={null} testid="sec5-risk-request-id" />
      </div>
    );
  }
  if (state.phase === "error") {
    return (
      <div className="sec5-error" data-testid="sec5-risk-error" role="alert">
        <b>{state.message}</b>
        <RequestId id={state.requestId} testid="sec5-risk-request-id" />
        <Button size="sm" outlined onClick={onRetry} data-testid="sec5-risk-retry">重试</Button>
      </div>
    );
  }
  if (state.phase === "empty") {
    return <p className="sec5-note" data-testid="sec5-risk-empty">接口已响应，没有高危操作记录；不补 0，也不展示样例。</p>;
  }
  return (
    <div className="sec5-table-wrap">
      <table className="sec5-table" data-testid="sec5-risk-table">
        <thead><tr><th>操作</th><th>对象</th><th>时间（北京时间）</th><th>请求编号</th></tr></thead>
        <tbody>
          {state.rows.map((row) => (
            <tr key={row.id} data-testid="sec5-risk-row" title={row.action}>
              <td data-label="操作">{row.action}</td>
              <td data-label="对象">{row.object}{row.objectReason ? <span className="sec5-note">{row.objectReason}</span> : null}</td>
              <td data-label="时间">{row.at ?? "—"}</td>
              <td data-label="请求编号"><RequestId id={row.requestId} testid="sec5-risk-request-id" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SecurityModulePage(): ReactNode {
  const forced = currentFixtureState();
  const [config, setConfig] = useState<ConfigState>({ phase: "loading" });
  const [risk, setRisk] = useState<RiskState>({ phase: "loading" });
  const [attempt, setAttempt] = useState(0);
  const preview = fixtureView<ConfigState | null>(forced ?? "ready", {
    loading: () => ({ phase: "loading" }),
    empty: () => ({ phase: "empty" }),
    error: () => ({ phase: "error", message: "这条腿是用 ?state=error 复现的，服务此刻没有回答过。", requestId: "sec5-repro-rid" }),
    denied: () => ({ phase: "gap", requestId: null }),
    ready: () => null,
  });

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (forced) return;
    let alive = true;
    setConfig({ phase: "loading" });
    setRisk({ phase: "loading" });
    void fetchJSON<unknown>("/agent-api/api/config")
      .then((payload) => {
        if (!alive) return;
        const items = readSecurity(payload);
        setConfig(items.length ? { phase: "ready", items } : { phase: "empty" });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const api = err instanceof ApiError ? err : null;
        if (api?.status === 403 || api?.status === 404) setConfig({ phase: "gap", requestId: api.requestId ?? null });
        else setConfig({ phase: "error", message: api?.message || "安全配置暂时无法读取。", requestId: api?.requestId ?? null });
      });
    void loadRisk().then((next) => { if (alive) setRisk(next); });
    return () => { alive = false; };
  }, [attempt, forced]);

  const view = preview ?? config;
  const items = view.phase === "ready" ? view.items : view.phase === "gap" ? readSecurity({}) : [];
  const session = items.slice(0, 3);
  const secrets = items.slice(3);
  const counts = items.length;
  const planned = [
    { id: "session", label: "修改会话策略", reason: "只读视图：写入口尚未接通，不能修改会话有效期或并发登录。" },
    { id: "mfa", label: "启用双因素认证", reason: "只读视图：双因素认证由身份服务管理，控制台不提供写入。" },
    { id: "rotate", label: "轮换密钥", reason: "只读视图：凭据值不在控制台展示，也不在这里轮换。" },
  ];

  return (
    <section className="sec5-page" data-testid="sec5-page">
      <header className="sec5-head">
        <div className="sec5-title">
          <h1>安全设置</h1>
          <p>登录、密钥与高危操作 · 只读</p>
        </div>
        <Button size="sm" outlined onClick={reload} disabled={view.phase === "loading"} data-testid="sec5-refresh" prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          重新读取
        </Button>
      </header>

      {view.phase === "loading" ? (
        <Card><CardContent className="sec5-card" data-testid="sec5-loading" aria-busy="true">
          <p className="sec5-note">正在读取安全配置…</p>
          {[1, 2, 3].map((n) => <div key={n} className="h-10 animate-pulse rounded bg-white/5" />)}
        </CardContent></Card>
      ) : view.phase === "empty" ? (
        <Card><CardContent className="sec5-card" data-testid="sec5-empty">安全配置未提供可展示项；这不是把缺失当成已配置。</CardContent></Card>
      ) : view.phase === "gap" ? (
        <div className="sec5-error" data-testid="sec5-gap" title={SEC_GAP}>
          <b>安全配置未接入</b>
          <p>上游配置读取尚未对控制台开放；下面按未知显示，不猜成已配置或未配置。</p>
          <RequestId id={view.requestId} testid="sec5-gap-request-id" />
        </div>
      ) : view.phase === "error" ? (
        <div className="sec5-error" data-testid="sec5-error" role="alert">
          <b>{view.message}</b>
          <RequestId id={view.requestId} />
          <Button size="sm" outlined onClick={reload} data-testid="sec5-retry">重试</Button>
        </div>
      ) : null}

      <div className="sec5-grid">
        <Section title="登录与会话" testid="sec5-session">
          {session.length ? session.map((item) => item.key === "twoFactor" ? (
            <div key={item.key} data-testid="sec5-mfa"><ItemRow item={item} /></div>
          ) : <ItemRow key={item.key} item={item} />) : <p className="sec5-note">未读到登录与会话配置；不填默认值。</p>}
        </Section>
        <div data-testid="sec5-keyring"><Section title="密钥与凭据" testid="sec5-secrets">
          {secrets.length ? secrets.map((item) => <ItemRow key={item.key} item={item} />) : <p className="sec5-note">未读到密钥配置；不展示任何密钥值。</p>}
          <p className="sec5-note">这里只显示已配置 / 未配置 / 未知，不显示密钥内容。</p>
        </Section></div>
      </div>

      <div data-testid="sec5-risky"><Section title="高风险操作" testid="sec5-risk">
        <RiskList state={risk} onRetry={reload} />
        <p className="sec5-note">来源：{SEC_SOURCE} · 只读</p>
      </Section></div>

      <Card className="sec5-card">
        <CardContent data-testid="sec5-planned">
          <h2>安全写入操作</h2>
          <p className="sec5-note">这些动作需要写权限，当前只读面不提供执行入口。</p>
          <div className="sec5-planned">
            {planned.map((item) => (
              <button key={item.id} type="button" disabled aria-disabled="true" data-planned="true" title={item.reason} data-testid={`sec5-planned-${item.id}`}>
                {item.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <p className="sec5-note" data-testid="sec5-summary" data-count={counts}>已读取 {counts} 项安全配置；缺失或未知项不按 0 计算。</p>
    </section>
  );
}

export default SecurityModulePage;
