/**
 * employees 运营·员工组 manifests — IA group 2/8 (PRD §3 rows 3-4).
 * T12 list (EmployeesModulePage) + T13 matrix (MatrixModulePage) live here;
 * the hidden 详情 pane (#/employees/:employeeId, the 23rd tabname) is NOT a
 * nav tab and must not get an entry here — assert-ia would count it into 22.
 */
import type { ModuleManifest } from '../../shell/registry';

const manifest: ModuleManifest = {
  module: 'employees',
  tabs: [
    {
      id: 'list',
      label: '列表',
      route: '#/employees',
      kind: 'reuse',
      group: 'employees',
      icon: 'UserRound',
      reuse: () => import('./EmployeesModulePage').then((m) => ({ default: m.EmployeesModulePage })),
      dataSource: '员工与能力矩阵接口（读取失败时回落员工列表）',
    },
    {
      id: 'matrix',
      label: '能力与权限',
      route: '#/employees?tab=matrix',
      kind: 'reuse',
      group: 'employees',
      icon: 'Grid3x3',
      reuse: () => import('../matrix/MatrixModulePage').then((m) => ({ default: m.MatrixModulePage })),
      dataSource: '员工能力矩阵读口（/api/matrix、/api/skills、/api/knowledge/spaces）',
    },
  ],
};

export default manifest;
