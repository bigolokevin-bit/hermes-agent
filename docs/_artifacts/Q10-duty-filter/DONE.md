# Q10 duty-filter-parity · DONE

车道 `task/Q10-duty-filter-parity`（B 车道）。base `5ddee384` → tip 见回执 sha。
证据源＝本树 `docs/governance/parity/B1-duty.parity.md`（板 086c6b7a 点单行 + 缺项清单 #9/#5 等；
注：派工单写的 `git show origin/main:docs/governance/parity/B1-duty.parity.md` 在板仓当前 ref 已不存在，
正典内容以本树该文件为准，行锚 :1840-2035 指参考件 `web/docs/console-v4-skeleton.html`）。

## 一、逐条对勾表（条目 1/3/4/5/6；条目 2 除外）

| 条 | 状态 | 文件:行 | 改法 | 缺口→闭合读数 |
|---|---|---|---|---|
| 1 时间范围筛选 | ✅ 已闭（Q5 波在码，本拍钉住不回归） | `DutyPage.tsx:1298-1311`（role=group aria-label=时间范围 + 4 枚 aria-pressed 钮）；`dutyRange.ts:22-27` 档位表；`useDutyData.ts` 两时间腿丢旧窗 | 无新码；新增回归钉 `duty.q10-parity.test.tsx`「条目1」例（既有护栏在 `dutyPage.test.tsx:623/:640/:665`） | 「现无任何筛选控件」仅指参考侧；live 脸实测 `rangeBtns=4`，默认 14d aria-pressed=true |
| 3 三卡截断+查看全部(N)+披露被截 | ✅ | `aggregate.ts` 新增 `blockersTotal`（截断前读到总数；失败运行按 1 组与卡面同口径）；`DutyPage.tsx` BlockersCard/PendingCard/RecentCard action=「查看全部 (N)」（审批 N=服务端 pending、阻塞 N=blockersTotal、最近 N=本页触顶条数并明写非全量）；卡外明细恒列前 `LIST_CAP=3`，超出加 `duty-blockers-more/duty-pending-more/duty-recent-more`「另有 N 条未在本页列出」；`:997` 失真话术「阻塞项已在本卡逐条列出」销案 | 钉测：pending=7&rows=3 → `查看全部 (7)` + `另有 4 条未在本页列出`；blockers 7 读到 → 3 列 + `另有 4 条`；`.duty-blocker` 计数=3；全文 not.toContain 失真句。live 读数：pendingBtn=`查看全部 (0)`（服务端 0 不假造）/ blockers=`(1)` / recent=`(3)` |
| 4 最窄门置顶+交集句 | ✅ | `aggregate.ts buildReadiness`：`orderedGates` 把 fail 最多的已知门排首位其余保序；`netNote` 交集句（门名+拦下人数+unknown 存在时明说「净人数暂不给」）；`DutyPage.tsx` 检查项区上方 `duty-gates-net` 上屏 | live 读数 firstGate=`ov6-gate-V6`（原序 V1 首位被顶掉）；gatesNet 原文＝「四门叠加先看最窄的一道「审批」：拦下 2 人；还有 1 项检查结果未知，叠加后的净人数暂不给。」钉测 2 例（纯函数+DOM） |
| 5 分母护栏 | ✅ | `types.ts` `EMPLOYEES_PAGE_LIMIT=100`（api 读口与 aggregate 口径句单点共用）；`aggregate.ts` `denomNote` 三态：触顶＝`本页 100 人＝数据源单页上限 100，非全量`／目录未拉满＝`…非全量`／未触顶＝`与在册统计一致`；`DutyPage.tsx` `duty-denominator-caliber` 上屏 | 钉测：100 人触顶句含「非全量」+ 1 人句含「未触单页上限」。live 原文＝「比率分母口径：本页 3 人，未触单页上限 100，与在册统计一致。」既有 confirmed 伪权威总数护栏（unknownGates→null）不回归 |
| 6 页头动作位（刷新/导出日报） | ✅ | `dutyGates.ts` 新增 `exportDaily`（恒 enabled:false + 原因句）；`DutyPage.tsx` header 刷新钮旁加导出日报钮：`aria-disabled=true`（非原生 disabled，可聚焦可辨）+ `data-planned` + title 原因 + 可见「计划中」hint；gates scope 串更新 `refresh,retry,copy,link,exportDaily` | live 读数 exportDisabled=`true`、planned=true、hint=「计划中」、刷新腿原样（duty-refresh 在）。钉测断言 `el.disabled===false`（防误改原生 disabled 变不可辨） |

**条目 2（能力矩阵四联筛选）——跨包点，只上报不越域**：四联筛选 DOM 确实住在
`duty/MatrixView.tsx:151-171 + :91-100`（派工单纪律条款命中），但它是**无挂载点的死代码**
（parity 缺项#6：`App.tsx` matrix tab 挂 `modules/matrix/MatrixModulePage`）。未动一行。
处置（挂载或删除）请 L0 裁决；若裁删，涉及 `duty/index.ts:2` 导出行（在本车道写域内，可即时执行）。

## 二、取证（1440/375，Q8 配方复用）

腿：本树 vite dev(5199) + node shim(5299，/agent-api→9122 l7-ops 脸只读，Origin 镜像 Q8 已验组合)，
chromium for testing + q8-auth-state Cookie 域改写 127.0.0.1（密钥不落盘不入 git）。
脚本 `scripts/q10-shots.cjs`（throwaway，配方注释在头）。

- **whoami 紧贴**：Q8 同腿 `/agent-api/api/auth/whoami` 经 v4_proxy 恒 404（映射不存在），
  采纳 Q8 实际使用的 `console-sessions?limit=1`：before/after 均 **status 200**（无 Cookie 基线 401 已 curl 复核）。
- **fullPage 判据**：本脸 shell 内滚（scrollHeight=900=clientHeight）⇒ fullPage 属 no-op 族（坑档#1 命中），
  按派工单改**视口加高取图法**：每档交付 `*-tall.png`(2400 高) + 留 `*-fullpage.png` 对照。
- **375 拆壳内外**：1440/375 两档 `docLevelOverflow=false`（壳外越界=0 判绿），读数见
  `raw-before-readings.json` / `raw-after-readings.json`。
- 图：`shots/q10-duty-{1440,375}-{before,after}-{tall,fullpage}.png` 共 8 张。before textLen 1555/1561 →
  after 1576/1582（新增披露上屏，DOM mounted=True 非骨架）。

## 三、钉测红→绿（duty.q10-parity.test.tsx，8 例＝纯函数 3 + 屏上 5）

- 首跑红原文：`Test Files 1 failed (1)` / `Tests 7 failed | 1 passed (8)`
  （过的 1 例＝条目1 时间范围在码回归钉；红样：`FAIL …条目6：页头刷新可点… AssertionError: 页头必须有导出日报动作位: expected null not to be null`，全文存 `q10-red.txt`）。
- 中间一轮 `1 failed | 7 passed`＝测试数据错配（blockers 断言把 buildBlockers 内部 cap-3 当 total），产品行为正确；
  修法＝补 `blockersTotal` 纯函数（cap 前口径）而非放宽断言。
- 终跑绿原文：`Test Files 1 passed (1)` / `Tests 8 passed (8)`。
- 模块全量绿原文行：`Test Files  12 passed (12)` / `Tests  161 passed (161)`（含 slotClause5/caliber/h1 契约等既有钉全保绿）。
- tsc：全仓 49 错均为他道既有红（基线按 delta 判），`grep -c modules/duty` = **0**。

## 四、交付与纪律

- commit+push 同批，`git ls-remote origin refs/heads/task/Q10-duty-filter-parity` 回读输出行见回执。
- 首笔 `121886a3df` 于计时 8 分钟落地；禁 force / --no-verify 未用；lefthook eslint 门自然通过。
- 写域：仅 `web/src/modules/duty/**` + `docs/_artifacts/Q10-duty-filter/**`；`git status --porcelain` 逐项核对无他道文件混入。

## 五、需决策点（不阻塞，列给 L0）

1. `blockersTotal` 沿卡面「失败运行按 1 组」口径；若「查看全部 (N)」应逐次计数，一句话即可改。
2. MatrixView 死代码挂载/删除裁决（见上；删除可即时执行）。
3. recent 卡「查看全部 (3)」是本页触顶读数非运行总数（文案已明写「非全量」）；若要总数需后端计数腿。
