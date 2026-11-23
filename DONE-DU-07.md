# DONE-DU-07 · 值班台 375 高频页判据

- 分支 `task/DU-07-375-criteria`，基 = DU-06 tip `d1aed0fd46`（共头；现脸 29ad92208d ∈ 祖先，零冲突）。
- 写域：`web/src/modules/duty/{DutyPage.tsx,AgentFleetRail.tsx,duty.css,runsCaliber.ts,dutyPage.test.tsx}` + 新 `duty.375.criteria.test.tsx`（11 例）+ 本文件与 `evidence/`。`e2e/ia-smoke.spec.ts` 属 D 车道只读，未动。

## 判据实测（playwright 真登录腿，反代 9341——9311 为 DU-06 口且在本道黑名单；根字号 15px，按 px 报）
① 无横向溢出：375 档 `document.scrollWidth=375`（判据 ≤375），body 同值；逐卡 scrollWidth==clientWidth（340），卡右缘越视口=0；设计内滑轨=1（热力 24 格横滑，配套逐格文字替代列表 rows=24 同串——滑轨有等价出口）。
② 交互目标 ≥44×44 或间距 ≥44：375 抽 24 个交互目标，`<44×44 且中心距<44 = 0`（刷新钮 341.5×44、时间窗钮 h=44、行内深链走整行 `min-block-size:44px` 载体 + 单目标行间距腿，duty.css L895-904 注释写明判据归属）。1440 档不受此判据约束（读数 29.84h 为桌面自然档，属预期）。
③ 无 hover-only：`:hover` 承载显示的 CSS 规则=0；tap 可达 7/7 ok（刷新/切窗/逐时文字开关/趋势表格开关/状态筛选/卡外折叠/口径折叠）；热力 24 格 title 与「以文字查看」列表逐格同串（`heatCellText` 单一真值源）；阻塞深链原句上屏；fleet 全名+原始 employee_id 由 `duty-fleet-id-list` 逐行屏上承载（title 是补充）。
   如实记：折叠末态快照下有 24 段 title 长句未直出屏上——其载体为折叠详情/ui-c-id（打开即落屏），jsdom 侧由 375.criteria 测试①④钉同串；省略号裁切 9 处均在 fleet rail 短列（全值已在屏 id 列表，无信息丢失）；`duty-gate-source` 375 已改换行零裁切。
④ 单列：窄屏块=14 重叠=0 列起点=[11.3]（单列一值）。抽屉/折叠开合判据用 `open` 属性与 `aria-expanded`（禁宽度判据——translate 类假读数源头，测试④钉死）。
⑤ 缺数「—」+原因上屏，绝不裸 0：zeroProbe 仅 1 处 `duty-kpi-failed="0"`，为真实运行零（与状态筛选-失败腿 tap 后列表行为一致），非占位假 0；缺采集时刻的四张 stamp 原因句全部屏上（不用本机时间顶替）。

## 测试
- `vitest run src/modules/duty`（本机 node v24.22.0）→ **16 文件 219/219 绿**（含新 375.criteria 11 例：热力文字同串、五读数常驻+aria-expanded、零「见 title」句柄回归钉、阻塞原句上屏、口径三 verdict 自足、details open 判据、口径钮翻转、单列骨架、44 触控档 CSS 钉形（含本轮新增 8 选择器表）、缺数全「—」不裸 0、趋势读败不当代 0）。
- 全量与 tsc 读数继承同源基线：DU-06 树全量 `vitest run src` 3844 例中 3843 绿、唯一红 = `e1Contract`（9122 活部署 entry hash 与本树 dist 漂移，结构性环境红，共享检同文件 7/7 绿实证在前）；`tsc -b . --noEmit` 49 错全为 apps/shared TS2307 基线噪声，duty 相关=0。本树改动仅 duty 模块 + 新测试。

## 截图归档（卡面 DoD 路径 docs/_artifacts/shots/ + evidence/）
- `web/docs/_artifacts/shots/duty-{1440,375}-{page,heat,details}.png`、`duty-375-lower.png`
- `evidence/duty-{1440,375}.png`、`duty-{1440,375}-folded.png`、`du07-readings.json`（1731 行，终版全状态读数）、`du07-shoot.log`（raw 自报 ①–④）
- 取证脚本（du07-{shoot,proxy,diag}.mjs、du07-login.py）按 DU 车道惯例不提交（login 含凭据读取，禁入库）。

## 已知边界
- 测量在登录态真数据（3 员工 pilot 名册）；1440 列起点 [230.5,627.8,1025.2,826.5] 为桌面多列预期。
- 孤儿取证进程曾续写 readings（终版 24-target 形制为准）；已核 JSON 完整性后作数。

## 换代并入（01:50–02:05，L0 裁定后重取基；本节替换并作废前稿对 b8d295d919 直并的半途方案与 01:44 补笔）
- **换基工序**：`git merge --abort` 退掉半途的 b8d295d919 直并，改并 lane/hermes-console 现脸
  `31137079835d690d4215fe0067e32de1bd4f63c1`（含 DU-05@fcce30db27 线笔 e207322a6c 与 DU-06@b8d295d919 线笔 3113707983）。
  冲突仍仅 `DutyPage.tsx` 一处（BlockersCard 深链 hunk）；本笔 merge 第二父=3113707983。
- **L0 裁定落点（两处语义，逐字执行）**：
  ① `blockersLinkNote` 弃静态旧句「阻塞项已在本卡逐条列出」（该话术被线侧 duty.q10-parity 条目3 判失真），
     改为线侧 DU-02 诚实口径动态句：「任务页不接受 status 筛选参数，这里去任务板。本次各读口上限 3 条，
     共读到 ${total} 项阻塞；卡面列前 ${LIST_CAP} 条，其余如实标注「另有 N 条」，不说「已逐条列出」。」
     DU-07③「title 原文上屏」不回退：`duty-blockers-link-note` 可见句与 title 共用这一份动态串
     （duty.375.criteria 断言 visible===title 原样成立）。
  ② 链接文案恢复「查看全部 (N)」，N=`blockersTotal`（线侧形制、服务端真数）；线侧 q10-parity
     `toContain("查看全部 (7)")` 与 dutyPage.test「title 含『不接受 status 筛选』」均绿，线侧钉测零改动。
- **OM-01 挂载换代如实记**：线侧把 `#/overview` 的 duty 标签页改渲染 `modules/overview/OverviewPage`
  （App.tsx 由 merge 自动并入，非本车道执笔、本车道未触碰），DutyPage 生产路由不再挂载
  （`/duty`→DutyRedirect→`/overview`）。故 merge 后脸无法经现网路由重拍 DutyPage；本车道不越写域
  去 overview 补拍，post-merge 面由 jsdom 227 条断言钉住。
- **截图处置判定**：01:44 重拍七张（build3=主提交 680110792f 源码逐字节一致，`cmp` 与 evidence/ 同名件全等）
  为主脸终版渲染，**随本笔入库**——修正主提交内 shots 落后于其自身源码的旧病（build1 时代、gate-source
  未换行）。与 post-merge 脸唯一已知差异=阻塞卡 title/可见句（截图为裁定前静态旧句），以本节为准；
  reshoot 读数 `evidence/du07-reshoot-readings.json`（375：docScrollWidth=375、越界卡=[]、
  title↔文字列表同串=true、见 title=false、屏上「原因：」stamp 句=4、本体<44×44 仅 4 个 gate-source
  走整行 44px＋间距腿）按取证件惯例不入库。
- **门禁复跑（merge 后，原始 stdout 逐条）**：
  - `vitest run src/modules/duty` → `Test Files 17 passed (17)` / `Tests 227 passed (227)`
    （线侧 16/216 + 本道 duty.375.criteria 11 例；duty.q10-parity 全绿；02:00:39）。
  - `vitest run src` 全量 → `Test Files 1 failed | 528 passed (529)` / `Tests 1 failed | 4008 passed (4009)`；
    唯一红=`src/shell/e1Contract.test.ts`：`AssertionError: served entry drifted from the dist on disk:
    expected 'assets/index-DZJ7eIFp.js' to be 'assets/index-DTeUrrSH.js'`——9122 现脸部署与本树 dist
    漂移闸，非 duty、非本单改动；按令不消解不改该件，回执单列「环境红非本单」。
  - `node_modules/.bin/vite build` → exit 0（02:0x）。
  - `node scripts/lint-fake-success.mjs` → `"violations": [], "ok": true`。
  - `npx tsc --noEmit -p tsconfig.app.json` → 全仓 49=基线、`modules/duty` 命中 0。
