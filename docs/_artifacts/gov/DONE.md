# 波 3 治理组 — T20 / T21 / T23 / T24

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
