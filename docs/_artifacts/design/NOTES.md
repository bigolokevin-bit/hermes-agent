# 设计车道表现层整改 — 证据台账

分支 `lane/console-design`，基线 `d7965c2a`。范围：六项表现层整改（不动 IA），每项一笔 commit。

## 截图约定

- before：取自 9122（caddy 反代，基线构建），URL 实为 `/overview`、`/knowledge`、`/system`（App.tsx `/` → RootRedirect → `/overview`）。
- after：本地 `VITE_AGENT_CONSOLE_V2=1 ./node_modules/.bin/vite build` 产物起服务后取（服务方式见下「after 采集」，待定：dist 静态服务 + API 代理沿用 9122 后端会话）。
- 命名：`{before,after}-<page>-<1440|375>.png`；1440=1440×900、375=375×812，CDP `setDeviceMetricsOverride`(dsf=1)+fullPage，`sips` 回读尺寸。
- 采集配方脚本：`$TMP/design-shot-probe.sh`、`$TMP/design-shot-leg.sh`（ego-browser nodejs，复用档案内 127.0.0.1 会话 cookie，无需 token）。
- 入册方式：before 六张随 ② 提交入册；各项 after 截图在对应项落地后的下一笔提交入册；本 NOTES 随每笔增量更新。

## 进度

| 项 | 内容 | commit | 证据 |
|---|---|---|---|
| C6 ⑥ | 产品标题与 favicon（`index.html` title/lang + `public/favicon.svg`） | `6ebc5e05` feat(console): product title and favicon | 构建 exit 0 |
| C1 ② | 自绘下拉（15 处 select）+ 按钮三级 primary/secondary/ghost + 全站字距（根因：库 Button 基础类 `tracking-[0.2em]` 叠加 CJK；「重 试」「刷 新」空隙） | 进行中 | before 六张已拍 |
| C2 ③ | 删顶栏英文模块名 → 中文面包屑（实测靶子：before 页头即 "Overview/Knowledge/System" 英文） | 待做 | |
| C3 ① | 全局「会话已过期」横幅替换四套 401 错误卡（ApprovalsPage/RunsPage/EmployeesPage/LoginPage 四套文案各异，无全站统一 banner；banner 挂载先例 App.tsx:963–966 族） | 待做 | |
| C4 ④ | 空/错态骨架与占位，375 不许一屏一句（骨架先例：ApprovalsPage:419/RunsPage:429 SkeletonRows、EmployeesPage:591 RowsSkeleton，均页面手写） | 待做 | |
| C5 ⑤ | 内部话术清理：「接口不可达/数字不作零处理」TasksBoardModulePage:646、RunsModulePage:1367、CollabDelegationsModulePage:484，技术信息折叠进「详情」；注意 TasksBoardModulePage.test.tsx:210 整句断言需同步 | 待做 | |

## before 清单（2026-11-20 采集，9122 基线）

- before-overview-1440.png / before-overview-375.png（158KB/59KB）
- before-knowledge-1440.png / before-knowledge-375.png（134KB/53KB）
- before-system-1440.png / before-system-375.png（119KB/59KB）
- DOM 回读：三页 heading 为英文 Overview/Knowledge/System；375 腿 scrollW=innerW=375 无横向溢出；正文 1041–1950 字符。

## 不变量核查锚点

- `shell/routes.ts`：CONSOLE_TABS=22、ROUTE_TABLE=51（:553 assert）——每笔提交后计数不变。
- 既有 data-testid 不改名；禁新增依赖；不碰 App.tsx 路由注册表与 modules/** 业务逻辑。
