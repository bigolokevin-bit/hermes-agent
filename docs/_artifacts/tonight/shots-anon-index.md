# lane-D screenshot evidence index

- base: `http://127.0.0.1:9122`  |  nav form: `#/<route>` (hash, per brief)  |  viewports: 1440x900, 375x812
- routes enumerated from `web/src/shell/routes.ts` appendix A: **51**  |  routes driven this run: 19  |  expected shots: 38  |  produced: **19**
- driver: playwright loaded from `/Users/kevin_studio/Projects/seakoi-console-web/package.json` (sibling checkout, not installed here); chromium `/Users/kevin_studio/Library/Caches/ms-playwright/chromium-1255/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
- root shell baseline: ok=true, <main> text = 732 chars, hasMainEl=true — on this build the root path renders an EMPTY <main>, so the binding criterion is per-route `main>0`; `differsFromRoot` is kept as secondary info only

| route (hash) | label | vp | HTTP | main chars | main>0 | empty? | error? | overflow px | differsFromRoot | png bytes | console err |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `#/approvals` | 待处理 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136477 | 11 |
| `#/approvals?tab=history` | 历史决策 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135820 | 11 |
| `#/approvals?tab=mine` | 待处理 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135813 | 11 |
| `#/approvals?tab=pending&view=mine` | 待处理 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136025 | 11 |
| `#/approvals?tab=pending&view=release` | 待处理 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135455 | 11 |
| `#/approvals?tab=policy` | 待处理 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136276 | 11 |
| `#/approvals?tab=release` | 待处理 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135941 | 11 |
| `#/employees` | 列表 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136119 | 11 |
| `#/employees?tab=matrix` | 能力与权限 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136607 | 11 |
| `#/overview` | 值班台 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135240 | 11 |
| `#/overview?tab=usage` | 用量与成本 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136733 | 11 |
| `#/system` | 系统健康 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136052 | 11 |
| `#/system?tab=defaults` | 默认设置 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136068 | 11 |
| `#/system?tab=events` | 审计事件 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135931 | 11 |
| `#/system?tab=events&view=anomaly` | 审计事件 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136377 | 11 |
| `#/system?tab=retention` | 审计事件 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135780 | 11 |
| `#/system?tab=security` | 审计事件 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 135545 | 11 |
| `#/system?tab=version` | 版本 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136097 | 11 |
| `#/work?tab=runs` | 运行 | 1440 | 200 | 732 | yes | yes | yes | 0 | no | 136500 | 11 |

- routes with empty main (any viewport): none
- routes with no <main> element at all: none

## oversize pngs (> 2097152 bytes, excluded from the commit)
- none

## failures
- none
