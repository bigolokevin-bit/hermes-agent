/**
 * 构建版本只读页（T32）。
 * PRD v4 Section 3 row 21 / WBS T32: build-injected identity and dependency versions.
 */
import type { ModuleManifest } from "../../shell/registry";

const manifest: ModuleManifest = {
  module: "system",
  tabs: [{
    id: "version",
    label: "版本",
    route: "#/system?tab=version",
    kind: "reuse",
    reuse: () => import("./VersionPage").then((m) => ({ default: m.VersionPage })),
    dataSource: "构建产物注入",
  }],
};

export default manifest;
