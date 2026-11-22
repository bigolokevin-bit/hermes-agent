# 首批页面迁移认领名单（UI-F A 出，脸 facff767e0→7a47010b35 现查）

判据：只算**生产代码**里的真实命中；注释与测试叙述里的字符串不算活。
每行＝一页一 sha 即可开工。归属列为**建议**，最终由 L0 派单（板 docs/governance/** 归 L0）。

## 类别 D：原生 `<select>` → **实测 0 处生产代码，本项直接销账**
`grep -rn '<select' web/src --include='*.tsx'` = 9 行命中，逐行读后全部是注释/测试叙述：
`shell/ConsoleSelect.tsx:3,:10`（两处注释）、`components/ui/Select.tsx:7`（我的注释）、
`modules/audit/audit.select.contract.test.tsx:3,:151`（反向断言「不得出现在 select 上」）、
`modules/audit/audit.filters.test.tsx:15`、`modules/runs/runs.filters.test.tsx:129`、
`modules/approvals/ApprovalsHistoryModulePage.test.tsx:240`、`modules/tasks/TasksBoardModulePage.test.tsx:262`（都在讲 wave-36 已换掉原生 select）。
⇒ 「8 处/6 文件」来自 `grep -c '<select'` 把注释计入。筛选下拉的真实现状 = **ConsoleSelect（自绘 combobox）已统一**，`UiSelect` 是新页可选用基元，**无迁移欠账**。

## 类别 C：屏面 16 进制色（真 11 文件 / 36 处，全不在 modules/**）
| 处 | 文件 | 建议归属 |
|---|---|---|
| 19 | `components/HermesConsoleModal.tsx` | 外壳/旧聊天面 owner（待 L0 点名） |
| 3 | `pages/ChatPage.tsx` | 同上 |
| 3 | `components/ChatSidebar.test.tsx` | 随 ChatSidebar 一并改 |
| 2 | `themes/context.tsx` | 主题注册表（色值合法出口，改判据前先问 L0） |
| 2 | `pages/ModelsPage.tsx` | 旧 Models 面 |
| 2 | `components/ChatSidebar.tsx` | 旧聊天面 |
| 1×5 | `pages/SystemPage.tsx`、`pages/ChannelsPage.tsx`、`pages/ChannelsRelayLink.tsx`、`pages/ChatPage.test.tsx`、`pages/ChatPage.a11y.test.tsx` | 各自页面 owner |
判据：`grep -rlE '#[0-9a-fA-F]{6}\b' web/src --include='*.tsx'`。另：8 位 `#RRGGBBAA` 2 处（含 `modules/employees/EmployeesModulePage.tsx` 1 处），不算本判据命中但同属待清硬编码色。
`web/src/modules/**` 6 位裸色命中 = **0** ⇒ 32 个控制台模块页在这类已无活。

## 类别 A：内联 `style={{`（真 84 处）——按可见收益排序，建议先做前 4 行
| 处 | 文件 | 建议归属 | 换什么 |
|---|---|---|---|
| 22 | `modules/evidence/EvidenceModulePage.tsx` | evidence owner | `.ui-panel` / `.ui-state*` / `is-numeric`；间距走 `--space-ls-*` |
| 19 | `shell/console.tsx` | L4 壳层 | 导航/标签条尺寸用 `--side-ls/--bar-ls`+令牌类，禁内联 |
| 10 | `pages/AnalyticsPage.tsx` | 旧分析面 | 卡片/表格改 `UiTable` + `.ui-scroll-shell` |
| 7 | `modules/employee-detail/EmployeeDetailWorkbench.tsx` | employees owner | `--space-ls-*` + `.ui-panel` |
| 4 | `modules/employee-detail/EmployeeDetailModulePage.tsx` | employees owner | 同上 |
| 4 | `components/ThemeSwitcher.tsx` | 外壳 owner | `--radius-ls-*`/`--space-ls-*` |
| 4 | `App.tsx` | 壳层（L0 令：我不碰） | 容器级 `--color-bg-ls` |
| 3 | `pages/ModelsPage.tsx` | 旧模型面 | `UiTable` + 令牌类 |
| 2×3 | `shell/StatePlaceholder.tsx`、`pages/ChatPage.tsx`、`modules/matrix/MatrixModulePage.tsx` | 各自 owner | `StateBlock` / `UiTable` |
| 1×13 | `shell/ConsoleSelect.tsx`、`shell/ConsoleButton.tsx`、`modules/overview/OverviewPage.tsx`、`modules/org/OrgModulePage.tsx` 等 | 各自 owner | 单点替换，适合填空档 |
判据：`grep -rc 'style={{' web/src --include='*.tsx' | awk -F: '{s+=$2} END {print s}'` = 84。

## 类别 B：手写表格 → `UiTable`（真 12 文件 / 28 处 `<table`）
| 处 | 文件 | 建议归属 |
|---|---|---|
| 8 | `modules/knowledge/KnowledgeModulePage.tsx` | **我（UI-KD）**——已带 `.k3-docs-wrap` 滚壳，可作首批样板 |
| 5 | `modules/metrics/MetricsModulePage.tsx` | console-ui2 |
| 3 | `modules/models/ModelsModulePage.tsx` | models owner |
| 3 | `modules/access/AccessModulePage.tsx` | access owner |
| 2 | `modules/duty/UsagePage.tsx` | UI-B |
| 1×7 | `modules/version/VersionPage.tsx`、`modules/version/VersionHealthSurface.tsx`、`modules/skills/SkillsPage.tsx`、`modules/security/SecurityModulePage.tsx`、`modules/health/SystemHealthSurface.tsx`、`modules/health/SourceMatrix.tsx`、`modules/duty/DutyPage.tsx` | 各自 owner |
迁移动作统一三步：包一层 `.ui-scroll-shell`（375 容器内横滚，rubric §5）→ 数字列 `numeric`（自带 tabular）→ 行高只用 `--table-row-h-ls`(40)/`-compact`(36)，禁自定义。

## 开工优先级建议（一页一 sha）
1. `modules/knowledge/KnowledgeModulePage.tsx`（我，表格最多、滚壳先例已在）
2. `modules/evidence/EvidenceModulePage.tsx`（内联 style 22 处，屏面收益最大）
3. `modules/metrics/MetricsModulePage.tsx`（5 表 + 内联 1 处）
4. `modules/employee-detail/*`（内联 11 处集中在两文件）
5. `modules/access/AccessModulePage.tsx`、`modules/models/ModelsModulePage.tsx`
基元缺能力＝A 的缺口：报我补 `web/src/components/ui/**`，页面 owner 不要自改基元（冻结线 2026-11-23T20:57+08:00 后走 L0 并窗评审）。
