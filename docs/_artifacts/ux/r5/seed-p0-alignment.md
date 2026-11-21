# seed-r1 三条 P0 派工对齐（r5 状态令回复，2026-11-22）

前提披露：本写域内**不存在** seed-r1 工单文件（docs/_artifacts/ux/ 全量= r1 评审+工单、r2 评审+工单、r3/r4/r5 closeout，无 n1/n2/n3 编号件；grep "seed" 零命中）。本对齐按 L0 令原文口径逐条核。若 seed-r1 另有出件会话，请给 sha 以便对原文。

## r5 状态一行
已交付：commit **ce3c8097**（lane/UX-total 本地，11 文件 docs/_artifacts/ux/r5/**）；①history 同构 CLOSED；②③未部署 BLOCKED；卡点=**UX-r5-E1**（现网 BuZxlyEv 缺 wave-131 两 feature，需 L0 重部署后 r6 复验，判据用 chunk 级标记）。ETA=0（本轮已收口）。

## n1 knowledge 双层导航死路 — 归属同意，判据修订
- 归属：外层壳/路由（App.tsx/routes.ts）→L4；内层模块 Tab/面（modules/knowledge/**）→UI-KD。**同意切分**，但补一条：内层 Tab 与外层 Tab 语义合并属**同一契约**，两车道须共享一份落点表（哪个外层 tab 承载哪个面），否则会各修一半。
- 判据（验收以真实渲染为准，非代码在场）：
  1. 冷深链 `#/knowledge?tab=evidence` 落点与点击「证据与引用」进入的页面**同构**（r1 实测曾为两套 UI：内嵌引用面板 vs ev5 独立页）；
  2. 外层三 tab 每个出口有真实落点；「数据源」诚实空态**不得**为消死路而删除（删了=数据误导，反而立 P0）；
  3. 双层导航合并后页头唯一（无"知识空间/数据接入/检索/证据与引用"叠在"知识空间|数据源|证据与引用"之下的双套）。
- 升级说明：r1 我判 P1（绕路困惑）；L0 以"死路/主任务做不成"升 P0 **成立**（深链双页+外层无落点可证），接受升级，board 以 P0 记。

## n2 375 壳裁切+假绿判据 — 归属同意，验收补两钩
- 判据改造已落 wave-125（assert-375 逐元素 right<=376 && left>=-1、domOverflowPx 仅辅证永不签绿、pngH≤视口记 NOT_MEASURED 且优先 FAIL）——**与我的复跑口径一致，同意**。
- aud D1 逐路盖章验收判据修订为三件套：
  1. 逐路 viol=0 **且** notMeasured=0（仅绿 viol 不够，r4 有内部滚动壳假 NM 前科）；
  2. **幽灵抽屉另列**：offscreenLeft 不计违规是判据正确行为，但闭合抽屉 left=-240 仍可键盘进入（r2 P1-S1，两节点 inert=false/aria-hidden=null，容器在壳层 App.tsx 侧）不在 assert-375 覆盖面内，须单独勾账，归 L4/壳侧；
  3. 任何旧「document 级 scrollWidth 绿」引用一律作废（wave-125 记忆口径）。
- knowledge/system 逐元素点名读数：同意；r5 实测 knowledge 375 overCount=0 可作首证。

## n3 matrix 主任务不可达（MATRIX_FIXTURE 死代码）— 技术前提核实属实，判据与写域各修一处
- 核实（源码在场证据）：`matrix.ts:254` 导出 MATRIX_FIXTURE，全仓无引用（仅 duty 测试断言其**不出现**）；`MatrixModulePage.tsx:157/164` 有 origin==='fixture' 展示钩（data-fixture=1+「示例数据」warning Badge+mtx5-fixture-note），但 `MatrixModulePage.test.tsx` R7.1 item2 钉死「live endpoint, no fixture fallback：404 保持诚实未接」→ fixture 路已建、门未接=死代码，PRD §12 fixture 门（CONSOLE-PRD-v4.md:36/66 BOUNDARY-12）未落地。**判"主任务不可达"在 /api/matrix 未接的现网成立**（未接证据待 ui2 首跑实测 /agent-api/api/matrix）。
- 写域修订：matrix Tab 的**挂载点在 modules/employees/manifest.ts:23-29**（matrix 是 employees 的子 tab，#/matrix 仅 redirect）。若修复触碰 tab 注册/路由，`modules/matrix/**` 不够——请 L0 给 ui2 加一条边界：默认限 modules/matrix/**+测试；若必须动 employees/manifest，先回报再扩，不得顺手改。
- 验收判据（防 fixture 滥用为假数据铺屏）：
  1. fixture 仅在 §12 门显式开启（gate 参数/env 之一，实现归 ui2）时生效；**默认路径维持 R7.1 测试语义**（404=诚实未接，无 fixture fallback），该测试不得弱化；
  2. fixture 生效时屏上必现「示例数据」Badge + data-fixture=1（钩已存在，补测试钉）；
  3. 主任务路=「查覆盖缺口」：1440/375 真渲染下缺口列表可读、空筛选出口「该筛选下没有员工→清除筛选」可点、consoleErrors=0，双档截图入 docs/_artifacts/ux/**。

## board 影响
n1/n2/n3 与我方 r1 P1-4/P1-2、r2 P1-S1 同源不重计；r5 新增仅 UX-r5-E1（环境 P1）。
