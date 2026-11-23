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
趋势末柱贴容器右缘（右内边距偏小）、柱形无值标注（数值以原文面板为准）。

## 测试与构建

- `cd web && node_modules/.bin/vitest run src/modules/overview` → **10 passed / 10**
  （合同：forced 态零请求；只打两端口且 bucket=day；真 0 带来源原文；失败率同源 20%；
  summary 挂→各卡未接入+编号+重试；今日窗挂只影响运行卡；全挂整页错误声明不编造；
  采集时间行；日桶渲染；原文面板无 innerHTML）
- `cd web && node_modules/.bin/vite build` → 通过（产物 `<tree>/hermes_cli/web_dist`）。

## 已知边界（如实上报，非缺陷隐瞒）

1. `/overview` 路由现仍渲染旧 `modules/duty/DutyPage`：路由在 `App.tsx`（本单写域外），
   manifest 的 duty 标签被 App `live` 覆盖锁死。`OverviewModulePage` 已按合同交付，
   接线需一条 App 侧后续单（一行替换 import + live 项）。
2. 旧登记行 `task-lanes.json` Q11（session ses_df7932bf…）已被本 OM-01 车道取代，
   未擅自回改，请 L0 收口。
