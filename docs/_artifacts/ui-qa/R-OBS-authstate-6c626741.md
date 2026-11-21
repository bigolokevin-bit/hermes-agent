# R-OBS-authstate-6c626741 — 先验登录态文件是否过期，再谈归因（只读）

取证时间：2026-11-21 13:47—13:49（北京时间）
现场：`http://100.117.184.117:8183`（**现网**，非 127.0.0.1:9122）
工作树：`lane/console-ui-qa` @ `ff0cca2b`（`aa180f86` 之后的代次未并入：`git fetch` 在本轮多次 420s/600s 超时，见 §6.1）
纪律：全程只读，未改产品码 / 未改九件台账 / 未重启服务 / 未发群消息 / 任何凭据值都不落本文与回执。

---

## 0. 结论（先说答案）

**派单的前提假设不成立：`~/.local/state/sekoi-ops/ui-qa-auth-state.json` 没有过期，不需要重登。**

1. **文件有效**：mtime `2026-11-21 06:00:43`；唯一 cookie `access_token_cookie` 的 `expires` = `1795298443` = `2026-11-22 06:00:43`，JWT payload `exp` 同值（`iss=bisheng`、`user_name=opsadmin`、`token_version=3`）。取证时刻剩余 **58389 秒 ≈ 16.2 小时** → `expired=False`。
2. **带该 state 走现网三条点名路由的实测**（两视口各一遍，共 6 次采样）：
   - `#/access` → 恒 **4 行**，状态码**全是 404**（不是 401/403）；
   - `#/capabilities?tab=channels` → 恒 **4 行**，同样**全是 404**；
   - `#/approvals?tab=policy` → **0 行**，该路由在有效登录态下**根本不产生任何 console error**。
3. **所以残留的 obs 与登录态无关**：那 8 条 404 的 URL 逐字就是 4 枚 `/agent-api/api/v1/{user/list,user/all,role/list,roles}` + 4 枚 `/agent-api/api/{mcp/servers,gateway-connections,datasources,connectors}` —— 即 **console BFF 未注册的读口**。换一份更新鲜的登录态，这 8 条一条都不会少；而 `#/approvals?tab=policy` 归零正好反证「不是 cookie 的问题」。归因维持 **上游/BFF 未接线读口**（与 `R-OBS-2`、`R-OBS-7cb41601.md`、`R-OBS-aa180f86.md`、`R-OBS-8ff6d30d.md` 完全同源，见 §5）。
4. **`ceAuthority=login-state` 这个标签会误导决策**：它是 shots 脚本的固定文案（登录态口径声明），不是「本轮这 N 条由登录态导致」的判定。本轮实测证明：auth 面残留条目的实际状态码是 404（未接线），而登录态导致的条目应当是 401 —— **看状态码就能一眼区分这两种成因**。
5. **若 D 侧仍在 `#/approvals?tab=policy` 看到报错，那说明它实际用的还是旧文件**：本树盘上的台账 `authStateFile` 仍写 `~/.local/state/sekoi-ops/v4-auth-state.json`（该文件 mtime `2026-11-19 19:12:48`，已过期），并没有指向 `ui-qa-auth-state.json`。改法是**把 `--auth-state=` 指到 ui-qa 那份**（命令见 §4.1），而不是重登。

---

## 1. 登录态文件本体（原文读数）

```
$ ls -lT ~/.local/state/sekoi-ops/ui-qa-auth-state.json ~/.local/state/sekoi-ops/v4-auth-state.json
-rw-------@ 1 kevin_studio  staff  513 Nov 21 06:00:43 2026 ui-qa-auth-state.json
-rw-r--r--@ 1 kevin_studio  staff  431 Nov 19 19:12:48 2026 v4-auth-state.json
--- now epoch: 1795240053 / 2026-11-21 13:47:33
```

```
$ python3 - <<'PY'   # 读 cookies[].expires 与 JWT payload exp（只打印元数据，不打印 cookie 值）
keys ['cookies', 'origins']
cookie name=access_token_cookie domain=100.117.184.117 path=/ expires=1795298443 \
  -> expired=False remain_s=58389 (16.2h) as=2026-11-22 06:00:43
    JWT payload={'sub': '{"user_id": 1, "user_name": "opsadmin", "tenant_id": 1, "token_version": 3}',
                 'exp': 1795298443, 'iss': 'bisheng'} \
       exp_as=2026-11-22 06:00:43 expired=False remain_s=58389
origins []
PY
```

判读：`expires` 与 JWT `exp` **一致**（同一份 cookie 同时受两处约束，任一处过期都会表现为 401）；`origins` 为空 → 该 state 只注 cookie，不带 localStorage 令牌，与门户登录腿的产物形态一致。

对照 `v4-auth-state.json`（台账当前实际用的那份）：`exp=1795173121` = `2026-11-20 19:12`，**已过期约 18.6 小时** → 台账里 auth 面长期「与 anon 同形、并出现 reload 风暴」的既有结论继续成立（见 `R-OBS-7cb41601.md` §6）。

## 1.1 台账侧原文（说明派单描述与本树快照的差）

```
$ python3 -c 'import json; ...'      # docs/_artifacts/tonight/
shots-summary.json       | headHash 7cb41601 | base http://127.0.0.1:9122 | mode auth |
  authStateFile /Users/kevin_studio/.local/state/sekoi-ops/v4-auth-state.json |
  obs 1 | routes ['#/access'] | envOnly 51 | entry assets/index-CBaod-sX.js | ceAuthority login-state
shots-anon-summary.json  | headHash 7cb41601 | base http://127.0.0.1:9122 | mode anon |
  authStateFile None | obs 1 | routes ['#/system'] | envOnly 51 | entry assets/index-CBaod-sX.js
```

- 派单说「D 换用 `ui-qa-auth-state.json` 后仍报 3 条」，但**本树盘上的 stamp 仍是 v4 那份**（`authStateFile` 字段逐字可查）→ 要么新 stamp 尚未进本树（代次未 merge，§6.1），要么 `--auth-state=` 实参没改。
- 派单报的 obs 组合（auth 1 = `#/access`、anon 1 = `#/system`）与 `R-OBS-7cb41601.md` §1 记录逐字一致；而 `#/approvals?tab=policy`、`#/capabilities?tab=channels` 在盘上这代**不在 obs 集内**（它们进了 env-only 桶：`routesWithEnvOnlyConsoleErrors=51`）。

---

## 2. 复现命令（原文）

```bash
cd /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode
R='#/access||#/approvals?tab=policy||#/capabilities?tab=channels'
MODE=auth REPS=1 ROUTES="$R" node obs-6632f340.mjs > sauth-state.out 2> sauth-state.err
```

（`obs-6632f340.mjs` = 历件同款：env `ROUTES`（`||` 分隔）/`MODE`/`GATED`/`REPS`/`BASE`（默认现网 8183）/`STATE`；`MODE=auth` 时以 `storageState` 注入 `~/.local/state/sekoi-ops/ui-qa-auth-state.json`，`BASE+'/'+route` 整页 goto；两视口 1440×900、375×812，每组合全新 context，采集 `console` error 原文+`location`、`pageerror` 堆栈、`requestfailed`、≥400 响应，并按 `shots.mjs:255` 的 `ENV_NOISE_RE` 分 product/env。）

rc=0，`sauth-state.out` 11709 B，`sauth-state.err` 0 B。

---

## 3. 逐条 console 原文 + URL + HTTP 状态

### 3.1 `#/access`（auth 面，有效登录态）

首行原文（两视口同句，仅先后不同）：

```
[1] Failed to load resource: the server responded with a status of 404 (Not Found)
      @ http://100.117.184.117:8183/agent-api/api/v1/role/list?page=1&limit=200:0:0
```

四条 404 的 URL（`~~` 聚合，×2 视口）：

```
~~ x1 404 /agent-api/api/v1/user/list
~~ x1 404 /agent-api/api/v1/user/all
~~ x1 404 /agent-api/api/v1/role/list?page=1&limit=200
~~ x1 404 /agent-api/api/v1/roles?page=1&limit=200
```

SUMMARY：`auth|#/access samples=2 linesPerRun=[4,4] navsPerRun=[4,4] productLinesTotal=0 mainChars=[194] texts=["8x …404 (Not Found)"] productTexts=[]`
落地 `…/identity?tab=roles`（`routes.ts:266` compat-module）；页面 `ac3-gap`「未接入 角色与权限待核实：上游角色接口尚未接入本控制台」。**无 `/auth/whoami` 的 401** → 登录态被网关接受。

### 3.2 `#/approvals?tab=policy`（auth 面，有效登录态）

```
auth|#/approvals?tab=policy samples=2 linesPerRun=[0,0] navsPerRun=[4,4]
  productLinesTotal=0 mainChars=[950] texts=[] productTexts=[] urls=[]
```

**零 console error**（main 950 = 待处理列表正常渲染）。该路由是 `#/approvals` 的 compat-tab（`routes.ts:254`），读口 `api.ts:22 LIST_PATH` + `:27 PAGE_LIMIT=50` 在有效态是 200。

### 3.3 `#/capabilities?tab=channels`（auth 面，有效登录态）

```
~~ x1 404 /agent-api/api/mcp/servers?limit=50
~~ x1 404 /agent-api/api/gateway-connections?limit=50
~~ x1 404 /agent-api/api/datasources?limit=50
~~ x1 404 /agent-api/api/connectors?limit=50
auth|#/capabilities?tab=channels samples=2 linesPerRun=[4,4] productLinesTotal=0 mainChars=[1017]
  texts=["8x …404 (Not Found)"] productTexts=[]
```

产品侧自证：`web/src/modules/channels/channels.ts:8-43` 端点真值表写明这些路由「REAL upstream route … NOT registered by the console BFF」→ 未注册即 404，屏幕显「未接入」，不用示例行顶替。

### 3.4 交叉核对（三条一致）

- `grep -c '    ## \|    !! ' sauth-state.out` = **0** → 无 `pageerror`、无堆栈、无 `requestfailed`。
- 三面 `productLinesTotal` 全 **0**：所有 8 条都命中 `ENV_NOISE_RE=/\b(401|404)\s*\((Unauthorized|Not Found)\)/` → 按台账口径属 env，不会计入 obs。**这一点单独说明**：`#/access` 与 channels 的 404 之所以「台账不记为 obs 但仍出现在逐路由 err 计数」，就是这个口径。
- 本轮 served entry（现网）= `assets/index-DpeCEJrd.js`，与台账 `index-CBaod-sX.js` 不同代 → §6.2。

---

## 4. 是否需要重登 · 登录腿口径

### 4.1 结论：**不需要重登**（当前可直接复用，剩余约 16.2 小时，到期时刻 2026-11-22 06:00:43）

要做的是**把台账/巡检的登录态实参指对**，而不是换票：

```bash
# 现网 shots 用有效的那份 state（auth 面）
node docs/_artifacts/tonight/shots.mjs --base=http://100.117.184.117:8183 \
  --auth-state="$HOME/.local/state/sekoi-ops/ui-qa-auth-state.json"
# 匿名面：不传 --auth-state（脚本会注 __HERMES_AUTH_REQUIRED__ 门旗标，:258-259/:279-280）
```

口径建议写进台账元数据：`authStateFile` 已是**指针**（`:469-470` `mode: AUTH_STATE?'auth':'anon'` / `authStateFile: AUTH_STATE`），因此**只需改命令行**即可销掉「auth≈anon」这一长期混淆源。

### 4.2 到期后的重登流程（届时用；本文与回执一律不含口令）

1. 先跑 §1 的同款 `expires`/JWT `exp` 检查 —— **只要 `expired=False` 就不必重登**（本轮正是这种情况，重登会白费一次 RSA 码）。
2. 真过期时：走既有 **opsadmin 登录腿**（node 取 RSA 一次性码 + RSA 登录 + 落 Playwright storageState），产物**覆写到同一路径** `~/.local/state/sekoi-ops/ui-qa-auth-state.json`（`chmod 600`，保持 `authStateFile` 指针不变）。凭据只在该腿的私有输入里出现，**不得**写进仓库、台账、报告或回执。
3. 重登后立即复跑 §2 三条：`#/approvals?tab=policy` 应保持 **0 行**；若出现 **401**，才是登录态问题；若仍是 **404**，仍是未接线读口（与本件同一结论，不要归因给 cookie）。

---

## 5. 与前几份是否同源：**同源复用 R-OBS-2**

| 前件 | 关系 | 依据 |
|---|---|---|
| `R-OBS-2-7de87bc0.md` | **同源（直接复用）** | 同一组 4 枚 `/agent-api/api/v1/{user/list,user/all,role/list,roles}` 404 + `routes.ts:266` compat-module + `ac3-gap` 合规未接入态 |
| `R-OBS-7cb41601.md` | 同源 | 其 `#/access` auth 面 4×404 / anon 5×401 与本文 §3.1 逐字一致；该件已点名「台账 auth 用过期 v4 态」 |
| `R-OBS-aa180f86.md` | 同源 | 其 `tab=policy`「有效态 0 行 / 匿名 2 行 401」与本文 §3.2 一致 |
| `R-OBS-8ff6d30d.md` | 同源 | 其 channels 四枚 404 与本文 §3.3 逐字一致（`channels.ts:8-43` 真值表） |
| `R-OBS-515f115b.md` | 互补 | 该件讲未注册 hash 由 `App.tsx:269/:279` 回落 `/overview`；本文两条都是已注册路由，不走回落 |
| 更早 11 件（audit / identity / capabilities / knowledge / work / employees 各族） | 同族同因 | 全部落在 `/auth/` + `/agent-api/**` 的 401（缺登录态）或 404（未接线）两类；产品码证据 18 轮恒零（`git grep -c 'console\.error' -- web/src` = 0） |

**本件新增的信息量**（前 17 件都没单独钉住的变量）：把「登录态文件是否过期」这一条**实测剔除**，因此 auth 面残留 obs 的根因**确定**是上游/BFF 未接线读口，而不是 `ceAuthority=login-state` 字面暗示的登录态。

---

## 6. 取证边界

1. **代次未落地**：本轮 `git fetch origin 'refs/heads/lane/*:refs/remotes/origin/lane/*'` 两次分别 420s/600s 超时（exit 143，无输出），故 `aa180f86` 之后（含派单提到的 `6c626741`）的台账与代码**未并入本树**；本文所有台账读数取自盘上 `ff0cca2b` 那一代（headHash `7cb41601`）。若新代 stamp 真改成了 `authStateFile=…ui-qa-auth-state.json`，§1.1 的差述以新代为准，本文其余实测（直接打现网 8183）不受影响。
2. **代次第五次漂移**：现网 served entry 现为 `index-DpeCEJrd.js`；台账 `index-CBaod-sX.js`；本会话历件还见过 `AUJDWHSD`/`bXNYODp-`/`CUhV51_R`/`OCLu6KCF`。
3. 台账 `base` 仍是 `http://127.0.0.1:9122`，与派单要求「非 127.0.0.1」不一致；本文实测全部打现网 8183。
4. `shots-summary.json` **无 `consoleErrorSample` 键**（该字段只在 `:420-422` 的逐路由 JSON），故无台账侧字节级原文可引；本文原文全部来自我自己的采集。
5. `ENV_NOISE_RE` 只识 401/404 两种 reason-phrase 且先 `slice(0,160)` 再判 → 400/403/5xx/`net::ERR_*`/瞬时 pageerror 会被计成 product；本文 8 条都是标准 404 文案，不落在漏判面。
6. 本文**未重跑** `#/approvals?tab=release`、`#/work`、`#/system`（前件读数仍在盘上文档中，按代次通用引用）。
7. 派单要求「禁改九件台账」已遵守：本轮对 `docs/_artifacts/tonight/` 只读；工作区唯一非我改动 ` M docs/_artifacts/ui-qa/R-OBS-03cd4658.md`（并行腿 251→174 行）持续不 add/不 commit/不 revert，待拍板。

---

## 7. 建议（全部不改码）

1. 台账 auth 面实参改指 `ui-qa-auth-state.json`，并在 stamp 里保留 `authStateFile` 指针 —— 一次性消除「auth≈anon」与 reload 风暴两类噪声（§4.1）。
2. 在归因口径里**按状态码分列**：`401 → 鉴权/登录态`，`404 → 上游未接线`；`ceAuthority` 改名或加注（它现在是固定文案，容易被读成因果判定）。
3. 登录态文件加**到期前置检查**（§1 那条 `expires`/`exp` 判定，5 行 Python 即可），在 16 小时窗口内不要重登；重登只走既有 opsadmin RSA 登录腿，凭据不进任何产物。
4. `ENV_NOISE_RE` 扩识别 `net::ERR_*`/403/400，并把 `pageerror` 与 `console` 计数分列（历件重复建议，仍未落地）。
5. 台账 `base` 统一现网 8183 或分栏标注 9122/8183 两套代次；台账落逐行原文（JSONL）以消除「无字节级原文」的取证边界。

---

## 8. 复现产物

目录 `/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/`

- `sauth-state.out` 11709 B（本文唯一证据源）/ `sauth-state.err` 0 B
- 历件产物仍在盘：`s8r-auth.out`、`s8r-anon.out`、`o8ff*.out`、`ofbd-*.out`、`s515-*.out`
- 脚本：`obs-6632f340.mjs`（`git show :web/src` 未改，只读采集）
