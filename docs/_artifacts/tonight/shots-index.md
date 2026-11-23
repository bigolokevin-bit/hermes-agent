# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 590 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 123 | yes | - | - | 0 | yes | 59057 | 0 |
| `#/access` | 角色与权限 | 375 | 200 | 179 | yes | yes | - | 0 | yes | 41730 | 4 |
| `#/approvals` | 待处理 | 1440 | 200 | 302 | yes | - | - | 0 | yes | 92702 | 0 |
| `#/approvals` | 待处理 | 375 | 200 | 302 | yes | - | - | 0 | yes | 50338 | 0 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 543 | yes | yes | - | 0 | yes | 138685 | 0 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 543 | yes | yes | - | 0 | yes | 87439 | 4 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 302 | yes | - | - | 0 | yes | 92702 | 0 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 302 | yes | - | - | 0 | yes | 50338 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 302 | yes | - | - | 0 | yes | 92702 | 0 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 302 | yes | - | - | 0 | yes | 50338 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 302 | yes | - | - | 0 | yes | 92702 | 0 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 302 | yes | - | - | 0 | yes | 50338 | 0 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 302 | yes | - | - | 0 | yes | 92702 | 0 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 302 | yes | - | - | 0 | yes | 50338 | 0 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 302 | yes | - | - | 0 | yes | 92702 | 0 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 302 | yes | - | - | 0 | yes | 50308 | 0 |
| `#/audit` | 审计事件 | 1440 | 200 | 6405 | yes | - | yes | 0 | yes | 195567 | 0 |
| `#/audit` | 审计事件 | 375 | 200 | 6405 | yes | - | yes | 0 | yes | 78652 | 0 |
| `#/capabilities` | 技能 | 1440 | 200 | 330 | yes | yes | - | 0 | yes | 95449 | 0 |
| `#/capabilities` | 技能 | 375 | 200 | 330 | yes | yes | - | 0 | yes | 62760 | 0 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 1002 | yes | yes | - | 0 | yes | 164656 | 4 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 1002 | yes | yes | - | 0 | yes | 98613 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 502 | yes | yes | - | 0 | yes | 140722 | 2 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 502 | yes | yes | - | 0 | yes | 68034 | 2 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 390 | yes | yes | yes | 0 | yes | 105363 | 3 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 390 | yes | yes | yes | 0 | yes | 73026 | 3 |
| `#/employees` | 列表 | 1440 | 200 | 542 | yes | - | yes | 0 | yes | 125333 | 0 |
| `#/employees` | 列表 | 375 | 200 | 537 | yes | - | yes | 0 | yes | 58738 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 195 | yes | yes | - | 0 | yes | 80382 | 0 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 195 | yes | yes | - | 0 | yes | 47679 | 0 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 59808 | 1 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 15159 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45104 | 1 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 15350 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45063 | 1 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 30744 | 1 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 51193 | 0 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 15315 | 0 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45053 | 1 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 15326 | 0 |
| `#/identity` | 人员目录 | 1440 | 200 | 196 | yes | yes | - | 0 | yes | 73586 | 2 |
| `#/identity` | 人员目录 | 375 | 200 | 187 | yes | yes | - | 0 | yes | 42936 | 2 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 196 | yes | yes | - | 0 | yes | 73586 | 2 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 187 | yes | yes | - | 0 | yes | 42936 | 2 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 196 | yes | yes | - | 0 | yes | 73583 | 2 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 187 | yes | yes | - | 0 | yes | 42936 | 2 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 194 | yes | yes | - | 0 | yes | 94947 | 6 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 187 | yes | yes | - | 0 | yes | 42936 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 51 | yes | - | - | 0 | yes | 48531 | 0 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 136 | yes | yes | - | 0 | yes | 38059 | 3 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 196 | yes | yes | - | 0 | yes | 73586 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 187 | yes | yes | - | 0 | yes | 42936 | 2 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 179 | yes | yes | - | 0 | yes | 72924 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 179 | yes | yes | - | 0 | yes | 41730 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 196 | yes | yes | - | 0 | yes | 73583 | 2 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 187 | yes | yes | - | 0 | yes | 42937 | 2 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 757 | yes | yes | - | 0 | yes | 177911 | 2 |
| `#/knowledge` | 知识空间 | 375 | 200 | 757 | yes | yes | - | 0 | yes | 75873 | 2 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 644 | yes | yes | - | 0 | yes | 153835 | 2 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 644 | yes | yes | - | 0 | yes | 75846 | 2 |
| `#/knowledge?tab=evidence` | 审计证据 | 1440 | 200 | 143 | yes | yes | - | 0 | yes | 72321 | 0 |
| `#/knowledge?tab=evidence` | 审计证据 | 375 | 200 | 143 | yes | yes | - | 0 | yes | 34786 | 0 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 910 | yes | yes | yes | 0 | yes | 156622 | 4 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 910 | yes | yes | yes | 0 | yes | 75878 | 4 |
| `#/knowledge?tab=retrieval` | 检索 | 1440 | 200 | 717 | yes | yes | - | 0 | yes | 167274 | 2 |
| `#/knowledge?tab=retrieval` | 检索 | 375 | 200 | 717 | yes | yes | - | 0 | yes | 75865 | 2 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 757 | yes | yes | - | 0 | yes | 177911 | 2 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 757 | yes | yes | - | 0 | yes | 75855 | 2 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 910 | yes | yes | yes | 0 | yes | 156622 | 4 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 910 | yes | yes | yes | 0 | yes | 75878 | 4 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 100320 | 0 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 63318 | 0 |
| `#/org` | 人员目录 | 1440 | 200 | 196 | yes | yes | - | 0 | yes | 73583 | 2 |
| `#/org` | 人员目录 | 375 | 200 | 187 | yes | yes | - | 0 | yes | 42936 | 2 |
| `#/overview` | 值班台 | 1440 | 200 | 1190 | yes | yes | yes | 0 | yes | 125850 | 0 |
| `#/overview` | 值班台 | 375 | 200 | 1195 | yes | yes | yes | 0 | yes | 45429 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 339 | yes | - | - | 0 | yes | 96418 | 0 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 339 | yes | - | - | 0 | yes | 39615 | 0 |
| `#/sessions` | 列表 | 1440 | 200 | 111 | yes | - | - | 0 | yes | 51621 | 0 |
| `#/sessions` | 列表 | 375 | 200 | 111 | yes | - | - | 0 | yes | 22796 | 0 |
| `#/system` | 系统健康 | 1440 | 200 | 1172 | yes | yes | yes | 0 | yes | 139923 | 0 |
| `#/system` | 系统健康 | 375 | 200 | 1183 | yes | yes | yes | 0 | yes | 75777 | 0 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 222 | yes | yes | - | 0 | yes | 89534 | 1 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 222 | yes | yes | - | 0 | yes | 56092 | 1 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 6405 | yes | - | yes | 0 | yes | 195565 | 0 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 6405 | yes | - | yes | 0 | yes | 78652 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 6405 | yes | - | yes | 0 | yes | 195565 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 6405 | yes | - | yes | 0 | yes | 78652 | 0 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 6405 | yes | - | yes | 0 | yes | 195565 | 0 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 6405 | yes | - | yes | 0 | yes | 78652 | 0 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 857 | yes | yes | - | 0 | yes | 153056 | 1 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 837 | yes | yes | - | 0 | yes | 72165 | 1 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 637 | yes | yes | - | 0 | yes | 120447 | 1 |
| `#/system?tab=version` | 版本 | 375 | 200 | 490 | yes | - | - | 0 | yes | 56328 | 1 |
| `#/work` | 任务 | 1440 | 200 | 1830 | yes | yes | - | 0 | yes | 137603 | 0 |
| `#/work` | 任务 | 375 | 200 | 1830 | yes | yes | - | 0 | yes | 64982 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 1830 | yes | yes | - | 0 | yes | 137603 | 0 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 1830 | yes | yes | - | 0 | yes | 64982 | 0 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 1830 | yes | yes | - | 0 | yes | 137603 | 0 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 1830 | yes | yes | - | 0 | yes | 64982 | 0 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 3049 | yes | - | yes | 0 | yes | 168504 | 0 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 3741 | yes | - | yes | 0 | yes | 76060 | 0 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
