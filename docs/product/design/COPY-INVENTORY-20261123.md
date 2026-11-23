# COPY-INVENTORY · T3b 只读盘点（值班台 duty ＋ 审批 approvals）

> 工单：`docs/product/backlogs/approvals-duty.md` §DU-08 步骤①。
> 新规源：`docs/governance/READY-BACKLOG.md` L13 收口令（页面内解释性文字一律收口 `InfoHint`，
> 验收＝可见文本 `口径|说明[:：]|注[:：]` 命中 0（glossary/InfoHint 除外）＋同 key 文案一致）。
> 本拍先盘点后施工：本文件只做判例台账，不含未实施的改动承诺。
> 盘点基线：`task/DU-08-infohint` @ 栈合基 `6a8cb80203`（DU-07 tip `b48b2cc4b7` 含线 face `3113707983`，merge AP-04 tip `30ffd33c58`）。

## 一、方法（可复跑）

```
grep -rnE "口径|说明[:：]|注[:：]" web/src/modules/duty web/src/modules/approvals
grep -rnE "title=\"[^\"]*(实测|keys=|status=|unknown|ap_)" web/src/modules/approvals
grep -rn "aria-expanded" web/src/modules/duty web/src/modules/approvals
```

命中分三类：**屏上文本**（JSX 文本节点或渲染进 DOM 的字符串）／**hover·详情文本**（`title` 与「详情」
披露区，工单步骤⑤明确允许工程语言只进这里）／**非文本**（源码注释、测试标题与测试内注释）。
新规管的是第一类。第二、三类不在收口范围，本台账逐条登记，避免下一拍把它们当屏上文案删掉——
DU-01/DU-02/DU-05/DU-07 已交付的诚实条款与 375 判据里，有几条的判据就写在这些注释中。

## 二、三判定义

| 判定 | 含义 | 落点 |
|---|---|---|
| **留内联** | 是读数本身（动态数字、单位、时间窗、缺值承诺），不是「解释一个术语」；挪进弹层会让关键数字只活在悬停里，违反 DU-07③ 无 hover-only 判据 | 原位置不动 |
| **入 InfoHint** | 是给读者解释术语/口径/非显然后果的句子 | `ui/glossary.ts` 一条定义 ＋ 页面引 key，渲染走 `ui/InfoHint.tsx` |
| **删** | 与已有 glossary 条目同义的重复定义，或与同行标签重复的图例 | 单源化后屏上不再出现第二套措辞 |

## 三、duty 站点台账（`web/src/modules/duty/`）

| # | 位置 | 屏上原句 | 判定 | 依据 |
|---|---|---|---|---|
| D1 | `DutyPage.tsx:406`（可上岗卡状态句尾） | `（分母口径：${denominatorNote}）` | **入 InfoHint** | 标签句属术语解释；`denominatorNote` 的动态真数（已加载 n 条／覆盖 n/N／非全量）**留内联**。卡内不得摆按钮（`duty.slotCounts.test.tsx:254` 正常态零按钮），提示钮落卡外折叠区（D3） |
| D2 | `DutyPage.tsx:597-603`（今日运行明细） | `运行数口径：本卡 N 次 · 读口 workbench/summary?range=1d · /metrics 读 /api/run-stats 当前窗 · 采集时刻 X｜对照句` | **入 InfoHint**（标签）＋**留内联**（读口路径·真数·对照） | 工单步骤③点名的「三卡取样口径句」；`dutyPage.test.tsx:750-763` 钉住两条读口路径与采集时刻必须在屏上，不能整句收进弹层 |
| D3 | `DutyPage.tsx:527`（折叠区·可上岗检查项） | `各项检查独立判定，标「待核实」的项既不算通过也不算不通过。` | **删→并入 glossary 单源** | 与 `glossary.ts` `duty.ready` 现句同义，属第二套措辞；无测试钉此句 |
| D4 | `DutyPage.tsx:528-530`（`duty-denominator-caliber`） | `${denomNote}`（比率分母 n 人／上限／非全量） | **入 InfoHint**（标签）＋**留内联**（动态数） | `duty.q10-parity.test.tsx:225-230` 要求「本页 1 人」「未触单页上限」在屏上，句子留内联，解释走 `duty.denominator` |
| D5 | `DutyPage.tsx:621`（成本覆盖明细行标题） | `账本口径` | **入 InfoHint** | 行值「只认账本实际金额」留内联；定义单源走既有 key `duty.cost` |
| D6 | `DutyPage.tsx:1207`（阻塞卡） | `阻塞卡五字段：阻塞对象 · 卡在哪一步 · 等谁 · 已等时长 · 下一步动作` | **入 InfoHint** | 图例；五个字段名在每条 `BlockerRow`（`DutyPage.tsx:1128-1137`）已逐条上屏，图例本身是解释性文字（工单现状证据 L966） |
| D7 | `DutyPage.tsx:1351`（`duty-notes-toggle` 钮名） | `口径说明：每个区块读哪个口、算哪一段、缺值怎么显示` | **入 InfoHint** | 钮名改为清单事实名（读口·计算范围·缺值呈现）；解释句单源走既有 key `duty.notes`。`aria-expanded` 形制不动（`duty.375.criteria.test.tsx:220-230`） |
| D8 | `DutyPage.tsx:1367-1369`（清单页脚） | `展开与收起不发请求：这里写的都是各卡已经在用的读口，折叠块本身不取数。` | **留内联** | 是对本页行为的承诺（DU-05 不取数），不是术语解释；有测试从请求计数侧钉它 |
| D9 | `aggregate.ts:240-243` | `比率分母口径：本页 … 非全量。` | **删词面留句子** | 三分支动态句全部留内联（分母护栏是 DU-01④/10 条目5 的诚实条款），只把「口径」二字换成「比率分母：」 |
| D10 | `dutyNotes.ts:16-72`（DUTY_NOTES 8 行） | 各区块 读口 · 范围 · 缺值策略 | **留内联** | 清单本体＝工单步骤③说的「卡外折叠区」载体，不是解释句 |
| D11 | `DutyPage.tsx:596/625/949/1084/1259/1294` 等卡内 `duty-note` | `今日 00:00 起 · 北京时间`／`金额 USD · 缺行不按 0 计入`／`只统计待你处理的审批 · 到期窗口 24 小时`… | **留内联** | 时间窗、单位、缺值策略属读数范围事实；DU-02 槽位判据与 DU-07 375 判据都按 DOM 钉住这些节点 |
| D12 | `DutyPage.tsx:705/711/729`（舰队轨缺口句） | `舰队轨第③层未显示：花名册无能力标签列…`／`…全值编号暂无法给出（不是没有编号）。` | **留内联** | DU-07③ 判据：卡面 `—` 的原因必须有屏上等价出口，不许只活在 hover；`duty.fleetRail.test.tsx:430` 钉住 |
| D13 | `runsCaliber.ts:29-33`（`title` 串） | `…否则按口径不同处理，不为了对上而改任何一侧的取数。` | **hover 文本·改词面** | 属⑤允许的工程补充语，但词面含「口径」；换成「按两条读口不同处理」，可见屏上句（`compare`）不动 |
| D14 | `UsagePage.tsx:471` | `账本块这次没有回明细行；总额仍按上方口径呈现，缺失不写成 0.00。` | **删词面留句子** | 「上方口径」是工程指代，改「上方合计」；缺值承诺留内联 |
| D15 | `DutyPage.tsx:295/305/1325-1329`（`title` 里的 `V1…V6`、`E_NO_CITATION`、`GAP-01`） | 门码／缺引用码／缺口编号 | **留 title** | 工单步骤⑤：工程语言与裸 id 只进 `title` 或详情披露；`duty.channelVerdict` 与 `GateRow` 已按此形制交付 |
| D16 | `DutyPage.tsx:717-726`（折叠区 `duty-fleet-id-list`） | 原始 `employee_id` 全值 | **留详情披露** | 卡面只出短码（DU-03 裁定），全值在折叠明细，与卡面 `title` 同串 |

## 四、approvals 站点台账（`web/src/modules/approvals/`）

| # | 位置 | 屏上原句 | 判定 | 依据 |
|---|---|---|---|---|
| A1 | `QueueSummaryBar.tsx:142` | `汇总（与列表同一请求，按已加载行计）：` | **入 InfoHint** | 「待处理」术语单源（`glossary.ts` `approvals.pending`）；提示钮挂在标签右侧，括号里的同源承诺留内联 |
| A2 | `ApprovalsPendingModulePage.tsx:769-771`（`apv-status-note`） | `status 是唯一在服务端生效的筛选…；待办视图只列待办…` | **留内联** | 服务端/本地作用域边界是 DU/AP-07 的可见承诺，`approvals.scope.server.test.tsx:158` 与 `approvals.filterurl.test.tsx:232` 钉住；`title` 里的 `status=pending&limit=50 → 200/0` 属⑤允许 |
| A3 | `QueueSortBar.tsx:38/45/54`（`QueueMetaNotes` 三行） | `动作可用性矩阵：…`／`键盘：↑/↓ 行间移焦…`／`仅在当前已加载 n 条内排序…` | **留内联** | 键盘操作指引必须屏上可见（PRD §8.3 键盘可达 ＋ DU-07③ 无 hover-only）；testid 与文案由 P1-A1 契约钉住「逐字不变」 |
| A4 | `RiskQuickFilter.tsx:820-822`／`SinceQuickFilter`／`ActorBuckets` scope notes | `按当前已加载 n 条统计，不是全量；风险档切换不发新请求。` | **留内联** | 动态真数＋不发请求承诺；`approvals.scope.server.test.tsx` 逐件钉 |
| A5 | `QueueSummaryBar.tsx:56/65/73/81`（`denominatorReadout.reason`） | `读口顶层没有 total 键（实测 keys=[items,nextCursor]）…故不推算、不报总数。` | **留 title** | 工程语言（键名、契约腿）只在 hover；屏上只出 `已加载 n 条（非全量）`（`approvals.denominator.honesty.test.tsx:101` 逐字钉），符合⑤ |
| A6 | `views.tsx:1025/1109-1110`、`FilterSummary.tsx:196-199` | 原值披露（`changeKind` 原值、`approvers.raw`、未识别的 URL 值） | **留 title／详情披露** | 已是⑤要求的形制，本拍不动判定 |
| A7 | `states.tsx:191-243` 空态长文（标题＞一句说明＞主操作＞次级出口） | 空态原因句与下一步 | **留内联** | PRD §4 空态列逐行冻结；`approvals.empty.*` 件族按 DOM 钉 |
| A8 | `RowDetailCopy.tsx:62`、`views.tsx:662`（描述串） | `…缺值句与屏上同口径…`／`…文本与屏上链路同序同口径。` | **hover 文本·改词面** | 描述串面向读者的「同口径」措辞改「同形制」，语义不变 |
| A9 | `gates.ts` `announcement()`／`DECISION_GATE`／`batch.ts` 门链 | 播报句与写门原因句 | **不动** | 写域红线：判定逻辑零改动，R86 同状态不重播形制保持；本拍只验证其 `aria-live` 与 `aria-expanded` 行为 |
| A10 | 审批详情/历史页其余 `duty`-侧同类「采集时刻注」（`ApprovalsHistoryModulePage.tsx:351` 等） | 页签指向句 | **留内联** | 跨页导航指引，收进弹层会让人找不到出口 |

## 五、非屏上命中（盘点时的原始构成，以及本拍处置）

- 施工前生产文件字面命中 71 行（ts 44／tsx 20／css 7），其中源码注释（`//`／`*`／JSX `{/* */}`）为主体——多为 DU-01/02/05/07 与
  AP-01/02/05/07 约束的 WHY 注记（例：`api.ts:96` 403/404 归类、`aggregate.ts:235` 分母护栏）。
- 施工前含测试件全量＝165 行；施工后含测试件＝99 行（全部在测试件内：既有测试标题/注释、本单两件新测试的 `BLURB` 判据字面量、以及 §三 记的跨模块断言句）。
- **本拍处置**：生产文件全部扫到字面 0——12 处屏上／hover 文本站点接线迁移 ＋ 其余**纯注释词面**同义替换（ts/tsx 脚本 52 条＋css 4 条）
  （「口径」→判据／形制／范围／词表／上限，语义与约束记录不变，脚本 `evidence/du08-scrub.mjs`
  逐条要求恰一次命中，未命中即整体不落盘）；`gates.ts` 与门链、判定分支零改动（DONE §三 附纯注释证明）。
  测试件按 brief 口径排除，未刷标题措辞，但迁移站点的**断言字符串**已随屏上文本同步更新
  （`duty.slotCounts:276`、`dutyPage.test:163`），并在原位写明理由——形制迁移，判据不放宽。
- **达成方式**：`duty.copy.infohint.test.tsx`＋`approvals.copy.infohint.test.tsx` 两件源码契约
  （剥注释后断言禁词命中 0，命中行原样进失败信息）＋渲染态 DOM 扫描（摘掉 InfoHint 弹层后
  屏上文本禁词 0、同一 glossary 定义全站只出现一次），不再依赖人工 grep。
- **写域外仍在的屏上禁词**（登记给 L0，本车道未动）：`modules/overview/OverviewPage.tsx:437/446`
  「风险口径未接入」「成本口径未齐」（现脸 `/overview` 实测屏上命中 1 处）、
  `modules/employee-detail/EmployeeDetailModulePage.tsx:1637`「本区按聚合口径读取…」。
