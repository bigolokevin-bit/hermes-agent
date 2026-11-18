export type SkillRow = {
  id: string;
  name: string;
  nameReason: string | null;
  source: string;
  sourceReason: string | null;
  scope: string;
  enabled: "enabled" | "disabled" | "unknown";
  updatedAt: string | null;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readSkills(body: unknown): SkillRow[] {
  const root = record(body);
  const items = Array.isArray(body) ? body : Array.isArray(root.items) ? root.items : [];
  return items.map((item, index) => {
    const row = record(item);
    const name = text(row.name);
    const rawScope = text(row.scope);
    const scopeMap: Record<string, string> = {
      "tenant-shared": "团队共享",
      "employee-exclusive": "员工专属",
      unused: "未被引用",
    };
    return {
      id: text(row.skillId) ?? `row-${index}`,
      name: name ?? "—",
      nameReason: name ? null : "上游未提供名称",
      source: "—",
      sourceReason: "台账未提供来源",
      scope: rawScope ? scopeMap[rawScope] ?? rawScope : "—",
      enabled: "unknown",
      updatedAt: null,
    };
  });
}

/** 语义化版本比较键；非法形态返回 null（与上游 skills.py _version_key 口径一致）。 */
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
  // 上游按 (created_at, version 文本) 升序返回；同毫秒时 version 文本序会误排
  // （如 1.10.0 < 1.2.0），故「最新版本」按语义化版本取最大，非法形态回退末行。
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
    createdAt: text(skill.createdAt),
    version: text(latest.version),
    status: status ? statusLabels[status] ?? status : null,
    statusChangedAt: text(latest.statusChangedAt),
  };
}

export function displayEnabled(value: SkillRow["enabled"]): string {
  if (value === "enabled") return "已启用";
  if (value === "disabled") return "未启用";
  return "—（台账列表未提供）";
}

export function formatBeijingTime(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
