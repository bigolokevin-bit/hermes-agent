/**
 * R91 — the active-filter summary chips for the approvals surfaces.
 *
 * One row per currently effective filter value, removable one at a time.
 * Same parameter table as the R90 reset (FilterReset.ts) — no second list of
 * keys, no second wording set. Removing the server-side status parameter
 * refetches exactly once (page one, no cursor); removing a local dimension
 * (search / actor / time window / risk / sort) never fires a request —
 * counts, buckets, summary and export recompute from the same visibleRows
 * chain, so every surface stays same-source by construction.
 * The pagination cursor is deliberately NOT a chip: it is the server's
 * continuation state of the loaded base, not a filter choice (R90 ruling).
 */
import { SINCE_OPTIONS } from "./SinceQuickFilter";
import { statusView } from "./model";

export interface ChipSpec {
  key: string;
  label: string;
  unknownValue: string | null;
  remove: readonly string[];
  title?: string;
}

const RISK_KNOWN: Record<string, string> = {
  high: "高风险",
  medium: "中等风险",
  low: "低风险",
  critical: "严重风险",
  none: "未标注风险",
};

const SORT_KNOWN: Record<string, string> = {
  title: "标题",
  status: "状态",
  risk: "风险",
  time: "时间",
};

/** 与分桶轨同款：尾段 8 位大写短码，禁裸 human:/emp_ 上屏。 */
function actorShort(handle: string): string {
  const tail = handle.split(/[:_/@#-]/).filter(Boolean).pop() ?? "";
  const clean = tail.replace(/[^0-9A-Za-z]/g, "").slice(0, 8).toUpperCase();
  return clean ? `人员 · ${clean}` : "人员";
}

export function chipsFor(params: URLSearchParams): ChipSpec[] {
  const chips: ChipSpec[] = [];
  const status = params.get("status");
  if (status) {
    const view = statusView(status);
    const known = view.label !== "状态未识别";
    chips.push({
      key: "status",
      label: known ? `状态：${view.label}` : `状态：${status}`,
      unknownValue: known ? null : status,
      remove: ["status"],
    });
  }
  const q = params.get("q");
  if (q) chips.push({ key: "q", label: `搜索：${q}`, unknownValue: null, remove: ["q"] });
  const actor = params.get("actor");
  if (actor)
    chips.push({
      key: "actor",
      label: `审批人：${actorShort(actor)}`,
      unknownValue: null,
      remove: ["actor"],
      title: actor,
    });
  const since = params.get("since");
  if (since) {
    const option = SINCE_OPTIONS.find((item) => item.value === since);
    chips.push({
      key: "since",
      label: option ? `时间：${option.label}` : `时间：${since}`,
      unknownValue: option ? null : since,
      remove: ["since"],
    });
  }
  const risk = params.get("risk");
  if (risk) {
    const label = RISK_KNOWN[risk.toLowerCase()];
    chips.push({
      key: "risk",
      label: label ? `风险：${label}` : `风险：${risk}`,
      unknownValue: label ? null : risk,
      remove: ["risk"],
    });
  }
  const asort = params.get("asort");
  if (asort) {
    const dir = params.get("adir") === "desc" ? "降序" : "升序";
    const label = SORT_KNOWN[asort.toLowerCase()];
    chips.push({
      key: "sort",
      label: label ? `排序：${label}${dir}` : `排序：${asort}`,
      unknownValue: label ? null : asort,
      remove: ["asort", "adir"],
    });
  }
  return chips;
}

export function FilterSummary({
  params,
  onRemove,
}: {
  params: URLSearchParams;
  onRemove: (keys: readonly string[]) => void;
}) {
  const chips = chipsFor(params);
  /* 折叠态这一行是「当前按什么看」的唯一读数：有值逐项显示（状态/时间/风险
     各一枚），空值不能变成「什么都没有」——没有筛选本身也是生效条件，明说
     「全部」。读数行用独立 testid，chips 行的「空时整条不渲染」契约不变。 */
  if (chips.length === 0)
    return (
      <span
        className="min-w-0 break-words text-xs text-muted-foreground"
        data-testid="apv-filter-summary-all"
      >
        生效条件：全部
      </span>
    );
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs"
      role="group"
      aria-label="当前生效筛选"
      data-testid="apv-filter-summary"
    >
      <span className="text-muted-foreground">生效筛选：</span>
      {chips.map((chip) => (
        <span
          key={chip.key}
          data-testid={`apv-chip-${chip.key}`}
          title={
            chip.unknownValue !== null
              ? `该值未被识别：${chip.unknownValue}（仍可移除）`
              : chip.title
          }
          className={`inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 ${
            chip.unknownValue !== null ? "border-warning/50" : "border-white/15"
          }`}
        >
          <span className="min-w-0 break-words">{chip.label}</span>
          <button
            type="button"
            aria-label={`移除筛选：${chip.label}`}
            data-testid={`apv-chip-remove-${chip.key}`}
            onClick={() => onRemove(chip.remove)}
            className="rounded-sm px-0.5 text-muted-foreground hover:bg-white/10 hover:text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/60"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
