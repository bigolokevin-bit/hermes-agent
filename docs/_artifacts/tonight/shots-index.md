# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 51  |  expected shots: 102  |  produced: **102**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 1063 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/access` | 角色与权限 | 1440 | 200 | 186 | yes | - | - | 0 | yes | 72232 | 5 |
| `#/access` | 角色与权限 | 375 | 200 | 186 | yes | - | - | 0 | yes | 43887 | 5 |
| `#/approvals` | 待处理 | 1440 | 200 | 337 | yes | - | yes | 0 | yes | 96653 | 2 |
| `#/approvals` | 待处理 | 375 | 200 | 337 | yes | - | yes | 0 | yes | 57342 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 523 | yes | yes | yes | 0 | yes | 131446 | 2 |
| `#/approvals?tab=history` | 历史决策 | 375 | 200 | 523 | yes | yes | yes | 0 | yes | 85684 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 337 | yes | - | yes | 0 | yes | 96495 | 2 |
| `#/approvals?tab=mine` | 待处理 | 375 | 200 | 337 | yes | - | yes | 0 | yes | 57575 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 337 | yes | - | yes | 0 | yes | 96316 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 375 | 200 | 337 | yes | - | yes | 0 | yes | 57538 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 337 | yes | - | yes | 0 | yes | 96298 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 375 | 200 | 337 | yes | - | yes | 0 | yes | 57565 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 337 | yes | - | yes | 0 | yes | 95898 | 2 |
| `#/approvals?tab=policy` | 待处理 | 375 | 200 | 337 | yes | - | yes | 0 | yes | 57554 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 337 | yes | - | yes | 0 | yes | 96532 | 2 |
| `#/approvals?tab=release` | 待处理 | 375 | 200 | 337 | yes | - | yes | 0 | yes | 57546 | 2 |
| `#/audit` | 审计事件 | 1440 | 200 | 659 | yes | - | yes | 0 | yes | 161055 | 2 |
| `#/audit` | 审计事件 | 375 | 200 | 659 | yes | - | yes | 0 | yes | 87606 | 2 |
| `#/capabilities` | 技能 | 1440 | 200 | 340 | yes | yes | yes | 0 | yes | 98095 | 2 |
| `#/capabilities` | 技能 | 375 | 200 | 340 | yes | yes | yes | 0 | yes | 63793 | 2 |
| `#/capabilities?tab=channels` | 平台接入 | 1440 | 200 | 185 | yes | - | - | 0 | yes | 80302 | 13 |
| `#/capabilities?tab=channels` | 平台接入 | 375 | 200 | 185 | yes | - | - | 0 | yes | 50559 | 13 |
| `#/capabilities?tab=models` | 模型与单价 | 1440 | 200 | 163 | yes | - | - | 0 | yes | 75313 | 4 |
| `#/capabilities?tab=models` | 模型与单价 | 375 | 200 | 163 | yes | - | - | 0 | yes | 43380 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 1440 | 200 | 375 | yes | yes | yes | 0 | yes | 103748 | 4 |
| `#/capabilities?tab=tools` | 工具与 MCP | 375 | 200 | 375 | yes | yes | yes | 0 | yes | 72273 | 4 |
| `#/employees` | 列表 | 1440 | 200 | 282 | yes | - | - | 0 | yes | 97520 | 2 |
| `#/employees` | 列表 | 375 | 200 | 282 | yes | - | - | 0 | yes | 55513 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 214 | yes | - | - | 0 | yes | 84780 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 375 | 200 | 214 | yes | - | - | 0 | yes | 53166 | 2 |
| `#/employees/:employeeId` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 45422 | 2 |
| `#/employees/:employeeId` | 详情 | 375 | 200 | 66 | yes | - | - | 0 | yes | 38646 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 1440 | 200 | 42 | yes | - | - | 0 | yes | 67715 | 3 |
| `#/employees/:employeeId?zone=config` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 26034 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 1440 | 200 | 66 | yes | - | - | 0 | yes | 68005 | 3 |
| `#/employees/:employeeId?zone=evidence` | 详情 | 375 | 200 | 42 | yes | - | - | 0 | yes | 38631 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 1440 | 200 | 66 | yes | - | - | 0 | yes | 67113 | 3 |
| `#/employees/:employeeId?zone=runs` | 详情 | 375 | 200 | 146 | yes | - | - | 0 | yes | 38363 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 1440 | 200 | 66 | yes | - | - | 0 | yes | 67666 | 3 |
| `#/employees/:employeeId?zone=tasks` | 详情 | 375 | 200 | 146 | yes | - | - | 0 | yes | 38572 | 3 |
| `#/identity` | 人员目录 | 1440 | 200 | 112 | yes | - | - | 0 | yes | 63445 | 4 |
| `#/identity` | 人员目录 | 375 | 200 | 112 | yes | - | - | 0 | yes | 35444 | 4 |
| `#/identity?tab=admins` | 人员目录 | 1440 | 200 | 112 | yes | - | - | 0 | yes | 63706 | 4 |
| `#/identity?tab=admins` | 人员目录 | 375 | 200 | 112 | yes | - | - | 0 | yes | 35258 | 4 |
| `#/identity?tab=binding` | 人员目录 | 1440 | 200 | 112 | yes | - | - | 0 | yes | 63779 | 4 |
| `#/identity?tab=binding` | 人员目录 | 375 | 200 | 112 | yes | - | - | 0 | yes | 35731 | 4 |
| `#/identity?tab=checks` | 人员目录 | 1440 | 200 | 112 | yes | - | - | 0 | yes | 64347 | 4 |
| `#/identity?tab=checks` | 人员目录 | 375 | 200 | 112 | yes | - | - | 0 | yes | 34951 | 4 |
| `#/identity?tab=departments` | 组织与部门 | 1440 | 200 | 128 | yes | - | - | 0 | yes | 62683 | 2 |
| `#/identity?tab=departments` | 组织与部门 | 375 | 200 | 128 | yes | - | - | 0 | yes | 34878 | 2 |
| `#/identity?tab=people&view=admins` | 人员目录 | 1440 | 200 | 112 | yes | - | - | 0 | yes | 63871 | 4 |
| `#/identity?tab=people&view=admins` | 人员目录 | 375 | 200 | 112 | yes | - | - | 0 | yes | 34971 | 4 |
| `#/identity?tab=roles` | 角色与权限 | 1440 | 200 | 186 | yes | - | - | 0 | yes | 72367 | 5 |
| `#/identity?tab=roles` | 角色与权限 | 375 | 200 | 186 | yes | - | - | 0 | yes | 44082 | 5 |
| `#/identity?tab=tenant` | 人员目录 | 1440 | 200 | 112 | yes | - | - | 0 | yes | 63777 | 4 |
| `#/identity?tab=tenant` | 人员目录 | 375 | 200 | 112 | yes | - | - | 0 | yes | 35235 | 4 |
| `#/knowledge` | 知识空间 | 1440 | 200 | 518 | yes | yes | - | 0 | yes | 134920 | 3 |
| `#/knowledge` | 知识空间 | 375 | 200 | 518 | yes | yes | - | 0 | yes | 62251 | 3 |
| `#/knowledge?tab=citations` | 证据与引用 | 1440 | 200 | 479 | yes | yes | - | 0 | yes | 126872 | 4 |
| `#/knowledge?tab=citations` | 证据与引用 | 375 | 200 | 479 | yes | yes | - | 0 | yes | 62001 | 4 |
| `#/knowledge?tab=evidence` | 审计证据 | 1440 | 200 | 183 | yes | yes | - | 0 | yes | 81812 | 2 |
| `#/knowledge?tab=evidence` | 审计证据 | 375 | 200 | 183 | yes | yes | - | 0 | yes | 49209 | 2 |
| `#/knowledge?tab=ingest` | 数据源 | 1440 | 200 | 560 | yes | yes | - | 0 | yes | 127443 | 5 |
| `#/knowledge?tab=ingest` | 数据源 | 375 | 200 | 560 | yes | yes | - | 0 | yes | 62046 | 5 |
| `#/knowledge?tab=retrieval` | 检索 | 1440 | 200 | 511 | yes | yes | - | 0 | yes | 128042 | 4 |
| `#/knowledge?tab=retrieval` | 检索 | 375 | 200 | 511 | yes | yes | - | 0 | yes | 62445 | 4 |
| `#/knowledge?tab=scope` | 知识空间 | 1440 | 200 | 518 | yes | yes | - | 0 | yes | 134920 | 3 |
| `#/knowledge?tab=scope` | 知识空间 | 375 | 200 | 518 | yes | yes | - | 0 | yes | 62251 | 3 |
| `#/knowledge?tab=sources` | 数据源 | 1440 | 200 | 560 | yes | yes | - | 0 | yes | 127443 | 5 |
| `#/knowledge?tab=sources` | 数据源 | 375 | 200 | 560 | yes | yes | - | 0 | yes | 62046 | 5 |
| `#/metrics` | 用量与成本 | 1440 | 200 | 818 | yes | - | - | 0 | yes | 100796 | 1 |
| `#/metrics` | 用量与成本 | 375 | 200 | 818 | yes | - | - | 0 | yes | 63318 | 1 |
| `#/org` | 人员目录 | 1440 | 200 | 112 | yes | - | - | 0 | yes | 64029 | 4 |
| `#/org` | 人员目录 | 375 | 200 | 112 | yes | - | - | 0 | yes | 35112 | 4 |
| `#/overview` | 值班台 | 1440 | 200 | 1063 | yes | yes | yes | 0 | no | 152256 | 11 |
| `#/overview` | 值班台 | 375 | 200 | 1063 | yes | yes | yes | 0 | no | 55706 | 11 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 122 | yes | - | - | 0 | yes | 66246 | 2 |
| `#/overview?tab=usage` | 用量与成本 | 375 | 200 | 122 | yes | - | - | 0 | yes | 37732 | 2 |
| `#/sessions` | 列表 | 1440 | 200 | 106 | yes | - | - | 0 | yes | 53842 | 6 |
| `#/sessions` | 列表 | 375 | 200 | 106 | yes | - | - | 0 | yes | 27045 | 6 |
| `#/system` | 系统健康 | 1440 | 200 | 934 | yes | yes | yes | 0 | yes | 122255 | 5 |
| `#/system` | 系统健康 | 375 | 200 | 934 | yes | yes | yes | 0 | yes | 61127 | 5 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 111 | yes | - | yes | 0 | yes | 64640 | 2 |
| `#/system?tab=defaults` | 默认设置 | 375 | 200 | 111 | yes | - | yes | 0 | yes | 35359 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 659 | yes | - | yes | 0 | yes | 161051 | 2 |
| `#/system?tab=events` | 审计事件 | 375 | 200 | 659 | yes | - | yes | 0 | yes | 87606 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 659 | yes | - | yes | 0 | yes | 160846 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 375 | 200 | 659 | yes | - | yes | 0 | yes | 87606 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 659 | yes | - | yes | 0 | yes | 160885 | 2 |
| `#/system?tab=retention` | 审计事件 | 375 | 200 | 659 | yes | - | yes | 0 | yes | 87606 | 2 |
| `#/system?tab=security` | 安全设置 | 1440 | 200 | 293 | yes | - | - | 0 | yes | 103514 | 5 |
| `#/system?tab=security` | 安全设置 | 375 | 200 | 293 | yes | - | - | 0 | yes | 55849 | 5 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 574 | yes | - | yes | 0 | yes | 128609 | 4 |
| `#/system?tab=version` | 版本 | 375 | 200 | 574 | yes | - | yes | 0 | yes | 62311 | 4 |
| `#/work` | 任务 | 1440 | 200 | 266 | yes | yes | - | 0 | yes | 99860 | 7 |
| `#/work` | 任务 | 375 | 200 | 266 | yes | yes | - | 0 | yes | 69682 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 1440 | 200 | 266 | yes | yes | - | 0 | yes | 100179 | 7 |
| `#/work?tab=board&view=cron` | 任务 | 375 | 200 | 266 | yes | yes | - | 0 | yes | 69733 | 7 |
| `#/work?tab=cron` | 任务 | 1440 | 200 | 266 | yes | yes | - | 0 | yes | 100078 | 7 |
| `#/work?tab=cron` | 任务 | 375 | 200 | 266 | yes | yes | - | 0 | yes | 69998 | 7 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 468 | yes | - | yes | 0 | yes | 103366 | 3 |
| `#/work?tab=runs` | 运行 | 375 | 200 | 468 | yes | - | yes | 0 | yes | 68205 | 3 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
