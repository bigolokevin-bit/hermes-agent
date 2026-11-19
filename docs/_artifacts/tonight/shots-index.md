# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 675 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 436 | yes | yes | - | 0 | yes | 115293 | 4 |
| `#/access` | 角色与权限 | 375 | 200 | 410 | yes | yes | - | 0 | yes | 62607 | 4 |
| `#/approvals` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 71538 | 0 |
| `#/approvals` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 1386 | yes | - | - | 0 | yes | 132892 | 0 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 1386 | yes | - | - | 0 | yes | 57154 | 0 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 71538 | 0 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 71538 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 71538 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 71538 | 0 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 71538 | 0 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/audit` | 审计事件 | 1440 | 200 | 6046 | yes | yes | yes | 0 | yes | 158441 | 0 |
| `#/audit` | 审计事件 | 375 | 200 | 6046 | yes | yes | yes | 0 | yes | 77993 | 0 |
| `#/capabilities` | 技能 | 1440 | 200 | 110 | yes | - | - | 0 | yes | 62673 | 0 |
| `#/capabilities` | 技能 | 375 | 200 | 110 | yes | - | - | 0 | yes | 31176 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 128 | yes | yes | - | 0 | yes | 65612 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 1034 | yes | yes | - | 0 | yes | 86063 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 391 | yes | yes | - | 0 | yes | 118391 | 2 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 391 | yes | yes | - | 0 | yes | 70897 | 2 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 170 | yes | - | - | 0 | yes | 72589 | 0 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 170 | yes | - | - | 0 | yes | 39524 | 0 |
| `#/employees` | 列表 | 1440 | 200 | 224 | yes | - | - | 0 | yes | 77001 | 0 |
| `#/employees` | 列表 | 375 | 200 | 264 | yes | - | - | 0 | yes | 50809 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 191 | yes | yes | - | 0 | yes | 78086 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 191 | yes | yes | - | 0 | yes | 44625 | 0 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 49069 | 0 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 25906 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 60211 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13662 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 50596 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 26277 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 115 | yes | - | - | 0 | yes | 59237 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 16644 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 59982 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 25620 | 1 |
| `#/identity` | 人员目录 | 1440 | 200 | 157 | yes | yes | - | 0 | yes | 69867 | 2 |
| `#/identity` | 人员目录 | 375 | 200 | 157 | yes | yes | - | 0 | yes | 36624 | 2 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 157 | yes | yes | - | 0 | yes | 69867 | 2 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 157 | yes | yes | - | 0 | yes | 36622 | 2 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 157 | yes | yes | - | 0 | yes | 69867 | 2 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 157 | yes | yes | - | 0 | yes | 36624 | 2 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 157 | yes | yes | - | 0 | yes | 69867 | 2 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 157 | yes | yes | - | 0 | yes | 36624 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 140 | yes | yes | - | 0 | yes | 69110 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 140 | yes | yes | - | 0 | yes | 37436 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 157 | yes | yes | - | 0 | yes | 69867 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 157 | yes | yes | - | 0 | yes | 36624 | 6 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 436 | yes | yes | - | 0 | yes | 115293 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 410 | yes | yes | - | 0 | yes | 62607 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 157 | yes | yes | - | 0 | yes | 69867 | 2 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 157 | yes | yes | - | 0 | yes | 36624 | 2 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 349 | yes | yes | - | 0 | yes | 103072 | 1 |
| `#/knowledge` | 知识空间 | 375 | 200 | 349 | yes | yes | - | 0 | yes | 69608 | 1 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 426 | yes | yes | - | 0 | yes | 117356 | 1 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 426 | yes | yes | - | 0 | yes | 82181 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 426 | yes | yes | - | 0 | yes | 117269 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 426 | yes | yes | - | 0 | yes | 82281 | 1 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 538 | yes | yes | - | 0 | yes | 137653 | 2 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 538 | yes | yes | - | 0 | yes | 91962 | 2 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 469 | yes | yes | - | 0 | yes | 127776 | 1 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 469 | yes | yes | - | 0 | yes | 89685 | 1 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 349 | yes | yes | - | 0 | yes | 103351 | 1 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 349 | yes | yes | - | 0 | yes | 69623 | 1 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 538 | yes | yes | - | 0 | yes | 138008 | 2 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 538 | yes | yes | - | 0 | yes | 92135 | 2 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 97892 | 0 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 0 |
| `#/org` | 人员目录 | 1440 | 200 | 157 | yes | yes | - | 0 | yes | 69867 | 2 |
| `#/org` | 人员目录 | 375 | 200 | 157 | yes | yes | - | 0 | yes | 36624 | 2 |
| `#/overview` | 值班台 | 1440 | 200 | 1222 | yes | yes | yes | 0 | no | 150301 | 0 |
| `#/overview` | 值班台 | 375 | 200 | 1222 | yes | yes | yes | 0 | no | 63326 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 369 | yes | - | - | 0 | yes | 99041 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 369 | yes | - | - | 0 | yes | 37345 | 0 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 50500 | 0 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 0 |
| `#/system` | 系统健康 | 1440 | 200 | 251 | yes | yes | yes | 0 | yes | 81396 | 1 |
| `#/system` | 系统健康 | 375 | 200 | 251 | yes | yes | yes | 0 | yes | 46996 | 1 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 236 | yes | yes | - | 0 | yes | 92256 | 1 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 236 | yes | yes | - | 0 | yes | 57258 | 1 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 6046 | yes | yes | yes | 0 | yes | 158441 | 0 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 6046 | yes | yes | yes | 0 | yes | 77993 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 6046 | yes | yes | yes | 0 | yes | 158441 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 6046 | yes | yes | yes | 0 | yes | 77993 | 0 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 6046 | yes | yes | yes | 0 | yes | 158441 | 0 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 6046 | yes | yes | yes | 0 | yes | 77993 | 0 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 6046 | yes | yes | yes | 0 | yes | 158441 | 0 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 6046 | yes | yes | yes | 0 | yes | 77993 | 0 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 415 | yes | yes | - | 0 | yes | 115078 | 1 |
| `#/system?tab=version` | 版本 | 375 | 200 | 415 | yes | yes | - | 0 | yes | 49984 | 1 |
| `#/work` | 任务 | 1440 | 200 | 1921 | yes | yes | - | 0 | yes | 130978 | 0 |
| `#/work` | 任务 | 375 | 200 | 1921 | yes | yes | - | 0 | yes | 63693 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 1921 | yes | yes | - | 0 | yes | 130978 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 1921 | yes | yes | - | 0 | yes | 63693 | 0 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 1921 | yes | yes | - | 0 | yes | 130978 | 0 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 1921 | yes | yes | - | 0 | yes | 63693 | 0 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 1286 | yes | - | yes | 0 | yes | 230163 | 0 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 1258 | yes | - | yes | 0 | yes | 73480 | 0 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
