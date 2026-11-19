# DONE — 审计三面（console-aud 车道，branch `lane/console-aud`，基线 `c28ebc16`）

日期：2026-11-19（Asia/Shanghai）。作者：Fixer（受派会话）。
写域：`web/src/modules/audit/**`、`docs/_artifacts/aud/**`。写域外一律未改：`App.tsx`、`web/src/shell/**`、
任何 `manifest.ts`（本模块继续用 `tabNav.ts`，未新建/未编辑 `manifest.ts`）、`web/src/pages/**`、
`web/scripts/**`、`package.json`、锁文件、`node_modules`、其他模块、i18n。未跑任何 install。

## 1. 三面与端点

| 屏 | 页面文件 | 端点（真调用，无 mock 层） | 测试 id |
|---|---|---|---|
| 1 列表 | `AuditEventsModulePage.tsx` | `GET /agent-api/api/audit?limit=50[&event_type=&from=&to=][&cursor=]` | 页级 `agent-v2-page-audit`，元素 `aud01-*` |
| 2 详情 | `AuditDetailModulePage.tsx` | `GET /agent-api/api/audit/detail?id=<eventId>` | 页级 `agent-v2-page-audit-detail`，元素 `aud02-*`（列表页抽屉里的同一具身也用 `aud02-*`） |
| 3 校验 | `AuditVerifyModulePage.tsx` | `GET /agent-api/api/audit/verify?from=&to=` | 页级 `agent-v2-page-audit-verify`，元素 `aud03-*` |

`/api/` 段是路由的一部分（缺它即 404），三条 URL 拼装都由 `api.test.ts` 逐字断言。

## 2. 列与口径（屏 1）

- **时间**：`Asia/Shanghai` 到分（`model.ts` 的 `beijing()`），标签写明「时间（北京时间）」；缺值 → 「—」+ `title` 里原因。
- **操作者**：`姓名 · 8位短码`；只有句柄时 `员工/成员 · 短码`；无归属 → **「未指派」**；`emp_…` / `human:…` / UUID 只进 `title`。
- **事件类型**：认识的说中文（`ACTION_LABEL`），**不认识的按原样上屏**，不机翻。
- **结果**：成功 / 失败（被拒）/ 待完成 / 结果未识别，失败带一句人话原因。
- **请求编号**：`requestId`→`req_id`→`correlation_id`→`trace_id` 依次取，可复制（复制成功显「已复制」，
  失败显「复制失败，请手动选择」），缺值 → **「未提供」** + `title` 原因；绝不写 0、绝不留空。

## 3. 过滤器（会真的改请求）

| 过滤器 | 上屏控件 | 落到线上 | 证明 |
|---|---|---|---|
| 时间窗 | `aud01-filter-window`（最近 24 小时 / 7 天 / 30 天 / 不限时间，默认 24 小时） | `&from=<ISO>&to=<ISO>`；「不限时间」把两个参数一起丢掉 | `api.test.ts`「the two live filters change the list URL」、页面级「a wider time window means a wider pair of instants on the wire」「不限时间 drops both bounds」 |
| 事件类型 | `aud01-filter-type`（全部事件类型 + 本仓词表里的原码） | `&event_type=<code>`；选回「全部」就不再带该参数 | `api.test.ts` 同上 + 页面级「carries event_type on the wire」 |
| 操作者 | `aud01-filter-operator` — **disabled-by-design** | 不发任何参数 | 页面级「the operator filter is disabled-by-design with its GAP number」 |

- **GAP-06**（本车道新号，已核全仓无撞号：现有 GAP-01…GAP-05 见 `docs/_artifacts/{duty,appr,caps}/DONE.md`、
  `web/src/shell/routes.ts`）：`/api/audit` 的 `require_any` 七选一参数名在本仓没有采过样，
  操作者筛选没有可发的参数名，因此渲染成禁用 +「未接入 · GAP-06」，而不是一个能点但什么都不做的死控件。
  接上后把这个 `select` 换成真参数即可。

## 4. 四态与红线（三面共用 `states.tsx`）

- loading：骨架屏；empty：带原因 + 下一步（列表按是否带筛选给两种说法）；error：人话 + 可复制请求编号 + 重试；
  denied：403 与 404 **逐字节同体**（`toBe(forbidden)` 断言 outerHTML 相等），且 denied 之前不画任何行。
- 屏 3 额外一条腿：跑不动 → **「本环境未启用」** + 原因 + 下一步去处 + 请求编号；403/404/405/501/连不上/5xx 都归这条腿，
  永不写成绿色链。401（登录失效）是「可执行的错误」，走 error 腿并说「重新登录」。
- 屏 2 的人话层零工程词：无原始字段名、无 HTTP 码、无 ISO 串、无 `undefined`；技术值只在默认关闭的「技术详情」里
  （关闭 = 不在 DOM 里）。
- 无 `?? 0`；缺值一律「—」或该字段自己的诚实词 + 原因。
- 无 `question` / awaitAnswer 式交互：三面都只是读数 + 筛选 + 重试，没有弹问、没有假按钮（唯一 disabled 控件已写明原因）。
- 横溢：全部沿用 `flex + min-w-0 + break-words + break-all + minmax(0,…)`；请求编号用 `break-all` 保证 375px 下不撑宽。
  **像素级实测未做**（见 §7）。

## 5. 跑过的命令与原始输出尾巴

```
$ cd web && ./node_modules/.bin/tsc --noEmit -p tsconfig.app.json
TSC_EXIT=2
49 error TS 行，全部在 ../apps/shared/src/*.test.ts（`Cannot find module 'vitest'` 与 TS7006 隐式 any）
grep -v '^\.\./apps/shared' 后 error TS 行数：0
web/src（含 modules/audit）零错误；本车道只改 web/src/modules/audit/**，不可能引入 apps/shared 的错误 → 判定为基线/环境既有项

$ cd web && ./node_modules/.bin/tsc -b . --noEmit
TSC_B_EXIT=2
同一批 49 行，同样全在 ../apps/shared/**；modules/audit 无一行

$ cd web && ./node_modules/.bin/vitest run src/modules/audit
VITEST_EXIT=0
 Test Files  5 passed (5)
      Tests  96 passed (96)
   Duration  1.27s

$ cd web && ./node_modules/.bin/eslint src/modules/audit
ESLINT_EXIT=0
✖ 3 problems (0 errors, 3 warnings)   ← 三条均为 useAuditData.ts 既有 set-state-in-effect 规则告警，非本次新增错误
```

`5 files / 96 tests` 的构成：`api.test.ts`（纯层）、`AuditEventsModulePage.test.tsx`、
`AuditDetailModulePage.test.tsx`（新）、`AuditVerifyModulePage.test.tsx`、`manifest.test.ts`。

## 6. 端点实探状态码（本机 BFF `127.0.0.1:8092`，`L4ConsoleBFF/0.1`，无身份头）

```
GET /api/audit?limit=50                          → 401
GET /api/audit?limit=50&event_type=…&from=…&to=… → 401
GET /api/audit/detail?id=evt_probe               → 401
GET /api/audit/verify?from=…&to=…                → 401
响应头（每一次请求都给一个新号，可复制）：
       X-Console-Request-Id: d6b5fa156cad4fabbd0d6e9dc039187a（详情腿）
       X-Console-Request-Id: 5aeed90a04774ff9966e64e8d00ad31d（校验腿）
       X-Console-Reason: identity-check-failed
       body: {"code": "console.unauthenticated", "message": "identity check failed"}
```

门在路由之前：**任何**路径都是 401，所以带不带筛选、拼法对不对，从外部分辨不出来。
前端把 401 当作可执行错误（「登录状态已经失效，请刷新页面重新登录后再看」+ 请求编号 + 重试），
不是「未启用」，也不会画出一行数据。**没有编造任何数据行。**

## 7. fixture 腿与未验项

- **没有 fixture 数据腿**：三面的读都是真请求（`fetchJSON`），因此没有任何「示例数据」面板，
  也没有 `data-fixture` 的假数据腿。唯一的 `data-fixture` 是 shell 自带的 `?state=` QA 复现：
  值 ∈ `loading` / `empty` / `error` / `denied`，页面同时打出「这是用 ?state= 复现出来的状态，不是服务此刻的回答」，
  并由测试断言复现腿不发请求。
- 未验（真身份/真负载才定得了）：
  1. 2xx 真负载的字段名——`model.ts` 的键候选表（snake/camel/短别名）未经采样，真数据到达需回填；
  2. `event_type=` / `from=` / `to=` 三参数名是否与 BFF 一致（`require_any` 七选一未记录参数名）；
     若服务端回 400，页面已有「这次读取缺一个服务端要求的筛选条件…」的人话腿；
  3. `/api/audit/detail`、`/api/audit/verify` 两个拼法（对账表写的是 `/api/audit*` 与 `/api/audit-verify`）：
     拼错即 404 → 列表/详情显示 denied 同体，校验显示「本环境未启用」，不伪造；
  4. 1440 / 375 的像素级横溢：页面未接进 shell（`App.tsx` 与 `shell/**` 在写域外），无浏览器可看，未实测；
  5. 视觉/截图核对：未做；
  6. `../apps/shared` 的 tsc 既有错误：不在写域，未修。
- 接线：三面文件按 `shell/bridge.ts` 的 `*ModulePage.tsx` 命名规则摆放，接线车道取用即可；
  `tabNav.ts` 里 `kind` 仍是 `'planned'`，本车道不改。
