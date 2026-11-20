# 复用盘点 C：自研 table / form / dialog / chart 与已装 OSS 的重叠

盘点日期：2026-11-20  
仓库：`forks/console-gov`（分支 `lane/console-gov`，基线 `3c7f70f6` / 代码代次 `cca9cf7e`）  
范围：`web/src/modules/**`、模块直接引用的项目组件（`web/src/components/**`）与 `web/src/pages/AnalyticsPage.tsx`  
判据：**同一处至少可省 200 行，才建议换 OSS**；不足 200 行一律不换，避免为换而换。

## 现查 OSS 事实

- `web/package.json`：`@nous-research/ui` **0.19.1**、`@observablehq/plot` **0.6.17**。
- `@nous-research/ui` 实际组件目录：`src/ui/components/{animated-count,badge,bottom-sheet,button,card,checkbox,command-block,confirm-dialog,dialog,dropdown-menu,input,label,list-item,progress,segmented,select,spinner,switch,tabs,toast,grid,graphs}`。
- **没有 Table / DataTable / Textarea 组件**；`Grid` 是布局网格，不是数据表。
- 现成可用且与本盘点相关：`Dialog*`（Radix portal / focus / overlay）、`ConfirmDialog`、`Input`、`Select`、`Checkbox`、`Switch`、`Label`、`ListItem`、`BottomSheet`、`BarChart`、`LineChart`。
- `BarChart` / `LineChart` 是 `@observablehq/plot` 包装（`Plot.rectY` / `Plot.lineY`、`useDims`、crosshair、响应式），适合普通柱/折线；**不是热力图，也不是任意 SVG 图形替代品**。
- `@observablehq/plot` 存在，但 `web/src/modules/**` 没有直接 import；模块几乎只从 UI 包取 `Badge / Button / Card / CardContent`。
- `web/src/modules/**` 当前共 **25 处原生 `<table>`**；没有模块 import UI `BarChart` / `LineChart` / `Dialog` / `Select` / `Input` / `Checkbox` / `Switch` / `Grid`。

## 逐处评估

| 自研文件与行数 | 对应 OSS 件与实际可用性（现查 node_modules 存在与导出） | 预估可省行数 | 建议 | 风险（样式、a11y、行为差异） |
|---|---|---:|---|---|
| `modules/metrics/MetricsModulePage.tsx`（3114 行；5 张原生表 + 自定义 SVG sparkline 约 48 行） | 无 Table；`BarChart`/`LineChart` 存在，但热力图与逐槽 sparkline 不是其等价物 | 表 0；sparkline 约 30–40 | 不换 | 换表会丢 `met6-*`/`metK-*` testid、内部横滚、空态与行详情；sparkline 是自定义槽位图，Plot 会改视觉与 a11y |
| `modules/knowledge/KnowledgeModulePage.tsx`（2670 行；`RowTable` 47 / `RecordsTable` 68 / `SpaceTable` 119 / `DocTable` 81 / `SearchDocTable` 76 / `TaskTable` 73） | 无 Table / DataTable；Card、Grid 不能替代表格语义 | 0 | 不换 | 每张表都绑定业务列、缺失原因 title、testid 与 720px 堆叠规则；无 OSS 表可接 |
| `modules/knowledge/KnowledgeModulePage.tsx` → `DocPreviewDrawer`（214 行） | `Dialog*` 与 `BottomSheet` 存在；可替换 portal/focus/Escape 外壳 | 约 80–120 | 不换 | 业务详情、文档预览布局占主体；中心 Dialog 与侧边抽屉交互不同，a11y 焦点顺序需重做，仍不足 200 行 |
| `modules/health/SystemHealthSurface.tsx`（379 行；1 张服务表 + 行详情） | 无 Table；`Card`/`Badge` 只能做壳 | 0 | 不换 | 表头排序/筛选/计数同源、`sys3-*`/`sys4-*` testid 与详情行均是自研语义 |
| `modules/health/SourceMatrix.tsx`（262 行；1 张读源矩阵） | 无 Table；`BarChart` 不适用 | 0 | 不换 | 真实排序、`aria-sort`、复制/CSV 行序、`sys6-*`/`sys8-*`/`sys10-*` 全绑定在这张表 |
| `modules/access/AccessModulePage.tsx`（640 行；角色/管理员/高风险 3 张表） | 无 Table；`Badge`/`Button` 已用 | 0 | 不换 | 角色展开、同体 403/404、响应式堆叠与 `ac3-*`/`adm5-*` testid 不可丢 |
| `modules/security/SecurityModulePage.tsx`（234 行；1 张高风险表） | 无 Table | 0 | 不换 | 只读、原因 title、请求号复制均绑定行结构 |
| `modules/models/ModelsModulePage.tsx`（586 行；目录/单价/账本 3 张表） | 无 Table；`Card` 只能分区 | 0 | 不换 | 单价与账本严格分区、asOf 与未知「—」语义都在表头/行内 |
| `modules/skills/SkillsPage.tsx`（459 行；1 张技能表） | 无 Table | 0 | 不换 | 排序/搜索/导出/复制/行详情/键盘 roving 共用同一行模型 |
| `modules/version/VersionPage.tsx` + `VersionHealthSurface.tsx`（237 + 189 行；3 张表） | 无 Table | 0 | 不换 | 版本、构建时刻、单价与健康行均为只读证据表，testid 稠密 |
| `modules/duty/UsagePage.tsx`（517 行；2 张用量表） | 无 Table | 0 | 不换 | 日期窗、金额/未知口径与响应式表内滚动不能由 Card 替代 |
| `modules/tasks/TaskCreateForm.tsx`（284 行） | `Input` / `Select` / `Checkbox` 可用；可替换少量原生控件 | 约 20–40 | 不换 | 表单状态、校验、提交与错误映射占主体；换壳只减少量 JSX，收益低于 200 |
| `modules/approvals/ApprovalsPendingModulePage.tsx`（405 行） | `Input` / `Select` / `Checkbox` / `Dialog` 可用 | 约 20–50 | 不换 | 审批业务、权限、确认对话框与错误态占主体；换控件不改变结构 |
| `modules/approvals/ApprovalsHistoryModulePage.tsx`（421 行） | 同上 | 约 20–50 | 不换 | 历史筛选、分页、行详情与状态语义为主，控件替换收益小 |
| `modules/knowledge/KnowledgeModulePage.tsx` → `DocumentNameSearch`（224 行） | `Input` 可用 | 约 5–15 | 不换 | 仅一个原生 input；搜索态、高亮、roving 与异步建议才是主体 |
| `web/src/components/ConfirmDialog.tsx`（122 行；审批页使用） | `ConfirmDialog` 存在且导出；Radix focus/escape 完整 | 约 80–100 | 不换 | 可整体替换但不足 200；现有 API（destructive/loading/title/description）与调用点需逐项对齐 |
| `web/src/components/DeleteConfirmDialog.tsx`（40 行） | `useConfirmDelete` / `ConfirmDialog` 可用 | 约 30–40 | 不换 | 不足 200；换用会改变确认交互与文案挂载点 |
| `web/src/components/ModelPickerDialog.tsx`（708 行） | `Dialog` / `Input` / `Checkbox` / `ListItem` / `Spinner` 可用；仅通用 modal 壳可换 | 约 60–100 | 不换 | 两阶段选择、搜索排序、RPC/REST 双模式与网关状态都是业务；换壳不动主体 |
| `web/src/components/SkillEditorDialog.tsx`（216 行） | 已使用 `Dialog` / `Input` / `Label` / `Spinner` | 0 | 不换 | 已经是 OSS 壳；剩余为 SKILL.md 编辑与校验业务 |
| `modules/overview/OverviewPage.tsx` → `Trend`（约 80 行，CSS 柱状） | `BarChart` 存在 | 约 40–60 | 不换 | 现有柱高/失败说明/空态/加载态与 `ov5-*` 绑定；Plot 会改视觉与 tooltip a11y |
| `modules/duty/DutyPage.tsx` → `TrendCard`（约 68 行，SVG polyline） | `LineChart` 存在 | 约 40–50 | 不换 | 现有 SVG 尺寸/坐标与空态测试固定；换 Plot 不足 200 且有视觉回归风险 |
| `web/src/pages/AnalyticsPage.tsx` → `TokenBarChart`（约 80 行，自定义条） | `BarChart` 存在 | 约 40–60 | 不换 | 不在 modules 写域，且为现有页面视觉基线；不足 200 |

## 结论

- 候选 **22 处**（按文件/组件归并；原生表 25 张按文件归为 10 组）。
- 建议换 **0 处**：没有任何单处能达到「省 200 行」门槛。
- 根因不是 OSS 不足，而是本仓自研表承担了诚实时态、缺失原因、请求号、响应式堆叠、稳定 testid 与业务列语义；已装 UI 包没有通用 DataTable，图表包装也不覆盖热力图/槽位图。
- 后续若引入通用表组件，应先以 `SourceMatrix` 或 `SkillsPage` 为试点，单独评估行为与 a11y，不应在本轮直接替换。