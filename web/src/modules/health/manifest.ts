/**
 * 系统健康真探针页（T30）。
 * PRD v4 Section 4.1 frozen #/system row / WBS T30: four services, unknown != healthy.
 */
import type { ModuleManifest } from "../../shell/registry";

const manifest: ModuleManifest = {
  module: "system",
  tabs: [{
    id: "health",
    label: "系统健康",
    route: "#/system",
    kind: "reuse",
    reuse: () => import("./HealthPage").then((m) => ({ default: m.HealthPage })),
    dataSource: "/api/hermes-summary + BFF/domain 真探针",
  }],
};

export default manifest;
