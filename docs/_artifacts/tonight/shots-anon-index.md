# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 909 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73803 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43677 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70957 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39270 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 212 | yes | - | yes | 0 | yes | 84180 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 212 | yes | - | yes | 0 | yes | 51326 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70710 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39358 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 163 | yes | - | yes | 0 | yes | 54141 | 6 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39418 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70849 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 38820 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 71037 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39368 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70687 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39212 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 364 | yes | yes | yes | 0 | yes | 85856 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 364 | yes | yes | yes | 0 | yes | 53311 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 156 | yes | - | yes | 0 | yes | 69293 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 156 | yes | - | yes | 0 | yes | 38131 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 215 | yes | yes | - | 0 | yes | 79433 | 8 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 215 | yes | yes | - | 0 | yes | 47216 | 8 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 76668 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44816 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 170 | yes | - | - | 0 | yes | 71028 | 1 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 170 | yes | - | - | 0 | yes | 39524 | 1 |
| `#/employees` | 列表 | 1440 | 200 | 124 | yes | - | - | 0 | yes | 60386 | 3 |
| `#/employees` | 列表 | 375 | 200 | 124 | yes | - | - | 0 | yes | 31552 | 3 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 226 | yes | - | - | 0 | yes | 81565 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 226 | yes | - | - | 0 | yes | 49140 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 47421 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 51 | yes | - | - | 0 | yes | 31487 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 64442 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 32592 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45615 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 32499 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 44964 | 2 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 32584 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45172 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13466 | 1 |
| `#/identity` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66190 | 3 |
| `#/identity` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34786 | 3 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66337 | 3 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34720 | 3 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 65745 | 3 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34843 | 3 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 65986 | 3 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34904 | 3 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 147 | yes | - | - | 0 | yes | 62179 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 147 | yes | - | - | 0 | yes | 32032 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66105 | 3 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34818 | 3 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73932 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43431 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66074 | 3 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34995 | 3 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 239 | yes | yes | - | 0 | yes | 84214 | 2 |
| `#/knowledge` | 知识空间 | 375 | 200 | 239 | yes | yes | - | 0 | yes | 51988 | 2 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 317 | yes | yes | - | 0 | yes | 100504 | 3 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 317 | yes | yes | - | 0 | yes | 67111 | 3 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 317 | yes | yes | - | 0 | yes | 100504 | 3 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 337 | yes | yes | - | 0 | yes | 71882 | 3 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 338 | yes | yes | - | 0 | yes | 105612 | 3 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 338 | yes | yes | - | 0 | yes | 72279 | 3 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 368 | yes | yes | - | 0 | yes | 114278 | 3 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 348 | yes | yes | - | 0 | yes | 73648 | 3 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 239 | yes | yes | - | 0 | yes | 84214 | 2 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 239 | yes | yes | - | 0 | yes | 51988 | 2 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 318 | yes | yes | - | 0 | yes | 100861 | 3 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 318 | yes | yes | - | 0 | yes | 67504 | 3 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 96336 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66216 | 3 |
| `#/org` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34648 | 3 |
| `#/overview` | 值班台 | 1440 | 200 | 909 | yes | yes | yes | 0 | no | 147536 | 12 |
| `#/overview` | 值班台 | 375 | 200 | 909 | yes | yes | yes | 0 | no | 54669 | 12 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 152 | yes | - | - | 0 | yes | 65595 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 152 | yes | - | - | 0 | yes | 33956 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 48838 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 333 | yes | yes | yes | 0 | yes | 94093 | 4 |
| `#/system` | 系统健康 | 375 | 200 | 333 | yes | yes | yes | 0 | yes | 59073 | 4 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 121 | yes | - | yes | 0 | yes | 60690 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 121 | yes | - | yes | 0 | yes | 30156 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 364 | yes | yes | yes | 0 | yes | 85994 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 364 | yes | yes | yes | 0 | yes | 53003 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 364 | yes | yes | yes | 0 | yes | 85907 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 364 | yes | yes | yes | 0 | yes | 52889 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 364 | yes | yes | yes | 0 | yes | 86033 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 364 | yes | yes | yes | 0 | yes | 53066 | 2 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 364 | yes | yes | yes | 0 | yes | 85919 | 2 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 364 | yes | yes | yes | 0 | yes | 53300 | 2 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 414 | yes | - | - | 0 | yes | 113192 | 2 |
| `#/system?tab=version` | 版本 | 375 | 200 | 414 | yes | - | - | 0 | yes | 49984 | 2 |
| `#/work` | 任务 | 1440 | 200 | 315 | yes | yes | - | 0 | yes | 98349 | 7 |
| `#/work` | 任务 | 375 | 200 | 315 | yes | yes | - | 0 | yes | 66689 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 315 | yes | yes | - | 0 | yes | 98631 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 315 | yes | yes | - | 0 | yes | 66923 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 299 | yes | yes | - | 0 | yes | 98980 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 315 | yes | yes | - | 0 | yes | 67335 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 265 | yes | - | yes | 0 | yes | 79833 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 265 | yes | - | yes | 0 | yes | 47678 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
