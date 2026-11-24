# OM-15 总览栈新基重放 — 交付记录

- 车道：task/OM-15-replay（基线 5191a706cd19ab6561ea2e4970a683f9ccd439bd，`lane/hermes-console` 现读）
- 会话：ses_df7d07927ffeATkmE5GI9Bhh2f · 日期：2026-11-24
- 旧栈 `task/OM-01-overview-kpi`（tip 4cbd84a03a…）经 L0 判废（落后 137 枚、挂载面回滚冲突，abort 留证于旧 DONE），本件在新基上重放清单五件。

## 五件逐项裁定（对照参谋重放单）

1. **健康卡两段式（OM-10 语义）— 本件主交付**
   - 旧假话术退役：卡内不再出现 `n/6 来源正常`；服务健康只认 `GET /api/hermes-summary`（现网实测 200，schema `runtime.hermes.summary.v1`，原文存 `docs/_artifacts/OM-15-replay/raw/hermes-summary.json`）。
   - 值 = `gateway.status` 映射（ok 正常 / degraded 降级 / down 异常），取不到 = 「未接」/「—」，**不以本页读数冒充**；采集时刻走 `gateway.updated_at`（复用 sourceStamp 管道，无前端时钟顶替）。
   - 本页六路读数合成态降级为 foot 注脚，明写「本页读数合成状态，不等于服务健康」；探针故障走「服务探针未接入：<message>」+ 请求编号 + 重试钮。
   - 代码位：`web/src/modules/overview/api.ts`（新）、`OverviewPage.tsx` 健康卡 + LiveOverview 探针腿、`overview.health.test.tsx`（5 例）。
   - 现网 DOM 实证（face=自证，见「取证」）：卡文本 `健康检查（服务探针）GET /api/hermes-summary正常本页六路读数全部就绪（本页读数合成状态，不等于服务健康）数据截至 2026-11-24 05:11 · 来源 服务探针`，`/agent-api/api/hermes-summary` 响应 200。
2. **栈式时间窗（OM-04 语义）— 现脸已具，验收通过**：`?range=` 深链 + parseDutyRange 非法回落注 + 四档 pill + aria-pressed，均有钉测（overview.window.test.tsx，并入脸前 wave）。切窗走 useDutyData(rangeId) 整页腿——与旧栈「只重发趋势腿」裁定不同，属现脸既定架构（duty 数据流），写域不含 useDutyData，**不偷改**；已在已知边界记录。
3. **趋势（OM-06 语义）— 现脸已具真读数**：Trend 读 `data.stats14` = `GET /api/workbench/timeseries`（现网 200，见取证 REQS 行），非拼接 run-stats；null 桶 `is-missing` 不画柱体、全缺→「{label}的运行数据没有返回」、全 0→「{label}还没有运行记录」、失败数只进 title——合同由 face 已并的 overview.trend.test.tsx 钉住。**裁定：不切 run-stats**（duty/workbench.ts 头注：stats/queue/trend 以 workbench 真端点为准，不再手缝 /run-stats；OM-15 单要求的是诚实读数，非特定端点）。
4. **最近活动（OM-07 语义）— 现脸已具**：`GET /api/runs?since&limit=3` 真读数 + 钻取 `/runs/<runId>` + 状态四词表 + 空态句「近 7 天没有运行记录。」，overview.activity.test.tsx 钉住。取证 REQS 见 `runs?since=…&limit=3` 200。
5. **阻塞三路（OM-08 语义）— 现脸已具**：失败运行（`runs?status=failed`）/ 受阻任务（`tasks?status=blocked`）/ 审批（`approvals`）三路合并诚实线，部分未接→「有阻塞源未接入，下面是已读到的部分，不代表全部。」，全接且空→「当前没有读到阻塞项。」，取证 REQS 三路 200。

## 测试与门禁

- 模块点名：`cd web && node_modules/.bin/vitest run src/modules/overview` → **52 passed / 52（7 文件）**（health 5 + summary 5 + face 旧 42 零回退，`ov6-kpi-health-stamp` 兼容 R29 断言）。
- OM-13 摘要复制（本分支续笔重放）：`overview.ts` 纯函数 `overviewSummaryText`（零 fetch，DoD grep 函数体 fetch/loadJson=0），页头「复制摘要」按钮走 `navigator.clipboard.writeText`，失败→`ov6-summary-copy-fail` + 可选中文本域兜底（不假装成功）；成本句逐字引用 `../metrics/costCaliberNote` 的 `COST_CALIBER_TEXT` 单源（parity 测试⑤钉死）；行制 `- 标签：值｜来源 X｜采集时刻 Y`，缺值「—」，不做金额反推（今日成本=usd(kpis.costUsd) 原值）。
- 全量 vitest（含本 wave 全部代码，font-scale 令牌修正 + e1Contract 环境处置之后复跑）：`cd web && node_modules/.bin/vitest run src` → **Test Files 538 passed (538) / Tests 4119 passed | 1 skipped (4120)，FULL_EXIT=0**（零回退）。
  - 判读记录（逐字）：中途一轮 `1 failed | 537 passed` 红为 `src/shell/e1Contract.test.ts`：`AssertionError: served entry drifted from the dist on disk: expected 'assets/index-CtA6doEj.js' to be 'assets/index-B6ekxqxp.js'`。归因=本车道 `vite build` 在本树生成 **gitignored** 的 `hermes_cli/web_dist`（05:19 新建，非源码改动），而 9122 验收脸服务的是共享检出 dist——环境漂移，不是 diff（记忆在册：e1Contract 依赖 9122 活部署，fork 车道结构性红判环境不判 diff）。处置=删除本树构建残迹 `hermes_cli/web_dist` 后，该测试回落到自带 SKIPPED-NOT-DEPLOYED 语义：`VERDICT=SKIPPED-NOT-DEPLOYED reason=dist-unreadable PORT=9122 DISK_ENTRY=DIST-UNREADABLE SERVED_ENTRY=assets/index-CtA6doEj.js`（与基线绿跑同形制，未放宽判据）。
  - 另一处 `src/components/ui/font-scale.test.ts` 曾红（我的 .ov5-copy 两个 `font-size:12px` 字面量把 overview.css 推入离阶 top 集合）→ 已令牌化为 `var(--font-size-1)`（=12px，src/styles/tokens.css L133 同源），复跑 4/4 绿。
- `vite build`：**BUILD_EXIT=0**（/tmp/om15c-build.log；门后本树 dist 残迹已清，见上）。`tsc -b . --noEmit`（node26 = ~/.nvm/versions/node/v26.13.1）：TSC_EXIT=2，**49 条 `error TS` 全为仓库存量，modules/overview 命中 0**（grep=0；/tmp/om15c-tsc.log）。
- assert-375（重建 harness 含令牌修正后复跑，逐字）：`ASSERT375 routes=2 pass=2 fail=0 notMeasured=0 matrixPresent=false matrixOk=skipped-scope`；`#/overview` 行 mainTextLen=844、elementsChecked=89、violOutsideShell=0、violInsideScrollableShell=0、fullPage 375×1203。台账 `docs/_artifacts/OM-15-replay/375/`。
- 375 总闸：`node scripts/assert-375.mjs --base=http://127.0.0.1:9131 --auth-state=/tmp/om14-auth.json --only-routes='#/overview'` → 逐字读数 `ASSERT375 routes=2 pass=2 fail=0 notMeasured=0 matrixPresent=false matrixOk=skipped-scope`（harness 已带 `<main>` 壳；`#/overview?tab=usage` 行在 harness 渲染同页，usage 页 375 判据归 duty 台账）。

## 取证

- `docs/_artifacts/OM-15-replay/raw/hermes-summary.json`：现网 curl 原文（schema runtime.hermes.summary.v1，gateway.status ok，updated_at 2026-11-23T21:10:56.577492+00:00）。
- `docs/_artifacts/OM-15-replay/shots/overview-1440-health.png`：harness 脸 9131 + 真 BFF（8092）+ opsadmin 登录态（whoami 200 前置断言）实拍；卡内两段式文案与来源标注如上。
- 浏览器网络腿逐条 200（hermes-summary/employees/runs/tasks/approvals/matrix/workbench 等，REQS 日志随本 wave 落盘）。

## 已知边界（如实上报）

- `/overview` 路由挂载仍认 `OverviewPage`（现脸既定 1fe8bc6c65 挂载决策），本件遵守不改挂载面。
- 强制态 `?state=` 分支在现脸仍存在（OM-12 重放不在本单五件清单）——留待 L0 另拍。
- 切窗即整页 refetch（useDutyData 架构），旧栈「仅趋势腿」裁定未重放；若要改需扩写域到 modules/duty/**。
- 404 一条：`/agent-api/api/knowledge/citations`（duty 侧知识腿，非本件写域，记录不处置）。
- 后续：OM-13 摘要复制已在本分支续笔重放（见上）；SE-06 属会话 ses_e2336b084ffeb8，不接单。
- 现网脸取证（harness 9131 → 共享 BFF 8092，令牌注入域 127.0.0.1，whoami==200 前置）：健康卡 DOM 逐字 `健康检查（服务探针）GET /api/hermes-summary正常本页六路读数全部就绪（本页读数合成状态，不等于服务健康）数据截至 2026-11-24 05:21 · 来源 服务探针`；复制摘要按钮真实点击 → `COPY=已复制到剪贴板`；端点日志除 duty 侧 `404 /agent-api/api/knowledge/citations`（越界，另报）外全 200 含 `/agent-api/api/hermes-summary`。图：`om15-overview-1440.png`、`om15-overview-375-v2.png`、`om15-overview-375-lower-v2.png`（docs/_artifacts/OM-15-replay/shots/）。

## 交付收口（换基与远端验证）

- c1 代码 426962a446a960cef1677ae02ab86addf346098d；c2 取证 4c44f35f59f4f250ee677805e471cdbb724cc560；推后现读 B=9>5（脸 158dd5de8a7e3831da7d9d871b2777d22fe90ff6）。
- 换基：git merge FETCH_HEAD（DU-08/SE-05 与 modules/overview 零交集，diff 实据为空，零冲突）→ 终 tip 2d23a79e8d3303e5cb25a991af50de6626112310，ls-remote 输出行核验 B=0。
- 换基后门禁：全量 vitest 541 文件 / 4162 过 | 1 跳 exit 0；模块 52/52；e1Contract 本树判读 SKIPPED-NOT-DEPLOYED（dist 残留已 rm）。
- task-lane：OM-15 与 OM-13 均 DELIVERED tip 2d23a79e8d…，写后复读核验（OM-13 行 branch/worktree 字段仍指旧死栈，报 L0 清理）。

## OM-11 采集时刻纪律·跨页 parity 腿补测（2026-11-24，基现脸 db793b7b10）

- 现状核验：sourceStamp/AsofLine(R41 取最新)/Freshness 与「never client clock」纪律已在现脸；缺口＝overview 侧无独立 as-of 测试件（metrics 侧有 asof.parity.test.ts）。
- 新增 overview.asof.test.tsx 6 例：①系统时钟拨前 24h 屏上时刻逐字不变（假时钟反证）；②R41 多源只挂最大分钟（12:24 胜 12:20/12:21）；③跨页 parity——sourceStamp(ready{asOf}).shown 与 metrics asOfText(iso) 字节相等，缺值双页同写「—」；④⑤⑥ready/loading/error 三态 ov6-asof 永不缺席，loading/error 值「采集时刻 —（北京时间）」且 title 给原因。
- DoD 实测：grep -n "new Date()" OverviewPage.tsx | grep -v setTimeout | wc -l = 0；模块 vitest 8 文件 58/58；vite build EXIT=0（dist 残留即 rm）。
- 步骤④ once-live 抽核（脸 9131，真 BFF）：屏 ASOF_LINE=「采集时刻 北京时间 2026-11-24 08:21 · 每卡来源见卡内标注」= 本批真响应 asOf 最大值 → OM11_PARITY_OK；证据 docs/_artifacts/OM-11-asof-parity/parity.json + om11-asof-1440.png。

## OM-17 视觉层对齐（设计基线 ov01-target.html，2026-11-24）

### ① 复刻台账：基线行号 ↔ 实现位置

| 基线（`docs/product/design/console-v2/ov01-target.html`） | 本树实现 |
| --- | --- |
| L797–816 `spark()`：X 均分 / Y (lo,hi) 映射 / 面积收底边 / 末点 r=2.4 | `VizChart.tsx` `sparkGeometry()` + `OverviewPage.tsx` `<SparkArea>`（`viewBox 0 0 118 46`、pad=3、闭合 `Z`） |
| L818–823 `dots()`：n=14、gap=w/(n+1)、cy=h/2、r=1.6 | `dotGeometry(14)` + `<NoTrendDots>`（含 `.ov5-sr`「无趋势源」） |
| L876–893 `buildTrend()`：pl/pr/pt/pb=34/12/24/22、slot=iw/n、bw=min(16,slot-6)、4 条网格线、每 4 格 + 末格轴标签、rx=2 | `trendGeometry()` + `<Trend>` 内联 `<svg>`（y 轴 4 档、`niceCeil` 定标、峰值虚线 + 圆点） |
| 基线 `#trendTip`（`role="status" aria-live="polite"`） | `<Trend>` 的 `.ov5-tip`，`data-testid="ov6-trend-tip"` |
| L893–905 `buildHeat()`：7 行 × 24 列、行＝周一…周日、色阶 6 档 | `heatMatrix()` + `<Heat>` 内联 `<svg>`：168 个 `rect.ov5-heat-cell`、`.ov5-heat-lv0..lv5`、aria-label 带合计 |
| 基线 `.kpi .kr` 值 + 118×46 火花/点阵槽位、`.dtl` delta、`.kn` 句 | `.ov5-kr` + `.ov5-kpi-viz`（375 档整行 34 高）、`.ov5-dtl`、`.ov5-kn` |
| 基线 `.fresh` 采集时刻行、`.phead .seg` 三档 | `AsofLine` → `.ov5-fresh` + `IconClock`；`.ov5-seg` 档位钮（沿用 duty 四档语义） |
| 基线 sprite `<use>` 页内微图标 | 页内 17 个内联 `<svg><path/></svg>` 基元（refresh/clock/arrow/alert/flat/trend-up/users/gauge/shield/pulse/coins/copy/check/inbox/activity/chart） |

复刻 7 块 + 图标基元 1 组；判据④实测 `grep -c '<svg' OverviewPage.tsx` = **22**。

### ② 替代件与理由（凡未照抄基线字面值的地方）

1. **配色**：预览是紫 accent `#8176F7` + 近黑 `#0A0A0C` 的另一套基础；本树在令牌冻结线后不得增名，故移植结构角色、映射到既有名：
   序列主色（`--chart-line/--spark-line/--spark-hi`）→ `var(--color-primary-ls)`；次级柱（`--chart-a/--spark-bar`）→ `color-mix(--color-text-ls 22~34%)`；网格/基线（`--chart-grid/spark-base`）→ `var(--color-border-subtle-ls)`；失败（`--chart-c/--danger`）→ `var(--color-danger-ls)`；空档（`--heat-0`）→ `var(--color-surface-raised-ls)`。
2. **圆角**：预览 16/10/8 → 本树阶梯 12/8/4（`--radius-ls-3/2/1`），热力格 3 → 4。
3. **字号**：预览 KPI 40 / h1 32 / micro 10.5 → 六档令牌 24 / 24 / 12；同时清掉本页原离阶字面量 9px、11px、`clamp(24px,3vw,34px)`（font-scale 棘轮只减不增）。
4. **悬停读数条**：基线 `.ctip` 跟随光标（运行时坐标 ⇒ 必然内联 style），本树禁内联 style ⇒ 钉子图右上角，内容随悬停列更新（`role="status"` 语义不变）。
5. **趋势 y 轴上限**：基线写死 15（当月实测），本树按真峰值 `niceCeil()` 定标（数据驱动，不写死）。
6. **柱内分段**：基线是「成功/运行中未知/失败」三色堆叠；本树上游桶只有 `runs/failed/succeeded`，缺 `succeeded` 时不硬拆「成功」段（避免造数），只把失败作为柱内子段——总柱高仍＝`runs`，失败不叠加柱顶。
7. **热力格尺寸**：28→26px（24 列 + 38px 行标签在卡宽内不溢出），内层 `min-width:520px` 保留基线式横滑。
8. **图标件**：lucide 换成内联 `<svg>` 基元（判据④要求源码装载视觉层；既有测试只断言文本/href/徽标，不依赖 lucide 结构）。

### ③ 诚实态边界（视觉层不得洗掉既有诚实线）

- 五张 KPI 只有「今日运行」有真时间序列（`data.stats14` 桶）；其余四张走点阵 + 「无趋势源」，**不画假曲线**。
- 趋势桶无读数：虚线框占位、`title` 明写「未返回」、不折 0；全缺 / 全真零仍走各自空态文案（原有断言逐字保留）。
- 热力缺格：`rect.is-void` 虚线框，不当 0；整块无读数 → 「{label}没有运行活跃读数，热力不画空格」，不画 168 个空格。
- 三处错误态保留 `ov5-inline-error` + 请求编号 + 重试（热力新增 `ov6-heat-retry`）；服务探针仍「未接」，不以本页读数冒充。
- 不注入客户端时钟：「今日」高亮/虚线框未做（见 ④）。

### ④ 未做项与需 L0 裁的口径

- 预览 16px 圆角与紫 accent **未追**：属基础件（令牌冻结线后增名须 L0 裁决）。
- 基线「本月成本与预算」块（30 格配额、of USD 20 占比、分员工条）未做：本页无月配额读数口径，硬画即造数。
- 基线「今日」虚线框 / 焦点行未做：需要客户端时钟，与采集时刻纪律冲突。
- **内联仍在 1 处**（明写，不算清偿）：`.ov5-bar-track i` 的 `style={{ height: N% }}`——既有形制、既有测试钉死 4%/100%，本次未新增任何内联 style（全仓双口径与基线持平）。

### ⑤ 门禁读数

- 模块：`node_modules/.bin/vitest run src/modules/overview` → 9 文件 / **64 passed（58 既有 + 6 新）**。
- 基元：`vitest run src/components/ui` → 8 文件 / 36 passed（font-scale 与 token-source、inline-style 棘轮全绿）。
- 全量：`vitest run` → 551 文件，**5 failed / 4265 passed**；红全在 `src/modules/audit`（`audit.time.window.parity.test.tsx` 等，与 overview 零 import、单独复跑同样红 ⇒ 本脸存量红，非本笔）。
- IA：`node scripts/assert-ia.mjs --source=react` → `ok=true`，counts routes 51 / tabs 22 / chatHosts 1 / modules 8（未动路由表）。
- `node scripts/lint-fake-success.mjs` → `ok: true`，violations `[]`。
- `grep -n 'style={' overview/*.tsx` → 全形制 1 处（＝字面量 1 处），即上记既有站点。

### ⑥ 行为变更申报（改了既有断言 2 条）

- `overview.window.test.tsx`：原断言「总览无热力卡 ⇒ 活动腿一次都不读」与「切窗无活动腿请求」随 OM-17 新增 7×24 热力卡而失效。改为：①7d 下活动腿读 1 次且 `weeks=1`；②14d→30d 切窗重读活动腿 1 次且 `weeks=4`（热力窗口随档位走），员工腿仍不重读。两处断言上方逐条注明「行为变更（OM-17 申报）」，未删任何其它断言。
- `LiveOverview` 的活动腿开关由 `{ activity: false }` 改为 `{ activity: true }`（写域仍在 overview，`useDutyData` 未改，DutyPage 默认档不受影响）。

## 门数学口径变更（round7，2026-11-24）— 可判定门取交集

### 改动前（旧口径）

- `buildReadiness` 只在「四门全部显式 pass」时才给主数字，且只要有一门 `unknown`
  就把 `confirmed` 置 null。V3 的 pass 需要「可引用文档 > 0 ∧ 强制引用策略可读」，
  而 BFF 从未接线强制引用策略读口（`duty/api.ts` 恒传 `policy.wired:false`）⇒
  V3 恒 `unknown` ⇒ 整张卡恒塌成 `— / — 可上岗`、四门四行全是 `— / —`、
  三段条只有理论值，读者看不到其它三门已经给出的真读数。

### 改动后（新口径）

- **门级读口登记**：`duty/readiness.ts` 新增 `GATE_READ_PORTS`，只有「门本身有读口」
  的门进交集：V1（工位单腿）、V2（有效配置投影）、V6（审批决策）为 `decidable:true`；
  **V3 为 `decidable:false`**（策略腿无读口）。无读口的门整门排除，不按员工排除。
- **交集**：`intersection(verdictSets, rows)` 只在可判定门上取交集。分母 = 「每道
  可判定门都给出 pass/fail 的员工数」，分子 = 这些员工里可判定门全 pass 的人数；
  某门未知/未回答的员工不进分母（不把未知当未通过）。一门都判不出来才返回 null。
- **主数字位** = `<可判定门全过人数> / <可判定门能给出判定的人数>`，旁注 11px 写
  `交集基于 3 门（V3 引用门无读口，未计入）`；四门表保留 V3 一行，值写「未接策略」，
  行尾注明「上游无强制引用策略读口；不影响其它三门交集」。其它三门行显示
  `<通过> / <本门能判定人数>`。
- **三分态**同样按可判定门归类：有可判定门显式 fail → 受限；可判定门全 pass →
  可上岗；其余 → 未知。三桶之和仍等于分母行数，三段条按真实计数画（未知段有值必画）。
- **为什么 V3 排除**：它的 pass 分支在现网不可达（策略读口不存在），把它留在分母
  等于要求一个永远无法满足的条件——不是保守，是把已可判定的三门读数一起埋掉。
  V3 仍如实显示 `unknown` 状态（黄点）并在折叠区给出原因，不假报通过。

### 受影响的断言（按新口径更新，理由已写在用例里）

- `duty/duty.readiness.test.ts`：`confirmed=null`（V3 unknown 链）→ 真 0 / 可判定 2；
  V3 计数为 fail 时不再阻断分子（用 count=0 的 fail 验证可判定三门全过 = 2）。
- `duty/duty.q10-parity.test.tsx`：净效果句不再要求「暂不给」，改为点名最窄门 +
  明写「引用门无读口，未计入」。
- 新增 `overview/overview.readiness.test.tsx`（6 例）钉住主数字/旁注/V3 行/三段条。
