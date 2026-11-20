/**
 * T11 · 用量与成本（`#/overview?tab=usage`） — duty module, read-only.
 *
 * One real read, no mock layer:
 *   `GET /agent-api/api/hermes-usage?days=<1|7|30>`
 *
 * What is on the screen is what the answer carried, and nothing else:
 *   loading  a skeleton, not a card of zeros
 *   ready    tokens the usage source sent; money ONLY from the ledger block
 *   empty    the service answered for this window and had nothing, with a next step
 *   error    human wording + a copyable 请求编号 (「未提供」 when there was none) + retry
 *   denied   403 and 404 draw one identical body, with no row above it
 *
 * Money rules (enforced in `usage.ts`, pinned by tests):
 *  - a cost number reaches the screen only when the cost ledger sent it;
 *  - a true zero reads `$0.00`; a missing one reads 「—」 with its reason;
 *  - 「含估算」/「未计价」/非账本来源 are never presented as spent money;
 *  - nothing is re-priced, estimated or summed here, and no path uses `?? 0`.
 *
 * The 统计窗口 filter is real — picking 24h / 7d / 30d changes the `days`
 * parameter of the next request (asserted in usage.test.ts and the page test).
 * Raw ids, status tokens, ISO instants and HTTP codes live in `title` and the
 * collapsed 「技术详情」 only. `?state=` repro legs fetch nothing and carry
 * the GAP number they belong to (GAP-07) in on-screen copy; every control
 * on a repro leg is disabled with its reason, never a dead click.
 */
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Check, ChevronDown, ChevronUp, Copy, Gauge, Inbox, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";
import { copyTextToClipboard } from "@/lib/clipboard";

import { useUsageData } from "./useUsageData";
import {
  DEFAULT_USAGE_WINDOW,
  GAP,
  USAGE_WINDOWS,
  forcedStateOf,
  requestIdLine,
  windowLabel,
  usageUrl,
  type FailureCopy,
  type MoneyCell,
  type UsageWindowKey,
} from "./usage";
import { ConsoleSelect } from "@/shell/ConsoleSelect";

/** 请求编号's own honest word when the answer carried none. */
const NO_REQUEST_ID = "未提供";

/** Why the header/panel buttons sleep on a repro leg. */
const FORCED_TITLE = "复现腿不发起真实请求，去掉 ?state= 即为真实读取";

/** 「—」 with the reason in its `title`, so a gap reads as a gap. */
function Dashed({ reason }: { reason: string }): ReactNode {
  return (
    <span className="min-w-0 break-words text-muted-foreground" title={reason}>
      —
    </span>
  );
}

/** Token counts with separators; an absent count is 「—」 with a reason, never 0. */
function tokenText(value: number | null): ReactNode {
  if (value === null) return <Dashed reason="这个读数未随回答发送" />;
  return value.toLocaleString("en-US");
}

/**
 * One ledger amount. A real number (including a true 0) shows `$x.xx`;
 * anything else shows 「—」, with the reason beside it on cards and in the
 * cell's `title` inside tables.
 */
function MoneyText({ cell, testId, besideReason }: { cell: MoneyCell; testId: string; besideReason: boolean }): ReactNode {
  if (cell.text === "—") {
    return (
      <span
        className="min-w-0 break-words"
        data-testid={testId}
        title={[cell.reason, ...cell.technical].filter((line) => line).join("；") || undefined}
      >
        —
        {besideReason && cell.reason ? (
          <span className="ml-1 text-xs font-normal text-muted-foreground">{cell.reason}</span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="min-w-0 break-words tabular-nums" data-testid={testId} title={cell.technical[0] ?? undefined}>
      {cell.text}
    </span>
  );
}

// R31 fixture-debt burn: `?state=` repros carry no fixture attribute;
// the on-screen copy states they are a repro, not a service answer.

/** What a repro panel says so nobody reads it as a service answer. */
function ReproNote({ state }: { state: string }): ReactNode {
  return (
    <p className="min-w-0 break-words text-xs text-warning" data-testid="usg4-forced-note">
      {`这是用 ?state=${state} 复现出来的状态，不是服务此刻的回答；账本实扣数据尚未在本环境接通（${GAP}）。`}
    </p>
  );
}

function CopyValue({ value, reason, label, testId }: { value: string | null; reason: string; label: string; testId: string }): ReactNode {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  if (!value) {
    return (
      <span className="min-w-0 break-words text-white/60" data-testid={`${testId}-absent`} title={reason}>
        {NO_REQUEST_ID}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid={testId}>
      <span className="min-w-0 break-all font-mono text-xs text-white/80">{value}</span>
      <button
        type="button"
        aria-label={`复制${label}`}
        title="复制"
        className="inline-flex shrink-0 items-center gap-1 text-xs text-white/60 underline underline-offset-2"
        onClick={() => {
          void copyTextToClipboard(value).then((ok) => {
            setCopied(ok ? "done" : "failed");
            if (ok) window.setTimeout(() => setCopied("idle"), 2500);
          });
        }}
      >
        {copied === "done" ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
        {copied === "done" ? "已复制" : copied === "failed" ? "复制失败，请手动选择" : "复制"}
      </button>
    </span>
  );
}

function RequestIdLine({ requestId, testId }: { requestId: string | null; testId: string }): ReactNode {
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-white/55" data-testid={testId}>
      {requestId ? <span>请求编号：</span> : null}
      <CopyValue value={requestId} reason={requestIdLine(null)} label="请求编号" testId={`${testId}-value`} />
    </p>
  );
}

/** The only place engineering values reach the screen: collapsed, and closed means absent from the DOM. */
function TechnicalDisclosure({ lines, testId }: { lines: string[]; testId: string }): ReactNode {
  const [open, setOpen] = useState(false);
  const shown = lines.filter((line) => line);
  if (!shown.length) return null;
  return (
    <div className="min-w-0 text-xs" data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-white/50 underline underline-offset-2"
      >
        {open ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
        技术详情
      </button>
      {open ? (
        <ul className="mt-1 flex min-w-0 flex-col gap-0.5 break-words font-mono text-white/45">
          {shown.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function LoadingPanel(): ReactNode {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="usg4-loading" aria-busy="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="h-24 animate-pulse p-4" aria-hidden="true" />
        </Card>
      ))}
    </div>
  );
}

function EmptyPanel({
  onRetry,
  windowName,
  fixture,
}: {
  onRetry: () => void;
  windowName: string;
  fixture?: string;
}): ReactNode {
  return (
    <Card data-testid="usg4-empty">
      <CardContent className="flex min-w-0 flex-col items-start gap-2 p-6">
        <div className="flex min-w-0 items-center gap-2">
          <Inbox className="h-5 w-5 shrink-0 text-white/70" aria-hidden="true" />
          <h2 className="min-w-0 break-words text-base font-medium">这个窗口里没有用量记录</h2>
        </div>
        <p className="min-w-0 break-words text-sm text-white/60">
          用量服务对「{windowName}」回了一份数据，里面没有用量读数，也没有账本条目。
          这说明这段时间没有产生计费用的运行，不代表读取失败。
        </p>
        <p className="min-w-0 break-words text-xs text-white/45">下一步：换一个更长的统计窗口，或等运行产生用量后重新读取。</p>
        <Button
          size="sm"
          outlined
          onClick={onRetry}
          disabled={fixture !== undefined}
          title={fixture !== undefined ? FORCED_TITLE : undefined}
          prefix={<RefreshCw className="h-3.5 w-3.5" />}
          data-testid="usg4-empty-retry"
        >
          重新读取
        </Button>
      </CardContent>
    </Card>
  );
}

function ErrorPanel({
  failure,
  onRetry,
  fixture,
}: {
  failure: FailureCopy;
  onRetry: () => void;
  fixture?: string;
}): ReactNode {
  return (
    <Card role="alert" title={failure.technical ?? undefined} data-testid="usg4-error">
      <CardContent className="flex min-w-0 flex-col items-start gap-2 p-6">
        <div className="flex min-w-0 items-center gap-2 text-sm text-white/85">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">用量与成本没能加载出来</span>
        </div>
        <p className="min-w-0 break-words text-sm text-white/60">{failure.sentence}</p>
        <RequestIdLine requestId={failure.requestId} testId="usg4-error-request-id" />
        {failure.technical ? <TechnicalDisclosure lines={[failure.technical]} testId="usg4-error-details" /> : null}
        <Button
          size="sm"
          outlined
          onClick={onRetry}
          disabled={fixture !== undefined}
          title={fixture !== undefined ? FORCED_TITLE : undefined}
          prefix={<RefreshCw className="h-3.5 w-3.5" />}
          data-testid="usg4-retry"
        >
          重试
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * 403 and 404 both land here and read byte-for-byte the same: the pane takes
 * the request id only, so it cannot repeat anything the two answers differ on.
 * No data row is ever drawn above it.
 */
function DeniedPanel({ requestId }: { requestId: string | null }): ReactNode {
  return (
    <Card role="alert" aria-label="用量与成本不可见" data-testid="usg4-denied">
      <CardContent className="flex min-w-0 flex-col items-center gap-2 p-10 text-center">
        <ShieldAlert className="h-6 w-6 text-white/70" aria-hidden="true" />
        <p className="min-w-0 break-words text-sm">暂时看不到用量与成本</p>
        <p className="max-w-prose break-words text-xs text-white/55">
          这块内容要么尚未对你开放，要么当前环境还没有提供它。这里不会显示任何猜测的用量或金额，
          也不会把没读到的东西写成零。需要看到这份数据时，请联系工作区管理员开通用量查看权限，
          或确认后台已接入用量服务（{GAP}）；接通后本页自动显示真实数据。
        </p>
        <RequestIdLine requestId={requestId} testId="usg4-denied-request-id" />
      </CardContent>
    </Card>
  );
}

export function UsagePage() {
  const [params] = useSearchParams();
  const forced = forcedStateOf(params.get("state"));
  const [windowKey, setWindowKey] = useState<UsageWindowKey>(DEFAULT_USAGE_WINDOW);
  const { phase, read, failure, reload, forced: isForced } = useUsageData(forced, windowKey);
  const fixture = forced ?? undefined;

  const header = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <Gauge className="h-5 w-5 shrink-0 text-white/70" aria-hidden="true" />
      <h1 className="min-w-0 break-words font-mondwest text-xl">用量与成本</h1>
      <label className="flex min-w-0 flex-col gap-1 text-xs" htmlFor="usg4-window">
        <span className="text-white/50">统计窗口</span>
        <ConsoleSelect
          id="usg4-window"
          data-testid="usg4-window"
          className="h-8 min-w-0 max-w-40 rounded-md border border-white/15 bg-transparent px-2 text-sm"
          value={windowKey}
          disabled={isForced}
          title={isForced ? FORCED_TITLE : undefined}
          onChange={(next) => setWindowKey(next as UsageWindowKey)}
          options={USAGE_WINDOWS.map((item) => ({ value: item.key, label: item.label }))}
        />
      </label>
      <Button
        size="sm"
        outlined
        onClick={reload}
        disabled={phase === "loading" || isForced}
        title={isForced ? FORCED_TITLE : undefined}
        prefix={<RefreshCw className="h-3.5 w-3.5" />}
        data-testid="usg4-reload"
      >
        重新读取
      </Button>
    </div>
  );

  const readyView = (): ReactNode => {
    if (!read) return <LoadingPanel />;
    const cost = read.cost;

    return (
      <div className="min-w-0 space-y-4">
        <p className="min-w-0 break-words text-xs text-white/50" data-testid="usg4-meta">
          {`统计窗口：${windowLabel(windowKey)} · 金额只来自成本账本的实际扣费 · 数据截至 `}
          {read.asOf ? (
            <>
              <span className="tabular-nums" title={read.asOf.raw}>{read.asOf.shown}</span>（北京时间）
            </>
          ) : (
            <>
              <Dashed reason="用量服务未提供数据截至时刻" />
              <span className="text-white/40">（用量服务未提供数据截至时刻）</span>
            </>
          )}
        </p>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card data-testid="usg4-token-input">
            <CardContent className="min-w-0 p-4">
              <p className="text-xs text-white/50">输入 Token</p>
              <p className="mt-2 min-w-0 break-words text-2xl font-medium tabular-nums">{tokenText(read.tokens.input)}</p>
            </CardContent>
          </Card>
          <Card data-testid="usg4-token-output">
            <CardContent className="min-w-0 p-4">
              <p className="text-xs text-white/50">输出 Token</p>
              <p className="mt-2 min-w-0 break-words text-2xl font-medium tabular-nums">{tokenText(read.tokens.output)}</p>
            </CardContent>
          </Card>
          <Card data-testid="usg4-token-cache">
            <CardContent className="min-w-0 p-4">
              <p className="text-xs text-white/50">缓存读取</p>
              <p className="mt-2 min-w-0 break-words text-2xl font-medium tabular-nums">{tokenText(read.tokens.cacheRead)}</p>
            </CardContent>
          </Card>
          <Card data-testid="usg4-cost">
            <CardContent className="min-w-0 p-4">
              <p className="text-xs text-white/50">成本（账本实扣 · USD）</p>
              <p className="mt-2 min-w-0 break-words text-2xl font-medium">
                {cost ? (
                  <MoneyText cell={cost.cell} testId="usg4-cost-total" besideReason />
                ) : (
                  <span data-testid="usg4-cost-total">
                    <Dashed reason="用量服务这次没有回成本账本块" />
                  </span>
                )}
              </p>
              <p className="mt-1 min-w-0 break-words text-xs text-white/45">
                {cost ? (
                  <>
                    <span title={cost.source ?? undefined}>{cost.cell.statusLabel}</span>
                    {cost.entries !== null ? ` · ${cost.entries} 条账目` : " · 账目条数未提供"}
                  </>
                ) : (
                  "成本账本块未随这份回答提供"
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="usg4-model-table">
          <CardContent className="p-0">
            <div className="border-b border-white/10 px-4 py-3">
              <h2 className="min-w-0 break-words text-sm font-medium">按模型</h2>
              <p className="mt-1 min-w-0 break-words text-xs text-white/45">
                {read.models.length > 0
                  ? "用量源上报的模型明细；缺失字段显示 —，不补零。"
                  : "这个窗口没有可读的模型明细（用量源降级或未随回答发送）。"}
              </p>
            </div>
            {read.models.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] text-left text-sm">
                  <thead>
                    <tr className="text-xs text-white/45">
                      <th className="px-4 py-2 font-normal">模型</th>
                      <th className="px-4 py-2 font-normal">输入 Token</th>
                      <th className="px-4 py-2 font-normal">输出 Token</th>
                    </tr>
                  </thead>
                  <tbody>
                    {read.models.map((row, index) => (
                      <tr key={`${row.name}-${index}`} className="border-t border-white/10">
                        <td className="max-w-[240px] break-words px-4 py-2">{row.name}</td>
                        <td className="px-4 py-2 tabular-nums">{tokenText(row.input)}</td>
                        <td className="px-4 py-2 tabular-nums">{tokenText(row.output)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {read.unreadableModels > 0 ? (
              <p className="min-w-0 break-words px-4 py-2 text-xs text-white/45">
                另有 {read.unreadableModels} 行明细读不出是哪个模型，没有列在这里。
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card data-testid="usg4-ledger">
          <CardContent className="p-0">
            <div className="border-b border-white/10 px-4 py-3">
              <h2 className="min-w-0 break-words text-sm font-medium">账本明细</h2>
              <p className="mt-1 min-w-0 break-words text-xs text-white/45">
                金额来自成本账本的实际扣费，按员工汇总；不反推、不估算、不在前端求和。缺金额的单元格显示 —，原因写在格子上。
              </p>
            </div>
            {cost && cost.rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="text-xs text-white/45">
                      <th className="px-4 py-2 font-normal">员工</th>
                      <th className="px-4 py-2 font-normal">账目条数</th>
                      <th className="px-4 py-2 font-normal">金额（USD）</th>
                      <th className="px-4 py-2 font-normal">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cost.rows.map((row, index) => (
                      <tr key={`${row.rawId}-${index}`} className="border-t border-white/10">
                        <td className="min-w-0 break-words px-4 py-2" title={row.rawId ?? undefined}>{row.code}</td>
                        <td className="px-4 py-2 tabular-nums">{row.entries === null ? <Dashed reason="账目条数未随回答发送" /> : row.entries.toLocaleString("en-US")}</td>
                        <td className="px-4 py-2 font-medium">
                          <MoneyText cell={row.cell} testId={`usg4-ledger-money-${index}`} besideReason={false} />
                        </td>
                        <td className="px-4 py-2">
                          <Badge tone={row.cell.statusLabel === "账本实测" ? undefined : "warning"}>{row.cell.statusLabel}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {cost.rows.some((row) => row.cell.text === "—") ? (
                  <p className="min-w-0 break-words px-4 py-2 text-xs text-white/45">
                    金额显示为 — 的行，账本没有给出可呈现的实扣数；把光标停在 — 上可以看到原因。
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="min-w-0 break-words px-4 py-4 text-sm text-white/55">
                {cost && cost.unreadableRows > 0
                  ? `账本回了 ${cost.unreadableRows} 条读不出归属的条目，这里一条也不画。`
                  : cost
                    ? "账本块这次没有回明细行；总额仍按上方口径呈现，缺失不写成 0.00。"
                    : "用量服务这次没有回成本账本块，账本明细无法呈现；这里不补任何示例数字。"}
              </p>
            )}
            {cost && cost.rows.length > 0 && cost.unreadableRows > 0 ? (
              <p className="min-w-0 break-words px-4 py-2 text-xs text-white/45">
                另有 {cost.unreadableRows} 条账目读不出是哪个员工的，没有列在这里。
              </p>
            ) : null}
          </CardContent>
        </Card>

        <TechnicalDisclosure
          testId="usg4-details"
          lines={[
            `请求窗口：${usageUrl(windowKey)}`,
            read.windowDays !== null ? `回答窗口原值：period_days=${read.windowDays}` : "",
            ...(cost?.cell.technical ?? []),
            read.asOf ? `截至时刻原值：${read.asOf.raw}` : "",
          ]}
        />
      </div>
    );
  };

  const body = (): ReactNode => {
    if (phase === "loading") return <LoadingPanel />;
    if (phase === "denied") return <DeniedPanel requestId={failure?.requestId ?? null} />;
    if (phase === "error" && failure) return <ErrorPanel failure={failure} onRetry={reload} fixture={fixture} />;
    if (phase === "empty") return <EmptyPanel onRetry={reload} windowName={windowLabel(windowKey)} fixture={fixture} />;
    return readyView();
  };

  return (
    <div className="min-w-0 space-y-4 p-4 md:p-6" data-testid="usg4-page">
      {header}
      {forced ? <ReproNote state={forced} /> : null}
      {body()}
    </div>
  );
}

export default UsagePage;
