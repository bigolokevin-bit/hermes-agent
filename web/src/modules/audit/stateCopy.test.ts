/**
 * audF — 四态的单一文案源。断言的是标签表本身、标记命名，以及「读口未接入」
 * 与「该条件下无事件」的判别：404 且服务点名「这条路由不存在」才算未接入，
 * 403 与被拒的 404 仍是同一句话（未接入的原因只进 title 与标记）。
 */
import { describe, expect, it } from "vitest";

import { STATE_LABEL, stateMark, unwiredReasonFor, type StatePhase } from "./stateCopy";

describe("audF - one state table for three surfaces", () => {
  it("gives every phase exactly one label", () => {
    const phases: StatePhase[] = ["loading", "empty", "unwired", "error", "denied"];
    const labels = phases.map((phase) => STATE_LABEL[phase]);
    expect(new Set(labels).size).toBe(labels.length);
    expect(STATE_LABEL.empty).toBe("该条件下无事件");
    expect(STATE_LABEL.unwired).toBe("这个读口在本环境未接入");
    expect(STATE_LABEL.error).toBe("读取没有完成");
    expect(STATE_LABEL.denied).toBe("暂时无法查看审计事件");
    expect(STATE_LABEL.loading).toBe("正在读取");
  });

  it("names its marks after the surface and the phase", () => {
    expect(stateMark("list", "error")).toBe("audF-state-list-error");
    expect(stateMark("preview", "denied")).toBe("audF-state-preview-denied");
    expect(stateMark("detail", "loading")).toBe("audF-state-detail-loading");
    expect(stateMark("verify", "unwired")).toBe("audF-state-verify-unwired");
  });

  it("calls a route 未接入 only when the answer says the route is missing", () => {
    expect(unwiredReasonFor(404, '{"code":"console.unknown_route"}')).toContain("读口未接入");
    expect(unwiredReasonFor(404, "static asset not found")).toContain("读口未接入");
    // 403 is a closed door, not a missing one; a record-level 404 is neither
    expect(unwiredReasonFor(403, '{"code":"console.forbidden"}')).toBeNull();
    expect(unwiredReasonFor(404, '{"code":"audit.event_not_found"}')).toBeNull();
    expect(unwiredReasonFor(null, null)).toBeNull();
    expect(unwiredReasonFor(500, "boom")).toBeNull();
  });

  it("the two empties are two different statements", () => {
    expect(STATE_LABEL.empty).not.toBe(STATE_LABEL.unwired);
    expect(STATE_LABEL.unwired).toContain("未接入");
    expect(STATE_LABEL.empty).toContain("无事件");
  });
});
