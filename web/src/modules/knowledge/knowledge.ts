/**
 * Knowledge module — read-side adapters for every surface under `/knowledge`.
 *
 * GAP-03: the console BFF has no knowledge read side. Probed on 2026-11-19 with
 * the real login cookie (the token value was never printed, and never is):
 *
 *   GET /agent-api/api/knowledge/search?q=员工&limit=5  404 console.unknown_route      0 rows
 *   GET /agent-api/api/knowledge/search?limit=12        404 console.unknown_route      0 rows
 *   GET /agent-api/api/knowledge/citations?limit=20     404 knowledge.not_wired        0 rows
 *   GET /agent-api/api/knowledge/spaces                 404 knowledge.not_wired        0 rows
 *   GET /agent-api/api/knowledge/sources?limit=20       404 knowledge.not_wired        0 rows
 *   GET /agent-api/api/knowledge/ingest?limit=20        404 console.unknown_route      0 rows
 *   GET /agent-api/api/knowledge/tasks?limit=20         404 console.unknown_route      0 rows
 *   GET /agent-api/api/knowledge/documents?limit=20     404 console.unknown_route      0 rows
 *   GET /agent-api/api/documents?limit=50               404 console.unknown_route      0 rows
 *   GET /agent-api/api/audit?action=kb.read&limit=50    200 { events: [] }             0 rows
 *   GET /agent-api/api/console-sessions?limit=20        200 { items: [] }              0 rows
 *   GET /agent-api/api/console-sessions/<id>            404 console_session.not_found
 *   GET /agent-api/api/run-events?kind=citation         400 console.missing_param（要 runId）
 *   GET /agent-api/api/tasks?limit=20                   200 items=20 —— 运营任务看板，不是知识接入
 *
 * So every surface makes one real request and renders the answer it got: rows when
 * the read is wired; ONE body for a 403 and a 404 alike when it is not, because the
 * screen must not reveal which of the two the service actually said. Nothing here
 * fabricates a row, a count or a sample, no fixture stands in for a missing read, and
 * no other module's endpoint is borrowed to fill a number.
 */

export const KNOWLEDGE_GAP = "GAP-03";

/**
 * The single sentence behind a 403 and a 404. It carries no status, no route and no
 * service code, and says what changes when the read is wired.
 */
export const UNWIRED_HUMAN =
  "知识服务的读取口现在没有给出数据：接口尚未接入本控制台，或当前账号没有查看它的权限。接入或开通后，这里会自动显示真实数据；在此之前不展示样例，也不把缺失值写成 0。";

export type KnowledgeTab = "spaces" | "ingest" | "retrieval" | "evidence";

export const TAB_LABEL: Record<KnowledgeTab, string> = {
  spaces: "知识空间",
  ingest: "数据接入",
  retrieval: "检索",
  evidence: "证据与引用",
};

export const TAB_ORDER: KnowledgeTab[] = ["spaces", "ingest", "retrieval", "evidence"];

/** Read URLs — one per surface, so every body can say where it came from. */
export const SPACES_URL = "/agent-api/api/knowledge/spaces";
export const DOCUMENTS_URL = "/agent-api/api/documents?limit=50";
export const RECORDS_URL = "/agent-api/api/audit?action=kb.read&limit=50";
/**
 * The session list the citation scan reads. The canonical console-session collection is
 * used because the detail read belongs to the same route family; `/api/sessions` is only
 * a documented legacy alias of it (same upstream, `{sessions,total}` reshaped from
 * `{items,next_cursor}`), so list and detail now come from one family.
 */
export const SESSIONS_URL = "/agent-api/api/console-sessions?limit=20";
export const CITATIONS_URL = "/agent-api/api/knowledge/citations?limit=20";
/**
 * 数据源接入任务. The BFF names exactly three knowledge reads as its own fail-closed
 * routes — `/api/knowledge/spaces`, `/api/knowledge/sources`, `/api/knowledge/citations`
 * (`_KNOWLEDGE_NOT_WIRED_ROUTES` in `apps/console/server.py`) — and answers
 * `knowledge.not_wired` for them, so `sources` is the designated ingest read.
 * Probed and deliberately NOT used: `/api/knowledge/ingest`, `/api/knowledge/ingest/tasks`,
 * `/api/knowledge/tasks`, `/api/knowledge/documents`, `/api/knowledge/datasets` (all
 * `console.unknown_route`), and `/api/tasks` — which answers 200 with 20 rows but is the
 * operator task board (`source.kind` manual/console; `kind=knowledge` and `type=ingest`
 * are both ignored), so its rows are not knowledge ingestion and must not appear here.
 */
export const TASKS_URL = "/agent-api/api/knowledge/sources?limit=20";

const SEARCH_LIMIT = 12;

/**
 * The knowledge search read. Without a keyword it still calls the endpoint, which is
 * how a reviewer sees whether search is wired before typing anything.
 */
export function searchUrl(query: string): string {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed !== "") params.set("q", trimmed);
  params.set("limit", String(SEARCH_LIMIT));
  return `/agent-api/api/knowledge/search?${params.toString()}`;
}

export type SurfaceKey =
  | "spaces"
  | "tasks"
  | "documents"
  | "search"
  | "records"
  | "citations"
  | "session-cites";

/** Human label for each surface's source line — no route, no field name. */
export const SURFACE_SOURCE: Record<SurfaceKey, string> = {
  spaces: "知识空间登记",
  tasks: "数据源接入任务",
  documents: "文档与数据接入登记",
  search: "知识库检索",
  records: "检索审计记录",
  citations: "知识库引用登记",
  "session-cites": "会话中的引用记录",
};

type Rec = Record<string, unknown>;

export interface KnowledgeRow {
  id: string;
  name: string;
  nameReason: string | null;
  kind: string;
  kindRaw: string | null;
  kindReason: string | null;
  scale: string;
  scaleReason: string | null;
  updatedAt: string;
  updatedReason: string | null;
  status: string;
  statusRaw: string | null;
  statusReason: string | null;
}

/**
 * One 数据源接入任务: what is being brought in, how far it got, how much of it there
 * is, and when that was last true. Every value the read did not return says 「—」 with
 * the reason; a returned 0 stays a real 0.
 */
export interface IngestTaskRow {
  id: string;
  name: string;
  nameReason: string | null;
  kind: string;
  kindRaw: string | null;
  kindReason: string | null;
  status: string;
  statusRaw: string | null;
  statusReason: string | null;
  progress: string;
  progressReason: string | null;
  issue: string | null;
  timeLabel: string | null;
  at: string;
  atRaw: string | null;
  atReason: string | null;
}

/**
 * One reference to a document: a search hit or a citation. Both are drawn by the same
 * list, because both answer the same four questions — which document, from where, when,
 * and whether the original can be opened.
 */
export interface CitationRow {
  id: string;
  title: string;
  titleReason: string | null;
  kind: string;
  kindRaw: string | null;
  kindReason: string | null;
  source: string;
  sourceRaw: string | null;
  sourceReason: string | null;
  summary: string | null;
  summaryReason: string | null;
  /** 被引用的原话 — kept apart from the summarised 摘要. */
  quote: string | null;
  quoteReason: string | null;
  /** 在原文中的位置（页/行/段），只在上游真给时出现。 */
  locator: string | null;
  locatorReason: string | null;
  /** 这段引用是从哪儿产生的（哪一次提问、哪一次运行、哪一轮会话回答）。 */
  origin: string | null;
  originRaw: string | null;
  originHref: string | null;
  originReason: string | null;
  employee: string;
  employeeRaw: string | null;
  employeeReason: string | null;
  at: string;
  atRaw: string | null;
  atReason: string | null;
  href: string | null;
  unreachable: string | null;
}

export interface RetrievalRow {
  id: string;
  actor: string;
  actorRaw: string | null;
  decision: string;
  decisionRaw: string | null;
  outcome: string;
  outcomeRaw: string | null;
  target: string;
  targetRaw: string | null;
  at: string;
  atRaw: string | null;
  atReason: string | null;
  href: string | null;
}

export interface SessionSummary {
  sessionId: string;
  employeeId: string | null;
  messageCount: number;
  updatedAt: string | null;
}

/** What one surface read: its rows, and how fresh the answer says they are. */
export interface SurfaceValue<T> {
  rows: T[];
  stamp: string | null;
  stampReason: string | null;
  /** Sessions actually read, for a surface that had to read sessions to find rows. */
  scanned: number | null;
}

const BJT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

export function beijing(value: string | null): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return BJT.format(new Date(ms)).replace("T", " ");
}

function shortCode(value: string | null): string | null {
  if (!value) return null;
  const compact = value.replace(/[^0-9A-Za-z]/g, "");
  if (compact.length === 0) return null;
  return compact.slice(-8).toUpperCase();
}

function formatBytes(value: number | null): string | null {
  if (value === null) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** The envelope keys the BFF uses for a row list; an unknown shape yields no rows. */
const ROW_KEYS = [
  "items",
  "data",
  "rows",
  "list",
  "events",
  "results",
  "hits",
  "citations",
  "documents",
  "sessions",
] as const;

function rowsOf(body: unknown): Rec[] | null {
  if (Array.isArray(body)) return body.filter(isRecord);
  if (!isRecord(body)) return null;
  for (const key of ROW_KEYS) {
    const value = body[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  if (isRecord(body.data)) {
    for (const key of ROW_KEYS) {
      const value = body.data[key];
      if (Array.isArray(value)) return value.filter(isRecord);
    }
  }
  return null;
}

interface Stamp {
  stamp: string | null;
  stampReason: string | null;
}

function stampOf(body: unknown): Stamp {
  if (!isRecord(body)) {
    return { stamp: null, stampReason: "上游响应没有带采集时间，数据截至时间未知。" };
  }
  const raw = pickString(
    body.asOf,
    body.as_of,
    body.generatedAt,
    body.generated_at,
    body.snapshotAt,
    body.snapshot_at,
    body.updatedAt,
    body.updated_at,
  );
  if (!raw) {
    return { stamp: null, stampReason: "上游响应没有带采集时间，数据截至时间未知。" };
  }
  const stamp = beijing(raw);
  return stamp
    ? { stamp, stampReason: null }
    : { stamp: null, stampReason: "上游采集时间无法解析，数据截至时间未知。" };
}

/**
 * When the data is: the envelope's own collection time if it carried one, otherwise the
 * newest row time. Never the browser's clock.
 */
function newestOf(times: (string | null)[], envelope: Stamp, reason: string): Stamp {
  if (envelope.stamp) return envelope;
  const sorted = times.filter((value): value is string => Boolean(value)).sort();
  const latest = sorted.length > 0 ? beijing(sorted[sorted.length - 1]) : null;
  return { stamp: latest, stampReason: latest ? null : reason };
}

function kindLabel(raw: string | null, tab: KnowledgeTab): string {
  if (!raw) return tab === "evidence" ? "引用" : "其他类型";
  const lower = raw.toLowerCase();
  if (["personal", "private", "own", "self"].includes(lower)) return "个人空间";
  if (["team", "group", "department", "dept"].includes(lower)) return "团队空间";
  if (["tenant", "global", "all", "shared"].includes(lower)) return "租户空间";
  if (["knowledge", "kb", "space"].includes(lower)) return "知识空间";
  if (["pdf", "application/pdf"].includes(lower)) return "PDF";
  if (["doc", "docx", "word", "application/msword"].includes(lower)) return "Word 文档";
  if (["md", "markdown", "text/markdown"].includes(lower)) return "Markdown";
  if (["txt", "text", "text/plain"].includes(lower)) return "文本";
  if (["citation", "cite", "reference"].includes(lower)) return "引用";
  if (["run", "execution"].includes(lower)) return "运行";
  if (["audit", "event"].includes(lower)) return "审计事件";
  return tab === "evidence" ? "引用" : "其他类型";
}

function statusLabel(raw: string | null): string {
  if (!raw) return "待核实";
  const lower = raw.toLowerCase();
  if (["active", "enabled", "ready", "ok", "indexed", "normal", "available"].includes(lower)) {
    return "正常";
  }
  if (["processing", "indexing", "running", "ingesting", "pending"].includes(lower)) return "处理中";
  if (["failed", "error", "broken", "disabled", "offline", "deleted"].includes(lower)) return "不可用";
  if (["draft", "unpublished"].includes(lower)) return "草稿";
  return "待核实";
}

export function readRowOf(row: Rec, tab: KnowledgeTab): KnowledgeRow {
  const id = pickString(
    row.spaceId,
    row.space_id,
    row.documentId,
    row.document_id,
    row.docId,
    row.doc_id,
    row.id,
    row.knowledgeId,
    row.knowledge_id,
  ) ?? "";
  const name = pickString(
    row.name,
    row.spaceName,
    row.space_name,
    row.title,
    row.fileName,
    row.file_name,
    row.docName,
    row.doc_name,
  );
  const kindRaw = pickString(
    row.kind,
    row.type,
    row.scope,
    row.space_type,
    row.spaceType,
    row.doc_type,
    row.docType,
    row.mimeType,
    row.mime_type,
  );
  const count = pickNumber(
    row.docCount,
    row.doc_count,
    row.documentCount,
    row.document_count,
    row.chunkCount,
    row.chunk_count,
    row.chunks,
    row.count,
  );
  const bytes = pickNumber(
    row.sizeBytes,
    row.size_bytes,
    row.storageBytes,
    row.storage_bytes,
    row.bytes,
    row.size,
  );
  const sizeText = formatBytes(bytes);
  const updatedRaw = pickString(
    row.updatedAt,
    row.updated_at,
    row.modifiedAt,
    row.modified_at,
    row.lastUpdated,
    row.last_updated,
  );
  const updatedAt = beijing(updatedRaw);
  const statusRaw = pickString(row.status, row.state, row.indexStatus, row.index_status);
  return {
    id,
    name: name ?? "—",
    nameReason: name ? null : "上游未提供名称",
    kind: kindLabel(kindRaw, tab),
    kindRaw,
    kindReason: kindRaw ? null : "上游未提供类型",
    scale: count !== null ? `${count} 条` : sizeText ?? "—",
    scaleReason: count !== null || sizeText !== null ? null : "上游未提供条数或大小",
    updatedAt: updatedAt ?? "—",
    updatedReason: updatedAt ? null : updatedRaw ? "更新时间无法解析" : "上游未提供更新时间",
    status: statusLabel(statusRaw),
    statusRaw,
    statusReason: statusRaw ? null : "上游未提供状态",
  };
}

/** A row's human-readable origin: the document or space name, else a short code. */
function sourceOf(row: Rec): { source: string; sourceRaw: string | null; sourceReason: string | null } {
  const name = pickString(
    row.sourceName,
    row.source_name,
    row.source,
    row.documentName,
    row.document_name,
    row.documentTitle,
    row.docTitle,
    row.doc_title,
    row.fileName,
    row.file_name,
    row.spaceName,
    row.space_name,
  );
  const kindRaw = pickString(row.sourceKind, row.source_kind, row.sourceType, row.source_type);
  const idRaw = pickString(
    row.sourceId,
    row.source_id,
    row.documentId,
    row.document_id,
    row.docId,
    row.doc_id,
    row.spaceId,
    row.space_id,
  );
  const code = shortCode(idRaw);
  if (name) return { source: name, sourceRaw: idRaw, sourceReason: null };
  if (code) return { source: `${kindLabel(kindRaw, "evidence")} · ${code}`, sourceRaw: idRaw, sourceReason: null };
  return { source: "—", sourceRaw: null, sourceReason: "上游没有给出来源文档或空间" };
}

/** Only an in-site location can be opened; anything else says why it cannot. */
function linkOf(row: Rec): { href: string | null; unreachable: string | null } {
  const raw = pickString(
    row.href,
    row.url,
    row.link,
    row.documentUrl,
    row.document_url,
    row.fileUrl,
    row.file_url,
  );
  const href = raw && (raw.startsWith("/") || raw.startsWith("#")) ? raw : null;
  if (href) return { href, unreachable: null };
  return {
    href: null,
    unreachable: raw
      ? "上游给出的原文位置不是站内地址，无法直接打开。"
      : "上游没有给出原文位置，无法打开原文。",
  };
}

function employeeOf(row: Rec): {
  employee: string;
  employeeRaw: string | null;
  employeeReason: string | null;
} {
  const employeeId = pickString(row.employeeId, row.employee_id);
  const employeeName = pickString(row.employeeName, row.employee_name);
  const code = shortCode(employeeId);
  if (employeeName && code) {
    return { employee: `${employeeName} · ${code}`, employeeRaw: employeeId, employeeReason: null };
  }
  if (employeeName) return { employee: employeeName, employeeRaw: null, employeeReason: null };
  if (code) return { employee: `员工 · ${code}`, employeeRaw: employeeId, employeeReason: null };
  return { employee: "—", employeeRaw: null, employeeReason: "上游没有说明这段内容是谁留下的" };
}

function summaryOf(row: Rec): { summary: string | null; summaryReason: string | null } {
  const summary = pickString(
    row.summary,
    row.snippet,
    row.excerpt,
    row.highlights,
    row.text,
    row.content,
  );
  return { summary, summaryReason: summary ? null : "上游没有给出这段内容的摘要" };
}

/**
 * A row's place inside the original, in human words. Only a value the read
 * actually returned becomes text; anything else says what is missing.
 */
function locatorOf(row: Rec): { locator: string | null; locatorReason: string | null } {
  const pages = pickString(row.pageRange, row.page_range, row.pages, row.pageSpan, row.page_span);
  const page = pickNumber(row.page, row.pageNumber, row.page_number, row.pageNo, row.page_no);
  const lines = pickString(row.lineRange, row.line_range, row.lines);
  const lineStart = pickNumber(row.lineStart, row.line_start, row.line);
  const lineEnd = pickNumber(row.lineEnd, row.line_end);
  const section = pickString(row.sectionTitle, row.section_title, row.heading, row.section);
  const paragraph = pickNumber(row.paragraph, row.paragraphIndex, row.paragraph_index);
  const chunk = pickNumber(row.chunkIndex, row.chunk_index, row.chunk, row.chunkNo);
  if (pages) return { locator: `第 ${pages} 页`, locatorReason: null };
  if (page !== null) return { locator: `第 ${page} 页`, locatorReason: null };
  if (lines) return { locator: `行 ${lines}`, locatorReason: null };
  if (lineStart !== null && lineEnd !== null) return { locator: `行 ${lineStart}–${lineEnd}`, locatorReason: null };
  if (lineStart !== null) return { locator: `第 ${lineStart} 行`, locatorReason: null };
  if (section) return { locator: `章节：${section}`, locatorReason: null };
  if (paragraph !== null) return { locator: `第 ${paragraph} 段`, locatorReason: null };
  if (chunk !== null) return { locator: `第 ${chunk} 个引用片段`, locatorReason: null };
  return { locator: null, locatorReason: "上游没有给出这段内容在原文里的位置" };
}

/**
 * Where the citation came from. A knowledge read can name the query that produced
 * it; the session scan names the conversation and the answer inside it. Raw ids
 * go to `title`/`originRaw` only.
 */
function originOf(row: Rec, fallbackSession?: SessionSummary | null): {
  origin: string | null;
  originRaw: string | null;
  originHref: string | null;
  originReason: string | null;
} {
  const asked = pickString(row.query, row.question, row.prompt, row.asked, row.userQuery, row.user_query);
  const runId = pickString(row.runId, row.run_id);
  const citeCount = pickNumber(row.citeCount, row.cite_count, row.timesCited);
  const parts: string[] = [];
  if (asked) parts.push(`当时的提问：${asked}`);
  if (runId && runId.startsWith("run_")) parts.push("由一次运行引出");
  if (citeCount !== null) parts.push(`被引用 ${citeCount} 次`);
  if (fallbackSession) {
    const seq = pickNumber(row.messageSeq, row.message_seq, row.seq);
    const code = shortCode(fallbackSession.sessionId);
    parts.unshift(seq !== null ? `会话 · ${code} 的第 ${seq} 条回答` : `来自会话 · ${code}`);
  }
  if (parts.length === 0) {
    return { origin: null, originRaw: null, originHref: null, originReason: "上游没有说明这段引用是从哪儿产生的" };
  }
  return {
    origin: parts.join(" · "),
    originRaw: fallbackSession?.sessionId ?? pickString(row.sessionId, row.session_id) ?? runId,
    originHref: runId && runId.startsWith("run_") ? `/runs/${encodeURIComponent(runId)}` : null,
    originReason: null,
  };
}

/** The words that were actually quoted, kept apart from the summarised 摘要. */
function quoteOf(row: Rec): { quote: string | null; quoteReason: string | null } {
  const quote = pickString(row.quote, row.quotedText, row.quoted_text, row.verbatim, row.matchedText, row.matched_text);
  return { quote, quoteReason: quote ? null : "上游没有给出被引用的原话" };
}

export function citationOf(raw: unknown, session?: SessionSummary | null): CitationRow {
  const row = isRecord(raw) ? raw : {};
  const id = pickString(row.id, row.citationId, row.citation_id, row.eventId, row.event_id) ?? "";
  const title = pickString(
    row.title,
    row.documentTitle,
    row.document_title,
    row.doc,
    row.documentName,
    row.document_name,
    row.documentRef,
    row.document_ref,
    row.name,
    row.docId,
    row.doc_id,
  );
  const kindRaw = pickString(row.kind, row.type, row.sourceType, row.source_type);
  const source = sourceOf(row);
  const summary = summaryOf(row);
  const employee = employeeOf(row);
  const locator = locatorOf(row);
  const quote = quoteOf(row);
  const origin = originOf(row, session ?? null);
  const atRaw = pickString(
    row.at,
    row.createdAt,
    row.created_at,
    row.occurredAt,
    row.occurred_at,
    row.citedAt,
    row.cited_at,
    row.time,
  );
  const at = beijing(atRaw);
  const link = linkOf(row);
  return {
    id,
    title: title ?? "—",
    titleReason: title ? null : "上游记录没有给出标题或文档名",
    kind: kindLabel(kindRaw, "evidence"),
    kindRaw,
    kindReason: kindRaw ? null : "上游记录没有给出类型",
    ...source,
    ...summary,
    ...quote,
    ...locator,
    ...origin,
    ...employee,
    at: at ?? "—",
    atRaw,
    atReason: at ? null : atRaw ? "时间无法解析" : "上游记录没有给出时间",
    href: link.href,
    unreachable: link.unreachable,
  };
}

/** A row list of references — same shape for search hits and citations. */
function referencesOf(body: unknown): SurfaceValue<CitationRow> {
  const envelope = stampOf(body);
  const rows = rowsOf(body);
  if (rows === null) return { rows: [], ...envelope, scanned: null };
  // 逐个显式调用：`map(citationOf)` 会把数组下标当第二个参数（会话）漏进去。
  const mapped = rows.map((row) => citationOf(row));
  const newest = newestOf(
    mapped.map((row) => row.atRaw),
    envelope,
    "上游响应没有带采集时间，也没有可用的记录时间，数据截至时间未知。",
  );
  return { rows: mapped, ...newest, scanned: null };
}

/** Hits from the knowledge search read. */
export function readSearch(body: unknown): SurfaceValue<CitationRow> {
  return referencesOf(body);
}

/** Citations from the knowledge citations read. */
export function readCitations(body: unknown): SurfaceValue<CitationRow> {
  return referencesOf(body);
}

/** Space / document rows from their own reads. */
export function readRows(body: unknown, tab: KnowledgeTab): SurfaceValue<KnowledgeRow> {
  const envelope = stampOf(body);
  const rows = rowsOf(body);
  if (rows === null) return { rows: [], ...envelope, scanned: null };
  return { rows: rows.map((row) => readRowOf(row, tab)), ...envelope, scanned: null };
}

/** 接入任务状态 — human words only; an unknown word is 待核实, never a silent 「成功」. */
function ingestStatusLabel(raw: string | null): string {
  if (!raw) return "待核实";
  const lower = raw.toLowerCase();
  if (["queued", "pending", "scheduled", "waiting"].includes(lower)) return "排队中";
  if (["processing", "running", "ingesting", "indexing", "syncing", "in_progress"].includes(lower)) {
    return "处理中";
  }
  if (["success", "succeeded", "completed", "done", "ok", "ready", "active", "indexed"].includes(lower)) {
    return "成功";
  }
  if (["failed", "error", "broken", "aborted"].includes(lower)) return "失败";
  if (["cancelled", "canceled", "skipped"].includes(lower)) return "已取消";
  if (["partial", "degraded", "warning"].includes(lower)) return "部分成功";
  if (["disabled", "paused", "offline", "stopped"].includes(lower)) return "已停用";
  if (["draft", "new", "unpublished"].includes(lower)) return "待处理";
  return "待核实";
}

/** Which moment a timestamp is, in the operator's words — the field name never shows. */
const TIME_KEYS: [string[], string][] = [
  [["lastSyncAt", "last_sync_at", "syncedAt", "synced_at"], "最近同步"],
  [["lastRunAt", "last_run_at", "finishedAt", "finished_at", "completedAt", "completed_at"], "最近处理"],
  [["startedAt", "started_at"], "最近开始"],
  [["updatedAt", "updated_at", "modifiedAt", "modified_at"], "最近更新"],
  [["createdAt", "created_at"], "登记时间"],
];

function momentOf(row: Rec): { atRaw: string | null; timeLabel: string | null } {
  for (const [keys, label] of TIME_KEYS) {
    const value = pickString(...keys.map((key) => row[key]));
    if (value) return { atRaw: value, timeLabel: label };
  }
  return { atRaw: null, timeLabel: null };
}

function taskOf(row: Rec): IngestTaskRow {
  const id = pickString(row.taskId, row.task_id, row.jobId, row.job_id, row.sourceId, row.source_id, row.id) ?? "";
  const name = pickString(
    row.name,
    row.title,
    row.sourceName,
    row.source_name,
    row.displayName,
    row.display_name,
  );
  const kindRaw = pickString(
    row.kind,
    row.type,
    row.sourceType,
    row.source_type,
    row.provider,
    row.mimeType,
    row.mime_type,
  );
  const statusRaw = pickString(row.status, row.state, row.taskStatus, row.task_status, row.jobStatus, row.phase);
  const done = pickNumber(
    row.processed,
    row.processedCount,
    row.processed_count,
    row.processedItems,
    row.completed,
    row.completedCount,
    row.importedCount,
    row.imported_count,
  );
  const total = pickNumber(
    row.total,
    row.totalCount,
    row.total_count,
    row.totalItems,
    row.total_items,
    row.itemCount,
    row.item_count,
    row.docCount,
    row.documentCount,
  );
  const failed = pickNumber(
    row.failed,
    row.failedCount,
    row.failed_count,
    row.errorCount,
    row.error_count,
  );
  const bytes = pickNumber(row.sizeBytes, row.size_bytes, row.bytes, row.size);
  const moment = momentOf(row);
  const at = beijing(moment.atRaw);
  let progress: string;
  let progressReason: string | null;
  if (done !== null && total !== null) {
    progress = `${done} / ${total}`;
    progressReason = null;
  } else if (total !== null) {
    progress = `共 ${total}`;
    progressReason = null;
  } else if (done !== null) {
    progress = `已完成 ${done}`;
    progressReason = null;
  } else if (bytes !== null) {
    const size = formatBytes(bytes);
    progress = size ?? "—";
    progressReason = size ? null : "上游给的字节数读不出可读大小";
  } else {
    progress = "—";
    progressReason = "上游没有给出这一条处理了多少、共多少";
  }
  return {
    id,
    name: name ?? "—",
    nameReason: name ? null : "上游没有给出这条记录叫什么",
    kind: kindLabel(kindRaw, "ingest"),
    kindRaw,
    kindReason: kindRaw ? null : "上游没有给出来源类型",
    status: ingestStatusLabel(statusRaw),
    statusRaw,
    statusReason: statusRaw ? null : "上游没有给出处理状态",
    progress,
    progressReason,
    issue: failed === null ? null : `失败 ${failed}`,
    timeLabel: moment.timeLabel,
    at: at ?? "—",
    atRaw: moment.atRaw,
    atReason: at ? null : moment.atRaw ? "上游给的时间读不出是哪一刻" : "上游没有给出时间",
  };
}

/** 接入任务 from the designated data-source read. */
export function readTasks(body: unknown): SurfaceValue<IngestTaskRow> {
  const envelope = stampOf(body);
  const rows = rowsOf(body);
  if (rows === null) return { rows: [], ...envelope, scanned: null };
  const mapped = rows.map(taskOf);
  const newest = newestOf(
    mapped.map((row) => row.atRaw),
    envelope,
    "上游响应没有带采集时间，任务也没有给出可用时间，数据截至时间未知。",
  );
  return { rows: mapped, ...newest, scanned: null };
}

export function readSessions(body: unknown): SessionSummary[] {
  const rows = rowsOf(body) ?? [];
  return rows
    .map((row) => {
      const sessionId = pickString(row.sessionId, row.session_id, row.id);
      if (!sessionId) return null;
      const employeeId = pickString(row.employeeId, row.employee_id);
      const count = pickNumber(row.messageCount, row.message_count) ?? 0;
      const updatedAt = pickString(row.updatedAt, row.updated_at);
      return { sessionId, employeeId, messageCount: count, updatedAt };
    })
    .filter((row): row is SessionSummary => row !== null);
}

/**
 * Citations the assistant messages of one session left behind.
 *
 * The documented session shape is `messages[]{seq, role, content, requestId,
 * createdAt}` with an assistant-only, only-when-non-empty `citations` list whose
 * entries carry just `{"doc": "…"}`. So this scan supplies the depth the upstream
 * really has — which turn asked it (the user message of the same `requestId`), and
 * where in the conversation the citation sits — and never invents a page, a quote
 * or a link that the read did not return.
 */
export function citationsFromDetail(body: unknown, session: SessionSummary): CitationRow[] {
  if (!isRecord(body) || !Array.isArray(body.messages)) return [];
  const out: CitationRow[] = [];
  const askedByTurn = new Map<string, string>();
  let lastAsked: string | null = null;
  for (const message of body.messages) {
    if (!isRecord(message)) continue;
    const role = pickString(message.role)?.toLowerCase();
    const content = pickString(message.content);
    const turnId = pickString(message.requestId, message.request_id);
    if (role === "user" && content) {
      lastAsked = content;
      if (turnId) askedByTurn.set(turnId, content);
    }
    if (!Array.isArray(message.citations)) continue;
    const messageAt = pickString(message.createdAt, message.created_at);
    const asked = (turnId ? askedByTurn.get(turnId) : undefined) ?? lastAsked;
    for (const raw of message.citations) {
      const row: Rec = isRecord(raw) ? raw : { title: typeof raw === "string" ? raw : null };
      out.push(
        citationOf(
          {
            ...row,
            employeeId: session.employeeId,
            at: pickString(row.at, row.createdAt, row.created_at) ?? messageAt,
            messageSeq: pickString(message.seq),
            query: asked ?? undefined,
          },
          session,
        ),
      );
    }
  }
  return out;
}

/** What the session scan read: how many sessions, and the citations they carried. */
export function sessionCitations(
  sessions: SessionSummary[],
  citations: CitationRow[],
): SurfaceValue<CitationRow> {
  const newest = newestOf(
    [...citations.map((row) => row.atRaw), ...sessions.map((row) => row.updatedAt)],
    { stamp: null, stampReason: null },
    "接口已响应，但会话和引用都没有给出可用时间，数据截至时间未知。",
  );
  return { rows: citations, ...newest, scanned: sessions.length };
}

function decisionLabel(raw: string | null): string {
  if (!raw) return "待核实";
  const lower = raw.toLowerCase();
  if (["allow", "allowed", "permit", "approved"].includes(lower)) return "允许";
  if (["deny", "denied", "reject", "rejected"].includes(lower)) return "拒绝";
  if (["n/a", "na", "not_applicable"].includes(lower)) return "不适用";
  return "待核实";
}

function outcomeLabel(raw: string | null): string {
  if (!raw) return "待核实";
  const lower = raw.toLowerCase();
  if (["success", "succeeded", "ok", "completed"].includes(lower)) return "成功";
  if (["denied", "deny", "rejected"].includes(lower)) return "拒绝";
  if (["failure", "failed", "error"].includes(lower)) return "失败";
  return "待核实";
}

function retrievalOf(row: Rec): RetrievalRow {
  const id = pickString(row.eventId, row.event_id, row.id) ?? "";
  const actor = isRecord(row.actor) ? row.actor : null;
  const actorRaw = actor ? pickString(actor.id, actor.userId, actor.user_id, actor.name) : null;
  const actorCode = shortCode(actorRaw);
  const decisionRaw = pickString(row.decision);
  const outcomeRaw = pickString(row.outcome);
  const resource = isRecord(row.resource) ? row.resource : null;
  const resourceType = resource ? pickString(resource.type) : null;
  const resourceId = resource ? pickString(resource.id) : null;
  const targetId = shortCode(resourceId);
  const typeLabel =
    resourceType === "kb_query" ? "知识查询" : resourceType === "knowledge" ? "知识空间" : "检索对象";
  const atRaw = pickString(row.occurredAt, row.occurred_at, row.recordedAt, row.recorded_at);
  const at = beijing(atRaw);
  const runId = pickString(row.runId, row.run_id);
  return {
    id,
    actor: actorCode ? `员工 · ${actorCode}` : "—",
    actorRaw,
    decision: decisionLabel(decisionRaw),
    decisionRaw,
    outcome: outcomeLabel(outcomeRaw),
    outcomeRaw,
    target: targetId ? `${typeLabel} · ${targetId}` : "—",
    targetRaw: resourceId,
    at: at ?? "—",
    atRaw,
    atReason: at ? null : atRaw ? "检索时间无法解析" : "上游事件没有给出时间",
    href: runId && runId.startsWith("run_") ? `/runs/${encodeURIComponent(runId)}` : null,
  };
}

/** Audit rows of knowledge reads — who looked, what was decided, what came of it. */
export function readRecords(body: unknown): SurfaceValue<RetrievalRow> {
  const envelope = stampOf(body);
  const rows = rowsOf(body);
  if (rows === null) return { rows: [], ...envelope, scanned: null };
  const mapped = rows.map(retrievalOf);
  const newest = newestOf(
    mapped.map((row) => row.atRaw),
    envelope,
    "上游响应没有带采集时间，也没有可用的事件时间，数据截至时间未知。",
  );
  return { rows: mapped, ...newest, scanned: null };
}

export function initialTab(value: string | null, panel: string | null = null): KnowledgeTab {
  const internal = (panel ?? "").toLowerCase();
  if (internal === "ingest" || internal === "sources") return "ingest";
  if (internal === "retrieval" || internal === "search") return "retrieval";
  if (internal === "evidence" || internal === "citations") return "evidence";
  if (internal === "spaces" || internal === "scope") return "spaces";
  const tab = (value ?? "").toLowerCase();
  if (tab === "ingest" || tab === "sources") return "ingest";
  if (tab === "retrieval" || tab === "search") return "retrieval";
  if (tab === "evidence" || tab === "citations") return "evidence";
  return "spaces";
}
