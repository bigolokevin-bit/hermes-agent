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
## T11 用量与成本

- 实现：`web/src/modules/duty/UsagePage.tsx`；`manifest.ts` 新增第二 Tab `usage`（route `#/overview?tab=usage`，kind `reuse`）。
- 数据：`/agent-api/api/hermes-usage?days=30` 的 `tokens`（input/output/cache/reasoning）与 `by_model`；金额只取同响应 `cost` 账本块（`cost_usd` / `cost_status` / `rows` / `per_employee`），缺失或 `unknown` 显示「未计价」，绝不显示 0.00；空值「—」并附原因。
- 页面：四态（loading 骨架 / empty 带原因 / error 人话+请求号+重试 / denied 降级，403≡404 同体）；支持壳层 `?state=` 强制态；员工引用只显「员工 · 短码」，技术值进 title；宽表只在卡内横向滚动，1440/375 无页面横溢。
- 口径：不做前端计价、不二次舍入、不把缺失当 0；`by_model` 为空显示原因而不是空表。

命令与原始结果：

```
cd web && PATH="/opt/homebrew/bin:$PATH" pnpm exec tsc -p tsconfig.lanee.json   # 临时配置 extends tsconfig.app.json
tsc_exit=0
```

```
cd web && PATH="/opt/homebrew/bin:$PATH" pnpm build
✓ built in 2.65s
built /Users/kevin_studio/Projects/forks/console-duty/hermes_cli/web_dist/index.html
build_exit=0
```

截图：`docs/_artifacts/duty/t11-1440.png` (113,534 B)、`t11-375.png` (56,818 B)；静态服务 5431 HTTP 200。

未测：截图取自静态产物、未接真实后端；真实 `hermes-usage` 200 与账本数据未取；`budget-usage` 组织级参数未在本页单独调用（账本金额已由 usage 响应的 cost 块承载），如 BFF 要求独立调用需下一阶段补。

## T10 收口复核（2026-11-19）

- 8 卡缺源/不可判定一律显示「待核实（GAP-01）」，不计入分子、不写成 0；每门保留 source 文本，已有去处（运行/任务/审批/活跃）的卡片仍可点回对应页。
- 四态：loading 骨架 / empty 带原因 / error 人话 + 请求号 + 重试 / denied 降级；`dutyPage.test.tsx` 4/4 覆盖固定八卡、未知门、错误请求号与 fixture 边界。
- T11 复核（无代码改动）：金额只取 `hermes-usage.cost` 账本块（`cost_usd`/`cost_status`/`rows`/`per_employee`），null/`unknown` → 「未计价」，缺失 → 「—」，真实 0 才显示 `$0.00`；未做前端计价或二次舍入；四态与 403≡404 同体已实现；宽表仅卡内滚动。
- 证据：`pnpm exec vitest run src/modules/duty/dutyPage.test.tsx` → 4 passed（1 file，855ms）；`pnpm build` → EXIT 0，`✓ built in 2.35s`，`hermes_cli/web_dist/index.html`。
- 截图：`docs/_artifacts/duty/t10-close-1440.png` (72,249 B)、`t10-close-1280.png` (60,944 B)、`t10-close-375.png` (28,007 B)；静态服务 5433 HTTP 200。
- 未测：截图取自静态构建、未接真实后端；真实四门读数、交互与明主题未复验；GAP-01（四门聚合端点）仍缺。

## T10 五字段阻塞卡收口（2026-11-19）

- 阻塞卡改为五字段：**阻塞对象 / 卡在哪一步 / 等谁 / 已等时长（北京时间到分） / 下一步动作**；缺项显示「—」。
- 已等时长由 `waitingSince` 计算（失败运行取 `startedAt`、阻塞任务取 `updatedAt`、审批取 `createdAt`），展示「N 分钟/小时（YYYY-MM-DD HH:mm 起）」；时间不可解析时 `—`，不补 0。
- 保留下一步动作与「去处理」真实去向：`/runs?status=failed`、`/tasks/:id`、`/approvals/:id`；来源标注仍在每门 `title` 中。
- 四态保持：loading 骨架 / empty 带原因 / error 人话+请求号+重试 / denied 降级；403/404 同体。
- T11 复核：金额仍只认 ledger `cost` 块，缺失/unknown 显「未计价」，真 0 仅 `$0.00`，无 `?? 0`。

命令与原始结果：

```
cd web && PATH="/opt/homebrew/bin:$PATH" pnpm exec vitest run src/modules/duty/dutyPage.test.tsx
Test Files  1 passed (1)
     Tests  4 passed (4)
  Duration  1.20s
```

```
cd web && PATH="/opt/homebrew/bin:$PATH" pnpm build
✓ built in 2.48s
built /Users/kevin_studio/Projects/forks/console-duty/hermes_cli/web_dist/index.html
build_exit=0
```

截图：`docs/_artifacts/duty/t10-fields-1280.png` (60,941 B)、`t10-fields-375.png` (28,007 B)；静态服务 5434 HTTP 200。

未测：截图取自静态产物、未接真实后端；真实阻塞任务/审批数据列未取；375 主 CTA 首屏可见仅按截图目测。
