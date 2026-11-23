# DONE-DU-08 · a11y 与文案收口（InfoHint 新规）

- 分支：`task/DU-08-infohint`；栈合基 `6a8cb80203f108147b1231f6cc81d27026374d66`（= DU-07 tip `b48b2cc4b7`（含线 face `3113707983`）merge AP-04 tip `30ffd33c58`）。
- 工单原文：`seakoi-agent-os-l0-board/docs/product/backlogs/approvals-duty.md` §DU-08（目标/现状证据/步骤①..⑤/DoD/验证/依赖）。
- 写域：`web/src/modules/duty/**`、`web/src/modules/approvals/**`（仅文案接线）、`web/src/components/ui/InfoHint.tsx`、`web/src/components/ui/glossary.ts`、`docs/product/design/COPY-INVENTORY-20261123.md`、本文件。`evidence/` 本地取证不提交。
- 红线遵守：`gates.ts` 的 `announcement()`／`DECISION_GATE`／`batch.ts` 门链**零改动**（本笔未出现在 diff 中；`batch.ts`／`writeGate.ts` 只有注释词面变化，见「纯注释证明」一条）。DU-02/DU-05/DU-07 的诚实条款与 375 判据未回退：`blockersLinkNote` 动态句与 title 同串、`查看全部 (N)` 真数、卡内零按钮槽位判据、`duty.ranges/details/notes/disclosure` 的 44px 选择器表，全部由既有件与新件共同钉住（门禁全绿）。

## 一、T3b 只读盘点先行（步骤①）

产物：`docs/product/design/COPY-INVENTORY-20261123.md`（三判台账：duty 16 条 D1–D16、approvals 10 条 A1–A10）。

| 判定 | 条数 | 说明 |
|---|---|---|
| 入 InfoHint（引 glossary key） | 8 | D1 D2 D3(合并入 duty.ready) D4 D5 D6 D7 A1 |
| 留内联（动态真数／行为承诺／键盘指引） | 12 | D8–D12 D15 D16 A2–A7 A9 A10 |
| 删词面留句子（工程措辞改形制/判据，句子不动） | 5 | D9 D13 D14 A8 + 汇总条同源承诺句 |
| 非屏上（源码注释、测试标题/注释） | 施工前基线生产文件命中 71（ts 44／tsx 20／css 7）；含测试件 165 | 本拍把**生产文件**全部扫成 0（见 §三 与偏差①）；测试件按 brief 口径排除，施工后含测试件 99 |

## 二、施工逐条（步骤②③④⑤）

**术语单源（②）**：`glossary.ts` 现有 9 条，本笔新增 4 条（`duty.denominator`／`duty.runsCaliber`／`duty.blockerFields`，加既有 `duty.ready`／`duty.cost`／`duty.notes`／`approvals.pending` 共 7 条被页面引用）。页面只引 key，弹层正文只来自 glossary（`InfoHint.test.tsx` ①③ 已钉，`duty.copy.infohint.test.tsx` 再加「页面不得复写定义」源码契约）。工单点名的三个样板术语：可上岗 `duty.ready`、成本 `duty.cost`、待处理 `approvals.pending` 全部接线。

**三卡取样句卡外收口（③）**：
- `DutyPage.tsx:406` 卡内 `（分母口径：…）` → `（分母：${denominatorNote}）`：动态真数（已加载 n 条／单页上限／逐员工覆盖 n/N／非全量）一条不减；定义移到折叠区 `hint-duty.denominator`（卡内不得摆按钮，`duty.slotCounts` 正常态零按钮）。
- `DutyPage.tsx` 折叠区「可上岗检查项」`h3` → `hint-duty.ready`；原 `duty-note`「各项检查独立判定，标『待核实』的项既不算通过也不算不通过」＝与 `duty.ready` 同义的第二套措辞，删句子、定义单源（同一句话现在全站只在弹层出现一次，`duty.copy.infohint` 用 DOM 计数钉住「只出现 1 次」）。
- `duty-runs-caliber` 行：`运行数口径：本卡` → `hint-duty.runsCaliber`＋`：本卡 N 次 · 读口 workbench/summary?range=1d · /metrics 读 /api/run-stats 当前窗 · 采集时刻 X｜对照句`——两条读口路径与采集时刻仍屏上直读（`dutyPage.test:750-763` 判据未放宽）。
- `账本口径` 行标题 → `hint-duty.cost`＋`只认账本实际金额`；`阻塞卡五字段：…` 图例句 → `hint-duty.blockerFields`（五个字段名仍在 `BlockerRow` 逐条上屏）。
- `duty-notes` 折叠钮名 `口径说明：每个区块读哪个口、算哪一段、缺值怎么显示` → 钮名只留清单本体「各区块读口 · 计算范围 · 缺值呈现」，解释句 = `hint-duty.notes`；钮与提示钮并排新 `.duty-notes-head`（`<button>` 不能嵌 `<button>`）。

**键盘序与 aria-expanded（④）**：
- 新件 `duty.copy.infohint.test.tsx`（13 例）＋ `approvals.copy.infohint.test.tsx`（10 例）钉：控制带 strip（`duty-range-*` aria-pressed 切窗同步）→ 卡内深链 → 折叠区的 DOM 序即 tab 序、无 `tabindex="-1"` 乱插；提示钮是真 `button`，focus 即 `aria-expanded=true` 且与弹层 `data-open` 同帧、`aria-describedby` 指向弹层 id、Esc 关闭并回焦。
- 折叠态同步实测：读口清单钮（`duty-notes-toggle` aria-expanded ↔ 正文在场）、卡外明细（`details.open`，沿用 DU-07④「禁宽度判据」）、趋势表格钮、逐时文字钮四把；approvals 侧筛选面板钮与 chips 行「同值 disclosure」共用一个 `filtersOpen`，Enter 收起时两处 aria-expanded 一起翻。
- `InfoHint.tsx` 两处形制改动（都在写域内，各自有理由）：
  1. 弹层 id 由 `useId()` 改为 `ui-hint-<term>` 派生。原因：`ApprovalsPendingModulePage.test.tsx:316` 的 AP-06 判据拿 403/404 两次渲染的 **innerHTML 逐字节相等** 证「同体不泄露存在性」，`useId` 的自增 id 会让两次渲染只差一个 id ⇒ 把我接的提示钮变成假红。代价：同一页同一 term 只准挂一次（已由两件新测试各钉一例）。
  2. `import "./ui.css"` 自带样式层。原因：取证腿实撞——ui.css 原来只由 `Table/StateBlock/Select/ui/index` 带进模块图，approvals 队列汇总条只 import InfoHint 时 `.ui-hint-pop{display:none}` 不在脸 css 里，定义文字以 inline 文本平铺上屏（正是新规禁止的形态）。修好后 `apv08-*` 图里弹层 `display=block`。

**工程语言与裸 id（⑤）**：审计结论＝已合规，本笔只清词面：门码 `V1…V6`／`E_NO_CITATION`／`GAP-01` 只在 `title`（`GateRow:295/305`、`HealthStrip:1325-1329`）；原始 `employee_id` 全值只在折叠明细（`duty-fleet-id-list`），卡面短码；approvals 侧 `denominatorReadout.reason`（`keys=[items,nextCursor]`）、`status=pending&limit=50 → 200/0`、未识别 URL 值、`changeKind/approvers.raw` 原值全部已在 `title`／详情披露；新测试按「屏上文本不含工程原值、title 侧仍在」双向钉。

## 三、DoD grep 原始输出

工单原文判据＝**可见文本**命中 0（glossary/InfoHint 除外）。brief 口径＝排除测试件与 glossary/InfoHint 定义文件后命中须 0。两条都贴（`git grep` 与目录 `grep --include` 两种取法均已跑，结论一致）：

```
$ grep -rnE "口径|说明[:：]|注[:：]" web/src/modules/duty web/src/modules/approvals --include="*.ts" --include="*.tsx" --include="*.css" | grep -vE "\.test\.(ts|tsx):"
（无输出）
命中数=0
$ git grep -nE "口径|说明[:：]|注[:：]" -- web/src/modules/duty web/src/modules/approvals | grep -vE "\.test\.(ts|tsx):" | wc -l
0
```

原文见 `evidence/du08-dod-grep.txt`。基线对照（施工前 `HEAD=6a8cb80203`，`git grep ... HEAD`）：生产文件命中 **71**（css 7／ts 44／tsx 20），含测试件共 **165**。施工后含测试件的全量原始 grep＝**99 行**（`evidence/du08-dod-grep-with-tests.txt`），逐条构成：既有测试标题与测试内注释的工程措辞（如「DU-02 计数口径单源」「分母护栏…口径句点名」）、本单两件新测试里的 `BLURB` 判据字面量本身（正则必须写出禁词才能钉住它），以及 `approvals.caliber.test.tsx:125` 断言的另一模块屏上句「本区按聚合口径读取，单页最多 20 条」——该文本源在 `web/src/modules/employee-detail/EmployeeDetailModulePage.tsx:1637`（**本车道写域外**，见偏差③）。生产文件已全部为 0：接线迁移（11 处屏上站点）＋纯注释词面清扫（71 条命中逐条替换，脚本 `evidence/du08-scrub.mjs`＋css 4 条同法，每条要求恰一次命中否则整体不落盘）。

纯注释证明（approvals 判定文件改动不落代码行）：

```
$ git diff -U0 -- web/src/modules/approvals/batch.ts web/src/modules/approvals/writeGate.ts web/src/modules/approvals/gates.ts \
    | grep -E "^[+-]" | grep -vE "^(\+\+\+|---)" | grep -vE "^[+-]\s*(\*|//|/\*)"
（空＝全部改动都在注释行；gates.ts 未出现在 diff 中）
```

## 四、门禁（原始 stdout，全文见 evidence/）

`evidence/du08-gate-duty-apv.txt`（终态源码，含 `InfoHint` 自带 ui.css 之后复跑）：

```
$ cd web && node_modules/.bin/vitest run src/modules/duty src/modules/approvals
 Test Files  111 passed (111)
      Tests  770 passed (770)
GATE_EXIT=0
```

开工基线（同一 worktree、施工前，`evidence/baseline-duty-apv.txt`）＝`Test Files 109 passed (109) / Tests 747 passed (747)`，与工单点名基线 duty 17件/227＋approvals 92件/520 逐字相等 ⇒ **109→111 件、747→770 测试，只增不减**（＋2 件＝本单两件，＋23 例＝duty 13＋approvals 10）。分腿实值：duty `18 files / 240 tests`（基线 17/227），approvals `93 files / 530 tests`（基线 92/520）。

```
$ node_modules/.bin/vitest run src/modules/duty/duty.copy.infohint.test.tsx src/modules/approvals/approvals.copy.infohint.test.tsx
 Test Files  2 passed (2)
      Tests  23 passed (23)
$ cd web && node_modules/.bin/vite build; echo BUILD_EXIT=$?
✓ built in 7.0s
BUILD_EXIT=0                       # 产物 hermes_cli/web_dist，entry assets/index-DaboawzZ.js
$ cd web && node scripts/lint-fake-success.mjs
  "violations": [],
  "ok": true
LINT_EXIT=0                        # allowedInfo：规划中 188／不会保存 1／未接入 22
$ cd web && npx tsc --noEmit -p tsconfig.app.json
TSC_EXIT=2
全仓 error TS 条数=49               # ＝基线
写域命中条数=0                      # duty|approvals|InfoHint|glossary 命名 0 条
```

## 五、e1Contract 环境红（非本单，禁改禁消解，原文照贴）

`evidence/du08-full-vitest.txt`（`cd web && node_modules/.bin/vitest run src`，FULL_EXIT=1，02:57 终态复跑）：

```
PORT=9122 DISK_ENTRY=assets/index-DaboawzZ.js SERVED_ENTRY=assets/index-Bnho7yZk.js (dist=/Users/kevin_studio/Projects/tasks/DU-08-infohint/hermes_cli/web_dist/index.html)
 FAIL  src/shell/e1Contract.test.ts > E1 取证自报: 端口 + entry 文件名（L0 硬规矩） > verifies the acceptance face when both sides exist, skips not-deployed otherwise
AssertionError: served entry drifted from the dist on disk: expected 'assets/index-Bnho7yZk.js' to be 'assets/index-DaboawzZ.js' // Object.is equality
 Test Files  1 failed | 531 passed (532)
      Tests  1 failed | 4044 passed (4045)
```

归因：9122 验收脸由 l7-ops 持有，本单期间它两次换脸（同一件先后读到 `index-Bu0X2shS`→`index-Bnho7yZk`），本车道 disk entry 为 `index-DaboawzZ`——**服务侧部署与本 worktree 构建产物的代次漂移，唯一红项，非本单缺陷**；本单未改该件、未加 skip、未放宽判据。
计数算术（可复核）：DU-07 面 529件/4009 例 → 栈合基内含 AP-04 重取基笔新增 `approvals.write.probe.test.tsx`（`git diff --name-status b48b2cc4b7 6a8cb80203 -- "web/src/**/*.test.*"` ⇒ A 一件，＋13 例）→ 本单＋2件/＋23 例 ⇒ **532件/4045 例**，逐字吻合。



## 六、截图腿（evidence/，不提交）

| 图 | 内容 | 实测读数 |
|---|---|---|
| `evidence/apv08-1440.png` | 审批待处理页 InfoHint 实态 | `hint-approvals.pending` 在场；键盘 focus 开层 `aria-expanded false→true`；弹层 `display=block` rect 280×80（宽在 240–320 契约内）；`aria-describedby` 指向弹层 id；触发器 18×18（桌面档）；屏上禁词 0 |
| `evidence/apv08-375.png` | 同上 375 档 | 弹层转底部抽屉 rect 375×60；触发器 **44×44**（ui.css ≤767.98px 触控档）；屏上禁词 0；whoami 紧贴 200 |
| `evidence/du08-1440.png` | 值班台面 `/overview` 现状记录 | **不是** InfoHint 实态：挂载探测 `ov6Page=true / dutyPage=false`，在场提示 `[]`，屏上禁词命中 1（`成本口径未齐`，节点 `ov6-kpi-cost`） |
| `evidence/du08-375.png` | 同上 375 档 | 读数同上 |

**duty 腿在现脸不可拍的原因（磁盘证据，非推测）**：`git log -1 --format="%h %ad %s" -S "OM-01 (总览挂载裁定" -- web/src/App.tsx` ⇒ `60dc76d87e 2026-11-23 21:11:24 +0800 OM-01(总览挂载裁定): #/overview duty tab 挂 modules/overview/OverviewPage，duty/DutyPage 不再挂载`；`web/src/shell/routes.ts:124` `"/duty": "/overview"` 显式别名；`web/src/App.tsx:1332` `/duty → <DutyRedirect />`。DU-07 与 DU-08 两个 worktree 的 `hermes_cli/web_dist` 里都 grep 不到 `duty-ready-denominator`／`duty-notes-toggle`（⇒ DutyPage 不在模块图内）。**DU-08 的 duty 腿（工单点名的 `modules/duty/DutyPage.tsx`）在源码面成立、在现脸面不可见**，我没有把接线「搬」到 `modules/overview/**`——那是写域外。归因脚本：`evidence/du08-face-attribution.mjs`；取证脚本：`evidence/du08-shoot.mjs`（build 产物＋临时反代 9351→真 BFF 8092、/auth/*→真 9122、opsadmin 登录腿、domcontentloaded＋settle≥2s、每图前 whoami==200；端口 9351 自选并登记，用完按 pid 11719 精确 kill，`lsof -iTCP:9351 -sTCP:LISTEN -t` 复验 0 监听；9122/9341/8092 全程未动）。

## 七、偏差与未做（如实）

1. **偏差·生产文件注释词面清扫**：为让 brief 的字面 grep（排除测试件）在生产文件上取 0，除文案接线外另改了 52 处**纯注释词面**（「口径」→「判据／形制／范围／词表／上限」等同义替换），语义不变；`gates.ts` 未碰，判定与门链逐条可验（§三 纯注释证明）。若 L0 认为不该动他人注释措辞，回退方式＝单文件 `git diff` 逐条还原，与本单接线无耦合。
2. **受阻·duty 腿现脸不可拍**（§六）：`du08-*` 两图只作面现状记录，不宣称 InfoHint 实态。要现脸成立需把 `duty.notes/duty.denominator/duty.cost/duty.runsCaliber/duty.blockerFields` 接线同步到 `modules/overview/OverviewPage.tsx`（OM 车道写域），或 L0 扩本车道写域。
3. **写域外仍存屏上禁词**：`modules/overview/OverviewPage.tsx:437/446`「风险口径未接入」「成本口径未齐」（现脸 `/overview` 实测屏上 1 处），以及 `modules/employee-detail/EmployeeDetailModulePage.tsx:1637`「本区按聚合口径读取…」（被 `approvals/` 目录里的测试件断言）。两处均不在 DU-08 写域，未动，登记给 L0 路由。
4. **未做**：DU-04 裁定项（渠道事件流 A/B）不受本单影响；审批历史页与 `states.tsx` 空态长文按台账 A3/A7 判「留内联」，未接线（不是遗漏，是有判据的处置）。
5. **未跑**：`e2e/ia-smoke.spec.ts`（playwright e2e）未跑——本单验证面＝工单点名的 vitest/grep/lint/tsc/build ＋ 取证腿；四态强制判据由 DU-05 既有件覆盖，未改其语义。

## 八、参谋 05:0x rebase 单（本拍处置与读数）

令：DU-08（4/40，B29 需先 rebase）→ rebase 至当拍 ls-remote face 现读 `5191a706cd19ab6561ea2e4970a683f9ccd439bd`。

```
$ git fetch origin && git ls-remote origin refs/heads/task/DU-08-infohint refs/heads/lane/hermes-console
5191a706cd19ab6561ea2e4970a683f9ccd439bd	refs/heads/lane/hermes-console
96e7ffa143d94a743563ebedd0c40914c12119fe	refs/heads/task/DU-08-infohint        # 参谋已收采纳的 SCOPE 说明件
$ git rebase --onto 5191a706cd 6a8cb80203 task/DU-08-infohint
Rebasing (1/4)Rebasing (2/4)Rebasing (3/4)Rebasing (4/4)Successfully rebased and updated refs/heads/task/DU-08-infohint
REBASE_EXIT=0                      # 四笔全部干净重放，零冲突，未触发「真冲突 abort」
$ git merge-base --is-ancestor 5191a706cd HEAD && echo FACE-ANCESTRY=OK
FACE-ANCESTRY=OK
$ git rev-parse HEAD HEAD~4
21d23282226f0d546bc38b8e17f06989d54af5c6      # 新 tip
5191a706cd19ab6561ea2e4970a683f9ccd439bd      # HEAD~4 ＝ face，逐字相等＝四笔平铺在新基上
```

写域文件在 face 侧 29 笔里**未被任何人改动**（`git diff --stat 6a8cb80203 5191a706cd -- web/src/modules/duty web/src/modules/approvals web/src/components/ui` 无输出），故 rebase 无冲突、我的接线逐字保留。换基内容等价性另以两条硬证：

```
$ git diff --stat 246aa4cec4 21d2328222 -- web/src/modules/duty web/src/modules/approvals \
    web/src/components/ui/InfoHint.tsx web/src/components/ui/glossary.ts \
    docs/product/design/COPY-INVENTORY-20261123.md DONE-DU-08.md
（空＝我的写域在首基 tip 与新 tip 之间逐字相同）
$ git diff 6a8cb80203 246aa4cec4 | git patch-id --stable
6c3665d67cc8040baf88d358603dfcf7e58b5241
$ git diff 5191a706cd 21d2328222 | git patch-id --stable
7dd23485d4ca6ab7d0769ca6315252c341cda95f      # 两 id 不等＝第二个区间多含 SCOPE 说明件一笔＋基线不同，非我的源码差
```

新基复跑（全部原始 stdout 落 `evidence/du08-rebase-*.txt`）：

```
$ grep -rnE "口径|说明[:：]|注[:：]" web/src/modules/duty web/src/modules/approvals --include="*.ts" --include="*.tsx" --include="*.css" | grep -vE "\.test\.(ts|tsx):" | wc -l
0
$ node_modules/.bin/vitest run src/modules/duty src/modules/approvals      # GATE_EXIT=0
 Test Files  111 passed (111)
      Tests  770 passed (770)                                              # ＝换基前逐字相等
$ node_modules/.bin/vitest run src                                          # FULL_EXIT=1
 Test Files  1 failed | 537 passed (538)
      Tests  1 failed | 4132 passed (4133)
 FAIL  src/shell/e1Contract.test.ts            # 唯一红，同 §五 归因
PORT=9122 DISK_ENTRY=assets/index-DaboawzZ.js SERVED_ENTRY=assets/index-CtA6doEj.js
$ node_modules/.bin/vite build                  # BUILD_EXIT=0，新基产物 entry assets/index-TJhQv37I.js
$ node scripts/lint-fake-success.mjs            # LINT_EXIT=0
  "violations": [] / "ok": true
$ npx tsc --noEmit -p tsconfig.app.json         # TSC_EXIT=2
全仓 error TS = 49（＝基线）；写域（duty|approvals|InfoHint|glossary）命名 = 0
```

全量文件/用例数从 532/4045 涨到 **538/4133**，是 face 29 笔自带的新增测试件（`employee-detail/SessionDrawer.test.tsx`、`employees.*` 四件、`org/OrgModulePage.test.tsx`、`people.*` 两件等），非本支所加——本支在两个基线上的定向计数都是同一组 111件/770例。e1Contract 那条仍属 9122 服务侧代次漂移（本单期间 face 又换脸：`Bu0X2shS → Bnho7yZk → CtA6doEj`），未改未消解。

### 三项裁定逐条处置

1. **并入放行由 L0/参谋按 rebase 后新值裁**：本拍只交新值——tip `21d2328222`、face `5191a706cd`、定向 111件/770例、全量与 build/lint/tsc 读数见 §九末与 §四/§五 复跑件（`evidence/du08-rebase-*.txt`）。我不自签并入。
2. **OM-01 接线归属（OM 旧栈已判废，OM-15 新基重放）**：本支**不依赖旧 OM 接线**——我的笔只动 `modules/duty/**`、`modules/approvals/**`、`ui/{InfoHint.tsx,glossary.ts}` 与两份文档，`git diff --name-only 5191a706cd HEAD` 里没有任何 `modules/overview/**`／`App.tsx`／`routes.ts` 文件。但换基后现读仍确认挂载事实未变：`5191a706cd:web/src/App.tsx:96-101`（#/overview duty tab 挂 OverviewPage，DutyPage 不再挂载）＋`5191a706cd:web/src/shell/routes.ts:124`（`"/duty": "/overview"`）。⇒ **点名回报**：并入后 duty 腿的 5 条 term 在现脸不可见（源码面与测试面成立），审批腿（`QueueSummaryBar` 的 `approvals.pending`）在现脸**已可服务**，故本支并入即把 `InfoHint` 从「主干零导入者」激活为**有真实挂载面的接线**（新基实测 `git grep -ln InfoHint 5191a706cd -- web/src` 只有 `InfoHint.tsx`／`InfoHint.test.tsx`／`glossary.ts`／`ui.css` 四件＝零页面导入者，与本支合并后导入者为 `DutyPage.tsx`＋`QueueSummaryBar.tsx`）。OM-15 重放若把 duty 面改回/改挂，只需在挂载面引同一批 key，不需我这支返工。
3. **写域外禁词残留（随 rebase 清掉或回报说明）**：选择**回报说明**，不动——`overview/**` 与 `employee-detail/**` 不在本拍令重述的写域内（写域=duty＋approvals 文案接线＋ui/{InfoHint,glossary}＋COPY-INVENTORY＋DONE），越界即废道。新基逐字现读：
   - `web/src/modules/overview/OverviewPage.tsx:437` `note={… ? '风险口径未接入' : null}`、`:446` `note={… ? '成本口径未齐' : null}`＝**屏上可见 2 处**（DU-08 取证腿曾在现脸 `/overview` 实测扫到其中 1 处，节点 `ov6-kpi-cost`）。
   - `web/src/modules/employee-detail/EmployeeDetailModulePage.tsx` 屏上可见 3 处：`:555`「口径=按负责人过滤（服务端执行）…」、`:1001`「成本为账本实扣金额；与 /metrics 的成本视图口径一致，与运行次数口径不同」、`:1657`「本区按聚合口径读取，单页最多 20 条…」；另有 title 侧 4 处（`:725/:999/:1645/:1655/:1667`）与注释 3 处（`:955/:994/:1746`）属工单步骤⑤允许形态／非屏上。
   - **耦合提醒**（交 L0 路由，本拍未动）：`web/src/modules/approvals/approvals.caliber.test.tsx:125` 与 `EmployeeDetailModulePage.test.tsx:1100` 逐字断言 `:1657` 那句——若 OM/ED 车道把该句收进 InfoHint，这两处测试件必须同步改，否则红在测试面。
   - 建议落法（与 duty 腿同形制，10 分钟量级）：`:437/:446` 改 `note="风险未接入"/"成本未齐"`＋旁挂 `<InfoHint term="metrics.cost">`（`approvals.pending`/新增 `overview.risk` 由 L0 定 key）；`:555/:1657` 收进 InfoHint 或改「按负责人过滤（服务端执行）」去词面；`:1001` 拆成读数句＋glossary key。

### 换基后取证腿（重跑，原始日志 `evidence/du08-rebase-shoot.log`）

新基 `vite build` 产物（entry `assets/index-TJhQv37I.js`）＋临时反代 **9351**→真 BFF **8092**、`/auth/*`→真 **9122**，opsadmin 登录腿，`domcontentloaded`＋settle，每图前 `whoami==200`：

```
[apv08-1440] 在场提示=["approvals.pending"] 挂载={"ov6Page":false,"dutyPage":false,"apr5":true} 屏上禁词=[]
             aria-expanded false→true 弹层={"display":"block","open":"true","describedByTarget":true,
             "rect":{"x":253,"y":239,"w":280,"h":80}} 触发器 18×18 console error 产品面=0
[apv08-375]  在场提示=["approvals.pending"] 屏上禁词=[] aria-expanded false→true
             弹层=底部抽屉 rect 375×60；触发器 44×44
[du08-1440]  在场提示=[] 挂载={"ov6Page":true,"dutyPage":false,"apr5":false} 屏上禁词=["口径"]（节点 ov6-kpi-cost）
[du08-375]   同上
```

四图已按新基重拍：`evidence/apv08-1440.png`／`apv08-375.png`＝审批侧 InfoHint 实态（换基后仍成立）；
`evidence/du08-1440.png`／`du08-375.png`＝`/overview` 面现状记录（duty 腿不可见，非 502／非下线，未 stub 冒充）。
取证端口 9351 用完按 pid 精确杀（`lsof -nP -iTCP:9351 -sTCP:LISTEN -t` ⇒ pid 27853 → 复验 0 监听）；
9122（41688）／9341（83751）／8092（740）全程未动。


## 九、交付（原始输出）

```
$ git add web/src/components/ui/InfoHint.tsx web/src/components/ui/glossary.ts web/src/modules/duty \
    web/src/modules/approvals docs/product/design/COPY-INVENTORY-20261123.md DONE-DU-08.md
$ git status --porcelain | grep -v "^??" | wc -l      # 只 add 写域＋两份文档，evidence/ 留在未跟踪
35
$ git diff --cached --stat | tail -1
 35 files changed, 971 insertions(+), 90 deletions(-)
$ git commit -m "feat(DU-08): 解释性文字收口 InfoHint＋glossary 单源，键盘序与 aria-expanded 钉测"
lefthook pre-commit → lint web ✔（pnpm exec eslint，0 errors／19 warnings 全部为既有 react-hooks 条，
本笔未新增任何 error；未用 --no-verify）
a596b7f045b49b4a579ee6fda3a86c72965da429
$ git push origin task/DU-08-infohint                 # 禁 force，普通 push；同批完成
 * [new branch]            task/DU-08-infohint -> task/DU-08-infohint
PUSH_EXIT=0
$ git ls-remote origin refs/heads/task/DU-08-infohint
a596b7f045b49b4a579ee6fda3a86c72965da429	refs/heads/task/DU-08-infohint
$ git rev-parse HEAD
a596b7f045b49b4a579ee6fda3a86c72965da429
```

定向 ref 回读行与 `rev-parse HEAD` 逐字相等（同 sha 二次复读亦相等），原文另存 `evidence/du08-ls-remote.txt`。
**注意本文件会落后最终 tip 至多一笔**（把上面这串原始输出写进 §八 的动作本身要占一笔），
因此**车道终 tip 以现读 `git ls-remote origin refs/heads/task/DU-08-infohint` 为唯一权威**，不以本文件里的 sha 为准。
已知两笔：`a596b7f045`（施工＋两件新测试＋COPY-INVENTORY＋DONE 初版）、`3aff3acd56`（docs：交付节补原始输出）。
门禁与取证读数以 `a596b7f045` 的树为测，其后的笔只动 markdown（不碰源码，不影响任何判据读数）。
栈合基关系：本笔落在 `task/DU-08-infohint`（父＝`6a8cb80203`），写完即交不等合并；AP-04 正被重取基属总控并窗动作，
L0 合并顺序 DU-01..07→DU-08 不变。
