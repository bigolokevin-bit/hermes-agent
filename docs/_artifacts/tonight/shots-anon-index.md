# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 1109 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 77479 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 47663 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 721 | yes | yes | yes | 0 | yes | 158082 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 721 | yes | yes | yes | 0 | yes | 95907 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 753 | yes | yes | yes | 0 | yes | 145232 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 753 | yes | yes | yes | 0 | yes | 92248 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 721 | yes | yes | yes | 0 | yes | 158422 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 721 | yes | yes | yes | 0 | yes | 95907 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 721 | yes | yes | yes | 0 | yes | 158204 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 721 | yes | yes | yes | 0 | yes | 95907 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 721 | yes | yes | yes | 0 | yes | 158098 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 721 | yes | yes | yes | 0 | yes | 95907 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 721 | yes | yes | yes | 0 | yes | 158489 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 721 | yes | yes | yes | 0 | yes | 95907 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 721 | yes | yes | yes | 0 | yes | 158724 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 721 | yes | yes | yes | 0 | yes | 95907 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 163192 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 97379 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 364 | yes | yes | yes | 0 | yes | 99920 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 364 | yes | yes | yes | 0 | yes | 66814 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 200 | yes | - | - | 0 | yes | 82901 | 8 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 200 | yes | - | - | 0 | yes | 51196 | 8 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 74613 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44388 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 390 | yes | yes | yes | 0 | yes | 103828 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 390 | yes | yes | yes | 0 | yes | 72872 | 4 |
| `#/employees` | 列表 | 1440 | 200 | 318 | yes | - | - | 0 | yes | 98406 | 2 |
| `#/employees` | 列表 | 375 | 200 | 318 | yes | - | - | 0 | yes | 56940 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 210 | yes | - | - | 0 | yes | 81986 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 210 | yes | - | - | 0 | yes | 50990 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 41962 | 2 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13319 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42128 | 2 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 39336 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 69240 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13473 | 2 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42076 | 2 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13471 | 2 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 42079 | 2 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13496 | 2 |
| `#/identity` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 70410 | 4 |
| `#/identity` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 39058 | 4 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 70178 | 4 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 39336 | 4 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 70626 | 4 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 39359 | 4 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 70107 | 4 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 39373 | 4 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 147 | yes | - | - | 0 | yes | 66062 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 147 | yes | - | - | 0 | yes | 36551 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 70325 | 4 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 39193 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 77449 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 47427 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 70116 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 39424 | 4 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 549 | yes | yes | - | 0 | yes | 146373 | 3 |
| `#/knowledge` | 知识空间 | 375 | 200 | 549 | yes | yes | - | 0 | yes | 64618 | 3 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 477 | yes | yes | - | 0 | yes | 123933 | 4 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 477 | yes | yes | - | 0 | yes | 63321 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 477 | yes | yes | - | 0 | yes | 123933 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 477 | yes | yes | - | 0 | yes | 63321 | 4 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 553 | yes | yes | - | 0 | yes | 120309 | 5 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 553 | yes | yes | - | 0 | yes | 63295 | 5 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 508 | yes | yes | - | 0 | yes | 126374 | 4 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 508 | yes | yes | - | 0 | yes | 63914 | 4 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 549 | yes | yes | - | 0 | yes | 146373 | 3 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 549 | yes | yes | - | 0 | yes | 64618 | 3 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 553 | yes | yes | - | 0 | yes | 120309 | 5 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 553 | yes | yes | - | 0 | yes | 63295 | 5 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 96752 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59660 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 70667 | 4 |
| `#/org` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 39203 | 4 |
| `#/overview` | 值班台 | 1440 | 200 | 1109 | yes | yes | yes | 0 | no | 172405 | 11 |
| `#/overview` | 值班台 | 375 | 200 | 1109 | yes | yes | yes | 0 | no | 64866 | 11 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 136 | yes | - | - | 0 | yes | 69088 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 136 | yes | - | - | 0 | yes | 38464 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 53660 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 24205 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 948 | yes | yes | yes | 0 | yes | 124677 | 5 |
| `#/system` | 系统健康 | 375 | 200 | 948 | yes | yes | yes | 0 | yes | 62048 | 5 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 125 | yes | - | yes | 0 | yes | 67188 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 125 | yes | - | yes | 0 | yes | 37097 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 163138 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 97388 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 162967 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 97364 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 673 | yes | - | yes | 0 | yes | 162963 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 673 | yes | - | yes | 0 | yes | 97454 | 2 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 317 | yes | - | - | 0 | yes | 108036 | 5 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 317 | yes | - | - | 0 | yes | 59811 | 5 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 596 | yes | - | yes | 0 | yes | 130110 | 4 |
| `#/system?tab=version` | 版本 | 375 | 200 | 596 | yes | - | yes | 0 | yes | 63235 | 4 |
| `#/work` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 103213 | 7 |
| `#/work` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 70891 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 103143 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 71194 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 281 | yes | yes | - | 0 | yes | 102940 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 281 | yes | yes | - | 0 | yes | 71308 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 483 | yes | - | yes | 0 | yes | 123441 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 483 | yes | - | yes | 0 | yes | 73490 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
