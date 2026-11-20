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
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
  DOC_DETAIL_UNWIRED_HEAD,
  DOC_DETAIL_UNWIRED_HUMAN,
  DOCUMENTS_UNWIRED_HEAD,
  DOCUMENTS_UNWIRED_HUMAN,
  SEARCH_UNWIRED_HEAD,
  SEARCH_UNWIRED_HUMAN,
  SPACE_DOC_UNWIRED_HEAD,
  SPACE_DOC_UNWIRED_HUMAN,
  ariaSort,
  docScopeNote,
  docSortCol,
  docSortDir,
  docSortLandDir,
  sortDocs,
  spaceScopeNote,
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
  docCopyText,
  docHitCopyText,
  documentDetailUrl,
  documentsUrl,
  documentsPageUrl,
  initialTab,
  readCitations,
  readDocDetail,
  readRecords,
  readRows,
  readSearch,
  readSessions,
  readSpaceDocuments,
  readSpaces,
  readTasks,
  searchUrl,
  sessionCitations,
  shortId,
  type CitationRow,
  type DocDetailRow,
  type DocRow,
  type DocPage,
  type DocSortCol,
  type DocSortDir,
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

/**
 * A detail view owns the deepest level's label (a space name or a document name), but
 * only the page renders a breadcrumb, so ids never appear twice in the document. The
 * child publishes what it read; the raw identifier and why it is missing stay in title.
 */
interface DeepCrumb {
  space?: { label: string; title: string; href?: string };
  doc?: { label: string; title?: string };
}

const CrumbReport = createContext<(crumb: DeepCrumb | null) => void>(() => {});

type Surf<T> =
  | { kind: "loading" }
  | { kind: "ready"; value: SurfaceValue<T> }
  | { kind: "unwired"; requestId: string | null; denied: boolean }
  | { kind: "login" }
  | { kind: "error"; message: string; requestId: string | null };

const GENERIC_FAILURE = "这次没能读到知识数据，请稍后重试。";

/**
 * 401 is its own body. 403 and 404 share ONE identical honest body (anti-enumeration:
 * the readable text never reveals which), but the read still remembers whether it was a
 * permission denial or a missing read, so a machine-checkable `knD-state-*` marker can be
 * attached without changing a single visible character.
 */
function toSurf(cause: unknown): Surf<never> {
  const api = cause instanceof ApiError ? cause : null;
  const status = api?.status ?? null;
  if (status === 401) return { kind: "login" };
  if (status === 403 || status === 404)
    return { kind: "unwired", requestId: api?.requestId ?? null, denied: status === 403 };
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
  /**
   * 只对 `/knowledge` 的空间列表与 `/knowledge/:spaceId` 的文档列表打开：给「读不到」
   * 与「真 0」各挂一个机器可判的 knD-state-* 标记（可见正文一字不改，403 与 404 同体）。
   */
  honestState?: boolean;
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
  honestState = false,
}: SurfaceProps<T>): ReactNode {
  const value = state.kind === "ready" ? state.value : null;
  const stamp = value?.stamp ?? null;
  // 机器可判的诚实态标记：不可用 / 无权 / 真 0，各一个 testid；不渲染任何可见文字。
  const honestMarker = !honestState
    ? null
    : state.kind === "unwired"
      ? state.denied
        ? "knD-state-denied"
        : "knD-state-unavailable"
      : value && value.rows.length === 0
        ? "knD-state-empty"
        : null;
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

      {honestMarker ? <span data-testid={honestMarker} className="knD-marker" aria-hidden="true" /> : null}

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
const CRUMB_TESTIDS = {
  list: "knB-crumb-list",
  space: "knB-crumb-space",
  doc: "knB-crumb-doc",
  search: "knB-crumb-search",
};

export interface CrumbItem {
  key: "list" | "space" | "doc" | "search";
  label: string;
  /** Real in-app target. Absent means this is the last level: not clickable. */
  href?: string;
  /** Raw identifier or the reason the label is a code — `title` only, never on screen. */
  title?: string;
}

/**
 * 面包屑：知识 / 空间名 / 文档名。每一级都是页内真链（客户端跳转），最后一级不可点
 * 并带 aria-current="page"。名字读不到时用短码，并在 title 里说清是短码与原始标识；
 * 关键词为空时不渲染空的检索段。
 */
function Breadcrumbs({ items }: { items: CrumbItem[] }): ReactNode {
  const testids = CRUMB_TESTIDS;
  const shown = items.filter((item) => item.label.trim() !== "");
  if (shown.length === 0) return null;
  return (
    <nav className="knB-nav" aria-label="位置" data-testid="knB-nav">
      <ol className="knB-list">
        {shown.map((item, index) => {
          const last = index === shown.length - 1;
          const clickable = !last && item.href !== undefined;
          return (
            <li className="knB-item" key={item.key}>
              {index > 0 ? (
                <span className="knB-sep" aria-hidden="true">
                  /
                </span>
              ) : null}
              {clickable ? (
                <Link className="knB-link" data-testid={testids[item.key]} to={item.href as string} title={item.title ?? undefined}>
                  {item.label}
                </Link>
              ) : (
                <span
                  className="knB-current"
                  data-testid={testids[item.key]}
                  aria-current={last ? "page" : undefined}
                  title={item.title ?? undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Wraps the matched characters without rewriting the cell: the text a screen reader
 * or a copy-paste gets is still exactly what the read returned, only the matched span
 * is marked. No keyword means no marks at all.
 */
function Highlight({ text, needle, testid }: { text: string; needle: string; testid: string }): ReactNode {
  const term = needle.trim();
  if (term === "") return <>{text}</>;
  const lower = text.toLowerCase();
  const want = term.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let hits = 0;
  for (let index = lower.indexOf(want, cursor); index !== -1; index = lower.indexOf(want, cursor)) {
    if (index > cursor) parts.push(text.slice(cursor, index));
    parts.push(
      <mark key={`${testid}-${hits}`} data-testid={testid}>
        {text.slice(index, index + want.length)}
      </mark>,
    );
    cursor = index + want.length;
    hits += 1;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/**
 * 命中计数与列表同源：两边的数字都取自同一个筛选后的数组，不是第二次统计。
 * 本地模式明写“当前已加载 N 项内命中”。
 */
function HitCount({ testid, loaded, shown, active }: { testid: string; loaded: number; shown: number; active: boolean }): ReactNode {
  return (
    <p className="knw5-sub" data-testid={testid}>
      {active ? `当前已加载 ${loaded} 项内命中 ${shown} 项` : `当前已加载 ${loaded} 项，全部列出（还没输入关键词）`}
      ：命中的行与这个数取自同一份筛选结果。
    </p>
  );
}

/**
 * Roving focus over the row links: ↑/↓ move between rows, Home/End jump to the ends,
 * Esc hands focus back to the search box. Until the first arrow press every link keeps
 * its natural tab order, so plain Tab still reaches all of them — roving only starts
 * once it is asked for. Rows are looked up by the list's own marker and the ids on the
 * links, never through a ref touched during render.
 */
function useRovingRows(marker: string, linkSelector: string) {
  const [active, setActive] = useState(-1);

  const nodes = (): HTMLElement[] => {
    if (typeof document === "undefined") return [];
    const scope = document.querySelector(`[data-roving="${marker}"]`);
    if (scope === null) return [];
    return Array.from(scope.querySelectorAll<HTMLElement>(linkSelector));
  };

  const moveTo = (index: number) => {
    const list = nodes();
    if (list.length === 0) return;
    const next = Math.max(0, Math.min(index, list.length - 1));
    setActive(next);
    list[next]?.focus();
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    moveTo(active < 0 ? 0 : active + 1);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const list = nodes();
    if (list.length === 0) return;
    const here = list.indexOf(document.activeElement as HTMLElement);
    const base = here >= 0 ? here : active;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveTo(base + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveTo(base - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      moveTo(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      moveTo(list.length - 1);
      return;
    }
    if (event.key === "Escape") {
      setActive(-1);
      document.querySelector<HTMLInputElement>(`#${marker}-input`)?.focus();
    }
  };

  const tabIndexFor = (index: number) => (active === -1 ? 0 : index === active ? 0 : -1);

  return { active, setActive, onKeyDown, onInputKeyDown, tabIndexFor };
}

function SpaceTable({
  rows,
  spaceLink,
  needle,
  tabIndexFor,
}: {
  rows: SpaceRow[];
  spaceLink: (id: string) => string;
  needle: string;
  tabIndexFor: (index: number) => number;
}): ReactNode {
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
            <tr key={row.id || `space-${index}`} data-testid="knw5-spaces-row" data-active={index} title={row.id || undefined}>
              <td data-label="空间名称">
                {row.id ? (
                  <Link
                    className="knw5-name knw5-rowlink"
                    data-testid="knw5-space-link"
                    to={spaceLink(row.id)}
                    tabIndex={tabIndexFor(index)}
                    title="看这个空间里的文档"
                  >
                    <Highlight text={row.name} needle={needle} testid="kn9-mark-space" />
                  </Link>
                ) : (
                  <>
                    <span className="knw5-name" data-testid="knw5-space-name">
                      <Highlight text={row.name} needle={needle} testid="kn9-mark-space" />
                    </span>
                    <span className="knw5-sub" title="上游没有给出这个空间的标识">
                      — 点不进文档列表
                    </span>
                  </>
                )}
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

/**
 * The spaces list plus the cross-space keyword box on top of it.
 *
 * Probed 2026-11-20 with the login cookie: the space read answers the same
 * `knowledge.not_wired` envelope whether or not `q` is attached (`/api/knowledge/spaces`
 * rid 2d1c31a157, `?q=人事` rid 5ee17e9c79, `?limit=20&q=人事` rid 1d642de41d, and
 * `/api/knowledge/sources?limit=20&q=人事` rid 062fdadca8), and `/api/console-sessions`
 * and `/api/audit` simply ignore an added `q`. No read accepts a keyword today, so the
 * box filters what this read already returned and says exactly that — it never claims a
 * server-side search, and typing a keyword issues no request at all.
 */
function SpacesSurface({
  nonce,
  spaceLink,
  keyword,
  onCommitKeyword,
  onClearKeyword,
}: {
  nonce: string;
  spaceLink: (id: string) => string;
  keyword: string;
  onCommitKeyword: (value: string) => void;
  onClearKeyword: () => void;
}): ReactNode {
  const surface = useSurface<SpaceRow>(
    () => fetchJsonStrict(SPACES_URL).then(readSpaces),
    `spaces|${nonce}`,
  );
  // Typed text is local; the URL keyword wins on refresh, back/forward and share.
  const [draft, setDraft] = useState<{ from: string; text: string }>({ from: keyword, text: keyword });
  const text = draft.from === keyword ? draft.text : keyword;
  const loaded = surface.state.kind === "ready" ? surface.state.value.rows : [];
  const needle = text.trim().toLowerCase();
  const shown = needle === "" ? loaded : loaded.filter((row) => row.name.toLowerCase().includes(needle) || row.source.toLowerCase().includes(needle));
  const roving = useRovingRows("kn8", 'a[data-testid="knw5-space-link"]');
  const clear = () => {
    setDraft({ from: keyword, text: "" });
    onClearKeyword();
  };

  return (
    <>
      <form
        className="knw5-form"
        data-testid="kn8-global-form"
        onSubmit={(event) => {
          event.preventDefault();
          onCommitKeyword(text);
        }}
      >
        <label className="knw5-field">
          <span className="knw5-sr-only">跨空间搜索</span>
          <input
            id="kn8-input"
            className="knw5-input"
            type="search"
            value={text}
            onChange={(event) => setDraft({ from: keyword, text: event.target.value })}
            onKeyDown={roving.onInputKeyDown}
            placeholder="按空间名或来源搜索"
            data-testid="kn8-global-input"
            aria-describedby="kn9-count"
          />
        </label>
        <Button size="sm" type="submit" prefix={<Search className="h-3.5 w-3.5" aria-hidden />} data-testid="kn8-global-submit">
          搜索
        </Button>
        {keyword !== "" || text.trim() !== "" ? (
          <Button size="sm" outlined onClick={clear} data-testid="kn8-global-clear">
            清空
          </Button>
        ) : null}
      </form>

      <p className="knw5-sub" data-testid="kn8-scope-note">
        {spaceScopeNote(surface.state.kind === "ready" ? loaded.length : null)}
        {surface.state.kind === "ready" && needle !== "" ? `命中 ${shown.length} 个。` : null}
      </p>

      {surface.state.kind === "ready" ? (
        <HitCount testid="kn9-count" loaded={loaded.length} shown={shown.length} active={needle !== ""} />
      ) : null}

      <div
        className="kn9-list"
        data-roving="kn8"
        data-testid="kn9-space-list"
        data-active-row={roving.active}
        onKeyDown={roving.onKeyDown}
      >
      <Surface
        testid="knw5-spaces"
        source="spaces"
        honestState
        state={surface.state.kind === "ready" ? { kind: "ready", value: { ...surface.state.value, rows: shown } } : surface.state}
        onRetry={surface.retry}
        unwiredHead={SPACES_UNWIRED_HEAD}
        unwiredHuman={SPACES_UNWIRED_HUMAN}
        empty={() =>
          needle === "" ? (
            <p>当前没有读到知识空间。接口已响应，但列表为空；这不等于「没有空间」，也不写 0 个。</p>
          ) : (
            <p>
              没有匹配的空间：已加载的 {loaded.length} 个空间里没有名字或来源含「{text.trim()}」的空间。
              这是本地筛选的结果，不代表库里没有这样的空间。
              <button type="button" className="knw5-drill" data-testid="kn8-global-empty-clear" onClick={clear}>
                清空
              </button>
            </p>
          )
        }
        render={(value) => <SpaceTable rows={value.rows} spaceLink={spaceLink} needle={text} tabIndexFor={roving.tabIndexFor} />}
      />
      </div>
    </>
  );
}

/**
 * The in-place document drawer. It opens over the list instead of navigating, so the
 * row keeps its place, the browser history stays clean and the address carries only
 * `?doc=<id>` — refresh and back reproduce it. Nothing is rendered as body text or an
 * excerpt unless a port actually returned it: the fields that come from the loaded list
 * say so, and 来源与读取状态 wait on the per-document read.
 */
function DocPreviewDrawer({
  nonce,
  docId,
  row,
  onClose,
}: {
  nonce: string;
  docId: string;
  row: DocRow | null;
  onClose: () => void;
}): ReactNode {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const surface = useSurface<DocDetailRow>(
    () => fetchJsonStrict(documentDetailUrl(docId)).then(readDocDetail),
    `doc-detail|${nonce}|${docId}`,
  );
  const detail = surface.state.kind === "ready" ? surface.state.value.rows[0] ?? null : null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="kn7-preview-scrim" data-testid="kn7-preview-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="kn7-preview"
        data-testid="kn7-preview-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kn7-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="kn7-preview-head">
          <h2 id="kn7-preview-title" data-testid="kn7-preview-title">
            {row?.name ?? "这份文档"}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="knw5-drill"
            data-testid="kn7-preview-close"
            onClick={onClose}
          >
            关闭（Esc）
          </button>
        </div>

        <dl className="knw5-ref-detail" data-testid="kn3-docs-detail" title={row?.id || undefined}>
          <div>
            <dt>文档名</dt>
            <dd
              data-testid="kn7-preview-field-name"
              title={row?.nameHint ?? (row ? undefined : "这条不在当前已加载的列表里")}
            >
              <span data-testid="kn3-docs-detail-name">{row?.name ?? "—"}</span>
            </dd>
          </div>
          <div>
            <dt>原文位置</dt>
            <dd>
              {row?.href ? (
                <Link className="knw5-link" data-testid="kn3-docs-detail-open" to={row.href}>
                  打开原文
                </Link>
              ) : (
                <span data-testid="kn3-docs-detail-unreachable">
                  原文不可达 · {row?.unreachable ?? "这条不在当前已加载的列表里，位置只能等详情口接上。"}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>类型</dt>
            <dd data-testid="kn7-preview-field-type" title={row ? (row.typeHint ?? (row.typeRaw ?? undefined)) : "这条不在当前已加载的列表里"}>
              {row?.type ?? "—"}
            </dd>
          </div>
          <div>
            <dt>大小</dt>
            <dd data-testid="kn7-preview-field-size" title={row ? (row.sizeHint ?? undefined) : "这条不在当前已加载的列表里"}>
              {row?.size ?? "—"}
            </dd>
          </div>
          <div>
            <dt>更新时间</dt>
            <dd data-testid="kn7-preview-field-updated" title={row ? (row.atHint ?? undefined) : "这条不在当前已加载的列表里"}>
              {row?.at ?? "—"}
            </dd>
          </div>
        </dl>

        <dl className="kn7-preview-fields" data-testid="kn7-preview-fields">
          <div>
            <dt>来源</dt>
            <dd data-testid="kn7-preview-field-source" title={detail?.sourceReason ?? undefined}>
              {detail?.source ?? "—"}
              {detail === null ? (
                <span className="knw5-sub" data-testid="kn7-preview-field-pending">
                  {surface.state.kind === "loading"
                    ? "正在读这份文档的来源。"
                    : surface.state.kind === "unwired"
                      ? "详情读口没接上，来源读不到。"
                      : "这次没读到来源。"}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>读取状态</dt>
            <dd data-testid="kn7-preview-field-status" title={detail?.statusReason ?? undefined}>
              {detail?.status ?? "—"}
            </dd>
          </div>
        </dl>

        {surface.state.kind === "loading" ? <Skeleton testid="kn7-preview-loading" /> : null}

        {surface.state.kind === "unwired" ? (
          <div className="knw5-unwired" data-testid="kn7-preview-unwired" role="status" title={KNOWLEDGE_GAP}>
            <b>{DOC_DETAIL_UNWIRED_HEAD}</b>
            <span className="knw5-wrap">{DOC_DETAIL_UNWIRED_HUMAN}</span>
            <RequestId id={surface.state.requestId} testid="kn7-preview-request-id" />
            <span className="knw5-actions">
              <Button size="sm" outlined onClick={surface.retry} data-testid="kn7-preview-retry">
                重试
              </Button>
              <ApplyLink testid="kn7-preview-apply" />
            </span>
          </div>
        ) : null}

        {surface.state.kind === "login" ? (
          <div className="knw5-empty" data-testid="kn7-preview-login" role="status">
            <b>需要登录</b>
            <span className="knw5-wrap">登录状态已经失效，重新登录后再打开这份文档的详情。</span>
            <Button size="sm" outlined onClick={surface.retry} data-testid="kn7-preview-retry">
              重试
            </Button>
          </div>
        ) : null}

        {surface.state.kind === "error" ? (
          <div className="knw5-error" data-testid="kn7-preview-error" role="alert">
            <b>这次没能读到这份文档的详情</b>
            <span className="knw5-wrap">{surface.state.message}</span>
            <RequestId id={surface.state.requestId} testid="kn7-preview-request-id" />
            <Button size="sm" outlined onClick={surface.retry} data-testid="kn7-preview-retry">
              重试
            </Button>
          </div>
        ) : null}

        {detail?.excerpt ? (
          <p className="knw5-sub" data-testid="kn7-preview-excerpt" title={detail.excerpt}>
            上游给出的摘录：{detail.excerpt}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/**
 * The document list of one space. Every row is a real focusable anchor: it opens that
 * row's own detail, which either links to the original or says why it cannot be opened.
 * The name box filters only what this read already returned, and says so on screen.
 */
/** A row plus the key it was opened with. The key comes from the load order, so
    sorting never moves which row a drawer or link points at. */
interface DocEntry {
  row: DocRow;
  key: string;
}

function SortableHead({
  col,
  label,
  sort,
  dir,
  onSort,
}: {
  col: DocSortCol;
  label: string;
  sort: DocSortCol;
  dir: DocSortDir;
  onSort: (col: DocSortCol) => void;
}): ReactNode {
  const active = sort === col;
  return (
    <th scope="col" className="knC-th" aria-sort={ariaSort(col, sort, dir)}>
      <button
        type="button"
        className="knC-sort"
        data-testid={`knC-sort-${col}`}
        onClick={() => onSort(col)}
        aria-label={`按${label}排序`}
      >
        <span className="knC-sort-label">{label}</span>
        <span className="knC-mark" aria-hidden="true">
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

function DocTable({
  entries,
  docLink,
  openKey,
  needle,
  sort,
  dir,
  onSort,
}: {
  entries: DocEntry[];
  docLink: (key: string) => string;
  openKey: string;
  needle: string;
  sort: DocSortCol;
  dir: DocSortDir;
  onSort: (col: DocSortCol) => void;
}): ReactNode {
  return (
    <div className="kn3-docs-wrap">
      <table className="knw5-table kn3-docs-table" data-testid="kn3-docs-table">
        <thead>
          <tr>
            <SortableHead col="name" label="文档名" sort={sort} dir={dir} onSort={onSort} />
            <th scope="col">类型</th>
            <SortableHead col="size" label="大小" sort={sort} dir={dir} onSort={onSort} />
            <SortableHead col="updated" label="更新" sort={sort} dir={dir} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {entries.map(({ row, key }) => {
            const isOpen = openKey !== "" && openKey === key;
            return (
              <tr key={key} data-testid="kn3-docs-row" data-open={isOpen ? "1" : "0"} title={row.id || undefined}>
                <td data-label="文档名">
                  <Link className="kn3-docs-name" data-testid="kn3-docs-name" to={docLink(key)} title={row.nameHint ?? undefined}>
                    <Highlight text={row.name} needle={needle} testid="kn9-mark-doc" />
                  </Link>
                </td>
                <td data-label="类型">
                  <span data-testid="kn3-docs-type" title={row.typeHint ?? (row.typeRaw ?? undefined)}>
                    {row.type}
                  </span>
                </td>
                <td data-label="大小">
                  <span data-testid="kn3-docs-size" title={row.sizeHint ?? undefined}>
                    {row.size}
                  </span>
                </td>
                <td data-label="更新">
                  <span data-testid="kn3-docs-updated" title={row.atHint ?? undefined}>
                    {row.at}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SpaceDetailSurface({
  nonce,
  spaceId,
  openDoc,
  docLink,
  backLink,
  spaceSelfLink,
  sort,
  dir,
  onSort,
  onCloseDoc,
}: {
  nonce: string;
  spaceId: string;
  openDoc: string;
  docLink: (key: string) => string;
  backLink: string;
  spaceSelfLink: string;
  sort: DocSortCol;
  dir: DocSortDir;
  onSort: (col: DocSortCol) => void;
  onCloseDoc: () => void;
}): ReactNode {
  const [filter, setFilter] = useState("");
  // 换一个空间：本地筛选要清掉，别把上一个空间的筛选结果当成这个空间的现状。
  // 行与错误本就随读口键（含 spaceId）更换而回到骨架，不会残留。
  const prevSpace = useRef(spaceId);
  useEffect(() => {
    if (prevSpace.current !== spaceId) {
      prevSpace.current = spaceId;
      setFilter("");
    }
  }, [spaceId]);
  // 空间名不靠 URL 回显：它来自指定空间读口。读不到就用短码，原因放 title。
  const names = useSurface<SpaceRow>(
    () => fetchJsonStrict(SPACES_URL).then(readSpaces),
    `space-name|${nonce}`,
  );
  const knownSpace =
    names.state.kind === "ready" ? names.state.value.rows.find((row) => row.id === spaceId) ?? null : null;
  const spaceCode = shortId(spaceId);
  const spaceLabel = knownSpace?.name ?? (spaceCode ? `空间 · ${spaceCode}` : "空间");
  const spaceTitle = knownSpace
    ? "名字取自空间读口"
    : `${spaceId}｜空间名没读到（读口未接入、无权限，或这个标识不在已加载的空间里），这里只显示标识尾段。`;
  const surface = useSurface<DocRow>(
    () => fetchJsonStrict(documentsUrl(spaceId)).then(readSpaceDocuments),
    `space-docs|${nonce}|${spaceId}`,
  );
  const filterKey = filter.trim().toLowerCase();
  const baseRows = surface.state.kind === "ready" ? surface.state.value.rows : [];
  const meta1: DocPage | undefined = surface.state.kind === "ready" ? surface.state.value.page : undefined;

  // ---- 游标分页累积：只累加第一页之后的页；第一页仍走 surface，保留四态与 knD 标记 ----
  const [moreRows, setMoreRows] = useState<DocRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  // 游标事实只认「最近一页」的信封（pageMeta）：是否还有下一页、是否到末页、
  // 信封里到底有没有 cursor 字段，都来自服务端回答，绝不本地推断。
  const [pageMeta, setPageMeta] = useState<DocPage | null>(null);
  const [moreState, setMoreState] = useState<"idle" | "loading" | "error">("idle");
  // 下一页读取失败：403/404/500 共用同一份正文（同体），401 单独；rid 可复制、可重试。
  const [moreErr, setMoreErr] = useState<"login" | "failed" | null>(null);
  const [moreRid, setMoreRid] = useState<string | null>(null);
  const [stale, setStale] = useState(false); // 坏/过期 cursor 重放：不合并、停止加载
  // 条件代次：排序/筛选/空间/刷新一变，还在路上的那一页回答就作废，不得再并回列表。
  const pageGen = useRef(0);

  const hasMore = pageMeta?.hasMore ?? false;
  const cursorOffered = pageMeta?.cursorFieldPresent ?? false;

  // 排序、检索条件、空间或刷新变化 → 清空已累加的后续页、游标退回第一页给的那个。
  // 第一页已在内存里，这一步不重新请求，所以点表头仍是 0 新请求（R52 口径不破）。
  useEffect(() => {
    pageGen.current += 1;
    setMoreRows([]);
    setCursor(meta1?.nextCursor ?? null);
    setPageMeta(meta1 ?? null);
    setMoreState("idle");
    setMoreErr(null);
    setMoreRid(null);
    setStale(false);
  }, [spaceId, nonce, sort, dir, filter, surface.state.kind, meta1]);

  // 合并第一页与已加载的后续页；按 id 去重，挡上游坏 cursor 静默重放首页造成的重复行。
  const combined: DocRow[] = moreRows.length === 0 ? baseRows : [...baseRows, ...moreRows];
  // 先按读入顺序定死每行的 key，再本地排序：排序只换显示次序，绝不动抽屉与链接的落点。
  const keyedAll: DocEntry[] = combined.map((row, index) => ({
    row,
    key: row.id !== "" ? row.id : `row-${index}`,
  }));
  const filtered = filterKey === "" ? keyedAll : keyedAll.filter((entry) => entry.row.name.toLowerCase().includes(filterKey));
  const shown = sortDocs(filtered, sort, dir, (entry) => entry.row);
  const shownValue =
    surface.state.kind === "ready" ? { ...surface.state.value, rows: shown.map((entry) => entry.row) } : null;
  const openRow = shown.find((entry) => entry.key === openDoc)?.row ?? null;

  // 下一页只由按钮显式触发，绝不做滚动自动加载；失败后按钮仍是这个入口（重试=再点）。
  const loadMore = () => {
    if (!hasMore || moreState === "loading" || cursor === null) return;
    const gen = pageGen.current;
    const seen = new Set(combined.map((row) => row.id).filter((id) => id !== ""));
    setMoreState("loading");
    setMoreErr(null); // 旧错误随这次发起作废：成功就消失，失败会由 catch 重新落
    setMoreRid(null);
    fetchJsonStrict(documentsPageUrl(spaceId, cursor))
      .then((body: unknown) => {
        if (pageGen.current !== gen) return; // 条件已变，这页过期：不并回、不改游标
        const val = readSpaceDocuments(body);
        const fresh = val.rows.filter((row) => row.id === "" || !seen.has(row.id));
        if (val.rows.length > 0 && fresh.length === 0) {
          // 上游对坏/过期 cursor 静默返回首页：不合并、停止，给本地化文案与重载首页入口。
          setStale(true);
        } else {
          setMoreRows((cur) => [...cur, ...fresh]);
          setCursor(val.page?.nextCursor ?? null);
        }
        setPageMeta(val.page ?? null);
        setMoreState("idle");
      })
      .catch((cause: unknown) => {
        if (pageGen.current !== gen) return;
        const surf = toSurf(cause);
        setMoreState("idle");
        setMoreErr(surf.kind === "login" ? "login" : "failed");
        setMoreRid(surf.kind === "unwired" || surf.kind === "error" ? surf.requestId : null);
      });
  };

  // 计数：M 是筛前/加载后真正读到的条数；total 只认信封给的，缺就「总数不可用」，绝不按 M 推算。
  const loaded = combined.length;
  const totalKnown = meta1?.totalKnown ?? false;
  const total = meta1?.total ?? null;
  // 到末页只认信封明说（有 cursor 字段且 nextCursor 为 null）；字段缺失=无法判断，不谎称末页。
  const atEnd = baseRows.length > 0 && cursorOffered && !hasMore && !stale && moreErr === null;

  // ---- R55 — 复制清单：文本只取当前排序与筛选后的可见行（屏上那四个字段原样），此路不发任何请求。
  // 回执签名比对：条件一变，旧的「已复制」就作废，不再冒充当前清单复制过。
  const copyText = docCopyText(shown.map((entry) => entry.row));
  const [copyState, setCopyState] = useState<{ kind: "copied" | "failed"; sig: string } | null>(null);
  const copyAct = copyState !== null && copyState.sig === copyText ? copyState.kind : "idle";
  const copyList = () => {
    if (shown.length === 0) return;
    if (!navigator.clipboard?.writeText) {
      setCopyState({ kind: "failed", sig: copyText });
      return;
    }
    void navigator.clipboard.writeText(copyText).then(
      () => setCopyState({ kind: "copied", sig: copyText }),
      () => setCopyState({ kind: "failed", sig: copyText }),
    );
  };

  const openKeyCode = shortId(openDoc);
  const docLabel = openRow?.name ?? (openKeyCode ? `文档 · ${openKeyCode}` : "");
  const docTitle = openRow
    ? (openRow.nameHint ?? undefined)
    : `${openDoc}｜这条不在已加载的列表里，文档名只能显示标识尾段。`;
  const report = useContext(CrumbReport);
  useEffect(() => {
    report({
      space: { label: spaceLabel, title: spaceTitle, href: openDoc === "" ? undefined : spaceSelfLink },
      doc: openDoc === "" ? undefined : { label: docLabel, title: docTitle ?? undefined },
    });
    return () => report(null);
  }, [report, spaceLabel, spaceTitle, spaceSelfLink, openDoc, docLabel, docTitle]);

  return (
    <>
      <p className="knw5-hint">
        <Link className="knw5-link" data-testid="kn3-docs-back" to={backLink}>
          返回空间列表
        </Link>
        <span className="kn3-docs-title" title={spaceTitle}>
          {spaceLabel}的文档列表
        </span>
        <span className="knw5-sub">空间名取自指定空间读口；读不到就只显示标识尾段，不替空间编名字。</span>
      </p>

      <div className="kn3-docs-filter" data-testid="kn3-docs-filter">
        <label className="knw5-field">
          <span className="knw5-sr-only">按文档名筛选</span>
          <input
            className="knw5-input"
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="按文档名筛选"
            data-testid="kn3-docs-filter-input"
          />
        </label>
        <span className="knw5-sub" data-testid="kn3-docs-filter-note">
          本地筛选：只在接口已经返回的这份列表里按名字挑，不再问一次服务，也不改变数量口径。
        </span>
      </div>

      <Surface
        testid="kn3-docs"
        source="space-docs"
        honestState
        state={
          surface.state.kind === "ready" && shownValue ? { kind: "ready", value: shownValue } : surface.state
        }
        onRetry={surface.retry}
        unwiredHead={SPACE_DOC_UNWIRED_HEAD}
        unwiredHuman={SPACE_DOC_UNWIRED_HUMAN}
        empty={() =>
          filterKey === "" ? (
            <p>该空间暂无文档。接口已响应，这份列表里没有文档；这只说明这份回答是空的，不下别的结论，也不给数量。</p>
          ) : (
            <p>
              本地筛选没有匹配：这份列表里有 {loaded} 份文档，按「{filter.trim()}」一条都没留下。
              这是筛完的结果，不是空间没有文档。
            </p>
          )
        }
        render={() => (
          <>
            <DocTable
              entries={shown}
              docLink={docLink}
              openKey={openDoc}
              needle={filter}
              sort={sort}
              dir={dir}
              onSort={onSort}
            />

            {/* R54 — 游标分页条：读数只来自信封给的字段；缺什么就说什么不可用，一律不推算。 */}
            <div className="knE-page-bar" data-testid="knE-page-bar">
              <span
                className="knw5-sub"
                data-testid="knE-page-count"
                title={
                  totalKnown
                    ? "总数取自上游信封里的 total。"
                    : "上游回答没有给总数；这里只报实际读到的条数，不按已加载条数推算总数。"
                }
              >
                {totalKnown ? `共 ${total} 篇 / 已显示 ${loaded} 篇` : `已显示 ${loaded} 篇 · 总数不可用`}
              </span>
              <Button
                size="sm"
                outlined
                onClick={loadMore}
                disabled={!hasMore || moreState === "loading" || stale}
                aria-busy={moreState === "loading" ? "true" : undefined}
                title={
                  hasMore
                    ? "按服务端给的游标再取下一页，只在这个按钮上触发。"
                    : cursorOffered
                      ? "信封给了游标字段且下一页为空：这就是末页。"
                      : "上游回答没给分页游标：有多少页无法判断，不猜、也不谎称末页。"
                }
                data-testid="knE-page-more"
              >
                {moreState === "loading"
                  ? "正在加载…"
                  : stale
                    ? "游标已过期"
                    : hasMore
                      ? moreErr !== null
                        ? "再试下一页"
                        : "显示更多"
                      : cursorOffered
                        ? "已到末页"
                        : "无分页游标"}
              </Button>
              {/* 到末页的机器可判标记：与 knD-marker 同一手法，不出字、不参与布局。 */}
              {atEnd ? <span data-testid="knE-page-end" className="knE-marker" aria-hidden="true" /> : null}

              {stale ? (
                <div className="knw5-empty" data-testid="knE-page-stale" role="status">
                  <b>翻页游标已过期</b>
                  <span className="knw5-wrap">
                    下一页返回的是已经读过的内容，已停止继续加载；下面显示的列表不受影响，没有重复行。
                  </span>
                  <Button size="sm" outlined onClick={surface.retry} data-testid="knE-page-reload">
                    重新读取列表
                  </Button>
                </div>
              ) : null}

              {moreErr !== null ? (
                <div className="knw5-error" data-testid="knE-page-error" role="alert">
                  <b>{moreErr === "login" ? "需要登录" : "下一页读取失败"}</b>
                  <span className="knw5-wrap">
                    {moreErr === "login"
                      ? "登录状态已经失效，这一页没有读到；已显示的列表不受影响，重新登录或再试可继续。"
                      : "这一页没有读到；已显示的列表不受影响，再试只取这一页。"}
                  </span>
                  <RequestId id={moreRid} testid="knE-page-request-id" />
                  <Button size="sm" outlined onClick={loadMore} data-testid="knE-page-retry">
                    重试
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        )}
      />
      {surface.state.kind === "ready" ? (
        <div className="knF-row" data-testid="knF-row">
          <Button
            size="sm"
            outlined
            className="knF-copy"
            onClick={copyList}
            disabled={shown.length === 0}
            title={
              shown.length === 0
                ? filterKey !== ""
                  ? `本地筛选没有留下行：这份列表里有 ${loaded} 份文档，按「${filter.trim()}」一条都没留下。不编行，也就没有可复制的清单。`
                  : "接口回答里没有文档：这份列表是空的。不编行，也就没有可复制的清单。"
                : "复制当前排序与筛选后在屏幕上的这些行：文档名 | 类型 | 大小 | 更新。屏上数据，不会再发请求。"
            }
            data-testid="knF-copy"
          >
            复制清单
          </Button>
          <span className="knw5-sub" data-testid="knF-lines">{shown.length} 行</span>
          <span className="knF-status" data-testid="knF-copy-status" aria-live="polite">
            {copyAct === "copied" ? "已复制" : copyAct === "failed" ? "复制失败，已展开可选文本，可手动复制" : ""}
          </span>
          {copyAct === "failed" ? (
            <textarea
              className="knF-fallback"
              data-testid="knF-fallback"
              aria-label="手动复制文档清单文本"
              readOnly
              rows={Math.min(8, shown.length + 2)}
              value={copyText}
            />
          ) : null}
        </div>
      ) : null}
      {openDoc !== "" ? (
        <DocPreviewDrawer nonce={nonce} docId={openDoc} row={openRow} onClose={onCloseDoc} />
      ) : null}
    </>
  );
}

/**
 * The cross-space document-name box at the top of `/knowledge`.
 *
 * The read is fetched once and never re-requested by the keyword, because the BFF
 * has no keyword filter on this route (probed: `?q=` and `?query=` change nothing).
 * So this is a filter over what is already loaded, the note under the box counts the
 * loaded rows, and the wording never claims a whole-library search.
 */
function SearchDocTable({
  rows,
  docLink,
  openKey,
  needle,
  tabIndexFor,
}: {
  rows: DocRow[];
  docLink: (key: string) => string;
  openKey: string;
  needle: string;
  tabIndexFor: (index: number) => number;
}): ReactNode {
  return (
    <div className="k3-docs-wrap">
      <table className="knw5-table" data-testid="kn6-search-table">
        <thead>
          <tr>
            <th scope="col">文档名</th>
            <th scope="col">所属空间</th>
            <th scope="col">类型</th>
            <th scope="col">大小</th>
            <th scope="col">更新</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = row.id !== "" ? row.id : `row-${index}`;
            return (
              <tr
                key={key}
                data-testid="kn6-search-row"
                data-open={openKey === key ? "1" : "0"}
                data-active-row={index}
                title={row.id || undefined}
              >
                <td data-label="文档名">
                  <Link
                    className="kn3-docs-name"
                    data-testid="kn6-search-name"
                    to={docLink(key)}
                    tabIndex={tabIndexFor(index)}
                    title={row.nameHint ?? undefined}
                  >
                    <Highlight text={row.name} needle={needle} testid="kn9-mark-doc" />
                  </Link>
                </td>
                <td data-label="所属空间">
                  <span data-testid="kn6-search-space" title={row.spaceRaw ?? row.spaceLabel ?? undefined}>
                    {row.spaceLabel ?? "—"}
                  </span>
                </td>
                <td data-label="类型">
                  <span data-testid="kn6-search-type" title={row.typeHint ?? (row.typeRaw ?? undefined)}>
                    {row.type}
                  </span>
                </td>
                <td data-label="大小">
                  <span data-testid="kn6-search-size" title={row.sizeHint ?? undefined}>
                    {row.size}
                  </span>
                </td>
                <td data-label="更新">
                  <span data-testid="kn6-search-updated" title={row.atHint ?? undefined}>
                    {row.at}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DocumentNameSearch({
  nonce,
  keyword,
  openKey,
  sdocLink,
  spaceLink,
  onCommit,
  onClear,
}: {
  nonce: string;
  keyword: string;
  openKey: string;
  sdocLink: (key: string) => string;
  spaceLink: (id: string) => string;
  onCommit: (value: string) => void;
  onClear: () => void;
}): ReactNode {
  const [draft, setDraft] = useState<{ from: string; text: string }>({ from: keyword, text: keyword });
  const text = draft.from === keyword ? draft.text : keyword;
  // The read happens once per refresh only: the keyword never re-triggers it,
  // because there is no server-side keyword filter to ask for.
  const surface = useSurface<DocRow>(
    () => fetchJsonStrict(DOCUMENTS_URL).then(readSpaceDocuments),
    `doc-search|${nonce}`,
  );
  const loaded = surface.state.kind === "ready" ? surface.state.value.rows : [];
  const needle = text.trim().toLowerCase();
  const shown = needle === "" ? loaded : loaded.filter((row) => row.name.toLowerCase().includes(needle));
  const openRow = shown.find((row, index) => (row.id !== "" ? row.id : `row-${index}`) === openKey) ?? null;
  const openSpaceRaw = openRow?.spaceRaw ?? null;
  const roving = useRovingRows("kn6", 'a[data-testid="kn6-search-name"]');
  // Clearing resets the box itself too: a keyword typed but never submitted lives
  // only here, so a button that only touched the URL would look dead.
  const clear = () => {
    setDraft({ from: keyword, text: "" });
    onClear();
  };

  // ---- R56 — 复制结果：文本只取当前检索词下的命中行（屏上五列原样），此路不发任何请求。
  // 与 knF 同一手法：回执带内容签名，检索词一变旧的「已复制 N 条」立即作废，不冒充当前结果。
  const copyText = docHitCopyText(shown);
  const [copyState, setCopyState] = useState<{ kind: "copied" | "failed"; sig: string } | null>(null);
  const copyAct = copyState !== null && copyState.sig === copyText ? copyState.kind : "idle";
  const copyHits = () => {
    if (shown.length === 0) return;
    if (!navigator.clipboard?.writeText) {
      setCopyState({ kind: "failed", sig: copyText });
      return;
    }
    void navigator.clipboard.writeText(copyText).then(
      () => setCopyState({ kind: "copied", sig: copyText }),
      () => setCopyState({ kind: "failed", sig: copyText }),
    );
  };

  return (
    <section className="kn6-search" data-testid="kn6-search-panel">
      {openKey !== "" && openSpaceRaw ? (
        <p className="knw5-sub">
          <span data-testid="kn6-search-detail-space-note" title={openSpaceRaw}>
            这条来自另一个空间：
          </span>
          <Link className="knB-link" data-testid="knB-crumb-space" to={spaceLink(openSpaceRaw)}>
            {openRow?.spaceLabel ?? `空间 · ${shortId(openSpaceRaw) ?? ""}`}
          </Link>
        </p>
      ) : null}
      <form
        className="knw5-form"
        data-testid="kn6-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          onCommit(text);
        }}
      >
        <label className="knw5-field">
          <span className="knw5-sr-only">按文档名搜索</span>
          <input
            id="kn6-input"
            className="knw5-input"
            type="search"
            value={text}
            onChange={(event) => setDraft({ from: keyword, text: event.target.value })}
            onKeyDown={roving.onInputKeyDown}
            placeholder="按文档名搜索"
            data-testid="kn6-search-input"
            aria-describedby="kn9-count-docs"
          />
        </label>
        <Button size="sm" type="submit" prefix={<Search className="h-3.5 w-3.5" aria-hidden />} data-testid="kn6-search-submit">
          搜索
        </Button>
        {keyword !== "" || text.trim() !== "" ? (
          <Button size="sm" outlined onClick={clear} data-testid="kn6-search-clear">
            清除关键词
          </Button>
        ) : null}
      </form>

      <p className="knw5-sub" data-testid="kn6-search-note">
        {surface.state.kind === "ready"
          ? docScopeNote(loaded.length)
          : docScopeNote(null)}
      </p>

      {surface.state.kind === "ready" ? (
        <HitCount testid="kn9-count-docs" loaded={loaded.length} shown={shown.length} active={needle !== ""} />
      ) : null}

      <div
        className="kn9-list"
        data-roving="kn6"
        data-testid="kn9-doc-list"
        data-active-row={roving.active}
        onKeyDown={roving.onKeyDown}
      >
      <Surface
        testid="kn6-search"
        source="doc-search"
        state={
          surface.state.kind === "ready" ? { kind: "ready", value: { ...surface.state.value, rows: shown } } : surface.state
        }
        onRetry={surface.retry}
        unwiredHead={DOCUMENTS_UNWIRED_HEAD}
        unwiredHuman={DOCUMENTS_UNWIRED_HUMAN}
        empty={() =>
          needle === "" ? (
            <p>接口已响应，这份文档列表里没有条目；这只说明这份回答是空的，不下别的结论，也不给数量。</p>
          ) : (
            <p>
              没有匹配的文档：已加载的 {loaded.length} 条里没有名字含「{text.trim()}」的文档。
              这是本地筛选的结果，不代表全库没有。
              <button type="button" className="knw5-drill" data-testid="kn6-search-empty-clear" onClick={clear}>
                清除关键词
              </button>
            </p>
          )
        }
        render={(value) => (
          <>
            <SearchDocTable
              rows={value.rows}
              docLink={sdocLink}
              openKey={openKey}
              needle={text}
              tabIndexFor={roving.tabIndexFor}
            />
            {openRow ? (
              <dl className="knw5-ref-detail" data-testid="kn6-search-detail" title={openRow.id || undefined}>
                <div>
                  <dt>文档</dt>
                  <dd title={openRow.nameHint ?? undefined}>{openRow.name}</dd>
                </div>
                <div>
                  <dt>所属空间</dt>
                  <dd title={openRow.spaceRaw ?? undefined}>{openRow.spaceLabel ?? "—"}</dd>
                </div>
                <div>
                  <dt>原文位置</dt>
                  <dd>
                    {openRow.href ? (
                      <a className="knw5-link" data-testid="kn6-search-detail-open" href={openRow.href}>
                        打开原文
                      </a>
                    ) : (
                      <span data-testid="kn6-search-detail-unreachable">原文不可达 · {openRow.unreachable}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>类型</dt>
                  <dd title={openRow.typeHint ?? (openRow.typeRaw ?? undefined)}>{openRow.type}</dd>
                </div>
                <div>
                  <dt>大小</dt>
                  <dd title={openRow.sizeHint ?? undefined}>{openRow.size}</dd>
                </div>
                <div>
                  <dt>更新</dt>
                  <dd title={openRow.atHint ?? undefined}>{openRow.at}</dd>
                </div>
              </dl>
            ) : null}
          </>
        )}
      />
      </div>
      {surface.state.kind === "ready" ? (
        <div className="knG-row" data-testid="knG-row">
          <Button
            size="sm"
            outlined
            className="knG-copy"
            onClick={copyHits}
            disabled={shown.length === 0}
            title={
              shown.length === 0
                ? "当前没有可复制的结果"
                : "复制当前检索词下的命中行：文档名 | 所属空间 | 类型 | 大小 | 更新。屏上数据，不会再发请求。"
            }
            data-testid="knG-copy"
          >
            复制结果
          </Button>
          <span className="knw5-sub" data-testid="knG-lines">{shown.length} 条</span>
          <span className="knG-status" data-testid="knG-copy-status" aria-live="polite">
            {copyAct === "copied" ? `已复制 ${shown.length} 条` : copyAct === "failed" ? "复制失败，已展开可选文本，可手动复制" : ""}
          </span>
          {copyAct === "failed" ? (
            <textarea
              className="knG-fallback"
              data-testid="knG-copy-fallback"
              aria-label="手动复制检索结果文本"
              readOnly
              rows={Math.min(8, shown.length + 2)}
              value={copyText}
            />
          ) : null}
        </div>
      ) : null}
    </section>
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
  const spaceId = sp.get("space") ?? "";
  const openDoc = sp.get("doc") ?? "";
  const openSearchDoc = sp.get("sdoc") ?? "";
  // 文档列表排序也只在地址里：刷新、粘贴 URL、前进后退都能复现，且换排序不再问服务。
  const sortCol = docSortCol(sp.get("sort"));
  const sortDir = docSortDir(sp.get("dir"));
  const [nonce, setNonce] = useState("0");
  const [deepCrumb, setDeepCrumb] = useState<DeepCrumb | null>(null);
  const reportCrumb = useCallback((next: DeepCrumb | null) => {
    setDeepCrumb((current) => {
      const same =
        (current?.space?.label ?? "") === (next?.space?.label ?? "") &&
        (current?.space?.href ?? "") === (next?.space?.href ?? "") &&
        (current?.space?.title ?? "") === (next?.space?.title ?? "") &&
        (current?.doc?.label ?? "") === (next?.doc?.label ?? "") &&
        (current?.doc?.title ?? "") === (next?.doc?.title ?? "");
      return same ? current : next;
    });
  }, []);
  const forced = readForced(sp.get("state"));

  const selectTab = (key: KnowledgeTab) => {
    const next = new URLSearchParams(sp);
    // Keep `tab` on a shell-known value so the module stays mounted; `panel` carries
    // the internal panel, which is what refresh and back/forward must restore.
    if (!next.get("tab")) next.set("tab", "spaces");
    next.set("panel", key);
    // A drill, an open space and an open document row all belong to the panel they
    // came from; carrying them across would show nothing and read like a stuck row.
    next.delete("ref");
    next.delete("space");
    next.delete("doc");
    next.delete("sdoc");
    // 排序只属于某个空间的文档列表；换页签就清掉，避免地址里残留用不上的排序参数。
    next.delete("sort");
    next.delete("dir");
    setSp(next);
  };

  /** The row the drawer was opened from, so closing puts focus back on it. */
function containerQuery(key: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const anchors = Array.from(document.querySelectorAll<HTMLElement>('a[data-testid="kn3-docs-name"]'));
  return anchors.find((node) => (node.getAttribute("href") ?? "").includes(`doc=${key}`)) ?? null;
}

/** In-page addresses: the space detail is a query state, not a new route. */
  const keepBase = () => {
    const next = new URLSearchParams(sp);
    if (!next.get("tab")) next.set("tab", "spaces");
    next.set("panel", "spaces");
    return next;
  };
  const spaceLink = (id: string) => {
    const next = keepBase();
    next.set("space", id);
    next.delete("doc");
    return `/knowledge?${next.toString()}`;
  };
  // Opening a row writes ?doc=<id>; the row that is already open links to itself and
  // the drawer's own close clears the parameter, so re-clicking never double-toggles.
  const docLink = (key: string) => {
    const next = keepBase();
    next.set("space", spaceId);
    next.set("doc", key);
    return `/knowledge?${next.toString()}`;
  };
  /** The top keyword box keeps its own opened row, so it never moves the
      space-detail row that `doc=` already owns. */
  const sdocLink = (key: string) => {
    const next = new URLSearchParams(sp);
    if (openSearchDoc === key) next.delete("sdoc");
    else next.set("sdoc", key);
    return `/knowledge?${next.toString()}`;
  };
  const commitKeyword = (value: string) => {
    const next = new URLSearchParams(sp);
    const trimmed = value.trim();
    if (trimmed === "") next.delete("q");
    else next.set("q", trimmed);
    next.delete("sdoc");
    setSp(next);
  };
  const clearKeyword = () => {
    const next = new URLSearchParams(sp);
    next.delete("q");
    next.delete("sdoc");
    setSp(next);
  };

  // 点同一列在升/降间翻转，点别的列落到它各自的默认方向；只改地址，不触发任何读取。
  const applySort = (col: DocSortCol) => {
    const next = new URLSearchParams(sp);
    const dir: DocSortDir = col === sortCol ? (sortDir === "asc" ? "desc" : "asc") : docSortLandDir(col);
    next.set("sort", col);
    next.set("dir", dir);
    setSp(next);
  };

  const closeDocDrawer = () => {
    const key = openDoc;
    const next = new URLSearchParams(sp);
    next.delete("doc");
    setSp(next);
    // Rows stay mounted while the drawer closes, so focus can go back in this tick.
    const anchor = containerQuery(key);
    anchor?.focus();
  };

  const backLink = (() => {
    const next = keepBase();
    next.delete("space");
    next.delete("doc");
    return `/knowledge?${next.toString()}`;
  })();

  /** The 空间 crumb: this space's own list, with the open document dropped. */
  const spaceSelfLink = (() => {
    const next = keepBase();
    next.set("space", spaceId);
    next.delete("doc");
    next.delete("sdoc");
    return `/knowledge?${next.toString()}`;
  })();

  /** The 知识 crumb: the search page with its keyword still in the address. */
  const listLink = (() => {
    const next = new URLSearchParams(sp);
    next.delete("space");
    next.delete("doc");
    next.delete("sdoc");
    if (!next.get("tab")) next.set("tab", "spaces");
    return `/knowledge?${next.toString()}`;
  })();

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

  /**
   * One breadcrumb for the whole page: 知识 /〔检索「q」〕/〔空间〕/〔文档〕.
   * A level is only skipped when there is genuinely nothing to name — an empty
   * keyword never renders an empty segment.
   */
  // 「知识」去掉关键词回列表；「检索」带着关键词回列表。谁在当前页谁不可点。
  const plainListLink = (() => {
    const next = new URLSearchParams(sp);
    next.delete("q");
    next.delete("space");
    next.delete("doc");
    next.delete("sdoc");
    if (!next.get("tab")) next.set("tab", "spaces");
    return `/knowledge?${next.toString()}`;
  })();
  const deeper = spaceId !== "" || openSearchDoc !== "" || deepCrumb?.space !== undefined || deepCrumb?.doc !== undefined;
  const crumbs: CrumbItem[] = [
    { key: "list", label: "知识", href: query.trim() === "" && !deeper ? undefined : plainListLink },
    ...(query.trim() === ""
      ? []
      : [{ key: "search" as const, label: `检索「${query.trim()}」`, href: deeper ? listLink : undefined }]),
    ...(deepCrumb?.space
      ? [{ key: "space" as const, label: deepCrumb.space.label, href: deepCrumb.space.href, title: deepCrumb.space.title }]
      : []),
    ...(deepCrumb?.doc ? [{ key: "doc" as const, label: deepCrumb.doc.label, title: deepCrumb.doc.title }] : []),
  ];

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

      {forced === null ? (
        <DocumentNameSearch
          nonce={nonce}
          keyword={query}
          openKey={openSearchDoc}
          sdocLink={sdocLink}
          spaceLink={spaceLink}
          onCommit={commitKeyword}
          onClear={clearKeyword}
        />
      ) : null}

      <Breadcrumbs items={crumbs} />

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
            <CrumbReport.Provider value={reportCrumb}>
            <RefDrill.Provider value={{ open: drilled, toggle: toggleDrill }}>
              {tab === "spaces" ? (
                spaceId === "" ? (
                  <SpacesSurface
                    nonce={nonce}
                    spaceLink={spaceLink}
                    keyword={query}
                    onCommitKeyword={commitKeyword}
                    onClearKeyword={clearKeyword}
                  />
                ) : (
                  <SpaceDetailSurface
                    nonce={nonce}
                    spaceId={spaceId}
                    openDoc={openDoc}
                    docLink={docLink}
                    backLink={backLink}
                    spaceSelfLink={spaceSelfLink}
                    sort={sortCol}
                    dir={sortDir}
                    onSort={applySort}
                    onCloseDoc={closeDocDrawer}
                  />
                )
              ) : null}
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
            </CrumbReport.Provider>
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
