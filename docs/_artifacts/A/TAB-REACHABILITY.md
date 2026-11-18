# 22 可见 Tab × hash × 归属模块 × 可达性 — 集成车道逐条点验

- 构建：`36127bab`（含 employees T12 合入）。逐条 `page.goto` 全量加载，原始输出
  `laneA-22tab-rerun.out`（22 行 + unknown 兜底 + fixture 腿），本表为转录汇总。
- 可达性口径：**实页**=有真实内容或诚实错误态；**占位**=规划中占位（[data-planned] 禁用钮 + GAP 文案，不白屏不死链）。

| # | Tab | hash | 归属模块 | 可达性 | 实测证据（bodyLen / activeTab / paneState） |
|---|---|---|---|---|---|
| 1 | 值班台 | `#/overview` | shell→duty | 占位（GAP-01 数据源未落地） | 136 / duty / empty |
| 2 | 用量与成本 | `#/overview?tab=usage` | 复用 AnalyticsPage | 实页 | 842 / usage / ready |
| 3 | 员工列表 | `#/employees` | modules/employees (T12) | 实页（无后端→错误态+请求编号） | 113 / list / ready |
| 4 | 员工矩阵 | `#/employees?tab=matrix` | modules/matrix | 占位 | 140 / matrix / empty |
| 5 | 任务板 | `#/work` | modules/board | 占位（tasks 模块已交付未接线，待 E 车道 manifest） | 100 / board / empty |
| 6 | 运行 | `#/work?tab=runs` | modules/runs | 占位 | 114 / runs / empty |
| 7 | 审批待处理 | `#/approvals` | 复用 ApprovalsPage | 实页（错误态+请求编号+重试） | 92 / pending / ready |
| 8 | 历史决策 | `#/approvals?tab=history` | shell→approvals | 占位 | 106 / history / empty |
| 9 | 人员 | `#/identity` | shell→identity | 占位 | 118 / people / empty |
| 10 | 部门 | `#/identity?tab=departments` | 同上 | 占位 | 115 / departments / empty |
| 11 | 角色 | `#/identity?tab=roles` | 同上 | 占位 | 110 / roles / empty |
| 12 | 知识空间 | `#/knowledge` | shell→knowledge | 占位 | 120 / spaces / empty |
| 13 | 数据源 | `#/knowledge?tab=sources` | 同上 | 占位 | 95 / sources / empty |
| 14 | 引用证据 | `#/knowledge?tab=evidence` | 同上 | 占位 | 123 / evidence / empty |
| 15 | 技能 | `#/capabilities` | 复用 SkillsPage | 实页（大内容） | 3378 / skills / ready |
| 16 | 工具 | `#/capabilities?tab=tools` | 复用 McpPage | 实页 | 10632 / tools / ready |
| 17 | 模型 | `#/capabilities?tab=models` | 复用 ModelsPage | 实页 | 796 / models / ready |
| 18 | 渠道 | `#/capabilities?tab=channels` | 复用 ChannelsPage | 实页 | 3577 / channels / ready |
| 19 | 系统健康 | `#/system` | 复用 SystemPage | 实页 | 33 / health / ready |
| 20 | 默认设置 | `#/system?tab=defaults` | 占位（roView 403 位已备） | 占位 | 134 / defaults / empty |
| 21 | 版本 | `#/system?tab=version` | 占位 | 占位 | 90 / version / empty |
| 22 | 审计事件 | `#/system?tab=events` | 占位 | 占位 | 132 / events / empty |

**22/22 可达、0 白屏**；hidden 详情区（`#/employees/<id>` + 5 zone）另有腿：T01-LIVE-CHECKLIST.md。
未知 hash 兜底：`{"probe":"unknown-fallback","landed":"/overview?profile=default","activeTab":"duty"}` ✓

## T42 · 壳层强制态（同构建复测）

| 腿 | URL | 结果 |
|---|---|---|
| loading | `#/overview?state=loading` | htmlFixture=loading，badge「FIXTURE加载中」，pane data-state=loading ✓ |
| empty | `#/overview?state=empty` | htmlFixture=empty，badge「FIXTURE空态」 ✓ |
| error | `#/overview?state=error` | htmlFixture=error，badge「FIXTURE错误」，请求号渲染 ✓ |
| denied | `#/overview?state=denied` | pane data-state=denied，403≡404 同体文案，请求号渲染；**无 FIXTURE 角标**（权限态非 fixture 降级，符合「角标只在端点确实缺失/强制态」口径） ✓ |

真实数据页无 ?state 时 fixtureBadge=false / htmlFixture=null（5 页实测）——角标不滥挂 ✓。
`?zone=tasks` 深链在 375 与桌面均可达（上表 #/employees/EMP-LIVE-PROBE 腿）。
