/**
 * approvals 运营·审批组 manifests — IA group 4/8 (PRD §3 rows 7-8).
 * pending (T05 ApprovalsPendingModulePage, real approve/reject via API) and
 * history (8-state decision ledger) ship as module pages, wired in App.
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'approvals',
  tabs: [
    {
      id: 'pending',
      label: '待处理',
      route: '#/approvals',
      kind: 'reuse',
      group: 'approvals',
      icon: 'Inbox',
      reuse: () => import('./ApprovalsPendingModulePage').then((m) => ({ default: m.ApprovalsPendingModulePage })),
      dataSource: '/api/approvals /api/approval?id=',
    },
    {
      id: 'history',
      label: '历史决策',
      route: '#/approvals?tab=history',
      kind: 'reuse',
      group: 'approvals',
      icon: 'History',
      reuse: () => import('./ApprovalsHistoryModulePage').then((m) => ({ default: m.ApprovalsHistoryModulePage })),
      dataSource: '/api/approvals?status=（8 态）',
    },
  ],
};

export default manifest;
