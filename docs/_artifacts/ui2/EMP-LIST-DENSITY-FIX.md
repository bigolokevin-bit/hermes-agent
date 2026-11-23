# EMP 密度收敛首码腿 — 取证与口径（L0 13:05 解阻令）

脸：`lane/L4-emp` = `lane/console-ui2` = **`368e7846e5`**（父 = 集成分 `1fe6b65dfb`），worktree porc=0。
写域：仅 `web/src/modules/employees/**`（3 文件 +110/−3）。`shell/**`、`scripts/**`、`modules/duty/**`、`App.tsx`、`themes/context.tsx` 未碰；9122 未碰、未重建。

## 1. 改动
- `EmployeesModulePage.tsx`：筛选行 `:758` → `emp-filter-row`（弃 flex-wrap）、部门 rail `:786` → `emp-dept-rail`（弃 flex-wrap）、搜索框并入 `emp-filter-control` 单条 className。
- `employees-density.css`：`.emp-filter-row{flex-wrap:nowrap;overflow-x:auto}`、`.emp-dept-rail{flex-wrap:nowrap}`、rail 按钮 `flex-shrink:0`、`.emp-filter-control{height:var(--btn-h)}`（32px 令牌供值）。
- 新契约测试 `employees.density.contract.test.ts`（5 例，node-env 源码契约）。

## 2. 红→绿（参谋形制：命令＋尾行＋exit）
- `cd web && pnpm exec vitest run src/modules/employees/employees.density.contract.test.ts`
  - 改前 RED：`Test Files 1 failed (1)` / `Tests 3 failed | 2 passed (5)`，exit=1（emp-red.log）
  - 改后 GREEN：`Tests 5 passed (5)`，exit=0（emp-green2.log）
- `pnpm exec vitest run src/modules/employees` → `13 files / 82 passed`，exit=0（emp-dir.log，既有用例零破）
- `pnpm exec vitest run src/modules/employee-detail` → `65 passed`，exit=0（emp-detail.log）
- `npx eslint src/modules/employees` → 0 errors / 8 warnings（全部既有 react-hooks 族），exit=0
- `./node_modules/.bin/tsc -b . --noEmit` → 总 **106** `error TS`（旧脸 101，差值来自 L0 并窗），**0 条命名本笔 3 文件**；`employees.empty.test.tsx(107,5)` TS18047 为该脸既有债（`git diff HEAD` 该文件为空）
- `./node_modules/.bin/vite build` → exit=0（emp-build.log）
- 全量 `vitest run src` **未跑**（L0 报基线 499 files/3680 复跑中；结构性红 `src/shell/e1Contract.test.ts` 依赖 9122 活部署，判环境不判 diff）

## 3. 闸读数（`node scripts/assert-ui-contract.mjs --token-file=<jar> --stage=emp`）
- 受控 jar 盘上不存在（find 无 .jar/cookies）；用 `~/.hermes/dashboard.token` 自拼 netscape（值全程未回显）。
- 自报行逐字：`脸=http://127.0.0.1:9122/agent-v2 登录whoami=401 token注入=是 视口=1440x900 stage=emp` + `WARN 匿名态：whoami=401——运行时条款读数不作判据`。
- 总计 `11 PASS=4 FAIL=7 DEFERRED=0`。⇒ **卡：token 失效（whoami=401）**，条款 1/7 的 9122 读数按闸自身口径不作判据。
- 口径注：闸 goto 为 `#/overview`（`:269`），本就不打 employees 路由；条款 5/6/9/10 选择器多为 duty 专用 ⇒ 即便登录态成立，该闸读数也不是 employees 面的直接判据。`--stage≠duty` 会使 1..10 全 GATING。
- 根字号口径：本机 root=15px，`text-sm` computed=13.125px ∉ {12,13,14,16,20,24}（rem×15 所致，改前同款类，属 TOKENS 车道/root-font 议题，非本笔引入）。

## 4. 自建脸运行时读数（**无后端 ⇒ 匿名降级态**，非真数据面，如实标注）
- 服务：端口 **9162**，dist = 13:2x 重建，代次特征串 `emp-filter-row` 命中 CSS chunk `EmployeesModulePage-4nbdLxiu.css`，entry `assets/index-BeFcrf7y.js`（R275 过期构建教训：先核 mtime+特征串再取图）。
- `#/employees` 1440×900：`.emp-filter-row` computed flexWrap=**nowrap**、控件 top=[334,337]（delta 3 ≤6 ⇒ 同一行；两个 top=0 是 `display:contents` 外层空壳，判据须剔除）、搜索框 offsetHeight=**32**（=var(--btn-h)）、rail flexWrap=nowrap、`document.querySelectorAll('select')` = **0**、docScrollWidth=1440、console error 11 条全为静态无后端的资源 404（环境）。
- 375×812：flexWrap=nowrap、top=[544,544] 同一行、控件高 **32**、selects=**0**、docScrollWidth=**375**（整页不横滚，行内自带 overflow-x 壳）。
- 截图：`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/emp-fix-1440x900.png`、`emp-fix-375x812.png`；读数 `emp-fix-readings.json`。探针 `emp-shot-probe.mjs`（sibling playwright chromium-1255，domcontentloaded+2.5s settle，禁 networkidle；每腿独立 browser——共享 browser 曾中途 target closed）。
- 9162 用毕已 kill，`lsof -iTCP:9162` 复验监听=0。取证端口历史：9151/9153/9157/9158/9161(废跑)/9162。

## 5. 决策与未闭
- **页级 primary 保持 0 枚**（只读列表、无创建动作；契约钉 ≤1）。若 L0 要“恰 1”，需指定主动作语义，本笔不造按钮。
- 原生 select：源码级与运行时均**零站点**（列表用 `ConsoleSelect`，属 shell 禁碰且无需动）。
- 待 L0：发新受控 jar 或用 `368e7846e5` 重建 9122 后，方可取同脸登录态前后对（whoami=200 前置）。
- 挂账（非本车道写域）：duty 七条（pane 时间范围筛选 P0、三卡「查看全部(N)」截断披露 P0、行级钻取死链 P0——参照 `RunsModulePage.tsx:1210-1214` 的 `/runs/?run=` 形制、最窄门置顶 P1、分母护栏 P1、页头 aria-disabled P1）；⌘K 全局键盘层（shell）；matrix 四联筛选。

## 6. 复跑
```bash
cd web && pnpm exec vitest run src/modules/employees/employees.density.contract.test.ts
node scripts/assert-ui-contract.mjs --token-file=<受控jar> --stage=emp   # 必读自报行 whoami=200
node /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/emp-shot-probe.mjs   # 需先起 9162 静态服务
```
