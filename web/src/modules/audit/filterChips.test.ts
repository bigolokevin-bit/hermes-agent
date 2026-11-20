import { describe, expect, it } from "vitest";

import { type AuditChip, UNRECOGNISED_FILTER_TITLE, type FilterChipsInput, filterChipsOf } from "./filterChips";
import { filterSeatMap, hasFilterSummary, type FilterSummaryInput } from "./filterSummary";

/**
 * audT — the chip row is not a second reading of the filters. These tests are
 * the proof of that: every chip's words must equal the seat the shared summary
 * line puts on screen, and a question the shared predicate calls worth handing
 * over must have a chip. The day either stops being true, the two surfaces
 * start telling one person two stories about the same address.
 */

const BASE: FilterChipsInput = {
  windowLabel: "最近 7 天",
  custom: false,
  fromBeijing: "",
  toBeijing: "",
  type: "",
  actor: "",
  resource: "",
  resourceNote: "本页已加载的记录里本地匹配，服务端 resourceId 效果未单独实测",
  page: 1,
  cursorCount: 0,
  askedPath: "/agent-api/api/audit?from=2026-11-13T00%3A00%3A00%2B08%3A00&to=2026-11-20T00%3A00%3A00%2B08%3A00&limit=50",
  limit: 50,
  defaultLimit: 50,
  rawWindow: "",
  typeKnown: true,
  rawLimit: "",
};

function chipsOf(over: Partial<FilterChipsInput>): AuditChip[] {
  return filterChipsOf({ ...BASE, ...over });
}

function keysOf(over: Partial<FilterChipsInput>): string[] {
  return chipsOf(over).map((chip) => chip.key);
}

const FULL: FilterSummaryInput & FilterChipsInput = {
  ...BASE,
  windowLabel: "最近 30 天",
  rawWindow: "30d",
  type: "approval_approved",
  actor: "user:2f3a4b5c6d7e8f90",
  resource: "ap_1122334455667788",
  limit: 25,
  page: 3,
  cursorCount: 2,
};

describe("audT - the chips say the summary line's own words", () => {
  it("leaves the row out entirely when nothing is on", () => {
    expect(chipsOf({})).toEqual([]);
    // The same address, as the shared predicate sees it: also not a question.
    expect(hasFilterSummary(BASE)).toBe(false);
  });

  it("takes each chip's words from the seat map the summary is built from", () => {
    const seats = filterSeatMap(FULL, "screen");
    const chips = chipsOf(FULL);
    const byKey = new Map(chips.map((chip) => [chip.key, chip.label]));
    expect(byKey.get("window")).toBe(seats.window);
    expect(byKey.get("action")).toBe(seats.type);
    expect(byKey.get("actor")).toBe(seats.actor);
    expect(byKey.get("resource")).toBe(seats.resource);
    expect(byKey.get("limit")).toBe(seats.limit);
    expect(byKey.get("page")).toBe(seats.page);
  });

  it("never contradicts the predicate that decides a question is worth sharing", () => {
    const variants: Partial<FilterChipsInput>[] = [
      { type: "approval_approved", typeKnown: true },
      { actor: "user:2f3a4b5c6d7e8f90" },
      { resource: "ap_1122334455667788" },
      { custom: true, fromBeijing: "2026-11-01 00:00:00", toBeijing: "2026-11-02 00:00:00", rawWindow: "custom" },
      { limit: 100 },
      { page: 2, cursorCount: 1 },
    ];
    for (const over of variants) {
      const input = { ...BASE, ...over };
      if (hasFilterSummary(input)) {
        expect(chipsOf(over).length, JSON.stringify(over)).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the order the filter bar shows the same choices in", () => {
    expect(keysOf(FULL)).toEqual(["window", "action", "actor", "resource", "limit", "page"]);
  });
});

describe("audT - one chip per question, not one per parameter", () => {
  it("puts the custom range's two instants on one chip that removes both", () => {
    const chips = chipsOf({
      custom: true,
      rawWindow: "custom",
      windowLabel: "自定义",
      fromBeijing: "2026-11-01 00:00:00",
      toBeijing: "2026-11-02 00:00:00",
    });
    expect(chips.map((chip) => chip.key)).toEqual(["from-to"]);
    expect(chips[0].params).toEqual(["window", "from", "to"]);
    expect(chips[0].label).toContain("2026-11-01 00:00:00");
    expect(chips[0].label).toContain("2026-11-02 00:00:00");
  });

  it("does not call the default window, the default size or page 1 a filter", () => {
    expect(keysOf({ rawWindow: "7d" })).toEqual([]);
    expect(keysOf({ rawWindow: "" })).toEqual([]);
    expect(keysOf({ rawWindow: "24h" })).toEqual(["window"]);
    expect(keysOf({ limit: 100 })).toEqual(["limit"]);
    expect(keysOf({ page: 2, cursorCount: 1 })).toEqual(["page"]);
  });

  it("keeps machine handles off the chip's face and in its title", () => {
    const chips = chipsOf({ actor: "user:2f3a4b5c6d7e8f90", resource: "ap_1122334455667788" });
    const words = chips.map((chip) => chip.label).join(" ");
    expect(words).not.toContain("user:2f3a4b5c6d7e8f90");
    expect(words).not.toContain("ap_1122334455667788");
    const titles = chips.map((chip) => chip.title).join(" ");
    expect(titles).toContain("user:2f3a4b5c6d7e8f90");
    expect(titles).toContain("ap_1122334455667788");
  });
});

describe("audT - what the address says that this panel cannot name", () => {
  it("prints an unknown window verbatim and says it was not recognised", () => {
    const chips = chipsOf({ rawWindow: "14d" });
    expect(chips.map((chip) => chip.key)).toEqual(["window"]);
    expect(chips[0].label).toBe("时间窗：14d");
    expect(chips[0].title).toContain(UNRECOGNISED_FILTER_TITLE);
    expect(chips[0].title).toContain("14d");
  });

  it("prints an unknown type code verbatim and says it was not recognised", () => {
    const chips = chipsOf({ type: "not_a_code", typeKnown: false });
    expect(chips[0].label).toBe("动作类型：not_a_code");
    expect(chips[0].title).toContain(UNRECOGNISED_FILTER_TITLE);
  });

  it("says a known type code is the server's exact match instead", () => {
    const chips = chipsOf({ type: "approval_approved", typeKnown: true });
    expect(chips[0].label).toBe(filterSeatMap({ ...BASE, type: "approval_approved" }, "screen").type);
    expect(chips[0].title).toContain("服务端按 action 精确匹配");
    expect(chips[0].title).not.toContain(UNRECOGNISED_FILTER_TITLE);
  });

  it("prints a size the panel will not ask for verbatim, and names the key it removes", () => {
    const chips = chipsOf({ rawLimit: "33" });
    expect(chips.map((chip) => chip.key)).toEqual(["limit"]);
    expect(chips[0].label).toBe("每页 33 条");
    expect(chips[0].title).toContain(UNRECOGNISED_FILTER_TITLE);
    expect(chips[0].params).toEqual(["limit"]);
  });
});
