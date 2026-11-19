import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, BookOpen, Copy, FileText, RefreshCw, Search } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { fetchJsonStrict } from "@/modules/models/fetchJson";
import { ApiError } from "@/lib/api-error";
import {
  ENDPOINTS,
  GAP03_HUMAN,
  KNOWLEDGE_GAP,
  TAB_LABEL,
  TAB_SOURCE,
  initialTab,
  isForcedState,
  readKnowledge,
  type CitationRow,
  type KnowledgePhase,
  type KnowledgeRow,
  type KnowledgeTab,
} from "./knowledge";
import "./knowledge.css";

type ErrorView = { message: string; requestId: string | null; status: number | null };

const TAB_ORDER: KnowledgeTab[] = ["spaces", "ingest", "retrieval", "evidence"];

const EMPTY_TEXT: Record<KnowledgeTab, string> = {
  spaces: "当前没有读到知识空间。接口已响应，但列表为空；这不等于「没有空间」。",
  ingest: "当前没有读到文档登记。接口已响应，但列表为空；不显示 0 篇。",
  retrieval: "当前没有读到检索结果。接口已响应，但结果为空；不展示样例命中。",
  evidence: "当前没有读懂引用记录。接口已响应，但列表为空；不展示样例。",
};

function RequestId({ id, testid = "knw4-request-id" }: { id: string | null; testid?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <span className="knw4-req" data-testid={testid}>
      请求编号：{id ?? "未提供"}
      {id ? (
        <button type="button" className="knw4-copy" onClick={copy} aria-label="复制请求编号">
          <Copy className="h-3 w-3" aria-hidden />
          {copied ? "已复制" : "复制"}
        </button>
      ) : null}
    </span>
  );
}

function Skeleton({ testid }: { testid: string }) {
  return (
    <div className="knw4-skeleton" data-testid={testid} aria-busy="true" aria-label="加载中">
      <span /><span /><span />
    </div>
  );
}

function Reason({ children }: { children: string | null }) {
  if (!children) return null;
  return <span className="knw4-reason">{children}</span>;
}

function RowTable({ rows, testid }: { rows: KnowledgeRow[]; testid: string }) {
  return (
    <div className="knw4-scroll">
      <table className="knw4-table" data-testid={testid}>
        <thead>
          <tr>
            <th>名称</th>
            <th>类型</th>
            <th>规模</th>
            <th>更新时间</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || `row-${index}`} data-testid="knw4-row" title={row.id || undefined}>
              <td data-label="名称">
                <span className="knw4-name">{row.name}</span>
                <Reason>{row.nameReason}</Reason>
              </td>
              <td data-label="类型">
                <span>{row.kind}</span>
                <Reason>{row.kindReason}</Reason>
              </td>
              <td data-label="规模">
                <span>{row.scale}</span>
                <Reason>{row.scaleReason}</Reason>
              </td>
              <td data-label="更新时间">
                <span>{row.updatedAt}</span>
                <Reason>{row.updatedReason}</Reason>
              </td>
              <td data-label="状态">
                <Badge tone={row.status === "正常" ? "success" : row.status === "不可用" ? "destructive" : "outline"}>
                  {row.status}
                </Badge>
                <Reason>{row.statusReason}</Reason>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CitationList({ rows }: { rows: CitationRow[] }) {
  return (
    <ul className="knw4-citations" data-testid="knw4-citations">
      {rows.map((row, index) => (
        <li key={row.id || `citation-${index}`} className="knw4-citation" data-testid="knw4-citation-row">
          <div className="knw4-citation-main">
            <div className="knw4-citation-title">
              <Badge tone="outline">{row.kind}</Badge>
              <span title={row.id || undefined}>{row.title}</span>
            </div>
            <div className="knw4-citation-meta">
              <span title={row.employeeRaw || undefined}>{row.employee}</span>
              <span>{row.at}</span>
            </div>
          </div>
          {row.href ? (
            <Link className="knw4-link" to={row.href} data-testid="knw4-citation-open">
              打开原文
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <span className="knw4-unreachable" data-testid="knw4-citation-unreachable">
              <b>原文不可达</b>
              <span>{row.unreachable}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function KnowledgeModulePage() {
  const [sp, setSp] = useSearchParams();
  const forcedRaw = (sp.get("state") ?? "").toLowerCase();
  const forced = isForcedState(forcedRaw) ? forcedRaw : null;
  const requestedTab = initialTab(sp.get("tab"), sp.get("panel"));
  const [tab, setTab] = useState<KnowledgeTab>(requestedTab);
  const [phase, setPhase] = useState<KnowledgePhase>("loading");
  const [payload, setPayload] = useState(() => readKnowledge("spaces", null));
  const [error, setError] = useState<ErrorView | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    setTab(requestedTab);
  }, [requestedTab]);

  const selectTab = (key: KnowledgeTab) => {
    setTab(key);
    const next = new URLSearchParams(sp);
    // Keep `tab` on a shell-known value so the module stays mounted; `panel`
    // carries the knw4 panel, which is what refresh/back must restore.
    if (!next.get("tab")) next.set("tab", "spaces");
    next.set("panel", key);
    setSp(next);
  };

  useEffect(() => {
    if (forced) return;
    let live = true;
    setPhase("loading");
    setError(null);
    fetchJsonStrict(ENDPOINTS[tab].url)
      .then((body) => {
        if (!live) return;
        const next = readKnowledge(tab, body);
        setPayload(next);
        const count = tab === "evidence" ? next.citations.length : next.rows.length;
        setPhase(count === 0 ? "empty" : "ready");
      })
      .catch((cause: unknown) => {
        if (!live) return;
        const api = cause instanceof ApiError ? cause : null;
        const status = api?.status ?? null;
        setError({
          message: api?.message ?? "这次没能读取知识数据，请稍后重试。",
          requestId: api?.requestId ?? null,
          status,
        });
        if (status === 401) setPhase("login");
        else if (status === 403) setPhase("denied");
        else if (status === 404) setPhase("unavailable");
        else setPhase("error");
      });
    return () => {
      live = false;
    };
  }, [tab, nonce, forced]);

  const reload = () => setNonce((n) => n + 1);
  const source = TAB_SOURCE[tab];
  const stampText = payload.stamp ?? "时间未知";

  return (
    <div className="knw4-page" data-testid="knw4-page" data-fixture={forced ? "1" : undefined}>
      <header className="knw4-head">
        <div className="knw4-title">
          <BookOpen className="h-5 w-5" aria-hidden />
          <h1>知识空间</h1>
          <span>空间、文档与检索 · 只读</span>
        </div>
        <Button size="sm" outlined onClick={reload} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
          刷新
        </Button>
      </header>

      <div className="knw4-seg" role="tablist" aria-label="知识分组">
        {TAB_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            data-testid={`knw4-tab-${key}`}
            onClick={() => selectTab(key)}
          >
            {TAB_LABEL[key]}
          </button>
        ))}
      </div>

      {forced ? <p className="knw4-preview">预览状态：{forced}；本页不会发请求。</p> : null}

      <p className="knw4-source" data-testid={ENDPOINTS[tab].testid}>
        来源：{source} · 数据截至 {stampText}
        {payload.stampReason ? <Reason>{payload.stampReason}</Reason> : null}
      </p>

      <Card>
        <CardContent
          className="knw4-body"
          data-testid="knw4-panel"
          data-tab={tab}
          data-len={tab === "evidence" ? payload.citations.length : payload.rows.length}
        >
          {forced === "loading" ? (
            <Skeleton testid="knw4-loading" />
          ) : forced === "empty" ? (
            <div className="knw4-empty" data-testid="knw4-empty">
              <p>{EMPTY_TEXT[tab]}</p>
              <Link className="knw4-link" to="/knowledge?tab=evidence">
                先看证据与引用
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : forced === "denied" ? (
            <div className="knw4-empty" data-testid="knw4-denied" role="status">
              <b>无权访问</b>
              <span>你没有查看这块知识数据的权限，或该模块尚未开放。</span>
            </div>
          ) : forced === "error" ? (
            <div className="knw4-error" data-testid="knw4-error" role="alert">
              <b>这次没能读取知识数据</b>
              <span>预览状态没有发出请求；真实错误会带上可复制的请求编号。</span>
            </div>
          ) : phase === "loading" ? (
            <Skeleton testid="knw4-loading" />
          ) : phase === "unavailable" ? (
            <div className="knw4-gap" data-testid="knw4-gap" title={KNOWLEDGE_GAP}>
              <b>未接入</b>
              <span>{GAP03_HUMAN}</span>
              {error?.message ? <span>{error.message}</span> : null}
              <Link className="knw4-link" to="/approvals" data-testid="knw4-apply">
                去审批中心提交开通申请
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : phase === "denied" ? (
            <div className="knw4-empty" data-testid="knw4-denied" role="status">
              <b>无权访问</b>
              <span>你没有查看这块知识数据的权限。</span>
              <RequestId id={error?.requestId ?? null} />
            </div>
          ) : phase === "login" ? (
            <div className="knw4-empty" data-testid="knw4-login" role="status">
              <b>需要登录</b>
              <span>登录状态已经失效，请重新登录后再看知识数据。</span>
            </div>
          ) : phase === "error" ? (
            <div className="knw4-error" data-testid="knw4-error" role="alert">
              <b>这次没能读取知识数据</b>
              <span>{error?.message ?? "请稍后重试。"}</span>
              <RequestId id={error?.requestId ?? null} />
              <Button size="sm" outlined onClick={reload} data-testid="knw4-retry">
                重试
              </Button>
            </div>
          ) : phase === "empty" ? (
            <div className="knw4-empty" data-testid="knw4-empty">
              <p>{EMPTY_TEXT[tab]}</p>
              {tab === "spaces" ? (
                <Link className="knw4-link" to="/knowledge?tab=ingest">
                  查看数据接入
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          ) : tab === "evidence" ? (
            <CitationList rows={payload.citations} />
          ) : (
            <RowTable rows={payload.rows} testid="knw4-table" />
          )}
        </CardContent>
      </Card>

      {tab === "spaces" ? (
        <div className="knw4-kpis">
          <div className="knw4-kpi">
            <span><FileText className="h-4 w-4" /> 文档数</span>
            <b>—</b>
            <em>知识服务读侧未接入，不显示 0；接入后按空间真实条数展示。</em>
          </div>
          <div className="knw4-kpi">
            <span><Search className="h-4 w-4" /> 检索</span>
            <b>未接入</b>
            <em>没有可调用的检索接口，不展示样例命中。</em>
          </div>
        </div>
      ) : null}

      <p className="knw4-note">
        本页只读：数量、更新时间与状态都以真实接口为准；接口缺失时写「未接入」，
        不以 0 或样例冒充。证据与引用只展示上游给出的原文位置，打不开时直接说明原因。
      </p>
      <Link className="knw4-link" to="/knowledge?tab=evidence">
        看证据与引用
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}