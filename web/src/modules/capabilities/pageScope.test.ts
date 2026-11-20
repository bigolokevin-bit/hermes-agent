import { describe, expect, it } from "vitest";
import { derivePageScope } from "./pageScope";

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
