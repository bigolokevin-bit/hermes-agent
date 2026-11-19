/**
 * Knowledge tabs — read-side adapters.
 *
 * GAP-03: the console BFF exposes no knowledge/document/retrieval read route.
 * Probes return `console.unknown_route` (404). The page therefore renders
 * 「未接入」 for those tabs and never fabricates spaces, documents or hits.
 * The evidence tab reuses the real run-events citation read; it has no fixture
 * fallback here.
 */

export const KNOWLEDGE_GAP = "GAP-03";

export const GAP03_HUMAN =
  "知识服务读取接口尚未接入本控制台。接入后这里会自动显示真实数据；现在不展示样例，也不把缺失值写成 0。";

export type KnowledgePhase =
  | "loading"
  | "ready"
  | "empty"
  | "unavailable"
  | "error"
  | "denied"
  | "login";

export type KnowledgeTab = "spaces" | "ingest" | "retrieval" | "evidence";

export const TAB_LABEL: Record<KnowledgeTab, string> = {
  spaces: "知识空间",
  ingest: "数据接入",
  retrieval: "检索",
  evidence: "证据与引用",
};

export const TAB_SOURCE: Record<KnowledgeTab, string> = {
  spaces: "知识空间登记",
  ingest: "文档与数据接入登记",
  retrieval: "检索结果",
  evidence: "运行事件引用",
};

export type Endpoint = { url: string; testid: string };

export const ENDPOINTS: Record<KnowledgeTab, Endpoint> = {
  spaces: { url: "/agent-api/api/knowledge/spaces", testid: "knw4-source-spaces" },
  ingest: { url: "/agent-api/api/documents?limit=50", testid: "knw4-source-ingest" },
  retrieval: { url: "/agent-api/api/retrieval", testid: "knw4-source-retrieval" },
  evidence: { url: "/agent-api/api/run-events?kind=citation&limit=50", testid: "knw4-source-evidence" },
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

export interface CitationRow {
  id: string;
  title: string;
  kind: string;
  employee: string;
  employeeRaw: string | null;
  at: string;
  href: string | null;
  unreachable: string | null;
}

export interface KnowledgePayload {
  rows: KnowledgeRow[];
  citations: CitationRow[];
  stamp: string | null;
  stampReason: string | null;
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

function rowsOf(body: unknown): Rec[] | null {
  if (Array.isArray(body)) return body.filter(isRecord);
  if (!isRecord(body)) return null;
  const direct = [body.items, body.data, body.rows, body.list];
  for (const value of direct) {
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  if (isRecord(body.data)) {
    const nested = [body.data.items, body.data.rows, body.data.list];
    for (const value of nested) {
      if (Array.isArray(value)) return value.filter(isRecord);
    }
  }
  return null;
}

function stampOf(body: unknown): { stamp: string | null; stampReason: string | null } {
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

function rowOf(row: Rec, tab: KnowledgeTab): KnowledgeRow {
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
  const kindRaw = pickString(row.kind, row.type, row.scope, row.space_type, row.spaceType, row.doc_type, row.docType, row.mimeType, row.mime_type);
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
  const updatedRaw = pickString(row.updatedAt, row.updated_at, row.modifiedAt, row.modified_at, row.lastUpdated, row.last_updated);
  const updatedAt = beijing(updatedRaw);
  const statusRaw = pickString(row.status, row.state, row.indexStatus, row.index_status);
  const status = statusLabel(statusRaw);
  return {
    id,
    name: name ?? "待核实",
    nameReason: name ? null : "上游未提供名称",
    kind: kindLabel(kindRaw, tab),
    kindRaw,
    kindReason: kindRaw ? null : "上游未提供类型",
    scale: count !== null ? `${count} 条` : sizeText ?? "—",
    scaleReason: count !== null || sizeText !== null ? null : "上游未提供条数或大小",
    updatedAt: updatedAt ?? "—",
    updatedReason: updatedAt ? null : updatedRaw ? "更新时间无法解析" : "上游未提供更新时间",
    status,
    statusRaw,
    statusReason: statusRaw ? null : "上游未提供状态",
  };
}

function citationOf(row: Rec): CitationRow {
  const id = pickString(row.id, row.eventId, row.event_id, row.citationId, row.citation_id) ?? "";
  const title = pickString(row.title, row.name, row.summary, row.snippet, row.quote) ?? "待核实";
  const kindRaw = pickString(row.kind, row.type, row.sourceType, row.source_type);
  const employeeId = pickString(row.employeeId, row.employee_id);
  const employeeName = pickString(row.employeeName, row.employee_name, row.name);
  const code = shortCode(employeeId);
  const employee = employeeName && code
    ? `${employeeName} · ${code}`
    : employeeName ?? (code ? `员工 · ${code}` : "未指派");
  const at = beijing(pickString(row.at, row.createdAt, row.created_at, row.occurredAt, row.occurred_at, row.time));
  const hrefRaw = pickString(row.href, row.url, row.link);
  const href = hrefRaw && (hrefRaw.startsWith("/") || hrefRaw.startsWith("#")) ? hrefRaw : null;
  const unreachable = href
    ? null
    : hrefRaw
      ? "上游给出的原文位置不是站内地址，无法直接打开。"
      : "上游没有给出原文位置，无法打开原文。";
  return {
    id,
    title,
    kind: kindLabel(kindRaw, "evidence"),
    employee,
    employeeRaw: employeeId,
    at: at ?? "—",
    href,
    unreachable,
  };
}

export function readKnowledge(tab: KnowledgeTab, body: unknown): KnowledgePayload {
  const stamp = stampOf(body);
  if (tab === "evidence") {
    const rows = rowsOf(body);
    if (rows === null) {
      return { rows: [], citations: [], ...stamp };
    }
    return { rows: [], citations: rows.map(citationOf), ...stamp };
  }
  const rows = rowsOf(body);
  if (rows === null) {
    return { rows: [], citations: [], ...stamp };
  }
  return { rows: rows.map((row) => rowOf(row, tab)), citations: [], ...stamp };
}

export function isForcedState(value: string): value is "loading" | "empty" | "error" | "denied" {
  return value === "loading" || value === "empty" || value === "error" || value === "denied";
}

export function initialTab(value: string | null, panel: string | null = null): KnowledgeTab {
  const internal = (panel ?? "").toLowerCase();
  if (internal === "ingest" || internal === "sources") return "ingest";
  if (internal === "retrieval") return "retrieval";
  if (internal === "evidence" || internal === "citations") return "evidence";
  if (internal === "spaces" || internal === "scope") return "spaces";
  const tab = (value ?? "").toLowerCase();
  if (tab === "ingest" || tab === "sources") return "ingest";
  if (tab === "retrieval") return "retrieval";
  if (tab === "evidence" || tab === "citations") return "evidence";
  return "spaces";
}