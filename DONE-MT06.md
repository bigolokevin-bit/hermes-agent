# DONE-MT06 · /metrics 路由登记一致化（B 形态）+ 文档回写

日期：2026-11-24（跨日）｜车道：task/MT-06-route-consistency｜基线：origin/lane/hermes-console @ 4f4d1604f1
授权：参谋决断令（@433@）——30 分钟内落一笔可合提交；B 形态=现状 compat 的登记一致化，零行为改动；A1/A2 加可见面仍候老板裁定（决策块两轮未回）。

## 根因（实测）
`routes.ts` L268 `#/metrics` compat 行的 `to:'#/overview?tab=usage'` 实际被 `shell/bridge.ts` L85-91 硬编码特例绕过：`resolveHashTarget('#/metrics') → /analytics`（App 上游 AnalyticsPage）。同族 `#/sessions` 亦如此（bridge.test.ts L29-30 已钉「App paths authoritative on compat-module conflicts」）⇒ **桥先于表是 compat-module 规律，to 字段对这两行是登记装饰**。三处说法（routes to / bridge 特例 / resolve-page-title「运行分析」+页内 h1）曾互斥。

## 改动（两文件，零行为改动）
1. `web/src/shell/routes.ts` L268 行：kind/visible/hash/path/label/to 全保留；dataSource 由「随目标」改为终态陈述（App 直挂 MetricsModulePage，path '/metrics' 由 App 路由服务，页内 h1「运行分析」；hash '#/metrics' 由 bridge 特例解析到 /analytics，App path 权威，同 '#/sessions' 规律）；conflict 改 2026-11-23 登记陈述（B 形态，A1/A2 属 owner decision）；行上 5 行中文注释交代桥/表关系。
2. `web/src/shell/routeContract.test.ts`：新增 describe「MT-06 /metrics registration: routes, bridge, and page title tell one story」2 例——①hash 落点在桥钉处（kind/visible/to 登记形式/resolveHashTarget→/analytics）；②path·标题·登记三方一致（dataSource 非「随目标」且含「App 直挂」、conflict 含 2026-11-23、resolvePageTitle('/metrics')==「运行分析」与 MetricsModulePage.tsx L2005 h1 对齐）。

## 文档腿（l0-board 磁盘，未 commit，归 L0 收）
- `docs/product/design/console-v2/deep/05-metrics.md` 新增「## 9. 车道终态回写（2026-11-23 回写…）」章节，grep「2026-11-23 回写」=1 ✓（DoD③满足）。
- `apps/console/BFF-ROUTE-MATRIX.md` /api/models/pricing not_wired 注记行 **已存在**（L50+缺口#9，前批提交）⇒ 本卡改动④无需动笔。

## GAP 终态清单（五卡）
标价未接 a1cf989263 · byProvider 未接 ab6b9cf24a · P50 未接 0a86b622eb · 钻取诚实线 fafe197f42 · 24h 整日账句+扇出闸门 182c4d3dc6。

## 门读数（原始）
- `vitest run src/shell/routeContract.test.ts src/shell/bridge.test.ts` → **Test Files 2 passed / Tests 23 passed**（基线 13+bridge 8+新 2）VITEST=0
- `node scripts/assert-ia.mjs` → ok:true, headHash 4f4d1604f1, exitCode 0；计数 routes 51/tabs 22/tabsAll 23/chatHosts 1/modules 8 **零改动**
- `tsc --noEmit` → TSC=0，error TS 计数 0
- `vite build` → BUILD=0

## 偏离与遗留
- 参谋令写「routes.ts 登记+断言」：断言放 routeContract.test.ts（非新建件），与文件既有 n 系列 describe 族一致。
- 行为未动：`#/metrics` hash 仍落 /analytics（上游页）、path `/metrics` 仍直挂自研模块。若老板选 A2（换 serve）或 A1（第 23 tab），本笔注释/conflict 文案与两例断言需随改——断言即哨兵。
- MT-04 tsc 全型面红（metrics.drill.honesty.test.tsx L266 TS2322）为另一义务，随后单修。
