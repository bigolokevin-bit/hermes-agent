# r7 修订判词 — 冷启动高亮归属精确化 + E1 清除判据改形制（回应 L0 逾期点名令，2026-11-22）

定脸事实：前端定脸 a382334c（wave-135 #1，含 01c52e91 one preserve rule、d2646540 n6 route contract）。本车道实测 `git merge-base --is-ancestor b24de09f a382334c` = yes（r1 交付链在定脸祖先内）。

## 判词① 冷启动 ?tab=sources|ingest 外层高亮落「知识空间」
**定级维持 P1**（不升 P0、非可接受：内容落点正确主任务可达；外层高亮虚报位置=导航状态错，非数据误导）。

**归属修订**（更正我 r6「归壳/路由侧 L4」的单边口径）= **UI-KD + L4 双落点共担，主落点 UI-KD**：
- 主落点 `web/src/modules/knowledge/manifest.ts` normaliseKnowledgeDeepLink（UI-KD 写域）：冷链归一决定内容落哪个面与寻址语义，高亮错位的根在归一结果与外层 tab 语义不对齐；
- 次落点 `web/src/shell/**`（L4 写域）：resolveTab/ConsoleTabStrip 的外层 aria-selected 判定与 preserve 泄漏（01c52e91 已进定脸）。
与 shell 车道（mac015-studio）自报口径一致：该修法 shell 单独动须跨权，故属 UX 判定后派双车道。
验收钩不变：三态冷链「外层高亮==内容落点」且与点击进入同构（双档 DOM aria-selected + 读图）；若修复后内容也落错面 → 升 P0 并入 n1 死路，不重复计。

## 判词② E1 清除判据
**同意 L0 新形制，并自纠我 r6 错误口径**：git sha 结构上不进 vite bundle，「entry grep 代码 sha」不成立，撤回该表述。修订三钩：
- **H1 基线侧（aud 做）**：对 7 个代码 sha 逐一 `merge-base --is-ancestor <sha> a382334c`。代码 sha ≠ 构建 sha，祖先核对只解「定脸含码」。
- **H2 上屏侧（aud 做）**：entry 内容/mtime 比对——现网 entry 文件名与 a382334c 构建产物一致，且资源 mtime ≥ 定脸构建时刻。此项解「上屏够新」。
- **H3 内容侧（UX 总审做，终判）**：懒加载 chunk 级特征串 grep——Knowledge chunk 含「空间台账/运行事件引用/knw5-surface-title/req-toggle」、Runs chunk 含 sm:hidden/labelTestId；负标记复检 collapsedHex=0、375 labelCount>0、内层旧同名标签消失；以 DOM+读图双轨定案。**销 E1 权在 UX 总审，H1+H2 全绿不清账**——r5 实证 entry 为真而 chunk 仍旧代次，正是 H3 兜住的缺口。

回执口径：两判词=①P1，归属 UI-KD（主，manifest.ts）+L4（次，shell）；②同意 L0 形制+加 H3 内容侧终判钩，撤回「entry grep sha」旧表述。
