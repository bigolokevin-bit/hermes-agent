import { useMemo, type ReactNode } from "react";
import { CircleDollarSign, History, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";

import {
  EmptyBlock,
  ErrorStateBlock,
  LIFECYCLE,
  RowsSkeleton,
  StatusBadge,
  beijing,
  displayName,
  idOf,
  isRecord,
  lifecycleOf,
  money,
  nameOf,
  pickStr,
  refLabel,
  type Rec,
} from "@/pages/EmployeesPage";

import { useGuardedRows } from "./fetchState";
import { NotWiredBlock, cell, useNotWiredRead } from "./notWiredLeg";

/**
 * 档案分区（PE-03 五分区之一）：基本信息 + 「当前版本」+「最近流转」小节。
 *
 * 「当前版本」独立走一条读腿 /agent-api/api/employee-versions?id=&limit=1
 * （现网 keyset 形状，items[0] 即最新生效版本），有自己的四态；这条腿挂了
 * 只降级它自己，绝不阻塞其余字段。「最近流转」Q41a 接线为真实读腿
 * GET /agent-api/api/employees/<id>/transitions：现网 BFF 恒 501
 * employee_transitions.not_wired（域侧仅 POST 写口），未接入态文案逐字取
 * 服务端信封 code+message+请求号——「没接线」不是错误也不是空态，三套语义
 * 严格分开；上游读口落地后本腿零改动自动变真数据。禁造假 200。
 */

/** 「最近流转」未接入腿的 GAP 台账号（待总控在 people.md 补正式号后替换）。 */
export const FLUX_GAP_ID = "GAP-PE-03";

export default function OverviewPane({
  detail,
  rawId,
  enc,
}: {
  detail: Rec;
  rawId: string;
  enc: string;
}) {
  return (
    <div className="flex flex-col gap-4" data-testid="emp-detail-zone-overview">
      <BasicCard detail={detail} rawId={rawId} />
      <VersionCard enc={enc} rawId={rawId} />
      <FluxCard rawId={rawId} enc={enc} />
    </div>
  );
}

// ── 基本信息（原概览内容，一字不丢） ─────────────────────────────────────

function BasicCard({ detail, rawId }: { detail: Rec; rawId: string }) {
  const station = pickStr(detail, ["station", "seat", "workspace", "role", "position", "desk"]);
  const model = pickStr(detail, ["model", "model_name"]);
  const provider = pickStr(detail, ["provider"]);
  const owner = refLabel(detail.owner ?? detail.manager ?? detail.created_by ?? detail.assignee);
  const created = beijing(detail.created_at ?? detail.createdAt ?? detail.created);
  const lastSeen = beijing(detail.last_seen ?? detail.last_active ?? detail.last_active_at ?? detail.updated_at);
  const spend = money(detail.spend ?? detail.spent ?? detail.cost ?? detail.usage_cost ?? detail.budget_spent);

  const stats = isRecord(detail.stats) || isRecord(detail.metrics) || isRecord(detail.summary)
    ? ((detail.stats ?? detail.metrics ?? detail.summary) as Rec)
    : null;
  const kpis = useMemo(() => {
    const src = stats ?? detail;
    return {
      tasks: pickStr(src, ["tasks", "tasks_count", "task_count", "total_tasks", "open_tasks", "pending_tasks"]),
      runs: pickStr(src, ["runs", "runs_count", "run_count", "total_runs"]),
      sessions: pickStr(src, ["sessions", "sessions_count", "chat_count", "total_sessions"]),
    };
  }, [stats, detail]);

  const dn = displayName(nameOf(detail), (idOf(detail) ?? rawId) || null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Info term="工位">{station ?? "—"}</Info>
            <Info term="身份" raw={rawId}>{dn.text}</Info>
            <Info term="模型" raw={model ?? undefined}>{model ?? "—"}</Info>
            <Info term="模型提供方">{provider ?? "—"}</Info>
            <Info term="负责人">{owner ?? "未指派"}</Info>
            <Info term="在岗状态">
              <StatusBadge value={lifecycleOf(detail)} table={LIFECYCLE} unknownLabel="待核实" />
            </Info>
            <Info term="创建时间">{created}</Info>
            <Info term="最近活动">{lastSeen}</Info>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            预算与支出
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Info term="支出">{spend}</Info>
            <Info term="预算">{hasMoney(detail.budget) ? money(detail.budget) : "—"}</Info>
            <Info term="剩余">{hasMoney(detail.remaining ?? detail.budget_remaining) ? money(detail.remaining ?? detail.budget_remaining) : "—"}</Info>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">金额为美元；未提供的项目显示「—」，未计价的成本显示「未计价」。</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">工作量</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="任务" value={kpis.tasks} />
            <Kpi label="运行" value={kpis.runs} />
            <Kpi label="会话" value={kpis.sessions} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function hasMoney(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  return typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v));
}

function Info({ term, raw, children }: { term: string; raw?: string | null; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="mt-0.5 truncate text-sm" title={raw ?? undefined}>
        {children}
      </dd>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-border/60 bg-muted/10 px-2 py-3 text-center">
      <span className="text-lg font-semibold tabular-nums">{value ?? "—"}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ── 当前版本：独立读腿，独立四态 ─────────────────────────────────────────

function VersionCard({ enc, rawId }: { enc: string; rawId: string }) {
  // keyset 形状现网实测：items[] 按 versionNo 降序，limit=1 即最新生效版本。
  const { state, reload } = useGuardedRows(`/agent-api/api/employee-versions?id=${enc}&limit=1`, rawId);
  const current = state.k === "ready" && state.data.length > 0 ? state.data[0] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Tag className="h-4 w-4 text-muted-foreground" />
          当前版本
        </CardTitle>
      </CardHeader>
      <CardContent>
        {state.k === "loading" && <RowsSkeleton rows={2} />}

        {state.k === "error" && (
          <ErrorStateBlock
            status={state.status}
            message={state.message}
            requestId={state.requestId}
            deniedTitle="无法打开当前版本"
            errorTitle="当前版本加载失败"
            onRetry={reload}
          />
        )}

        {state.k === "ready" &&
          (current === null ? (
            // 合法空态：有响应但没有版本行 —— 与「未接入」严格分开。
            <EmptyBlock text="尚无生效版本" hint="该员工还没有任何已生效的版本记录。" />
          ) : (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Info term="版本号">{pickStr(current, ["versionNo"]) ?? "—"}</Info>
              <Info term="生效时间">{beijing(current.effectiveFrom)}</Info>
              <Info term="创建人">{pickStr(current, ["createdBy", "created_by"]) ?? "—"}</Info>
              <Info term="变更说明" raw={pickStr(current, ["changeNote"])}>
                {pickStr(current, ["changeNote"]) ?? "—"}
              </Info>
            </dl>
          ))}
      </CardContent>
    </Card>
  );
}

// ── 最近流转：Q41a 真实读腿（501 族→未接入；200→真行；失败→错误态） ──────

function FluxCard({ rawId, enc }: { rawId: string; enc: string }) {
  const { state, reload } = useNotWiredRead(`/agent-api/api/employees/${enc}/transitions`, rawId);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <History className="h-4 w-4 text-muted-foreground" />
          <span title="Q41a：版本流转读腿——现网 501 显示未接入（域侧仅写口），上游读口落地后自动变真数据">
            最近流转
          </span>
          {state.k === "ready" && state.rows.length > 0 && <span>（{state.rows.length}）</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {state.k === "loading" && <RowsSkeleton rows={2} />}

        {/* 「未接入」≠ 错误 ≠ 空态：读口没上线，如实标注，不摆错误块也不摆空块。 */}
        {state.k === "notWired" && (
          <NotWiredBlock state={state} testid="emp-detail-flux-not-wired" />
        )}

        {state.k === "error" && (
          <ErrorStateBlock
            status={state.status}
            message={state.message}
            requestId={state.requestId}
            deniedTitle="无权查看流转记录"
            errorTitle="流转记录读取失败"
            onRetry={reload}
          />
        )}

        {state.k === "ready" && state.rows.length === 0 && (
          <p className="text-sm text-muted-foreground" data-testid="emp-detail-flux-empty">
            暂无流转记录。
          </p>
        )}

        {state.k === "ready" && state.rows.length > 0 && (
          <ul className="flex flex-col gap-2" data-testid="emp-detail-flux-rows">
            {state.rows.map((row, i) => (
              <li key={`${cell(row, ["id", "transitionId"])}-${i}`} className="text-sm">
                <span className="font-mono text-xs">
                  {cell(row, ["fromStatus", "from", "fromLifecycle", "from_lifecycle"])} →{" "}
                  {cell(row, ["toStatus", "to", "toLifecycle", "to_lifecycle"])}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {cell(row, ["occurredAt", "createdAt", "at", "effectiveFrom"])} ·{" "}
                  {cell(row, ["actor", "createdBy", "operator"])} ·{" "}
                  {cell(row, ["note", "changeNote", "reason"])}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
