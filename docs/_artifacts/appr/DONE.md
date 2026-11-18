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
