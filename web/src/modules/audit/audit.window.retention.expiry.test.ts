// @vitest-environment node
// AU-03③ + ④ — the retention-expiry gate and the require_any / default-window
// consistency. Pure functions, one file, because the two laws are the same one
// question asked of a window: "is this a bounded question the service can
// answer, and is it inside the data the ledger still holds?"
//
// ③ LAW: the expiry gate reads the horizon ONLY from a value the ledger
// actually answered. `days === null` (every answer on this deployment — the
// retention read is 未接入, see the retention.ts header probe) → unknown,
// blocks nothing. There is NO default N, no 365, no 「大概是 7」. Only a range
// whose LATER end sits strictly before the horizon is expired.
//
// ④ LAW: the list route requires at least one of seven filters (`require_any`,
// re-probed 2026-11-24: `?limit=50` alone → HTTP 400). The frontend default is
// a BOUNDED quick window (DEFAULT_WINDOW="7d", choices 24h/7d/30d, no 「不限
// 时间」), so the default question always carries from+to and never 400s on its
// own; a custom range that is not yet complete issues no request at all.

import { describe, expect, it } from "vitest";

import { listUrl } from "./api";
import { expiryVerdict } from "./retention";
import {
  DEFAULT_WINDOW,
  FILTER_WINDOW_CHOICES,
  WINDOW_CHOICES,
  customBounds,
  windowBounds,
} from "./window";

describe("AU-03③ — the retention-expiry gate reads only a real horizon", () => {
  it("no horizon answered → unknown, and NOTHING is blocked (never a guessed N)", () => {
    const old = { from: "2000-01-01T00:00:00.000Z", to: "2000-02-01T00:00:00.000Z" };
    const verdict = expiryVerdict(old, null);
    expect(verdict.state).toBe("unknown");
    expect(verdict.days).toBeNull();
    expect(verdict.sentence).toBeNull();
    // the sentence is the ONLY thing that could say a number; it says none
    expect(JSON.stringify(verdict)).not.toMatch(/\b(7|30|365|180)\b/);
  });

  it("a range entirely before the horizon is expired, and names the real N", () => {
    const horizon = 30; // days
    // anchor well in the past relative to now (retention of 30 days)
    const past = new Date(Date.now() - 400 * 86_400_000).toISOString();
    const pastEnd = new Date(Date.now() - 380 * 86_400_000).toISOString();
    const verdict = expiryVerdict({ from: past, to: pastEnd }, horizon);
    expect(verdict.state).toBe("expired");
    expect(verdict.sentence).toBe("该时间窗超出保留期（30 天）");
    expect(verdict.horizonIso).not.toBeNull();
  });

  it("a partial overlap is NOT expired (its later end still holds retained rows)", () => {
    const horizon = 30;
    const from = new Date(Date.now() - 90 * 86_400_000).toISOString(); // before horizon
    const to = new Date().toISOString(); // now, inside the horizon
    expect(expiryVerdict({ from, to }, horizon).state).toBe("within");
  });

  it("a range inside the horizon is within", () => {
    const horizon = 30;
    const from = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const to = new Date(Date.now() - 1 * 86_400_000).toISOString();
    expect(expiryVerdict({ from, to }, horizon).state).toBe("within");
  });

  it("an unusable range is unknown even with a horizon (no instant, no claim)", () => {
    expect(expiryVerdict({ from: null, to: null }, 180).state).toBe("unknown");
    expect(expiryVerdict({ from: "not-a-time", to: "also-not" }, 180).state).toBe("unknown");
  });

  it("a zero/negative/NaN horizon is treated as not-answered, not as 0-day expiry", () => {
    const old = { from: "2000-01-01T00:00:00.000Z", to: "2000-02-01T00:00:00.000Z" };
    expect(expiryVerdict(old, 0).state).toBe("unknown");
    expect(expiryVerdict(old, -5).state).toBe("unknown");
    expect(expiryVerdict(old, Number.NaN).state).toBe("unknown");
  });
});

describe("AU-03④ — require_any gate and the frontend default window agree", () => {
  it("the default window is bounded and carries a legal from+to (no unbounded scan)", () => {
    const bounds = windowBounds(DEFAULT_WINDOW, new Date("2026-11-24T02:00:00Z"));
    expect(Date.parse(bounds.to)).toBeGreaterThan(Date.parse(bounds.from));
    const url = listUrl(null, { action: null, from: bounds.from, to: bounds.to });
    expect(url).toContain("&from=");
    expect(url).toContain("&to=");
    // require_any is satisfied by from alone — a default read never 400s
  });

  it("there is no 「不限时间」 choice — every offered window is a real filter", () => {
    expect(FILTER_WINDOW_CHOICES.some((choice) => choice.label === "不限时间")).toBe(false);
    for (const choice of WINDOW_CHOICES) {
      const bounds = windowBounds(choice.value, new Date("2026-11-24T02:00:00Z"));
      expect(Date.parse(bounds.from)).toBeLessThan(Date.parse(bounds.to));
    }
  });

  it("an incomplete custom range yields no bounds at all — so no request is issued", () => {
    expect(customBounds("2026-11-17T09:00", null)).toBeNull();
    expect(customBounds(null, "2026-11-17T10:30")).toBeNull();
    expect(customBounds("", "")).toBeNull();
    // the page treats null bounds as "do not ask" (see enabled=!customInvalid)
    // and the address window is never left unbounded (the route 400s `limit`-only):
    expect(listUrl(null, { action: null, from: null, to: null })).toBe("/agent-api/api/audit?limit=50");
  });

  it("the window-only read passes require_any because from is always sent", () => {
    for (const choice of WINDOW_CHOICES) {
      const bounds = windowBounds(choice.value);
      const url = listUrl(null, { action: null, from: bounds.from, to: bounds.to });
      const params = new URL(url, "http://console.local").searchParams;
      const hasAny = ["from", "to"].some((k) => params.has(k));
      expect(hasAny, choice.value).toBe(true);
    }
  });
});
