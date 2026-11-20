import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, RefreshCw, ShieldQuestion } from "lucide-react";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { Card, CardContent } from "@nous-research/ui/ui/components/card";

import { cn } from "@/lib/utils";
import { fetchMatrix, humanError, requestIdOf, statusOf } from "./api";
import { CAP_RESOURCES, normalizeMatrixRow, resourceRows } from "./fixture";
import { employeeLabel, lifecycleLabel } from "./format";
import type { MatrixRow } from "./types";
import "./duty.css";

type State =
  | { k: "loading" }
  | { k: "ready"; rows: MatrixRow[] }
  // R31: a missing BFF route is stated as 未接入 — sample rows are retired.
  | { k: "unwired" }
  | { k: "error"; status: number; message: string; requestId: string | null };

function riskCount(row: MatrixRow): number {
  const r = row.risk;
  if (!r) return 0;
  return (r.blockedApprovals ?? 0) + (r.failedRuns ?? 0) + (r.budgetOver ? 1 : 0);
}

function LifecycleBadge({ value }: { value?: string }) {
  const tone =
    value === "active" ? "success" : value === "paused" || value === "onboarding" ? "warning" : "outline";
  return <Badge tone={tone}>{lifecycleLabel(value)}</Badge>;
}

export default function MatrixView() {
  const [state, setState] = useState<State>({ k: "loading" });
  const [view, setView] = useState<"people" | "resource">("people");
  const [resourceType, setResourceType] = useState<(typeof CAP_RESOURCES)[number]["id"]>("skill");
  const [query, setQuery] = useState("");
  const [gapOnly, setGapOnly] = useState(false);

  const load = useCallback(() => {
    let alive = true;
    setState({ k: "loading" });
    fetchMatrix(50)
      .then((body) => {
        if (!alive) return;
        if (body.stale === true) {
          setState({
            k: "error",
            status: 409,
            message: "矩阵数据已过期，页面不会回落到样例；请稍后重试。",
            requestId: null,
          });
          return;
        }
        if (body.items !== undefined && !Array.isArray(body.items)) {
          setState({
            k: "error",
            status: 502,
            message: "矩阵数据形状不完整，暂不展示。",
            requestId: null,
          });
          return;
        }
        const rows = (body.items ?? []).map(normalizeMatrixRow).filter((x): x is MatrixRow => x !== null);
        setState({ k: "ready", rows });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const status = statusOf(err);
        // 404 = the BFF route is not deployed yet: say 未接入, never sample.
        if (status === 404) {
          setState({ k: "unwired" });
          return;
        }
        setState({
          k: "error",
          status,
          message: status === 403 ? "你没有查看能力矩阵的权限。" : humanError(err),
          requestId: requestIdOf(err),
        });
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => load(), [load]);

  const rows = state.k === "ready" ? state.rows : [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (gapOnly && riskCount(r) === 0) return false;
      if (!q) return true;
      return [r.name, r.employeeId, r.title, ...(r.capabilities?.skills ?? []), ...(r.capabilities?.tools ?? []), ...(r.capabilities?.knowledge ?? [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, query, gapOnly]);

  const resources = useMemo(() => {
    const conf = CAP_RESOURCES.find((c) => c.id === resourceType) ?? CAP_RESOURCES[0];
    return resourceRows(filtered, conf.field);
  }, [filtered, resourceType]);

  const activeCount = rows.filter((r) => r.lifecycleState === "active").length;

  return (
    <div className="duty-page duty-matrix" data-testid="matrix-page">
      <header className="duty-head">
        <div className="duty-title">
          <ShieldQuestion className="h-5 w-5" aria-hidden />
          <h1>能力与权限</h1>
          <span>{activeCount} 在岗 · 按员工或按资源看覆盖</span>
        </div>
        <div className="duty-head-actions">
          <Button
            size="sm"
            outlined
            onClick={load}
            disabled={state.k === "loading"}
            prefix={<RefreshCw className={cn("h-3.5 w-3.5", state.k === "loading" && "animate-spin")} />}
          >
            刷新
          </Button>
        </div>
      </header>

      {state.k === "unwired" ? (
        <Card role="status" className="border-border bg-card" data-testid="matrix-unwired">
          <CardContent className="flex min-w-0 flex-col items-start gap-2 px-4 py-6">
            <ShieldQuestion className="h-5 w-5 text-muted-foreground" aria-hidden />
            <p className="text-sm">能力矩阵未接入</p>
            <p className="max-w-prose break-words text-xs text-muted-foreground" title="GAP-06：上游矩阵读口 /v1/matrix/employees 未就绪；BFF 已提供 /api/matrix 转发，页面不回落到样例">
              上游的矩阵读口还没有就绪（BFF 的转发路由已在）。这里不展示任何占位数据；读口上线后本页自动显示真数据。
            </p>
            <Button size="sm" outlined onClick={() => load()} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
              重试
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="duty-matrix-bar">
          <div className="duty-seg" role="group" aria-label="视角">
            <button type="button" aria-pressed={view === "people"} onClick={() => setView("people")}>
              按员工
            </button>
            <button type="button" aria-pressed={view === "resource"} onClick={() => setView("resource")}>
              按资源
            </button>
          </div>
          <input
            className="duty-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索员工、技能、工具、知识空间"
            aria-label="搜索"
          />
          <label className="duty-check">
            <input type="checkbox" checked={gapOnly} onChange={(e) => setGapOnly(e.target.checked)} />
            只看有缺口
          </label>
        </CardContent>
      </Card>

      {state.k === "loading" ? (
        <Card>
          <CardContent className="duty-skeleton" aria-busy="true" aria-label="正在读取能力矩阵">
            <span />
            <span />
            <span />
          </CardContent>
        </Card>
      ) : state.k === "error" ? (
        <Card>
          <CardContent className="duty-error" role="alert">
            <p>{state.message}</p>
            <p className="duty-req">{state.requestId ? `请求编号 ${state.requestId}` : "本次请求未记录编号，可复制时间与操作路径反馈"}</p>
            <Button size="sm" outlined onClick={load} prefix={<RefreshCw className="h-3.5 w-3.5" />}>
              重试
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="duty-empty">
            <p>{rows.length === 0 ? "能力矩阵暂无记录" : "该筛选下没有员工"}</p>
            <button
              type="button"
              className="duty-link"
              onClick={() => {
                setQuery("");
                setGapOnly(false);
              }}
            >
              清除筛选
            </button>
          </CardContent>
        </Card>
      ) : view === "people" ? (
        <Card>
          <CardContent className="duty-matrix-body">
            <div className="duty-mtable duty-mhead" aria-hidden>
              <span>员工</span>
              <span>状态</span>
              <span>技能</span>
              <span>工具</span>
              <span>知识空间</span>
              <span>风险</span>
            </div>
            <ul className="duty-mlist">
              {filtered.map((r) => (
                <li key={r.employeeId} className="duty-mtable duty-mrow">
                  <span className="duty-mname">
                    <Link to={`/employees/${encodeURIComponent(r.employeeId)}`}>{employeeLabel(r.name, r.employeeId)}</Link>
                    <em>{r.title ?? "—"}</em>
                  </span>
                  <span data-label="状态"><LifecycleBadge value={r.lifecycleState} /></span>
                  <span data-label="技能">{r.capabilities?.skills?.length ?? "—"}</span>
                  <span data-label="工具">{r.capabilities?.tools?.length ?? "—"}</span>
                  <span data-label="知识空间">{r.capabilities?.knowledge?.length ?? "—"}</span>
                  <span data-label="风险" className={cn(riskCount(r) > 0 && "duty-risk")}>{riskCount(r) || "—"}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="duty-matrix-body">
            <div className="duty-seg duty-seg-sm" role="group" aria-label="资源类型">
              {CAP_RESOURCES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={resourceType === c.id}
                  onClick={() => setResourceType(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {resources.length === 0 ? (
              <div className="duty-empty">
                <p>该类型下暂无资源</p>
              </div>
            ) : (
              <ul className="duty-mlist duty-rlist">
                {resources.map((res) => (
                  <li key={res.name} className="duty-rrow">
                    <span className="duty-mname">{res.name}</span>
                    <Badge tone={res.state === "normal" ? "success" : res.state === "single" ? "warning" : "destructive"}>
                      {res.state === "normal" ? "正常" : res.state === "single" ? "单点" : "零覆盖"}
                    </Badge>
                    <span className="duty-row-time">
                      {res.covered} / {res.total} 在岗员工
                    </span>
                    <span className="duty-rpeople" title={res.employees.join("、")}>
                      {res.employees.slice(0, 3).join("、")}
                      {res.employees.length > 3 ? ` 等 ${res.employees.length} 人` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <p className="duty-note">
        覆盖分母只算在岗员工；缺口只对设了业务下限的资源成立。矩阵读口未就绪时整块标注未接入，不展示占位数据。
      </p>
      <Link className="duty-link" to="/employees">
        去员工列表
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}