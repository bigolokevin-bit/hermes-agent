# 会话全局搜索：需要一个后端参数（提案，随 SE-06 归档）

## 结论（一句话）

**上游需加 q 或 search 端点**。在此之前，本模块只做「本页筛选」（已加载行的客户端过滤，UI 明写「本页筛选」），不谎称全局搜索。

## 依据

1. `GET /v1/console-sessions` 的 query 白名单只有 `employeeId / limit / cursor`
   （`services/runtime/CONSOLE-SESSIONS-SHAPE.md §2`，BFF `apps/console/server.py` 注释口径：
   白名单外 query 一律丢弃）。
2. 分页是 keyset（`(updated_at, session_id)` 游标），服务端没有 `total`；
   客户端无法从已加载页推断「其余页里是否存在匹配」。
3. 因此任何「搜索全部会话」的 UI 在本代次都是谎报覆盖面 —— 只能在已加载行上筛。

## 需要上游（runtime console-sessions 面）补什么

| 方案 | 形状 | 优点 | 代价 |
|---|---|---|---|
| A. 加 `q` 参数 | `GET /v1/console-sessions?employeeId=&q=&limit=&cursor=` | 复用现有分页与守卫 | 需定义匹配字段（sessionId / 员工内关键字？）与索引 |
| B. 独立 search 端点 | `GET /v1/console-sessions/search?employeeId=&q=&limit=` | 语义清晰，可实现全量命中与排序 | 新路由 + BFF 登记 + 新游标 |

无论 A/B，都需要：① 明确「哪些字段参与匹配」（当前库里只有 sessionId 与 messageCount 可检索）；
② 明确租户/员工作用域（不得跨员工）；③ 明确命中集合的排序与上限；④ BFF 白名单同步放行该参数。

## 本模块当下口径（SE-06 已实现）

- 筛选输入：`data-testid="se6-sessions-filter"`，只筛**已加载**行（sessionId / employeeId 子串，大小写不敏感）。
- 注记：`data-testid="se6-sessions-scope-note"` —— 「本页筛选：只在已加载的 N 条里找；全局搜索待后端支持（上游需加 q 或 search 端点）」。
- 筛不到时：`data-testid="se6-sessions-filter-empty"` 明写「本页已加载的 N 条里没有匹配」，与服务端空集（`se2-sessions-empty`）严格区分。
- 本页筛选**不发新请求**（有测试钉住 `fetchMock` 调用次数）。

## 归属

- 上游参数/端点：runtime console-sessions 面（L2-dataplane 写域）+ BFF 白名单（L7）。
- 提案并入 SE-05-B 同批讨论（backlog §SE-05-B：会话后端形状缺状态机/压缩/搜索/全局重放字段）。
