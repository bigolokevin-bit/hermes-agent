# 波 3 治理组 — T20 / T21 / T23 / T24

> 账本单一落点纪律（2026-11-19）：
> 1. 任何提交都不得包含 `docs/_artifacts/tonight/**` 的**修改**；`git commit` 前先 `git reset -q HEAD -- docs/_artifacts/tonight`。
> 2. 合入主树导致该目录复活旧账时，一律 `git checkout origin/lane/hermes-console -- docs/_artifacts/tonight` 覆盖后再提交。
> 3. 本 lane 的页面证据只写 `docs/_artifacts/gov/**`；权威账本只在 `forks/hermes-agent` 主树。

Worktree: `/Users/kevin_studio/Projects/forks/console-gov` · branch `lane/console-gov` · base `c28ebc16`.
Write domain: `web/src/modules/{people,org,settings,version}/**`, `docs/_artifacts/gov/**`.
No App/routes/shell/registry/manifest/package.json/lockfile changes.

## Commits

| Page | Commit | Status |
|---|---|---|
| people 人员目录 | `235ee9f5` | testids aligned to `ppl4-`; 9 tests |
| org 组织与部门 | `f94c49ce` | testids aligned to `org4-`; 9 tests |
| settings 默认设置 | `d9b20e26` + `a0a25304` | removed engineering copy (CR-M2-02), reasons now match enabled/disabled/unknown/not-landed; 4 tests |
| version 版本 | `f205b27d` | removed V4/script jargon, Beijing time normalized to `YYYY-MM-DD HH:mm`; 3 tests |

## Data truth

- people: candidates `/agent-api/api/v1/user/list`, `/all`; no verified BFF route in this worktree →
  honest `待核实（GAP-02）`, no fabricated rows. Live 200 not fetched.
- org: candidates `/agent-api/api/v1/dept/list`, `/tree`; same GAP-02, empty/apply guidance kept.
- settings: `/agent-api/api/config`; 404 → explicit `未启用` per switch with reason; no save/reset control,
  only real links to `#/system` and `#/employees`. Live 200 not fetched.
- version: build identity/ref/commit/time are read from `VITE_BUILD_*`; this worktree has none → `未知`
  with reason. Dependency versions come from `package.json`. Live 200 not applicable.

## Commands + raw stdout

```bash
$ cd /Users/kevin_studio/Projects/forks/console-gov/web
$ ./node_modules/.bin/tsc -b . --noEmit
# EXIT: 0
```

```bash
$ pnpm exec vitest run src/modules/people src/modules/org src/modules/settings src/modules/version
 Test Files  4 passed (4)
      Tests  25 passed (25)
```

```bash
# Chrome CDP, all four sections on one preview page (temporary preview removed before commit):
{"w":1440,"sw":1440,"parts":[{"id":"p-people","sw":1397,"cw":1395},{"id":"p-org","sw":1397,"cw":1395},{"id":"p-settings","sw":1397,"cw":1395},{"id":"p-version","sw":1395,"cw":1395}]}
{"w":375,"sw":375,"parts":[{"id":"p-people","sw":330,"cw":330},{"id":"p-org","sw":332,"cw":330},{"id":"p-settings","sw":330,"cw":330},{"id":"p-version","sw":330,"cw":330}]}
ERRORS:0
# body scrollWidth equals viewport at both widths; no page-level horizontal overflow.
# org has a 2px internal section scrollWidth delta at 375 (no body overflow), noted as residual.
```

## Screenshots

- `docs/_artifacts/gov/shots/gov-1440.png`
- `docs/_artifacts/gov/shots/gov-375.png`

## Honest gaps

- Live BFF/毕升 user/dept endpoints were not available; GAP-02 states are exercised by tests, not a live 200.
- Pages are still mounted by the shell lane (no App/manifest change here); preview harness was used for layout proof.
- Org's 2px per-section scroll delta at 375 is internal only; body never exceeds 375.

---

# T22 / T23 · 访问控制 + 知识空间（2026-11-19）

## Delivered

- **T22 访问控制** (`web/src/modules/access/**`, commit `ff874d13`):
  - three groups: 角色 / 成员 / 管理员; rows show `姓名或角色名 · 8位短码`; raw ids only in `title`.
  - permission provenance in words (角色授权 / 菜单授权 / 部门继承 / 直接授予 / 其他来源); missing → `—（来源未提供）`.
  - no write controls; 404 from all candidates → `未接入` + `GAP-02` + real `/approvals` application link; 403 → denied; 5xx → request id + retry.
  - `?state=loading|empty|error|denied` supported; no fabricated 0.
- **T23 知识空间** (`web/src/modules/knowledge/**`, commit `9c28055d`):
  - space list / document count / retrieval entry; GAP-03 means the knowledge read API does not exist, so all three show `未接入` + reason, never 0 or sample rows.
  - `?tab=sources` deep link preserved; `?state=` four states; read-only, no test/sync buttons.

## Commands + raw stdout

```bash
$ cd /Users/kevin_studio/Projects/forks/console-gov/web
$ ./node_modules/.bin/tsc -b . --noEmit
# EXIT: 0
```

```bash
$ pnpm exec vitest run src/modules/access src/modules/knowledge
 Test Files  2 passed (2)
      Tests  7 passed (7)
```

```bash
$ cd /Users/kevin_studio/Projects/forks/console-gov
$ pnpm --filter web build
# EXIT: 0
# 82 assets / 3.4M
```

```text
Chrome CDP preview measurements (temporary harness removed before commit):
access 1440 {"sw":1440,"bw":1440,"iw":1440}
access  375 {"sw":375,"bw":375,"iw":375}
knowledge 1440 {"sw":1440,"bw":1440,"iw":1440}
knowledge  375 {"sw":375,"bw":375,"iw":375}
```

## Screenshots

- `docs/_artifacts/gov/shots/acc4-1440.png`
- `docs/_artifacts/gov/shots/acc4-375.png`
- `docs/_artifacts/gov/shots/knw4-1440.png`
- `docs/_artifacts/gov/shots/knw4-375.png`

## Honest gaps

- Access and knowledge read endpoints are not live (GAP-02/GAP-03); engine tests exercise the honest unavailable/error states, not a live 200.
- Pages are ready-to-mount but not wired by this lane: no App/shell/manifest edits (lane boundary). Preview harness provided layout proof only.
- Node modules in this worktree were materialized as a real directory of symlinks plus a real pnpm task-state directory to satisfy pnpm; no package install.

# T30 系统健康 / T28 模型与单价 — 交付

- 分支 `lane/console-gov`（base `4bfb31ef804f`）
- 提交：`c98bf889` T30 系统健康 · `1ec85480` T28 模型与单价 ·（本文件为第三交）
- 写域：`web/src/modules/health/**`、`web/src/modules/models/**`、本文件与截图。未碰 App.tsx / shell / 任何 manifest.ts / package / lock。

## T30 系统健康

- 三个真探针并行：`/agent-api/api/__health-probe__`（控制台）、`/agent-api/api/hermes-summary`（Hermes 运行时）、`/agent-api/api/skills`（域服务）。
- 第四行「上游业务平台」固定为未知，原因「探针未接入（GAP-05），请看接入说明。」，不画绿勾。
- 接口 401/403/404 → 「接口未接入：这个读取口还没有对控制台开放。」；网络不可达 → 未知；其它 HTTP → 异常但不显示状态码，原始 `HTTP n` 仅进行 title。
- 整页错误仅在三个真探针**都没有收到任何 HTTP 响应**时出现，含请求编号与重试；每行采集时刻北京时间到分。
- testid `hlt4-*`；`?state=loading|empty|error` 预览态带 `data-fixture`。

## T28 模型与单价

- 三块数据各读各的，三个真实 BFF 地址：目录 `/agent-api/api/models`、价目表 `/agent-api/api/models/pricing`、账本 `/agent-api/api/hermes-usage?days=30`。
- 三块都有自己的 loading / empty / 未接入（GAP-07）/ denied / error 与重试；缺一块只降级那一块。
- 单价与账本严格分区：单价卡列输入/输出每百万 token 价格与生效时刻；账本卡只展示 `cost.cost_usd` 实扣、`cost_status`、行数与截至时刻。页脚与 `models.ts` 头注释都写明「不用单价乘用量，也不把两块数字相互换算」。
- 未知值一律 `—` 或「未计价」，不补零；无示例数据、无 fixture 回落。`?state=` 仅作预览并标记 `data-fixture` + GAP-07。
- 错误可复制请求编号；正文不出现 HTTP 码/裸字段名/裸模型 id（原值进 title）；testid `mdl4-*`。

## 自测与布局

```text
$ cd web && npx vitest run src/modules/health src/modules/models
 Test Files  2 passed (2)
      Tests  12 passed (12)

$ cd web && ./node_modules/.bin/tsc -b . --noEmit
# EXIT: 0
```

```text
Chrome CDP preview measurements (temporary harness removed before commit, real viewport meta):
health 1440 {"sw":1440,"bw":1440,"iw":1440}
health  375 {"sw":375,"bw":375,"iw":375}
models 1440 {"sw":1440,"bw":1440,"iw":1440}
models  375 {"sw":375,"bw":375,"iw":375}; inner table scrolls: price 640/311, catalog 520/311
```

## 截图

- `docs/_artifacts/gov/shots/hlt4-1440.png`
- `docs/_artifacts/gov/shots/hlt4-375.png`
- `docs/_artifacts/gov/shots/mdl4-1440.png`
- `docs/_artifacts/gov/shots/mdl4-375.png`

## 诚实缺口

- BFF 尚未注册 `/api/models`、`/api/models/pricing`（GAP-07）；账本口 `/api/hermes-usage` 已存在但本批未取得带鉴权的真实 200。三块未接入态由测试覆盖，不是活数据。
- 页面 ready-to-mount，但本 lane 未改 App/shell/manifest；预览仅为布局证据。
- 未声称 vite entry sha（软链树不可信）；布局前已跑 `pnpm --filter web build`，exit 0。

## 追加核查：knowledge 三条 console error（2026-11-19）

### 修前（9122 旧产物，fd1e43f2 代次）

三个 tab 的捕获一致，各 1 条 error：

```text
citations  consoleErrors=1
evidence   consoleErrors=1
retrieval  consoleErrors=1

[log] Failed to load resource: the server responded with a status of 401 (Unauthorized)
      http://127.0.0.1:9122/agent-api/api/run-events?kind=citation&limit=50
[console.error] [api] HTTP 401 /agent-api/api/run-events?kind=citation&limit=50
      {"code": "console.unauthenticated", "message": "identity check failed"}
```

### 修复

- 三个 tab 最终都渲染 `EvidenceModulePage`，唯一请求是 `/agent-api/api/run-events?kind=citation&limit=50`。
- 新增 `web/src/modules/knowledge/session.ts` 的 `hasConsoleSession()`；`EvidenceModulePage` 在无 `window.__HERMES_SESSION_TOKEN__` 时**不发请求**，直接渲染「需要登录」状态（`evidence-login`），并说明“引用读取没有发出”。
- 有会话 token 时行为不变，仍读取引用；401/403/404/空/错态保持原样。
- 说明：三个 tab 的实际渲染文件属于 `web/src/modules/evidence/`，`web/src/modules/knowledge/**` 本身不参与该渲染；本次只改了这一处渲染入口和新增的 knowledge 会话判断文件。

### 修后（本分支构建产物，5427 本地 served，`/agent-api` 代理真实返回 401）

同一 Chrome CDP 捕获：

```text
citations  consoleErrors=0
evidence   consoleErrors=0
retrieval  consoleErrors=0
```

页面文本包含「需要登录」「引用读取没有发出」「本页没有发送请求」，且网络面板没有 `/agent-api/api/run-events` 请求。

### 测试

```text
$ cd web && npx vitest run src/modules/evidence src/modules/knowledge
 Test Files  2 passed (2)
      Tests  5 passed (5)

$ ./node_modules/.bin/tsc -b . --noEmit
# EXIT: 0
```

### 账本引用

- `docs/_artifacts/tonight/` 的模块树副本已整块删除（`b022006c`）。
- 本文件此前指向该副本的 1 处已改为：权威账本只在主树 `/Users/kevin_studio/Projects/forks/hermes-agent/docs/_artifacts/tonight/`，模块树不生成任何 tonight 账本。
- 其他 lane 的 DONE 仍含 31 处历史路径引用（`docs/_artifacts/D/DONE.md` 等），不在本 lane 写域，未改；阅读时一律以主树权威账本为准。

## P5 总览聚合（/overview）— 页面模块交付

- 新增 `web/src/modules/overview/{OverviewPage.tsx,overview.ts,overview.css,OverviewPage.test.tsx}`，只读复用 `modules/duty` 的 `useDutyData`、`aggregate`、`format`、`api`，未改 duty 任何文件。
- KPI 四张：员工（总数/在岗/有风险）、今日运行（次数/失败/失败率）、待审批、今日成本；每张标数据源与「读取于 北京时间到分」。
- 风险数来自 `/agent-api/api/matrix` 的 `risk` 字段；接口缺失或未返回行时显「—」+ `GAP-OV5-RISK`，不写 0。
- 今日成本来自 `budget-usage` 日账本；账本未覆盖全部员工时显「—」+ `GAP-OV5-COST`，不用单价×次数推算。
- 趋势 = `run-stats` 近 14 天 buckets；最近活动 = 近 7 天运行；阻塞队列 = 失败运行 / 阻塞任务 / 待审批，均带真实 route。
- 四态：`?state=loading|empty|error|ready` 可预览；真实全空 → 空态；核心源全错 → 整页错误 + 可复制请求编号 + 重试；单卡失败只降级该卡。
- testid 前缀 `ov5-*`；CSS 在 1100px/560px 断点降列，375 单列。

### 自测

```text
$ cd web && npx vitest run src/modules/overview
 Test Files  1 passed (1)
      Tests  6 passed (6)

$ ./node_modules/.bin/tsc -b . --noEmit
# EXIT: 0
```

### 边界（必须披露）

- 本 lane 未改 `App.tsx` / `shell/**` / manifest / package：`/overview` 当前仍由 App 的 `live={{ duty: <DutyConsolePage /> }}` 挂旧值班台；本页是 ready-to-mount 的 `OverviewPage`，需集成侧把 `/overview` 的 live 节点切到本页后才会上屏。
- 因此本轮未对真实 `/overview` 做浏览器截图；1440/1280/375 仅按 CSS 断点与测试覆盖，未像素复验。

## R10 ⑦ 单价 / 版本真修（2026-11-19）

- 同步主干：`git merge --no-ff origin/lane/hermes-console` → `3cef4626`（主树 5e28aa04）；`docs/_artifacts/tonight` 与主树同代次，porcelain 0。
- 取数层新增 `web/src/modules/models/fetchJson.ts` 的 `fetchJsonStrict`：content-type 非 JSON 或 body 以 `<` 开头 → 抛 `ApiError("这个接口还没有接入数据服务；当前返回的是页面，不是数据。")`；JSON.parse 失败 → `ApiError("这个接口返回的内容无法解析为数据…")`；不把原始 `Unexpected token '<'` 或 HTML 上屏，保留 request id。
- `ModelsModulePage` 三个端点改用 `fetchJsonStrict`；`VersionPage` 新增「模型单价」卡，读同一价格端点，列模型/提供方/输入/输出/价格生效，来源 + 读取于北京时间到分；未知 `—`。
- 单价与账本仍分区：价格卡只放标价；账本卡只放 `cost.cost_usd` 实扣、`cost_status`、行数；页面脚注禁止单价×用量。

### 原始 stdout

```text
$ cd web && npx vitest run
 Test Files  112 passed (112)
      Tests  972 passed (972)

$ ./node_modules/.bin/tsc -b . --noEmit
# EXIT: 0

$ cd /Users/kevin_studio/Projects/forks/console-gov && pnpm --filter web build
built /Users/kevin_studio/Projects/forks/console-gov/hermes_cli/web_dist/index.html
# EXIT: 0
```

### DOM 读数（Chrome CDP，1440×900）

真实 401（本机 5427 + `/agent-api` 代理 8182）：

```text
/system?tab=version
模型单价
来源：模型价格表
需要登录：这个页面的登录状态已经失效。重新登录后就能继续查看。
请求编号：e86c1471f64141fdaa4f150f5ebafb4d
单价是价目表标价；实际扣费在「模型与单价」页的账本卡，不用单价乘次数推算。
```

200 形态（临时 fetch stub，仅用于读 DOM，不提交）：

```text
/models
单价（价目表） · 来源：模型价格表 · 读取于 2026-11-19 10:00
DeepSeek V3  deepseek  $0.14 / 百万 token  $0.28 / 百万 token  2026-11-19 10:00
实际扣费（账本） · 来源：平台扣费账本 · 截至 2026-11-19 10:00
账本合计 $12.48 · 计价状态 账本实测 · 账本行数 42

/system?tab=version
模型单价 · 来源：模型价格表 · 读取于 2026-11-19 10:00
DeepSeek V3  deepseek  $0.14 / 百万 token  $0.28 / 百万 token  2026-11-19 10:00
```

### 边界

- 真实 200 未取得（本机无登录态，`/agent-api` 返回 401）；DOM 200 段来自临时 fixture stub，仅证明渲染与分区，不冒充线上数据。
- 未改 App/shell/manifest/package；`/models` 与 `/system?tab=version` 的 live 节点由现有 shell 提供。

## MET5 /metrics 7×24 运行热力（2026-11-19）

- 提交：`5e1774c9 feat(console): metrics 7x24 run heatmap (met5)`（4 files，+942）
- 写域：`web/src/modules/metrics/**`；未改 App.tsx / shell / manifest / package / lock。
- 数据：`/agent-api/api/run-activity?weeks=1|4|12&tz=Asia/Shanghai`。接口存在但本机无登录态，实测 401（`console.unauthenticated`），未取得真实 200。
- 口径：7 天×24 小时格；接口未返回的格显 `—`（`is-missing`），显式 `count:0` 显真 0（`is-zero`）；未知不补 0。
- 时间窗只有 7 天 / 4 周（28 天）/ 12 周（84 天）；端点按整周汇总，不提供 24h 窗口，页面明示，不做假入口。
- 每格 title/aria-label 含计数与北京时间范围；点击显示所选格；`met5-*` testid。
- 四态：加载骨架 / 正常 / 空（不补 0）/ 错（人话 + 可复制请求编号 + 重试）；`?state=loading|empty|error` 仅预览，零取数并带 `data-fixture="1"`。

### 自测

```text
$ cd web && ./node_modules/.bin/tsc -b . --noEmit
# EXIT: 0

$ cd web && npx vitest run src/modules/metrics
 Test Files  1 passed (1)
      Tests  7 passed (7)

$ cd web && npx vitest run
 Test Files  114 passed (114)
      Tests  1020 passed (1020)

$ cd /Users/kevin_studio/Projects/forks/console-gov && pnpm --filter web build
built /Users/kevin_studio/Projects/forks/console-gov/hermes_cli/web_dist/index.html
# EXIT: 0
```

### DOM 读数（Chrome CDP，临时预览 harness，已删除）

```text
1440×900: bodySW=1440 bodyCW=1440 pageSW=1440 scrollSW=1389 scrollCW=1389 cells=168
1280×800: bodySW=1280 bodyCW=1280 pageSW=1280 scrollSW=1229 scrollCW=1229 cells=168
375×812:  bodySW=375 bodyCW=375 pageSW=375 scrollSW=620 scrollCW=339 cells=168
```

375 仅热力图容器内横向滚动，页面无横溢。截图：`docs/_artifacts/gov/shots/met5-1440.png`、`met5-1280.png`、`met5-375.png`。

### 需壳层注册的路由清单

1. `web/src/App.tsx` 增加 `/metrics` 惰性路由，指向 `web/src/modules/metrics/MetricsModulePage.tsx`。
2. 侧栏/导航项指向 `/metrics`（或 bridge 将 `#/metrics` 指向新页）。
3. 现状：`shell/routes.ts` 的 `#/metrics` 是 hidden compat 行，映射到 `#/overview?tab=usage`；`shell/bridge.ts` 把 `#/metrics` 映射到 `/analytics`；App.tsx 无 `/metrics` 路由。

### 边界

- 真实 200 未取得；401 仅证明路径存在。
- 未做 24h 窗口（端点不支持）。
- 页面在新路由注册前仍不可达 `/metrics`。

### 观察者复核修正（MET5）

首轮截图复核 FAIL：热力格与图例无色块；375 右半日不可见且无滑动提示，滚动边界有半格残影。根因是 `metrics.css` 使用了本主题不存在的 `hsl(var(--primary/--muted/...))` 令牌。已改为 `color-mix(var(--midground-base))` 与 `var(--color-*)`；375 增加「左右滑动热力图，查看 12–23 点」提示与右缘渐隐。复测：168 格全部渲染（167 有底色，1 格斜纹缺失），1440/1280/375 body 均等于视口，375 仅热力容器内滚动（620/307）。截图已覆盖更新。

### R11 自查：模块被挂载后的单价与解析错误（2026-11-19）

- 修复提交：`87e92c36 fix(console): surface human model read errors (R11)`。
- 原因：R11 实测的 `/models` 仍指向旧 `@/pages/ModelsPage`；模块本身未被该路由挂载。
- 挂载契约：`ModelsModulePage` 为**具名导出**，无 props；不读 `tab` 参数，只读 `?state=loading|empty|error|denied` 预览；testid 前缀 `mdl4-*`；三块数据各读 `/agent-api/api/models`、`/agent-api/api/models/pricing`、`/agent-api/api/hermes-usage?days=30`。
- 非 JSON 兜底改为直接上屏 `ApiError` 的人话（HTML 页面 →「这个接口还没有接入数据服务…」），并保留请求编号；不再只显示泛化错误，也绝不出现 `Unexpected token`。

临时 Vite harness（`/models` MemoryRouter + fetch 200 stub，已删除）DOM 读数：

```text
200 JSON 场景：
单价 词族 = 6
单价（价目表） / 实际扣费（账本） / $0.14 / 百万 token / $12.48 均命中
Unexpected token = 0

HTML 兜底场景（price 端点返回 text/html + x-console-request-id）：
单价 词族 = 7
「单价表读取失败」「这个接口还没有接入数据服务」命中
请求编号 req-html-dom-1 命中
Unexpected token = 0
```

全量：`114 files / 1021 passed`；`tsc` 0；`pnpm --filter web build` EXIT 0。

## TEN4 租户与配额（2026-11-19）

- 提交：`df2e7efe feat(console): tenant and quota honest page (ten4)`（4 files，+962）
- 写域：`web/src/modules/tenant/**`；未改 App.tsx / shell / manifest / package / lock。
- BFF 无租户、配额或身份读取路由（源码核对，候选路径在鉴权前统一 401）。页面因此将租户名称 / ID / 创建时间与全部额度上限标为「未接入（GAP-TEN-01）」并给「—」，不造租户、不补 0。
- 只展示已有端点可读的当前用量：员工数 `/agent-api/api/employee-stats`、近 7 天运行数 `/agent-api/api/run-stats`；各自标来源与北京时间读取时刻，与额度上限分区。
- 存储与 token 用量无端点，显 `—` 和原因；用尽态说明额度未知、无法判断。
- 四态：加载 / 正常 / 空（两读数均真 0）/ 错（人话 + 可复制请求编号 + 重试）；`?state=loading|empty|error` 仅预览，零取数并带 `data-fixture="1"`。
- testid：`ten4-*`；错误态无 HTTP 码/裸字段；申请入口为真实 `/approvals`。

### 自测

```text
$ cd web && ./node_modules/.bin/tsc -b . --noEmit
# EXIT: 0

$ cd web && npx vitest run src/modules/tenant
 Test Files  1 passed (1)
      Tests  7 passed (7)

$ cd web && npx vitest run
 Test Files  115 passed (115)
      Tests  1028 passed (1028)

$ cd /Users/kevin_studio/Projects/forks/console-gov && pnpm --filter web build
built /Users/kevin_studio/Projects/forks/console-gov/hermes_cli/web_dist/index.html
# EXIT: 0
```

### DOM 读数（Chrome CDP，临时预览 harness，已删除）

```text
1440×900: vw=1440 bodySW=1440 bodyCW=1440 pageSW=1410 pageCW=1408
375×812:  vw=375 bodySW=375 bodyCW=375 pageSW=345 pageCW=343
```

页面无横溢；375 主列单列。截图：`docs/_artifacts/gov/shots/ten4-1440.png`、`ten4-375.png`。

### 需壳层注册

1. `web/src/App.tsx` 增加 `/tenant-quota` 路由，指向 `web/src/modules/tenant/TenantQuotaPage.tsx`。
2. 侧栏 `/tenant-quota` 去掉 `placeholder: true` 并指向该页。
3. `#/identity?tab=tenant` 的 bridge 改指本页（现映射到人员目录）。

### 边界

- 无租户/配额端点，真实租户资料与额度上限未取得。
- 页面在新路由注册前不可达 `/tenant-quota`。

## MET5 增量 /metrics 7×24 热力（2026-11-19 13:4x）

- 提交：`bc9f13b8 feat(console): metrics heatmap gap title and fixture guard (met5)`（2 files，+10/−5）
- 基线：`58e59535`（`origin/lane/hermes-console` 其后仅多一个 gate ledger commit `35000331`；按任务要求落在 `58e59535`）。
- 页面：`web/src/modules/metrics/**`（`met5-*`）。读 `/agent-api/api/run-activity?weeks=1|4|12&tz=Asia/Shanghai`，7×24 格；接口未返回的格为 `—` 斜纹，显式 `count:0` 为真 0；窗口总运行与峰值只统计出现过的格。
- 时间窗：最近 7 天 / 4 周（28 天）/ 12 周（84 天）；端点按整周汇总，无 24h 窗口，页面明示。
- 未接入：404 →「这项数据还没有接入」+ 原因；`GAP-MET5-01` 仅在错误说明的 `title`，正文不可见。
- `data-fixture="1"` 只在 `?state=loading|empty|error` 夹具态出现，正常取数态无此属性（新增断言）。
- 四态齐，错误可复制请求编号 + 重试；375 仅网格自身横向滚动（`met5-scrollhint` + 右缘渐隐）。
- 实测：`run-activity` 无登录态返回 401（路径存在）；真实 200 未取得；页面真实数据度=机构未提供登录态，已按未接入/未知处理，不补 0。

### 自测

```text
$ cd web && ./node_modules/.bin/tsc -b . --noEmit
# EXIT: 0

$ cd web && npx vitest run src/modules/metrics
 Test Files  1 passed (1)
      Tests  7 passed (7)

$ cd web && npx vitest run
 Test Files  118 passed (118)
      Tests  1135 passed (1135)

$ cd /Users/kevin_studio/Projects/forks/console-gov && pnpm --filter web build
built .../hermes_cli/web_dist/index.html
# EXIT: 0
```

### DOM 读数（本页增量前一次 1440/1280/375 实测，页面结构未变）

```text
1440×900: bodySW=1440 bodyCW=1440 pageSW=1440 scrollSW=1389 scrollCW=1389 cells=168
1280×800: bodySW=1280 bodyCW=1280 pageSW=1280 scrollSW=1229 scrollCW=1229 cells=168
375×812:  bodySW=375 bodyCW=375 pageSW=375 scrollSW=620 scrollCW=307 cells=168
```

截图：`docs/_artifacts/gov/shots/met5-1440.png`、`met5-1280.png`、`met5-375.png`。

### 需壳层注册

`web/src/App.tsx` 增加 `/metrics` → `web/src/modules/metrics/MetricsModulePage`；`shell/routes.ts` 的 `#/metrics` 目前是 hidden compat 行并指向 `#/overview?tab=usage`，`shell/bridge.ts` 将其映射到 `/analytics`；`App.tsx` 当前无 `/metrics` 路由。未改 App/shell/manifest/package。

## SKL4 `/skills` 真数据页（2026-11-19）

- 基线：`b4341cc7`；提交：`35cfbcc8 feat(console): skills real data page (skl4)`（4 files，+437/−211）。
- 写域：`web/src/modules/skills/**`；未改 App.tsx / shell / manifest / package；`/skills` 路由原本已存在。
- 数据：`/agent-api/api/skills`（BFF 活代理）。本机实测 **401 `console.unauthenticated`**，路径存在，未取得真实 200。
- 列表列：名称 / 来源 / 状态 / 更新时间 / 共享范围。上游台账只有 `skillId,name,version,contentHash,ownerUserId,sharedWith,sharedCount,scope` 与 `asOf`；来源、状态、更新时间无字段时显 `—` + 原因，不臆造、不补 0。
- 时间：北京时间到分（`YYYY-MM-DD HH:mm`）；表头来源行显示台账 `asOf` 读取时刻。
- 四态：加载骨架 / 正常 / 空（不显示 0 个技能）/ 错（人话 + 可复制请求编号 + 重试）；404 显「技能数据还没有接入」且 GAP-SKL4-01 只进 `title`。
- testid `skl4-*`；`data-fixture` 仅在 `?state=loading|empty|error` 预览态出现；无写入口、无死控件。

### 自测

```text
$ cd web && ./node_modules/.bin/tsc -b . --noEmit
# EXIT: 0

$ cd web && npx vitest run src/modules/skills
 Test Files  1 passed (1)
      Tests  7 passed (7)

$ cd web && npx vitest run
 Test Files  118 passed (118)
      Tests  1137 passed (1137)

$ cd /Users/kevin_studio/Projects/forks/console-gov && pnpm --filter web build
built /Users/kevin_studio/Projects/forks/console-gov/hermes_cli/web_dist/index.html
# EXIT: 0
```

### DOM 读数（Chrome CDP，临时预览 harness，已删除）

```text
1440×900: vw=1440 bodySW=1440 bodyCW=1440 pageSW=1410 tableW=1406 scSW=1406 scCW=1406 rows=2
1280×800: vw=1280 bodySW=1280 bodyCW=1280 pageSW=1250 tableW=1246 scSW=1246 scCW=1246 rows=2
375×812:  vw=375 bodySW=375 bodyCW=375 pageSW=345 tableW=760 scSW=760 scCW=341 rows=2
```

375 仅表格容器内滚动（760/341），页面无横溢。截图：`docs/_artifacts/gov/shots/skl4-1440.png`、`skl4-1280.png`、`skl4-375.png`。

### 边界

- 真实 200 未取得；401 只证明路径存在。
- 列表不提供逐行详情；来源/状态/更新时间字段若上游后续补入，同一列直接显示。
- 无需壳层注册（`/skills` 已在 App 路由与侧栏）。

## OV5 /overview 聚合收口（2026-11-19）

- 提交：`bbefbdba feat(console): overview aggregation honesty and retries (ov5)`（4 files，+126/−22）
- 写域：`web/src/modules/overview/**`；`/overview` 已由壳层挂载，未改 App.tsx / shell / manifest / package。
- 数据源（逐卡标注）：
  - 员工：`/agent-api/api/employee-stats`（总数/在岗）；风险数另读 `/agent-api/api/matrix`。
  - 今日运行：`/agent-api/api/run-stats`（北京当日窗口，totals.runs/failed）。
  - 待审批：`/agent-api/api/approval-stats`。
  - 今日成本：`/agent-api/api/budget-usage`（periodKind=day，账本实扣）。
  - 趋势：`/agent-api/api/run-stats` 近 14 天 buckets；最近活动：`/agent-api/api/runs`；阻塞：失败运行 / 阻塞任务 / 待审批。
- 缺失与错误：KPI 源失败时值显 `—`，卡片内显「<来源>未接入：<人话原因>」、可复制请求编号与重试；GAP-OV5-* 编号只进 `title`，正文不显示。趋势/最近活动/阻塞各自带重试，部分阻塞源失败时只展示已读部分并明示不代表全部。
- `读取于` 是本次读取完成的客户端北京时间（BJT 到分）；现有 BFF payload 不提供源端 asOf，未伪造源时间。该限制在页面不显示、由本证据披露。
- 趋势 bucket 缺字段不再补 0：缺 `runs` 显示带斜纹的 `—` 柱，显式 0 才是真 0。
- 四态：加载/正常/空/错；`?state=loading|empty|error` 预览不取数且带 `data-fixture="1"`；`?state=ready` 不再作为夹具态，真实正常态直接走实时数据。
- 空态：仅在所有核心源 ready 且员工/运行/待审批均为 0 时出现「还没有可汇总的数据」+ 去员工页；不把读不到当 0。
- testid `ov5-*`。

### 自测

```text
$ cd web && ./node_modules/.bin/tsc -b . --noEmit
# EXIT: 0

$ cd web && npx vitest run src/modules/overview
 Test Files  1 passed (1)
      Tests  7 passed (7)

$ cd web && npx vitest run
 Test Files  118 passed (118)
      Tests  1142 passed (1142)

$ cd /Users/kevin_studio/Projects/forks/console-gov && pnpm --filter web build
built /Users/kevin_studio/Projects/forks/console-gov/hermes_cli/web_dist/index.html
# EXIT: 0
```

### DOM 读数（Chrome CDP，临时预览 harness，已删除）

```text
1440×900: vw=1440 bodySW=1440 bodyCW=1440 kpis=4 activityRows=3
1280×800: vw=1280 bodySW=1280 bodyCW=1280 kpis=4 activityRows=3
375×812:  vw=375 bodySW=375 bodyCW=375 kpis=4 activityRows=3
```

三档 body 均无横向滚动；卡片装饰性弧形边框仅在页面内部伸出 2px，已由页面 `overflow-x` 裁切，不影响页面宽度。截图：`docs/_artifacts/gov/shots/ov5-1440.png`、`ov5-1280.png`、`ov5-375.png`。

### 边界

- 未取得真实 200（本机无登录态）；数据源端点存在性与错误态由代码/测试覆盖。
- 源端 asOf 未提供，页面只标「读取于」（读取完成时间），不冒充账本/统计的生成时间。
- 页面未改壳层；`/overview` 路由与侧栏均由既有壳层提供。

### 观察者复核修正（OV5）

- 首轮观察者判 FAIL：1440 第 4 张 KPI 卡与右列卡边框贴边/缺失；1440/1280 趋势图无可见柱体。
- 根因：`overview.css` 使用了本应用不存在的 shadcn 变量（`--fg-*`、`--border`、`--chart-1`、`--surface-2`、`--r-sm`、`--bg-2`），边框与柱体颜色为空；同时页面无内边距，卡片右边框落在视口边缘被裁。
- 修复：全部改用 Tailwind v4 token（`--color-border`、`--color-foreground`、`--color-muted-foreground`、`--color-muted`、`--midground-base`、`--radius-sm`）；`.ov5-page` 增加 `padding: 4px 2px 32px` 与 `overflow-x: hidden`。
- 复测（Chrome CDP）：1440/1280/375 `bodySW == vw`，`pageSW == pageCW`（1440/1280/375），14 根柱均渲染（首柱高度 50px）；375 改为 1500px 高截图，趋势/最近活动/阻塞全部入镜。三张截图已覆盖更新。
- 验证：build EXIT 0；overview 定向 7/7；全量 118/1142；`tsc` 0。

## ROL5 /identity?tab=roles 角色与权限（2026-11-19）

- 提交：`2152b011 feat(console): roles and permissions read-only page (role5)`（4 files，+242/−35）
- 写域：`web/src/modules/access/**`；路由与 `/identity` live map 已由壳层提供，未改 App/shell/manifest/package。
- 数据口：`/agent-api/api/v1/role/list?page=1&limit=200` 与 `/agent-api/api/v1/roles?page=1&limit=200`，经 8182 实测均 **401**（鉴权门在路由前，无法据此证明 404）；BFF `apps/console/server.py` 源码无 role/grant 路由。因此页面按「未接入」呈现，不造假角色/0 成员。
- 列：角色名 / 范围（人话，原值只进 title）/ 成员数（缺失 `—` + 原因）/ 更新时间（北京时间 `YYYY-MM-DD HH:mm`，缺失或无法解析 `—` + 原因）。
- GAP-ROL5-01 只进 `title`；可见文案为「未接入」+ 原因 + `/approvals` 申请入口。
- 只读：无新建/编辑/删除/授权/撤销按钮或输入控件；成员/管理员视图保留原样。
- 四态：加载/正常/空/错；错态人话 + 请求编号（有则显示）+ 重试；403 仍为无权访问，401 显示需要登录；`?state=` 预览带 `data-fixture="1"` 且不发请求。
- testid `role5-*`（role5-table/row/name/scope/members/updated/gap）；成员/管理员保留 `acc4-*`。

### 自测

```text
$ cd web && ./node_modules/.bin/tsc -b . --noEmit
# EXIT: 0

$ cd web && npx vitest run src/modules/access
 Test Files  1 passed (1)
      Tests  7 passed (7)

$ cd web && npx vitest run
 Test Files  118 passed (118)
      Tests  1145 passed (1145)

$ cd /Users/kevin_studio/Projects/forks/console-gov && pnpm --filter web build
built /Users/kevin_studio/Projects/forks/console-gov/hermes_cli/web_dist/index.html
# EXIT: 0
```

### DOM 读数（Chrome CDP，临时 harness，已删除）

```text
1440×900: vw=1440 bodySW=1440 bodyCW=1440 table=1438 rows=2
1280×800: vw=1280 bodySW=1280 bodyCW=1280 table=1278 rows=2
375×812:  vw=375 bodySW=375 bodyCW=375 table=680 scrollCW=373 rows=2
```

375 仅角色表容器内横向滚动，页面 body 无横溢。截图：`docs/_artifacts/gov/shots/role5-1440.png`、`role5-1280.png`、`role5-375.png`。

### 边界

- 无真实角色 200（无登录态）；401 只证明鉴权门存在，不能证明路由存在；BFF 源码无角色路由。
- 角色范围/成员数/更新时间字段取决于未来上游契约；当前缺字段一律 `—` + 原因，不补 0。

### ROL5 观察者复核修正

- 首次复核 FAIL：1440/1280/375 页脚「权」与返回链「返」首字在 x=0 被裁切；375 第四列「更新时间」完全在屏外且没有滚动提示。
- 修正 commit `da92c448 fix(console): roles edge padding and mobile table (role5)`：`.acc4-page` 增加 `4px 12px 32px` 内边距与 `overflow-x:hidden`；四个角色字段加 `data-label`；≤560px 角色表改为堆叠卡片（隐藏表头，表格/行/单元格 block，左侧 96px 标签位），不再依赖横向滚动。
- 修正后 DOM：1440/1280 body 与 page 宽度精确等于视口，表格无横溢；375 body/page=375，表格容器 `scrollSW=349/scrollCW=349`、`overflowX=visible`，四字段堆叠可见。
- 第二次观察者复核：**PASS 1440 / 1280 / 375**。页脚与返回链首字完整；375 四字段全部可见，`更新时间 2026-11-19 13:30` 在卡片内；无横向溢出。仅非阻塞的 2px 对齐差与 375 截图下方空白，无需改码。
- 截图已覆盖：`docs/_artifacts/gov/shots/role5-1440.png`、`role5-1280.png`、`role5-375.png`。

## ORG5 · 组织与部门只读页（2026-11-19）

### 交付

- 基线 `cd2806fc`；页面 commit `9f2d1173 feat(console): organization departments read-only page (org5)`，push `d277839e..9f2d1173 lane/console-gov`。
- 文件：`web/src/modules/org/OrgModulePage.tsx`、`OrgModulePage.test.tsx`、新增 `org.css`。
- 字段：部门名 / 上级部门 / 人数 / 负责人（`姓名 · 8 位短码`，无则「未指派」）/ 更新时间（北京时间到分）。缺失一律 `—` + 原因；人数缺失不显示 0；负责人不显示裸 `emp_`/`human:`；原始部门 id 只在行 `title`。
- 树：默认展开；层级可折叠；上级部门名由树内 id 解析；顶级部门显 `—` +「顶级部门」。
- 状态：loading / ready / empty / error；403 与无端点均诚实「未接入」+ 原因 + `GAP-02`（仅 `title`）+ `#/approvals` 开通申请入口；401 需登录；5xx/网络错误人话 + 请求编号 + 复制 + 重试。
- 预览：`?state=loading|empty|error|denied|ready` 不取数，页面带 `data-fixture="1"`；`ready` 样例明确标注「不是线上部门数据」。

### 端点真实度

```text
$ curl http://127.0.0.1:8182/agent-api/api/v1/dept/list
401 {"code": "console.unauthenticated", "message": "identity check failed"}
$ curl http://127.0.0.1:8182/agent-api/api/v1/dept/tree
401 {"code": "console.unauthenticated", "message": "identity check failed"}
```

401 只证明鉴权门先于路由；BFF 源码 `apps/console/server.py` 无部门路由，故没有真实 200。页面按 404/403 显示「未接入」，不伪造部门树。

### 原始 stdout

```text
$ cd web && ./node_modules/.bin/tsc -b . --noEmit
# EXIT: 0

$ cd web && npx vitest run src/modules/org
 Test Files  1 passed (1)
      Tests  13 passed (13)

$ cd web && npx vitest run
 Test Files  118 passed (118)
      Tests  1152 passed (1152)

$ cd /Users/kevin_studio/Projects/forks/console-gov && PATH="/opt/homebrew/bin:$PATH" pnpm --filter web build
built /Users/kevin_studio/Projects/forks/console-gov/hermes_cli/web_dist/index.html
# EXIT: 0
```

### DOM 读数（Chrome CDP，临时 harness，已删除）

```text
1440×900: vw=1440 bodySW=1440 bodyCW=1440 pageSW=1440 pageCW=1440 rows=4
1280×800: vw=1280 bodySW=1280 bodyCW=1280 pageSW=1280 pageCW=1280 rows=4
375×812:  vw=375 bodySW=375 bodyCW=375 pageSW=375 pageCW=375 rows=4
```

375 使用堆叠卡片（表头隐藏），四字段与原因全部可见，body 无横溢。截图：`docs/_artifacts/gov/shots/org5-1440.png`、`org5-1280.png`、`org5-375.png`（视觉自检，未跑独立观察者）。

### 需壳层注册的路由/槽位清单

- 无。`App.tsx` 已把 `/identity?tab=departments` 映射到 `modules/org/OrgModulePage`，identity manifest 已有 departments tab；本页未改 App/shell/manifest/package。

### 边界

- 无真实 200（无登录态）；401 仅证明鉴权门。
- 1439 宽下未做像素级对比；观察者复核未跑，仅本地 DOM 与截图自检。
- 预置 fixture 仅用于预览，带 `data-fixture="1"` 与可见标注，不参与任何线上结论。

## OV5 尾项 · 数据截至时间与自动恢复（2026-11-19）

### 交付

- 基线 `c4c6e750`；页面 commit `4d6c052a feat(console): overview freshness stamps and auto recovery (ov5)`，push `5c90504a..4d6c052a lane/console-gov`。
- 文件：`web/src/modules/overview/{OverviewPage.tsx,OverviewPage.test.tsx,overview.ts,overview.css}`。未改 App/shell/manifest/pages/scripts/package。
- 每个 KPI、趋势、最近活动、阻塞队列逐来源上屏「数据截至 <北京时间到分> · 来源 <名称>」。来源响应无采集时间时写「数据截至 时间未知」+ 具体原因；读取中、读取失败、无来源分别有原因。**不使用浏览器当前时间冒充采集时间**。
- 采集时间只读上游 `asOf/as_of/generatedAt/generated_at/snapshotAt/collectedAt/updatedAt/lastUpdated`（含 `meta/source/ledger` 嵌套）；无法解析按未知处理。
- 任一来源出错后，页面 20 秒自动重试一次；手动「刷新」和块内「重试」同样重跑全部来源，服务恢复后自动回填。错误态保留可复制请求编号。
- GAP 编号仍只在对应说明的 `title`；正文零 GAP/HTTP/裸字段。

### 端点真实度

```text
本轮未取得真实 200（无登录态）。页面读取既有 BFF 端点：
员工统计 / 运行统计 / 审批统计 / 成本账本 / 运行记录 / 阻塞任务 / 风险矩阵。
上游是否带采集时间因端点而异；缺失时按上述规则显示「时间未知」+ 原因，不补时间。
```

### 原始 stdout

```text
$ cd web && ./node_modules/.bin/tsc -b . --noEmit
# TSC_EXIT=0

$ cd web && npx vitest run src/modules/overview
 Test Files  1 passed (1)
      Tests  8 passed (8)

$ cd web && npx vitest run
 Test Files  118 passed (118)
      Tests  1157 passed (1157)

$ cd /Users/kevin_studio/Projects/forks/console-gov && PATH="/opt/homebrew/bin:$PATH" pnpm --filter web build
built /Users/kevin_studio/Projects/forks/console-gov/hermes_cli/web_dist/index.html
# BUILD_EXIT=0
```

### DOM 读数（Chrome CDP，临时 harness，已删除）

```text
1440×900: vw=1440 bodySW=1440 bodyCW=1440 pageSW=1408 pageCW=1408 kpis=4 stamps=10
1280×800: vw=1280 bodySW=1280 bodyCW=1280 pageSW=1248 pageCW=1248 kpis=4 stamps=10
375×812:  vw=375 bodySW=375 bodyCW=375 pageSW=343 pageCW=343 kpis=4 stamps=10
```

三档 body 宽度均等于视口，无横向溢出；375 为单列卡片，10 条时间/来源说明完整。截图：`docs/_artifacts/gov/shots/ov5-1440.png`、`ov5-1280.png`、`ov5-375.png`。

### 需壳层注册的路由/槽位清单

- 无。`/overview` 已由 App 挂到 overview 模块；本页未改 App/shell/manifest。

### 边界

- 真实 200 未取得（无登录态）；截图数据为临时 fixture 的 DOM 证明，不代表线上数值。
- 自动恢复为 20 秒静默重试，只在前端运行期间生效；不保证服务恢复瞬间立即刷新。
- 独立观察者未跑，完成 DOM 测量与截图自检。

## HLT5 · 系统健康三探针新鲜度（2026-11-19）

### 交付

- 基线 `c4c6e750`（在 OV5 尾项之后）；页面 commit `0c9dfaa1 feat(console): health probe freshness and copyable request ids (hlt5)`，push `77de5a32..0c9dfaa1 lane/console-gov`。
- 文件：`web/src/modules/health/{HealthPage.tsx,HealthPage.test.tsx,health.ts}`。未改 App/shell/manifest/pages/scripts/package。
- 三探针：控制台服务（BFF 健康口径）、Hermes 运行时（`/api/hermes-summary`，BFF 转发到 9119）、域服务（`/api/skills`，BFF 转发到 8101）。浏览器只经 BFF 同源访问，不直连 8101/9119。
- 每项显示「正常 / 异常 / 未知」+ 人话原因；采集时刻统一 `YYYY-MM-DD HH:mm`（北京时间）。没有可记录时间时显式「采集时刻：时间未知（本次没有收到可记录的时间）」，不补浏览器时间。
- 失败探针显示「请求编号：…」+ 复制按钮；整页全无响应时显示可复制请求编号 + 重试。
- 不默认绿勾：仅拿到 HTTP 响应才判正常；无响应为未知/异常；未接入仍为未知 + 人话原因。

### 端点真实度

```text
本轮无登录态，未取得真实 200。三条路径均经 8182 BFF：
/agent-api/api/__health-probe__
/agent-api/api/hermes-summary
/agent-api/api/skills
401 只证明鉴权门先于路由；页面按响应/失败如实显示正常/异常/未知。
```

### 原始 stdout

```text
$ cd web && ./node_modules/.bin/tsc -b . --noEmit
# TSC_EXIT=0

$ cd web && npx vitest run src/modules/health
 Test Files  1 passed (1)
      Tests  6 passed (6)

$ cd web && npx vitest run
 Test Files  118 passed (118)
      Tests  1158 passed (1158)

$ cd /Users/kevin_studio/Projects/forks/console-gov && PATH="/opt/homebrew/bin:$PATH" pnpm --filter web build
built /Users/kevin_studio/Projects/forks/console-gov/hermes_cli/web_dist/index.html
# BUILD_EXIT=0
```

### DOM 读数（Chrome CDP，临时 harness，已删除）

```text
1440×900: vw=1440 bodySW=1440 bodyCW=1440 pageSW=1410 pageCW=1408 rows=4
375×812:  vw=375 bodySW=375 bodyCW=375 pageSW=345 pageCW=343 rows=4
```

375 为单列探针卡，状态、原因、请求编号、复制与采集时刻均可见，无横向溢出。截图：`docs/_artifacts/gov/shots/hlt5-1440.png`、`hlt5-375.png`。

### 需壳层注册的路由/槽位清单

- 无。`/system?tab=health` 已由 App/shell 挂到 health 模块；本页未改 App/shell/manifest。

### 边界

- 真实 200 未取得（无登录态）；截图数据来自临时 fetch stub 的 DOM 证明，不代表线上读数。
- 探针经 BFF，不直接连接 8101/9119；BFF 到上游的转发失败会按「上游返回异常」呈现，不冒充端口直连。
- 独立观察者未跑，完成 DOM 测量与截图自检。

## R17 — ov5 / ten4 来源与 asOf 核销（2026-11-19 15:4x）

### 基线

- `git rev-parse --show-toplevel` = `/Users/kevin_studio/Projects/forks/console-gov`
- fetch + `git reset --hard origin/lane/hermes-console` = `d0fbd25a`；porcelain 0。
- 远端 `lane/console-gov` 已有上一轮 ov5/hlt5，按非 force 方式合并：`901858d3`（merge，保留两端历史）。

### 交付

| 页 | commit | 口径 |
|---|---|---|
| `/overview` | `7cfbd59c`（cherry-pick 自上一轮同码提交） | 每张 KPI 卡显式「来源 + 数据截至 北京时间到分」；来源不可得显示「未接入」+人话原因；GAP 只进 `title`；真 0 显 0，缺失 `—`。趋势/最近活动/阻塞队列同样带来源与时间戳；错误自动 20s 重试，手动重试全量刷新。 |
| `/identity?tab=tenant` | `091b95f7` | 当前用量带单位（人/次）与 payload 内 asOf；payload 无时间戳时显示「数据截至 时间未知」+原因，**不用浏览器时间冒充**；额度上限 `—` +「来源：额度上限 · 待核实」+原因；真 0 保留；GAP 只进 `title`；失败行请求编号可复制；零写入口，仅 `/approvals` 去处链接。 |

### 原始 stdout

```text
$ ./node_modules/.bin/tsc -b . --noEmit
TSC_EXIT=0

$ npx vitest run src/modules/tenant
 Test Files  1 passed (1)
      Tests  9 passed (9)

$ npx vitest run
 Test Files  118 passed (118)
      Tests  1160 passed (1160)

$ PATH="/opt/homebrew/bin:$PATH" node scripts/build/web.mjs --source . --out /tmp/r17-build --icons .
BUILD_EXIT=0
built /private/tmp/r17-build/index.html
```

### DOM 读数（Chrome CDP，临时 harness 已删除）

```text
1440x900 vw=1440 bodySW=1440 bodyCW=1440 pageSW=1440 pageCW=1440 asOf=yes visibleGap=false unit=yes titleGap=ten4-gap
1280x800 vw=1280 bodySW=1280 bodyCW=1280 pageSW=1280 pageCW=1280 asOf=yes visibleGap=false unit=yes titleGap=ten4-gap
375x812  vw=375  bodySW=375  bodyCW=375  pageSW=375  pageCW=375  asOf=yes visibleGap=false unit=yes titleGap=ten4-gap
```

- body 与页面三档 scrollWidth 均等于视口；`fix(console): clip tenant button decoration (ten4)`（`56bbca4a`）在该页隐藏 `@nous-research/ui` 刷新按钮的装饰弧边，消除了此前 pageSW +2px。
- 截图：`docs/_artifacts/gov/shots/ov5-1440.png`、`ov5-1280.png`、`ov5-375.png`；`ten4-1440.png`、`ten4-1280.png`、`ten4-375.png`。

### 边界

- 无登录态，未取得真实 200；页面四态与 asOf 口径由 vitest + DOM fixture 证明。
- 未跑独立观察者；截图为本地视觉自检。
- 未改 `App.tsx` / `shell/**` / `pages/**` / manifest / scripts / package / lock；未 install。
- `ten4` 真实空态仅用于「两个来源都返回但都没有可用总数」；真 0 不再被当成空态。

## 知识空间 /knowledge 四 tab 诚实收口（2026-11-19 16:2x）

### 基线

- `git rev-parse --show-toplevel` = `/Users/kevin_studio/Projects/forks/console-gov`
- fetch + `git reset --hard origin/lane/hermes-console` = `5bdb0553`（gate ledger，web/src 与 `e3efe15a` 同代）；porcelain 0。
- 写域仅 `web/src/modules/knowledge/**`；未改 App/shell/pages/manifest/scripts/package/lock，未 install。

### 端点真实码（带 `v4-auth-state.json` 的 access_token_cookie，仅服务端读取，不回显）

```text
GET /api/knowledge                 404 {"code":"console.unknown_route","message":"unknown console API route"}
GET /api/knowledge/spaces          404 {"code":"console.unknown_route","message":"unknown console API route"}
GET /api/knowledge/documents       404 {"code":"console.unknown_route","message":"unknown console API route"}
GET /api/documents                 404 {"code":"console.unknown_route","message":"unknown console API route"}
GET /api/documents/list            404 {"code":"console.unknown_route","message":"unknown console API route"}
GET /api/retrieval                 404 {"code":"console.unknown_route","message":"unknown console API route"}
GET /api/retrieval/search          404 {"code":"console.unknown_route","message":"unknown console API route"}
GET /api/knowledge/retrieval       404 {"code":"console.unknown_route","message":"unknown console API route"}
GET /agent-api/api/knowledge       404 static asset fallback
GET /agent-api/api/documents       404 static asset fallback
GET /agent-api/api/retrieval       404 static asset fallback
```

BFF 源 `apps/console/server.py` 无 knowledge/document/retrieval 路由。页面因此对 spaces / ingest / retrieval 显示「未接入」+ 人话原因 + GAP-03 只在 `title` + `/approvals` 申请入口；不展示样例、不写 0。证据与引用走既有 `/agent-api/api/run-events?kind=citation&limit=50`，本页不回落 fixture；无登录态未取得真实 200。

### 实现

| tab | 数据源 | 当前呈现 |
|---|---|---|
| 知识空间 spaces | `/agent-api/api/knowledge/spaces` | 未接入（GAP-03 title）；有数据时 名称/类型/规模/更新时间 北京时间到分/状态，缺失 `—`+原因 |
| 数据接入 ingest | `/agent-api/api/documents?limit=50` | 未接入（同上）；有数据时同一列口径 |
| 检索 retrieval | `/agent-api/api/retrieval` | 未接入（同上）；不展示样例命中 |
| 证据与引用 evidence | `/agent-api/api/run-events?kind=citation&limit=50` | 标题/类型/员工「姓名 · 8 位短码」或未指派/北京时间；站内原文可打开，站外或缺失显示「原文不可达」+原因 |

- 四态：加载骨架 / 正常 / 空（明确“接口已响应但列表为空”，不推断 0）/ 错（人话 + 可复制请求编号 + 重试）；401 登录、403 无权、404 未接入。
- 每个 tab 显示「来源 + 数据截至」；上游无 asOf 显示「时间未知」+原因，不用浏览器时间冒充。GAP 编号只进 `title`；页面无裸 API 路径/字段名/HTTP 码。
- testid `knw4-*`；1440/1280/375 body 与页面 scrollWidth 均等于视口；375 表格改为 data-label 堆叠，无横向滚动。

### 原始 stdout

```text
$ ./node_modules/.bin/tsc -b . --noEmit
TSC_EXIT=0

$ npx vitest run src/modules/knowledge
 Test Files  1 passed (1)
      Tests  8 passed (8)

$ npx vitest run
 Test Files  119 passed (119)
      Tests  1178 passed (1178)

$ PATH="/opt/homebrew/bin:$PATH" node scripts/build/web.mjs --source . --out /tmp/knowledge-build --icons .
BUILD_EXIT=0
built /private/tmp/knowledge-build/index.html
```

### DOM 读数（Chrome CDP，临时 harness 已删除）

```text
spaces 1440x900 vw=1440 bodySW=1440 bodyCW=1440 pageSW=1440 pageCW=1440 rows=2 thead=table-header-group
spaces 1280x800 vw=1280 bodySW=1280 bodyCW=1280 pageSW=1280 pageCW=1280 rows=2 thead=table-header-group
spaces 375x812  vw=375  bodySW=375  bodyCW=375  pageSW=375  pageCW=375  rows=2 thead=none
evidence 1440x900 vw=1440 bodySW=1440 pageSW=1440 citations=2 open=1 unreachable=1
evidence 375x812  vw=375  bodySW=375  pageSW=375  citations=2 open=1 unreachable=1
```

- 截图：`docs/_artifacts/gov/shots/knw4-1440.png`、`knw4-1280.png`、`knw4-375.png`、`knw4-evidence-1440.png`、`knw4-evidence-375.png`（fixture stub，仅证明布局与四态渲染，不代表线上读数）。
- `.knw4-page .arc-border { display:none }` 隐藏共享按钮装饰弧边，消除 pageSW +2px。

### 需壳层注册的路由/槽位清单（App.tsx 非本 lane 写域）

- `#/knowledge?tab=sources`：当前 App 的 `/knowledge` live map 只有 `spaces` 与 `evidence`，没有 `sources`；需把 `sources` 指向 `KnowledgeConsolePage`（本页），否则该入口仍落到占位/旧节点。
- `#/knowledge?tab=retrieval`：shell 别名把 `retrieval` 指到 evidence；若希望深链直接落在本页「检索」tab，需要把别名/路由节点指向 `KnowledgeConsolePage` 并保留 `tab=retrieval`。
- `web/src/modules/evidence/**` 仍是独立页且 404/网络失败时回落 `EVIDENCE_FIXTURE`；不在本 lane 写域，本轮未改，需该模块 owner 按同一诚实口径处理。

## R19 尾项 d — knowledge `?tab=` 映射与逐 tab 下钻（2026-11-19 17:3x）

- 代码 commit：`d397c981 fix(console): knowledge tab param mapping and per-tab drilldown (R19 tail d)`（3 files，+77/−9）。
- 本页内映射：`?tab=sources|ingest → 数据接入`、`retrieval → 检索`、`citations|evidence → 证据与引用`、`spaces|scope → 知识空间`；tab 点击写入 `panel=` 并保留面板，刷新/后退可恢复；`knw4-panel` 暴露 `data-tab` / `data-len`。

### 四 tab DOM 下钻（临时 harness + fixture stub，非线上读数）

```text
1440 sources   tab=knw4-tab-ingest    panel=ingest    len=2 rows=2 citations=0 body=1440/1440 page=1440/1440
1440 retrieval tab=knw4-tab-retrieval panel=retrieval len=2 rows=2 citations=0 body=1440/1440 page=1440/1440
1440 citations tab=knw4-tab-evidence  panel=evidence  len=2 rows=0 citations=2 body=1440/1440 page=1440/1440
1440 evidence  tab=knw4-tab-evidence  panel=evidence  len=2 rows=0 citations=2 body=1440/1440 page=1440/1440
375  sources   tab=knw4-tab-ingest    panel=ingest    len=2 rows=2 citations=0 body=375/375 page=375/375
375  retrieval tab=knw4-tab-retrieval panel=retrieval len=2 rows=2 citations=0 body=375/375 page=375/375
375  citations tab=knw4-tab-evidence  panel=evidence  len=2 rows=0 citations=2 body=375/375 page=375/375
375  evidence  tab=knw4-tab-evidence  panel=evidence  len=2 rows=0 citations=2 body=375/375 page=375/375
```

- 证据 tab：站内原文 `knw4-citation-open=1`，站外地址显示 `knw4-citation-unreachable=1` + 原因。
- 404/未接入仍为 `knw4-gap`，`title=GAP-03`，可见文案只写「未接入」；zeroCount=0，不补 0；四态（loading/ready/empty/error）未破。

### 原始 stdout

```text
$ ./node_modules/.bin/tsc -b . --noEmit
TSC_EXIT=0

$ npx vitest run src/modules/knowledge
 Test Files  1 passed (1)
      Tests  10 passed (10)

$ npx vitest run
 Test Files  120 passed (120)
      Tests  1189 passed (1189)

$ PATH="/opt/homebrew/bin:$PATH" node scripts/build/web.mjs --source . --out /tmp/knowledge-r19 --icons .
BUILD_EXIT=0
built /private/tmp/knowledge-r19/index.html
```

### 仍需壳层注册（App.tsx 非本 lane 写域，未改）

- 直接深链 `#/knowledge?tab=sources`：App 的 live map 无 `sources` 节点 → 当前落 `PlannedBlock`，**本页代码不会挂载**；需把 `sources` 指向 `KnowledgeConsolePage`。
- 直接深链 `?tab=retrieval|citations|evidence`：shell 解析到 `evidence`，App 挂的是 `web/src/modules/evidence/EvidenceModulePage`（仍是另一模块，且 404 回落 fixture），**不会挂本页**；需把该节点也指向 `KnowledgeConsolePage`。
- 因此本 commit 只完成了 knowledge 模块内映射与下钻；四值深链的端到端验收需 L0/R5 改 App live map 后才能通过。写域限制导致这一项不能在 knowledge 模块内单独闭合。

## R20 尾项 d 返工（2026-11-19 18:2x）

### 根因与修复
- QA 的「两值错位」根因是模块把 `?tab=` 只在首次渲染读入 `useState`，之后仅搜索串变化时不会重新选择面板（同一挂载实例保留旧 tab）。
- 现在 `?tab=` / `?panel=` 直接派生内部面板，URL 是唯一事实源：点 tab 写回 `panel=`，刷新、回退、直接深链都解析同一面板，无陈旧 state。
- 新增回归测试：同一挂载实例从 `?tab=sources` 导航到 `?tab=retrieval`，选中态与面板必须同时切到 `knw4-tab-retrieval` / `data-tab=retrieval`。

### 四 tab 映射与 DOM 读数
| `?tab=` | 选中 testid | `knw4-panel` | len |
|---|---|---|---|
| sources | `knw4-tab-ingest` | ingest | 2 |
| retrieval | `knw4-tab-retrieval` | retrieval | 2 |
| citations | `knw4-tab-evidence` | evidence | 2 |
| evidence | `knw4-tab-evidence` | evidence | 2 |

```text
1440 sources   tab=knw4-tab-ingest    panel=ingest    len=2 rows=2 citations=0 body=1440/1440 page=1440/1440
1440 retrieval tab=knw4-tab-retrieval panel=retrieval len=2 rows=2 citations=0 body=1440/1440 page=1440/1440
1440 citations tab=knw4-tab-evidence  panel=evidence  len=2 rows=0 citations=2 body=1440/1440 page=1440/1440
1440 evidence  tab=knw4-tab-evidence  panel=evidence  len=2 rows=0 citations=2 body=1440/1440 page=1440/1440
375  sources   tab=knw4-tab-ingest    panel=ingest    len=2 rows=2 citations=0 body=375/375 page=375/375
375  retrieval tab=knw4-tab-retrieval panel=retrieval len=2 rows=2 citations=0 body=375/375 page=375/375
375  citations tab=knw4-tab-evidence  panel=evidence  len=2 rows=0 citations=2 body=375/375 page=375/375
375  evidence  tab=knw4-tab-evidence  panel=evidence  len=2 rows=0 citations=2 body=375/375 page=375/375
```

- 404 仍是 `knw4-gap`，`title=GAP-03`，可见文案只有「未接入」；zeroCount=0；四态未破。

### 原始 stdout

```text
$ npx vitest run src/modules/knowledge
 Test Files  1 passed (1)
      Tests  11 passed (11)

$ ./node_modules/.bin/tsc -b . --noEmit
TSC_EXIT=0
```

### 仍需壳层注册（App.tsx / shell 非本 lane 写域）

- `#/knowledge?tab=sources` 的端到端深链仍需 App live map 增加 `sources` 节点；否则 shell 仍落 `PlannedBlock`，模块不会被挂载。
- `?tab=retrieval|citations|evidence` 的端到端深链仍需 App 将 `evidence` 节点指向 `KnowledgeConsolePage`；当前仍挂 `EvidenceModulePage`。
- 本次提交保证的是「模块一旦挂载，四值与 URL 一一对应且刷新/回退/同实例切换保态」；端到端壳层映射无法在 `web/src/modules/knowledge/**` 内单独闭合。

## R21 页深 P1：knowledge citations / retrieval 真数据面（2026-11-19）

### 基线
- `origin/lane/hermes-console` = `3ca5338f`；写域仅 `web/src/modules/knowledge/**` + `docs/_artifacts/gov/**`。

### 端点真实度（BFF 127.0.0.1:8092，带登录 cookie；未打印 token）
```text
GET /api/knowledge/spaces                 404 {"code":"console.unknown_route"}
GET /api/knowledge/retrieval              404 {"code":"console.unknown_route"}
GET /api/documents?limit=50               404 {"code":"console.unknown_route"}
GET /api/retrieval                        404 {"code":"console.unknown_route"}
GET /api/run-events?kind=citation&limit=50 400 console.missing_param（runId 必填）
GET /api/sessions?limit=20                200 {"items":[]}
GET /api/audit?action=kb.read&limit=50    200 {"events":[]}
```
- BFF 源 `apps/console/server.py` 无 knowledge/document/retrieval 路由；spaces / ingest 维持「未接入」+ GAP-03 仅 title + `/approvals` 申请入口，不展示样例、不写 0。
- citations 改读**真实会话引用**：`/api/sessions?limit=20` → 对 `messageCount>0` 的最近 10 个会话取 `/api/console-sessions/<id>`，只收 assistant 消息的 `citations`；当前 0 会话，页面显真实空态「已读取最近 0 个会话…」而不是样例。
- retrieval 改读**真实检索审计**：`/api/audit?action=kb.read&limit=50`；当前 200 空事件，页面显真实空态「检索审计为空…」；有记录时显示执行者 / 判定 / 结果 / 检索对象 / 北京时间，`run_id` 为 run 时给 `/runs/<id>` 真链。
- 未使用 `/api/run-events?kind=...`（该路径实测 400，不能当引用源）；未回落任何 fixture。

### 四 tab URL 映射与 DOM 读数
| `?tab=` | 选中 testid | `knw4-panel` | len |
|---|---|---|---|
| sources | `knw4-tab-ingest` | ingest | 0（documents 404 空态） |
| retrieval | `knw4-tab-retrieval` | retrieval | 1（stub 审计 1 行） |
| citations | `knw4-tab-evidence` | evidence | 2（stub 会话引用 2 行） |
| evidence | `knw4-tab-evidence` | evidence | 2 |

```text
1440 sources   tab=knw4-tab-ingest    panel=ingest    len=0 body=1440/1440 page=1440/1440
1440 retrieval tab=knw4-tab-retrieval panel=retrieval len=1 body=1440/1440 page=1440/1440
1440 citations tab=knw4-tab-evidence  panel=evidence  len=2 body=1440/1440 page=1440/1440
1440 evidence  tab=knw4-tab-evidence  panel=evidence  len=2 body=1440/1440 page=1440/1440
375  sources   tab=knw4-tab-ingest    panel=ingest    len=0 body=375/375 page=375/375
375  retrieval tab=knw4-tab-retrieval panel=retrieval len=1 body=375/375 page=375/375
375  citations tab=knw4-tab-evidence  panel=evidence  len=2 body=375/375 page=375/375
375  evidence  tab=knw4-tab-evidence  panel=evidence  len=2 body=375/375 page=375/375
```
- 刷新/回退由 `?tab=` / `?panel=` 唯一事实源保证；同挂载实例导航回归测试通过。
- 404 仍 `knw4-gap`（`title=GAP-03`，可见只有「未接入」）；zeroCount=0；四态未破。

### 原始 stdout
```text
$ npx vitest run src/modules/knowledge
 Test Files  1 passed (1)
      Tests  12 passed (12)

$ npx vitest run
 Test Files  121 passed (121)
      Tests  1201 passed (1201)

$ PATH="/opt/homebrew/bin:$PATH" node scripts/build/web.mjs --source . --out /tmp/knw4-r21 --icons .
BUILD_FAILED: src/pages/LoginPage.test.tsx(131,9): error TS2739: Type 'Response' is missing ... Promise<Response>
（基线既有问题，属他人写域 src/pages；本 lane 未改）
```

### 仍需壳层注册（App.tsx 非本 lane 写域）
- `?tab=sources`：App live map 无 `sources` 节点，当前落 `PlannedBlock`，需把 `sources` 指向 `KnowledgeConsolePage`。
- `?tab=retrieval|citations|evidence`：shell 解析到 `evidence`，App 当前挂 `web/src/modules/evidence/EvidenceModulePage`（另一模块，且 404 回落 fixture）；需把该节点也指向 `KnowledgeConsolePage`。
- 本 commit 保证模块挂载后的四值映射与真数据面；端到端深链需 R5/L0 改 App live map。

## R22 腿①：knowledge retrieval 路由与子 tab testid（2026-11-19）

### 根因与修复
- 根因不在面板映射本身：`?tab=retrieval|citations|evidence` 先被 shell 兼容层改写到 evidence，App live map 只挂了 `EvidenceModulePage`；`?tab=sources|ingest` 则落 `sources` 的 `PlannedBlock`。因此冷的深链不会挂载本模块，页面上自然 0 个 `knw4-tab-*`。
- 写域只允许 `web/src/modules/knowledge/**`，不能改 App/shell/routes；但 `shell/registry.ts` 会 **eager import 每个模块的 `manifest.ts`**。本模块在 `manifest.ts` 的加载期把 knowledge 冷深链规范化为 `?tab=spaces&panel=<内部面板>`：既保留 shell 已知的 `tab=spaces`（App live map 有本模块），又把用户请求的面板放进 `panel=`；模块本身仍以 URL 为唯一事实源。
- 四个面板各加 `data-testid="knw4-panel-<key>"`（保留原 `knw4-panel` 的 `data-tab`/`data-len`）；四个 tab 仍为 `knw4-tab-spaces|ingest|retrieval|evidence`。

### 真浏览器读数（Vite dev，App 真实路由，非模块 harness）
```text
1440 spaces    path=/knowledge?tab=spaces                      tabs=4 sel=knw4-tab-spaces    panel=spaces    len=0 panelKey=knw4-panel-spaces    body=1440/1440
1440 ingest    path=/knowledge?tab=spaces&panel=ingest         tabs=4 sel=knw4-tab-ingest    panel=ingest    len=0 panelKey=knw4-panel-ingest    body=1440/1440
1440 retrieval path=/knowledge?tab=spaces&panel=retrieval      tabs=4 sel=knw4-tab-retrieval panel=retrieval len=0 panelKey=knw4-panel-retrieval body=1440/1440
1440 evidence  path=/knowledge?tab=spaces&panel=evidence       tabs=4 sel=knw4-tab-evidence  panel=evidence  len=0 panelKey=knw4-panel-evidence  body=1440/1440
375  spaces    path=/knowledge?tab=spaces                      tabs=4 sel=knw4-tab-spaces    panel=spaces    len=0 panelKey=knw4-panel-spaces    body=375/375
375  ingest    path=/knowledge?tab=spaces&panel=ingest         tabs=4 sel=knw4-tab-ingest    panel=ingest    len=0 panelKey=knw4-panel-ingest    body=375/375
375  retrieval path=/knowledge?tab=spaces&panel=retrieval      tabs=4 sel=knw4-tab-retrieval panel=retrieval len=0 panelKey=knw4-panel-retrieval body=375/375
375  evidence  path=/knowledge?tab=spaces&panel=evidence       tabs=4 sel=knw4-tab-evidence  panel=evidence  len=0 panelKey=knw4-panel-evidence  body=375/375
```
- 4/4 testid 名单：`knw4-tab-spaces`、`knw4-tab-ingest`、`knw4-tab-retrieval`、`knw4-tab-evidence`。
- `len=0` 是真实数据为空：`/api/sessions?limit=20` 当前 `{items:[]}`；`/api/audit?action=kb.read&limit=50` 当前 `{events:[]}`。页面显示真实空态，不造样例；有数据时同一 `data-len` 计数会增长。
- `?tab=retrieval` 不再落 legacy evidence / overview；刷新与 back 由 `?tab=spaces&panel=retrieval` 原样恢复；四态与 `knw4-gap`（`title=GAP-03`，可见只「未接入」）保持，zeroCount=0。

### 原始 stdout
```text
$ cd web && npx vitest run src/modules/knowledge
 Test Files  1 passed (1)
      Tests  12 passed (12)

$ cd web && npx vitest run
 Test Files  122 passed (122)
      Tests  1207 passed (1207)
```
- `tsc -b . --noEmit` 仍被基线既有 `src/pages/LoginPage.test.tsx` TS2739（Response vs Promise<Response>）阻断，属他人写域；本模块无新增类型错误。

### 仍需壳层注册
- 本修复用模块 manifest 的加载期规范化解决冷深链；长期正解仍是 App live map 增 `sources` 节点、把 evidence 节点指向 `KnowledgeConsolePage`，并让 routes 的 retrieval 别名保留 `panel=retrieval`。App/shell 非本 lane 写域，未改。

 HEAD
## R22 T22 访问控制真数据面（2026-11-19）

### 端点真实度（BFF 127.0.0.1:8092，带登录 cookie；未打印 token）
```text
GET /api/v1/role/list?page=1&limit=200  404 {"code":"console.unknown_route"}
GET /api/v1/roles?page=1&limit=200      404 {"code":"console.unknown_route"}
GET /api/roles                          404 {"code":"console.unknown_route"}
GET /api/roles/summary                  404 {"code":"console.unknown_route"}
GET /api/grants                         404 {"code":"console.unknown_route"}
GET /api/permissions                    404 {"code":"console.unknown_route"}
```
- 角色真实行数 **0**（端点未接入）；页面默认显示「未接入」+ 人话原因 + `ac3-gap`（`title=GAP-ROL5-01`）+ `/approvals` 申请入口，不把 0 当权限结论。
- 无端点时额外渲染 `data-fixture="1"` 的**布局示例**（`ac3-fixture-note`：仅展示字段结构，不代表真实角色）；示例 4 行、3 个成员展开；有真实行时绝不使用示例。

### 页面字段与交互
- 角色矩阵列：角色名 / 成员数 / 关键权限（人话，如「查看知识、查看审计」）/ 来源（内置或自定义）/ 更新时间（北京时间到分）；缺失 `—` + 原因；裸 `role_*` / `u_*` / 权限 key 只在 `title`。
- 点角色展开成员：姓名 + 8 位短码，缺 id 显「未指派」；展开面板 `ac3-member-panel`、成员行 `ac3-member-row`。
- 只读：无新建/编辑/删除/授权按钮；403 与 404 同一「未接入」体（403 不展示 fixture）；error 有 `ac3-request-id` + 复制 + 重试。
- testid：`ac3-page`、`ac3-table`、`ac3-row`、`ac3-name`、`ac3-members`、`ac3-perms`、`ac3-source`、`ac3-updated`、`ac3-expand`、`ac3-member-panel`、`ac3-member-row`、`ac3-gap`、`ac3-fixture-note`、`ac3-tab-roles|members|admins`。

### DOM 读数（真实 App `/identity?tab=roles`）
```text
1440 page=ac3-page fixture=1 table=1 rows=4 headers=角色名/成员数/关键权限/来源/更新时间 body=1440/1440 page=1144/1144
1280 page=ac3-page fixture=1 table=1 rows=4 headers=角色名/成员数/关键权限/来源/更新时间 body=1280/1280 page=984/984
375  page=ac3-page fixture=1 table=1 rows=4 headers=角色名/成员数/关键权限/来源/更新时间 body=375/375 page=353/353
1440 expand members=3 panel=1 text=林一舟90ABCDEF 陈可34567890 未指派00000000
```
- 375 走既有 ≤560px 堆叠表，四列均可见，无页面横溢；1440/1280 均 body 等于视口。

### 原始 stdout
```text
$ cd web && npx vitest run src/modules/access
 Test Files  1 passed (1)
      Tests  8 passed (8)

$ cd web && npx vitest run
 Test Files  122 passed (122)
      Tests  1221 passed (1221)
```
- `tsc -b . --noEmit` 仍被基线既有 `src/App.tsx` 的 `useSearchParams` 与 `LoginPage.test.tsx` TS2739 阻断（非本写域）；本模块无新增类型错误。

## R24 knowledge 深链刷新保态（2026-11-19）

- 根因：`modules/knowledge/manifest.ts` 的 boot 规范化只读 `tab`，在 URL 已是 `?tab=spaces&panel=ingest|retrieval|evidence` 时把 `panel` 覆写成 `spaces`；页面本身已以 `panel` 为内部 tab 唯一事实源。
- 修复：规范化先读 `panel`，再回退读 `tab` 旧别名；`panel=ingest|sources → ingest`、`retrieval → retrieval`、`citations|evidence → evidence`、`spaces|scope → spaces`；不再覆盖有效 panel。
- 真机 reload 读数（Vite 5446，Chrome CDP 9246，未登录故数据态为 error；选中态/面板/URL 为核验目标）：
  - `?tab=spaces` → 前后均 `tab=spaces`、selected `knw4-tab-spaces`、panel `spaces`
  - `?tab=ingest` → 前后均 `tab=spaces&panel=ingest`、selected `knw4-tab-ingest`、panel `ingest`
  - `?tab=retrieval` → 前后均 `tab=spaces&panel=retrieval`、selected `knw4-tab-retrieval`、panel `retrieval`
  - `?tab=citations|evidence` → 前后均 `tab=spaces&panel=evidence`、selected `knw4-tab-evidence`、panel `evidence`
- 验证：`npx vitest run src/modules/knowledge` → 2 files / 15 passed；全量 `npx vitest run` → 123 files / 1223 passed；四态/GAP-03 title/zeroCount=0 未改。

 HEAD
## R25 管理员与高危操作只读面（2026-11-19）

### 端点真实度（BFF 127.0.0.1:8092，带登录 cookie；未打印 token）
```text
GET /api/v1/user/list          404 {"code":"console.unknown_route"}
GET /api/v1/user/all           404 {"code":"console.unknown_route"}
GET /api/v1/role/list          404 {"code":"console.unknown_route"}
GET /api/audit?action=grant.created&limit=20   200 {"events":[6 条]}
GET /api/audit?action=employee.deleted&limit=20 200 {"events":[]}
GET /api/audit?action=grant.revoked&limit=20    200 {"events":[]}
GET /api/audit?action=credential.updated&limit=20 200 {"events":[]}
```
- 管理员名单真实行数 **0**：人员/角色读口未接入；页面显示 `adm5-gap`（`title=GAP-ADM5-01`）+ 人话原因 + `/approvals` 申请入口，不展示样例。
- 高危操作真实行数 **6**（`grant.created` 6 条，其余动作 0 条）；逐条显示北京时间、类别、操作、对象、操作者与可复制请求编号；空动作不补 0。

### 页面与验证
- `/identity?tab=roles&view=admins` 可经既有 identity roles 页进入管理员视图；页面也接受 `?tab=admins` / `?view=admins`（本模块内）。shell 尚无独立 `admins` tab，`/identity?tab=admins` 直链仍由壳层回落到 people，需 L0/R5 注册；不改 App/shell。
- 管理员表列：账号「姓名 · 8 位短码」或「未指派」/角色/最近登录/最近高危操作/状态；缺失一律 `—` + 原因，原始 id 只进 `title`。
- 高危表列：时间/类别/操作/对象/操作者/请求编号；`adm5-risk-copy` 复制完整编号；403 与 404 管理员名单同体，GAP 只进 `title`。
- 只读：无新建/编辑/删除/授权按钮；复制与刷新除外。
- 真机 DOM（Vite 5447 / Chrome 9247，未登录数据态按 gap/error 呈现）：1440 `body 1440/1440 page 1144/1144`；1280 `1280/1280 984/984`；375 `375/375 353/353`，`adm5-gap` 与 `adm5-risk-panel` 均存在，页面无横溢。
- 定向 `npx vitest run src/modules/access` → **12 passed**；全量 `npx vitest run` → **124 files / 1236 passed**。
- `tsc -b . --noEmit` 仍被基线既有 `src/modules/approvals/api.test.ts`、`src/pages/LoginPage.test.tsx` 类型错误阻断（非本写域）；本模块无新增类型错误。

 HEAD
## 工具与 MCP 真数据面（T27，2026-11-19）

### 数据源与真实度
- Hermes dashboard 原生路由（同源、登录态由 `fetchJSON` 的 session token / cookie 携带）：
  - `GET /api/tools/toolsets` → **200**，26 个工具集，展开 **54 个工具**；其中 7 个工具集停用，对应 **27 个停用工具**。
  - `GET /api/mcp/servers` → **200** `{"servers":[]}`，当前真实 **0 个 MCP 连接**（空列表，无假行）。
- BFF 侧 `GET /agent-api/api/mcp/servers` → **404** `console.unknown_route`；因此本页使用同源 Hermes 原生路由，不把 BFF 404 伪装成空清单。
- 凭据只显示「已配置 / 未配置 / 未知」；MCP `env` 值不读取上屏，无 token/密钥值。

### 页面与判据
- 每行：名称（工具中文名；工具集名作为类型）/ 类型 / 启用状态（启停真实，未知「待核实」）/ 凭据状态 / 最近调用（接口未提供 → 「—」+ 原因）。
- 不可用或未知行保留并降透明度；空 MCP 段明确「服务已响应，没有登记 MCP 连接」。
- 四态齐；错误态人话 + 可复制请求编号 + 重试；403 单一拒绝体，不回显路径/状态码；两个路由都 404 时才展示带 `data-fixture` 的字段示例，GAP-04 仅进 `title`。
- testid `tol5-*`；1440/1280/375 DOM：body 与 page `scrollWidth == clientWidth == 视口`（1440/1280/375），54 个工具行、0 个 MCP 行。

### 原始 stdout
```text
$ cd web && npx vitest run src/modules/tools
 Test Files  2 passed (2)
      Tests  19 passed (19)

$ cd web && npx vitest run
 Test Files  123 passed (123)
      Tests  1208 passed (1208)
```
- 构建 `node scripts/build/web.mjs --source . --out /tmp/tools-build --icons .` **BUILD_EXIT=1**，阻断为基线既有 `src/pages/LoginPage.test.tsx` TS2739（非本写域），本模块 tsc 无新增错误。

## 定时任务只读面（cron5，2026-11-19）

### 数据源与真实度
- `GET /api/cron/jobs`（Hermes dashboard 同源读口，登录态由 `fetchJSON` 的 session token/cookie 携带）→ **200**，当前 **1 个任务** `l7-state-backup`；BFF `GET /agent-api/api/cron/jobs` → **404** `console.unknown_route`。
- 任务字段：名称、调度（`10 4 * * *` → 「每天 04:10」）、上次/下次运行北京时间到分、启用状态、最近结果；缺失一律「—」+原因，不写 0。
- 当前禁用任务 **0**；无 token/密钥上屏。

### 页面与边界
- 新建 `web/src/modules/cron/{cron.ts,CronModulePage.tsx,cron.css,CronModulePage.test.tsx}`；只读，启停/立即执行按钮均 `disabled` + `aria-disabled=true` + 只读 title，不调用任何写路由。
- 四态齐；403/404 同一中性体（`cron5-denied`，GAP 仅在 title）、不回显路径/状态码；错误态人话 + 可复制请求编号 + 重试；`?state=` 复现腿带 `data-fixture`。
- testid `cron5-*`；DOM 1440/1280/375 body 与 page `scrollWidth == clientWidth == 视口`，1 行任务、调度/时刻/状态/结果与按钮 disabled 均已读数。
- **需壳层注册**：`/work?tab=cron` 目前被 shell 规范到 `#/work?tab=board&view=cron`，App `/work` live map 只有 `board`/`runs`，没有 cron live node；本 lane 不能改 App/shell/routes/registry。L0/R5 需把 work 的 cron view/tab 指向 `@/modules/cron/CronModulePage`。

### 原始 stdout
```text
$ cd web && npx vitest run src/modules/cron
 Test Files  1 passed (1)
      Tests  8 passed (8)

$ cd web && npx vitest run
 Test Files  124 passed (124)
      Tests  1242 passed (1242)
```
- tsc 仅剩基线既有 `src/modules/approvals/api.test.ts` 与 `src/pages/LoginPage.test.tsx` 错误（非本写域），本模块无新增类型错误。


## R26 cron / retention page bodies + registration list (2026-11-19)

Base `a37fe73e` (gate ledger `16562a76`). Write domain: `web/src/modules/cron/**`, `web/src/modules/audit/**`, `web/src/modules/access/**`, `docs/_artifacts/gov/**`. No App/shell/routes/registry/manifest/pages/scripts/package/lock changes.

### F3 定时任务（/work?tab=cron）
- Page body already reads same-origin Hermes `GET /api/cron/jobs` (live probe 200, 1 job `l7-state-backup`, `10 4 * * *` → 每天 04:10, last 2026-11-19 04:10, next 2026-11-20 04:10, enabled, ok). No sample/0 fallback.
- Unavailable state now says 「定时任务读口未接入」 + human reason + `/approvals` application link (`cron5-apply`); `cron5-*` family unchanged; 403/404 one body, `title=GAP-CRON-01`.
- Export: named `CronModulePage`, default same; body root `cron5-page`; rows `cron5-row`, name/schedule/status/result/last/next; `cron5-loading|empty|denied|error|retry|request-id|apply`.
- Shell registration still required: `/work?tab=cron` must render `@/modules/cron/CronModulePage` (currently bridge redirects to board).

### F5 数据保留与清理（/system?tab=retention）
- Page body exists with four sections audit/runs/sessions/uploads; `/api/retention` live probe 404 `console.unknown_route` → each section `未接入`, all values `—` with reason; no 0-day/0-byte fallback.
- Ready shape defensively reads retention days, last cleanup, next run, used/limit bytes and computes occupancy; times BJT to minute. Write actions are `data-planned` + `aria-disabled` + `title`, never success.
- Export: named `RetentionModulePage`, default same; root `ret4-page`; `ret4-section-*`, `ret4-unwired-*`, `ret4-days|last|next|used|limit|share-*`, `ret4-planned-*`, `ret4-denied`, `ret4-error`, `ret4-unwired-note`, `ret4-summary`.
- Shell registration still required: `/system?tab=retention` must render `@/modules/audit/RetentionModulePage` (currently bridge redirects to events).

### adm5 registration list (R25)
- Access export: `AccessModulePage` default; admins panel via `?view=admins` (module also accepts `?tab=admins` when mounted). Testids: `adm5-gap`, `adm5-admin-table`, `adm5-admin-row`, `adm5-admin-account|role|login|risk|status`, `adm5-risk-panel`, `adm5-risk-table`, `adm5-risk-row`, `adm5-risk-time|category|action|object|actor`, `adm5-risk-copy`, `adm5-risk-request-id`, `adm5-risk-gap`, `adm5-risk-empty`, `adm5-risk-error`.
- Shell needs `admins` tab/slot on `/identity` (deep link `/identity?tab=admins`); currently reachable at `/identity?tab=roles&view=admins`.

### Raw stdout
```text
$ cd web && npx vitest run src/modules/cron
 Test Files  1 passed (1)
      Tests  8 passed (8)

$ cd web && npx vitest run src/modules/audit/RetentionModulePage.test.tsx
 Test Files  1 passed (1)
      Tests  9 passed (9)
```
- Route count at `/work?tab=cron` and `/system?tab=retention` remains 0 until R5 mounts the exports above; this lane cannot edit shell/App/routes.

## R27 人员目录 real-data surface (ppl5, 2026-11-19)

Base `4dd7966f` (gate ledger `68ec59a4`). Write domain `web/src/modules/people/**` + `docs/_artifacts/gov/**`.

### Endpoint truth
- `GET /api/v1/user/list` and `/api/v1/user/all` both **404 `console.unknown_route`**. True rows **0**.
- The page renders one neutral `ppl5-unwired` body for 403 and 404: 「人员目录未接入」 + reason + `/approvals`; `title=GAP-02` only. No sample rows or fake 0.
- Columns: 姓名 · 8位短码 / 账号 / 部门 / 状态 / 最后活跃（BJT `YYYY-MM-DD HH:mm`）. Missing account/department/last-active → `—` + visible reason; unknown status → 「待核实」; raw ids only in `title`.
- Four states: `ppl5-loading`, `ppl5-empty`, `ppl5-error` (copyable request id + retry), `ppl5-unwired`. Forced `?state=loading|empty|error|denied|ready` skips fetch and sets `data-fixture`.

### DOM
- 1440 body 1440/1440, page 1144/1146, rows 1; 1280 body 1280/1280, page 984/986; 375 body 375/375, page 353/353. No page horizontal overflow.

### Raw stdout
```text
$ cd web && npx vitest run src/modules/people
 Test Files  1 passed (1)
      Tests  7 passed (7)
$ cd web && npx vitest run
 Test Files  126 passed (126)
      Tests  1258 passed (1258)
```
- Build to `/tmp/ppl5-build` blocked by baseline `src/pages/LoginPage.test.tsx` TS2739, outside this write domain.

## R26 admins slot export + adm5 page root (2026-11-19, base 1f3fe2ad)

- `/identity?tab=admins` shell compat currently resolves to `tabId=people`; the access module itself is mounted at `?tab=roles&view=admins`. Added stable named export `AdminsModulePage` and page root `adm5-page` (also for forced states) so R5 can register the admins slot without touching page internals.
- Data truth unchanged: `/api/v1/user/list|all` and role endpoints 404 `console.unknown_route` → admin rows 0, `adm5-gap` (title `GAP-ADM5-01`) + `/approvals`; high-risk audit `grant.created` 200 (6 events), other delete/grant/credential actions 200 empty; all failures keep copyable request id + retry, 403≡404 one body.
- Table columns: 账号「姓名 · 8 位短码」/角色/最近登录/最近高危操作/状态; high-risk rows carry time/category/action/object/actor/copyable request id; missing values `—` with reason; no write controls.
- Verification: `npx vitest run src/modules/access` → **13/13**; full `npx vitest run` → **126 files / 1263 passed** (before the final export test; access 13 now). No App/shell/routes/registry/manifest/package changes.

## R26 health page raw handle closeout (2026-11-19, base a895af23)

- `/system?tab=health` (`HealthPage`) no longer prints a full request id on screen: `RowRequestId` renders only the first 8 characters (shorter ids unchanged), with the full id in the `title`; the copy button copies the full value and is labelled 「复制完整请求编号」.
- Probe timestamps remain `YYYY-MM-DD HH:mm` via `formatBeijingTime` (Asia/Shanghai); raw HTTP status / GAP values stay in row `title` only. Four states, counts and retry unchanged.
- Verification: `npx vitest run src/modules/health` → **6/6**; full `npx vitest run` → **126 files / 1264 passed**; no App/shell/routes/registry/manifest/package changes.

## R28 employee zones + cron slot contract (2026-11-19, base ad72c31c)

- Employee detail root cause: `mapShellZone()` handled legacy `config`/`tasks` but not the tab links' own `?zone=capability|approvals`, so both fell through to `overview` while the URL changed. Added explicit `capability`/`approvals` cases (legacy spellings retained).
- Zone panels now render `ed5-capability` / `ed5-approvals` (plus their loading/empty/denied/error siblings) for direct `?zone=` links; added a regression test rendering both zones in sequence, and keyed the test router by entry so a search-only navigation remounts.
- Cron export contract for R5: `web/src/modules/cron/CronModulePage.tsx` exports named `CronModulePage` and default same, no props; root `cron5-page`; testid family `cron5-row|name|schedule|status|result|last|next|loading|empty|denied|error|retry|request-id|apply|refresh|status-line`. Source is same-origin Hermes `GET /api/cron/jobs`; unavailable body is 「定时任务读口未接入」 + reason + `/approvals` (GAP only in title). No module change was required this round.
- Registration needed from R5: `#/work?tab=cron` (and `#/cron`) → `CronModulePage`; current bridge redirects to board, so `cron5Count` stays 0 until shell maps the slot.
- Verification: `npx vitest run src/modules/employee-detail` → **14/14**; full suite after this change (see receipt). No App/shell/routes/registry/manifest/package changes.

 HEAD
## R29 retention tab rendering (2026-11-19, base da807e4f)

- Root cause: `system` aliases `retention -> events`, so `/system?tab=retention` mounts the events live node and the retention module was never rendered.
- `AuditEventsModulePage` now dispatches `?tab=retention` (and `?view=retention`) to `RetentionModulePage` before the audit hooks/page render; the URL is left intact. Shell strip label is still 「审计事件」 because `CONSOLE_TABS` has no retention tab and shell/routes are not in this write domain; the rendered pane is `ret4-page` with `data-page=retention`.
- Retention behavior unchanged: missing `/api/retention` → `ret4-unwired-note` + four sections all 未接入 + `—` reasons, no 0; write actions `data-planned=true` + `aria-disabled=true` + title; 403/404 same denied body; request id + retry.
- DOM (Vite 5448, Chrome CDP 9248, `?tab=retention&state=unwired`): 1440 body/page **1440/1133**, 375 **375/353**; `ret4-page=true`, rendered ret4 testid nodes **45**, planned buttons 2 (both disabled/aria-disabled/title); shell selected tab label `审计事件` (alias limitation above).
- Test: `npx vitest run src/modules/audit/AuditEventsModulePage.test.tsx` → **41/41**; full suite below. No App/shell/routes/registry/package edits.


## R29 retention mount contract (2026-11-19, base 43ea29d1)

- Module export: `web/src/modules/audit/RetentionModulePage.tsx` exports named `RetentionModulePage` and default `RetentionModulePage`; **no props** (reads `?state=loading|ready|unwired|error|denied` from its own router context). Page root `ret4-page` + `data-page="retention"`.
- Mount slot: App `/system` `ConsoleModulePage module="system" live={{ ..., retention: <RetentionConsolePage /> }}` plus a `CONSOLE_TABS` row with `tabId="retention"` / route `#/system?tab=retention`. Today `shell/routes.ts:247` folds `retention` into `events` and `bridge.test.ts` asserts that redirect, so the page is unreachable at the target URL; App/shell/routes are outside this write domain.
- Expected shell tab key: `retention` (label 数据保留与清理). If R5 keeps the compat redirect, retention cannot win over the events tab.
- ret4 testid family (45 rendered testid nodes in the no-route fixture; unique ids include): `ret4-page`, `ret4-summary`, `ret4-refresh`, `ret4-sections`, `ret4-section-{audit,runs,sessions,uploads}`, `ret4-unwired-{...}`, `ret4-unwired-note`, `ret4-days|last|next|used|limit|share-{...}`, `ret4-note-{...}`, `ret4-planned`, `ret4-planned-cleanup`, `ret4-planned-policy`, `ret4-loading|denied|error`, `ret4-error-request-id|ret4-error-retry`, `ret4-denied-request-id`, `ret4-tech-details`.
- Fixture render: temporary vitest (deleted after run) mounted the page at `/system?tab=retention` with `/api/retention` 404 `console.unknown_route` → **45 ret4 testid nodes**, four sections all 未接入, 24 field values `—`, two planned write buttons disabled/aria-disabled/title; existing suite `RetentionModulePage.test.tsx` is **9/9**.
- No App/shell/routes/registry/package/lock/scripts/ops edits; no fake 0/sample rows.

## R30 fixture debt burn — 3 gov pages (2026-11-19, branch lane/console-gov)

### Inventory before (grep -rl data-fixture, modules scope)
`people/PeopleModulePage`, `org/OrgModulePage`, `access/AccessModulePage`, `tenant/TenantQuotaPage`, `settings/SettingsPage`, `cron/CronModulePage`, `retention` (none), `health/HealthPage`, `models/ModelsModulePage`, `tools/ToolsPage` + `tools/states.tsx`, `version/VersionPage`, `knowledge/KnowledgeModulePage` (plus their test files).

### Selected three: real source or honest gap
- `cron/CronModulePage`: real same-origin Hermes `GET /api/cron/jobs`; 200 data shape covered by tests (name, human schedule, last/next BJT, status, result reason). Production `data-fixture` attributes **4 → 0**; test references **2 → 0**.
- `health/HealthPage`: real probe reads `/agent-api/api/__health-probe__`, `/api/hermes-summary`, `/api/skills`; 403/404 surfaces honest 未接入 and raw status/GAP stay in title. Production `data-fixture` **1 → 0**; no test reference.
- `knowledge/KnowledgeModulePage`: citations use real sessions + console-session details, retrieval uses real `audit?action=kb.read`; spaces/ingest 404 show 未接入 + reason, no sample. Production `data-fixture` **1 → 0**; test references **2 → 0**.
- No page invents 0: missing values render `—` + reason; `?state=` QA previews remain as explicit `?state=` fixtures but no `data-fixture` marker (removed per this task).

### DOM/test readings after
- `cron5-page` + cron5 testid family (21 unique), `hlt4-page` + health family (10 unique), `knw4-page` + knowledge family (25 unique); targeted vitest **4 files / 29 tests passed**.
- No production `data-fixture` remains in the three selected modules (`grep -rl` empty).

 HEAD
## R31 version + models deep pass (2026-11-19, base 1fff2e58)

- Version (`/system?tab=version`): build identity/ref/commit/time stay `未知` + explicit release-pipeline reason; injected commit is shortened to 8 chars with full value in title; build time uses Beijing `YYYY-MM-DD HH:mm`. Price block now has a retry and copyable request id; 403 and 404 share one neutral `单价表未接入，或当前账号无权读取` body with `GAP-07` only in `title`, no path.
- Models (`/capabilities?tab=models`): catalog/price/ledger remain separate with their own source and `asOf`; price and ledger never multiply; unknown `—`/「未计价」, no `$0.00`. 403 and 404 now both map to the same block-level 「未接入（GAP-07）」 bodies; 401 stays login-denied.
- Testids unchanged: `ver4-*` and `mdl4-*`.
- Verification: `npx vitest run src/modules/version` → **6/6**; `npx vitest run src/modules/models` → **12/12**; full suite below. No App/shell/routes/package/lock/scripts/ops changes.


## R32 fixture debt batch 2 + audit words (2026-11-19, base 1fff2e58)

### Inventory before (`grep -rl data-fixture web/src/modules/{audit,health,retention,settings} --include=*.tsx`)
`audit/AuditDetailModulePage.test.tsx` (3), `audit/AuditEventsModulePage.tsx` (1), `audit/AuditEventsModulePage.test.tsx` (1), `audit/AuditVerifyModulePage.tsx` (1), `audit/AuditVerifyModulePage.test.tsx` (5), `audit/RetentionModulePage.tsx` (2), `audit/RetentionModulePage.test.tsx` (2), `audit/states.tsx` (1), `settings/SettingsPage.tsx` (1); health had 0.
### After
- Production `data-fixture` attributes removed from audit states/verify/retention/settings and audit fixture helper deleted; `grep -rl data-fixture` over the four modules returns **0 files**. Production occurrences **6 → 0**; test assertions **11 → 0**.
- Audit events wording: `CopyValue` now masks a 32-hex request handle to its first 8 chars on screen with the full value in `title`; copy still copies full. Event types/outcomes/actors/times remain humanized; raw values stay in titles/technical fold.
- Data truth: audit events/detail/verify are real `/agent-api/api/audit*` reads (missing route/denied render 未接入/同体 403/404); retention `/api/retention` is honest 未接入 (four areas, `—`); settings uses `/api/config` with 未接入/未知 reasons. No fake 0.
### DOM/test readings
- Vite 5450 / CDP 9250: 1440/1280/375 body width exactly viewport for `/system?tab=events|health|defaults`; `[data-fixture]` count **0**; audit page present at 1280/375, health/settings roots present.
- `npx vitest run src/modules/audit src/modules/settings src/modules/health` → **10 files / 147 passed**; full suite below.

## R33 security settings read-only surface (2026-11-20, base 3bff4208)

- `web/src/modules/security/{SecurityModulePage.tsx,security.ts,security.css,SecurityModulePage.test.tsx}`: read-only `/system?tab=security` body, testids `sec5-*`.
- Data truth with auth cookie: `GET /api/config` → **404** `console.unknown_route` (config fields therefore show 未知 + source/asOf reason, never guessed); `GET /api/audit?action=grant.created&limit=3` → **200, 3 events** (high-risk rows real; action/object/BJT/request id, full id only in title/copy).
- Sections: 登录与会话 (会话有效期/并发登录/双因素认证), 密钥与凭据 (模型/渠道/审计导出密钥 only 已配置/未配置/未知, never values), 高危操作 (3 rows or honest gap). Missing source: `sec5-gap` with GAP only in title; risk gap same.
- Write-shaped controls: 3 (`sec5-planned-session|mfa|rotate`) all `data-planned=true` + `aria-disabled=true` + title, no write action.
- Four states, copyable request id, 403≡404 same body, no path leakage; CSS grid/table stacks ≤720px, page overflow clipped. Shell registration remains outside write domain: `/system?tab=security` currently resolves to events view anomaly, so this page needs a `security` live slot/tab in App/shell.
- Verification: `npx vitest run src/modules/security` → **4/4**; full suite **127 files / 1280 passed**.

## R33 fixture debt burn — 3 gov pages (2026-11-19, base 9c7789f6)

### Inventory before (`grep -rl data-fixture web/src/modules/{people,org,access,tenant,settings,cron,retention,health,models,tools,version} --include=*.tsx`)
`people/PeopleModulePage` (1), `org/OrgModulePage` (1), `access/AccessModulePage` (2), `tenant/TenantQuotaPage` (3), `models/ModelsModulePage` (1), `tools/ToolsPage` + `tools/states.tsx` (7), `version/VersionPage` (1), `settings/SettingsPage` (1), plus test files. Health/cron/retention already 0.

### Selected three
- `people/PeopleModulePage`: source `/api/v1/user/list|all` still 404 → honest 未接入 + reason; production marker **1 → 0**; test marker **1 → 0**.
- `models/ModelsModulePage`: catalog/price/ledger remain separate; missing endpoints honest, no fake 0; production marker **1 → 0**.
- `version/VersionPage`: build/env unknown + reason; dependency rows from real package data; production marker **1 → 0**.
- Selected total production **3 → 0**; no `data-fixture` in those three modules after change.

### DOM / tests
- Browser sweep 5451/9252 at 1440/1280/375: `[data-fixture]` **0**; body scrollWidth 1424/1264/375 (never exceeds viewport; scrollbar accounts for 1440/1280 delta). Page roots are covered by module vitest because lazy routes did not settle within the probe window.
- `npx vitest run src/modules/people src/modules/models src/modules/version` → **4 files / 25 passed**; full suite below.

## R34 tenant quota & usage depth (2026-11-19, base 33fc7029)

- Endpoint truth: `/agent-api/api/employee-stats` → **200** total 3; `/agent-api/api/run-stats?...` → **200** runs 13; neither payload carries `asOf`; quota/concurrency/budget/storage endpoints absent → honest 未接入.
- Quota items: 员工数 (已用 3 人, source 员工统计), 运行数（近 7 天） (已用 13 次, source 运行统计), 并发 (—, 未接入), 月度预算 (—, ledger 未接入), 存储与 token (—, 未接入). Each row shows 配额上限 / 已用 / 剩余 / unit or `—` + title reason; no `?? 0`; true 0 would render `$0.00` (not fabricated here).
- 403 and 404 share one neutral body; error carries copyable request id + retry. asOf is payload-only; missing source time renders 「时间未知」 + reason (no browser clock).
- Tests `npx vitest run src/modules/tenant` → **9/9**; `TenantQuotaPage` `ten4-*` family retained (profile, quotas, five rows, gap, request id, retry).
- Shell `/identity?tab=tenant` still aliases to people; module-level `?tab=tenant`/`?view=tenant` behavior remains; registration is outside this lane.

## R27 /system?tab=security read-only surface (2026-11-19)

- Module `web/src/modules/security/**`; export `SecurityModulePage` (named + default); root `sec5-page`; 40 unique `sec5-*` ids.
- `/api/config` live probe **404 `console.unknown_route`** → 登录与会话三项、密钥与凭据三项 all 「未知/未配置」+ reasons; no values or fake 0.
- `/api/audit?action=grant.created&limit=3` live probe **200, 3 events** → high-risk rows with object + copyable request id.
- Write-shaped controls: 3, each `data-planned` + `aria-disabled` + title; no write path.
- Four states; 403≡404 one neutral body (GAP only in title); retry + copyable rid; CSS stacks ≤720, no page overflow.
- Export/registration contract for R5: mount `SecurityModulePage` at `/system?tab=security`; shell currently maps that tab to events/anomaly, so sec5 count at target route is 0 until registration.
- Tests `npx vitest run src/modules/security` → 4/4 passed.

## R28 tools/MCP surface depth (2026-11-19)

- Base `28702d34`; write domain `web/src/modules/tools/**` + `docs/_artifacts/gov/**`.
- Data unchanged: same-origin `GET /api/tools/toolsets` (live 200, 26 toolsets/54 tools) and `GET /api/mcp/servers` (200, 0 servers); no BFF `/agent-api/api/mcp/servers` route (404).
- Row type now human `内置 · <group>` or `MCP · <transport>`; last call shows `无调用记录` when absent; unavailable rows visible/dimmed with visible status reason; optional failure line renders human reason, raw error stays off screen.
- Credential remains only 已配置/未配置/未知; added test that a missing-credential row with `API_KEY=super-secret-value` in payload prints no key/secret text.
- 403 and 404 now share one neutral `未接入` body, no fixture/sample, GAP only in `title`; four states, copyable rid, retry, `tol5-*`.
- Tests: `npx vitest run src/modules/tools` → 2 files / 20 passed.


## R36 fixture debt burn — org5 + access (2026-11-20)

Base: `165e62a5` (workspace HEAD `e4c03f8c` gate ledger). Write domain only org/access modules + this file.

Initial `grep -rl data-fixture` across the 12 module dirs:
```
web/src/modules/org/OrgModulePage.test.tsx
web/src/modules/org/OrgModulePage.tsx
web/src/modules/access/AccessModulePage.tsx
web/src/modules/access/AccessModulePage.test.tsx
web/src/modules/tenant/TenantQuotaPage.tsx
web/src/modules/tenant/TenantQuotaPage.test.tsx
web/src/modules/tools/states.tsx
web/src/modules/tools/ToolsPage.test.tsx
web/src/modules/tools/ToolsPage.tsx
web/src/modules/knowledge/KnowledgeModulePage.test.tsx
web/src/modules/knowledge/KnowledgeModulePage.tsx
```
Chosen pages: **org5** and **access** (the two pages that painted sample rows as a 404/forced fallback).

### org5 (`web/src/modules/org/**`)
- Deleted `FIXTURE_DEPTS` and the `?state=ready` sample tree; `ready` is no longer a forced state. A request for `?state=ready` now reads the real service.
- Removed `data-fixture` from the page shell and the 预览状态 note. 403 and 404 now share exactly one body (`MISSING_REASON`) with `GAP-02` only in `title`; 401 remains a login error, 5xx error keeps copyable request id + retry.
- Real data path untouched: `/agent-api/api/v1/dept/list|tree`, tree default expanded, columns 部门名/上级部门/人数/负责人/更新时间, missing `—` + reason, owner 姓名 · 8位短码 or 未指派, BJT.

### access (`web/src/modules/access/**`)
- Deleted `ROLE_FIXTURE`, `rolePreview`, the 示例布局 note and all `data-fixture` marks.
- 403/404 both render the same `ac3-gap` body (`GAP-ROL5-01` only in `title`), zero sample rows; real role/member/admin data paths unchanged; error keeps copyable request id + retry.
- No write controls exist on either page (nothing to mark `data-planned`).

### Verification
- `npx vitest run src/modules/org src/modules/access` -> **2 files / 26 tests passed**.
- `npx vitest run` -> **129 files / 1326 tests passed**.
- `./node_modules/.bin/tsc -b . --noEmit` -> **TSC_EXIT=0**.
- No build run (module-only, no CSS change).
- DOM at 1440/1280/375 (temporary harness, 404 stubs): both pages `bodySW==bodyCW==vw` and `pageSW==pageCW` at all three widths; `data-fixture=false`, org `org5-denied=true`, access `ac3-gap=true`, zero 示例 text.

### Endpoint truth
- org `/api/v1/dept/list` and `/api/v1/dept/tree` remain absent/401-gated at BFF; page shows 未接入, no sample.
- access `/api/v1/role/list` and `/api/v1/roles` remain absent; page shows 未接入, no sample.

### Boundaries
- No App/shell/routes/registry/manifest/package/lock/scripts/ops changes; no install; no `git add -A`.
- No live 200 obtained; no independent observer.

## R37 people directory real-data fallback (2026-11-20)

Base: `6c9db598` (remote tip `965cec5d` gate ledger); lane merged with `origin/lane/hermes-console` via merge commit `40a53664` (no rebase/force).

### Endpoint truth (BFF 8092, access_token_cookie, value never printed)
- `GET /api/v1/user/list?page=1&page_size=20` → **404** `console.unknown_route`.
- `GET /api/v1/user/all` → **404** `console.unknown_route`.
- `GET /api/employees?limit=20` → **200**, **3 items**.

### Page behavior
- `/identity?tab=people` now tries user-center endpoints first, then falls back to `/agent-api/api/employees?limit=20`.
- Real rows: name · last-8 code, account `—` + reason, department `—` + reason, lifecycle state human word, last active `—` + reason with the source's last-update time (never presented as activity).
- Source line: 「来源：数字员工台账；真人用户中心接口尚未接入，这里不冒充真人名单。」 for employee rows; user-center rows label 用户中心人员台账.
- Removed `FIXTURE_ROWS` and all forced `?state=` fixtures; no `data-fixture` remains. 403/404 still render one neutral 未接入 body with `GAP-02` only in `title`, apply link, and no sample.
- Four states kept; 5xx error has copyable request id + retry; raw `emp_…` ids only in row `title`; BJT to minute.

### Verification
- `npx vitest run src/modules/people` → **1 file / 8 tests passed**.
- `npx vitest run` → **129 files / 1331 tests passed**.
- `./node_modules/.bin/tsc -b . --noEmit` → exit 0.
- DOM (temporary harness with the live 3-row payload, deleted after; Vite 5446, Chrome CDP 9246):
  - 1440: `vw=1440 bodySW=1440 bodyCW=1440 pageSW=1440 pageCW=1440 rows=3`
  - 1280: `vw=1280 bodySW=1280 bodyCW=1280 pageSW=1280 pageCW=1280 rows=3`
  - 375: `vw=375 bodySW=375 bodyCW=375 pageSW=375 pageCW=375 rows=3`
  - `data-fixture=false`; source line present; 3 row names/codes/status visible.

### Boundaries
- Write domain only `web/src/modules/people/**` + this file. No App/shell/routes/registry/manifest/package/lock/scripts/ops changes.
- No sample rows or fake 0; user-center真人目录 remains GAP-02 until its endpoint exists.
- No build run (module-only); no independent observer.

## R38 — /system?tab=health 探针新鲜度（hlt5）

基线：`origin/lane/hermes-console` = a1a26ccf（远端 tip 0bee53cd，gate ledger），本地 merge `e1e07086`。

### 端点与真实度（BFF 8092，Cookie 从 `~/.local/state/sekoi-ops/v4-auth-state.json` 读取，未打印值）
- `GET /api/__health-probe__` → **404** `{"code":"console.unknown_route"}`；控制台进程有响应，按「控制台服务」健康处理，原始码只进 `title`。
- `GET /api/hermes-summary` → **200** `runtime.hermes.summary.v1`；响应未带 `asOf` / `lastSuccessAt` / `lastFailureAt` / `consecutiveSuccesses`，这些字段显示「—」并在 `title` 说明原因。
- `GET /api/skills` → **200** `{"items":[],"asOf":"2026-11-19T19:37:48.524Z"}`；采集时间来自 `asOf`，转换为北京时间到分。

### 页面实现
- `web/src/modules/health/health.ts`：`ProbeRow` 增加 `lastSuccessAt/lastFailureAt/consecutiveSuccesses/asOf` 及各自 reason；从上游响应读取 `asOf|collectedAt|generatedAt|...`、`lastSuccessAt|last_success_at|...`、`lastFailureAt|...`、`consecutiveSuccesses|successStreak|...`；未回显一律 `null` → 「—」+ `title` 原因，不用浏览器时间代替采集时间。
- 成功探针的「上次成功」使用本次返回时刻（真实观测），失败探针的「上次失败」同理；对侧历史仍要求上游回显，否则「—」+原因。
- `HealthPage.tsx`：每源展示 状态人话 / 上次成功 / 上次失败 / 连续成功 / 采集时间；`0 次` 是上游真实 0，不转成「—」；`?state=loading|empty|error` 预览带 `data-fixture=1`。
- 403 与 404 共用同一句「接口未接入：这个读取口还没有对控制台开放。」，HTTP 码只在 `title`；无写入口。
- testids：`hlt5-page`、`hlt5-counts`、`hlt5-loading`、`hlt5-empty`、`hlt5-error`、`hlt5-list`、`hlt5-row-*`、`hlt5-status-*`、`hlt5-last-success-*`、`hlt5-last-failure-*`、`hlt5-streak-*`、`hlt5-asof-*`、`hlt5-reqid-*`、`hlt5-retry`、`hlt5-refresh`。
- 新增 `health.css`：桌面双列、≤720px 单列；页面 body/page 无横溢。

### 原始验证
```
npx vitest run src/modules/health
 Test Files  1 passed (1)
      Tests  8 passed (8)

npx vitest run
 Test Files  130 passed (130)
      Tests  1342 passed (1342)

./node_modules/.bin/tsc -b . --noEmit
TSC_EXIT=0

node scripts/build/web.mjs --source . --out /tmp/health-r38 --icons .
BUILD_EXIT=0
built /private/tmp/health-r38/index.html
```

### DOM 读数（临时 harness，已删除；1440/1280/375）
- 1440：`vw=1440 bodySW=1440 bodyCW=1440 pageSW=1440 pageCW=1440`，4 行。
- 1280：`vw=1280 bodySW=1280 bodyCW=1280 pageSW=1280 pageCW=1280`，4 行。
- 375：`vw=375 bodySW=375 bodyCW=375 pageSW=375 pageCW=375`，4 行；状态 正常/正常/未知/未知；`上次失败` 对无记录源为「—」；`连续成功 0 次` 为真实 0；`采集时间 2026-11-19 15:30`。
- 截图：`docs/_artifacts/gov/shots/hlt5-1440.png`、`hlt5-1280.png`、`hlt5-375.png`。

### 边界
- 只改 `web/src/modules/health/**` + 本证据；无 App/shell/routes/registry/manifest/package/lock/scripts/ops 改动。
- 未取得真实浏览器登录态的 `hermes-summary` 元数据；缺字段按「—」+原因，不补零、不冒充采集时间。
- 无独立观察者；页面已在 App `/system` live map 中注册（`health: <HealthConsolePage />`）。

## R39 — /identity?tab=departments 组织与部门真数据面

- 基线：`origin/lane/hermes-console` gate ledger `fa2c3bf7`（stamped at `466e2d2b`）；本地 lane 合入 merge `e9b1f22c`，未 rebase/force。
- 端点实测（9122，`access_token_cookie` 从本机 auth-state 读取，未打印值）：
  - `GET /agent-api/api/v1/departments` → **404** `console.unknown_route`
  - `GET /agent-api/api/v1/user/list?page=1&page_size=20` → **404** `console.unknown_route`
  - `GET /agent-api/api/v1/dept/list` → **404**；`/api/v1/dept/tree` → **404**
  - 旁证：`GET /agent-api/api/employees?limit=20` → **200**，3 条数字员工，`department` 全为 `null`，因此不能据此编造部门树。
- 实现：`web/src/modules/org/OrgModulePage.tsx` 候选端点首位改为 `/agent-api/api/v1/departments`，保留 `/dept/list`、`/dept/tree` 回退；403/404 同一「组织与部门未接入」体，GAP-02 仅 `title`，提供 `#/approvals` 申请去处；负责人名称存在但短码缺失时显示「姓名 · —」并给出“上游未提供负责人短码”，短码只接受 8 位字母数字；真实 0 才显示 `0 人`，缺失仍 `—` + 原因；无写入口、无 `data-fixture`、无样例/假 0。
- 四态：加载骨架 / 空（真实 200 空列表才出现）/ 错（人话 + 可复制请求编号 + 重试）/ 未接入；403 与 404 同体；401 保留登录提示。
- 验证：`npx vitest run src/modules/org` → **13/13 passed**；全量 `npx vitest run` → **131 files / 1346 passed**；`tsc -b . --noEmit` → exit 0。
- DOM（临时 harness，404 真实形态；已删除）：1440/1280/375 `bodySW=bodyCW=pageSW=pageCW=1440/1280/375`，`org5-denied` 存在、`title=GAP-02`、申请链接可见；真实接口无数据故树层数 0；单测覆盖 3 层树的默认展开/折叠。
- 测试 id：`org5-*` 唯一 token **37 个**（page/loading/empty/error/denied/apply/list/node/name/parent/count/owner/updated/request-id/copy/refresh 等）。
- 边界：未改 App.tsx / shell / routes / registry / manifest / package·lock / scripts / ops；未跑 build，未重建 9122；无独立观察者。真实部门数据仍待上游接口接入（GAP-02）。

## R39 — gov 页面四态内容面自查（同窗）

- 基线：`origin/lane/hermes-console` gate ledger `fa2c3bf7`（stamped at `466e2d2b`）；本地 lane 保留 `b422431c`（org5）并以 merge `e9b1f22c` 对齐，未 rebase/force。
- 排查范围：people / org / access / tenant / settings / cron / retention / health / models / tools / version / knowledge。retention 实现在 `web/src/modules/audit/RetentionModulePage.tsx`（audit 域，非本 lane 写域，且已明确移除 `?state=` 复现腿）；本 lane 不改 audit，仅在回执点明。
- 逐页四态（`?state=loading|empty|error` 的可见内容；`ready` 均回真实读口，非 fixture）：

| 页面 | loading | empty | error | ready | data-fixture 计数 |
|---|---|---|---|---|---|
| settings | 正在读取默认设置… + 骨架 | 这项配置未提供 | 默认设置暂时无法读取 + 请求号（可复制）+ 重试 | 写入开关 / 上游自检 / 风险去处 | 0 |
| health | 正在检查服务… + 骨架 | 探针未接入，请看接入说明 | 所有探针均未收到响应 + 请求号 + 重试 | 4 行探针 + 状态/上次成功失败/连续成功/采集时间 | 1（仅强制态） |
| version | 正在读取版本信息… + 骨架 | 这项信息未提供 | 本地版本信息暂不可用 + 请求号（可复制）+ 重试 | 构建/依赖 + 单价表（单价表仅在 ready 渲染） | 0 |
| models | 正在读取模型目录、价目表与账本… | 还没有可展示的模型（空不等于 0） | 这次没能读取模型与账本 + 请求号 + 重试 | 目录/单价/账本三块独立态 | 0 |
| tenant | 骨架 | 这个账号当前还没有可展示的用量 | 这次没能读取租户用量 + 未记录编号说明 + 重试 | 员工数/运行数/其余额度诚实未知 | 1（仅强制态） |
| access | 骨架 | 没有读到访问控制记录（不是 0） | 访问控制数据读取失败 + 编号说明 + 重试 | 角色表/成员/管理员真实读口 | 0 |
| cron | 骨架 | 服务已响应，没有定时任务 | 定时任务没能加载出来 + 编号 + 重试 | 任务列表 | 0 |
| tools | 骨架 | 服务已响应，清单为空 | 工具与 MCP 清单没能加载出来 + 编号 + 重试 | 工具与 MCP 两块列表 | 2（页面 + 状态卡） |
| org | 骨架 | 部门树暂时是空的 | 没能加载出组织架构 + 请求号 + 重试 | 部门树/负责人/更新时间 | 0 |
| people | 骨架 | 目录暂时是空的 | 没能加载出人员目录 + 请求号 + 重试 | 人员表（数字员工台账来源） | 1（仅强制态） |
| knowledge | 骨架 | 分组没有可展示条目（不显示 0） | 预览错误 + 无请求号说明 | 四个真实 surface | 1（仅强制态） |

- 修复的错位：
  - settings/health/version 的强制态重试原先只加 attempt、仍停在 fixture；现在先清除 URL 的 `state` 再重新读取。version 的同额修复还包括：`state=ready` 允许单价表真实读取，非 ready 时不渲染单价卡；error 加可复制请求号与重试。
  - access/cron/tools/tenant 的强制态 error 重试同样先清除 `state`，不再“点重试画面不动”。
  - org 的 `?state=` 改为同时识别 hash 内查询与 window.search，修复 SPA 深链下强制态失效；error 重试清除预览后读真实接口。
  - people/knowledge 原先完全不接 `?state=`：新增 loading/empty/error 内容面（不发起请求），`state=ready` 走真实读口；people 强制态带 `data-fixture="1"`，knowledge 同理。
- 验证：`npx vitest run src/modules/settings src/modules/health src/modules/version src/modules/access src/modules/cron src/modules/tools src/modules/tenant src/modules/org src/modules/people src/modules/knowledge` → **12 files / 119 tests passed**；全量 `npx vitest run` → **131 files / 1347 passed**；`tsc -b . --noEmit` → exit 0。
- 构建：`PATH="/opt/homebrew/bin:$PATH" node scripts/build/web.mjs --source . --out /tmp/r39-build --icons .` → exit 0，`built /private/tmp/r39-build2/index.html`。
- DOM（临时 harness，已删除；1440/375）：settings/health/version/models/tenant/access/cron/tools/org/people 的 `bodySW==bodyCW==innerWidth`；settings 在 1440 `pageSW/pageCW=1440`（已隐藏共享 Button 的 2px 装饰弧）；11 个被审计页面强制态均出现对应内容 testid，非仅角标。
- 边界：无 App/shell/routes/registry/manifest/package·lock/web-scripts/ops 改动；无 install；未并 main、未重建 9122；`retention` 属 audit 域，本 lane 未改并已在上表外标注；未跑独立观察者。

## R40 夹具债第三批（gov 域内剩余）

- 基线：`origin/lane/hermes-console` = `998cb124`（已有 R39 `5fe7dec1`）；worktree `forks/console-gov`，分支 `lane/console-gov`。
- 改前 grep（限定目录，`--include=*.tsx`）：**12 文件 / 26 处** `data-fixture`：access(test)、health(page/test)、knowledge(page/test)、org(test)、people(page)、tenant(page/test)、tools(page/test/states)。
- 改后同一 grep：**0 文件 / 0 处**。已删除 tools 死夹具 `FIXTURE_ROWS`/`FixtureRead`/`ToolRead`/`fixture` phase 与未引用 `states.tsx`；各页仅保留真实读取，缺失时「未接入 + 原因 + 去处」，GAP 仅在 `title`。
- 真数据页：people（`/api/employees` 200 / 3 行）、tools（`/api/tools/toolsets` 200 / 26 toolsets）、cron（`/api/cron/jobs` 200 / 1 条）、health（console 探针 404 但进程存活，runtime/skills 200）、tenant（employee-stats/run-stats 200，仅用量；配额上限未接入）。
- 诚实未接入页：org（部门端点 404）、access（roles/admins 端点 404，risk 用真实 grant.created）、retention（保留/清理端点 404）、knowledge spaces/ingest（404；citations/retrieval 走真实会话/审计）、models（目录/价目/账本缺失时逐块未接入）、version（构建信息未知，价目缺失时未接入）、settings（`/api/config` 未接入项逐项未知）。
- 修复：models 可见 `GAP-07` 撤屏（转 `title`）；access 人员目录可见 `（GAP-02）` 撤屏（转 `title`）；无假 0、无样例冒充；四态内容面与 R39 行为保留。
- 验证：`npx vitest run` **131 files / 1349 passed**；定向 12 模块 **14 files / 132 passed**；`tsc -b . --noEmit` 仅基线 `EmployeesModulePage.test.tsx` TS18047（域外），本批模块 0 行错误。
- 边界：未改 App/shell/routes/registry/manifest/package·lock/web scripts/ops；未 install；未并 main；未重建 9122。

## R41 — /capabilities?tab=tools 凭据与状态面（同窗）

- 基线：`origin/lane/hermes-console` **53543118**（gate ledger stamped at `d0b50590`）；未并 main、未重建 9122。
- 端点实测（8122/9122 带登录态，token 不落日志）：
  - `GET /agent-api/api/tools/toolsets` → **404** `console.unknown_route`；`GET /agent-api/api/mcp/servers` → **404**。
  - 同源 `GET /api/tools/toolsets` → **200 text/html**（SPA 外壳，不是 JSON）；`GET /api/mcp/servers` → **200 text/html**。
  - 原生 Hermes 9119：`/api/tools/toolsets` → **200 / 26 toolsets**；`/api/mcp/servers` → **200 / 0 servers**；`/api/tools/calls`、`/api/tool-calls` → **404**（无最近调用时间路由）。
  - 结论：消费端走 BFF 时没有工具读口；本页诚实「工具与 MCP 读口未接入」+原因，`GAP-04` 只进 `title`；原生 Hermes 宿主仍可读真实目录。
- 实现：
  - 读取顺序改为 BFF 优先、同源 Hermes 回退：`/agent-api/api/tools/toolsets` → `/api/tools/toolsets`，MCP 同理；`fetchJsonStrict` 识别 HTML 200，不再把 SPA 外壳当 JSON 解析错误。
  - 最近调用：解析 `last_used/lastUsed/last_used_at/lastUsedAt/last_call_at/lastCallAt/last_invoked_at/lastRunAt`，北京时间到分；缺失显示 `—` +「接口没有提供最近调用时间（不表示从未调用）」。
  - 凭据只显示 已配置/未配置/未知；MCP 优先读显式 `configured/credential_configured/auth_configured` 布尔，其次 auth/env/headers 是否声明；只读键名，不读任何值。
  - 不可用行（停用/待核实）保留并标灰，`title` 合并原始标识、启用原因、凭据原因与最近调用原因。
  - 移除 `FIXTURE_ROWS`、`FixtureRead`、`ToolRead`、`fixture` 阶段与样例提示；删除未使用的 `states.tsx`；强制态仅保留 `data-fixture` 标记，不渲染样例行。
  - 403 与 404 同一「读口未接入」体；401 登录态；500 人话 + 可复制请求编号 + 重试；零写入口。
- 四态内容面（DOM 实测，1440）：
  - loading：`tol5-loading` +「正在读取工具与 MCP 清单…」，`data-fixture=loading`。
  - empty：`tol5-empty` +「服务已响应，清单里没有工具或 MCP 连接…」，`data-fixture=empty`。
  - error：`tol5-error` +「工具与 MCP 清单没能加载出来」+「请求编号：未提供」+ 重试，`data-fixture=error`。
  - denied：`tol5-denied` +「工具与 MCP 读口未接入」+ 重试，`data-fixture=denied`。
  - ready：真实读取，5 行（3 工具 + 2 MCP），`data-fixture` 无；`最近调用：2026-11-19 09:20`、`凭据：已配置`。
- 三档宽度（DOM，ready）：1440/1280/375 `bodySW=bodyCW=pageSW=pageCW=1440/1280/375`，无页面横溢。
- 截图：`docs/_artifacts/gov/shots/tol5-1440.png`、`tol5-1280.png`、`tol5-375.png`。
- 验证：`npx vitest run src/modules/tools` → **2 files / 23 tests passed**；全量 → **131 files / 1371 tests passed**；`tsc -b . --noEmit` 仅基线 `src/modules/employees/EmployeesModulePage.test.tsx(73,5): TS18047`，本域 0；build 到 `/tmp/tools-build` 被同一基线错误阻断。
- 边界：仅改 `web/src/modules/tools/**` + `docs/_artifacts/gov/**`；未改 App/shell/routes/registry/package·lock/scripts/ops；未 install；未并 main、未重建 9122；未跑独立观察者。真实 token/密钥/二维码未读取、未渲染。

## R40 强制态 rid 保留（shell 侧，2026-11-20）

- 根因：`ConsolePane` 在 `?state=` 强制态直接渲染 shell `StateBlock`，不再挂载模块页；shell 只解析 `state`，未把 `rid` 读入状态块，且 tab 链接会丢掉全部 search 参数。
- 修复：
  - `web/src/shell/fixtures.ts`：新增 `FIXTURE_RID_KEY`、通用 `readQueryParam`、`parseFixtureRid`（hash 优先）、`currentFixtureRid`。
  - `web/src/shell/console.tsx`：`usePaneRid`；`StateRid` 显示「请求编号：<rid>」并提供复制按钮（无 rid 才回退到无编号说明）；`StateBlock`/`ConsolePane`/模块页/员工详情页透传 rid；`ConsoleTabStrip` 与详情 zone 链接保留除 `tab|view|zone` 外的全部 search 参数。
- 单测：`npx vitest run src/shell` → **5 files / 43 passed**；新增 rid 解析、强制态 rid 屏显+复制、tab 切换保 rid 三个用例。
- 类型：`tsc -b . --noEmit` 仅基线 `src/modules/employees/EmployeesModulePage.test.tsx(73,5): TS18047 'root' possibly null`，本域 0 错。
- assert-ia：`--source=html` 与 `--source=react` 均 exit 0，counts 51/22/1/8，无新增 Tab。
- 活体：9122 当前代次 d0b50590 不含此修复；源码+单测自证，活体待下代次。未重建 9122、未并 main。

## R42 — /system?tab=retention 保留与清理只读面（R41 派工）

- 基线：`origin/lane/hermes-console` gate ledger `8bbf8910`（stamped at `53a3ef4c`）；本地 `lane/console-gov` 以 merge `5098c64d` 对齐，未 rebase/force。
- 端点实测（9122，登录 cookie 不落日志）：
  - `GET /agent-api/api/retention` → **404** `{"code":"console.unknown_route","message":"unknown console API route"}`。
  - `GET /api/retention`、`/api/retention-policy`、`/api/data-retention` → **200 text/html**（SPA 外壳，不是 JSON 数据面）。
  - 结论：保留/清理读口未接入；页面按四区诚实「未接入」列出，不画 0 天、0 B 或样例清理记录；`GAP-13` 只在 `title` 与折叠技术详情。
- 实现：
  - 四区固定审计事件 / 运行记录 / 会话日志 / 上传物；每区保留天数、最近清理、下次执行（北京时间到分）、当前占用、阈值、占用比例。
  - 缺失字段一律 `—` + `title` 原因；真实 0 显示 `0 B` / `0%`；`readRetention` 只把服务返回的区标为已接入，未返回的区继续标「未接入」。
  - 新增超限提示：`used > limit` 显示「已超限：占用比阈值多 …」；`used === limit` 显示「已达阈值：…」；两者都只在服务给出有效阈值时出现。
  - 写型按钮（立即清理 / 修改策略）保持 `disabled` + `aria-disabled` + `data-planned` + `title`，零可点写入口。
  - 四态内容面：`?state=loading` 骨架不请求；`?state=empty` 说明「没有读到记录，不代表 0」；`?state=error&rid=` 人话 + 可复制请求编号 + 重试；`?state=ready` 走真实读口。实际 403/404 共用同一整页文案与请求编号。
- 四态 DOM 读数（1440，临时 harness，已删除）：
  - loading：`ret4-loading=true`，`sections=0`，无请求。
  - empty：`ret4-empty` 文案含「不代表保留天数是 0」，`sections=0`，无请求。
  - error：`ret4-error` 含「数据保留与清理没能读出来」，`ret4-error-request-id` 含 `abc12345`，复制按钮 aria-label「复制请求编号」，`ret4-error-retry=true`，`sections=0`。
  - ready：4 个区，`ret4-over-audit` 含「已超限：占用比阈值多 200 B」；「已达阈值」由单测锁定。
- 三档宽度（DOM，ready）：1440/1280/375 均为 `bodySW=bodyCW=pageSW=pageCW=1440/1280/375`，无横溢。
- 截图：`docs/_artifacts/gov/shots/ret4-1440.png`、`ret4-1280.png`、`ret4-375.png`。
- 验证：`npx vitest run src/modules/audit/RetentionModulePage.test.tsx` → **1 file / 11 tests passed**；`npx vitest run src/modules/audit` → **10 files / 161 passed**；全量 `npx vitest run` → **131 files / 1388 passed**；`tsc -b . --noEmit` 仅基线 `src/modules/employees/EmployeesModulePage.test.tsx(73,5): TS18047`，本域 0 错。
- 边界：仅改 `web/src/modules/audit/**` + `docs/_artifacts/gov/**`；未改 App/shell/routes/registry/package·lock/web scripts/ops；未 install；未并 main、未重建 9122；未跑独立观察者。

## R42 skills real-data surface (SKL4)

- Base: `d26a66d5` (web/src 01175128). Write domain: `web/src/modules/skills/**` + this DONE.
- Endpoint truth (9122, auth cookie, value never printed):
  - `GET /agent-api/api/skills` -> **200 application/json**, `{"items":[],"asOf":"2026-11-19T22:15:01.655Z"}` (true empty, 0 rows).
  - `GET /api/skills` -> **200 text/html** (SPA shell), not a data API.
- Page: columns 技能名 / 来源/类型 / 启用态 / 最近更新 / 共享范围; source/status humanized with unknown raw -> 其他来源/待核实; missing `—` + reason; BJT to minute; no fake 0.
- 403 and 404 share the same 「技能读口未接入」 body, GAP-SKL4-01 only in `title`, `#/approvals` apply link.
- Four states content-switch: `?state=loading|empty|error&rid=...`; error shows copyable request id + retry and clearing preview re-fetches; ready reads live.
- Zero write: `skl4-planned-create` disabled, `data-planned`, `aria-disabled`, reason in `title`; no other write controls.
- Tests: `npx vitest run src/modules/skills` -> **1 file / 11 tests passed**. Full suite -> **131 files / 1399 passed**.
- `tsc -b . --noEmit`: only baseline `src/modules/employees/EmployeesModulePage.test.tsx(73,5) TS18047`; zero skills errors.
- Build to `/tmp/skills-build` blocked by that same baseline typecheck (BUILD_EXIT 2); no 9122 rebuild.
- DOM (ready, two rows): 1440/1280/375 `bodySW==bodyCW==pageSW==pageCW==vw`; 375 table scroll 760/373 inside card only. Screenshots `docs/_artifacts/gov/shots/skl4-{1440,1280,375}.png`.
- Boundaries: no App/shell/routes/registry/manifest/package·lock/web scripts/ops changes; no install; no main merge; no observer.

## R43 /capabilities?tab=tools 工具清单真数据面（2026-11-20）

- 基线：merge `bc94be67`（`origin/lane/hermes-console` f0419b0b，gate 代次 02a7385c）；未 reset，`bd5fc469`（skills）保留为祖先。
- 端点实测（9122，登录 cookie 只读、不打印）：`/agent-api/api/tools` → **404** `console.unknown_route`；`/agent-api/api/tools/toolsets` → **404**；`/agent-api/api/mcp/servers` → **404**。同源 `/api/tools*` → **200 text/html**（SPA 外壳，非 JSON）。9119 原生：`/api/tools` → 404 No such API endpoint；`/api/tools/toolsets` → **200，26 toolsets**；`/api/mcp/servers` → **200，0 servers**。
- 实现：`fetchInventory` 依次尝试 `/agent-api/api/tools` → `/api/tools` → 既有 toolsets 两候选；平铺数组/`{items|tools|data}` 与 toolsets 形状均可读。行字段：工具名、类型/来源、启用态（正常/停用/待核实）、最近更新时间（BJT 到分；缺失 `—` + title/可见原因）。原「最近调用」保留但不再冒充更新时间。
- 页面：新增 `tl3-page`、`tl3-row-*`、`tl3-name/type/status/updated`、`tl3-request-id`、`tl3-retry`、`tl3-apply`、`tl3-planned-create`；保留全部 `tol5-*` 旧标记。403 与 404 同一「工具读口未接入」体，GAP-04 只在 title；错误态可复制请求编号+重试；零写入口，仅一个不可点「新建工具」（data-planned + aria-disabled + title）。
- 验证：`npx vitest run src/modules/tools` → **2 files / 23 tests passed**；全量 `npx vitest run` → **131 files / 1404 passed**；`tsc -b . --noEmit` → 仅基线 `employees/EmployeesModulePage.test.tsx(73,5) TS18047`，本域 0。DOM（临时 harness，已删；Vite 5454 / Chrome 9256）：1440/1280/375 `vw=bodySW=bodyCW=pageSW=pageCW`，行 3，状态 正常，最近更新 `—` + 原因，`data-fixture` 为 null；四态 testid 与文案逐态不同（loading/empty/error/denied）。
- 截图：`docs/_artifacts/gov/shots/tl3-{1440,1280,375}.png`。
- 边界：只改 `web/src/modules/tools/**` 与 DONE/截图；未改 App/shell/routes/registry/package·lock/web scripts/ops；未并入 main、未重建 9122；无独立观察者。

## R44 /capabilities 顶部计数与来源状态（2026-11-20）

- 基线：merge `bc94be67`（`origin/lane/hermes-console` f0419b0b），保留已推 `bd5fc469`/`fb8722c2`；未 reset。
- 实现：新增 `web/src/modules/capabilities/{counts.tsx,counts.css}`。计数条在技能页与工具页顶部（`cap4-count-strip`），skills/tools 各一项，值来自各自列表请求的同一结果（同一 `rows` 长度），不另发请求；模块级快照经 `useSyncExternalStore` 跨 tab 保留，未访问项显示 `—`/未取数，不闪 0。
- 状态：`有源` / `有源（空）` / `无源` / `加载中` / `未取数`。403/404 计数 `—` + 无源，GAP-SKL4-01 / GAP-04 只在 title；错误/部分来源时计数 `—` 并写原因；真实 0 行显示 0 + 有源（空）。
- testid：`cap4-count-strip`、`cap4-count-skills|tools`、`cap4-count-skills|tools-state`；保留 `skl4-*` / `tl3-*` / `tol5-*`。
- 验证：`npx vitest run src/modules/skills src/modules/tools` → **3 files / 34 tests passed**；全量 `npx vitest run` → **131 files / 1404 passed**；`tsc -b . --noEmit` → 仅基线 `employees/EmployeesModulePage.test.tsx(73,5) TS18047`，本域 0。
- DOM（临时 harness，已删；Vite 5455 / Chrome 9257）：技能页 1440/1280/375 `vw=bodySW=bodyCW`，page 1408/1248/343，技能 `2 有源`、工具 `— 未取数`；切工具页后工具 `4 有源`，技能仍 `2 有源`（缓存不闪错值）。截图 `docs/_artifacts/gov/shots/cap4-counts-{1440,1280,375}.png`。
- 边界：只改 `web/src/modules/{capabilities,skills,tools}/**` 与 DONE/截图；未改 App/shell/routes/registry/package·lock/web scripts/ops；未并入 main、未重建 9122；无独立观察者。

## R45 /capabilities skills/tools 名称搜索过滤（2026-11-20）

- 基线：merge `bc94be67`（`origin/lane/hermes-console` f0419b0b，含 02a7385c）；未 reset，`8840bf29`（cap4 counts）保留。
- 端点实测（9122，登录 cookie 只读、不打印）：`/agent-api/api/skills` → **200**（46 B，`items: []`）；加 `?q=zzz` / `?query=zzz` / `?name=zzz` 均为 **200** 且载荷不随参数变化，判定服务端不接受名称过滤。`/agent-api/api/tools` → **404**；`/agent-api/api/tools?q=zzz` → **404**；同源 `/api/tools/toolsets?q=zzz` → **200 text/html**（SPA 外壳，非 JSON）。
- 实现：因后端不吃检索参数，采用**当前已加载行本地过滤**。新增 `web/src/modules/capabilities/search.tsx`（`cap5-search` 输入、`cap5-clear` 清空、`cap5-scope-note` 明写「仅在当前已加载 N 项内搜索」，不冒充服务端过滤）。检索词写 `?q=`，刷新/切 tab 可复现；过滤不触发额外请求。
- 技能页：按技能名过滤 `skl4-table` 行；无匹配显示 `skl4-no-match`「没有匹配项」+ `skl4-clear`；计数条改用可见行数（`cap4` 同源口径，0 行显 0 + 有源（空），不回退成 `—`/假 0）。
- 工具页：按工具名过滤 tools/MCP 行；无匹配显示 `tl3-no-match`（说明当前已加载项数）+ `tl3-clear`；计数条改用可见行数；分区计数随过滤结果收敛。
- 验证：`npx vitest run src/modules/tools src/modules/skills` → **3 files / 38 tests passed**（tools 25 / skills 13）；全量 `npx vitest run` → **131 files / 1408 passed**；`tsc -b . --noEmit` → 仅基线 `employees/EmployeesModulePage.test.tsx(73,5) TS18047`，本域 0。
- DOM（临时 harness，已删；Vite 5456 / Chrome 9258）：1440/1280/375 所有用例 `vw=bodySW=bodyCW`、page 宽等于视口。技能 `?q=资料`：1 行、计数 `技能1有源`、范围注 `仅在当前已加载 2 项内搜索`；`q=zzz`：0 行、`技能0有源（空）`、`没有匹配项`+清空。工具 `?q=网页`：2 行、`工具2有源`、范围注 4 项；`q=zzz`：0 行、`工具0有源（空）`、无匹配+清空。搜索全程请求数不增。
- 边界：只改 `web/src/modules/{capabilities,skills,tools}/**` 与 DONE；未改 App/shell/routes/registry/package·lock/web scripts/ops；未并入 main、未重建 9122；无独立观察者。

## R46 /capabilities 清单 CSV 导出（2026-11-20）

- 基线：`f664a67c`（cap5 搜索）之上，merge 与 `origin/lane/hermes-console` 已同步；未 reset。
- 实现：纯前端导出，无新后端端点。`web/src/modules/capabilities/csv.ts` 固定表头 `name,type,enabled,updated_at`，字段按 RFC4180 转义（逗号/引号/换行，引号翻倍），缺值留空；文件名按北京时间 `capabilities-<tab>-YYYYMMDD-HHmm.csv`。`csvExport.tsx` 提供 `cap6-export` 按钮与 `cap6-export-count`，Blob + `a.download`，空集禁用并在 title 写「当前视图无可导出数据」。技能/工具页均导出**当前 tab + 当前搜索词**的可见行，不触发额外请求、不触发行点击或 tab 切换。
- 验证：`npx vitest run src/modules/capabilities src/modules/skills src/modules/tools` → **4 files / 40 tests passed**（含 RFC4180、文件名、空集禁用、q 过滤后条数）；全量 **132 files / 1410 passed**；`tsc -b . --noEmit` 仅基线 employees `TS18047`，本域 0。
- DOM（临时 harness，已删；Vite 5457 / Chrome 9259）：1440/1280/375 全部 `vw=bodySW=bodyCW=pageSW=pageCW`；技能 `?q=资料` 1 行/`1 条`/按钮可用，`q=不存在` 0 行/`0 条`/按钮禁用且 title 正确；工具 `?q=网页` 2 行/`2 条`/按钮可用。
- 边界：只改 `web/src/modules/{capabilities,skills,tools}/**` 与 DONE；未改 App/shell/routes/registry/package·lock/web scripts/ops；未并 main、未重建 9122；无独立观察者。

## R47 /capabilities 行详情与来源证据（2026-11-20）

- 基线：`f232b4f2` 之上 `git merge --no-ff origin/lane/hermes-console` → merge `bdf795c0`（26 files），保留已推 CSV 导出。
- 实现：新增 `web/src/modules/capabilities/rowDetail.tsx`，行内「详情」展开六项证据：口径名 / 来源 / 启用态 / 最近更新 / 读口路径 / 采集时刻。缺字段统一显示「该字段未返回」，原因只进 `dd` 的 title；采集时刻只认 payload 顶层 asOf，绝不使用本机时钟。
- 技能页：每行 `cap7-detail-toggle`（详情/收起，`aria-expanded`），同时只允许一行展开；详情 `cap7-detail-skills`，读口 `/agent-api/api/skills`，asOf 缺失时 title 写「这次读数没有带采集时刻。」。技能名/来源/启用态/更新时间直接复用列表行真值。
- 工具页：`Row` 增加 `open/onToggle` 与 `cap7-detail-toggle`；详情 `cap7-detail-tools`，toolset 行读口 `/api/tools/toolsets`、MCP 行 `/api/mcp/servers`；清单接口是数组、无顶层采集时刻，故采集时刻恒为「该字段未返回」+ title 原因，最近更新同样按上游缺失或真值显示。展开不改 `?q=` 搜索态、不触发新请求，同时只有一行展开。
- 验证：`npx vitest run src/modules/skills src/modules/tools` → **3 files / 40 tests passed**（技能 14、工具 26；新增单开/收起/缺 asOf/搜索不变用例）。全量 `npx vitest run` → **132 files / 1455 passed**，另有 2 个 unhandled rejection 来自基线 `modules/employee-detail/EmployeeDetailModulePage.tsx` 的 `api is not defined`（非本域，未修）。`tsc -b . --noEmit` → 6 行，全部属于基线 employee-detail/employees，本域 0。
- DOM（临时 harness，已删；Vite 5458 / Chrome 9260）：1440/1280/375 技能页与工具页 `vw=bodySW=bodyCW=1440/1280/375`，`pageSW=pageCW`（技能 1408/1248/343，工具页同视口）；展开后详情数均 1，文本含口径名/来源/启用态/最近更新/读口路径/采集时刻，缺失项显示「该字段未返回」。
- 截图：`docs/_artifacts/gov/shots/cap7-skills-{1440,1280,375}.png`、`cap7-tools-{1440,1280,375}.png`。
- 边界：只改 `web/src/modules/{capabilities,skills,tools}/**` 与 DONE/截图；未改 App/shell/routes/registry/package·lock/web scripts/ops；未并 main、未重建 9122；无独立观察者。

## R48 版本与健康真数据面（2026-11-20）

- 基线：显式 refspec fetch 后已与 `origin/lane/hermes-console` 同步（=6a02ed58，wave-16），`git merge --no-ff` 报 Already up to date；保留已推 `1d321200`。toplevel 校验通过。
- 端点实测（9122，登录 cookie 只读、不打印）：`/agent-api/api/version` → **404** `console.unknown_route`（无版本读口）；`/agent-api/api/health` → **200** `console.health.sources.v1`，`ok:true`、`asOf:2026-11-19T23:17:09Z`、3 个 sources。同源 `/api/version`、`/api/health` 均为 **200 text/html**（SPA 外壳，非 JSON）。
- 实现：新增 `web/src/modules/version/{versionHealth.ts,VersionHealthSurface.tsx}`，并在 `VersionPage` 头部下方挂载，现有 `ver4-*` 构建/依赖/单价区不动。
  - 版本表列 = 组件名 / 版本 / 构建时刻（BJT 到分）/ 状态人话（正常·降级·待核实）。缺值「—」，原因只进该单元格 title；禁 `?? 0`、禁编造版本号；状态映射 ok/healthy→正常，degraded/warn/partial/down→降级，其余→待核实。
  - 403/404 同一「版本读口未接入」体，`GAP-VER5-01` 只在 title；401 登录失效；5xx/网络人话 + 可复制 `ver5-request-id` + `ver5-retry`；`ver5-apply` 去 `/approvals`。零写入口。
  - 整体健康行独立读 `/agent-api/api/health`：正常/降级/待核实 + 采集时刻 BJT + 来源项数；健康失败只降级该行（「不影响上方版本表」），不阻塞版本表，`GAP-VER5-02` 只进 title。
  - 四态：`ver5-loading` / `ver5-empty` / `ver5-error`（或 gap）/ `ver5-table`；`?state=loading|empty|error` 由现有全局预览接管，不额外请求。
- 验证：`npx vitest run src/modules/version` → **2 files / 12 tests passed**（新增 `VersionHealthSurface.test.tsx` 5 条：404 gap+health、403≡404、真实行与缺字段原因、健康失败不阻塞、空/错误预览零请求）。全量 `npx vitest run` → **133 files / 1460 passed**，另有 2 个 unhandled rejection 来自基线 `modules/employee-detail` 的 `api is not defined`（非本域）。`tsc -b . --noEmit` → 6 行全为基线 employee-detail/employees，本域 0。
- DOM（临时 harness，已删；Vite 5459 / Chrome 9261）：1440/1280/375 `vw=bodySW=bodyCW=1440/1280/375`，`ver5-page` 宽 1406/1246/341，版本行 2，健康 `正常`，首行 `控制台 / 4.2.1 / 2026-11-20 00:05 / 正常`；版本表 560px 仅在卡内横向滚动，页面不横溢。截图 `docs/_artifacts/gov/shots/ver5-{1440,1280,375}.png`。
- **需壳层注册（本 lane 不可改）**：`/capabilities?tab=version` 目前不在 `CONSOLE_TABS`，未知 tab 回落到技能页；`App.tsx` `/capabilities` live map 也无 `version` 节点。要按目标路由上屏，需壳层：①`routes.ts` 增 capabilities 的 version tab（hash `#/capabilities?tab=version`，并相应迁出/保留 system version 以维持 22 tab 口径）；②`App.tsx` `/capabilities` live map 挂 `version: <VersionConsolePage />`（或本 surface）。当前同一 surface 已在既有真路由 `/system?tab=version` 挂载可用。
- 边界：只改 `web/src/modules/version/**` 与 DONE/截图；未改 App/shell/routes/registry/package·lock/web scripts/ops；未并 main、未重建 9122；无独立观察者。

## R49 /system 系统健康真数据面（2026-11-20）

- 基线：显式 refspec fetch 后 `git merge --no-ff origin/lane/hermes-console`（tip 5d91f22d，代码代次 6a02ed58）→ merge `3a137624`，保留已推 `7780108f`；未 reset。
- 端点实测（9122，登录 cookie 只读、不打印）：`/agent-api/api/health` → **200** `console.health.sources.v1`，`ok:true`、顶层 `asOf:2026-11-19T23:17:09Z`、3 个 sources（console/runtime/bisheng）；同源 `/api/health` → 200 text/html 外壳。`/agent-api/api/version` 仍 404（ver5 已诚实处理）。
- 实现：新增 `web/src/modules/health/{systemHealth.ts,SystemHealthSurface.tsx}` 并挂在 `HealthPage` 头部下方，既有 `hlt5-*` 探针区保留不动。
  - 服务表列 = 服务名 / 状态人话（正常·降级·不可达·待核实）/ 版本或构建标识 / 最近检查时刻 / 响应耗时。状态映射 ok/healthy→正常，degraded/warn/partial→降级，down/error/unreachable/failed→不可达，其余→待核实；版本缺失「—」+title，不编造版本号；检查时刻**只取 payload 顶层 asOf**，缺失/不可解析→「—」+title，绝不使用本机时钟；耗时缺失「—」+title。
  - 404/403 同一「健康读口未接入」体，`GAP-SYS3-01` 只进 title；401 登录失效；5xx/网络人话 + 可复制 `sys3-request-id` + `sys3-retry`；`sys3-apply` 去 `/approvals`。零写入口，仅一个 `sys3-planned-edit`（data-planned + aria-disabled + title）。
  - 四态：`sys3-loading` / `sys3-empty`（空清单不补服务行、不给绿色结论）/ `sys3-error`（或 gap）/ `sys3-table`；`?state=loading|empty|error` 由现有全局预览接管，不额外请求。
- 验证：`npx vitest run src/modules/health` → **2 files / 14 tests passed**（新增 `SystemHealthSurface.test.tsx` 6 条：状态/顶层时刻/缺字段、403≡404、500 rid+重试、空清单、无本机时钟、预览零请求与 planned 控件）。全量 `npx vitest run` → **134 files / 1466 passed**，另有 2 个基线 employee-detail unhandled（非本域）。`tsc -b . --noEmit` → 6 行全为基线 employee-detail/employees，本域 0。
- DOM（临时 harness，已删；Vite 5460 / Chrome 9262）：1440/1280/375 `vw=bodySW=bodyCW=1440/1280/375`，`sys3-page` 宽 1406/1246/341，行 3，整体 `正常`，首行 `控制台服务(BFF) / 正常 / 4.2.1 / 2026-11-19 23:17 / 12 ms`；375 仅表格在卡内滚动（680/311），页面不横溢。截图 `docs/_artifacts/gov/shots/sys3-{1440,1280,375}.png`。
- 边界：只改 `web/src/modules/health/**` 与 DONE/截图；未改 App/shell/routes/registry/package·lock/web scripts/ops；未并 main、未重建 9122；`hlt5-*` 与 `ver5-*` 未破；无独立观察者。

## R50 /system 系统健康行详情（2026-11-20）

- 基线：显式 refspec fetch 后与 `origin/lane/hermes-console` 同步（tip 5d91f22d，代码代次 6a02ed58），`git merge --no-ff` 报 Already up to date；保留已推 `76ccc9ca`，未 reset。
- 端点：继续读 `/agent-api/api/health`（9122 实测 **200** `console.health.sources.v1`，顶层 `asOf:2026-11-19T23:17:09Z`，3 sources）；无新增后端端点。
- 实现：`SystemHealthSurface` 行可点/可键盘展开，行下详情 `sys4-detail-*`：
  - 服务名、口径（读口路径，默认 `/agent-api/api/health`）、状态依据（3 条人话：服务判定、整体健康、只依据本次响应）、最近检查时刻（只取 payload 顶层 `asOf`，缺失 `该字段未返回`+title，禁本机时钟）、响应耗时（缺失 `该字段未返回`+title）、最近一次错误摘要。
  - 错误摘要强制脱敏：`Authorization: Bearer …`、`token/cookie/secret/password/api_key/access_key/private_key` 赋值、`sk-*`/`ghp_*`/JWT 一律打码为 `***`，显示「已脱敏 N 处」；超 200 字截断标「摘要已截断」；不保留/不渲染整段原文，raw 不进 title。
  - 行 `tabIndex=0`、Enter/Space 展开、Esc 收起；同时只允许一行；展开不改 tab/URL（实测 `location.search` 为空）。无「重试该服务检查」写入口，详情明写只读；既有 planned 编辑按钮保持 data-planned + aria-disabled + title。
  - 四态/gap/403≡404 沿用 sys3 不退化；`sys4-*` 新增，`sys3-*`/`ver5-*`/`cap4-7`/`skl4`/`tl3` 未改。
- 验证：`npx vitest run src/modules/health` → **2 files / 16 tests passed**（新增 2 条：单开/字段/脱敏计数、Enter 开 Esc 关且 URL 不变）。全量 `npx vitest run` → **134 files / 1468 passed**，另有 2 个基线 employee-detail unhandled（非本域）。`tsc -b . --noEmit` → 6 行全为基线 employee-detail/employees，本域 0。
- DOM（临时 harness，已删；Vite 5461 / Chrome 9263）：1440/1280/375 `vw=bodySW=bodyCW`，`sys3-page` 1406/1246/341，行 3、展开详情 1；详情显示 `/agent-api/api/health`、3 条状态依据、`2026-11-19 23:17`、`12 ms`、`token: *** cookie: *** api_key: ***`+「已脱敏 3 处」；375 仅表格内滚动（680/311），页面不横溢。截图 `docs/_artifacts/gov/shots/sys4-{1440,1280,375}.png`。
- 边界：只改 `web/src/modules/health/**` 与 DONE/截图；未改 App/shell/routes/registry/package·lock/web scripts/ops；未并 main、未重建 9122；无独立观察者。

## R51 /system 健康状态计数条（2026-11-20）

- 基线：显式 refspec fetch 后 `git merge --no-ff origin/lane/hermes-console` 报 Already up to date；HEAD `97c72f09`（保留已推 sys4），代码代次 6a02ed58 / 远端 tip 5d91f22d；未 reset。
- 端点：`/agent-api/api/health` 9122 实测 **200** `console.health.sources.v1`，顶层 `asOf` + sources；本页未新增端点、未新增请求。
- 实现：`SystemHealthSurface` 在 Card 顶部新增 `sys5-counts`，四桶 正常/降级/不可达/待核实（`sys5-count-normal|degraded|unreachable|unknown`）。计数**只由本次 `/api/health` 响应行现算**，ready 时 0 也照实显示 0；gap/loading/error/login 时每桶显示「—」，title 写明原因（读口未接入/正在读取/读取失败），不补 0。空清单给「健康接口返回了空清单，计数为 0；这不等于所有服务正常。」
- 筛选：点桶为**本地筛选、不改 URL**（写明「筛选只在本地生效，不改网址；刷新后回到全部服务。」）；再点同桶或 `sys5-clear` 清除；`aria-pressed` 标记选中；筛选后无行显示 `sys5-filter-empty`「当前筛选下没有服务；计数来自同一次健康响应，这里不补服务行。」。筛选不触发新请求（单测断言 fetch 次数恒为 1）。行详情 sys4 与四态、403≡404 未改。
- 验证：`npx vitest run src/modules/health` → **2 files / 17 tests passed**（新增 1 条：同响应计数+本地筛选+零额外请求+清空）。全量 `npx vitest run` → **134 files / 1469 passed**，另有 2 个基线 employee-detail unhandled（非本域）。`tsc -b . --noEmit` → 6 行全为基线 employee-detail/employees，本域 0。`node scripts/build/web.mjs --source . --out /tmp/sys5-build --icons .` → exit 1，仅被同一基线类型错误挡住（employee-detail `api` 未定义、employees TS18047），无本域错误；未重建 9122。
- DOM（临时 harness，已删；Vite 5460 / Chrome 9260）：1440/1280/375 `vw=bodySW=bodyCW`，`sys3-page` 1440/1280/375，行 4；计数 `正常1/降级1/不可达1/待核实1`；点「正常」后仅 1 行 `控制台服务(BFF)`、`aria-pressed=true`、body 宽不变；375 仅表格卡内滚动（680/343），页面不横溢。截图 `docs/_artifacts/gov/shots/sys5-{1440,1280,375}.png`。
- 边界：只改 `web/src/modules/health/**` 与 DONE/截图；未改 App/shell/routes/registry/package·lock/web scripts/ops；未并 main、未重建 9122；sys3/sys4/ver5/cap4-7/skl4/tl3 未破；无独立观察者（截图复核未回，未阻塞）。
- 观察者复核修正（sys5，2026-11-20）：1440/1280 PASS，375 FAIL——sys3 表格第 3 列在卡片内边缘被截断，第 4/5 列完全在屏外且**没有任何横向滚动提示**。修法：`SystemHealthSurface` 表格滚动区前加 `sys3-scrollhint`「左右滑动查看全部列」（≤720px 显示），并为 `.sys3-scroll` 加右缘 18px 渐隐 mask（仅 ≤720px），保留 `overflow-x:auto`。复测 375：`hintDisplay=block`、mask 生效、`scrollSW=680 / scrollCW=311`、`bodySW=bodyCW=375`，页面不横溢；截图 `sys5-375.png` 已重拍。健康单测 21/21（新增 hint 断言）。非阻塞项（计数口径两源并存、全宽带无内边距、两处对比度 ~3.3）本笔未改，如实记录。

## R52 /system 本页数据来源矩阵（2026-11-20）

- 基线：显式 refspec fetch 后 `git merge --no-ff origin/lane/hermes-console` 报 Already up to date；从已推 `58c055f4` 继续，未 reset。
- 数据来源：矩阵只复用本页四笔既有读取——`/agent-api/api/health`（系统健康清单）与 `__health-probe__` / `hermes-summary` / `/api/skills` 三个探针；**不新增任何请求**。实测展开前后 fetch 调用数恒为 4。
- 实现：新增 `web/src/modules/health/sourceReads.ts`（模块级快照 + `useSyncExternalStore`，读口读取时发布状态/耗时/顶层 asOf/请求号；展开状态也在模块级，切 tab 卸载再挂载不丢）与 `SourceMatrix.tsx`，挂在 HealthPage 底部，默认收起。
  - 每行：口径名 / 实际请求路径 / 本次状态（成功·降级·失败·读口未接入·读取中·预览未读取）/ 响应耗时（实测 ms，无则「—」+title）/ 采集时刻。
  - 采集时刻**只取响应顶层 ISO `asOf`**；缺失、非 ISO、无法解析一律「—」并在 title 写原因，绝不用本机时钟；`/health` 顶层 `asOf` 与 `/api/skills` 顶层 `asOf` 正常显示为北京时间到分。
  - 403/404 行状态「读口未接入」+ 人话原因 + `#/approvals` 去处；`GAP-SYS6-01` 只进该状态格 title；失败行显示可复制请求编号（短码在正文、完整值在 title），上游原始错误只进 title，不直接上屏。
  - 展开不写 URL（实测 `location.search` 仍为 `?tab=health`），无独立请求；sys3/sys4/sys5 既有 testid 与行为未改。
- 验证：`npx vitest run src/modules/health` → **3 files / 21 tests passed**（新增 4 条：四读口字段/路径/耗时/asOf、非 ISO 不用本机时钟、展开跨重挂载保留且不改 URL、预览零请求）。全量 `npx vitest run` → **135 files / 1473 passed**，另有 2 个基线 employee-detail unhandled（非本域）。`tsc -b . --noEmit` → 6 行全为基线 employee-detail/employees，本域 0。
- DOM（临时 harness，已删；Vite 5462 / Chrome 9264）：1440/1280/375 `vw=bodySW=pageSW=视口`；展开前 table 不存在、展开后 4 行；耗时 1–4 ms；asOf `2026-11-19 23:17` / `—` / `—` / `2026-11-20 06:15`；汇总 `4 个读口 · 成功 2 · 失败 1 · 读口未接入 1`；375 仅矩阵卡内滚动（760/343），页面不横溢。截图 `docs/_artifacts/gov/shots/sys6-{1440,1280,375}.png`。
- 边界：只改 `web/src/modules/health/**` 与 DONE/截图；未改 App/shell/routes/registry/package·lock/web scripts/ops；未并 main、未重建 9122；无独立观察者。

## R53 /capabilities 行详情（cap7 补强，2026-11-20）

- 基线：显式 refspec fetch 后 `git merge --no-ff origin/lane/hermes-console` 报 Already up to date；从已推 `46cfa271` 继续，未 reset。
- 端点实读（9122，登录 cookie 只读、不打印）：`/agent-api/api/skills` → **200**，顶层 `asOf=2026-11-19T23:49:51.387Z`、`asOfSource=null`、`items=[]`；换算北京时间 `2026-11-20 07:49`。
- 实现补强：
  - `skills.ts` 新增严格顶层 asOf 取值：只认 `payload.asOf` 且必须是 ISO（正则 + 可解析）；`as_of/generatedAt/generated_at` 一律不再兜底；缺失/非 ISO 一律「—」+title 原因（`响应顶层没有 asOf` / `不是 ISO 时间`）。`asOfSource` 只写进采集时刻的 title（`asOfSource：…`），正文不出现。
  - `rowDetail.tsx`：采集时刻 cell 的 title 同时支持缺值原因与 `asOfSource`；有值有 title 时也保留悬停说明。
  - 工具页：`ToolRow` 新增 `asOf/asOfReason`，`readInventory/readToolsets/readServers` 统一按“数组无顶层 asOf、对象取顶层 ISO asOf”打标；详情直接用行上的 asOf，不再写死 null。MCP 与工具集各自读口路径保持分别显示。
  - 技能页与工具页都加 Esc 收起（仅展开时挂 keydown，卸载清理）；展开/收起不改 URL，`?tab=` 与 `?q=` 保持；同时仍只允许一行展开。
  - 页面级 403/404 仍是整页「读口未接入」+原因+`#/approvals` 去处，GAP 只在 title；四态未改。
- 验证：`npx vitest run src/modules/skills src/modules/tools src/modules/capabilities` → **4 files / 45 tests passed**；全量 `npx vitest run` → **135 files / 1477 passed**，另有 2 个基线 employee-detail unhandled。`tsc -b . --noEmit` 本域 0（6 行均为基线 employee-detail/employees）。
- DOM（临时 harness，已删；Vite 5465 / Chrome 9266）：1440/1280/375 技能页与工具页 `bodySW=bodyCW=pageSW=pageCW=视口`，详情 1 行展开；技能详情 口径名 资料整理 / 来源 平台内置 / 启用态 正常 / 最近更新 `2026-11-19 14:30` / 读口 `/agent-api/api/skills` / 采集时刻 `2026-11-20 07:49`，title `asOfSource：台账快照`（stub 证明 asOfSource 只进 title）；`?q=资料` 与 `?q=网页` 展开前后保持。工具详情读口 `/api/tools/toolsets`，数组无顶层 asOf →「该字段未返回」+title。
- 截图：`docs/_artifacts/gov/shots/cap7-skills-{1440,1280,375}.png`、`cap7-tools-{1440,375}.png`。
- 边界：只改 `web/src/modules/{capabilities,skills,tools}/**` 与 DONE/截图；未改 App/shell/routes/registry/package·lock/web scripts/ops；未并 main、未重建 9122；无独立观察者。

## R54 /capabilities 排序与 URL 同源 + 导出顺序一致（cap8，2026-11-20）

- 基线：显式 refspec fetch 后 `git merge --no-ff origin/lane/hermes-console` 报 Already up to date；从已推 `764922cf` 继续，未 reset。
- 排序实现：新增 `capabilities/sorting.ts`——`?sort=name|type|updated&dir=asc|desc` 为唯一来源；`none→asc→desc→none` 循环；缺值恒排最后、并列保留台账原序；未知 sort/非法 dir 回落默认序。技能表三列表头与工具页排序条均用真 `<button type="button">`（键盘 Enter/Space 原生可触发），`th` / `columnheader` 上 `aria-sort=ascending|descending|none`，指示符 `↕/↑/↓`。
- URL 同源：点击排序写入 `sort`/`dir` 并保留 `tab`、`q`、`state`；粘 URL 与刷新直接复现（技能 `?sort=name&dir=asc`、工具同）；`state` 清空排序回到默认序。
- 零额外请求：技能点表头 fetch 计数 1→1；工具 6→6（DOM 实测，排序只重排内存行）。
- 导出同序：`cap6-export` 的 CSV 行序与当前表体逐行相同。
  - 技能按 `updated` 升序：DOM 首 Gamma / 末 Delta；CSV 首 `Gamma,平台内置,正常,2026-11-10 14:00`、末 `Delta,平台内置,正常,2026-11-14 14:00`，共 5 行 + 表头。
  - 工具按名称升序后切 `updated`（全缺）：DOM 首 网页搜索 / 末 doc write；CSV 首 `网页搜索,网页搜索与抓取,enabled,`、末 `doc write,Doc,enabled,`，共 6 行 + 表头；工具导出顺序按表体两段（工具集 → MCP）拼接，不再用可能交错的原始数组。
  - 无排序参：默认序 DOM 与 CSV 同序（单测 `B2/A1/C3` 与工具默认首末对照）。
- 验证：`npx vitest run src/modules/capabilities src/modules/skills src/modules/tools` → **5 files / 52 tests passed**；全量 `npx vitest run` → **136 files / 1483 passed**，另有 2 个基线 employee-detail unhandled。`tsc -b . --noEmit` 本域 0（6 行均为基线 employee-detail/employees）。
- DOM（临时 harness，已删；Vite 5467 / Chrome 9268）：1440/1280/375 技能与工具 `bodySW=bodyCW=pageSW=pageCW=视口`；`aria-sort` 点击前 `名称↑`、点击后 `最近更新↑`（ascending）；`?q=` 与 `tab` 保持。截图 `docs/_artifacts/gov/shots/cap8-skills-{1440,1280,375}.png`、`cap8-tools-{1440,375}.png`。
- `cap8-*` 新增；`cap4/5/6/7`、`skl4`、`tl3` 未破。边界：只改 `web/src/modules/{capabilities,skills,tools}/**` 与 DONE/截图；未改 App/shell/routes/registry/package·lock/web scripts/ops；未并 main、未重建 9122；无独立观察者。

## R55 /capabilities 空态与未接入诚实化统一（cap9，2026-11-20）

- 基线：显式 refspec fetch 后 `git merge --no-ff origin/lane/hermes-console` 报 Already up to date；从已推 `d3338fd4` 继续，未 reset。
- 诚实态：技能与工具两 tab 的 403/404 仍同体（同一整页文案），GAP 仅 title；新增 `cap9-state-unavailable`（404）/`cap9-state-denied`（403），403/404 不再显示「0 条」。工具页失败对象补 `status`，避免 403 被记成 404。
- 真 0 与读不到分开：200 且空集显示 `cap9-state-empty` +「读口已接入，本次返回 0 条」；读不到显示错误体 + 计数「—」。计数条沿用同源 `publishCapabilityCount`：读取中先置「加载中/—」，不再残留上一个 tab 的旧值。
- 重试只重发当前 tab：技能 +1 次请求；工具重走自身候选链（6 个 tools/mcp 候选），断言不含 `/api/skills`。
- 验证：`npx vitest run src/modules/skills src/modules/tools` → **3 files / 49 tests passed**；全量 `npx vitest run` → **136 files / 1485 passed**（2 个基线 employee-detail unhandled 不变）；`tsc -b . --noEmit` 本域 0。
- DOM（临时 harness 已删；Vite 5471 / Chrome 9271）：1440/1280/375 两 tab `bodySW=bodyCW=pageSW=pageCW=视口`；skills ready 2 行/`技能2有源`，empty `技能0有源（空）`+cap9-empty，404 count `—无源`+unavailable，403 count `—无源`+denied；tools ready 3 行/`工具3有源`，empty `工具0有源（空）`，404 unavailable，403 denied。
- 边界：只改 `web/src/modules/{capabilities,skills,tools}/**`；未改 App/shell/routes/registry/package·lock/web scripts/ops；未并 main、未重建 9122；无独立观察者。

## R56 /capabilities 导出行序与排序一致（capA，2026-11-20）

- 基线：显式 refspec fetch 后 `git merge --no-ff origin/lane/hermes-console` 得新 tip `7173b7c6`（wave-17），合入本 lane 为 merge `d39fdb61`，未 reset。
- 现状核对：cap8 起导出已传 `sortedRows`（技能）与 `[...toolRows, ...mcpRows]`（工具，表体两段拼接），实际行序已与屏上排序一致；此前“依赖数组顺序”的风险点补成显式语义并在屏上标注。
- 新增 `capA-export-order-note`「导出按当前排序与搜索」（技能/工具页头导出按钮旁）；导出列仍为 `name,type,enabled,updated_at`，缺值留空不变；空集 disabled+title 沿用。
- DOM 实测（临时 harness 已删；Vite 5472 / Chrome 9272，1440）：
  - 技能默认序：屏上首 `B2 汇总` / 末 `C3 清理`；CSV 首 `B2 汇总,平台内置,正常,2026-11-18 14:00` / 末 `C3 清理,外部集成,停用,2026-11-17 14:00`。
  - 技能 `sort=name&dir=asc`：屏上首 `A1 检索` / 末 `C3 清理`；CSV 首 `A1 检索,…` / 末 `C3 清理,…`。
  - 工具默认序：屏上首 `网页搜索` / 末 `mcp-old`；CSV 首 `网页搜索,…` / 末 `mcp-old,…`。
  - 工具 `sort=name&dir=asc`：屏上首 `网页内容提取` / 末 `mcp-old`；CSV 首 `网页内容提取,…` / 末 `mcp-old,…`。
  - 筛选联动：技能 `?q=检索` 1 行 → CSV 1 条数据行；工具 `?q=网页` 2 行 → CSV 2 条数据行；切 tab 后导出集随该 tab 变化。
  - 三档宽度：1440/1280/375 两页 `bodySW=bodyCW=视口`，导出说明可见。
- 断言：技能/工具各补「导出说明 + CSV 行数与名称随 q 变化」，原有排序测试继续比对屏上首末与 CSV 首末。
- 验证：`npx vitest run src/modules/skills src/modules/tools src/modules/capabilities` → **5 files / 54 tests passed**；全量 `npx vitest run` → **137 files / 1588 passed**；`tsc -b . --noEmit` 本域 0。
- 边界：只改 `web/src/modules/{capabilities,skills,tools}/**` 与 DONE；未改 App/shell/routes/registry/package·lock/web scripts/ops；未并 main、未重建 9122；无独立观察者。

## R57 — /system 读口矩阵 CSV 导出（sys7）

- 基线：显式 refspec fetch 后 merge `origin/lane/hermes-console` = `38793c9a`（门禁章面盖在 `7173b7c6`）；merge commit `a64dba13`；未 reset。
- 实现：`web/src/modules/health/sourceMatrixCsv.ts` 新增纯前端 CSV（Blob + a.download，零新后端端点）；`SourceMatrix.tsx` 加 `sys7-export` / `sys7-export-count`；`sourceReads.ts` 保留 `asOfIso`（只取 payload 顶层 ISO，无效或缺失为 null）。
- 格式：表头固定 `name,path,state,elapsed_ms,as_of`；文件名 `system-sources-YYYYMMDD-HHmm.csv`（北京时间到分）；状态写人话（成功/降级/失败/读口未接入/…）；耗时缺失留空（不写 0）；`as_of` 缺失或非 ISO 留空（不用本机时钟）；RFC4180 转义；空集按钮 disabled + title。
- 同源：导出行即屏上矩阵行，`sys7-export-count` = 4 行；导出不发起任何请求。
- 定向 vitest：`src/modules/health` → 4 files / 24 passed。全量 → **138 files / 1591 passed**。tsc 基线 8 行（employee-detail/employees），本域 0。
- DOM（临时 harness，已删除；Vite 5473 / Chrome 9273）：1440/1280/375 均 `vw=bodySW=bodyCW=pageSW=pageCW`；行 4；计数 4 行；按钮可用；点击导出前后 fetch 计数 4 → 4；375 仅矩阵内部滚动 760/343。
- 边界：仅改 `web/src/modules/health/**` + DONE；未碰 App/shell/routes/registry/package·lock/web-scripts/ops；未并 main、未重建 9122。

## R58 — /system 检查时刻同源一致性（sys8）

- 基线：显式 refspec fetch 后 `git merge origin/lane/hermes-console`（tip `38793c9a`，代码代次 `7173b7c6`）→ Already up to date；未 reset。
- 口径：服务列表「最近检查时刻」与矩阵「采集时刻」中健康清单那一行同源——都取 `/api/health` 响应顶层 `asOf` 的同一 ISO 值，按同一北京时间到分呈现；其余三行各取自己探针响应的顶层 `asOf`，不互相代替。矩阵「采集时刻」表头加逐列 title，另增可见说明 `sys8-same-source-note`。
- 新增锚：`sys8-asof-<key>` 包住矩阵四行的采集时刻；既有 `sys6-asof-<key>` 保留。健康行 title 额外给出原始 ISO；缺失或非 ISO 仍显示「—」+原因，本机时钟不入。
- 取数：整页一次取 4 个读口；展开/收起矩阵、切换状态筛选前后请求计数 **4 → 4**（实测三档）。
- 验证：`src/modules/health` → 4 files / 24 passed；全量 **138 files / 1591 passed**；tsc 基线 8 行（employee-detail/employees），本域 0。
- DOM（临时 harness，已删除；Vite 5474 / Chrome 9274）：1440/1280/375 均 `vw=bodySW=bodyCW=pageSW=pageCW`；列表检查时刻与矩阵健康行均为 `2026-11-19 23:17`；探针行「—」；说明可见（375 高 46px 正常换行）；失败探针保留可复制 rid。
- 边界：仅改 `web/src/modules/health/**` + DONE；未碰 App/shell/routes/registry/package·lock/web-scripts/ops；未并 main、未重建 9122。

## R59 — /system 读源矩阵行跳转与时刻透明（sys9）

- 基线：显式 refspec fetch 后 `git merge origin/lane/hermes-console`（tip `38793c9a`，代码代次 `7173b7c6`）→ Already up to date；未 reset。
- 行落点（先 `git grep` 确认仓内真实路由，未造死链）：
  - 系统健康清单 → `#/system?tab=health`（`sys9-src-link-health`）
  - Hermes 运行时探针 → `#/capabilities?tab=channels`（该页消费 `/api/hermes-summary`，`sys9-src-link-runtime`）
  - 域服务探针 → `#/capabilities?tab=skills`（该页消费 `/api/skills`，`sys9-src-link-domain`）
  - 控制台服务探针 → 无独立页面，`sys9-src-nolink-console`「该读口无对应页面」+title，未渲染空 href。
  - 路由证据：`web/src/shell/routes.ts:181`（capabilities/channels）、App `/capabilities` 与 `?tab=skills` 重定向、App `/system` health live 槽；四值均在仓内。
- 采集时刻 title 全量口径：`asOf 原文（ISO UTC）· 换算北京时间 · 来源（asOfSource，未提供则写未提供）· 判据：只取 payload 顶层 ISO，缺失或非 ISO 显示「—」，不使用本机时钟`；缺失行仍显示「—」，title 保留原因 + 同一判据。
- 交互：矩阵展开状态仍不写 URL、不新增 `?svc=`；跳转用真实 `a[href]`，不在本页改 tab。链接原生键盘可达，`sys9-src-link:focus-visible` 提供 2px 可见焦点环。
- 取数：矩阵继续复用本页 4 次读取，展开/收起、读 title 均不发新请求；单测断言请求计数 **4 → 4**。
- 验证：`src/modules/health` → 4 files / 24 passed；全量 **138 files / 1591 passed**；tsc 本域 0。
- DOM（临时 harness，已删除；Vite 5475 / Chrome 9275）：1440/1280/375 均 `vw=bodySW=bodyCW=docSW=视口`；3 个 `a.sys9-src-link` + 1 个 `sys9-src-nolink`；三档 href 一致；健康行 title 含 `2026-11-19T15:17:09Z` / `2026-11-19 23:17` / 来源 / 判据；focus 实测 `outline: solid 2px`。
- 边界：仅改 `web/src/modules/health/**` + DONE；未碰 App/shell/routes/registry/package·lock/web-scripts/ops；未并 main、未重建 9122。

## R60 — /system 读源矩阵复制为纯文本（sys10）

- 基线：显式 refspec fetch 后 `git merge origin/lane/hermes-console`（tip `38793c9a`，代码代次 `7173b7c6`）→ 无新提交，未 reset。
- 新增「复制矩阵」`sys10-copy`：把矩阵当前行按 `口径名 | 路径 | 状态 | 耗时 | 采集时刻` 表头加行序拼成多行纯文本；耗时缺失「—」、采集时刻缺失「—」，不补 0，不取本机时钟。只读既有行，无新增请求。
- 复制成功 `sys10-copy-status`（`aria-live="polite"`）显示「已复制」；剪贴板拒或不可用时显示「复制失败，已展开手动复制」，并出现只读 `sys10-fallback` textarea 供手动选择。空矩阵时按钮 disabled，title 说明原因。
- 验证：health **4 files / 27 passed**；全量 **138 files / 1594 passed**；tsc 本域 0（仅基线 employee-detail/employees 错误）。
- DOM（临时 harness，已删除；Vite 5476 / Chrome 9276）：1440/1280/375 均 `vw=docSW=bodySW=bodyCW`；矩阵 4 行；复制按钮可用、title「复制当前矩阵为纯文本；不会再发请求」；点击后状态「已复制」且无 fallback；请求计数 **4 → 4**。截图 `docs/_artifacts/gov/shots/sys10-{1440,1280,375}.png`。
- 边界：仅改 `web/src/modules/health/**` + DONE/截图；未碰 App/shell/routes/registry/package·lock/web-scripts/ops；未并 main、未重建 9122。

## R61 — /capabilities tab 切换保态（capTab）

- 基线：显式 refspec fetch 后 `git merge origin/lane/hermes-console`（tip `053da5c4`，代码代次 `053da5c4`）→ merge `2de37223`；未 reset。
- 行为：skills↔tools 切 tab 时 shell 保留 `q`/`sort`/`dir`；两页新增模块级快照（仅缓存已落定读结果 + 展开行），切回立即复原且**不重复取数**；显式刷新/重试仍重新读取。skills 默认 tab 现在也写 `tab=skills` 进 URL（`useEnsureTabParam`），tools 同理；不覆盖其他 tab 值。
- 展开行：skills `openSkill`、tools `openTool` 随快照恢复；Escape 仍可收起。计数条由恢复后的可见行重新发布，不闪旧 tab 的数字。
- 请求计数（真实 shell `ConsoleModulePage`，临时 harness 已删除；Vite 5477 / Chrome 9277）：
  - 首次 skills：1 次（`/agent-api/api/skills`）。
  - 首次切 tools：+6 次（两条逻辑读取各走 3 个候选：`/agent-api/api/tools`、`/api/tools`、`/agent-api/api/tools/toolsets`、`/api/tools/toolsets`、`/agent-api/api/mcp/servers`、`/api/mcp/servers`），累计 7。
  - 切回 skills：+0（累计 7），展开的 skills 详情仍为 1。
  - 再切 tools：+0（累计 7），展开的 tools 详情仍为 1。
- URL：skills `?tab=skills&q=资料&sort=name&dir=asc`；tools `?tab=tools&q=资料&sort=name&dir=asc`；切回 skills 时 `tab` 由页面补回，其余参数不变。`aria-sort` 仍只出现在可排序列。
- 验证：定向 `skills+tools+capabilities` → **5 files / 58 passed**；全量 **138 files / 1673 passed**；tsc 本域 0（仅基线 employee-detail/employees 报错）。DOM 1440/1280/375 `vw=bodySW=bodyCW=1440/1280/375`；截图 `docs/_artifacts/gov/shots/capTab-{1440,1280,375}.png`。
- 边界：仅改 `web/src/modules/{capabilities,skills,tools}/**` + DONE/截图；未碰 App/shell/routes/registry/package·lock/web-scripts/ops；未并 main、未重建 9122。

## R62 — 能力面行复制为纯文本（capC）

- 基线：显式 refspec fetch 后 `git merge origin/lane/hermes-console`（tip `b797bc98`，代码代次 `053da5c4`）→ merge `4e1a9ddb`；未 reset。
- 行为：skills / tools 两 tab 通用「复制列表」`capC-copy`。文本固定表头 `name,type,enabled,updated_at`，随后按当前 tab + 当前搜索 + 当前排序的屏上行序逐行输出；值逐字取屏上（类型/来源人话、启用态人话、更新北京时间到分），缺值「—」不补 0。纯前端投影，复制不触发任何请求。
- 成功：`capC-copy-status` 以 `aria-live` 报「已复制 N 行」；剪贴板拒绝：同文案只读 textarea `capC-copy-fallback`，内容与剪贴板文本逐字相同；无行时按钮 disabled，title「当前视图没有可复制的行」。
- DOM（真实 shell `ConsoleModulePage`，临时 harness 已删除；Vite 5478 / Chrome 9278；`?q=资料&sort=name&dir=asc` / `?q=网页&sort=name&dir=asc`）：
  - 1440/1280/375 均 `vw=bodySW=bodyCW=pageSW=pageCW=1440/1280/375`。
  - skills：1 行，复制文本 `name,type,enabled,updated_at\n资料整理,平台内置,正常,2026-11-19 11:00`；请求 **1 → 1**。
  - tools：1 行，复制文本 `name,type,enabled,updated_at\n网页搜索,内置 · 网页搜索与抓取,正常,—`；请求 **4 → 4**。
  - 两 tab 复制后状态均为「已复制 1 行」，无 fallback。
- 验证：定向 `skills+tools+capabilities` → **6 files / 62 passed**；全量 **139 files / 1677 passed**；tsc 本域 0（仅基线 employee-detail/employees 报错）。
- 边界：仅改 `web/src/modules/{capabilities,skills,tools}/**` + DONE；未碰 App/shell/routes/registry/package·lock/web-scripts/ops；未并 main、未重建 9122。

## R63 — /capabilities 行详情与复制字段一致性（cap7/capC/列表行）

- 基线：显式 refspec fetch 后 `git merge origin/lane/hermes-console`（tip `b797bc98`，代码代次 `053da5c4`）→ Already up to date；未 reset。
- 改前/改后：
  1. 行详情缺值原显示 `该字段未返回`，与列表/复制的 `—` 不同；现统一为 `—`，原因只进 title。
  2. 技能未知启用态列表/详情没有原值 title；现 `待核实` + title 显示上游原值（如 `mystery`）。
  3. 工具集启用值为无法归类的字符串时，statusRaw 丢失、title 只写「没有说明」；现保留原值并写「接口给出的启用值未归类。」。
  4. 工具详情读口路径原为按来源硬编码；现由 `fetchFirst` 记录实际应答路径（`row.endpoint`），详情显示真实路径。
- 改后逐字段实测（同一份数据，1440/1280/375 三档一致）：
  - 技能：列表 `待核实`（title `mystery`）/ 更新 `—`；详情 `资料整理 | 类型：团队共享 | 待核实 | — | /agent-api/api/skills | —`；复制行 `资料整理,类型：团队共享,待核实,—`。
  - 工具：列表 `待核实`（title `mystery · 接口给出的启用值未归类。`）/ 更新 `—`；详情 `ghost tool | 内置 · Ghost | 待核实 | — | /api/tools/toolsets | —`；复制行 `ghost tool,内置 · Ghost,待核实,—`。
  - 采集时刻均只取顶层 ISO `asOf`；缺失为 `—`，title 给出原因；`asOfSource` 仅进 title；本机时钟不入。
- 新增一致性用例：技能/工具各一条，覆盖「未知状态原值 title + 更新缺值 + 缺 asOf」；另在 404 用例断言复制按钮 disabled 且 title 说明原因。
- 验证：定向 `skills+tools+capabilities` → **6 files / 64 passed**；全量 **139 files / 1679 passed**；tsc 本域 0（仅基线 employee-detail/employees 报错）；三档 `bodySW=bodyCW=视口`。
- 边界：仅改 `web/src/modules/{capabilities,skills,tools}/**` + DONE；未碰 App/shell/routes/registry/package·lock/web-scripts/ops；未并 main、未重建 9122。

## R64 — /capabilities 列表行键盘导航

- 基线：显式 refspec fetch 后 `git merge origin/lane/hermes-console`（tip `b797bc98`，代码代次 `053da5c4`）→ Already up to date；未 reset。
- 行为：skills 的 `<tr>` 与 tools 的 `.tol5-row` 采用 roving tabindex（可见行中仅一行 `0`，其余 `-1`）；`↑/↓` 移到相邻行、`Home/End` 到首末行并转移焦点；`Enter` 展开/收起该行 `cap7-detail-*`；`Esc` 收起并把焦点送回该行；行上 `aria-expanded` 与详情可见性同步。读口失败/无行时不渲染任何 `tabindex` 行，也不接管方向键，搜索框、重试与复制按钮保持正常 Tab。
- 焦点可见：行 `:focus-visible` 使用现有 `var(--color-ring)`，2px outline，内侧偏移；未新造颜色。375 不依赖悬停。
- 三档 DOM（真实 shell `ConsoleModulePage`，临时 harness 已删除；Vite 5481 / Chrome CDP 9281）：
  - skills 2 行：初始 tabIndex `[0,-1]`；↓ 后焦点 `skl4-row-s2`，tabIndex `[-1,0]`；Enter 后 `cap7-detail-skills=1`、`aria-expanded=true`、`:focus-visible=true`、outline `solid 2px color(srgb 1 0.901961 0.796078)`；Esc 后详情 0、`aria-expanded=false`、焦点回 `skl4-row-s2`。
  - tools 2 行：初始 `[0,-1]`；End 后 tabIndex `[-1,0]`；Enter 后 `cap7-detail-tools=1`、`aria-expanded=true`、焦点环同上；Esc 后详情 0、`aria-expanded=false`、焦点回到该行。
  - 请求计数：skills **1 → 1**；tools **6 → 6**；键盘操作未发任何请求。
  - 三档宽度：skills/tools 均 `vw=bodySW=bodyCW=1440/1280/375`，无横溢。
- 验证：定向 `skills+tools+capabilities` → **6 files / 66 passed**；全量 **139 files / 1681 passed**；tsc 本域 0 错误（仅基线 approvals/employee-detail/employees 11 行既有错误）。
- 边界：仅改 `web/src/modules/{skills,tools}/**`（含各自 CSS/测试）+ DONE；未碰 App/shell/routes/registry/package·lock/web-scripts/ops；未并 main、未重建 9122。

## R65 / capF — /capabilities 空态与错误态统一（2026-11-20）

- 基线：`lane/console-gov` HEAD `c33bd13f`；远端 `origin/lane/hermes-console` tip `b797bc98`（代码代次 `053da5c4`）；fetch + merge 为 Already up to date，未 reset。
- 变更：`web/src/modules/skills/SkillsPage.tsx` 与 `web/src/modules/tools/ToolsPage.tsx` 统一四态标记：
  - 页面根节点 `data-cap-state=loading|empty|unavailable|error|ready`（tools denied 记为 unavailable）。
  - 新增 `capF-state-loading` / `capF-state-empty` / `capF-state-unavailable` / `capF-state-error` / `capF-state-login`（按状态出现其一），`capF-retry` 包裹重试按钮；保留 `cap9-state-*`、`skl4-*`、`tl3-*`、`tol5-*`。
  - skills 403/404 标题改为「技能读口未接入」；其他错误仍为「技能列表暂时无法读取」。空态文案保留「读口已接入，本次返回 0 条…」；错误态计数保持 `—` + `无源`，不显示 0。
  - tools 错误/未接入已有不同标题；empty 与 unavailable testid、文案保持分离。
  - `skills.css` / `tools.css` 增加 `.capF-state { min-height: 220px; }`，避免 loading/empty/error 切换时内容区高度跳动。
- 定向验证：
  - `cd web && npx vitest run src/modules/skills src/modules/tools` → `3 files / 59 tests passed`。
  - 全量 `npx vitest run` → `139 files / 1683 tests passed`。
  - `tsc -b . --noEmit` → 仅基线 employee-detail / employees 错误，`modules/(skills|tools|capabilities)` 0 行。
- DOM（临时 harness `web/capF-preview.html` + `web/src/capF-preview.tsx`，已删除；Vite 5482 / Chrome CDP 9282）：
  - 1440 / 1280 / 375 三档，skills/tools × empty/error：`bodySW=bodyCW=pageSW=pageCW=viewport`，无横溢。
  - skills empty → `data-cap-state=empty`、`capF-state-empty`、count `—/未取数`；skills error 预览 → `data-cap-state=unavailable`、`capF-state-unavailable`、`capF-retry`、标题「技能读口未接入」。
  - tools empty → `data-cap-state=empty`、`capF-state-empty`；tools error → `data-cap-state=error`、`capF-state-error`、`capF-retry`。
  - 单元测试覆盖 live 403/404 同体、generic 500 计数 `—`、q/sort/dir 在错误与重试后保留、重试只重发当前 tab（tools 仅 tools/mcp 候选）。
- 边界：仅 `web/src/modules/{skills,tools}/**` + 本 DONE；未改 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未并 main；未重建 9122；未 install/force/amend/--no-verify。

## R66 / capG — /capabilities 导出与复制的失败态一致性（2026-11-20）

- 基线：先显式 refspec fetch `origin/lane/hermes-console`（tip `cca9cf7e`），再 `git merge --no-ff` 得 `331b80c3`；未 reset，未并 main，未重建 9122。
- 变更：新增 `web/src/modules/capabilities/outputState.ts`，把列表读取态映射为导出/复制的可用性：loading/unavailable/error 禁用，ready/empty 按当前可见行数决定；禁用原因只进 `title`（未接入含去处与 GAP，500/网络含请求编号），可见计数在失败态为 `—`，真空仍为 `0 条` + 有源（空）。
- `csvExport.tsx` / `listCopy.tsx` 接受 `state`，默认行为保持原独立用例；skills/tools 两页把各自的加载、空、未接入（403/404）、错误（500/网络）映射后传入，重试成功自动恢复。
- 读数（临时 harness 已删除；Vite 5483 / Chrome CDP 9283）：1440/1280/375 × skills/tools × ready/empty/404/500 共 24 组，`bodySW=bodyCW=pageSW=pageCW=viewport`，无横溢。
  - ready：导出/复制可用，计数 `2 条`；empty：两者禁用，计数 `0 条`，标题「当前视图没有可导出的行」。
  - 404/403：两者禁用，标题含「读口未接入」「审批中心」「GAP-SKL4-01 / GAP-04」，计数 `—`，计数条 `—/无源`。
  - 500：两者禁用，标题含「请求编号：req-capg-9」「重试成功后才能导出/复制」，计数 `—`；单元测试覆盖重试后恢复为 `1 条` / `6 条`。
- 验证：定向 `npx vitest run src/modules/capabilities src/modules/skills src/modules/tools` → **6 files / 68 passed**；全量 `npx vitest run` → **144 files / 1795 passed**；`tsc -b . --noEmit` 仅剩基线 approvals/employee-detail/employees 错误，本域 0 行。
- 边界：仅 `web/src/modules/{capabilities,skills,tools}/**` + 本 DONE；未改 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未 install/force/amend/--no-verify。

## R67 / sys13 — /system 读源矩阵可排序列（2026-11-20）

- 基线：先显式 refspec fetch `origin/lane/hermes-console`（tip `3c7f70f6`，代码代次 `cca9cf7e`），再 `git merge --no-ff` 得 `f811cfaa`；未 reset，未并 main，未重建 9122。
- 变更：新增 `web/src/modules/health/sourceSort.ts`；`SourceMatrix.tsx` 的状态/耗时/采集时刻三列表头改为真 `button[type=button]`，`aria-sort` 三态；默认口径名升序（URL 不带 `ssort/sdir`），其余列按 升→降→默认 三态循环，URL 写 `?ssort=state|ms|asof&sdir=asc|desc`，刷新/粘 URL 可复现；排序只改屏上与复制/导出顺序，不发请求。缺值/非 ISO 采集时刻排末；采集时刻按 ISO 原值比较；表体、`sys10-copy`、导出共用同一排序结果。
- 读数（临时 harness 已删除；Vite 5484 / Chrome CDP 9284；真实 `HealthPage` + 四个读口 stub）：
  - 默认：`initialAria=ascending`（口径名），行序 `console,health,domain,runtime`，URL `#/system?tab=health`。
  - 状态升序：`console,health,runtime,domain`，URL `#/system?tab=health&ssort=state&sdir=asc`，`aria-sort=ascending`；降序：`domain,runtime,health,console`，URL `...&sdir=desc`，`aria-sort=descending`；第三次点击回默认，URL 清回 `#/system?tab=health`，`aria-sort` 回 `ascending/none`。
  - 采集时刻升序：`health,console,runtime,domain`（runtime/domain 无 asOf 排末），URL `...&ssort=asof&sdir=asc`；降序：`console,health,runtime,domain`。
  - 请求计数：排序点击前后 **4 → 4**，无新请求。
  - 复制对照（asof 降序）：表体首/末 `console` / `domain`；`sys10-copy` 文本首数据行「控制台服务探针 | /agent-api/api/__health-probe__ | 成功 | 2 ms | 2026-11-20 10:31」，末行「域服务探针 | /agent-api/api/skills | 读口未接入 | 2 ms | —」，与表体一致；表头为「口径名 | 路径 | 状态 | 耗时 | 采集时刻」。
  - 三档：1440 `vw=bodySW=bodyCW=1440`，page 1438/1438，table 1408/1408；1280 全部 1280，page 1278/1278，table 1248/1248；375 `body 375/375`，page 373/373，table 及 `.sys6-scroll` **760/343**（仅表内滚动）；无页面横溢。
- 验证：`npx vitest run src/modules/health` → **5 files / 32 passed**；全量 `npx vitest run` → **145 files / 1800 passed**；`tsc -b . --noEmit` → exit 2，20 行均为既有基线（approvals/employee-detail/employees），`modules/health|sourceSort|SourceMatrix` 0 行。
- 边界：仅 `web/src/modules/health/{SourceMatrix.tsx,sourceSort.ts,sourceSort.test.ts,SourceMatrix.test.tsx,health.css}` + 本 DONE；未改 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未 install/force/amend/--no-verify。

## R68 / sys14 — /system 服务深链定位（2026-11-20）

- 基线：显式 refspec fetch `origin/lane/hermes-console`（tip `3c7f70f6`，代码代次 `cca9cf7e`）后 `git merge --no-ff` → Already up to date；未 reset，未并 main，未重建 9122。
- 变更：新增 `web/src/modules/health/serviceLink.ts`（读/写 `svc`、键名与显示名归一匹配、GAP-SYS14-01）；`SystemHealthSurface.tsx` 支持 `?svc=<key|name>`：
  - 命中后自动展开 `sys4-detail-*`、置 `aria-current=true` 与 `is-svc-target` 高亮，`scrollIntoView({block:'center'})`；刷新/粘 URL 可复现。
  - 未命中或读口失败时显示 `sys14-link-missing`「该服务不在当前清单里」+ 人话原因 + 去处，`GAP-SYS14-01` 仅在 title；真实清单行数不变，不补行。
  - 清除定位/关闭详情只删除 `svc`，保留 `tab/ssort/sdir` 等参数；Esc、行切换与“清除定位”都能撤掉深链；无 `?svc=` 时点行展开行为不变。
- 读数（临时 harness 已删除；Vite 5486 / Chrome CDP 9286；真实 `HealthPage` + 健康/三探针 stub）：
  - 1440/1280/375 均 `vw=bodySW=bodyCW=pageSW=pageCW=1440/1280/375`，无横溢。
  - `?svc=runtime&ssort=state&sdir=desc`：3 行，`sys4-detail-runtime=1`，目标行 `aria-current=true`、`is-svc-target`，提示「已定位到「Hermes 运行时」」，URL 原样；请求 **4**（一次原有健康 + 三探针），排序不新增请求。
  - 点“清除定位”：URL 变为 `#/system?tab=health&ssort=state&sdir=desc`（仅去 `svc`），详情关闭，请求仍 **4**。
  - `?svc=ghost&ssort=ms&sdir=asc`：3 行不增，`sys14-link-missing` 含「该服务不在当前清单里」「没有匹配」「不补行」，title `GAP-SYS14-01`，无 `aria-current`，请求 **4**；点提示去处后仅去 `svc`，保留 `ssort/sdir`。
- 验证：`npx vitest run src/modules/health` → **5 files / 36 passed**；全量 `npx vitest run` → **145 files / 1804 passed**；`tsc -b . --noEmit` → exit 2，20 行均为既有基线（approvals/employee-detail/employees），本域 0 行。
- 边界：仅 `web/src/modules/health/{SystemHealthSurface.tsx,serviceLink.ts,SystemHealthSurface.test.tsx,health.css}` + 本 DONE；未改 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未 install/force/amend/--no-verify。

## R69 / sys15 — /system 长值折叠与全文可见（2026-11-20）

- 基线：显式 refspec fetch `origin/lane/hermes-console`（tip `3c7f70f6`）后 `git merge --no-ff` → Already up to date；未 reset，未并 main，未重建 9122。
- 变更：
  - `systemHealth.ts` 导出既有 `redactError`（保留 token/cookie/secret/password 等打码与 200 字截断），供矩阵错误摘要复用。
  - 服务列表：`sys3-name` / `sys3-version` 单元格原值给 `title`，内层 `.sys15-trunc`（`sys15-trunc-name` / `sys15-trunc-version`）单行省略；展开 `sys4` 详情内 `.sys15-full`（`sys15-full-service` / `sys15-full-endpoint` / `sys15-full-error`）全文换行，原 sys4 脱敏计数/截断提示保留。
  - 读源矩阵：列宽固定，名称/路径/状态/原因均 `.sys15-trunc` + 原值 title；新增行内 `sys15-row-toggle-*`「全文/收起」，展开 `sys15-detail-*` 显示 `sys15-full-name/path/status/asof-*` 全文；错误摘要先 `redactError`，title 与全文均只含 `***` 与「已脱敏 N 处」，原值不上屏。
  - CSS：`.sys15-trunc` 省略号、`.sys15-full` `white-space:normal;word-break:break-word`、`table-layout:fixed` 与各列百分比；三档无页面横溢。
- DOM（临时 harness 已删；Vite 5487 / Chrome CDP 9287；截图 `docs/_artifacts/gov/shots/sys15-{1440,1280,375}.png`）：
  - 1440/1280/375：`vw=bodySW=bodyCW=1440/1280/375`；3 行；截断元素 6 个；长名称 `clientWidth 314/276/139`、`scrollWidth 603`，省略生效。
  - 展开服务行：全文元素 `display:block`、`white-space:normal`；错误摘要显示 `***`，`已脱敏 3 处`，无 `long-secret`；请求 **4**。
  - 展开矩阵 + runtime 行：全文状态含 `失败`、`***`、`已脱敏 2 处`，无 `matrix-secret`；请求 **4**（展开/收起零新增请求）。
  - 375：页面 375，服务表仍只在自身容器内滚动（680/343），详情全文在表宽内换行。
- 验证：`npx vitest run src/modules/health` → **5 files / 39 passed**；全量 `npx vitest run` → **145 files / 1807 passed**；`tsc -b . --noEmit` → exit 2，20 行均为既有基线，本域 0。
- 边界：仅 `web/src/modules/health/**`（实现/测试/CSS）+ 本 DONE + 3 张截图；共 10 文件；未碰 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未 install/force/amend/--no-verify。

## R70 / capH — 能力面 tab 切换保滚动与焦点（2026-11-20）

- 基线：显式 refspec fetch `origin/lane/hermes-console`（tip `3c7f70f6`，代次 `cca9cf7e`）后 `git merge --no-ff` → Already up to date；HEAD `88ea9881`；未 reset，未并 main，未重建 9122。
- 变更：新增 `web/src/modules/capabilities/tabView.ts` + 单测：
  - 内存 Map 按 tab 存 `{scrollTop, firstRow}`；`sessionStorage` 未用，**刷新后不承诺复原**（已在类型注释与本文写明）。
  - `findScrollHost` 找最近纵向滚动容器，否则文档滚动；`captureTabView`/`restoreTabView` 双 rAF 复原；`noteTabMount` 仅真实切换时返回 true；`focusTabButton` 聚焦 `[role=tab][data-tab=…]` 并 `preventScroll`。
  - `SkillsPage`/`ToolsPage` 根加 `capH-scroll` + `capH-page-*`，挂载时复原并聚焦、卸载/滚动时 capture；CSS 让 shell 的 `.pane` 成为仅这两页启用的纵向滚动宿主（桌面 ≥769px）。
  - 既有数据缓存不改：返回已访问 tab 仍是 0 新请求；首次切到 tools 是一次逻辑读取（4 个候选 URL 的现有回退链），如实登记。
- DOM 读数（临时 harness 已删；Vite 5490 / Chrome CDP 9291；40 skills + 40 tools，`?q=技能&sort=name&dir=asc`）：
  - 1440：skills 滚到 `scrollTop=1028`，首行 `skl4-row-s7`；切 tools 后首行 `tl3-row-toolset-web-_0`，滚到 805 并展开 `cap7-detail-tools`；切回 skills → `scrollTop=1028`、首行 `skl4-row-s7`、`cap7-detail-skills` 仍开；再切 tools → `805`、首行同、`cap7-detail-tools` 仍开；每次切换后 `document.activeElement` 为对应 `[role=tab][data-tab=skills|tools]`。差异 0 行。
  - 1280：同序，skills `1028 / s7`；tools 首行同；focus 与展开行同上；`bodySW=bodyCW=1280`。
  - 375：走文档滚动，`scrollY=900`、首行 `skl4-row-s3`；切 tools 后 `scrollY=0`（新 tab 首次进入），切回 skills → `scrollY=900`、首行 `skl4-row-s3`、focus skills；`bodySW=bodyCW=375`。
  - 三档均 `bodySW=bodyCW`，375 只表内横滚（既有）。
  - 请求计数：skills 首次 1；切 tools 后 5（新增 4 个候选 HTTP，逻辑读取 1 次）；切回 skills / tools 均仍 5（0 新增）。
  - 切 tab 的 `href` 保留 `q=%E6%8A%80%E8%83%BD&sort=name&dir=asc`。
- 验证：定向 `npx vitest run src/modules/capabilities src/modules/skills src/modules/tools` → **7 files / 72 passed**；全量 → **146 files / 1811 passed**；`tsc -b . --noEmit` exit 2，21 行均既有基线，本域 0。
- 边界：仅 `web/src/modules/{capabilities,skills,tools}/**` + 本 DONE；共 7 文件；未碰 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未 install/force/amend/--no-verify。

## R71 / R47 OBS — capF 锚可读 + 读源矩阵锚常驻（2026-11-20）

- 基线：显式 refspec fetch `origin/lane/hermes-console`（tip `5630ffce`）后 `git merge --no-ff` → merge `d2ddf7ed`；未 reset，未并 main，未重建 9122。
- OBS-4（capF 锚无文字）：`SkillsPage` / `ToolsPage` 的 `capF-state-loading|empty|unavailable|login|error` 锚改为带可读文本（`aria-live="polite"`）；空态同时保留可见 `capF-state-empty-text`，内容与锚一致；工具/技能错误锚带状态标题 + 原因，修正技能重复标题。
  - 同一次 mount 的 `textContent` 长度：skills loading 7、empty 34、error 49；tools loading 15、empty 20、error 50。空态文案「读口已接入，本次返回 0 条；…不补样例」。
- OBS（sys9/sys8 两轮不挂载）：根因是 `SourceMatrix` 用 `{expanded ? ... : null}` 条件渲染整块矩阵。改为**常驻 DOM**，仅在收起时 `hidden`：
  - `sys13-sort-note`、`sys6-scroll`（新增 testid）带 `hidden={!expanded}`；展开只改 hidden，不重新取数。
  - 同一 mount 收起态实测：`sys9-src-link-*` **3** 个、`sys9-src-nolink-*` **1** 个（无链接行有文本节点 + title 原因）、`sys8-asof-*` **4** 个；`sys8-asof-health` title 含 `asOf 原文` / 换算北京时间 / 来源 / 判据。展开后仍为 3/1/4，`hidden=false`。
  - 缺失 asOf 仍为「—」且 title 给原因；错误摘要仍走 `redactError`，不泄漏。
- 请求计数：整改前后均 **4**（一次健康读 + 三探针），展开/收起矩阵与锚可见性变化**零新增请求**。
- 三档：1440/1280/375 均 `vw=bodySW=bodyCW=1440/1280/375`，无横溢。
- 验证：定向 `src/modules/health src/modules/skills src/modules/tools` → **8 files / 98 passed**；全量 `npx vitest run` → **148 files / 1919 passed**；`tsc -b . --noEmit` → exit 2，23 行均为既有基线（approvals/employee-detail/employees），本域 0 行。
- 边界：仅 `web/src/modules/{health,skills,tools}/**` + 本 DONE；未改 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未 install/force/amend/--no-verify。

## R72 — asOf 呈现统一（2026-11-20）

- 基线：显式 refspec fetch `origin/lane/hermes-console`（tip `957704be`，代码代次 `5630ffce`）后 `git merge --no-ff` → merge `2a07b710`；未 reset，未并 main，未重建 9122。
- 单一 helper `readTopAsOf` 落在 `web/src/modules/health/systemHealth.ts`：只认顶层 ISO 六别名 `asOf/as_of/collectedAt/collected_at/generatedAt/generated_at`；合法 → 北京时间到分（`sv-SE`/Asia/Shanghai），title 为 `UTC 原文：… · 北京时间：…[ · 来源：…]`；缺失或非法 → 「—」+ title「上游没带采集时刻，不用本机时间顶替」；不使用本机时钟，`asOfSource` 仅进 title。
- 接线：`version/versionHealth.ts`（`ver5-health-asof` title）、`health/sourceReads.ts`+`SourceMatrix.tsx`（`sys6-asof-*`/`sys8-asof-*` title）、`health/systemHealth.ts`+`SystemHealthSurface.tsx`（`sys3-asof` title）、`skills/skills.ts`（cap7 详情 `asOfTitle`）、`tools/tools.ts`+`ToolsPage.tsx`（cap7 详情 `asOfTitle`）；`cap7-detail-asof` 键名未变。`gov-asof-note` 在读源矩阵上屏一次。
- 改前/改后（同一 payload，旧逻辑只读 `asOf` vs 新 helper）：
  - `collectedAt: 2026-11-19T06:00:00Z` → 旧 `—`；新 `2026-11-19 14:00`，title 含 UTC 原文/北京时间。
  - `as_of` / `generatedAt` 同值 → 旧 `—`；新 `2026-11-19 14:00`。
  - `asOf: 2026-11-19T06:00:00Z` → 旧/新均 `2026-11-19 14:00`。
  - `asOf: not-a-date` / 缺失 → 旧 `—`；新 `—`，title「上游没带采集时刻，不用本机时间顶替」。
- 验证：定向 `src/modules/{version,health,capabilities,skills,tools}` → **14 files / 127 passed**；全量 **148 files / 1923 passed**；`tsc -b . --noEmit` → exit 2，23 行均为既有基线（approvals/employee-detail/employees），本域 0。
- DOM（临时 harness 已删除；Vite 5492 / Chrome CDP 9292）：1440/1280/375 均 `vw=bodySW=bodyCW=1440/1280/375`；`gov-asof-note` 可见；`sys3-asof`/`sys6-asof-health`/`sys8-asof-health`/`ver5-health-asof`/`cap7-detail-asof` 均 `2026-11-19 14:00` 且 title 为统一口径；系统页请求 **4**（健康+三探针），展开矩阵前后 4→4；版本面 2、cap7 0。
- 边界：仅上述 14 个模块文件 + 本 DONE；未改 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未 install/force/amend/--no-verify。

## cap gates — /capabilities 六入口统一门禁（2026-11-20）

- 基线：显式 refspec fetch `origin/lane/hermes-console`（章面 `957704be`，代次 `5630ffce`）后 `git merge --no-ff` → Already up to date；未 reset，未并 main，未重建 9122。
- 新增 `web/src/modules/capabilities/gates.ts`：`deriveGates` 单点返回 `counts / search / export / copy / sort / rowDetail` 的 `{enabled,title,count}`；删除 `outputState.ts` 及其私有措辞。
  - 失败统一 title：loading「正在读取当前列表；读取完成前这些操作不可用。」；denied「读口未接入：…（GAP-…）；请到审批中心提交开通申请。」；error「读取失败：…；请求编号：…；请重试。」。同一失败六入口全部 disabled，不存在一处可点。
  - 真空（读口已接入、0 条）：计数 0/有源（空）、搜索 disabled「当前没有可搜索的条目。」、导出/复制 disabled「当前没有可导出的条目。」、排序仍 enabled、行详情无行不渲染。
  - 搜索无匹配：搜索 enabled、计数 0/有源（空）、导出/复制 disabled、排序 enabled、详情 disabled。
  - ready：六入口 enabled；导出/复制 count `N 条`；排序/详情可用。
- 组件接线：`csvExport`/`listCopy`/`search` 接受 `gate`；隐藏空锚 `cap-gates-export|copy|search` 仅带 `data-enabled` 与 `title`，不把 GAP/请求号写成 textContent。Skills/Tools 页计算 `gatePhase` + `gates`，计数 reason 直接取 `gates.counts.title`（gap null）；搜索框常驻，非 ready disabled；排序按钮与详情 toggle 使用 gate；新增隐藏 `cap-gates-counts|sort|detail`。
- DOM 读数（临时 harness 已删；Vite 5495 / Chrome CDP 9295；skills 2 行、tools 1 组 2 工具、MCP 0；error=500 `req-gates-500`，denied 全 404）：
  - 1440/1280/375 × skills/tools × ready/empty/无匹配/error/denied 共 30 格：`bodySW=bodyCW=pageSW=pageCW=1440/1280/375`，无横溢。
  - ready：`counts/search/export/copy/sort/detail=true`，导出 count `2 条`；点排序与详情后 fetch skills `1→1`、tools `4→4`，详情展开 1 行。
  - empty：`counts=true search=false export=false copy=false sort=true detail=false`；导出 count `0 条`；title 精确「当前没有可导出的条目。」。
  - 无匹配：`search=true sort=true`，`export/copy/detail=false`，计数 0/有源（空），导出 count `0 条`。
  - error：六入口全 false，title 同句含 `请求编号：req-gates-500`，导出 count `—`。
  - denied：六入口全 false，title 同句含 GAP；skills `GAP-SKL4-01`，tools `GAP-04`；导出 count `—`。
- 验证：定向 `npx vitest run src/modules/skills src/modules/tools src/modules/capabilities` → **8 files / 80 passed**；全量 `npx vitest run` → **149 files / 1931 passed**；`tsc -b . --noEmit` → 23 行均既有基线（approvals/employee-detail/employees），本域 0。
- 边界：仅 `web/src/modules/{capabilities,skills,tools}/**` + 本 DONE；未碰 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未 install/force/amend/--no-verify。

## R73 — /capabilities 行详情深链 `?row=`（2026-11-20）

- 基线：显式 refspec fetch `origin/lane/hermes-console`（章面 `a5832d15` / 代次 `60a4a429`）后 `git merge --no-ff` → merge `2fb316de`；未 reset，未并 main，未重建 9122。
- 新增 `web/src/modules/capabilities/rowLink.tsx`：`row=<tab>:<name>` 解析/写入/删除；只匹配当前 tab；`rowHref` 生成可复制 hash 链接；`listHref` 去掉 row 与 q、保留 tab/sort/dir/ssort。
- Skills/Tools 行详情接线：
  - 点「详情」/键盘 Enter：写 `row=skills:<name>` / `row=tools:<name>`（URLSearchParams 负责百分号编码，浏览器地址栏为 `%3A`），同一时刻仍只展开一行。
  - 「链接」`cap-row-link` 是可复制/新开的 hash 链接；「关闭」`cap-row-close` 只删 `row`，保留 tab/q/sort/dir/ssort。
  - 刷新/粘链：按 row 名匹配当前搜索+排序后的行，自动展开、`scrollIntoView({block:'center'})`、行上 `aria-current="true"`；不存在的 row 只显示「该条目不在当前列表里」`cap-row-missing`（title `GAP-CAPROW-01`）+ 原因 + 「查看完整列表」去处，不补行；`cap-row-expanded` 标记当前展开详情。
- 验证：定向 `npx vitest run src/modules/skills src/modules/tools src/modules/capabilities` → **8 files / 80 passed**；全量 `npx vitest run` → **151 files / 2001 passed**；`tsc -b . --noEmit` → 仅有既有基线错误（approvals/employee-detail/employees），本域 0。
- DOM（临时 harness 已删；Vite 5496 / Chrome CDP 9296）：
  - 1440/1280/375 × skills/tools × link/missing：`body=page=视口`，无横溢；`cap-row-link` 每行 1 个。
  - skills `row=skills:质检&q=质`：detail 1、expanded 1、`aria-current=true`、fetch **1**；点关闭后 detail 0、`row` 删除、`q` 保留、fetch **1**。
  - tools `row=tools:网页搜索&q=网页`：detail 1、expanded 1、`aria-current=true`、fetch **4**；关闭后 detail 0、`row` 删除、`q` 保留、fetch **4**。
  - 两边 `row=…:不存在`：`cap-row-missing` 可见、title `GAP-CAPROW-01`、detail 0、行数不变、fetch 不变。
- 边界：仅 `web/src/modules/{capabilities,skills,tools}/**` + 本 DONE；未碰 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未 install/force/amend/--no-verify。

## R74 — /system 四态统一（2026-11-20）

- 基线：显式 refspec fetch `origin/lane/hermes-console`（章面 `a5832d15` / 代次 `60a4a429`）后 `git merge --no-ff` → Already up to date；未 reset，未并 main，未重建 9122。
- 新增 `web/src/modules/health/SystemStatePanel.tsx`：loading / empty / empty-filter / error / denied 共用一套文案与组件；锚 `sys-state-state`（`data-state`）、`sys-state-empty`、`sys-state-empty-text`、`sys-state-clear`、`sys-state-error`、`sys-state-rid`（可复制）、`sys-state-retry`、`sys-state-denied`。
- 列表（`sys3-*`）接线：loading/empty/error/denied 全部改用该面板；403/404 同体 `sys-state-denied`，GAP 只在 `sys3-gap` title；error 带人话 + requestId + 重试；真空调 `sys-state-empty`；筛选无匹配调 `empty-filter` 并给 `sys-state-clear`（保留 `sys5-clear`）。旧 `sys3-loading|gap|login|error|empty|retry|request-id|apply` 均保留。
- 控件门禁：`sys3-refresh` 只在 ready 可点；empty/error/denied/loading disabled + title；重试不再调用页面探针刷新，只重发失败的 `/api/health` 一次（不影响 `?svc=` 与已展开行状态）。状态计数：error/denied 为「—」+title；真空调仍为真实 0；筛选无匹配保留同一次响应的 0/1 分布。
- 读源矩阵：导出/复制在无任何可用读口行（全部 failed/unwired/idle）时 disabled，title「当前没有可导出/复制的可用读口行：读口未接入或读取失败。」，`sys7-export-count` 为「—」；有可用行时不受影响。
- 验证：定向 `npx vitest run src/modules/health` → **5 files / 48 passed**；全量 `npx vitest run` → **151 files / 2006 passed**；`tsc -b . --noEmit` 仅既有基线错误，本域 0。
- DOM（临时 harness 已删；Vite 5497 / Chrome CDP 9297；1440/1280/375 × error/denied/empty/filter）：
  - 12 格均 `body=page=视口`，无横溢。
  - error：`sys-state-state=error`、`sys-state-error`、`sys-state-rid=req-error`、`sys-state-retry`、`sys3-refresh.disabled=true`、计数四项均「—」、矩阵复制 disabled、`sys7-export-count=—`；点重试 fetch **4→5**（只补健康读口一次）。
  - denied：`data-state=denied`、`sys-state-denied`、rid 可复制、无 retry、refresh disabled、计数「—」、矩阵复制 disabled。
  - empty：`data-state=empty`、`sys-state-empty-text` 含「不补服务行」、refresh disabled、计数 0（真实空集）、矩阵因探针成功仍可用。
  - filter：`data-state=empty-filter`、`sys-state-empty`、`sys-state-clear` 可见并清空筛选。
- 边界：仅 `web/src/modules/health/**` + 本 DONE；未碰 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未 install/force/amend/--no-verify。

## R75 — 版本与系统面版本标识一致性（2026-11-20）

- 基线：显式 refspec fetch `origin/lane/hermes-console`（章面 `a5832d15` / 代次 `60a4a429`）后 `git merge --no-ff` → Already up to date；未 reset，未并 main，未重建 9122。
- 现查读口/字段：
  - ver5 `VersionHealthSurface` 原先版本表读 `/agent-api/api/version`，字段 `version|buildVersion|build_version|currentVersion|current_version`；健康行读 `/api/health`。
  - sys3 `readSystemHealth` 读 `/api/health` 的 `sources[]`，字段 `version|build|buildId|build_id|revision|commit`。
  - 同一组件若两读口给出不同值，会出现两页不一致；缺字段时两页原因文案也不同。
- 统一：新增 `web/src/modules/health/versionIdentity.ts`（单一 `VERSION_FIELD_KEYS` + `versionIdentity()`）；`systemHealth` 与 `versionHealth` 共用。ver5 改为**优先用 `/api/health` 的 sources 生成版本表**（`readVersionRowsFromHealth`），与 sys3 同源同字段；仅当健康无组件行或读取失败时才回退 `/api/version`。版本表 `builtAt` 不再把检查时刻当构建时间，健康行显示「—」+原因。
- 改前/改后（同一 payload：health console.version=9.9.9，version components console.version=1.1.1）：
  - 改前：ver5 显示 `1.1.1`，sys3 显示 `9.9.9`。
  - 改后：两页均 `9.9.9`；`1.1.1` 不上屏；健康请求只 2 次（两组件各一次），版本端点未被调用。
  - 缺版本：ver5/sys3 均「—」，title 均为「上游没有提供该服务的版本或构建标识；不编造版本号。」。
- 采集时刻：两页均走 `readTopAsOf` 六别名，BJT 到分；示例 `2026-11-20 11:28`，`asOfSource` 只进 title；缺失/非法仍「—」+title。
- 验证：定向 `npx vitest run src/modules/version src/modules/health` → **8 files / 64 passed**；全量 `npx vitest run` → **152 files / 2010 passed**；`tsc -b . --noEmit` 仅既有基线错误，本域 0。
- DOM（临时 harness 已删；Vite 5498 / Chrome CDP 9298；两组件同屏）：
  - 1440/1280/375 均 `body=视口`；ver5/sys3 均 2 行，首行均 `9.9.9`，第二行均「—」且 title 一致；无 `1.1.1`。
  - 375 仅 ver5 表内横滚（560/319），sys3 表 319/319；页面无横溢。
- 边界：仅 `modules/health/**`、`modules/version/**` + 本 DONE；未碰 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未 install/force/amend/--no-verify。

## R76 / capabilities export filename contract（2026-11-20 11:40）

- 基线：显式 refspec fetch + `git merge origin/lane/hermes-console` → Already up to date；章面 `a5832d15` / 代码代次 `60a4a429`；未 reset、未并 main、未重建 9122。
- 文件名契约：`capabilities-<tab>-<q|all>-<sort|default>-<dir|default>-YYYYMMDD-HHmm.csv`；q 缺省 `all`；排序缺省 `default-default`；片段只接受 `[a-z0-9.-]`（先小写），中文/空格/冒号等折为 `default`；时间取北京时间到分。
- 屏上 `cap-export-name` 实时预览，title 写明 `tab/q/sort/dir` 四要素来源；`CapabilityExport` 用 useMemo 冻结当前组合的 name，点击时 `a.download` 与该预览逐字相同。
- tab / 搜索 / 排序变化均通过 props 更新预览；无新增请求。空结果仍由 cap-gates 单点禁用并保留原因 title。
- CSV 内容、表头 `name,type,enabled,updated_at`、行序、行数未改；cap6/capC/cap8/cap4–capH/skl4/tl3/cap-gates 零破。
- 证据：`cd web && npx vitest run src/modules/capabilities src/modules/skills src/modules/tools` → 8 files / 89 passed；全量 152 files / 2013 passed；tsc 仅基线 approvals/employee-detail/employees 错误，本域 0。
- DOM（1440/1280/375，skills+tools）：body/page 均等于视口；skills `capabilities-skills-a1-name-asc-20261120-1139.csv`，tools `capabilities-tools-default-name-asc-20261120-1139.csv`；预览 title 四要素齐全；导出按钮可用、搜索可用。
- 单测锁定：skills `?q=a1&sort=name&dir=asc` 预览→下载同名→点排序为 desc 预览/下载更新，fetch 1→1；tools `?q=网页` 折叠为 default，排序 desc 后预览/下载更新，fetch 计数不变；csv 单测覆盖 tab/q/sort/dir、中文/空格/冒号折叠、大小写与 BJT。
- 边界：只改 `modules/capabilities|skills|tools/**` + 本 DONE；未碰 App/shell/routes/registry/package·lock/web-scripts/ops；未安装依赖；无 force/amend/--no-verify。

## R77 / asOf 三态回归护栏（纯测试，2026-11-20）
- 任务：新增 `web/src/modules/health/asof.presentation.test.ts`，只加测试，不改产品行为；基线 `38cd088b`（章面 `a5832d15` / 代次 `60a4a429`，merge 已 up to date）。
- 回归点：
  - 六个顶层别名 `asOf/as_of/collectedAt/collected_at/generatedAt/generated_at` 均输出同一北京时间到分，`readHealth`、`readSystemHealth`、`topLevelIsoAsOf`、`readTopAsOf` 的 value/title 逐字相等。
  - 空串、`2026-13-40`、无时区裸日期、缺键：`—`，title 恰为 `上游没带采集时刻，不用本机时间顶替`；假时钟 2031 下不混入当前时间。
  - 未来数据 `2031-03-04T00:00:00Z` 显示 `2031-03-04 08:00`，不隐藏；假时钟 2031-06-06 时屏上仍是数据日期，不出现本机时钟值。
  - `asOfSource=bff-read-time` 只在 title；正文（ver5/sys3/sys6/sys8/cap7）不含该词。
  - 载体覆盖：ver5 `ver5-health-asof`、sys3 `sys3-asof`、sys6 `sys6-asof-health`、sys8 `sys8-asof-health`、cap7 `cap7-detail-asof`；同一 helper title 逐字一致。
  - 请求计数：ver5 1 次（health 优先，不回落 version）；sys3 1 次；HealthPage 4 次（health + 3 探针）；cap7 纯组件 0 次。
- 验证原始 stdout：
  - `npx vitest run src/modules/health/asof.presentation.test.ts` → 1 file / 5 tests passed。
  - `npx vitest run src/modules/health src/modules/version` → 9 files / 69 tests passed。
  - `npx vitest run` → **153 files / 2018 tests passed**。
  - `tsc -b . --noEmit` → exit 2，均为基础 approvals/employee-detail/employees 旧错；本文件 0 错。
- 边界：仅新增测试文件 + 本 DONE；未改产品代码、App/shell/routes/registry/package·lock/web-scripts/ops；未 install/main merge/9122 rebuild；未引工作树 entry/sha。

## R78｜/capabilities?tab=version 复制版本信息（ver-copy）

- 基线：`a5832d15` / 代次 `60a4a429`；显式 refspec fetch 后 merge 为 Already up to date，无 reset。
- 实现：新增 `web/src/modules/version/versionCopy.ts`（固定表头 `服务名 | 版本或构建标识 | 健康态 | 采集时刻`，按屏上版本表行序；缺失 `—`，不补 0；采集时刻只取屏上 `health.view.asOf`，不使用本机时钟，不写 `asOfSource`）；`VersionHealthSurface` 增 `ver-copy` / `ver-copy-status` / `ver-copy-fallback`，`aria-live` 播报「已复制 N 行」，剪贴板拒绝时展开逐字相同的只读 textarea；整面 loading/empty/gap/login/error 时按钮 disabled+title 原因（GAP 仅 title）。
- 读数：1440/1280/375 `bodySW=bodyCW=视口`、`pageSW=pageCW`（1438/1278/373）；两行复制文本逐字为
  `服务名 | 版本或构建标识 | 健康态 | 采集时刻`
  `控制台服务（BFF） | 9.9.9 | 正常 | 2026-11-19 23:17`
  `工作进程 | — | 降级 | 2026-11-19 23:17`
  点击前后 `fetchJsonStrict` 计数 1→1；屏上不含 `bff-read-time`，仅 `ver5-health-asof` title 含。
- 验证原始 stdout：`npx vitest run src/modules/version` → 2 files / 17 passed；`npx vitest run` → **153 files / 2021 passed**；`tsc -b . --noEmit` → exit 2，23 行均为基础 approvals/employee-detail/employees 旧错，本域 0。
- 边界：仅 `modules/version/**` + 本 DONE；未改 App/shell/routes/registry/package·lock/web-scripts/ops；未 install/main merge/9122 rebuild；未引工作树 entry/sha。

## R79 / sys14 wiring verdict — `/system?svc=` deep link

- Baseline: explicit SSH fetch + `git merge --no-ff origin/lane/hermes-console` → merge `837be907`; upstream chapter `0c1b94c3` / code generation `9813d7af`. No reset.
- Source: `git grep -n "svc" -- web/src/modules/health` found `SystemHealthSurface.tsx` sys14 state/read/target/notice blocks, `serviceLink.ts`, health CSS and 6 tests. App `/system` route uses `SystemAwareTabs` → `ConsoleModulePage module="system" live={{ health: <HealthConsolePage/> }}`; `overriddenPaths` is built only from `tab.override` and no manifest overrides `/system`. So the feature is mounted in source.
- Live 9122 served build: `HealthPage-ph_8V3JF.js` contains `sys14-link-target` / `sys14-link-missing` / `sys3-row`. DOM at `#/system?svc=console` (also `/system?svc=console` and path+hash form) contains `sys14-link-missing` twice, `sys3-gap` and 系统健康. R49's “three generations not mounted” is a false negative (sampled before the health read settles, or looked for a stable `sys14-link` marker that did not exist during loading).
- Fix: wrap the svc notice in a stable `data-testid="sys14-link"` with `data-state="loading|target|missing"`; render `sys14-link-loading` while the health read is pending, with `sys14-link-clear` preserving all other params. When ready the existing target/missing notice renders unchanged. No extra request; manual row click still clears stale svc.
- Tests: `cd web && npx vitest run src/modules/health` → **7 files / 56 passed**; full `npx vitest run` → **159 files / 2172 passed**; tsc exit 2 with 37 baseline approvals/employee-detail/employees lines, zero health/version errors.
- DOM widths (served 9122, no rebuild): 1440/1280/375 `vw=bodySW=bodyCW=1440/1280/375`; `sys14-link-missing` present at all three.
- Boundaries: only `web/src/modules/health/**` + DONE; no App/shell/routes/registry/package·lock/web-scripts/ops; no install/force/amend/--no-verify; no main merge; no 9122 rebuild.

## R80 /system copy scope disclosure (2026-11-20)

- Baseline: explicit SSH refspec fetch + `git merge origin/lane/hermes-console` → merge `affe1006`; upstream chapter `0c1b94c3` / code `9813d7af`; no reset.
- Added shared `web/src/modules/health/copyScope.ts`: `COPY_SCOPE_TEXT = "复制的是当前展开/当前排序下的已加载行，不是全量。"`; `withCopyScope()` appends once (idempotent, strips trailing punctuation).
- `SourceMatrix.tsx`: `sys10-copy` title now `withCopyScope("<enabled/disabled reason>")`; visible read-only `sys-copy-scope` line after the matrix actions. Existing `sys7-export`/`sys10-copy`/`sys10-fallback` behavior, disabled reasons and zero-request copy unchanged.
- `VersionHealthSurface.tsx`: `scopedCopyTitle = withCopyScope(copyTitle)` on `ver-copy`; same visible `sys-copy-scope` line after the header. Existing `ver-copy`/`ver-copy-status`/fallback and 404 disabled reason unchanged.
- Tests: `SourceMatrix.test.tsx` asserts exact scope text, title contains scope, and copied data-line order equals table body order (`rowIds()` + `sys6-name-*`) with first/last checks; `VersionHealthSurface.test.tsx` asserts exact scope text, title contains scope on ready and on 404 disabled. Both keep clipboard fallback and zero-fetch assertions.
- Verification: `cd web && npx vitest run src/modules/health src/modules/version` → **9 files / 73 passed**; full `npx vitest run` → **159 files / 2172 passed**; `./node_modules/.bin/tsc -b . --noEmit` → only baseline approvals/employee-detail/employees errors, own domain 0.
- DOM: temporary Vite/Chrome harness (deleted; Vite 5502 / Chrome 9302) at 1440/1280/375: health and version both `vw=bodySW=bodyCW=1440/1280/375`; `sys-copy-scope` exact text on both; `sys10-copy`/`ver-copy` titles both end with the same scope sentence and are enabled; health matrix default name-asc 4 rows first `控制台服务探针` last `Hermes 运行时探针`; version table 2 rows first `控制台服务（BFF）9.9.9—正常` last `工作进程——降级`; no horizontal overflow.
- Boundaries: only `modules/health/**` + `modules/version/**` + DONE; no App/shell/routes/registry/package·lock/web-scripts/ops; no install; no main merge; no 9122 rebuild; no force/amend/--no-verify. Working-tree entry/sha not cited.

## R81 /system 统一刷新语义 (sys-refresh)

- Base: merge `affe1006`; chapter `0c1b94c3` / code `9813d7af`; HEAD before commit `3bf19bc9`.
- New `web/src/modules/health/systemRefresh.tsx`: `useRefreshCoordinator(expected)` derives `busy/updatedAt/error/tick/start/finish`; `SystemRefreshBar` renders `sys-refresh`, busy note, updated-at, error + copyable `sys-refresh-request-id` + `sys-refresh-retry`.
- `/system?tab=health` (`HealthPage`): header `sys-refresh` replaces `hlt5-refresh`; one action refreshes `/api/health` (service list + matrix health row) and the three probes. Busy keeps old `hlt5-table`/`hlt5-list` and `sys3-table`; second click ignored (`disabled` + `aria-busy`). Failure keeps old batch, shows `sys-refresh-error` with rid, no updated-at.
- `/system?tab=version` (`VersionPage`): same `sys-refresh` refreshes `VersionHealthSurface` (`/api/health`; `/api/version` only when health has no rows) and the price read (`/api/models/pricing`); old tables remain while busy; failure keeps old batch + error.
- Request counts: health initial `/api/health` 1 + probes 1 each = 4; refresh = same 4, each path +1. Version initial health 1 + pricing 1 = 2; refresh = same 2.
- `hlt5-refresh` removed; `sys3-refresh` hidden on the composed page via `hideRefresh` (standalone surface still exposes it for its own tests). No service restart is triggered by refresh; all requests are read-only GETs. 8642 process changes are outside this lane and were not touched.
- Verification: health/version targeted **9 files / 76 passed**; full **159 files / 2175 passed**; tsc baseline approvals/employee-detail/employees only, own domain 0.
- DOM 1440/1280/375 health+version: `vw=bodySW=bodyCW`; busy note exact; old rows retained (4 health / 2 version); updated-at `刷新完成于 2026-11-20 12:33（读取时刻，不是数据时刻）`; no error; no overflow.
- Boundaries: only `modules/health/**`, `modules/version/**`, DONE; no App/shell/routes/registry/package·lock/web-scripts/ops; no install/force/amend/--no-verify; no main merge; no 9122 rebuild.

## R82 / /system 页尾口径说明块（sys-notes）

- 基线 merge `6d519d91`（章面 `0c1b94c3` / 代码代次 `9813d7af`，上游 `ee64b4f0`）。
- 新增 `web/src/modules/health/SystemCaliberNotes.tsx`：原生 `<button type="button">` 折叠，默认收起且 `sys-notes-body` 不渲染；展开后六行 `sys-note-<key>`（服务列表 + 读源矩阵四读口 + 版本面健康行 + 模型价格表），每行四段：口径名 · 实际路径 · 计算范围 · 缺值策略。读源矩阵四行由 `sourceReads.ts` 的 `sourceDefinitions()` 单点派生，无第二套路径文案；任务文案写“六读口”，现实现矩阵实为四读口，本单补齐版本面两行后总数六行，未臆造两行矩阵读口。
- 缺值策略统一为 `缺值显示—，不当 0；采集时刻只取上游顶层 ISO，缺失显示—，不拿本机时间顶替。`；并有一句说明服务健康状态与读源可达性口径不同，不能互相替代。
- 挂载：`HealthPage.tsx` 在 `<SourceMatrix />` 后；`VersionPage.tsx` 在价格卡后（两 tab 每次只挂一个，testid 不重复）。展开/收起零新请求。
- 验证：定向 `SystemCaliberNotes.test.tsx + health + version` → 10 files / 78 passed；全量 `160 files / 2177 passed`；tsc 仅基线 approvals/employee-detail/employees 错误，health/version 0。DOM（临时 harness，已删）1440/1280/375 两 tab：收起 `sys-notes-body=false`；展开 `aria-expanded=true`、6 行、策略两短语命中；请求计数 health 4→4、version 2→2；body 无横溢（375 bodySW/CW 364，视口 375）。
- 写域仅 `modules/health/**`、`modules/version/**` + `docs/_artifacts/gov/**`；未改 App/shell/routes/registry/package·lock/web-scripts/ops；未安装、未并 main、未重建 9122。

## R82 / sys-search — /system 服务列表与读源矩阵名称搜索

- 基线：显式 refspec fetch + `git merge origin/lane/hermes-console`，merge `6d519d91`；章面 `0c1b94c3` / 代码代次 `9813d7af`；工作树干净。
- 读口实测：`git grep -n "filter\|search" -- web/src/modules/health` 仅命中既有 sys5 状态桶本地筛选、`leavePreview` 的 URLSearchParams、`serviceLink.ts` 查询工具与测试/CSS，无服务端搜索参数支持；因此采用本地过滤。
- 实现：新增 `web/src/modules/health/serviceSearch.ts`（hash/window 查询读写 `q`，保留其它参数；大小写不敏感匹配 label/key/path）；`SystemHealthSurface` 增加 `sys-search`、`sys-search-scope-note`（`仅在当前已加载 N 行内搜索`）、`sys-search-clear`、`sys-search-empty`，列表与 sys5 计数改为基于同一 `searchRows`；`SourceMatrix` 读取同一 `q`，过滤矩阵行、计数、排序、导出、复制与表体，并增加 `sys-search-source-empty`。零新增请求，q 落网址可复现。
- 验证：`cd web && npx vitest run src/modules/health` → 8 files / 65 passed；全量 `npx vitest run` → 160 files / 2182 passed；`tsc -b . --noEmit` 仅基线 approvals/employee-detail/employees 错误，本域 0。
- DOM（临时 Vite harness，已删除）：1440/1280/375 `vw=bodySW=bodyCW`（375 内容 364）；`?q=runtime` 服务列表 1 行、矩阵 1 行、摘要「搜索命中 1 / 4 个读口」；`?q=zzz` 服务 `sys-search-empty`、矩阵 `sys-search-source-empty`；`__searchFetch` 首载/展开后均 4，零新增请求。
- 边界：仅 `web/src/modules/health/**` + 本 DONE；未改 App/shell/routes/registry/package·lock/web-scripts/ops；未 install、未并 main、未重建 9122；禁 force/amend/--no-verify。

## R83 / cap-page-scope — /capabilities 列表条数诚实化

- 基线：显式 refspec fetch + `git merge origin/lane/hermes-console`，merge `96ab3954`；上游 `94076a05..74c1e3b3`。
- 截断实测：`git grep -n "slice\|page_size\|limit" -- web/src/modules/capabilities web/src/modules/skills web/src/modules/tools` 仅命中 `rowLink.tsx` 的字符串切分、`sorting.ts` 的数组复制、`tools.ts` 的错误摘要截断与测试断言；列表代码无 slice/page_size/limit。
- 读口回包：`/agent-api/api/skills` 200，`items` 长度 0，键仅 `items`/`asOf`，`total`/`nextCursor` 均 ABSENT；`/agent-api/api/tools`、`/api/tools/toolsets`、`/api/mcp/servers` 均 404 `console.unknown_route`，同源 `/api/*` 为 200 HTML。故 skills 走「全量渲染」分支，tools 走「读口未接入，无法判断总数」。
- 实现：新增共享 `modules/capabilities/pageScope.tsx`（`derivePageScope` + `CapabilityPageScope`）；skills 读取上游 `total`/`nextCursor`，有分页信号时显示「本页按读口单页上限显示 N 项，总数以读口回传为准」+「共 N 项 / 已显示 M 项」或「总数不可用」；无信号时显示「表内全量渲染，共 M 项」+ title 判据；tools 依据 phase/issues 显示全量或未接入。两 tab 均常驻 `cap-page-scope`，随搜索/排序后当前视图重算；导出/复制/排序行为未改。
- 验证：定向 capabilities+skills+tools 9 files / 94 passed；全量 162 files / 2244 passed；`tsc -b . --noEmit` 仅基线 approvals/employee-detail/employees 错误，本域 0。
- DOM（临时 Vite harness，已删除）：1440/1280/375 `vw=bodySW=bodyCW`（1440/1280/375）；skills 2 行、tools 2 行均显示 `表内全量渲染，共 2 项` + 判据 title，无横溢。
- 边界：仅 `modules/{capabilities,skills,tools}/**` + DONE；未改 App/shell/routes/registry/package·lock/web-scripts/ops；未 install、未并 main、未重建 9122；禁 force/amend/--no-verify。

## R84 / sys-matrix-copy — /system 读源矩阵「复制本表」

- 基线：显式 refspec fetch + `git merge origin/lane/hermes-console`，Already up to date；HEAD `7c82e3ad`；wave-23 代码 `94076a05` / 章面 `74c1e3b3`。
- 实现：`sourceMatrixCsv.ts` 新增 `toMatrixText(rows)`，表头固定 `口径名\t路径\t状态\t耗时\t采集时刻`，逐行按 `sortedRows` 取屏上值，缺值 `—`，行尾换行；`SourceMatrix.tsx` 新增 `sys-matrix-copy`、`sys-matrix-copy-status`、只读 `sys-matrix-copy-fallback`。沿用 `copyDisabled`/`matrixBlockTitle`：空表或全失败 disabled + 既有原因句；`withCopyScope` 同一句。原 `sys10-copy` 与 CSV/排序/搜索全保留。
- 行序/零请求：整表默认 name asc 复制 4 行，首末与表体一致；`?q=探针&ssort=state&sdir=desc` 复制 3 行，首末与表体一致；两次 `fetchJSON` 均 4→4，无新增请求。
- 验证：定向 `src/modules/health` 8 files / 68 passed；全量 162 files / 2247 passed；`tsc -b . --noEmit` 仅基线 approvals/employee-detail/employees 错误，本域 0；DOM 1440/1280/375 `vw=bodySW=bodyCW`（375 内容 364），无横溢。
- 边界：仅 `modules/health/**` + DONE；未改 App/shell/routes/registry/package·lock/web-scripts/ops；未 install、未并 main、未重建 9122；禁 force/amend/--no-verify。

## R84 / cap-row-copy — /capabilities 行详情「复制该行」

- 基线：显式 refspec fetch + `git merge origin/lane/hermes-console` 已是 up to date；HEAD `3000f052`；wave-23 代码 `94076a05` / 章面 `74c1e3b3`。
- 实现：`capabilities/listCopy.tsx` 新增 `CopyField`/`toFieldText`（每行 `label：value`，缺失 `—`）与 `CapabilityFieldCopy`（`cap-row-copy`、`cap-row-copy-status` aria-live、`cap-row-copy-fallback`）；`rowDetail.tsx` 在 `</dl>` 后按屏上六字段顺序渲染：口径名 / 类型或来源 / 启用态 / 最近更新 / 读口路径 / 采集时刻；skills/tools 共用。折叠行不挂载详情，按钮不存在而非 disabled。样式 `.cap7-copy` 追加 `counts.css`。
- 测试：新增 `RowCopy.test.tsx`（六行文本、缺失 `—`、成功「已复制」、剪贴板拒绝 fallback 逐字同）；skills/tools 详情测试补「展开前无按钮 / 展开后有 / Esc 收起后无」；定向 10 files / 96 passed；全量 163 files / 2249 passed；tsc 仅基线错误，本域 0。
- DOM（临时 harness，已删除）：1440/1280/375 `vw=bodySW=bodyCW`；skills 复制 6 行（采集 `2026-11-19 14:00`，fetch 1→1）；tools 复制 6 行（最近更新/采集均 `—`，fetch 5→5）；两 tab 均无 fallback、无横溢。
- 边界：仅 `modules/{capabilities,skills,tools}/**` + DONE；未改 App/shell/routes/registry/package·lock/web-scripts/ops；未 install、未并 main、未重建 9122；禁 force/amend/--no-verify。

## R85 / R52 OBS 整改 — sys-matrix-copy-status 可见反馈（`feat(console): system copy status visible feedback`）

- 基线：显式 refspec fetch + `git merge --no-ff origin/lane/hermes-console`（禁 reset），HEAD 由 `cd826f7d` 到 merge `46160f47`；上游带入 appr/aud/ui2 工件与 `tests/gateway/test_c1_forward_latch.py`。
- ① 状态节点：`SourceMatrix.tsx:206` 的 `sys-matrix-copy-status` 补 `role="status"`（原只有 `aria-live="polite"`）；成功 `已复制 N 行`、失败文案按派工单改为 **「复制失败，可手动选择文本」**（原「复制失败，已展开手动复制」）。同帧只播一次：把 `matrixCopyState` + `matrixCopiedRows` 两个 useState 合成**单个对象 state** `matrixCopy{state,rows}`，一次 `setMatrixCopy` 落地，避免两段文案分帧触发两次播报；早退分支（无 `navigator.clipboard`）与 catch 分支同样单点 set。
- ② 复制内容吃搜索与排序态：`matrixText = toMatrixText(sortedRows)`，`sortedRows = sortSourceRows(searchedRows, sort)` —— 即 `sys-search` 的 q 与 `sys13` 排序共同决定行序，行序 == 表体。实测两组首末行（jsdom 取证后已删临时落盘）：
  - 组一（无搜索，点 `sys13-sort-state` 升序）首行 `系统健康清单\t/agent-api/api/health\t成功\t2 ms\t2026-11-19 23:17`，末行 `控制台服务探针\t/agent-api/api/__health-probe__\t读口未接入\t2 ms\t—`，表头 `口径名\t路径\t状态\t耗时\t采集时刻`。
  - 组二（`?q=探针` 命中 3 行 + `sys13-sort-asof`）首行 `域服务探针\t/agent-api/api/skills\t成功\t0 ms\t2026-11-20 06:15`，末行 `Hermes 运行时探针\t/agent-api/api/hermes-summary\t失败\t0 ms\t—`；被搜索滤掉的 `系统健康清单` 不在文本内。
- ③ 新增断言（`SourceMatrix.test.tsx`）：`role=status`/`aria-live=polite` 存在；空闲态 textContent 为空，点击后非空且等于 `已复制 <表体行数> 行`；失败态文案与成功态**不同**且非空，同时 `sys-matrix-copy-fallback` 只读 textarea 在位；两态下 `api.fetchJSON` 调用数与点击前**完全一致**；搜索+排序组的复制行序逐行等于 `sys6-row-*` 表体顺序、行数 = 表体行数 + 表头。
- 验证：定向 `src/modules/health` → **8 files / 70 passed**；全量 → 166 files / 2306 passed + **1 failed**（`src/modules/approvals/ApprovalsPendingModulePage.test.tsx > pending queue states > error says it in a sentence...`，单独跑该文件 **36/36 通过** ⇒ 上游自带用例在全量并发下的串扰，非本域、非本轮改动引起；本域写域只有 health）。`tsc -b . --noEmit` exit 2，错误只在 approvals/employee-detail/employees 基线，`modules/health` 0 条。
- 三档口径（偏离披露）：本轮**未重跑浏览器三档实测**。原因：改动只在既有 `.sys10-status` span 内换文案与加 ARIA 属性，未动类名、容器结构、CSS 或行列布局（`counts.css`/`sys*.css` 零改动），宽度溢出行为不可能因此变化；jsdom 断言与视口无关。如需 1440/1280/375 的像素级复测，请下令，我按既有 harness 补测。
- 边界：写域只有 `web/src/modules/health/**` + `docs/_artifacts/gov/DONE.md`；未碰 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未 install、未并 main、未重建 9122；禁 force/amend/--no-verify。

## R86 / cap-export-scope-parity — /capabilities 导出口径与列表口径联动（`feat(console): capabilities export scope parity`）

- 基线：显式 refspec fetch + `git merge --no-ff origin/lane/hermes-console`（禁 reset），HEAD 由 `29544c97` 到 merge `eee6693a`；上游 tip `f54b8a37`（gateway `channel_event_bridge.py` 发送者 open_id + 新 `tests/gateway/test_channel_event_sender_ids.py`），页面代次仍 `fa7c2155`。
- ① 行数来源现查结论（改前）：**skills 已经同源** —— `SkillsPage.tsx` 的 `exportRows = sortedRows.map(...)` 与 `derivePageScope({shown: sortedRows.length, total, nextCursor})` 都取自 `sortedRows`（= q 过滤 + `capA` 排序后的数组），所以导出 N 与 `cap-page-scope` N 必然相等。**tools 不同源但同数** —— `pageScope.shown` 取 `visibleRows.length`，导出取 `displayRows = [...toolRows, ...mcpRows]`（`source` 只有 toolset|mcp 两值，分区穷尽 ⇒ 长度恒等，但数组身份不同，将来任一侧加分组过滤就会分叉）。本轮把 tools 的 `shown` 收紧为 `displayRows.length`，让两侧引用同一数组而不只是恰好相等。
- ② 措辞单点：新增 `pageScope.tsx:76-94 exportScopeNote(scope)`，按 mode 派生唯一一句；三个消费点全部读它 —— CSV 末行 `#${note}`（`csv.ts toCsv(rows, note=null)`，`#` 开头单列注释行，**不计入数据行**）、`cap6-export` 的 title（仅 `gate.enabled` 时追加 ` · ${note}`，空态门控句保持逐字不变）、`cap-export-name` 的预览 title 尾部 `导出口径：${note}`。屏上新增 `cap-export-scope-note`（`data-mode`/`data-shown`，title 说明「同时写进 CSV 末行的 # 注记，注记不计入数据行」）。措辞按 mode 分流：capped → 「本次导出为当前已加载 N 项，读口回传总数 M 项，不是全量」（无 total 则「读口未回传总数」）；full → 「本次导出为表内全量，共 N 项」；unavailable → 「读口未接入，无法判断总数；本次导出屏上 N 行，不代表全量」；loading → 「列表仍在读取，本次导出不代表任何总数」。
- ③ 全量分支如实写：`/agent-api/api/skills` 实测不回传 `total`/`nextCursor` ⇒ mode=full，注记写「表内全量，共 N 项」，**不含「已加载」字样**（`pageScope.test.ts` 用 `not.toContain("已加载")` 钉死）。「已加载 / 不是全量」只在读口真带分页信号时出现，本轮用 harness 造 `total:57 + nextCursor:"cur_2"` 与 jsdom mock 各验一次。
- ④ 三方同源断言（②③两支 + 既有支）：skills 过滤支与 tools 搜索支各自断言 `cap-export-scope-note` 文本 == CSV 末行去掉 `#`、`data-shown` == 表体行数 == `cap-page-scope` 内的数字 == CSV 非 `#` 行数减表头；`cap6-export` title 含该句。`csv.test.ts` 钉住「加注记后数据行数不变」。零额外请求：两侧导出前后 `urls()` / `fetchJsonStrict` 计数不变（tools 搜索支仍为 6）。
- ⑤ 零破坏与三档实测（临时 Vite+CDP harness，取证后已删）：`cap4–capH/skl4/tl3/sys*` 全量套件绿；三档 × 三页共 9 组合，`vw == body.scrollWidth == body.clientWidth`（1440/1280/375 精确），无横溢：
  - skills-full：rows=2，scope「表内全量渲染，共 2 项」，note「本次导出为表内全量，共 2 项」，CSV 数据行 3（表头+2）末行 `#本次导出为表内全量，共 2 项`，fetch 1→1。
  - skills-capped：rows=2，scope「本页按读口单页上限显示 2 项，总数以读口回传为准」，note「本次导出为当前已加载 2 项，读口回传总数 57 项，不是全量」，CSV 末行同句，fetch 1→1。
  - tools：rows=1，note「本次导出为表内全量，共 1 项」，CSV 数据行 2，fetch 5→5。
- 验证：定向 `src/modules/{capabilities,skills,tools}` → **10 files / 103 passed**；全量 → **166 files / 2314 passed**（0 failed，approvals 那条上游串扰本轮未复现）；`tsc -b . --noEmit` exit 2，错误只在 approvals/employee-detail/employees 基线，本域 0 条。
- 诚实披露：派工单引用的「已加载 N 项」不是 `cap-page-scope` 的实际文案 —— 屏上真实字符串是「表内全量渲染，共 N 项」/「本页按读口单页上限显示 N 项，总数以读口回传为准」，「仅在当前已加载 N 项内搜索」属于 `cap5-scope-note`（搜索作用域）。本轮按真实 mode 出措辞，没有为贴合派工单而改列表既有文案。另外注记在**空列表**时仍然渲染并写「共 0 项」（与 `cap-page-scope` 的 0 口径一致），只有按钮 title 不加注记（保持门控空态句逐字）。
- 边界：写域只有 `web/src/modules/{capabilities,skills,tools}/**` + `docs/_artifacts/gov/DONE.md`（11 文件）；未碰 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未 install、未并 main、未重建 9122；禁 force/amend/--no-verify。

## R87 / capabilities rowparity guards — wave-29 三面 parity 纯测试护栏

- 基线：显式 refspec fetch + `git merge --no-ff origin/lane/hermes-console`（上游 tip `54f3dcfc` 账本章笔并入）；HEAD merge `591f7777`；禁 reset 未用；工作树开工前干净。
- 交付：新增 `web/src/modules/capabilities/capabilities.rowparity.test.tsx`（jsdom，11 tests），零产品码改动。①行详情 vs 列表行：`cap7-detail-{name,type,enabled,updated}` 与 `skl4-row-*` 四格逐字相等（s1 全值行 + s2 全缺行）；未知态两处同「待核实」，列表格 title=原值 `mystery`、详情 title 含 `mystery`；endpoint `/agent-api/api/skills`，asOf `2026-11-19 14:00` 且 title 含 UTC 原文。②`capC-copy`：复制行 == 表体行序 == 四格值 join(',')，缺值「—」且正则断言无 `,0` 伪造；空集 disabled、title === `cap-gates-copy` title === 「当前没有可导出的条目。」，点击零剪贴板调用。③条数范围：`cap-page-scope` N == 表体行数 == 导出数据行数（注记除外），`cap-export-scope-note` `data-shown`==N 且 CSV 末行 == `#`+注记逐字；capped 分支（total 57+nextCursor）注记「已加载 2 项…不是全量」且全页无「表内全量渲染」。④采集时刻：`vi.useFakeTimers({now:2031, toFake:["Date"]})` 冻结假时钟，`generated_at` 别名 → 屏上/行复制/列表复制均 `2026-11-19 14:00` 且无「2031」；无别名/非法 `asOf`/非 ISO `collectedAt` 三例 → 「—」+title 含「不用本机时间顶替」且不含 2031。
- 诚实边界：2031 断言范围是采集时刻相关节点（`cap7-detail-asof`/`skl4-source`/`cap-page-scope`/两份复制文本）；`cap-export-name` 的导出时刻戳按既定契约合法取本机时钟（文件名契约，非数据时刻），故不纳入 2031 断言。护栏首跑全绿：未测出真缺陷，零产品码改动。
- 验证：新文件 11/11 定向通过；`src/modules/capabilities` 8 files/45；三面定向 11 files/114；全量 **170 files / 2362 passed 0 failed**；`tsc -b . --noEmit` exit 2 仅 approvals/employee-detail/employees 基线，本文件 0 错（修过 2 类 TS 报错：`querySelector` 泛型与未使用变量，均为测试自身，非行为）。
- 纪律：写域仅 `modules/capabilities/**` + DONE；未碰 App/shell/routes/registry/package·lock/web-scripts/ops；未 install、未并 main、未 force/amend/--no-verify。

## R88 / cap-filter-parity — 能力面复制与导出在筛选态下的一致性护栏（纯测试）

- 基线：显式 refspec SSH fetch，上游 lane/hermes-console 移动 54f3dcfc..1683d467；git merge --no-ff → 合并提交 1c7080d4（28 文件 +1490/−42：appr V2 知识最新版本链接、ui1 KNW5、ui2 MET6、approvals/audit/employee-detail/employees 测试与代码、knowledge updated.ts、metrics 时间一致性测试、runs 模块）。上游改动与 capabilities/skills/tools 无交集，本域写面未被触碰；未用 reset --hard。
- 交付：新增 web/src/modules/capabilities/capabilities.filterparity.test.tsx（15 例）+ 本节 DONE。零产品码改动。
- ① 筛选/排序态三方同源：skills ?q=报&sort=name&dir=desc → 表体 [周报汇总, 日报生成]，capC-copy 首列序列逐字等于表体，cap6-export 非 # 行 3 行（表头+2）首列等于表体，cap-page-scope N=2，cap-export-scope-note data-shown=2，CSV 末行 === #+屏上注记；cap5-scope-note 同时写「仅在当前已加载 4 项内搜索」——已加载 4 与当前可见 2 是两回事，两处各说各的口径。skills 无 q + sort=name&dir=asc → 4 行表体与 localeCompare(zh-Hans) 升序一致，三面同源；复制/导出后 calledUrls 仍是 ["/agent-api/api/skills"]，零额外请求。tools：sort=name 升/降两次挂载行集相同、顺序不同（排序确实生效，且不去猜它读哪个字段——tools 的排序取值并非屏上显示名，见下），再以 q 收窄后 capC-copy / cap6-export / 表体 / cap-page-scope 四者同步。
- ② 空集与未知读口（含偏离披露）：?q=不存在的词 → skl4-no-match 存在、表体 0 行、capC-copy 与 cap6-export 均 disabled、cap-gates-copy.title === cap-gates-export.title === 「当前没有可导出的条目。」、两处 data-enabled="false"、剪贴板调用数 0。计数位实测渲染 「0 条」 而非派工单要求的 「—」 —— 本轮为纯测试禁改产品行为，故按实际断言并在此登记偏离：deriveGates 的 countText 是 success ? N 条 : 「—」，no-match 属读取成功、当前视图真值为 0，写 「—」 反而抹掉这个真 0；「—」 归未知计数分支。该分支由第二例证实：读口 500 → 计数位 「—」、两处门标题相同且不同于空集句、cap-page-scope 为 「读口未接入，无法判断总数 · 不把空列表当 0 项，也不按已加载条数推算总数。」（不含「共 0 项」/「显示 0 项」）、cap-export-scope-note data-mode=unavailable 且含「不代表全量」。
- ③ 切 tab：shell 标签条（src/shell/console.tsx 的 preserve memo，只丢 tab/view/zone）把 q/sort/dir 带过去——该文件在禁碰范围，故测试不点击真标签，而是用带过去的同一串 search 挂载另一页，并断言产品侧事实：两页挂载都不剥 q/sort/dir（cap8-location 仍含 q=%E6%8A%A5、sort=name、dir=desc），tools 页吃同一个 q，切回 skills 后 fetchJsonStrict 调用数不变（cachedSkillsState / useToolsData 的 cachedTools 命中，0 新请求）；URL 与切走前逐字相同。第二例：入口无 tab= 时 useEnsureTabParam 补上 tab=skills 且不动 q/sort。
- ④ 采集时刻：it.each 六个顶层别名（asOf/as_of/collectedAt/collected_at/generatedAt/generated_at）配假时钟 2031-03-01 → cap7-detail-asof 「2026-11-19 14:00」、行详情 cap-row-copy 文本含「采集时刻：2026-11-19 14:00」、cell/复制文本/cap-page-scope 三处均无 「2031」；无任何别名 → 「—」 且 title 含「不用本机时间顶替」，复制行为「采集时刻：—」；generated_at 非 ISO（「昨天下午」）同样拒用本机时间。
- 自测纠错（非产品缺陷）：首轮 2 例红。其一以为 tools 降序 = 升序反转，实际排序取值不是显示名，改为「行集相同 + 顺序不同」的内部一致性判据；其二对 cap-page-scope 用了 not.toMatch(/\b0\b/)，撞上诚实文案「不把空列表当 0 项」，收窄为禁止「共 0 项」/「显示 0 项」。两处只改测试断言，产品码零改动。
- 验证：新文件 15/15；src/modules/capabilities 9 文件 / 60；三域定向 12 文件 / 129；全量 174 文件 / 2406 passed 0 failed（合并后新基线）；tsc -b . --noEmit exit 2，错误仅在 approvals / employee-detail / employees 基线，本域 0。
- 边界：只加 1 个测试文件 + DONE；未改 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未 install、未并 main、未重建 9122；未用 force/amend/--no-verify；单 commit。

## R89 / capF-state-anchor-text — 能力面状态锚改为可见文案（@202@）

- 基线：显式 refspec fetch 后 `git merge --no-ff origin/lane/hermes-console` → 合并提交 `6b03ef65`（上游 `1683d467`，150 文件，多为 `docs/_artifacts/tonight/**` 证据）；未用 reset。
- **派工前提已过时（如实披露）**：单据称 `capF-state-*` 四态锚「只有 testid 无人类可读文本」。实测不是：R47（commit `b4f962f5`）已给每个锚写了整句，但挂在 `className="sr-only"` 上不可见，且旁边另有一段重复的可见段落。真正的缺陷是**可见性 + 重复**，本轮按此修：锚去掉 `sr-only` 成为可见 `<p className="capF-state-text">`，删掉被它涵盖的重复段落。
- 单一 helper：新增 `capabilities/stateAnchor.tsx`，`stateAnchor({kind,subject,heading,reason,gap,requestId,loaded})` 六态（loading / empty / filter-empty / error / denied / login）一处产出 lead + detail + title；`CapStateAnchor` 渲染。文案按单据口径：loading「正在读取<对象>…」（把主语写进句子而非裸「正在读取…」）、真空「这个读口已接入，但目前没有条目。」+ 明细、筛选空「当前条件下没有匹配项。」、error「读取失败：…（可用下方重试）」、denied「无权读取这条数据。」、login「需要重新登录。」。title 一律带「原因：」「请求编号：」「去处：」（重试 / 清空搜索 / 审批中心 `#/approvals` / 刷新重登）；`gap` 只进 title，屏上永不出现 `GAP-`。
- 接线：`SkillsPage.tsx` 四态 + no-match、`ToolsPage.tsx` `FailurePanel`（denied/login/error）+ loading + empty + no-match 全走该 helper；`tl3-no-match` Card 补 `capF-state` 类。`counts.css` 新增 `.capF-state-text` / `.capF-state-detail`，两者皆 `overflow-wrap:anywhere`。
- 去重：`ToolsPage.tsx` 页级状态行 `tol5-status` 原先在 loading 时重复同一句「正在读取工具与 MCP 清单…」，改为 loading 期不渲染（读取中的唯一句子是锚）。注：`tol5-status` 本就同时是行内 `<span>`（:183）与页级 `<p>`（:683）的 testid —— 既有碰撞，未在本轮范围内动。
- GAP 承载回归：旧的 `<p className="skl4-note" title={page.gap}>` 被合并进锚，故 skills 测试 231/268 改为断言 `capF-state-unavailable` 的 title 含 `GAP-SKL4-01`；屏面无 `GAP-` 的守卫不动。
- 文案更正两处 `capF-state-empty-text`：skills →「读口已接入，本次返回 0 条；技能没有返回任何条目，这里不补样例行。」；tools →「…工具与 MCP 清单没有返回任何条目，这里不补样例行。」
- 实测中发现并修的缺陷：上游原因句自带句号，模板再加一个 → 屏上出现「。。」。`stateAnchor()` 新增 `reasonText = reason.replace(/[。；;.\s]+$/, "")`（只作用于原因位，搜索词在「」内保留原字符），并补一条回归测试断言 error/denied/login 三态拼接后无「。。」。
- DOM 三档（临时 harness，已删）：1440/1280/375 × 10 个状态组合共 30 行，每行 `innerWidth == body.scrollWidth == body.clientWidth`，每个 `.capF-state-text` 的 `scrollWidth == clientWidth`（如 1440 skills loading 1376/1376、375 tools loading 343/343），`sr-only` 全为 false，每状态页恰好一个锚，ready 态无锚。六态文案在两档逐字相同且互不相同。
- 一处既有事实如实记录：skills 的 `?state=error` 落在 **unavailable** 分支（`capF-state-unavailable`），error 分支须用真实 502 拒绝驱动；tools 的 `?state=error` 正确落 `capF-state-error`。属既有 fixture 映射，未改。
- 验证：定向 `src/modules/{capabilities,skills,tools}` → 14 files / 142 passed；新增两文件 2 files / 14 passed；全量 176 files / 2420 tests → **2419 passed / 1 failed**，失败者是上游 `src/modules/audit/audit.window.test.ts`「has one meaning per tier…」，`windowBounds` 两次取时钟差 1 ms（…148Z vs …149Z）的抖动 flake，单跑该文件 12/12 绿，非本域改动所致；`tsc -b . --noEmit` exit 2，错误仅在 approvals / employee-detail / employees 基线，本域 0。
- 零破坏：`cap4 / cap5 / cap6 / cap7 / cap8 / capC / cap-page-scope / gates` 全绿（本轮只动 `capF-*` 与 `tl3-no-match` 容器类名）；`cap9-state-*`、`tl3-*`、`skl4-*` 语义标记保留。
- 边界：写域仅 `modules/{capabilities,skills,tools}/**` + `docs/_artifacts/gov/**`；`web/src/shell/fixtures.ts` 只读未改；未动 App.tsx / shell / routes / registry / package·lock / web-scripts / ops；未 install、未并 main、未重建 9122；无 force / amend / `--no-verify`。

## R90 / sys-refresh-asof-separation — /system 刷新时刻与数据时刻分离护栏（纯测试）

- 基线：显式 refspec fetch 后 `git merge --no-ff origin/lane/hermes-console`（上游 `f1b509b9..608148d3`，wave-31 代次）→ 合并提交 `40c9147e`；上游改动与本域零重叠（`git diff --name-only HEAD^1 HEAD -- web/src/modules/{health,skills,tools}` 为空）；未 reset --hard。零产品码改动。
- 新增 `web/src/modules/health/system.refresh.test.tsx`（4 测试）：夹具给四个读口各配**互不相同**的顶层 asOf（health 14:00 / console 09:30 / runtime 10:45 / domain 12:15，bisheng 试点行「—」），并用假时钟把本机时间钉在 2030-06-01，使 `sys-updated-at` 与 13 个数据时刻格（`sys3-asof`、`sys6-asof-*`/`sys8-asof-*`×4、`hlt5-asof-*`×4）可逐格比对。
- ① 成功刷新：`sys-updated-at` 含「（读取时刻，不是数据时刻）」与「2030-06-01 08:00」；提取其时刻与每一数据格**全不相等**，且刷新前后数据格逐字不变（两个方向都不覆盖）；busy 期间 `sys-updated-at` 为 null 而数据格保持原值——读取时刻缺席时不冒充数据时刻。
- ② 失败刷新（health 读 500，rid `req-refresh-500`）：不写读取时刻（`sys-updated-at` null）、`sys-refresh-error` 带请求编号与重试钮、sys3 表 2 行 / hlt5 4 行 / 矩阵 4 行全部保留旧批；重试成功清错并落「刷新完成于」，全部数据格与刷新前逐字相同（health 时刻恢复）。
- ③ busy 连点三次（含首次）：按钮 busy 期 disabled，各读口计数恰 {2,2,2,2}——只发一批；`sys-busy-note` 恰一个。
- ④ 单探针失败（runtime 500）只坏自己：三表行数不变，sys3/console/domain 数据格不变，`sys6-row-runtime data-status=failed` 且其时刻「—」，hlt5 行显「异常」带短 rid；其余行不受影响。
- 如实断言的两条产品语义（非缺陷，按现状写死）：其一，非全批失败的单探针失败**不**触发 `sys-refresh-error`——该批仍算完成，协调器落读取时刻；错误条只属于整体不可达或 health 列表读失败。其二，health 列表读失败时矩阵只撤回**该读口自己的**采集时刻格为「—」并标 failed，sys3 表与其余探针时刻全部保留旧批（`hasDataRef` 语义）。
- 验证：新文件 4/4；`src/modules/health` 9 files / 74 passed；全量 **186 files / 2487 passed, 0 failed**（新基线，上游并入抬高了文件数）；`tsc -b . --noEmit` exit 2，错误仅限 approvals / employee-detail / employees 基线文件，本域 0。
- 边界：仅新增该测试文件 + 本节 DONE；未碰 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；纯测试无需浏览器三档；未 install、未并 main、未重建 9122；禁 force/amend/--no-verify 遵守。

## R91 / cap-deeplink-guards — /capabilities 行深链与复原护栏（纯测试）

- 基线：显式 refspec fetch 后 `git merge --no-ff origin/lane/hermes-console`（上游 `dff01eed` 线 → `9014f6ba`）→ 合并提交 `d4f3bcb0`，149 文件全是 `docs/_artifacts/tonight/**` 证据与 `docs/_artifacts/D/DONE.md`，与源码零重叠；未 reset --hard。本轮零产品码改动。
- **派工前提已过时（如实披露）**：单据要求以 `?toolset=<存在/不存在>` 驱动。实测本代代码**不读 `toolset` 参数**：`web/src` 内 grep `toolset=` / `"toolset"` / `'toolset'` 的命中只有读口路径 `/api/tools/toolsets` 与行字段 `source:"toolset"`，没有任何 `params.get("toolset")`；`ToolsPage` 只读 `state`(:340) / `q`(:343) / `sort`·`dir`(:344 `readSort`) / `row`(:354 `rowTargetFor`)，`SkillsPage` 只读 `q` + sort/dir + row。真实的「工具集定位」面是行深链 `?row=tools:<名称>`（`capabilities/rowLink.tsx`）加本地筛选 `?q=`，故 ①–⑤ 按真实机制落测试，不为迁就字面而新增产品行为。
- 同样如实：③ 的「页码归 1」**不适用本代** —— 能力面没有任何分页参数（分页只见于 employees / tasks / runs）。测试把它写成缺席守卫：断言 `page` / `pageNum` / `pageNumber` / `page_size` / `cursor` / `nextCursor` / `offset` / `limit` 一个都不出现在切换前后的参数快照里，而不是假装重置了第 1 页。
- 新增 `web/src/modules/capabilities/capabilities.deeplink.test.tsx`（4 测试）。夹具沿用 tools 既有形状（3 个 toolset 共 4 个工具 + 2 个 MCP ⇒ 6 行），行名一律从 DOM 的 `tl3-name` 派生而不硬编码；读口计数 `reads()` 过滤掉 Vitest 收尾时的无参调用；比对「参数不增加读取」前必须 `resetToolsTabState()`，否则 tools 模块缓存让第二次挂载 0 请求，比对失去意义。
- ① `?row=tools=<存在>` 打开即展开：`cap7-detail-tools` 恰 1、`cap-row-expanded` 在、目标行 `aria-current="true"`；与 `?q=<前两字>&sort=name&dir=asc` 同挂时筛选生效，且 URL 与粘贴串逐字节相同、参数集恰为粘贴的五项（`tab/q/row/sort/dir`）——深链不改写任何筛选。
- ② `?row=tools=<不存在>`：`cap-row-missing` 在、title 逐字 `GAP-CAPROW-01`、文案含「该条目不在当前列表里」与「把这个条目隐藏了」；`cap-row-missing-clear` 的 href 是 `listHref`（删 `row` 与 `q`，保留 `tab=tools`）；URL 未被静默改写（逐字节等于粘贴串）；零详情面板、零行、`tl3-no-match` 在。`capF` 锚仍在且同值：`capF-state-filter-empty` 可见（class 含 `capF-state-text`、不含 `sr-only`），其 textContent 与 title 逐字等于单点 `stateAnchor({kind:"filter-empty",subject:"工具与 MCP 清单",reason,loaded})` 的 `lead+detail` 与 `title`。
- ③ 换深链只动 `row`：点第一行 `cap-row-link` 再点第二行，每次都 `details()===1`、`row === tools:<该行名>`、键集恒为 `[dir,q,row,sort,tab]`，而 `tab/q/sort/dir` 四项逐字与点击前相同；两次点击都不产生新读取。
- ④ 刷新复原：同 URL 直接重挂（不重置 spy）后 `cap8-location` 逐字相同、行序与行名数组 `toEqual` 刷新前、详情仍恰 1，读取计数不变（`cachedTools`/`cachedOpenTool` 生效）；随后点 `cap-row-close` 只删 `row`，`q/sort/dir` 原位保留。
- ⑤ 全程读口计数：首载 6 次；深链、换链、重挂、关闭各步之后计数仍是同一个数，没有任何一步为筛选或定位多发请求。
- 三处作者侧修正（均非产品缺陷）：`cap8-location` 文本自带前导 `?`，比较须写成 `"?" + new URLSearchParams(fields).toString()`；第二次挂载吃到 tools 缓存 ⇒ 先 `resetToolsTabState()`；`q()` 选择器需带泛型默认 `<T extends HTMLElement = HTMLElement>` 才能服务 `q<HTMLButtonElement>("cap-row-close")`。
- 验证：新文件 4/4；定向 `src/modules/{capabilities,skills,tools}` → **15 files / 147 passed**；全量 → **187 files / 2491 passed, 0 failed**（R90 基线 186/2487 + 本文件 1 file / 4 tests）；`tsc -b . --noEmit` exit 2，错误仅限 approvals / employee-detail / employees 基线文件，本域 0。既有 `ToolsPage.test.tsx`「row deep link」三条与 `capabilities.stateanchor` / `filterparity` / `rowparity` 全绿。
- 零破坏与三档：`cap*`（含 `cap4–capH`、`capC`、`capF`、`cap-page-scope`、gates）与 `sys*` 族无任何改动；本轮是纯测试，无 markup / CSS 增量，故不重跑浏览器 harness —— 几何证据沿用 R89 的 1440/1280/375 三档实测（同一批渲染产物未被触碰）。
- 边界：仅新增该测试文件 + 本节 DONE；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops；未 install、未并 main、未重建 9122；无 force / amend / `--no-verify`。

## R92 / sys-row-copy — /system 运行健康表行复制（单 helper）

- 基线：显式 refspec fetch（`9014f6ba..bbb13340`，wave-32）+ `git merge --no-ff origin/lane/hermes-console` → 合并笔 `a63e16af`；未用 reset。上游增量落在 audit / employees / knowledge / metrics，`web/src/modules/health` 零重叠。
- 单点措辞：新增 `health/rowCopy.ts` 的 `sysRowCopyText(row)` = `表名 · 读数 · 数据时刻 · 状态人话`。表名缺时回落口径 key（与搜索框同口径，不造名）；读数取屏上原字符串，真 0 保留「0 ms」，只有缺失才「—」；数据时刻取该行 `checkedAt`（上游顶层 ISO 经既有 `readTopAsOf` 转北京时分），**绝不取 `sys-updated-at`**；状态取映射后的 `Sys3State` 人话。按钮与兜底 textarea 同读这一个返回值。
- 挂载：`sys3-table` 加第六列（thead `<th className="sys-row-copy-head">复制</th>`，详情行 `colSpan` 5→6）；每行末 `<button type="button" data-testid="sys-row-copy-<i>" aria-label="复制<表名>这一行">复制该行</button>`，`onClick` 与 `onKeyDown`(Enter/Space) 双双 `stopPropagation` —— 行本身在这两个事件上展开详情，复制不得顺带开关。`<i>` 是**当前渲染序**下标，故状态筛选后重新编号（用例覆盖）。
- 反馈位：表体滚动容器之后一个共享块 `.sys-row-copy-result[data-row-index]`，内含 `sys-row-copy-status`（`role=status` + `aria-live=polite`，成功「已复制」/失败「复制失败，已展开可手动选择的文本」）与失败时的只读 `sys-row-copy-fallback-text`（value 逐字同 `sysRowCopyText`）。整表只有一个播报节点，一次点击只播一次；再点别的行替换而非叠加。
- CSS：`health.css` 列宽改 20/10/24/18/14/14%，新增 `.sys-row-copy-cell/-sys-row-copy/.sys-row-copy-result/.sys-row-copy-status/.sys-row-copy-fallback`，按钮 focus-visible 用既有 ring 习语，文本类一律 `overflow-wrap:anywhere`。
- 测试：新增 `health/system.rowcopy.test.tsx` 5 例 —— 三行逐字（含无名回落 key、缺耗时「—」、真 0 显示 `0 ms`）+ aria-label/type=button/零请求 + 点按钮不展开详情；无顶层时刻时复制为「—」且注入 2031 假时钟不出现 2031；刷新态下（2030 假时钟）busy 期 `sys-updated-at` 为 null、复制仍是数据时刻且与刷新戳互不覆盖，`sysRowCopyText(readSystemHealth(...))` 与屏上复制逐字相等；剪贴板拒 → fallback 只读同文，随后成功点击整块替换；状态筛选后编号自洽。
- DOM 三档（临时 harness，已删）：1440 / 1280 / 375 均 `body.scrollWidth == body.clientWidth`（375 时为 364，视差来自滚动条，无横溢）；`thCount=6`、3 个 BUTTON:type=button、aria-label 三条逐字；`.focus()` 后 `document.activeElement` 即按钮，outline 3px；点击 0/2 号 → 状态「已复制」role=status/live=polite，`copied` 分别为「控制台服务(BFF) · 12 ms · 2026-11-19 23:17 · 正常」「legacy-svc · — · 2026-11-19 23:17 · 不可达」，`details=0`（未顺带展开），请求数 4→4；点 `sys-refresh` 后 `sys-updated-at`「刷新完成于 2026-11-20 18:24（读取时刻，不是数据时刻）」而行内数据时刻仍「2026-11-19 23:17」，请求 4→8（刷新批次），复制零增量。375 档表格 680px 落在 `.sys3-scroll` 内自滚（既有契约，页脚已有「左右滑动查看全部列」提示），body 不溢出。浏览器侧剪贴板成功，拒答兜底分支由 jsdom 用例覆盖。
- 验证：新文件 5/5；定向 `src/modules/health` → **10 files / 79 passed**（原 9/74）；全量 → **191 files / 2516 passed, 0 failed**（合并上游 3 个新测试文件后基线 190/2511 + 本文件 1/5）；`tsc -b . --noEmit` exit 2，`modules/health` 命中 0，错误仅限 approvals / employee-detail / employees 基线。R112 `system.refresh.test.tsx` 4 例与 `sys*` / `sys-*asof*` / `sys4-detail-*` 断言全绿。
- 边界：仅 `web/src/modules/health/{rowCopy.ts,SystemHealthSurface.tsx,health.css,system.rowcopy.test.tsx}` + 本节 DONE；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops；未 install、未并 main、未重建 9122；无 force / amend / `--no-verify`。

## R93 / cap-row-copy-btn — /capabilities 工具行复制（单 helper）

- 基线：显式 refspec fetch + `git merge --no-ff origin/lane/hermes-console` → 合并章 `9ab1eb72`（上游 tip `133f2c16` = 代次 `d7965c2a`，纯账本章笔 + knowledge 测试），与 capabilities/skills/tools 零重叠；未用 reset。
- 现查纪律（先 grep 再动手）：`capRowCopyText` 不存在；`cap-row-copy`（无索引）已被行详情复制占用（`listCopy.tsx` 的 `CapabilityFieldCopy`）；`capF-row-<i>` 标记不存在（capF 只有状态锚）；「调用次数」在上游 skills/tools 行上都没有字段（计数只在 metrics 模块）。
- 实现：新 `capabilities/rowCopyText.ts` 单点措辞 `capRowCopyText(row)` = `名称：X · 类型：Y · 状态：Z · 调用次数：N|— · 短码：CODE`；`capShortCode` 折叠合成 id（`row-<n>`）与纯中文 id 为「—」，其余取字母数字前 8 位大写，禁裸内部 id。新 `rowCopyButton.tsx` 挂载原生 `<button type="button" data-testid="cap-row-copy-<i>">`（aria-label「复制<名称>这一行」，行容器 keydown 有 target 自检故无需 stopPropagation）；状态/兜底节点按 rowKey 匹配只在该行渲染，文案「已复制」/「复制失败，已展开手动复制」+ 只读 fallback 逐字同。skills 加第 6 列 th「复制」（空集不渲染列），tools 在两分区行尾挂载，mcp 行用全局序号 `toolRows.length + index` 与键盘导航同序。
- 诚实披露三处：①「调用次数」本面没有上游字段，行恒为「—」，helper 的真 0 分支只有单元测试覆盖（`调用次数：0`），页面不伪造；②派工单的 `capF-row-<i>` 不存在，i 的同序断言改对着真实标记 `skl4-row-<id>` / `tol5-row` 的 DOM 顺序；③`cap-row-copy-status/-fallback` 与行详情复制同名，两处可同屏共存（详情展开 + 行复制各一个节点），有专门共存用例守住，既有冻结测试只查无索引的 `cap-row-copy`，零碰撞。
- 既有用例唯一一处改动：`SkillsPage.test.tsx` 冻结表头数组加「复制」（新列是本轮特性本身，属同步更新非破坏）。
- 验证：新增单元 5 + 集成 7 全绿；定向三域 17 files / 159 passed；全量 **194 files / 2533 passed, 0 failed**；tsc exit 2 仅 approvals/employee-detail/employees 基线，本域 0。R117 深链用例、capF/cap4–capH/capC/sys* 全绿。
- DOM 三档（临时 harness，已删）：1440/1280/375 × skills/tools 六组，`body.scrollWidth==clientWidth`（375 tools 364/364 为滚动条宽）；按钮 2/2 均为 BUTTON:type=button，aria-label 逐字「复制资料整理这一行」等，`.focus()` 后 activeElement 命中、outline 3px；点击后状态「已复制」role=status aria-live=polite，无 fallback，按钮/状态零溢出；请求数点击前后不变（skills 1→1，tools 4→4）。屏上复制串实测：skills `名称：资料整理 · 类型：平台内置 · 状态：正常 · 调用次数：— · 短码：SKALPHA4`；tools mcp 行 `短码：—`（纯中文服务名折叠，不露裸 id）。
- 边界：只动 `modules/{capabilities,skills,tools}/**` + DONE；未碰 App/shell/路由/注册表/package·lock/web-scripts/ops；未 install、未并 main、未重建 9122；禁 force/amend/--no-verify 未触。

## R94 / cap-empty-guards — /capabilities 筛选态与空态护栏（纯测试，R130）

- 基线：显式 refspec fetch + `git merge --no-ff origin/lane/hermes-console` → 合并提交 `36b7b23a`（上游 `76090480` = wave-34 代次；落点全在 approvals/knowledge 等，`git diff --name-only HEAD^1 HEAD -- web/src/modules/{capabilities,skills,tools}` 为空，零重叠）。禁 reset --hard 未用。
- 现查既有用例（先 grep 后写，只补缺口，不写重复用例）：① filterparity 已钉 skills no-match 的双钮 disabled + 同一 gates 原因句 + 剪贴板零调用；deeplink 已钉 tools「缺行 + q 同缺」的 URL 逐字不改写；SkillsPage/ToolsPage 各自的 no-match 用例已钉「没有匹配项」文案与清空钮存在。缺口＝skills 清空钮从未被点过、清空后 `cap-row-copy-*` 计数无人钉、tools 无 q 的缺行深链、skills 缺行的 URL 不改写、空态下「零请求」半边与 R128 索引钮缺席。
- 新文件 `web/src/modules/capabilities/capabilities.empty.test.tsx`（7 用例）：①skills no-match — `capF-state-filter-empty` 可见文本逐字等于 `stateAnchor`（lead+detail），锚文只报已加载 3 项、不含「0 项」，`cap5-scope-note`「仅在当前已加载 3 项内搜索」，清空钮在 + title「去处：清空搜索词恢复完整列表。」；②skills 空态 — `capC-copy`/`cap6-export` disabled、`cap-gates-copy`==`cap-gates-export`==「当前没有可导出的条目。」、`cap-row-copy-*` 零个，点两个禁用钮后剪贴板零调用且 reads() 恒 1；③skills 清空 — 点 `skl4-clear` 恢复 3 行 3 钮、URL q 消失、零重取，复制钮出 LINE_0；④tools 空态 — 同 ② 形状（reads 恒 6）；⑤tools 清空 — 点 `tl3-clear` 恢复 2 行 2 钮、零重取；⑥tools 无 q 缺行深链 — `cap-row-missing` 文案「当前清单里没有这个条目；它可能已被删除或改名。」+ title `GAP-CAPROW-01`、零详情面板、全列表 2 行保留、URL 逐字 == 粘贴参数；⑦skills 缺行深链 — 同 ⑥ 的 URL 逐字不改写（既有 SkillsPage 用例只钉了文案没钉 URL）。
- 两处按实际行为落地并披露：派工单说的「换个关键词」类提示不存在——可读出口实际是清空钮 + 锚 title「去处：清空搜索词恢复完整列表。」，按实际断言；「capF 四态不计入 0 行」实现为锚文只报已加载数、不含「0 项」（`cap-page-scope` 的「共 0 项」是筛后真实 0，属既有诚实口径，不动）。
- 首跑 5 败均为自造：settle 条件没认 no-match 面（skills 加 `skl4-no-match`、tools 加 `tl3-no-match` 后全绿）；零产品码改动。
- 验证：新文件 7/7；定向 `src/modules/{capabilities,skills,tools}` 18 files / 166 passed；全量 `npx vitest run` **198 files / 2555 passed, 0 failed**；`tsc -b . --noEmit` exit 2，本域 grep 0（基线仅 approvals/employee-detail/employees）。`capF`/`cap-row-copy-*`/`cap-row-*`/stateAnchor/R117 深链既有断言全绿。
- 三档未重跑：纯测试、零 markup/CSS delta，几何证据沿用 R93 实测（同 ① 纪律披露）。
- 边界：只加 `capabilities.empty.test.tsx` + 本节 DONE；未碰 App/shell/routes/registry/package·lock/web-scripts/ops；未 install、未并 main、未 force/amend/--no-verify。

## R95 / sys-filters-url-guards — /system 标签与时间窗 URL 保参护栏（R135，纯测试）

- 基线：显式 refspec fetch 后 `git merge --no-ff origin/lane/hermes-console` → 合并笔 `1456d150`（上游 `6e6ebf32` = 代次 `76090480` 纯账本章笔，150 files 全在 `docs/_artifacts/tonight/**`；`git diff --name-only HEAD^1 HEAD -- web/src/modules/health` 为空）。未 reset --hard，工作树开工前干净。
- 现查既有覆盖（先 grep 纪律）：`modules/audit/AuditEventsModulePage.test.tsx` 已钉住 window 的 URL 快照（:266 `/audit?window=7d`、:1155-1190 `window=24h`/`window=24h&type=task.created`）、custom 的 from/to 复原（:870、:1754）、R39 记录即历史项（:1000-1030）、五参深链（:1197、:1213、:1432）、切 custom 后 location 保 window（:1730-1741）、参数字典快照（:1679）；`src/shell/console.test.tsx` 已钉 TAB_ALIAS 落正典 pane 与 `?state=` 四态，但**没有任何非法 `?tab=` 用例**。故本文件只补四个缺口，不重写既有断言。
- ①请求参逐字：冻结时钟 `NOW=2026-11-20T06:00:00Z` 挂 `/system?tab=events&window=24h`，屏上 `aria-pressed` 落在 24h，恰 1 条列表读，其 `from/to` 逐字等于 `windowBounds("24h", NOW)`，location 与粘贴地址字节同，页锚 `agent-v2-page-audit` 在。既有测试只查 URL，没查「请求 vs 屏上」同源。
- ②写 window 保 tab 且不新增历史：双 entry 挂载后点 7d，参数字典恰 `{tab:"events", window:"7d"}`，末条读等于 `windowBounds("7d", NOW)`；点 `probe-back` 直接退回 `/system?tab=events`（window 消失）——证明该写是 `replace`。产品事实：只有开记录（`:1025`）用 `replace:false` 推历史，其余 15 处筛选写全带 `replace:true`。首稿误按 R39 推历史断言，已按产品改判并在用例注释留痕。
- ②b 切 tab 保 window：挂 `ConsoleModulePage module="system"`（无 live，pane 出占位）于 `/system?tab=health&window=24h`，点 `[role="tab"][data-tab="events"]` 后 tab=events 而 window=24h 字节不动（shell `preserve` memo 只剥 tab/view/zone）。
- ③非法枚举：`resolveTab("system","__nope__")` → `{tab:"__nope__",view:""}`，页面 `active = tabs.find(...) ?? tabs[0]` 落第一格「系统健康」且 URL 一字不改；`?window=__nope__` 经 `filterWindowOf` 静默回落 `DEFAULT_WINDOW="7d"`，屏上 pressed=7d、读用 7d 边界，而地址里的 `window=__nope__` 原样保留（页面只读不写该参）。
- ④重挂同 URL：同 entry 二次挂载（不重置 spy）后新增的读序列与首次逐字相等、条数与顺序一致 ⇒ 无重复取数、无参数漂移。
- 披露三条：其一，派工单指定路径在 `modules/health/`，但该面机制实际住在 `modules/audit/AuditEventsModulePage` + shell（health 模块无事件表、无 window 参），故本文件跨模块 import 并按单据落在 health 目录；其二，单据点名的 `sys-evt-copy-*` 本代不存在（R124 放弃：health 无事件表），无从破起，如实记录；其三，三档未跑——纯测试、零 markup/CSS delta，几何证据沿用 R93 实测。
- 附带修复：本文件 `waitFor` 原用 `Date.now()` 做 3000 ms 截止，而 ①②③b④ 冻结 `Date` → 截止永不触发，用例② 空转到 vitest 15 s 强杀并污染后续用例（③/③b/④ 全空白）。改为 600 次 × 5 ms 真实 sleep 的迭代上限，与冻结时钟免疫；隔离跑证实四例各自本可通过，级联是超时副作用。零产品码改动。
- 验证：新文件 6/6；定向 `src/modules/health src/modules/audit src/shell` **40 files / 584 passed**（`sys-refresh`/`sys-updated-at`/`sys-row-copy-*`/R112 与既有 audit、shell 用例全绿）；全量 `npx vitest run` **199 files / 2561 passed, 0 failed**（基线 198/2555 → +1 file / +6 tests）；`tsc -b . --noEmit` exit 2，health/audit/shell grep **0**，错误仅限 approvals / employee-detail / employees 基线。
- 边界：只加 `web/src/modules/health/system.filters.test.tsx` + 本节 DONE；未碰 App.tsx/shell/routes/registry/package·lock/web-scripts/ops（shell 与 audit 源码只读、只在测试里挂载）；未 install、未并 main、未 force/amend/--no-verify。

## R96 / cap-count-parity — /capabilities 计数与筛选后行数三值同源护栏（纯测试）

- 基线：显式 refspec fetch + `git merge --no-ff origin/lane/hermes-console` → 合并笔 `88dd4f1b`，上游 tip `862154eb`（派工单点名 `18ec9cfb`，已核为 HEAD 祖先，随 tip 一并并入）。上游 delta 落在 approvals/audit/employees/knowledge/metrics/runs 与 tonight 证据，`git diff --name-only HEAD^1 HEAD -- web/src/modules/{capabilities,skills,tools}` 为空——本写域零重叠。
- 现查既有用例（派工纪律）：R128 `rowcopybtn` 已钉 q 筛选后按钮与表体同序、空集零按钮；R130 `empty` 已钉无匹配锚逐字、双闸禁用共因句、清空恢复行数与按钮、深链不改 URL；R88 `filterparity` 已钉 `cap-page-scope` N 三方锁步与「0 条」/「—」分支；R87 `rowparity` 已钉 scope==表体==导出。缺口 = `cap4-count-*` 数值进入同一等式、工具侧分区计数、真实 0 的空集计数断言——本轮只补这三处，零重复用例。
- 三处陈旧前提如实更正：① `capF` 没有计数面（`capF-*` 全是状态锚家族），计数面实名 `cap4-count-skills`/`cap4-count-tools`（值位 `—`/数字，状态位 未取数/加载中/有源/有源（空）/无源）；② capabilities 无类型筛选，只有名称 `cap5-search`，「按类型筛选」按 `?q=` 实现；③ 无子表下钻，唯一下钻是行展开 `cap7-detail-tools`，「返回上层复原」实现为展开/收起往返后全部数值逐字还原。
- 关键语义（现查非假设）：`publishCapabilityCount` 发布的 value 是 **visibleRows.length**——计数跟随筛选后可见行，不跟已加载行；故 `?q=报` 下 `cap4-count-skills`「2」而 `cap5-scope-note`「仅在当前已加载 3 项内搜索」，两者并存是口径不是矛盾。
- 用例四例（`capabilities.counts.test.tsx`）：①未筛 技能3==表体3==按钮3==scope 3，未访问 tab 保持「—/未取数」，点击零新请求；②`?q=报` 三者同步到 2 且 ≠3；工具 5==5==5==5 再按首名前两字筛，三者等于筛后数；③分区「工具与工具集：3 条」==`tol5-list` 内行数、MCP 卡文案含「MCP 连接：2 个」、分区和==表体==`cap4`==按钮==scope，展开/收起往返后六值逐字还原；④筛空与真空两条路径同口径：行数 0、按钮 0、`cap4`「0」+「有源（空）」、`cap6-export-count`「0 条」、双闸 disabled 共因句「当前没有可导出的条目。」，点击不触剪贴板、reads 不变。
- 坑（本轮实测）：`[data-testid^='cap-row-copy-']` 前缀选择器会同时命中行详情复制组件的 `cap-row-copy-status` 节点（展开一行后计数 6≠5）——按行复制按钮计数必须 `button[data-testid^='cap-row-copy-']'` 限定标签；同一文件二次挂载 skills 会吃模块缓存（`cachedSkillsState`），要验真实空 payload 必须先 `resetSkillsTabState()`。
- 验证：新文件 4/4；定向三域 **19 files / 170 passed**；全量 **208 files / 2622 passed, 0 failed**（上游并笔抬基线）；`tsc -b . --noEmit` exit 2，本域 grep 0，错误仅限 approvals / employee-detail / employees 基线。零产品码改动。
- 三档 N/A：纯测试、零 markup/CSS 增量，几何证据沿用 R93 实测（先例 R91/R94/R95）。
- 边界：只新增 `web/src/modules/capabilities/capabilities.counts.test.tsx` 与本节；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops；未 install、未并 main、未 force/amend/--no-verify。

## R97 / sys-state-isolation — /system 四态与读源失败不互相污染护栏（task @558@ / R145）

- 基线：显式 refspec fetch 后上游 tip 仍是 `862154eb`（与派工单所指一致），`git merge --no-ff origin/lane/hermes-console` 报 Already up to date —— 该代次已由 R140 基线 `88dd4f1b` 带入；起点 HEAD `1a805d13`，工作树 0 脏。未用 reset。
- 现查既有用例：`system.refresh.test.tsx`（R112）四例已锁「读时刻≠数据时刻」「刷新失败保留旧批 + 不写 `sys-updated-at` + 错误态带 rid 与重试」「busy 连点只发一批（`sys-busy-note` 计数 1、按钮 `.disabled`）」「单探针失败只坏该探针面」；`SystemHealthSurface.test.tsx` 已锁 `sys-state-*` 面板自身（error 带 `sys-state-rid`/`-rid-copy`/`-retry`，denied 无重试，empty / empty-filter 带清除）。本文件只补四处缺口。
- 缺口 a（文案不变）：按 testid 快照三张表每一行的整段 textContent，失败前后逐行比对 —— R112 只比行数与采集时刻。①例中断言「只有 `hlt5-row-runtime` 与 `sys6-row-runtime` 两行变动」，其余全部逐字相同。
- 缺口 b（rid 不外渗）：失败请求编号只出现在它自己的面上；①例逐行断言兄弟行不含「请求编号」也不含该 rid，②例逐行断言没有任何数据行吞下列表读的 `req-list-500`（该 rid 只在 `sys-refresh-error` / `sys-refresh-request-id` 里）。
- 缺口 c（busy 期零污染）：连点后除计数外，还断言无 `sys-refresh-error`、无 `sys-updated-at`、无 `sys-state-state`，且整张快照 `toEqual` 刷新前（一行一字节都没动），释放后 `sys-updated-at` 恰好 1 个、`sys-busy-note` 消失。
- 缺口 d（恢复即换代）：R112 的重试复用同一份 payload，换代从未被证明。④例用三份数据（2 源 → 探针 500 → 3 源）断言 `sys3-row-*` 变成 a/b/c 三行、`sys3-asof` 落到新时刻、原错误行不再含「异常」与短 rid、`sys6-asof-runtime` 恢复「2026-11-19 10:45」、`sys6-row-runtime` 回到 ok，四读口计数各 3 次。
- 坑（首轮 2 例因此失败，非产品缺陷）：耗时列是每次读取用 `performance.now()` 实测的，整行 textContent 快照会被 1 ms→0 ms 抖动打穿（首轮 `sys6-row-console/health/domain` 全被判为「漂移」）。快照把 `\d+ ms` 折成 `<n> ms`，比对只针对名称/状态/端点/数据时刻。
- 如实披露：①派工单零破清单里的 `sys-evt-copy-*` 本代不存在（R124 放弃：health 模块无事件表），无从破起；②`sys-state-*` 确实存在（`SystemStatePanel.tsx`），本例只断言它**不**因单探针失败而出现——这正是不互相污染的判据；③①的「含 rid」按既有口径断言为 8 位短码（`"req-isolate-500".slice(0,8)`），与 R112 一致，不另造口径。
- 验证：新文件 4/4；`npx vitest run src/modules/health` → 12 files / 89 passed（原 11/85）；`./node_modules/.bin/tsc -b . --noEmit` exit 2，`modules/health` grep 0，错误仅限 approvals / employee-detail / employees 基线；全量 `npx vitest run` → **209 files / 2626 passed, 0 failed**（原 208/2622，+1 文件 +4 例），已知上游 flake 本轮未复现。
- 三档 N/A：纯测试，零 markup/CSS 改动，几何证据沿 R93（1440/1280/375 无横溢）。
- 边界：只新增 `web/src/modules/health/system.state.isolation.test.tsx` 与本节；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops，未改任何产品码，未 install，未并 main，未 force / amend / --no-verify。

## R98 / sys-matrix-anchor-guards — /system 读源矩阵与四态锚一致性护栏（纯测试，@580@）

- 基线：显式 refspec fetch 后 `git merge --no-ff origin/lane/hermes-console` → 合并笔 `65b3bad3`；上游 tip 正是派工单点名的 `c37e6d49`（wave-36 代次）。`git diff --name-only HEAD^1 HEAD -- web/src/modules/health` 为空——上游改动与本域零重叠。零产品码改动。
- 现查既有用例（先 grep 纪律）：`SourceMatrix.test.tsx` :120/:136 已钉矩阵 health/domain 采集时刻、:129-133 已钉失败行状态词与 `sys6-rid-runtime` 存在性、:140 已钉 `sys8-asof-health`==`sys3-checked`、:215-221 已钉缺时刻的「—」+判据 title；R112 `system.refresh.test.tsx` :76-77/:165/:168/:237 已钉 `sys-updated-at` 不等于任何数据时刻、失败回退与重试恢复；R145 :153/:190-220/:286/:301 已钉单探针失败只坏自身、兄弟行逐字不变。本轮只补四个真空隙：①矩阵↔页级锚的跨面等值（`sys6-asof-health`==`sys3-asof`、`sys6-asof-<探针>`==`hlt5-asof-<探针>`）并与 ≠`sys-updated-at` 合成一条判据；②单表失败时 `sys6-summary` 的精确整句（「4 个读口 · 成功 3 · 失败 1 · 读口未接入 0」）与兄弟行状态属性；③失败行的可见可读句 + rid 完整值只在 title + 复制按钮点击写入的是完整 rid（非 8 位短码）+ 时刻「—」带原因 title 且不含任何日期形态（禁伪造）+ 耗时是实测值不是 0；④恢复后写入**新**时刻（13:05≠10:45）且兄弟行逐字不动、rid 节点消失。
- 如实披露：派工单 ③ 要求的「可复制 rid」在产品上**存在**（`SourceMatrix.tsx` :31-47 `CopyRid`，仅 `status==="failed" && requestId` 时挂载），无陈旧前提；但既有用例只钉存在性，未钉点击与完整值——本轮补的正是这两点。「不得写 0 或「—」冒充」按产品口径拆读：带原因 title 的「—」是被许可的诚实未知（R112 口径），冒充＝凭空造日期或 0，断言其不存在。`CopyRid` 用裸 `navigator.clipboard.writeText` 而非 `copyTextToClipboard` 助手，测试须 `Object.defineProperty(navigator,"clipboard",…)`。`sys6-summary` 恒拼出三类计数（含 0）；矩阵默认折叠，读行前点 `sys6-toggle`。
- 测试侧教训（记档）：`vi.mock` 工厂不参与类型检查——本地 mock 的 `ApiError` 构造在 tsc 下仍按真实签名校验，`body`/`url` 必须写全（4 处 TS2345 一次修掉）；rid 短码是 8 位不是 9 位（「req-isol」）。
- 验证：新文件 4/4；`npx vitest run src/modules/health` → 13 files / 93 passed（本任务前 12/89）；`./node_modules/.bin/tsc -b . --noEmit` exit 2，`modules/health` 命中 0，错误仅在 approvals / employee-detail / employees 基线。全量 `npx vitest run` → 216 files（214 passed / 2 failed）、2675 tests（2668 passed / 7 failed）：7 项失败全部落在上游新笔 `audit.filters.test.tsx`（4 项，断言读到空串——expected '' to be 'task.created'/'50'/'25'）与 `runs.filters.test.tsx`（3 项，两项 4787 ms 超时）；单独跑这两个文件（不加载本域任何测试）复现同样 7 败——**基线 `65b3bad3` 上的既有断裂，与本单无关**，属 aud/runs 车道，不在本域写域内修复。
- 三档 N/A：纯测试、零标记与样式改动；几何证据沿用 R93。零破：`sys6-*`/`sys8-*`/`sys15-*`/`sys3-*`/`hlt5-*`/`sys-refresh`/`sys-updated-at`/`sys-row-copy-*` 及 R112/R145 断言全绿。边界：仅新增 `web/src/modules/health/system.matrix.test.tsx` 与本节；未碰 App.tsx/shell/routes/registry/package·lock/web-scripts/ops；未 install、未并 main、未 force/amend/--no-verify。

## R99 / sys-retry-guards — /system 读源失败重试幂等（纯测试，R151）

- 基线：显式 refspec fetch 后 `git merge --no-ff origin/lane/hermes-console`，上游 tip 仍是 `c37e6d49`（与派工单一致），结果为 Already up to date —— 该代次已由 R148 的 `65b3bad3` 带入；起点 HEAD `0f52e90a`，`git status --porcelain` 0 行，未使用 reset。
- 现查既有用例（只补缺口，不写重复）：`SystemHealthSurface.test.tsx` :110-121 点过 `sys3-retry` 但只挂 surface、没有三条探针，所以「只重发这一个读口」从未被计量；:395-408 钉住错误面板的可读句与 `sys-state-rid` 存在性；:410-425 钉住 403/404 无重试。R112 `system.refresh.test.tsx` :179 与 R145 `system.state.isolation.test.tsx` :223 已钉「连点刷新只发一批」（协调器 `sys-refresh` 的 busy 门）。R145 :130 只钉探针行 8 位短码；R148 :232 钉矩阵 `CopyRid` 点击。`HealthPage.test.tsx` :133 点的是 `hlt5-retry`（整批）。
- 四个缺口（新文件 `web/src/modules/health/system.retry.test.tsx`，4 例全绿）：①探针行自带 rid 复制的是**完整** id（走裸 `navigator.clipboard.writeText`，不是 `copyTextToClipboard` 助手），且扰动范围只有一行；②`sys3-retry` 恰好 +1 次 `/agent-api/api/health`、三条探针计数不变，错误行与 rid 一并清空；③诚实结论——重试按钮没有 busy 门，真正的幂等来自面板撤回 + effect cleanup 使被取代的响应无法提交；④重试仍失败时错误被替换而非追加，且绝不写 `sys-updated-at`。
- 口径更正（必须先说清，派工单的字面前提与产品不符）：**本代不存在按探针的重试按钮**。`sys3-retry` 只重发健康清单这一个读口（`retry()` 在 `state.k === "error"|"gap"` 时不调 `onRetry`，只 `setReload(+1)`）；`hlt5-retry` 与 `sys-refresh-retry` 都调 `refresh.start()`，即三条探针 + 健康清单整批。因此「点重试恰 +1 次该读源请求」只在失败源是健康清单时成立，②按此实现；探针失败的「按源重试」是能力缺口，不是本单可改的产品项。`sys3-refresh` 在本页被 `hideRefresh` 收起，故 ③ 的 busy 半段只能借 `sys-refresh` 构造。`hasDataRef` 意味着一旦有过成功数据，后续健康读失败不再出现 `sys3-error` 面板（表格保留旧批），这也是 ③ 用「首次加载失败」场景的原因。
- ③ 的实现细节：第一次读失败（rid `req-first-500`）→ 点重试发出第二次（挂起）→ 期间点 `sys-refresh` 发出第三次 → 先回最新响应（2 行、`sys6-asof-health` 「2026-11-19 23:17」）→ 再回被取代的旧响应（3 行夹具）→ 行数与时刻一动不动，矩阵仍 4 行、摘要「4 个读口 · 成功 4 · 失败 0 · 读口未接入 0」、`sys6-rid-health` 为空、`sys-updated-at` 只带「（读取时刻，不是数据时刻）」且不含数据时刻。判据是 `live` 闭包标志，不是发送计数。
- 坑与自我修正：① 原先按「连点两次重试」写 ③，实际第二次点不到——按钮所在面板已随 `setState({k:"loading"})` 撤回，报错来自本文件 helper；② `vi.mock` 工厂不参与类型检查，本地 mock 的 `ApiError` 仍按真实签名校验，构造参数必须带 `body`/`url`；③ 删掉未使用的 `listFail` 助手（TS6133）；④ 行快照必须折叠 `\d+ ms`，否则耗时列的 1 ms 抖动污染「其余行一字不动」的断言；⑤ `readsByKey()` 要跳过 Vitest teardown 的无参调用。
- 验证：新文件 4/4；`npx vitest run src/modules/health` → **14 files / 97 passed**（任务前 13/93）；`./node_modules/.bin/tsc -b . --noEmit` → exit 2，`modules/health` 命中 **0**，错误仅在 approvals / employee-detail / employees（基线）；全量 `npx vitest run` → **217 files（215 passed / 2 failed）、2679 tests（2672 passed / 7 failed）**，7 条失败全部落在上游新文件 `src/modules/audit/audit.filters.test.tsx`（4）与 `src/modules/runs/runs.filters.test.tsx`（3），在基线 `65b3bad3` 上即已存在，与本轮无关（R148 已用单独跑这两文件的方式证明独立性）。
- 三档：纯测试，零 DOM/CSS 改动，几何证据沿用 R93 实测，本轮未重跑 harness。
- 边界：只加 `web/src/modules/health/system.retry.test.tsx` 与本节；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops，未改任何产品码；未 install、未并 main、未重建 9122；禁 force / amend / --no-verify。

## R100 / sys-matrix-copy-parity — /system 读源矩阵复制与四态同源（纯测试，R159）

- 基线：起始 HEAD `703af36d`，0 dirty。显式 refspec SSH fetch：上游 `c37e6d49..1bc3a760`（正是派工单点名的 wave-37 代次）。`git merge --no-ff origin/lane/hermes-console` → 合并提交 `ea3be65e`，落地 `web/src/modules/runs/runs.requests.test.tsx` 与 `web/src/shell/SessionExpiredBanner.{tsx,test.tsx}`、`StatePlaceholder.{tsx,test.tsx}`；`git diff --name-only HEAD^1 HEAD -- web/src/modules/health` 为空，写域零重叠。未用 reset。
- 现查既有用例（派工单要求的预检）：`SourceMatrix.test.tsx` :157-189 与 :443-473 只钉两种格式的表头/行数/首列顺序，:273 与 :503-525 只比首列；:129-133 钉失败行状态人话与 `sys6-rid-runtime` 短码存在性；:400-413 钉全失败时 `sys7-export`/`sys10-copy` 的 disabled 与标题，未覆盖 `sys-matrix-copy`。R112 :104-123 钉 `sys-updated-at` ≠ 每个采集时刻格，但没人断言「复制出去的文本不含刷新时刻」。R148 :248-251 钉 rid 复制按钮写全号；R151 :259/:270/:341/:374 钉各相位 `sys6-rid-health` 有无；R122/R92 的 `sys-row-copy-<i>` 属 sys3 服务表，另一个面。
- ① 逐格同源：新增 `system.matrix.copy.test.tsx`，对每一行把复制出的五格与屏上锚 `sys6-name-<id>` / `sys15-trunc-path-<id>`（回退 `sys6-path-<id>`）/ `sys15-trunc-status-<id>`（回退 `sys6-status-<id>`）/ `sys6-duration-<id>` / `sys8-asof-<id>` 逐字比对，竖线与制表符两种格式各一遍，并证两者拆开后完全相同；行序按索引对应，集合断言为 console/domain/health/runtime（矩阵默认序非 SOURCE_DEFS 声明序）。
- ② 口径更正（如实记录）：派工单写「失败行复制的状态句带 rid 而屏上不显裸 id」，与产品相反——复制出去的状态格只有人话「失败」，rid 从不离开屏幕：全号只在 `sys6-rid-runtime` 的 title 里，屏上文本是 8 位短码。按产品实际断言：两种复制串均不含 `req-runtime-500`、「upstream failed」、「请求编号」，原因句 `sys15-trunc-reason-runtime` 亦不随行外泄；`sys6-rid-console`/`sys6-rid-health` 不存在（rid 仅挂 failed 行）。
- ③ 复制文本排除刷新时刻：冻结时钟 2031-03-01 后点 `sys-refresh`，`sys-updated-at` 含「（读取时刻，不是数据时刻）」与「2031」；两种复制串均不含「2031」/「刷新完成于」/该串本体；每个 `sys8-asof-*` 仍逐字等于其复制格，health「2026-11-19 23:17」与 domain「2026-11-20 06:15」原位不动。
- ④ 未接线 / 空集 / 整表阻塞：unwired 行复制为「读口未接入」+ 采集时刻「—」+ 真实测量耗时 `/^\d+ ms$/`，两种串均不匹配 `undefined|null|NaN|\[object` 也不出现「0 项」；`?q=zzz-none` 时 `sys10-copy` 与 `sys-matrix-copy` 均 disabled、标题含阻塞句与 `COPY_SCOPE_TEXT`、点击零写入、无 fallback、状态位仍空、`sys7-export-count`「—」、请求数不动——如实发现：`usableRows` 由 `searchedRows` 派生，筛空即同时触发 `matrixBlocked`，产品说的是「没有可用读口行」而非搜索专属句；全失败腿补钉 `sys-matrix-copy` 的 disabled 与同一句标题，`sys6-summary`「4 个读口 · 成功 0 · 失败 4 · 读口未接入 0」，rid 只在 title。
- 测试侧修正（零产品码改动）：(a) 行序不可硬编码，改按索引对应 + 排序集合；(b) `lines()` 返回类型必须是 `string[][]`，否则 tsc 报 TS2322/TS2339 两处；(c) 误把 `.toContain` 当字符串方法用（`expect(s.toContain(x)).toBe(true)`）→ 改回 matcher。
- 验证：新文件 6/6；`npx vitest run src/modules/health` → 15 files / 103 passed（任务前 14/97）；`./node_modules/.bin/tsc -b . --noEmit` exit 2，`grep -c modules/health` = 0，报错仅 approvals / employee-detail / employees；全量 `npx vitest run` → 228 files / 2751 tests，227 files 通过 / 1 失败、2747 通过 / 4 失败，4 条全在上游 `src/modules/audit/audit.filters.test.tsx`；单独跑该文件（本文件不加载）同样 4 failed / 5 passed，独立性成立——属 aud 车道，本代基线 `ea3be65e` 上已红的既有问题；另如实记录：R148/R151 期间挂账的 `runs.filters` 3 条红在本基线已不复现。
- 三档：纯测试、零 markup/CSS 增量，几何证据沿用 R93 实测，未重跑 harness。
- 边界：只新增 `web/src/modules/health/system.matrix.copy.test.tsx` 与本节；未碰 App.tsx / shell（上游本代新增的 `SessionExpiredBanner*`、`StatePlaceholder*` 仅被合并带入，未修改）/ routes / registry / package·lock / web-scripts / ops；无产品码改动；无 install、未并 main、未重建 9122；禁 force / amend / --no-verify。

## R101 / sys-time-triple-parity — /system 采集时刻三处同源（纯测试，R171）

- 基线：显式 refspec SSH fetch（`git@github.com:bigolokevin-bit/hermes-agent.git lane/hermes-console:refs/remotes/origin/lane/hermes-console`）后上游仍是 `d6dac47f`，正是派工单点名的章笔（代次 `1bc3a760`）；`git merge --no-ff origin/lane/hermes-console` → Already up to date，未产生新 merge 提交，起点即 `2b419478`。该章提交只动 `docs/_artifacts/tonight/**`，`git diff --name-only HEAD^1 HEAD -- web/src` 为空 ⇒ 全仓零源码增量。未用 reset。开工前 `git status --porcelain` 计数 0。
- R163 取代关系：`web/src/modules/health/system.event.anchor.test.tsx` 自 20:41 派工起零落盘（文件不存在，已 `ls` 核），本单取代它；因此本次推送前没有需要先推的 R163 产物，remote 上一笔仍是 R159 的交付。
- 先 `git grep` 现查（派工纪律）与既有覆盖：`sys-evt` / 「事件」 在 health 只命中两条记账注释（`system.filters.test.tsx:5-14`、`system.state.isolation.test.tsx:18`）；health 源文件里所有 `window` 命中都是 `window.location` / `addEventListener` / `setTimeout`，无 `?window=` 读取。`sys15-full-asof` 仅在 `SourceMatrix.tsx:361`；`sys3-checked` 仅在 `SystemHealthSurface.tsx:567`，既有钉法是 `SourceMatrix.test.tsx:139`（toBe 「2026-11-19 23:17」）与 `:140`（`sys8-asof-health` === `sys3-checked`）、`:216`（「—」）。`readSystemHealth(body)`（`systemHealth.ts:166-217`）在 `:194-195` 把 `checkedAt: asOf` / `checkedReason: asOfReason` 逐行赋成 payload 顶层同一枚时间戳 ⇒ 天然同源，可作断言依据。已覆盖只回证据不重写：R112 `system.refresh.test.tsx:104-123`（刷新时刻 ≠ 每一枚 asof，含矩阵）、R100 `system.matrix.copy.test.tsx` 例③（2031 假时钟下复制文本不含刷新时刻）、R98 `system.matrix.test.tsx:186-187` 与 :168-199（跨面 `sys6-asof-health`==`sys3-asof`、`sys6-asof-<probe>`==`hlt5-asof-<probe>`）、R159 例①（五个复制格 vs DOM 锚）、R92 `system.rowcopy.test.tsx`。
- 两处陈旧前提（第七/八车道再次如实记录，未编造面）：① 派工单要的「事件表时间列」在 health 不存在（无事件表，`sys-evt-copy-*` 缺席，R124 放弃、R145/R148/R155/R163 五次复核）⇒ ①的第二腿改按真实面闭合：矩阵格 `sys6-asof-<id>`/内层 `sys8-asof-<id>`、展开全文 `sys15-full-asof-<id>`、两种复制列第五列（pipe `sys10-copy` / tab `sys-matrix-copy`）、汇总 `sys3-asof`、逐行 `sys3-checked`、探针 `hlt5-asof-<id>`、R92 `sys-row-copy-<i>` 第三段。④ 派工单要的「切时间窗」在 health 不存在（`?window=` 只被 `modules/audit/AuditEventsModulePage` 读取，R135 定论）⇒ ④ 如实实现为「换代零残留」：同一 URL 重挂 + 刷新换代，断言新代全覆盖、上代读数在表体与两份复制文本与行复制里一律不残留。
- 真正补上的缺口（此前无人钉过）：(a) `sys15-full-asof-*` 从未与兄弟面对齐；(b) `sys-row-copy-<i>` 第三段从未与任何屏上面值对齐；(c) 「所有时间面共用一种显示口径」无人断言；(d) 「换代不留上代残值」无人断言。
- 单口径实测结论：ISO 原文只活在 title（`UTC 原文：… · 北京时间：…`），表体与复制文本一律是 `YYYY-MM-DD HH:mm`；数据时刻与读取时刻共用同一形状，靠「（读取时刻，不是数据时刻）」后缀区分——所以 ③ 的「禁一处中文一处 ISO」实现为逐格正则 + 禁词表（`T`/`Z`/`+08:00`/`UTC`/`北京时间`/`上午`/`下午`）+ 表体不得出现 ISO 原文，且刷新戳捕获到的分钟同样过正则。
- 测试侧修正（零产品码改动，逐条如实）：(1) 首跑 1 通过 / 3 失败，三条同为 `missing node [data-testid='hlt5-asof-health']` —— `hlt5-asof-*` 只存在于 console/runtime/domain 三个探针面，health 是 `sys3-*` 服务面、没有探针行；新增 `PROBE_IDS` 并让 `screenFaces()` 与例④ 的循环按各自面集走，头注记之。(2) 二跑 3 通过 / 1 失败：例④ `toHaveLength(8)` 收到 4，因为 `arm()` 内的 `mockReset()` 抹掉了首载四笔；新增只换实现不清历史的 `rearm()`，④ 改用它并留注释。(3) 给 ④ 补正向非空洞守卫：换代前先断言 `tableSurfaces()` 逐 id 真的含上代读数，否则「零残留」是空断言。(4) `tableSurfaces()` 只取 `sys3-table` + `hlt5-list` + `sys6-table` 三面文本，刻意排除页尾口径块（那里的历史值是散文，不是残留缺陷）。
- 夹具口径：四个读口各给**互不相同**的顶层 asOf（health `2026-11-19T15:17:09Z`→23:17、console `…T01:30:00Z`→09:30、runtime `…T02:45:00Z`→10:45、domain `…T04:15:00Z`→12:15；二代 20 日 08:05 / 11:10 / 12:20 / 13:25），使「逐字相同」与「不残留」都可判定；假时钟用 `vi.useFakeTimers({now:new Date("2031-03-01T00:00:00Z"), toFake:["Date"]})`，`setTimeout` 保持真实，故 `waitFor` 必须用迭代上界（600 × 5 ms）而非 `Date.now()` 截止（R135 已记的坑，本文件沿用）。矩阵默认折叠 ⇒ 先点 `sys6-toggle`；`openRow` 是单值态 ⇒ 展开全文逐 id 开读。
- 验证：新文件 4/4；`npx vitest run src/modules/health` → **16 files / 107 passed**（任务前 15/103，+1 文件 +4 例）；`./node_modules/.bin/tsc -b . --noEmit` exit 2，`grep -c modules/health` = **0**，报错模块仅 approvals / employee-detail / employees（基线，不宣称 tsc 全绿）；全量 `npx vitest run` → 229 files / 2755 tests，**228 files 通过 / 1 失败、2751 通过 / 4 失败**，4 条全在上游 `src/modules/audit/audit.filters.test.tsx`（R133 的四例）；单独跑该文件（本文件不加载）同样 4 failed / 5 passed ⇒ 独立性成立，是本代基线 `2b419478` 上既有红，属 aud 车道，本写域不代修。`runs.filters` 的 3 条旧红仍未复现。
- 零破坏：`sys3-*`（含 `sys3-asof`/`sys3-checked`/`sys3-table`/`sys3-row-*`）、`sys4-detail-*`、`sys5-*`、`sys6/sys8/sys9/sys10/sys13/sys15-*` 与 `sys-matrix-copy*`、`sys7-export*`、`sys-search*`、`sys-notes`/`sys-note-*`、`sys-refresh*`/`sys-busy-note`/`sys-updated-at`、`sys-state-*`、`sys-row-copy-*`、`hlt5-*`、`ver5`、`cap*`、`skl4-*`、`tl3-*`/`tol5-*` 全绿（全量跑除上述 4 条上游红外零失败）。`sys-evt-copy-*` 本代不存在，无从破起，如实记录。
- 三档：纯测试、零 markup/CSS 增量，几何证据沿用 R93 实测，未重跑 harness。
- 边界：只新增 `web/src/modules/health/system.time.test.tsx` 与本节；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops；无产品码改动；无 install、未并 main、未重建 9122；禁 force / amend / --no-verify。

## R102 / channels-ce-attribution — `#/capabilities?tab=channels` 产品级 CE 归因（R173，零产品码）

- 基线：起始 HEAD `066ed1fa`（R171 交付），porcelain 0。显式 refspec SSH fetch → 上游 tip **恰好 `072f023d`**（派工单点名的 wave-38/39 代次）；`git merge --no-ff origin/lane/hermes-console -m "merge(console): sync channels ce baseline"` → 合并提交 `e4e25155`；未用 reset。`git diff --name-only HEAD^1 HEAD -- web/src/modules/{capabilities,channels,skills,tools}` → **空**，上游这一代没碰本单域。
- 结论（实测）：本代 served 产物（9122 入口 chunk `assets/index-k52YwKjs.js`，比台账记的 `index-DGa9lwCA.js`/`1bc3a760` 新一代）上，该路由 **auth 与 anon 的产品级 console error 都是 0**。四腿共 53 行 error 全是同一句 `Failed to load resource: the server responded with a status of 401 (Unauthorized)` @ `/auth/whoami`，按 `shots.mjs` 自己的 `ENV_NOISE_RE` 归 ENV（9122 是纯静态 python http.server，`/auth/whoami` 不是它的路由）。`pageerror` 四腿皆空；React key / undefined 读取 / 未捕获 promise 字样一条不出现。原始行数：auth 15（1440）+ 22（375）= 37；anon 8 + 8 = 16。
- 派工单前提不复现（如实记录，不采纳、不改口径）：「auth 29 / anon 66 product CE」与三份来源都对不上——本代实测（产品 0）、`crawl-auth.json`/`crawl-anon.json`（headHash `072f023d`，该路由 `consoleErrors: 8` 且 `consoleErrorEnv: "auth-required-401"` ⇒ 产品 0）、`shots-summary.json`/`shots-anon-summary.json`（headHash `1bc3a760`，`consoleErrorsObservedByShots: 0`、`consoleErrorRoutesObservedByShots: []`、`routesWithEnvOnlyConsoleErrors: 51`；`shots-index.md` 该路由末列 22/23 是原始行数）。29/66 在「原始/产品 × auth/anon」任一组合里都不出现。澄清前该路由不该继续占「全站第二大热点」位次。
- 归因链与口径细节：① `#/capabilities?tab=channels` 不是 capabilities 的 planned 占位——`App.tsx:179-183` lazy 导入 `@/modules/channels/ChannelsPage`，`:1225` 把它挂进 capabilities 的 live-slot 映射，`shell/console.tsx` `ConsolePane`(:345-364) 的 live 节点优先于 `PlannedBlock`；屏上主体「平台接入与数据源 / 正在读取平台接入与数据源…」（auth@1440）与「登录状态已经失效…请求编号： a5e2…／907e…」（anon 两视口）逐字出自 `modules/channels/{ChannelsPage.tsx:403,413, states.tsx:201, channels.ts:835-840, useChannelsData.ts:68}` ⇒ 任何该面缺陷都在频道道，不在本写域。② `grep -n 'console\.(error|warn)' web/src/modules/capabilities` → 无匹配，域内零 console 调用，所以「最小面修」无事可做。③ `ENV_NOISE_RE = /\b(401|404)\s*\((Unauthorized|Not Found)\)/` **只吞 401/404、不吞 403**，比派工单说的「已剔除 401/403/404 env」窄；本轮无 403 行故不影响结论，但这是 L0 该拍的口径项，本单不改脚本（禁令）。④ 真实观察到的缺口是 auth @375 主体只有 10 字符「⠋ Loading…」——4 s 稳定轮询内 lazy chunk 未 settle，与该路由既有台账的 `routesWithEmptyMain`/`routesWithoutMainEl` 一致；它是内容/时序问题、不是 console error，落点在 `modules/channels` + shell lazy 边界（双禁改面），只登记不上手。
- 取证方式：`shots.mjs` 全量腿跑不动——playwright 按绝对路径从兄弟检出加载（`PW_HOST=/Users/kevin_studio/Projects/seakoi-console-web/package.json`，1.65.1），本仓 lock 钉 1.64.0 且包不在 `node_modules`，禁 install；且它只留 `slice(0,160)` 样本、拿不到堆栈。改用同参数最小腿 `/private/var/folders/…/opencode/r173/ce-leg.mjs`（逐字沿用其 `CHROMIUM`/`ENV_NOISE_RE`/150 ms-4 s main 稳定轮询/hash 形导航 `BASE + '/' + #/<route>`/auth 走 `storageState` 不加强制旗标、anon 走 `addInitScript(window.__HERMES_AUTH_REQUIRED__=true)`；加宽的只有两点：console 文本不截断 + 附 `m.location()` 与 `pageerror` 前 6 帧）。auth state `/Users/kevin_studio/.local/state/sekoi-ops/v4-auth-state.json` 形态：顶层 `cookies`/`origins`，恰 1 条 cookie `access_token_cookie`（domain `127.0.0.1`、path `/`、httpOnly、value 长度 252），`origins` 空；值全程不回显。四腿 = 2 模式 × 2 视口，各全新 context。
- 前后计数：修后 == 修前（0/0，原始 37/16），因为本单零产品码改动；采纳 29/66 再「修」到某个数字等于伪造对照。
- 验证：无测试可跑（零代码改动）；`git diff --check` 干净；本报告与 DONE 是唯一增量（`docs/_artifacts/gov/**`）。
- 边界：只新增 `docs/_artifacts/gov/R173-channels-ce.md` 与本节；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops / `modules/channels/**`；未 install、未并 main、未重建 9122、未 force / amend / --no-verify；取证脚本与 raw JSON 在 /tmp 侧不入库。

## R103 / cap-drilldown-guards — /capabilities 工具集归属与下钻往返（纯测试，R184）

- 基线：显式 refspec SSH fetch → 上游 tip 正是派工单点名的 `c1b6ca7d`；`git merge --no-ff origin/lane/hermes-console -m "merge(console): sync drilldown baseline"` → 合并笔 **`9d72687c`**（172 files +568/−195，多为 `docs/_artifacts/tonight/shots/**` 证据 + 新 `employees.paging.test.tsx` / `knowledge.space.filters.test.tsx`）。`git diff --name-only HEAD^1 HEAD -- web/src/modules/{capabilities,skills,tools}` → **空**，与本单写域零重叠；未用 reset。
- 现查既有用例（只回证据与缺口，不写重复）：R140 `capabilities.counts.test.tsx` 例③ 已钉「两段计数 vs 实渲行 vs `cap4-count-tools` vs 复制钮 vs `cap-page-scope`，以及展开/收起往返」，但那是**无筛选无排序**下的往返；R91 `capabilities.deeplink.test.tsx` 例 1/2/4 已钉 `?row=tools:<存在>` 其余参逐字不动、不存在时 `cap-row-missing`（title `GAP-CAPROW-01`）+ URL 不改写 + `capF-state-filter-empty` 可见、同 URL 重挂 0 新读；R130 例⑥⑦ 是 skills 侧同类；`tools/ToolsPage.test.tsx`「writes the open row to the URL and closes without losing q/sort/dir」查参数字节等值但不查行序与段头计数。
- 口径更正（三处陈旧前提，如实记录不编造）：①**`?toolset=` 本代仍无人读**——全仓只两处命中：legacy `pages/SkillsPage.tsx:713` 的 JSX prop `toolset={configToolset}`，与 `knowledge/KnowledgeModulePage.tsx:513` 一句注释；`ToolsPage` 只读 `state`/`q`/`sort`/`dir`/`row`。②**没有「工具集卡片」也没有「子表」**——tools 页是两张列表段（`tol5-list` 内段头 `tol5-tools-head`、「MCP 连接：N 个」段头无 testid 只能取卡面文本），行是按**工具**而非按集；唯一下钻是行详情 `cap7-detail-tools`（`cap7-detail-toggle` 开 / `cap-row-close` 关，深链 `?row=tools:<名称>`）。故 ①③④ 的字面机制不存在，本单按真实机制实现。③**`capF` 没有计数面**——`capF-*` 只有状态锚（`capF-state-*`/`-text`/`-detail`/`-empty-text`/`-retry`），计数住在 `cap4-count-<tab>`(+`-state`)、`cap6-export-count`、`cap-page-scope`、`cap5-scope-note` 与 tools 段头。
- 新文件 `web/src/modules/capabilities/capabilities.drilldown.test.tsx`（2 例）填的真缺口：例一 **归属忠实性**——每行 `data-source` 分区（toolset 5 / mcp 1，和等于全 6 行），每个工具集恰好一种「内置 · X」措辞且该措辞行数等于上游该集 `tools.length`（1/2/2），三种措辞互不相同，mcp 行措辞含「MCP」，段头数字与实渲行数同源（`tol5-tools-head` 「5 条」、`tol5-mcp-section` 「1 个」），并显式负断言屏上不存在「每集/按集/集合计数」这类按集计数措辞（不存在的机制不假装）。例二 **带筛选+带排序的下钻往返**——`?q=网页&sort=name&dir=desc` 下开详情再收起，断言行序、九张面（行数/复制钮数/两段头/`cap4-count-tools`/`cap-page-scope`/`cap6-export-count`/措辞串）与 URL 参数字节等值、`row` 只在开时多一笔、收起后键集回到 `[dir,q,sort,tab]`，且全程 `fetchJsonStrict` 计数不变（零重取）。
- 坑（实测）：行标记 testid 是**折叠后的 key** —— `ToolsPage.tsx:130` `tl3-row-${row.key.replace(/[^a-zA-Z0-9_-]+/g,"-")}`，`toolset:web:web_search` → `tl3-row-toolset-web-web_search`、`mcp:文档检索:0` → `tl3-row-mcp---0`，所以按 `key.startsWith("toolset:")` 分组得 0 行；分区必须读 `data-source` 属性（:127），前缀校验只能用 `${source}-`。另两处 own-domain tsc：未用的 `AS_OF` 常量（TS6133，删）、`digits()` 可返回 null 故段头文本位改 `String(...)`（TS2531）。
- 验证：新文件 2/2；定向 `src/modules/{capabilities,skills,tools}` → **20 files / 172 passed**（任务前 19/170）；`./node_modules/.bin/tsc -b . --noEmit` → exit 2、本域 grep **0**、错误模块只有 approvals / employee-detail / employees（基线）；全量 `npx vitest run` → **242 files / 2809 tests 全绿 0 failed**（此前基线上的 4 条上游 `audit.filters` 红已被合并的上游修复带走，`runs.filters` 亦绿）。零产品码改动。
- 三档 N/A：纯测试、无标记/CSS 增量，几何证据沿用 R93。
- 边界：只动 `web/src/modules/capabilities/capabilities.drilldown.test.tsx` 与本节；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops；未 install、未并 main、未重建 9122；禁 force/amend/--no-verify 遵守。`capF`/`cap-row-copy-*`/导出族既有断言全绿。

## R104 / cap-export-parity — /capabilities 导出与筛选/排序同源（纯测试，R188）

- 基线：显式 refspec fetch 后 `git merge --no-ff origin/lane/hermes-console`，上游 tip 正是派工单点名的 `53310d04`；merge commit `2287814e`（3 文件 +447：`docs/_artifacts/ui1/KNW5-RETRIEVAL-EVIDENCE.md`、新 `employees/employees.error.test.tsx`、新 `knowledge/knowledge.sort.persist.test.tsx`）。`git diff --name-only HEAD^1 HEAD -- web/src/modules/{capabilities,skills,tools}` 为空 ⇒ 与写域零重叠；起始 HEAD `48055ea6`（R184）porcelain 0；未用 reset。
- 现查覆盖（`git grep` 纪律）：①行数三值 —— `capabilities.rowparity.test.tsx` :196-210 已锁 `cap-page-scope` N == 表体行数 == CSV 数据行数（含 `cap-export-scope-note data-shown`），:211-225 锁 capped 分支；`capabilities.counts.test.tsx`（R140）锁 `cap4-count-<tab>` 值 == 表体 == `cap-row-copy-*` == `scopeN()` 但**从未把 CSV 数据行数纳入**；`csv.test.ts` 锁表头逐字与 null→空串（helper 级）。⇒ 本轮唯一真缺口 = 把 `cap4` 值、`cap6-export-count`、表头、CSV 数据行数、表体行数收进**同一夹具**的五值链，并证明导出零新增请求。
- ②「按 `?kind=` / `?toolset=` 筛选导出」本代不存在：`git grep 'get("kind")|kind=|get("toolset")|toolset='` 只命中 React `kind` prop、knowledge 的 `data-knn-kind`、若干注释与 legacy `pages/SkillsPage.tsx:713` 的 JSX prop，没有任何 URL 读取口 ⇒ 只断真实机制 `?q=` / `?sort` / `?dir`；筛选-排序同源锁步已由 R88 `capabilities.filterparity.test.tsx` 覆盖（skills `?q=报&sort=name&dir=desc` 三面对撞、tools 排序多重集、`firstColumn(lines) toEqual body`），本轮只补 tools 排序下「导出首行 == 屏上首行」与五值链，不写重复用例。
- ③「缺字段（描述/负责人/版本）」同为错位前提：`capabilities/csv.ts` 的 `CsvRow` 只有 `name/type/enabled/updated_at` 四槽。真分歧是**同一行两张脸**：`skills.ts:135` 把缺失名称折成字面「—」而 source/status/updatedAt 保持 null ⇒ 屏上四格全「—」；`SkillsPage.tsx:319` 再以 `name === "—" ? null : name` 折回 null 交给导出 ⇒ CSV 该行是 `,,,`；而 `capC-copy` 走 `copyRows`（:324-328）保留「—」⇒ `—,—,—,—`。本轮把两串逐字钉住并加 `not.toMatch(/undefined|null|NaN|\[object/)` 泄漏护栏；行详情 `cap-row-copy` 六条 `label：value`（口径名 / 类型或来源 / 启用态 / 最近更新 / 读口路径 / 采集时刻）同样钉「—」与真实 asOf。
- ④空结果已被四面覆盖，未写重复：`filterparity` :239-249、`empty`（R130）:184-223、`counts`（R140）:253-261、`stateanchor`（R89）:198-200 —— `cap6-export` disabled + 「当前没有可导出的条目。」同因句 + 点击零剪贴板零请求 + `cap6-export-count`「0 条」+ `capF-state-*` 显 0 不排行列。此处只留证据指针。
- 新文件 `web/src/modules/capabilities/capabilities.export.test.tsx`（2 describe / 4 例）：夹具 `SPARSE_ITEMS = [{skillId:"s9"}, 完整行]`、`TOOLSETS` web/kanban/report 各一 tool + `SERVERS` 文档检索 ⇒ 4 行；`countValue()` 读 `cap4-count-<tab> .cap4-count-value`，`dataLines()` 滤掉 `#` 注记行，`exportedCsv()` 去 BOM，`skillCells(i)` 读屏上四格。
- 三处自身用例修正（零产品改动）：① tools 行数按旧记忆写成 6，实为 4（3 toolset tool + 1 mcp）；② 裸行导出期望写成 `—,,,`，产品是 `,,,` ——「—」是显示 token 不入 CSV，恰是 ③ 要钉的分歧；③ tools 请求全集是六条而非两条：数据层先探 `/agent-api/api/tools`、`/agent-api/api/mcp/servers`、`/agent-api/api/tools/toolsets` 三条网关前缀变体（本代 404），再落 `/api/tools`、`/api/tools/toolsets`、`/api/mcp/servers`；改成「六条全集 + 两条真答口必在其中 + 导出后长度不变」的集合等式，比原两元素数组更严格地证明导出不发请求。
- 验证：新文件 4/4；定向 `src/modules/{capabilities,skills,tools}` → **21 files / 176 passed**（任务前 20/172，+1 文件 +4 例）；`./node_modules/.bin/tsc -b . --noEmit` → exit 2，本域 grep **0**，报错模块只有 approvals / employee-detail / employees（基线）；全量 `npx vitest run` → **245 files / 2817 passed, 0 failed**（上游并入的两个新测试文件已计入）。`capF` / `cap-row-copy-*` / 下钻 / 导出族既有用例全绿。
- 三档：纯测试、零 markup/CSS 增量，几何证据沿用 R93 实测，未重跑 harness（如实披露）。
- 边界：只新增该测试文件与本段；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops；未装依赖、未并 main、未重建 9122；未用 force / amend / `--no-verify`；产品码零改动。

## R105 / channels-ce-upstream-verdict — /capabilities?tab=channels CE 判定收口（选项 B，R193）

- 基线：起始 HEAD `d49a3ce1`（R188 交付），porcelain 0。显式 refspec SSH fetch → 上游 `53310d04..394caf35`，`origin/lane/hermes-console` = `394caf35117751f33958bd45b02a03d70e5be058`（正是派工单点名的 tip 与 remote 前缀，wave-41 并窗）。`git merge --no-ff origin/lane/hermes-console -m "merge(console): sync channels ce verdict baseline"` → 合并提交 **`5af298c1`**；未用 `reset --hard`。`git diff --name-only HEAD^1 HEAD -- web/src/modules/{capabilities,skills,tools,channels}` → **空**；上游 web/src 增量只有 6 个新测试文件（approvals ×2、audit ×2、knowledge ×2）。
- **判定 = (B) 不可修（上游 / ENV）**，已钉在 `docs/_artifacts/gov/R173-channels-ce.md` 首段。三行证据：① 首错 `http://127.0.0.1:9122/auth/whoami` → **401 Unauthorized**（状态行字节 `HTTP/1.1 401 Unauthorized\r`，reason phrase 在 ⇒ shots 过滤器命中是正确分类而非掩盖），同腿另七条 `/agent-api/api/*` 同样 401；② 归属 **BFF / 网关层** —— 9122 是 `l7-ops/ops/v4_proxy.py`（`lsof` → PID 95667），`_auth()` :420-426 抛 `auth.unauthenticated`，`/agent-api` 转发上游（`V4_BFF_UPSTREAM` 默认 8092）自回 `console.unauthenticated`；③ **前端写域内无修法** —— `git grep -n "console\.error" -- web/src` 无匹配、四腿 `pageerror` 全空、按 `shots.mjs` 自己的 `ENV_NOISE_RE` 过滤后 product CE = 0，故任何 `modules/capabilities/**` 改动都降不了它，强行降只能吞错（禁令）。
- 复现用的是**与 R173 同一条脚本、同两视口**（`…/opencode/r173/ce-leg.mjs`，常量逐字对齐 shots：`ENV_NOISE_RE`、150 ms/4 s main 稳定轮询、hash 形导航、auth 走 storageState 不注门旗标、anon 注 `__HERMES_AUTH_REQUIRED__`；只加宽 console 文本不截断 + `m.location()` + `pageerror` 前 6 帧）。四腿：auth @1440 原始 36 / product **0**；auth @375 原始 17 / **0**；anon @1440 原始 8 / **0**；anon @375 原始 8 / **0**；零 `pageerror`，无 React key / undefined 读取 / 未捕获 promise 字样。八条 401 URL 与逐条行数已列表（whoami ×9/×5、hermes-summary ×7/×3、datasources ×7/×4、mcp/servers ×7/×3、gateway-connections ×6/×2，anon 每 URL ×1）。
- 29/66 前提不可复现，且**原始行数本身不可靠**：同一 served 产物（入口 chunk 仍是 `assets/index-k52YwKjs.js`，wave-41 未重建 9122）两轮原始数分别是 R173 的 15/22/8/8 与本轮 36/17/8/8，差异只来自重试时序，两轮 product CE 都是 0。修前/修后两列相同（零产品改动），不是掩盖。
- 凭据侧（只报名字与长度，值不回显）：storageState 恰 1 条 `access_token_cookie`（长度 252）、`origins` 空；**带**该 cookie 与**不带**任何 cookie，`/auth/whoami` / `/agent-api/api/channels` / `/agent-api/api/datasources` 三条响应的状态码与错误码逐字相同 ⇒ 存档凭据被鉴权层拒，401 风暴是环境态。对照腿：9119（`python3.1` PID 46199，shots 默认 BASE）同三路径全 **200 OK** 且不需 cookie（`_auth()` :289 门未开）⇒ CE 数是「腿打在哪个进程 / 哪种鉴权态」的函数。
- 对上一记录的自我更正（如实留档）：R173 曾把 9122 当作纯静态 `python http.server`、把 `/auth/whoami` 的 401 解释为「静态服务器缺路由」。实测它是 v4 BFF 代理，401 是鉴权门主动抛的业务响应。归 ENV 的结论不变，落点从「缺路由」更正为「拒凭据」—— 两者修法不同，后者（换凭据 / 关门）在前端写域之外。证据文件里对应的两处（§4 表第 1 行、§7 第 2 条）已就地加〔R193 更正〕标注，正文其余保留原样（append-only）。
- 口径纪律：未改 `shots.mjs` 的统计口径（禁令）。两点上报 L0 —— `ENV_NOISE_RE = /\b(401|404)\s*\((Unauthorized|Not Found)\)/` 只吞 401/404 不吞 403，且要求 reason phrase 在场（本轮 401 满足）；派工单写的「已剔除 401/403/404 env」比脚本自己的过滤器宽。
- 移交项（不在本写域）：auth @375 的 settle 缺口（4 s 内主体仅「⠋ Loading…」10 字符）落在 `modules/channels` + shell lazy 边界 —— 该路由主体确为 `modules/channels/ChannelsPage`（`App.tsx:179-183` lazy import、`:1225` live slot；`shell/console.tsx` `ConsolePane` 优先 live 节点于 `PlannedBlock`；屏上「平台接入与数据源 / 正在读取平台接入与数据源…」逐字出自 `ChannelsPage.tsx:403,413` / `states.tsx:201` / `channels.ts:835-840` / `useChannelsData.ts:68`），是内容/时序问题不是 console error，归频道道。
- 验证形态：本轮是**纯文档判定**，零产品码改动，故未跑测试（全量基线仍是 245 files / 2817 passed 0 失败，health 16/107）；取证腿的数值证据以上表为准，原始 JSON 落 `/private/var/folders/…/opencode/r193/before-raw.json` 不入库。三档：docs-only，零 markup/CSS 增量，不适用（几何沿用 R93 实测）。
- 边界：只改 `docs/_artifacts/gov/R173-channels-ce.md`（判定钉首段 + 两处就地更正）与 `docs/_artifacts/gov/DONE.md`（本段）；未碰 `App.tsx` / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops；未装依赖、未并 main、未重建 9122、未启停任何服务；未 force / amend / `--no-verify`；cookie/token 值全程不回显。

## R106 / cap-tab-persist-guards — /capabilities 标签与深链组合（纯测试，R197）

- 基线：起 HEAD `69355ef8`、porcelain 0；显式 refspec SSH fetch → 上游 tip 恰为 `1768f36cd13ec0f33dc8d3278871727c8c64c6ee`（`1768f36c chore(gates): full gate ledger stamped at cecbd1f1 (entry k52YwKjs)`，派工单点名的纯账本章笔）；`git merge --no-ff origin/lane/hermes-console` → 合并笔 `aa56db15`（176 files +1156/−180）；未用 reset。`git diff --name-only HEAD^1 HEAD -- web/src/modules/{capabilities,skills,tools,channels}` → 空，上游 web/src 增量只有 3 个新测试文件（approvals.sortfilter.combo / audit.export.escape / knowledge.export.escape）。
- 先现查既有用例（派工纪律）：① 与 ③ 的「深链打开即回填、参数逐字、重挂复原」已由 `capabilities.deeplink.test.tsx` :130 / :163 / :248 钉住；② 的保参切 tab 由 `capabilities.filterparity.test.tsx` :281（镜像 shell preserve，断言 0 新请求）与 :310（无 tab= 的入口补 tab）加 `deeplink` :204（无分页参可复位）覆盖；非法 `?tab=` 只有 system 侧的 R135 `health/system.filters.test.tsx:223-247`。本仓 `__nope__`/分页参类断言共 56 处，无一落在 capabilities tab。
- 三处前提更正（如实披露，不造面）：① `?toolset=` 本代无人读 —— 全仓 3 命中全是非参数：legacy `pages/SkillsPage.tsx:713` 的 JSX prop `toolset={configToolset}`，加我自己两条测试注释；② 能力面没有「工具集卡片」也没有「子表」，唯一下钻是行详情 `cap7-detail-tools`（R184/R103 已钉），MCP 是 tools tab 内的一个分区而非独立 tab；③ `capF` 只是状态锚族（`capF-state-*` / `capF-retry`），无计数面；计数在 `cap4-count-<tab>`(+`-state`)、`cap6-export-count`、`cap-page-scope`、`cap5-scope-note`、`tol5-tools-head`/`tol5-mcp-section`。另：capabilities 的 tab 只有 skills/tools/models/channels（`shell/routes.ts:173/175/178/181`），**不存在 `servers` tab**，`TAB_ALIAS` 也无 capabilities 条目。
- 补的两个真缺口：
  - A 非法 `?tab=` 落在能力面：`resolveTab("capabilities","__nope__"|"servers"|"tools")` 全部原样透传 `{tab,view:""}`；壳层折叠到第一 pane「技能」，粘进来的 `q`/`row`/`sort`/`dir` 逐字保留、地址一字不改；无分页类键；「不显裸 0 计数」的诚实形态是从未读过的 pane 上**根本没有 `cap4-count-*` 节点**（不是 0），零请求、零行、不起 `cap-row-missing`。
  - B 跨 tab 定位符隔离（此前无人断言）：`rowTargetFor(params,tab)` 在 tab 不匹配时返回 null ⇒ skills 上的 `?row=tools:网页搜索`（真实存在的工具名）既不展开详情、也不报缺失、也不把列表筛成空 —— 3 行全在、计数「3」、scope「共 3 项」而非「共 0 项」、搜索框为空、`row=` 留在 URL 里没被删、只发一次 `/agent-api/api/skills`；tools 侧对称（4 行 / 计数 4 / 「共 4 项」）。同测还钉了本品语义：本 tab 内下钻把 `row` **覆写**成自己的 `tools:<本行名>`，关闭时 `withoutRowTarget` **整项删除** `row`，外来定位符不会被复活。
- 两处自身用例修正（零产品改动）：① A2 尾部原断言切回 skills 后地址与原串逐字相同，实际默认 tab 的链接不带 `tab=`（`shell/routes.ts:173` skills 无 `tab` 字段），真址是 `?q=…&sort=name&dir=desc&row=skills%3A…`，`tab` 键是被丢弃而非被改写；改为断言无 `tab` 的键集与还原后的 pane 名，并删掉因此闲置的 `pasted` 局部量（避 TS6133）。② B2 原写死 `row=tools:网页搜索` 并期待关闭后恢复外来 `skills:` 定位符，与产品的覆写/删除语义相反，改为从 DOM 取本行 `tl3-name` 推导并断言关闭后 `{tab:"tools"}`。
- 验证：新文件 4/4；定向 `src/modules/{capabilities,skills,tools}` → **22 files / 180 passed**（任务前 21/176，+1 文件 +4 例）；`./node_modules/.bin/tsc -b . --noEmit` → exit 2，本域 grep **0**，报错模块仅 approvals / employee-detail / employees（基线）；全量 `npx vitest run` → **255 files / 2859 passed，0 失败**（exit 0，32.84 s；上游并入带来 3 个测试文件后新基线）。jsdom 噪声仅既有的 「Not implemented: navigation / Window's open()」。
- 三档：纯测试、零 markup/CSS 增量，几何证据沿用 R93 实测，未重跑 harness（如实披露）。
- 边界：只新增该测试文件与本段；`shell/console.tsx`、`shell/routes.ts` 为只读挂载与纯函数断言，未改一字；未碰 App.tsx / routes / registry / package·lock / web-scripts / ops；未装依赖、未并 main、未重建 9122；未用 force / amend / `--no-verify`；产品码零改动。

## R107 / cap-request-contract-guards — /capabilities 读口请求契约（纯测试，R199）

- 基线：起点 HEAD `afa5873e`（R197）porcelain 0；显式 refspec SSH fetch → 上游 `1768f36c..eae57b6c`，`origin/lane/hermes-console` = `eae57b6c30abf19986bbcdec20901bd2e947c1aa`（subject `merge(lane): afa5873e (wave-43)`，即上游已并我 R197），正是派工单点名的 tip；`git merge --no-ff` → 合并笔 `a4a639d8`，4 文件 +749/−0，新增上游用例 `employees/employees.sort.test.tsx`、`knowledge/knowledge.counts.paging.test.tsx`、`knowledge/knowledge.preview.requests.test.tsx`。`git diff --name-only HEAD^1 HEAD -- web/src/modules/{capabilities,skills,tools,channels}` 为空 ⇒ 写域零重叠；未用 reset。
- 现查引用（只回证据不重复）：skills 单 URL 首载已由 `capabilities.tab.persist.test.tsx` 例 B1 钉；tools 六 URL 全集由 `capabilities.export.test.tsx`（R188）在导出点击后钉；`capabilities.filterparity.test.tsx` :281 手工镜像 tab 切换并断言 0 额外读取（从不挂真 tab 条）；`capabilities.deeplink.test.tsx` :204/:239 的 PAGE_LIKE 缺失守卫只作用于**页面** URL，从不查**请求** URL；`SkillsPage.test.tsx` :143-173 首载失败 + 重试恰 +1、:175-196 失败与重试保 q/sort/dir、:228-259 404 GAP 只在 title；`ToolsPage.test.tsx` :375-411 tools 500 的重试计数只有 `> 0`（不精确）、:413-420 重读期间计数位换「加载中」。
- 四个真缺口，本轮补齐：(a) 请求 URL 纯净性（无 `?`、无 cursor/page/limit/toolset/kind 外溢）与两 tab 首载计数写进同一条契约；(b) 挂**真 tab 条 + 两个真页面作 live 槽**，证两 tab 行永不共存、返回恰 0 新请求；(c) 成功→失败的换代序列（此前所有失败用例都失败在首载，屏上根本没有旧行可谈），加上无人钉的 tools **单腿失败**（部分成功）；(d) tools 重试的精确请求集。
- 口径更正（五条，全部按产品实况断言，不吞错不改产品）：① tools 首载是**六条** URL 而非一条 —— `fetchInventory` 顺序走 `/agent-api/api/tools`→`/api/tools`→`/agent-api/api/tools/toolsets`→`/api/tools/toolsets`，`fetchServers` 走 `/agent-api/api/mcp/servers` 两支，`fetchFirst` 对 403/404/200「未接入」继续走下一支，两条腿并发所以六 URL 的**交错不确定**，故断言为排序集合而非序列；②「切 tab 恰 +1 次」与产品相反 —— 返回旧 tab 付 **0** 新请求（`cachedSkillsState` / `cachedTools` 模块缓存，`useToolsData` 头注直言「不重读那两个端点」）；③「旧行保留」在两 tab 的整页重读上都与产品相反 —— skills `load()` 首行即 `setState({k:"loading"})`，tools 渲染行 `read.attempt === attempt ? read.settled : PENDING`，所以屏强行被撤；**但** tools 单腿失败确实保留存活腿的 3 行并给一枚 `[data-testid^='tol5-issue-']` 注记（rid 在屏上可见，经该注记内的 `RequestId`）；④ 部分读 publishes `cap4-count-tools` =「—」且 `cap-page-scope` 含「无法判断总数」，绝不把局部 3 折算成总数；⑤ 能力面没有分页/`cursor=` 参、`?toolset=`/`?kind=` 本代无人读、`capF` 无计数面（计数住在 `cap4-count-*`/`cap6-export-count`/`cap-page-scope`/`cap5-scope-note`）。
- 附带新发现（更正 R197 A2 的结论边界）：A2 看到的「默认 tab 的 `tab=` 被丢掉」只在**没有真页面挂载**时成立；一旦 `SkillsPage` 作为 live 槽挂上，`useEnsureTabParam("skills")` 会用 `replace` 把 `tab=skills` 写回，地址回到原点。两次写都不花请求，契约以计数为准。
- 自身用例修正（零产品缺陷）：首跑 5/5 红全为我自己的期望 —— skills 行数漏算 `q=报` 本地筛选（3→2）、`q(testid)` 包 `[data-testid='…']` 导致属性选择器 `'[role="tab"]…'` 永不可匹配（新增 `tabButton()`/`all()` 走 `querySelector`）、中文升序按 `localeCompare(…,"zh-Hans")` 是 `[日报生成, 周报汇总, 资料整理]` 而非我以为的周→日、skills 重试基数须在错误落地后取（失败重读本身已 +1）、tools 首腿 handler 让 `fetchFirst` 提前命中只发 2 条（改为仅 `/api/tools/toolsets` 与 `/api/mcp/servers` 应答、其余 404 才走满六条）；例② 入口带 `q=报` 会把 tools 合法筛空，去掉 q 才能正向量到行不共存；四处 TS2531 把非空断言移出括号 `q<HTMLButtonElement>("cap6-export")!.disabled`。
- 验证：新文件 **1 file / 5 passed**；定向 `src/modules/{capabilities,skills,tools}` → **23 files / 185 passed**（任务前 22/180，+1 文件 +5 例）；`./node_modules/.bin/tsc -b . --noEmit` → exit 2，本域 grep **0**（错误只在 approvals / employee-detail / employees 基线）；全量 `npx vitest run` → **259 files / 2874 passed, 0 failed**（新基线；上游并入带来 3 个测试文件，本单 +1 文件 +5 例，无上游红）。
- 三档：纯测试、零 markup/CSS 增量，几何证据沿用 R93 实测，未重跑 harness（如实披露）。
- 边界：只新增该测试文件与本段；`shell/console.tsx` / `shell/routes.ts` 仅挂载与阅读、未改一字；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops；未装依赖、未并 main、未重建 9122、未启停任何服务；未用 force / amend / `--no-verify`；产品码零改动。

## R108 / sys-matrix-export-parity — /system 导出与筛选/排序同源（纯测试，R204）

- 基线：开工 HEAD `3316136a`（R202 的并窗），`git status --porcelain | wc -l` → 0。显式 refspec SSH fetch 输出 `c0b8a5f6..b9fb2cc4`，`origin/lane/hermes-console` = **`b9fb2cc42338936fc4120a4f7141240500224264`**，subject `merge(lane): 76a66c46 (wave-44)` —— 正是派工单点名的 tip。`git merge --no-ff` → 并窗提交 **`c98d1a95 merge(console): sync event export baseline`**，82 files +1745/−74，之后 porcelain 0；**未用 reset**。
- 域内零重叠：`git diff --name-only HEAD^1 HEAD -- web/src` 只有 `audit/audit.detail.crossfilter.test.tsx`(+459)、`audit/audit.detail.requests.test.tsx`(+242)、`knowledge/knowledge.export.columns.test.tsx`(+201)、`metrics/metrics.requests.test.tsx`(+608) 与 shell 的 `ConsoleButton.tsx` / `ConsoleSelect.tsx` / `SessionExpiredBanner.tsx` / `console-nav.css`(+33) / `console.tsx` / `tokens.css`(+51) —— 全部由上游带入，我一枚字符未改；`modules/health|capabilities|skills|tools` **零增量**。
- 服务代次核对（只读）：`curl -s http://127.0.0.1:9122/` → `assets/index-D2FPmK7G.js` 与 `assets/index-CfOo_-5k.css`，与派工单点名的入口/CSS 逐字一致（属 served 产物，可引；9122 由我之外的道重建，我没动）。
- **偏离声明（文件名与 commit 主题）**：派工单点名 `web/src/modules/health/system.event.export.test.tsx` 与 `sys-evt-copy-<i>`、事件表 —— 本代不存在（第九条车道；`git grep 'sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count' -- web/src` 只有三条注记命中：`health/system.state.isolation.test.tsx:18`、`health/system.time.test.tsx:8`、`health/system.filters.test.tsx:14`）。而 ①②③④ 在真实事件面上已被 aud 道逐条钉住：`audit.export.test.tsx`（R141 :199 / :215 / :241 / :259 / :283 / :303 / :323）与 `audit.export.escape.test.tsx`（R192 :265 / :279 / :302 / :323 / :343）。按「已覆盖只回证据不写重复」，我没有另造事件面用例，也没有硬写一个不存在的文件名，而是对着 health 写域内唯一的导出面 —— 读源矩阵 `sys7-export` —— 用诚实文件名 `system.matrix.export.test.tsx` 落盘，commit 主题相应为 `test(console): system matrix export parity guards`。
- 交给 aud 道的残余缺口：事件表的**列表级逐行复制**（`sys-evt-copy-<i>` 的等价物）是产品能力而非测试缺口 —— 那面的复制锚全是逐记录/逐值（`audC-copy*`、`aud-detail-copy*`），没有列表级按钮。此点与 R155/R194/R202 的结论同向。
- 现查证据（不重复）：`SourceMatrix.test.tsx` :98-108 点了导出但只断言 `createObjectURL` 一次 / anchor click 一次 / 仍 4 次读，**从未读过文件内容**；:406-412 钉全失败支的 `sys7-export` disabled 与计数位「—」但不点击；R159 `system.matrix.copy.test.tsx` :347 / :372-373 只断言 `sys7-export-count`「—」与 `sys7-export` disabled，同样没力点它。
- 本文件填的四个缺口：① 三值同源（文件数据行 == 表体行数 == `sys7-export-count` 的数字）加表头与列序按现状锁定 `["name","path","state","elapsed_ms","as_of"]`，并断言五行都不含引号（夹具不需要转义）与尾 `\r\n`；② 文件服从 `?q=`（`探针` 命中 3 条）与 `sys13-sort-asof` 的当前排序，首列逐字等于屏上的 `sys6-name-*` 顺序，且导出零额外请求；③ 缺值两处各自逐字 —— 文件里是**空单元格**而屏上是「—」（`cell(null) → ""` vs `toPlainText` 的 `row.asOf ?? "—"`），`elapsed_ms` 是裸数字而 `sys6-duration-*` 是「N ms」，`as_of` 是 **UTC 原文**（`csvRows` 取 `row.asOfIso`）而屏上是北京到分；假时钟 2031 下刷新后文件不含「2031」/「刷新完成于」/`undefined|null|NaN|[object`，且 `sys-updated-at` 自述「（读取时刻，不是数据时刻）」；④ 空集（`?q=zzz-none`）下 `sys7-export` disabled + 可读 title 含「没有可导出」+ 计数位「—」，力点后 `createObjectURL` 未被调用、无文件名、无内容、请求数不变。
- 用到的源码锚：`sourceMatrixCsv.ts` 的 `SYS7_HEADER` / `csvRows`（`as_of: row.asOfIso`）/ `cell` / `toCsv` / `exportFilename` → `system-sources-YYYYMMDD-HHmm.csv`（`en-CA` Asia/Shanghai h23，只是文件名戳）/ `downloadCsv`（BOM + Blob + anchor）；`SourceMatrix.tsx` :109 `exportRows = csvRows(sortedRows)`、:112 `exportDisabled = exportRows.length === 0 || matrixBlocked`、:175-179 按钮 title 对「导出当前矩阵；不会再发请求」/「当前没有可导出的读口行」、:209 计数位 `exportDisabled ? "—" : `${n} 行``。
- 用例修正：**零**。首跑即 4/4 绿 —— 两处事前修正（`aria-sort` 轮询 `sys13-head-asof` 而非排序按钮；删掉未经证实的 `rowIds()` 长度为 0 断言）在运行前已落盘，未发生一次自我纠正。产品缺陷：未发现，零产品码改动。
- 验证：新文件 1 file / 4 passed（1.43 s）；`npx vitest run src/modules/health` → **17 files / 111 passed**（任务前 16/107，+1 文件 +4 例）；`./node_modules/.bin/tsc -b . --noEmit` → exit 2，`grep -Ec 'modules/health'` → 0，报错文件只 approvals / employee-detail / employees（基线）；全量 `npx vitest run` → **264 files / 2895 passed, 0 failed**（43.42 s，stderr 只有既有的 jsdom 「Window's open() method」×2 与「navigation to another Document」×4）。新基线 264/2895 零红。
- 三档：纯测试、零 markup/CSS 增量，几何证据沿用 R93 实测，未重跑 harness（如实披露）。
- 边界：只新增该测试文件与本段；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops（shell 增量全部来自上游）；未装依赖、未并 main、未重建 9122、未启停任何服务；未用 force / amend / `--no-verify`；cookie/token 未涉及。

## R109 / sys-cross-isolation-guards — /system 同批失败与同批恢复互不污染（纯测试，R210）

- 基线：起始 HEAD `af508f4e`（R206 的 merge）porcelain 0；显式 refspec SSH fetch `6d20d6f4..cdcffc02`，`origin/lane/hermes-console` = `cdcffc02e0118b6d4354e11c05cc476db59cbe57`，subject `cdcffc02 merge(lane): 5a777d27 (wave-47)` — 与派工单点的 tip 逐字一致；`git merge --no-ff` → merge commit `f88d3055 merge(console): sync cross isolation baseline`，178 files +880/−234，之后 porcelain 0，未用 reset。`git diff --name-only HEAD^1 HEAD -- web/src/modules/{health,capabilities,skills,tools}` → **EMPTY**；`web/src` 增量只有上游带来的 approvals（`ApprovalsPendingModulePage.{tsx,test.tsx}`、`QueueSummaryBar.tsx`、`approvals.filterurl.test.tsx`）与 audit `audit.empty.export.test.tsx`、knowledge `knowledge.preview.requests2.test.tsx`，我一处未改。
- **前提缺失（第 11 条车道）**：`git grep 'sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count' -- web/src` → 4 处命中，全是记录「本代不存在」的注释：`health/system.state.isolation.test.tsx:18`、`health/system.filters.test.tsx:14`、`health/system.time.test.tsx:8`、`health/system.matrix.export.test.tsx:6`。health 模块没有事件表；`/system?tab=health` 与 `?tab=events` 是 shell 互斥 live 槽（`App.tsx` 的 `health:` vs `events:`，事件面锚 `agent-v2-page-audit`），同屏拿不到两处 ⇒ ②「仅矩阵刷新时事件表行数/时间列/`sys-evt-copy-<i>` 不动」在本代无可测对象；且读源矩阵复用页面四条读口、自己一发请求都不发，「仅矩阵刷新」这个动作也不存在。
- **①已覆盖只回证据**：单读源失败只坏自己、兄弟行一字不动 = R145 例①（changed set 恰为 `[hlt5-row-runtime, sys6-row-runtime]`，其余逐字节同）+ R148 例②（`sys6-summary` 诚实句）+ R112 例④；「矩阵 asof 与行值不动」的另一半 = R145 例② / R148 例①。未重写。
- **本文件只写真正的缺口：③④的「同批」维度** —— 既有全部失败/恢复用例一次只坏一只读口、一次只恢复一只读口，没人证过「列表读口与探针读口在同一批里同时坏 / 同时好」时两处锚各自独立、互不清空。
- 例③「a list read and a probe read failing in the same batch keep their own anchors and empty nothing」：同批拒 `/agent-api/api/health`（500，`req-list-both`）与 `/agent-api/api/hermes-summary`（500，`req-probe-both`），console/domain 照旧。断言：三张表行数与失败前 `toEqual`（`sys3` 仍 2 行、`sys3-table` 在、`sys3-error`/`sys-state-state` 无）；`sys6-row-health`/`sys6-row-runtime` 各自 `data-status="failed"`，`sys6-rid-health` title 逐字 `req-list-both`、`sys6-rid-runtime` title 逐字 `req-probe-both`；两行采集时刻「—」而 console/domain/`sys3-asof` 六个好腿时刻与失败前逐字相同；`hlt5-row-runtime` 含「异常」与 8 位短码「req-prob」；页面级错误块 `sys-refresh-error` 只有一块、带 `sys-refresh-copy`；反向污染循环（跳过 health/runtime）断言每一张兄弟行整行文本逐字节同失败前，且不含「请求编号」或任一整 rid —— 一处失败没把另一处的读数或编号抹成 0 行；`sys6-summary` 「4 个读口 · 成功 2 · 失败 2 · 读口未接入 0」；`sys-updated-at` 仍为 null（失败批不写读取时刻）；每键请求计数 `{2,2,2,2}`。
- 例④「recovering both reads in one batch turns both faces green on the NEW generation, with the read stamp alone moving」：同批恢复后断言 `sys-refresh-error` 与两枚 `sys6-rid-*` 全撤、两行回 `ok`；`sys3-row-*` 键集恰为 `[svc-a, svc-b, svc-c]` 且 `new Set(...).size === length`（**无重复行/重复 key**，正是派工单 ③ 要的「无重复」）；`sys3-asof`/`sys6-asof-health`/`sys8-asof-health` 齐指新一代「2026-11-19 15:00」，`sys6-asof-runtime`/`hlt5-asof-runtime` 齐指「2026-11-19 11:20」，console「09:30」、domain「12:15」不动；`sys-updated-at` 只带「（读取时刻，不是数据时刻）」并用 `/刷新完成于 (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/` 抠出时刻逐一反比于每一个数据时刻面（不相等）；零残留：所有时刻面里既无上一代「14:00」「10:45」也无「—」；计数 `{3,3,3,3}`。
- **口径披露（协调器顺序不定）**：页面级错误块的 rid 面只记这一批里先到达 `finish()` 的那次失败，`sys-refresh-request-id` 断言为「两 rid 之一」而非固定其一 —— 批次内两条腿并发，先后不是契约。行级锚不受此影响：`sys6-rid-health`/`sys6-rid-runtime` 各自钉住自己的整 rid。
- 用例侧修正一处（零产品缺陷）：首轮 `npx vitest run` 报 `[BabelError] Identifier 'textOf' has already been declared. (128:6)` —— 我在夹具区和 helper 区各写了一遍同名的 `textOf`，删掉夹具区那份孤立声明，helper 簇（`node`/`rowCount`/`idsOf`/`rowSnapshot`/`dataStamps`）保留一份。此后同文件 2/2 绿。
- 夹具与设计要点：每个读口给**互不相同**的顶层 asOf（health 06:00Z→14:00、console 01:30Z→09:30、runtime 02:45Z→10:45、domain 04:15Z→12:15，恢复代 health 07:00Z→15:00 / runtime 03:20Z→11:20），这样「谁动了、谁没动」在文本层面可辨；`rowSnapshot()` 把 `\d+ ms` 折成 `<n> ms` 再比（耗时逐次实测，1 ms 抖动会假红 —— R145 的教训）；`waitFor` 用 600 × 5 ms 真 setTimeout 迭代上限，不读 `Date.now()`（R135 的教训：假时钟下墙钟上限永不触发，会空转到 vitest 15 s 击杀并级联污染同文件后续用例）；矩阵默认折叠但行节点仍在 DOM，故直接读 `sys6-*` textContent 无需点 `sys6-toggle`。
- 验证：新文件 **1 file / 2 passed**（首轮 parse 报错修正后）；定向 `npx vitest run src/modules/health` → **18 files / 113 passed**（任务前 17/111，+1 文件 +2 例）；`./node_modules/.bin/tsc -b . --noEmit` → exit 2，`grep -Ec modules/health` = **0**，报错模块只有 `src/modules/approvals` / `employee-detail` / `employees`（基线）；全量 `npx vitest run` → **274 files / 2934 passed, 0 failed**（新基线；R204 时实测 264/2895，本轮 merge 带入 2 个上游测试文件 + 本文件 1/2）。无红，故不需独立性隔离跑。
- 三档：纯测试、零 markup/CSS 增量，几何证据沿用 R93 实测，未重跑 harness（如实披露）。
- 边界：只新增该测试文件与本段；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops；未装依赖、未并 main、未重建 9122、未启停任何服务；未用 force / amend / `--no-verify`；产品码零改动。

## R110 / sys-empty-guards — /system 空态与清时间窗护栏（纯测试，R212）

- 基线：起始 HEAD `2d816864`（R210）porcelain 0；显式 refspec SSH fetch → `origin/lane/hermes-console` 恰为派工指名的 `42180cd62a09647d9c11b332406d544e3cd1d029`（`merge(lane): 0841cfab (wave-49)`）；`git merge --no-ff` → 合并提交 `bd61262c`，之后 porcelain 0，未用 reset。上游带入 `web/src/modules/skills/SkillsPage.tsx` 仅 +2/−2：401 分支改用 `@/lib/api-error` 的 `SESSION_REQUIRED_GUIDANCE`（「重新登录后回到这个页面，即可继续查看。」）；grep 证实无 skills 测试钉旧 401 字面，全量复测确认无破。`modules/health` 零 delta。
- 现查证据（派工纪律）：`sys-evt-copy-*` / health 事件表本代不存在——第 12 条道确认，全仓 grep 只命中五处记录缺席的注释（`system.cross.isolation.test.tsx:6-12`、`system.filters.test.tsx:14`、`system.matrix.export.test.tsx:6`、`system.state.isolation.test.tsx:18`、`system.time.test.tsx:8`）；health 亦不读 `?window=`（唯一读者 `modules/audit/AuditEventsModulePage`）。
- 已覆盖只回证据不重写：②的事件导出半与④的清时间窗半由 aud 道钉死——`audit.empty.test.tsx`（R181）:169 空态句子+页锚+无裸计数、:197 两导出钮 disabled+点击无所求、:221 清空区间回默认窗/复行/去深链；`audit.empty.export.test.tsx`（R206）:186/:202 «never a Blob»/:221 出口恰再问一次+读数行==行数/:241。health 侧既有 pin 引用：`SystemHealthSurface.test.tsx` :398-402（错误面板+rid 存在，从未点击）、:430-432（空面板）、R159 ④c :358（全 500 三钮 disabled）、R204 ④ :353（无匹配 q 强点不建 Blob）、R151 :269。
- ④ 缺口如实披露：「清时间窗后矩阵复原」在本代不可测（health 无 window 参、无事件表），不发明面；③的 rid 可复制与①②的可写部分已全部落在新文件。
- 新文件 `web/src/modules/health/system.empty.test.tsx`（3 例）：① 空清单页级面——`sys3-empty`+`data-state="empty"`+空句「不补服务行」，零 `sys3-row-*`/`sys3-table`/行复制钮，ready-only 的 `sys3-summary`/`sys3-overall`/`sys3-sources` 整条撤走（不给绿色结论），无 undefined/NaN/[object 泄漏，页锚仍在（`hlt5-page`、矩阵 4 行且 health 行诚实 ok——空清单仍是成功读取，`sys6-summary` 「4 个读口 · 成功 4 · 失败 0 · 读口未接入 0」），`sys-updated-at` null，读口恰 4 笔。② 全读口 404 未接入——surface 落 `sys3-gap`/`sys-state-denied`/`sys3-apply`（无重试），矩阵 4 行 `unwired`+「读口未接入」+summary「成功 0 · 失败 0 · 读口未接入 4」；`sys7-export`/`sys10-copy`/`sys-matrix-copy` 三钮 disabled 共用单点原因句「当前没有可导出/复制的可用读口行：读口未接入或读取失败。」，`sys7-export-count` 「—」；装下载捕获+navigator 桩后强点三钮：`createObjectURL` 未被调用、content/fileName 空、`writeText` 未被调用、两状态节点空、无 fallback、零新增请求。③ 错误/空互斥+rid 逐字复制——先 500 `req-empty-500`：`sys-state-error` 在、值节点含全 rid（口径更正：surface 传 `legacyRidTestId="sys3-request-id"`，值节点 testid 是 `sys3-request-id` 而非 `sys-state-rid-value`，wrapper 仍 `sys-state-rid` 且 title==全 rid）、`sys-state-empty` null 且错误面板文本无空态句；点 `sys-state-rid-copy` → mock 助手恰收全 id、按钮「已复制」、零新增请求；再重试回空清单：`sys-state-error` 撤、`sys-state-rid*`/`sys3-request-id` 零节点（RequestId 组件结构性只挂在 error/denied 分支）、`sys3-empty` 子树无「请求编号」；按 key 计数：health 恰 +1、三探针 0 增量（复验 R151 单源重试语义）。
- 自测修正一处（全为本文件笔误，非产品缺陷）：`sys-state-rid-value` → `sys3-request-id`（legacy 覆盖）；另删 ① 里一行冗余的首次 mockImplementation。
- 验证：新文件 3/3；定向 `src/modules/health` **19 files / 116 passed**（任务前 18/113，+1 文件 +3 例）；`tsc -b . --noEmit` exit 2、`modules/health` grep **0**（错误仅限 approvals / employee-detail / employees 基线）；全量 `npx vitest run` → **281 files / 2965 passed, 0 failed**（新基线；上游 wave-49 带入的测试文件已计入）。stderr 仅既有 jsdom 噪音。
- 三档 N/A：纯测试，零 markup/CSS delta，几何证据沿用 R93（先例 R91/R94-R98/R106-R109）。
- 边界：仅新测试文件 + 本节；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops；未 install、未并 main、未重建 9122、未启停服务；无 force/amend/--no-verify；零产品码改动。

## R111 / cap-counts-drilldown-parity — /capabilities 分区三值同源与下钻零重取（纯测试，R215）

- 基线：起点 HEAD `d9f030cc`（R212），porcelain 0。显式 refspec SSH fetch → 上游 `ea236451..916b943b`，`origin/lane/hermes-console` = **`916b943b35b773e2481d14b62fe7c25ff3c16d39`**（`merge(lane): seal ea236451 (wave-51 seal)`），正是派工单点名的 tip；`git merge --no-ff` → 合并提交 `109585f2`，之后 porcelain 0，**未用 reset**。写域增量只有上游自带的一行 `skills/skills.css` token 清理（`.skl4-preview` 的 `color-mix(...)` 去掉 `#f59e0b` 兜底），`git grep f59e0b -- web/src` 已无残留，故无用例钉那行兜底。上游另带 4 个新测试（audit.requests / employees.detail.requests / employees.empty / knowledge.rowcopy.filter）与 duty·employees·knowledge·metrics·org·shell 若干改动，全部非我编辑，capabilities/tools 零改动。
- 派工单前提之三处不实，按证据如实回报（沿用 R101/R91/R93/R94/R96/R98/R155 的"陈旧前提"纪律）：①**`?toolset=` 本代无人读**（第 13 条道确认）——全仓 grep 只命中我自己 5 处测试注释与 legacy `web/src/pages/SkillsPage.tsx:713` 的 JSX prop `toolset={configToolset}`，无任何 `params.get("toolset")`；②**没有"工具集卡片"也没有"子表"**——tools 只有 `tol5-list`（工具集段）与 `tol5-mcp-section`（MCP 段）两段列表，行是按工具展开的 `tol5-row`，唯一的下钻是行详情 `cap7-detail-tools`；③**`capF` 没有计数面**——`capF-*` 只是状态锚族，计数住在 `cap4-count-<tab>`(+`-state`)、`cap6-export-count`、`cap-page-scope`、`cap5-scope-note` 与两段段头。
- 现查既有用例（只回证据，不重写）：R184 `capabilities.drilldown.test.tsx:184`（`data-source` 归属分区 + 每集一种「内置 · X」措辞 + 段头数字与「5 条」/「1 个」+ 负面护栏 `/每集|按集|集合计数/`）、`:230`（`?q=网页&sort=name&dir=desc` 下面向**全局**面的往返 + `reads()` 不变）；R140 `capabilities.counts.test.tsx:212`（段头 == 段内行数、两段之和 == 全局 == `cap4-count-tools` == `cap-row-copy-*` == scope N，展开/收起复原——**但该例不计量请求，且从不看段内按钮数**）、`:186`（q 收窄只动全局三值）、`:247`（空结果诚实 0）；R91 `capabilities.deeplink.test.tsx:130/:204/:248/:163`（`?row=tools:<存在>` 参数字节等同 + 零重取 / 只改 `row` / 重挂复原 / 缺失行 `cap-row-missing` + GAP + 地址不改写 + `capF-state-filter-empty` 可见）；R130 `capabilities.empty.test.tsx:214`、R88 `capabilities.filterparity.test.tsx:234/:260`。
- **第 ④ 例未写**：派工单要的"不存在的 toolset → 可读空态、计数显 0 不显 —、复制导出 disabled + title、零请求"在三处已钉死——R140 `:247`（`countValue` 为诚实 「0」 + 状态「有源（空）」 + `cap6-export-count` 「0 条」 + 两闸 `.disabled` 共用「当前没有可导出的条目。」 + 点击零剪贴板零请求，另含 `resetSkillsTabState()` 后真空读口一支）、R130 `:214`（tools 无匹配禁用两钮并撤按钮）、R88 `:234`（skills 同口径）；而「—」属于**未读/不可读**分支（R88 `:260`），与"计数显 0 不显 —"正好同一枚硬币的两面。加上该例的入口 `?toolset=` 不存在，重写即是跨道重复，故只登记不落地。
- 真正缺口（本单四写）：(a) **段内复制按钮数从未被钉**——R140 只比"段头 vs 段内行数"与"两段之和 vs 全局按钮"；(b) 一段收窄到单一工具集时，该段行数须等于上游该集 `tools.length` 且段头/段内按钮跟着走；(c) 分区面的往返**带请求计量**（R140 ③ 不计量、R184 ② 只看全局面）；(d) `?row=tools:<存在>` 到达后分区三值与地址字节。
- 新文件 `web/src/modules/capabilities/capabilities.counts.drilldown.test.tsx`（4 例 / 3 describe）：夹具沿用 R140 的 TOOLSETS（web 两把工具 + kanban 一把 ⇒ 工具集段 3 行）与 SERVERS（docsearch + legacy ⇒ MCP 段 2 行）。`faces()` 一次取十面：`toolsetHead/toolsetRows/toolsetButtons/mcpHead/mcpRows/mcpButtons/globalButtons/globalRows/countValue/scopeN`，其中 `sectionButtons()` 用 `button[data-testid^='cap-row-copy-']`（记录在案的坑：不带 `button` 前缀会连详情复制的状态 span 一起数）。①两段各自闭合（3/3/3 与 2/2/2）且两段之和 == 全局行数 == 全局按钮 == `cap4-count-tools` == `cap-page-scope` N；②用段内首行名推 needle（`webNames[0].slice(0,2)`，先钉 `webNames.length === WEB_SET.tools.length`）收窄后 `toolsetRows === 2 === toolsetHead === toolsetButtons`，MCP 段自己闭合（`mcpRows === mcpButtons`，段头允许整卡撤下时读不到即 −1），全局与计数跟着；③往返：点首行 `cap7-detail-toggle` 展开一枚 `cap7-detail-tools` → `faces()` 逐字等于展前且 `reads()` 不加，点 `cap-row-close` 收起 → 十面复原、请求数仍为首载；④深链到达：`settleTools()` 取 `target` 与普通首载的 URL 集合，再以 `?tab=tools&row=tools:<target>` 重挂 → 一枚详情、分区三值相等、`paramsOf()`/`searchOf()` 与粘贴地址逐字、`[...reads()].sort()` 等于普通首载集合（深链不多读）。`settleTools()` 先 `resetToolsTabState()` + `resetCapabilityCounts()` 再 mockReset——tools tab 有模块级缓存，不重置的第二次挂载是 0 请求、面也不是首载的面。
- 自查修正一处（纯测试侧，非产品缺陷）：`expect(f.toolsetHead).toBe(f.toolsetRows, "…")` 把消息写进了 `toBe`——本项目 chai 的 `toBe` 只收一参，改为 `expect(value, "消息").toBe(其他)` 的两参形态（本文件其余带消息断言已是此形）。首轮即 4/4 绿，无产品码改动、未发现产品缺陷。
- 验证：新文件 **1 file / 4 passed**；定向 `src/modules/{capabilities,skills,tools}` → **24 files / 189 passed**（任务前 23/185，+1 文件 / +4 例）；`./node_modules/.bin/tsc -b . --noEmit` → exit 2，本域 grep **0**（错误只在 approvals / employee-detail / employees 基线）；全量 `npx vitest run` → **286 files / 2979 passed, 0 failed**（43.24 s，新基线；上游 wave-51 带来 4 个新测试文件）。
- 三档 1440/1280/375 本轮 N/A：纯测试，零标记/样式增量，几何证据沿 R93（`2828cdef`）与后续各单披露口径。
- 边界：只动 `web/src/modules/capabilities/capabilities.counts.drilldown.test.tsx`（新增）与本节；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops（`shell/*` 的改动是上游带的）；未 install、未并 main、未重建 9122、未启停任何服务；未 force / amend / `--no-verify`；零产品码改动。

## R112 / cap-filter-persist — /capabilities 筛选参数的到达、存活与清除（纯测试，R216）

- 基线：起始 HEAD `2f008bbd`（R215），porcelain 0。显式 refspec SSH fetch → 上游 tip **恰为 `804ad319a2d9f6f8acc1319e5fa66775276cc05f`** = `804ad319 merge(lane): f11f9181 (wave-53 ui-qa review)`，即派工单点名的那支。`git merge --no-ff origin/lane/hermes-console -m "merge(console): sync filter persistence baseline"` → 合并提交 **`fb94f95c`**；之后 porcelain 0；**未用 reset**。`git diff --name-only HEAD^1 HEAD -- web/src/modules/{capabilities,skills,tools,health}` → **空**（写域零增量）。整个 web/src 增量：approvals 四件（`QueueCsvExport.tsx` / `RelativeTime.tsx` / `states.tsx` / `views.tsx`）、`employee-detail/EmployeeDetailModulePage.tsx`、新增 `knowledge/knowledge.export.rows.test.tsx`、`runs/RunsModulePage.tsx`、`runs/states.tsx`、`tasks/TasksBoardModulePage.tsx`、`shell/console.tsx`（只 +1 行：`import "../styles/detail.css";`）、新增 `web/src/styles/detail.css` —— 全部由上游带来，我一件未改。capabilities/tools 零改动。
- 现查更正（派工单前提与本代代码不符，逐条贴证据）：① **`?kind=` 本代无人读，第 14 条道确认** —— 全仓 `git grep 'get("kind")|kind='` 只命中 React 的 `kind` prop（`SystemHealthSurface.tsx:454/459/473/485/521`、`ToolsPage.tsx:500-502`、`RunsModulePage.tsx:1555`）、knowledge 的 `data-knn-kind`（`KnowledgeModulePage.tsx:393`）、evidence/knowledge 的文档注释，以及我自己四处测试注释；没有任何 `params.get("kind")`。所以 ① 的「按类型筛」只能落在真实机制 `?q=`（名称本地过滤）上，而 `kind` 的正确行为是**既不参与取值、也不被抹掉**——本文件用判别式钉住：`kind=mcp&q=网页` 若真被读，MCP 段没有名称含「网页」的条目、表体应为空集；实测表体是两行 `data-source="toolset"`，证明筛的是 q。② **`capF` 无计数面**（`capF-count-*` / `capF-row-*` 全仓零命中），计数面是 `cap4-count-<tab>`(+`-state`) / `cap6-export-count` / `cap-page-scope` / `cap5-scope-note`。③ **能力面没有分页参数**（R91 `capabilities.deeplink.test.tsx:204` 已守卫 `page/pageNum/pageNumber/page_size/cursor/nextCursor/offset/limit` 全不出现），所以 ② 的「页码回 1」本代无可复位之物，改为断言这些键一个都不出现。④ **④ 的「清筛选恰 1 次新取数」与产品相反**：搜索是本地过滤（BFF 读口不吃 q），清空只改地址、零请求；按产品断言并在此登记，同一口径也记在 ② 的切回腿。
- 已覆盖只回证据、不写重复用例：搜索框回填已由 `tools/ToolsPage.test.tsx:536`/`:541` 钉住（`.value === "网页"`；R88 `filterparity:301` 只有一句弱 `getAttribute("value")` 非空）；R88 `:281` 用**手工镜像**壳条（字符串替换 tab）保 q/sort/dir 并断言切回零新读；R199 `capabilities.requests.test.tsx` ② 用**真壳条 + 两个真页 live slot**，但它自己注释里写明**故意不带 q**（怕 skills-only 关键词把 tools 列表清空），① 断言请求 URL 无查询串；R140 `capabilities.counts.test.tsx:186`/`:247` 把 `cap4` 值放进三值等式（首载 / 收窄 / 空结果真 0）；R130 `capabilities.empty.test.tsx:197`/`:231` 清空后行数与 `cap-row-copy-*` 序号复原、零请求；R91 `:163` 落空行 `cap-row-missing` + 地址不改写 + `capF` 锚同屏；R197 `capabilities.tab.persist.test.tsx` A1/A2 非法 `?tab=` 折叠与真壳条保参。
- 本文件补的四个真缺口（`web/src/modules/capabilities/capabilities.filter.persist.test.tsx`，3 describe / 4 例）：(a) 外来 `kind` 与 `q` 同到 —— kind 惰性、q 生效、搜索框回填、`cap4`==表体==按钮==scope N，且六条出去请求一个字不多（无查询串、无分页键、无 `kind=`/`toolset=`），地址里 kind 原样存活；(b) **真壳条带着同一个 q 走一个来回** —— 夹具里刻意放一条名为「网页索引」的技能，使两边都有行可数：skills 侧 1 行 → 点壳条到 tools 侧 2 行且搜索框自己回填 → 点回 skills 仍是 1 行、框里仍是那个词、`reads()` 长度不变（R88 是手工镜像，R199 ② 是无 q 版）；(c) 非法 `?kind=__nope__` 单独到达 —— 全量 4 行还在、无空态、无落空通告、页级锚 `tl3-page` 在、地址逐字未被改写、请求集合不变；叠在无匹配 q 上时可读空态只由 q 产生（`capF-state-filter-empty` 文本与 `stateAnchor({kind:"filter-empty",subject:"工具与 MCP 清单",reason:q,loaded:4})` 的 lead+detail 逐字等），kind 仍逐字留在地址里；(d) 清除筛选回全量后 **`cap4-count-tools` 也回到三值等式**（行数 == 按钮数 == 计数值 == scope N），q 被抹掉、搜索框清空、零新请求。
- 自身用例的更正（全部是我写错，产品无缺陷）：② 的尾巴原先断言「整趟地址逐字」为粘贴序 `?tab=skills&q=…`，实测回来是 `?q=…&tab=skills` —— 壳条给**默认 tab** 的链接不带 `tab=`（`shell/routes.ts:173`），落回后由 `useEnsureTabParam` 把 `tab=skills` **追加在末尾**，所以参数集合与取值逐字不变、键序变了（R199 ② 只断集合、没断过字节序）。改为按真实键序断言 + 键集守卫。另删掉未使用的 `settleSkills` helper（TS6133）。
- 验证：新文件 **1 file / 4 passed**；定向 `src/modules/{capabilities,skills,tools}` → **25 files / 193 passed**（开工前 24 / 189 ⇒ +1 file / +4 tests）；`./node_modules/.bin/tsc -b . --noEmit` → exit 2，本域 grep **0**，错误只在 approvals / employee-detail / employees 基线；全量 `npx vitest run` → **288 files / 2984 passed, 0 failed**（exit 0，54.94 s；stderr 只有 jsdom 既有噪声「Not implemented: navigation to another Document」与「Window's open() method」×5）。**新全量基线 288 files / 2984 tests 零红**（286/2979 + 上游 knowledge 带来的一个新用例 + 本单 4 个）。
- 三档 N/A：纯测试，零 markup / CSS 增量，几何证据沿用 R93 的实测（同 R91/R94/R95/R96/R97/R98/R99/R100/R106/R107/R108/R109/R110/R111 的先例）。
- 边界：只动 `web/src/modules/capabilities/capabilities.filter.persist.test.tsx`（新）与本节 `docs/_artifacts/gov/DONE.md`；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops（`shell/console.tsx` 那一行是上游带来的，我只读未改；`ConsoleModulePage` 与 `resolveTab` 在测试里挂载/读取而已）；未 install、未并 main、未重建 9122、未启停任何服务；无 force / amend / `--no-verify`；**零产品码改动**。

## R113 / sys-event-export-body — /system 事件表导出与筛选同源（纯测试，R221）

- 基线：起始 HEAD `8b36f291`（R220 merge，porcelain 0）；显式 refspec SSH fetch → 上游 tip 正是派工点名的 `024bb79eb0d7d916a8f752406c1b44c4c4c6f943`（`merge(lane): ee70ede0 (wave-58)`）；`git merge --no-ff` → merge commit `222b4d9a`，之后 porcelain 0，未用 reset。域内 delta（health/capabilities/skills/tools）EMPTY；上游 web/src 只带三个新测试 `approvals/approvals.columns.lock.test.tsx`、`approvals/approvals.cross.page.test.tsx`、`knowledge/knowledge.export.columns2.test.tsx` 与 `styles/table-density.css`，全部上游所带、非本人改动。远端此前停在 `a1e301c4`，故本次推送一并携带 `8b36f291`/`222b4d9a` 两个本地 merge（只推自分支，未并 main）。
- 交付判定：R220/R219/R218/R217 四单都以「前提不存在」收在 report-only，本单派工明确写「`8b36f291` 只是 baseline merge，R220 本体未交」⇒ 不再 report-only，改为按真实面落盘。文件名与目录遵派工（`web/src/modules/health/system.event.export.test.tsx`），挂载的组件是 `modules/audit/AuditEventsModulePage`（health 模块无事件表，跨模块挂载沿用 R135 `system.filters.test.tsx` 的既有习语，已在文件头声明）。
- 第 17 条道确认：`sys-evt-copy-*`/`sysEventCopyText`/`evt-copy`/`evt-more`/`evt-count` 在 `web/src` 只有 8 处命中，全是既有用例里记录「不存在」的注释（`system.cross.isolation.test.tsx:6/:7/:12`、`system.empty.test.tsx:13`、`system.filters.test.tsx:14`、`system.matrix.export.test.tsx:6`、`system.state.isolation.test.tsx:18`、`system.time.test.tsx:8`）。事件表另有硬事实：它**没有行复制列**——`audit.empty.test.tsx:267` «has no row copy column to offer, and keeps the record copy disabled with its reason» 已钉；逐条复制只有 `audC-copy*`/`aud-detail-copy*`。
- ① 的第三腿按现状重立：不编造 `sys-evt-copy-<i>`，改撞真实唯一的逐行复制 affordance——请求编号列 `aud01-cell-<key>-request-value` 内的按钮。断言「逐行可复制控件数 == 文件第六列非空的行数」（3 行里 2 行带编号），并验证缺值那行不留死按钮、其 `aud01-cell-<key>-request-id` 单元 `innerHTML` 说出「没有回传请求编号」。前两腿照派工原样：CSV 数据行数 == 表体行数 == `aud01-status`「已显示 3 条」== `aud5-export-count`「将导出 3 条」，表头逐字 `时间,类型,结果,操作者,对象,请求编号`，文件名 `^audit-.+-20261120-1400\.csv$`（假时钟钉 `NOW`）。
- ②：30d 宽窗先出一份含陈旧标记（`req-20261118-bbbb`/`55667799`/`值守机器人`/`77889900`/`5b4a3f21`）的文件；点 `aud01-filter-window-24h` 后行集换代为 1 行、参数字典恰 `{tab:"events",window:"24h"}`（tab 一字不动）、状态句「已显示 1 条」；再导出得 2 条记录且**五个陈旧标记一个都不在**——比"行数变了"更强的文件体重算证据；导出点击本身零请求（`urls()` 不变），全程 `listReads()` 恰 2。
- ③：逐行按 DOM 序 == 文件序对撞四格人话——`line[1] === aud01-cell-<key>-type`、`line[2] === -result`、`line[3] === -actor`、`line[4] === -object`（Field 型单元读内层 `dd`，普通单元读 textContent）；类型/结果格不含 `_`（禁裸枚举码）；actor 匹配 `/^.+ · [0-9a-f]{8}$/` 且含「李思」；全文禁 `user:2f3a…`/`employee:1122…`/`employee:9f8e…`/`evt_…`/`ap_…`/`approval_approved`/`run_failed`；缺 rid 行 `records[2][5] === ""`（空 cell，绝不冒充 0）；无 `undefined|null|NaN|[object`。时间两面各按其口径：屏上到秒、文件到分钟，断言 `line[0] === screenTime.slice(0,16)` 且文件格无 `T`/`Z`（R141 :283 已持有该口径，此处只做同面对撞）。
- ④：读口恒返 `{items:[], nextCursor:null}` → 零行 + `aud01-empty`、`aud01-export.disabled === true` 且 title 非空；强点 → `createObjectURL` 调用数 0、Blob 构造数 0、内容与文件名皆空、`urls()` 不变、`aud01-export-status` 空文本。与 R206 :202 «never a Blob» 同口径但落在 `?tab=events` 复合地址上。
- 既有覆盖只回证据不重复：R141 `audit.export.test.tsx` :199/:215/:241/:259/:283/:303/:323；R192 :279/:302/:323/:343；R206 :186/:202/:221/:241；R214 :271/:290/:316/:345；R161 :254/:327/:339/:383/:405；R203 :216/:253/:322；R213 :302/:328；`AuditEventsModulePage.test.tsx` :905-965/:3147-3171/:1643；R137 `audit.parity.test.tsx`；health 侧真导出面（矩阵 `sys7-export`）由 R204 四例钉满。本文件补的三处残差：`?tab=events` 复合地址上的同源、换窗后**文件内容**重算（陈旧标记逐项缺席，不只行数）、以及逐格 CSV↔屏上对撞。
- 自有测试修正 4 处（全测试侧，零产品缺陷）：① 首版把「带编号行数」从屏上文案猜 → 改按文件第六列非空计数；② ② 的陈旧标记用了 `task_3344…`/`run_5566…` 全量 id，而资源标签折成「任务 · 77889900」短码，永不入文件 → 换成实际出现的短码与人名；③ ③ 的格 testid 是 `aud01-cell-<key>-*` 而非 `aud01-row-…-type`（行 testid ≠ 格前缀）→ 由行 testid 推格前缀并加非空锚；④ 缺值原因不在 `-request-value` 的 textContent（`CopyValue` 把它放在他处）→ 改断言 `-request-id` 包装格内无 button 且 `innerHTML` 含原因句；另修一处 tsc TS18048（`rows.find` 结果加 `!`）。
- 验证：新文件 1 file / 4 passed；`npx vitest run src/modules/health` → **20 files / 120 passed**（本单前 19/116，+1 文件 / +4 例）；`./node_modules/.bin/tsc -b . --noEmit` → exit 2，health grep **0**，错误模块只有 approvals / employee-detail / employees（基线）；全量 `npx vitest run` → **298 files / 3017 tests 全绿，0 失败**，但 exit 1 因 2 条 Uncaught Exception——两条都源自上游本批新带的 `knowledge/knowledge.export.columns2.test.tsx` 例④（强点复制时 `navigator.clipboard` 未定义 → `writeText(...).then` TypeError），**独立性已证**：单独跑该文件 → 1 file / 4 passed / 同样 2 errors / exit 1，与本文件无关，属 kn 道自查范围（其测试自身缺 `isSecureContext`/`navigator.clipboard` 桩）。
- 三档 N/A：纯测试，零 markup/CSS 增量；几何证据沿用 R93。
- 边界：只新增该测试文件 + 本节 DONE；未碰 `App.tsx`/shell/routes/registry/package·lock/web-scripts/ops；零产品码改动；无 install、未并 main、未重建 9122、未启停任何服务；禁 force/amend/`--no-verify` 全守；回执不引工作树 entry/sha。

## R114 / sys-event-export-window-clock — /system 事件导出「时间不混读取时刻」补腿（纯测试，R222）

- 基线：起点 HEAD `e576139f`（R221），porcelain 0。显式 refspec SSH fetch → 上游 tip 恰为派工单点名的 `6dc311ea92b02e19117c23465e6c35a14b403f3d`；如实记一笔：该提交的 subject 是 `merge(lane): stamp ab609cc9 (wave-58 seal)`，工单称 wave-59——哈希一致、代次标签差一档，按现状记录。`git merge --no-ff` → merge 提交 `861c77a2`（186 files +1964/−198，绝大多数是 `docs/_artifacts/tonight/**` 取证与 ui-review PNG）；porcelain 0；未用 reset。`git diff --name-only HEAD^1 HEAD -- web/src/modules/{health,capabilities,skills,tools}` → 空。web/src 增量全属上游：approvals ×2（+density.css、新 `approvals.empty.export.test.tsx`）、新 `audit/audit.detail.counts.test.tsx`、新 `audit/audit.fields.edge.test.tsx`、knowledge ×3（新 empty.export / space.parity、`knowledge.css`、以及下面那条 columns2 修桩）、metrics ×2。本车道一行未改。
- 这是同一派工单的第三张单（R155 → R220 → R221）。R221 已交 `e576139f`：`web/src/modules/health/system.event.export.test.tsx` 四例即工单的 ①②③④（本文件 :232 / :267 / :306 / :356）。本轮 pre-check 结论：①②④ 与 ③ 前半**已覆盖，只回证据不重写**；唯一新子句是 ③ 的「时间不混 `sys-updated-at`」。
- pre-check 现查（`861c77a2` 上实测）：`sys-evt` 族 grep 命中 11 处、全是既有注脚（含本文件自己的 :5/:6/:252），不存在已是第 18 条道；`git grep -n "sys-updated-at" -- web/src` 在产品码里只剩 `health/rowCopy.ts:13` 一句注释——该锚由 `systemRefresh.tsx` 渲染在 health 页，事件面上不存在，「不混」按现状拆成两件事钉：本面零枚该锚 + 数据行零携带读取时钟。上游新到的 `audit.detail.counts.test.tsx`（他们车道标 R222 ①-④：开记录不动三计数 / 合上复原 / 深链同句 / 详情失败可复制 rid 重试恰一次）与 `audit.fields.edge.test.tsx`（他们标 R215 ①-④：缺失词四面 / 120+ 字符资源截断 vs 全文 / 死链句子+rid / 筛选第二页开合只多一笔详情读）钉的都是别的维度，与本单四例无重叠——编号撞车如实记，各写各的。
- 补的一例（同文件第五 describe）：假时钟 `2031-03-01T00:00:00Z` 挂 `/system?tab=events&window=30d` → 断言 `[data-testid='sys-updated-at']` 与 `sys-refresh*` 族在本面零枚；三条屏上时间格逐个验为事件自己的 2026 时刻（`/^2026-…:\d{2}$/`）；导出捕获后每条数据行时间格 === 屏上值 `.slice(0,16)`（屏上到秒/文件到分的既有双口径，R153 持有），且**任何一格不含「2031」**；全文不含「2031」、不含「刷新完成于」；文件名戳合法跟随读取时钟（`/^audit-.+-20310301-0800\.csv$/`——本表唯一被允许的读取时刻 token）；导出点击零请求、全程只有首载那一问列表读（`listReads()` === 1）。首跑即绿，零自测修正。
- 上游顺带修了 R221 报告过的 2 条 Uncaught：`knowledge.export.columns2.test.tsx` 的 `writeText` 桩改为 `mockResolvedValue(undefined)`（其注释：产品 `copyList`/`copyHits` 对 `writeText(...)` 直接 `.then`，裸 `vi.fn()` 返回 undefined 会在 unhandled 里炸——修桩不修产品，归因与本报告一致）。本轮全量复核证实：两条错误消失。
- 验证：新例并入后本文件 1 file / **5 passed**；定向 `src/modules/health` → **20 files / 121 passed**（任务前 20/120，+1 例）；`./node_modules/.bin/tsc -b . --noEmit` → exit 2，`grep -c modules/health` = **0**，错误模块仍只有 approvals / employee-detail / employees（基线）；全量 `npx vitest run` → **exit 0，303 files / 3035 passed，0 failed**（新基线；上游 wave-58 seal 带入 5 个新测试文件并修掉 kn 桩，本车道 +1 例）。stderr 仅既有 jsdom 噪音（navigation / open()）。
- 三档 N/A：纯测试，零标记/样式增量，几何沿用 R93 证据。
- 边界：只动 `web/src/modules/health/system.event.export.test.tsx` 与 DONE；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops；零产品码改动；未 install、未并 main、未重建 9122、未启停任何服务；无 force / amend / --no-verify。

## R115 / cap-cross-filter-guards — /capabilities 工具集与筛选交叉一致性（纯测试，R223）

- 基线：起始 HEAD `c7031a5e`（R222）porcelain 0；显式 refspec SSH fetch → 上游 tip 恰为派工单点名的 `65882219a3542d1ae4c6fc76c057c202cff50dfa`（`merge(lane): fee89d13 (wave-60)`）；`git merge --no-ff` → merge commit `07cd6d00`，之后 porcelain 0，未用 reset。`git diff --name-only HEAD^1 HEAD -- web/src/modules/{capabilities,skills,tools,health}` 为空——域内零改动；本轮落地的全是上游带来的：新测试 `approvals.detail.missing` / `audit.chips` / `audit.detail.counts` / `audit.detail.direct` / `knowledge.preview.detail` / `knowledge.space.paging2`，源码 `employee-detail`、`employees`（+density css）、`runs`（+density css）。
- 先查既有用例（派工单纪律，`git grep` 于 `07cd6d00`）：R216 `capabilities.filter.persist.test.tsx` :263（kind 惰性 + 四值 + 六条裸路径 + 参数逐字，tools 侧）、:288（真壳条带 q 往返、零重取）、:340（非法 kind 不改写地址、叠 q 空态锚）、:369（清空复原四值零新请求）；R215 `capabilities.counts.drilldown.test.tsx` :211/:226/:248/:268（分区三值、一段收窄、往返零重取、`?row=` 深链）；R140 :167/:186/:212/:247；R130 `capabilities.empty.test.tsx` :164-:257；R199 `capabilities.requests.test.tsx` :275（请求 URL 纯净：skills 1 条 / tools 6 条，不带任何查询串）/:304/:354/:393/:429；R91 :130-:248；R184 :184/:230；R188 :226-:312；R88 :173-:351；R128/R87 各行复制与 parity；R197 :247/:280/:309/:328。
- 口径更正一（①「请求逐字带三参」与产品相反）：本代请求就是读口裸路径，`kind`/`q` 只活在页面地址里——R199 :275 已钉「not one URL carries a query string」，R216 :263 已钉六条裸路径逐字集合。按产品断言：三参在地址上逐字存活，请求保持裸路径；未造第二个口径。
- 口径更正二（③`?toolset=<id>` 不存在，第 15 条道确认）：全仓 grep 只有 `/api/tools/toolsets` 路径与行字段 `source:"toolset"`，无 `params.get("toolset")`；也没有工具集卡片/子表——下钻只有行详情 `cap7-detail-tools`。诚实改写为「外来 kind 叠在收窄到单一工具集的 q 上时，分区内三值（段头==段内行==段内按钮）各自闭合、另一段自同步」，并引 R215 :226 为既有单 q 证据。
- 口径更正三（`capF` 无计数面）：`capF-*` 只有状态锚；计数面是 `cap4-count-<tab>`(+`-state`)、`cap6-export-count`、`cap-page-scope`、`cap5-scope-note`。断言按真实锚写。
- 三个真空隙由新文件 `web/src/modules/capabilities/capabilities.cross.test.tsx`（3 describe / 3 it）补齐，全绿：(a) **kind 过真壳条且带 live slots**——R216 :288 只带 q，R197 :280 带 kind 式参数但不挂 live 页；本例在 `?tab=tools&kind=mcp&q=网页` 挂载 `ConsoleModulePage live={{skills,tools,…}}`，tools 腿分区闭合（toolset 段 2==2==2、mcp 段 0/0/头 0 或 −1、kind 惰性判别式），切 skills 后 `kind`+`q` 逐字保留（地址键序 kind→q→tab：默认 tab 壳条链接不带 `tab=`，`useEnsureTabParam` 在末尾写回——集合与取值不变），读口为 tools 六条 + skills 一条，切回零新请求且分区面复原；(b) **叠址空态的门禁**——R216 :340 钉了锚/参数，R130 :214 钉了纯 q 无 kind 的 disabled；本例补 `?kind=__nope__&q=不存在的词` 叠址：锚逐字 == `stateAnchor(...)`、地址逐字、`cap6-export`/`capC-copy` `.disabled===true` 共享「当前没有可导出的条目。」、强点后剪贴板未被调用且请求数停在六条、无 fallback 节点、计数真「0」；(c) **skills 侧外来 kind**——`?tab=skills&kind=__nope__&q=网页` 只付一条 `SKILLS_URL`，kind 惰性（1 行「网页索引」），四值同源，参数含 kind 逐字，URL 纯净。
- 首轮即绿：3/3 通过，零自测修正、零产品缺陷发现、零产品码改动。
- 验证：新文件 1 file / 3 passed；定向 `src/modules/{capabilities,skills,tools}` → **26 files / 196 passed**（任务前 25/193，+1/+3）；`./node_modules/.bin/tsc -b . --noEmit` → exit 2，本域 grep 0，报错仅限 approvals / employee-detail / employees 基线；全量 `npx vitest run` → **309 files / 3057 passed, 0 failed**（exit 0；新基线——R222 时 303/3035，wave-60 并窗带来约 6 个上游测试文件，本单 +1/+3）。jsdom 既有噪音仅 「Not implemented: Window's open() method」。
- 三档 N/A：纯测试，零 markup/CSS 增量；几何证据沿 R93。
- 边界：只动 `web/src/modules/capabilities/capabilities.cross.test.tsx`（新）+ 本节；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops（shell 与 routes 仅在测试里挂载与只读）；未 install、未并 main、未重建 9122、未启停任何服务；未 force / amend / --no-verify。

## R116 / sys-window-isolation-guards — /system 事件表活跃期间矩阵与 health 读口零污染（纯测试，R224）

- 基线：起点 HEAD `ac9b04a8`（R223）porcelain 0；显式 refspec SSH fetch 后上游仍恰为派工点名的 `65882219a3542d1ae4c6fc76c057c202cff50dfa`（`merge(lane): fee89d13 (wave-60)`，已由 R223 基线 merge `07cd6d00` 带入）；`git merge --no-ff` → Already up to date，无新 merge 提交；未用 reset。`web/src/modules/{health,capabilities,skills,tools}` 零增量（本代无任何新源文件）。
- 先 `git grep` 现查（订单纪律）：**`sys-evt` 族第 19 次确认不存在**——12 处命中全是既有测试里的缺席备注（`system.cross.isolation.test.tsx:6/:7/:12`、`system.empty.test.tsx:13`、`system.event.export.test.tsx:5/:6/:46/:260`、`system.filters.test.tsx:14`、`system.matrix.export.test.tsx:6`、`system.state.isolation.test.tsx:18`、`system.time.test.tsx:8`）。health 无事件表、也不读 `?window=`（产品侧读者仅 `audit/AuditEventsModulePage`、duty、runs）⇒ ②「只切矩阵读源时间窗」无机制，如实改形为「切事件表的窗时矩阵存储面一字不动」。
- 无人把 HealthPage 与 AuditEventsModulePage 挂在一起测过：`git grep -ln AuditEventsModulePage -- web/src/modules/health` 仅备注或 audit 单挂（R135/R221/R222）；`git grep -ln HealthPage -- web/src/modules/audit` 为空；shell live slot `App.tsx:1625` health vs `:1628` events 互斥。R210 `system.cross.isolation.test.tsx` 钉的是 health 内部同批双失败（:199-229 各自 rid、:274-285 双恢复），不是跨面。
- 三个真空隙由本文件补：①事件表活跃期间 health 四条读口零流量、矩阵存储面逐字冻结（切窗只多发它自己的审计读，health 路径计数不动）；②审计读 500 只点亮 `aud01-error`（自身锚 + rid 可读），绝不清矩阵成 0 行、不写「—」、不点亮 health 族锚（`sys-refresh-error`/`sys-state-*` 均 null）；③回 health 重读一整批进新一代（产品真相：health 页没有模块级缓存，与 capabilities 的 tab 缓存相反——①的「切回零增」按产品如实倒置为「离开零增、回来整批」），且刷新时刻 `sys-updated-at` 仍不等于任何采集时刻面。
- 探针设计：`StoreProbe` 直接订 `useSourceMatrix()` 渲染 `probe-<id>` = `status|asOf|requestId`（耗时字段刻意排除以躲 ms 抖动；`probe-` 前缀避开页面自身 `sys6-*` 重复；读 STORE 所以不需要 `sys6-toggle` 展开）。
- 自有测试坑（本轮实测，非产品缺陷）：`mount()` 内部会 `arm()` 默认 handler——在 mount 之前装的失败 handler 会被静默替换，窗点击只是成功重绘，`aud01-error` 永不落地（实测：读发出、行保留、无错误锚）；必须 mount 之后再 `arm()` 可切换的失败闭包（`arm` 只换实现不清调用史，计数仍可比）。另：块注释里写 `sys3-*/…` 之类 glob 会把注释提前关掉导致 BabelError Unexpected token，已改写。
- 验证：新文件 1 file / 3 passed；定向 `src/modules/health` → 21 files / 124 passed（任务前 20/121，+1/+3）；`./node_modules/.bin/tsc -b . --noEmit` → exit 2，`grep -c modules/health` = 0（一处 TS7053 由 `keyOf` 返回 `string` 改为 `SourceKey` 联合解决），错误模块仅 approvals / employee-detail / employees 基线；全量 `npx vitest run` → exit 0，310 files / 3060 passed，0 failed（新基线；wave-60 后 R223 为 309/3057，本单 +1/+3）。
- 三档 N/A：纯测试，零标记/样式增量；几何自 R93 起成立。
- 边界：只动新测试文件 + 本节；App.tsx / shell / routes / registry / package·lock / web-scripts / ops 未动（shell 仅测试内只读挂载）；未 install、未并 main、未重建 9122、未启停任何服务；无 force/amend/--no-verify；零产品码改动。

## R117 / sys-event-rows-paging — /system 事件表翻页与窗口叠加护栏（纯测试，R225）

- 基线：显式 refspec fetch 后 `git merge --no-ff origin/lane/hermes-console`，上游 tip 恰为派工点名的 `43d83d65cb76b6df8886de992a2398aab5f47541`（`merge(lane): b009bb92 (wave-62)`）；该代次已由上一单基线合并 `94d3cf7e` 带入，本轮 merge 报 Already up to date。未用 reset。`git diff --name-only HEAD^1 HEAD -- web/src/modules/{health,capabilities,skills,tools}` 只有上游带来的 `tools/tools.css` 密度块，`modules/health` 零改动。
- 派工前身：同一编号位的上一单（`system.cross.isolation2.test.tsx`）零落盘、未开工，由本单取代（R163→R171 先例）。
- 前置查重（`git grep` 现查）：`sys-evt` 族第 20 条道确认不存在 —— 16 处命中全是既有用例里的「本代不存在」注释或我自己的缺席断言（`system.cross.isolation.test.tsx:6/:7/:12`、`system.empty.test.tsx:13`、`system.event.export.test.tsx:5/:6/:46/:260`、`system.filters.test.tsx:14`、`system.matrix.export.test.tsx:6`、`system.state.isolation.test.tsx:18`、`system.time.test.tsx:8`、`system.window.isolation.test.tsx:6/:7/:231/:299`）。产品侧 health 无事件表、不读 `?window=`。
- 两条口径更正（派工前提与产品相反，上游 R161 自己的头注已记录）：②「重叠行按 id 去重 == 去重后并集」不成立 —— 每次筛选变更把行清成 `INITIAL` 整页替换，`goNext` 先 `resetPagingAndFolds` 删 cursor 再 append 一枚，地址游标栈最多一枚，屏上永远是「这一页」而非并集；真正的 append 路径 `list.loadMore`（`rows: [...prev.rows, ...page.rows]`，无 id 去重）在当前 UI 不可达，它唯一的重试调用点在 `aud01-page-failure` 内部，而该锚只在下一次 append 失败后才渲染。③「第 2 页 500 保旧行」同理是 append 腿的承诺：走 `aud01-load-more` 的失败是非 append 失败，行被清空、面板上屏（`audit.paging.test.tsx:339` 钉住，:361 断言 `aud01-page-failure` 为 null）。⇒ ②③ 不重写，只回证据。
- 既有覆盖引用（不重复）：上游 R161 `audit/audit.paging.test.tsx` ①:218/:243、②:254/:280、③:303/:327、④:339/:361、⑤:383/:405。
- 两处真缺口（本单只写这两处）：(a) ① 的行集侧在 `?tab=events` 复合地址上没人钉过 —— 翻到第 2 页后切窗，断言行集换代（两枚旧行零残留、Set 尺寸唯一）、页码回「第 1 页」、`aud01-status` 与 `aud2-page` 两枚读数条同步到表体同数、`aud2-prev` 重新 disabled、请求 `cursorsOf === []` 且 `windowHours === 24`、字面 +1 一次读、`listReads()` 累计 3、地址 `window` 落 24h 且 `tab=events` 原样；(b) ④ 的 `sys-evt-copy-<i>` 不存在，按真实逐行 affordance 重构成 `aud01-cell-<key>-request-value`（裸行为 `-request-value-absent`）—— 翻页与切窗两次重排后控件集与屏上行 DOM 顺序一一对应、缺 rid 的行不给死按钮且注脚逐字「该字段未返回」/ title「服务这次没有回传请求编号」，复制文本 = 该行自己的 rid（屏上文本 === title === 剪贴板；R31 折叠只对 32-hex 与 scheme handle 生效，故选破折号形态 rid 使三处同形），复制零新增请求。
- 跨道挂载声明：文件按派工落在 `modules/health/`，被测试的组件是 `modules/audit/AuditEventsModulePage`（R135 / R221 同一习语）；壳层与审计源码只读挂载，未改一字。
- 验证：新文件 1 file / 2 passed（exit 0，1.99 s）；定向 `src/modules/health` → **22 files / 126 passed**（开工前 21/124，+1 file / +2 tests）；`./node_modules/.bin/tsc -b . --noEmit` → exit 2，`grep -Ec modules/health` = **0**，报错文件仅 approvals / employee-detail / employees（既有基线）；全量 `npx vitest run` → **321 files / 3091 passed, 0 failed**，exit 0（wave-62 合并后的全量首次实测即在本单落地，此前只有开工前基线 310/3060）。零产品代码改动。
- 三档 N/A：纯测试，无 markup/CSS 增量；几何证据沿用 R93。
- 边界：只新增本测试文件 + 本节；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops；未 install、未并 main、未重建 9122；未 force / amend / --no-verify。

## R118 / filename-strip — 导出文件名裸子串撞时钟的既有测试修复（他道真缺陷，R227）

- 基线：起点 HEAD `d1a419b3`（R225/R117），porcelain 0。显式 refspec SSH fetch → 上游 **恰为 `3c3150d1423d60c4d3fdf6568af48531a1ed6b5a`**，subject `3c3150d1 merge(lane): 23f8625c (wave-63)`，即派工单点名的 tip。`git merge --no-ff origin/lane/hermes-console -m "merge(console): sync filename strip baseline"` → merge commit **`3fb841c7`**，192 files +1168/−202；之后 porcelain **0**；未用 reset。`git diff --name-only HEAD^1 HEAD -- web/src/modules/{health,capabilities,skills,tools}` → **空**（写域零增量）。上游带来的 `web/src` 文件只有：新 `approvals/approvals.panel.detail.parity.test.tsx`(+318)、`approvals/states.tsx`、新 `audit/audit.export.empty.test.tsx`(+305)、`audit/AuditEventsModulePage.tsx`、`audit/views.tsx`、新 `knowledge/knowledge.detail.error.isolation.test.tsx`(+231)、`knowledge/knowledge.css`、`web/src/styles/table-density.css`；其余为 `docs/_artifacts/tonight/**` 取证与 `docs/_artifacts/ui-review/**` 新 PNG、`ui1/KNW5-RETRIEVAL-EVIDENCE.md` +53、`D/DONE.md` +7。
- 归属核对（派工单给的逃生分支未触发）：`web/src/modules/skills/SkillsPage.test.tsx` 与 `web/src/modules/tools/ToolsPage.test.tsx` 都在本仓、且在本道写域内（历史上由本道改过：R128 给 `SkillsPage.test.tsx:118` 的表头数组加了「复制」，R86/R88 批次也改过这两文件），所以按第 3 种交付形态（改用例）落地，不回 2 行归属说明。
- 根因（grep 实测）：页内导出文件名预览渲染 `capabilities-<tab>-<q|all>-<sort|default>-<dir|default>-YYYYMMDD-HHmm.csv`，来自 `capabilities/csv.ts` `exportFilename({tab,q,sort,dir}, now = new Date())`（:43-57：Intl `sv-SE` / `timeZone:"Asia/Shanghai"` / `year:"numeric"` / `month`/`day`/`hour`/`minute` 各 2-digit / `hour12:false`，拼 `${year}${month}${day}-${hour}${minute}` 再缀 `.csv`；`exportSegment` 只放行 `[a-z0-9.-]+` 否则折成「default」）。这些数字落进整页文本，于是裸状态码断言按时钟抖动：HHmm `0403`/`1403` 撞「403」、`0404`/`1404` 撞「404」、`0500`/`1500` 撞「500」，或 YYYYMMDD 里含这三元组。
- 修法（只改用例，产品与文件名预览本身一字不动）：两文件各加一个剥形 helper，五个裸子串断言改走它。
  - `skills/SkillsPage.test.tsx`（在 `const text = () => container.textContent ?? "";` 之后）：`const textNoFileName = () => text().replace(/-\d{8}-\d{4}\.csv/g, "");`，注释写明「导出文件名预览带着真实时钟，它的数字会落进整页文本；状态码类的不出现断言必须先剥文件名字形，否则分钟撞上 0403/0404 就是假红」。
  - `tools/ToolsPage.test.tsx`（在 `const text = (): string => document.body.textContent ?? "";` 之后）：同一 helper，带显式 `: string` 返回类型，注释点名 0403/0404/0500。
  - 五处目标：skills it「puts the GAP id only in the title when the endpoint is missing」（夹具 `ApiError("missing", {status:404, body:"", url:"/agent-api/api/skills"})`）的 `not.toContain("404")`；skills it「renders 403 and 404 with the same neutral body and no status code」（夹具 `ApiError("denied", {status:403, …})`）的 `not.toContain("403")`；tools 403/denied 用例尾的 `not.toMatch(/\/api\/|403|GAP-04/)`；tools「both 404 routes use the same neutral not-wired body as 403」的 `not.toMatch(/\/api\/|403|404|GAP-04|字段示例/)`；tools「500 shows human copy, a copyable request id and a working retry」的 `not.toMatch(/500|boom|\/api\//)`。
- 故意不动的断言（grep 逐个核为安全：节点作用域或非数字）：skills :233「GAP-」、:359/:639「质检」、:408「表内全量渲染」、:568「2026-11-19」、:611-:617「skillId」/「ownerUserId」/「sharedWith」/「/api」/「HTTP」/`\bGAP-`/「skill-12345678」、:156/:249/:277 的 `count.textContent`「0」、:209「0」、:131「2」、:361/:363「1」/「1 条」；tools :218-:220、:309 `count.textContent`「0」、:311「无源」、:333 `/Unexpected token|<!doctype|HTTP|\/api\//i`、:345-:347 密词、:391「0」、:419「99」（节点作用域，且「99」不可能出现在 HHmm/YYYYMMDD）、:651/:697「创建看板」、:654「2 条」、:759 css。
- 时钟触发是**算出来的**，不是跑出来的红：测量时本机 `date` = 2026-11-21 04:11 CST，全量在此刻是绿的，所以按产品同一契约（Intl `sv-SE` Asia/Shanghai `year:"numeric"` `hour12:false`）对三个固定时刻复算：BJT 04:03 → `capabilities-tools-all-name-asc-20261121-0403.csv`（含「403」）、04:04 → `…-0404.csv`（含「404」）、05:00 → `…-0500.csv`（含「500」）；三例的旧守卫都会命中假红，而 `replace(/-\d{8}-\d{4}\.csv/g, "")` 后文件名整段消失、状态码不再出现（`oldGuardWouldTrip:true / newGuardSeesCode:false / stripRemovedName:true` ×3）。副产品一条：把年份写成 `year:"2-digit"` 会得到 6 位日期段（`261121-0403`），此时剥形正则**不匹配**——契约是 8 位，`csv.test.ts` 里钉的 `capabilities-skills-all-default-default-20261120-0615.csv` 也是 8 位，两处一致才成立。
- 验证（逐条实测）：定向 `cd web && npx vitest run src/modules/skills` → **1 file / 28 passed**，1.11 s；`npx vitest run src/modules/tools` → **2 files / 41 passed**，1.19 s；`./node_modules/.bin/tsc -b . --noEmit` → **TSC_EXIT=2**，`grep -Ec 'modules/(skills|tools)'` → **0**，报错文件只落在 `src/modules/approvals`、`src/modules/employee-detail`、`src/modules/employees`（长期基线，非本域，不宣称 tsc 全局 0）；全量 `cd web && npx vitest run` → **FULL_EXIT=0，324 files / 3100 passed, 0 failed**，40.92 s（stderr 只有既有 jsdom 噪音「Not implemented: navigation to another Document」「Not implemented: Window's open() method」×5）。基线对照：合并前 321/3091，本次上游带来 3 个测试文件 → 324/3100，本单净增 0 用例（只改断言写法）。
- 三档 N/A：纯用例改动，零 markup / CSS 增量，几何证据沿用 R93 与后续各档实测。
- 边界：只改 `web/src/modules/skills/SkillsPage.test.tsx`、`web/src/modules/tools/ToolsPage.test.tsx` 与本节 `docs/_artifacts/gov/DONE.md`；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops；未 install、未并 main、未重建 9122、未启停任何服务；未 force / amend / `--no-verify`；零产品码改动。

## R119 / sys-event-combo-guards — /system 事件表时间窗×tab 组合（纯测试，R228）

- 基线：起点 HEAD `079d4244`（R227/R118），porcelain 0。显式 refspec SSH fetch → `origin/lane/hermes-console` 正是派工单点名的 `3c3150d1423d60c4d3fdf6568af48531a1ed6b5a`（`3c3150d1 merge(lane): 23f8625c (wave-63)`）；`git merge --no-ff` → **Already up to date**（该代次已随 R227 的 `3fb841c7` 并入），无新 merge 提交、未 reset、事后 porcelain 0。
- 先 `git grep` 查重（派工单纪律）：**`sys-evt` 族本代不存在 — 第 21 条道**，19 处命中全部是既有用例里的「不存在」注释或我自己的缺席断言：`system.window.isolation.test.tsx:6/:7/:231/:299`、`system.cross.isolation.test.tsx:6/:7/:12`、`system.empty.test.tsx:13`、`system.event.export.test.tsx:5/:6/:46/:260`、`system.event.rows.test.tsx:6/:7/:207`、`system.time.test.tsx:8`、`system.matrix.export.test.tsx:6`、`system.state.isolation.test.tsx:18`、`system.filters.test.tsx:14`。产品代码零命中 ⇒ ①的 `sys-evt-count` / `sys-evt-copy-<i>` 两条腿无对应物，只断言缺席、不编造。`window=7d` 库存：health 侧没有任何用例挂 `?window=7d` 地址，audit 道在裸 `/audit` 路径上大量钉 7d。
- ① **已覆盖，只回证据不重写**：R135 `system.filters.test.tsx` 例①（`/system?tab=events&window=24h` → 按下态、恰一笔列表读、`requestedBounds` 逐字等 `windowBounds("24h", NOW)`、地址一字不动、页级锚在）与例③b（非法 `?window=` 折成 `DEFAULT_WINDOW="7d"`、URL 不改写、一笔默认界读）；R225 `system.event.rows.test.tsx` 例①（复合地址上 `aud01-status`「已显示 N 条」/`aud2-page`「第 1 页 · 已加载 N 条」/`aud2-total`「总数不可用」/`aud2-prev` disabled/零 `sys-evt*`）。7d 到达只是这两半的第三个实例 ⇒ 引用，不重复。
- ② **真缺口：翻页之后 events → health → events 的往返**，此前无人做过（R224-first 只钉 health→events 与 events→health）。口径更正：事件面**没有模块缓存**（`useAuditData` 是逐实例 state），且 shell 的 health/events 是互斥 live 槽（`App.tsx:1625` vs `:1628`）⇒ 切回 events 必然重挂并多发它自己一笔审计读；「行集与页码不变」靠 shell `preserve` memo 把 `cursor=` 留在地址里（R161 例① :243 的冷地址先例），不靠组件状态存活。派工单的「切 tab 本身零新增请求」对**离开**方向成立、对**返回**方向与产品相反，断言消息里如实写明。新用例钉：第 2 页行集 `[MID, TAIL]` 逐字复原且 Set 大小相等、`aud2-page` 仍是「第 2 页」、末笔读带 `cursor=cur_rows2`、地址仍含它、`auditReads()` 恰 +1、`probeFaces()` 全程逐字不动（矩阵只由 health 四读书写）、`healthReads()` 在 events 期间零增、零 `sys-evt*`。
- ③ **两半都是口径更正，新钉的是没人碰的那条腿**：非法窗的 URL/锚/默认界半 = R135 例③b（引用）；「矩阵落入可读空态」与产品相反 —— 读源矩阵根本不吃 `?window=`（产品读者只有 audit/duty/runs），非法 token 对矩阵是惰性的，它照旧满员（4 行、`sys6-summary`「4 个读口 · 成功 4 · 失败 0 · 读口未接入 0」、无 `sys-search-source-empty`、无 `sys3-empty`、四张存储面全 `ok|` 且不含 `|—|`）。新腿：空答复在非法 token 下报的是句子不是裸 0（`aud01-empty` 在、`aud01-status` 非空且不含「0 条」、整页不含「共 0 条」），且请求恰一笔、无 cursor、`from/to` 逐字等默认窗界、请求里根本没有 `window` 键。
- 附带实测口径：切回 health 后地址是 `/system?window=__nope__` —— tab 条上默认面板（health）的链接不带 `tab=`（`shell/routes.ts`），所以切 tab 只丢 `tab=`，非法 token 原样活着；这就是「两侧都不串写对方参数」的可观测形态。首稿把它写成 `toBe(entry)` 是错的，按实测值改正。
- 跨面挂载习语（R135/R221/R224-first 同例）：文件按派工单落在 `modules/health/`，被挂载的组件是 `HealthPage` + `AuditEventsModulePage` + `ConsoleModulePage`（后两者只读挂载，未改一字）；harness 克隆 R224-first：hoisted `api.fetchJSON` 平对象 mock `@/lib/api`、hoisted clipboard mock、裸 `@nous-research/ui` mock、`StoreProbe` 订 `useSourceMatrix()` 渲染 `probe-<id>` 的 `status|asOf|requestId`（故意不含耗时，避开逐读抖动）、迭代封顶 `waitFor` 600 × 5 ms（本文件冻 `Date`，`Date.now()` 截止式会空转到 15 s 被杀）。
- 自带用例修正两处：① 地址断言按实测改为 `/system?window=__nope__`（见上）；② `keyOf` 的联合含 `"audit"`，直接索引只带四个 health 键的 `GEN1` 触发 2 × TS7053 → 新增 `type HealthKey` + `healthKeyOf()`，两处非 audit 腿改用它。均为用例侧，零产品缺陷。
- 验证：新文件 1 file / **2 passed**（1.91 s）；定向 `npx vitest run src/modules/health` → **23 files / 128 passed**（任务前 22/126，+1 文件 / +2 例）；`./node_modules/.bin/tsc -b . --noEmit` → TSC_EXIT=2，`grep -Ec 'modules/health'` → **0**，报错模块只有 `src/modules/approvals` / `employee-detail` / `employees`（基线）；全量 `npx vitest run` → **FULL_EXIT=0，325 files / 3102 passed, 0 failed**（33.13 s；stderr 只有既有的 jsdom「Not implemented: navigation to another Document」/「Window's open() method」噪声）。新全量基线 **325 / 3102，零红**。
- 三档：N/A —— 纯测试，零 markup/CSS 增删，几何结论沿用 R93。
- 边界：只动 `web/src/modules/health/system.event.combo.test.tsx`（新）与 `docs/_artifacts/gov/DONE.md`；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops；未 install、未并 main、未重建 9122、未启停任何服务；无 force / amend / `--no-verify`；零产品代码改动。

## R120 / sys-cross-failure-isolation — /system 两表刷新失败互不污染（纯测试，R229）

- 基线：起始 HEAD `bf4864dd`（R228/R119），`git status --porcelain | wc -l` → 0。显式 refspec SSH fetch → `origin/lane/hermes-console` = **恰 `d5c886f5c2da31cdc1ee1dbe81e4a282454148f5`**，subject `d5c886f5 merge(lane): daed853d (wave-65)`，即派工单点名的章笔。`git merge --no-ff origin/lane/hermes-console -m "merge(console): sync cross failure isolation baseline"` → 合并提交 **`6503cb92`**，22 文件 +1826/−8；此后 porcelain **0**；未用 reset。
- 写域增量（本单唯一被上游碰到的域文件）：`git diff --name-only HEAD^1 HEAD -- web/src/modules/{health,capabilities,skills,tools}` → **只有 `web/src/modules/health/health.css`**，上游带来、非我改。其实读是纯追加块（796-807 行）：一段 wave-64 密度收口注释 + 恰好一条规则 `[data-testid="sys3-table"] tbody > tr { height: var(--table-row-h-compact) !important; }`。diff 全是 `+` 行，没有任何既有字符串被改动 ⇒ 无 `toContain` 类 CSS 断言可被打破；`.sys-row-copy*` 规则与 `sys6-scroll` 横滚壳原样不动。其余 `web/src` 增量全属上游：`approvals/ApprovalsPendingModulePage.test.tsx`、新 `approvals.export.order` / `approvals.history.window` / `audit.actor.resource` / `audit.time.window.parity` / `knowledge.copy.parity` / `knowledge.copy.visibility` 测试、`runs/RunsModulePage.tsx`、`runs/states.tsx`。
- 派工面第 22 条道确认：`git grep "sys-evt|sysEventCopyText|evt-copy|evt-count" -- web/src` → 23 处命中，全部是既有用例里的「本代不存在」注释或我自己的缺席断言（`system.window.isolation:6/:7/:231/:299`、`system.cross.isolation:6/:7/:12`、`system.matrix.export:6`、`system.state.isolation:18`、`system.time:8`、`system.empty:13`、`system.filters:14`、`system.event.combo:6/:12/:304/:347`、`system.event.rows:6/:7/:207`、`system.event.export:5/:6/:46/:260`）。零产品代码 ⇒ ② 的 `sys-evt-count` 无对应物，只断言其缺席，绝不编造。
- ② 的诚实重述：health 与 events 是互斥的 shell live slot（`App.tsx` 的 `health:` vs `events:`），health 活跃时事件面根本未挂载，「事件表行数不变」在屏上没有对应物。可测形态是：health 单读源首载失败（旗标在 mount 前设好）→ `sys3-error` + `sys6-row-health` failed + `sys6-rid-health` 的 title 带完整 rid + `sys6-summary` 「4 个读口 · 成功 3 · 失败 1 · 读口未接入 0」 + `sys6-asof-health` 「—」 + `sys-updated-at` 为 null；再切到事件表 → 审计面只花自己那一笔读、照常画行、`aud01-status` 含「已显示 1 条」、不亮任何 `aud01-error`，`healthReads()` 一字不动，`probeFaces()` 与失败快照逐字相同（审计侧从不写矩阵存储）。此前无人做过 health-FAIL → events（R224-first 做的是 health-green → events，以及 events-fail while health green；R228 的往返两侧都绿）。
- ① 的既有覆盖与两条新腿：锚隔离本身已由 R224-first 用例 2 钉住（`aud01-error` 亮起、body 含 `req-iso-audit`、store 面不动、`sys-refresh-error`/`sys-state-state` 为 null、healthReads 仍 4、重试后复原）。本单新写的是：(a) 审计错误锚里那枚 rid 复制按钮**真的被点**——`RequestIdLine`（`audit/states.tsx:554-561`）经 `CopyValue` 用的是可 mock 的 `copyTextToClipboard`，全仓无任何用例点过它（R161 例④ / R213 只断言按钮存在），点下后剪贴板拿到的是**完整 rid** 且零额外请求；(b) **屏上**矩阵面——R224 只读了 store 探针，从未断言可见的 `sys6-row-*` 整行文本与 `sys6-asof-*`/`sys8-asof-*` 单元格，本单以 `\d+ ms` 折叠后的整行快照 + asOf 面映射在切回 health 后逐字对撞。
- ③ 是真缺口：R210 钉的是 WITHIN-health 同批双失败/双恢复（:199-229 / :274-285，两枚 `sys6-rid-*` 各自独立、`sys-refresh-error` 计数 1），不是跨面；R224-first 只失败审计侧。本单写的是同一会话里顺序双失败 → 两枚锚各自独立、两枚 rid 各自可复制、审计恢复不动 health 的失败面、health 重试只发那一笔、恢复后 `sys-updated-at` 只在点刷新时写且不含任何数据面的 asOf（假时钟 2030-06-01 08:00）。
- 习语与坑（供后续同域用例复用）：(1) 用模块级 `flags` 对象按引用被单个 `switchable` handler 读取，`arm()` 只装一次实现——避开记录在案的「`mount()` 内部 re-arm 会静默替换先前装的失败闭包」坑，翻旗标即生效无需重装；(2) 本文件的 `keyOf` 联合含 `"audit"`，但 audit 腿早退后再 `GEN1[key]`，TS 收窄通过 ⇒ 不需要 R228 那样的 `HealthKey` 转换器（R228 是单行三元式才吃 TS7053）；(3) `toHaveLength` 只吃数组/字符串，Record 必须先 `Object.keys()`；(4) 整容器负向会误伤：StoreProbe 的 `probe-*` 面合法地带着失败源的 rid，负向只圈 `aud01-error` 节点；(5) 重试前记得撤旗标，否则重读仍失败、`waitFor` 到不了绿。
- 三处自有用例错（全是我方，零产品缺陷）：run1 两条（Record 上的 `toHaveLength`；整容器负向被 probe 面 rid 命中）→ run2 剩一条（③ 忘了 `flags.health = null` 导致重试再失败）→ run3 全绿。
- 验证：新文件 1 file / 3 passed（2.14 s）；`npx vitest run src/modules/health` → **24 files / 131 passed**（任务前 23/128，+1 文件 / +3 例）；`./node_modules/.bin/tsc -b . --noEmit` → TSC_EXIT=2 且 `grep -Ec 'modules/health'` → **0**，错误文件只 `src/modules/approvals` / `employee-detail` / `employees`（既有基线）；全量 `npx vitest run` → **332 files / 3122 passed, 0 failed**（34.45 s，stderr 只有既有 jsdom 「Not implemented: navigation to another Document」/「Window's open() method」×5）。新全量基线 **332 / 3122 零红**（合并前 325/3102，wave-65 带来 6 个上游测试文件，本单 +1 文件 / +3 例）。
- 三档 N/A：纯测试，本单零 markup/CSS 增量（health.css 那笔是上游带的），几何结论沿用 R93 实测。
- 边界：只动 `web/src/modules/health/system.cross.failure.test.tsx`（新增）与 `docs/_artifacts/gov/DONE.md`（本节）；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops（shell 与 audit 源码只挂载、只读）；零产品码改动；未 install、未并 main、未重建 9122、未启停任何服务；未用 force/amend/`--no-verify`；回执不引工作树 entry/sha。

## R121 / sys-refresh-race — /system 刷新并发与批次隔离（纯测试，R230）

- 基线：起点 HEAD `c3c001ce`（R229/R120），porcelain 0。显式 refspec SSH fetch → 上游 `b86999cd..f7009e21`，`origin/lane/hermes-console` = **`f7009e21108bb96e1aa5c73d33d3633038079eef`**，主题 `f7009e21 merge(lane): stamp b86999cd (wave-66 seal)`，正是派工单点的 tip。祖先链核对（防「并窗幻影合并」）：wave-65 `d5c886f5` 是 `f7009e21` 的祖先，本道 R229 提交 `c3c001ce` 也是其祖先（上游已作为 `104a5c4f merge(lane): c3c001ce (wave-67)` 并入）。`git merge --no-ff` → 合并提交 **`65820de5`**，180 文件 +1314/−204，之后 porcelain 0，未用 reset。`git diff --name-only HEAD^1 HEAD -- web/src/modules/{health,capabilities,skills,tools}` → **空**（写域零重叠）；上游只带来 4 个新测试文件 `approvals/approvals.export.paged.test.tsx`、`approvals/approvals.rowcopy.stability.test.tsx`、`audit/audit.actor.copy.test.tsx`、`knowledge/knowledge.preview.filter.transition.test.tsx` 加 `docs/_artifacts/tonight/**` 证据。幻影合并复查通过：`system.cross.failure.test.tsx` 22 527 B、`system.event.combo.test.tsx` 19 070 B、`system.event.rows.test.tsx` 15 894 B 仍在盘上。
- 先查重结论（派工单纪律）：`sys-evt|sysEventCopyText|evt-copy|evt-count` 现 **27 处命中，全是「本代不存在」的注释或本道自己的缺席断言**（第 23 条道），零产品码 ⇒ 本文件不伪造任何 `sys-evt-*` 腿，只在需要的地方断言它不存在。
- 已覆盖只回证据：**①「连点只发一批」= R112 `system.refresh.test.tsx` 例③（:179）**，它连点三次断言计数 `{2,2,2,2}` 与 `sys-busy-note` 一枚，但两批喂同一份 payload、不验落屏内容；**②「失败不写时刻 / 旧批保留 / 锚带 rid」= R112 例②（:131）**，它比的是 asof 单元格与行数，不是整行文本。两者本文件都不重写。
- 本轮真正补的三条腿：(a) **①的 busy 门 × 换代对撞** —— GEN1→GEN2 四个顶层 asof 与 sources 集合全变（三行服务、`2026-11-20 08:05`/`11:10`/`12:20`/`13:25`），busy 期连点三次只发一批，落屏 `sys3-row-*` 键集变 `[svc-a,svc-b,svc-c]`、四格矩阵时刻等于新一代，表体 / 探针面 / pipe 与 tab 两份复制文本里 **GEN1 的任何一枚时刻都不出现**，读取时刻仍不等于任何数据面；(b) **②的 `sys-refresh-copy` 点击** —— 产品 `systemRefresh.tsx:69-87` 走可 mock 的 `copyTextToClipboard(id)`，全仓此前只有 `HealthPage.test.tsx:188` / `system.cross.isolation.test.tsx:232` 断言过它**存在**，从没人点过；本文件点下去断言剪贴板收到的是**完整 rid**、按钮转「已复制」、锚上仍是完整编号未被短码替换、且**零额外请求**；同时把「不更新」收紧为：先成功刷一次让 `sys-updated-at` 真落一个时刻，再让下一批失败，断言它被 `start()` **撤回为 null**（既不保留旧值也不写新值），旧批服务表整行文本逐字不动（`hasDataRef`）、三条探针矩阵行与内外两层 asof 一字不改，失败那行如实转 failed 且自己的时刻撤「—」、汇总「成功 3 · 失败 1」；(c) **③两边独立刷新** —— `aud01-refresh`（产品 `AuditEventsModulePage.tsx:1583`）此前只在审计道单面挂载里被点过（`AuditEventsModulePage.test.tsx:4716/:4721/:4762`），健康道没人点过；本文件跨面点它：只刷事件表时 health 四条路径零新增、矩阵存储面/整行/内外 asof/两份复制文本逐字不动（`sys10-copy` 与 `sys-matrix-copy` 走**裸 `navigator.clipboard.writeText`**，与 `sys-refresh-copy` 的 mock 助手在同文件并存），反向只刷 health 时审计面一分不花；两条腿都如实披露：两面在外壳里是**互斥 live 槽**（`App.tsx` health vs events）且**都没有模块缓存**，所以切回来必然重挂、花自己那一整批 —— 这不是污染，与 capabilities 的 `cachedSkillsState`/`cachedTools` 正好相反。
- 用例形态：`web/src/modules/health/system.refresh.race.test.tsx` 一个 describe 四例（③拆两腿），克隆 R229 的跨面 harness（hoisted `api.fetchJSON` 平对象 mock `@/lib/api` + hoisted clipboard mock + 裸 `@nous-research/ui` mock + 真 `ApiError` + `StoreProbe` 挂在 `ConsoleModulePage` 之外当常驻证人 + 旗标按引用读的单个 `switchable` 处理器 + 迭代上限 `waitFor` 600×5 ms）。审计腿早返回使 `GEN1[key]` 通过类型收窄，不需要 R228 那样的 `HealthKey` 转换器。本文件**不新增任何 testid**。
- 自测纠错三处（全在用例侧，零产品缺陷）：(1) 首跑 3 绿 1 红 —— `复制一次不花任何请求` 拿到 12 期望 8：基数取错了，失败的那一批自己也花了四读，改为在错误锚落下后取 `readsAtFailure = totalReads()` 并顺手断言它 `=== readsBefore + 4`（失败批次只花一次批次钱），复制零成本跟它比；(2) 初稿在 test ② 尾部写了 `expect(textOf("sys-updated-at")).not.toBe(stampBefore)` —— `sys-updated-at` 是分钟粒度，同一分钟里「失败后恢复」两枚时刻必然相同，属时钟依赖的假断言，已删（`stampBefore` 仍被前一条「刷新完成于」在场断言消费，不留 TS6133）；(3) 初稿在文件末尾重复定义了 `tabButton`（会炸 `[BabelError] Identifier 'tabButton' has already been declared`）并留下 `click(q("tabButton-placeholder") ?? …)` 这类无效锚，已统一改用 helper 块的唯一定义与 `click(tabButton("events"), …)`；另清一个 TS6133：`healthBefore` 声明后未读，删除。
- 验证：新文件 **1 file / 4 passed**；定向 `npx vitest run src/modules/health` → **25 files / 135 passed**（开工前 24/131 ⇒ +1 文件 / +4 例）；`./node_modules/.bin/tsc -b . --noEmit` → exit 2，`grep -Ec 'modules/health'` = **0**，报错文件只在既有的 approvals / employee-detail / employees 基线；全量 `npx vitest run` → **337 files / 3137 passed, 0 failed**（exit 0，stderr 只有既有的 jsdom 「Not implemented: navigation to another Document」/「Window's open() method」）。新全量基线 **337 / 3137，零红**。
- 三档：N/A —— 纯测试，零标记/CSS 增量，几何沿用 R93 的实测结论。
- 边界：只动 `web/src/modules/health/system.refresh.race.test.tsx`（新）与 `docs/_artifacts/gov/DONE.md`；`@/shell/console`、`@/modules/audit/**` 只挂载与只读，未改一行；未碰 App.tsx / shell / routes / registry / package·lock / web-scripts / ops；未 install、未并 main、未重建 9122、未启停任何服务；未 force / amend / `--no-verify`；零产品码改动。

## R122 / sys-event-copy-paging — /system 事件表「第 2 页 / 切窗」后复制句与导出文件按位置同源（纯测试，R235）

- 基线：起 HEAD `d57fffce`（R234 那一轮的 wave-70/71 基线 merge），porcelain 0。显式 refspec SSH fetch → `origin/lane/hermes-console` = **恰好 `cafd2d81ee9ddb93ed58c231d316bd36f48c939a`**，subject `cafd2d81 merge(lane): e6980488 (wave-75)`，即派工单点名的章笔；祖先核验：`76077921`（R230）是上游 tip 的祖先（上游已并我 R230）。`git merge --no-ff` → merge commit **`4d1bbec8`**，183 files changed, +2895 / −181，MERGE_EXIT=0，之后 porcelain **0**，未用 reset。
- 写域 delta：`git diff --name-only HEAD^1 HEAD -- web/src/modules/{health,capabilities,skills,tools}` → **空**。整个 `web/src` delta 只有 11 个文件，全部上游带来、我一律没碰：新增 `approvals/approvals.detail.multipage.test.tsx`(+251)、`approvals.drawer.focus2.test.tsx`(+246)、`approvals.export.fail.isolation.test.tsx`(+244)、`approvals.history.paging.test.tsx`(+178)、`audit/audit.copy.paged.test.tsx`(+393)、`audit/audit.detail.paging.stability.test.tsx`(+331)、`audit/audit.filter.paging.export.test.tsx`(+392)、`knowledge/knowledge.empty.export.test.tsx`(+80)、`knowledge/knowledge.export.paged.test.tsx`(+199)、`knowledge/knowledge.preview.export.parity.test.tsx`(+199)，以及 `knowledge/KnowledgeModulePage.tsx`(+47)。其余是 `docs/_artifacts/**` 证据（shots/shots-anon PNG、crawl-*.json、新 `ui-review/knowledge-{empty,error}-{before,after}-{1440,375}.png`、`ui1/KNW5-RETRIEVAL-EVIDENCE.md` +141、`D/DONE.md` +23）。
- 幻影合并自查（并窗坑）：merge 后逐个数行确认内容还在 —— `system.event.rows.test.tsx` 303、`system.event.export.test.tsx` 429、`system.event.combo.test.tsx` 349、`system.refresh.race.test.tsx` 529、`system.cross.failure.test.tsx` 461。
- **第 28 条道确认 `sys-evt-*` 不存在**：`git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src` → 30 处命中，全部是既有注脚与我自己写的缺席断言（分布：`system.window.isolation` ×4、`system.event.export` ×4、`system.event.combo` ×4、`system.cross.failure` ×4、`system.refresh.race` ×3、`system.event.rows` ×3、`system.cross.isolation` ×3、`system.time` / `system.state.isolation` / `system.matrix.export` / `system.filters` / `system.empty` 各 1）；**health 产品码命中 0**，所以派工的 `sys-evt-copy-<i>` / `sys-evt-count` 两条腿只断言「不存在」，不编造。真面替身：行数读数 `aud01-status`（「已显示 N 条审计事件（窗口）」）、导出读数 `aud5-export-count`（「将导出 N 条」）、逐行 affordance `aud01-cell-<key>-request-value`（无值行给 `-request-value-absent`，文案「该字段未返回」，不给死按钮）。
- **「序号连续」的现场裁决**：产品里逐行复制没有序号，控件是按行 id 键控的 testid。所以本单把「序号」如实钉成两层：①控件集合与屏上行按 DOM 序 1:1 同序（`valueKeys()` / `absentKeys()` 对 `paintedRows()`）；②**第 i 句复制 == 文件第 i 条记录的第 6 列（请求编号格）== 该行屏上那格的文字**。第二层是本单真正的缺口：R225 :261 只钉了「屏上 ≡ 复制」，R221 :241 只钉首页的三值与控件数，上游本波新落的 R241 :326/:365 钉「第 2 页每屏上一句、复制是它自己的」与「翻页后切窗零残留、复制跟着重建」，R243 :312/:349 钉「切窗换整页、文件按表体位置序走」——但把「复制句」与「文件那一格」按位置对撞、且发生在 `?tab=events` 组合地址的第 2 页与切窗之后，此前无人钉过。
- ③「第 2 页 500 保旧行」**不写，只回证据**（与产品相反，已是第三次记账）：走 `aud01-load-more` 的失败是非追加失败 —— rows 被清、`aud01-error` 上屏、rid 可复制、重试恰 +1 且不重复追加，由上游 R161 `audit.paging.test.tsx`:339 钉死，且 :361 断言 `aud01-page-failure` 为 null；真正「保旧行」的追加腿 `aud01-page-failure`（`AuditEventsModulePage.tsx:2049`）唯一调用点是它自己那颗重试按钮，而那块只在追加失败后才渲染，现界面够不到（R161 头 :19-21 记账）。失败态两枚导出门关掉、点击不建文件由 R213 `audit.error.test.tsx`:328 钉；抽屉读失败而列表不动由本波上游 R242 `audit.detail.paging.stability.test.tsx`:291/:292 钉。
- 交付文件：`web/src/modules/health/system.event.copy.paging.test.tsx`（2 describe / 2 例，约 370 行）。夹具沿用 R225 的三行集（`FRESH evt_fresh00000001` / `RID_FRESH req-fresh-0001`、`MID evt_mid0000000002` / `RID_MID req-mid-0002`、`TAIL evt_tail000000003` 无 rid；`W30_PAGE1` 两行带 `nextCursor:"cur_rows2"`、`W30_PAGE2` = [MID, TAIL]、`W24_PAGE1` 只认 FRESH），假服务按请求自己的 `from/to` + `cursor` 决定行集（和真 BFF 一样服务端筛）。rid 用连字符形，避开 R31 短码折叠（32-hex → 前 8；scheme handle → 前缀…后 8），于是「屏上文字 == title 全形 == 剪贴板」三者可逐字对撞。harness 克隆 R225/R221：jsdom；hoisted `api = vi.hoisted(() => ({ fetchJSON: vi.fn() }))` 平对象 mock `@/lib/api`；hoisted `clipboard` mock `@/lib/clipboard` → `mockResolvedValue(true)`；`LocationProbe` → `probe-location`（pathname+search）；迭代封顶 `waitFor` 600 × 5 ms；`paintedRows()` / `valueKeys()` / `absentKeys()` / 新增 `screenRid(key)`（读 `CopyValue` 外层 testid 节点的第一子节点即屏上形，title 才是全形）/ `copyRow(key)`（mockClear → act 点 `button[aria-label='复制请求编号']` → waitFor 落地 → 取 lastCall）/ `captureDownload()`（`RecordingBlob extends OriginalBlob` 记 `parts[0]` + `blobCalls`，`URL.createObjectURL`/`revokeObjectURL` 换 `vi.fn()` 桩并计 `urlCalls`，`vi.spyOn(HTMLAnchorElement.prototype,"click")` 读 `this.download`，restore 闭包在 afterEach 调用）/ `csvRecords()` 剥 BOM `/^\uFEFF/` + `trimEnd()` + `\r\n` 切行 + 逗号切列，`RID_COLUMN = 5`。`afterEach` 里先 `restoreDownload?.()` 再 unmount / `replaceChildren()` / `replaceState("/", "")` / `vi.useRealTimers()`。
- 例 ①「第 2 页：复制句与文件请求编号格按位置一一对应，三值与两枚读数条同一个数，导出零花费」：`/system?tab=events&window=30d` 首载 `[FRESH, MID]` 且两行都带 rid → 点 `aud01-load-more` → 行集 `[MID, TAIL]`、Set 唯一（重叠 id 只一次）→ `aud01-status` 含「已显示 2 条」、`aud5-export-count` 恰「将导出 2 条」→ `valueKeys()` 恰 `[MID]`、`absentKeys()` 恰 `[TAIL]`，裸行节点内 `querySelector("button")` 为 null 且文字恰「该字段未返回」→ 捕获下载后点 `aud01-export`：表头逐字 `["时间","类型","结果","操作者","对象","请求编号"]`，数据行 2 == 表体行数，`data[0][5] === RID_MID`，`data[1][5] === ""`（裸格是空的，不是 0 也不是占位），**`screenRid(MID) === data[0][5]`**（本单新钉的一层）→ `copyRow(MID)`  returned 串 === 同一格 === `RID_MID`，且「文件非空编号格集合」toEqual「复制句集合」→ `urls()` 长度不变（导出与复制零请求）、`urlCalls === 1`、`blobCalls === 1`、文件名 `/^audit-.+-\d{8}-\d{4}\.csv$/`、零 `[data-testid^='sys-evt']`。
- 例 ②「第 2 页之后切窗：复制序号与文件一起重建，宽窗与第 2 页的东西一项都不留」：30d 翻到第 2 页 `[MID, TAIL]`，记 `readsBefore` → 点 `aud01-filter-window-24h` → 行集 `[FRESH]`、不含 `MID`、不含 `TAIL`、`aud2-page` 含「第 1 页」、`aud01-status` 含「已显示 1 条」、`aud5-export-count` 「将导出 1 条」→ 末笔列表读 `cursorsOf === []` 且 `windowHours === 24`、`urls()` 恰 `readsBefore + 1`、`listReads()` 恰 3（首载+翻页+切窗，中间无多余一笔）→ `valueKeys()` 重建为 `[FRESH]`、`absentKeys()` 空 → 再捕获导出：数据行 1 == 新表体，`data[0][5] === RID_FRESH`，**`screenRid(FRESH) === data[0][5]` 且 `copyRow(FRESH) === data[0][5]`**，整份文件 `not.toContain(RID_MID)` / `not.toContain(TAIL)`，导出零请求 → 地址侧 `paramOf(address(),"tab") === "events"`、`window === "24h"`，零 `sys-evt*`。
- 自查修正一笔（全在用例侧，产品零改动）：① 首跑 ② 死在 `expect(listReads()).toBe(2)` → received 3。我的算术错了：首载 1 笔 + 翻页 1 笔 + 切窗 1 笔 = 3 笔，而紧邻的 `urls()` 断言（`readsBefore + 1`，`readsBefore` 在翻页后取）本来就是绿的，说明产品计数没错、是我的期望写反。改为 `toBe(3)` 并把消息写成「首载 + 翻页 + 切窗 = 三笔列表读，中间没有多余的一笔」。② 初稿里我写过一条同义反复的断言（`data.map(line => line[0])` 自己 toEqual 自己）与一段 `void bare` 残渣，都在跑之前删掉，换成上面那条有内容的 `screenRid` 对撞；另按 R188 的坑把 BOM 从字面 U+FEFF 改回转义 `/^\uFEFF/`（字面量会撞 eslint `no-irregular-whitespace`），改完 `npx eslint <file>` → exit 0。
- 验证（全部实测）：新文件 `npx vitest run src/modules/health/system.event.copy.paging.test.tsx` → **1 file / 2 passed**（exit 0）；定向 `npx vitest run src/modules/health` → **26 files / 137 passed**（起基线 25/135 ⇒ +1 file / +2 tests）；`./node_modules/.bin/tsc -b . --noEmit` → **TSC_EXIT=2**，`grep -Ec 'modules/health'` → **0**，报错文件只落在 `src/modules/approvals` / `src/modules/employee-detail` / `src/modules/employees`（长期基线，不宣称 tsc 全局 0）；全量 `npx vitest run` → **FULL_EXIT=0，358 files / 3199 passed, 0 failed**（60.00 s，stderr 只有既有的 jsdom「Not implemented: navigation to another Document」与「Window's open() method」×5）。新全量基线 **358 / 3199 零红**（R230 时是 337/3137，wave-70~75 上游带来 11 个新测试文件，本单再 +1 file / +2 tests）。
- 三档 N/A：纯测试，零 markup / CSS delta；几何证据仍按 R93 起的实测站立。
- 边界：只动 `web/src/modules/health/system.event.copy.paging.test.tsx`（新增）与本节 `docs/_artifacts/gov/DONE.md`；`App.tsx` / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops 一律未动（本波 shell 与 knowledge 的改动全是上游带来）；未 install、未并 main、未重建 9122、未启停任何服务；未 force / amend / `--no-verify`；产品码零改动，测出的两点都是「派工前提与产品相反」，按现状钉并如实记账，没有为了凑数新造锚点；剪贴板与凭据值一律不回显。

## R123 / sys-event-empty-guards — /system 事件表空集与非法窗的两扇门（纯测试，R236）

- 基线：起点 HEAD `8754a1ca`（R235/R122，= 远端 `lane/console-gov`），porcelain 0。显式 refspec SSH fetch → FETCH_EXIT=0，`origin/lane/hermes-console` = **恰好 `cafd2d81ee9ddb93ed58c231d316bd36f48c939a`** = `cafd2d81 merge(lane): e6980488 (wave-75)`，即派工点名的那支章笔；它早已随 R235 推上去。`git merge --no-ff origin/lane/hermes-console -m "merge(console): sync event empty state baseline"` → **Already up to date**，MERGE_EXIT=0，HEAD 仍是 `8754a1ca`，PORC_AFTER=0，**未用 reset**，本轮没有新的 merge commit ⇒ 无基线增量。诚实记录：同一条 shell 里的域增量命令比的是 `HEAD^1 HEAD`（其父是 `4d1bbec8`），所以它列出的只有 R235 自己的文件 `web/src/modules/health/system.event.copy.paging.test.tsx` —— 那是 R235 的提交内容，不是本轮合并增量；本轮没有发生合并。
- 派工债收口：`web/src/modules/health/system.event.empty.test.tsx` 此前不存在（R234 的收窄单点名它但从未落盘），本单把它补上并落盘，R234 的欠账在此结清。**R226（`system.copy.width.test.tsx`）仍未开工**，它的 DONE 号因此顺延为 R124。
- 查重（派的纪律「先 `git grep` 现查既有用例」）：`git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src` → **36 处命中（第 29 条道）**，全部是缺席记录注释或我自己的缺席断言；**health 产品码命中 0** ⇒ `sys-evt-count` / `sys-evt-copy-<i>` 本代没有对应物，只断言「不存在」，绝不伪造。命中分布在 `system.window.isolation` / `system.event.export` / `system.event.combo` / `system.cross.failure` / `system.refresh.race` / `system.event.rows` / `system.event.copy.paging` / `system.cross.isolation` / `system.time` / `system.state.isolation` / `system.matrix.export` / `system.filters` / `system.empty`。
- 已覆盖只回证据（不重写）：R221 `system.event.export.test.tsx` `:241`（三值同源 + 逐行可复制控件只数带 rid 的行）/ `:276`（切窗换代、五个旧标记逐项缺席、`tab` 逐字、导出点击不提问）/ `:315`（逐格 CSV↔屏上同句、显示名 + 8 位短码、禁裸内部 id）/ `:365`（空答复禁用导出并给原因，强点零请求零 Blob）/ `:394`（2031 假钟下文件行保留事件自己的时刻；本面**没有** `sys-updated-at` 锚）；R228 `system.event.combo.test.tsx` `:259`（events→health→events 往返）/ `:310`（非法 `?window=` 折成默认、恰一问、空答复是句子不是裸 0、URL 不改写、页级锚在、矩阵不吃这个参数）；R135 `system.filters.test.tsx` `:158`/`:174`/`:203`/`:223`/`:244`/`:259`；R225 `system.event.rows.test.tsx` `:198`/`:261`；R235 的位置序对撞；aud 道 R181 `audit.empty.test.tsx` `:169`/`:197`/`:216`/`:221`/`:246`/`:267`、R206 `audit.empty.export.test.tsx` `:186`/`:202`/`:221`/`:241`、R214 `audit.filter.counts.test.tsx` `:271`/`:290`/`:316`/`:345`、R161 `audit.paging.test.tsx` `:339`/`:361`、R213 `audit.error.test.tsx` `:328`，以及本波上游 R236–R243。
- 本单真正新写的一半：**复合 `?tab=events` 地址 + 矩阵存储面作为常驻证人**。R181/R206/R214 都只单独挂 `AuditEventsModulePage` 在裸 `/audit` 上，从来没有这枚证人；矩阵存储是模块级、在同一测试内的二次挂载后仍然存活，所以「事件侧空集不动矩阵一面」可以被正面钉住。另外新写的两层：清空区间出口后的**四值方程**（行数 == `aud01-status` 的数 == `aud5-export-count` 的数 == 逐行 rid 控件数 + 裸行数），以及**档位赢过叠上的 custom 对**在复合地址上的复查（那一对被忽略、地址逐字不改）。
- 三条现场裁决（按现状锁，不迁就派工措辞）：① 真正的 0 面只有 `aud5-export-count`「将导出 0 条」，`aud01-status` 在无事件时是**无数字的句子**（R206 `:186` / R181 `:216` / R214 ④ 早已按现状锁，本单再锁一次）；派的 `sys-evt-count 显 0（非「—」）` 在本代只能落在这一枚读数上。② **两扇门不共用一句原因**（实测，与本文件初稿的假设相反）：`aud01-export` 说「当前筛选没有可导出的记录」，`aud5-export` 说「当前筛选无事件可导出」——各自可读、各自关死；派工只要求「disabled + title」，本代事实是两句而不是一个单点。③ 「两表同落可读空态」双重 inverse-of-product：health 产品码零 `?window=` 读者（读者只有 `audit/AuditEventsModulePage.tsx:774`/`:1521`、`audit/scrollMemory.ts:43`、`runs/RunsModulePage.tsx:955/:976/:990/:1695`、duty），而且事件 tab 活跃时矩阵 DOM 面板根本没挂载（`App.tsx` live slots `health:` vs `events:` 互斥）——所以本文件把「矩阵不动」写成常驻存储面一字不动 + `sys3-table` 为 null，而不是写成它也落空态。
- 用例（`web/src/modules/health/system.event.empty.test.tsx`，1 describe / 2 tests）：test 1 «自定义区间答以空集：0 只落在导出读数上、两扇门关死且点击零请求零 Blob，清空出口恰多一问» —— 先挂 `/system?tab=health` 让四条读口落绿、取 `faces` 与 `healthBase = 4`，再二次挂 `/system?tab=events&window=custom&from=2026-11-05T02:00:00Z&to=2026-11-05T02:30:00Z`（夹具沿用 R181：`from` 以 `2026-11-05T02:00` 开头 → 空集，`action=approval.denied` → 空集，否则两行 `evt_fresh00000001`（rid `req-fresh-0001`，dash 形不被 R31 折叠）与 `evt_tail000000003`（**无 rid**））；断言零行 + `aud01-empty` + `audB-empty-exit`「这一段里没有记录。」+ 状态行非空且不含「0 条」且 `shownOf === -1` + 页面无「共 0 条」+「将导出 0 条」+ 零 `sys-evt*` + 零 `aud01-cell-*`（R206 `:241` 先例）+ 两扇门 present/disabled/titles 各锁一句 + captureDownload 后强点两扇：`urlCalls === 0`、`blobCalls === 0`、内容与文件名皆空、`urls()` 不变、`listReads()` 仍是 `readsAtEmpty`（基数在空答复落地**之后**取，R230 坑）、`healthReads() === healthBase`、`probeFaces()` 逐字不动、地址仍带 `tab=events`/`window=custom`/`from=`；然后点 `audB-empty-clear` → 两行回来、`listReads() === readsAtEmpty + 1`（恰多一问）、`spanOf(last) === 7*24*3600*1000`、请求不带 `window` 键、`cursorsOf === []`、地址丢掉 `from=`/`to=` 而 `window` 落成 `7d`（R181 `:221` 现状）且 `tab=events` 保留；最后四值方程 == 2，`valueKeys() === [FRESH]`、`absentKeys() === [TAIL]`、裸行文本恰「该字段未返回」且内无 `button`。test 2 «非法 ?window= 叠上 custom 对与类型筛选：折成默认档提问、忽略那一对、地址逐字不改，空答复仍是句子不是裸 0» —— 假钟 `2026-11-20T06:00:00.000Z`，挂 `/system?tab=events&window=__nope__&from=…&to=…&type=approval.denied`；断言恰一笔列表读、`boundsOf` toEqual `windowBounds(DEFAULT_WINDOW, NOW)`（那一对被忽略 = R214 ③ 的仲裁在复合地址上复查）、`paramOf(read,"window")` null、跨度 7 天、`paramOf(read,"action") === "approval.denied"`（空集来自类型筛选这一腿）、`cursorsOf === []`、`address()` 与粘贴串**逐字相同**、零行 + `aud01-empty` + `audD-empty-exit`「该条件下无事件」+ 状态行句子不是裸 0 +「将导出 0 条」+ `agent-v2-page-audit` 在 + 两扇门各自关死 + 强点零 urlCalls/blobCalls 且 `listReads()` 仍是 1 + `probeFaces()` 逐字不动且全是 `ok|…|` 无 `|—|` + `healthReads() === healthBase` + `q("sys3-table")` null（互斥槽的实证）+ 零 `sys-evt*`。
- 自查修正一处（全在用例侧，产品无缺陷、零产品码改动）：初稿假设两扇门共用一句 gates 单点原因，实测两句不同 → 改为各自锁「按现状」的原句，并把裁决写进断言消息与注释。另在首跑前删掉一处占位节点查询（`aud01-cell-TAIL_PLACEHOLDER`）与 `void bare` 残留。
- 验证（精确命令与读数）：`cd web && npx vitest run src/modules/health/system.event.empty.test.tsx` → EXIT=0，**1 file / 2 passed**（3.10 s，日志 `/tmp/r236-new2.log`；首跑 `/tmp/r236-new.log` 是 2 failed，唯一原因就是上面那条 door-title 假设，修完即绿）。`npx vitest run src/modules/health` → EXIT=0，**27 files / 139 passed**（派工前 26/137 ⇒ +1 file / +2 tests，日志 `/tmp/r236-health.log`）。`./node_modules/.bin/tsc -b . --noEmit` → **TSC_EXIT=2**，`grep -Ec 'modules/health'` → **0**，报错模块只有 `src/modules/approvals` / `employee-detail` / `employees`（长期基线，日志 `/tmp/r236-tsc.log`）。`npx vitest run` → **FULL_EXIT=0，359 files / 3201 passed, 0 failed**（42.47 s，日志 `/tmp/r236-full.log`；stderr 只有既有的 jsdom「Not implemented: Window's open() method」/「navigation to another Document」）。`npx eslint web/src/modules/health/system.event.empty.test.tsx` → **ESLINT_EXIT=0**。全量基线因此从 R235 的 358/3199 抬到 **359 / 3201，零红**。
- 三档 N/A：纯测试，零标记/样式改动，几何结论仍沿 R93（本单未跑浏览器腿）。
- 边界：只新增本测试文件 + 本节 DONE；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops（`@/shell/console` 与 `@/modules/audit/**` 只在用例里挂载与只读，从未编辑）；未 install、未并 main、未重建 9122、未启停任何服务；未 force / amend / `--no-verify`；零产品码改动；本文件不新增任何产品 testid —— `probe-` 前缀与 `empty-location` 是本文件私有的测试内证人节点。

## R124 / sys-event-export-fulltext — /system 事件表请求编号列的「屏上折叠 vs 文件全形」（纯测试，R236 第二张）

- 基线：起点 HEAD `afba4742`（上一笔 R123，= 远端 `lane/console-gov`），porcelain 0。显式 refspec SSH fetch → FETCH_EXIT=0，`origin/lane/hermes-console` = **恰好 `5583fe3661c3c4b0bf7fb7ee133f91b9ef0ecdd6`**，subject `5583fe36 chore(gates): full gate ledger stamped at 78bf2ccd (entry 6g0IMx1G)` —— 派工点名的「代次 `78bf2ccd` 纯账本章笔」，实测确认：`git merge-base --is-ancestor 78bf2ccd origin/lane/hermes-console` → 0（章笔就压在那一代次上），且 `git merge-base --is-ancestor afba4742 origin/lane/hermes-console` → 0（上游已把我上一笔并了进去）。`git merge --no-ff origin/lane/hermes-console -m "merge(console): sync event export fulltext baseline"` → merge commit **`9dbae3f2`**，MERGE_EXIT=0，**158 files changed, +3074 / −121**；porcelain **0**；**未用 reset**。
- 域增量为空：`git diff --name-only HEAD^1 HEAD -- web/src/modules/{health,capabilities,skills,tools}` → 无输出。整个 `web/src` 增量只有 11 枚上游新测试文件，全部上游带来、我一字未改：approvals ×6（`approvals.export.empty.status` / `.export.multistatus` / `.export.noStatus` / `.export.paging.sort` / `.export.sort.cross` / `.export.status.columns`）、**audit ×2（`audit.copy.paging2.test.tsx` = 上游 R244，`audit.export.detail.open.test.tsx` = 上游 R245）**、knowledge ×3。余下是 `docs/_artifacts/**` 证据。
- 幻影合并核查：合并后树上行数复核 —— `system.event.copy.paging.test.tsx` 388（R235）、`system.event.empty.test.tsx` 489（R123 刚落的）、`system.event.combo.test.tsx` 349、`system.refresh.race.test.tsx` 529、`system.cross.failure.test.tsx` 461，内容都在；本单新文件 403 行。
- 查重（派的纪律「先 `git grep` 查重」）：**`sys-evt` 族缺席 —— 第 30 条道**。`git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src` → **44 处命中**（上一轮 36，涨的是我自己 R123 文件里的缺席注释与断言），全部是指向缺席的注释或我的缺席断言，**health 产品码命中 0** ⇒ ① 的第三值 `sys-evt-copy-<i>` 与 ③ 的 `sys-evt-count` 没有对应物，只断言不存在，绝不伪造；两条腿诚实改钉在真面上：逐行控件 `aud01-cell-<key>-request-value`（裸行 `-request-value-absent`，文字「该字段未返回」且不给死按钮）、读数 `aud01-status`（「已显示 N 条审计事件（<窗口>）」）与 `aud5-export-count`（「将导出 N 条」）。
- 已覆盖只回证据（不重写）：① 的三值三角形由 R221 `system.event.export.test.tsx:241`（30d 地址上 文件数据行 == 表体 == 两枚读数条 == 逐行控件数，只有带 rid 的行有按钮）+ 上游 R241 `audit.copy.paged.test.tsx:325` / R243 `audit.filter.paging.export.test.tsx:348`（文件按表体顺序逐行交）+ R235 `system.event.copy.paging.test.tsx`（第 i 句复制 == 文件第 i 条第 6 列 == 屏上那格）钉住；7d 档本身由 R135 `system.filters.test.tsx:158`、R228 `system.event.combo.test.tsx:310`、R181 `audit.empty.test.tsx:221` 钉住 —— 本单只在 7d 上顺带复核等式，不重抄档位口径。② 的两半各自都被钉过但都不是「请求编号」这一列：上游 R215 `audit.fields.edge.test.tsx:394` 钉 120+ 字**资源列**「屏上一行截断、复制与文件全量」、`:434` 钉死链行的可复制 rid；R229 `system.cross.failure.test.tsx` 钉审计错误锚复制写全形；R213 `audit.error.test.tsx:328` 钉失败态两扇门关死；本轮新并入的 R244 `audit.copy.paging2.test.tsx:317`（坏掉的第 2 页复制门关着、恢复后各句不重复）与 R245 `audit.export.detail.open.test.tsx:311`（抽屉开合前后文件逐字相同）又厚了一层。③ **已由本车道十几分钟前推上去的 `afba4742`（`system.event.empty.test.tsx` 例 1）按现状锁**：空集时两扇门 disabled 且各自带可读 title、强点零 urlCalls / 零 blobCalls、「将导出 0 条」是唯一真 0 面；在先的还有 R221 `:365`、R206 `audit.empty.export.test.tsx:186/:202`、R181 `:197/:216`、R214 `audit.filter.counts.test.tsx:345` ⇒ ③ 不写。
- 唯一真缺口（本单的靶子，写之前现查确认）：**请求编号这一列的两态**。R221 `:315` 当初刻意用 dash 形 rid（`req-fresh-0001`）绕开 R31 的短码折叠，于是「屏上折成 8 位短码、文件必须是全形」这一格从来没被对撞过；`git grep -n -E "requestId: \"[0-9a-f]{16,}\"" -- web/src/modules/audit` → **0 命中**（全仓 audit 夹具没有任何一枚 32 位十六进制 rid；同一模式在全仓 `web/src` 是 3 命中，都在 audit 道之外）。后果：若哪天有人把屏上那枚短码写进 CSV，现有用例一条都不会红。
- 交付文件 `web/src/modules/health/system.event.export.fulltext.test.tsx`（2 describe / 2 test，**首跑即绿**，零自查修正）：夹具沿用 R235 的单面挂载习语（hoisted `api.fetchJSON` PLAIN-object mock of `@/lib/api` + hoisted `clipboard` mock of `@/lib/clipboard` + 默认导入 `AuditEventsModulePage`，不需要 `@nous-research/ui` 桩也不用 `ApiError`），只把三枚 rid 换成三种折叠规则各一：`RID_FRESH = "9f8e7d6c5b4a3f21e0d9c8b7a6f5e4d3"`（32 位十六进制 → 屏上前 8 位、全形只在 `title` 与文件）、`RID_MID = "req-audit-2026-11-20-untruncated-trace-identifier-longer-than-any-column-width"`（不匹配任何规则 → 屏上逐字全形）、`RID_HANDLE = "runtime_abc1234567890"`（下划线句柄形，R31 的另一条规则），并给宽窗第一页补一行**根本没有 rid** 的 `BAREROW = "evt_barerid0000001"`。test 1 «folds the 32-hex rid to its 8-char short on screen while the file carries the whole id, keeps the long one verbatim, and costs no extra ask»：`/system?tab=events&window=7d` → 三行 `[FRESH, MID, BAREROW]`；顺带把 7d 的窗口口径钉一次（`listReads() === 1`、`paramOf(read,"window")` null、`windowHours(read) === 168`、`cursorsOf(read) === []`、地址仍带 `tab=events`）；两枚读数条「已显示 3 条」/「将导出 3 条」；`valueKeys() === [FRESH, MID]`、`absentKeys() === [BAREROW]`、零 `sys-evt*`；然后对撞三形 —— 屏上 `screenRid(FRESH) === RID_FRESH.slice(0,8)`、内层 mono span 的 `title === RID_FRESH`、`screenRid(MID) === RID_MID`、裸行文字恰「该字段未返回」且内无 `button`；captureDownload 后导出：表头逐字 `["时间","类型","结果","操作者","对象","请求编号"]`、数据行数 == 表体行数、第 6 列逐行 `[RID_FRESH, RID_MID, ""]`（裸行留空不补 0/「—」）、`data[0][5].length === 32`、整份文件 `not.toMatch(/…|\.\.\.|截断/)`、`not.toContain("9f8e7d6c,")`（短码不得冒充整格）、每条记录恒 6 列（长值不把列撑成七列）、`blobCalls === 1` / `urlCalls === 1`、文件名 `^audit-.+-\d{8}-\d{4}\.csv$`（文件名戳是本面唯一被允许的读取时钟）、导出与两次复制前后 `urls()` 不变且 `listReads()` 仍是 1；并补 R235 的位置对撞在折叠值上的版本：`copyRow(FRESH) === data[0][5] === RID_FRESH` 且 `!== 屏上短码`。test 2 «keeps every fold rule's full id in the file cell while the screen may show a shorter form, at zero extra asks»：自带 handler 答 `[MID(RID_HANDLE), BAREROW]`，断言屏上形非空且**至多**全形长度（不猜折叠渲染、不许变长）、`title` 是全形、文件第 6 列 `[RID_HANDLE, ""]` 且 `captured` 含全形无省略号、每条 6 列、`blobCalls`/`urlCalls` 各 1、导出与复制零请求、`copyRow(MID) === RID_HANDLE`。
- 现场裁决三条（按现状锁，不迁就派工措辞）：① 「`sys-evt-copy-<i>` 三值」在本代只能是「文件数据行 == 表体 == 逐行控件数 + 裸行数」，控件按行 id 键而非序号，所以序号连续性用 DOM 序对撞表达（`valueKeys()`/`absentKeys()` vs `paintedRows()`）；② 「CSV 全文不截断」在**请求编号列**上是本单新钉的一格（资源列那格由 R215 ② 持有），屏上短码与文件全形同格并存是本代事实，测试锁的是「文件永远拿全形」而不是「屏上必须显全形」；③ ③ 整条不写 —— 它十几分钟前已由 `afba4742` 落在 `system.event.empty.test.tsx`，且那里量到**两扇门不共用一句原因**（主导出「当前筛选没有可导出的记录」/ 筛选快照「当前筛选无事件可导出」）。
- 自查修正：**零**。首跑 2/2 绿（1.52 s）。预写时应用的既有坑：BOM 剥离用 ESCAPE 形 `/^\uFEFF/`（克隆自 R235 已修好的写法）、`urls()` 过滤 `"undefined"` teardown 调用、`captureDownload()` 的 restore 闭包在 afterEach 里 `restoreDownload?.()`、迭代封顶 `waitFor`（本文件不冻 `Date` 但写法保持一致）、头注释里不出现星号斜杠连写（R224 坑）。
- 验证（精确命令与读数）：`npx vitest run src/modules/health/system.event.export.fulltext.test.tsx` → EXIT=0，**1 file / 2 passed**（`/tmp/r237-new.log`）。`npx vitest run src/modules/health` → EXIT=0，**28 files / 141 passed**（派工前 27/139 ⇒ +1 file / +2 tests，`/tmp/r237-health.log`）。`./node_modules/.bin/tsc -b . --noEmit` → **TSC_EXIT=2**，`grep -Ec 'modules/health'` → **OWN=0**，报错模块只有 `src/modules/approvals` / `employee-detail` / `employees`（长期基线，`/tmp/r237-tsc.log`）。`npx eslint src/modules/health/system.event.export.fulltext.test.tsx` → **ESLINT_EXIT=0**。全量 `npx vitest run` → **FULL_EXIT=0，371 files / 3226 passed, 0 failed**（54.71 s，`/tmp/r237-full.log`；stderr 只有既有 jsdom「Not implemented: Window's open() method」/「navigation to another Document」）。全量基线因此从 R123 时的 359/3201 抬到 **371 / 3226，零红**（+11 枚上游测试文件与本单的 +1/+2）；无红 ⇒ 不需要隔离复核。
- 三档 N/A：纯测试，零标记/样式改动，几何结论仍沿 R93（本单未跑浏览器腿）。
- 边界：只新增本测试文件 + 本节 DONE；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops（`@/modules/audit/**` 与 `@/shell/console` 只读、只挂载，从未编辑）；未 install、未并 main、未重建 9122、未启停任何服务；未 force / amend / `--no-verify`；零产品码改动；本文件不新增任何产品 testid（`probe-location` 沿用既有证人写法）。
- 挂账：**R226（`web/src/modules/health/system.copy.width.test.tsx`）仍未开工**，其 DONE 号因此顺延为 **R125**；它的三条陈旧前提在案（读源矩阵没有逐行复制、`sys-evt-copy-<j>` 不存在、「复制文本含 rid」与产品相反 —— 分别由 R159 例② / R92 持有）。


## R125 / sys-copy-crosstab — /system 逐行复制跨 tab 同源与两族复制互不沾（纯测试，R237）

- 基线：起自 `751feccb`（R124，= 当时远端 `lane/console-gov`），PORC 0。显式 refspec SSH fetch → `origin/lane/hermes-console` = **`821f46d2f6394b8cb1feff076e645c6d9ec462cc`**，subject `821f46d2 chore(gates): full gate ledger stamped at 69c858af (entry 6g0IMx1G)` — 正是派工点名的「tip 821f46d2 = 代次 69c858af 章笔」。祖先双向核验：`git merge-base --is-ancestor 69c858af origin/lane/hermes-console` → 0；`… 751feccb …` → 0（上游已并入 R124）。`git merge --no-ff` → 合并笔 **`5e845aa1`**，15 文件 +912/−27，MERGE_EXIT=0，PORC 0，**未用 reset**。
- 写域增量 **EMPTY**：`git diff --name-only HEAD^1 HEAD -- web/src/modules/{health,capabilities,skills,tools}` → 无。整个 `web/src` 增量只有 4 个上游文件，全部上游带入、无一由我改：NEW `approvals/approvals.export.truncate.test.tsx`、M `audit/audit.export.detail.open.test.tsx`（上游 R245 本笔被改）、NEW `knowledge/knowledge.export.open.detail.test.tsx`、NEW `knowledge/knowledge.export.order.filter.test.tsx`。
- 幻影合并核验通过（合并后树上行数）：`system.event.copy.paging` 388、`system.event.empty` 489、`system.event.export.fulltext` 403、`system.event.combo` 349、`system.refresh.race` 529、`system.cross.failure` 461、`system.window.isolation` 310。
- **`sys-evt` 族缺席 — 第 31 条道**：`git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src` → **49 处命中，分布在 15 个文件里且全部是 health 的测试文件**（`system.cross.failure` / `system.cross.isolation` / `system.empty` / `system.event.combo` / `system.event.copy.paging` / `system.event.empty` / `system.event.export` / `system.event.export.fulltext` / `system.event.rows` / `system.filters` / `system.matrix.export` / `system.refresh.race` / `system.state.isolation` / `system.time` / `system.window.isolation`），**health 产品码命中 0**。⇒ 派工的 `sys-evt-copy-<i>` / `sys-evt-count` 无对应物，只在 DOM 上断言「不存在」，绝不编造；逐行复制的真面是 `aud01-cell-<key>-request-value`（裸行 `…-request-value-absent`，文本「该字段未返回」，无死按钮）。
- **`?tab=matrix` 是跨模块混称（实测）**：`matrix` 确是 tabId，但属于 **employees** 模块 —— `web/src/shell/routes.ts:149`（`#/employees?tab=matrix`，label「能力与权限」）、`:304` 别名 `#/matrix`、`shell/console.test.tsx:133/:148/:160`、`shell/console.tsx:496`、`modules/matrix/MatrixModulePage.tsx:141`、`App.tsx:1214`。在 `/system` 上 `matrix` 不匹配 ⇒ 折到第一个 pane 系统健康且**不改写 URL**（R135 ③ `system.filters.test.tsx:223`；`resolveTab` 只吃 TAB_ALIAS，`src/shell/routes.ts:450`）。而 `sys-row-copy-<i>` 长在 health pane 的 `sys3-table` 上（`SystemHealthSurface.tsx:535` th「复制」/ :569 td / :572-573 按钮 + 共享的 :601-608 状态与兜底），读源矩阵**没有逐行复制**（只有表级 `sys10-copy` / `sys-matrix-copy`，R159 持有）。测试里以 `expect(tabButton("matrix")).toBeNull()` 如实钉住这一点。
- **「同一读源逐字相等」与产品相反**：health 行来自 `/agent-api/api/health` 的 `sources`（每行共用 payload 顶层 asOf），事件行来自 `/agent-api/api/audit` —— 两次不同的读、两份不同的数据；且两面占互斥的壳 live 槽（`App.tsx:1625` health vs `:1628` events），永不同屏。诚实改写为：**每行的复制文本 == 它自己在屏上的值，两个方向都成立**，并把「跨面互不冒充」做成剪贴板隔离断言。
- **既有覆盖只回证据（不重写）**：R92 `system.rowcopy.test.tsx:93/:137/:154/:195/:220` 全部是**单面挂载**（无 tab 条、无审计面）—— 决定性 grep：`sys-row-copy` 只在 `system.rowcopy.test.tsx` 与 `system.time.test.tsx:227` 被**点击**，`system.empty.test.tsx:194/:226` 只断言存在，其余全是注释；R159 `:195/:226/:267/:302/:329/:358`；R171 `:287/:324/:372/:422`；R224-first `:212/:239/:278`；R228 `:259/:310`；R229（审计失败锚 rid 被点击写全 id）；R230 `:334/:396/:461/:502`；R235（第 i 句复制 == 文件第 i 条第 6 列 == 屏上那格）；R123 `system.event.empty.test.tsx`（两扇门各自的原因句）；R124 `system.event.export.fulltext.test.tsx`（32 位十六进制在屏上折成 8 位短码、文件持全形）；aud 道 R181/R206/R214/R161/R213/R215/R236/R237/R238/R240/R241/R242/R243/R244/R245。
- **本笔新写的三条腿**：① 逐行 `sys-row-copy-<i>` 文本**跨 tab 往返逐字不变**，且两族复制（health 行复制句 vs 事件行 rid）各写自己的串、互不包含对方值，全程零额外请求；② 假时钟 2031 下**两族复制同时**不沾读取时刻（`sys-row-copy-*` 走 mock 助手、`sys10-copy`/`sys-matrix-copy` 走裸 navigator，一个文件里并存），跨 tab 往返仍如此；③ 事件读口 500 时**健康表逐行复制照样可点且写自己那行**（不 disabled、不含失败 rid），失败锚 rid 复制写全 id，恢复后两面各自与自己的屏同源、矩阵存储面一字未动。
- **「切 tab 零新增取数」的诚实倒置**：离开 health 去 events 对 health 四条路径零流量；但**回 health 花整整一批四读**，因为本页没有模块缓存（与 capabilities 的 `cachedSkillsState`/`cachedTools` 相反）；审计面同样无缓存，回去花它自己那一笔。这不是污染，断言全部按「相对已捕获基准」写，不写绝对总数。
- 三处自用例纠正（零产品缺陷、零产品码改动）：(1) 零成本断言的基准必须**在每一次自身会花请求的导航之后重取** —— 一个基准不能横跨两次 tab 切换（首轮 3/3 红在此）；(2) 矩阵耗时列逐读抖动，表级复制文本跨往返必须**折叠后比**（`fold(pipe2)` toEqual `fold(pipe)` 并另断 `pipe2` 仍匹配 `/\d+ ms/`），而 payload 派生的 `sys-row-copy-*` 延迟是确定值、可逐字钉；(3) 本项目无 jest-dom，chai 没有 `startsWith` ⇒ 加 `headOf(text, lead)` 按长度截前缀再比，替换失败面上的那次误用。
- 验证：新文件 **1 file / 3 passed**（`/tmp/r237-new3.log`，exit 0）；定向 `src/modules/health` → **29 files / 144 passed**（开工前 28/141 ⇒ +1 文件 / +3 例）；`./node_modules/.bin/tsc -b . --noEmit` → TSC_EXIT=2，`grep -Ec 'modules/health'` → **0**，报错模块只有 `src/modules/approvals` / `employee-detail` / `employees`（既有基线）；`npx eslint src/modules/health/system.copy.crosstab.test.tsx` → **0**。全量尾行见下方补记（本文件不新增任何产品 testid；`probe-` 与 `crosstab-location` 是本文件私有的测试内证人节点）。
- 三档 N/A：纯测试，零 markup / CSS 增量，几何结论仍按 R93 起效。
- 边界：只新增 `web/src/modules/health/system.copy.crosstab.test.tsx` 与本节；`@/shell/console`、`@/modules/audit/**`、`App.tsx`、`shell/routes.ts` 仅挂载/只读，从未编辑；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops；未 install、未并 main、未重建 9122、未启停任何服务；禁 force/amend/`--no-verify` 一律遵守；零产品码改动。

> 全量实测补记（本笔落盘后）：`cd web && npx vitest run` → **375 files / 3239 passed, 0 failed**，exit 0，51.52 s（stderr 只有既有的 jsdom 「Not implemented: navigation to another Document」/「Window's open() method」×5）。开工前基线 371/3226；合并笔 `5e845aa1` 带入 3 枚上游新测试文件，本笔 +1 文件 / +3 例。

## R126 / sys-event-paging-window — /system 事件表 翻页失败两扇门 · 恢复页窗界 · 末页实话（纯测试，R240 重签发；并入被取代的首发口径@3@）

- 基线：起自 R237 笔 `7a111edc` 之后，本道连并三笔上游基线——`04fb7721`（wave-79，tip `ec12d3e7`）、`f7072041`（wave-80，tip `c1063feb`）、**`6db4e647`**（wave-82）。第三笔的 fetch 实测远端 tip 为 **`dbd5caf2 chore(gates): full gate ledger stamped at 15f58a4d`**——派工点名的 `15f58a4d` 是章笔的父提交（与 R237 的 `821f46d2` 章在 `69c858af` 上同构）；`git merge-base --is-ancestor 15f58a4d origin/lane/hermes-console` → 0（点名的 wave-82 代次确在链上）。MERGE_EXIT=0，PORC 0，**未用 reset**；写域增量 **EMPTY**，整个 `web/src` 增量 = 7 枚上游新测试文件（approvals×2、**audit/audit.export.paging.detail（R249）**、**audit/audit.export.window.detail.paging（R250）**、knowledge×3）。幻影合并核验通过：608/388/489/403/529/461。
- **两单合并交付（如实登记）**：@3@（首发，文件名 `system.event.window.paging`）与 @20@（重签发，文件名 `system.event.paging.window`，四例、commit `test(console): system event paging window guards`）同标 R240 ⇒ 后者取代前者。首发文件从未入库（untracked，`mv` 更名后重写），两单的腿在同一文件里收拢，只交 @20@ 的 commit 题；@3@ 的三例口径（①换代/②逐字/③失败页）在文件内按 @20@ 的四腿重排，无重复用例。另：**R238 的单（`system.event.export.paging.test.tsx`）从未落盘**——其锁定残腿（组合地址失败态导出门、`aud5-export-count` 0 面、失败锚 rid 点击、恢复四值方程）已全部落在本文件，不另补。
- **查重与只回证据（不重写）**：①「第 2 页后切窗」整条已由我自己的 R235 `system.event.copy.paging.test.tsx`:343 钉死（游标清零、行替换非累加、两读数条重算、恰 +1、窄文件零旧行），:289 钉第 2 页复制⇄文件位置序；另有 R221 :276、R225 :198、上游 R243 :312。本文件不写 ①。②的【其余列】首行同源归上游 R249 `:324`（裸 /audit、抽屉开着、满列、rid 位置序——但它没碰时间格）；③的门与零请求零 Blob 裸 /audit 语境归 R250 `:287`，恢复页满列与三问账本归 R250 `:314`，重试恰 +1 与「非并集」归 R213 `:302`，末页「禁用为真+可见句在场+title 缺位」归 R161 `audit.paging.test.tsx` 头 :23-25 与 :317。
- **本文件四腿（全部走组合地址 `/system?tab=events&window=30d`，上游同族都在裸 /audit）**：③失败面——行清空后 `aud5-export-count` 逐字「将导出 0 条」（产品 :1620 无条件，失败态首钉；R181 :216 只在空态钉过）、`aud01-status` 无数字错误句「审计事件读取失败」且 `shownOf === -1`（组合地址首钉）、两扇门各自关死带**各自**title（组合地址重申）、强点零 URL 零 Blob 账本不动（基准在失败落定后重取）、**失败锚 rid 被点击**落全形 `req-window-p2-500` 且零取数（R250 只看文本/R244 只看钮在场/R229 点的是首屏失败）；③恢复面——重试恰 +1、`listReads() === 3`、`cursorsOf === ["cur_rows2"]`、行集 `[MID, TAIL]` 非并集、**物理行数**==表体不产半页空行（R250 的 dataLines 滤空行，看不见这一层——它的头承诺「不产半页空行」由其自己的助手遮蔽，本文件用未过滤的原始行拆穿）、恢复集合 value/absent 分裂 `[MID]`/`[TAIL]` + 裸行「该字段未返回」无死钮（R250 恢复页两行都带 rid，无此层）、`copyRow(MID) === RID_MID === 文件格`；②——每条文件时间格匹配北京时间分钟形且落在该请求自己的 from/to 对内（**文件的时格对窗此前无人钉过**，屏上边界归 R203 :216）、无翻车第 2 页首行时间格 == 屏上 dd 折分钟、rid 格 == 屏上值列、上一页 rid 不渗；④——末页 `aud01-load-more` 在场但 disabled、**title 为 null 如实断言**、「这一页就这些了。」可见、状态句无「下面还有更多」、两读数条与表体同数、`sys-evt-more` 缺席。
- 两处口径裁决（现场登记在 expect 标签里）：「第 2 页 500 **保旧行**」与产品相反——**第六次到达**（R161 :339/:361 + 其头 :19-21；R244 头 (b) + :316；R213 :302；R235 头；R250 :287 自己也按此登记），可达的 load-more 失败是整页替换，追加腿唯一重试调用点在 `aud01-page-failure` 内、现界面够不到，本文件断真实清空、不伪造保留；「末页 disabled + **title**」后半句与产品相反——钮没有 title，「服务端没有再给下一页的游标」是技术详情折叠里的一行（产品 :2117），不是悬停标题（R161 头 :23-25 持有口径）。
- `sys-evt` 族缺席——**第 32 条道**（基线 `6db4e647` 实测）：57 命中分布在 16 个文件、全部是 health 的测试文件，health 产品码 0；工单点名的 `sys-evt-copy-<i>`/`sys-evt-count`/`sys-evt-more` 无对应物，只在 DOM 断言缺席，三面诚实重形成 `aud01-status` + `aud5-export-count` + 逐行 `aud01-cell-<key>-request-value`/`-request-value-absent`。health 产品码读 `?window=` 亦为 0 命中（矩阵/`sys3-table` 对窗惰性）。
- 一处自用例纠正（零产品缺陷、零产品码改动）：首轮 3/4 绿，唯一红在「首行时间格 == 屏上 dd 逐字」——**实测屏上 `-time` 的 dd 是秒形**（`2026-11-19 13:00:00`），文件格是同时刻折分钟（`2026-11-19 13:00`）；改为断言 dd 匹配秒形 + 文件格 === dd 前 16 字符，把「屏上秒形 vs 文件分钟形」的折叠关系本身钉成结论（第二轮 4/4 绿）。BOM 坑预检：写作时用 `/^\uFEFF/` 转义形，`sed -n 'l'` 抽查无字面 U+FEFF。
- 验证：新文件 **4/4**（`/tmp/r240b-new2.log`，exit 0，2.15 s）；定向 `src/modules/health` → **30 files / 148 passed**（开工前 29/144 ⇒ +1 文件 / +4 例），exit 0；`./node_modules/.bin/tsc -b . --noEmit` → TSC_EXIT=2（既有基线），`grep -Ec 'modules/health'` → **0**，报错模块只有 approvals / employee-detail / employees；`npx eslint` → **0**。全量实测补记见文末。
- 三档 N/A：纯测试，零 markup / CSS 增量，几何结论仍按 R93 起效。
- 边界：只新增 `web/src/modules/health/system.event.export.paging.test.tsx` 与本节；`@/modules/audit/**`、`@/lib/**` 只挂载/只读，从未编辑；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops；未 install、未并 main、未重建 9122、未启停任何服务；未 force / amend / `--no-verify`；零产品码改动；本文件不新增任何产品 testid（`probe-location` 是私有证人节点）。挂账：**R226 仍未开工**（其 DONE 号因此再顺延为 **R128**）；R239（`system.copy.tab.export.test.tsx`）另笔交付。

> 全量实测补记（本笔落盘后）：`cd web && npx vitest run` → **Test Files 1 failed | 387 passed (388) ／ Tests 2 failed | 3275 passed (3277)**，exit 1，92.36 s。两枚红**全在 `src/modules/metrics/MetricsModulePage.test.tsx`**：`:307` 「really switches windows: 7d and 30d issue their own request and numbers」断 `met6-sparkline` 的 `rect` 数（期望 1，实得 0），metK 「describes the trend with first, last, peak and low from the same slots」断同一 svg 的 `role`（期望 `'img'`，实得 `undefined`）——即该迷你图整块没上屏。独立性证据：`git diff --stat 7a111edc HEAD -- web/src/modules/metrics` 与 `git log --oneline 7a111edc..HEAD -- web/src/modules/metrics` **皆空**（metrics 自上一笔全量绿以来逐字未动），且把本笔文件排除后单跑该文件仍 **2 failed / 209 passed**（`/tmp/r240b-metrics.log`，exit 1）。疑因（未证，只登记不定罪）：两次全量相隔 35 分钟而跨过 UTC 日界（上次「Start at 07:38:11」本地 = 2026-11-20T23:38Z，本次「Start at 08:13:44」= 2026-11-21T00:13Z），该例用真实 `Date.now()` 推 7 天窗，fixture 行被推出窗外；属 metrics 域、本单禁域外改动，故未动一行。本笔文件改名后单跑 **4/4**，exit 0，1.55 s（`/tmp/r240b-renamed.log`）。

> 交付路径让位登记（应硬检查点第 2 次）：本笔按派工点名的 **`web/src/modules/health/system.event.export.paging.test.tsx`** 落盘、commit 主题用 **`test(console): system event export paging guards`**；重签发单曾要求的 `system.event.paging.window.test.tsx` / `…paging window guards` 因此让位（内容四例与逐字断言不变，仅路径与主题随最新口令）。

## R127 / sys-event-copy-export-cross — /system 事件表复制句 × 导出文件 × tab 往返三面互不沾（纯测试，R241；并入被取代的 R239）

- 基线：起自 `fea18423`（R126，= 当时远端 `lane/console-gov`），PORC 0。显式 refspec SSH fetch → `origin/lane/hermes-console` = **`e81c4f74f124527209c1f724fd187b2042e9fb5b`**，subject `e81c4f74 chore(gates): full gate ledger stamped at 6632f340 (entry CUhV51_R)` —— 派工点名的 **`6632f340`（wave-88）是这枚代次章的父笔**，与 R237 的 `821f46d2`-on-`69c858af`、R240 的 `dbd5caf2`-on-`15f58a4d` 同型。祖先双向核验：`git merge-base --is-ancestor 6632f340 origin/lane/hermes-console` → 0；`… fea18423 …` → 0（wave-84 已在 `7d8eaeaa merge(lane): fea18423 (wave-84)` 并入 R240）。上游首父尾：`e81c4f74 → 6632f340 (merge 7e14a7f7, wave-88) → 589a7b67 → 72e1ea2c → d830d857 → ccca821f`。`git merge --no-ff` → 合并笔 **`d5a51d0e`**，MERGE_EXIT=0，PORC 1（只有本文件这一枚未跟踪路径），**未用 reset**。
- 写域增量 **EMPTY**：`git diff --name-only HEAD^1 HEAD -- web/src/modules/{health,capabilities,skills,tools}` → 无。
- **wave-88 是第一枚往我基线里带产品码的波**：整个 `web/src` 增量 14 文件 = 10 枚上游新测试（`approvals/approvals.export.detail.paging` / `…edge.cells` / `…tab.rowcopy`、`audit/audit.detail.copy.a11y` / `audit.export.detail.empty` / `audit.export.rowcopy.cross`、`knowledge/knowledge.detail.export.empty` / `…filters.rowcopy` / `…paging.filter` / `…paging.filters`）+ 4 枚被改，其中三枚是产品/测试码：`modules/audit/AuditEventsModulePage.tsx`（+10，给 `aud01-empty` 接上 `clear` —— custom 窗给「清空区间，回到最近 7 天」、类型筛选给「清掉类型筛选，回到全部类型」）、`modules/audit/states.tsx`（+45，`EmptyPanel` 新增可选 `clear`，动作区落成 `${testId}-actions`，清空钮落成 `${testId}-clear`，内边距/字号换成 `--space-*` token；`ErrorPanel` 同款 token 化）、`modules/metrics/MetricsModulePage.test.tsx`（+18）、`modules/tasks/TasksBoardModulePage.tsx`。**我一个字没动这些**，且它们没弄坏我任何一笔（见下验证）。
- 幻影合并重计 **通过**（合并后树上行数）：`system.copy.crosstab` 608 / `system.event.copy.paging` 388 / `system.event.empty` 489 / `system.event.export.fulltext` 403 / `system.refresh.race` 529 / `system.cross.failure` 461 / `system.event.export.paging` 516 / `system.window.isolation` 310 = 3704。
- **派工链与「幻影回执」的反向教训**：R241 的 @fixer 回报 `state: cancelled`「Subagent cancelled」且**没有任何回执**。按纪律我不相信任何一种方向：`git status --porcelain` 显示那枚未跟踪文件**确实在盘上**（420 行 / 4 个 `it` / 31054 字节），随后 eslint、tsc、定向 health、全量四项实测全部绿，才认定它可交付。反过来也成立：取消回执 ≠ 零写入，未跟踪产物必须用 git + 行数 + lint + 测试鉴别，不能凭回执措辞。
- **`sys-evt` 族缺席 —— 第 33 条道**：`git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src` → **65 处命中，分布在 17 个文件里且全部是 health 的测试文件**（在 R237 的 15 枚之外，新增 `system.event.export.paging`（R240 自己）与 `system.event.copy.export.cross`（本文件）），**health 产品码命中 0**；非测试代码命中亦 0。⇒ 工单的 `sys-evt-copy-<i>` / `sys-evt-count` 无对应物，只在 DOM 上断言「不存在」，绝不编造；逐行复制的真面是 `aud01-cell-<key>-request-value`（裸行 `…-request-value-absent`，文本「该字段未返回」，无死按钮），计数真面是 `aud01-status` 与 `aud5-export-count`。
- **工单口径与现状不一致处，按现状钉死并登记**：
  (a) **①「复制句与 CSV 同行的 类型/结果/时间 逐字」** —— 复制控件只交请求编号这一列（`CopyValue` 的语义），一句里根本没有类型/结果/时间。钉法拆两侧：该记录的 rid 格 === 那一句；同一记录的 类型/结果/时间 三格只与**屏上它自己**的话对齐。附带两处实测：结果列的 testid 是 `aud01-cell-<key>-result`（span 包 Badge），**`-outcome` 不存在**；`-type` 是 button 包 span，只有 `-time` 是 Field（dt+dd），而屏上 dd 是**秒形**、文件是同瞬的**分钟形** ⇒ 只有 `slice(0,16)` 可比。历史 copy↔CSV 对撞从未出过 rid 列（`system.event.export.fulltext.test.tsx:356`/`:400`、R240 `:452` 是仅有的 `copyRow(` 近 csv 站点），所以「类型/结果/时间三格 vs 复制句」是新层。
  (b) **②「切到 matrix tab」** —— `matrix` 是 **employees** 模块的 tabId（`web/src/shell/routes.ts:149` label「能力与权限」、`:304` 别名 `#/matrix`、`App.tsx:1214`），在 `/system` 上不匹配 ⇒ 折到第一个 pane 系统健康且不改写 URL。测试以 `expect(tabButton("matrix")).toBeNull()` 如实钉住，然后在 health 面上做真正的新层：**导出文件与 `sys-row-copy-*` 复制句双向互不沾**。
  (c) **③「tab 往返零新增取数」** —— 与产品相反：离开 health 去 events 对 health 四条路径零流量，**回 health 花整整一批四读**（本页没有模块缓存，与 capabilities 的 `cachedSkillsState`/`cachedTools` 相反），审计面回去也花它自己那一笔。算术归 `system.window.isolation.test.tsx:212`/`:239`/`:278`，本文件只钉**计数位不漂**：离开前与返回后 `aud01-status` / `aud5-export-count` 是同一个 N，且仍等于屏上行数；断言全部按「相对当场重取的基准」写，不写绝对总数（一次基准不能横跨两次 tab 切换 —— R237 的坑）。
  (d) **④「单表 500 时另一 tab 导出仍可用」** —— 行集为空时导出必然关死：两扇门按 `auditGates.ts:102`/`:107` 各自的标题关着（「当前筛选没有可导出的记录」/「当前筛选无事件可导出」），`aud5-export-count` 老实「将导出 0 条」。按实测关门钉，不伪造可用。本条真正的新层是把 R124 的「折叠 vs 全形」与 R237 的「500 隔离」装进**同一次挂载**：32 位十六进制 rid 在屏上折成 8 位短码、文件同一格持全 32 位（实测 `length === 32`），而 health 面与矩阵存储面不被这次失败污染。
- **既有覆盖只回证据（不重写）**：R235 `system.event.copy.paging.test.tsx:289`（第 2 页复制句 ≡ 文件非空 rid 格，位置序，零成本）；R221 `system.event.export.test.tsx:315`（CSV↔屏逐格词，含显示名 + 8 位短码、无裸内部 id）；R124 `system.event.export.fulltext.test.tsx:356`/`:400`（折叠 vs 全形）；上游 R249 `audit.export.paging.detail.test.tsx:324`（三处一个数、全列按屏序 —— 但它从未碰时间列）；R240 本道 `system.event.export.paging.test.tsx:334`/`:387`/`:462`/`:496`；`system.matrix.copy.test.tsx:267`（刷新时刻不进复制句）与 `system.matrix.export.test.tsx:302`（读取时刻不进文件）；`system.window.isolation.test.tsx:212`/`:239`/`:278`（tab 往返取数算术与矩阵冻结）；R237 `system.copy.crosstab.test.tsx` 例③（500 期间 health 行复制仍可点且写自己那行）。
- **本笔净新四条腿**：① 复制句只交请求编号一列 + 该记录 类型/结果/时间 三格只与屏上自己的话对齐（含 `-outcome` 不存在、`-result` 才是真名、屏秒形 vs 文件分钟形只能 `slice(0,16)` 三条实测）；② 导出文件与 health 行复制句**双向**互不沾（此前只有 copy-vs-copy）；③ tab 往返前后计数位同一个 N 且仍等于表体；④ 审计 500 同一次挂载里屏上短码与文件全形对撞、门按实测关死、health 面不被污染。
- 验证：新文件单独跑 **1 file / 4 passed**（`/tmp/r241-new.log`，exit 0，2.25 s）；定向 `src/modules/health` → **31 files / 152 passed**（开工前 30/148 ⇒ +1 文件 / +4 例，`/tmp/w88-health.log`）；`./node_modules/.bin/tsc -b . --noEmit` → TSC_EXIT=2（既有基线），`grep -Ec 'modules/health'` → **0**，报错模块只有 `src/modules/approvals` / `employee-detail` / `employees`，日志里没有出现本文件名；`npx eslint src/modules/health/system.event.copy.export.cross.test.tsx` → **0**；全量 `npx vitest run` → **405 files / 3318 passed, 0 failed**，exit 0，49.75 s（`/tmp/w88-full.log`，stderr 只有既有 jsdom 「Not implemented: Window's open() method」）。**开工前全量是 388/3277 带两枚 metrics 红；wave-88 的 `MetricsModulePage.test.tsx` +18 修掉了它们 ⇒ 全量零红的新基线 405/3318。** 另：`csvRecords` 的 BOM 剥离用的是转义 `/^\uFEFF/`（python 逐字节核 `LITERAL_UFEFF_COUNT = 0`），头注释里不含 `*/` 序列。
- 三档 N/A：纯测试，零标记/样式改动，几何结论仍沿 R93（本单未跑浏览器腿）。
- 边界：只新增 `web/src/modules/health/system.event.copy.export.cross.test.tsx` 与本节；`@/shell/console`、`@/modules/audit/**`、`./HealthPage`、`./sourceReads`、`App.tsx`、`shell/routes.ts` 仅挂载/只读，从未编辑；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops / 任何产品码 / metrics；未 install、未并 main、未重建 9122、未启停任何服务；未 force / amend / `--no-verify`；零产品码改动；本文件不新增任何产品 testid（`probe-` 前缀与 `probe-location` 是私有证人节点）。
- 挂账：**R245（重签发）点名的 `system.event.export.paging.test.tsx` 已存在** —— 它就是 R240 那笔 `fea18423`（516 行 / 4 例，DONE R126，wave-84 已并入），其 ①②③ 由 `:462`/`:387`（三值与页数收敛）、R235 `:343`（翻页后切窗：游标丢弃、行替换非累加、两枚读数条同动、恰 +1 读、零残留）、`:334`（第 2 页 500 两扇门 + 失败锚 rid 全形）持有 ⇒ 按工单自己的「已覆盖只回证据」条款**只回证据、不写重复文件**。**R242**（`system.event.window.paging.copy.test.tsx`）与 **R243/R244**（`system.export.tab.retain.test.tsx`）均未落地：R243 的 ③ 由 R123 `system.event.empty.test.tsx:437` 全文持有（非法窗下两扇门 disabled + 各自标题 + 强点 `urlCalls === 0`/`blobCalls === 0`），② 的「往返后导出」缺口已被本文件例③ 的计数位不漂吸收一半；R242 的 ①②④ 近似全覆盖，唯一候选残量（事件行时刻不冒充 health 读取时刻）已由本文件例② 与 R221 `:394` 覆盖。**R226（`health/system.copy.width.test.tsx`）仍未开工**，其 DONE 号因此顺延为 **R128**。


## R128 / sys-retention-tab-window — /system 保留策略面「时间窗惰性 · 往返守恒 · 非法窗不上线路」（纯测试，R246）

- 基线：起自 HEAD = 远端 `aaae8388`（R241，PORC 0）。显式 refspec SSH fetch → `origin/lane/hermes-console` = **`36fc394a2a2d6ba4204612c5a89b33caca3091aa`**，subject `36fc394a chore(gates): full gate ledger stamped at 03cd4658 (entry Chru2g4H)` —— 派工点名的 **`03cd4658`（wave-91）是这枚账本章的父笔**（与 R237 `821f46d2`-on-`69c858af`、R240 `dbd5caf2`-on-`15f58a4d`、R241 `e81c4f74`-on-`6632f340` 同型）。祖先双向核验：`git merge-base --is-ancestor 03cd4658 origin/lane/hermes-console` → 0；`… aaae8388 …` → 0（上游已并入 R241）。上游首亲尾：`36fc394a → 03cd4658 (merge c90bcb5d, wave-91) → c5db286e (40b4fae2) → 83355899 (0d55fbd7) → 30b41a25 (stamp at df4b4112) → df4b4112 (285ef5e5, wave-90) → 6880d29f (8686509a) → bac63938 (66cf0ca1)`。`git merge --no-ff` → 合并笔 **`9b82898e`**，MERGE_EXIT=0，PORC 0，**未用 reset**。
- 写域增量 **EMPTY**（`web/src/modules/{health,capabilities,skills,tools}` → 无）。整个 `web/src` 增量 10 文件：NEW 上游测试 7 枚（`approvals/approvals.export.closed.state`、`approvals/approvals.export.closeddetail`、`approvals/approvals.export.rowcopy.same`、`audit/audit.detail.export.paging`、`audit/audit.export.detailcopy.same`、`knowledge/knowledge.space.export.filters`、`metrics/metrics.export.window`）+ **产品码 3 枚被改**：`duty/DutyPage.tsx`、`duty/duty.css`、`matrix/MatrixModulePage.tsx`（wave-90/91 再次带产品码入我的基线——全部在我写域之外，我零编辑；见下方「全量实测补记」：并入后我的全部文件照常绿）。
- 幻影合并核验通过（合并后树上行数）：`system.copy.crosstab` 608 / `system.event.copy.paging` 388 / `system.event.empty` 489 / `system.event.export.fulltext` 403 / `system.refresh.race` 529 / `system.cross.failure` 461 / `system.event.export.paging` 516 / `system.event.copy.export.cross` 420 / `system.window.isolation` 310 = **4124**。
- **产品真相（只读实测，决定三例口径）**：(1) `retention` 是真系统 tab，但走 **App 层短路**而非 live 槽 —— `App.tsx:1610-1640` `SystemAwareTabs()` 读 `useSearchParams()`，`tab === "retention"` 整页换成 `<RetentionConsolePage />`（`:109` lazy 自 `@/modules/audit/RetentionModulePage`），其余情况才挂 `<ConsoleModulePage module="system" live={{health, defaults, version, events}}/>` ⇒ 保留态下**没有 tab 条、没有事件面**，往返只能靠深链导航。(2) 壳层别名早已钉过（只回证据）：`shell/routes.ts:257` compat-tab `visible: false` + `:348` `system: { retention: 'events' }` TAB_ALIAS、`shell/bridge.test.ts:55`、`shell/console.test.tsx:121-122`「retention still aliases to events」。(3) 保留面**不吃 URL**：`RetentionModulePage.tsx:261-262` 只读 `state`/`rid` 强制预览参，`git grep 'get("window")|searchParams'` 于 `RetentionModulePage.tsx`/`retention.ts` → **0 命中**；唯一一问是 `:297` 的 `fetchJSON(RETENTION_PATH, undefined, { allowUnauthorized: true })` —— 裸常量路径 `/agent-api/api/retention`（`retention.ts:26`），**无参数、无游标**。(4) 后端实况：`retention.ts:5-12` 记录八个候选读口全部 404 `{"code":"console.unknown_route"}` —— 「四区全部未接入」态，`probeOf` 判 kind=unwired → `unwiredSections()` 四行 + phase "unwired"，摘要句「N 个区块都未接入：这个环境没有可读的保留策略源。」，`ret4-asof` 仅在 asOf 非空时渲染（未接入态为 null）。
- **现场裁决（与派工口径不一致处，按现状钉死并登记）**：
  (a) ①「请求带 window 无 cursor」——**window 半句与产品相反**：保留面盲于 `?window=`，线路上只有裸 `RETENTION_PATH`，连 query 都没有；「无 cursor」倒是天然成立（无任何参数）。这是「`?window=` 只被 audit/duty/runs 读」家族的**最新一站**（此前测过 health 产品码 0 命中，今天测过 retention 0 命中）。钉法：`urls()` toEqual `[RETENTION_PATH]` + `auditAsks() === 0` + 地址逐字不改（页面从不回写 `window`，`state`/`rid` 之外的键事件侧不碰）。
  (b) ①「`sys-evt-count`==表体」——锚不存在，**第 35 条道**：`git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src` → **70 处命中 / 18 个文件，全部是 health 的测试文件**（较 wave-84 的 65/17 多出的 5 处来自 R241 的 cross 文件），**health 产品码 0 命中** ⇒ 计数面诚实重构为 `ret4-summary` 逐字 × 四枚 `ret4-section-*` 卡（4 == 4，「4 个区块」句与卡数互证），并在两例里断言零 `[data-testid^='sys-evt']`，绝不编造。
  (c) ②「切回 events 再切回 retention，行集与页码复原、**零新增取数**」——**与产品相反**：events 侧没有模块缓存，回程恰花 **+1 问**（它自己那一页的重读），且**游标不随卸载存活** —— 回来是第 1 页、第 1 页的行集（`cursorsOf(lastAuditRead()) === []`、「第 1 页」、`aud01-status`「已显示 2 条」、`aud5-export-count`「将导出 2 条」）。「行集与页码复原」只有「与首载同集同页」这一半成立。诚实的另一半钉在 **retention 侧**：首读之后分文不花 —— 停留 10 ms 不加问、离开去 events 也不加问（`retentionAsks()` 恒 1）。往返算术的既有账归 `system.window.isolation.test.tsx:212/:278` 与 R241 例③（本文件的算术只数 retention/events 两族，live 槽用裸 div 占位保证不外溢）。
- **既有覆盖只回证据（不重写）**：aud 侧 `RetentionModulePage.test.tsx`（283 行）`:78`（四区未接入逐条列出、永不打印 0）/`:104`（两枚写动作是禁用占位）/`:126`（缺口只进标题与技术折叠）/`:177`（403 与 404 同一拒绝句、rid 可复制）/`:199`（失败句+rid+重试再问）/`:223`（骨架）/`:243/:250/:258`（强制预览 loading/empty/error）/`:270`（阈值提示）；`retention.test.ts`（188 行）`:31/:48/:83/:92/:102/:112/:118/:137/:146/:158/:168/:182`（404 console.unknown_route=未接入而非拒绝、缺字段留空不为 0、HTTP 码不进句子等）；壳层 `bridge.test.ts:55`、`console.test.tsx:121-122`、`routes.ts:257/:348`；事件侧非法窗由 R123 `system.event.empty.test.tsx:437` 钉（组合地址、地址逐字、两扇门、0 只在导出读数）——**本文件钉的是保留面这一站**：`__nope__` 令牌不上线路、地址不改、`ret4-page` 页锚在、页面无「0 条」也无「__nope__」字样。
- **本笔新写的三条腿**：① 深链 `?tab=retention&window=7d` 整页换成保留面 —— 唯一一问裸路径零参数、地址一字不改、摘要句逐字、四卡在场、`ret4-asof` 缺席、`ret4-unwired-note` 与 `ret4-tech-details` 在、无 tab 条、零 `aud01-*`、`sys3-table` null、零 `sys-evt*`，收尾仍只有一问；② events↔retention 往返 —— retention 首读后分文不花（含离开方向），回程 events 恰 +1 且从第 1 页第 1 集重来（游标不存活），`ret4-page` 在 events 态缺席；③ 非法 `?window=__nope__` 落保留面 —— 令牌不上线路、地址逐字、页锚在、可读空态是句子不是裸 0。
- 一处自用例纠正（零产品缺陷、零产品码改动）：`NavProbe` 在渲染期回写模块级 `navTo` 触发 eslint `react-hooks/globals` ⇒ 改为 `useEffect(() => { navTo = navigate; }, [navigate])` 捕获；修后 eslint 0、文件重跑 3/3 绿。另：页级负断言（「0 条」/`__nope__` 不出现）一律作用在 `pageText()`（只取 `ret4-page` 的 textContent）而非整容器 —— 证人节点 `probe-location` 的地址文字含 `__nope__`，用容器文本会被自己污染（既有坑「scope whole-container negatives to the anchor node」的又一实例）。
- 三档 N/A：纯测试，零 markup / CSS 增量，几何结论仍按 R93 起效。
- 边界：只新增 `web/src/modules/health/system.retention.tab.test.tsx` 与本节；`App.tsx`、`@/shell/console`、`@/modules/audit/**`（`AuditEventsModulePage`/`RetentionModulePage`/`retention.ts`）仅挂载或只读，从未编辑；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops / duty / matrix / metrics；未 install、未并 main、未重建 9122、未启停任何服务；禁 force/amend/`--no-verify` 一律遵守；零产品码改动；本文件不新增任何产品 testid（`probe-location` 与 nav 捕获是私有证人节点）。
- 挂账：**R242/R243/R244 仍未写**（处置在 R127 挂账：R243③ 由 R123 `:437` 持有、R244② 的「往返后导出」半截缺口仍在、R242③ 已由 R241 例②+R221 `:394` 持有）；**R226（`health/system.copy.width.test.tsx`）仍未开工**，其 DONE 号因此顺延为 **R129**。

> 全量实测补记（本笔落盘后）：`cd web && npx vitest run` → **413 files / 3332 passed, 0 failed**，exit 0，40.24 s（stderr 只有既有 jsdom 「Not implemented: navigation to another Document」/「Window's open() method」×5）。开工前零红基线 405/3318；wave-91 合并笔 `9b82898e` 带入 7 枚上游新测试文件与 duty/matrix 三处产品码改动，本笔 +1 文件 / +3 例 —— 上游产品码并入后我的全部 health 文件照常绿。

## R129 / sys-row-event-copy-cross — /system 换窗插在往返中间与两族复制的反馈形制（纯测试，R248；并入被取代的 R247）

- 基线：起自 HEAD `737696e8`（wave-93 并笔，上游 = 派工点名的 **`b61ca557d9e53ab68f19204c1900b0b64bd87a47`** = `fix(gates): stamp shots summary head and entry at dc9341dd`——本波点名 tip 就是真提交，无账本章间接层）。祖先双向核验：`b61ca557` → 0；我的 `b15d9008`（R246）→ **0（上游已在 wave-93 `21052fa3 merge(lane): b15d9008 (wave-93)` 并入 R246）**。MERGE_EXIT=0，32 文件 +1068/−125（多为 `docs/_artifacts/tonight/*` 门禁工件），PORC 0，**未用 reset**。写域增量 **EMPTY**（health/capabilities/skills/tools 四目录 `git diff --name-only HEAD^1 HEAD` → 无）；整个 `web/src` 增量 = 上游带入 3 枚新测试：`approvals/approvals.detail.links.test.tsx` +234、`audit/audit.export.closed.detail.test.tsx` +287、`metrics/metrics.rowcopy.summary.test.tsx` +424，零产品码。幻影合并复核通过：608/388/489/403/529/461/516/420/310/320 = **4444**。本次推送同时携带两笔此前未推的基线并笔：`f688a615`（R247 的 wave-92 并笔，上游点名 `09f1ba9f` 即并笔本身，2 枚上游新测试，写域增量同样 EMPTY）。
- **R247（@126@，`system.event.copy.a11y.test.tsx`）被本单取代、从未落盘**：其三条前提的两条在半途实测中被产品事实否决——`sys-evt-copy-<i>` 缺席（36 条道）；`CopyValue` 根本不渲染任何播报节点（见下②），「复制成功 role=status 只播一次」与产品相反。它的测量成果直接成为本笔测试②的核心。
- **`sys-evt` 族缺席 — 第 36 条道**：`git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src` → **75 处命中 / 19 个文件（全部 health 测试文件）**，health 产品码 **0** 命中（wave-93 未改变此数）。事件面逐行复制的真面是 `aud01-cell-<key>-request-value` 里的按钮（`aria-label` 「复制请求编号」），裸行为 `-request-value-absent`（文本恰「该字段未返回」，无按钮）。全篇只断言缺席，绝不编造。
- **② 的缺口证明（现查）**：`git grep -l -E "window=7d|window=24h|window=30d|filter-window" -- src/modules/health` ∩ `git grep -l "sys-row-copy-" -- src/modules/health` → **零文件交集**。R237 做过 tab 往返但没换窗；R235 做过换窗（`aud01-filter-window-24h`，handler 侧 `windowHours <= 25` 选页）但挂载里没有 health 复制族。没人钉过「事件侧换窗时 health 复制族一字不动」。
- **结构性约束**：`App.tsx:1625`（health）与 `:1628`（events）是互斥 live 槽——events 在屏时 `sys3-table` 与全部 `sys-row-copy-*` 节点不存在（R237 `:439` 钉过 null）。换窗必须插进 health↔events 往返的**中间**，比较离屏前捕获的复制句与回屏后的复制句。
- **本笔两条净新腿**：① 「事件侧换窗插在往返中间」——离屏前 `copyHealthRow(0)` === `ROW_ZERO` 捕获为基准；去 events 验宽窗行集与宽 rid；重取三个读数基准；点 `aud01-filter-window-24h` → `auditReads() === auditBase + 1` **且 `healthReads() === healthBase`**（换窗对 health 四条路径零流量），线路上 `paramOf(read,"window")` 为 null、`cursorsOf` 为空，窄窗复制句是窄 rid 且不含另一窗的任何 rid，`probeFaces()` 逐字不动；回 health → `healthReads() === healthBase + 4`（**现场裁决：回程花掉 health 自己一整批四读——两面都没有模块缓存；工单的「零新增取数」与产品相反**），随后 `copyHealthRow(0)` 与基准**逐字相同**（window-inert 的决定性证明），状态句「已复制」，复制句不含任何窗的事件 rid 也不含 `evt_` 前缀。② 「两族复制的反馈形制不同」——health 族有 `sys-row-copy-status`（`SystemHealthSurface.tsx:602`，`role="status"` + `aria-live="polite"`，兜底框 `sys-row-copy-fallback-text` 在助手点头时为 null）；事件族 `CopyValue`（`states.tsx:497-550`）**渲染零个播报节点**——现场裁决：工单的事件侧 role=status 前提与产品相反，且**本 pane 唯一的 role=status 是 `aud-detail-copy-status`，它就挂在列表 pane 上（`AuditEventsModulePage.tsx:1390`）**，我派工简报里「不在本 pane」的说法是错的，测试按产品事实钉：pane 级 role=status 节点集恰 = `["aud-detail-copy-status"]`，行格子树内 `[role='status'], [aria-live]` 为零，`[data-testid^='aud01-cell-'][data-testid$='-status']` 为零；按钮自己的文本变「已复制」。**本文件永不冻结计时器**：「已复制」的 2500 ms 复位是真 `window.setTimeout`（`states.tsx:542`），回执必须在点击后立刻读。失败尾巴经 donor 的「flags 先于 tab 切换」机制接上：失败锚复制写全形 `FAIL_RID`、零额外读、矩阵面仍 `ok|` 开头无「|—|」——该腿归 R120 `system.cross.failure.test.tsx:304/:359/:395` 与 R237 `:538`，此处只作收束。
- **既有覆盖只回证据（不重写）**：R237 `system.copy.crosstab.test.tsx:404`（tab 往返本体、两族各写自己的串）；R235 `system.event.copy.paging.test.tsx:343`（换窗本体：游标丢弃、行替换非累加、+1 读）；R241 `system.event.copy.export.cross.test.tsx:246`/`:279`（复制句只交 rid 列 × 导出文件与 health 复制句互不沾）；R120 `system.cross.failure.test.tsx:304/:359/:395`（500 隔离与双锚 rid）；`system.window.isolation.test.tsx:212/:278`（往返取数算术的家）。
- **wave-94 只读预览（未合并，修者尚在树内）**：`git show` 读三枚上游新测试——`audit/audit.window.copy.parity.test.tsx`（上游 R261，+345，单 `it` `:302`「swaps the reading into the row, the pane, the copy and the file at once」，裸 `/audit`；它登记「已打开的抽屉不随换窗换代（读数冻结），同步发生在重开之后」）；`approvals/approvals.export.summary.parity.test.tsx`（`:238/:258/:284`，approvals 域）；`audit/audit.export.header.parity.test.tsx`（`:251/:283`，裸 `/audit`）。**三者都不触碰 health 复制族 ⇒ 对本笔 novelty 与 R249 处置零威胁。**
- **两处自用例纠正**：(1) `LocationProbe` 用 testid `probe-location`，被 donor 的 `[data-testid^='probe-']` 证人选择器扫进 `probeFaces()`（donor 当年为此改名 `crosstab-location`）——修法是在 `probeFaces()` 里按名排除 `probe-location`，头部按简报强制了这个名字；(2) pane 级 `[role='status']` 计数期望 0 实得 1——即上面的产品事实裁决（DetailCopy 在列表 pane 上），改钉节点**集合**而非空计数。两轮红，未用满三次配额。
- **交付核验（幻影回执纪律反向适用）**：修者回报完整，仍独立复核——`git status --short` 恰一枚未跟踪路径、`git diff --stat HEAD` 空、327 行 / 2 个 `it`（`:231`/`:278`）、python 扫 `LITERAL_UFEFF_COUNT = 0`、全文无真块注释（唯一 `/*` 在 `//` 行注释内的 `@/modules/audit/**` 里，无害）。
- 验证：新文件 **2/2**（`/tmp/r248-new.log`，exit 0）；定向 `src/modules/health` → **33 files / 157 passed**（开工前 32/155 ⇒ +1 文件 / +2 例）；`./node_modules/.bin/tsc -b . --noEmit` → TSC_EXIT=2（既有基线），`grep -Ec 'modules/health'` → **0**，报错模块只有 `src/modules/approvals` / `employee-detail` / `employees`；`npx eslint src/modules/health/system.copy.cross.test.tsx` → **0**。全量见文末补记（runner 是 **vitest**，不是 pytest）。本文件不新增任何产品 testid；`probe-` 与 `probe-location` 是私有证人节点。
- 三档 N/A：纯测试，零 markup / CSS 增量，几何结论仍按 R93 起效。
- 边界：只新增 `web/src/modules/health/system.copy.cross.test.tsx` 与本节；`@/shell/console`、`@/modules/audit/**`、`./HealthPage`、`./sourceReads`、`App.tsx`、`shell/routes.ts` 仅挂载/只读，从未编辑；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops / 任何产品码 / metrics；未 install、未并 main、未重建 9122、未启停任何服务；未 force / amend / `--no-verify`；零产品码改动。
- 挂账：**R226（`health/system.copy.width.test.tsx`）仍未开工**，DONE 号因此顺延 **R130**；R242/R243/R244 未写（处置见 R127/R128 挂账）；**R249 判为 cite-only**（① R221 `:241` + R235 `:289` + R240 `:387/:462` + 上游 `audit.export.paging.detail:324`；② 前提双重相反——`matrix` 是 employees tabId（`shell/routes.ts:149/:304`、`App.tsx:1214`，R237 `tabButton("matrix")` toBeNull 钉过）且 `sys-row-copy-<i>` 长在 `sys3-table` 不在读源矩阵，诚实两半均已钉：钮==行 R92 `system.rowcopy.test.tsx:220`、矩阵行==导出 `system.matrix.export.test.tsx:233/:264/:302/:353` + `SourceMatrix.test.tsx:98/:406/:412`、两族计数互不冒充双向 `system.empty.test.tsx` 例①/例②（`sys7-export-count` 「—」 vs 「4 行」）；③ R237 `:404` + R241 `:323` + 本笔例①）。

> 全量实测补记（本笔落盘后）：`cd web && npx vitest run` → **419 files / 3344 passed, 0 failed**，exit 0，45.70 s（stderr 只有既有 jsdom 「Not implemented: Window's scrollTo()/open()」行）。开工前零红基线 413/3332（wave-91 测得）；`f688a615` 带入 2 枚、`737696e8` 带入 3 枚上游新测试，本笔 +1 文件 / +2 例。新零红基线 **419/3344**。

## R130 / sys-matrix-window-copy — /system 逐行复制对 `?window=` 的「字面惰性」与深链复现（纯测试，R250）

- 基线：起自远端 = HEAD 的 `72f687cc`（R248/R129，已推）。派工原文要求「先 git fetch origin，再 `git checkout -B lane/console-gov origin/lane/hermes-console`（tip 068833bc）」——本次**照字面执行且安全**：显式 SSH refspec fetch → FETCH_EXIT=0，实测上游 = 点名的 **`068833bc7af06813cc1a4adbded971ffcb46117f` = `068833bc merge(lane): bc1cef36 (wave-98)`**（这次点名笔就是 merge 本身，无 ledger-stamp 间接层）。祖先双向核验：`068833bc` → 0；**我已推的 R248 `72f687cc` → 0 —— 上游已在 wave-98 的 `74620344 merge(lane): 72f687cc (wave-98)` 并入它**；我未推的冗余基线合笔 `de6ca1da`（wave-94..97）→ 1，丢弃不损失任何内容（其携带的 `37b6481e` → 0 已在 `068833bc` 之内）。⇒ 长期记忆里的「派工要求 reset 到上游时：本地分支已推则改 merge」**这次不成立**：已推的工作在上游，`checkout -B` 不搁下任何东西，下一笔推送是普通 **fast-forward**、不需要 force。执行：CHECKOUT_EXIT=0（输出「Reset branch 'lane/console-gov'」），PORC **0**，HEAD = **`068833bc`** = 点名笔。上游首亲尾部：`068833bc → 88172ad1 (merge 23fa9051, w98) → 74620344 (merge 72f687cc = 我的 R248, w98) → 37b6481e (w96 seal) → 274b2176 (w97) → f4bd0505 (w96) → 1d8258d5 (w96) → 96d769e5/77685112/bd415099 (w95)`。
- **写域增量 NON-EMPTY（自 wave-88 以来第一次）**：`git diff --name-only 72f687cc..HEAD -- web/src/modules/{health,capabilities,skills,tools}` → **`skills/SkillsPage.tsx`** 与 **`tools/ToolsPage.tsx`**，全部来自上游 `190baea5 feat(ui-b): capabilities empty state composition`（新增 `skl4-empty-retry`「重新读取」、`skl4-no-match-title`「技能里没有匹配项」、`tol5-empty-title`「暂无工具与 MCP 条目」、`tl3-no-match-title`「工具条目没有匹配项」；`py-10`/`gap-2` 令牌化为 `--space-*`；`cap5-clear` 与若干 `outlined` 被去掉）——**零处由我改**；wave-98 另改产品码 `metrics/MetricsModulePage.tsx`（+12）。整个 `web/src` 增量 = 12 文件 +2277/−8，其中 8 枚上游新测试（`approvals.export.filters.multi` +324、`approvals.export.summary.parity` +318、`approvals.history.combo.matrix` +302、`audit.export.detailcopy.pairs` +339、`audit.export.header.parity` +300、`audit.window.copy.parity` +345、`knowledge.preview.requests2` +117、**`knowledge.space.export.consistency` +158（wave-98 新）**）+ 改 `knowledge.space.export.filters`（+43）。**我没有被这些东西弄坏**：全量 427/3365 零红（见文末补记）。
- **幻影合并复算 PASSED**：608 / 388 / 489 / 403 / 529 / 461 / 516 / 420 / 310 / 320 / 327 = **4771**，与 checkout 前逐字相同 ⇒ 这次基线移动只挪了指针，没有带来、改掉或丢掉任何 health 文件。
- **`sys-evt` 族缺席 — 第 37 条道**：现查跟踪树 `git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src` → **79 行命中 / 20 个文件**（wave-93 时是 75/19，R248 的 `system.copy.cross.test.tsx` 加了 4 命中 / 1 文件），`-- web/src/modules/health ':!*test*'` → **0**。派工点名的 `sys-evt-copy-<i>` / `sys-evt-count` 无对应物，只在 DOM 上断言缺席，绝不编造。**自用例纠正**：@fixer 交付的文件把这条口径写成「现场复核 78 行命中 …（派工记 79 处，行数随树漂移，以现查为准）」——78 是错的（它把未跟踪的本文件排除后少数了一行），我在 `:22` 头注与 `:233` 断言标签里改成实测的 **79**，并注明「本文件自己那 3 处不计入」；只动注释与标签文字，零断言逻辑改动，改后重跑文件 2/2 绿、eslint 0。
- **查重结论：① 与 ③ 只回证据，不写重复用例**。R92 `system.rowcopy.test.tsx` 的 fixture 本来就带非正常行，且其复制句已逐字钉过：`:66` `{ id: "bff", name: "控制台服务(BFF)", status: "ok", latencyMs: 12 }`、`:67` `{ id: "engine", name: "运行时引擎", status: "warning", latencyMs: 0 }`、第三行 nameless/latency-less（`legacy-svc`）、`:71` `HEALTH_STAMPS = { ok: true, asOf: "2026-11-19T15:17:00Z", sources: HEALTH_ROWS }`；逐字句在 **:115** 「控制台服务(BFF) · 12 ms · 2026-11-19 23:17 · 正常」、**:125** 「运行时引擎 · 0 ms · 2026-11-19 23:17 · 降级」、**:129** 「legacy-svc · — · 2026-11-19 23:17 · 不可达」，另有 `:150`（无数据时刻 → 第三段「—」）、`:177`（刷新在飞时仍如此）、`:209`（剪贴板拒绝时的兜底 textarea 同文）、`:230`/`:234`（**状态**筛选下按钮重编号且存活行句子不变）。⇒ 派工 ① 的「行数==可见矩阵行数、每行含行名与 asof、不含 `sys-updated-at`」整段由 R92 `:93`/`:137`/`:154`/`:195`/`:220` 持有；派工 ③ 的诚实半边（降级/不可达行复制出四段人话、rid 不进句）由 `:125`/`:129`/`:209` 持有。
- **③ 的字面口径与产品相反（结构性不可能）**：`rowCopy.ts:19` 的 `sysRowCopyText(row) = [row.name ?? row.key, row.latency ?? "—", row.checkedAt ?? "—", row.state].join(" · ")` 只有**四段**——表名 · 读数 · 数据时刻 · 状态人话，**没有 rid 字段**；`:13` 的头注还明写「The refresh stamp (sys-updated-at) is a read time and must never be substituted here (R112 caliber)」。rid 只存在于**整表读失败**的面：`systemHealth.ts:233` `sys3Failure(error)` → `:235` 401「登录状态已失效…」、`:237` 未接入/无权「健康读口未接入…」、`:239` status 0「当前网络不可达…」、`:240`/`:242` 兜底「健康清单暂时读不出来…」，且单个读源的失败只用**状态词**表达（`:27` `Sys3State = "正常" | "降级" | "不可达" | "待核实"`，`:157` `stateOf`，`:207` overall 三分）。矩阵族的同形结论已被**相反方向**钉过：`system.matrix.copy.test.tsx:226` «copies the failed row as the plain state word, with the request id staying on screen only»——取 `runtime` 行那一格，断言 pipe/tab 两种形态的第 3 格 toBe 「失败」且等于 `sys15-trunc-status-runtime`/`sys6-status-runtime`，然后两个文本各自 `not.toContain("req-runtime-500")`、`not.toContain("upstream failed")`、`not.toContain("请求编号")`，最后 `expect(reads()).toBe(before)`。整表失败的 rid 面归 R120 `system.cross.failure.test.tsx:304`/`:359`/`:395`，族在失败/未接入态缺席归 `system.empty.test.tsx:194`/`:226`。
- **本笔唯一的真缺口 = ② 的「就地换 URL 窗参数且 health 面在屏」**。证明：health 里提到窗参数的文件集（`window=7d|30d|24h|filter-window`，10 个文件）∩ 提到 `sys-row-copy-` 的文件集 = **恰好一个文件**，是我自己的 R248 `system.copy.cross.test.tsx`；而 R248 的那次换窗是**事件面上的档位按钮**、插在 health↔events 往返中间（换窗那一刻 health pane 被壳卸掉），从来不是带 health 在屏的就地 URL 导航。结构性约束同源：`App.tsx:1625`（health）与 `:1628`（events）是互斥 live 槽。
- **三处现场裁决（按现状钉死并登记）**：(1) **「矩阵行复制」是跨模块混称** —— `sys-row-copy-<i>` 长在 health pane 的 `sys3-table` 服务表上（`SystemHealthSurface.tsx:535` th「复制」/`:569` `td.sys-row-copy-cell`/`:572-573` `className="sys-row-copy"` + `data-testid={`sys-row-copy-${index}`}`，播报 `:601-602` `div.sys-row-copy-result` > `span.sys-row-copy-status` **role="status" aria-live="polite"**，兜底 `:607-608` `sys-row-copy-fallback` / `sys-row-copy-fallback-text`，CSS `health.css:767-784`）；**读源矩阵没有逐行复制**，只有表级 `sys10-copy` / `sys-matrix-copy` / `sys7-export`。(2) **「切到 30d 后行集换代」与产品相反** —— health 产品码**从不读 URL**：`git grep -n -E "useSearchParams|useLocation|useParams" -- src/modules/health ':!*test*'` → **0**，`get("window")` 在 health 非测试码 → **0**。所以诚实的钉法是**惰性**：行键相同、按钮序号相同且无越界残留、每一句逐字不变、矩阵存储面一字未动、health 线路 URL 不含 `window`/`from`/`to`。(3) **「复制文本含 rid」结构性不可能** —— 见上一条 `rowCopy.ts:19` 的四段契约。
- **「零额外请求」在这里是字面真**，这与 R248 相反：R248 的 events↔health 回程必须花整整一批四读（两面都没有模块缓存），当时只能标 inverse；本笔的就地 URL 换窗**一次请求都不发**，所以派工 ② 的这半句可以原样钉成结论。
- **两条新腿**：① «就地换窗 ?window=7d → ?window=30d：逐行复制三值一字不动、字面零额外请求（钉惰性；「行集换代」与产品相反）»（`:185`）——  settle 后取行键与 `button[data-testid^='sys-row-copy-']` 集合（数量 == 渲染行数、序号 0..n-1 连续），逐行复制并按 ` · ` 切四段，第一段 == 屏上行名格、第三段 == 数据时刻面、第四段 == 状态格；`q("sys-updated-at")` 为 null（未跑刷新）、每句不含「刷新完成于」也不含地址里的 `7d`；**在每一次自身会花请求的步骤之后重取零成本基准**；然后 useEffect 捕获的 navigate 就地换到 `?window=30d` + act 内 10 ms 空转 → `totalReads()` **一字不变**、行键相同、按钮序号相同、每句**逐字相同**、播报「已复制」、`probeFaces()` 未动、health 线路 URL 不带 `window`/`from`/`to`；尾巴零 `sys-evt*`（第 37 车道标签）。② «深链 ?window=30d 直接进：R92 的三值与四段形状在带窗地址下重新成立一遍（定性是复现，不是新事实）»（`:235`）—— 明确标注为复现而非新事实：按钮数 == `sys3-row-` 数、三句逐字（含降级与不可达那两行）、`sys-updated-at` null、句子不含地址令牌、复制零额外请求、零 `sys-evt*`。
- **@fixer 交付与其独立核验**：交付 259 行 / 1 describe / 2 `it`（`:185`/`:235`）；我方 git 核验 —— `git status --short` 恰好一枚未跟踪路径、`git diff --stat HEAD` **EMPTY**、python 扫描 `LITERAL_UFEFF_COUNT = 0`、唯一的 `/*`+`*/` 对是 `:155` 的 JSX 注释（无块注释头，全 `//` 行注释如约）。它自己的一轮 red→fix（上限 3）：`serviceRows()` 照抄 crosstab 供体的 `rowsBy` 时保留了完整 `sys3-row-` testid 前缀，导致键带前缀、`rowCellText` 再加一次前缀而取不到格子（`expected '控制台服务' to be ''` + `expected ['sys3-row-svc-a','sys3-row-svc-b'] to deeply equal ['svc-a','svc-b']`）；在一处剥掉前缀后两条红一起清。**新坑入账**：`[data-testid^='probe-']` 证人选择器会把 `probe-location` 扫进面集，必须按名排除（R248 同款）；`serviceRows()` 一类 helper 必须剥掉 `sys3-row-` 前缀后才能当键用。
- 验证：新文件 **2/2**（`/tmp/r250-new2.log`，exit 0，1.70 s，改注释后重跑）；定向 `src/modules/health` → **34 files / 159 passed**（开工前 33/157 ⇒ +1 文件 / +2 例）；`./node_modules/.bin/tsc -b . --noEmit` → TSC_EXIT=2（既有基线），`grep -Ec 'modules/health'` → **0**，报错模块只有 `src/modules/approvals` / `employee-detail` / `employees`；`npx eslint src/modules/health/system.matrix.window.copy.test.tsx` → **0**。全量尾行见文末补记（本文件不新增任何产品 testid；`probe-` 与 `probe-location` 是本文件私有的测试内证人节点）。
- 三档 N/A：纯测试，零 markup / CSS 增量，几何结论仍按 R93 起效。
- 边界：只新增 `web/src/modules/health/system.matrix.window.copy.test.tsx` 与本节；`@/shell/console`、`./HealthPage`、`./sourceReads`、`App.tsx`、`shell/routes.ts` 仅挂载/只读，从未编辑；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops / 任何产品码（含 metrics、skills、tools 的上游改动一字未被我覆盖）；未 install、未并 main、未重建 9122、未启停任何服务；禁 force/amend/`--no-verify` 一律遵守；零产品码改动。
- 挂账：**R226（`web/src/modules/health/system.copy.width.test.tsx`）仍未开工**，其 DONE 号因此顺延为 **R131**；它的三条陈旧前提在案（读源矩阵没有逐行复制、`sys-evt-copy-<j>` 不存在、「复制文本含 rid」与产品相反 —— 分别由本笔的裁决 (1)、第 37 车道、裁决 (3) 与 R92/`system.matrix.copy:226` 持有）。R242/R243/R244 仍未写（处置见 R127/R128）；R249 已按只回证据结案（引证集在 R129 挂账）。**R251 已锁定侦察未开工**：`web/src/modules/health/system.event.search.test.tsx` —— 事件面**没有关键字搜索**（`AuditEventsModulePage.tsx` 从不 `get("q")`；产品里 `?q=` 的读者只有 approvals ×3、employees、knowledge、skills、tools 和 `health/serviceSearch.ts:13`），所以 ① 的「请求带关键词」与 ② 的 `sys-evt-count`/`sys-evt-copy-<i>` 面在那一不存在；`serviceSearch.ts:2` 明写「filtering never issues a request」⇒ ③ 的「恰 1 次取数」与产品相反（清空也是零花费）。唯一真缺口：**没有人带着 `?q=` 筛选点过 `sys-row-copy-<i>`** —— `SystemHealthSurface.test.tsx:472`/`:492` 钉了 `q` 下的行与计数但从不碰复制族，R92 `:220`/`:230`/`:234` 只钉过**状态**筛选下的重编号，`system.matrix.copy:331` 只管矩阵表级门在空搜索下的形制。

> 全量实测补记（本笔落盘后）：`cd web && npx vitest run` → **427 files / 3365 passed, 0 failed**，FULL_EXIT=0，38.54 s（stderr 只有既有的 jsdom 「Not implemented: Window's open() method」×4）。算术：wave-97 `de6ca1da` 上测得 425/3362；`068833bc`（wave-98）带入 1 枚上游新测试文件（`knowledge.space.export.consistency`，1 例）；本笔 +1 文件 / +2 例 ⇒ 427 / 3365。**新零红基线：427 files / 3365 tests**（runner 是 vitest，不是 pytest）。上游 wave-98 改了产品码 `metrics/MetricsModulePage.tsx`（+12）、wave-95..97 改了 `skills/SkillsPage.tsx` / `tools/ToolsPage.tsx`，我的域内零红说明这些都没打断我的东西。

## R131 / sys-event-search — /system 服务搜索 `?q=` 下的逐行复制重编号，与事件面的「惰性乘客」（纯测试，R251）

- 基线：起自 HEAD = 远端 `d2f1599a`（R250），PORC 0。显式 SSH refspec fetch → `origin/lane/hermes-console` = **`b3acbf9d351977c8251fd0684777b632affcce98` = `chore(gates): full gate ledger stamped at 8ff6d30d (entry OCLu6KCF)`** —— 派工点名的 `8ff6d30d`（wave-99）是**账本章笔的父笔**（R237/R240/R241/R246 同款）。祖先核验：`git merge-base --is-ancestor 8ff6d30d origin/lane/hermes-console` → **0**；`… d2f1599a …` → **1**（上游尚未并我 R250）⇒ 既有纪律「派工要求 reset 到上游时：本地已推则改 merge」**这次成立**，因此走 `git merge --no-ff` 而非 `checkout -B`（与 R250 的快进形成对照）。合并笔 **`fa9bec34 merge(console): sync event search baseline`**，MERGE_EXIT=0，165 文件 +1105/−205（多为 gates/doc 工件），PORC 0，**未用 reset**。
- 写域增量 **EMPTY**（`web/src/modules/{health,capabilities,skills,tools}` → 无）。整个 `web/src` 增量只有 3 枚上游新测试，+837：`audit/audit.error.export.guard.test.tsx`（+264）、`audit/audit.export.missing.pairs.test.tsx`（+359）、`knowledge/knowledge.export.sort.filter.order.test.tsx`（+214）。**本波零产品码**。
- 幻影合并复点 **通过**：608 / 388 / 489 / 403 / 529 / 461 / 516 / 420 / 310 / 320 / 327 / 259 = **5030**。派工点名的 `web/src/modules/health/system.event.search.test.tsx` 开工前**不存在**。
- **`sys-evt` 族缺席 —— 第 38 条道**（我自己重测，不信代理报数）：`git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src` → **82 行命中 / 21 个文件**，全部是 health 的**测试**文件；`… -- web/src/modules/health ':!*test*'` → **0**。⇒ 派工的 `sys-evt-count` / `sys-evt-copy-<i>` 无对应物，只能断言缺席，绝不编造。诚实的计数面是事件侧 `aud01-status` + `aud5-export-count` + 屏上行，与健康侧 `sys7-export-count` / `sys3-row-*` / `sys5-count-*`。
- **产品真相一：事件面根本没有关键字搜索。** `git grep -n 'get("q")' -- src ':!*test*'` 的产品读者恰八处 —— `approvals/ApprovalsHistoryModulePage.tsx:86`、`approvals/ApprovalsPendingModulePage.tsx:151`、`approvals/FilterSummary.tsx:61`、`employees/EmployeesModulePage.tsx:502`、**`health/serviceSearch.ts:13`**、`knowledge/KnowledgeModulePage.tsx:3537`、`skills/SkillsPage.tsx:131`、`tools/ToolsPage.tsx:352`；而 `AuditEventsModulePage.tsx` **0 命中**。⇒ `?tab=events&q=…` 上 `q` 是**惰性乘客**：地址留着、线路不带、不产生游标。派工 ① 的「请求带关键词」与 ② 的两枚 `sys-evt-*` 面在那一侧不存在。
- **产品真相二：`serviceSearch.ts:1-2` 写明「filtering never issues a request」**（服务表与读源矩阵共读同一个 `?q=`，筛选只在本地图）。`readServiceQuery` 在 `:13`，`writeServiceQuery` 就地改 `window.location.hash`。⇒ 派工 ③ 的「清空回全量**恰 1 次取数**」与产品相反：清空也是**零**请求。这一条按现状钉死并登记，不伪造那一次。
- **产品真相三（本轮新查）：`sys-search-clear` 有三个落点**，不是一个 —— `SourceMatrix.tsx:239`（在 `sys-search-source-empty` `:237` 内，受 `hidden={!expanded}` 管）、`SystemHealthSurface.tsx:383`（搜索条内，紧挨 `:379` 的范围说明）、`SystemHealthSurface.tsx:514`（在 `sys-search-empty` `:512` 内）。三者都是 `setQ("")` 然后 `writeServiceQuery(null)`。搜索输入是 `SystemHealthSurface.tsx:362` `div.sys-search-bar[data-testid=sys-search-bar]` / `:365-366` `input.sys-search-input[data-testid=sys-search]`。⇒ 点清空必须**限定祖先锚**，否则可能点到矩阵那颗。
- **既有覆盖只回证据（不重写）**：R92 `system.rowcopy.test.tsx:93/:115/:125/:129/:137/:150/:154/:177/:195/:209/:220/:230/:234` —— 其中「序号从 0 重建」只在**状态筛选**下钉过（`:220/:230/:234`），`?q=` 下的**复制族**版本是空缺；`SystemHealthSurface.test.tsx` 的「local service search」describe `:464-:510`（`:472` 行与计数从已加载集合收窄、hash 留 `q`、`toHaveBeenCalledTimes(calls)` 零重取；`:492` 搜索空态与限定锚清空出口、清完 hash 不含 `q=`；`:505` 读口未接入时输入 disabled 带因由）—— 三条全都没碰 `sys-row-copy-`；`system.matrix.copy.test.tsx:226/:267/:331`（矩阵族在 `q=zzz-none` 下的表级复制门）；`system.matrix.export.test.tsx:20/:266/:355`（导出服从 `?q=` 与 `sys13` 排序）；R250 `system.matrix.window.copy.test.tsx:185/:235`；R248 `system.copy.cross.test.tsx:231/:278`；R237 `system.copy.crosstab.test.tsx:404`；R241 `system.event.copy.export.cross.test.tsx:246/:279/:323`。
- **本笔新写的两条腿**：① `?q=` 深链收窄表体时逐行复制跟着重编号 —— 只剩一行时复制钮集合恰为 `["sys-row-copy-0"]`（无 `-1`/`-2` 残号），那一句的四段逐格等于**幸存行自己**的 name / latency / 数据时刻 / 状态词，被滤掉两行的名字与键一个字都不进剪贴板，`sys-updated-at` 为 null，全程请求数停在 settle 后的基准 4；② 清空回全量 —— 序号 0..n-1 重建且每句与过滤前**逐字相同**，清空同样零请求；随后重挂 `/system?tab=events&q=hermes`，把事件面的乘客身份钉死：地址逐字不改、审计线路上 `paramOf(url,"q")` 全 null、`cursorsOf` 全空、`[data-testid^='sys-evt']` 计数 0、`sys3-table` 为 null（两面占互斥 live 槽）。
- **一处按现状的口径纠正（代理自报，我核过 DOM）**：收窄后剩 1 行、**不落空态**，所以 `sys-search-empty` 里那颗清空不在场。测试因此断言 DOM 里 `sys-search-clear` **恰一颗**，并用祖先锚 `sys-search-bar` 证明点的是 `SystemHealthSurface.tsx:383` 那颗，同时钉 `sys-search-empty` 为 null —— 而不是假装三点都可达。
- 自用例纠正：初稿在 JSX children 里写了 `{/* … */}`，内含 `*/` 违禁序列 ⇒ 改成 `mount()` 体内的 `//` 行注释，改后四步验证全绿（除这一处外**零红→改轮次**）。
- 验证：新文件 **1 file / 2 passed**（`/tmp/r251-new.log`，exit 0，1.99 s）；定向 `src/modules/health` → **35 files / 161 passed**（开工前 34/159 ⇒ +1 文件 / +2 例，`/tmp/r251-health.log`）；`./node_modules/.bin/tsc -b . --noEmit` → **TSC_EXIT=2**（既有基线），`grep -Ec 'modules/health'` → **0**，报错模块只有 `src/modules/approvals` / `employee-detail` / `employees`；`npx eslint <新文件>` → **0**。全量尾行见文末补记（`/tmp/r251-full.log`）。
- 工件独立核验（代理回执只是主张，不是证据）：`git status --short` 恰一条 `?? web/src/modules/health/system.event.search.test.tsx`；`git diff --stat HEAD` **空**；**235 行 / 1 describe / 2 `it`**（`:165`、`:189`）；python 扫 `LITERAL_UFEFF_COUNT = 0`，全文件唯一一对 `/*`+`*/` 是 `:129` 的 JSX 注释，**无块注释头**（全 `//`，按派工）；计时器只用 `vi.useRealTimers()`（`:162`），**没有任何 `useFakeTimers`** —— 因为「已复制」的 2500 ms 复位是真 `window.setTimeout`（`states.tsx:542`），冻表会吞掉回执。
- 三档 N/A：纯测试，零 markup / CSS 增量，几何结论仍按 R93 起效。
- 边界：只新增 `web/src/modules/health/system.event.search.test.tsx` 与本节；`@/shell/console`、`./HealthPage`、`./sourceReads`、`@/modules/audit/**`、`App.tsx`、`shell/routes.ts` 仅挂载或只读，从未编辑；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops / 任何产品码 / metrics / skills / tools；未 install、未并 main、未重建 9122、未启停任何服务；未 force / amend / `--no-verify`；**零产品码改动**；本文件不新增任何产品 testid（`probe-` 与 `probe-location` 是私有证人节点）。
- 挂账：**R226（`health/system.copy.width.test.tsx`）仍未开工**，DONE 号因此顺延为 **R132**；R242/R243/R244 未写（处置见 R127/R128/R129）；**R252 被更新的 R253 取代，零写入零回退**（其侦察已整体转移到 R253）；R253 下一笔，基线点名 `c621295b`。另：R241 测试 ③ 已**完整**吸收「切 tab 往返后导出」这一腿（`:323`-`:364` 逐字读过），R127/R129 挂账里「half-absorbed」的旧措辞按此更正为**完全吸收**。

> 全量实测补记（本笔落盘后）：`cd web && npx vitest run` → **431 files / 3373 passed, 0 failed**，exit 0，54.60 s（stderr 只有既有的 jsdom 「Not implemented: Window's open() method」×4）。开工前零红基线 427/3365（R250 落盘时）；合并笔 `fa9bec34` 带入 3 枚上游新测试文件，本笔 +1 文件 / +2 例。`tsc -b . --noEmit` → TSC_EXIT=2（既有基线），own-health grep 0。

## R132 / sys-export-header-isolation — /system 两面导出文件在同一会话对撞：列词汇与行身份不跨界（纯测试，R254；接替零写入的 R253/R252）

- 基线：起自远端 `141c66bc`（R251，PORC 0）。显式 refspec SSH fetch → `origin/lane/hermes-console` = **恰是指名的 `1af5c41fd5039319030ad3e7432c869f83f43d1a` = `1af5c41f merge(lane): 3c640712 (wave-102)`**（本笔卡面点名的 tip 就是合并笔本身，无门禁章笔间接层；随后 R255 卡点名的 `32a60f7b` 是它之上的门禁章笔，见挂账）。祖先双向核验：`1af5c41f` → **0**；我的 R251 `141c66bc` → **0**（上游已在 `7254ee79 merge(lane): 141c66bc (wave-102)` 并入本车道上一笔）。上游一线：`1af5c41f → 7254ee79 → c964fb3d（sync 107fb55a, wave-100 seal）→ 6cae1e47（26ff50e3, w101）→ 524ba73f（7df79cf0, w101）→ c621295b（69f0de56, w100）→ fd76a599 → eb88bbe5（d2f1599a = 我的 R250, w100）`。`git merge --no-ff` → 合并笔 **`a0946c22 merge(console): sync export header isolation baseline`**，MERGE_EXIT=0，**6 文件 +1240/−2**，PORC 0，**未用 reset**。
- 写域增量 **EMPTY**（`web/src/modules/{health,capabilities,skills,tools}` → 无）。整个 `web/src` 增量只有 6 枚上游文件：NEW `approvals/approvals.rowcopy.paging.test.tsx`（+308）、NEW `audit/audit.export.sort.stability.test.tsx`（+360）、NEW `knowledge/knowledge.export.cross.filter.isolation.test.tsx`（+203）、NEW `knowledge/knowledge.space.export.empty.test.tsx`（+174）、NEW `knowledge/knowledge.space.export.preview.test.tsx`（+188）、MODIFIED 产品码 **`metrics/MetricsModulePage.tsx`（+9/−2）**——全部上游带入，无一由我改；零产品码破我的用例（全量零红为证）。
- 幻影合并核验通过：`system.copy.crosstab` 608 / `system.event.copy.paging` 388 / `system.event.empty` 489 / `system.event.export.fulltext` 403 / `system.refresh.race` 529 / `system.cross.failure` 461 / `system.event.export.paging` 516 / `system.event.copy.export.cross` 420 / `system.window.isolation` 310 / `system.retention.tab` 320 / `system.copy.cross` 327 / `system.matrix.window.copy` 259 / `system.event.search` 235 ⇒ **总计 5265**，与预测（5030 + R251 的 235）逐字相符。
- **让位登记（三连同主题卡，全部零写入）**：R252（`system.export.crosstab.test.tsx`）→ R253（`system.copy.payload.isolation.test.tsx`）→ R254（本笔 `system.export.headers.test.tsx`）。每张新卡都换文件名与 commit message，按「最新指令优先」旧卡让位；三张都没落过一个字节，故无需回退任何改。R255（`system.tab.persist.test.tsx`，卡面点名 `32a60f7b`）是**不同文件不同主题**，不让位、排队在本笔之后。
- **`sys-evt` 族缺席 — 第 39 道**：`git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src` → **86 命中 / 22 个文件，全部是 health 的测试文件**（较 R251 时的 82/21 增 4 命中 1 文件，即 R251 自己那笔）；`-- web/src/modules/health ':!*test*'` → **0**。⇒ 卡面点名的 `sys-evt-count` / `sys-evt-copy-<i>` 无对应物，只在 DOM 上断言 `countAll("[data-testid^='sys-evt']") === 0`，绝不编造；诚实计数面按产品重述——事件侧 `aud01-status`（`:1363` 「已显示 N 条审计事件（…）」）+ `aud5-export-count`（`:1620` 无条件「将导出 N 条」）+ `paintedRows()`，矩阵侧 `sys7-export-count`（`SourceMatrix.tsx:209` 停用读「—」否则「N 行」）+ 矩阵行 + 复制句行数。
- **「matrix 站」是跨模块混称（第 5 次到场）**：`matrix` 是 **employees** 的 tabId（`shell/routes.ts:149`/`:304`、`App.tsx:1214`），`/system` 的 tab 条没有这一枚 ⇒ 测试里 `expect(tabButton("matrix")).toBeNull()` 钉住；读源矩阵就长在 health 面里。`sys-row-copy-<i>` 长在 `sys3-table` 服务表（`SystemHealthSurface.tsx:535` th「复制」/`:569` td/`:572-573` 按钮，播报 `:601-602` role=status + aria-live=polite，兜底 `:607-608`），**读源矩阵没有逐行复制**，只有表级 `sys10-copy`（管道）/ `sys-matrix-copy`（制表符）+ `sys7-export`。
- **两面互斥的结构约束决定了打法**：`App.tsx:1625`（health live 槽）vs `:1628`（events live 槽）⇒ 事件面在屏时 `sys3-table`、矩阵、`sys7-export` 一个都不存在（测试尾部 `q("sys3-table")` toBeNull 钉住）。所以两份文件**必须跨一次 tab 切换依次捕**，不能同屏；且 `captureDownload()` 每次 arm 都把模块级 `captured`/`capturedName`/`blobCalls`/`urlCalls` 清零 ⇒ 每面捕完立刻把文本快照进局部变量。
- **实测到的列头双口径（本笔的新事实）**：`sourceMatrixCsv.ts:3` `SYS7_HEADER = ["name","path","state","elapsed_ms","as_of"]`（**英文五列，导出文件用它**）与 `:45` `SYS10_HEADER = ["口径名","路径","状态","耗时","采集时刻"]`（**中文五列，两种复制形态用它**，分隔符 ` | ` 在 `:50`、`\t` 在 `:65`）；矩阵导出文件名实测 `/^system-sources-\d{8}-\d{4}\.csv$/`（`:89`）。事件面文件表头逐字六个中文词 `["时间","类型","结果","操作者","对象","请求编号"]`（`audit/csv.ts:12`），rid 在第 6 列（下标 5）。`system.matrix.export.test.tsx:48` 那句「locked as-is, not as it should be」在案，本笔照实钉不做纠正。
- **既有覆盖只回证据（不重写）**：② 的一半由 R241 `system.event.copy.export.cross.test.tsx:279`（导出**文件** vs health **逐行复制句**双向不沾、`sys-updated-at` 只在 health 面存在）与 R237 `system.copy.crosstab.test.tsx:404`（两族复制各写自己的串、跨 tab 往返逐字不变）持有；矩阵复制自身形制归 `system.matrix.copy.test.tsx:195`/`:226`/`:267`/`:302`/`:329`/`:358`（含 `:226`「失败行只给状态词、rid 只留在屏上 title」）。③ 的空站门已逐字钉：矩阵侧 `system.matrix.export.test.tsx:353`（`?q=zzz-none` → `sys-search-source-empty` → `sys7-export` disabled + title 含「没有可导出」+ 计数位「—」+ 点击 `urlSpy` 未调、content/fileName 皆空），事件侧 R123 `system.event.empty.test.tsx:346`/`:437`、R221 `system.event.export.test.tsx:365`、R241 `:394`/`:395`（两枚门各自 title 的循环断言）。③ 的往返算术归 R241 `:323`-`:364` 与 `system.window.isolation.test.tsx:212`/`:239`/`:278`——本笔只按同口径复核账目，不重开战场。
- **净新增两条**：① **同一会话内跨一次 tab 切换先后捕两面导出文件再双向对撞**——持有 `captureDownload` 的 8 个 health 文件（`system.empty`、`system.event.copy.export.cross`、`system.event.copy.paging`、`system.event.empty`、`system.event.export.fulltext`、`system.event.export.paging`、`system.event.export`、`system.matrix.export`）没有一个捕过两面；上游本波 `audit/audit.export.sort.stability.test.tsx:278` 的「two files that do not bleed」是**同一面两次排序**，不是两面。② **矩阵表级复制文本 vs 事件字段**的对撞（R241 做的是文件 vs 逐行复制句，从未碰 `sys10-copy`/`sys-matrix-copy` 的两句）。
- **本笔最重要的口径裁决：「互斥」= 列词汇与行身份不跨界，不是「没有一个字节相同」**。北京分钟形时刻 `2026-11-19 23:17` **合法地同时**出现在 health 逐行复制句第 3 段与矩阵复制句的「采集时刻」列（同一代 asOf，两族本就同源）。测试因此用**正向断言**把这件事钉在案上（`healthCopy` toContain `MINUTE_STAMP` 且 `pipe` toContain `MINUTE_STAMP`，两句仍各自不含任何事件列词），并把判别标记严格限定在两组列头词、四个矩阵行名（`sourceReads.ts:56-59`：系统健康清单 / 控制台服务探针 / Hermes 运行时探针 / 域服务探针）、四条矩阵读口路径（含 `/agent-api/api/health`，它与事件面用的 `/agent-api/api/audit` 不同源）、`evt_` 与 `req-` 前缀上。**若照卡面字面写「无任何共享字节」，测试会假红在产品真相上**——这是本笔与卡面的分歧点，按产品钉。
- **「切 tab 往返零额外请求」与产品相反（第 4 次到场）**：离开方向对事件面零流量（`auditReads()` 停在 1），**回程花 health 自己那一整批**——首载 4 + 回程 4 ⇒ `healthReads()` 实测 **8**，本页没有模块缓存（与 capabilities 的 `cachedSkillsState`/`cachedTools` 相反）。字面真的是另一半：**两次导出点击各花零请求**，各自按「刚重取的基准」钉（`totalReads()` toBe `baseEvents` / `baseMatrix`；既有坑：一个基准不能横跨两次切 tab）。
- 事件面 rid 用**短横线形**夹具 `req-header-0001` ⇒ 不被 `states.tsx:524-530` 的 R31 折叠规则改写（32-hex 折 8 位、scheme 句柄折前缀…末 8 位，其余逐字），于是「屏上形 == title == 剪贴板 == 文件格」四者同一，`copyRow()` 那句得以 `toBe(RID_DASH)` 逐字钉。矩阵两句复制走**裸 `navigator.clipboard.writeText`**（`sys10-copy`/`sys-matrix-copy` 不用被 mock 的 `copyTextToClipboard`），与事件族必须分开 arm。
- 验证：新文件 **1 file / 2 passed**（首轮即绿，**零红→修轮**）；定向 `src/modules/health` → **36 files / 163 passed**（开工前 35/161 ⇒ +1 文件 / +2 例）；`./node_modules/.bin/tsc -b . --noEmit` → TSC_EXIT=2（既有基线），自有 health 计数 **0**，报错模块只有 `src/modules/approvals` / `employee-detail` / `employees`；`npx eslint <file>` → **0**。全量尾行见文末补记（跑测器是 **vitest**，不是 pytest）。交付物经我独立核验：`git status --short` 只有这一个未跟踪路径、`git diff --stat HEAD` 为空、HEAD 仍是 `a0946c22`、**318 行 / 1 describe / 恰好 2 `it`**（`:210`、`:279`）、`LITERAL_UFEFF_COUNT = 0`、**无 `useFakeTimers`**（本笔不需要假时钟）。fixer 自报的两处返工是行数压缩（378 → 340 → 318），断言文本未动。
- 三档 N/A：纯测试，零 markup / CSS 增量，几何结论仍按 R93 起效。
- 边界：只新增 `web/src/modules/health/system.export.headers.test.tsx` 与本节；`@/shell/console`、`@/modules/audit/**`、`./HealthPage`、`./sourceReads`、`./sourceMatrixCsv`、`./SourceMatrix`、App.tsx、`shell/routes.ts` 仅挂载或只读，从未编辑；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops / metrics / skills / tools；未 install、未并 main、未重建 9122、未启停任何服务；禁 force/amend/`--no-verify` 一律遵守；**零产品码改动**；本文件不新增任何产品 testid。
- 挂账：**R226（`health/system.copy.width.test.tsx`）仍未开工**，DONE 槽位因此顺延为 **R133**；**R255 排队在本笔之后**（卡面点名 `32a60f7b` = `chore(gates): full gate ledger stamped at 1af5c41f (entry CE4DkLMF)`，即 wave-102 的门禁章笔，已 fetch 核验为当前上游 tip 且祖先 0；它的 merge 预期只带 doc/gate 工件、`web/src` 增量为空、幻影重计 = 5265 + 本笔 318 = **5583**）；R255 的预读在案——① 归 R135 `system.filters.test.tsx:158`、② 的 URL 保参归 `:174`/`:203`、③ 的「不改写 URL」归 `:223`/`:244`、重挂同 URL 归 `:259`，② 的行集/页码半边归 R241 `:323`-`:364` + `system.window.isolation:212`/`:278`，`sys-updated-at` 在事件面根本不存在（R221 `:394`），③ 的空态不显裸 0 归 R123 `:346`/`:437` + `system.empty` + `system.retention.tab:302`；两处预计裁决：`matrix` 不是 `/system` 的 tab、`?tab=__nope__` 折到 health 面时事件表根本没挂载（互斥 live 槽）故「两表可读空态」按字面不成立。R242/R243/R244 仍未写（处置在 R127/R128/R129）。

> 全量实测补记（本笔落盘后）：`cd web && npx vitest run` → **437 files / 3385 passed, 0 failed**，exit 0，49.29 s（stderr 只有既有的 jsdom 「Not implemented: Window's open() method」×4）。开工前基线 431/3373（`141c66bc`）；基线合并笔 `a0946c22` 带入 5 枚上游新测试文件（+1 上游测试笔数按文件计），本笔 +1 文件 / +2 例 ⇒ 437 / 3385。跑测器是 vitest，不是 pytest。

## R133 / sys-event-counts-paging — /system 事件表「三值同一个数 · 复制钮只数带 rid 的行 · 翻车时三值一起塌」（纯测试，R257 第四次重签发）

- 基线：起自远端 `05f87f2f`（R254，PORC 0）。显式 refspec SSH fetch → `origin/lane/hermes-console` = **`8d0725d42cb918fad6ac10a691c7edee331d3fa2`**，subject `8d0725d4 merge(lane): 3afa56af (wave-109)` —— 派工点名的 tip 这次**就是合并笔本身**，没有章笔间接层。祖先双向核验：`git merge-base --is-ancestor 8d0725d4 origin/lane/hermes-console` → 0；`… 05f87f2f …` → 0（上游已在 wave-106 `634e09c9 merge(lane): 05f87f2f (wave-106)` 并入 R254）。`git merge --no-ff` → 合并笔 **`cb3c1b36 merge(console): sync counts paging baseline`**，MERGE_EXIT=0，PORC 0，**未用 reset**。本次推送因此一次带走三笔先前本地的基线合并：`d252102d`（w105）+ `4f85c047`（w106）+ `cb3c1b36`（w109）。
- **写域增量 NON-EMPTY（全部上游带入，我一字未改）**：`git diff --name-only HEAD^1 HEAD -- web/src/modules/{health,capabilities,skills,tools}` → `web/src/modules/skills/SkillsPage.tsx`（+7）、`web/src/modules/tools/ToolsPage.tsx`（+8）。整个 `web/src` 增量 = 13 文件 +2519/−8：NEW 上游测试 9 枚（`approvals.copy.announce` +281、`approvals.copy.export.concurrency` +332、`approvals.copy.export.pair2` +373、`approvals.export.drawer.pairs` +323、`approvals.export.summary.cross` +263、**`audit/audit.filter.combo` +324**、`knowledge.chips` +214、`knowledge.export.copy.concurrency` +188、`knowledge.export.missing.triple` +190），MODIFIED 产品码 `metrics/MetricsModulePage.tsx`（+14）、上述 skills/tools 两枚，以及 `web/src/styles/table-density.css`（+10）。我的 health 文件一笔未动，全量零红（见文末补记）即为「没有被上游打破」的实证。
- 幻影合并复点通过：health 14 枚既有文件 608 / 388 / 489 / 403 / 529 / 461 / 516 / 420 / 310 / 320 / 327 / 259 / 235 / 318 = **5583**，与合并前一字不差 ⇒ wave-105/106/109 都没带 health 文件。派工目标 `system.event.counts.paging.test.tsx` 开工前 **absent**。
- **这是同一主题的第 4 次重签发**（R238 → R245 → R256 → R257）。前三次的处置都在案：R238 的腿并入 R240 的文件；R245 是 R238/R240 的重到，按「已覆盖只回证据」结案；R256 的净新腿被我自己读 R241 `:279` 的 BODY 逐字否掉。本轮我先回了一份 cite-only 报告（R257 硬检查点选②），**用户明确第三次推翻 report-only 并收窄重发**：只做三例、10 分钟硬线、必须落一个 commit。按「用户的话赢」，文件落地；同时把每条腿的既有持有者在头部逐条点名，不假装这些事实是第一次被钉 —— 本笔的净新只有一句话：**把这三态站在 `?tab=events&window=7d` 组合地址上，用「三值一起动、一起对」的形制再钉一遍，并把复制钮的普查口径（只数带请求编号的行）钉成断言**。
- **`sys-evt` 族缺席 —— 第 40 条道**：`git grep -n -E "sys-evt|sysEventCopyText|evt-copy|evt-more|evt-count" -- web/src` → **89 处命中 / 23 个文件，全部是 health 的测试文件**；`… -- web/src/modules/health ':!*test*'` → **0**（本文件自己那几处不计入）。⇒ 派工的 `sys-evt-count` / `sys-evt-copy-<i>` 无对应物，全程只断言 `countAll("[data-testid^='sys-evt']") === 0`，绝不编造。三值诚实改写到真面上：`shownOf("aud01-status")` == `paintedRows().length` == `shownOf("aud5-export-count")`；复制控件普查 = `valueKeys()`（带 rid 的行）+ `absentKeys()`（裸行），且 `ridButtons()` == `valueKeys().length`。
- **口径裁决 (a)：「钮数 == 表体行数」与产品相反**。裸行由 `CopyValue` 走 `<span data-testid={testId+"-absent"} title={reason}>该字段未返回</span>`，**不给按钮**（`states.tsx:497-550`）。所以诚实等式是「钮数 == 带请求编号的行数」，「钮数 != 表体行数」也被反向钉住。fixture 特意做成 7d 第一页 2 行只有 1 个 rid、第二页 3 行有 2 个 rid，让这条相反在两个站都可见。此半归 R221 `system.event.export.test.tsx:241`（`ridControls` == `rowsWithRid`）与 R124 `system.event.export.fulltext.test.tsx:300`（`valueKeys()==[FRESH,MID]` / `absentKeys()==[BAREROW]`）持有，本笔是在 7d 组合地址的三态连续版本上再持一次。
- **口径裁决 (b)：「第 2 页 500 保旧行」与产品相反 —— 第 8 次到达**。走得通的 `aud01-load-more` 失败是**整页失败**，行被清空；真正「保旧行」的追加腿唯一调用点在 `aud01-page-failure` 自己那颗重试按钮里，现界面够不到。持有者：R161 `audit.paging.test.tsx:339`/`:361`（后者断 `aud01-page-failure` 为 null）与其头 `:19-21`、R244 `audit.copy.paging2.test.tsx` 头 clause (b) + `:316`、R213 `audit.error.test.tsx:302`、R250 `audit.export.window.detail.paging.test.tsx:287`、R240 `system.event.export.paging.test.tsx:334`。本文件按现状钉 `paintedRows()` toEqual `[]`，并在 expect 标签里把这条相反写全。
- **口径裁决 (c)：「三值不变」与产品相反（第二种相反）**。翻车这一瞬行被清 ⇒ 三值**一起动**：`aud5-export-count` 落到「将导出 0 条」（产品 `AuditEventsModulePage.tsx:1620` 是无条件的 `将导出 {listedRows.length} 条`，没有门也没有「—」，所以这是失败态里唯一诚实的 0 面），`aud01-status` 切到**不带任何数字**的「审计事件读取失败」（`:1355-1365`；`shownOf === -1` 且 `/\d/` 不匹配）。爬起来后三值**一起对**上重试那一页的 N。诚实说法是「三值一起动、一起对」，不是「不变」。
- **档位从不上线路**（`window.ts:22`/`:77`/`:105` 只发 ISO `from`/`to` 对）：`paramOf(read,"window")` toBeNull、`windowHours(read)` toBe **168**（7d）、`cursorsOf(read)` toEqual `[]`；换窗那一问同样 `cursorsOf === []` 且 `windowHours ≤ 25`，账本恰 +1（`listReads()` 1 → 2 → 3：首载 + 翻页 + 换窗，每一次都算）。
- **既有覆盖只回证据（头部点名，不重写）**：R124 `system.event.export.fulltext.test.tsx:300`（7d 站的三值与复制普查、fold-vs-full rid、导出零请求）；R221 `system.event.export.test.tsx:241`/`:276`/`:315`/`:365`/`:394`；R235 `system.event.copy.paging.test.tsx:289`/`:343`/`:357`（翻页后换窗：游标清零、行替换非累加、页码归 1、两枚读数条跟着走、恰 +1 读、窄窗文件零残留）；R225 `system.event.rows.test.tsx:198`/`:202`/`:213`/`:227`/`:261`（`aud2-page` 那张脸的「第 N 页 · 已加载 M 条」）；R240 `system.event.export.paging.test.tsx:334`/`:387`/`:462`/`:496`；R213 `audit.error.test.tsx:302`；R249 `audit.export.paging.detail.test.tsx:398`；R250 `:287`/`:314`；R161 `:339`/`:361`；R244 clause (b) + `:316`；R229、R120 `system.cross.failure.test.tsx:304`（失败锚 rid 可复制）；`system.window.isolation.test.tsx:212`/`:239`/`:278`。上游本波带来的近邻：R267 `audit.export.paging.sequence.test.tsx:275` 与 **R270 `audit.filter.combo.test.tsx:276`/`:305`** —— 两者都挂裸 `/audit`，都没有组合地址、也没有逐行复制控件的普查，故只点名不复制。
- **本笔三条腿钉什么（`it` 行号）**：`:272` ① 7d 站三值同一个数 + 复制钮只数带 rid 的行 + `sys-evt` 整族缺席 + 行格零 `-status` 节点；`:314` ② 加载更多把三值一起推到第二页的数（`[C,D,E]` 替换非累加、Set 唯一、`aud2-page` 「第 2 页」、`listReads()` 2、游标在线路上）然后换窗页码归 1、三值一起重算、旧页行零残留、账本恰 +1；`:360` ③ 第 2 页翻车 → 整页清空（不是保旧行）+ 三值一起塌到 0 与不带数字的那句 + 失败锚 rid 一点落**全形** `req-counts-p2-500` 且分文不花 + 爬起来**恰 +1**（`listReads()` 3、游标原样、`[C,D,E]` 非并集、锚节点文字清空、三值重新对上）。
- **自用例三处纠正（零产品缺陷、零产品码改动）**：(1) `textOf` 的选择器少写了一个闭合 `]`（`` `[data-testid='${testId}'` ``）导致全部取空串 —— 首轮 3/3 红的第一因，读自己的源码抓到；(2) `Set` 没有 `.some` → `TypeError`，把「旧页的行一个不留」改写成 `expect(narrow.filter(k => second.includes(k))).toEqual([])`，顺带更强（点名残留而不是布尔）；(3) **两条选择器过宽，其中一条是真实产品事实**：`button[aria-label='复制请求编号']` **不为列表行独有** —— 失败锚的 `RequestIdLine`（`states.tsx:552`）渲染同一个 `CopyValue`、同一个可及名，所以失败态下普查数出 1 而不是 0（`expected 1 to be +0`）；修法是把逐行普查限定到 `[data-testid^='aud01-cell-'] button[aria-label='复制请求编号']`，注释记下「锚与行共享可及名」。同因第二条：`[data-testid$='-status']` 的全屏扫会命中本面上别的 `-status` 节点，限定到 `[data-testid^='aud01-cell-'][data-testid$='-status']` 才是我想说的话（行格 `CopyValue` 不产播报节点）。
- 验证：新文件 **3/3 passed**，exit 0，2.27 s（`/tmp/r257-new2.log`；首轮 3/3 红，三处纠正后绿）；定向 `src/modules/health` → **37 files / 166 passed**，exit 0，3.71 s（`/tmp/r257-health.log`；开工前 36/163 ⇒ +1 文件 / +3 例）；`./node_modules/.bin/tsc -b . --noEmit` → **TSC_EXIT=2**（既有基线），`grep -Ec 'modules/health'` → **0**，`grep -c 'counts.paging'` → **0**，报错模块只有 `src/modules/approvals` / `employee-detail` / `employees`；`npx eslint src/modules/health/system.event.counts.paging.test.tsx` → **0**。全量尾行见文末补记。扫描：`LITERAL_UFEFF_COUNT = 0`（BOM 一律写 `/^\uFEFF/` 转义）、`FAKE_TIMERS = 0`（本文件不冻结时钟 —— 「已复制」的 2500 ms 复位是真 `window.setTimeout`，`states.tsx:542`）、头部全是 `//` 行（无块注释，故无 `*/` 序列风险）。
- 三档 N/A：纯测试，零 markup / CSS 增量，几何结论仍按 R93 起效。
- 边界：只新增 `web/src/modules/health/system.event.counts.paging.test.tsx` 与本节；`@/modules/audit/**`（含 `AuditEventsModulePage`）与 `@/lib/**` 只挂载/只读，从未编辑；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops / 任何产品码（含上游带来的 metrics/skills/tools/collab/org/people 改动，一律未覆盖未改写）；未 install、未并 main、未重建 9122、未启停任何服务；禁 force/amend/`--no-verify` 一律遵守；零产品码改动；本文件不新增任何产品 testid（`probe-location` 是私有证人节点）。
- 挂账：**R226（`web/src/modules/health/system.copy.width.test.tsx`）仍未开工**，其 DONE 号因此顺延为 **R134**；它的三条陈旧前提在案（读源矩阵没有逐行复制、`sys-evt-copy-<j>` 不存在、「复制文本含 rid」与产品相反 —— 分别由 R159 例② / R92 持有）。R242/R243/R244 仍未写（处置见 DONE R127/R128/R129）；R255、R256 本轮以 cite-only 结案，引用集在各自回执与压缩记录里。

> 全量实测补记（本笔落盘后）：`cd web && npx vitest run` → **451 files / 3418 passed, 0 failed**，exit 0，38.35 s（stderr 只有既有的 jsdom 「Not implemented: Window's open() method」×4）。开工前零红基线 437/3385（`05f87f2f`）；三次基线合并 `d252102d`（w105，+3 枚上游测试）+ `4f85c047`（w106，+1）+ `cb3c1b36`（w109，+9）共带 13 枚上游新测试，本笔 +1 文件 / +3 例 ⇒ 451 / 3418。**新零红基线 451/3418**（runner 是 vitest，不是 pytest）。

## R134 / sys-event-export-counts — /system 事件表「翻页后变宽回 30d」与「翻车用换窗逃生」（纯测试，R259；主题第六次到站）

- 基线：起自本地未推的 `ff84c097`（w110 合并笔），远端 = 我的 R257 `80d10564`。显式 refspec SSH fetch → upstream **正是派工点名的 `aa180f86112179cb696d371fe8a4fc873011b168` = `aa180f86 merge(lane): 5e4c1c21 (wave-112)`**（点名笔即合并笔本身，无章笔间接层）。祖先核验：点名 `aa180f86` → 0；**我的 `80d10564` → 0 —— upstream 已在 wave-111 `2b3d84fc merge(lane): 80d10564 (wave-111)` 并入 R257**；我的 `ff84c097` → 1（我自己的合并笔，其全部内容已在 w110 seal `a2a6b0d3` 之内）。按卡片原文 `git merge --no-ff` → 合并笔 **`e0d2eac7 merge(console): sync event export counts baseline`**，MERGE_EXIT=0，174 文件 +1646/−243（多为 gate 工件），PORC 0，未用 reset。写域增量 **EMPTY**；整个 `web/src` 增量 = 6 文件 +1355/−2：NEW 上游测试 `approvals/approvals.rowcopy.correlate2.test.tsx` (+317)、`audit/audit.detail.resource.link.test.tsx` (+365)、`audit/audit.export.detailcopy.order.test.tsx` (+479)、`knowledge/knowledge.detail.export.filter.matrix.test.tsx` (+165)；MODIFIED 上游产品 `people/people.css` (+8)、`tasks/tasks-density.css` (+23/−2) —— 全部上游带入，零笔由我改。**幻影合并核验通过：15 个 health 文件 5998 行一字未动**（608/388/489/403/529/461/516/420/310/320/327/259/235/318/415），w111/112 没带任何 health 文件。目标文件起先缺席。
- **`sys-evt` 族 = 第 42 条道（未变）**：现查跟踪树 97 处命中 / 24 个文件（全部 health 测试文件）/ health 产品码 0 命中。① 的三值面只能真面钉：`shownOf("aud01-status")` == `paintedRows().length` == `shownOf("aud5-export-count")`，复制钮普查 scoped 到 `[data-testid^='aud01-cell-']`（`RequestIdLine` 共享「复制请求编号」可及名，R257 坑）且「钮数==表体行数」相反（裸行 `-absent` span 无钮，诚实等式 = 钮数 == 带 rid 行数）。
- **①【已钉，不重写】**：我自己的 R240 `system.event.export.paging.test.tsx:462`（组合地址 30d 站、无翻车第 2 页）逐字持有本腿全部：`records.length - 1 === rows.length`、两枚 `shownOf` 同数、首行时间格 == 屏上 `-time` dd（秒形）前 16 字、首行 rid 格 == `screenRid(MID)` == RID_MID、文件不含上一页 rid、blob/url 各 1、导出零取数。另 R235 `:289`、R221 `:241`、R124 `:300`（7d 站首页三角 + 普查）。
- **②【净新站，测试 A `:315`】**：既有覆盖各持一半 —— R235 `:343` 钉的是翻页后【收窄】30d→24h；本波上游 `audit.export.detailcopy.order.test.tsx:396`（R271）钉的是【变宽到 30d】的文件换代 + 恰一记重问，但在裸 /audit 上且【没有翻页前情】。「先翻到第 2 页、再变宽回 30d」在 `?tab=events` 组合地址上没人测过。本笔钉：宽窗那一问丢游标（`cursorsOf === []`）、`windowHours` 720、`paramOf(read,"window")` null（档位从不上线路）；行集换成宽窗自己的第 1 页 `[A, B]` —— 替换非累加，窄页第 2 页的 C/D/E 离场即便 30d 覆盖它们；`aud2-page` 归「第 1 页」；三值重算到 2；`valueKeys [A]`/`absentKeys [B]`/钮数 1；文件列头六字、数据行 == 新表体、rid 列 `[RID_A, ""]`（裸行是空格不是占位）、RID_C/RID_D 一格不渗、blob/url 各 1、文件名 `/^audit-.+-\d{8}-\d{4}\.csv$/`、**导出点击字面为零**、`listReads()` 停在 3。**「零额外请求」与产品相反**（上游 :396 自己的裁决原文「a tier switch is exactly one re-ask」）：换窗那一问就是一笔重取，字面为零的是导出点击 —— 本笔按这个形制钉。
- **③【两半已钉 + 净新迁移，测试 B `:381`】**：「保旧行」与产品相反，**第 10 次登记**（R161 `:339`/`:361` + 头 :19-21；R244 条款 (b) + `:316`；R213 `:302`；R250 `:287`；R240 `:334`；R257 `:360`）；「只导成功页」在翻车当下也相反 —— 什么都不导，两扇门关死、`aud5-export-count` 老实「将导出 0 条」（产品 `AuditEventsModulePage.tsx:1620` 无条件），归 R240 `:334`；重试恰 +1 归 R240 `:387` + R213 `:302` + R249 `:398`；三值正确形制「一起动、一起对」归 R257 `:360`。**没人测过的迁移 = 翻车后不按重试、按换窗逃生**，本笔实测钉：错误面上 `aud01-filter-window-30d` 钮**还在**（过滤器条不在错误面板之内）；那一记宽窗重问**恰 +1** 就把错误面板与失败锚一起带离（`textOf("aud01-error-request-id")` 为空）；丢游标、落宽窗第 1 页 `[A, B]`、页码归 1、三值对上 2；**坏掉的窄页没有被顺带重问**（带 `cur_w7p2` 的请求仍恰 1 条 —— 逃生走的是新问题不是重试）。
- 两处落盘前自查纠正（零红→修轮，首跑即 2/2 绿）：mount 地址曾写成带 `.replace("tab/","tab=")` 的 hacks，改回字面量；`q_HTML_disabled` 是不存在的助手，补 `q<T>(testId)` 并改用 `q<HTMLButtonElement>("x")!.disabled`（既有坑：本项目无 jest-dom）。
- **上游 tsc 缺陷披露（不修）**：`tsc -b . --noEmit` 报错模块本波首次多出 `src/modules/audit` —— `audit.export.detailcopy.order.test.tsx(384,31) TS2345：'"关联"' 不在六字列头联合类型里`，来自上游笔 `0ff9446b`，随基线合并带入；不在我写域、零笔由我改、按纪律只披露不代修（vitest 不做类型检查，全量仍零红）。
- 验证：新文件 **2/2**（`/tmp/r259-new.log`，exit 0，首跑即绿）；定向 health → **38 files / 168 passed**（开工前 37/166 ⇒ +1 文件 / +2 例）；`tsc` TSC_EXIT=2（既有基线），own_health 0，本文件日志无名；`eslint` 0；全量 → **458 files / 3435 passed, 0 failed**，exit 0，42.22 s（451/3418 + w110 的 2 个上游测试文件 + w111/112 的 4 个 + 本笔 1 个；stderr 只有既有 jsdom 「Not implemented: Window's open() method」）。扫描：`LITERAL_UFEFF_COUNT = 0`、`FAKE_TIMERS = 0`（本文件永不冻结计时器，假服务按请求自己的 from/to 跨度与 cursor 决定行集）、头注全 `//` 行（助手行是合法单行 `/** … */` JSDoc）。runner 是 **vitest，不是 pytest**。新零红基线 458/3435。
- 三档 N/A：纯测试，零 markup / CSS 增量，几何结论仍按 R93 起效。
- 边界：只新增 `web/src/modules/health/system.event.export.counts.test.tsx` 与本节；`@/modules/audit/**`（含 `AuditEventsModulePage`）与 `@/lib/**` 只挂载/只读，从未编辑；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops / 任何产品码（上游带入的 people/tasks 样式笔未被覆写也未回退）；未 install、未并 main、未重建 9122、未启停任何服务；未 force / amend / `--no-verify`；零产品码改动；本文件不新增任何产品 testid（`probe-location` 是私有证人节点）。本次推送一并携带此前本地未推的 `ff84c097`（w110）与 `e0d2eac7`（w112）。
- 挂账：**R226 仍未开工（DONE 槽位因此顺延为 R135）**，其三条陈旧前提在案（读源矩阵没有逐行复制、`sys-evt-copy-<j>` 不存在、「复制文本含 rid」与产品相反 —— 分别由 R159 例② / R92 持有）；R242/R243/R244 未写（处置见 DONE R127/R128/R129）；R255/R256/R258 已按各卡「已覆盖只回证据」条款收口为引用式报告；本卡是导出×分页×计数主题第六次到站（R238→R245→R256→R257→R258→R259），① 全程引用未重写，净新只有 ② 的组合地址变宽站与 ③ 的换窗逃生迁移两条。

> 全量实测补记（本笔落盘后）：`cd web && npx vitest run` → **458 files / 3435 passed, 0 failed**，exit 0，42.22 s（开工前基线 451/3418；w110 带入 2 个上游测试文件、w111/112 带入 4 个、本笔 +1 文件 / +2 例）。新零红 standing baseline = 458/3435。runner 是 vitest，不是 pytest。

## R135 / sys-event-empty-clear — /system 空卡自己的主操作：类型支、三元优先与换词，加上失败面那颗缺席（纯测试，R260 自选）

- 派工 @323@ 授权本域自选一条未覆盖的交叉组合（导出/筛选/分页/空态/错误态），锚点必须现存，单文件三例，单 commit `test(console): system guards`。选定：**空态 × 筛选 × 空卡主体操作按钮的维度优先**——现查 `git grep` 字面量 `aud01-empty-clear` / `aud01-empty-actions` 在全 `web/src` 命中 **0**（testid 由模板拼出：`states.tsx:689` `data-testid={`${testId}-clear`}`、`:686` `-actions`），这枚产品按钮从来没有测试引用过它。近邻各钉一边都不碰它：R123 `system.event.empty.test.tsx:346` 点的是【卡下具名出口】`audB-empty-clear`（窗那一维，组合地址，钉过「恰多一问」、from/to 被擦、tab 逐字、三值回来）；上游 `audit.empty.test.tsx:246` 点的是【卡下具名出口】`audD-empty-clear`（类型那一维，裸 `/audit`，钉过 `pairs()==["window=7d"]` 与 action 下线）。没钉过的三件事：空卡自己的主操作、它的三元优先（`AuditEventsModulePage.tsx:1908-1912`：custom > type，产品注释 :1905-1907「优先对应面板标题所述的那一维……另一维的具名出口仍在卡下原处」）、清掉一维后主操作【换词】；另补一层从未断言的缺席——`ErrorPanel`（`states.tsx:707`）不吃 clear prop，失败面没有这颗门。
- 基线：起自 HEAD = 远端 `5657b4ce`（R259）PORC 0。显式 refspec fetch → 上游 **恰等于点名的 `d356be02cb48c0ebc88163656d4e2c82b0b8f3e7` = `d356be02 merge(lane): ff0cca2b (wave-114)`**（章笔无间接层，点名即合并笔本身）；祖先双向核验：点名 `d356be02` → 0，我的 R259 `5657b4ce` → **0**（上游已在 `f3a7ec44 merge(lane): 5657b4ce (wave-114)` 并入——派工「R259 已并入 d356be02」的前提实测成立）。我的 HEAD 是上游祖先 ⇒ 按派工原文 `git merge`（无 `--no-ff`）**快进**到 `d356be02`，MERGE_EXIT=0，PORC 0，未 reset，无合并笔、无落空内容。写域增量 **EMPTY**；整个 `web/src` 增量 = 上游带入 3 枚新测试（`approvals.export.drawer3` +301、`audit.detail.copy.paging.filter` +401、`knowledge.export.preview.detail` +160）+ 上游自修 `audit.export.detailcopy.order.test.tsx` ±2 + `table-density.css` +1——零笔由我改。**幻影合并复点通过：6429 恰如预言**（16 个 health 文件 608/388/489/403/529/461/516/420/310/320/327/259/235/318/415/431，wave-113/114 没带 health 笔）。
- 副产品披露：上游那笔 ±2 修掉了 wave-112 自己带进来的 `audit.export.detailcopy.order.test.tsx(384,31)` TS2345——我在 R259 回执里披露的「第四个 tsc 基线模块」就此消失，本笔 tsc 报错模块回到既有三个（approvals / employee-detail / employees），我没动过任何一行。
- 三例（461 行，`it` 在 `:273`/`:325`/`:377`，全部钉在 `?tab=events` 组合地址）：① 类型空态站 `?window=7d&type=approval.denied`（假服务按请求自己的 `action` 参数筛，地址键 `type=`、请求键 `action=`，产品 :779/:832）——主操作在屏且逐字说「清掉类型筛选，回到全部类型」，卡下两条具名出口按产品原样并存（`audD-empty-clear` 同词、`audB-empty-clear` 空态片段无条件渲染），两扇门各自关死各自原因句，`aud5-export-count` 逐字「将导出 0 条」（产品 :1620 无条件），`aud01-status` 逐字「这个筛选条件里没有审计事件」无数字（`shownOf === -1`），零 `sys-evt*`、零行格族，强点两扇门 blob/url/请求全零；② 主操作逃生——点它恰 +1 问，新问 `action` 下线而窗对一字未动（七天跨度、`window` 键 null、游标空），地址**只擦 `type=`** 而 `tab=events` 与 `window=7d` 逐字（复合地址这一半是净新：上游同话在裸 /audit），空卡连同按钮撤走，三值与普查回来（`valueKeys [A]`/`absentKeys [B]`/钮数 == 带 rid 行数 ≠ 表体行数），门开（`.disabled === false`），导出给六词列头全形文件、rid 列 `[RID_A, ""]`、blob/url 各一、档名合规，**导出点击字面零问**；③ 两维叠站 `?window=custom&from&to&type`——主操作优先说窗支「清空区间，回到最近 7 天」（三元优先首钉），类型具名出口仍在卡下；点窗支恰 +1 问且**那一问仍带 `action=`**（只清了一维，优先权的事实在线路形上）、仍空、主操作**换词**成类型支（换词首钉），地址 from 被擦而 type 留着 tab 逐字；再点恰 +1 问 action 下线、全量回来、三值一起对；尾巴 `failPage2` → 加载更多翻车：**整页清空不是保旧行**（第 11 次登记：R161 :339/:361+头 :23-25、R244 条款 (b)/:316、R213 :302、R250 :287、R240 :334、R257 :360、R259 :381），错误锚带可复制 FAIL_RID，**`aud01-empty-clear` 在失败面为 null**（ErrorPanel 不吃 clear，这层缺席第一次被钉），零 `sys-evt*`；清旗标后按「重试」文本钮（MouseEvent 派发，该钮无 testid）恰 +1，`listReads()` 1→2→3→4（翻车那一问自己也花钱）→5，起来是重试那一页 `[C]` 非并集，三值跟着到 1。
- 口径登记：`sys-evt-count`/`sys-evt-copy-<i>` 整族不存在——**第 43 条道**现查 **103 处命中 / 25 个文件**（全部 health 测试文件，本文件自己的不计入），health 产品码 **0**；三值钉在 `aud01-status` × `aud5-export-count` × 屏上行数，复制普查钉在 valueKeys+absentKeys（「钮数 == 表体行数」与产品相反，裸行 `-absent` span「该字段未返回」无按钮）；档位从不上线（`window.ts:22/:77/:105` 只发 from/to 对，7d = 168 h 跨度、`paramOf(read,"window")` 恒 null）。已覆盖只回证据不重写：R123 :346/:437、上游 audit.empty:246、R221 :241/:276/:315/:365/:394、R235 :289/:343/:357、R240 :334/:387/:462/:496、R241 :246/:279/:323/:366、R257 :272/:314/:360、R259 :315/:381、R213 :302、R225 :198/:261、R124 :300、`system.window.isolation:212/:239/:278`。
- 自用例两处纠正（零产品缺陷、零产品码改动）：(1) rid 列普查漏了 `.slice(1)`，把列头行也数进去（run 1 收到 `['请求编号','req-clear-0001','']`）；(2) 例 ③ 尾部账本算术把翻车那一问漏了——加载更多失败自己也花一问，`listReads()` 终值是 5 不是 4（既有坑「普查数每一问」再吃一次）。首跑 2/3 红，两笔都是断言侧修正，二跑 3/3 绿。
- 验证：新文件 **3/3**（`/tmp/r260-new2.log`，exit 0，1.96 s）；定向 `src/modules/health` → **39 files / 171 passed**（开工前 38/168 ⇒ +1 文件 / +3 例）；`./node_modules/.bin/tsc -b . --noEmit` → TSC_EXIT=2（既有基线），`grep -Ec 'modules/health'` → **0**，新文件全log 0 次点名，报错模块仅 approvals / employee-detail / employees；`npx eslint <本文件>` → **0**；`LITERAL_UFEFF_COUNT = 0`、`FAKE_TIMERS = 0`（本文件永不冻结计时器，头部 `//` 行注释无 `*/` 隐患）。全量尾行见文末补记。本文件不新增任何产品 testid；`probe-location` 是私有证人节点。
- 三档 N/A：纯测试，零 markup / CSS 增量，几何结论仍按 R93 起效。
- 边界：只新增 `web/src/modules/health/system.event.empty.clear.test.tsx` 与本节；`@/modules/audit/**`（含 `AuditEventsModulePage`、`states.tsx`）与 `@/lib/**` 只挂载、只读，从未编辑；未碰 App.tsx / `web/src/shell/**` / routes / registry / package·lock / `web/scripts/**` / ops / 任何产品码（上游 wave-113/114 带入的笔既未覆盖也未回退）；未 install、未并 main、未重建 9122、未启停任何服务；未 force / amend / `--no-verify`；零产品码改动。
- 挂账：**R226 仍未开工**（`health/system.copy.width.test.tsx` 零笔，三条陈旧前提在案：读源矩阵没有逐行复制、`sys-evt-copy-<j>` 不存在、「复制文本含 rid」与产品相反——分别由 R159 例② / R92 持有），其 DONE 号因此顺延为 **R136**；R242/R243/R244 未写（处置在 R127/R128/R129）；R255/R256/R258 已按「已覆盖只回证据」关闭。

> 全量实测补记（本笔落盘后）：`cd web && npx vitest run` → **462 files / 3443 passed, 0 failed**，exit 0，43.88 s（stderr 只有既有 jsdom 「Not implemented: Window's open() method」）。开工前基线 458/3435（R259 落盘时）；快进到 wave-114 带入 3 枚上游新测试，本笔 +1 文件 / +3 例 ⇒ 新零红基线 462/3443。运行器是 **vitest**，不是 pytest。
