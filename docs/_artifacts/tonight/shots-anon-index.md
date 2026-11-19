# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 963 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73691 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43535 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 71027 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 38780 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 242 | yes | - | yes | 0 | yes | 92002 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 242 | yes | - | yes | 0 | yes | 49026 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 71058 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39456 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70600 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39749 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 71084 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39741 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70477 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39135 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70477 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39359 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 398 | yes | yes | yes | 0 | yes | 90284 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 398 | yes | yes | yes | 0 | yes | 57824 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 190 | yes | - | yes | 0 | yes | 75118 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 190 | yes | - | yes | 0 | yes | 44056 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 215 | yes | yes | - | 0 | yes | 79435 | 8 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 215 | yes | yes | - | 0 | yes | 47199 | 8 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 76032 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44745 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 223 | yes | - | - | 0 | yes | 79237 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 223 | yes | - | - | 0 | yes | 47449 | 4 |
| `#/employees` | 列表 | 1440 | 200 | 186 | yes | - | - | 0 | yes | 72116 | 2 |
| `#/employees` | 列表 | 375 | 200 | 186 | yes | - | - | 0 | yes | 41002 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 226 | yes | - | - | 0 | yes | 81232 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 226 | yes | - | - | 0 | yes | 49057 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 44074 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 32460 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 65869 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 32351 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45615 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13451 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 44964 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 32871 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45172 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13466 | 3 |
| `#/identity` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66029 | 4 |
| `#/identity` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34656 | 4 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66048 | 4 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34792 | 4 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66250 | 4 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34474 | 4 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66327 | 4 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34703 | 4 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 147 | yes | - | - | 0 | yes | 62179 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 147 | yes | - | - | 0 | yes | 32032 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66213 | 4 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34960 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73658 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43401 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66054 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34942 | 4 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 375 | yes | yes | - | 0 | yes | 112168 | 3 |
| `#/knowledge` | 知识空间 | 375 | 200 | 375 | yes | yes | - | 0 | yes | 67254 | 3 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 453 | yes | yes | - | 0 | yes | 128395 | 4 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 453 | yes | yes | - | 0 | yes | 66604 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 453 | yes | yes | - | 0 | yes | 128394 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 453 | yes | yes | - | 0 | yes | 66604 | 4 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 529 | yes | yes | - | 0 | yes | 128701 | 5 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 529 | yes | yes | - | 0 | yes | 66582 | 5 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 484 | yes | yes | - | 0 | yes | 136139 | 4 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 484 | yes | yes | - | 0 | yes | 68855 | 4 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 375 | yes | yes | - | 0 | yes | 112168 | 3 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 375 | yes | yes | - | 0 | yes | 67254 | 3 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 529 | yes | yes | - | 0 | yes | 128701 | 5 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 529 | yes | yes | - | 0 | yes | 66582 | 5 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 96336 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66138 | 4 |
| `#/org` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34746 | 4 |
| `#/overview` | 值班台 | 1440 | 200 | 963 | yes | yes | yes | 0 | no | 154051 | 12 |
| `#/overview` | 值班台 | 375 | 200 | 963 | yes | yes | yes | 0 | no | 58441 | 12 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 152 | yes | - | - | 0 | yes | 65281 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 152 | yes | - | - | 0 | yes | 34287 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 48837 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 406 | yes | yes | yes | 0 | yes | 113082 | 4 |
| `#/system` | 系统健康 | 375 | 200 | 406 | yes | yes | yes | 0 | yes | 47153 | 4 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 125 | yes | - | yes | 0 | yes | 62995 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 125 | yes | - | yes | 0 | yes | 32532 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 398 | yes | yes | yes | 0 | yes | 90378 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 398 | yes | yes | yes | 0 | yes | 57948 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 398 | yes | yes | yes | 0 | yes | 90483 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 398 | yes | yes | yes | 0 | yes | 57860 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 398 | yes | yes | yes | 0 | yes | 90316 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 398 | yes | yes | yes | 0 | yes | 57648 | 2 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 317 | yes | - | - | 0 | yes | 104317 | 5 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 317 | yes | - | - | 0 | yes | 55163 | 5 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 425 | yes | - | - | 0 | yes | 115056 | 2 |
| `#/system?tab=version` | 版本 | 375 | 200 | 425 | yes | - | - | 0 | yes | 51436 | 2 |
| `#/work` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 99936 | 7 |
| `#/work` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 68969 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 99970 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 68633 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 100249 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 69162 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 265 | yes | - | yes | 0 | yes | 79446 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 265 | yes | - | yes | 0 | yes | 47616 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
