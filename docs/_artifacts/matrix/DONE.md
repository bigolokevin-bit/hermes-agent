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
