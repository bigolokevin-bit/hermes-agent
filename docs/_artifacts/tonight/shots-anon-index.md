# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 963 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73653 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43427 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 223 | yes | - | yes | 0 | yes | 78408 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 223 | yes | - | yes | 0 | yes | 46209 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 299 | yes | - | yes | 0 | yes | 98961 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 299 | yes | - | yes | 0 | yes | 55111 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 223 | yes | - | yes | 0 | yes | 78675 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 223 | yes | - | yes | 0 | yes | 46082 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 223 | yes | - | yes | 0 | yes | 78576 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 223 | yes | - | yes | 0 | yes | 46051 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 223 | yes | - | yes | 0 | yes | 78879 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 223 | yes | - | yes | 0 | yes | 46256 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 223 | yes | - | yes | 0 | yes | 78355 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 223 | yes | - | yes | 0 | yes | 45999 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 223 | yes | - | yes | 0 | yes | 78426 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 223 | yes | - | yes | 0 | yes | 45935 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 458 | yes | yes | yes | 0 | yes | 98962 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 458 | yes | yes | yes | 0 | yes | 65773 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 190 | yes | - | yes | 0 | yes | 75407 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 190 | yes | - | yes | 0 | yes | 44186 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 215 | yes | yes | - | 0 | yes | 79205 | 8 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 215 | yes | yes | - | 0 | yes | 47318 | 8 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 76225 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44565 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 223 | yes | - | - | 0 | yes | 79473 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 223 | yes | - | - | 0 | yes | 47516 | 4 |
| `#/employees` | 列表 | 1440 | 200 | 241 | yes | - | - | 0 | yes | 82129 | 2 |
| `#/employees` | 列表 | 375 | 200 | 241 | yes | - | - | 0 | yes | 49979 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 226 | yes | - | - | 0 | yes | 81114 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 226 | yes | - | - | 0 | yes | 49168 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 50732 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 19693 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45440 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 35549 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45615 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13451 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 66 | yes | - | - | 0 | yes | 68353 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13470 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 68555 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13466 | 3 |
| `#/identity` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66262 | 4 |
| `#/identity` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 35065 | 4 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66097 | 4 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34549 | 4 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66412 | 4 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34766 | 4 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66198 | 4 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34931 | 4 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 147 | yes | - | - | 0 | yes | 62179 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 147 | yes | - | - | 0 | yes | 32032 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66428 | 4 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34940 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 213 | yes | - | - | 0 | yes | 73285 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 213 | yes | - | - | 0 | yes | 43447 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66200 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34442 | 4 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 425 | yes | yes | - | 0 | yes | 123185 | 3 |
| `#/knowledge` | 知识空间 | 375 | 200 | 425 | yes | yes | - | 0 | yes | 66064 | 3 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 454 | yes | yes | - | 0 | yes | 128377 | 4 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 454 | yes | yes | - | 0 | yes | 63749 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 454 | yes | yes | - | 0 | yes | 128377 | 4 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 454 | yes | yes | - | 0 | yes | 63749 | 4 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 530 | yes | yes | - | 0 | yes | 122008 | 5 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 530 | yes | yes | - | 0 | yes | 63712 | 5 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 485 | yes | yes | - | 0 | yes | 125570 | 4 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 485 | yes | yes | - | 0 | yes | 64397 | 4 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 425 | yes | yes | - | 0 | yes | 123185 | 3 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 425 | yes | yes | - | 0 | yes | 66064 | 3 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 530 | yes | yes | - | 0 | yes | 122008 | 5 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 530 | yes | yes | - | 0 | yes | 63712 | 5 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 96336 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 66209 | 4 |
| `#/org` | 人员目录 | 375 | 200 | 163 | yes | - | - | 0 | yes | 34800 | 4 |
| `#/overview` | 值班台 | 1440 | 200 | 963 | yes | yes | yes | 0 | no | 153164 | 12 |
| `#/overview` | 值班台 | 375 | 200 | 963 | yes | yes | yes | 0 | no | 58679 | 12 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 152 | yes | - | - | 0 | yes | 65560 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 152 | yes | - | - | 0 | yes | 34222 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 48837 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 635 | yes | yes | yes | 0 | yes | 126950 | 5 |
| `#/system` | 系统健康 | 375 | 200 | 635 | yes | yes | yes | 0 | yes | 54395 | 5 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 125 | yes | - | yes | 0 | yes | 62734 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 125 | yes | - | yes | 0 | yes | 32493 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 458 | yes | yes | yes | 0 | yes | 99090 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 458 | yes | yes | yes | 0 | yes | 65743 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 458 | yes | yes | yes | 0 | yes | 99010 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 458 | yes | yes | yes | 0 | yes | 66023 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 458 | yes | yes | yes | 0 | yes | 98890 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 458 | yes | yes | yes | 0 | yes | 65749 | 2 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 317 | yes | - | - | 0 | yes | 104274 | 5 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 317 | yes | - | - | 0 | yes | 55125 | 5 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 543 | yes | - | yes | 0 | yes | 135983 | 4 |
| `#/system?tab=version` | 版本 | 375 | 200 | 543 | yes | - | yes | 0 | yes | 62056 | 4 |
| `#/work` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 99938 | 7 |
| `#/work` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 68271 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 100092 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 68936 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 319 | yes | yes | - | 0 | yes | 100155 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 319 | yes | yes | - | 0 | yes | 68591 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 265 | yes | - | yes | 0 | yes | 79356 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 265 | yes | - | yes | 0 | yes | 47556 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
