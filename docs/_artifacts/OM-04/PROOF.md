# OM-04 交付实证 — 总览时间窗四档（?range= 接 dutyRange）

分支 `task/OM-04`，stacked：OM-01（挂载）→ OM-03（网格）→ 本件。合并顺序即此序。
基线 `origin/lane/hermes-console` = 648233693d。

## 改动
- `web/src/modules/overview/OverviewPage.tsx`：头部四档 seg（复用 `DUTY_RANGES`，钮 `ov6-range-<id>`，`aria-pressed`）；`?range=` 经 `parseDutyRange` 回落默认档并以 `ov6-range-fallback` span（title 说明）显形；趋势卡标题/`aria-label`/空态句改随窗变量（`近 X 天运行趋势`、`X 还没有运行记录`）；`LiveOverview` 以 `useDutyData(rangeId, { activity: false })` 挂载。
- `web/src/modules/overview/overview.ts`：`trendPoints(stats, days)` 按档取桶（14d→14、30d→30、7d→7、24h 走小时桶），替换硬编码 `-14`。
- `web/src/modules/duty/useDutyData.ts`：activity 腿加消费者开关（默认 `true`，DutyPage 行为零回归；总览显式 `false`）。**裁定 ④：总览无热力可渲染 → 不请求**，不做白读腿；占位 `Loadable` 保持 loading 形制且不进错误静默重试计数。
- `web/src/modules/overview/overview.css`：`.ov5-head-actions` / `.ov5-seg` / `.ov5-seg-btn(.is-active)` / `.ov5-range-fallback`（全部走 --color-* 令牌，无裸色值）。
- 新增 `web/src/modules/overview/overview.window.test.tsx`（9 例）。

## DoD 逐条（真 BFF 9122 现脸实测，见 om04-proof.log）
1. `?range=7d`：DOM 出现「近 7 天运行趋势」、卡内无「近 14 天」；timeseries 请求 `range=7d`，返回 3 桶真值（2026-11-20 value=44）✅
2. 切窗 14d→24h：新增请求仅 `favicon.svg + timeseries?range=1d`（=1 类数据腿，24h 档 tsRange 映射 `1d`）；`run-activity` 与 `employees` 新增 **0** ✅
3. 四档 URL reload 可用：24h/7d/14d/30d 深链各测通过（测试③+浏览器①④）✅
4. 非法 `?range=9d`：回落近 14 天，且 title=「时间窗参数「9d」不是可用档位，已按「近 14 天」读取」✅
5. 全局 `run-activity` 请求数 = **0**（总览不再白读）✅
6. 375 视口：seg 控件收纳不溢出（right 298 ≤ 375），`?range=30d` 标题「近 30 天运行趋势」✅

tsRange 映射（复用 duty 既有表，未新建）：24h→`1d`、7d→`7d`、14d→`30d`（读后裁 14 桶）、30d→`30d`。
判据口径注：`ov6-range-14d` 钮文本合法含「近 14 天」，故「无近 14 天」断言只作用于 `[data-testid="ov6-trend"]` 卡内，静态扫勿以全局 grep 判红。

## 门禁
- `vitest run src/modules/overview`：**18 passed**（既有 9 + 新 9）。
- `vitest run src/modules/overview src/modules/duty src/shell`：**27 files / 288 passed / 1 skipped**（skip=e1Contract 未部署腿；build 后该腿比对已部署 hash 为结构性红，判环境不判 diff）。
- `vite build` exit **0**。
- 截图：`overview-7d-1440.png`、`overview-24h-1440.png`、`overview-9d-fallback-1440.png`、`overview-30d-375.png`。

## 待办移交
- deep doc（board `docs/product/design/console-v2/deep/01-overview.md`）「窗口四档」回写：本 PROOF 文本可整段移植（board 写域 L0，我未代笔）。
- OM-12 收口时 `?state=` 强制分支仍在 OverviewPage（本件未触碰）。
