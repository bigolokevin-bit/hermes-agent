# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 963 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73624 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43269 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 286 | yes | - | yes | 0 | yes | 91661 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 286 | yes | - | yes | 0 | yes | 58781 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 363 | yes | - | yes | 0 | yes | 112510 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 363 | yes | - | yes | 0 | yes | 65488 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 286 | yes | - | yes | 0 | yes | 90970 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 286 | yes | - | yes | 0 | yes | 58755 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 286 | yes | - | yes | 0 | yes | 91627 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 286 | yes | - | yes | 0 | yes | 58498 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 286 | yes | - | yes | 0 | yes | 91302 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 286 | yes | - | yes | 0 | yes | 58551 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 286 | yes | - | yes | 0 | yes | 91493 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 286 | yes | - | yes | 0 | yes | 58667 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 286 | yes | - | yes | 0 | yes | 91705 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 286 | yes | - | yes | 0 | yes | 58166 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 445 | yes | - | yes | 0 | yes | 101189 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 445 | yes | - | yes | 0 | yes | 64221 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 200 | yes | - | yes | 0 | yes | 77386 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 200 | yes | - | yes | 0 | yes | 46039 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 215 | yes | yes | - | 0 | yes | 79757 | 8 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 215 | yes | yes | - | 0 | yes | 47358 | 8 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 75894 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44947 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 234 | yes | - | - | 0 | yes | 80984 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 234 | yes | - | - | 0 | yes | 49565 | 4 |
| `#/employees` | 列表 | 1440 | 200 | 241 | yes | - | - | 0 | yes | 81838 | 2 |
| `#/employees` | 列表 | 375 | 200 | 241 | yes | - | - | 0 | yes | 49585 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 226 | yes | - | - | 0 | yes | 81528 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 226 | yes | - | - | 0 | yes | 49333 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 44074 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13281 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45440 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13662 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45615 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13451 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 68602 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 66 | yes | - | - | 0 | yes | 34966 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45172 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 19883 | 3 |
| `#/identity` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66224 | 4 |
| `#/identity` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 35021 | 4 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66314 | 4 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 35039 | 4 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 65986 | 4 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34450 | 4 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 65977 | 4 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34887 | 4 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 147 | yes | - | - | 0 | yes | 62179 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 147 | yes | - | - | 0 | yes | 32032 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66209 | 4 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34798 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73780 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43356 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66360 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 35013 | 4 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 425 | yes | yes | - | 0 | yes | 123185 | 3 |
| `#/knowledge` | 知识空间 | 375 | 200 | 425 | yes | yes | - | 0 | yes | 66064 | 3 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 454 | yes | yes | - | 0 | yes | 128377 | 4 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 454 | yes | yes | - | 0 | yes | 63749 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 454 | yes | yes | - | 0 | yes | 128377 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 454 | yes | yes | - | 0 | yes | 63749 | 4 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 530 | yes | yes | - | 0 | yes | 122008 | 5 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 530 | yes | yes | - | 0 | yes | 63712 | 5 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 485 | yes | yes | - | 0 | yes | 125570 | 4 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 485 | yes | yes | - | 0 | yes | 64397 | 4 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 425 | yes | yes | - | 0 | yes | 123185 | 3 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 425 | yes | yes | - | 0 | yes | 66064 | 3 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 530 | yes | yes | - | 0 | yes | 122008 | 5 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 530 | yes | yes | - | 0 | yes | 63712 | 5 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 96336 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66074 | 4 |
| `#/org` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34824 | 4 |
| `#/overview` | 值班台 | 1440 | 200 | 963 | yes | yes | yes | 0 | no | 153738 | 12 |
| `#/overview` | 值班台 | 375 | 200 | 963 | yes | yes | yes | 0 | no | 58243 | 12 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 152 | yes | - | - | 0 | yes | 65665 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 152 | yes | - | - | 0 | yes | 34262 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 48837 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 818 | yes | yes | yes | 0 | yes | 126940 | 5 |
| `#/system` | 系统健康 | 375 | 200 | 818 | yes | yes | yes | 0 | yes | 54490 | 5 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 125 | yes | - | yes | 0 | yes | 63208 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 125 | yes | - | yes | 0 | yes | 32317 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 445 | yes | - | yes | 0 | yes | 101212 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 445 | yes | - | yes | 0 | yes | 64126 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 445 | yes | - | yes | 0 | yes | 101175 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 445 | yes | - | yes | 0 | yes | 64030 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 445 | yes | - | yes | 0 | yes | 101130 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 445 | yes | - | yes | 0 | yes | 64006 | 2 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 317 | yes | - | - | 0 | yes | 104336 | 5 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 317 | yes | - | - | 0 | yes | 55219 | 5 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 543 | yes | - | yes | 0 | yes | 136388 | 4 |
| `#/system?tab=version` | 版本 | 375 | 200 | 543 | yes | - | yes | 0 | yes | 62056 | 4 |
| `#/work` | 任务 | 1440 | 200 | 299 | yes | yes | - | 0 | yes | 98980 | 7 |
| `#/work` | 任务 | 375 | 200 | 299 | yes | yes | - | 0 | yes | 67307 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 100138 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 68925 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 99827 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 68786 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 265 | yes | - | yes | 0 | yes | 79701 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 265 | yes | - | yes | 0 | yes | 48189 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
