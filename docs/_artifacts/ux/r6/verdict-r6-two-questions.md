# r6 判词落账 — 两问书面化（2026-11-22，L0 25 分钟盒）

背景：L0 令「别等 aud，判词先行」。此前口头回执（会话 @315@）书面化并入账。基线事实（L0 亲跑）：集成分支 lane/hermes-console tip=6edcba4d；wave-134 已并 L2 6149cfa8 + L5 a5610d61。

## ① 冷启动 ?tab=sources|ingest 外层高亮落「知识空间」
**判定 = P1，不升 P0**；**归属 = 壳/路由侧（L4，App.tsx/routes.ts）**。
理由：冷启动内容仍正确落入知识模块对应面（sources/ingest 面可达，主任务未断），错的只是外层导航高亮虚报位置——属导航状态错（绕路困惑），非数据误导、非主任务做不成，按 rubric P0 三门不达。与 r5 n1 双层导航契约同病灶，但独立于 n1 的死路部分（n1 保持 P0）。
验收钩：`?tab=sources|ingest|evidence` 三态冷启动实测「外层高亮 == 内容落点」，且与点击进入路径同构（双档 1440/375，DOM aria-selected + 读图双轨）。

## ② UX-r5-E1 清除判据 = 「entry 实读到六标记」**不充分**，修订为四硬钩
a) **chunk 级命中**：六特征须落在各自被引用的懒加载 chunk 内 grep 命中（Knowledge chunk 查 空间台账/运行事件引用/knw5-surface-title/req-toggle；Runs chunk 查 sm:hidden/labelTestId；35115d74/6edcba4d 新增量按其波内容名另点名），不是只在 entry 文件查——r5 已证 entry 真、内容旧。
b) **负标记复检**：旧形态必须消失（收起态裸 hex collapsedHex=0、375 卡 labelCount>0、内层旧同名标签不存在）。
c) **双轨终判**：grep 过门 ≠ 清除；终判以我的 DOM+读图复验（r6/r7 腿）为准。
d) **标记链完整性**：六标记须为该 tip build 实际引用（entry→chunk 引用图核对），防串代次混部。
四钩全绿才销 E1。aud 在 tip 上的盖章解「基线含码」，不解「现网含码」——E1 销项权在 UX 总审双轨复验。
