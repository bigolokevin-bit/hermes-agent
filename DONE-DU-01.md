# DONE-DU-01 北极星真读数与分母件（值班域）

基线 `29ad92208de1b0d75cdec3dde6797ded091509dd`；写域 = `web/src/modules/duty/**` + 本文件。
evidence/ 全部实测落盘、不提交。

## 一、接口原文（真 BFF=8092，opsadmin 真登录腿，2026-11-23 实测）

`/api/knowledge/citations` → **404**（evidence/probe-knowledge-citations.json）：

    {"code": "knowledge.not_wired", "message": "本环境未接入知识库读口",
     "asOf": "2026-11-23T15:11:05Z", "rid": "7c429b1c"}

`/api/knowledge/spaces` → **404**（evidence/probe-knowledge-spaces.json）：

    {"code": "knowledge.not_wired",
     "message": "上游 Bisheng(7860) 知识空间逐 id 读口不可达（枚举 id 全部失败；候选与状态码见 日志 [bff] kb-spaces-probe）",
     "asOf": "2026-11-23T15:11:05Z", "rid": "1e04c8a2"}

`/api/knowledge/sources` → 404 `knowledge.not_wired`（同族信封，probe-knowledge-sources.json）。

`/api/employees?limit=100` → **200**（evidence/probe-employees-limit-100.json、e1.json）：
顶层键**只有 `items`**——无 total、无 nextCursor；items=3 行
（emp_217A…E940B draft / emp_86A8…F2B540 active / emp_0166…A22649 active）。

`/api/employee-stats` → 200：`{"total":3,"byLifecycle":{"draft":1,"onboarding":0,"active":2,"paused":0,"offboarding":0,"archived":0}}`
——全量对账唯一可用的总数源。

`/api/effective-config?id=emp_86A8…F2B540` → 200（c1.json）：
`version.responsePolicy` 键 = `triggers/mode/loopGuard/fallback`，**无任何引用（citation）字段**
⇒「强制引用策略可读」在现网没有可读信号。

## 二、判定依据（五步逐条）

1. **V3 文档腿改指白名单实存读口**：`fetchKnowledgeProbe` 从 `/knowledge/documents` 改打
   `/api/knowledge/citations`（spaces/citations 均在 BFF 白名单 `_KNOWLEDGE_NOT_WIRED_ROUTES`，
   实测回 not_wired 信封=正当「未接」态，不再打非白名单路由）。同时修掉一个真缺陷：旧解析
   `asArray(body).length` 对 `{count,rows,documents}` 信封形恒得 0——接线后会把「有 N 份」误标
   「0 份 fail」。新解析只取响应自带 count/rows/documents/items，形状对不上按未接线处理，绝不猜数。
2. **V3 最小真口径**：`v3Verdict` = 文档腿 wired ∧ count>0 ∧ policy.wired → pass；wired ∧ count=0
   → fail（真读数）；其余（未接线 / count 缺失 / 策略腿不可读）→ unknown。策略腿 2026-11-23 实测
   无端点（见上 responsePolicy），api.ts 恒传 `policy:{wired:false,reason}` ⇒ 现网 V3 恒 unknown，
   卡上给结论句（gate.whyNot → 卡 say 行）：「可引用文档读口未接线，强制引用策略没有读口——两条腿
   都没有证据，引用门给不出真读数」。无假数字、无硬造 pass 分支。
3. **V1 单腿如实**：工位腿判定不变；source 保留「渠道事件列表 BFF 未代理，仅工位腿」；
   readiness.ts 注释删掉「走 /v1/channel-events」的失实表述，写明红线「勿补」等 DU-04 裁定。
   红线未碰（server.py 零改动）。
4. **分母诚实**：`EMPLOYEES_PAGE_LIMIT=100` 常量化；`pageSaturated = loaded>=100` 时
   `complete=false`（整组按证据不完整：四门 pass=null、buckets=null、不给任何计数）+
   披露「目录已加载 n 条（单页上限 100，非全量）」——AP-01「已加载 n 条（非全量）」形制。
   `fetchReadinessEvidence` 返回 `coverage:{covered,requested}`，卡上披露
   「本轮逐员工判定覆盖 n/N，其余按待核实」；扇出未覆盖行无显式 fail 时归待核实。
5. **三分态**：`buildReadiness` 出 `buckets{confirmed,pending,failing}`，之和恒等于分母行数；
   「未达」要求至少一门显式 fail（真读数），「已确认」要求四门全部显式 pass，其余待核实；
   主数字槽显示「已确认 x · 待核实 y · 未达 z」，无百分比。`confirmed` 的
   `unknownGates>0 → null` 链原样保持（测试钉住）。readiness.ts 头注「nothing is hardcoded to
   unknown any more」已按现状改写（注释不领先代码）。

## 三、门禁原始 stdout（evidence/du01-gates.log 同文）

    ## vitest 基线（改动前，23:10 实跑）：Test Files 11 passed (11) / Tests 153 passed (153)
    ## vitest 改后 src/modules/duty
     Test Files  11 passed (11)
          Tests  160 passed (160)
    ## 点名三件 duty.readiness/duty.aggregate/duty.caliber
     Test Files  3 passed (3)
          Tests  39 passed (39)
    ## vite build
    exit=0
    ## lint-fake-success
      "violations": [],
      "ok": true
    ## tsc --noEmit -p tsconfig.app.json
    exit=2（全仓预存错=非零是仓级现状）
    duty 写域错误数=0
    全仓 error TS 总数=49   ← 与基线 49 持平，delta=0

测试只增不减：153→160（+7：V3 pass 分支×2、三分态×3、扇出/页饱和披露×2、whyNot 结论句×1，
dutyPage/duty.caliber 两处断言随 DU-01①⑤ 改写为 citations 路由与三分态句形，非删除）。

## 四、截图（真登录腿 + 真读数，evidence/du01-proxy.log 有逐请求行）

- /Users/kevin_studio/Projects/tasks/DU-01-readiness-truth/evidence/du01-1440.png（1440×900）
- /Users/kevin_studio/Projects/tasks/DU-01-readiness-truth/evidence/du01-375.png（375×812，横向溢出=0px）

shoot 原始 stdout 关键行（du01-shoot.mjs，临时 v4_proxy=9162 loopback，用完已杀）：

    whoami status=200 user=opsadmin
      du01-1440.png 三分态=已确认 0 · 待核实 0 · 未达 2共 2 在册
      du01-1440.png 结论句=还有 1 项检查的数据源没有接入，暂不能判定 — 可引用文档读口未接线，强制引用策略没有读口——两条腿都没有证据，引用门给不出真读数（分母口径：目录已加载 3 条（单页上限 100 内） · 本轮逐员工判定覆盖 2/2）
      du01-1440.png 横向溢出(px)=0
      … 200 /agent-api/api/workstations?id=… | 200 /agent-api/api/effective-config?id=… |
      200 /agent-api/api/approvals?status=all&limit=100 | 404 /agent-api/api/knowledge/citations
    whoami status=200 user=opsadmin   （375 档同文，溢出=0）

现网读数解释：两员工各有显式 fail（V6 审批决策全过期、V1 A22649 仅 dm）⇒「未达 2」是真读数；
V3 唯一 unknown 门 ⇒ confirmed 链保持 null，卡上不出现权威总数。

## 五、偏差如实

1. 工单①前提部分过时：现运行 BFF（bff-v4-serve face）实测**有** /api/knowledge/documents
   （回 `documents.read_not_wired` 信封，probe-knowledge-documents-limit-100.json）；主检出
   server.py 白名单确无此路由。按工单指令改指白名单实存的 citations，两可口径下取白名单面。
2. employees 回包无 total/nextCursor（实测只有 items）⇒「单页即 complete=false」的对账只能靠
   employee-stats byLifecycle 总数 + 页上限哨兵，已按此实现并披露。
3. 截图代理的 /auth/whoami 走真 9122 反代（非 q14 的合成形制），登录断言为真实校验。
4. dutyPage.test.tsx 主数字断言由「—」改为三分态句形——这是工单⑤要求的行为变化本身。
5. V3 pass 分支在策略腿接线前结构性不可达（policy.wired 恒 false 来自 api 层实测记录），
   接线后 api.ts 换真读数即可，判定层零改动。
