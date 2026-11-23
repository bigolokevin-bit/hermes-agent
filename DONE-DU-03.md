# DONE-DU-03 · AgentFleetRail 舰队轨真字段

- 分支：`task/DU-03-fleet-rail`，栈合基 = DU-02 tip `c7cb3fc2`（L0 合并顺序 DU-01→DU-02→DU-03）。
- 写域：仅 `web/src/modules/duty/**` ＋ 本文件。`evidence/` 不提交。审批写开关未碰，`DECISION_GATE` 一行未动。
- 纪律：全程只读现网 BFF（8092 经 /agent-api，经临时同源代理 9183，用完已杀，`lsof` 读数 0）；无 mock 数据进产品代码；测试形制照既有 duty.* 件 mock `@/lib/api`。

## 一、花名册端点真响应字段清单（原文）

`GET /api/employees?limit=100`（经 9183→8092，HTTP 200，`evidence/du03-probe-employees_limit_100.json`）：

```json
{"items":[{"employeeId":"emp_217A91BA995044DFBB3E2E940B","name":"QA2 契约验证 1794894768","title":"QA2 契约验证（dev 库，可清理）","lifecycleState":"draft","ownerUserId":"1","updatedAt":"2026-11-17T05:52:48.030Z","department":null},{"employeeId":"emp_86A81CE8FF6F42E187BCF2B540","name":"AgentOS 产品助理","title":"产品助理（数字员工 · Pilot）","lifecycleState":"active","ownerUserId":"1","updatedAt":"2026-11-21T18:39:20.010Z","department":"产品部"},{"employeeId":"emp_0166858D562149938FBDA22649","name":"AgentOS 产品助理","title":"产品助理（数字员工 · Pilot）","lifecycleState":"active","ownerUserId":null,"updatedAt":"2026-11-13T06:02:53.031Z","department":null}]}
```

键并集（3/3 条）：`department, employeeId, lifecycleState, name, ownerUserId, title, updatedAt`。
能力标签类字段检查：`capability/capabilities/tags/skills` = 全部不存在；逐人日聚合类 `todayHandled/today_count/successRate/success_rate` = 全部不存在。

`GET /api/matrix?limit=100`（HTTP 200，`evidence/du03-probe-matrix_limit_100.json`）：items 含
`employeeId,name,title,lifecycleState,currentVersionId,effectiveFrom,skillRefs,skillCount,budget{…}`——
有 `skillRefs/skillCount`（技能引用，非「能力标签」定型列），**无 department 列**。

## 二、判定（含工单前提修正——偏差如实）

**⚠ 工单前提有一处过时**：工单写「部门/能力标签腿：花名册端点无字段」。现网实测 `department` **在**
`/api/employees` 响应里（键存在，3 条中 1 条有值「产品部」、2 条 null）。因此折叠区说明行没有采用
工单原句「舰队轨第③层无数据源（待 /api/matrix 扩列）」——该句对 department 腿在屏上即为假话，
撞诚实红线。改为与真响应一致的口径：

> 舰队轨第③层未显示：花名册无能力标签列，部门多为空值（待 /api/matrix 扩列）

「第③层保持省略、禁空壳」的裁定不变（能力标签确无列；部门覆盖 1/3 且 matrix 无该列，接线属
板/L0 决策，不在本道擅改）。若总控坚持原句措辞，回退只需改 `DutyPage.tsx` 一行文本。

- **① 部门/能力标签腿**：第③层整层省略（卡面 DOM 只有 l1+l2 两层容器，无任何占位空壳，测试钉死）；
  缺口说明行落卡外折叠区（`duty-details-fleet` / `duty-fleet-l3-note`）。
- **② 今日处理/成功率**：无逐人日聚合来源（上方字段清单为证）⇒ 破折号且不画进度条，未知态
  `[role=progressbar]` 数量=0（组件级＋页面级双钉）；Q21 未碰，来源就绪后再接。
- **③ 键盘可达**：轨道 `tabIndex=0` 可 Tab 进入（浏览器实拍 Tab 落点 `fleetVp=true`）、←→ 步进换卡、
  hover/focus/drag 暂停时钟（既有 ref 形制保持）；**补 focus 可见样式**：
  `.duty-fleet-viewport:focus-visible` 描边与前后箭头同值（`--color-primary` 2px），CSS 源码契约钉测。
- **④ prefers-reduced-motion**：时钟挂起（12s 零自动位移）且可手滚（键盘 ←→ 与箭头钮不受减动限制，
  新用例「④减动偏好：时钟挂起 12 秒不自动走，但键盘 ←→ 与箭头钮仍可逐个换卡」）。
- **fmtId 短码腿**：`duty.externalId.test.ts` 5 钉全绿（oc_/ou_ 后6位短码、内部 id 形制不动）；
  舰队轨屏上无裸 `employee_id`（组件级＋页面级 `not.toMatch(/emp_[0-9A-Za-z]{6,}/)`），全值只进
  卡 `title`（页面级断言 title 含 `emp_st_0000123456789`）。READY-BACKLOG L52 已闭项保持。

## 三、改动文件（写域内）

| 文件 | 改动 |
|---|---|
| `web/src/modules/duty/DutyPage.tsx` | 折叠区新增 `duty-details-fleet` 块＋第③层缺口说明行（DU-03①） |
| `web/src/modules/duty/duty.css` | 新增 `.duty-fleet-viewport:focus-visible` 可见描边（DU-03③） |
| `web/src/modules/duty/AgentFleetRail.tsx` | 头注记改为与真响应一致的缺口口径（代码行为不变） |
| `web/src/modules/duty/duty.fleetRail.test.tsx` | 新增 4 钉：①禁空壳／③Tab 进入＋focus 可见 CSS 契约／④减动可手滚／页面级折叠区说明行＋零进度条＋零裸 id（mock `@/lib/api`，形制照 duty.slotClause5） |

## 四、验证门原始 stdout

### 1. `cd web && node_modules/.bin/vitest run src/modules/duty`（全文 `evidence/du03-gate-vitest.log`）

```
 ✓ src/modules/duty/duty.fleetRail.test.tsx > DU-03 增量：①禁空壳 / ③键盘可见落点 / ④减动可手滚 > ①第③层禁空壳：卡内只有 ①② 两层容器，部门/能力标签的占位元素一个都不存在 5ms
 ✓ src/modules/duty/duty.fleetRail.test.tsx > DU-03 增量：①禁空壳 / ③键盘可见落点 / ④减动可手滚 > ③轨道可 Tab 进入（tabIndex=0＋中文组名），focus 有可见描边（CSS 源码契约，dutyPage.test 同形制） 2ms
 ✓ src/modules/duty/duty.fleetRail.test.tsx > DU-03 增量：①禁空壳 / ③键盘可见落点 / ④减动可手滚 > ④减动偏好：时钟挂起 12 秒不自动走，但键盘 ←→ 与箭头钮仍可逐个换卡 6ms
 ✓ src/modules/duty/duty.fleetRail.test.tsx > DU-03 页面级：折叠区承接第③层缺口说明（mock @/lib/api，形制照 duty.slotClause5） > 折叠区有第③层缺口说明（与真响应口径一致：无能力标签列、部门多空值、待 /api/matrix 扩列），轨实渲且页面零进度条、零裸 id 41ms

 Test Files  12 passed (12)
      Tests  177 passed (177)
   Duration  2.13s (transform 3.15s, setup 0ms, import 7.26s, tests 1.88s, environment 3.06s)
```

基线=DU-02 后 12 文件/173 测试 → 现 12 文件/**177** 测试，只增不减；点名件
`duty.fleetRail.test.tsx`（15 用例）、`duty.externalId.test.ts`（5 用例）全绿。
新增四断言族：progressbar=0（既有 I4 钉＋页面级再钉）、键盘步进换卡（既有「视口聚焦后 ←→
各走一张并钳位」＋④减动下手滚换卡新钉）、无裸 id（既有＋页面级新钉）、第③层省略＋说明行（全新）。

### 2. `node_modules/.bin/vite build`（禁 pnpm run build；全文 `evidence/du03-gate-build.log`）

```
vite v8.3.4 building client environment for production...
transforming...
✓ 3635 modules transformed.
（末尾）✓ built in …
EXIT=0
```

### 3. `node scripts/lint-fake-success.mjs`（全文 `evidence/du03-gate-lint.log`）

```json
{
  "script": "lint-fake-success",
  "file": "docs/console-v4-skeleton.html",
  "linesScanned": 9252,
  "allowedInfo": { "规划中": 188, "不会保存": 1, "未接入": 22 },
  "violations": [],
  "ok": true
}
```

violations=0。

### 4. `npx tsc --noEmit -p tsconfig.app.json`（全文 `evidence/du03-gate-tsc.log`）

```
TSC_EXIT=2 TOTAL_ERRS=49 DUTY_ERRS=0
```

全仓 49 错 = 基线（apps/shared 预存：file-url.test 13、color.test 10 等），
`src/modules/duty` **0 错**，delta=0。

## 五、浏览器取证（真渲染，非合成）

前置门：每图前 `/auth/whoami`==200（`{"user_id":1,"granted":true,"display":"opsadmin"}`，
`evidence/du03-whoami.json`）；`domcontentloaded`＋settle≥2s＋显式等 `[data-testid="duty-fleet-rail"]`
（禁 networkidle）；页面源＝本 worktree vite build 产物经临时代理 9183（避开 9122/9131/9141/9151/
9161/9162/9172），`/agent-api`→真 8092；浏览器实发请求逐条 200（仅 `knowledge/citations` 404，
属 DU-01 已裁「未接」腿，非本道引入）。

- `/Users/kevin_studio/Projects/tasks/DU-03-fleet-rail/evidence/du03-1440.png` — 舰队轨 3 张真卡，
  今日处理「— 次」、成功率「— %」，**progressbar数=0**，横向溢出=0px。
- `/Users/kevin_studio/Projects/tasks/DU-03-fleet-rail/evidence/du03-375.png` — 窄屏轨内横滚＋
  「暂停轮播」钮实渲，progressbar=0，**页面横向溢出=0px**。
- `/Users/kevin_studio/Projects/tasks/DU-03-fleet-rail/evidence/du03-focus-1440.png` — 键盘焦点态：
  连按 Tab 实测落点 `{"tag":"DIV","fleetVp":true}`，轨道 2px 主色描边肉眼可见。
- `/Users/kevin_studio/Projects/tasks/DU-03-fleet-rail/evidence/du03-focus-step-1440.png` — 焦点态按
  ArrowRight 后截图。偏差注记：现网花名册仅 3 人，1440 档轨不溢出 ⇒ 步进钳位为视觉 no-op
  （max=0），步进换卡行为以 jsdom 钉测为准（9 卡溢出场景断言 268→536）。

## 六、栈合与合并顺序

本道基线为 DU-02 tip `c7cb3fc2`（其上是 DU-01 `6152e45cfd`），L0 合并顺序 **DU-01 → DU-02 → DU-03**。
本道改动全部落在 DU-02 已收口的版面之上：折叠区新增块接在 `duty-details-recent` 之后（不动既有
块与计数腿），CSS 只追加 focus-visible 规则，测试只在 `duty.fleetRail.test.tsx` 尾部追加 describe。
与 DU-01/DU-02 无文件冲突面（其写域件 `readiness.ts`/`aggregate.ts`/三卡槽位未触碰）。

## 七、偏差与未做（如实）

1. **工单前提修正**：`department` 在花名册响应里存在且 1/3 有值 ⇒ 折叠区说明句未用工单原句
   「无数据源」（屏上假话），改实测口径；省略裁定不变。见 §二。
2. `/api/matrix` 现带 `skillRefs/skillCount` 但无 department 列；舰队轨第③层是否改用 matrix 腿
   接线属板裁定，本道未接、未画。
3. 逐人日聚合（今日处理/成功率真值）依赖 Q21，未碰。
4. `du03-focus-step-1440.png` 与 `du03-focus-1440.png` 视觉相同（3 人档钳位 no-op，见 §五注记）。
5. evidence/ 目录（探针 JSON、截图、脚本、日志）按令不提交。
