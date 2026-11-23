# L4 · 外壳与顶栏（shell + topbar） — DONE

- 车道分支：`lane/L4-shell`（新建，base `origin/lane/hermes-console` = `5710116161`），worktree `/Users/kevin_studio/Projects/forks/console-design`
- 写域：只动 `web/src/shell/**` 三个文件（`TopBar.tsx`、`console-chrome.css`、`topbar.contract.test.ts`）。未碰 `modules/**`、BFF、domain、治理仓，未改原生 select，未 `pnpm install`，无 force / `--no-verify`
- 面：控制台外壳（`#/overview` 等全部路由共用的一行顶栏 + 侧栏）

## 结论：真正缺的是产物里的名字，不是顶栏本体

顶栏早就实现并挂载了，本车道逐条核过盘上事实：

| 断言 | 证据 |
|---|---|
| 主列挂了顶栏槽与顶栏 | `web/src/App.tsx`：`<div className="flex min-h-0 min-w-0 flex-1 flex-col">` → `<div id={SHELL_TOPBAR_SLOT_ID} className="shrink-0" />` → `<ConsoleTopBar collapsed={collapsed} onToggleCollapse={toggleCollapsed} />` |
| 唯一一个 `<h1>` | `web/src/shell/TopBar.tsx` `data-testid="shell-topbar-title"`；`console.tsx` 里 `<h1` 计数 = 0（闸 `topbar.contract.test.ts` 钉死） |
| 面包屑 | `<span data-testid="shell-topbar-crumb">`，内容 `${surface.group} · 控制台` |
| 侧栏折叠钮 | `<Button data-testid="shell-sidebar-collapse" aria-label={collapsed ? 展开 : 折叠}>`，图标 PanelLeftOpen/PanelLeftClose |
| 旧产物里已有这些 | `index-CiJcZ4mg.js`：`shell-topbar` 命中 1、`shell-sidebar-collapse` 命中 1、`shell-topbar-slot` 命中 1 |

缺口在于验收/量测用来定位这一行的字符串 **`console-topbar`**：改造前全仓（`*.ts/*.tsx/*.mjs/*.js/*.css/*.md/*.py`，排除 `node_modules` 与 `web_dist`）命中 **0**，产物里也命中 **0**。它是外部口径的验收锚点名，仓库里没人铸过。

处置：把它铸成受契约保护的公开面——组件类名 + chrome 样式表规则 + 组件自带 CSS 导入 + 源码闸断言。四者缺一，`topbar.contract.test.ts` 就打红，名字不会再静默消失。

## 改动（三处，全在写域内）

1. `web/src/shell/TopBar.tsx`
   - `<header>` 类名加上 `console-topbar`，同时把描边从 Tailwind 叠色 `border-current/20` 改为走样式表（几何仍由组件上的 `h-[56px]` 等 px 工具类钉住，`barH` 实测 56 未变）。
   - 补 `import "./console-chrome.css";`：顶栏在惰性 chunk 里，原来只靠 `console.tsx` 带样式表 ⇒ 不补就有"类名上了 DOM、规则没上这一屏"的漏路。
2. `web/src/shell/console-chrome.css`
   - 新增 `.console-topbar { border-color: var(--color-border-subtle-ls); }`（只用契约层令牌，满足 `console-chrome.test.ts` 的"零 hex、零 px/em/rem/pt/% 字面量"）。
   - 文件头 scope 注释同步为"顶栏行也在内，由 console.tsx 与 TopBar.tsx 共同导入"。
3. `web/src/shell/topbar.contract.test.ts`
   - 新增用例 `the bar keeps the artifact-facing name console-topbar`，钉三件事：`className="console-topbar ` 在 TopBar、`.console-topbar` 在 chrome 样式表、`"./console-chrome.css"` 被 TopBar 导入。

$ git diff --stat -- web/src/shell/TopBar.tsx web/src/shell/console-chrome.css web/src/shell/topbar.contract.test.ts
 web/src/shell/TopBar.tsx              |  3 ++-
 web/src/shell/console-chrome.css      | 14 +++++++++++---
 web/src/shell/topbar.contract.test.ts |  7 +++++++
 3 files changed, 20 insertions(+), 4 deletions(-)

## DoD 逐条核对

| 条 | 要求 | 状态 | 原始读数位置 |
|---|---|---|---|
| ① | 外壳挂顶栏 = 唯一 h1 + 面包屑 + 折叠钮 | ✅（源码 + 运行时 DOM：`h1Count=1`、`h1InBar=true`、`h1Text=运营总览`、crumb、`toggle_found=1`） | 下方"运行时几何" |
| ② | 构建通过、产物 bundle 里 `console-topbar` ≥ 1 | ✅ 入口 JS 命中 1、入口 CSS 命中 1，规则原样落地 | "打包闸 / 产物命中" |
| ③ | 1440 折叠前后主区宽度差 ≥ 120px | ✅ **156px**（另测侧栏本身 155px，展开后完全复原） | "1440 量测" |
| ④ | 375 抽屉开合用 aria-expanded 判，不用宽度 | ✅ `false → true → false`；并留了"宽度为何不可用"的证据 | "375 抽屉" |
| ⑤ | 相关 vitest 全绿 | ✅ 相关文件 5 文件 / 59 用例全绿；全 `src/shell` 118 用例里 117 绿、1 红为 `e1Contract`（部署新鲜度探针，非本 diff，机制见"环境红归因"） | "vitest" |
| ⑥ | 提交 + 推送 `lane/L4-shell`，DONE.md 贴命令与原始输出 | ✅ 本文件 + 下方提交记录 | "提交与推送" |

## 命令与原始结果

日志原件：`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/`（`l4-vite-build.log`、`l4-build.clean.log`、`l4-measure-9148-final.json`、`l4-gate-9148.log`、`l4-gate-9122-baseline.log`）。

### 打包闸（本仓 AGENTS.md 认定的可用命令）

```
$ cd web && node_modules/.bin/vite build
../hermes_cli/web_dist/index.html                    1.08 kB │ gzip:   0.48 kB
../hermes_cli/web_dist/assets/index-BSmVqWaN.css   150.30 kB │ gzip:  23.10 kB
../hermes_cli/web_dist/assets/index-BXmchWSz.js    174.88 kB │ gzip:  56.02 kB
✓ built in 6.41s
VITE_EXIT=0
```

### 产物命中（DoD② 的判据本体）

```
$ cd hermes_cli/web_dist
$ for f in assets/index-BXmchWSz.js assets/index-BSmVqWaN.css; do echo "$f console-topbar=$(grep -o 'console-topbar' $f | wc -l | tr -d ' ')"; done
assets/index-BXmchWSz.js console-topbar=1
assets/index-BSmVqWaN.css console-topbar=1

$ grep -o '\.console-topbar{[^}]*}' assets/index-BSmVqWaN.css
.console-topbar{border-color:var(--color-border-subtle-ls)}
```

改造前同一棵树旧产物的对照（这就是本车道要修的那件事）：

```
$ curl -s http://127.0.0.1:9122/agent-v2/assets/index-CiJcZ4mg.js | grep -o 'console-topbar' | wc -l
0
```

`hermes_cli/web_dist/` 在 `.gitignore` 里（`git ls-files` 命中 0）⇒ 产物不入 git，验收以源码重建为准；提交带的是源码与闸。

### vitest（DoD⑤）

相关面（顶栏/外壳/chrome/路由契约）：

```
$ cd web && node_modules/.bin/vitest run src/shell/topbar.contract.test.ts src/shell/console-chrome.test.ts src/shell/shell-layout.contract.test.ts src/shell/console.test.tsx src/shell/routeContract.test.ts
 Test Files  5 passed (5)
      Tests  59 passed (59)
Duration  1.16s
```

整个 `src/shell`：

```
$ cd web && node_modules/.bin/vitest run src/shell
 Test Files  1 failed | 13 passed (14)
      Tests  1 failed | 117 passed (118)
VITEST_EXIT=1
```

唯一红的不是本 diff：`src/shell/e1Contract.test.ts:205` `served entry drifted from the dist on disk: expected 'assets/index-CiJcZ4mg.js' to be 'assets/index-BXmchWSz.js'`，自报行 `PORT=9122 DISK_ENTRY=assets/index-BXmchWSz.js SERVED_ENTRY=assets/index-CiJcZ4mg.js`。机制见"环境红归因"。

### 1440 量测（DoD③ 的原始读数）

登录态前置断言（`whoami=200` 后才取数，匿名读数不作判据）：

```json
{
 "face": "http://127.0.0.1:9148/agent-v2",
 "auth": {"whoami": 200, "tokenInjected": true},
 "1440_before": {
   "mainW": 1221, "slotW": 1232, "barH": 56,
   "barClass": "console-topbar z-1 flex h-[56px] shrink-0 items-center gap-3 border-b bg-background-base px-6",
   "barBorder": "rgba(255, 230, 203, 0.14) / 1px",
   "h1Count": 1, "h1Text": "运营总览", "h1InBar": true,
   "asideW": 208, "asideX": 0, "collapsedLS": null, "docOverflow": 0
 },
 "1440_after_collapse": {
   "mainW": 1377, "slotW": 1388, "barH": 56,
   "h1Count": 1, "h1InBar": true,
   "asideW": 53, "asideX": 0, "collapsedLS": "true", "docOverflow": 0
 },
 "1440_after_expand": {
   "mainW": 1221, "slotW": 1232, "asideW": 208, "collapsedLS": "false", "docOverflow": 0
 },
 "1440_delta": {
   "mainDeltaPx": 156, "slotDeltaPx": 156, "asideDeltaPx": 155,
   "asideRestored": true, "overflowAfterCollapsePx": 0,
   "collapsedLS_afterClick": "true", "collapsedLS_afterExpand": "false"
 }
}
```

判据：**主区宽度差 = 156px ≥ 120px ✅**（顶栏槽同宽 156px，说明这一行确实跟着侧栏回流，不只有 `main` 在动）；`aside` 208→53→208 完全复原；折叠后横向溢出 0px；持久化键 `hermes.sidebar.collapsed` 写入 `true`/`false`。

单位口径提醒：根字号 15px 下 Tailwind 的 rem 类算不出整数值（`w-64`=240px、`lg:w-14`=52.5px），而 `shell-layout.ts` 冻结令牌是 208/56px（名义差 152px）。实测差 156px 属于这套混单位的既有事实，按 px 报数，不在本车道擅动几何。

### 375 抽屉（DoD④，只认 aria-expanded）

```json
{
 "375_closed": {"aria": {"triggerFound": true, "ariaExpanded": "false", "ariaLabel": "打开导航", "asideW": 240, "asideX": -240, "asideInert": true}},
 "375_open":   {"aria": {"triggerFound": true, "ariaExpanded": "true",  "ariaLabel": "打开导航", "asideW": 240, "asideX": 0,   "asideInert": false}},
 "375_reclosed": {"aria": {"triggerFound": true, "ariaExpanded": "false", "asideW": 240, "asideX": -240, "asideInert": true}},
 "375_verdict": {
   "judgedBy": "aria-expanded",
   "openVia": "click [aria-controls=app-sidebar]",
   "closeVia": "keyboard Escape（抽屉打开时触发钮被抽屉盖住，命中测试拦 pointer）",
   "closed_expanded": "false", "open_expanded": "true", "reclosed_expanded": "false",
   "pass": true,
   "widthWouldBeWrongBecause": {"asideW_closed": 240, "asideW_open": 240, "note": "抽屉用 transform 位移，宽度不变 ⇒ 宽度判据读不到开合"}
 }
}
```

`aria-expanded` 三态正确（关→开→关）；`inert` 与位移同步（关时 `asideX=-240` 且 inert，开时 `asideX=0` 且非 inert）。宽度读数在开与关都是 240——这正是为什么抽屉开合不能用宽度判：`translate-x-full` 不改宽度。

两条方法学注意（都按既有踩坑记录办）：`goto` 用 `domcontentloaded` + 1.8s settle（活轮询让 `networkidle` 永不收敛）；cookie 按 origin 注入并紧贴 `whoami==200` 断言（否则 storageState 域不匹配会静默未登录、读出一堆骨架伪像）。

### 他道闸（canonical 口径交叉验证）

用仓里正典闸 `scripts/assert-ui-contract.mjs` 的条款 8 复量，独立于我自建腿：

```
$ node scripts/assert-ui-contract.mjs --url=http://127.0.0.1:9148/agent-v2 --token-file=<jar>
脸=http://127.0.0.1:9148/agent-v2 登录whoami=200 token注入=是 视口=1440x900 stage=duty
· DEFERRED  sidebar-collapse-reflows（条款 8） — 宽度差=156px 折叠后溢出=0px 持久化=无
✘ FAIL      filter-row-single-line + one-primary-per-page（条款 7） — 筛选组=10 多行=6 gap 不合规=2 实心主按钮=1
✘ FAIL      identity-no-bare-id-no-english-role（条款 10） — 身份区存在=false … 英文角色名=1（AGENT）
UI-CONTRACT 总计=11 PASS=5 FAIL=2 DEFERRED=4
```

- 条款 8 的 **156px** 与我自建腿完全一致；`stage=duty` 下它显示 DEFERRED（该条款在 duty 阶段未判绿），所以 DoD③ 的正据是我的原始读数 + 这条独立腿的等值读数。
- **"持久化=无"是闸的采样顺序，不是产品红**：该工具在写 localStorage 之前取数；我的独立腿在点击后读到 `hermes.sidebar.collapsed="true"`、再展开读到 `"false"`（见上），持久化确实成立。
- 条款 7（筛选行）与条款 10（身份区）的两个 FAIL **不属于本车道**：在 9122 部署脸（跑改造前的旧产物）上跑同一条命令，读数逐字相同 —— `宽度差=156px 折叠后溢出=0px`、条款 7/10 同样 FAIL。同面同值 ⇒ 既有债，与 shell 改动无关。

## `pnpm build` 的既有墙（诚实交代，不粉饰）

按写域名义跑的 `cd web && pnpm run build`（= `node ../scripts/build/web.mjs`）**exit 1**，死在 typecheck 步，产物步没走到：

```
$ cd web && pnpm run build
Error: TypeScript build failed (2)
../apps/shared/src/ansi.test.ts:1:38 - error TS2307: Cannot find module 'vitest' …
src/modules/employee-detail/EmployeeDetailModulePage.tsx:843:52 - error TS2339: Property 'message' does not exist on type '{ phase: "loading"; } …
src/modules/employees/employees.empty.test.tsx:107:5 - error TS18047: 'root' is possibly 'null'.
src/modules/evidence/EvidenceModulePage.test.tsx:298:5 - error TS2349: This expression is not callable.
[ELIFECYCLE] Command failed with exit code 1.   (exit=1, 12s)
```

归因（不是我的 diff）：

```
$ sed -e 's/\x1b\[[0-9;]*m//g' l4-build.log > l4-build.clean.log
total_error_TS=106
grep 'error TS' l4-build.clean.log | grep -cE "src/shell/|src/App\.tsx|TopBar|console-chrome"
0
```

106 条错误全落在 `apps/shared/src/*.test.ts`（符号链接的 `node_modules` 找不到 `vitest` 类型）与 `src/modules/approvals/**`、`src/modules/employee-detail/**` 等既有契约漂移面，本车道的 `web/src/shell/**` 与 `App.tsx` 命中 0。这正是本仓 `AGENTS.md` 写明的两条：符号链接 console worktree 里可用的打包命令是 `cd web && node_modules/.bin/vite build`；`cd web && pnpm run build` 在干净检出上就 exit 1，**typecheck 只看 delta、不看 exit code**。DoD② 的实质（产物里 `console-topbar` 命中 ≥1）由上面的 vite 闸 + 产物 grep 证明；`modules/**`/`apps/shared` 的类型墙在别的车道写域里，本车道按边界不动。

## 环境红归因（DoD⑤ 那条唯一红，写给 L0）

`e1Contract.test.ts` 是**部署新鲜度探针**：把"盘上 dist 的入口 hash"与"9122 脸下发 HTML 引用的入口 hash"对齐，硬编码 `PORT = 9122`（无 env 覆盖）。

- 9122 脸是 `Python /Users/kevin_studio/Projects/l7-ops/ops/v4_proxy.py`（pid 61021），静态目录 `SEAKOI_V4_DIST` 默认指向 **sibling 检出** `/Users/kevin_studio/Projects/forks/hermes-agent/hermes_cli/web_dist`，`/agent-api/*` 反代 BFF `127.0.0.1:8092`（鉴权上游 7860）。
- 本车道 DoD② 必须重建**我这棵树**的 dist（`CiJcZ4mg` → `BXmchWSz`），而部署脸还在 serving 合入前的 `CiJcZ4mg` ⇒ 该用例必然打红。基线提交 `41232778d2` 的闸台账正是 stamped 在 `56eef7a81b / entry CiJcZ4mg`，所以红的是"我的产物还没上脸"，不是行为差异。
- 我没做的两件事（越界）：不把 dist 拷进 sibling 检出，不重启 pid 61021 —— 9122 是各车道共用的验收脸。
- **闭环动作（留给 L0）**：合入 `lane/L4-shell` 后在部署树重建 web dist，`e1Contract` 自动回绿，9122 脸的 `console-topbar` 命中也从 0 变 ≥1。
- 为拿到真机读数，我用同一段代理代码临时起了个只读脸：`SEAKOI_V4_DIST=<本树 dist> V4_SERVE_PORT=9148 python3 v4_proxy.py`，量测完已关闭；9122 与它的进程全程未动。

## 提交与推送

见本分支提交（`git log --oneline -1`），推送后定向 ref 回读：

```
$ git add web/src/shell/TopBar.tsx web/src/shell/console-chrome.css web/src/shell/topbar.contract.test.ts docs/_artifacts/L4-shell/DONE.md
$ git commit -m "feat(shell): 顶栏铸出验收锚点 console-topbar（类名+样式表规则+组件导 CSS+源码闸），并留 1440/375 量测读数"
$ git push origin lane/L4-shell
$ git ls-remote origin refs/heads/lane/L4-shell     # 看输出行判存在（本机 ls-remote 全量走管道会被截）
```

## 遗留（不在本车道写域内）

1. 部署侧：合入后重建 9122 脸的 dist（上面"环境红归因"）。
2. `pnpm build` 的 106 条类型墙属 `modules/**` 与 `apps/shared` 车道的债；其中 `apps/shared/src/*.test.ts` 找不到 `vitest` 类型是本 worktree 的 `node_modules` 符号链接形态造成的，不是产品缺陷。
3. 条款 7（筛选行多行/gap/实心主按钮）与条款 10（身份区英文角色名 AGENT）两 FAIL 在旧产物上同值，属对应车道；本车道只报同值证据，不动他人文件。
