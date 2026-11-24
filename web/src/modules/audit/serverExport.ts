/**
 * AU-02 — the server-side export leg of the audit ledger (A5 create / A6 poll /
 * signed download), consumed by the browser exactly as the BFF ships it.
 *
 * Contract authorities (read off disk, never invented):
 *   A5  POST {BFF}/api/audit-export        body {from,to,filters?,limit?}
 *       — L0 板 2026-11-24 Q10 写门（主仓 apps/console/server.py
 *       RESOURCE_WRITE_ROUTES["/api/audit-export"]：Idempotency-Key 必填、
 *       体最小形制 from/to；域判定 ISO/90天窗/filters 白名单）。
 *       域成功码 200（异步 pending 语义，非 201）。
 *   A6  GET  {BFF}/api/audit-export?id=    → job_public 投影
 *       {exportId,status,createdAt,downloadUrl,expiresAt,truncated}
 *       （services/domain/audit_export.py:379-402，completed 才给签名 URL，
 *       pending/running/failed/已清理 → downloadUrl:null，键恒在）。
 *   download GET {BFF}/api/audit-export/<id>/download?expires=&sig=
 *       — Q10 路径形态透传；域返回 gzip FileResponse，BFF 逐字节转发。
 *   filters 白名单 {runId,taskId,actorId,resourceId,action}
 *       （audit_export.py:47-49）——本页只可能带 action/actorId/resourceId，
 *       映射自 ListFilters 的 action/actor/resource（api.ts aud8 注）。
 *
 * downloadUrl 是域内部路径（/v1/audit/exports/…），浏览器不可达（shell 只代理
 * /agent-api/api/…，channels.ts 头注同谱系）；本文件把它改写成 BFF 的 Q10
 * 路径形态，改写失败（形状不认识）返回 null——宁可不给下载，不猜一条链。
 */
import { ApiError } from "@/lib/api-error";
import type { ListFilters } from "./api";

export const SERVER_EXPORT_BASE = "/agent-api/api/audit-export";

/** A6 job_public 投影（键恒在，audit_export.py:379）。 */
export interface ExportJob {
  exportId: string;
  status: string;
  createdAt: string;
  downloadUrl: string | null;
  expiresAt: string | null;
  truncated: boolean;
}

/** 建单体（A5 契约形状）：时间窗缺一不建——草稿窗没有可发的 from/to。 */
export function exportBodyOf(
  filters: Pick<ListFilters, "from" | "to" | "action" | "actor" | "resource">,
): { from: string; to: string; filters: Record<string, string> } | null {
  if (!filters.from || !filters.to) return null;
  const picked: Record<string, string> = {};
  if (filters.action) picked.action = filters.action;
  if (filters.actor) picked.actorId = filters.actor;
  if (filters.resource) picked.resourceId = filters.resource;
  return { from: filters.from, to: filters.to, filters: picked };
}

let keySeq = 0;
/** 每次点单一把幂等键：重试沿用同一把（防双击=两次建单），收口后换新。 */
export function newIdempotencyKey(): string {
  const rnd =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `t${Date.now().toString(36)}-${(++keySeq).toString(36)}`;
  return `au02-${rnd}`;
}

export interface ExportFailureCopy {
  text: string;
  /** true=这一族值得引导回屏上快导/换窗，而不是干等重试。 */
  guide: boolean;
}

/** 错误族→人话。缺 code 的（网络断/裸 HTML）走兜底行，绝不裸抛英文。 */
export function exportFailCopyOf(err: unknown): ExportFailureCopy {
  const status = err instanceof ApiError ? err.status : 0;
  let code: string | null = null;
  if (err instanceof ApiError) {
    try {
      code = (JSON.parse(err.body) as { code?: string }).code ?? null;
    } catch {
      code = null;
    }
  }
  switch (code) {
    case "console.unauthenticated":
      return { text: "登录状态已失效，先重新登录再发起导出。", guide: false };
    case "console.forbidden":
    case "request.forbidden":
      return {
        text: "服务端导出需要管理员角色，当前账号没有被放行。这不是页面故障：引用下面的请求编号找管理员开通。",
        guide: true,
      };
    case "request.missing_idempotency_key":
    case "console.invalid_body":
      // 本页发得出键与 from/to；走到这里=拼装失守，如实报并留编号。
      return {
        text: "这一单没有被服务端接受（请求形制未过门）。没有创建任何导出作业；引用请求编号反馈本页。",
        guide: false,
      };
    case "audit.query_too_broad":
      return {
        text: "导出窗口超过服务端的 90 天上限：把时间窗收窄后再发起，或先翻完当前页用「导出当前筛选 CSV」。",
        guide: true,
      };
    case "audit.export_daily_limit":
      return {
        text: "今天的导出次数已经用完（服务端按天计）。等明天再发，或现在就用「导出当前筛选 CSV」把屏上这一份带走。",
        guide: true,
      };
    case "audit.export_unavailable":
      return {
        text: "本环境还没有开通服务端导出（服务缺配置）。屏上的「导出当前筛选 CSV」不受影响。",
        guide: true,
      };
    case "console.upstream_unavailable":
    case "upstream.unavailable":
      return { text: "导出服务此刻没有回答。稍后点「再查一次」；已创建的单不会被重复创建。", guide: false };
    default:
      break;
  }
  if (status === 0) {
    return { text: "请求没有到达导出服务（网络或本机通道问题）。屏上的「导出当前筛选 CSV」不受影响。", guide: true };
  }
  return { text: `导出请求没有得到答复（HTTP ${status}）。引用请求编号反馈。`, guide: false };
}

const DOMAIN_DOWNLOAD_RE = /^\/v1\/audit\/exports\/([^/?]+)\/download\?(.+)$/;

/** 域内部签名 URL → 浏览器可达的 BFF 路径形态（Q10 透传路由）。 */
export function browserDownloadHref(downloadUrl: string | null): string | null {
  if (!downloadUrl) return null;
  const m = DOMAIN_DOWNLOAD_RE.exec(downloadUrl);
  if (!m) return null;
  return `${SERVER_EXPORT_BASE}/${encodeURIComponent(m[1])}/download?${m[2]}`;
}

/** A6 状态 → 是否终态可下。running/pending 之外都停轮询。 */
export function jobTerminal(job: ExportJob): boolean {
  return job.status === "completed" || job.status === "failed";
}
