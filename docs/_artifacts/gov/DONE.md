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
