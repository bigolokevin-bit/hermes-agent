# DONE-MT05 — 取数策略债：24h 窗塌陷明示 + 员工份额逐日扇出封顶

- 车道：MT-05 · branch `task/MT-05-fanout-gate` · 基线 `392442dffb`（origin/lane/hermes-console 现取）
- 写域：`web/src/modules/metrics/`（metrics.ts、MetricsModulePage.tsx、metrics.window.test.tsx、metrics.requests.test.tsx）

## 改动

1. **metrics.ts（+20）**：`FANOUT_REQUEST_BUDGET = 12`；`fanoutCoveredDays(days, chunks)`（days×chunks≤12 直发，超限按 `max(1, floor(12/chunks))` 截断，每 chunk 至少保 1 天）；`shareCoverageNote(days, coveredDays)`（截断→「仅覆盖近 n 天，非全窗」，否则 null）。
2. **loadShare employee 分支**：目录取得后过闸门，dayKeys 按 coveredDays 取**尾部最近日**（最近日优先保留）；ShareState ready value 增必填 `coveredDays`（model 分支=days）。
3. **分摊 footer**：合计数值包进 `data-testid="${sharePrefix}-total-spent"`，截断态加 title「账本只覆盖近 n 天，未补 0」；截断时追加 `<p data-testid="met8-coverage-note">仅覆盖近 n 天，非全窗</p>`，无截断不出现。「窗口 N 天」旧文案锚不动，不补 0 不外推。
4. **24h 明示句**：met6-window 钮组后，仅 24h 档渲染 `data-testid="metU-24h-daycaliber-note"`：「该读口按整天记账，24 小时档取的是今日整日账。」（逐字进测试）。

## DoD 对照（实测）

- 24h 窗 DOM 含「整日账」句、7d 窗不含 → metrics.window.test.tsx 追加 2 DOM 例 + 纯函数 2 describe，全绿。
- 200 员工 × 30d：budget-usage **增量计数 ≤12** 且 coverage-note 出现（distinct periods=3）；小目录 7d：计数=7 且无标注 → metrics.requests.test.tsx 追加 2 例，全绿。
- `vitest run src/modules/metrics`（+棘轮门 2 件）= **18 files / 329 tests 全绿**（基线 16 件不回归）。
- `node_modules/.bin/vite build` exit **0**。

## 验证设计说明（oracle 增量计数）

loadBudget/loadBreakdown/loadCmp 的 day-keyed budget-usage URL 与扇出同形制，绝对 fetch 计数不可判别，故新增例 mount 后**点击 met8-view-employee 测增量**——只计分组切换引发的份额腿请求。

## 偏离与注记

1. **testid 更名**：卡片原文「met8-share-total」让位于 `${sharePrefix}-total-spent`——`met7-share-`/`met8-row-` 等前缀是既有契约 sweep 族（MetricsModulePage.test.tsx L2978 `^="met7-share-"` 求和例实测碰撞：model 视图合计被扫入 +4），新名不撞任何 sweep 族。
2. **闸门范围**：仅员工份额腿（卡片明列 L1072-1095）。loadBudget 等其它 day-keyed 腿不设闸门，根治归聚合端点 `/api/cost-window` 另票（卡片④）。
3. **CALIBER_NOTES hermes-usage 句**（「天数跟随所选时间窗」）未改——改文案牵动 copy-parity 与深文档回写，归 MT-06 文档腿/另票。
4. 24h 塌陷只**明示**不改行为：`days=Math.max(1,round(hours/24))` 三处（L758/L902/L1060）保持，BFF 仅透传 days。

## 门读数原文

- vitest：`Test Files 18 passed (18)` / `Tests 329 passed (329)`（scoped，含 font-scale+scrollbar-utility 棘轮门）
- build：`BUILD_EXIT=0`（vite build，日志 /tmp/mt05-build.log）
- lint：pre-commit lefthook 0 error（既有 set-state-in-effect 警告族不变）
