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
