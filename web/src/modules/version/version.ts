import packageJson from "../../../package.json";

export type BuildRow = { label: string; value: string | null; reason: string | null; title?: string };
export type DependencyRow = { name: string; version: string | null; reason: string | null };

export type BuildEnv = {
  VITE_BUILD_IDENTITY?: string;
  VITE_BUILD_REF?: string;
  VITE_BUILD_COMMIT?: string;
  VITE_BUILD_TIME?: string;
};

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function formatBeijingMinute(value: string | null): string | null {
  if (!value) return null;
  const numeric = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}

export function readBuildRows(env: BuildEnv): BuildRow[] {
  const reason = "构建未注入版本变量（V4 构建脚本硬线未接）";
  const identity = nonEmpty(env.VITE_BUILD_IDENTITY);
  const ref = nonEmpty(env.VITE_BUILD_REF);
  const commit = nonEmpty(env.VITE_BUILD_COMMIT);
  const time = nonEmpty(env.VITE_BUILD_TIME);
  return [
    { label: "构建号", value: identity, reason: identity ? null : reason, title: identity ?? undefined },
    { label: "运行代码", value: ref, reason: ref ? null : reason, title: ref ?? undefined },
    { label: "提交号", value: commit ? commit.slice(0, 8) : null, reason: commit ? null : reason, title: commit ?? undefined },
    { label: "构建时间", value: formatBeijingMinute(time), reason: time && formatBeijingMinute(time) ? null : reason, title: time ?? undefined },
  ];
}

const DEPENDENCIES = ["react", "vite", "typescript", "@nous-research/ui", "vitest"] as const;
const packageRecord = packageJson as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export function readDependencyRows(): DependencyRow[] {
  return DEPENDENCIES.map((name) => {
    const version = packageRecord.dependencies?.[name] ?? packageRecord.devDependencies?.[name] ?? null;
    return {
      name,
      version,
      reason: version ? null : "构建配置未开放包清单读取",
    };
  });
}
