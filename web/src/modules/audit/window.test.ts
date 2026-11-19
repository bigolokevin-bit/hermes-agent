import { describe, expect, it } from "vitest";
import {
  CUSTOM_WINDOW_LABEL,
  DEFAULT_WINDOW,
  FILTER_WINDOW_CHOICES,
  beijingInputValue,
  customBounds,
  filterWindowOf,
  parseBeijingInput,
  windowBounds,
} from "./window";

describe("the audit window (R34)", () => {
  it("offers the three fixed windows plus one custom entry", () => {
    expect(FILTER_WINDOW_CHOICES.map((choice) => choice.value)).toEqual(["24h", "7d", "30d", "custom"]);
    expect(FILTER_WINDOW_CHOICES.at(-1)?.label).toBe(CUSTOM_WINDOW_LABEL);
    expect(FILTER_WINDOW_CHOICES.some((choice) => choice.label === "不限时间")).toBe(false);
  });

  it("reads the window from the address and falls back to the honest default", () => {
    expect(filterWindowOf("24h")).toBe("24h");
    expect(filterWindowOf("30d")).toBe("30d");
    expect(filterWindowOf("custom")).toBe("custom");
    expect(filterWindowOf(null)).toBe(DEFAULT_WINDOW);
    expect(filterWindowOf("")).toBe(DEFAULT_WINDOW);
    expect(filterWindowOf("all")).toBe(DEFAULT_WINDOW);
  });

  it("round-trips a Beijing wall clock value for a datetime-local control", () => {
    expect(beijingInputValue("2026-11-17T01:00:00.000Z")).toBe("2026-11-17T09:00");
    expect(beijingInputValue("2026-11-17T18:31:07.884Z")).toBe("2026-11-18T02:31");
    expect(beijingInputValue(null)).toBe("");
    expect(beijingInputValue("not-a-time")).toBe("");

    expect(parseBeijingInput("2026-11-17T09:00")).toBe("2026-11-17T01:00:00.000Z");
    expect(parseBeijingInput("2026-11-17T09:00:00")).toBe("2026-11-17T01:00:00.000Z");
    expect(parseBeijingInput("")).toBeNull();
    expect(parseBeijingInput("not-a-time")).toBeNull();
  });

  it("keeps a fixed window bounded and refuses an impossible custom range", () => {
    const bounds = windowBounds("24h", new Date("2026-11-19T02:00:00Z"));
    expect(Date.parse(bounds.to) - Date.parse(bounds.from)).toBe(24 * 3_600_000);

    expect(customBounds("2026-11-17T09:00", "2026-11-17T10:30")).toEqual({
      from: "2026-11-17T01:00:00.000Z",
      to: "2026-11-17T02:30:00.000Z",
    });
    // half filled, unparseable, or the wrong way round: nothing to ask for.
    // the address carries ISO instants, the control carries Beijing wall clock:
    // both spellings mean the same range.
    expect(customBounds("2026-11-17T01:00:00.000Z", "2026-11-17T02:30:00.000Z")).toEqual({
      from: "2026-11-17T01:00:00.000Z",
      to: "2026-11-17T02:30:00.000Z",
    });
    expect(customBounds("2026-11-17T09:00", "2026-11-17T02:30:00.000Z")).toEqual({
      from: "2026-11-17T01:00:00.000Z",
      to: "2026-11-17T02:30:00.000Z",
    });
    expect(customBounds("2026-11-17T09:00", null)).toBeNull();
    expect(customBounds(null, "2026-11-17T10:30")).toBeNull();
    expect(customBounds("", "")).toBeNull();
    expect(customBounds("2026-11-17T10:30", "2026-11-17T09:00")).toBeNull();
    expect(customBounds("2026-11-17T09:00", "2026-11-17T09:00")).toBeNull();
  });
});