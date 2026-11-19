# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 797 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 104 | yes | yes | - | 0 | yes | 66913 | 0 |
| `#/access` | 角色与权限 | 375 | 200 | 104 | yes | yes | - | 0 | yes | 29028 | 0 |
| `#/approvals` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77408 | 0 |
| `#/approvals` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 187 | yes | - | - | 0 | yes | 88832 | 0 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 187 | yes | - | - | 0 | yes | 47546 | 0 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77408 | 0 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77408 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77408 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38493 | 0 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77409 | 0 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77408 | 0 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/audit` | 审计事件 | 1440 | 200 | 100 | yes | yes | - | 0 | yes | 67776 | 0 |
| `#/audit` | 审计事件 | 375 | 200 | 100 | yes | yes | - | 0 | yes | 29575 | 0 |
| `#/capabilities` | 技能 | 1440 | 200 | 99 | yes | - | - | 0 | yes | 67431 | 0 |
| `#/capabilities` | 技能 | 375 | 200 | 99 | yes | - | - | 0 | yes | 28603 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 304 | yes | - | - | 0 | yes | 74282 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 304 | yes | - | - | 0 | yes | 40726 | 0 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 148 | yes | - | - | 0 | yes | 80749 | 1 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 148 | yes | - | - | 0 | yes | 41309 | 1 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 296 | yes | - | - | 0 | yes | 102136 | 1 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 296 | yes | - | - | 0 | yes | 60406 | 1 |
| `#/employees` | 列表 | 1440 | 200 | 191 | yes | - | - | 0 | yes | 79392 | 1 |
| `#/employees` | 列表 | 375 | 200 | 231 | yes | - | - | 0 | yes | 47565 | 1 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 211 | yes | - | - | 0 | yes | 85356 | 1 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 211 | yes | - | - | 0 | yes | 45064 | 1 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 39 | yes | - | - | 0 | yes | 51009 | 2 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 39 | yes | - | - | 0 | yes | 28062 | 2 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 39 | yes | - | - | 0 | yes | 52416 | 0 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 39 | yes | - | - | 0 | yes | 28436 | 2 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 39 | yes | - | - | 0 | yes | 52591 | 2 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 39 | yes | - | - | 0 | yes | 12782 | 2 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 39 | yes | - | - | 0 | yes | 51938 | 2 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 39 | yes | - | - | 0 | yes | 28260 | 2 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 39 | yes | - | - | 0 | yes | 52151 | 2 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 39 | yes | - | - | 0 | yes | 12794 | 0 |
| `#/identity` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69195 | 2 |
| `#/identity` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30936 | 2 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69197 | 2 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30935 | 2 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69197 | 2 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30936 | 2 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69197 | 2 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30935 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 154 | yes | yes | - | 0 | yes | 73346 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 154 | yes | yes | - | 0 | yes | 35139 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69196 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30935 | 2 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 104 | yes | yes | - | 0 | yes | 66914 | 0 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 104 | yes | yes | - | 0 | yes | 29028 | 0 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69195 | 2 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30938 | 2 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 107 | yes | yes | - | 0 | yes | 69236 | 0 |
| `#/knowledge` | 知识空间 | 375 | 200 | 107 | yes | yes | - | 0 | yes | 30255 | 0 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 209 | yes | yes | - | 0 | yes | 88718 | 1 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 209 | yes | yes | - | 0 | yes | 48475 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 209 | yes | yes | - | 0 | yes | 88417 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 209 | yes | yes | - | 0 | yes | 48294 | 1 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 97 | yes | yes | - | 0 | yes | 67580 | 0 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 97 | yes | yes | - | 0 | yes | 28650 | 0 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 209 | yes | yes | - | 0 | yes | 88820 | 1 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 209 | yes | yes | - | 0 | yes | 48718 | 1 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 107 | yes | yes | - | 0 | yes | 69237 | 0 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 107 | yes | yes | - | 0 | yes | 30255 | 0 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 97 | yes | yes | - | 0 | yes | 67580 | 0 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 97 | yes | yes | - | 0 | yes | 28650 | 0 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 103714 | 0 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 0 |
| `#/org` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69197 | 2 |
| `#/org` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30936 | 2 |
| `#/overview` | 值班台 | 1440 | 200 | 1012 | yes | yes | yes | 0 | no | 147928 | 0 |
| `#/overview` | 值班台 | 375 | 200 | 1012 | yes | yes | yes | 0 | no | 58597 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 243 | yes | yes | - | 0 | yes | 85959 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 243 | yes | yes | - | 0 | yes | 30835 | 0 |
| `#/sessions` | 列表 | 1440 | 200 | 295 | yes | - | - | 0 | yes | 73416 | 0 |
| `#/sessions` | 列表 | 375 | 200 | 295 | yes | - | - | 0 | yes | 35628 | 0 |
| `#/system` | 系统健康 | 1440 | 200 | 221 | yes | yes | yes | 0 | yes | 82248 | 1 |
| `#/system` | 系统健康 | 375 | 200 | 221 | yes | yes | yes | 0 | yes | 42611 | 1 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 236 | yes | yes | - | 0 | yes | 98007 | 1 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 236 | yes | yes | - | 0 | yes | 57258 | 1 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 100 | yes | yes | - | 0 | yes | 67776 | 0 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 100 | yes | yes | - | 0 | yes | 29575 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 100 | yes | yes | - | 0 | yes | 67777 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 100 | yes | yes | - | 0 | yes | 29575 | 0 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 100 | yes | yes | - | 0 | yes | 67777 | 0 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 100 | yes | yes | - | 0 | yes | 29575 | 0 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 100 | yes | yes | - | 0 | yes | 67776 | 0 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 100 | yes | yes | - | 0 | yes | 29575 | 0 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 285 | yes | - | - | 0 | yes | 97728 | 0 |
| `#/system?tab=version` | 版本 | 375 | 200 | 285 | yes | - | - | 0 | yes | 49984 | 0 |
| `#/work` | 任务 | 1440 | 200 | 132 | yes | - | - | 0 | yes | 122919 | 1 |
| `#/work` | 任务 | 375 | 200 | 226 | yes | - | - | 0 | yes | 57621 | 2 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 1639 | yes | yes | - | 0 | yes | 122685 | 1 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 1639 | yes | yes | - | 0 | yes | 58031 | 1 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 1639 | yes | yes | - | 0 | yes | 122682 | 1 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 1639 | yes | yes | - | 0 | yes | 58031 | 1 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 1096 | yes | - | yes | 0 | yes | 132543 | 0 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 1075 | yes | - | yes | 0 | yes | 48140 | 0 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
