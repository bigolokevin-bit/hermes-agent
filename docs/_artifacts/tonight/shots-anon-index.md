# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 979 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73669 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43434 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 529 | yes | yes | yes | 0 | yes | 126228 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 529 | yes | yes | yes | 0 | yes | 81431 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 602 | yes | yes | yes | 0 | yes | 145558 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 602 | yes | yes | yes | 0 | yes | 77318 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 529 | yes | yes | yes | 0 | yes | 126206 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 529 | yes | yes | yes | 0 | yes | 81514 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 529 | yes | yes | yes | 0 | yes | 126692 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 529 | yes | yes | yes | 0 | yes | 81693 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 529 | yes | yes | yes | 0 | yes | 126253 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 529 | yes | yes | yes | 0 | yes | 81495 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 529 | yes | yes | yes | 0 | yes | 125850 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 529 | yes | yes | yes | 0 | yes | 81739 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 529 | yes | yes | yes | 0 | yes | 126403 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 529 | yes | yes | yes | 0 | yes | 81795 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 616 | yes | - | yes | 0 | yes | 132606 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 616 | yes | - | yes | 0 | yes | 86859 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 243 | yes | - | yes | 0 | yes | 78525 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 243 | yes | - | yes | 0 | yes | 46550 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 215 | yes | yes | - | 0 | yes | 79167 | 8 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 215 | yes | yes | - | 0 | yes | 47103 | 8 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 76483 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 45077 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 271 | yes | - | - | 0 | yes | 82189 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 271 | yes | - | - | 0 | yes | 50379 | 4 |
| `#/employees` | 列表 | 1440 | 200 | 282 | yes | - | - | 0 | yes | 87483 | 2 |
| `#/employees` | 列表 | 375 | 200 | 282 | yes | - | - | 0 | yes | 51493 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 226 | yes | - | - | 0 | yes | 81834 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 226 | yes | - | - | 0 | yes | 49532 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 44074 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13281 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 52132 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 35649 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45615 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13451 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 51643 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13470 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 51857 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13466 | 2 |
| `#/identity` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66184 | 4 |
| `#/identity` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34993 | 4 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66344 | 4 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34798 | 4 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 65838 | 4 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34548 | 4 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66272 | 4 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34969 | 4 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 147 | yes | - | - | 0 | yes | 62179 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 147 | yes | - | - | 0 | yes | 32032 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 65787 | 4 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34789 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73756 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43314 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66463 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34865 | 4 |
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
| `#/org` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66295 | 4 |
| `#/org` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34820 | 4 |
| `#/overview` | 值班台 | 1440 | 200 | 979 | yes | yes | yes | 0 | no | 156280 | 11 |
| `#/overview` | 值班台 | 375 | 200 | 979 | yes | yes | yes | 0 | no | 59968 | 11 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 152 | yes | - | - | 0 | yes | 65845 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 152 | yes | - | - | 0 | yes | 33935 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 48837 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 897 | yes | yes | yes | 0 | yes | 126762 | 5 |
| `#/system` | 系统健康 | 375 | 200 | 897 | yes | yes | yes | 0 | yes | 54662 | 5 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 125 | yes | - | yes | 0 | yes | 63002 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 125 | yes | - | yes | 0 | yes | 32759 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 616 | yes | - | yes | 0 | yes | 132947 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 616 | yes | - | yes | 0 | yes | 86856 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 616 | yes | - | yes | 0 | yes | 132650 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 616 | yes | - | yes | 0 | yes | 86819 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 616 | yes | - | yes | 0 | yes | 132718 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 616 | yes | - | yes | 0 | yes | 86851 | 2 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 317 | yes | - | - | 0 | yes | 104454 | 5 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 317 | yes | - | - | 0 | yes | 55329 | 5 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 543 | yes | - | yes | 0 | yes | 135811 | 4 |
| `#/system?tab=version` | 版本 | 375 | 200 | 543 | yes | - | yes | 0 | yes | 62056 | 4 |
| `#/work` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 99852 | 7 |
| `#/work` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 68824 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 100072 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 68468 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 100353 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 68876 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 265 | yes | - | yes | 0 | yes | 79004 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 265 | yes | - | yes | 0 | yes | 47524 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
