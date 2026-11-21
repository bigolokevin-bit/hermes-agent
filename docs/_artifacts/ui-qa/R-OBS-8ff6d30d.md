# R-OBS-8ff6d30d — 双面 obs 只读归因（auth obs=2 路由 access / capabilities?tab=channels；anon obs=2 路由 access / approvals?tab=policy）

取证时刻：2026-11-21 11:03–11:09（北京时间）。工作树：`lane/console-ui-qa`，HEAD `b99ffdc8`（已并入派单代次 `8ff6d30d`，`git merge-base --is-ancestor 8ff6d30d HEAD` = YES）。现网基址 `http://100.117.184.117:8183`（**非** 127.0.0.1）。全程只读：未改产品码、未改 testid、未重启服务、未发群消息。

## 0. 结论摘要

| 路由 | 台账 err 计数（auth / anon，逐视口） | 我 auth 面（有效 opsadmin 态） | 我 anon 面（无登录态 + gated 旗标） | 三选一归因 |
|---|---|---|---|---|
| `#/access` | 5 / 5（1440、375 同） | 4 行全 `404 (Not Found)`，落地 `/identity?tab=roles`，页面走 `ac3-gap`「上游角色接口尚未接入本控制台」 | 5 行全 `401 (Unauthorized)` = `/auth/whoami` + 同 4 枚 v1 读口 | **ENV**（`/agent-api/` 404＝上游未接线；`/auth/` 与鉴权后 401＝无登录态） |
| `#/capabilities?tab=channels` | 48 / 27（auth，1440/375）、8 / 8（anon） | 4 行全 `404 (Not Found)`，main 1017 正常出「读取成功 · 列出 2 个平台」 | 8 行全 `401 (Unauthorized)`（并发 7 枚候选读口 + whoami） | **ENV**（候选读口清单见 §4.2，未注册者必 404；匿名时被网关提前 401） |
| `#/approvals?tab=policy` | 2 / 2（两面各视口） | **0 行**（main 950，页面正常） | 2 行全 `401 (Unauthorized)` = `/auth/whoami` + `/agent-api/api/approvals?status=pending&limit=50` | **ENV**（该 tab 是 `#/approvals` 的 compat-tab 别名，复用待处理读口；有效态零 error） |
| `#/knowledge?tab=retrieval` | auth 4 / 4、anon **7** / 4 | 2 行全 `404 (Not Found)`，main 773 | 4 行全 `401 (Unauthorized)`，main 508，页面走「需要登录」合规错误态 | **ENV**；anon 7 与我的 4 之差不可复现，见 §5 |

- **产品码证据 = 零**：`git grep -c 'console\.error' -- web/src` = **0 文件命中**（HEAD `b99ffdc8`）；16 次采样中 `pageerror` 0、堆栈 0、`requestfailed` 0、401/404 之外的状态码 0；所有样本 `productLinesTotal=0`（按 shots.mjs 的 `ENV_NOISE_RE` 口径）。
- **obs 红灯载体是「同一批未接线读口在不同 tab 别名轮替出名」**，不是新缺陷：本件四条路由全部落进已归因谱系（§6），**同源复用 R-OBS-2**。
- 台账里 `#/capabilities?tab=channels` auth 面 48 行/27 行与 `main chars` 113、375 档 `main chars` **10**（=「⠋ Loading…」壳）＝ **台账 auth 面用的是已过期 `v4-auth-state.json`**（`exp=1795173121`＝2026-11-20 19:12，取证时已过期约 16 小时）→ 其 auth 行在网关侧等价于匿名态，与派单口径「auth obs=2」并不矛盾于「有效登录态下 obs=0」。

## 1. 台账原文与两处口径偏差

`docs/_artifacts/tonight/shots-summary.json`（auth 面）与 `shots-anon-summary.json`（anon 面）关键字段逐字：

```
shots-summary.json      | headHash= 068833bc | entry= assets/index-OCLu6KCF.js | base= http://127.0.0.1:9122 | obs= 0 | routes= []                                   | envOnly= 51 | authStateFile= /Users/kevin_studio/.local/state/sekoi-ops/v4-auth-state.json
shots-anon-summary.json | headHash= 068833bc | entry= assets/index-OCLu6KCF.js | base= http://127.0.0.1:9122 | obs= 1 | routes= ['#/knowledge?tab=retrieval']      | envOnly= 51 | authStateFile= None
```

两面 `ceAuthority=login-state`、`navForm=fresh-goto hash-form #/<route> (crawl-parity, 二十三轮修复)`、`servedEntryBefore/After=index-OCLu6KCF.js`、`ok=true`、`exitCode=0`、`auxiliary=true`、`routesEnumerated=51`、`expectedShots=producedShots=102`、`failures=[]`、`overflowing=[]`；**两面 summary 都没有 `consoleErrorSample` 键**（该字段只存在于 `shots.mjs:420-422` 的逐行 JSON）→ 台账侧无法给出逐字原文，本文件 §3 的原文全部来自我自己的复现。

**偏差 1（代次）**：派单说当代是 `8ff6d30d`，盘上两面 `headHash` 均为 **`068833bc`**（wave-98 merge）。`8ff6d30d`（`merge(lane): 31f80120 wave-99`）尚未重章到这份 summary 里，但 `8ff6d30d` 已并入我的工作树。
**偏差 2（obs 值与路由集）**：派单正文（更新版）写 auth `obs=2` = `[access, capabilities?tab=channels]`、anon `obs=2` = `[access, approvals?tab=policy]`；盘上台账是 **auth `obs=0` / anon `obs=1`（唯一路由 `#/knowledge?tab=retrieval`）**，与派单更早一版（@「当代 anon obs=1 路由 #/knowledge?tab=retrieval（auth obs=0）」）逐字一致。两版派单互斥，我按**并集**取证（4 条唯一路由，含派单点名的 access / channels / policy 与台账点名的 retrieval），因此两版结论都能销。
**偏差 3（base）**：台账 base 是 `http://127.0.0.1:9122`（本地静态代理），派单要求现网 `8183`。我以现网为主、9122 作旁证（§3.4）。
**代次一致（本件有利点）**：现网 `curl` 实测 served entry = `assets/index-OCLu6KCF.js` = 台账 entry → 我的复现与台账同构建代（与前几件的代次漂移不同）。

`shots-index.md`（auth 面）与 `shots-anon-index.md`（anon 面）逐字行，列序 `route | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err`：

```
auth  10:| `#/access` | 角色与权限 | 1440 | 200 | 201 | yes | - | - | 0 | yes | 72315 | 5 |
auth  11:| `#/access` | 角色与权限 | 375  | 200 | 201 | yes | - | - | 0 | yes | 45121 | 5 |
auth  22:| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 111933 | 2 |
auth  23:| `#/approvals?tab=policy` | 待处理 | 375  | 200 | 466 | yes | yes | yes | 0 | yes | 71291 | 2 |
auth  30:| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 113 | yes | - | - | 0 | yes | 62475 | 48 |
auth  31:| `#/capabilities?tab=channels` | 平台接入 | 375  | 200 |  10 | yes | - | - | 0 | yes | 37673 | 27 |
auth  74:| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 508 | yes | yes | - | 0 | yes | 126567 | 4 |
auth  75:| `#/knowledge?tab=retrieval` | 证据与引用 | 375  | 200 | 508 | yes | yes | - | 0 | yes | 63914 | 4 |
anon  10:| `#/access` | 角色与权限 | 1440 | 200 | 201 | yes | - | - | 0 | yes | 72095 | 5 |
anon  11:| `#/access` | 角色与权限 | 375  | 200 | 201 | yes | - | - | 0 | yes | 45240 | 5 |
anon  22:| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 111833 | 2 |
anon  23:| `#/approvals?tab=policy` | 待处理 | 375  | 200 | 466 | yes | yes | yes | 0 | yes | 71779 | 2 |
anon  30:| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 200 | yes | - | - | 0 | yes | 79960 | 8 |
anon  31:| `#/capabilities?tab=channels` | 平台接入 | 375  | 200 | 200 | yes | - | - | 0 | yes | 51117 | 8 |
anon  74:| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 506 | yes | yes | - | 0 | yes | 61930 | 7 |
anon  75:| `#/knowledge?tab=retrieval` | 证据与引用 | 375  | 200 | 508 | yes | yes | - | 0 | yes | 63914 | 4 |
```

我的 anon 读数与台账 anon 在 `#/access`(5/5)、`channels`(8/8)、`policy`(2/2)、`retrieval`(4 vs 7/4) 上同量级，`main chars` 201 / 200 / 466 / 508 与台账逐字相等或同数（唯一例外是 retrieval 1440 档行数，见 §5）。

## 2. 复现命令原文

脚本 `/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/obs-6632f340.mjs`：严格复刻 `shots.mjs` 的采集口径 —— 每个（路由 × 视口）全新 `browser.newContext()`（auth 传 `storageState`，anon 不传）、`GATED=1` 时 `addInitScript(() => { window.__HERMES_AUTH_REQUIRED__ = true })`、`goto(BASE + '/' + route, {waitUntil:'domcontentloaded'})`、main innerText 长度稳定轮询、`m.text().slice(0,160)` 后套 `ENV_NOISE_RE`（shots.mjs:255/:286/:288/:291）、并额外统计 `framenavigated` 次数 `navs` 以侦测 reload 风暴。

```
# 现网 8183，派单点名的四条唯一路由（并集）
cd /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode
R='#/access||#/capabilities?tab=channels||#/approvals?tab=policy||#/knowledge?tab=retrieval'
MODE=anon GATED=1 REPS=1 ROUTES="$R" node obs-6632f340.mjs > o8ff2-anon.out 2> o8ff2-anon.err      # rc=0, err 0B, 18564B
MODE=auth REPS=1 ROUTES="$R"          node obs-6632f340.mjs > o8ff2-auth.out 2> o8ff2-auth.err      # rc=0, err 0B, 15711B

# 同一路由集的 9122 旁证（台账原环境）与更早一轮的 retrieval 对照
BASE=http://127.0.0.1:9122 ROUTES='#/knowledge?tab=retrieval||#/knowledge' MODE=anon GATED=1 REPS=1 node obs-6632f340.mjs > o8ff-9122-anon.out
BASE=http://127.0.0.1:9122 ROUTES='#/knowledge?tab=retrieval||#/knowledge' MODE=auth  STATE=$HOME/.local/state/sekoi-ops/v4-auth-state.json REPS=1 node obs-6632f340.mjs > o8ff-9122-auth.out
```

auth 面用的是有效登录态 `~/.local/state/sekoi-ops/ui-qa-auth-state.json`（opsadmin，JWT 未过期）；派单/台账指定的 `v4-auth-state.json` 已过期，只在 9122 旁证里用。

## 3. 逐条 console 原文（现网 8183）

### 3.1 auth 面（有效 opsadmin 态）— 全部 `404 (Not Found)`，product 恒 0

```
#/access（两视口各 4 行，落地 /identity?tab=roles，main 194）
  [1..4] Failed to load resource: the server responded with a status of 404 (Not Found)
         @ /agent-api/api/v1/role/list?page=1&limit=200 · /agent-api/api/v1/user/list
         · /agent-api/api/v1/roles?page=1&limit=200     · /agent-api/api/v1/user/all
  TESTIDS = ac3-page, ac3-tab-roles, ac3-tab-members, ac3-tab-admins, ac3-gap
  MAIN    = 「… 角色 — 成员 — 管理员 — 未接入 角色与权限待核实：上游角色接口尚未接入本控制台。
             接入后这里会自动显示真实角色。 去审批中心提交开通申请 …」

#/capabilities?tab=channels（两视口各 4 行，main 1017）
  [1..4] 404 @ /agent-api/api/gateway-connections?limit=50 · /datasources?limit=50
             · /mcp/servers?limit=50                      · /connectors?limit=50
  MAIN  = 「读取成功 … 列出 2 个渠道或平台（已接入 2 …）」（页面本身正常出数）

#/approvals?tab=policy（两视口各 0 行，main 950）→ 无 console error

#/knowledge?tab=retrieval（两视口各 2 行，main 773）
  [1..2] 404 @ /agent-api/api/knowledge/search?limit=12 · /agent-api/api/documents?limit=50
         （另轮出现 /agent-api/api/knowledge/spaces?limit=20 —— 候选读口按竞速取二）
SUMMARY auth|…  productLinesTotal=0（四路由全 0）  productTexts=[]
```

### 3.2 anon 面（无登录态 + gated 旗标）— 全部 `401 (Unauthorized)`，product 恒 0

```
#/access            5 行：/auth/whoami + 上述四枚 v1 端点（视口间顺序漂移）
#/capabilities?tab=channels
                    8 行：/auth/whoami + /agent-api/api/{datasources,hermes-summary,gateway-connections,
                           mcp/servers,messaging/platforms,connectors,channels}?limit=50
#/approvals?tab=policy
                    2 行：/auth/whoami + /agent-api/api/approvals?status=pending&limit=50
#/knowledge?tab=retrieval
                    4 行：/auth/whoami + /agent-api/api/{knowledge/search?limit=12,
                           audit?action=kb.read&limit=50, documents?limit=50}
SUMMARY anon|…  linesPerRun=[5,5]/[8,8]/[2,2]/[4,4]  navsPerRun=[4,4]/[4,4]/[4,4]/[5,5]
              productLinesTotal=0  texts 唯一一句 401  productTexts=[]
```

`#/approvals?tab=policy` 的正文 466 字符＝待处理清单的「需要登录」合规态（该 tab 是 `#/approvals` 的 compat-tab 别名，见 `routes.ts:254`）；`#/knowledge?tab=retrieval` 落地 `http://100.117.184.117:8183/knowledge?panel=retrieval`（`tab=` 被 SPA 改写成 `panel=`）。

### 3.3 交叉核对（全量）

16 次采样（4 路由 × 2 视口 × 2 面）里，逐行原文只有两种文本：`… 404 (Not Found)` 与 `… 401 (Unauthorized)`；`productTexts` 全为 `[]`；`    ## `（pageerror 堆栈）与 `    !! `（requestfailed）计数均为 **0**；无 reload 风暴（`navsPerRun` 恒 4 或 5）。

### 3.4 9122 旁证（台账原环境）

`o8ff-9122-anon.out`：`anon|#/knowledge?tab=retrieval samples=2 linesPerRun=[5,5] navsPerRun=[4,4] productLinesTotal=0 mainChars=[200]`。
`o8ff-9122-auth.out`（用**过期 v4 态**）：`linesPerRun=[5,6] productLinesTotal=0 mainChars=[10]`（页面停在「⠋ Loading…」壳，`navs` 4/11）→ 与台账 auth 面 375 档 `main chars=10` 逐字吻合，证明台账 auth 面那格确实是失效登录态产物。`curl` 旁证：9122 无 cookie 时 `whoami / documents?limit=50 / knowledge/search?limit=12 / knowledge/spaces?limit=20 / audit?action=kb.read&limit=50` 全 **401**（该代理不做 404 文本；`/nonexistent-zz` 回 200 SPA fallback）。

## 4. 归因（逐条三选一，含源码定位）

### 4.1 `#/access` — **ENV（上游未接线 + 无登录态）**
- `#/access` 是 `#/identity?tab=roles` 的兼容别名：`web/src/shell/routes.ts:266`（`kind:'compat-module'`, `visible:false`, `to:'#/identity?tab=roles'`）。
- 4 枚 404 来自产品自己声明的候选清单：`web/src/modules/access/access.ts:31-37` `PEOPLE_ENDPOINTS = ["/agent-api/api/v1/user/list", "/agent-api/api/v1/user/all"]`、`ROLE_ENDPOINTS = ["/agent-api/api/v1/role/list?page=1&limit=200", "/agent-api/api/v1/roles?page=1&limit=200"]` —— 两组各 2 枚一次全试，故匿名/有效态天然是 4/5 行。
- 页面在 404 后渲染 `ac3-gap`「未接入 角色与权限待核实：上游角色接口尚未接入本控制台」（`web/src/modules/access/AccessModulePage.tsx:237`）→ 合规「未接入」态，不是崩溃、不是白屏。
- 无 `console.error`，`pageerror` 0 → **不是产品码**。URL 全属 `/agent-api/`、`/auth/` → **不是 BFF 业务错**（404 是路由未注册，401 是网关鉴权）。

### 4.2 `#/capabilities?tab=channels` — **ENV（同一族：未注册路由必 404）**
`web/src/modules/channels/channels.ts` 头部注释即本路由的**端点真值表**，逐字：`:14 /api/channels named by the task; NOT in any route table`、`:17 /api/messaging/platforms REAL upstream route … NOT registered by the console BFF`、`:22 /api/connectors named by the task; no such route anywhere in this repo`、`:24 /api/gateway-connections REAL upstream route … NOT registered by the console BFF`、`:27 /api/mcp/servers REAL upstream route … NOT registered（that gap is GAP-04, owned by T27）`、`:31 /api/datasources named by the task; no such route …`；`:36-43` 进一步写明「console BFF 一个都没注册（`PROXY_ROUTES` 只有 employees/approvals/audit/tasks/runs/skills/sessions…）；未注册的路由回 404，屏幕显「未接入」，**不用示例行、示例计数或绿色徽标顶替**；每个来源按序试候选路径，第一个真的是列表的答案获胜」。
常量清单：`channels.ts:148` `paths:["/agent-api/api/hermes-summary","/agent-api/api/messaging/platforms","/agent-api/api/channels"]`、`:158` `["/agent-api/api/gateway-connections","/agent-api/api/connectors"]`、`:168` `["/agent-api/api/datasources"]`。
→ 有效态 4 行 404 与匿名态 8 行 401 都是这张未注册清单的必然产物（匿名时网关在鉴权层先拦，故 401 且候选全发）。**ENV / 上游未接线，非产品码。**

### 4.3 `#/approvals?tab=policy` — **ENV（别名复用待处理读口；有效态零 error）**
- `web/src/shell/routes.ts:254` `{ hash:'#/approvals?tab=policy', path:'/approvals', tabId:'pending', kind:'compat-tab', visible:false, label:'待处理', tab:'policy', to:'#/approvals' }` → 该页签不引入新读口，读的就是待处理清单：`web/src/modules/approvals/api.ts:22 LIST_PATH="/agent-api/api/approvals"` + `:27 PAGE_LIMIT=50` → 匿名唯一行 `/agent-api/api/approvals?status=pending&limit=50`。
- 有效登录态 **0 行 console error**（main 950 正常）→ 台账把它列进 anon 路由是「无登录态」的必然，把它列进 auth 路由只能是**失效登录态**产物。

### 4.4 `#/knowledge?tab=retrieval` — **ENV + 不可复现的 3 行差额**
- 别名：`routes.ts:246`（`tab:'retrieval'` → `to:'#/knowledge?tab=evidence'`，label 证据与引用）、`:344` `knowledge: { scope:'spaces', ingest:'sources', retrieval:'evidence', citations:'evidence' }`；落地 URL 被改写成 `/knowledge?panel=retrieval`。
- 端点真值表在产品侧自证：`web/src/modules/knowledge/knowledge.ts:7-20` —— `:7/:8 knowledge/search → 404 console.unknown_route`、`:10 knowledge/spaces → 404 knowledge.not_wired`、`:15 documents?limit=50 → 404 console.unknown_route`、`:16 audit?action=kb.read&limit=50 → 200 { events: [] }`、**`:19 run-events?kind=citation → 400 console.missing_param（要 runId）`**。常量：`:159 SPACES_URL`、`:172 DOCUMENTS_URL`、`:214 RECORDS_URL`、`:222 CITATIONS_URL`、`:256` search URL 构造。
- 有效态 2 行 404 / 匿名 4 行 401，与真值表逐枚对上；页面走「需要登录 / 重新登录后就能再看这块知识数据」合规错误态（`knw5-reason`），`knN-*` 是 `display:none` 机判探针（前件已证，不构成画面变化）。

### 4.5 机制假设：为什么台账会把某些行计成 product（明确标注为**假设**）
`ENV_NOISE_RE = /\b(401|404)\s*\((Unauthorized|Not Found)\)/`（`shots.mjs:255`）**且先 `slice(0,160)` 再判**：只有带这两种 reason-phrase 文案的行会被判 env；**400 / 403 / 5xx、`net::ERR_ABORTED`、或一次瞬时 `pageerror`** 都会被 `:288`/`:291` 计为 product。本代台账 anon 的 `retrieval` 1440 档多出的 3 行（7 vs 4）落在该集合里最可能的载体是：`:19` 那枚上游 **400**（该面板正是 `tab=evidence` 的别名）、失效登录态下的 reload 中断（我 9122 旁证里 `mainChars=[10]` 即 Loading 壳）、或候选读口竞速里被 `abort` 的请求。我在 16 次现网采样与 4 次 9122 采样中**均未见到任何 400/5xx/ERR 行** → 该差额登记为**不可复现**，不作产品结论。

## 5. 取证边界

1. 台账不落逐行原文（两面 summary 无 `consoleErrorSample`）→ 无法给字节级原文与堆栈；本文件所有原文来自我的复现。
2. 台账 `headHash=068833bc` ≠ 派单代次 `8ff6d30d`；两版派单的 obs 值/路由集互斥（auth 0 vs 2、anon 1[retrieval] vs 2[access,policy]），我按并集取证。
3. 台账 base=`127.0.0.1:9122`（SPA fallback 代理，不产生 404 文案），派单要求现网 8183；我以现网为主。
4. 台账 auth 面 `authStateFile` 是已过期 `v4-auth-state.json` → 其 auth 行语义 ≈ 匿名 + Loading 壳，不能与有效登录态混读。
5. 代次一致：现网 served entry 与台账同为 `index-OCLu6KCF.js`（本件无代次漂移）。
6. 台账 anon `retrieval` 1440 档 7 行 vs 我恒 4 行（8 次采样）不可复现；§4.5 给机制假设但不下产品结论。
7. 我未改任何产品码 / testid，未重启服务，未发群消息。

## 6. 同源判定（与 R-OBS1 / R-OBS2 谱系）

| 既有归因 | 覆盖路由 | 与本件关系 |
|---|---|---|
| `R-OBS1-attribution.md`（wave-58） | `#/capabilities?tab=channels`（auth，网关 404） | **同源**（同一张未注册清单） |
| `R-OBS1-43d83d65.md` | 同上（重章代） | **同源** |
| `R-OBS-ANON-AUDIT.md` / `R-OBS-ANON-IDENTITY.md` | anon `#/audit`、`#/identity?tab=roles` | 同族（401 风暴 + `access.ts` 端点清单） |
| `R-OBS-ANON-2-86496824.md` | anon `#/approvals?tab=pending&view=mine`、`#/capabilities?tab=models` | **同源**（approvals 读口复用、并发候选） |
| `R-OBS-2-7de87bc0.md` | auth/anon `#/access`、占位 id 详情、`channels` | **同源复用 R-OBS-2**（本件 access/channels 与其端点集逐枚相同） |
| `R-OBS-6c4f3385.md` | access / work / retention / knowledge?tab=sources | 同族（compat 别名轮替 + `/agent-api/` 401） |
| `R-OBS-03cd4658.md` | access / channels / evidence / work | **同源**（本件 access、channels、retrieval 均在其端点集内） |
| `R-OBS-f4bd0505.md` | access / `?zone=config` | **同源**（access 逐字同构；policy 与 approvals 同族） |

**结论：本件四条路由 = ENV（`/auth/` 与 `/agent-api/` 的 401/404；有效态下残留 404 = 上游未接线读口），产品码证据连续第十件为零；同源复用 R-OBS-2。** 新增信息两条：① `channels.ts:8-43` 是一张写明「REAL upstream route / NOT registered by the console BFF / 不用示例行顶替」的产品侧端点真值表，可直接作为该 obs 的结案依据；② `#/approvals?tab=policy` 与 `#/knowledge?tab=retrieval` 都是 `compat-tab` 别名（`routes.ts:254` / `:246`+`:344`），台账按 hash 记键造成「载体路由逐代漂移」的错觉，实际是同一批未接线读口轮替出名。

## 7. 建议（不改码）

1. `ENV_NOISE_RE` 扩识别 `net::ERR_*`、403 与裸状态码，并把 `pageerror` 与 console 行分列计数，避免 §4.5 这类「不可复现的 product 行」。
2. 台账逐路由落 `consoleErrorSample`（源码 :420-422 已有该字段，未落盘），归因件就不必声明「无字节级原文」。
3. auth 面把 `authStateFile` 换成有效态或显式记 `stale-state`，并把 base 统一到现网 8183。
4. `compat-tab` / `compat-module` 别名在台账里先归一到真实路由（`to` 字段已有），obs 列表就不会每代换名字。
5. `access.ts` / `channels.ts` / `knowledge.ts` 三张候选清单在首成就止（或把「未注册」直接判为预期态不写 console），匿名态 4–8 连击的噪声量级可以显著下降。

## 8. 复现产物

目录 `/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/`：`o8ff2-anon.out`（18564B）/ `o8ff2-auth.out`（15711B）/ `o8ff-anon.out`（9380B）/ `o8ff-auth.out`（7946B）/ `o8ff-9122-anon.out` / `o8ff-9122-auth.out` / `storm9122.out`（上一件产物，本件未复用其读数），同名 `.err` 全为 0 字节，所有运行 rc=0。
