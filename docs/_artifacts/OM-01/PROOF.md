# OM-01 DOM 取证（2026-11-23 21:12，task/OM-01 @ 构建后 dist 本地 9178 端口，/agent-api 代理至现网 9122，jar 注入登录态）

- 前置断言：`GET /agent-api/api/employee-stats` → HTTP 200, content-type application/json, total=3（真读数，非 SPA 兜底 HTML）。
- `#/overview` DOM：
  - `[data-testid="ov6-page"]` 存在，且根节点 class=`ov5-page`（OverviewPage 面）；
  - `[data-duty-testid="duty-page"]` 不存在（DutyPage 未挂载）；
  - 标题「运营总览」；KPI 卡 testid：ov6-kpi-employees / ov6-kpi-runs / ov6-kpi-pending / ov6-kpi-cost（含各自 -stamp，共 10 节点）；as-of/stamp 在场。
- 375×812：ov6-page 在场、duty-page 缺席。
- pageerror：无。
- 截图：overview-1440.png、overview-375.png。

门禁：vitest src/shell+overview+duty = 26 files / 279 passed / 1 skipped；`node scripts/assert-ia.mjs` ok=true exitCode=0 headHash=648233693d；`vite build` exit 0。
