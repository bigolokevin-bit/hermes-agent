# AP-02 · 变更差异视图（当前 vs 批准后）— DONE

分支 `task/AP-02-change-diff`，基线 `lane/hermes-console` 现取 `502d5cf71d6e8d6c76e80ea45673eacdf1a0ecc5`（含 Q13 审批字段级 diff）。
源单：`seakoi-agent-os-l0-board/docs/product/backlogs/approvals-duty.md` 第 30–38 行 §AP-02（逐字已读）。
写域：`web/src/modules/approvals/**` ＋ 本文件。**四文件改动，零越界**（`git status --porcelain` 只列 api.ts / model.ts / views.tsx / approvals.detail.diff.test.tsx ＋ 未提交的 evidence/）。
零新端点、零写路径、`writeGate.ts` 未动（`git diff --name-only` 对它是空）。

---

## 1. 取证：现网 BFF 响应原文（非 fixture）

链路：临时 v4_proxy(9151, loopback, 脚本内起停) → console BFF(8092, `bff-v4-serve/apps/console/server.py`)
→ 域服务(8101)。登录腿＝`l7-ops/ops/opsadmin-evidence-login.sh` 产物 `~/.seakoi/opsadmin-token.txt`；
每次取图前断言 `GET /auth/whoami` → **200 `user=opsadmin`**（脚本自报，见 §5）。
原始 JSON 全部落 `evidence/`（**不提交**），下面为逐字摘录（凭据不在这些响应里，无需脱敏）。

### 1.1 `GET /api/approval?id=ap_AEEC078E0C824E749513AFEC9A`（employee_version_create，consumed）

顶层键（23 个，逐字）：
```
action,approvalId,approvers,argsDigest,binding,consumedAt,createdAt,decidedAt,decisions,
detail,expiresAt,policyDecisionId,reasonText,remainingSeconds,requestedBy,requiredApprovals,
resource,riskLevel,status,tenantId,ttlSeconds,type,verdict
```
关键字段原文：
```json
"status": "consumed",
"consumedAt": "2026-11-15T04:21:52.961Z",
"argsDigest": "22eadfcebfdaa88b5451bb8622503c876ddfd7418e692056baa29786bb9fb63f",
"binding": { "subjectType": "employee", "subjectId": "emp_86A81CE8FF6F42E187BCF2B540",
             "changeKind": "employee_version_create",
             "targetHash": "th_62872a9dadb0bfa4ab07c5f81abb0d81" },
"detail": { "changeDetail": { "employeeId": "emp_86A81CE8FF6F42E187BCF2B540",
                              "fromVersionId": "empv_BEB487D9B8DC46ECB1C1AD663B",
                              "toVersionNo": 3,
                              "addedGrants": [2 items],
                              "removedGrantIds": [0 items],
                              "effectiveFrom": "2026-11-15T03:27:58.000Z",
                              "source": "resource" } }
```
⇒ **`binding` 里确实没有 `fromVersionId`**（工单现状提示所指的正是这一层）；字段级前后值在
`detail.changeDetail` ＋ `resource` 的 snake 镜像（Q13 已按此读取，本单沿用，不重数）。

### 1.2 `GET /api/approval?id=ap_84BFBFF56BE3444BAB1D4A37D8`（message_send，consumed）

```json
"status": "consumed", "consumedAt": "2026-11-13T22:18:36.889Z",
"binding": { "subjectType": "employee", "subjectId": "emp_86A81CE8FF6F42E187BCF2B540",
             "changeKind": "message_send", "targetHash": "th_9c823cf493c6bf808a0dec2fce980e16",
             "effectiveFrom": null, "runId": "rn_01P07E2E0000000000000000AA",
             "messageDigest": "md_69f2459ca8c26ef830cf0a3c06e6c1b1" }
```
⇒ **run 标识的真身在 `binding.runId`**（顶层 `runId` 在这类单上不存在）；无 `detail`/差异载体。
`evidence/raw-detail-ap_0C67930A766D4AA49E4B5B44EC.json`（message_send，expired）同样无载体、**无 `consumedAt` 键**。

### 1.3 `GET /api/approval?id=ap_7D484B3FFBE048ECB7B96F92C9`（grant_escalation，consumed）

```json
"status": "consumed", "consumedAt": "2026-11-15T03:23:29.443Z",
"binding": { "subjectType": "employee", "subjectId": "emp_86A81CE8FF6F42E187BCF2B540",
             "changeKind": "grant_escalation", "targetHash": "th_7111bc64272abf73c0f0e27373c4f4e9" }
```
`detail? False` ⇒ 该类型**没有差异载体**，与工单「只有 employee_version_create 出字段级差异」一致。

### 1.4 风险差异四项——逐单清点结果（步骤③ 的判据）

对 `evidence/` 全部 5 份 detail 原文做键清点：屏上四项口径对应的键（可触达/新增写入/未脱敏/同类申请）
**一份都不存在**；模块内 `grep -rn "可触达\|新增写入\|未脱敏\|同类申请" web/src/modules/approvals/*.ts(x)`
只命中我写的注释行（`RISK_LABEL_SITES` 无渲染站点）。⇒ 处置＝**整块不渲染**（不画 0、不摆空壳），
并由新测试把「四项标签不出现」钉住。

### 1.5 `GET /api/employee-versions?id=emp_86A81CE8FF6F42E187BCF2B540&limit=50`（相邻版本读口）

```
顶层键: ["items"]   n=5
items[2] {"id":"empv_7369DD6AAB6B4AD9B07D9D67AF","versionNo":3,"effectiveFrom":"2026-11-15T03:27:58.000Z"}
items[3] {"id":"empv_BEB487D9B8DC46ECB1C1AD663B","versionNo":2,"effectiveFrom":"2026-11-14T11:30:47.566Z"}
```
⇒ 单据带回的 `fromVersionId=empv_BEB487…` 在链上＝**v2**，`toVersionNo=3` **已在链上**，
屏上因此可以老实说「前版 v2 → 后版 v3 已在链上；链上读回 5 版」——这三个数都来自读回，不是补造。
路由出处：`bff-v4-serve/apps/console/server.py:59`（`/api/employee-versions?id=` → 域 `v1/employees/{id}/versions`）——**既有端点，本单零新增**。

---

## 2. 改动清单（按步骤①②③④）

### `model.ts`
- **① changeKind 分支单点** `diffBranchFor(detail)` → 四类确定形态：
  `version/rows`｜`version/carrier-empty`｜`version/no-carrier`｜`no-source`（已知其它类型）｜`unknown-kind`。
  只认 `changeKind|change_kind|binding.changeKind`（R25：顶层 `type=business_action` 是审批类不是变更类型），
  未知类型**不推断成任何已知类**。`VERSION_CHANGE_KIND = "employee_version_create"` 为唯一有差异数据源的类型。
- **① 版本锚与链读数**：`versionAnchorFrom`（employeeId/fromVersionId/toVersionNo，carrier→resource→binding 逐级读，
  读不到=null）、`employeeVersionRefsFrom`（实测 `items` 形制）、`versionChainNote`
  （`readable/fromLabel/target/chainSize`；读不回＝`readable:false`，**0 只在真读到空链时出现**）。
- **② consumedAt 腿**：`consumedAt: pickText(body,["consumedAt","consumed_at"])`（缺即 null，不是 0）；
  `consumptionRunId = 顶层 runId ?? binding.runId`（**不动** R46 的 `runId` 腿，避免改到决策链路既有契约）；
  `consumptionStateFrom(status.raw, consumedAt)` → `waiting`（APPROVED 族＋空）/`used`（非空）/
  `used+timeMissing`（CONSUMED 族但键缺席，只说「未回传」）/`null`（pending/expired/rejected… 不宣称消费）。
- **④ argsDigest 腿**：`digest` 单独一条读取腿；技术行文案改为
  `参数摘要：…（不可逆摘要，非差异）`、`操作指纹：…（不可逆摘要，非差异）`。
- `ApprovalDetail` 新增 `consumedAt / consumptionRunId / digest / versionAnchor` 四字段（全部缺即 null）。

### `api.ts`
- `EMPLOYEE_VERSIONS_PATH = "/agent-api/api/employee-versions"` ＋ `employeeVersionsUrl(id)`（`?id=&limit=50`）
  ＋ `fetchVersionChain(employeeId)`：只读、只在版本类差异出数据时被调用；
  返回 `null`＝读口没答成版本列表（失败/无权），`[]`＝真读到空链——两者都不补造。

### `views.tsx`（与 Q13 段的融合，见 §4）
- `ChangeDiffSection`：沿用 Q13 的 `apd10-diff` 段与 `apd10-diff-row-/before-/after-/empty/unwired` testid，
  内部按 `diffBranchFor` 四分支；`no-source` 句＝工单逐字
  **「差异明细未提供（该变更类型无差异数据源）」**，`unknown-kind` 句＝「差异明细未提供（该单据没写明变更类型）」。
- `VersionChainLine`：只在 `version/rows` 分支挂载（无载体时不猜版本对，也**一次都不读链**）；
  四档读数 `apd10-chain-note`／`apd10-chain-unreadable`／`apd10-chain-failed`／`apd10-chain-no-anchor`。
- `ConsumptionStateLine`：`apd10-consumed-waiting`／`apd10-consumed-used`
  ＋ 仅当真带回 run 才画 `apd10-consumed-run-link`（否则 `apd10-consumed-run-none` 说明为什么没链）。
- `apd10-digest-note`：差异段内先声明「参数摘要为不可逆摘要，非差异」。

### `approvals.detail.diff.test.tsx`（按 changeKind 四分支扩展，Q13 三态语义逐字未破）
- 保留 Q13 ①②③ 三例**断言一字未改**（含 `未接`、title 的 `响应没有带回字段级前后值`、camel/snake 镜像不重数、
  决策钮 `disabled`＋`title==DECISION_GATE.title`）。
- 新增 11 例：分支①（含 URL 逐字钉 `/agent-api/api/employee-versions?id=emp_86A81CE8FF6F42E187BCF2B540&limit=50`）、
  分支①b（链读不回⇒不补 v 号）、分支②（无载体⇒零次读链）、分支③（message_send/grant_escalation 各一次，
  原因句点名类型原值）、分支④（未写明类型）、风险四项不渲染＋无「0 项/0 条」＋空 `removedGrantIds` 不出行、
  argsDigest 标注（含展开「详情」后的技术行原文）、consumedAt 两态＋回链有无两态、
  以及读取腿单点（`consumptionStateFrom` 对 expired/pending 返回 null）。

---

## 3. 门禁（原始 stdout）

```
$ cd web && node_modules/.bin/vitest run src/modules/approvals
 Test Files  86 passed (86)
      Tests  417 passed (417)
   Duration  10.68s (transform 14.96s, setup 0ms, import 67.96s, tests 38.71s, environment 59.02s)

$ cd web && node_modules/.bin/vitest run src/modules/approvals/approvals.detail.diff.test.tsx
 Test Files  1 passed (1)
      Tests  14 passed (14)
   Duration  1.41s (transform 608ms, setup 0ms, import 785ms, tests 273ms, environment 292ms)

$ cd web && node_modules/.bin/vite build            # 未用 pnpm run build（tsc -b 有仓级预存错）
✓ built in 5.78s        BUILD_EXIT=0
产物：hermes_cli/web_dist（.gitignore 已忽略，未提交）

$ cd web && node scripts/lint-fake-success.mjs
{ "script": "lint-fake-success", "file": "docs/console-v4-skeleton.html",
  "linesScanned": 9252, "allowedInfo": {"规划中":188,"不会保存":1,"未接入":22},
  "violations": [], "ok": true }                    violations=0 ✓

$ cd web && node_modules/.bin/tsc --noEmit -p tsconfig.app.json
approvals 写域错误 = 0        全仓 = 49（全部在 ../apps/shared/src/*.test.ts，本单未触碰）
```

**tsc 口径如实说明**：工单给的 `tsc --noEmit -p .` 在本仓是 **solution 形制**（`tsconfig.json` 为
`files: [] + references`），`--listFiles` 实测**不含任何 approvals 文件**，跑出的 0 错是空集而非通过。
因此我改用被引用的 `tsconfig.app.json` 做真检查：写域 0 错；仓级 49 错全在 `apps/shared` 测试件（预存、与写域无关）。

**基线数字与工单的差**：工单写「基线 87 文件/415 测试」。本 worktree 基线 `502d5cf71` 实测
**86 文件 / 406 测试**——AP-01 的 `approvals.denominator.honesty.test.tsx`（+1 文件/+9 测试）还在
`task/AP-01-pending-truth`（tip `25171fd1311fbd9c6f4a28c867cf9f81dce0b986`）未并线，87/415 是并上它之后的数。
本单在它之上 **＋11 测试（417）**，文件数不变（按工单「扩展 approvals.detail.diff.test.tsx」而非另起一件），
**无既有用例被删**：406→417 只增不减 ✓。

---

## 4. 与 Q13 `apd10-diff` 段的关系

Q13 落地的段（`变更差异 · 字段级（只读）`，从 `detail.changeDetail`/`resource` 键推断，三态
`real/absent/null`）**没有被旁置或重复**：它就是本单差异分区的主体。融合方式＝
把段内那棵 `detail.diff === null ? … : fields.length ? … : …` 三目树换成 `diffBranchFor` 的四分支判定，
**testid 族、句式骨架（`未接——…，屏上不猜差异内容。`）、原因句（title 里的「响应没有带回字段级前后值」）
与 camel/snake 镜像只算一份的纪律全部原样保留**，所以 Q13 的三条断言一字未改仍绿。
新增的是：① 非版本类型不再走「响应没带回」这一句，而是走工单逐字的
「差异明细未提供（该变更类型无差异数据源）」；② 版本类在真有字段行时补一条**相邻版本核对腿**
（读既有 `/api/employee-versions`）；③ 段内新增 `apd10-digest-note`；④ 段后新增 `consumedAt` 两态行。

---

## 5. 截图（真实渲染，`evidence/` 内，不提交）

| 文件（绝对路径） | 档位 | 拍到的实态 |
|---|---|---|
| `/Users/kevin_studio/Projects/tasks/AP-02-change-diff/evidence/ap02-1440.png` | 1440×900 | employee_version_create 差异分区：员工版本 前 `empv_B…663B` → 后 v3、两条新增授权（业务接口·execute / 渠道·send）、`版本链核对：前版 v2 → 后版 v3 已在链上；链上读回 5 版。` |
| `/Users/kevin_studio/Projects/tasks/AP-02-change-diff/evidence/ap02-375.png` | 375×812 | 同上**且含消费态行** `已被运行时使用：2026-11-15 12:21。（该单没带回运行编号，故不给回链。）`；`hOverflow=0` 纵排不破版 |
| `/Users/kevin_studio/Projects/tasks/AP-02-change-diff/evidence/ap02-nosource-1440.png` | 1440×900 | message_send 的「未提供」态：`未接——差异明细未提供（该变更类型无差异数据源），屏上不猜差异内容。` ＋ `参数摘要为不可逆摘要，非差异` ＋ `已被运行时使用：2026-11-14 06:18。 查看该次运行`（真回链） |
| `/Users/kevin_studio/Projects/tasks/AP-02-change-diff/evidence/ap02-nosource-375.png` | 375×812 | 同上的 375 档，`hOverflow=0` |

取图脚本 `evidence/ap02-shoot.mjs`（AP-01 形制）：worktree `vite build` 产物经**临时** v4_proxy
（`V4_SERVE_PORT=9151`，脚本 `spawn`＋`try/finally` 自杀）同源提供，`/agent-api/*` 反代真 BFF(8092)；
`domcontentloaded` ＋ 显式 settle 2.2s（**禁 networkidle**）；每图前断言 `whoami==200`（四张全部 `200 user=opsadmin`）；
视口图非 fullPage；抽屉有独立滚动轴且 `scroll-behavior:smooth`，故取图前关掉 smooth 并把目标句滚到居中，
否则消费态行压在折线外（首版四张就是因此拍不到，已重取并在脚本注释里记了原因）。
脚本自报浏览器实发请求：

```
版本类：200 /agent-api/api/approval?id=ap_AEEC078E0C824E749513AFEC9A |
        200 /agent-api/api/approvals?limit=50 |
        200 /agent-api/api/employee-versions?id=emp_86A81CE8FF6F42E187BCF2B540&limit=50
消息类：200 /agent-api/api/approval?id=ap_84BFBFF56BE3444BAB1D4A37D8 |
        200 /agent-api/api/approvals?limit=50        （无 employee-versions＝非版本类零次读链）
```
临时代理用完已杀（`PORT9151` 复查 0 监听）；9122/9131/9141 他道进程未动。

---

## 6. 与工单口径的偏差（如实记录）

1. **相邻版本读口的角色**：工单步骤① 字面是「employee_version_create 走 `/api/employee-versions` 读相邻版本推断」。
   实测主数据源是服务自己算好的 `detail.changeDetail`（`source:"resource"`），所以本单把它保留为**字段级行的唯一来源**，
   `/api/employee-versions` 用作**相邻版本核对腿**（把 `fromVersionId` 对进链、确认 `toVersionNo` 在不在链上）。
   理由：链里只有版本行，**没有「哪一版是这张单造的」的指认**；若响应没带回 `fromVersionId/toVersionNo`，
   从链上两行硬凑一对就是猜——工单自己的口径是「域响应体不含 fromVersionId——读不到就走未提供口径」，故
   `no-carrier` 分支**一次都不读链**（测试逐字钉住 `versionsCalls == []`）。
2. **没改 `ApprovalsPendingModulePage.tsx`**（工单改动文件列了它作「详情挂载点」）：
   详情体的单点是 `views.tsx` 的 `ApprovalDetailBody`，待处理抽屉与历史抽屉共用（Q13 测试③ 就是靠这一点断言的），
   在挂载点再加一遍会变成两套差异段、违反单点纪律。故零改动，融合全部落在共用体内。
3. **`consumedAt` 的 waiting 态现网无真样本**：本机域库 16 单＝11 expired ＋ 5 consumed，`approved`/`pending` 均 0
   （`evidence/raw-list-fanout.json` 逐行清点）。因此「已批准，等待运行时使用」上屏态**只用测试钉住**，
   未用 fixture 伪造上屏；`used` 态有真样本，已出图（两张）。
4. **run 回链的读取腿**：新增 `consumptionRunId`（顶层 `runId` ?? `binding.runId`），
   **没有**去扩 R46 既有的 `runId` 腿——后者被 `apd6-link-run-none` 系列断言钉着（含
   `ApprovalsHistoryModulePage.test.tsx:2036` 删顶层 runId 后必须仍显 none 的契约），扩它会改既有语义。
5. **tsc 命令口径**：见 §3——工单给的命令是空集检查，我补跑了真检查并写明两者读数。
6. **测试文件数不变**：按工单「扩展 approvals.detail.diff.test.tsx」，新分支落在同一件里（+11 例），
   没有新增文件；与 §3 的基线差（86 vs 87）一并说明，避免总控台账按 87/415 对不上数。

---

## 7. DoD 对照

- 差异分区对四类 changeKind 各有确定形态 → §2 `diffBranchFor` 五读数四形态 ＋ 测试分支①①b②③④；
  有数据出 added/removed（`apd10-diff-row-*`），无数据出未提供句（`apd10-diff-unwired`）。
- `consumedAt` 两态可判 → `consumptionStateFrom` 单点 ＋ 测试三例（waiting / used＋回链 / used 无 run / 键缺失），
  真回链已上屏（`apd10-consumed-run-link` → `/runs?run=rn_01P07E2E0000000000000000AA`）。
- 无一项以 0 或骨架样例占位 → 风险四项整块不渲染（§1.4＋测试）；`removedGrantIds: []` 不出行；
  链读不回只说「未读回/不判定」；`chainSize` 仅在真读回时出现。
- `argsDigest` 标「不可逆摘要，非差异」 → 差异段 `apd10-digest-note` ＋ 技术行两处后缀，测试断言原文。
- 决策钮维持 DECISION_GATE 禁用＋原因、写开关关 → `writeGate.ts` 零改动；Q13 测试③ 原样绿。
- 不新增端点 → 只用 `/api/approval?id=`、`/api/approvals`、`/api/employee-versions`（server.py:59 路由表内）。
