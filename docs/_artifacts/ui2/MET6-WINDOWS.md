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

## 导出与环比（2026-11-20 增补）

- CSV 按当前 `?window=` 与 `?view=` 导出：员工表头 `员工,支出USD,次数,占比%,账本截至,窗口,窗口开始,窗口结束`；模型表头 `模型,支出USD,次数,占比%,读取于,窗口,窗口开始,窗口结束`。缺值写空单元格；文件名 `metrics-<view>-<window>-<BJT yyyymmdd-HHmm>.csv`；无行时按钮 disabled + title 原因。
- 环比：运行数 = 当前窗口 vs 等长上一窗口（runtime 运行统计）；成本 = 当前窗口账本合计 vs 上一窗口合计（预算账本日账逐日）。无可比显示「—」+title；delta 为 0 显示 `±0` / `±$0.00`，与缺失可区分。

## 成本行下钻运行明细（met9，2026-11-20）

- 先量参数：`/runs` 页面只读 `window|status|state|run|employee`（`web/src/modules/runs/RunsModulePage.tsx` 的 `params.get` 实测），`employee` 直接作为 `employeeId` 传给 BFF；BFF 列表口接受且仅接受 `employeeId/status/since`（`runs.ts` 注释与 `askListRoute`）。`model` 既不被页面读取，也不被 BFF 接受 → **不按模型筛选不是缺口描述，而是当前契约**。
- 活体 HTTP 计数未能取到：用既有浏览器 cookie 与无凭证请求 `GET /agent-api/api/runs?since=…&limit=5` 均 `401 console.unauthenticated`（rid `ae6e2554` / `7304f7cd`），登录态已过期。故本条以源码路径为证据，并如实记录未做筛前/筛后条数实测。
- 链接形状（真 `a[href]`，可聚焦、可中键/新标签打开）：
  - 按员工行 → `/runs/?employee=<完整 employeeId>&window=<24h|7d|30d>`；原始 id 只进 href，屏上仍是姓名或「员工 · 8 位短码」。
  - 按模型行 → `/runs/?window=<同一时间窗>`，**不带 `model=`**；行 title 与表下说明逐字写明「运行页暂不支持按模型筛选…不假装过滤」。
- testid：`met9-link-<slug>`、`met9-note`；`met6-*`/`met7-*`/`met8-*` 未改；四态渲染路径不变。
- 证据：`vitest run src/modules/metrics` 39 passed（+2：员工深链 href/窗格透传、模型不伪造筛选）；全量 131 files / 1411 passed。

## 当前视图 CSV 导出（metA，2026-11-20）

- 按钮 `metA-export`「导出当前视图」，计数 `metA-export-count`「可导出 N 行」；空集时按钮 disabled，`title=当前视图无可导出数据`。
- 导出内容 = 屏幕上成本分摊表的**当前窗口 + 当前分组（model/employee）+ 当前排序**，纯前端 `Blob` + `URL.createObjectURL`，零新后端端点。
- 文件名 `metrics-<window>-<group>-<YYYYMMDD-HHmm>.csv`（北京时间），例：`metrics-24h-model-20261120-0655.csv`。
- 表头固定英文键：`group,runs,cost_usd,share_pct`，与屏上四列一一对应（第五列「查看运行」是导航，不进 CSV）。
- 数值口径：账本真 0 写 `0.00`；缺失写空字段（绝不写 0）；占比一位小数、缺失为空。含逗号/引号按 RFC 4180 转义并已实测：模型名 `a,"b"` → `"a,""b""",1,2.00,100.0`。
- 文件带 UTF-8 BOM（Excel 中文兼容）；测试断言时剥掉 `\uFEFF`。
- 测试：`metA — export the current cost view` 4 例（行数与屏上一致、真 0 vs 缺失、RFC4180 转义、空集禁用）。定向 43 passed；全量见下。

### 导出按钮口径（R48，2026-11-20）
- 同一页有两个导出：`met6-export`「导出明细 CSV」（账本逐行明细）与 `metA-export`「导出分摊 CSV」（当前窗口/分组/排序下的聚合行）。文案与 title 首句各自点明对象差异，按钮位置、版式、文件名与表头未改。
- 分摊区块标题下新增 `metA-scope-note`：「这里是聚合行；逐行明细用上方的「导出明细 CSV」。」（≤30 字，沿用既有 note 类）。
- 测试：`MetricsModulePage.test.tsx` 新增一例，断言两按钮可见文案不同、title 分别含「账本逐行」/「聚合行」、scope note 同时提到两者；定向 44 passed、全量 1416 passed。
