# SCOPE-DU-08 范围说明单（L0 参谋令 @379@①：说明件到前不并）

## 1. 当拍实测（原始命令与输出摘要，2026-11-24 03:4x）

- live face（ls-remote 现读）：`689e8d46d1f87b35fa6e5035eacae0257ffe0b66` lane/hermes-console；本说明单提交前 face=25d5569c03d13e79c4285eac4210af18a4d27546。
- `git rev-list --count 25d5569c03..HEAD` = **4 笔**（a596b7f045 施工 + 3aff3acd56/246aa4cec4 docs + 6a8cb80203 栈合笔）。
- `git merge-tree --write-tree 25d5569c03 HEAD` → exit 0，**零冲突**，产出树 cb91bd39630be617d263d6aeaf4c639d38123562。
- `git diff --name-status 25d5569c03 cb91bd3963` = **35 文件**（= DU-08 并入现脸的真实变化面；全部在授权写域）。
- 对照：`git diff --name-status e8f7dcd232...HEAD` = 39 文件（多出的 DONE-AP-04.md/WriteGateChip.tsx/approvals.write.probe.test.tsx 等 = 栈合笔搭车面，git 自动选 merge-base b48b2cc4 所致；AP-04 内容已 IN-FACE，逐项 cat-file -e 验过，merge-tree 后不出现在 35 文件面）。
- **归因**：L0 口径「41 笔/183 文件」与现干任何测量都不符（vs 现脸=4/35；vs e8f7=4/39；vs 远古基线 5ddee38447=118/256）。该数应出自更早基线且把栈合链携带的 AP-04 波与 DU 链全量计入 DU-08 名下。按协议阈值（>10 笔或>50 文件），**DU-08 并入波实测未超阈**。

## 2. 35 文件逐类表

### A 类＝InfoHint 本体/工单交付物（6）
| 文件 | 形态 |
|---|---|
| web/src/components/ui/InfoHint.tsx | M：弹层 id 由 useId() 改 term 派生（保 403/404 逐字节同体判据）；自带 import "./ui.css"（取证腿实撞：只引 InfoHint 的页面定义文字会 inline 平铺上屏） |
| web/src/components/ui/glossary.ts | M：+3 术语 duty.denominator/duty.runsCaliber/duty.blockerFields；工单点名三条 duty.ready/duty.cost/approvals.pending 全部接线 |
| web/src/modules/duty/duty.copy.infohint.test.tsx | A：13 例 |
| web/src/modules/approvals/approvals.copy.infohint.test.tsx | A：10 例 |
| docs/product/design/COPY-INVENTORY-20261123.md | A：T3b 只读盘点台账（§DU-08 步骤①规定产物） |
| DONE-DU-08.md | A：交付单 |

### B 类＝duty 屏上文案接线（17）
DutyPage.tsx、aggregate.ts、api.ts、duty.css、dutyNotes.ts、dutySlots.ts、dutyStatusFilter.ts、format.ts、health.ts、readiness.ts、runsCaliber.ts、types.ts、useDutyData.ts、UsagePage.tsx、AgentFleetRail.tsx ＋既有测试断言同步 duty.slotCounts.test.tsx、dutyPage.test.tsx（断言字符串随站点迁移，判据未放宽）。
屏上句去禁词词面（如「比率分母口径：」→「比率分母：」），动态真数一条不减；DU-02/05/07 诚实条款与 375 几何判据不回退（自跑 duty 18/240 绿）。

### C 类＝approvals 仅文案接线（12）
ApprovalsPendingModulePage.tsx、QueueSummaryBar.tsx、RowDetailCopy.tsx、api.ts、approvals-density.css、batch.ts、copy.ts、correlationReturn.ts、decisionOutcome.ts、model.ts、views.tsx、writeGate.ts。
**gates.ts 不在 diff**；batch.ts/writeGate.ts 逐 changed 行验证=全注释行（`grep -v` 注释提取后为空）；判定与门链零改动，逐条证明附 DONE-DU-08.md。

### 注释词面清扫（分布于 B/C 内，非独立文件）
纯注释同义替换 ts/tsx 52 条＋css 4 条，每条要求恰一次命中才落盘，判定零改动——为满足 DoD「生产文件 grep -rnE "口径|说明[:：]|注[:：]" 命中 0」；含测试件全量 grep=99 行未消解（既有测试标题/断言字面量），已登记 evidence/du08-dod-grep-with-tests.txt。

## 3. DU-08a/b 备选拆分案（若 L0 仍要拆）
- **DU-08a**＝A 类＋B 类（UI 本体＋glossary＋duty 接线＋测试＋盘点＋DONE）。
- **DU-08b**＝C 类 12 文件（approvals 文案接线，纯注释+措辞，可独立回退，不碰 gates/DECISION_GATE）。
- 拆分成本提示：a596b7f045 单笔含 A+B+C；拆需重做提交切分并复跑两侧门禁，预计净增 ≈ 现 4 笔→7 笔，仍在阈内。**总控建议不拆**：35 文件全部在派令授权写域内，写域=工单本身范围，无「顺手改」越域（唯一写域外发现=OM-01 摘挂 DutyPage 与 overview/employee-detail 禁词残留，均已列 L0 裁定项而非本道改动）。

## 4. 门禁复跑原始数字（03:02 自跑，总控本机）
- `vitest run src/modules/duty src/modules/approvals`＝111 件/770 例全绿（基线 109/747 只增）。
- DoD grep（排测试件）复跑＝0 命中。
- `tsc --noEmit -p tsconfig.app.json`＝全仓 49 错=基线，写域 0 错。
- 全量 532/4045 唯一红=e1Contract（DISK=index-DaboawzZ≠SERVED=index-Bnho7yZk，9122 漂移环境红，单列未消解）。

## 5. 请 L0 裁
1) 说明件已到，DU-08@246aa4cec4（本单 push 后 tip 见 ls-remote 回执行）是否即入并队队列；
2) OM-01 接线同步（modules/overview/** OM 写域）与写域外禁词残留两件的归属。
