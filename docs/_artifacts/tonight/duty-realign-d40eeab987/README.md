# w185 · duty 台账腿（face d40eeab987 · 现网换代 + 同脸复拍 + NaN/裸id 判据串）

- 脸号：`d40eeab98797a5021f7ac096af1e3b2c76dc4243`（当拍定向 ls-remote /tmp/d-w185-lsr.txt @09:07:52+08，主树 HEAD 逐位一致；含 duty 代码腿 a8b657f399 与 audit 换代腿 c124267df0）
- 重建：主树 `cd web && node_modules/.bin/vite build` **BUILD_RC=0 @09:08:37+08**；outDir=../hermes_cli/web_dist（:9122 静态逐请求 docroot）；8183 = Caddy bind 100.117.184.117 反代 127.0.0.1:9122
- H2 五件现算（端口 9122 / entry index-CCMhKt2U.js）：

| 件 | 值 | 对比基准（d3c5efc0d8 代） |
|---|---|---|
| entry | assets/index-CCMhKt2U.js 173255B sha256 587837bbf567848c…（全值见 readings 注） | 换代（duty src 生效；字节数同 173255） |
| CSS | assets/index-fdJubSit.css 149013B sha256 5f1f544cc315e325… | 逐位不变 |
| audit chunk | assets/AuditEventsModulePage-gdIAO_2Y.js 62353B sha256 69b96b27dda54ec3… | 更名换代（判词见下） |
| duty chunk | assets/DutyPage-CmxVUAMP.js 62392B sha256 0cfd991efdff2537… | 新（duty 代码腿生效）；duty 短码形制住 api-CNfJ_OUY.js（grep 后6位 命中） |
| index.html | 引用 index-CCMhKt2U.js | 换代一致 |

- served==disk：`curl :9122/assets/<file>` 与盘上 sha256 前16 逐位一致 ×4（entry/audit/duty/CSS 全 YES）
- audit chunk 更名判词：`git diff d3c5efc0d8 d40eeab987 -- web/src/modules/audit` 为空（审计源码零变动），chunk 字节数不变（62353B）、导入件名全未变——更名=全局模块图重编号（duty 变更引发），非审计代码变动
- 复拍（同脸真 fullPage，视口加高破内部滚动壳）：1440x1161（壳 probe 1121）duty-8183-1440.png 188953B；375x2376（壳 probe 2336）duty-8183-375.png 170352B；shotMode=fullPage，DOM entry 两档实测 /assets/index-CCMhKt2U.js（换代生效上屏实证）
- whoami 两行：jar curl 级先验 **200 @09:07:52+08**（granted:false 如实）；浏览器内紧贴截帧断言 **200 @09:12:50.752+08（1440）/ 200 @09:12:55.507+08（375）**
- NaN/裸id 判据串：NaN 上屏=0；oc_/ou_ ≥14 位上屏（innerText）=0，两档一致；attr/link 出现=0、outerHTML 出现=0（duty 视图当前无任何裸 id 落点）；真实用户 id 值一律未入档
- console 面：jsErrors 0；res4xx=10/档 全 403（granted:false 授权边界=预期非故障），端点与 w180 基线同族同数（业务 10 条），零新增面；consoleErrors=10/档 全为同一 403 资源错误
- token 来源：L0 假通道 E2E 留存 jar（keep-jar，只读使用；本腿未开 fake env、未碰 plist、未代登）；cookie 域=100.117.184.117 按访问目标原样注入
- 纪律：纯 docs src=0；不自签全绿；375 总 PASS 放行权归 UX 总审；全量 vitest 归 L0 亲跑（491 files/3630 tests 绿为 L0 读数）；幻影 sha 不引（1d42619247/9350512648 不在脸 cat-file 亲验）。
