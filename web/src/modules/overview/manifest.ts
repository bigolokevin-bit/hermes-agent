/**
 * overview 运营·值班台组 manifests — IA group 1/8 (PRD §3 rows 1-2).
 * 22-tab law: every visible CONSOLE_TABS row lives in exactly ONE group
 * manifest; hidden 详情 (#/employees/:employeeId) stays shell-side via
 * routes.ts DETAIL_TAB and must NOT appear here (assert-ia counts every
 * tabs[] entry toward 22).
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'overview',
  tabs: [
    {
      id: 'duty',
      label: '值班台',
      route: '#/overview',
      kind: 'reuse',
      group: 'overview',
      icon: 'LayoutDashboard',
      reuse: () => import('../duty/DutyPage'),
      dataSource:
        'employees / run-stats / budget-usage / approval-stats（四门逐门标来源；缺失标待核实）',
    },
    {
      id: 'usage',
      label: '用量与成本',
      route: '#/overview?tab=usage',
      kind: 'planned',
      group: 'overview',
      icon: 'PieChart',
      dataSource: 'hermes-usage/budget-usage（ledger 唯一金额源）',
    },
  ],
};

export default manifest;
