/**
 * 工具与 MCP — read-side adapters.
 *
 * Two real reads, attempted through the consumer BFF first and the same-origin
 * Hermes dashboard second (session token or cookie as the host provides):
 *   GET /agent-api/api/tools/toolsets -> GET /api/tools/toolsets
 *   GET /agent-api/api/mcp/servers   -> GET /api/mcp/servers
 *
 * The served consumer console reads through the BFF first
 * (`/agent-api/...`, session or cookie), then falls back to the same-origin
 * dashboard routes for the native Hermes host. A non-JSON SPA shell is treated
 * as “not wired”, never parsed as data. No fixture row is ever painted: when
 * both routes are absent the page says so and shows no sample row.
 */
import { ApiError, errorMessage } from "@/lib/api-error";
import { fetchJsonStrict } from "@/modules/models/fetchJson";

export const TOOLS_PATH = "/agent-api/api/tools";
export const TOOLSETS_PATH = "/agent-api/api/tools/toolsets";
export const SERVERS_PATH = "/agent-api/api/mcp/servers";
export const TOOLS_PATHS = [TOOLS_PATH, "/api/tools"] as const;
export const TOOLSETS_PATHS = [TOOLSETS_PATH, "/api/tools/toolsets"] as const;
export const SERVERS_PATHS = [SERVERS_PATH, "/api/mcp/servers"] as const;
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
  updatedAt: string | null;
  updatedAtReason: string | null;
  /** Top-level ISO asOf of the payload that produced this row. */
  asOf: string | null;
  asOfReason: string | null;
  /** Actual route that answered this row, filled by fetchFirst. */
  endpoint: string;
  rawId: string | null;
  detail: string[];
  failure?: string | null;
  failureReason?: string | null;
  source: "toolset" | "mcp";
}

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
  enabled: "正常",
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

const LAST_USED_KEYS = [
  "last_used",
  "lastUsed",
  "last_used_at",
  "lastUsedAt",
  "last_call_at",
  "lastCallAt",
  "last_invoked_at",
  "lastInvokedAt",
  "last_run_at",
  "lastRunAt",
] as const;

function lastUsedOf(rec: Record<string, unknown>): { value: string | null; reason: string | null } {
  const raw = pick(rec, LAST_USED_KEYS);
  if (!raw) return { value: null, reason: "接口没有提供最近调用时间（不表示从未调用）。" };
  const value = beijingMinute(raw);
  if (value) return { value, reason: null };
  return { value: null, reason: "接口给出的最近调用时间无法解析（不表示从未调用）。" };
}

function humanToolName(tool: string): string {
  const known = TOOL_LABEL[tool];
  if (known) return known;
  return tool.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function credentialOf(value: boolean | null): { state: CredentialState; raw: string | null; reason: string | null } {
  if (value === true) return { state: "configured", raw: "true", reason: null };
  if (value === false) return { state: "missing", raw: "false", reason: null };
  return { state: "unknown", raw: null, reason: "接口没有说明凭据是否已配置。" };
}

const UPDATED_KEYS = [
  "updated_at",
  "updatedAt",
  "modified_at",
  "modifiedAt",
  "last_updated",
  "lastUpdated",
  "last_update",
  "lastUpdate",
] as const;

function updatedAtOf(rec: Record<string, unknown>): { value: string | null; reason: string | null } {
  const raw = pick(rec, UPDATED_KEYS);
  if (!raw) return { value: null, reason: "接口没有提供最近更新时间。" };
  const value = beijingMinute(raw);
  if (value) return { value, reason: null };
  return { value: null, reason: "接口给出的最近更新时间无法解析。" };
}

type RowStamp = { asOf: string | null; asOfReason: string | null };

const ISO_STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

function stampOf(payload: unknown): RowStamp {
  if (Array.isArray(payload)) {
    return { asOf: null, asOfReason: "清单接口返回的是数组，没有顶层采集时刻。" };
  }
  const rec = record(payload);
  if (!rec) return { asOf: null, asOfReason: "响应不是对象，读不到顶层 asOf。" };
  const raw = rec.asOf;
  if (typeof raw !== "string" || !raw.trim()) {
    return { asOf: null, asOfReason: "响应顶层没有 asOf，采集时刻未知。" };
  }
  const value = raw.trim();
  if (!ISO_STAMP.test(value) || Number.isNaN(new Date(value).getTime())) {
    return { asOf: null, asOfReason: "响应顶层 asOf 不是 ISO 时间，采集时刻未知。" };
  }
  const shown = beijingMinute(value);
  return shown
    ? { asOf: shown, asOfReason: rec.asOfSource ? `asOfSource：${String(rec.asOfSource)}` : null }
    : { asOf: null, asOfReason: "响应顶层 asOf 无法解析，采集时刻未知。" };
}

function toolsetRows(value: unknown, index: number, stamp: RowStamp): ToolRow[] {
  const rec = record(value);
  if (!rec) return [];
  const rawName = pick(rec, ["name", "toolset", "id"]);
  const label = pick(rec, ["label", "displayName", "display_name"]);
  if (!rawName && !label) return [];
  const key = rawName ?? label ?? `toolset-${index}`;
  const groupName = (rawName ? TOOLSET_LABEL[rawName] : null) ?? label ?? rawName ?? "工具集";
  const enabledRaw = rec.enabled ?? rec.available;
  const enabled = bool(enabledRaw);
  const configured = bool(rec.configured);
  const tools = Array.isArray(rec.tools) ? rec.tools.map(text).filter((x): x is string => x !== null) : [];
  const platform = pick(rec, ["platform_label", "platform"]);
  const cred = credentialOf(configured);
  const lastUsed = lastUsedOf(rec);
  const updated = updatedAtOf(rec);
  const base = {
    type: groupName,
    typeReason: null,
    status: (enabled === true ? "enabled" : enabled === false ? "disabled" : "unknown") as ToolRow["status"],
    statusRaw: enabledRaw === undefined || enabledRaw === null ? null : String(enabledRaw),
    statusReason: enabled === null
      ? enabledRaw === undefined || enabledRaw === null
        ? "接口没有说明这个工具集是否启用。"
        : "接口给出的启用值未归类。"
      : null,
    credential: cred.state,
    credentialRaw: cred.raw,
    credentialReason: cred.reason,
    lastUsed: lastUsed.value,
    lastUsedReason: lastUsed.reason,
    updatedAt: updated.value,
    updatedAtReason: updated.reason,
    asOf: stamp.asOf,
    asOfReason: stamp.asOfReason,
    endpoint: "",
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
    name: humanToolName(tool),
    nameReason: null,
    rawId: tool,
    detail: detailBase,
  }));
}

function serverRow(value: unknown, index: number, stamp: RowStamp): ToolRow | null {
  const rec = record(value);
  if (!rec) return null;
  const rawName = pick(rec, ["name", "displayName", "display_name", "title", "label", "id"]);
  if (!rawName) return null;
  const enabledRaw = rec.enabled;
  const enabled = bool(enabledRaw);
  const transport = pick(rec, ["transport", "type"]) ?? "unknown";
  const auth = pick(rec, ["auth"]);
  const env = record(rec.env);
  const headers = record(rec.headers);
  const explicit = bool(rec.configured ?? rec.credential_configured ?? rec.credentialConfigured ?? rec.auth_configured ?? rec.authConfigured);
  const credentialsDeclared = auth !== null || (env && Object.keys(env).length > 0) || (headers && Object.keys(headers).length > 0);
  const credential =
    explicit === true
      ? { state: "configured" as const, raw: "true", reason: null }
      : explicit === false
        ? { state: "missing" as const, raw: "false", reason: null }
        : credentialsDeclared
          ? { state: "configured" as const, raw: auth ?? "declared", reason: null }
          : { state: "unknown" as const, raw: null, reason: "接口没有说明这个连接是否需要凭据。" };
  const lastUsed = lastUsedOf(rec);
  const updated = updatedAtOf(rec);
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
    statusRaw: enabledRaw === undefined || enabledRaw === null ? null : String(enabledRaw),
    statusReason: enabled === null
      ? enabledRaw === undefined || enabledRaw === null
        ? "接口没有说明这个连接是否启用。"
        : "接口给出的启用值未归类。"
      : null,
    credential: credential.state,
    credentialRaw: credential.raw,
    credentialReason: credential.reason,
    lastUsed: lastUsed.value,
    lastUsedReason: lastUsed.reason,
    updatedAt: updated.value,
    updatedAtReason: updated.reason,
    asOf: stamp.asOf,
    asOfReason: stamp.asOfReason,
    endpoint: "",
    ...failureOf(rec),
    rawId: rawName,
    detail,
    source: "mcp",
  };
}

function flatToolRow(value: unknown, index: number, stamp: RowStamp): ToolRow | null {
  const rec = record(value);
  if (!rec) return null;
  const rawName = pick(rec, ["name", "label", "tool", "tool_name", "toolName", "id"]);
  if (!rawName) return null;
  const enabledRaw = rec.enabled ?? rec.available ?? rec.active;
  const enabled = bool(enabledRaw);
  const cred = credentialOf(bool(rec.configured ?? rec.credential_configured ?? rec.credentialConfigured));
  const lastUsed = lastUsedOf(rec);
  const updated = updatedAtOf(rec);
  const rawType = pick(rec, ["type", "category", "source", "group"]);
  return {
    key: `tool:${rawName}:${index}`,
    name: humanToolName(rawName),
    nameReason: null,
    type: rawType ? (/[\u4e00-\u9fff]/.test(rawType) ? rawType : "工具") : "工具",
    typeReason: rawType ? null : "接口没有提供类型或来源。",
    status: enabled === true ? "enabled" : enabled === false ? "disabled" : "unknown",
    statusRaw: enabledRaw === undefined || enabledRaw === null ? null : String(enabledRaw),
    statusReason: enabled === null
      ? enabledRaw === undefined || enabledRaw === null
        ? "接口没有说明这个工具是否启用。"
        : "接口给出的启用值未归类。"
      : null,
    credential: cred.state,
    credentialRaw: cred.raw,
    credentialReason: cred.reason,
    lastUsed: lastUsed.value,
    lastUsedReason: lastUsed.reason,
    updatedAt: updated.value,
    updatedAtReason: updated.reason,
    asOf: stamp.asOf,
    asOfReason: stamp.asOfReason,
    endpoint: "",
    ...failureOf(rec),
    rawId: rawName,
    detail: [`工具标识：${rawName}`],
    source: "toolset",
  };
}

export function readInventory(payload: unknown): ToolRow[] | null {
  const list = Array.isArray(payload)
    ? payload
    : (() => {
        const outer = record(payload);
        if (!outer) return null;
        const raw = outer.items ?? outer.tools ?? outer.data;
        return Array.isArray(raw) ? raw : null;
      })();
  if (!list) return null;
  const stamp = stampOf(payload);
  const rows: ToolRow[] = [];
  list.forEach((value, index) => {
    const rec = record(value);
    if (rec && Array.isArray(rec.tools)) rows.push(...toolsetRows(value, index, stamp));
    else {
      const row = flatToolRow(value, index, stamp);
      if (row) rows.push(row);
    }
  });
  return rows;
}

export function readToolsets(payload: unknown): ToolRow[] | null {
  if (!Array.isArray(payload)) return null;
  const stamp = stampOf(payload);
  const rows: ToolRow[] = [];
  payload.forEach((value, index) => rows.push(...toolsetRows(value, index, stamp)));
  return rows;
}

export function readServers(payload: unknown): ToolRow[] | null {
  const outer = record(payload);
  if (!outer) return null;
  const raw = outer.servers ?? outer.items ?? outer.data;
  if (!Array.isArray(raw)) return null;
  const stamp = stampOf(payload);
  const rows: ToolRow[] = [];
  raw.forEach((value, index) => {
    const row = serverRow(value, index, stamp);
    if (row) rows.push(row);
  });
  return rows;
}

function missingRoute(url: string): ApiError {
  return new ApiError("这个数据接口还没有接入。", { status: 404, body: "", url });
}

async function fetchFirst(
  paths: readonly string[],
  reader: (payload: unknown) => ToolRow[] | null,
): Promise<ToolRow[]> {
  let firstOther: unknown = null;
  let lastMissing: ApiError | null = null;
  for (const path of paths) {
    try {
      const rows = reader(await fetchJsonStrict(path));
      if (rows === null) throw new Error("服务回答的内容不是一份清单");
      return rows.map((row) => ({ ...row, endpoint: path }));
    } catch (err) {
      const status = err instanceof ApiError ? err.status : -1;
      // 403/404 and a 200 HTML shell all mean “this route is not wired here”.
      if (status === 403 || status === 404 || status === 200) {
        if (lastMissing === null) lastMissing = err instanceof ApiError ? err : missingRoute(path);
        continue;
      }
      if (firstOther === null) firstOther = err;
    }
  }
  if (firstOther !== null) throw firstOther;
  throw lastMissing ?? missingRoute(paths[paths.length - 1]);
}

export async function fetchInventory(): Promise<ToolRow[]> {
  return fetchFirst([...TOOLS_PATHS, ...TOOLSETS_PATHS], readInventory);
}

export async function fetchToolsets(): Promise<ToolRow[]> {
  return fetchFirst(TOOLSETS_PATHS, readToolsets);
}

export async function fetchServers(): Promise<ToolRow[]> {
  return fetchFirst(SERVERS_PATHS, readServers);
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
  status?: number | null;
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
  return { sentence, requestId: info.requestId, technical: info.technical, status };
}

export function shapeFailure(): FailureCopy {
  return {
    sentence: "服务回的内容不是工具或 MCP 连接清单，这里没能读出任何一条。",
    requestId: null,
    technical: "unexpected payload shape",
    status: null,
  };
}

export const requestIdLine = (id: string | null): string =>
  id ? `请求编号：${id}` : "本次请求未记录编号，可复制时间与操作路径反馈";
