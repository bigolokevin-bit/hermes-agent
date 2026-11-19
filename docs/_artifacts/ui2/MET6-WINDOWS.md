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

## 数据来源与新鲜度（metB，2026-11-20）

- 默认收起，只显示一行入口「数据来源与新鲜度」+「最近采集 <北京时间> · 6 个读口」；展开才列出六个读口：运行活动热力、运行统计、员工目录、平台扣费账本、模型价目表、Hermes 用量。
- 采集时刻只取上游 payload 顶层的 `asOf`，且必须匹配 ISO 8601（正则 + `Date.parse` 双重校验）。非 ISO 或缺省一律显示「—」，`title` 写「上游未返回采集时刻」；**不用本机时钟顶替**（页面自己的 `heatAt` 只用于热力卡，不参与此块）。
- `asOfSource` 存在时只进 `title`（「采集时刻来自 …」），不上屏。
- 同一读口被多次请求时 `mergeSourceStamp` 保留较新的 `asOf`；成功响应清掉上一次的 error/gap/requestId。
- 降级态：读不到来源显示「读不到」，`title` 带人话原因与请求编号（若有）；无 asOf 显示「未返回采集时刻」；正常显示「正常」。
- 数据同源：`loadJson` 包装页面原有的 `fetchJsonStrict`，所有 loader 都走它，计数不额外发请求。
- testid：`metB-source`、`metB-source-toggle`、`metB-source-table`、`metB-source-row-<key>`、`metB-source-asof-<key>`、`metB-source-state-<key>`、`metB-source-empty`。
- 验证：定向 `vitest run src/modules/metrics` 49 passed；全量 131 files / 1421 passed；build entry `assets/index-CUZn2ypG.js` sha256 `0f9e189b…01cd7e`，entry 内 `metB-source`=0，chunk `MetricsModulePage-D3sZntMx.js` 命中 1。

## 时间窗与来源联动一致性（metC，2026-11-20）

- 一次取数只认一个批次：`loadJson` 记录批次号 `sourceEpoch`，响应回来时批次已换（切窗、切视角、切分组、重试、改热力周数）就只把结果交给卡片，不再写新鲜度块——迟到的旧批次不会把旧采集时刻贴到新数字旁边。
- 切批次时清空 `sources`（不是清 `sourcesOpen`）：摘要行短暂显示「最近采集 —」，各读口随新响应落位；用户展开与否的选择保留，切窗后表格仍开着，采集时刻随新数据刷新。
- 读口三态改成人话三词：有 `asOf` = 「正常」；能读但没有 `asOf` = 「降级」（`title`：上游未返回采集时刻：数据读到了，但说不清它新到什么程度）；请求失败 = 「读不到」（`title` 带原因与请求编号，若有）。
- 「读不到」且上游给了请求编号时，状态格内给出「复制编号」按钮（`metC-source-rid-<key>`，点击后变「已复制」），编号本身只在 `title` 与按钮 `title` 里，不上屏正文。
- 零与缺仍然分开：窗口内真实发生的 0 记 `$0.00`，没发生的缺失记 `—`，切换窗口不改变这条口径。
- 测试断言切窗后只发一组请求（新批次里 run-stats 恰两条、均 `bucket=day`，无重复 URL），采集时刻与卡片数字同批更新；另有展开态保持、`$0.00`／`—` 同屏、403 请求编号可复制、缺 `asOf` 判「降级」四例。
- testid：新增 `metC-source-rid-<key>`；`metB-source-*`、`met5/6/7/8/9/A-*` 保持不变。
- 验证：定向 `vitest run src/modules/metrics` 54 passed；全量 132 files / 1458 passed（另 2 条 unhandled rejection 来自上游新并入的 `modules/employee-detail`，与指标页无关）；`tsc -b . --noEmit` 在 `modules/metrics` 0 条（全仓 55 条为既有基线）；build entry `assets/index-DIcUxZyk.js` sha256 `e3f7c70a…3c8193`，entry 内 `metC-source-rid`=0、`metB-source`=0，chunk `MetricsModulePage-BuWP9xmG.js` 命中 1。

## 空态与降级态一致性（metD，2026-11-20）

- 一处读不到，两处同一句话、同一个请求编号：卡片区的失败句与「数据来源与新鲜度」里对应读口的那句都来自同一个失败分类；卡片 gap 追加与新鲜度行相同的编号（`metD-gap-rid-<key>`），整块失败卡另给 `metD-card-reason` / `metD-card-rid`，不再各自造句。
- 新鲜度行在「读不到」下直接显示那句人话（`metD-source-reason-<key>`），复制仍是 `metC-source-rid-<key>`；编号值两处一致。
- 空态出口：`met6-empty` 增加 `metD-empty-window`（换到 7 天看看，已在该窗口时不渲染）与 `metD-empty-retry`（重新读取），不画死按钮。
- 重试只重发一批：`met6-retry` 点击后各 loader 各跑一次；测试以「按 URL 形状（from/to 掩码）计数」比对重试批与首批完全一致，避免把时间戳差异误当成二次请求。
- 窗口内真 0 仍是 `$0.00`，缺失仍是「—」；空态/错误态不补 0、不顶旧内容。
- 验证：定向 58 passed（+4）；全量 132 files / 1462 passed（另有 2 条 unhandled rejection 来自上游 employee-detail 测试，与本页无关）；tsc `modules/metrics` 0 条；build entry `assets/index-CGjbb-h3.js` sha256 `9f488c4fed8255c9301ddef163d2894be4e8f518cc544826c23b3c29d0470805`，entry 内 metD=0、metB=0，chunk `MetricsModulePage-BhtPB8kO.js` metD-card-reason=1、metD-empty-window=1。
