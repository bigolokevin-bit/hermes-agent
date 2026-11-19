/**
 * 工具与 MCP 只读连接状态页（T27）。
 * PRD Section 3 row 16 / WBS T27: 不可用与状态未说明的连接留在表上（写灰 + 原因），
 * 读取失败如实报错，绝不回落成示例行；数据源尚未接进本控制台（GAP-04）。
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
