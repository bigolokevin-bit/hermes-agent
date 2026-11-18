/**
 * runs 运行 pane — placeholder manifest (stage 1, lane A).
 * PRD Section 3 row 6: /api/runs + run-detail + run-events; retry is
 * planned (lane D, = new Run with previousRunId); missing cost renders '—',
 * never a fabricated number (BOUNDARY-03/04). Honest 'planned' placeholder —
 * stage 2 mounts the pane (V2 RunDetailPage + fork RunsPage are the reuse
 * sources, wiring deferred out of stage 1 by the no-upstream-coupling rule).
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'runs',
  tabs: [
    {
      id: 'runs',
      label: '运行',
      // ROUTE_TABLE row 6 (appendix A).
      route: '#/work?tab=runs',
      kind: 'planned',
      dataSource: '/api/runs /api/run-detail /api/run-events',
    },
  ],
};

export default manifest;
