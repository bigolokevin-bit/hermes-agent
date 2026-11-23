# AP-03 · 详情时间线与处理记录 — DONE

分支 `task/AP-03-timeline`。**本分支是栈合**：基＝AP-02 tip
`978f6590a789be6de91878b9477450626c4d797f`，合入 AP-01 tip
`25171fd1311fbd9c6f4a28c867cf9f81dce0b986` ⇒ 开工基线
`676012770e1be3062f5a15d7290b2e0c975a71d9`（vitest 87 件/426 测试全绿，实测）。
**L0 合并顺序必须 AP-01 → AP-02 → AP-03**（本支含前两者的全部改动，先并 AP-03
会吞掉 AP-01/AP-02 的独立窗口）。

源单：`seakoi-agent-os-l0-board/docs/product/backlogs/approvals-duty.md` §AP-03。
写域：`web/src/modules/approvals/**` ＋ 本文件。零新端点、零写路径、零 BFF 改动、
audit 模块只 import 复用未改一行（`git status` 面见 §5）。
审批写开关未动：`writeGate.ts`/`gates.ts` 的 `DECISION_GATE` 保持 `disabled:true`，
本单不开闸。

## 1. 接口原文（本机真登录腿，非 fixture）

链路：opsadmin 治理登录腿 `l7-ops/ops/opsadmin-evidence-login.sh` 产物
`~/.seakoi/opsadmin-token.txt` → console BFF(8092, `bff-v4-serve/apps/console/server.py`)
→ 域服务(8101, SQLite `~/.local/state/seakoi-ops/domain-dev.db`)。
落盘件在 `evidence/`（**不提交**），下列逐字摘自这些文件。

### 1.1 `GET /api/approval?id=ap_0C67930A766D4AA49E4B5B44EC` → 200

`evidence/raw-detail-ap_0C67930A766D4AA49E4B5B44EC.json`（1258 B）顶层键序：

```
['approvalId','tenantId','type','status','requestedBy','action','resource','argsDigest',
 'binding','riskLevel','reasonText','approvers','requiredApprovals','decisions',
 'ttlSeconds','expiresAt','remainingSeconds','policyDecisionId','createdAt','decidedAt','verdict']
```

关键字段逐字：

```
"status": "expired"
"decisions": [{"userId": "human:1", "verdict": "approve", "comment": "B 线演练批准",
               "decidedAt": "2026-11-22T02:36:49.066Z"}]
"createdAt": "2026-11-22T02:36:34.263Z"
"expiresAt":  "2026-11-23T02:36:34.263Z"
"decidedAt":  "2026-11-22T02:36:49.066Z"
"approvers":  [{"userId": "human:1", "role": "owner"}]
```

**`supersededBy`/`superseded_by`/`replacedBy` 在全部 6 条实测详情里 0 命中**
（`evidence/raw-detail-ap_*.json` 逐件清点：0A8BC…/0C6793…/7D484B…/84BF…/8CC7AB…/AEEC…，
六件全 200），域库 `?status=superseded` 真答 `{"items": []}` ⇒ 替代节点在现网
**无实数据可拍**，只能由单测驱动（§4）。

### 1.2 `GET /api/audit?resourceId=ap_0C67930A766D4AA49E4B5B44EC&limit=50` → 200

`evidence/raw-audit-resourceid.json`（1948 B）首行逐字：

```
{"events": [{"eventId": "ev_E00835B01A4241068C90E7BC32", "schemaVersion": 1,
 "tenantId": "t_seakoi_pilot", "occurredAt": "2026-11-23T03:12:34.244Z",
 "recordedAt": "2026-11-23T03:12:34.244Z", "sourceSystem": "approval",
 "actor": {"type": "service", "id": "appro …
```

顶层键＝`[events, limit, cursor, hasMore, total, totalSource]`；**服务端返回倒序**
（新→旧），三行逐字读数：

| occurredAt | action | actor | outcome | eventId |
|---|---|---|---|---|
| 2026-11-23T03:12:34.244Z | `approval.expired` | `{"type":"service","id":"approval-sweeper"}` | denied | `ev_E00835B01A4241068C90E7BC32` |
| 2026-11-22T02:36:49.066Z | `approval.decided` | `{"type":"human","id":"1"}` | success | `ev_954362D9A8FF4DB8AA5430F9E2` |
| 2026-11-22T02:36:34.270Z | `approval.denied` | `{"type":"human","id":"1"}` | denied | `ev_53DF6B6D6BA74FF9B9BA4E6A1A` |

⇒ 屏上必须**按 `occurredAt` 正序**重排（工单②），且**响应真带 `eventId`**，
所以事件级定位链可以给真链（不是编造 `?event=`）。

第二张单 `ap_AEEC078E0C824E749513AFEC9A` → 200 两行
（`approval.consumed`/`approval.decided`，`evidence/raw-audit-ap_AEEC.json`）；
无决策的 `ap_0A8BC8A6F02C457FA781D89417` → 200 两行
（`approval.expired` + `approval.denied`，`evidence/raw-audit-ap_0A8BC.json`）。

### 1.3 失败/边界档原文

```
只带 limit（无过滤）      → 400 {"code": "console.missing_filter",
  "message": "at least one of ['runId','taskId','actorId','resourceId','action','from','to']
   is required (no unfiltered table scan)"}                 [raw-audit-noFilter.json]
无会话 cookie             → 401 {"code": "console.unauthenticated",
  "message": "登录状态缺失或已过期，请重新登录", "rid": "0ed1c6d8"}
  响应头 X-Console-Request-Id: 0ed1c6d833154139aa1e9bef0a62f562 [raw-audit-noauth.json]
真读回 0 行               → 200 {"events": [], "limit": 50, "cursor": null,
  "hasMore": false, "total": 0, "totalSource": "exhaustive-same-query-page-count"} [raw-audit-empty.json]
详情腿不存在的单号        → 404 [raw-detail-missing.json]
成功响应头                X-Console-Request-Id: a8bfb4d0306542699e0c1b2a2ec1f99b
```

⇒ 「读不到」与「读了没有」是两件事：400/401/403/404/5xx/形制不符＝暂不可用；
`events: []`＋`total: 0`＝真 0 行。两档各有句子（§2②）。

## 2. 改动清单（按工单步骤①②③）

**① 时间线事件源合流**（`model.ts` ＋ `views.tsx`）

- `model.ts` 新增 `TrailEvent`/`trailEventsFrom(detail)`：合流
  `decisions[]` ＋ `supersededBy` ＋ `expiresAt`（走 `deadlineAt`，与「处理期限」
  字段同一把 `DEADLINE_KEYS` 尺）＋ 提交锚点，**排序只用 `epochOf(atRaw)` 单点**；
  `stableSortByAtRaw` 是稳定排序：同值与读不出时间的**保持服务返回序**，
  无时间的落末尾。没有 `expiresAt` 就没有到期节点，没有 `supersededBy` 就没有
  替代节点——一个都不编；缺时间不补当前时间（`RelativeTime` 的既有纪律）。
- `model.ts` 新增 `sortRecordsByTime(rows)`：处理记录行的正序（同一把尺，
  只借审计模型的 `occurredAtRaw` 一条腿，不另起审计行模型）。
- `views.tsx` `DecisionTrail` 的 `<ol>` 改为按合流事件渲染：既有 testid 与句式
  **一字未改**（`apd6-step-submitted`/`apd6-step-node-<i>`/
  `apv-time-detail-node-<i>`/`apv-trunc-note-<i>`/`apd6-step-pending-<i>`/
  `apd6-step-final`/`apd6-step-links`），新增 `apd6-step-deadline`、
  `apd6-step-superseded`（＋`apv-time-detail-deadline`、
  `apv-time-detail-superseded`）。区块头标题由「节点顺序即服务返回顺序」改为
  「节点按服务带回的时间先后」——旧措辞现在会说谎。
- `trailToText`（apd8 复制）与屏上**同序同段**：到期行 `处理期限 · <绝对到分>`、
  替代行 `被替代 · <短码> · 该段无记录`。全值 id 只进 `title` 与 href，
  不进复制文本（既有 `not.toContain("ap_t8")` 契约不破）。

**② 内联「处理记录」小段**（新组件 `ProcessingRecords`，`apd12-*`）

- `api.ts` 新增 `AUDIT_LIST_PATH="/agent-api/api/audit"` ＋
  `auditResourceUrl(resourceId, limit=50)` ＋ `fetchProcessingRecords()`；
  行解析 **import 复用** `@/modules/audit/model` 的 `auditPageFrom`（audit 模块零改动）。
- 行面只给工单点名的三件 `action/actor/occurredAt`，按时间正序；
  人话走审计车道单点词汇（实测四码全命中：`approval.decided`→给出审批结论、
  `approval.denied`→驳回审批、`approval.expired`→审批超时未处理、
  `approval.consumed`→按审批结论执行）。
- **`reason` 腿不上屏**（取证时实测泄漏）：审计行的 `reasonOf` 会把
  `error.messageRedacted` 原样带出（"denied by domain validation; raw message not
  stored in audit"），是工程英文句，属审计页的技术折——本段只留三件，
  并在测试里钉住「工程句不上中文屏」。
- 定位链：行响应带 `eventId` 才给 `/audit?event=<真 id>`（`AUDIT_PATH`＋
  `DEEP_LINK_PARAM` import 自 `@/modules/audit/permalink`，审计页真读的形制）；
  没带就明说「这条没带回事件标识，故不给定位链」，禁编造。
- 读数句 `apd12-count`：`本次读回 n 行` ＋ 只有响应真给 `total` 才说
  「读口称共 N 条」，`unreadable>0` 单独披露，有 `next` 就明说「还有下一页」。
- 失败档：`处理记录暂不可用` ＋ 这一条读口的实情句（401/403≡404/400/5xx/网络/
  形制不符，`copy.ts` `recordsFailureSentence` 单点）＋ **可复制请求号**
  （`apd12-rid`/`apd12-copy-rid`，缺号走 `requestIdLine(null)` 既有句）＋ 重读钮。
  失败**绝不画空列表**、绝不静默隐藏；`答回来的不是列表`（null）归失败，不算 0 行。
- 空档：`这条单没有带回处理记录（审计读口本次答 0 行）`，与失败句互不冒充。

**③ 不轮询、不自造事件、不开新端点**

- 这一段**不自动发请求**：点「读取处理记录」才发那一条 GET（手动刷新语义，
  GAP-APR-11 无状态读口）。理由除了工单，还有一条既有契约：
  `approvals.detail.fields2.test.tsx` 把「打开详情恰一次读取／重试恰 +1 次」
  钉成断言——本单不许改既有断言，自动读会直接把那条腿撞成两次。
  未读态屏上是「处理记录未读取——点『读取处理记录』…」，不是空壳。
- 读数按「单据号」键控：换单后旧读数自动作废（派生态，不进 state），
  上一张单的行不会挂到这一张单上。
- 零新端点（`/api/audit` 是审计车道既有读口）、零写路径、零轮询定时器。

**其它接线**

- `correlationReturn.ts` 新增 `useLeaveWithSnapshot()`：把「离开前记快照」收成一个
  把手，apd6 的运行/任务链与新处理记录的事件链共用（原来只有前者）。
- `copy.ts` 新增单点句：`TRAIL_FACE_RECORDED`、`RECORDS_*`、`recordsFailureSentence`。
  回填票面口径＝「票面已记录」，title 说「再次提交回到的是同一张已有票面
  （回填票面），票面内容不变」——**全句不含 失败/出错/没能/无法/错误**（测试逐词钉）。
- `RowDetailCopy.tsx` **未改**（偏差见 §6）。

## 3. 门禁（原始 stdout 落 `evidence/gate-*.txt`，不提交）

```
$ cd web && node_modules/.bin/vitest run src/modules/approvals
 Test Files  88 passed (88)
      Tests  443 passed (443)
   Duration  8.03s
VITEST_EXIT=0
```

基线 87 件/426 测试 ⇒ 现 88 件/443 测试：**只增不减**（新件
`approvals.detail.trail.test.tsx` 17 例）。既有
`approvals.detail.*.test.tsx`（a11y/copy/diff/edge2/fields2/links/missing/multipage）
**一字未改仍全绿**——`git status --porcelain` 里没有任何既有测试件被改。

```
$ cd web && node_modules/.bin/vite build
✓ 3634 modules transformed.
✓ built in 6.04s
VITE_BUILD_EXIT=0          （未用 pnpm run build：tsc -b 预存 101 仓级错与本 diff 无关）

$ cd web && node scripts/lint-fake-success.mjs
{ "script": "lint-fake-success", "file": "docs/console-v4-skeleton.html",
  "linesScanned": 9252, "allowedInfo": {"规划中": 188, "不会保存": 1, "未接入": 22},
  "violations": [], "ok": true }
LINT_EXIT=0                （violations=0）

$ cd web && node_modules/.bin/tsc -p tsconfig.app.json --noEmit
49 行 error，全部落在 ../apps/shared/src（Cannot find module 'vitest' 一族，预存在）
grep -c "src/modules" = 0  ⇒ approvals 写域 0 错（delta＝0，与基线同数）
TSC_EXIT=2                 （仓级预存错，非本 diff）
```

## 4. 测试点名（新增 `approvals.detail.trail.test.tsx`，17 例）

- 合流排序（纯模型）：提交→票→到期按时针；**响应不带 `supersededBy` ⇒ 不造替代节点**；
  带 ⇒ 有节点且 `atRaw=null`（不拿读取时刻冒充）、排末尾；同值与无时间保持服务序。
- DOM：三节点上屏顺序、三个时间载体 title 逐字对绝对秒（`2026-11-22 10:36:34` /
  `10:36:49` / `2026-11-23 10:36:34`）；替代节点短码上屏、全值进 title 与 href、
  缺时间走 `TIME_MISSING`；`apd8` 复制文本与屏上同序同段，且不含 `human:`、不含单号全串。
- 回填票面：settled 单据节点带「票面已记录」，逐词断言无失败语气；
  pending 单据不贴该标注（没发生的事不宣布）。
- 处理记录：挂载**零请求**、点一次恰一次、wire 逐字
  `/agent-api/api/audit?resourceId=ap_0C67930A766D4AA49E4B5B44EC&limit=50`；
  真 3 行按时间正序 + 四码人话 + 无裸柄/无租户串/**工程英文句不上屏**；
  403（真形制 `ApiError`＋`X-Console-Request-Id`）⇒「处理记录暂不可用」＋请求号可复制
  ＋不画列表＋不冒充空记录＋重读再发一条；`null` 响应（形制不是列表）⇒ 归失败不算 0 行；
  真 0 行 ⇒ 空句且不报失败且不画行；无 `eventId` ⇒ 不给 `?event=` 链；
  单号缺席 ⇒ 钮禁用并给原因，不发无输入请求；换单旧读数作废。
- 禁假 0：以上空/失败两档各断言「不是 0 当成功」。

## 5. 写域自查

```
$ git status --porcelain
 M web/src/modules/approvals/api.ts
 M web/src/modules/approvals/copy.ts
 M web/src/modules/approvals/correlationReturn.ts
 M web/src/modules/approvals/model.ts
 M web/src/modules/approvals/views.tsx
?? web/src/modules/approvals/approvals.detail.trail.test.tsx
?? evidence/                     （不提交）
```

`web/src/modules/audit/**` 与其它模块：只 import（`auditPageFrom`/`AuditPage`/
`AUDIT_PATH`/`DEEP_LINK_PARAM`），零改动。

## 6. 截图（真实渲染，非 dev mock）

脚本 `evidence/ap03-shoot.mjs`（形制承 AP-01/AP-02）：本 worktree `vite build`
产物（`hermes_cli/web_dist`）经**临时 v4_proxy(9161, loopback，脚本自起自杀)**
同源提供，`/agent-api/*` 反代真 BFF(8092)→域(8101)；opsadmin 会话 cookie；
`domcontentloaded` ＋显式 settle（禁 networkidle）；**每图前 whoami==200 门**
（重试并逐次打印，拿不到就拒绝出图）；视口图非 fullPage；9122/9131/9141/9151 未动。

- `/Users/kevin_studio/Projects/tasks/AP-03-timeline/evidence/ap03-1440.png`（1440×900）
- `/Users/kevin_studio/Projects/tasks/AP-03-timeline/evidence/ap03-375.png`（375×812）
- `/Users/kevin_studio/Projects/tasks/AP-03-timeline/evidence/ap03-idle-1440.png`（1440×900，未读态实态）

两档主图都拍到实态：时间线「提交 · 成员 · 86A81CE8 → 节点 1 · 人员 · 通过 · 意见：B 线演练批准 ·
票面已记录 → 处理期限 → 终态 · 已过期」＋处理记录三行正序（驳回审批／给出审批结论／
审批超时未处理）＋「本次读回 3 行，读口称共 3 条」。几何读数 `bothInViewport:true`
（1440：trail 425–586、records 597–720；375：trail 352–514、records 525–647）。
浏览器实发请求逐字（脚本打印）：

```
200 /agent-api/api/approval?id=ap_0C67930A766D4AA49E4B5B44EC
200 /agent-api/api/approvals?limit=50
200 /agent-api/api/audit?resourceId=ap_0C67930A766D4AA49E4B5B44EC&limit=50
```

未拍到的两态与原因（如实）：**替代节点**——现网 0 条 superseded 单、6/6 详情不带该键；
**403/暂不可用**——本机只有一个 opsadmin 治理账号，拿不到真 403（真 401 原文见 §1.3，
屏上兜底态由单测以真形制 `ApiError` 驱动）。两者都不做假数据补图。

## 7. 偏差与裁定

1. **处理记录改成一键读取（不自动读）**：工单说「内联小段」，未规定自动；
   「打开详情恰一次读取／重试恰 +1」是既有测试钉死的契约，自动读会撞成两次，
   而本单不许改既有断言。未读态给可见句子＋钮（不静默隐藏），与「不轮询」同向。
2. **`RowDetailCopy.tsx` 未改**：行预览复制的六段契约（`单号/标题/状态/风险/
   更新时间/短码`）被 `approvals.detail.copy.test.tsx`（`toHaveLength(6)`）与
   `approvals.copy.export.pair2/concurrency` 逐字钉死；加第七段＝改既有断言。
   到期/替代两节点属详情时间线，行预览只报行数据真带回的六段。
3. **`correlationReturn.ts` 的改动**＝把快照把手收成单点（新事件链共用），
   不是新行为。
4. **审计 `reason` 不上屏**（§2②）：实测会把工程英文句带进中文屏，越模型法则二。
5. **词汇表未扩**：`approval.decided` 等四码在审计车道 `ACTION_LABEL` 已有人话，
   本单 import 复用；AP-08（审计留痕含拒绝票）若要在审计页读 outcome 细分，
   由该车道改它自己的表。

## 8. 交付补记（提交后复跑，逐字核对）

- pre-commit（lefthook→eslint）首跑拦下新测试件里 1 个真错（`_drop` 未用变量），
  已改为显式 `delete row.eventId`；改后 eslint **0 error**，仅剩一条**预存在**警告
  （`react-refresh/only-export-components`，用 `git show HEAD:…views.tsx` 基线探针
  复现同一行号族，非本 diff 引入）。
- 该修正只动测试件（不进 bundle），§6 截图仍出自本 worktree 的 `vite build` 产物。
- 提交态复跑数字（与本节同批）：`vitest run src/modules/approvals` →
  **88 files / 443 tests 全绿**；`vite build` → `VITE_BUILD_EXIT=0`；
  `lint-fake-success` → `violations: [] ok: true`；
  `tsc -p tsconfig.app.json --noEmit` → 49 行 error 全在 `../apps/shared/src`，
  `grep -c "src/modules"` = **0**。
- 提交与推送同批完成，无 force、无 `--no-verify`；远端核验用定向 ref
  （`git ls-remote origin refs/heads/task/AP-03-timeline`，按**输出行**判存在，
  不 `ls-remote | grep <sha>`——全量行走管道会被截成假「没推」）：
  远端 tip 与 `git rev-parse HEAD` 全长逐字相等，该两行原始输出贴在车道回执里，
  本文件不写死 sha（写死就会随下一笔提交失真）。
- diff 面 7 个文件（6 写域 + 本 DONE）；`git status --porcelain` 仅剩 `?? evidence/`
  （取证件，按纪律不提交）。
