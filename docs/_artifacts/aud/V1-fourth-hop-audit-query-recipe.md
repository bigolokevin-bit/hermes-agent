# V1 第四跳审计取证配方（correlation_id → dispatch.event）

- 任务：`task-V1第四跳取证配方`（只读调查，最高优先）
- 日期：2026-11-20（北京时间）
- 车道：`lane/console-aud`（本文档是产物，代码真值在另一检出，见下）
- 纪律执行：只读。未改任何产品码、未写库、未发外部消息、未启停受管服务、未 `POST`（写端点只读代码，不实打）。本文不含任何 token 值。
- 代码与活体真值检出：`/Users/kevin_studio/Projects/seakoi-agent-os-l0-board`（HEAD `2f045efa`）。8101 的监听进程 `pid 81949` 的 cwd 与命令行正是该检出（`ops/domain-dev-server.py`），因此本文行号与实测同源；`console-aud` 本仓没有 `services/runtime/worker.py`。

---

## 结论（四问四答）

1. **8101 的审计读写契约**：E5 查询参数只有 `runId / taskId / actorId / resourceId / action / from / to / limit / cursor`，**没有 `correlationId`**；缺 `X-Tenant-Id` → `400 request.missing_tenant`，只给 `limit` → `400 audit.query_too_broad`。8101 **没有** `/metrics`、`/health` 面（都 404），只有 `/openapi.json`（200，title `EmployeeApi (L1)` v0.1.0）。详表见 §1。
2. **第四跳该怎么查**：`correlation_id` 是库里真实的一列，但**不是可查参数**——实测带上它被静默忽略，退化成 from/to 全量（§2 证据 f）。可行的三条路：**(a) 由 correlation_id 派生 eventId 打 A4 单条（主推，逐字命中）**、(b) `resourceId=<渠道 dedupe key>`、(c) `action=dispatch.event&from=&to=` 后客户端筛 `correlationId`。一条复制即用的查询见 §2。
3. **哪些路径写 `dispatch.event`**：**所有被 worker 取到并处理的事件都写，恰好一条**。唯一写点 `services/runtime/worker.py:489` → `:499`，位于所有分支返回之后的同一收口。**「拒答/未认人路径根本不写」不成立**：代码上未@ 拒答（`worker.py:565-574`）与未认人拒答（`583-595`）都走到 `:489`；活体上现场那条未认人事件确实有一条 `dispatch.event`（§3 逐字段贴出）。
4. **「必须有 run 才有审计」不成立**。`run_id` 只在 run 建单成功后才有值（`worker.py:671`），而审计写在 `:489` 的收口处，与 run 无关；那条活体拒答行 `runId` 字段直接不存在（A4 省略 null 键）。**最小触发条件**：C1 事件入队且被 worker 取到并处理（任一分支，含拒答）+ worker 进程两个 `SEAKOI_AUDIT_*` 环境变量都已配置（缺一即 fail-loud，两个都缺只走日志不落库，`channel_http.py:704-721`）+ 查询带对 `X-Tenant-Id: t_seakoi_pilot`。R1/R2 之后不是前提。

---

## 1 读写契约（实测 + 行号）

服务身份：`GET /openapi.json` → 200 `EmployeeApi (L1)` v0.1.0；`GET /metrics` → `404 {"detail":"Not Found"}`；`GET /health` → 404。落库=SQLite 文件（`ops/domain-dev-server.py:6,128-131`，默认 `~/.local/state/seakoi-ops/domain-dev.db`）。头要求原话（`ops/domain-dev-server.py:19`）：「E1/E5 只需 X-Tenant-Id；P6/P7/P8 必须带与本实例一致的 X-Internal-Token（fail-closed）」。

### E5 列表 `GET /v1/audit/events`（`services/domain/audit_query.py`，210 行；SQL 在 `services/domain/repository.py:1567-1622`）

| 参数 | 语义 | 匹配方式 | 出处 |
|---|---|---|---|
| `runId` | 按 run 查 | `run_id` 列逐字等值 | repository.py:1595-1600 |
| `taskId` | 按任务查 | `task_id` 列逐字等值 | 同上 |
| `actorId` | 按操作者查 | `json_extract(actor,'$.id') = ?` | repository.py:1602-1607 |
| `resourceId` | 按资源查 | `json_extract(resource,'$.id') = ?` | 同上 |
| `action` | 按事件码查 | `action` 列逐字等值 | repository.py:1595-1600 |
| `from` / `to` | 时间界 | `occurred_at >= from AND <= to`（双闭） | audit_query.py D-1 + repository.py |
| `limit` | 页大小 | 整数 1..200，默认 50 | audit_query.py:34-37 |
| `cursor` | 续页 | base64url{recordedAt,eventId}，≤512 | audit_query.py:37 |
| ~~`correlationId`~~ | **不存在此参数**，传入被静默忽略 | 列 `correlation_id` 真实存在但无参数、无索引 | migrations/005_audit_event.sql:29；repository.py:58 |

排序 `recorded_at DESC, event_id DESC`；响应外层键是 **`events`**（**不是 `items`**），末页无 `nextCursor`。

校验顺序（audit_query.py:148-168，实测逐条复现）：

| 条件 | HTTP | code | message |
|---|---|---|---|
| 缺 `X-Tenant-Id` | 400 | `request.missing_tenant` | `X-Tenant-Id is required` |
| `limit` 非 1..200 整数 | 400 | `request.invalid_query` | `limit must be between 1 and 200, got N` |
| `from`/`to` 非 ISO-8601 | 400 | `request.invalid_query` | `from must be ISO-8601` |
| `from` 晚于 `to` | 400 | `request.invalid_query` | `'from' must not be later than 'to'` |
| `cursor` 畸形 | 400 | `request.invalid_query` | `cursor is invalid` |
| 七个筛选项一个都没给 | 400 | `audit.query_too_broad` | `at least one filter is required: runId/taskId/actorId/resourceId/action/from/to` |

`limit` **不算**筛选项，`cursor` 也不算（空串=未提供）。

### A4 单条 `GET /v1/audit/events/{event_id}`

只需 `X-Tenant-Id`。200 返回**扁平的事件对象**（不套 `audit`/`events` 外壳，实测 top keys 见 §4 附录）；跨租户、不存在、畸形 id 统一 `404 audit.event_not_found`。

### A1 写 `POST /v1/audit/events`（以及 `/batch`）

需 `X-Tenant-Id` + `Idempotency-Key` + `X-Internal-Token`；错误码依次为 `request.missing_tenant` / `request.missing_idempotency_key` / `403 request.unauthorized` / `400 request.invalid_body` / `500 audit.write_failed`。openapi 里 body 是 `additionalProperties: true`，字段口径以 `domain_audit.py:build_contract_body` 为准。**本轮未实打**（会写库）。

### 其余审计面（同 openapi，未逐一实打）

`GET /v1/audit/verify?from=&to=`（链校验）、`POST /v1/audit/exports` + `GET /v1/audit/exports/{id}[/download]`、`GET /v1/audit/events/{id}`。

---

## 2 第四跳怎么查（复制即用）

主推（已实打 200，逐字命中一条）。前置：手里有 C1 的 `correlation_id`（`ce_…`，即 worker 写入的 `correlation_id`，`worker.py:503`）。

```bash
CE=ce_01M7VNJZGSRW8JWEG6SFXRJEHX   # 第四跳的 correlation_id（C1 事件行里的 ce_…）
EVID="ev-dispatch-$(CE="$CE" python3 -c "import hashlib,os;print(hashlib.sha256(('dispatch:'+os.environ['CE']).encode()).hexdigest()[:26])")"
curl -sS "http://127.0.0.1:8101/v1/audit/events/$EVID" -H "X-Tenant-Id: t_seakoi_pilot" -o /tmp/v1-fourth-hop.json -w 'HTTP %{http_code}\n'
```

本配方整段复制实打的结果：`EVID=ev-dispatch-179f98cdd0df2f44b481dea9f7` → `HTTP 200`，落盘件里 `action=dispatch.event`、`correlationId=ce_01M7VNJZGSRW8JWEG6SFXRJEHX`、`decision=deny`、`after.reason_code=identity_gate.unknown_sender`。GET 不需要 token。

eventId 派生规则（`services/runtime/domain_audit.py:63-64,84-89`）：`eventId = "ev-dispatch-" + sha256("dispatch:" + correlation_id).hexdigest()[:26]`；前缀 `IDEMPOTENCY_KEY_PREFIX = "dispatch:"`（同文件 :46）。**`[:26]` 是承重的**：用 24 位算出的 id 实打返回 `404 audit.event_not_found`。

备用一（知道 dedupe key 时，一条 curl）：`resourceId` 要的是 `resource.id`，对 `dispatch.event` 就是渠道 dedupe key（`worker.py:504`），**不是** `ce_…`。

```bash
curl -sS -G "http://127.0.0.1:8101/v1/audit/events" \
  --data-urlencode 'resourceId=feishu:cli_aa7fa29bceb95c16:om_selftest_1795151199:message_created' \
  -H "X-Tenant-Id: t_seakoi_pilot"                                # 实打 200，events n=1
```

备用二（一段时间内全量，客户端按 correlationId 收口）：`from`/`to` 用 ISO-8601，库里存的形状是定长毫秒 Z（`2026-11-20T05:06:41.143Z`），比对双闭，两端都带。

```bash
curl -sS -G "http://127.0.0.1:8101/v1/audit/events" \
  -d 'action=dispatch.event' -d 'from=2026-11-01T00:00:00Z' -d 'to=2026-11-21T00:00:00Z' -d 'limit=5' \
  -H "X-Tenant-Id: t_seakoi_pilot" \
  | python3 -c "import sys,json;print([(e['eventId'],e.get('correlationId')) for e in json.load(sys.stdin)['events']])"
```

为什么不能「按 correlation_id 查」：参数不存在。实测 `?correlationId=ce_01M7VNJZGSRW8JWEG6SFXRJEHX&from=…&to=…` → `200 n=50`，返回的 `correlationId` 里混着 `probe3`、`probe_ou_selftest_sender_0001` 等无关行——它没筛，只是退回了 from/to。要服务端筛它，得改 E5（新参数 + `correlation_id` 加索引），不在本配方范围。

---

## 3 写侧：哪些路径写 `dispatch.event`

唯一写点：`services/runtime/worker.py:499`（`"action": "dispatch.event"`）在 `_dispatch_audit_event()` 里；调用它的是 `_handle_one` 末尾的 `worker.py:489`——位置在 `try/except` 包住 `_process(ev, facts)` **之后**，所以任何一条被取到并处理的事件都恰好落一条，不重不漏。

| 分支 | 出口行号 | 写不写 | decision / reason_code | run_id |
|---|---|---|---|---|
| A 群里未 @ 机器人 | worker.py:565-574 | 写 | not_applicable / `addressing_gate.group_without_bot_mention` | null |
| B 未认人（unknown sender） | worker.py:583-595 | 写 | deny / `identity_gate.unknown_sender` | null（`:602` 在 return 之后） |
| C policy deny | worker.py:603-613 | 写 | deny | null |
| D 需审批 approval_required | worker.py:617-632 | 写 | require_approval | null 或已建单值 |
| E1/E2 外发（allow / send-gate） | worker.py:711-722，`:711/769/791` 的 `_audit_before_send` | 写 | allow | 有 run 时=run_id |
| F 租约丢失 / 异常 | worker.py:467-488 | 写 | failure 形状 | 视发生点 |

逐字段形状（`domain_audit.py` 的映射，不是调用方想写什么就写什么）：`sourceSystem` "runtime_worker" → 契约枚举 `"runtime"`（:52）；`actor` 强制 `{"type":"system","id":"runtime-worker"}`（:54，绝不写调用方身份）；`responsibleUnresolvedReason="system_job"`（:58）；`outcome` 仅当 disposition ∈ `_FAILURE_DISPOSITIONS` 才 failure；错误细节走 `ERROR_MESSAGE_REDACTED`（:59-61，原文不入审计）。

活体双证（现场那条未认人事件，A4 实打 200 的原文，2026-11-20T05:06:41.143Z）：

```
eventId   ev-dispatch-179f98cdd0df2f44b481dea9f7   action dispatch.event
sourceSystem runtime        actor {"type":"system","id":"runtime-worker"}
correlationId ce_01M7VNJZGSRW8JWEG6SFXRJEHX        decision deny
outcome success             responsibleUnresolvedReason system_job
resource {"type":"channel_event","id":"feishu:cli_aa7fa29bceb95c16:om_selftest_1795151199:message_created"}
after {"disposition":"unknown_sender_guided","reason_code":"identity_gate.unknown_sender"}
runId —— 键不存在（A4 省略 null 键）
```

接线开关（决定「有没有这一行」的真正因素）：`services/runtime/channel_http.py:704-721` —— `SEAKOI_AUDIT_DOMAIN_BASE_URL` 与 `SEAKOI_AUDIT_INTERNAL_TOKEN` **两个都配**才用 `DomainAuditSink`（真写库）；只配一个 → `ValueError` fail-loud；两个都不配 → `LoggingDispatchAuditSink`（worker.py:449，只打日志，库里永远 0 条）。`SEAKOI_WORKER_SEND_GATE` 只管 P1 外发策略，与审计落库无关。已存在的取证脚本 `scripts/v1-four-hop-capture.sh:150-165` 用的正是 `action+from/to+limit` 这条形状。

---

## 4 现场两笔异常的对账（都能复现）

| 现场报告 | 复现结果 | 真实原因 |
|---|---|---|
| `GET ?resourceId=<ce_...>` → 200 items=0 | 200，`{"events":[]}` | 两处错位：① `resourceId` 比的是 `resource.id`（dedupe key），`ce_…` 在 `correlation_id` 列；库里 `resource LIKE 'ce_%'` 命中 **0** 行。② 响应外层键是 `events`，不是 `items`，按 `items` 取数永远读不到。 |
| `GET ?limit=5`（不带 from/to）→ 400 | 400 `audit.query_too_broad`；若再省掉 `X-Tenant-Id` 则先 400 `request.missing_tenant` | `limit` 不是筛选项（audit_query.py:148-168 的第七条门），且参数校验先于筛选项校验。 |

取证时的其它硬事实：活体 dev 库当前只有一个租户 `t_seakoi_pilot`，`audit_event` 共 166 行，其中 `dispatch.event` 11 行，`correlation_id LIKE 'ce_%'` 5 行（截至 2026-11-20T05:27Z）。`correlation_id` 无索引，别指望服务端按它筛。

A4 实打 200 的 top keys（供写解析的人对齐，别猜外壳）：
`eventId schemaVersion tenantId occurredAt recordedAt sourceSystem actor action resource outcome responsibleUnresolvedReason decision after correlationId`

---

## 5 最小触发条件（若按「必须有 run」的口径来定）

不需要 run。按上面证据，取证链条只要三步：

1. 让 C1 事件入队并被 worker 取到（`ops/` 那侧 ack 即可，任何分支都算），前提是 worker 进程两个 `SEAKOI_AUDIT_*` 都已配置；
2. 拿这条事件的 `correlation_id`（C1 事件行里的 `ce_…`）；
3. 用 §2 主推那条 curl 打 A4（或对不上时用 dedupe key / action+窗口）。

若目标是「有 run 的完整一跳」，那才要走到 `worker.py:671`（run 建单成功）之后，此时同一行 `dispatch.event` 会带上 `runId`；审批 R1/R2 只影响 `decision`/`policyDecisionId`/`approvalId` 字段，不影响这行存在与否。

---

## 6 未做的事与边界

未实打任何写端点（`POST /v1/audit/events`、`/batch`、`/exports` 的契约全部读码而得）；未写库、未改任何产品码、未启停受管服务；未发任何外部消息；未打印任何 token（`SEAKOI_DOMAIN_INTERNAL_TOKEN` / `SEAKOI_AUDIT_INTERNAL_TOKEN` 的值只作为「必须配置」的口径引用）。本文所有 `path:行号` 都指 `/Users/kevin_studio/Projects/seakoi-agent-os-l0-board` 那份检出；若合入别的工作树，行号需要重核。
