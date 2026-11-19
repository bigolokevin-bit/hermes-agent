/**
 * 时间窗完整性校验 (screen 3 of the audit surface, `aud03-*`).
 *
 * One real call, and only when a person asks for it:
 *   `GET /agent-api/api/audit-verify?from=<ISO>&to=<ISO>`
 *
 * Nothing here is implied. The check does not run on page load, and a result is
 * only ever what the service answered:
 *   ready        counts shown with their denominators (已核对 X / Y，对不上 Z);
 *                a missing number stays 「—」 with the reason in its `title`
 *   unavailable  403 / 404 / 405 / 501 / 连不上 / 5xx → 「本环境未启用」 + the
 *                reason + where to go next + the request id, with 403 and 404
 *                rendering the exact same body. Never a green chain
 *   error        the answer came back but carries no check shape at all
 *
 * The window bounds are ISO on the wire and never on the screen: the page
 * shows Beijing wall clock, labelled as such. `?state=` is the shell's QA repro
 * and stamps `data-fixture`.
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Link2, RefreshCw, ShieldQuestion } from "lucide-react";

import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import type { FailureCopy, VerifyFailure } from "./copy";
import { fixtureAttr } from "./fixture";
import { beijing } from "./model";
import { ErrorPanel, LoadingPanel, VerifyUnavailablePanel } from "./states";
import { VerifyResultBody } from "./views";
import { DEFAULT_WINDOW, WINDOW_CHOICES, windowBounds, type WindowKey } from "./window";
import { forcedStateOf, useAuditVerify } from "./useAuditData";

export function AuditVerifyModulePage(): ReactNode {
  const [params] = useSearchParams();
  const forced = forcedStateOf(params.get("state"));
  const [choice, setChoice] = useState<WindowKey>(DEFAULT_WINDOW);
  /** The window the last run actually asked for; `null` until someone runs one. */
  const [askedKey, setAskedKey] = useState<WindowKey | null>(null);

  const verify = useAuditVerify(forced);
  const askVerify = verify.run;

  const run = useCallback(
    (key: WindowKey) => {
      setAskedKey(key);
      setChoice(key);
      const bounds = windowBounds(key);
      askVerify(bounds.from, bounds.to);
    },
    [askVerify],
  );

  const askedLabel = useMemo(() => {
    if (verify.asked.from === null && verify.asked.to === null) return null;
    const from = beijing(verify.asked.from);
    const to = beijing(verify.asked.to);
    if (!from || !to) return null;
    return { from, to };
  }, [verify.asked.from, verify.asked.to]);

  const body = (() => {
    if (verify.phase === "loading") {
      return <LoadingPanel testId="aud03-loading" fixture={verify.forced ? "loading" : undefined} />;
    }
    if (verify.phase === "ready" && verify.result) {
      return (
        <VerifyResultBody
          result={verify.result}
          askedFrom={askedLabel?.from ?? null}
          askedTo={askedLabel?.to ?? null}
        />
      );
    }
    if (verify.phase === "unavailable") {
      const failure: FailureCopy =
        (verify.failure as VerifyFailure | null) ?? {
          sentence: "完整性校验此刻没有可用结果。",
          requestId: null,
          technical: null,
        };
      return (
        <VerifyUnavailablePanel
          failure={failure}
          onRetry={() => run(askedKey ?? choice)}
          fixture={verify.forced ? "denied" : undefined}
        />
      );
    }
    if (verify.phase === "error") {
      return (
        <ErrorPanel
          failure={verify.failure ?? { sentence: "校验回答的形状不对，这里没能读出结论。", requestId: null, technical: null }}
          onRetry={() => run(askedKey ?? choice)}
          title="完整性校验没能给出结果"
          testId="aud03-error"
          fixture={verify.forced ? "error" : undefined}
        />
      );
    }
    // The honest empty for this pane: nobody has asked, so nothing was checked.
    return (
      <Card className="border-border bg-card" data-testid="aud03-idle" {...fixtureAttr(verify.forced ? "empty" : undefined)}>
        <CardContent className="flex min-w-0 flex-col items-center gap-2 px-4 py-10 text-center">
          <ShieldQuestion className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="min-w-0 break-words text-sm">还没有运行校验</p>
          <p className="max-w-prose break-words text-xs text-muted-foreground">
            选定一段时间窗后再运行：服务会把这段时间的审计链逐条接起来核对，这里只报告它实际核对到的条数与发现的问题。
            没有跑过的校验，这里不会写「已通过」。
          </p>
        </CardContent>
      </Card>
    );
  })();

  return (
    <div className="flex min-w-0 w-full max-w-full flex-col gap-3" data-testid="agent-v2-page-audit-verify" data-page="audit-verify">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words text-xs text-muted-foreground" aria-live="polite" data-testid="aud03-status">
          {verify.phase === "loading"
            ? "正在按所选时间窗核对审计链…"
            : verify.phase === "ready"
              ? "这一轮校验已经出结果"
              : verify.phase === "unavailable"
                ? "这套环境里跑不了这个校验"
                : verify.phase === "error"
                  ? "校验没能给出可读的结论"
                  : "选好时间窗，再运行校验"}
        </p>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5" role="group" aria-label="选择校验时间窗">
        {WINDOW_CHOICES.map((item) => {
          const active = item.value === choice;
          return (
            <Button
              key={item.value}
              size="xs"
              outlined
              invert={active}
              aria-pressed={active}
              onClick={() => run(item.value)}
              data-testid={`aud03-window-${item.value}`}
            >
              {item.label}
            </Button>
          );
        })}
        <Button
          size="xs"
          outlined
          onClick={() => run(choice)}
          disabled={verify.phase === "loading"}
          prefix={<RefreshCw className="h-3.5 w-3.5" />}
          data-testid="aud03-run"
        >
          重新运行
        </Button>
      </div>

      {verify.forced ? (
        <p className="min-w-0 break-words text-xs text-warning" data-testid="aud03-forced-note">
          这是用 ?state= 复现出来的状态，不是服务此刻的回答。
        </p>
      ) : null}

      {askedLabel ? (
        <p className="min-w-0 break-words text-xs text-muted-foreground" data-testid="aud03-window-label">
          校验窗口（北京时间）：{askedLabel.from} 至 {askedLabel.to}
        </p>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <section className="flex min-w-0 flex-col gap-2" aria-label="校验结果">
          {body}
        </section>

        <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start" aria-label="校验说明">
          <Card className="border-border bg-card">
            <CardContent className="flex min-w-0 flex-col gap-2 px-4 py-4">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 break-words">这个校验在核对什么</span>
              </div>
              <p className="max-w-prose break-words text-xs text-muted-foreground">
                审计记录一条条带着自己的摘要，并且各自指向前一条。时间窗校验会沿着这条链逐项比对：
                接不上、缺失或被改动过的位置都算作问题。这里只报服务实际核对到的范围，没核对的不会写成已通过。
              </p>
              <p className="max-w-prose break-words text-xs text-muted-foreground">
                上面每一格的数字都带着它的范围：核对过多少、这个窗口一共多少、其中多少接不上。服务没有说的，这里写「—」。
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export default AuditVerifyModulePage;
