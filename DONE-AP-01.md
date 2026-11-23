# AP-01 · 待处理列表真数据与分母诚实 — DONE

分支 `task/AP-01-pending-truth`（基线 `lane/hermes-console@90a80aee6caade12f02407f31ef77fcc752c5b1d`，已含 Q13 审批 diff 段，未触碰）。
源单：`seakoi-agent-os-l0-board/docs/product/backlogs/approvals-duty.md` §AP-01。
写域：`web/src/modules/approvals/**` ＋ 本文件。零新端点、零写路径、零 BFF 改动。

## 1. BFF `/api/approvals` 响应原文关键行（本机现网实测，非 fixture）

链路：v4_proxy(9141, 临时, 用完已杀) → console BFF(8092, `bff-v4-serve/apps/console/server.py`)
→ 域服务(8101, SQLite `~/.local/state/seakoi-ops/domain-dev.db`)。登录态＝opsadmin 治理登录腿
`l7-ops/ops/opsadmin-evidence-login.sh` 产物 `~/.seakoi/opsadmin-token.txt`；
取图与取证前均断言 `GET /auth/whoami` → **200 `{"user_id": 1, …, "display": "opsadmin"}`**。

逐字原文（`evidence/` 下同名文件，evidence/ 不提交）：

| 请求 | 顶层键 | items | nextCursor | total |
|---|---|---|---|---|
| `?limit=50`（缺省＝扇出） | `["items","nextCursor"]` | 16 | `null` | **无此键** |
| `?status=all&limit=50`（扇出别名腿） | `["items","nextCursor"]` | 16 | `null` | **无此键** |
| `?status=pending&limit=50`（单态透传） | `["items"]` | 0 | 无此键 | **无此键** |
| `?status=expired&limit=50`（单态透传） | `["items"]` | 11 | 无此键 | **无此键** |

- `evidence/raw-list-fanout.json`（23 383 B）首行：
  `{"items": [{"approvalId": "ap_0C67930A766D4AA49E4B5B44EC", "tenantId": "t_seakoi_pilot", "type": "business_action", "status": "expired", …`
  末行：`… "recipient": [{"userId": "human:1", "role": "owner"}], "requestId": "ap_449D1CA7D18847668C06C822CA"}], "nextCursor": null}`
- `evidence/raw-list-pending.json` 全文＝`{"items": []}`（本机真数据 0 条 pending：11 expired + 5 consumed）。
- 扇出腿行内带 `recipient`/`requestId` 别名＝`_approvals_all` 的 `setdefault` 补键；单态腿走
  `_approvals_alias_map`（server.py:808）——**两路都只补行别名，不补 total**，与 §AP-01 现状证据一致。
- 结论：**读口顶层恒无 `total`/`count` 键 ⇒ `model.ts` 解析出 `total=null`**，屏上任何总数都无源。

## 2. 改动清单（按步骤①②③）

**单点**：分母句只有一个来源 `QueueSummaryBar.denominatorReadout()`（`text`/`reason`/`note` 三件），
队列分页条、汇总条范围句、截断说明、桶 tooltip 全部引用它 ⇒ 不可能出现两种总数口径。

- `QueueSummaryBar.tsx`
  - 新增 `DenominatorFacts` ＋ `denominatorReadout()`：`total!==null` → `共 N 条 / 已加载 M 条`；
    `total===null` → **`已加载 M 条（非全量）`**（① 目标句式），原因句按三态分别说清：
    有游标（还有下一页，推算会撒谎）／扇出腿（跨态 cursor 恒 None ＋ limit 截断，
    无游标既不证明全量也不证明末页）／单态无游标（本次取回的全部，总数仍未由读口给出）。
  - 汇总条新增 `apv6-summary-scope`（分母句上屏）与 `apv6-summary-unreadable`（**`n 条无法读取`**，②）。
  - 状态桶/风险桶 title 追加同一句范围说明；引导语与 `aria-label` 由「与列表同源」改为
    「与列表同一请求，按已加载行计」＋「读口不给总数」（同源≠全量，旧措辞是错觉来源）。
- `ApprovalsPendingModulePage.tsx`
  - `denominator` 事实（`aggregated:false`，本 tab 恒发 `status=pending`＝单态透传腿）；
    汇总条接 `denominator`＋`unreadable`。
  - summaryLine ① ：ready 腿去掉「已显示 N 条申请」这种可读成总量的句式（条数交给分母句），
    改为「已加载行中 N 条待处理（＋下面还有更多）」；关键字腿改「关键字过滤中：命中 X / 已加载 Y 条」。
    **empty 腿 `共 0 条待处理审批` → `本次读取没有返回待处理审批（读口不给总数）`**（0 也是推算出来的总量）。
  - 分页 footer ②：`apv-page-count` 改由 `denominatorReadout` 派生，旧句式
    「总数不可用 · 已显示 N 条」/「已到末页 · 已显示 N 条」退出；新增 `apv-denominator-note`
    一句到底/截断诚实说明（仅 `total===null` 时上屏）；more 钮 title 保留游标事实「已到末页」
    并补「读口不给总数，这不等于服务端承诺屏上这些就是全量」。
- `ApprovalsHistoryModulePage.tsx`（写域内，见 §5 偏差）：同一 `denominatorReadout` 单点；
  `aggregated = status===null || status==="all"`（取代覆盖面不足的 `singleAgg`），
  扇出腿 more title 说明「按 8 态扇出合并、跨态无游标、合并后按 limit 截断」；
  汇总条接 `denominator`＋`unreadable`；分页条与说明句与待处理腿逐字同形（③）。
- `model.ts`（② 只补注释与键序）：`ApprovalPage.total` 注释写入两路实测顶层键与截断语义，
  并钉「null＝读口没说，不是 0 也不是 rows.length」；`approvalsPageFrom` 的 total 读取改走
  已收窄的 `rec?.total ?? rec?.count`（去掉对 payload 的双 cast），
  返回对象键序＝接口声明序（`rows, unreadable, next, total`）。**行为不变**（数组载荷仍 null）。
- `useApprovalsData.ts`：`total: page.total ?? (append ? prev.total : null)` 清点结论＝
  **不是**按条数推算（两个分支都只可能是服务端 total 键的值），补注释说明，代码零改动。

**① 全量清点结果**（`grep 'rows\.length} 条\|共 \$\{'` 逐处判定）：
- 命中并已改：`ApprovalsPendingModulePage.tsx` summaryLine（ready/empty 两腿）、两页 `apv-page-count`、
  汇总条状态桶/风险桶计数（补范围说明）。
- 判定为「已声明范围的本地读数」，非总量文案，保持原样：`ActorBuckets.tsx:115`、
  `RiskQuickFilter.tsx:108`、`QueueSortBar.tsx` 注脚、`SinceQuickFilter`、
  各空态卡的「这是当前已加载 N 条里的真实结果…」、搜索框「仅在当前已加载 N 条内搜索」、
  `announcement()` 的「已加载 N 条」、CSV 的「共 N 行」（导出文件行数，单位是行，不是集合总量）。
- 全模块唯一还能出现「共 N 条」的地方＝读口真给了 `total` 键（契约升级腿），现网实测不出现。

## 3. 测试

- 新增 `web/src/modules/approvals/approvals.denominator.honesty.test.tsx`（9 例，mock 只打
  `@/lib/api` 的 `fetchJSON`，形制照 ApprovalsPendingModulePage.test.tsx / approvals.paging.test.tsx）：
  ① 队列无按加载数推算的总量（`已加载 3 条（非全量）` 上屏 ＋ `not.toContain("共 3 条")` ＋
  请求 URL 逐字＝`/agent-api/api/approvals?status=pending&limit=50`）；
  ② `total=null` 明说（原因句点名「没有 total 键」，empty 腿不写「共 0 条」）；
  ③ unreadable 出口（`2 条无法读取` 在汇总条，且不并进任何计数）；
  ④ 翻页后分母句仍只报已加载数（`已加载 4 条（非全量）`，无「共 4 条」）；
  ⑤ 契约升级腿（读口给 `total:42`）才允许 `共 42 条 / 已加载 3 条`，说明句退场；
  ⑥ 两路同形：缺省 / `status=all` / `status=expired` 三腿的分母句与分页句**逐字相等**，
  原因句各自说清自己的游标语义；URL 腿分别断言（不带 status / `status=all` / `status=expired`）；
  ⑦ 解析腿：两路实测形状 `total===null`，`total`/`count` 键才出数，裸数组不推算；
  ⑧ 写门未动：批准/驳回 `disabled`＋`aria-disabled=true`，点击后
  `/api/approval/decision` 调用数 **0**。
- 既有件按新口径改钉（同写域）：`approvals.paging.test.tsx` 1 处、`approvals.caliber.p1a2.test.tsx` 2 处、
  `ApprovalsPendingModulePage.test.tsx` 2 处、`ApprovalsHistoryModulePage.test.tsx` 2 处（含新增断言）。
- 门（原始尾行）：

```
$ cd web && node_modules/.bin/vitest run src/modules/approvals
 Test Files  87 passed (87)
      Tests  415 passed (415)
   Duration  7.64s (transform 12.56s, setup 0ms, import 47.93s, tests 23.25s, environment 42.10s)

$ node_modules/.bin/vitest run src/modules/approvals/approvals.paging.test.tsx \
    src/modules/approvals/approvals.cross.page.test.tsx \
    src/modules/approvals/approvals.empty.test.tsx \
    src/modules/approvals/approvals.denominator.honesty.test.tsx
 Test Files  4 passed (4)
      Tests  19 passed (19)
```

基线（改动前同命令）：86 files / 406 tests 全绿 ⇒ 本单 +1 file / +9 tests，无既有用例被删。

## 4. Build / lint / typecheck

```
$ cd web && node_modules/.bin/vite build          # 未用 pnpm run build（tsc -b 有仓级预存错）
✓ built in 5.90s        BUILD_EXIT=0
产物目录：hermes_cli/web_dist（.gitignore:100 已忽略，未提交）

$ cd web && node scripts/lint-fake-success.mjs    # 全仓与 src/modules/approvals 两跑同值
{ "script": "lint-fake-success", "file": "docs/console-v4-skeleton.html",
  "linesScanned": 9252, "allowedInfo": {"规划中":188,"不会保存":1,"未接入":22},
  "violations": [], "ok": true }                  violations=0 ✓

$ cd web && node_modules/.bin/tsc --noEmit -p .   TSC_EXIT=0（0 error）
$ cd web && node_modules/.bin/eslint src/modules/approvals
✖ 36 problems (0 errors, 36 warnings)   # 全为既有形制告警；本单新增 1 条
                                        # react-refresh/only-export-components（QueueSummaryBar
                                        # 导出分母句纯函数，与 SinceQuickFilter/views.tsx 同例）
```

## 5. 截图（真实渲染，`evidence/` 不提交）

- `/Users/kevin_studio/Projects/tasks/AP-01-pending-truth/evidence/ap01-history-1440.png`（1440×900）
- `/Users/kevin_studio/Projects/tasks/AP-01-pending-truth/evidence/ap01-history-375.png`（375×812）
  这两张是 **AP-01 改动可见态**：汇总条 `已加载 16 条（非全量）` ＋ 分页条同句 ＋
  `apv-denominator-note` 扇出/截断说明（375 档换行不破版、无横向溢出）。
- `/Users/kevin_studio/Projects/tasks/AP-01-pending-truth/evidence/ap01-pending-1440.png`（1440×900）
- `/Users/kevin_studio/Projects/tasks/AP-01-pending-truth/evidence/ap01-pending-375.png`（375×812）
  待处理 tab 真数据空队列（本机 pending＝0，见 §1），上屏的是本单替换掉的旧文案
  「共 0 条待处理审批」的新形态「本次读取没有返回待处理审批（读口不给总数）」，
  状态桶全部 `—`（不假 0）。
- 取图脚本 `evidence/ap01-shoot.mjs`：worktree `vite build` 产物经临时 v4_proxy(9141, loopback)
  同源提供，`/agent-api/*` 反代真 BFF(8092)；`domcontentloaded` ＋ 显式 settle 2.2s（禁 networkidle）；
  视口图（非 fullPage）；每次取图前断言 `whoami==200`；脚本自报浏览器实发请求
  `200 /agent-api/api/approvals?status=pending&limit=50` 与 `200 /agent-api/api/approvals?limit=50`。
  临时代理用完已杀，9122/9131 他道进程未动。

## 6. 与文档口径的偏差（如实记录）

1. **多改了 `ApprovalsHistoryModulePage.tsx`**（文档口径只列 Pending/QueueSummaryBar/model）。
   原因：③「钉死 `?status=all` 扇出与单态透传两路同形」的扇出腿只存在于历史页的「全部」视图，
   且汇总条 `QueueSummaryBar` 为两页共享——不同步接线就会出现「待处理诚实、历史仍错觉」的半吊子。
   改动限于：分母事实接线、`aggregated` 取代 `singleAgg`、分页句改走同一单点、more 钮原因句补截断事实。
2. **`useApprovalsData.ts` 只加注释、零代码改动**：文档预留了「回退实锤在此则允许改」，
   清点结论是该 `??` 跨页保留的是读口真值（`page.total`/`prev.total`），不是 `rows.length` 推算，
   故不改行为，只把判定写进注释。
3. **点名三件里有 4 处断言按新口径改写**（paging 1、caliber 1 组 2、Pending 2、History 2）：
   被改的正是 AP-01 要消掉的句式「总数不可用 · 已显示 N 条」「已到末页 · 已显示 N 条」
   「共 9 条 / 已显示 M 条」「已显示 1 条申请…」「共 0 条待处理审批」。
   `approvals.paging.test.tsx` 头注里「禁为此改产品文案」是 R139 纯测试车的纪律，
   本单由源单 §AP-01 步骤① 明确授权改文案，已在该文件头注记录改判来源。
   游标事实类断言（more 钮 disabled/title 含「已到末页」、去重、重试 +1、end chip 缺席）全部原样保留且绿。
4. **截图取了 4 张而非 2 张**：本机真数据 pending＝0，待处理 tab 上屏不到 `已加载 n 条（非全量）`
   的 n>0 形态；为让 DoD 的「改动可见态」有真行可证，另取历史页「全部」扇出腿 2 张（同一组件、同一单点）。
   `unreadable>0` 的「n 条无法读取」在现网真数据里取不到（16 行全部可读），
   该出口由新测试件的第 ③ 例钉住，未用 fixture 伪造上屏。
5. **`evidence/` 未提交**（按任务纪律），`hermes_cli/web_dist` 为构建产物且被 .gitignore 忽略。

## 7. DoD 对照

- 队列内不存在任何按已加载条数推算的总量文案 → §2 单点＋全量清点；
  新测试 `not.toContain("共 3 条")`／`not.toContain("共 0 条")` 钉住。
- `total=null` 时有明说 → 分母句 `已加载 n 条（非全量）` ＋ 原因句点名「读口顶层没有 total 键（实测 keys=…）」
  ＋ `apv-denominator-note` 一句到底/截断说明（截图上屏）。
- `unreadable` 有出口 → 汇总条 `apv6-summary-unreadable`「n 条无法读取」＋不计入任何计数的说明。
- 1440 与 375 两档截图各 1 张 → §5（另附待处理 tab 同两档）。
- 审批写开关保持关 → `DECISION_GATE` 零改动，新测试钉点击零 `/api/approval/decision` 请求。
