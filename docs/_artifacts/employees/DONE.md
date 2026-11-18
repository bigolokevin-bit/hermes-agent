# T12 · 员工列表 — DONE

- 车道：`lane/console-employees`（worktree `../console-employees`，base `7dd07981`）
- 写域：`web/src/modules/employees/{EmployeesModulePage.tsx,manifest.ts}`
- 页面：`#/employees`（registry manifest：module `employees`，kind `reuse`）

## 实现

- 真实读取 `/agent-api/api/employees?limit=50&expand=version,knowledge&keyword=&lifecycleState=`；关键词 300ms 防抖、状态筛选（全部/在岗/暂停/停用）、清除筛选。
- 六列：员工 / 短码 / 状态 / 知识 / 月度预算 / 最近更新；可见文本只显「员工 · 8 位大写短码」，原生 `emp_…` 只进 `title`，不上屏。
- 四态：加载骨架、空（原因 + 下一步）、错误（人话 + 请求编号 + 重试）、403/404 同一整页正文；`?state=loading|empty|error|denied` 供壳层强制态。
- 375 单列、1440 多列，无横向溢出；主操作仅「新建员工」（诚实禁用并注明由薄壳车道接线后开放）。
- 未知/缺失：预算缺失「—」，真 0 显 `$0.00`；知识数缺失「—」。

## 命令与原始结果

```bash
# 自模块 typecheck（临时 tsconfig 继承 tsconfig.app.json，include src/modules/employees/**）
cd web && pnpm exec tsc -p tsconfig.lanee.json
# EXIT 0
```

```bash
cd web && pnpm build
# EXIT 0
# ✓ built in 2.17s
# built .../hermes_cli/web_dist/index.html
```

（新 worktree 无 node_modules，已从 `forks/hermes-agent` 软链 `node_modules`、`web/node_modules`、`apps/shared/node_modules`；未安装依赖、未改 package.json/lockfile。）

## 截图

- `docs/_artifacts/employees/t12-1440.png`（1440×900，61,531 B）
- `docs/_artifacts/employees/t12-375.png`（375×812，21,018 B）
- 静态服务：`python3 -m http.server 5420 -d hermes_cli/web_dist` → HTTP 200

## 未测 / 边界

- 截图取自**构建产物、未接后端**，仅证明 1440/375 版式与无横溢；真实 BFF 200、搜索/筛选命中、数据条数与四态动态切换尚未实测。
- 新建员工入口当前为诚实禁用（路由/写侧由薄壳车道接线）。
- 无工程语言上屏守卫：未加自动化单测；以代码与截图人工核对。
---

# T20 — 人员目录 PeopleModulePage · DONE（2026-11-19）

分支 `lane/console-employees`，写域 `web/src/modules/people/**`（页面+manifest+测试）。

## 交付

- 五列表格：姓名 / 账号 / 部门 / 状态 / 最后活跃（北京时间到分）。
- 数据顺序实打 `PEOPLE_ENDPOINTS = ['/agent-api/api/v1/user/list', '/agent-api/api/v1/user/all']`，兼容顶层数组 / items / data / data.items 信封；全 404 → 「待核实 + GAP-02」诚实态（不假 0），403 → 权限句，5xx → 人话 + 请求编号 + 重试。
- 裸 id（user_id）只进 `title=记录号 N`，永不上屏；搜索框客户端过滤姓名/账号/部门；1440 五列 grid、375 grid-cols-1 堆叠无横溢。
- 四态 testid：people-loading / people-denied / people-error / people-empty / people-nomatch / people-list / people-row / people-last-active。
- manifest.ts：tab「人员目录」route `#/identity`，kind 保持 planned（理由记于头注释；bridge 加 people 候选属 lane A）。

## 验证（原始 stdout）

```bash
cd web && npx vitest run src/modules/people/
#  Test Files  1 passed (1)
#       Tests  9 passed (9)
#    Duration  684ms
```

```bash
cd web && npx vitest run
#  Test Files  1 failed | 83 passed (84)
#       Tests  2 failed | 578 passed (580)
# FAIL src/shell/console.test.tsx > ?zone=workbench renders the 60/40 workbench …
# FAIL src/shell/console.test.tsx > bare detail keeps the fallback surface …
# （两条均为 T18 已知 collateral，本任务新增 9 条全绿，无新破）
```

```bash
cd web && PATH="/opt/homebrew/bin:$PATH" node ../scripts/build/web.mjs
# ✓ built in 2.29s
# built .../hermes_cli/web_dist/index.html
# BUILD_EXIT=0
# 新 chunk assets/PeopleModulePage-CD8cOahS.js
# sha256 71c3358ee89e85c7089320efbd97ab19184ddb70e2a0b954fae01bf9bcc58d62
```

```bash
cd web && node scripts/lint-reuse.mjs
# violations=4（ChatPage/RunDetailPage/TasksListPage/AutoField 缺标记——全基线既有，零新增）
```

eslint：本模块 0 error / 1 warning（set-state-in-effect）。

## BLOCKED

BLOCKED: PeopleModulePage 运行时接线 — bridge.ts 无 people probe 候选（`import.meta.glob("../modules/*/*ModulePage.tsx")` 存在但 /identity 路由只渲染静态 ConsoleModulePage，App.tsx:1103 无 live prop）。加候选属 shell/App 写域（本任务禁碰），待 lane A。页面与 manifest 已按 registry 契约入库，全量测试证明不破坏现有断言。

## 坑

- `@nous-research/ui` Button 无 `variant` prop（build 才报，测试 stub 吞掉了）——正确写法 `outlined` 布尔，同 T18。
- 测试 stub CardContent 必须 `{...rest}` 透传，否则 data-testid 丢失、ready 用例假崩。

---

## T21 · 组织与部门（org tree module）

commit pending · 分支 lane/console-employees · 2026-11-19

### 定向 vitest（org + people 复跑）

```
 Test Files  2 passed (2)
      Tests  18 passed (18)
```

org 单跑：`Test Files 1 passed (1) / Tests 9 passed (9), Duration 760ms`

### 全量 vitest

```
 Test Files  1 failed | 84 passed (85)
      Tests  2 failed | 587 passed (589)
VITEST_EXIT=1
```
FAILS: 仍为 T18 已知 collateral 两条（console.test.tsx bare fallback + ?zone=workbench chat-host-slot），T21 未新增失败，org manifest 未破 registry 断言。

### 构建

```
✓ built in 2.38s
built /Users/kevin_studio/Projects/forks/console-employees/hermes_cli/web_dist/index.html
BUILD_EXIT=0
```

chunk：assets/OrgModulePage-DCVRJzXP.js
sha256=cf4d8cc48a65662a84a8c1e6227a26314e6dd6d0d4070f1772ae4e06d8e3ac97

### lint

- eslint src/modules/org/ → `0 errors, 1 warning`（react-hooks/set-state-in-effect，同 T18/T20 基线噪音）
- lint-reuse → `violations=4`（全基线既有缺标记 ChatPage/RunDetailPage/TasksListPage/AutoField），org 零新增；tonight/lint-reuse.json 快照 scanned 27→30

### 交付与 GAP-02

- 写域：web/src/modules/org/{OrgModulePage.tsx,test,manifest.ts}
- 端点实打顺序：/agent-api/api/v1/dept/list → /agent-api/api/v1/dept/tree；全部 404 → 诚实 denied「组织架构待核实（GAP-02：毕升部门接口 getDepartmentApi 尚未接入本控制台）」+ org-apply 申请入口段（工单引用 GAP-02）
- 扁平 parent_id 行与嵌套 children[] 同构收平建树；人数缺失只写「人数待核实」，绝不渲染「共 0 人」；原始 dept_id 只进 title=记录号 N
- BLOCKED: org 页运行时接线——bridge.ts 无 org probe 候选，#/identity?tab=departments 仍渲染 planned 占位（同 T20，待 lane A）
- manifest route '#/identity?tab=departments' 与 ROUTE_TABLE 行 149 hash 精确一致；kind planned（registry 快照理由同 T18/T20）
