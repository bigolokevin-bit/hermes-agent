/**
 * ChatSessionsMini — 工作台右栏的「会话与工作区」块。
 *
 * 为什么不用上游的 `components/ChatSessionList`：那个组件走 `api.getSessions`
 * → `/agent-api/api/sessions`（BFF 的 console-session 口径，本租户只有 1 条且
 * 无标题），而真正的 Hermes 会话在 `/api/sessions`（9122 代理到 54458 dashboard）。
 * 直接复用会把「只有一条 Untitled」当成会话全部，用户看到的会话列表等于空。
 *
 * 本组件只做三件事：列最近会话（标题/短码 + 相对时间）、点行写 `?resume=<id>`
 * 让对话宿主重开该会话、「新会话」清掉该参数。删除/改名/导出仍归会话页。
 * 读口失败按诚实错误态显示并可重试，不吞错。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { fetchJSON } from "@/lib/api";

interface HermesSession {
  id: string;
  title?: string | null;
  last_active?: number | null;
  updated_at?: number | null;
  source?: string | null;
}

interface SessionsResp {
  sessions?: HermesSession[];
}

interface WorkspacesResp {
  repos?: { root?: string; sessions?: number }[];
  default_cwd?: string | null;
}

const LIMIT = 30;
const REFRESH_MS = 20_000;

function ago(ts: number | null | undefined): string {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return "—";
  // 上游 last_active 是「秒」，updated_at 可能是「毫秒」：按量级归一，
  // 否则 1.79e9 会被当成毫秒读成「两万多天前」。
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const sec = Math.max(0, (Date.now() - ms) / 1000);
  if (sec < 60) return "刚刚";
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`;
  return `${Math.floor(sec / 86400)} 天前`;
}

function label(s: HermesSession): string {
  const t = (s.title ?? "").trim();
  if (t && t !== "Untitled") return t;
  const tail = (s.id ?? "").split("_").pop() ?? "";
  return tail ? `会话 ${tail}` : "未命名会话";
}

export function ChatSessionsMini() {
  const [params, setParams] = useSearchParams();
  const active = params.get("resume");
  const [rows, setRows] = useState<HermesSession[] | null>(null);
  const [workspace, setWorkspace] = useState<WorkspacesResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    let alive = true;
    setError(null);
    fetchJSON<SessionsResp>(`/api/sessions?limit=${LIMIT}&offset=0&order=recent`)
      .then((r) => {
        if (alive) setRows(Array.isArray(r?.sessions) ? r.sessions : []);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message || "会话读口不可用");
        setRows(null);
      });
    fetchJSON<WorkspacesResp>("/api/chat/workspaces")
      .then((r) => {
        if (alive) setWorkspace(r ?? null);
      })
      .catch(() => {
        if (alive) setWorkspace(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => load(), [load, tick]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  const pick = (id: string) => {
    if (id === active) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("resume", id);
        return next;
      },
      { replace: false },
    );
  };

  const fresh = () => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("resume");
        return next;
      },
      { replace: false },
    );
  };

  const ws = useMemo(() => {
    const root = workspace?.default_cwd ?? workspace?.repos?.[0]?.root ?? null;
    const count = workspace?.repos?.[0]?.sessions ?? null;
    return { root, count };
  }, [workspace]);

  return (
    <section className="edw-sessions" data-testid="ed5-workbench-sessions">
      <div className="edw-sessions-head">
        <p className="edw-rail-meta">会话与工作区</p>
        <button type="button" className="edw-sessions-new" onClick={fresh}>
          新会话
        </button>
      </div>

      <p className="edw-sessions-ws" title={ws.root ?? undefined}>
        <span className="edw-sessions-ws-label">工作区</span>
        <span className="edw-sessions-ws-value">
          {ws.root ? ws.root.split("/").slice(-2).join("/") : "—"}
        </span>
        {ws.count !== null && <span className="edw-sessions-ws-count">{ws.count} 个会话</span>}
      </p>

      <div className="edw-sessions-body">
        {error ? (
          <div className="edw-sessions-empty">
            <span>{error}</span>
            <button type="button" className="edw-sessions-new" onClick={() => setTick((n) => n + 1)}>
              重试
            </button>
          </div>
        ) : rows === null ? (
          <div className="edw-sessions-empty">读取中…</div>
        ) : rows.length === 0 ? (
          <div className="edw-sessions-empty">还没有会话，点「新会话」开始</div>
        ) : (
          <ul className="edw-sessions-list">
            {rows.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="edw-sessions-row"
                  aria-current={s.id === active ? "true" : undefined}
                  onClick={() => pick(s.id)}
                  title={s.id}
                >
                  <span className="edw-sessions-title">{label(s)}</span>
                  <span className="edw-sessions-time">{ago(s.last_active ?? s.updated_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default ChatSessionsMini;
