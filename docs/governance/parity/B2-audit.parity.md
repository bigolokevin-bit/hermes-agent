# B2 对勾表 · audit（审计事件）

- **日期**：2026-11-23
- **车道**：aud（console-aud）。队列条目 UI-P2（板 main 96cefddf 起工前已标记 `[x] aud 04:00 lane/console-aud`）。
- **口径**：纸面活；只读取证，表交后才动 `web/src/modules/audit/**`。所有证据行号=实开文件核对 `file:line`；严重度与九项口径同 `docs/governance/UI-QUALITY-UPGRADE.md`（严重度定义同 :13）。
- **范围注**：参考件里该页 = `web/docs/console-v4-skeleton.html` 的 `div.pane[data-tab="events"][data-tabname="审计事件"]`（:4620-4769）；现行面 = `web/src/modules/audit/**` + App.tsx 挂载行（:117-118 懒加载 AuditAwareEntry、:501 path "/audit"）。
- **严重度**：P0=参考有现行完全没有或明显回归；P1=现行有但功能残缺/行为不一致；P2=细节差异。

## 一、九项对勾表

### 1. 筛选

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 视图 chips | :4624 `全部事件/异常`（data-fview-host） | 统一筛选整合：AuditEventsModulePage.tsx:126-368 `aud01-filters` + chips `aud-chip-*-clear`（states.tsx:403-417） | ⚠️ 形态不同 | 参考「异常」chips 被现行统一筛选吸收——P2 注记，不判缺失 |
| 关键词搜索 | :4661 `input.inp` | AuditEventsModulePage.tsx:126-368（搜索入统一筛选） | ✅ 齐平 | — |
| 结果/来源下拉 | :4661 两个 `select`（结果 允许/拒绝/待批/降级；来源 gateway/runtime/policy/console） | `aud01-filter-type`(ConsoleSelect)、`aud01-filter-operator`、`aud8-filter-resource` | ✅ 齐平 | —（现行超出参考） |
| 时间窗 | 参考无 | `aud01-filter-window-*` + custom `aud01-custom-from/to` + `audB-apply/clear`；URL `?window/from/to/limit` | ✅ | —（现行超出参考） |

### 2. 排序

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 列排序 | 参考无控件（时间降序硬编码） | AuditEventsModulePage.tsx:608-679 `aud-sort-head-*` 4 列 aria-sort 三态（asc→desc→none），`?asort/?adir`；禁用态 title 给原因 | ⚠️ 部分 | **P1：排序仅在已加载行内本地重排，服务端无排序参数**——形式有、跨页实质受限 |

### 3. 分页

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 分页控件 | :4665 纯文字「12,842 条 · 显示 11」无控件 | AuditEventsModulePage.tsx:2062-2108 `aud2-pagination`（`aud2-page/aud2-total/aud2-prev/aud2-next`）+ `aud01-load-more` + `?cursor` stack + `audH-page-size` 每页选择器 | ✅ | —（现行超出参考） |

### 4. 批量

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 批量操作 | 参考无 | 无 checkbox/多行选取（行有 `aud6-toggle-*` 预览） | ❌ 双缺 | 双缺不计回归；若后续要批量须先补参考出处（P2 观察项，不纳本表范围） |

### 5. 深链

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 事件定位 | :4644-4657 `id=auditLocate` locatecard（hidden+JS 填充+清除锚 `#/audit`）+ :4671 `tr[data-event=…]` 行高亮；无独立详情页 | AuditEventsModulePage.tsx:405-483 `?event=` 三态 `aud9-deeplink-found/checking` + `aud9-event-missing/denied`（rid 可复制）+ `aud9-event-elsewhere`；独立详情页 AuditDetailModulePage.tsx:30-100（`?detail=/?id=`，`aud02-detail-*` + `aud8-back-to-list`） | ✅ | —（现行超出参考） |

### 6. 空态

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 空态 | 参考无 | states.tsx:647-705 `aud01-empty`（服务空+清筛选出口）vs :1976 `aud9-local-empty`（资源本地筛空，双档区分） | ✅ | —（现行新增能力，参考无双缺） |

### 7. 错误态

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 错误态 | 参考无 | states.tsx:707-748 `aud01-error` role=alert + `{testId}-sentence` + `{testId}-request-id-value` 可复制 + 技术详情折叠 + 重试；详情页 `aud02-detail-error` | ✅ | —（现行新增能力） |

### 8. 加载

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 加载态 | :4668 `table.t-t-audit data-loading="1200"`（约定式，无骨架结构） | states.tsx:626-644 LoadingPanel 4×pulse `[0,1,2,3]`；`aud01-loading`/`aud02-detail-loading` 多 slot | ✅ | 形态差异（真骨架 vs 约定属性）——P2 |

### 9. 键盘

| 功能点 | 参考 HTML 证据 | 现行实现证据 | 状态 | 缺项点名+严重度 |
|---|---|---|---|---|
| 键盘导航 | 参考无 | AuditEventsModulePage.tsx:506-595 roving tabIndex `audK-list/audK-row-*`（role=list/listitem，ArrowDown/Up/Home/End/Enter 展开/Escape 收回焦）；类型分布桶 views.tsx:857 onKeyDown | ✅ | —（现行新增能力；⚠️ 全局 ⌘K/`g o` 层属 shell 写域，另见 P0#2 候裁，不在本表记缺） |

## 二、缺项汇总

| 严重度 | 项 | 一句话 |
|---|---|---|
| P1 | 排序本地降级 | `aud-sort-head-*` 仅重排已加载行，服务端无排序参数（AuditEventsModulePage.tsx:608-679） |
| P2 | 异常 chips 整合 | 参考「全部/异常」chips 形态被统一筛选吸收（:4624 vs 现行 aud01-filters） |
| P2 | 加载形态差异 | data-loading 约定 vs 真 pulse 骨架（:4668 vs states.tsx:626-644） |
| — | 批量双缺 | 参考与现行均无，不计回归 |

**总体判定：超配（现行超参考）**。参考件该 pane 只给了筛选 + locatecard + data-loading 三类 affordance；现行九项中七项实装且六项超出参考，唯一实质受限项=排序本地降级（P1）。

## 三、纪律

- 本表为纸面只读取证；**表交后才动 `web/src/modules/audit/**`**。
- 证据行号均来自实开文件核对；未实测的运行时行为不写结论。
- 不自签全绿；375 总 PASS 放行权归 UX 总审。
