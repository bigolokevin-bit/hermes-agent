/**
 * 审计事件详情 (screen 2 of the audit surface, `aud02-*`).
 *
 * One real read:
 *   `GET /agent-api/api/audit-detail?id=<eventId>`
 *
 * The record opens from the URL, so a shared link shows the same event. The
 * human layer says who did what, when (Beijing wall clock to the minute), to
 * what, with what result and why, and quotes 请求编号 for support. Engineering
 * language — raw field names, the service's own codes, digests, the source
 * system, the tenant id, a stack line — is only ever inside the collapsed
 * 「技术详情」, which is closed by default; closed means those strings are not in
 * the DOM at all.
 *
 * Four states, all of them the service's own answer: loading skeleton, 没这条
 * 记录 (the service answered with nothing readable), error in human words with a
 * copyable 请求编号 and a retry, and denied — 403 and 404 rendering one identical
 * body. Without an `id` the page asks nothing and says what it needs.
 */
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Compass } from "lucide-react";

import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { DeniedPanel, DetailCopy, ErrorPanel, LoadingPanel } from "./states";
import { AuditEventDetailBody } from "./views";
import { useAuditDetail } from "./useAuditData";

export function AuditDetailModulePage(): ReactNode {
  // R37: no ?state= repro leg — all four states come from the service's answer.
  const [params] = useSearchParams();
  // R31: the documented spelling is `?detail=`; `?id=` stays readable for old links.
  const id = params.get("detail") ?? params.get("id");
  const detail = useAuditDetail(id, null);

  const statusLine = (() => {
    if (!id) return "还没有指定要看哪一条事件";
    if (detail.phase === "loading") return "正在读取这条审计事件…";
    if (detail.phase === "denied") return "这条事件暂不可用";
    if (detail.phase === "error") return "这条事件的详情没能加载出来";
    return "这条事件的详情已经读出来了";
  })();

  const body = (() => {
    if (!id) {
      // Nothing to ask for: the page names what it needs instead of guessing an id.
      return (
        <Card className="border-border bg-card" data-testid="aud02-no-id">
          <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
            <Compass className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="min-w-0 break-words text-sm">要先选中一条审计事件</p>
            <p className="max-w-prose break-words text-xs text-muted-foreground">
              从「审计事件」列表里点开一条，或者直接在这条链接后面带上事件编号。这里不会猜要读哪一条，也不会先给一份别人的记录。
            </p>
            {/* R121: the same honest disabled control on the standalone page. */}
            <DetailCopy event={null} />
          </CardContent>
        </Card>
      );
    }
    if (detail.phase === "loading") {
      return <LoadingPanel testId="aud02-detail-loading" slot="detail" />;
    }
    if (detail.phase === "denied") {
      return (
        <DeniedPanel failure={detail.failure} testId="aud02-detail-denied" slot="detail" onRetry={detail.reload} />
      );
    }
    if (detail.phase === "error" || !detail.detail) {
      return (
        <ErrorPanel
          failure={detail.failure ?? { sentence: "这条事件的详情没能读出来。", requestId: null, technical: null }}
          onRetry={detail.reload}
          title="这条事件没能加载出来"
          testId="aud02-detail-error"
          slot="detail"
        />
      );
    }
    return <AuditEventDetailBody detail={detail.detail} testId="aud02-detail" />;
  })();

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-3" data-testid="agent-v2-page-audit-detail" data-page="audit-detail">
      <p className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite" data-testid="aud02-status">
        {statusLine}
      </p>

      <p className="min-w-0 break-words text-xs text-muted-foreground">时间为北京时间，精确到分。</p>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col gap-2" aria-label="事件详情">
          {body}
        </section>
      </div>
    </div>
  );
}

export default AuditDetailModulePage;
