# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 963 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73714 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43317 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70756 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 38906 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 212 | yes | - | yes | 0 | yes | 84235 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 212 | yes | - | yes | 0 | yes | 51470 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70345 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39352 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 71286 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39165 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70597 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39170 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70218 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39789 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70408 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39292 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 379 | yes | yes | yes | 0 | yes | 86854 | 6 |
| `#/audit` | 审计事件 | 375 | 200 | 379 | yes | yes | yes | 0 | yes | 54657 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 156 | yes | - | yes | 0 | yes | 69288 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 156 | yes | - | yes | 0 | yes | 38297 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 215 | yes | yes | - | 0 | yes | 79642 | 8 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 215 | yes | yes | - | 0 | yes | 47092 | 8 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 75773 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44462 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 170 | yes | - | - | 0 | yes | 71028 | 1 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 170 | yes | - | - | 0 | yes | 39524 | 1 |
| `#/employees` | 列表 | 1440 | 200 | 124 | yes | - | - | 0 | yes | 60586 | 3 |
| `#/employees` | 列表 | 375 | 200 | 124 | yes | - | - | 0 | yes | 31276 | 3 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 226 | yes | - | - | 0 | yes | 81575 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 226 | yes | - | - | 0 | yes | 49247 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 44074 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 16438 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 64674 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 51 | yes | - | - | 0 | yes | 31813 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 65381 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 16633 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 44964 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 32343 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 64978 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 51 | yes | - | - | 0 | yes | 31622 | 3 |
| `#/identity` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66147 | 3 |
| `#/identity` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34742 | 3 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66303 | 3 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34672 | 3 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66510 | 3 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34615 | 3 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66326 | 3 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34755 | 3 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 147 | yes | - | - | 0 | yes | 62179 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 147 | yes | - | - | 0 | yes | 32032 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66007 | 3 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34869 | 3 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73673 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43406 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66350 | 3 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34939 | 3 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 239 | yes | yes | - | 0 | yes | 84214 | 2 |
| `#/knowledge` | 知识空间 | 375 | 200 | 239 | yes | yes | - | 0 | yes | 51988 | 2 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 317 | yes | yes | - | 0 | yes | 100504 | 3 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 317 | yes | yes | - | 0 | yes | 67111 | 3 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 317 | yes | yes | - | 0 | yes | 100504 | 3 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 317 | yes | yes | - | 0 | yes | 67111 | 3 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 318 | yes | yes | - | 0 | yes | 100861 | 3 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 318 | yes | yes | - | 0 | yes | 67504 | 3 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 348 | yes | yes | - | 0 | yes | 109557 | 3 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 348 | yes | yes | - | 0 | yes | 73648 | 3 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 239 | yes | yes | - | 0 | yes | 84214 | 2 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 239 | yes | yes | - | 0 | yes | 51988 | 2 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 318 | yes | yes | - | 0 | yes | 100861 | 3 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 318 | yes | yes | - | 0 | yes | 67504 | 3 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 96336 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 65996 | 3 |
| `#/org` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 35101 | 3 |
| `#/overview` | 值班台 | 1440 | 200 | 963 | yes | yes | yes | 0 | no | 153892 | 12 |
| `#/overview` | 值班台 | 375 | 200 | 963 | yes | yes | yes | 0 | no | 58431 | 12 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 152 | yes | - | - | 0 | yes | 65562 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 152 | yes | - | - | 0 | yes | 34180 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 48837 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 333 | yes | yes | yes | 0 | yes | 94726 | 4 |
| `#/system` | 系统健康 | 375 | 200 | 333 | yes | yes | yes | 0 | yes | 59899 | 4 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 121 | yes | - | yes | 0 | yes | 60956 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 118 | yes | - | yes | 0 | yes | 39764 | 6 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 379 | yes | yes | yes | 0 | yes | 86809 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 379 | yes | yes | yes | 0 | yes | 54726 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 379 | yes | yes | yes | 0 | yes | 87139 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 379 | yes | yes | yes | 0 | yes | 54725 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 379 | yes | yes | yes | 0 | yes | 87045 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 379 | yes | yes | yes | 0 | yes | 54724 | 2 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 379 | yes | yes | yes | 0 | yes | 87157 | 2 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 379 | yes | yes | yes | 0 | yes | 54675 | 2 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 414 | yes | - | - | 0 | yes | 113382 | 2 |
| `#/system?tab=version` | 版本 | 375 | 200 | 414 | yes | - | - | 0 | yes | 49984 | 2 |
| `#/work` | 任务 | 1440 | 200 | 315 | yes | yes | - | 0 | yes | 98402 | 7 |
| `#/work` | 任务 | 375 | 200 | 315 | yes | yes | - | 0 | yes | 67049 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 315 | yes | yes | - | 0 | yes | 98214 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 315 | yes | yes | - | 0 | yes | 67123 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 315 | yes | yes | - | 0 | yes | 98470 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 315 | yes | yes | - | 0 | yes | 67301 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 265 | yes | - | yes | 0 | yes | 79622 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 265 | yes | - | yes | 0 | yes | 47697 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
