/**
 * approvals 运营·审批组 manifests — IA group 4/8 (PRD §3 rows 7-8).
 * pending reuses the fork ApprovalsPage (627 lines, live); history is the
 * 8-state decision ledger (§3). Both keep 'planned' honesty until the App
 * hands a live node — same policy as before regroup.
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'approvals',
  tabs: [
    {
      id: 'pending',
      label: '待处理',
      route: '#/approvals',
      kind: 'planned',
      group: 'approvals',
      icon: 'Inbox',
      dataSource: '/api/approvals /api/approval?id=',
    },
    {
      id: 'history',
      label: '历史决策',
      route: '#/approvals?tab=history',
      kind: 'planned',
      group: 'approvals',
      icon: 'History',
      dataSource: '/api/approvals?status=（8 态）',
    },
  ],
};

export default manifest;
