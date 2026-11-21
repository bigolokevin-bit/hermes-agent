# R-OBS-2-7de87bc0 — auth 面与 anon 面 obs 路由逐条归因（只读）

任务：派单「obs 双面归因（只读）」。现网 `http://100.117.184.117:8183`（非 127.0.0.1），auth 面（带 opsadmin storageState）与 anon 面（不带）各重走三条被 shots 记为 obs 的路由，抓 console 原文与首堆栈，逐条三选一归因，并回答占位 id 路由是否本就无实体。
日期：2026-11-21（北京）。施工面：零改动（`git status --porcelain` 除本文件外为空），未重启服务，未改产品码/testid，未发群消息。
取证目录：`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/`（脚本 `obs2-7de87bc0.mjs`，输出 `obs2-anon.out` 19416B / `obs2-auth.out` 14899B，两文件 stderr 均 0 字节，两次运行 rc=0）。

## 0. 结论摘要

| 路由 | 面 | 每轮 console 行 | 唯一文本 | 归因（三选一） |
|---|---|---|---|---|
| `#/access` | auth | 4 | `404 (Not Found)` | **上游/网关：四枚 `/agent-api/api/v1/*` 读口在网关不存在（404），产品侧已按「未接入」缺口态渲染** |
| `#/access` | anon | 5 | `401 (Unauthorized)` | **ENV：上述四枚 + `/auth/whoami` 全部 401（缺登录态）** |
| `#/employees/:employeeId?zone=evidence` | auth | 1 | `404 (Not Found)` | **ENV + 台账参数：`/agent-api/api/employees/%3AemployeeId` 404 —— 字面量占位 id 从未被替换，本就无实体；前端已落 not-found 态** |
| `#/employees/:employeeId?zone=evidence` | anon | 3 | `401 (Unauthorized)` | **ENV：`/auth/whoami` + 档案 + matrix 三枚 401（鉴权先于实体存在判定）** |
| `#/employees/:employeeId?zone=tasks` | auth | 1 | `404 (Not Found)` | 同上 evidence（行集与 evidence 完全相同） |
| `#/employees/:employeeId?zone=tasks` | anon | 3 | `401 (Unauthorized)` | 同上 evidence |

**三面合并判定：产品码 0 条。** 24 次采样（每面 3 路由 × 2 视口 × 2 遍）里 `productLinesTotal` 恒为 **0**，堆栈行（`##`）**0 条**、`requestfailed`（`!!`）**0 条**、`pageerror` **0 条**、非 401/404 状态码 **0 条**；`git grep -c 'console\.error' -- web/src` 在本 HEAD（`466c6bc5`）**零命中**。

**本件最重要的一条**：`#/access` 与上一代红灯载体 `#/identity?tab=roles` **是同一个页面** —— 落地 URL 与组件 testid 两组证据同时成立（见 §3/§5）。所谓「obs 载体路由逐代漂移」在这两代之间不是漂移，而是**同一页在 crawl 清单里换了个名字**。

## 1. 台账原文

`docs/_artifacts/tonight/shots-summary.json`（auth 面，headHash **86496824**，base `http://127.0.0.1:9122`，mode `auth`，`authStateFile="/Users/kevin_studio/.local/state/sekoi-ops/v4-auth-state.json"`）：
```
consoleErrorsObservedByShots: 2
consoleErrorRoutesObservedByShots: ["#/access", "#/employees/:employeeId?zone=evidence"]
routesWithConsoleErrors: ["#/access", "#/employees/:employeeId?zone=evidence"]
routesWithEnvOnlyConsoleErrors: 50
ceAuthority: "login-state"
envAttribution: "401/404 Failed-to-load-resource = env (no login session at proxy); see crawl-routes env=auth-required-401 同口径"
navForm: "fresh-goto hash-form #/<route> (crawl-parity, 二十三轮修复)"
ok: true  exitCode: 0  entry: assets/index-6g0IMx1G.js
```

`docs/_artifacts/tonight/shots-anon-summary.json`（anon 面，headHash **86496824**，base 同上，mode `anon`，`authStateFile: null`）：
```
consoleErrorsObservedByShots: 2
consoleErrorRoutesObservedByShots: ["#/access", "#/employees/:employeeId?zone=tasks"]
routesWithEnvOnlyConsoleErrors: 51
ceAuthority: "login-state"  ok: true  exitCode: 0  entry: assets/index-6g0IMx1G.js
```

逐路由计数（表头 `| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |`）：

`shots-index.md`（auth 面，base 9122）
```
| #/access | 角色与权限 | 1440 | 200 | 201 | yes | - | yes | 0 | yes | … | 10 |
| #/access | 角色与权限 | 375  | 200 | 199 | yes | - | yes | 0 | yes | … |  8 |
| #/employees/:employeeId?zone=evidence | … | 1440 | 200 | 42 | yes | - | yes | 0 | yes | … | 2 |
| #/employees/:employeeId?zone=evidence | … | 375  | 200 | 42 | yes | - | yes | 0 | yes | … | 4 |
| #/employees/:employeeId?zone=tasks    | … | 1440 | 200 | 42 | yes | - | yes | 0 | yes | … | 3 |
| #/employees/:employeeId?zone=tasks    | … | 375  | 200 | 42 | yes | - | yes | 0 | yes | … | 1 |
```
`shots-anon-index.md`（anon 面）
```
| #/access | 角色与权限 | 1440 | 200 | 199 | yes | - | yes | 0 | yes | … | 9 |
| #/access | 角色与权限 | 375  | 200 | 201 | yes | - | yes | 0 | yes | … | 5 |
| #/employees/:employeeId?zone=evidence | … | 1440 | 200 | 42 | yes | - | yes | 0 | yes | … | 2 |
| #/employees/:employeeId?zone=evidence | … | 375  | 200 | 42 | yes | - | yes | 0 | yes | … | 3 |
| #/employees/:employeeId?zone=tasks    | … | 1440 | 200 | 37 | yes | - | yes | 0 | yes | … | 7 |
| #/employees/:employeeId?zone=tasks    | … | 375  | 200 | 66 | yes | - | yes | 0 | yes | … | 3 |
```
两面 summary 的键列表里都**没有** `consoleErrorSample`（该字段只存在于 `docs/_artifacts/tonight/shots.mjs:420-422` 的逐行 JSON，不落 summary）→ 台账侧无法给出逐字原文，这是本件的取证边界之一（§7）。

## 2. 复现命令原文

```bash
cd /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode
MODE=anon GATED=1 REPS=2 node obs2-7de87bc0.mjs > obs2-anon.out 2> obs2-anon.err   # rc=0
MODE=auth REPS=2 node obs2-7de87bc0.mjs > obs2-auth.out 2> obs2-auth.err           # rc=0
```
脚本按 `shots.mjs` 匿名/登录两路同法：全新 context（auth 面 `storageState = ~/.local/state/sekoi-ops/ui-qa-auth-state.json`，anon 面完全不传）、`goto(BASE + '/' + route, {waitUntil:'domcontentloaded'})`、main innerText 长度稳定轮询（≤27×150ms）、`m.text().slice(0,160)` 后再用 `ENV_NOISE_RE = /\b(401|404)\s*\((Unauthorized|Not Found)\)/`（`shots.mjs:255`）判 ENV、anon 面注入 `window.__HERMES_AUTH_REQUIRED__ = true`（`shots.mjs:256` 的 `GATED_FLAG_INIT`）、视口 1440×900 与 375×812、每组合全新 context。
核验计数命令与结果：
```bash
grep -c '##' obs2-anon.out obs2-auth.out   # 0 0   （无 pageerror 堆栈）
grep -c '!!' obs2-anon.out obs2-auth.out   # 0 0   （无 requestfailed）
grep -oE 'status of [0-9]+ \([^)]*\)' obs2-anon.out obs2-auth.out | sort | uniq -c
#   47 obs2-anon.out:status of 401 (Unauthorized)
#   27 obs2-auth.out:status of 404 (Not Found)      ← 仅这两种，无第三种状态码
```

## 3. 逐条错误原文（逐字摘自两份 .out）

### 3.1 `#/access` — auth 面（4 行，每轮全同；1440/375 两视口一致）
```
    landed=http://100.117.184.117:8183/identity?tab=roles main=194 body=325 entry=index-BeCxh3sC.js anonCookie=false loginRecovery=false product=0 lines=4
    [1] Failed to load resource: the server responded with a status of 404 (Not Found)   @ http://100.117.184.117:8183/agent-api/api/v1/role/list?page=1&limit=200:0:0
    [2] Failed to load resource: the server responded with a status of 404 (Not Found)   @ http://100.117.184.117:8183/agent-api/api/v1/roles?page=1&limit=200:0:0
    [3] Failed to load resource: the server responded with a status of 404 (Not Found)   @ http://100.117.184.117:8183/agent-api/api/v1/user/list:0:0
    [4] Failed to load resource: the server responded with a status of 404 (Not Found)   @ http://100.117.184.117:8183/agent-api/api/v1/user/all:0:0
```
页面正文与 testid（证明前端已按缺口态处理，不是崩页）：
```
    MAIN_TEXT="治理 · 控制台 人员与访问 人员目录 组织与部门 角色与权限 访问控制 角色、成员与管理员 · 只读 刷新 角色 — 成员 — 管理员 — 未接入 角色与权限待核实：上游角色接口尚未接入本控制台。接入后这里会自动显示真实角色。 去审批中心提交开通申请 …"
    TESTIDS=ac3-page,ac3-tab-roles,ac3-tab-members,ac3-tab-admins,ac3-gap
```

### 3.2 `#/access` — anon 面（5 行 = 上述四枚 + `/auth/whoami`，全 401）
```
    landed=http://100.117.184.117:8183/identity?tab=roles main=201 body=335 entry=index-BeCxh3sC.js anonCookie=true loginRecovery=true product=0 lines=5
    [1] … 401 (Unauthorized)  @ /auth/whoami
    [2] … 401 (Unauthorized)  @ /agent-api/api/v1/user/list
    [3] … 401 (Unauthorized)  @ /agent-api/api/v1/role/list?page=1&limit=200
    [4] … 401 (Unauthorized)  @ /agent-api/api/v1/user/all
    [5] … 401 (Unauthorized)  @ /agent-api/api/v1/roles?page=1&limit=200
    TESTIDS=ac3-page,ac3-tab-roles,ac3-tab-members,ac3-tab-admins,ac3-request-id   （正文含「重新登录后回到这个页面，即可继续查看。」+ 会话过期横幅）
```

### 3.3 `#/employees/:employeeId?zone=evidence` — auth 面（1 行）
```
    landed=http://100.117.184.117:8183/employees/:employeeId/evidence main=130 body=258 entry=index-BeCxh3sC.js anonCookie=false loginRecovery=false product=0 lines=1
    [1] Failed to load resource: the server responded with a status of 404 (Not Found)   @ http://100.117.184.117:8183/agent-api/api/employees/%3AemployeeId:0:0
    MAIN_TEXT="工作台 配置 任务 运行 证据 员工 · EMPLOYEE — 返回 总览 任务 运行 审批 … 员工不存在或无权查看。 请求编号： … 复制 返回员工列表"
    TESTIDS=ed5-module,edx-back,edz-nav,edz-nav-overview,edz-nav-tasks,edz-nav-runs,edz-nav-approvals,ed5-tabs,ed5-overview-notfound,req-copy
```

### 3.4 `#/employees/:employeeId?zone=evidence` — anon 面（3 行）
```
    landed=http://100.117.184.117:8183/employees/:employeeId/evidence main=146 body=276 entry=index-BeCxh3sC.js anonCookie=true loginRecovery=true product=0 lines=3
    [1] … 401 (Unauthorized)  @ /auth/whoami
    [2] … 401 (Unauthorized)  @ /agent-api/api/employees/%3AemployeeId
    [3] … 401 (Unauthorized)  @ /agent-api/api/matrix?employee=%3AemployeeId
    MAIN_TEXT="… 员工档案没能加载出来 重新登录后回到这个页面，即可继续查看。 请求编号： … 复制 重试"
    TESTIDS=…,ed5-overview-error,req-copy
```

### 3.5 `#/employees/:employeeId?zone=tasks` — 两面（行集与 evidence 逐字相同）
auth 面 1 行 = `/agent-api/api/employees/%3AemployeeId` 404 + `ed5-overview-notfound`；anon 面 3 行 = whoami + 档案 + matrix 全 401 + `ed5-overview-error`。
**`zone=evidence` 与 `zone=tasks` 的 console 行完全相同**（请求只到档案层，zone 内容尚未取数）→ 台账把一面挂在 evidence、另一面挂在 tasks，**不是页面差异**，是同一页同一批请求在不同计数下各命中一次。

## 4. 逐条三选一归因

1. `#/access`（auth，4 枚 `/agent-api/api/v1/*` 404）→ **上游/网关**：读口未在网关注册（404 而非 401，说明带登录态也拿不到）。请求清单在 `web/src/modules/access/access.ts:31-37`（`user/list`、`user/all`、`role/list?page=1&limit=200`、`roles?page=1&limit=200`，两组各两枚候选、一次加载全部尝试 → 天然 4 条噪声，放大 2 倍）。前端把它渲染成缺口态：`web/src/modules/access/AccessModulePage.tsx:237` `data-testid="ac3-gap"` + 文案「上游角色接口尚未接入本控制台」。浏览器对失败 fetch 的固有 `Failed to load resource` 日志不是产品 `console.error`。
2. `#/access`（anon，5 枚 401）→ **ENV（缺登录态）**：与 §上一件 `R-OBS-ANON-IDENTITY.md` 完全同一组 URL（该件即本路由的另一名字），归因同。
3. `#/employees/:employeeId?zone=evidence` / `?zone=tasks` → **ENV + 台账参数未替换**：`shots.mjs` 不做参数替换（脚本内 grep `employeeId` 零命中），以字面量 `:employeeId` 直接 goto；`EmployeeDetailModulePage.tsx:1001-1002` 用 `decodeURIComponent(params.employeeId)` 原样取到 `:employeeId`，`:1219` 拼 `/agent-api/api/employees/${encodeURIComponent(empId)}` → 实际请求 `%3AemployeeId`，`:1011`/`:1248` 的 matrix 同理。auth 面拿到 **404**（该 id 无实体），anon 面被网关先挡成 **401**。
4. **产品码：0 条**（三面、两视口、24 次采样，product 恒 0；无 pageerror/无堆栈/无 requestfailed；`web/src` 内零 `console.error`）。

## 5. 占位 id 路由是否本就无实体 —— **是**

- crawl 以 `:employeeId` 字面量访问，URL 里没有真实员工 id，服务端必然取不到实体：auth 面直接 **404**（`/agent-api/api/employees/%3AemployeeId`）。
- 前端**已有正确的 fallback，不是白屏也不是崩页**：auth 面渲染 `ed5-overview-notfound`「员工不存在或无权查看。… 返回员工列表」（`EmployeeDetailModulePage.tsx:1409`），anon 面渲染 `ed5-overview-error`「员工档案没能加载出来 / 重新登录后回到这个页面」+ 会话过期横幅（`loginRecovery=true`）。main 只有 130/146 字符、台账 main 37–66 字符，都说明是「一页壳 + 一条状态」，符合占位 id 的预期形态。
- 结论：这两条 obs 属**台账导航形态缺陷**（未做参数替换）叠加网关鉴权/未接线，不是产品缺陷。若要让 crawl 真正覆盖员工详情，需要给清单补一条真实 id 的样本（例如从 `#/employees` 列表首行取 `emp_…`），这属台账侧改动，本件未做。

## 6. 与 R-OBS1 是否同源 —— 同源，且本件把「漂移」解释掉了

谱系（全部结论 ENV/上游，产品侧证据恒零）：
| 件 | 载体路由 | 面 | 结论 |
|---|---|---|---|
| `R-OBS1-attribution.md`（wave-58） | `#/capabilities?tab=channels` | auth | ENV（网关 404） |
| `R-OBS1-43d83d65.md` | `#/capabilities?tab=channels` | auth | ENV（401/404） |
| `R-OBS-ANON-AUDIT.md` | `#/audit` | anon | ENV（401 风暴） |
| `R-OBS-ANON-IDENTITY.md` | `#/identity?tab=roles` | anon | ENV（401×5） |
| `R-OBS-ANON-2-86496824.md` | `#/approvals?tab=pending&view=mine`、`#/capabilities?tab=models` | anon | ENV（401×2 / 401×4） |
| **本件** | `#/access`、`#/employees/:employeeId?zone=evidence|tasks` | auth + anon | 上游未接线（401/404）+ 台账占位 id |

**同源证据（新）**：`web/src/shell/routes.ts:266` ——
`{ hash: '#/access', path: '/access', module: 'identity', tabId: 'roles', kind: 'compat-module', visible: false, label: '角色与权限', dataSource: '随目标', to: '#/identity?tab=roles' }`
即 `#/access` 是一条**兼容别名行（compat-module、不可见）重定向到 `#/identity?tab=roles`**。实测两侧落地 URL 都是 `/identity?tab=roles`、testid 都是 `ac3-page/ac3-tab-roles/ac3-tab-members/ac3-tab-admins`、正文逐字相同 → 上一件（identity?tab=roles，5 枚 401）与本件（access，anon 5 枚 401 / auth 4 枚 404）就是**同一个页面**。所以「obs 载体路由逐代漂移」在 identity→access 这一步并非漂移，而是 crawl 清单在别名与目标之间换名；真正新增的只有 404（带登录态时四枚 v1 读口在网关不存在），这是**接线状态**的变化，不是代码回归。

## 7. 取证边界

1. **代次三方不一致**：台账 `shots-summary.json`/`shots-anon-summary.json` 的 `headHash` 都是 **86496824**（派单说的是 7de87bc0），`entry` 记 `index-6g0IMx1G.js`；而本件复现时现网 served entry 实测已是 **`index-BeCxh3sC.js`**（更新的构建，12/12 次采样全部如此）。因此我的读数属于「现网当代」，与台账那一代不同代；跨代比较只用于归属判据（URL 与状态码），不用于计数比对。
2. **台账环境不是派单要求的环境**：两面 `base` 都是 `http://127.0.0.1:9122`（派单明确「非 127.0.0.1」）。auth 面还使用 `authStateFile=v4-auth-state.json`，该登录态此前已实测失效（401 风暴）→ **台账的 "auth 面" 实质是失效登录态**，每轮 8–10 行 401，与我在现网用有效 opsadmin 态测到的 4 行 404 不可比。这也解释了台账计数普遍高于复现值。
3. `consoleErrorSample` 不落 summary，台账侧无法给出逐字原文；本件的逐字原文来自我自己的复现。
4. `ENV_NOISE_RE` 只识别 Chrome 的 `401 (Unauthorized)` / `404 (Not Found)` 两种 reason-phrase：**403/500 与任何 `net::ERR_*`、以及被 `slice(0,160)` 截掉状态码的长文本都会漏判为 product**；`pageerror` 一律计 product。这是台账「obs>0」而 product 侧静态证据始终为零的机制通道。
5. 台账里比复现多出的行（access 1440=10 与 375=8；evidence 375=4；tasks 1440=7）在我 12 次/面采样中恒不出现，最可能是上述漏判通道或 9122 侧的 401 风暴（见边界 2），非产品码。
6. 本件是 console 归因，不是评审打分；分数与画面判定见 `review-0058.md`（六腿全持锚，全站 46.3/100）。

## 8. 建议（只读，不改码）

1. `shots.mjs` 把 `ENV_NOISE_RE` 扩到 `403/500` 与 `net::ERR_*`，并把 console 行与 `pageerror` **分列计数**，避免「一条瞬时网络中断 = 全站红灯」。
2. anon/auth 台账落**逐行原文**（现在只有 summary 计数），否则每代都要人肉复跑一次归因。
3. 台账 `base` 统一到现网 8183，auth 面换用有效登录态（`ui-qa-auth-state.json`），或在台账里显式记「v4-auth-state 已失效」——目前 auth 面的 obs 数字实际测的是失效态。
4. crawl 对 `:employeeId` 类路由做一次参数替换（从列表页取真实 id），否则详情页永远只测到 not-found 态。
5. `access.ts` 的两组各两枚候选端点可在首成就止（现在一次加载打满 4 条），`#/access` 与 `#/identity?tab=roles` 在 crawl 清单里去重（别名行不再单独计数），可直接消掉「同一页两枚红灯」。

---
原始输出全文：`obs2-anon.out`（19416B）、`obs2-auth.out`（14899B），取证目录见文件头。
