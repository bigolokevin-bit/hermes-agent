# DONE-AP-08 审计留痕展示（含拒绝票）

车道：`task/AP-08-audit-trail`（栈合：AP-02→AP-03→AP-07→AP-08），base tip `84778635b5`（AP-07）。
工单：板仓 `docs/product/backlogs/approvals-duty.md` L96-106 §AP-08（已读原文）。

## 写域执行声明

- 改动仅三处：`web/src/modules/approvals/views.tsx`（②作用域声明句 1 段）、
  `web/src/modules/approvals/approvals.detail.links.test.tsx`（+AP-08 describe 3 测）、本文件。
- `web/src/modules/audit/**` **零改动**（git 可验：diff 面不含该目录）——对其只读盘点，
  需求单见下。主仓 `apps/console/server.py`（板仓检出）与 `services/domain/approvals.py` 只读核对。
  DECISION_GATE 一行未碰，写开关保持关。`evidence/` 不提交。

## 一、实装腿（approvals 写域内）

### ② 详情侧「在审计中查看」——保持 resourceId 真过滤＋作用域声明上屏

- 真链保持：`/audit?resource=<ap_…>`（views.tsx R82 段，页级 `?resource=` → wire `resourceId=`，
  aud8 契约；AP-03 已实装，本道未动链路本身）。
- **新增屏上声明句**（`data-testid="apd9-audit-scope-note"`）：此前「按单据过滤、非事件行定位」
  只在链接 `title`（悬停才见），而同屏「处理记录」段确实会给出事件行定位链（真带回 eventId 时）——
  两条链形制不同、用途不同，工单 ② 要求在界面/文案写明，故补一句可见文本。
- **禁 `?event=` 编造：现网代码已符合，未为改而改。** grep 证据：
  - `grep -n 'event=' web/src/modules/approvals/views.tsx` → 命中 3 处，全部是注释纪律句
    （L685/L1307/L1330），无一条拼在链路上；
  - 事件级定位链唯一实装点 views.tsx L849-858：`row.rawId` 存在（响应真带回 eventId）才渲
    `?event=`；缺 id 走 L860「这条没带回事件标识，故不给定位链」；
  - 该参数**真被审计页消费**（非伪造的前提成立）：`audit/AuditEventsModulePage.tsx` L885
    `const deepLinkId = params.get("event")`（aud9 深链定位一行的实现腿），
    `audit/permalink.ts:20` `DEEP_LINK_PARAM = "event"`。

### ③ 遮蔽核对——经过的是 **audit 模型腿**，不是 approvals model.ts；覆盖两类行，无泄露

工单假设「若经过 approvals 模块的 model.ts handle 遮蔽」——实况：AP-03 起内联「处理记录」段复用
`auditPageFrom`（approvals/api.ts L92-106 明写「行解析复用 auditPageFrom（单点），不在此另起一套」），
遮蔽腿是 `audit/model.ts` 的 `actorView→maskedName`（L145-158）＋ `shortCode`（L134-141）＋
`SCHEME_PREFIX`（L100，含 `human`）。核对结论**已符合**，逐条：

- CR-028 裸 id（实测活体形制 `actor={type:"human",id:"1"}`）：`shortCode("1")` 尾段 <4 字符 ⇒
  不落短码，label 落裸角色词「成员」；原值只进 `title`（本仓既有 R267 形制）。屏上无 `human:` 前缀、
  无裸数字。`approval.decided` 与 `approval.denied`（拒绝票，见 §二 R1 说明）两类行同走这一条
  逐行腿，覆盖天然齐。
- `error.messageRedacted` 工程句（"denied by domain validation; raw message not stored in audit"）：
  进 `reasonOf`（audit/model.ts:677-681→errorText:659-661），而内联段行面按 AP-03 纪律只渲
  action/actor/time（views.tsx L845-847 注释点명），工程句不上中文屏。
- 真渲染取证：`evidence/ap08-1440.png` 行面读数（脚本自报 stdout）——
  「驳回审批 · 成员」「给出审批结论 · 成员」「审批超时未处理 · 服务账号 · sweeper」。

### ④ 导出钮——approvals 侧无「计划中」钮；真导出钮禁用态零成功已钉

- `grep -rn "data-planned" web/src/modules/approvals/*.tsx | grep -v test` → **0 命中**：
  approvals 写域不存在 planned 形态按钮（工单 ④ 的「审计导出」本体在 audit 面，见 §二 R4）。
- 唯一的 approvals 导出钮 `QueueCsvExport.tsx` L114-116：`disabled={!gate.enabled}` ＋
  `aria-disabled={!gate.enabled}` ＋ gate.title 单源（`gates.ts` 可用性矩阵）。本模块**结构上
  没有成功话术机制**（无 role=status announce），「点击零成功提示」为天然真；新增测试仍把
  空列表态的 disabled＋aria-disabled＋点击后屏面无「导出成功/已导出/导出完成」钉死。

## 二、给 aud 车道的需求单（① 审计面腿，本道零改动，只读盘点）

**工单快照与现网的一处形制差**：工单现状证据写「拒绝路径 `_record_not_approver_audit(...,
denied_code="approval.not_approver")`」并假设审计列表按 `approval.not_approver` 这一 action 出行。
板仓只读核对（`services/domain/approvals.py` L69-95）：拒绝票落的是
**`action="approval.denied"` + `outcome="denied"` + `error.code="approval.not_approver"`** 的行——
`approval.not_approver` 是 error 结构里的码，不是 action 值。活体实测印证：
`GET /api/audit?action=approval.not_approver&limit=50` → **200，0 行**
（evidence/raw-audit-notapprover.json）；`action=approval.denied` → **200，2 行**，两行
`error.code` 均为 `approval.not_approver`（ev_53DF6B6D6BA74FF9B9BA4E6A1A，2026-11-22；
ev_70F90905DCBF4218AF54CD918E，2026-11-13；actor 为裸 id "1"/"2"）。需求单按现网真形制开列：

- **R1（拒绝票的人话句）**：`approval.denied` 行现读「驳回审批 · 失败（被拒）」
  （`audit/model.ts:279` `approval_denied: "驳回审批"`；`outcomeView` model.ts:477-482），
  「为什么被驳」的 `error.code=approval.not_approver` 无屏面人话腿——`errorCode`（model.ts:664-667）
  只进 `auditDetailFrom` 的技术折「失败代码」（model.ts:962），`code` 字段注释自陈
  「technical, never on the surface」（model.ts:920-921）。工单要的「拒绝：不在名单」需 aud 车道
  按 error.code（不是新 action 词）建行面/详情面人话槽位。附带纪律条款：`reasonOf`（model.ts:677-681）
  会把 `error.messageRedacted` 的英文工程句算进 `reason`，而当前所有视图消费腿 grep 均无渲染点
  （AuditEventsModulePage / AuditDetailModulePage / detailCopy 三处 `reason` 0 命中）——aud 车道若接
  reason 上屏，禁把这条工程句直接铺中文屏（AP-03 同款纪律）。
- **R2（decision 三分人话）**：`approval.decided` 行的 `decision` 字段活体真带
  （7 行 `decision:"approved"`，evidence/raw-audit-decided.json；域侧枚举
  `approve→approved / reject→rejected / revise→revise`，approvals.py:51 `_DECISION_BY_VERDICT`），
  但 `AuditRow`（model.ts:573-590）与详情模型无 decision 展示槽，列表现读统一「给出审批结论」，
  工单要的「通过/驳回/要求修改」三分不可见。R31 注记（model.ts:670-674）已明写 decision 不得再混进
  reason——需自己的槽位（徽章或结果列细分），aud 车道裁定形制。
- **R3（事件类型过滤缺 denied 票选项）**：`LIVE_ACTION_CODES`（model.ts:387-399）含
  approval.decided/consumed/expired 但**不含 `approval.denied`**，而该码 2026-11-24 活体实测存在
  （200 n=2）——`eventTypeChoices`（model.ts:446）因此给不出筛拒绝票的选项，审计页内无「被拒尝试」
  出口（工单现状证据「非审批人拒绝事件在 UI 无任何出口」在 2026-11-24 仍成立）。同时**不得**把
  `approval.not_approver` 加进 action 选项（实测 200 n=0：action 精确匹配，加了就是个筛零行的假选项，
  违反 LIVE codes「只列真见过值」的既有纪律）。
- **R4（导出腿现状澄清）**：工单 ④「导出仍 data-planned」——audit 面 `data-planned` 仅存于保留页
  （`audit/RetentionModulePage.tsx:15,187`）；审计台账导出在 aud 车道**已实装为真钮**
  （`audit/csv.ts` ＋ 该目录 90 个测试文件含 20+ 导出件）。PRD §13「不做清单含审计导出」与 aud 车道
  现状相抵，属总控/aud 裁定事项，本道一字不动，只如实记录矛盾。

## 三、DoD 逐条判词（诚实红线）

| DoD 条款 | 判定 | 证据 |
|---|---|---|
| 一条真实 `not_approver` 拒绝可在审计页找到并读成人话 | **数据腿已就位（早于工单的 AP-06 假设）：活体 2 行 approval.denied＋error.code=approval.not_approver；「找到」腿现可走 resourceId=ap_… 过滤（本单 3 行真事件见截图）；「读成人话」腿的「拒绝：不在名单」句未实装——写域在 audit 面，归 §二 R1。本道不冒充已达成，也不因数据在位就报完成。** | evidence/raw-audit-denied.json；ap08-1440.png 行面读数 |
| 无事件行深链伪造 | **已符合（现状即合规，未为改而改）**；新增测试钉死：单据级链 href 不含 `event=`；缺 eventId 的行渲「不给定位链」。 | §一② grep；links.test B |
| 导出钮 aria-disabled 且点击零成功提示 | **approvals 侧已符合并由新测试钉**；审计导出本体状态见 §二 R4。 | §一④；links.test C |

## 四、验证门（原始 stdout 摘录，2026-11-24 本机）

```
$ node_modules/.bin/vitest run src/modules/approvals/approvals.detail.links.test.tsx
 Test Files  1 passed (1)
      Tests  6 passed (6)        # 基线 3 + AP-08 新增 3

$ node_modules/.bin/vitest run src/modules/approvals
 Test Files  89 passed (89)      # 基线 89/456 → 89/459（只增）
      Tests  459 passed (459)

$ node_modules/.bin/vitest run src/modules/audit        # 只跑不改
 Test Files  90 passed (90)
      Tests  699 passed (699)

$ node_modules/.bin/vite build
build-exit=0                      # （禁 pnpm run build：tsc -b 预存仓库级错，同 AP-01 口径）

$ node scripts/lint-fake-success.mjs
  "violations": [],
  "ok": true

$ npx tsc --noEmit -p tsconfig.app.json
49 error TS                      # = 基线（apps/shared 预存）；delta=0
0 命中 modules/approvals / modules/audit
```

## 五、真链取证汇总（opsadmin 真登录腿 → BFF 8092，原始 JSON 存 evidence/，不提交）

前置门 `GET /auth/whoami`（经临时 v4_proxy 9181）→ 200 user=opsadmin（每图前重跑，脚本自报）。

```
GET /api/approvals?status=all&limit=20            → 200，16 行（11 expired + 5 consumed）
GET /api/audit?resourceId=ap_0C67930A…&limit=50   → 200，3 行（approval.decided/denied/expired）
GET /api/audit?resourceId=ap_AEEC078E…&limit=50   → 200，2 行（approval.decided/consumed）
GET /api/audit?action=approval.decided&limit=50   → 200，7 行，全带 decision="approved"，actor 均 {human,"1"}
GET /api/audit?action=approval.denied&limit=50    → 200，2 行，error.code 均 approval.not_approver
GET /api/audit?action=approval.not_approver&…     → 200，0 行（action 维不存在此码）
GET /api/audit?limit=200（无过滤）                 → 400（missing_filter，AP-03 既有契约复验）
```

文件（evidence/ 全量）：ap08-1440.png · ap08-375.png · ap08-shoot.mjs · raw-approvals.json ·
raw-audit-resource-ap_0C67930A766D4AA49E4B5B44EC.json ·
raw-audit-resource-ap_AEEC078E0C824E749513AFEC9A.json · raw-audit-resource.json（同一单早期腿）·
raw-audit-resource-ap0A8BC.json（AP-03 旧单复测）· raw-audit-decided.json · raw-audit-denied.json ·
raw-audit-notapprover.json · raw-audit-action-approval.{decided,consumed,expired,not_approver}.json
（parse 键位纠错前的同请求原始件）· raw-audit-scan.json（400 现场）· v4-proxy-9181.log。

## 六、截图（worktree vite build 产物，真渲染；代理已杀）

- `/Users/kevin_studio/Projects/tasks/AP-08-audit-trail/evidence/ap08-1440.png`（1440×900）
- `/Users/kevin_studio/Projects/tasks/AP-08-audit-trail/evidence/ap08-375.png`（375×812，
  scrollWidth=375 clientWidth=375，无横向溢出）

拍到：详情抽屉「处理记录 · 只读」段真 3 行（读取钮真点击后、时间正序、actor 遮蔽人话、
有/无 eventId 两站定位链形制）＋「相关记录 · 只读」段过滤链与新增作用域声明句。两档屏面读数
逐字相同（脚本 stdout 存档）。

## 七、主仓只读核对记录（一字未改）

- `apps/console/server.py`（板仓检出 L138-144 文档面 ＋ L2415 实码）：写路径日志
  `[bff] write req=<id> approval=<id> result=<码> status=<n>`，绝不含 body/comment/cookie/token；
  X-User-Id=`human:<bisheng_user_id>`，CR-028 规范化纯数字去前导零。与工单现状证据一致。
- `services/domain/approvals.py`：成功票 internal_row（action=approval.decided，actor={type:"human",
  id:_audit_human_id}，剥前缀存裸数字）L806-826 一致；拒绝票三分支 L757/766/775 均先落
  `_record_not_approver_audit`（L69-95）再 403——**形制修正见 §二 开头**。
