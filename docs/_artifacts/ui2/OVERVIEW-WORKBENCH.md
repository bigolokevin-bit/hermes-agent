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
