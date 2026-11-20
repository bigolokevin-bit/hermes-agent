import { describe, expect, it } from "vitest";
import { derivePageScope, exportScopeNote } from "./pageScope";

describe("capability page scope", () => {
  it("says full rendering only when the read port has no page-size signal", () => {
    const scope = derivePageScope({ shown: 3 });
    expect(scope.mode).toBe("full");
    expect(scope.text).toBe("表内全量渲染，共 3 项");
    expect(scope.title).toContain("没有 total/nextCursor");
    expect(scope.title).toContain("不做前端截断");
  });

  it("shows the read-port page cap and upstream total without inferring", () => {
    const scope = derivePageScope({ shown: 20, total: 57, nextCursor: "cursor-2" });
    expect(scope.mode).toBe("capped");
    expect(scope.text).toBe("本页按读口单页上限显示 20 项，总数以读口回传为准");
    expect(scope.detail).toBe("共 57 项 / 已显示 20 项");
    expect(scope.title).toContain("不按已加载条数推算");
  });

  it("says total unavailable when paging exists without total", () => {
    const scope = derivePageScope({ shown: 20, nextCursor: "cursor-2" });
    expect(scope.mode).toBe("capped");
    expect(scope.detail).toContain("总数不可用");
    expect(scope.title).toContain("总数不可用");
    expect(scope.text).not.toContain("共 0 项");
  });

  it("never turns an unreadable port into a zero count", () => {
    const scope = derivePageScope({ shown: 0, unavailableReason: "技能读口未接入" });
    expect(scope.mode).toBe("unavailable");
    expect(scope.text).toBe("读口未接入，无法判断总数");
    expect(scope.text).not.toContain("0");
    expect(scope.title).toContain("不把空列表当 0 项");
  });
});

describe("export scope note", () => {
  it("says 全量 and never 已加载 when the list renders every received row", () => {
    const note = exportScopeNote(derivePageScope({ shown: 4 }));
    expect(note).toBe("本次导出为表内全量，共 4 项");
    expect(note).not.toContain("已加载");
  });

  it("says 已加载 and 不是全量 when the read port caps the page", () => {
    const note = exportScopeNote(derivePageScope({ shown: 20, total: 57, nextCursor: "cursor-2" }));
    expect(note).toBe("本次导出为当前已加载 20 项，读口回传总数 57 项，不是全量");
    expect(note).not.toContain("全量，共");
  });

  it("keeps the capped wording honest when paging exists without a total", () => {
    const note = exportScopeNote(derivePageScope({ shown: 20, nextCursor: "cursor-2" }));
    expect(note).toBe("本次导出为当前已加载 20 项，读口未回传总数，不是全量");
  });

  it("refuses to claim a total for an unreadable port or a loading list", () => {
    expect(exportScopeNote(derivePageScope({ shown: 3, unavailableReason: "工具读口未接入" }))).toBe(
      "读口未接入，无法判断总数；本次导出屏上 3 行，不代表全量",
    );
    expect(exportScopeNote(derivePageScope({ shown: 0, loading: true }))).toBe(
      "列表仍在读取，本次导出不代表任何总数",
    );
  });

  it("carries the same N the list caliber shows, so the two can never drift", () => {
    for (const shown of [0, 1, 12]) {
      expect(exportScopeNote(derivePageScope({ shown }))).toContain(`${shown} 项`);
      expect(exportScopeNote(derivePageScope({ shown, total: shown + 5 }))).toContain(`已加载 ${shown} 项`);
    }
  });
});
