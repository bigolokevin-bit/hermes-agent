/**
 * matrix 能力与权限 pane — live module (T13).
 * PRD Section 3 row 4 / Section 4.2: dual view (people | resource), three cell
 * states with an explicit 「待核实」 for unknowns, and no sample data unless the
 * BOUNDARY-12 fixture gate reports the live route missing (the page then shows
 * the `data-fixture` badge and says so).
 *
 * reuse: /v1/matrix/employees
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
      kind: 'reuse',
      reuse: () => import('./MatrixModulePage').then((m) => ({ default: m.MatrixModulePage })),
      dataSource: '/api/matrix→domain /v1/matrix/employees（fixture 门 BOUNDARY-12）',
    },
  ],
};

export default manifest;