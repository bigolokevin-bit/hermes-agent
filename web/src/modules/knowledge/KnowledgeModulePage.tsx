/**
 * `/knowledge` — 知识空间、数据接入、检索、证据与引用。
 *
 * The page is seven real reads: knowledge spaces, the designated data-source read
 * answered as 接入任务, document登记, the knowledge search read, the retrieval audit
 * records, the knowledge citation read, and the citations that recent console
 * sessions carry. Each makes ONE request and renders the answer it got. There is no
 * sample row, no invented count, and no `?state=` repro standing behind a
 * `data-fixture` badge: the four states come from the service, and a 403 and a 404
 * draw the same body on purpose. Technical values (raw ids, the GAP number, the full
 * 摘要) live in `title` attributes, never on screen.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, BookOpen, Copy, RefreshCw, Search } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { Input } from "@nous-research/ui/ui/components/input";

import { fetchJsonStrict } from "@/modules/models/fetchJson";
import { copyTextToClipboard } from "@/lib/clipboard";
import { ApiError } from "@/lib/api-error";
import {
  CITATIONS_URL,
  DOCUMENTS_URL,
  KNOWLEDGE_GAP,
  RECORDS_URL,
  SESSIONS_URL,
  SPACES_URL,
  SURFACE_SOURCE,
  TAB_LABEL,
  TAB_ORDER,
  TASKS_URL,
  UNWIRED_HUMAN,
  citationsFromDetail,
  initialTab,
  readCitations,
  readRecords,
  readRows,
  readSearch,
  readSessions,
  readTasks,
  searchUrl,
  sessionCitations,
  type CitationRow,
  type IngestTaskRow,
  type KnowledgeRow,
  type KnowledgeTab,
  type RetrievalRow,
  type SessionSummary,
  type SurfaceKey,
  type SurfaceValue,
} from "./knowledge";
import "./knowledge.css";

const SESSION_SCAN_LIMIT = 10;

type Surf<T> =
  | { kind: "loading" }
  | { kind: "ready"; value: SurfaceValue<T> }
  | { kind: "unwired"; requestId: string | null }
  | { kind: "login" }
  | { kind: "error"; message: string; requestId: string | null };

const GENERIC_FAILURE = "这次没能读到知识数据，请稍后重试。";

/** 401 is its own body; 403 and 404 share one; everything else is a failure. */
function toSurf(cause: unknown): Surf<never> {
  const api = cause instanceof ApiError ? cause : null;
  const status = api?.status ?? null;
  if (status === 401) return { kind: "login" };
  if (status === 403 || status === 404) return { kind: "unwired", requestId: api?.requestId ?? null };
  const message = api?.message?.trim();
  // A message the service wrote for people is safe to show; anything else is not.
  return { kind: "error", message: message && !/\d{3}/.test(message) ? message : GENERIC_FAILURE, requestId: api?.requestId ?? null };
}

/**
 * One surface = one real request. Nothing is written into state from the effect
 * body: the settled answer is tagged with the read it came from, so any other
 * read (a keyword change, a retry, a refresh) shows the skeleton until its own
 * answer arrives.
 */
function useSurface<T>(load: () => Promise<SurfaceValue<T>>, key: string) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ stamp: string; state: Surf<T> } | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  const stamp = `${key}|${attempt}`;
  useEffect(() => {
    let live = true;
    loadRef.current().then(
      (value) => {
        if (live) setSettled({ stamp, state: { kind: "ready", value } });
      },
      (cause: unknown) => {
        if (live) setSettled({ stamp, state: toSurf(cause) });
      },
    );
    return () => {
      live = false;
    };
  }, [stamp]);
  const state: Surf<T> = settled?.stamp === stamp ? settled.state : { kind: "loading" };
  return { state, retry: () => setAttempt((value) => value + 1) };
}

function Reason({ children }: { children: string | null }): ReactNode {
  if (!children) return null;
  return (
    <span className="knw5-reason" data-testid="knw5-reason">
      {children}
    </span>
  );
}

function Skeleton({ testid }: { testid: string }): ReactNode {
  return (
    <div className="knw5-skeleton" data-testid={testid} aria-busy="true" aria-label="加载中">
      <span />
      <span />
      <span />
    </div>
  );
}

function RequestId({ id, testid }: { id: string | null; testid: string }): ReactNode {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  if (!id) {
    return (
      <span className="knw5-req" data-testid={testid} title="上游回答没有带请求编号">
        本次回答没有带请求编号
      </span>
    );
  }
  return (
    <span className="knw5-req" data-testid={testid}>
      <span>请求编号：</span>
      <span className="knw5-req-value" title={id}>
        {id}
      </span>
      <button
        type="button"
        className="knw5-copy"
        aria-label="复制请求编号"
        onClick={() => {
          void copyTextToClipboard(id).then((ok) => {
            setCopied(ok ? "done" : "failed");
            window.setTimeout(() => setCopied("idle"), 1800);
          });
        }}
      >
        <Copy className="h-3 w-3" aria-hidden />
        {copied === "done" ? "已复制" : copied === "failed" ? "复制失败，请手动选取" : "复制"}
      </button>
    </span>
  );
}

function ApplyLink({ testid }: { testid: string }): ReactNode {
  return (
    <Link className="knw5-link" to="/approvals" data-testid={testid}>
      去审批中心提交开通申请
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}

interface SurfaceProps<T> {
  testid: string;
  source: SurfaceKey;
  state: Surf<T>;
  onRetry: () => void;
  empty: (value: SurfaceValue<T>) => ReactNode;
  render: (value: SurfaceValue<T>) => ReactNode;
}

/** The four states, once, for every surface on the page. */
function Surface<T>({ testid, source, state, onRetry, empty, render }: SurfaceProps<T>): ReactNode {
  const value = state.kind === "ready" ? state.value : null;
  const stamp = value?.stamp ?? null;
  // A read that DID give a collection time says nothing else about time: the reason
  // line only appears when the time is genuinely missing.
  const stampReason = value
    ? value.stamp
      ? null
      : value.stampReason ?? "上游响应没有给出可用时间，数据截至时间未知。"
    : state.kind === "loading"
      ? "正在读取，数据截至时间未知。"
      : state.kind === "unwired"
        ? "这块数据没有读到，数据截至时间未知。"
        : "这次没有读到数据，数据截至时间未知。";

  return (
    <section
      className="knw5-surface"
      data-testid={testid}
      data-state={state.kind}
      data-len={value ? value.rows.length : 0}
    >
      <p className="knw5-source" data-testid={`${testid}-source`}>
        来源：{SURFACE_SOURCE[source]} · 数据截至 {stamp ?? "未知"}
        <Reason>{stampReason}</Reason>
      </p>

      {state.kind === "loading" ? <Skeleton testid={`${testid}-loading`} /> : null}

      {state.kind === "unwired" ? (
        <div className="knw5-unwired" data-testid={`${testid}-unwired`} role="status" title={KNOWLEDGE_GAP}>
          <b>未接入</b>
          <span className="knw5-wrap">{UNWIRED_HUMAN}</span>
          <RequestId id={state.requestId} testid={`${testid}-request-id`} />
          <span className="knw5-actions">
            <Button size="sm" outlined onClick={onRetry} data-testid={`${testid}-retry`}>
              重试
            </Button>
            <ApplyLink testid={`${testid}-apply`} />
          </span>
        </div>
      ) : null}

      {state.kind === "login" ? (
        <div className="knw5-empty" data-testid={`${testid}-login`} role="status">
          <b>需要登录</b>
          <span className="knw5-wrap">登录状态已经失效，重新登录后就能再看这块知识数据。</span>
          <Button size="sm" outlined onClick={onRetry} data-testid={`${testid}-retry`}>
            重试
          </Button>
        </div>
      ) : null}

      {state.kind === "error" ? (
        <div className="knw5-error" data-testid={`${testid}-error`} role="alert">
          <b>这次没能读到知识数据</b>
          <span className="knw5-wrap">{state.message}</span>
          <RequestId id={state.requestId} testid={`${testid}-request-id`} />
          <Button size="sm" outlined onClick={onRetry} data-testid={`${testid}-retry`}>
            重试
          </Button>
        </div>
      ) : null}

      {value && value.rows.length === 0 ? (
        <div className="knw5-empty" data-testid={`${testid}-empty`} role="status">
          {empty(value)}
        </div>
      ) : null}

      {value && value.rows.length > 0 ? render(value) : null}
    </section>
  );
}

function RowTable({ rows, testid }: { rows: KnowledgeRow[]; testid: string }): ReactNode {
  return (
    <div className="knw5-scroll">
      <table className="knw5-table" data-testid={testid}>
        <thead>
          <tr>
            <th scope="col">名称</th>
            <th scope="col">类型</th>
            <th scope="col">规模</th>
            <th scope="col">更新时间</th>
            <th scope="col">状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || `row-${index}`} data-testid={`${testid}-row`} title={row.id || undefined}>
              <td data-label="名称">
                <span className="knw5-name">{row.name}</span>
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

/** Search hits and citations share one list: title, 摘要, 来源, 时间, 原文. */
function RefList({ rows, testid }: { rows: CitationRow[]; testid: string }): ReactNode {
  return (
    <ul className="knw5-refs" data-testid={testid}>
      {rows.map((row, index) => (
        <li key={row.id || `ref-${index}`} className="knw5-ref" data-testid={`${testid}-row`}>
          <div className="knw5-ref-main">
            <div className="knw5-ref-title">
              <Badge tone="outline">{row.kind}</Badge>
              <span title={row.id || undefined}>{row.title}</span>
              <Reason>{row.titleReason}</Reason>
            </div>
            <p className="knw5-ref-summary" data-testid={`${testid}-summary`} title={row.summary ?? undefined}>
              {row.summary ?? "—"}
              <Reason>{row.summaryReason}</Reason>
            </p>
            <div className="knw5-ref-meta">
              <span data-testid={`${testid}-source-name`} title={row.sourceRaw ?? undefined}>
                来源：{row.source}
              </span>
              <Reason>{row.sourceReason}</Reason>
              <span title={row.employeeRaw ?? undefined}>留下：{row.employee}</span>
              <Reason>{row.employeeReason}</Reason>
              <span>时间：{row.at}</span>
              <Reason>{row.atReason}</Reason>
            </div>
          </div>
          {row.href ? (
            <Link className="knw5-link" to={row.href} data-testid={`${testid}-open`}>
              打开原文
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : (
            <span className="knw5-unreachable" data-testid={`${testid}-unreachable`}>
              <b>原文不可达</b>
              <span>{row.unreachable}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function RecordsTable({ rows }: { rows: RetrievalRow[] }): ReactNode {
  return (
    <div className="knw5-scroll">
      <table className="knw5-table" data-testid="knw5-records-table">
        <thead>
          <tr>
            <th scope="col">执行者</th>
            <th scope="col">判定</th>
            <th scope="col">结果</th>
            <th scope="col">检索对象</th>
            <th scope="col">时间</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || `record-${index}`} data-testid="knw5-records-row" title={row.id || undefined}>
              <td data-label="执行者" title={row.actorRaw ?? undefined}>
                {row.actor}
              </td>
              <td data-label="判定" title={row.decisionRaw ?? undefined}>
                {row.decision}
              </td>
              <td data-label="结果" title={row.outcomeRaw ?? undefined}>
                {row.outcome}
              </td>
              <td data-label="检索对象" title={row.targetRaw ?? undefined}>
                {row.href ? (
                  <Link className="knw5-link" to={row.href} data-testid="knw5-records-open">
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

function SpacesSurface({ nonce }: { nonce: string }): ReactNode {
  const surface = useSurface<KnowledgeRow>(
    () => fetchJsonStrict(SPACES_URL).then((body) => readRows(body, "spaces")),
    `spaces|${nonce}`,
  );
  return (
    <Surface
      testid="knw5-spaces"
      source="spaces"
      state={surface.state}
      onRetry={surface.retry}
      empty={() => <p>当前没有读到知识空间。接口已响应，但列表为空；这不等于「没有空间」。</p>}
      render={(value) => <RowTable rows={value.rows} testid="knw5-spaces-table" />}
    />
  );
}

function IngestSurface({ nonce }: { nonce: string }): ReactNode {
  const surface = useSurface<KnowledgeRow>(
    () => fetchJsonStrict(DOCUMENTS_URL).then((body) => readRows(body, "ingest")),
    `documents|${nonce}`,
  );
  return (
    <Surface
      testid="knw5-ingest"
      source="documents"
      state={surface.state}
      onRetry={surface.retry}
      empty={() => <p>当前没有读到文档登记。接口已响应，但列表为空；不显示 0 篇。</p>}
      render={(value) => <RowTable rows={value.rows} testid="knw5-ingest-table" />}
    />
  );
}

/** What the data-source reads answer as 接入任务, in the operator's own words. */
function TaskTable({ rows }: { rows: IngestTaskRow[] }): ReactNode {
  return (
    <div className="knw5-scroll">
      <table className="knw5-table" data-testid="knw5-ingest-tasks-table">
        <thead>
          <tr>
            <th scope="col">数据源</th>
            <th scope="col">状态</th>
            <th scope="col">进度与数量</th>
            <th scope="col">时间</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || `task-${index}`} data-testid="knw5-ingest-tasks-row" title={row.id || undefined}>
              <td data-label="数据源">
                <span className="knw5-name">{row.name}</span>
                <Reason>{row.nameReason}</Reason>
                <span className="knw5-sub" title={row.kindRaw ?? undefined}>
                  {row.kind}
                </span>
                <Reason>{row.kindReason}</Reason>
              </td>
              <td data-label="状态">
                <Badge
                  tone={row.status === "成功" ? "success" : row.status === "失败" ? "destructive" : "outline"}
                >
                  {row.status}
                </Badge>
                <Reason>{row.statusReason}</Reason>
              </td>
              <td data-label="进度与数量">
                <span>{row.progress}</span>
                {row.issue ? <span className="knw5-sub">{row.issue}</span> : null}
                <Reason>{row.progressReason}</Reason>
              </td>
              <td data-label="时间">
                <span>{row.timeLabel ? `${row.timeLabel}：${row.at}` : row.at}</span>
                <Reason>{row.atReason}</Reason>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IngestTasksSurface({ nonce }: { nonce: string }): ReactNode {
  const surface = useSurface<IngestTaskRow>(
    () => fetchJsonStrict(TASKS_URL).then(readTasks),
    `tasks|${nonce}`,
  );
  return (
    <Surface
      testid="knw5-ingest-tasks"
      source="tasks"
      state={surface.state}
      onRetry={surface.retry}
      empty={() => <p>接口已响应，但没有给出接入任务；这不等于没有数据源在接入，也不显示 0 个任务。</p>}
      render={(value) => <TaskTable rows={value.rows} />}
    />
  );
}

interface SearchSurfaceProps {
  nonce: string;
  query: string;
  onSearch: (query: string) => void;
}

/** The real search read: a keyword in, the service's own hits out. */
function SearchSurface({ nonce, query, onSearch }: SearchSurfaceProps): ReactNode {
  // The typed text is local; the URL keyword wins whenever it changes (back,
  // forward, refresh, another panel switching in), with no effect to sync it.
  const [draft, setDraft] = useState<{ from: string; text: string }>({ from: query, text: query });
  const text = draft.from === query ? draft.text : query;
  const surface = useSurface<CitationRow>(
    () => fetchJsonStrict(searchUrl(query)).then(readSearch),
    `search|${nonce}|${query}`,
  );
  return (
    <>
      <form
        className="knw5-form"
        data-testid="knw5-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(text);
        }}
      >
        <label className="knw5-field">
          <span className="knw5-sr-only">检索关键词</span>
          <Input
            value={text}
            onChange={(event) => setDraft({ from: query, text: event.target.value })}
            placeholder="输入关键词检索知识库"
            data-testid="knw5-search-input"
          />
        </label>
        <Button
          size="sm"
          type="submit"
          prefix={<Search className="h-3.5 w-3.5" aria-hidden />}
          data-testid="knw5-search-submit"
        >
          检索
        </Button>
      </form>
      <p className="knw5-hint" data-testid="knw5-search-hint">
        {query.trim() === ""
          ? "没有输入关键词：这里读的是检索口当前能给的结果。"
          : `关键词「${query.trim()}」：只列检索口给出的结果，不补写摘要，也不自行排序。`}
      </p>
      <Surface
        testid="knw5-search"
        source="search"
        state={surface.state}
        onRetry={surface.retry}
        empty={() => (
          <p>
            {query.trim() === ""
              ? "接口已响应，但没有给出结果；这不等于知识库是空的。"
              : `关键词「${query.trim()}」没有命中；接口已响应，不展示样例结果。`}
          </p>
        )}
        render={(value) => <RefList rows={value.rows} testid="knw5-search-results" />}
      />
    </>
  );
}

function RecordsSurface({ nonce }: { nonce: string }): ReactNode {
  const surface = useSurface<RetrievalRow>(
    () => fetchJsonStrict(RECORDS_URL).then(readRecords),
    `records|${nonce}`,
  );
  return (
    <Surface
      testid="knw5-records"
      source="records"
      state={surface.state}
      onRetry={surface.retry}
      empty={() => <p>接口已响应，检索审计为空；不显示 0 次命中，也不展示样例。</p>}
      render={(value) => <RecordsTable rows={value.rows} />}
    />
  );
}

function CitationsSurface({ nonce }: { nonce: string }): ReactNode {
  const surface = useSurface<CitationRow>(
    () => fetchJsonStrict(CITATIONS_URL).then(readCitations),
    `citations|${nonce}`,
  );
  return (
    <Surface
      testid="knw5-citations"
      source="citations"
      state={surface.state}
      onRetry={surface.retry}
      empty={() => <p>接口已响应，引用登记为空；不展示样例引用。</p>}
      render={(value) => <RefList rows={value.rows} testid="knw5-citations-list" />}
    />
  );
}

/**
 * Citations left inside recent sessions. This surface reads sessions first and then
 * each session body: a session list without a single readable body is a failure, not
 * an empty answer.
 */
function SessionCitationsSurface({ nonce }: { nonce: string }): ReactNode {
  const surface = useSurface<CitationRow>(async () => {
    const sessions = readSessions(await fetchJsonStrict(SESSIONS_URL));
    const targets = sessions.filter((row) => row.messageCount > 0).slice(0, SESSION_SCAN_LIMIT);
    if (targets.length === 0) return sessionCitations(sessions, []);
    const settled = await Promise.allSettled(
      targets.map((row: SessionSummary) =>
        fetchJsonStrict(`/agent-api/api/console-sessions/${encodeURIComponent(row.sessionId)}`),
      ),
    );
    const details = settled
      .filter((item): item is PromiseFulfilledResult<unknown> => item.status === "fulfilled")
      .map((item) => item.value);
    if (details.length === 0) {
      const first = settled.find((item): item is PromiseRejectedResult => item.status === "rejected");
      throw first?.reason;
    }
    return sessionCitations(
      sessions,
      details.flatMap((body, index) => citationsFromDetail(body, targets[index])),
    );
  }, `session-cites|${nonce}`);

  return (
    <Surface
      testid="knw5-session-cites"
      source="session-cites"
      state={surface.state}
      onRetry={surface.retry}
      empty={(value) => (
        <p>
          {value.scanned !== null && value.scanned > 0
            ? `已读取最近 ${value.scanned} 个会话，没有引用记录；不展示样例。`
            : "当前没有读到会话引用记录；不展示样例。"}
        </p>
      )}
      render={(value) => <RefList rows={value.rows} testid="knw5-session-cites-list" />}
    />
  );
}

export default function KnowledgeModulePage() {
  const [sp, setSp] = useSearchParams();
  const tab = initialTab(sp.get("tab"), sp.get("panel"));
  const query = sp.get("q") ?? "";
  const [nonce, setNonce] = useState("0");

  const selectTab = (key: KnowledgeTab) => {
    const next = new URLSearchParams(sp);
    // Keep `tab` on a shell-known value so the module stays mounted; `panel` carries
    // the internal panel, which is what refresh and back/forward must restore.
    if (!next.get("tab")) next.set("tab", "spaces");
    next.set("panel", key);
    setSp(next);
  };

  const commitQuery = (next: string) => {
    const params = new URLSearchParams(sp);
    const trimmed = next.trim();
    if (trimmed === "") params.delete("q");
    else params.set("q", trimmed);
    if (!params.get("tab")) params.set("tab", "spaces");
    params.set("panel", "retrieval");
    setSp(params);
  };

  const refresh = () => setNonce((value) => String(Number(value) + 1));

  return (
    <div className="knw5-page" data-testid="knw5-page">
      <header className="knw5-head">
        <div className="knw5-title">
          <BookOpen className="h-5 w-5" aria-hidden />
          <h1>知识空间</h1>
          <span>空间、文档、检索与引用 · 只读</span>
        </div>
        <Button size="sm" outlined onClick={refresh} prefix={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}>
          刷新
        </Button>
      </header>

      <div className="knw5-seg" role="tablist" aria-label="知识分组">
        {TAB_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            data-testid={`knw5-tab-${key}`}
            onClick={() => selectTab(key)}
          >
            {TAB_LABEL[key]}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="knw5-body" data-testid="knw5-panel" data-tab={tab}>
          <div data-testid={`knw5-panel-${tab}`}>
            {tab === "spaces" ? <SpacesSurface nonce={nonce} /> : null}
            {tab === "ingest" ? (
              <>
                <IngestTasksSurface nonce={nonce} />
                <IngestSurface nonce={nonce} />
              </>
            ) : null}
            {tab === "retrieval" ? (
              <>
                <SearchSurface nonce={nonce} query={query} onSearch={commitQuery} />
                <RecordsSurface nonce={nonce} />
              </>
            ) : null}
            {tab === "evidence" ? (
              <>
                <CitationsSurface nonce={nonce} />
                <SessionCitationsSurface nonce={nonce} />
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <p className="knw5-note">
        本页只读：数量、更新时间与状态都以真实接口为准；读不到时写「未接入」并说明原因，不以 0 或样例冒充。
        检索与引用只展示上游给出的原文位置，打不开时直接说明原因。
      </p>
      <Link className="knw5-link" to="/knowledge?tab=spaces&panel=evidence" data-testid="knw5-goto-evidence">
        看证据与引用
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}
