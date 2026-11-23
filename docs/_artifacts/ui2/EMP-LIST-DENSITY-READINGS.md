# EMP 列表密度与工具行 — 只读读数（UI-EMP 车道，开工前取证）

拍次：L0 点单 10:3x（员工列表密度+工具行收敛），参谋纪律「TOKENS 字阶未全合前页面 parity 不开工」⇒ 本笔**纯只读**，零源码改动、零视觉改动。
日期：2026-11-23（周一）。脸：`39becd502c`，`git status --porcelain | wc -l` = **0**。

## 1. 脸与令牌判据（参谋读数①第一项）

| 命令 | 尾行读数 | exit |
|---|---|---|
| `git log --oneline -1` | `39becd502c docs(console): employee-detail inline style evidence` | 0 |
| `git status --porcelain \| wc -l` | 0 | 0 |
| `git rev-parse --short origin/lane/hermes-console` | `9f74a739b2` | 0 |
| `git rev-list --count HEAD..origin/lane/hermes-console` | 73（我落后 73 笔，开工笔须先 merge） | 0 |
| `git diff HEAD origin/lane/hermes-console -- web/src/styles/tokens.css \| wc -l` | **0 ⇒ 令牌已合，我 HEAD 与集成分 tokens.css 逐字相同** | 0 |
| `grep -n "font-size" web/src/styles/tokens.css` | 5 处命中 | 0 |

令牌实际值（`tokens.css` 逐字）：
- `:133-134` `--font-size-1:12px; --font-size-2:13px; --font-size-3:14px; --font-size-4:16px; --font-size-5:20px; --font-size-6:24px`（6 档，判据源）
- `:29-30` 并存第二族 `--font-size-ls-1..6`，数值与上**完全相同**（12/13/14/16/20/24）⇒ 写文档/改码时必须选边，不得两族混用
- `:135` `--line-height-1:1.25; --line-height-2:1.4; --line-height-3:1.5`
- `:130` `--space-1:4px … --space-3:12px … --space-8:32px`
- `:163-164` `--btn-h-inline:28px; --btn-h:32px; --btn-h-dialog:36px; --btn-hit-min:32px`

**字阶未全合的实情**：`ls web/tailwind.config.*` → No such file（exit 1），`grep -rn fontSize web/vite.config.ts web/src/styles` → 空（exit 0）。即 **Tailwind 的 `text-xs/sm/base/xl` 仍是框架默认值，并未绑定 `--font-size-*`**；6 档目前只能靠显式 CSS 触达页面（现例 `employees-density.css` 用 `var(--font-size-2)!important`）。故本笔只做读数，不开视觉笔。

## 2. 字号对照表（现存类 → px → 是否 ⊆ 6 档）

| 文件 | 行数 | text-xs(12) | text-sm(14) | text-base(16) | text-xl(20) | 任意值 `text-[` | 集合 ⊆ 6 档 |
|---|---|---|---|---|---|---|---|
| `web/src/modules/employees/EmployeesModulePage.tsx` | 1121 | 27 | 9 | 3 | 1 | 0 | **是** {12,14,16,20} |
| `web/src/modules/employee-detail/EmployeeDetailModulePage.tsx` | 1874 | 54 | 18 | 0 | 1 | 1 | **是**（见注） |
| `web/src/modules/employee-detail/EmployeeDetailWorkbench.tsx` | 144 | 2 | 2 | 0 | 0 | 0 | **是** {12,14} |

注（口径盲区，必须写明）：detail 页唯一 `text-[` 命中在 `:1523` = `text-[var(--color-text-muted)]`，**是颜色不是字号**；若不区分，任意值判据会把它误读成"第 7 档字号"。

行高：`grep -n "leading-" 三文件 | wc -l` = **0** ⇒ 本域页面完全不声明行高，现值全由 Tailwind `text-*` 的内置 line-height 附带提供，与 `--line-height-1/2/3` 无绑定。这是密度判据里最实的一处缺口。

## 3. 控件高（三源对照）

- 令牌真源：`--btn-h-inline 28 / --btn-h 32 / --btn-h-dialog 36 / --btn-hit-min 32`（tokens.css `:163-164`）。
- 壳供值（`web/src/shell/ConsoleButton.tsx` :44-60 逐字，只读；shell 禁碰）：
  `SIZES = { sm:{cls:"px-3 text-xs", h:"var(--btn-h-inline)"}, md:{cls:"px-3 text-sm", h:"var(--btn-h)"}, lg:{cls:"px-4 text-sm", h:"var(--btn-h-dialog)"} }`，默认 `variant="secondary"`、`size="sm"`，注释点名 UI-RUBRIC §7 与例外 E4。
- 本域实际用量：`size="sm"` 计数 employees 9 枚 + detail 页 5 枚 = **14 枚全走 28px 档，`md`(32px) 零使用** ⇒ 与验收「控件高 32±1」不符，但**修法是在我域内传 `size="md"`，不需要改 shell**。
- 非按钮控件（推算，需浏览器 computed 复测）：搜索框/下拉 `px-3 py-2 text-sm` ≈ 14×行高 + 8+8 + border 2 ≈ **34px**（超 32±1）；部门 chip `h-6` = **24px**（低于 32±1，且低于 `--btn-hit-min` 32px 命中区底线）。
- 高度类普查（employees）：`h-10×1 h-3×3 h-3.5×1 h-4×4 h-5×3 h-6×4`；`py-1.5×1 py-2×3 py-3×1`。detail 页：`py-1.5×3 py-2×11 py-3×7`。
- 内联 style 负债：`grep -rn "style={" 三文件 | wc -l` = **0**（R275 已把 detail 的 11 站点迁入 `employee-detail.css`；字面量与全形制两判据一致）。

## 4. 工具行/筛选行单行判据（逐组，8+4 处 flex-wrap）

`EmployeesModulePage.tsx` 8 处：`:391` 复制组（role=group「复制列表」）、`:471` 导出组（「导出 CSV」）、`:688` 页头 `flex flex-col … sm:flex-row sm:flex-wrap`、`:689` 标题组、`:707` 操作组（`max-md:w-full`＝**375 独占一行是既有有意设计，不算违反单行**）、`:758` **筛选行** `CardContent flex flex-wrap items-center gap-2 p-3`、`:786` 部门 rail `flex min-w-0 flex-wrap items-center gap-1.5 text-xs`（`emp-list-dept-rail`）、`:1076` 页脚/分页组（`emp-list-page`）。
`EmployeeDetailModulePage.tsx` 4 处（同类分组）。

逐组结论：
- 违反「筛选单行」的候选 = **`:758` 筛选行本体** 与 **`:786` 部门 rail**（rail 是 chip 流，天然换行；若按"筛选控件单行"口径，rail 应移出筛选行或改横滚壳，属开工笔决策，需 L0 定口径）。
- `:688` 页头用 `sm:flex-wrap`：≥sm 单行、窄屏换行，符合"每页 1 主按钮 + 工具行单行"的意图，但 1440 下同组元素仍可能挤行，须取图证实。
- 主按钮计数：`grep -rn primary 两目录 | grep -v .test. | wc -l` = **0** ⇒ 页级 primary 现 **0 枚**。「≤1」已过，**「每页 1 枚主按钮」是缺口**（列表当前无主行动，复制/导出/刷新全 secondary/sm）。

## 5. 运行时原生 select 读数（参谋读数①第三项）

- `grep -rln "<select" web/src` = 9 文件：`shell/ConsoleSelect.tsx`、`shell/selectHarness.ts`、`components/ui/ui.css`、`components/ui/Select.tsx` + 5 个测试（tasks/audit×2/approvals/runs）。
- 生产码命中仅为**禁令注释**：`components/ui/Select.tsx:7`「禁原生 `<select>`——设计系统的 Select」。
- `files-importing-ConsoleSelect = 25`；列表页 `EmployeesModulePage.tsx:10` import、`:772` 使用（lifecycle 下拉 testid `employees-lifecycle`）。
- ⇒ **源码级判定：本域运行时原生 `<select>` = 0**；浏览器精确数 `document.querySelectorAll('select').length` 列入开工笔取图，本轮未测。

## 6. 已收编项与未锚项（`web/src/modules/employees/employees-density.css`，31 行）

已收编（逐字规则）：`[data-testid="emp-list-nav"]{max-width:100%;overflow-x:auto}`；`[data-testid^="employees-row-"]{min-height:var(--table-row-h)}`；表头经 `:has(+ [data-testid="emp-list-sort-scope-note"])` 选到，`font-size:var(--font-size-2)!important; color:var(--color-text-muted)!important`；`@media (min-width:768px)` 对 `[data-label="最近活跃"|"知识"|"月度预算"]` 右对齐 + `tabular-nums`。
其注释自陈两案：本仓 `/employees` **无 HTML table**（行壳是 `li employees-row-*`，故 `grep -c "<table"` = 0，密度须走 li/data-label 网格映射）；斑马纹基线仅 `divide-y`，无条纹背景源。
未锚项（沿用其口径，未擅自扩域）：SortHeader 按钮内右对齐（无钩子属性）、预览子表面 36px 档（testid 未证实）。

## 7. 参谋三项读数（本轮实况）

1. **TOKENS**：已合（diff 0 行）；本域字号集合 {12,14,16,20} ⊆ 6 档；但 `text-*` 未绑定 `--font-size-*`（无 tailwind.config，fontSize 映射 0 命中）；运行时原生 select 源码级 0（浏览器待复检）。
2. **壳上 9122**（绝对未碰/未重建）：`curl -s http://127.0.0.1:9122/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js'` → **`assets/index-D3HZ8upz.js`**；L0 上午记录为 `index-INJI_bcS.js` ⇒ 两次点单之间 9122 已被重建。我本地未跟踪构建 `hermes_cli/web_dist`（mtime 11-23 00:03:43）entry `index-Ce1G1z2L.js`，与 served **不同代**；按纪律同代与否须用 chunk 级特征串核对，本轮不宣称同代。「顶栏唯一 h1+面包屑」「折叠后主区增宽 ≥120px」属 `web/src/shell/**`（禁碰）且需浏览器量测 ⇒ **未测**，转 `lane/L4-shell-queue` 或由 L0 重划。
3. **样板页 1440/375 对照**：本笔**未取图**（纯只读，无新端口）。ETA：12:00 检查点前交 `#/employees` 与 `#/employees/<id>` 的 1440×900 / 375×812 真 fullPage 前后图（自建 dist + 新端口，不复用已关掉的 9151/9153/9157/9158），并附端口+entry。

## 8. 开工笔候选（按"每笔 ≤15 文件/1500 行"，等字阶绑定结论后再动）

1. 部门 chip `h-6`(24) 与工具行 14 枚 `size="sm"`(28) → 收 `--btn-h` 32±1；**我域内可改**（传 size / css 令牌），不动 shell。
2. 筛选行 `:758`/`:786` 的 `flex-wrap` → 单行化（横滚壳或分组下沉），需 L0 先定"部门 rail 是否算筛选控件"。
3. 页级主按钮缺失：定哪一枚是主行动（列表当前 0 枚 primary）。
4. `text-*` → `--font-size-*` 绑定与 `leading-*` 声明：**归属存疑**，若无 tailwind.config 则由 UI-TOKENS 车道决定接入方式（页面侧只可挂 `@layer components` 类），此项不并前我不开视觉笔。
5. h1+面包屑唯一性、折叠后主区增宽 ≥120px：属 `shell/**`，转 `lane/L4-shell-queue`。

## 附：取证脚本与日志（可复跑）

- `bash /private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/emp_readings.sh` → `…/emp-readings.txt`、`…/emp-readings2.txt`（exit 0）
- `…/emp_readings4.sh` → `…/emp-readings3.txt`（exit 0，tokens 键位/ConsoleSelect/variant/h-*/leading/primary/text-[ 定性）
- 本文档内表列命令尾行另存 `…/emp-doc-face.log`、`…/emp-doc-census.log`（在 `web/` 下执行，git 路径按仓库根写）
