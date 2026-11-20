# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 1109 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 201 | yes | - | - | 0 | yes | 71925 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 201 | yes | - | - | 0 | yes | 45068 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 110710 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71975 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 753 | yes | yes | yes | 0 | yes | 142567 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 753 | yes | yes | yes | 0 | yes | 92195 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 110768 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 72232 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 110962 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 72340 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 110476 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 72092 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 111435 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 72068 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 111508 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71909 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160243 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 97414 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 355 | yes | yes | yes | 0 | yes | 98038 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 355 | yes | yes | yes | 0 | yes | 64878 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 200 | yes | - | - | 0 | yes | 80144 | 8 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 200 | yes | - | - | 0 | yes | 51012 | 8 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 74863 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44390 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 390 | yes | yes | yes | 0 | yes | 103525 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 390 | yes | yes | yes | 0 | yes | 73473 | 4 |
| `#/employees` | 列表 | 1440 | 200 | 306 | yes | - | - | 0 | yes | 93508 | 2 |
| `#/employees` | 列表 | 375 | 200 | 306 | yes | - | - | 0 | yes | 55608 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 210 | yes | - | - | 0 | yes | 79256 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 210 | yes | - | - | 0 | yes | 50294 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 49806 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 66 | yes | - | - | 0 | yes | 36566 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 146 | yes | - | - | 0 | yes | 63876 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13514 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42086 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13476 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 49918 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 66 | yes | - | - | 0 | yes | 37194 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42082 | 2 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13493 | 3 |
| `#/identity` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64805 | 4 |
| `#/identity` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36602 | 4 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64676 | 4 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36624 | 4 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64519 | 4 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36703 | 4 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64405 | 4 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36689 | 4 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 143 | yes | - | - | 0 | yes | 62143 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 143 | yes | - | - | 0 | yes | 35889 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64412 | 4 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36881 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 201 | yes | - | - | 0 | yes | 72163 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 201 | yes | - | - | 0 | yes | 44956 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64649 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36457 | 4 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 549 | yes | yes | - | 0 | yes | 146373 | 3 |
| `#/knowledge` | 知识空间 | 375 | 200 | 549 | yes | yes | - | 0 | yes | 64618 | 3 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 477 | yes | yes | - | 0 | yes | 123933 | 4 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 477 | yes | yes | - | 0 | yes | 63321 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 477 | yes | yes | - | 0 | yes | 123933 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 477 | yes | yes | - | 0 | yes | 63321 | 4 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 553 | yes | yes | - | 0 | yes | 120309 | 5 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 553 | yes | yes | - | 0 | yes | 63295 | 5 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 508 | yes | yes | - | 0 | yes | 126374 | 4 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 508 | yes | yes | - | 0 | yes | 63914 | 4 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 549 | yes | yes | - | 0 | yes | 146373 | 3 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 549 | yes | yes | - | 0 | yes | 64618 | 3 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 553 | yes | yes | - | 0 | yes | 120309 | 5 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 553 | yes | yes | - | 0 | yes | 63295 | 5 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 96752 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59660 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64522 | 4 |
| `#/org` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36535 | 4 |
| `#/overview` | 值班台 | 1440 | 200 | 1109 | yes | yes | yes | 0 | no | 170020 | 11 |
| `#/overview` | 值班台 | 375 | 200 | 1109 | yes | yes | yes | 0 | no | 64516 | 11 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 136 | yes | - | - | 0 | yes | 66201 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 136 | yes | - | - | 0 | yes | 38528 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 50542 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 24205 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 948 | yes | yes | yes | 0 | yes | 121620 | 5 |
| `#/system` | 系统健康 | 375 | 200 | 948 | yes | yes | yes | 0 | yes | 62255 | 5 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 125 | yes | - | yes | 0 | yes | 64087 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 125 | yes | - | yes | 0 | yes | 36634 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160308 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 97496 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160217 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 97465 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160442 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 97488 | 2 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 293 | yes | - | - | 0 | yes | 98973 | 5 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 293 | yes | - | - | 0 | yes | 53761 | 5 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 588 | yes | - | yes | 0 | yes | 127883 | 4 |
| `#/system?tab=version` | 版本 | 375 | 200 | 588 | yes | - | yes | 0 | yes | 63235 | 4 |
| `#/work` | 任务 | 1440 | 200 | 261 | yes | yes | - | 0 | yes | 98784 | 7 |
| `#/work` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 71477 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 99966 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 70921 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 99717 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 71130 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 483 | yes | - | yes | 0 | yes | 120893 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 483 | yes | - | yes | 0 | yes | 73577 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
