# R-OBS-aa180f86 — 第八轮 obs 只读归因（#/approvals?tab=release、#/work）

取证时刻：2026-11-21 12:56（北京时间）。方式：只读，现网 `http://100.117.184.117:8183`（非 127.0.0.1），未改产品码、未重启服务、未发消息。

## 0. 结论摘要

| 路由 | 台账 index（auth / anon） | 我 auth（有效 opsadmin） | 我 anon | 归因（三选一） |
|---|---|---|---|---|
| `#/approvals?tab=release` | err 2 / err 2，main 466 两档 | **0 行**，main 950 | 2 行全 `401`，main 466 | **ENV**（缺登录态；URL 属 `/auth/`·`/agent-api/`） |
| `#/work` | err 7 / err 7，main 281 两档 | **0 行**，main 1845 | 7 行全 `401`，main 281 | **ENV**（同上，5 状态扇出 + matrix + whoami） |

- product 计数两面恒 **0**；无 pageerror、无堆栈、无 requestfailed、无 401/404 之外状态码 → 「首堆栈」没有可交内容（不存在抛错）。
- `git grep -c 'console\.error' -- web/src` = **0** 命中。
- 两条路由在有效登录态下**一条 console 都不产**，只在匿名态产 401 → 不是产品缺陷，也不指向上游业务错。

## 1. 台账原文与口径偏差

盘上（HEAD `0a03aed6`）`docs/_artifacts/tonight/`：

- `shots-summary.json`：headHash `7cb41601`、obs=1、routes `['#/access']`、entry `assets/index-CBaod-sX.js`、base `http://127.0.0.1:9122`、authStateFile `v4-auth-state.json`（已过期）
- `shots-anon-summary.json`：headHash `7cb41601`、obs=1、routes `['#/system']`、entry 同上、base 同上、authStateFile None

派单点名件 `aa180f86` = `merge(lane): 5e4c1c21 (wave-112)`，对象在本地存在但**不是 HEAD 祖先**；其树内台账自述：

- auth：headHash `a2a6b0d3`、**obs=0**、routes `[]`、entry `assets/index-AUJDWHSD.js`
- anon：headHash `a2a6b0d3`、**obs=0**、routes `[]`、entry `assets/index-AUJDWHSD.js`

→ **派单所述「auth obs=1 [#/approvals?tab=release]、anon obs=2 [+#/work]」在盘上两代台账（7cb41601 与 aa180f86 树内 a2a6b0d3）都取不到**；但逐路由 index 里这两条确实有 err 计数（见下表），只是没进 obs 清单。

index 逐字行（列序 route|label|vp|HTTP|main chars|main>0|empty?|error?|overflow|differs|png bytes|**console err**）：

```
shots-index.md:24      | `#/approvals?tab=release` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 112114 | 2 |
shots-index.md:25      | `#/approvals?tab=release` | 待处理 | 375  | 200 | 466 | yes | yes | yes | 0 | yes |  71691 | 2 |
shots-index.md:104     | `#/work`                  | 任务   | 1440 | 200 | 281 | yes | yes | -   | 0 | yes |  99898 | 7 |
shots-index.md:105     | `#/work`                  | 任务   | 375  | 200 | 281 | yes | yes | -   | 0 | yes |  70739 | 7 |
shots-anon-index.md:24 | `#/approvals?tab=release` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 111817 | 2 |
shots-anon-index.md:25 | `#/approvals?tab=release` | 待处理 | 375  | 200 | 466 | yes | yes | yes | 0 | yes |  71891 | 2 |
shots-anon-index.md:104| `#/work`                  | 任务   | 1440 | 200 | 281 | yes | yes | -   | 0 | yes | 100185 | 7 |
shots-anon-index.md:105| `#/work`                  | 任务   | 375  | 200 | 281 | yes | yes | -   | 0 | yes |  70525 | 7 |
```

**行数逐字复现**：我匿名实测 `#/approvals?tab=release` = 2 行、`#/work` = 7 行，main 466 / 281，与两档 index 完全一致（png 字节与时间戳属运行时差）。同时 `auth` 面 index 也是 2/7 —— 即台账把两面都跑成了 401，这是它的 authStateFile 已过期（`v4-auth-state.json`）的直接结果：台账 auth ≈ anon。这两条的 err 全被 `ENV_NOISE_RE` 判为 env-only，所以「有 err 计数、但不进 obs」是自洽的，与派单把它们列进 obs 不符。

代次：台账 entry `CBaod-sX`（7cb41601 代）/ `AUJDWHSD`（aa180f86 树内 a2a6b0d3 代）；本次浏览器与 curl 实测现网 served entry = **`index-bXNYODp-.js`**（又新一代）→ 我的复现跑在比两代台账都新的构建上，记为边界。

## 2. 复现命令（原文）

```bash
cd /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode
R='#/approvals?tab=release||#/work'
MODE=auth REPS=1 ROUTES="$R" node obs-6632f340.mjs > s8r-auth.out 2> s8r-auth.err
MODE=anon GATED=1 REPS=1 ROUTES="$R" node obs-6632f340.mjs > s8r-anon.out 2> s8r-anon.err
```

auth 用 `~/.local/state/sekoi-ops/ui-qa-auth-state.json`（opsadmin 有效态），anon 不传 storageState 并注入 `window.__HERMES_AUTH_REQUIRED__=true`（同 shots.mjs anon 路径）；两视口 1440x900 / 375x812；console 文本先 `slice(0,160)` 再按 `ENV_NOISE_RE=/\b(401|404)\s*\((Unauthorized|Not Found)\)/` 分 product/env。

## 3. 逐条 console 原文

### 3.1 anon `#/approvals?tab=release`（两视口同）

`http=200 navs=4 navError=- landed=/approvals?tab=pending&view=release main=466 product=0 lines=2`

```
~~ x1 401 http://100.117.184.117:8183/auth/whoami
~~ x1 401 http://100.117.184.117:8183/agent-api/api/approvals?status=pending&limit=50
```

原文文本（唯一）：`Failed to load resource: the server responded with a status of 401 (Unauthorized)`。
屏幕（合规错误态，非白屏）：「审批与发布门 … 汇总（与列表同源）： 待办 — 已批 — … 审批申请读取失败 …」。testid 前段 `apr5-page,apr5-page-pending,apv6-summary*,apv7-export-group`。

### 3.2 anon `#/work`（两视口同组，仅顺序不同）

`http=200 navs=4 landed=/work main=281 product=0 lines=7`

```
~~ x1 401 http://100.117.184.117:8183/auth/whoami
~~ x1 401 http://100.117.184.117:8183/agent-api/api/matrix
~~ x1 401 http://100.117.184.117:8183/agent-api/api/tasks?status=open&limit=50
~~ x1 401 http://100.117.184.117:8183/agent-api/api/tasks?status=in_progress&limit=50
~~ x1 401 http://100.117.184.117:8183/agent-api/api/tasks?status=done&limit=50
~~ x1 401 http://100.117.184.117:8183/agent-api/api/tasks?status=blocked&limit=50
~~ x1 401 http://100.117.184.117:8183/agent-api/api/tasks?status=cancelled&limit=50
```

屏幕：「任务没能加载出来 登录状态已过期，请重新登录后再刷新。 请求编号： 8e46a469…（375 档 ef56c675…） 复制 重试 返回控制台 联系管理员」；testid `tsk4-board,tsk4-summary,tsk4-error,tsk4-retry,tsk4-back,tsk4-contact`。

### 3.3 auth（有效登录态）

```
auth|#/approvals?tab=release samples=2 linesPerRun=[0,0] navsPerRun=[4,4] productLinesTotal=0 mainChars=[950]
auth|#/work                  samples=2 linesPerRun=[0,0] navsPerRun=[4,4] productLinesTotal=0 mainChars=[1845]
```
两面 `grep -c '    ## \|    !! '` = 0：无 pageerror、无堆栈、无 requestfailed。

## 4. 逐条归因与源码定位

**`#/approvals?tab=release` = ENV（缺登录态），不是产品码、不是上游业务错。**
- 它是 compat-tab 别名：`web/src/shell/routes.ts:253` `{ hash: '#/approvals?tab=release', …, kind: 'compat-tab', visible: false, label: '待处理', dataSource: '随目标', tab: 'release', to: '#/approvals?tab=pending&view=release' }`，目标行 `routes.ts:236`（`kind:'view'`，dataSource 自述「同 pending」）→ 复用待处理列表读口，落地 URL 也证实被改写为 `/approvals?tab=pending&view=release`。
- 读口出处：`web/src/modules/approvals/api.ts:22 LIST_PATH = "/agent-api/api/approvals"`、`:27 PAGE_LIMIT = 50`、`:42-43 listUrl()` → 拼出 `?status=pending&limit=50`，与我抓到的那一条逐字相同。
- 第二条是 `/auth/whoami`（鉴权探针，匿名必 401）。有效登录态整页 0 行 → 无任何未接线 404 残留，比 `#/access`（有效态 4 枚 404）更干净。

**`#/work` = ENV（缺登录态），同上。**
- 7 行完全由清单决定：`web/src/modules/tasks/tasksBoard.ts:197` 对五个状态各发 `tasks?status=${status}&limit=50` + `:201` 并发 `fetchJSON("/agent-api/api/matrix")` + 鉴权 `whoami` = 恰 7 条，与 `R-OBS-6c4f3385.md` §6 的同一算式复现一致（该件当时测得 auth 0 行 / anon 7 行）。
- 有效登录态 `mainChars=1845`、0 行 error；屏幕正常渲染，不涉未接线读口。

## 5. 与前份是否同源

**同源复用 R-OBS-2。**

| 对照件 | 关系 | 依据 |
|---|---|---|
| `R-OBS-2-7de87bc0.md` | 同源（本件按其口径） | `/auth/whoami` + `/agent-api/**` 401/404 机制、compat 别名归一，逐条一致 |
| `R-OBS-6c4f3385.md` §6/§7 | **`#/work` 完全同源** | 同一条 7 行算式（5 状态扇出 + matrix + whoami）、同 main 281、同 auth 0 行 |
| `R-OBS-8ff6d30d.md` / `R-OBS-6632f340.md` | **`tab=release` 与 `tab=policy` 同族** | 都是 `#/approvals` 的 compat-tab（`routes.ts:253` / `:254`），共用 `api.ts:22` 待处理读口；policy 有效态 0 行/匿名 2×401，本件 release 亦 0 行/2×401，逐字相同 |
| `R-OBS-7cb41601.md` | 同族同因 | 同为「有效态零 error、匿名态探针 401」，两面口径差由过期 v4 登录态解释 |
| `R-OBS-515f115b.md` | 机制互补 | 该件讲「台账列了前端不存在的路由 → App 层回落 /overview」；本件两条都是**已注册**路由（`routes.ts:253`/work 注册行），不属回落类 |

产品码证据连续第八轮为零（console.error 0 命中、pageerror/堆栈 0、无非 401/404 状态码）。

## 6. 取证边界

1. 台账 base 仍是 `http://127.0.0.1:9122`，而派单与本次复现都要求现网 8183（实测 8183）。
2. 台账 auth 面用已过期 `v4-auth-state.json` → 其 auth 读数等同匿名；这也是 auth index 记 2/7 行而我有效态实测 0 行的原因。
3. summary 无 `consoleErrorSample` 键 → 台账侧没有逐行原文与堆栈，只能按 index 计数比对（本件计数逐字吻合）。
4. `ENV_NOISE_RE` 只认 `401 (Unauthorized)` / `404 (Not Found)` 两种 Chrome reason-phrase，且先 `slice(0,160)` → 400/403/5xx、`net::ERR_*`、瞬时 pageerror 会被计成 product（历史上 `#/system?tab=retention`、`#/knowledge?tab=retrieval` 的差额即此机制，仍属噪声载体而非产品码）。
5. 派单的 obs 清单与盘上任何一代 summary 都不匹配（7cb41601 = access/system；aa180f86 树内 a2a6b0d3 = 两面 obs=0），但与 index 逐路由 err 计数吻合 → 本文按「台账 + 实测并集」回答，不据派单文本推断产品差异。
6. 代次：现网 `bXNYODp-` ≠ 台账 `CBaod-sX`/`AUJDWHSD`；本件读数全部在 `bXNYODp-` 同一代、同一次会话内取得，auth/anon 可比。
7. 本件不判回归：obs 载体在各代之间轮替，历件已归因为别名归一 + env 计数口径 + 过期登录态三件事。

## 7. 建议（不改码）

1. obs 清单与 index 计数在下轮 stamped 时并列落一次 JSONL（逐行原文 + 分类结果），免「有 err 无 obs」这类对不上。
2. 台账 auth 面换用与现网一致的有效登录态（或明确记 `auth≈anon`），否则 auth 侧 err 计数会持续重复 anon 侧读数。
3. 别名族（`routes.ts:253/:254/:246/:248/:257/:266`）按归一后的规范路由计数，obs 便不再「逐代漂移」。
4. `ENV_NOISE_RE` 建议扩识别 `net::ERR_*` 与裸状态码，并把 pageerror 与 console 分列计数（沿用前件建议，未采码）。

## 8. 复现产物

目录 `/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/`：`s8r-auth.out` 5958B、`s8r-anon.out` 9739B、同名 `.err` 均 0B；脚本 `obs-6632f340.mjs`。
