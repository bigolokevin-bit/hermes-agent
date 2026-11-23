# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 1063 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 186 | yes | - | - | 0 | yes | 72486 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 186 | yes | - | - | 0 | yes | 43998 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 328 | yes | - | yes | 0 | yes | 95347 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 328 | yes | - | yes | 0 | yes | 56359 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 514 | yes | yes | yes | 0 | yes | 130172 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 514 | yes | yes | yes | 0 | yes | 83951 | 3 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 328 | yes | - | yes | 0 | yes | 95358 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 328 | yes | - | yes | 0 | yes | 56351 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 328 | yes | - | yes | 0 | yes | 94827 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 328 | yes | - | yes | 0 | yes | 56500 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 328 | yes | - | yes | 0 | yes | 95242 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 328 | yes | - | yes | 0 | yes | 55960 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 328 | yes | - | yes | 0 | yes | 95270 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 328 | yes | - | yes | 0 | yes | 56222 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 328 | yes | - | yes | 0 | yes | 95268 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 328 | yes | - | yes | 0 | yes | 55997 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 659 | yes | - | yes | 0 | yes | 160851 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 659 | yes | - | yes | 0 | yes | 87604 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 340 | yes | yes | yes | 0 | yes | 98499 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 340 | yes | yes | yes | 0 | yes | 63627 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 185 | yes | - | - | 0 | yes | 80631 | 8 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 185 | yes | - | - | 0 | yes | 50521 | 8 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 74731 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 163 | yes | - | - | 0 | yes | 43890 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 375 | yes | yes | yes | 0 | yes | 103764 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 375 | yes | yes | yes | 0 | yes | 72270 | 4 |
| `#/employees` | 列表 | 1440 | 200 | 282 | yes | - | - | 0 | yes | 94970 | 2 |
| `#/employees` | 列表 | 375 | 200 | 282 | yes | - | - | 0 | yes | 53523 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 214 | yes | - | - | 0 | yes | 84623 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 214 | yes | - | - | 0 | yes | 53656 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45421 | 2 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 15158 | 2 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 67237 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 15348 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 53258 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 15313 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 67511 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 38850 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45544 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 15334 | 1 |
| `#/identity` | 人员目录 | 1440 | 200 | 112 | yes | - | - | 0 | yes | 63471 | 4 |
| `#/identity` | 人员目录 | 375 | 200 | 112 | yes | - | - | 0 | yes | 35215 | 4 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 112 | yes | - | - | 0 | yes | 63828 | 4 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 112 | yes | - | - | 0 | yes | 35271 | 4 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 112 | yes | - | - | 0 | yes | 63869 | 4 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 112 | yes | - | - | 0 | yes | 35175 | 4 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 112 | yes | - | - | 0 | yes | 63869 | 5 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 112 | yes | - | - | 0 | yes | 35341 | 4 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 128 | yes | - | - | 0 | yes | 62681 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 128 | yes | - | - | 0 | yes | 34876 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 112 | yes | - | - | 0 | yes | 63567 | 4 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 112 | yes | - | - | 0 | yes | 35275 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 186 | yes | - | - | 0 | yes | 72521 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 186 | yes | - | - | 0 | yes | 43980 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 112 | yes | - | - | 0 | yes | 63803 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 112 | yes | - | - | 0 | yes | 35466 | 4 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 518 | yes | yes | - | 0 | yes | 134919 | 3 |
| `#/knowledge` | 知识空间 | 375 | 200 | 518 | yes | yes | - | 0 | yes | 62249 | 3 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 479 | yes | yes | - | 0 | yes | 126870 | 4 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 479 | yes | yes | - | 0 | yes | 61998 | 4 |
| `#/knowledge?tab=evidence` | 审计证据 | 1440 | 200 | 183 | yes | yes | - | 0 | yes | 81811 | 2 |
| `#/knowledge?tab=evidence` | 审计证据 | 375 | 200 | 183 | yes | yes | - | 0 | yes | 49206 | 2 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 560 | yes | yes | - | 0 | yes | 127440 | 5 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 560 | yes | yes | - | 0 | yes | 62042 | 5 |
| `#/knowledge?tab=retrieval` | 检索 | 1440 | 200 | 511 | yes | yes | - | 0 | yes | 128040 | 4 |
| `#/knowledge?tab=retrieval` | 检索 | 375 | 200 | 511 | yes | yes | - | 0 | yes | 62442 | 4 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 518 | yes | yes | - | 0 | yes | 134919 | 3 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 518 | yes | yes | - | 0 | yes | 62249 | 3 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 560 | yes | yes | - | 0 | yes | 127440 | 5 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 560 | yes | yes | - | 0 | yes | 62042 | 5 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 100795 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 63318 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 112 | yes | - | - | 0 | yes | 64242 | 4 |
| `#/org` | 人员目录 | 375 | 200 | 112 | yes | - | - | 0 | yes | 35464 | 4 |
| `#/overview` | 值班台 | 1440 | 200 | 1063 | yes | yes | yes | 0 | no | 138640 | 11 |
| `#/overview` | 值班台 | 375 | 200 | 1063 | yes | yes | yes | 0 | no | 52199 | 11 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 122 | yes | - | - | 0 | yes | 66413 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 122 | yes | - | - | 0 | yes | 37657 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 53841 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 27045 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 934 | yes | yes | yes | 0 | yes | 122290 | 5 |
| `#/system` | 系统健康 | 375 | 200 | 934 | yes | yes | yes | 0 | yes | 61306 | 5 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 111 | yes | - | yes | 0 | yes | 64989 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 111 | yes | - | yes | 0 | yes | 35793 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 659 | yes | - | yes | 0 | yes | 161022 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 659 | yes | - | yes | 0 | yes | 87604 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 659 | yes | - | yes | 0 | yes | 161050 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 659 | yes | - | yes | 0 | yes | 87604 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 659 | yes | - | yes | 0 | yes | 160751 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 659 | yes | - | yes | 0 | yes | 87604 | 2 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 293 | yes | - | - | 0 | yes | 103454 | 5 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 293 | yes | - | - | 0 | yes | 55824 | 5 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 574 | yes | - | yes | 0 | yes | 128607 | 4 |
| `#/system?tab=version` | 版本 | 375 | 200 | 574 | yes | - | yes | 0 | yes | 62308 | 4 |
| `#/work` | 任务 | 1440 | 200 | 266 | yes | yes | - | 0 | yes | 100385 | 7 |
| `#/work` | 任务 | 375 | 200 | 266 | yes | yes | - | 0 | yes | 69872 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 266 | yes | yes | - | 0 | yes | 99963 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 266 | yes | yes | - | 0 | yes | 70115 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 266 | yes | yes | - | 0 | yes | 100088 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 266 | yes | yes | - | 0 | yes | 69720 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 468 | yes | - | yes | 0 | yes | 103243 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 468 | yes | - | yes | 0 | yes | 68260 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
