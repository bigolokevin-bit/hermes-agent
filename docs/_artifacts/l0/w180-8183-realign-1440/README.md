# w180 — 8183 假通道登录态视觉复拍收尾（shot-8183-realign，参谋 06:05① 最后一条腿）

- **面（face）**：`0f94f5cf204ee85312ad604743a70ca8f6da5bc5`（截帧当拍 `git ls-remote origin refs/heads/lane/hermes-console` 定向现取落文件，逐位写入 readings.json）
- **时刻**：2026-11-23 07:14:51–07:15:00 (+0800)
- **端口/落点**：`8183` = tailscale IP `100.117.184.117`（Caddy 反代→127.0.0.1:9122 静态 docroot）；URL `http://100.117.184.117:8183/agent-v2/#/overview`。探针必走 tailscale IP——127.0.0.1 打 8183 得 000 是落点错，非通道故障。
- **现役 entry（实测自 DOM）**：`/assets/index-Cv4DBs--.js`

## 登录腿与纪律

- token = L0 假通道 E2E 留存 jar（`e2e-8183-jar-keep.txt`）。注入前 curl 级亲验：`8183/auth/whoami` → **200** @07:14:08+0800，body `{"user_id":3,"granted":false,"display":"Kevin"}`。**本腿只读**：未再开 fake env、未碰 plist、未代登、未请用户点登录；open_id/token 值零回显零入 git。
- storageState：`name=access_token_cookie`，`domain=100.117.184.117`（按访问目标改写——打 8183 用 tailscale IP 域），`path=/`。

## whoami 紧贴断言（截帧前浏览器内 fetch===200）

- 1440 档：**200** @2026-11-22T23:14:56.173Z（07:14:56+0800）
- 375 档：**200** @2026-11-22T23:15:00.820Z（07:15:00+0800）

## shotMode=fullPage（视口加高破内部滚动壳）

- 1440：壳 scrollHeight=1121（`DIV.relative.z-2...flex-1`）→ viewport 1440x1161 真全页 → PNG `1440x1161` 189158B
- 375：壳 scrollHeight=2336 → viewport 375x2376 真全页 → PNG `375x2376` 170602B
- 尺寸经 `file` 核验；两 PNG 实物随本笔入仓（git blob 物理字节）。

## 资源面口径（granted:false 预期非故障）

- 每档 res4xx = **10，全 403**（console.forbidden 业务端点面，授权边界预期非故障）；逐条完整 URL（含 query）见 readings.json `res4xxFullUrls`。
- jsErrors = **0**（两档）；consoleErrors = 10（即同一 403 资源错误族，无新增 JS 异常）。
- 对照 w179 基线判词：业务 10 条同族同数、whoami 探测腿 200 ⇒ 零新增面成立；既有面如实另列，不冒充清零。

## 与 w179 目录关系（实物核验记录）

本笔开工前已用定向 ls-remote+`git ls-tree`/`git cat-file -s` 在 face `0f94f5cf20` 亲验：`w179-8183-fake-1440/` 五件**实物在脸字节逐位一致**（1440.png 188939B、375.png 170896B、readings.json 2551B、README 4495B、readings-fold-pass1.json 4931B，PNG 幻数 `\x89PNG` 有效）——「PNG 实物已丢」系 fixer 半成品工作区读数，非脸面事实。本 w180 目录为**新面（0f94f5cf20）当拍复拍**收尾腿，按派单新开目录不沿用工作区文件。

## 纪律声明

纯 docs 笔（src=0）；playwright 用 wave-172 既有形制（sibling createRequire + chromium-1255 exec），无 `require.resolve` miss 绕行；不自签全绿，375 总 PASS 放行权归 UX 总审；读数自报端口+entry；幻影 sha 不引。
