import { describe, expect, it } from "vitest";
import type { SourceRow } from "./sourceReads";
import {
  applySourceSort,
  ariaSourceSort,
  nextSourceSort,
  readSourceSort,
  sortSourceRows,
  type SourceSortState,
} from "./sourceSort";

function row(id: string, patch: Partial<SourceRow> = {}): SourceRow {
  return {
    id,
    label: id,
    path: `/${id}`,
    status: "ok",
    statusReason: null,
    durationMs: null,
    durationReason: null,
    asOf: null,
    asOfIso: null,
    asOfReason: null,
    requestId: null,
    ...patch,
  };
}

const defaultSort: SourceSortState = { key: "name", dir: "asc" };

describe("source matrix sorting", () => {
  it("defaults to name ascending and reads valid ssort/sdir values", () => {
    expect(readSourceSort("?tab=health", "")).toEqual(defaultSort);
    expect(readSourceSort("?ssort=ms&sdir=desc", "")).toEqual({ key: "ms", dir: "desc" });
    expect(readSourceSort("", "#/system?tab=health&ssort=state&sdir=asc")).toEqual({ key: "state", dir: "asc" });
    expect(readSourceSort("?ssort=bogus&sdir=up", "")).toEqual(defaultSort);
    expect(ariaSourceSort(defaultSort, "name")).toBe("ascending");
    expect(ariaSourceSort(defaultSort, "state")).toBe("none");
  });

  it("cycles a column asc → desc → default and keeps the URL clean by default", () => {
    const state = nextSourceSort(defaultSort, "asof");
    expect(state).toEqual({ key: "asof", dir: "asc" });
    const desc = nextSourceSort(state, "asof");
    expect(desc).toEqual({ key: "asof", dir: "desc" });
    expect(nextSourceSort(desc, "asof")).toEqual(defaultSort);

    const params = applySourceSort(new URLSearchParams("tab=health"), desc);
    expect(params.toString()).toBe("tab=health&ssort=asof&sdir=desc");
    expect(applySourceSort(params, defaultSort).toString()).toBe("tab=health");
  });

  it("ranks status, sorts elapsed numerically, and always puts missing values last", () => {
    const rows = [
      row("ok-1", { label: "乙", status: "ok", durationMs: 9 }),
      row("missing", { label: "缺", status: "idle", durationMs: null, asOfIso: "not-a-date" }),
      row("failed", { label: "甲", status: "failed", durationMs: 3 }),
      row("unwired", { label: "丙", status: "unwired", durationMs: 5, asOfIso: "2026-11-20T01:00:00Z" }),
      row("degraded", { label: "丁", status: "degraded", durationMs: 1, asOfIso: "2026-11-19T01:00:00Z" }),
    ];

    expect(sortSourceRows(rows, { key: "state", dir: "asc" }).map((r) => r.id))
      .toEqual(["ok-1", "degraded", "failed", "unwired", "missing"]);
    expect(sortSourceRows(rows, { key: "state", dir: "desc" }).map((r) => r.id))
      .toEqual(["unwired", "failed", "degraded", "ok-1", "missing"]);
    expect(sortSourceRows(rows, { key: "ms", dir: "asc" }).map((r) => r.id))
      .toEqual(["degraded", "failed", "unwired", "ok-1", "missing"]);
    expect(sortSourceRows(rows, { key: "ms", dir: "desc" }).map((r) => r.id))
      .toEqual(["ok-1", "unwired", "failed", "degraded", "missing"]);
    expect(sortSourceRows(rows, { key: "asof", dir: "asc" }).map((r) => r.id))
      .toEqual(["degraded", "unwired", "ok-1", "missing", "failed"]);
    expect(sortSourceRows(rows, { key: "asof", dir: "desc" }).map((r) => r.id))
      .toEqual(["unwired", "degraded", "ok-1", "missing", "failed"]);
  });
});