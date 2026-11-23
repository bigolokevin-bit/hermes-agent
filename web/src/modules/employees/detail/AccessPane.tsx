import { useEffect, useState } from "react";
import { BookOpen, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@nous-research/ui/ui/components/card";

import { fetchJSON } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

import {
  EmptyBlock,
  ErrorStateBlock,
  RowsSkeleton,
  beijing,
  countDash,
  isRecord,
  requestIdOf,
  errStatus,
  humanize,
  type Rec,
} from "@/pages/EmployeesPage";

/**
 * 权限分区（PE-03 五分区之三）：读 /agent-api/api/effective-config?id=<enc>，
 * 投影 grants[]（scopeType / 资源选择器 / actions / source / expiresAt）、
 * version.knowledgeScopes（若有）与数据时刻 resolvedAt。
 *
 * 语义分流（按域契约与现网实测）：
 *  - 200 + grants[] → ready；200 + 空 grants → 合法空态；
 *  - 409 employee.no_effective_version → 真实状态文案「尚无生效版本」，
 *    不是错误爆炸（无 role=alert、无 destructive 样式）；
 *  - 其它失败 → 错误态 + 原因 + 请求号 + 重试；
 *  - `at=` 历史时刻回看暂不做 → 标注「未接入」腿，不是错误也不是空态。
 *
 * 有效期口径：无永久授权、缺省 90 天、break_glass ≤24h —— 页面上永不出现
 * 「永久」二字；expiresAt 缺失显示「—」，有值显示到期时间原文。
 * 行数纪律：屏上权限行数恒等于 payload grants 数（护栏不一致宁可不显示）。
 */

const NOT_WIRED_GAP_ID = "GAP-PE-03";

/** 该腿的四个终态：noversion 是真实状态，不归并进 error，也不归并进 empty。 */
type AccessState =
  | { k: "loading" }
  | { k: "ready"; body: Rec }
  | { k: "noversion" }
  | { k: "error"; status: number; message: string; requestId: string | null };

/** 现网实测：409 + {"code":"employee.no_effective_version","message":…}。 */
function isNoEffectiveVersion(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 409) return false;
  try {
    const parsed: unknown = JSON.parse(err.body);
    return isRecord(parsed) && parsed.code === "employee.no_effective_version";
  } catch {
    return false;
  }
}

export default function AccessPane({ rawId, enc }: { rawId: string; enc: string }) {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<AccessState>({ k: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ k: "loading" });
    fetchJSON<unknown>(`/agent-api/api/effective-config?id=${enc}`)
      .then((raw) => {
        if (!alive) return;
        setState({ k: "ready", body: isRecord(raw) ? raw : {} });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        if (isNoEffectiveVersion(err)) {
          setState({ k: "noversion" });
          return;
        }
        setState({ k: "error", status: errStatus(err), message: humanize(err), requestId: requestIdOf(err) });
      });
    return () => {
      alive = false;
    };
  }, [enc, nonce]);

  const body = state.k === "ready" ? state.body : null;
  const grants = body ? asGrants(body.grants) : [];
  // 防串护栏（沿用 PE-02 口径）：信封 employee.id 与行内 grants[].employeeId
  // 只要带上就必须属于该员工，对不上整块拒显；带不上归属键的行同样不放行。
  const envelopeOwner = body ? strOf(isRecord(body.employee) ? (body.employee as Rec).id : null) : null;
  const foreign =
    body !== null &&
    ((envelopeOwner !== null && envelopeOwner !== rawId) ||
      grants.some((g) => strOf(g.employeeId) !== rawId));

  return (
    <div className="flex flex-col gap-3" data-testid="emp-detail-zone-access">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            生效权限
            {body !== null && !foreign && (
              // 「共N条」只从 payload grants 计数来；串数据拒显时不报数。
              <span className="ml-2 text-xs font-normal text-muted-foreground" data-testid="emp-access-count">
                共{grants.length}条
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
              deniedTitle="无法打开权限数据"
              errorTitle="权限数据加载失败"
              onRetry={() => setNonce((n) => n + 1)}
            />
          )}

          {state.k === "noversion" && (
            // 真实状态，非错误：不摆 destructive 样式、不带重试告警语义。
            <p className="text-sm text-muted-foreground" data-testid="emp-access-no-effective-version">
              该员工尚无生效版本，暂无生效权限可显示。版本生效此处会自动带出授权列表。
            </p>
          )}

          {state.k === "ready" &&
            (foreign ? (
              <p className="text-sm text-destructive" data-testid="emp-access-mismatch" role="alert">
                返回授权不属于该员工，已停止显示以防串数据。
              </p>
            ) : grants.length === 0 ? (
              <EmptyBlock text="该员工暂无生效授权" hint="生效配置响应正常，但没有返回任何授权。" />
            ) : (
              <>
                <ul className="flex flex-col gap-2">
                  {grants.map((g, i) => (
                    <li key={strOf(g.id) ?? `grant-${i}`} data-testid="emp-access-grant-row">
                      <GrantRow grant={g} />
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  有效期口径：授权均设到期时间（缺省 90 天，break_glass ≤24 小时）；payload 未给 expiresAt 时显示「—」。
                </p>
              </>
            ))}

          {body !== null && !foreign && grants.length > 0 && (
            <ResolvedAtStamp resolvedAt={strOf(body.resolvedAt)} />
          )}
        </CardContent>
      </Card>

      {body !== null && !foreign && <KnowledgeScopesCard body={body} />}

      <AtLookbackCard />
    </div>
  );
}

// ── 授权行 ───────────────────────────────────────────────────────────────

function asGrants(v: unknown): Rec[] {
  return Array.isArray(v) ? v.filter(isRecord) : [];
}

function strOf(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : null;
}

/** 资源选择器投影：{types:[…]} 或 {type:…} 或任意标量键值，照 payload 摊平。 */
function selectorText(sel: unknown): string {
  if (!isRecord(sel)) return strOf(sel) ?? "—";
  const parts = Object.entries(sel).map(([k, v]) => {
    if (Array.isArray(v)) return `${k}=${v.filter((x) => typeof x === "string" || typeof x === "number").join("、") || "—"}`;
    return `${k}=${strOf(v) ?? "—"}`;
  });
  return parts.length > 0 ? parts.join("，") : "—";
}

function GrantRow({ grant }: { grant: Rec }) {
  const actions = Array.isArray(grant.actions)
    ? (grant.actions as unknown[]).filter((a): a is string => typeof a === "string" && a.trim() !== "")
    : [];
  const expires = strOf(grant.expiresAt);

  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate font-medium" title={strOf(grant.id) ?? undefined}>
            范围：{strOf(grant.scopeType) ?? "—"}
          </span>
          {/* 到期口径：expiresAt 缺失显示「—」，永不写「永久」。 */}
          <span className="shrink-0 text-xs text-muted-foreground" data-testid="emp-access-grant-expiry">
            {expires ? `到期 ${beijing(expires)}` : "—"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>资源：{selectorText(grant.resourceSelector)}</span>
          <span>动作：{actions.length > 0 ? actions.join("、") : "—"}</span>
          <span>来源：{strOf(grant.source) ?? "—"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ResolvedAtStamp({ resolvedAt }: { resolvedAt: string | null }) {
  return (
    <p className="mt-2 text-xs text-muted-foreground" data-testid="emp-access-resolved-at">
      数据时刻：{resolvedAt ? beijing(resolvedAt) : "—"}
    </p>
  );
}

// ── 知识域（version.knowledgeScopes，若有则列） ─────────────────────────

function KnowledgeScopesCard({ body }: { body: Rec }) {
  const version = isRecord(body.version) ? (body.version as Rec) : null;
  const scopes = version && Array.isArray(version.knowledgeScopes)
    ? (version.knowledgeScopes as unknown[]).filter((s): s is string => typeof s === "string" && s.trim() !== "")
    : null;
  if (!scopes || scopes.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          知识域
          <span className="ml-1 text-xs font-normal text-muted-foreground">{countDash(scopes.length)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-wrap gap-2">
          {scopes.map((s) => (
            <li key={s} className="rounded-md border border-border/60 bg-muted/10 px-2 py-1 text-xs">
              {s}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ── at= 历史回看：未接入腿 ───────────────────────────────────────────────

function AtLookbackCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          <span title={`${NOT_WIRED_GAP_ID}：at= 历史时刻回看暂未实现`}>历史时刻回看（at=）</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground" data-testid="emp-access-at-not-wired">
          未接入（{NOT_WIRED_GAP_ID}）：按历史时刻回看生效配置暂未实现，本区只反映当前生效状态。
        </p>
      </CardContent>
    </Card>
  );
}
