# V1 四跳可执行取数手册（只读）

用途：在真实群里 @ 一次机器人之后，用一条命令把「入站 → worker → 出站 → 审计」四跳按同一个 `event_id` 串起来取证，并判定 C1 权威门是否生效。
配套脚本：`docs/_artifacts/gov/V1-FOUR-HOP-RUNBOOK.sh`（本手册每条命令都在脚本里，且本次已实跑）。

## 0. 基线与只读纪律

- 作业机：mac-015（Mac Studio）。链路进程均为**已在跑的 dev 进程**，本手册**不启停任何服务**。
- 只读口径：
  - sqlite 一律 `file:<db>?mode=ro`，绝不写 `c1-events.db` / `runtime-dev.db`；
  - 日志只 `grep` / `tail`；HTTP 只 `GET`（C1 读口、8101 审计读口）；
  - token **只从 pid 9570 的进程 env 取名字与取值供 curl 使用，绝不回显**（脚本打印的是长度，不是值）；
  - 不发真实群消息、不点卡片、不调任何写口（`/ack`、`/retry` 等由 worker 自己调，人工不碰）。
- 当前实测拓扑（读口证据见 §5）：
  - `127.0.0.1:8100` = C1 channels（pid 32113，`ops/c1-dev-server.py`）
  - `127.0.0.1:8642` = hermes gateway（pid 45692，`hermes gateway run`）
  - `127.0.0.1:8101` = domain / 审计域（pid 81949，`ops/domain-dev-server.py`）
  - pid 9570 = `python -m services.runtime.scheduler`，stdout/stderr → `~/.local/state/seakoi-ops/dispatch-worker.err.log`
- 工作位与员工：`oc_0adeac8168d48d413693f1e64a330db5` → `emp_86A81CE8FF6F42E187BCF2B540`（已绑）。
- 已知唯一缺口：identity_link 未解（`resolve` 对 `415g466e` 仍 `unknown=true`）。因此本手册**预期**在 hop4 看到 `decision=deny` + `after.reason_code=identity_gate.unknown_sender`；看到它不算失败，它是缺口的证据。

一键起用：

```bash
cd /Users/kevin_studio/Projects/forks/console-gov
bash docs/_artifacts/gov/V1-FOUR-HOP-RUNBOOK.sh --gate          # 只看门（hop0）
bash docs/_artifacts/gov/V1-FOUR-HOP-RUNBOOK.sh --latest       # 最新事件四跳 + 门
bash docs/_artifacts/gov/V1-FOUR-HOP-RUNBOOK.sh ce_<26 位>     # 指定事件四跳
bash docs/_artifacts/gov/V1-FOUR-HOP-RUNBOOK.sh --env-names 9570   # 只列变量名，不列值
```

## 1. 四跳逐跳判据表

| 跳 | 读数源 | 取数命令 | 通过判据 | 取不到 → 写什么、交给谁 |
|---|---|---|---|---|
| **hop0 门** | `~/.local/state/seakoi-ops/hermes-gateway.log` + gateway pid env 变量名 | `V1-FOUR-HOP-RUNBOOK.sh --gate` | 门开：env 有 `SEAKOI_C1_AUTHORITATIVE`；群消息触发后 `local_reply_suppressed` ≥1 | env 无该变量 → 写「门关闭（代码默认 off），本次四跳是双脑风险下的读数」交**运维道**；读不到 `hermes-gateway.pid` → 写 `MISSING: gateway pid 文件` 交**运维道** |
| **hop1 入站** | `c1-events.db` 表 `channel_event` | `sqlite3 "file:$HOME/.local/state/seakoi-ops/c1-events.db?mode=ro" "SELECT event_id\|\|' \| '\|\|status\|\|' \| '\|\|event_type\|\|' \| '\|\|chat_type\|\|' \| '\|\|external_message_id\|\|' \| '\|\|received_at FROM channel_event ORDER BY received_at DESC LIMIT 5;"` | 新行存在；`event_id` 形如 `ce_` + 26 位；`status` ∈ `accepted/dispatched/processing/done`；**群 @ 时 `content.mentions` 非空** | 无新行 → 先查 hop0 的 `Dropped a group message`（消息死在适配器，从未进 C1）→ 写「hop0 拦截，hop1 空」交**网关道**；有行但 `mentions` 空 → 写「@ 未被解析成 mentions」交**网关道**（`SEAKOI_BOT_MENTION_IDS` 与飞书 mention id 是否一致） |
| **hop2 worker** | `dispatch-worker.err.log` + `runtime-dev.db` 表 `agent_run` | `grep -c "$EV" dispatch-worker.err.log`；`grep "$EV/ack"`；`sqlite3 "file:...runtime-dev.db?mode=ro" "SELECT count(*) FROM agent_run WHERE channel_event_id='<EV>';"` | ack 行 = 1（领到并收尾）；`agent_run` 有行 = 建了 run；run 行数 0 但 ack=1 → worker 在**门前**拒了（认人/寻址 deny 不建 run） | ack=0 且 pending 轮次全是「（空批）」→ 写「worker 从未领到该事件， lease/队列 未派发」交**调度道**；ack=0 且 pending 有该 id → 写「领到但未收尾，查 `attempt_no`/`lease_until`」交**调度道** |
| **hop3 出站** | `c1-events.db` 表 `channel_outbound` | `sqlite3 "...?mode=ro" "SELECT outbound_id\|\|' \| '\|\|status\|\|' \| '\|\|intent_key\|\|' \| '\|\|COALESCE(sent_at,'NULL')\|\|' \| attempts=' \|\|attempts\|\|' \| '\|\|COALESCE(last_error,'') FROM channel_outbound WHERE intent_key LIKE '%<EV>%';"` | `intent_key` 内嵌同一 `ce_`（形如 `guide:ce_…` / `giveup:ce_…`）；`status=sent` 且 `sent_at` 非空 = 真送达 | 无行 → 写「hop2 deny 后未产生出站意图（预期于 identity 缺口）」交**认知道**；`status=dead_letter` → 抄 `last_error` 原文交**渠道道**（本次即此支：`feishu.send: http=400 code=230001 invalid receive_id`）；`sent` 但内容不对 → 交**渠道道** |
| **hop4 审计** | 8101 `GET /v1/audit/events/{eventId}` | 见 §3 的 aud 车道逐字配方 | HTTP 200 且 `correlationId == <EV>`；`resource.id == hop1 的 dedupe_key` | HTTP 404 `audit.event_not_found` → 用 §3 备查 E5（`resourceId=<dedupe_key>`）反查；E5 也空 → 写「审计零行」并查 worker env 是否有 `SEAKOI_AUDIT_DOMAIN_BASE_URL` **和** `SEAKOI_AUDIT_INTERNAL_TOKEN`（缺一即落 `LoggingDispatchAuditSink`，永远 0 行）交**审计道** |

字段口径备注（避免误读）：
- `channel_event.dedupe_key` = `channel:app_id:external_message_id:event_type`，是**跨跳唯一可靠连接键**（hop4 的 `resource.id` 就是它）。
- `agent_run` **没有 `correlation_id` 列**（实查报 `no such column`），只有 `channel_event_id`；用错列名会得到假空。
- worker 日志的 httpx 行**不含 event_id**（除 `/ack`、`/pending` 路径本身），所以「audit POST 行数」只能给全日志总数，逐事件关联必须走 hop4 审计库。
- `addressing_gate` / `identity_gate` / `dispatch.event` 三个字面量在 `dispatch-worker.err.log` 里实测 **0 行**——deny 的落点是审计库，不是日志。别把「日志没有 gate 字样」读成「门没跑」。
- `channel_outbound.sent_at` 在 `status=sent` 上有 `NOT NULL` 约束；`dead_letter` 要求 `attempts>=5`。所以 `attempts=5 + sent_at=NULL` 的组合是**终态死信**，不是重试中。

## 2. 门是否生效的判别式

命令（脚本 `--gate` 已封装，这里是可手抄的裸命令）：

```bash
OPS="$HOME/.local/state/seakoi-ops"
GWPID="$(cat "$OPS/hermes-gateway.pid")"
lsof -nP -p "$GWPID" 2>/dev/null | grep -c 'TCP 127.0.0.1:8642 (LISTEN)'      # 期望 1
ps eww -o command= -p "$GWPID" | tr ' ' '\n' | grep -oE '^SEAKOI_C1_[A-Z_]+=' # 只看变量名
grep -c 'local_reply_suppressed' "$OPS/hermes-gateway.log"                     # 门开+群消息：≥1
grep -c 'local_reply_fallback'   "$OPS/hermes-gateway.log"                     # 期望 0；>0 = C1 挂了本地兜底
grep -c 'Dropped a group message' "$OPS/hermes-gateway.log"                    # 期望 0；>0 = 群消息从未进 C1
```

判读：
1. **门开关**：`gateway/channel_event_bridge.py:69` 读 `SEAKOI_C1_AUTHORITATIVE`，`:93` 只有值为 `1`/`true`（strip+lower）才算开；且 `:96-107` 还要 feishu 平台 + `SEAKOI_C1_BASE_URL` 已设 + `source.chat_type == "group"`（**私聊 p2p 永不进门**）。
   - 本次实测：gateway env 只有 `SEAKOI_C1_BASE_URL SEAKOI_C1_INTERNAL_TOKEN SEAKOI_C1_TENANT_ID`，**无 `SEAKOI_C1_AUTHORITATIVE` ⇒ 门关闭**。
2. **生效标志**：门开且群消息命中时，`gateway/run_inbound.py:274` 打 `WARNING ... local_reply_suppressed: message_id=... event_id=... reason=c1_authoritative` 并 `return None`（本地不再发话）。期望行数：**每条被抑制的消息 1 行**。
3. **红旗（双脑未消）** —— 一处必要更正：
   - 派工单给的红旗字面量 `[Feishu] Sending response` **在 feishu 适配器里不存在**：全仓 grep 只命中 `plugins/platforms/signal/adapter.py:721`、一处 discord 文档和一个测试 `tests/gateway/test_tool_response_drop_recovery.py`；在 `hermes-gateway.log` 里实测 **0 行**。用它当判据会得到假阴性，**不得用**。
   - 替代判据（两条任一即标红）：
     - 门开时 `local_reply_suppressed = 0` **且** `local_reply_fallback > 0` → C1 投递失败后本地又发话；
     - hop3 同一 `event_id` 出现**两条不同来源**的出站行（C1 一条 + gateway 本地一条）→ 双脑实锤。
4. **0 行不等于通过**：门关闭时 `local_reply_suppressed` 恒为 0，这是「没触发」不是「触发成功」。手册里所有 0 都要和 §2.1 的开关读数一起报。
5. hop0 另有前置阻断：`Dropped a group message` 由 `plugins/platforms/feishu/feishu_admission_diagnostics.py:30` 打出，原因是 group policy = `allowlist` 且该 profile 的 `FEISHU_ALLOWED_USERS` 为空 → **人类群消息在适配器就被拒，C1 与门都看不到**。真实群 @ 取证前必须先排除这一条。

## 3. 时间窗对齐与单 event_id 一次取数

### 3.1 对齐口径
- 四跳只用**同一个 `event_id`** 串：hop1 `channel_event.event_id` → hop2 日志 `.../<event_id>/ack` 与 `agent_run.channel_event_id` → hop3 `channel_outbound.intent_key LIKE '%<event_id>%'` → hop4 `correlationId == <event_id>`。
- 时刻只用**数据里的 ISO**，绝不用本机时钟：hop1 `received_at`、hop3 `sent_at`/`created_at`、hop4 `occurredAt`/`recordedAt` 都是 UTC `...Z`；worker 日志时间戳是**本机 BJT（+8）**。
- 实测换算证据：hop4 `occurredAt=2026-11-20T05:06:41.143Z` 与 hop2 ack 行 `2026-11-20 13:06:41,143` 是**同一瞬间**（差 8 小时，毫秒级吻合）→ 四跳落在同一时间窗。

### 3.2 一次性取数（脚本，推荐）
```bash
bash docs/_artifacts/gov/V1-FOUR-HOP-RUNBOOK.sh ce_01M7VNJZGSRW8JWEG6SFXRJEHX
```
输出即 §5 快照；token 从 pid 9570 env 取，只打印长度。

### 3.3 hop4 查询串（贴 aud 车道配方，逐字，不另造）
配方文件：**`docs/_artifacts/aud/V1-fourth-hop-audit-query-recipe.md`**，位于 aud 车道工作树
`/Users/kevin_studio/Projects/forks/console-aud/docs/_artifacts/aud/V1-fourth-hop-audit-query-recipe.md`（161 行）。
注意：该文件**不在本仓 `console-gov` 的 `docs/_artifacts/aud/` 下**（那边只有 `DONE.md` 与 `shots/`），引用时按上述车道路径。

主查询（A4 按派生 eventId 直取）：

```bash
CE=ce_01M7VNJZGSRW8JWEG6SFXRJEHX
EVID="ev-dispatch-$(CE="$CE" python3 -c "import hashlib,os;print(hashlib.sha256(('dispatch:'+os.environ['CE']).encode()).hexdigest()[:26])")"
curl -sS "http://127.0.0.1:8101/v1/audit/events/$EVID" -H "X-Tenant-Id: t_seakoi_pilot" -o /tmp/v1-fourth-hop.json -w 'HTTP %{http_code}\n'
```

- eventId 推导来自 `services/runtime/domain_audit.py:63-64,84-89`（前缀 `dispatch:` 在 `:46`）：`ev-dispatch-` + `sha256("dispatch:"+correlation_id).hexdigest()[:26]`；**`[:26]` 是承重的，取 24 位得 404**。
- 备查（A4 404 时）：E5 `GET /v1/audit/events?resourceId=<dedupe_key>&action=dispatch.event&limit=20`，外层键是 **`events`** 不是 `items`，返回后**客户端逐行复核** `correlationId`。
- E5 的坑（aud 配方已实证，照抄）：参数只认 `runId/taskId/actorId/resourceId/action/from/to/limit/cursor`，**`correlationId` 不被支持且被静默忽略**；缺 `X-Tenant-Id` → 400 `request.missing_tenant`；不带任何过滤（`limit` 不算过滤）→ 400 `audit.query_too_broad`；排序 `recorded_at DESC, event_id DESC`；`limit` 1..200，默认 50。
- 写入开关：`services/runtime/channel_http.py:704-721` 需要 `SEAKOI_AUDIT_DOMAIN_BASE_URL` **和** `SEAKOI_AUDIT_INTERNAL_TOKEN` 同时在 worker env，否则落 `worker.py:449` 的 `LoggingDispatchAuditSink` → 审计库永远 0 行。本次实测 pid 9570 env **两个都有**（只验名字）。

## 4. 跑不起来的分支（禁编造读数，空结果不当通过）

| 症状 | 判定 | 写什么 | 交给谁 |
|---|---|---|---|
| `sqlite3: ... unable to open database file` | 只读通道断 | 「hop1/hop3 取数失败：db 不可读」+ 原命令 | 运维道 |
| `no such column: correlation_id` | 用错列名 | 不写结论，改查 `agent_run.channel_event_id` | 自查（本手册 §1 备注） |
| `json_group_names()` 报错 | 系统 sqlite 无此函数 | 改用 `SELECT group_concat(key) FROM (SELECT DISTINCT json_each.key FROM channel_event, json_each(content) WHERE event_id='<EV>')` | 自查 |
| hop1 当日 0 行 | 入站未发生 | 「hop1 空：真实群 @ 未进 C1」，并附 hop0 `Dropped` 行数 | 网关道 |
| hop1 有行、`mentions` 空/缺 | @ 未被解析 | 「mentions 空，寻址门会判 `addressing_gate.group_without_bot_mention`（`worker.py:568`）」 | 网关道 |
| hop2 ack=0 且全空批 | worker 未消费 | 「调度未派发该事件」+ 轮次号尾部 3 行 | 调度道 |
| hop2 `agent_run` 0 行 | 未建 run | 先取 hop4：有 `decision=deny` → 写「deny 于认人/寻址，未建 run（预期）」；无审计行 → 写「审计零行」 | 认知道 / 审计道 |
| hop3 无出站行 | 意图未产生 | 「hop3 空：deny 后无出站意图」 | 认知道 |
| hop3 `dead_letter` | 送达失败终态 | 抄 `last_error` 原文 + `attempts` | 渠道道 |
| hop4 404 | 派生 id 不匹配或审计缺失 | 先跑 E5 备查；仍空 → 查两个 AUDIT 开关变量名 | 审计道 |
| hop4 返回 HTML / 非 JSON | 打错端口或走了网关 | 「8101 非 JSON 响应」+ `HTTP 码` 与 `content-type` | 审计道 |
| 8101 不通（curl exit≠0） | 审计域未监听 | 「hop4 不可达」，四跳标 PARTIAL | 运维道 |
| token 取不到（pid 9570 env 无 `SEAKOI_C1_INTERNAL_TOKEN`） | hop1 HTTP 复核不可做 | 「hop1 仅有 sqlite 读数，无 C1 GET 复核」；sqlite 仍是主证，不算失败 | 自查 |

## 5. 本次实测快照（只读，2026-11-20）

时刻全部取自数据字段，不用本机时钟。

- **hop0**：gateway pid 45692，`8642 listening=yes`；env 有 `SEAKOI_C1_BASE_URL SEAKOI_C1_INTERNAL_TOKEN SEAKOI_C1_TENANT_ID`，**无 `SEAKOI_C1_AUTHORITATIVE` ⇒ 门关闭**；`local_reply_suppressed=0`、`local_reply_fallback=0`、`Dropped a group message=1`（`2026-11-12 10:43:48,811`，chat `oc_0adeac8168d48d413693f1e64a330db5`，group policy `allowlist` + `FEISHU_ALLOWED_USERS` 空）。
- **hop1**（UTC 日 2026-11-20 共 3 行，全 `done`）：
  - `ce_01M7VNJZGSRW8JWEG6SFXRJEHX | done | message_created | p2p | om_selftest_1795151199 | 2026-11-20T05:06:39.753Z`，`mentions=[{"externalId":"ou_209311c6390c2b4ff6248125aece895e","name":"sekoi-bot"}]`，`dedupe_key=feishu:cli_aa7fa29bceb95c16:om_selftest_1795151199:message_created`，`sender=ou_selftest_sender_0001/person`，`attempt_no=1`，`lease_until=NULL`
  - `ce_01M7V7GQ703CQ88HMT66SXHS56`（`2026-11-20T01:00:44.568Z`，群 `om_x100b60cdf560b044ce7556363aabf52`，**mentions 空**）
  - `ce_01M7V64F4HRA5ANM0D34SX3T9W`（`2026-11-20T00:36:34.499Z`，群 `om_x100b60cd2fc514a0b491232e26a60f3`，**mentions 空**）
  - ⇒ 今日**没有任何一条真群 @ 带 mentions 进来**。
- **hop2**：ack 行 = 1（`2026-11-20 13:06:41,143 ... POST .../ce_01M7VNJZGSRW8JWEG6SFXRJEHX/ack "HTTP/1.1 200 OK"`）；该事件在日志共 1 行；pending 轮询每秒 1 次且多为「（空批）」；`audit POST` 全日志共 5 行；`addressing_gate=0 identity_gate=0 dispatch.event=0`；`agent_run WHERE channel_event_id=<EV>` = **0 行**，今日 run 总数 **0**。
- **hop3**：该事件出站 1 行、`sent` 0 行 —— `ob_01M7VNK0AMGATN0ZBEK495ZB6D | dead_letter | guide:ce_01M7VNJZGSRW8JWEG6SFXRJEHX | sent_at=NULL | attempts=5 | feishu.send: http=400 code=230001 msg=... invalid receive_id`；今日 `sent` = **0**；最近两条 `sent` 是 `2026-11-17T04:39:40.930Z`（`giveup:ce_01M7AJ3QZ103YGM8FAJR2MRRWH`）与 `2026-11-13T22:18:37.629Z`（`p07-e2e-send-1794608294`）。
- **hop4**：`C1 GET HTTP 200`、`AUDIT GET HTTP 200`、`E5 GET HTTP 200`（1 行命中）。A4 体：`eventId=ev-dispatch-179f98cdd0df2f44b481dea9f7`、`tenantId=t_seakoi_pilot`、`sourceSystem=runtime`、`action=dispatch.event`、`outcome=success`、`decision=deny`、`correlationId=ce_01M7VNJZGSRW8JWEG6SFXRJEHX`（**PASS**）、`resource.id` == hop1 `dedupe_key`（**PASS**）、`occurredAt=recordedAt=2026-11-20T05:06:41.143Z`、`after={"disposition":"unknown_sender_guided","chat_type":"p2p","kb_status":null,"reason_code":"identity_gate.unknown_sender"}`、`actor={"type":"system","id":"runtime-worker"}`、`responsibleUnresolvedReason=system_job`、无 `runId` 键。
- 审计库总量（aud 配方 2026-11-20T05:27Z 的读数，非本次实测）：`audit_event` 166 行 / `dispatch.event` 11 行 / `correlation_id LIKE 'ce_%'` 5 行。

结论（诚实）：四跳**串联成立**（event_id → ack → intent_key → correlationId + dedupe_key 双键互证），但这一条是 **p2p 自检消息**，被认人门 deny，未建 run、未送达（死信于 `invalid receive_id`）。真实群 @ 的端到端仍未证，阻断在 hop0（群消息被适配器丢弃）与 hop1（今日群事件无 mentions）。

## 6. 未验证与边界

- 未做：启停任何服务、改任何产品码、发真实消息、写 C1/runtime 库、跑 `--env-names` 之外的值读取。
- 未验证：`SEAKOI_C1_AUTHORITATIVE=1` 下的 `local_reply_suppressed` 实出行数（门当前关闭）；真群 @ 带 mentions 的 hop1→hop4 全链；identity_link 修复后的 `decision=allow` 路径。
- 只读脚本的副作用：`curl -o` 写 `/tmp/v1-hop1-c1.json`、`/tmp/v1-hop4-audit.json`、`/tmp/v1-hop4-e5.json` 三个临时文件；不写仓库、不写库。
- 引用外部车道文件（`console-aud` 的 aud 配方）时按 §3.3 的车道路径注明，不得声称它在本仓可读。
