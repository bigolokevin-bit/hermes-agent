/**
 * 工具与 MCP — read-side adapters.
 *
 * Two real Hermes dashboard reads, both same-origin and authenticated by the
 * app's normal fetchJSON path (session token in loopback, cookie in gated mode):
 *   GET /api/tools/toolsets
 *   GET /api/mcp/servers
 *
 * No fixture is ever painted for a successful answer. The only fixture is the
 * clearly marked field example shown when BOTH routes are absent (404), and it
 * carries data-fixture + a GAP title; it never impersonates a live row.
 */
import { ApiError, errorMessage } from "@/lib/api-error";
import { fetchJSON } from "@/lib/api";

export const TOOLSETS_PATH = "/api/tools/toolsets";
export const SERVERS_PATH = "/api/mcp/servers";
export const GAP = "GAP-04";

export type ToolStatus = "enabled" | "disabled" | "unknown";
export type CredentialState = "configured" | "missing" | "unknown";

export interface ToolRow {
  key: string;
  name: string;
  nameReason: string | null;
  type: string;
  typeReason: string | null;
  status: ToolStatus;
  statusRaw: string | null;
  statusReason: string | null;
  credential: CredentialState;
  credentialRaw: string | null;
  credentialReason: string | null;
  lastUsed: string | null;
  lastUsedReason: string | null;
  rawId: string | null;
  detail: string[];
  failure?: string | null;
  failureReason?: string | null;
  source: "toolset" | "mcp";
}

export interface FixtureRead {
  kind: "fixture";
}

export interface RowsRead {
  kind: "rows";
  rows: ToolRow[];
  toolsetRows: number;
  mcpRows: number;
}

export type ToolRead = RowsRead | FixtureRead;

const TOOLSET_LABEL: Record<string, string> = {
  web: "网页搜索与抓取",
  browser: "浏览器自动化",
  terminal: "终端与进程",
  file: "文件操作",
  code_execution: "代码执行",
  vision: "图像分析",
  video: "视频分析",
  image_gen: "图像生成",
  video_gen: "视频生成",
  x_search: "X 搜索",
  tts: "文本转语音",
  stt: "语音转文字",
  skills: "技能",
  todo: "任务规划",
  kanban: "看板",
  memory: "记忆",
  context_engine: "上下文引擎",
  session_search: "会话检索",
  connections: "连接管理",
  clarify: "澄清提问",
  delegation: "任务委派",
  cronjob: "定时任务",
  discord: "Discord 参与",
  discord_admin: "Discord 管理",
  computer_use: "电脑操作",
  a2a: "A2A 协作",
};

const TOOL_LABEL: Record<string, string> = {
  web_extract: "网页内容提取",
  web_search: "网页搜索",
  browser_cdp: "浏览器控制",
  browser_dialog: "浏览器对话框",
  browser_exec: "浏览器执行",
  browser_vault: "浏览器凭据",
  process_manage: "进程管理",
  terminal: "终端",
  patch: "文件补丁",
  read_file: "读取文件",
  search_files: "搜索文件",
  write_file: "写入文件",
  execute_code: "执行代码",
  vision_analyze: "图像分析",
  video_analyze: "视频分析",
  image_generate: "生成图像",
  video_generate: "生成视频",
  xai_video_edit: "视频编辑",
  xai_video_extend: "视频延长",
  x_search: "X 搜索",
  text_to_speech: "文本转语音",
  skill_manage: "技能管理",
  skill_view: "查看技能",
  skills_list: "技能列表",
  todo_list: "待办列表",
  kanban_attach: "看板挂接",
  kanban_attach_url: "看板挂接链接",
  kanban_attachments: "看板附件",
  kanban_block: "看板阻塞",
  kanban_comment: "看板评论",
  kanban_complete: "看板完成",
  kanban_create: "创建看板",
  kanban_heartbeat: "看板心跳",
  kanban_link: "看板关联",
  kanban_list: "看板列表",
  kanban_request_changes: "看板要求修改",
  kanban_request_review: "看板请求复核",
  kanban_schedule: "看板排期",
  kanban_show: "查看看板",
  kanban_unblock: "看板解除阻塞",
  memory: "记忆",
  session_search: "会话检索",
  manage_connections: "连接管理",
  clarify: "澄清提问",
  delegate_task: "委派任务",
  cronjob_manage: "定时任务管理",
  discord: "Discord 参与",
  discord_admin: "Discord 管理",
  computer_use: "电脑操作",
  a2a_call: "A2A 调用",
  a2a_discover: "A2A 发现",
  a2a_history: "A2A 历史",
  a2a_list: "A2A 列表",
  a2a_orchestrate: "A2A 编排",
};

const TRANSPORT_LABEL: Record<string, string> = {
  http: "HTTP 服务",
  stdio: "本地进程",
  unknown: "传输方式未知",
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function bool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

function pick(rec: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const found = text(rec[key]);
    if (found !== null) return found;
  }
  return null;
}

export function beijingMinute(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  let date: Date | null = null;
  if (/^\d{9,10}$/.test(raw)) date = new Date(Number(raw) * 1000);
  else if (/^\d{11,13}$/.test(raw)) date = new Date(Number(raw));
  else if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(raw)) date = new Date(raw);
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export const STATUS_LABEL: Record<ToolStatus, string> = {
  enabled: "启用",
  disabled: "停用",
  unknown: "待核实",
};

export const CREDENTIAL_LABEL: Record<CredentialState, string> = {
  configured: "已配置",
  missing: "未配置",
  unknown: "未知",
};

function failureOf(rec: Record<string, unknown>): { failure: string | null; reason: string | null } {
  const raw = pick(rec, ["last_error", "lastError", "error", "failure", "last_failure", "lastFailure"]);
  if (!raw) return { failure: null, reason: null };
  if (/^[{[]/.test(raw) || /^[a-z][a-z0-9_.:-]{6,}$/i.test(raw)) {
    return { failure: "最近一次调用失败，上游只给了错误代号，没有可读说明。", reason: null };
  }
  return { failure: raw.length > 240 ? `${raw.slice(0, 240)}…` : raw, reason: null };
}

function credentialOf(value: boolean | null): { state: CredentialState; raw: string | null; reason: string | null } {
  if (value === true) return { state: "configured", raw: "true", reason: null };
  if (value === false) return { state: "missing", raw: "false", reason: null };
  return { state: "unknown", raw: null, reason: "接口没有说明凭据是否已配置。" };
}

function toolsetRows(value: unknown, index: number): ToolRow[] {
  const rec = record(value);
  if (!rec) return [];
  const rawName = pick(rec, ["name", "toolset", "id"]);
  const label = pick(rec, ["label", "displayName", "display_name"]);
  if (!rawName && !label) return [];
  const key = rawName ?? label ?? `toolset-${index}`;
  const groupName = (rawName ? TOOLSET_LABEL[rawName] : null) ?? label ?? rawName ?? "工具集";
  const enabled = bool(rec.enabled ?? rec.available);
  const configured = bool(rec.configured);
  const tools = Array.isArray(rec.tools) ? rec.tools.map(text).filter((x): x is string => x !== null) : [];
  const platform = pick(rec, ["platform_label", "platform"]);
  const cred = credentialOf(configured);
  const base = {
    type: groupName,
    typeReason: null,
    status: (enabled === true ? "enabled" : enabled === false ? "disabled" : "unknown") as ToolRow["status"],
    statusRaw: enabled === null ? null : String(enabled),
    statusReason: enabled === null ? "接口没有说明这个工具集是否启用。" : null,
    credential: cred.state,
    credentialRaw: cred.raw,
    credentialReason: cred.reason,
    lastUsed: null,
    lastUsedReason: "接口没有提供最近调用时间。",
    ...failureOf(rec),
    source: "toolset" as const,
  };
  const detailBase = [
    `工具集标识：${rawName ?? key}`,
    platform ? `适用平台：${platform}` : null,
    `包含工具：${tools.length ? tools.join("、") : "接口没有列出"}`,
  ].filter((line): line is string => line !== null);

  if (tools.length === 0) return [];

  return tools.map((tool) => ({
    ...base,
    key: `toolset:${key}:${tool}`,
    name: TOOL_LABEL[tool] ?? tool.replace(/_/g, " "),
    nameReason: null,
    rawId: tool,
    detail: detailBase,
  }));
}

function serverRow(value: unknown, index: number): ToolRow | null {
  const rec = record(value);
  if (!rec) return null;
  const rawName = pick(rec, ["name", "displayName", "display_name", "title", "label", "id"]);
  if (!rawName) return null;
  const enabled = bool(rec.enabled);
  const transport = pick(rec, ["transport", "type"]) ?? "unknown";
  const auth = pick(rec, ["auth"]);
  const env = record(rec.env);
  const headers = record(rec.headers);
  const credentialsDeclared = auth !== null || (env && Object.keys(env).length > 0) || (headers && Object.keys(headers).length > 0);
  const credential = credentialsDeclared
    ? { state: "configured" as const, raw: auth ?? "declared", reason: null }
    : { state: "unknown" as const, raw: null, reason: "接口没有说明这个连接是否需要凭据。" };
  const detail = [
    `连接标识：${pick(rec, ["id", "serverId", "server_id"]) ?? rawName}`,
    `传输方式：${transport}`,
    auth ? "认证方式：已在服务端登记" : null,
    `来源：${pick(rec, ["source"]) ?? "配置"}`,
  ].filter((line): line is string => line !== null);
  return {
    key: `mcp:${rawName}:${index}`,
    name: rawName,
    nameReason: null,
    type: `MCP · ${TRANSPORT_LABEL[transport.toLowerCase()] ?? "其他传输"}`,
    typeReason: null,
    status: enabled === true ? "enabled" : enabled === false ? "disabled" : "unknown",
    statusRaw: enabled === null ? null : String(enabled),
    statusReason: enabled === null ? "接口没有说明这个连接是否启用。" : null,
    credential: credential.state,
    credentialRaw: credential.raw,
    credentialReason: credential.reason,
    lastUsed: null,
    lastUsedReason: "接口没有提供最近调用时间。",
    ...failureOf(rec),
    rawId: rawName,
    detail,
    source: "mcp",
  };
}

export function readToolsets(payload: unknown): ToolRow[] | null {
  if (!Array.isArray(payload)) return null;
  const rows: ToolRow[] = [];
  payload.forEach((value, index) => rows.push(...toolsetRows(value, index)));
  return rows;
}

export function readServers(payload: unknown): ToolRow[] | null {
  const outer = record(payload);
  if (!outer) return null;
  const raw = outer.servers ?? outer.items ?? outer.data;
  if (!Array.isArray(raw)) return null;
  const rows: ToolRow[] = [];
  raw.forEach((value, index) => {
    const row = serverRow(value, index);
    if (row) rows.push(row);
  });
  return rows;
}

export async function fetchToolsets(): Promise<ToolRow[]> {
  const rows = readToolsets(await fetchJSON<unknown>(TOOLSETS_PATH));
  if (rows === null) throw new Error("工具集回答不是一份清单");
  return rows;
}

export async function fetchServers(): Promise<ToolRow[]> {
  const rows = readServers(await fetchJSON<unknown>(SERVERS_PATH));
  if (rows === null) throw new Error("MCP 连接回答不是一份清单");
  return rows;
}

export interface FailureInfo {
  status: number;
  requestId: string | null;
  technical: string | null;
}

export function failureInfo(err: unknown): FailureInfo {
  if (err instanceof ApiError) return { status: err.status, requestId: err.requestId ?? null, technical: err.details };
  return { status: -1, requestId: null, technical: err instanceof Error ? err.message : String(err) };
}

export function isDenied(status: number): boolean {
  return status === 403;
}

export function isMissingRoute(status: number): boolean {
  return status === 404;
}

export interface FailureCopy {
  sentence: string;
  requestId: string | null;
  technical: string | null;
}

export function readFailure(err: unknown, info: FailureInfo): FailureCopy {
  const status = info.status;
  let sentence: string;
  if (status === 0 || status === -1) sentence = "连不上工具与 MCP 的服务，请确认它已经启动，然后重试。";
  else if (status === 400) sentence = "这次读取的筛选条件服务端没有接受，没能返回清单。请重试一次。";
  else if (status === 401) sentence = "登录状态已经失效，请刷新页面重新登录后再看这份清单。";
  else if (status === 429) sentence = "请求太频繁了，请稍等一会儿再试。";
  else if (status >= 500) sentence = "工具与 MCP 的服务在处理时出了错，请稍后重试。";
  else sentence = errorMessage(err) ?? "读取工具与 MCP 清单时出了问题，请稍后重试。";
  return { sentence, requestId: info.requestId, technical: info.technical };
}

export function shapeFailure(): FailureCopy {
  return {
    sentence: "服务回的内容不是工具或 MCP 连接清单，这里没能读出任何一条。",
    requestId: null,
    technical: "unexpected payload shape",
  };
}

export const requestIdLine = (id: string | null): string =>
  id ? `请求编号：${id}` : "本次请求未记录编号，可复制时间与操作路径反馈";

/** Clearly marked field example; only for the both-routes-404 case. */
export const FIXTURE_ROWS: ToolRow[] = [
  {
    key: "fixture:web",
    name: "网页搜索与抓取",
    nameReason: null,
    type: "工具集",
    typeReason: null,
    status: "enabled",
    statusRaw: "true",
    statusReason: null,
    credential: "configured",
    credentialRaw: "true",
    credentialReason: null,
    lastUsed: null,
    lastUsedReason: "示例行：接口未接入，没有最近调用时间。",
    rawId: "web",
    detail: ["字段示例", "工具集标识：web", "包含工具：web_search、web_extract"],
    source: "toolset",
  },
  {
    key: "fixture:kanban",
    name: "看板",
    nameReason: null,
    type: "工具集",
    typeReason: null,
    status: "disabled",
    statusRaw: "false",
    statusReason: null,
    credential: "missing",
    credentialRaw: "false",
    credentialReason: null,
    lastUsed: null,
    lastUsedReason: "示例行：接口未接入，没有最近调用时间。",
    rawId: "kanban",
    detail: ["字段示例", "工具集标识：kanban", "包含工具：kanban_create、kanban_list"],
    source: "toolset",
  },
  {
    key: "fixture:mcp-http",
    name: "文档检索",
    nameReason: null,
    type: "MCP · HTTP 服务",
    typeReason: null,
    status: "enabled",
    statusRaw: "true",
    statusReason: null,
    credential: "configured",
    credentialRaw: "declared",
    credentialReason: null,
    lastUsed: null,
    lastUsedReason: "示例行：接口未接入，没有最近调用时间。",
    rawId: "docs-search",
    detail: ["字段示例", "连接标识：docs-search", "传输方式：http"],
    source: "mcp",
  },
  {
    key: "fixture:mcp-unknown",
    name: "日程连接",
    nameReason: null,
    type: "MCP · 本地进程",
    typeReason: null,
    status: "unknown",
    statusRaw: null,
    statusReason: "示例行：接口没有说明启用状态。",
    credential: "unknown",
    credentialRaw: null,
    credentialReason: "示例行：接口没有说明凭据状态。",
    lastUsed: null,
    lastUsedReason: "示例行：接口未接入，没有最近调用时间。",
    rawId: "calendar",
    detail: ["字段示例", "连接标识：calendar", "传输方式：stdio"],
    source: "mcp",
  },
];
