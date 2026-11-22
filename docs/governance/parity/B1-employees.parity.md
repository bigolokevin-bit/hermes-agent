# B1 对勾表 · employees（数字员工 列表 + 详情）

- **日期**：2026-11-20
- **车道**：B 分包1（employees 列表/详情）
- **口径**：纸面活。A 车道（UI-KD）tokens 冻结前**只交表，不动视觉、不动代码**；本表所有证据行号均为当日实开文件核对（`file:line` + 逐字片段）。口径文件：`docs/governance/UI-QUALITY-UPGRADE.md`。
- **范围注**：audit-status 审批项归 **B 分包2**，不在本表范围。参考件 = 最初的预览 HTML `web/docs/console-v4-skeleton.html`（下称「参考」）；现行 = `web/src/modules/employees/**` + 详情面 `web/src/modules/employee-detail/**` + 员工模块挂载的 matrix tab `web/src/modules/matrix/**`（manifest 将 matrix 注册在 employees 模块下，见 `web/src/modules/employees/manifest.ts:22-31`，参考件的员工筛选/侧板行为也集中在该 pane，故在表内）。
- **严重度**：P0=参考有、现行完全没有或明显回归；P1=现行有但功能残缺/行为不一致；P2=细节差异。

---

## 一、九项对勾表

### 1. 筛选

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 列表·关键字搜索 | `console-v4-skeleton.html:2094` `<input … placeholder="搜索名称、工号、技能">`——**无 id、无监听**（唯一列表筛选逻辑 `applyEmpFilter` :8921-8933 不读它），纯摆设 | `EmployeesModulePage.tsx:762-768` 搜索框 + `:524-527` 300ms 防抖 + `:568` 服务端真参 `keyword=` + `:544-546` 回写 URL；护栏 `employees.filters.test.tsx:140`、`EmployeesRouteMount.test.tsx:123`（?q= 深链真查询、刷新保态） | ✅ 齐平 | —（现行反超参考） |
| 列表·在职态筛选 | `:2096` 状态 `<select>` **同样未接线**（applyEmpFilter 只读 empDept） | `:772-783` `ConsoleSelect` lifecycle + `:569` 服务端真参 `lifecycleState=` + `:503` URL 唯一状态源；`EmployeesRouteMount.test.tsx:105` | ✅ 齐平 | — |
| 列表·部门筛选 | `:2095` `#empDept` + `:2097` `#empFilter` 按钮，`:9119-9120` 绑 `applyEmpFilter`（`:8921-8933`：只演示「创新实验室（空）」→ 空态） | `:785-824` 部门桶按钮（`:631-641` 从已加载行现算、`NONE_DEPT` 兜底 `:56-57`）+ `:642-648` 本地过滤 + `:825-831` 口径条（明说「本地过滤，不发新请求」）+ `:932-944` 部门空卡带清空 | ✅ 齐平 | — |
| matrix tab·四联筛选（搜索/部门/状态/只看缺口 + 清除） | `:2326` `#capQ`、`:2335` `#capDept`、`:2336-2341` `#capStatus`、`:2327/:2342` 两个缺口 checkbox、`:2349` `#capClear`；全部真接线：`:7267-7272`（q input / dept change）、`:7273-7296`（status/gap 联动两 checkbox）、`:6967-6981` `capFiltered()` 四条件过滤、`:7299-7308` capClear 一键复位 | `MatrixModulePage.tsx` 全文**无任何搜索/部门/状态/缺口筛选**——仅 `:70-71` `?view=people/resource` 视角切换（`:146-151` setView） | ❌ 缺失 | **P0**：参考在 employees 模块 matrix pane 完整布线的 4 个筛选控件 + 缺口开关 + 清除，现行 matrix 一个都没有；「查覆盖缺口」是参考该页的主任务 |

### 2. 排序

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 列表·列头排序 | `:2111-2117` 静态 `<thead>`（员工/部门/可上岗/主模型/技能/预算/近7天/成功率），**无排序监听**（全文档无针对该表头的 sort 代码） | `:605-630` 四列本地循环排序（name/code/state/time）+ `:610-617` sort/dir 进 URL + `:120-160` `SortHeader`：真 `<button>`（Enter/Space 原生）、`:141` `aria-sort`、`:149` 焦点环 + `:957-963` 本地排序口径条（附实测证据：后台 sort 参数被忽略）；护栏 `employees.sort.test.tsx:186/206/220/240`（屏上=复制=CSV 逐字同序、排序零重取、缺失值两向都末位） | ✅ 齐平 | —（现行反超参考） |
| matrix tab·「缺口降序」默认排序 | `:6979` `rows.sort(function (a, b) { return b.missRatio - a.missRatio \|\| b.miss - a.miss \|\| a.name.localeCompare(b.name); })`；`:6997` meta 文案逐字 `+ ' 人 · 缺口降序'` | `MatrixModulePage.tsx:141-144` 直接渲 `buildMatrixView(payload, view)`；`matrix.ts` grep `sort` 仅命中注释（:14、:82），无排序实现，行序=payload 原序 | ❌ 缺失 | **P1**：参考按缺口严重度置顶的排序语义未搬，现行组织级「先看最缺的」这条阅读路径丢失 |

### 3. 分页

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 列表·分页 | `:2099` `#empCount` 与 `:2310` `#empFoot` 静态「18 条 · 第 1/1 页」单页文案（`:8928` 仅演示切为「0 条 · 无匹配」）；无翻页控件 | `:49` `PAGE_SIZE=50` + `:563-589` 首屏 + `:656-684` `loadMore()` 带服务端 `cursor=`（`:665`）续页、`:671-672` 按 employeeId 去重 + `:1076-1116` 分页条常驻：计数三态文案（`:1088-1092`「总数不可用 · 已显示 N 人」不假造 total）、`:1094-1112` 加载更多 disabled+原因（`:654` moreDisabled、`:1103-1109` 三档 title）、`:1113-1115` 「已到末页」；护栏 `employees.paging.test.tsx:155`（去重追加+末页如实）、`:175`（第二页失败不丢已载行、重试不带脏游标）、`employees.error.test.tsx:173`（连点不堆请求） | ✅ 齐平 | —（现行以真游标续页覆盖参考的静态「第 1/1 页」；matrix 两边均无分页，不列缺项） |

### 4. 批量

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 员工多选 + 批量操作 | employees 列表与 matrix **均无 checkbox 列、无批量动作**（`:2109-2300` 行内无复选框；「批量通过/批量操作」在审批模块 `:3322/:3408`，不属员工页） | 同样无行级多选；面级替代：`:375-425` 复制列表（屏上行序逐字，`:403` 范围口径「当前已加载 N 人，不是全量」）+ `:456-494` 导出 CSV（`:440-454` 同屏同源行序）；护栏 `employees.export.test.tsx:241`（CSV=表体=复制 三源同行数）、`:264`（?lifecycle= 深链下导出=屏上） | ✅ 齐平 | —（参考即无批量，不判缺项；若日后做批量，需先出参考版式） |
| 列表头操作位（导入 / 新建员工） | `:2090` `data-acts="导入\|ghost;新建员工\|pri"`；`:6643-6648` 无后端写动作统一转 `aria-disabled` + `data-planned="规划中：后端写接口未就绪"`，`:8907-8914` 点击拦截只出 toast | `:707-714` 头部动作区只有 复制列表/导出 CSV/刷新；全文件 grep 「新建员工/导入」→ 0 命中，操作位本身不渲染 | ⚠️ 部分 | **P1**：参考保留的写动作占位（禁用态+原因话术）在现行完全缺席；功能损失小（参考本身也是规划中），但「这页将来能干什么」的入口可见性丢失 |

### 5. 深链

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 详情路由 + zone 直达 | `:2119` `tr data-href="#/employees/emp_001"` ×18 行；`:8187-8190` 行点击 → `location.hash`；`:6575-6579` parseHash 对 employees+id 特判进 detail、`:6587-6589` zone 白名单；`:6593-6601` hashFor（detail 不重复写 tab 参数）；`:8291` `#/employees/emp_004?zone=config`；`:7799-7803` zstrip 五区按钮 → `go('employees', id, 'detail', zone)` | 列表行整链即入口 `:988` `Link to={/employees/{id}}`；路由合同 `web/src/shell/routes.ts:201-202`（`hash:'#/employees/:employeeId'` ↔ `path:'/employees/:employeeId'`）；详情 `EmployeeDetailModulePage.tsx:1005` `zone = mapShellZone(sp.get("zone"))`、`:345-374` 词表映射（`:360-361` 参考的 `zone=config` 兼容落到 capability）；护栏 `EmployeeDetailModulePage.test.tsx:523`（href 含 `?zone=capability`）、`:527`（?zone= 直达各区面板） | ✅ 齐平 | — |
| 列表筛选深链 + 刷新保态 | 列表筛选不进 URL（`:8921-8933` 直改 DOM）；matrix 用 sessionStorage 复原（`:7229-7231` capSaveView / `:7233-7238` 载入复原） | `:497-506` q/lifecycle/dept/sort/dir/state/rid 全部以 URL 为唯一状态源；`:530-533` 回退/分享链接回填控件；护栏 `employees.filters.test.tsx:140`（深链回填双控件+query 逐字）、`:200`（同 URL 重挂复原）、`:234`（未知 `?status=` 原样留在 URL 且渲诚实空态） | ✅ 齐平 | —（现行 URL 化优于参考的 sessionStorage） |
| 浏览器前进/后退 | `:6604-6608` `go()` 赋 `location.hash` 每跳入历史；capPanel `:7326-7331/:7333-7338` `history.pushState`、关闭 `:7310-7313` `history.back()`、`:7342-7349` popstate 收板 | 路由级后退可用：详情返回 `:1074-1082` `navigate(-1)`（`title="返回上一页（保留列表筛选条件）"`），护栏 `EmployeeDetailModulePage.test.tsx:734`（真实历史 + 列表 query 原样保留）；但列表**筛选写入走 `:541` `setParams(draft, { replace: true })`**——筛选/排序/部门每变一步不产生历史条目，「后退撤销上一步筛选」不可用 | ⚠️ 部分 | **P2**：筛选粒度无 back/forward（replace 策略是有意不刷历史，但与参考「每跳一条历史」的行为不一致，需在口径上明示裁决） |
| matrix 行钻取侧板（capPanel） | `:2372-2378` `<aside id="capPanel">` 侧板骨架；`:7002` `tr data-cap-emp` + `:7325-7331` 点击开板（按员工列绑定名单，`:7149-7162`）；`:7333-7339` 资源行→「绑定的全部员工」分组板（`:7200-7212` 在岗/受限/停用三组） | `MatrixModulePage.tsx:391-392` 员工名是 `Link to={/employees/{key}}`——直接跳整页详情（由 `EmployeeDetailModulePage.tsx` 承载五区）；无并排侧板形态、无 pushState/popstate「后退关板」接线；资源视角行跳 `/capabilities` 而非板内员工清单 | ⚠️ 部分 | **P1**：钻取能力有替代路径（整页详情），但参考的板形态 + 历史接线 + 资源→绑定人清单未搬 |

### 6. 空态

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 列表空态 + 清除出口 | `:2302-2306` `#empEmpty`「暂无匹配结果 / 该部门目前没有数字员工」+ `:2305` `#empClear` 清空筛选；matrix `:2348-2349` `#capEmpty`「该筛选下没有员工」+ `#capClear`（`:7299-7308` 全量复位）；`:6996` `empty.hidden = rows.length > 0` | `:906-930` 空态两分式：有筛选→「没有匹配的员工」+清除钮（`:914-927`），无筛选→「还没有数字员工」（`:912`）；计数位空态不假 0（`:359-373` `phaseReason`「真实空集…不是缺数」）；`:932-944` 部门空卡（附已加载 N 人口径 + 清空部门）；护栏 `employees.empty.test.tsx:160`（一屏一老实矩阵、计数 —、不假 0）、`:193`（清除后恰好一次重查、不带脏 keyword/cursor）、`employees.filters.test.tsx:234`（未知参数落诚实空态） | ✅ 齐平 | — |
| 详情空态 | 详情为静态演示（`:2386-2421` 写死陈可数据），无空态机制 | `:392-398` `ZoneEmpty` 各区通用；护栏 `employees.detail.states.test.tsx:217`（诚实空答只出空卡）、`EmployeeDetailModulePage.test.tsx:233`（空概览带原因、不出白屏）、`:549/:582`（未知 id 404 先回落 matrix 行、借行被拒出诚实 not-found） | ✅ 齐平 | —（现行超出参考，不列缺项） |

### 7. 错误

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 列表加载失败/无权限 | 静态骨架**无失败面**；只在脚注声明数据口径（`:2381-2383`「数据来源…为 Seakoi 增量」）；工具列「未知≠0」用 `:7072` `<span class="unkq" title="未知：接口未接入，不等于 0">?</span>` 表达 | `:233-247` `errorState()`：403/404→denied、其余→error，humanize + requestId；`:884-904` 错误卡（人话标题「员工列表没能加载出来」+ rid 可复制 `:891-895` + 重试 `:896-901`）；`:868-882` denied 卡（不指责用户 + 重试）；`:584` 失败保留已载行不假清空；护栏 `employees.error.test.tsx:124`（500 出人话+rid，空卡绝不同屏）、`employees.filters.test.tsx:234`；`EmployeesRouteMount.test.tsx:133`（403/404 共用一张卡、无路径泄漏） | ✅ 齐平 | —（现行反超参考） |
| matrix/门与缺值诚实性 | `:7072`（未接入≠0） | `MatrixModulePage.tsx:99-123` 404/连不上→样例门 + 「示例数据」角标只由 `payload.origin` 派生（`:100-113` 注释内三条判据）、`:125-128` 403 绝不走样例冒充；现行列表缺字段逐字「该字段未返回」（`:251-253` FIELD_MISSING，与详情身份卡共用一源 `:249-267`） | ✅ 齐平 | — |
| 详情各区错误面 | 无（静态） | 每区独立 error/denied 承载 + rid + 区级重试：`EmployeeDetailModulePage.tsx:1007-1008`（`reload` 按区计数）、`:1010-1039`（仅激活区发请求）；护栏 `employees.detail.states.test.tsx:178`（denied 与空锚互斥）、`:205`（500 落错误锚带 rid、不弹空卡）、`:235`（重试恰好一次新读、逐字恢复）、`:288`（详情腿失败不拖累列表复制/导出） | ✅ 齐平 | — |

### 8. 加载

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 列表加载骨架 | `:2110` `table data-loading="1200"`；`:6517-6548` `demoLoading()`：`:6530-6531` 骨架行数按表体铺满（6-12 行、与真实行同高 36px）、`:6535` `layer.setAttribute('aria-label', '加载中')`、`:6544-6547` 定时撤除；`:7792` 每次路由激活补触发 | `:858-866` loading 骨架（5 行 `animate-pulse`）；`:549-561` `?state=loading` 可强制预览该态；续页「加载中…」文案 `:1111`；详情各区 `:380-389` `ZoneLoading`；matrix `MatrixModulePage.tsx:273` `mtx5-loading aria-busy="true"`；护栏 `EmployeeDetailModulePage.test.tsx:187`（加载=骨架、不出工程话术） | ⚠️ 部分 | **P2**：列表骨架（`:858-866`）与详情 `ZoneLoading`（`:380-389`）**均无 `aria-busy` / 「加载中」无障碍名**（参考 `:6535` 有 aria-label；matrix 页自己已做 aria-busy——同产品内三种做法不一致）；参考骨架行数随表体 6-12 自适应，现行固定 5 行（细节差） |

### 9. 键盘

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 列表行浏览（tab 序/方向键/Enter/Esc） | 列表行 `:2119` `tr` 不可聚焦、仅鼠标点击（`:8187-8190`）；键盘面只有全局快捷键：`:6484-6515` ⌘K/Ctrl+K 与 `/` 开面板、Esc 关层（`:6495-6500`）、`g o` 回总览；面板方向键+Enter `:6457-6466`（:6458-6465） | `:514-522` roving tabindex 设计（行级一个 tab 位）+ `:994` `tabIndex` 归一 + `:997-1021` `↑↓/Home/End` 移焦、`Enter` 行内预览（拦截跳转 `:1012-1015`）、`Esc` 收起并回焦（`:1016-1020`）+ `:969-982` 预览钮自身 Esc；`:964` `role="grid"` + `aria-label="员工列表（方向键浏览行，Enter 展开预览）"`；护栏 `EmployeesModulePage.test.tsx:762`（箭头/Home/End 移 tab 位）、`:792`（Enter 展开不导航、二次 Enter 收起、Esc 回焦断言 `document.activeElement`）、`:393`（Esc refocus 零额外请求） | ✅ 齐平 | —（参考列表行根本不可键盘操作，现行反超） |
| 操作控件可达性（排序/筛选/tabs） | `:1809` `mtabs role="tablist"`、`:6670-6684` tab 按钮原生 `<button>` + `aria-selected`；`:2322` 视角 seg `aria-pressed`；筛选钮无键盘语义增强 | `:120-160` SortHeader：原生 `<button>`（Enter/Space 免费可得）+ `:141` `aria-sort` + `:149` 显式焦点环；部门桶 `:799/:818` `focus-visible:outline`；详情分区 `EmployeeDetailModulePage.tsx:1093-1137/1139-1166` `role=tablist/tab` + `aria-selected` + `:1127` focus-visible 大环（未接线区 `:1104-1118` aria-disabled+原因，不给假入口） | ✅ 齐平 | — |

---

## 二、缺项点名清单（按严重度）

| # | 严重度 | 缺项 | 一句话复现/证据 |
|---|---|---|---|
| 1 | **P0** | matrix tab（能力与权限）四联筛选整套缺失 | 参考 `web/docs/console-v4-skeleton.html:2326/2335/2336/2327/2342/2349` 五个控件 + `:7267-7296` 全接线 + `:6967-6981` 四条件过滤；现行 `web/src/modules/matrix/MatrixModulePage.tsx` 全文只有 `:70-71` view 切换，无搜索框/部门/状态/只看缺口/清除——参考主任务「查覆盖缺口」在现行不可达 |
| 2 | **P1** | matrix「缺口降序」默认排序丢失 | 参考 `:6979`（missRatio→miss→name 三级排序）+ `:6997`（屏上文案「… 人 · 缺口降序」）；现行 matrix 行序=payload 原序（`MatrixModulePage.tsx:141-144`；`matrix.ts` grep sort 零实现命中） |
| 3 | **P1** | matrix 行钻取侧板形态 + 历史接线未搬（capPanel） | 参考 `:2372-2378` 侧板 + `:7325-7349`（pushState 开板 / `:7310-7313` 关闭走 history.back / `:7342-7349` popstate 收板）+ `:7200-7212` 资源→三组绑定员工；现行仅 `:391-392` 行名跳整页详情，板形态、后退关板、资源视角绑定人清单皆无 |
| 4 | **P1** | 列表头「导入 / 新建员工」操作位（含规划中禁用态）缺席 | 参考 `:2090` + `:6643-6648`（写动作统一 aria-disabled + data-planned）+ `:8907-8914`（点击拦为提示 toast）；现行 `EmployeesModulePage.tsx:707-714` 动作区 grep「新建/导入」0 命中 |
| 5 | **P2** | 筛选/排序变更走 replace，不产生历史条目 | 现行 `EmployeesModulePage.tsx:541` `setParams(draft, { replace: true })`；参考每次 `go()` 赋 hash 入栈（`:6604-6608`）——「后退撤销筛选」行为不一致（route 级 back 已由详情验证：`EmployeeDetailModulePage.test.tsx:734`） |
| 6 | **P2** | 列表/详情加载骨架缺无障碍名，同产品内部不一致 | 参考骨架有 `aria-label="加载中"`（`:6535`）且行数 6-12 自适应（`:6530-6531`）；现行 `EmployeesModulePage.tsx:858-866` 与 `EmployeeDetailModulePage.tsx:380-389` 无 aria-busy/label——而 matrix 页自己已有（`MatrixModulePage.tsx:273`） |

**九项之外、同屏观察到（不计入对勾计数，建议 B 分包2 一并裁口径）**：
- 详情头写动作位「用草稿试跑 / 复制一份 / 停用（confirm 流）」参考 `:2389`（规划中禁用占位）；现行详情头仅「返回」（`EmployeeDetailModulePage.tsx:1054-1084`）→ P1。
- 详情「四道门 chips 点看卡在哪」参考 `:2414-2416` + `:9015-9026`（点击 chip 出 gateWhy 说明行）；现行 `EmployeeDetailModulePage.tsx` grep「四道门/gchip」0 渲染命中（仅 lane A 占位件 `EmployeeDetailWorkbench.tsx:12` 注释提到，且该件已被 bridge probe 让位，见 `docs/_artifacts/emp-detail/DONE.md` 交付范围节）→ P1。

---

## 三、取证汇总

- 行统计：✅ 齐平 **15** 行 ｜ ⚠️ 部分 **4** 行（P1×2：批量动作位、capPanel 侧板；P2×2：replace 历史、骨架无障碍名）｜ ❌ 缺失 **2** 行（P0×1：matrix 四联筛选；P1×1：缺口降序）
- 严重度合计：**P0 ×1**（+九项外观察 P1×2）、**P1 ×3**、**P2 ×2**
- 用户口径「bug 多、不如预览」在 employees 面的主要落点：①matrix 四联筛选（P0）②缺口降序（P1）③capPanel 侧板/后退接线（P1）。其余七项现行实现等于或反超参考。

## 取证方法（实跑命令，可逐条复跑）

```bash
# 参考件定位：employees 相关标记与 JS 行为
grep -n "capPeople\|capPeopleTable\|capPanel\|capPanelBody\|am-keys" web/docs/console-v4-skeleton.html
grep -n "empCount\|empDept\|empFilter\|data-loading\|t-emp\|empEmpty\|empFoot" web/docs/console-v4-skeleton.html
grep -n "capQ\|capStatus\|capDept\|capGapOnly\|capSaveView\|CAP_VIEW" web/docs/console-v4-skeleton.html
grep -n "pushState\|popstate\|hashchange\|data-href\|data-goto\|keydown" web/docs/console-v4-skeleton.html
grep -n "批量\|checkbox" web/docs/console-v4-skeleton.html
# 参考件精读段（read 打开）：2086-2429 · 6455-6548 · 6552-6684 · 6891-7033 · 7149-7350 · 7792-7810 · 8156-8193 · 8907-8933 · 9015-9026 · 9119-9126

# 现行实现清单与行为
ls web/src/modules/employees/ web/src/modules/employee-detail/ web/src/modules/matrix/
grep -n "useSearchParams\|setParams\|patchParams\|navigate\|zone" web/src/modules/employees/EmployeesModulePage.tsx web/src/modules/employee-detail/EmployeeDetailModulePage.tsx
grep -n "describe(\|it(" web/src/modules/employees/employees.{filters,sort,paging,export,empty,error,parity}.test.tsx web/src/modules/employees/employees.detail.{states,requests}.test.tsx
grep -n "ArrowDown\|Enter\|Escape\|tabIndex\|focus" web/src/modules/employees/EmployeesModulePage.test.tsx
grep -n "sort\|gap" web/src/modules/matrix/matrix.ts   # 验证 matrix 无排序实现
grep -n "四道门\|新建员工\|导入" web/src/modules/employees/EmployeesModulePage.tsx web/src/modules/employee-detail/EmployeeDetailModulePage.tsx   # 验证缺项 0 命中
cat web/src/modules/employees/employees-density.css web/src/modules/employees/manifest.ts
sed -n '195,205p' web/src/shell/routes.ts   # 详情路由合同 :201-202

# 既往交付记录（只读引用，不作为行号证据源）
sed -n '1,60p' docs/_artifacts/emp-detail/DONE.md
```
