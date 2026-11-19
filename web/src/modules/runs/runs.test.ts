// T15 (PRD v4.1) data layer. The assertions pin the honesty contract: the
// `/api/` segment stays on every ask, the fallback is only tried when the
// first route really answered 「this route is not here」, a shape that is not
// a list never paints rows, an unknown cost never reads as a number, and
// engineering values keep their raw home out of the sentence layer.
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-error";

const api = vi.hoisted(() => ({ fetchJSON: vi.fn() }));
vi.mock("@/lib/api", () => ({ fetchJSON: api.fetchJSON }));

import {
  LIST_ROUTES,
  PAGE_LIMIT,
  beijingMinute,
  costBadgeLabel,
  costReason,
  costState,
  costText,
  elapsedMinute,
  errorInfo,
  failureSummary,
  loadRunDetail,
  loadRunEvents,
  loadRuns,
  normalizeEvent,
  requestRetryRun,
  runCode,
  sinceKeyOf,
  statusFilterOf,
} from "./runs";
afterEach(() => {
  api.fetchJSON.mockReset();
});

const RUN = {
  runId: "rn_01M7822XN781D2S9JASH5TX1XZ",
  status: "failed",
  reasonCode: "run.budget_exhausted",
  costStatus: "upstream",
  costUsd: 0.42,
  startedAt: "2026-11-18T02:00:00Z",
  endedAt: "2026-11-18T02:11:48Z",
};

describe("the read asks the real routes", () => {
  it("keeps the /api/ segment and states the limit", async () => {
    api.fetchJSON.mockResolvedValue({ items: [RUN] });
    const state = await loadRuns({ since: "2026-11-12T00:00:00Z" });
    const url = String(api.fetchJSON.mock.calls[0]?.[0]);
    expect(url.startsWith("/agent-api/api/runs?")).toBe(true);
    expect(url).toContain("since=2026-11-12");
    expect(url).toContain(`limit=${PAGE_LIMIT}`);
    expect(state.phase).toBe("ready");
    expect(state.answeredBy).toBe(LIST_ROUTES[0]);
  });

  it("passes the status filter only when one is chosen", async () => {
    api.fetchJSON.mockResolvedValue({ items: [RUN] });
    await loadRuns({ since: "2026-11-12T00:00:00Z", status: "failed" });
    expect(String(api.fetchJSON.mock.calls[0]?.[0])).toContain("status=failed");
    api.fetchJSON.mockResolvedValue({ items: [RUN] });
    await loadRuns({ since: "2026-11-12T00:00:00Z" });
    expect(String(api.fetchJSON.mock.calls[1]?.[0])).not.toContain("status=");
  });

  it("tries the fallback only after the first route answered 404, with the stats route's own names", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/runs")) {
        throw new ApiError("gone", { status: 404, body: '{"code":"console.not_found"}', url, requestId: "rid-404" });
      }
      return { items: [RUN] };
    });
    const state = await loadRuns({ since: "2026-11-12T00:00:00Z", status: "failed" });
    expect(state.phase).toBe("ready");
    expect(state.answeredBy).toBe(LIST_ROUTES[1]);
    const asked = api.fetchJSON.mock.calls.map((c) => String(c[0]));
    expect(asked[0]).toContain("/agent-api/api/runs?");
    expect(asked[1]).toContain("/agent-api/api/run-stats?");
    // the stats route reads from/to — not since/status (RUNS-01 audit: 400)
    expect(asked[1]).toContain("from=2026-11-12");
    expect(asked[1]).not.toContain("since=");
    expect(asked[1]).not.toContain("status=");
  });

  it("a stats-shaped fallback answer (totals, not rows) never paints rows", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/runs")) throw new ApiError("gone", { status: 404, body: "{}", url, requestId: "r" });
      return { totals: { runs: 14, succeeded: 13, failed: 0, running: 1, costUsd: 0.13 } };
    });
    const state = await loadRuns({ since: "2026-11-12T00:00:00Z" });
    expect(state.phase).toBe("error");
    expect(state.rows).toEqual([]);
  });

  it("does not retry elsewhere on a 401 — that is a real answer", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      throw new ApiError("auth", { status: 401, body: '{"code":"console.unauthenticated"}', url, requestId: "rid-401" });
    });
    const state = await loadRuns({ since: "2026-11-12T00:00:00Z" });
    expect(api.fetchJSON).toHaveBeenCalledTimes(1);
    expect(state.phase).toBe("error");
    expect(state.failure?.requestId).toBe("rid-401");
  });

  it("a 2xx that is not a list reads as a failure, never as rows", async () => {
    api.fetchJSON.mockResolvedValue({ totals: { runs: 14, succeeded: 13 } });
    const state = await loadRuns({ since: "2026-11-12T00:00:00Z" });
    expect(state.phase).toBe("error");
    expect(state.rows).toEqual([]);
    expect(state.failure?.sentence).toContain("不是运行列表");
  });

  it("counts entries it could not read instead of painting them", async () => {
    api.fetchJSON.mockResolvedValue({ items: [RUN, { status: "completed" }, null] });
    const state = await loadRuns({ since: "2026-11-12T00:00:00Z" });
    expect(state.rows).toHaveLength(1);
    expect(state.unreadable).toBe(2);
  });

  it("both routes 404 is one denied body carrying the first request id", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      throw new ApiError("gone", { status: 404, body: "{}", url, requestId: url.includes("run-stats") ? "rid-second" : "rid-first" });
    });
    const state = await loadRuns({ since: "2026-11-12T00:00:00Z" });
    expect(state.phase).toBe("denied");
    expect(state.failure?.requestId).toBe("rid-first");
  });
});

describe("the sentence layer", () => {
  it("the run code is 「运行 · 后4位」 — never the bare string", () => {
    expect(runCode(RUN.runId)).toBe("运行 · X1XZ");
    expect(runCode("urn:uuid:9f3a4b7c")).toBe("运行 · 4B7C");
    expect(runCode("")).toBe("运行");
    expect(runCode(undefined)).toBe("运行");
  });

  it("Beijing wall clock to the minute, or a reason", () => {
    expect(beijingMinute("2026-11-18T02:00:00Z").text).toBe("2026-11-18 10:00");
    expect(beijingMinute(null).text).toBeNull();
    expect(beijingMinute(undefined).text).toBeNull();
    expect(beijingMinute("gibberish").text).toBeNull();
  });

  it("elapsed reads to the minute, including a live run", () => {
    const done = elapsedMinute("2026-11-18T02:00:00Z", "2026-11-18T02:11:48Z");
    expect(done.text).toBe("11 分钟");
    const long = elapsedMinute("2026-11-18T01:00:00Z", "2026-11-18T03:30:00Z");
    expect(long.text).toBe("2 小时 30 分钟");
    const startedMinutesAgo = new Date(Date.now() - 5 * 60_000 - 1_500).toISOString();
    const live = elapsedMinute(startedMinutesAgo, null);
    expect(live.text).toBe("5 分钟");
    const bad = elapsedMinute("2026-11-18T02:11:48Z", "2026-11-18T02:00:00Z");
    expect(bad.text).toBeNull();
    expect(bad.reason).toContain("不作猜");
  });

  it("cost has three states and unknown never renders a figure", () => {
    expect(costState({ costStatus: "upstream", costUsd: 0.42 })).toBe("known");
    expect(costState({ costStatus: "unknown", costUsd: 0.42 })).toBe("unknown");
    expect(costState({ costStatus: undefined, costUsd: 0.42 })).toBe("missing");
    expect(costText({ costStatus: "unknown", costUsd: 0.42 })).toBe("—");
    expect(costBadgeLabel({ costStatus: "unknown" })).toBe("未知");
    expect(costBadgeLabel({ costStatus: undefined })).toBe("未记录");
    expect(costReason({ costStatus: undefined, costUsd: null })).toContain("计价状态");
  });

  it("a true zero is $0.00, and a missing figure is not a zero", () => {
    expect(costText({ costStatus: "upstream", costUsd: 0 })).toBe("$0.00");
    expect(usdLike(costText({ costStatus: "upstream", costUsd: null }))).toBe(true);
  });
  function usdLike(s: string) {
    return s === "—";
  }

  it("the failure summary is words, or an honest gap", () => {
    expect(failureSummary({ status: "failed", reasonCode: "run.timeout" }).text).toBe("运行超时");
    expect(failureSummary({ status: "failed", reasonCode: "run.mystery" }).text).toBe("原因代码未识别");
    expect(failureSummary({ status: "failed", reasonCode: undefined }).text).toBe("未记录");
    expect(failureSummary({ status: "completed", reasonCode: undefined }).text).toBe("—");
    expect(failureSummary({ status: "running", reasonCode: undefined }).text).toBe("—");
  });

  it("errorInfo speaks Chinese for every code and carries the request id", () => {
    const err = new ApiError("x", { status: 400, body: "{}", url: "/agent-api/api/runs", requestId: "rid-400" });
    const info = errorInfo(err);
    expect(info.sentence).toContain("筛选没有被接受");
    expect(info.requestId).toBe("rid-400");
    expect(errorInfo(new ApiError("x", { status: 401, body: "{}", url: "/x" })).sentence).toContain("重新登录");
    expect(errorInfo(new Error("weird")).sentence).toContain("网络不可达");
  });

  it("URL filter values are validated, never trusted raw", () => {
    expect(sinceKeyOf("30d")).toBe("30d");
    expect(sinceKeyOf("bogus")).toBe("7d");
    expect(statusFilterOf("failed")).toBe("failed");
    expect(statusFilterOf("open")).toBeNull();
  });
});

/* ── detail leg (T15 v4.1 page 2) ─────────────────────────────────── */

describe("the detail reads", () => {
  it("asks run-detail and run-events with the /api/ segment kept", async () => {
    api.fetchJSON.mockImplementation(async (url: string) => {
      if (url.includes("/api/run-detail")) return RUN;
      if (url.includes("/api/run-events")) return { items: [{ seq: 1, eventType: "started" }], hasMore: false };
      return { items: [] };
    });
    const detail = await loadRunDetail(RUN.runId);
    const events = await loadRunEvents(RUN.runId);
    expect(detail.runId).toBe(RUN.runId);
    expect(events.items).toHaveLength(1);
    const asked = api.fetchJSON.mock.calls.map((c) => String(c[0]));
    expect(asked[0]).toContain("/agent-api/api/run-detail?id=rn_");
    expect(asked[1]).toContain("/agent-api/api/run-events?runId=rn_");
  });

  it("a run-detail answer with no readable id is a failure, not an empty detail", async () => {
    api.fetchJSON.mockResolvedValue({ totals: 3 });
    await expect(loadRunDetail(RUN.runId)).rejects.toBeInstanceOf(ApiError);
  });

  it("events without a seq are counted out, not painted", () => {
    expect(normalizeEvent({ seq: 2 })).toBeTruthy();
    expect(normalizeEvent({ eventType: "token" })).toBeNull();
  });
});

describe("retry means a NEW run", () => {
  it("returns the new id the write answered with — the current id is never echoed back", async () => {
    api.fetchJSON.mockImplementation(async (url: string, init?: { method?: string }) => {
      expect(String(url)).toContain("/agent-api/api/run-retry");
      expect(init?.method).toBe("POST");
      return { runId: "rn_01NEWRETRY00000000A2B3" };
    });
    const newId = await requestRetryRun(RUN.runId);
    expect(newId).toBe("rn_01NEWRETRY00000000A2B3");
    expect(newId).not.toBe(RUN.runId);
  });

  it("an answer without a new id throws instead of pretending a run was made", async () => {
    api.fetchJSON.mockResolvedValue({ ok: true });
    await expect(requestRetryRun(RUN.runId)).rejects.toBeInstanceOf(ApiError);
  });
});
