# lane-D screenshot evidence index

- base: `http://127.0.0.1:9119`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 0 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/access` | 角色与权限 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/approvals` | 待处理 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/approvals` | 待处理 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/audit` | 审计事件 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/audit` | 审计事件 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/capabilities` | 技能 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/capabilities` | 技能 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/employees` | 列表 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/employees` | 列表 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/identity` | 人员目录 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/identity` | 人员目录 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/knowledge` | 知识空间 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/metrics` | 用量与成本 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/org` | 人员目录 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/org` | 人员目录 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/overview` | 值班台 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/overview` | 值班台 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/sessions` | 列表 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/sessions` | 列表 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/system` | 系统健康 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/system` | 系统健康 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/system?tab=version` | 版本 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/work` | 任务 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/work` | 任务 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 0 | NO | - | - | 0 | n/a | 56356 | 0 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 0 | NO | - | - | 0 | n/a | 21285 | 0 |

- routes with empty main (any viewport): `#/access`, `#/approvals`, `#/approvals?tab=history`, `#/approvals?tab=mine`, `#/approvals?tab=pending&view=mine`, `#/approvals?tab=pending&view=release`, `#/approvals?tab=policy`, `#/approvals?tab=release`, `#/audit`, `#/capabilities`, `#/capabilities?tab=channels`, `#/capabilities?tab=models`, `#/capabilities?tab=tools`, `#/employees`, `#/employees?tab=matrix`, `#/employees/:employeeId`, `#/employees/:employeeId?zone=config`, `#/employees/:employeeId?zone=evidence`, `#/employees/:employeeId?zone=runs`, `#/employees/:employeeId?zone=tasks`, `#/identity`, `#/identity?tab=admins`, `#/identity?tab=binding`, `#/identity?tab=checks`, `#/identity?tab=departments`, `#/identity?tab=people&view=admins`, `#/identity?tab=roles`, `#/identity?tab=tenant`, `#/knowledge`, `#/knowledge?tab=citations`, `#/knowledge?tab=evidence`, `#/knowledge?tab=ingest`, `#/knowledge?tab=retrieval`, `#/knowledge?tab=scope`, `#/knowledge?tab=sources`, `#/metrics`, `#/org`, `#/overview`, `#/overview?tab=usage`, `#/sessions`, `#/system`, `#/system?tab=defaults`, `#/system?tab=events`, `#/system?tab=events&view=anomaly`, `#/system?tab=retention`, `#/system?tab=security`, `#/system?tab=version`, `#/work`, `#/work?tab=board&view=cron`, `#/work?tab=cron`, `#/work?tab=runs`
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
