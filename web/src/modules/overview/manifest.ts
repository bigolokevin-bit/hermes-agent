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
      // OM-01 挂载裁定（deep/01-overview.md D-1：总览是独立真实屏）：本体为
      // modules/overview/OverviewPage（ov6-* 面），App.tsx live slot `duty`
      // 同步挂载此页；原复用对象 duty/DutyPage 不再挂载，文件保留由 duty
      // 测试面锚定，退役另案。id/label 不动——routes.ts 冻结行与 22-tab 法
      // 以此为准（改 IA 词表属独立裁定，见 backlog OM-03+）。
      reuse: () => import('./OverviewPage'),
      dataSource:
        '运营总览聚合：员工、运行统计、用量预算、审批统计四类数据（逐项标注来源，缺失时标待核实）',
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
