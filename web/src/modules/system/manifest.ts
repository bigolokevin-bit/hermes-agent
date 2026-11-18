/**
 * system 系统组 manifests — IA group 8/8 (PRD §3 rows 19-22).
 * health is live (hermes-summary + probes); defaults is a roView denied
 * target (§7, shell-side); version comes from build injection; events is
 * the audit ledger. None of these mount a chat host.
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'system',
  tabs: [
    {
      id: 'health',
      label: '系统健康',
      route: '#/system',
      kind: 'reuse',
      group: 'system',
      icon: 'HeartPulse',
      reuse: () => import('../health/HealthPage').then((m) => ({ default: m.HealthPage })),
      dataSource: '系统摘要与真实连通性探针',
    },
    {
      id: 'defaults',
      label: '默认设置',
      route: '#/system?tab=defaults',
      kind: 'planned',
      group: 'system',
      icon: 'SlidersHorizontal',
      dataSource: '默认设置基线（配置接口尚未开放）',
    },
    {
      id: 'version',
      label: '版本',
      route: '#/system?tab=version',
      kind: 'planned',
      group: 'system',
      icon: 'Tag',
      dataSource: '构建产物注入',
    },
    {
      id: 'events',
      label: '审计事件',
      route: '#/system?tab=events',
      kind: 'planned',
      group: 'system',
      icon: 'ScrollText',
      dataSource: '审计事件、审计详情与校验接口',
    },
  ],
};

export default manifest;
