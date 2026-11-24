# DONE-MT06 — /metrics 路由登记一致化（B 形态）+ 三方断言

- 车道：hermes-console（session ses_df7932bd1ffePEwuIsxLeGSkWe）
- 分支：task/MT-06-route-consistency ｜ 基线：4f4d1604f1（origin/lane/hermes-console 现取）
- 登记：l0-board task-lanes.json MT-06（write_scope web/src/shell/,web/scripts/,website/）
- 日期：2026-11-24

## 卡与裁定
backlog MT-06（docs/product/backlogs/metrics-detail.md）。参谋点名的路由身份
三选项中，老板决策块（A1 新增第 23 可见 tab / A2 换 serve / B 维持 compat）
**尚未回复**；参谋 11-24 决断令要求本轮落一笔可合提交且不得越权改可见面。
B 形态=对现状 compat 的**登记一致化**（零行为、零可见面改动），非加面口味
裁定，故本轮执行 B；A1/A2 加面仍候老板拍板（决策块在案）。

## 根因（MT-06 卡「第三说法」真身）
`shell/bridge.ts` L88-91 有硬编码特例：hash `#/metrics` 解析到
pathname `/analytics`（注释 "The existing AnalyticsPage IS the usage
surface"），routes.ts L268 compat 行的 `to:'#/overview?tab=usage'` 实际被
绕过——且 `bridge.test.ts` 早已钉住该行为（'keeps existing App paths
authoritative on compat-module conflicts'：target('#/metrics')==='/analytics'，
'#/sessions' 同理）。即 compat-module 规律=**桥先于表、App path 权威、to 字段
是登记装饰**。⇒ 改 to 有行为风险；正解=不动 to/bridge，把行的
dataSource/conflict 改成终态陈述，并用断言把三方说法钉成一致。

## 改动（2 files，零行为）
1. `web/src/shell/routes.ts` L268 行：label/path/module/tabId/kind/visible/
   hash/to 全保留；dataSource 由「随目标」改为终态陈述（App 直挂
   MetricsModulePage；hash 由 bridge 特例落 /analytics，同 '#/sessions'
   规律）；conflict 改为 "registered 2026-11-23 (backlog MT-06, option B)…"
   并留 A1/A2 老板另批字样；加 MT-06 回写中文注释。
2. `web/src/shell/routeContract.test.ts` 末尾新增 describe
   "MT-06 /metrics registration: routes, bridge, and page title tell one
   story" 两例：
   - 钉 row.kind/visible/to（登记形式保留）+ resolveHashTarget('#/metrics')
     .pathname==='/analytics'（行为=桥；桥先于表是规律非例外）。
   - 钉 dataSource 含「App 直挂」、conflict 含 2026-11-23、
     resolvePageTitle('/metrics', {} as Translations, [])==='运行分析'
     （与页内 h1 对齐；第三说法其实早已一致，本断言防回退）。

## 门读数（原始）
- `node_modules/.bin/vitest run src/shell/routeContract.test.ts src/shell/bridge.test.ts`
  → Test Files 2 passed (2) / Tests 23 passed (23)（基线 13+8+新 2）
- `node web/scripts/assert-ia.mjs` → exit 0；routes 51 / tabs 22 / tabsAll 23 /
  chatHosts 1 / modules 8，**零改动**（headHash 基线 4f4d1604f1）
- `node_modules/.bin/tsc --noEmit -p .` → error TS 计数 0（全型面干净，
  含 pump/fixer 教训后自跑；vitest src/shell 全目录 14 files 119/120，唯一红
  =e1Contract 9122 活部署环境红，按判例判环境不判 diff，非本笔改动）
- `node_modules/.bin/vite build` → exit 0（log /tmp/mt06-build.log）

## 文档腿（无需本道动笔，磁盘在案）
- l0-board `docs/product/design/console-v2/deep/05-metrics.md` §9
  「车道终态回写（2026-11-23 回写）」= GAP 终态六行表 + 路由状态待裁定段
  （MT-06 DoD③ `grep 2026-11-23 回写`≥1 已满足）。
- l0-board `apps/console/BFF-ROUTE-MATRIX.md` L50 + 缺口#9 已含
  /api/models/pricing not_wired 注记（他人已提交，本道不重复动笔）。

## 偏离与声明
- 断言并入既有 routeContract.test.ts 而非新建文件（卡验证命令点名该件，
  共置更贴；无其它偏离）。
- 若老板后续选 A1/A2，本笔两例断言需随改（尤其 pathname==='/analytics'
  与 visible:false）——断言即哨兵，改面必触发红，不会静默漂移。
- MT-04 并线 tsc 红（drill 测试 L266 泛型）已由 L0 授权代修并入：
  f97d9bd052（type-only 一行），merge 2674ec56f9 在 lane；本道对该卡
  无未尽义务。

## 五卡 GAP 终态账（回写素材，已在 deep §9）
标价未接 MT-01 a1cf989263 ｜ byProvider 未接 MT-02 ab6b9cf24a ｜
P50 未接 MT-03 0a86b622eb ｜ 钻取诚实 MT-04 fafe197f42（已并 2674ec56f9）｜
24h 整日账句+扇出闸门 MT-05 182c4d3dc6（已并 51fb4021ff）｜ Q14 dc96d5af66。
