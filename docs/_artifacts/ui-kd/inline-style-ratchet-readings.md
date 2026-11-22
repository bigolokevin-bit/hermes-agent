# 内联 style 棘轮门读数（双口径）

生成方式＝脚本按脸现算（不手填）：`python3` 递归 `web/src`，逐行匹配 `style={`（全形制）与 `style={{`（字面量），排除 `*.test.tsx`。
口径来源＝L0 令（wave-165 之后：「基线换双口径」）＋用户写进 `~/.config/opencode/AGENTS.md`「车道迁移判据两坑」＋`docs/governance/CONSOLE-ACCEPTANCE.md` §5 第 18/19 条。
闸门本体＝`web/src/components/ui/inline-style-ratchet.test.ts`（双口径笔 sha `b1b9033b5a`，已在集成脸 `e8d9295318` 上，内容判据：`BASELINE_FULL`/`BASELINE_LITERAL`/`EXEMPT_FILES`/`blindSpots` 命中 4/4/3/3）。

## 1. 现算读数（脸 `e8d9295318`，2026-11-23）

| 项 | 值 |
| --- | --- |
| 全形制 `style={` 命中（**钉这个**） | 65 |
| 字面量 `style={{` 命中（参考值） | 61 |
| 台账盲区（全形制 − 字面量） | 4 |
| 命中文件数 | 16 |
| 扫描面 | 非测试 .tsx 154 个（含测试 .tsx 另 373 个，已被排除） |
| `web/src/shell/console.tsx` | 0（恒 0，L4 已清 19 处） |

基线只允许下调（冻结线 `2026-11-23T20:57+08:00` 之后不得回升）。旧「单口径 ≤65（按 `style={{`）」结论已被 L0 上述令取代：字面量口径会漏换行的 `style={` 与 `style={变量}` 两种形制。

## 2. 全形制负债分布（按处数降序，含归属）

| 处数 | 文件 | 归属 |
| --- | --- | --- |
| 22 | `modules/evidence/EvidenceModulePage.tsx` | ui-b（已迁完 22→0，见脸） |
| 10 | `pages/AnalyticsPage.tsx` | 无人认领：需 L0 派单 |
| 7 | `modules/employee-detail/EmployeeDetailWorkbench.tsx` | 页面 owner |
| 4 | `modules/employee-detail/EmployeeDetailModulePage.tsx` | 页面 owner |
| 4 | `App.tsx` | L4（动前须 L0 裁决） |
| 3 | `pages/ModelsPage.tsx` | 页面 owner |
| 3 | `components/ThemeSwitcher.tsx` | ui-b（已迁完） |
| 2 | `shell/StatePlaceholder.tsx` | 页面 owner |
| 2 | `pages/ChatPage.tsx` | 页面 owner |
| 2 | `modules/matrix/MatrixModulePage.tsx` | 页面 owner |
| 1 | `shell/ConsoleSelect.tsx` | 页面 owner |
| 1 | `shell/ConsoleButton.tsx` | 页面 owner |
| 1 | `modules/overview/OverviewPage.tsx` | 页面 owner |
| 1 | `modules/org/OrgModulePage.tsx` | 页面 owner |
| 1 | `lib/chat-copy-last-button.tsx` | 页面 owner |
| 1 | `components/LanguageSwitcher.tsx` | 待派 |

## 3. 运行时值豁免表（形制迁移 ≠ 清偿）

这 4 处是台账盲区：字面量口径看不见它们。它们的值来自运行时测量或用户主题调色板，**不可令牌化**，因此按 AGENTS.md 规矩必须在回报里明写「内联仍在」，且不计入已清偿。

| 站点 | 形制 | 为何不可令牌化 | 状态 |
| --- | --- | --- | --- |
| `components/ThemeSwitcher.tsx:128` | 换行 `style={` + 三元表达式 | 下拉位置取自运行时测量（`window.innerHeight - rect.top + 4`、`rect.left`），枚举成 `-ls` 类=把测量结果写死，弹层会错位 | 内联仍在（豁免，不计清偿） |
| `components/ThemeSwitcher.tsx:294` | `style={fontPreviewStyle(f)}` 变量形制 | `f.stack` 是任意 CSS 字体栈串（见 `web/src/themes/fonts.ts`）；动态类名会被 Tailwind 扫描器漏掉而 purge，字体预览直接失效 | 内联仍在（豁免，不计清偿） |
| `components/ThemeSwitcher.tsx:323` | `style={swatchCellStyle(color)}` 变量形制 | 色块取自每主题调色板（含用户 `~/.hermes/dashboard-themes/*.yaml`），枚举 `-ls`＝破坏自定义主题预览 | 内联仍在（豁免，不计清偿） |
| `components/LanguageSwitcher.tsx:117` | 换行 `style={` + 三元表达式 | 与 ThemeSwitcher 同一形制的弹层定位：值来自 `getBoundingClientRect()` 与视口高度，不是视觉尺度 | 内联仍在（豁免，不计清偿） |

已迁的两个 helper（`swatchCellStyle`、`fontPreviewStyle`）只返回运行时值，内部无 hex、无尺寸字面量——这一条由 ui-b 车道的 `theme-switcher.inline-style.test.ts` 钉住（该页字面量 4→0）。

## 4. 正向牙齿证明（两把都真跑过）

棘轮门（全形制口径）：临时新增 `web/src/__ratchet_probe.tsx`，内含一处 `style={box}`（变量形制，字面量口径抓不到）：

```
AssertionError: 全形制现算 66 处，基线 65 处（脸 451621e760；字面量口径 61 处）: expected 66 to be less than or equal to 65
AssertionError: 未登记的换行/变量形制站点（台账盲区只能落在已核过的豁免面）：__ratchet_probe.tsx:3: expected [ '__ratchet_probe.tsx:3' ] to deeply equal []
Tests  2 failed | 3 passed (5)
```

删除 scratch 后：`Test Files 1 passed (1); Tests 5 passed (5)`。另用行号级自证说明该例不是空转：扫描面断言首版阈值写坏（`>200`，真值 154）时该例直接红。

UiTabs 键盘语义（同一提交批次）：临时在 `Tabs.tsx` 的 `onKeyDown` 里短路（`if (true) return;`）→ `Tests 3 failed | 2 passed (5)`，红在「焦点必须跟着方向键走」「ArrowRight 首尾环绕」「expected 'ui-tabs-tab-config' to be 'ui-tabs-tab-runs'」；还原后 `4 files / 19 tests` 绿。

## 5. 门禁读数

- `cd web && node_modules/.bin/vitest run src/components/ui` → **4 files / 19 tests passed**（token-source 5 + StateBlock.internalid 4 + inline-style-ratchet 5 + Tabs.keyboard 5）。
- `node_modules/.bin/vite build` → rc=0（我车道未部署 dist；现役脸 entry 以 aud/L0 现查为准）。
- 全量 `pnpm exec vitest run`：读数随本笔回执给出（L0 侧基线 486 files / 3583 tests；本腿预期 +1 文件/+5 例）。
- 已知环境腿 `src/shell/e1Contract.test.ts` disk==served：在未部署 worktree 必然背离，判环境不判 diff，不复制其形制到本门（本门不启服务、不读 `hermes_cli/web_dist/**`）。

