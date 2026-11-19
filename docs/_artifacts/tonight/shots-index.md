# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 714 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 89 | yes | yes | - | 0 | yes | 64607 | 0 |
| `#/access` | 角色与权限 | 375 | 200 | 89 | yes | yes | - | 0 | yes | 26582 | 0 |
| `#/approvals` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77401 | 0 |
| `#/approvals` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 187 | yes | - | - | 0 | yes | 88779 | 0 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 187 | yes | - | - | 0 | yes | 47546 | 0 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77402 | 0 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77402 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77401 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77401 | 0 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 77401 | 0 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/audit` | 审计事件 | 1440 | 200 | 664 | yes | yes | yes | 0 | yes | 94850 | 0 |
| `#/audit` | 审计事件 | 375 | 200 | 664 | yes | yes | yes | 0 | yes | 55530 | 0 |
| `#/capabilities` | 技能 | 1440 | 200 | 99 | yes | - | - | 0 | yes | 67427 | 0 |
| `#/capabilities` | 技能 | 375 | 200 | 99 | yes | - | - | 0 | yes | 28603 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 322 | yes | yes | - | 0 | yes | 109682 | 6 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 124 | yes | yes | - | 0 | yes | 67484 | 6 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 391 | yes | yes | - | 0 | yes | 124318 | 2 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 391 | yes | yes | - | 0 | yes | 70897 | 2 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 296 | yes | - | - | 0 | yes | 102295 | 1 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 296 | yes | - | - | 0 | yes | 60349 | 1 |
| `#/employees` | 列表 | 1440 | 200 | 224 | yes | - | - | 0 | yes | 82969 | 0 |
| `#/employees` | 列表 | 375 | 200 | 264 | yes | - | - | 0 | yes | 50809 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 191 | yes | yes | - | 0 | yes | 84268 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 191 | yes | yes | - | 0 | yes | 44625 | 0 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 39 | yes | - | - | 0 | yes | 79150 | 1 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 51 | yes | - | - | 0 | yes | 15898 | 0 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 39 | yes | - | - | 0 | yes | 52407 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 39 | yes | - | - | 0 | yes | 12993 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 39 | yes | - | - | 0 | yes | 52585 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 39 | yes | - | - | 0 | yes | 12782 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 39 | yes | - | - | 0 | yes | 51930 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 39 | yes | - | - | 0 | yes | 39399 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 39 | yes | - | - | 0 | yes | 52142 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 39 | yes | - | - | 0 | yes | 12794 | 0 |
| `#/identity` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69193 | 2 |
| `#/identity` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30935 | 2 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69192 | 2 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30935 | 2 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69194 | 2 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30938 | 2 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69194 | 2 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30936 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 154 | yes | yes | - | 0 | yes | 73340 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 154 | yes | yes | - | 0 | yes | 35139 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69191 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30938 | 2 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 89 | yes | yes | - | 0 | yes | 64607 | 0 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 89 | yes | yes | - | 0 | yes | 26582 | 0 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69192 | 2 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30935 | 2 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 92 | yes | yes | - | 0 | yes | 66951 | 0 |
| `#/knowledge` | 知识空间 | 375 | 200 | 92 | yes | yes | - | 0 | yes | 27805 | 0 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 89482 | 0 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 49751 | 0 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 89481 | 0 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 49751 | 0 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 82 | yes | yes | - | 0 | yes | 65249 | 0 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 82 | yes | yes | - | 0 | yes | 26210 | 0 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 89480 | 0 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 49751 | 0 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 92 | yes | yes | - | 0 | yes | 66951 | 0 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 92 | yes | yes | - | 0 | yes | 27805 | 0 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 82 | yes | yes | - | 0 | yes | 65249 | 0 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 82 | yes | yes | - | 0 | yes | 26210 | 0 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 103713 | 0 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 0 |
| `#/org` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 69195 | 2 |
| `#/org` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30935 | 2 |
| `#/overview` | 值班台 | 1440 | 200 | 1012 | yes | yes | yes | 0 | no | 147878 | 0 |
| `#/overview` | 值班台 | 375 | 200 | 1012 | yes | yes | yes | 0 | no | 58597 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 369 | yes | - | - | 0 | yes | 105187 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 369 | yes | - | - | 0 | yes | 37345 | 0 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 56630 | 2 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 2 |
| `#/system` | 系统健康 | 1440 | 200 | 221 | yes | yes | yes | 0 | yes | 82546 | 1 |
| `#/system` | 系统健康 | 375 | 200 | 221 | yes | yes | yes | 0 | yes | 42944 | 1 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 236 | yes | yes | - | 0 | yes | 97983 | 1 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 236 | yes | yes | - | 0 | yes | 57258 | 1 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 664 | yes | yes | yes | 0 | yes | 94851 | 0 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 664 | yes | yes | yes | 0 | yes | 55530 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 664 | yes | yes | yes | 0 | yes | 94851 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 664 | yes | yes | yes | 0 | yes | 55530 | 0 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 664 | yes | yes | yes | 0 | yes | 94850 | 0 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 664 | yes | yes | yes | 0 | yes | 55530 | 0 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 664 | yes | yes | yes | 0 | yes | 94850 | 0 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 664 | yes | yes | yes | 0 | yes | 55530 | 0 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 391 | yes | - | - | 0 | yes | 114216 | 1 |
| `#/system?tab=version` | 版本 | 375 | 200 | 391 | yes | - | - | 0 | yes | 49984 | 1 |
| `#/work` | 任务 | 1440 | 200 | 1782 | yes | yes | - | 0 | yes | 130356 | 0 |
| `#/work` | 任务 | 375 | 200 | 1782 | yes | yes | - | 0 | yes | 63780 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 1782 | yes | yes | - | 0 | yes | 130351 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 1782 | yes | yes | - | 0 | yes | 63780 | 0 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 1782 | yes | yes | - | 0 | yes | 130356 | 0 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 1782 | yes | yes | - | 0 | yes | 63780 | 0 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 1006 | yes | - | yes | 0 | yes | 198827 | 0 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 982 | yes | - | yes | 0 | yes | 63589 | 0 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
