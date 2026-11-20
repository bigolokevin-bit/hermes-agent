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

## R31-obs · 审批详情 approver 标签重复 + 锚点漂移（小单，2026-11-20）
- 根因：`approverLabels`/`decisionEntries` 对裸机器值（human:1）回显角色名词「审批人」，而字段本身已渲「审批人：」→ 屏上「审批人：审批人」。
- 修法（model.ts）：裸值名词统一改「人员」（含短码形态「人员 · 86A81CE8」）；数组项无姓名时把原始 handle 回填 `raw` → 字段 title 带原值 human:1；上屏仍不出现裸 human:/emp_。
- 锁：新用例「R31 obs: the approver field renders once and bare human:1 reads 人员 with the handle in the title」——断 不出现「审批人：审批人」、apd5-field-approver 与 apd5-approver 各计数=1、值=「人员」、title 含 human:1；api.test 八字段用例补 labels 不含「审批人」+ raw 含 human:1；human:2 决策回放 who 断言同步「人员」。
- 八字段 testid、零写入口（history 无 actions）、403≡404 同体既有锁未动。
- 验证：定向 approvals 3 files 56 passed EXIT=0；全量 126 files/1277 passed。9122 停在 9c7789f6（R32 取证中，禁重建），故实测值取自 DOM 用例读数：审批人：人员（title=human:1）。

## R32 三条产品拦车修复（2026-11-20 01:4x，lane/console-appr）

**① ov6 族落到实际挂载组件（根因=g1d5d99a/187e88c4 改到了未挂载的 modules/overview/OverviewPage.tsx）**
- 挂载链证据：App.tsx route `path="/overview"` → `TabbedModulePage/ConsoleModulePage module="overview" live={{ duty: <DutyConsolePage/> }}`，默认 tab=duty；DutyConsolePage=lazy `@/modules/duty/DutyPage`（App.tsx line94）。OverviewPage.tsx 全仓零 import=死码。
- DutyPage.tsx：ov6-asof 改恒渲染——有上游时间→「采集时刻 北京时间 YYYY-MM-DD HH:mm」（仅取 todayStats.asOf/stats.asOf 真值，无编时）；取不到→「采集时刻 —」+title 人话原因；forced loading/empty/error 三分支也带 ov6-asof。
- 八卡 stamp：HCard 新增 stamp 属性，DOM `ov6-<card>-stamp`（duty-<card>-stamp 别名）=ready/today-runs/today-cost/trend/activity/blockers/pending/recent，行「数据截至 X · 来源 Y」；数组明细腿（阻塞/最近运行）诚实「—」+title 原因，禁编时。
- ov6-kpi 族×5（含 duty-kpi-* 别名）：ov6-kpi-employees（可上岗值 span）/ov6-kpi-runs/ov6-kpi-cost/ov6-kpi-pending（各 duty-num p）/ov6-kpi-health（账本 b）。
- 读数（vitest jsdom，夹具无 asOf→诚实「采集时刻 —」）：dutyPage.test 新用例锁 asof 正则+八 stamp testid+kpi≥5。9122 停 33fc7029 代次禁重建，活体读数待下一代次复核。

**② 页级 testid**：shell/console.tsx ConsoleModulePage 计算 pageTestId → ConsoleModulesFrame 活跃 section data-testid：/employees→emp-l-page、/employees?tab=matrix（=/matrix 重定向同点）→mtx5-page、/approvals→apr5-page。console.test.tsx 三个新用例逐一命中。

**③ 七条静默兜底显式化**：App.tsx 新增 Route——/duty→/overview（值班台本就是默认 tab）、/tasks→/work?tab=board、/settings→/system?tab=defaults、/events→/system?tab=events（均 routes.ts 真在的 tab）；/calendar、/integrations、/forms→新 shell/NotWiredPage「未接入」页（testId=cal-page/int-page/frm-page + notice，明说无数据源不猜内容，带返回值班台）。未知路径不再回落值班台假装有数据。

验证：定向 duty+shell 64 passed；assert-ia html/react 两模式 exit 0（51/22/1/8 计数未动，routes.ts 未改）；全量 vitest 见回执。

## R35 员工详情聊天区真数据（2026-11-20 ~02:0x，lane/console-appr，基线 50119b5e=origin/lane/hermes-console tip）

工单基线写「应 9fedd46f」，实际远端 tip=50119b5e（9fedd46f+门禁台账一笔，已含本人 e3ae64e8）；按分支名 reset --hard origin/lane/hermes-console 后开工，toplevel/branch 校验通过。

**实际请求贴数（9122=9fedd46f 代次活体，只读探测）**：GET /agent-api/api/sessions?limit=5 → **200 {sessions,total} n=0**；GET /agent-api/api/console-sessions?employeeId=emp_86A81CE8…&limit=5 → **200 {items} n=0**（真按员工过滤腿，白名单 employeeId/limit/cursor）；GET /agent-api/api/chat/sessions?limit=5 → **404 {code,message}**（BFF 无此路由，工单①点名的第二种形态实测不存在→采用 console-sessions 腿）。

实现（web/src/modules/employee-detail/EmployeeDetailModulePage.tsx）：mapShellZone 新增 chat（仅 ?zone=chat 深链可达，导航条保持五区不动）；ChatZone=useResourceList 只读摘要：会话标题/最后消息时间 beijing 到分/消息条数/状态人话（active|open→进行中，archived|closed|ended→已结束，未知→待核实，原值进 title）；四态齐（ed5-zone-chat-loading|error(可复制 rid+重试)|denied(403≡404 同体 DENIED_COPY，不回显路径)|empty=「该员工的对话记录尚未接入」+原因，GAP 引用只进悬停 title）；ready 行 ed5-zone-chat-row。**零新 chat host（断言 [data-chat-host]=null）、零写入口、无消息流**。testid 全在 ed5-zone-chat-* 家族。

测试：4 新用例（真行渲染+五区不破、空态诚实句、error rid+重试、403≡404 同体不回显路径）。定向 employee-detail 22 passed；全量见回执（基线 50119b5e 上另车道已增用例，以本轮实跑为准）。9122 代次禁重建，活体行数据待含会话种子代次复测。

## R34 追加两项（2026-11-20 01:5x，一笔 commit）
① /duty 显式归一：注册于 shell/routes.ts 新 PATH_ALIASES 表（{"/duty":"/overview"}），App.tsx 既有 <Route path="/duty"><Navigate to="/overview" replace/></Route>（R32③）即其消费形态——**有意归一（值班台语义已并入 /overview 的 duty tab），不是未命中后的 SPA 兜底**。不进 REDIRECTS 数据行因附录 A 计数法锁 redirects=24/24（routes.ts 运行自检），前后台数不变：assert-ia html 与 --source=react 均 exit 0，routes=51 tabs=22（chatHosts=1 modules=8 未动）。侧栏值班台已指 /overview（console.tsx:273 to="/overview"，未改）。
② asOf 时区文案：ov6-asof 取不到值时=「采集时刻 —（北京时间）」（真分支+forced 三分支同改）；八卡 ov6-<card>-stamp=「数据截至 —（北京时间） · 来源 …」；有值分支保持原「采集时刻 北京时间 X」形制。NC① 判据（文本含北京时间）现两分支均满足。验证：shell+duty 定向 8 files/88 passed。

## R36 基线 tsc 两处红·机械修（2026-11-20 01:5x，lane/console-appr）
- web/src/modules/approvals/api.test.ts:136-137 TS18047：detail 加可选链断言（detail?.actionHash / detail?.kind.label），值与语义不变。
- web/src/pages/LoginPage.test.tsx:131,149 TS2739：两处同步 `() => jsonResponse(...)` 改 `async`（与文件既有 20+ 处习语一致）。
- 定向 2 files 32 passed；全量见回执。诚实挂账：tsc -b 仍 exit 2——余红不在本单写域（apps/shared 缺 vitest 类型环境红 40+、approvals 产品码 Marked TS2322×14、duty DutyPage TS2339×5、employee-detail TS2322×1、security TS2353×1、tasks 测试 TS2698×1），归因=本 lane R32/R35 自引入与别车道，待后续单处置。

## R37 写域内 tsc 红清除（2026-11-20 02:0x，lane/console-appr，merge 基线姿势）

基线：`git fetch origin` + `git merge origin/lane/hermes-console`（7e7b92cd，不 rebase 不 force）。
每处文件:行 → 修法（只动类型，禁 skip/ts-ignore/tsconfig/行为改动）：
- web/src/modules/approvals/states.tsx:25 — `Marked = Record<string, never>` → `Record<never, never>`（具名 props 交叉后被 never 索引签名吞掉，消 ApprovalsHistory/PendingModulePage 共 12 处 TS2322；行为零变化）。
- web/src/modules/duty/DutyPage.tsx:269/328/369/416/549 — `stampOf(asOfOf(X.data))` → `X.k === "ready" ? asOfOf(X.data) : null`（消 5 处 TS2339；非 ready 腿本无可用时间，渲染不变）。
- web/src/modules/employee-detail/EmployeeDetailModulePage.tsx:523 — `<Badge tone={...neutral/info}>` → `<Badge>`（两值都不在 Tone 联合，运行时本就落基础样式；消 1 处 TS2322）。
- web/src/modules/tasks/TasksBoardModulePage.test.tsx:133 — `...resolveDetail(),` → `...(resolveDetail() as Record<string, unknown>)`（unknown 不可 spread，TS2698 清零试）。

验收：`tsc -b . --noEmit` EXIT=2，写域四域 grep 命中=0；剩余 src 红仅 1 行=src/modules/security/SecurityModulePage.tsx（写域外，挂账 R36 清单）+ apps/shared TS2307 环境噪声（写域外）。定向 vitest（approvals/duty/employee-detail/tasks）9 files/145 passed exit0；全量 129 files/1319 passed（≥基线 127/1306，merge 带入他人用例）。

## R35 放行条件①：sec5 壳层挂载（2026-11-20 02:0x，lane/console-appr）

基线：fetch 后 reset --hard origin/lane/hermes-console = **7e7b92cd**（工单预期 e4c03f8c 为旧指针，wave-4 合并后实际 tip；toplevel 校验通过，porc=0）。代码含 gov security 页体（184dd521 系已并入）。

挂载（只动壳层，不碰页体）：App.tsx line107-110 新 `const SecurityConsolePage = lazy(() => import("@/modules/security/SecurityModulePage"))`（默认导出已在，无需改模块）；line1605-1607 SystemAwareTabs 在 retention 判断前拦截 `sp.get("tab")==="security"` → 直接渲 SecurityConsolePage（App 级 Suspense line1166 兜底 loading）。`/system?tab=security` 与 `?tab=security&view=anomaly` 变体同点命中；routes.ts 既有条目（line256 compat-tab visible:false、line348 TAB_ALIAS、line356）一律未改——**不新增 Tab、registry 计数不动**。

四态/零写入口=模块既有实现（gov 交付）：loading/empty/error（可复制 rid+重试）/gap（403≡404 同体「未接入」+原因，GAP 编号只进 title）；planned 按钮 data-planned+aria-disabled+title；本轮 SecurityModulePage.test 加 sec5-page DOM 唯一性锁（toHaveLength(1)，q 助手用 document 级查询的坑同修）。

自证读数：①App.tsx 107/110/1605 + routes.ts 256/348/356（上列）②sec5-page 命中=1（新锁）；sec5 家族 40 个 testid（page/loading/empty/error/gap/retry/risk-* /mfa/keyring/session/secrets/planned-*/summary/refresh/copy/req…）③assert-ia html/react 两模式 exit 0，routes 51 / tabs 22 / tabsAll 23 / chatHosts 1 / modules 8 全不变 ④定向 security+audit+shell 16 files/195 passed exit 0；全量 129 files/1319 passed=基线绿。9122 停旧代次禁重建：活体 DOM 读数待下一代次复核，本轮以 jsdom 实测交付。

## 员工列表深度（搜索/筛选真生效 + URL 保态，2026-11-20 03:1x，lane/console-appr）

基线：fetch+merge origin/lane/hermes-console → tip=965cec5d（6c9db598 绿代次），porc=0。写域=web/src/modules/employees/**（App/shell/routes 零改动）。

实现（EmployeesModulePage.tsx）：①URL 成唯一状态源——q/lifecycle 从 ?q=&lifecycle= 派生，搜索 300ms 防抖后写回 URL（replace），select 即写；刷新/回退/分享重开同屏（local↔URL 双向同步 effect）。②列改七列：员工｜短码｜状态｜部门（row.department 真字段，null→「—」+title「上游响应没有带部门信息」）｜最近活跃（updatedAt→北京时间到分，表头 title 注明口径；缺值「—」）｜知识｜月度预算；手机档堆叠 data-label，md 七列全 min-w-0 truncate，无横溢。③lifecycleLabel 未知态「未知」→「待核实」。④error rid 改 RequestIdCopy 可复制（req-copy），denied 403≡404 同体既有保持。⑤testid 族：旧名 employees-* 全部原样保留，新增 emp-l-list（ul）、emp-l-row-<id>（span.contents 包行）、emp-l-name-link-<id>（真 a[href=/employees/<id>] 可聚焦）、emp-l-search（label 外包 span.contents）、emp-l-filter-lifecycle（select 外包 span.contents）。

活体 BFF 证据（9122=6c9db598，只读探测）：/api/employees?limit=3→200 n=3，row0 实字段含 department:null、updatedAt、enrichment{…}；lifecycleState=active→200 n=2（真过滤）；keyword=QA2→200 n=1；keyword=x→200 n=0（真实空，非报错）；BFF passthrough=(keyword,lifecycleState,limit,cursor,expand)（server.py:319-330，q 不在白名单=参数名以 keyword 上屏 URL 用 q 是前端层）。搜索命中口径=上游对姓名/岗位判定（前端不假过滤）。

测试：新 EmployeesModulePage.test.tsx 6 用例（URL 重开=恰 1 条真查询带 keyword+lifecycleState、行族读数（href/掩码 217A91BA/待核实/部门—/13:52 BJT）、打字写 URL+再查、select 生效+重开保态、403≡404 同体不回显路径、500 人话+rid+重试）。坑记录：测试文件必须 vi.mock("@nous-research/ui") 替身（barrel 拉 .webp 资源 node 加载炸）且替身要透传 rest props（否则 Card data-testid 丢）；input 需 HTMLInputElement.prototype value setter 再 dispatch input（React 不认直改 .value）。

验证：定向 employees 6 passed exit 0；tsc -p 本模块零红；assert-ia 两模式 exit 0（51/22/1/8）；全量 130 files/1336 passed（≥基线）。9122 禁重建：活体 DOM 读数待下代次，本轮 jsdom+真 BFF 参数探测双交付。

## typecheck 门整体转绿（参谋收口单，2026-11-20 04:0x，lane/console-appr）

修前：`cd web && ./node_modules/.bin/tsc -b . --noEmit` EXIT=2，共 53 行 = 产品侧 4（src/modules/employees/EmployeesModulePage.test.tsx:13-16 TS2503 Cannot find namespace 'JSX'——React 19 类型下 JSX 全局命名空间不存在，系上一笔 6e7f16ac 引入）+ 环境侧 49（../apps/shared/src/*.test.ts：TS2307×21 找不到 vitest + TS7006×28 连锁隐式 any）。

产品侧修法：删除四处 `as JSX.Element` 断言（stub 箭头函数返回类型自动推断，零运行时语义变化，无 any/ts-ignore/tsconfig 放宽）。

环境侧定性与修法（非包声明改动）：apps/shared 已在 pnpm-workspace（packages 含 apps/*）与 pnpm-lock（importer apps/shared，vitest@4.1.12 devDep，line 525/593/724 link）正确声明；红因=本 checkout 的 apps/shared/node_modules 缺失（strict 隔离下 shared 自身测试文件解析不到 vitest）。补装=仓库根 `pnpm install --frozen-lockfile`——默认 node 24.22.0 被 engines{node>=26} 拒（ Unsupported engine），用本机 nvm v26.13.1 一次成功（Done in 10s，未改 package.json/pnpm-lock）。可复现判据：无 node_modules/apps/shared 时 TS2307/7006 必现；install 后 0 现。门不必拆 web-only——web/tsconfig.app.json include 有意含 ../apps/shared/src（源码+其测试面同项目校验），拆include 反而遮蔽 shared 面类型；建议保留现形，把「node>=26 下 pnpm install --frozen-lockfile」写进环境引导即可。

修后：同一命令 EXIT=0、0 行错误。定向 employees 6 passed（仅删类型断言，未跑全量=零运行时改动，全量读数沿用上笔 130 files/1336 passed）。

## R38 唯一产品拦车：/employees 挂载错实现修复（2026-11-20 04:1x，lane/console-appr）

基线：按单 fetch+reset --hard origin/lane/hermes-console=**66d18551**（wave-9；toplevel 校验 ✓，porc=0）。

根因与修法：R38 卡实测 /employees 渲 legacy pages/EmployeesPage——App.tsx:1232 `/employees` ConsoleModulePage 的 live slot `list: <EmployeesPage />` 挂的是旧页；模块 EmployeesModulePage（6e7f16ac 搜索/筛选深度单）从未接路由（其 chunk 在产物里只因 manifest reuse 静态可达）。修法=App.tsx:92 新 lazy import modules/employees/EmployeesModulePage + slot 换 `list: <EmployeesModulePage />`；matrix slot 与 /employees/:id 详情未动；routes.ts/registry 零改动，无新增 Tab。

自证（jsdom 真实挂载链，新文件 EmployeesRouteMount.test.tsx 4 用例全绿；9122 禁重建，活体 DOM 待下一代次复核）：
- emp-l-page（frame 级）+emp-l-search=1+emp-l-filter-lifecycle=1+emp-l-list 在屏；legacy 独有文案「这台机器还没有接入任何数字员工」「无法打开数字员工列表」均不在=非 legacy 判别证据。
- 行姓名=真 a[href=/employees/emp_AAAA1111BBBB2222CCCC3333]（emp-l-name-link-*），emp-l-row-* ×2，行文本无裸 emp_；部门列真值「增长组」/缺值「—」；最近活跃 2026-11-18 09:10（BJT 到分）；未知态走「待核实」。
- 筛选生效：?lifecycle=paused 深链→select 回填 paused、行数 2→1、fetch 带 lifecycleState=paused；交互 change→active 再过滤（小鲤 1 行）。URL 唯一状态源=readback：?q=%E5%B0%8F%E9%B2%A4 深链回填搜索框并恰发该 keyword 查询；back/刷新同 URL（上单 6e7f16ac 机制，本单挂上路由后真实可达）。
- 错误态=人话+RequestIdCopy（req-copy）+重试；403≡404 同体且不外泄 agent-api 路径。
- ⑦三档无横溢：jsdom 不可测三档宽度，如实报形态学证据=七列 grid 全 minmax(0,·)+truncate、375 档单列堆叠 data-label（与 tasks P2 单已验同款布局），待活体复核。

门禁：assert-ia 两模式 exit 0，routes 51/tabs 22/chatHosts 1/modules 8；定向 employees 2 files/10 passed；全量 131 files/1346 passed（≥基线）；tsc -p App.tsx/employees 零红。

## R39 壳层 compat 对齐（security 语义双源清除，2026-11-20 04:0x，lane/console-appr）

基线：fetch+merge origin/lane/hermes-console → tip=fa2c3bf7（ledger at 466e2d2b，entry DBjC1SjB），toplevel ✓ porc=0。写域=shell/**（App.tsx 未动一行）。

三处改前→改后（唯一双源=compat 数据把 security 判归 events 旧槽，App.tsx:1605 直挂 SecurityConsolePage 才是现实）：
1. routes.ts:256 compat-tab 行（行数保留=51 计数之一）：label「审计事件」→「安全设置」；dataSource「随目标」→「App 直挂 SecurityModulePage（?tab=security 在壳层拦截，不判归审计事件）」；to `#/system?tab=events&view=anomaly`→`#/system?tab=security`（identity，bridge 不再改写走）。
2. TAB_ALIAS :348 `system: { security: 'events', retention: 'events' }` → `{ retention: 'events' }`（删 security 键；retention 不在点名范围不动）。
3. VIEW_ALIAS :356 删 `'system.security': 'anomaly'`。
连带：console.test「TAB_ALIAS compat」用例改用 retention 等价验证；bridge.test「normalizes tab-level compat」security 断言改为 identity（bridge 实测行为随 to 自动正确）。

七条落点活体读数（9122=466e2d2b 代次裸路径=App Routes 语义；ego 探针）：/duty→/overview+ov6-page(值班台 pane)；/tasks→/work?tab=board+tsk4-board(任务 pane)；/settings→/system?tab=defaults(默认设置 pane)；/events→/system?tab=events(审计事件 pane)；/calendar→cal-page；/integrations→int-page；/forms→frm-page；/system?tab=security→pathname 保持+sec5-page=1（paneTab=- 即 App 拦截生效非 events）。注意发现：PRD `#/…` hash 形式走 bridge，unknown hash（如 #/tasks）按 PRD §7 回落 /overview=冻结设计，本单不动；七条落点判据以裸路径为准。

门禁：assert-ia 两模式 exit 0，routes 51/tabs 22/chatHosts 1/modules 8；定向 shell 5 files/38 passed。

## R39 拦车②：employees 强制态 rid 同源透传（2026-11-20 04:2x，lane/console-appr）

现场：?state=error 时 rid 读取散在 effect 体内的 `params.get("rid")`（state 提成了 `forced` 标量、rid 没有），effect deps 不含 rid → 同一挂载内 rid 变化不重取；活体「不显示」的另一半成因=9122 代次（466e2d2b）的 /employees 仍挂 legacy 页（本 lane 挂载修复 c640124a 在该代次之后），模块真实行为以 jsdom 挂载链为准。

修法（modules/employees/**）：`const forcedRid = params.get("rid")` 与 `forced` 同源声明，effect 内改用 forcedRid、deps=[q,lifecycle,reload,forced,forcedRid]。?state=error&rid=X 上屏「请求编号：X」+req-copy 可复制钮+重试钮。

测试：EmployeesModulePage.test 新用例 forced ?state=error&rid= 显示该 rid、可复制、显重试；且 rid 改 fs-88 即刷新（同源）。坑：MemoryRouter initialEntries 不随重渲染更新——render() 改为每次重建 root（与 R32 console.test 同坑，已在文件注释）。定向 employees 11 passed；assert-ia 两模式 exit 0（51/22/1/8）；全量 131 files/1347 passed。活体复测待含挂载修复的下代次。

## R40 任务详情深链 + 详情字段真数据（2026-11-20，lane/console-appr）

基线：fetch + reset --hard origin/lane/hermes-console = 53543118（ledger on d0b505907ddc，entry CmkaMZfk），toplevel ✓ porc=0。

深链（要求①）：App.tsx 于 /tasks Navigate 后新增**一条**路由映射 `<Route path="/tasks/:taskId" element={<TasksBoardConsolePage />} />`（更具体路径自动优先；routes.ts/registry/manifest 零改动，assert-ia 两模式实跑仍 51/22/1/8 exit 0）。模块内 selected 改为 URL 派生：深链模式=pathname /tasks/<id>（decodeURIComponent），看板模式=?task= 参数；打开=openTask（看板 push ?task= 进历史→浏览器 back 关抽屉、再 back 回看板；深链内互跳走 /tasks/<id>）、关闭=closeTask（看板删 param 留历史，深链→/work?tab=board）。刷新/分享保态：同 URL 重挂直接重开详情（新用例实测 /work?tab=board&task=… 与 /tasks/tsk_open_1）。

详情真数据（②字段现状+本轮补齐）：标题=ready 时真 `<Link href=/tasks/<id>>`（testid=tsk4-detail-link，完整 id 进 title）；负责人 actorLabel 姓名·8位短码/human→人员/未指派（既有）；优先级 priorityLabel（既有）；状态未知→「待核实」（statusLabel default 既有）；创建/更新/截止 BJT 到分 beijing()（既有）；成本只认 ledger：真 0 $0.00、缺失「—」+title 原因（既有）；**来源缺=「未接入」+title「后台没有回传这条任务的来源信息。」**（tasksBoard.sourceLabel「—」→「未接入」+字段带 title）；最近事件 ≤3 条或「无事件」+title（既有）。旧 note 文案「当前版本没有按任务的深链」已随深链上线改为诚实新句（不存在不诚实文案）。

四态/错误（③④⑥）：?state= 在详情上**换内容面**——loading 骨架卡、error/empty/denied 直接 setDetail 对应卡不 fetch（tsk4-detail-error 人话句+RequestIdCopy 可复制 rid（rid=fs-9 实测）+重试钮 tsk4-detail-retry **始终显示**含 403/404）；denied 与 404 同体（detailError 既有锁，无 agent-api 路径回显）。零写入口：详情尾新增迁移钮 data-planned="true"+aria-disabled+title「状态迁移待写入车间接线后开放」（tsk4-detail-transition，disabled 实测）。

坑：JSX 文本内「<编号>」被 Babel 当标签解析→文案改「/tasks/ 加任务编号」；forced 分支编辑时勿吞 `let alive = true`。

验证：定向 tasks 2 files/21 passed（原 17+新 4：深链直开/URL+刷新保态/forced 三态内容切换/来源未接入）；tsc -p 本域零红；assert-ia 两模式 exit0 51/22/1/8；全量 **131 files/1372 passed**（≥基线 1347）。⑦三档横溢=jsdom 不可测，形态学沿用既有 dl sm:grid-cols-2 xl:grid-cols-3 + truncate + flex-wrap（如实报）。9122=d0b50590 代次禁重建：深链活体读数待下一代次，本轮 jsdom 挂载链实测为权威。

## R40 唯一产品 FAIL 次 owner（appr 侧配证）（2026-11-20，lane/console-appr）

背景：`/employees?state=error&rid=<码>` 活体不上屏可复制编号；主因=shell/fixtures 强制态丢 rid（gov 修），次因=模块 rid 只读 router params 快照，壳层覆盖后即被饿掉。本单只做模块侧保证（写域 employees/**+DONE；未动 App/shell）。

修法（EmployeesModulePage.tsx）：①`forcedRid = params.get("rid") ?? params.get("requestId") ?? liveRid()`——liveRid() 从 window.location 实读（search 与 hash 两容器都扫），不依赖任何被覆盖前的路由快照；取不到仍走诚实 fallback 句，绝不编编号。②四态卡片锚点补齐：error/denied 的重试按钮带 data-testid（employees-error-retry/employees-denied-retry，与 rid 复制件同屏可指认）；error rid 行既有 RequestIdCopy（req-copy）不动，denied 403≡404 同体既有。

新断言（EmployeesModulePage.test.tsx，R40 用例）：window URL=…&rid=live-42 而路由条目只带 state=error → 卡上屏 live-42、req-copy 存在、点击后 clipboard.writeText 收到的值=上屏值（回环一致）、req-copy-state=已复制、employees-error-retry 同卡、forced 下零 fetch。既有 R38/R39 用例（fs-77/fs-88 同源、同体、真实 500）全保留。

验证：定向 employees 2 files/12 passed exit0；assert-ia 两模式 exit 0（51/22/1/8）；tsc 本域零红；全量 **131 files/1373 passed**（基线 1372+1）。9122 未重建（R39 取证代次）：活体复测待 gov shell 修笔与下代次合并后一并核。

## R41 看板列分组与计数口径统一（2026-11-20，lane/console-appr）

基线：fetch + merge origin/lane/hermes-console → tip=8bbf8910（ledger on 53a3ef4c，entry BXJbyCwh），toplevel ✓ porc=0。写域=modules/tasks/**+DONE。

①计数口径：列头徽标 `N 条（本页已加载）`（title=排序键），空列仍「—」不计数为 0；汇总条与「仅显示本页已加载」尾注语义不变。②组内排序：PRIORITY_RANK（high/urgent=0，normal=1，low=2，未知=3）同列降序，次键 updatedAt 新→旧；排序键写进徽标 title（用例实测 high_new 首位、low_new 先于 low_old）。③空列诚实：文案改「本列暂无任务」，带负责人筛选时追加「（当前正按负责人筛选，清空筛选或换一位负责人可见更多）」；testid=tsk4-emptycol-<status>（命名避开 ^tsk4-col- 前缀——该坑已记）。④筛选与列计数联动：视图语义拆开——status 筛选=单查询钻取面板（P2 形态，panelActive），**assignee 筛选保留五列**并把 assignee 原样传给五腿（loadBoard(assignee) 追加 `&assignee=employee:<id>` BFF 白名单参数），列头计数随筛选结果真实联动；URL ?status=&assignee=&cursor= 保态不变（刷新/back 沿用 R32/P2 机制）。⑤四态/错误：board error/denied 卡 rid 由纯文本换 RequestIdCopy（req-copy 可复制，缺号=fallback 人话句），重试按钮 denied 也保留（data-testid=tsk4-retry，权限可能变化非死控件）；既有 `请求编号 req-tasks` 断言同步为 `请求编号：`（RequestIdCopy 冒号形制——同 tasks detail R40 口径）。⑥三档横溢：徽标句变长仍在 flex items-center justify-between gap-2 内，列网格 min-w-0 不变；jsdom 不可测，形态学如实报。

测试：定向 tasks 2 files/24 passed（+3 新用例：assignee 五腿联动+列计数+空列提示+面板不出现；列内排序键；denied 可复制 rid+重试非死控）。P2 空态用例入口补 status=open（面板语义只随 status）。全量 **131 files/1387 passed**（≥基线 1373）；assert-ia 两模式 exit 0（51/22/1/8）；tsc 本域零红。9122=53a3ef4c 代次禁重建（R41 取证中），活体列读数待并入后代次复测。

## R41 唯一 FAIL 修复：ov6-asof 取最新源值（2026-11-20，lane/console-appr）

基线：checkout lane/console-appr + fetch + reset --hard origin/lane/console-appr + merge origin/lane/hermes-console（b71c4535 代次 ledger 已含），toplevel ✓ porc=0。

根因与修法（腿②）：
- 实际挂载面 `modules/duty/DutyPage.tsx` 主返回 ov6-asof IIFE（原 708-725：todayStats 优先、stats 次之的 **?? 优先级语义**，非「最新」；其余源不参与）→ 改为五源聚合（今日运行统计/运行窗口统计/近14天统计/当日成本账本/审批统计，行号 708-746）：任一 ready 源带 asOf/generatedAt 即候选，取 Date.parse 最大值上屏「采集时刻 北京时间 X」；全缺=「采集时刻 —（北京时间）」+title 逐个列出未返回采集时间的来源名。零编时（不读客户端 fetch 时间）。
- `modules/overview/OverviewPage.tsx` AsofLine（行 49-73）：原「sort 后取最早」→ 取最大；缺值文案统一「采集时刻 —（北京时间）」，title 保留人话原因。
- 八卡 ov6-<card>-stamp 零改动（工单③）。

自证读数：dutyPage.test 新 2 用例——部分源有 asOf（run-stats 11-18 / budget-usage 11-20T05:20Z / approval-stats 11-19）→ 上屏「采集时刻 北京时间 2026-11-20 13:20」（最大）+title 含「最新的一个上屏」；全缺 → 「采集时刻 —（北京时间）」+title 含「未返回采集时间的来源：今日运行统计…」。OverviewPage.test 既有夹具（approvalStats 04:24Z 最新）断言精确「2026-11-19 12:24」。定向 overview+duty 4 files/61 passed exit0；assert-ia 两模式 exit0 51/22/1/8；全量 131 files/1389 passed（基线 1387+2）。9122==b71c4535 取证代次未重建：活体 ov6-asof 读数待并入后代次。

## R43 员工详情「任务」区真数据（2026-11-20，lane/console-appr）

基线：显式 refspec fetch + reset --hard origin/lane/hermes-console = d26a66d5（ledger at 01175128，entry BgiPXYqY），toplevel ✓ porc=0。写域=modules/employee-detail/**+DONE（App/shell/routes 零改动）。

实现（EmployeeDetailModulePage.tsx）：mapShellZone 的 `case "tasks"` 由借用 approvals 改为独立 tasklist 区（导航五区不变，chat 区先例形态）；TasksZone 四态齐（ed5-zone-tasks-loading/denied/error/empty/list，ZoneError 人话+RequestIdCopy(req-copy)+重试同卡；403≡404 同体 DENIED_COPY 不回显路径）；行族=ed5-zone-tasks-row-<taskId>/ed5-zone-tasks-name-<taskId>（真 a[href="/tasks/<taskId>"] 可聚焦，深链 R40 已挂载；无标题行回落「任务 · 短码」，裸 tk_ 不上屏，完整 id 进 title）；列=标题/状态人话（statusLabel SSOT 从 modules/tasks/tasksBoard 只读 import，未知=待核实）/优先级（priorityLabel，缺=未定级）/更新时间 beijing() BJT 到分；空集=「该员工暂无任务。」+「不放宽筛选来凑数」+筛选口径提示；尾注只读零写入口。

BFF 关键读数（9122==01175128 活体，只读）：工单点名 URL `GET /api/tasks?employeeId=emp_86A8…&limit=20`→200 n=20，但换一个员工 `employeeId=emp_217A…`→**同 200 n=20 同首行**=employeeId 不在 BFF passthrough 白名单（server.py:380-392 现查=(assignee,status,dueBefore,limit,cursor)）且被静默忽略、未过滤；对照真过滤腿 `assignee=employee:<id>&limit=20`→200 n=10（该员工）与 200 n=0（另一员工）=服务端真收窄。⇒ 页面查询=**/api/tasks?assignee=employee%3A<id>&limit=20**（诚实归属口径），employeeId 参数形态按工单要求如实上报，禁假过滤。

测试：既有 3 用例入口由 at("tasks")（旧借 approvals 映射）改为 at("approvals")（语义=审批区本尊，断言文本零改动）；新增 R43 describe 4 用例：①真查询带 assignee=employee%3A<EMP>+limit=20、行 href=/tasks/tk_0762C4D5、待处理/待核实/高优先级、BJT 10:00/09:30、无标题行=「任务 · 1B4EA3C9」（用 tasksBoard.short8 全站口径——坑：模块自研 shortCode 会把 tk_ 计进短码=TK1B4EA3，已换 short8）②空集诚实句+不放宽筛选+面板卡不渲 ③error=人话+请求编号：req-tsk-43 冒号形制+req-copy+重试同卡（坑：querySelector("button") 先命中复制钮，断言改 some(含「重试」)；**同一 it 内二次 mockApi+renderAt 不会重发请求（useResourceList deps=[url,nonce] 未变）=403≡404 必须拆独立 it（root 重建习语）**）。定向 employee-detail 26 passed exit0；assert-ia 两模式 exit0（51/22/1/8 未动）；tsc 本域零红；全量 **131 files/1399 passed**（≥基线 1387）。

三档横溢：jsdom 不可测，形态学=行网格 grid-cols-1 md:grid-cols-[1.8fr_.8fr_.8fr_1fr]+min-w-0 truncate+列头 md:grid（与 chat 区同构已验），如实报。9122 取证代次禁重建：活体行读数待并入后代次。

## R45 员工详情身份卡区（2026-11-20，lane/console-appr）

基线：显式 refspec fetch + reset --hard origin/lane/hermes-console = **f0419b0b**（ledger stamped at 02a7385c，entry DmuaaNyX），toplevel ✓ porc=0。禁面零触碰（App/shell/routes/registry/package·lock/web-scripts/ops 未动）。

BFF/数据面现查：GET /agent-api/api/employees/<id>（server.py EMPLOYEES_DETAIL_PREFIX 片段路由）活体 200 keys=[id,tenantId,name,title,lifecycleState,currentVersionNo,ownerUserId,createdAt,updatedAt,revision,department,duty,asOf]——**响应没有 reportsTo 类字段**（汇报对象按缺值处置，禁编造）。模块 overview 腿 useOverview 本就走该端点（真数据既有），四态/可复制 rid（RequestIdCopy「请求编号：」冒号形制+req-copy）/重试/403≡404 既有分支既有测试锁。

实现（EmployeeDetailModulePage.tsx，写域内）：OverviewZone ready 返回新增 **IdentityCard**（testid=ed1-identity，包在 ed5-overview-wrap 内、原 ed5-overview 六行 dl 原样保留=ed5-*/apr5-* 零破坏）。六字段：ed1-identity-name（缺「—」+title「后台没有回传这位员工的姓名。」）/ code（shortCode(empId) 8 位大写码、title=完整 id，屏上无裸 emp_）/ role（title|role|position 多键回落，缺「—」+title）/ state（lifecycleLabel 外层映射：未知→「待核实」，title=原始值；原 lifecycleLabel 未动）/ reports（reportsTo|reports_to|managerEmployeeId|manager 多键；有值=真 a[href^=/employees/] 可聚焦，label=「姓名 · 短码」，title=原值；无值=「—」+title「后台没有回传这位员工的汇报对象。」）/ created（createdAt|created_at→beijing() BJT 到分，缺「—」+title）。无 `?? 0`/无占位假值。⑦三档横溢=jsdom 不可测，形态学报（dl sm:grid-cols-2 xl:grid-cols-3+truncate+min-w-0）。9122=02a7385c 代次禁重建：页面活体卡读数待并入后代次（本轮只读探了 API 面）。

测试（EmployeeDetailModulePage.test.tsx，R45 describe 3 用例）：真 body 六字段读数（name/code=A3F1B2C4/role/在岗/created=2026-11-14 06:15/reports=—+title）；reportsTo=employee:emp_BEEF…+reportsToName → a[href=/employees/emp_BEEF0000…] text=主管 · BEEF0000 title=原值；weird_state→待核实+四缺字段「—」+title 含「后台没有回传」+屏无 ??0/undefined/null。定向 employee-detail **29 passed**（26 既有+3 新）exit0；assert-ia 两模式 exit0（51/22/1/8）；tsc 本域零红；全量 **131 files/1403 passed**（≥基线 1401，如实报）。

## R44 审批队列筛选与 URL 可分享（2026-11-20，lane/console-appr）

基线：显式 refspec fetch + reset --hard origin/lane/hermes-console = f0419b0b（ledger stamped at 02a7385c，entry DmuaaNyX），toplevel ✓ porc=0。写域=modules/approvals/**（落点=history 页：只读+已有筛选=工单「深度增强不加新页」的既有面；pending 页写区是先前已验收功能，未动）。

实现（ApprovalsHistoryModulePage.tsx）：①新组 data-testid=apv5-filter（role=group）=四快捷钮 apv5-filter-status-{all,pending,approved,rejected}（人话「全部/待办/已批/已拒」），sends 真 status 值走既有 choose→URL ?status=→useApprovalsList 恰一次重取（新用例实测 fresh filter api/approvals =1 条带 status=rejected）；active 态与八态组同源（?status=pending 重放时 apv5 快捷钮与 apr5-filter-pending 同时 aria-pressed=true）。②apv5-count=ready 期 {list.rows.length}，与「已显示 N 条」同变量同元素树=计数与列表同源（pending 重放=1 且读数行 1 条实测一致）。③风险档 apv5-filter-risk 与时间窗 apv5-filter-window=**控件在屏但 disabled+title 人话带活体读数**：BFF passthrough=(status,limit,cursor)，risk/window/since 实测被丢（status=all 下 8 条同集合，带参不带一致）——前端假过滤被工单禁→按 P2 priority 先例诚实禁用，DONE/回执上报。④空集文案按工单=「该条件下无审批：「X」结果下没有记录」（既有两用例断言同步），清筛选去处（换结果/全部+exits-back/exits-contact 真出口）既有保留。⑤apr5-* 现名族零改动；URL 刷新/复制链接复现=既有 replace 机制+新组共用；四态/403≡404/可复制 rid+重试=既有形态未破坏。⑥三档横溢=jsdom 不可测，形态学报（新组复用 flex-wrap gap-1.5 容器）。

验证：定向 approvals 3 files/57 passed exit0；assert-ia 两模式 exit0（51/22/1/8，未动壳层）；全量 **131 files/1401 passed**（≥基线 1399）。9122==02a7385c 取证代次禁重建：活体 DOM 读数待并入后代次，本轮 jsdom+ego 参数探测双交付。

## R46 审批详情「决策链路与证据」（2026-11-20，lane/console-appr）

基线：**按单 merge（禁 reset）** origin/lane/hermes-console=f0419b0b 系 Already up to date（tip e1ea2504 已含），toplevel ✓ porc=0。

落点：`/approvals/:id` 无独立路由→按工单预案用既有点开详情形态（?id= URL 保态既有：selected 初值 params.get("id")，分享/刷新可复现）；ApprovalDetailBody 尾部（apd5-replay 之后、技术折叠之前）新增 **DecisionTrail（views.tsx，apd6-* 族）**，pending/history 两页共用同一组件。

链路形态：`apd6-trail`（ol，标题注明「节点顺序即服务返回顺序」，禁前端重排）→ `apd6-step-submitted`（提交·申请人·submitted BJT 到分；缺=该段无记录+title）→ `apd6-step-node-<i>`（节点 N·审批人（actor 人话，title=whoRaw）·verdict 人话（既有口径 approve=「通过」）·时间缺=该段无记录+title·意见原文缺=「未填」）；decisions 空=单行 `apd6-step-nodes-none`「该段无记录」；未行动审批人= `apd6-step-pending-<i>`「X·待办·该段无记录（该审批人还没有给出决定）」（labels 与 decisions.who 字符串差集）；终态= `apd6-step-final`（status.label+decided，title=status.raw）。关联段 `apd6-step-links`：run/task **有值才渲真 a[href]**（`apd6-link-run`→/runs/<id>、`apd6-link-task`→/tasks/<id> R40 已挂深链；model.ts ApprovalDetail 新增 runId/taskId 多键解析）；无值=该段无记录+title；证据段=恒「该段无记录」+title 活体实证——**ego 只读探测（9122==02a7385c 系）：GET /api/approvals?status=all&limit=8→200 行 keys 无 runId/taskId/evidenceId（runLinks=0/8）；GET /agent-api/api/approval?id=ap_123…→404 console.unknown_route=详情读口本代次未开放**，jsdom 为链路行为权威，页面活体读数待 BFF 开放详情读口与并入后代次。

不破与门禁：apd5-*/apr5-*/apv5-*/ed* 零改动（既有 57 用例全绿）；四态/可复制 rid/403≡404/零写入口=宿主页与 detail 既有分支既有锁；三档横溢=jsdom 不可测，形态学沿用既有 flex-col break-words（如实报）。新测试 2 用例：①链路顺序/pending 段/缺段人话/无裸 human:emp_②runId/taskId 真 href+意见原文。

验证：定向 approvals 3 files/59 passed exit0；tsc 本域零红；assert-ia 两模式 exit0 51/22/1/8；全量 **131 files/1406 passed**（基线 1404+2）。

## R47 员工详情跨区一致性（2026-11-20，lane/console-appr）

基线：显式 refspec fetch + merge origin/lane/hermes-console（f0419b0b 系=Already up to date @84ccdb26），禁 reset 遵守——已推笔全保，toplevel ✓。

改动（modules/employee-detail/EmployeeDetailModulePage.tsx，approvals 侧零改动）：
① **返回保参**：header 加 `edx-back` 返回钮=真 `navigate(-1)`（useNavigate），title 注明「返回上一页（保留列表筛选条件）」；实测证据=测试栈 ["/employees?q=%E5%B0%8F%E9%B2%A4&lifecycle=active", /employees/<id>] 点返回后 location.search 原样=`?q=%E5%B0%8F%E9%B2%A4&lifecycle=active`（SearchProbe 写 DOM dataset）。直开无历史栈时页内 notfound/Link 出口兜底。
② **denied 相 rid 统一**：Resource/OverviewState denied 形态加 `requestId: string|null`；toResourceError 403/404 与 useOverview setState denied 两处捕获 `api?.requestId ?? null`；ZoneDenied 组件加 RequestIdCopy 行（同一复制组件 req-copy/req-copy-state 可见反馈，fallback=「本次请求没有带回编号；可复制时间与页面路径反馈。」），七个区（tasks/chat/capability/approvals/runs/audit/overview）全部传参；实测=403 requestId=req-d-1 上屏+复制回环 clipboard 值一致+「已复制」。
③ approvals 侧判定：states.tsx 自制复制件已含可见反馈（apr5-copy-state 已复制/复制失败）与「请求编号：」同形制；apr5-request-id/-missing 三处测试引用不可破→**不动文件，行为口径等价**（本轮 approvals 59 passed 零影响）。
④ 缺读口区（capability/audit）：GAP 编号仅 title+「尚未接入」句既有，未造假；③三档横溢=形态学报（header flex-wrap gap+truncate 既有，jsdom 不可测）。
⑤ testid：ed1-identity-*/ed5-zone-tasks-*/apd6-*/apr5-*/apv5-* 零改动；新增=edx-back + ZoneDenied 内既有 req-copy 家族。

坑（记档）：该测试文件 react-router import 原为 MemoryRouter,Route,Routes——先 sed 读现场再加 useLocation；forbidden() 助手不带 requestId，用例内直接 new ApiError(status 403, requestId)；renderAt key={entry} 单入口测不了回退，需双 entries 栈 helper。

验证：定向 employee-detail 3 files/32 passed（+3 R47 用例）、approvals 3 files/59 passed 零影响；assert-ia 两模式 exit 0（51/22/1/8，未动壳层）；tsc 本域零红；全量 **131 files/1409 passed**（基线 1406+3）。9122=02a7385c 禁重建：活体回退保参读数待并入后代次，本轮 jsdom 栈实测为行为权威。

## R48 员工详情运行区（2026-11-20，lane/console-appr）

基线：显式 refspec fetch + merge origin/lane/hermes-console（Already up to date @71870656），未 reset，已推笔全保；toplevel ✓。

参数实测（ego 只读，9122=02a7385c 代次）：/agent-api/api/runs 白名单=(employeeId,status,since,limit,cursor)（server.py 现查）；`?employeeId=emp_86A8…`→200 n=13；换 `?employeeId=emp_217A…`→200 n=0（**真按员工过滤实证**，筛前筛后差集）；`?employee=`→400、无员工参→400（只吃 employeeId，禁假筛选无语义空转）。区腿沿用既有 `employeeId=${enc}`（本单前已正确），无越域。

实现（EmployeeDetailModulePage.tsx）：①每行真深链 `a[href=/runs/<runId>]`（encodeURIComponent；无 ref 才退 /runs）——既有 runs 用例 href 断言同步 /runs/run_X1Y2Z3。②新「耗时」列=runDuration(startedAt,endedAt)：双真才算「12 分钟/x 小时 y 分」，缺 endedAt=「—」+title「运行还没有结束（或未回传结束时间）」，不估不编；readRuns/RunRow 加 endedAt 多键（endedAt/ended_at/finishedAt/completedAt，活体 row0 实证 endedAt:null）。③短码：shortCode 剥前缀字符类补 `rn_`（活体真 id 形态=rn_01M7…，原 regex 只认 run_ 会把 rn 计进码）；屏上「运行 · 01M7D742」+title 全 id，无裸 rn_/run_。④runStatusLabel 未知态「状态未知」→「待核实」（旧文案无测试引用，实测 teleporting→待核实且原值不上屏）。⑤空集文案按工单=「该员工暂无运行记录。」+「按 employeeId 筛选的真实结果…没有拿别人的运行凑数」。⑥成本列既有 money() 天然区分真 0=$0.00 / 缺失=「—」（活体行有 costStatus:unknown 无 costUsd=真实缺失路径）。⑦testid：新增 ed7-runs-link-<i>/ed7-runs-code-<i>/ed7-runs-duration-<i>/ed7-runs-cost-<i>；ed5-*/ed1-*/edx-*/apd6-*/apv5-*/apr5-* 零改动（既有 ed5-zone-runs-* 名全保留）。⑧四态/denied rid 可复制/重试/403≡404=R47 统一件既有；③三档横溢=形态学报（6 列全 minmax(0)+truncate，手机档 grid-cols-1 堆叠，同 tasks 已验形态）。

坑：href= /runs/<id> 深链落地页 = /runs/:runId 路由不在本树 App（只读核过，仅 path="/runs" 列表；写域外禁碰 App）——href 带真 id 满足工单判据，点后进兜底面属壳层待接线项，DONE 记账；测试 mock 变量名=fetchJSON（本文件无 mockFetch）。

验证：定向 employee-detail 33 passed（+1 R48 用例、1 处既有断言按工单同步）exit0；assert-ia 两模式 exit0（51/22/1/8）；tsc 本域零红；全量 **131 files/1410 passed**（基线 1409+1）。9122 代次禁重建：运行区活体行读数待并入后代次，本轮 jsdom+API 双实测为权威。

## R48b 运行区死链修正（2026-11-20，lane/console-appr，≤25min）

L0 判 /runs/<id> 无路由=死链（routes.ts 只有 /runs）。禁碰 shell/App，改法=ed7-runs-link href 改 `/runs?run=<完整id>`（EmployeeDetailModulePage.tsx:1196）。

活体实证（ego 只读，9122==02a7385c）：无参 /runs → 「本页 13 次…」且 run5-detail=false；带 ?run=rn_01M7D7421P5PA27TEXMT9YVDZ8 → **run5-detail=true 且卡文=「运行 · VDZ8运行中 · 开始 2026-11-14 22:24 · 耗时 128 小时 33 分钟」**（VDZ8=该 id 尾码=确为参数对应运行）→ 参数生效，无需退 span。testid 不变；两处用例断言同步（=/runs?run=run_X1Y2Z3 与 =/runs?run=rn_01M7…）；屏上无裸 id 断言保持（href 属性不计 textContent）。

验证：定向 employee-detail 33 passed；全量 131 files/1410 passed；assert-ia 两模式 exit0 51/22/1/8（未动壳层）。commit fix(console): employee runs rows link to supported run param。

## R49 员工详情「审批」区（2026-11-20，lane/console-appr）

活体实测（ego 只读，9122==02a7385c）：/api/approvals?employeeId=emp_86A8…&limit=50→200 n=8；employeeId=emp_217A…→200 n=8 同首行 ap_123DE49B…（expired/high）=**employeeId 不过滤**；bare→200 n=8 同集合；assignee=employee%3A…→200 n=8 同（BFF inject_assignee：客户端值一律忽略，按登录者注入）；status=pending→200 n=0（status 真参数有效）。server.py passthrough=(status,limit,cursor)+all_statuses。

实现（EmployeeDetailModulePage.tsx）：①区腿 line667 由假筛选 `?employeeId=` 改诚实聚合 `?status=all&limit=20`（同请求出计数，无重复腿）。②说明行 ed8-appr-note「审批读口暂不支持按员工筛选：以下为当前登录身份的全部状态审批。」title 带白名单+注入口径实证（GAP 仅 title）。③四列表=事项标题｜状态人话（approvalStatusLabel default→「待核实」）｜风险档（riskLabel：high/medium/low→高/中/低风险，缺「—」+title，未知值「待核实」+title 原值不猜）｜更新时间 BJT 到分（updatedAt 多键 decidedAt/changedAt，缺→回退提交时间+cell title 注明）。④行出口真链 href=/approvals?status=<行状态>（既有可达落点保筛选；无详情路由不为造链而发明）；ed8-appr-row/link/title/status/risk/time-<i> 族新增，ed5-approvals-* 现名全保留；金额列按四列规格移除（解析器字段留）。⑤空集=「当前没有审批事项」+「按你的登录身份返回（全部状态）下的空集，不是把缺失当 0」——工单句「该员工暂无审批事项」在不支持筛选实证下不诚实，按工单诚实条款取代。⑥四态/可复制 rid/403≡404=Zone* 既有（R47 线）。

测试：既有两断言同步（href 带 status、金额断言删、空态新句）+R49 新用例（恰 1 fetch 无 employeeId、note 上屏、行 0/行 1 四列读数、待核实×2、无裸 apr_/emp_/human:）。定向 34 passed；全量与 assert-ia 读数见回执。⑦三档横溢=jsdom 不可测，形态学报（grid 全 minmax(0)+truncate+flex-wrap 说明行）。9122 禁重建：页面活体读数待并入后代次；API 面五组实证已贴。

## R50 审批队列汇总条 apv6-*（2026-11-20，lane/console-appr）

基线：显式 refspec fetch + merge origin/lane/hermes-console（wave-16 6a02ed58）→ merge tip 5cea8f7e，toplevel ✓ porc=0。

实现：新文件 modules/approvals/QueueSummaryBar.tsx（只读，计数全部由**列表同一请求结果** rows 现算，零重复请求）。①状态桶=待办/已批/已拒：history 视图 status 缺省(聚合)时按 row.status.raw 真计数（夹具 8 态各 1 行→待办1/已批1/已拒1 实测）；单选状态时其余桶=「—」+title「与这份结果不同源；切回全部可见」（禁假 0）；queue 视图只读 pending 集合→待办=rows.length、已批/已拒=「—」+title 指向决策历史。②风险档桶=高/中/低：row.risk（model.ts ApprovalRow 新增 risk=riskView(pickText(riskLevel/risk_level/risk))，行解析增量、既有字段零动）现算；读口不支持 risk 参数（R44 实证被丢）⇒风险桶只读 span 不建链（禁假筛选），title 写明。③点状态计数=Link /approvals?tab=history&status=<值>（写既有 ?status= 筛选，history 消费，URL 同源刷新/分享可复现）。④phase loading/error/denied → 全桶「—」+人话原因 title（不作 0）。⑤挂载=两页顶部（pending 页 aria-live 读数行前、history 页读数行与 apr5-filter 组之间），flex-wrap gap 无横溢（形态学报）。testid：apv6-summary / apv6-summary-<status> / apv6-summary-risk-<level>；apv5-*/apr5-*/apd6-*/ed* 零破坏（既有 59 用例先绿后加 2 新用例）。

验证：定向 approvals 3 files/61 passed exit0；tsc 本域零红；assert-ia 两模式 exit0（51/22/1/8）；全量 **132 files/1456 passed**（≥基线，含 wave-16 合入用例）。9122==6a02ed58 代次未重建（L0 取证窗）：活体汇总条读数待并入后代次；本轮以 jsdom 实测为权威。

## R51 员工详情区导航条 edz-nav-*（2026-11-20，lane/console-appr）

基线：957bba3e 上续交（wave-17 持窗核可，现网代次 6a02ed58/章 5d91f22d/entry CpeSWPtM——回执引用已更正）。写域=modules/employee-detail/**+DONE；App/shell/routes/registry 零动。

实现（EmployeeDetailModulePage.tsx）：在既有五区条（ed5-tabs 原样保留=深区条）之上新增四区直达条 `edz-nav`：总览/任务/运行/审批，NAV_ZONES 词表；每项=真 Link role=tab → `/employees/<id>`（总览裸路径）或 `?zone=tasks|runs|approvals`（mapShellZone 既有映射，任务区=?zone=tasks→tasklist 视图），当前区 aria-selected=true+panel 高亮；直达/粘贴 URL=同一 zone 派生链路（sp.get("zone") 既有）；reachable 判定防御分支=不在接线词表时渲 aria-disabled span+title「尚未接线，不提供假入口」（本四区实测全部可达=分支未触发，DONE 如实）。键盘=Link 原生 tab 序+focus-visible outline 类（焦点可见）。请求面：各区腿本就 `zone === X` 条件挂载，无预取。

自证读数（jsdom 实测）：切区只取该区数据=?zone=runs 挂载 urls 中 /api/runs=1 条、/api/tasks|/api/approvals|/api/audit|/api/console-sessions=0；?zone=tasks 挂载 /api/tasks=1 条、/api/runs=0。四 tab 全为 A 标签、aria-disabled=null、href 真值、tasks 高亮时 overview=false。既有「five tabs」用例断言**作用域收窄到 ed5-tabs 容器内**（语义保持：五区词表原样），非删断言。

验证：定向 employee-detail 36 passed exit0（+2 新用例，其余零改绿）；assert-ia 两模式 exit0 51/22/1/8；全量 **132 files/1458 passed**（基线 1456+2）；tsc 本域零红。ed1/ed5/ed7/ed8/edx/apd6/apv5/apr5/apv6 全族零破坏（既有用例全绿为证）。

未测项：9122 活体导航读数（禁重建，待下代次）；三档横溢=jsdom 不可测，形态学报（flex-wrap gap-1 容器+文本短标签，与 ed5-tabs 同构）。坑记：R50 回执曾出现「4s 超时后 ls 截断看不到落盘行→误判未投→重投」=同单双落盘（070630/070817），教训=超时后必须完整 ls 或按内容 grep receipts 目录再判，禁止凭截断输出重发。

## R52 员工详情会话区（2026-11-20，lane/console-appr）

基线：显式 refspec fetch + merge origin/lane/hermes-console → 97df94a0（代码代次 6a02ed58/章 5d91f22d），toplevel ✓ porc=0。

活体实测（ego 四组，9122==6a02ed58 仅访问）：/api/console-sessions?employeeId=emp_86A8…&limit=20→200 n=0；employeeId=emp_217A…→200 n=0；bare→200 n=0；employee=…（非白名单键）→200 n=0。server.py passthrough=(employeeId,limit,cursor)=**employeeId 是白名单参数被接受**；当前部署面对所有员工均 0 会话（筛前筛后无行可对照）⇒工单「暂不支持按员工筛选」条款不触发，区头与空态写诚实句：请求带了该员工的 employeeId（白名单参数），这是服务端真实空集，不是加载失败；GAP 现状仅 title。

实现（EmployeeDetailModulePage.tsx）：①ZoneId/mapShellZone 加 "sessions"（chat 区 ed5-zone-chat-* 全不动=零破坏）；reload 加 sessions。②sessions leg=`/agent-api/api/console-sessions?employeeId=${enc}&limit=20` 条件挂载（zone 进入才取数）；复用 readSessions 并扩展 channel 多键（channel|source|platform|channelType）。③channelLabel 人话=飞书/企业微信/网页/控制台/接口；缺「—」+title「上游没有回传该会话的渠道信息。」；未知「待核实」+title 原值禁猜。④SessionsZone 四态内容面（ed9-sessions-loading/denied(403≡404 同体+可复制 rid+重试 Zone* 既有)/error/empty）+ready 四列表=会话短码（禁裸 cs_ 全值，完整 ref 进 title）｜渠道｜消息数（缺「—」+title）｜最近活动 beijing BJT 到分；行真 a[href]=/chat（App.tsx:299 全站唯一对话承载=既有可达落点，chatHosts=1 语义不破）；空集「该员工暂无可查会话。」；尾注只读+指路。⑤修 shortCode 剥前缀缺陷：补 cs|session（否则 cs_AAAA1111… 显示 CSAAAA11）。⑥三档横溢=形态学报（grid 全 minmax(0)+truncate+flex-wrap）；jsdom 不测三档。

测试：新 describe 2 用例（恰 1 fetch 带 employeeId+limit=20、四列读数、href=/chat、缺值—+title、无裸 cs_、无 data-chat-host；空集双句）。定向 employee-detail 38 passed exit0；tsc 本域零红；assert-ia 两模式 exit0 51/22/1/8；全量 **132 files/1460 passed**（基线 1458+2）。ed1/ed5/ed7/ed8/edz/edx/apd6/apv5/apv6/apr5 零破（既有用例全绿为证）。9122 禁重建：活体页面读数待并入后代次；API 面四组实证已贴。回执代次引用统一 6a02ed58。

## R53 /employees 列表搜索与筛选（2026-11-20，lane/console-appr）

基线：显式 refspec fetch + merge origin/lane/hermes-console = Already up to date @31e4292b（代码代次 6a02ed58），toplevel ✓ porc=0。冲突预警处理：modules/employees/EmployeesModulePage.tsx 已有 6e7f16ac 系「服务端 keyword/lifecycleState 真过滤+URL ?q=&lifecycle=」完整交付（测试 8 用例+真 href+空集出口）⇒本单=最小增量补 emp-list-* 锚点与语义注脚，不推翻重写、不新建本地过滤。

活体实测（ego 六组，9122==6a02ed58 仅访问）：/api/employees?limit=50 bare→200 n=3；q=QA2→200 n=3、query=QA2→200 n=3、name=QA2→200 n=3（三键均非白名单=丢参返全量）；keyword=QA2→200 n=1（真过滤）；lifecycleState=active→200 n=2（真过滤）。⇒工单「不吃则本地过滤+仅已加载 N 人内搜索」分支不触发：现实现本就走白名单键服务端过滤，零额外请求；scope note 写明真实语义并把三键实测均返全量的事实嵌进 title。

增量（EmployeesModulePage.tsx）：①header 计数 span→emp-list-count+title「计数与列表同源：同一份服务端返回的行数」。②筛选卡后 emp-list-scope-note（服务端真参数说明，禁本地假过滤语义）。③空集卡 data-emp-list-empty 别名+emp-list-empty-text（「没有匹配的员工」文案既有）；清空出口 employees-clear 既有。④ul data-emp-list-rows。emp-l-*/employees-* 现名零改动；其余各族 testid 零破（定向全绿为证）。

测试：新用例断言 scope-note+title 三键事实、emp-list-count=2 同源、setter 输入后 /api/employees 恰 1 次带 keyword=（请求计数实测锁，无本地额外请求）、空集双锚+清空回空。定向 employees 2 files/13 passed exit0；assert-ia 两模式 exit0 51/22/1/8；tsc 本域零红；全量 **132 files/1461 passed**（基线 1460+1）。三档横溢=形态学报（既有 flex-wrap+min-w-0 结构未改布局语义）；9122 活体页面读数待下代次。代次引用统一 6a02ed58。

## R54 审批队列 CSV 导出 apv7-*（2026-11-20，lane/console-appr）

基线：显式 refspec fetch + merge origin/lane/hermes-console = Already up to date @bfb38c5a，toplevel ✓ porc=0。

实现：新文件 modules/approvals/QueueCsvExport.tsx=纯前端导出，**零新后端端点**（测试实证=点击导出后 fetchJSON 调用计数不变）。①表头固定 `id,title,status,risk,updated_at`；行值全部取**屏上同一渲染口径**：id=row.rawId（缺空）、status=row.status.label（未知态=屏上「状态未识别/待核实」同源）、risk=row.risk.label（读口丢参的只读态照屏上值写，缺=「未标注风险」空串处理）、updated_at=row.clock（屏上同一 BJT 到分值；缺=空，禁补 0）。②RFC4180 转义实测：含逗号/引号标题→`「"预算, 含""引号"""」` 形态断言。③文件名 approvals-<tab>-<status|all>-YYYYMMDD-HHmm.csv，时间=**导出时刻北京时间**（+480min 纯格式化；两用例锁含跨日 16:05Z→次日 0005；屏上数据时间不受本机时钟影响——本机时钟仅命名文件名）。④Blob+a.download（URL.createObjectURL guard+revoke）。⑤同源计数锁=apv7-export-count「共 N 行」与列表 rows 同一变量；blob 断言 filter 非空后 9 段=header+8 行=屏上 8 行（pending tab=共 1 行同锁）。⑥空集=按钮 disabled+title「当前筛选下没有可导出的行」；输出带 \uFEFF BOM+\r\n（Excel 兼容，尾 CRLF split 空段坑已记测试断言 filter 处理）。⑦挂载=pending 与 history 两 tab 通用（QueueSummaryBar 之下/读数行后）。

apv7-export-group/export/export-count 新增；apv5/apv6/apr5/apd6/ed*/emp-list/employees 零破（定向 approvals 3 files/64 passed 全绿为证）。横溢=flex-wrap 形态学报（jsdom 不测三档）。9122==6a02ed58 禁重建：活体下载待下代次。验证：定向 64 passed；assert-ia 两模式 exit0 51/22/1/8；tsc 本域零红；全量 **132 files/1464 passed**（基线 1461+3）。

## R55 审批详情与队列双向保态（apd7-back）— 2026-11-20

工单：/approvals 列表→详情→返回，状态筛选/页码/滚动位置复原；详情给真「返回列表」出口；同一 URL 可分享直达；apv5/apv6/apv7/apr5 零破；testid apd7-* 新增。

实现（写域内最小增量，不改路由与注册表）：
- 新 `web/src/modules/approvals/BackToList.tsx`：`apd7-back` 按钮（「返回列表」，title 说明复原口径）+ `saveListScroll/restoreListScroll`（sessionStorage 键 `approvals-history-scroll|approvals-pending-scroll`，`window.scrollY/scrollTo`，try/catch 静默）。
- 两页（History/Pending ModulePage）：`openRow` 首行存滚动；`backToList` = setSelected(null)+setUnaddressable(false)+URL 仅删 `id`（保留 tab/status/其余参数，replace）+还原滚动；aside 详情区顶部在 `selected` 时渲染 `<BackToList>`。列表与 aside 并排、列表组件不 remount ⇒ 筛选、已加载分页游标（useApprovalsList nextRef 内存链）、时间窗原样保留。
- 粘 URL 直达：`selected=useState(()=>params.get("id"))` 既有（R17），本轮用例锁死。
- 取不到的诚实态：沿用 DeniedPanel/shapeFailure 既有同体句+可复制 rid（工单例句「该审批不存在或已过期」视为语义描述；不另改文案=不破 403≡404 同体既有断言）。

测试读数（定向 approvals 3 files/68 passed exit0）：
- case1 open→back：scrollY=123 存→back 后 `scrollTo` 收到 [0,123]、sessionStorage=123、`apv5-filter-status-pending` aria-pressed 仍 true、`apr5-row-ap_p` 在、`apr5-detail`=null。
- case2 粘 `/approvals?tab=history&id=ap_p`：直达渲 `apr5-detail`+`apd7-back`。
- case3 页码：加载更多入页2→开详情→返回→两行卡仍在且 `/api/approvals` 列表请求计数不变（零重取）。
- pending：队列点开→sessionStorage=66→`apd7-back`→回到 `apr5-detail-empty`。
- 全量 132 files/1468 passed（基线 1464+4）；assert-ia 两模式 exit0（51/22/1/8）。

坑（本单内修）：case1 初版 FAIL=自定义 handler 把 `ROWS_BY_STATE[state]`（本已是数组）再包 `[...]` →行解析失败无卡；改 `(ROWS_BY_STATE[state] ?? []) as unknown[]`。

挂账（非本单引入、本单写域外）：全量尾行带 `Errors 2`——`EmployeeDetailModulePage.tsx:1003/1028` 的 `api?.requestId` 是 71870656（R47 跨区一致性）在 useOverview 作用域引入的 ReferenceError（该 catch 形参名是 `err`，无 `api` 变量；tsc 因 ambient 未拦）。处置=403/404 分支应写 `err instanceof ApiError ? (err.requestId ?? null) : null`（1028 处可用 `r.requestId`）。employee-detail 不在 R55 写域，留待独立小单，勿并入本笔。

未测项：9122（==6a02ed58 代次，禁重建）活体滚动/返回读数待并入后代次；三档横溢=aside 既有 flex+min-w-0 形态学报（jsdom 不可测）。

## R56 P0 修单：useOverview catch 的自由变量 api（ReferenceError）— 2026-11-20

工单：`api?.requestId` 在 useOverview 两个 catch 中引用未声明的 `api`（该形参名是 err/err2），403/404 时 setState 抛 ReferenceError→unhandled rejection、档案态停在 loading。随 71870656（R47）进入 wave-16=6a02ed58 现网。

修法（仅两处，语义不变：403→denied、404/401→notfound/denied、其它→error）：
- L1003（detail 腿 403 分支）→ `requestId: err instanceof ApiError ? (err.requestId ?? null) : null`。
- L1028（matrix 回落腿 denied 且 status===404）→ `requestId: r.requestId ?? null`（r=toResourceError(err2) 已在作用域）。
- toResourceError 内部 L226/227/229 三处 `api?.requestId` 是其局部形参，合法不动。

验收读数：`git grep -n "api?\.requestId" -- web/src/modules/employee-detail` 修后仅剩 226/227/229；`npx tsc --noEmit -p tsconfig.json` 本模块 0 error；定向 employee-detail 1 file/40 passed（新增 R56 两用例=①ApiError.requestId=req-r56-403 时 ed5-overview-denied 上屏含该 rid+req-copy 可复制 ②无 rid 时显「本次请求没有带回编号」fallback，禁编造）；全量 132 files/1470 passed 且尾行不再报 Errors（原 2 条 unhandled rejection 即这两个旧用例打到坏 setState 所致，本笔清零）。

未动项：文案、testid、路由、其它模块零改动（本笔仅两行产品码+两用例）。9122==6a02ed58 现网仍带病（禁重建），修后活体读数待并入后代次。

## R57 — 员工详情成本区（ed10-usage-*，zone=usage）

- 基线：显式 refspec fetch + merge origin/lane/hermes-console = Already up to date @3f40f615；toplevel ✓ porc=0。代次引用 6a02ed58（章 5d91f22d）。
- 读口实测（ego 只读，9122==6a02ed58，八组）：/api/budget-usage required=(employeeId,period)，periodKind=day&period=2026-11-20→200 keys=[items,missingEmployeeIds,asOf,asOfSource]（当无行时 items=[] missing=[该 id]，asOf=2026-11-19T23:58:08Z source=bff-read-time）；month&period=2026-11→200 items=[{…,costUsd:0.121198…,tokensUsed:0,updatedAt}]；另一员工 emp_217A→items=[] missing 同形=employeeId 真过滤实证；缺 period→400 console.missing_param；periodKind=week→400 request.invalid_body。/api/run-stats passthrough=(from,to,employeeId,bucket)：无 from/to→400 request.missing_filter；bucket=month→422；from=2026-11-01&to=2026-11-21&bucket=day→200 keys=[from,to,bucket,buckets,totals,asOf,asOfSource]，totals={runs:13,costUsd:0.121198,…}；emp_217A 同窗→buckets=[] totals.runs=0（真 0 对照）。from/to date 参数按 BJT 日界解释（返 UTC 边界 10-31T16:00Z）。
- 实现（EmployeeDetailModulePage.tsx）：ZoneId+mapShellZone case "usage"+reload.usage；UsageZone 组件 Promise.all 恰 3 请求（day 账本/month 账本/run-stats 月窗 bucket=day）。**BJT period 只用本机时钟选查询哪一期**（同 R54 文件名先例），屏上采集时刻一律 payload：asOf 过 ISO 正则+Date.parse → beijing() 到分，缺/非法=「—」+title「不用本机时钟补时」，asOfSource 只进 title。列=周期｜运行数（今日桶缺=「—」+title 不作 0；本月=totals.runs 真 0 照写）｜实扣成本（只认 items[0].costUsd，money(0)=$0.00 money(缺)=「—」+title missingEmployeeIds 实证句；禁 ?? 0）｜采集时刻。行出口=纯文本+title（周期聚合行无专属深链，单条运行看运行区）——工单允许形态。空集判定=!dayRow&&!monthRow&&monthRuns===0（真 0 才空，缺值不算）→ed10-usage-empty「该员工暂无成本记录。」+真实回答句。四态 testid=ed10-usage-loading/denied/error/empty，denied=403≡404 同体 DENIED_COPY+RequestIdCopy+重试（Zone* 组件既有）。零写入口；NAV_ZONES 四区条不动（无死控件）。
- 坑：**模块内本就有局部 money()（line 94），从 tasksBoard import money 触发 Babel Duplicate declaration 整文件收集失败**；tsc grep 因缓存未报——撤 import 用局部函数（语义相同 $0.00/—）。
- 测试：R57 describe 6 用例（3 请求计数+全带 employeeId+period 断言、month 行 13/$0.12/asof 2026-11-20 07:58+title bff-read-time、day 双缺值「—」+title、屏上无裸 0.121198、真 0 vs 缺失可区分、空集句、error 冒号 rid+req-copy+重试、403 与 404 两个 it 同体+不回显路径）。定向 employee-detail 46 passed；全量 132 files/1476 passed；assert-ia 两模式 exit0（headHash 3f40f615）；tsc 本域零红。
- 三档横溢=jsdom 不可测，形态学报：grid 全 minmax(0)+min-w-0 truncate、375 档 grid-cols-1 堆叠（ed8/ed9 同构已验）。9122==6a02ed58 禁重建：页面活体读数待并入后代次，本轮 jsdom 挂载链为权威。
- 坑补记（lefthook 实拦）：react-hooks/purity 把 render 体内的 Date.now() 判 error 拦下 commit——BJT 今日字符串改在 effect 里算好随 ready state 携带（state.today）；effect 体 setState(loading) 只是 warning 可过。修后复测 46 passed，commit aa651e8e 推送 3f40f615..aa651e8e。

## R59 — 审批队列搜索（apv8-*，pending + history 两 tab）

- 基线：显式 refspec fetch + merge origin/lane/hermes-console = **7173b7c6**（现网代次，entry index-B6GI2nKC.js）；toplevel ✓ porc=0。禁 reset 纪律遵守（R58 未在此列，见下注）。
- 实测三键（ego 只读，9122==7173b7c6）：GET /api/approvals?status=all&limit=50→200 n=8；`q=message.send`→200/8、`keyword=`→200/8、`title=`→200/8，**三者与不带键完全同集合=后台丢参不做关键字过滤**⇒按工单走本地过滤分支，禁假服务端搜索。
- 实现（modules/approvals/）：①model.ts 新 export approvalsRowSearchText(row)=title+reason+rawId+status.label+risk.label 拼合小写。②两页同构：q=params.get("q")??""（URL 唯一状态源，刷新/分享复现）、setQ 写/删 ?q=（replace）；visibleRows=useMemo(list.rows.filter(includes))；搜索框 div role=group apv8-search-group（input apv8-search + q 非空时 apv8-search-clear「清空搜索」）插在 QueueCsvExport 后；apv8-scope-note=「仅在当前已加载 N 条内搜索；关键字是前端本地过滤，不产生新请求」+title 带三键实测细节。③联动同源：行 map、apv5-count、aria-live 读数（q 非空=「已显示 V / N 条…（关键字过滤中）」）、QueueSummaryBar rows={visibleRows}（apv6 计数随动）、QueueCsvExport rows={visibleRows}（导出=屏上口径）、unreadable 注行 q 非空改「另有 U 条…不参与关键字搜索」。④ready&&q&&visibleRows.length===0→Card apv8-search-empty「没有匹配的审批。」+本地过滤真实结果句+清空出口；列表本身 empty 走既有 EmptyPanel 不动；四态/rid 可复制/403≡404 沿用零改。⑤pending 页「这些单都已经处理过」全量口径 Card 不动（非列表语义）。⑥切 tab 是否保留 ?q= 由壳层 tab 链接机制决定（写域外），未动；页内刷新/分享复现已锁测试。
- 测试：history 3 用例（框+注脚上屏、键入「预算」fetchJSON 调用数不变=零新请求锁+行 8→1+apv5-count=1+「关键字过滤中」+apv6-summary 在；&q=nomatch-xyz 直达→apv8-search-empty+清空恢复 8 行；&q=预算 直达过滤态复现）+pending 1 用例（键入「本周」零新请求、nomatch→apv8-search-empty、urls 永不含 q=nomatch=关键字从不进请求）。行计数选择器用 '[data-testid^="apr5-row-ap"]'（apr5-row-details-* 撞前缀坑既有）。定向 approvals 3 files/72 passed（68 既有零破+4 新）；全量 137 files/1590 passed（含 merge 带入的 wave-17 他人用例）；assert-ia 两模式 exit0 51/22/1/8（headHash 7173b7c6）；tsc 本域零红。
- 三档横溢=jsdom 不可测，形态学报：apv8-search-group flex-wrap gap-1.5 沿用 apv5-filter 组已验形态，input min-w-0。
- **R58 注记（待拍板）**：员工列表分页与总数诚实化单在 lane 上无交付记录（EmployeesModulePage 无 loadMore/emp-list-page-*），上一窗口设计完成后中断未落地；本窗按队列先做了 R59。R58 设计（真游标 loadMore+去重追加、无 total→「总数不可用」+title、到底 disabled+「已到末页」、emp-list-page-* 族、活体已实测 limit=2→2 行+cursor→1 新行无重复/末页无 nextCursor 键）仍有效，等令可续。


## R60 · 审批列表行内展开预览（apv9-*）— commit 待生成（基线 merge f259528d，现网代次 7173b7c6）

- **裁决**：工单「点行展开」与既有「点行→详情」（openRow 写 ?id=+发 /api/approval?id=，R55 刚验收的 card.click()→apr5-detail 契约）冲突，且工单要求展开不改 URL+apd6/apd7/apr5 零破。按审计先例=**行内独立 toggle 按钮**（apv9-toggle-<key>，ChevronRight 图标，aria-expanded，button 天然 tabIndex/Enter/Space/焦点可见）承载展开，行主体点击语义不动。活证据=pending 既有 4 个 decision-writes 用例（openTicket 走行内按钮选择器）同步为 `button:not([data-testid^='apv9'])` 后全绿=行→详情契约保留。
- **禁额外请求实证**：用例锁 `api.fetchJSON.mock.calls.length` 展开前后不变（只用列表已加载行数据，零新请求）。
- **字段增量**：model.ts ApprovalRow 加 `approvers: approverLabels(rec)`（复用 R31-obs 既有解析，裸机器值→「人员」）与 `requestId: pickText(rec,["requestId","request_id"])`——活体列表行 keys 本就含两键（R49 读数）。preview=标题/状态人话（title=raw 或缺）/风险档（缺「—」+title「该字段未返回」）/更新时间 BJT 到分（row.clock，缺=服务未提供该时间）/审批人（labels join、缺「—」）/请求编号=RequestIdCopyField 可复制（冒号形制 apr5-copy-request-id；缺=「请求编号：该字段未返回」）。
- **交互**：同时仅一行（页级 previewKey 单 state）；Escape 收起+焦点回 toggle（closeRefocus，用例断 document.activeElement）；打开详情（openRow）互斥收起预览；URL/筛选/页码/tab 零改动；刷新回收起（React state 天然，不持久化不编造）。
- **测试**：history 3 用例（真值行夹具 ap_v1=郑涛/req-v1-9/2026-11-19 10:00/高风险；缺值行=「该字段未返回」；互斥一行）+pending 1 用例（ap_9F3A1111 展开含「对外发送本周报表」无裸 human:/emp_）。定向 approvals 3 files/76 passed（72+4）；全量 137 files/1594 passed（基线 1590+4）；assert-ia 两模式 exit0 51/22/1/8；tsc 本域零红。
- **三档无横溢**：jsdom 不可测，形态学报——toggle 在既有 flex-wrap gap-x-2 行内，preview dl 全 min-w-0+truncate。
- **9122==7173b7c6 禁重建**：行内展开活体读数待并入后代次；本轮 jsdom DOM 读数为权威。
- 坑记：①history/pending 测试文件尾部插入必须核对原文件最外层 `})`（rfind 吃掉致 describe 嵌套+Babel 假象）②history 测试无 q() 助手=用 document.querySelector ③锚点缩进/形态必须先 sed 实读。


## R61 · 审批详情决策链路复制为纯文本（apd8-*）— 基线 merge bf0ea98a 上，现网代次 7173b7c6

- 实现（views.tsx DecisionTrail 尾部，pending/history 共享详情体）：`trailToText(detail)` 按屏上同序拼多行纯文本=提交行（requester.label 屏上口径）→ 各决策节点（who·verdict·时间·意见；缺时间「该段无记录」、缺意见「未填」）→ 未行动审批人待办行 → 终态行；**不含关联段**（该段承载 run/task 标识与证据路由说明，工单复制枚举=提交人/时间、节点、终态，纯文本禁内部 id）。文案口径与 NoSeg/屏上完全一致，禁编造顺序（服务顺序权威沿 R46）。
- 复制钮 `apd8-copy`（Button outlined）：点击 navigator.clipboard.writeText(copyText)；成功 `apd8-copy-status`（aria-live=polite）显「已复制」；剪贴板不可用/拒绝 → status 显「剪贴板写入被拒绝，可用下方文本框手动复制。」+ `apd8-fallback` readOnly textarea（value=同文本，onFocus 全选，title 说明兜底口径）。**空链路**（decisions=0 且无待办审批人）= disabled + title「服务没有返回任何决策节点，也没有待办审批人：没有可复制的链路。」（无 nodes 也无 pending 时文本只剩提交/终态两行，无链路可交）。
- **禁额外请求实证**：用例锁点击复制前后 `api.fetchJSON.mock.calls.length` 不变（复制只读屏上已渲染 detail 对象，零新请求）。
- 实测读数（jsdom，夹具 TRAIL_SAMPLE）：提交 · 成员 · 9 · 2026-11-19 09:00 / 节点 1 · 郑涛 · 通过 · 2026-11-19 09:50 · 意见：可以，按计划轮换。/ 节点 2 · 人员 · 通过 · 2026-11-19 09:55 · 意见：未填（裸 human:8 无姓名=屏上同口径「人员」）/ 阿朝 · 待办 · 该段无记录 · 意见：未填 / 终态 · 已通过 · 2026-11-19 10:00；文本无 human:/emp_/ap_t8 裸值断言在。
- 测试：history 3 用例（真值复制成功+计数锁/拒绝→fallback readOnly+value+status/空链路 disabled+title）+ pending 1 用例（queue() 详情抽屉 trail 在、apd8-copy/status 存在）。定向 approvals 3 files/80 passed（76+4）；全量 137 files/1598 passed（基线 1594+4）；assert-ia 两模式 exit0 51/22/1/8；tsc 本域零红。坑记：requestedBy={type,id} 的 human:9 屏上 label=「成员 · 9」（personFrom 名词=成员，非「人员」——人员=decisionEntries maskHandle 口径）；pending.test 无 openTicket 助手=直接 click apr5-row-ap_9F3A1111。
- testid：apd8-copy/apd8-copy-status/apd8-fallback 新增；apd6/apd7/apv5–apv9/apr5/ed*/emp-list* 零破（定向全绿为证）。三档横溢=形态学报（copy 行在既有 min-w-0 flex-wrap，textarea w-full min-w-0）。9122==7173b7c6 禁重建：活体复制读数待并入后代次；本轮 jsdom clipboard 回环为权威。

## R62 · 员工列表列排序与筛选组合（emp-list-sort-*）— feat(console): employees list column sorting

基线：显式 refspec fetch + merge origin/lane/hermes-console = Already up to date @b1d52a0d（38793c9a/代次 7173b7c6），toplevel ✓ porc=0。

- **服务端排序实测被丢（ego 9122==7173b7c6）**：GET /api/employees?limit=50 基线 200 n=3 顺序 [217A91:QA2契约验证, 86A81C:AgentOS产品助理, 016685:AgentOS产品助理]；带 sort=name&order=desc / sortBy=lifecycleState / sort=createdAt&dir=asc 三组均 200 同序同集合 ⇒ 读口白名单（keyword,lifecycleState,limit,cursor,expand）无排序参数 ⇒ **本地排序分支确定**，表下 `emp-list-sort-scope-note` 明写「排序仅在当前已加载 N 条内生效（本地排序；后台排序参数实测被忽略，不是全量排序）」+ title 带三组实测（EmployeesModulePage.tsx）。
- **四列真按钮**：员工(姓名)/短码(工号)/状态(在职态原始值)/最近活跃(时间) = SortHeader（role=columnheader 上 aria-sort 三态 none/ascending/descending、内 button type=button、lucide ArrowUp/ArrowDown/ArrowUpDown、focus-visible outline、原生 Enter/Space）。三态循环：列首点 asc → 再点 desc → 三击清除回服务端原序。
- **创建时间口径诚实**：列表读口行字段实测无 createdAt（R53 读数），屏上无该列 ⇒ 不造假列；时间排序落在既有「最近活跃」（updatedAt）列，列头 title 注明。
- **null/缺失排末不当 0**：sortValue 缺值→null，比较器 null 恒排末（升降序皆然）；用例锁缺姓名行 asc 末位。
- **与 ?q=&lifecycle= 组合**：sort/dir 经既有 patchParams（URLSearchParams(params) 差分）读写 ⇒ 点排序保留 q/lifecycle，切筛选/清空钮只删 q/lifecycle 保留 sort；粘 URL ?q=…&lifecycle=active&sort=name&dir=desc 直达复现（fetch 恰 1 条带 keyword+lifecycleState，行序=desc+首行对照断言）。
- **禁假排序/零新请求**：排序为纯本地 useMemo（sortedItems），行 map 换 sortedItems；用例锁点击前后 fetchJSON 计数不变。
- **分页游标重置**：R58 分页从未交付（页面无 cursor/loadMore 形态，单页 limit=50）⇒ 无游标可重置，排序不触发重取，天然无跨序拼接；如实记此决定。
- testid：emp-list-sort-{name,code,state,time} + emp-list-sort-scope-note 新增；emp-list-*/emp-l-*/employees-* 与 ed*/apd*/apv*/apr5 零破（定向 employees 16 passed=13+3；全量 137 files/1601 passed=基线 1598+3；assert-ia 两模式 exit0；tsc 本域零红）。
- 三档横溢=形态学报（列头 button 在既有 grid 模板 span 位内 inline-flex min-w-0，无新增宽度）；jsdom 不测三档。9122==7173b7c6 禁重建，活体排序读数待并入后代次（读口实测已贴）。

## R45-P0 · 员工成本区 run-stats ISO 窗口修复（fix(console): employee usage run-stats iso range）

- 根因（R45 终判 FAIL 单点）：EmployeeDetailModulePage.tsx UsageZone effect 把 monthPeriod=dayPeriod.slice(0,7)（"2026-11"）直接当 run-stats 的 from 传出去；BFF 要完整 ISO-8601 → 422 Invalid isoformat string（rid c77c1b03030e4092bee2c59eafeaa666）→ Promise.all 恒 reject → ed10-usage 永停 error。
- 修法（最小面）：from/to 一律 Date.UTC 拼完整 UTC ISO——day 腿=当日 00:00:00.000Z→次日 00:00:00.000Z；month 腿=当月首日→次月首日（Date.UTC(y,mo,1) 在 12 月自动翻次年）。run-stats 拆两腿（今日行读今日窗 totals.runs、本月行读本月窗 totals.runs），旧「桶列表匹配今天桶」逻辑删除；budget-usage period=YYYY-MM-DD/YYYY-MM 两 URL 一字未动；bucket=day 不变；testid/路由/其它模块零改动。ready 形态 stats→statsDay/statsMonth。
- 活体复测（ego 只读 9122==7173b7c6，未截断原文）：
  - /agent-api/api/run-stats?employeeId=emp_86A81CE8FF6F42E187BCF2B540&from=2026-11-20T00:00:00.000Z&to=2026-11-21T00:00:00.000Z&bucket=day → **200** totals={runs:0,costUsd:0}（今日窗真 0）
  - /agent-api/api/run-stats?employeeId=emp_86A81CE8FF6F42E187BCF2B540&from=2026-11-01T00:00:00.000Z&to=2026-12-01T00:00:00.000Z&bucket=day → **200** totals={runs:13,costUsd:0.121198}
  - 冒号在 query 中原样发送（合法字符，服务端 datetime 正常解析——以上 200 即实证）。
- 测试：usageApi 替身按 from/to 窗长（==86400000→day 腿）分腿；既有用例腿数 3→4；新 2 用例=①两条 run-stats URL from/to 匹配完整 ISO 正则且不含 from=YYYY-MM&（月末跨月边界另测）②vi.spyOn(Date,"now") 固定到 2026-12-31T20:00Z（BJT 2027-01-01 04:00）→month 腿 from=2027-01-01T00:00:00.000Z to=2027-02-01T00:00:00.000Z（12 月翻年边界）。定向 employee-detail 48 passed；tsc --noEmit 本模块 0 error；全量 **137 files/1603 passed**（基线 1601+2）。
- 口径修正（本域事实）：今日运行数与本月运行数各取自己窗口 totals.runs（原桶匹配语义废除）；runsTitle 缺值句同步改「今日窗/本月窗没有返回 runs 合计：缺值不作 0」；asOf/成本列口径零改动。
- 未测项：9122 禁重建（R45 取证代次），页面活体四态读数待修复合入后代次；本轮权威=活体 API 双腿 200 + jsdom 48 用例。

## R63 — /employees 行内预览（emp-row-preview-*）
- 基线：显式 refspec fetch + merge origin/lane/hermes-console → tip 053da5c4（代次 053da5c4，wave-18 已含）；toplevel ✓ porc=0。
- 实现（web/src/modules/employees/EmployeesModulePage.tsx）：行 li 内 Link 之外新增独立 toggle 按钮（emp-row-preview-toggle-<id>，aria-expanded，ChevronRight rotate-90，onClick 单键翻转，onKeyDown Escape 收起且焦点即在本钮=焦点回原行）；展开体 RowPreview（emp-row-preview-<id>，role=region）六字段=姓名（缺「该字段未返回」+title）/工号短码（员工 · 8位码，title=全 id）/在职态（lifecycleLabel，未知→待核实，title=原始值）/角色职称（row.title 缺=该字段未返回）/最近活跃（beijingMinute BJT 到分，缺=该字段未返回）/请求编号（RequestIdCopy requestId=null → fallback「请求编号：该字段未返回」——列表读口行无 requestId 键，实测行 keys=[employeeId,tenantId,name,title,lifecycleState,ownerUserId,updatedAt,department,enrichment]）。页级 previewKey 单 state=同时仅一行；URL 零改动（不触 patchParams）；刷新回收起（React state 天然）。零额外请求=只读已有行对象。
- 测试（EmployeesModulePage.test.tsx 新 describe 2 用例）：①展开读数+fetchJSON 计数前后不变锁+aria-expanded false→true+Escape（先 toggle.focus()——jsdom click 不移动焦点，键盘场景焦点本在钮上）→收起+activeElement=toggle；②同时仅一行+URL data-last-search 不变+缺 title 行「该字段未返回」。定向 employees 2 files/18 passed。
- 坑（本笔实证）：python rfind("});") 追加 describe 会把新块插进最后一个 describe 内部并吞掉其收尾——插入点必须在文件最末 `});` 之后，或补回被吞的 describe 收尾（本次修复=anchor `});\n\nconst twoRows` 处补一行 `});`）。
- 验证：定向 18 passed；tsc 本域零红；assert-ia 两模式 exit 0；全量 1671 passed 0 失败（merge 后基线含他人用例）。三档横溢=形态学报（toggle shrink-0 在 flex 行外列、preview dl grid minmax(0)+truncate，jsdom 不可测三档）。9122==053da5c4 代次活体展开读数待并入后代次（禁重建）。

## R65 审批行内预览与详情字段一致性（apv9 vs apd5/apd6，2026-11-20）

- 基线：显式 refspec fetch + merge origin/lane/hermes-console = Already up to date @c65d8ce0（b797bc98 已含），toplevel ✓ porc=0；代次 053da5c4。
- 逐字段对照结论（改前→改后，同单两屏取值）：
  1. 风险档缺值：预览「—」 vs 详情徽标「未标注风险」（model.ts riskView(null).label）→ 预览改直读 row.risk.label（riskView 同源），缺字段口径=该 Field title「该字段未返回」；有值两处同词（活体 ap_123DE49B：两处 riskLevel=high 同值）。
  2. 更新时间：预览原 row.clock（pending 行=处理期限 expiresAt、settled=decidedAt??deadline）与详情「决定时间」(decidedAt 键序无 deadline 兜底) 异值 → rowFrom 新出 `decided: beijing(pick(rec, DECIDED_KEYS))`（与 detailFrom.decided 同键序同助手）；预览更新时间=decided??「—」；行主体 dl 的「处理期限/处理于」既有形态未动（不属重叠字段）。活体同单 decidedAt=2026-11-17T13:09:04.322Z 两读口一致 ✓。
  3. rid 键序：row 原 [requestId,request_id] vs 详情 [requestId,request_id,consoleRequestId] → row 对齐三键（仅带 consoleRequestId 的行不再误显「该字段未返回」；用例 req-cr-65 两屏同显）。
  4. 标题/状态/审批人：两处本就同助手（humanSentence(TITLE_KEYS)/statusView(STATUS_KEYS)/approverLabels），零改动。
- 活体差异如实报（非前端可修）：本代次上游详情体 keys 无 requestId/consoleRequestId（GET /api/approval?id= 实测 keys=action…tenantId,ttl），列表行 requestId=审批单号本身；两屏各读自各自 payload，前端不跨读口拼数（禁编造）。
- 口径锁：预览缺字段=「该字段未返回」（值/题头 textContent 或 title），详情缺段=「该段无记录」（DecisionTrail NoSeg）；新用例断言两串不互混（pv 不含「该段无记录」、trail 缺段仍「该段无记录」）。
- 测试：ApprovalsHistoryModulePage.test.tsx 新 describe "R65 preview-detail parity (apv9 vs apd5/apd6)" 3 用例（pending 同值+展开两次 fetchJSON 计数不变零请求锁 / settled decidedAt 两屏同「2026-11-19 10:00」==apd5-field-decided-at / 缺风险行两处「未标注风险」同词+「请求编号：该字段未返回」）。定向 approvals 3 files/83 passed；tsc 本域 0 红；assert-ia 两模式 exit0；全量尾行见下条（基线 137 files/1671，+3）。
- 零破：apv9-*/apd6-*/apd7-*/apv5–8/apr5/ed*/emp-list*（既有 80 用例全绿为证）；三档=Field dl grid min-w-0 既有形态学报（jsdom 不可测）；9122==053da5c4 活体两屏 DOM 读数待并入后代次。
- 队列注记：R64（employees 复制为纯文本）与 R58（employees 分页）仍未交付。

## R64 员工列表复制为纯文本（emp-list-copy，2026-11-20 补交）

- 基线：显式 refspec fetch + merge origin/lane/hermes-console = Already up to date @5dd273f3（b797bc98 已含），toplevel ✓ porc=0；代码代次 053da5c4。
- 实现（modules/employees/EmployeesModulePage.tsx）：纯函数 buildEmployeesCopyText(rows)=表头 `name,employee_no,lifecycle,last_active` + sortedItems 屏上行序逐行 csvCell（RFC4180：含逗号/引号/换行加引号双写）；值逐字取屏上=displayName/`员工 · shortCode`（title 全 id 语义在行卡列，文本只出短码）/lifecycleLabel（default 待核实）/beijingMinute ?? 「—」（缺不补 0）；ListCopyButton 挂 header 刷新钮旁（role=group）：emp-list-copy 钮（disabled=rows 空；title=「范围=当前已加载 N 人，不是全量；零额外请求」/空态「当前已加载 0 人：没有可复制的行。」）+emp-list-copy-status aria-live=「已复制 N 行」（N=数据行数不含表头）/拒→「剪贴板写入被拒绝…」+emp-list-copy-fallback 只读 textarea（value 与目标逐字相同 onFocus select）。clipboard 缺失（无 writeText）也落 failed 分支禁静默。
- 零额外请求=组件只吃 sortedItems/state.items 现数据；用例锁 fetchJSON.mock.calls 点击前后相等。
- 测试：新 describe 4 用例 append 文件最末（tail-safe）——2 行逐字读数（员工 · 217A91BA/待核实/2026-11-17 13:52/在岗/无裸 emp_/已复制 2 行/无 fallback）；逗号名转义「"小鲤, 带头"」+屏上姓名列同源；reject→textarea readOnly 3 段；空列表 disabled+title「当前已加载 0 人」。定向 employees 2 files/22 passed；tsc 本域 0 红；assert-ia 两模式 exit0；全量 **138 files/1678 passed**（基线 1674+4）。
- 零破：emp-list-*/emp-row-preview-*/ed*/apv5–9/apd6/apd7/apr5（既有用例全绿为证）；三档=header flex-wrap+span.contents 既有形态学报（jsdom 不可测）；9122==053da5c4 禁重建，活体复制读数待并入后代次。
- 队列注记：R58（employees 分页）仍未交付。

## R58 员工列表游标分页与总数诚实化（emp-list-page-*，2026-11-20）

- 基线：显式 refspec fetch + merge origin/lane/hermes-console = Already up to date @a890e0c1（b797bc98 已含），toplevel ✓ porc=0；代码代次 053da5c4。
- 活体游标实测（ego 只读 9122==053da5c4）：`?limit=2` 页1 200 ids=[emp_217A91,emp_86A81C] nextCursor=eyJjcmVhdGVkQXQ6…；带 cursor 页2 200 n=1 ids=[emp_016685] 重复=0 nextCursor=null（末页不带键）；`lifecycleState=active&limit=2` 200 n=2、该筛选腿页2 200 n=0；顶层 keys=[items,nextCursor] **无 total/count**；`cursor=非法`→400 request.invalid_query（前端只在有 nextCursor 时才发 cursor，不踩）。
- 实现（EmployeesModulePage.tsx）：readRows→{rows,nextCursor,total}（多键 next_cursor/total/count 兼容）；State 加 nextCursor/total/loadingMore；loadMore=ready 且有游标才发 `cursor=` 续取，按 employeeId Set 去重后 append（防重复行，用例锁 emp_2B2C 计数=1）；分页条 emp-list-page-more（到底/加载中 disabled）、emp-list-page-end「已到末页」、emp-list-page-count=无 total→「总数不可用 · 已显示 N 人」+title「读口顶层只有 items/nextCursor（实测 200，无 total 键）；按已加载条数推算会撒谎，故不推算。」；employees-error Card 加 data-emp-list-page-error 别名（现名 employees-error 保留）。
- 切换重置：q/lifecycle 变更=主 effect 整体 setState 替换=游标/items 天然重置（用例：lifecycle 切换后恰 1 条新 fetch 且无 cursor）；sort/dir 属 R62 本地排序契约（作用于全部已加载行、不 refetch、不丢已加载），URL 四参 ?q=&lifecycle=&sort=&dir= 共存保态。
- 教训（幻影落地）：前窗压缩块声称本单「已落地」，本窗现查 grep loadMore/emp-list-page=0=从未落盘——**压缩块声称已编辑≠已落盘，续做前必现查**；本段代码为本窗从零落地。
- 验证：定向 employees 2 files/26 passed（22+4 新）；tsc 本域 0 红；assert-ia 两模式 exit0；全量 **138 files/1682 passed**（基线 1678+4）；emp-list-copy/emp-row-preview/ed*/apv*/apd*/apr5 零破（既有用例全绿为证）。
- 未测项：9122==053da5c4 禁重建，翻页活体读数待并入后代次；三档=分页条 flex-wrap+min-w-0 形态学报（jsdom 不可测）。

## R66 员工列表导出 CSV（emp-list-export，2026-11-20）

- 基线：显式 refspec fetch + merge origin/lane/hermes-console → tip **f98fd430**（含 cca9cf7e wave-19），toplevel ✓ porc=0；回执代次引用=cca9cf7e（禁引 b797bc98/053da5c4 及更早）。
- 队列现状澄清（教训=现查为准）：R58=5e7665d4 已交（工单「仍欠」系滞后信息）；R64 copy=**a890e0c1 实际早已交付**（本窗 grep emp-list-copy/csvCell=在库，前窗「R64 未落地」判断为误）；本笔只补 R66。
- 实现（modules/employees/EmployeesModulePage.tsx）：export csvTimestamp(now)=`employees-YYYYMMDD-HHmm.csv`（BJT +480min 纯格式化，new Date() 仅在点击回调内=render 体 purity 合规；用例锁跨日 2026-11-20T16:05Z→20261121-0005）；export buildEmployeesCsv(rows)=\uFEFF BOM+CRLF+尾行 CRLF（RFC4180，csvCell 与 copy 同源复用）；表头固定 name,employee_no,lifecycle,last_active；行=与 emp-list-copy 同一 sortedItems（禁第二套取值）；值=displayName/「员工 · shortCode」（禁裸 emp_）/lifecycleLabel（未知=待核实既有 default）/beijingMinute；**缺值口径差**：CSV last_active 缺=空字段（工单「缺“—”→空字段禁 0」，与 copy 的「—」不同，独立取值函数实现非参数化复制）。ListExportButton 挂 ListCopyButton 旁（role=group）：emp-list-export 钮（empty disabled+title「当前已加载 0 人：没有可导出的行。」/启用 title「导出当前已加载 N 人，不是全量；行序与屏上一致，纯前端生成零新端点」）+emp-list-export-count「共 N 行」（与列表同源）。Blob+a.download 纯前端，零新端点；URL.createObjectURL 缺失=no-op guard（jsdom/SSR）。
- 测试 3 用例 append 最末（tail guard ✓；本窗一次 NameError 未落盘重贴成功）：①csvTimestamp 两值含跨日②两行 fixture（逗号名「小鲤, 带头」+updatedAt null+weird_state）点导出→fetchJSON 计数前后不变（零新端点锁）+拦 URL.createObjectURL 收 blob→行=表头+2（CRLF split filter 非空=3）+`"小鲤, 带头"` RFC4180 转义+「员工 · 217A91BA」+末行 endsWith(",")=缺值空字段+「待核实」+**BOM 字节级断言 [0xef,0xbb,0xbf]**（坑=Blob.text() 按 WHATWG UTF-8 decode 规范剥离前导 BOM，text 层断 startsWith 必假，须 arrayBuffer/slice 验字节）③空列表 disabled+title。定向 employees 2 files/29 passed（26+3）；tsc 本域 0 红；assert-ia 两模式 exit0；全量 **144 files/1802 passed**（merge wave-19 基线）。
- 零破：emp-list-*/emp-row-preview-*/emp-list-copy*/emp-list-page*/ed*/apv*/apd*/apr5（既有用例全绿为证）；三档=header flex-wrap+min-w-0 形态学报（jsdom 不可测）；9122==cca9cf7e 禁重建，活体下载读数待并入后代次。
