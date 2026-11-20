/**
 * tools & MCP read — the four states, driven only by what the services answer.
 *
 * Both reads are attempted together. A failure of one section does not erase
 * the rows the other section returned; it keeps a visible, retryable note.
 * When both routes are absent (403/404/non-JSON shell) the page says so and
 * paints no sample row.
 */
import { useCallback, useEffect, useState } from "react";

import {
  failureInfo,
  fetchInventory,
  fetchServers,
  readFailure,
  type FailureCopy,
  type ToolRow,
} from "./tools";

export type ForcedState = "loading" | "empty" | "error" | "denied";

const FORCED: readonly string[] = ["loading", "empty", "error", "denied"];

export function forcedStateOf(raw: string | null): ForcedState | null {
  return raw !== null && FORCED.includes(raw) ? (raw as ForcedState) : null;
}

export type ToolsPhase = "loading" | "ready" | "empty" | "error" | "denied" | "login";

export interface SectionIssue {
  label: string;
  failure: FailureCopy;
}

export interface ToolsState {
  phase: ToolsPhase;
  rows: ToolRow[];
  toolsetRows: number;
  mcpRows: number;
  issues: SectionIssue[];
  failure: FailureCopy | null;
  forced: boolean;
  reload: () => void;
}

type Settled = Omit<ToolsState, "reload" | "forced">;

// The capabilities tab strip unmounts the inactive page. Keep the last settled
// read and the expanded row so a return restores the same view immediately and
// does not read the two endpoints again. Explicit refresh/retry still fetches.
let cachedTools: Settled | null = null;
let cachedOpenTool: string | null = null;

export function resetToolsTabState() {
  cachedTools = null;
  cachedOpenTool = null;
}

export function readOpenTool(): string | null {
  return cachedOpenTool;
}

export function rememberOpenTool(key: string | null) {
  cachedOpenTool = key;
}

const PENDING: Settled = {
  phase: "loading",
  rows: [],
  toolsetRows: 0,
  mcpRows: 0,
  issues: [],
  failure: null,
};

const FORCED_RESULT: Record<ForcedState, Settled> = {
  loading: PENDING,
  empty: { ...PENDING, phase: "empty" },
  error: {
    ...PENDING,
    phase: "error",
    failure: { sentence: "这条腿是用 ?state=error 复现的，服务此刻没有回答过。", requestId: null, technical: null },
  },
  denied: {
    ...PENDING,
    phase: "denied",
    failure: { sentence: "这条腿是用 ?state=denied 复现的，服务此刻没有回答过。", requestId: null, technical: null },
  },
};

function firstFailure(results: PromiseSettledResult<ToolRow[]>[]): unknown | null {
  for (const result of results) if (result.status === "rejected") return result.reason;
  return null;
}

function classify(results: PromiseSettledResult<ToolRow[]>[]): Settled {
  const inventory = results[0];
  const server = results[1];
  const succeeded = results.filter((r): r is PromiseFulfilledResult<ToolRow[]> => r.status === "fulfilled");
  const failure = firstFailure(results);
  const info = failureInfo(failure);

  if (succeeded.length === 0) {
    if (info.status === 401) {
      return { ...PENDING, phase: "login", failure: readFailure(failure, info) };
    }
    const allDenied = results.every(
      (r) => r.status === "rejected" && [403, 404].includes(failureInfo(r.reason).status),
    );
    if (allDenied) {
      return {
        ...PENDING,
        phase: "denied",
        failure: {
          sentence:
            "这块内容要么尚未接入本控制台，要么当前账号无权查看；这里不显示猜测的行，也不展示样例。",
          requestId: info.requestId,
          technical: info.technical,
          status: info.status,
        },
      };
    }
    return { ...PENDING, phase: "error", failure: readFailure(failure, info) };
  }

  const rows = succeeded.flatMap((r) => r.value);
  const issues: SectionIssue[] = [];
  if (inventory.status === "rejected") {
    issues.push({ label: "工具目录", failure: readFailure(inventory.reason, failureInfo(inventory.reason)) });
  }
  if (server.status === "rejected") {
    issues.push({ label: "MCP 连接", failure: readFailure(server.reason, failureInfo(server.reason)) });
  }
  const toolsetRows = rows.filter((row) => row.source === "toolset").length;
  const mcpRows = rows.filter((row) => row.source === "mcp").length;
  const phase: ToolsPhase = rows.length > 0 || issues.length > 0 ? "ready" : "empty";
  return { ...PENDING, phase, rows, toolsetRows, mcpRows, issues };
}

export function useToolsData(forced: ForcedState | null): ToolsState {
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<{ attempt: number; settled: Settled } | null>(() =>
    cachedTools ? { attempt: 0, settled: cachedTools } : null,
  );

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (forced !== null) return;
    if (attempt === 0 && cachedTools) return;
    let alive = true;
    const asked = attempt;
    void (async () => {
      const results = await Promise.allSettled([fetchInventory(), fetchServers()]);
      if (alive) {
        const settled = classify(results);
        cachedTools = settled;
        setRead({ attempt: asked, settled });
      }
    })();
    return () => {
      alive = false;
    };
  }, [attempt, forced]);

  if (forced !== null) return { ...FORCED_RESULT[forced], forced: true, reload };

  const current = read !== null && read.attempt === attempt ? read.settled : PENDING;
  return { ...current, forced: false, reload };
}
