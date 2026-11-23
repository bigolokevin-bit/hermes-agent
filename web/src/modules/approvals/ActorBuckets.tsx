/**
 * R74 — per-approver buckets for the approvals surfaces (pending & history).
 *
 * The buckets are computed from the ALREADY LOADED rows (same object the table
 * renders) — clicking one never fires a request (measured: the read port
 * ignores actor=/approver=, so server-side filtering would be fake). The
 * scope sentence states 「当前已加载 N 条，不是全量」; in non-ready phases the
 * counts render 「—」 with the gates reason instead of a fake 0.
 */
import { crossPageLoadHint, gateReason } from "./gates";
import type { ApprovalRow } from "./model";

type Phase = "loading" | "empty" | "ready" | "error" | "denied";

interface Bucket {
  id: string;
  label: string;
  count: number;
}

/** 人员 · 8位大写短码（与 maskHandle 同族但不设长度门槛，桶标签不许裸 id）。 */
function actorCode(handle: string): string {
  const tail = handle.split(/[:_/@#-]/).filter(Boolean).pop() ?? "";
  const clean = tail.replace(/[^0-9A-Za-z]/g, "").slice(0, 8).toUpperCase();
  return clean ? `人员 · ${clean}` : "人员";
}

export function ActorBuckets({
  rows,
  phase,
  actor,
  onPick,
  hasMore = false,
}: {
  rows: readonly ApprovalRow[];
  phase: Phase;
  actor: string | null;
  onPick: (id: string | null) => void;
  hasMore?: boolean;
}) {
  const buckets = (() => {
    const map = new Map<string, Bucket>();
    for (const row of rows) {
      row.approverIds.forEach((id, i) => {
        if (!id) return;
        const rawLabel = row.approvers.labels[i];
        // maskHandle 对短 id（human:9）落纯「人员」——桶标签升级成 人员 · 码，
        // 保证缺名桶仍可区分且永远不裸显 id。
        const label = !rawLabel || rawLabel === "人员" ? actorCode(id) : rawLabel;
        const hit = map.get(id);
        if (hit) hit.count += 1;
        else map.set(id, { id, label, count: 1 });
      });
    }
    return [...map.values()].sort(
      (a, b) => b.count - a.count || a.id.localeCompare(b.id),
    );
  })();
  const ready = phase === "ready";
  return (
    <div className="min-w-0 space-y-1">
      <div
        className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs"
        role="group"
        aria-label="按审批人"
        data-testid="apv-actor-buckets"
      >
        <span className="text-muted-foreground">按审批人：</span>
        <button
          type="button"
          data-testid="apv-actor-all"
          aria-pressed={!actor}
          disabled={!ready}
          aria-disabled={!ready}
          title={ready ? "显示全部审批人" : `不能按审批人筛选：${gateReason(phase)}；恢复列表后自动可用。`}
          onClick={() => onPick(null)}
          className={`h-6 min-w-0 rounded-md border px-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/40 ${
            actor === null && ready
              ? "border-primary/60 text-foreground"
              : "border-border text-muted-foreground"
          } ${ready ? "hover:bg-muted/40" : "cursor-not-allowed opacity-60"}`}
        >
          全部
        </button>
        {buckets.map((bucket, i) => (
          <button
            key={bucket.id}
            type="button"
            data-testid={`apv-actor-bucket-${i}`}
            aria-pressed={actor === bucket.id}
            title={bucket.id}
            disabled={!ready}
            aria-disabled={!ready}
            onClick={() => onPick(actor === bucket.id ? null : bucket.id)}
            className={`h-6 min-w-0 max-w-full truncate rounded-md border px-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary/40 ${
              actor === bucket.id && ready
                ? "border-primary/60 text-foreground"
                : "border-border text-muted-foreground"
            } ${ready ? "hover:bg-muted/40" : "cursor-not-allowed opacity-60"}`}
          >
            {bucket.label}{" "}
            <b className="font-mono">{ready ? bucket.count : "—"}</b>
          </button>
        ))}
        {ready && buckets.length === 0 ? (
          <span className="text-muted-foreground" data-testid="apv-actor-none">
            已加载的行里没有带审批人的记录。
          </span>
        ) : null}
      </div>
      <p
        className="min-w-0 break-words text-xs text-muted-foreground"
        data-testid="apv-actor-scope-note"
        data-apv-actor-scope-note="local-buckets"
        title="实测本页读口带 actor=/approver= 与不带时返回同一全量（即本页已加载的全部行），后台不做按审批人过滤；为避免假筛选，这里只做前端本地过滤，点击不产生新请求。"
      >
        按当前已加载 {rows.length} 条统计，不是全量；点击桶＝本地过滤，不发新请求。
        {hasMore ? (
          <span data-testid="apv-actor-crosspage" data-apv-actor-crosspage="needs-load">
            {` ${crossPageLoadHint(true)}`}
          </span>
        ) : null}
      </p>
    </div>
  );
}
