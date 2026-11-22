# w179 — 8183 真实路径登录腿截图取证（1440 / 375 真 fullPage）

- **取证时刻**：2026-11-23 06:16–06:20 (+0800)
- **面（face）**：`8af8ac5f124c59ba02e2b72de0f6a9132b314861`（当拍 `git ls-remote origin refs/heads/lane/hermes-console` 定向现取，落文件回读；本地 HEAD 同值）
- **端口**：`8183`（Caddy bind `100.117.184.117` 全量 `reverse_proxy → 127.0.0.1:9122`；`:9122` = launchd v4_proxy 静态 per-request docroot，指主树 `hermes_cli/web_dist`）
- **现役 entry（实测自页面 DOM）**：`/assets/index-Cv4DBs--.js`
- **URL**：`http://100.117.184.117:8183/agent-v2/#/overview`

## 登录腿来源与纪律

- token 来源 = 参谋（L0）假通道 E2E 跑通后留存的 cookie jar（`e2e-8183-jar-keep.txt`），注入前 curl 级亲验 `whoami=200`。**本腿只读**：未代登、未碰 LaunchAgents plist、未开 fake env（fake_env=0 已由 L0 撤净恢复，pid 42993@06:08:52 跑 7695554b）、未请用户点登录。
- storageState 注入：`name=access_token_cookie`，`domain=100.117.184.117`，`path=/` ——直连 8183 域原生匹配，无 wave-172 域不匹配静默未登录伪像风险。

## whoami 两行（紧贴断言）

1. **curl 级先验（注入前）**：带 jar token 探测 `8183/auth/whoami` → 200、`8183/agent-v2/auth/whoami` → 200、`127.0.0.1:9122/auth/whoami` → 200；body `{"user_id":3,"granted":false,"display":"Kevin"}` @06:16:19+0800。
2. **浏览器内紧贴断言（每次截帧前执行 `fetch('/auth/whoami').then(r=>r.status)===200`）**：
   - pass1（900/812 折线档）：200 @06:17:21.166 (1440)、200 @06:17:22.801 (375)
   - **final（破壳真全页档，本 dir 两张 PNG 即此档）**：200 @06:19:42.863 (1440)、200 @06:19:47.538 (375)

## fullPage 诚实记录（两档）

- **pass1**：1440x900 / 375x812 `fullPage:true` ——两帧均止于 900/812 折线，根因=内部滚动壳（`div.relative.z-2.flex.min-h-0.flex-1` scrollHeight 1121 / 2336 > viewport），非页面真高。留档 `readings-fold-pass1.json`。
- **final**：改用视口加高取图法（assert-375 同族配方）——先量壳 scrollHeight，再以 1440x**1161** / 375x**2376** 截 `fullPage:true`，破壳得真全页。成品尺寸经 `file` 核验：`1440x1161` / `375x2376`。

## 资源面判词（对照既有 401 业务端点面基线）

- 基线口径（residual401Source156 / duty-filter wave README）：前脸每档 res4xx = **11**（10 条鉴权外业务端点 + 1 条页内 whoami 探测 401 通道差异）。
- 本次每档 res4xx = **10，全 403**：`employees`、`workbench/queue`、`runs?window=today/7d&status=failed`×3、`run-activity`、`tasks?status=blocked`、`workbench/summary`、`employee-stats`、`workbench/timeseries` —— 业务 **10 条逐条同族同数**。
- 两点变化如实：**whoami 探测腿 401→200**（登录腿生效直接证据）；**业务面 401→403**（`granted:false` 授权边界——认证通、授权否，族不变）。⇒ **零新增面成立**；既有面如实另列，不冒充清零。
- jsErrors = **0**（两档四次截帧全计数）；console error 计数与 403 资源错误同源，无新增 JS 异常族。

## observer 视觉判词（ses_dfaa9b64effeaICJzsnzdNbJ4L，pass1 帧）

登录壳为真：1440 侧栏 15 项导航+运营总览 active+「Kevin/角色：—/租户：—/退出登录」，无登录表单；375 移动壳（☰菜单）健在，身份项在收起抽屉内。数据块全部「这一块没有读取成功」+请求编号+重试（403 诚实错误形制），三条「待核实」strip（发布/出站/账本），业务数字零上屏，屏上无 403/无权限字样，两档布局无重叠/溢出/裁切。final 帧同壳同形制，仅高度破壳。

## 文件清单（sha256）

| 文件 | 字节 | sha256 |
|---|---|---|
| overview-8183-1440.png | 188939 | `bf323524609dc2b01e44763377f2282b619c506c85b7db708a40044c3d6cb3d1` |
| overview-8183-375.png | 170896 | `9b7b7dfceb01a26c9cfb4851861ca6fc3ee617213d9fcfbe4a3a202484852941` |
| readings.json（final 档） | 2551 | `5b602260c8002f465f6a695ff5a4c4c9b674faff5cfc10b7fd44861666bb8f2f` |
| readings-fold-pass1.json | 4931 | `8b28a260187f1bd893bec051fd19d663c8f8921574316c7bbbc6844df9319082` |

## 纪律声明

纯 docs 笔（src=0）；不自签全绿，375 总 PASS 放行权归 UX 总审；读数自报端口+entry；禁造数值；幻影 sha（c07e1f7552 / D69mY8iN / PID47164-as-ran 等既列名单）一律不引。
