# R173 / R193 — `#/capabilities?tab=channels` console error：判定与归因

采集口径：只贴实测命令的原始输出与屏幕文本；缺值写「—」，不用本机时钟顶替；空结果不当通过。

# R193 判定（收口，本节钉在首段）

**结论 = 选项 (B)：不可修（上游 / ENV）。属 ENV 口径，前端写域内无修法，也不该造一个。**

派工单要的三行证据：

| # | 证据 | 实测值 |
|---|---|---|
| 1 | 首错 URL + HTTP 状态 | `http://127.0.0.1:9122/auth/whoami` → **401 Unauthorized**；状态行字节 `curl -sv … \| sed -n 'l'` → `< HTTP/1.1 401 Unauthorized\r$`。同腿另外七条 `/agent-api/api/*` 读口同样 401。 |
| 2 | 归属 | **BFF / 网关层**，不是上游页、不是前端。9122 由 `lsof -nP -iTCP:9122 -sTCP:LISTEN` → `Python PID 95667` = `/Users/kevin_studio/Projects/l7-ops/ops/v4_proxy.py` 提供；其 `_auth()` 在 :420-426 抛 `auth.unauthenticated`，`/agent-api` 转发层（`V4_BFF_UPSTREAM`，默认 `http://127.0.0.1:8092`）自己回 `console.unauthenticated`。 |
| 3 | 前端写域内无修法 | `git grep -n "console\.error" -- web/src` → **无匹配**（基线 `5af298c1`）；四条腿 `pageerror` 全空；按 `shots.mjs` 自己的 `ENV_NOISE_RE` 过滤后 product CE = **0**。⇒ 任何 `web/src/modules/capabilities/**` 改动都降不了这个数，强行降只能吞错（禁令禁止）。 |

## 判定用的四腿实测（与 R173 同一脚本、同两视口）

命令原文：`node /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/r173/ce-leg.mjs`（脚本未改；常量与 `shots.mjs` 对齐：同一 `ENV_NOISE_RE`、150 ms tick / 4 s 上限的 main 稳定轮询、hash 形导航 `BASE + '/' + '#/capabilities?tab=channels'`、auth 走 storageState 且不注门旗标、anon 注 `window.__HERMES_AUTH_REQUIRED__=true`；加宽的只有 console 文本不截断 + `m.location()` + `pageerror` 前 6 帧）。原始 JSON 落 `…/opencode/r193/before-raw.json`，不入库。

| 腿 | HTTP | 原始 error 行 | product CE | 屏上主文本长度 | 横溢 |
|---|---|---|---|---|---|
| auth @1440 | 200 | 36 | **0** | 113 | 0 |
| auth @375 | 200 | 17 | **0** | 10 | 0 |
| anon @1440 | 200 | 8 | **0** | 200 | 0 |
| anon @375 | 200 | 8 | **0** | 200 | 0 |

八条 401 URL（全部同一句 `Failed to load resource: the server responded with a status of 401 (Unauthorized)`）：`/auth/whoami`、`/agent-api/api/channels?limit=50`、`/agent-api/api/connectors?limit=50`、`/agent-api/api/datasources?limit=50`、`/agent-api/api/gateway-connections?limit=50`、`/agent-api/api/hermes-summary?limit=50`、`/agent-api/api/mcp/servers?limit=50`、`/agent-api/api/messaging/platforms?limit=50`。逐条行数 —— auth @1440：whoami ×9、hermes-summary ×7、datasources ×7、mcp/servers ×7、gateway-connections ×6（=36）；auth @375：whoami ×5、datasources ×4、hermes-summary ×3、mcp/servers ×3、gateway-connections ×2（=17）；anon 两视口每条 URL 各 ×1（=8）。原始行数随重试时序变动，product CE 恒 0。

## 凭据侧实测（值全程不回显，只报名字与长度）

- storageState：恰 1 条 cookie `access_token_cookie`，长度 252，`origins` 为空。
- **带**该 cookie：`/auth/whoami` → 401 `auth.unauthenticated`；`/agent-api/api/channels?limit=50` → 401 `console.unauthenticated`；`/agent-api/api/datasources?limit=50` → 401 `console.unauthenticated`。
- **不带**任何 cookie：三条响应的状态码与错误码与上面逐字相同。
- ⇒ 存档凭据已被鉴权层拒绝（对上游失效）。401 风暴是环境态，与前端行为无关。

## 对照腿：换进程，同一路由一条 401 都没有

9119（`python3.1`，PID 46199，shots 的默认 BASE）对 `/`、`/auth/whoami`、`/agent-api/api/channels?limit=50` 全答 **200 OK** 且不需要 cookie ⇒ 该腿鉴权门是关的（`v4_proxy.py` `_auth()` :289 `if not self._auth_guard(): return`）。CE 数量完全由取证腿打在哪个进程 / 哪种鉴权态决定 —— ENV 轴，不是前端轴。

## 修前 / 修后计数对照

| 腿 | 修前原始行 | 修前 product CE | 修后原始 | 修后 product CE |
|---|---|---|---|---|
| auth @1440 | 36 | 0 | 36（零改动） | 0 |
| auth @375 | 17 | 0 | 17（零改动） | 0 |
| anon @1440 | 8 | 0 | 8（零改动） | 0 |
| anon @375 | 8 | 0 | 8（零改动） | 0 |

两列相等是因为判定为 (B)、零产品改动，不是掩盖。若采纳 29/66 再「修」到某个数字，等于伪造对照。

## 对派工单前提的两句如实回报

1. **29/66 在本代不可复现**：served 产物没换代（入口 chunk 仍是 `assets/index-k52YwKjs.js`，wave-41 合并未重建 9122），同一产物两轮原始行数分别是 R173 的 15/22/8/8 与本轮的 36/17/8/8，差异只来自重试时序，**两轮 product CE 都是 0**。原始行数本身不稳定，就不能当门禁数用。
2. **上一版本文件里有两处前提是错的，以本节为准**（下文对应位置已就地标注〔R193 更正〕）：把 9122 说成「纯静态 python http.server、`/auth/whoami` 不是它的路由所以必返 401」。实测 9122 是 v4 BFF 代理，401 是它的鉴权门拒凭据主动抛出的业务响应，不是「缺路由」。归 ENV 的方向不变，但落点变了 —— 后者的修法是换凭据或关门，两件事都在前端写域之外。

## 仍需别的道接走的活（不在本写域）

- `modules/channels` + shell lazy 边界的 auth @375 settle 缺口：4 s 轮询内主体只有「⠋ Loading…」（10 字符）。内容/时序问题，不是 console error；该路由主体挂 `modules/channels/ChannelsPage`（`App.tsx:179-183` lazy import、`:1225` live slot），频道道写域。
- `ENV_NOISE_RE` 只吞 401/404 不吞 403，且要求状态行带 reason phrase（本轮 `HTTP/1.1 401 Unauthorized` 满足）。改过滤器 = 改统计口径，禁令禁止，只上报 L0。
- 想让这条腿干净：换有效 `access_token_cookie`，或把 9122 的门关掉对齐 9119。两者都在 ops / L0 侧，前端零动作可降。

---

# 附 A — R173 原始归因（正文保留，两处前提由上方判定更正）

## 0. 基线（实测）

- 仓库 `/Users/kevin_studio/Projects/forks/console-gov`，分支 `lane/console-gov`，起始 HEAD `066ed1fa`（R171 交付），`git status --porcelain | wc -l` → 0。
- 显式 refspec fetch（SSH）：
  `git fetch git@github.com:bigolokevin-bit/hermes-agent.git lane/hermes-console:refs/remotes/origin/lane/hermes-console`
  → 上游 tip **恰好 `072f023d`**（派工单点名的 wave-38/39 代次）。
- `git merge --no-ff origin/lane/hermes-console -m "merge(console): sync channels ce baseline"` → 合并提交 **`e4e25155`**。未用 `reset --hard`。
- 写域重叠核对：`git diff --name-only HEAD^1 HEAD -- web/src/modules/capabilities web/src/modules/channels web/src/modules/skills web/src/modules/tools` → **空**（上游这一代没碰本单域）。
- 9122 未被重建（禁令），只读其 served 产物：入口 chunk **`assets/index-k52YwKjs.js`**（另有 `api-xJeQ2AgM.js` / `api-error-NEJXirQc.js` / `i18n-CoEU6K4W.js` / `react-vendor-ClKX88R0.js` / `ui-B6tEaJhS.js` / `utils-ByNlaqvD.js` / `vendor-VY0kBcV-.js` / `index-B-ayPYtL.css`）。这比既有台账 `shots-summary.json` 记的 `index-DGa9lwCA.js`（headHash `1bc3a760`）新一代，即 9122 现服务 wave-38/39 时代产物。

## 1. 结论先行

**在本代 served 产物上，该路由的产品级 console error = 0（auth 与 anon 都是 0）。** 四条腿里出现的每一行 error 都是同一句 401 资源加载失败，按 `shots.mjs` 自己的过滤器归 ENV。没有 `pageerror`，没有 React key / undefined 读取 / 未捕获 promise 的任何字样。

因此本单**没有可修的域内缺陷**，也没有越域缺陷可修（缺陷面若存在，落在 `modules/channels/**`，而实测它没报错）。交付形态 = 归因报告，commit `docs(console): channels tab ce attribution`。修后计数与修前计数相同，因为本轮零改动。

## 2. 派工单前提与实测不符（如实记录，不采纳）

派工单给的是「auth 29 条 / anon 66 条 product CE，全站第二大热点」。三个来源都对不上：

| 来源 | 该路由读数 | 口径 |
|---|---|---|
| 派工单 | auth 29 / anon 66 product CE | 未说明是哪一代、哪个过滤器 |
| 本代实测（下节） | 原始 15+22（auth 两视口）/ 8+8（anon 两视口）；**product 0 / 0** | `shots.mjs` 的 `ENV_NOISE_RE` |
| `crawl-auth.json` / `crawl-anon.json`（headHash `072f023d`，两份字节相同） | `consoleErrors: 8`，`consoleErrorEnv: "auth-required-401"` ⇒ product 0 | crawl 腿的 env 归因 |
| `shots-summary.json` / `shots-anon-summary.json`（headHash `1bc3a760`） | `consoleErrorsObservedByShots: 0`，`consoleErrorRoutesObservedByShots: []`，`routesWithEnvOnlyConsoleErrors: 51`；`shots-index.md` 该路由两行末列 22 / 23 是**原始**行数 | shots 腿 |

29 与 66 在任何「原始/产品 × auth/anon」的组合里都不出现。本报告不把它当事实引用，也不改 `shots.mjs` 的统计口径（禁令）。

一个口径细节必须留档：`ENV_NOISE_RE = /\b(401|404)\s*\((Unauthorized|Not Found)\)/` 只吞 401/404，**不吞 403**。派工单写的「已剔除 401/403/404 env」比脚本自己的过滤器宽。本轮实测里没有出现 403 行，所以不影响结论；但若将来某路由报 403，脚本会把它算成产品 CE。

## 3. 复现命令原文

### 3.1 为什么没有直接跑 `shots.mjs`

`node docs/_artifacts/tonight/shots.mjs` 的 playwright 是按绝对路径从兄弟检出加载的（`PW_HOST = /Users/kevin_studio/Projects/seakoi-console-web/package.json`，1.65.1）；本仓 lock 钉 1.64.0 且该包不在 `node_modules` 里，`require.resolve` 会 MODULE_NOT_FOUND。禁令不允许 install。脚本的 `--out/--summary/--index` 可以重定向以免污染上游仓台账，但它只能给出 `slice(0,160)` 的样本与计数，拿不到完整堆栈——归因需要原文。所以用了同参数的最小腿。

### 3.2 实际跑的腿（read-only，零 install，零写库）

```bash
/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/r173/ce-leg.mjs
# 关键常量与 shots.mjs 对齐：
#   PW_HOST  = /Users/kevin_studio/Projects/seakoi-console-web/package.json  （createRequire 载入，绝对路径）
#   CHROMIUM = ~/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/…
#   BASE     = http://127.0.0.1:9122
#   ROUTE    = #/capabilities?tab=channels        （导航 = BASE + '/' + ROUTE，hash 形）
#   ENV_NOISE_RE = /\b(401|404)\s*\((Unauthorized|Not Found)\)/   （逐字沿用 shots 的过滤器）
#   稳定轮询 = 150 ms tick / 4 s 上限，判据「main 文本稳定且非空」   （逐字沿用 shots 的二十三轮修复）
# 差异只有两处，都是为本单取证加宽：console 文本不截断、附带 m.location() 与 pageerror 的前 6 帧堆栈。
# 四腿 = {auth: storageState=/Users/kevin_studio/.local/state/sekoi-ops/v4-auth-state.json} × {anon: addInitScript window.__HERMES_AUTH_REQUIRED__=true} × {1440×900, 375×812}，每腿一个全新 context。
node /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/r173/ce-leg.mjs > /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/r173/ce-raw.json
```

auth state 文件形态（只报名字与长度，值不回显）：顶层键 `cookies` / `origins`；`cookies` 恰 1 条，name `access_token_cookie`，domain `127.0.0.1`，path `/`，httpOnly=true，value 长度 252；`origins` 为空（无 localStorage）。

### 3.3 归因用的只读检索

```bash
# 该 tab 挂的是哪个模块（结论：modules/channels，不是 capabilities 的占位）
sed -n '179,183p' web/src/App.tsx            # CapChannelsConsolePage = lazy(import("@/modules/channels/ChannelsPage"))
grep -n 'channels:' web/src/App.tsx          # :1225 capabilities live-slot 映射 channels: <CapChannelsConsolePage />
grep -n "tab=channels" web/src/shell/routes.ts   # :181 tabId 'channels' kind 'tab'
grep -n 'console\.\(error\|warn\)' web/src/modules/capabilities   # 无匹配 ⇒ 域内零 console 调用
grep -rn '平台接入与数据源' web/src/modules/channels               # :403 h1 / :413 loading / states.tsx:201 / channels.ts:835-840 / useChannelsData.ts:68
```

## 4. 归因链（error 原文 → 归属）

| # | 观测 | 原文/位置 | 归因 |
|---|---|---|---|
| 1 | 四腿共 53 行 console error，全部同一句 | `Failed to load resource: the server responded with a status of 401 (Unauthorized)` @ `http://127.0.0.1:9122/auth/whoami` | **ENV**，不是产品缺陷。〔R193 更正〕当时以为 9122 是纯静态 python http.server、`/auth/whoami` 不是它的路由所以必返 401；实测 9122 是 v4 BFF 代理（`l7-ops/ops/v4_proxy.py`，PID 95667），401 是它的鉴权门拒凭据主动抛的业务响应 —— 归 ENV 的结论不变，落点变了。`shots.mjs` 的 `ENV_NOISE_RE` 明确把 401(Unauthorized) 当环境噪声。anon 腿还额外带 `window.__HERMES_AUTH_REQUIRED__=true` 的门旗标。 |
| 2 | `pageerror` | 四腿均为空数组 | 无未捕获异常、无 React 渲染错误 |
| 3 | React key / undefined 读取 / 未捕获 promise 字样 | 四腿 console 文本里不出现 | 派工单列的四类根因在本代该路由**一条都没命中** |
| 4 | 屏上主体（auth @1440） | 「平台接入与数据源 / 这里只读平台、渠道与数据源的接入情况，不启用、不测试、不保存任何配置。/ 接入状态 全部 ⠋ 重新读取 / 正在读取平台接入与数据源…」 | 主体来自 `modules/channels/ChannelsPage.tsx`（:403 h1、:413 loading 句）。⇒ 该路由不是 capabilities 的 planned 占位：`ConsolePane` 的 live slot 优先于 `PlannedBlock`（`shell/console.tsx` :345-364），`App.tsx:1225` 给了 `channels` live 节点。 |
| 5 | 屏上主体（anon 两视口） | 「这次读取没有成功 / 接入清单没能加载出来 / 登录状态已经失效，请刷新页面重新登录后再看这份接入清单。/ 请求编号： a5e2…（@1440）、907e…（@375）」 | `modules/channels` 自己的诚实登录失效态，带 rid；无 CE。 |
| 6 | auth @375 主体只有 10 字符「⠋ Loading…」 | 4 s 轮询内 lazy chunk 未 settle | **内容/时序观察，不是 console error**。与既有台账该路由的 `routesWithEmptyMain` / `routesWithoutMainEl` 一致（headHash `1bc3a760` 那代）。落点在 `modules/channels` + shell lazy 边界，两者都在本单禁改面之外。 |

## 5. 前后计数对照

| 腿 | 修前原始 error 行 | 修前 product CE | 修后原始 | 修后 product CE |
|---|---|---|---|---|
| auth @1440 | 15 | 0 | 15（零改动） | 0 |
| auth @375 | 22 | 0 | 22（零改动） | 0 |
| anon @1440 | 8 | 0 | 8（零改动） | 0 |
| anon @375 | 8 | 0 | 8（零改动） | 0 |
| **合计 auth** | 37 | **0** | 37 | **0** |
| **合计 anon** | 16 | **0** | 16 | **0** |

「修后」列等于「修前」列的原因是本单没有改任何产品码——不是掩盖，是无可修项。若采纳派工单的 29/66 并「修」到某个数字，等于伪造对照。

## 6. 交给 L0 / 频道的三件事

1. **29/66 的来源需要澄清**：它不对应本代 served 产物、不对应 `crawl-*.json`（072f023d，product 0）、也不对应 `shots-*-summary.json`（1bc3a760，0 条产品 CE）。可能是把原始行数（含 401 噪声）当产品数，或取自另一代/另一 base（9119 代理腿）。在澄清前，该路由不应继续占「第二大热点」位次。
2. **auth @375 的 settle 缺口是真的**，但它在 `modules/channels` + shell lazy 边界，不在 `modules/capabilities`。若要治，处方是频道道的活（loading 骨架在窄视口 4 s 内没换成主体，或该 tab 的 chunk 拆分/预取）。本单不动它，只登记。
3. **`ENV_NOISE_RE` 不吞 403** 这件事值得 L0 决定是否算口径缺陷：现在 403 会被记成产品 CE。改过滤器属「改统计口径」，禁令禁止，故只上报。

## 7. 未验证与边界

- 未跑 `shots.mjs` 全量 51 路由腿（playwright 缺失 + 禁 install），所以「全站排名」本报告不提供。
- 〔R193 更正〕当时未在真实登录网关（9119 代理）上复测，并把 9122 当纯静态腿说「`/auth/whoami` 恒 401」。本轮已做两侧对照：9122 = v4 BFF 代理且门开（凭据被拒 → 401），9119 = 门关（同路径 200，无需 cookie）。两边都是环境事实而非产品事实，已按脚本口径归 ENV。
- 零产品码改动；未碰 `App.tsx` / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops；未 install；未并 main；未重建 9122；未 force / amend / `--no-verify`。
- 写域：仅 `docs/_artifacts/gov/**`（本报告 + DONE 一节）。
- 取证脚本与 raw JSON 落在 `/private/var/folders/…/opencode/r173/`，不入库；本报告贴的是命令原文与数值，不是工作树条目。
