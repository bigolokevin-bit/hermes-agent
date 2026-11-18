# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 106 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 110 | yes | yes | - | 0 | yes | 69729 | 9 |
| `#/access` | 角色与权限 | 375 | 200 | 110 | yes | yes | - | 0 | yes | 29096 | 9 |
| `#/approvals` | 待处理 | 1440 | 200 | 121 | yes | - | yes | 0 | yes | 74858 | 10 |
| `#/approvals` | 待处理 | 375 | 200 | 121 | yes | - | yes | 0 | yes | 33819 | 10 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 106 | yes | yes | - | 0 | yes | 69106 | 9 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 106 | yes | yes | - | 0 | yes | 28570 | 9 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 121 | yes | - | yes | 0 | yes | 74858 | 10 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 121 | yes | - | yes | 0 | yes | 33819 | 10 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 121 | yes | - | yes | 0 | yes | 74859 | 10 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 121 | yes | - | yes | 0 | yes | 33819 | 10 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 121 | yes | - | yes | 0 | yes | 74859 | 10 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 121 | yes | - | yes | 0 | yes | 33819 | 10 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 121 | yes | - | yes | 0 | yes | 74858 | 10 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 121 | yes | - | yes | 0 | yes | 33819 | 10 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 121 | yes | - | yes | 0 | yes | 74858 | 10 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 121 | yes | - | yes | 0 | yes | 33819 | 10 |
| `#/audit` | 审计事件 | 1440 | 200 | 132 | yes | yes | - | 0 | yes | 71073 | 9 |
| `#/audit` | 审计事件 | 375 | 200 | 132 | yes | yes | - | 0 | yes | 30755 | 9 |
| `#/capabilities` | 技能 | 1440 | 200 | 267 | yes | - | - | 0 | yes | 75036 | 11 |
| `#/capabilities` | 技能 | 375 | 200 | 259 | yes | - | - | 0 | yes | 33245 | 11 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 304 | yes | - | - | 0 | yes | 78089 | 10 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 304 | yes | - | - | 0 | yes | 43138 | 10 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 250 | yes | - | - | 0 | yes | 78971 | 13 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 250 | yes | - | - | 0 | yes | 38012 | 13 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 352 | yes | - | - | 0 | yes | 86732 | 11 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 352 | yes | - | - | 0 | yes | 50090 | 11 |
| `#/employees` | 列表 | 1440 | 200 | 100 | yes | - | yes | 0 | yes | 70457 | 11 |
| `#/employees` | 列表 | 375 | 200 | 100 | yes | - | yes | 0 | yes | 30079 | 11 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 376 | yes | - | - | 0 | yes | 116716 | 10 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 376 | yes | - | - | 0 | yes | 61397 | 10 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 89 | yes | - | yes | 0 | yes | 67572 | 11 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 89 | yes | - | yes | 0 | yes | 27246 | 11 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 89 | yes | - | yes | 0 | yes | 68915 | 11 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 89 | yes | - | yes | 0 | yes | 28560 | 11 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 89 | yes | - | yes | 0 | yes | 69076 | 11 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 89 | yes | - | yes | 0 | yes | 28668 | 11 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 89 | yes | - | yes | 0 | yes | 68468 | 11 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 89 | yes | - | yes | 0 | yes | 28051 | 11 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 89 | yes | - | yes | 0 | yes | 68674 | 11 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 89 | yes | - | yes | 0 | yes | 28251 | 11 |
| `#/identity` | 人员目录 | 1440 | 200 | 118 | yes | yes | - | 0 | yes | 70638 | 9 |
| `#/identity` | 人员目录 | 375 | 200 | 118 | yes | yes | - | 0 | yes | 29925 | 9 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 118 | yes | yes | - | 0 | yes | 70636 | 9 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 118 | yes | yes | - | 0 | yes | 29925 | 9 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 118 | yes | yes | - | 0 | yes | 70635 | 9 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 118 | yes | yes | - | 0 | yes | 29925 | 9 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 118 | yes | yes | - | 0 | yes | 70613 | 9 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 118 | yes | yes | - | 0 | yes | 29925 | 9 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 115 | yes | yes | - | 0 | yes | 69923 | 9 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 115 | yes | yes | - | 0 | yes | 29323 | 9 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 118 | yes | yes | - | 0 | yes | 70635 | 9 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 118 | yes | yes | - | 0 | yes | 29925 | 9 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 110 | yes | yes | - | 0 | yes | 69730 | 9 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 110 | yes | yes | - | 0 | yes | 29096 | 9 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 118 | yes | yes | - | 0 | yes | 70636 | 9 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 118 | yes | yes | - | 0 | yes | 29925 | 9 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 120 | yes | yes | - | 0 | yes | 72214 | 9 |
| `#/knowledge` | 知识空间 | 375 | 200 | 120 | yes | yes | - | 0 | yes | 31299 | 9 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 123 | yes | yes | - | 0 | yes | 70944 | 9 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 123 | yes | yes | - | 0 | yes | 30306 | 9 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 123 | yes | yes | - | 0 | yes | 70943 | 9 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 123 | yes | yes | - | 0 | yes | 30306 | 9 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 95 | yes | yes | - | 0 | yes | 70006 | 9 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 95 | yes | yes | - | 0 | yes | 29169 | 9 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 123 | yes | yes | - | 0 | yes | 70944 | 9 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 123 | yes | yes | - | 0 | yes | 30306 | 9 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 120 | yes | yes | - | 0 | yes | 72214 | 9 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 120 | yes | yes | - | 0 | yes | 31299 | 9 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 95 | yes | yes | - | 0 | yes | 70006 | 9 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 95 | yes | yes | - | 0 | yes | 29169 | 9 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 107155 | 10 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 60835 | 10 |
| `#/org` | 人员目录 | 1440 | 200 | 118 | yes | yes | - | 0 | yes | 70636 | 9 |
| `#/org` | 人员目录 | 375 | 200 | 118 | yes | yes | - | 0 | yes | 29925 | 9 |
| `#/overview` | 值班台 | 1440 | 200 | 528 | yes | yes | yes | 0 | yes | 136645 | 20 |
| `#/overview` | 值班台 | 375 | 200 | 528 | yes | yes | yes | 0 | yes | 52228 | 20 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 842 | yes | - | - | 0 | yes | 112849 | 10 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 842 | yes | - | - | 0 | yes | 66830 | 10 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | no | 60005 | 14 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | no | 20664 | 14 |
| `#/system` | 系统健康 | 1440 | 200 | 1467 | yes | - | - | 0 | yes | 94968 | 19 |
| `#/system` | 系统健康 | 375 | 200 | 1467 | yes | - | - | 0 | yes | 38209 | 19 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 134 | yes | yes | - | 0 | yes | 74248 | 9 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 134 | yes | yes | - | 0 | yes | 33532 | 9 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 132 | yes | yes | - | 0 | yes | 71073 | 9 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 132 | yes | yes | - | 0 | yes | 30755 | 9 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 132 | yes | yes | - | 0 | yes | 71073 | 9 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 132 | yes | yes | - | 0 | yes | 30755 | 9 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 132 | yes | yes | - | 0 | yes | 71073 | 9 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 132 | yes | yes | - | 0 | yes | 30755 | 9 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 132 | yes | yes | - | 0 | yes | 71073 | 9 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 132 | yes | yes | - | 0 | yes | 30755 | 9 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 90 | yes | yes | - | 0 | yes | 69372 | 9 |
| `#/system?tab=version` | 版本 | 375 | 200 | 90 | yes | yes | - | 0 | yes | 28768 | 9 |
| `#/work` | 任务 | 1440 | 200 | 176 | yes | yes | - | 0 | yes | 88781 | 14 |
| `#/work` | 任务 | 375 | 200 | 176 | yes | yes | - | 0 | yes | 47334 | 14 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 176 | yes | yes | - | 0 | yes | 88781 | 14 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 176 | yes | yes | - | 0 | yes | 47334 | 14 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 176 | yes | yes | - | 0 | yes | 88781 | 14 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 176 | yes | yes | - | 0 | yes | 47334 | 14 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 207 | yes | - | yes | 0 | yes | 85533 | 11 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 207 | yes | - | yes | 0 | yes | 44383 | 11 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
