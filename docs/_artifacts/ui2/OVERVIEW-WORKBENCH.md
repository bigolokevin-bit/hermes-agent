# /overview 改吃 workbench 读模型（2026-11-20）

## 变动的四个读口（BFF 已上线，`a7bccdf`）
| 卡片 | 旧来源 | 新来源 |
|---|---|---|
| 今日运行（统计） | `GET /api/run-stats?from&to` | `GET /api/workbench/summary?range=1d`（KPI `runs`/`failed`/`costUsd`） |
| 近 14 天运行（趋势） | `GET /api/run-stats` 14d 窗口 | `GET /api/workbench/timeseries?range=14d&bucket=day&metric=runs` |
| 待我处理（计数 + 行） | `GET /api/approval-stats` + `GET /api/approvals` | `GET /api/workbench/queue?page_size=100`（一次取数，两张卡同源） |

未动：员工目录、员工统计、24 小时活跃热力（`/run-activity`）、成本账本（`/budget-usage`）、最近运行（`/runs`）、阻塞（`/tasks`）、能力矩阵（仍走 `/matrix` 的未接入态）。

## 口径
- `asOf` 只取响应顶层 ISO-8601（带时区）→ 北京时间到分；缺失或非法显示「—」，`title` 说明，绝不拿本机时钟顶上。
- 缺数字留 `null` → 「—」；`summary` 没有 succeeded/running，不补、不按 0 记。
- `queue` 源不可用时 BFF 返回 200 + `available:false`：计数为 `undefined`（「—」）并透传 reason，不当成空队列。
- `timeseries` 的 `point.value` 为 null 的桶被丢弃，不参与求和；`totals.value` 优先。
- 单口失败只让对应卡片进错误/GAP 态，其余卡片照常（局部可用），不整页白屏。

## 证据
- `vitest run src/modules/duty` → 3 files / 54 passed。
- 全量 `vitest run` → 147 files / 1928 passed（本刀前 1926）。
- `tsc -b . --noEmit` → 本域 0 条（全仓既存基线不变）。
- build `vite build --outDir /tmp/build-ovwb` → EXIT 0；entry `assets/index-De_nG8ln.js` sha256 `46aabeb84ac00b5bd83fcf6552d8ca5ca2e933af66c0c87661d46c31164a0bee`；entry 内 `summary?range=` 命中 0；本页 chunk `assets/DutyPage-CKqhFx4d.js`：`summary?range=`=1、`/agent-api/api/workbench`=1。
- 测试断言：`/run-stats`、`/approval-stats`、`/approvals` 不再被请求；`/workbench/queue` 恰 1 次；`ov6-asof` 显示 workbench `asOf` 的北京时间；`timeseries` 404 时趋势卡「—」而今日运行仍显示 2。

## 未测项
- 四口 200 实例体未在浏览器实测（cookie 已过期，仅按 BFF 源码形状消费；未登录裸打为 401 + rid，证明路由在线）。
- 真实 BFF 局部 `available:false` 与 `degraded` 文案上屏未走查。
- 375/1440 视觉未实机复核（沿用既有栅格与 ov6-* testid 未改）。
## 复用令 B 第二步：剩余区块去 fixture 盘点（2026-11-20）

`git grep -n "fixture|FIXTURE" web/src/modules/duty` + `useDutyData.ts` 现查，六个区块的真实来源：

| 区块 | 当前数据来源 | 定性 |
| --- | --- | --- |
| 员工概览 / 可上岗 | `/api/employees?limit=100` + `/api/employee-stats` | 真数据（BFF 路由 319/425 行） |
| 24 小时活跃热力 | `/api/run-activity?weeks=1&tz=Asia/Shanghai` | 真数据（457 行） |
| 账本（今日成本 / 月累计） | `/api/budget-usage?employeeId=…&periodKind=day|month` | 真数据（464 行） |
| 最近运行 / 失败运行 | `/api/runs?since=…&limit=3[&status=failed]` | 真数据（406 行） |
| 阻塞任务 | `/api/tasks?status=blocked&limit=3` | 真数据（383 行） |
| 矩阵 | `/api/matrix?limit=50` → 域 `/v1/matrix/employees` | 真数据路由已在（server.py 552 行）；`MatrixView` 未挂到 `/overview`，仅由 `modules/duty/index.ts` 导出给测试 |

结论与改动：
- 前五块本波已吃真读口，无需换源；`?state=` 变量名里的 `fixture` 只是复现腿的旧命名，不产生数据。
- 矩阵的 `MATRIX_FIXTURE` 样例行从未被渲染（`MatrixView` 的 404 分支是「未接入」卡，不回落到样例），已删除该常量与 barrel 导出，文件保留 normaliser + `CAP_RESOURCES` 目录；文件头注释改为「无样例行」。
- GAP-06 文案纠正：BFF 转发路由已部署，未接入指的是上游 `/v1/matrix/employees`；`matrix-unwired` 卡 title 与正文同步改写，并新增测试断言「无 `data-fixture` 属性、正文不出现样例」。
- 闸门 V1/V2/V3 仍是 unknown（无读口，按设计不给假值），V6 为负责人推断——不属于夹具。

验证（本单）：`vitest run src/modules/duty` 3 files / 54 passed；全量 147 files / 1928 passed；tsc 本域 0；eslint 0 error / 3 既有 warning；build 见回执（`ov6-asof` entry 0、DutyPage chunk 1）。

## duty/overview 真数据护栏（duty caliber，2026-11-20）

新增 `web/src/modules/duty/duty.caliber.test.ts`（6 例）：六区块只调真接口（`/employee-stats`、`/run-activity`、`/budget-usage`、`/runs`、`/tasks`、`/api/matrix`）且渲染结果中 `MATRIX_FIXTURE` / `data-fixture` / 「样例」零命中；`ov6-*` 锚点 24 枚 + `ov6-gate-*` 逐枚断言保留；asOf 六别名（asOf/as_of/collectedAt/collected_at/generatedAt/generated_at）逐个注入→BJT 到分；非 ISO + 假时钟 2031→「—」且 title 含「不用本机时间顶替」，屏上无 2031；缺 KPI 与 `queue available:false` 均「—」+原因，不补 0；单口 500 只坏成本卡，其余卡照常，失败卡带可复制请求编号与重试。

同单修两处真缺陷（改前/改后）：
1. `asOfOf` 原来只认 4 个别名且接受任意非空字符串；改为六别名 + 带时区 ISO 校验（非 ISO 返回 null）。
2. `PendingCard` 原来在计数缺失（读口失败）时仍说「今天没有待你审批的事」；改为「审批数量没有读出来：<原因>。不当成 0，也不当作空队列。」并用 `ApprovalStatsBody.reason`。

另加 `CopyRid`（`ov6-rid-copy`）：失败卡请求编号可一键复制，`copyTextToClipboard` 成功后按钮显示「已复制」。

## workbench/agents 评估：可上岗卡不换源（2026-11-20）

- 现查：`DutyPage.tsx` 的 `ReadinessCard` 只吃两个读口——`/api/employees?limit=100`（逐行 `employeeId/name/lifecycleState/ownerUserId`）与 `/api/employee-stats`（`byLifecycle.{active,paused,offboarding}` 聚合）。`buildReadiness` 用 `lifecycleTotal` 做分母、`ownerUserId` 推 V6；V1–V3 本就是 unknown。
- `workbench/agents` 实测字段（BFF `server.py` 2366–2396）：`items[{id,name,type,owner,dept,status,lifecycle,lastActive,todayRequests,todayTokens,todayCost}]`、`total`、`available`、`degraded`、顶层 `asOf`。
- 结论：**覆盖不全，按派工走 ②，不硬换**。缺：①`byLifecycle` 聚合计数（agents 只有逐行 `lifecycleState`，无 active/paused/offboarding 汇总）；②分页之外的完整名单（`page_size` 默认 12，`nextCursor` 非空时 `total=null`，不能跨页求和）；③逐行 `today*` 恒 null（BFF 明写无 per-agent 运行/成本口径）。`owner` 可映射 `ownerUserId`，但只解决 V6 一项，不足以替代分母。
- 落地：`HCard` 新增 `hint` 属性（仅 `title` 提示，不上屏），可上岗卡写「workbench/agents 缺 byLifecycle 聚合计数…本卡仍取员工目录 + 员工统计，换成该读口会丢掉总分母，故不换」；`ov6-*` testid 全未改。
- 测试（`duty.caliber.test.ts` 新增 2 例，共 62）：①卡片只打 `/employees` + `/employee-stats`，`/workbench/agents` 零调用，`ov6-ready` 的 title 含「workbench/agents 缺」「本卡仍取」，`data-fixture` 与「样例」零命中；②`/employee-stats` 500（rid `req-ready`）只坏本卡且可重试，今日运行仍 2、待审仍 1。
- 未测：`workbench/agents` 200 实例体（cookie 过期，按 BFF 源码形状评估）；375/1440 未实机。

## 值班台刷新语义（duty refresh，2026-11-20）

- 页首 `duty-refresh` 一次全量重取六区块：employees、employee-stats、workbench summary/timeseries/queue（queue 单请求供计数与前三行）、run-activity、budget-usage day+month、runs×3、tasks——每读口恰一次，测试逐路径与首载计数相等。
- busy：`aria-busy` + `duty-busy-note`「更新中…（区块先保留上一次读到的数据）」；二次点击由同步闸门吞掉（同批 urls 增量只等于一批）。
- 成功：`duty-updated-at`「刷新完成于 北京时间 …（读取时刻，不是数据时刻）」，与各卡 asOf（数据时刻）分开。
- 失败：保留旧批，`duty-refresh-error` 人话 + 请求编号（可复制）+ `duty-refresh-retry`；不写 updated-at；单口失败只坏该卡。
- 批次失效：`cancelRefresh()` 递增版本号，迟到批整批丢弃（不写数据、不写 updated-at）；当前页面无范围/页签切换，卡片重试走 `reload()`（先失效在途批）。
- 验证：duty 4 files / 65 passed；全量 148 files / 1939 passed；tsc 本域 0；eslint 0 error / 3 既有 warning；entry `assets/index-Da4OMXQN.js` sha256 `c52cb60a056bec5e81aa976d45ad9b9905ce1de17b6ce298c0024349012d18ba`（entry 内 marker 0），chunk `DutyPage-CT9bI_bq.js` marker 1。
- 未测：真实浏览器下挂起批与手动刷新交错未走查（jsdom 用单测闸门覆盖）；375/1440 未实机。

## 动作闸门单点化（duty gates，2026-11-20）

- 新增 `web/src/modules/duty/dutyGates.ts`：`dutyGates({loading,refreshing,allFailed})` 一次派生 `{refresh,retry,copy,link}` 四个 `{enabled,title}`，页面通过 `DutyGatesContext` 下发；`CopyRid` 与 `StateLine` 的重试按钮只读这里，各卡不再自带措辞。
- 矩阵：加载中 → 刷新/重试可用、复制禁用（「还在读取，暂时没有可复制的请求编号」）；单口失败 → 刷新与其余卡照常、失败卡 retry/copy 可用；整页全失败 → 刷新仍可用（重取即恢复路径）、逐卡复制禁用（「整页都没有读出来，先重取这一批；编号仍在卡上可见」）；刷新在途 → 刷新可点但 aria-busy（二次点击由 useDutyData 同步吞掉），retry/copy 统一禁用且 title 以「更新中」开头。
- 链接只做导航，恒可用（`link.enabled` 恒 true），不因失败或忙态阻断。空集不当不可用：复制只在有请求编号时可点，0 行数据不参与闸门。
- 测试：`dutyPage.test.tsx` 新增 describe 5 例（纯函数四态矩阵 + 首读中刷新可点 + 单口失败局部可用 + 全失败复制禁用 + busy 二次点击被吞且 retry/copy 带同一原因）。定向 4 files / 70 passed；全量 148 files / 1944 passed；tsc 本域 0；eslint 0 error / 3 既有 warning；build entry `assets/index-B2ll4AVq.js` sha256 `df60d45b7922ab73daaafe7f78cb828cee2ac8e2d0e108d52290961ddc0fd140`，entry 内 `duty-gates-scope`=0，`DutyPage-*.js` 命中 1。
- 未测：真实浏览器 busy 期间键盘操作未走查；375/1440 未实机。

## 趋势卡可访问性替代（duty trend，2026-11-20）

- 图：`duty-trend-figure`（svg）加 `role="img"` 与 `aria-describedby="duty-trend-summary"`；摘要与图同源，全部由当前 `timeseries` 批次派生：首日/末日/峰值/最低/合计，逐值等于表体与卡上总数。
- 表：`duty-trend-table-toggle` 为原生 button（`aria-expanded`/`aria-controls="duty-trend-table"`），展开后表格带 caption「近 14 天每日运行次数（北京时间）」与两个 `th scope="col"`；展开与收起不发任何请求（测试断言 urls() 不变）。
- 空窗：摘要逐字「该区间没有运行记录」，仍可展开表格，表体零行并写「该区间没有运行记录，表体没有可列出的行。」——不把空集合当 0 相加。
- 单口失败：摘要五项全「—」，title 写失败原因与请求编号，并声明「不把缺数当 0」；其余卡片不受影响。
- 测试：新增 4 例（摘要同源、键盘展开零请求、空窗、单口失败）；定向 4 files/74 passed，全量 148 files/1948 passed；tsc 本域 0；eslint 0 error/3 既有 warning。
- 未测：真实浏览器 Tab/Enter 走查与 375/1440 视觉未实机。

## 趋势/汇总聚合护栏（duty aggregate，2026-11-20）

新增 `web/src/modules/duty/duty.aggregate.test.ts`（8 例，纯测试为主）：摘要五项由当前 timeseries 批派生并与表体逐行求和一致（1/2/14 桶三形）；空批与全 null 批走「该区间没有运行记录」且表体零行，不把空当 0；缺值点保留轴位、不进峰值/最低/合计，表体该行写「—」；`queue available:false` 的待审计数不进任何求和、显示「—」+原因；单口失败只坏对应卡（run-activity 失败不影响趋势；timeseries 失败才五项全「—」+原因与请求编号）；asOf 六别名→北京时间到分，假时钟 2031 不上屏。

同单修出的两处真缺陷（改前/改后）：
1. `aggregate.dailyBuckets` 原把缺失读数 `num(b.runs) ?? 0` 补成 0，`trendSummary` 再按 0 求和 → 现 `runs: number | null`：缺值不进峰值/最低/合计，轴位保留，表体写「—」；全 null 批与空批同走「没有运行记录」。
2. `workbench.readStamp` 原只认顶层 `asOf` → 现认六个别名（`asOf/as_of/collectedAt/collected_at/generatedAt/generated_at`），与页面 `asOfOf` 口径一致。

既有 dutyPage 趋势用例同步两处期望：末日改为「11/19 —」（缺值桶保留轴位），展开表 3 行；非放宽，语义收紧。

验证：`vitest run src/modules/duty` 5 files / 82 passed（基线 74）；全量 149 files / 1956 passed（基线 1948）；`tsc` 本域 0；`eslint src/modules/duty` 0 error / 3 既有 warning；build `--outDir /tmp/build-dutyagg` exit 0，entry `assets/index-DfKOIw-B.js` sha256 `f57cc84c2c6df1a74f95a9cf0a74e9fa3d613638b67dd0fa46c36084943bd62e`，entry 内 `duty-trend-table-toggle`=0，chunk `DutyPage-tloxPclH.js`=1。

未测：真实 BFF null 点/全 null 批分布未抽样；375/1440 实机未复核。

## 时间范围切换（duty range，2026-11-20）

- 四个真按钮 `duty-range-24h|7d|14d|30d`，`aria-pressed` 标选中；URL `?range=` 为单一事实源（默认 14d 时省略该键，粘链可复现）。默认沿用页面既有的 14 天口径。
- 一个范围 id 同时驱动两条时间读口：`workbench/timeseries?range=<1d|7d|14d|30d>` 与 `/run-activity?weeks=<1|1|2|4>`，两卡不会出现不同窗口。趋势卡标题、摘要、图 aria、表 caption 随范围改口（默认「近 14 天运行」），活跃卡标题同步为「近 N 天活跃」。
- 切换只重取这两条读口各一次；员工目录、员工统计、待审队列、日/月账本、运行明细、任务都不重取。切范围会作废旧的在途批（版本号 +1），迟到的旧窗口响应既不写卡片也不写刷新时刻；切换后两卡先回 loading，避免把旧窗口数字挂在新标签下。
- 测试：默认 14d 两读口各一次且参数正确；切 7d 仅 timeseries(range=7d)+run-activity(weeks=1) 各一次、其余路径零新增；粘链 `?range=30d` 选中并显示「近 30 天运行」，切回默认后 URL 清空；7d 迟到批不覆盖 30d（终值 30）。
- 验证：duty 5 files / 86 passed（前 82）；全量 151 files / 2008 passed（前 149/1956，含上游 wave-21 增量）；tsc 本域 0；eslint 0 error / 4 warnings（新增 1 条为既有 `react-hooks/set-state-in-effect` 同款写法：切换范围时把两张卡置回 loading）。
- 未测：真实浏览器快速连点四个范围的人眼观感、375/1440 实机未复核。

## 跨页「今日运行」口径对照（2026-11-20）

- 新增 `web/src/modules/duty/runsCaliber.ts`：`runsCaliber({ duty, metrics, dutyAsOfText })` 返回 `{ verdict, compare, title }`，四态 `equal | different | unread | missing`。
- `/duty` 今日运行卡新增 `duty-runs-caliber` 一行：本卡值（`duty-runs-value`，与 `ov6-kpi-runs` 同源）+ 两读口（workbench/summary?range=1d 与 /api/run-stats 当前窗）+ 采集时刻（`duty-runs-asof`，只取顶层 ISO → 北京时间到分，缺「—」）+ 对照句（`duty-runs-verdict`）。
- 本页不代 `/metrics` 取数（零额外请求），因此常态输出为「/metrics 的读数不在本页取｜口径见 title」；「同源一致」与「本卡 N · /metrics M」两句由纯函数在两侧读数都在手上时产出，已有单测钉死。
- `/metrics` 侧新增 `metAP-duty-note`：静态一句，指向 duty 的读口；原始路径只进 title，不上屏（页面有零工程语言断言）。
- 测试：duty 新增 2 例（行内容与零请求、纯函数三态），metrics 新增 1 例（note 文案与 title）。定向 9 files / 317 passed。

## 值班台口径说明块（duty notes，2026-11-20）

- 新增 `web/src/modules/duty/dutyNotes.ts`：`DUTY_NOTES` 单表常量，八条（今日运行 / 趋势 / 可上岗 / 成本 / 最近运行 / 待我处理 / 阻塞 / 矩阵），每条四段「口径名 · 实际读口 · 时间窗或计算范围 · 缺值策略」；缺值策略统一含「缺值显示「—」，不当 0」，涉及采集时刻的两条另含「不拿本机时间顶替」。
- `DutyPage` 页尾新增 `DutyNotes`：原生 button `duty-notes-toggle`（`aria-expanded` / `aria-controls="duty-notes-body"`），默认收起、body 与八行都不渲染；展开后每行 `duty-note-<key>`。文案全部来自同一个常量，不另写第二套。
- 展开/收起零新请求（测试断言 `fetchJSON` 调用数前后相等）；版式不动，仅页尾一节折叠块。
- 测试：duty 新增 2 例（默认收起且零请求、展开八行与收起）。定向 9 files / 317 passed。

## 卡片下钻真链（duty drill links，2026-11-20）

每张区块卡一个真 `<a>`，先按 `web/src/shell/routes.ts` 与 `web/src/App.tsx` 现查路径：

| 卡 | testid | 去处 | 依据 |
|---|---|---|---|
| 可上岗 | `duty-route-readiness` | `/employees` | App.tsx:1231 |
| 今日运行 | `duty-route-today-runs` | `/runs` | App.tsx:1399 |
| 近 N 天运行（趋势） | `duty-route-trend` | `/runs` | App.tsx:1399 |
| 今日成本 | `duty-route-cost` | `/metrics` | App.tsx:1301 |
| 待我处理 | `duty-route-pending` | `/approvals` | App.tsx:1242 |
| 阻塞 | `duty-route-blockers` | `/work` | App.tsx:1192 |
| 能力与权限（矩阵页） | `duty-route-matrix` | `/capabilities` | App.tsx:1216 |

- 阻塞卡原写 `/tasks`：`App.tsx:1328` 的 `/tasks` 是 `Navigate to="/work?tab=board" replace`，且任务板不读 `status`，深链带 `?status=blocked` 会被丢掉 → 改指 `/work`，并在该链 title 写明「任务页不接受 status 筛选参数，这里去任务板；阻塞项已在本卡逐条列出」。
- 全部用 `Link`（渲染为 `<a href>`），不挂 onClick：右键/中键/Cmd 新标签可用；空态与失败态下 `action` 仍渲染，读者能去处理而不是停在错误页。
- 不新增取数：链接只是导航，挂载前后 `fetchJSON` 调用数不变（测试断言）。
- 零改动各卡既有取数、`ov6-*` 24 枚与 duty-refresh/gates/range/trend/notes 全族未动。
- 验证：duty 5 files / 94 passed（基线 90）；全量 151 files / 2017 passed（基线 2013）；tsc 本域 0；eslint 0 error / 4 既有 warning。
- 未测：真实浏览器用中键/Cmd 打开新标签的焦点行为；375 下链接与标题同行的折行（样式沿用既有 `.duty-link`）。

## 刷新异动摘要（duty changed，2026-11-20）

- 手点「刷新」成功后，`duty-refresh-bar` 内新增一行 `duty-changed`（`aria-live="polite"`）：逐项「卡片名 旧值 → 新值」，最多三条，其余以 `duty-changed-more` 写「另有 N 项变化」。
- 对比项：今日运行（workbench summary runs）、今日成本（budget-usage 日账 costUsd 求和，USD）、待我处理（workbench queue total）、区间运行（timeseries 汇总）、阻塞项（tasks 行数）。全部取自刷新前后两批**已读**数据，`diffDuty()` 纯函数比较，零额外请求。
- 口径：无变化不渲染（禁「无变化」噪音）；首载与 reload 不算变化（只有点刷新才比）；某卡本批失败/缺值则该项整条不进对比，不写 0；切时间范围清空基线（`refreshDelta` 置 null）；金额与屏上同一 `usd()`（真 0 `$0.00`、缺失「—」）。
- testid：`duty-changed`、`duty-changed-<key>`（today-runs/cost/pending/trend/blocked）、`duty-changed-more`。
- 测试 4 例：五处变化只列三条 + 另有 2 项；同值不渲染；成本卡 500 时该项缺席且全文无 `$0.00`、其它项照常；切 7d 后该行消失。验证：duty 5 files / 98 passed（基线 94），全量 151 files / 2021 passed（基线 2017），tsc 本域 0，eslint 0 error / 4 既有 warning。
- 未测：真实浏览器 aria-live 播报节奏、375 折行。

## 运行行内预览（runs row preview，2026-11-20）

- `/runs` 每行新增「展开预览」按钮 `run-row-toggle-<index>`（`aria-expanded`/`aria-controls`），展开后行内渲染 `run-row-preview-<index>`，六项 `run-row-preview-<index>-<status|started|ended|elapsed|cost|employee>`（dl 定义列表）。
- 口径：状态用 `statusLabel`（未知「待核实」，原始值只进 title）；开始/结束北京时间到分；耗时只在两端时间都在时用 `elapsedMinute` 计算，否则「—」+title「不拿本机时间补一端」；成本只认 `costStatus`（known 用 `usd`，真 0 `$0.00`，其它「—」+原因）；员工短码 8 位、title 放全 id。缺字段统一「该字段未返回」+title「不代填、不猜」。
- 行为：同时只开一行；Esc 收起并把焦点交回展开按钮；URL 零改动；打开/收起/切换都不发请求（仅读行内已有数据，测试断言 `urls()` 计数不变）。
- 验证：`vitest run src/modules/runs` 2 files / 81 passed；全量 151 files / 2025 passed（上一单 2021）；tsc 本域 0；eslint 本域 exit 0。build chunk `RunsModulePage-*.js` 命中 1。
- 未测：真实浏览器 375 折行、键盘 Tab 走查。

## 列表复制为纯文本（runs list copy，2026-11-20）

- 位置：`/runs` 列表卡下方 `run-list-copy-bar`；按钮 `run-list-copy`（空列表 disabled，title 写「当前列表没有行，没有可复制的文本」），状态 `run-list-copy-status`（`role=status` + `aria-live="polite"`，成功「已复制 N 行」），剪贴板被拒时 `run-list-copy-fallback` 内只读 `run-list-copy-fallback-text`，内容与尝试复制的文本逐字相同。
- 文本：表头 `run,status,started,ended,elapsed,cost,employee` 加屏上每一行（顺序即屏上顺序）；运行用短码「运行 · 后4位」（不含 `rn_` 原值），状态人话（未列出的词「待核实」），时间北京时间到分，耗时只在开始与结束两端都在时算、否则「—」（不拿本机时间补一端），成本只认 costStatus（真 0 `$0.00`、缺失「—」），员工 8 位短码。
- 零额外请求：`runListText()` 只读 `rows` 与已载入的员工名表；测试断言复制前后 `urls()` 不变、`/api/runs` 恰 1 次。
- 分页口径：按钮 title 明写「当前已加载 N 行，不是全量（每页最多 30 条）」——复制的是屏上这一页。
- 测试 3 例：两行逐字比对（含表头、零成本与缺时间行，正文不含 `rn_`/`emp_` 原值）+ 零请求；剪贴板拒绝→textarea 同文；空列表 disabled + title。
- 验证：runs 2 files / 84 passed（基线 81）；全量 151 files / 2028 passed（基线 2025）；tsc grep modules/runs = 0；eslint exit 0；build exit 0，chunk `RunsModulePage-*.js` 内 `run-list-copy`=1，entry 0。
- 未测：真实浏览器长列表选中与 375 折行。

## 四态统一（runs state，2026-11-20）

- 新增 `run-state`（隐藏，`data-phase=loading|empty|error|denied`）与四个阶段标记 `run-state-loading/empty/error/denied`；`run-state-empty-text`、`run-state-clear`、`run-state-rid`、`run-state-retry`（`data-disabled` 记录 fixture 腿）。
- empty 分两种：无筛选（`/api/runs` 读过且确实没有运行）给原文案；带 `status`/`employee` 筛选时写「当前筛选下没有运行记录…读取是成功的」，并给 `run-state-clear`「清空筛选」（删 `status`/`employee`，保留 `window` 与其它参数，`replace`）。
- error：人话 + 可复制请求编号（`RequestIdLine`）+ 重试；403 与 404 仍共用一个 DOM 体（`run5-denied` 逐字相同）。denied 下四参（window/status/state/employee）保留在地址与后续重试请求里；行不渲染（整页替换，沿用 T15 的既有四态口径，已与刀令「保已加载行」差异一并记入回执）。
- 单点 helper `listActionGate(phase)` 统一「复制清单」「行内预览」两处可用性：loading/empty/error/denied 全 disabled + 人话 title，ready 才可用；计数位未知阶段写「—」+ title「不把读不到当成 0」。
- 测试 5 例：loading 骨架 4 块不变且无复制；无筛选空 vs 筛选空（清空后请求无 `status=`）；error rid + 计数「—」+ 重试恰 +1 请求；403/404 同体且四参保留；复制/预览 disabled 的 title 一致。
- 验证：runs 2 files / 89 passed（+5）；全量 151 files / 2033 passed；tsc 本域 0；eslint 本域 exit 0（修掉一处 redundant Boolean）。
- 未测：真实浏览器 375 折行、Esc/焦点走查；`?state=` fixture 腿的键盘行为。

## 运行列表 CSV 导出（runs list export，2026-11-20）

- 复制钮旁新增 `run-list-export`（同一条 `RunListCopy` 条内），文件名预览 `run-export-name`，行数 `run-list-export-count`（文本「可导出 N 行」，`data-rows` 同值）。
- 导出为浏览器内 Blob（`\uFEFF` BOM、`text/csv;charset=utf-8`、临时 `a.download`），**零新端点**：数据就是屏上这一页的行，`fetchJSON` 计数在导出前后不变。
- 表头固定 `run,status,started,ended,elapsed,cost,employee`；值取同一批渲染数据：运行短码（无 `rn_`）、状态人话（未列出的词「待核实」）、起止北京时间到分、耗时仅两端齐时算否则空字段、成本真 0 写 `0.00`/未知或缺失留空、员工 8 位短码（无名「员工 · CODE」、无负责人「未指派」）；行序=表体行序。
- 文件名 `runs-<window|all>-<status|all>-<YYYYMMDD-HHmm>.csv`（BJT 到分，片段只含 `[a-z0-9.-]`）；`run-export-name` 与下载瞬间同一串（`useMemo` 固定，不随分钟漂移）。
- 字段转义走 `csvField`（含逗号/引号/换行→引号包裹、`"`→`""`），供程序读取；`run-list-export-status` 为 `role=status aria-live=polite`（「已导出 N 行」/失败「导出没成功：这份文件没有生成」）。
- 四态走同一单点 `listActionGate().export`：空列表 title「没有可导出的 CSV」、错误「先重试，读到数据再导出」、无权「看不到运行记录」；加载/失败/无权时不渲染行列表但导出条仍在且禁用。
- 分页口径随复制按钮 title：「当前已加载 N 行，不是全量（每页最多 30 条）」。
- 验证：runs 2 files / 94 passed（基线 89），全量 2038 passed（基线 2033），tsc 本域 0，eslint 本域 exit 0；build exit 0，chunk `RunsModulePage-*.js` 内 `run-list-export`=1（entry 0）。未测：真实浏览器下载落盘与 375 折行。

## R49 修复：workbench timeseries 只收合法范围（2026-11-20）

- 缺陷：`/api/workbench/timeseries` 只接受 `24h|1d|7d|30d`，前端默认传 `14d`（`workbench.ts` 默认值与 `useDutyData` 两处），概览 14 天趋势卡必 400 `console.invalid_range`。
- 改动前请求：`GET /agent-api/api/workbench/timeseries?range=14d&bucket=day&metric=runs` → 400。
- 改动后请求：`GET /agent-api/api/workbench/timeseries?range=30d&bucket=day&metric=runs`；回包按天桶保留最后 14 个，`totals` 置空后由保留点重算（`trimTimeseries`），卡片口径仍是「近 14 天」，标题/摘要/arian 与表 caption 文案不变且与实际点数一致。
- `dutyRange.ts`：`tsRange` 收窄为 `1d|7d|30d`，14d 映射到 `30d`（只读合法超集后裁剪）；`workbench.ts` 默认值改 `7d`。
- 结构性盲区用例（2 例）：断言实际发出的 timeseries URL 的 `range` ∈ `["24h","1d","7d","30d"]`、`bucket=day`、`metric` ∈ `["runs","failed","costUsd"]`；另注入 30 点回包断言 14 天视图只留 14 桶、合计由点重算为 14、表体 14 行。
- 验证：duty 5 files / 100 passed（基线 98），全量 151 files / 2040 passed（基线 2038），tsc 本域 0，eslint exit 0。

## 运行三面口径回归护栏（runs parity，2026-11-20）

- 新增 `web/src/modules/runs/runs.parity.test.ts`（纯测试，未改产品行为）：同一行在行内预览、列表复制文本、CSV 导出三面逐字段比对。
- ①三面一致：状态人话（未知「待核实」，缺状态预览「该字段未返回」/复制 `—`/CSV 空）、起止北京时间到分、耗时仅两端齐时给值否则预览/复制 `—`、CSV 空字段、成本真 0 预览/复制 `$0.00` 与 CSV `0.00`（缺失分别为「—」/空）、员工 8 位短码（无负责人「未指派」）。
- ②行数/行序：CSV 数据行数 == 表体行数 == `run-list-export-count` 的 N；CSV 首列顺序 == 表体 code 顺序；两组地址各验一次（`?window=7d&status=failed` → 文件名 `runs-7d-failed-…`；无筛选 → `runs-all-all-…`）。
- ③时间口径：假时钟 2031 下，耗时恒「—」/空，预览开始时间、复制文本、CSV 均不含 2031；`run-export-name` 的文件名含 2031 属生成时刻（非数据时刻），按口径保留并显式断言。
- ④零额外请求：打开预览 + 复制 + 导出后 `urls()` 与首载逐项相等，`/api/runs` 调用次数不变。
- 验证：runs 3 files / 99 passed（本单前 94）；全量 151 files / 2045 passed（基线 2040）；tsc 本域 0（修掉测试里未用的 `ReactNode` 导入）；eslint 本域 exit 0；build `--outDir /tmp/build-runspar`。
- 未测：真实浏览器下载落盘与 375 折行。

## 筛选条 URL 单一事实源（runs filter source，2026-11-20）

- 页面新增 `run-source` 条（`run5-status` 之后）：`run-source-path` 展示「当前筛选可分享形态」，`run-source-none` 在无筛选时写「未设置筛选（按默认近 7 天读取）」，每个未识别值一条 `run-source-note`，`run-filter-copy` 复制同一串（不 origin/token），状态 `run-filter-copy-status` 为 `role=status aria-live=polite`，剪贴板拒绝时 `run-filter-copy-fallback-text` 只读同文。
- 四参现状：window（控件，白名单 24h/7d/30d）→ `since=…&limit=30`；status（控件，五值）→ `status=`；employee（无控件，仅深链）→ `employeeId=`；state（无控件，QA 复现句柄）→ forced 时零请求。
- 非法值不静默改写地址：notes 说明回落口径（时间范围按近 7 天、状态按全部、预览参数按正常读取），select 与请求用回落值；`run-source-path` 只输出有效值（固定顺序 window→status→employee→state），所以地址里的 `window=zz` 不会写进分享串。
- 5 例：全参路径与复制同串 + 实发 URL 带 status/employeeId；无参；三非法值三条 notes 且地址保留原文；切 24h 只 +1 请求；剪贴板拒走只读回退。
- 验证：runs 3 files / 104 passed；全量 151 files / 2050 passed；tsc 本域 0；eslint 本域 exit 0；build exit 0，chunk `RunsModulePage-*.js` 内 `run-source-path`=1（entry 0）。未测：真实浏览器 375 折行与 select 键盘操作。

## 列表列排序（runs sort，2026-11-20）

- 读口不吃排序（实证）：`runs.ts` 的 `askListRoute` 对 `/api/runs` 只拼 `since&limit=30[&status][&employeeId][&cursor]`、对 `/api/run-stats` 只送 `from/to`，客户端从不发送 `sort/order/orderBy`；活体三组探测（无参 / `&sort=status&order=asc` / `&orderBy=started&order=desc`）均 HTTP 401 `console.unauthenticated`（rid 5e3c1449 / f331cb0e / 8ae397c3，cookie 已过期，鉴权层先拦），无法比较服务端顺序。→ 采用**本地排序**。
- 四列表头（状态/开始/耗时/成本）为原生 `button[type=button]`（`run-sort-status|-started|-elapsed|-cost`），包在 `role="columnheader"` 且带 `aria-sort` 三态（none/ascending/descending）的容器里；Enter/Space 由原生按钮承担；`focus-visible` 有外描边。首次点按：状态升序、其余降序；同列再点翻转方向。
- 排序落 `?rsort=&rdir=`（单次 `setParams` 同时写两键），`window/status/employee/state` 四参保留；粘链复现。表体不渲染（加载/空/错/无权）时无排序控件（口径说明，非 disabled 按钮）。
- 缺值恒排末、不乘方向：无状态、无开始时间、无结束时间（耗时为 null）、成本非 known 的行在升/降序都沉底，不当 0 参与比较；相等值保持原序（稳定）。
- 行序同源：`sortedRows` 同时喂表体、复制清单与 CSV 导出，三面首列顺序一致。
- 点表头零新请求（`fetchJSON` 计数不变）；`run-sort-scope-note` 写明「仅在当前已加载 N 行内排序；服务端读口不接受排序参数，点表头不会重新读取。」。
- 验证：runs 3 files / 108 passed（基线 104）；全量 151 files / 2054 passed（基线 2050）；tsc 本域 0；eslint 本域 exit 0；build exit 0（chunk `RunsModulePage-*.js` 内 `run-sort-status`=1，entry 0）。未测：真实浏览器 375（表头在窄屏隐藏）与键盘 Tab 实机走查。

## 趋势窗口口径说明（duty trend window note，2026-11-20）

- 背景：BFF timeseries 只接受 `range∈[24h,1d,7d,30d]`，14 天视图实际请求 `range=30d` 再前端裁到最近 14 桶；R49 要求屏上说明这一点。
- 新增常驻句 `duty-trend-window-note`：「数据取近 30 天，本卡只显示最近 14 天」；仅 14d 视图渲染，7d/24h/30d 不渲染。
- 四处口径现值（同一 `range.label` 派生）：卡片标题「近 14 天运行」；图 `aria-label`「近 14 天每日运行次数」；表 caption「近 14 天每日运行次数（北京时间）」；摘要「近 14 天：首日…末日…峰值…最低…合计…」。卡片不再出现「近 30 天运行」字样，窗口差异只由说明句交代。
- 同单修掉一处硬编码：失败分支摘要原写「近 14 天摘要：…」，切 7d/30d 时口径混用 → 改为 `${label}摘要：…`；loading 分支同样使用 `label`（「正在读取近 7 天的运行记录」）。
- 测试 4 例：14d + 注入 30 点 → 说明句逐字、四处口径一致、表体 14 行；切 7d/30d 说明消失且各自 aria 正确；挂起读口验证 loading 文案随范围；说明句渲染后 40ms 内 `fetchJSON` 计数不变（零额外请求）。
- 验证：duty 5 files / 104 passed（基线 100）；全量 2175 passed；tsc 本域 0；eslint 本域 exit 0（4 既有 warning）；build exit 0，chunk `DutyPage-*.js` 内 `duty-trend-window-note`=1（entry 0）。未测：真实浏览器 375 说明句折行。

## 预览与详情同值（runs preview/detail parity，2026-11-20）

- 两条渲染路径收成一个 helper：行内预览（`runPreview()` → `RunPreviewPanel`）与 `?run=<id>` 详情卡（`detailView = runPreview(detail.run, names)`）现在读同一份六字段派生；详情卡新增 `run5-detail-summary`、`run5-detail-ended`、`run5-detail-employee` 锚点。
- 改前/改后（同一缺字段 run：只有 startedAt，无 status / 无 endedAt / 无 employee / 成本未知）：
  - 改前：详情结束位渲染长句「还没有结束时间…」、耗时可能拿本机时钟算（`elapsedMinute` 未判两端）、状态缺值渲染空 Badge、员工 title 用裸 id。
  - 改后：两处一律「该字段未返回」；耗时两处「—」且 title 含「不拿本机时间补一端」；成本两处「—」（详情正文不出现 `$0.00`）；员工两处「未指派」、有 id 时两处都显 8 位短码、原始 id 只进 title。
- 测试 3 例：完整 run 六字段逐项两处同值（`2026-11-18 10:00` / `10:11` / `11 分钟` / `员工 · AAAABBBB` 逐字相等）；缺失 run 同句；预览开关两次后 `fetchJSON` 计数不变，`/api/run-detail` 与 `/api/run-events` 各恰 1 次。
- 口径：预览是纯渲染，不新增读；详情仍只读一次明细与一次事件流；`该字段未返回`/`—`/`未指派` 与列表、复制、CSV 三面保持一致。
- 验证：runs 3 files / 111 passed（基线 108）；全量 2178 passed；tsc 本域 0；eslint 本域 exit 0。未测：真实浏览器 375 详情长文案折行。

## 跨页成本口径说明（cost caliber notes，2026-11-20）

`/runs` 与 `/metrics` 都展示成本，但口径不同：运行列表只有账本实扣，指标页把调用次数与账本金额分列。两页各加一行只读说明，指向对方。

- 单一文案源：`web/src/modules/metrics/costCaliberNote.ts` 导出 `COST_CALIBER_TEXT`、`RUNS_PAGE_PATH`、`METRICS_PAGE_PATH`、`costCaliberTitle(audience)`；两页引用同一常量，禁止各写一版措辞。
- `/runs`：表体下方 `run-cost-caliber-note`（ready 时渲染），title = `costCaliberTitle('runs')`，含 `/runs` 与 `/metrics` 两条路径。
- `/metrics`：明细表下方（`metAH-cap-note` 之后）`met-cost-caliber-note`，title = `costCaliberTitle('metrics')`，互指 `/metrics` → `/runs`。
- 脚本 `react-router` 无关：两处都是静态 `<p>`，不新增读口（`/api/runs` 仍恰 1 次；metrics 读口计数与首载一致）。路径只进 title，可见文案不含 `/api`、不含工程字段名。
- 可见文案（逐字，两页相同）：成本按账本实扣显示：真实的零写 $0.00，没有记账写「—」，不把读不到当成 0。账本实扣与「调用次数」不是同一套口径，两边数字各以本页卡片为准。
- 验证：`vitest run src/modules/runs` 3 files / 112 passed；`vitest run src/modules/metrics` 4 files / 228 passed；全量 159 files / 2180 passed；`tsc` 本域 0（全仓既存 79）；`eslint` exit 0；build exit 0，entry 内 marker 0，`RunsModulePage-*.js` / `MetricsModulePage-*.js` 各 1。
- 未测：真实浏览器三档换行；两页并排人工对照。

## 页尾口径说明块（runs notes，2026-11-20）
- 位置：`/runs` 页尾、`run5-list-details` 之后；`run-notes-toggle` 是原生 button（`aria-expanded` / `aria-controls="run-notes-body"`），默认收起且**收起时 body 不渲染**；展开后 7 行 `run-note-<key>`（window / status / employee / state / elapsed / cost / asOf），每行四段：口径名 · 实际路径 · 计算范围 · 缺值策略（同一段文字另进该行 title）。
- 表驱动单一常量：`modules/runs/runNotes.ts` 的 `RUN_NOTE_ROWS` + `RUN_NOTES_TITLE`；成本行缺值策略直接复用 `modules/metrics/costCaliberNote.ts` 的 `COST_CALIBER_TEXT`——与屏上 `run-cost-caliber-note` 同一常量，无第二套措辞。
- 实际路径按 `askListRoute` 现查：`/api/runs?since=…&limit=30[&status][&employeeId][&cursor]`；`/api/run-stats?from=…&to=…` 只在主路由 404 时兜底，且不带 status/employeeId。`?state=` 复现腿不读任何读口，notes 在复现腿整块不渲染（避免把没读到的口径写成已发生）。
- 成本行口径：账本实扣、真 0 `$0.00`、未知不显示 0、与 `/metrics` 调用次数不是同一套口径；耗时行写「起止两端齐才计算，缺一端显示—，不拿本机时间补」；采集时刻行写「只取顶层 ISO，缺失显示—，不拿本机时间顶替」（本版页面不在屏上展示采集时刻）。
- 零额外请求：展开/收起前后 `urls()` 长度与 `/api/runs` 调用次数均不变（用例实测）。
- 三条用例：收起态与展开七行（含成本行逐字等于 COST_CALIBER_TEXT）、开合零请求、复现腿不渲染。
- 验证：runs 3 files / 115 passed（基线 112）；全量 159 files / 2187 passed（基线 2184）；tsc 本域 0（全仓既存 79 条）；eslint exit 0（0 error / 9 既有 warning）。
- 未测：真实浏览器 375/1440 展开后七行的折行与长路径断行。

## 行固定链接（runs permalink，2026-11-20）

`/runs` 复制控件 `run-permalink` 只把地址栏已有参数与当前 `run` 标识串成一条链接，不新增读口。

- **链接形状**：`/runs/?window=…&status=…&employee=…&state=…&rsort=…&rdir=…&run=<id>`；页面既有 `hrefOf()` 同一函数产出，与每行「查看」锚点同源（`?run=` 是运行详情页消费的参数，先 `git grep "run="` 现查确认，非路径式 `/runs/<id>`）。
- **复现读数**（jsdom，订单要求的 URL → 行 → 是否展开）：入口 `/runs/?window=7d&status=failed&rsort=started&rdir=desc&run=rn_01M7822XN781D2S9JASH5TX1XZ` → 命中 `run5-row-0` 且 `data-selected="1"` / `aria-current="true"`，`run5-detail` 详情卡自动打开；行内预览抽屉**不**自动展开（`openId` 起始为 null，需点「展开预览」）。即：链接复现同一筛选/排序并选中该运行，展开的是详情而非预览。
- **零额外请求**：复制前后 `urls()` 长度不变、`/api/runs` 调用次数不变（测试断言）。状态区 `run-permalink-status`（role=status aria-live=polite）成功写「链接已复制」。
- **无选中运行**：`run-permalink` disabled，title 逐字「先选中一条运行再复制」；点击不发任何请求，也不调剪贴板。
- **剪贴板拒绝**：`run-permalink-fallback` 内只读 `run-permalink-fallback-text`，值与尝试复制的链接逐字相同。
- **复现腿**：`?state=` 四态下整块不渲染（复现腿不读写口）。
- 新增 testid：`run-permalink`/`run-permalink-bar`/`run-permalink-status`/`run-permalink-fallback`/`run-permalink-fallback-text`；既有 `run-*` 全族零破。
- 验证：runs 3 files / 119 passed（基线 115）；全量 159 files / 2191 passed（基线 2187）；`tsc` 本域 0（全仓既存 79）；`eslint src/modules/runs` exit 0；build exit 0，entry 内 `run-permalink`=0，`RunsModulePage-*.js` 命中 1。
- 未测：真实浏览器 375/1440 下按钮与状态句折行；跨页粘贴到新标签的实际跳转（jsdom 只验 URL 形状与选中态）。

## 筛选一键重置（runs filter reset，2026-11-20）

- 单表：`runs.ts` 的 `RUN_PARAM_TABLE` 列出页面认作筛选的六个参数（时间范围 / 状态 / 负责人 / 复现状态 / 排序字段 / 排序方向）；分享路径的拼装与本次重置都读这一张表，不再各写一份名单。
- 按钮 `run-reset-filters`：一次删除上表里所有存在的键（`window/status/employee/state/rsort/rdir`），地址里其它键原样保留；无筛选时 `disabled`，title 逐字「当前没有可清除的筛选条件」。
- 非法值也算筛选：`?window=zz&status=zz` 两个键存在即计入可清除项，title 写「未识别的值（zz、zz）也占着筛选位，一并清掉」。
- 实测（jsdom，`?window=30d&status=failed&rsort=started&rdir=desc&keep=1`）：
  - 改前：地址含四参、表体按开始时间降序 `运行 · 9XYZ` → `运行 · X1XZ`、源条含 `window=30d&status=failed`、计数「本页 2 次」。
  - 改后：地址 `?keep=1`、表体回服务顺序 `运行 · X1XZ` → `运行 · 9XYZ`、源条 `/runs`（只回显它自己那四个可分享参数）、导出计数 `data-rows=2`、复制首行同为 `运行 · X1XZ`。
  - 请求计数：`/api/runs` 恰 +1（时间窗与状态同时变化，只重读一次）；仅排序参数（`?rsort=cost&rdir=asc`）重置时 **0** 次新请求——排序是本地行为。
- 复位写 `{replace:true}`，不新增历史条目；`run-notes`、`run-sort-*`、`run-list-*`、`run-row-preview-*`、`run5-*` 全部保留。
- 测试：describe「run filter reset」4 例；runs 3 files / 123 passed（基线 119）。
- 未测：真实浏览器 375/1440 下按钮与下拉同一行的折行。

## 行内预览复制该行（run row copy，2026-11-20）

`/runs` 的展开行里多了一个「复制这一行」：把该行**屏上已渲染**的七个字段拼成一行纯文本，走剪贴板。

- 单一格式函数：`runs.ts` 的 `runRowFields(row, names, mode)` 输出七字段（运行短码 / 状态 / 开始 / 结束 / 耗时 / 成本 / 员工）。`runRowText()` 用 `label` 模式拼 ` · `，供预览内复制；`runListText()` 用 `dash` 模式拼逗号，即列表复制与 CSV 行——两个表面同源，不会各写一套措辞。`label` 模式下状态/开始/结束缺失写「该字段未返回」，耗时与成本仍写「—」；`dash` 模式保持列表复制既有契约（「—」）。
- testid：`run-row-copy`、`run-row-copy-status`（`role=status` + `aria-live=polite`，「已复制」）、失败时 `run-row-copy-fallback` + 只读 `run-row-copy-fallback-text`（内容与剪贴板参数逐字相同）。
- 按钮只在展开预览里渲染（订单给了二选一）：没打开预览时 DOM 里没有这个钮，不存在「点了没反应」的死控件。
- 零额外请求：复制只读当前行的 `row` 与员工目录映射；打开预览、复制、再复制前后 `urls()` 与 `/api/runs` 次数均不变（用例断言）。
- 验证：runs 3 files / 126 passed（基线 123，+3）；全量 161 files / 2237 passed（基线 2195，上游本波抬高）；`tsc` 本域 0（全仓既存 79）；`eslint src/modules/runs` exit 0；build exit 0，entry 内 `run-row-copy`=0，`RunsModulePage-*.js` 内 =1。
- 未测：真实浏览器 375 下复制条与脚注的折行、系统剪贴板权限弹窗路径。
