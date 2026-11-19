# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 19  |  expected shots: 38  |  produced: **19**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 732 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/approvals` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70589 | 2 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 212 | yes | - | yes | 0 | yes | 84050 | 2 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70427 | 2 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70442 | 2 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70125 | 2 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 69893 | 2 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 166 | yes | - | yes | 0 | yes | 70195 | 2 |
| `#/employees` | 列表 | 1440 | 200 | 124 | yes | - | - | 0 | yes | 59498 | 3 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 226 | yes | - | - | 0 | yes | 80743 | 2 |
| `#/overview` | 值班台 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 126282 | 12 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 152 | yes | - | - | 0 | yes | 64956 | 2 |
| `#/system` | 系统健康 | 1440 | 200 | 405 | yes | yes | yes | 0 | yes | 100752 | 4 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 121 | yes | - | yes | 0 | yes | 60459 | 2 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 512 | yes | yes | yes | 0 | yes | 85945 | 2 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 512 | yes | yes | yes | 0 | yes | 86122 | 2 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 512 | yes | yes | yes | 0 | yes | 86276 | 2 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 512 | yes | yes | yes | 0 | yes | 86013 | 2 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 406 | yes | - | - | 0 | yes | 109410 | 2 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 265 | yes | - | yes | 0 | yes | 78922 | 2 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
