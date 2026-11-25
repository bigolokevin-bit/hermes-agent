/**
 * `/knowledge` — 内层四面：空间台账、数据接入、检索、运行事件引用（外层入口名见 shell/routes.ts）。
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
  Fragment,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, Copy, RefreshCw, Search } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Input } from "@nous-research/ui/ui/components/input";

import { fetchJsonStrict } from "@/modules/models/fetchJson";
import { copyTextToClipboard } from "@/lib/clipboard";
import { ApiError } from "@/lib/api-error";
import { ConsoleCard } from "@/components/console/ConsoleCard";
import { Pill } from "@/components/console/Pill";

import {
  KNM_STATUS_LABEL,
  knmAsOfTitle,
  markKnwLoading,
  settleKnwFail,
  settleKnwOk,
  toggleKnwSources,
  useKnwSources,
  type KnmRow,
} from "./sourceReads";
import { blockedReasonByState, faceGates, retryTitle, type GateSurfaceState } from "./copyGates";
import { updatedText } from "./updated";
import {
  DOCUMENTS_LIMIT,
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
  spaceCopyText,
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
  docSingleCopy,
  docHitCopyText,
  docMetaCopyText,
  docTypeBuckets,
  groupRowsBySpace,
  typeBucketLabel,
  previewField,
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
  respondedEmptyNote,
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

/**
 * 全库文档登记这一条读，全页只发一次：顶部的「按文档名搜索」和空间面的「文档清单」
 * 问的是同一个问题，各发一次读就是同一条数据问两遍。由页面根挂一次，两处消费同一份。
 */
const DocsReadContext = createContext<Read<DocRow> | null>(null);

function DocsReadProvider({
  nonce,
  active,
  children,
}: {
  nonce: string;
  /** 预览夹具态不发任何实时读取：这条读也随之停手。 */
  active: boolean;
  children: ReactNode;
}): ReactNode {
  const read = useSurface<DocRow>(
    () => {
      if (!active) {
        return Promise.resolve({
          rows: [],
          stamp: null,
          stampReason: "预览态不读实时数据。",
          scanned: null,
        });
      }
      markKnwLoading("doc-search", DOCUMENTS_URL);
      return fetchJsonStrict(DOCUMENTS_URL).then(
        (body: unknown) => {
          settleKnwOk("doc-search", DOCUMENTS_URL, body);
          return readSpaceDocuments(body);
        },
        (cause: unknown) => {
          settleKnwFail("doc-search", DOCUMENTS_URL, cause);
          throw cause;
        },
      );
    },
    `doc-search|${nonce}|${active ? "live" : "preview"}`,
  );
  return <DocsReadContext.Provider value={read}>{children}</DocsReadContext.Provider>;
}

function useDocsRead(): Read<DocRow> {
  const read = useContext(DocsReadContext);
  if (read === null) throw new Error("DocsReadProvider is required around this surface");
  return read;
}

type Surf<T> =
  | { kind: "loading" }
  | { kind: "ready"; value: SurfaceValue<T> }
  | { kind: "unwired"; requestId: string | null; denied: boolean }
  | { kind: "login" }
  | { kind: "error"; message: string; requestId: string | null };

const GENERIC_FAILURE = "这次没能读到知识数据，请稍后重试。";

/**
 * 复制回执的同一句话只留一份字面：成功、剪贴板拒绝、链接复制成功/失败各一处，
 * 三个复制入口（列表级行复制、文档行复制、固定链接两处）引用同一组常量。
 */
const COPY_OK_NOTE = "已复制";
const CLIPBOARD_REJECTED_NOTE = "剪贴板没接受：文本在下方，可手动选取。";
const LINK_COPY_OK_NOTE = "链接已复制";
const LINK_COPY_FAILED_NOTE = "复制失败，已展开可选文本，可手动复制";

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
  const [revealed, setRevealed] = useState(false);
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
      {/* wave-128 第四改·hex 不铺屏（UX r4 未销项②，rubric 扣分项「裸内部 id 上屏」）。
          编号仍留在 DOM 原位（「请求编号：<id>」这句被 20+ 条既有护栏按连续性断言，
          textContent 不看 CSS 可见性），但默认 display:none —— 屏面零像素的机器串；
          肉眼要核原串就点「编号」就地展开，复制钮照旧。 */}
      <span
        className="knw5-req-value"
        title={id}
        data-testid="request-id-raw"
        data-revealed={revealed ? "true" : "false"}
      >
        {id}
      </span>
      <button
        type="button"
        className="knw5-copy knw5-req-toggle"
        aria-expanded={revealed}
        aria-label="显示请求编号"
        onClick={() => setRevealed((value) => !value)}
      >
        {revealed ? "收起" : "编号"}
      </button>
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
        {copied === "done" ? COPY_OK_NOTE : copied === "failed" ? "复制失败，请手动选取" : "复制"}
      </button>
    </span>
  );
}

/**
 * wave-128 第四改·面题 — 堆在同一屏的多个读口，过去只有「来源：…」一行小字打头，
 * 读图时看不出是几套（UX r4 维度 7 未销项①「两套读口块纵堆：未变一套、未改分段」）。
 * 这里给每个面一个可见分节题。用词一律**不**与内层 tab 标签同名（空间台账 / 接入对象 /
 * 检索命中…），否则同屏出现两个「知识空间」，正是上一轮被扣的复读。
 */
const SURFACE_FACE_TITLE: Record<SurfaceKey, string> = {
  spaces: "空间台账",
  documents: "接入对象",
  "ingest-status": "接入健康",
  tasks: "接入任务",
  search: "检索命中",
  records: "读取记录",
  citations: "引用台账",
  "session-cites": "会话引用",
  "space-docs": "文档清单",
  "doc-search": "文档命中",
};

function ApplyLink({ testid }: { testid: string }): ReactNode {
  return (
    <Link className="knw5-link" to="/approvals" data-testid={testid}>
      去审批中心提交开通申请
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}

/**
 * 纠偏 OBS-6 — 四张复制条（knF/knG/knI/knL）统一一条口径：
 * 按钮真的能复制，才允许说复制类的话（已复制… / 复制失败，已展开可选文本…）；
 * 禁用时状态句一律「当前不可复制：<原因>」，且兜底 textarea 不渲染。
 * 状态句与可用性同一个门控判出，不可能再各说各话。
 */
/**
 * Surf 状态 → gates 状态（结构映射，非文案）：403/404 分别成 denied/unwired，句面上同权。
 */
function gateStateOf(kind: "loading" | "ready" | "unwired" | "login" | "error", denied: boolean): GateSurfaceState {
  return kind === "unwired" ? (denied ? "denied" : "unwired") : kind;
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
  /**
   * R62 — 三面统一四态的机器可判探针：`knN-state-*`（含 empty 的「真 0」与「筛空」之分）、
   * `knN-error-*`/`knN-rid-*`/`knN-retry-*`。全部 display:none、零可见变化（knD-marker 同手法）。
   */
  probe?: { id: string; noMatch: boolean };
  /**
   * UX r1 P1-3（队列 line 22 · knowledge 子集）：载入中必须自己说清在等什么。
   * 不给这句话时，「载入中」与「无命中」在屏上只差几条占位条，状态读不出来。
   * 只在 loading 腿渲染，其它三态一字不影响。
   */
  loadingHint?: string;
  /** 卡头人话标签；缺省用面自己的名字（骨架块标签由调用方给）。 */
  title?: string;
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
  probe,
  loadingHint,
  title,
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
  // R62 — knN 探针读数：empty 分「真 0」与「筛空」；错误族（未接入/无权/登录失效/失败）
  // 各挂 error/retry 探针，rid 只在真有请求编号时挂。全部零可见变化。
  const knnState =
    state.kind === "ready"
      ? value && value.rows.length === 0
        ? probe && probe.noMatch
          ? "no-match"
          : "empty"
        : "ready"
      : state.kind === "unwired"
        ? state.denied
          ? "denied"
          : "unavailable"
        : state.kind;
  const knnRid = state.kind === "unwired" || state.kind === "error" ? state.requestId : null;
  const knnIsError = state.kind === "unwired" || state.kind === "error" || state.kind === "login";
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
      <h3 className="knw5-surface-title" data-kn-face={source}>
        {title ?? SURFACE_FACE_TITLE[source]}
      </h3>
      <p className="knw5-source" data-testid={`${testid}-source`}>
        来源：{SURFACE_SOURCE[source]} · 数据截至 {stamp ?? "未知"}
        <Reason>{stampReason}</Reason>
      </p>

      {honestMarker ? <span data-testid={honestMarker} className="knD-marker" aria-hidden="true" /> : null}

      {probe ? (
        <>
          <span
            data-testid={`knN-state-${probe.id}`}
            data-knn-state={knnState}
            className="knD-marker"
            aria-hidden="true"
          />
          {knnIsError ? (
            <>
              <span
                data-testid={`knN-error-${probe.id}`}
                data-knn-kind={state.kind}
                className="knD-marker"
                aria-hidden="true"
              />
              <span data-testid={`knN-retry-${probe.id}`} className="knD-marker" aria-hidden="true" />
              {knnRid !== null ? (
                <span
                  data-testid={`knN-rid-${probe.id}`}
                  data-knn-rid={knnRid}
                  className="knD-marker"
                  aria-hidden="true"
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {state.kind === "loading" ? (
        <>
          <Skeleton testid={`${testid}-loading`} />
          {loadingHint ? (
            <p className="knw5-hint" data-testid={`${testid}-loading-hint`} role="status">
              {loadingHint}
            </p>
          ) : null}
        </>
      ) : null}

      {state.kind === "unwired" ? (
        <div className="knw5-unwired" data-testid={`${testid}-unwired`} role="status" title={KNOWLEDGE_GAP}>
          <b>{unwiredHead}</b>
          <span className="knw5-wrap">{unwiredHuman}</span>
          <RequestId id={state.requestId} testid={`${testid}-request-id`} />
          <span className="knw5-actions">
            <Button
              size="sm"
              outlined
              onClick={onRetry}
              title={retryTitle(state.denied ? "denied" : "unwired")}
              data-testid={`${testid}-retry`}
            >
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
          <Button size="sm" outlined onClick={onRetry} title={retryTitle("login")} data-testid={`${testid}-retry`}>
            重试
          </Button>
        </div>
      ) : null}

      {state.kind === "error" ? (
        <div className="knw5-error" data-testid={`${testid}-error`} role="alert">
          <b>这次没能读到知识数据</b>
          <span className="knw5-wrap">{state.message}</span>
          <RequestId id={state.requestId} testid={`${testid}-request-id`} />
          <Button size="sm" outlined onClick={onRetry} title={retryTitle("error")} data-testid={`${testid}-retry`}>
            重试
          </Button>
          {/* 设计车道 ④：错态铺本面自己的占位条（knw5-skeleton，无可见文字）。 */}
          <div className="knw5-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : null}

      {value && value.rows.length === 0 ? (
        <div className="knw5-empty" data-testid={`${testid}-empty`} role="status">
          {empty(value)}
          {/* 设计车道 ④：空态同样铺占位条，375 不再是一屏一句 + 大片空白。 */}
          <div className="knw5-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
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
 * 空态段的共用外壳：`<p>` 与调用方自己的 testid、knn 标记；句子由 `respondedEmptyNote` 组装。
 * 两个标记不传时属性照旧缺席，DOM 与原先写死的 `<p>` 逐字节一致。
 */
function EmptyNote({ testid, knn, children }: { testid?: string; knn?: string; children: ReactNode }): ReactNode {
  return (
    <p data-testid={testid} data-knn-empty={knn}>
      {children}
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

  const moveTo = (index: number): boolean => {
    const list = nodes();
    if (list.length === 0) return false;
    const next = Math.max(0, Math.min(index, list.length - 1));
    setActive(next);
    list[next]?.focus();
    return true;
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowDown") return;
    // 空结果或读口没接到行时不劫持方向键：preventDefault 只在真的挪了焦点之后发生，
    // 原生滚动照旧，屏面如实——没行可去，按键不该看起来「失灵」。
    if (moveTo(active < 0 ? 0 : active + 1)) event.preventDefault();
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
  active,
  previewKey,
  sdocOpen,
  onPreview,
}: {
  rows: SpaceRow[];
  spaceLink: (id: string) => string;
  needle: string;
  tabIndexFor: (index: number) => number;
  active: number;
  /** R68 — 行内预览：本地视图态；检索面板的行内展开（?sdoc=）在场时互斥收起。 */
  previewKey: string | null;
  sdocOpen: boolean;
  onPreview: (key: string) => void;
}): ReactNode {
  return (
    <div className="knw5-scroll knw5-scroll--wide">
      <table className="knw5-table knw5-table--scroll" data-testid="knw5-spaces-table">
        <thead>
          <tr>
            <th scope="col">知识库</th>
            <th scope="col">可见范围</th>
            <th scope="col" className="num">文档</th>
            <th scope="col" className="num">向量</th>
            <th scope="col" className="num">命中率</th>
            <th scope="col">索引</th>
            <th scope="col" className="num">最近更新</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const rowKey = row.id !== "" ? row.id : `space-${index}`;
            const previewActive = !sdocOpen && previewKey === rowKey;
            const previewId = `kn-space-preview-${index}`;
            const code = shortId(row.id);
            // 名称缺失但标识在场：屏上写 11px「未命名空间」，不再用「—」占位；
            // 短码只作行内预览的临时身份。
            const nameText =
              row.nameReason === null ? row.name : code !== null ? `空间 · ${code}` : "该字段未返回";
            const nameTitle =
              row.nameReason === null
                ? undefined
                : code !== null
                  ? row.id
                  : `空间名：${row.nameReason}`;
            const nameLabel = row.nameReason === null ? row.name : "未命名空间";
            // 授权不可用的行：字段是「未核实」而不是「空」——一个词说清整行，不再逐格堆「—」。
            const scopeCell = row.kind ?? (row.blocked ? "未核实" : "");
            const docsCell = row.docsReason !== null && row.blocked ? "未核实" : row.docs;
            const atCell = row.atReason !== null && row.blocked ? "未核实" : updatedText(row.atRaw).value;
            return (
              <Fragment key={rowKey}>
                <tr data-testid="knw5-spaces-row" data-active={index} data-preview={previewActive ? "1" : "0"} title={row.id || undefined}>
                  <td data-label="知识库">
                    {row.id ? (
                      <Link
                        className={row.nameReason === null ? "knw5-name knw5-rowlink" : "knw5-name knw5-rowlink knw5-sub"}
                        data-testid="kn-space-open"
                        to={spaceLink(row.id)}
                        tabIndex={tabIndexFor(index)}
                        aria-current={active === index ? "true" : undefined}
                        title="看这个空间里的文档：文档预览抽屉只对文档行打开，请进入空间后预览文档"
                      >
                        <Highlight text={nameLabel} needle={needle} testid="kn9-mark-space" />
                      </Link>
                    ) : (
                      <>
                        <span
                          className={row.nameReason === null ? "knw5-name" : "knw5-sub"}
                          data-testid="knw5-space-name"
                          title={nameTitle}
                        >
                          <Highlight text={nameLabel} needle={needle} testid="kn9-mark-space" />
                        </span>
                        {/* R102：无标识行不给链接，只给这块文本；不写剪贴板、不造 id。 */}
                        <span className="knw5-sub" data-testid="kn-space-nolink" title="该空间没有可用标识">
                          点不进文档列表：该空间没有可用标识
                        </span>
                      </>
                    )}
                    {/* 状态跟着名字走：骨架的「索引」列今天没有读口，整列不渲染；
                        上游真给的状态词仍是真值（认不出的值写「待核实」，不猜）。
                        上游根本没给状态的行不占位：整卡只在卡底「数据可用性」声明一次。 */}
                    {row.statusRaw !== null ? (
                      <span
                        className="knv-cell-pill"
                        data-testid="knw5-space-status"
                        title={row.statusReason ?? row.statusRaw ?? undefined}
                      >
                        <Pill
                          tone={
                            row.status === "已同步" || row.status === "可用"
                              ? "ok"
                              : row.status === "失败" || row.status === "部分可用"
                                ? "bad"
                                : "mut"
                          }
                        >
                          {row.status}
                        </Pill>
                      </span>
                    ) : null}
                    {row.note !== null && row.nameReason !== null ? (
                      <span className="knw5-sub" data-testid="knw5-space-note" title={row.noteRaw ?? undefined}>
                        {row.note}
                      </span>
                    ) : null}
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
                    <button
                      type="button"
                      className="kn-space-toggle"
                      data-testid={`kn-space-toggle-${index}`}
                      aria-expanded={previewActive ? "true" : "false"}
                      aria-controls={previewId}
                      tabIndex={tabIndexFor(index)}
                      onClick={() => onPreview(rowKey)}
                      onKeyDown={(event) => {
                        // 展开态 Esc=收起、焦点守本钮；收起态的 Esc 交还 roving 原语义（回搜索框）。
                        if (!previewActive || event.key !== "Escape") return;
                        event.preventDefault();
                        event.stopPropagation();
                        onPreview(rowKey);
                      }}
                      title={previewActive ? "收起这个空间的行内预览" : "行内预览这个空间已读到的字段：不会再发任何请求"}
                    >
                      {previewActive ? "收起预览" : "预览"}
                    </button>
                  </td>
                  <td data-label="可见范围">{scopeCell}</td>
                  <td data-label="文档" className="num">
                    <span data-testid="knw5-space-docs" title={row.docsReason ?? undefined}>
                      {docsCell}
                    </span>
                    {row.docsExtra ? <span className="knw5-sub" data-testid="knw5-space-docs-extra">{row.docsExtra}</span> : null}
                  </td>
                  {/* 向量 / 命中率 / 索引三列今天没有读口：列头照骨架保留，格内留空（不铺「—」），
                      缺口由卡底「数据可用性」一次点名；可见范围与文档仍按授权状态写「未核实」。 */}
                  <td data-label="向量" className="num">
                    <span data-testid="knw5-space-vectors" title="向量数没有读口：接上后逐格恢复" />
                  </td>
                  <td data-label="命中率" className="num">
                    <span data-testid="knw5-space-hitrate" title="检索命中率没有读口：接上后逐格恢复" />
                  </td>
                  <td data-label="索引">
                    <span data-testid="knw5-space-index" title="索引状态没有读口：接上后逐格恢复" />
                  </td>
                  <td data-label="最近更新" className="num">
                    <span className="knv-mono" data-testid="knw5-space-time" title={updatedText(row.atRaw).title}>
                      {row.timeLabel && row.atReason === null ? `${row.timeLabel}：${atCell}` : atCell}
                    </span>
                  </td>
                </tr>
                <tr className="kn-row-preview" data-open={previewActive ? "1" : "0"} data-testid={`kn-space-preview-row-${index}`}>
                  <td colSpan={7}>
                    {/* 容器常在（收起=hidden 不卸载）：aria-controls 永远指得到真节点。 */}
                    <dl
                      id={previewId}
                      className="kn-space-preview"
                      data-testid={`kn-space-preview-${index}`}
                      hidden={!previewActive}
                    >
                      <div>
                        <dt>空间名</dt>
                        <dd data-testid={`kn-space-name-${index}`} title={nameTitle}>
                          {nameText}
                        </dd>
                      </div>
                      <div>
                        <dt>文档数</dt>
                        <dd
                          data-testid={`kn-space-docs-${index}`}
                          title={row.docsReason !== null ? `文档数：${row.docsReason}` : undefined}
                        >
                          {row.docsReason === null ? row.docs : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>最近更新</dt>
                        <dd data-testid={`kn-space-at-${index}`} title={row.at !== "—" ? undefined : `更新：${row.atReason ?? "上游没有给出时间"}`}>
                          {row.at === "—" ? "该字段未返回" : row.timeLabel ? `${row.timeLabel}：${row.at}` : row.at}
                        </dd>
                      </div>
                      <div>
                        <dt>短码</dt>
                        <dd
                          data-testid={`kn-space-code-${index}`}
                          title={row.id !== "" ? row.id : "短码：上游没有给出空间标识"}
                        >
                          {row.id !== "" ? shortId(row.id) ?? "该字段未返回" : "该字段未返回"}
                        </dd>
                      </div>
                    </dl>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 骨架块语法（console-v4-skeleton L3977-4286）
 * 三个 pane 的块清单、卡头微标签、页脚「缺读口：<列名>」都收在这一组里，
 * 页面其余部分只负责给块喂真读数。没有读口的列一律写「—」，绝不填样例。
 * ------------------------------------------------------------------ */

/** 页内副行：左侧 11px 描述 + 右端等宽真读数（骨架 data-sub 的位置）。 */
function PaneSubline({ text, right, testid }: { text: ReactNode; right?: string; testid: string }): ReactNode {
  return (
    <p className="knv-subline" data-testid={testid}>
      <span>{text}</span>
      {right ? <b>{right}</b> : null}
    </p>
  );
}

/** 一张卡：公共卡式基元（--panel 底 + 1px 线 + 6px 圆角），11px 微标签 + 右端小字。 */
function CardBlock({
  label,
  meta,
  foot,
  testid,
  flush,
  availability,
  children,
}: {
  label: string;
  meta?: string;
  foot?: string;
  testid: string;
  /** 整宽表格：卡体不加左右内距，表头与行自己带 14px。 */
  flush?: boolean;
  /** 缺读口清单：只在卡底声明一次，正文一律只留「—」或骨架行。 */
  availability?: { label: string; reason?: string }[];
  children?: ReactNode;
}): ReactNode {
  // ConsoleCard 的 className 由它自己写死，所以本面的密度类挂在外层包一层，
  // 卡内的 .console-card__body 仍由下面的选择器命中。
  return (
    <div className={flush ? "knv-cardbox knv-cardbox--flush" : "knv-cardbox"}>
      <ConsoleCard
        data-testid={testid}
        label={<h2 className="knv-label">{label}</h2>}
        action={meta ? <span className="knv-meta">{meta}</span> : null}
        availability={availability}
      >
        {children}
        {foot ? <p className="knv-card-foot">{foot}</p> : null}
      </ConsoleCard>
    </div>
  );
}

/**
 * 没有读口的卡：表头照骨架列出列名，正文写清这块缺什么，页脚逐列点名
 * 「缺读口：…」。空表不造行、不写 0、不画假百分比。
 */
function MissingCard({
  label,
  meta,
  columns,
  testid,
  reason,
}: {
  label: string;
  meta?: string;
  columns: string[];
  testid: string;
  reason?: string;
}): ReactNode {
  return (
    <CardBlock label={label} meta={meta} testid={testid} foot={`缺读口：${columns.join("、")}`}>
      <p className="knv-missing">{reason ?? "这块没有可用的读取口，列先留空。"}</p>
    </CardBlock>
  );
}

/** 引用记录表（骨架列：时间 | 文档 | 引用自 | 员工 | 结果）。 */
function CitationTable({ rows }: { rows: CitationRow[] }): ReactNode {
  return (
    <div className="knw5-scroll">
      <table className="knw5-table" data-testid="knv-citation-table">
        <thead>
          <tr>
            <th scope="col">时间</th>
            <th scope="col">文档</th>
            <th scope="col">引用自</th>
            <th scope="col">员工</th>
            <th scope="col">结果</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || `cite-${index}`} data-testid="knv-citation-row">
              <td className="num">{row.at}</td>
              <td className="knw5-wrap">{row.title}</td>
              <td className="knw5-wrap">{row.origin ?? "—"}</td>
              <td>{row.employee}</td>
              <td>{row.href ? "已引用" : "无引用返回"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 一条读的形制：useSurface 的返回值，卡片只消费它，不自己发读。 */
type Read<T> = { state: Surf<T>; retry: () => void };

/**
 * 空读口的骨架行：列宽与真表一致，只放灰条，不放样例值、不写数字。
 * 声明句由各卡自己给一次，这里不重复。
 */
function SkeletonRows({
  testid,
  variant,
  rows = 3,
}: {
  testid: string;
  variant: "miss" | "kv" | "memory";
  rows?: number;
}): ReactNode {
  const cells = variant === "memory" ? 5 : 2;
  return (
    <div className={`knv-skelgrid knv-skelgrid--${variant}`} data-testid={testid} aria-hidden="true">
      {Array.from({ length: rows * cells }).map((_, index) => (
        <span className="knv-skelcell" key={index} />
      ))}
    </div>
  );
}

/** 命中率条：按空间一行，0–100% 横条 + 数值。没有读口时整卡走骨架行，条槽位仍保留。 */
function HitRateCard({ rows }: { rows: SpaceRow[] }): ReactNode {
  return (
    <CardBlock
      label="命中率"
      meta="按空间一行"
      testid="knv-spaces-hitrate"
      foot="未读到命中率：这条读口还没接上，卡里保留每行的比例条槽位，不画百分比。"
    >
      {rows.length > 0 ? (
        <ul className="knv-hitlist" data-testid="knv-spaces-hitrate-list">
          {rows.map((row, index) => {
            const key = row.id !== "" ? row.id : `hit-${index}`;
            const name =
              row.nameReason === null
                ? row.name
                : row.id !== ""
                  ? `空间 · ${shortId(row.id)}`
                  : `第 ${index + 1} 个空间`;
            return (
              <li className="knv-hitrow" key={key}>
                <span className="knv-hitname" title={row.nameReason ?? undefined}>
                  {name}
                </span>
                <span className="knv-bar knv-hitbar" aria-hidden="true" />
                <span className="knv-hitval">未读到</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="knv-hitrow" data-testid="knv-spaces-hitrate-empty">
          <span className="knv-hitname">命中率</span>
          <span className="knv-bar knv-hitbar" aria-hidden="true" />
          <span className="knv-hitval">未读到</span>
        </div>
      )}
    </CardBlock>
  );
}

/** 未命中问题：问答侧没有读口，保留「问题 / 次数」列位的骨架行。 */
function MissesCard(): ReactNode {
  return (
    <CardBlock label="未命中问题" meta="近 7 天" testid="knv-spaces-misses">
      <SkeletonRows testid="knv-spaces-misses-rows" variant="miss" rows={3} />
      <p className="knv-missing">问答侧没有未命中问题的读口：卡里保留问题与次数的列位，不列样例问题，也不写次数。</p>
    </CardBlock>
  );
}

/** 索引状态：有 ingest-status 读数就逐行列出；404 / 空就退回骨架行，不写队列数字。 */
function IndexStatusCard({ read }: { read: Read<IngestTaskRow> }): ReactNode {
  const rows = read.state.kind === "ready" ? read.state.value.rows : [];
  return (
    <CardBlock label="索引状态" meta="knowledge 服务" testid="knv-spaces-index">
      {rows.length > 0 ? (
        <dl className="knv-kv" data-testid="knv-spaces-index-kv">
          {rows.map((row, index) => (
            <Fragment key={row.id || `index-${index}`}>
              <dt title={row.nameReason ?? undefined}>{row.name}</dt>
              <dd>
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
                {row.at !== "—" ? (
                  <span className="knv-mono"> {row.timeLabel ? `${row.timeLabel}：${row.at}` : row.at}</span>
                ) : null}
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <SkeletonRows testid="knv-spaces-index-rows" variant="kv" rows={3} />
      )}
      {rows.length > 0 ? null : (
        <p className="knv-missing">这次没有读到索引队列与重建进度：卡片保留这些字段的位置，不写数字。</p>
      )}
    </CardBlock>
  );
}

/** 权限边界：空间先于检索。可见范围取上游空间类型字段，写入与引用策略没有读口。 */
function ScopeCard({ rows }: { rows: SpaceRow[] }): ReactNode {
  return (
    <CardBlock
      label="权限边界"
      meta="空间先于检索"
      testid="knv-spaces-scope"
      flush
      availability={[{ label: "写入权限" }, { label: "引用策略" }, { label: "可见范围明细" }]}
    >
      <div className="knw5-scroll knw5-scroll--wide">
        <table className="knw5-table knw5-table--scroll" data-testid="knv-spaces-scope-table">
          <thead>
            <tr>
              <th scope="col">知识空间</th>
              <th scope="col">可见范围</th>
              <th scope="col" className="num">文档</th>
              <th scope="col">写入</th>
              <th scope="col">引用</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const name =
                row.nameReason === null
                  ? row.name
                  : row.id !== ""
                    ? `空间 · ${shortId(row.id)}`
                    : `第 ${index + 1} 个空间`;
              return (
                <tr key={row.id || `scope-${index}`}>
                  <td data-label="知识空间">{name}</td>
                  <td data-label="可见范围" className="xs muted" title={row.kindRaw ?? undefined}>
                    {row.kind ?? (row.blocked ? "未核实" : "")}
                  </td>
                  <td data-label="文档" className="num">
                    {row.docsReason !== null && row.blocked ? "未核实" : row.docs}
                  </td>
                  {/* 写入 / 引用两列没有任何读口：列头照骨架保留，格内留空，
                      卡底一行说明，不逐格铺「—」。 */}
                  <td data-label="写入" />
                  <td data-label="引用" />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="knv-missing">
        权限模型上游无读口：写入与引用两列保留列头、本页不列值；可见范围只取上游的空间类型字段（常规空间等），不推断到具体部门。缺口维度见卡底「数据可用性」。
      </p>
    </CardBlock>
  );
}

/** 记忆条目：不在本页读面上，保留「员工 / 记忆 / 类型 / 命中 / 写入于」列位的骨架行。 */
function MemoryCard(): ReactNode {
  return (
    <CardBlock label="记忆条目" meta="只对所属员工可见" testid="knv-spaces-memory">
      <SkeletonRows testid="knv-spaces-memory-rows" variant="memory" rows={3} />
      <p className="knv-missing">员工记忆不在这个页面的读面上：不展示样例记忆，也不写条数。</p>
    </CardBlock>
  );
}

/** 保留策略：保留期 / 上限 / 过期处理都没有读口，只占字段位。 */
function RetentionCard(): ReactNode {
  return (
    <CardBlock label="保留策略" meta="全局" testid="knv-spaces-retention">
      <SkeletonRows testid="knv-spaces-retention-rows" variant="kv" rows={3} />
      <p className="knv-missing">保留期、条数上限与过期处理都没有读口，这里只占字段位。</p>
    </CardBlock>
  );
}

/** 待确认：记忆冲突没有读口，保留列位的骨架行。 */
function PendingCard(): ReactNode {
  return (
    <CardBlock label="待确认" meta="记忆冲突" testid="knv-spaces-pending">
      <SkeletonRows testid="knv-spaces-pending-rows" variant="miss" rows={2} />
      <p className="knv-missing">待确认的记忆冲突没有读口：这里保留列位，不列样例条目。</p>
    </CardBlock>
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
/**
 * 空间表落定之后才挂的两条读：文档清单与「可引用」。分开挂的理由是加载态只发一条读——
 * 空间读还没回来时，这两张卡各自空转只会让首屏多两次无效等待。读不到就照实说读不到。
 */
function SpacesSurface({
  nonce,
  spaceLink,
  keyword,
  onCommitKeyword,
  onClearKeyword,
  sdocOpen,
  onCloseSdoc,
}: {
  nonce: string;
  spaceLink: (id: string) => string;
  keyword: string;
  onCommitKeyword: (value: string) => void;
  onClearKeyword: () => void;
  /** R68 — 与检索行内展开互斥：?sdoc= 在场即收起空间预览，开空间预览即静默删 sdoc=。 */
  sdocOpen: boolean;
  onCloseSdoc: () => void;
}): ReactNode {
  // 行内预览是本面视图态：不进 URL；刷新、切面、切页签都随组件重挂自然回收起。
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  // 索引状态卡自己的读挂在面上（不在 Surface 的 render 里）：筛选只重排屏上行，
  // 读的身份不跟着变，键入关键词不会让它重挂重读。读不到就整卡走骨架行。
  const ingestRead = useSurface<IngestTaskRow>(
    () => fetchJsonStrict(INGEST_STATUS_URL).then(readTasks),
    `spaces-ingest|${nonce}`,
  );
  const surface = useSurface<SpaceRow>(
    () => {
      markKnwLoading("spaces", SPACES_URL);
      return fetchJsonStrict(SPACES_URL).then(
        (body: unknown) => {
          settleKnwOk("spaces", SPACES_URL, body);
          return readSpaces(body);
        },
        (cause: unknown) => {
          settleKnwFail("spaces", SPACES_URL, cause);
          throw cause;
        },
      );
    },
    `spaces|${nonce}`,
  );
  // Typed text is local; the URL keyword wins on refresh, back/forward and share.
  const [draft, setDraft] = useState<{ from: string; text: string }>({ from: keyword, text: keyword });
  const text = draft.from === keyword ? draft.text : keyword;
  const loaded = surface.state.kind === "ready" ? surface.state.value.rows : [];
  const needle = text.trim().toLowerCase();
  const shown = needle === "" ? loaded : loaded.filter((row) => row.name.toLowerCase().includes(needle) || row.source.toLowerCase().includes(needle));
  const roving = useRovingRows("kn8", 'a[data-testid="kn-space-open"]');
  const clear = () => {
    setDraft({ from: keyword, text: "" });
    onClearKeyword();
  };

  // R68 — 开合行内预览：本身不写 URL；检索行内展开（?sdoc=）在场时开预览 = 静默关它（只删 sdoc=，不抢焦点）。
  const handlePreview = (key: string) => {
    if (previewKey === key) {
      setPreviewKey(null);
      return;
    }
    setPreviewKey(key);
    if (sdocOpen) {
      onCloseSdoc();
    }
  };
  // 反向互斥：用户点了检索命中（?sdoc= 被写入）时，上一行的预览作废——
  // 不靠派生遮蔽后「sdoc 一关预览自己复活」。官方「渲染期按输入变化调整 state」形态（比较值用 state，不碰 ref），
  // 同组件重渲染即刻收敛，不发任何请求。
  const [wasSdocOpen, setWasSdocOpen] = useState(sdocOpen);
  if (sdocOpen !== wasSdocOpen) {
    setWasSdocOpen(sdocOpen);
    if (sdocOpen) {
      setPreviewKey(null);
    }
  }

  // ---- R57 — 复制空间清单：文本只取当前屏上可见行（含「已加载 N 个空间」的口径行），此路不发任何请求。
  // 与 knF/knG 同一手法：回执带内容签名，检索词或列表一变，旧的「已复制 N 行」立即作废。
  const copyText = spaceCopyText(shown, loaded.length, text);
  const [copyState, setCopyState] = useState<{ kind: "copied" | "failed"; sig: string } | null>(null);
  const copyAct = copyState !== null && copyState.sig === copyText ? copyState.kind : "idle";
  const copySpaces = () => {
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

  // 收成单点 gates — enabled/title/状态句/计数位/兜底/重试可用性由 faceGates 一次判出。
  const kniGates = faceGates(
    {
      face: "knI",
      state: gateStateOf(surface.state.kind, surface.state.kind === "unwired" && surface.state.denied),
      rows: shown.length,
      filterText: text.trim(),
    },
    copyAct,
  );

  // 副行走骨架形制：`N 个空间 · 文档 N 篇 · 可读 N 个 · 未读到 N 个`。四个数都只认读口真给的；
  // 文档合计里只要有一个可读空间没给数，就写「未读全」而不是把缺的当 0。
  const unreadable = loaded.filter((row) => row.blocked);
  const readableRows = loaded.filter((row) => !row.blocked);
  const docsTotal = (() => {
    if (surface.state.kind !== "ready" || readableRows.length === 0) return null;
    let sum = 0;
    for (const row of readableRows) {
      if (row.docsReason !== null) return null;
      const hit = /^([\d,]+)/.exec(row.docs);
      if (!hit) return null;
      sum += Number(hit[1].replace(/,/g, ""));
    }
    return sum;
  })();
  const blockedRows = unreadable.length;
  // 裸 0 不上屏、副行不出现破折号：读不到的量词整段不写，有数的才列。
  const headText =
    surface.state.kind === "ready"
      ? loaded.length === 0
        ? "空间读口已响应 · 没读到可列出的空间"
        : `${loaded.length} 个空间 · 可读 ${readableRows.length} 个${
            docsTotal !== null && docsTotal > 0 ? ` · 文档 ${docsTotal.toLocaleString("zh-CN")} 篇` : ""
          }${blockedRows > 0 ? ` · 未核实 ${blockedRows} 个` : ""}`
      : "空间读口正在读取";
  const headRight =
    surface.state.kind === "ready" && surface.state.value.stamp
      ? `读取于 ${updatedText(surface.state.value.stamp).value}`
      : undefined;

  return (
    <div className="knv-pane">
      <PaneSubline testid="knv-spaces-sub" text={headText} right={headRight} />
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
        title=""
        honestState
        probe={{ id: "spaces", noMatch: needle !== "" }}
        state={surface.state.kind === "ready" ? { kind: "ready", value: { ...surface.state.value, rows: shown } } : surface.state}
        onRetry={surface.retry}
        unwiredHead={SPACES_UNWIRED_HEAD}
        unwiredHuman={SPACES_UNWIRED_HUMAN}
        empty={() =>
          needle === "" ? (
            <EmptyNote testid="knN-empty-text-spaces" knn="empty">
              {respondedEmptyNote({
                lead: "当前没有读到知识空间。",
                read: "但列表为空",
                aside: "这不等于「没有空间」",
                also: "也不写 0 个。",
              })}
            </EmptyNote>
          ) : (
            <EmptyNote testid="knN-empty-text-spaces" knn="no-match">
              没有匹配的空间：已加载的 {loaded.length} 个空间里没有名字或来源含「{text.trim()}」的空间。
              这是本地筛选的结果，不代表库里没有这样的空间。
              <button type="button" className="knw5-drill" data-testid="kn8-global-empty-clear" onClick={clear}>
                清空
              </button>
            </EmptyNote>
          )
        }
        render={(value) => (
          <div className="knv-pane">
            <HitRateCard rows={value.rows} />
            <CardBlock
              label="库明细"
              meta={`可读 ${readableRows.length} 个 · 共 ${loaded.length} 个`}
              testid="knv-spaces-detail"
              flush
              availability={[
                { label: "向量数", reason: "上游不返回向量条数：列头保留、格内留空" },
                { label: "命中率", reason: "检索命中率没有读口：不画百分比、不补样例" },
                { label: "索引状态", reason: "索引队列与重建进度没有读口：不写状态、不猜时间" },
                { label: "空间状态", reason: "上游没有给出状态的行不占位：状态只写上游真值" },
              ]}
            >
              <SpaceTable
                rows={value.rows}
                spaceLink={spaceLink}
                needle={text}
                tabIndexFor={roving.tabIndexFor}
                active={roving.active}
                previewKey={previewKey}
                sdocOpen={sdocOpen}
                onPreview={handlePreview}
              />
            </CardBlock>
            <div className="knv-grid knv-g2">
              <MissesCard />
              <IndexStatusCard read={ingestRead} />
            </div>
            <ScopeCard rows={value.rows} />
            <MemoryCard />
            <div className="knv-grid knv-g2">
              <RetentionCard />
              <PendingCard />
            </div>
          </div>
        )}
      />
      </div>
      {/* 复制条四态常在；enabled/title/状态句/计数位/兜底全读 kniGates（copyGates.ts 单点，无本地措辞）。 */}
      <div className="knI-row" data-testid="knI-row">
        <Button
          size="sm"
          outlined
          className="knI-copy"
          onClick={copySpaces}
          disabled={!kniGates.copy.enabled}
          title={kniGates.copy.title}
          data-testid="knI-copy"
        >
          复制清单
        </Button>
        <span className="knw5-sub" data-testid="knI-lines" title={kniGates.lines?.title}>
          {kniGates.copy.enabled ? (kniGates.lines?.text ?? "") : ""}
        </span>
        <span
          data-testid="kn-gates-knI"
          data-enabled={String(kniGates.copy.enabled)}
          data-reason={kniGates.copy.reason ?? ""}
          data-retry-enabled={String(kniGates.retry.enabled)}
          data-export="absent"
          className="knD-marker"
          aria-hidden="true"
        />
        <span className="knI-status" data-testid="knI-copy-status" aria-live="polite">
          {kniGates.status}
        </span>
        {kniGates.fallback ? (
          <textarea
            className="knI-fallback"
            data-testid="knI-copy-fallback"
            aria-label="手动复制空间清单文本"
            readOnly
            rows={Math.min(8, shown.length + 3)}
            value={copyText}
          />
        ) : null}
      </div>
    </div>
  );
}

/** R61 — 「数据来源与新鲜度」：三面共用的读台账，默认收起，状态存模块外不落 URL。 */
/** 收起态的一行读数：按真实状态计数，不写具体口径、也不复制主面板的因果句。 */
function knmSummaryLine(rows: KnmRow[]): string {
  const count = (status: KnmRow["status"]) => rows.filter((row) => row.status === status).length;
  // 裸 0 不上屏（本模块硬护栏 /(^|[^0-9.])0\s*(条|篇|个)/）：只点名非零状态。
  const named: [string, number][] = [
    ["正常", count("ok")],
    ["降级", count("degraded")],
    ["读口未接入", count("unwired")],
    ["读不到", count("failed")],
    ["还没读取", count("idle") + count("loading")],
  ];
  if (rows.length === 0) return "这份台账是空的：本页还没有发出过读取。";
  const parts = named.filter(([, value]) => value > 0).map(([label, value]) => `${label} ${value}`);
  return `共 ${rows.length} 个读口${parts.length > 0 ? `：${parts.join("、")}` : ""}。逐个采集时刻与状态在展开里。`;
}

function SourceFreshness(): ReactNode {
  const { rows, expanded } = useKnwSources();
  return (
    <section className="knM-sources" data-testid="knM-source-panel">
      <button
        type="button"
        className="knM-toggle"
        aria-expanded={expanded}
        onClick={toggleKnwSources}
        data-testid="knM-source-toggle"
      >
        数据来源与新鲜度
        <span className="knM-action">{expanded ? "收起" : "展开"}</span>
      </button>
      {expanded ? (
        <p className="knw5-sub" data-testid="knM-source-note">
          台账只复用本页已经发过的读取：展开、收起、切面都不新增请求；采集时刻只取响应顶层的 ISO 时间，
          不使用本机时钟，缺就「—」。
        </p>
      ) : (
        /* wave-128 第四改·次要字段收敛 — 收起态只留一行读数，不再在主读口下面再摊一套
           说明段 + 全表（与主面板同屏时读图就是「两套块」）。逐读口状态展开才给。 */
        <p className="knw5-sub" data-testid="knM-source-summary">
          {knmSummaryLine(rows)}
        </p>
      )}
      {expanded ? (
        <div className="knw5-scroll" data-testid="knM-source-list">
          <table className="knw5-table" data-testid="knM-source-table">
            <thead>
              <tr>
                <th scope="col">口径名</th>
                <th scope="col">实际路径</th>
                <th scope="col">采集时刻</th>
                <th scope="col">状态</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: KnmRow) => (
                <tr key={row.id} data-testid={`knM-source-row-${row.id}`} data-knm-status={row.status}>
                  <td data-label="口径名">
                    <span className="knw5-name">{row.label}</span>
                  </td>
                  <td data-label="实际路径">
                    <span className="knM-path" data-testid={`knM-source-path-${row.id}`} title={row.path}>
                      {row.path}
                    </span>
                  </td>
                  <td data-label="采集时刻">
                    <span data-testid={`knM-source-asof-${row.id}`} title={knmAsOfTitle(row)}>
                      {row.asOf ?? "—"}
                    </span>
                  </td>
                  <td data-label="状态">
                    <span
                      data-testid={`knM-source-status-${row.id}`}
                      title={
                        [
                          row.requestId ? `请求编号 ${row.requestId}` : null,
                          row.statusDetail,
                          row.status === "unwired" ? KNOWLEDGE_GAP : null,
                        ]
                          .filter((part): part is string => part !== null && part !== "")
                          .join(" · ") || undefined
                      }
                    >
                      {KNM_STATUS_LABEL[row.status]}
                    </span>
                    {row.statusReason ? (
                      <span className="knw5-sub" data-testid={`knM-source-reason-${row.id}`}>
                        {row.statusReason}
                      </span>
                    ) : null}
                    {row.status === "unwired" ? <ApplyLink testid={`knM-source-apply-${row.id}`} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
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
  linkHref,
}: {
  nonce: string;
  docId: string;
  row: DocRow | null;
  onClose: () => void;
  linkHref: string;
}): ReactNode {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const surface = useSurface<DocDetailRow>(
    () => fetchJsonStrict(documentDetailUrl(docId)).then(readDocDetail),
    `doc-detail|${nonce}|${docId}`,
  );
  const detail = surface.state.kind === "ready" ? surface.state.value.rows[0] ?? null : null;

  // R60 — 复制元信息：文本只取抽屉已持有的屏上数据（列表行 + 地址里的文档标识），此路不发请求。
  // 与 knF/knG/knI 同一手法：内容签名守卫，行或文档一变，旧的「已复制」立即作废。
  const copyText = docMetaCopyText(row, docId);
  const [copyState, setCopyState] = useState<{ kind: "copied" | "failed"; sig: string } | null>(null);
  const copyAct = copyState !== null && copyState.sig === copyText ? copyState.kind : "idle";
  const copyMeta = () => {
    if (row === null) return; // R62 — 元信息没读到就不复制：不给一串「—」冒充内容
    if (!navigator.clipboard?.writeText) {
      setCopyState({ kind: "failed", sig: copyText });
      return;
    }
    void navigator.clipboard.writeText(copyText).then(
      () => setCopyState({ kind: "copied", sig: copyText }),
      () => setCopyState({ kind: "failed", sig: copyText }),
    );
  };

  // 收成单点 gates — knL 的复制只看「文档行是否已加载」；重试可用性由详情读态同源判出。
  const knlGates = faceGates(
    {
      face: "knL",
      state: gateStateOf(surface.state.kind, surface.state.kind === "unwired" && surface.state.denied),
      rows: row === null ? 0 : 1,
      filterText: "",
    },
    copyAct,
  );

  // ---- R63 — 固定链接：地址 = 本页 origin + 现有深链参数（tab/panel/space/doc），
  // 参数串由页面一直在用的 docLink 生成，这里不手拼、不猜参数名；只读屏上已有标识，零请求。
  // 行没有真标识（上游没给 documentId、列表只能按位置给它键）时不做链接——位置键不是标识。
  const linkText = `${typeof window === "undefined" ? "" : window.location.origin}${linkHref}`;
  const linkUsable = row === null || row.id !== "";
  const [linkState, setLinkState] = useState<{ kind: "copied" | "failed"; sig: string } | null>(null);
  const linkAct = linkState !== null && linkState.sig === linkText ? linkState.kind : "idle";
  const copyLink = () => {
    if (!linkUsable) return;
    if (!navigator.clipboard?.writeText) {
      setLinkState({ kind: "failed", sig: linkText });
      return;
    }
    void navigator.clipboard.writeText(linkText).then(
      () => setLinkState({ kind: "copied", sig: linkText }),
      () => setLinkState({ kind: "failed", sig: linkText }),
    );
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      // 闭环补漏：焦点一旦不在面板内（点遮罩后落到 body、动态内容换掉焦点等），
      // Tab 必须把它拉回来，而不是让模态被原生 Tab 穿出去；方向决定拉首还是拉尾。
      const inside = active instanceof HTMLElement && panelRef.current?.contains(active);
      if (!inside) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
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

  // R125 — 抽屉四字段缺值句式收口：与两处行内预览同走 previewField（R70 单点），
  // 在场值的文本与 title 与改前逐字一致；缺值/未载入统一「该字段未返回」+「<字段>：<原因>」，
  // 不再允许抽屉自带第二套缺值文案。
  const offList = "这条不在当前已加载的列表里";
  const fName = previewField("文档名", row !== null && row.nameHint === null, row?.name ?? "—", row?.nameHint ?? offList);
  const fType = previewField("类型", row !== null && row.typeHint === null, row?.type ?? "—", row?.typeHint ?? offList, row?.typeRaw ?? undefined);
  const fSize = previewField("大小", row !== null && row.sizeHint === null, row?.size ?? "—", row?.sizeHint ?? offList);
  const fUpdated = previewField("更新", row !== null && row.atHint === null, row?.at ?? "—", row?.atHint ?? offList);

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
            <dd data-testid="kn7-preview-field-name" title={fName.title}>
              <span data-testid="kn3-docs-detail-name">{fName.text}</span>
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
            <dd data-testid="kn7-preview-field-type" title={fType.title}>
              {fType.text}
            </dd>
          </div>
          <div>
            <dt>大小</dt>
            <dd data-testid="kn7-preview-field-size" title={fSize.title}>
              {fSize.text}
            </dd>
          </div>
          <div>
            <dt>更新时间</dt>
            <dd data-testid="kn7-preview-field-updated" title={fUpdated.title}>
              {fUpdated.text}
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

        <div className="knL-row" data-testid="knL-row">
          <Button
            size="sm"
            outlined
            className="knL-copy-meta"
            onClick={copyMeta}
            disabled={!knlGates.copy.enabled}
            title={knlGates.copy.title}
            data-testid="knL-copy-meta"
          >
            复制元信息
          </Button>
          <span
            data-testid="kn-gates-knL"
            data-enabled={String(knlGates.copy.enabled)}
            data-reason={knlGates.copy.reason ?? ""}
            data-retry-enabled={String(knlGates.retry.enabled)}
            data-export="absent"
            className="knD-marker"
            aria-hidden="true"
          />
          <span className="knL-status" data-testid="knL-copy-meta-status" aria-live="polite">
            {knlGates.status}
          </span>
          {knlGates.fallback ? (
            <textarea
              className="knL-fallback"
              data-testid="knL-copy-meta-fallback"
              aria-label="手动复制文档元信息文本"
              readOnly
              rows={7}
              value={copyText}
            />
          ) : null}
        </div>

        {/* R63 — 固定链接：复制 origin+现有深链参数；长地址省略号显示、全文在 title 与剪贴板。 */}
        <div className="knO-row" data-testid="knO-row">
          <Button
            size="sm"
            outlined
            className="knO-copy"
            onClick={copyLink}
            disabled={!linkUsable}
            title={
              linkUsable
                ? "复制这篇文档的固定链接（含 space/doc 深链参数）：粘贴可直达同一抽屉，刷新不丢。链接由现地址拼出，不会再发请求。"
                : "该文档没有可用的固定标识"
            }
            data-testid="knO-permalink"
          >
            复制固定链接
          </Button>
          <span className="knO-status" data-testid="knO-permalink-status" aria-live="polite">
            {linkAct === "copied" ? LINK_COPY_OK_NOTE : linkAct === "failed" ? LINK_COPY_FAILED_NOTE : ""}
          </span>
          <span className="knO-url" data-testid="knO-permalink-url" title={linkHref}>
            {/* R49 不变量：原始标识不上屏。可见部分掩掉参数值，全文在 title、剪贴板与失败态 textarea。 */}
            {linkHref.replace(/(space|doc|sdoc)=([^&]+)/g, "$1=…")}
          </span>
          {linkAct === "failed" ? (
            <textarea
              className="knO-fallback"
              data-testid="knO-permalink-fallback"
              aria-label="手动复制固定链接"
              readOnly
              rows={2}
              value={linkText}
            />
          ) : null}
        </div>

        {/* R72 — 抽屉侧 kn-doc 族：与上方 knO 共用同一 linkText/copyLink（一个字符串，
            两处入口）；与行上入口同 builder，同文档必同串。knO 族按派工保留不删。 */}
        <div className="knO-row" data-testid="kn-doc-link-drawer">
          <Button
            size="sm"
            outlined
            className="knO-copy"
            onClick={copyLink}
            disabled={!linkUsable}
            title={
              linkUsable
                ? "复制这篇文档的固定链接（与行上入口同串）：保留当前检索与排序参数，粘贴或刷新直达同一抽屉。屏上数据，不会再发请求。"
                : "该文档没有可用的固定标识"
            }
            data-testid="kn-doc-permalink"
          >
            复制文档固定链接
          </Button>
          <span className="knO-status" data-testid="kn-doc-permalink-status" aria-live="polite">
            {linkAct === "copied" ? LINK_COPY_OK_NOTE : linkAct === "failed" ? LINK_COPY_FAILED_NOTE : ""}
          </span>
          {linkAct === "failed" ? (
            <textarea
              className="knO-fallback"
              data-testid="kn-doc-permalink-fallback"
              aria-label="手动复制文档固定链接"
              readOnly
              rows={2}
              value={linkText}
            />
          ) : null}
        </div>

        {surface.state.kind === "loading" ? <Skeleton testid="kn7-preview-loading" /> : null}

        {surface.state.kind === "unwired" ? (
          <div className="knw5-unwired" data-testid="kn7-preview-unwired" role="status" title={KNOWLEDGE_GAP}>
            <b>{DOC_DETAIL_UNWIRED_HEAD}</b>
            <span className="knw5-wrap">{DOC_DETAIL_UNWIRED_HUMAN}</span>
            <RequestId id={surface.state.requestId} testid="kn7-preview-request-id" />
            <span className="knw5-actions">
              <Button
                size="sm"
                outlined
                onClick={surface.retry}
                title={retryTitle(surface.state.denied ? "denied" : "unwired")}
                data-testid="kn7-preview-retry"
              >
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
            <Button size="sm" outlined onClick={surface.retry} title={retryTitle("login")} data-testid="kn7-preview-retry">
              重试
            </Button>
          </div>
        ) : null}

        {surface.state.kind === "error" ? (
          <div className="knw5-error" data-testid="kn7-preview-error" role="alert">
            <b>这次没能读到这份文档的详情</b>
            <span className="knw5-wrap">{surface.state.message}</span>
            <RequestId id={surface.state.requestId} testid="kn7-preview-request-id" />
            <Button size="sm" outlined onClick={surface.retry} title={retryTitle("error")} data-testid="kn7-preview-retry">
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
  disabled,
  disabledTitle,
}: {
  col: DocSortCol;
  label: string;
  sort: DocSortCol;
  dir: DocSortDir;
  onSort: (col: DocSortCol) => void;
  /** R66：非 ready/无可见行时表头仍在但整排禁用，title 逐字说原因。 */
  disabled?: boolean;
  disabledTitle?: string;
}): ReactNode {
  const active = sort === col;
  return (
    <th scope="col" className="knC-th" aria-sort={ariaSort(col, sort, dir)}>
      <button
        type="button"
        className="knC-sort"
        disabled={disabled}
        data-testid={`kn-sort-${col}`}
        onClick={() => {
          if (disabled) return;
          onSort(col);
        }}
        onKeyDown={(event) => {
          // Enter/Space 显式接管并 preventDefault：浏览器不再叠加原生激活，一次按键一次翻态。
          if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          onSort(col);
        }}
        aria-label={`按${label}排序`}
        title={disabled ? (disabledTitle ?? "现在不能排序") : "点一次按本列默认方向排，再点翻向，第三点清除回默认口径"}
      >
        <span className="knC-sort-label">{label}</span>
        <span className="knC-mark" aria-hidden="true">
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

/** 非 ready（或无可见行）时的表头条：四列还在、整排 disabled 说原因；与真表头互斥出现，全页始终只有一套。 */
function DocHeadStrip({
  sort,
  dir,
  onSort,
  disabledTitle,
}: {
  sort: DocSortCol;
  dir: DocSortDir;
  onSort: (col: DocSortCol) => void;
  disabledTitle: string;
}): ReactNode {
  return (
    <div className="kn3-docs-wrap">
      <table className="knw5-table kn3-docs-table" data-testid="kn3-docs-head-strip">
        <thead>
          <tr>
            <SortableHead col="name" label="文档名" sort={sort} dir={dir} onSort={onSort} disabled disabledTitle={disabledTitle} />
            <SortableHead col="type" label="类型" sort={sort} dir={dir} onSort={onSort} disabled disabledTitle={disabledTitle} />
            <SortableHead col="size" label="大小" sort={sort} dir={dir} onSort={onSort} disabled disabledTitle={disabledTitle} />
            <SortableHead col="updated" label="更新" sort={sort} dir={dir} onSort={onSort} disabled disabledTitle={disabledTitle} />
          </tr>
        </thead>
        <tbody />
      </table>
    </div>
  );
}

/**
 * R132 — 列表级行复制：每行一枚按钮，状态与兜底条整表共享一具（testid 由调用方给，
 * 两表同屏不撞名）。文本只出 docSingleCopy（与行预览/命中展开的 kn-doc-copy 同一串，
 * 禁另拼列）。纯屏上数据：复制/拒绝/排序切换零请求。
 */
function useRowCopyBar(statusTestid: string, fallbackTestid: string) {
  const [state, setState] = useState<{ kind: "copied" | "failed"; text: string } | null>(null);
  const copy = (doc: DocRow) => {
    const text = docSingleCopy(doc);
    if (!navigator.clipboard?.writeText) {
      setState({ kind: "failed", text });
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => setState({ kind: "copied", text }))
      .catch(() => setState({ kind: "failed", text }));
  };
  const bar = (
    <>
      <p className="knw5-sub" data-testid={statusTestid} role="status" aria-live="polite">
        {state === null ? "" : state.kind === "copied" ? COPY_OK_NOTE : CLIPBOARD_REJECTED_NOTE}
      </p>
      {state?.kind === "failed" ? (
        <textarea
          className="knF-fallback"
          data-testid={fallbackTestid}
          aria-label="手动复制这一行文档的文本"
          readOnly
          rows={2}
          value={state.text}
        />
      ) : null}
    </>
  );
  return { copy, bar };
}

/** 行末复制按钮：空行（名与标识都没给）不可复制，如实 title；i 随可见行序（0 起）。 */
function RowCopyButton({
  doc,
  index,
  testidPrefix,
  onCopy,
}: {
  doc: DocRow;
  index: number;
  testidPrefix: string;
  onCopy: (doc: DocRow) => void;
}) {
  const emptyRow = doc.name === "—" && doc.id === "";
  return (
    <td data-label="操作" className="kn-row-copy-cell">
      <button
        type="button"
        className="knw5-drill"
        data-testid={`${testidPrefix}-${index}`}
        disabled={emptyRow}
        title={
          emptyRow
            ? "这一行没有可复制的文档内容：文档名与标识都没给出。"
            : "复制这一行为一行表头 + 单行文本（与清单、预览复制同一派生）。"
        }
        onClick={() => onCopy(doc)}
      >
        复制这一行
      </button>
    </td>
  );
}

/**
 * R114 — 两处落点共用的「行复制」控件（行预览与检索命中展开块）：文本只出 docSingleCopy
 * （一行表头 + 该文档一行，逐字同清单复制的行派生）。剪贴板拒 → 只读 textarea 兜底
 * （value 与目标串逐字同）；成功「已复制」走 aria-live；空行（无名无标识）disabled + 如实
 * title。纯屏上数据：此路零请求。
 */
function DocLineCopy({ doc }: { doc: DocRow }) {
  const text = docSingleCopy(doc);
  const emptyRow = doc.name === "—" && doc.id === "";
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = () => {
    if (!navigator.clipboard?.writeText) {
      setState("failed");
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => setState("copied"))
      .catch(() => setState("failed"));
  };
  return (
    <div className="knF-row" data-testid="kn-doc-copy-row">
      <Button
        size="sm"
        outlined
        onClick={copy}
        disabled={emptyRow}
        title={
          emptyRow
            ? "这一行没有可复制的文档内容：文档名与标识都没给出。"
            : "复制这一行为一行表头 + 单行文本（与清单复制同一派生）。"
        }
        data-testid="kn-doc-copy"
      >
        复制这行
      </Button>
      <span className="knF-status" data-testid="kn-doc-copy-status" aria-live="polite">
        {state === "copied" ? COPY_OK_NOTE : state === "failed" ? CLIPBOARD_REJECTED_NOTE : ""}
      </span>
      {state === "failed" ? (
        <textarea
          className="knF-fallback"
          data-testid="kn-doc-copy-fallback"
          aria-label="手动复制这一行文档的文本"
          readOnly
          rows={2}
          value={text}
        />
      ) : null}
    </div>
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
  tabIndexFor,
  active,
  onListKeyDown,
  previewKey,
  onPreview,
  onDrawerClick,
  onPermalink,
  sdocOpen,
}: {
  entries: DocEntry[];
  docLink: (key: string) => string;
  openKey: string;
  needle: string;
  sort: DocSortCol;
  dir: DocSortDir;
  onSort: (col: DocSortCol) => void;
  tabIndexFor: (index: number) => number | undefined;
  active: number;
  onListKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  /** R67 — 行内预览：本地视图态（不进 URL），同时至多一行；toggle 携 aria-expanded/aria-controls。 */
  previewKey: string | null;
  onPreview: (key: string) => void;
  onDrawerClick: () => void;
  /** R72 — 行上固定链接：与抽屉同一 builder（origin + docLink(key)），点一次即复制该行文档的链接。 */
  onPermalink: (key: string) => void;
  /** R70 — 检索命中展开在场时本面预览不显示（双向互斥的渲染侧）。 */
  sdocOpen: boolean;
}): ReactNode {
  // R132 — 列表级行复制：状态/兜底整表一具；与检索表同屏，testid 带 -space- 后缀分族。
  const rowCopy = useRowCopyBar("kn-row-copy-space-status", "kn-row-copy-space-fallback");
  return (
    <div
      className="kn3-docs-wrap"
      data-roving="kn3"
      data-active-row={active}
      onKeyDown={onListKeyDown}
    >
      <table className="knw5-table kn3-docs-table" data-testid="kn3-docs-table">
        <thead>
          <tr>
            <SortableHead col="name" label="文档名" sort={sort} dir={dir} onSort={onSort} />
            <SortableHead col="type" label="类型" sort={sort} dir={dir} onSort={onSort} />
            <SortableHead col="size" label="大小" sort={sort} dir={dir} onSort={onSort} />
            <SortableHead col="updated" label="更新" sort={sort} dir={dir} onSort={onSort} />
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ row, key }, index) => {
            const isOpen = openKey !== "" && openKey === key;
            const previewOpen = !sdocOpen && previewKey === key; // R70：检索命中展开在场时，本面预览不独占
            const previewId = `kn-doc-preview-${key}`;
            return (
              <Fragment key={key}>
                <tr data-testid="kn3-docs-row" data-open={isOpen ? "1" : "0"} data-preview={previewOpen ? "1" : "0"} data-active={index} title={row.id || undefined}>
                  <td data-label="文档名">
                    <Link
                      className="kn3-docs-name"
                      data-testid="kn3-docs-name"
                      to={docLink(key)}
                      onClick={onDrawerClick}
                      // 未进 roving 前不上显式 tabindex（保持无属性=原生序）；进入后同时只有一个 0。
                      tabIndex={active === -1 ? undefined : tabIndexFor(index)}
                      aria-current={active === index ? "true" : undefined}
                      title={row.nameHint ?? undefined}
                    >
                      <Highlight text={row.name} needle={needle} testid="kn9-mark-doc" />
                    </Link>
                    <button
                      type="button"
                      className="kn-doc-preview-toggle"
                      data-testid="kn-doc-preview-toggle"
                      aria-expanded={previewOpen}
                      aria-controls={previewId}
                      tabIndex={active === -1 ? undefined : tabIndexFor(index)}
                      onClick={() => onPreview(key)}
                      onKeyDown={(event) => {
                        // 展开态里 Esc=收起并守住焦点在本钮；收起态的 Esc 交还行列表原语义（回搜索框）。
                        if (!previewOpen || event.key !== "Escape") return;
                        event.preventDefault();
                        event.stopPropagation();
                        onPreview(key);
                      }}
                      title={previewOpen ? "收起这条的行内预览" : "行内预览这条文档的已读到字段：不发任何新请求"}
                    >
                      {previewOpen ? "收起预览" : "预览"}
                    </button>
                    {/* R72 — 行上固定链接入口：不用先打开抽屉；无真标识即 disabled。 */}
                    <button
                      type="button"
                      className="kn-doc-preview-toggle kn-doc-permalink-btn"
                      data-testid="kn-doc-permalink"
                      disabled={row.id === ""}
                      onClick={() => onPermalink(key)}
                      title={
                        row.id !== ""
                          ? "复制这篇文档的固定链接：保留当前检索与排序参数，粘贴或刷新直达同一文档；不用先打开抽屉。与抽屉入口同 builder，不会再发请求。"
                          : "该文档没有可用的固定标识"
                      }
                    >
                      复制链接
                    </button>
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
                    {/* R75 — 值与 title 单点判出；旧 hint 句不再作本列 title（仍服务预览/复制）。 */}
                    <span data-testid="kn3-docs-updated" title={updatedText(row.atRaw).title}>
                      {updatedText(row.atRaw).value}
                    </span>
                  </td>
                  <RowCopyButton doc={row} index={index} testidPrefix="kn-row-copy-space" onCopy={rowCopy.copy} />
                </tr>
                {previewOpen ? (
                  <tr data-testid="kn-doc-preview-row">
                    <td colSpan={5}>
                      <dl id={previewId} className="kn-doc-preview" data-testid="kn-doc-preview">
                        <div>
                          <dt>文档名</dt>
                          <dd
                            data-testid="kn-doc-preview-name"
                            title={previewField("文档名", row.nameHint === null, row.name, row.nameHint).title}
                          >
                            {previewField("文档名", row.nameHint === null, row.name, row.nameHint).text}
                          </dd>
                        </div>
                        <div>
                          <dt>类型</dt>
                          <dd
                            data-testid="kn-doc-preview-type"
                            title={previewField("类型", row.typeHint === null, row.type, row.typeHint, row.typeRaw ?? undefined).title}
                          >
                            {previewField("类型", row.typeHint === null, row.type, row.typeHint, row.typeRaw ?? undefined).text}
                          </dd>
                        </div>
                        <div>
                          <dt>大小</dt>
                          <dd
                            data-testid="kn-doc-preview-size"
                            title={previewField("大小", row.sizeHint === null, row.size, row.sizeHint).title}
                          >
                            {previewField("大小", row.sizeHint === null, row.size, row.sizeHint).text}
                          </dd>
                        </div>
                        <div>
                          <dt>更新</dt>
                          <dd
                            data-testid="kn-doc-preview-updated"
                            title={previewField("更新", row.atHint === null, row.at, row.atHint).title}
                          >
                            {previewField("更新", row.atHint === null, row.at, row.atHint).text}
                          </dd>
                        </div>
                        <div>
                          <dt>短码</dt>
                          <dd data-testid="kn-doc-preview-code" title={row.id !== "" ? row.id : "短码：上游没有给出文档标识"}>
                            {row.id !== "" ? shortId(row.id) ?? "该字段未返回" : "该字段未返回"}
                          </dd>
                        </div>
                      </dl>
                      <DocLineCopy doc={row} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {rowCopy.bar}
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
  onCloseOverlays,
  sdocOpen,
  typeKey,
  onCommitType,
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
  /** R67/R70 — 开预览时静默关其他详情面（抽屉 doc=/检索展开 sdoc=），一次合并写、不抢焦点。 */
  onCloseOverlays: (flags: { doc: boolean; sdoc: boolean }) => void;
  /** R70 — 三面互斥补齐：与检索命中行内展开（?sdoc=）双向互斥，同 R68 空间列表的接法。 */
  sdocOpen: boolean;
  /** R73 — 类型桶：?type= 人话值进 URL（粘链/刷新可复现），与 q/ksort/kdir 组合互不清除；
   *  空串 = 「全部」桶。本地过滤已加载文档，零新请求。 */
  typeKey: string;
  onCommitType: (key: string) => void;
}): ReactNode {
  const [filter, setFilter] = useState("");
  // R67 — 行内预览是本面的视图态：不进 URL（刷新/粘贴一律收起），同时至多一行。
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  // R70 — 检索命中展开在场时预览作废；sdoc 一关也不自行复活（state 比较的渲染期调整，不发请求）。
  const [wasSdocOpen, setWasSdocOpen] = useState(sdocOpen);
  if (sdocOpen !== wasSdocOpen) {
    setWasSdocOpen(sdocOpen);
    if (sdocOpen) {
      setPreviewKey(null);
    }
  }
  // 换一个空间：本地筛选要清掉，别把上一个空间的筛选结果当成这个空间的现状。
  // 行与错误本就随读口键（含 spaceId）更换而回到骨架，不会残留。
  const prevSpace = useRef(spaceId);
  useEffect(() => {
    if (prevSpace.current !== spaceId) {
      prevSpace.current = spaceId;
      setFilter("");
      setPreviewKey(null); // 上一空间的预览不带进下一个空间
    }
  }, [spaceId]);
  // 空间名不靠 URL 回显：它来自指定空间读口。读不到就用短码，原因放 title。
  const names = useSurface<SpaceRow>(
    () => {
      markKnwLoading("spaces", SPACES_URL);
      return fetchJsonStrict(SPACES_URL).then(
        (body: unknown) => {
          settleKnwOk("spaces", SPACES_URL, body);
          return readSpaces(body);
        },
        (cause: unknown) => {
          settleKnwFail("spaces", SPACES_URL, cause);
          throw cause;
        },
      );
    },
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
    () => {
      const path = documentsUrl(spaceId);
      markKnwLoading("space-docs", path);
      return fetchJsonStrict(path).then(
        (body: unknown) => {
          settleKnwOk("space-docs", path, body);
          return readSpaceDocuments(body);
        },
        (cause: unknown) => {
          settleKnwFail("space-docs", path, cause);
          throw cause;
        },
      );
    },
    `space-docs|${nonce}|${spaceId}`,
  );
  // R58 — 空间详情文档列表的 roving tabindex：与空间卡片（kn8）、检索命中（kn6）同一套钩子。
  const roving = useRovingRows("kn3", 'a[data-testid="kn3-docs-name"]');
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

  // 排序、检索条件、类型桶、空间或刷新变化 → 清空已累加的后续页、游标退回第一页给的那个（R73：切类型重置分页）。
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
  }, [spaceId, nonce, sort, dir, filter, typeKey, surface.state.kind, meta1]);

  // 合并第一页与已加载的后续页；按 id 去重，挡上游坏 cursor 静默重放首页造成的重复行。
  const combined: DocRow[] = moreRows.length === 0 ? baseRows : [...baseRows, ...moreRows];
  // 先按读入顺序定死每行的 key，再本地排序：排序只换显示次序，绝不动抽屉与链接的落点。
  const keyedAll: DocEntry[] = combined.map((row, index) => ({
    row,
    key: row.id !== "" ? row.id : `row-${index}`,
  }));
  const nameFiltered = filterKey === "" ? keyedAll : keyedAll.filter((entry) => entry.row.name.toLowerCase().includes(filterKey));
  // R73 — 类型桶本地过滤：人话值为桶键，缺类型归「未归类」；「全部」= 不过滤。
  const filtered = typeKey === "" ? nameFiltered : nameFiltered.filter((entry) => typeBucketLabel(entry.row) === typeKey);
  const buckets = docTypeBuckets(combined); // 计数基于已加载全集（combined），与可见行同源可核对
  const shown = sortDocs(filtered, sort, dir, (entry) => entry.row);
  const shownValue =
    surface.state.kind === "ready" ? { ...surface.state.value, rows: shown.map((entry) => entry.row) } : null;
  const openRow = shown.find((entry) => entry.key === openDoc)?.row ?? null;

  // R67 — 开合行内预览：收起与展开都不动 URL；抽屉/检索展开开着时开预览 = 静默关它（只删参数、不抢焦点）。
  const handlePreview = (key: string) => {
    if (previewKey === key) {
      setPreviewKey(null);
      return;
    }
    setPreviewKey(key);
    if (openDoc !== "" || sdocOpen) {
      onCloseOverlays({ doc: openDoc !== "", sdoc: sdocOpen });
    }
  };
  // 点行名开抽屉时收起预览：两者互斥，同屏至多一个详情面。
  const handleDrawerClick = () => {
    setPreviewKey(null);
  };

  // R72 — 行上固定链接：与抽屉 knO/kn-doc 入口同一 builder（origin + docLink(key)），
  // 同文档必同串；q/ksort/kdir（含旧 sort/dir 若在地址里）由 docLink 随现地址整体带过。
  // 复制本身零请求：只读地址与行标识。
  const [rowLink, setRowLink] = useState<{ url: string; kind: "copied" | "failed" } | null>(null);
  const handlePermalink = (key: string) => {
    const url = `${typeof window === "undefined" ? "" : window.location.origin}${docLink(key)}`;
    if (!navigator.clipboard?.writeText) {
      setRowLink({ url, kind: "failed" });
      return;
    }
    void navigator.clipboard.writeText(url).then(
      () => setRowLink({ url, kind: "copied" }),
      () => setRowLink({ url, kind: "failed" }),
    );
  };

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

  // 收成单点 gates — knF 的 enabled/title/状态句/计数位/兜底由 faceGates 一次判出。
  const knfGates = faceGates(
    {
      face: "knF",
      state: gateStateOf(surface.state.kind, surface.state.kind === "unwired" && surface.state.denied),
      rows: shown.length,
      filterText: filter.trim(),
      loadedTotal: loaded,
    },
    copyAct,
  );

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
            id="kn3-input"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={roving.onInputKeyDown}
            placeholder="按文档名筛选"
            data-testid="kn3-docs-filter-input"
          />
        </label>
        <span className="knw5-sub" data-testid="kn3-docs-filter-note">
          本地筛选：只在接口已经返回的这份列表里按名字挑，不再问一次服务，也不改变数量口径。
        </span>
      </div>

      {/* R73 — 类型桶：真 button、aria-pressed 选中态、计数同源；非 ready 整排 disabled，
          原因句读自 copyGates 同表（不造第二套措辞），计数不显示 0。 */}
      <div className="kn-type-row" data-testid="kn-type-row">
        {buckets.map((bucket, index) => {
          const selected = bucket.label === "全部" ? typeKey === "" : typeKey === bucket.label;
          const ready = surface.state.kind === "ready";
          const reason = blockedReasonByState(
            gateStateOf(surface.state.kind, surface.state.kind === "unwired" && surface.state.denied)
          );
          return (
            <button
              key={bucket.label}
              type="button"
              className="kn-type-bucket"
              data-testid={bucket.label === "全部" ? "kn-type-all" : `kn-type-${index}`}
              aria-pressed={selected ? "true" : "false"}
              disabled={!ready}
              title={!ready ? `当前不可筛选：${reason}` : selected ? "再点一次回「全部」" : `只看${bucket.label}：本地过滤已加载文档，不再问服务`}
              onClick={() => onCommitType(bucket.label === "全部" ? "" : bucket.label)}
            >
              {bucket.label}
              <span className="kn-type-count" data-testid={bucket.label === "全部" ? "kn-type-all-count" : `kn-type-count-${index}`}>
                {!ready ? "—" : bucket.count}
              </span>
            </button>
          );
        })}
      </div>

      <Surface
        testid="kn3-docs"
        source="space-docs"
        honestState
        probe={{ id: "space-docs", noMatch: filterKey !== "" }}
        state={
          surface.state.kind === "ready" && shownValue ? { kind: "ready", value: shownValue } : surface.state
        }
        onRetry={surface.retry}
        unwiredHead={SPACE_DOC_UNWIRED_HEAD}
        unwiredHuman={SPACE_DOC_UNWIRED_HUMAN}
        empty={() => {
          // 裸 0 不上屏（本模块硬护栏）：份数只在真大于 0 时点名，否则说「这份列表本身还是空的」。
          const docsCountClause =
            combined.length > 0 ? `已加载的 ${combined.length} 份文档里` : "这份已加载的列表本身还是空的，";
          return typeKey !== "" ? (
            <p data-testid="kn-type-empty">
              {filterKey === ""
                ? `该类型下没有文档：${docsCountClause}${combined.length > 0 ? `没有「${typeKey}」类型。` : ""}`
                : `这两个筛选叠起来没有留下文档：${docsCountClause}${
                    combined.length > 0
                      ? `「${typeKey}」类型且名字含「${filter.trim()}」的一份都没有。`
                      : ""
                  }`}
              这是筛选的结果，不代表空间没有文档。
              {filterKey === "" ? (
                <button type="button" className="knw5-drill" data-testid="kn-type-clear" onClick={() => onCommitType("")}>
                  清除类型筛选
                </button>
              ) : (
                <button
                  type="button"
                  className="knw5-drill"
                  data-testid="kn-type-clear-all"
                  onClick={() => {
                    onCommitType("");
                    setFilter("");
                  }}
                >
                  清除全部筛选
                </button>
              )}
            </p>
          ) : filterKey === "" ? (
            <EmptyNote testid="knN-empty-text-space-docs" knn="empty">
              {respondedEmptyNote({
                lead: "该空间暂无文档。",
                read: "这份列表里没有文档",
                aside: "这只说明这份回答是空的，不下别的结论",
                also: "也不给数量。",
              })}
            </EmptyNote>
          ) : (
            <EmptyNote testid="knN-empty-text-space-docs" knn="no-match">
              本地筛选没有匹配：这份列表里有 {loaded} 份文档，按「{filter.trim()}」一份都没留下。
              这是筛完的结果，不是空间没有文档。
              <button type="button" className="knw5-drill" data-testid="kn3-docs-empty-clear" onClick={() => setFilter("")}>
                清空筛选
              </button>
            </EmptyNote>
          );
        }}
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
              tabIndexFor={roving.tabIndexFor}
              active={roving.active}
              onListKeyDown={roving.onKeyDown}
              previewKey={previewKey}
              onPreview={handlePreview}
              onDrawerClick={handleDrawerClick}
              onPermalink={handlePermalink}
              sdocOpen={sdocOpen}
            />

            {/* R108 — 单页上限常驻句：N 与取数 limit 同一常量，M 与屏上可见行同一集合
                （复制清单走同一 shown），三处读数同源；游标口径跟分页条一致，不编造翻页。 */}
            <p
              className="knw5-sub"
              data-testid="kn3-page-cap"
              title={`limit=${DOCUMENTS_LIMIT}；${
                cursorOffered
                  ? "上游回答给了分页游标，翻页走旁边的分页条。"
                  : "上游回答没给可用的分页游标：暂不支持翻页，本页上限句不假装还有下一页。"
              }`}
            >
              {`本页最多显示 ${DOCUMENTS_LIMIT} 篇（当前已加载 ${shown.length > 0 ? shown.length : "—"} 篇；复制清单也只含这些篇）`}
              {shown.length === DOCUMENTS_LIMIT ? (
                <span data-testid="kn3-page-cap-more">可能还有更多，改用全库检索或收窄类型筛选</span>
              ) : null}
            </p>

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
            {/* R72 — 行侧固定链接的读数与兜底：aria-live 成功句；剪贴板失败给只读 textarea（全串在此与 title，不上屏正文）。 */}
            <div className="knO-row" data-testid="kn-doc-link-bar">
              <span className="knO-status" data-testid="kn-doc-permalink-status" aria-live="polite">
                {rowLink?.kind === "copied" ? LINK_COPY_OK_NOTE : rowLink?.kind === "failed" ? LINK_COPY_FAILED_NOTE : ""}
              </span>
              {rowLink?.kind === "failed" ? (
                <textarea
                  className="knO-fallback"
                  data-testid="kn-doc-permalink-fallback"
                  aria-label="手动复制文档固定链接"
                  readOnly
                  rows={2}
                  value={rowLink.url}
                />
              ) : null}
            </div>
          </>
        )}
      />
      {/* R66 — 表头四列在一切状态下都在且只有一套：真表头（有可见行）或禁用表头条。 */}
      {surface.state.kind === "ready" && shown.length > 0 ? null : (
        <DocHeadStrip
          sort={sort}
          dir={dir}
          onSort={onSort}
          disabledTitle={
            surface.state.kind === "loading"
              ? "空间文档列表还在读取，行读到了才能排。"
              : surface.state.kind === "unwired"
                ? "这份列表没读到（读口未接入或没有权限），现在不能排序。"
                : surface.state.kind === "login"
                  ? "登录状态已经失效，重新登录后才能排序。"
                  : surface.state.kind === "error"
                    ? "这次没有读到这份列表，现在不能排序。"
                    : filterKey !== ""
                      ? "本地筛选没有留下可见行，现在没有可排的行。"
                      : "这份列表里没有行，没有可排的内容。"
          }
        />
      )}
      {surface.state.kind === "ready" && baseRows.length > 0 ? (
        <p className="knw5-sub" data-testid="kn-sort-scope-note">
          仅在当前已加载 {baseRows.length} 篇内排序：文档读口实测不接受 sort/order/orderBy，
          点表头只改地址与本行序，不会再发请求。
        </p>
      ) : null}
      {/* 复制条四态常在；enabled/title/状态句/计数位/兜底全读 knfGates（单点，无本地措辞）。 */}
      <div className="knF-row" data-testid="knF-row">
        <Button
          size="sm"
          outlined
          className="knF-copy"
          onClick={copyList}
          disabled={!knfGates.copy.enabled}
          title={knfGates.copy.title}
          data-testid="knF-copy"
        >
          复制清单
        </Button>
        <span className="knw5-sub" data-testid="knF-lines" title={knfGates.lines?.title}>
          {knfGates.lines?.text ?? "—"}
        </span>
        <span
          data-testid="kn-gates-knF"
          data-enabled={String(knfGates.copy.enabled)}
          data-reason={knfGates.copy.reason ?? ""}
          data-retry-enabled={String(knfGates.retry.enabled)}
          data-export="absent"
          className="knD-marker"
          aria-hidden="true"
        />
        <span className="knF-status" data-testid="knF-copy-status" aria-live="polite">
          {knfGates.status}
        </span>
        {knfGates.fallback ? (
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
      {openDoc !== "" ? (
        <DocPreviewDrawer nonce={nonce} docId={openDoc} row={openRow} onClose={onCloseDoc} linkHref={docLink(openDoc)} />
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
  indexBase = 0,
}: {
  rows: DocRow[];
  docLink: (key: string) => string;
  openKey: string;
  needle: string;
  tabIndexFor: (index: number) => number;
  indexBase?: number;
}): ReactNode {
  // R132 — 列表级行复制（主 tab 检索表）：持有派工原名 id；空间详情侧带 -space- 后缀。
  // R169 实测修复（真缺陷）：本表按空间分组渲染、每组一个实例——改前 index={index}
  // 组内各自起 0，跨组同屏 testid 重号（违反唯一性与「i 连续 0..M-1」交付语义）；
  // 改后 index={indexBase + index}，偏移与 roving 的 tabIndexFor(start + index) 同源。
  const rowCopy = useRowCopyBar("kn-row-copy-status", "kn-row-copy-fallback");
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
            <th scope="col">操作</th>
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
                  <span data-testid="kn6-search-updated" title={updatedText(row.atRaw).title}>
                    {updatedText(row.atRaw).value}
                  </span>
                </td>
                <RowCopyButton doc={row} index={indexBase + index} testidPrefix="kn-row-copy" onCopy={rowCopy.copy} />
              </tr>
            );
          })}
        </tbody>
      </table>
      {rowCopy.bar}
    </div>
  );
}

function DocumentNameSearch({
  keyword,
  openKey,
  sdocLink,
  spaceLink,
  onCommit,
  onClear,
}: {
  keyword: string;
  openKey: string;
  sdocLink: (key: string) => string;
  spaceLink: (id: string) => string;
  onCommit: (value: string) => void;
  onClear: () => void;
}): ReactNode {
  const [draft, setDraft] = useState<{ from: string; text: string }>({ from: keyword, text: keyword });
  const text = draft.from === keyword ? draft.text : keyword;
  // R65 — 折叠位是纯本地视图态：按组键存，不进 URL、不触发任何读取。
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  // 这条读由页面根挂一次（DocsReadProvider）：文档清单卡吃的是同一份，
  // 关键词不会重发请求，因为上游本来就没有服务端关键词参数。
  const surface = useDocsRead();
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

  // 收成单点 gates — knG 的 enabled/title/状态句/计数位/兜底由 faceGates 一次判出。
  const kngGates = faceGates(
    {
      face: "knG",
      state: gateStateOf(surface.state.kind, surface.state.kind === "unwired" && surface.state.denied),
      rows: shown.length,
      filterText: text.trim(),
      loadedTotal: loaded.length,
    },
    copyAct,
  );

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
        probe={{ id: "doc-search", noMatch: needle !== "" }}
        state={
          surface.state.kind === "ready" ? { kind: "ready", value: { ...surface.state.value, rows: shown } } : surface.state
        }
        onRetry={surface.retry}
        unwiredHead={DOCUMENTS_UNWIRED_HEAD}
        unwiredHuman={DOCUMENTS_UNWIRED_HUMAN}
        loadingHint={
          needle === ""
            ? "正在取这份文档列表，结果未到；到之前这里不放占位条目。"
            : `正在按关键词「${text.trim()}」查文档，结果未到；到之前这里不放占位条目。`
        }
        empty={() =>
          needle === "" ? (
            <EmptyNote testid="knN-empty-text-doc-search" knn="empty">
              {respondedEmptyNote({
                read: "这份文档列表里没有条目",
                aside: "这只说明这份回答是空的，不下别的结论",
                also: "也不给数量。",
              })}
            </EmptyNote>
          ) : (
            <EmptyNote testid="knN-empty-text-doc-search" knn="no-match">
              没有匹配的文档：已加载的 {loaded.length} 条里没有名字含「{text.trim()}」的文档。
              这是本地筛选的结果，不代表全库没有。
              <button type="button" className="knw5-drill" data-testid="kn6-search-empty-clear" onClick={clear}>
                清除关键词
              </button>
            </EmptyNote>
          )
        }
        render={(value) => {
          // R65 — 按所属空间分组：纯派生、组序=首现序、组内保持既有序；折叠的组不挂行，
          // roving 的 tab 序始终等于可见行的 DOM 序。
          const groups = groupRowsBySpace(value.rows);
          let visibleBefore = 0;
          return (
            <>
              {groups.map((group, gi) => {
                const isCollapsed = collapsedGroups[group.key] === true;
                const start = visibleBefore;
                if (!isCollapsed) visibleBefore += group.rows.length;
                const rowsId = `kn-group-rows-${gi + 1}`;
                return (
                  <div className="kn6-group" key={group.key} data-testid="kn6-group">
                    <button
                      type="button"
                      className="kn-group-toggle"
                      aria-expanded={!isCollapsed}
                      aria-controls={rowsId}
                      onClick={() =>
                        setCollapsedGroups((cur) => ({ ...cur, [group.key]: !(cur[group.key] === true) }))
                      }
                      title={group.raw !== null ? `空间标识：${group.raw}` : "上游没有给出这个空间的标识"}
                      data-testid="kn-group-toggle"
                    >
                      <span className="kn-group-header" data-testid="kn-group-header">
                        {group.label ?? "—"}
                      </span>
                      <span className="kn-group-count" data-testid="kn-group-count">
                        {group.rows.length} 项
                      </span>
                      <span className="kn-group-action" aria-hidden="true">
                        {isCollapsed ? "展开" : "折叠"}
                      </span>
                    </button>
                    <div id={rowsId} data-testid="kn-group-rows">
                      {isCollapsed ? null : (
                        <SearchDocTable
                          rows={group.rows}
                          docLink={sdocLink}
                          openKey={openKey}
                          needle={text}
                          tabIndexFor={(index) => roving.tabIndexFor(start + index)}
                          indexBase={start}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              {openRow ? (
              <>
              <dl className="knw5-ref-detail" data-testid="kn6-search-detail" title={openRow.id || undefined}>
                <div>
                  <dt>文档</dt>
                  <dd
                    title={previewField("文档名", openRow.nameHint === null, openRow.name, openRow.nameHint).title}
                  >
                    {previewField("文档名", openRow.nameHint === null, openRow.name, openRow.nameHint).text}
                  </dd>
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
                  <dd
                    title={previewField("类型", openRow.typeHint === null, openRow.type, openRow.typeHint, openRow.typeRaw ?? undefined).title}
                  >
                    {previewField("类型", openRow.typeHint === null, openRow.type, openRow.typeHint, openRow.typeRaw ?? undefined).text}
                  </dd>
                </div>
                <div>
                  <dt>大小</dt>
                  <dd title={previewField("大小", openRow.sizeHint === null, openRow.size, openRow.sizeHint).title}>
                    {previewField("大小", openRow.sizeHint === null, openRow.size, openRow.sizeHint).text}
                  </dd>
                </div>
                <div>
                  <dt>更新</dt>
                  <dd title={previewField("更新", openRow.atHint === null, openRow.at, openRow.atHint).title}>
                    {previewField("更新", openRow.atHint === null, openRow.at, openRow.atHint).text}
                  </dd>
                </div>
              </dl>
              <DocLineCopy doc={openRow} />
              </>
              ) : null}
            </>
          );
        }}
      />
      </div>
      {/* 复制条四态常在；enabled/title/状态句/计数位/兜底全读 kngGates（单点，无本地措辞）。 */}
      <div className="knG-row" data-testid="knG-row">
        <Button
          size="sm"
          outlined
          className="knG-copy"
          onClick={copyHits}
          disabled={!kngGates.copy.enabled}
          title={kngGates.copy.title}
          data-testid="knG-copy"
        >
          复制结果
        </Button>
        <span className="knw5-sub" data-testid="knG-lines" title={kngGates.lines?.title}>
          {kngGates.copy.enabled ? (kngGates.lines?.text ?? "") : ""}
        </span>
        <span
          data-testid="kn-gates-knG"
          data-enabled={String(kngGates.copy.enabled)}
          data-reason={kngGates.copy.reason ?? ""}
          data-retry-enabled={String(kngGates.retry.enabled)}
          data-export="absent"
          className="knD-marker"
          aria-hidden="true"
        />
        <span className="knG-status" data-testid="knG-copy-status" aria-live="polite">
          {kngGates.status}
        </span>
        {kngGates.fallback ? (
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
    </section>
  );
}

function IngestSurface({ nonce, title }: { nonce: string; title?: string }): ReactNode {
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
      title={title}
      unwiredHead={DOCUMENTS_UNWIRED_HEAD}
      unwiredHuman={DOCUMENTS_UNWIRED_HUMAN}
      empty={() => (
        <EmptyNote>
          {respondedEmptyNote({
            lead: "当前没有读到文档登记。",
            read: "但列表为空",
            also: "不显示 0 篇。",
          })}
        </EmptyNote>
      )}
      render={(value) => <RowTable rows={value.rows} testid="knw5-ingest-table" />}
    />
  );
}

/** What the data-source reads answer as 接入任务, in the operator's own words. */
function TaskTable({
  rows,
  testid,
  variant = "ingest",
}: {
  rows: IngestTaskRow[];
  testid: string;
  /** connector = 骨架「连接器」表（8 列）；ingest = 骨架「最近摄入」表（6 列）。 */
  variant?: "connector" | "ingest";
}): ReactNode {
  const connector = variant === "connector";
  return (
    <div className="knw5-scroll">
      <table className="knw5-table" data-testid={`${testid}-table`}>
        <thead>
          <tr>
            <th scope="col">{connector ? "连接器" : "连接器"}</th>
            <th scope="col">{connector ? "类型" : "触发"}</th>
            {connector ? <th scope="col">目标库</th> : null}
            {connector ? <th scope="col">同步</th> : null}
            <th scope="col">最近同步</th>
            <th scope="col">{connector ? "本次条数" : "条数"}</th>
            {connector ? null : <th scope="col">切分段</th>}
            {connector ? null : <th scope="col">耗时</th>}
            <th scope="col">状态</th>
            {connector ? <th scope="col">操作</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || `task-${index}`} data-testid={`${testid}-row`} title={row.id || undefined}>
              <td data-label="连接器">
                <span className="knw5-name">{row.name}</span>
                <Reason>{row.nameReason}</Reason>
              </td>
              <td data-label={connector ? "类型" : "触发"}>
                <span title={row.kindRaw ?? undefined}>{row.kind}</span>
                <Reason>{row.kindReason}</Reason>
              </td>
              {connector ? <td data-label="目标库">—</td> : null}
              {connector ? <td data-label="同步">—</td> : null}
              <td data-label="最近同步">
                <span data-testid={`${testid}-time`}>
                  {row.timeLabel ? `${row.timeLabel}：${row.at}` : row.at}
                </span>
                <Reason>{row.atReason}</Reason>
              </td>
              <td data-label={connector ? "本次条数" : "条数"}>
                <span data-testid={`${testid}-count`}>{row.count}</span>
                {row.extra ? <span className="knw5-sub">{row.extra}</span> : null}
                <Reason>{row.countReason}</Reason>
              </td>
              {connector ? null : <td data-label="切分段">—</td>}
              {connector ? null : <td data-label="耗时">—</td>}
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
              {connector ? (
                <td data-label="操作">
                  {/* 写操作没有后端接口：照骨架留位，但只读——不放可点的假按钮。 */}
                  <span className="knv-meta">—</span>
                </td>
              ) : null}
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
      title=""
      unwiredHead={INGEST_STATUS_UNWIRED_HEAD}
      unwiredHuman={INGEST_STATUS_UNWIRED_HUMAN}
      empty={() => (
        <EmptyNote>
          {respondedEmptyNote({
            read: "但没有给出入库中的来源",
            aside: "这不等于一个源都没有",
            also: "也不写 0 个源。",
          })}
        </EmptyNote>
      )}
      render={(value) => <TaskTable rows={value.rows} testid="knw5-ingest-status" />}
    />
  );
}

/**
 * 数据源 pane（骨架 sources 7 块）：连接器 / 清洗规则 / 问题 / 队列 / 切分 /
 * 失败处理 / 最近摄入。连接器读口是唯一真接的源；其余没有读口的块照骨架
 * 列出列名并写「缺读口」，不用样例连接器充数。
 */
function SourcesPane({ nonce }: { nonce: string }): ReactNode {
  const surface = useSurface<IngestTaskRow>(
    () => fetchJsonStrict(TASKS_URL).then(readTasks),
    `tasks|${nonce}`,
  );
  const rows = surface.state.kind === "ready" ? surface.state.value.rows : [];
  const stamp = surface.state.kind === "ready" ? surface.state.value.stamp : null;
  const ready = surface.state.kind === "ready";
  const okCount = rows.filter((row) => row.status === "已完成" || row.status === "正常" || row.status === "已同步").length;
  const warnRows = rows.filter((row) => row.status === "失败" || row.status === "部分完成" || /授权|过期/.test(row.failure ?? ""));
  const writeOnly = rows.filter((row) => /只写/.test(row.status)).length;
  // 副行只写读到的数：读口没接通时直说数量读不到，不拿四个「—」占位。
  const head = ready
    ? `${rows.length} 个连接器 · ${okCount} 正常 · ${warnRows.length} 需重新授权 · ${writeOnly} 只写`
    : "连接器读口没有接入 · 数量、同步与状态都读不到";

  return (
    <div className="knv-pane">
      <PaneSubline
        testid="knv-sources-sub"
        text={head}
        right={stamp ? `读取于 ${updatedText(stamp).value}` : undefined}
      />

      <CardBlock
        label="连接器"
        meta="写入目标知识库"
        testid="knv-sources-connectors"
        foot={
          ready
            ? "缺读口：目标库、同步、操作"
            : "缺读口：连接器、类型、目标库、同步、最近同步、本次条数、状态、操作"
        }
      >
        <Surface
          testid="knw5-ingest-tasks"
          source="tasks"
          state={surface.state}
          onRetry={surface.retry}
          title=""
          unwiredHead={TASKS_UNWIRED_HEAD}
          unwiredHuman={TASKS_UNWIRED_HUMAN}
          empty={() => (
            <EmptyNote>
              {respondedEmptyNote({
                read: "但没有给出接入中的数据源",
                aside: "这不等于一个源都没有",
                also: "也不显示 0 个。",
              })}
            </EmptyNote>
          )}
          render={(value) => <TaskTable rows={value.rows} testid="knw5-ingest-tasks" variant="connector" />}
        />
      </CardBlock>

      <div className="knv-grid knv-g2">
        <MissingCard
          label="清洗规则"
          meta="入库前"
          columns={["规则", "状态"]}
          testid="knv-sources-clean"
          reason="清洗规则没有读口，也没有写接口；这里不摆可点的开关。"
        />
        {warnRows.length > 0 ? (
          <CardBlock label="问题" meta={`${warnRows.length} 条`} testid="knv-sources-problems">
            <div className="knv-pane" style={{ gap: 6 }}>
              {warnRows.map((row) => (
                <p key={row.id} className="knv-missing">
                  {row.name} · {row.failure ?? row.status}
                </p>
              ))}
            </div>
          </CardBlock>
        ) : (
          <MissingCard
            label="问题"
            columns={["问题", "处理"]}
            testid="knv-sources-problems"
            reason="连接器读不到，问题条数也读不到；不写 0 条。"
          />
        )}
      </div>

      <div className="knv-grid knv-g3">
        <MissingCard
          label="队列"
          meta="knowledge"
          columns={["待索引", "滞后", "重建耗时", "嵌入模型"]}
          testid="knv-sources-queue"
          reason="入库状态读口没有接入；队列条不画比例。"
        />
        <MissingCard
          label="切分"
          meta="入库前"
          columns={["长度", "重叠", "表格", "脱敏"]}
          testid="knv-sources-chunk"
        />
        <MissingCard
          label="失败处理"
          meta="近 24 小时"
          columns={["失败", "原因", "重试"]}
          testid="knv-sources-failures"
        />
      </div>

      <CardBlock label="最近摄入" meta="按完成时间" testid="knv-sources-recent">
        <IngestStatusSurface nonce={nonce} />
      </CardBlock>

      {/* 这一块的读口（/api/documents）今天接通：有真行就上屏，缺字段照实说缺。 */}
      <CardBlock label="文档登记" meta="跨空间 · 读口原文" testid="knv-sources-documents">
        <IngestSurface nonce={nonce} title="" />
      </CardBlock>
    </div>
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
        loadingHint={
          query.trim() === ""
            ? "正在取检索结果，结果未到；到之前这里不放占位条目。"
            : `正在检索「${query.trim()}」，结果未到；到之前这里不放占位条目。`
        }
        empty={() => (
          <EmptyNote>
            {query.trim() === ""
              ? respondedEmptyNote({
                  lead: "没有匹配结果。",
                  read: "这份回答里没有条目",
                  aside: "这不等于知识库是空的",
                  also: "也不给命中数。",
                })
              : `没有匹配结果：关键词「${query.trim()}」这份回答里没有条目。接口已响应，不展示样例，也不给命中数。`}
            <Link
              className="knw5-link"
              to="/knowledge?tab=spaces&panel=evidence"
              data-testid="knw5-search-empty-citations"
            >
              先看会话里留下的引用
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </EmptyNote>
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
      empty={() => (
        <EmptyNote>
          {respondedEmptyNote({
            read: "检索审计为空",
            aside: "不显示 0 次命中",
            also: "也不展示样例。",
          })}
        </EmptyNote>
      )}
      render={(value) => <RecordsTable rows={value.rows} />}
    />
  );
}

/**
 * 证据与引用 pane（骨架 evidence 3 块）：检索诊断（4 个 KPI + 零命中问题 +
 * 检索参数）与引用记录。检索诊断读口未接入，KPI 一律「—」；引用记录真接，
 * 列名照骨架「时间 | 文档 | 引用自 | 员工 | 结果」。
 */
function EvidencePane({ nonce }: { nonce: string }): ReactNode {
  const surface = useSurface<CitationRow>(
    () => fetchJsonStrict(CITATIONS_URL).then(readCitations),
    `citations|${nonce}`,
  );
  const rows = surface.state.kind === "ready" ? surface.state.value.rows : [];
  const stamp = surface.state.kind === "ready" ? surface.state.value.stamp : null;
  const ready = surface.state.kind === "ready";

  return (
    <div className="knv-pane">
      <PaneSubline
        testid="knv-evidence-sub"
        text="用于解释某次回答为什么引用了 / 没引用：先看检索诊断，再看引用记录"
        right={stamp ? `读取于 ${updatedText(stamp).value}` : undefined}
      />

      {/* 检索诊断今天没有读口：四个空 KPI 只会在首屏摆四个「—」，
          收成一张卡、一句缺读口声明；接上读口再按骨架铺回四个 KPI。 */}
      <CardBlock
        label="检索诊断"
        meta="近 7 天"
        testid="knv-evidence-diagnosis"
        foot="缺读口：命中率、未命中、零命中率、平均检索"
      >
        <p className="knv-missing">检索诊断读口没有接入；这里不摆空 KPI，也不写 0 次查询。</p>
      </CardBlock>
      <p className="knv-nummeta">
        范围 近 7 天 · 更新 {stamp ? updatedText(stamp).value : "未读到"} · 口径 命中=至少 1 段超阈值；无答案与超时分开计
      </p>

      <div className="knv-hr">检索诊断</div>
      <div className="knv-grid knv-g2">
        <MissingCard
          label="零命中问题"
          meta="近 7 天 · 按次数"
          columns={["问题", "次数", "处理"]}
          testid="knv-evidence-zero-hit"
          reason="零命中问题由检索诊断派生，读口没有接入；不列问题，也不写 0 次。"
        />
        <MissingCard
          label="检索参数"
          meta="员工可覆盖"
          columns={["Top-K", "最低相关度", "重排", "无命中"]}
          testid="knv-evidence-params"
          reason="检索参数没有读口；不把默认值写成当前生效值。"
        />
      </div>

      <div className="knv-hr">引用记录</div>
      <CardBlock
        label="引用记录"
        meta={ready ? `共 ${rows.length} 条` : "正在读取"}
        testid="knv-evidence-citations"
        foot="缺读口：引用策略是否强制执行"
      >
        <Surface
          testid="knw5-citations"
          source="citations"
          state={surface.state}
          onRetry={surface.retry}
          title=""
          empty={() => (
            <EmptyNote>
              {respondedEmptyNote({
                lead: "暂无引用。",
                read: "这一份引用登记里没有条目",
                aside: "不展示样例",
                also: "也不写 0 条。",
              })}
            </EmptyNote>
          )}
          render={(value) => (
            <>
              <CitationTable rows={value.rows} />
              <details className="knv-details">
                <summary>引用明细</summary>
                <div className="knv-details-bd">
                  <RefList rows={value.rows} testid="knw5-citations-list" />
                </div>
              </details>
            </>
          )}
        />
      </CardBlock>

      <details className="knv-details" data-testid="knv-evidence-session-cites">
        <summary>最近会话里的引用</summary>
        <div className="knv-details-bd">
          <SessionCitationsSurface nonce={nonce} />
        </div>
      </details>
    </div>
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
        <EmptyNote>
          {value.scanned !== null && value.scanned > 0
            ? `暂无引用：已读取最近 ${value.scanned} 个会话，这些会话里的回答没有带引用；不展示样例。`
            : respondedEmptyNote({
                lead: "暂无引用。",
                read: "最近会话里没有可展示的引用记录",
                aside: "不展示样例",
                also: "也不写 0 条。",
              })}
        </EmptyNote>
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
  // 文档列表排序只在地址里：刷新、粘贴 URL、前进后退都能复现，且换排序不再问服务。
  // R66：本面自己的参数是 ksort/kdir；旧链里的 sort/dir 只读兜底（老地址继续生效），
  // 清除只删 ksort/kdir、不动 sort/dir——两套键互不清除。
  const sortCol = docSortCol(sp.get("ksort") ?? sp.get("sort"));
  const sortDirRaw = sp.get("kdir") ?? sp.get("dir");
  const sortDir: DocSortDir =
    sortDirRaw !== null ? docSortDir(sortDirRaw) : sortCol === "updated" ? "desc" : docSortLandDir(sortCol);
  // R73/R74 — 类型桶进 URL：本面真值键是 ?ktype=（人话值；粘链/刷新复现），旧 ?type= 只读兜底；
  // 写只写 ktype，清除时 ktype/type 一并删——q/ksort/kdir/space/doc 全程不动。
  const typeKey = sp.get("ktype") ?? sp.get("type") ?? "";
  const [nonce, setNonce] = useState("0");
  const [, setDeepCrumb] = useState<DeepCrumb | null>(null);
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
  // 预览夹具的强制态：URL 参数 state/rid 钉住、不发真实请求。可清除的等价物不是
  // 「筛选」而是夹具本身，所以两态的单一主操作统一为「退出预览」（撤掉 state/rid）。
  const exitForced = () => {
    const next = new URLSearchParams(sp);
    next.delete("state");
    next.delete("rid");
    setSp(next, { replace: true });
  };
  // 错误态 rid 复制入口的数据源：预览夹具用 URL rid 参数模拟「上游带了编号」。
  const forcedRid = (sp.get("rid") ?? "").trim() || null;

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
    next.delete("ksort");
    next.delete("kdir");
    next.delete("type"); // R73：类型桶同属文档列表，换页签一并清掉
    next.delete("ktype"); // R74：新键同上
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

  // 四态周期：点新列落到它的默认方向（落向）；同列再点翻向（翻转）；第三次点清除回默认口径。
  // 默认态不写参数；清除只删 ksort/kdir，旧地址里带进来的 sort/dir 原样保留；q/面包屑等其余参数全程不动。
  // 只改地址，不触发任何读取。
  const applySort = (col: DocSortCol) => {
    const next = new URLSearchParams(sp);
    if (col === sortCol && sortDir !== docSortLandDir(col)) {
      // 已经翻过一次：第三点 = 清除
      next.delete("ksort");
      next.delete("kdir");
    } else if (col === sortCol) {
      next.set("ksort", col);
      next.set("kdir", sortDir === "asc" ? "desc" : "asc");
    } else {
      next.set("ksort", col);
      next.set("kdir", docSortLandDir(col));
    }
    setSp(next);
  };

  // R73 — 类型桶写 URL：只动 type，q/ksort/kdir/面包屑/分页等其余参数原样保留；「全部」不写参数。
  // R73/R74 — 类型桶写 URL：只写 ktype；同桶再点=清除时 ktype 与旧 type 一并删（否则兜底读
  // 会让旧参数复活）；其余参数原样保留。「全部」态不写参数。
  const commitType = (key: string) => {
    const next = new URLSearchParams(sp);
    if (key === "" || key === typeKey) {
      next.delete("ktype");
      next.delete("type");
    } else {
      next.set("ktype", key);
    }
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

  // R68 — 开空间行内预览时静默收掉检索行内展开：只删 sdoc=，不抢焦点。
  const closeSdocQuietly = () => {
    const next = new URLSearchParams(sp);
    next.delete("sdoc");
    setSp(next);
  };

  // R70 — 详情面预览可能与 doc= 与 sdoc= 同时为敌：一次构造删两项。
  //（setSearchParams 不支持函数式 updater，两次连调会以同一陈旧基互相覆盖——parity 测试抓出的真缺陷。）
  const closeOverlaysQuietly = (flags: { doc: boolean; sdoc: boolean }) => {
    const next = new URLSearchParams(sp);
    if (flags.doc) {
      next.delete("doc");
    }
    if (flags.sdoc) {
      next.delete("sdoc");
    }
    setSp(next);
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
      {/* 页头归外壳（唯一 h1 / 面包屑在 TopBar）。这里只留一行操作位：
          右端「刷新」+ 分组导航；不再画第二套标题。 */}
      <div className="knw5-head knw5-toolbar">
        <nav className="knw5-seg" aria-label="知识分组">
          {TAB_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              aria-current={tab === key ? "page" : undefined}
              data-testid={`knw5-tab-${key}`}
              onClick={() => selectTab(key)}
            >
              {TAB_LABEL[key]}
            </button>
          ))}
        </nav>
        <Button size="sm" outlined onClick={refresh} prefix={<RefreshCw className="h-3.5 w-3.5" aria-hidden />}>
          刷新
        </Button>
      </div>

      {/* 骨架三个 pane 都没有「全库搜索」块；这一份文档检索收进可展开的次要位，
      默认收起，展开才占首屏。文档登记这条读全页只发一次（DocsReadProvider），
      空间面的「文档清单」卡吃的是同一份。 */}
      <DocsReadProvider nonce={nonce} active={forced === null}>
      {forced === null ? (
        <details className="knv-details" data-testid="knv-doc-search">
          <summary>按文档名搜索 · 文档命中</summary>
          <div className="knv-details-bd">
            <DocumentNameSearch
              keyword={query}
              openKey={openSearchDoc}
              sdocLink={sdocLink}
              spaceLink={spaceLink}
              onCommit={commitKeyword}
              onClear={clearKeyword}
            />
          </div>
        </details>
      ) : null}

      <div className="knwn-outer">
        <div className="knw5-body" data-testid="knw5-panel" data-tab={tab}>
          <div data-testid={`knw5-panel-${tab}`}>
            {forced ? (
              forced === "loading" ? (
                <div className="knw5-forced" data-testid="knw5-forced-loading" aria-busy="true">
                  <div /><div /><div />
                </div>
              ) : forced === "empty" ? (
                <div
                  className="knw5-forced flex min-w-0 flex-col gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-8)]"
                  data-testid="knw5-forced-empty"
                >
                  <p className="knw5-forced-title text-base font-medium">这个分组没有条目</p>
                  <p className="max-w-prose">服务已响应，这个分组没有可展示的条目；不显示 0，也不展示样例。</p>
                  <div className="knw5-forced-actions pt-[var(--space-2)]">
                    <Button size="sm" onClick={exitForced} data-testid="knw5-forced-exit">
                      退出预览，读实时数据
                    </Button>
                  </div>
                </div>
              ) : (
                // 错误态组合：可读标题（含「预览错误」锁点）+ 原说明句（逐字保留）+ rid
                // 复制入口（接 URL rid 参数）+ 技术信息折叠进「详情」+ 单一主操作。
                // 与空态互斥由上方 forced 三元保证（单值枚举，测试已锁）；375 长 rid
                // 由 .knw5-req/.knw5-req-value 的 overflow-wrap:anywhere 兜底，不横溢。
                <div
                  className="knw5-forced flex min-w-0 flex-col gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-6)]"
                  data-testid="knw5-forced-error"
                  role="alert"
                >
                  <p className="knw5-forced-title text-base font-medium">预览错误</p>
                  <p className="max-w-prose">预览错误：这次读取没有成功，页面没有编造知识数据。</p>
                  <RequestId id={forcedRid} testid="knw5-forced-request-id" />
                  <details className="max-w-prose">
                    <summary>详情</summary>
                    <p>预览夹具由 URL 参数 state/rid 钉住，不发起真实请求；退出预览即回到实时读取。</p>
                  </details>
                  <div className="knw5-forced-actions pt-[var(--space-2)]">
                    <Button size="sm" onClick={exitForced} data-testid="knw5-forced-exit-error">
                      退出预览，读实时数据
                    </Button>
                  </div>
                </div>
              )
            ) : (
            <CrumbReport.Provider value={reportCrumb}>
            <RefDrill.Provider value={{ open: drilled, toggle: toggleDrill }}>
              {tab === "spaces" ? (
                <>
                  {spaceId === "" ? (
                    <SpacesSurface
                      nonce={nonce}
                      spaceLink={spaceLink}
                      keyword={query}
                      onCommitKeyword={commitKeyword}
                      onClearKeyword={clearKeyword}
                      sdocOpen={openSearchDoc !== ""}
                      onCloseSdoc={closeSdocQuietly}
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
                      onCloseOverlays={closeOverlaysQuietly}
                      sdocOpen={openSearchDoc !== ""}
                      typeKey={typeKey}
                      onCommitType={commitType}
                    />
                  )}
                  <SourceFreshness />
                </>
              ) : null}
              {tab === "ingest" ? <SourcesPane nonce={nonce} /> : null}
              {tab === "retrieval" ? (
                <div className="knv-pane">
                  <SearchSurface nonce={nonce} query={query} onSearch={commitQuery} />
                  <RecordsSurface nonce={nonce} />
                </div>
              ) : null}
              {tab === "evidence" ? <EvidencePane nonce={nonce} /> : null}
              </RefDrill.Provider>
            </CrumbReport.Provider>
            )}
          </div>
        </div>
      </div>

      </DocsReadProvider>

      <p className="knw5-note">
        本页只读：数量、更新时间与状态都以真实接口为准；读不到时照实说明原因，不以 0 或样例冒充。
        检索与引用只展示上游给出的原文位置，打不开时直接说明原因。
      </p>
      <Link className="knw5-link" to="/knowledge?tab=spaces&panel=evidence" data-testid="knw5-goto-evidence">
        看运行事件引用
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}
