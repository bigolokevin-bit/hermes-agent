# T13 能力与权限矩阵 — 首交

- 分支：`lane/console-matrix`（base `36127bab`）
- 写域：`web/src/modules/matrix/**` + 本文件
- 数据口：BFF `/api/matrix` → domain `/v1/matrix/employees`（`reuse: /v1/matrix/employees` 注释在 `MatrixModulePage.tsx` 的 fetch 行上方）
- 状态：**等 /api/matrix**。BFF 未就绪时，404/不可达会启用 fixture 预览，页面根节点带 `data-fixture="1"` 与「示例数据」角标 + 说明条；真实数据到达时角标自动消失。

## 已实现

- 双视角：按员工（默认）/ 按能力，`?view=resource` 写回 URL，切换保留 `state` 与滚动位置。
- 单元格三态：已授权 / 未授权 / 待核实（数据里缺失或不可识别的格子一律「待核实」，不回落为空或「未授权」）。
- 四态真：加载 / 空 / 错（含请求编号，缺失显「未提供」）/ 无权限；另有 `?state=loading|empty|error|denied` 预览句柄供验收截图，不依赖后端。
- 零工程语言：员工显示「姓名 · 8 位短码」，原值只在 `title`；页面正文不出现 `emp_`、`human:` 或字段名。
- 布局：1440/1280 正常铺开；小屏单列，宽表只在表格容器内横向滚动，外层无横溢。

## 原始 stdout（本机实跑）

```text
$ cd web && pnpm test
 Test Files  82 passed (82)
      Tests  558 passed (558)
   Duration  3.98s

$ cd web && pnpm lint
✖ 57 problems (0 errors, 57 warnings)

$ cd web && pnpm typecheck
(exit 0, no output)

$ cd web && pnpm build
✓ built in 2.24s
hermes_cli/web_dist/index.html → assets/index-OxfNltCG.js (141.20 kB)
(EXIT 0)
```

## 环境修复（未被 git 跟踪）

首跑 `pnpm build` 时 `tsc -b` 在 `apps/shared/src/*.test.ts` 报 49 个 `Cannot find module 'vitest'`。原因是本树 `node_modules` 为软链，`vitest` 只在 `web/node_modules` 下，`apps/shared` 向上解析不到。已补软链（`node_modules` 在 `.gitignore` 内，不入库）：

```bash
mkdir -p apps/shared/node_modules
ln -sfn ../../../web/node_modules/vitest apps/shared/node_modules/vitest
```

修复后 `pnpm build` 与 `pnpm typecheck` 均 EXIT 0。

## 下一步

- BFF `/api/matrix` 就绪后：删掉 fixture 兜底分支即可（reader 已按契约形状解析，无需改 UI）。
- 补：能力分组筛选、员工搜索（等真实数据字段确认）。

## 收口自检（2026-11-19，基于 156897bf）

| # | DoD | 结果 | 证据 |
|---|---|---|---|
| 1 | 必带 `reuse:/v1/matrix/employees` | PASS | 4 处：`matrix.ts:5` 头注、`manifest.ts:8` 头注 + `:21` reuse()、`MatrixModulePage.tsx:78` 紧贴 fetchJSON |
| 2 | 未知/缺源格显式「待核实」+ GAP | PASS | unknown 单元格带 `data-gap="1"`、`title="GAP：后端没有给出这一格…"`、小号 `GAP` 徽标；不空白不猜 |
| 3 | 双视角真切换 | PASS | `?view=people|resource`，`setParams(..., {replace:true})` 不刷新，`buildMatrixView` 重算行列 |
| 4 | 四态真 | PASS | loading/empty(带原因)/error(人话+请求号+重试)/denied(降级页)；`?state=` 可预览 |
| 5 | 姓名 · 8 位短码、宽表仅表内滚 | PASS | `employeeLabel` = 「姓名 · XXXXXXXX」，原值仅 title；`matrix-scroll` overflow-x-auto，内层 min-w-[720px] |
| 6 | fixture 角标与端点说明 | PASS | `data-fixture="1"` + 「示例数据」badge + `matrix-fixture-note`：等 `/api/matrix` |

原始命令尾行（cwd `web/`）：

```
pnpm test      → Test Files  82 passed (82) / Tests  558 passed (558)
pnpm lint      → ✖ 57 problems (0 errors, 57 warnings)
pnpm typecheck → exit 0（无输出）
pnpm build     → ✓ built in 2.13s · hermes_cli/web_dist/index.html
```

## T25 证据与引用（`web/src/modules/evidence/`）

DoD 自证（本模块，2026-11-19）：

| 条目 | 结果 | 证据 |
|---|---|---|
| ① 引用列表消费 `/agent-api/*` | PASS | `EvidenceModulePage.tsx`：`// reuse: /v1/run-events/citations` 紧贴 `fetchJSON('/agent-api/api/run-events?kind=citation&limit=50')`；数据层 `evidence.ts` 亦带 `reuse: /v1/run-events/citations` |
| ② 每条引用可点回原文 | PASS | 有站内 `href` → `<Link>打开原文</Link>`；无 href → 静态块「原文不可达」+ 具体原因（不渲染可点控件） |
| ③ 缺失/未知 id 显「待核实」 | PASS | `data-gap="1"` + `evidence-gap-<id>` + GAP 小标；员工显示「姓名 · 8 位短码」，裸 id 只在 `title` |
| ④ 四态真 + 请求号 + 403/404 同体 | PASS | `evidence-loading/-empty/-error/-denied`；error/denied 均带请求编号（缺失显「未提供」）与重试；403 与 404 文案同体 |
| ⑤ 1440/375 无横溢 | PASS（结构） | 列表为 `ul.divide-y` 单列卡片，无固定宽表格；标题/摘要 `break-words` |
| ⑥ fixture 带 `data-fixture` + GAP 号 | PASS | 根节点 `data-fixture="1"`、`Badge tone="warning">示例数据`、`evidence-fixture-note` 写明 `GAP-1：等 /api/run-events 与 /api/audit` |

原始命令尾行（cwd `web/`）：

```
$ pnpm test
Tests  558 passed (558)
Duration  3.62s

$ pnpm lint
✖ 58 problems (0 errors, 58 warnings)

$ pnpm typecheck   # tsc -b . --noEmit
（无输出，exit 0）

$ pnpm build
✓ built in 2.30s
built /Users/kevin_studio/Projects/forks/console-matrix/hermes_cli/web_dist/index.html
```

### 需 A 注册的路由清单（T25）

- 模块：`web/src/modules/evidence`，manifest `module: 'evidence'`，tab `id: 'evidence'`，tab 名「证据与引用」
- hash：`#/knowledge?tab=evidence`（`web/src/shell/routes.ts` 第 158–159 行已存在该行，`module: 'knowledge'`）
- 现状：`App.tsx:1107` 的 `/knowledge` 渲染 `ConsoleModulePage module="knowledge"`，注册表按 module 过滤，因此 **`evidence` 模块当前不会被该路径拾取**
- 需 A 二选一：①新增 `/evidence` 路由 + 侧栏入口指向 `#/knowledge?tab=evidence`（或 `#/evidence`）；②把 evidence 的 live 节点接入 knowledge 面板的 `evidence` tab（`ConsoleModulePage live` 参数）
- 数据口未就绪时的降级：BFF 404 或不可达 → fixture + `data-fixture` 角标，接上后同一列表直接显示真实引用

## T28 模型与单价（models/pricing）

写域：`web/src/modules/models/{models.ts, ModelsModulePage.tsx, manifest.ts}`；数据：`/agent-api/api/models`（目录/选项）+ `/agent-api/api/models/pricing`（价格表）。

DoD 逐条：
- PASS 单价与 ledger 实际扣费分两块呈现：上卡「单价（价目表）」，下卡「实际扣费（账本）」；各自标题行标来源与 asOf（`读取于` / `截至`，北京时间到分）。
- PASS 禁止单价×用量当已花费：页面口径句明写「本页不用单价乘用量，也不把两块数字相互换算」；`models.ts` 头注释同口径。
- PASS 未知/未配置显「—」+原因：`fmtUnitPrice` / `fmtUsd` / `fmtStamp` 缺值一律 `—`；两块表各自有空表说明；fixture 行里 Strata 本地模型输入/输出/扣费均为 `—`。
- PASS 货币 USD、时间北京时间到分：`$` 前缀 + `Intl 'sv-SE'`/Asia/Shanghai。
- PASS 四态齐 + 请求号：`models-loading/-empty/-denied/-error`；error 与 denied 均带「请求编号：…（缺失显未提供）」，可 `?state=` 预览。
- PASS 1440/375 无横溢：宽表只在 `models-price-scroll`（内层 `min-w-[640px]`）与 `models-spend-scroll`（`min-w-[520px]`）内滚动，外层卡片不横向溢出。
- PASS 数据未就绪诚实降级：两接口 404 或不可达（status 0）→ fixture + `data-fixture="1"` + 顶部「示例数据」说明条。

原始命令尾行（cwd `web/`）：
- `pnpm typecheck` → `tsc -b . --noEmit` 无输出，exit 0
- `pnpm test` → `Tests  558 passed (558)`（4.42s）
- `pnpm lint` → `✖ 59 problems (0 errors, 59 warnings)`（基线 58，本模块 +1 warning）
- `pnpm build` → `✓ built in 2.39s` / `built /Users/kevin_studio/Projects/forks/console-matrix/hermes_cli/web_dist/index.html`

需 A（集成）注册：`#/models` tab —— module `models`、label「模型与单价」、`kind:'reuse'` 已就绪；shell `ROUTE_TABLE` 当前无 `#/models` 条目（`web/src/lib/resolve-page-title.ts` 里的 `/models` 属旧页，不复用）。

GAP：BFF 尚无 `/api/models` 与 `/api/models/pricing`（仓内 `apps/` 无 console 服务）；接上后同一张表直接显示真实值，无需改页面。
