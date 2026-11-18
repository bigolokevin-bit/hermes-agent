/**
 * capabilities 平台·能力组 manifests — IA group 7/8 (PRD §3 rows 15-18).
 * skills/tools/models/channels link out to the native Hermes surfaces
 * (SkillsPage / McpPage / ModelsPage / ChannelsPage); the console panes stay
 * honest placeholders until each surface is embedded. models is an roView
 * denied target (§7) — handled shell-side, not here.
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'capabilities',
  tabs: [
    {
      id: 'skills',
      label: '技能',
      route: '#/capabilities',
      kind: 'reuse',
      group: 'capabilities',
      icon: 'Sparkles',
      reuse: () => import('../skills/SkillsPage').then((m) => ({ default: m.SkillsPage })),
      dataSource: '技能列表与技能详情接口',
    },
    {
      id: 'tools',
      label: '工具与 MCP',
      route: '#/capabilities?tab=tools',
      kind: 'reuse',
      group: 'capabilities',
      icon: 'Wrench',
      reuse: () => import('../tools/ToolsPage').then((m) => ({ default: m.ToolsPage })),
      dataSource: '工具与 MCP 服务（上游原生页面）',
    },
    {
      id: 'models',
      label: '模型与单价',
      route: '#/capabilities?tab=models',
      kind: 'reuse',
      group: 'capabilities',
      icon: 'Cpu',
      reuse: () => import('../models/ModelsModulePage').then((m) => ({ default: m.ModelsModulePage })),
      dataSource: '模型选项与单价（金额以计费台账为准）',
    },
    {
      id: 'channels',
      label: '平台接入',
      route: '#/capabilities?tab=channels',
      kind: 'planned',
      group: 'capabilities',
      icon: 'Radio',
      dataSource: '平台接入（上游原生页面）',
    },
  ],
};

export default manifest;
