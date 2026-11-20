# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 1612 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 75601 | 4 |
| `#/access` | 角色与权限 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 43061 | 4 |
| `#/approvals` | 待处理 | 1440 | 200 | 735 | yes | yes | - | 0 | yes | 163065 | 0 |
| `#/approvals` | 待处理 | 375 | 200 | 735 | yes | yes | - | 0 | yes | 99174 | 0 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 1805 | yes | yes | yes | 0 | yes | 163725 | 0 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 1805 | yes | yes | yes | 0 | yes | 102521 | 0 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 735 | yes | yes | - | 0 | yes | 163065 | 0 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 735 | yes | yes | - | 0 | yes | 99175 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 735 | yes | yes | - | 0 | yes | 163065 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 735 | yes | yes | - | 0 | yes | 99174 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 735 | yes | yes | - | 0 | yes | 163065 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 735 | yes | yes | - | 0 | yes | 99174 | 0 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 735 | yes | yes | - | 0 | yes | 163065 | 0 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 735 | yes | yes | - | 0 | yes | 99174 | 0 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 735 | yes | yes | - | 0 | yes | 163065 | 0 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 735 | yes | yes | - | 0 | yes | 99174 | 0 |
| `#/audit` | 审计事件 | 1440 | 200 | 6769 | yes | - | yes | 0 | yes | 189906 | 0 |
| `#/audit` | 审计事件 | 375 | 200 | 6769 | yes | - | yes | 0 | yes | 93691 | 0 |
| `#/capabilities` | 技能 | 1440 | 200 | 357 | yes | yes | - | 0 | yes | 93724 | 0 |
| `#/capabilities` | 技能 | 375 | 200 | 357 | yes | yes | - | 0 | yes | 60325 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 1032 | yes | yes | - | 0 | yes | 167236 | 4 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 1032 | yes | yes | - | 0 | yes | 94362 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 517 | yes | yes | - | 0 | yes | 143908 | 2 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 517 | yes | yes | - | 0 | yes | 68738 | 2 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 458 | yes | yes | yes | 0 | yes | 110173 | 3 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 458 | yes | yes | yes | 0 | yes | 75169 | 3 |
| `#/employees` | 列表 | 1440 | 200 | 570 | yes | - | yes | 0 | yes | 126213 | 0 |
| `#/employees` | 列表 | 375 | 200 | 544 | yes | - | yes | 0 | yes | 59045 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 191 | yes | yes | - | 0 | yes | 78086 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 191 | yes | yes | - | 0 | yes | 44625 | 0 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 61988 | 1 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13281 | 0 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 63734 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 29538 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 47257 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 29478 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 46622 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 19887 | 0 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 46830 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 29352 | 1 |
| `#/identity` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93273 | 2 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 151 | yes | yes | - | 0 | yes | 72270 | 3 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 151 | yes | yes | - | 0 | yes | 39241 | 3 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 75601 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 43061 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93273 | 2 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 608 | yes | yes | - | 0 | yes | 140536 | 0 |
| `#/knowledge` | 知识空间 | 375 | 200 | 590 | yes | yes | - | 0 | yes | 56793 | 0 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 359 | yes | yes | - | 0 | yes | 108062 | 0 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 689 | yes | yes | - | 0 | yes | 56810 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 707 | yes | yes | - | 0 | yes | 152018 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 689 | yes | yes | - | 0 | yes | 56810 | 1 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 939 | yes | yes | yes | 0 | yes | 158281 | 2 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 903 | yes | yes | yes | 0 | yes | 56843 | 2 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 756 | yes | yes | - | 0 | yes | 148894 | 1 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 738 | yes | yes | - | 0 | yes | 56807 | 1 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 608 | yes | yes | - | 0 | yes | 140527 | 0 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 469 | yes | yes | - | 0 | yes | 56526 | 0 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 939 | yes | yes | yes | 0 | yes | 158269 | 2 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 903 | yes | yes | yes | 0 | yes | 56843 | 2 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 97892 | 0 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 0 |
| `#/org` | 人员目录 | 1440 | 200 | 394 | yes | yes | - | 0 | yes | 93267 | 2 |
| `#/org` | 人员目录 | 375 | 200 | 377 | yes | yes | - | 0 | yes | 61472 | 2 |
| `#/overview` | 值班台 | 1440 | 200 | 1612 | yes | yes | yes | 0 | no | 175737 | 0 |
| `#/overview` | 值班台 | 375 | 200 | 1612 | yes | yes | yes | 0 | no | 64317 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 369 | yes | - | - | 0 | yes | 99041 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 369 | yes | - | - | 0 | yes | 37345 | 0 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 50500 | 0 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 0 |
| `#/system` | 系统健康 | 1440 | 200 | 1168 | yes | yes | yes | 0 | yes | 136071 | 0 |
| `#/system` | 系统健康 | 375 | 200 | 1179 | yes | yes | yes | 0 | yes | 66682 | 0 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 236 | yes | yes | - | 0 | yes | 92256 | 1 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 236 | yes | yes | - | 0 | yes | 57258 | 1 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 6769 | yes | - | yes | 0 | yes | 189906 | 0 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 6769 | yes | - | yes | 0 | yes | 93691 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 6769 | yes | - | yes | 0 | yes | 189906 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 6769 | yes | - | yes | 0 | yes | 93691 | 0 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 6769 | yes | - | yes | 0 | yes | 189906 | 0 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 6769 | yes | - | yes | 0 | yes | 93691 | 0 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 857 | yes | yes | - | 0 | yes | 152052 | 1 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 837 | yes | yes | - | 0 | yes | 71159 | 1 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 651 | yes | yes | - | 0 | yes | 122008 | 1 |
| `#/system?tab=version` | 版本 | 375 | 200 | 651 | yes | yes | - | 0 | yes | 56946 | 1 |
| `#/work` | 任务 | 1440 | 200 | 1956 | yes | yes | - | 0 | yes | 134444 | 0 |
| `#/work` | 任务 | 375 | 200 | 1956 | yes | yes | - | 0 | yes | 64223 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 1956 | yes | yes | - | 0 | yes | 134444 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 1956 | yes | yes | - | 0 | yes | 64223 | 0 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 205 | yes | yes | - | 0 | yes | 78798 | 0 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 1956 | yes | yes | - | 0 | yes | 64223 | 0 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 1639 | yes | - | yes | 0 | yes | 220070 | 0 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 1611 | yes | - | yes | 0 | yes | 69915 | 0 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
