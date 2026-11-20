# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 1798 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 75601 | 4 |
| `#/access` | 角色与权限 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 43061 | 4 |
| `#/approvals` | 待处理 | 1440 | 200 | 889 | yes | yes | yes | 0 | yes | 176471 | 0 |
| `#/approvals` | 待处理 | 375 | 200 | 889 | yes | yes | yes | 0 | yes | 102397 | 0 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 2021 | yes | yes | yes | 0 | yes | 159779 | 0 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 2021 | yes | yes | yes | 0 | yes | 100870 | 0 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 889 | yes | yes | yes | 0 | yes | 176471 | 0 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 889 | yes | yes | yes | 0 | yes | 102394 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 889 | yes | yes | yes | 0 | yes | 176471 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 889 | yes | yes | yes | 0 | yes | 102397 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 889 | yes | yes | yes | 0 | yes | 176567 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 889 | yes | yes | yes | 0 | yes | 102443 | 0 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 889 | yes | yes | yes | 0 | yes | 176567 | 0 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 889 | yes | yes | yes | 0 | yes | 102443 | 0 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 889 | yes | yes | yes | 0 | yes | 176567 | 0 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 889 | yes | yes | yes | 0 | yes | 102443 | 0 |
| `#/audit` | 审计事件 | 1440 | 200 | 7647 | yes | - | yes | 0 | yes | 195876 | 0 |
| `#/audit` | 审计事件 | 375 | 200 | 7647 | yes | - | yes | 0 | yes | 93691 | 0 |
| `#/capabilities` | 技能 | 1440 | 200 | 339 | yes | yes | - | 0 | yes | 97482 | 0 |
| `#/capabilities` | 技能 | 375 | 200 | 339 | yes | yes | - | 0 | yes | 63278 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 1032 | yes | yes | - | 0 | yes | 167813 | 4 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 1032 | yes | yes | - | 0 | yes | 94525 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 517 | yes | yes | - | 0 | yes | 143886 | 2 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 517 | yes | yes | - | 0 | yes | 68790 | 2 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 405 | yes | yes | yes | 0 | yes | 108594 | 3 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 405 | yes | yes | yes | 0 | yes | 74355 | 3 |
| `#/employees` | 列表 | 1440 | 200 | 570 | yes | - | yes | 0 | yes | 126213 | 0 |
| `#/employees` | 列表 | 375 | 200 | 544 | yes | - | yes | 0 | yes | 59045 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 191 | yes | yes | - | 0 | yes | 78086 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 191 | yes | yes | - | 0 | yes | 44625 | 0 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45732 | 1 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 19693 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 47085 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13662 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 47257 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13451 | 0 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 53300 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13470 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 46830 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 19883 | 0 |
| `#/identity` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93273 | 2 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93273 | 2 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93273 | 2 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 151 | yes | yes | - | 0 | yes | 72270 | 3 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 151 | yes | yes | - | 0 | yes | 39241 | 3 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 75601 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 43061 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 469 | yes | yes | - | 0 | yes | 131299 | 0 |
| `#/knowledge` | 知识空间 | 375 | 200 | 469 | yes | yes | - | 0 | yes | 56522 | 0 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 707 | yes | yes | - | 0 | yes | 152057 | 1 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 359 | yes | yes | - | 0 | yes | 52451 | 0 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 707 | yes | yes | - | 0 | yes | 151816 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 689 | yes | yes | - | 0 | yes | 56900 | 1 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 939 | yes | yes | yes | 0 | yes | 158575 | 2 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 903 | yes | yes | yes | 0 | yes | 56933 | 2 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 756 | yes | yes | - | 0 | yes | 148761 | 1 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 738 | yes | yes | - | 0 | yes | 56898 | 1 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 469 | yes | yes | - | 0 | yes | 131295 | 0 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 469 | yes | yes | - | 0 | yes | 56525 | 0 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 939 | yes | yes | yes | 0 | yes | 158431 | 2 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 903 | yes | yes | yes | 0 | yes | 56933 | 2 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 97892 | 0 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 0 |
| `#/org` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93273 | 2 |
| `#/org` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/overview` | 值班台 | 1440 | 200 | 1798 | yes | yes | yes | 0 | no | 175941 | 0 |
| `#/overview` | 值班台 | 375 | 200 | 1798 | yes | yes | yes | 0 | no | 64174 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 369 | yes | - | - | 0 | yes | 99098 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 369 | yes | - | - | 0 | yes | 37358 | 0 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 50500 | 0 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 0 |
| `#/system` | 系统健康 | 1440 | 200 | 1186 | yes | yes | yes | 0 | yes | 140128 | 0 |
| `#/system` | 系统健康 | 375 | 200 | 1197 | yes | yes | yes | 0 | yes | 65824 | 0 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 236 | yes | yes | - | 0 | yes | 92256 | 1 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 236 | yes | yes | - | 0 | yes | 57258 | 1 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 7647 | yes | - | yes | 0 | yes | 195876 | 0 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 7647 | yes | - | yes | 0 | yes | 93691 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 7647 | yes | - | yes | 0 | yes | 195876 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 7647 | yes | - | yes | 0 | yes | 93691 | 0 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 7647 | yes | - | yes | 0 | yes | 195876 | 0 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 7647 | yes | - | yes | 0 | yes | 93691 | 0 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 857 | yes | yes | - | 0 | yes | 151960 | 1 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 837 | yes | yes | - | 0 | yes | 71132 | 1 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 651 | yes | yes | - | 0 | yes | 122093 | 1 |
| `#/system?tab=version` | 版本 | 375 | 200 | 651 | yes | yes | - | 0 | yes | 57016 | 1 |
| `#/work` | 任务 | 1440 | 200 | 1956 | yes | yes | - | 0 | yes | 134444 | 0 |
| `#/work` | 任务 | 375 | 200 | 1956 | yes | yes | - | 0 | yes | 64223 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 1956 | yes | yes | - | 0 | yes | 134444 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 1956 | yes | yes | - | 0 | yes | 64223 | 0 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 205 | yes | yes | - | 0 | yes | 78942 | 0 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 1956 | yes | yes | - | 0 | yes | 64223 | 0 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 1767 | yes | - | yes | 0 | yes | 216710 | 0 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 1739 | yes | - | yes | 0 | yes | 73221 | 0 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
