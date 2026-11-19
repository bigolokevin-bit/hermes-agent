# DONE — 审计三面（console-aud 车道，branch `lane/console-aud`，基线 `c28ebc16`）

日期：2026-11-19（Asia/Shanghai）。作者：Fixer（受派会话）。
提交（`lane/console-aud`，基线 `c28ebc16`）：`0c04ecb8` 列表 → `20ccb789` 详情 → `7fe0e412` 校验 →
`79aa086b` 筛选 URL 断言与列表口径注释补记 → `bc75fb4a` 本文件台账 → `c7270b5c` 失败面板里的请求编号改为可复制
（`CopyValue` / `RequestIdLine` 收进 `states.tsx`，三面共用，并加了两条 testid 断言）。
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

- loading：骨架屏；empty：带原因 + 下一步（列表按是否带筛选给两种说法）；error：人话 + **可复制的请求编号**（`RequestIdLine`
  走 `CopyValue`，复制成功显「已复制」、失败显「复制失败，请手动选择」；没有编号时给「本次请求未记录编号，可复制时间与操作路径反馈」）
  + 重试；denied：403 与 404 **逐字节同体**（`toBe(forbidden)` 断言 outerHTML 相等），且 denied 之前不画任何行。
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
   Duration  1.26s (transform 1.11s, setup 0ms, import 1.86s, tests 401ms, environment 1.26s)

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

---

# 收口第二轮（closeout R2）— 2026-11-19，基线 `61cbc436`

派单口径：TASK A 是 T33 三面的**收口**（三面已在 `61cbc436` 里），不是重写。所以本轮先逐条**实测复核**五个判据，
只写真有缺口的东西。写域仍限 `web/src/modules/audit/**` 与 `docs/_artifacts/aud/**`；未新建/未编辑任何
`manifest.ts`、未碰 `App.tsx`、`shell/**`、`pages/**`、i18n、锁文件；未跑 install。

## A1. 复核结论：五条判据在 HEAD 上的真实状态

| 判据 | HEAD 上实测 | 本轮动作 |
|---|---|---|
| ① 403≡404 同体 | 三面都走同一个 `DeniedPanel`/`VerifyUnavailablePanel`，`title` 不带 raw，body 不拼 status；测试用 `toBe` 比 outerHTML 逐字节 | **补了「不回显路径」断言**（原测试只证同体，没证不回显） |
| ② 技术值收进「技术详情」 | 折叠默认关、关了就不在 DOM；但**「变更」两格把人话不了的机器格式直接上屏** | **真缺口，已修**（见 A2） |
| ③ 校验跑不动 | 「本环境未启用」+ 原因 + 下一步 + 请求编号；403/404/405/501/0/5xx 全归这条腿；计数带分母 `120 / 200` | 复核通过，未改 |
| ④ 筛选真改请求 | `api.test.ts` 逐字断言 `event_type=` / `from=` / `to=`；页面级断言 7 天窗口跨度 ≈ 24 小时 ×7、「不限时间」丢两个参数；操作者筛选 = GAP-06 禁用 + 徽章 | 复核通过；**删掉了三块重复测试**（见 A3） |
| ⑤ testid | 列表单元格 `aud01-cell-*`/`aud01-row-*`，页级 `agent-v2-page-audit` / `-detail` / `-verify` 全在 | 复核通过，未改 |

## A2. 判据②的真缺口：机器格式变更值直接上屏

`model.ts` 的 `stringifyValue()` 对「有 value/display/label 的对象」给人话，对**只剩字段名的对象**返回
`{字段甲、字段乙}`，对字符串化的 JSON 原样返回。这两个结果被 `views.tsx` 当作「变更前/变更后」的**值**画在人话层，
于是字段名和原始 JSON 上了屏 —— 正是判据②要清零的东西。

改法（`model.ts` + `views.tsx`）：

- 新增 `humanValue()`：把「能不能给人读」判出来，`machine: true` = JSON 串 / 机器句柄 / 只剩字段名的对象；
- `changeOf()` 只在**非机器**时填 `before`/`after`，机器那侧 push 进 `technical`（`变更前原值：…` / `变更后原值：…`），
  并在 `AuditChange` 上加 `folded: { before, after }`；
- `views.tsx` 的 `changeSide()`：有值 → 值；被折走 → **「见「技术详情」」**+ `title` 说明为什么；真空值 → `（空值）`；没给 → `—`+ 原因。
  人话层不再出现 `{a、b}` 这类字段名清单，也不再出现 JSON 原文。

新测试 `a machine-shaped change value is folded, never printed`（`AuditDetailModulePage.test.tsx`）钉住两侧：
折叠前 `text()` 不含 `budget_cap` / `ten_thousand` / `emp_…`，展开后能看到 `变更前原值：{budget_cap、owner}` 与
`变更后原值：{"budget_cap":"twenty_thousand"}`。

## A3. 判据④的卫生问题：`api.test.ts` 里三块逐字重复的测试

`61cbc436` 是 `abe0f6be`(gov) × `f2921e9c`(aud) 的 merge，同一批断言两侧各写了一遍、合并时都留下了：

```
EXACT-DUP  L53:  'the two live filters change the list URL — that is what makes them filters' (same as L38)
EXACT-DUP  L293: 'reads 请求编号 from either spelling and stays missing when there is none'    (same as L273)
EXACT-DUP  L308: 'an event with neither a name nor an id is 未指派, never a bare handle'        (same as L288)
```

vitest 不反对同名测试，所以这 3 块**看着像覆盖率、实际一个都没多证**（96 里有 3 个是重复计数）。
已删第二份，`0 insertions / 35 deletions` 的纯删除，审计 `96 → 93`，加上新写的折叠测试回到 **94**。

> 检测脚本放在仓库外（临时目录 `dedupe_tests.py`）：长度保持的 mask 把注释变空格、字符串变 `x`，
> 所以位置仍与源码一一对应；找顶层 `it(` 时要求前一个字符不是标识符字符（否则 `submit(`/`commit(` 会被当成 `it(`），
> 并吃掉回调 `}` 之后的 `)`、`,`、`;`（少吃掉 `)` 会留下孤立 `);`，第一版就这么把文件写坏过一次，已回滚重做）。

## A4. 判据①补的断言（不回显路径）

同体 ≠ 不回显。三面各自的 403/404 测试里各加一条：

```ts
expect(forbidden).not.toMatch(/\/agent-api|api\/audit|console\.forbidden|\b40[34]\b/);
```

列表腿比整页 `innerHTML`、详情腿比 `aud02-detail-denied` 的 `outerHTML`、校验腿比 `aud03-unavailable`，
三条**加完就过**：说明 `DeniedPanel` 本来就不渲染 `failure.technical`，路径与状态码确实没上屏（此前只是碰巧，没有东西钉住它）。

## A5. 本轮门禁（精确退出码）

```
$ cd web && npx tsc -b . --noEmit
TSC_B_EXIT=2        49 error TS 行：apps/shared=49、src/modules=0（与派单口径「49 项既有、不在本模块」逐字吻合）
$ cd web && ./node_modules/.bin/tsc --noEmit -p tsconfig.app.json
APP_TSC_EXIT=2      同一批 49 行，apps/shared=49、src/modules=0
$ cd web && ./node_modules/.bin/vitest run src/modules/audit
VITEST_EXIT=0   Test Files 5 passed (5)   Tests 94 passed (94)
$ cd web && ./node_modules/.bin/eslint src/modules/audit
ESLINT_EXIT=0   ✖ 3 problems (0 errors, 3 warnings)   ← 三条 useAuditData.ts set-state-in-effect 既有告警
```

> 两条 tsc 都是 **exit 2**，不是 0：49 行全部落在 `../apps/shared/src/*.test.ts`
> （`Cannot find module 'vitest'` 与隐式 any），`web/src/**` 零行。本车道只动 `modules/audit/**`，
> 既没有新增错误、也没有能力修 `apps/shared`（写域外）。先写台账时把这两条记成了 0，实测后按实测改回来。
> `tsc -b` 跑之前删过 `tsconfig.app.tsbuildinfo` 与 `node_modules/.tmp/*.tsbuildinfo`，不是增量缓存的假绿。

---

# TASK B — T27 工具与 MCP（本轮新交付）

写域：`web/src/modules/tools/**`。未碰 `manifest.ts`、`App.tsx`、`shell/**`、`pages/**`、i18n、锁文件；未跑 install。
`src/App.tsx:122` 原有的懒加载 `import("@/modules/tools/ToolsPage")`（具名导出 `ToolsPage`）保持不变，接线未断。

## B1. 端点与实探状态码（本机 BFF `127.0.0.1:8092`，无身份头）

| 页面发的路径（浏览器口径） | 直连 8092 的实测 | 服务自己的路径 | 实测 |
|---|---|---|---|
| `GET /agent-api/api/mcp/servers?limit=50` | **404** `console.not_found` — `static asset not found`<br>`X-Console-Request-Id: abd348f6b8cb4822a0221a9cb15d534c` | `GET /api/mcp/servers?limit=50` | **401** `console.unauthenticated` — `identity check failed`<br>`X-Console-Request-Id: f367c2f434fc4e7d84d56b5e7cf8ea4f` |
| 同上不带 `?limit` | **404** 同上，`rid=5d684612ba8341159f07b62f784f4bea` | — | — |

**结论照实写**：本机这套 serving 里 `/agent-api` 前缀没有代理到 BFF（`vite.config.ts` 的 proxy 表只列了 `/api`
与 `/dashboard-plugins`，`web/scripts/crawl-routes.mjs:78` 也自证「纯静态落点…无 /agent-api 代理」），
所以页面路径落到静态资源处理上 → 404；BFF 自己的 `/api/mcp/servers` 是 401（门在身份检查之前，与审计三面同一条门）。
两条都是 **没有真数据**，页面因此一面行数据也不画：404 走 denied 同体（含请求编号 + GAP-04），绝不画示例行。

> 这顺带修正 §6 的一句话：本轮实测 `/agent-api/api/audit?limit=50`、`/agent-api/api/audit/detail?id=…`、
> `/agent-api/api/audit/verify` 三个也都是 **404 `console.not_found`**（只有去掉 `/agent-api` 前缀才是 401）。
> §6 里「任何路径都是 401」对 `/agent-api/…` 这一形不成立，按实测改口。

## B2. 四态的触发方法（都是可复跑的口径）

| 态 | 怎么触发 | 屏上说什么 | 钉住它的测试 |
|---|---|---|---|
| loading | 让 fetch 永不 resolve（`new Promise(() => {})`）；真机上就是请求在途 | 骨架 4 条 + `正在读取连接…`，`tools-list` 不在 DOM | `loading is a skeleton, not an empty list` |
| empty | 服务真回 `{servers: [], total: 0}` | 「一条连接也没有」+「不代表读取失败」+ 下一步去处（原生 MCP 管理页）+ 重新读取 | `an empty answer explains itself and names the next step` |
| error | 401/4xx/5xx/连不上/回的不是清单 | 人话一句 + 可复制请求编号（缺号→「未提供」+`title` 原因）+ 重试；raw 只在折叠的「技术详情」 | `an error speaks human words…`、`a failure with no request id says 「未提供」 and why`、`a login gap…`、`an answer that is not a connection list is a failure…` |
| denied | 403 或 404（本机此刻就是 404） | 与 403 **逐字节同体**：不拼 status、不拼 raw、组件只收 `requestId`；含 GAP-04 一句；上面不留行 | `403 and 404 draw one identical body with no rows above it`（`toBe` 比整页 innerHTML）+ 不回显路径断言 |

## B3. 与上一轮 T27 的**偏离**（需要 L0 知晓）

`20c08e64`（caps 车道）当年按 `docs/_artifacts/caps/DONE.md:8` 的口径写的是「实时优先、**失败回落 fixture**
（`data-fixture="1"` + 示例数据徽章）」，并留了 `SERVER_FIXTURE` 四行。本轮派单判据是 **「No fabricated rows」**，
两者直接冲突，按派单执行：

- **删掉失败→示例行的回退腿**。以前 401/5xx 会画出一屏看着像真数据的连接行，环境坏掉反而更看不出来；
  现在失败就是失败（error / denied 两条腿之一）。
- **`SERVER_FIXTURE` 整个删除**，`tools.ts` 不再导出；`?state=` 复现腿也不再提供 `ready`
  （`ready` 不在 `FORCED` 表里，写 `?state=ready` 会照原样发真请求），所以**任何路径都不可能画出编造的连接**。
  测试 `a refused read falls back to no rows at all, never to sample data` 钉这条。
- 这条偏离**没有**回写 `docs/_artifacts/caps/DONE.md`（写域外）。GAP-04 的编号与含义沿用原台账：
  「BFF 尚未注册 `/api/mcp/servers` 代理」——它仍是这一面唯一真正的未接项。

## B4. 判据落点

- **不可用 / 状态未说明**：留在表上、`opacity-60` 写灰、`data-status` 可断言；不可用带原因，
  原因缺失写「原因未说明 —」+ `title`；状态不认识写徽章「—」+ 一句「既不写正常，也不写不可用」，
  **不降级成不可用，也不计进正常**。
- **缺值零假数据**：`declaredTotal` 没给 → 说「上游未声明一共有多少连接」，不写 `0`；
  检查时刻没给 → 「—」+ `title=服务未提供检查时刻`；名称没给 → 「—」+ `title`；
  回的行读不出是哪个连接 → 只计数（`另有 N 条…没有算在上面`），不画行。全仓 grep `?? 0`：本两模块 0 命中。
- **分母**：`列出 N / M`，M 来自服务声明；M>N 时补一句「这一页只回了 N 条」，不假装看完。
- **时间**：一律 `Asia/Shanghai` 到分并写明「最近检查（北京时间）」；epoch 秒/毫秒/ISO 三种写法都读，
  读不出的一律「—」，ISO 原文与 `T…Z` 不上屏（测试断言）。
- **工程语言**：`srv_…` 原始标识、`connected/disconnected` 状态原值、`{"code":"mcp.refused"}` 这类原因原值
  只进 `title` 和默认关闭的「技术详情」（关了就不在 DOM）；被折走的原因仍能在折叠里看到 `原因原值：…`。
- **fixture 标记**：`?state=` 复现腿在页根打 `data-fixture="<state>"`，说明行同时写
  「这是用 ?state=… 复现出来的状态，不是服务此刻的回答；数据源尚未接通（GAP-04）」；复现腿**不发请求**，
  且「重新读取」按钮 disabled 并写明为什么（不做点了没反应的死控件）。

## B5. TASK B 门禁（精确退出码）

```
$ cd web && npx tsc -b . --noEmit
TSC_B_EXIT=2      49 error TS 行：apps/shared=49、src/modules=0
$ cd web && ./node_modules/.bin/vitest run src/modules/audit src/modules/tools
VITEST_EXIT=0     Test Files 7 passed (7)   Tests 139 passed (139)
                  ← audit 5 files/94 + tools 2 files/45
$ cd web && ./node_modules/.bin/eslint src/modules/audit src/modules/tools
ESLINT_EXIT=0     ✖ 3 problems (0 errors, 3 warnings)
                  ← 三条全是 useAuditData.ts 既有 set-state-in-effect 告警；
                    tools 侧一开始多出第 4 条（effect 里同步 setState），
                    已改成「读取结果按 attempt 存、不匹配就当 loading」，回到 3 条，本模块 0 告警
```

## B6. 本轮新增文件

`web/src/modules/tools/tools.ts`（数据层，重写）、`states.tsx`（本模块自己的四态面板）、
`useToolsData.ts`（读取与四态）、`ToolsPage.tsx`（页面，重写）、`tools.test.ts`（纯层 20 例）、
`ToolsPage.test.tsx`（页面 25 例，重写）；`tabNav.ts` 只改了头注释里那句已经过时的「honest fallback」。

## B7. 未验项（照实留）

1. **2xx 真负载一个样本都没有**：`tools.ts` 的键候选表（`servers/items/data/…`、`status/state/health`、
   `lastCheckedAt/…`）是按本仓既有写法猜的，未经采样；真数据到达可能要回填。
2. `?limit=50` 这个参数名服务端认不认未验；服务端若不认会回 400，页面已有「筛选条件没被接受」的人话腿。
3. **1440 / 375 像素级横溢未实测**：页面没有接进 shell（`App.tsx`、`shell/**` 在写域外），本机也没有
   可看的浏览器落点；按 `flex + min-w-0 + break-words + break-all` 写的，请求编号用 `break-all` 保证 32 位十六进制撑不宽 375 列。
4. 视觉/截图核对：未做。
5. `../apps/shared` 的 49 项 tsc 既有错误：写域外，未修。
6. 「重新读取」在真实 401 环境下的登录跳转：本模块只读、不碰会话，未实现也未验（与审计三面同口径）。
