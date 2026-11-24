/**
 * identity 治理·身份组 manifests — IA group 5/8 (PRD §3 rows 9-11, GAP-02).
 *
 * 三屏都由本目录页面承接（人员目录 / 组织与部门 / 角色与权限）。数据来源写的是
 * 本轮实测的真实读数面：成员台账 + 部门名册试读；角色与权限矩阵没有读口，
 * 页面按「—」+ 卡底缺读口声明，不补样例。
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'identity',
  tabs: [
    {
      id: 'people',
      label: '人员目录',
      route: '#/identity',
      kind: 'reuse',
      group: 'identity',
      icon: 'Users',
      reuse: () => import('./IdentityPeoplePage'),
      dataSource: '人员目录来自数字员工台账（成员姓名、岗位、部门、生命周期态）',
    },
    {
      id: 'departments',
      label: '组织与部门',
      route: '#/identity?tab=departments',
      kind: 'reuse',
      group: 'identity',
      icon: 'Building2',
      reuse: () => import('./IdentityDepartmentsPage'),
      dataSource: '部门按成员台账的部门字段现算；部门名册读口未接线',
    },
    {
      id: 'roles',
      label: '角色与权限',
      route: '#/identity?tab=roles',
      kind: 'reuse',
      group: 'identity',
      icon: 'ShieldCheck',
      reuse: () => import('./IdentityRolesPage'),
      dataSource: '角色定义与权限矩阵没有读口；成员侧取成员台账，角色与范围显示「—」',
    },
  ],
};

export default manifest;