# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 732 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 211 | yes | - | - | 0 | yes | 72869 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 211 | yes | - | - | 0 | yes | 42962 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70270 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39555 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 212 | yes | - | yes | 0 | yes | 84049 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 212 | yes | - | yes | 0 | yes | 51386 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70560 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 38819 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 69676 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39065 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70594 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39435 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70593 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39602 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 69944 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39285 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87512 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56263 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 156 | yes | - | yes | 0 | yes | 68940 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 156 | yes | - | yes | 0 | yes | 38175 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 215 | yes | yes | - | 0 | yes | 78712 | 7 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 215 | yes | yes | - | 0 | yes | 47465 | 7 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 75760 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 43996 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 189 | yes | - | - | 0 | yes | 73805 | 2 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 189 | yes | - | - | 0 | yes | 42229 | 2 |
| `#/employees` | 列表 | 1440 | 200 | 124 | yes | - | - | 0 | yes | 60221 | 3 |
| `#/employees` | 列表 | 375 | 200 | 124 | yes | - | - | 0 | yes | 30899 | 3 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 226 | yes | - | - | 0 | yes | 80667 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 226 | yes | - | - | 0 | yes | 49033 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 46891 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13281 | 2 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 44888 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 51 | yes | - | - | 0 | yes | 30229 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45062 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 51 | yes | - | - | 0 | yes | 29902 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 44427 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 51 | yes | - | - | 0 | yes | 29712 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 62218 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 30346 | 3 |
| `#/identity` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63217 | 3 |
| `#/identity` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33638 | 3 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63031 | 3 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33405 | 3 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63279 | 3 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33336 | 3 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63293 | 3 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33471 | 3 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 147 | yes | - | - | 0 | yes | 61571 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 147 | yes | - | - | 0 | yes | 32053 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63177 | 3 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33497 | 3 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 211 | yes | - | - | 0 | yes | 72743 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 211 | yes | - | - | 0 | yes | 42912 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63111 | 3 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33324 | 3 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 294 | yes | yes | - | 0 | yes | 93340 | 2 |
| `#/knowledge` | 知识空间 | 375 | 200 | 294 | yes | yes | - | 0 | yes | 62252 | 2 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 81369 | 1 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 49751 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 81369 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 49751 | 1 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 88 | yes | yes | - | 0 | yes | 57888 | 1 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 88 | yes | yes | - | 0 | yes | 27492 | 1 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 81369 | 1 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 49751 | 1 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 294 | yes | yes | - | 0 | yes | 93340 | 2 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 294 | yes | yes | - | 0 | yes | 62252 | 2 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 88 | yes | yes | - | 0 | yes | 57888 | 1 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 88 | yes | yes | - | 0 | yes | 27492 | 1 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 95762 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 62962 | 3 |
| `#/org` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33452 | 3 |
| `#/overview` | 值班台 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 124984 | 12 |
| `#/overview` | 值班台 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 53108 | 12 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 152 | yes | - | - | 0 | yes | 65036 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 152 | yes | - | - | 0 | yes | 33741 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 48301 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 405 | yes | yes | yes | 0 | yes | 99683 | 4 |
| `#/system` | 系统健康 | 375 | 200 | 405 | yes | yes | yes | 0 | yes | 65907 | 4 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 121 | yes | - | yes | 0 | yes | 60448 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 121 | yes | - | yes | 0 | yes | 30060 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87441 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56227 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87734 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56253 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 88163 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56299 | 2 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87750 | 2 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56343 | 2 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 406 | yes | - | - | 0 | yes | 109885 | 2 |
| `#/system?tab=version` | 版本 | 375 | 200 | 406 | yes | - | - | 0 | yes | 49984 | 2 |
| `#/work` | 任务 | 1440 | 200 | 255 | yes | - | - | 0 | yes | 90789 | 7 |
| `#/work` | 任务 | 375 | 200 | 255 | yes | - | - | 0 | yes | 59969 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 255 | yes | - | - | 0 | yes | 91006 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 255 | yes | - | - | 0 | yes | 60210 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 255 | yes | - | - | 0 | yes | 91174 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 255 | yes | - | - | 0 | yes | 60057 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 265 | yes | - | yes | 0 | yes | 78817 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 265 | yes | - | yes | 0 | yes | 47435 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
