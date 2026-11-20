# UI-RUBRIC — 令牌清单与评审表

版本 v1（2026-11-20）。适用范围：Agent 控制台 v4（22 Tab / 51 路由，**IA 与路由计数不得变更**）。
本文件是 UI-A（基础层）的施工依据，也是 UI-QA 每 20 分钟一拍的唯一评分口径。

---

## 一、设计令牌清单（UI-A 冻结目标）

令牌落在 `web/src/shell/tokens.css`（唯一来源）。任何页面不得自造数值；确需例外须在本文件登记并写明理由。

### 1. 间距（4 的倍数，唯一允许值）

`--space-1: 4px` · `--space-2: 8px` · `--space-3: 12px` · `--space-4: 16px` · `--space-6: 24px` · `--space-8: 32px`

- 行内元素间距：`--space-1` / `--space-2`
- 卡片内边距：`--space-4`；卡片间距：`--space-3`
- 区块（section）间距：`--space-6`；页面上下留白：`--space-8`
- 禁止出现 6/10/14/18/20/28 等非清单值（含 padding/margin/gap）

### 2. 字号阶梯（固定 6 档）

| 令牌 | 值 | 用途 |
|---|---|---|
| `--font-size-1` | 12px | 辅助、表头、元信息 |
| `--font-size-2` | 13px | 表格正文、表单标签 |
| `--font-size-3` | 14px | 正文默认 |
| `--font-size-4` | 16px | 卡片标题 |
| `--font-size-5` | 20px | 区块标题 |
| `--font-size-6` | 24px | 页面主标题（每页至多一个） |

行高：正文 `--line-height-3: 1.5`；表格 `--line-height-2: 1.4`；标题 `--line-height-1: 1.25`。
字重仅允许 400 / 500 / 600；禁用 700。

### 3. 表格

- 行高：`--table-row-h: 40px`（紧凑档 36px 仅用于嵌入子表）
- 单元格左右内边距：`--space-3`；首尾列与卡片边缘对齐 `--space-4`
- 表头：`--font-size-1`、字重 500、`--color-text-muted`、下边框 1px
- 数字列一律 `font-variant-numeric: tabular-nums`
- 行分隔线只允许 1px `--color-border-subtle`；禁斑马纹与行内阴影

### 4. 圆角 / 描边 / 阴影

`--radius-1: 4px`（徽标、输入）· `--radius-2: 8px`（按钮、卡片）· `--radius-3: 12px`（对话框）
`--border-1: 1px solid var(--color-border-subtle)` · `--border-strong: 1px solid var(--color-border)`
阴影仅两档：`--shadow-1`（卡片浮起）与 `--shadow-2`（对话框/下拉）；禁多层叠加与彩色阴影。

### 5. 颜色语义（只允许语义名，不直接写 hex）

`--color-bg` / `--color-surface` / `--color-surface-raised` / `--color-text` / `--color-text-muted` / `--color-border-subtle` / `--color-border` / `--color-primary` / `--color-success` / `--color-warning` / `--color-danger` / `--color-info`
深浅两套必须同名词：切换主题只换值，不改类名。

### 6. 数字与时间

- 所有金额、计数、百分比：`tabular-nums`
- 时间统一 `YYYY-MM-DD HH:mm`（本地时区），相对时间只用于「最近活跃」列并提供 title 绝对时间
- 超过 4 位数字用千分位；空值一律「—」（导出 CSV 保持空字段）

### 7. 按钮三级与状态

- primary（每屏至多一个主操作）/ secondary / ghost
- 高度：32px（默认）/ 28px（行内）/ 36px（对话框主操作）
- 禁用态保留文案，`aria-disabled` 与 `title` 说明原因
- 所有可点控件最小命中区 32×32，键盘焦点环 `2px var(--color-primary)` + 2px offset

---

### 例外登记（UI-A，随令牌层施工追加）

- **E1 `--color-primary: var(--fg)`** — 骨架无独立强调色相；值班台主次靠「实底 vs 描线」承载（`ConsoleButton` primary 即 cream 实底 + `--bg` 反色文字）。语义层如实映射，不改视觉。
- **E2 骨架原始名（`--bg/--fg/--line/--r/--r-sm` 等）保留为值源与旧页面兼容**，不算页面自造值；其中 `--r:6px` **不入**圆角档（档位以 `--radius-*` 为准）。旧页面迁移属 shell 项，不在令牌项内。
- **E3 骨架超出口径名单的变量（`--sunk/--line-3/--line-strong/--fg-3/--fg-4/--serif`）** 仅供既有页面读值；新代码禁用，浅主题落地时在本层覆盖。
- **E4 行内档按钮高 28px 不强行补到 32px 命中区**（补高会破坏三档比例）：命中区由容器保障——表内行高 40px 天然 ≥32px 目标，宽度下限用 `--btn-hit-min`；`ConsoleButton` 焦点环为 `--focus-ring`（2px primary + 2px offset）。

## 二、UI-QA 评审表（每 20 分钟一拍）

对**当拍有变更的页面**出 1440 与 375 两档截图，按下表 8 维打分（1–5，整数），总分 = 加权和（满分 100）。

| # | 维度 | 权重 | 5 分判据 | 1 分表现 |
|---|---|---|---|---|
| 1 | 层级（Hierarchy） | 20 | 一眼看出主任务，标题/内容/辅助三层分明 | 全页同权重、无视觉入口 |
| 2 | 留白（Whitespace） | 15 | 间距全部落在令牌清单，疏密有节奏 | 拥挤或大片死白、非清单值 |
| 3 | 对齐（Alignment） | 15 | 左边缘成列、数字右对齐、基线一致 | 参差、居中混排 |
| 4 | 表格密度 | 10 | 40px 行高、表头区分、数字等宽 | 行高不一、斑马纹、换行断字 |
| 5 | 重复信息 | 10 | 同一信息屏上只出现一次 | 顶栏与标题重复、同一错误三处并存 |
| 6 | 主次按钮 | 10 | 每屏一个 primary，次操作降级 | 多个同级主按钮、危险操作无区分 |
| 7 | 状态完整 | 10 | 加载/空/错误/无权限/会话过期各有专态 | 空白页、技术话术上屏、无 rid |
| 8 | 一致性（跨页） | 10 | 同类控件跨页同形同尺寸 | 各页自造下拉/按钮/间距 |

扣分项（直接计入总分扣减，各 −5）：非令牌间距值、裸内部 id 或技术话术上屏、375 档横向滚动（表格除外且须有容器内滚动）、焦点不可见、新增可见 Tab。

### 缺陷条目格式（进 board）

```
[UI-QA] <页面>·<维度>·<1440|375> — <一句现象> → <一句改法> (sev: P1/P2/P3, 截图: <文件名>)
```

- P1：阻断主任务或明显错位；P2：观感/一致性；P3：打磨项
- 每条缺陷必须附截图文件名与**既有 testid 或元素定位**，不写「优化一下」
- 分数 < 80 或出现任一 P1 的页面，当拍必须开缺陷单；缺陷改完由 UI-QA 复拍并在条目后追加 `→ 复拍 <分数>`

## 三、纪律

- 只动表现层：`web/src/shell/**`、`web/src/styles/**`、`*.css`、`web/index.html`；**不改** `App.tsx` 路由注册表、`modules/**/*.tsx` 业务逻辑、testid 命名
- 22 Tab / 51 路由计数不变；不新增可见 Tab
- 令牌变更只允许在 `tokens.css` 与 `<style>` 层，禁页面内联魔法值
- 每次改动须附 1440 + 375 截图（after），落 `docs/_artifacts/ui-qa/<page>-<viewport>.png`