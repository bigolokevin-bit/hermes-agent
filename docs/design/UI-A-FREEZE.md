# UI-A 基础层冻结说明（Freeze Note）

- 日期：2026-11-21 · 车道：`lane/console-ui-a` · 依据：`docs/design/UI-RUBRIC.md` v1
- 基线：已 merge `origin/lane/hermes-console` tip `6d20d6f4`，合并后验证：`vite build` rc=0、`vitest src/shell` 53/53、`assert-ia` routes=51 / tabs=22 ok、typecheck 43 = 基线零新增。

## 一、四项落点清单

| 项 | commit | 落点 |
|---|---|---|
| tokens | `bffd7e46` | `web/src/shell/tokens.css` L49-97（UI-A 语义层 `:root`，追加于骨架块之后；`App.tsx` 原有 import 生效） |
| buttons | `9dec1833` | `web/src/shell/ConsoleButton.tsx` L48-51（SIZES 三档）、L102（aria-disabled）、L108（焦点环）、L115（高度） |
| shell | `76a66c46`（并入 `b9fb2cc4`） | `web/src/shell/console-nav.css`（33 行，新建）+ `web/src/shell/console.tsx` L67 import、L688/698 `console-nav-group`、L711/735 `console-nav-link` |
| table density | `80674752` + `2431a5b4` | `web/src/styles/table-density.css`（59 行，新建）+ `console.tsx` L68 import |

## 二、令牌清单（44 个，tokens.css L59-97）

- 间距 6 档：`--space-1/2/3/4/6/8`（4/8/12/16/24/32px）
- 字号 6 档：`--font-size-1..6`（12/13/14/16/20/24px）；行高 `--line-height-1/2/3`（1.25/1.4/1.5）；字重 `--font-weight-regular/medium/semibold`（400/500/600）
- 表格：`--table-row-h`（40px）、`--table-row-h-compact`（36px）
- 圆角 `--radius-1/2/3`（4/8/12px）；描边 `--border-1`（1px）/`--border-strong`；阴影 `--shadow-1/2`
- 颜色 12 个语义名：`--color-bg / surface / surface-raised / text / text-muted / border-subtle / border / primary / success / warning / danger / info`（全部 var() 引用骨架值，无新色值字面量；`--color-primary:var(--fg)`，例外 E1）
- 按钮：`--btn-h-inline`(28) / `--btn-h`(32) / `--btn-h-dialog`(36)、`--btn-hit-min`(32px)、`--focus-ring`（2px primary，offset 2px 由类提供）
- 骨架原始名（`--fg` 等）仅旧页面兼容（例外 E2）；超出口径名单的骨架变量新代码禁用（例外 E3）。

## 三、按钮三级类名（ConsoleButton `size` API 向后兼容）

| 级 | size | 高度令牌 | 类名 |
|---|---|---|---|
| 行内 | `sm` | `--btn-h-inline`(28) | `px-3 text-xs` |
| 常规 | `md` | `--btn-h`(32) | `px-3.5 text-sm` |
| 对话框 | `lg` | `--btn-h-dialog`(36) | `px-4 text-sm` |

共同：`minWidth:var(--btn-hit-min)`、`focus-visible:[outline:var(--focus-ring)] focus-visible:outline-offset-2`、禁用态保留文案 + `aria-disabled`（例外 E4：行内档命中区由 40px 行高容器保障）。

## 四、表格行高与数字列规则（table-density.css）

- 选择器锚 `[data-tab]`（ConsolePane 契约），不触 modules tsx。
- `tbody>tr` 高 `var(--table-row-h)`=40px；子表（`.duty-trend-table`、嵌套 `table table`）`var(--table-row-h-compact)`=36px。
- 单元格 `padding-inline:var(--space-3)`；`padding-block:0 !important` + `line-height !important` 为 40/36 契约必需（DS utility 压过普通规则，实测无 important 时 th 计算高 50px）。
- 表头 12px / 500 / `--color-text-muted`；数字列 `.tabular-nums` → 右对齐 + `font-variant-numeric`。
- 斑马纹：基线无条纹背景源，规则以注释留位（禁则生效）。
- 375px：`#duty-trend-table` 补 `overflow-x:auto`；其余列表基线已有横滚壳（mdl4-*-scroll 等）。

## 五、未覆盖项（冻结已知缺口）

1. **th 数字列右对齐**：th 无类名可锚，需改 `modules/*ModulePage.tsx` 类名，越出 CSS-only 写域，待主控裁决（td 已生效）。
2. **类名式 `.console-table` 迁移**：本仓真实表格锚点为 `modules/*ModulePage.tsx` 13 处 `<table>`，如需精确控制另立任务。
3. **英文顶栏重复模块名**：由设计车道③ `resolve-page-title.ts` 覆盖（console-shell 路径不渲染重复标题，中文面包屑在页头），无 CSS 遗留。
4. 侧栏定宽用 `#app-sidebar:has(#hermes-console-nav-heading):not([class*="lg:w-14"])` 锚定，折叠态（lg:w-14）有意豁免。

## 六、工程坑备查

- CSS 注释内不得出现 `*/` 字面组合（含 glob 写法），否则 lightningcss/rolldown 提前闭合注释致 build 红。
- 验证须 `vite build` 重定向后独立取退出码；管道后 `echo $?` 取的是 tail 的码（假绿坑）。
- specialist 交付以 commit+push+`ls-remote` 验真为准。
