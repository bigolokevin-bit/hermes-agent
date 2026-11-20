/**
 * audG — 筛选口径摘要的构造与安全边界。断言的是：字段序固定、缺项写「未设置」、
 * 页码用人类说法而不是裸游标、附带的是这一页实际请求的相对路径（无 origin、
 * 凭据形状的参数一律剥掉），以及「默认窗口不算有筛选」的口径。
 */
import { describe, expect, it } from "vitest";

import {
  FILTER_SUMMARY_EMPTY_TITLE,
  FILTER_SUMMARY_MISSING,
  filterSummaryLineOf,
  hasFilterSummary,
  safeRequestPath,
  type FilterSummaryInput,
} from "./filterSummary";

const BASE: FilterSummaryInput = {
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
  askedPath: "/agent-api/api/audit?limit=50&from=2026-11-12T00:00:00.000Z&to=2026-11-19T00:00:00.000Z",
};

describe("audG - the filter summary line", () => {
  it("keeps the seats of the filter bar, in order, and ends with the real path", () => {
    const line = filterSummaryLineOf({
      ...BASE,
      windowLabel: "最近 24 小时",
      type: "task.created",
      actor: "employee-api",
      resource: "ap_1122334455667788",
      page: 3,
      cursorCount: 2,
      askedPath: "/agent-api/api/audit?limit=50&action=task.created&actorId=employee-api&cursor=cur_page2",
    });
    expect(line).toBe(
      "时间窗：最近 24 小时 · 动作类型：task.created（服务端按 action 精确匹配） · 操作者：employee-api（服务端 actorId，机器句柄）" +
        " · 资源：ap_1122334455667788（本页已加载的记录里本地匹配，服务端 resourceId 效果未单独实测） · 第 3 页（游标 ×2）" +
        // audH added one seat: the size in force, next to the page it counts
        " · 每页 50 条 · 请求：/agent-api/api/audit?limit=50&action=task.created&actorId=employee-api&cursor=cur_page2",
    );
    // no bare cursor token, no origin, no http
    expect(line).not.toMatch(/https?:/);
    expect(line).toContain("游标 ×2");
  });

  it("says 未设置 for what nobody chose, and 自定义 with a missing half", () => {
    const bare = filterSummaryLineOf(BASE);
    expect(bare).toContain(`动作类型：${FILTER_SUMMARY_MISSING}`);
    expect(bare).toContain(`操作者：${FILTER_SUMMARY_MISSING}`);
    expect(bare).toContain(`资源：${FILTER_SUMMARY_MISSING}`);
    expect(bare).toContain("第 1 页（游标 ×0）");
    const half = filterSummaryLineOf({ ...BASE, custom: true, fromBeijing: "2026-11-17T09:00" });
    expect(half).toContain(`自定义 2026-11-17T09:00 → ${FILTER_SUMMARY_MISSING}（北京时间）`);
  });

  it("quotes a path with no origin and no credential-shaped parameter", () => {
    expect(safeRequestPath("https://console.example.test/agent-api/api/audit?limit=50&token=abc")).toBe(
      "/agent-api/api/audit?limit=50",
    );
    expect(safeRequestPath("/agent-api/api/audit?limit=50&access_token=x&session=y&code=z&from=1")).toBe(
      "/agent-api/api/audit?limit=50&from=1",
    );
    expect(safeRequestPath("/agent-api/api/audit?limit=50")).toBe("/agent-api/api/audit?limit=50");
    expect(safeRequestPath(null)).toBeNull();
    const line = filterSummaryLineOf({
      ...BASE,
      askedPath: "http://127.0.0.1:9122/agent-api/api/audit?limit=50&token=secret-value&type=x",
      type: "x",
    });
    expect(line).not.toContain("secret-value");
    expect(line).not.toContain("127.0.0.1");
    expect(line).not.toContain("token");
  });

  it("a non-default page size is part of the question worth handing over", () => {
    // audH: 「每页 25 条」 is a choice a person made, so the summary opens for it
    expect(hasFilterSummary({ ...BASE, limit: 25, defaultLimit: 50 })).toBe(true);
    expect(hasFilterSummary({ ...BASE, limit: 50, defaultLimit: 50 })).toBe(false);
    expect(filterSummaryLineOf({ ...BASE, limit: 25, defaultLimit: 50 })).toContain("每页 25 条");
  });

  it("the default window alone is not a question worth handing over", () => {
    expect(hasFilterSummary(BASE)).toBe(false);
    expect(hasFilterSummary({ ...BASE, custom: true })).toBe(true);
    expect(hasFilterSummary({ ...BASE, type: "task.created" })).toBe(true);
    expect(hasFilterSummary({ ...BASE, actor: "employee-api" })).toBe(true);
    expect(hasFilterSummary({ ...BASE, resource: "ap_1" })).toBe(true);
    expect(hasFilterSummary({ ...BASE, cursorCount: 1, page: 2 })).toBe(true);
    expect(FILTER_SUMMARY_EMPTY_TITLE).toBe("当前没有筛选条件可复制");
  });
});
