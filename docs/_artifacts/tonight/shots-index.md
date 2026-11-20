# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 1612 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 75601 | 4 |
| `#/access` | 角色与权限 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 43061 | 4 |
| `#/approvals` | 待处理 | 1440 | 200 | 698 | yes | yes | - | 0 | yes | 157671 | 0 |
| `#/approvals` | 待处理 | 375 | 200 | 698 | yes | yes | - | 0 | yes | 96226 | 0 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 1776 | yes | yes | yes | 0 | yes | 165897 | 0 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 1776 | yes | yes | yes | 0 | yes | 103279 | 0 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 698 | yes | yes | - | 0 | yes | 157669 | 0 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 698 | yes | yes | - | 0 | yes | 96226 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 698 | yes | yes | - | 0 | yes | 157669 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 698 | yes | yes | - | 0 | yes | 96226 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 698 | yes | yes | - | 0 | yes | 157660 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 698 | yes | yes | - | 0 | yes | 96226 | 0 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 698 | yes | yes | - | 0 | yes | 157660 | 0 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 698 | yes | yes | - | 0 | yes | 96226 | 0 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 698 | yes | yes | - | 0 | yes | 157660 | 0 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 698 | yes | yes | - | 0 | yes | 96226 | 0 |
| `#/audit` | 审计事件 | 1440 | 200 | 6702 | yes | - | yes | 0 | yes | 189205 | 0 |
| `#/audit` | 审计事件 | 375 | 200 | 744 | yes | - | - | 0 | yes | 93691 | 0 |
| `#/capabilities` | 技能 | 1440 | 200 | 276 | yes | yes | - | 0 | yes | 83042 | 0 |
| `#/capabilities` | 技能 | 375 | 200 | 276 | yes | yes | - | 0 | yes | 50794 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 1032 | yes | yes | - | 0 | yes | 168219 | 4 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 1032 | yes | yes | - | 0 | yes | 94779 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 517 | yes | yes | - | 0 | yes | 143908 | 2 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 517 | yes | yes | - | 0 | yes | 68738 | 2 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 255 | yes | - | - | 0 | yes | 79770 | 3 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 387 | yes | yes | - | 0 | yes | 63642 | 3 |
| `#/employees` | 列表 | 1440 | 200 | 558 | yes | - | yes | 0 | yes | 123278 | 0 |
| `#/employees` | 列表 | 375 | 200 | 532 | yes | - | yes | 0 | yes | 59045 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 191 | yes | yes | - | 0 | yes | 78086 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 191 | yes | yes | - | 0 | yes | 44625 | 0 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 62346 | 1 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13281 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 62801 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 20068 | 0 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 66 | yes | - | - | 0 | yes | 63371 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13451 | 0 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 46622 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13470 | 0 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 46830 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13466 | 0 |
| `#/identity` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93273 | 2 |
| `#/identity` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93273 | 2 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 151 | yes | yes | - | 0 | yes | 72270 | 3 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 151 | yes | yes | - | 0 | yes | 39241 | 3 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93273 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 75601 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 43061 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 625 | yes | yes | - | 0 | yes | 158683 | 1 |
| `#/knowledge` | 知识空间 | 375 | 200 | 625 | yes | yes | - | 0 | yes | 73512 | 1 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 724 | yes | yes | - | 0 | yes | 172331 | 2 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 724 | yes | yes | - | 0 | yes | 73588 | 2 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 724 | yes | yes | - | 0 | yes | 172107 | 2 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 724 | yes | yes | - | 0 | yes | 73684 | 2 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 1023 | yes | yes | yes | 0 | yes | 174620 | 4 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 1023 | yes | yes | yes | 0 | yes | 73406 | 4 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 773 | yes | yes | - | 0 | yes | 164325 | 2 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 390 | yes | yes | - | 0 | yes | 55228 | 0 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 625 | yes | yes | - | 0 | yes | 158689 | 1 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 625 | yes | yes | - | 0 | yes | 73664 | 1 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 1023 | yes | yes | yes | 0 | yes | 174703 | 4 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 1023 | yes | yes | yes | 0 | yes | 73502 | 4 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 97892 | 0 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 0 |
| `#/org` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93273 | 2 |
| `#/org` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/overview` | 值班台 | 1440 | 200 | 1612 | yes | yes | yes | 0 | no | 175330 | 0 |
| `#/overview` | 值班台 | 375 | 200 | 1612 | yes | yes | yes | 0 | no | 64177 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 369 | yes | - | - | 0 | yes | 99041 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 369 | yes | - | - | 0 | yes | 37345 | 0 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 50500 | 0 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 0 |
| `#/system` | 系统健康 | 1440 | 200 | 1148 | yes | yes | yes | 0 | yes | 132401 | 0 |
| `#/system` | 系统健康 | 375 | 200 | 1159 | yes | yes | yes | 0 | yes | 69300 | 0 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 236 | yes | yes | - | 0 | yes | 92256 | 1 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 236 | yes | yes | - | 0 | yes | 57258 | 1 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 6702 | yes | - | yes | 0 | yes | 189205 | 0 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 6702 | yes | - | yes | 0 | yes | 93691 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 6702 | yes | - | yes | 0 | yes | 189226 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 6702 | yes | - | yes | 0 | yes | 93691 | 0 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 6702 | yes | - | yes | 0 | yes | 189205 | 0 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 6702 | yes | - | yes | 0 | yes | 93691 | 0 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 857 | yes | yes | - | 0 | yes | 152001 | 1 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 837 | yes | yes | - | 0 | yes | 71091 | 1 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 651 | yes | yes | - | 0 | yes | 121965 | 1 |
| `#/system?tab=version` | 版本 | 375 | 200 | 651 | yes | yes | - | 0 | yes | 56941 | 1 |
| `#/work` | 任务 | 1440 | 200 | 1956 | yes | yes | - | 0 | yes | 134444 | 0 |
| `#/work` | 任务 | 375 | 200 | 1956 | yes | yes | - | 0 | yes | 64223 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 1956 | yes | yes | - | 0 | yes | 134444 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 1956 | yes | yes | - | 0 | yes | 64223 | 0 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 1956 | yes | yes | - | 0 | yes | 134444 | 0 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 205 | yes | yes | - | 0 | yes | 46473 | 0 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 1597 | yes | - | yes | 0 | yes | 227923 | 0 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 1569 | yes | - | yes | 0 | yes | 71008 | 0 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
