# w191 FleetRail 真数据腿（现网实拍，无桩）

催办单（12:48）要件结案：FleetRail 真数据腿。结论＝**不是数据面缺**——现网 `/agent-api/api/employees` 200，真实 3 名员工直接渲染进舰队轨，本目录两 PNG 为现网实拍。

## 脸与部署面（当拍现取）
- face（定向 ls-remote lane/hermes-console @12:54 落文件）= `cdeea11257391084188aaf853ff6be8d94f7da4a`；我链 a98d657788（h1 降格）/7b4c44ba03（375 轨修）/beb1cfe6a5（w190 台账）三重 `merge-base --is-ancestor` RC=0 全在脸内。
- 端口 8183（Caddy→127.0.0.1:9122 静态 docroot=主树 hermes_cli/web_dist）。部署 entry=`/assets/index-BLhDxkaC.js`（dist @12:01 换代；grep 判据 duty-title-name=1、duty-fleet=1、flex-shrink:0=1 ⇒ 部署脸已含我全部三笔）。

## whoami 紧贴断言（浏览器内 fetch，每帧前）
- 1440 腿：pre 200 @2026-11-23T04:55:54.380Z / tight 200 @04:56:10.986Z
- 375 腿：pre 200 @04:56:13.341Z / tight 200 @04:56:14.130Z
- 先验：keep-jar curl 级 whoami 200 + employees 200 @12:54（granted:false 如实）。未代登、未碰 plist、未请用户点登录。

## 读数（readings.json 逐位同档）
| 项 | 1440x1411 | 375x2551 |
|---|---|---|
| 舰队卡数（真实员工） | 3 | 3 |
| 卡 rect | 320×176 ×3（高差 0） | 260×160 ×3（高差 0） |
| 1280 档（同腿复测） | 288×168 | — |
| metrics「今日处理/成功率」 | 「—」（I4 未知态） | 「—」 |
| role=progressbar | 0 | 0 |
| 全页 h1 | 1（仅 TopBar「运营总览」） | 1 |
| 滑轨 trackW | 976（无溢出） | 324（规范值） |
| 轮播 | 无溢出⇒不启动（t0=0/t6500=0 守规不动） | n/a |
| jsErrors/consoleErrors | 0/0 | 0/0 |
| res4xx | **0**（403 业务面本轮整体缺席，如实漂移，不套同数判词） | 0 |
| 375 逐元素横溢 | n/a | violations=0 |

## 判词与口径
- **数据面**：员工名册真实可得；缺的仍是**逐人日聚合端点**（处理数/成功率⇒「—」，进度条不画，依 v2 §6④/§8/I4）。该欠项此前已报，本案重申。
- **1.1–1.3 可见比条款适用条件**：v2 以「溢出且 >2 张」为轮播/可见比前提。真实队列 3 张≤轨宽⇒无溢出⇒条款不适用；375 读数 ratio=0.4 如实落账不裁红。溢出形态的 324 轨宽、轮播 6s/暂停/箭头/键盘与 ratio=1.215 证据在 w190 fixture 腿（docs/_artifacts/tonight/fleet-rail-87873845ed/，桩数据已披露）。
- **真名纪律**：readings.json 不落员工姓名与任何 id（grep emp_/oc_/ou_ =0）；真名仅存在于 PNG 像素（现网实拍允许）。
- 截图形制：视口加高破内部滚动壳（heightened-viewport），禁 networkidle，domcontentloaded+settle 1.8s；本机根字号 15px，几何一律 px。
- 修 w190 读数守卫 bug：visibleRatio 判空用 fleetCards 数值并按滑轨边界计算（w190 版 `.length` 恒 null）。
- UI-GATE 判据需求与七条断言清单承 w190 README，不变。

## 纪律行
写域仅 docs/_artifacts/tonight/**（纯 docs，src=0）；未动 :9122 docroot 与主树；未触 shell/tokens/scripts/knowledge/audit；不自签全绿；375 总 PASS 归 UX 总审；幻影 sha 不引。
