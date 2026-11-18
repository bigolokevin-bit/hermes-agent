/**
 * org 组织与部门 — stage-2 manifest (lane B, T21).
 *
 * ROUTE_TABLE row 149 (#10 departments): the pane lives under #/identity with
 * tab=departments; data source is 毕升 getDepartmentApi, route unverified
 * (GAP-02). OrgModulePage.tsx in this directory answers with the honest
 * 待核实 + 申请入口 state until the BFF wires the endpoint, and a real tree
 * after. kind stays 'planned' for the same registry-snapshot reason as T18/T20
 * — the page mounts through the lane A bridge probe, not through this flag.
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'org',
  tabs: [
    {
      id: 'departments',
      label: '组织与部门',
      // ROUTE_TABLE row 149 — exact hash match; visible sub-tab of #/identity.
      route: '#/identity?tab=departments',
      kind: 'planned',
      dataSource: '上游部门接口（尚未接入本控制台）',
    },
  ],
};

export default manifest;
