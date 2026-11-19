# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 246 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 104 | yes | yes | - | 0 | yes | 66913 | 0 |
| `#/access` | 角色与权限 | 375 | 200 | 104 | yes | yes | - | 0 | yes | 29028 | 0 |
| `#/approvals` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77407 | 0 |
| `#/approvals` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 187 | yes | - | - | 0 | yes | 88828 | 0 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 187 | yes | - | - | 0 | yes | 47546 | 0 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77408 | 0 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77408 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77408 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77408 | 0 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77408 | 0 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/audit` | 审计事件 | 1440 | 200 | 100 | yes | yes | - | 0 | yes | 67778 | 0 |
| `#/audit` | 审计事件 | 375 | 200 | 100 | yes | yes | - | 0 | yes | 29575 | 0 |
| `#/capabilities` | 技能 | 1440 | 200 | 99 | yes | - | - | 0 | yes | 67430 | 0 |
| `#/capabilities` | 技能 | 375 | 200 | 99 | yes | - | - | 0 | yes | 28603 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 304 | yes | - | - | 0 | yes | 74691 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 304 | yes | - | - | 0 | yes | 41794 | 0 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 104 | yes | - | - | 0 | yes | 68678 | 2 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 391 | yes | yes | - | 0 | yes | 70897 | 2 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 296 | yes | - | - | 0 | yes | 101859 | 1 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 296 | yes | - | - | 0 | yes | 60152 | 1 |
| `#/employees` | 列表 | 1440 | 200 | 224 | yes | - | - | 0 | yes | 82977 | 1 |
| `#/employees` | 列表 | 375 | 200 | 264 | yes | - | - | 0 | yes | 50809 | 1 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 215 | yes | - | - | 0 | yes | 87735 | 1 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 215 | yes | - | - | 0 | yes | 47467 | 1 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 39 | yes | - | - | 0 | yes | 79171 | 1 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 39 | yes | - | - | 0 | yes | 37488 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 39 | yes | - | - | 0 | yes | 56029 | 0 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 39 | yes | - | - | 0 | yes | 39582 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 39 | yes | - | - | 0 | yes | 80720 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 51 | yes | - | - | 0 | yes | 37676 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 179 | yes | - | - | 0 | yes | 78161 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 39 | yes | - | - | 0 | yes | 16090 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 39 | yes | - | - | 0 | yes | 52152 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 39 | yes | - | - | 0 | yes | 12794 | 0 |
| `#/identity` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69198 | 2 |
| `#/identity` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30938 | 2 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69195 | 2 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30936 | 2 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69198 | 2 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30936 | 2 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69197 | 2 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30935 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 154 | yes | yes | - | 0 | yes | 73348 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 154 | yes | yes | - | 0 | yes | 35139 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69198 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30938 | 2 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 104 | yes | yes | - | 0 | yes | 66914 | 0 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 104 | yes | yes | - | 0 | yes | 29028 | 0 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69198 | 2 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30938 | 2 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 107 | yes | yes | - | 0 | yes | 69237 | 0 |
| `#/knowledge` | 知识空间 | 375 | 200 | 107 | yes | yes | - | 0 | yes | 30255 | 0 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 89487 | 0 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 49751 | 0 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 89487 | 0 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 49751 | 0 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 97 | yes | yes | - | 0 | yes | 67581 | 0 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 97 | yes | yes | - | 0 | yes | 28650 | 0 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 89487 | 0 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 49751 | 0 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 107 | yes | yes | - | 0 | yes | 69237 | 0 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 107 | yes | yes | - | 0 | yes | 30255 | 0 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 97 | yes | yes | - | 0 | yes | 67579 | 0 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 97 | yes | yes | - | 0 | yes | 28650 | 0 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 103715 | 0 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 0 |
| `#/org` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69197 | 2 |
| `#/org` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30935 | 2 |
| `#/overview` | 值班台 | 1440 | 200 | 1012 | yes | yes | yes | 0 | no | 147915 | 0 |
| `#/overview` | 值班台 | 375 | 200 | 1012 | yes | yes | yes | 0 | no | 58597 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 369 | yes | - | - | 0 | yes | 105241 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 369 | yes | - | - | 0 | yes | 37345 | 0 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 56636 | 2 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 2 |
| `#/system` | 系统健康 | 1440 | 200 | 229 | yes | yes | yes | 0 | yes | 83684 | 1 |
| `#/system` | 系统健康 | 375 | 200 | 229 | yes | yes | yes | 0 | yes | 43817 | 1 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 236 | yes | yes | - | 0 | yes | 98007 | 1 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 236 | yes | yes | - | 0 | yes | 57258 | 1 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 100 | yes | yes | - | 0 | yes | 67778 | 0 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 100 | yes | yes | - | 0 | yes | 29575 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 100 | yes | yes | - | 0 | yes | 67777 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 100 | yes | yes | - | 0 | yes | 29575 | 0 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 100 | yes | yes | - | 0 | yes | 67777 | 0 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 100 | yes | yes | - | 0 | yes | 29575 | 0 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 100 | yes | yes | - | 0 | yes | 67777 | 0 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 100 | yes | yes | - | 0 | yes | 29575 | 0 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 285 | yes | - | - | 0 | yes | 97729 | 0 |
| `#/system?tab=version` | 版本 | 375 | 200 | 285 | yes | - | - | 0 | yes | 49984 | 0 |
| `#/work` | 任务 | 1440 | 200 | 132 | yes | - | - | 0 | yes | 74746 | 0 |
| `#/work` | 任务 | 375 | 200 | 1639 | yes | yes | - | 0 | yes | 58031 | 1 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 1639 | yes | yes | - | 0 | yes | 122682 | 1 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 226 | yes | - | - | 0 | yes | 57621 | 2 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 1639 | yes | yes | - | 0 | yes | 122682 | 1 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 1639 | yes | yes | - | 0 | yes | 58031 | 1 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 1096 | yes | - | yes | 0 | yes | 132553 | 0 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 1075 | yes | - | yes | 0 | yes | 48210 | 0 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
