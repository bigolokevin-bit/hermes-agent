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
        '值班台聚合：员工、运行统计、用量预算、审批统计四类数据（逐项标注来源，缺失时标待核实）',
    },
    {
      id: 'usage',
      label: '用量与成本',
      route: '#/overview?tab=usage',
      kind: 'reuse',
      group: 'overview',
      icon: 'PieChart',
      reuse: () => import('../duty/UsagePage'),
      dataSource: 'hermes-usage/budget-usage（ledger 唯一金额源）',
    },
  ],
};

export default manifest;
