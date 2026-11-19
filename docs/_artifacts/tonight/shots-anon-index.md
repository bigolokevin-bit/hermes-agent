# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 732 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73037 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43335 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70388 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39850 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 212 | yes | - | yes | 0 | yes | 83342 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 212 | yes | - | yes | 0 | yes | 51319 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70835 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39158 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70770 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39014 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70268 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39578 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70301 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39393 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70506 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 38946 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87708 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56089 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 156 | yes | - | yes | 0 | yes | 69268 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 156 | yes | - | yes | 0 | yes | 37966 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 215 | yes | yes | - | 0 | yes | 79177 | 8 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 215 | yes | yes | - | 0 | yes | 46972 | 8 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 75783 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44781 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 170 | yes | - | - | 0 | yes | 70420 | 1 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 170 | yes | - | - | 0 | yes | 39524 | 1 |
| `#/employees` | 列表 | 1440 | 200 | 124 | yes | - | - | 0 | yes | 60224 | 3 |
| `#/employees` | 列表 | 375 | 200 | 124 | yes | - | - | 0 | yes | 31251 | 3 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 226 | yes | - | - | 0 | yes | 80624 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 226 | yes | - | - | 0 | yes | 49781 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 46891 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 51 | yes | - | - | 0 | yes | 31595 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 44888 | 2 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13662 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45062 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13451 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 63756 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 32199 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 63820 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 31878 | 3 |
| `#/identity` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63130 | 3 |
| `#/identity` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33293 | 3 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63144 | 3 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33191 | 3 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63006 | 3 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33475 | 3 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63233 | 3 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33465 | 3 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 147 | yes | - | - | 0 | yes | 61560 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 147 | yes | - | - | 0 | yes | 32032 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 62899 | 3 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33314 | 3 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73157 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43545 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63169 | 3 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33592 | 3 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 294 | yes | yes | - | 0 | yes | 93340 | 2 |
| `#/knowledge` | 知识空间 | 375 | 200 | 294 | yes | yes | - | 0 | yes | 62252 | 2 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 197 | yes | yes | - | 0 | yes | 82669 | 1 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 197 | yes | yes | - | 0 | yes | 50139 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 197 | yes | yes | - | 0 | yes | 82669 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 197 | yes | yes | - | 0 | yes | 50139 | 1 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 88 | yes | yes | - | 0 | yes | 57888 | 1 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 88 | yes | yes | - | 0 | yes | 27492 | 1 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 197 | yes | yes | - | 0 | yes | 82669 | 1 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 197 | yes | yes | - | 0 | yes | 50139 | 1 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 294 | yes | yes | - | 0 | yes | 93340 | 2 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 294 | yes | yes | - | 0 | yes | 62252 | 2 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 88 | yes | yes | - | 0 | yes | 57888 | 1 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 88 | yes | yes | - | 0 | yes | 27492 | 1 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 95762 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63208 | 3 |
| `#/org` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33164 | 3 |
| `#/overview` | 值班台 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 125309 | 12 |
| `#/overview` | 值班台 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52886 | 12 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 152 | yes | - | - | 0 | yes | 64515 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 152 | yes | - | - | 0 | yes | 34131 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 48301 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 405 | yes | yes | yes | 0 | yes | 99871 | 4 |
| `#/system` | 系统健康 | 375 | 200 | 405 | yes | yes | yes | 0 | yes | 65463 | 4 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 121 | yes | - | yes | 0 | yes | 60160 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 121 | yes | - | yes | 0 | yes | 30241 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87912 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56155 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 88233 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56186 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87800 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56371 | 2 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87799 | 2 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 55947 | 2 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 406 | yes | - | - | 0 | yes | 109403 | 2 |
| `#/system?tab=version` | 版本 | 375 | 200 | 406 | yes | - | - | 0 | yes | 49984 | 2 |
| `#/work` | 任务 | 1440 | 200 | 255 | yes | - | - | 0 | yes | 90732 | 7 |
| `#/work` | 任务 | 375 | 200 | 255 | yes | - | - | 0 | yes | 59838 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 255 | yes | - | - | 0 | yes | 90991 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 255 | yes | - | - | 0 | yes | 60336 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 255 | yes | - | - | 0 | yes | 90704 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 255 | yes | - | - | 0 | yes | 60494 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 265 | yes | - | yes | 0 | yes | 78814 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 265 | yes | - | yes | 0 | yes | 47763 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
