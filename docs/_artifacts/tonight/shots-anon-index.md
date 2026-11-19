# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 732 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 211 | yes | - | - | 0 | yes | 72476 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 211 | yes | - | - | 0 | yes | 42828 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 69978 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39519 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 212 | yes | - | yes | 0 | yes | 83047 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 212 | yes | - | yes | 0 | yes | 51435 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70012 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39387 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70143 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39449 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70016 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39314 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70098 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39223 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70753 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 166 | yes | - | yes | 0 | yes | 39045 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87704 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56299 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 156 | yes | - | yes | 0 | yes | 68681 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 156 | yes | - | yes | 0 | yes | 38390 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 215 | yes | yes | - | 0 | yes | 78777 | 7 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 215 | yes | yes | - | 0 | yes | 47169 | 7 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 178 | yes | - | - | 0 | yes | 76047 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 178 | yes | - | - | 0 | yes | 44911 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 189 | yes | - | - | 0 | yes | 73233 | 2 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 189 | yes | - | - | 0 | yes | 42147 | 2 |
| `#/employees` | 列表 | 1440 | 200 | 124 | yes | - | - | 0 | yes | 59836 | 3 |
| `#/employees` | 列表 | 375 | 200 | 124 | yes | - | - | 0 | yes | 30723 | 3 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 226 | yes | - | - | 0 | yes | 81304 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 226 | yes | - | - | 0 | yes | 49259 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 43538 | 3 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 51 | yes | - | - | 0 | yes | 15898 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 44888 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13662 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 62957 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 30153 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 62179 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13470 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 62293 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 13466 | 2 |
| `#/identity` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 62986 | 3 |
| `#/identity` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33261 | 3 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63232 | 3 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33435 | 3 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63392 | 3 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33280 | 3 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63096 | 3 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33378 | 3 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 147 | yes | - | - | 0 | yes | 61560 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 147 | yes | - | - | 0 | yes | 32032 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 62695 | 3 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33443 | 3 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 211 | yes | - | - | 0 | yes | 72561 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 211 | yes | - | - | 0 | yes | 42889 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63278 | 3 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33571 | 3 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 294 | yes | yes | - | 0 | yes | 93340 | 2 |
| `#/knowledge` | 知识空间 | 375 | 200 | 294 | yes | yes | - | 0 | yes | 62252 | 2 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 81369 | 1 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 49751 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 81369 | 1 |
| `#/knowledge?tab=evidence` | 证据与引用 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 49751 | 1 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 88 | yes | yes | - | 0 | yes | 57888 | 1 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 88 | yes | yes | - | 0 | yes | 27492 | 1 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 81369 | 1 |
| `#/knowledge?tab=retrieval` | 证据与引用 | 375 | 200 | 194 | yes | yes | - | 0 | yes | 49751 | 1 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 294 | yes | yes | - | 0 | yes | 93340 | 2 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 294 | yes | yes | - | 0 | yes | 62252 | 2 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 88 | yes | yes | - | 0 | yes | 57888 | 1 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 88 | yes | yes | - | 0 | yes | 27492 | 1 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 95762 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 59672 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 161 | yes | - | - | 0 | yes | 63056 | 3 |
| `#/org` | 人员目录 | 375 | 200 | 161 | yes | - | - | 0 | yes | 33759 | 3 |
| `#/overview` | 值班台 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 126296 | 12 |
| `#/overview` | 值班台 | 375 | 200 | 732 | yes | yes | yes | 0 | no | 52752 | 12 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 152 | yes | - | - | 0 | yes | 64680 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 152 | yes | - | - | 0 | yes | 34052 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 48301 | 3 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 20050 | 3 |
| `#/system` | 系统健康 | 1440 | 200 | 405 | yes | yes | yes | 0 | yes | 99754 | 4 |
| `#/system` | 系统健康 | 375 | 200 | 405 | yes | yes | yes | 0 | yes | 65966 | 4 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 121 | yes | - | yes | 0 | yes | 60226 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 121 | yes | - | yes | 0 | yes | 30272 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87892 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56386 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 88035 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56211 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87712 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56535 | 2 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 518 | yes | yes | yes | 0 | yes | 87963 | 2 |
| `#/system?tab=security` | 审计事件 | 375 | 200 | 518 | yes | yes | yes | 0 | yes | 56126 | 2 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 406 | yes | - | - | 0 | yes | 109486 | 2 |
| `#/system?tab=version` | 版本 | 375 | 200 | 406 | yes | - | - | 0 | yes | 49984 | 2 |
| `#/work` | 任务 | 1440 | 200 | 255 | yes | - | - | 0 | yes | 91107 | 7 |
| `#/work` | 任务 | 375 | 200 | 255 | yes | - | - | 0 | yes | 60093 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 255 | yes | - | - | 0 | yes | 90760 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 255 | yes | - | - | 0 | yes | 60594 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 255 | yes | - | - | 0 | yes | 90782 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 255 | yes | - | - | 0 | yes | 60005 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 265 | yes | - | yes | 0 | yes | 78945 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 265 | yes | - | yes | 0 | yes | 47778 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
