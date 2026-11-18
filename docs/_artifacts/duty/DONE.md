# T10 · 值班台（overview/duty） — DONE

- 车道：`lane/console-duty`（worktree `/Users/kevin_studio/Projects/forks/console-duty`，base `36127bab`）
- 写域：`web/src/modules/duty/**`（本阶段仅 `manifest.ts` 由 planned 切为 reuse；`DutyPage.tsx` 等既有实现复核）
- 页面：`#/overview`，8 张卡固定顺序；四门逐门独立判定后取交集

## 实现与口径

- `manifest.ts`：`kind: 'reuse'`，`reuse: () => import('./DutyPage')`；dataSource 改为「employees / run-stats / budget-usage / approval-stats（四门逐门标来源；缺失标待核实）」。
- 四门数据来源（每门卡片显示 source，`title` 带完整来源与取数时间）：
  1. 在岗/人员门：`/agent-api/api/employees?limit=100` + `/agent-api/api/employee-stats`
  2. 运行健康门：`/agent-api/api/run-stats` + `/agent-api/api/run-activity`
  3. 成本门：`/agent-api/api/budget-usage`
  4. 审批门：`/agent-api/api/approval-stats` + `/agent-api/api/approvals?status=pending`
- 缺源或不可判定：显示「待核实」+ GAP-01 说明，**不计入分子，也不当成 0**；成本/运行读取错误同样落「待核实」。
- 四态：loading 骨架 / empty 带原因 / error 人话 + 请求编号 + 重试 / denied 降级；错误文案来自 `humanError`，无 HTTP 码上屏。
- fixture：只在 `/api/matrix` 路由缺失时使用（测试固定该行为），真实 500 不回落 fixture。
- 金额只认 `budget-usage`/ledger 口径，缺失「—」，无 `?? 0`。

## 命令与原始结果

### duty 页测试

`cd web && PATH="/opt/homebrew/bin:$PATH" pnpm exec vitest run src/modules/duty/dutyPage.test.tsx`

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  23:51:55
   Duration  1.10s
```

### 全量构建

`cd web && PATH="/opt/homebrew/bin:$PATH" pnpm build`

```
✓ built in 2.27s
built /Users/kevin_studio/Projects/forks/console-duty/hermes_cli/web_dist/index.html
```

`build_exit=0`（日志 `/tmp/duty-build.log`）。

## 截图

- `docs/_artifacts/duty/t10-1440.png` (72,257 B)
- `docs/_artifacts/duty/t10-1280.png` (60,945 B)
- `docs/_artifacts/duty/t10-375.png` (28,007 B)
- 本地静态服务：`python3 -m http.server 5430 -d hermes_cli/web_dist` → HTTP 200

## 未测 / 边界

- 截图取自静态构建、未接真实后端：展示的是诚实加载/错误/待核实态，不是真实业务数据态；真实 BFF 200 与四门真实读数未取。
- 未做浏览器交互回归（搜索/滚动）与明主题截图；1280/375 仅按无横溢目测截图。
- `GAP-01`（四门聚合端点）仍不存在，前端聚合口径已按「逐门标来源、缺源待核实」实现。