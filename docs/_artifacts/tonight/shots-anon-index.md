# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 732 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73116 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43221 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70304 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39282 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 212 | yes | - | yes | 0 | yes | 83732 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 212 | yes | - | yes | 0 | yes | 51452 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70002 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39358 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70273 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39227 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70059 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39782 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70386 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39351 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 69877 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39359 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87882 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 55966 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 156 | yes | - | yes | 0 | yes | 69071 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 156 | yes | - | yes | 0 | yes | 38648 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 215 | yes | yes | - | 0 | yes | 78733 | 8 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 215 | yes | yes | - | 0 | yes | 47283 | 8 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 75526 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44897 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 170 | yes | - | - | 0 | yes | 70420 | 1 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 170 | yes | - | - | 0 | yes | 39524 | 1 |
| `#/employees` | 列表 | 1440 | 200 | 124 | yes | - | - | 0 | yes | 60037 | 3 |
| `#/employees` | 列表 | 375 | 200 | 124 | yes | - | - | 0 | yes | 30680 | 3 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 226 | yes | - | - | 0 | yes | 80970 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 226 | yes | - | - | 0 | yes | 49266 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 43538 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 51 | yes | - | - | 0 | yes | 31662 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 64285 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13662 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45062 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13451 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 44427 | 2 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 32123 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 47977 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 32095 | 3 |
| `#/identity` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63004 | 3 |
| `#/identity` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33541 | 3 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 62928 | 3 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33810 | 3 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63137 | 3 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33462 | 3 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63110 | 3 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33305 | 3 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 147 | yes | - | - | 0 | yes | 61560 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 147 | yes | - | - | 0 | yes | 32032 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63345 | 3 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33603 | 3 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73094 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43529 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63068 | 3 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33676 | 3 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 294 | yes | yes | - | 0 | yes | 93340 | 2 |
| `#/knowledge` | 知识空间 | 375 | 200 | 294 | yes | yes | - | 0 | yes | 62252 | 2 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 197 | yes | yes | - | 0 | yes | 82669 | 1 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 197 | yes | yes | - | 0 | yes | 50139 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 197 | yes | yes | - | 0 | yes | 82669 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 197 | yes | yes | - | 0 | yes | 50139 | 1 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 88 | yes | yes | - | 0 | yes | 57888 | 1 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 88 | yes | yes | - | 0 | yes | 27492 | 1 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 197 | yes | yes | - | 0 | yes | 82669 | 1 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 197 | yes | yes | - | 0 | yes | 50139 | 1 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 294 | yes | yes | - | 0 | yes | 93340 | 2 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 294 | yes | yes | - | 0 | yes | 62252 | 2 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 88 | yes | yes | - | 0 | yes | 57888 | 1 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 88 | yes | yes | - | 0 | yes | 27492 | 1 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 95762 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63172 | 3 |
| `#/org` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33391 | 3 |
| `#/overview` | 值班台 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 125165 | 12 |
| `#/overview` | 值班台 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 53394 | 12 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 152 | yes | - | - | 0 | yes | 64596 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 152 | yes | - | - | 0 | yes | 34071 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 48301 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 405 | yes | yes | yes | 0 | yes | 98781 | 4 |
| `#/system` | 系统健康 | 375 | 200 | 405 | yes | yes | yes | 0 | yes | 65542 | 4 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 121 | yes | - | yes | 0 | yes | 60352 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 121 | yes | - | yes | 0 | yes | 30232 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87893 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56088 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87752 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56270 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87786 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56115 | 2 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87947 | 2 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 55967 | 2 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 406 | yes | - | - | 0 | yes | 109795 | 2 |
| `#/system?tab=version` | 版本 | 375 | 200 | 406 | yes | - | - | 0 | yes | 49984 | 2 |
| `#/work` | 任务 | 1440 | 200 | 255 | yes | - | - | 0 | yes | 91086 | 7 |
| `#/work` | 任务 | 375 | 200 | 255 | yes | - | - | 0 | yes | 60439 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 255 | yes | - | - | 0 | yes | 91001 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 255 | yes | - | - | 0 | yes | 60543 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 255 | yes | - | - | 0 | yes | 91319 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 255 | yes | - | - | 0 | yes | 60247 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 265 | yes | - | yes | 0 | yes | 78588 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 265 | yes | - | yes | 0 | yes | 47927 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
