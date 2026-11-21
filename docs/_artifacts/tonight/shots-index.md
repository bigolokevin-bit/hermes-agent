# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **100**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 1061 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 201 | yes | - | - | 0 | yes | 72039 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 201 | yes | - | - | 0 | yes | 44887 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 112223 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71503 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 530 | yes | yes | yes | 0 | yes | 129423 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 530 | yes | yes | yes | 0 | yes | 71621 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 111941 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71571 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 111706 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71865 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 112380 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71256 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 112068 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71898 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 466 | yes | yes | yes | 0 | yes | 112046 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 466 | yes | yes | yes | 0 | yes | 71623 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160331 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 355 | yes | yes | yes | 0 | yes | 97828 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 355 | yes | yes | yes | 0 | yes | 64054 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 113 | yes | - | - | 0 | yes | 31018 | 9138 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 113 | yes | - | - | 0 | yes | 37673 | 9692 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 74603 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44416 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 390 | yes | yes | yes | 0 | yes | 103139 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 390 | yes | yes | yes | 0 | yes | 73185 | 4 |
| `#/employees` | 列表 | 1440 | 200 | 296 | yes | - | - | 0 | yes | 93941 | 2 |
| `#/employees` | 列表 | 375 | 200 | 296 | yes | - | - | 0 | yes | 52429 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 82087 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 52456 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 49842 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 36920 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42256 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 19561 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42214 | 2 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 66 | yes | - | - | 0 | yes | 36864 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42209 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 37062 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 49966 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 23709 | 3 |
| `#/identity` | 人员目录 | 1440 | 200 | 154 | yes | - | - | 0 | yes | 66538 | 4 |
| `#/identity` | 人员目录 | 375 | 200 | 154 | yes | - | - | 0 | yes | 38958 | 4 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 154 | yes | - | - | 0 | yes | 66687 | 4 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 154 | yes | - | - | 0 | yes | 38736 | 4 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 154 | yes | - | - | 0 | yes | 66630 | 4 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 154 | yes | - | - | 0 | yes | 38917 | 4 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 154 | yes | - | - | 0 | yes | 66276 | 4 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 154 | yes | - | - | 0 | yes | 38732 | 4 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 143 | yes | - | - | 0 | yes | 62370 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 143 | yes | - | - | 0 | yes | 35896 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 154 | yes | - | - | 0 | yes | 66688 | 4 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 154 | yes | - | - | 0 | yes | 38718 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 201 | yes | - | - | 0 | yes | 71943 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 201 | yes | - | - | 0 | yes | 45097 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 154 | yes | - | - | 0 | yes | 66904 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 154 | yes | - | - | 0 | yes | 38753 | 4 |
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
| `#/org` | 人员目录 | 1440 | 200 | 154 | yes | - | - | 0 | yes | 66676 | 4 |
| `#/org` | 人员目录 | 375 | 200 | 154 | yes | - | - | 0 | yes | 39071 | 4 |
| `#/overview` | 值班台 | 1440 | 200 | 1061 | yes | yes | yes | 0 | no | 141160 | 11 |
| `#/overview` | 值班台 | 375 | 200 | 1061 | yes | yes | yes | 0 | no | 53913 | 11 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 136 | yes | - | - | 0 | yes | 66038 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 136 | yes | - | - | 0 | yes | 38539 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 10 | yes | - | - | 0 | yes | 0 | 10962 |
| `#/sessions` | 列表 | 375 | 200 | 1 | yes | - | - | 0 | yes | 0 | 12869 |
| `#/system` | 系统健康 | 1440 | 200 | 948 | yes | yes | yes | 0 | yes | 121641 | 5 |
| `#/system` | 系统健康 | 375 | 200 | 948 | yes | yes | yes | 0 | yes | 62125 | 5 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 125 | yes | - | yes | 0 | yes | 63506 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 125 | yes | - | yes | 0 | yes | 36694 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160311 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160321 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 160247 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 88452 | 2 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 293 | yes | - | - | 0 | yes | 99080 | 5 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 293 | yes | - | - | 0 | yes | 53712 | 5 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 588 | yes | - | yes | 0 | yes | 127761 | 4 |
| `#/system?tab=version` | 版本 | 375 | 200 | 588 | yes | - | yes | 0 | yes | 63235 | 4 |
| `#/work` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 99720 | 7 |
| `#/work` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 70836 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 99978 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 70837 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 99953 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 70806 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 483 | yes | - | yes | 0 | yes | 102590 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 483 | yes | - | yes | 0 | yes | 69099 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- #/sessions @ 1440: screenshot: cdpSession.send: Protocol error (Page.captureScreenshot): Unable to capture screenshot
- #/sessions @ 375: screenshot: cdpSession.send: Protocol error (Page.captureScreenshot): Unable to capture screenshot
