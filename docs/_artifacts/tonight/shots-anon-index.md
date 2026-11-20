# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 963 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73629 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43318 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 302 | yes | - | yes | 0 | yes | 94931 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 302 | yes | - | yes | 0 | yes | 61968 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 378 | yes | - | yes | 0 | yes | 115544 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 378 | yes | - | yes | 0 | yes | 63529 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 302 | yes | - | yes | 0 | yes | 95369 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 302 | yes | - | yes | 0 | yes | 61439 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 302 | yes | - | yes | 0 | yes | 94683 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 302 | yes | - | yes | 0 | yes | 61537 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 302 | yes | - | yes | 0 | yes | 95799 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 302 | yes | - | yes | 0 | yes | 61445 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 302 | yes | - | yes | 0 | yes | 95371 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 302 | yes | - | yes | 0 | yes | 61023 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 302 | yes | - | yes | 0 | yes | 95426 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 302 | yes | - | yes | 0 | yes | 61941 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 541 | yes | - | yes | 0 | yes | 117773 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 541 | yes | - | yes | 0 | yes | 72776 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 203 | yes | - | yes | 0 | yes | 78013 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 203 | yes | - | yes | 0 | yes | 46998 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 215 | yes | yes | - | 0 | yes | 79409 | 8 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 215 | yes | yes | - | 0 | yes | 47291 | 8 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 75760 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44722 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 237 | yes | - | - | 0 | yes | 81697 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 237 | yes | - | - | 0 | yes | 50022 | 4 |
| `#/employees` | 列表 | 1440 | 200 | 282 | yes | - | - | 0 | yes | 88053 | 2 |
| `#/employees` | 列表 | 375 | 200 | 282 | yes | - | - | 0 | yes | 51443 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 226 | yes | - | - | 0 | yes | 82175 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 226 | yes | - | - | 0 | yes | 49039 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 44074 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 35620 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45440 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 35675 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45615 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13451 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 68386 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 35860 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45172 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 35243 | 3 |
| `#/identity` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66112 | 4 |
| `#/identity` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 35058 | 4 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66288 | 4 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34847 | 4 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66129 | 4 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34508 | 4 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66247 | 4 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34841 | 4 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 147 | yes | - | - | 0 | yes | 62179 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 147 | yes | - | - | 0 | yes | 32032 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66153 | 4 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34572 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73596 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43194 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66060 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34803 | 4 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 517 | yes | yes | - | 0 | yes | 138447 | 3 |
| `#/knowledge` | 知识空间 | 375 | 200 | 517 | yes | yes | - | 0 | yes | 59974 | 3 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 461 | yes | yes | - | 0 | yes | 126377 | 4 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 461 | yes | yes | - | 0 | yes | 58573 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 461 | yes | yes | - | 0 | yes | 126377 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 461 | yes | yes | - | 0 | yes | 58573 | 4 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 537 | yes | yes | - | 0 | yes | 118628 | 5 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 537 | yes | yes | - | 0 | yes | 58527 | 5 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 492 | yes | yes | - | 0 | yes | 123630 | 4 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 492 | yes | yes | - | 0 | yes | 58376 | 4 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 517 | yes | yes | - | 0 | yes | 138447 | 3 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 517 | yes | yes | - | 0 | yes | 59974 | 3 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 537 | yes | yes | - | 0 | yes | 118629 | 5 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 537 | yes | yes | - | 0 | yes | 58527 | 5 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 96336 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 65962 | 4 |
| `#/org` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34804 | 4 |
| `#/overview` | 值班台 | 1440 | 200 | 963 | yes | yes | yes | 0 | no | 153662 | 12 |
| `#/overview` | 值班台 | 375 | 200 | 963 | yes | yes | yes | 0 | no | 59054 | 12 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 152 | yes | - | - | 0 | yes | 65344 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 152 | yes | - | - | 0 | yes | 33838 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 48837 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 818 | yes | yes | yes | 0 | yes | 126754 | 5 |
| `#/system` | 系统健康 | 375 | 200 | 818 | yes | yes | yes | 0 | yes | 54571 | 5 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 125 | yes | - | yes | 0 | yes | 63242 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 125 | yes | - | yes | 0 | yes | 32471 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 541 | yes | - | yes | 0 | yes | 117709 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 541 | yes | - | yes | 0 | yes | 72706 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 541 | yes | - | yes | 0 | yes | 118001 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 541 | yes | - | yes | 0 | yes | 72673 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 541 | yes | - | yes | 0 | yes | 118024 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 541 | yes | - | yes | 0 | yes | 72884 | 2 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 317 | yes | - | - | 0 | yes | 104227 | 5 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 317 | yes | - | - | 0 | yes | 55132 | 5 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 543 | yes | - | yes | 0 | yes | 136138 | 4 |
| `#/system?tab=version` | 版本 | 375 | 200 | 543 | yes | - | yes | 0 | yes | 62056 | 4 |
| `#/work` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 99984 | 7 |
| `#/work` | 任务 | 375 | 200 | 299 | yes | yes | - | 0 | yes | 67307 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 299 | yes | yes | - | 0 | yes | 98980 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 68775 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 99820 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 68618 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 265 | yes | - | yes | 0 | yes | 79617 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 265 | yes | - | yes | 0 | yes | 47548 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
