# R-OBS-f4bd0505 — 当代 obs 双面只读归因（auth obs=2 / anon obs=1）

取证时间：2026-11-21 11:0x（北京时间）。工作树：`lane/console-ui-qa`，HEAD `0f125bd6`（merge `origin/lane/hermes-console` tip `068833bc` = wave-98）。
派单口径：只读、禁改产品码、禁重启服务、禁发群。现网基址 `http://100.117.184.117:8183`（非 127.0.0.1）。

## 0. 结论摘要

| 路由 | 台账 auth err | 台账 anon err | 我 auth（有效 opsadmin 态） | 我 anon | 归因（三选一） |
|---|---|---|---|---|---|
| `#/access` | 10（1440）/ 5（375） | 11（1440）/ 5（375） | **4 行，全 404**，product=0 | **5 行，全 401**，product=0 | **ENV**（`/agent-api/api/v1/*` 404 = 上游未接线读口；无登录态时同批端点变 401 + `/auth/whoami`）。非产品码。 |
| `#/employees/:employeeId?zone=config` | 3（1440）/ 2（375） | 未列入 anon obs | **1 行，404**，product=0 | **3 行，全 401**，product=0 | **ENV**（URL 属 `/agent-api/`、`/auth/`）。404 源于**占位 id 本就无实体**（字面量 `:employeeId` → `%3AemployeeId`），非产品码。 |
| 合计 | obs=2 / obs=1 | | 8 次采样 product 恒 0 | 8 次采样 product 恒 0 | **ENV；同源复用 R-OBS-2** |

三条 obs 条目（auth 两条 + anon 一条）去重后是两条唯一路由，本次两条全部双面复现。无 pageerror、无 requestfailed、无非 401/404 状态码、无 reload 风暴（`navsPerRun` 恒 `[4,4]`）。

## 1. 台账原文（当代 f4bd0505）

`docs/_artifacts/tonight/shots-summary.json`（auth 面）关键字段：

```
base = http://127.0.0.1:9122
mode = auth
authStateFile = /Users/kevin_studio/.local/state/sekoi-ops/v4-auth-state.json
headHash = f4bd0505
entry / servedEntryBefore / servedEntryAfter = assets/index-CU42UJPm.js
entryBytes = 172175
entrySha256 = 4091450088012896197537528507068219745031690568876253916437700935
routesEnumerated = 51
consoleErrorsObservedByShots = 2
consoleErrorRoutesObservedByShots = ["#/access", "#/employees/:employeeId?zone=config"]
routesWithConsoleErrors = 同上
routesWithEnvOnlyConsoleErrors = 50
ceAuthority = login-state
envAttribution = 401/404 Failed-to-load-resource = env (no login session at proxy); see crawl-routes env=auth-required-401 同口径
overflowing = []
ok = true   exitCode = 0   auxiliary = true
```

`docs/_artifacts/tonight/shots-anon-summary.json`（anon 面）关键字段：

```
base = http://127.0.0.1:9122      mode = anon      authStateFile = null
headHash = f4bd0505               entry / served = assets/index-CU42UJPm.js
consoleErrorsObservedByShots = 1
consoleErrorRoutesObservedByShots = ["#/access"]
routesWithConsoleErrors = ["#/access"]
routesWithEnvOnlyConsoleErrors = 51
ceAuthority = login-state         ok = true   exitCode = 0
```

两面 summary 的键列表里都**没有 `consoleErrorSample`**（该字段只存在于 `docs/_artifacts/tonight/shots.mjs:420-422` 的逐行 JSON，不落 summary）→ 台账侧无法给出字节级原文与堆栈，属取证边界（见 §7）。

`shots-index.md`（auth 面）逐字行，列序 `route | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err`：

```
L10 | `#/access` | 角色与权限 | 1440 | 200 | 199 | yes | - | - | 0 | yes | 63181 | 10 |
L11 | `#/access` | 角色与权限 | 375 | 200 | 201 | yes | - | - | 0 | yes | 45006 | 5 |
L48 | `#/employees/:employeeId?zone=config` | 员工档案 | 1440 | 200 | 42 | yes | - | yes | 0 | yes | 50174 | 3 |
L49 | `#/employees/:employeeId?zone=config` | 员工档案 | 375 | 200 | 42 | yes | - | yes | 0 | yes | 20013 | 2 |
```

`shots-anon-index.md`（anon 面）逐字行：

```
L10 | `#/access` | 角色与权限 | 1440 | 200 | 199 | yes | - | - | 0 | yes | 63240 | 11 |
L11 | `#/access` | 角色与权限 | 375 | 200 | 199 | yes | - | - | 0 | yes | 45785 | 5 |
```

台账计数（auth access 10/5、config 3/2；anon access 11/5）高于我的单次采样计数（4/4、1/1；5/5、3/3），原因是台账按视口逐行累计且 auth 面用的仍是**过期 v4 登录态**（§7）。二者语义一致，不存在「台账看到而我看不到的错误种类」。

## 2. 复现命令原文

脚本 `/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/obs-6632f340.mjs`（严格复刻 `shots.mjs` 匿名/登录路径：每组合全新 context、`slice(0,160)` 后判 `ENV_NOISE_RE`、`navs` 计数侦测 reload 风暴）。

```bash
# 1) auth 面 = 有效 opsadmin 登录态
ROUTES='#/access||#/employees/:employeeId?zone=config' MODE=auth REPS=1 \
  node obs-6632f340.mjs > ofbd-auth.out 2> ofbd-auth.err      # rc=0，5789B，err 0B

# 2) anon 面 = 不传 storageState + 门旗标（同 shots.mjs:256/:279-280）
ROUTES='#/access||#/employees/:employeeId?zone=config' MODE=anon GATED=1 REPS=1 \
  node obs-6632f340.mjs > ofbd-anon.out 2> ofbd-anon.err      # rc=0，7107B，err 0B
```

两面各 2 路由 × 2 视口（1440×900 / 375×812）= 共 8 次采样。产物在 `/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/`。

## 3. 逐条 console 原文

### 3.1 auth 面（有效 opsadmin 登录态，served entry `index-OCLu6KCF.js`）

`#/access` — 两视口均 `http=200 navs=4 lines=4 product=0 main=194 landed=http://100.117.184.117:8183/identity?tab=roles`。四行原文逐字相同：

```
Failed to load resource: the server responded with a status of 404 (Not Found)
```

来源（1440 档行序）：

```
[1] … @ http://100.117.184.117:8183/agent-api/api/v1/user/list:0:0
[2] … @ http://100.117.184.117:8183/agent-api/api/v1/user/all:0:0
[3] … @ http://100.117.184.117:8183/agent-api/api/v1/role/list?page=1&limit=200:0:0
[4] … @ http://100.117.184.117:8183/agent-api/api/v1/roles?page=1&limit=200:0:0
```

375 档同四枚端点、行序为 `user/list → role/list → user/all → roles`（并发 fetch 竞速，行序不定）。
TESTIDS = `ac3-page, ac3-tab-roles, ac3-tab-members, ac3-tab-admins, ac3-gap`。
MAIN_TEXT（194 字符，逐字）=「治理 · 控制台 人员与访问 人员目录 组织与部门 角色与权限 访问控制 角色、成员与管理员 · 只读 刷新 角色 — 成员 — 管理员 — 未接入 角色与权限待核实：上游角色接口尚未接入本控制台。接入后这里会自动显示真实角色。 去审批中心提交开通申请 权限来源按人话显示；角色或来源缺失时写「—（来源未提供）」，不补 0。 本页只读，不提供授权、撤销或角色编辑入口。 返回组织与人员」。

`#/employees/:employeeId?zone=config` — 两视口均 `http=200 navs=4 lines=1 product=0 main=130 landed=…/employees/:employeeId/config`。唯一一行：

```
Failed to load resource: the server responded with a status of 404 (Not Found)
  @ http://100.117.184.117:8183/agent-api/api/employees/%3AemployeeId:0:0
```

TESTIDS = `ed5-module, edx-back, edz-nav, edz-nav-overview, edz-nav-tasks, edz-nav-runs, edz-nav-approvals, ed5-tabs, ed5-overview-notfound, req-copy`。
MAIN_TEXT 尾段（逐字）=「…员工不存在或无权查看。 请求编号： 45fb52348a1d4b1ba9f4ed99a73a2872 复制 返回员工列表」（375 档同句式，rid `66905a26aef14e569071010de67006ef`）。

### 3.2 anon 面

`#/access` — 两视口均 `lines=5 product=0 main=201 landed=…/identity?tab=roles`。五行原文逐字相同：

```
Failed to load resource: the server responded with a status of 401 (Unauthorized)
```

来源 = `/auth/whoami` + 上述四枚 v1 端点（1440 序：whoami, role/list, user/list, user/all, roles；375 序：whoami, user/list, role/list, roles, user/all）。
TESTIDS = `ac3-page, ac3-tab-roles, ac3-tab-members, ac3-tab-admins, ac3-request-id`；MAIN_TEXT 含「重新登录后回到这个页面，即可继续查看。 请求编号 9c67b1c3eb6d4762b273a2afdeecbce9复制 重试」（375 档 rid `321d4014bb234a3dbf5e102bce534821`）。

`#/employees/:employeeId?zone=config` — 两视口均 `lines=3 product=0 main=146 landed=…/employees/:employeeId/config`。三行全 401，来源：

```
/auth/whoami
/agent-api/api/employees/%3AemployeeId
/agent-api/api/matrix?employee=%3AemployeeId
```

TESTIDS 末段 `ed5-overview-error, req-copy`；MAIN_TEXT 含「员工档案没能加载出来 重新登录后回到这个页面，即可继续查看。 请求编号： 069a9fb3266248c6a30e4abaa48f0caa 复制 重试」（375 档 rid `5e1a26a29fa8413cab5cb22cff23cd33`）。

### 3.3 交叉核对

- pageerror 标记行（`    ## `）：两文件均无命中 → **0 条**。
- requestfailed 标记行（`    !! `）：两文件均无命中 → **0 条**（本次没有 reload 风暴，与上一代 v4 过期态下的 `[100,250] 行 / navs [24,54]` 形成对照）。
- 4xx 聚合（`    ~~ `）：只出现 401 与 404 两种状态，无 403/5xx。
- SUMMARY 逐字：
  `auth|#/access samples=2 linesPerRun=[4,4] navsPerRun=[4,4] productLinesTotal=0 mainChars=[194]`
  `auth|#/employees/:employeeId?zone=config samples=2 linesPerRun=[1,1] navsPerRun=[4,4] productLinesTotal=0 mainChars=[130]`
  `anon|#/access samples=2 linesPerRun=[5,5] navsPerRun=[4,4] productLinesTotal=0 mainChars=[201]`
  `anon|#/employees/:employeeId?zone=config samples=2 linesPerRun=[3,3] navsPerRun=[4,4] productLinesTotal=0 mainChars=[146]`
  四组 `productTexts` 全为 `[]`。

## 4. 逐路由归因（三选一 + 源码定位）

### 4.1 `#/access` → ENV

- 有效登录态：4 条 404，URL 全属 `/agent-api/api/v1/*`；页面渲染的是**合规未接入态**（`ac3-gap`，正文「上游角色接口尚未接入本控制台」），不是崩溃也不是产品抛错。归因 = **ENV/上游未接线读口**。
- 匿名态：同四枚端点变 401，并多出 `/auth/whoami` 一条 → 完全由「缺登录态」决定，与 4.1 第一条是同一组端点的两种表现。
- 源码定位：路由别名 `web/src/shell/routes.ts:266`（`#/access` = `kind:'compat-module'`、`to:'#/identity?tab=roles'`、`visible:false`）；端点清单 `web/src/modules/access/access.ts:30-38`（`PEOPLE_ENDPOINTS = ["/agent-api/api/v1/user/list", "/agent-api/api/v1/user/all"]`、`ROLE_ENDPOINTS = ["/agent-api/api/v1/role/list?page=1&limit=200", "/agent-api/api/v1/roles?page=1&limit=200"]`，两组候选在一次页面加载里全部尝试 → 天然 4 条失败行）。
- **非产品码**：`git grep -n 'console\.error' -- web/src` 命中 0 文件，产品侧不产生任何 `console.error`；本次也无 pageerror。

### 4.2 `#/employees/:employeeId?zone=config` → ENV（且台账导航形态导致必现）

- 有效登录态 1 条 404：`/agent-api/api/employees/%3AemployeeId`。`%3A` 即 `:` —— 台账与本次复现都**按字面量 `:employeeId` 导航**（`shots.mjs` 不做参数替换，本脚本同样不做），因此请求指向一个必然不存在的员工；前端据此渲染 `ed5-overview-notfound`「员工不存在或无权查看」。**该路由本就无实体**，属占位符导航产物，不是产品缺陷。
- 匿名态 3 条 401：`/auth/whoami` + 同一枚 `employees/%3AemployeeId` + `/agent-api/api/matrix?employee=%3AemployeeId`；前端切到 `ed5-overview-error`。
- 源码定位：`web/src/shell/routes.ts:223` 一带 detail-zone 注册；`web/src/modules/employee-detail/EmployeeDetailModulePage.tsx:1219`（`/agent-api/api/employees/${encodeURIComponent(empId)}`）、`:1011`/`:1248`（`/agent-api/api/matrix?employee=${enc}`）。
- 与上一件对照：`zone=config` 与 `zone=evidence` 的行集**逐字同构**（仅请求编号值随运行时变化）→ 同一机制，不同分区。

## 5. auth 面 obs 与 anon 面 obs 的关系

台账 auth 面 `authStateFile` 指向 `/Users/kevin_studio/.local/state/sekoi-ops/v4-auth-state.json`（该态 JWT 已过期，历次取证实测为 401 风暴源）。因此**台账的 auth 面在这一代事实上介于两者之间**：`#/access` 计 10 行（1440）高于我有效态的 4 行、接近我匿名态的 5 行 × 视口累计；`?zone=config` 计 3 行恰与我匿名态的 3 行同值（有效态只有 1 行 404）。
派单要求的「auth 带 opsadmin storageState」我用的是有效态 `~/.local/state/sekoi-ops/ui-qa-auth-state.json`，因此我的 auth 行数是**产品真实登录用户会看到的下限**（只有未接线读口的 404），而台账数字里混有登录态失效带来的 401。两种口径下 product 都为 0，归因不变。

## 6. 同源判定

| 对象 | 本件路由 | 判定 |
|---|---|---|
| `docs/_artifacts/ui-qa/R-OBS-2-7de87bc0.md` | `#/access`、`#/employees/:employeeId?zone=*` | **完全同源**：同四枚 v1 端点、同 `%3AemployeeId` 占位 id 结论、同 `ac3-gap`/`ed5-overview-*` 前端态 → **同源复用 R-OBS-2**，本次原文见 §3。 |
| `docs/_artifacts/ui-qa/R-OBS-03cd4658.md` | `#/access`（auth 4 行 404 / anon 5 行 401）、`?zone=evidence`（1 行 404 / 3 行 401） | 同源，仅把 `evidence` 换成 `config`；行集与状态逐字同构。 |
| `R-OBS-6c4f3385.md`、`R-OBS-ANON-IDENTITY.md`、`R-OBS-ANON-AUDIT.md`、`R-OBS-ANON-2-86496824.md`、`R-OBS1-attribution.md`、`R-OBS1-43d83d65.md` | 同族 | 同族同因：网关鉴权层 401 / 未接线读口 404。obs 载体路由逐代换名（channels → audit → identity?tab=roles → approvals+models → access+evidence → access+config），实为 §6 别名与占位 id 的轮替出名。 |
| 产品码 | — | 连续九件取证，产品侧证据恒零（`console.error` 零命中 + 无 pageerror/堆栈/非 401-404 状态码）。 |

## 7. 取证边界

1. **代次不一致**：台账 entry = `assets/index-CU42UJPm.js`；我 curl 与复现读到的现网 served entry = `assets/index-OCLu6KCF.js`（更新一代）。本次结论按现网新一代成立，对台账那一代的适用性以端点清单与路由别名为准（两代间这些源码位置未变）。
2. **base 不一致**：两面台账 `base = http://127.0.0.1:9122`，派单要求现网 8183。我按派单只跑现网；9122 只作历史旁证，其登录态另有一份（见第 3 条）。
3. **台账 auth 态已过期**：`v4-auth-state.json` 的 JWT 早已过期（历次实测），导致台账 auth 面语义向 anon 塌陷（§5）。
4. **台账不落逐行原文**：summary 无 `consoleErrorSample` 键，index 只有计数列 → 无法给出台账侧字节级原文与堆栈。
5. **计数口径**：`ENV_NOISE_RE = /\b(401|404)\s*\((Unauthorized|Not Found)\)/`（`shots.mjs:255`）且先 `m.text().slice(0,160)` 再判（`:286`）→ 403/5xx、`net::ERR_*`、被截断的长文本都会被计入 product。本代两面 `routesWithEnvOnlyConsoleErrors` 分别 50/51，说明 51 条路由普遍有 ENV 噪声，obs 只取决于哪几条恰好混进一条非 ENV 行。
6. **行序不稳定**：并发 fetch 导致同一批端点的报错次序在视口/采样间漂移；按行计数因而不是稳定量。
7. **占位 id 路由**：`#/:employeeId` 类路由在台账与本次复现里都以字面量导航，其 404 属导航形态产物，不能当作产品缺陷；若要评估该页真实表现需带真实员工 id。
8. **未改动任何东西**：无产品码/testid 改动、无服务重启、无群消息；本次只做浏览器只读采样与 git/文档写入。

## 8. 建议（不改码，供流程决策）

1. 台账 `base` 统一到现网 `8183`，或至少在 summary 里显式标注「本地快照口」，避免与派单口径反复冲突。
2. auth 面换成有效登录态（或在 summary 中把该字段命名改为 `stale-login-state`），否则「auth obs」与「anon obs」不可分辨，obs 会持续逐代换路由。
3. `ENV_NOISE_RE` 扩识别 `net::ERR_*`、403/5xx，并把 product 计数分列 `console` 与 `pageerror` 两类，减少「瞬时行导致红灯搬家」。
4. 逐路由原文落盘（`consoleErrorSample` 进 summary 或旁挂 jsonl），使红灯可在文档中直接归因，而不必每次外部重跑。
5. 对 `:employeeId` 这类参数化路由，台账先做 id 替换再导航；否则该族路由的 obs 永远是占位 id 噪声。

## 9. 复现产物

- `ofbd-auth.out`（5789B）/ `ofbd-auth.err`（0B）
- `ofbd-anon.out`（7107B）/ `ofbd-anon.err`（0B）
- 脚本：`obs-6632f340.mjs`（同目录，`ROUTES` 用 `||` 分隔，env `MODE/REPS/GATED/BASE/STATE/EXTRA_WAIT`）
- 上一代产物（未复用其读数）：`o03-auth.out`、`o03-anon.out`、`o03-v4.out`、`obs6c4f-anon.out`

## 10. 同拍二次复核（addendum，2026-11-21 11:40，本会话补）

本节由 Orchestrator 在同一拍内的第二次复核追加，不改动上文 §0–§9 的任何结论与读数。追加动因：本节之前该文件曾被本会话误覆写为 138 行紧凑版（提交 `95006f37`），已用 `git checkout 4216c88b -- <该文件>` 恢复为原始 207 行完整版，再把仅属于本复核的增量写在下面。教训登记：在共享 worktree 里，`ls` 未见到某文件不等于它不存在（可能由并行腿在几十秒内交付），覆写前必须再查 `git log --oneline -- <文件>`。

1. **派单所称代次未见于当代台账**：本件派单写「f4bd0505 / 37b6481e 两代同入口产物」，并提到「板旧核销笔 `2051131b` 属更早代，当代不收敛」。实测盘上 `docs/_artifacts/tonight/shots-summary.json` 与 `shots-anon-summary.json` 的 `headHash` 只有 `f4bd0505` 一个值，`37b6481e` 与 `2051131b` **均不出现在两面台账任何字段** → 「两代同入口产物」无法从台账证实，本件归因对象按 `f4bd0505` 单代成立。
2. **同源论据补一条（比 §6 更硬的等式）**：本件 `#/employees/:employeeId?zone=config` 的错误行集与 `R-OBS-03cd4658.md` 的 `#/employees/:employeeId?zone=evidence` **逐字同构** —— auth 面同为 1 行 `404 (Not Found)` @ `/agent-api/api/employees/%3AemployeeId`（前端 `ed5-overview-notfound`），anon 面同为 3 行 `401 (Unauthorized)`（`/auth/whoami` + 同一枚 employees + `/agent-api/api/matrix?employee=%3AemployeeId`，前端 `ed5-overview-error`），两面 main 亦分别同为 130 / 146，两件之间只有 `请求编号` 的 rid 值不同。→ 占位 id 详情面（`%3AemployeeId` 本就无实体，`shots.mjs` 与本方脚本都不做参数替换）是**同一处机制在不同 zone 参数上的重复出名**，不是 zone 相关的独立问题。
3. **路由归一建议的具体口径**（§8 建议的细化）：台账以 hash 形态（`#/…?tab=…` / `?zone=…`）为键，而 `web/src/shell/routes.ts` 里这些形态多数是 `compat-tab` / `compat-module` 别名（`routes.ts:266` `#/access`→`/identity?tab=roles`；`:254` `#/approvals?tab=policy`→`#/approvals`；`:257` `#/system?tab=retention`→`?tab=events`；`:248` `#/identity?tab=tenant`→`#/identity`；`:246` `#/knowledge?tab=retrieval`→`tab=evidence`），且详情面的 `:employeeId` 需做参数替换。建议台账先按别名归一并替换参数再计数，obs 列表才不会逐代「漂移」——历次 obs 载体路由变化（channels → audit → identity?tab=roles → approvals?tab=policy → knowledge?tab=retrieval → identity?tab=tenant）实测全是同一批未接线读口与同一批别名的轮替出名。
4. **一处措辞更正**：§9 写脚本支持 env `EXTRA_WAIT`，实际 `obs-6632f340.mjs` 无该参数（只有 `ROUTES/MODE/REPS/GATED/BASE/STATE`），等待逻辑是 main innerText 长度稳定轮询，无固定尾等。不影响任何读数。
