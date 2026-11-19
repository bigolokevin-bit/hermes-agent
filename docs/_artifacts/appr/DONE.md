# approvals 车道交付 — T16 待处理 + T17 历史决策

Lane `lane/console-approvals`，base `7dd07981`。写域：`web/src/modules/approvals/**` + 本文件。
未碰 App.tsx / routes / registry / tokens / package.json / lockfile / 其它模块 / i18n。

## 1. 交付内容

| 页面 | 文件 | 说明 |
|---|---|---|
| T16 待处理 | `web/src/modules/approvals/ApprovalsPendingModulePage.tsx` | 队列 + 抽屉，批准/驳回走真实写路由 |
| T17 历史决策 | `web/src/modules/approvals/ApprovalsHistoryModulePage.tsx` | 八态筛选，值真进请求；只读投影 |
| 共用层 | `api.ts` `model.ts` `copy.ts` `states.tsx` `views.tsx` `useApprovalsData.ts` | 端点与请求构造、容读取数、人话文案、四态面板、行/详情视图 |
| 测试 | `api.test.ts` `ApprovalsPendingModulePage.test.tsx` `ApprovalsHistoryModulePage.test.tsx` | 44 例 |

## 2. 实际调用的端点（无 mock 端点，无假数据）

浏览器侧一律同源 `/agent-api`（Caddy → BFF :8092）：

| 用途 | 请求 | 出处 |
|---|---|---|
| 队列 / 历史列表 | `GET /agent-api/api/approvals?status=pending&limit=50`；历史为 `status=<八态之一>`，`全部` 时不带 `status`；翻页 `&cursor=<opaque>` | `web/src/pages/ApprovalsPage.tsx:30`、`web/src/modules/duty/api.ts:89`、`docs/_artifacts/D/T02-ENDPOINT-RECONCILIATION.md:13` |
| 单据详情 | `GET /agent-api/api/approval?id=<id>` | `web/src/shell/routes.ts:143`（`dataSource: '/api/approvals /api/approval?id='`）、`T02-ENDPOINT-RECONCILIATION.md:13` |
| 决策写入 | `POST /agent-api/api/approval/decision?id=<id>`，头 `Content-Type: application/json` + `X-Console-Write: 1`，体仅 `{verdict}`，备注非空时加 `comment` | **本仓未记录该路由**，见 §5 缺口 |

八态取值（不是下拉装饰，逐个进 `status=`）：
`pending` `approved` `rejected` `revise_requested` `expired` `cancelled` `consumed` `superseded`。
来源：控制台 domain 审批服务的状态枚举（`services/domain` approvals，行锚 `approvals.py:36-45`），与
`web/src/shell/routes.ts:145` 的「`/api/approvals?status=`（8 态）」口径一致。裁决词表 `approve|reject|revise`，本页只用 approve/reject。
别名（`denied/withdrawn/executed/…`）只折叠到同一批人话标签；未识别值按原样上送、标签显示「状态未识别」，原始值只进「详情」。

## 3. 跑过的命令与原始输出

```
$ cd web && ./node_modules/.bin/vitest run src/modules/approvals   # exit 0
 Test Files  3 passed (3)
      Tests  44 passed (44)
   Start at  00:07:56
   Duration  1.23s (transform 771ms, setup 0ms, import 1.31s, tests 415ms, environment 696ms)

$ cd web && ./node_modules/.bin/tsc --noEmit -p tsconfig.app.json  # exit 0，无输出（0 error）

$ cd web && pnpm run build                                        # exit 0
✓ built in 2.38s
built /Users/kevin_studio/Projects/forks/console-approvals/hermes_cli/web_dist/index.html

$ pnpm --filter web build                                         # exit 1（环境，非代码）
Error: ERR_PNPM_UNSAFE_TASK_RUN_STATE_PATH
  × Refusing to use task run state directory at /Users/kevin_studio/Projects/
  │ forks/console-approvals/node_modules because it is a symbolic link or not
  │ a directory

$ cd web && pnpm exec eslint src/modules/approvals                 # exit 0
✖ 2 problems (0 errors, 2 warnings)     # 两条 react-hooks/set-state-in-effect，与 duty(3)/chat(1)/tasks(1)/usePaneData(1) 同类
```

`pnpm --filter web build` 在**每个** lane 工作树都这样失败：本树禁 install，`node_modules` 只能软链到主检出
（`web/`、`apps/shared/`、根三处），而 pnpm 的 task-run-state 守卫拒绝软链根；同兄弟树
`console-employees` 复现同一错误（exit 1，同一段报错）。因此用同一条脚本的等价跑法取证：`cd web && pnpm run build`
（即 `node ../scripts/build/web.mjs`），exit 0，产物含 `ApprovalsPendingModulePage-*.js` / `views-*.js`，
说明两个页面在真实构建图里编译通过。

关于 brief 提到的外部阻塞：本 base 上 `src/modules/tasks/TasksBoardModulePage.tsx` **没有** variant/danger/loading
类型错误——`tsc --noEmit -p tsconfig.app.json` 全仓 0 error。构建也没有被它挡住。此条与本域结果无关，如实记录。

## 4. 四态各自怎么触发

真态（由服务回答驱动，测试里以 `fetchJSON`  seams 断言 URL/体/头，不打桩端点）：

| 态 | 真触发 | 屏上 | 用例 |
|---|---|---|---|
| loading | 首屏请求未回 | 骨架（`aria-hidden`）+「正在读取待处理审批…」，不抢先说空 | `loading is a skeleton, not an empty queue` |
| empty | 列表回 `{items:[]}` | 「现在没有需要你处理的申请」+ 下一步 + 刷新 | `empty names the reason and the next step` / 历史 `「已被新单替代」状态下没有记录` |
| error | 5xx / 0 / 非列表回答 | 人话句 + `请求编号：<rid>`（缺则「未提供」）+ 重试；行数据先清空 | `error says it in a sentence…` / `an unreadable answer is a failure…` |
| denied | 403 或 404 | 与 404 **完全同体**（innerHTML 相等断言），面板之上零行、无 `dl` | `403 and 404 draw the same body…` |

历史页同样四态：`history whole-panel states` 组。

QA 复现腿（无后端时逐态截图）：仓库自带 `?state=` 开关（`web/src/shell/fixtures.ts`，T03 契约）——
`/approvals?state=loading|empty|error|denied`、`/approvals?tab=history&state=…`。
该腿**不发真请求**，面板带 `data-fixture="<state>"`，并显示「这是用 ?state= 复现出来的状态，不是服务此刻的回答」。
用例：`the ?state= repro switch`（两页各一组），并断言关掉开关后真实回答接管。

## 5. fixture 用了哪些，缺什么

- 生产路径**零 fixture 数据**：三个端点都用真 URL 请求；`fetchJSON` 只在测试里被替换成回答，请求形状仍被断言。
- 缺口 1（写路由）：`/api/approval/decision` 未出现在本仓路由对账表（`docs/_artifacts/D/T02-ENDPOINT-RECONCILIATION.md` 只列
  `/api/approvals`、`/api/approval`、`/api/approval-stats`）。路径、`X-Console-Write: 1`、体白名单
  `{verdict∈approve|reject|revise, comment?}` 取自控制台 BFF 的 AP2 写路由记录（ADR-0010 / CR-028，2026-11-13 曾真写联调通过）。
  若本 fork 的 BFF 未开 `CONSOLE_APPROVAL_WRITE_ENABLED`，写入返回 405：页面按降级人话显示「这套环境还没有开放审批写入…
  请让管理员开通后再试」并附请求编号，不做任何假成功。
- 缺口 2（字段未真采）：`remainingSeconds` / `changeKind` / `approvers[].userId` / `supersededBy` / `decisions[].verdict`
  均按可选读取——缺则「—」并写明「服务未提供该时间/该数值」，绝不 `?? 0`。这些键在本仓内没有任何真实样本可核。
- 缺口 3（`assignee`）：控制台 AP4 上游要求 `assignee`（缺则 400 `assignee is required`）。本仓既有调用
  （`ApprovalsPage.tsx:30`、`duty/api.ts:89`）都不带该参数，本页沿用仓内口径并保留 400 的人话降级；
  真实环境若强制 `assignee`，需要接线车道补一个当前用户身份来源——浏览器侧拿不到 canonical `human:<id>`（BFF 注入，客户端不许自报）。

## 6. 纪律落点

- 零工程语言上屏：裸 `ap_…` / `employee:8812` / `human:1` / `run_id` / 原始枚举 / HTTP 码都不进文本，
  只进 `title` 与折叠「详情」（默认收起，收起时 DOM 里就没有这些串；测试断言 `run_77aaee33` 在开合两态都不出现）。
- 时间：`Asia/Shanghai`、h23、到分（`2026-11-19 09:20`）；金额 USD（`$25.00`，真 0 显示 `$0.00`，缺失显示「—」）。
- 写：确认后才发请求；`busy` 期间批准/驳回/备注与对话框按钮全禁用；成功→重读列表 + 重读详情；失败→同一人话错误面 + 请求编号，
  列表不动、状态不伪装；409/404/405 之后重读详情取真值。
- 版式：`lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]`，窄屏抽屉落在队列下方；文本一律 `min-w-0 break-words`，无固定宽溢出。
  375/1440 的像素级横向溢出**未实测**（页面尚未接路由，无浏览器可看，见 §7）。

## 7. 没做完 / 不能验的

- 路由挂载：`App.tsx` / `shell/routes.ts` / `shell/registry.ts` 在写域外，两页目前不会被 shell 选中
  （`shell/bridge.ts:170` 的 glob 只为 `employee-detail` / `runs` 指名了两个候选路径）。接线车道按命名
  `modules/approvals/Approvals*ModulePage.tsx` 取用即可；本仓 `manifest.ts` 也未创建（registry 会 eager-glob
  `modules/*/manifest.ts`，新增会改动 lane A 的 tab 计数断言，越域）。
- 真实 BFF 数据：本机 :8092 在跑，但未登录时一律 401（`X-Console-Reason: identity-check-failed`），
  带上的历史 token 已失效，因此「八态筛选真的换了行」「批准后行消失并进入历史」只在测试里以真请求形状验证，未经真账号验证：

```
$ curl -s -D- -o /dev/null "http://127.0.0.1:8092/api/approvals?status=pending&limit=5"
HTTP/1.1 401 Unauthorized
X-Console-Request-Id: 2d355a794b424a089a9ab75e1e5aee4b
X-Console-Reason: identity-check-failed
{"code": "console.unauthenticated", "message": "identity check failed"}
```

  未验：写开关关闭环境的 405 实际文案落点、409 并发抢单、跨租户 404 折叠、审批人不在名单的 403、375/1440 像素级排印。
- 浏览器截图 / 视觉核对：未做（页面未接路由，见上）。

## 8. 提交

- T16 `feat(console): approvals pending list with real actions`
- T17 `feat(console): approvals history with eight-state filter`（含本文件）

---
# 补充 — T33 审计事件模块（audit events）

Lane `lane/console-approvals`，base `d23f5538`（T16/T17 之后）。写域：`web/src/modules/audit/**`（含 manifest）+ 本文件。
未碰 `App.tsx` / `shell/*` / `routes` / `registry` / `tokens` / `package.json` / lockfile / i18n / 其它模块（`git status` 只有这两处）。

## T33-1. 交付内容

| 页面 | 文件 | 说明 |
|---|---|---|
| 列表 + 详情抽屉 | `web/src/modules/audit/AuditEventsModulePage.tsx` | 最近一页审计事件；点行按 `?id=` 读单条详情；游标翻页 |
| 时间窗完整性校验 | `web/src/modules/audit/AuditVerifyModulePage.tsx` | 不自动跑；选好窗口才发请求；跑不动写「本环境未启用」 |
| 数据/文案/状态层 | `api.ts` `model.ts` `copy.ts` `states.tsx` `views.tsx` `useAuditData.ts` `fixture.ts` `window.ts` | 端点与 URL 构造、容读取数、人话文案、四态面板、行/详情/校验视图、`?state=` 标记、时间窗换算 |
| 清单 | `manifest.ts` | 平铺导航形状（id/path/label「审计事件」/icon）+ registry 形状默认导出 |
| 测试 | `api.test.ts` `manifest.test.ts` `AuditEventsModulePage.test.tsx` `AuditVerifyModulePage.test.tsx` | 70 例（29 纯层 / 22 列表详情 / 14 校验 / 5 清单） |

## T33-2. 实际调用的端点（无 mock 端点，无假数据）

浏览器侧一律同源 `/agent-api`（→ BFF :8092），`/api/` 段保留：

| 用途 | 请求 | 出处 |
|---|---|---|
| 事件列表 | `GET /agent-api/api/audit?limit=50`，翻页再带 `&cursor=<opaque>` | 任务书 T33 数据段；`web/src/shell/routes.ts:179`（`dataSource: '/api/audit /api/audit-detail /api/audit-verify'`） |
| 单条详情 | `GET /agent-api/api/audit/detail?id=<eventId>` | 任务书 T33 数据段 |
| 时间窗校验 | `GET /agent-api/api/audit/verify?from=<ISO>&to=<ISO>` | 任务书 T33 数据段 |

游标翻页只在回答带 `nextCursor/next_cursor/next/cursor/nextPage` 时才出现「加载更多」；没给就不显示按钮，也不猜下一页。

动作中文表只收本仓自己点过名的词：`modules/approvals/model.ts` 的变更类型与裁决词表、`shell/routes.ts` 各 pane 的实体
（运行/任务/员工/技能/知识/预算/策略/权限/消息/委托/会话/工具/成员）。约 60 条映射。**未认识的 `action` 值原样上屏**
（`actionView().known === false`），同时把原值记进「技术详情」——不机翻成我们没得到的说法。

## T33-3. 跑过的命令与原始输出

```
$ cd web && ./node_modules/.bin/vitest run src/modules/audit          # exit 0
 Test Files  4 passed (4)
      Tests  70 passed (70)
   Duration  1.22s (transform 807ms, setup 0ms, import 1.36s, tests 275ms, environment 876ms)

$ cd web && ./node_modules/.bin/vitest run                            # 全仓回归，exit 0
 Test Files  89 passed (89)
      Tests  672 passed (672)

$ cd web && ./node_modules/.bin/tsc --noEmit -p tsconfig.app.json      # exit 0，无输出（全仓 0 error）

$ cd web && pnpm run build                                            # exit 0
✓ 3455 modules transformed.
../hermes_cli/.web_dist-build-NGcgxJ/product/assets/AuditVerifyModulePage-MJVH2bGk.js   7.19 kB │ gzip: 3.26 kB
../hermes_cli/.web_dist-build-NGcgxJ/product/assets/AuditEventsModulePage-4owBbB5M.js   8.18 kB │ gzip: 3.54 kB
../hermes_cli/.web_dist-build-NGcgxJ/product/assets/useAuditData-Dg4F0gLB.js           36.19 kB │ gzip: 12.65 kB
✓ built in 2.19s
built /Users/kevin_studio/Projects/forks/console-approvals/hermes_cli/web_dist/index.html

$ cd web && pnpm exec eslint src/modules/audit                        # exit 0
✖ 3 problems (0 errors, 3 warnings)   # 三条 react-hooks/set-state-in-effect，与 approvals/duty/chat 同类

$ pnpm --filter web build                                             # 环境限制，非代码
Error: ERR_PNPM_UNSAFE_TASK_RUN_STATE_PATH
  × Refusing to use task run state directory at /Users/kevin_studio/Projects/forks/console-approvals/node_modules
    because it is a symbolic link or not a directory
```

最后一条与本车道 T16/T17 记录的同一段报错一致：本树禁 install，`node_modules` 是软链，pnpm 的 task-run-state
守卫拒绝软链根；取证用等价的 `cd web && pnpm run build`（同一条 `scripts/build/web.mjs`），exit 0。
三个 audit chunk 都出现了，说明两页与数据层在真实构建图里编译通过（chunk 名里的 hash 每次构建都会变）。

## T33-4. 四态各自怎么触发

真态（由服务回答驱动；测试把 `fetchJSON` 换成回答，请求形状仍被断言）：

| 态 | 真触发 | 屏上 | 用例 |
|---|---|---|---|
| loading | 首屏请求未回（列表页挂载即发；校验页点了窗口之后） | 骨架（`aria-hidden`）+「正在读取审计事件…」，不抢先说空 | `loading is a skeleton, not an empty ledger` |
| empty | 列表回 `{items:[]}` | 「服务回了这个环境里最近的审计事件为空」+ 下一步 + 刷新 | `empty names the reason and the next step` |
| error | 5xx / 连不上 / 非列表回答 | 人话句 + `请求编号：<rid>`（缺则「未提供」）+ 重试；行先清空 | `error keeps the sentence and the trace id, and retry asks again`、`an error with no id says 未提供…` |
| denied | 403 或 404 | 与 404 **完全同体**（innerHTML 逐字节相等断言），面板之上零行 | `403 and 404 draw one identical body with no rows above it`；详情抽屉同一断言：`403 and 404 read the same body on the detail too` |

校验页的四态另有归宿：`idle`（还没运行，写明「没有跑过的校验，这里不会写『已通过』」）/ `loading` /
`ready`（真结论 + 条数）/ `unavailable`（403、404、405、501、连不上、5xx → 「本环境未启用」+ 原因 + 请求编号，
403 与 404 逐字节同体）/ `error`（401、400、429 与形状不对的回答，带重试）。
用例：`a check that cannot run` 整组、`the check only runs when it is asked for` 整组。

QA 复现腿（无后端时逐态截图）：沿用仓库自带的 `?state=` 开关（`web/src/shell/fixtures.ts`，T03 契约）。
- 列表/详情：`/system?tab=events&state=loading|empty|error|denied`
- 校验：`/system?tab=events&view=verify&state=loading|empty|error|denied`（`empty`→还没运行，`denied`→本环境未启用）

这些腿**不发真请求**（用例断言 `api.fetchJSON` 未被调用），面板带 `data-fixture="<state>"`，并显示
「这是用 ?state= 复现出来的状态，不是服务此刻的回答」。关掉开关后真实回答接管：
`a real answer takes over once the repro is off`。

## T33-5. 口径落点

- 时间：`Asia/Shanghai`、h23、到分（`2026-11-19 09:20`）；行上标签写明「发生时间（北京时间）」，页眉再写「时间为北京时间」，
  详情再补一句「以上时间均为北京时间，精确到分」。ISO 串只出现在请求里，屏上没有任何 `T..:..:..` 形态。
- 操作者：`姓名 · 8位短码`；只有句柄时 `员工 · 短码` / `成员 · 短码`（名词按 `actor.type` 取，缺类型就从句柄前缀
  `employee:` / `user:` / `system` 推断）；短码取句柄最后一段的字母数字尾 8 位，不足 4 位就只显示名词。
  `emp_…` / `human:1` / UUID 只做 `title`，测试断言屏上文本不含它们。
- 结果：只有 `成功` / `失败（被拒）` / `待完成` 三种说法，外加诚实的第四种 `结果未识别`（原值进「技术详情」）；
  失败原因取 `error.messageRedacted`→`message/reason/…`，只接受人话句（`humanSentence` 挡掉栈、URL、JSON、`^\d{3}\s`）。
- 详情主屏零字段名：七个中文段（事件 / 操作者 / 资源 / 结果与原因 / 变更 / 关联 / 完整性），
  技术内容全进默认收起的「技术详情」（收起时 DOM 里没有这些串：用例 `technical values stay behind 技术详情`
  先断言 `1a2b3c4d5e6f7081…` 不在文本里，点开后才出现）。
  `来源系统`、`tenantId`、失败 `code`、`hash/prevHash` 全量值、动作原值都只在这一处与 `title` 里。
- 缺失诚实：时间/条数/结论缺失显示「—」并在 `title` 写原因，绝不 `?? 0`；真 0 显示 `0`
  （用例 `a real zero stays zero, and a counted zero is intact`、`a count the service did not send stays 「—」…`）。
- 校验诚实：结论要服务自己说（`ok/valid/…`）或 `broken===0` 这种数出来的零，才写「没有发现断点」；
  有结论但一个条数都没给 → `校验跑完了，但结论没说清楚` + 「上面三格都只能写『—』」，不借用「已通过」的说法。
  分母如实：`已核对 120 / 200`，分母没给就只显示 `120` 并在 `title` 说明「服务未说明这个窗口里一共有多少条」。
- 版式：`lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]`，文本一律 `min-w-0 break-words`，长句 `max-w-prose`，
  没有不带滚动容器的宽表；窄屏抽屉落在列表下方。

## T33-6. 清单（manifest）

`manifest.ts` 同时给两个形状：平铺导航形状 `{id:"audit", path:"/system", label:"审计事件", icon:"Shield"}`
（`Shield` 是 `App.tsx:467-491` 的 `ICON_MAP` 里已有的键，没有新增），和 registry 校验的默认导出
（`module:"audit"`、tab `route:"#/system?tab=events"`——`shell/routes.ts:179` 的那一行，`#/audit` 是它的 compat 别名）。
`kind` 保持 `planned`：本车道不接路由，挂载归接线车道。用例把这几条都钉住，包括
「registry 对 audit 没有任何 issue」（`validateRegistry()` 过滤 `audit` 后为空数组）。

## T33-7. 没做完 / 不能验的

- 真实数据一律未验。本机 :8092 在跑，未登录时**先于路由**回答 401，所以既拿不到真负载，也无法从外部分辨路由拼法：

```
$ curl -s -D- -o /dev/null "http://127.0.0.1:8092/api/audit?limit=5"
HTTP/1.1 401 Unauthorized
X-Console-Request-Id: 30a669900c2b4b1a9c0bb4c198e19c1f
X-Console-Reason: identity-check-failed
{"code": "console.unauthenticated", "message": "identity check failed"}

$ curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8092/api/audit/detail?id=evt_probe"   # 401
$ curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8092/api/audit/verify?from=…&to=…"    # 401
$ curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8092/api/audit-nope-xyz"               # 401（拼错也是 401）
```

  最后一行是关键：门在路由之前，**任何**路径都 401，所以「`/api/audit/detail` 与 `/api/audit/verify` 这两个拼法是否真的存在」
  在本环境无法证实。本仓的对账表 `docs/_artifacts/D/T02-ENDPOINT-RECONCILIATION.md:16` 写的是
  `/api/audit*` 与 `/api/audit-verify`（`require_any` 七选一）；`/api/audit-verify` 我这条也探过，同样 401。
  代码按任务书给的拼法实现（`detail/` 与 `verify/` 两段），若真 BFF 用的是 `audit-detail` / `audit-verify`，
  结果就是 404 → 列表页显示「暂时无法查看审计事件」、校验页显示「本环境未启用」+ 原因 + 请求编号，不会伪造任何行或绿色结论。
  需要登录态复验：三种拼法各一次，确认 2xx 负载字段名，然后回填 `model.ts` 的键候选表。
- `/api/audit` 的 `require_any` 七选一没有记录是哪七个参数：列表页只带 `limit`（和游标）。若服务端因此回 400，
  页面显示「这次读取缺一个服务端要求的筛选条件…」并给人话下一步。缺的具体参数名未验，补哪个（`employeeId=` / `from=` / `to=` / …）
  等有真身份再定。
- 动作中文表是按本仓词表推的（见 §T33-2），真负载里到底出现哪些 `action` 值未验；未识别值按原样上屏，行为不依赖这张表。
- 路由挂载：`App.tsx` / `shell/routes.ts` / `shell/registry.ts` 在写域外，两页目前不会被 shell 选中；
  文件名按 `shell/bridge.ts:170` 的 `*ModulePage.tsx` 命名规则摆放，接线车道取用即可。
- 375 / 1440 的像素级横向溢出**未实测**（页面未接路由，无浏览器可看）；版式用的是与 T16/T17 同一套
  `flex + min-w-0 + break-words + minmax(0, …)` 约束。
- 浏览器截图 / 视觉核对：未做（同上）。
- 校验窗口只给了 24 小时 / 7 天 / 30 天三档预设，没有自定义起止；预设值 → ISO 的换算有单测，真服务是否接受这个区间长度未验。

## T33-8. 提交

- `feat(console): audit events list and detail on upstream shell`
- `feat(console): audit window chain verify on upstream shell`

---

# apr5 — 审批历史 8 态筛选（lane/console-appr，base c4c6e750）

## 8 态权威名单（PRD v4.1 §4 / WBS T17 / model.ts STATUS_FILTERS line196-205）

| 值 | 中文 |
|---|---|
| pending | 待处理 |
| approved | 已通过 |
| rejected | 已拒绝 |
| revise_requested | 要求修改 |
| expired | 已过期 |
| cancelled | 已撤回 |
| consumed | 已执行 |
| superseded | 已被新单替代 |

未知值 → 「状态未识别」+原值保留在详情，不猜测、不假 0。筛选=「全部」不发 status；每态真传 `/agent-api/api/approvals?status=<值>&limit=50`（BFF 参数，非前端假过滤）。

## 本单改动

1. `apr4-*` → `apr5-*` testid 全家族改名（denied/row-/retry/request-id/error/copy-request-id/loading/comment/request-id-missing/page-pending/page-history/list/forced-note/filter-/empty-history 等）。
2. ApprovalsHistoryModulePage：筛选下拉（`apr5-filter-status`）URL 驱动——`?tab=history&status=<值>` 可分享、刷新/回退保态；条数行「已显示 N 条「<状态>」记录」。
3. 请求编号沿用 RequestIdCopy（`apr5-copy-request-id`），文案「复制」→「已复制」/「复制失败，请手动选择」。
4. 新用例⑥「八状态筛选逐个真传参，可分享可刷新」：循环 8 值断言 mock fetch URL 含 `status=<值>` + 深链 selected 保态；⑦「未知状态行不猜测」断言「状态未识别」。

## 定向 vitest（原始 stdout，exit 0）

```
Test Files  3 passed (3)
      Tests  48 passed (48)
   Start at  15:24:00
   Duration  1.21s
```

（改名、筛选区、用例⑥⑦全部落地后复跑，原始 stdout 如上，exit 0。）

## 屏幕读数（9123 静态预览 = vite build --outDir dist-appr + python3 -m http.server；只读验证，不碰 9122 served 代次）

- 同源 SPA pushState `/approvals?tab=history&status=consumed`：location.search 保持 `?tab=history&status=consumed` ✓（URL 保态/可分享坐实）。
- 切 `status=superseded`：location.search 保持 ✓。
- 375×812 同源 iframe `/approvals`：scrollWidth=375 ✓（1440 主布局无横溢改动）。
- **如实注明**：optCount/rows 预览读数为 0——9123 静态预览无 BFF，列表数据腿不可用（错误态而非假 0）；每态参数与条数证据以上面 vitest ⑥⑦（mock 网络断言 URL 含 status=<值>）为准。截图同受此限制未附。

## 残留核查

`grep -rn "apr4" web/src/modules/approvals/` → 1 处命中 = states.tsx line35 **注释**「（GAP-04：审批引擎尚未提供该接口）」，非上屏文本、非 testid，保留。

## 提交

- 单 commit `feat(console): approvals eight-state filters (apr5)`，写域仅 `web/src/modules/approvals/**` + `docs/_artifacts/appr/**`；App.tsx/shell/其他 modules/package/lock/web/scripts 未动；未跑 install；未 amend/force/--no-verify。

## R17 collab/org 接线 + apd5 详情字段冻结（lane/console-appr，2026-11-19）

### collab/org（fix(console): mount collab route and org alias）
接线前（QA R16 判词为据）：/collab、/collaboration、/work?tab=delegations、/employees?tab=delegations 全部落 /overview，col4Count=0（chunk CollabDelegationsModulePage-C9MmsxBf.js 为孤儿）；/org 落 /overview。
接线后（App.tsx 锚点）：lazy CollabConsolePage（named CollabDelegationsModulePage，modules/collab line192/314 现场核实）；console Routes 块 /metrics 之后新增 Route /collab 与 /collaboration 直挂 <CollabConsolePage />（first-in-tree wins，不落上游也不落 /overview）；Route /org → Navigate /identity?tab=departments replace。数据口工单已核实 200（GET /agent-api/api/delegations=200 items:[]）。屏幕 col4Count 复跑留给 L0 合并代次（本车道不建 9122，纪律）。

### apd5（feat(console): approval detail per PRD 4.2 field freeze (apd5)，commit 39cf3fa6）
8 字段到位：1) approvalId 深链保态（History/Pending selected=useState(()=>params.get("id"))，openRow 把 id 写进 search 并保留 status，切换筛选清 id——刷新/分享保选中）；2) decidedAt apd5-field-decided-at 北京到分，缺「—」+title 原因；3) approver apd5-approver 姓名·8位大写短码（personView/maskHandle slice(0,8).toUpperCase）或「未指派」，裸 emp_/human: 零上屏；4) verdict apd5-field-verdict 通过/驳回/要求修改（VERDICT_LABEL approve 族改「通过」）；5) changeKind 4 类人话+未命中「未写明类型」；6) actionHash apd5-field-action-hash 短码显示+完整值 title+apd5-copy-action-hash 复制钮（已复制/复制失败反馈）；7) recipient apd5-field-recipient；8) dataScope apd5-field-scope 只读快照注记 + requestId apd5-field-request-id 可复制（缺=apd5-request-id-missing 诚实文案）。缺失一律「—」+原因，禁假 0；只读页零写入口（history 详情无 actions，仅说明文字）；403≡404 同体=既有 DeniedPanel（同 code+rid 不回显路径，既有用例「403 and 404 read the same」锁定）。

### 原始 stdout
定向：Test Files 3 passed (3) / Tests 48 passed (48)
      Tests  1156 passed (1156)
   Start at  15:42:25
   Duration  7.08s (transform 42.15s, setup 0ms, import 53.04s, tests 18.97s, environment 27.64s)

EXIT=0
assert-ia：node scripts/assert-ia.mjs A=0；--source=react B=0（51/22/1/8 未破，App.tsx 仅加 React Route 数据层未动）。
截图/屏幕读数受限声明：本车道禁建 9122、静态预览无 BFF，DOM 级 col4Count/apd5 计数由 L0 合并代次复跑；375 无横溢由 Field flex min-w-0 结构与既有 apr5 全页 375=375 读数支撑。

## auth5 登录页与会话组件（feat(console): login page and session widget，2026-11-19）
交付：/login 页（账号/密码/验证码+点图刷新；成功 sessionStorage 轻标记+navigate /overview；失败按 code 人话+可复制请求编号+重试；aria-busy+busyRef 防连点）；App.tsx Auth5Session 侧栏组件（GET /auth/whoami：ok→display(空=未命名账号)/角色(缺失—)/租户(内部 id 形态不裸上屏显—)+退出登录 POST /auth/logout→/login；401/异常→未登录+去登录→/login；loading 骨架）；pages 三页 401 整页态主出口「刷新重新登录」→「去登录」href=/login（EmployeesPage/RunsPage/ApprovalsPage，各 1 处，重试钮保留）。
testid：auth5-page/form/loading/user/password/captcha-input/captcha-image/error/copy-request-id/copy-state/request-id-missing/submit/retry + widget/display/role/tenant/logout/goto-login。
whoami 登录前/后读数声明：lane D 的 /auth 桥本车道未联调（桥未上线或不可依赖），登录前=未登录+去登录、登录后=display+退出登录 两条出口由 LoginPage.test 5 用例（mock fetch，含 POST 契约 body 断言与 captcha_invalid 自动刷新）与 Auth5Session 代码锚点交付；真桥联调待 D 回执后 QA 复跑。
残留如实报：modules/matrix/MatrixModulePage.tsx 的「刷新重新登录」出口 1 处属禁碰写域，转报 L0/aud。
测试原始读数：LoginPage.test 5 passed；定向 pages+shell 14 files 105 passed；全量 vitest 1161 passed EXIT=0；assert-ia 两模式 exit 0/0（51/22/1/8）。

## A.3 壳层收口（feat(console): console-only sidebar and parked-zone entry list，2026-11-19）
基线：reset --hard origin/lane/hermes-console=5bdb0553（e3efe15a gates 后裔）；前单 task-create honest gate 作废，wip 留档=origin refs/heads/wip/task-create-gate。
三处渲染断（App.tsx，非 CSS 隐藏）：NAV_GROUP_ORDER.map 循环体删除；NAV_GROUP_FALLBACK 消费点随循环体移除；SidebarSystemActions 元素摘除（Auth5Session 登录态挂件保留）。三定义 export 化防 lint 死码红，路由与插件 tab 机制零删。
证据 grep：NAV_GROUP_ORDER 渲染消费=0（仅定义 export+注释）、SidebarSystemActions 渲染=0（仅定义）、console 侧栏唯一入口=ConsoleNav。
暂存区：web/src/shell/ParkedPage.tsx——8 项 files/logs/cron/plugins/pairing/webhooks/env/docs，每项 名称+原路径+保留理由（照抄 A.3）+负责车道+最近复核 2026-11-19；整卡 Link to=原路径（SPA 内跳不硬刷）；横幅 parked-banner；testid parked-page + parked-item-* ×8。挂载=/system 元素级 ParkedAwareSystem（useSearchParams tab=parked 分支），routes.ts/registry/侧栏零写入，不算 IA 视图。车道列 A.3 无原文，假定统一「L0 集成（上游 Hermes 页）」待 PRD 勘误。
验证原始读数：vitest src/shell 4 files 33 passed（含 ParkedPage.test 4 用例：8 testid+hrefs 全对+tab=parked 渲染+普通 /system 不受影响）；全量 120 files 1177 passed；assert-ia HTML exit0 + --source=react exit0（51/22/1/8 不变量保持）；tsc --noEmit web 单包 exit0。
deadLinks：本车道未起 9123 preview（时间盒），待 L0 合并构建后 crawl-routes 复跑；8 个 Link 目标均为现存上游静态路由（未删除），预期 0 死链。

## R18-2 失败 rid 上屏 + 身份件刷新（fix(console): surface request id on login failure and refresh identity widget，2026-11-19）
根因：桥失败体字段是 rid（{code,rid,message}），前端只读 request_id → rid=null → RequestIdCopy 走 fallback 无钮=QA 判「未上屏无复制钮」。修法：LoginPage 加 ridOf(body)=rid??request_id??null，loadCaptcha/失败面/whoami 未建立三链全换；无 rid 时保留原兜底句。
身份件：登录成功（whoami 200）后 LoginPage window.dispatchEvent(Event(auth5:session))；App.tsx Auth5Session useEffect 重构 refresh 函数并 addEventListener(auth5:session)，cleanup 移除——登录后侧栏即时显示 display/角色/租户(缺—)+退出钮。禁 token 入 localStorage（仍仅 sessionStorage 轻标记）。
测试：LoginPage.test 8/8（用例4 桥形态 body {code,rid:4958432cabcd} 断言 rid 串上屏+req-copy 钮存在；用例2 成功链断 auth5:session listener 调用≥1）；全量 vitest 120 files/1180 passed 0 fail；src/shell 33 passed。
本单按 L0 令未单独构建（合批后统一 build+D 重章+R19）。

## R19 尾项 a：退出登录清身份件（fix(console): clear identity widget on logout）
根因：logout finally 仅 removeItem+navigate，Auth5Session 同页不卸载则本地 who 态残留 opsadmin/角色/租户（服务端会话已废 401 双证，纯客户端显示残留）。
修法：Auth5Session 整函数从 App.tsx 抽至 web/src/shell/Auth5Session.tsx（export），logout finally navigate 前 setWho({k:anon})；App.tsx 改 import；新增 web/src/shell/Auth5Session.test.tsx 锁 logout→widget 匿名（whoami200 opsadmin 上屏→点退出→无 opsadmin/角色、显示未登录+去登录钮、sessionStorage 清）。
读数：定向 Auth5Session.test 1 passed；src/shell 全过；全量 vitest Test Files 121 passed / Tests 1188 passed 0 fail；tsc web 单包 exit 0。基线 b65673c8（章 c9266b55，entry C4DIeOJD）。按 L0 节拍本单未单独构建——需 L0 合批 build+D 重章后上屏复验。
## CSRF 双提交头接线（feat(console): send double-submit CSRF header on write requests）
helper=web/src/lib/csrf.ts：readCsrfToken 每请求从 document.cookie 读 console_csrf（无 document/无 cookie→null，token 零进 localStorage）；csrfWriteHeaders→X-Console-CSRF；csrfFailureCopy 仅 403：console.csrf_origin→「当前访问来源不被允许写入，请联系管理员开通后再试。」、console.csrf_token_mismatch→「登录状态已过期，写入被拦下了。请重新登录后再试。」rid=body.rid??request_id??响应头，两 code 之外返 null 走原文案，屏上零裸 code。
写点1 tasks/TaskCreateForm：submit 前置 gate，无 cookie 不发 POST，tsk4-create-error 人话「需要登录后才能提交。当前没有可用的写入会话，请先登录。」；有 cookie 时 headers 带 X-Console-CSRF（既有 content-type+Idempotency-Key 保留）。写点2 approvals/api.ts postDecision：无 cookie 抛 CsrfMissingError（人话句），fetchJSON headers=Content-Type+X-Console-Write+X-Console-CSRF；failureInfo sentence 覆盖+copy.ts writeFailure sentence 优先=403 泛句被专属句替换，Pending catch 链 rid 可复制+重试自动生效，409/404 reload 分支不受扰。
测试：TaskCreateForm.test +2（无 cookie 拒发+人话；403 mismatch 专属句+csrf-rid-77 上屏+req-copy 钮+不裸 code）、api.test +2（两 code 映射+rid 兜底；node env 无 cookie rejects CsrfMissingError 不发请求）、Pending.test 补 cookie 夹具；定向 57 files/422 passed；全量 120 files/1191 passed 0 fail；tsc web 单包 0。按 L0 节拍未单独构建，等合批上屏复验。

## P1 飞书 SSO 入口（feat(console): feishu SSO entry on login page）
实现：/login 主按钮 auth5-feishu（aria 说明整页跳转）→ window.location.assign(FEISHU_START_PATH=/auth/feishu/start)，非 fetch；密码表单保留为兜底（分隔行「或使用账号密码」）。回调失败回 /login 读 query feishu_error??error（rid=request_id??rid）：已知 code 专属人话（auth.feishu_denied=「飞书那边没有完成授权，登录没有发生。」/auth.feishu_unavailable=连不上句）+泛句兜底，auth5-feishu-error 卡含 RequestIdCopy 可复制编号与 auth5-feishu-retry「再用飞书试一次」；裸 code 零上屏；无 query 零回归。375 无横溢=按钮 w-full 于 max-w-sm 卡内。
读数：LoginPage.test 10 passed（旧 8 不回归+新 2：点击断 assign(/auth/feishu/start)+密码在；?error=auth.feishu_denied&rid=fs-77 断人话+fs-77+req-copy+重试钮+无裸 code）；全量 vitest 121 files/1194 passed 0 fail；tsc web 单包 0。桥端点由 lane D l7-ops 提供，本单前端接线；需 L0 合批 build+重章后 QA 上屏联调。

## ed5 员工详情五区真数据（feat(console): employee detail five zones real data，2026-11-19）
基线 23a8a7e0（reset --hard origin/lane/hermes-console；reset 前 P1-approvals 未提交残留已备份 /p1-approvals-leftover.patch 57 行交 L0 裁定）。五区端点全真（无 fixture，data-fixture 零出现）：概览 /agent-api/api/employees/{id}（404 回落 matrix 行）、能力 /api/matrix?employee=、审批 /api/approvals?employeeId=、运行 /api/runs?employee=、审计 /api/audit?employee=。
ego 登录态实测（emp_86A81CE8FF6F42E187BCF2B540，经 9122）：employees/{id}=404 信封（rid 09d865…）→概览走 matrix 回落；matrix=200 rows=3（rid 41f1…）；approvals=200 rows=0（诚实空态，rid a28f…）；runs=400 rows=2（错误态人话+rid a9ae…）；audit=400 rows=2（rid e2c3…）。运行/审计当前 BFF 拒参数=error 态如实渲染，非未接入态非假 0。
本单改动：①testid 家族 emp-detail-*→ed5-*（页面 27+测试 12 处）；②403≡404 同体：两文案常量合并 DENIED_COPY=「这块数据还没接入，或你没有查看权限。请联系工作区管理员确认数据源与权限。」不回显路径；③ZoneError 请求编号行接 RequestIdCopy（可复制+已复制/复制失败反馈）+重试；④缺值 —+原因、shortCode 8 位大写、USD、北京到分等既有判据核实保留。
验证：定向 employee-detail 13 passed；全量 vitest Test Files 122 passed / Tests 1220 passed 0 fail。9122 served=旧代次，DOM/屏幕读数留 L0 合批 build 后 QA 复跑；本单未单独构建。

## R24 审批八字段取数收口（fix(console): approvals detail eight fields）
BFF 实测形态（ego 登录态 GET /agent-api/api/approvals?status=consumed&limit=2 =200）：row 键含 approvalId/type/status/requestedBy{type,id}/approvers[{userId,role}]/argsDigest/verdict/decidedAt/createdAt…；无 recipient/dataScope/actionHash/changeKind 严格键（type=变更kind、argsDigest=动作指纹）。
修复：①personView 支持对象 handle 解包（requestedBy={type:user,id:1}→「成员 · 1」，approvers userId human:1→「人员 · 1」；有 name 用「姓名 · 短码」），clean>=1 放宽（单人 id=1 不再误显「—」）；②缺值 fallback「未指派」→「—」+原因（工单口径：未指派=真未指派语义保留，缺值=—）；③详情操作指纹 actionHash 键补 argsDigest（真数据接上，短码+title 全值+可复制钮）；④行卡/详情 申请人/执行员工 缺值句统一「服务未提供申请人信息。」「服务未提供执行员工。」（title 原因，无假 0）。
八字段现状（详情面板 apd5-*）：类型✓(changeKind 人话) 申请人✓(对象解包) 审批人✓(apd5-approver 顿号分隔姓名·短码) 结论✓(verdict 通过/驳回/要求修改) decidedAt✓(北京到分) 操作指纹✓(argsDigest) recipient/dataScope=该代次 BFF 无键→「—」+原因诚实 请求编号✓(可复制)。零写入口/403≡404 同体/apr5-* 家族维持。
测试：api.test 新 describe 2 用例（对象 handle/无 handle「—」不名未指派/argsDigest→actionHash）；定向 approvals 3 files 52 passed；全量 122 files/1222 passed 0 fail。屏幕 DOM 复跑待 L0 合批构建代次。

## tasks 看板真数据深度（feat(console): tasks board real-data depth）
五列登录态实测（9122 BFF 带 cookie，GET /agent-api/api/tasks?status=<v>&limit=50）：open=200:17行(rid 5c5dba) | in_progress=200:1(bc706d) | blocked=200:1(af24cc) | done=200:0(69847f) | cancelled=200:1(0089e3)；不带 status 的 ALL 口径=400:0(43d8f4)——lane D 的 status=all 修复未到，看板走五路显式 status 不受影响，如实记录。
判据对照：五态列 ✓（BOARD_STATUSES 真传参）；负责人「姓名 · 8位短码」/「未指派」✓（rowId/actorLabel，裸 emp_/human: 零上屏）；更新时间北京到分 ✓；成本 USD $x.xx ✓、真 0 显 $0.00、缺值本笔补原因=卡片行与详情成本改为非有限数时「—」+title「后台没有回传这条任务的成本。」（数据层不动）；状态未知「待核实」✓；状态迁移无死控件、创建入口=真 POST+csrf gate（CSRF 单已接）不假成功 ✓；四态齐+错误态可复制请求编号+重试 ✓；403≡404 同体不回显路径 ✓；testid tsk4-* 全家族不破 ✓；1440/1280/375 响应式（xl:grid-cols-5 md:grid-cols-2 min-w-0）✓。
验证：定向 src/modules/tasks 2 files 14 passed；全量 122 files/1222 passed 0 fail。屏幕 DOM 复跑待 L0 合批构建代次。

## matrix 能力与权限矩阵真数据双视角（feat(console): capability matrix real-data dual view）
真数据实测（ego 登录态 GET /agent-api/api/matrix）：http=200 rows=3 asOf=2026-11-19T12:06:28Z；三行=QA2契约验证(draft)·emp_217A91BA、AgentOS产品助理(active)·emp_86A81CE8、AgentOS产品助理(active)·emp_0166858D——同名两行由行头「姓名 · 8位短码」消歧（短码=前8位大写，裸 emp_ 零上屏、raw 进 title）；skillRefs 全空⇒技能引用=0、单元格三态计数 0/0/0 为真实口径（禁假 0/禁空白：三态渲染器 CellPill ●已授权/○未授权/?待核实+title 原因在位）。
双视角：员工视角/角色视角 tab（mtx5-view-people/mtx5-view-resource）+?view= URL 保态；宽表 mtx5-scroll 仅表内横向滚动，页面无横溢。
汇总条五项落地：员工 3 · 在岗 2 · 有风险「—」（title：风险数据源尚未接入，不做猜测）· 技能引用 0（与明细 cells 同口径）· 今日运行「—」（title：运行统计源未接入）+ 三态计数 + 读取于 asOf。
403≡404 同体：两路都进 denied 静态句「可能是这页不存在，也可能是账号还没有查看权限」，不回显路径 ✓；fixture 回落仅端点不可用且 data-fixture=1+人话注记（无 GAP 编号上屏）✓；testid 家族 matrix-→mtx5- 全替换（page 17+test 5 处，零残留）。
测试：定向 src/modules/matrix 5 passed；全量 122 files/1222 passed 0 fail。屏幕 DOM 复跑待 L0 合批构建。

## ov6 值班台/总览八卡真数据聚合（feat(console): overview duty cards real-data aggregation）
8 卡对位（ego 登录态经 9122 BFF 实测原始读数）：1) 可上岗/在岗 ov6-kpi-employees ← employee-stats 200 {total:3, byLifecycle{draft:1,active:2}}=真数据；2) 今日运行 ov6-kpi-runs ← run-stats?from=2026-11-19&to=2026-11-20 200 totals.runs=0（真 0，非缺失）；3) 待审批 ov6-kpi-pending ← approval-stats 200 {pending:0,dueSoon:0}（真 0）；4) 今日成本 ov6-kpi-cost ← budget-usage?periodKind=day 200 {items:[],missingEmployeeIds:全部3人}→显「—」+脚注「账本未覆盖全部员工（3 人缺账本）」，真 0 与缺失可区分（usd 与 null 分支）；5) 健康检查 ov6-kpi-health（本笔新增）=六源 states 聚合（员工统计/运行统计/今日运行/审批统计/成本账本/风险矩阵），独立探针未接入 noteTitle=GAP-OV6-HEALTH 编号进 title；6) 趋势 ov6-trend ← run-stats 14d 200 buckets n=2 真数据；7) 最近活动 ov6-activity ← 运行记录窗真数据；8) 阻塞与待办 ov6-blockers ← tasks?status=blocked 200 n=1 + approvals 真数据，部分源失败显「有阻塞源未接入，下面是已读到的部分」。
口径：汇总与明细同 payload（buildKpis/duty aggregate 单源）；每源 stamps 只认服务端采集时间键（sourceStamp），无 stamp 给原因不冒充；金额 ledger USD；错误态人话+RequestIdCopy 可复制编号+重试；403≡404 同体（Freshness/issue 文案不区分不回显路径）；宽卡网格既有 overflow 保 375 无横溢。
testid：家族 ov5-→ov6- 全量升级（page 32+test 19 处，CSS class 保持 ov5- 为样式钩子）；fixture/forced ?state= 代次既有。
测试：定向 src/modules/overview 8 passed；全量 vitest 122 files/1222 passed 0 fail。屏幕 DOM 复跑待 L0 合批 build 代次。

## R25 审批详情八字段回归修复（fix(console): approvals detail eight-field regression）
根因链（ego 真样本 ap_123DE49B9A1F42A197679681F1 经 9122 登录态 GET /agent-api/api/approval?id= 200）：①kind 取数被 body.type=business_action（审批类别）抢先，真变更 kind 在 binding.changeKind=message_send → 屏显「未写明类型」；②「类型」Field 无 data-testid → 探针口径缺 1/8；③R24 的 Field testId 渲染已核实落 DOM（verdict/decided-at/recipient/scope 四件 testid 在位）。
修复：model.ts kind 改取数序 changeKind/change_kind→binding.changeKind→kind/category→type(仅非 business_action)；views.tsx 类型 Field 补 testId=apd5-field-change-kind ⇒ 8/8 testid：change-kind/verdict/decided-at/approver/action-hash/recipient/scope/request-id。maskHandle 对短句柄 human:1 显「审批人」（无裸句柄上屏，合规不修）。
八字段逐项读数（真样本，api.test R25 用例锁定）：changeKind=对外发送消息✓ verdict=—（decisions 空诚实）✓ decidedAt=2026-11-17 21:09✓ approver=审批人·无裸 human:✓ actionHash=sha256:apr02（面板短码+title+复制钮）✓ recipient=—（无键诚实）✓ dataScope=null→—✓ requestId=null→—+未记录句✓；requester 解包无裸 human:。
验证：定向 approvals 3 files 53 passed；全量 122 files/1223 passed 0 fail。曾试 History.test 组件级用例污染既有 describe 已回滚改函数级锁。served 代次 d6d9bb07 属 L0 合批，需 L0 重建 dist 后 QA 复跑 8/8。

## T18 员工详情五区真数据深化（feat(console): employee detail five zones real data）
五区实测表（ego 登录态经 9122 BFF，样本 emp_86A81CE8FF6F42E187BCF2B540，2026-11-19）：
| 区 | 端点 | 读数 | 屏上口径 |
|---|---|---|---|
| 概览 | /api/employees/{id} → 回落 /api/matrix?employee= | 404 console.unknown_route → 200 n=3 rid 41f1… | 真数据（回落链既有）|
| 能力与权限 | /api/matrix?employee= | 200 n=3 | 真数据 |
| 审批 | /api/approvals?employeeId= | 200 n=8（D 别名增补后可用）| 真数据 8 行 |
| 运行 | /api/runs?employeeId= | 200 真行 rn_01M7D7421P5PA27TEXMT9YVDZ8 running costStatus=unknown | 成本「—」（真值缺失不假 0）|
| 审计 | /api/audit?actorId=&limit=50 | 200 {events:[]} 该员工暂无事件 | 诚实空态；from/to 全量通道见 ev_2BAA7DD7F3BC4767AF39764D91 证明解析已通 |
修复四处：itemsOf 兼容 audit {events:[...]} 信封（此前只认 items→audit 永远假空）；readAudit actor 对象解包（{type:system,id:employee-api}→name/id 回落，emp_ 句柄仍走 actorLabel 8 位掩码）；runs 区 URL employee=→employeeId=（BFF runs 要求 employeeId 过滤，employee= 必 400 missing_filter）；audit 区 URL employee=→actorId=（BFF audit 白名单无 employee 键，400 console.missing_filter）。
gap 台账（报 L0 转 D）：BFF 缺 GET /api/employees/{id} 详情路由（404 console.unknown_route）——概览已按既有 matrix 回落合规，非屏面缺口。
验证：定向 employee-detail 13 passed；全量 vitest 122 files/1223 passed 0 fail。9122 屏幕 DOM 复跑待 L0 合批重建代次。

## T18 员工详情五区真数据深化（feat(console): employee detail five zones real data）
五区实测（ego 登录态经 9122 BFF，emp_86A81CE8FF6F42E187BCF2B540，2026-11-19）：概览=/api/employees/{id} 404 console.unknown_route→既有回落 /api/matrix?employee= 200 n=3 真数据；能力=200 n=3；审批=/api/approvals?employeeId= 200 n=8（D 别名增补后可用）；运行=/api/runs?employeeId= 200 真行 rn_01M7D7421P5PA27TEXMT9YVDZ8（running，costStatus unknown→成本「—」不假 0）；审计=/api/audit?actorId=&limit=50 200 events:[]=诚实空态（该员工无自发操作），from/to 全量通道 ev_2BAA7DD7F3BC4767AF39764D91 证明 events 信封解析已通。
修复四处：itemsOf 兼容 audit {events:[...]} 信封（原只认 items→审计永远假空）；readAudit actor 对象解包（{type,id}→name/id，emp_ 句柄仍走 actorLabel 8 位掩码，系统 actor employee-api 原词合规）；runs 区 URL employee=→employeeId=（BFF runs 必 400 missing_filter）；audit 区 URL employee=→actorId=（BFF audit 白名单无 employee 键 400）。
gap 台账（报 L0 转 D）：BFF 缺 GET /api/employees/{id} 详情路由（404）——概览 matrix 回落合规，非屏面缺口。
验证：定向 employee-detail 13 passed；全量 122 files/1223 passed 0 fail。屏幕 DOM 复跑待 L0 合批重建代次。

## R26 blockers（fix(console): R26 blockers — detail panel, bare human, ov6 testids, audit nav）
F1 审批详情 0/8：真根因=行卡不可点——ApprovalRowCard 的 Card 加 role=button+tabIndex+onClick=onOpen+onKeyDown(Enter/Space)（Card 原语 spread rest 已证 card.tsx {...props}），标题钮 stopPropagation 防双触；vitest 新用例点 apr5-row 整卡→详情容器（History 显式 testId=apr5-detail）出现+8 个 apd5-field-*/apd5-approver testid 全在+文本无裸 human:/emp_+change-kind=对外发送消息。QA 活体恒 apr5-detail-empty 的代次差异待合批重建后复跑。
F2 裸 human::isMachineHandle 补 colon 句柄判定（line112 SCHEME_PREFIX 含 human:），approverLabels 对象项 name 走机器句柄时 maskHandle 兜底；全 approvals grep human: 上屏字符串=0（仅 title/注释）。
F4 任务板裸 0：空列 Badge{rows.length} 0→「—」+title 口径（真 0 计数仍显 0 的 summary 行保留既有 caveat）。
F6 值班台 testid 契约：DutyPage 双标=HCard data-testid duty-→ov6- 动态+data-duty-testid 保旧名；gate/ready-value/health/page 独立行同样双标；grep data-testid="duty 残留=0；header 新增 ov6-asof「采集于 {beijing(asOf)}」（todayStats/stats body.asOf，缺不显假）。dutyPage.test 一处选择器同步 data-duty-testid。duty 页体此行改动为工单 F6 点名授权。
F7 审计入口+别名：App.tsx nav 治理组新增 /audit「审计事件」（ShieldCheck，页体属 aud）；?tab=cron|admins|retention 归一已由 shell/routes.ts TAB_ALIAS line334-338（work.cron→board/identity.admins→people/system.retention→events）+ConsoleModulePage resolveTab 链满足，未新增代码。
验证：定向 approvals+tasks+duty+overview=9 files 125 passed；全量 vitest 122 files/1224 passed 0 fail。屏幕活体读数待 L0 合批重建（本单未 build）。

## apd7 审批决策回放 + 任务创建链收口（feat(console): approvals decision replay and task create closeout）
①决策回放只读块（views.tsx）：section data-testid=apd5-replay + 标题「决策回放 · 只读」；逐条=决定人（姓名·8位短码/人员·短码/未指派，原值进 title）· 决定（通过/驳回/要求修改）· 时间 BJT 到分 · 意见：note；空数组=apd5-replay-empty「无决策记录。」（替旧句「还没有人给出结论。」）；model decisionEntries who 兜底未署名→未指派。活体读数（ego 登录态）：consumed 列表 3 条各带 1 决策；样本 ap_AEEC078E0C824E749513AFEC9A 详情 200 decisionCount=1 first={userId human:1,verdict approve,comment…,decidedAt 2026-11-15T04:21Z}→屏上=人员·短码/通过/2026-11-15 12:21/意见全文。
②创建成功即时可见：afterCreate=setSelected+setTick→loadBoard 重拉列表（不刷新页面新任务即现）+成功卡 tsk4-copy-new-id 复制钮（短码上屏、剪贴全值，TaskCreateForm.test 断言 writeText(tk_ABCDEF1234567890)）。
③创建失败分级人话：csrf 两码专属句优先→401 写话术→403「这个写入没有被后台允许…」→400「提交的内容后台没有接受…」→其它通用；均带 RequestIdCopy 可复制 rid+重试，无假成功。
验证：定向 approvals+tasks 68 passed；全量 122 files/1224 passed 0 fail。基线申报：本地 tip=05d558b7（工单基线 4dd7966f=L0 合批 merge 笔不在 lane/console-appr 分支上，05d558b7 为其祖先，无冲突面）。

## 别名与版面扫尾（fix(console): tab aliases and responsive sweep）
①?tab=admins 注册=App.tsx 新 AdminsAwareIdentity 包装 /identity Route：tab=admins→Navigate /identity?tab=roles&view=admins replace（gov AccessModulePage 自带 view=admins 管理员视图，页体零改动；routes.ts line239 compat admins→people&view=admins 旧落错槽由此修正；grep AdminsAwareIdentity=2；9122 仍旧代次，落点断言 QA 合批后复跑）。
②cron/retention/evidence 别名=TAB_ALIAS routes.ts line334-338 在位（work:{cron:board}、system:{security,retention:events}；knowledge evidence=原生 tabId）+ConsoleModulePage resolveTab 链不变=仍生效。
③三档复扫：ego iframe 脚本两轮不可靠（读 0/静默），降级结构证据=T42/ov6 轮 375=375 实测在案、本单未动布局代码、App.tsx 主容器 overflow-x-hidden 兜底、shell+pages 115 passed。
④工程语言复扫（9122 旧代次活体 innerText）：shell/pages 零命中；2 处转报=（a）/system 32hex d43285e6f65d40bb84f7249aca385a6f 上屏属 modules/health 页体（禁碰域，转 aud/gov/L0）；（b）/audit（→/system?tab=events）ap_123DE49B9A1F42A197679681F1 全量句柄上屏属 modules/audit 页体（禁碰域转报）。
验证：assert-ia 两模式 exit0（51/22/1/8 未破）；定向 shell+pages 16 files 115 passed；全量 122 files/1224 passed 0 fail。

## R28 可信度拦车（fix(console): R28 credibility blockers）
①不存在员工虚构缺陷：useOverview 加 notfound 相——detail 200 但 body 不是该 id（gotKey!==empId）→ed5-overview-notfound 整页；detail 404/401 回落 matrix 时行身份强校验（rowKey 不符同样 notfound），禁借真名/借预算；整页=「员工不存在或无权查看。」+RequestIdCopy 可复制编号+返回员工列表真 Link。单测 3 用例锁（404 借他人行→notfound 无「别的人」无 .00；200 借他人 body→notfound；真人 404 回落自己行→ready）：employee-detail 定向 16 passed。
②approver 位=views 恒渲染 p data-testid=apd5-field-approver（内层 apd5-approver 双标保留），labels 空=「—」+title 单据没有带回审批人。③apd5-field-request-id 空态=「—」+title 这条记录没有带回请求编号（禁复用错误卡文案）。④裸 human:：代码链三重实证 isMachineHandle(SCHEME_PREFIX 含冒号)/maskHandle(<4→裸名词「审批人」)/personView(≥1→人员·短码 否则 —)全掩码，活体两处属旧代次，请 QA 合批后复跑归零。
⑤/overview 八卡截至：健康检查卡补 stamps（运行统计 todayStats asOf）后 8/8 卡均有「数据截至 BJT 到分 · 来源」Freshness（ov6-*-stamp），sourceStamp 只认服务端时间缺不显假。⑥侧栏审计入口 nav path /system?tab=events→/audit（AuditAwareEntry 路由在，用户可达）。⑦/work?tab=cron：CronAwareWork 元素分支挂 gov CronModulePage（cron5-* 上屏，禁静默回落 board；TAB_ALIAS 归一被前拦截）；页体零改动只挂载。
验证：定向 employee-detail 16、approvals 全绿；全量 vitest 126 files/1268 passed 0 fail；assert-ia 不受影响（routes.ts 未动）。9122 仍旧代次（ad72c31c/D3sU0dej），全部 DOM 活体读数需 L0 合批重建后 QA 复跑。

## R28b cron 槽位契约续（fix(console): honor gov cron slot contract for /cron alias）
基线：本地 lane/console-appr merge origin/lane/hermes-console(da807e4f)=无冲突，gov 74957c6d zone 真渲与 de17dda9 notfound 五处共存（grep 复核，未回退 gov）；merge 代替 rebase 因禁 force 且远端 lane/console-appr=de17dda9 为祖先，ff push 成立。
契约（74957c6d docs/_artifacts/gov/DONE.md 原文）：#/work?tab=cron 与 #/cron 两槽 → CronModulePage。/work?tab=cron 已由 CronAwareWork 挂（de17dda9）；本笔新增顶层 Route /cron → CronConsolePage（console 块 first-in-tree 先于 BUILTIN 上游 CronPage，未删上游路由）。
验证：shell+pages 16 files 115 passed；全量 126 files/1269 passed 0 fail。活体 cron5Count DOM 读数待 L0 合批重建后 QA 复跑。

## R29 收尾（四项 DOM 自证读数+行号，fix 第二笔）
- 项1 overview asof+八卡来源：OverviewPage.tsx line354 ov6-asof；KpiCard Freshness testid ov6-<card>-stamp（line118 模板）→9 testid DOM 存在性=vitest OverviewPage.test 新用例 9 querySelector 全非 null（overview 9 passed）。
- 项2 侧栏 /audit 入口：console.tsx line650 NavLink to=/audit（无 data-mod，a[data-mod]=8 契约不破）；console.test 新用例断 a[href=/audit]+文本「审计」=DOM 读数①；代码 grep 行号=自证②。
- 项3 retention 挂载：App.tsx line1249 /system element=<SystemAwareTabs/>（tab=retention→RetentionConsolePage，ret4-* 页体只挂载）；9122 旧代次活体 ret4 读数待合批，DOM 证据=组件链+行号。
- 项4 human 掩码：model.ts line300 humanizeHandles；views.tsx line112/详情事由 p title=原值+掩码文；api.test 三断言（人员出现+human:/user: 零残留+emp_ 保留）99 passed。活体两处裸 human:=种子单 reasonText 业务正文（EGO R29-LIST/DETAIL 上下文实证），显示层掩码后=0。
验证：定向 approvals+shell+overview=9 files 99 passed 0 fail。

## 夹具债清零·appr 域 3 页（feat(console): fixture debt burn - 3 appr pages real or honest）
清单（工单第一步）：grep -rl data-fixture web/src/modules/{approvals,tasks,employee-detail} --include=*.tsx 改前命中=approvals/{states.tsx,两页 test}；tasks=0、employee-detail=0（前轮已真数据）。
改后：生产码（非 test）data-fixture 命中=0（grep 实测 wc -l=0）；states.tsx fixtureAttr 机制删除、两页 16 处 fixture={} 传参摘除；?state= 复现保留数据行为（useApprovalsData forced 机制不动），标注改屏上诚实文本 apr5-forced-note（Pending line225/History line212『这是用 ?state= 复现出来的状态，不是服务此刻的回答。』）；两 test 6 处属性断言换 forced-note testid 断言。
3 页 DOM 读数（vitest=DOM 证据）：Pending forced loading/empty/error/denied 四态各 apr5-loading/apr5-empty/apr5-error+apr5-retry/apr5-denied+forced-note 全存在（用例 marks it as a repro 绿）；History 同（loading/denied 两态绿）；真数据态=既有全绿用例（approvals 域 55 passed）：200 渲染真值、事由 humanizeHandles 掩码、金额 ledger、BJT 到分、8 位短码。
验证：定向 approvals 3 files 55 passed；全量 126 files/1272 passed 0 fail。

## duty 页夹具清零 + 四门来源标注（feat(console): duty gate sources and fixture burn）
清单（工单①）：grep -rl data-fixture web/src/modules/duty 改前命中=4 文件（UsagePage.tsx fixtureAttr 机制+MatrixView.tsx 样例回落+UsagePage.test+dutyPage.test）。改后生产码命中=0（grep 实测 UsagePage/MatrixView 均 0；test 内仅剩 toBeNull 反向断言，非夹具）。
夹具处置：①MatrixView 404→MATRIX_FIXTURE 样例回落删除，改整块诚实「能力矩阵未接入」（matrix-unwired：人话+GAP-06 进 title+重试，不展示占位数据；MATRIX_FIXTURE import 摘除，dutyPage.test 两用例同步改未接入/非未接入断言）；②UsagePage fixtureAttr 函数与 5 处属性展开删除，?state= 复现腿保留屏上诚实文本（『这是用 ?state= 复现出来的状态…GAP-07』line104）与控件禁用 title，repro 用例断言由属性改文本+testid。
四门 asOf（工单②）：types GateView+asOf:string|null；buildReadiness 第三参 stamp=stats 回答的 asOf/generatedAt 经 beijing 到分；GateRow 渲染——unknown 门显「未接入 · 截至 —」（title=code：该数据源尚未接入，没有采集时间；V1/V2/V3 code 只进 title），V6 有 stamp 显「截至 <BJT 到分>」、无 stamp 显「截至 —」+title 原因；无假 0。
testid 双标（工单④）：本轮未破既有——duty-gate-*/duty-ready-value/duty-page 等 data-testid=ov6-*+data-duty-testid=duty-* 双标在位（R28 落），usage usg4-*、matrix matrix-* 前缀不动（域内自有家族），四态/rid 可复制/403≡404 既有机制未逆。
验证：定向 duty 3 files 49 passed；全量 126 files/1272 passed 0 fail。9122=1fff2e58 代次由 R30 QA 活体跑，本车道 DOM 读数以上述 vitest 断言+grep 为准。

## 员工详情 运行/审计 两区真数据（feat(console): employee detail runs and audit zones real data）
两区真实请求与 http 码（ego 登录态 9122 现势代次，emp_86A81CE8FF6F42E187BCF2B540）：runs=/agent-api/api/runs?employeeId=<id> → 200 n=13（runId rn_01M7D7421P5PA27TEXMT9YVDZ8…，前端 URL 已是 employeeId=，QA 判 400 为旧代次 employee= 拼写）；audit 旧 URL actorId=<id> → 200 events:[]（该员工无自发操作）→ 本笔改 resourceId=<id> → 200 events n=2（真事件 ev_EED6C34F4CB140EABD674C42A0：occurredAt/actor{type:system,id:employee-api}/action budget.ledger_ensured/outcome success）。
渲染：运行区既有真数据链不动（状态人话 Badge/BJT 到分/成本 money 缺—/用量 dash）；审计区新列——结果列 outcome 人话（success 成功/failure 失败/denied 拒绝/未知 待核实，raw 进 title）、操作人 system 类显「系统操作」（id 进 title，非 emp_/human: 裸上屏）、请求编号列=RequestIdCopy（本代次事件体无 rid→诚实「这条记录未携带编号」，有值即真+可复制）；readAudit 兼容 events 信封+occurredAt+actor 对象+outcome。
testid：ed5-zone-runs-list/ed5-zone-runs-row、ed5-zone-audit-list/ed5-zone-audit-row 新增；既有 ed5-audit/ed5-runs 家族保留；两区零写入口、四态、403≡404 同体未逆；375 堆叠 grid-cols-1 天然无横溢。
验证：定向 employee-detail 18 passed（R32 新用例断 22:46 北京时间/系统操作/成功/未携带编号/裸句柄零）；全量 126 files/1273 passed 0 fail。9122 活体屏幕复跑待 L0 合批。

## R31 任务详情抽屉真数据收口（feat(console): task detail drawer real data）
深链：/tasks/<id> 路由不在本树（App/shell 禁碰）→按工单预案=站内抽屉+URL 不变+注明：tsk4-detail-note『详情以页内抽屉展示；当前版本没有按任务的深链，刷新页面会回到看板。』title 带原因（GAP 只进 title）。
字段实测（ego 真样本 task-detail?id=tk_89F5AEF75D814C17BD1FDFC8BB=200）：标题✓/assignee{employee,emp_86A81CE8}→actorLabel 姓名·8位短码✓（裸 emp_/human: 零上屏，createdBy human:1→人员）/优先级人话✓/状态 statusLabel+未知待核实✓/createdAt+updatedAt BJT 到分✓/成本=真样本无 cost→「—」+title 原因（ledger money 真 0 显 $0.00 机制在）/来源 source{kind:manual}→人工创建，缺→未接入句+title✓。
最近事件：normalizeDetail 新增 events 解包（eventId/kind/note/at 多键兼容）；真样本 detail 无 events 键→渲「无事件」+title 原因，禁造事件；有则列前 3 条（vitest 4 事件样本断言第三条在、第四条不出现、at=2026-11-17 10:00）。
创建后直开详情=复用 setTick+onCreated→setSelected 既有链✓；失败面既有 RequestIdCopy+重试✓；迁移按钮本树 tasks 无（grep 零）✓。testid：tsk4-detail-*（状态卡）+tsk4-detail-note 新增。
验证：定向 tasks 2 files 15 passed；全量 126 files/1274 passed 0 fail。屏幕活体待 L0 合批。

## P2 任务看板筛选与分页真生效（feat(console): task board filters and paging real data）
筛选真传 BFF（ego 登录态 9122 活体，每筛选请求码+行数）：status=open → 200 n=17；status=all → 200 n=20（BFF 五态扇出聚合）；不带 filter → 200 n=5（D 件聚合生效，不再 400）；assignee=employee:emp_86A81CE8… → 200 n=10 真过滤（裸 emp_… 格式 → 400 invalid_query「assignee must be 'employee:<id>' or 'human:<user>'」，option 值因此一律 employee:<id> 前缀）；priority=high → 200 n=17 与不带完全一致=**BFF 忽略 priority 参数**→优先级下拉渲染为 disabled+title 原因（「服务端优先级筛选尚未开放」），禁假过滤。
分页/游标真生效：limit=2 → 200 n=2 + nextCursor(base64)；cursor=nextCursor → 200 page2 n=2 新行（tk_0762C4D…/tk_1B4EA3C…）+新 nextCursor。筛选视图=单条真查询 loadFiltered（status/assignee/cursor 直传白名单参数）；五列看板在筛选态不发五路并发（loadNamesOnly 只取目录腿保姓名短码标签）；翻页写 URL cursor，上一页用内存栈回退，栈空 disabled+title 诚实「回放从当前页开始」；无假翻页。
URL 可回放：筛选+分页组合全量落 ?status=&assignee=&cursor=（setParams replace），刷新/分享回同一答案；filterActive 由 URL 派生，非组件态。
空 vs 失败区分：rows=0 → tsk4-filter-empty「没有符合条件的任务。」「这是服务端的真实回答…不是加载失败。」+清空钮；error/denied → 人话标题+message+RequestIdCopy 可复制 rid+tsk4-filter-retry 重试；403/404 → denied 同体既有口径。
testid：沿用 tsk4-*；新增 tsk4-filter（组）/tsk4-filter-status/-assignee/-priority/-clear/-retry/-view/-empty/-list/-row-<id>/tsk4-page/-prev/-info/-next。三档无横溢：筛选行 grid 375 单列堆叠、sm 起六列定宽 minmax(0,…)。
验证：定向 tasks 2 files 17 passed（新增：共享筛选=恰 1 条 /api/tasks 真查询+游标翻页写 URL；空结果=真实回答非失败；priority disabled）；全量 126 files/1276 passed 0 fail。屏幕活体待 L0 合批。

## R31 总览采集时刻与 KPI 标记族收口（fix(console): overview asOf and KPI stamp family (R31)）
DOM 自证（vitest OverviewView R29 用例，夹具 asOf 2026-11-19T04:20Z→北京 12:20）：ov6-asof 文本=「采集时刻 北京时间 2026-11-19 12:20 · 每卡来源见卡内标注」（正则断言 北京时间 YYYY-MM-DD HH:mm）；取不到=「采集时刻 —」+title 原因（sourceStamp.reason 人话），禁编时。
八卡 stamp：ov6-kpi-employees-stamp/-runs-stamp/-pending-stamp/-cost-stamp/-health-stamp + ov6-trend-stamp/ov6-activity-stamp/ov6-blockers-stamp（R29 用例 9 testid 全在位，每 stamp 走 Freshness=「数据截至 <分> · 来源 <人话>」+未知原因）。
关键修复=此前 ov6-asof 只在主返回渲染，总览全失败/全空两早退分支 DOM 无 ov6-asof（R31 探针 asofTxt=null 根因）；AsofLine 组件三分支常驻（forced ?state= 复现分支带空来源=「—」+title，非编时）。
KPI 族：五卡 data-testid=ov6-kpi-<name> 统一在位+新增 data-duty-testid=duty-kpi-* 别名 5 处、ov6-trend/activity/blockers 卡 duty-* 别名 3 处（QA 旧选择器零回归）；数值口径未动（真 0 与「—」区分、dashed/money 机制原样，成本卡真 0→$0.00 既有断言保持）；错误/空态人话+可复制 rid+重试未逆。
验证：定向 overview 1 file 9 passed exit0（新增 asof 正则+duty-kpi 计数断言）。
