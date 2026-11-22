# employee-detail 内联 style 迁移取证（L0 点单，face `b907818b3f`）

写域：仅 `web/src/modules/employee-detail/**`。`App.tsx` 与 `themes/context.tsx` 冻结，未碰。
代码笔：`c8a791be40` `refactor(console): move employee-detail inline styles into module css`（3 文件：两个 tsx + 新增 `employee-detail.css`），已推 `lane/console-ui2`。

## 1. 十一站点与去向（行号为迁移前 face `b907818b3f` 上的实测位置）

| # | 文件:行（迁移前） | 原内联值 | 现在 |
|---|---|---|---|
| 1 | `EmployeeDetailWorkbench.tsx:87` | `panel bg / line / fg-2` | `edw-panel` |
| 2 | `EmployeeDetailWorkbench.tsx:93` | `color: var(--fg)` | `edw-title` |
| 3 | `EmployeeDetailWorkbench.tsx:99` | `color: var(--fg-3)` | `edw-muted` |
| 4 | `EmployeeDetailWorkbench.tsx:116` | `panel bg / line / fg-2` | `edw-panel` |
| 5 | `EmployeeDetailWorkbench.tsx:127` | `color: var(--fg)` + `transparent` | `edw-toggle` |
| 6 | `EmployeeDetailWorkbench.tsx:130` | `color: var(--fg-3)` | `edw-muted` |
| 7 | `EmployeeDetailWorkbench.tsx:139` | `color: var(--fg-3)` | `edw-muted` |
| 8 | `EmployeeDetailModulePage.tsx:1114` | `color: var(--fg-3)` | `edw-muted` |
| 9 | `EmployeeDetailModulePage.tsx:1128` | active `panel-2`/`fg`，idle `transparent`/`fg-3` | 模板串 `edz-on` / `edz-off` |
| 10 | `EmployeeDetailModulePage.tsx:1143` | `borderColor: var(--line-2)` | `edz-tablist` |
| 11 | `EmployeeDetailModulePage.tsx:1157` | 同 #9 的活动/闲置对 | 模板串 `edz-on` / `edz-off` |

`employee-detail.css`（36 行）：4 条 `edw-*` + 3 条 `edz-*`，全部只引用主题令牌。

## 2. 源码普查（两种判据都给，避免字面量盲区）

| 判据 | `EmployeeDetailWorkbench.tsx` | `EmployeeDetailModulePage.tsx` | 合计 |
|---|---|---|---|
| `grep -c 'style={{'`（字面量形制） | 迁移前 7 → 迁移后 **0** | 迁移前 4 → 迁移后 **0** | 11 → **0** |
| `grep -c 'style={'`（含换行/表达式形制） | **0** | **0** | **0** |

两种计数在本对文件上完全一致 ⇒ 这 11 站点不存在「字面量判据漏形制」的盲区，「归零」是完整形制迁移。
令牌纪律：`grep -nE '#[0-9a-fA-F]{3,8}' employee-detail.css` = 0（无 hex）；`grep -nE '[0-9]+(px|rem|em)'` 无输出（无裸尺寸）。

## 3. 门禁（全部实跑）

- `./node_modules/.bin/vitest run src/modules/employee-detail` → exit 0，Test Files 1 passed / **Tests 65 passed**。
- `npx eslint src/modules/employee-detail` → exit 0，3 problems（0 errors，3 warnings，全部既有 `react-hooks/set-state-in-effect`）。
- `./node_modules/.bin/tsc -b . --noEmit` → 总 **101** `error TS`（与迁移前同脸持平），**0** 条命名这两个文件。
- `./node_modules/.bin/vite build` → exit 0（outDir `../hermes_cli/web_dist`，未跟踪）。
- 全量 `./node_modules/.bin/vitest run src` → **Test Files 1 failed | 483 passed (484) / Tests 1 failed | 3573 passed (3574)**；唯一红是 `src/shell/e1Contract.test.ts`（依赖 9122 活部署的环境项，非本 diff）。文件/用例总数与 L0 基线 484/3574 逐字相等。

## 4. 浏览器取证（真 fullPage 前后图）

自构建产物伺服，绝不碰 9122/9119；两服取图后已关闭（`lsof` 复验 0 监听）。

| 代次 | 端口 | entry chunk | `edw-panel` 特征标记 |
|---|---|---|---|
| BEFORE（`b907818b3f` 的 detached worktree 构建） | 9157 | `assets/index-Ceaj0F6k.js` | **不存在**（JS/CSS 均无） |
| AFTER（`c8a791be40` 的 lane 构建） | 9158 | `assets/index-Ce1G1z2L.js` | 存在于 `assets/index-Ce1G1z2L.js` 与 `assets/index-BXcWwE_c.css` |

路由 `#/employees/emp_aaaabbbbcccc`，静态伺服无后端（`/agent-api/*` 必 404，属环境噪声）：

| 代次 × 视口 | `documentElement.scrollWidth` | 渲染 DOM 内 `[style]` 元素数 | 带 `edw-*/edz-*` 类的面 | `role=tab` 数 | 越界元素 | console error（env / product） | fullPage PNG 字节 |
|---|---|---|---|---|---|---|---|
| before 1440×900 | 1440 | **13** | 0 | 14 | 0 | 12 / **0** | 67091 |
| before 375×812 | 375 | **13** | 0 | 14 | 0 | 12 / **0** | 37448 |
| after 1440×900 | 1440 | **3** | ≥1（tablist `class div`） | 14 | 0 | 12 / **0** | 67091 |
| after 375×812 | 375 | **3** | ≥1（tablist `class div`） | 14 | 0 | 12 / **0** | 37448 |

读法：该路由渲染时带内联 `style` 的 DOM 元素从 **13 降到 3**；被本笔迁移的面不再带 `style` 属性，其中页签容器改由 `.edz-tablist` 供值。残余 3 个内联面是 `header`、`aside`（属 `App.tsx`/shell 冻结域）与数据门控占位块，不在这 11 站点之内。
逐像素：同一视口前后 PNG 字节数完全相同（67091 / 37448），即纯样式搬迁、视觉无变化。

## 5. 必须记录的诚实项

1. **首轮 AFTER 取图来自过期构建**：`hermes_cli/web_dist/index.html` 当时 mtime 为 11-22 16:25（早于本笔编辑与提交），其中不含 `edw-panel`；该组 AFTER 读数（`[style]` 13→19、无 class 面）无效。已在迁移后重建（mtime 11-23 00:03:43）并重跑，本文件第 4 节是重建后的读数。旧产物文件已被覆盖。
2. **面级完整配对仍需带数据登录态**：本轮在零后端静态伺服上取证，模块停在数据门控态，能看到页签/容器面的形制切换，但看不到依赖真实员工数据的分支面。有效登录态（9122 侧 cookie 已早衰，`/auth/whoami` 返 401）需 L0 供给后才能补这一层。
3. **「归零」的口径范围**：本笔清偿的是点单指定的这 11 站点；全仓内联 style 负债（指南 §6.2 现算 65 处、真实站点 67）不在本笔范围。运行时值不可令牌化的面，「归零」只能算形制迁移，本笔 11 站点全是静态令牌值，属完整迁移。

## 6. 复跑命令

```bash
# 源码普查（两脸对比）
git show b907818b3f:web/src/modules/employee-detail/EmployeeDetailWorkbench.tsx | grep -c 'style={{'
git show b907818b3f:web/src/modules/employee-detail/EmployeeDetailModulePage.tsx | grep -c 'style={{'
grep -rn 'style={' web/src/modules/employee-detail | wc -l

# 门禁
cd web && ./node_modules/.bin/vitest run src/modules/employee-detail
cd web && npx eslint src/modules/employee-detail
cd web && ./node_modules/.bin/tsc -b . --noEmit | grep 'error TS' | grep -c employee-detail
cd web && ./node_modules/.bin/vite build

# 取图（构建后自伺服，端口用完即关）
python3 -m http.server 9158 --bind 127.0.0.1 --directory hermes_cli/web_dist
node /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/ed2-shots.mjs
```
