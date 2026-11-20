import { describe, expect, it } from "vitest";
import { applySort, ariaSort, cycleSort, readSort, sortRows } from "./sorting";

describe("capability sorting", () => {
  it("reads only known sort keys and directions", () => {
    expect(readSort(new URLSearchParams("sort=name&dir=desc"))).toEqual({ key: "name", dir: "desc" });
    expect(readSort(new URLSearchParams("sort=updated"))).toEqual({ key: "updated", dir: "asc" });
    expect(readSort(new URLSearchParams("sort=bogus&dir=desc"))).toEqual({ key: null, dir: "asc" });
    expect(readSort(new URLSearchParams(""))).toEqual({ key: null, dir: "asc" });
  });

  it("cycles none to ascending to descending and back", () => {
    let state = readSort(new URLSearchParams(""));
    state = cycleSort(state, "name");
    expect(state).toEqual({ key: "name", dir: "asc" });
    state = cycleSort(state, "name");
    expect(state).toEqual({ key: "name", dir: "desc" });
    state = cycleSort(state, "name");
    expect(state).toEqual({ key: null, dir: "asc" });
    expect(ariaSort(state, "name")).toBe("none");
    const params = applySort(new URLSearchParams("q=x&sort=name&dir=desc"), { key: null, dir: "asc" });
    expect(params.toString()).toBe("q=x");
  });

  it("keeps missing values last in both directions and ties in ledger order", () => {
    const rows = [
      { id: "1", name: "B" },
      { id: "2", name: null },
      { id: "3", name: "A" },
      { id: "4", name: "A" },
    ];
    const pick = (row: { name: string | null }) => row.name;
    expect(sortRows(rows, { key: "name", dir: "asc" }, pick).map((row) => row.id)).toEqual(["3", "4", "1", "2"]);
    expect(sortRows(rows, { key: "name", dir: "desc" }, pick).map((row) => row.id)).toEqual(["1", "3", "4", "2"]);
    expect(rows.map((row) => row.id)).toEqual(["1", "2", "3", "4"]);
  });
});