# MET6 时间窗与成本明细 — 活体读数（2026-11-19 BJT）

分支 `lane/console-ui2` · 探针时刻 2026-11-19T23:34Z · 线上入口 `:9122/agent-api`（R30 活体窗，未重建）

## 三档窗口（页面同参，runtime `/v1/runs/stats`）

| window | 请求 | from | bucket | 返回条数 | totals |
|---|---|---|---|---|---|
| 24h | `/agent-api/api/run-stats?from=<now-24h>&to=<now>&bucket=hour` | 2026-11-18T15:34Z | hour | buckets=0 | runs=0, sampleCount=0, successRate=— |
| 7d | 同上 `bucket=day` | 2026-11-12T15:34Z | day | buckets=1 | runs=13, succeeded=12, successRate=1.0 |
| 30d | 同上 `bucket=day` | 2026-10-20T15:34Z | day | buckets=2 | runs=14, succeeded=13, successRate=1.0 |

## 成本两态（domain `/v1/policy/budget/ledger/query`）

- 今日 `period=2026-11-19` → `items: []` → 页面「—」+「今天还没有账本实扣记录，所以显示「—」。」
- 本月 `period=2026-11` → 2 行：`0.121198` + `0.011498` → `$0.13`；单行 `costUsd: 0`（2026-11-14）显示 `$0.00`，不按缺失处理

## 单价源

`/agent-api/api/models/pricing` 线上 401（鉴权门）；上游 `/v1/models/pricing` 404 未实现 → 页面「这项数据当前读不到」，`GAP-MET6-01` 只进 title，不回显状态码。

## 成本明细两视图（2026-11-20 增补）

- 按员工 `?view=employee`（默认）：行 = `budget ledger` 按员工聚合计（窗口内逐日查询：24h=1 天 / 7d=7 天 / 30d=30 天）；支出=账本实扣；次数列固定「—」+「账本只记金额与用量，不记运行次数」；占比=该行支出/同窗口合计。
- 按模型 `?view=model`：行 = `runtime /v1/runtime/hermes/usage` 的 `by_model`（model/input/output/api_calls/sessions）；上游已剥离逐模型金额（实测 `by_model` 无 cost 字段），支出与占比固定「—」，合计取 `cost.cost_usd`（当前 null）；asOf 取上游 `asOf`，缺失显「—」。
- 两视图与 `?window=` 同存于 URL，刷新可回放；403 与 404 同体，GAP 只进 title。
