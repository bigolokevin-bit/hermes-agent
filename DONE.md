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
