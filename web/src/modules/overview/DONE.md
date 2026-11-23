# DONE — OM-01 总览 KPI 真读数

分支 `task/OM-01-overview-kpi`（基线 origin/lane/hermes-console @648233693d）。
写域：`web/src/modules/overview/**` + 本取证目录。未动 BFF / App 路由 / 其它模块。

## 改了什么

新建 `OverviewModulePage.tsx` + `api.ts`，重写 `overview.ts`（旧 `OverviewPage.tsx`
与其测试删除——它无人引用，且口径来自 duty 六腿聚合，不合本单合同）。

总览 5 张 KPI 卡，数据**只**来自现网 BFF 两个端点：

| 卡 | 读数 | 端点 |
|---|---|---|
| 员工 | 在编 3 / 在岗 2 | `GET /agent-api/api/overview/summary` `employeeTotal`/`activeTotal` |
| 今日运行 | 真 0，失败率分母同源 | summary `todayRuns`；失败/失败率取 `run-stats?from&to&bucket=day`（今日窗）`totals.failed`÷`totals.runs` |
| 待审批 | 真 0 | summary `pendingApprovals` |
| 今日成本 | `$0.00` | summary `todayCostUsd`（run-stats 今日窗合计供核对） |
| 健康 | 正常 | summary `healthStatus`（bff fan-out probe） |

趋势条 = `run-stats` 14 日窗日桶（现网**不存在** `/api/daily-trend` 端点，实测 404
`console.unknown_route`，趋势按更正令「run-stats/daily-trend 真读数」取日桶序列）。

纪律落实：
- 任一字段取不到 → 值置 `null` 上屏「未接」+ 来源行「来源未读取到」，读口失败 →
  卡内 issue「××未接入：<接口错误>+请求编号+重试」；**无 fixture、无假 0、无假成功**。
- 真 0 带来源说明：note 原文「0 来自接口真实返回：<接口自带 source 字段逐字>」。
- 每卡「数据截至 …（北京时间）」取字段自带 `asOf`；上游没带 →「时间未知（原因）」。
- 顶部 as-of 取各路最新。原始 JSON 面板逐字展示本次两路接口原文，无 innerHTML。
- 失败率口径裁定（本单自决，理由记录）：分子分母必须同源——用 run-stats 今日窗
  `totals.failed ÷ totals.runs`，不用 summary.todayRuns 做分母（两端口聚合窗不同，
  混源会造出假比率）。

## 接口原文（2026-11-23 现网 8092 BFF 经 9131 独立脸实测，全文见 `docs/_artifacts/OM-01-overview-kpi/raw/`）

`GET /agent-api/api/overview/summary` → 200（raw/overview-summary.json）
```json
{"employeeTotal":{"value":3,"source":"domain GET /v1/employees?limit=100（单页）","asOf":"2026-11-23T11:41:22Z"},
 "activeTotal":{"value":2,"source":"domain GET /v1/employees?limit=100（单页）（lifecycleState=active 计数）"},
 "todayRuns":{"value":0,"source":"runtime GET /v1/runs/stats（from/to=北京日窗 bucket=day）"},
 "todayCostUsd":{"value":0,"source":"runtime GET /v1/runs/stats（from/to=北京日窗 bucket=day）"},
 "pendingApprovals":{"value":0,"source":"domain GET /v1/approvals?status=pending&scope=tenant（租户收件箱）"},
 "healthStatus":{"value":"ok","source":"bff fan-out probe（本请求 employees/runs-stats/approvals 三路上游结果）"},
 "asOf":"2026-11-23T11:41:22Z","asOfSource":"bff-aggregation-read-time"}
```

`GET /agent-api/api/run-stats?from=…&to=…&bucket=day` → 200（今日窗 + 14 日窗两件）
```json
{"totals":{"runs":86,"succeeded":85,"failed":0,"running":1,"costUsd":1.27018,"sampleCount":85,"successRate":1.0},
 "asOfSource":"bff-read-time","buckets":[{"bucketStart":"…","runs":…,"failed":…}]}
```
无参数 → 400 `{"code":"request.missing_filter","message":"from and to are required"}`（如实透传）。

## 截图（9131 独立脸：harness dist → v4_proxy → 真 BFF 8092，登录态 whoami=200 前置断言，playwright 真实等待，非合成）

- `docs/_artifacts/OM-01-overview-kpi/shots/overview-1440.png` — 桌面 1440×900
- `docs/_artifacts/OM-01-overview-kpi/shots/overview-375.png` — 竖屏 375×812 首屏
- `docs/_artifacts/OM-01-overview-kpi/shots/overview-375-lower.png` — 竖屏滚动到底（趋势+原文面板）

取证时页面读数（与 raw 逐字一致）：员工 3、今日运行 0、待审批 0、成本 $0.00、健康 正常；
请求日志三路全 200（`raw/endpoint-log.json`）。observer 两轮核验通过；轻微遗留（不阻塞）：
趋势末柱贴容器右缘（右内边距偏小）、柱形无值标注（数值以原文面板为准）；
observer 第三轮（OM-03 五列网格）判定 PASS，另记 1440 五列变窄后来源串 CJK 折行增多
（词中断行，观感级，建议后续统一 `overflow-wrap:anywhere` 或缩短来源文案，不在本单动）。

## 测试与构建

- `cd web && node_modules/.bin/vitest run src/modules/overview` → **53 passed / 53**（OverviewModulePage.test 11 + overview.window.test 6 + overview.trend.test 4 + overview.gaps.test 5 + overview.feeds.test 6 + overview.asof.test 5 + overview.health.test 5 + overview.cost.test 6 + overview.summary.test 5）
  （OverviewModulePage.test 11 + overview.window.test 6 + overview.trend.test 4 + overview.gaps.test 5）
  （合同：forced 态零请求；只打两端口且 bucket=day；真 0 带来源原文；失败率同源 20%；
  summary 挂→各卡未接入+编号+重试；今日窗挂只影响运行卡；全挂整页错误声明不编造；
  采集时间行；日桶渲染；原文面板无 innerHTML；OM-03/10 五卡等宽+健康卡真来源钉；
  OM-04 四档深链/切窗计数/回落说明；OM-05/06 趋势桶契约与缺字段诚实线）
- `cd web && node_modules/.bin/vite build` → 通过（产物 `<tree>/hermes_cli/web_dist`）。

## OM-02 前提复核（2026-11-23 21:2x 现网实测，未动主仓 BFF）

backlog `docs/product/backlogs/overview-metrics.md` OM-02 断言「`/api/workbench/*` BFF 0 命中→404」。
现网 9122 带登录态实测三条腿全部 **200**，且形态已合 OM-02 DoD：

- `workbench/summary?range=1d` → kpis:[{key:runs,label,value,previous,delta,available,reason}]，含 window/previousWindow
- `workbench/timeseries?range=7d&bucket=day&metric=runs` → points:[{ts,label,value}]、totals、缺桶语义在
- `workbench/queue?page_size=5` → `{items:[],total:0,available:true,asOf,asOfSource:"bff-read-time",note:"…不造数"}`

判读：**OM-02 工单前提失真（backlog 落后于现网），不新建死代码**；请 L0 按 rubric 更新 backlog 后
OM-02 可径直标 VERIFIED（腿已在）。P-OM-3 的「workbench 0 命中」同此失效。

## OM-03 / OM-10 同批裁定（本车道，前端侧）

- **OM-03 裁定：保持 5 卡**（employeeTotal/activeTotal 合卡、runs、pending、cost、health 各对应
  `overview/summary` 独立来源字段，撤任何一张即丢一路真读数）。网格 `repeat(auto-fit,minmax(200px,1fr))`
  ——1440 五列等宽无孤列，窄档维持 2/1 列断点；截图 `overview-1440.png` 为证。
- **OM-10 裁定：健康卡已是真读口**——值取 `overview/summary.healthStatus`，来源标注
  `bff fan-out probe（本请求 employees/runs-stats/approvals 三路上游结果）`，不再用本页取数成败计数；
  测试钉住卡面含该来源串且无「n/6 来源正常」话术。`/api/hermes-summary` 属 metrics 车道（MT 组），不在本写域重复接线。
- P-OM-2（失败率同源同窗）在 4bf3097a91 已修：分子分母同取 run-stats 今日窗 totals。

## OM-04 时间窗切换（24h/7d/14d/30d）

- 档位复用值守页 `duty/dutyRange.ts` 的 `DUTY_RANGES`（不另立枚举）；深链 `?range=` 经
  `parseDutyRange` 解析，非法值回落默认档并在页顶 `ov6-range-fallback` 说明原值与生效档。
- 趋势腿按档独立请求 run-stats：24h 走 **hour 桶**（现网实测 200，空桶如实空态句，不放假柱），
  7d/14d/30d 走 day 桶 `daysAgoWindow(days-1)`；趋势标题/来源行/aria-label/空态句全部随档位变量。
- 切窗**只重发趋势腿**：summary+今日窗不重复请求（测试钉住点击 30d 后 summary 计数不变、
  run-stats 仅 +1）；KPI 五卡恒为「今日」口径，不随趋势窗漂移——这是与 backlog 草案的差异点，
  如实记在此，若 L0 要求 KPI 随窗需另裁。
- 硬门二 `scripts/lint-fake-success.mjs` 在 l0-board/fork/l7-ops 均不存在（全盘 find 无果）：
  以测试合同替代闸门——null→「未接」、真 0 必附接口来源原文、无 fixture 上屏；建议 L0 补该脚本。
- 取证：`overview-1440.png`（五档 pill 在列）、`overview-range7d.png`（近 7 天窗实测脸）。

## OM-06 趋势数据契约（桶数与柱子一一对应，缺桶不画假柱）

- `trendPoints` 每桶新增 `failed: number | null`；柱子渲染规则：
  **runs 为 null 的桶** → `.ov5-bar.is-missing`（只有轨道无柱体），**runs 真 0 的桶**同样不放假柱体；
  仅 `runs > 0` 才按 `runs / max(非null runs)` 归一画柱高（不再用 2% 占位高度冒充读数）。
- 全桶 null → 空态句「…桶没有可用的运行数，这里不放柱子图。」且 `ov6-bars` 不存在；
  全桶真 0 → 空态句「…内接口真数为 0，还没有运行记录，这里不放柱子图。」（OM-06 DoD 点名话术）。
- **失败数只进悬停 title**：`label · 运行 n · 失败 n`（null 显示「未接」），柱体可见文本无「失败」字样
  （测试钉死，防窄栏挤压换行）。
- 测试：`overview.trend.test.tsx` 4 项——N 桶→N 柱且 is-missing 计数= null 桶数（[44,null,0,4]→4 柱、1 缺、仅 2 有柱体）；
  全 null / 全 0 → bars=0 + 各自空态话术；失败只现于 title。

## OM-05 KPI 缺字段/错误态诚实线（测试面补齐）

- **缺字段 ≠ 链路故障**：`summary` ready 但字段缺失 → 卡面值恰为「未接」（非空串、非假 0、无 $0.00），
  附注「接口未返回该读数；置 null，不以 0 冒充」，且**不出现**任何 `-issue`（错误态）节点；
  summary 整体 error → 才出现「未接入：」+ 请求编号 + 重试按钮（两态在测试中分开断言）。
- 运行卡缺 todayRuns → 注明「未用 run-stats 桶合计冒充（口径不同）」；失败率缺分母 → 「未接」不出 0%。
- 健康卡缺 `healthStatus` → 「未接」，且全页无「n/6 来源正常」类合成计数话术。
- 测试：`overview.gaps.test.tsx` 5 项（每缺口点名 testid 断言；模块用例总数 26 ≥ backlog 要求的 15）。

## OM-07 最近运行 + OM-08 阻塞三路（2026-11-23 续跑，同分支）

- **端点全部现网实测后才动工**（登录态 9122 脸直探）：
  - `GET /api/runs` 裸请求 → 400 `request.missing_filter`（至少要有 employeeId/status/since 之一）；`runs?since=<7天前ISO>&limit=3` → 200，items 带 runId/status/reasonCode/startedAt/costUsd。
  - `GET /api/run-activity` 虽 200，但返回的是**热力格 cells**（dow/hour/count），不是可点行——弃用，活动腿改走 `runs?since&limit`。
  - `runs?status=failed&limit=5` → 200 `items:[]`（今日真 0）；`tasks?status=blocked&limit=5` → 200 items（含标题「验收用任务 · 受阻」）；`workbench/queue?page_size=5` → 200 `items:[], total:0, available:true`。
- **OM-07 呈现契约**：每行必须接口自带 runId 才上屏并链 `/runs/<id>`（缺 runId 的行直接丢弃，不编号不造假 id）；时间=beijing(startedAt||endedAt)，两者皆缺显示「时间未带」；空 items → 「近 7 天接口没有返回任何运行记录（真 0，不是占位）。」；错误腿 → 「最近运行未接入：<message>」+请求编号+重试钮。
- **OM-08 呈现契约**：失败运行/受阻任务/审批三路各自独立成腿，计数只来自各接口返回条数（真 0 来自接口）；行链 `/runs/<id>`、`/tasks/<id>`；审批项无现网详情页故**不造链**；三路未全通时文案明说「只列已接通部分的阻塞项，不合并猜测」，禁全 0 假安慰。
- **KPI 卡口径未变**：仍只来自 overview/summary + run-stats；新腿只喂列表节（测试钉住：KPI 卡的 source/stamp 仍指这两端点）。
- **修出一个真 bug**：`loadSummaryToday` 旧补丁 `({summary, today, trend: prev.trend})` 不展开 prev，会把后到的 extras 四字段整体抹掉（页面上列表节永远「读取中」）——改为 `({...prev, summary, today})`；这正是「部分构造新对象丢字段」的经典雷。
- 自动重试 20s 周期现在覆盖全部六条腿（任一 error 即静默重读）。
- 取证：三张图重拍于新代码（含列表节），见上节截图路径。

## OM-11 采集时刻纪律（2026-11-23 续跑，同分支）

- 合同：as-of 行只渲染上游自带 asOf 或「—（只认上游采集时间，前端时钟不顶替）」；页内渲染期不出现浏览器时钟。
- 落地：
  - 页面 `new Date()` 直接调用清零（DoD grep 口径）：`since7d` 改走 `daysAgoWindow(7).from`；24h 窗时刻集中到数据层 `overview.ts:last24hWindow()`；原文面板「页面时间」行删除动态钟，改为静态句「页面时间不参与新鲜度判定」（`grep -n "new Date()" OverviewModulePage.tsx | grep -v setTimeout | wc -l` = 0）。
  - 全腿失败/未读时 `ov6-asof` 仍在 DOM，值「—」并给原因（R31 永不缺席）；多来源取最新（R41）。
- 测试面 `overview.asof.test.tsx` 5 例：①系统时钟前移 24h 屏上时刻不变；②多源取最新；③全 error 仍有「—」；④ready 无 asOf → 卡内「时间未知（上游响应没有带采集时间）」；⑤loading 态 as-of 在场 + 面板不印浏览器时钟。
- 现网抽核（步骤④，登录态 9131 脸）：curl `overview/summary` asOf=2026-11-23T14:04:54Z ↔ 屏上「数据截至 2026-11-23 22:04（北京时间）」，PARITY_OK；证据 `docs/_artifacts/OM-01-overview-kpi/raw/om11-parity.json`。
- 说明：backlog 的 DoD grep 目标 `OverviewPage.tsx` 已被 OM-01 删除，等价口径落在 `OverviewModulePage.tsx`。

## OM-10 健康卡两段式（2026-11-23 续跑，同分支）

- 裁定：健康卡保留，但不再用本页取数成败冒充服务健康。现网实测 `GET /agent-api/api/hermes-summary` → 200（schema runtime.hermes.summary.v1，gateway.status=ok，gateway.updated_at 自带采集时间；原文落盘 `docs/_artifacts/OM-01-overview-kpi/raw/hermes-summary.json`）。
- 第一段＝服务探针：值取 `gateway.status`（ok/degraded/down → 正常/降级/异常，未知状态原样透传），来源标注逐字 `GET /api/hermes-summary · runtime /v1/runtime/hermes/summary（schema runtime.hermes.summary.v1）`；时刻行取 `gateway.updated_at`（无则「服务探针响应没有带采集时间」）。探针腿失败 → 卡内「服务探针未接入：<message>」+ 请求编号 + 重试，值「未接」。
- 第二段＝本页读数合成状态：仍在卡脚注明 `bff fan-out probe（本请求 employees/runs-stats/approvals 三路上游结果）`，两段分列不混算。
- 旧「x/6 来源正常」话术绝迹：overview.health.test ③ 以 `/\d+\/\d+/` 反向断言钉死（DoD ④：404/503 → 未接，非 0/6）。
- 探针腿纳入自动重试（anyError 含 probe）与原文面板（ready 时列 `GET /api/hermes-summary`）；KPI 其余卡口径不变（只允许 overview/summary + run-stats）。
- 现网真页抽核（脸 9131，登录态 whoami=200）：健康卡 DOM = 「整体健康（服务探针）… 正常 … 本页读数合成状态：正常（bff fan-out probe…）数据截至 2026-11-23 23:14」。
- 取证刷新：overview-1440 / overview-range7d / overview-range24h / overview-375 / overview-375-lower（OM04_SHOTS_OK + OM375_SHOTS_OK，22:1x 重拍）。

## OM-09 成本口径卡（2026-11-23 续跑，同分支）

- 裁定：今日成本只认 `summary.todayCostUsd` 单字段（OM-01 合同：KPI 卡只走 overview/summary + run-stats 两端口）。backlog 草稿里的 budget-usage partial 覆盖腿属旧 duty 架构，不引入；其「partial→null」矩阵在本卡落地为 **字段缺失或 value=null → 「未接」**，绝不以 0 冒充。
- 真 0 契约：`0` 上屏 `$0.00`（usd 两位小数）并带「0 来自接口真实返回：<source 口径原文>」说明；缺值不显示「—」金额混淆形。
- 故障口径：总览腿 error → 成本卡「聚合总览未接入：<message>」+ 请求编号 + 重试钮，卡内不出现任何金额数字。
- 话术闸门：钱袋节点无「≈/估算」、无 pricing/unitPrice 外漏（overview.cost.test ⑥ DOM 断言）；源码闸门 `grep -En 'pricing|unitPrice' 非测试文件` = 0 已核。
- 测试：新增 `overview.cost.test.tsx` 6 例（①有值带来源 ②真0带说明 ③字段缺未接 ④value=null 未接 ⑤故障未接入+重试 ⑥无估算话术）；全模块 **48 passed / 48（8 文件）**，`vite build` EXIT=0。

## OM-12 撤除 ?state= 强制态（2026-11-23 续跑，同分支）

- **撤除内容**：`params.get('state')` 读取、loading/empty/error 三个演示分支（data-fixture=1、ov6-watermark、data-demo-state、demo prop 全删）；挂载效果与重试定时器不再跳过任何态——生产路径只走真实聚合。
- **DoD 达成**：非测试 grep `data-fixture`（overview 模块）= 0；页面唯一 `state=` 命中是 OverviewView 的组件 prop，不是 URL 参数；`?state=error` 深链被忽略，页面照常发真实读数腿（新测试钉住：无水印、无 fixture 标记、无「演示错误态」文本、fetch 有发出）。
- **状态矩阵去处**：由 OM-05 测试面（gaps/trend/health/cost）在 OverviewView 层承接，覆盖面不减。
- **范围外债（另立卡，不动他人写域）**：`web/src/modules/duty/UsagePage.tsx` L105 仍有 `?state=` 演示参数（backlog 原文「同批或另立卡」）——duty 模块不在本车道写域，建议 L0 派给 duty 车道。
- 验证：vitest **48 passed / 48**（撤除+改写后全量重跑）；`vite build` 通过。

## OM-13 摘要复制（对齐 metrics 口径单源，2026-11-23 续跑，同分支）

- **纯函数**：`overviewSummaryText`（overview.ts）只吃调用方给好的字符串——函数体 grep `fetch|loadJson` = 0（DoD），不发新请求、不做金额反推；缺值上屏「—」（与 DOM 的「未接」话术分开：摘要面向复制文本，统一破折号）。
- **形制**：六段式对齐 metrics `metricsSummaryText`——标题行 / 数据截至行（只认上游采集时间）/ 五卡行（`- 标签：值｜来源 X｜采集时刻 Y`）/ 成本口径行。
- **成本句逐字同**：不复制文案，直接 `import { COST_CALIBER_TEXT } from '../metrics/costCaliberNote'`——单源保证两页 diff 零差异；parity 由测试断言剪贴板文本 `toContain(成本口径：${COST_CALIBER_TEXT})`。
- **交互**：头部「复制摘要」按钮（ov6-summary-copy）；成功 → role=status「已复制到剪贴板」；失败（无剪贴板 API 或 reject）→ 明说复制失败并渲染只读 textarea（ov6-summary-fallback）自动 select()，仿 met-row-copy-fallback，**不假装成功**。
- 测试 5 例：纯函数形制（整串全等断言）、函数体零 fetch、复制成功内容含五卡行+采集时刻+成本句、复制失败兜底、空读数不造 0 不造金额。
- 取证：1440/375/375-lower/range7d/range24h 五图刷新（OM04_SHOTS_OK + OM375_SHOTS_OK）；vitest **53/53**；vite build 通过。

## OM-14 响应式总闸（2026-11-23 收口）

- **assert-375 真跑通过**：`node scripts/assert-375.mjs --base=http://127.0.0.1:9131 --auth-state=/tmp/om14-auth.json --only-routes='#/overview' --out=docs/_artifacts/OM-01-overview-kpi/375`
  读数（逐字）：`ASSERT375 routes=2 pass=2 fail=0 notMeasured=0`；`#/overview` 行：mainTextLen=844、elementsChecked=89、**violOutsideShell=0、violInsideScrollableShell=0、domOverflowPx=0**、fullPage png 375×1203（>812 判据满足）。
  第二轮曾 notMeasured=2 的根因如实记录：取证 harness 此前没有 `<main>` 壳，脚本骨架闸（main 文本<30 判 NOT_MEASURED）拒签——**补 `<main>` 包装后真跑绿，不是改判据**（storageState cookie 域 127.0.0.1 注入按记忆坑单独立核对）。`#/overview?tab=usage` 行在 harness 上渲染同一页（MemoryRouter 不响应 hash 变化），usage 页 375 判据归 duty 车道台账，本行不代替。
- **测试面闸**：`src/modules/overview` 下 **9 个测试文件 / 53 用例**（≥6 文件、≥30 用例达标），全绿。
- **375 单列**：媒体查询断点实装（1100 两列 / 560 单列）；overview-375.png 与 overview-375-lower.png 复核 KPI/趋势/最近运行/阻塞/摘要复制/原文面板无溢出。
- **轻微遗留（不阻塞，沿 observer 判定）**：趋势柱首末贴容器左右缘（容器 padding 层面）；来源长串中文在卡内中间换行。属跨页家族遗留，另卡治理，不在本件偷改。

## 已知边界（如实上报，非缺陷隐瞒）

1. `/overview` 路由现仍渲染旧 `modules/duty/DutyPage`：路由在 `App.tsx`（本单写域外），
   manifest 的 duty 标签被 App `live` 覆盖锁死。`OverviewModulePage` 已按合同交付，
   接线需一条 App 侧后续单（一行替换 import + live 项）。
2. 旧登记行 `task-lanes.json` Q11（session ses_df7932bf…）已被本 OM-01 车道取代，
   未擅自回改，请 L0 收口。
