# UI-C 车道回执：详情页表现层（员工 / 审批 / 运行 / 任务）

- 车道分支：`lane/console-ui-c`；基线 `42180cd6`（UI-A 冻结层 + wave-49）。提交链：`5333ba2e` → `56780871` → `f670361d` → `f7ed0555` → `1575ed31`。
- 依据：`docs/design/UI-RUBRIC.md`（令牌清单 + 8 维评审表）与 UI-QA 基线评审 review-2332（总分 40.5/100，D1–D6）。
- 边界：只动表现层与信息组织；未改业务逻辑、未改/未增 testid、未增可见 Tab、未动 App.tsx 路由表与 modules 取数。22 Tab / 51 路由计数不变。
- 共享载体：新增 `web/src/styles/detail.css`（`.ui-c-*` 一族，全部取 UI-A 语义令牌），由 `web/src/shell/console.tsx` 引入（沿用 `table-density.css` 先例）。

## 每处逐条：问题 → 改法 → 文件 → commit

### ① 员工详情（`5333ba2e`）

1. 问题：身份卡字段无区块标题、三列栅格用非档间距、长值 truncate 截断不可读。
   改法：加 `.ui-c-head`「身份与组织」区块头；字段 dl 换 `.ui-c-fields`（1→2→3 列、列距 --space-6、卡内边距 --space-4）；值弃 `truncate` 改 `overflow-wrap:anywhere` 折行。
   文件：`web/src/modules/employee-detail/EmployeeDetailModulePage.tsx`（IdentityField/IdentityCard）、`web/src/styles/detail.css`。
2. 问题：概览区「最近活动/月度预算」数字不等宽、行分隔非令牌。
   改法：行栅格换 `.ui-c-rows/.ui-c-row`（分隔线 `--border-1`，标签列 8rem），时间/金额字段挂 `.ui-c-num`（tabular-nums）；加区块头「在岗与最近活跃」。
   文件：同上（OverviewZone）。行序未动（parity 测试钉死首行 dd 的 title）。
3. 问题：能力与权限区表头/行内 12/28px 混排、375 下值无语义标签（QA 缺陷 P2「卡片流丢字段标签」同款病灶）。
   改法：表头 `.ui-c-colhead`（<768 隐藏），行 `.ui-c-cell-row`+`.ui-c-cell-label`（<768 显示「风险级别/来源」前缀，≥768 隐藏），加区块头「能力与权限」。
   文件：同上（CapabilityZone）。
4. 问题：审批分区拒绝态把 JSX 注释写成裸文本，`/* R93: … */` 直接上屏（技术自白外泄）。
   改法：改成 `{/* … */}` 真注释。
   文件：同上（approvals-denied 分支）。

### ② 审批详情（`56780871`）

1. 问题：详情抽屉字段行内 `gap-1.5`（6px 非档）+ 全部 12px 挤成文字墙，无分区。
   改法：`Field()` 统一换 `.ui-c-field/-label/-value`；dl 换 `.ui-c-fields--compact` —— 容器查询（`.ui-c-container`）按抽屉实宽 1→2→3 列，375 单列纵向堆叠不横溢。
   文件：`web/src/modules/approvals/views.tsx`、`web/src/styles/detail.css`。
2. 问题：标题行无分区分隔；状态/风险徽章与标题基线不齐。
   改法：标题行换 `.ui-c-head--plain`（下分隔线），h2 走 `.ui-c-head-title--lead` 并允许折行；徽章保持标题直接兄弟（DOM 契约），靠 `flex-1` 推右。
   文件：同上（ApprovalDetailBody）。
3. 问题：提交/处理期限/涉及金额/决定时间数字不等宽（QA 数字列口径）。
   改法：四个字段挂 `.ui-c-num`（tabular-nums + tnum）。
   文件：同上。
4. 问题：操作指纹/请求编号/数据范围是长 id，复制入口夹在值行中间。
   改法：id 值走 `.ui-c-id`（等宽折行不撑破），复制按钮挂 `.ui-c-field-actions` 弱化为下划线小字；数据范围快照值同样 `.ui-c-id`。
   文件：同上（apd5-field-action-hash / apd5-field-request-id）。
5. 问题：事由/审批人行内标签与值同字号，扫读不分层。
   改法：行换 `.ui-c-inline`（标签 muted font-1，值 `.ui-c-inline-value` 取正文字色）；textContent 逐字节不变（parity 契约 `审批人：郑涛` 等钉死粘连）。
   文件：同上。
6. 问题：决策回放/决策链路/相关记录三块无分隔、字号字重游离；「复制为纯文本」坠在链路底部（简报要求复制/导出入口收区块右上）。
   改法：三块统一 `.ui-c-section`（上分隔线）+ `.ui-c-section-title`；决策链路加 `.ui-c-section-head`，apd8-copy 按钮与状态反馈收进 `.ui-c-section-actions`（右上）。步骤节点文本一字未动（`segs()` 按 `·` 切片的契约）。
   文件：同上。
7. 问题：请求编号 `<code>` 与 CSV 文件名用 `break-all` 拆词断行不可读（QA P3）；相对时间 `break-all` 会把「3 分钟前」拦腰斩断。
   改法：`states.tsx` 请求编号与 `QueueCsvExport.tsx` 文件名换 `.ui-c-id`（anywhere 折行不拆词）；`RelativeTime.tsx` 换 `.ui-c-num`。
   文件：`web/src/modules/approvals/{states,QueueCsvExport,RelativeTime}.tsx`。

### ③ 运行详情（`f670361d`、`1575ed31`）

1. 问题：行展开预览无标题、说明文字坠底、复制按钮在底部游离。
   改法：`RunPreviewPanel` 加 `.ui-c-head--plain/.ui-c-head--start` 区块头「运行预览」+ `.ui-c-head-sub` 说明，行复制按钮与状态收进 `.ui-c-head-actions`（右上）；字段 dl 换 `.ui-c-fields--compact`（容器查询 1→2→3），dt/dd 结构保留（parity 测试按 `dd` 取数）。
   文件：`web/src/modules/runs/RunsModulePage.tsx`。
2. 问题：起止/耗时/成本数字列不等宽（QA 数字口径）。
   改法：`NUM_KEYS = {started,ended,elapsed,cost}` 统一挂 `.ui-c-num`。
   文件：同上。
3. 问题：详情卡头部 runId 用 truncate、四列栅格与预览两套配方；成本/预算/尝试次数/结束/事件计数不等宽；上游运行独占行错位。
   改法：头部换 `.ui-c-head--start` 配方（h2 `.ui-c-head-title--lead` 折行 + summary `.ui-c-head-sub` + 关闭按钮右上）；字段容器改与预览同一套 `.ui-c-fields--compact`；五个数字字段挂 num；上游运行挂 `.ui-c-field--span` 占满整行。`run5-detail-ended/-employee` 的精确文案一字未动（测试 `toBe` 钉死）。
   文件：同上。
4. 问题：事件时间线三内联 span（状态/耗时/时间）零间隔撞成一串；序号/时间不等宽；结果引用长 id `break-words` 半吊子。
   改法：尾部组 `flex-wrap items-baseline gap-x-2`（纯 CSS，文本不变）；`#seq`、状态、耗时挂 `.ui-c-num`；结果引用与 `runs/states.tsx` 请求编号换 `.ui-c-id`（弃 `break-all`）；重试说明块与时间线统一 `.ui-c-section`。
   文件：`web/src/modules/runs/{RunsModulePage,states}.tsx`。
5. 问题（`1575ed31` 补笔）：上游编号行 `gap-0.5/gap-1.5` 非档 + `text-[11px]` 出字阶。
   改法：间距收 `gap-1/gap-2`，短码 `.ui-c-id`，说明 `.ui-c-head-sub`，复制按钮 `.ui-c-field-actions`。
   文件：`RunsModulePage.tsx`（UpstreamLine）、`detail.css`。

### ④ 任务详情（`f7ed0555`）

1. 问题：`DetailField` 标签 `text-[11px]` 出字阶、值与标签同权重；详情卡标题 `truncate` 长 id 看不见、四列硬栅格（sm:grid-cols-2 xl:grid-cols-3）在 ~380px 抽屉里溢出。
   改法：字段换 `.ui-c-field/-label/-value` 统一配方；头部 `.ui-c-head--start`（标题折行、说明 `.ui-c-head-sub`、关闭右上）；dl 换 `.ui-c-fields--compact` 容器查询列数。
   文件：`web/src/modules/tasks/TasksBoardModulePage.tsx`、`detail.css`。
2. 问题：截止时间/成本/创建时间/完成时间/关联任务计数不等宽；任务编号短码 font-mono 硬写。
   改法：五个字段挂 `.ui-c-num`；短码 `.ui-c-id`。
   文件：同上。
3. 问题：说明/进展/状态原因/最近事件四类宽字段与窄字段混排被截半行；最近事件多行挤在 12px 无分隔。
   改法：四个宽字段包装器 `sm:col-span-2 xl:col-span-3` → `.ui-c-field--span`（全列）；事件列表 → `.ui-c-rows/.ui-c-row` + `.ui-c-num`；迁移按钮行 → `.ui-c-section`。字段顺序未动。
   文件：同上。

### ⑤ 视觉复核后的修复（`9cd42679`）

1. 问题（复核 P0 回归）：375 下运行预览区块头标题块被挤成一字符一行——probe 实测标题块 `flex:1 1 0%` 仅 16px 宽，右侧复制入口区 `min-width:auto` 拒缩（285px）。
   改法：新增 `.ui-c-head-text{flex:1 1 14rem;min-width:0}` 替换三处详情头标题块（run5-detail 头、运行预览头、任务详情头）与审批详情头 h2；`.ui-c-head-actions` 加 `min-width:0; justify-content:flex-end`，配合头的 `flex-wrap` 在窄容器整体换行。复测：375 标题块 310px 宽/52px 高，挤压消失。
   文件：`web/src/styles/detail.css`、`runs/RunsModulePage.tsx`、`tasks/TasksBoardModulePage.tsx`、`approvals/views.tsx`。
2. 问题（复核缺陷）：审批右抽屉 ~380px 内字段全单列，详情拉长约 2 倍，批准/驳回按钮跌出首屏折叠线（y≈728→1100）。
   改法：`.ui-c-fields--compact` 容器查询改 21rem→2 列、34rem→3 列（348px 抽屉命中 2 列）；另加 `@media (max-width:40rem)` 强制手机视口回落单列，守住「375 纵向堆叠不横溢」。
   文件：`detail.css`。
3. 复核遗留（未改，次要）：1440 任务详情宽字段占左半、右半留白带（`ui-c-field--span` 生效但卡宽富余）——留白不影响可读性，先记不追。

## 改前/改后截图（同状态：详情已打开）

| 页面 | 改前（现网 100.117.184.117:8183） | 改后（本地 build 经代理注入现网登录态） |
|---|---|---|
| 员工详情 | `before-employees-1440.png` / `before-employees-375.png` | `after-employees-1440.png` / `after-employees-375.png`（build `5333ba2e`） |
| 员工·能力分区 | `before-employees-capability-1440.png` / `-375.png` | `after-employees-capability-1440.png` / `-375.png`（build `1575ed31`；两腿均为空态，见未测项 9） |
| 审批详情 | `before-approvals-1440.png` / `before-approvals-375.png` | `after-approvals-1440.png` / `after-approvals-375.png`（build `9cd42679` 重拍） |
| 运行详情 | `before-runs-1440.png` / `before-runs-375.png` | `after-runs-1440.png` / `after-runs-375.png`（build `9cd42679` 重拍） |
| 任务详情 | `before-tasks-1440.png` / `before-tasks-375.png` | `after-tasks-1440.png` / `after-tasks-375.png`（build `9cd42679` 重拍） |

取图方法学：视口 1440×2600 / 375×3200（壳层内部滚动容器使 fullPage 成 no-op，用加高视口替代），顺序截取，>40KB 非黑屏闸门；改后图数据来自现网真实接口（`/agent-api/api/*` 经本地反代注入 cookie，`/agent-api/api/employees` 200 JSON 为真数据判据）。

## 每笔提交验证（同一口径）

| commit | vite build（VITE_AGENT_CONSOLE_V2=1） | tsc --noEmit | 定向 vitest |
|---|---|---|---|
| `5333ba2e` | exit 0 | 0 行 | employee-detail+employees 10 files/132 ✔ |
| `56780871` | exit 0 | 0 行 | approvals 21 files/239 ✔ |
| `f670361d` | exit 0 | 0 行 | runs 13 files/205 ✔ |
| `f7ed0555` | exit 0 | 0 行 | tasks 2 files/24 ✔ |
| `1575ed31` | exit 0 | 0 行 | runs 13 files/205 ✔ |
| `9cd42679` | exit 0 | 0 行 | runs+approvals+tasks+employee-detail 37 files/530 ✔ |

testid 不变式：每笔提交前跑 `git diff -U0` 前后 `data-testid` 集合对比，全部相等；无新增、无改名、无删除。lefthook pre-commit（eslint）每笔通过（3 条既有 react-hooks warning，0 error）。

## 视觉复核（独立视角，三对 after 图 + probe 实测）

- **A 审批**：无回归；区块头/分隔线/复制右上、数字等宽、长 id 折行、空值「—」合格。缺陷：1440 右栏字段纵排后详情拉长约 2 倍，批准/驳回按钮跌到 y≈1100（原 728，折叠线下）→ 已修（`9cd42679` ⑤-2）。
- **B 运行**：**P0 回归**——375 运行预览区块头标题块被挤成一字符一行（probe 实测 16px 宽，右侧入口区拒缩 285px）→ 已修（`9cd42679` ⑤-1，复测 310px/52px，无横溢）；其余项合格。
- **C 任务**：无回归，两列纵排合格。次要：1440 宽字段右半留白带 → 记为不追（⑤-3）。
- 员工对（前一轮）：无布局回归；「值列 ~285px 起」疑点为复核视口坐标含侧栏+内层导航宽度，排除（卡内标签列=8rem 令牌档）；「总览/概览」双层 Tab 属 `edz-nav`=UI-A 冻结壳层，记越车道；375 分区头与首行标签语义重复保留（分区标题为车道硬性要求）。

## 未改 / 未测项（如实）

1. **375 审批详情锚点问题未修**：QA 基线记录 375 下详情面板被甩到列表末尾、选中行后不可见。改成"行内展开/底部 sticky"属信息架构+交互（功能级），越出表现层车道，未动；建议交 UI-B/产品拍板。
2. **员工详情导航条 `edz-nav`**（`px-3 py-1.5` 非档间距、`rounded-t-[var(--r-sm)]` 6px 不入半径档）：属 UI-A 冻结壳层，改动有越界风险，留 UI-A/UI-QA 议。
3. **运行列表页共享原语未动**：`RunCodeCell`/`CostCell` 的 `gap-1.5/text-[11px]`、`run-source-path` 等列表层 `break-all` —— 它们同时渲染在列表行/筛选条（UI-B 车道），只改了详情独占路径。
4. **列表页问题不属本车道**：「加载更多/已到末页」并存、决策主行动缺席、页级「刷新」位置、employees 表头错位（行级）等基线缺陷，均待列表页车道。
5. **预览面板未加「错误信息」字段**：需改 `runPreview()` 取数（modules 数据层）——越界。错误信息在详情卡「失败原因」与时间线失败节点呈现。
6. **全站测试基线**：`vitest run src` 全量存在 16 files/55 tests 既有失败（chat/capabilities/routed-page-contract 等，均不在本车道 9 个改动文件内；`tool-result.ts:38` 的 unhandled error 亦为既有）。本车道四域定向子集全绿。
7. **未做真机验证**：375 档为 devtools 视口模拟，非实机。
8. **推送状态**：`42180cd6..1575ed31` 五笔已推送 `origin/lane/console-ui-c`；`9cd42679` 与取证 docs 提交在收口时随最后一次 push 上线（仅该分支，无 force/amend/--no-verify）。
9. **能力与权限分区视觉取证只有空态**：补拍的 `before/after-employees-capability-{1440,375}.png` 四张两腿均命中 `ed5-capability-empty`——现网 `/agent-api/api/matrix` 对全部 3 名员工返回 `skillRefs: []`，造 ready 态数据需写库（越车道）。`.ui-c-colhead`/`.ui-c-cell-row` 改造仅由 vitest 132 绿 + 代码审查背书，未经像素验证。
