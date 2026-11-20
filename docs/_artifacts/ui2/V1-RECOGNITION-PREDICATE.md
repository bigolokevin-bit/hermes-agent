# V1 认人谓词审计（只读，源码取证）

- 被查工作树：`/Users/kevin_studio/Projects/seakoi-agent-os`，HEAD `308a5f1b`（merge(l0): freeze DELEGATION v1.0）。本轮只读，无写库、无启停、无发消息。
- 结论口径：每问先给「布尔式/结论」，再给 `文件:行号` 与源码摘录；源码未覆盖处标「源码推导，无测试覆盖」。
- 一句话：**`unknown=false` 只由「同一 (tenant, channel, app_id, external_id) 上存在一条 status=active 且未超 TTL 的 link」决定；`employeeId` 与 `unknown` 是两条独立轴——前者来自 workstation，后者来自 link。**

---

## ① `unknown=true` 的判定布尔式原文

判定链（`services/domain/recognition.py:290-320`）：

```python
link = repo.find_identity_link_by_external(tenant_id, channel, app_id, external_id)   # 290
unknown = True                                                                        # 291
subject = {"subjectType": "unknown"}
if link is not None and link["status"] != "revoked":                                  # 293
    last = link.get("last_verified_at")
    expired = last is None or (util.now() - util.parse_iso(last)).total_seconds() > link["ttl_seconds"]  # 295-297
    if expired:
        ... status="stale" ... refresh_hook ...                                       # 299-315
    if link["status"] == "active":                                                    # 317
        unknown = False                                                               # 318
        subject = {"subjectType": link["subject_type"]}                               # 319
```

⇒ 布尔式（可判真假）：

```
unknown = NOT (
    link exists(same tenant, channel, app_id, external_id)
    AND status != 'revoked'
    AND (status becomes 'active' after lazy expiry handling)
    AND last_verified_at is not null
    AND now - last_verified_at <= ttl_seconds
)
```

- 参与匹配的字段：`tenant_id`、`channel`、`app_id`、`external_id`、`status`（只排除 `revoked`；`stale` 需经 refresh 成功才可 active）、`last_verified_at` + `ttl_seconds`（TTL）。
- **`unionId` 不参与匹配**：`union_id` 只在 E8 写入与 `_link_public` 回显（`recognition.py:101-104`、`188`），`resolve` 的查询与分支从未读取它。
- `subject_type` 不参与 lookup 过滤，只用于选中行排序：`person` 优先于 `guest` 优先于其它（`services/domain/repository.py:1394`）——同一外部 ID 若有多条不同 subject_type 的行，`person` 那条决定结果。
- `status='stale'` 不算已知：只有 `active` 才置 `unknown=False`（`:317`）。

## ② `link.app_id` 与请求 `appId` 的比较方向

- 请求体若带 `appId`：必须与**部署级 app_id** 相等，否则 400 `recognition.app_mismatch`，且不写任何审计/幂等（`:264-266`；测试 `tests/test_recognition.py:334-348` 断言 `before_audit == after_audit`）。
- 请求体**不带** `appId`：不做比较，直接用部署级 app_id 去查 link。
- 部署级 app_id 来源：`ops/domain-dev-server.py:7,167` → `SEAKOI_DOMAIN_APP_ID`，默认 `feishu_default_app`，经 `create_app(app_id=…)`（`:211-215`）传给 `/v1/recognition/resolve`（`http_app.py:438-452`）。
- 比较方向：**请求值 vs 部署值**（不是 vs link 行上的值）；link 的 `app_id` 是**写入时**由服务端用同一部署值盖章（`recognition.py:185` 写入 `"app_id": app_id`，`http_app.py:361-376`），所以「同一部署自建自读」天然一致。
- 若部署 app_id 与飞书事件 appId 不一致 → 带 appId 的请求一律 400；不带 appId 的请求则永远查不到该应用下的 link（查的是默认/部署 app_id 那一行）。

## ③ TTL 语义

- 单位：秒（`ttl_seconds integer`，`migrations/001_employee_tables.sql:69`）。
- 上下界：**只校验 `isinstance(int) and > 0`**（`recognition.py:157-165`）——无上限、无 400 截断、无默认值；注意 Python 里 `true` 是 `int`，`ttlSeconds: true` 会通过校验并存成 1 秒（源码推导）。
- `expires_at`：**不存在这一列，也从不写入**（`001_employee_tables.sql:60-71` 无该列；`006` 只加 app_id/union_id/subject_user_id）。过期是**读时算**：`now - last_verified_at > ttl_seconds`（`recognition.py:295-297`）。
- `last_verified_at` 写入点：创建时 `now`（`:189`）；refresh 成功时 `now`（`:311-315`）。
- 过期后 `status='stale'` 是**读时惰性改**：只在 `resolve` 内部 `repo.update_identity_link_status(... status="stale")`（`:299-311`）；全仓无 sweeper/定时任务改动该状态（`grep update_identity_link_status` 仅 `recognition.py` 两处 + `repository.py` 定义）。
- `refresh_hook` 未注册：`resolve` 用 `NullRefreshHook`（`:220`，`refresh()` 恒 `None`，`:118-124`），于是 stale 保持 stale → 该 link **等于没有 link**（同一次响应即 `unknown=true`），但**不会**改 `employeeId`（仍回 workstation 的 employee，见 ④）。生产 `create_app(refresh_hook=None)` 即此形态，直到部署注入真实 hook。
- 边界：`last_verified_at` 为空也按过期处理（`:295` 的 `last is None`）。

## ④ `employeeId` 是否可能来自 link

**不会。** `employeeId` 只来自 workstation：

```python
workstation = repo.find_workstation_by_ref(tenant_id, channel, conversation_ref) if isinstance(conversation_ref, str) else None  # :284
employee_id = workstation["employee_id"] if workstation else None  # :288
```

- 查法：`workstation WHERE tenant_id=? AND channel=? AND external_ref=? AND status IN ('pending','active') ORDER BY id LIMIT 1`（`repository.py:1409-1417`）。
- link 的 `employee_id` 只用于「把这条 link 的状态改 stale/active」的更新定位（`:299-315`），**不进响应**。
- 因此两个轴独立：
  - workstation 缺失 / `conversationRef` 不匹配 → `employeeId: null`，**但 `unknown` 仍可能为 false**（link 有效时）。
  - link 无效 → `unknown=true`，`employeeId` 仍可非空（`tests/test_recognition.py:177-180`、`199-202`、`224-237` 都断言了 unknown 与 employeeId 同时出现）。
- 非法 `conversationRef`（非字符串）不报错，只是不去查 workstation（`:283-285`）。

## ⑤ 重复写同一 `(channel, app_id, external_id)` 的返回码与幂等

- **同一 `(tenant, channel, app_id, external_id, subject_type)` 的行已存在**（含 `revoked` / `stale` 行）：
  - 预检 `find_identity_link_exact` 命中 → 409 `identity.duplicate_external_id`（`recognition.py:171-174`；预检 SQL `repository.py:1399-1407`，**不看 status**）。
  - 绕过预检（并发）时 DB 唯一键兜底：`UNIQUE (tenant_id, channel, app_id, external_id, subject_type)`（`migrations/006_identity_link_app_scope.sql:15-18`，替换 002 的旧键）→ `sqlite3.IntegrityError` → 仍映射 409（`recognition.py:196-200`）。
- **不是幂等覆盖**：没有 update 路径；第二次写不会刷新 `last_verified_at`。
- **只有同一 `Idempotency-Key` + 同一请求体哈希**才算重放：命中幂等表直接返回首次 200 响应（`recognition.py:143-146`，`_cached_result` 校验 `request_hash`）。
- 409 之后 GET 是否可见：**本服务没有 GET identity-links 路由**（`http_app.py` 只有 `POST .../identity-links`、`DELETE .../identity-links/{link_id}`、`POST /v1/recognition/resolve`）→ 无法通过 HTTP 回读那条 link，只能靠数据库或 resolve 的 `subject` 反推。
- 推论（源码推导，无测试覆盖）：**revoked 行占着唯一键，revoke 之后用同一 subject_type 再 bind 仍会 409**；要换绑只能改 subject_type、改 app_id（换部署）、或直接在库里处置旧行。这一点会让「先 revoke 再重绑」失败——写 identity_link 前必须先确认该外部 ID 上没有历史行（含已撤销行）。

## ⑥ 「绑定成功后 resolve 必返 unknown=false」的最小充分条件

按判定链排序，缺一即 unknown：

1. 请求带 `X-Tenant-Id`，且与 link 的 `tenant_id` 一致（缺失 → 400 `request.missing_tenant`）。
2. 请求带 `Idempotency-Key`（缺失 → 400 `request.missing_idempotency_key`）；**验证时用新的 `messageId`**——幂等键是 `messageId:eventType`（`:271`），复用同一 messageId 会直接回放首次的 `unknown=true`（测试 `tests/test_recognition.py:392-410`）。
3. `body.channel` 与 `body.externalId` 为字符串（缺失 → 400 `request.invalid_body`）；`externalId` 与写入值逐字相等（`unionId` 不参与）。
4. `body.appId` 省略，或等于部署 `SEAKOI_DOMAIN_APP_ID`（否则 400 `recognition.app_mismatch`）。
5. link 行存在且 `status` 不为 `revoked`。
6. `status='active'` 且 `last_verified_at` 非空、`now - last_verified_at <= ttl_seconds`；若已过期，还必须已注入可用的 `refresh_hook` 并返回非 None（M1 默认没有 → 过期即 unknown）。
7. 以上满足即 `unknown=false`，`subject.subjectType` 取该行 subject_type（`person` 还带 `subjectUserId`）。

**`employeeId` 不在上述清单内**：要它非空，另需 workstation 命中（`channel + conversationRef + status ∈ {pending, active}`，且取 `ORDER BY id LIMIT 1` 的第一行）。

任一条件不满足的可观测症状：

| 缺失条件 | resolve 可观测症状 |
|---|---|
| X-Tenant-Id | 400 `request.missing_tenant`，无响应体 |
| Idempotency-Key | 400 `request.missing_idempotency_key` |
| channel / externalId | 400 `request.invalid_body` |
| appId 与部署不一致 | 400 `recognition.app_mismatch`，零审计写入 |
| link 不存在 / 其它租户 | 200 `unknown=true` + `guidance=recognition.unknown_sender` + `subject.subjectType=unknown`，并写一条 `recognition.unknown` 审计 |
| link 已 revoked | 同上（200 unknown=true）；employeeId 仍可能非空 |
| link 已过期且无 refresh | 同上，且库里该行被改成 `status='stale'`（读时副作用） |
| link 有效但无 workstation | 200 `unknown=false`，**`employeeId: null`** |
| 复用同一 messageId | 200 原样回放首次结果（旧 unknown 会一直复现，看起来像「绑定没生效」） |

---

### 验证口径（本轮未做）

- 只做了源码与既有测试的对照；未起服务、未发请求、未写库。
- 第 ⑤ 条末尾「revoked 占唯一键导致无法重绑」为源码推导，仓内无对应测试；写 identity_link 前建议先只读查库确认该外部 ID 的历史行。