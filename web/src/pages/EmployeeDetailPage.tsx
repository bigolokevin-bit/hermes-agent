import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@nous-research/ui/ui/components/tabs";

import { fetchJSON } from "@/lib/api";
import {
  EmptyBlock,
  ErrorStateBlock,
  LIFECYCLE,
  RowsSkeleton,
  StatusBadge,
  displayName,
  errStatus,
  humanize,
  idOf,
  isRecord,
  lifecycleOf,
  nameOf,
  requestIdOf,
  type BlockState,
  type Rec,
} from "@/pages/EmployeesPage";

import OverviewPane from "@/modules/employees/detail/OverviewPane";
import AssignmentPane from "@/modules/employees/detail/AssignmentPane";
import AccessPane from "@/modules/employees/detail/AccessPane";
import IdentityPane from "@/modules/employees/detail/IdentityPane";
import ActivityPane from "@/modules/employees/detail/ActivityPane";

/**
 * 数字员工详情页（只读）—— PE-03：五个冻结分区
 * 档案 / 任职 / 权限 / 身份链接 / 活动。
 *
 * 分区口径（卡面对齐，旧「概览/聊天/任务/运行/审计」Tab 集退役）：
 *  - 档案（OverviewPane）：基本信息 + 当前版本（employee-versions 读腿）
 *    + 最近流转（读口 501 → 未接入腿，不阻塞其余字段）；
 *  - 任职（AssignmentPane）：workstations?id=&limit=20 真数据行；
 *  - 权限（AccessPane）：effective-config?id= 投影 grants[] + 数据时刻，
 *    409 no_effective_version = 真实状态文案；
 *  - 身份链接（IdentityPane）：PE-04 挂载点，读口未活前整块未接入；
 *  - 活动（ActivityPane）：PE-02 钉死的四区块（sessions/tasks/runs/audit
 *    参数名 + 防串护栏）原样合并，一字不回退。
 * 聊天区（ChatPage 挂载）属 B 车道：不并入、不重排其入口，本文件不碰。
 *
 * 每个分区只在被选中时挂载并各取各的数，独立 loading/ready/failed+原因
 * +请求号/empty 四态，互不牵连；任一端点没上线只降级它自己那一块，绝不
 * 编造行。整页没有任何写操作。
 *
 * 旧值深链兼容（不动 shell/routes.ts，页内映射）：
 *   ?zone=config → 权限；?zone=tasks|runs|evidence → 活动（并直投对应区块）；
 *   新值 overview|assignment|access|identity|activity 直通；未知值 → 默认。
 *
 * 路由约定（编排方接线）：本页 `/employees/:id`，返回链回 `/employees`。
 */

// ── 详情对象取数 ─────────────────────────────────────────────────────────

type EmployeeState = BlockState<Rec>;

function failedState(err: unknown): EmployeeState {
  return {
    k: "error",
    status: errStatus(err),
    message: humanize(err),
    requestId: requestIdOf(err),
  };
}

/**
 * 详情主体：先 /employees/:id，再退到 /matrix/:id。
 * PE-07：`enabled=false`（?state= 强制预览在场）时一根请求都不发。
 */
function useEmployeeDetail(
  rawId: string,
  enabled: boolean,
): { state: EmployeeState; reload: () => void } {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<EmployeeState>({ k: "loading" });
  const id = encodeURIComponent(rawId);

  useEffect(() => {
    if (!rawId) {
      setState({ k: "ready", data: {} });
      return;
    }
    if (!enabled) return;
    let alive = true;
    setState({ k: "loading" });
    const primary = `/agent-api/api/employees/${id}`;
    const fallback = `/agent-api/api/matrix/${id}`;
    const unwrap = (raw: unknown): Rec => {
      if (isRecord(raw) && isRecord(raw.employee)) return raw.employee as Rec;
      if (isRecord(raw) && isRecord(raw.data)) return raw.data as Rec;
      return isRecord(raw) ? raw : {};
    };
    fetchJSON<unknown>(primary)
      .then((raw) => alive && setState({ k: "ready", data: unwrap(raw) }))
      .catch((err1: unknown) =>
        fetchJSON<unknown>(fallback)
          .then((raw) => alive && setState({ k: "ready", data: unwrap(raw) }))
          .catch((err2: unknown) =>
            alive && setState(failedState(err1 instanceof Error && errStatus(err1) ? err1 : err2))),
      );
    return () => {
      alive = false;
    };
  }, [id, rawId, nonce, enabled]);

  return { state, reload: () => setNonce((n) => n + 1) };
}

// ── 分区表 ───────────────────────────────────────────────────────────────

const ZONES = [
  { value: "overview", label: "档案" },
  { value: "assignment", label: "任职" },
  { value: "access", label: "权限" },
  { value: "identity", label: "身份链接" },
  { value: "activity", label: "活动" },
] as const;

type ZoneValue = (typeof ZONES)[number]["value"];

/**
 * 旧深链值 → 新分区（?zone= 旧不死条款）；tasks/runs/evidence 进活动分区时
 * 直投对应区块（evidence 的现网载体是 audit 区块）。
 * 默认落「活动」：与 routes.ts DETAIL_TAB 的 workbench 默认区（任务/运行/
 * 会话/证据看板）语义最接近；档案 Tab 仍在首位。此为卡面未明说的假定，
 * 已在 DONE.md「假定」台账记录。
 */
const ZONE_COMPAT: Record<string, { zone: ZoneValue; block?: string }> = {
  config: { zone: "access" },
  tasks: { zone: "activity", block: "tasks" },
  runs: { zone: "activity", block: "runs" },
  evidence: { zone: "activity", block: "audit" },
};

const DEFAULT_ZONE: ZoneValue = "activity";

function resolveZone(raw: string): { zone: ZoneValue; block?: string } {
  const compat = ZONE_COMPAT[raw];
  if (compat) return compat;
  if (ZONES.some((z) => z.value === raw)) return { zone: raw as ZoneValue };
  return { zone: DEFAULT_ZONE };
}

// ── PE-07：?state= 四态强制预览 ──────────────────────────────────────────
//
// 与深链壳（shell/console.tsx，A 车道预嵌，本笔不动）同口径的页内实现：
// 强制态整块替换，分区 Tab 与五分区一律不渲染；一根请求都不发。
// denied 腿抄 EmployeesPage.tsx:391,625-655 标杆——「暂不可见」+403/404 合并
// 话术，屏上永不出现「未接入」；error 腿带请求号且可复制（RequestIdCopy）。

type DetailForced = "loading" | "empty" | "error" | "denied";

function readForcedState(raw: string | null): DetailForced | null {
  return raw === "loading" || raw === "empty" || raw === "error" || raw === "denied" ? raw : null;
}

// ── 页面 ─────────────────────────────────────────────────────────────────

export default function EmployeeDetailPage() {
  // Snapshot fix (PRD §9.1 lane A): the live route registers `:employeeId`
  // (App PATH_COMPONENT '/employees/:employeeId' and shell/routes DETAIL_TAB
  // agree on this spelling), so reading only `id` — the stale snapshot shape
  // — gave rawId === "" for every real visit and the page always fell to the
  // empty state. Both spellings are accepted, `employeeId` authoritative,
  // so the legacy-`:id` test harness keeps passing too.
  const params = useParams<{ employeeId?: string; id?: string }>();
  const rawParam = params.employeeId ?? params.id ?? "";
  const rawId = rawParam !== "" ? decodeURIComponent(rawParam) : "";
  const enc = encodeURIComponent(rawId);
  const [sp, setSp] = useSearchParams();
  const forced = readForcedState(sp.get("state"));
  const { state, reload } = useEmployeeDetail(rawId, forced === null);
  const resolved = resolveZone(sp.get("zone") ?? "");

  // 强制态要有真出口（shell T42-1 同条款）：重试即摘掉 ?state=/?rid= 回活体读取。
  const leavePreview = () => {
    const next = new URLSearchParams(sp);
    next.delete("state");
    next.delete("rid");
    setSp(next, { replace: true });
  };

  const detail = state.k === "ready" ? state.data : null;
  const dn = detail ? displayName(nameOf(detail), (idOf(detail) ?? rawId) || null) : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          to="/employees"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
          返回数字员工
        </Link>
      </div>

      {forced !== null && (
        <div data-testid="emp-detail-preview" data-phase={forced}>
          {forced === "loading" && (
            <div data-testid="emp-detail-loading" aria-label="正在加载员工详情">
              <DetailHeaderSkeleton />
              <RowsSkeleton rows={3} />
            </div>
          )}

          {forced === "empty" && (
            <EmptyBlock
              text="还没找到这位员工的档案"
              hint="后台还没有该员工的档案记录；这里不伪造样例，也不把缺失写成 0。"
            />
          )}

          {forced === "error" && (
            <ErrorStateBlock
              status={502}
              message="预览错误：这次读取没有成功，页面没有编造员工数据。"
              requestId={sp.get("rid") ?? "preview-request"}
              deniedTitle="无法打开该员工"
              errorTitle="该员工档案没能加载出来"
              onRetry={leavePreview}
            />
          )}

          {forced === "denied" && (
            // 标杆口径（EmployeesPage.tsx:625-655）：403/404 同一整页话术，
            // 屏上永不出现「未接入」；GAP 编号不上本腿。
            <ErrorStateBlock
              status={403}
              message=""
              requestId={sp.get("rid") ?? "preview-request"}
              deniedTitle="该员工档案暂不可见"
              errorTitle="无法打开该员工"
              onRetry={leavePreview}
            />
          )}
        </div>
      )}

      {forced === null && !rawId && (
        <EmptyBlock text="无法确定要查看的员工" hint="链接里缺少员工编号。请回到数字员工列表，从列表中重新进入。" />
      )}

      {forced === null && rawId && state.k === "loading" && (
        <>
          <DetailHeaderSkeleton />
          <RowsSkeleton rows={3} />
        </>
      )}

      {forced === null && rawId && state.k === "error" && (
        <ErrorStateBlock
          status={state.status}
          message={state.message}
          requestId={state.requestId}
          deniedTitle="无法打开该员工"
          errorTitle="无法加载该员工"
          onRetry={reload}
        />
      )}

      {forced === null && rawId && detail && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/20 text-muted-foreground">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-mondwest text-lg tracking-wider" title={rawId || undefined}>
                  {dn?.text ?? "—"}
                </h1>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge value={lifecycleOf(detail)} table={LIFECYCLE} unknownLabel="待核实" />
                </div>
              </div>
            </div>
            {dn?.raw && <span className="text-xs text-muted-foreground">工位编号仅用于系统标识</span>}
          </header>

          <Tabs key={resolved.zone} defaultValue={resolved.zone}>
            {(active, setActive) => (
              <>
                <TabsList role="tablist" aria-label="员工详情分区" className="w-full overflow-x-auto scrollbar-none">
                  {ZONES.map((zone) => (
                    <TabsTrigger
                      key={zone.value}
                      role="tab"
                      value={zone.value}
                      id={`zone-tab-${zone.value}`}
                      aria-selected={active === zone.value}
                      aria-controls={`zone-panel-${zone.value}`}
                      active={active === zone.value}
                      onClick={() => setActive(zone.value)}
                    >
                      {zone.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div role="tabpanel" id={`zone-panel-${active}`} aria-labelledby={`zone-tab-${active}`} className="pt-1">
                  {active === "overview" && <OverviewPane detail={detail} rawId={rawId} enc={enc} />}
                  {active === "assignment" && <AssignmentPane rawId={rawId} enc={enc} />}
                  {active === "access" && <AccessPane rawId={rawId} enc={enc} />}
                  {active === "identity" && <IdentityPane rawId={rawId} enc={enc} />}
                  {active === "activity" && (
                    <ActivityPane key={resolved.block ?? "chat"} rawId={rawId} enc={enc} initialBlock={resolved.block} />
                  )}
                </div>
              </>
            )}
          </Tabs>
        </>
      )}
    </div>
  );
}

function DetailHeaderSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-muted/20" />
      <div className="flex flex-col gap-2">
        <div className="h-5 w-44 animate-pulse rounded-sm bg-muted/20" />
        <div className="h-4 w-24 animate-pulse rounded-sm bg-muted/20" />
      </div>
    </div>
  );
}
