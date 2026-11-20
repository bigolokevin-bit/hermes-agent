# R174 — `#/sessions` 产品级 console error 归因

结论：这条路由的渲染者是 **`web/src/pages/SessionsPage.tsx`（上游 pages 写域，不在本车道写域
`web/src/modules/{runs,metrics,work,sessions}` 内）**；在我能拿到的登录态与在役 build 上，
`#/sessions` 的可观测 console error **100% 是 401 资源加载类（任务口径已剔除的 env）**，
product CE 实测为 **0**，所以 obs 报的 auth 36 / anon 87 **无法在本车道复现**，
也不存在可由我修的最小面。本文给出归属、三套读数的对照、复现命令与需要谁的哪一步。

## A. 归属（写域判定）

| 事实 | 出处 |
| --- | --- |
| `#/sessions` → path `/sessions` → `SessionsPage` | `web/src/App.tsx:203` `const SessionsPage = lazy(() => import("@/pages/SessionsPage"));`；`web/src/App.tsx:320` `"/sessions": SessionsPage` |
| 兼容表里这条是 `compat-module` 且 `visible: false`，并自带冲突注记 | `web/src/shell/routes.ts:264`（conflict: *"path '/sessions' is an existing App route (upstream SessionsPage); the compat form wants to redirect it to the employees list — stage 2 decides precedence"*） |
| 桥接层明确不重定向 | `web/src/shell/bridge.ts:85` `'#/sessions' → the existing upstream /sessions page (no redirect)`；`web/src/shell/bridge.test.ts:5`/`:29` 钉住 `target('#/sessions') === '/sessions'` |
| 本车道没有 sessions 模块 | `ls web/src/modules/` 无 `sessions/`（只有 `knowledge/session.ts`，与此无关） |
| 页面自身不打日志 | `grep -rn "console\.(error|warn)" web/src/pages/SessionsPage.tsx` → 0 命中 |
| 页面不引用我域任何模块 | 该文件 imports：`@/lib/api`、`@/lib/session-*`、`@/components/{Markdown,StructuredReasoning,PlatformsCard,DeleteConfirmDialog}`、`@nous-research/ui` atoms、`./SessionsPage_sources` |

⇒ 渲染者与全部候选缺陷面都在 `web/src/pages/**` / `web/src/components/**` / `@nous-research/ui`；
`App.tsx`、`web/src/shell/**` 又在本单禁碰清单里。**归因可给，修不在我写域。**

## B. 三套读数对照（同一 base `http://127.0.0.1:9122`，mode auth / anon）

| 来源 | `#/sessions` 读数 |
| --- | --- |
| 任务给的 obs 权威读数 | product CE **auth 36 / anon 87**（已剔除 401/403/404 env） |
| 仓库内已提交仪器 | `docs/_artifacts/tonight/crawl-auth.json` 与 `crawl-anon.json`：该路由 `consoleErrors: 3`、`consoleErrorEnv: "auth-required-401"`、`mainChars: 104`；`shots-summary.json`(mode auth) / `shots-anon-summary.json`：`consoleErrorsObservedByShots: 0`、`consoleErrorRoutesObservedByShots: []`、`routesWithEnvOnlyConsoleErrors: 51`，且 `mainCharsByRoute["#/sessions"] = {chars: 1}` |
| 我本次实测（下方 §D） | auth **167** 条 / anon **393** 条 console error，**全部**是同一条 401 资源加载消息；`pageerror` 0；**product CE 0**；`main` 文本 1 字符 |

三套数互相矛盾之处本身是结论的一部分：**只有在我这次跑里 401 类被放大到数百条**，
因为页面在未登录态下会反复轮询 `/auth/whoami`；obs 的 36/87 是"剔掉 401 之后还剩的东西"，
而那东西需要**有数据的登录态**才会产生。

## C. 为什么在我这里 product CE = 0

在役 build 是 `python http.server`（`9122`，见 `docs/_artifacts/tonight/shots.mjs:293` 注记）上的静态产物，
不是本车道 HEAD 的产物；存的登录态 `~/.local/state/sekoi-ops/v4-auth-state.json`（431 B，mtime Nov 19 19:12）
在两个 mode 下都拿到 `401 /auth/whoami`。未登录 ⇒ `SessionsPage` 的列表读取全 401 ⇒
React 树只渲染出壳（`h1 = ['Sessions']`，`main` 文本 1 字符），**任何依赖 session 行的渲染分支根本没跑**，
所以可归属为 product 的告警一条也不会出现。要在 `#/sessions` 上看到 product CE，
前置条件缺一即不可复现：①有效登录态；②该 profile 下真有 session 数据；③build 与待验 HEAD 同源。

## D. 复现命令与工件

- 探针（车道外临时件，未入库）：`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/r174-sessions-ce.mjs`
  → 读数 `/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/r174-sessions-ce.json`。
  它按 `shots.mjs` 的既有装载法（`createRequire('/Users/kevin_studio/Projects/seakoi-console-web/package.json')` +
  `chromium-1255`，不装依赖、不动 lock）打开 `#/sessions`，auth/anon 各一遍，收 `console`(type=error) 的
  原文 + `msg.location()` + `msg.stack()` 首帧、`pageerror` 堆栈首帧、以及 status ≥ 400 的响应。
- 实测原文（auth 167 次 / anon 393 次，全部同一条，`pageerror` 无）：
  `Failed to load resource: the server responded with a status of 401 (Unauthorized)`
  首堆栈行：`http://127.0.0.1:9122/auth/whoami:0:0`
  伴随的 ≥400 响应：`401 /auth/whoami`、`401 /agent-api/api/sessions?limit=20&offset=0&order=created&exclude_sources=cron,tool,oneshot,api_server,acp,hermes_flow,vulcan`、`401 /agent-api/api/sessions?limit=50&…`
- 组件级复现入口（给上游 owner，最省事的取证路）：`web/src/pages/SessionsPage.test.tsx` 的
  `renderSessionsPage(rows)`（`getSessions(limit)`：limit 20 = 列表页，limit 50 = overview 最近卡片），
  加一行 `vi.spyOn(console, 'error')` 即可在有行数据时把 product CE 的原文与堆栈首帧打出来。
  现状：`pnpm vitest run src/pages/SessionsPage.test.tsx` → 5/5 通过，**零** console.error 输出。

## E. 若授权我修，最小面在哪（按优先级，均不在本车道写域）

1. `web/src/pages/SessionsPage.tsx`：未登录/读取失败时停止对 `/auth/whoami` 的轮询——数百条 401 是把这条路由
   推成"全站最大热点"的直接原因；判 401 后落一条可读的登录失效态即可（与 `web/src/shell/StatePlaceholder.tsx`
   同族，属 wave-37 已有件）。
2. 同文件：`limit=20` 与 `limit=50` 两个列表读取在同一路由同时发，去重成一次共享读取。
3. 真实 product CE（obs 的 36/87）需要 §C 的两个前置到位后才能定位；定位后修在
   `SessionsPage` 的行渲染或 `@/components/*` 的 props 契约上——按本仓先例，最常见类是
   未知 DOM 透传 prop（metrics 侧 `data-metO-unit` 同型）与列表 `key` 缺失/重复。

## F. 需要拍板的事（本单不再自走）

1. 是否把 `#/sessions` 的写域开给本车道（`web/src/pages/SessionsPage.tsx`），或把这单转给 pages 写域车道；
2. 提供一份**有效**登录态 + 有 session 数据的 profile，并指明 obs 36/87 是在哪个 build/HEAD 上取的——
   否则"修后同路由复测前后对照"这一验收项无法在本 checkout 上成立；
3. 验收口径本身不建议改：obs 剔除 401/403/404 的口径是对的，问题在我拿不到"剔完还剩什么"的现场。
