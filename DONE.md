# Q6 · 运行详情 trace 时间线与步骤状态

- 分支：`task/Q6-runs-trace`
- 基线：`origin/lane/hermes-console` @ `5710116161`
- 功能提交：`d4e4c065c1087dfd0c8b009606480de324c775be`
- 写域：`web/src/modules/runs/**`

## 改了什么

- `runs.ts`：新增 `traceTone` / `traceCounts` / `stepExcerpt`。全部只从详情读取已经返回的 events 派生；载荷没有输入/输出时返回 `text: null` + 原因，由页面显示「未采集」。
- `RunsModulePage.tsx`：「事件时间线」标题下新增 `run6-trace` 步骤条——每步一个 Badge 状态点（成功/进行中/失败/其他），首行为「共 N 步 · 已完成 x · 进行中 y · 失败 z」；`hasMore` 时显示「后续还有更多步骤，这次没有读到。」；每条事件新增可展开「步骤详情」，展示输入/输出摘录（截 160 字）。
- `runs-density.css`：追加 Q6 窄屏约束（`max-width: 100%`、`min-width: 0`）。
- `runs.trace.test.tsx`：新增 8 个用例（helper 语义 3 个、页面渲染 5 个）。

## 原始输出

vitest（`web/` 目录，`vitest run src/modules/runs`）：

```
 Test Files  18 passed (18)
      Tests  225 passed (225)
   Duration  3.67s (transform 17.70s, setup 0ms, import 25.19s, tests 6.81s, environment 14.88s)
```

`VITEST_EXIT=0`

TypeScript（`tsc -p tsconfig.json --noEmit`）：`TSC_EXIT=0`（0 errors）。

打包（`vite build --outDir /tmp/q6-dist`）：`VITE_EXIT=0`（产物已出）。

官方构建包装 `node ../scripts/build/web.mjs`：`BUILD_EXIT=1` —— 卡在仓库既有的 solution 级 tsc 旧债：**26 个文件 106 条 error**，全部在 `web/src/modules/runs/` 之外（如 `src/components/ui/Tabs.tsx`、`src/modules/approvals/*`、`src/modules/employee-detail/*`、`src/modules/evidence/*`）；`modules/runs` 命中 0 条。该旧债不属于本车道写域，未改动。

## 1440 / 375

结构判据已进测试：`run6-trace-steps` 的 `ol` 带 `flex-wrap` + `min-w-0`；步骤详情的 `dd` 带 `min-w-0` + `break-words`；`runs-density.css` 限制 `max-width: 100%`。像素级 1440/375 截图未做——官方构建被上述仓库旧债挡住，本车道无权修改其它模块。

## 文件

```
 web/src/modules/runs/RunsModulePage.tsx  |  72 ++++++++++++
 web/src/modules/runs/runs-density.css    |  10 ++
 web/src/modules/runs/runs.trace.test.tsx | 189 +++++++++++++++++++++++++++++++
 web/src/modules/runs/runs.ts             |  79 +++++++++++++
 4 files changed, 350 insertions(+)
```