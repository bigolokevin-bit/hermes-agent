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
