# DONE-DU-07 · 值班台 375 高频页判据

- 分支 `task/DU-07-375-criteria`，基 = DU-06 tip `d1aed0fd46`（共头；现脸 29ad92208d ∈ 祖先，零冲突）。
- 写域：`web/src/modules/duty/{DutyPage.tsx,AgentFleetRail.tsx,duty.css,runsCaliber.ts,dutyPage.test.tsx}` + 新 `duty.375.criteria.test.tsx`（11 例）+ 本文件与 `evidence/`。`e2e/ia-smoke.spec.ts` 属 D 车道只读，未动。

## 判据实测（playwright 真登录腿，反代 9311；根字号 15px，按 px 报）
① 无横向溢出：375 档 `document.scrollWidth=375`（判据 ≤375），body 同值；逐卡 scrollWidth==clientWidth（340），卡右缘越视口=0；设计内滑轨=1（热力 24 格横滑，配套逐格文字替代列表 rows=24 同串——滑轨有等价出口）。
② 交互目标 ≥44×44 或间距 ≥44：375 抽 24 个交互目标，`<44×44 且中心距<44 = 0`（刷新钮 341.5×44、时间窗钮 h=44、行内深链走整行 `min-block-size:44px` 载体 + 单目标行间距腿，duty.css L895-904 注释写明判据归属）。1440 档不受此判据约束（读数 29.84h 为桌面自然档，属预期）。
③ 无 hover-only：`:hover` 承载显示的 CSS 规则=0；tap 可达 7/7 ok（刷新/切窗/逐时文字开关/趋势表格开关/状态筛选/卡外折叠/口径折叠）；热力 24 格 title 与「以文字查看」列表逐格同串（`heatCellText` 单一真值源）；阻塞深链原句上屏；fleet 全名+原始 employee_id 由 `duty-fleet-id-list` 逐行屏上承载（title 是补充）。
   如实记：折叠末态快照下有 24 段 title 长句未直出屏上——其载体为折叠详情/ui-c-id（打开即落屏），jsdom 侧由 375.criteria 测试①④钉同串；省略号裁切 9 处均在 fleet rail 短列（全值已在屏 id 列表，无信息丢失）；`duty-gate-source` 375 已改换行零裁切。
④ 单列：窄屏块=14 重叠=0 列起点=[11.3]（单列一值）。抽屉/折叠开合判据用 `open` 属性与 `aria-expanded`（禁宽度判据——translate 类假读数源头，测试④钉死）。
⑤ 缺数「—」+原因上屏，绝不裸 0：zeroProbe 仅 1 处 `duty-kpi-failed="0"`，为真实运行零（与状态筛选-失败腿 tap 后列表行为一致），非占位假 0；缺采集时刻的四张 stamp 原因句全部屏上（不用本机时间顶替）。

## 测试
- `vitest run src/modules/duty`（node v26.13.1）→ **16 文件 219/219 绿**（含新 375.criteria 11 例：热力文字同串、五读数常驻+aria-expanded、零「见 title」句柄回归钉、阻塞原句上屏、口径三 verdict 自足、details open 判据、口径钮翻转、单列骨架、44 触控档 CSS 钉形（含本轮新增 8 选择器表）、缺数全「—」不裸 0、趋势读败不当代 0）。
- 全量与 tsc 读数继承同源基线：DU-06 树全量 `vitest run src` 3844 例中 3843 绿、唯一红 = `e1Contract`（9122 活部署 entry hash 与本树 dist 漂移，结构性环境红，共享检同文件 7/7 绿实证在前）；`tsc -b . --noEmit` 49 错全为 apps/shared TS2307 基线噪声，duty 相关=0。本树改动仅 duty 模块 + 新测试。

## 截图归档（卡面 DoD 路径 docs/_artifacts/shots/ + evidence/）
- `web/docs/_artifacts/shots/duty-{1440,375}-{page,heat,details}.png`、`duty-375-lower.png`
- `evidence/duty-{1440,375}.png`、`duty-{1440,375}-folded.png`、`du07-readings.json`（1725→终版全状态读数）、`du07-shoot.log`（raw 自报 ①–④）
- 取证脚本（du07-{shoot,proxy,diag}.mjs、du07-login.py）按 DU 车道惯例不提交（login 含凭据读取，禁入库）。

## 已知边界
- 测量在登录态真数据（3 员工 pilot 名册）；1440 列起点 [230.5,627.8,1025.2,826.5] 为桌面多列预期。
- 孤儿取证进程曾续写 readings（终版 24-target 形制为准）；已核 JSON 完整性后作数。
