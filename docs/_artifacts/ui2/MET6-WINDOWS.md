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
