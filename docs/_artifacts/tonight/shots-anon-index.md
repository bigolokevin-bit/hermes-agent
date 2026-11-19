# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 732 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73921 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43611 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 71186 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39391 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 212 | yes | - | yes | 0 | yes | 84736 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 212 | yes | - | yes | 0 | yes | 51110 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70898 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39352 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 71101 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39172 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 71323 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39727 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70671 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39166 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70418 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39376 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 364 | yes | yes | yes | 0 | yes | 85833 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 364 | yes | yes | yes | 0 | yes | 53273 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 156 | yes | - | yes | 0 | yes | 68852 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 156 | yes | - | yes | 0 | yes | 38291 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 215 | yes | yes | - | 0 | yes | 79551 | 8 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 215 | yes | yes | - | 0 | yes | 47175 | 8 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 76443 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44671 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 170 | yes | - | - | 0 | yes | 71028 | 1 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 170 | yes | - | - | 0 | yes | 39524 | 1 |
| `#/employees` | 列表 | 1440 | 200 | 124 | yes | - | - | 0 | yes | 60889 | 3 |
| `#/employees` | 列表 | 375 | 200 | 124 | yes | - | - | 0 | yes | 31071 | 3 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 226 | yes | - | - | 0 | yes | 81447 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 226 | yes | - | - | 0 | yes | 49527 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 47423 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 31738 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45440 | 2 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 32710 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45615 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 51 | yes | - | - | 0 | yes | 16078 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 44964 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13470 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 64287 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13466 | 3 |
| `#/identity` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66591 | 3 |
| `#/identity` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 35011 | 3 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66330 | 3 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34862 | 3 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66284 | 3 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34868 | 3 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66179 | 3 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34915 | 3 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 147 | yes | - | - | 0 | yes | 62179 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 147 | yes | - | - | 0 | yes | 32032 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66317 | 3 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34721 | 3 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73835 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43543 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66213 | 3 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34877 | 3 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 239 | yes | yes | - | 0 | yes | 84214 | 2 |
| `#/knowledge` | 知识空间 | 375 | 200 | 239 | yes | yes | - | 0 | yes | 51988 | 2 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 317 | yes | yes | - | 0 | yes | 100504 | 3 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 317 | yes | yes | - | 0 | yes | 67111 | 3 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 317 | yes | yes | - | 0 | yes | 100504 | 3 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 317 | yes | yes | - | 0 | yes | 67111 | 3 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 318 | yes | yes | - | 0 | yes | 100861 | 3 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 318 | yes | yes | - | 0 | yes | 67504 | 3 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 348 | yes | yes | - | 0 | yes | 109557 | 3 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 348 | yes | yes | - | 0 | yes | 73648 | 3 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 239 | yes | yes | - | 0 | yes | 84214 | 2 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 237 | yes | yes | - | 0 | yes | 40349 | 7 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 318 | yes | yes | - | 0 | yes | 100861 | 3 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 318 | yes | yes | - | 0 | yes | 67504 | 3 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 96336 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 65816 | 3 |
| `#/org` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 35152 | 3 |
| `#/overview` | 值班台 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 126547 | 12 |
| `#/overview` | 值班台 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 53016 | 12 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 152 | yes | - | - | 0 | yes | 65572 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 152 | yes | - | - | 0 | yes | 33941 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 48837 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 333 | yes | yes | yes | 0 | yes | 94107 | 4 |
| `#/system` | 系统健康 | 375 | 200 | 333 | yes | yes | yes | 0 | yes | 59550 | 4 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 121 | yes | - | yes | 0 | yes | 61146 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 121 | yes | - | yes | 0 | yes | 30418 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 364 | yes | yes | yes | 0 | yes | 86016 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 364 | yes | yes | yes | 0 | yes | 53116 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 364 | yes | yes | yes | 0 | yes | 85949 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 364 | yes | yes | yes | 0 | yes | 53245 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 364 | yes | yes | yes | 0 | yes | 85965 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 364 | yes | yes | yes | 0 | yes | 53226 | 2 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 364 | yes | yes | yes | 0 | yes | 86022 | 2 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 364 | yes | yes | yes | 0 | yes | 53242 | 2 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 414 | yes | - | - | 0 | yes | 113215 | 2 |
| `#/system?tab=version` | 版本 | 375 | 200 | 414 | yes | - | - | 0 | yes | 49984 | 2 |
| `#/work` | 任务 | 1440 | 200 | 315 | yes | yes | - | 0 | yes | 98163 | 7 |
| `#/work` | 任务 | 375 | 200 | 315 | yes | yes | - | 0 | yes | 67364 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 315 | yes | yes | - | 0 | yes | 98607 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 315 | yes | yes | - | 0 | yes | 66689 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 315 | yes | yes | - | 0 | yes | 98727 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 315 | yes | yes | - | 0 | yes | 67132 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 265 | yes | - | yes | 0 | yes | 79337 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 265 | yes | - | yes | 0 | yes | 47720 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
