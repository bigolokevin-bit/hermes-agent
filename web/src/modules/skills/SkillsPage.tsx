// Module: skills — read-only skill ledger (SKL4).
//
// One list read: /agent-api/api/skills. The ledger has name, version and
// sharing scope. Source, runtime status and update time are not in the list
// payload, so those cells are "—" with a reason; no value is invented and no
// sample row is shown. A missing route is reported as 未接入 with the GAP id
// only in a tooltip. No raw field name or HTTP status reaches the page.
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Badge, Button, Card, CardContent } from "@nous-research/ui";
import { fetchJsonStrict } from "@/modules/models/fetchJson";
import { ApiError } from "@/lib/api-error";
import { copyTextToClipboard } from "@/lib/clipboard";
import { currentFixtureRid, currentFixtureState, fixtureView, type FixtureState } from "../../shell/fixtures";
import { SKILLS_GAP, formatBeijingTime, readSkills, type SkillRow } from "./skills";
import "./skills.css";

type State =
  | { k: "loading" }
  | { k: "empty" }
  | { k: "error"; message: string; requestId: string | null; gap: string | null }
  | { k: "ready"; rows: SkillRow[]; asOf: string | null };

function requestIdOf(error: unknown): string | null {
  if (error instanceof ApiError && error.requestId) return error.requestId;
  if (error !== null && typeof error === "object" && "requestId" in error && typeof error.requestId === "string" && error.requestId) {
    return error.requestId;
  }
  return null;
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "需要登录：这个页面的登录状态已经失效，请重新登录后再看。";
    if (error.status === 403 || error.status === 404) {
      return "技能读口未接入：上游技能接口还没有接入本控制台，或当前账号无权查看。接入后这里会自动显示真实技能。";
    }
    if (error.status === 0) return "控制台暂时没有回应，请稍后重试。";
    if (error.message) return error.message;
  }
  return "这次没能读取技能台账，请稍后重试。";
}

function RequestId({ id }: { id: string | null }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle");
  const copy = async () => {
    if (!id) return;
    setCopied((await copyTextToClipboard(id)) ? "ok" : "failed");
  };
  return (
    <p className="skl4-reqid" data-testid="skl4-request-id">
      请求编号：<code title={id ?? undefined}>{id ?? "本次请求未记录编号"}</code>
      {id ? (
        <button type="button" onClick={() => void copy()} aria-label="复制请求编号">
          {copied === "ok" ? "已复制" : copied === "failed" ? "复制失败" : "复制"}
        </button>
      ) : null}
    </p>
  );
}

function forcedState(state: FixtureState | null, rid: string | null): State | null {
  if (state === "loading") return { k: "loading" };
  if (state === "empty") return { k: "empty" };
  if (state === "error") {
    return {
      k: "error",
      message: "技能读口未接入：上游技能接口还没有接入本控制台，或当前账号无权查看。接入后这里会自动显示真实技能。",
      requestId: rid,
      gap: SKILLS_GAP,
    };
  }
  return null;
}

/** Remove the preview switch from both window and hash search, keeping other params. */
function leavePreview() {
  const url = new URL(window.location.href);
  url.searchParams.delete("state");
  const [hashPath, hashQuery] = url.hash.split("?");
  if (hashQuery) {
    const params = new URLSearchParams(hashQuery);
    params.delete("state");
    url.hash = `${hashPath}${params.toString() ? `?${params}` : ""}`;
  }
  window.history.replaceState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function Cell({ value, reason }: { value: string | null; reason: string }) {
  return (
    <span className="skl4-cell">
      <span className={value ? "" : "skl4-missing"}>{value ?? "—"}</span>
      {!value ? <span className="skl4-reason">{reason}</span> : null}
    </span>
  );
}

export function SkillsPage() {
  const [state, setState] = useState<State>({ k: "loading" });
  const [attempt, setAttempt] = useState(0);
  const fixture = currentFixtureState();
  const forced = forcedState(fixture, currentFixtureRid());
  const retry = () => {
    if (fixture) leavePreview();
    setAttempt((value) => value + 1);
  };

  const load = useCallback(async (signal: { live: boolean }) => {
    setState({ k: "loading" });
    try {
      const body = await fetchJsonStrict("/agent-api/api/skills");
      if (!signal.live) return;
      const { rows, asOf } = readSkills(body);
      setState(rows.length ? { k: "ready", rows, asOf } : { k: "empty" });
    } catch (error) {
      if (!signal.live) return;
      const gap = error instanceof ApiError && (error.status === 403 || error.status === 404) ? SKILLS_GAP : null;
      setState({ k: "error", message: messageFor(error), requestId: requestIdOf(error), gap });
    }
  }, []);

  useEffect(() => {
    if (forced) return;
    const signal = { live: true };
    void load(signal);
    return () => {
      signal.live = false;
    };
  }, [attempt, forced, load]);

  const page = forced ?? fixtureView<State | null>(fixture ?? "ready", {
    loading: () => ({ k: "loading" }),
    empty: () => ({ k: "empty" }),
    error: () => forcedState("error", currentFixtureRid()),
    ready: () => null,
  }) ?? state;

  return (
    <section className="skl4-page" data-testid="skl4-page" data-fixture={fixture ?? undefined}>
      <header className="skl4-head">
        <div className="min-w-0">
          <h1>技能</h1>
          <p className="skl4-sub">已登记的技能、共享范围与版本状态。只读。</p>
        </div>
        <div className="skl4-actions">
          <Button
            size="sm"
            outlined
            disabled
            aria-disabled="true"
            data-planned="true"
            title="控制台还没有技能写入口；接入后会提供新建与管理。"
            data-testid="skl4-planned-create"
          >
            新建技能
          </Button>
          <Button size="sm" outlined onClick={retry} disabled={page.k === "loading"} data-testid="skl4-refresh">
            <RefreshCw className="mr-1 size-3.5" aria-hidden="true" />重新读取
          </Button>
        </div>
      </header>

      {fixture ? <p className="skl4-preview" data-testid="skl4-preview-note">预览状态：以下内容只用于验收布局，不是实时数据。</p> : null}

      {page.k === "loading" ? (
        <Card><CardContent className="space-y-3 p-4" data-testid="skl4-loading" aria-busy="true">
          <p className="skl4-note">正在读取技能…</p>
          {[1, 2, 3, 4].map((item) => <div key={item} className="skl4-skeleton" />)}
        </CardContent></Card>
      ) : null}

      {page.k === "empty" ? (
        <Card><CardContent className="space-y-2 p-8 text-center" data-testid="skl4-empty">
          <p className="skl4-empty-title">还没有已登记的技能</p>
          <p className="skl4-note">台账没有返回任何技能；这里不补样例行。</p>
        </CardContent></Card>
      ) : null}

      {page.k === "error" ? (
        <Card><CardContent className="space-y-3 p-6" data-testid="skl4-error" role="alert">
          <p className="skl4-error-title">技能列表暂时无法读取</p>
          <p className="skl4-note" title={page.gap ?? undefined}>{page.message}</p>
          <RequestId id={page.requestId} />
          <div className="skl4-actions">
            <Button size="sm" outlined onClick={retry} data-testid="skl4-retry">重试</Button>
            {page.gap ? <a className="skl4-apply" href="#/approvals" data-testid="skl4-apply">提交开通申请</a> : null}
          </div>
        </CardContent></Card>
      ) : null}

      {page.k === "ready" ? (
        <Card>
          <CardContent className="p-0">
            <p className="skl4-source" data-testid="skl4-source">来源：技能台账 · 读取于 {page.asOf ?? "—（未提供读取时刻）"}</p>
            <div className="skl4-scroll">
              <table className="skl4-table" data-testid="skl4-table">
                <thead>
                  <tr>
                    <th scope="col">技能名</th>
                    <th scope="col">来源/类型</th>
                    <th scope="col">启用态</th>
                    <th scope="col">最近更新</th>
                    <th scope="col">共享范围</th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((row) => (
                    <tr key={row.id} data-testid={`skl4-row-${row.id}`} title={row.id}>
                      <td>
                        <span className="skl4-cell">
                          <span className={row.name === "—" ? "skl4-missing" : ""}>{row.name}</span>
                          {row.nameReason ? <span className="skl4-reason">{row.nameReason}</span> : null}
                          {row.version ? <span className="skl4-reason">版本 {row.version}</span> : null}
                        </span>
                      </td>
                      <td><Cell value={row.source} reason={row.sourceReason} /></td>
                      <td><Cell value={row.status} reason={row.statusReason} /></td>
                      <td><Cell value={row.updatedAt} reason={row.updatedAtReason} /></td>
                      <td><Badge tone="outline">{row.scope}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="skl4-note skl4-foot">列表未提供的来源、启用态与最近更新一律显示「—」，不从前端补造；无法归类的状态显示「待核实」。</p>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

export const formatSkillTime = formatBeijingTime;
export default SkillsPage;