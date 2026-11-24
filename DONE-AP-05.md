# AP-05（前端腿）· 审批决定幂等与安全提交 — DONE

- 分支 `task/AP-05-idempotency-hash`，基线 HEAD `ef9c3f3a47`（=AP-08 tip；栈式链 L0 合并顺序 AP-01→AP-02→AP-03→AP-07→AP-08→AP-05f）。
- 工单原文：`seakoi-agent-os-l0-board/docs/product/backlogs/approvals-duty.md` §AP-05（开工前已读）。
- 写域：`web/src/modules/approvals/**` ＋ 本文件。零新端点、零 BFF/域改动、零主仓触碰；`DECISION_GATE` 决策钮默认禁用**一行未动**（diff 为纯追加，见 §4）。
- 姊妹车道：BFF 三负例腿（403 非审批人／缺 hash 折叠／同键重放票）在主仓并行做，分支 **`task/AP-05-bff-negatives`**——本道不含 pytest 腿（步骤④⑤归它）。

## 1. ① 实装 ＋ 总控裁定偏差（照实）

**偏差裁定（工单假设 vs 本轮落法）**：工单步骤①假设决策钮可启用（AP-04 形制：缺 hash ⇒ 钮禁用＋源句）。本轮**未开闸**（`DECISION_GATE.disabled=true` 原样），故该腿落为——

- **「禁用原因列表里新增一条 hash 缺失原因」**：`writeGate.ts` 追加 `ACTION_HASH_MISSING_REASON`（源句逐字＝「这张单没给出动作指纹，无法确认批的就是当前动作。」）与 `missingHashReasonFor(actionHash)`、`decisionBlockReasons()` 单点；
- **与 `DECISION_GATE.title` 同屏并存、数据侧驱动**：决策区说明段先渲染写门控句（既有 `apr5-actions-readonly-note`，一字未动），详情读回 `actionHash` 缺时再追加 `apr5-actions-hash-missing-note` 一条；判据只认 model 既有键族 `actionHash/action_hash/argsDigest`（缺即 null，不推断、不补造）；
- **按钮三属性仍单源 `DECISION_GATE.title`**（AP-07② 同源契约不破）；开闸时本句与人工门接成合取（disabled = gate ∨ 缺失句命中），属 AP-04 开闸评估波，不在本道。

**现网实态（opsadmin 腿实测，原始 JSON 存 `evidence/`，不提交）**：

- `GET /agent-api/api/approval?id=ap_AEEC078E0C824E749513AFEC9A` → 顶层键含 `argsDigest`（值 `22eadfce…`），**无 `actionHash`/`action_hash` 键**（`evidence/raw-detail-ap_AEEC078E0C824E749513AFEC9A.json`）；扇出 16 行（11 expired＋5 consumed）行行带 `argsDigest`（`evidence/raw-list-fanout.json`）。
- ⇒ `model.ts` 从 argsDigest 族读到指纹恒非 null ⇒ **缺失句在现网恒不出现＝诚实实态**。取图 DOM 计数钉死这点：`hash 缺失句 DOM 计数=0`（`evidence/ap05-shot-readout.txt`）。未造假字段、未凑图。
- 写口关态行为复验（同 wave-126 口径）：`POST /agent-api/api/approval/decision?id=ap_AEEC…` → **HTTP 405 `console.read_only`**（`evidence/raw-decision-post-405.txt` 逐字）。
- 列表行不呈现决策控件（详情抽屉打开必发 GET 详情）⇒ ①的句由**详情读回**驱动，与工单「详情/列表行数据无 actionHash 时」的判据语义一致（行无控件、无第二出口）。

**截图（build 产物＋临时 v4_proxy 9195 loopback 自起自杀，反代 /agent-api→8092；domcontentloaded+settle 2.5s；每图前 whoami==200 opsadmin；未动 9122/9131/9141/9151/9161/9162/9171/9172/9181/9183；无 cookie jar 落盘）**：

- `evidence/ap05-1440.png` / `evidence/ap05-375.png`：决策区实态——真单打开抽屉，决策区呈「这张单已经是『已执行』，不能再在这里改结论」分支（现网 pending=0，`evidence/raw-list-pending.json` 全文 `{"items": []}`；**带禁用钮的待处理决策区在现网无活体载体，禁造假数据凑图**，其形制由测试 B 组钉住），含 hash 缺失句实态（计数=0，读数落 `ap05-shot-readout.txt`）。
- 补两帧指纹段实态：`evidence/ap05-hash-1440.png` / `evidence/ap05-hash-375.png`（`操作指纹 22eadfce…` 上屏）。

## 2. ② 重放/双击 ⇒ 成功回填票面

状态机单点 `decisionOutcome.ts:submitDecisionWithRecovery`（域 `decide_approval` 三条 200 路径盘读 L784-793/L842-850：同键既有票直接 200 回填、fresh 记票 200、并发认票 200——票面已落定时「该键的票必在单上」⇒ 回填句「你已经投过票：…」为真话）：

- 200＋票面 settled ⇒ kind=`replay`：成功侧票面回填（`apr5-decision-face`，role=status，无 alert 无弹窗），措辞复用 AP-03 DecisionTrail 票面词（「通过 · 时间 · 意见：…」＋`TRAIL_FACE_RECORDED`），末句「再次提交只会回到这同一张票面，不会产生第二票」；断言措辞不含失败词族；随后照旧重读两路。
- 200＋仍等人＝`recorded`（正常成功）；200 读不出票面＝`recorded`（重读交还服务，不假报票面）。
- 409＝**只可能来自 idempotency key 复用且请求体不一致**（先例 `docs/_artifacts/D/T03-ENDPOINT-RECONCILIATION.md` L137-141——**本 worktree 盘上无该文件**（find/mdfind 均 0 命中），口径按总控转述落注）：人话冲突句走既有 `writeFailure` 409 句，**不重试**（POST 计数=1 钉住、零读回）；票面重读（GET）保留既有语义。
- `CsrfMissingError`＝拦在网络前＝确定未送出，归已知失败不进未知腿（不误读回）。

## 3. ③ 超时/结果未知 ⇒ 读回优先、绝不盲发第二次

- `api.ts` 新增显式函数 `readBackDecisionTicket(id)`（恰一次 GET `/api/approval?id=`，只读）与判据 `isUnknownOutcome`（0=连不上/超时、-1=传输异常；CSRF 拦截除外）。
- 未知腿三档（`copy.ts` 单点措辞，全带「不会自动重发」）：读回落定⇒成功侧票面（不认领投票人，只报读回票面）；读回未落定⇒未知句交人工；读回也没答成⇒「结果未知」＋手动重读出口。三档 POST 恒 1 次。

## 4. 改动清单（git diff --stat）

```
 .../approvals/ApprovalsPendingModulePage.tsx  | 93 +++++++++++++++++-----
 web/src/modules/approvals/api.ts              | 21 +++++
 web/src/modules/approvals/copy.ts             | 64 ++++++++++++++-
 web/src/modules/approvals/writeGate.ts        | 37 +++++++++
 新增 decisionOutcome.ts ＋ approvals.idempotency.test.tsx
```

DECISION_GATE 对象体逐字未动（`git diff writeGate.ts`：纯追加段）。

## 5. 验证门（实跑 stdout 摘录）

- `node_modules/.bin/vitest run src/modules/approvals` → **Test Files 90 passed (90) / Tests 470 passed (470)**（基线 89/459 ＋ 新增 `approvals.idempotency.test.tsx` 1 件 11 测，只增不减，0 失败）。
- 点名 `approvals.detail.links.test.tsx` → **1 file / 6 tests passed**。
- `node_modules/.bin/vitest run src/modules/audit` → **90 passed (90) / 699 passed (699)** 全绿（audit 零改动）。
- `node_modules/.bin/vite build`（禁 pnpm run build）→ **exit 0**。
- `node scripts/lint-fake-success.mjs` → `"violations": []`（ok:true，violations=0）。
- `npx tsc --noEmit -p tsconfig.app.json` → 全仓 **49 error 行＝基线**；`grep modules/approvals` **命中 0**；delta=0。

## 6. 遗留与诚实边界

- 开闸时①的合取接线（钮 disabled = DECISION_GATE ∨ 缺失句）属 AP-04 评估波；批量条逐行 hash 腿未接（行数据带 argsDigest，批量归 AP-07 写域，本道未动 `runBatch` 行为）。
- T03 先例文件本盘不可达，409 语义按总控转述；若该文件口径有出入，改点在 `decisionOutcome.ts` failure 分支一处。
- 现网 pending=0：禁用钮决策区的活体截图无载体，已用真单实态帧＋DOM 计数＋测试 B 组三段式补证，未造假数据。

---

# AP-05 第二波（锚定腿补交）· DONE

- 分支 `task/AP-05-action-hash`，基线 HEAD `db793b7b10e77b511a402d4b9475fab25f341cad`（开工现读，`git status --porcelain` 开工时为空）。
- 工单正典 `seakoi-agent-os-l0-board/docs/product/backlogs/approvals-duty.md` §AP-05 全文已读。
- 写域：`web/src/modules/approvals/**` ＋ 本文件。主仓 `seakoi-agent-os` **零触碰**（只读盘读＋只读 GET 取证）；`DECISION_GATE` 一字未动。

## 7. 审计：已交付面逐项核对（勿重做，结论=确已交付）

| 交付面 | 落点（行号现读） | 核对结论 |
|---|---|---|
| 缺-hash 禁用句单点 | `writeGate.ts:150` `ACTION_HASH_MISSING_REASON`、`:153` `missingHashReasonFor`、`:253` `decisionBlockReasons` | 在场，未动 |
| 结果未知⇒先读回 | `api.ts:272` `isUnknownOutcome`、`:283` `readBackDecisionTicket` | 在场，未动 |
| 回填票措辞 | `copy.ts:249` `alreadyDecidedFaceCopy`、`decisionOutcome.ts:118` replay 腿 | 在场，未动 |
| 六分支状态机 | `decisionOutcome.ts:45-62`（recorded/replay/failure/already-decided-face/readback-settled/readback-pending/readback-unreadable） | 在场，未动 |
| OPTIONS 合取探测门 | `writeGate.ts:114-116`、`api.ts:329` `classifyProbeResponse` | 在场，未动 |
| 幂等测试 11 例 | `approvals.idempotency.test.tsx`（本波跑测仍全绿） | 在场 |
| 五码专句/409 读回 37 例 | `approvals.negative.codes.test.tsx` | 在场 |

**缺口判定（本波唯一实装项）**：§AP-05 目标要求 action_hash 作为**读侧锚点参与可用性判定**——已交付只覆盖「缺失⇒禁用给原因」，**「存在但形态非法」与「与票面记录不一致」两条腿在仓内不存在**。判定用负向 grep，非印象：

```
$ grep -rn "形态非法\|malformed\|invalidHash\|比对\|不一致\|mismatch" web/src/modules/approvals/*.ts* | grep -vi 非差异
（命中仅 csrf_token_mismatch / subject_mismatch 折叠句 / 409 请求体不一致注记 /
  历史页筛选文案——无一条是指纹锚定腿）
```

## 8. 取证（现网真读，写口未开，全程只读）

`GET /api/approvals?status=all&limit=50` → 16 行；逐行 `GET /api/approval?id=`；opsadmin 会话，whoami 门在取图段另证。

- **指纹真形制三族**（16/16 行 `argsDigest` 逐值核形）：64 位十六进制摘要（域 `services/domain/util.py:47-48` `sha256().hexdigest()`）、`sha256:`+64 位、`th_`+32 位（域 `services/domain/approvals.py:213` `compute_target_hash`）。
- **现网真实存在「存在但形态非法」**：`ap_123DE49B9A1F42A197679681F1`＝`sha256:apr02`（体 5 位）、`ap_8CC7AB670AF84BBDBB955EBDD3`＝`sha256:p07grant`（体 8 位，含 p/g/r/n/t 非十六进制字母）。域创建只验非空 str（`approvals.py:591`），不验形制 ⇒ 这条腿不是假想敌。
- **判据据此刻在「体是不是十六进制摘要」，长度不作判据**：屏上截断显示产生的 41/46 位前缀是真摘要的既有形制（既有测试面亦用之），把长度当非法会误伤现网。大小写同理不改可核验性。
- **票面记录里没有指纹**：`decisions[]` 全部 7 张真票 key-set 恒为 `{comment,decidedAt,userId,verdict}`（域 `approvals.py:337-346` `_decisions` 逐字只出这四键）⇒ **无任何可比来源**，一致性腿按诚实形制给「比对不可用」，**既不声称一致，也不据此禁用**（不推断、不画假匹配）。
- 写口现状复验：OPTIONS/POST 决定路由＝**405**（取图段 `405 /agent-api/api/approval/decision` 逐字在案）；`status=pending` → `{"items": []}`（pending=0）。

## 9. 实装（锚定腿，纯追加）

- `writeGate.ts:156` `ACTION_HASH_INVALID_SHAPE_REASON`、`:160` `ACTION_HASH_MISMATCH_REASON`、`:169` `ACTION_HASH_COMPARE_UNAVAILABLE_NOTE`（三条单点措辞，禁第二套词汇）。
- `writeGate.ts:191` `VERIFIABLE_HASH_SHAPES`（上表三族）＋ `:200` `actionHashShapeOf`（missing/verifiable/invalid 三态）＋ `:212` `invalidShapeReasonFor`（与缺失句**互斥**，不并存）。
- `writeGate.ts:216-247` `HashConsistency` 四态 + `hashConsistency`：指纹不可核验⇒`not-applicable`（不假装比对）；票面无记录⇒`unavailable`；逐字全等⇒`consistent`；任一对不上⇒`mismatch`。
- `writeGate.ts:253` `decisionBlockReasons` 增两档（形态非法、票面不一致），签名向后兼容（`recordedHashes` 缺省⇒不新增句）；`:274` `hashConsistencyNote` 读数单点。
- `model.ts:569` `DecisionEntry.actionHash`＋`:807` 逐票读指纹族键（缺即 null，不从本单回填）。
- `ApprovalsPendingModulePage.tsx:679/:694/:706` 决策区三条新载体；钮三属性仍单源 `DECISION_GATE.title`（AP-07② 契约不破，本轮未开闸⇒不接合取）。
- 新增 `approvals.actionhash.anchor.test.tsx` 16 例（A 形制判据／B 一致性诚实形制／C 超时与断连两类未知／D 决策区渲染）。

**步骤③核验结论**：`isUnknownOutcome`（`api.ts:274`）判据写作 `status===0 || status===-1`，即超时与断连两类都算未知——但已交付测试**只钉了 0 那一类**（`approvals.idempotency.test.tsx:74` `netError()` 用 `ApiError status 0`）。断连类（fetch 抛**非 ApiError** 的 `TypeError`，`failureInfo` 归 -1，`api.ts:253`）此前无测。本波 C 组补上：两类各证「POST 计数=1＋恰好一次 GET 读回＋不乐观放行」，并钉 CSRF（拦在网络前）与 502（答了话）**不**进读回腿。

**改一处既有测试的输入**（`approvals.write.probe.test.tsx:146`）：原以字面量 `"hash"` 代表「有指纹」，在新锚定腿下 `"hash"` 属非摘要体⇒会多出一条非法原因句，断言随之失真。改为现网真形制值（64 位十六进制），断言意图（有可核验指纹时只剩写通道句）逐字保留。这是新腿的必然结果，不是重做已交付面。

## 10. DoD 对表

| 条款 | 证据 |
|---|---|
| pytest 三负例 | **腿在 lane 分支不在本道**：主仓 `lane/L4-ap05-bff-negatives` @ `9eb5ee416f`，17 件全绿（非审批人 403 折叠／approver 形态 canonical 转发／同键重放既有票＋日志无 body/comment），已由总控自跑；本道不重跑主仓 |
| fork 侧幂等腿在场 | `approvals.idempotency.test.tsx` 11 例全绿（本波复跑）；本波另加 anchor 件 C 组 3 例补断连类 |
| 缺-hash 禁用腿在场 | `writeGate.ts:150/153`＋`ApprovalsPendingModulePage.tsx:666`＋`approvals.idempotency.test.tsx:311-328`；本波补 `:156/212` 形态非法腿与 `anchor` 件 A/D 组 |
| 无一处把 `already_decided` 当失败 | 逐码失败表 `copy.ts:102-108` 只有 `not_approver/expired/unavailable/service_unavailable` 四个 case，**无 `CODE_ALREADY_DECIDED`**；`decisionOutcome.ts:96-105` 把它分到 `already-decided-face` 成功侧；`ApprovalsPendingModulePage.tsx:496-497` 走成功载体。原文：`copy.ts:76`「`already_decided` 不配失败句…把服务已有的票面当错误报是说谎两次」 |

## 11. 门禁（原始 stdout）

```
$ cd web && node_modules/.bin/vitest run src/modules/approvals      # 开工基线（HEAD db793b7b）
 Test Files  93 passed (93)
      Tests  530 passed (530)
（交付时同令）
 Test Files  94 passed (94)
      Tests  546 passed (546)      # +1 件 +16 例，只增不减，0 失败

$ node_modules/.bin/vite build      # 禁 pnpm run build
build exit=0

$ node scripts/lint-fake-success.mjs
  "violations": [],
  "ok": true

$ npx tsc --noEmit -p tsconfig.app.json
tsc exit=2
error lines=49 approvals=0          # 49＝基线（apps/shared 预存），本模块 delta=0
```

**全量 `vitest run src`（exit=1，两类红，均非本道产物，逐条单列不消解）**：

```
 Test Files  2 failed | 541 passed (543)
      Tests  4 failed | 4191 passed (4195)
```

1. **`src/shell/e1Contract.test.ts`（豁免项＝9122 部署漂移环境红，禁消解）**：
   `AssertionError: served entry drifted from the dist on disk: expected 'assets/index-BXfiExcQ.js' to be 'assets/index-CtA6doEj.js'`
   served/disk 逐值现读：
   ```
   $ grep -o 'assets/index-[A-Za-z0-9_-]*\.js' ../hermes_cli/web_dist/index.html   # disk（本道新构建）
   assets/index-BXfiExcQ.js
   $ curl -s http://127.0.0.1:9122/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'   # served（验收脸）
   assets/index-CtA6doEj.js
   ```
   成因＝本道 `vite build` 换了本地 dist 的 entry hash，而 9122 仍服务部署脸；属环境漂移，非产品断言失败。**未动 9122（pid 41688）**，未改该测试，未消解。
2. **`src/modules/audit/audit.time.window.parity.test.tsx` 3 例（预存红，非豁免项、非本道）**：
   该件属审计车道写域，与本道零 import 交叉（`grep -rn "modules/approvals" src/modules/audit/audit.time.window.parity.test.tsx` 命中 0）。为免「不能碰所以不该红」的臆断，在**基线纯检出**复现同三例：
   ```
   $ git worktree add --detach <tmp> db793b7b10e77b511a402d4b9475fab25f341cad
   $ cd <tmp>/web && node_modules/.bin/vitest run src/modules/audit/audit.time.window.parity.test.tsx
     × prints the same instant in the row mark, the pane, the readout and the copied line
     × swaps the row set and leaves no reading of the old window behind
     × costs one read to open, nothing to close, and moves nothing else
    Test Files  1 failed (1) / Tests  3 failed (3)      # 与本道改动无关，基线即红
   ```
   症状＝`window=7d` 下画出的行集从 `evt_r229_alpha*` 变 `evt_r229_bravo*`（夹具时间随日历推进跨过 7 天窗口界，属日期依赖红）。**临时检出已 `git worktree remove` 清除**。处置：不消解、不越写域修他道件，报总控派审计车道。

## 12. 截图（真渲染登录态，不提交）

配方＝`DU-01-readiness-truth/evidence/du01-shoot.mjs` 形制：本 worktree `vite build` 产物＋临时同源反代（`/agent-api`→真 BFF 8092、`/auth`→真 9122，端口 **6177**，非黑名单、起前验空、**按 pid 精杀**，kill 后 `lsof -iTCP:6177 -sTCP:LISTEN` 计数 0）＋opsadmin cookie＋`domcontentloaded`＋settle 2.5s＋每图前 whoami==200；视口图不用 fullPage。

- `evidence/ap05-1440.png`、`evidence/ap05-375.png`：`whoami status=200 user=opsadmin`；`横向溢出(px)=0`；`浏览器实发请求: 405 /agent-api/api/approval/decision | 200 /agent-api/api/approvals?status=pending&limit=50`。
- **实态不可拍（如实记，不造假）**：现网 `pending=0` ⇒ 决策区无活体载体，四条形制句 DOM 计数全 0（`队列行=0 缺hash句=0 形态非法句=0 比对不可用句=0 不一致句=0 写门控句=0`，屏面为诚实空态「现在没有需要你处理的申请」）。缺-hash／非法形态／不一致三腿形制由 jsdom 钉住（`anchor` 件 D 组＋`idempotency` B 组），未用 stub 上现网、未造数据凑图。

## 13. 需求单（本道不擅动，交总控裁定）

1. **域侧票面记录指纹**：一致性腿要真做，需 `decisions[]` 携带 `action_hash`（域 `approvals.py:337-346` `_decisions` 现只出四键，AP2 签名亦不接收 action_hash）。按工单「域预期零改动，若需域改先另出 ADR」——**本道未改域、未建 ADR**，前端已留好读取腿（`model.ts:807`，缺即 null），域一旦补记形制自动生效，届时「比对不可用」句自然退场。
2. **审计车道日期依赖红**：`audit.time.window.parity.test.tsx` 3 例基线即红（§11.2 证据），建议派该车道改夹具为相对时钟。
