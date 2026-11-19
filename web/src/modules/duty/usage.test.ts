// @vitest-environment node
// T11 pure layer — the rules the usage read is taken through. No component,
// no DOM: these pin that the three windows build three different URLs
// (days=1/7/30), that money only ever reads the ledger verbatim (a true zero
// is `$0.00`, a gap is 「—」 with its reason, an estimate never becomes
// spent money), that raw wire values stay out of human copy, and that a
// 403 and a 404 are the same door.

import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api-error";

import {
  DEFAULT_USAGE_WINDOW,
  GAP,
  USAGE_PATH,
  USAGE_WINDOWS,
  costCell,
  failureInfo,
  forcedStateOf,
  hasAnySignal,
  isDenied,
  parseUsage,
  readFailure,
  requestIdLine,
  shapeFailure,
  usageUrl,
  windowLabel,
} from "./usage";

describe("usage window filter — real controls, real parameters", () => {
  it("keeps the /api/ segment on the route", () => {
    expect(USAGE_PATH).toBe("/agent-api/api/hermes-usage");
  });

  it("each window builds its own URL — that is what makes the filter real", () => {
    expect(usageUrl("24h")).toBe("/agent-api/api/hermes-usage?days=1");
    expect(usageUrl("7d")).toBe("/agent-api/api/hermes-usage?days=7");
    expect(usageUrl("30d")).toBe("/agent-api/api/hermes-usage?days=30");
    // three distinct URLs, one per control
    const built = USAGE_WINDOWS.map((item) => usageUrl(item.key));
    expect(new Set(built).size).toBe(3);
  });

  it("labels the windows in human words and defaults to 30 days", () => {
    expect(windowLabel("24h")).toBe("最近 24 小时");
    expect(windowLabel("7d")).toBe("最近 7 天");
    expect(windowLabel("30d")).toBe("最近 30 天");
    expect(DEFAULT_USAGE_WINDOW).toBe("30d");
  });
});

describe("ledger money — the only allowed path to a cost number", () => {
  it("shows a true zero as $0.00", () => {
    const cell = costCell(0, "upstream", "cost_ledger");
    expect(cell.text).toBe("$0.00");
    expect(cell.reason).toBeNull();
  });

  it("shows a real charge verbatim", () => {
    expect(costCell(1284.42, "upstream", "cost_ledger").text).toBe("$1,284.42");
  });

  it("a missing amount is 「—」 with a reason, never 0.00", () => {
    const cell = costCell(null, "upstream", "cost_ledger");
    expect(cell.text).toBe("—");
    expect(cell.reason).toContain("账本未提供金额");
  });

  it("an unpriced row is 「—」 with its own reason", () => {
    const cell = costCell(null, "unknown", "cost_ledger");
    expect(cell.text).toBe("—");
    expect(cell.reason).toBe("账本记为未计价");
    expect(cell.statusLabel).toBe("未计价");
  });

  it("estimated money never presents as a spent amount", () => {
    for (const status of ["estimated", "mixed"]) {
      const cell = costCell(999.99, status, "cost_ledger");
      expect(cell.text).toBe("—");
      expect(cell.reason).toContain("估算");
    }
  });

  it("a non-ledger source is withheld even when it carries a number", () => {
    const cell = costCell(50, "upstream", "unit_price_table");
    expect(cell.text).toBe("—");
    expect(cell.reason).toContain("不是成本账本");
  });

  it("an unrecognised status word reads 「—」, never a guess", () => {
    const cell = costCell(10, "pending_recheck", "cost_ledger");
    expect(cell.statusLabel).toBe("—");
    expect(cell.text).toBe("$10.00");
  });

  it("keeps raw values for the technical layer only", () => {
    const cell = costCell(1284.42, "upstream", "cost_ledger");
    expect(cell.technical.join("；")).toContain("cost_ledger");
    expect(cell.technical.join("；")).toContain("upstream");
  });
});

/** Unwrap a successful parse; a shape result must never reach these legs. */
function readOf(body: unknown) {
  const parsed = parseUsage(body);
  if (parsed.kind === "shape") throw new Error("expected a usage object, got a shape failure");
  return parsed.read;
}

describe("parsing the answer defensively", () => {
  it("an answer that is not an object is a shape failure, not an empty ledger", () => {
    expect(parseUsage("plain text")).toEqual({ kind: "shape" });
    expect(parseUsage(null)).toEqual({ kind: "shape" });
    expect(parseUsage([1, 2])).toEqual({ kind: "shape" });
  });

  it("reads tokens, models, ledger rows and the as-of instant", () => {
    const read = readOf({
      period_days: 30,
      tokens: { total_input: 1000, total_output: 200, total_cache_read: 50 },
      by_model: [{ model: "claude-sonnet-4", input_tokens: 1000, output_tokens: 200 }],
      cost: {
        source: "cost_ledger",
        cost_usd: 12.5,
        cost_status: "upstream",
        rows: 7,
        per_employee: [{ employee_id: "employee:1a2b3c4d5e6f7081", cost_usd: 3.25, cost_status: "upstream", rows: 2 }],
      },
      as_of: "2026-11-19T01:20:00Z",
    });
    expect(read.tokens.input).toBe(1000);
    expect(read.models[0]?.output).toBe(200);
    expect(read.cost?.cell.text).toBe("$12.50");
    expect(read.cost?.rows[0]?.code).toBe("员工 · 1A2B3C4D");
    expect(read.cost?.rows[0]?.rawId).toBe("employee:1a2b3c4d5e6f7081");
    // Beijing wall clock to the minute; the ISO original kept only as `raw`.
    expect(read.asOf?.shown).toBe("2026-11-19 09:20");
    expect(read.asOf?.raw).toBe("2026-11-19T01:20:00Z");
    expect(hasAnySignal(read)).toBe(true);
  });

  it("masks the employee handle so no raw id reaches the screen", () => {
    const read = readOf({
      cost: { per_employee: [{ employee_id: "emp_zzz9", cost_usd: 1, cost_status: "upstream" }] },
    });
    expect(read.cost?.rows[0]?.code).toBe("员工 · ZZZ9");
    expect(read.cost?.rows[0]?.code).not.toContain("emp_");
  });

  it("counts rows it cannot attribute instead of drawing them", () => {
    const read = readOf({
      by_model: [{ model: "ok-model" }, { noise: 1 }],
      cost: { per_employee: [{ employee_id: "employee:aa11" }, {}, null] },
    });
    expect(read.models).toHaveLength(1);
    expect(read.unreadableModels).toBe(1);
    expect(read.cost?.rows).toHaveLength(1);
    expect(read.cost?.unreadableRows).toBe(2);
  });

  it("an answer with no readable block is empty, not a zero-painted ready", () => {
    const read = readOf({});
    expect(hasAnySignal(read)).toBe(false);
    expect(read.cost).toBeNull();
    expect(read.asOf).toBeNull();
  });

  it("an unparseable as-of never leaks its raw text", () => {
    const read = readOf({ as_of: "not-a-time" });
    expect(read.asOf).toBeNull();
  });

  it("a NaN cost is a missing amount, not $NaN", () => {
    const read = readOf({ cost: { cost_usd: Number.NaN, cost_status: "upstream", source: "cost_ledger" } });
    expect(read.cost?.cell.text).toBe("—");
    expect(read.cost?.cell.technical.join("；")).not.toContain("NaN");
  });
});

describe("failures and repro legs", () => {
  it("403 and 404 are one body; anything else is not", () => {
    expect(isDenied(403)).toBe(true);
    expect(isDenied(404)).toBe(true);
    expect(isDenied(500)).toBe(false);
    expect(isDenied(401)).toBe(false);
  });

  it("the sentence layer never repeats engineering values", () => {
    for (const status of [0, 400, 401, 429, 500, 503, 418]) {
      const err = new ApiError("upstream said: boom", {
        status,
        body: '{"detail":"upstream said: boom"}',
        url: "/agent-api/api/hermes-usage?days=30",
        requestId: "req-usg",
      });
      const copy = readFailure(err, failureInfo(err));
      expect(copy.sentence).toBeTruthy();
      expect(copy.sentence).not.toContain("HTTP");
      expect(copy.sentence).not.toContain("boom");
      expect(copy.sentence).not.toContain("hermes-usage");
      expect(copy.requestId).toBe("req-usg");
      expect(copy.technical).toContain(String(status));
    }
  });

  it("a transport failure keeps the request id honest", () => {
    const err = new ApiError("unreachable", { status: 0, body: "", url: "/agent-api/api/hermes-usage?days=30" });
    const copy = readFailure(err, failureInfo(err));
    expect(copy.requestId).toBeNull();
    expect(requestIdLine(null)).toContain("未记录编号");
    expect(requestIdLine("req-1")).toBe("请求编号：req-1");
  });

  it("an answer that is not a usage object is a named failure", () => {
    expect(shapeFailure().sentence).toContain("不是");
  });

  it("only the four honest legs are reproducible — never a fake ready", () => {
    expect(forcedStateOf("loading")).toBe("loading");
    expect(forcedStateOf("empty")).toBe("empty");
    expect(forcedStateOf("error")).toBe("error");
    expect(forcedStateOf("denied")).toBe("denied");
    expect(forcedStateOf("ready")).toBeNull();
    expect(forcedStateOf("nope")).toBeNull();
    expect(forcedStateOf(null)).toBeNull();
  });

  it("the repro legs travel with the GAP number", () => {
    expect(GAP).toBe("GAP-07");
  });
});
