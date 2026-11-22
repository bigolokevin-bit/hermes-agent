# 401 三闸 · 新脸复跑读数（face 4a3363a951）

- 取证对象：集成分支 lane/hermes-console tip `4a3363a951`（00673d10fd 的并入面，`git diff 00673d10fd 4a3363a951 -- web/src/lib` 为空，代码字节等价）。
- 构建：`cd web && vite build` exit 0，产物入口 `assets/index-CCLAG-mZ.js`。
- 夹具：本地 stub 服务 127.0.0.1:9124（禁现网）：`/agent-api/*`、`/api/*` 返回门控 401 信封 `{error:'unauthenticated', login_url:'/login?next=…'}`，`/auth/whoami` 401，其余静态 + SPA 回退。驱动：Playwright 真实等待（domcontentloaded + 15s 窗口计数）。
- 闩态说明：Phase A 为闩未预置的自然态（跳转一次后闩生效）；Phase B 在 375 档用 sessionStorage 预置 `hermes.loginRedirectAttempted=1` 使页面停留可读数（不再跳走），与生产「已跳过一次登录」态一致。

## 风暴计数（15s 窗口，vs 点单基线）

| 路由 | framenavigated | http401 | respTotal | 基线 |
|---|---|---|---|---|
| #/sessions | 5 | 29 | 56 | navs 2488 / 401 1308 / req 79453（≈5300/s） |
| #/capabilities?tab=channels | 5 | 28 | 53 | 同上 |

计数有界、不随时间线性增长 ⇒ 环消除判据达成。

## 375 逐元素读数（判据 right≤376 且 left≥−1）

- #/sessions：counted=23，右缘越界 **0**；全部被标项为壳层离屏抽屉（left −240…−16，right ≤ −1：导航「运营总览…审计」、auth5-goto-login、主题「Hermes Teal」、EN、Nous Research），属 shell/** 隐藏抽屉既有在册类（wave-125 同款），非内容裁切、在本任务写域之外。
- #/capabilities?tab=channels：counted=25，右缘越界 **0**，被标项同上同类。
- 两路由由此脱离 NOT_MEASURED，逐元素读数已产出。

原始输出：`probe-raw.txt`；截图：`ui-b-401-sessions-1440.png` 1440×900 52KB、`ui-b-401-sessions-375.png` 375×3200 36KB（低于 40KB 惯例线，页面为登录失效错误卡+抽屉收起态，内容真实，按实报尺寸）、`ui-b-401-capabilitiestabchannels-375.png` 375×3200 56KB。

复跑命令：`node /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/ui-b-401-stub-server.mjs`（PORT=9124）+ `node …/ui-b-401-after.mjs`。
