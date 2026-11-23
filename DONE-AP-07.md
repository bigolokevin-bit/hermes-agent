# DONE-AP-07 · 批量与筛选的服务端边界

工单：`seakoi-agent-os-l0-board/docs/product/backlogs/approvals-duty.md` §AP-07。
worktree=`/Users/kevin_studio/Projects/tasks/AP-07-batch-boundary`，分支 `task/AP-07-batch-boundary`，
基线 tip=`bad96db3e0`（=AP-03 tip）。栈合链 **AP-02 → AP-03 → AP-07**，L0 合并顺序同此。
node_modules / web/node_modules 均为 symlink，**未执行 pnpm install**。写域仅 `web/src/modules/approvals/**` ＋ 本文件。

## 1. 改动摘要（写域内）

**① 本地/服务端作用域边界可见**
- `gates.ts`：新增单点措辞 `crossPageLoadHint(hasMore)`——服务端还发着下一页游标时，
  本地过滤作用域句后追加「需先加载」提示；无游标返回空串（不画假边界）。
- `SinceQuickFilter.tsx` / `RiskQuickFilter.tsx` / `ActorBuckets.tsx`：各加 `hasMore` prop，
  在既有「按当前已加载 n 条统计，不是全量」作用域句后条件性挂 `<span data-testid="apv-*-crosspage">`。
- `QueueSortBar.tsx`：`QueueSortBar`/`QueueMetaNotes` 加 `hasMore`，排序作用域句与排序钮 title
  都接同一 `crossPageLoadHint`。
- `ApprovalsPendingModulePage.tsx`：搜索作用域句（`apv8-scope-note`）接 `hasMore` 提示；
  status 口径句加 `data-apv-status-scope="server"` 并明写「status 是唯一在服务端生效的筛选」；
  把 `hasMore=list.next!==null` 透传进四个本地过滤组件与排序条。
- `ApprovalsHistoryModulePage.tsx`：搜索作用域句接 `hasMore`；新增 `apv-h-status-note`
  （`data-apv-h-status-scope="server"`）明写八态＝服务端 status 筛选、其余＝本地过滤；透传 hasMore。

**② 批量禁用文案单源（写开关保持关，未做任何开闸）**
- `ApprovalsPendingModulePage.tsx`：逐单抽屉的可见禁用说明段（`apr5-actions-readonly-note`）
  由**分叉的第二套措辞**改为直接渲染 `{DECISION_GATE.title}`——环境只读这一句，全模块只剩
  `writeGate.ts` 一个字符串来源；批量钮 title 经 `batch.ts` 既有 writeOff L-case 复用同一句
  （`batch.ts:95 return DECISION_GATE.title`，未改）。
- `ApprovalsPendingModulePage.test.tsx`：原断言「title 与人话说明段是同一句话的两个出口」按现状
  改为「同一字符串单点」——`note.textContent.trim()).toBe(DECISION_GATE.title)`，并补 import 真实
  `DECISION_GATE`（本测试不 stub writeGate，用真实关态）。
- 开闸后的逐单顺序提交/任一失败即停/已决单不覆盖：`runBatch` 既有实现形态原样保留，未动；
  `DECISION_GATE.disabled` 仍为 `true`（本部署实测写 405），**未翻闸**。

**③ 历史页筛选冻结集**：八态组（all＋8 具体态）、时间（SinceQuickFilter＋恒 disabled 窗口控件）、
审批人（ActorBuckets）三条腿本已在；新增 `apv-h-status-note` 把「八态＝服务端、其余＝本地」边界写明。
时间窗跨度上限未定 ⇒ 窗口控件恒 disabled、文案「暂不可筛」，无任何编造的「最多 N 天」假边界。

**④ 分母护栏**：沿用 AP-01 已并线口径 `denominatorReadout`「已加载 n 条（非全量）」，未改、未回退。

**新增测试件**：`approvals.scope.server.test.tsx`（13 例，真组件＋真 fetchJSON 接缝，零 fixture）——
覆盖 ① 本地/服务端作用域标注＋跨页「需先加载」有无两态＋status=server 标注；② 真实 DECISION_GATE
关态下批量钮 title 逐字 == DECISION_GATE.title（含纯函数 batchGate writeOff）＋点击零决定请求；
③ message_send / high / critical 不可批量；④ 历史冻结集齐性＋窗口控件无假边界＋时间作用域句标本地。

## 2. 门禁原始 stdout（数字，evidence/ 不提交）

- 四件点名 `npx vitest run approvals.batch.test.tsx approvals.sort.filter.test.tsx approvals.sortfilter.combo.test.tsx approvals.history.filters.test.tsx`：
  **Test Files 4 passed (4) / Tests 26 passed (26)**（`evidence/raw-final-named.txt`）。
- 全模块 `node_modules/.bin/vitest run src/modules/approvals`：
  **Test Files 89 passed (89) / Tests 456 passed (456)**（`evidence/raw-final-full.txt`）。
  基线 88 文件 / 443 测试 → 现 89 / 456，**只增不减**（+1 文件 / +13 测试）。
- `node_modules/.bin/vite build`：**exit 0**（`evidence/raw-vite-build.txt`；未用 pnpm run build）。
- `node scripts/lint-fake-success.mjs`：**violations=[] / ok:true**，exit 0（`evidence/raw-lint-fake-success.txt`）。
- `npx tsc -p tsconfig.app.json --noEmit`：总 49 行 `error TS`，**全部在 `../apps/shared/*`（预存）**；
  `modules/approvals` 命中 **0**，web 侧（含写域）命中 **0**（`evidence/raw-tsc.txt`）。
- `node_modules/.bin/eslint src/modules/approvals`：**0 errors / 36 warnings**（全为既有
  `react-refresh/only-export-components` 形制告警，与 AP-03 基线同数，无新增 error）
  （`evidence/raw-eslint.txt`）。
- ② DoD grep（`evidence/raw-grep-single-source.txt`）：`DECISION_GATE.title` 生产码引用点＝
  `batch.ts:95` ＋ `ApprovalsPendingModulePage.tsx` 三处 `title=` ＋ 说明段 `{DECISION_GATE.title}`；
  分叉旧句「点了也不会生效 / 两个按钮先禁用 / 当前环境的控制台是只读的」命中 **0**。

## 3. 截图（真实渲染，`evidence/` 不提交）

- `/Users/kevin_studio/Projects/tasks/AP-07-batch-boundary/evidence/ap07-1440.png`（1440×900）
- `/Users/kevin_studio/Projects/tasks/AP-07-batch-boundary/evidence/ap07-375.png`（375×812，
  `document.scrollWidth=375`，无横向溢出）

取图形制复用 `AP-01/evidence/ap01-shoot.mjs`：worktree `vite build` 产物经临时 v4_proxy
（**自选 loopback 9171**，未动 9122/9131/9141/9151/9161）同源提供，`/agent-api/*` 反代真 BFF 8092；
`domcontentloaded`＋settle≥2.2s（禁 networkidle）；每图前断言 `whoami==200 user=opsadmin`；
视口图；用完即杀（已确认 9171 释放、9122/8092 未动）。脚本 `evidence/ap07-shoot.mjs`，
自报浏览器实发 `200 /agent-api/api/approvals?limit=50`（16 行真数据）。

两图拍到的是 **AP-07①③④ 的现网实态**：q/actor/since/risk/排序各自「仅在当前已加载 16 条内…」
作用域句、`apv-h-status-note` 服务端-vs-本地边界句、终态八态组、「时间窗：暂不可筛」（无假边界）、
汇总条「已加载 16 条（非全量）」。

## 4. 偏差与如实上报

1. **批量禁用文案「实态」未能取图**（诚实红线，未编造）：现网域内 `status=pending` 实测 **0 行**
   （`/agent-api/api/approvals?status=pending&limit=50` → `items` 长度 0；`?limit=50` 全量 16 行
   全为 expired/consumed 终态）。批量区按既有契约「无积极候选行 ⇒ 整块不渲染，不放永远点不动的死按钮」，
   故写开关关态下的批量钮在真数据里不出现；逐单抽屉的只读说明段也只在打开 pending 单时上屏，
   而 pending=0。两图因此拍到的是「筛选作用域标注」实态，批量禁用文案的**单源**改由 §2 grep 证据 ＋
   `approvals.scope.server.test.tsx` ②（真组件经 fetchJSON 接缝渲染 pending 行，断言批量钮 title
   逐字 == DECISION_GATE.title ＋点击零决定请求）钉住，未用 fixture/假行摆拍。
2. **跨页「需先加载」提示在现网取图里不显示**：本机数据量 < 单页 limit（16 行、单态扇出 nextCursor=None），
   服务端没给游标 ⇒ `hasMore=false` ⇒ 提示按设计不出现（这正是「不画假边界」）。该提示的有无两态由
   新测试件 ① 用带/不带 nextCursor 的接缝渲染钉住。
3. **多改了 `ApprovalsPendingModulePage.test.tsx`**（写域内测试件）：② 单源改造使可见说明段与
   title 从「同一句话两个出口」变为「同一字符串单点」，相应把该断言从 `toContain("控制台是只读的")`
   （该措辞不在 DECISION_GATE.title 里）改为 `toBe(DECISION_GATE.title)`，属本单授权的文案单源收敛。
4. 未新增任何 BFF/端点消费，全部沿用现网既有读口；写开关 `DECISION_GATE.disabled` 保持 `true`，
   未触碰 AP-04/05/06 的开闸前置。

## 5. DoD 对照

- 本地/服务端边界在界面上可见 → §1①＋§3 两图（作用域句＋server 边界句）。
- 批量与逐单禁用文案同源（grep 证明只有 DECISION_GATE.title 一个来源）→ §2 grep：分叉旧句命中 0，
  生产码只剩 DECISION_GATE.title 引用；新测试件 ② 逐字相等。
- 高风险/对外发送类不可批量断言绿 → 新测试件 ③（message_send/high/critical）＋既有 batch 件全绿。
- 历史冻结集齐性 → 新测试件 ④（八态＋时间＋审批人＋窗口无假边界）。
