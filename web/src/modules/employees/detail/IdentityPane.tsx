import { Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";

import { RowsSkeleton } from "@/pages/EmployeesPage";

import { NotWiredBlock, cell, useNotWiredRead } from "./notWiredLeg";

/**
 * 身份链接分区（PE-03 五分区之四）——Q41a 接线。
 *
 * 静态占位换为真实读腿：GET /agent-api/api/identity-links?employeeId=。
 * 现网 BFF 该读口恒 501 identity.not_wired（域侧仅有创建/撤销，无 HTTP 读口），
 * 未接入态文案逐字取服务端信封 code+message+请求号；上游接线（域读口落地+
 * BFF 删 not_wired 键）后此处自动变为真数据列表，零改动。
 * 禁造假 200：不合成行、不把 501 伪装成空列表；「未接入」≠「空态」≠「错误」。
 */
const STATUS_TEXT: Record<string, string> = {
  active: "生效中",
  stale: "已过期（不自动删）",
  revoked: "已撤销",
};

export default function IdentityPane({ rawId, enc }: { rawId: string; enc: string }) {
  const { state } = useNotWiredRead(`/agent-api/api/identity-links?employeeId=${enc}`, rawId);

  return (
    <div className="flex flex-col gap-3" data-testid="emp-detail-zone-identity">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <span title="Q41a：身份链接读腿——501 族显示未接入，上游接线后自动变真数据">
              身份链接
            </span>
            {state.k === "ready" && state.rows.length > 0 && <span>（{state.rows.length}）</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {state.k === "loading" && <RowsSkeleton rows={2} />}

          {state.k === "notWired" && (
            <NotWiredBlock state={state} testid="emp-detail-identity-not-wired" />
          )}

          {state.k === "error" && (
            <p className="text-sm text-destructive" role="alert" data-testid="emp-detail-identity-error">
              读取失败（{state.status || "—"}）：{state.message}（请求号 {state.requestId ?? "—"}）
            </p>
          )}

          {state.k === "ready" && state.rows.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="emp-detail-identity-empty">
              该员工暂无身份链接记录。
            </p>
          )}

          {state.k === "ready" && state.rows.length > 0 && (
            <ul className="flex flex-col gap-2" data-testid="emp-detail-identity-rows">
              {state.rows.map((row, i) => (
                <li key={cell(row, ["id", "linkId"]) === "—" ? String(i) : cell(row, ["id", "linkId"])}>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">渠道</dt>
                      <dd className="font-mono text-xs">{cell(row, ["channel"])}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">外部标识</dt>
                      <dd className="break-all font-mono text-xs">{cell(row, ["externalId", "external_id"])}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">状态</dt>
                      <dd>{STATUS_TEXT[cell(row, ["status"])] ?? cell(row, ["status"])}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">建立时间</dt>
                      <dd>{cell(row, ["createdAt", "created_at"])}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground" data-testid="emp-detail-identity-note">
        数据截至：以请求完成为准（读取时刻见请求号对应日志）；过期链接标记「已过期（不自动删）」，不静默隐藏。
      </p>
    </div>
  );
}
