# lane-D screenshot evidence index

- base: `http://127.0.0.1:9119`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 0 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 110 | yes | yes | - | 0 | n/a | 79364 | 0 |
| `#/access` | 角色与权限 | 375 | 200 | 110 | yes | yes | - | 0 | n/a | 42998 | 0 |
| `#/approvals` | 待处理 | 1440 | 200 | 92 | yes | - | yes | 0 | n/a | 78412 | 0 |
| `#/approvals` | 待处理 | 375 | 200 | 92 | yes | - | yes | 0 | n/a | 42171 | 0 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 106 | yes | yes | - | 0 | n/a | 78666 | 0 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 106 | yes | yes | - | 0 | n/a | 42515 | 0 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 92 | yes | - | yes | 0 | n/a | 78412 | 0 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 92 | yes | - | yes | 0 | n/a | 42171 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 92 | yes | - | yes | 0 | n/a | 78412 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 92 | yes | - | yes | 0 | n/a | 42171 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 92 | yes | - | yes | 0 | n/a | 78412 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 92 | yes | - | yes | 0 | n/a | 42171 | 0 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 92 | yes | - | yes | 0 | n/a | 78412 | 0 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 92 | yes | - | yes | 0 | n/a | 42171 | 0 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 92 | yes | - | yes | 0 | n/a | 78412 | 0 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 92 | yes | - | yes | 0 | n/a | 42171 | 0 |
| `#/audit` | 审计事件 | 1440 | 200 | 132 | yes | yes | - | 0 | n/a | 80681 | 0 |
| `#/audit` | 审计事件 | 375 | 200 | 132 | yes | yes | - | 0 | n/a | 44623 | 0 |
| `#/capabilities` | 技能 | 1440 | 200 | 3378 | yes | - | - | 0 | n/a | 148038 | 0 |
| `#/capabilities` | 技能 | 375 | 200 | 3217 | yes | - | - | 0 | n/a | 43723 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 38 | yes | - | - | 0 | n/a | 67266 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 38 | yes | - | - | 0 | n/a | 31414 | 0 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 796 | yes | - | - | 0 | n/a | 113516 | 0 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 796 | yes | - | - | 0 | n/a | 44128 | 0 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 10632 | yes | - | - | 0 | n/a | 136375 | 0 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 10632 | yes | - | - | 0 | n/a | 47347 | 0 |
| `#/employees` | 列表 | 1440 | 200 | 113 | yes | - | yes | 0 | n/a | 74872 | 0 |
| `#/employees` | 列表 | 375 | 200 | 113 | yes | - | yes | 0 | n/a | 39030 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 376 | yes | - | - | 0 | n/a | 126830 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 376 | yes | - | - | 0 | n/a | 56461 | 0 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 102 | yes | - | yes | 0 | n/a | 72349 | 0 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 102 | yes | - | yes | 0 | n/a | 36386 | 0 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 102 | yes | - | yes | 0 | n/a | 73690 | 0 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 102 | yes | - | yes | 0 | n/a | 23747 | 0 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 102 | yes | - | yes | 0 | n/a | 73854 | 0 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 102 | yes | - | yes | 0 | n/a | 37833 | 0 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 102 | yes | - | yes | 0 | n/a | 73223 | 0 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 102 | yes | - | yes | 0 | n/a | 37201 | 0 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 102 | yes | - | yes | 0 | n/a | 73429 | 0 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 102 | yes | - | yes | 0 | n/a | 37402 | 0 |
| `#/identity` | 人员目录 | 1440 | 200 | 118 | yes | yes | - | 0 | n/a | 80176 | 0 |
| `#/identity` | 人员目录 | 375 | 200 | 118 | yes | yes | - | 0 | n/a | 43790 | 0 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 118 | yes | yes | - | 0 | n/a | 80176 | 0 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 118 | yes | yes | - | 0 | n/a | 43790 | 0 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 118 | yes | yes | - | 0 | n/a | 80176 | 0 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 118 | yes | yes | - | 0 | n/a | 43790 | 0 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 118 | yes | yes | - | 0 | n/a | 80176 | 0 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 118 | yes | yes | - | 0 | n/a | 43790 | 0 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 115 | yes | yes | - | 0 | n/a | 79492 | 0 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 115 | yes | yes | - | 0 | n/a | 43221 | 0 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 118 | yes | yes | - | 0 | n/a | 80176 | 0 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 118 | yes | yes | - | 0 | n/a | 43790 | 0 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 110 | yes | yes | - | 0 | n/a | 79364 | 0 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 110 | yes | yes | - | 0 | n/a | 42998 | 0 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 118 | yes | yes | - | 0 | n/a | 80176 | 0 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 118 | yes | yes | - | 0 | n/a | 43790 | 0 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 120 | yes | yes | - | 0 | n/a | 81855 | 0 |
| `#/knowledge` | 知识空间 | 375 | 200 | 120 | yes | yes | - | 0 | n/a | 45135 | 0 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 123 | yes | yes | - | 0 | n/a | 80473 | 0 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 123 | yes | yes | - | 0 | n/a | 44170 | 0 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 123 | yes | yes | - | 0 | n/a | 80473 | 0 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 123 | yes | yes | - | 0 | n/a | 44170 | 0 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 95 | yes | yes | - | 0 | n/a | 79505 | 0 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 95 | yes | yes | - | 0 | n/a | 43079 | 0 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 123 | yes | yes | - | 0 | n/a | 80473 | 0 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 123 | yes | yes | - | 0 | n/a | 44170 | 0 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 120 | yes | yes | - | 0 | n/a | 81855 | 0 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 120 | yes | yes | - | 0 | n/a | 45135 | 0 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 95 | yes | yes | - | 0 | n/a | 79505 | 0 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 95 | yes | yes | - | 0 | n/a | 43079 | 0 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | n/a | 116805 | 0 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | n/a | 61345 | 0 |
| `#/org` | 人员目录 | 1440 | 200 | 118 | yes | yes | - | 0 | n/a | 80176 | 0 |
| `#/org` | 人员目录 | 375 | 200 | 118 | yes | yes | - | 0 | n/a | 43790 | 0 |
| `#/overview` | 值班台 | 1440 | 200 | 488 | yes | yes | yes | 0 | n/a | 137353 | 0 |
| `#/overview` | 值班台 | 375 | 200 | 488 | yes | yes | yes | 0 | n/a | 40571 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 842 | yes | - | - | 0 | n/a | 122535 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 842 | yes | - | - | 0 | n/a | 53917 | 0 |
| `#/sessions` | 列表 | 1440 | 200 | 352 | yes | - | - | 0 | n/a | 92932 | 0 |
| `#/sessions` | 列表 | 375 | 200 | 352 | yes | - | - | 0 | n/a | 38971 | 0 |
| `#/system` | 系统健康 | 1440 | 200 | 2040 | yes | - | - | 0 | n/a | 126635 | 0 |
| `#/system` | 系统健康 | 375 | 200 | 2039 | yes | - | - | 0 | n/a | 48964 | 0 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 134 | yes | yes | - | 0 | n/a | 83982 | 0 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 134 | yes | yes | - | 0 | n/a | 47338 | 0 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 132 | yes | yes | - | 0 | n/a | 80681 | 0 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 132 | yes | yes | - | 0 | n/a | 44623 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 132 | yes | yes | - | 0 | n/a | 80681 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 132 | yes | yes | - | 0 | n/a | 44623 | 0 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 132 | yes | yes | - | 0 | n/a | 80681 | 0 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 132 | yes | yes | - | 0 | n/a | 44623 | 0 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 132 | yes | yes | - | 0 | n/a | 80681 | 0 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 132 | yes | yes | - | 0 | n/a | 44623 | 0 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 90 | yes | yes | - | 0 | n/a | 78786 | 0 |
| `#/system?tab=version` | 版本 | 375 | 200 | 90 | yes | yes | - | 0 | n/a | 42711 | 0 |
| `#/work` | 任务 | 1440 | 200 | 175 | yes | - | - | 0 | n/a | 98781 | 0 |
| `#/work` | 任务 | 375 | 200 | 175 | yes | - | - | 0 | n/a | 50343 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 175 | yes | - | - | 0 | n/a | 98781 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 175 | yes | - | - | 0 | n/a | 50343 | 0 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 175 | yes | - | - | 0 | n/a | 98781 | 0 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 175 | yes | - | - | 0 | n/a | 50343 | 0 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 210 | yes | - | yes | 0 | n/a | 97234 | 0 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 210 | yes | - | yes | 0 | n/a | 48091 | 0 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
