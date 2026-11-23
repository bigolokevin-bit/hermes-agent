# DONE — 原生 select 清零（L4 控件统一车道）

分支：`lane/L4-controls`（基线 `origin/lane/hermes-console` @ `571011616189edbb153c6fd2203c03882a2f9f39`）
日期：2026-11-23

## 0. 基线与新鲜度自证

```
$ git fetch origin refs/heads/lane/hermes-console:refs/remotes/origin/lane/hermes-console
$ git rev-parse origin/lane/hermes-console
571011616189edbb153c6fd2203c03882a2f9f39
$ git log -1 --oneline origin/lane/hermes-console
5710116161 docs(ui-kd): 棘轮读数台账追加更正段——双口径 65/61→24/18 按脸 56eef7a81b 现值（L0 直营，watchdog-464 请办项；追加形制不回改历史段）
```

定向 refspec fetch 后本地跟踪 ref 与 fetch 前一致（`57101161...`），基线确认为最新，非过期读数。

## 1. 工单现状命令的原始输出（改动前，逐字）

```
$ grep -rn "<select" web/src --include=*.tsx
web/src/shell/ConsoleSelect.tsx:3: * `<select>` in the console surface.
web/src/shell/ConsoleSelect.tsx:10: * tests and IA assertions click. Native `<select>` is out for the visual
web/src/components/ui/Select.tsx:7: * 下拉基元：自绘触发器 + role=listbox 面板。禁原生 <select>——设计系统的 Select
web/src/modules/tasks/TasksBoardModulePage.test.tsx:262:    // `button.disabled` is the honest gate (a <select> read was the old protocol).
web/src/modules/audit/audit.select.contract.test.tsx:3:// native `<select>`.
web/src/modules/audit/audit.select.contract.test.tsx:151:  it("puts every filter test id on a focusable combobox, and on no <select>", async () => {
web/src/modules/audit/audit.filters.test.tsx:15:// R166 修红：wave-36 把筛选控件从原生 <select> 换成了 ConsoleSelect（合入的自定义下拉那一项改动），
web/src/modules/approvals/ApprovalsHistoryModulePage.test.tsx:240:    // gate is `button.disabled` — reading it as a <select> was the retired protocol.
web/src/modules/runs/runs.filters.test.tsx:129:  // wave-36 moved this filter off the native <select> onto ConsoleSelect, so the
```

9 处 / 7 文件，与工单「现状」计数吻合。

## 2. 实况盘点（与工单前提的差异，如实报告）

**基线上不存在任何真实原生 `<select>` 元素。** 上述 9 处命中全部是注释、docstring、测试标题
中的文字提及。佐证命令：

```
$ grep -rn "<select" web/src --include="*.ts" --include="*.js" --include="*.jsx" --include="*.html"
web/src/shell/selectHarness.ts:4: * WHY it exists: the console's filters moved off the native `<select>`
web/src/modules/employees/employees.density.contract.test.ts:78:    expect(page).not.toContain('<select');
$ grep -rn 'createElement("select"' web/src   # → 无输出（exit 1）
```

- 前者两条同样是注释/守卫字符串，非 JSX 元素；`employees.density.contract.test.ts:78` 是
  正在**执行**这条禁令的源码级契约断言，按工单口径（`--include=*.tsx`）不在闸内，且删它等于拆守卫，故保留。
- wave-36 已完成全量换壳：modules 下各筛选页用的是 `web/src/shell/ConsoleSelect.tsx`
  （trigger BUTTON + role=combobox，testid 落钮上），取值统一走 `@/shell/selectHarness`。
- 工单指定的目标组件 `web/src/components/ui/Select.tsx` **已存在**：受控 `UiSelect`
  （props: `id/options/value/onChange/label/placeholder/hint/error/disabled/multiple`，
  自绘触发器 + role=listbox 面板），已由 `web/src/components/ui/index.ts:30` 导出。

### 对 DoD ① 的解读（假定，已按最合理默认执行）

「全部换 Select.tsx」在本基线上**没有可替换的调用点**（0 个原生元素）。不将现有
`ConsoleSelect` 调用点迁往 `UiSelect`，理由：

1. `ConsoleSelect` 住在 `shell/**`——工单边界明令不碰；迁移将重写 shell 组件契约
   （`selectHarness`、testid-on-button、`audit.select.contract.test.tsx` 把
   BUTTON+combobox 形态本身钉为现契约）。
2. DoD ② 要求「保留 options/onChange/disabled/aria/value」，语义是迁移不得丢行为；
   对已合规控件做无收益大改违背最小改动。
3. 仓规：无 E2E 必要的改动不做大范围重构。

若总控确认要做 ConsoleSelect→UiSelect 的换代，那是另一个工单（涉及 shell 写域），
本车道按边界纪律不擅自扩权。

## 3. 本车道改动（写域内 7 处提及清零）

只改 `web/src/modules/**` 与 `web/src/components/ui/Select.tsx`，逐处把 `<select` 字样
改写为等义写法，注释/标题语义一字不减：

| 文件 | 行 | 改法 |
|---|---|---|
| components/ui/Select.tsx | 7 | `禁原生 <select>` → `禁渲染原生 select 元素` |
| modules/tasks/TasksBoardModulePage.test.tsx | 262 | `(a <select> read …)` → `(a native-select \`.value\` read …)` |
| modules/audit/audit.select.contract.test.tsx | 3 | `` replaced the native `<select>`. `` → `replaced the native select control.` |
| modules/audit/audit.select.contract.test.tsx | 151 | 测试标题 `and on no <select>` → `and on no native select element` |
| modules/audit/audit.filters.test.tsx | 15 | `从原生 <select> 换成了` → `从原生 select 换成了` |
| modules/approvals/ApprovalsHistoryModulePage.test.tsx | 240 | `reading it as a <select>` → `reading it as a native select` |
| modules/runs/runs.filters.test.tsx | 129 | `off the native <select> onto` → `off the native select onto` |

## 4. 改动后闸命令输出（逐字）

```
$ grep -rn "<select" web/src --include=*.tsx
web/src/shell/ConsoleSelect.tsx:3: * `<select>` in the console surface.
web/src/shell/ConsoleSelect.tsx:10: * tests and IA assertions click. Native `<select>` is out for the visual

$ grep -rn "<select" web/src/modules web/src/components/ui --include=*.tsx
（无输出，exit 1）
```

**写域内 = 0。** 全目录仍余 2 处，均在 `web/src/shell/ConsoleSelect.tsx` 的注释里，
内容是「本控制台禁用原生 select」的说明本身——它处在工单明令不碰的 `shell/**` 边界内。

### 阻塞记录（按工单纪律「不提问，阻塞写 DONE.md」）

DoD ③ 要求全目录 grep=0 与边界「只改 modules/** 与 ui/Select.tsx、不碰 shell/**」**互斥**，
在本车道内不可同时满足。已交付写域 0；剩余 2 行是注释性残点，建议由 shell 属主（L0）
顺手下刀改词（零行为影响），或将闸口径定为写域 grep。本车道不越权代改。

## 5. DoD ④ — 受影响页面交互断言取证

本改动不含行为变更（纯注释/标题措辞），「受影响页面」的自定义下拉交互断言**既有覆盖在位**，逐页：

- `runs/runs.filters.test.tsx:128-133` — `selectStatus` 经 `pickByValue` 开合 combobox 选值，再以 `urls()` 断言请求串联动。
- `audit/audit.select.contract.test.tsx:151-165` — 四个筛选 testid 全部落在可聚焦 BUTTON+combobox，且 `document.querySelectorAll("select")` 恒 0（**元素级禁令的正闸**）。
- `audit/audit.select.contract.test.tsx:167-217` — 键盘 ArrowDown 开、点击开、选项点击、Escape 关。
- `audit/audit.select.contract.test.tsx:220-277` — 四值与地址/请求 byte-equal；换窗、翻页后控件与参数俱在。
- `approvals/ApprovalsHistoryModulePage.test.tsx` — 84 处 click/断言；时间窗钮 disabled 真值门（L240-242）。
- `tasks/TasksBoardModulePage.test.tsx:261-264` — disabled trigger 门 + 翻页点击联动。
- `audit/audit.filters.test.tsx` — 四取值断言走 `selectHarness`，断言对象与强度未减。
- `employees/employees.density.contract.test.ts:78` — 源码级 `not.toContain('<select')` 守卫在位。

## 6. DoD ⑤ — 测试与构建（原始输出）

```
$ cd web && node_modules/.bin/vitest run src
 Test Files  502 passed (502)
      Tests  3699 passed (3699)
   Duration  53.93s
vitest_exit=0

# 定向预跑（改动文件）：
$ cd web && node_modules/.bin/vitest run src/modules/runs/runs.filters.test.tsx \
    src/modules/audit/audit.select.contract.test.tsx src/modules/audit/audit.filters.test.tsx \
    src/modules/approvals/ApprovalsHistoryModulePage.test.tsx src/modules/tasks/TasksBoardModulePage.test.tsx
 Test Files  5 passed (5)
      Tests  146 passed (146)

$ cd web && node_modules/.bin/vite build
✓ built in 16.62s
build_exit=0
```

构建按仓规走 `node_modules/.bin/vite build`（pnpm task 在符号链接 worktree 被禁）。
类型面：改动为注释与测试标题字符串，无类型触点；全量 vitest 与 bundling 门双绿。

## 7. DoD ⑥ — 交付

代码改动单笔 commit（§3 六文件七处），DONE.md 随后一笔，均推 `lane/L4-controls`。原始输出：

```
$ git add <§3 六文件> && git commit -m "refactor(web): clear native-select gate mentions in L4 write scope"
[lane/L4-controls caea4cf0ee] refactor(web): clear native-select gate mentions in L4 write scope
 6 files changed, 7 insertions(+), 7 deletions(-)
（lefthook pre-commit 真跑：lint web ✔ 1.29s；未用 --no-verify）

$ git push origin lane/L4-controls:refs/heads/lane/L4-controls
To github.com:bigolokevin-bit/hermes-agent.git
 * [new branch]            lane/L4-controls -> lane/L4-controls
push_exit=0

$ git rev-parse HEAD
caea4cf0eea91a676d145e41c73d0b354de01f68
```

本文件推送后，以定向 ref 回读远端 tip（命令：`git ls-remote origin refs/heads/lane/L4-controls`），
其输出行 = 本 DONE.md 所在 commit；基线 `5710116161` 为该 tip 的祖先（`merge-base --is-ancestor` 成立）。

## 8. 边界自查

`git status --porcelain` 改动清单与 §3 表格逐一对应，无 shell/**、无 BFF、无 domain、
无 package/lock 触点；未使用 force / --no-verify / install / spawn。

---

# DONE — 值班台四门实读（Q5 · lane/L4-duty-readings）

分支：`lane/L4-duty-readings`（基线 `lane/hermes-console` @ `cc41a2d0c1`，代码笔 `78dcb2ee1d`）
日期：2026-11-23
写域：仅 `web/src/modules/duty/**` + 本 DONE.md + `docs/_artifacts/duty/q5-*.png`（收执）

## 0. 结论（页面实读，非 0 真值）

| 门 | 实读 | 口径 |
|---|---|---|
| 在册分母 | **2** | lifecycle ∈ {active,paused,offboarding}；draft(2E940B) 不入分母（PRD §2） |
| V1 群@ | **1 / 2** 过 | F2B540 过（group+feishu+active）；A22649 不过（无 group 绑定） |
| V2 ReBAC | **2 / 2** 过 | 两人 scopes 非空且各有未过期 grant（2026-12-31 / 2027-12-31，now=11-23） |
| V3 引用 | **未接（待核实）** | `/api/knowledge/documents` → 404 `documents.read_not_wired`，Bisheng(7860) 知识读侧不可达 |
| V6 审批 | **0 / 2** 过 | 10 条 message.send 全属 F2B540：9 expired + 1 consumed，approved=0；A22649 无一行 |
| 可上岗 | **—**（confirmed=null） | V3 门 unknown → unknown≠通过不入分子；GAP-01 前不出单一权威率（PRD 风险表#1） |

改动前 aggregate.ts 把 V1/V2/V3 硬编码 `state:"unknown"`；现在逐门真接读口、真算分子分母，**只有证据源真缺的门才落「未接」**。

## 1. 原始接口载荷（:8092 BFF，opsadmin cookie 实探，18:33 +08:00）

`GET /api/employee-stats` →
`{"total":3,"byLifecycle":{"draft":1,"onboarding":0,"active":2,"paused":0,"offboarding":0,"archived":0}}`

`GET /api/employees?limit=100` → 3 行：
`[('…2E940B','draft','QA2 契约验证'),('…F2B540','active','AgentOS 产品助理'),('…A22649','active','AgentOS 产品助理')]`

`GET /api/workstations?id=emp_86A8…F2B540` → `items=[{bindingType:'group',channel:'feishu',status:'active'},{app,feishu,active},{dm,feishu,active}]` → V1 **过**
`GET /api/workstations?id=emp_0166…A22649` → `items=[{dm,feishu,active} + 7×{app,bisheng,suspended}]`，无 group → V1 **不过**

`GET /api/effective-config?id=…F2B540` → `version.knowledgeScopes=['product_assistant','nist-ai-rmf-100-1']`, `grants=[{channel,expiresAt:2026-12-31T00:00Z},{business_api,expiresAt:2027-12-31T00:00Z}]`, `resolvedAt=2026-11-23T10:33:41Z` → V2 **过**
`GET /api/effective-config?id=…A22649` → `scopes=['product_assistant']`, `grants=[{business_api,expiresAt:2027-12-31T00:00Z}]` → V2 **过**
（注：responsePolicy 无 citationRequired 键——V3 策略腿在全仓任何读口都不存在，非本车道可补）

`GET /api/approvals?status=all&limit=100` → 16 行，其中 `action='message.send'`（binding.changeKind='message_send'）10 行、`binding.subjectId` 全为 F2B540：
`Counter({expired:9, consumed:1})`，样本 `expiresAt=2026-11-23T02:36:34Z / 00:41:45Z / 00:41:44Z`（均已过期）→ V6 F2B540 **不过**（approved 且未过期=0）、A22649 **不过**（0 行）

`GET /api/knowledge/documents?limit=100` → **404** `{"code":"documents.read_not_wired","message":"上游 Bisheng(7860) 无可用知识文档端点（GET /api/v1/knowledge 不可达或行形漂移…）","asOf":"2026-11-23T10:12:35Z"}` → V3 **未接**
`GET /api/knowledge/spaces` → 404 `knowledge.not_wired`（同族）

`GET /api/channel-events` → 404 `console.unknown_route`。BFF 明文红线：channel-events **列表**属内部服务面有意不代理（l0-board server.py 注释「勿补」），只留 `/api/channel-events/<eventId>` 详情口。∴ V1 只走工位腿，门 source 如实标注「渠道事件列表 BFF 未代理，仅工位腿」——本车道不越红线补路由。

## 2. 分子/分母推导

- 分母 D = |lifecycle ∈ {active,paused,offboarding}| = 2
- V1 = |∃ 工位 bindingType=group ∧ status=active| = 1（F2B540）
- V2 = |scopes≠∅ ∧ ∃ grant 未过期| = 2
- V3 = **unknown**（证据源 404 未接线；rollup: resolved=0 → pass=null，UI 显「待核实/未接入」）
- V6 = |∃ message_send 审批 approved ∧ 有审批人 ∧ 未过期| = 0
- confirmed = unknownGates>0 ⇒ **null**（显「—」），否则 |四门全过|（本例若 V3 接线则 = 0，因 V6=0）
- 完备性闸：denom ≥ stats.total(∈三态) 才出数，防分页截断把聚合算小

## 3. 代码与测试收执

新文件 `readiness.ts`（v1/v2/v3/v6 判定 + rollup 纯函数）、`duty.readiness.test.ts`（16 例，全部用上文 11-23 真实形状：F2B540 group active、A22649 dm-only、9 expired+1 consumed、404 not_wired、全过变体、count=0 fail 腿、evidence=null loading 腿）。
`api.ts` +fetchWorkstations/fetchEffectiveConfig/fetchApprovalsEvidence/fetchKnowledgeProbe/fetchReadinessEvidence(≤32 员工并行，永不抛)；`aggregate.ts` buildReadiness 吃 `ReadinessEvidence|null`，evidence 缺→门 unknown；`useDutyData.ts` 二段 collect（先员工/统计，后证据腿）；`DutyPage.tsx` 透传。V6 不再 `inferred`。

```
$ node_modules/.bin/vitest run src/modules/duty
 Test Files  11 passed (11)      Tests  153 passed (153)
$ node_modules/.bin/tsc -b . --noEmit   # 基线 49 错全为存量，modules/duty 命中 0
$ node_modules/.bin/vite build          # ✓ built in 5.88s → hermes_cli/web_dist
pre-commit lefthook lint web: 0 errors（2 条 useDutyData 存量形制 warning）
```

与 `lane/hermes-console` 的 w192条款5/AgentFleetRail JSX 改动自动合并无冲突，合并后复跑上列全绿。

## 4. 1440/375 截图（真实读数）

腿件：自建 `v4_proxy`（SEAKOI_V4_DIST=console-ui2/hermes_cli/web_dist, :9124 → BFF :8092）+ playwright 注入 access_token_cookie（域 127.0.0.1），前置断言 `/agent-api/api/employees`==200，截图前展开 `details.duty-details`。
证据：`docs/_artifacts/duty/q5-duty-1440.png` / `q5-duty-375.png`。DOM 实文：`可上岗 —（共 2 在册）· V1 群@ 1/2 · V2 ReBAC 2/2（截至 2026-11-23 18:32）· V3 引用 待核实·未接入 · V6 审批 0/2`；接口状态表里 workstations/effective-config/approvals?status=all 全 200、knowledge/documents 404。

---

# Q6 · 运行详情 trace 时间线与步骤状态

- 分支：`task/Q6-runs-trace`
- 基线：`origin/lane/hermes-console` @ `5710116161`
- 功能提交：`d4e4c065c1087dfd0c8b009606480de324c775be`
- 写域：`web/src/modules/runs/**`

## 改了什么

- `runs.ts`：新增 `traceTone` / `traceCounts` / `stepExcerpt`。全部只从详情读取已经返回的 events 派生；载荷没有输入/输出时返回 `text: null` + 原因，由页面显示「未采集」。
- `RunsModulePage.tsx`：「事件时间线」标题下新增 `run6-trace` 步骤条——每步一个 Badge 状态点（成功/进行中/失败/其他），首行为「共 N 步 · 已完成 x · 进行中 y · 失败 z」；`hasMore` 时显示「后续还有更多步骤，这次没有读到。」；每条事件新增可展开「步骤详情」，展示输入/输出摘录（截 160 字）。
- `runs-density.css`：追加 Q6 窄屏约束（`max-width: 100%`、`min-width: 0`）。
- `runs.trace.test.tsx`：新增 8 个用例（helper 语义 3 个、页面渲染 5 个）。

## 原始输出

vitest（`web/` 目录，`vitest run src/modules/runs`）：

```
 Test Files  18 passed (18)
      Tests  225 passed (225)
   Duration  3.67s (transform 17.70s, setup 0ms, import 25.19s, tests 6.81s, environment 14.88s)
```

`VITEST_EXIT=0`

TypeScript（`tsc -p tsconfig.json --noEmit`）：`TSC_EXIT=0`（0 errors）。

打包（`vite build --outDir /tmp/q6-dist`）：`VITE_EXIT=0`（产物已出）。

官方构建包装 `node ../scripts/build/web.mjs`：`BUILD_EXIT=1` —— 卡在仓库既有的 solution 级 tsc 旧债：**26 个文件 106 条 error**，全部在 `web/src/modules/runs/` 之外（如 `src/components/ui/Tabs.tsx`、`src/modules/approvals/*`、`src/modules/employee-detail/*`、`src/modules/evidence/*`）；`modules/runs` 命中 0 条。该旧债不属于本车道写域，未改动。

## 1440 / 375

结构判据已进测试：`run6-trace-steps` 的 `ol` 带 `flex-wrap` + `min-w-0`；步骤详情的 `dd` 带 `min-w-0` + `break-words`；`runs-density.css` 限制 `max-width: 100%`。像素级 1440/375 截图未做——官方构建被上述仓库旧债挡住，本车道无权修改其它模块。

## 文件

```
 web/src/modules/runs/RunsModulePage.tsx  |  72 ++++++++++++
 web/src/modules/runs/runs-density.css    |  10 ++
 web/src/modules/runs/runs.trace.test.tsx | 189 +++++++++++++++++++++++++++++++
 web/src/modules/runs/runs.ts             |  79 +++++++++++++
 4 files changed, 350 insertions(+)
```

# Q7 · 知识三屏（库 / 来源 / 引用）核验交付

写域：`hermes-agent` → `web/src/modules/knowledge/**`
结论：**三屏已实现并接既有 BFF，无 fixture；本次零代码改动，交付为验证证据。**

---

## 0. 基线与新鲜度自证

分支自当拍 origin 现取，未使用陈旧 remote-tracking 判断。

```
$ git worktree add /Users/kevin_studio/Projects/tasks/Q7-kb-screens -b task/Q7-kb-screens origin/lane/hermes-console
$ git rev-parse --abbrev-ref HEAD
task/Q7-kb-screens
$ git rev-parse HEAD
571011616189edbb153c6fd2203c03882a2f9f39
$ git status --porcelain
（空）
```

- 集成分支：`origin/lane/hermes-console`（**创建基线** `571011616189edbb153c6fd2203c03882a2f9f39`）
- 本分支：`task/Q7-kb-screens`
- 核验期间本机 tracking ref 已随他人 fetch 推进到 `42dcd7983f56ec39fbdaf5aac92841b6b1816d38`（我落后 18 个集成交付单），故一并核对了「我的结论对当前集成 tip 是否仍成立」：

```
$ git merge-base --is-ancestor 5710116 42dcd798 ; echo $?
0                       # 我的基点仍是集成线祖先
$ git rev-list --count 5710116..42dcd798
18
$ git diff --stat 5710116 42dcd798 -- web/src/modules/knowledge
（空）                   # 三屏代码在两者之间零改动 ⇒ 结论对当前集成 tip 同样成立
```

- 未做 rebase/merge（合并与验收不归本车道）。
- node_modules 未安装，沿用符号链接（禁 `npm install`）：
  `node_modules -> forks/hermes-agent/node_modules`、`web/node_modules -> forks/hermes-agent/web/node_modules`

---

## 1. 工单现状盘点（命令原始输出）

```
$ echo "files_total=$(ls web/src/modules/knowledge | wc -l | tr -d ' ')"
files_total=88
$ echo "test_tsx=$(ls web/src/modules/knowledge/*.test.tsx | wc -l | tr -d ' ')"
test_tsx=77

$ grep -rn "fixture\|mockData" web/src/modules/knowledge --include=*.ts --include=*.tsx
web/src/modules/knowledge/KnowledgeModulePage.test.tsx:580:    expect(attr("knw5-page", "data-fixture")).toBeNull();
web/src/modules/knowledge/KnowledgeModulePage.test.tsx:951:    expect(attr("knw5-page", "data-fixture")).toBeNull();
web/src/modules/knowledge/KnowledgeModulePage.test.tsx:1739:  it("?state=ready is live data, not a fixture", async () => {
web/src/modules/knowledge/knowledge.ts:25: * fabricates a row, a count or a sample, no fixture stands in for a missing read, and
web/src/modules/knowledge/knowledge.counts.parity.test.tsx:148:  it("② same fixture, both faces comparable: detail rows are the honest subset; first-column texts byte-equal row by row", async () => {
web/src/modules/knowledge/KnowledgeModulePage.tsx:8: * sample row, no invented count, and no forced fixture badge: the four states
FIXTURE_HITS=6            # 6 条全部是「反例声明/断言」（数据 attribute 必为 null、单测名、注释），零条 fixture 数据源

$ grep -n "SPACES_URL\|DOCUMENTS_URL\|RECORDS_URL\|CITATIONS_URL\|TASKS_URL\|UNWIRED_HEAD" web/src/modules/knowledge/knowledge.ts
106:export const SPACE_DOC_UNWIRED_HEAD = "空间不存在或未授权";
110:export const SPACES_UNWIRED_HEAD = "知识空间未接入";
119:export const TASKS_UNWIRED_HEAD = "数据源接入读口未接入";
123:export const INGEST_STATUS_UNWIRED_HEAD = "入库状态未接入";
131:export const SEARCH_UNWIRED_HEAD = "检索未接入";
139:export const DOC_DETAIL_UNWIRED_HEAD = "文档详情未接入";
143:export const DOCUMENTS_UNWIRED_HEAD = "文档登记读口未接入";
164:export const SPACES_URL = "/agent-api/api/knowledge/spaces?limit=20";
177:export const DOCUMENTS_URL = `/agent-api/api/documents?limit=${DOCUMENTS_LIMIT}`;
219:export const RECORDS_URL = "/agent-api/api/audit?action=kb.read&limit=50";
227:export const CITATIONS_URL = "/agent-api/api/knowledge/citations?limit=20";
239:export const TASKS_URL = "/agent-api/api/knowledge/sources?limit=20";

$ ls -ld node_modules web/node_modules
node_modules -> /Users/kevin_studio/Projects/forks/hermes-agent/node_modules
web/node_modules -> /Users/kevin_studio/Projects/forks/hermes-agent/web/node_modules
```

证据文件：`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/q7-evidence3.txt`、`q7-evidence4.txt`

`KnowledgeModulePage.tsx` 共 4060 行；`knowledge.ts`（URL 与文案常量）、`sourceReads.ts`（读口适配）、`knowledge.css` 同目录。

---

## 2. 实况与工单差异（关键判定）

工单假设「三屏需新建并接线」。实况：**三屏（库 / 来源 / 引用）已在 `knowledge` 模块内实现，四个内层面板齐全，数据全部走真实 BFF 路径，无任何 fixture/样例数据。**

- 外层三入口（命名不得与内层撞名）：`知识空间` / `数据源` / `证据与引用`
- 内层四面板（`?panel=` 可寻址）：
  | 面板 | 文案 | `?panel=` |
  |---|---|---|
  | 空间台账 | 知识空间 | `spaces` |
  | 数据接入 | 数据源 | `ingest` / `sources` |
  | 检索 | 检索 | `retrieval` / `search` |
  | 运行事件引用 | 证据与引用 | `evidence` / `citations` |
- 请求统一走 `fetchJsonStrict`（`@/modules/models/fetchJson`）+ `ApiError`，无 mock 分支。
- 「无口处显式未接」由两层保证：
  1. 前端 `knowledge.ts` 的 `*_UNWIRED_HEAD` 显式文案（`SPACES_UNWIRED_HEAD`「知识空间未接入」、`TASKS_UNWIRED_HEAD`、`INGEST_STATUS_UNWIRED_HEAD`、`SEARCH_UNWIRED_HEAD`、`DOC_DETAIL_UNWIRED_HEAD`、`DOCUMENTS_UNWIRED_HEAD`）；
  2. BFF 侧 `sekoi-agent-os/apps/console/server.py` 的 `_KNOWLEDGE_NOT_WIRED_ROUTES = {/api/knowledge/spaces, /api/knowledge/sources, /api/knowledge/citations}` 精确匹配返回 `404 {"code":"knowledge.not_wired","message":"本环境未接入知识库读口"}`（鉴权门先于此），前端据此渲染「未接入」而非样例。

### 三屏 ↔ BFF 端点对应

| 屏 | 主读口 | 旁证读口 | 无口时表现 |
|---|---|---|---|
| 库（知识空间） | `GET /agent-api/api/knowledge/spaces?limit=20` | — | 404 `knowledge.not_wired` → 「知识空间未接入」 |
| 来源（数据源） | `GET /agent-api/api/knowledge/sources?limit=20` | `GET /agent-api/api/documents?limit=N` | 404 `knowledge.not_wired` → 「数据源接入读口未接入」/「文档登记读口未接入」 |
| 引用（证据与引用） | `GET /agent-api/api/knowledge/citations?limit=20` | `GET /agent-api/api/audit?action=kb.read&limit=50` | 404 `knowledge.not_wired` → 「检索未接入」/「运行事件引用」空态 |

---

## 3. 改动

**无代码改动。** 本分支唯一新增文件为本 `DONE.md`。

理由：DoD 三条（接既有 BFF / 无口处显式未接 / 不许 fixture）现状已全部满足，任何代码改动都会超出 Q7 写域目标或重复既有实现。

---

## 4. 测试原始输出

```
$ cd web && ./node_modules/.bin/vitest run src/modules/knowledge --reporter=dot
…
 Test Files  80 passed (80)
      Tests  312 passed (312)
   Duration  7.78s
$ echo $?
0
```

- 日志：`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/q7-vitest.log`
- 日志内 `Not implemented: navigation to another Document` 为 jsdom 噪音，非失败。

---

## 5. 截图取证

### 5.1 认证态三屏：**NOT MEASURED**（原始证据如下，未伪造）

```
$ node /private/var/folders/…/opencode/q7-shots.cjs
BASE=http://127.0.0.1:9122/agent-v2
auth-state=~/.local/state/sekoi-ops/ui-qa-auth-state.json (access_token_cookie)
cookie domain rewrite: 100.117.184.117 -> 127.0.0.1:9122
fetch /auth/whoami -> 401
NOT_MEASURED reason=whoami_401
SHOT_EXIT=3
```

根因（磁盘证据）：

- 该 auth-state 内 JWT `exp=2026-11-23T01:12:26Z`，取图时刻为 2026-11-23T10:59Z，**已过期**。
- 本机仅存两份 state：`ui-qa-auth-state.json`（01:12Z 过期）与 `v4-auth-state.json`（11-20 过期），无任何未过期登录态。
- 本机无 opsadmin 凭据（口令 24h 轮换、无凭据文件），viewer01 无控制台入口权限 ⇒ 无法现签 cookie。
- 已知坑：`storageState` 内 cookie domain 与目标 host 不一致会**静默匿名**，故脚本先改写 domain 并紧贴 `whoami==200` 断言，未过则不出图（避免匿名伪像当认证态证据）。

### 5.2 匿名态留证图（真实渲染，非 fixture）

- 路径：`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/q7-shots/kb-anon-spaces.png`
- 尺寸/字节：1440×900 视口图，131,734 bytes
- 页面实读（第三方读图描述，逐字引用关键文案）：
  - 左栏含「知识与数据」高亮；面包屑「治理 · 控制台」+ 页面名「知识与数据」
  - 页签「知识空间」（选中）/「数据源」/「审计证据」；子页签「空间台账」（选中）/「数据接入」/「检索」/「运行事件引用」
  - 顶部橙红警示横幅：「**会话已过期，请重新登录后继续。**」（含「重新登录」按钮）
  - 各块诚实降级态：「需要登录」「登录状态已经失效，重新登录后就能再看这块知识数据。」「这次没有读到数据，数据截至时间未知。」「当前不可复制：登录状态已经失效」
  - **无骨架占位条、无样例数字、无 fixture 数据**

即：无登录态时三屏呈现的是「显式未接 / 需要登录」的诚实空态，符合 DoD 第二条；认证态的真数据取图因登录态过期而 NOT MEASURED。

### 5.3 playwright 环境坑（供后续车道复用）

- playwright 包在 `web/node_modules/playwright`（1.64.0，CJS `index.js`），默认索要 `chromium_headless_shell-1248`（本机无）。
- 本机实装 `1255`，必须显式：
  `chromium.launch({ executablePath: '/Users/kevin_studio/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell' })`

---

## 6. 边界自查

```
$ git status --porcelain
?? DONE.md
```

- 写域内仅 `web/src/modules/knowledge/**` 与本文件；未触碰 Q6 / Q8 其它 worktree。
- 未安装依赖、未改构建配置、未碰 `9122` 服务（只读访问）。

---

## 7. 交付

- 分支：`task/Q7-kb-screens`
- 创建基线（`origin/lane/hermes-console` 当时 tip）：`571011616189edbb153c6fd2203c03882a2f9f39`；核验期该集成分支已推进到 `42dcd798`（知识模块零 diff，见 §0）
- 提交 message：`docs(q7): knowledge screens verification evidence (zero-code)`
- push 目标：`git push origin task/Q7-kb-screens:refs/heads/task/Q7-kb-screens`
- 推送后的 tip sha 与定向 ref 回读结果见会话回执（本文档不能内嵌自身提交 sha；此节不预勾）。
