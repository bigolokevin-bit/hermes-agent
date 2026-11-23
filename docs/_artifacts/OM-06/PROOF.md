# OM-06 趋势数据契约 — PROOF

分支 `task/OM-06`，基线叠于 OM-05（`ad8ef53bc4`，链 OM-01→03→04→05）。
改动文件：`web/src/modules/overview/OverviewPage.tsx`（Trend 空态分支）、
`web/src/modules/overview/overview.trend.test.tsx`（新增 6 例）。

## 裁定与实现

1. **全缺桶（读口没返回）≠ 全真零**：两走各的空态文案，都不画骨架 / 4px 柱。
   - 全 `runs:null` → `ov6-trend-missing`：「{窗}的运行数据没有返回，所以画不出趋势。」（不含「还没有运行记录」，不冒充无数据）
   - 全 `runs:0` 或无桶 → 「{窗}还没有运行记录，所以没有趋势可画。」+ 去运行记录链接
2. **混合窗照常逐桶画**：缺读数桶保留 `.ov5-bar.is-missing` 形（无内芯柱、title 说「未返回」），不以 0 高柱冒充。
3. **失败数不误导**：只进悬停 title；`failed:null` 显示「失败 —」不折算 0（生产 `trendPoints` 本就保 null，本次测试曾以夹具 `?? 0` 掩盖——夹具已改，测试同时钉死两条 title 形制）。
4. **除零防线**：`Math.max(1, …)` 保持；0 次运行柱高下限 4%（可测，非 NaN）。
5. **桶上限随档**：`trendPoints(…, days)` 7/14/30 收口（OM-04 已建，本件补钉）。

## DoD 对照（overview.trend.test.tsx，6 例全绿）

| DoD | 钉法 |
|---|---|
| 12 桶含 2 null → bars=12, is-missing=2 | 测试① 含逐桶对齐（index 3、9 为缺桶）与无内芯柱断言 |
| 全 0 桶 → 空态且 bars=0 | 测试④ |
| hover title 含「失败 n」 | 测试②（`失败 3`；null 时 `失败 —`） |
| 全 null → 空态句且不画骨架 | 测试③（含「没有返回」、不含「还没有运行记录」） |
| 桶上限随档 14/30（含 7） | 测试⑤ |
| max(1,…) 除零防线 | 测试⑥（height 全为合法百分比，0→4%，峰值→100%） |

## 门禁

- `vitest run src/modules/overview` → **36 passed**（19 原有 + 11 OM-05 + 6 OM-06）
- `vitest run src/modules/overview src/modules/duty src/shell`（预构建）→ **29 files / 306 passed / 1 skipped**（skip=e1Contract 环境腿）
- `node scripts/lint-fake-success.mjs` → `ok:true, violations:[]`
- `node_modules/.bin/vite build` → exit 0
- 构建后 e1Contract 会翻红（现网 9122 entry hash ≠ 本地 dist）：结构性环境红，判环境不判 diff（同 OM-03/04/05 口径）。

## 现网脸实证（本地 dist 服务 9182 代理 9122 BFF，jar 会话）

- AUTH `/agent-api/api/employee-stats` → 200 total=3
- `#/overview?range=7d`：`ov6-page` 在、`duty-page` 无；趋势标题「近 7 天运行趋势」；
  真读数 5 根柱（读口只回有运行的日桶）、is-missing=0；首柱 title 「11/12 · 1 次运行 · 失败 —」
  —— 上游缺 failed 字段显示「—」不折 0，正是本件契约的活体呈现。
- `#/overview?range=30d`：标题随窗，5 根柱。截图 `overview-7d-1440.png`、`overview-30d-1440.png`。
- `/run-activity` 请求数 = 0（OM-04 治理持续有效）。
- 附带发现（不属本件范围，登记给后续）：首帧挂载先按默认档发一次 `timeseries?range=30d` 再按 URL 档重发
  `range=7d`（useDutyData 初始 collect 与 URL 同步的顺序工件，OM-04 既有行为）。一次白读，
  非正确性问题；若要收口属 OM-12/性能治理。

## 待 L0 回写

deep 文档趋势条款可加一行：「全缺桶与全真零各走空态（OM-06 已实现并钉测），缺桶 is-missing 逐桶对齐。」
（board 仓写域归 L0，本文本供移植。）
