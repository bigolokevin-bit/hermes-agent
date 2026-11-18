/**
 * knowledge 治理·知识库组 manifests — IA group 6/8 (PRD §3 rows 12-14, GAP-03).
 * '#/knowledge' conflicts with the existing App route (upstream KnowledgePage);
 * precedence settled stage 2: the CONSOLE path renders this shell module, the
 * legacy '/knowledge' React route keeps serving upstream pages untouched.
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'knowledge',
  tabs: [
    {
      id: 'spaces',
      label: '知识空间',
      route: '#/knowledge',
      kind: 'planned',
      group: 'knowledge',
      icon: 'Library',
      dataSource: '知识空间登记（读取接口未开放，显示诚实空态）',
    },
    {
      id: 'sources',
      label: '数据源',
      route: '#/knowledge?tab=sources',
      kind: 'planned',
      group: 'knowledge',
      icon: 'Database',
      dataSource: '数据源管理（尚无读取接口）',
    },
    {
      id: 'evidence',
      label: '证据与引用',
      route: '#/knowledge?tab=evidence',
      kind: 'reuse',
      group: 'knowledge',
      icon: 'Quote',
      reuse: () => import('../evidence/EvidenceModulePage').then((m) => ({ default: m.EvidenceModulePage })),
      dataSource: '运行事件引用与审计接口',
    },
  ],
};

export default manifest;
