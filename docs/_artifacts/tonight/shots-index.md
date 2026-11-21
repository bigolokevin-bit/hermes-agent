# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 1061 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 199 | yes | - | - | 0 | yes | 63181 | 10 |
| `#/access` | 角色与权限 | 375 | 200 | 201 | yes | - | - | 0 | yes | 45006 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 112269 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71763 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 753 | yes | yes | yes | 0 | yes | 145717 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 753 | yes | yes | yes | 0 | yes | 92558 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 112390 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71679 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 112232 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71911 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 112391 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 72066 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 112300 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71800 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 112275 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71640 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160864 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 355 | yes | yes | yes | 0 | yes | 98014 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 355 | yes | yes | yes | 0 | yes | 65320 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 113 | yes | - | - | 0 | yes | 60675 | 4840 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 113 | yes | - | - | 0 | yes | 37680 | 14 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 74820 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44730 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 390 | yes | yes | yes | 0 | yes | 103390 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 390 | yes | yes | yes | 0 | yes | 73329 | 4 |
| `#/employees` | 列表 | 1440 | 200 | 296 | yes | - | - | 0 | yes | 93705 | 2 |
| `#/employees` | 列表 | 375 | 200 | 296 | yes | - | - | 0 | yes | 52429 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 81998 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 52987 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 48249 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 36936 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42251 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13504 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 49459 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 18992 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42203 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13468 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42175 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13493 | 1 |
| `#/identity` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64447 | 4 |
| `#/identity` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36799 | 4 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64452 | 4 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36646 | 4 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64564 | 4 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36818 | 4 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64339 | 4 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36673 | 4 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 143 | yes | - | - | 0 | yes | 62390 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 143 | yes | - | - | 0 | yes | 35889 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64590 | 4 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36600 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 201 | yes | - | - | 0 | yes | 72115 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 201 | yes | - | - | 0 | yes | 45360 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64302 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36931 | 4 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 549 | yes | yes | - | 0 | yes | 146561 | 3 |
| `#/knowledge` | 知识空间 | 375 | 200 | 549 | yes | yes | - | 0 | yes | 64618 | 3 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 477 | yes | yes | - | 0 | yes | 124126 | 4 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 477 | yes | yes | - | 0 | yes | 63321 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 477 | yes | yes | - | 0 | yes | 124126 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 477 | yes | yes | - | 0 | yes | 63321 | 4 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 553 | yes | yes | - | 0 | yes | 120502 | 5 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 553 | yes | yes | - | 0 | yes | 63295 | 5 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 508 | yes | yes | - | 0 | yes | 126568 | 4 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 508 | yes | yes | - | 0 | yes | 63914 | 4 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 549 | yes | yes | - | 0 | yes | 146561 | 3 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 549 | yes | yes | - | 0 | yes | 64618 | 3 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 553 | yes | yes | - | 0 | yes | 120502 | 5 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 553 | yes | yes | - | 0 | yes | 63295 | 5 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 96684 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59660 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64690 | 4 |
| `#/org` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36774 | 4 |
| `#/overview` | 值班台 | 1440 | 200 | 1061 | yes | yes | yes | 0 | no | 140702 | 11 |
| `#/overview` | 值班台 | 375 | 200 | 1061 | yes | yes | yes | 0 | no | 53921 | 11 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 136 | yes | - | - | 0 | yes | 65939 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 136 | yes | - | - | 0 | yes | 38594 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 0 | NO | - | - | -1 | yes | 37447 | 2701 |
| `#/sessions` | 列表 | 375 | 200 | 1 | yes | - | - | 0 | yes | 7607 | 5337 |
| `#/system` | 系统健康 | 1440 | 200 | 948 | yes | yes | yes | 0 | yes | 121711 | 5 |
| `#/system` | 系统健康 | 375 | 200 | 948 | yes | yes | yes | 0 | yes | 62180 | 5 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 125 | yes | - | yes | 0 | yes | 63714 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 125 | yes | - | yes | 0 | yes | 36528 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160769 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 161076 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160806 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 293 | yes | - | - | 0 | yes | 99108 | 5 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 293 | yes | - | - | 0 | yes | 53835 | 5 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 588 | yes | - | yes | 0 | yes | 127761 | 4 |
| `#/system?tab=version` | 版本 | 375 | 200 | 588 | yes | - | yes | 0 | yes | 63235 | 4 |
| `#/work` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 99961 | 7 |
| `#/work` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 70577 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 99919 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 70814 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 99817 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 70549 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 483 | yes | - | yes | 0 | yes | 103162 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 483 | yes | - | yes | 0 | yes | 68936 | 3 |

- routes with empty main (any viewport): `#/sessions`
- routes with no <main> element at all: `#/sessions`

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
