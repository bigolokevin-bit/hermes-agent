# Q9 样板页 1440/375 对照出证 — DONE

任务：值班台（三 KPI 等高 + AgentFleetRail）与员工列表两个样板页的 1440/375 对照证据；断言口径 = 卡高 176±1、单行 ellipsis、无文本溢出、字号 ⊆ 6 档（12/13/14/16/20/24px）。
分支：`task/Q9-sample-compare`，基线 `42dcd7983f56ec39fbdaf5aac92841b6b1816d38`（origin/lane/hermes-console 当拍现取）。
写域：`web/src/modules/**`（实际触及 duty.css / employees-density.css / EmployeesModulePage.tsx）。

## 取证环境

- 本机自建只读脸：v4_proxy，`SEAKOI_V4_DIST=<worktree>/hermes_cli/web_dist`，端口 9125，BFF 上游 127.0.0.1:8092（现网）；9122 未动。
- 登录态：opsadmin-evidence-login → `~/.seakoi/opsadmin-token.txt`，cookie `access_token_cookie` 注入域 127.0.0.1；前置断言 `/agent-api/api/employees` = **200**（原始输出 `precondition /employees = 200`）。
- 取图：playwright（channel:chrome，deviceScaleFactor 2，domcontentloaded + 2.5s settle），视口 1440×900 / 375×812。
- 原始指标全量 JSON：`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/q9-metrics.json`（修复后轮）。

## 四张对照图

- `docs/_artifacts/q9-sample-compare/q9-duty-1440.png`
- `docs/_artifacts/q9-sample-compare/q9-duty-375.png`
- `docs/_artifacts/q9-sample-compare/q9-employees-1440.png`
- `docs/_artifacts/q9-sample-compare/q9-employees-375.png`

## 断言原始输出（前 → 后）

### ① 值班台三 KPI 等高

- 1440：`.duty-grid-3` kids 前 `[220,220,220]` → 后 `[222,222,222]`，`ai=stretch`，`tc=381.3px×3` ✓ 等高。
- 375：`tc=341.5px`（**单列堆叠**，kids `[151,237,151]` 为三个独立行，行内等高不适用）✓ 口径证明。
- 次级 `.duty-grid-2` 1440 `[382,382]` ✓；下部 grid-3 1440 `[163,163,163]` ✓。

### ② AgentFleetRail 卡高 176±1

- 1440：`.duty-fleet-card` = `{h:176,w:320}×3` ✓（规格 ≥1281 档 320×176）。
- 375：`{h:160,w:260}×3` ✓（≤375 档 260×160，duty.css 几何三档条款）。

### ③ 员工列表页

- 该页是**表格页**，桌面 markup 无 176px 卡片（行壳 `min-height: var(--table-row-h)`=40px，employees-density.css）——「员工列表卡高 176±1」在本页无对应对象，如实记录；等高档适用对象为顶部统计行：1440 `sm:grid-cols-3` kids 前 `[76,76,76]` → 后 `[75,75,75]` ✓；375 单列 `tc=341.5px`（堆叠）。
- 375 行尾单元格 `[35,16,22,16,16,16,16,44]` 为移动端 data-label 堆叠布局，非溢出。

### ④ 单行 ellipsis

- duty：truncate 元素 30 个，全部 `white-space:nowrap` + `text-overflow:ellipsis`，9 个真实裁切（如 `duty-fleet-name` "QA2 契约验证 17948" sw174/cw98 cut=true）✓ 生效。
- employees @1440：3 个 truncate 均 sw==cw（无内容需裁）✓；@375 「全部」chip sw26/cw0 cut=true（折叠筛选器内正常裁切）。

### ⑤ 无文本溢出

- 两页 × 两档 `docScrollW == vw`（1440/1440、375/375）✓ 无横向滚动。
- leaks 清单全部为 **sw−cw==2px 的容器 scrollbar-gutter/border 伪影**（含 shell 祖先层，无一例文本级溢出）。

### ⑥ 字号 ⊆ 6 档（本拍修复项）

- 根因：`html{font-size:var(--theme-base-size)}`（index.css，本机 15px 主题档）使一切 tailwind rem 工具类离阶；duty.css 另有 ~47 处字面量（9px/11.5px/12.5px/0.6–1.05rem/1.4/1.5/1.9rem 等）。
- 修复：duty.css 全部字面量映射到 `var(--font-size-N)`；`.duty-page`/`.employees-page` 页根内加 tailwind 工具类中和条款（text-xs→12、text-sm→13、text-base→14、text-xl→20、`.font-mono`→12）与页根基准 14px。employees 页根新增 `employees-page` 类。
- 前（@1440 duty）：`{9:8, 10.2:18, 10.5:44, 11.1:24, 11.25:9, 11.5:4, 11.7:16, 12.3:8, 12.5:1, 13.13:2, 15:77, 15.75:1, 21:4, 28.5:6}`
- 后（duty）：`{12:174, 13:3, 14:74, 15:6, 16:1, 20:4, 24:12, 13.13:2}`；后（employees）：`{12:45, 13:19, 14:50, 15:6, 20:1, 13.13:2}`。
- **模块页根以内已全部落阶**；残留 15px×6 + 13.13×2 全部是 shell 祖先元素（`console-tab`×2 / `console-tablist` / `pane` / 布局 wrapper），位于 `web/src/shell/**` 与全局主题，超出本拍写域。

## 残留与后续工单（建议）

1. shell 页签条 `console-tab` 13.13px、tablist/容器壳继承 15px：需 shell 域一单（同「页根中和」配方，或工具类直换令牌）。
2. 全局主题根字号 15px 不在 6 档内：属主题设计面，建议 L0 裁定是否并档（影响全站 rem 刻度，本拍未动）。

## 验证门（原始读数）

- `vitest run src/modules/employees src/modules/duty`：**23 files / 219 tests 全过**（19:34）。
- `tsc -b . --noEmit`：全仓 49 错（= 基线 49，duty/employees 模块 **0** 错）。
- `vite build`：**EXIT=0**（5.64s）。
- 环境注：期间邻居车道回收了 `forks/console-ui2` 检出；本 worktree node_modules 符号链接已改指主 fork（`pnpm-lock.yaml` blob 两侧同为 `5b993274a3432863665378a898e04bc9c05e9e3e`，依赖等价，未做任何 install）。
