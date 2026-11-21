# UX r4 销项增补表（60 分钟盒·勿写码）

基线：lane/hermes-console@b82ff813（含我 r3 交付 5e0c89d1）；本车道 FF merge 后 HEAD=b82ff813。
现网代次：entry=assets/index-Bx_m7yAP.js，取图腿首尾一致无漂移（r4/ux-capture-r4.summary.json）。
授权腿：authstate opsadmin token_version=3 issuer=bisheng 过。

## 0. 密度更正声明（L0 令①前置）
- 91bffe62「二改」经 commit message 自证实为 `git checkout c3a5b502` 基线回退 → **r3 按 91bffe62 评的密度读数（rowFontPx=10.8px 等）作废**。
- 76d45463 真密度第三遍已上屏：KnowledgeModulePage-DB-7dYtM.css 含 minmax(0,5.25rem)+minmax(0,1fr)+line-height var 令牌；ac60382a footer 状态机含 `总数不可用/已到末页` 三元与 end chip 退场逻辑（ApprovalsPendingModulePage-DoZuA6rv.js）。在网证据=chunk 标记双证。

## 1. 知识维度7 两条未销项 → 逐条判定（读图为准）
判定=**保留未销**，维度7 双档 1440=2 / 375=2，取更差 **2，与 r3 持平**：
- 两套读口块纵堆：未变一套、未改分段——搜索框/说明段/黄块/请求编号/重试/申请/复制提示每块俱全，中间夹内层 tab，与 r3 同构。证据=shots/knowledge-list-1440-r4.png。
- hex 铺屏：屏面 **×2**（5d700684…、c92e3278…）原样在。同图。
- 三组微文案复读原样；死白 ~62%（末行 y≈1010，下方 ~1650px 空）比 r3 ~70% 微收但仍大病。同图。
- 375：满幅刷新/复制钮仍在、内层 tab 2×2 原样；搜索钮换行孤悬减轻（不再拉满全幅）；逐元素右溢出=0。证据=shots/knowledge-list-375-r4.png（860px，第二套块在截图边界外，非布局裁切）。
- **真进步项（记录但不改档）**：字号三档分层肉眼成立——节标题 ~16 / 正文 ~13（r3 时代 10.8）/ 辅文 ~12 弱化色；「眼睛」修好，「骨架」未动。
- r1 P1-6「未接入或没有权限」混写：屏面原文两处在（复制提示行）→ **仍 OPEN**。
- **探针漂移第二例（重要坑）**：DOM 探针本轮 hexOnScreen=0、读口=2、mixedState=false，与屏面 hex×2、读口≈6、混写文案在屏直接矛盾——**r4 探针三项读数作废，销项一律以读图为准**。mixedState 正则疑因屏上文案无空格（「未接入或没有权限」）而漏配。

## 2. 审批 P1-A2 三条销项复验（ac60382a）
| 判据 | 结论 | 证据 |
|---|---|---|
| ① 列表 vs 详情时间换算自洽 | **CLOSED** | shots/approvals-time-detail-1440-r4.png：详情「提交 2026-11-21 09:09」「处理期限 2026-11-22 09:09（剩 10 小时 9 分）」+链路「13 小时前」；CSV 戳 23:00 → 09:09→23:00=13h51m ✓、23:00→次日 09:09=10h09m ✓，同源同单无漂移。详情「请求编号：该字段未返回」诚实占位（未编 hex），好。 |
| ②「总数不可用/已到末页」互斥 | **CLOSED**（pending 侧 DOM+图双证；history 侧同构待证） | DOM：countText=「已到末页 · 已显示 1 条」、hasTotalUnavailable=false、end chip 退场、加载更多钮禁用承担末页证据；图3 footer「[⟳ 加载更多] 已到末页 · 已显示 1 条」。history 截图未拍到页尾（止于第 10 条）→ 同构性挂 **r5 滚到底补图**。 |
| ③ miss 空态无加载更多 | **CLOSED** | shots/approvals-miss-empty-1440-r4.png：空态下无 footer 无加载更多无「已到末页」行；原文「没有匹配的审批。」+「这是前端本地过滤的真实结果：当前已加载 1 条里没有包含「…」、可清空搜索或换服务器筛选条件。」+[清空搜索]；汇总「已显示 0 / 1 条申请，其中 0 条待处理（关键字过滤中）」。口径诚实。 |

数据腿备注：pending 从 2 条变 1 条=真实数据变化非缺陷；history=11 条。

## 3. board 行建议
`UX r4 knowledge/知识空间 维度7=2 维持未销（91bffe62 作废→76d45463 重评：字号分层真进步、骨架未动、探针三读数作废以图为准）`
`UX r4 approvals/待处理 P1-A2 ①CLOSED ②CLOSED(history同构待证) ③CLOSED`

## 4. r5 待办登记
- 知识双块结构手术（P1-4 双导航/死白 62%/三组复读/hex 铺屏）——属写码轮。
- history 页尾 footer 滚到底图证（②同构补证）。
- 375 满幅刷新/复制钮 + 内层 tab 2×2。
- 探针口径修正建议（供实现车道，非我写域）：混写正则容空格变体；hex 扫描含「请求编号：」邻近 32hex。

## 5. 交付物清单
脚本 docs/_artifacts/ux/ux-capture-r4.mjs；产物 r4/{ux-capture-r4.summary.json, ux-capture-r4.out, shots/×5}。全程未触碰产品码；决定钮零点击。
