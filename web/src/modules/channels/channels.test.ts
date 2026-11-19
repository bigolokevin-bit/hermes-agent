// @vitest-environment node
// T29 + T24 pure layer. What is pinned here is the honesty, not the layout:
// the routes keep the `/api/` segment and are the ones this repo or the task
// names (nothing invented), `available` is only ever reached from a state token
// that says the thing is connected, an absent value stays absent instead of
// becoming 0 or a guessed word, the 数据源 ledger never calls a route it could
// not read 「已接入」, and the four states are decided by what the answers were.

import { describe, expect, it } from "vitest";

import {
  CHANNEL_SOURCES,
  CREDENTIAL_LABEL,
  GAP,
  GAP_NO_ENTRIES,
  GAP_UNVERIFIABLE,
  LEDGER_SOURCES,
  LEDGER_STATUS_LABEL,
  NO_SYNC_REASON,
  PLATFORM_STATUS_LABEL,
  SOURCES,
  STATUS_LABEL,
  applyFilter,
  beijingMinute,
  credentialOf,
  filterOf,
  isDenied,
  ledgerRows,
  maskId,
  newestSeen,
  platformStatusOf,
  readFailure,
  readSource,
  requestIdLine,
  settle,
  sourceUrl,
  summaryPlatforms,
  summaryStamp,
  statusOf,
  type SourceRead,
} from "./channels";

const pathOf = (id: string): readonly string[] => SOURCES.find((source) => source.id === id)?.paths ?? [];

describe("the routes", () => {
  it("keep the /api/ segment, which is what makes them BFF routes", () => {
    for (const source of SOURCES) {
      for (const path of source.paths) {
        expect(path.startsWith("/agent-api/api/")).toBe(true);
      }
    }
  });

  it("are exactly the names this repo or the task supplies, in the tried order", () => {
    // Pinned on purpose: adding a path here means inventing a route, and the
    // whole point of the pane is that it does not do that. The first name is the
    // gateway's own summary — the only surface this BFF actually answers
    // (2026-11-19 probes: messaging/platforms and channels are 404).
    expect(pathOf("platforms")).toEqual([
      "/agent-api/api/hermes-summary",
      "/agent-api/api/messaging/platforms",
      "/agent-api/api/channels",
    ]);
    expect(pathOf("connectors")).toEqual(["/agent-api/api/gateway-connections", "/agent-api/api/connectors"]);
    expect(pathOf("datasources")).toEqual(["/agent-api/api/datasources"]);
    expect(pathOf("mcp")).toEqual(["/agent-api/api/mcp/servers"]);
  });

  it("splits into the two sections this page is about", () => {
    expect(CHANNEL_SOURCES.map((source) => source.id)).toEqual(["platforms", "connectors"]);
    expect(LEDGER_SOURCES.map((source) => source.id)).toEqual(["datasources", "mcp"]);
  });

  it("names the gap it belongs to, and keeps MCP's own number", () => {
    expect(GAP).toBe("GAP-08");
    expect(SOURCES.find((source) => source.id === "mcp")?.gap).toBe("GAP-04");
  });

  it("numbers the ledger's own gaps past every number already in use", () => {
    // GAP-01…GAP-10 are carried by other lanes (09 = 运行列表, 10 = 委托), and
    // this was grepped across web/src, docs/_artifacts and apps before taking 11
    // and 12. Pinned so a later lane cannot quietly reuse them for something else.
    expect(GAP_NO_ENTRIES).toBe("GAP-11");
    expect(GAP_UNVERIFIABLE).toBe("GAP-12");
    const mine = new Set([GAP, GAP_NO_ENTRIES, GAP_UNVERIFIABLE, "GAP-04"]);
    expect(mine.size).toBe(4);
  });
});

describe("the request changes with the filter", () => {
  it("asks the plain route for 全部 and a different URL for every other choice", () => {
    const path = pathOf("platforms")[0];
    const all = sourceUrl(path, "all");
    const up = sourceUrl(path, "available");
    const down = sourceUrl(path, "unavailable");
    const off = sourceUrl(path, "disabled");
    expect(all).toBe("/agent-api/api/hermes-summary?limit=50");
    expect(up).toBe(`${all}&status=available`);
    expect(down).toBe(`${all}&status=unavailable`);
    expect(off).toBe(`${all}&status=disabled`);
    expect(new Set([all, up, down, off]).size).toBe(4);
    expect(all).not.toContain("status=");
  });

  it("reads a filter back out of whatever the URL said", () => {
    expect(filterOf(null)).toBe("all");
    expect(filterOf("nonsense")).toBe("all");
    expect(filterOf("available")).toBe("available");
    expect(filterOf("unavailable")).toBe("unavailable");
    expect(filterOf("disabled")).toBe("disabled");
  });

  it("narrows rows by the same condition it asked with", () => {
    const rows = [
      { status: "available" },
      { status: "unavailable" },
      { status: "unknown" },
      { status: "disabled" },
    ] as never as Parameters<typeof applyFilter>[0];
    expect(applyFilter(rows, "all")).toHaveLength(4);
    expect(applyFilter(rows, "available")).toHaveLength(1);
    // 「未接入与未知」 keeps the row whose state nobody explained, and the
    // switched-off one too: nothing may hide from both choices at once.
    expect(applyFilter(rows, "unavailable")).toHaveLength(3);
    // 「未启用」 is the narrower question, and answers only with that word.
    expect(applyFilter(rows, "disabled").map((row) => row.status)).toEqual(["disabled"]);
  });
});

describe("403 and 404 are one state", () => {
  it("denies both, and nothing else", () => {
    expect(isDenied(403)).toBe(true);
    expect(isDenied(404)).toBe(true);
    expect(isDenied(401)).toBe(false);
    expect(isDenied(500)).toBe(false);
    expect(isDenied(200)).toBe(false);
  });
});

describe("the status vocabulary folds without inventing a state", () => {
  it("reads only a real connection token as 已接入", () => {
    expect(statusOf("connected").status).toBe("available");
    expect(statusOf("Connected").status).toBe("available");
    expect(statusOf("online").status).toBe("available");
  });

  it("translates the documented down tokens into plain Chinese", () => {
    const cases: [string, string][] = [
      ["not_configured", "还缺必要的配置，平台没有真正接上"],
      ["gateway_stopped", "网关没有在运行"],
      ["pending_restart", "改动还没生效，要等网关重启"],
      ["startup_failed", "启动时失败了"],
      ["fatal", "启动遇到无法继续的错误"],
      ["disconnected", "连接已经断开"],
    ];
    for (const [token, reason] of cases) {
      const folded = statusOf(token);
      expect(folded.status).toBe("unavailable");
      expect(folded.reason).toBe(reason);
      expect(folded.reason).not.toMatch(/not_configured|pending_restart|[A-Z_]{6,}/);
    }
  });

  it("folds a switched-off platform into 未启用, not 未接入 and not 未知", () => {
    const disabled = statusOf("disabled");
    expect(disabled.status).toBe("disabled");
    expect(disabled.reason).toBe("已被禁用，需要先启用后再读取");
    // every spelling of 「switched off」 lands in the same bucket, before the
    // unknown leg can turn it into a grey 「未知」
    for (const token of ["disabled", "disabled_by_admin", "disabled_by_config", "switched_off", "Switched-Off"]) {
      expect(statusOf(token).status).toBe("disabled");
      expect(statusOf(token).reason).toContain("禁用");
    }
    expect(statusOf("disabled_by_admin").reason).toBe("已被管理员禁用，需要先启用后再读取");
    // and the word an admin earned is not handed to a token that did not name one
    expect(statusOf("disabled").reason).not.toContain("管理员");
  });

  it("keeps an unknown token unknown, with no favourable word attached", () => {
    expect(statusOf("probe-v2").status).toBe("unknown");
    expect(statusOf("probe-v2").reason).toBeNull();
    expect(statusOf(null).status).toBe("unknown");
  });

  it("never lets a word mean health, only 已接入 / 未启用 / 未接入 / 未知", () => {
    expect(STATUS_LABEL.available).toBe("已接入");
    expect(STATUS_LABEL.disabled).toBe("未启用");
    expect(STATUS_LABEL.unavailable).toBe("未接入");
    expect(STATUS_LABEL.unknown).toBe("未知");
    expect(Object.values(STATUS_LABEL)).not.toContain("正常");
  });

  it("gives the ledger 待核实 where a platform row may say 未知", () => {
    // A ledger row speaks for a WHOLE source, so an unverifiable state is an
    // instruction to go check — 「未知」 on such a row is a shrug, not a fact.
    expect(LEDGER_STATUS_LABEL.unknown).toBe("待核实");
    expect(LEDGER_STATUS_LABEL.available).toBe("已接入");
    expect(LEDGER_STATUS_LABEL.unavailable).toBe("未接入");
    const words = Object.values(LEDGER_STATUS_LABEL);
    expect(words).not.toContain("未知");
    expect(words).not.toContain("正常");
    // and the three words the acceptance sheet names are all present
    expect(new Set(["已接入", "未接入", "待核实"]).size).toBe(3);
    for (const word of ["已接入", "未接入", "待核实"]) expect(words).toContain(word);
  });

  it("has a fixed sentence for a sync stamp the answer never carried", () => {
    expect(NO_SYNC_REASON).toContain("没有说");
    expect(NO_SYNC_REASON).not.toMatch(/null|undefined|NaN|同步于/);
  });
});

describe("reading one source's answer", () => {
  const platforms = SOURCES.find((source) => source.id === "platforms")!;
  const path = platforms.paths[0];

  it("takes the list from wherever the answer hung it", () => {
    const shapes = [
      [{ name: "甲", state: "connected" }],
      { platforms: [{ name: "甲", state: "connected" }] },
      { channels: [{ name: "甲", state: "connected" }] },
      { items: [{ name: "甲", state: "connected" }] },
      { data: { platforms: [{ name: "甲", state: "connected" }] } },
    ];
    for (const payload of shapes) {
      const read = readSource(payload, platforms, path);
      expect(read.kind).toBe("rows");
    }
  });

  it("paints the name, the plain type and the masked handle", () => {
    const read = readSource(
      {
        platforms: [
          { id: "telegram", name: "Telegram 企业号", state: "connected", updated_at: "2026-11-19T01:20:00Z" },
          { id: "conn_1f2e3d4c5b6a", state: "disabled", error_message: "凭据已过期" },
        ],
      },
      platforms,
      path,
    );
    expect(read.kind).toBe("rows");
    if (read.kind !== "rows") return;
    const [first, second] = read.rows;
    expect(first.name).toBe("Telegram 企业号");
    expect(first.masked).toBeNull();
    expect(first.kindLabel).toBe("消息平台");
    expect(first.status).toBe("available");
    expect(second.name).toBeNull();
    expect(second.masked).toBe("连接 · 后4位 5b6a");
    expect(second.status).toBe("disabled");
    // the reason is the upstream's own sentence, not a token
    expect(second.reason).toBe("凭据已过期");
    expect(second.rawState).toBe("disabled");
  });

  it("says 未接入 for an enabled-but-not-connected platform, never 已接入", () => {
    const read = readSource({ platforms: [{ id: "a", name: "开着但没连上", enabled: true, configured: true }] }, platforms, path);
    if (read.kind !== "rows") throw new Error("expected rows");
    expect(read.rows[0].status).toBe("unknown");
    expect(read.rows[0].reason).toBeNull();
    // and a disabled switch with no state token does explain itself
    const off = readSource({ platforms: [{ id: "b", name: "关着的", enabled: false }] }, platforms, path);
    if (off.kind !== "rows") throw new Error("expected rows");
    expect(off.rows[0].status).toBe("unknown");
    expect(off.rows[0].reason).toBe("服务说这个平台的开关是关着的，但没有说明现在的连接状态");
  });

  it("counts an entry it could not read instead of painting it", () => {
    const read = readSource({ platforms: [{ name: "甲", state: "connected" }, "读不出", 42, null, {}] }, platforms, path);
    if (read.kind !== "rows") throw new Error("expected rows");
    expect(read.rows).toHaveLength(1);
    expect(read.unreadable).toBe(4);
  });

  it("answers empty only when the list was really there and empty", () => {
    expect(readSource({ platforms: [] }, platforms, path).kind).toBe("empty");
    expect(readSource([], platforms, path).kind).toBe("empty");
    expect(readSource({ status: "ok", note: "nothing to see" }, platforms, path).kind).toBe("shape");
    expect(readSource("a string", platforms, path).kind).toBe("shape");
  });

  it("keeps the declared total as what the answer said, or null", () => {
    const withTotal = readSource({ platforms: [{ name: "甲", state: "connected" }], total: 12 }, platforms, path);
    const without = readSource({ platforms: [{ name: "甲", state: "connected" }] }, platforms, path);
    expect(withTotal.kind === "rows" && withTotal.declaredTotal).toBe(12);
    expect(without.kind === "rows" && without.declaredTotal).toBeNull();
    // a real zero stays zero, and is not folded into 「nothing declared」
    const zero = readSource({ platforms: [], total: 0 }, platforms, path);
    expect(zero.kind).toBe("empty");
  });

  it("folds a named type into plain Chinese and keeps the raw token for 技术详情", () => {
    const read = readSource({ sources: [{ id: "s", name: "订单库", type: "database" }] }, SOURCES.find((s) => s.id === "datasources")!, "/x");
    if (read.kind !== "rows") throw new Error("expected rows");
    expect(read.rows[0].kindLabel).toBe("数据库");
    expect(read.rows[0].rawType).toBe("database");
  });

  it("leaves an unnameable type as 「类型未说明」 instead of guessing", () => {
    const read = readSource({ sources: [{ id: "s", name: "怪东西", type: "quantum" }] }, SOURCES.find((s) => s.id === "datasources")!, "/x");
    if (read.kind !== "rows") throw new Error("expected rows");
    expect(read.rows[0].kindLabel).toBe("类型未说明");
  });
});

describe("masking", () => {
  it("shows only the last four, and says it is a handle", () => {
    expect(maskId("srv_1a2b3c4d5e6f7081")).toBe("连接 · 后4位 7081");
    expect(maskId(null)).toBeNull();
    expect(maskId("   ")).toBeNull();
  });
});

describe("Beijing wall clock", () => {
  it("renders to the minute, whatever form the instant arrived in", () => {
    expect(beijingMinute("2026-11-19T01:20:00Z").text).toBe("2026-11-19 09:20");
    expect(beijingMinute("2026-11-19 01:20").text).not.toBeNull();
    expect(beijingMinute(1763515200)?.text).not.toBeNull();
    expect(beijingMinute(new Date("2026-11-19T16:05:00Z")).text).toBe("2026-11-20 00:05");
  });

  it("explains what is missing instead of printing a time that was never sent", () => {
    expect(beijingMinute(null)).toEqual({ text: null, reason: "服务未提供最近可见时间" });
    expect(beijingMinute("")).toEqual({ text: null, reason: "服务未提供最近可见时间" });
    expect(beijingMinute("2026年11月19日").text).toBeNull();
    expect(beijingMinute("2026年11月19日").reason).toBe("服务给的不是一个能读出的时间");
    expect(beijingMinute("2026-13-45T99:99:99Z").text).toBeNull();
    expect(beijingMinute("2026-13-45T99:99:99Z").reason).toBe("服务给的时间读不出时刻");
  });

  it("never leaks the wire form into the rendered string", () => {
    const seen = beijingMinute("2026-11-19T01:20:00.000Z").text ?? "";
    expect(seen).not.toMatch(/T\d|Z\b|01:20/);
    expect(seen).toContain("2026-11-19");
    expect(seen).toContain("09:20");
  });
});

describe("the 数据源 ledger", () => {
  const at = new Date("2026-11-19T01:20:00Z");
  const platforms = SOURCES.find((source) => source.id === "platforms")!;
  const datasources = SOURCES.find((source) => source.id === "datasources")!;

  const rowFor = (id: string, read: SourceRead | undefined) =>
    ledgerRows({ [id]: read } as Record<string, SourceRead>, at).find((row) => row.key === id)!;

  it("calls a source 已接入 only when entries arrived", () => {
    const row = rowFor("platforms", {
      kind: "rows",
      rows: [{ status: "available" } as never],
      declaredTotal: null,
      unreadable: 0,
      path: platforms.paths[0],
    });
    expect(row.status).toBe("available");
    expect(row.gap).toBeNull();
    expect(row.reason).toContain("这一次读到 1 条");
  });

  it("does not call an empty-but-answering route 已接入, and says which gap it is", () => {
    const row = rowFor("datasources", { kind: "empty", path: datasources.paths[0] });
    expect(row.status).toBe("unknown");
    expect(row.reason).toContain("不写成已接入");
    // A route that answered with nothing is NOT a missing endpoint: the row says
    // 待核实 and carries the number that means exactly that.
    expect(row.gap).toBe(GAP_NO_ENTRIES);
    // and an answer that carried no entry carried no instant either
    expect(row.syncedAt).toBeNull();
  });

  it("marks a route this console has not wired 未接入 with the page's own gap", () => {
    const row = rowFor("datasources", {
      kind: "failed",
      denied: true,
      failure: { sentence: "x", requestId: null, technical: "HTTP 404" },
    });
    expect(row.status).toBe("unavailable");
    expect(row.gap).toBe(GAP);
    expect(row.reason).toBe(datasources.missingReason);
    // the raw detail is carried for 技术详情 only
    expect(row.rawDetail).toBe("HTTP 404");
  });

  it("keeps a service error as 待核实 rather than claiming the route is missing", () => {
    const row = rowFor("platforms", {
      kind: "failed",
      denied: false,
      failure: { sentence: "服务在处理时出了错", requestId: "r", technical: "HTTP 500" },
    });
    expect(row.status).toBe("unknown");
    expect(row.gap).toBe(GAP_UNVERIFIABLE);
    expect(row.reason).toBe("服务在处理时出了错");
  });

  it("calls a wrong-shaped answer 待核实 too, because a route DID answer", () => {
    const row = rowFor("datasources", { kind: "shape" });
    expect(row.status).toBe("unknown");
    expect(row.gap).toBe(GAP_UNVERIFIABLE);
    expect(row.reason).toContain("不是一份清单");
    expect(row.rawDetail).toBe("unexpected payload shape");
  });

  it("says whose list the row speaks for, and of what kind", () => {
    const row = rowFor("mcp", { kind: "empty", path: SOURCES.find((s) => s.id === "mcp")!.paths[0] });
    expect(row.kindLabel).toBe("MCP 连接");
    expect(row.originLabel).toBe("上游的工具与 MCP 服务清单");
    // human words only: no route, no field name, no service token in either
    expect(row.originLabel).not.toMatch(/\/|agent-api|api|_/);
    expect(row.kindLabel).not.toMatch(/\/|agent-api|api|_/);
  });

  it("takes 最近同步 from the answer, and only from the answer", () => {
    const row = rowFor("platforms", {
      kind: "rows",
      rows: [
        { status: "available", lastSeen: "2026-11-19T01:20:00Z" } as never,
        { status: "available", lastSeen: "2026-11-19T03:45:00Z" } as never,
        { status: "unknown", lastSeen: null } as never,
      ],
      declaredTotal: null,
      unreadable: 0,
      path: platforms.paths[0],
    });
    // the newest instant the answer carried wins, in wire form for the renderer
    expect(row.syncedAt).toBe("2026-11-19T03:45:00Z");
    expect(beijingMinute(row.syncedAt).text).toBe("2026-11-19 11:45");
    // the page's own clock stays a separate value and cannot leak into it
    expect(row.checkedAt).toEqual(at);
  });

  it("leaves 最近同步 empty when the answer carried no instant, rather than using now()", () => {
    const row = rowFor("platforms", {
      kind: "rows",
      rows: [{ status: "available", lastSeen: null } as never],
      declaredTotal: null,
      unreadable: 0,
      path: platforms.paths[0],
    });
    expect(row.syncedAt).toBeNull();
    // the ledger still knows when THIS page looked, and keeps it apart
    expect(row.checkedAt).toEqual(at);
    // and a row of unreadable timestamps is no sync stamp either
    expect(
      newestSeen([
        { lastSeen: "昨天" },
        { lastSeen: "" },
        { lastSeen: null },
      ] as never),
    ).toBeNull();
  });

  it("gives every row that is not 已接入 a gap number to stand behind the verdict", () => {
    const reads: Record<string, SourceRead> = {
      platforms: { kind: "empty", path: platforms.paths[0] },
      connectors: { kind: "shape" },
      datasources: {
        kind: "failed",
        denied: false,
        failure: { sentence: "x", requestId: null, technical: null },
      },
    };
    for (const row of ledgerRows(reads, at)) {
      if (row.status === "available") continue;
      expect(row.gap, row.key).toMatch(/^GAP-\d+$/);
    }
    // the source no read came back for is 待核实, not 未接入: absence of an
    // outcome proves nothing about the endpoint
    const silent = ledgerRows(reads, at).find((row) => row.key === "mcp")!;
    expect(silent.status).toBe("unknown");
    expect(silent.gap).toBe(GAP_UNVERIFIABLE);
    expect(silent.syncedAt).toBeNull();
  });

  it("has a row for every source, in the same order, so nothing silently disappears", () => {
    const rows = ledgerRows({}, at);
    expect(rows.map((row) => row.key)).toEqual(SOURCES.map((source) => source.id));
    expect(rows.every((row) => row.status !== "available")).toBe(true);
  });
});

describe("the phase comes from the answers", () => {
  const at = new Date("2026-11-19T01:20:00Z");
  const platforms = SOURCES.find((source) => source.id === "platforms")!;

  const rowsRead = (count: number): SourceRead => ({
    kind: "rows",
    rows: Array.from({ length: count }, () => ({ status: "available" }) as never) as never,
    declaredTotal: null,
    unreadable: 0,
    path: platforms.paths[0],
  });
  const failed = (denied: boolean): SourceRead => ({
    kind: "failed",
    denied,
    failure: { sentence: denied ? "看不到" : "读出了错", requestId: denied ? "deny-1" : "err-1", technical: null },
  });

  it("is ready when a channel source sent rows, even if another route is missing", () => {
    const settled = settle({ platforms: rowsRead(2), connectors: failed(true), datasources: failed(true), mcp: failed(true) }, at);
    expect(settled.phase).toBe("ready");
    expect(settled.rows).toHaveLength(2);
    expect(settled.failure).toBeNull();
  });

  it("is empty when the route answered with nothing in it, ahead of another name's 404", () => {
    const settled = settle({ platforms: { kind: "empty", path: platforms.paths[0] }, connectors: failed(true), datasources: failed(true), mcp: failed(true) }, at);
    expect(settled.phase).toBe("empty");
    expect(settled.rows).toHaveLength(0);
  });

  it("is denied when every channel read was refused or missing, and carries the request id", () => {
    const settled = settle({ platforms: failed(true), connectors: failed(true), datasources: rowsRead(3), mcp: failed(true) }, at);
    expect(settled.phase).toBe("denied");
    expect(settled.failure?.requestId).toBe("deny-1");
    expect(settled.rows).toHaveLength(0);
  });

  it("is error when something else went wrong, and is not mistaken for an empty list", () => {
    const settled = settle({ platforms: failed(false), connectors: failed(true), datasources: failed(true), mcp: failed(true) }, at);
    expect(settled.phase).toBe("error");
    expect(settled.failure?.requestId).toBe("err-1");
  });

  it("is error when the answer was not a list at all, never empty", () => {
    const settled = settle({ platforms: { kind: "shape" }, connectors: { kind: "shape" }, datasources: failed(true), mcp: failed(true) }, at);
    expect(settled.phase).toBe("error");
    expect(settled.failure?.sentence).toContain("不是一份接入清单");
  });

  it("reports a failure, not an empty list, when the cycle produced no outcome at all", () => {
    // The hook never calls `settle` before a read lands (it shows the skeleton
    // instead); this is the safe default should a cycle ever return empty.
    expect(settle({}, at).phase).toBe("error");
    expect(settle({}, null).ledger.every((row) => row.checkedAt === null)).toBe(true);
  });

  it("never shows a data row that no answer sent", () => {
    for (const reads of [{}, { platforms: failed(true), connectors: failed(true) }] as Record<string, SourceRead>[]) {
      const settled = settle(reads, at);
      if (settled.phase !== "ready") expect(settled.rows).toHaveLength(0);
    }
  });
});

describe("failure wording", () => {
  it("speaks in sentences, with no status number and no route", () => {
    const copy = readFailure(new Error("boom"), { status: 500, requestId: null, technical: "HTTP 500 /agent-api/api/channels" });
    expect(copy.sentence).toContain("出了错");
    expect(copy.sentence).not.toMatch(/500|agent-api|\/api\//);
    expect(readFailure(new Error("boom"), { status: 401, requestId: null, technical: null }).sentence).toContain("重新登录");
    expect(readFailure(new Error("boom"), { status: 429, requestId: null, technical: null }).sentence).toContain("太频繁");
    expect(readFailure(new Error("boom"), { status: 0, requestId: null, technical: null }).sentence).toContain("连不上");
    expect(readFailure(new Error("boom"), { status: 418, requestId: null, technical: null }).sentence).toBeTruthy();
  });

  it("says what a missing request id means", () => {
    expect(requestIdLine("abc123")).toBe("请求编号：abc123");
    expect(requestIdLine(null)).toContain("未记录编号");
  });
});

describe("the gateway summary is the real platform surface", () => {
  const platformsSource = SOURCES.find((source) => source.id === "platforms")!;
  const SUMMARY = {
    schema: "runtime.hermes.summary.v1",
    gateway: {
      status: "ok",
      updated_at: "2026-11-19T11:43:46.578965+00:00",
      platforms: {
        api_server: { state: "connected", needs_attention: false },
        feishu: { state: "connected", needs_attention: false, updated_at: "2026-11-19T09:10:00Z" },
        wecom: { state: "not_configured" },
        dead: { state: "disconnected", needs_attention: true },
      },
    },
  };

  it("finds the platform block and the gateway's own stamp", () => {
    expect(summaryPlatforms(SUMMARY)).toEqual(SUMMARY.gateway.platforms);
    expect(summaryStamp(SUMMARY)).toBe("2026-11-19T11:43:46.578965+00:00");
    expect(summaryPlatforms({ gateway: {} })).toBeNull();
    expect(summaryStamp({ gateway: {} })).toBeNull();
    expect(summaryPlatforms(null)).toBeNull();
  });

  it("turns each platform into one row with a Chinese name and kind", () => {
    const read = readSource(SUMMARY, platformsSource, "/agent-api/api/hermes-summary");
    expect(read.kind).toBe("rows");
    if (read.kind !== "rows") return;
    expect(read.path).toBe("/agent-api/api/hermes-summary");
    expect(read.declaredTotal).toBe(4);
    const byKey = new Map(read.rows.map((row) => [row.key, row]));
    const api = byKey.get("platforms:api_server")!;
    expect(api.name).toBe("API 服务");
    expect(api.kindLabel).toBe("接口服务");
    expect(api.platformStatus).toBe("available");
    expect(PLATFORM_STATUS_LABEL[api.platformStatus!]).toBe("正常");
    expect(byKey.get("platforms:feishu")!.name).toBe("飞书");
    expect(byKey.get("platforms:feishu")!.kindLabel).toBe("消息平台");
    expect(byKey.get("platforms:wecom")!.platformStatus).toBe("disabled");
    expect(PLATFORM_STATUS_LABEL[byKey.get("platforms:wecom")!.platformStatus!]).toBe("停用");
    expect(byKey.get("platforms:dead")!.platformStatus).toBe("unavailable");
    expect(PLATFORM_STATUS_LABEL[byKey.get("platforms:dead")!.platformStatus!]).toBe("未接入");
  });

  it("falls back to the gateway stamp, and says so instead of pretending it is per-platform", () => {
    const read = readSource(SUMMARY, platformsSource, "/agent-api/api/hermes-summary");
    if (read.kind !== "rows") throw new Error("expected rows");
    const byKey = new Map(read.rows.map((row) => [row.key, row]));
    const api = byKey.get("platforms:api_server")!;
    expect(api.lastSeen).toBe("2026-11-19T11:43:46.578965+00:00");
    expect(api.lastSeenNote).toContain("网关整体");
    // A platform that answered with its own instant keeps it, and needs no note.
    const feishu = byKey.get("platforms:feishu")!;
    expect(feishu.lastSeen).toBe("2026-11-19T09:10:00Z");
    expect(feishu.lastSeenNote ?? null).toBeNull();
  });

  it("never invents a credential state, and never carries a token", () => {
    expect(CREDENTIAL_LABEL.unknown).toBe("未知");
    expect(credentialOf(null).state).toBe("unknown");
    const bare = credentialOf({ state: "connected" });
    expect(bare.state).toBe("unknown");
    expect(bare.reason).toContain("不替它猜");
    expect(credentialOf({ credentialStatus: "configured" }).state).toBe("configured");
    expect(credentialOf({ credentials: "missing" }).state).toBe("missing");
    expect(credentialOf({ auth: "expired" }).state).toBe("missing");
    expect(credentialOf({ auth: "expired" }).reason).toContain("失效");
    expect(credentialOf({ tokenStatus: "hunter2" }).state).toBe("unknown");

    const read = readSource(SUMMARY, platformsSource, "/agent-api/api/hermes-summary");
    if (read.kind !== "rows") throw new Error("expected rows");
    for (const row of read.rows) {
      expect(row.credential).toBe("unknown");
      expect(row.credentialReason).toContain("凭据");
    }
    expect(JSON.stringify(read.rows)).not.toMatch(/hunter2|secret|api[_-]?key/i);
  });

  it("reads an unlisted state as 待核实 and an empty block as an empty answer", () => {
    expect(platformStatusOf("connected")).toBe("available");
    expect(platformStatusOf("disconnected")).toBe("unavailable");
    expect(platformStatusOf("not_configured")).toBe("disabled");
    expect(platformStatusOf("who_knows")).toBe("unknown");
    expect(PLATFORM_STATUS_LABEL.unknown).toBe("待核实");

    const odd = readSource(
      { gateway: { platforms: { mystery: { state: "who_knows" } }, updated_at: "2026-11-19T00:00:00Z" } },
      platformsSource,
      "/agent-api/api/hermes-summary",
    );
    if (odd.kind !== "rows") throw new Error("expected rows");
    expect(odd.rows[0].platformStatus).toBe("unknown");
    expect(odd.rows[0].name).toBe("mystery");
    expect(odd.rows[0].lastSeen).toBe("2026-11-19T00:00:00Z");

    expect(readSource({ gateway: { platforms: {} } }, platformsSource, "/agent-api/api/hermes-summary")).toEqual({
      kind: "empty",
      path: "/agent-api/api/hermes-summary",
    });
  });
});
