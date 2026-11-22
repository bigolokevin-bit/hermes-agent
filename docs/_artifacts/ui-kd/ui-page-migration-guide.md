# 页面迁移指南 · UI-F 框架层（令牌 + 基元）

交付车道：`lane/console-design`｜接线笔 `b2905d5dfc`｜基元层首笔 `906c8c2415`（L0 并入 `943838f77a`）
**令牌冻结线：2026-11-23T20:57+08:00**（自 `b2905d5dfc` 提交时刻 +24h）。冻结后新增/改名令牌须走 L0 裁决，不许页面自造。

## 0. 唯一真值源（接线已生效，不是「文件已建」）
- 真值全部在 `web/src/styles/tokens.css`（164 行 / 93 条定义：骨架原名 + UI-A 语义名 + 页面契约 `-ls` 别名）。
- `web/src/shell/tokens.css` 只剩 3 行：注释 + `@import "../styles/tokens.css";`，`--*:` 定义数 = 0。`App.tsx:223` 的旧引用因此仍然有效，页面不需要改 import。
- 计算样式自证（同一 `#/knowledge`，登录态）：改前 9122（entry `index-DuhonhGE.js`）7 个 `-ls` 名全为空串；改后我的构建 9126（entry `index-Cm_kToHo.js`）`--space-ls-3=12px`、`--color-text-muted-ls=#ffe6cbad`、`--table-row-h-ls=40px`、`--focus-ring-ls=2px solid #ffe6cb`、`--font-size-ls-2=13px`、`--tabular-ls=tabular-nums`、`--z-ls-dropdown=60`，逐项等于其壳层同义值。

## 1. 页面只用 `-ls` 语义名（骨架原名禁止上页面）
| 用途 | 用这个 | 不要再写 |
|---|---|---|
| 面色/面色抬升/凹陷 | `--color-bg-ls --color-surface-ls --color-surface-raised-ls --color-sunken-ls` | `#041c1c` 等十六进制、`--panel` |
| 文字三级 | `--color-text-ls --color-text-muted-ls --color-text-subtle-ls`（更弱 `--color-text-faint-ls`） | `rgba(255,230,203,.68)`、`--fg-2` |
| 描边三级 | `--color-border-subtle-ls --color-border-ls --color-border-strong-ls`、`--border-ls-1` | `1px solid rgba(…)` |
| 语义色 | `--color-primary-ls --color-success-ls --color-warning-ls --color-danger-ls --color-info-ls` | `#4ade80`/`#ffbd38`/`#fb2c36` |
| 间距 4-8-12-16-24-32 | `--space-ls-1/2/3/4/6/8` | 裸 px 间距 |
| 字号阶梯 | `--font-size-ls-1..6`（表格正文 = `-2` 13px） | `0.76rem` 之类自造档 |
| 行高/字重 | `--line-height-ls-1/2/3`、`--font-weight-ls-regular/medium`（600 禁） | `bold`、`1.45` |
| 表格行高 | `--table-row-h-ls` 40 / `--table-row-h-compact-ls` 36（仅嵌入子表） | 自定义行高 |
| 控件高度/命中区 | `--control-h-ls` 32 / `--control-h-inline-ls` 28 / `--control-h-dialog-ls` 36 / `--hit-min-ls` | 给钮补高（rubric E4） |
| 数字对齐 | `font-variant-numeric: var(--tabular-ls)` | 只右对齐不等宽 |
| 层级 | `--z-ls-sticky/dropdown/overlay/dialog` = 1/60/70/80 | 裸 `z-index: 9999` |
| 动效 | `--duration-ls-fast/base/slow` + `--ease-ls-standard`（`prefers-reduced-motion` 已归零） | 写死 0.3s |
| 焦点 | `outline: var(--focus-ring-ls); outline-offset: var(--focus-ring-offset-ls)` | `outline: none` |
| 禁用 | `opacity: var(--opacity-disabled-ls)` | 改颜色假装禁用 |

## 2. 四类脏写法的替换映射（L0 盘上现查计数）
| 旧写法 | 计数 | 换成 |
|---|---|---|
| 原生 `<select>` | 8 处 / 6 文件 | `import { UiSelect } from "@/components/ui"`（自绘触发器 + `role=listbox`，多选传 `string[]`，`label/hint/error` 内置，trigger `data-testid=<id>-trigger`，error `<id>-error`）。**不要**用设计系统的 `Select`：它渲染原生 `<select>`（`SelectOptionProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>,"onChange">`，`value` 只能 string），直接违反「禁原生 select」。 |
| 内联 `style={{…}}` | 84 处 | 令牌类：表格横滚用 `.ui-scroll-shell`（rubric §5：375 只允许容器内横滚）、面板用 `.ui-panel`、状态块用 `.ui-state*`、数字列 `class="is-numeric"`、粘性头 `is-sticky`、紧凑档 `is-compact`；确需一次性尺寸先在 `web/src/components/ui/ui.css` 加令牌类，别在页面写数。 |
| `.tsx` 内十六进制色 | 11 个文件 | 上表 `--color-*-ls`。颜色只从令牌层取；缺色报 L0，不自造。 |
| 各模块手写 `<table>` + 自造行高 | 32 页仅 12 处统一表格 | `UiTable`（`data-testid="ui-table"`）：`columns=[{key,label,width?,numeric?,render?}]` + `rowHeight="regular"|"compact"` + `sticky` + `striped?`（默认关，禁无义斑马） + `empty=<StateBlock>`。数字列自动 tabular + 右对齐。 |

## 3. 基元清单与用法（每类一条示例）
```tsx
import { UiButton, UiInput, UiTextarea, UiSelect, UiTable, StateBlock,
         Badge, Card, CardContent, Dialog, DialogContent, Tabs, TabsList, TabsTrigger } from "@/components/ui";

<UiButton variant="secondary" onClick={run}>重试</UiButton>            {/* primary|secondary|danger|ghost */}
<UiInput value={q} onChange={setQ} placeholder="按名称搜索" />
<UiTextarea value={note} onChange={setNote} aria-label="备注" />
<UiSelect id="kn-range" options={opts} value={range} onChange={setRange} label="时间窗" />
<UiTable columns={cols} rows={rows} rowHeight="compact" sticky empty={<StateBlock tone="empty" title="这个筛选没有留下内容" detail="清掉筛选就能看见全部条目" />} />
<StateBlock tone="loading" title="正在读…" />                          {/* empty|error|loading 同一个出口 */}
<Badge tone="success">已就绪</Badge>
```
`Button` 的形制映射（写域事实，不是发明）：设计系统 `Button` 只有 `outlined`/`destructive` 两个布尔，没有 `variant`/`icon` 属性 ⇒ `primary`=都不给、`secondary`=`outlined`、`danger`=`destructive`、`ghost`=`outlined`+`.ui-button-ghost`；图标走 children，`iconOnly` 必须由调用方给 `aria-label`。

## 4. 基元缺口（B/C 迁移前先读）
- **无 `Textarea`**：`@nous-research/ui` v0.19.1 包根 79 行导出里没有任何 textarea（`grep -nE "^export" dist/index.d.ts` / `dist/ui/components/textarea|input` / `dist/ui/styles` 三处 grep 全零命中）⇒ `UiTextarea`/`TextareaProps` 是我本地实现，不是漏导。若后续包真加了 textarea，我的本地实现让位，页面代码不改。
- **无 `Table`**：包根完全没有表格导出 ⇒ `UiTable` 是新增实现，这是 32 页只有 12 处统一表格的根因。
- **`Select` 不合格**（见 §2）⇒ 一律 `UiSelect`。
- 断言载体：`web/scripts/token-source-probe.mjs` 在集成脸上不存在（`git cat-file -e origin/lane/hermes-console:web/scripts/token-source-probe.mjs` 失败），所以「真断言」目前由计算样式对照表承担；`web/scripts/**` 不是我的写域，需要谁补谁报 L0。

## 5. duty 裸 id 口径（并入本指南，不再单开零碎修）
- 展示 = **名称 + 末 6 位**；完整 id 收进折叠详情（既有 `duty-expand`/`details` 形制）或复制按钮，永远可取回。
- 映射源只用已加载的会话/渠道列表（`summary.channels` 的 `chat_id → name`）；**映射缺失必须回退展示原 id**，禁止空串或 `—` 掩盖（`—` 只留给「值本身不存在」）。
- 发信人 `ou_…` 在 duty 数据里没有名称源 ⇒ 按规则回退原 id，不做假脱敏。
- `fmtId` 不得对 ≥14 位业务 id 原样返回；行为钉测在 `web/src/modules/duty/format.ts:51-55` + `format.test.ts:21-24`（`web/src/lib/format.ts` 不存在）。写域归 UI-B（`1d42619247`+`9350512648`），本节只定口径。

## 6. 谁迁哪些页（裁决③：我不改页面）
基元与令牌由我维护；页面 owner 在各自写域迁移，一次一页一笔，迁完贴 branch+sha+一行读数。迁移后门禁必须跑：该模块 vitest 腿 + `vite build` rc=0 + 375 逐元素 `boundingRect.right<=376 && left>=-1` 自证。**页面撞到基元缺能力 = A 的缺口**，报我按 ① 的写域补 `web/src/components/ui/**`，不要在页面里手搓绕过。
