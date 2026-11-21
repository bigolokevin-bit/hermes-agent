# UX r5 复审 closeout — history 销项 / 知识第四改 / runs 375 字段名（基线 d2cc49fe，2026-11-22 17:0x–18:0x UTC）

评审人：常驻 UX 总审（本车道只审不改）。派单：L0 r5 复审令，三件销项，60 分钟盒。
证据目录：docs/_artifacts/ux/r5/（ux-capture-r5.mjs / ux-capture-r5.out / ux-capture-r5.summary.json / shots/）。

## 0. 环境与基线
- lane/UX-total 已 `git merge --ff-only d2cc49fe`（wave-131），merge-base 正向核验：d2cc49fe 包含 r4 交付 b159aa2d。
- 现网 entry=assets/index-BuZxlyEv.js，首尾两次读数一致，全程无换代。
- authstate opsadmin 有效（剩余 ≈5h）；口径 401=登录态、404=未接线不变。

## 1. 决定性发现：现网 build 不含 ②③ 两改（部署闸失守）
- 本地基线 d2cc49fe 含 3e01e190（知识第四改）与 a95ab6cf（runs 375 字段名）。
- 现网 chunk grep（curl 直取 BuZxlyEv 引用件）：
  - KnowledgeModulePage-Bn86F6NU.js：`空间台账/接入对象/接入健康/检索命中/读取记录/knw5-surface-title/knw5-req-toggle/request-id-raw` **全部 0 命中**（knM-source-note=1 为第三改旧物）→ 3e01e190 未部署。
  - RunsModulePage-BmeS-Y31.js：`sm:hidden` 0 命中、labelTestId 0 命中；375 DOM 探针 ui-c-field-label labelCount=0 → a95ab6cf 未部署。
  - ApprovalsPendingModulePage-CronmL6z.js：footer「已到末页 · 已显示」在线；EvidenceModulePage-B1LcajZl.js 含 auth/whoami → ①ac60382a 与 r1 P0-1 修复 6586df6b **已上线**。
- 结论：现网停在 6586df6b/9333a721 代次（gate ledger 自注 stamped at 6586df6b 吻合），wave-131 两个 feature merge 未随部署。L0 令中「seal 说 live=BuZxlyEv 为真」与「两改已上屏」是两回事——entry 真、内容旧。

## 2. 三件判词
### ① r4 挂账 history 页尾同构（ac60382a）— CLOSED（DOM+图双证）
- 复现：登录 8183 → #/approvals → 点「历史决策」→ 滚到底。
- DOM：footerText=「已到末页 · 已显示 11 条」（end 变体，句式与 pending 侧同构）；加载更多 disabled=true；rows 屏上 11（testid 前缀重复计 22，声明残字）。
- 图证（observer 读图）：approvals-history-foot-1440-r5.png 页尾逐字「[⟳ 加载更多]　已到末页 · 已显示 11 条」；屏上可数 11 行与文案匹配；与 pending 页 footer 同组件同骨架同按钮位，1440 不换行不挤压。
- 新小项（记 P2/口径）：末页态「加载更多」**视觉无禁用样式**（正常描边钮与「已到末页」并存；DOM moreDisabled=true 但未映射到禁用样式）——反馈一致性小刺，r6 顺带核，本轮不立案不扣分。
- 小观察（不立案）：点 tab 后 location.hash=''，history 走 path 路由形态；r4「pending/history 同构未拍页尾」挂账至此闭合。

### ② 知识第四改 3e01e190 上屏复评 — BLOCKED（未部署），r4 遗留 2 项在现网未清账
- 面题分段：faces=[]、surfaceHeads=[]，屏上无新面题（freshCount=1 命中的是第三改 knM-source-note 旧句）。
- 请求编号不上屏：收起态裸 32hex 实测 collapsedHex=2（仍铺屏）；knw5-req-toggle DOM 不存在（notes: no req toggle found）。
- 新鲜度收起一行：现网仍第三改多行形态。
- 判词：维度7 delta=**零**——不是改坏了，是没有新码可评。r4 遗留「hex 铺屏」「面题工程名」两条**维持未销**。
- 图证（observer 读图，双档与 r4 完全同形）：knowledge-collapsed-1440-r5.png=文档块+空间块纵向堆叠无折叠、32hex×2 直接铺屏（`84dbfb4d…`/`8e3e7fe6…`）、旧题「文档登记读口未接入」「知识空间未接入」无新面题、「读口」字样屏面 ~6 处、「数据来源与新鲜度」仍展开态整段铺屏、纵向死白 ~70%（r4 为 62%，略放回）；knowledge-list-375-r5.png=首屏与 r4 同构（hex×1 可见、内层 tab 2×2、「搜索」钮换行孤悬、「刷新/复制结果」满幅）、无裁切无右溢出。
- 环境工单（P1，归 L0/部署线，非实现码）：**UX-r5-E1 部署闸**——wave-131 feature（3e01e190、a95ab6cf）未进现网 build；复验 r6 前须先重新部署含 d2cc49fe 的 build，并以 chunk 级标记（非仅 entry hash）为部署判据。

### ③ runs 375 卡片字段名 a95ab6cf 复验 — BLOCKED（未部署）
- 375 DOM：labelCount=0、visibleLabels=0 → 卡片字段名 label 未出现，r3 P1-B4「375 列头 label 丢失」在现网**维持未修**。
- 图证（observer 读图）：runs-cards-375-r5.png 卡片内**零字段名 label**——状态 chip、时间、耗时、金额、「已计价」、负责人全部裸值按位排列，无「开始/耗时/原因/负责人」任何列头字样（「已计价」chip 单读可辨但裸值流中语义靠猜）；runs-list-1440-r5.png 表头七列名视觉在位（运行/状态/开始/耗时/成本（美元）/负责人/失败原因），成本口径注释在「读取成功」下方整段可见。th 元素与否图不可判（DOM 探针 th=[] 系承载形态局限，以视觉存在为准记「在位」）。
- 同单 UX-r5-E1 覆盖；r6 复验时按 a95ab6cf 真判据核：375 卡内「开始/耗时/原因」label 可见、1440 表头语义在位、成本口径注释可见。

## 3. 顺带记录（不开新面）
- r1 P0-1 修复码（6586df6b，useEvidenceSession.ts）已上线——待下轮以证据页复验图清账。
- 375 知识内层 tab 仍 3 行堆叠（tabRows distinctRows=3，旧账维持）。
- knowledge 腿 4 枚 404：documents?limit=50、spaces?limit=20 各 ×2，为显式 not_wired 业务码老口径，非新问题。

## 4. board 行建议
`UX r5 approvals/history 销项CLOSED P0=0 P1=0 P2=1(末页加载更多无禁用样式)`
`UX r5 knowledge/列表页 复验BLOCKED(未部署) P0=0 P1=1(E1环境) —— 维度7维持 r4=2`
`UX r5 work/runs 复验BLOCKED(未部署) P0=0 P1=0(并入E1) —— P1-B4 维持未修`
