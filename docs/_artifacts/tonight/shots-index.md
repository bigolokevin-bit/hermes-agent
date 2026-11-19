# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 729 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 75601 | 4 |
| `#/access` | 角色与权限 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 43061 | 4 |
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
| `#/audit` | 审计事件 | 1440 | 200 | 6061 | yes | yes | yes | 0 | yes | 159462 | 0 |
| `#/audit` | 审计事件 | 375 | 200 | 6061 | yes | yes | yes | 0 | yes | 78479 | 0 |
| `#/capabilities` | 技能 | 1440 | 200 | 110 | yes | - | - | 0 | yes | 62673 | 0 |
| `#/capabilities` | 技能 | 375 | 200 | 110 | yes | - | - | 0 | yes | 31176 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 1032 | yes | yes | - | 0 | yes | 168650 | 4 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 128 | yes | yes | - | 0 | yes | 33220 | 0 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 104 | yes | - | - | 0 | yes | 62534 | 0 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 375 | yes | yes | - | 0 | yes | 68738 | 2 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 214 | yes | yes | - | 0 | yes | 79246 | 2 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 214 | yes | yes | - | 0 | yes | 45419 | 2 |
| `#/employees` | 列表 | 1440 | 200 | 360 | yes | - | - | 0 | yes | 90576 | 0 |
| `#/employees` | 列表 | 375 | 200 | 335 | yes | - | - | 0 | yes | 41391 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 191 | yes | yes | - | 0 | yes | 78086 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 191 | yes | yes | - | 0 | yes | 44625 | 0 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 36 | yes | - | - | 0 | yes | 55481 | 5 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 26116 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 60177 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 16279 | 0 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 47257 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13451 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 60094 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13470 | 0 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 46830 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 25929 | 1 |
| `#/identity` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity` | 人员目录 | 375 | 200 | 375 | yes | yes | - | 0 | yes | 40382 | 6 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 151 | yes | yes | - | 0 | yes | 72270 | 3 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 151 | yes | yes | - | 0 | yes | 39241 | 3 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 75601 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 43061 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 357 | yes | yes | - | 0 | yes | 103787 | 1 |
| `#/knowledge` | 知识空间 | 375 | 200 | 357 | yes | yes | - | 0 | yes | 70241 | 1 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 448 | yes | yes | - | 0 | yes | 121294 | 1 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 448 | yes | yes | - | 0 | yes | 85842 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 448 | yes | yes | - | 0 | yes | 121153 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 448 | yes | yes | - | 0 | yes | 85892 | 1 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 747 | yes | yes | yes | 0 | yes | 173353 | 3 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 747 | yes | yes | yes | 0 | yes | 88813 | 3 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 469 | yes | yes | - | 0 | yes | 127674 | 1 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 469 | yes | yes | - | 0 | yes | 90045 | 1 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 357 | yes | yes | - | 0 | yes | 103959 | 1 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 357 | yes | yes | - | 0 | yes | 70599 | 1 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 747 | yes | yes | yes | 0 | yes | 173149 | 3 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 747 | yes | yes | yes | 0 | yes | 88941 | 3 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 97892 | 0 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 0 |
| `#/org` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/org` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/overview` | 值班台 | 1440 | 200 | 729 | yes | yes | - | 0 | no | 145694 | 0 |
| `#/overview` | 值班台 | 375 | 200 | 1276 | yes | yes | yes | 0 | no | 66052 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 369 | yes | - | - | 0 | yes | 99041 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 369 | yes | - | - | 0 | yes | 37345 | 0 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 50501 | 0 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 0 |
| `#/system` | 系统健康 | 1440 | 200 | 367 | yes | yes | yes | 0 | yes | 104289 | 0 |
| `#/system` | 系统健康 | 375 | 200 | 367 | yes | yes | yes | 0 | yes | 43016 | 0 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 236 | yes | yes | - | 0 | yes | 92256 | 1 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 236 | yes | yes | - | 0 | yes | 57258 | 1 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 6061 | yes | yes | yes | 0 | yes | 159462 | 0 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 6061 | yes | yes | yes | 0 | yes | 78479 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 6061 | yes | yes | yes | 0 | yes | 159462 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 6061 | yes | yes | yes | 0 | yes | 78479 | 0 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 6061 | yes | yes | yes | 0 | yes | 159462 | 0 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 6061 | yes | yes | yes | 0 | yes | 78479 | 0 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 857 | yes | yes | - | 0 | yes | 151982 | 1 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 837 | yes | yes | - | 0 | yes | 71203 | 1 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 426 | yes | yes | - | 0 | yes | 116990 | 1 |
| `#/system?tab=version` | 版本 | 375 | 200 | 426 | yes | yes | - | 0 | yes | 51436 | 1 |
| `#/work` | 任务 | 1440 | 200 | 1921 | yes | yes | - | 0 | yes | 130978 | 0 |
| `#/work` | 任务 | 375 | 200 | 205 | yes | yes | - | 0 | yes | 46548 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 1921 | yes | yes | - | 0 | yes | 130978 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 1921 | yes | yes | - | 0 | yes | 63693 | 0 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 1921 | yes | yes | - | 0 | yes | 130978 | 0 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 1921 | yes | yes | - | 0 | yes | 63693 | 0 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 1286 | yes | - | yes | 0 | yes | 229857 | 0 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 1258 | yes | - | yes | 0 | yes | 73325 | 0 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
