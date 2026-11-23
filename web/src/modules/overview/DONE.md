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
