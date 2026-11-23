# Q12 · 员工详情五 Tab 真数据 — DONE

- 分支：`task/Q12-people-tabs`（基线 `lane/hermes-console` @ `5ddee38447`）
- 写域：仅 `web/src/modules/people/**`（+ 本交付目录 `docs/_artifacts/Q12-people-tabs/`）
- 形态：名册每行 `ppl5d-open-<id>` → 页内五 Tab 详情（档案/任职/权限/任务/审计），零路由改动；每 Tab 首次激活独立懒加载，互不牵连。

## 接口原文（全部为现网 BFF `127.0.0.1:8092` 实测 200，取证样本 employee=emp_86A81CE8FF6F42E187BCF2B540「AgentOS 产品助理」）

### 1. 档案 — `GET /agent-api/api/employee?id=${eid}`
```json
{"id":"emp_86A81CE8FF6F42E187BCF2B540","tenantId":"t_seakoi_pilot","name":"AgentOS 产品助理","title":"产品助理（数字员工 · Pilot）","lifecycleState":"active","currentVersionId":"empv_037096D42F194AF6B38A3D8F62","ownerUserId":"1","createdAt":"2026-11-13T22:15:11.641Z","updatedAt":"2026-11-21T18:39:20.010Z","revision":5,"department":"产品部"}
```

### 2. 任职 — `GET /agent-api/api/workstations?id=${eid}&limit=20`
```json
{"items":[{"id":"ws_7E2653CFA7434BE096344CEAC2","employeeId":"emp_86A81CE8FF6F42E187BCF2B540","bindingType":"group","channel":"feishu","externalRef":"oc_0adeac8168d48d413693f1e64a330db5","capabilities":["reply","stream"],"status":"active"},{"id":"ws_8D6580432F9A4B38B51337C4FC","...":"..."}]}
```

### 3. 权限 — `GET /agent-api/api/effective-config?id=${eid}`
形状 `{employee, version, grants[], resolvedAt, snapshotRef}`；样本节选：
```json
{"grants":[{"id":"gr_3A384C3D17154889A609670E8C","employeeId":"emp_86A81CE8FF6F42E187BCF2B540","scopeType":"channel","resourceSelector":{"types":["chat"]},"actions":["send"],"source":"role","expiresAt":"2026-12-31T00:00:00.000Z"}],"resolvedAt":"2026-11-23T11:38:24.746Z","snapshotRef":"snap_7d6dfe803428c0920db8ec8521e3a5f4","version":{"versionNo":5,"...":"..."}}
```
真实状态分支：`409 employee.no_effective_version` → 原因空态「该员工尚无生效版本」（不算加载失败）。

### 4. 任务 — `GET /agent-api/api/tasks?assignee=employee:${eid}&limit=20`
```json
{"items":[{"taskId":"tk_89F5AEF75D814C17BD1FDFC8BB","tenantId":"t_seakoi_pilot","title":"L6 TSK03 R2 探针任务","assignee":{"type":"employee","id":"emp_86A81CE8FF6F42E187BCF2B540"},"createdBy":{"type":"human","id":"1"},"source":{"kind":"manual"},"priority":"normal","status":"open","progressNote":null,"createdAt":"2026-11-17T16:58:50.210Z","updatedAt":"2026-11-17T16:58:50.210Z"},{"...":"..."}]}
```

### 5. 审计 — `GET /agent-api/api/audit?resourceId=${eid}&limit=50`
```json
{"events":[{"eventId":"ev_32305B3550034BD3877494A0D7","schemaVersion":1,"tenantId":"t_seakoi_pilot","occurredAt":"2026-11-22T09:56:56.621Z","recordedAt":"2026-11-22T09:56:56.621Z","sourceSystem":"policy","actor":{"type":"system","id":"employee-api"},"action":"budget.ledger_entry_applied","resource":{"type":"employee","id":"emp_86A81CE8FF6F42E187BCF2B540"},"outcome":"success","...":"..."}],"limit":50,"hasMore":true,"total":189}
```
「共 N 条」只取 payload `total`（本样本 189）；`total` 缺失则不显示条数，绝不用页内条数冒充。

### 未接（维持既有「未接入」口径，本件未动其显示逻辑）
`/api/v1/user/list`、`/api/v1/role/list` 实测 `{"code":"console.unknown_route","message":"unknown console API route"}`（BFF 无此代理，GAP-02），故权限 Tab 不接用户/角色管理端点。

## 诚实性口径
- 取不到（非 2xx / 网络 / 200 但形状不符）→ Tab 内 `ppl5d-failed`「未取到」+ `humanizeStatus` 原因 + 请求号；可重试端点给重试钮，形状不符端点不伪装可重试。
- 真数据缺失值一律「—」，不出现假 0 / 假成功 / fixture。
- 空态按 Tab 写具体原因：任职「该员工暂无绑定的工作站」、权限「当前生效配置未返回任何授权」/409 专项原因、任务「暂无指派给该员工的任务」、审计「暂无该员工的审计事件」。

## 测试与构建数字
- `node_modules/.bin/vitest run src/modules/people/` → **17 passed / 17**（2 文件：既有 PeopleModulePage 9 条零改动 + 新增 EmployeeDetail 8 条）
- 旁证：`vitest run src/shell/bridge.test.ts` → 8 passed；`tsc -p tsconfig.app.json --noEmit` → 0 errors
- 构建闸 `node_modules/.bin/vite build` → **exit 0**（终版 ✓ built in 5.91s，产物 `hermes_cli/web_dist/`）

## 截图（真实登录态：v4_proxy 临时口 5512 指本件 dist + `access_token_cookie` 注入，BFF 实连 8092，无 reqfail）
交付口径两张：
- `desktop-1440-profile.png`（1440×900，档案 Tab 真值 9 行）
- `mobile-375-profile.png`（375×812，无横向溢出）
加拍佐证：`desktop-1440-workstations.png`、`desktop-1440-permissions.png`、`desktop-1440-tasks.png`、`desktop-1440-audit.png`、`mobile-375-tasks.png`、`mobile-375-audit.png`

口径说明（375）：任务/任职/权限表在 375 全列直出（DOM 断言：表宽 339.5 ≤ 壳 340，末列表头 right=351.8 ≤ 375，无中文字逐字换行）；审计 6 列在 340px 无法读性直出（自然最小宽 ≈594），按仓内既有宽表惯例（metrics/health 同法）给显式横向滚动区：提示行「左右滑动查看全部列」+ 首列吸左 + 边缘阴影，页面级 `scrollWidth=375` 恒不溢出；桌面 >760 行为逐字节不变（提示隐藏、表不滚）。
