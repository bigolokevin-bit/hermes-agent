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
