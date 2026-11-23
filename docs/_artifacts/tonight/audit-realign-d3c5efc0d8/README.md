# audit-sort-p1 现网换代腿 · 9122 重建与 H2 五件逐值（face d3c5efc0d8）

- 脸号：`d3c5efc0d81768db22fb5319245088962d5210f4` — 当拍定向 `git ls-remote origin refs/heads/lane/hermes-console` 落文件现取（/tmp/d-w183-face2.txt），主树 HEADV 逐位一致；本地为 ff 已达（Already up to date，无抢面）。
- 端口/落点：`:9122` = launchd cn.seakoi.v4-serve 静态逐请求 docroot = 主树 `hermes_cli/web_dist`；重建 = 主树 `cd web && node_modules/.bin/vite build`（outDir 实证 vite.config.ts:123 `../hermes_cli/web_dist`）→ **BUILD_RC=0** @2026-11-23 08:21:44+0800（日志尾仅 rolldown tailwind 计时提示，非错误）。
- 读数口径自报：端口 9122 ／ entry `index-CjZDGcv-.js`。

## H2 五件现网逐值（我现算 vs UI-KD 车道基准）

| # | 件 | 我现算（08:21 重建） | UI-KD 基准（08:11 读数） | 判定 |
|---|---|---|---|---|
| 1 | entry | `assets/index-CjZDGcv-.js` 173255B sha256 `8f36bdbef4f5aabe7ab90c639231b40b08d45ddcc443f3fbffb106a3c2eda69b` | 同名同字节同 sha256（mtime 08:11:03） | **逐位一致**；mtime 为本次重建换代 |
| 2 | 换代判据 chunk | `assets/AuditEventsModulePage-f45_9etX.js` 62353B sha256 `4b03fe2f1d859c7dd58d70b19d8d447e64dc91331231435d87088a28d21e7def` | 名 `f45_9etX`，sha256 前缀 `4b03fe2f1d859c7d`，命中 1 chunk | **一致**（全值补全如上） |
| 3 | 主 CSS | `assets/index-fdJubSit.css` 149013B sha256 `5f1f544cc315e325df90dc2d499d0f350d556d74c9e89d20bc1c3f2ea1947e9e` | 基准未列 | 备查登记 |
| 4 | index.html | 1084B mtime 08:21；HTML 内资源引用 9 项含 entry/css 与 api/ui/vendor/react-vendor/i18n/utils 等 chunk | — | 引用与盘上名一致 |
| 5 | served==disk | `curl http://127.0.0.1:9122/assets/index-CjZDGcv-.js` 173255B sha256 与盘上逐位等；`/assets/AuditEventsModulePage-f45_9etX.js` sha256 与盘上逐位等（走 `/assets/`，非 `/agent-v2/assets` SPA 回退面） | — | **served==disk 亲验** |

- 备注：本次构建 face=d3c5efc0d8 **不含** lane/console-aud 上的 duty 笔 `a8b657f399`（duty 复拍腿仍待并窗后另拍）；audit 代码与 UI-KD 代码腿（04741e44d0 行级 scope 自证+钉测）同源脸，故 chunk 换代判据相符。
- 纪律：纯 docs 台账 src=0；不引幻影 sha；读数带端口+entry；本腿只读不改服务配置。
