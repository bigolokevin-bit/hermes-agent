# Q14 — Metrics byModel 分组表（模型/调用数/成本/成功率，缺字段显示「未接」）

工单：只做一件事——`web/src/modules/metrics/**` 增加 byModel 分组表，数据走现网 BFF 既有 runs/metrics 端点；缺字段显示「未接」不补假数。基 origin/lane/hermes-console 现取；vitest+build 过；commit+push+DONE 贴双视口图与原始 JSON；禁 force。

## 1. 基线自证（现取，非转述）

```
git fetch origin lane/hermes-console          # origin tip = 648233693d（merge(q8) 五高频页375证据）
git merge-base --is-ancestor 5ddee38447 648233693d   # yes → 树可 ff
git merge --ff-only origin/lane/hermes-console       # 树基线 5ddee38447 → 648233693d
```

提交链：`648233693d`（基线）→ `233b0badcc` feat(metrics) → `777a9de16e` test(metrics) → 本 DONE/证据笔。

## 2. 交付内容

- `web/src/modules/metrics/metrics.ts`：`ModelBreakdownRow` / `readModelBreakdown`（读现网 `/api/hermes-usage` 顶层 `by_model` 扁平行 `input_tokens/output_tokens/api_calls/sessions`；成本只认 `actual_cost_usd|cost_usd` 且仅当顶层 `cost.source` 缺失或 `=cost_ledger`；`success_rate` 或 `succeeded+failed` 推导，否则 null=未接）/ `sortModelBreakdown`（tokenTotal→costUsd→名，null 沉底）。
- `web/src/modules/metrics/MetricsModulePage.tsx`：`metBM-by-model` 区块（列：模型/输入tokens/输出tokens/合计/调用次数/会话数/成本/占比/成功率 + tfoot 合计行），接入手动刷新与窗口切换；`loading/empty/denied/error` 各态齐；缺值单元格=「未接」，真 0 原样显示 0；口径三句（成本账本来源、成功率无按模型源、未接定义）上屏。
- `web/src/metrics.css`：`.metBM` 布局。

## 3. 门禁原始读数

- **vitest（scoped）**：`node_modules/.bin/vitest run src/modules/metrics/metrics.bymodel.test.tsx` → `Test Files 1 passed (1)` / `Tests 12 passed (12)`。契约测试 435 行（未接/真0/est 来源不采信/空态不画空表/失败重试/loading/error 12 例）。
- **build（bundle 门）**：`cd web && node_modules/.bin/vite build` → **exit 0**，产物 `hermes_cli/web_dist/`。（`pnpm run build` 的 `tsc -b` 步有仓级旧债非零，判 typecheck 看 delta=0，遵 AGENTS 口径。）

## 4. 现网证据（双视口图 + 原始 JSON）

取证配方：worktree dist 由 v4_proxy 第二实例 `127.0.0.1:9131` 静态服务并把 `/agent-api/*` 转发现网 BFF `127.0.0.1:8092`；opsadmin cookie（access_token_cookie）注入 playwright；导航 `domcontentloaded`+显式 settle（禁 networkidle）。代理日志坐实浏览器真实发出 `GET /agent-api/api/hermes-usage?days=7` → 200（`evidence/proxy.log`，两轮）。

- 图：`evidence/q14-metrics-bymodel-1440.png`（1440×900）、`evidence/q14-metrics-bymodel-375.png`（375×812）
- DOM 文本：`evidence/q14-dom-1440.txt`、`evidence/q14-dom-375.txt`
- 原始 JSON：`evidence/q14-raw-hermes-usage-days7.json`（8092 真值）
- 工具证：`evidence/q14-shoot.mjs`（取图）、`evidence/q14-probe-path.mjs`/`q14-debug.mjs`（路由诊断）、`q14-proxy.mjs`（废弃的自写代理，留作踩坑证）

**屏上读数（1440）**：两行 qwen-plus 506,008/10,667/516,675、qwen3.8-flash 16,936/47/16,983；调用次数/会话数/成本/成功率全「未接」（现网行内确无这些字段——正是「不补假数」的实证）；占比「—」；合计行 522,944/10,714/533,658 + 未接；「成本来源 cost_ledger（账本 7 天 1.14 USD 不落模型行）」口径句上屏。

## 5. 偏离与如实记录

1. **导航用 path 形 `/metrics?window=7d`，非工单口径的 `#/metrics`**：实测 hash 形被壳 routes alias 吞到 `#/overview?tab=usage`→上游 AnalyticsPage（无 metBM）。path 形才渲染 MetricsModulePage。此为 MT-06（路由一致化）已知债的现形，非本卡改动范围。
2. **修复了取证接线（保留）**：8092 BFF 读 `~/.seakoi/hermes-dashboard.token` 转发 9119 dashboard；文件内是 11-15 残留旧 token → `sources.dashboard_usage=degraded(auth)`、`by_model=null`（假象）。用 9119 现行注入 token 刷新该文件后三源全 ok。未改任何代码。
3. **占比列缺值显示「—」而非「未接」**：占比是派生值（成本全缺则无分母），区别于「现网无数据源」的字段级未接；测试与代码注释均记录该口径。
4. **24h 窗 by_model 无行为真实现状**（现网近 1 天无用量记录），空态截图另存过 `q14-debug.png`（旧代诊断件，不入终证）。

## 6. 回执

见 task/Q14-metrics-bymodel push 后 tip；禁 force，push 为新建分支。
