# lane-D screenshot evidence index

- base: `http://127.0.0.1:9119`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell main text length: 0 chars (`mainDiffers` compares the first 40 chars against that)

| route (hash) | label | vp | HTTP | main chars | empty? | error? | overflow px | mainDiffers | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 110 | yes | - | 0 | yes | 79364 | 0 |
| `#/access` | 角色与权限 | 375 | 200 | 110 | yes | - | 0 | yes | 42998 | 0 |
| `#/approvals` | 待处理 | 1440 | 200 | 92 | - | yes | 0 | yes | 78412 | 0 |
| `#/approvals` | 待处理 | 375 | 200 | 92 | - | yes | 0 | yes | 42171 | 0 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 106 | yes | - | 0 | yes | 78666 | 0 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 106 | yes | - | 0 | yes | 42515 | 0 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 92 | - | yes | 0 | yes | 78412 | 0 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 92 | - | yes | 0 | yes | 42171 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 92 | - | yes | 0 | yes | 78412 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 92 | - | yes | 0 | yes | 42171 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 92 | - | yes | 0 | yes | 78412 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 92 | - | yes | 0 | yes | 42171 | 0 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 92 | - | yes | 0 | yes | 78412 | 0 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 92 | - | yes | 0 | yes | 42171 | 0 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 92 | - | yes | 0 | yes | 78412 | 0 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 92 | - | yes | 0 | yes | 42171 | 0 |
| `#/audit` | 审计事件 | 1440 | 200 | 132 | yes | - | 0 | yes | 80681 | 0 |
| `#/audit` | 审计事件 | 375 | 200 | 132 | yes | - | 0 | yes | 44623 | 0 |
| `#/capabilities` | 技能 | 1440 | 200 | 3378 | - | - | 0 | yes | 148038 | 0 |
| `#/capabilities` | 技能 | 375 | 200 | 3217 | - | - | 0 | yes | 43723 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 38 | - | - | 0 | yes | 148951 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 38 | - | - | 0 | yes | 48845 | 0 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 796 | - | - | 0 | yes | 113622 | 0 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 796 | - | - | 0 | yes | 44128 | 0 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 10632 | - | - | 0 | yes | 136375 | 0 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 10632 | - | - | 0 | yes | 47347 | 0 |
| `#/employees` | 列表 | 1440 | 200 | 113 | - | yes | 0 | yes | 74872 | 0 |
| `#/employees` | 列表 | 375 | 200 | 113 | - | yes | 0 | yes | 39030 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 140 | yes | - | 0 | yes | 80511 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 140 | yes | - | 0 | yes | 44518 | 0 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 102 | - | yes | 0 | yes | 72349 | 0 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 102 | - | yes | 0 | yes | 36386 | 0 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 102 | - | yes | 0 | yes | 73690 | 0 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 102 | - | yes | 0 | yes | 37720 | 0 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 102 | - | yes | 0 | yes | 73854 | 0 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 102 | - | yes | 0 | yes | 37833 | 0 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 102 | - | yes | 0 | yes | 73223 | 0 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 102 | - | yes | 0 | yes | 37201 | 0 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 102 | - | yes | 0 | yes | 73429 | 0 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 102 | - | yes | 0 | yes | 37402 | 0 |
| `#/identity` | 人员目录 | 1440 | 200 | 118 | yes | - | 0 | yes | 80176 | 0 |
| `#/identity` | 人员目录 | 375 | 200 | 118 | yes | - | 0 | yes | 43790 | 0 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 118 | yes | - | 0 | yes | 80176 | 0 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 118 | yes | - | 0 | yes | 43790 | 0 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 118 | yes | - | 0 | yes | 80176 | 0 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 118 | yes | - | 0 | yes | 43790 | 0 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 118 | yes | - | 0 | yes | 80176 | 0 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 118 | yes | - | 0 | yes | 43790 | 0 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 115 | yes | - | 0 | yes | 79492 | 0 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 115 | yes | - | 0 | yes | 43221 | 0 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 118 | yes | - | 0 | yes | 80176 | 0 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 118 | yes | - | 0 | yes | 43790 | 0 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 110 | yes | - | 0 | yes | 79364 | 0 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 110 | yes | - | 0 | yes | 42998 | 0 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 118 | yes | - | 0 | yes | 80176 | 0 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 118 | yes | - | 0 | yes | 43790 | 0 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 120 | yes | - | 0 | yes | 81855 | 0 |
| `#/knowledge` | 知识空间 | 375 | 200 | 120 | yes | - | 0 | yes | 45135 | 0 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 123 | yes | - | 0 | yes | 80473 | 0 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 123 | yes | - | 0 | yes | 44170 | 0 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 123 | yes | - | 0 | yes | 80473 | 0 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 123 | yes | - | 0 | yes | 44170 | 0 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 95 | yes | - | 0 | yes | 79505 | 0 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 95 | yes | - | 0 | yes | 43079 | 0 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 123 | yes | - | 0 | yes | 80473 | 0 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 123 | yes | - | 0 | yes | 44170 | 0 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 120 | yes | - | 0 | yes | 81855 | 0 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 120 | yes | - | 0 | yes | 45135 | 0 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 95 | yes | - | 0 | yes | 79505 | 0 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 95 | yes | - | 0 | yes | 43079 | 0 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | - | - | 0 | yes | 116805 | 0 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | - | - | 0 | yes | 61345 | 0 |
| `#/org` | 人员目录 | 1440 | 200 | 118 | yes | - | 0 | yes | 80176 | 0 |
| `#/org` | 人员目录 | 375 | 200 | 118 | yes | - | 0 | yes | 43790 | 0 |
| `#/overview` | 值班台 | 1440 | 200 | 136 | yes | - | 0 | yes | 80459 | 0 |
| `#/overview` | 值班台 | 375 | 200 | 136 | yes | - | 0 | yes | 44035 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 842 | - | - | 0 | yes | 122535 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 842 | - | - | 0 | yes | 53917 | 0 |
| `#/sessions` | 列表 | 1440 | 200 | 352 | - | - | 0 | yes | 92776 | 0 |
| `#/sessions` | 列表 | 375 | 200 | 352 | - | - | 0 | yes | 38971 | 0 |
| `#/system` | 系统健康 | 1440 | 200 | 33 | - | - | 0 | yes | 65758 | 0 |
| `#/system` | 系统健康 | 375 | 200 | 33 | - | - | 0 | yes | 29887 | 0 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 134 | yes | - | 0 | yes | 83982 | 0 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 134 | yes | - | 0 | yes | 47338 | 0 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 132 | yes | - | 0 | yes | 80681 | 0 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 132 | yes | - | 0 | yes | 44623 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 132 | yes | - | 0 | yes | 80681 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 132 | yes | - | 0 | yes | 44623 | 0 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 132 | yes | - | 0 | yes | 80681 | 0 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 132 | yes | - | 0 | yes | 44623 | 0 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 132 | yes | - | 0 | yes | 80681 | 0 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 132 | yes | - | 0 | yes | 44623 | 0 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 90 | yes | - | 0 | yes | 78786 | 0 |
| `#/system?tab=version` | 版本 | 375 | 200 | 90 | yes | - | 0 | yes | 42711 | 0 |
| `#/work` | 任务 | 1440 | 200 | 100 | yes | - | 0 | yes | 75036 | 0 |
| `#/work` | 任务 | 375 | 200 | 100 | yes | - | 0 | yes | 39224 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 100 | yes | - | 0 | yes | 75036 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 100 | yes | - | 0 | yes | 39224 | 0 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 100 | yes | - | 0 | yes | 75036 | 0 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 100 | yes | - | 0 | yes | 39224 | 0 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 114 | yes | - | 0 | yes | 75784 | 0 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 114 | yes | - | 0 | yes | 40154 | 0 |

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
