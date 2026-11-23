# R-OBS-CV81EA88 · obs 当代归因（匿名面，9122 现网，只读取证）

**登录态不可用，需换口令。**（`ui-qa-auth-state.json` 判 EXPIRED、`/auth/whoami` 裸 cookie 实测 401 → 按派单口径本件只含匿名面；auth 面本代 NOT MEASURED。）

- 派单：L0，2026-11-23，『obs 当代归因（只读，落证据件）』。
- 执行车道：lane/console-ui-qa（本件唯一落点）。禁改码/禁重启/禁发群/禁改九门账——全部遵守，零代码零端口改动。

## 0. 结论摘要

1. **51 路由 × 2 视口 = 102 样本全部在当代次跑成**：每样本 entry 戳均为 `index-CV81EA88.js`，页面 HTTP 均 200，无导航失败、无 requestfailed、无 pageerror。
2. **console 错误共 364 行：ENV 362 行（`/auth/whoami` 401×104 + `/agent-api/**` 401/403/404×258），产品行 0。**
3. **非 ENV 仅 2 行**，均为 `502 (Bad Gateway)`：`#/work`@1440 的 `/agent-api/api/tasks?status=open&limit=50` 与 `#/overview`@375 的 `/agent-api/api/employee-stats`。匿名 curl 复测 ×2 轮均 401（鉴权门先于业务，502 不可外部复现）→ **判上游 BFF 瞬时异常，各 1 次/102 样本，非持续、非产品**。
4. 与 `R-OBS-6c4f3385.md` **同源**：ENV 面同一口径（无登录会话 → 网关 401，设计内错误态 UI 已上屏，如「审批申请读取失败…请求编号」）；产品码证据同样为零。当代无该先例的 reload 风暴伪 product（本探针 ENV 判据同 `shots.mjs:255`，且未注入过期 auth 态）。
5. 对旧账 `docs/_artifacts/tonight/shots-summary.json`（headHash=2610339d, ok=False, consoleErrorsObservedByShots=1, routesWithEnvOnlyConsoleErrors=50, ceAuthority=login-state）：**当代次 CV81EA88 匿名面产品行=0**，旧 obs=1 属旧代 login-state 机制面，可作销账依据（账本由 L0 改，本件不动账）。

## 1. 代次四证（CV81EA88）

| 证 | 读数 |
|---|---|
| 磁盘产物 | `hermes_cli/web_dist/assets/index-CV81EA88.js` 174883 B，mtime Nov 23 13:53，sha256[0:16]=`1e5146f4f0ba3bba` |
| served | `curl http://127.0.0.1:9122/assets/index-CV81EA88.js` 同哈希；首页引用 entry=`index-CV81EA88.js` |
| 检出 | `/Users/kevin_studio/Projects/forks/hermes-agent` @ `d41671c115`（tip，2026-11-23 13:51:44 +0800） |
| 样本戳 | 102/102 样本 `entry=index-CV81EA88.js` |

## 2. 登录态证据（不可用）

- `check-authstate.mjs --all`：`ui-qa-auth-state.json`（mtime Nov 22 23:28）EXPIRED —— `access_token_cookie` JWT exp=2026-11-23 01:12:26，过期 5.0 h（subject opsadmin / issuer bisheng）；`v4-auth-state.json` 过期 67 h。
- `curl -b <该 cookie> http://127.0.0.1:9122/auth/whoami` → **401** `{code:auth.unauthenticated}`（rid 8435df47）；匿名 whoami 亦 401（rid c3df95fa）。
- 依据派单「200 才算有效」→ auth 面不跑、不猜、不空转。

## 3. 方法（命令原文）

```bash
# 探针：/private/var/folders/…/opencode/obs-6632f340.mjs（11-21 版，与 R-OBS-6632f340 同件）
# 路由清单：shots-index.md 去重 51 条（剔除注释行 #/sessions-375，routes.ts 0 命中），routes51.txt
BASE=http://127.0.0.1:9122 MODE=anon GATED=1 REPS=1 ROUTES=<51 条 || 拼接> node obs-6632f340.mjs \
  > obs-CV81-anon.out 2> obs-CV81-anon.err   # exit=0；GATED=1 → addInitScript __HERMES_AUTH_REQUIRED__
# 冒烟（先跑单路由验证代次与判据）：ROUTES='#/access' 同上
# 502 复测：curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9122/agent-api/api/tasks?status=open&limit=50（及 employee-stats）×2 轮
```

口径：ENV=`401/403/404 (Unauthorized|Forbidden|Not Found)` 且 URL 属 `/auth|/api|/agent-api`（同 `shots.mjs:255` ENV 判据）；产品=其余带 文件:行 的 console error/pageerror（对照 `git grep -nE 'console\.(error|warn)' d41671c115 -- web/src` = 23 处，全为 `[chat-sidebar]/[console]/[api]` 等 warn 文本，本次 102 样本 0 命中）；上游=5xx/非 ENV 异常。

## 4. 逐路由表（匿名面，whoami×2=两视口各 1）

| route | page http | whoami 401 | api 401/403/404 | 非ENV行 | api 端点(条数) |
|---|---|---|---|---|---|
| `#/access` | 200 | 2 | 8 | — | /agent-api/api/v1/role/list?page=1&limit=200×2; /agent-api/api/v1/roles?page=1&limit=200×2; /agent-api/api/v1/user/all×2; /agent-api/api/v1/user/list×2 |
| `#/approvals` | 200 | 2 | 2 | — | /agent-api/api/approvals?status=pending&limit=50×2 |
| `#/approvals?tab=history` | 200 | 2 | 2 | — | /agent-api/api/approvals?limit=50×2 |
| `#/approvals?tab=mine` | 200 | 2 | 2 | — | /agent-api/api/approvals?status=pending&limit=50×2 |
| `#/approvals?tab=pending&view=mine` | 200 | 2 | 2 | — | /agent-api/api/approvals?status=pending&limit=50×2 |
| `#/approvals?tab=pending&view=release` | 200 | 2 | 2 | — | /agent-api/api/approvals?status=pending&limit=50×2 |
| `#/approvals?tab=policy` | 200 | 2 | 2 | — | /agent-api/api/approvals?status=pending&limit=50×2 |
| `#/approvals?tab=release` | 200 | 2 | 2 | — | /agent-api/api/approvals?status=pending&limit=50×2 |
| `#/audit` | 200 | 2 | 2 | — | /agent-api/api/audit?limit=50&from=2026-11-16T06%3A13%3A46.151Z&to=2026-11-23T06%3A13%3A46.151Z×1; /agent-api/api/audit?limit=50&from=2026-11-16T06%3A14%3A45.833Z&to=2026-11-23T06%3A14%3A45.833Z×1 |
| `#/capabilities` | 200 | 2 | 2 | — | /agent-api/api/skills×2 |
| `#/capabilities?tab=channels` | 200 | 2 | 14 | — | /agent-api/api/channels?limit=50×2; /agent-api/api/connectors?limit=50×2; /agent-api/api/datasources?limit=50×2; /agent-api/api/gateway-connections?limit=50×2; /agent-api/api/hermes-summary?limit=50×2 … |
| `#/capabilities?tab=models` | 200 | 2 | 6 | — | /agent-api/api/hermes-usage?days=30×2; /agent-api/api/models×2; /agent-api/api/models/pricing×2 |
| `#/capabilities?tab=tools` | 200 | 2 | 6 | — | /agent-api/api/mcp/servers×2; /agent-api/api/tools×2; /agent-api/api/tools/toolsets×2 |
| `#/employees` | 200 | 2 | 2 | — | /agent-api/api/employees?limit=50&expand=version%2Cknowledge×2 |
| `#/employees/:employeeId` | 200 | 2 | 4 | — | /agent-api/api/employees/%3AemployeeId×2; /agent-api/api/matrix?employee=%3AemployeeId×2 |
| `#/employees/:employeeId?zone=config` | 200 | 2 | 4 | — | /agent-api/api/employees/%3AemployeeId×2; /agent-api/api/matrix?employee=%3AemployeeId×2 |
| `#/employees/:employeeId?zone=evidence` | 200 | 2 | 4 | — | /agent-api/api/employees/%3AemployeeId×2; /agent-api/api/matrix?employee=%3AemployeeId×2 |
| `#/employees/:employeeId?zone=runs` | 200 | 2 | 4 | — | /agent-api/api/employees/%3AemployeeId×2; /agent-api/api/matrix?employee=%3AemployeeId×2 |
| `#/employees/:employeeId?zone=tasks` | 200 | 2 | 4 | — | /agent-api/api/employees/%3AemployeeId×2; /agent-api/api/matrix?employee=%3AemployeeId×2 |
| `#/employees?tab=matrix` | 200 | 2 | 2 | — | /agent-api/api/matrix×2 |
| `#/identity` | 200 | 2 | 6 | — | /agent-api/api/employees?limit=20×2; /agent-api/api/v1/user/all×2; /agent-api/api/v1/user/list×2 |
| `#/identity?tab=admins` | 200 | 2 | 6 | — | /agent-api/api/employees?limit=20×2; /agent-api/api/v1/user/all×2; /agent-api/api/v1/user/list×2 |
| `#/identity?tab=binding` | 200 | 2 | 6 | — | /agent-api/api/employees?limit=20×2; /agent-api/api/v1/user/all×2; /agent-api/api/v1/user/list×2 |
| `#/identity?tab=checks` | 200 | 2 | 6 | — | /agent-api/api/employees?limit=20×2; /agent-api/api/v1/user/all×2; /agent-api/api/v1/user/list×2 |
| `#/identity?tab=departments` | 200 | 2 | 2 | — | /agent-api/api/v1/departments×2 |
| `#/identity?tab=people&view=admins` | 200 | 2 | 6 | — | /agent-api/api/employees?limit=20×2; /agent-api/api/v1/user/all×2; /agent-api/api/v1/user/list×2 |
| `#/identity?tab=roles` | 200 | 2 | 8 | — | /agent-api/api/v1/role/list?page=1&limit=200×2; /agent-api/api/v1/roles?page=1&limit=200×2; /agent-api/api/v1/user/all×2; /agent-api/api/v1/user/list×2 |
| `#/identity?tab=tenant` | 200 | 2 | 6 | — | /agent-api/api/employees?limit=20×2; /agent-api/api/v1/user/all×2; /agent-api/api/v1/user/list×2 |
| `#/knowledge` | 200 | 2 | 4 | — | /agent-api/api/documents?limit=50×2; /agent-api/api/knowledge/spaces?limit=20×2 |
| `#/knowledge?tab=citations` | 200 | 2 | 6 | — | /agent-api/api/console-sessions?limit=20×2; /agent-api/api/documents?limit=50×2; /agent-api/api/knowledge/citations?limit=20×2 |
| `#/knowledge?tab=evidence` | 200 | 4 | 0 | — |  |
| `#/knowledge?tab=ingest` | 200 | 2 | 8 | — | /agent-api/api/documents?limit=50×4; /agent-api/api/knowledge/ingest-status?limit=20×2; /agent-api/api/knowledge/sources?limit=20×2 |
| `#/knowledge?tab=retrieval` | 200 | 2 | 6 | — | /agent-api/api/audit?action=kb.read&limit=50×2; /agent-api/api/documents?limit=50×2; /agent-api/api/knowledge/search?limit=12×2 |
| `#/knowledge?tab=scope` | 200 | 2 | 4 | — | /agent-api/api/documents?limit=50×2; /agent-api/api/knowledge/spaces?limit=20×2 |
| `#/knowledge?tab=sources` | 200 | 2 | 8 | — | /agent-api/api/documents?limit=50×4; /agent-api/api/knowledge/ingest-status?limit=20×2; /agent-api/api/knowledge/sources?limit=20×2 |
| `#/metrics` | 200 | 2 | 0 | — |  |
| `#/org` | 200 | 2 | 6 | — | /agent-api/api/employees?limit=20×2; /agent-api/api/v1/user/all×2; /agent-api/api/v1/user/list×2 |
| `#/overview` | 200 | 2 | 19 | 502 http://127.0.0.1:9122/agent-api/api/employee-stats | /agent-api/api/employee-stats×1; /agent-api/api/employees?limit=100×2; /agent-api/api/run-activity?weeks=2&tz=Asia%2FShanghai×2; /agent-api/api/runs?since=2026-11-16T06%3A14%3A20.716Z&limit=3×1; /agent-api/api/runs?since=2026-11-16T06%3A15%3A20.644Z&limit=3×1 … |
| `#/overview?tab=usage` | 200 | 2 | 2 | — | /agent-api/api/hermes-usage?days=30×2 |
| `#/sessions` | 200 | 2 | 4 | — | /agent-api/api/sessions?limit=20&offset=0&order=created&exclude_sources=cron%2Ctool%2Coneshot%2Capi_server%2Cacp%2Chermes_flow%2Cvulcan_delegate%2Cwebhook×2; /agent-api/api/sessions?limit=50&offset=0&order=created&exclude_sources=cron%2Ctool%2Coneshot%2Capi_server%2Cacp%2Chermes_flow%2Cvulcan_delegate%2Cwebhook×2 |
| `#/system` | 200 | 2 | 8 | — | /agent-api/api/__health-probe__×2; /agent-api/api/health×2; /agent-api/api/hermes-summary×2; /agent-api/api/skills×2 |
| `#/system?tab=defaults` | 200 | 2 | 2 | — | /agent-api/api/config×2 |
| `#/system?tab=events` | 200 | 2 | 2 | — | /agent-api/api/audit?limit=50&from=2026-11-16T06%3A14%3A26.393Z&to=2026-11-23T06%3A14%3A26.393Z×1; /agent-api/api/audit?limit=50&from=2026-11-16T06%3A15%3A26.371Z&to=2026-11-23T06%3A15%3A26.371Z×1 |
| `#/system?tab=events&view=anomaly` | 200 | 2 | 2 | — | /agent-api/api/audit?limit=50&from=2026-11-16T06%3A14%3A27.535Z&to=2026-11-23T06%3A14%3A27.535Z×1; /agent-api/api/audit?limit=50&from=2026-11-16T06%3A15%3A27.517Z&to=2026-11-23T06%3A15%3A27.517Z×1 |
| `#/system?tab=retention` | 200 | 2 | 2 | — | /agent-api/api/audit?limit=50&from=2026-11-16T06%3A14%3A28.682Z&to=2026-11-23T06%3A14%3A28.682Z×1; /agent-api/api/audit?limit=50&from=2026-11-16T06%3A15%3A28.658Z&to=2026-11-23T06%3A15%3A28.658Z×1 |
| `#/system?tab=security` | 200 | 2 | 8 | — | /agent-api/api/audit?action=credential.updated&limit=3×2; /agent-api/api/audit?action=employee.deleted&limit=3×2; /agent-api/api/audit?action=grant.created&limit=3×2; /agent-api/api/config×2 |
| `#/system?tab=version` | 200 | 2 | 6 | — | /agent-api/api/health×2; /agent-api/api/models/pricing×2; /agent-api/api/version×2 |
| `#/work` | 200 | 2 | 11 | 502 http://127.0.0.1:9122/agent-api/api/tasks?status=open&limit=50 | /agent-api/api/matrix×2; /agent-api/api/tasks?status=blocked&limit=50×2; /agent-api/api/tasks?status=cancelled&limit=50×2; /agent-api/api/tasks?status=done&limit=50×2; /agent-api/api/tasks?status=in_progress&limit=50×2 … |
| `#/work?tab=board&view=cron` | 200 | 2 | 12 | — | /agent-api/api/matrix×2; /agent-api/api/tasks?status=blocked&limit=50×2; /agent-api/api/tasks?status=cancelled&limit=50×2; /agent-api/api/tasks?status=done&limit=50×2; /agent-api/api/tasks?status=in_progress&limit=50×2 … |
| `#/work?tab=cron` | 200 | 2 | 12 | — | /agent-api/api/matrix×2; /agent-api/api/tasks?status=blocked&limit=50×2; /agent-api/api/tasks?status=cancelled&limit=50×2; /agent-api/api/tasks?status=done&limit=50×2; /agent-api/api/tasks?status=in_progress&limit=50×2 … |
| `#/work?tab=runs` | 200 | 2 | 4 | — | /agent-api/api/employees?limit=100×2; /agent-api/api/runs?since=2026-11-16T06%3A14%3A35.551Z&limit=30×1; /agent-api/api/runs?since=2026-11-16T06%3A15%3A35.495Z&limit=30×1 |

合计: whoami-401=104 api-ENV=258 非ENV=2 路由数=51 样本=102


## 5. 局限与声明

- auth 面本代 NOT MEASURED（登录态不可用，需换口令后另拍）。
- 502 为浏览器侧单次观测，服务端日志未取证（禁重启禁翻库边界内）；如 L0 需坐实可查 BFF 日志时刻 `2026-11-23T06:13~06:14Z` 前后。
- 本件不改九门账、不改代码、未发群。
