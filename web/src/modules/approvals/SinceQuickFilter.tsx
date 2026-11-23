/**
 * R77 — time-range quick filter for the approvals surfaces (pending & history).
 *
 * The windows filter the ALREADY LOADED rows by submittedAt: the read port
 * ignores since=/window= (measured on 9122 — four queries returned the same
 * 200/8 set), so server-side filtering would be fake. Clicking a chip never
 * fires a request; the scope sentence states 「按当前已加载 N 条统计，不是全量」.
 * The comparison instant is a render-time value captured in state (never
 * persisted to the URL) and the timezone math is pure UTC-epoch arithmetic —
 * 本机时区不参与判定。
 */
import { crossPageLoadHint, gateReason } from "./gates";
import { epochOf } from "./RelativeTime";

type Phase = "loading" | "empty" | "ready" | "error" | "denied";

export const SINCE_OPTIONS = [
  { value: "24h", label: "近 24 小时", ms: 24 * 3_600_000 },
  { value: "7d", label: "近 7 天", ms: 7 * 24 * 3_600_000 },
  { value: "30d", label: "近 30 天", ms: 30 * 24 * 3_600_000 },
] as const;

export type SinceValue = (typeof SINCE_OPTIONS)[number]["value"];

export function isSinceValue(value: string | null): value is SinceValue {
  return SINCE_OPTIONS.some((option) => option.value === value);
}

/** 时间窗谓词：缺提交时间或非法值的行不属于任何窗口（all 态不过滤）。 */
export function withinSince(submittedAt: string | null, since: SinceValue, now: number): boolean {
  const ms = SINCE_OPTIONS.find((option) => option.value === since)?.ms ?? Infinity;
  const at = epochOf(submittedAt);
  return at !== null && now - at >= 0 && now - at <= ms;
}

export function SinceQuickFilter({
  phase,
  since,
  loadedCount,
  onPick,
  hasMore = false,
}: {
  phase: Phase;
  since: SinceValue | null;
  loadedCount: number;
  onPick: (value: SinceValue | null) => void;
  hasMore?: boolean;
}) {
  const ready = phase === "ready";
  // P1-375-2: 同 RiskQuickFilter——时间窗 chip（含「近 24 小时」这类带空格的
  // 标签）不许在 375 被挤压折行，换行交给整条 rail 的 flex-wrap。
  const chip =
    "h-6 shrink-0 whitespace-nowrap rounded-md border px-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/40 " +
    (ready ? "hover:bg-muted/40" : "cursor-not-allowed opacity-60");
  const onClass = "border-primary/60 text-foreground";
  const offClass = "border-border text-muted-foreground";
  return (
    <div className="min-w-0 space-y-1">
      <div
        className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs"
        role="group"
        aria-label="时间范围"
        data-testid="apv-since-rail"
      >
        <span className="text-muted-foreground">时间范围：</span>
        {SINCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            data-testid={`apv-since-${option.value}`}
            aria-pressed={since === option.value}
            disabled={!ready}
            aria-disabled={!ready}
            title={ready ? option.label : `不能按时间范围筛选：${gateReason(phase)}；恢复列表后自动可用。`}
            onClick={() => onPick(since === option.value ? null : option.value)}
            className={`${chip} ${since === option.value ? onClass : offClass}`}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          data-testid="apv-since-all"
          aria-pressed={since === null}
          disabled={!ready}
          aria-disabled={!ready}
          title={ready ? "显示全部提交时间" : `不能按时间范围筛选：${gateReason(phase)}；恢复列表后自动可用。`}
          onClick={() => onPick(null)}
          className={`${chip} ${since === null ? onClass : offClass}`}
        >
          全部
        </button>
      </div>
      <p
        className="min-w-0 break-words text-xs text-muted-foreground"
        data-testid="apv-since-scope-note"
        data-apv-since-scope-note="local-filter"
        title="实测本页读口带 since=24h / window=24h / since=<日期> 与不带时返回同一全量（同序同行集），后台不做时间窗过滤；为避免假筛选，这里只对已加载的行做前端本地过滤，切换不产生新请求。没有提交时间的行不属于任何时间窗。"
      >
        按当前已加载 {loadedCount} 条统计，不是全量；切换时间范围不发新请求。
        {hasMore ? (
          <span data-testid="apv-since-crosspage" data-apv-since-crosspage="needs-load">
            {` ${crossPageLoadHint(true)}`}
          </span>
        ) : null}
      </p>
    </div>
  );
}
