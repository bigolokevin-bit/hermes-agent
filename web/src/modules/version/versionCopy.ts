import type { VersionRow } from "./versionHealth";

// Copy is a projection of the rendered version surface. It never reads the
// clock, never fetches, and never adds the asOf source (that stays in titles).
export const VERSION_COPY_HEADER = "服务名 | 版本或构建标识 | 健康态 | 采集时刻";

export function versionCopyText(rows: readonly VersionRow[], checkedAt: string | null): string {
  const lines = [VERSION_COPY_HEADER];
  for (const row of rows) {
    lines.push([
      row.name ?? "—",
      row.version ?? row.builtAt ?? "—",
      row.status ?? "—",
      checkedAt ?? "—",
    ].join(" | "));
  }
  return lines.join("\n");
}