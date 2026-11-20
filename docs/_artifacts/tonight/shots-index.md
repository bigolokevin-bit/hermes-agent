# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 1109 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 201 | yes | - | - | 0 | yes | 71833 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 201 | yes | - | - | 0 | yes | 45060 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 111649 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71799 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 753 | yes | yes | yes | 0 | yes | 145545 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 753 | yes | yes | yes | 0 | yes | 92416 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 112151 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71658 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 111891 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71762 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 111915 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71861 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 112088 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71598 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 111560 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71374 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160196 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 355 | yes | yes | yes | 0 | yes | 98302 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 355 | yes | yes | yes | 0 | yes | 64808 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 10 | yes | - | - | 0 | yes | 64098 | 27 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 113 | yes | - | - | 0 | yes | 33072 | 1760 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 74597 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44494 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 390 | yes | yes | yes | 0 | yes | 103779 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 390 | yes | yes | yes | 0 | yes | 73028 | 4 |
| `#/employees` | 列表 | 1440 | 200 | 296 | yes | - | - | 0 | yes | 93971 | 2 |
| `#/employees` | 列表 | 375 | 200 | 296 | yes | - | - | 0 | yes | 52429 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 210 | yes | - | - | 0 | yes | 79343 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 210 | yes | - | - | 0 | yes | 50101 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42083 | 2 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 66 | yes | - | - | 0 | yes | 36810 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42248 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 23714 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42187 | 2 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 66 | yes | - | - | 0 | yes | 18992 | 2 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42172 | 2 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13468 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42209 | 2 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13490 | 1 |
| `#/identity` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64283 | 4 |
| `#/identity` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36742 | 4 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64459 | 4 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36673 | 4 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64656 | 4 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36545 | 4 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64571 | 4 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36667 | 4 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 143 | yes | - | - | 0 | yes | 62390 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 143 | yes | - | - | 0 | yes | 35889 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64362 | 4 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36903 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 201 | yes | - | - | 0 | yes | 71969 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 201 | yes | - | - | 0 | yes | 45001 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64416 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36580 | 4 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 549 | yes | yes | - | 0 | yes | 146561 | 3 |
| `#/knowledge` | 知识空间 | 375 | 200 | 549 | yes | yes | - | 0 | yes | 64627 | 3 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 477 | yes | yes | - | 0 | yes | 124126 | 4 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 477 | yes | yes | - | 0 | yes | 63321 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 477 | yes | yes | - | 0 | yes | 124126 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 477 | yes | yes | - | 0 | yes | 63321 | 4 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 553 | yes | yes | - | 0 | yes | 120502 | 5 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 553 | yes | yes | - | 0 | yes | 63295 | 5 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 508 | yes | yes | - | 0 | yes | 126567 | 4 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 508 | yes | yes | - | 0 | yes | 63914 | 4 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 549 | yes | yes | - | 0 | yes | 146561 | 3 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 549 | yes | yes | - | 0 | yes | 64618 | 3 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 553 | yes | yes | - | 0 | yes | 120502 | 5 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 553 | yes | yes | - | 0 | yes | 63295 | 5 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 96684 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59660 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64513 | 4 |
| `#/org` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36626 | 4 |
| `#/overview` | 值班台 | 1440 | 200 | 1109 | yes | yes | yes | 0 | no | 169942 | 11 |
| `#/overview` | 值班台 | 375 | 200 | 1109 | yes | yes | yes | 0 | no | 64868 | 11 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 136 | yes | - | - | 0 | yes | 65671 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 136 | yes | - | - | 0 | yes | 38525 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 1 | yes | - | - | 0 | yes | 35755 | 16 |
| `#/sessions` | 列表 | 375 | 200 | 10 | yes | - | - | 0 | yes | 7607 | 4115 |
| `#/system` | 系统健康 | 1440 | 200 | 948 | yes | yes | yes | 0 | yes | 121449 | 5 |
| `#/system` | 系统健康 | 375 | 200 | 948 | yes | yes | yes | 0 | yes | 62215 | 5 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 125 | yes | - | yes | 0 | yes | 63680 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 125 | yes | - | yes | 0 | yes | 36960 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160183 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160091 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160032 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 293 | yes | - | - | 0 | yes | 99106 | 5 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 293 | yes | - | - | 0 | yes | 53783 | 5 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 588 | yes | - | yes | 0 | yes | 127761 | 4 |
| `#/system?tab=version` | 版本 | 375 | 200 | 588 | yes | - | yes | 0 | yes | 63235 | 4 |
| `#/work` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 100021 | 7 |
| `#/work` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 71141 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 100123 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 70937 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 99995 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 70977 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 483 | yes | - | yes | 0 | yes | 102965 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 483 | yes | - | yes | 0 | yes | 69034 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
