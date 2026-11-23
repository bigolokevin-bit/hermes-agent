/**
 * R83 — risk-tier local filter for the approvals surfaces (pending & history).
 *
 * The read port ignores risk= (measured again on this generation: 200 with the
 * same 8-id set as the baseline query; R44 三组同集合 for risk/window/since),
 * so this rail filters the ALREADY LOADED rows by the raw risk value and says
 * so on screen — never pretending to be a server filter. Clicking a chip fires
 * no request; the server request URL never carries risk=.
 * critical（严重风险）has no chip on purpose: the ticket ships 全部/高/中/低/未标注
 * only, and critical rows stay visible in the 全部 state.
 */
import { crossPageLoadHint, gateReason } from "./gates";
import type { ApprovalRow } from "./model";

type Phase = "loading" | "empty" | "ready" | "error" | "denied";

export const RISK_OPTIONS = [
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
  { value: "none", label: "未标注" },
] as const;

export type RiskValue = (typeof RISK_OPTIONS)[number]["value"];

export function isRiskValue(value: string | null): value is RiskValue {
  return RISK_OPTIONS.some((option) => option.value === value);
}

/** 谓词按服务端原始值精确匹配；「未标注」=原始值缺失的行（含读口没带 risk 键）。 */
export function withinRisk(row: ApprovalRow, risk: RiskValue): boolean {
  const raw = row.risk.raw?.trim().toLowerCase() ?? null;
  return risk === "none" ? raw === null || raw === "" : raw === risk;
}

function riskBucketCount(rows: readonly ApprovalRow[], risk: RiskValue): number {
  return rows.filter((row) => withinRisk(row, risk)).length;
}

export function RiskQuickFilter({
  rows,
  phase,
  risk,
  onPick,
  hasMore = false,
}: {
  rows: readonly ApprovalRow[];
  phase: Phase;
  risk: RiskValue | null;
  onPick: (value: RiskValue | null) => void;
  hasMore?: boolean;
}) {
  const ready = phase === "ready";
  // P1-375-2: 375 下整条允许换行（容器已 flex-wrap）；chip 本身豁免收缩并
  // 禁内层换行，杜绝「全部 8」被挤成逐字竖排。
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
        aria-label="风险档"
        data-testid="apv-risk-rail"
      >
        <span className="text-muted-foreground">风险档：</span>
        <button
          type="button"
          data-testid="apv-risk-all"
          aria-pressed={risk === null}
          disabled={!ready}
          aria-disabled={!ready}
          title={ready ? "显示全部风险档" : `不能按风险档筛选：${gateReason(phase)}；恢复列表后自动可用。`}
          onClick={() => onPick(null)}
          className={`${chip} ${risk === null ? onClass : offClass}`}
        >
          全部 <b className="font-mono">{ready ? rows.length : "—"}</b>
        </button>
        {RISK_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            data-testid={`apv-risk-${option.value}`}
            aria-pressed={risk === option.value}
            disabled={!ready}
            aria-disabled={!ready}
            title={
              ready
                ? option.value === "none"
                  ? "只看没有风险标注的行（本地过滤，不发新请求）"
                  : `筛选${option.label}风险（本地过滤，不发新请求）`
                : `不能按风险档筛选：${gateReason(phase)}；恢复列表后自动可用。`
            }
            onClick={() => onPick(risk === option.value ? null : option.value)}
            className={`${chip} ${risk === option.value ? onClass : offClass}`}
          >
            {option.label} <b className="font-mono">{ready ? riskBucketCount(rows, option.value) : "—"}</b>
          </button>
        ))}
      </div>
      <p
        className="min-w-0 break-words text-xs text-muted-foreground"
        data-testid="apv-risk-scope-note"
        data-apv-risk-scope-note="local-filter"
        title="实测本页读口带 risk=high 与不带时返回完全相同的行集（同 id 序；risk/window/since 三键同判）——后台不做风险档过滤。为避免假筛选，这里只对已加载的行做前端本地过滤，切换不产生新请求；严重风险（critical）没有独立档位，在「全部」下照常显示。"
      >
        按当前已加载 {rows.length} 条统计，不是全量；风险档切换不发新请求。
        {hasMore ? (
          <span data-testid="apv-risk-crosspage" data-apv-risk-crosspage="needs-load">
            {` ${crossPageLoadHint(true)}`}
          </span>
        ) : null}
      </p>
    </div>
  );
}
