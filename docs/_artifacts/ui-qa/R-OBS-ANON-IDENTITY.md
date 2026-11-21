# R-OBS-ANON-IDENTITY — anon 面 `#/identity?tab=roles` console error 归因

- 拍次：UI-QA2 · 代次 `51956391`（wave-81）· 取数时刻 2026-11-21 08:06（北京时间）
- 范围：**只读取证**。未改产品码、未改 testid、未改统计口径、未重启服务。
- 结论（三选一）：**ENV — 网关鉴权层 401（缺登录态）噪声，非产品码、非上游业务错。**

## 1. 台账说了什么

`docs/_artifacts/tonight/shots-anon-summary.json`（逐字段原文）：

```json
{"script": null, "base": "http://127.0.0.1:9122", "mode": "anon", "authStateFile": null,
 "headHash": "c1063feb", "entry": "assets/index-6g0IMx1G.js", "entryBytes": 172175,
 "entrySha256": "4407188fca95d1468ac3d2344108398303ac5d824c4c1f9c620f57fdc11d686b",
 "routesEnumerated": 51, "consoleErrorsObservedByShots": 1,
 "consoleErrorRoutesObservedByShots": ["#/identity?tab=roles"],
 "routesWithConsoleErrors": ["#/identity?tab=roles"],
 "routesWithEnvOnlyConsoleErrors": 51, "ceAuthority": "login-state",
 "envAttribution": "401/404 Failed-to-load-resource = env (no login session at proxy); see crawl-routes env=auth-required-401 同口径",
 "ok": true, "exitCode": 0}
```

`docs/_artifacts/tonight/shots-anon-index.md` 表头与相关行（逐字）：

```
| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
| `#/identity` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64517 | 4 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 143 | yes | - | - | 0 | yes | 62390 | 2 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 201 | yes | - | - | 0 | yes | 72067 | 6 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 201 | yes | - | - | 0 | yes | 45008 | 5 |
| `#/access` | 角色与权限 | 1440 | 200 | 201 | yes | - | - | 0 | yes | 71824 | 5 |
```

要点：obs=1 的机制 = **1440 档 6 行、375 档 5 行**，其中恰有 1 行被计数口径判为「非 ENV」。同代次 auth 面 `shots-summary.json` 的 `consoleErrorsObservedByShots=0`（登录态下这批 401 全消失）。上一代的 `#/audit`、`#/capabilities?tab=channels` 已不在本代红灯路由清单里。

计数口径（`docs/_artifacts/tonight/shots.mjs`，本拍只读引用，未改）：

```js
:255  const ENV_NOISE_RE = /\b(401|404)\s*\((Unauthorized|Not Found)\)/;
:256  const GATED_FLAG_INIT = () => { window.__HERMES_AUTH_REQUIRED__ = true; };
:279    const ctx = await browser.newContext({ viewport: {...}, ...(AUTH_STATE ? { storageState: AUTH_STATE } : {}) });
:280    if (!AUTH_STATE) await ctx.addInitScript(GATED_FLAG_INIT);
:286        const msg = m.text().slice(0, 160);
:288        if (!ENV_NOISE_RE.test(msg)) consoleErrorsProduct += 1;
:291    page.on('pageerror', (e) => { consoleErrors.push(...); consoleErrorsProduct += 1; });
:303      const res = await page.goto(`${BASE}/${h}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
:311        while (Date.now() - t0 < 4000) { ... main innerText 长度稳定即 break ... }
```

## 2. 复现命令（同口径，只读）

```bash
cd $TMPDIR/opencode   # /private/var/folders/2b/.../T/opencode
# 严格复刻 shots.mjs anon 路径：每组合全新 context、不传 storageState、注入 gated 旗标、
# slice(0,160) 后再判 ENV_NOISE_RE、main 文本稳定轮询 ≤4000ms
BASE=http://100.117.184.117:8183 REPS=3 GATED=1 node anon-identity-ledger.mjs > anon-identity-gated.out
BASE=http://100.117.184.117:8183 REPS=1 GATED=0 node anon-identity-ledger.mjs > anon-identity-nogate.out
BASE=http://127.0.0.1:9122      REPS=2 GATED=1 node anon-identity-ledger.mjs > anon-identity-9122.out
node anon-identity-text.mjs > anon-identity-text.out        # 页面正文/testid 逐字
node identity-ce-hunt.mjs                                   # 定向猎捕「第 6 行」：24 次运行
```

路由集 = `#/identity?tab=roles` + 对照 `#/overview`；视口 = 1440×900 与 375×812（同台账 `VIEWPORTS`）。

## 3. 原始输出（逐字）

现网 8183 · gated · 1440 rep1/rep2（`anon-identity-gated.out`）：

```
=== route=#/identity?tab=roles vp=1440x900 rep=1 http=200 gated=1 navError=-
    landed=http://100.117.184.117:8183/identity?tab=roles main=201 body=337 entry=index-6g0IMx1G.js anonCookie=true
    [1] Failed to load resource: the server responded with a status of 401 (Unauthorized)   @ http://100.117.184.117:8183/auth/whoami:0:0
    [2] Failed to load resource: the server responded with a status of 401 (Unauthorized)   @ http://100.117.184.117:8183/agent-api/api/v1/role/list?page=1&limit=200:0:0
    [3] Failed to load resource: the server responded with a status of 401 (Unauthorized)   @ http://100.117.184.117:8183/agent-api/api/v1/user/list:0:0
    [4] Failed to load resource: the server responded with a status of 401 (Unauthorized)   @ http://100.117.184.117:8183/agent-api/api/v1/roles?page=1&limit=200:0:0
    [5] Failed to load resource: the server responded with a status of 401 (Unauthorized)   @ http://100.117.184.117:8183/agent-api/api/v1/user/all:0:0
    ~~ 401 http://100.117.184.117:8183/auth/whoami
    ~~ 401 http://100.117.184.117:8183/agent-api/api/v1/role/list?page=1&limit=200
    ~~ 401 http://100.117.184.117:8183/agent-api/api/v1/user/list
    ~~ 401 http://100.117.184.117:8183/agent-api/api/v1/roles?page=1&limit=200
    ~~ 401 http://100.117.184.117:8183/agent-api/api/v1/user/all
```

rep2 同 5 行，仅到达顺序不同（`user/list` 先于 `role/list`）。三次 1440、三次 375 全部同构。汇总行：

```
# 8183 gated   ：SUMMARY runs=12 lines=96 avgLines=8.00 productLines=0 distinctTexts=1
# 8183 nogate  ：SUMMARY runs=4  lines=32 avgLines=8.00 productLines=0 distinctTexts=1
# 9122 gated   ：SUMMARY runs=8  lines=64 avgLines=8.00 productLines=0 distinctTexts=1
#   x96 / x32 / x64  ENV:Failed to load resource: the server responded with a status of 401 (Unauthorized)
# identity-ce-hunt：runs=24 avgLines=5.00(该路由) productLines=0 distinctTexts=1
```

`avgLines=8.00` = 目标路由 5 行 + 对照 `#/overview` 11 行的均值。`runs=12` 里 `#/identity?tab=roles` 占 6 次，6×5 + 6×11 = 96 ✓。对照路由的 11 条同文本 401（来源 `/auth/whoami` + `/agent-api/api/{run-activity,employee-stats,workbench/queue,employees,workbench/summary,workbench/timeseries,runs×3,tasks}`）→ **401 是全路由匿名态通病，不是本路由特有**。

页面正文逐字（`anon-identity-text.out`，main 201 字符，与台账 `main chars=201` 完全一致）：

```
MAIN[201]="治理 · 控制台 ⏎ 人员与访问 ⏎ 人员目录 ⏎ 组织与部门 ⏎ 角色与权限 ⏎ 访问控制 ⏎ 角色、成员与管理员 · 只读 ⏎ 刷新 ⏎ 角色 ⏎ — ⏎ 成员 ⏎ — ⏎ 管理员 ⏎ — ⏎ 重新登录后回到这个页面，即可继续查看。 ⏎ 请求编号 27df69dd513240adbf7353cba1df703c复制 ⏎ 重试 ⏎  ⏎ 权限来源按人话显示；角色或来源缺失时写「—（来源未提供）」，不补 0。 本页只读，不提供授权、撤销或角色编辑入口。 ⏎  ⏎ 返回组织与人员"
RID32=27df69dd513240adbf7353cba1df703c
TESTIDS=auth5-widget,auth5-goto-login,session-expired-banner,session-expired-relogin,session-expired-dismiss,ac3-page,ac3-tab-roles,ac3-tab-members,ac3-tab-admins,ac3-request-id
HEADINGS=H1:人员与访问 | H1:访问控制
```

即：该页在匿名态是**受控错误态**（会话过期横幅 + 「重新登录后回到这个页面」+ 请求编号 + 重试），没有白屏、没有未捕获异常。

## 4. 归属判定

**ENV（网关/后端鉴权层 401，因无登录态）**，理由四条：

1. 首条来源是 `GET /auth/whoami → 401`，其后 4 条来自本模块读口清单：`web/src/modules/access/access.ts:30-38`
   `PEOPLE_ENDPOINTS=["/agent-api/api/v1/user/list","/agent-api/api/v1/user/all"]`、
   `ROLE_ENDPOINTS=["/agent-api/api/v1/role/list?page=1&limit=200","/agent-api/api/v1/roles?page=1&limit=200"]`
   —— 候选/回退清单一次加载全部尝试，匿名态天然产生 4 条同文本 401（噪声被放大 4 倍）。
2. 56 次匿名采样（8183 gated 12 + 8183 非 gated 4 + 9122 gated 8 + 猎捕 24 + 初探 8）、两视口、两个 base，**捕获到的 console error 文本只有 1 种，全部命中 `ENV_NOISE_RE`**；`pageerror` 恒 0、`requestfailed` 恒空、无非 401 状态码。
3. 产品侧无抛错面：`git grep -n "console\.error" -- web/src` 本 HEAD **0 命中**；`git diff --stat ba76514c..HEAD -- 'web/src/modules/identity*' 'web/src/modules/access*' 'web/src/modules/people*'` **为空**（本区间该模块零改动，与「上一代红灯是 `#/audit`、这一代换成本路由」也不构成回归）。
4. `ceAuthority="login-state"` 与 `envAttribution` 本身已声明该口径；同代次 auth 面 obs=0 与之互证。

台账里那第 6 行（仅 1440 档）：**56 次采样内不可复现**，且从未出现任何非 ENV 文本。按 :286/:288/:291 的口径，能把它计成 product 的机制只有两种——(a) 一次不含 `401 (…)/404 (…)` 字样的瞬时行（重试中断、`net::ERR_*` 类，或长文本被 `slice(0,160)` 截掉状态码后失配），(b) 一次瞬时 `pageerror`。两者都不指向 `web/src` 产品码（第 3 点已排除静态抛错面）。台账不落逐行原文与堆栈（`shots.mjs` :420-422 只为每行记 `consoleErrors` / `consoleErrorsProduct` / `consoleErrorSample`，`-summary.json` 里**没有** `consoleErrorSample` 键，索引表也只给计数列），故**无法给出该行的字节级原文**，这是本次取证的边界。

## 5. 建议（不改码，仅流程）

1. `ENV_NOISE_RE` 只认 Chrome 的两种 reason-phrase；建议补识别 `net::ERR_*` 与「Failed to load resource: the server responded with a status of <code>」裸码形态，并把 product 计数分列 `console` / `pageerror` 两类。
2. `shots.mjs` 已为每行准备 `consoleErrorSample`，建议在 anon 台账里落逐行原文（含来源 URL），否则单条红灯无法离线复核。
3. anon 台账 `base` 是 `http://127.0.0.1:9122`，与本派单要求的现网 `:8183` 不同一环境（本拍两处都跑，读数同构）；建议台账写明 base 或统一到现网。
4. `access.ts` 的端点回退清单在匿名态天然 4 连击，可考虑首个成功/首个 401 后即止（属产品码建议，本拍不动）。

## 6. 与前件的关系

`R-OBS1-attribution.md`（wave-58，`#/capabilities?tab=channels`，auth 面）与 `R-OBS-ANON-AUDIT.md`（anon 面 `#/audit`）结论同为 ENV。三件合起来的稳定事实：**obs 计数红灯的载体路由在换代间漂移（channels → audit → identity?tab=roles），而 product 侧静态证据始终为零**——即漂移本身是瞬时行/竞态的表现，不是回归信号。
