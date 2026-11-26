# Tasks: console-employee-soul

## 1. 人格合成与写回

- [x] 1.1 `web/src/modules/chat/employeeSoul.ts`：`composeEmployeeSoul`（身份）/ `composeEmployeeOverlay`（组织上下文）/ `loadEmployeeSoul`（并行读员工与版本，缺职责即抛错）；`versionNo` 兼容数字与字符串（`1f42a3c76a`、本 change）
- [x] 1.2 `ChatModulePage.tsx`：`useEmployeeProfile` 判「是否存在 → 是否归控制台管」；受管档每次打开对齐 SOUL 与叠加层（`PUT /api/profiles/<name>/soul`、`PUT /api/config?profile=<name>`）
- [x] 1.3 `web/src/modules/chat/employeeProfile.ts`：`emp-<8位>` 命名、控制台建档描述与判定（`f02d1139d0`）
- [x] 1.4 `CreateEmployeeModal.tsx`：人格输入框（留空自动生成）；创建 2xx 后不阻塞主链地建独立档并写叠加层

## 2. 界面如实呈现

- [x] 2.1 独立档已就绪：显示「本对话运行在员工独立档 …，会话与历史只属于这位员工」
- [x] 2.2 建档失败：显示原因并说明「本次对话落在默认档，不会归属到该员工」
- [x] 2.3 叠加层写回失败：显示原因与影响（人格可能受残留说明影响），并说明重开会重试

## 3. 测试

- [x] 3.1 `ChatModulePage.test.tsx`：建档带本人 soul / 旧档校正 / 用户手写不覆盖 / 素材不全不建档 / 叠加层随校正写回（15 项）
- [x] 3.2 `employees.create-modal.test.tsx`：自动生成含本人姓名岗位职责部门 / 手填原样写入（13 项）
- [x] 3.3 归并跑：`src/modules/chat` + `src/modules/employees` + `src/shell` + `src/modules/employee-detail` 共 438 项通过；`npx tsc --noEmit` 干净

## 4. 实机证据

- [x] 4.1 `~/.hermes/profiles/emp-217a91ba/SOUL.md`：受管标记 + 本人姓名岗位 + 岗位职责 + 触发/模式 + 边界三条
- [x] 4.2 `~/.hermes/profiles/emp-217a91ba/config.yaml` → `agent.system_prompt`：组织上下文（员工/岗位/生效版本 v1 自 2026-11-17），无 `emp_9F42AAE2…` 残留
- [x] 4.3 构建与 served 对账：`index-BH1-Nhpm.js`（磁盘最新 = 9122 入口）；提交 `9100c994d3`

## 5. 收尾

- [ ] 5.1 新会话实跑一次：确认模型不再自称「AgentOS 产品助理」（待用户在有网关缓存的会话里验）
- [ ] 5.2 归档本 change（`openspec archive console-employee-soul`），把 `employee-persona` 能力并入主 specs
