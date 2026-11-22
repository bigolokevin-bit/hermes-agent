# B2 对勾表 · approvals（审批：待处理 + 历史）

- **日期**：2026-11-23
- **车道**：aud（console-aud）。队列条目 UI-P2（板 main 96cefddf 起工前已标记 `[x] aud 04:00 lane/console-aud`）。
- **口径**：纸面活；只读取证，表交后才动 `web/src/modules/approvals/**`。所有证据行号=实开文件核对 `file:line`；严重度与九项口径同 `docs/governance/UI-QUALITY-UPGRADE.md`（严重度定义同 :13）。
- **范围注**：参考件里该页 = `web/docs/console-v4-skeleton.html` 待处理 pane（chips :3323、排序标注 :3331、批量卡 :3408-3415、锚点 :3487）+ 历史 pane（filterbar :3543-3546、分页读数 :3571）；现行面 = `web/src/modules/approvals/**` + App.tsx 挂载行（:190-198/:374-376）+ routes.ts 注册（:155-158）。
- **严重度**：P0=参考有现行完全没有或明显回归；P1=现行有但功能残缺/行为不一致；P2=细节差异。

## 一、九项对勾表

### 1. 筛选

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 待处理 chips | :3323 `data-fview-btn=all/mine/release`（全部待办/我发起的/配置发布） | ApprovalsPendingModulePage.tsx:484-570 折叠面板 `apv-filter-toggle`(aria-expanded)/`apv-filter-panel` + `apv8-search` + actor/risk/since quick filters + `QUEUE_SHORTCUTS` 快捷 | ✅ | —（现行超出参考） |
| 历史搜索+下拉 | :3543-3546 `filterbar` + `search inp` + 两个 `select sel` | ApprovalsHistoryModulePage.tsx:439-567 `apv-h-filter-toggle/apv-h-filter-panel` + chips `apr5-filter`；常驻 `FilterSummary` 芯片可移除、URL 持久化 | ✅ | —（现行超出参考） |

### 2. 排序

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 列表排序 | :3331 仅静态标注「按等待时长排序」（无交互钮）；历史 :3550 无排序控件 | QueueSortBar.tsx:53-126 四列 `apv-sort-title/status/risk/time` aria-sort 三态（升→降→清除），缺值恒排末；`QueueMetaNotes` 明注「仅在当前已加载 N 条内排序」 | ⚠️ 部分 | **P1：本地排序非服务端**，且与参考隐含的「按等待时长」服务端排序期望形制不一致 |

### 3. 分页

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 分页 | :3571 静态「第 1 / 7 页」读数（无控件）；待处理无 | Pending :720-760 `apv-page-more`「加载更多」+ `apv-page-count` 计数句 + `apv-page-end`；History :690-731 附加聚合视图说明 | ⚠️ 部分 | **P1：游标续取 vs 参考「第 N/M 页」形制不一致**（现行模式更适配长尾，但与参考不符，需 L0 裁决以哪个为准） |

### 4. 批量

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 批量操作 | :3408-3415 「批量操作」card：选择预算类 / 选择低风险 / 清空；标注高风险不可批量 | **现行完全无**：无 checkbox、无多行选取、无批量通过/驳回（仅详情抽屉逐单决策） | ❌ 缺失 | **P0（本表最大缺口）**：参考有整套批量选择区，现行零实现；「高风险不可批量」规则亦无载体 |

### 5. 深链

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 深链 | :3487 `#/approvals?tab=pending` tab 级锚点；无 id 级单条粘链 | PermalinkCopy.tsx:20-73 `apd10-permalink` 全参数粘链（tab/view/id/asort/adir/q/actor/since/risk/state/status）+ `?state=` 五态复现 + 旧 `?tab=mine/release/policy` 兼容映射（routes.ts:155-158、App.tsx:190-198/:374-376） | ✅ | —（现行超出参考） |

### 6. 空态

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 空态 | 参考无 | states.tsx:175-217 `apr5-empty`/`apv-state-empty`（icon+reason+nextStep+刷新/清筛选/返回/联系管理员出口）+ 四类局部 `apv-risk-empty/apv-since-empty/apv-actor-empty/apv8-search-empty` + `apv-state-clear`；测试 Pending .test.tsx:832-849、History .test.tsx:1172-1195 | ✅ | —（现行新增能力） |

### 7. 错误态

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 错误态 | 参考无 | states.tsx:219-256 `apr5-error`（role=alert + sentence + `apv-state-rid` 可复制 + 详情折叠 + 重试）；:259-277 `apr5-denied`（403/404 专用） | ✅ | —（现行新增能力） |

### 8. 加载

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 加载骨架 | 参考无 | states.tsx:162-173 `apr5-loading` 4 行 animate-pulse 骨架卡 | ✅ | 形态为 Card 轮廓非文字线条碎片——P2 细节 |

### 9. 键盘

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 键盘导航 | 参考无约定（纯 `<button type="button">`，无 tabindex/kbd） | views.tsx:121-151 roving tabindex `apr5-row-${key}`（↑↓Home/Enter 预览/Space 详情/Esc 收起）；筛选/排序变化焦点回退首行；a11y 测试 approvals.a11y.test.tsx:191-207、History .test.tsx:1414-1511 | ✅ | —（现行新增能力；⚠️ 全局 ⌘K/`g o` 层属 shell 写域=候裁项，不在本表记缺） |

## 二、缺项汇总

| 严重度 | 项 | 一句话 |
|---|---|---|
| **P0** | 批量操作 | 参考 :3408-3415 有批量选择区（预算类/低风险/清空，高风险禁批量），现行零实现——本表最大缺口 |
| P1 | 排序本地降级 | QueueSortBar 仅已加载行内排序，与参考服务端排序期望不一致 |
| P1 | 分页形制不一致 | `apv-page-more` 游标续取 vs 参考「第 1/7 页」静态读数 |
| P2 | 加载形态 | Card 轮廓骨架 vs 典型线条骨架（参考本无，纯细节） |

**总体判定：5✅（筛选/深链/空态/错误/键盘，其中四项超参考）+ 3⚠️（排序/分页/加载）+ 1❌P0（批量）**。

## 三、纪律

- 本表为纸面只读取证；**表交后才动 `web/src/modules/approvals/**`**；批量 P0 是否补做、按哪个形制（参考批量卡 vs 其它页先例）请 L0 路由。
- 证据行号均来自实开文件核对；未实测的运行时行为不写结论。
- 不自签全绿；375 总 PASS 放行权归 UX 总审。
