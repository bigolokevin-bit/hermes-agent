# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 732 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135117 | 11 |
| `#/access` | 角色与权限 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 53079 | 11 |
| `#/approvals` | 待处理 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136055 | 11 |
| `#/approvals` | 待处理 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52223 | 11 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136368 | 11 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52549 | 11 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135761 | 11 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52520 | 11 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135858 | 11 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52809 | 11 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135854 | 11 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52491 | 11 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136182 | 11 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52508 | 11 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136392 | 11 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52863 | 11 |
| `#/audit` | 审计事件 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135949 | 11 |
| `#/audit` | 审计事件 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52517 | 11 |
| `#/capabilities` | 技能 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136292 | 11 |
| `#/capabilities` | 技能 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52376 | 11 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135963 | 11 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52706 | 11 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135474 | 11 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52824 | 11 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136020 | 11 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52605 | 11 |
| `#/employees` | 列表 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135351 | 11 |
| `#/employees` | 列表 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52658 | 11 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136179 | 11 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 53069 | 11 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136459 | 11 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52501 | 11 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135535 | 11 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 51936 | 11 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135743 | 11 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52283 | 11 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135622 | 11 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52721 | 11 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135448 | 11 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52169 | 11 |
| `#/identity` | 人员目录 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135887 | 11 |
| `#/identity` | 人员目录 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52704 | 11 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136224 | 11 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52369 | 11 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136151 | 11 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52593 | 11 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136146 | 11 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52895 | 11 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135897 | 11 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52562 | 11 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136288 | 11 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52472 | 11 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136328 | 11 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52604 | 11 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136209 | 11 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52558 | 11 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136077 | 11 |
| `#/knowledge` | 知识空间 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52248 | 11 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136552 | 11 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 53163 | 11 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135618 | 11 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52781 | 11 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136322 | 11 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52548 | 11 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136249 | 11 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 53006 | 11 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136206 | 11 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52391 | 11 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136755 | 11 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52488 | 11 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136313 | 11 |
| `#/metrics` | 用量与成本 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52738 | 11 |
| `#/org` | 人员目录 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136147 | 11 |
| `#/org` | 人员目录 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52278 | 11 |
| `#/overview` | 值班台 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135933 | 11 |
| `#/overview` | 值班台 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52483 | 11 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135725 | 11 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 53277 | 11 |
| `#/sessions` | 列表 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136144 | 11 |
| `#/sessions` | 列表 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52398 | 11 |
| `#/system` | 系统健康 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135889 | 11 |
| `#/system` | 系统健康 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52776 | 11 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135496 | 11 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52517 | 11 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135961 | 11 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 53128 | 11 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136026 | 11 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52849 | 11 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135931 | 11 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 716 | yes | yes | yes | 0 | no | 52500 | 11 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135972 | 11 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52409 | 11 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135479 | 11 |
| `#/system?tab=version` | 版本 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52930 | 11 |
| `#/work` | 任务 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135653 | 11 |
| `#/work` | 任务 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52734 | 11 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136079 | 11 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52856 | 11 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136212 | 11 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52696 | 11 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136015 | 11 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52692 | 11 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
