
## R10 尾项：/audit?tab=verify 接线（fix(console): wire audit verify tab）
接线（写域 App.tsx/shell，routes.ts/registry/manifest 零写入，未新增 Tab 行）：App.tsx lazy AuditVerifyConsolePage（named AuditVerifyModulePage from modules/audit/AuditVerifyModulePage，aud 页体未改）；console Routes 块 /audit compat 后新增 /audit/verify 与 /verify Navigate to=/system?tab=verify replace（first-in-tree wins 先例 /matrix /models）。读数：定向 shell 33 passed；全量 121 files/1194 passed 0 fail；assert-ia HTML/REACT 双 exit0（51/22/1/8）；tsc web 单包 0；9122 served=旧代次（DW4fkEEp），新代次上屏需 L0 合批后 build+D 重章。

## R16 verify 深链接线（fix(console): wire audit verify tab deep link，2026-11-19）
接线：App.tsx 加 lazy AuditVerifyConsolePage（modules/audit/AuditVerifyModulePage named 适配，页体禁改仅挂）+ 模块级 AuditAwareEntry（useSearchParams：?tab=verify→AuditVerifyConsolePage，否则→AuditEventsConsolePage），/audit Route element 换 AuditAwareEntry——/audit?tab=verify 真到达校验视图，不再落 events；未触 routes.ts/manifest（react 模式 routes=51 为 ROUTE_TABLE hash 行硬计数，加行必破，故用元素级分支，先例 ParkedAwareSystem）。
collateral 一行（域外如实报）：src/modules/audit/appRouting.test.ts line21 源码锁正则更新为接受 (?:AuditEventsConsolePage|AuditAwareEntry)——该测试锁的是 R21b『直挂不改写 URL』壳行为，接线后行为意图不变，物理位在 aud 目录。
读数：assert-ia 两模式 exit 0（51/22/1/8 未破）；appRouting.test 2 passed；全量 vitest 1206 passed / 1 failed——唯一红=ApprovalsHistoryModulePage.test eight-states rowNodes 计数，定性=工作树 web/src/modules/approvals/model.ts+views.tsx 为 P1-approvals 单（已提交于 lane/console-appr 32d416e5）在本 gov 树的未提交残留（git diff 逐字含 RID_KEYS/requestId/R-P1 行 rid 列），gov 树缺同笔测试更新所致，不归 R16：不提交不还原，请 L0 合批两车道时自然消解。
probe-audit-verify.mjs 缺件声明：脚本在 l0-board（无 scripts/ 目录、git log --all 无历史）与 console-appr 均 find 零命中，无法执行原始输出；请 L0 给路径或由 QA 代跑。probe 断言面核对：GENERIC_DOM「未接入 · 该功能正在排期」全 src 零命中；ENG_PHRASE「auth status unavailable」仅存 components/AuthWidget.tsx line92 locale 缺失兜底（components 非本单写域，若有环境风险请 L0 转 aud/集成）。白名单决策=维持拒改：9122 不在 l7-ops ALLOWED_ORIGINS，放行属安全边界变更，交 L0 批。
本单未单独构建 9122（等 L0 合批 build+重章后 QA 复跑 /audit?tab=verify）。
