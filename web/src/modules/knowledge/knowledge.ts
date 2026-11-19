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

/**
 * The spaces surface names its own read, so a reviewer can tell which read is
 * missing. A 403 and a 404 still draw this same pair — only the request id differs.
 */
/**
 * The spaces surface names its own read and its own way forward, and it says which
 * other surface can already be read while this one stays closed.
 */
/**
 * One paragraph for every way this space can be unreadable — 403, 404 and a missing
 * space id all draw it, because the page must not guess which answer the service gave.
 */
export const SPACE_DOC_UNWIRED_HEAD = "空间不存在或未授权";
export const SPACE_DOC_UNWIRED_HUMAN =
  "这个空间可能不存在，当前账号可能没有查看它的权限，或者文档读口本身尚未接入本控制台。这三种情况这里给同一段说明：页面不靠回答的差别去猜服务给了哪一个。读口接上或权限开通后，这里会列出这个空间里的真实文档；在此之前不编文档、不放样例、也不给数量。";

export const SPACES_UNWIRED_HEAD = "知识空间未接入";
export const SPACES_UNWIRED_HUMAN =
  "知识空间接口尚未接入本控制台，或当前账号没有查看它的权限。现在这里列不出任何空间：不编空间、不放样例，也不给数量。想先看在用知识的内容，可以打开「证据与引用」看会话里留下的引用；要开通这枚读口，去审批中心提交申请。接入或开通后，这页会自动列出真实空间、各自的来源、文档数、最近同步时间与状态。";

/**
 * The ingest tab reads two things, and the BFF answers them with two different
 * fail-closed codes — so each body names the read that is actually missing.
 * A 403 and a 404 for the same read still draw the same words.
 */
export const TASKS_UNWIRED_HEAD = "数据源接入读口未接入";
export const TASKS_UNWIRED_HUMAN =
  "数据源的接入状态接口尚未接入本控制台，或当前账号没有查看它的权限。接入或开通后，这里会按源逐行列出最近同步、同步状态与条目数；在此之前不展示样例，也不写「0 个源」。";

export const INGEST_STATUS_UNWIRED_HEAD = "入库状态未接入";
export const INGEST_STATUS_UNWIRED_HUMAN =
  "知识内容的入库状态接口尚未接入本控制台，或当前账号没有查看它的权限。接入后这里会按来源逐行列出最近同步、进行或完成的状态、失败原因与条目数；在此之前不展示样例，也不写「0 个源」。";

/**
 * The search read: this page is where an operator asks the knowledge base a
 * question, so its body says what to do instead of looking at a blank box.
 */
export const SEARCH_UNWIRED_HEAD = "检索未接入";
export const SEARCH_UNWIRED_HUMAN =
  "知识库的检索接口尚未接入本控制台，或当前账号没有查看它的权限。现在这里搜不出结果：接口没通时不编命中、不给命中数、不放样例。要读已被引用的内容，可看「证据与引用」里会话留下的引用；要开通这枚读口，去审批中心提交申请。";

export const DOCUMENTS_UNWIRED_HEAD = "文档登记读口未接入";
export const DOCUMENTS_UNWIRED_HUMAN =
  "文档登记接口尚未接入本控制台，或当前账号没有查看它的权限。接入或开通后，这里会列出真实登记的文档与其数量、更新时间和状态；在此之前不展示样例，也不写「0 篇」。";

export type KnowledgeTab = "spaces" | "ingest" | "retrieval" | "evidence";

export const TAB_LABEL: Record<KnowledgeTab, string> = {
  spaces: "知识空间",
  ingest: "数据接入",
  retrieval: "检索",
  evidence: "证据与引用",
};

export const TAB_ORDER: KnowledgeTab[] = ["spaces", "ingest", "retrieval", "evidence"];

/** Read URLs — one per surface, so every body can say where it came from. */
export const SPACES_URL = "/agent-api/api/knowledge/spaces?limit=20";
export const DOCUMENTS_URL = "/agent-api/api/documents?limit=50";

/**
 * The document list of one space. `/api/documents` is the designated document read:
 * the BFF names it as its own fail-closed route (R34 NC③ — `documents.read_not_wired`,
 * 「前端请显『未接入』」), and today the route is intercepted before any query is read,
 * so `spaceId` is the natural filter once it is wired but is NOT proven server-side.
 * That is also why the 名称 filter on this surface is local and says so.
 */
export function documentsUrl(spaceId: string): string {
  const params = new URLSearchParams();
  params.set("limit", "50");
  params.set("spaceId", spaceId);
  return `/agent-api/api/documents?${params.toString()}`;
}
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
/**
 * 入库状态. Probed 2026-11-20 with the login cookie: this path is NOT one of the
 * three the BFF names for itself — it answers the generic
 * `{"code":"console.unknown_route"}`, while `/api/knowledge/spaces` answers
 * `{"code":"knowledge.not_wired","rid":"b9f1187b"}`. So the surface is wired to the
 * status path the dispatcher asked for, and today it honestly reports 「入库状态未接入」
 * instead of borrowing the sources read's numbers.
 */
export const INGEST_STATUS_URL = "/agent-api/api/knowledge/ingest-status?limit=20";

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
  | "space-docs"
  | "ingest-status"
  | "tasks"
  | "documents"
  | "search"
  | "records"
  | "citations"
  | "session-cites";

/** Human label for each surface's source line — no route, no field name. */
export const SURFACE_SOURCE: Record<SurfaceKey, string> = {
  spaces: "知识空间登记",
  "space-docs": "空间内文档登记",
  "ingest-status": "知识入库状态",
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
/**
 * 一个数据源接入条：名称 / 类型 / 最近动作 / 状态 / 条目数。
 * 状态用运营看得懂的四个词，上游没给的字段一律「—」并说明缺什么。
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
  /** 失败原因（人话那一份）；技术性原文只进 `title`。 */
  failure: string | null;
  failureRaw: string | null;
  /** 「最近同步 / 最近处理 / 最近更新 / 登记时间」——按上游真给的哪一个。 */
  timeLabel: string | null;
  at: string;
  atRaw: string | null;
  atReason: string | null;
  count: string;
  countReason: string | null;
  /** 真实存在时的补充：已处理 N，或只有大小时写约 X KB。 */
  extra: string | null;
}

/**
 * 一个知识空间：名称 / 文档数 / 最近同步 / 状态。文档数只认真正表示“多少篇”的字段，
 * 真 0 就是 0，没给就写「—」并说明缺什么；状态认不出来就「待核实」。
 */
export interface SpaceRow {
  id: string;
  name: string;
  nameReason: string | null;
  /** 来源人话：这个空间的内容从哪里来。 */
  source: string;
  sourceRaw: string | null;
  sourceReason: string | null;
  /** 上游给了才作为副行显示；缺字段不占位、不编「其他类型」。 */
  kind: string | null;
  kindRaw: string | null;
  docs: string;
  docsReason: string | null;
  docsExtra: string | null;
  timeLabel: string | null;
  at: string;
  atRaw: string | null;
  atReason: string | null;
  status: string;
  statusRaw: string | null;
  statusReason: string | null;
  failure: string | null;
  failureRaw: string | null;
}

/** One reference to a document: a search hit or a citation. Both are drawn by the same
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
  /** 目标对象：这段引用指的是哪个文档/片段/记录；原值只进 title。 */
  target: string;
  targetRaw: string | null;
  targetReason: string | null;
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
  "docs",
  "files",
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

/** Who an upstream object says acted: a digital employee or a person, never a raw id. */
function actorKindLabel(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (["employee", "agent", "bot", "digital_employee", "worker"].includes(lower)) return "数字员工";
  if (["human", "user", "person", "operator", "staff"].includes(lower)) return "真人账号";
  if (["system", "scheduler", "beat", "cron"].includes(lower)) return "系统";
  return "待核实";
}

/**
 * A shortened handle for an actor. A leading copy of the kind word (`human:1`,
 * `employee_…`) is stripped first, and a tail too short to identify anything is
 * dropped: the page then says only the kind and keeps the raw value in `title`,
 * instead of printing a fragment of the id that reads like the id itself.
 */
function actorCode(id: string | null, typeRaw: string | null): string | null {
  if (!id) return null;
  const compact = id.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  const prefix = (typeRaw ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  const stripped = prefix.length >= 3 && compact.startsWith(prefix) ? compact.slice(prefix.length) : compact;
  const tail = stripped.slice(-8);
  return tail.length >= 4 ? tail : null;
}

/**
 * Attribution for a row. `emp_…`, `human:1`, `user_id` and friends never reach the
 * screen: the kind is translated, the id is shortened, and the raw value rides in
 * `employeeRaw` so the page can put it in a `title`.
 */
function employeeOf(row: Rec): {
  employee: string;
  employeeRaw: string | null;
  employeeReason: string | null;
} {
  const actor = isRecord(row.actor) ? row.actor : null;
  const createdBy = isRecord(row.createdBy) ? row.createdBy : null;
  const from = actor ?? createdBy;
  const employeeId =
    pickString(row.employeeId, row.employee_id) ??
    (from ? pickString(from.id, from.userId, from.user_id, from.employeeId, from.employee_id) : null);
  const employeeName =
    pickString(row.employeeName, row.employee_name) ?? (from ? pickString(from.name, from.displayName) : null);
  const typeRaw = pickString(row.employeeKind, row.employee_kind) ?? (from ? pickString(from.type, from.kind) : null);
  const kind = actorKindLabel(typeRaw);
  const code = actorCode(employeeId, typeRaw);
  const prefix = kind === "真人账号" ? "真人账号" : kind === "系统" ? "系统" : kind ? kind : "员工";
  if (employeeName && code) {
    return { employee: `${employeeName} · ${code}`, employeeRaw: employeeId, employeeReason: null };
  }
  if (employeeName) return { employee: employeeName, employeeRaw: employeeId, employeeReason: null };
  if (code) return { employee: `${prefix} · ${code}`, employeeRaw: employeeId, employeeReason: null };
  if (kind) return { employee: prefix, employeeRaw: employeeId, employeeReason: null };
  return { employee: "—", employeeRaw: null, employeeReason: "上游没有说明这段内容是谁留下的" };
}

/**
 * 目标对象: what the citation actually points at — a document, a chunk, a record.
 * The wording says which kind of object it is; the raw identifier stays off screen.
 */
function targetOf(row: Rec): {
  target: string;
  targetRaw: string | null;
  targetReason: string | null;
} {
  const resource = isRecord(row.resource) ? row.resource : null;
  const kindRaw = pickString(
    row.targetType,
    row.target_type,
    row.entityType,
    row.entity_type,
    row.objectType,
    row.object_type,
    row.docType,
    row.doc_type,
    row.sourceType,
    row.source_type,
    resource?.type,
  );
  const idRaw = pickString(
    row.targetId,
    row.target_id,
    row.documentId,
    row.document_id,
    row.docId,
    row.doc_id,
    row.chunkId,
    row.chunk_id,
    row.recordId,
    row.record_id,
    row.entityId,
    row.entity_id,
    row.objectId,
    row.object_id,
    resource?.id,
  );
  // A document name already belongs to the 来源 column; 目标对象 names the object
  // it points at, so an explicit target label wins and anything else becomes a
  // typed handle built from the identifier the read did return.
  const name = pickString(row.targetName, row.target_name, resource?.name);
  const lower = (kindRaw ?? "").toLowerCase();
  let kindWord = "文档";
  if (["chunk", "segment", "passage"].includes(lower)) kindWord = "知识片段";
  else if (["record", "row", "entity"].includes(lower)) kindWord = "业务记录";
  else if (["space", "kb", "knowledge"].includes(lower)) kindWord = "知识空间";
  else if (["url", "web", "page"].includes(lower)) kindWord = "网页";
  else if (!kindRaw && !idRaw && !name) {
    return { target: "—", targetRaw: null, targetReason: "上游没有说明这段引用指向哪个对象" };
  }
  const label = name ?? (shortCode(idRaw) ? `${kindWord} · ${shortCode(idRaw)}` : kindWord);
  return { target: label, targetRaw: idRaw ?? kindRaw ?? null, targetReason: null };
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
  const target = targetOf(row);
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
    ...target,
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
/**
 * 运营看到的四个状态词：待同步 / 同步中 / 失败 / 已完成（外加确实存在的
 * 部分完成、已停用、已取消）。上游没给状态就写「待核实」，不猜。
 */
function ingestStatusLabel(raw: string | null): string {
  if (!raw) return "待核实";
  const lower = raw.toLowerCase().replace(/[-\s]/g, "_");
  if (["queued", "pending", "scheduled", "waiting", "not_started", "new", "draft"].includes(lower)) {
    return "待同步";
  }
  if (
    ["processing", "running", "syncing", "sync", "ingesting", "indexing", "in_progress", "transferring", "uploading"].includes(
      lower,
    )
  ) {
    return "进行中";
  }
  if (["failed", "error", "broken", "aborted"].includes(lower)) return "失败";
  if (
    ["completed", "succeeded", "success", "done", "finished", "ok", "indexed", "normal", "available", "active", "ready"].includes(
      lower,
    )
  ) {
    return "已完成";
  }
  if (["partial", "degraded", "warning"].includes(lower)) return "部分完成";
  if (["cancelled", "canceled", "skipped"].includes(lower)) return "已取消";
  if (["disabled", "paused", "offline", "stopped"].includes(lower)) return "已停用";
  if (["never_synced", "never", "unsynced"].includes(lower)) return "待同步";
  return "待核实";
}

/** 数据源类型的人话；认不出的原样留着（它本来就是运营认得的工具名）。 */
function sourceKindLabel(raw: string | null): string {
  if (!raw) return "—";
  const lower = raw.toLowerCase();
  if (["sharepoint", "sp"].includes(lower)) return "SharePoint";
  if (["s3", "oss", "cos", "gcs", "azure_blob", "azureblob"].includes(lower)) return "对象存储";
  if (["http", "https", "web", "crawler", "website"].includes(lower)) return "网页抓取";
  if (["ftp", "sftp", "nfs", "smb"].includes(lower)) return "文件服务器";
  if (["mysql", "postgres", "postgresql", "dm8", "oracle", "sqlserver", "database", "db"].includes(lower)) {
    return "数据库";
  }
  if (["api", "rest", "webhook"].includes(lower)) return "接口同步";
  if (["upload", "local", "file", "files"].includes(lower)) return "本地上传";
  if (["knowledge", "kb", "space"].includes(lower)) return "知识库";
  if (["pdf", "application/pdf"].includes(lower)) return "PDF";
  if (["md", "markdown", "text/markdown"].includes(lower)) return "Markdown";
  if (["doc", "docx", "word", "application/msword"].includes(lower)) return "Word 文档";
  return raw;
}

/**
 * 失败原因。人话就直接上屏；技术性原文（堆栈、地址、状态码、字段名）只进 `title`，
 * 屏面改说这一条读不得的原因，不替上游编一句好话。
 */
function failureOf(row: Rec, status: string): { failure: string | null; failureRaw: string | null } {
  if (!["失败", "部分完成", "部分可用"].includes(status)) return { failure: null, failureRaw: null };
  const raw = pickString(
    row.failureReason,
    row.failure_reason,
    row.lastError,
    row.last_error,
    row.errorMessage,
    row.error_message,
    row.errorDetail,
    row.error_detail,
    row.reason,
    row.error,
  );
  if (!raw) {
    return { failure: "上游只说这一条没成，没给出为什么", failureRaw: null };
  }
  const technical =
    /[A-Z]{4,}_|[A-Z]{4,}\d|https?:\/\/|\|row [0-9]+|:[0-9]{2,5}\b|\b(50[0-9]|40[0-9])\b|\/[a-z0-9_.-]+\/[a-z0-9_.-]+/i.test(
      raw,
    ) || raw.length > 96;
  return { failure: technical ? null : raw, failureRaw: raw };
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
  const statusRaw = pickString(
    row.status,
    row.state,
    row.taskStatus,
    row.task_status,
    row.jobStatus,
    row.job_status,
    row.syncStatus,
    row.sync_status,
    row.phase,
  );
  const status = ingestStatusLabel(statusRaw);
  const failure = failureOf(row, status);
  const done = pickNumber(
    row.processed,
    row.processedCount,
    row.processed_count,
    row.processedItems,
    row.importedCount,
    row.imported_count,
  );
  const items = pickNumber(
    row.itemCount,
    row.item_count,
    row.items,
    row.entryCount,
    row.entry_count,
    row.recordCount,
    row.record_count,
    row.objectCount,
    row.totalItems,
    row.total_items,
    row.documentCount,
    row.document_count,
    row.docCount,
    row.doc_count,
    row.total,
    row.totalCount,
    row.total_count,
    row.count,
  );
  const failed = pickNumber(row.failed, row.failedCount, row.failed_count, row.errorCount, row.error_count);
  const bytes = pickNumber(row.sizeBytes, row.size_bytes, row.storageBytes, row.storage_bytes, row.bytes);
  const moment = syncMomentOf(row);
  const at = beijing(moment.atRaw);
  // 条目数只认真正表示“多少条”的字段；真给了 0 就写 0，没给就写「—」并说明缺什么。
  let count: string;
  let countReason: string | null;
  if (items !== null) {
    count = `${items.toLocaleString("zh-CN")} 条`;
    countReason = null;
  } else {
    count = "—";
    countReason = "上游没有给出这一条有多少条目";
  }
  const extras: string[] = [];
  if (items !== null && done !== null && done !== items) extras.push(`已处理 ${done.toLocaleString("zh-CN")} 条`);
  if (failed !== null) extras.push(`失败 ${failed.toLocaleString("zh-CN")} 条`);
  const size = formatBytes(bytes);
  if (items === null && size !== null) extras.push(`约 ${size}`);
  return {
    id,
    name: name ?? "—",
    nameReason: name ? null : "上游没有给出这个数据源叫什么",
    kind: sourceKindLabel(kindRaw),
    kindRaw,
    kindReason: kindRaw ? null : "上游没有给出来源类型",
    status,
    statusRaw,
    statusReason: statusRaw ? null : "上游没有给出同步状态",
    ...failure,
    timeLabel: moment.timeLabel,
    at: at ?? "—",
    atRaw: moment.atRaw,
    atReason: at ? null : moment.atRaw ? "上游给的时间读不出是哪一刻" : "上游没有给出时间",
    count,
    countReason,
    extra: extras.length > 0 ? extras.join(" · ") : null,
  };
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

/** 空间状态的人话；认不出来或没给都落到「待核实」，不猜一个好听的。 */
function spaceStatusLabel(raw: string | null): string {
  if (!raw) return "待核实";
  const lower = raw.toLowerCase().replace(/[-\s]/g, "_");
  if (["indexed", "indexing_done", "synced", "synchronized", "completed", "up_to_date"].includes(lower)) {
    return "已同步";
  }
  if (["indexing", "syncing", "processing", "running", "in_progress", "updating"].includes(lower)) {
    return "同步中";
  }
  if (["queued", "pending", "scheduled", "waiting", "never_synced", "not_synced"].includes(lower)) {
    return "待同步";
  }
  if (["failed", "error", "broken"].includes(lower)) return "失败";
  if (["disabled", "paused", "offline", "archived"].includes(lower)) return "已停用";
  if (["active", "enabled", "ready", "normal", "available", "ok"].includes(lower)) return "可用";
  if (["degraded", "partial", "warning"].includes(lower)) return "部分可用";
  return "待核实";
}

/**
 * The moment a row last moved, preferring a real sync/index stamp over a plain row
 * update, and naming which one it was — a row update is never shown as a sync.
 */
function syncMomentOf(row: Rec): { atRaw: string | null; timeLabel: string | null } {
  const sync = pickString(
    row.lastSyncAt,
    row.last_sync_at,
    row.syncedAt,
    row.synced_at,
    row.lastIndexedAt,
    row.last_indexed_at,
    row.indexedAt,
    row.indexed_at,
  );
  if (sync) return { atRaw: sync, timeLabel: "最近同步" };
  return momentOf(row);
}

/**
 * 来源人话 for a space: where its content is actually pulled from. A name is shown
 * as it is; a bare connector or URL becomes the tool's own word (plus its host), and
 * nothing is invented when the read stays silent.
 */
function spaceSourceOf(row: Rec): {
  source: string;
  sourceRaw: string | null;
  sourceReason: string | null;
} {
  const name = pickString(
    row.sourceName,
    row.source_name,
    row.repositoryName,
    row.repository_name,
    row.bucketName,
    row.bucket_name,
    row.spaceSource,
    row.space_source,
  );
  const kindRaw = pickString(row.provider, row.sourceType, row.source_type, row.originType, row.origin_type);
  const origin = pickString(row.origin, row.syncSource, row.sync_source, row.repository, row.repo, row.bucket, row.source);
  const explicit = pickString(row.targetName, row.target_name);
  if (explicit) return { source: explicit, sourceRaw: null, sourceReason: null };
  if (name) return { source: name, sourceRaw: origin ?? kindRaw ?? null, sourceReason: null };
  if (origin) {
    const urlHost = origin.match(/^https?:\/\/([^/?#]+)/i);
    if (urlHost !== null) {
      const word = kindRaw ? sourceKindLabel(kindRaw) : "外部地址";
      return { source: `${word} · ${urlHost[1]}`, sourceRaw: origin, sourceReason: null };
    }
    const word = kindRaw ? sourceKindLabel(kindRaw) : sourceKindLabel(origin);
    // A recognised tool name is the human wording; anything else is shown as the
    // value itself rather than dressed up with a label that repeats it.
    return { source: word !== origin ? word : origin, sourceRaw: origin, sourceReason: null };
  }
  if (kindRaw) return { source: sourceKindLabel(kindRaw), sourceRaw: kindRaw, sourceReason: null };
  return { source: "—", sourceRaw: null, sourceReason: "上游没有说明这个空间的内容从哪里来" };
}

function spaceOf(row: Rec): SpaceRow {
  const id = pickString(row.spaceId, row.space_id, row.knowledgeId, row.knowledge_id, row.id) ?? "";
  const name = pickString(row.name, row.spaceName, row.space_name, row.title, row.displayName, row.display_name);
  const kindRaw = pickString(row.scope, row.kind, row.type, row.spaceType, row.space_type, row.visibility);
  const docs = pickNumber(
    row.documentCount,
    row.document_count,
    row.docCount,
    row.doc_count,
    row.documents,
    row.totalDocuments,
    row.total_documents,
    row.itemCount,
    row.item_count,
    row.total,
  );
  const chunks = pickNumber(row.chunkCount, row.chunk_count, row.chunks);
  const bytes = pickNumber(row.sizeBytes, row.size_bytes, row.storageBytes, row.storage_bytes, row.bytes);
  const statusRaw = pickString(row.status, row.state, row.indexStatus, row.index_status, row.syncStatus, row.sync_status);
  const status = spaceStatusLabel(statusRaw);
  const failure = failureOf(row, status);
  const source = spaceSourceOf(row);
  const moment = syncMomentOf(row);
  const at = beijing(moment.atRaw);
  const extras: string[] = [];
  if (docs === null && chunks !== null) extras.push(`分块 ${chunks.toLocaleString("zh-CN")} 段`);
  if (docs === null && bytes !== null) {
    const size = formatBytes(bytes);
    if (size !== null) extras.push(`约 ${size}`);
  }
  return {
    id,
    name: name ?? "—",
    nameReason: name ? null : "上游没有给出这个空间叫什么",
    ...source,
    kind: kindRaw ? kindLabel(kindRaw, "spaces") : null,
    kindRaw,
    docs: docs === null ? "—" : `${docs.toLocaleString("zh-CN")} 篇`,
    docsReason: docs === null ? "上游没有给出这个空间有多少文档" : null,
    docsExtra: extras.length > 0 ? extras.join(" · ") : null,
    timeLabel: moment.timeLabel,
    at: at ?? "—",
    atRaw: moment.atRaw,
    atReason: at ? null : moment.atRaw ? "上游给的时间读不出是哪一刻" : "上游没有给出时间",
    status,
    statusRaw,
    statusReason: statusRaw ? null : "上游没有给出空间状态",
    ...failure,
  };
}

/**
 * 一个文档行：名称 / 类型 / 大小 / 更新。缺的那一项显示「—」，原因写进 `title`，
 * 屏面不出现字段名；数量与大小都不猜。
 */
export interface DocRow {
  id: string;
  name: string;
  /** 缺字段的原因，只进 title。 */
  nameHint: string | null;
  type: string;
  typeRaw: string | null;
  typeHint: string | null;
  size: string;
  sizeHint: string | null;
  at: string;
  atRaw: string | null;
  atHint: string | null;
  /** 站内可打开的原文位置；站外或缺失为 null。 */
  href: string | null;
  /** 打不开时这一条自己的原因（屏面可见）。 */
  unreachable: string | null;
}

/** 文档类型的人话；认不出的值原样留着（它就是运营认得的扩展名）。 */
function docTypeLabel(raw: string | null): string {
  if (!raw) return "—";
  const lower = raw.toLowerCase().replace(/^\./, "");
  const map: Record<string, string> = {
    pdf: "PDF",
    doc: "Word 文档",
    docx: "Word 文档",
    word: "Word 文档",
    xls: "表格",
    xlsx: "表格",
    csv: "表格（CSV）",
    ppt: "演示文稿",
    pptx: "演示文稿",
    md: "Markdown",
    markdown: "Markdown",
    txt: "文本",
    text: "文本",
    json: "结构化数据",
    html: "网页",
    htm: "网页",
    png: "图片",
    jpg: "图片",
    jpeg: "图片",
  };
  if (map[lower]) return map[lower];
  const mime = raw.toLowerCase().split("/").pop() ?? "";
  if (map[mime]) return map[mime];
  return raw;
}

function docOf(row: Rec): DocRow {
  const id = pickString(row.documentId, row.document_id, row.docId, row.doc_id, row.fileId, row.file_id, row.id) ?? "";
  const name = pickString(row.fileName, row.file_name, row.documentName, row.document_name, row.title, row.name);
  const typeRaw = pickString(row.docType, row.doc_type, row.mimeType, row.mime_type, row.fileType, row.file_type, row.type, row.extension, row.suffix);
  const bytes = pickNumber(row.sizeBytes, row.size_bytes, row.storageBytes, row.storage_bytes, row.bytes, row.size);
  const size = formatBytes(bytes);
  const moment = syncMomentOf(row);
  const at = beijing(moment.atRaw);
  const link = linkOf(row);
  return {
    id,
    name: name ?? "—",
    nameHint: name ? null : "上游没有给出这份文档叫什么",
    type: docTypeLabel(typeRaw),
    typeRaw,
    typeHint: typeRaw ? null : "上游没有给出文档类型",
    size: size ?? "—",
    sizeHint: size ? null : bytes !== null ? "上游给的数值读不出可读大小" : "上游没有给出文件大小",
    at: at ?? "—",
    atRaw: moment.atRaw,
    atHint: at ? null : moment.atRaw ? "上游给的时间读不出是哪一刻" : "上游没有给出更新时间",
    href: link.href,
    unreachable: link.unreachable,
  };
}

/** Documents of one space, from the designated document read. */
export function readSpaceDocuments(body: unknown): SurfaceValue<DocRow> {
  const envelope = stampOf(body);
  const rows = rowsOf(body);
  if (rows === null) return { rows: [], ...envelope, scanned: null };
  const mapped = rows.map(docOf);
  const newest = newestOf(
    mapped.map((row) => row.atRaw),
    envelope,
    "上游响应没有带采集时间，文档也没有给出可用时间，数据截至时间未知。",
  );
  return { rows: mapped, ...newest, scanned: null };
}

/** Spaces from the designated knowledge-space read. */
export function readSpaces(body: unknown): SurfaceValue<SpaceRow> {
  const envelope = stampOf(body);
  const rows = rowsOf(body);
  if (rows === null) return { rows: [], ...envelope, scanned: null };
  const mapped = rows.map(spaceOf);
  const newest = newestOf(
    mapped.map((row) => row.atRaw),
    envelope,
    "上游响应没有带采集时间，空间也没有给出可用时间，数据截至时间未知。",
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
