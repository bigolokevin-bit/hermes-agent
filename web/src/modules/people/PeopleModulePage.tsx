/**
 * T20 · 人员目录 module page — stage-2 delivery for lane B.
 *
 * Data source: 毕升用户接口，经 BFF 别名 `/agent-api/api/v1/user/*`。
 * The exact list route is unverified (GAP-02): the page tries the known
 * candidates for real, and when none answers it shows an honest
 * 「待核实（GAP-02）」state — never fabricated rows, never a fake 0 count.
 *
 * Display contract (zero engineering language): raw user ids never reach
 * visible text — they live in `title` attributes only. Missing fields show
 * 「待核实」or 「—」; status codes become words; times are 北京时间到分.
 *
 * Wiring note: `shell/bridge.ts` currently probes no people candidate, so
 * this page ships ready-to-mount and the mount itself waits for a lane A
 * edit (recorded in docs/_artifacts/employees/DONE.md). The manifest stays
 * `kind: 'planned'` for the same registry-snapshot reason as T18.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Inbox, RefreshCw, ShieldAlert, TriangleAlert, Users } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@nous-research/ui";

import { fetchJSON } from "@/lib/api";
import { API_UNREACHABLE_MESSAGE, ApiError, humanizeStatus } from "@/lib/api-error";

/* ------------------------------------------------------------------ *
 * types & small readers
 * ------------------------------------------------------------------ */

type Rec = Record<string, unknown>;

type Resource<T> =
  | { phase: "loading" }
  | { phase: "empty" }
  | { phase: "ready"; data: T }
  | { phase: "denied"; message: string }
  | { phase: "error"; message: string; requestId: string | null };

const DENIED_FORBIDDEN = "你没有查看这块数据的权限。";
const GAP02_MESSAGE =
  "人员目录待核实（GAP-02：毕升用户接口尚未接入本控制台）。接入后这里会自动显示真实名单。";

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
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

/* ------------------------------------------------------------------ *
 * formatting (北京时间到分, words not codes)
 * ------------------------------------------------------------------ */

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

function statusLabel(row: Rec): { text: string; tone: "success" | "warning" | "destructive" | undefined } {
  const s = row.status ?? row.state ?? row.is_active;
  if (typeof s === "number") {
    if (s === 1) return { text: "已启用", tone: "success" };
    if (s === 0) return { text: "已停用", tone: "destructive" };
    if (s === 2) return { text: "已删除", tone: "destructive" };
    if (s === 3) return { text: "待审核", tone: "warning" };
    return { text: "待核实", tone: undefined };
  }
  const word = (typeof s === "string" ? s : "").toLowerCase();
  if (word === "active" || word === "enabled" || word === "true") return { text: "已启用", tone: "success" };
  if (word === "disabled" || word === "inactive" || word === "false") return { text: "已停用", tone: "destructive" };
  if (word === "pending") return { text: "待审核", tone: "warning" };
  return { text: "待核实", tone: undefined };
}

/** Raw id → title attribute only (numeric ids are not engineering tokens,
 * but the display contract keeps every identifier off the visible face). */
function rawId(row: Rec): string {
  const id = row.user_id ?? row.id ?? row.userId;
  if (typeof id === "number" && Number.isFinite(id)) return String(id);
  if (typeof id === "string" && id.trim()) return id.trim();
  return "";
}

type PersonRow = {
  key: string;
  name: string;
  account: string | null;
  dept: string | null;
  status: { text: string; tone: "success" | "warning" | "destructive" | undefined };
  lastActive: string | null;
  rawId: string;
};

function readPerson(row: Rec, index: number): PersonRow {
  const account = pickString(row.user_name, row.username, row.account);
  const name = pickString(row.realname, row.name, row.nick_name) ?? account;
  return {
    key: rawId(row) || `row-${index}`,
    name: name ?? "待核实",
    account,
    dept: pickString(row.dept_name, row.department, row.dept),
    status: statusLabel(row),
    lastActive: beijing(row.last_login ?? row.last_active ?? row.update_time),
    rawId: rawId(row),
  };
}

/* ------------------------------------------------------------------ *
 * fetch — real endpoints, honest GAP-02 when none answers
 * ------------------------------------------------------------------ */

const PEOPLE_ENDPOINTS = [
  "/agent-api/api/v1/user/list",
  "/agent-api/api/v1/user/all",
];

async function loadPeople(): Promise<Resource<Rec[]>> {
  let missing403 = false;
  let firstError: ApiError | null = null;
  for (const url of PEOPLE_ENDPOINTS) {
    try {
      const body = await fetchJSON<unknown>(url);
      return { phase: "ready", data: itemsOf(body) };
    } catch (err: unknown) {
      const api = err instanceof ApiError ? err : null;
      if (api?.status === 403) missing403 = true;
      else if (api && api.status !== 404 && !firstError) firstError = api;
    }
  }
  if (missing403) return { phase: "denied", message: DENIED_FORBIDDEN };
  if (firstError) {
    const message =
      firstError.status && firstError.status >= 500
        ? API_UNREACHABLE_MESSAGE
        : firstError.message || humanizeStatus(firstError.status);
    return { phase: "error", message, requestId: firstError.requestId ?? null };
  }
  return { phase: "denied", message: GAP02_MESSAGE };
}

function usePeople(nonce: number): Resource<Rec[]> {
  const [resource, setResource] = useState<Resource<Rec[]>>({ phase: "loading" });
  useEffect(() => {
    let cancelled = false;
    setResource({ phase: "loading" });
    loadPeople()
      .then((r) => {
        if (!cancelled) setResource(r);
      })
      .catch(() => {
        if (!cancelled) setResource({ phase: "error", message: API_UNREACHABLE_MESSAGE, requestId: null });
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);
  return resource;
}

/* ------------------------------------------------------------------ *
 * state blocks
 * ------------------------------------------------------------------ */

function StateShell({
  testid,
  icon,
  title,
  body,
  onRetry,
}: {
  testid: string;
  icon: ReactNode;
  title: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <section data-testid={testid} className="flex flex-col items-start gap-3 p-4">
      <div className="flex items-center gap-2 text-sm text-white/80">
        {icon}
        <span>{title}</span>
      </div>
      {body ? <p className="text-xs leading-relaxed text-white/40">{body}</p> : null}
      {onRetry ? (
        <Button size="sm" outlined onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          重试
        </Button>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * the page
 * ------------------------------------------------------------------ */

export default function PeopleModulePage() {
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const people = usePeople(reload);

  const rows = useMemo<PersonRow[]>(() => {
    if (people.phase !== "ready") return [];
    const q = query.trim().toLowerCase();
    return people.data
      .map(readPerson)
      .filter(
        (r) =>
          q === "" ||
          r.name.toLowerCase().includes(q) ||
          (r.account ?? "").toLowerCase().includes(q) ||
          (r.dept ?? "").toLowerCase().includes(q),
      );
  }, [people, query]);

  return (
    <section className="flex flex-col gap-4" data-testid="people-page">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-mondwest text-xl text-white/90">人员目录</h1>
          <p className="mt-1 text-xs text-white/40">
            在册真人名录 · 姓名 / 账号 / 部门 / 状态 / 最后活跃
            {people.phase === "ready" ? ` · 共 ${people.data.length} 人` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            data-testid="people-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索姓名、账号或部门"
            className="h-8 w-44 rounded-md border border-white/10 bg-white/5 px-3 text-xs text-white/80 outline-none placeholder:text-white/25"
          />
          <Button size="sm" outlined onClick={() => setReload((n) => n + 1)}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            刷新
          </Button>
        </div>
      </header>

      {people.phase === "loading" ? (
        <section
          data-testid="people-loading"
          className="flex flex-col gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-4"
          aria-label="正在加载人员目录"
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-white/5" />
          ))}
        </section>
      ) : null}

      {people.phase === "denied" ? (
        <StateShell
          testid="people-denied"
          icon={<ShieldAlert className="h-4 w-4 text-amber-300/80" aria-hidden />}
          title={people.message === DENIED_FORBIDDEN ? "暂时看不到人员目录" : "数据源待核实"}
          body={people.message}
          onRetry={() => setReload((n) => n + 1)}
        />
      ) : null}

      {people.phase === "error" ? (
        <StateShell
          testid="people-error"
          icon={<TriangleAlert className="h-4 w-4 text-rose-300/80" aria-hidden />}
          title="没能加载出人员目录"
          body={`${people.message}${people.requestId ? `（请求编号：${people.requestId}）` : "（请求编号：未提供）"}`}
          onRetry={() => setReload((n) => n + 1)}
        />
      ) : null}

      {people.phase === "empty" ? (
        <StateShell
          testid="people-empty"
          icon={<Inbox className="h-4 w-4 text-white/30" aria-hidden />}
          title="目录暂时是空的"
          body="后台还没有登记在册人员。接入完成后这里会自动出现名单。"
          onRetry={() => setReload((n) => n + 1)}
        />
      ) : null}

      {people.phase === "ready" ? (
        people.data.length === 0 ? (
          <StateShell
            testid="people-empty"
            icon={<Inbox className="h-4 w-4 text-white/30" aria-hidden />}
            title="目录暂时是空的"
            body="后台还没有登记在册人员。接入完成后这里会自动出现名单。"
            onRetry={() => setReload((n) => n + 1)}
          />
        ) : rows.length === 0 ? (
          <StateShell
            testid="people-nomatch"
            icon={<Inbox className="h-4 w-4 text-white/30" aria-hidden />}
            title={`没有匹配「${query.trim()}」的人员`}
            body="换个关键词试试；清空搜索可看全部名单。"
          />
        ) : (
          <Card className="border-white/5 bg-white/[0.02]">
            <CardContent className="p-0" data-testid="people-list">
              <div className="hidden md:grid md:grid-cols-[1.4fr_1.2fr_1fr_0.8fr_1.2fr] gap-2 border-b border-white/5 px-4 py-2 text-xs text-white/40">
                <span>姓名</span>
                <span>账号</span>
                <span>部门</span>
                <span>状态</span>
                <span>最后活跃</span>
              </div>
              <ul className="divide-y divide-white/5">
                {rows.map((r) => (
                  <li
                    key={r.key}
                    className="grid grid-cols-1 gap-1 px-4 py-2 md:grid-cols-[1.4fr_1.2fr_1fr_0.8fr_1.2fr] md:gap-2 md:items-center"
                    data-testid="people-row"
                    title={r.rawId ? `记录号 ${r.rawId}` : undefined}
                  >
                    <span className="flex items-center gap-2 text-sm text-white/85 min-w-0">
                      <Users className="h-3.5 w-3.5 shrink-0 text-white/25" aria-hidden />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="text-xs text-white/55 md:text-sm md:text-white/60 font-mono">
                      {r.account ?? "待核实"}
                    </span>
                    <span className="text-xs text-white/55 md:text-sm md:text-white/60">
                      {r.dept ?? "待核实"}
                    </span>
                    <span>
                      <Badge tone={r.status.tone}>{r.status.text}</Badge>
                    </span>
                    <span className="text-xs text-white/55 md:text-sm md:text-white/60" data-testid="people-last-active">
                      {r.lastActive ?? "待核实"}
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
