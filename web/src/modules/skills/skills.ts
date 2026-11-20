// Module: skills — read-only skill ledger (SKL4).
//
// The list endpoint is an active BFF read. Its ledger shape provides name,
// version and sharing scope; it does not provide a source, a runtime status or
// an update timestamp. Those cells stay "—" with a visible reason instead of
// being inferred from another field or replaced by sample data.

export const SKILLS_GAP = "GAP-SKL4-01";

export type SkillRow = {
  id: string;
  name: string;
  nameReason: string | null;
  source: string | null;
  sourceReason: string;
  status: string | null;
  statusReason: string;
  updatedAt: string | null;
  updatedAtReason: string;
  scope: string;
  version: string | null;
};

export type SkillsRead = {
  rows: SkillRow[];
  asOf: string | null;
  asOfReason: string | null;
  /** `asOfSource` is engineering context: it may only be rendered as a title. */
  asOfTitle: string | null;
};

const ISO_STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

function topLevelAsOf(root: Record<string, unknown>): { asOf: string | null; asOfReason: string | null; asOfTitle: string | null } {
  const sourceRaw = root.asOfSource ?? root.as_of_source;
  const source = typeof sourceRaw === "string" && sourceRaw.trim() ? sourceRaw.trim() : null;
  const asOfTitle = source ? `asOfSource：${source}` : null;
  const raw = root.asOf;
  if (typeof raw !== "string" || !raw.trim()) {
    return { asOf: null, asOfReason: "响应顶层没有 asOf，采集时刻未知。", asOfTitle };
  }
  const value = raw.trim();
  if (!ISO_STAMP.test(value) || Number.isNaN(new Date(value).getTime())) {
    return { asOf: null, asOfReason: "响应顶层 asOf 不是 ISO 时间，采集时刻未知。", asOfTitle };
  }
  const shown = formatBeijingTime(value);
  return shown
    ? { asOf: shown, asOfReason: null, asOfTitle }
    : { asOf: null, asOfReason: "响应顶层 asOf 无法解析，采集时刻未知。", asOfTitle };
}

const SCOPE_LABELS: Record<string, string> = {
  "tenant-shared": "团队共享",
  "employee-exclusive": "员工专属",
  unused: "未被引用",
};

const SOURCE_LABELS: Record<string, string> = {
  builtin: "平台内置",
  internal: "平台内置",
  platform: "平台内置",
  system: "平台内置",
  custom: "团队自建",
  tenant: "团队自建",
  user: "员工自建",
  employee: "员工自建",
  external: "外部集成",
  third_party: "外部集成",
  mcp: "MCP 工具",
};

const STATUS_LABELS: Record<string, string> = {
  active: "正常",
  enabled: "正常",
  ready: "正常",
  inactive: "停用",
  disabled: "停用",
  paused: "停用",
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Beijing time to the minute, or null when the value is absent/invalid. */
export function formatBeijingTime(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
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

export function readSkills(body: unknown): SkillsRead {
  const root = record(body);
  const items = Array.isArray(body) ? body : Array.isArray(root.items) ? root.items : [];
  const { asOf, asOfReason, asOfTitle } = topLevelAsOf(root);

  const rows = items.map((item, index) => {
    const row = record(item);
    const name = text(row.name);
    const rawScope = text(row.scope);
    const scopeKey = rawScope?.toLowerCase() ?? "";
    const scope = rawScope ? SCOPE_LABELS[scopeKey] ?? "其他范围" : "—";
    const rawSource = (text(row.source) ?? text(row.origin))?.toLowerCase() ?? null;
    const source = rawSource
      ? SOURCE_LABELS[rawSource] ?? (/[\u4e00-\u9fff]/.test(rawSource) ? rawSource : "其他来源")
      : rawScope
        ? `类型：${scope}`
        : null;
    const sourceReason = source
      ? rawSource && !SOURCE_LABELS[rawSource]
        ? "台账来源值未归类"
        : ""
      : "台账列表未提供来源或类型";
    const rawStatus = text(row.status)
      ?? (typeof row.enabled === "boolean" ? (row.enabled ? "active" : "disabled") : null);
    const statusKey = rawStatus?.toLowerCase() ?? null;
    const status = statusKey ? STATUS_LABELS[statusKey] ?? "待核实" : null;
    const statusReason = !statusKey
      ? "台账列表未提供启用状态"
      : STATUS_LABELS[statusKey]
        ? ""
        : "台账状态值未归类";
    const updatedRaw = text(row.updatedAt) ?? text(row.updated_at) ?? text(row.modifiedAt) ?? null;
    const updatedAt = formatBeijingTime(updatedRaw);
    const version = text(row.version);

    return {
      id: text(row.skillId) ?? text(row.id) ?? `row-${index}`,
      name: name ?? "—",
      nameReason: name ? null : "台账未提供名称",
      source,
      sourceReason,
      status,
      statusReason,
      updatedAt,
      updatedAtReason: updatedAt ? "" : updatedRaw ? "更新时间无法识别" : "台账列表未提供更新时间",
      scope,
      version,
    };
  });

  return { rows, asOf, asOfReason, asOfTitle };
}

/** Semver key for the detail versions; invalid forms fall back to row order. */
function versionKey(version: string | null): [number, number, number] | null {
  const parts = (version ?? "").split(".");
  return parts.length === 3 && parts.every((part) => /^\d+$/.test(part))
    ? [Number(parts[0]), Number(parts[1]), Number(parts[2])]
    : null;
}

function greater(a: [number, number, number], b: [number, number, number]): boolean {
  return a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])));
}

export function readDetail(body: unknown): Record<string, unknown> {
  const root = record(body);
  const skill = record(root.skill);
  const versions = Array.isArray(root.versions) ? root.versions : [];
  let latest = versions.length ? record(versions[versions.length - 1]) : {};
  let bestKey = versionKey(text(latest.version));
  for (const item of versions) {
    const row = record(item);
    const key = versionKey(text(row.version));
    if (key && (bestKey === null || greater(key, bestKey))) {
      bestKey = key;
      latest = row;
    }
  }
  const status = text(latest.status);
  const statusLabels: Record<string, string> = {
    active: "启用",
    draft: "草稿",
    archived: "已归档",
  };
  return {
    description: text(skill.description),
    createdAt: formatBeijingTime(skill.createdAt),
    version: text(latest.version),
    status: status ? statusLabels[status] ?? status : null,
    statusChangedAt: formatBeijingTime(latest.statusChangedAt),
  };
}

export function displayEnabled(value: "enabled" | "disabled" | "unknown"): string {
  if (value === "enabled") return "已启用";
  if (value === "disabled") return "未启用";
  return "—（台账列表未提供）";
}