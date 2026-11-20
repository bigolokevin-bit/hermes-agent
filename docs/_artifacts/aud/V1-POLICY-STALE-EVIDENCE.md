# V1 第四跳证据汇编：策略门 deny → allow（CR-041）

只读取证，2026-11-20（北京）。数据源全部为本地文件的只读句柄（`mode=ro`）与日志文本，未改任何产品码、未写库、未发消息、未启停服务。
库与代码位置：C1 库 `~/.local/state/seakoi-ops/c1-events.db`（注意文件名有 a）；域库 `~/.local/state/seakoi-ops/domain-dev.db`；代码真值 `/Users/kevin_studio/Projects/seakoi-agent-os-l0-board`（8100/8101 两台的 cwd）。
时间口径：库里存 UTC `Z`；括注为北京时间（UTC+8）。

## ① C1 最近三条 group 事件（chat_type='group'，按 received_at 倒序）

三条都在同一群 `oc_0adeac8168d48d413693f1e64a330db5`，`status` 全为 `done`，`fail_reason` 全空。`mentions` **不是列**，它在 `content` JSON 里。

| event_id | received_at（UTC / 北京） | mentions 存在性 | external_message_id |
|---|---|---|---|
| `ce_01M7VXG30J9DWJFYVSK62DNHDY` | 2026-11-20T07:24:52.511Z（15:24:52） | 存在：`[{"externalId":"ou_209311c6390c2b4ff6248125aece895e","name":"AgentOS·产品助理 Agent"}]` | `om_x100b60cb12e73054cfe9d6ab6d5fef8` |
| `ce_01M7VWYPHXSDS8D2J5ZWCKKDTM` | 2026-11-20T07:15:22.757Z（15:15:22） | 存在（同一机器人名片） | `om_x100b60cb764458b8c30ec54d77c70e1` |
| `ce_01M7VWVCAEWE6YWNXNEM3P6T2N` | 2026-11-20T07:13:33.956Z（15:13:33） | 存在（同一机器人名片） | `om_x100b60cb7f7390b8c04f30e49069a0d` |

对照更早两条（同一查询 LIMIT 5 里带出）：`ce_01M7VVR60FVRNG1RYN8P9NZCCC` 2026-11-20T06:54:20.601Z（14:54:20），mentions 存在；`ce_01M7V7GQ703CQ88HMT66SXHS56` 2026-11-20T01:00:44.568Z（09:00:44）的 `content` **没有 mentions 键**。
`ce_01M7VXG30J9DWJFYVSK62DNHDY` 的正文：`{"mentions":[…],"text":"那有什么写得比较好的周报样例吗"}`。

对应的 `channel_outbound`（按 created_at 倒序，正文按工单允许保留；未打印任何 token/cookie）：

| outbound_id | status | created_at / sent_at（UTC） | intent_key | payload 正文 |
|---|---|---|---|---|
| `ob_01M7VXG3VNAX3H5FF2XMS93ZBD` | sent | 07:24:54.517Z / 07:24:55.102Z | `blocked:ce_01M7VXG30J9DWJFYVSK62DNHDY` | `{"kind":"text","body":{"text":"这件事不在我的权限范围内，我没有执行。如需开通，请联系管理员。"}}` |
| `ob_01M7VWYQ61HGHYRW5ZWR1BT4TB` | sent | 07:15:24.481Z / 07:15:25.079Z | `blocked:ce_01M7VWYPHXSDS8D2J5ZWCKKDTM` | 同一拒答句 |
| `ob_01M7VWVCGA5CGTJFC66VHW78FP` | sent | 07:13:35.242Z / 07:13:35.865Z | `blocked:ce_01M7VWVCAEWE6YWNXNEM3P6T2N` | 同一拒答句 |

再上一跳是未认人引导句（不是策略拒答）：`ob_01M7VVR6CMB77KR553JKF7Y84Z` sent，intent_key `guide:ce_01M7VVR60FVRNG1RYN8P9NZCCC`，正文「我还没认出你的身份，无法代你办事。请先在系统里绑定后再来找我。」
另有一笔死信（与本页主链无关，供 QA 认现场）：`ob_01M7VNK0AMGATN0ZBEK495ZB6D` status `dead_letter`、attempts 5、`guide:ce_01M7VNJZGSRW8JWEG6SFXRJEHX`、conversation `oc_selftest_isolated_0001`、`last_error` 开头 `feishu.send: http=400 code=230001 msg=Your request contains an invalid request p…`。

## ② 域库 `policy_decision` 最近 5 行（只列不改）

| decided_at（UTC） | decision_id | decision | reason_code | matched_grant_id | snapshot_ref | employee_id | run_id | resource |
|---|---|---|---|---|---|---|---|---|
| 07:27:29.044Z（15:27:29） | `pd_51978E7DB34A4728909481B371` | **allow** | `policy.allowed` | `gr_C5C617BFF9944EF0AE1269667E` | `snap_e76991df6ff2b767d3af99ee3cf84254` | `emp_86A81CE8FF6F42E187BCF2B540` | `run_verify_1795159649` | `{"type":"channel_event"}`（无 id） |
| 07:27:24.347Z | `pd_E95D352DB3204EE8BD9D4E98D6` | deny | `policy.snapshot_missing` | 空 | 空 | 同上 | `run_verify_1795159644` | — |
| 07:24:54.512Z（15:24:54） | `pd_E702438AF75640C794C34E123C` | **deny** | `policy.budget_ledger_stale` | 空 | `snap_e76991df6ff2b767d3af99ee3cf84254` | 同上 | 空 | `{"type":"channel_event","id":"ce_01M7VXG30J9DWJFYVSK62DNHDY"}` |
| 07:18:31.120Z | `pd_7859E95748EC4A5CB5CCBC717C` | allow | `policy.allowed` | `gr_C5C617BFF9944EF0AE1269667E` | 同一 snap | 同上 | `run_verify_1795159111` | — |
| 07:18:20.838Z | `pd_71AFF1CE45D543EDBE4F40DDF8` | deny | `policy.denied_by_budget` | 空 | — | 同上 | `run_verify_1795159100` | — |

## ③ 事实对账（只写能对上号的，禁推断）

- 15:24:52 那条群事件（`ce_01M7VXG30J9DWJFYVSK62DNHDY`，正文「那有什么写得比较好的周报样例吗」，mentions 存在）对应两笔输出：策略侧 `pd_E702438AF75640C794C34E123C`（deny，`policy.budget_ledger_stale`，`resource.id` 逐字等于该 ce id），出站侧 `ob_01M7VXG3VNAX3H5FF2XMS93ZBD`（sent，正文是拒答句「这件事不在我的权限范围内，我没有执行。如需开通，请联系管理员。」）。审计面同一跳是 `ev-dispatch-e55d564f9b4880afb5f264ddab`（occurred 07:24:55.111Z，decision deny，outcome success，correlation_id 同一 ce id，policy_decision_id 指向上面那行 pd，`after.reason_code=policy_gate.deny`，`after.disposition=policy_denied`，run_id 空）。
- 两层 reason 用词不同，必须分清：审计 `after.reason_code` 是 **worker 面**的 `policy_gate.deny`；`policy_decision.reason_code` 是 **策略面**的 `policy.budget_ledger_stale`。
- 15:27:29 的 allow 行（`pd_51978E7DB34A4728909481B371`）带 `matched_grant_id=gr_C5C617BFF9944EF0AE1269667E` 与 `snapshot_ref=snap_e76991df6ff2b767d3af99ee3cf84254`，即「有可用授权」与「快照存在」两道都通过。授权行实读（`SELECT * FROM grant WHERE id='gr_C5C617BFF9944EF0AE1269667E';`）：tenant `t_seakoi_pilot`、employee `emp_86A81CE8FF6F42E187BCF2B540`、scope_type `business_api`、resource_selector `{"type":"channel_event"}`、actions `["execute"]`、source `temporary`、expires_at `2027-12-31T00:00:00.000Z`、revoked_at/revoked_by 空、approval_ref `ap_7D484B3FFBE048ECB7B96F92C9`、created_at `2026-11-15T03:23:39.324Z`。
- 新鲜度这道门的现行判据（`services/domain/policy.py:607-609`）：只有 `reserved > 0` **且** `now - ledger.updated_at > 60s` 才落 `policy.budget_ledger_stale`（613 行）；610-612 是 CR-041（2026-11-20）的注释，说明 reserved=0 时账本就是准确值，不得因时间流逝判过期（否则空闲 >60s 后首条必拒、拒了又不产生消耗 ⇒ 永久自锁）。账本实读：day 行 `2026-11-20` reserved `0.0`、tokens_used `0`、updated_at `2026-11-20T07:18:31.050Z`；month 行 `2026-11` reserved `0.0`、cost_usd `0.121198`、updated_at `2026-11-14T19:25:51.543Z`。因此在现行码下 reserved=0 不再触发 stale——这正是工单里那句「reserved=0 时账本时间不再触发 stale」的代码出处。
- 修前那行为什么仍是 stale：07:24:54Z 那行带 `policy.budget_ledger_stale`，而同一 snapshot 在 07:18:31Z 已产出过 allow；本页**不推断原因**，只记两条现场事实：其一，allow 行的 `run_id=run_verify_1795159649`、`resource` 无 ce id，且 C1 里 07:24:52.511Z 之后没有更晚的 group 事件，所以 15:27:29 的 allow **不是**又一次真 @，它是一次 `run_verify_*` 探针写入；其二，`keepalive.log` 记域服务（8101）在 `2026-11-20T15:20:44+0800 INFO domain restart recovered port=8101 pid=53198 http=200` 与 `2026-11-20T15:31:22+0800 INFO domain restart recovered port=8101 pid=67994 http=200` 两次拉起，15:24:54 的答复出自 15:20:44 那个进程，15:31:22 之后新进程才载入现行码。
- 取不到（原文照录）：`SELECT * FROM grant WHERE grant_id='gr_C5C617BFF9944EF0AE1269667E';` → `Parse error: no such column: grant_id`（该表主键列名是 `id`，改用 `WHERE id='gr_…'` 即上表结果）。
- 取不到（原文照录）：`SELECT … , mentions FROM channel_event …` → `Parse error: no such column: mentions`（mentions 在 `content` JSON 内，见 ① 的取法）。

## ④ 下一次真 @ 的取数命令（四行，QA 直接复制）

```bash
# 1) 日志：域与 worker 的最近报错/判定（北京 15:xx）
grep -hE "policy|dispatch|deny|allow" ~/.local/state/seakoi-ops/domain-dev.log ~/.local/state/seakoi-ops/dispatch-worker.err.log | tail -40
# 2) event 行：C1 最近一条群事件（mentions 在 content JSON 里）
sqlite3 "file:$HOME/.local/state/seakoi-ops/c1-events.db?mode=ro" "SELECT event_id,received_at,status,content FROM channel_event WHERE chat_type='group' ORDER BY received_at DESC LIMIT 1;"
# 3) outbound 行：按上一行的 ce id 找 blocked:/guide: intent_key
sqlite3 "file:$HOME/.local/state/seakoi-ops/c1-events.db?mode=ro" "SELECT outbound_id,status,intent_key,created_at,sent_at,payload FROM channel_outbound ORDER BY created_at DESC LIMIT 3;"
# 4) policy_decision 行：最近判定（reason_code 用度见 ③）
sqlite3 "file:$HOME/.local/state/seakoi-ops/domain-dev.db?mode=ro" "SELECT decided_at,decision_id,decision,reason_code,matched_grant_id,snapshot_ref,employee_id,run_id,resource FROM policy_decision ORDER BY decided_at DESC LIMIT 5;"
```

第四跳的审计行取法（同一 correlation_id 精确命中，已实测 HTTP 200）见 `V1-fourth-hop-audit-query-recipe.md`：`eventId = "ev-dispatch-" + sha256("dispatch:" + <ce id>).hexdigest()[:26]`，然后 `GET :8101/v1/audit/events/<eventId>`，头只需 `X-Tenant-Id: t_seakoi_pilot`。

## ⑤ 纪律

只读：全程 `sqlite3 "file:…?mode=ro"` 与日志文本，无 UPDATE/INSERT/DELETE；未改任何产品码；未发任何外部消息（飞书/HTTP POST 一律没打）；未启停受管服务（restart 记录是读 `keepalive.log` 得到的既有事实）；未打印 token/cookie 值（grant 表里无凭据列）；本文件是本次唯一产物，写在 `docs/_artifacts/aud/` 下。
