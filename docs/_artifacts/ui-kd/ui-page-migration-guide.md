# 页面迁移指南 · UI-F 框架层（令牌 + 基元）

交付车道：`lane/console-design`｜接线笔 `b2905d5dfc`｜基元层首笔 `906c8c2415`（L0 并入 `943838f77a`）
**令牌冻结线：2026-11-23T20:57+08:00**（自 `b2905d5dfc` 提交时刻 +24h）。冻结后新增/改名令牌须走 L0 裁决，不许页面自造。

## 0. 唯一真值源（接线已生效，不是「文件已建」）
- 真值全部在 `web/src/styles/tokens.css`（164 行 / 93 条定义：骨架原名 + UI-A 语义名 + 页面契约 `-ls` 别名）。
- `web/src/shell/tokens.css` 只剩 3 行：注释 + `@import "../styles/tokens.css";`，`--*:` 定义数 = 0。`App.tsx:223` 的旧引用因此仍然有效，页面不需要改 import。
- 计算样式自证（同一 `#/knowledge`，登录态）：改前 9122（entry `index-DuhonhGE.js`）7 个 `-ls` 名全为空串；改后我的构建 9126（entry `index-Cm_kToHo.js`）`--space-ls-3=12px`、`--color-text-muted-ls=#ffe6cbad`、`--table-row-h-ls=40px`、`--focus-ring-ls=2px solid #ffe6cb`、`--font-size-ls-2=13px`、`--tabular-ls=tabular-nums`、`--z-ls-dropdown=60`，逐项等于其壳层同义值。

## 1. 页面只用 `-ls` 语义名（骨架原名禁止上页面）

用法映射（先读这张，再查下面的全量令牌表）：



> 下面这张表是机检门 `web/src/components/ui/token-source.test.ts` 的比对对象：左列必须与 `web/src/styles/tokens.css` 的 `-ls` 定义**逐项双向相等**，令牌加了不写表、或表里写了令牌没有，都会红。

**面色、描边、焦点与禁用**

| 令牌 | 真值 |
|---|---|
| `--border-ls-1` | `1px solid var(--color-border-subtle-ls)` |
| `--border-strong-ls` | `1px solid var(--color-border-ls)` |
| `--color-bg-ls` | `--bg`（=#041c1c） |
| `--color-border-ls` | `--line-2`（=rgba(255,230,203,.30)） |
| `--color-border-strong-ls` | `--line-strong`（=rgba(255,230,203,.40)） |
| `--color-border-subtle-ls` | `--line`（=rgba(255,230,203,.14)） |
| `--color-danger-ls` | `--bad`（=#fb2c36） |
| `--color-info-ls` | `--info`（=#7fb3c8） |
| `--color-primary-inactive-ls` | `--fg-3`（=#9aa49e） |
| `--color-primary-ls` | `--fg`（=#ffe6cb） |
| `--color-success-ls` | `--ok`（=#4ade80） |
| `--color-sunken-ls` | `--sunk`（=#03181a） |
| `--color-surface-ls` | `--panel`（=#061f1f） |
| `--color-surface-raised-ls` | `--panel-2`（=#082424） |
| `--color-text-faint-ls` | `--fg-4`（=#8d9791） |
| `--color-text-ls` | `--fg`（=#ffe6cb） |
| `--color-text-muted-ls` | `--fg-2`（=rgba(255,230,203,.68)） |
| `--color-text-subtle-ls` | `--fg-3`（=#9aa49e） |
| `--color-warning-ls` | `--warn`（=#ffbd38） |
| `--focus-ring-ls` | `2px solid var(--color-primary-ls)` |
| `--focus-ring-offset-ls` | `2px` |
| `--opacity-disabled-ls` | `0.56` |

**字体与排版**

| 令牌 | 真值 |
|---|---|
| `--font-family-mono-ls` | `--mono`（=ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace） |
| `--font-family-sans-ls` | `--sans`（=-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,"Segoe UI",sans-serif） |
| `--font-size-ls-1` | `12px` |
| `--font-size-ls-2` | `13px` |
| `--font-size-ls-3` | `14px` |
| `--font-size-ls-4` | `16px` |
| `--font-size-ls-5` | `20px` |
| `--font-size-ls-6` | `24px` |
| `--font-weight-ls-medium` | `500` |
| `--font-weight-ls-regular` | `400` |
| `--line-height-ls-1` | `1.25` |
| `--line-height-ls-2` | `1.4` |
| `--line-height-ls-3` | `1.5` |
| `--tabular-ls` | `tabular-nums` |

**间距、控件尺寸与表格行高**

| 令牌 | 真值 |
|---|---|
| `--control-h-dialog-ls` | `36px` |
| `--control-h-inline-ls` | `28px` |
| `--control-h-ls` | `32px` |
| `--hit-min-ls` | `32px` |
| `--radius-ls-1` | `4px` |
| `--radius-ls-2` | `8px` |
| `--radius-ls-3` | `12px` |
| `--space-ls-1` | `4px` |
| `--space-ls-2` | `8px` |
| `--space-ls-3` | `12px` |
| `--space-ls-4` | `16px` |
| `--space-ls-6` | `24px` |
| `--space-ls-8` | `32px` |
| `--table-row-h-compact-ls` | `36px` |
| `--table-row-h-ls` | `40px` |

**层级与动效**

| 令牌 | 真值 |
|---|---|
| `--duration-ls-base` | `200ms` |
| `--duration-ls-fast` | `120ms` |
| `--duration-ls-none` | `0ms` |
| `--duration-ls-slow` | `320ms` |
| `--ease-ls-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| `--z-ls-dialog` | `80` |
| `--z-ls-dropdown` | `60` |
| `--z-ls-overlay` | `70` |
| `--z-ls-sticky` | `1` |

**阴影**

| 令牌 | 真值 |
|---|---|
| `--shadow-ls-1` | `0 1px 2px rgb(0 0 0 / 40%)` |
| `--shadow-ls-2` | `0 12px 32px rgb(0 0 0 / 55%)` |

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

### 6.1 屏面 16 进制色现查清单（脸 `facff767e0`，2026-11-23 重测）

判据：`grep -rlE '#[0-9a-fA-F]{6}\b' web/src --include='*.tsx'` → **11 文件 / 36 处**。
关键事实：**`web/src/modules/**` 命中 0** —— 32 个控制台模块页已经不含 6 位裸色；
剩下的全在旧聊天/外壳面与主题注册表，所以「按模块页派 owner」这一刀其实没有活，
真正要派的是下面这几处。

| 文件 | 处数 | 迁移归属与写法 |
|---|---|---|
| `web/src/components/HermesConsoleModal.tsx` | 19 | 控制台外壳弹窗（非模块页），单列一刀，换 `--color-*-ls` |
| `web/src/pages/ChatPage.tsx` | 3 | 旧聊天面，随聊天壳一起迁 |
| `web/src/components/ChatSidebar.test.tsx` | 3 | 断言里写死了色值，须与源文件同笔改 |
| `web/src/themes/context.tsx` | 2 | 主题注册表：色值的合法出口，改这里而不是各页面 |
| `web/src/pages/ModelsPage.tsx` | 2 | 旧模型面 |
| `web/src/components/ChatSidebar.tsx` | 2 | 旧聊天侧栏 |
| `web/src/pages/SystemPage.tsx` | 1 | 旧系统面 |
| `web/src/pages/ChannelsPage.tsx` | 1 | 旧渠道面 |
| `web/src/pages/ChannelsRelayLink.tsx` | 1 | 旧渠道中继 |
| `web/src/pages/ChatPage.test.tsx` | 1 | 同 ChatPage 的测试断言 |
| `web/src/pages/ChatPage.a11y.test.tsx` | 1 | 同 ChatPage 的无障碍断言 |

更正（担责）：我早前一轮给过一份以 `modules/…` 为主的 11 文件清单，那份计数取自被并窗打断的中间态，
**作废**，以本表为准。另注：`8 位 #RRGGBBAA` 另有 2 处，其中 1 处在
`web/src/modules/employees/EmployeesModulePage.tsx`，不算本判据命中，但同属待清硬编码色。

## 7. 冻结线后的令牌变更（硬流程，L0 令）

冻结线：**2026-11-23T20:57+08:00**（= 接线笔 `b2905d5dfc` 提交时刻 +24h）。此后：

1. **任何令牌增名 / 改名 / 改真值**：页面 owner 不得自改 `web/src/styles/tokens.css`，也不得自改本文件的契约名表；
   先提 L0，由 L0 并窗评审后统一落笔（写域仍只 `web/src/styles/**` + `web/src/components/ui/**`）。
2. 落笔固定三处同改，缺一即红：`web/src/styles/tokens.css` 定义 → 本文件 §1 契约名表补一行（含真值）
   → 引用它的 `ui.css` / 基元。机检门 `web/src/components/ui/token-source.test.ts` 戊 项做双向核对：
   令牌加了不写表 → 红（计数不等）；表写了令牌没有 → 红（孤行清单非空）。
3. 改名视同一删一增：先加新名并把引用迁完，下一次并窗再删旧名。禁一次性改名——32 页并行必撞。
4. 拿不准命名就贴用例给 L0 定名；**不要**在页面里写 `var(--x, 兜底值)` 造私有名，
   兜底值正是机检门要消灭的「页面自造尺寸」。
5. 冻结线前的唯一例外是 `--duration-ls-none`（L0 点单补的零动效档），走的也是同一条并窗路径。
