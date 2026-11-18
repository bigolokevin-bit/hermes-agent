/**
 * 工具与 MCP 只读连接状态页（T27）。
 * PRD Section 3 row 16 / WBS T27: visible unavailable rows and honest fallback (GAP-04).
 */
import type { ModuleManifest } from "../../shell/registry";

const manifest: ModuleManifest = {
  module: "capabilities",
  tabs: [{
    id: "tools",
    label: "工具与 MCP",
    route: "#/capabilities?tab=tools",
    kind: "reuse",
    reuse: () => import("./ToolsPage").then((m) => ({ default: m.ToolsPage })),
    dataSource: "Hermes /api/mcp/servers（原生面）",
  }],
};

export default manifest;
