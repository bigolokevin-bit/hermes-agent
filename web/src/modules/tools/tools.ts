export type Server = {
  id: string;
  name: string;
  status: "available" | "unavailable" | "unknown";
  reason: string | null;
  checkedAt: string | null;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readServers(payload: unknown): Server[] {
  const root = object(payload);
  const rows = Array.isArray(payload) ? payload : Array.isArray(root.items) ? root.items : Array.isArray(root.servers) ? root.servers : [];
  return rows.map((value, index) => {
    const row = object(value);
    const rawStatus = string(row.status)?.toLowerCase();
    const status = rawStatus === "available" || rawStatus === "connected" || rawStatus === "online"
      ? "available"
      : rawStatus === "unavailable" || rawStatus === "disconnected" || rawStatus === "offline" || rawStatus === "error"
        ? "unavailable"
        : "unknown";
    return {
      id: string(row.id) ?? string(row.name) ?? `server-${index}`,
      name: string(row.name) ?? "—",
      status,
      reason: string(row.reason) ?? string(row.error) ?? string(row.lastError),
      checkedAt: string(row.checkedAt) ?? string(row.lastCheckedAt) ?? string(row.updatedAt),
    };
  });
}

export function formatBeijingTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}

export const SERVER_FIXTURE: Server[] = [
  { id: "mcp-fixture-a1", name: "文档检索", status: "available", reason: null, checkedAt: null },
  { id: "mcp-fixture-b2", name: "代码助手", status: "available", reason: null, checkedAt: null },
  { id: "mcp-fixture-c3", name: "远程仓库", status: "unavailable", reason: "上游返回连接失败：远端拒绝", checkedAt: null },
  { id: "mcp-fixture-d4", name: "日程查询", status: "unknown", reason: null, checkedAt: null },
];
