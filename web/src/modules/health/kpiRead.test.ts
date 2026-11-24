import { describe, expect, it } from "vitest";
import { EMPTY_KPI, readHealthKpi } from "./kpiRead";

const SUMMARY = {
  gateway: {
    status: "ok",
    gateway_state: "running",
    version: "unknown",
    active_agents: 3,
    updated_at: "2026-11-24T07:00:00.000000+00:00",
  },
  system: { memory: { used: 512 * 1024 * 1024, total: 1024 * 1024 * 1024, percent: 50 } },
};

describe("readHealthKpi", () => {
  it("reads the four cells off one hermes-summary payload", () => {
    const kpi = readHealthKpi(SUMMARY);
    expect(kpi.gateway).toBe("在线");
    expect(kpi.agents).toBe(3);
    expect(kpi.memoryPercent).toBe(50);
    expect(kpi.memoryUsedMb).toBe(512);
    expect(kpi.memoryTotalMb).toBe(1024);
    expect(kpi.asOf).toBe("2026-11-24T07:00:00.000000+00:00");
  });

  it("never upgrades a missing status word into 在线", () => {
    expect(readHealthKpi({ gateway: { status: "down" } }).gateway).toBe("离线");
    expect(readHealthKpi({ gateway: { gateway_state: "draining" } }).gateway).toBe("排空中");
    expect(readHealthKpi({ gateway: {} }).gateway).toBeNull();
  });

  it("keeps a null memory reading as null (rendered 一, never 0)", () => {
    const kpi = readHealthKpi({ gateway: { status: "ok" }, system: { memory: { used: null, total: null, percent: null } } });
    expect(kpi.memoryPercent).toBeNull();
    expect(kpi.memoryUsedMb).toBeNull();
    expect(kpi.memoryTotalMb).toBeNull();
  });

  it("drops the upstream 'unknown' version instead of printing it", () => {
    expect(readHealthKpi(SUMMARY).gatewayDetail).toBe("running");
  });

  it("returns the empty shape for junk payloads rather than throwing", () => {
    for (const junk of [null, undefined, "x", 7, [], { gateway: "x" }]) {
      expect(readHealthKpi(junk)).toEqual(EMPTY_KPI);
    }
  });
});