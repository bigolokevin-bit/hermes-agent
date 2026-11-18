/**
 * identity 治理·身份组 manifests — IA group 5/8 (PRD §3 rows 9-11, GAP-02).
 * All three read 毕升 user/department/role endpoints; none live yet — honest
 * placeholders with per-tab 数据来源, never blank dead links.
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'identity',
  tabs: [
    {
      id: 'people',
      label: '人员目录',
      route: '#/identity',
      kind: 'planned',
      group: 'identity',
      icon: 'Users',
      dataSource: '毕升 /api/v1/user/*（GAP-02）；缺→待核实',
    },
    {
      id: 'departments',
      label: '组织与部门',
      route: '#/identity?tab=departments',
      kind: 'planned',
      group: 'identity',
      icon: 'Building2',
      dataSource: '毕升 getDepartmentApi（GAP-02）',
    },
    {
      id: 'roles',
      label: '角色与权限',
      route: '#/identity?tab=roles',
      kind: 'planned',
      group: 'identity',
      icon: 'ShieldCheck',
      dataSource: '毕升 /api/role/*（GAP-02）',
    },
  ],
};

export default manifest;
