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
