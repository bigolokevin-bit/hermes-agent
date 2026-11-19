/**
 * 默认设置只读页（T31 / SET-01）。
 * PRD v4 Section 4.1 defaults row / WBS T31: unknown switches, no write controls.
 */
import type { ModuleManifest } from "../../shell/registry";

const manifest: ModuleManifest = {
  module: "system",
  tabs: [{
    id: "defaults",
    label: "默认设置",
    route: "#/system?tab=defaults",
    kind: "reuse",
    reuse: () => import("./SettingsPage").then((m) => ({ default: m.SettingsPage })),
    dataSource: "SET-01 基线（CR-M2-02 未落地）；运行时 /api/config schema 内",
  }],
};

export default manifest;
