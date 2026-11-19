# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 19  |  expected shots: 38  |  produced: **19**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 732 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/approvals` | 待处理 | 1440 | 200 | 162 | yes | - | yes | 0 | yes | 76451 | 1 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 208 | yes | - | yes | 0 | yes | 90129 | 1 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 162 | yes | - | yes | 0 | yes | 76544 | 1 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 162 | yes | - | yes | 0 | yes | 76645 | 1 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 162 | yes | - | yes | 0 | yes | 76368 | 1 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 162 | yes | - | yes | 0 | yes | 76608 | 1 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 162 | yes | - | yes | 0 | yes | 76537 | 1 |
| `#/employees` | 列表 | 1440 | 200 | 123 | yes | - | - | 0 | yes | 67933 | 2 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 222 | yes | - | - | 0 | yes | 86992 | 1 |
| `#/overview` | 值班台 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 134101 | 11 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 110 | yes | - | - | 0 | yes | 66898 | 1 |
| `#/system` | 系统健康 | 1440 | 200 | 255 | yes | yes | yes | 0 | yes | 87514 | 3 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 121 | yes | - | yes | 0 | yes | 68582 | 1 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 100 | yes | yes | - | 0 | yes | 67777 | 0 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 100 | yes | yes | - | 0 | yes | 67777 | 0 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 100 | yes | yes | - | 0 | yes | 67777 | 0 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 100 | yes | yes | - | 0 | yes | 67776 | 0 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 285 | yes | - | - | 0 | yes | 97728 | 0 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 291 | yes | - | yes | 0 | yes | 94859 | 2 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
