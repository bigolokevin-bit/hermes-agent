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
      kind: 'planned',
      group: 'system',
      icon: 'HeartPulse',
      dataSource: '/api/hermes-summary + BFF/domain 真探针',
    },
    {
      id: 'defaults',
      label: '默认设置',
      route: '#/system?tab=defaults',
      kind: 'planned',
      group: 'system',
      icon: 'SlidersHorizontal',
      dataSource: 'SET-01 基线（CR-M2-02 未落地）；运行时 /api/config schema 内',
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
      dataSource: '/api/audit /api/audit-detail /api/audit-verify',
    },
  ],
};

export default manifest;
