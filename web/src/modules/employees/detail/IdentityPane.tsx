import { Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";

/**
 * 身份链接分区（PE-03 五分区之四）：PE-04 组件的挂载点。
 *
 * 身份链接读口未活前整块按「未接入」呈现——按卡面这不是错误、也不是空态，
 * 是「这块还没接线」的诚实标注，title 带 GAP/PE-04 编号，供总控台账核销。
 * 本区零请求、零写入口。
 */

export default function IdentityPane() {
  return (
    <div className="flex flex-col gap-3" data-testid="emp-detail-zone-identity">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <span title="GAP-PE-04：身份链接组件（PE-04）尚未挂载，读口未活">身份链接</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground" data-testid="emp-detail-identity-not-wired">
            未接入（GAP-PE-04）：身份链接组件将在 PE-04 接线后挂载于此；当前不显示任何身份关联数据。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
