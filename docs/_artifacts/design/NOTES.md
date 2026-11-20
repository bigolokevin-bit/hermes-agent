# 设计车道表现层整改 — 证据台账

分支 `lane/console-design`，基线 `d7965c2a`。范围：六项表现层整改（不动 IA），每项一笔 commit。

## 截图约定

- before：取自 9122（caddy 反代，基线构建），URL 实为 `/overview`、`/knowledge`、`/system`（App.tsx `/` → RootRedirect → `/overview`）。
- after：本地 `VITE_AGENT_CONSOLE_V2=1 ./node_modules/.bin/vite build` 产物起服务后取（服务方式见下「after 采集」，待定：dist 静态服务 + API 代理沿用 9122 后端会话）。
- 命名：`{before,after}-<page>-<1440|375>.png`；1440=1440×900、375=375×812，CDP `setDeviceMetricsOverride`(dsf=1)+fullPage，`sips` 回读尺寸。
- 采集配方脚本：`$TMP/design-shot-probe.sh`、`$TMP/design-shot-leg.sh`（ego-browser nodejs，复用档案内 127.0.0.1 会话 cookie，无需 token）。
- 入册方式：before 六张随 ② 提交入册；各项 after 截图在对应项落地后的下一笔提交入册；本 NOTES 随每笔增量更新。
- 取证服务更正（2026-11-20）：本地取证服务器初版把应用真实 API 前缀 `/agent-api/*` 误吞为 SPA 回退 HTML，导致经其采集的页面业务数据均呈错误态；已修复（业务请求代理 9122、auth 前缀放行、FORCE_401 演示腿端口 9124）。受影响在册证据：**after-c2 六张（随 ③ 入册）业务数据部分为错误态截图**，不回改历史，以本行为账；after-c3 六张与 after-c1 两张以修复后服务重拍随 ① 入册；收尾终版 after 六张以修复后服务重取。

## 进度

| 项 | 内容 | commit | 证据 |
|---|---|---|---|
| C6 ⑥ | 产品标题与 favicon（`index.html` title/lang + `public/favicon.svg`） | `6ebc5e05` feat(console): product title and favicon | 构建 exit 0 |
| C1 ② | 自绘下拉（15 处 select，`shell/ConsoleSelect`，testid 原样透传）+ 按钮三级 primary/secondary/ghost（`shell/ConsoleButton`）+ 全站字距（根因：库 Button 基础类 `tracking-[0.2em]` 叠加 CJK；「重 试」「刷 新」空隙） | `fcfd3a14` | before 六张随本笔入册。坑与更正：原 `html:lang(zh-CN)` 作用域实测永不命中——运行时 `document.documentElement.lang="en"`（i18n 按 UI locale 改写，控制台中文与 locale 无关）→ ③ 笔改全站归零，英文按钮 display 字距一并归零（符合简报「全站字距」原话） |
| C2 ③ | 删顶栏英文模块名 → 统一中文面包屑：壳层路径不再渲染全局英文 h1（`PageHeaderProvider` + `isConsoleShellPath`），非壳层标题走 i18n nav 键+五条残存中文；redirect-only 源保留 h1 防原生页丢标题 | `676384b6` | after-c2 六张随本笔入册（如实呈现 ② 原状）；after-c3 六张随 ① 笔入册：壳层页全局英文 h1 已消失（页面 h1=2 均为中文模块/pane 标题，属预期）、中文面包屑≥2 段、库 Button letterSpacing=normal、中文带字距按钮=0、375 无横向溢出；combobox 口径：默认 system 页=0，`/system?tab=events`=3。声明：实拍时 9122 会话已过期，after-c3 画面含未登录侧栏与过期横幅（expiredAlerts=1）——③ 各指标与数据态无关不受影响；收尾终版 after 六张须先恢复登录再拍真实数据态 |
| C3 ① | 全局「会话已过期」横幅（`lib/session-expiry` 模块级 store + `shell/SessionExpiredBanner`，挂 PageHeaderProvider `</header>` 后；同状态只一条、role=alert+aria-live=assertive+tabIndex=-1 首现聚焦）替换 401 专属卡：Approvals/Runs/Employees 三页 401 回落通用错误+rid+重试；**第五套** MatrixModulePage 同屏双播违「只出现一次」，同模式收口（`auth-reload-exit` 全仓退役，mtx5-error-retry 与「重试」原样保留）。LoginPage 卡**保留**：登录流程上下文内提示，非「过期后状态」（假定）。语义=episode：同轮幂等、业务 2xx 结案、下轮 401 重现（防 5s 轮询弹回）；`/auth/*` 豁免不置位 | 本笔 | after-c1-expired 两张（9124 强制 401 取证腿）实拍五项全过：含「会话已过期」role=alert=1 且 `session-expired-banner` 在场、`auth-reload-exit`=0、重试=1、`session-expired-relogin` 在场、横幅句「会话已过期，请重新登录后继续。」逐字一致（1440 不折行、375 无孤字换行）+ banner 组件测试 8 条 + 各页测试改写；后续项：`modules/health|version|tasks` 的 STATUS_COPY[401] 句本车道不动（NOTES 在案） |
| C4 ④ | 空/错态骨架与占位，375 不许一屏一句：新增 `shell/StatePlaceholder`（零 UI-import、aria-hidden、无文字/testid/aria-busy、百分比宽阶梯、currentColor+color-mix 配色适配深浅面板；故意不用 `.animate-pulse` 类——那是本仓「仍在加载」的机器信号，~20 个 settle helper 等它消失，空态挂上必撞 ApprovalsPage.test:35/:148、RunsPage.test:37/:146、approvals.caliber.test:101，动画改用同一 pulse keyframes 内联施加）；壳层 StateBlock 四态+AuditorDeniedBlock 文案下补占位；ApprovalsPage/RunsPage EmptyPanel、EmployeesPage EmptyBlock（共享件，chat/employee-detail 一并收口）刷新按钮下补占位；knowledge 空/错态复用本面 `knw5-skeleton`+一条作用域 CSS。红线锚表（state-empty 文案/testid）一字未动，39 行纯新增 0 删除 | 本笔 | build exit 0、vitest 193 文件/2537 测试（基线+1/+2）、tsc 86=基线、assert-ia 51/22/8/1、eslint 0 error、StatePlaceholder 新测试 2 条。后续项（本车道不做，记账）：①5×RowSkeleton 合并否决——DOM 同构但 apr5-loading 有「恰好 4 个 .animate-pulse」断言且跨 shell/modules 写域，应独立收口；②暗色 `bg-white/5` 骨架在浅色主题隐形（version:153/settings:129/security:181/people:322/employees:835/employee-detail:385/Auth5Session:58），建议统一改语义 token，`StatePlaceholder` 可作样板 |
| C5 ⑤ | 内部话术清理：「接口不可达/数字不作零处理」TasksBoardModulePage:646、RunsModulePage:1367、CollabDelegationsModulePage:484，技术信息折叠进「详情」；注意 TasksBoardModulePage.test.tsx:210 整句断言需同步 | 待做 | |

## before 清单（2026-11-20 采集，9122 基线）

- before-overview-1440.png / before-overview-375.png（158KB/59KB）
- before-knowledge-1440.png / before-knowledge-375.png（134KB/53KB）
- before-system-1440.png / before-system-375.png（119KB/59KB）
- DOM 回读：三页 heading 为英文 Overview/Knowledge/System；375 腿 scrollW=innerW=375 无横向溢出；正文 1041–1950 字符。

## 不变量核查锚点

- `shell/routes.ts`：CONSOLE_TABS=22、ROUTE_TABLE=51（:553 assert）——每笔提交后计数不变。
- 既有 data-testid 不改名；禁新增依赖；不碰 App.tsx 路由注册表与 modules/** 业务逻辑。
