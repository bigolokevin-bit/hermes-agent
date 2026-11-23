/**
 * 人员目录 — `/identity?tab=people` 只读面 (ppl5-*).
 *
 * The BFF exposes no user-center list route: those candidates answer 404
 * console.unknown_route. The page falls back to the real digital-employee
 * ledger at `/api/employees`, labels that source on screen, and renders one
 * neutral 未接入 body for 403 and 404 when both are unavailable, with GAP-02
 * only in `title`; it never fabricates a row or a 0. Columns the source
 * carries no values for are dropped entirely (buglist P0-4); an individual
 * missing value is `—` with the reason in `title`, status words never expose
 * codes, and raw ids stay in `title`.
 *
 * Q12: each roster row carries a `ppl5d-open-<id>` control that swaps in the
 * in-page five-tab detail view (`EmployeeDetailPanel`, zero routing); 返回名册
 * restores this list without refetching it.
 *
 * PE-07: `?state=loading|empty|error|denied` forces honest preview legs without
 * any fetch. 未接入 (GAP-02) and 无权限 are two exclusive legs: the denied
 * screen never says 「未接入」, the unwired screen never says 「无权限」 — the
 * denied body copies the benchmark sentence from `EmployeesPage.tsx`
 * (ErrorStateBlock, L625-655).
 *
 * PE-10: search is a SERVER-side chain — 300ms debounce, then
 * `?limit=20&keyword=<term>` against the resolved source, paging by the
 * server's own `nextCursor` (never a locally filtered slice of the first 20
 * rows, which is what hid everyone ranked 21+). A keyword reset supersedes an
 * in-flight cursor page, so one debounce window fires at most one request and
 * two cursors never run side by side. Empty results distinguish three causes:
 * 未接入 (no source answers) / 检索空 (server found nothing for the keyword) /
 * 真为空 (the ledger itself has no rows).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { Inbox, RefreshCw, ShieldAlert, TriangleAlert, Users } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";

import { fetchJSON } from "@/lib/api";
import "./people.css";
import { API_UNREACHABLE_MESSAGE, ApiError, humanizeStatus } from "@/lib/api-error";
import EmployeeDetailPanel from "./EmployeeDetailPanel";

type Rec = Record<string, unknown>;

export const PEOPLE_GAP = "GAP-02";
export const PEOPLE_GAP_MESSAGE =
  "人员目录未接入：上游用户中心接口尚未对控制台开放。接入后这里显示真实名单；现在不展示样例，也不把缺失值写成 0。";

/**
 * denied 腿话术：逐字抄 EmployeesPage.tsx ErrorStateBlock 的 403/404 整页标杆
 * （L625-655「无权限或未开放」口径）。屏上不出现「未接入」，与 GAP-02 未接入
 * 腿互斥。
 */
export const PEOPLE_DENIED_MESSAGE =
  "该数据源尚未开放，或你没有查看权限。请确认后台已接入对应服务，或联系管理员开通权限。";

export const PEOPLE_ENDPOINTS = [
  "/agent-api/api/v1/user/list",
  "/agent-api/api/v1/user/all",
  "/agent-api/api/employees",
];

/** PE-10: 每页条数与 BFF 白名单上限对齐（服务端按 keyword 真过滤，本地不再切片）。 */
export const PEOPLE_LIMIT = 20;

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

function cursorOf(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const raw = body.nextCursor ?? body.next_cursor;
  return typeof raw === "string" && raw.trim() ? raw : null;
}

/** PE-10: 一页请求 = limit + 服务端 keyword（非空才带）+ 续页游标（有则带）。 */
function pageUrl(base: string, keyword: string, cursor: string | null): string {
  const query = new URLSearchParams();
  query.set("limit", String(PEOPLE_LIMIT));
  if (keyword) query.set("keyword", keyword);
  if (cursor) query.set("cursor", cursor);
  return `${base}?${query.toString()}`;
}

type RosterPhase = "loading" | "ready" | "empty" | "unavailable" | "denied" | "error";

/** 数据源列形制（P0-4）：整列皆缺的可选列连表头一起裁掉。 */
type SourceShape = {
  employeeLedger: boolean;
  account: boolean;
  dept: boolean;
  lastActive: boolean;
};

type Roster = {
  phase: RosterPhase;
  items: Rec[];
  nextCursor: string | null;
  message: string;
  requestId: string | null;
  /** 续页请求在途（加载更多钮禁用中）。 */
  loadingMore: boolean;
  /** 列形制取自未过滤的在册首页；检索子集不得让它闪变（PE-10 ①）。 */
  shape: SourceShape | null;
};

const ROSTER_LOADING: Roster = {
  phase: "loading",
  items: [],
  nextCursor: null,
  message: "",
  requestId: null,
  loadingMore: false,
  shape: null,
};

function shapeOf(rows: Rec[]): SourceShape {
  const read = rows.map(readPerson);
  return {
    employeeLedger: rows.some((row) => "employeeId" in row),
    account: read.some((r) => r.account !== null),
    dept: read.some((r) => r.dept !== null),
    lastActive: read.some((r) => r.lastActive !== null),
  };
}

function readPage(body: unknown): { items: Rec[]; nextCursor: string | null } {
  return { items: itemsOf(body), nextCursor: cursorOf(body) };
}

function errorFrom(err: unknown): ApiError | null {
  return err instanceof ApiError ? err : null;
}

function errorCopy(api: ApiError): string {
  return api.status && api.status >= 500
    ? API_UNREACHABLE_MESSAGE
    : api.message || humanizeStatus(api.status ?? 0);
}

/** 从 from 开始依次尝试候选端点；命中即返回，全灭才按 403/404/5xx 归因。 */
async function fetchRosterPage(
  keyword: string,
  cursor: string | null,
  from: number,
): Promise<
  | { ok: true; index: number; items: Rec[]; nextCursor: string | null }
  | { ok: false; unavailable: boolean; api: ApiError | null }
> {
  let unavailable = false;
  let firstError: ApiError | null = null;
  for (let i = from; i < PEOPLE_ENDPOINTS.length; i += 1) {
    try {
      const body = await fetchJSON<unknown>(pageUrl(PEOPLE_ENDPOINTS[i], keyword, cursor));
      const page = readPage(body);
      return { ok: true, index: i, ...page };
    } catch (err: unknown) {
      const api = errorFrom(err);
      const status = api?.status;
      if (status === 403 || status === 404) unavailable = true;
      else if (api && status !== 404 && !firstError) firstError = api;
    }
  }
  return { ok: false, unavailable, api: firstError };
}

/**
 * PE-10 服务端检索链：关键词经 300ms 防抖后进 `keyword=`，由读口对**在册全量**
 * 过滤（curl 实测见 DONE-PE-10.md），本地不再对已加载行切片——旧形制把
 * limit=20 写死再本地过滤，第 21 名之后的人永远搜不到，是结构性缺陷。
 * 游标链：续页只用服务端给出的 nextCursor；关键词一变即作废在途游标
 * （generation 号），同一防抖窗至多一根检索请求，绝不双游标并发。
 */
function usePeopleRoster(nonce: number, enabled: boolean, keyword: string): [Roster, () => void] {
  const [roster, setRoster] = useState<Roster>(ROSTER_LOADING);
  const generation = useRef(0);
  const inflight = useRef(false);
  /** 本次挂载内记住命中端点：换关键词不再重跑探针链，检索请求恒为 1 根。 */
  const sourceIndex = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const gen = (generation.current += 1);
    inflight.current = true;
    // 换关键词/刷新清掉行与游标，但**保留已定档的数据源形制**（列不随关键词闪变）。
    setRoster((prev) => ({ ...ROSTER_LOADING, shape: prev.shape }));
    const settle = (res: Awaited<ReturnType<typeof fetchRosterPage>>) => {
      if (gen !== generation.current) return;
      if (res.ok) {
        sourceIndex.current = res.index;
        setRoster((prev) => ({
          phase: res.items.length === 0 ? "empty" : "ready",
          items: res.items,
          nextCursor: res.nextCursor,
          message: "",
          requestId: null,
          loadingMore: false,
          // 未过滤首页 = 数据源形制定档；检索子集沿用，不让列随关键词闪进闪出。
          shape: keyword === "" ? shapeOf(res.items) : (prev.shape ?? shapeOf(res.items)),
        }));
        return;
      }
      // 403/404 与旧口径一致合并为未接入腿（PE-07 互斥禁词由 ?state=denied 预览腿承载）。
      if (res.api && !res.unavailable) {
        setRoster((prev) => ({
          ...prev,
          phase: "error",
          message: errorCopy(res.api as ApiError),
          requestId: (res.api as ApiError).requestId ?? null,
        }));
        return;
      }
      setRoster((prev) => ({ ...prev, phase: "unavailable", message: PEOPLE_GAP_MESSAGE }));
    };
    void fetchRosterPage(keyword, null, sourceIndex.current ?? 0)
      .then((res) => {
        if (gen !== generation.current) return;
        if (!res.ok && res.api && !res.unavailable && sourceIndex.current !== null && sourceIndex.current > 0) {
          // 记住的源出错（非 404 类）：从头重探一次再归因；404/403 链已覆盖全候选。
          sourceIndex.current = null;
          return fetchRosterPage(keyword, null, 0).then(settle);
        }
        settle(res);
        return undefined;
      })
      .finally(() => {
        if (gen === generation.current) inflight.current = false;
      });
  }, [enabled, nonce, keyword]);

  const loadMore = useCallback(() => {
    if (inflight.current || roster.loadingMore || roster.phase !== "ready" || !roster.nextCursor) return;
    const gen = generation.current;
    const cursor = roster.nextCursor;
    inflight.current = true;
    setRoster((prev) => ({ ...prev, loadingMore: true }));
    void fetchRosterPage(keyword, cursor, sourceIndex.current ?? 0)
      .then((res) => {
        if (gen !== generation.current) return;
        if (!res.ok) {
          setRoster((prev) => ({
            ...prev,
            loadingMore: false,
            message: res.api ? errorCopy(res.api) : "下一页没有取回来，已保留当前名单。",
          }));
          return;
        }
        setRoster((prev) => {
          const merged = dedupeById([...prev.items, ...res.items]);
          return {
            ...prev,
            phase: "ready",
            items: merged,
            nextCursor: res.nextCursor,
            loadingMore: false,
            shape: keyword === "" ? shapeOf(merged) : (prev.shape ?? shapeOf(merged)),
          };
        });
      })
      .finally(() => {
        if (gen === generation.current) inflight.current = false;
      });
  }, [keyword, roster.nextCursor, roster.loadingMore, roster.phase]);

  return [roster, loadMore];
}

/** 游标翻页按记录号去重；无 id 的行按内容去重，绝不重复计数。 */
function dedupeById(rows: Rec[]): Rec[] {
  const seen = new Set<string>();
  const out: Rec[] = [];
  for (const row of rows) {
    const id = rawId(row) || JSON.stringify(row);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

type Forced = "loading" | "empty" | "error" | "denied" | "ready";

function readForced(raw: string | null): Forced | null {
  return raw === "loading" || raw === "empty" || raw === "error" || raw === "denied" || raw === "ready"
    ? raw
    : null;
}

/** 强制预览腿：与 EmployeesModulePage 同形制（?rid= 透传，缺省 preview-request）。 */
function previewRoster(forced: Exclude<Forced, "ready">, rid: string): Roster {
  if (forced === "loading") return { ...ROSTER_LOADING };
  if (forced === "empty") return { ...ROSTER_LOADING, phase: "empty" };
  if (forced === "denied") return { ...ROSTER_LOADING, phase: "denied", message: PEOPLE_DENIED_MESSAGE, requestId: rid };
  return {
    ...ROSTER_LOADING,
    phase: "error",
    message: "预览错误：这次读取没有成功，页面没有编造人员数据。",
    requestId: rid,
  };
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
  // PE-10 ⑤：300ms 防抖窗内只留最后一次关键词——每个防抖窗至多一根检索请求。
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);
  // Q12：行打开页内详情（零路由）。名册状态留在本组件，返回即恢复视图，
  // 不重新拉名单。
  const [openId, setOpenId] = useState<string | null>(null);
  const previewRid = sp.get("rid") ?? "preview-request";
  const [live, loadMore] = usePeopleRoster(reload, forced === null || forced === "ready", debounced);
  const people = forced && forced !== "ready" ? previewRoster(forced, previewRid) : live;

  // buglist P0-4（#5）：数据源整列皆缺的可选列（账号/部门/最后活跃）连同表头
  // 一起裁掉，缺列信息由来源注记一行承载；个别行缺值仍渲染该列，格内 `—` +
  // title 说明（§5 口径），不再把「上游未提供×」长注记撑进单元格。
  // PE-10：列在场性是**数据源**属性——检索命中子集沿用未过滤首页定的形制，
  // 绝不因关键词命中了缺值行而让整列闪没。
  const mapped = useMemo<PersonRow[]>(() => people.items.map(readPerson), [people.items]);
  const shape = people.shape ?? shapeOf(people.items);
  const showAccount = shape.account;
  const showDept = shape.dept;
  const showLastActive = shape.lastActive;
  const colLabels = [
    "姓名",
    ...(showAccount ? ["账号"] : []),
    ...(showDept ? ["部门"] : []),
    "状态",
    ...(showLastActive ? ["最后活跃"] : []),
  ];

  if (openId !== null) {
    return (
      <section className="ppl5-page flex min-w-0 flex-col gap-4" data-testid="ppl5-page">
        <EmployeeDetailPanel key={openId} employeeId={openId} onBack={() => setOpenId(null)} />
      </section>
    );
  }

  return (
    <section className="ppl5-page flex min-w-0 flex-col gap-4" data-testid="ppl5-page">
      <header className="ppl5-head">
        <div className="min-w-0">
          <h1 className="font-mondwest text-xl text-white/90">人员目录</h1>
          <p className="mt-1 text-xs text-white/40">
            {people.phase === "ready" && mapped.length > 0
              ? `在册人员名录 · ${colLabels.join(" / ")}`
              : "在册人员名录"}
            {people.phase === "ready"
              ? debounced
                ? ` · 检索命中 ${mapped.length} 人`
                : people.nextCursor
                  ? ` · 已加载 ${mapped.length} 人（在册更多，可继续加载）`
                  : ` · 共 ${mapped.length} 人`
              : ""}
          </p>
          {(people.phase === "ready" || (people.phase === "empty" && debounced !== "")) &&
          mapped.length > 0 ? (
            <p className="mt-1 text-xs text-white/40" data-testid="ppl5-source">
              {shape.employeeLedger
                ? "来源：数字员工台账；真人用户中心接口尚未接入，这里不冒充真人名单。"
                : "来源：用户中心人员台账。"}
            </p>
          ) : null}
          {/* PE-10 ④：口径句——检索由服务端在在册全量上做，不是本地过滤已加载行。 */}
          {people.phase === "ready" || people.phase === "empty" ? (
            <p className="mt-1 text-xs text-white/40" data-testid="ppl5-scope-note">
              搜索为服务端检索在册全量（关键词随请求上送，翻页走服务端游标），不是本地过滤已加载行。
            </p>
          ) : null}
        </div>
        <div className="ppl5-actions">
          <input
            data-testid="ppl5-search"
            aria-label="搜索人员"
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

      {people.phase === "unavailable" ? (
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

      {/* PE-07：denied 独立腿（?state=denied 预览）。屏上永不出现「未接入」，
        * GAP-02 只属于未接入腿；话术逐字抄 EmployeesPage.tsx:625-655 标杆，
        * rid 沿用本组件 RequestId 模式（L209-234）。 */}
      {people.phase === "denied" ? (
        <StateShell
          testid="ppl5-denied"
          icon={<ShieldAlert className="h-4 w-4 text-amber-300/80" aria-hidden />}
          title="人员目录暂不可见"
          body={people.message}
          onRetry={() => setReload((n) => n + 1)}
        >
          <RequestId id={people.requestId} />
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

      {/* PE-10 ③ 三态之「检索空」：服务端在册全量里没命中，与「真为空」互斥。 */}
      {people.phase === "empty" && debounced !== "" ? (
        <StateShell
          testid="ppl5-nomatch"
          icon={<Inbox className="h-4 w-4 text-white/30" aria-hidden />}
          title={`没有匹配「${debounced}」的人员`}
          body="服务端已在在册全量里检索，没有命中这条关键词；不是只翻过已加载的 20 行。换个关键词试试，清空搜索可看全部名单。"
        >
          <Button size="sm" onClick={() => setQuery("")} data-testid="ppl5-nomatch-clear">
            清空搜索
          </Button>
        </StateShell>
      ) : null}

      {/* PE-10 ③ 三态之「真为空」：无关键词且台账本身没有在册人员。 */}
      {people.phase === "empty" && debounced === "" ? (
        <StateShell
          testid="ppl5-empty"
          icon={<Inbox className="h-4 w-4 text-white/30" aria-hidden />}
          title="目录暂时是空的"
          body="后台还没有登记在册人员；不显示 0 人，也不展示样例。接入完成后这里会自动出现名单。"
          onRetry={() => setReload((n) => n + 1)}
        />
      ) : null}

      {people.phase === "ready" ? (
        <Card className="border-white/5 bg-white/[0.02]">
          <CardContent className="p-0" data-testid="ppl5-list">
            <div className="ppl5-grid ppl5-thead" data-cols={colLabels.length}>
              <span data-label="姓名">姓名</span>
              {showAccount ? <span data-label="账号">账号</span> : null}
              {showDept ? <span data-label="部门">部门</span> : null}
              <span data-label="状态">状态</span>
              {showLastActive ? <span data-label="最后活跃">最后活跃</span> : null}
            </div>
            <ul className="divide-y divide-white/5">
              {mapped.map((r) => (
                  <li key={r.key} className="ppl5-grid ppl5-row" data-cols={colLabels.length} data-testid="ppl5-row" title={r.rawId ? `记录号 ${r.rawId}` : undefined}>
                    <span className="flex min-w-0 items-center gap-2 text-sm text-white/85">
                      <Users className="h-3.5 w-3.5 shrink-0 text-white/25" aria-hidden />
                      <span className="min-w-0 break-words" data-label="姓名" data-testid="ppl5-name">
                        {r.name}{r.code !== "未指派" ? ` · ${r.code}` : ""}
                      </span>
                      {r.rawId ? (
                        <button
                          type="button"
                          className="ppl5d-open"
                          data-testid={`ppl5d-open-${r.rawId}`}
                          onClick={() => setOpenId(r.rawId)}
                          title={`查看 ${r.name} 的档案、任职、权限、任务与审计`}
                        >
                          详情
                        </button>
                      ) : null}
                    </span>
                    {showAccount ? (
                      <span className="min-w-0 break-all text-xs text-white/55 md:text-sm md:text-white/60" data-label="账号" data-testid="ppl5-account" title={r.account ? undefined : "上游未提供账号"}>
                        {r.account ?? "—"}
                      </span>
                    ) : null}
                    {showDept ? (
                      <span className="min-w-0 break-words text-xs text-white/55 md:text-sm md:text-white/60" data-label="部门" data-testid="ppl5-dept" title={r.dept ? undefined : "上游未提供部门"}>
                        {r.dept ?? "—"}
                      </span>
                    ) : null}
                    <span data-label="状态" data-testid="ppl5-status"><Badge tone={r.status.tone}>{r.status.text}</Badge></span>
                    {showLastActive ? (
                      <span className="min-w-0 break-words text-xs text-white/55 md:text-sm md:text-white/60" data-label="最后活跃" data-testid="ppl5-last-active" title={r.lastActive ? undefined : r.lastActiveReason ?? "上游未提供最后活跃时间"}>
                        {r.lastActive ?? "—"}
                      </span>
                    ) : null}
                  </li>
                ))}
            </ul>
            {/* PE-10 ①：游标链续页——只用服务端给出的 nextCursor；在途禁用不双发。 */}
            {people.nextCursor ? (
              <div className="flex items-center justify-between gap-3 border-t border-white/5 p-3" data-testid="ppl5-more-row">
                <span className="text-xs text-white/40" data-testid="ppl5-more-note">
                  {people.loadingMore
                    ? "正在按服务端游标加载下一页…"
                    : `已加载 ${mapped.length} 人；在册还有更多，按服务端游标继续。`}
                </span>
                <Button
                  size="sm"
                  outlined
                  disabled={people.loadingMore}
                  aria-disabled={people.loadingMore}
                  onClick={loadMore}
                  data-testid="ppl5-more"
                  title={people.loadingMore ? "上一页还在途中，不并发第二个游标" : "用服务端返回的游标取下一页"}
                >
                  {people.loadingMore ? "加载中…" : "加载更多"}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
