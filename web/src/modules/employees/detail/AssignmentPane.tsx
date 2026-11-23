import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";

import {
  EmptyBlock,
  ErrorStateBlock,
  RowsSkeleton,
  idOf,
  pickStr,
  type Rec,
} from "@/pages/EmployeesPage";

import { useGuardedRows } from "./fetchState";

/**
 * 任职分区（PE-03 五分区之二）：读 /agent-api/api/workstations?id=<enc>&limit=20
 * 的绑定真数据。
 *
 * 现网实测行形状：items[].{id, employeeId, bindingType, channel, externalRef,
 * capabilities[], status}。展示 渠道 channel / 会话引用 externalRef / 绑定态
 * status+bindingType（值照 payload 原样呈现，不臆造翻译）；capabilities
 * 「有则列」——所有行都缺时裁掉该列，不摆假空列。
 * 合法空态是「该员工暂无绑定的工作站」——响应 200 且零行才算空，与「未接入」
 * 两套文案严格分开。归属护栏沿用 PE-02：行内 employeeId 对不上整块转错误。
 */

export default function AssignmentPane({ rawId, enc }: { rawId: string; enc: string }) {
  const { state, reload } = useGuardedRows(`/agent-api/api/workstations?id=${enc}&limit=20`, rawId);
  const rows = state.k === "ready" ? state.data : [];
  // 整列皆缺则裁该列：只要有任一行带非空 capabilities 才保留。
  const hasCapabilities = rows.some(
    (r) => Array.isArray(r.capabilities) && (r.capabilities as unknown[]).some((c) => typeof c === "string" && c.trim() !== ""),
  );

  return (
    <div className="flex flex-col gap-3" data-testid="emp-detail-zone-assignment">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            工作站绑定
            {state.k === "ready" && rows.length > 0 && (
              // 「共N条」只从 payload 行数来；该端点无 total 字段，不摆更大数字。
              <span className="ml-2 text-xs font-normal text-muted-foreground" data-testid="emp-assignment-count">
                共{rows.length}条
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {state.k === "loading" && <RowsSkeleton rows={3} />}

          {state.k === "error" && (
            <ErrorStateBlock
              status={state.status}
              message={state.message}
              requestId={state.requestId}
              deniedTitle="无法打开任职信息"
              errorTitle="任职信息加载失败"
              onRetry={reload}
            />
          )}

          {state.k === "ready" &&
            (rows.length === 0 ? (
              <EmptyBlock text="该员工暂无绑定的工作站" hint="任职读腿响应正常，但没有返回任何工作站绑定。" />
            ) : (
              <ul className="flex flex-col gap-2">
                {rows.map((row, i) => (
                  <li key={idOf(row) ?? `ws-${i}`} data-testid="emp-assignment-row">
                    <StationRow row={row} showCapabilities={hasCapabilities} />
                  </li>
                ))}
              </ul>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StationRow({ row, showCapabilities }: { row: Rec; showCapabilities: boolean }) {
  const channel = pickStr(row, ["channel"]);
  const externalRef = pickStr(row, ["externalRef", "external_ref"]);
  const status = pickStr(row, ["status"]);
  const bindingType = pickStr(row, ["bindingType", "binding_type"]);
  const caps = showCapabilities
    ? (Array.isArray(row.capabilities) ? (row.capabilities as unknown[]) : []).filter(
        (c): c is string => typeof c === "string" && c.trim() !== "",
      )
    : [];

  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate font-medium" title={externalRef ?? undefined}>
            渠道：{channel ?? "—"}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {status ?? "—"}
            {bindingType ? ` · ${bindingType}` : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span title={externalRef ?? undefined}>会话引用：{externalRef ?? "—"}</span>
          {showCapabilities && <span>能力：{caps.length > 0 ? caps.join("、") : "—"}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
