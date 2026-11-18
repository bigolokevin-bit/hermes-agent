/**
 * duty 值班台 pane — placeholder manifest (stage 1, lane A).
 * PRD Section 3 row 1 / Section 4.2: NEW pane (skeleton:1840-2035), 8 cards
 * in fixed order; the four-gate aggregate endpoint does not exist (GAP-01),
 * so the pane is an honest 'planned' placeholder until stage 2 wires the
 * front-end aggregation (employees/run-stats/budget-usage/approval-stats,
 * each gate labelled with source and time; unknown != pass).
 * No fake data, no JSX here — stage 2 renders the placeholder shell from
 * this registry entry.
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
      kind: 'planned',
      dataSource: 'employees/run-stats/budget-usage/approval-stats 聚合（GAP-01）',
    },
  ],
};

export default manifest;
