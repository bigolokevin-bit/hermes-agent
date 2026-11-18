/**
 * matrix 能力与权限 pane — placeholder manifest (stage 1, lane A).
 * PRD Section 3 row 4 / Section 4.2: NEW pane (skeleton:2315-2384),
 * org-level coverage gaps; consumes /api/matrix -> domain
 * /v1/matrix/employees behind the BOUNDARY-12 fixture gate (Section 12).
 * Dual view (data-capview=people|resource), three-state tools and two-layer
 * knowledge with explicit unknowns. Honest 'planned' until the fixture gate
 * passes; stale projections never fall back to sample data.
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'matrix',
  tabs: [
    {
      id: 'matrix',
      label: '能力与权限',
      // ROUTE_TABLE row 4 (appendix A).
      route: '#/employees?tab=matrix',
      kind: 'planned',
      dataSource: '/api/matrix→domain /v1/matrix/employees（fixture 门 BOUNDARY-12）',
    },
  ],
};

export default manifest;
