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
  beijing,
  citationsFromDetail,
  initialTab,
  isForcedState,
  readKnowledge,
  readSessions,
  type CitationRow,
  type KnowledgePayload,
  type KnowledgePhase,
  type KnowledgeRow,
  type KnowledgeTab,
  type RetrievalRow,
} from "./knowledge";
import "./knowledge.css";

type ErrorView = { message: string; requestId: string | null; status: number | null };

const TAB_ORDER: KnowledgeTab[] = ["spaces", "ingest", "retrieval", "evidence"];

const EMPTY_TEXT: Record<KnowledgeTab, string> = {
  spaces: "当前没有读到知识空间。接口已响应，但列表为空；这不等于「没有空间」。",
  ingest: "当前没有读到文档登记。接口已响应，但列表为空；不显示 0 篇。",
  retrieval: "接口已响应，检索审计为空；不显示 0 次命中，也不展示样例。",
  evidence: "当前没有读到会话引用记录；不展示样例。",
};

const SESSION_SCAN_LIMIT = 10;

function sessionsPayload(sessions: Awaited<ReturnType<typeof readSessions>>, citations: CitationRow[]): KnowledgePayload {
  const times = [
    ...citations.map((row) => row.atRaw).filter((value): value is string => Boolean(value)),
    ...sessions.map((row) => row.updatedAt).filter((value): value is string => Boolean(value)),
  ].sort();
  const latest = times.length > 0 ? times[times.length - 1] : null;
  const stamp = latest ? beijing(latest) : null;
  return {
    rows: [],
    citations,
    retrieval: [],
    stamp,
    stampReason: stamp ? null : "接口已响应，但没有可用的采集时间；数据截至时间未知。",
    scannedSessions: sessions.length,
  };
}

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
              <Reason>{row.titleReason}</Reason>
            </div>
            <div className="knw4-citation-meta">
              <span title={row.employeeRaw || undefined}>{row.employee}</span>
              <span>{row.at}</span>
              <Reason>{row.atReason}</Reason>
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

function RetrievalTable({ rows }: { rows: RetrievalRow[] }) {
  return (
    <div className="knw4-scroll">
      <table className="knw4-table" data-testid="knw4-retrieval-table">
        <thead>
          <tr>
            <th>执行者</th>
            <th>判定</th>
            <th>结果</th>
            <th>检索对象</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || `retrieval-${index}`} data-testid="knw4-retrieval-row" title={row.id || undefined}>
              <td data-label="执行者" title={row.actorRaw || undefined}>{row.actor}</td>
              <td data-label="判定" title={row.decisionRaw || undefined}>{row.decision}</td>
              <td data-label="结果" title={row.outcomeRaw || undefined}>{row.outcome}</td>
              <td data-label="检索对象" title={row.targetRaw || undefined}>
                {row.href ? (
                  <Link className="knw4-link" to={row.href} data-testid="knw4-retrieval-open">
                    {row.target}
                  </Link>
                ) : (
                  row.target
                )}
              </td>
              <td data-label="时间">
                <span>{row.at}</span>
                <Reason>{row.atReason}</Reason>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function KnowledgeModulePage() {
  const [sp, setSp] = useSearchParams();
  const forcedRaw = (sp.get("state") ?? "").toLowerCase();
  const forced = isForcedState(forcedRaw) ? forcedRaw : null;
  // The URL is the single source of truth: refresh, back/forward and direct
  // links all resolve to the same internal panel without a stale state copy.
  const tab = initialTab(sp.get("tab"), sp.get("panel"));
  const [phase, setPhase] = useState<KnowledgePhase>("loading");
  const [payload, setPayload] = useState(() => readKnowledge("spaces", null));
  const [error, setError] = useState<ErrorView | null>(null);
  const [nonce, setNonce] = useState(0);

  const selectTab = (key: KnowledgeTab) => {
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
    const load = async (): Promise<KnowledgePayload> => {
      if (tab !== "evidence") {
        return readKnowledge(tab, await fetchJsonStrict(ENDPOINTS[tab].url));
      }
      const sessions = readSessions(await fetchJsonStrict(ENDPOINTS.evidence.url));
      const targets = sessions.filter((row) => row.messageCount > 0).slice(0, SESSION_SCAN_LIMIT);
      const settled = await Promise.allSettled(
        targets.map((row) =>
          fetchJsonStrict(`/agent-api/api/console-sessions/${encodeURIComponent(row.sessionId)}`),
        ),
      );
      const details = settled
        .filter((item): item is PromiseFulfilledResult<unknown> => item.status === "fulfilled")
        .map((item) => item.value);
      if (targets.length > 0 && details.length === 0) {
        const first = settled.find((item): item is PromiseRejectedResult => item.status === "rejected");
        throw first?.reason;
      }
      const citations = details.flatMap((body, index) => citationsFromDetail(body, targets[index]));
      return sessionsPayload(sessions, citations);
    };
    load()
      .then((next) => {
        if (!live) return;
        setPayload(next);
        const count =
          tab === "evidence"
            ? next.citations.length
            : tab === "retrieval"
              ? next.retrieval.length
              : next.rows.length;
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
    <div className="knw4-page" data-testid="knw4-page">
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
          data-len={
            tab === "evidence"
              ? payload.citations.length
              : tab === "retrieval"
                ? payload.retrieval.length
                : payload.rows.length
          }
        >
          <div data-testid={`knw4-panel-${tab}`}>
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
              <p>
                {tab === "evidence" && payload.scannedSessions !== null && payload.scannedSessions > 0
                  ? `已读取最近 ${payload.scannedSessions} 个会话，没有引用记录；不展示样例。`
                  : EMPTY_TEXT[tab]}
              </p>
              {tab === "spaces" ? (
                <Link className="knw4-link" to="/knowledge?tab=ingest">
                  查看数据接入
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          ) : tab === "evidence" ? (
            <CitationList rows={payload.citations} />
          ) : tab === "retrieval" ? (
            <RetrievalTable rows={payload.retrieval} />
          ) : (
            <RowTable rows={payload.rows} testid="knw4-table" />
          )}
          </div>
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