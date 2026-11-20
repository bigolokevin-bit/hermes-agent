# V1 认人绑定契约（只读调查，为一次获批写做准备）

- 工单：@1473@（2026-11-20）。代次 94076a05 / 章面 74c1e3b3 口径。
- 性质：**纯只读调查**。本文全部结论现读自 `/Users/kevin_studio/Projects/seakoi-agent-os`（未改其一字节）；**未执行任何写请求**，未启停任何服务。
- 背景：工作位已绑（`oc_0adeac…db5` → `emp_86A81CE8FF6F42E187BCF2B540`），但 `POST /v1/recognition/resolve` 对真发件人 `externalId=415g466e` 仍 `unknown=true`——缺 identity_link，且存在 app_id 维度风险（见 §4）。

## 1. 契约与校验（源码逐条）

### E8 POST `/v1/employees/{employee_id}/identity-links`
证据：`services/domain/http_app.py` L360-377、`recognition.py` L129-201。

- 必需头：`X-Tenant-Id`（缺→`400 request.missing_tenant`）、`Idempotency-Key`（缺→`400 request.missing_idempotency_key`）。
- body 必填四件：`subjectType`(str)、`channel`(str)、`externalId`(str)、`ttlSeconds`(int>0)；任一不合规→`400 request.invalid_body`。
- `subjectType=="person"` 时 `subjectUserId` 必为非空 str，否则 **`400 identity.subject_required`**（与记忆 E8 读数一致）。
- `unionId` 选填；**body 没有 `appId` 字段**——link 行的 `app_id` 列取自部署注入值 `create_app(app_id=…)`（见 §4），请求体写不进它。
- employee 不存在→`404 employee.not_found`。
- 重复绑定判据：`find_identity_link_exact(tenant, channel, app_id(部署), external_id, subject_type)` 命中→**`409 identity.duplicate_external_id`**。
- 成功=**HTTP 200**（非 201），体=`_link_public`：`{id:"il_…", employeeId, subjectType, channel, externalId, status:"active", ttlSeconds, appId?(行内非空才出), subjectUserId?, unionId?, lastVerifiedAt(=创建时刻 UTC now_iso)}`。
- 幂等：同 key 同 body→`_cached_result` 回放 `(200, 原 response)`；同 key 不同 body→**`409 request.idempotency_conflict`**（`request_hash=util.digest(body)` 不等即抛，`service.py`）。sqlite IntegrityError 竞态→回放赢家或 409 duplicate。

### E8 DELETE `/v1/employees/{employee_id}/identity-links/{link_id}`
证据：`http_app.py` L379-396、`recognition.py` L204-245。

- 必需头同上；无 body（`request_hash=digest({})`）。
- employee 无→`404 employee.not_found`；link（tenant+employee+link_id 三键）无→`404 identity.not_found`。
- 已 revoked→幂等 200 原样返回；成功=status 迁移 active→**revoked**（软删，非物理删），返回 `_link_public(status:"revoked")`。
- TTL 过期态=**stale**：由 resolve 判过期时 `update_identity_link_status` 写入；revoked 永不生效；stale 在 resolve 中走 refresh_hook，失败则维持 unknown=true，成功则回 active 并刷新 `lastVerifiedAt`。

### E9 POST `/v1/recognition/resolve`
证据：`http_app.py` L433-451、`recognition.py` L248-361。

- 必需头同上；body `channel`+`externalId` 必 str（否则 `400 request.invalid_body`）。
- `body.appId` **若携带**且 ≠ 部署 app_id→`400 recognition.app_mismatch`；不携带=不校验。
- `eventType` 缺省 `message_created`；非法值→unknown。
- 幂等键：**有 `messageId` 时=`messageId:eventType`（此时忽略头 Idempotency-Key）**；否则用头 key。
- `conversationRef`→`find_workstation_by_ref(tenant, channel, external_ref)` 得 `employeeId`（无工作站=响应 `employeeId:null`；工作位绑定的 employee 出处是这里，**不是 link**）。
- link 匹配：`find_identity_link_by_external(tenant, channel, app_id(部署), external_id)`，排序 `person>guest>其它`、id tiebreak 取第一。**union_id 不参与匹配**（只作后续迁移提示，记忆 E8/E9 证实）；主键组合=`(tenant, channel, app_id, external_id)`，subject_type 仅权重。
- TTL：`expired = (now - lastVerifiedAt).total_seconds() > ttlSeconds`（`util.now`=UTC aware，`parse_iso` 支持 Z；last 为空视为过期）。过期→标 stale+refresh；active→命中。
- 命中（active）→`unknown=false`，`subject={subjectType, subjectUserId?}`——`subjectUserId` 取 **link 的 subject_user_id**（我方主体 id，非 externalId；记忆 E9 证实），link 该字段有值才出现在响应里。
- `unknown=true` 时附 `guidance:"recognition.unknown_sender"` 并写审计（action=recognition.unknown、actor=service:recognition、resource=`external_identity:<externalId>`、outcome=denied、correlation_id=messageId、responsible 由 resolver 出）；`unknown=false` 时响应**删除 guidance 键**。
- 响应形状（200）：`{employeeId, unknown, guidance?, subject{subjectType[, subjectUserId]}}`。

## 2. 最小合法 POST body（待批准后执行，本单未执行）

```
POST /v1/employees/emp_86A81CE8FF6F42E187BCF2B540/identity-links
X-Tenant-Id: <部署租户值（与 oc_0adeac…db5 工作位同租户）>
Idempotency-Key: <一次性唯一串（勿复用）>

{
  "subjectType": "person",
  "subjectUserId": "<员工 ownerUserId 或该真人的平台 user id>",
  "channel": "feishu",
  "externalId": "415g466e",
  "unionId": "on_f375f535aa7538d05321703390d951f7",
  "ttlSeconds": 604800
}
```

- **不放 `appId` 字段**（body 无此键；写了也会被 invalid_body 之外的路径忽略——它根本不被读取，link.app_id=部署注入值）。
- `subjectUserId` 源码**不校验**必须等于员工 `ownerUserId`（只要求非空 str）；若意图绑到真实的人，取该员工 `ownerUserId` 或真人平台 id 是最佳实践，建议与 L0 确认后落定。
- `unionId` 可留（仅作迁移提示，不参与匹配）。
- `ttlSeconds` 示例=7 天；过期后 resolve 会先标 stale 并尝试回源（当前部署 refresh_hook=NullRefreshHook 恒失败→unknown=true），需要长命就写大值或到期重绑。

失败码含义速查：
| 码 | 含义 |
|---|---|
| `400 request.missing_tenant` / `missing_idempotency_key` | 两个必需头缺失 |
| `400 request.invalid_body` | 必填四件任一缺失/类型错 |
| `400 identity.subject_required` | person 类型缺 subjectUserId |
| `400 recognition.app_mismatch` | 仅 resolve：body.appId ≠ 部署 app_id |
| `404 employee.not_found` | 路径员工不存在（含跨租户） |
| `404 identity.not_found` | DELETE 时 link 三键查不到 |
| `409 identity.duplicate_external_id` | 同 (tenant,channel,部署app_id,externalId,subjectType) 已有 link |
| `409 request.idempotency_conflict` | 同 Idempotency-Key 携带不同 body |
| `409 recognition.write_conflict` | resolve 侧并发写冲突 |

## 3. 建完 link 后 resolve 是否即 `unknown=false`

**前提全部成立才=是**：

1. `externalId`/`channel`/`X-Tenant-Id` 与 resolve 请求逐字一致；
2. **link.app_id == 部署 app_id**（关键风险，见 §4）；
3. 创建即 `status=active` 且 `lastVerifiedAt=创建时刻`→TTL 起点即刻有效，`ttlSeconds` 窗口内保持 active（未过期不会走 refresh_hook，Null hook 不影响 fresh link）；
4. 用**新的 messageId（或无 messageId+新 Idempotency-Key）**验证——`messageId:eventType` 幂等会回放旧结果：同一条已判过 unknown=true 的消息再 resolve **不会**因新 link 而翻 false，必须换一条消息或换幂等键；
5. resolve 响应里的 `employeeId` 出自 conversationRef→workstation 链，与 link 无关；link 决定的是 `unknown` 与 `subject`。

## 4. 风险与回退

- **部署 app_id 口径（本单核心发现）**：`ops/domain-dev-server.py` L164-167：`app_id=os.environ.get("SEAKOI_DOMAIN_APP_ID", "feishu_default_app")`。E8 写入与 E9 匹配都用这个部署注入值；工单里的 `cli_aa7fa29bceb95c16` **不是 body 可写字段**——若部署 env 不是该值，即便 link 建成，E9 按 externalId 匹配时 `app_id` 条件也对不上，`unknown=true` 依旧。写这一步之前**必须先确认部署 `SEAKOI_DOMAIN_APP_ID` 现值**（或协调设为预期值），否则这次写入达不成目的。现默认=`feishu_default_app`（≠ `cli_aa7fa29bceb95c16`）。
- 回退路径：`DELETE /v1/employees/emp_86A81CE8FF6F42E187BCF2B540/identity-links/<il_id>`（带租户头+Idempotency-Key）；软删=revoked，resolve 立即回到 unknown=true；重复 DELETE 幂等 200。
- 误绑影响面：`subjectUserId` 写错只影响此后 resolve 的 `subject` 读数；不会改写已缓存的旧 resolve 结果（幂等回放），纠正后需新 messageId 才见新值。误绑他人 externalId=把该发件人的消息归到错误主体，属安全边界事件——写前需 L0/用户批准（本单未执行任何写）。
- 租户隔离：所有查询（by_external / by_id / exact / workstation）都带 `tenant_id` 等值条件；跨租户不可见、不可撤（revoke 同样按 tenant+employee+link 三键）。
- 幂等键复用风险：`Idempotency-Key` 撞旧 key 且 body 不同→409；写操作请使用一次性唯一串。
- 审计面：unknown=true 会持续产生 denied 审计记录（correlation_id=触发 messageId），绑成后不再新增。

## 证据索引（全部只读现查）

`services/domain/recognition.py` L129-201（E8 创建）/L204-245（E8 撤销）/L248-361（E9 resolve）；`services/domain/http_app.py` L360-377/L379-396/L433-451（路由与头校验）；`services/domain/repository.py` L1388-1408（find_identity_link_exact/by_external 的 app_id 与排序条件）；`services/domain/util.py` L8-27（UTC now/iso/parse_iso）；`services/domain/service.py`（`_cached_result` 幂等与 request_hash）；`ops/domain-dev-server.py` L164-167（SEAKOI_DOMAIN_APP_ID 注入与默认值）；`services/domain/recognition_endpoint.py`（DomainError→(status,{code,message}) 薄层）。
