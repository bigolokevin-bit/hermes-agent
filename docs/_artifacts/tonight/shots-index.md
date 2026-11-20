# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 1109 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 201 | yes | - | - | 0 | yes | 72345 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 201 | yes | - | - | 0 | yes | 44741 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 474 | yes | yes | yes | 0 | yes | 113832 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 474 | yes | yes | yes | 0 | yes | 73299 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 761 | yes | yes | yes | 0 | yes | 147231 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 761 | yes | yes | yes | 0 | yes | 93939 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 474 | yes | yes | yes | 0 | yes | 113519 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 474 | yes | yes | yes | 0 | yes | 73322 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 474 | yes | yes | yes | 0 | yes | 113826 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 474 | yes | yes | yes | 0 | yes | 73289 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 474 | yes | yes | yes | 0 | yes | 114040 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 474 | yes | yes | yes | 0 | yes | 73075 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 474 | yes | yes | yes | 0 | yes | 113648 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 474 | yes | yes | yes | 0 | yes | 72962 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 474 | yes | yes | yes | 0 | yes | 113824 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 474 | yes | yes | yes | 0 | yes | 73450 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160124 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 355 | yes | yes | yes | 0 | yes | 97952 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 355 | yes | yes | yes | 0 | yes | 65087 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 0 | NO | - | - | -1 | yes | 31018 | 4760 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 113 | yes | - | - | 0 | yes | 37673 | 25 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 74804 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44726 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 390 | yes | yes | yes | 0 | yes | 103481 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 390 | yes | yes | yes | 0 | yes | 73002 | 4 |
| `#/employees` | 列表 | 1440 | 200 | 296 | yes | - | - | 0 | yes | 93994 | 2 |
| `#/employees` | 列表 | 375 | 200 | 296 | yes | - | - | 0 | yes | 52429 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 210 | yes | - | - | 0 | yes | 79540 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 210 | yes | - | - | 0 | yes | 50712 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42083 | 2 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 36822 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 50001 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13511 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42214 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13477 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42209 | 2 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13475 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 63399 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13495 | 1 |
| `#/identity` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64290 | 4 |
| `#/identity` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36610 | 4 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64519 | 4 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36475 | 4 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64286 | 4 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36605 | 4 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64673 | 4 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36819 | 4 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 143 | yes | - | - | 0 | yes | 62390 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 143 | yes | - | - | 0 | yes | 35889 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64276 | 4 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36767 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 201 | yes | - | - | 0 | yes | 72073 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 201 | yes | - | - | 0 | yes | 45033 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64312 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36552 | 4 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 549 | yes | yes | - | 0 | yes | 146561 | 3 |
| `#/knowledge` | 知识空间 | 375 | 200 | 549 | yes | yes | - | 0 | yes | 64618 | 3 |
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
| `#/org` | 人员目录 | 1440 | 200 | 151 | yes | - | - | 0 | yes | 64606 | 4 |
| `#/org` | 人员目录 | 375 | 200 | 151 | yes | - | - | 0 | yes | 36653 | 4 |
| `#/overview` | 值班台 | 1440 | 200 | 1109 | yes | yes | yes | 0 | no | 170068 | 11 |
| `#/overview` | 值班台 | 375 | 200 | 1109 | yes | yes | yes | 0 | no | 64369 | 11 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 136 | yes | - | - | 0 | yes | 65746 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 136 | yes | - | - | 0 | yes | 38274 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 1 | yes | - | - | 0 | yes | 37447 | 4249 |
| `#/sessions` | 列表 | 375 | 200 | 10 | yes | - | - | 0 | yes | 7607 | 12 |
| `#/system` | 系统健康 | 1440 | 200 | 948 | yes | yes | yes | 0 | yes | 121561 | 5 |
| `#/system` | 系统健康 | 375 | 200 | 948 | yes | yes | yes | 0 | yes | 61994 | 5 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 125 | yes | - | yes | 0 | yes | 64064 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 125 | yes | - | yes | 0 | yes | 36689 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160055 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 159952 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160185 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 293 | yes | - | - | 0 | yes | 99176 | 5 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 293 | yes | - | - | 0 | yes | 53628 | 5 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 588 | yes | - | yes | 0 | yes | 127761 | 4 |
| `#/system?tab=version` | 版本 | 375 | 200 | 588 | yes | - | yes | 0 | yes | 63235 | 4 |
| `#/work` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 99738 | 7 |
| `#/work` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 71335 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 99813 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 70844 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 100474 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 70732 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 483 | yes | - | yes | 0 | yes | 102667 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 483 | yes | - | yes | 0 | yes | 68957 | 3 |

- routes with empty main (any viewport): `#/capabilities?tab=channels`
- routes with no <main> element at all: `#/capabilities?tab=channels`

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
