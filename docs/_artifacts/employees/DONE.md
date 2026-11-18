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