// /capabilities 四页的挂载入口。
//
// App.tsx 的四个 live 槽直接按名字取用这四个组件（CapSkillsConsolePage 等变量名
// 保持不变，只换 import 目标）。四个 pane 都由外壳提供 tab 条与全页唯一的 h1，
// 这里只画页内副行、卡与表。
import "./panes.css";

export { CapSkillsPane } from "./SkillsPane";
export { CapToolsPane } from "./ToolsPane";
export { CapModelsPane } from "./ModelsPane";
export { CapChannelsPane } from "./ChannelsPane";