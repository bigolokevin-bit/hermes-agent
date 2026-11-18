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
      kind: 'planned',
      group: 'capabilities',
      icon: 'Sparkles',
      dataSource: '/api/skills /api/skills/<id>（已活）',
    },
    {
      id: 'tools',
      label: '工具与 MCP',
      route: '#/capabilities?tab=tools',
      kind: 'planned',
      group: 'capabilities',
      icon: 'Wrench',
      dataSource: 'Hermes /api/mcp/servers（原生面）',
    },
    {
      id: 'models',
      label: '模型与单价',
      route: '#/capabilities?tab=models',
      kind: 'planned',
      group: 'capabilities',
      icon: 'Cpu',
      dataSource: 'Hermes /api/model/options + SEAKOI_MODEL_PRICING_FILE；金额以 ledger 为准',
    },
    {
      id: 'channels',
      label: '平台接入',
      route: '#/capabilities?tab=channels',
      kind: 'planned',
      group: 'capabilities',
      icon: 'Radio',
      dataSource: 'Hermes /api/platforms（原生）',
    },
  ],
};

export default manifest;
