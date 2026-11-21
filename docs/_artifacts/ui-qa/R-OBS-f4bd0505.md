# R-OBS-f4bd0505 — 当代（headHash `f4bd0505`）双面 obs 只读归因

取证时间：2026-11-21 10:4x（北京时间）。工作树：`lane/console-ui-qa`，基线 `0f125bd6`（= `origin/lane/hermes-console` tip `068833bc` 的并入合并）。
方式：**只读**。未改任何产品码 / testid，未重启服务，未发群消息。

## 0. 结论摘要

派单口径：auth obs=2（`#/access`、`#/employees/:employeeId?zone=config`）、anon obs=1（`#/access`）。
去重后唯一路由 2 条，两面各重走，**8 次采样，product console error 恒 0，`pageerror` 0，`requestfailed` 0，无 `net::ERR_ABORTED`、无 reload 风暴、无非 401/404 状态码**。

逐条三选一（ENV / 产品 / 上游）= **两条路由、两面全部 ENV**：全部 console 原文都是 `Failed to load resource: … 401 (Unauthorized)` 或 `404 (Not Found)`，URL 全部属 `/auth/*` 与 `/agent-api/api/*`；有效 opsadmin 登录态下残留的 404 是**上游未接线读口**（页面自身走 `ac3-gap` / `ed5-overview-notfound` 合规态），匿名态则是网关鉴权层 401。

## 1. 台账原文（`docs/_artifacts/tonight/`）

`shots-summary.json`（auth 面）关键字段：`headHash=f4bd0505`、`base=http://127.0.0.1:9122`、`mode=auth`、`authStateFile=/Users/kevin_studio/.local/state/sekoi-ops/v4-auth-state.json`、`entry=assets/index-CU42UJPm.js`（`servedEntryBefore/After` 同值）、`entryBytes=172175`、`entrySha256=4091450088012896197537528507068219745031690568876253916437700935`、`routesEnumerated=51`、`expectedShots=102`、`producedShots=102`、`failures=[]`、`consoleErrorsObservedByShots=2`、`consoleErrorRoutesObservedByShots=["#/access","#/employees/:employeeId?zone=config"]`、`routesWithConsoleErrors` 同上、`routesWithEnvOnlyConsoleErrors=50`、`ceAuthority=login-state`、`overflowing=[]`、`ok=true`、`exitCode=0`、`auxiliary=true`。

`shots-anon-summary.json`（anon 面）：同 `headHash=f4bd0505`、同 `base`、同 `entry`、`authStateFile=null`、`consoleErrorsObservedByShots=1`、`consoleErrorRoutesObservedByShots=["#/access"]`、`routesWithEnvOnlyConsoleErrors=51`、`ok=true`、`exitCode=0`。

`shots-index.md`（auth 面）逐字行（列序 `route | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err`）：

```
| `#/access` | 角色与权限 | 1440 | 200 | 199 | yes | - | - | 0 | yes | 63181 | 10 |
| `#/access` | 角色与权限 | 375 | 200 | 201 | yes | - | - | 0 | yes | 45006 | 5 |
| `#/employees/:employeeId?zone=config` | 员工档案 | 1440 | 200 | 42 | yes | - | yes | 0 | yes | 50174 | 3 |
| `#/employees/:employeeId?zone=config` | 员工档案 | 375 | 200 | 42 | yes | - | yes | 0 | yes | 20013 | 2 |
```

`shots-anon-index.md`（anon 面）逐字行：

```
| `#/access` | 角色与权限 | 1440 | 200 | 199 | yes | - | - | 0 | yes | 63240 | 11 |
| `#/access` | 角色与权限 | 375 | 200 | 199 | yes | - | - | 0 | yes | 45785 | 5 |
```

## 2. 复现命令（原文，全部 rc=0、stderr 为空）

```bash
cd /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode
ROUTES='#/access||#/employees/:employeeId?zone=config' MODE=auth REPS=1 \
  node obs-6632f340.mjs > ofbd-auth.out 2> ofbd-auth.err
ROUTES='#/access||#/employees/:employeeId?zone=config' MODE=anon GATED=1 REPS=1 \
  node obs-6632f340.mjs > ofbd-anon.out 2> ofbd-anon.err
```

脚本 `obs-6632f340.mjs` 与 `docs/_artifacts/tonight/shots.mjs` 同口径：每 (route, viewport) 全新 context；`goto(BASE + '/' + route, {waitUntil:'domcontentloaded'})`；main innerText 长度稳定轮询；`console` 事件原文先 `slice(0,160)` 再用 `ENV_NOISE_RE = /\b(401|404)\s*\((Unauthorized|Not Found)\)/`（:255）判定；`pageerror` 一律记 product；`MODE=auth` 用 `~/.local/state/sekoi-ops/ui-qa-auth-state.json`（现网有效登录态），`MODE=anon` 完全不传 storageState。`BASE` 默认 `http://100.117.184.117:8183`。

## 3. 逐条 console 原文（现网 8183，两视口 1440x900 / 375x812）

### 3.1 auth 面（有效 opsadmin 登录态）

`#/access`（两视口同构，`http=200 navs=4 product=0 lines=4 landed=/identity?tab=roles main=194 entry=index-OCLu6KCF.js`）：

```
Failed to load resource: the server responded with a status of 404 (Not Found)  @ http://100.117.184.117:8183/agent-api/api/v1/user/list:0
Failed to load resource: the server responded with a status of 404 (Not Found)  @ http://100.117.184.117:8183/agent-api/api/v1/user/all:0
Failed to load resource: the server responded with a status of 404 (Not Found)  @ http://100.117.184.117:8183/agent-api/api/v1/role/list?page=1&limit=200:0
Failed to load resource: the server responded with a status of 404 (Not Found)  @ http://100.117.184.117:8183/agent-api/api/v1/roles?page=1&limit=200:0
```

页面正文（main 194）含「角色与权限待核实：上游角色接口尚未接入本控制台」，testid `ac3-page,ac3-tab-roles,ac3-tab-members,ac3-tab-admins,ac3-gap` → 合规「未接入」态，不是崩溃态。

`#/employees/:employeeId?zone=config`（两视口同构，`lines=1 product=0 main=130 landed=/employees/:employeeId/config`）：

```
Failed to load resource: the server responded with a status of 404 (Not Found)  @ http://100.117.184.117:8183/agent-api/api/employees/%3AemployeeId:0
```

正文（main 130）「员工不存在或无权查看。 请求编号： … 返回员工列表」，testid `ed5-overview-notfound` → 前端 fallback 态。

### 3.2 anon 面（不带任何登录态）

`#/access`（两视口 `lines=5 product=0 main=201 landed=/identity?tab=roles cookie=true`），全部 `401 (Unauthorized)`，来源 = 上述四枚 v1 端点 + `/auth/whoami`。正文 testid `ac3-request-id`，文案「重新登录后回到这个页面，即可继续查看」+ 32 位请求编号。

`#/employees/:employeeId?zone=config`（两视口 `lines=3 product=0 main=146 landed=/employees/:employeeId/config`），全部 `401 (Unauthorized)`，来源 `/auth/whoami` + `/agent-api/api/employees/%3AemployeeId` + `/agent-api/api/matrix?employee=%3AemployeeId`。正文 testid `ed5-overview-error`，文案「员工档案没能加载出来 重新登录后回到这个页面，即可继续查看」+ 请求编号。

### 3.3 交叉核对

```
SUMMARY（auth）  productLinesTotal=0 × 2 路由；texts 唯一一句 404；无 ## 堆栈行、无 !! 中断行
SUMMARY（anon）  productLinesTotal=0 × 2 路由；texts 唯一一句 401；同上
```

`navsPerRun` 恒 [4,4] → 无 reload 死循环（与 6632f340 代 channels 那格 4840 行的风暴形态明显不同）。

## 4. 逐路由三选一归因（含源码定位）

| 路由 | 面 | 原文首行 | 状态 | URL | 归因 |
|---|---|---|---|---|---|
| `#/access` | auth | `…404 (Not Found)` | 404 ×4 | `/agent-api/api/v1/{user/list,user/all,role/list,roles}` | **ENV（上游未接线读口）** |
| `#/access` | anon | `…401 (Unauthorized)` | 401 ×5 | 上述四枚 + `/auth/whoami` | **ENV（网关鉴权 401）** |
| `…?zone=config` | auth | `…404 (Not Found)` | 404 ×1 | `/agent-api/api/employees/%3AemployeeId` | **ENV + 占位 id 本就无实体** |
| `…?zone=config` | anon | `…401 (Unauthorized)` | 401 ×3 | `/auth/whoami` + `employees/%3AemployeeId` + `matrix?employee=%3AemployeeId` | **ENV（网关鉴权 401）** |

源码侧证据（用于排除「产品」选项）：

1. `git grep -n 'console\.error' -- web/src` = **0 命中**（HEAD `0f125bd6` 现场核，非沿用）。本区间（`fefa2a07..0f125bd6`）web/src 非测试改动只有 `modules/metrics/MetricsModulePage.tsx`、`modules/skills/SkillsPage.tsx`、`modules/tools/ToolsPage.tsx` 三处，与这两条路由无关。
2. `web/src/modules/access/access.ts:31-37`：`PEOPLE_ENDPOINTS=['/agent-api/api/v1/user/list','/agent-api/api/v1/user/all']`、`ROLE_ENDPOINTS=['/agent-api/api/v1/role/list?page=1&limit=200','/agent-api/api/v1/roles?page=1&limit=200']` —— 两组各两枚候选**一次加载全部尝试**，所以匿名态天然 4 连击 + `whoami` = 5 行；404 来自上游 v1 路由未接入，页面按 `ac3-gap`（`web/src/modules/access/AccessModulePage.tsx:237`）显式声明「上游角色接口尚未接入」。
3. `web/src/shell/routes.ts:266`：`#/access` = `#/identity?tab=roles` 的 `compat-module` 别名（`kind:'compat-module'`、`visible:false`、`to:'#/identity?tab=roles'`）→ 台账以 `#/access` 记键，现网实际落地 `/identity?tab=roles`。这与上一代红灯载体记作 `#/identity?tab=roles` 是**同一页面**，不是新故障面。
4. `web/src/modules/employee-detail/EmployeeDetailModulePage.tsx:1219`（`/agent-api/api/employees/${encodeURIComponent(empId)}`）、`:1011`/`:1248`（`/agent-api/api/matrix?employee=`）：`shots.mjs` **不做参数替换**（`git grep -n employeeId -- docs/_artifacts/tonight/shots.mjs` 无命中），因此请求里带字面量 `%3AemployeeId`，本就指向不存在的员工 → 有效态 404 → `ed5-overview-notfound`；匿名态网关先行 401 → `ed5-overview-error`。**属台账导航形态缺陷，非产品缺陷。**

## 5. auth 面与 anon 面的关系（为什么两条面同源）

台账 auth 面用的 `authStateFile` 是 `~/.local/state/sekoi-ops/v4-auth-state.json`（mtime 2026-11-19 19:12，JWT `exp=1795173121`，取证时已过期 ≈14 小时）。过期态在网关侧等价于「无登录态」，故台账 auth 面 `#/access` 的 10 行里必然混有 401，而我用**有效** opsadmin 态跑同一路由只剩 4 行纯 404（读口未接线）—— 这正是本代 auth 面 obs 的机制：**obs 非零不表示产品回归，而是失效登录态把 ENV 401 灌进 auth 面**。台账 `ceAuthority=login-state` 与 `envAttribution=401/404 … env (no login session at proxy)` 已自我声明这一点。

台账 auth 面 `#/access` 1440 记 10 行、anon 记 11 行，均高于我的单次采样（4 / 5）：台账每路由跑多遍且叠加过期态重试，行数不可与单次采样直接对减；两面 obs 判定（`consoleErrorsObservedByShots` 按「有 product 行的路由条数」计）与我复现的 **product=0** 之间的差额，机制上只可能来自不含 `401 (…)/404 (…)` 字样的瞬时行（重试中断 / `net::ERR_ABORTED`）或一次瞬时 `pageerror` —— 我在 8 次采样里一条都没观测到，故按不可复现项登记（见 §7）。

## 6. 同源判定

| 参照件 | 代次 | 本件相关性 | 判定 |
|---|---|---|---|
| `R-OBS-2-7de87bc0.md` | 7de87bc0 | 同样点名 `#/access` 与 `#/employees/:employeeId?zone=*`，端点清单、404/401 语义、`ed5-overview-*` 前端态逐字相同 | **同源复用 R-OBS-2** |
| `R-OBS-03cd4658.md` | 03cd4658 | 其 `?zone=evidence` 与本件 `?zone=config` 行集同构（占位 id + 同一员工读口），`#/access` 完全一致 | 同源 |
| `R-OBS-6c4f3385.md` | 6c4f3385 | anon 面 `#/access` 5 行清单一致 | 同源 |
| `R-OBS1-attribution.md` / `R-OBS1-43d83d65.md` | 更早 | channels 面 401/404 同族（本件未含 channels，代次已收敛） | 同族 |

九件谱系合起来：**红灯载体路由在换代间换名（多为 `routes.ts` 别名同页换名），而产品侧静态证据始终为零**。

## 7. 取证边界（如实声明）

1. **代次不一致**：台账 `entry=assets/index-CU42UJPm.js`（两面 `servedEntryBefore/After` 同值），而现网 curl 实测与我复现读到的 served entry 均为 `index-OCLu6KCF.js` → 本件复现跑在**比台账更新的一代**。
2. **base 不一致**：两面台账 `base=http://127.0.0.1:9122`，派单要求现网 `100.117.184.117:8183`；我按要求只跑现网，未复跑 9122。
3. 台账 `consoleErrorSample` 字段不存在于 summary 与 index（只有计数列）→ 无法给出被计为 product 的那 1 行的字节级原文与堆栈。
4. `ENV_NOISE_RE` 只识别 Chrome 的两种 reason-phrase 文案（`401 (Unauthorized)` / `404 (Not Found)`），**403、5xx、`net::ERR_ABORTED` 一律漏判为 product**。
5. 台账 auth 面用已过期 v4 登录态 → auth 与 anon 在网关侧等价。
6. 派单提到的「`f4bd0505` / `37b6481e` 两代同入口产物」：两面台账 `headHash` 只有 `f4bd0505`，`37b6481e` 未出现在当代台账；派单另提「板旧核销笔 `2051131b` 属更早代，当代不收敛」，属台账核销口径与代次绑定的问题，本件不改核销账。
7. 本件为只读取证：未改产品码 / testid / 统计口径，未重启服务。

## 8. 建议（不改码，供上游决定）

1. `shots.mjs` 的 `ENV_NOISE_RE` 补识别 `net::ERR_*` 与 403/5xx，并把 `pageerror` 与 console 行分列计数，避免瞬时中断被记成 product。
2. 台账逐行落盘 console 原文（`consoleErrorSample` 进 summary 或独立 JSON），否则 obs 非零每次都要外部重跑归因。
3. 台账 auth 面 `authStateFile` 改指向有效登录态（或至少在 summary 里带 cookie `exp` 与取证时刻的差值），消除「auth≈anon」假红灯。
4. 台账 base 统一到现网 8183，或在 summary 里显式区分「本地代理台账」与「现网台账」。
5. 台账 hash 形态路由（`#/access`、`#/employees/:employeeId?zone=config`）建议按 `routes.ts` 别名归一并做参数替换，消除同页换名与占位 id 造成的 obs 漂移。

## 9. 复现产物

`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/`：`ofbd-auth.out`（5789 B）、`ofbd-anon.out`（7107 B），同名 `.err` 均为 0 B。
