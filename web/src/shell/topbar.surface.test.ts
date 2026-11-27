// 顶栏面包屑的**行为**用例（不是源码契约）：同一分区两种地址形制必须给出同一读数，
// 非法分区值不得被当成一个分区。锁的是 `consoleSurface` 的纯函数输出。
import { describe, expect, it } from "vitest";

import { consoleSurface } from "./TopBar";

const detail = "/employees/emp_217A91BA995044DFBB3E2E940B";

describe("consoleSurface · 分区读数", () => {
  it("模块页只有分组一段，标题是模块名", () => {
    const s = consoleSurface("/employees", "")!;
    expect(s.trail.map((c) => c.label)).toEqual(["运营"]);
    expect(s.title).toBe("数字员工");
  });

  it("裸详情落工作台层级：末段是员工详情，标题也是员工详情", () => {
    const s = consoleSurface(detail, "")!;
    expect(s.trail.map((c) => c.label)).toEqual(["运营", "数字员工"]);
    expect(s.title).toBe("员工详情");
    expect(s.trail[1].to).toBe("/employees");
  });

  it("路径段形制与查询串形制给出同一分区读数", () => {
    const byPath = consoleSurface(`${detail}/config`, "")!;
    const byQuery = consoleSurface(detail, "?zone=config")!;
    expect(byPath.title).toBe("配置");
    expect(byQuery.title).toBe("配置");
    expect(byQuery.trail.map((c) => c.label)).toEqual(byPath.trail.map((c) => c.label));
    expect(byPath.trail.at(-1)!.to).toBe(detail);
  });

  it("非法分区值不冒充分区，落回工作台层级", () => {
    const s = consoleSurface(detail, "?zone=not-a-zone")!;
    expect(s.title).toBe("员工详情");
    expect(s.trail.map((c) => c.label)).toEqual(["运营", "数字员工"]);
  });

  it("五个分区各自有中文名，且末段都指回该员工", () => {
    const zones = ["workbench", "config", "tasks", "runs", "evidence"];
    const titles = zones.map((z) => consoleSurface(detail, `?zone=${z}`)!.title);
    expect(titles).toEqual(["员工详情", "配置", "任务", "运行", "证据"]);
  });
});
