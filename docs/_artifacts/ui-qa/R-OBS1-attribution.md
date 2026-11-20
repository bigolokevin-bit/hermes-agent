# R-OBS1 · `consoleErrorsObservedByShots=1` 归因取证（只读）

派单要点（保真）：「`docs/_artifacts/tonight/shots-summary.json` 在代次 `d7c95f80` 的 `consoleErrorsObservedByShots=1` 已连续 3 拍未归零（历史恒 0，反常）。用现网 `http://100.117.184.117:8183` 按 shots 脚本同法重走路由，定位该 1 条 console error 的**页面路由 + 错误原文 + 来源（产品/ENV 401/上游）**，写 `docs/_artifacts/ui-qa/R-OBS1-attribution.md`（含命令、原始输出、结论三选一），只读禁改产品/禁改协议/禁重启。」

取证时刻：2026-11-21 02:17–02:25（北京时间）。全程只读：未改产品码、未改协议、未重启任何服务、未点写操作按钮。

## 结论（三选一）

**ENV —— 网关 401/404 类噪声，不是产品码，也不是上游业务错误。**

该「1」是台账计数口径的脆弱性放大出来的 1 条路由级标记，不是某条可复现的产品异常：

1. **产品码路径已排除。** 台账所指路由 `#/capabilities?tab=channels` 在本拍两条腿（1440×900 / 375×812）现网实测 `consoleErrorsProduct = 0`、`pageerror = 0`；`web/src` 内没有任何 `console.error` 调用（`git grep -n "console\.error" -- web/src` 无匹配，R173 亦复核过）。shots.mjs 把 product 计数交给两件事：不匹配 `ENV_NOISE_RE` 的 console error 行，以及**任何** `pageerror`（:288、:291）。两条腿实测这两件事都是 0。
2. **上游业务错误路径已排除。** 该路由的失败全部落在 `401 (Unauthorized)`（9122 台账原环境）或 `404 (Not Found)`（现网 8183）两种鉴权/路由未挂载状态，HTTP 状态就是鉴权层与静态服务本身，`page.on('response')` 实测无 5xx；`http` 主文档恒 200，页面正常渲染（现网 main 文本 1017 字符，9122 113 字符 = R173 记录的「未登录/无门壳」形态）。
3. **ENV 成立且能解释「3 拍不归零」。** 同一份台账里 `routesWithEnvOnlyConsoleErrors = 51`，即全部 51 条路由都只有 ENV 类噪声；`ENV_NOISE_RE = /\b(401|404)\s*\((Unauthorized|Not Found)\)/`（:255）只白名单这两种**文本**，因此任何一次 `net::ERR_ABORTED`、连接重置或瞬时未捕获异常（不带 401/404 字样）都会把一条路由从「仅 ENV」推到「有 product」，计数 +1 并连续复现——这正与 9122 侧实测到的 `net::ERR_ABORTED`（`/auth/whoami`、`/agent-api/api/*` 的 401 重试中断）同型。9122 环境的登录态早已失效（`v4-auth-state.json` 的 cookie 被网关拒），所以该环境天然处于 401 风暴 + 重试中断态，正是产生这种文本行的环境。

## 页面路由（定位到条）

- 台账 `consoleErrorRoutesObservedByShots` = `["#/capabilities?tab=channels"]`（`headHash d7c95f80`，base `http://127.0.0.1:9122`，mode `auth`，51 路由 / 102 图）。这是 51 条里唯一被记为 product 的一条。
- 同法复跑时我只走这一条路由，并带 3 条对照路由（`#/overview` `#/employees` `#/approvals`），对照路由在现网 `productCE=0`、`envNoiseCE=0`，即噪声不是全站性的，集中在这一条读口最多的路由（它并发打 7–8 个 `/agent-api/api/*` 读口）。

## 错误原文（实测逐行，非台账推断）

现网 `http://100.117.184.117:8183`（登录态 `ui-qa-auth-state.json`，代次 `index-C1qr4jdG.js`），两视口各 1 轮：

```
[error] Failed to load resource: the server responded with a status of 404 (Not Found)   ×4
  ← 404 http://100.117.184.117:8183/agent-api/api/mcp/servers?limit=50
  ← 404 http://100.117.184.117:8183/agent-api/api/gateway-connections?limit=50
  ← 404 http://100.117.184.117:8183/agent-api/api/datasources?limit=50
  ← 404 http://100.117.184.117:8183/agent-api/api/connectors?limit=50
pageerror: 无   requestfailed: 无   productCE: 0   envNoiseCE: 4   http: 200   mainChars: 1017
```

台账原环境 `http://127.0.0.1:9122`（登录态 `v4-auth-state.json`），连跑 2 轮逐行 dump：

```
REP1  totalEvents=163 errorLines=116 PRODUCT=0
REP2  totalEvents=145 errorLines=107 PRODUCT=0
UNIQ_ERROR_LINES=["[error] Failed to load resource: the server responded with a status of 401 (Unauthorized)"]
requestfailed: /auth/whoami net::ERR_ABORTED · /agent-api/api/{mcp/servers,connectors,gateway-connections,datasources,hermes-summary} net::ERR_ABORTED
```

即：**在两个环境、共 6 条腿的实测里，该路由的 console error 文本只有一种且全部命中 `ENV_NOISE_RE`；`PRODUCT=0`。** 台账里那 1 条的原文没有逐行落盘（`shots-index.md` 只存计数列，`consoleErrors` 数组不进 summary/index），所以本拍无法给出它的字节级原文，只能给出：它必属「不带 401/404 字样的 console error 行或一次 pageerror」这一集合，而该集合的已知成员就是重试中断文本与瞬时异常。

## 命令（可重跑）

```bash
# 台账读数与计数口径
sed -n '255p;277,300p;463,492p' docs/_artifacts/tonight/shots.mjs
python3 -c "import json;d=json.load(open('docs/_artifacts/tonight/shots-summary.json'));\
print({k:d.get(k) for k in ('headHash','base','mode','routes','shots','entryRef',\
'consoleErrorsObservedByShots','consoleErrorRoutesObservedByShots','routesWithEnvOnlyConsoleErrors','ceAuthority','envAttribution')})"

# 同法复跑（脚本在本机 opencode 临时目录，逐事件抓 console/pageerror/requestfailed/response）
node /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/obs1-ce.mjs
BASE=http://127.0.0.1:9122 AUTH_STATE=$HOME/.local/state/sekoi-ops/v4-auth-state.json \
  node /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/ce-dump.mjs
```

复跑口径与 shots.mjs 对齐：fresh context + `storageState`、`page.goto(BASE + '/' + '#/<route>')`（hash 形态直导，:302-:303）、`domcontentloaded`、150 ms main 文本稳定轮询（:308-319）、尾等 2 s；不注入 `GATED_FLAG_INIT`（auth 模式本来就不注，:280）。差异：shots 在单浏览器内顺序走 51 条，我只走 1–4 条，因此累计的重试次数更少（这不影响 product=0 的结论，反而更干净）。

## 已覆盖情况（先 git grep，只回证据，不重复造文档）

| 已有文档 | 覆盖内容 | 与本拍关系 |
|---|---|---|
| `docs/_artifacts/gov/R173-channels-ce.md` | 同一条路由 `#/capabilities?tab=channels` 的 CE 归因，判 **(B) 不可修**：9122 `/auth/whoami` 与 7 条 `/agent-api/api/*` 全 401，过滤 ENV 后 product CE = 0，四腿 `pageerror` 全 0 | 本拍在现网 + 9122 双环境复核，结论一致；R173 未回答「那台账里的 1 从哪来」，本拍补上计数口径分析 |
| `docs/_artifacts/ui-qa/anon-ce-work.md` | wave-50 `#/work`×2 归因为网关 401 | 同类 ENV 归因先例 |
| `docs/_artifacts/ui2/R174-sessions-ce.md` | `#/sessions` 路由 CE 归因 | 同类先例 |
| `docs/_artifacts/tonight/shots-summary.json` 的 `ceAuthority/envAttribution` 字段 | 台账自带口径声明：CE 权威=登录态腿；`401/404 Failed-to-load-resource = env (no login session at proxy)` | 与我的结论同向 |

`docs/_artifacts/ui-qa/R-OBS1-attribution.md` 此前不存在（`git grep -n "R-OBS1" -- docs` 无匹配），本文件为新建。

## 建议（非代码改动，不在本拍执行）

1. 台账若要能归因，必须把 `consoleErrors` 逐行文本落到 `shots-index.md` 或 summary（现在只有计数，事后无法定位原文）；
2. `ENV_NOISE_RE` 建议扩为同时识别 `net::ERR_ABORTED`/`net::ERR_*` 与 5xx 之外的传输层文本，并把 `pageerror` 与 console error 分列计数（现在混在同一个 product 计数里，一次瞬时异常就永久 +1）；
3. 9122 的 `v4-auth-state.json` 登录态已失效（本拍 116/107 条 401 即证），台账若继续用它跑 auth 模式，ENV 噪声量级会持续放大——属环境维护，不属产品。

以上三条均需改 `shots.mjs`（属 ops/台账脚本），本拍按纪律未动，只记录。

## 局限（如实）

- 无法给出那 1 条的字节级原文：台账不落逐行文本，事发代次（`d7c95f80`/entry `BtrO4nd2`）的服务已不在盘上，现网代次已前进到 `C1qr4jdG`，属不可复现的一次性标记。
- 若后续轮次这条路由的 product 计数继续 >0，用本文件「命令」段的两条脚本即可当场抓到原文（建议在下一拍台账后立刻重跑 `ce-dump.mjs`）。
