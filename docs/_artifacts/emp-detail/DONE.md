# T18 — Employee Detail five-zone module · DONE

分支 `lane/console-employees` · commit `fafaddb9` `feat(console): employee detail five-zone module (T18)`（3 files，+1143）· 日期 2026-11-19

## 交付范围

- `web/src/modules/employee-detail/EmployeeDetailModulePage.tsx` — 新建，五区整页（概览/能力与权限/审批/运行/审计）
- `web/src/modules/employee-detail/EmployeeDetailModulePage.test.tsx` — 新建，13 用例
- `web/src/modules/employee-detail/manifest.ts` — 仅头部注释（kind 保持 `planned`：页面经 bridge probe 加载，不走 kind 旗标；翻旗标只会 churn registry 快照——假定已记录）
- 未动：`pages/EmployeeDetailPage.tsx`、`shell/console.tsx`、`shell/bridge.ts`、`EmployeeDetailWorkbench.tsx`

## 验证（原始 stdout）

### 定向 vitest（本模块）

```
 Test Files  1 passed (1)
      Tests  13 passed (13)
   Duration  916ms
```

### 全量 vitest

```
 Test Files  1 failed | 82 passed (83)
      Tests  2 failed | 569 passed (571)
VITEST_EXIT=1
```

两条失败为**已知 collateral**，逐字：

```
 FAIL  src/shell/console.test.tsx > ConsoleEmployeeDetailPage (hidden 23rd pane) > ?zone=workbench renders the 60/40 workbench through the App chat-host slot (injected as-is, exactly once)
 FAIL  src/shell/console.test.tsx > ConsoleEmployeeDetailPage (hidden 23rd pane) > bare detail keeps the fallback surface inside the hidetab pane
```

原因：lane A stage-2 契约假设「detail module 未上线前走 workbench/fallback 面」；本模块上线后 bridge probe（`EmployeeDetailModulePage.tsx` 候选1）非空即接管渲染，两测的前提被推翻。这两测不在 T18 写域，未修改。
BLOCKED: console.test.tsx 两条 stage-2 假设测试需 lane A/总控决定更新口径（非本车道可改）。

### 构建

```
✓ built in 2.56s
built /Users/kevin_studio/Projects/forks/console-employees/hermes_cli/web_dist/index.html
BUILD_EXIT=0
```

entry chunk：`assets/EmployeeDetailModulePage-Q8L4OA80.js`
sha256：`b4222d509a774fecf20848cdb827bd1f883b398ea6bc64e328297d8b1984a8a7`
（index 入口 `assets/index-34U-ETtM.js`）

### eslint（本模块目录）

```
✖ 2 problems (0 errors, 2 warnings)   — react-hooks/set-state-in-effect 警告×2
```

### lint-reuse 终态

```
violations=4
web/src/modules:0 reuse-marker-incomplete 五处复用标记缺一：未见 reuse: 对话 ChatPage（modules/ 内现有 reuse: 标记 4 处）
web/src/modules:0 reuse-marker-incomplete 五处复用标记缺一：未见 reuse: 运行详情 RunDetailPage（…）
web/src/modules:0 reuse-marker-incomplete 五处复用标记缺一：未见 reuse: 任务看板 TasksListPage（…）
web/src/modules:0 reuse-marker-incomplete 五处复用标记缺一：未见 reuse: schema 表单 AutoField（…）
```

4 条全部为基线既有（缺的是 ChatPage/RunDetailPage/TasksListPage/AutoField 四处标记，均不在本车道写域；HEAD 基线同样报这 4 条）。能力矩阵条目已由本页头部 `reuse: /v1/matrix/employees` 注释满足——本模块零新增违规。

## 四态证据（测试名对应）

- loading：`loading: skeleton, no engineering text`（骨架，无工程语言）
- ready：`ready from the employee detail endpoint: name · code, lifecycle badge`
- error：`error carries the plain sentence, request id, and a retry`（人话+请求编号+重试，无 HTTP 码裸文本）
- denied：`403 → permission sentence, not a fake empty` / `404 → honest not-connected state`
- empty：`empty overview: cause shown, never a blank pane` / `approvals empty names the reason`
- 其余：`detail 404 falls back to the matrix row before declaring missing`（降级链）、`five tabs, shell-zone spellings, overview lands on the bare path`（导航）

## fixture / GAP

零 fixture：五个端点全部实打（`/agent-api/api/employees/{id}`、`/v1/matrix/employees` 复用（经 `/agent-api/api/matrix?employee=`）、`/agent-api/api/approvals?employeeId=`、`/agent-api/api/runs?employee=`、`/agent-api/api/audit?employee=`）。端点缺失时呈现诚实的「还没接入」降级态而非假数据，故页内无 `data-fixture` 角标。GAP 口径沿用壳层 ROUTE_TABLE appendix A rows 23-27。

## 其他说明

- `主树权威账本 /Users/kevin_studio/Projects/forks/hermes-agent/docs/_artifacts/tonight/lint-reuse.json` 工作树显示 modified：是 `scripts/lint-reuse.mjs` 运行时自动回写的巡检快照，非本车道产物，未纳入 commit。
- 测试需 stub `@nous-research/ui`：该包 dist 含 `.webp`，vitest 直接 import 会 `Unknown file extension ".webp"` 崩 suite（仓库现有测试从未直接 import 它，T12 页面没有测试文件正是此因）。
- 员工显示统一「姓名 · 8位短码」，原始 id 只进 title；时间北京时间到分；金额 USD；缺失「—」（0 保留）；审批/运行行链接真跳 `/approvals`、`/runs`。
- pre-commit 钩子实跑通过（`✔️ lint web (0.62 seconds)`），未用 --no-verify。
