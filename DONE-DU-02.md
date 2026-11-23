# DONE-DU-02 值班台三卡固定槽位＋「查看全部 (N)」深链

工单：`docs/product/backlogs/approvals-duty.md` §DU-02（返工收口）。
工作目录 `/Users/kevin_studio/Projects/tasks/DU-02-kpi-slots`，分支 `task/DU-02-kpi-slots`。
**栈合基 = DU-01 tip `6152e45cfd`**（三分态主数字、分母披露、citations 探针腿都在那一笔里）。
**L0 合并顺序须 DU-01 → DU-02**：DU-02 的可上岗卡主数字/`denominatorNote` 直接复用 DU-01 的
`buildReadiness` 输出，先合 DU-02 会拿到没有三分态的旧 aggregate。

写域：`web/src/modules/duty/**` ＋ 本文件。`approvals/**` 零触碰（AP-07 车道在跑）；
`apps/console/server.py`、shell、routes、registry、scripts、package/lock 零改动；`evidence/` 不提交。

---

## 一、工单 DoD 逐条对账

| DoD 条款 | 状态 | 证据 |
|---|---|---|
| 三卡各恰 1 主数字／1 句／1 深链 | ✅ | 真浏览器读数（1440 与 375 两档一致）：`duty-ready 主数字=1 句=1 深链=1 明细残留=0`、`duty-today-runs 1/1/1/0`、`duty-today-cost 1/1/1/0`；钉测 `duty.slotCounts.test.tsx`「三卡槽位计数恒等于 1/1/1，正常态卡内零按钮」 |
| `查看全部 (N)` 的 N 与队列/折叠区真数一致 | ✅ | 卡上 `查看全部 (3)` ↔ 折叠区 `员工目录本轮返回 3 条`；`查看全部 (0)` ↔ `运行明细本轮返回 0 条`（响应 `items:[]`）；`查看全部 (0)` ↔ `当日账本本轮返回 0 行 · 服务端报缺 3 人金额`。N 与折叠区行数的同源钉测＝`duty.slotCounts.test.tsx` describe「DU-02①」4 例 |
| 无 0 占位 | ✅ | 现网两个 `(0)` 都是服务端真回空集（原文见 §二），不是缺数占位；缺数两路（形状漂移／读取失败）在测试里钉成 `查看全部 (数量未提供)`，且断言 `.not.toContain("(0)")`；成本 partial → 合计 `—`，断言 `.not.toContain("$0.00")` |
| 1440/375 截图归档 | ✅ | 绝对路径见 §四（375×812 一屏装不下三张竖排卡，另出 375×1600 把三卡全拍进框） |

工单四步：

1. **截断处补「查看全部 (N)」＋截断披露**：三卡深链文案改为 `viewAllText(N)`；N 只来自
   `dutySlots.serverRowsOf(响应体)`——数的是响应实际带回的集合（`items` 数组或裸数组），
   **既不是请求上限、也不是页码×条数、更不是卡上画了几行**。拿不到（读失败／形状漂移／
   上游没带这个键）一律 `null` → 屏上 `查看全部 (数量未提供)`，`truncationClause` 写
   `本轮返回条数未提供`。打满请求上限时披露 `（请求上限 3，非全量）`。
   `asArray` 会把漂移收成空数组（＝假 0 的入口），所以计数腿不复用它，单开 `serverRowsOf`。
2. **主数字旁一句状态＋一个深链**：今日运行卡原来是 4 格 KPI（`duty-kpis` ×4），现只留
   运行数一个主数字；成功率/在跑/失败三格整体搬进卡外 `duty-details-runs`（`信息不删`，
   算法逐字不变，仍由同一 `runTotals` 计算），并各留原 testid。每卡正常态卡内按钮数=0
   （主操作 ≤1），错误态的重试钮沿用既有「卡内唯一实心主操作」口径。
3. **缺数→「—」＋原因句；partial→null 链保持**：`buildCost` 一行未改；现网实测正是这条链
   （`missingEmployeeIds` 3 人 ⇒ `partial` ⇒ `dayUsd=null` ⇒ 屏上 `— 今日` ＋
   `账本还缺 3 人的金额，先不报合计`）。成功率在 `totals` 没带 `succeeded` 时给 `—`，不编百分数。
4. **卡高与数据行数解耦**：新增 `duty.slotCounts.test.tsx` describe「DU-02④」——同一页面在
   明细 1 行 vs 9 行两批数据下，三卡 DOM 结构签名（元素总数／槽位类计数／按行长出来的结构
   数）**逐字段相等**，且断言两批的折叠区行数确实分别是 1 与 8（判据不空转）；CSS 机制
   （`.duty-grid` stretch、`.duty-card` 成列、`.duty-card-foot` `margin-block-start:auto`、
   卡外三格一行）同文件钉住。真浏览器侧两条独立腿：闸条款 5 `高度=[189.94, 189.94, 189.94]
   最大差=0px`；取图腿点开/收起折叠区前后卡高 `[190,190,190] → [190,190,190]`。

---

## 二、N 的数据来源（真 BFF 8092，opsadmin 登录腿，2026-11-23 实测原文）

响应原文全部落 `evidence/probe-*.json`（不提交），关键片段逐字复制自磁盘文件：

* `/api/employees?limit=100` → **200**（`probe-employees.json`，714 B）
  顶层键只有 `items`，`items` 长度 **3**
  （`emp_217A…` draft / `emp_86A8…` active / `emp_0166…` active）
  ⇒ 可上岗卡 `查看全部 (3)`，折叠区 `员工目录本轮返回 3 条 · 检查项 4 项`。
* `/api/runs?since=2026-11-22T16%3A00%3A00.000Z&limit=3` → **200**（`probe-runs.json`，30 B）

  ```json
  {"items":[],"nextCursor":null}
  ```

  ⇒ 今日运行卡 `查看全部 (0)`（服务端真回空集，非占位），折叠区 `运行明细本轮返回 0 条`。
* `/api/budget-usage?employeeId=emp_217A…%2Cemp_86A8…%2Cemp_0166…&periodKind=day&period=2026-11-23`
  → **200**（`probe-budget-day.json`，202 B）

  ```json
  {"items": [], "missingEmployeeIds": ["emp_217A91BA995044DFBB3E2E940B", "emp_86A81CE8FF6F42E187BCF2B540", "emp_0166858D562149938FBDA22649"], "asOf": "2026-11-23T15:47:45Z", "asOfSource": "bff-read-time"}
  ```

  ⇒ 今日成本卡 `查看全部 (0)` ＋ `当日账本本轮返回 0 行 · 服务端报缺 3 人金额`；
  主数字走 partial→null→`—`，屏面 `账本还缺 3 人的金额，先不报合计`。
* `/api/workbench/summary?range=1d` → **200**（`probe-workbench-summary.json`）：
  `kpis[key=runs]` = `{"value":0,"available":true,"previous":21}` ⇒ 今日运行主数字 `0`
  是服务端真读数（`available:true`），不是缺数。
* `/api/employee-stats` → **200**（`probe-employee-stats.json`）：
  `{"total":3,"byLifecycle":{"draft":1,"onboarding":0,"active":2,"paused":0,"offboarding":0,"archived":0}}`
  ⇒ 分母 2（在册 `active`），卡上 `共 2 在册` 与 `目录已加载 3 条（单页上限 100 内）· 本轮逐员工判定覆盖 2/2`。

页面零桩：以上都是浏览器自己发出的请求（`evidence/du02-shoot.log` 有逐请求状态行，
`evidence/du02-proxy.log` 有代理转发行）。

---

## 三、门禁原始 stdout（全文见 `evidence/du02-*.log`）

**1) `cd web && node_modules/.bin/vitest run src/modules/duty`**（`du02-vitest-duty.log`）

```
 Test Files  12 passed (12)
      Tests  173 passed (173)
```

基线 11 文件 / 160 测试 ⇒ **只增不减**（＋1 文件 / ＋13 例，新增件 `duty.slotCounts.test.tsx`）。
点名件（`du02-vitest-named.log`，dutyPage.test.tsx ＋ duty.slotClause5.test.tsx ＋ 新件）：

```
 Test Files  3 passed (3)
      Tests  68 passed (68)
```

连带回归（`useDutyData`/`api.ts` 的消费面，写域外只读）：`vitest run src/modules/overview src/modules/runs`
→ `Test Files 19 passed (19) / Tests 234 passed (234)`。

**红→绿实证**（先把 `web/src/modules/duty/` 受管文件退回 HEAD、备份在
`/private/var/folders/…/opencode/du02-mine`，跑新件，再按 sha 校验还原）：改前
`Tests 1 failed…` 中 **11/13 例红**，失败原文摘录：

```
AssertionError: duty-ready 深链文案: expected '查看明细' to match /^查看全部 \((\d+|数量未提供)\)$/
AssertionError: 卡内不再摆 KPI 格: expected <div class="duty-kpis" …(1)>…(4)</div> to be null
AssertionError: expected '' to contain '员工目录本轮返回 2 条'
AssertionError: expected '查看明细' to be '查看全部 (数量未提供)' // Object.is equality
```

还原后 `shasum -c` 七个文件全 `OK`，复跑 12/173 绿。

**2) `node_modules/.bin/vite build`**（`du02-build.log`）

```
vite build exit=0
```

（禁 `pnpm run build`：该命令在本 symlink 检出里 `tsc -b` 段恒红，与 diff 无关。）

**3) `node scripts/lint-fake-success.mjs`**

```json
  "violations": [],
  "ok": true
```

**4) `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`**（`du02-tsc.log`）

```
tsc exit=2
全仓 error TS 总数=49
duty 命中=0
```

全仓 49 与基线 49 **delta=0**（apps/shared 预存错，非本车道项）；`modules/duty` 零错。

**5) UI 契约闸（本车道条款）** `node scripts/assert-ui-contract.mjs --url=http://127.0.0.1:9172 --token-file=… --stage=duty`（`du02-uigate.log`，自报行确认登录态成立后才取读数）

```
脸=http://127.0.0.1:9172 登录whoami=200 token注入=是 视口=1440x900 stage=duty
✔ PASS      card-slots-and-equal-height（条款 5） — 同排卡片数=3 高度=[189.94, 189.94, 189.94] 最大差=0px 卡内明细残留=0 缺查看明细=0
```

同轮 `GATE_EXIT=1`：条款 7（`筛选组=10 多行=6 … 实心主按钮=1`）与条款 10（`英文角色名=1（AGENT）`）
FAIL——属他道未收口项，如实单列，不判本车道，也不据此自签整闸绿。闸跑完代理即杀
（`nc -z 127.0.0.1 9172` → 已无监听；9122/8092 未动），含 token 的 jar 文件已删除。

---

## 四、截图（真渲染，非合成）

* `/Users/kevin_studio/Projects/tasks/DU-02-kpi-slots/evidence/du02-1440.png` — 1440×900，横向溢出 **0px**（scrollWidth 1440 / innerWidth 1440），三卡全显：`查看全部 (3)` / `查看全部 (0)` / `查看全部 (0)`。
* `/Users/kevin_studio/Projects/tasks/DU-02-kpi-slots/evidence/du02-375.png` — 375×812，横向溢出 **0px**，三卡自上而下排布（第三卡在框内底部裁切）。
* `/Users/kevin_studio/Projects/tasks/DU-02-kpi-slots/evidence/du02-375-cards.png` — 375×1600 补拍，三卡固定槽位全部在框内，横向溢出 **0px**。

取图形制：worktree `vite build` 产物 + 临时 `evidence/du02-proxy.mjs`（自选 loopback **9172**，
未碰 9122/9131/9141/9151/9161/9162）同源反代 `/agent-api→真 BFF 8092`、`/auth→真 9122`；
opsadmin 会话 cookie 登录腿；`goto` 用 `domcontentloaded` ＋ 显式 settle（2500ms＋1200ms），
不用 `networkidle`；每张图前断言 `/auth/whoami==200`（三档各一次，全 200）；视口图不用 `fullPage`；
取图前把内部滚动容器钉回顶部（壳层滚动不在 window 上，只 `window.scrollTo` 会截到半屏）。
逐请求与读数全文：`evidence/du02-shoot.log`。

---

## 五、改动清单（7 文件，全在写域内）

| 文件 | 改动 |
|---|---|
| `dutySlots.ts`（新） | N 的唯一口径：`serverRowsOf`／`viewAllText`／`truncationClause`／`detailsListNote`／`DUTY_LIST_CAP`（8 条封顶沿用 `duty-details-run-list` 既有口径，改为单一定源） |
| `api.ts` | `fetchEmployees`/`fetchRuns` 返回 `RowPage<T>`（行数组＋`ServerRowCount`）；新增 `DUTY_RUNS_PAGE_LIMIT=3`，请求上限与截断披露同源 |
| `useDutyData.ts` | 新增旁路返回值 `counts`（`DutyCounts`）；`rowsLeg`/`countOf` 把行页拆回卡用的形状；`DutyData` 字段与腿类型**一字未动** |
| `DutyPage.tsx` | 三卡固定槽位改造＋折叠区承接（三格 KPI、三处计数行） |
| `duty.css` | 新增 `.duty-details-kpis`（≥821px 三格一行） |
| `duty.slotCounts.test.tsx`（新） | DU-02①②③④ 行级钉测 13 例 |
| `dutyPage.test.tsx` | 「槽位」件里 `今日运行=四格 KPI` 的旧断言改为固定槽位＋三格出卡（判定强度不降，只增不减） |

---

## 六、偏差与如实上报

1. **`counts` 没有塞进 `DutyData`**：overview 模块（写域外）对 `DutyData` 做
   `Object.values(data).some(v => v.k === …)` 扫描，多一个非卡腿字段会污染它的失败/加载判定
   并触发跨道类型错。改为 `useDutyData` 的旁路返回值，`DutyData` 形状零变化。
2. **`CostCard` 仍向 `buildCost` 传 `totalEmployees=null`（既有形制，未改）**：因此「账本行数
   < 在册人数」这一类按人数的 partial 只在卡外折叠区报（`已覆盖 0 / 2 人`），卡上合计仍按
   已读行相加。工单说「partial→null 链保持」，本轮保持并验证了服务端自报
   `missingEmployeeIds` 这条真腿；要不要把人数差也算进卡上 partial，属口径变更，交总控裁定，
   我没有顺手改。
3. **卡上出现 `(0)` 两处**：均为服务端真回空集（§二原文），不是缺数占位。缺数两路
   （响应形状漂移、读取失败）屏上是 `查看全部 (数量未提供)`，由测试钉死。
4. **截断披露并进「一句状态」里**（用 `｜` 分隔），没有另起第四行——固定槽位仍是
   标题/主数字/句/深链四个，多一行就破坏「卡高与行数解耦」的判据形状。
5. **可上岗卡主数字仍是三分态**（`已确认 · 待核实 · 未达`）：那是 DU-01 用户直令的产物，
   槽位数仍为 1，本轮只换深链文案与折叠区计数行。
6. **375×812 装不下三张竖排卡**：DU-07 的 375 判据不受影响（溢出 0px），但为把「三卡固定槽位
   ＋查看全部 (N) 实态」拍全，另出 375×1600 补拍件。
7. **`fetchEmployees`/`fetchRuns` 返回形状变更**：模块内部函数，非跨模块契约；调用方只有
   `useDutyData`（已同步）。`web/src/modules/runs/runs.ts` 里只是注释提到 `fetchRuns`，未改。
8. 折叠区明细 8 条封顶沿用既有口径：当响应行数 > 8 时，卡上 N 报响应行数、折叠区同时写
   `这里列前 8 条`，两个数都出自同一响应，不互相推算（测试 `runs: 9` 一例钉住）。
