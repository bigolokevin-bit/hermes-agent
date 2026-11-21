/**
 * 人员目录 — `/identity?tab=people` 只读面 (ppl5-*).
 *
 * The BFF exposes no user-center list route: those candidates answer 404
 * console.unknown_route. The page falls back to the real digital-employee
 * ledger at `/api/employees`, labels that source on screen, and renders one
 * neutral 未接入 body for 403 and 404 when both are unavailable, with GAP-02
 * only in `title`; it never fabricates a row or a 0. Missing fields are `—`
 * with a reason, status words never expose codes, and raw ids stay in `title`.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Inbox, RefreshCw, ShieldAlert, TriangleAlert, Users } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";

import { fetchJSON } from "@/lib/api";
import "./people.css";
import { API_UNREACHABLE_MESSAGE, ApiError, humanizeStatus } from "@/lib/api-error";

type Rec = Record<string, unknown>;

type Resource<T> =
  | { phase: "loading" }
  | { phase: "empty" }
  | { phase: "ready"; data: T }
  | { phase: "unavailable"; message: string }
  | { phase: "denied"; message: string }
  | { phase: "error"; message: string; requestId: string | null };

export const PEOPLE_GAP = "GAP-02";
export const PEOPLE_GAP_MESSAGE =
  "人员目录未接入：上游用户中心接口尚未对控制台开放。接入后这里显示真实名单；现在不展示样例，也不把缺失值写成 0。";

export const PEOPLE_ENDPOINTS = [
  "/agent-api/api/v1/user/list",
  "/agent-api/api/v1/user/all",
  "/agent-api/api/employees?limit=20",
];

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function itemsOf(body: unknown): Rec[] {
  if (Array.isArray(body)) return body.filter(isRecord);
  if (isRecord(body)) {
    if (Array.isArray(body.items)) return body.items.filter(isRecord);
    if (Array.isArray(body.data)) return body.data.filter(isRecord);
    if (isRecord(body.data) && Array.isArray(body.data.items)) return body.data.items.filter(isRecord);
  }
  return [];
}

/** ISO time or epoch seconds → 北京时间到分 (YYYY-MM-DD HH:mm, UTC+8). */
function beijing(value: unknown): string | null {
  let date: Date | null = null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    date = new Date(value < 1e12 ? value * 1000 : value);
  } else if (typeof value === "string" && value.trim()) {
    date = new Date(value);
  }
  if (!date || Number.isNaN(date.getTime())) return null;
  const t = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

function rawId(row: Rec): string {
  const id = row.user_id ?? row.userId ?? row.employeeId ?? row.employee_id ?? row.id;
  return typeof id === "string" && id.trim() ? id.trim() : typeof id === "number" ? String(id) : "";
}

/** Last 8 alphanumerics; missing id is 未指派, never a fabricated code. */
function shortCode(row: Rec): string {
  const id = rawId(row).replace(/^[^:]*:/, "").replace(/[^0-9A-Za-z]/g, "");
  return id ? id.slice(-8).toUpperCase() : "未指派";
}

function statusLabel(row: Rec): { text: string; tone: "success" | "warning" | "destructive" | undefined } {
  const s = row.lifecycleState ?? row.lifecycle_state ?? row.status ?? row.state ?? row.is_active ?? row.enabled;
  if (typeof s === "number") {
    if (s === 1) return { text: "已启用", tone: "success" };
    if (s === 0) return { text: "已停用", tone: "destructive" };
    if (s === 2) return { text: "已删除", tone: "destructive" };
    if (s === 3) return { text: "待审核", tone: "warning" };
    return { text: "待核实", tone: undefined };
  }
  if (typeof s === "boolean") return { text: s ? "已启用" : "已停用", tone: s ? "success" : "destructive" };
  const word = (typeof s === "string" ? s : "").toLowerCase();
  if (word === "active" || word === "enabled" || word === "true") return { text: "在岗", tone: "success" };
  if (word === "disabled" || word === "inactive" || word === "false") return { text: "已停用", tone: "destructive" };
  if (word === "draft") return { text: "草稿", tone: "warning" };
  if (word === "paused") return { text: "暂停", tone: "warning" };
  if (word === "offboarding") return { text: "离职中", tone: "warning" };
  if (word === "archived") return { text: "已归档", tone: "destructive" };
  if (word === "pending") return { text: "待审核", tone: "warning" };
  return { text: "待核实", tone: undefined };
}

interface PersonRow {
  key: string;
  name: string;
  code: string;
  account: string | null;
  dept: string | null;
  status: { text: string; tone: "success" | "warning" | "destructive" | undefined };
  lastActive: string | null;
  lastActiveReason: string | null;
  rawId: string;
}

function readPerson(row: Rec, index: number): PersonRow {
  const account = pickString(row.user_name, row.username, row.account);
  const name = pickString(row.realname, row.name, row.nick_name) ?? account ?? "待核实";
  const lastRaw = row.last_login ?? row.lastLogin ?? row.last_active ?? row.lastActive;
  const updatedRaw = row.update_time ?? row.updatedAt ?? row.updated_at;
  const lastActive = beijing(lastRaw);
  const updated = beijing(updatedRaw);
  const lastActiveReason = lastActive
    ? null
    : lastRaw
      ? "最后活跃时间无法解析"
      : updated
        ? `上游未提供最后活跃时间（最后更新 ${updated}）`
        : "上游未提供最后活跃时间";
  return {
    key: rawId(row) || `row-${index}`,
    name,
    code: shortCode(row),
    account,
    dept: pickString(row.dept_name, row.deptName, row.department, row.dept),
    status: statusLabel(row),
    lastActive,
    lastActiveReason,
    rawId: rawId(row),
  };
}

async function loadPeople(): Promise<Resource<Rec[]>> {
  let unavailable = false;
  let firstError: ApiError | null = null;
  for (const url of PEOPLE_ENDPOINTS) {
    try {
      const body = await fetchJSON<unknown>(url);
      return { phase: "ready", data: itemsOf(body) };
    } catch (err: unknown) {
      const api = err instanceof ApiError ? err : null;
      if (api && (api.status === 403 || api.status === 404)) unavailable = true;
      else if (api && api.status !== 404 && !firstError) firstError = api;
    }
  }
  if (unavailable) return { phase: "unavailable", message: PEOPLE_GAP_MESSAGE };
  if (firstError) {
    return {
      phase: "error",
      message:
        firstError.status && firstError.status >= 500
          ? API_UNREACHABLE_MESSAGE
          : firstError.message || humanizeStatus(firstError.status),
      requestId: firstError.requestId ?? null,
    };
  }
  return { phase: "unavailable", message: PEOPLE_GAP_MESSAGE };
}

type Forced = "loading" | "empty" | "error" | "ready";

function readForced(raw: string | null): Forced | null {
  return raw === "loading" || raw === "empty" || raw === "error" || raw === "ready" ? raw : null;
}

function previewResource(forced: Exclude<Forced, "ready">): Resource<Rec[]> {
  if (forced === "loading") return { phase: "loading" };
  if (forced === "empty") return { phase: "empty" };
  return { phase: "error", message: "预览错误：这次读取没有成功，页面没有编造人员数据。", requestId: null };
}

function usePeople(nonce: number, enabled: boolean): Resource<Rec[]> {
  const [resource, setResource] = useState<Resource<Rec[]>>({ phase: "loading" });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setResource({ phase: "loading" });
    void loadPeople().then((r) => {
      if (!cancelled) setResource(r);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, nonce]);
  return resource;
}

function RequestId({ id }: { id: string | null }): ReactNode {
  const [copied, setCopied] = useState(false);
  return (
    <span className="ppl5-req" data-testid="ppl5-request-id">
      请求编号 {id ?? "未提供"}
      {id ? (
        <button
          type="button"
          aria-label="复制请求编号"
          data-testid="ppl5-request-id-copy"
          onClick={() => {
            void navigator.clipboard?.writeText(id).then(
              () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              },
              () => setCopied(false),
            );
          }}
        >
          {copied ? "已复制" : "复制"}
        </button>
      ) : null}
    </span>
  );
}

function StateShell({
  testid,
  icon,
  title,
  body,
  gapTitle,
  onRetry,
  details,
  children,
}: {
  testid: string;
  icon: ReactNode;
  title: string;
  body?: string;
  gapTitle?: string;
  onRetry?: () => void;
  details?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section data-testid={testid} className="ppl5-state" title={gapTitle}>
      <div className="ppl5-state-head">
        {icon}
        <span>{title}</span>
      </div>
      {body ? <p className="ppl5-state-body">{body}</p> : null}
      {children}
      {/* UI-B 错误态组合：技术信息（尝试过的读取端点）折叠进「详情」，人话句保持
        * 可见；互斥=phase 单值 if 链（错误在场时空态锚不渲染）、rid 可见可复制
        * （RequestId 带复制钮）均既有达标，本笔以截图实测复核。 */}
      {details ? (
        <details className="ppl5-state-details" data-testid="ppl5-error-details">
          <summary>详情</summary>
          {details}
        </details>
      ) : null}
      {onRetry ? (
        // UI-B 状态组合：StateShell 的卡内动作抬起为唯一实心主操作（去 outlined），
        // 页头 ppl5-refresh 保持描边次级，同屏不出现双实心。
        <Button size="sm" onClick={onRetry} data-testid="ppl5-retry">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          重试
        </Button>
      ) : null}
    </section>
  );
}

export default function PeopleModulePage() {
  const [sp] = useSearchParams();
  const forced = readForced(sp.get("state"));
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const live = usePeople(reload, forced === null || forced === "ready");
  const people = forced && forced !== "ready" ? previewResource(forced) : live;

  const rows = useMemo<PersonRow[]>(() => {
    if (people.phase !== "ready") return [];
    const q = query.trim().toLowerCase();
    return people.data
      .map(readPerson)
      .filter(
        (r) =>
          q === "" ||
          r.name.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          (r.account ?? "").toLowerCase().includes(q) ||
          (r.dept ?? "").toLowerCase().includes(q),
      );
  }, [people, query]);

  return (
    <section className="ppl5-page flex min-w-0 flex-col gap-4" data-testid="ppl5-page">
      <header className="ppl5-head">
        <div className="min-w-0">
          <h1 className="font-mondwest text-xl text-white/90">人员目录</h1>
          <p className="mt-1 text-xs text-white/40">
            在册人员名录 · 姓名 / 账号 / 部门 / 状态 / 最后活跃
            {people.phase === "ready" ? ` · 共 ${people.data.length} 人` : ""}
          </p>
          {people.phase === "ready" && people.data.length > 0 ? (
            <p className="mt-1 text-xs text-white/40" data-testid="ppl5-source">
              {people.data.some((row) => "employeeId" in row)
                ? "来源：数字员工台账；真人用户中心接口尚未接入，这里不冒充真人名单。"
                : "来源：用户中心人员台账。"}
            </p>
          ) : null}
        </div>
        <div className="ppl5-actions">
          <input
            data-testid="ppl5-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索姓名、短码、账号或部门"
            className="h-8 min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-3 text-xs text-white/80 outline-none placeholder:text-white/25 sm:w-44 sm:flex-none"
          />
          <Button size="sm" outlined onClick={() => setReload((n) => n + 1)} data-testid="ppl5-refresh">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            刷新
          </Button>
        </div>
      </header>

      {people.phase === "loading" ? (
        <section data-testid="ppl5-loading" className="flex flex-col gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-4" aria-label="正在加载人员目录">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-white/5" />
          ))}
        </section>
      ) : null}

      {people.phase === "unavailable" || people.phase === "denied" ? (
        <StateShell
          testid="ppl5-unwired"
          icon={<ShieldAlert className="h-4 w-4 text-amber-300/80" aria-hidden />}
          title="人员目录未接入"
          body={people.message}
          gapTitle={PEOPLE_GAP}
          onRetry={() => setReload((n) => n + 1)}
        >
          <Link to="/approvals" data-testid="ppl5-apply" className="text-xs underline underline-offset-4">
            去审批中心提交开通申请
          </Link>
        </StateShell>
      ) : null}

      {people.phase === "error" ? (
        <StateShell
          testid="ppl5-error"
          icon={<TriangleAlert className="h-4 w-4 text-rose-300/80" aria-hidden />}
          title="没能加载出人员目录"
          body={people.message}
          onRetry={() => setReload((n) => n + 1)}
          details={
            <p className="ppl5-state-details-body">
              这次读取依次尝试过：{PEOPLE_ENDPOINTS.join(" ")}；都失败才落到这个提示。
            </p>
          }
        >
          <RequestId id={people.requestId} />
        </StateShell>
      ) : null}

      {people.phase === "empty" ? (
        <StateShell
          testid="ppl5-empty"
          icon={<Inbox className="h-4 w-4 text-white/30" aria-hidden />}
          title="目录暂时是空的"
          body="后台还没有登记在册人员；不显示 0 人，也不展示样例。接入完成后这里会自动出现名单。"
          onRetry={() => setReload((n) => n + 1)}
        />
      ) : null}

      {people.phase === "ready" ? (
        people.data.length === 0 ? (
          <StateShell
            testid="ppl5-empty"
            icon={<Inbox className="h-4 w-4 text-white/30" aria-hidden />}
            title="目录暂时是空的"
            body="后台还没有登记在册人员；不显示 0 人，也不展示样例。"
            onRetry={() => setReload((n) => n + 1)}
          />
        ) : rows.length === 0 ? (
          // UI-B 空态组合：筛空腿的根因是搜索词，单一主操作=清空搜索（新锚
          // ppl5-nomatch-clear，既有 testid 0 改名）；文案原样保留。
          <StateShell
            testid="ppl5-nomatch"
            icon={<Inbox className="h-4 w-4 text-white/30" aria-hidden />}
            title={`没有匹配「${query.trim()}」的人员`}
            body="换个关键词试试；清空搜索可看全部名单。"
          >
            <Button size="sm" onClick={() => setQuery("")} data-testid="ppl5-nomatch-clear">
              清空搜索
            </Button>
          </StateShell>
        ) : (
          <Card className="border-white/5 bg-white/[0.02]">
            <CardContent className="p-0" data-testid="ppl5-list">
              <div className="ppl5-grid ppl5-thead">
                <span>姓名</span><span>账号</span><span>部门</span><span>状态</span><span>最后活跃</span>
              </div>
              <ul className="divide-y divide-white/5">
                {rows.map((r) => (
                  <li key={r.key} className="ppl5-grid ppl5-row" data-testid="ppl5-row" title={r.rawId ? `记录号 ${r.rawId}` : undefined}>
                    <span className="flex min-w-0 items-center gap-2 text-sm text-white/85">
                      <Users className="h-3.5 w-3.5 shrink-0 text-white/25" aria-hidden />
                      <span className="min-w-0 break-words" data-label="姓名" data-testid="ppl5-name">
                        {r.name}{r.code !== "未指派" ? ` · ${r.code}` : ""}
                      </span>
                    </span>
                    <span className="min-w-0 break-all text-xs text-white/55 md:text-sm md:text-white/60" data-label="账号" data-testid="ppl5-account">
                      {r.account ?? "—"}
                      {r.account ? null : <span className="ppl5-reason">上游未提供账号</span>}
                    </span>
                    <span className="min-w-0 break-words text-xs text-white/55 md:text-sm md:text-white/60" data-label="部门" data-testid="ppl5-dept">
                      {r.dept ?? "—"}
                      {r.dept ? null : <span className="ppl5-reason">上游未提供部门</span>}
                    </span>
                    <span data-label="状态" data-testid="ppl5-status"><Badge tone={r.status.tone}>{r.status.text}</Badge></span>
                    <span className="min-w-0 break-words text-xs text-white/55 md:text-sm md:text-white/60" data-label="最后活跃" data-testid="ppl5-last-active">
                      {r.lastActive ?? "—"}
                      {r.lastActiveReason ? <span className="ppl5-reason">{r.lastActiveReason}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      ) : null}
    </section>
  );
}
