# DONE-DU-05 · 失败态与降级态（degraded 可见）— duty 侧交付

工单：板仓 `docs/product/backlogs/approvals-duty.md` §DU-05。
链：DU-01 → DU-02 → DU-03 → DU-04 → DU-05（本件；**L0 合并顺序须如此**，栈式链）。
车道：`task/DU-05-degraded-states`，基线 tip=`5d94dbea15`（=DU-04 tip）。

## 0. 结论一句话

页头 health chip 三态上线（ok／degraded 列「读取失败」腿名／未接入，词表严格不混用，
口径按主仓 `apps/console/server.py` `_overview_summary` 真形制只读核对）；单卡错误重试
改为**重发原请求**（一张请求喂两卡的队列腿不拆成两条）；`?state=` 四态强制在 duty 页
改为**查询串驱动真生效**（旧实现只匹配 `window.location.hash`，BrowserRouter 现网根本
进不了分支——本次修实），复现腿零真实请求；401 退避/4xx 计数类测量词全仓 grep=0。
**审批页侧按总控裁定拆 DU-05b**（AP-05f/AP-05b 车道同写面冲突禁止），本件零碰
`web/src/modules/approvals/**`。

## 1. 改了什么（写域自查：只动 `web/src/modules/duty/**` ＋本文件）

| 文件 | 改动 | 对应工单 |
|---|---|---|
| `health.ts` | **新增**：chip 纯推导——七族腿分组（员工目录/运行统计/成本账本/待审队列/运行明细/阻塞事项/就绪证据）；`读取失败`/`未接入`/`无权限` 三套词各归各清单；not_wired 不算失败不触发降级；全族无回答才升「未接入」顶层态 | ① |
| `types.ts` | `Loadable` 错误腿加可选 `notWired` 标记 | ① |
| `api.ts` | 新增 `isNotWiredError`（404/503+`not_wired`，与 `fetchKnowledgeProbe` 同口径）；`load()` 打标；`humanError` 把 403/404 二义并列句拆开：403=「你没有查看这块数据的权限。」、404=「这块数据的来源尚未接入。」（全仓无测试钉旧句） | ① |
| `useDutyData.ts` | 新增 `legRequests` 单腿原请求表（**首读与重试共用一张表**，重试=同 URL 同参数）；`retryLegs(keys)` 单卡重试只回写点名腿（队列腿整对重发一条请求；依赖目录的腿在目录未回答时如实退整批重读，不假装发过没发过的请求）；`forced` 参数：四态复现批不发任何真实请求、切窗不读服务；`asError` 透传 `notWired` | ②③ |
| `DutyPage.tsx` | 页头 `DutyHealthChip`（`data-state`+具名清单在 title）；`?state=` 改读 `useSearchParams`（hash 形制保留兼容、非法值回真读）；删三段硬编码早退分支，四态走**真卡树/StateLine**；新增 `denied` 态与 `DutyReproNote`（「复现腿不发起真实请求」上屏）；StateLine 错误标题分档：未接入/无权限/读取失败；单腿卡（趋势/活跃/待审/最近/今日运行/成本）接 `retryLegs`，多源复合卡（可上岗/阻塞）保留整批 `reload` | ①②③ |
| `duty.css` | `.duty-health-chip` 两条规则（含 pending 减档） | ① |
| `duty.degraded.test.tsx` | **新增** 16 条钉测（三态不混用×5、重试与请求号×4、四态强制×6、测量噪声×1） | 验收 |

**未改**：`web/src/modules/approvals/**` 零改动（`git diff --name-only | grep -c approvals` = 0）；
主仓 `apps/console/server.py` 只读核对零改动（`git status` 空，见 §2.1 行号校正）。

## 2. 口径与偏差（诚实面）

### 2.1 `_overview` 行号校正
板仓工单写「`server.py` `_overview`（L1955-2000）」；主检出实读为
**`_overview_summary`，行 1651-1758**（`GET /api/overview/summary`）。形制与工单描述
一致：逐源失败 `value:null`+`reason`（「上游取数失败」/「响应缺 totals.runs/costUsd
（形状漂移，不猜值）」/「nextCursor 分页超单页，不跨页求和」）、`healthStatus=ok|degraded`
（source 自述「bff fan-out probe（本请求三路上游结果）」，非独立健康端点）、三源全败
502 `console.upstream_unavailable`。chip 依同一设计：只汇总**本页批次自己读到的腿**，
不臆造第二真源（duty 前端不消费 overview/summary，实测它也不含 duty 卡面所需字段）。

### 2.2 ③ 的壳层拦截（跨道事实，非本道可修）
现网 `/overview?state=denied` 截图（`evidence/du05-state-denied.png`）显示的是
**A 车道路由壳的 StateBlock**（`shell/console.tsx` L361 `forced !== null ? <StateBlock/> : liveNode`
在 DutyPage 挂载前拦截，浏览器请求日志 `/agent-api/*` = 0 条）。即：壳装面下四态强制
由壳层呈现（该层文案「403 与 404 同一整页文案」属壳写域，本道零碰）；**duty 模块面**
的四态强制（真卡树、StateLine 形制、复现零请求、denied 具名）已实装并由 vitest 16 条
钉住——usage 页先例同形制（`UsagePage` 也是壳内 live 节点仍自带复现）。壳侧若把
`?state=` 下放给 live 节点，duty 侧即全链路生效，无需再改本模块。

### 2.3 请求号文案判定
工单括注「无则如实『请求号未提供』」。**假定**：沿用全站既有同形句
「本次请求未记录编号，可复制时间与操作路径反馈」（approvals/audit/tasks/metrics/shell
五处测试钉死此句，duty 单改会造同写面漂移）；有真值时画 `X-Console-Request-Id` 响应头
原值（现网实测该头存在，见 §3）。DU-05b 审批侧同此判定。

### 2.4 e2e 缺席记录（偏差）
工单验证列 `pnpm exec playwright test e2e/ia-smoke.spec.ts`：该 spec 文件存在于
`web/e2e/`，但其自述 RUNTIME STATE 即 **`@playwright/test` 非本 fork 依赖
（TOOL_MISSING）**，且无 `playwright.config.*`、BASE_URL 9119 为旧盘面。本道禁
`pnpm install`，故该腿**未跑**，以 `duty.degraded.test.tsx` 的四态断言（6 条）覆盖代替。
装依赖属总控裁定，不在本道擅动。

## 3. 现网取证（opsadmin 腿真回包，原始 JSON 存 `evidence/`，不提交）

- `GET /api/overview/summary` → **200**，`healthStatus.value="ok"`（现网真三态之一），
  逐源 `asOf` 齐；`X-Console-Request-Id: 2574b3c2…` 真头实测存在（`du05-probe-overview-summary.json`）。
- `GET /api/knowledge/citations` → **404** `{"code":"knowledge.not_wired","message":"本环境未接入知识库读口","asOf":…,"rid":"770ebc98"}`
  ——「未接入」形制自然出现（非制造），chip title 现网实画「未接入：知识检索」。
- `employees?limit=100` / `workbench/summary` → 200（`du05-probe-*.json`）。
- **degraded 单源失败形制现网未自然出现，未制造**（红线）；该态由测试面 stub 钉住
  （stub 仅限测试面），截图只取现网真态。
- 截图（build 产物经临时 du05-proxy 9201 反代 8092，`/auth` 走真 9122，每图前
  whoami==200，用完已杀代理；domcontentloaded+settle，无 networkidle）：
  - `evidence/du05-1440.png`：页头 chip 实态「健康 正常 · 本页读取腿已全部回答」，横向溢出 0px；
  - `evidence/du05-375.png`：375 档 chip 随标题行折行可读，溢出 0px；
  - `evidence/du05-state-denied.png`：`?state=denied` 现网实渲（壳层拦截，见 §2.2）。

## 4. 验证门（实跑 stdout 摘要）

- `node_modules/.bin/vitest run src/modules/duty`：**14 文件 / 198 测试全绿**
  （基线 13/182，只增不减；含点名 `dutyPage.test.tsx` 回归 + 新增 `duty.degraded.test.tsx` 16 条）。
- `node_modules/.bin/vite build`：**exit 0**（未用 pnpm run build）。
- `node scripts/lint-fake-success.mjs`：**violations=0**（`ok:true`；「未接入」在允许位 22 处）。
- `npx tsc --noEmit -p tsconfig.app.json`：**49 错=基线 49**（stash -u 实测基线，非引用台账数），
  **duty 命中 0**，delta 全表比对=仅本车道文件曾入、修后归零。
- e2e：见 §2.4 缺席偏差。

## 5. 遗留与下一件

- DU-05b（审批页侧 `?state=` 与 states.tsx 同形）待 AP 链并入后另开——总控裁定原文。
- 壳层 `?state=` 下放 live 节点与否属 A 车道；duty 模块面已就绪（§2.2）。
- DU-06（刷新节流）依赖本件：`retryLegs` 已带在飞腿去重与在批让路，最小间隔仍缺。
