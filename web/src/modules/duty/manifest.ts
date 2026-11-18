/**
 * duty 值班台 pane — 8 cards in fixed order (PRD §3 row 1 / §4.2).
 *
 * The front-end aggregate is implemented in this module (employees /
 * run-stats / budget-usage / approval-stats). Each of the four gates carries
 * its own source label and time; a missing source renders 「待核实」 and never
 * enters the numerator. Stage 2 wiring: the pane is now a real reuse target.
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'duty',
  tabs: [
    {
      id: 'duty',
      label: '值班台',
      // ROUTE_TABLE row 1 (appendix A) — navigable, never a dead link.
      route: '#/overview',
      kind: 'reuse',
      reuse: () => import('./DutyPage'),
      dataSource:
        'employees / run-stats / budget-usage / approval-stats（四门逐门标来源；缺失标待核实）',
    },
    {
      id: 'usage',
      label: '用量与成本',
      route: '#/overview?tab=usage',
      kind: 'reuse',
      reuse: () => import('./UsagePage'),
      dataSource: 'hermes-usage / budget-usage（ledger 唯一金额源；缺账目标未计价）',
    },
  ],
};

export default manifest;