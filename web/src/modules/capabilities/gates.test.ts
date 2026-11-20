import { describe, expect, it } from "vitest";

import { deriveGates, type GateInput } from "./gates";

const base: GateInput = {
  phase: "ready",
  reason: null,
  requestId: null,
  gap: null,
  rowsLoaded: 2,
  rowsVisible: 2,
  hasQuery: false,
};

const blocked = (input: GateInput) => deriveGates(input);

describe("capability action gates", () => {
  it("blocks all six entries while the read is loading", () => {
    const gates = blocked({ ...base, phase: "loading", rowsLoaded: 0, rowsVisible: 0 });
    for (const gate of Object.values(gates)) {
      expect(gate.enabled).toBe(false);
      expect(gate.title).toContain("正在读取当前列表");
    }
    expect(gates.export.count).toBe("—");
    expect(gates.copy.count).toBe("—");
  });

  it("uses one not-wired sentence for denied, with the GAP id only in the title", () => {
    const gates = blocked({
      ...base,
      phase: "denied",
      reason: "技能读口未接入：上游接口还没有接入，或当前账号无权查看。",
      gap: "GAP-SKL4-01",
      rowsLoaded: 0,
      rowsVisible: 0,
    });
    for (const gate of Object.values(gates)) {
      expect(gate.enabled).toBe(false);
      expect(gate.title).toContain("读口未接入");
      expect(gate.title).toContain("GAP-SKL4-01");
      expect(gate.title).not.toContain("技能读口未接入：技能读口未接入");
    }
    expect(gates.export.title).toBe(gates.copy.title);
    expect(gates.search.title).toBe(gates.export.title);
  });

  it("blocks every entry on a failed read and keeps the request id in the title", () => {
    const gates = blocked({
      ...base,
      phase: "error",
      reason: "数据服务暂时没有响应，请稍后重试。",
      requestId: "req-gates-9",
      rowsLoaded: 0,
      rowsVisible: 0,
    });
    for (const gate of Object.values(gates)) {
      expect(gate.enabled).toBe(false);
      expect(gate.title).toContain("读取失败");
      expect(gate.title).toContain("req-gates-9");
    }
  });

  it("keeps sort usable on a true empty list while export and copy are disabled", () => {
    const gates = blocked({ ...base, phase: "empty", rowsLoaded: 0, rowsVisible: 0 });
    expect(gates.counts.enabled).toBe(true);
    expect(gates.search.enabled).toBe(false);
    expect(gates.search.title).toBe("当前没有可搜索的条目。");
    expect(gates.export.enabled).toBe(false);
    expect(gates.copy.enabled).toBe(false);
    expect(gates.export.title).toBe("当前没有可导出的条目。");
    expect(gates.copy.title).toBe("当前没有可导出的条目。");
    expect(gates.export.count).toBe("0 条");
    expect(gates.copy.count).toBe("0 条");
    expect(gates.sort.enabled).toBe(true);
    expect(gates.rowDetail.enabled).toBe(false);
  });

  it("keeps totals and sort on, search recoverable, and outputs off when a search has no match", () => {
    const gates = blocked({ ...base, phase: "no-match", rowsLoaded: 2, rowsVisible: 0, hasQuery: true });
    expect(gates.counts.enabled).toBe(true);
    expect(gates.search.enabled).toBe(true);
    expect(gates.search.title).toContain("修改或清空搜索词");
    expect(gates.export.enabled).toBe(false);
    expect(gates.copy.enabled).toBe(false);
    expect(gates.export.title).toBe("当前没有可导出的条目。");
    expect(gates.sort.enabled).toBe(true);
    expect(gates.rowDetail.enabled).toBe(false);
  });

  it("enables all six entries for a ready non-empty view", () => {
    const gates = blocked(base);
    for (const gate of Object.values(gates)) expect(gate.enabled).toBe(true);
    expect(gates.export.count).toBe("2 条");
    expect(gates.copy.count).toBe("2 条");
    expect(gates.export.title).toContain("导出当前视图 2 条");
    expect(gates.copy.title).toContain("不会再发请求");
  });

  it("still enables sort when the ready payload happens to have zero rows", () => {
    const gates = blocked({ ...base, rowsLoaded: 0, rowsVisible: 0 });
    expect(gates.counts.enabled).toBe(true);
    expect(gates.search.enabled).toBe(false);
    expect(gates.export.enabled).toBe(false);
    expect(gates.sort.enabled).toBe(true);
    expect(gates.rowDetail.enabled).toBe(false);
  });

  it("lets counts report a partial source while keeping row actions usable", () => {
    const gates = blocked({ ...base, partialCounts: "1 个来源未接入，无法给出完整计数。" });
    expect(gates.counts.enabled).toBe(false);
    expect(gates.counts.title).toContain("1 个来源未接入");
    expect(gates.export.enabled).toBe(true);
    expect(gates.sort.enabled).toBe(true);
    expect(gates.rowDetail.enabled).toBe(true);
  });
});
