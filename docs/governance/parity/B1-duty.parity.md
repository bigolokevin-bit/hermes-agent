# B1 对勾表 · duty（值班台 / 运营总览 + 用量投影）

- **日期**：2026-11-20
- **车道**：B 分包1（duty 值班台）
- **口径**：纸面活。A 车道（UI-KD）tokens 冻结前**只交表，不动视觉、不动代码**；本表所有证据行号均为当日实开文件核对（`file:line` + 逐字片段）。口径文件：`docs/governance/UI-QUALITY-UPGRADE.md`。
- **范围注**：参考件里「值班台」= `web/docs/console-v4-skeleton.html` 中 `section[data-mod="overview"]` 的 `div.pane[data-tab="duty"]`（`:1840`，`data-tabname="值班台"`），同模块第二张 Tab 是用量投影 `data-tab="usage"`（`:2037`）。现行面 = `web/src/modules/duty/**`，挂在 `/overview` 的两个 live 节点（`web/src/App.tsx:1191-1196`），旧入口 `/duty` 走重定向（`App.tsx:1335`）。audit-status 审批项归 **B 分包2**，不在本表。
- **严重度**：P0=参考有、现行完全没有或明显回归；P1=现行有但功能残缺/行为不一致；P2=细节差异。定义同 `docs/governance/UI-QUALITY-UPGRADE.md:13`。

---

## 一、九项对勾表

### 1. 筛选

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 值班台·时间范围 | duty pane（`:1840-2035`）**一个筛选控件都没有**：该段内 `chip/<select>/<button>/<input>` 只命中 `:1925` 的 `<svg ... role="img">`；窗口写死在卡题「近 14 天运行」`:1921`、「24 小时活跃」`:1951` | `DutyPage.tsx:1033-1045` 四枚原生 button（`role="group" aria-label="时间范围"` + `aria-pressed` + `data-testid="duty-range-<id>"`）+ `dutyRange.ts:22-27` 档位表；换档只重读两条时间腿 `useDutyData.ts:222-247`，晚到的旧窗口应答被丢弃 `:227,244`；护栏 `dutyPage.test.tsx:623`（四钮为真 + 14d 驱动两读）、`:640`（切 7d 每读恰好一次）、`:665`（丢旧窗应答） | ✅ 齐平 | —（现行超出参考。**复核更正**：早前流传的「参考 duty 筛选缺『全部』chip、DutyPage 硬编了一个」两侧都不成立——参考侧 duty 面无任何 chip；现行 4 枚档位 `dutyRange.ts:22-27` 无「全部」，`DutyPage.tsx` 里 5 处「全部」是卡题文案（`:304/326/335/446/734…`），非筛选控件） |
| 用量·统计窗口 | 无筛选：`近 7 天` 表写死 7 行 `:2052-2064` | `UsagePage.tsx:294-306` `usg4-window` + `usage.ts:41-47,57-59`（选 24h/7d/30d 真改 `?days=`）；护栏 `UsagePage.test.tsx:107`（默认 `days=30` 含 `/api/` 段）、`:117-119`（`days=1`/`days=7` 实际发出） | ✅ 齐平 | —（现行超出参考；但窗口值不进 URL，见「5 深链」） |
| 能力矩阵·四联筛选（duty 包内那份实现） | matrix pane 布齐并全接线：`:2326 #capQ`、`:2335 #capDept`、`:2336-2341 #capStatus`、`:2327`+`:2342` 两个缺口 checkbox、`:2349 #capClear`；接线 `:7267-7308`，过滤 `:6967-6981` | 本包 `MatrixView.tsx:151-171`（视角/搜索/只看缺口）+ `:91-100` 过滤——**但这个文件在产品里没有挂载点**：`grep -rn "MatrixView" web/src`（去掉 `modules/matrix` 同名类型）只命中自身、`web/src/modules/duty/index.ts:2` 与 duty 自己的测试；`App.tsx:98-100,1243` 的 matrix tab 挂的是 `@/modules/matrix/MatrixModulePage`，而后者只有 `:70-71,146-151` 的 `?view=` 视角切换（该缺项已在 `B1-employees.parity.md` 第 1 行计 **P0**，本表不重复计数） | ⚠️ 部分 | **P1**：duty 包内这份筛选实现是死代码（用户永远走不到），与真正上线的 matrix 面并存=双份口径；改法二选一：把它挂到某条路由，或随 A 冻结后删除、只保留 employees 表那条 P0 |

### 2. 排序

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 卡内列表顺序 + 顺序口径 | 无排序控件，但**顺序本身在屏上有口径**：待我处理三行按等待时长降序 `:2015-2017`（`2h 51m`/`1h 12m`/`41m`）+ 页脚 `:2019`「最早 09:41 起」；阻塞三行按 失败→超时→滞后 `:1983-2005`；最近运行「最近 6 次」`:2031` | 无排序控件、无顺序口径句：待我处理与最近运行直接吃服务端顺序再截断（`DutyPage.tsx:799`、`:836`；`workbench.ts:157-169` queueApprovals 原序透传）；阻塞顺序=按来源拼接（失败运行→阻塞任务→待审 `aggregate.ts:284-327`），与超时严重度无关；`dutyNotes.ts:53-57` 只交代「同一批」不交代排序 | ⚠️ 部分 | **P2**：「等最久的在最前」这条阅读路径既不落实也不声明，值班人可能把第 3 行当成最不重要的。改法：pending 卡按 `waitingSince` 升序（缺值末位）+ 卡脚一句排序口径 |
| 可上岗·最窄门置顶 | `:1857` 最窄门单独标 `<span class="gtag">最窄</span>` + `:1859` 交集句「最窄门：审批 · 6 人未达」 | `aggregate.ts:90` `failing.sort((a, b) => (b.fail ?? 0) - (a.fail ?? 0))[0]` 现算最窄；`DutyPage.tsx:257` `is-narrow` 类 + `:331` `narrowest` 判定；`:327` 屏上句「通过人数最少的一项：…」 | ✅ 齐平 | —（参考写死、现行算出来，语义等价） |

### 3. 分页

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 三张列表卡·截断 + 「查看全部」带总数 | 每卡 3 行 + 计数出口：`:1979` `查看全部 (4) →`、`:2012` `查看全部 (16) →`、`:2024` `查看全部 →`；并额外披露被截断的那条是什么 `:2007`「查看全部含第 4 条：素材库去重 · 缺表格能力（任务看板）」 | 同样 3 行截断（`DutyPage.tsx:386`、`:799`、`:836`；`aggregate.ts:328` `out.slice(0, 3)`），但出口文案**不带计数**（`:734`、`:780`、`:820` 只有「查看全部」），也没有「第 N 条未列出」的披露；更糟的是 `:733` 的 `title` 写「阻塞项已在本卡逐条列出」，而三条阻塞源各自 `limit=3`（`useDutyData.ts:110-113`）后再 `slice(0,3)`——多于 3 项时这句话是假的 | ⚠️ 部分 | **P2**：总数丢失 + 一句失真口径。改法：`查看全部 (N)` 用 `stats`/`total` 现算（`queueStats` 已有 `total`，`workbench.ts:175-185`），并把 `:733` 的「已在本卡逐条列出」改成「本卡最多列 3 条」 |
| 可上岗·分母（超一页时不假造） | 18 名全量在单份 `EMP` 数据里（`:5297+`），卡面「18 名 · 四门取交集」`:1848` | `api.ts:53` `/employees?limit=100` 单页；缺分页时的护栏：`aggregate.ts:66-70` 当 `employees.length < total` 直接把 V6 降级为 `unknown`（屏上「待核实」`:266`），`DutyPage.tsx:313` hint 明说「缺分页之外的完整名单（翻页时 total 为 null）」与不换读口的理由 | ✅ 齐平 | —（>100 人时宁可不给数，也不算错；现行超出参考） |

### 4. 批量

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 页头动作位（刷新 / 导出日报） | `:1843` `data-acts="刷新\|ghost;导出日报\|pri"`——两个动作都在；`:6641-6649` 把没有后端 goto 的动作统一转 `aria-disabled="true"` + `data-planned="规划中：后端写接口未就绪"`，`:1270-1276` hover/focus 出原因话术 | `grep -rn "导出\|日报" web/src/modules/duty/` → **0 命中**。页头只有时间范围组 + 刷新（`DutyPage.tsx:1032-1060`）；刷新是真接线的（`useDutyData.ts:249-275`，护栏 `dutyPage.test.tsx:272/307`），所以**参考侧那个禁用占位反而不如现行**——但「导出日报」这个动作位在现行连占位都没有 | ❌ 缺失 | **P1**：功能损失小（参考侧本身不可点），但「这页将来能出日报」的入口可见性与规划中话术丢失。改法：页头补「导出日报」禁用态 + `data-planned` 同形制（与 `B1-employees.parity.md` 第 4 项同口径） |
| 行级多选 / 批量操作 | duty pane 内**无** checkbox、无批量动作（全文 `批量` 4 处命中都在审批/技能面，如 `:3322 data-acts="批量通过\|ghost;…"`，属 B 分包2） | 同样没有：`grep -rn "批量" web/src/modules/duty/` → 0；本包唯一 checkbox 在不可达的 `MatrixView.tsx:168`（只看有缺口） | ✅ 齐平 | —（参考即无，不判缺项） |

### 5. 深链

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 挂载读参数 / 变更写地址 | `parseHash` 读 `?tab/?zone/?event` `:6552-6590`；`hashFor` 序列化 `:6593-6601`；`go()` 赋 hash `:6604-6608`；`route()` `:7680` + `hashchange` 监听 `:8193`；无 hash 冷启时 `history.replaceState(null,'','#/overview')` `:9241-9247` | `DutyPage.tsx:930-932` `parseDutyRange(params.get("range"))` 读、`:934-939` 写回（默认值时删除参数 `:936`）；外层 `?tab=` 由壳层承担：`console.tsx:517-521` 读 `sp.get("tab")` + `resolveTab`、`:568` 挂 `ConsoleTabStrip`、`:479-493` 每个 Tab 是 `NavLink`（`pathFor`+`linkSearch`，`:482-483` `role="tab"`/`aria-selected`）；`/metrics → /overview?tab=usage` 兼容行 `shell/routes.ts:268`；护栏 `dutyPage.test.tsx:602`（贴链接复原 30d + 选 14d 后参数被清）、`dutyRedirect.test.tsx:43-59` | ✅ 齐平 | — |
| 前进/后退 | 每次状态变更都入历史：`go()` 赋 `location.hash`（`:6604-6608`），Tab 点击即 `go(...)`（`:6686`），后退可回上一视图；`capPanel` 用 `history.pushState`/`history.back()`/`popstate` 收放板（`:7312` back、`:7328`+`:7336` pushState、`:7342-7349` popstate） | 卡内钻取与 Tab 走 `Link`/`NavLink`（入历史）；但**时间范围变更走 `setParams(query, { replace: true })`（`DutyPage.tsx:938`）**——换 24h/7d/14d/30d 不产生历史条目，后退一步直接离开值班台。测试只断言地址与回填（`dutyPage.test.tsx:602-621`），未覆盖后退语义 | ⚠️ 部分 | **P2**：与参考「每变一步可后退」不一致（replace 是有意不刷历史，需 L0 裁一句口径）。同因同口径见 `B1-employees.parity.md` 第 5 项 |
| 坏参数回落 / 重定向保真 | 未识别模块 `if (!MODULES[mod]) mod = 'overview'` `:6571`；别名命中后 **改写地址** `history.replaceState(... hashFor(...))` `:7682-7686`（`ALIAS.metrics → overview?tab=usage` `:5277`）；未识别 tab 回落首个 pane `:7719-7723`（地址不改写） | `dutyRange.ts:32-34` 未识别值回落 `14d`，但**地址保留脏值**（`DutyPage.tsx:931` 只读不写）→ `/overview?range=99d` 屏上是 14 天、地址仍写 99d，转发出去与所见不符。旧入口重定向已做实：`dutyRedirect.tsx:20-33`（`window\|range → range`、`14d → 30d`、不认识的 `view/groupBy/q` 一律不带）+ `App.tsx:1335`，护栏 `dutyRedirect.test.tsx:43-59`；既往取证与授权记录 `docs/_artifacts/ui2/DUTY-REDIRECT-GAP.md:72-91` | ⚠️ 部分 | **P2**：缺「回落即改写」这一步（参考对别名做了 replaceState）。改法：`parseDutyRange` 命中默认值且参数存在时，`replace` 掉 `?range=` |
| 卡头/链跳出口 | 三格链跳全是 `a[href]`：`:1902 #/approvals?tab=release`、`:1907 #/channels?tab=send`、`:1912 #/models?tab=ledger`（每格还带 title 摘要）；卡头出口同样带子页锚点：`:1873 #/work?tab=runs`、`:1887 #/models?tab=ledger`、`:1979 #/work?tab=tasks` | 卡级 6 条出口存在且被逐个钉住（`dutyPage.test.tsx:800-821`：`/employees`、`/runs`、`/runs`、`/metrics`、`/approvals`、`/work`；渲染点 `DutyPage.tsx:308/368/434/733/779/819`）；**但 `chainstrip` 那一排整块失去锚点**：`HealthStrip`（`:853-889`）是 `<div class="duty-health">` + 三个 `<div>`，一个 `<Link>` 都没有，发布/出站两格写死「待核实」`:865/:869`，账本格错误时也只给文字 `:886` | ⚠️ 部分 | **P1**：参考把「从值班台一跳直达发布门/出站/账本」当这页的主导航；现行三格只剩状态词，账本读取失败时连出口都没有。改法：三格改回锚点（未接入的给 `?state=` 或 disabled + 原因，不给死文本） |
| 行级钻取落点 | 行出口全部指向**存在**的视图：运行行 `:1988 href="#/work?tab=runs"`、审批行 `:1996 href="#/approvals"`、滞后行 `:2004 href="#/audit?tab=health"`；员工行 `:2119 tr data-href="#/employees/emp_001"` + `:8187-8190` 点击换 hash | `DutyPage.tsx:389` 与 `:838` 的运行行链是 `to={`/runs/${runId}`}`，`aggregate.ts:325` 阻塞审批行 href 是 `/approvals/${approvalId}`——**这两类路由都没注册**：`grep -n 'path="/runs/:\|path="/approvals/:' web/src/App.tsx` → 0，`BUILTIN_ROUTES_CORE` 只有整页 `"/runs"`、`"/approvals"`（`App.tsx:340-341`）；未匹配路径落 `path="*"` → `UnknownRouteFallback` → `<Navigate to="/overview" replace />`（`App.tsx:272-280,1414-1419`）。即**在值班台点任意一条运行/审批行 = 被静默弹回值班台**。同仓两处自证形制应为 query：`web/src/modules/runs/RunsModulePage.tsx:1210-1214`（自己的行链发 `/runs/?run=<id>`）+ `:1021-1025`（注释：`/runs/<runId>` 是"等 shell 注册那天"才读的兼容路径）+ `web/src/modules/employee-detail/EmployeeDetailModulePage.tsx:1681`（「本代次无 /approvals/:id 详情路由」）；`web/src/modules/approvals/ApprovalsPendingModulePage.tsx:79` 取的是 `params.get("id")` | ❌ 缺失 | **P0**：参考的行出口可达，现行的行出口 100% 回落——「点了没反应、不如预览」最直接的一条。改法（duty 写域内两行级改动）：`:389/:838` 改 `/runs/?run=<id>`，`aggregate.ts:325` 改 `/approvals?id=<id>`；同类扩散点 `modules/overview/OverviewPage.tsx:232` 一并修。护栏测试需覆盖**行级** href（现有 `dutyPage.test.tsx:800-821` 只测卡级） |

### 6. 空态

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 卡级空态（含下一步动作） | duty pane 是静态稿、无空态；但参考在别处立了形制：`:2302-2306` `<div class="empty"><b>暂无匹配结果</b><span>…换一个部门，或清空筛选</span><button …id="empClear">清空筛选</button></div>`、`:2348` `#capEmpty` | `StateLine` 空态分支 `DutyPage.tsx:135-147`（文案 + 可选出口链接）；实际用到：阻塞 `:743-751`、最近运行 `:826-833`、趋势表体 `:611-630`（空表 + 单一主操作「重新读取」，且注释写明"区间是观察窗口不是筛选，没有清筛选可落"）、用量 `EmptyPanel :189-224`（「这个窗口里没有用量记录…不代表读取失败」+ 下一步）、matrix `:192-207`；护栏 `dutyPage.test.tsx:561`（窗口空仍出空表、不求和成 0） | ✅ 齐平 | —（现行超出参考；形制与参考的「标题+一句说明+一个动作」一致） |
| 「读到空」与「没读到」必须分开 | 参考不区分（静态）；现行自己的口径要求区分：`dutyNotes.ts:50`「接口没返回时显示「—」与说明，不用空列表冒充「没有运行」」 | `DutyPage.tsx:384-398`：只有 `runs.k === "ready" && runs.data.length > 0` 才列行，否则**统一**出「最近运行明细尚未返回，合计仍以服务端为准。」→ 读取成功且确实为空时也报"尚未返回"；活跃卡同形 `:650-652`（`view.peak === null` 一律写「活动数据未返回」，而 `aggregate.ts:259-274` 对"回了 cells 但全为 null"同样回 null）。对照：待我处理卡做对了（`:790-796` 把 `pending === null` 与 `rows.length === 0` 分两句） | ⚠️ 部分 | **P1**：违反本模块自定口径，把"没跑"和"没接"糊成一句——值班人据此会去查接口而不是查业务。改法：照 `:790-796` 的形状给两卡补 `state.k === "ready" && length === 0` 分支 |
| 空态可复现性（`?state=empty`） | 参考无该机制：`grep -n "state=" web/docs/console-v4-skeleton.html` → 0 | `DutyPage.tsx:947-950` 取 `window.location.hash` 里的 `state=`，但 app 是 `BrowserRouter`（`main.tsx:2,22`）→ `/overview?state=empty` 的值在 search 不在 hash；且壳层更早拦一刀：`ConsolePane` 见 `forced !== null` 就渲通用 `StateBlock`（`console.tsx:361-362`，`usePaneForced :108-116`），故 `DutyPage.tsx:951-982` 三块自写状态页**在生产路径不可达**（`grep -n "state=" web/src/modules/duty/dutyPage.test.tsx` → 0：连测试都没走这条路）。用量页用 search 取（`UsagePage.tsx:284-285`），其测试 `UsagePage.test.tsx:279-296` 直接挂 `UsagePage`、绕过壳层 | ⚠️ 部分 | **P2**：三块自写状态页 + 其 GAP 话术是纸面资产，线上取不到。改法：`forced` 改读 `useSearchParams`，并由 L0 裁「live 面是否豁免壳层 StateBlock」 |

### 7. 错误

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 失败面（人话 + rid + 重试） | 无卡级失败面（静态稿）；全站只有只读审计员 403：`:1819-1831`（`403 · FORBIDDEN` + `req_9f21c4d0 · 14:32:08 · policy_snapshot ps_8842` + `:1828-1829` 返回上一页/退出预览），触发点 `:7690-7700` | `StateLine` 错误分支 `DutyPage.tsx:102-133`（`role="alert"` + 人话标题 + rid 可复制 `:54-73` + 技术详情折叠 `:119-122` + 卡内唯一实心主操作「重试」）；刷新腿独立：`:1090-1112`（保旧数 + 详情 + rid + 「再试」）；matrix 把 404 单独叫「未接入」`MatrixView.tsx:71-75,134-147`；用量 403/404 同形且不画数据行 `UsagePage.tsx:266-281`；文案表 `api.ts:40-50`；护栏 `dutyPage.test.tsx:230`（rid+重试）、`:346`（刷新失败保旧数、就地再试）、`:576`（趋势源挂→四个破折号+原因）、`UsagePage.test.tsx:248` | ✅ 齐平 | —（现行超出参考：参考只有整页 403） |
| 失败期控件闸门一致 | 一个开关统一禁用可写控件：`applyRo()` `:8857-8866`（`if (roView) el.setAttribute('aria-disabled','true')`）+ 规划中样式 `:1264-1288` | 一处派生四闸：`dutyGates.ts:37-66`（refresh/retry/copy/link，每闸带一句"为什么现在不行"），页面 context 下发 `DutyPage.tsx:51-52,945,987`，各控件各自问闸（`:64` copy、`:126` retry、`:1051` refresh）；护栏 `dutyPage.test.tsx:384`（一张矩阵）、`:407`（首读期 refresh 仍可点）、`:433`（单卡失败仍可 retry+copy）、`:452`（整页失败以 refresh 为唯一出路、扣住 copy）、`:464`（刷新在途时 retry/copy 同因按住 + 连点吞掉） | ✅ 齐平 | —（形制等价，现行更细且有护栏） |

### 8. 加载

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 首屏骨架 + 无障碍名 | `demoLoading()` `:6518-6548`：只作用于 `table[data-loading]`（宿主 `:2110`/`:3262`/`:4668`，**duty pane 内没有表格 → 参考的值班台没有加载态**）；`:6530-6531` 骨架行数按表体 6-12 自适应、`:6535` `layer.setAttribute('aria-label','加载中')`、`:7792` 每次路由补触发 | 每卡独立骨架：`DutyPage.tsx:93-101`（`aria-busy="true"` + `aria-label={loadingText}`，CSS `duty.css:350-365` 三条 pulse）；矩阵 `MatrixView.tsx:174-181`；用量 `LoadingPanel UsagePage.tsx:177-187`（整块 4 张 `animate-pulse` 卡，但**无 `aria-label`**，与 employees 表第 8 项记的 P2 同形制，不重复计数） | ✅ 齐平 | —（duty/矩阵侧无障碍名齐备；用量侧缺名已在他表在册） |
| 刷新期不闪空 + 变化播报 | 无（静态；`自动刷新 30s` 只在任务板 `:3063` 出现，且未接线） | `useDutyData.ts:249-275`：整批读完一次性合屏、旧数保留、版本号丢弃被取消的批次（`:257-259`）；屏上 `DutyPage.tsx:1064-1089`「更新中…（区块先保留上一次读到的数据）」`role="status"` + 完成时刻（明写「读取时刻，不是数据时刻」`:1072`）+ 变化摘要 `aria-live="polite"`（`dutyDelta.ts`，最多 3 项 + 「另有 N 项变化」）；护栏 `dutyPage.test.tsx:272/307/920/942/949` | ✅ 齐平 | —（参考没有的能力，现行有且不刷历史） |
| 采集时刻口径 | 全站只留一个「现在」：`#clock` `:5242` + `SNAPSHOT_TIME = '14:32:08'` `:9234-9238`；卡面「更新 14:32:08」`:2048` | 绝不用本机时间：只认上游 6 个别名里的完整 ISO 串 `DutyPage.tsx:208-230`，缺则「—」并点名缺哪些来源 `:995-1030`、`:232-236`；卡级 stamp `:182-195`（title 交代「来源…；不用本机时间顶替」）；护栏 `dutyPage.test.tsx:143`（卡级 stamp 家族）、`:167`（取最新）、`:183`（全无则破折号点名） | ✅ 齐平 | —（现行把参考的"假时钟"换成真口径 + 缺数点名） |

### 9. 键盘

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 全局检索与快捷键（⌘K / `/` / Esc / `g o`） | 页头有可见入口 `:1802-1805`（`<kbd>⌘K</kbd>`）；`⌘K`/`Ctrl+K` 与 `/` 开面板 `:6486-6507`；面板 `role="dialog" aria-modal="true" aria-label="全局搜索"` `:6440`；方向键+Enter 选择 `:6457-6466`；`Esc` 关面板/确认/抽屉/账号菜单 `:6495-6501`+`:7838`；`g o` 回总览 `:6508-6513` | `grep -rn "⌘K" web/src` → **0**；`grep -rn "全局搜索" web/src` → **0**。现存 keydown 全是局部：`App.tsx:871-876`（Esc 关移动端抽屉）、`ConsoleSelect.tsx:164-172`（Esc/↑↓ 开合列表）、`web/src/components/ConfirmDialog.tsx:47`、`web/src/hooks/useModalBehavior.ts:32`；值班台自身零快捷键 | ❌ 缺失 | **P0**：参考把「不开鼠标也能走完全站」摆在页头，现行整仓没有这层。归口是壳层/`App.tsx`（非 duty 写域），需 A 车道或 L0 排期；duty 面能配合的是给 Tab/范围组补 `aria-keyshortcuts` |
| 面内控件键盘可达 | `mtabs role="tablist"` `:1809`；Tab 按钮是原生 `<button>` + `role="tab"` + `aria-selected` `:6671-6688`；视角 seg `role="group" aria-label="视角"` `:2321`。**列表行不可键盘操作**：`tr[data-href]` 只绑 click（`:8187-8190`），全文 `tabindex` 仅 2 处、都服务 tooltip（`:3860`/`:6040`） | range 组 `role="group" aria-label="时间范围"` + 原生 button `aria-pressed` `DutyPage.tsx:1033-1045`；趋势表折叠 `aria-expanded`/`aria-controls` `:576-585`；口径折叠 `:896-906`；刷新 `aria-busy` `:1053`；rid 复制为原生 button `:58-68`；用量窗口走 ConsoleSelect 真键盘（`ConsoleSelect.tsx:164-232`，测试 `UsagePage.test.tsx:53-58` 注释「the same path a keyboard user takes」） | ✅ 齐平 | —（面内控件两边都可聚焦；参考的行钻取本来也不可键盘） |
| 实时播报（live region） | `toast(msg)` `:5529`（快捷键与操作反馈的唯一通道） | 变化摘要 `aria-live="polite"` `DutyPage.tsx:1078`；更新中 `role="status"` `:1066`；错误 `role="alert"` `:107`；骨架 `aria-busy` `:95`；matrix 未接入 `role="status"` `MatrixView.tsx:135` | ✅ 齐平 | —（现行超出参考） |

---

## 二、缺项点名清单（按严重度）

| # | 严重度 | 缺项 | 一句话复现/证据 |
|---|---|---|---|
| 1 | **P0** | 值班台行级钻取链指向**未注册路由**，点击被静默弹回值班台 | `web/src/modules/duty/DutyPage.tsx:389`+`:838`（`to={/runs/${runId}}`）、`aggregate.ts:325`（`/approvals/${approvalId}`）；`grep -n 'path="/runs/:\|path="/approvals/:' web/src/App.tsx` → 0；catch-all `App.tsx:1414-1419` → `:279` `Navigate to="/overview"`。同仓自证：`web/src/modules/runs/RunsModulePage.tsx:1210-1214`（应发 `/runs/?run=`）、`:1021-1025`（注释：路径形「等 shell 注册」）、`web/src/modules/employee-detail/EmployeeDetailModulePage.tsx:1681`（本代次无 /approvals/:id）。参考侧对应出口全部可达：`web/docs/console-v4-skeleton.html:1988/1996/2004/2119`。**改法**：三处链改 query 形制，并给行级 href 补测试 |
| 2 | **P0** | 全局键盘层（⌘K / `/` / Esc 关层 / `g o`）整站缺失 | 参考 `:1802-1805`（页头 `<kbd>⌘K</kbd>` 入口）+ `:6440`（面板 dialog）+ `:6457-6466`（↑↓/Enter）+ `:6486-6513`（⌘K、`/`、Esc、`g o`）；现行 `grep -rn "⌘K" web/src` → 0、`grep -rn "全局搜索" web/src` → 0。**改法**：归壳层（`App.tsx`/`shell`），duty 侧配合加 `aria-keyshortcuts`；建议 A 车道一并裁 |
| 3 | **P1** | 链跳排（发布/出站/账本）整块失去锚点，退化为死文本 | 参考 `:1901-1916` 三个 `<a class="cs" href="#/…">` 带 title 摘要；现行 `DutyPage.tsx:853-889` 是 `<div class="duty-health">` + 3 个 `<div>`，`:865/:869` 写死「待核实」，账本格失败时 `:886` 只给文字无出口。**改法**：三格改 `<Link>`（未接入用 disabled + 原因，不给死文本） |
| 4 | **P1** | 「读到空」被写成「没读到」，违反本模块自定口径 | `DutyPage.tsx:384-398`（ready 且 length=0 仍走 else → 「最近运行明细尚未返回」）、`:650-652` 同形；对照做对的形状在 `:790-796`；口径原文 `dutyNotes.ts:50`。**改法**：两卡补 `state.k === "ready" && length === 0` 分支 |
| 5 | **P1** | 页头「导出日报」动作位（参考的规划中占位形制）缺席 | 参考 `:1843` `data-acts="刷新\|ghost;导出日报\|pri"` + `:6641-6649`（无后端 → `aria-disabled` + `data-planned`）+ `:1270-1276`；现行 `grep -rn "导出\|日报" web/src/modules/duty/` → 0。**改法**：页头补禁用态动作位 + 同形制原因话术 |
| 6 | **P1** | duty 包内 `MatrixView` 整套筛选是死代码（无挂载点） | `MatrixView.tsx:151-171`+`:91-100` 实现了视角/搜索/缺口，但 `grep -rn "MatrixView" web/src`（排除 `modules/matrix` 同名类型）只命中自身、`web/src/modules/duty/index.ts:2`、duty 测试；线上 matrix tab 是 `App.tsx:98-100,1243` 的 `MatrixModulePage`（无筛选，`B1-employees.parity.md` 已计 P0）。**改法**：挂载或删除，别留双份口径 |
| 7 | **P2** | 时间范围变更走 `replace`，不产生历史条目 | `DutyPage.tsx:938` `setParams(query, { replace: true })`；参考每次 `go()` 赋 hash 入栈（`:6604-6608`）。与 employees 表第 5 项同因 |
| 8 | **P2** | 坏参数回落默认值但地址不改写 | `dutyRange.ts:32-34` + `DutyPage.tsx:931`（只读不写）；参考对别名做 `history.replaceState` 归一（`:7682-7686`）。`/overview?range=99d` 屏显 14 天、地址仍写 99d |
| 9 | **P2** | 截断披露丢总数，并有一句失真口径 | 参考 `:1979/2012` 带 `(4)`/`(16)` 且 `:2007` 点名被截断项；现行 `DutyPage.tsx:734/780/820` 无计数，`:733` title 却写「阻塞项已在本卡逐条列出」，而 `useDutyData.ts:110-113`+`aggregate.ts:328` 最多 3 条 |
| 10 | **P2** | `?state=` 三块自写状态页在生产路径不可达 | `DutyPage.tsx:947-950` 读 `window.location.hash`，但 app 为 `BrowserRouter`（`main.tsx:2,22`），值在 search；壳层更早拦：`console.tsx:361-362`+`:108-116`。`grep -n "state=" web/src/modules/duty/dutyPage.test.tsx` → 0（测试也未覆盖这条路） |
| 11 | **P2** | 卡内列表顺序无口径（等最久的不在前） | 参考 `:2015-2017`+`:2019` 用顺序本身表达口径；现行 `DutyPage.tsx:799`/`:836` 原序截 3、`dutyNotes.ts:53-57` 不交代排序；全文 `grep -rn "排序" web/src/modules/duty/` → 0 |

**九项之外、同屏观察到（不计入对勾计数，视觉部分待 A 冻结）**：
- 热力条缺图例/峰值描边/环比：参考 `:1966-1971`（0 · 1–2 · 3–4 · 5+ 四级图例）、`:1959`（`class="hc l3 peak"` 峰值描边）、`:1965`（「较昨日同时段 +6 次（52 → 58）」）、`:1956-1957`（`nowline`/`nowlab 现在 14:32`）；现行 `DutyPage.tsx:653-668` 只有 24 格 + `:669` 一句注，`grep -rn "legend\|nowline" web/src/modules/duty/` → 0，且 `:651` 屏上还写着「虚线之后为尚未发生的时段」而现行**没有任何虚线**（`duty.css:257-275` 只有 `inset` 描边）→ P2（文案与画面不符，需 A 车道定形制；文案侧可先行改口径句）。
- 趋势图缺 y 轴刻度/网格线/峰值点：参考 `:1926-1944`（`60/30/0` 三刻度 + 三条网格线 + 峰值圆点 + 「峰值 58」标签）；现行 `DutyPage.tsx:521-550` 只有一根基线 + 折线 + 首末标签，但补了可读摘要行 `:553-575` 与「以表格查看」`:576-632` → P2（视觉待 A，语义现行反超）。
- 「今日运行」分项恒为破折号：参考 `:1876`「在跑 7 · 今日已运行 15 人」；现行 `workbench.ts:117-129` 只映射 KPI `runs/failed/costUsd`，`running/succeeded` 恒 null → 屏上 `DutyPage.tsx:381` 出「在跑 — · 成功 — · 失败 N」；另成本卡缺「$40 全局上限 / 已用 31% / 月配额 / 浪费」四件套（参考 `:1889-1896`，`grep -rn "上限\|预估" web/src/modules/duty/*.tsx` → 0，`types.ts:121-132` 的 `BudgetItem` 也没有配额字段）→ 属**上游读口缺口**而非代码回归，建议登记 GAP 而不是按 parity 计入 P0。
- 参考件里 `[data-heatgrid="7x24"]` 的 7×24 渲染器无宿主元素：`grep -n "data-heatgrid" web/docs/console-v4-skeleton.html` 只命中 JS `:9183`，标记里没有该属性 → 该锚点在参考内也是死码，本表不作为缺项依据。

---

## 三、取证汇总

- **行统计**：✅ 齐平 **14** 行 ｜ ⚠️ 部分 **8** 行 ｜ ❌ 缺失 **3** 行（共 25 行）
  - 按九项：1 筛选 ✅2/⚠️1 ｜ 2 排序 ✅1/⚠️1 ｜ 3 分页 ✅1/⚠️1 ｜ 4 批量 ✅1/❌1 ｜ 5 深链 ✅1/⚠️3/❌1 ｜ 6 空态 ✅1/⚠️2 ｜ 7 错误 ✅2 ｜ 8 加载 ✅3 ｜ 9 键盘 ✅2/❌1
- **严重度合计**：**P0 ×2**（行级钻取死链、全局键盘层缺失）｜ **P1 ×4**（链跳排失去锚点、空答写成未返回、导出日报占位、MatrixView 死代码）｜ **P2 ×5**（replace 不入历史、坏参数不改写地址、截断不报总数+一句失真话术、`?state=` 不可达、列表顺序无口径）
- **旧结论复核结果**：「参考 duty 筛选缺『全部』chip、DutyPage 硬编了一个」——**不成立，已撤回**（参考侧 duty pane 零筛选控件；现行 `dutyRange.ts:22-27` 四档无「全部」）。`DUTY-REDIRECT-GAP.md` 记载的丢参问题已在 `dutyRedirect.tsx:20-33` + `App.tsx:1335` 修掉并有测试（`dutyRedirect.test.tsx:43-59`）。
- **结论（一句话）**：duty 面在**错误、加载、空态、状态口径**四项上已等齐或反超参考件，"不如预览"的实感集中在**钻取可达性**——行级链 100% 落到未注册路由被弹回（P0#1）、链跳排退化为死文本（P1#3）、整站没有参考页头承诺的 ⌘K 键盘层（P0#2）；这三条都是接线/形制级改动，不需要等 A 车道 tokens 冻结即可排期。

---

## 取证方法（实跑命令，可逐条复跑）

```bash
# ---------- 基准侧：定位值班台与各功能锚 ----------
grep -n -i -E "duty|值班|7x24|workbench|clock" web/docs/console-v4-skeleton.html
grep -n 'class="pane' web/docs/console-v4-skeleton.html                       # duty pane = :1840-2035
awk 'NR>=1840 && NR<=2035' web/docs/console-v4-skeleton.html | grep -n -E "chip|<select|<button|<input|role=|tabindex"
grep -n "data-heatgrid\|heatgrid=" web/docs/console-v4-skeleton.html           # 只有 JS :9183，无宿主
grep -n "data-acts\|规划中：后端写接口未就绪\|data-planned" web/docs/console-v4-skeleton.html | head
grep -n "nowline\|legend mt6\|l3 peak\|较昨日同时段" web/docs/console-v4-skeleton.html
grep -n "function route\|function hashFor\|function go\|hashchange\|replaceState\|parseHash" web/docs/console-v4-skeleton.html
grep -n "function renderTabs\|demoLoading\|aria-label', '加载中'\|function applyRo" web/docs/console-v4-skeleton.html
grep -n "e.key === 'k'\|e.key === '/'\|e.key === 'Escape'\|gPending\|ArrowDown\|role=\"dialog\"\|tabindex" web/docs/console-v4-skeleton.html
for k in 7x24 oncall shift histogram 'role="dialog"' tabindex 'sort(' pushState popstate hashchange location.hash data-acts 批量 筛选; do printf "%s=" "$k"; grep -c -- "$k" web/docs/console-v4-skeleton.html; done
# 参考精读段（read/sed 打开核对）：1802-1843 · 1846-2035 · 2037-2080 · 2119 · 5242 · 6440-6551 · 6552-6700 · 6967-6981 · 7229-7349 · 7680-7800 · 8175-8193 · 8854-8866 · 9183-9250

# ---------- 现行侧：清单 + 行为 ----------
ls -la web/src/modules/duty/
grep -n "useSearchParams\|setParams\|replace: true\|aria-pressed\|aria-expanded\|aria-busy\|aria-live\|role=\"status\"\|role=\"alert\"" web/src/modules/duty/DutyPage.tsx
grep -n "Link to=\|href" web/src/modules/duty/DutyPage.tsx web/src/modules/duty/aggregate.ts
sed -n '15,38p' web/src/modules/duty/dutyRange.ts          # 档位与默认值
sed -n '28,39p' web/src/modules/duty/dutyRedirect.tsx      # /duty 参数保真
sed -n '37,67p' web/src/modules/duty/dutyGates.ts          # 四闸一处派生
sed -n '91,175p;219,275p' web/src/modules/duty/useDutyData.ts
sed -n '110,129p;157,185p' web/src/modules/duty/workbench.ts
sed -n '43,70p;245,275p;277,340p' web/src/modules/duty/aggregate.ts
grep -n "params.get\|setWindowKey\|useState<UsageWindowKey>" web/src/modules/duty/UsagePage.tsx
grep -rn "duty\|overview" web/src/App.tsx | grep -n "path=\|live=\|DutyRedirect\|Unknown"
sed -n '266,280p;1191,1196p;1335,1340p;1404,1419p' web/src/App.tsx
sed -n '108,116p;349,372p;451,495p;525,540p' web/src/shell/console.tsx
sed -n '1021,1032p;1210,1214p' web/src/modules/runs/RunsModulePage.tsx    # 行链正确形制 /runs/?run=
sed -n '1681p' web/src/modules/employee-detail/EmployeeDetailModulePage.tsx
grep -n "describe(\|it(" web/src/modules/duty/dutyPage.test.tsx | head -60
sed -n '599,640p;800,821p' web/src/modules/duty/dutyPage.test.tsx
sed -n '43,59p' web/src/modules/duty/dutyRedirect.test.tsx
grep -n "state=" web/src/modules/duty/UsagePage.test.tsx | head

# ---------- ❌/缺项的「现行侧确实搜不到」证明（每条都应打 0） ----------
grep -rn "导出" web/src/modules/duty/ | wc -l                     # 0
grep -rn "日报" web/src/modules/duty/ | wc -l                     # 0
grep -rn "批量" web/src/modules/duty/ | wc -l                     # 0
grep -rn "排序" web/src/modules/duty/ | wc -l                     # 0
grep -rn "⌘K" web/src | wc -l                                     # 0
grep -rn "全局搜索" web/src | wc -l                                # 0
grep -rn "legend" web/src/modules/duty/ | wc -l                   # 0
grep -rn "nowline" web/src/modules/duty/ | wc -l                  # 0
grep -rn "emptyText=" web/src/modules/duty/ | wc -l               # 0（空态分支无调用点）
grep -n 'path="/runs/:\|path="/approvals/:' web/src/App.tsx | wc -l       # 0（行级详情路由未注册）
grep -n "'/runs/:\|'/approvals/:" web/src/shell/routes.ts | wc -l          # 0
grep -rn "state=" web/src/modules/duty/dutyPage.test.tsx | wc -l           # 0（自写状态页连测试都没走）
grep -rn "MatrixView" web/src --include=*.tsx --include=*.ts | grep -v modules/matrix | grep -v modules/duty | wc -l   # 0（包内 MatrixView 无挂载）

# ---------- 口径与既往件（只读引用，不作行号证据源） ----------
sed -n '1,23p' docs/governance/UI-QUALITY-UPGRADE.md
sed -n '1,96p' docs/_artifacts/ui2/DUTY-REDIRECT-GAP.md
sed -n '1,127p' docs/governance/parity/B1-employees.parity.md      # 体例基准
```
