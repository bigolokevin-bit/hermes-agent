/**
 * `/knowledge` — 知识空间、数据接入、检索、证据与引用。
 *
 * The page is seven real reads: knowledge spaces, the designated data-source read
 * answered as 接入任务, document登记, the knowledge search read, the retrieval audit
 * records, the knowledge citation read, and the citations that recent console
 * sessions carry. Each makes ONE request and renders the answer it got. There is no
 * sample row, no invented count, and no forced fixture badge: the four states
 * come from the service, and a 403 and a 404
 * draw the same body on purpose. Technical values (raw ids, the GAP number, the full
 * 摘要) live in `title` attributes, never on screen.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
  DOCUMENTS_UNWIRED_HEAD,
  DOCUMENTS_UNWIRED_HUMAN,
  SEARCH_UNWIRED_HEAD,
  SEARCH_UNWIRED_HUMAN,
  SPACES_UNWIRED_HEAD,
  SPACES_UNWIRED_HUMAN,
  TASKS_UNWIRED_HEAD,
  TASKS_UNWIRED_HUMAN,
  SPACES_URL,
  SURFACE_SOURCE,
  TAB_LABEL,
  TAB_ORDER,
  TASKS_URL,
  UNWIRED_HUMAN,
  citationsFromDetail,
  INGEST_STATUS_UNWIRED_HEAD,
  INGEST_STATUS_UNWIRED_HUMAN,
  INGEST_STATUS_URL,
  initialTab,
  readCitations,
  readRecords,
  readRows,
  readSearch,
  readSessions,
  readSpaces,
  readTasks,
  searchUrl,
  sessionCitations,
  type CitationRow,
  type IngestTaskRow,
  type KnowledgeRow,
  type KnowledgeTab,
  type RetrievalRow,
  type SessionSummary,
  type SpaceRow,
  type SurfaceKey,
  type SurfaceValue,
} from "./knowledge";
import "./knowledge.css";

const SESSION_SCAN_LIMIT = 10;

/**
 * Which citation row is drilled open. The URL carries it (`ref=`), exactly like the
 * panel does, so refresh, back/forward and a pasted link all reopen the same row —
 * and nothing about the open row lives in a second copy of state.
 */
interface DrillState {
  open: string;
  toggle: (key: string) => void;
}

const RefDrill = createContext<DrillState>({ open: "", toggle: () => {} });

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
  /** 未接入正文的说法；每个面点名自己的读口，403 与 404 仍共用同一份。 */
  unwiredHead?: string;
  unwiredHuman?: string;
}

/** The four states, once, for every surface on the page. */
function Surface<T>({
  testid,
  source,
  state,
  onRetry,
  empty,
  render,
  unwiredHead = "未接入",
  unwiredHuman = UNWIRED_HUMAN,
}: SurfaceProps<T>): ReactNode {
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
          <b>{unwiredHead}</b>
          <span className="knw5-wrap">{unwiredHuman}</span>
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

/** Search hits and citations share one list, and one drilldown per row. */
function RefList({ rows, testid }: { rows: CitationRow[]; testid: string }): ReactNode {
  const drill = useContext(RefDrill);
  return (
    <ul className="knw5-refs" data-testid={testid}>
      {rows.map((row, index) => {
        const key = row.id !== "" ? row.id : `${testid}-${index}`;
        const isOpen = drill.open !== "" && drill.open === key;
        return (
          <li
            key={key}
            className="knw5-ref"
            data-testid={`${testid}-row`}
            data-open={isOpen ? "1" : "0"}
          >
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
                <span data-testid={`${testid}-target`} title={row.targetRaw ?? undefined}>
                  指向：{row.target}
                </span>
                <Reason>{row.targetReason}</Reason>
                <span title={row.employeeRaw ?? undefined}>留下：{row.employee}</span>
                <Reason>{row.employeeReason}</Reason>
                <span>时间：{row.at}</span>
                <Reason>{row.atReason}</Reason>
                {row.locator ? <span className="knw5-sub">{row.locator}</span> : null}
              </div>
            </div>
            <div className="knw5-ref-side">
              <button
                type="button"
                className="knw5-drill"
                aria-expanded={isOpen}
                data-testid={`${testid}-drill`}
                onClick={() => drill.toggle(key)}
              >
                {isOpen ? "收起原文" : "看原文与摘要"}
              </button>
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
            </div>
            {isOpen ? (
              <dl className="knw5-ref-detail" data-testid={`${testid}-detail`} title={row.id || undefined}>
                <div>
                  <dt>引用的是</dt>
                  <dd data-testid={`${testid}-detail-title`}>
                    {row.title}
                    <Reason>{row.titleReason}</Reason>
                  </dd>
                </div>
                <div>
                  <dt>原文位置</dt>
                  <dd>
                    {row.href ? (
                      <Link className="knw5-link" to={row.href} data-testid={`${testid}-detail-open`}>
                        打开原文
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    ) : (
                      <span data-testid={`${testid}-detail-unreachable`}>原文不可达 · {row.unreachable}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>在原文中的位置</dt>
                  <dd data-testid={`${testid}-detail-locator`}>
                    {row.locator ?? "—"}
                    <Reason>{row.locatorReason}</Reason>
                  </dd>
                </div>
                <div>
                  <dt>来源</dt>
                  <dd title={row.sourceRaw ?? undefined}>
                    {row.source}
                    <Reason>{row.sourceReason}</Reason>
                  </dd>
                </div>
                <div>
                  <dt>指向的对象</dt>
                  <dd data-testid={`${testid}-detail-target`} title={row.targetRaw ?? undefined}>
                    {row.target}
                    <Reason>{row.targetReason}</Reason>
                  </dd>
                </div>
                <div>
                  <dt>这段引用从哪里来</dt>
                  <dd data-testid={`${testid}-detail-origin`} title={row.originRaw ?? undefined}>
                    {row.origin ? (
                      <>
                        {row.originHref ? (
                          <Link className="knw5-link" to={row.originHref} data-testid={`${testid}-detail-origin-link`}>
                            {row.origin}
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        ) : (
                          row.origin
                        )}
                      </>
                    ) : (
                      <>
                        —<Reason>{row.originReason}</Reason>
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>被引用的原话</dt>
                  <dd data-testid={`${testid}-detail-quote`}>
                    {row.quote ?? "—"}
                    <Reason>{row.quoteReason}</Reason>
                  </dd>
                </div>
                <div>
                  <dt>摘要</dt>
                  <dd data-testid={`${testid}-detail-summary`}>
                    {row.summary ?? "—"}
                    <Reason>{row.summaryReason}</Reason>
                  </dd>
                </div>
                <div>
                  <dt>留下这段引用</dt>
                  <dd title={row.employeeRaw ?? undefined}>
                    {row.employee}
                    <Reason>{row.employeeReason}</Reason>
                  </dd>
                </div>
                <div>
                  <dt>时间</dt>
                  <dd data-testid={`${testid}-detail-time`}>
                    {row.at}
                    <Reason>{row.atReason}</Reason>
                  </dd>
                </div>
              </dl>
            ) : null}
          </li>
        );
      })}
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

/** 一行一个知识空间：名称 / 来源 / 文档数 / 最近同步 / 状态。 */
function SpaceTable({ rows }: { rows: SpaceRow[] }): ReactNode {
  return (
    <div className="knw5-scroll">
      <table className="knw5-table" data-testid="knw5-spaces-table">
        <thead>
          <tr>
            <th scope="col">空间名称</th>
            <th scope="col">来源</th>
            <th scope="col">文档数</th>
            <th scope="col">最近同步</th>
            <th scope="col">状态</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || `space-${index}`} data-testid="knw5-spaces-row" title={row.id || undefined}>
              <td data-label="空间名称">
                <span className="knw5-name" data-testid="knw5-space-name">
                  {row.name}
                </span>
                <Reason>{row.nameReason}</Reason>
                {row.kind ? (
                  <span className="knw5-sub" data-testid="knw5-space-scope" title={row.kindRaw ?? undefined}>
                    {row.kind}
                  </span>
                ) : null}
              </td>
              <td data-label="来源">
                <span data-testid="knw5-space-source" title={row.sourceRaw ?? undefined}>
                  {row.source}
                </span>
                <Reason>{row.sourceReason}</Reason>
              </td>
              <td data-label="文档数">
                <span data-testid="knw5-space-docs">{row.docs}</span>
                {row.docsExtra ? <span className="knw5-sub" data-testid="knw5-space-docs-extra">{row.docsExtra}</span> : null}
                <Reason>{row.docsReason}</Reason>
              </td>
              <td data-label="最近同步">
                <span data-testid="knw5-space-time">
                  {row.timeLabel ? `${row.timeLabel}：${row.at}` : row.at}
                </span>
                <Reason>{row.atReason}</Reason>
              </td>
              <td data-label="状态">
                <span data-testid="knw5-space-status">
                  <Badge
                    tone={
                      row.status === "已同步" || row.status === "可用"
                        ? "success"
                        : row.status === "失败" || row.status === "部分可用"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {row.status}
                  </Badge>
                </span>
                <Reason>{row.statusReason}</Reason>
                {row.failure ? (
                  <span className="knw5-sub" data-testid="knw5-space-failure" title={row.failureRaw ?? undefined}>
                    {row.failure}
                  </span>
                ) : null}
                {row.failure === null && row.failureRaw ? (
                  <span className="knw5-sub" data-testid="knw5-space-failure" title={row.failureRaw}>
                    上游记的原因偏技术，这里不原样上屏；悬停可看原文。
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpacesSurface({ nonce }: { nonce: string }): ReactNode {
  const surface = useSurface<SpaceRow>(
    () => fetchJsonStrict(SPACES_URL).then(readSpaces),
    `spaces|${nonce}`,
  );
  return (
    <Surface
      testid="knw5-spaces"
      source="spaces"
      state={surface.state}
      onRetry={surface.retry}
      unwiredHead={SPACES_UNWIRED_HEAD}
      unwiredHuman={SPACES_UNWIRED_HUMAN}
      empty={() => <p>当前没有读到知识空间。接口已响应，但列表为空；这不等于「没有空间」，也不写 0 个。</p>}
      render={(value) => <SpaceTable rows={value.rows} />}
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
      unwiredHead={DOCUMENTS_UNWIRED_HEAD}
      unwiredHuman={DOCUMENTS_UNWIRED_HUMAN}
      empty={() => <p>当前没有读到文档登记。接口已响应，但列表为空；不显示 0 篇。</p>}
      render={(value) => <RowTable rows={value.rows} testid="knw5-ingest-table" />}
    />
  );
}

/** What the data-source reads answer as 接入任务, in the operator's own words. */
function TaskTable({ rows, testid }: { rows: IngestTaskRow[]; testid: string }): ReactNode {
  return (
    <div className="knw5-scroll">
      <table className="knw5-table" data-testid={`${testid}-table`}>
        <thead>
          <tr>
            <th scope="col">来源名称</th>
            <th scope="col">类型</th>
            <th scope="col">最近同步</th>
            <th scope="col">状态</th>
            <th scope="col">条目数</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || `task-${index}`} data-testid={`${testid}-row`} title={row.id || undefined}>
              <td data-label="来源名称">
                <span className="knw5-name">{row.name}</span>
                <Reason>{row.nameReason}</Reason>
              </td>
              <td data-label="类型">
                <span title={row.kindRaw ?? undefined}>{row.kind}</span>
                <Reason>{row.kindReason}</Reason>
              </td>
              <td data-label="最近同步">
                <span data-testid={`${testid}-time`}>
                  {row.timeLabel ? `${row.timeLabel}：${row.at}` : row.at}
                </span>
                <Reason>{row.atReason}</Reason>
              </td>
              <td data-label="状态">
                <Badge
                  tone={
                    row.status === "已完成"
                      ? "success"
                      : row.status === "失败" || row.status === "部分完成"
                        ? "destructive"
                        : "outline"
                  }
                >
                  {row.status}
                </Badge>
                <Reason>{row.statusReason}</Reason>
                {row.failure ? (
                  <span className="knw5-sub" data-testid={`${testid}-failure`} title={row.failureRaw ?? undefined}>
                    {row.failure}
                  </span>
                ) : null}
                {row.failure === null && row.failureRaw ? (
                  <span className="knw5-sub" data-testid={`${testid}-failure`} title={row.failureRaw}>
                    上游记的原因偏技术，这里不原样上屏；悬停可看原文。
                  </span>
                ) : null}
              </td>
              <td data-label="条目数">
                <span data-testid={`${testid}-count`}>{row.count}</span>
                {row.extra ? <span className="knw5-sub">{row.extra}</span> : null}
                <Reason>{row.countReason}</Reason>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 入库状态：the dispatcher-named status read. Same row shape as 数据源接入任务
 * because the questions are the same (which source, when, how far, how many), but
 * it is a separate request with its own provenance line and its own honest
 * 「未接入」 wording — the two reads never borrow each other's numbers.
 */
function IngestStatusSurface({ nonce }: { nonce: string }): ReactNode {
  const surface = useSurface<IngestTaskRow>(
    () => fetchJsonStrict(INGEST_STATUS_URL).then(readTasks),
    `ingest-status|${nonce}`,
  );
  return (
    <Surface
      testid="knw5-ingest-status"
      source="ingest-status"
      state={surface.state}
      onRetry={surface.retry}
      unwiredHead={INGEST_STATUS_UNWIRED_HEAD}
      unwiredHuman={INGEST_STATUS_UNWIRED_HUMAN}
      empty={() => <p>接口已响应，但没有给出入库中的来源；这不等于一个源都没有，也不写 0 个源。</p>}
      render={(value) => <TaskTable rows={value.rows} testid="knw5-ingest-status" />}
    />
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
      unwiredHead={TASKS_UNWIRED_HEAD}
      unwiredHuman={TASKS_UNWIRED_HUMAN}
      empty={() => <p>接口已响应，但没有给出接入中的数据源；这不等于一个源都没有，也不显示 0 个。</p>}
      render={(value) => <TaskTable rows={value.rows} testid="knw5-ingest-tasks" />}
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
        unwiredHead={SEARCH_UNWIRED_HEAD}
        unwiredHuman={SEARCH_UNWIRED_HUMAN}
        empty={() => (
          <p>
            {query.trim() === ""
              ? "没有匹配结果。接口已响应，这份回答里没有条目；这不等于知识库是空的，也不给命中数。"
              : `没有匹配结果：关键词「${query.trim()}」这份回答里没有条目。接口已响应，不展示样例，也不给命中数。`}
            <Link
              className="knw5-link"
              to="/knowledge?tab=spaces&panel=evidence"
              data-testid="knw5-search-empty-citations"
            >
              先看会话里留下的引用
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
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
      empty={() => <p>暂无引用。接口已响应，这一份引用登记里没有条目；不展示样例，也不写 0 条。</p>}
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
            ? `暂无引用：已读取最近 ${value.scanned} 个会话，这些会话里的回答没有带引用；不展示样例。`
            : "暂无引用。接口已响应，最近会话里没有可展示的引用记录；不展示样例，也不写 0 条。"}
        </p>
      )}
      render={(value) => <RefList rows={value.rows} testid="knw5-session-cites-list" />}
    />
  );
}

type ForcedState = "loading" | "empty" | "error";

function readForced(raw: string | null): ForcedState | null {
  return raw === "loading" || raw === "empty" || raw === "error" ? raw : null;
}

export default function KnowledgeModulePage() {
  const [sp, setSp] = useSearchParams();
  const tab = initialTab(sp.get("tab"), sp.get("panel"));
  const query = sp.get("q") ?? "";
  const drilled = sp.get("ref") ?? "";
  const [nonce, setNonce] = useState("0");
  const forced = readForced(sp.get("state"));

  const selectTab = (key: KnowledgeTab) => {
    const next = new URLSearchParams(sp);
    // Keep `tab` on a shell-known value so the module stays mounted; `panel` carries
    // the internal panel, which is what refresh and back/forward must restore.
    if (!next.get("tab")) next.set("tab", "spaces");
    next.set("panel", key);
    // A drill belongs to the list it came from; carrying it across panels would open
    // nothing and read like a stuck row.
    next.delete("ref");
    setSp(next);
  };

  const toggleDrill = (key: string) => {
    const next = new URLSearchParams(sp);
    if (drilled === key) next.delete("ref");
    else next.set("ref", key);
    if (!next.get("tab")) next.set("tab", "spaces");
    next.set("panel", tab);
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
    <div className="knw5-page" data-testid="knw5-page" >
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
            {forced ? (
              forced === "loading" ? (
                <div className="knw5-forced" data-testid="knw5-forced-loading" aria-busy="true">
                  <div /><div /><div />
                </div>
              ) : forced === "empty" ? (
                <div className="knw5-forced" data-testid="knw5-forced-empty">
                  <p>服务已响应，这个分组没有可展示的条目；不显示 0，也不展示样例。</p>
                </div>
              ) : (
                <div className="knw5-forced" data-testid="knw5-forced-error" role="alert">
                  <p>预览错误：这次读取没有成功，页面没有编造知识数据。</p>
                  <RequestId id={null} testid="knw5-forced-request-id" />
                </div>
              )
            ) : (
            <RefDrill.Provider value={{ open: drilled, toggle: toggleDrill }}>
              {tab === "spaces" ? <SpacesSurface nonce={nonce} /> : null}
              {tab === "ingest" ? (
                <>
                  <IngestStatusSurface nonce={nonce} />
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
            </RefDrill.Provider>
            )}
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
