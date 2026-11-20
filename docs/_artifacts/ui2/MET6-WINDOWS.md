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

## 表格可访问性与排序语义（metG，2026-11-20）

- 两张成本表（按模型 `met7`、按员工 `met8`）共用同一渲染：`<caption data-testid="metG-a11y-caption">` 说明「成本分摊：<窗口> · 按模型/按员工 · 按<列><升降>排列」，视觉上 sr-only，不占版式。
- 排序控件是真 `<button type="button">`（Enter/Space 可触发），`th` 用 `aria-sort=ascending|descending|none` 表达方向；占比列不参与排序，因此没有 `aria-sort` 属性（不是 `none`）。
- 三个数值列（运行数/成本/占比）`th` 带 `scope="col"` 与既有 `.met6-num`（右对齐 + `tabular-nums`），testid `metG-a11y-th-runs|-cost|-share`。
- 数据行 `tr` 可聚焦（`tabIndex=0`）并有 `met7-row:focus-visible` 焦点环；`aria-label` 复述该行的运行数、成本、占比。
- 排序切换仍只写 `?sort/?dir`，**纯客户端重排，不发任何新请求**（测试实测：点击前后 `urls().length` 相等，值 0）。
- 验证：定向 vitest 62 passed（+4）；全量 132 files / 1466 passed（另 2 条上游 employee-detail 的 unhandled rejection 为既存噪声）；tsc `modules/metrics` 0 条；build EXIT 0。
- 未测项：真浏览器 375/1280 的焦点环视觉与 Tab 序未人工走查，仅 jsdom 断言 `tabIndex` 与 `activeElement`。

## 导出文件的口径列（metF，2026-11-20）

两份导出都把口径写进文件末尾，屏上版式与文件名不变：

- 分摊导出（metA，`shareCsv`）：表头 `group,runs,cost_usd,share_pct,as_of,window`；`as_of` = 当前分摊批次的采集时刻原值 ISO（模型源取 `hermes-usage` 顶层 `asOf`，员工源取账本行的 `updatedAt` 最大值），`window` = `24h|7d|30d`。
- 明细导出（met6，页面 `exportCsv`）：在原 8 列之后追加 `as_of` 与 `window`；`as_of` 取明细批次 `asOf`，整批同值。
- `as_of` 只接受 ISO-8601（新 `isoOrNull`：正则 + `Date.parse`），其它一律留空——不填本机时钟、不填自由文本；表头仍在，缺失不是 0。
- 文件名形状未变：`metrics-<view>-<window>-YYYYMMDD-HHmm.csv`（明细）/ `metrics-<window>-<group>-YYYYMMDD-HHmm.csv`（分摊）。
- 行数与屏上同源：分摊 = `metA-export-count` 的「可导出 N 行」= 表体行数；明细 = `met6-cat-source` 的「N 行」= 表体行数；测试取两侧实数比对。
- 屏上说明：`metF-export-asof-note`（「两份导出末尾都带「采集时刻」与「时间窗」两列…」），不出现字段名原文。
- RFC4180 转义沿用 `csvCell`（引号/逗号/换行 → 双引号包裹、`""` 转义，`\r\n` 分行）。
- 验证：定向 `vitest run src/modules/metrics` 66 passed；全量 132 files / 1470 passed（另 2 条既有 employee-detail unhandled rejection）；`tsc -b . --noEmit` 全仓 55 条既存基线、`modules/metrics` 0；build `vite build --outDir /tmp/build-metF` → entry `assets/index-D0ClJCu1.js` sha256 `9e29e33ff78075ad47a7e4fbd6851df3203970ae5186d0767dee11c421392532`（entry 内 `metF-export-asof-note` 0），chunk `assets/MetricsModulePage-tmH1B3OY.js` 命中 1。
- 未测项：真实 BFF 是否在每类读口都给顶层 `asOf` 未联调（缺则如设计留空）；员工源 `as_of` 取账本行最大 `updatedAt`（上游值，非本机时钟），与「顶层 ISO」口径的差异已在此记录。

## 部分读口失败的局部可用（metH，2026-11-20）

### 做了什么
- `loadUsage` 拆成「一次读一个块」：`readBlock`（单次读 + 单块失败态）→ `ledgerSnapshot`（员工目录 + 账本，按日/月）→ `fetchUsageBlock(kind, window)`（stats / prevRuns / day / month / pricing 五块各走自己的读链）→ `loadUsage` 顺序取五块。取数顺序与请求数与改造前一致。
- 单卡重试 `retryUsageBlock(kind)`：只调 `fetchUsageBlock` 该块一次，成功后原位替换该块，**不动** `loadedAt`（其余卡的「读取于」不跟着变，避免让没重读的卡看起来刚读过）。`retryingBlock` 提供 `aria-busy` 与禁用。
- 热力卡 `retryHeat()` 只重发 `run-activity`；页面「刷新」仍是全量重读。
- 全失败（stats/day/pricing 三块都不可用）才渲染整段错误卡，外层加 `metH-page-error`，保留 `met6-denied|met6-error`、`metD-card-rid`、`met6-retry`。
- 切窗/切视角：`loadUsage` 先把 `usage` 置回 `loading`，新批次的失败判定不会沿用旧批。

### testid
`metH-card-error-runs|cost|month|trend|price|heat`、`metH-card-retry-runs|cost|month|trend|price|heat`、`metH-page-error`、`metH-gap-rid-month`。met5/6/7/8/9/A/B/C/D/F/G 全族保持不变。

### 实测（jsdom）
- 单源失败：pricing 404（rid `req-metH-price`）→ 运行数 `0`、实扣 `$0.00`、账本明细表仍在；只有单价卡出现 `metH-card-error-price`（含「这项数据当前读不到」与 rid），无 `metH-page-error`。
- 单卡重试：点 `metH-card-retry-price` 后 `models/pricing` 请求 +1，`run-stats` / `run-activity` / `/api/employees` / `budget-usage` 请求数**全部不变**；单价表恢复、错误块消失，运行数与实扣数字未变。
- 全失败：500 全部读口 → `metH-page-error` 含 `req-metH-all`、`met6-retry` 存在；热力卡独立给出自己的错误与重试。
- 热力单卡重试：run-activity 超时（rid `req-metH-heat`）→ 页面其余数字照常；点 `metH-card-retry-heat` 后 `run-activity` +1，`run-stats` 与 `/api/employees` 不变，热力恢复。
- 定向 66 → 70 passed；全量 132 files / 1474 passed；tsc `modules/metrics` 0 条（全仓 55 条既存基线）；build entry `assets/index-CPs_U03b.js` sha256 `b7bbf53cbc702129743372ffef4c923801648cae8c5ee13021149f8d184b155e`，entry 内 `metH-card-error` 0，chunk `MetricsModulePage-w_6EPcss.js` 11 次。

### 未测项
- 真浏览器下逐个读口真实失败（网断、502）未演练；未测「重试期间用户切窗」的竞态（`retryUsageBlock` 用当前 `usageWindow.id`，切窗会触发全量重读覆盖）。
- 单卡重试不写 `sources` 的批次号之外逻辑：失败重试会更新该读口的新鲜度行（`loadJson` 同一 epoch），其余行不变——已在代码路径上确认，未单独加断言。

## 导出在部分失败下的一致性（metI，2026-11-20）

### 规则
- 两处导出只写**当前成功读块**的数据：明细的窗口起止列来自运行统计，读不到就留空（不填 0、不填本机时钟）；分摊要求自身分摊块可读，否则不生成文件。
- 只有该文件真正用到的读块才算「缺少」，注释不会把与该文件无关的卡片失败写进去（例如单价失败不影响两个 CSV：两份文件都没有单价列）。
- 有缺少时，CSV **末行**追加一行注记（单列，RFC 4180 转义）：`# 本次导出缺少 N 块：<块名>（<页面同一句人话原因>）`。没有缺少时不加任何行，文件形状与 metA/metF 时完全一致。
- `as_of` 仍只取 payload 顶层 ISO（缺失留空）；`window` 仍是当前时间窗 id。
- 整页失败（`usageDown`，即运行统计/账本/价目表三块都不可用）：两份导出按钮都 disabled，title「整页读取失败，这份导出暂时不生成；先重试上面的读取，读到数据再导。」，并显示 `metI-share-blocked`。
- 自身块不可用：明细则显示 `metI-detail-blocked` 且按钮禁用；分摊显示 `met7/met8-error` 且计数为 0、按钮禁用。

### testid
`metI-detail-gap`（屏上提前告知本次导出缺少哪些块）、`metI-detail-blocked`、`metI-share-blocked`。met5–metH 全族不变。

### 实测（jsdom）
- 运行统计失败（500，rid `req-metI-stats`）、成本明细正常：明细 CSV 表头末两列仍 `as_of,window`；数据行 = 屏上 `met6-row-*` 行数（= `met6-cat-source` 的 N 行）；窗口开始/结束两列为空串；末行 `# 本次导出缺少 1 块：运行统计（这次没能读取这项数据，请稍后重试。）`；文件无 `undefined`/`NaN`。
- 单价失败、其余正常：屏上有 `metH-card-error-price`，分摊 CSV 行数 = `metA-export-count` 的 N（示例 2），表头仍 `group,runs,cost_usd,share_pct,as_of,window`，**无**注记行（单价不是该文件的列）。
- 分摊自身源失败（hermes-usage 503）：按钮 disabled、`可导出 0 行`、错误卡在，不产生空文件。
- 全失败：两钮均 disabled 且 title 含「整页读取失败」，`metI-share-blocked` 在，`met6-retry` 仍在（有回头路）。
- 定向 70 → 74 passed；全量 132 files / 1478 passed；tsc `modules/metrics` 0；build entry `assets/index-mg2zWAxY.js` sha256 `06495b1f211c9bb193009ddbaf9c3f06597378a55c6206fba056982b7b93a262`，entry 内 metI/metH 均 0，chunk `MetricsModulePage-DqFsjhUs.js`：metI 1、metH 11、注记文案 2。

### 未测项
- 真浏览器下载路径未人工走查（沿用既有 Blob/anchor 机制，未改）。
- 未测「注记行被 Excel 打开后的显示」；按 RFC 4180 单列字段处理，未做 Excel 特化。

## 导出顺序与屏上一致（metJ，2026-11-20）

### 改了什么 / 为何此前可能不一致
- 明细：把表体行序固化成**一个数组** `detailLines`（`breakdownView.kind === 'ready' ? breakdownView.lines : []`），表格 `<tbody>` 与 `exportCsv` 都只读这一数组。此前两边虽然都从 `breakdownView.lines` 取，但导出侧直接引用 `breakdownView.lines` 再走 `map`——一旦未来表格加了排序/切片而导出没跟上，就会出现「屏上一套、文件一套」。现在顺序只有一个来源。
- 分摊：导出在注释处明确「消费的正是表格渲染的 `shareRows`」（已按 `?sort/?dir` 排序，默认成本降序，`sortModelCost` 决定 null 排最后），导出侧不再有任何重排。
- 新增屏上说明 `metJ-export-order-note`：「两份导出逐行照屏上表体顺序写：屏上第一行就是文件第一行。分摊按当前排序（默认成本从高到低），明细照表体原序。」
- 注记行（metI 的「本次导出缺少…」）仍固定末行，且不计入 `可导出 N 行` / `N 行`。

### 实测对照（jsdom，逐值）
- 明细（`?view=model`，两行）：屏上首行 `qwen-plus`、末行 `deepseek-v4`；CSV 数据行首格依次 `qwen-plus`、`deepseek-v4`（完全相等）。
- 分摊默认（无 sort/dir）：屏上 `zeta、alpha、mid`（成本降序，null 末）；CSV 首格依次相同，首 `zeta` / 末 `mid`。
- 分摊 `?sort=model&dir=asc`：屏上 `alpha、mid、zeta`；CSV 首格依次相同，首 `alpha`。
- 明细带缺口（运行统计 500）：数据行顺序仍与表体逐行相同，末行是 `# 本次导出缺少 1 块：运行统计（…）`，数据行数不变。

### testid
`metJ-export-order-note`（新增）。met5–metI 全族不变。

### 验证
- 定向 74 → 78 passed；全量 132 files / 1482 passed（2 条上游 employee-detail unhandled rejection 为既存噪声）。
- `tsc -b . --noEmit`：`modules/metrics` 0 条。
- build `/tmp/build-metJ`：entry `assets/index-BzlUpiPy.js` sha256 `d0758452d921455bbdb7bcf9957ce715f54a3119b4c68ec9ac6294d67bf92cc1`，entry 内 `metJ-export-order-note` 0；chunk `MetricsModulePage-DEi3bydN.js`：metJ 1、metI 1。

### 未测项
- 真浏览器下载与 Excel 打开未走查（顺序与转义均为字符串级断言）。
- 明细表目前没有排序控件，故「明细跟 ?sort」不适用；若将来给明细加排序，必须同样改 `detailLines` 这一处（代码注释已写明）。

## 图表可访问性替代（metK，2026-11-20）

- **每个热力格**：`aria-label` 由 `heatCellLabel(cell, weeks, to)` 生成 —— 日期（`cellRangeLabel`，最近多周时给「最近 N 周 · 周三 08:00–08:59」）+ `运行 N 次` + `强度 N 档（共 4 档）`；接口没返回的格子写「无数据」，不写 0。7 天小时热力（`met6-heat-cell-*`）的标签同样补上强度档位。
- **整图替代句**：热力网格容器 `role="img"` + `aria-describedby="metK-heat-summary"`；`metK-heat-summary` 是 sr-only 一段：`heatGridSummary()` 现算「总运行 X 次；最高 周三 50 次；最低 周二 45 次；覆盖 7 / 7 天」。无可用格子时只说明「没有总数可报，也不按 0 补」。
- **以表格查看**：`metK-table-toggle`（原生 button，`aria-expanded` / `aria-controls`）默认收起；展开得到 `metK-table`：`caption`「按星期汇总的运行次数（窗口范围）」+ `th scope="col"`（星期 / 运行数），逐星期一行，无数据的星期显示「—」。展开/收起只改本地状态，不动 `?window=` / `?w=`，也不发请求。
- **趋势图**：`met6-sparkline` 保留 `role="img"`，新增 `aria-describedby="metK-trend-summary"`；摘要由 `sparkSummaryText()` 现算「共 N 个时段有记录；首值 …；末值 …；峰值 …；最低 …。没有返回的时段不计入」。
- **同源**：热力摘要与表格取自 `grid = buildHeatGrid(view.activity)`，趋势摘要取自同一个 `spark = sparkSlots(...)`；不另发请求（测试实测展开/收起前后请求数相等）。
- 验证：定向 82 例（基线 78，+4）；全量 132 files / 1486 passed（另有 2 条上游 employee-detail unhandled rejection 为既存噪声）；tsc 全仓 55 条既存基线、`modules/metrics` 0；build entry `assets/index-BRl7Bi9x.js` sha256 `5c65bb2f…24d6`，entry 内 `metK-heat-summary` 0，chunk `MetricsModulePage-BN_0W06-.js` 三个 metK 标记各 1。
- 未测项：真浏览器 + 读屏软件走查未做（标签为 DOM 字符串断言）；表格按星期汇总而非按具体日期拆分（活动接口的格子轴就是星期 × 小时，最近多周时为聚合值）。

## 当前视图摘要复制（metL，2026-11-20）

页头「复制摘要」把当前窗口的关键数字写成纯文本，直接进剪贴板；同一段文字在剪贴板被拒时落到页面上的可选中文本框。

- 文案（逐行）：`运行分析摘要` / `窗口：<名称>（<id>）` / `运行数：<N|—>` / `实扣金额：<$x.xx|—>` / `占比口径：成本分摊按<模型|员工>分组的账本实扣计算，占比合计 100%，保留一位小数` / `采集时刻：<北京时间到分|—>` / `生成时刻：<北京时间到分>（北京时间）`。
- 数据同源：运行数取 `usage.stats.totals.runs`，金额取 `usage.day.total`，占比口径取页面 `groupBy`，采集时刻取本批 `run-stats` 与 `budget-usage` 各自顶层 `asOf/asOfSource` 中较晚的一个（`isoOrNull` 只认 ISO）；生成时刻在点击瞬间取本机时钟。**复制处理函数不发任何请求**——实测点击前后 `urls().length` 相等。
- 真 0：运行数 `0`、金额 `$0.00`；缺失：各自 `—`，不按 0 补。文本内不含内部 id、字段名、凭据。
- 反馈：`metL-copy-status` 为 `role="status" aria-live="polite"`，成功「已复制」；失败「复制没成功」并渲染 `metL-fallback`（`textarea` 只读、聚焦即全选、内容与剪贴板目标逐字相同）。
- testid：`metL-copy`、`metL-copy-status`、`metL-fallback`、`metL-fallback-text`；met5–metK 全族不变。
- 验证：定向 86（基线 82）；全量 132 files / 1490 passed（另 2 条上游 employee-detail 未处理拒绝为既存噪声）；`tsc` 全仓 55 条既存、本模块 0；build entry `assets/index-CntxHrw-.js` sha256 `5459a683696af4bdb8fea81ac371418ef92a6453a74c6e98462652b5e3e6f3ee`，entry 内 `metL-copy` 命中 0，chunk `MetricsModulePage-Ua4kF51Z.js` 命中 1。
- 未测项：真浏览器剪贴板权限拒绝路径未实机走查（以 mock 返回 false 覆盖）；复制内容粘贴到外部编辑器未人工比对。

## 数据新鲜度滞后提示（metM，2026-11-20）

metB 的「采集时刻」列内新增滞后徽标，不新增列、不改版式。

- 判据：每个读口的顶层 ISO `asOf` 与本客户端**本次读取完成时刻**比较；差值 > 15 分钟（`SOURCE_STALE_MS`）标「数据可能滞后」。读取时刻随成功响应写入 `SourceStamp.fetchedAt`，只与产生该 `asOf` 的那次读取配对。
- 缺失/非 ISO：`asOf` 一律「—」，**不判滞后**（也绝不把本机时钟当采集时刻）。
- title 写清三个事实：采集时刻、读取时刻、判据「读取时刻比采集时刻晚超过 15 分钟」；并注明读取时刻不是数据时刻。
- 切窗/切视角/重试会清空本批 stamps 并重新判定；展开态不变。
- testid：`metM-stale-<key>`（仅滞后时存在）；`metB-source-asof-<key>` 文本仍为纯时间（徽标是其兄弟节点），metB/metC 既有断言不变。
- 验证：定向 90（基线 86）；全量 132 files / 1494 passed（2 条上游既存噪声）；tsc 全仓 55 既存、本模块 0；lint 0 error；build entry `assets/index-BuqX7qEx.js` sha256 `d13e24166f58b7a39cdc4236d366916faeba2a460b82113613958be7a4dbaff4`，entry 内 `metM-stale`=0，chunk `MetricsModulePage-CGLfyiDt.js`=1。
- 未测项：真实上游滞后返回未联调（以固定 asOf 偏移覆盖）；浏览器时钟偏差场景未测。

## 口径回归护栏（metN，2026-11-20）

新增 `web/src/modules/metrics/metrics.caliber.test.ts`（`.ts`，无 JSX），把已交付的六条口径钉成回归断言；每条断言都在标题里写明它守的是哪一条。

- R1 真 0 ≠ 缺失：屏上 `$0.00` vs `—`；导出 `0.00` vs 空字段。
- R2 采集时刻只取 payload 顶层 ISO：六个别名 `asOf / as_of / collectedAt / collected_at / generatedAt / generated_at` 任一合法即用；非 ISO、缺省、空串、嵌套对象一律 null，屏上「—」且 title「上游未返回采集时刻」。用假时钟（`vi.setSystemTime('2031-03-04T05:06:07Z')`）验证屏上与导出都不出现该本机日期。
- R3 滞后判定：`asOf` 与本次读取时刻都为真 ISO 才计算；差值 > 15 分钟才标；恰好 15 分钟、缺失、非 ISO、负值（未来）都不标。
- R4 导出行序 = 表体行序：默认成本降序与 `?sort=model&dir=asc` 两种，CSV 首列顺序逐项等于屏上 `met7-row-*` 首列顺序。
- R5 缺块注记：固定为末行、以 `# 本次导出缺少 N 块：…` 开头，不进入数据行、不计入「可导出 N 行」；无缺块时不加行。
- R6 口径列恒在：`SHARE_CSV_HEADER` 末两列恒为 `as_of,window`，缺值留空；零行时仍只有表头；文件带 UTF-8 BOM（按字节 `EF BB BF` 断言）。

发现并修复（同单产品改动）：`readSourceStamp` 原先只认 `payload.asOf`，`readPricing / readModelUsage / readModelCost` 用 `text()` 接受任意字符串——不满足「六个别名 + 只认 ISO」。现统一走新增的 `readTopAsOf(payload)`（按 `TOP_ASOF_KEYS` 顺序取第一个合法 ISO），四个读取函数共用同一判据。

- 验证：单文件 12 例；`src/modules/metrics` 2 files / 102 passed；全量 133 files / 1506 passed（2 条上游 employee-detail 未处理拒绝为既存噪声）；`tsc` 全仓 55 条既存基线、`modules/metrics` 0。
- build entry `assets/index-DZ3ixbOI.js` sha256 `e3d1042d0f4692ab3df331a33ac48a79922a69cabfb5742bcbaa8f25341369fc`，entry 内 `readTopAsOf` 与 `metB-source-toggle` 均 0；chunk `MetricsModulePage-C2Expni7.js` 内 `metB-source-toggle` 1。
- 未测项：浏览器真实剪贴板/下载与表格顺序的人工对照未走查（均为字符串级断言）；`asOf` 恰为未来时间时不判滞后，属设计选择，未与上游约定核对。

## 数值格式与单位一致性（metO，2026-11-20）

### 一套数位，两层装饰

`metrics.ts` 把格式化拆成两层，屏幕与文件共用同一套四舍五入：

| 层 | 函数 | 输出 |
|---|---|---|
| 数位（文件/求和） | `usdDigits(v)` | `1234.50`、`0.00`，缺失 `null` |
| 数位（文件/求和） | `digitsPct(v)` | `75.0`，缺失 `null` |
| 屏幕 | `formatUsd(v)` | `$1,234.56`、`$0.00`、`—` |
| 屏幕 | `formatCount(v)` | `1,234`、`—` |
| 屏幕 | `formatSharePct(v)` | `75.0%`、`—` |

`formatUnitPrice`、`shareCsvRows`、明细导出的金额与占比都改为调用上面两个数位函数，屏幕则调用装饰函数 —— 两处小数位只由一处代码决定。

### 屏幕 ↔ 文件对照（2 组，实测）

数据：`big` 1234 次 / 1234.5 USD，`bulk` 1200 次 / 1000 USD。

| 值 | 屏上 | CSV |
|---|---|---|
| 金额 | `$1,234.50` | `1234.50` |
| 次数 | `1,234` | `1234` |

即同一精度，CSV 去掉 `$` 与千分位（`1,234.56` 的逗号会被当成字段分隔符），表头已带 USD / %。

### 真零与缺失

`zero`（0 次 / 0 USD）与 `none`（两字段都缺）同屏：屏上 `0` / `$0.00` 对 `—`；CSV `zero,0,0.00` 对 `none,,`。不把缺失写成 0。

### 单位说明

- 明细表：`支出（USD）`（title 金额单位·两位小数，`metO-fmt-th-spend`）、`次数（次）`（`metO-fmt-th-count`）、`占比（%）`（`metG-a11y-th-share`）。
- 分摊表：运行数列 `data-metO-unit="次"`、成本列 `data-metO-unit="USD"`、`占比（%）`（`metO-fmt-th-pct`）。
- 分摊区说明 `metO-fmt-note`：「数字口径：计数与金额按千分位分组（如 1,234 与 $1,234.56），占比保留一位小数（如 12.3%）；金额只以美元（USD）记，次数只以次记，不再混用别的单位。缺失显示「—」，真实的零显示 0 或 $0.00。导出文件沿用同一套小数位，只去掉符号与千分位，方便程序读取。」

### 验证

- 定向 `vitest run src/modules/metrics` → 2 files / 106 passed（基线 102，+4）。
- 全量 `vitest run` → 133 files / 1510 passed（基线 133/1506，+4）；`Errors 2` 为上游 employee-detail 既存噪声。
- `tsc -b . --noEmit` → 全仓 55 条既存基线，`modules/metrics` 0 条（一次修正：移除未使用的 `digitsPct` 导入）。
- build `--outDir /tmp/build-metO` → entry `assets/index-AnzFwKuS.js` sha256 `fca55468b44d82b8018f9a3e00a48a22f5ffd92043e274d9c1d244d42eb4e94a`，entry 内 `metO-fmt-note` = 0；chunk `assets/MetricsModulePage-D7z_fTpv.js` 命中 1。
- 已知改动：既有「员工成本分摊」断言中的占比由 `75%` 改为 `75.0%`（口径统一为一位小数，未放宽断言）。

未测：真浏览器 375/1280 下千分位不折行未逐像素走查；CSV 在 Excel 中打开未实测（逗号在字段内仍由 RFC 4180 转义保证）。

## 明细表列排序与导出一致（metP，2026-11-20）

- 三列可排序：次数 / 支出（USD）/ 占比（%）。表头里是真 `button[type=button]`（`metP-sort-runs|cost|share`），Enter/Space 原生触发，`:focus-visible` 有焦点环；`th[aria-sort]` 三态 `ascending|descending|none`，指示符由 CSS `::after` 画，不污染表头文本。
- URL 是排序的唯一来源：`?dsort=<runs|cost|share>&ddir=<asc|desc>`。默认「支出降序」不写键；点表头只改 URL，**不发请求**（测试实测点击前后 `urls()` 长度相等）。
- 顺序规则 `sortDetailLines()`：null/缺失一律沉底（两个方向都沉底），真实 0 照常参与排序，等值保持上游原序（稳定）；占比按数值比较，不按字符串。
- 一张数组喂两处：`detailRows = sortDetailLines(detailLines, …)`，表体与明细 CSV 同读这一数组，导出永不另排。缺块注记仍固定末行、不计入行数。
- 屏上说明 `metP-export-order-note`：「表头可以点着换排序：默认按支出从高到低；缺数据的行总是排在最后，真实的 0 照常参与排序。导出文件按屏上现在的顺序写，行数与这里列出的行数一致。」
- 列表头单位（metO）不变：`支出（USD）` / `次数（次）` / `占比（%）`；metG 的表名与行 aria-label 保留；`metG-a11y-th-share` 现在态为 `aria-sort="none"`（该列已可排序，原「无该属性」断言据此更新，属语义变化不是放宽）。
- 实测对照（屏上 ↔ CSV，两处都取第一列）：
  - 默认：屏 `小鲤, 小满, 阿吉`（$20.00 / $5.00 / $0.50）↔ CSV `小鲤, 小满, 阿吉`。
  - `?view=model&dsort=runs&ddir=asc`：屏 `zero, zeta, alpha, mid`（0/4/9/缺）↔ CSV 同序，缺次数的 `mid` 在两端都沉底。
  - `?dsort=share&ddir=asc`：屏 `阿吉, 小满, 小鲤`（2.0% / 19.6% / 78.4%），首行 2.0% 证明不是按字符串排。
- 验证：`src/modules/metrics` 2 files / 111 passed（基线 106，新增 metP 5 例）；全量 133 files / 1515 passed（2 条上游 employee-detail 未处理拒绝为既存噪声）；tsc 全仓 55 条既存、`modules/metrics` 0；build entry `assets/index-Btr0ReBT.js` sha256 `6f79263d2f858921b7b9afc31b28d17952261f6b774015170baf1a9c9b735ac6`，entry 内 `metP-sort-cost`=0，chunk `assets/MetricsModulePage-BKuk0soJ.js` 内 1。
- 未测项：真浏览器 375/1280 下表头按钮与指示符的像素对齐未走查（按钮无 padding，尺寸随字体）；键盘 Enter/Space 仅以原生 button 语义保证，未用真实按键事件回放。

## 卡片键盘可达与状态播报（metQ，2026-11-20）

- 五张主卡可键盘遍历：`met6-runs` / `met6-cost` / `met6-trend` / `met6-price` / `met5-heatmap` 都加了 `tabIndex={0}` 与 `metQ-card`，焦点锚点用 `id="metQ-card-focus-<key>"`（元素本身已有 `data-testid`，不覆盖旧 testid）。`:focus-visible` 用 2px `--color-ring`，offset 2px。
- 没有正数 tabIndex；卡内按钮/链接保持原生 Tab 序。键盘走查前 8 个落点（DOM 顺序实测）：`metL-copy` → `met5-refresh` → `met6-window-24h` → `met6-window-7d` → `met6-window-30d` → `met6-runs` → `met6-cost` → `met6-trend`。
- 播报区：`<p class="sr-only" role="status" aria-live="polite" data-testid="metQ-live">`。签名 = 使用块状态 + 空窗判定 + 明细/热力/预算/分摊状态；签名不变不重播。三句文案：全失败「这一页的数据暂时都读不到，卡片上写着原因，可以重试。」；部分失败「有 N 项数据暂时读不到，卡片上写着原因。」；空窗「这个时间窗没有运行记录，也没有实扣。」；有数据「数据已更新，卡片和下方的表格都读到了。」。
- 可复制的请求编号只留在卡片（`metC-source-rid-*`、`metH-card-retry-*` 旁），live 区文案不含编号（测试断言 `req-metQ-1` 不出现）。
- `prefers-reduced-motion: reduce` 下对 `.met5-page` 全子树把动画/过渡压到 0.001ms、滚动改 auto；页面本身没有持续动画。
- 验证：`src/modules/metrics` 2 files / 114 passed（基线 111，新增 3 例）；全量 133 files / 1518 passed（2 条上游 employee-detail 未处理拒绝为既存噪声）；tsc 全仓 55 条既存、`modules/metrics` 0；build entry `assets/index-BoxvT4Tc.js` sha256 `b6eaa53b967e072cc789f99acff0e9b4f27a870ad47563a64afd335de5440c16`，entry 内 `metQ-live`=0，chunk `assets/MetricsModulePage-DSjndMTB.js` 内 `metQ-live`=1、`metQ-card-focus`=1。
- 未测项：真浏览器 Tab 走查与焦点环像素未人工走查（落点来自 DOM 顺序）；`prefers-reduced-motion` 未在真实 OS 开关下目测。

## 异常态下的导出与复制可用性（metR，2026-11-20）

统一判据：**整页失败才全停；单块失败只停用它自己的出口；空窗只写表头。** 三处动作各自有 `title` 说明原因，页面另有 `metR-export-state`（明细+分摊）与 `metR-copy-state`（摘要）两行状态。

- 整页错误（所有使用块不可读，`pageFailed`）：`met6-export` / `metA-export` / `metL-copy` 三钮 disabled。title 首句：导出两钮「整页读取失败，这份导出暂时不生成；先重试上面的读取，读到数据再导。」；摘要「整页读取失败，摘要里的数字不完整，先重试上面的读取。」。状态行：「导出：整页读取失败，两处 CSV 都暂停」「摘要不可复制：整页读取失败」。
- 单块降级：明细导出仍可用（title「导出明细 CSV：当前窗口与当前分类下账本逐行的实扣明细，不是分摊汇总。」），文件内末行注记缺块（沿用 metI，例如「# 本次导出缺少 1 块：运行统计（…）」，不计入行数）；分摊导出只在自己这块可读时可用，自己读不到则 disabled，title「这份分摊现在读不到，导出暂不生成：<原因>」；状态行「明细可导 N 行（含 1 处缺块注记）；分摊可导 M 行 / 暂不可用」。
- 空窗：明细与分摊都可用，导出的文件只有表头（明细表头仍以 `as_of,window` 结尾）；`metA-export-count` 显示「可导出 0 行」；标题「当前窗口没有明细行：导出的文件只写表头，缺块会在末尾注明。」/「当前视图没有分摊行：导出的文件只写表头，计数仍显示 0 行。」。摘要可复制（数值为真 0 与「—」）。
- 行为变更（有意）：0 行不再禁用导出（旧「当前视图无可导出数据 / 当前没有可导出的行」判定撤掉），对应两条既有断言改为「可导且只写表头」，属口径变化不是放宽。
- 验证：`src/modules/metrics` 2 files / 106 passed（改动前本文件 102）；全量 137 files / 1590 passed；tsc 全仓 55 条既存、`modules/metrics` 0；build entry `assets/index-C5NmlUop.js` sha256 `72b79adb257ca2cf5aafa1adc0a89a2122b8a44be05923d920854f3bb0689d2a`，entry 内 `metR-copy-state`=0，chunk `assets/MetricsModulePage-DA4cZaLo.js` 内 copy/export 状态标记各 1。
- 未测项：真实浏览器逐钮 hover 看 title 未走查；`disabled` 后键盘焦点顺序变化未人工过一遍。

## 分组切换与排序/窗口语义（metS，2026-11-20）

切换「按员工 / 按模型」分组时，四个 URL 参数各有固定语义：

- `dsort` / `ddir`（明细排序）：**重置**为默认成本降序；仅当切换前确实带过排序键时，表下出现一行 `metS-reset-note`：「切换分组后，明细排序已回到默认的成本降序；时间窗与分摊的排序、分组选择保持不变。」没有可重置的键时不显示。
- `window`（时间窗）：**保留**，两个分组共用同一时间窗。
- `sort` / `dir`（分摊排序）：**保留**；`sort=model` 恒指「名称列」（模型组是模型名，员工组是员工名），因此在两个分组里都合法，不需要重置。
- `groupBy` 本身只在分摊区切换时写入/删除；切换分组不会清掉明细视角（`view` 独立）。

取数代价（实测，`urls()` 增量）：员工 → 模型只发 `hermes-usage` 1 次，`/api/employees` 与 `budget-usage` 各 0 次；模型 → 员工发 `/api/employees` 1 次、`budget-usage` 2 次（当日 + 前一窗口各一次）、`hermes-usage` 0 次；分摊组模型 → 员工发 `/api/employees` 1 次、`hermes-usage` 0 次。没有重复请求。

粘贴 URL 复现：`?view=model&dsort=runs&ddir=asc` → 明细首行 `zero`（次数 0 最先）、次数列 `aria-sort="ascending"`、排序键仍在 URL；`?view=employee&sort=model` → 分摊按名称升序（模型组首行 `alpha`），明细视角为员工，两者互不干扰。

metR 三态口径未变：导出/复制的可用性只由整页失败或各自块的可读性决定，分组切换不引入新判据。验证：`src/modules/metrics` 2 files / 110 passed（此前 106）；全量 137 files / 1594 passed；tsc 全仓 55 条既存、`modules/metrics` 0；build entry `assets/index-BNRlwe1n.js` sha256 `062c00ed9a5d346e206dfe080f706ea02cf59dc5b8547ef4fdaa74f8ce0ec652`，entry 内 `metS-reset-note`=0，chunk `assets/MetricsModulePage-Cc_AE2nF.js`=1。
- 未测项：真浏览器下三个断点切换分组后的视觉跳动未走查；分享链接跨会话（另一浏览器）复现未实测。

## 合计行与占比余数口径（metT，2026-11-20）

`/metrics` 的两张成本表（明细表与分摊表）在表尾各加一行合计，数值全部由表体当前渲染的行现算——不另发请求，也不读别的口径。

| 位置 | testid | 合计口径 |
| --- | --- | --- |
| 明细表（成本明细） | `metT-total-row` | 支出=各行 `costUsd` 相加（员工视图）；次数=各行 `count` 相加（模型视图）；占比=按 `breakdownView.total` 用未舍入原值相加 |
| 明细表单元格 | `metT-detail-total-cost` / `-count` / `-share` | 读不到的格子不计入、不按 0 计：整列都读不到时该格显示「—」 |
| 分摊表 | `metT-total-row-share` | 运行数=各行 `runs` 相加；成本=各行 `costUsd` 相加；占比=按可读实扣合计、未舍入原值相加 |
| 分摊表单元格 | `metT-share-total-runs` / `-cost` / `-share` | 同上；无任何可读金额时占比为「—」 |

- 占比口径：逐行仍按一位小数四舍五入（`shareOf` / `shareOfCosts`），合计行用 `shareOfWhole(values, total)` 从未舍入的原值计算，所以合计恒等于「可读部分之和」，占满时显示 `100.0%`，不会出现 99.9% 或 100.1%。两处表下各有说明：分摊表 `metT-rounding-note`、明细表 `metT-rounding-note-detail`，文案含「合计行不参与排序」「导出文件的行仍是逐行明细，合计不写进数据行」。
- 排序：合计行在 `<tfoot>`，不含按钮、不带 `aria-sort`，点表头排序只重排 `<tbody>`；`?dsort/?ddir` 变化时合计值逐项不变（求和不依赖顺序）。
- 导出：CSV 只写数据行，合计不入文件（脚本消费时不会被一行假数据污染）；缺块注记仍是文件末行（metI/metR 口径不变）。
- 零与缺失：真 0 照常显示 `$0.00` / `0`；读不到仍是「—」。仅当整张表没有可渲染的行时表不出现，随之也没有合计行——不造 0 行。
- 实现：`metrics.ts` 新增 `sumOrNull(values)` 与 `shareOfWhole(values, total)`；页面在 `detailRows`、`shareRows` 之后派生合计；`metrics.css` 追加 `.metT-total`（上边框 + 加粗）。
- 验证：定向 `src/modules/metrics` 2 files / **126 passed**（基线 122，+4）；全量 **137 files / 1598 passed**（基线 1594）；`tsc -b . --noEmit` 全仓 55 条既存、`modules/metrics` 0 条；build `--outDir /tmp/build-metT` → entry `assets/index-FTaUJaPP.js` sha256 `3011587172ba040f2274021162b69ed54271a6f576f3178ad4428cf2107b68c7`，entry 内 `metT-total-row` 命中 0，chunk `assets/MetricsModulePage-BSbHJEAm.js` 命中 1。
- 实测对照：分摊表（`SHARE_USAGE`：zeta 4 次/$3.00/75.0%、alpha 9 次/$1.00/25.0%、mid 无金额）——表体运行数 4+9=13，合计行 `13`；成本 3.00+1.00=4.00，合计行 `$4.00`；占比 75.0+25.0=100.0，合计行 `100.0%`。明细表（`TWO_EMPLOYEE_LEDGER`）——成本 3.00+1.00=4.00，合计行 `$4.00`，占比合计 `100.0%`，次数列因账本无次数显示「—」。
- 未测项：真浏览器 375/1280 下合计行的表格内横滚与列宽未人工走查；上游若返回超过两位小数的金额，逐行与合计的四舍五入可能差 0.01，属上游数据形态问题，未构造该样例。

## 摘要与合计行同源（metU，2026-11-20）

`metL-copy` 复制出来的纯文本摘要里追加一行合计，它与分摊表的合计行共用同一份渲染结果——不是另算一遍。

- 代码路径：`MetricsModulePage.tsx` 里 `shareRunsTotal = sumOrNull(shareRows.map(runs))`、`shareCostTotal = sumOrNull(shareRows.map(costUsd))`、`sharePctTotal = shareOfWhole(costs, shareCostTotal)`，紧接其后一次渲染成 `shareTotals = { runs: formatCount(…), cost: formatUsd(…), share: formatSharePct(…) }`；表尾三个 `<td>`（`metT-share-total-runs/-cost/-share`）与摘要行都只读这三个字符串，别处不再调用格式化函数。
- 摘要行：`summaryTotalLine`＝`合计：运行 {runs} · 成本 {cost} · 占比 {share}`；`shareRows.length === 0` 时写 `合计：该窗口无可渲染行`，不造 0 行。该行经 `metricsSummaryText({ …, totalLine })` 原样插在「实扣金额」之后。
- 屏上可核对：`metU-copy-total`（sr-only，内容即摘要里那一行）与表尾单元格逐字相同；分摊表下方 `metU-consistency-note` 复述同一串，并写明「缺失的格子写「—」，整表没有可渲染的行时不造合计」。
- 语义：可读的 0 仍是 `$0.00`；读不到的列仍是「—」；无可渲染行时才用「该窗口无可渲染行」。
- 零新请求：复制前后 `urls()` 长度相等（测试里断言）。
- 回退：`metL-fallback-text` 的只读 textarea 内容与剪贴板目标逐字相同，自然含这一行；`metL-copy-status` 的 aria-live 与 `metR-copy-state` 三态未改。
- 验证：定向 `src/modules/metrics` 2 files / **130 passed**（基线 126，+4）；全量 **137 files / 1602 passed**（基线 1598）；`tsc -b . --noEmit` 全仓 55 条既存、`modules/metrics` 0 条；build `--outDir /tmp/build-metU` → entry `assets/index-89hAyraB.js` sha256 `dd05bead81200b5705a8a8fcd3982c9b7778a38a2b93e2fc5630b7c4ab6afc77`，entry 内 `metU-copy-total` 命中 0，chunk `assets/MetricsModulePage-BMM35ITN.js`：`metU-copy-total`=1、`metU-consistency-note`=1。
- 两处逐字对照（`SHARE_USAGE`）：表尾 `13` / `$4.00` / `100.0%` ↔ 摘要行 `合计：运行 13 · 成本 $4.00 · 占比 100.0%` ↔ `metU-copy-total` 同串。
- 未测项：屏幕阅读器对 sr-only 摘要行的实际播报未人工走查；真浏览器 375 下说明段换行未走查。

## 导出附合计注释行（metV，2026-11-20）

两处导出（明细 `met6-export`、分摊 `metA-export`）在数据行之后各写一条注释行，数值与屏上合计行同一份渲染结果。

- 形态：`# 合计：…`，单行、原样写入，不经 CSV 引号转义——即使值里带逗号（如 `1,234`）也不会被拆成多列或被误读成数据行。实现：`metrics.ts` 的 `withTotalsNote(body, totalLine)` 直接在 CSV 正文后追加 `\r\n# <totalLine>`。
- 取值：分摊文件用 `summaryTotalLine`（metU 里由 `shareTotals` 渲染，与 `metT-total-row-share` 同源）；明细文件用 `detailTotalLine`（metT 的 `detailTotals` 渲染，与 `metT-total-row` 同源）。两处都没有第二次求和或第二次格式化。
- 顺序：数据行 → 合计注释行 → 缺块注记行（`# 本次导出缺少 N 块：…` 恒为最后一行）；三层都不计入「可导出 N 行」。
- 行数一致性（实测，`SHARE_USAGE`）：屏上表体 3 行，`metA-export-count` 显示「可导出 3 行」，文件去掉注释行后为表头 + 3 行 = 4 行；明细（`usageRouter` 默认账本 2 行）：屏上 2 行、`met6-cat-source` 与 `metR-export-state` 都写 2 行、文件表头 + 2 行 + 注释。
- 空窗口：只有表头 + `# 合计：该窗口无可渲染行` 两行，不写「运行 0」之类。
- 零与缺失：可读的 0 在注释里仍是 `$0.00`；读不到的列仍是「—」（明细默认账本示例：`# 合计：成本 $0.00 · 次数 — · 占比 —`）。
- 屏上说明：`metV-export-total-note`（导出按钮旁）写明注释行的位置与「不计入可导出行数」。
- `as_of`/`window` 列语义与位置未变（明细仍在第 9、10 列，分摊仍在末两列）。
- 验证：定向 `src/modules/metrics` 2 files / **134 passed**（基线 130，+4）；全量 **137 files / 1606 passed**（基线 1602）；`tsc -b . --noEmit` 全仓 55 条既存、`modules/metrics` 0 条；build `--outDir /tmp/build-metV` → entry `assets/index-q40dkrMb.js` sha256 `56d5613ec507f1b4bf39d31a336902c523f854cd57fe6d98fd7d8b593f73087b`，entry 内 `metV-export-total-note` 命中 0，chunk `assets/MetricsModulePage-Bj3YiHg-.js` 命中 1。
- 既有断言的处理：十处「CSV 总行数」原先等于表头+数据（+注记），现按语义改为「数据行数」口径（测试内 `dataOnly()` 过滤 `#` 注释行），未放宽任何数值断言；metN R4 的列序断言同样只比较数据行。
- 未测项：Excel/Numbers 打开时对 `#` 开头行的呈现未人工走查；真浏览器 375 下导出按钮旁的说明换行未走查。

## 窄屏宽表：滚动区域与首列锚定（metW，2026-11-20）

375 宽下两张宽表（成本明细、成本分摊）都能不丢列地读完：横滚仍在表内，键盘也能滚。

- 滚动区域：明细表 `metW-scroll-detail`（`aria-label="成本明细表，可横向滚动"`）、分摊表 `metW-scroll-share`（`aria-label="成本分摊表，可横向滚动"`），两者都是 `role="region"` + `tabIndex=0`，在既有的 `.met6-table-scroll`（`overflow-x: auto`）之上只加语义与键盘行为，不改列数、列宽与数值格式。
- 键盘：`handleTableScrollKeys` 只接管 `ArrowRight`/`ArrowLeft`（步长 48px，左边界钳到 0）与 `Home`（回到 0），调用 `preventDefault`；其它键原样放行（Tab 仍按阅读顺序走）。焦点环 `.met6-table-scroll.metW-table:focus-visible { outline: 2px solid var(--color-ring) }`。
- 首列锚定：`.metW-table th:first-child, .metW-table td:first-child { position: sticky; left: 0; z-index: 1; background: var(--color-card) }`，表头首格 `z-index: 2`；不透明底色是防止滑动的单元格透出来，z-index 只在首格上，不盖住滚动内容。
- 提示：375 以下显示 `metW-scroll-hint`（明细）与 `metW-scroll-hint-share`（分摊），文案「左右滑动查看全部列」；`.metW-scroll-hint{display:none}` + `@media (max-width:767px){display:block}` 纯 CSS 断点，无 JS resize 监听。
- 三档读数：本车道没有浏览器探针（`web/node_modules` 无 playwright/puppeteer），jsdom 不做布局，实测 `document.documentElement.scrollWidth === clientWidth`（两者均为 0）在 1440/1280/375 三档均成立，属结构性检查；真实像素级的 `scrollWidth/clientWidth` 与 375 手势滚动未在浏览器复测，列为未测项。可确定的是页面根节点不新增任何宽度来源：表格宽度仍受 `.met6-table-scroll` 包裹，`min-width` 只在表内。
- 验证：定向 `src/modules/metrics` 2 files / **138 passed**（基线 134，+4）；全量 **137 files / 1610 passed**（基线 1606）；`tsc -b . --noEmit` 全仓 55 条既存、`modules/metrics` 0 条；build `--outDir /tmp/build-metW` → entry `assets/index-Q54c6DAE.js` sha256 `112c4e46c9534c34f593d2246202ec875c197a726b434a6739063f16a8df1db1`，entry 内 `metW-scroll-detail` 命中 0，chunk `assets/MetricsModulePage-BK5QTTPx.js` 命中 1（提示文案同 chunk 命中 1）。
- 未测项：真浏览器 375 手势横滚、焦点环可见性与 sticky 首列在滑动中的遮挡关系未人工走查；Safari 的 sticky + border-collapse 组合未复核。

## 热力与明细的运行数三处对照（metX，2026-11-20）

热力卡上方新增一行 `metX-consistency-note`，把「同一个窗口里三个运行数读数」并排摊开，读者不必自己去加格子。

- 三个读数：`metX-window-runs`＝热力卡自己的窗口总运行（`grid.total`，即 `met5-count` 同一个值）；`metX-heat-runs`＝把当前热力格按 `present` 过滤后用 `sumOrNull` 重新求和（独立于 `grid.total` 的第二遍读数，用来暴露口径漂移）；`metX-detail-runs`＝明细表合计行里那一格（`detailCountTotal`，与 `metT-detail-total-count` 同源）。
- 差：`metX-delta`＝明细合计 − 热力格求和，只在两边都读到数时计算；任一侧缺失则为「—」并带 title「三处没有同时读到数，算不出差」。
- 缺失语义：热力读失败/未返回时两个热力读数都是「—」，title 说明「热力这次没读出来，不按 0 记」（加载中写「热力还在读取，暂时没有数」）；员工视图的明细没有次数，title「账本只记金额与用量，不记运行次数」。任何缺失都不参与求和，也不当 0。
- 窗口：行内写明热力按哪个日期区间（`windowRangeLabel`）、明细按哪个时间窗（最近 24 小时/7 天/30 天），并注明口径不同时以各自卡片为准——热力按整周汇总、明细按所选窗口，二者本就不承诺相等。
- 零新请求：三个值都从当前批次派生（`grid` 与 `detailCountTotal`），渲染这行不调用 `loadJson`；测试断言渲染前后 `urls()` 长度不变，切换明细窗口只触发明细自己的读口、`run-activity` 请求数不变。
- 位置：这行渲染在热力卡之前、跟随 `view.kind` 的四种状态，所以热力读失败时它仍在页面上说明「不可比较」，而不是整块消失。
- 实测：默认（员工视图）窗口 332 / 热力 332 / 明细「—」/ 差「—」；`?view=model` 时 332 / 332 / 9 / −323；明细切到 7 天后 332 / 332 / 5 / −327（`run-activity` 请求数不变）；热力 500 时 —/—/9/—。
- 验证：定向 `src/modules/metrics` 2 files / **142 passed**（基线 138，+4）；全量 **137 files / 1614 passed**（基线 1610）；`tsc -b . --noEmit` 全仓 55 条既存、`modules/metrics` 0 条；build `--outDir /tmp/build-metX` → entry `assets/index-CNSuFeS2.js` sha256 `62be097d41c967bf2769d0392ff967427913495c76680508d606923f6d66cc12`，entry 内 `metX-consistency-note` 命中 0，chunk `assets/MetricsModulePage-iEZjDXbZ.js` 命中 1。
- 未测项：真实后端在热力与明细窗口不同时返回的数值差异未联调（用 fixture 构造）；375 下这一行的换行未人工走查。

## 跳过链接（metY，2026-11-20）

键盘用户不必先走完整个页头或逐行穿过两张宽表。

- 页首：`metY-skiplink`（`<a href="#metY-main">跳到主要内容</a>`）是页面第一个 Tab 落点；`<main id="metY-main" tabIndex={-1}>` 可接收焦点，链过去后焦点落到主内容而非页面顶部。
- 表前：`metY-skip-detail`（`href="#metY-after-detail"`，落点是明细表下方的来源/合计行 `met6-cat-source`）与 `metY-skip-share`（`href="#metY-after-share"`，落点 `met7-source`）。两个落点都带 `tabIndex={-1}`，链接只在对应表格真的渲染时才出现，因此不会有指向不存在锚点的死链接。
- 形态：原生 `<a href>`，不用按钮伪装；未聚焦时用 clip 技术完全移出视觉流（不占位、不改变既有布局与 tab 序其余部分），聚焦时 `position: static` 呈现为一行描边胶囊并带 `outline: 2px solid var(--color-ring)`。
- 不改其余 tab 序：metQ 的落点顺序只多出这一个页首链接（`metY-skiplink → metL-copy → met5-refresh → …`），其余原样；没有新增正数 `tabindex`。
- 零新请求：链接只做页内跳转，测试断言聚焦前后 `urls()` 长度不变。
- 验证：定向 `src/modules/metrics` 2 files / **146 passed**（基线 142，+4）；全量 **137 files / 1618 passed**（基线 1614）；`tsc -b . --noEmit` 全仓 55 条既存、`modules/metrics` 0 条；build `--outDir /tmp/build-metY` → entry `assets/index-BIvWvNTC.js` sha256 `4be1529960f738edbbf6b7054e0ce5daaabc41b3e155ed634065705c1cd102e1`，entry 内 `metY-skiplink` 命中 0，chunk `assets/MetricsModulePage-CcfclHKN.js`：`metY-skiplink`=1、`metY-main`=1。
- 未测项：真浏览器里按 Tab 后链接的可见样式与跳转后的滚动定位未人工走查；Safari 对 `:focus-visible` 与 clip 组合的表现未复核。

## 复制热力摘要（metZ，2026-11-20）

热力卡上方新增「复制热力摘要」`metZ-copy-heat`，把这一窗热力的关键数字复制成纯文本；即使热力读失败也能复制，只是内容会如实写「不可比较」。

- 文本七行：`热力摘要` / `窗口：<label>（<weeks>w）` / `日期区间：<windowRangeLabel 或 —>` / `总运行：<grid.total 或 —>` / `最高：<周几> <n> 次` / `最低：<周几> <n> 次` / `覆盖：<有数据的天数> / 7 天`；热力不可用时每项为「—」，并追加一行「说明：这次没有可用的热力格子，以上几项不可比较，不按 0 记。」
- 同源：新增 `heatSummaryParts(grid)` 作为唯一派生；`heatGridSummary`（屏上 `metK-heat-summary`）与 `heatCopyText`（剪贴板）都读这一个 parts，`总运行` 同时就是 `met5-count` 与 `grid.total`。不重复求和、不补 0、不拿本机时钟填日期区间（失败时区间写「—」）。
- 零新请求：复制只读组件内 state；测试断言点击前后 `urls()` 长度不变，切到 4 周热力窗后只多出该窗自己的读，文本窗口 id 随之变为 `4w`。
- 反馈与回退：成功 `metZ-copy-status`（role=status, aria-live=polite）显示「已复制」；剪贴板被拒时显示「复制没成功」并给出 `metZ-copy-fallback` 里的只读 textarea（`metZ-copy-fallback-text`），内容与要复制的文本逐字相同。
- 验证：定向 `src/modules/metrics` 2 files / **150 passed**（基线 146，+4）；全量 **137 files / 1673 passed**（基线 1618，含 wave-18 上游新增用例）；`tsc -b . --noEmit` 全仓 58 条既存、`modules/metrics` 0 条；build `--outDir /tmp/build-metZ` → entry `assets/index-C5TeO2dY.js` sha256 `5034df0fd828c5916aa979aba4e4ba483c822bd95aa36d1704381219d44bfaaa`，entry 内 `metZ-copy-heat` 命中 0，chunk `assets/MetricsModulePage-BoK0nIJN.js` 命中 1。
- 未测项：真浏览器剪贴板权限弹窗下的回退路径未走查；375 下按钮与说明的换行未人工走查。

## 热力窗写进地址（metAA，2026-11-20）

热力卡的周窗从 `?w=` 迁到自己的键 `?heat=`，刷新、前进后退、粘链接都能回到同一个窗口。

- 读：`windowOf(params.get('heat') ?? params.get('w'))`——旧链接里的 `w` 仍被接受（向后兼容），但新写入只用 `heat`。
- 写：`chooseWindow(next)` 复制现有参数后 `set('heat', …)` 并 `delete('w')`，因此 `?window/?view/?sort/?dsort/?ddir` 一律保留，切换热力窗不会重置明细视图或排序。
- 只重取一个读口：切换（含切回）各只发一次 `run-activity`，`run-stats`、`employees`、`budget-usage`、`hermes-usage` 新增请求数均为 0（测试按批次计数断言）。
- 不清其它卡片：原先 `weeks` 变化会清空整个新鲜度记录，现改为只删 `run-activity` 那一条；其它读口的采集时刻、各卡片数字与分摊表行都留在屏上。实测切换后 `met6-runs-value` 与 `met7-row-zeta` 文本不变，`metB-source-asof-run-stats` 仍显示原采集时刻。
- 提示：`metAA-heat-window` 一行写明「热力窗口写在地址里：最近 7 天（heat=1）。刷新、前进后退和分享链接都会回到同一个窗口，其它卡片与筛选保持原样。」
- 验证：定向 `src/modules/metrics` 2 files / **154 passed**（基线 150，+4）；全量 **137 files / 1677 passed**（基线 1673）；`tsc -b . --noEmit` 全仓 59 条既存、`modules/metrics` 0 条；build `--outDir /tmp/build-metAA` → entry `assets/index-qaYHscOn.js` sha256 `9a84a59c07d79cfd2c16848d9f44e2d5d63a8cf2f79acc78ab218b6e23e3d12c`，entry 内 `metAA-heat-window` 命中 0，chunk `assets/MetricsModulePage-BXXjPOcY.js` 命中 1。
- 未测项：真浏览器前进/后退时的滚动位置与热力格选中态恢复未走查（选中格在切换时按设计清空）；375 下这一行的换行未人工走查。

## 页尾口径说明（metAB，2026-11-20）

页面底部新增折叠块 `metAB-notes`：把六个读口的口径写成文字，读者不必逐卡推断。

- 结构：原生 `<button data-testid="metAB-notes-toggle" aria-expanded aria-controls="metAB-notes-body">口径说明</button>`，默认收起（body 不渲染）；展开后每个读口一行 `metAB-note-<key>`：口径名 / 实际路径 / `计算范围：…` / `缺值策略：…`。
- 内容来源：`metrics.ts` 新增静态表 `CALIBER_NOTES`（六项与 `SOURCE_CATALOG` 同键同路径），文案复述既有口径——运行活动「按整周汇总，不提供 24 小时切分；缺格「—」不补 0」、运行统计「所选时间窗与上一周期同长」、员工目录「只用于编号换人名，缺名显「员工 · 短码」」、账本「按日/月账本行累加，缺「—」真 0 `$0.00`，不用单价乘用量」、价目表「标价不等于扣费」、Hermes 用量「天数跟随时间窗，缺次数「—」」；末尾一句统一写明「采集时刻只取上游顶层 ISO，缺失「—」，不拿本机时间顶替；两份导出沿用同一套处理」。
- 一致性：测试把 `metB-source-table` 与 `metAB-notes-body` 的同一路径（`/api/run-stats`、`/api/budget-usage`、`/api/models/pricing`）逐条对照，并断言 `$0.00`、`不补 0`、「不拿本机时间顶替」确实出现。
- 不改状态：展开/收起不写 URL（`met7-loc` 前后相同）、不发请求（`urls()` 前后相同）、不清空任何卡片或新鲜度块；折叠后 `metB-source-table` 仍在。
- 验证：定向 `src/modules/metrics` 2 files / **157 passed**（基线 154，+3）；全量 **137 files / 1680 passed**（基线 1677）；`tsc -b . --noEmit` 全仓 58 条既存、`modules/metrics` 0 条；build `--outDir /tmp/build-metAB` → entry `assets/index-CE_eqhLj.js` sha256 `eeed0cc6ec3645be807ad468bf243c45b85fdac6061c63c46a60c5ed33528196`，entry 内 `metAB-notes` 命中 0，chunk `assets/MetricsModulePage-CMjnDoV9.js` 命中 1。
- 未测项：375 下六条说明的长段落折行与滚动高度未人工走查；屏幕阅读器对折叠块的播报未走查。

## 屏上与 CSV 逐值对账护栏（metAC，2026-11-20）

新增 `web/src/modules/metrics/metrics.export-parity.test.ts`，把「屏上 ↔ 两份 CSV」的六条约定钉成回归断言；本轮**未改产品代码**（构建 entry 与上一刀完全相同，可作为旁证）。

- P1 行数：明细 CSV 数据行 = `met6-cat-source` 的 N = 表体行数（本例 2）；分摊 = `metA-export-count` = 表体行数。
- P2 合计注释：`# 合计：成本 … · 次数 … · 占比 …`（明细）与 `# 合计：运行 … · 成本 … · 占比 …`（分摊）逐字等于表尾单元格；`# 本次导出缺少 1 块：运行统计` 恒为最后一行；两类注释都不计入数据行。
- P3 采集时刻：上游顶层 ISO 才进 `as_of` 列（有值时逐行回声 `2026-11-19T20:12:00.000Z`）；假时钟设到 2031 后，`metB-source-asof-*` 全部为「—」，CSV 该列全空且全文不含 2031。页面自身「读取于」仍可显示当下时间——那是读取时刻，不是数据时刻。
- P4 窗口列：默认写 `24h`；点 7 天后再导出写 `7d`，屏上 `met6-window-7d` 同步按下。
- P5 零与缺失：屏上 `$0.00` / 「—」，文件 `0.00` / 空字段（员工视图 `$ 与千分位` 去装饰后仍可解析）。
- P6 行序：默认成本降序与 `?dsort=runs&ddir=asc` 两组，CSV 首列顺序都等于表体首列顺序。
- 断言全部走真实导出入口（点击按钮 + mock `URL.createObjectURL` 取 Blob），不起浏览器；BOM 仍按字节 `EF BB BF` 校验。
- 验证：`src/modules/metrics` **3 files / 167 passed**（原 157，+10）；全量 **137 files / 1690 passed**（原 1680）；`tsc -b . --noEmit` 全仓 58 条既存、`modules/metrics` 0 条；build `--outDir /tmp/build-metAC` → entry `assets/index-CE_eqhLj.js` sha256 `eeed0cc6ec3645be807ad468bf243c45b85fdac6061c63c46a60c5ed33528196`（与 metAB 构建产物一致，说明本轮只增测试）。
- 未测项：真实后端 `as_of` 形态（六别名之外的变体）未联调；Safari/Firefox 下载文件名未走查。

## 卡片与口径说明的读屏关联（metAD，2026-11-20）

五张卡（运行/成本/趋势/价格/热力）都带 `aria-describedby`，焦点落到卡上时读屏会把「口径名 + 缺值策略」一并读出来。

- 方式：选择「sr-only 副本」而非依赖折叠块——`metAB` 默认收起时正文并不渲染，若只靠它，五张卡的引用会指向不存在的 id。现在页面顶部固定渲染一组隐藏段落，id 为 `metAD-note-<key>`（`run-stats`、`budget-usage`、`pricing`、`run-activity` 四个），内容由 `CALIBER_NOTES` 同一份数据生成：`<口径名>。缺值策略：<missing>`。
- 卡片映射：运行 → `metAD-note-run-stats`；成本 → `metAD-note-budget-usage`；趋势 → `metAD-note-run-stats`（与运行同一读口，故共用一条说明）；价格 → `metAD-note-pricing`；热力 → `metAD-note-run-activity`。
- 单一文案来源：页尾 `metAB` 展开后仍用 `CALIBER_NOTES` 渲染，测试对比 `metAB-note-run-stats` 与 `metAD-note-run-stats` 含同一条 `missing` 文本，并逐字校验 sr-only 段落等于 `${label}。缺值策略：${missing}`。
- 视觉与请求：sr-only 段落不占版式、不改任何卡片外观；只在渲染期读静态常量，测试断言卡上聚焦前后 `urls()` 长度不变。
- 验证：`src/modules/metrics` **3 files / 171 passed**（原 167，+4）；全量 **137 files / 1694 passed**（原 1690）；`tsc -b . --noEmit` 全仓 58 条既存、`modules/metrics` 0 条；build `--outDir /tmp/build-metAD` → entry `assets/index-C9RYivhE.js` sha256 `acca73cc2ff3f79f4ef93bfb5e4daa4496fa9cfcfb7eff15ce7350ddbbad8df0`，entry 内 `metAD-note` 命中 0，chunk `assets/MetricsModulePage-B-biV7Jz.js` 命中 1。
- 既有断言调整：一处「整页不含 $0.00」改为「成本卡不含 $0.00」，因为 sr-only 口径说明会合法地引用 `$0.00` 作为「真 0」的写法——范围收紧而非放宽。
- 未测项：真实读屏（VoiceOver/NVDA）对 `aria-describedby` 的朗读顺序与实际停顿未走查。

## 粘性表头与不折行的数值（metAF，2026-11-20）

两张宽表的表头在滚动时留在表顶，数值列不再被挤成两行或省略号。

- 表头：`<thead className="metAF-sticky-detail" data-testid="metAF-sticky-detail">`（明细）与 `metAF-sticky-share`（分摊）；CSS `position: sticky; top: 0; z-index: 0; background: var(--color-card)`。首列仍由 metW 的 `td:first-child/th:first-child` 锚定并带 `z-index: 1`，表头首格 `z-index: 2`——三层层级明确（表头 0 < 首列 1 < 左上角 2），不会互相遮挡。
- 数值列：新类 `metAF-nowrap` 加在六个数值表头（明细 支出/次数/占比、分摊 运行数/成本/占比），CSS `white-space: nowrap; font-variant-numeric: tabular-nums`；表体数值格经 `.metW-table tbody td.met6-num` 同样 nowrap + 等宽数字，因此 375 下数字保持一行，由容器横向滚动而不是截断加省略号。
- 兼容：与既有 `.met6-num` 合并为同一 `className`（中途曾出现重复 `className` 属性导致 `met6-num` 被吞，已在同单修掉，tsc 与测试均覆盖该点）。
- 断言（不起浏览器）：两只 thead 的 tagName/class/testid 存在，`.metAF-nowrap` 至少 3 个元素且均为 TH/TD，三个分摊数值表头的 class 同时含 `met6-num` 与 `metAF-nowrap`。
- 验证：`src/modules/metrics` **3 files / 173 passed**（原 171，+2）；全量 **137 files / 1696 passed**（原 1694）；`tsc -b . --noEmit` 全仓 58 条既存、`modules/metrics` 0 条；build `--outDir /tmp/build-metAF` → entry `assets/index-BerrBqsL.js` sha256 `3339cb3170dd7d80eb2f565edc26c8f29ed8162effd1620f1688cddb8eec37b9`，entry 内 `metAF-sticky` 命中 0，chunk `assets/MetricsModulePage-BRMjOkzZ.js` 命中 1。
- 未测项：真浏览器里纵向滚动时表头贴合、首列与表头交角的重叠关系与 375 下数字实际宽度未人工走查（容器纵向高度通常不滚动，粘性表头主要在窄容器下生效）。

## 复制来源摘要（metAG，2026-11-20）

新鲜度块（metB）旁新增「复制来源摘要」`metAG-copy-sources`：把这张表说成纯文本，一行一个读口。

- 文本：按 metB 当前行序（`sourceRows(sources)` 的 `SOURCE_CATALOG` 顺序），每行 `口径名 · 实际路径 · 采集时刻 · 状态`；采集时刻只取该读口顶层 ISO（缺失写「—」，不用本机时钟）；状态三词与表内一致（正常/降级/读不到）。`sourceSummaryText(rows)` 与表格共用同一批 `SourceRow`，不重新取数。
- 反馈：成功 `metAG-copy-status`（role=status, aria-live=polite）显示「已复制 N 行」（N = 行数，实测 6）；剪贴板被拒显示「复制没成功」并给 `metAG-copy-fallback` 内只读 textarea（`metAG-copy-fallback-text`），内容与目标逐字相同。
- 全失败：所有已发起的读口都失败时按钮 `disabled`，title「所有读口都没读出来，没有可复制的来源摘要」；「还没请求过」的读口按降级处理，不触发禁用（否则会把「尚未读取」误报成失败）。
- 安全：文本只含口径名、站点内路径、时间与状态词；测试断言不含 `token`/`bearer`/`authorization`。
- 零新请求：点击前后 `urls()` 长度不变（测试断言）。
- 验证：`src/modules/metrics` **3 files / 177 passed**（原 173，+4）；全量 **137 files / 1700 passed**（原 1696）；`tsc -b . --noEmit` 全仓 58 条既存、`modules/metrics` 0 条；build `--outDir /tmp/build-metAG` → entry `assets/index-C2OuvqzZ.js` sha256 `0c352483753e5f67e8e2baaaf12fd0535cfba16b0a19f98e7c2cca834190a0fe`，entry 内 `metAG-copy-sources` 命中 0，chunk `assets/MetricsModulePage-CkjPbDjF.js` 命中 1。
- 踩坑：起初用「所有行都 down」判禁用，但从未请求的读口会被 `sourceRows` 记作降级，导致全失败时按钮仍是可点——改为「已发起的行全为 down」后符合预期。
- 未测项：真实剪贴板权限弹窗与 375 下按钮/说明换行未人工走查。

## 表内行数诚实化（metAH，2026-11-20）

先核对了两张表的取数路径：`detailRows` 直接来自当前批的 `breakdownView.lines`（模型用量全量行 / 员工账本聚合行），`shareRows` 来自当前批的 `shareView.value.rows` 再仅做排序；组件里没有针对这两张表的 `slice`、`limit` 或行数上限（代码里仅有的 `slice` 用在月度快照前 8 行与价目表前 5 行，与本表无关）。因此**按实况写「全量渲染」，不编造截断**。

- 明细表下新增 `metAH-cap-note`：「表内全量渲染，共 N 行；导出与屏上一致，没有截断。」N 取 `detailRows.length`，与 `met6-cat-source` 的「N 行」同源；`title` 写明判据（当前批次、无 slice/上限、与来源行计数同源）。
- 分摊表下新增 `metAH-cap-note-share`：「表内全量渲染，共 N 行；导出含同一批行，没有截断。」N 取 `shareRows.length`，与 `metA-export-count` 的「可导出 N 行」同源；`title` 注明与 metA-export-count 同源。
- 零新请求：两条说明只读渲染期已有的数组长度，测试断言挂载后 `urls()` 长度不变。
- 既有护栏未动：`metrics.export-parity.test.ts`（metAC 10 例）保持原样，CSV 行数仍等于 M。
- 验证：定向 `src/modules/metrics` 3 files / **180 passed**（原 177，+3）；全量 **137 files / 1703 passed**（原 1700）；`tsc -b . --noEmit` 全仓 58 条既存、`modules/metrics` 0 条；build `--outDir /tmp/build-metAH` → entry `assets/index-gCw9agdb.js` sha256 `e48f4b56de38b57edd1ce14edc21118926d87a5af5f890dde90294e91256ee0c`，entry 内 `metAH-cap-note` 命中 0，chunk `assets/MetricsModulePage-B9ULZATw.js` 命中 1。
- 未测项：真实后端若对账本/用量做服务端分页（本仓代码未见分页参数），当前文案不会自动改写；员工目录 `limit=200` 的名单上限仍由既有的账本截断提示承担，本单未改口径。

## 导出文件名口径（metAI，2026-11-20）

两份 CSV 的文件名现在自带「窗口 / 分组 / 排序 / 生成时刻」，同一时刻导出也不会互相覆盖。

- 模板：明细 `metrics-detail-<window>-<group>-<sort>-<dir>-<YYYYMMDD-HHmm>.csv`；分摊 `metrics-share-<window>-<group>-<sort>-<dir>-<YYYYMMDD-HHmm>.csv`。时间戳为北京时间到分（`beijingFileStamp`），窗口取 `24h|7d|30d`，分组取 `employee|model`。
- 排序：明细的 `sort` 来自 `?dsort/?ddir`（默认 `cost-desc`，未动过排序时就是这四个字母）；分摊来自 `?sort/?dir`（默认 `cost-desc`，`sort=model` 时为 `model-asc|desc`）。因此「同窗口同分组但排序不同」的两份文件也不会同名。
- 字符集：`fileToken` 把非 `[a-z0-9]` 统一折叠成 `-` 并去首尾横线，整名匹配 `^[a-z0-9.-]+$`，不含斜杠、冒号、空白与中文。
- 实测两枚（同一时刻 `2026-11-20T09:30Z` = 北京 17:30）：`metrics-detail-24h-employee-cost-desc-20261120-1730.csv` 与 `metrics-share-24h-model-cost-desc-20261120-1730.csv`，两者不相等；`?dsort=runs&ddir=asc` 时明细名为 `…-runs-asc-…`，`?sort=model&dir=asc` 时分摊名匹配 `^metrics-share-24h-model-[a-z]+-asc-`。
- 屏上说明：`metAI-filename-note`（导出按钮旁）给出两个模板与「含窗口、分组、排序与生成时刻」，title 写完整规则；CSV 内容、表头、行数零改动，metAC 的行数/注释/`as_of`/`window` 断言未动。
- 验证：定向 `src/modules/metrics` 3 files / **184 passed**（原 180，+4）；全量 **137 files / 1799 passed**（wave-19 上游抬高总数，本单前 1703）；`tsc -b . --noEmit` 全仓 67 条既存、`modules/metrics` 0；build `--outDir /tmp/build-metAI` → entry `assets/index-CQVVvpbM.js` sha256 `4c76d28a555065fa517a4ad4e67fc2a6851e228ed19295e48ccf27a6184d8b63`，entry 内 `metAI-filename-note` 命中 0，chunk `assets/MetricsModulePage-Cn2kglU2.js` 命中 1。
- 未测项：不同浏览器/系统对下载文件名中连字符与大小写的保留未逐端走查；跨日边界（23:59 生成）未构造样例。

## 复制/摘要/文件名契约护栏（metAJ，2026-11-20）

新增 `web/src/modules/metrics/metrics.copy-parity.test.ts`（6 例，C1–C5），把已经交付的复制与命名口径钉住；同时修正了一处真实不一致。

- C1 来源摘要：先展开 metB，再点 `metAG-copy-sources`，复制文本与 `metB-source-row-*` 逐行同序同段——每行由 `口径名 · 路径 · 采集时刻 · 状态词` 四段拼成，采集时刻取 `metB-source-asof-<key>` 的纯时间（滞后徽标不混入），状态词限定在「正常/降级/读不到」三词内。行数与 `已复制 N 行` 一致。
- C2 两份摘要互不串味：view 摘要含「运行分析摘要」且不含「热力摘要」，热力摘要反之；缺值时分别写「实扣金额：—」「总运行：—」并带「不可比较」，全文不出现 `$0.00` 冒充缺失（真 0 才会写 `$0.00`）。
- C3 文件名契约：`csvFileName('employee','24h','cost','desc', 2026-11-20T09:30Z)` = `metrics-detail-24h-employee-cost-desc-20261120-1730.csv`；`shareCsvFileName('model','24h','cost','desc', 同一时刻)` = `metrics-share-24h-model-cost-desc-20261120-1730.csv`。同窗同组三种排序三名互不相同；整名匹配 `^[a-z0-9.-]+$`，不含空白、斜杠、冒号与中文。
- C4 口径说明同文：metAB 展开后逐 key 比较 `metAD-note-<key>` 与 `metAB-note-<key>` 的 textContent，要求逐字相等（`run-stats`、`budget-usage`、`pricing`、`run-activity`）。
- C5 零新请求：上述四组操作前后 `urls()` 长度均不变。

**发现并修复（同单）**：改前 sr-only 为 `${label}。缺值策略：${missing}`，而页尾 item 的 textContent 是四段无分隔拼接（`${label}${path}计算范围：${scope}缺值策略：${missing}`），二者并不相等。改后新增 `caliberNoteText(note)`＝`${label}。${path}。计算范围：${scope}。缺值策略：${missing}。`，sr-only 直接用它；页尾四项各自补句号（`${label}。` / `${path}。` / `计算范围：${scope}。` / `缺值策略：${missing}。`），使两处 textContent 逐字相同。连带：sr-only 现在含 `/api` 路径，原本两处「页面无 /api」断言改为对 `visibleText()`（剔除 `.sr-only` 的可见文本）断言，意图不变。

- 验证：定向 `src/modules/metrics` **4 files / 190 passed**（原 184，+6）；全量 **137 files / 1805 passed**（原 1799）；`tsc -b . --noEmit` 全仓 67 条既存、`modules/metrics` 0。
- build `--outDir /tmp/build-metAJ` → entry `assets/index-BOZO53Tv.js` sha256 `61300afc5168e388899985604363f06b8150eb4df4c988de0de5ee2433a856fc`（较 metAI 的 `index-CQVVvpbM.js` 有变化，原因是本单的口径修正，不是测试文件）、entry 内无 metAJ 标记、chunk `assets/MetricsModulePage-CPDNiCwU.js` 命中「计算范围：」2 处。
- 未测项：真实读屏下的朗读停顿未走查；剪贴板权限弹窗路径沿用既有未测项。

## 手动刷新语义（metAK，2026-11-20）

页首新增「刷新」`metAK-refresh`：点一次，把当前窗口与当前分组整批重取一遍，卡片不会先被清空。

- 一次点击 = 一批：`refreshAll()` 用新的 `signal` 同时跑七个 loader（运行活动、用量与成本、明细、热力、预算、窗口对比、分摊），`Promise.allSettled` 收口。实测按读口种类计数与首次加载完全相同（`run-stats` 仍是当前窗+上一窗两条，其余按窗口与分组而定），没有重复触发。二次点击由 `refreshBusyRef` 闸门直接返回：三连点只发出一批（`urls()` 增量等于一批）。
- busy 期间：按钮 `aria-busy=true`，页首 `metAK-busy-note` 显示「更新中…（卡片先保留上一次读到的数据）」，role=status aria-live；`shownState/shownUsage/...` 在 busy 且有快照时取快照，七个派生视图全部走同一层，所以数字与表格不闪空、不出现骨架。
- 成功：`metAK-updated-at` 写「刷新完成于 <北京时间到分>（读取时刻，不是数据时刻）」——与各卡片的采集时刻 asOf 分开标注，绝不把读取时刻当数据时刻。
- 失败：整批里只要有一个读口记了新的错误，就显示 `metAK-error`「这次刷新没成功，页面保留上一次读到的数据。」+ 可复制的请求编号 + `metAK-refresh-retry`「再试」；失败的卡片仍按 metD/metH 既有语义显示自己的原因与单卡重试，不改那两处。
- 切窗/切分组：`chooseGroupBy`、`chooseView`、`chooseUsageWindow`、`chooseWindow`（热力窗）都会 `cancelRefresh()`（把在途 signal 置 `live=false` 并清 busy/快照），晚到的批被丢弃——测试用挂起 promise 验证切窗后 `metAK-updated-at` 仍为空。
- 既有 `met5-refresh`「刷新」按钮保留未动（它是整页 attempt 递增的老入口）；`metAK-*` 为新增。
- 验证：定向 `src/modules/metrics` **4 files / 195 passed**（原 190，+5）；全量 **137 files / 1810 passed**（原 1805）；`tsc -b . --noEmit` 全仓 67 条既存、`modules/metrics` 0；build `--outDir /tmp/build-metAK` → entry `assets/index-KvAaJzx0.js` sha256 `8f0de8c69b29c734edc42e8b6262d2b72983800d2239f7c35ef86d764ad39892`，entry 内 `metAK-refresh` 命中 0，chunk `assets/MetricsModulePage-sDZlo_Yl.js` 命中 1。
- 未测项：真浏览器里长网络下「更新中…」的持续时长与快速连点手感未走查；刷新期间切窗后滚动位置未复核。

## 当前视图范围条与一键复位（metAL，2026-11-20）

页首新增一行 `metAL-scope`，把当前视图的四个要素直接摊开：时间窗 / 分组 / 明细排序 / 分摊排序 / 热力窗。

- 全部从 URL 派生（`usageWindow`、`groupBy`、`detailSort/detailDir`、`sortKey/sortDir`、`activeWindow`），没有为此新增任何 state；因此粘同一个 URL 刷新，这行逐字复现，切窗/切分组/切排序/切热力窗也在同一渲染帧更新（不滞后一批）。
- 文案形态：`当前视图：时间窗 <label> · 分组 <按员工|按模型> · 明细 <成本|次数|占比> <升序|降序> · 分摊 <运行数|成本|员工|模型> <升序|降序> · 热力 <label>`。
- `metAL-reset`「回到默认视图」：清掉 `window / groupBy / view / dsort / ddir / sort / dir / heat / w` 九个键后只改 URL；不调用 `refreshAll`、不 bump `attempt`，所以只由既有 effect 重取受影响读口，不是全页重取。实测从全参起步重置：`run-activity` +1（仅热力窗 4→1）、`run-stats` +2（当前窗+上一窗，属同一批）、`employees` +4、`budget-usage` +4，总增 15，明显小于首载总量。
- 回显本身零请求：渲染前后 `urls()` 不变。
- tab 序：`metAL-reset` 落在第 4 位（`metY-skiplink → metL-copy → met5-refresh → metAL-reset → metAK-refresh → …`），metQ 的落点断言已同步。
- 验证：定向 `src/modules/metrics` **4 files / 198 passed**（原 195，+3）；全量 **145 files / 1813 passed**（原 1810）；`tsc -b . --noEmit` 全仓 67 条既存、`modules/metrics` 0；build `--outDir /tmp/build-metAL` → entry `assets/index-B1ZZIqPO.js` sha256 `f7ef98d9ff6a3cdce7aa6b50c8165d00ef19a2805c333bc671c0c2359b353fc4`，entry 内 `metAL-scope` 命中 0，chunk `assets/MetricsModulePage-iD1kX6Cz.js` 命中 1。
- 未测项：375 下范围条多段换行的实际断点未人工走查；中文排序词在窄屏是否截断未走查。

## 可用性矩阵（metAM，2026-11-20）

把刷新、视图范围条与复位、两处导出、摘要复制、单卡重试收进同一张矩阵，由页面一处 `gates` 对象统一给出 `{enabled, title}`，各钮只读它，不再各自计算判据。

- 整页失败（全部读口 down）：`metAK-refresh` 可点（唯一回退路）、`metAL-reset` 与视图切换可点；`met6-export`、`metA-export`、`metL-copy` 全 disabled，title 同为「整页读取失败…先重试上面的读取」。
- 单块降级：刷新可点；明细导出按 metR 现口径仍可导（title 含「账本逐行」）、摘要可复制；出事那张卡的「重试这一项」可点。
- 空窗：刷新、两处导出（header-only，计数「可导出 0 行」）、摘要复制都可用。
- 刷新进行中：`metAK-refresh` 保持可点但 `aria-busy=true`，二次点击被闸门忽略、不叠加请求；导出、复制、复位、单卡重试统一 disabled，title 含「这一批」。

屏上说明为 `metAM-matrix-note`（一行话覆盖四格）。验证：定向 `src/modules/metrics` **4 files / 202 passed**（原 198，+4）；全量 **145 files / 1817 passed**（原 1813）；`tsc` 全仓 67 条既存、`modules/metrics` 0；build entry `assets/index-dI2moWxe.js` sha256 `ebae4f11cb1e57aa55029db838fc6d61aebeb94d079fa259d97f63c130ebc255`（entry 内 metAM=0），chunk `MetricsModulePage-iw5R3p63.js` 命中 1。零额外请求：矩阵只读既有派生值，回显不触发取数。未测项：真浏览器 375 下说明行换行未走查。

## 全空页引导（metAN，2026-11-20）

- 判据复用既有 `usageQuiet`：运行统计与账本两个读口都成功，且运行数为 0、分桶为空、账本行为空——即「本窗真的没有运行，也没有实扣」。读口失败不走这里（`usageDown` 为真时 `usageQuiet` 必为假），错误仍由 metH/metD 的既有错误态承担。
- 页首 `metAN-empty-guide`：标题「本窗没有运行记录」；两句人话说明卡片保留「—」、不拿空当 0 求和、不编零元汇总；给两个真实路由链接 `/runs`（运行列表）与 `/work`（工作台）——两条路由已 `git grep` 核实注册在 `web/src/App.tsx`（`/runs` 340/392 行、`/work` 379/1192 行），并在 `web/src/shell/routes.ts:151/153` 有 `#/work` 条目，不是死链；末句指路既有时间窗控件。
- 零额外请求：引导完全由已有状态派生，挂载后 50ms 内 `urls()` 计数不变。
- 引导正文不提金额符号，空窗时 `met6-cost-value` 仍是「—」。
- 样式：`.metAN-guide`（边框+圆角+`--color-muted` 底，flex column）、`.metAN-title` 13px 600、`.metAN-body` 12px muted + `overflow-wrap:anywhere`，375 下自然换行。
- 测试：新增 describe「metAN — empty window guide」3 例（空窗显引导+两个 href+零请求+无金额符号；正常窗口无引导；全失败无引导）。
- 验证：定向 `src/modules/metrics` 4 files / **205 passed**（原 202，+3）；全量 **145 files / 1820 passed**（原 1817）；`tsc` 全仓 67 条既存、`modules/metrics` 0。
- build `--outDir /tmp/build-metAN` → entry `assets/index-BXi0_KhO.js` sha256 `fae63b3721dd787f2e85adec8bbd68df995289ee3bcd96e913b4ddc8ad2932ec`（entry 内 `metAN-empty-guide`=0），chunk `assets/MetricsModulePage-D5dXb8_c.js` 命中 1。
- 未测项：真浏览器 375 换行与粘链首屏视觉未走查；空窗与「账本有行但金额为 0」的边界（真 0 数据）仍按数据展示，不触发引导。

## 导出文件名与屏上口径同值（metAO，2026-11-20）

`metAL-scope` 与两处导出文件名读同一组参数，逐要素同值：

- 明细：`metrics-detail-<window>-<view>-<dsort>-<ddir>-<生成时刻>.csv`
- 分摊：`metrics-share-<window>-<group>-<sort>-<dir>-<生成时刻>.csv`
- 屏上 `metAO-filename-bar` 给两枚预览（`metAO-filename-detail` / `metAO-filename-share`），生成时刻位写 `<生成时刻>`，实际文件名在导出时按北京时间到分填位；预览全文进 `title`，375 下 `code` 单行省略号截断、由 `title` 与复制兜底。
- 两表各用各的键：`?dsort/?ddir` 只进明细名，`?sort/?dir` 只进分摊名；互不串用。实测：`?dsort=runs&ddir=asc` → `metrics-detail-24h-employee-runs-asc-…` 且分摊仍 `metrics-share-24h-model-cost-desc-…`；`?sort=model&dir=asc` → `metrics-share-24h-model-model-asc-…` 且明细仍 `…-cost-desc-…`。
- 默认值即 URL 派生值：不加参数时明细 `employee`（`?view` 缺省分支）、分摊 `model`，两侧排序都是 `cost-desc`；`metAL-reset` 清九键后两枚预览立即回到这批默认值，不残留任何上一次的键。
- 粘链直达按 URL 派生：`?window=30d&groupBy=employee` → `metrics-detail-30d-employee-cost-desc-…` / `metrics-share-30d-employee-cost-desc-…`，不是默认值。
- 零额外请求：预览为纯派生，挂载后 60ms 内 `urls()` 不变。
- 纯函数：`csvFileStem` / `shareCsvStem`（`fileToken` 归一化），`csvFileName` / `shareCsvFileName` 复用同一 stem，故屏上预览与实际下载名只差生成时刻。

验证：定向 `src/modules/metrics` 4 files / 210 passed（原 205，+5）；全量 145 files / 1825 passed（原 1820）；`tsc -b . --noEmit` 全仓 67 条既存、`modules/metrics` 0。

未测项：真浏览器 375 下长文件名的省略号宽度未目视走查（CSS `text-overflow: ellipsis` + `title` 已就位）。

## 运行数口径三面对齐（metAP，2026-11-20）

一行话 `metAP-runs-caliber` 把「运行数」在三个面上的口径写清，逐面标数据源与筛选条件：

- 热力面 `metAP-heat`：`/api/run-activity?weeks=N&tz=Asia/Shanghai`，整周窗口汇总，**含未成功的运行**，未返回的格不计入；与卡片 `met5-count` 同值。
- 明细面 `metAP-detail`：模型视图 `/api/hermes-usage`（按模型的调用次数，`api_calls`），员工视图 `/api/budget-usage` 账本（只记金额与用量，**不记录运行次数**，故该面为「—」）；与 `metT-detail-total-count` 同值。
- 运行页面 `metAP-runs`：`/api/runs?since=…&limit=…` 是**分页列表**，列表条数有上限，不等于窗口总数；本页不另发该请求，故固定显「—」并在 title 点名原因。

尾句三种：两面已知且相等 →「热力与明细一致；运行页未核对，见 title」；不等 →「口径不同，见 title」（title 写差值 D 与「属口径差，不是数据错误」）；缺数 →「有面缺数，见 title」（如员工视图，或热力还没读出来）。

`title` 收全部工程信息（三条路径、筛选条件、limit 语义、差值），可见行只写人话数字——零工程语言不破。缺失不按 0：热力/明细缺数一律「—」，差值算不出时 title 明写「算不出差，也不按 0 记」。

零额外请求：三面全部读现有 payload 派生（`heatWindowTotal` / `detailCountSum` / 固定 `—`），挂载后 60ms 内 `urls()` 不变。

验证：定向 `src/modules/metrics` 4 files / 215 passed（原 210，+5）；全量 145 files / 1830 passed（原 1825）；`tsc -b . --noEmit` 全仓 67 条既存、`modules/metrics` 0。

未测项：真实后端上三面的实际数值差未用线上数据复算（历史上 run-stats 与 `/runs` 条数差 1 的先例仍在记忆里），本单只保证每面读数与它自己的来源一致、并在差存在时如实标出。

## URL 兼容矩阵与归一（metAQ，2026-11-20）

挂载时对地址做一次归一，之后不再改写（用户后续每次点击各写自己的键）：

| 规范键 | 别名 / 兼容 | 合法值 | 非法时 |
|---|---|---|---|
| `window` | — | `24h` `7d` `30d` | 丢弃并记入忽略清单 |
| `heat` | 旧键 `w`（`heat` 优先，`w` 并归为 `heat`） | `1` `4` `12` | 丢弃并记入忽略清单 |
| `groupBy` | 写入 `view`（`groupBy` 是明细轴的旧拼法） | `employee` `model` | 丢弃并记入忽略清单 |
| `view` | — | `employee` `model` | 丢弃并记入忽略清单 |
| `dsort` / `ddir` | — | `runs` `cost` `share` / `asc` `desc` | 丢弃并记入忽略清单 |
| `sort` / `dir` | — | `runs` `cost` `model` / `asc` `desc` | 丢弃并记入忽略清单 |

- 别名直达等价：`?w=4` 归一为 `?heat=4`，与直接 `?heat=4` 渲染同一热力窗；`?w=12&view=model` 与 `?heat=12&view=model&groupBy=model` 的 `metAL-scope` 与 `metAP-heat` 逐字相等。
- **单向兼容（知情契约）**：`?groupBy=employee` 会补写 `view=employee`（明细面同值）；反向 `?view=employee` 不补 `groupBy`——明细视角与分摊分组是两个独立选择（metS 契约为准），自动回填会把分摊表静默切组。
- 未知/非法值不崩：回落默认，并在 `metAQ-url-note` 写「已忽略无效参数 N 个」，`title` 列出每对 `key=原值`；与页面无关的参数原样保留。
- 归一用 `setParams(..., { replace: true })`：`useNavigationType()` 实测为 `REPLACE`，`window.history.length` 前后不变，不新增历史条目。
- 归一不额外取数：别名链接与规范链接的请求增量逐项相等（同一批读口，只差参数值）。
- `metAL-scope` 与 `metAO-filename-*` 读的是归一后的参数，故回显与地址一致。

验证：定向 `src/modules/metrics` 4 files / 220 passed（原 215，+5）；全量 145 files / 1835 passed（原 1830）；`tsc -b . --noEmit` 全仓 67 条既存、`modules/metrics` 0。

未测项：真浏览器前进/后退在多次切参后的历史栈形态未逐项走查（已用 `useNavigationType` 与 `history.length` 覆盖归一瞬间）。

## R47 纠偏：截断注记分表说明与兜底复制同源（2026-11-20）

### OBS-11 截断注记（改前 → 改后）
- 改前：三处注记笼统写「表内全量渲染 / 没有截断」，而页面另有两处确实 `slice`（月度快照前 8 行、价目表前 5 行）——注记与页面事实互相打脸。
- 改后分表说：`metAH-cap-note`「宽表逐行全量渲染，共 N 行；导出与屏上逐行一致。」、`metAH-cap-note-share`「宽表逐行全量渲染，共 N 行；导出含同一批行。」；新增 `metAH-cap-note-snapshot`「这张快照只显示前 8 行（按金额从高到低）；完整数据用「导出明细 CSV」，或在下方分摊表按员工逐行看。」（title 写 `monthSnapshot.rows` 先按金额降序取前 8 行、完整账本行两个去处、本卡不分页）；新增 `metAH-cap-note-pricing`「价目表只显示前 5 行；本页不导出价目，完整价目以模型价目表为准。」（title 写按服务返回顺序取前 5 行、本次共 N 行、其余不展示也不导出，仅 pricing ready 且有行时渲染）。
- 「没有截断」字样在页面可见文本中为 0（测试用 `visibleText()` 断言）。

### OBS-5 兜底复制同源
- 改前：兜底 textarea 取 `sourceCopyBody` state（由点击时 set），曾出现空串。
- 改后：删除该 state，`sourceCopyValue = sourceList.length ? sourceSummaryText(sourceList) : ''` 一处派生，剪贴板参数与 textarea `value` 同读它——不可能不一致，非空列表下也不可能为空。测试断言：`fallback.value === body`、`!== ''`、`clip.copyTextToClipboard` 最后一次调用参数 === `fallback.value`、6 行。

零额外请求（注记与兜底纯派生，`urls()` 不变）。验证：定向 `src/modules/metrics` 4 files / 221 passed（原 220）；全量 1921 passed（基线 1835，上游本轮已涨）；`tsc` 本域 0（全仓 69 条既存）。

未测项：真浏览器下快照/价目两卡的注记换行未目视走查。

## 成本口径三面对照（metAS，2026-11-20）

- 位置：`met6` 区、`metAP-runs-caliber` 下一行，`metAS-cost-caliber`（同一批数据的纯派生，零额外请求）。
- 三面：日累计（`/api/budget-usage?periodKind=day` 的 `total`，记账）、月累计（`periodKind=month`，记账）、模型聚合（`/api/hermes-usage` 各模型 `cost_usd` 求和，用量推算）。`metrics.ts` 新导出 `costCaliber({day,month,usage,usageMissing})`，返回 `faces / known / verdict / pairs / widest / title`。
- 规则：只读现有 payload；面缺失或未读一律「—」并在整行 title 写原因（按员工分组未读模型聚合 / 模型聚合这次没读出来），禁缺值当 0；真 0 仍 `$0.00`。三面已知且相等写「三面一致（3/3）」→ 实为「三面一致」；已知不足三面写「有面缺数（N/3）」；不等写「口径不同，见逐对差值」并逐对给 `日累计−月累计`、`日累计−模型聚合`、`月累计−模型聚合` 的有符号 USD 差（负数按 `-$x.xx`），另标「差值最大：<对名>」。
- title 写明三条数据源路径与「记账 vs 用量推算不是同一套账，数值不等属口径差，不是数据错误」，以及每对差值、最大差值对、缺失面原因。
- 切窗/切分组随批重算（三面都从 `usageReady.day/month` 与 `shareView` 现算，无新 state）。
- 测试（`MetricsModulePage.test.tsx` describe「metAS」5 例）：纯函数三面相等/不等与 pairs 顺序、widest；默认路由下 `metAS-day === met6-cost-value`（`$0.00`）、`metAS-month = $0.13`、`metAS-usage = —`、verdict「有面缺数（2/3）」、title 含「不按 0 记」「不发新请求」；`mountShare(SHARE_USAGE)` 三面齐全 → `metAS-usage = $4.00`、verdict 口径不同、delta 含三对且 `日累计−模型聚合 -$4.00`、正文含「差值最大：日累计−模型聚合」；`?groupBy=employee` 时 usage 为「—」且 title 说明按员工未读模型聚合；挂载后 `urls()` 计数不变（零额外请求）。
- 验证：定向 `src/modules/metrics` 4 files / 226 passed（原 221）；全量 147 files / 1926 passed（原 1921）；tsc 全仓 69 条既存、`modules/metrics` 0。build `--outDir /tmp/build-metAS`：entry `assets/index-u67lQpLo.js` sha256 `289a35532c5b6f9b426f0d7d7b43e9ec7d3c2272bc07f798d0c3ce58491dce12`，entry 内 `metAS-cost-delta`=0，chunk `MetricsModulePage-CJGRiM0y.js`=1。
- 未测项：真实 BFF 三面的实际数值未联调（本页只做现算）；切窗后三面随批重算仅由单测覆盖，未在真浏览器逐窗核对；模型聚合在本批未读时只能给「—」，不会自动补读。

## 热力卡图例与缺口说明（heat legend + gap note，2026-11-20）

- 图例：热力卡内新增 `met-heat-legend`（默认显示），两个色块＝「有运行」「无数据」，并附一句 `HEAT_LEGEND_TEXT`：「格内颜色是该时段（星期几×小时）的运行次数；空白格=这一格没有数据，不计入合计。」既有 `met5-legend`（四档强度 + 0 次 + 接口未返回）保留不动。
- 缺口说明：`HeatGrid` 增 `missingCells = 168 - presentCells`（接口没返回的格，与真实的 0 分开）；`heatGapNoteText(n)` 仅在 n>0 时给「本窗有 N 格空缺，合计只加有数据的格。」，页面渲染 `met-heat-gap-note`，无缺口时该行不渲染。
- 与订单一处已登记差异：订单原文写「N 天空缺」「格内数字是该日运行次数」，而本卡是 7×24 的「星期几×小时」网格（168 格，格内不显示数字，强度用颜色／点表示）。按实际网格写成「格／时段」，N 仍严格等于 `present=false` 的格数（与订单断言一致），避免在屏上把 168 格说成「天」。
- 同源：合计仍取 `grid.total`（只加 `present` 的格），与 `metX-heat-runs`（`heatCountSum`）逐值相等；真实的 0 计入合计，缺格不计入也不当 0。
- 零额外请求：图例与缺口说明都是渲染期现算，切热力窗只多发一次 `run-activity`。
- 测试（describe「met-heat-legend — heat legend and gap note」4 例）：图例常显且零追加请求；缺 1 格 → N=1 且 `met5-count` = `metX-heat-runs` = 有数据格求和；补齐 168 格 → 缺口行消失、真实 0 仍计入；1→4 周切换缺口 2→1，且该批只多一条 `/api/run-activity`。
- 验证：定向 `src/modules/metrics` 4 files / 232 passed（基线 228）；全量 159 files / 2184 passed（基线 2180）；`tsc` 本域 0（全仓既存 79）；`eslint` exit 0（0 error / 9 既有 warning）；build exit 0，entry `assets/index-CKW2g5do.js` sha256 `c60786e95bce0ffe757da6cb4b237dd6655cafae968a1961acd76962ce2db35f`（仅自查），entry 内 `met-heat-legend`=0，`MetricsModulePage-CGR6VJ4a.js` 内 `met-heat-legend`=1、`met-heat-gap-note`=1。
- 未测：真实浏览器 375/1440 下图例句折行与色块对齐。

## 导出与复制的可见反馈（met-output，2026-11-20）

`aria-live` 只有在屏幕阅读器里听得见；这一条把同样的句子写到屏上。

- 位置与 testid：页首 `metAM-matrix-note` 之下一条 `met-output-status`（`role="status"` + `aria-live="polite"`，可见文本，非 sr-only），带 `data-action`（`detail-export` / `share-export` / `copy-summary` / `copy-sources`）、`data-tone`（`ok` / `fail`）、`data-seq`（真实播报次数）。每句另有 `met-output-<action>`。
- 四句互不相同：明细「已导出明细 N 行：<文件名>。」；分摊「已导出分摊 N 行：<文件名>。」；摘要「已复制摘要：N 次运行 · $x.xx。」；来源「已复制数据来源摘要，共 N 行。」
- 签名门控：`signature = action|tone|text`，与上一次相同则直接返回——连点同一个导出不会重复播；换成另一个动作才递增 `data-seq`。禁用的按钮（`metAM` 矩阵口径）根本不进 handler，因此既不导出也不播报。
- 失败：导出包在 try/catch 里，异常时播「导出没成功：这份明细/分摊文件没有生成，重试一次看看。」，`data-tone="fail"`，并把请求编号行留在同一块（本地失败无请求号时写「本次请求未记录编号」，不编编号）；复制失败播「复制没成功：…下面的原文可以直接选中。」，既有兜底 textarea 不变。
- 零额外请求：四条播报全部读屏上已有数据，断言前后 `fetchJsonStrict` 调用数不变；既有按钮 testid、文件名与 CSV 契约一律未动。
- 验证：定向 metrics 4 files / 236 passed；全量 **2312 passed**；`tsc` 本域 0；`eslint src/modules/metrics` exit 0（9 条既存 warning）；build exit 0（entry 内 `met-output-status`=0，chunk `MetricsModulePage-*.js`=1）。
- 未测：真实读屏软件对「文本已存在、仅内容变化」的播报节奏；375 下长文件名折行。

## 采集时刻的统一呈现（asOf helper，2026-11-20）

两页各有一套「采集时刻」，口径已经收成一份：`web/src/modules/metrics/asof.ts`。

- 单一实现：`ASOF_KEYS`（`asOf`/`as_of`/`collectedAt`/`collected_at`/`generatedAt`/`generated_at`，只认顶层、只认带时区的 ISO）、`readAsOf(payload)`、`asOfText(iso)`、`asOfCell(asOf, source)`。`metrics.ts` 的 `readTopAsOf` 与 `TOP_ASOF_KEYS` 改为委托它，旧调用点零改。
- 渲染：合法值按北京时间到分（如 `2026-11-20 04:12`）；缺失或非 ISO 一律「—」；title 固定两句之一——`采集时刻 <ISO>（UTC） · 来源 <asOfSource>` 或 `上游未返回采集时刻；不用本机时间顶替。`；`asOfSource` 从不上屏。
- 落点：`/metrics` 的 `metB-source-asof-<key>`（新鲜度表最近采集列，metM 滞后徽标的 title 同样引用 helper 文本）；`/runs` 新增 `run-asof-line` / `run-asof`（计数行下方一行），值来自 `/api/runs` 顶层 `asOf`/`asOfSource`，数据层只多读两个已有字段，**不发新请求**。
- 零额外请求：两页断言前后 `fetchJsonStrict` / `fetchJSON` 调用数不变；`run-notes` 的采集时刻一行文案同步改为「屏上只取顶层 ISO 六别名」。
- 用例：新增 `web/src/modules/metrics/asof.parity.test.ts` 3 例——同一 payload 在两页的 `metB-source-asof-run-stats` 与 `run-asof` 文本、title 逐字 `toBe` 相等，覆盖合法 ISO / 缺失 / 非 ISO（`yesterday`）三态，并断言缺值 title 含「不用本机时间顶替」。
- 验证：定向 metrics+runs 4+3 files / 386 passed；全量 168 files / **2324 passed**；`tsc` 两域 0；`eslint` 0 error（9 条既存 warning）；build exit 0（entry 内 `run-asof`=0，`RunsModulePage-*.js`=1，`MetricsModulePage-*.js` 内 `metB-source-asof`=1）。
- 既有断言随统一口径收紧三处：metB 合法 title 由「采集时刻来自 bff」改为完整 ISO+来源；两处缺值 title 补「；不用本机时间顶替。」；`run-note-asOf` 文案改用「不用本机时间顶替」。均属口径统一，非放宽。
- 未测：真实浏览器 375 下 `run-asof-line` 折行；上游真的给出非 UTC 偏移时的显示（按同一 ISO 解析，理论一致）。

## 跨页时间与窗口护栏（cross-page guards，2026-11-20）

两页的「采集时刻」与 `/runs` 的时间窗，各自单一实现已在测试里钉住；本单只加测试，未改产品行为。

- 同源证据：源码读取断言 `RunsModulePage.tsx` 出现 `"../metrics/asof"`、`MetricsModulePage.tsx` 出现 `"./asof"`（不存在第三套）；同一 payload（`asOf=2026-11-19T20:12:00.000Z`、`asOfSource=bff-aggregation`）下 `run-asof` 与 `metB-source-asof-run-stats` 的文本逐字 `toBe` 相等（`2026-11-20 04:12`），title 亦 `toBe` 相等（`采集时刻 2026-11-19T20:12:00.000Z（UTC） · 来源 bff-aggregation`）。
- 三态：缺失、`yesterday`、空串三份 payload，两页文本都 `—`、title 都 `上游未返回采集时刻；不用本机时间顶替。`；注入假时钟 2031 后 `run-asof` 仍 `—`（只断言该处文本与 title —— 页面别处的导出文件名含生成时刻，属真实读取时刻，不算本机时钟冒充）。
- 窗口语义：`run-window-7d` 默认选中；24h/7d/30d 的 `/api/runs` `since` 与现在差落在 ±2 分钟；`run-window-all` 必发 `since=1970-01-01T00:00:00.000Z`，不省略（省略会被读口以 400 `request.missing_filter` 拒收）；`?window=xxx&status=failed` 按下 7 天读取、地址原样保留、`run-source-note` 写「未识别」。
- 批大小实测：`/runs` 切窗只让 `/api/runs` +1（`run-stats`、`employees` 零增）；`/metrics` 切统计窗只重发 usage 的 2 条 `run-stats`（当前窗 + 上一窗），`run-activity` 不动；第二次切换仍恰 +2。
- 验证：单文件 5 passed；定向 metrics+runs 10 files / 391 passed；全量 170 files / **2356 passed**；`tsc` 两域 0；`eslint` exit 0（9 条既存 warning）；build exit 0（entry 内 `metB-source-asof`=0，`MetricsModulePage-*.js`=1）。
- 未测：375 折行；读口在 `since=1970` 极限窗口下的真实响应（只钉请求形状）。

## 成本明细行复制（met-rowcopy，2026-11-20）

成本明细表每行末尾多一列「复制」，按钮 `met-row-copy-<i>`（原生 `button[type=button]`，可聚焦、有 `aria-label`「复制<分组名>这一行」）。

- 文本由 `metrics.ts` 的 `rowCopyText(line)` 一处拼出：`分组名 · 运行数 · 成本 · 占比`，四段全部走表格同一套格式化函数（`formatCount` / `formatUsd` / `formatSharePct`），所以真 0 仍是 `$0.00` 与 `0`、缺失仍是「—」，不读时钟、不带裸内部 id。
- 零额外请求：按钮只读该行已渲染的数据；用例断言点击前后 `fetchJsonStrict` 调用数相等。
- 反馈：成功显示 `met-row-copy-status`（`role=status` + `aria-live=polite`，「已复制」）；剪贴板拒绝时同一块给「复制没成功：下面的文本可以自己选中复制。」并渲染只读 `met-row-copy-fallback-text`，值与投递文本逐字相同。
- 行序：`met-row-copy-<i>` 的 `i` 与 `met6-row-<i>` 同序，随 `?dsort/?ddir` 变化（`?dsort=cost&ddir=asc` 时第 0 行即最便宜的一行）。
- 表头与表尾各补一格，合计行仍只加表体的可读数值。
- 验证：定向 metrics 6 files / 247 passed；全量 177 files / 2409 passed；`tsc` 本域 0；`eslint src/modules/metrics` exit 0（9 条既存 warning）；build exit 0（entry 内 `met-row-copy`=0，`MetricsModulePage-*.js`=1）。
- 未测：真实浏览器 375 下多一列后的横向滚动宽度；系统剪贴板权限弹窗。

## 导出与复制同源护栏（R116，2026-11-20）

- 新增 `web/src/modules/metrics/metrics.export.test.tsx`（5 例）：明细 CSV 的数据行数、`met6-table` 表体行数、`met-row-copy-*` 按钮数三值相等（同一夹具 3 行）；导出顺序跟随 `?dsort/?ddir`（asc 首行=小鲤、desc 首行=小满，文件首列与屏上第一行同名）；真 0 与缺失在文件与复制里各自成立；导出与复制全程 `fetchJsonStrict` 调用数不变；无行时导出 disabled + title 且不渲染任何行复制按钮。
- **改前/改后（口径收紧，R116 ⑤ 覆盖 metR 的旧口径）**：改前明细导出在「有窗口、无明细行」时仍可点，文件只写表头，`metAM` 说明句写「时间窗没有数据时，导出只写表头、复制照常」；改后 `gates.detailExport.enabled` 追加 `&& exportable`，`exportCsv` 也短路，空明细一律 disabled，title 改为「当前窗口没有明细行：没有可导出的数据；空窗口用屏上的计数说明，不导一个只含表头的文件。」，`metAM-matrix-note` 同步改为「时间窗没有明细行时，明细导出停下、摘要复制照常（分摊为空仍可导出只含表头的文件）」。分摊导出（metA）保持原样：空分摊仍可导表头。随之为两处旧断言改口（`metR` 空窗用例与 `metAM` cell 3），属语义收紧，非放宽。
- 格式分层沿用 metO：屏上 `$0.00` / `0.0%`，CSV 写机器数位（真 0 为 `0.00`，占比按上游原值 `0` / `100`，不带 `%`），缺失在两边分别写空字段与「—」；两者取同一行对象，不各自重算。
- 验证：定向 metrics 7 files / 252 passed；全量 184 files / 2474 passed；`tsc` 本域 0；`eslint src/modules/metrics` exit 0（9 条既存 warning）；build exit 0（entry 内 `met-row-copy`=0，`MetricsModulePage-*.js`=1）。
- 未测：真实浏览器 375 下表格与行复制列宽；系统剪贴板权限拒绝弹窗。
