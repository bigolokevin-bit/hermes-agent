/**
 * SessionsList — 员工会话区的真行列表（SE-02）。
 *
 * DoD（backlog §SE-02）：
 * 1. 每行给 sessionId 短形、更新时间、消息数（缺值「—」，不折 0）；
 * 2. 分页只认 `nextCursor`：有游标才显示「加载更多」，点一次追加一页、按 sessionId 去重；
 * 3. 空态与失败态分离；401/403/404/501 各有诚实文案，**任何状态都不渲染样例行**。
 *
 * SE-06 追加：本页筛选（客户端、只筛已加载行，明写「本页筛选」不谎称全局搜索）、
 * 375 无横滚 + 44px 触控目标（见 sessions.css）、列表/筛选的 a11y 语义。
 *
 * 数据全部来自 `fetchSessionsPage()` ⇒ 现网 BFF 真转发
 * （`GET /agent-api/api/console-sessions?employeeId&limit&cursor`）。
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { ApiError } from "@/lib/api-error";

import "./sessions.css";

import {
  DEFAULT_SESSIONS_LIMIT,
  fetchSessionDetail,
  fetchSessionsPage,
  filterSessionRows,
  formatMessageCount,
  formatSessionTime,
  shortSessionId,
  type SessionDetailView,
  type SessionRow,
} from "./sessionsApi";

type ListPhase = "loading" | "ready" | "empty" | "error" | "unwired" | "login" | "denied";

interface ListState {
  phase: ListPhase;
  rows: SessionRow[];
  nextCursor: string | null;
  message: string;
  requestId: string | null;
}

const INITIAL: ListState = {
  phase: "loading",
  rows: [],
  nextCursor: null,
  message: "",
  requestId: null,
};

/** 把读口异常翻成三种可分辨的状态：未接 / 需登录 / 无权限 / 一般失败。 */
function classify(error: unknown): Pick<ListState, "phase" | "message" | "requestId"> {
  if (error instanceof ApiError) {
    const requestId = error.requestId ?? null;
    if (error.status === 401) {
      return { phase: "login", message: "需要登录后才能查看该员工的会话列表。", requestId };
    }
    if (error.status === 403) {
      return { phase: "denied", message: "没有查看该员工会话的权限；请联系管理员开通。", requestId };
    }
    if (error.status === 404 || error.status === 501) {
      return {
        phase: "unwired",
        message: "会话读口未接入：本环境没有可用的会话列表接口，这里不展示任何样例数据。",
        requestId,
      };
    }
    return { phase: "error", message: error.message || "会话列表读取失败。", requestId };
  }
  const message = error instanceof Error && error.message ? error.message : "会话列表读取失败。";
  return { phase: "error", message, requestId: null };
}

export interface SessionsListProps {
  /** 读口白名单参数；空值时不发请求（不猜归属）。 */
  employeeId: string;
  pageSize?: number;
}

export function SessionsList({ employeeId, pageSize = DEFAULT_SESSIONS_LIMIT }: SessionsListProps) {
  const [state, setState] = useState<ListState>(INITIAL);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  /* SE-04：行内展开的会话详情（一次至多开一行；换行/收起即作废旧请求）。 */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    phase: "loading" | "ready" | "error";
    view: SessionDetailView | null;
    message: string;
    requestId: string | null;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const detailReq = useRef(0);
  const reqRef = useRef(0);
  const uid = useId();
  const filterId = `se6-filter-${uid}`;
  const listId = `se6-list-${uid}`;

  const load = useCallback(
    (cursor: string | null) => {
      const scoped = employeeId.trim();
      if (!scoped) {
        setState({ ...INITIAL, phase: "error", message: "缺少员工编号，无法确定会话归属。" });
        return;
      }
      const myReq = ++reqRef.current;
      if (cursor) setLoadingMore(true);
      else setState(INITIAL);

      fetchSessionsPage({ employeeId: scoped, limit: pageSize, cursor })
        .then((page) => {
          if (reqRef.current !== myReq) return;
          setLoadingMore(false);
          setState((prev) => {
            const base = cursor ? prev.rows : [];
            const seen = new Set(base.map((row) => row.sessionId));
            const merged = [...base];
            for (const row of page.items) {
              if (seen.has(row.sessionId)) continue;
              seen.add(row.sessionId);
              merged.push(row);
            }
            return {
              phase: merged.length ? "ready" : "empty",
              rows: merged,
              nextCursor: page.nextCursor,
              message: "",
              requestId: null,
            };
          });
        })
        .catch((error: unknown) => {
          if (reqRef.current !== myReq) return;
          setLoadingMore(false);
          const verdict = classify(error);
          setState((prev) =>
            cursor && prev.rows.length
              ? { ...prev, ...verdict, phase: "ready", message: `${verdict.message}（已保留上方已加载的行）` }
              : { ...INITIAL, ...verdict },
          );
        });
    },
    [employeeId, pageSize],
  );

  /* SE-04：展开/收起某行的会话详情。同一时刻至多一行展开；再点同一行收起，
     换行或收起都令在途详情作废（detailReq 序号守卫），与列表请求互不串台。 */
  const toggleRow = useCallback(
    (sessionId: string) => {
      ++detailReq.current;
      if (expandedId === sessionId) {
        setExpandedId(null);
        setDetail(null);
        return;
      }
      setExpandedId(sessionId);
      setCopiedKey(null);
      setDetail({ phase: "loading", view: null, message: "", requestId: null });
      const my = detailReq.current;
      fetchSessionDetail(sessionId)
        .then((view) => {
          if (detailReq.current !== my) return;
          setDetail({ phase: "ready", view, message: "", requestId: null });
        })
        .catch((error: unknown) => {
          if (detailReq.current !== my) return;
          const rid = error instanceof ApiError ? error.requestId ?? null : null;
          const message =
            error instanceof ApiError && error.status === 404
              ? "该会话不存在或不可见：上游对「不存在」与「跨租户」回同一 404，本页不推断它到底存不存在。"
              : error instanceof ApiError
                ? `会话详情读取失败（${error.status}）。`
                : "会话详情读取失败。";
          setDetail({ phase: "error", view: null, message, requestId: rid });
        });
    },
    [expandedId],
  );

  /* 复制消息的 requestId：剪贴板失败不弹假成功——把文本选区留在原地供手动复制。 */
  const copyRequestId = useCallback(
    (key: string, text: string, node: HTMLElement | null) => {
      navigator.clipboard
        ?.writeText(text)
        .then(() => setCopiedKey(key))
        .catch(() => {
          setCopiedKey(`fail:${key}`);
          try {
            if (node) {
              const range = document.createRange();
              range.selectNodeContents(node);
              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(range);
            }
          } catch {
            /* 选区失败也只影响便利，不影响诚实文案 */
          }
        });
    },
    [],
  );

  useEffect(() => {
    load(null);
    return () => {
      // 卸载时让在途请求的回填失效，避免跨员工的迟到响应覆盖新状态。
      reqRef.current += 1;
      detailReq.current += 1;
    };
  }, [load]);

  if (state.phase === "loading") {
    return (
      <div className="p-6 text-sm text-white/60" data-testid="se2-sessions-loading">
        正在读取该员工的会话列表…
      </div>
    );
  }

  if (state.phase !== "ready" && state.phase !== "empty") {
    const title: Record<Exclude<ListPhase, "ready" | "empty" | "loading">, string> = {
      unwired: "会话读口未接入",
      login: "需要登录",
      denied: "没有权限",
      error: "会话列表读取失败",
    };
    const phase = state.phase as Exclude<ListPhase, "ready" | "empty" | "loading">;
    return (
      <div className="flex flex-col gap-2 p-6 text-sm" data-testid={`se2-sessions-${phase}`}>
        <p className="font-medium text-white/80">{title[phase]}</p>
        <p className="text-white/60">{state.message}</p>
        {state.requestId ? (
          <p className="font-mono text-xs text-white/40" data-testid="se2-sessions-request-id">
            请求编号 {state.requestId}
          </p>
        ) : null}
        <div>
          <button
            type="button"
            className="rounded border border-white/15 px-3 py-1 text-xs text-white/75 hover:bg-white/10"
            data-testid="se2-sessions-retry"
            onClick={() => load(null)}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === "empty") {
    return (
      <div className="flex flex-col gap-1 p-6 text-sm" data-testid="se2-sessions-empty">
        <p className="text-white/80">该员工暂无可查会话。</p>
        <p className="text-xs text-white/50">
          请求带了该员工的 employeeId（读口白名单参数），这是服务端的真实空集 —— 不是加载失败，也不在这里造会话。
        </p>
      </div>
    );
  }

  const visible = filterSessionRows(state.rows, query);
  const queryActive = query.trim().length > 0;

  return (
    <section
      className="se6-sessions flex flex-col"
      data-testid="se2-sessions"
      aria-label="员工会话列表"
    >
      <div className="se6-sessions__toolbar">
        <label className="sr-only" htmlFor={filterId}>
          筛选已加载的会话（按会话编号或员工编号）
        </label>
        <input
          id={filterId}
          type="search"
          className="se6-sessions__filter"
          data-testid="se6-sessions-filter"
          placeholder="筛选已加载的会话（会话编号）"
          value={query}
          aria-controls={listId}
          aria-describedby={`${filterId}-note`}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p
          id={`${filterId}-note`}
          className="se6-sessions__note"
          data-testid="se6-sessions-scope-note"
          aria-live="polite"
        >
          本页筛选：只在已加载的 {state.rows.length} 条里找；全局搜索待后端支持（上游需加 q 或 search
          端点）。
        </p>
      </div>
      <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,1fr)] gap-2 border-b border-white/10 px-4 py-2 text-xs text-white/45 md:grid">
        <span title="会话编号短形；悬停看完整编号">会话</span>
        <span title="该会话累计消息条数；上游没回传时显示「—」，不折成 0">消息数</span>
        <span title="口径：updatedAt（Asia/Shanghai 切到分钟）">最近活动</span>
      </div>
      <ul
        id={listId}
        role="list"
        aria-busy={loadingMore}
        aria-label="已加载的会话"
        className="divide-y divide-white/5"
        data-testid="se2-sessions-list"
      >
        {visible.map((row, index) => (
          <li
            key={row.sessionId}
            role="listitem"
            data-testid={`se2-sessions-row-${index}`}
            className="se6-sessions__row grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,1fr)_auto] md:items-center md:gap-2"
          >
            <span
              className="min-w-0 truncate font-mono text-sm"
              title={row.sessionId}
              aria-label={`会话 ${row.sessionId}`}
              data-testid={`se2-sessions-id-${index}`}
            >
              {shortSessionId(row.sessionId)}
            </span>
            <span
              className="text-xs text-white/60"
              data-testid={`se2-sessions-count-${index}`}
              title={row.messageCount === null ? "上游没有回传该会话的消息数。" : undefined}
            >
              {formatMessageCount(row.messageCount)}
            </span>
            <span
              className="font-mono text-xs text-white/60"
              data-testid={`se2-sessions-time-${index}`}
              title={row.updatedAt ?? undefined}
            >
              {formatSessionTime(row.updatedAt)}
            </span>
            {/* SE-04：行内展开＝详情读口消费面（messages 的 requestId/引用） */}
            <button
              type="button"
              className="se6-sessions__button justify-self-end rounded border border-white/15 px-3 py-1 text-xs text-white/80"
              data-testid={`se4-expand-${index}`}
              aria-expanded={expandedId === row.sessionId}
              onClick={() => toggleRow(row.sessionId)}
            >
              {expandedId === row.sessionId ? "收起详情" : "查看详情"}
            </button>
            {expandedId === row.sessionId && detail ? (
              <div
                className="mt-2 w-full border-t border-white/10 pt-2 text-sm md:col-span-4"
                data-testid={`se4-detail-${index}`}
                role="group"
                aria-label="会话详情消息"
              >
                {detail.phase === "loading" ? (
                  <p className="text-white/60" data-testid="se4-detail-loading">
                    正在读取该会话的消息…
                  </p>
                ) : null}
                {detail.phase === "error" ? (
                  <div data-testid="se4-detail-error">
                    <p className="text-white/80">{detail.message}</p>
                    {detail.requestId ? (
                      <p className="font-mono text-xs text-white/40" data-testid="se4-detail-rid">
                        请求编号 {detail.requestId}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {detail.phase === "ready" && detail.view ? (
                  <>
                    <p className="text-xs text-white/45" data-testid="se4-detail-note">
                      消息按上游给定顺序全量列出（无分页）；请求编号与引用逐条取上游原值，缺就是缺。
                      {detail.view.messageCount !== null ? ` 上游报消息数 ${detail.view.messageCount}。` : " 上游没有回传消息数。"}
                    </p>
                    {detail.view.messages.length === 0 ? (
                      <p className="text-white/60" data-testid="se4-detail-empty">
                        这条会话里一条消息都没有。
                      </p>
                    ) : null}
                    {detail.view.messages.map((msg, mi) => {
                      const ridKey = `${row.sessionId}:${mi}`;
                      const ridNode = `se4-msg-rid-${mi}`;
                      return (
                        <div
                          key={`${msg.seq ?? "x"}-${mi}`}
                          className="border-t border-white/5 py-2"
                          data-testid={`se4-msg-${mi}`}
                        >
                          <p className="text-xs text-white/50">
                            {msg.role === "user" ? "用户" : msg.role === "assistant" ? "助手" : "未知角色"}
                            {msg.seq !== null ? ` · #${msg.seq}` : ""}
                            {msg.createdAt ? ` · ${formatSessionTime(msg.createdAt)}` : ""}
                          </p>
                          <p className="mt-1 min-w-0 break-words text-white/85">
                            {msg.content ?? "（上游没有回传内容）"}
                          </p>
                          {msg.requestId ? (
                            <p className="mt-1 flex flex-wrap items-center gap-2">
                              <span
                                id={ridNode}
                                className="font-mono text-xs text-white/40"
                                data-testid={`se4-msg-rid-${mi}`}
                              >
                                请求编号 {msg.requestId}
                              </span>
                              <button
                                type="button"
                                className="se6-sessions__button rounded border border-white/15 px-2 py-1 text-xs text-white/70"
                                data-testid={`se4-msg-rid-copy-${mi}`}
                                onClick={() =>
                                  copyRequestId(ridKey, msg.requestId ?? "", document.getElementById(ridNode))
                                }
                              >
                                {copiedKey === ridKey
                                  ? "已复制"
                                  : copiedKey === `fail:${ridKey}`
                                    ? "复制失败：文本已保留，可手动选取"
                                    : "复制"}
                              </button>
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-white/40" data-testid={`se4-msg-norid-${mi}`}>
                              请求编号 —（上游未回传）
                            </p>
                          )}
                          {msg.role === "assistant" ? (
                            msg.citations ? (
                              <p className="mt-1 text-xs text-white/60" data-testid={`se4-msg-cites-${mi}`}>
                                引用（{msg.citations.length}）：{msg.citations.join("、")}
                              </p>
                            ) : (
                              <p className="mt-1 text-xs text-white/40" data-testid={`se4-msg-nocite-${mi}`}>
                                这次回答没有带回引用。
                              </p>
                            )
                          ) : null}
                        </div>
                      );
                    })}
                  </>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {queryActive && visible.length === 0 ? (
        <p
          className="px-4 py-3 text-sm text-white/70"
          data-testid="se6-sessions-filter-empty"
        >
          本页已加载的 {state.rows.length} 条里没有匹配「{query.trim()}」的会话。换个关键词或清空筛选；全局搜索待后端。
        </p>
      ) : null}
      <div className="se6-sessions__actions">
        <p className="text-xs text-white/45" data-testid="se2-sessions-note">
          只读列表 · 排序由上游给定（updatedAt DESC）；上游没有总数，只有「加载更多」。
        </p>
        {state.nextCursor ? (
          <button
            type="button"
            className="se6-sessions__button rounded border border-white/15 px-3 py-1 text-xs text-white/80 disabled:opacity-50"
            data-testid="se2-sessions-more"
            disabled={loadingMore}
            aria-controls={listId}
            onClick={() => load(state.nextCursor)}
          >
            {loadingMore ? "加载中…" : "加载更多"}
          </button>
        ) : null}
      </div>
      {state.message ? (
        <p className="px-4 pb-3 text-xs text-amber-300/80" data-testid="se2-sessions-partial-warning">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}

export default SessionsList;