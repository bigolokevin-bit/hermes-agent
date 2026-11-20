/**
 * One field set for version/build identity across /system and /capabilities.
 * Both surfaces read the same keys; a missing value is never invented.
 */
export const VERSION_FIELD_KEYS = [
  "version",
  "build",
  "buildVersion",
  "build_version",
  "buildId",
  "build_id",
  "currentVersion",
  "current_version",
  "revision",
  "commit",
] as const;

export function versionIdentity(row: unknown): string | null {
  if (typeof row !== "object" || row === null || Array.isArray(row)) return null;
  const rec = row as Record<string, unknown>;
  for (const key of VERSION_FIELD_KEYS) {
    const value = rec[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

export const VERSION_MISSING_REASON = "上游没有提供该服务的版本或构建标识；不编造版本号。";
