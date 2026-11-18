/**
 * evidence 证据与引用 pane — live module (T25).
 * ROUTE_TABLE row 14 (#/knowledge?tab=evidence): citation rows from
 * `/api/run-events` with the audit association from `/api/audit`.
 *
 * reuse: /v1/run-events/citations
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'evidence',
  tabs: [
    {
      id: 'evidence',
      label: '证据与引用',
      route: '#/knowledge?tab=evidence',
      kind: 'reuse',
      reuse: () => import('./EvidenceModulePage').then((m) => ({ default: m.EvidenceModulePage })),
      dataSource: '/api/run-events citations + /api/audit（fixture 门 GAP-1）',
    },
  ],
};

export default manifest;
