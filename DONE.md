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
