# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 494 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 75027 | 4 |
| `#/access` | 角色与权限 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 43061 | 4 |
| `#/approvals` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 70969 | 0 |
| `#/approvals` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 187 | yes | - | - | 0 | yes | 82284 | 0 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 187 | yes | - | - | 0 | yes | 47546 | 0 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 70969 | 0 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 70969 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 70969 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 70969 | 0 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 70969 | 0 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 145 | yes | - | - | 0 | yes | 38490 | 0 |
| `#/audit` | 审计事件 | 1440 | 200 | 7776 | yes | yes | yes | 0 | yes | 157676 | 0 |
| `#/audit` | 审计事件 | 375 | 200 | 7776 | yes | yes | yes | 0 | yes | 71839 | 0 |
| `#/capabilities` | 技能 | 1440 | 200 | 110 | yes | - | - | 0 | yes | 62063 | 0 |
| `#/capabilities` | 技能 | 375 | 200 | 110 | yes | - | - | 0 | yes | 31176 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 326 | yes | yes | - | 0 | yes | 103644 | 6 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 128 | yes | yes | - | 0 | yes | 33220 | 1 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 391 | yes | yes | - | 0 | yes | 117903 | 2 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 391 | yes | yes | - | 0 | yes | 70897 | 2 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 296 | yes | - | - | 0 | yes | 95875 | 1 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 296 | yes | - | - | 0 | yes | 60230 | 1 |
| `#/employees` | 列表 | 1440 | 200 | 224 | yes | - | - | 0 | yes | 76432 | 0 |
| `#/employees` | 列表 | 375 | 200 | 264 | yes | - | - | 0 | yes | 50809 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 191 | yes | yes | - | 0 | yes | 77514 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 191 | yes | yes | - | 0 | yes | 44625 | 0 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45181 | 1 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13281 | 0 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 46546 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 51 | yes | - | - | 0 | yes | 37863 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 46719 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13451 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 49432 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 16644 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 46290 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 39396 | 1 |
| `#/identity` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 62433 | 2 |
| `#/identity` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30938 | 2 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 62433 | 2 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30936 | 2 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 62433 | 2 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30936 | 2 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 62433 | 2 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30938 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 140 | yes | yes | - | 0 | yes | 68502 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 140 | yes | yes | - | 0 | yes | 37436 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 62433 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30935 | 2 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 75027 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 43061 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 62433 | 2 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30938 | 2 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 347 | yes | yes | - | 0 | yes | 105478 | 1 |
| `#/knowledge` | 知识空间 | 375 | 200 | 347 | yes | yes | - | 0 | yes | 70978 | 1 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 82933 | 0 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 49751 | 0 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 82933 | 0 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 49751 | 0 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 88 | yes | yes | - | 0 | yes | 59540 | 0 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 88 | yes | yes | - | 0 | yes | 27492 | 0 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 82933 | 0 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 49751 | 0 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 347 | yes | yes | - | 0 | yes | 105478 | 1 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 347 | yes | yes | - | 0 | yes | 70978 | 1 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 88 | yes | yes | - | 0 | yes | 59540 | 0 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 88 | yes | yes | - | 0 | yes | 27492 | 0 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 97313 | 0 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 0 |
| `#/org` | 人员目录 | 1440 | 200 | 129 | yes | yes | - | 0 | yes | 62433 | 2 |
| `#/org` | 人员目录 | 375 | 200 | 129 | yes | yes | - | 0 | yes | 30935 | 2 |
| `#/overview` | 值班台 | 1440 | 200 | 1012 | yes | yes | yes | 0 | no | 141703 | 0 |
| `#/overview` | 值班台 | 375 | 200 | 1012 | yes | yes | yes | 0 | no | 58597 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 369 | yes | - | - | 0 | yes | 98506 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 369 | yes | - | - | 0 | yes | 37345 | 0 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 49966 | 2 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 2 |
| `#/system` | 系统健康 | 1440 | 200 | 275 | yes | yes | yes | 0 | yes | 82918 | 1 |
| `#/system` | 系统健康 | 375 | 200 | 275 | yes | yes | yes | 0 | yes | 49188 | 1 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 236 | yes | yes | - | 0 | yes | 91697 | 1 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 236 | yes | yes | - | 0 | yes | 57258 | 1 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 7776 | yes | yes | yes | 0 | yes | 157676 | 0 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 7776 | yes | yes | yes | 0 | yes | 71839 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 7776 | yes | yes | yes | 0 | yes | 157676 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 7776 | yes | yes | yes | 0 | yes | 71839 | 0 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 7776 | yes | yes | yes | 0 | yes | 157676 | 0 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 7776 | yes | yes | yes | 0 | yes | 71839 | 0 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 7776 | yes | yes | yes | 0 | yes | 157676 | 0 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 7776 | yes | yes | yes | 0 | yes | 71839 | 0 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 391 | yes | - | - | 0 | yes | 107560 | 1 |
| `#/system?tab=version` | 版本 | 375 | 200 | 391 | yes | - | - | 0 | yes | 49984 | 1 |
| `#/work` | 任务 | 1440 | 200 | 1782 | yes | yes | - | 0 | yes | 124059 | 0 |
| `#/work` | 任务 | 375 | 200 | 1782 | yes | yes | - | 0 | yes | 63780 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 1782 | yes | yes | - | 0 | yes | 124059 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 1782 | yes | yes | - | 0 | yes | 63780 | 0 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 145 | yes | - | - | 0 | yes | 70813 | 0 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 1782 | yes | yes | - | 0 | yes | 63780 | 0 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 1006 | yes | - | yes | 0 | yes | 192520 | 0 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 982 | yes | - | yes | 0 | yes | 63845 | 0 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
