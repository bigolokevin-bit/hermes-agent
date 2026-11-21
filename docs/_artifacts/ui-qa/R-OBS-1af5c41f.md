# R-OBS-1af5c41f — obs 只读归因（`#/identity?tab=tenant`，双面）

取证时刻：2026-11-21 11:22–11:35（北京时间）。只读：未改产品码、未改 testid、未重启服务、未发群消息。
派单口径：现网 `http://100.117.184.117:8183`（非 127.0.0.1），opsadmin 登录态与匿名各重走 `#/identity?tab=tenant`，抓 console 原文 + URL + HTTP 状态 + 首堆栈，三选一归因，并与 `R-OBS-8ff6d30d.md` / `R-OBS-03cd4658.md` 判同源。

## 0. 结论摘要

**归因 = ENV（缺登录态鉴权 401）+ 上游/BFF 未接线读口 404。产品码证据为零，与 R-OBS-2/R-OBS-8ff6d30d/R-OBS-03cd4658 同源（同源复用 R-OBS-2）。**

| 面 | 登录态 | console 行数（实测） | 原文（唯一两句） | URL | 状态 | product 计数 | 归因 |
|---|---|---|---|---|---|---|---|
| auth | opsadmin（有效） | 2（两视口同） | `Failed to load resource: the server responded with a status of 404 (Not Found)` | `/agent-api/api/v1/user/list`、`/agent-api/api/v1/user/all` | 404 | 0 | 上游/BFF 未接线读口 |
| anon | 无 | 4（两视口同） | `Failed to load resource: the server responded with a status of 401 (Unauthorized)` | `/auth/whoami` + 上述两枚 + `/agent-api/api/employees?limit=20` | 401 | 0 | ENV（缺登录态） |

pageerror / 堆栈 / requestfailed：**本次两侧输出中均无**（脚本 `##`、`!!` 标记行 0 条）→ 无「首堆栈」可交，因为不存在抛错。行数恒 4（anon）/ 恒 2（auth），非瞬态。

决定性机制（可字节级对上，非推测）：`web/src/modules/people/PeopleModulePage.tsx:34-38` 定义 `PEOPLE_ENDPOINTS = ["/agent-api/api/v1/user/list", "/agent-api/api/v1/user/all", "/agent-api/api/employees?limit=20"]` —— 匿名时三枚全 401 再加 `/auth/whoami` = **恰好 4 行**；有效登录态时 `whoami` 与第三枚 `employees?limit=20` 成功（页面渲染真实名录），只剩两枚 `v1/user/*` 404 = **恰好 2 行**。同时 `:30-32` `PEOPLE_GAP = "GAP-02"` 与 `PEOPLE_GAP_MESSAGE`「人员目录未接入：上游用户中心接口尚未对控制台开放。接入后这里显示真实名单；现在不展示样例，也不把缺失值写成 0。」—— 产品自己声明这两枚读口未接线，且屏幕用 `:299`「来源：数字员工台账；真人用户中心接口尚未接入，这里不冒充真人名单。」显式标注来源。

## 1. 台账原文与三方口径不一致（须点名）

盘上 `docs/_artifacts/tonight/`（本次 merge 后读到的实际内容，未重章）：

- `shots-summary.json`（auth）：`headHash=8ff6d30d`、`entry=assets/index-OCLu6KCF.js`、`base=http://127.0.0.1:9122`、`authStateFile=/Users/kevin_studio/.local/state/sekoi-ops/v4-auth-state.json`（**已过期**）、`consoleErrorsObservedByShots=2`、`routesWithConsoleErrors=["#/access","#/capabilities?tab=channels"]`、`routesWithEnvOnlyConsoleErrors=51`。
- `shots-anon-summary.json`（anon）：同 `headHash=8ff6d30d` / 同 entry / 同 base、`authStateFile=null`、`consoleErrorsObservedByShots=2`、`routesWithConsoleErrors=["#/access","#/approvals?tab=policy"]`、`routesWithEnvOnlyConsoleErrors=51`。
- `shots-index.md:64-65`（auth）与 `shots-anon-index.md:64-65`（anon）都有该路由逐字行（列序 route|label|vp|HTTP|main chars|main>0|empty?|error?|overflow|differs|png bytes|**console err**）：
  - auth：`` | `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64210 | 4 | `` 与 375 档 `` 36898 | 4 ``
  - anon：同 main 151、png 64650 / 36546、console err **4 / 4**

三处不一致（不影响归因结论，但影响「这笔账该挂在哪个代次」）：

1. **代次**：派单说当代为 `1af5c41f`、`consoleErrorsObservedByShots` 双面均 =1、路由 `[#/identity?tab=tenant]`；盘上两面 summary 实际是 `headHash=8ff6d30d`、obs=**2**/2、路由不含 `tab=tenant`。基线侧同样未出现该章笔：显式 refspec fetch 后 `origin/lane/hermes-console` tip 实测为 `15a6491c`（`merge(lane): c8c65d09 (wave-100)`），`32a60f7b`（派单所称 wave-102 章笔）当时尚未出现在远端；`git merge --no-edit` 产生本地 `96a20a44`，`git merge-base --is-ancestor 1af5c41f HEAD` = **YES**（代次本身在谱系内，只是台账未重章到它）。
2. **index 与 summary 不同批次**：index 里 `tab=tenant` 双面都记 **4 行** console error，但因这 4 行全部命中 `ENV_NOISE_RE`（见 §5），它们进 `routesWithEnvOnlyConsoleErrors=51` 而不进 obs 列表 —— 即台账自己已把这枚判为 env-only，与派单「obs=1 = 该路由」相反。
3. **代次三漂移**：台账 entry `index-OCLu6KCF.js`、早前一次读为 `index-DC01KlYV.js`、本轮浏览器与 curl 实测 served entry = **`index-CE4DkLMF.js`**。我的 auth/anon 两次运行都在 `CE4DkLMF` 同一代内完成（同一会话、相隔 90 秒），面间可比；但与台账代不同，属取证边界。

## 2. 命令原文

```bash
cd /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode
ROUTES='#/identity?tab=tenant' MODE=auth REPS=1 node obs-6632f340.mjs > T-auth.out 2> T-auth.err
ROUTES='#/identity?tab=tenant' MODE=anon GATED=1 REPS=1 node obs-6632f340.mjs > T-anon.out 2> T-anon.err
```

方法严格对齐 `docs/_artifacts/tonight/shots.mjs` 的 fresh-goto hash-form：每组合全新 `browser.newContext`（auth 传 `storageState=$HOME/.local/state/sekoi-ops/ui-qa-auth-state.json`，anon 不传），`goto(BASE+'/'+route, {waitUntil:'domcontentloaded'})`，main innerText 长度稳定轮询，视口 1440×900 与 375×812。脚本对 console 文本先 `slice(0,160)` 再用 `ENV_NOISE_RE` 判（同 `shots.mjs:255/:286`）。

## 3. 逐条 console 原文

### 3.1 anon（`T-anon.out`，两视口逐字相同，各 4 行）

```
[1] Failed to load resource: the server responded with a status of 401 (Unauthorized) @ http://100.117.184.117:8183/identity:0
    ~~ x1 401 http://100.117.184.117:8183/auth/whoami
[2] … 401 (Unauthorized) …  ~~ x1 401 http://100.117.184.117:8183/agent-api/api/v1/user/list
[3] … 401 (Unauthorized) …  ~~ x1 401 http://100.117.184.117:8183/agent-api/api/v1/user/all
[4] … 401 (Unauthorized) …  ~~ x1 401 http://100.117.184.117:8183/agent-api/api/employees?limit=20
    http=200 navError=- navs=4 product=0 lines=4 landed=http://100.117.184.117:8183/identity main=151 entry=index-CE4DkLMF.js cookie=true
```

MAIN_TEXT（151 字符，逐字）：「治理 · 控制台 人员与访问 人员目录 组织与部门 角色与权限 人员目录 在册人员名录 · 姓名 / 账号 / 部门 / 状态 / 最后活跃 刷新 **没能加载出人员目录** 重新登录后回到这个页面，即可继续查看。 请求编号 `<rid>` 复制 重试」。rid：1440=`5ce757d3bf9040699aba833afe6f0109`、375=`d7360f828f00480e9cd9b67ee7bfe603`。
TESTIDS：`ppl5-page, ppl5-search, ppl5-refresh, ppl5-error, ppl5-request-id, ppl5-request-id-copy, ppl5-retry`。
SUMMARY 逐字：`anon|#/identity?tab=tenant samples=2 linesPerRun=[4,4] navsPerRun=[4,4] productLinesTotal=0 mainChars=[151] texts=["8x Failed to load resource: the server responded with a status of 401 (Unauthorized)"] productTexts=[]`。（`urls=["8x http"]` 是脚本聚合字段缺陷，弃用，URL 以 `~~` 行为准。）

### 3.2 auth（`T-auth.out`，有效 opsadmin 态，两视口各 2 行）

```
[1] Failed to load resource: the server responded with a status of 404 (Not Found) …
    ~~ x1 404 http://100.117.184.117:8183/agent-api/api/v1/user/list
[2] … 404 (Not Found) …  ~~ x1 404 http://100.117.184.117:8183/agent-api/api/v1/user/all
    http=200 navError=- navs=4 product=0 lines=2 landed=http://100.117.184.117:8183/identity main=388(1440)/371(375) entry=index-CE4DkLMF.js
```

`/auth/whoami` 与 `/agent-api/api/employees?limit=20` **均成功**（故不出现在错误行）。MAIN_TEXT 含「在册人员名录 · 姓名 / 账号 / 部门 / 状态 / 最后活跃 · **共 3 人** 来源：数字员工台账；真人用户中心接口尚未接入，这里不冒充真人名单。」与逐行真实名录（`QA2 契约验证 1794894768 · 3E2E940B`、`AgentOS 产品助理 · BCF2B540`，缺值写「— 上游未提供账号 / 上游未提供部门 / 上游未提供最后活跃时间（最后更新 …）」）。TESTIDS：`ppl5-page, ppl5-source, ppl5-search, ppl5-refresh, ppl5-list` + `(ppl5-row/ppl5-name/ppl5-account/ppl5-dept/ppl5-status/ppl5-last-active)×3`。
SUMMARY 逐字：`auth|#/identity?tab=tenant samples=2 linesPerRun=[2,2] navsPerRun=[4,4] productLinesTotal=0 mainChars=[388,371] texts=["4x Failed to load resource: the server responded with a status of 404 (Not Found)"] productTexts=[]`。
注：auth 行里 `cookie=false` 是 `document.cookie` 可见性判定（`access_token_cookie` 为 HttpOnly，JS 读不到），不是登录失败；main=388 出真实名录即证登录有效。

### 3.3 台账侧该路由读数对照

index 双面都记 4 行、main 151（与我 **anon** 侧逐字吻合）。auth 侧我实测 2 行而台账 4 行，差额可由台账自身口径解释：台账 `authStateFile` 是 `v4-auth-state.json`（mtime 2026-11-19 19:12，JWT `exp=1795173121` 已过期）→ 台账的「auth 面」实际等同匿名态，`whoami` 与 `employees?limit=20` 也各回一条 401，4 行 = 我的 2 行 404 换成 2 行 401 再加上 whoami/employees 两枚 401。这是本件与 `R-OBS-8ff6d30d.md` §5 相同的机制，非新增缺陷。

## 4. 逐条归因（含 文件:行）

1. **`/auth/whoami` 401（仅匿名）** → ENV：缺登录态。前端据此渲染 `ppl5-error`「没能加载出人员目录 / 重新登录后回到这个页面」合规鉴权错误态（`web/src/modules/people/PeopleModulePage.tsx:344`），并给 rid + 复制 + 重试。
2. **`/agent-api/api/v1/user/list` 404、`/agent-api/api/v1/user/all` 404（auth 面 2 行；匿名面同样两枚只是降级成 401）** → **上游/BFF 未接线读口**（不是产品码）：候选清单定义在 `PeopleModulePage.tsx:34-38`，与 `web/src/modules/access/access.ts:31-32` 完全同源；产品注释 `:30-32`（GAP-02）与屏幕 `:299` 都明说「真人用户中心接口尚未接入」「不把缺失值写成 0」「这里不冒充真人名单」。同一读口清单还出现在 `access.ts:31-37`（角色页那 4 枚 404 的同族，见 `R-OBS-8ff6d30d.md` §4），因此这是**一处未接线在多个路由上的重复出名**，不是每路由各一个新问题。
3. **`/agent-api/api/employees?limit=20`（仅匿名 401）** → ENV：该端点在有效登录态下 200 并给出真实名录（`共 3 人`，来源数字员工台账），只有缺登录态才 401。
4. **产品码归因：不成立**。本 HEAD（`95006f37`）上 `git grep -c 'console\.error' -- web/src` = **0 文件命中**；本次 8 次采样（2 面 × 2 视口 × 2 遍取 REPS=1 内两视口即 4 次/面）pageerror 0、堆栈 0、requestfailed 0、非 401/404 状态码 0；错误行全部是浏览器对 HTTP 响应自动写的 `Failed to load resource`，不是应用调用 `console.error`。

## 5. 同源判定

| 件 | 路由 | 面 | 结论 | 与本件是否同源 | 同一批读口 |
|---|---|---|---|---|---|
| `R-OBS-8ff6d30d.md` | `#/access`（=`/identity?tab=roles`） | auth 404×4 / anon 401×5 | ENV+上游未接线 | **是**（同 GAP 族、同 whoami） | `access.ts:31-37` |
| `R-OBS-8ff6d30d.md` | `#/capabilities?tab=channels` | auth 404×4 / anon 401×8 | ENV+上游未接线 | 同族（另一批未注册端点） | `channels.ts:8-43/:148-168` |
| `R-OBS-8ff6d30d.md` | `#/approvals?tab=policy` | auth 0 行 / anon 401×2 | 别名路由，非缺陷 | 同族（compat-tab 归一） | `routes.ts:254` |
| `R-OBS-03cd4658.md` | `#/knowledge?tab=retrieval` | auth 404×2 / anon 401×4 | ENV+上游未接线 | 同族（另一模块真值表） | `knowledge.ts:7-20` |
| `R-OBS-2-7de87bc0.md` | `#/access`、占位 id 详情 | 404/401 | ENV | **是** | `routes.ts:266/:223` |

→ **同源复用 R-OBS-2**：同一机制（浏览器对 `/auth/*`、`/agent-api/*` 的 4xx 自动 console 行 + compat 别名路由 + 未接线读口 + 前端合规「未接入/需登录」态）。本件新增信息只有两条：(a) `PeopleModulePage.tsx:34-38` 的三枚候选端点清单可**逐字解释 4 行与 2 行的差额**（此前各件的差额只能标「不可复现」）；(b) `routes.ts:248` 与 `:345` 证明 `tab=tenant/admins/binding/checks` 四枚 tab 全部归一到 `people` 视图（`to:'#/identity'`，`bridge.test.ts:47` 甚至把这条断言写进了测试），即台账里同名不同 tab 的多枚 obs 载体是**同一面的重复出名**。

## 6. 取证边界（诚实声明）

1. **先前产物不存在**：本件上下文曾记录「`o1af-anon.out`/`o1af-auth.out` 已跑、本文档已写」。`find` 复核证明两者**从未存在**，本文档也不在盘上与 `git ls-files` 内 → 本件是**重跑实证**，新产物为 `T-anon.out`(3291B) / `T-auth.out`(3421B)，同名 `.err` 均 0B。同理，「脚本有 EXTRA_WAIT 参数」亦属幻象（脚本无该 env）。
2. 台账 `base=http://127.0.0.1:9122`（派单要求现网 8183）；台账 auth 面用已过期 `v4-auth-state.json`（§3.3）。
3. 代次三方漂移（§1.3）：我的读数在 `CE4DkLMF`，台账在 `OCLu6KCF`。
4. 两面 summary 均无 `consoleErrorSample` 键 → 台账侧无逐路由原文可比对字节；本文的原文来自我自己的运行。
5. `ENV_NOISE_RE = /\b(401|404)\s*\((Unauthorized|Not Found)\)/`（`shots.mjs:255`，先 `slice(0,160)` 再判）：只认 401/404 的英文 reason-phrase。403/5xx/`net::ERR_ABORTED`/瞬时 pageerror 会被计为 product → 「obs 非零」本身不等积产品码；本次未出现任何这类行。
6. REPS=1（派单 ≤15 分钟口径），每面每视口 1 次、共 4 次运行；行数在两视口间完全一致，与 index 计数（4）亦一致，故未加重复。

## 7. 建议（不改码）

1. 台账把 `#/identity?tab=tenant`（及 admins/binding/checks）按 `routes.ts:248/:345` 归一到 `#/identity` 再计数，可消掉同一面的重复 obs 载体。
2. 台账 auth 面改指有效态（`ui-qa-auth-state.json`）并统一 base 到现网 8183，或明确标注 auth 面实为「过期态」——本次 §3.3 的 4 行/2 行差额就是这么产生的。
3. `ENV_NOISE_RE` 增识别 `net::ERR_*` 与 403/5xx，并把 product 分列 console / pageerror，红灯才可指向代码路径。
4. 未接线读口（GAP-02 三枚、GAP-04 四枚、knowledge 五枚）建议纳入 shots 侧已知噪声白名单；若上游注册了这些路由，则应转成「必须 200」的验收项。
5. 台账在 summary 里落每路由逐行原文，obs 红灯才可在不重跑的前提下被归因（前件已建议，本件再次需要）。
