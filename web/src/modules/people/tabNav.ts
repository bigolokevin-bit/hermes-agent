/**
 * people 人员目录 — T20 placeholder manifest (lane B).
 *
 * The 人员目录 tab itself is owned by lane A (ROUTE_TABLE row 9, hash
 * '#/identity', dataSource '毕升 /api/v1/user/*（GAP-02）；缺→待核实').
 * This manifest registers the same pane for the stage-2 mount and keeps
 * kind 'planned' deliberately: the registry has no people render path yet
 * (bridge probes no people candidate), and flipping the flag would churn
 * registry snapshots. PeopleModulePage.tsx in this directory is the
 * ready-to-mount stage-2 page — see docs/_artifacts/employees/DONE.md.
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'people',
  tabs: [
    {
      id: 'people',
      label: '人员目录',
      // ROUTE_TABLE row 9 — visible nav tab under the identity module.
      route: '#/identity',
      kind: 'planned',
      dataSource: '上游用户中心接口（尚未接入本控制台，缺→待核实）',
    },
  ],
};

export default manifest;
