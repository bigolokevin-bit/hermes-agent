# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 1109 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73428 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43651 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 714 | yes | yes | yes | 0 | yes | 152875 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 714 | yes | yes | yes | 0 | yes | 93144 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 746 | yes | yes | yes | 0 | yes | 155169 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 746 | yes | yes | yes | 0 | yes | 91875 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 714 | yes | yes | yes | 0 | yes | 152729 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 714 | yes | yes | yes | 0 | yes | 93144 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 714 | yes | yes | yes | 0 | yes | 152953 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 714 | yes | yes | yes | 0 | yes | 93144 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 714 | yes | yes | yes | 0 | yes | 152853 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 714 | yes | yes | yes | 0 | yes | 93144 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 714 | yes | yes | yes | 0 | yes | 152853 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 714 | yes | yes | yes | 0 | yes | 93144 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 714 | yes | yes | yes | 0 | yes | 152854 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 714 | yes | yes | yes | 0 | yes | 93144 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 794 | yes | - | yes | 0 | yes | 160896 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 794 | yes | - | yes | 0 | yes | 91452 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 389 | yes | yes | yes | 0 | yes | 98966 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 389 | yes | yes | yes | 0 | yes | 61365 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 215 | yes | yes | - | 0 | yes | 79389 | 8 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 215 | yes | yes | - | 0 | yes | 47448 | 8 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 76258 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44593 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 415 | yes | yes | yes | 0 | yes | 104252 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 415 | yes | yes | yes | 0 | yes | 70901 | 4 |
| `#/employees` | 列表 | 1440 | 200 | 327 | yes | - | - | 0 | yes | 95578 | 2 |
| `#/employees` | 列表 | 375 | 200 | 327 | yes | - | - | 0 | yes | 53700 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 226 | yes | - | - | 0 | yes | 81675 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 226 | yes | - | - | 0 | yes | 49448 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 67721 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13281 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45440 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13662 | 2 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45615 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 35827 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 44964 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 35450 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 68306 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13466 | 3 |
| `#/identity` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66247 | 4 |
| `#/identity` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 35112 | 4 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66084 | 4 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34877 | 4 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66374 | 4 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34752 | 4 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66286 | 4 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 35081 | 4 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 147 | yes | - | - | 0 | yes | 62179 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 147 | yes | - | - | 0 | yes | 32032 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66130 | 4 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34906 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 74026 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43398 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66089 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 35007 | 4 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 549 | yes | yes | - | 0 | yes | 148578 | 3 |
| `#/knowledge` | 知识空间 | 375 | 200 | 549 | yes | yes | - | 0 | yes | 59269 | 3 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 477 | yes | yes | - | 0 | yes | 131469 | 4 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 477 | yes | yes | - | 0 | yes | 63078 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 477 | yes | yes | - | 0 | yes | 131469 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 477 | yes | yes | - | 0 | yes | 63078 | 4 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 553 | yes | yes | - | 0 | yes | 123710 | 5 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 553 | yes | yes | - | 0 | yes | 63031 | 5 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 508 | yes | yes | - | 0 | yes | 128700 | 4 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 508 | yes | yes | - | 0 | yes | 59541 | 4 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 549 | yes | yes | - | 0 | yes | 148578 | 3 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 549 | yes | yes | - | 0 | yes | 59269 | 3 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 553 | yes | yes | - | 0 | yes | 123710 | 5 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 553 | yes | yes | - | 0 | yes | 63031 | 5 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 96336 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66033 | 4 |
| `#/org` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34841 | 4 |
| `#/overview` | 值班台 | 1440 | 200 | 1109 | yes | yes | yes | 0 | no | 168190 | 11 |
| `#/overview` | 值班台 | 375 | 200 | 1109 | yes | yes | yes | 0 | no | 62876 | 11 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 152 | yes | - | - | 0 | yes | 65443 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 152 | yes | - | - | 0 | yes | 33906 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 48837 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 948 | yes | yes | yes | 0 | yes | 129793 | 5 |
| `#/system` | 系统健康 | 375 | 200 | 948 | yes | yes | yes | 0 | yes | 58205 | 5 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 125 | yes | - | yes | 0 | yes | 62612 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 125 | yes | - | yes | 0 | yes | 32479 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 794 | yes | - | yes | 0 | yes | 161185 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 794 | yes | - | yes | 0 | yes | 91452 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 794 | yes | - | yes | 0 | yes | 160960 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 794 | yes | - | yes | 0 | yes | 91452 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 794 | yes | - | yes | 0 | yes | 161146 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 794 | yes | - | yes | 0 | yes | 91452 | 2 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 317 | yes | - | - | 0 | yes | 104320 | 5 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 317 | yes | - | - | 0 | yes | 55229 | 5 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 596 | yes | - | yes | 0 | yes | 131584 | 4 |
| `#/system?tab=version` | 版本 | 375 | 200 | 596 | yes | - | yes | 0 | yes | 62561 | 4 |
| `#/work` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 100307 | 7 |
| `#/work` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 68965 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 99930 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 68925 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 100137 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 68733 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 464 | yes | - | yes | 0 | yes | 113927 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 464 | yes | - | yes | 0 | yes | 65408 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
