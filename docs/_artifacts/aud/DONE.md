<!-- Ledger discipline (2026-11-19): the authoritative ledgers live only in the forks/hermes-agent main tree. This module worktree must never commit modifications of docs/_artifacts/tonight/**; before any commit run `git reset -q HEAD -- docs/_artifacts/tonight`, and when a merge resurrects old ledgers restore them with `git checkout origin/lane/hermes-console -- docs/_artifacts/tonight`. Page evidence for this lane goes to docs/_artifacts/aud/**. -->
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

---

# TASK T11 — 用量与成本（`web/src/modules/duty/UsagePage.tsx`，本轮交付）

派单：T11 usage & cost，写域 `web/src/modules/duty/**` + 本文件。基线 `4bfb31ef`。
日期 2026-11-19（Asia/Shanghai）。**本轮未声称任何 vite entry sha。**

## C1. 端点与实探状态码（本机 BFF `127.0.0.1:8092`，无身份头，`curl` 实测）

| 请求 | 结果 | 处置 |
|---|---|---|
| `GET /agent-api/api/hermes-usage?days=30`（页面真调用形） | **404** | 本机 serving 无 `/agent-api` 代理（与 §B1 同一条环境事实），页面走 denied 腿，不画任何行 |
| `GET /api/hermes-usage?days=30`（去掉代理前缀直连 BFF） | **401** | 门在身份检查之前；未认证，拿不到 2xx 样本 |
| `GET /api/budget-usage` | **401** | 本页金额只取 usage 响应自带的 `cost` 账本块，未单独调 budget-usage（口径同 `docs/_artifacts/duty/DONE.md` T11 段） |

三条都是**没有真数据**。页面因此一条金额也不编：`docs/_artifacts/aud` 之外不新数仓，
`hermes-usage` 的 2xx 形态在派单台账里**从未被采到**（见 C5）。

## C2. 判据落点

- **金额只看账本实扣**（`usage.ts` `costCell`，页面层无第二算法）：`cost_status:"upstream"` 才呈现数字，
  真实 0 → `$0.00`；缺失 → 「—」+ 短句原因（卡内直接写在旁边，表内写进单元格 `title`）；
  `unknown` → 「—」+「账本记为未计价」；`estimated`/`mixed` → **不伪装成已花费**，「—」+「含估算，不作实扣呈现」；
  `source` 非 `cost_ledger/ledger` → 「—」+「不是成本账本记的实扣」；状态词不认识 → 徽章「—」，不猜。
  无前端计价、无求和、无二次舍入；`grep '?? 0\||| 0'` 在本页四个文件 0 命中（仅注释提及）。
- **窗口过滤器是真的**：`usg4-window` 选 24h/7d/30d → 请求 `?days=1 / 7 / 30`，三个窗口三张不同的 URL；
  纯层逐字断言（`usage.test.ts`「each window builds its own URL」），页面层实测切换后新请求落地
  （`UsagePage.test.tsx`「24h and 7d each rebuild the URL」）。端点支持 `days`（上轮 T11 即按此调用），
  控件不是死控件。
- **时间与币种**：`as_of` 一律 `Asia/Shanghai` 到分（复用模块既有 `beijing()`），缺失 → 「—」+ 原因；
  金额 USD；原始 ISO、`employee:` 句柄、`cost_ledger/upstream` 状态原值、HTTP 码只进 `title`
  与默认关闭的「技术详情」（关=不在 DOM）；员工显示「员工 · 8位短码」。
- **四态**（`useUsageData.ts`，attempt+window 双键存储，effect 内零同步 setState，见 C4 lint 数）：
  loading 骨架非零值卡；empty 带原因+下一步（换窗口/等用量）；error 人话+**可复制请求编号**
  （缺号→「未提供」+ `title` 原因）+重试；denied 403≡404 **逐字节同体**（`outerHTML` `toBe` 断言，
  组件只收 `requestId`，两份 403/404 的 body 不同也不外泄），上面不留一行数据。
  回答不是用量对象 = error（shape 腿），不是 empty。
- **无占位/计划文案**：整页无「planned/敬请期待」；未接通之处只有 denied/empty 腿上的真话 + GAP。
- **fixture 纪律**：`?state=` 四腿（loading/empty/error/denied）**不发请求**（测试断言 fetch 调用数 0），
  根节点 `data-fixture="<state>"`，说明行带 **GAP-07**；`ready` 不在复现表里，`?state=ready` 会照发真请求
  （有测试钉住）；复现腿上窗口选择与「重新读取」disabled 并写明原因，不做点了没反应的死控件。
  本轮**没有**新增任何示例数据行（GAP-07 是编号新号，已核 `docs/_artifacts/**` 与 `web/src` 无撞号，
  现有 GAP-01…GAP-06）。
- **横溢**：外层 `flex/grid + min-w-0`，长词 `break-words`，请求编号 `break-all`；宽表只在卡内
  `overflow-x-auto` 滚动（家机口径：行数多时只允许表格内部滚动）。

## C3. 本轮文件（全在写域内）

新增 `web/src/modules/duty/usage.ts`（纯数据层）、`useUsageData.ts`（四态钩子）、
`usage.test.ts`（纯层 24 例）、`UsagePage.test.tsx`（页面 21 例）；重写 `UsagePage.tsx`
（testid 全部换 `usg4-*`，旧 `usage-*` 无 shell 侧消费者，已核 `src/shell/*.test*` 不引用）。
`api.ts`/`format.ts` 未改（`BFF`、`beijing`、`usd`、`dashed` 直接复用）。

## C4. 门禁（精确退出码）

```
$ cd web && npx tsc -b . --noEmit
TSC_EXIT=2      49 error TS 行：apps/shared=49、src/modules/**=0（含 src/modules/duty=0，与基线一致）
$ cd web && ./node_modules/.bin/vitest run src/modules/duty
VITEST_EXIT=0   Test Files 3 passed (3)   Tests 49 passed (49)
                ← dutyPage.test.tsx 4（既有）+ usage.test.ts 24 + UsagePage.test.tsx 21
$ cd web && ./node_modules/.bin/eslint src/modules/duty
ESLINT_EXIT=0   ✖ 3 problems (0 errors, 3 warnings)
                ← 三条全是既有 MatrixView(×2)+useDutyData(×1) 的 set-state-in-effect/exhaustive-deps 告警；
                  重写前的 UsagePage.tsx 原有 2 条（effect 同步 setState、memo 无法保留），
                  本轮按 attempt 双键存储的写法清零，本模块新增文件 0 告警
```

## C5. 未验项（照实留）

1. **`hermes-usage` 真 2xx 样本为 0**：`as_of/period_days/cost.cost_usd/cost_status/rows/per_employee`
   键名取自上一轮 T11 静态页的既有读法（`docs/_artifacts/duty/DONE.md`），**本轮未采到真身**；
   真数据到达可能要回填键名。
2. `days=1/7/30` 是否被上游真的按窗口过滤：本机无代理（404）、直连需登录（401），**未实测**；
   页面侧已证「URL 真的变」。
3. `?budget-usage` 独立调用：本页未接（金额随 usage 响应 cost 块），口径沿用，如 BFF 要求拆分需下阶段补。
4. **1440 / 375 像素级横溢未实测**（无浏览器落点，同 §B7-3 口径）；按 `flex + min-w-0 + break-words + break-all` 写。
5. 视觉/截图核对：未做；明主题未验（本模块用白透明色阶，与 DutyPage 同风格）。
6. `../apps/shared` 的 49 项 tsc 既有错误：写域外，未修。

---

# TASK T29/T24（小手术）— 数据源面的 `ds4-*` 测试 id（2026-11-19）

派单：给 channels 模块的 T24 数据源账本补 `ds4-*` 稳定测试 id，**不改任何行为、文案、布局、数据逻辑**；
`chn4-*` 一律保留原值、原位、原精确匹配。

## T1. 加了哪些 id（`web/src/modules/channels/ChannelsPage.tsx`）

- `ds4-ledger`：`SourcesLedger` 的 `CardContent`（`chn4-sources` 的 Card 根仍在，包着它）。
- `ds4-row`：每条账本行的内容容器 `div`；外层行 div 仍是 `chn4-source-<N>`（`data-status`、`data-gap` 不动），
  断言用 `closest("[data-status]")` 回到行。
- `ds4-status`：账本徽章的 `display: contents` 包裹 `span`（仓内既有模式，见 `App.tsx:1347`），
  徽章本体继续拿 `chn4-source-<N>-badge`；渠道行的徽章不带 marker，零变化。
- `ds4-gap`：`缺口编号 GAP-…` 那个 `<p>`（此前没有 testid，直接落位）。
- `ds4-request`：**没有加**——这一面是只读的，全模块 grep「申请」0 命中，不存在申请入口链接/按钮；
  按判据不造控件。

## T2. 新增断言（`ChannelsPage.test.tsx` 新 describe「the data-source ledger carries its own ds4-* ids」，3 例）

1. `ds4-ledger` 包住 4 条 `ds4-row`，且 `chn4-source-2`、`chn4-source-2-details`、`chn4-row-0-badge` 仍按原值可查；
2. 4 个 `ds4-status` 逐一与所在行 `data-status` 的词对上（已接入/未接入/未知），徽章的 chn4 id 共存；
3. 端点缺席的行上 `ds4-gap` 带缺口编号（fixture 里 3 个：GAP-08×2、GAP-04×1），答到了的那行没有 gap 单元格。

## T3. 门禁（精确退出码）

```
$ cd web && npx tsc -b . --noEmit
TSC_EXIT=2        49 error TS 行：全部在 ../apps/shared；src/modules/channels=0、shared 以外=0（与基线一致）
$ cd web && ./node_modules/.bin/vitest run src/modules/channels
VITEST_EXIT=0     Test Files 2 passed (2)   Tests 77 passed (77)   Duration 1.10s
                  ← 原 74（channels.test.ts 38 + ChannelsPage.test.tsx 36）+ 本轮 3
$ cd web && ./node_modules/.bin/eslint src/modules/channels
ESLINT_EXIT=0     无输出（0 problems）
```

## T4. 端点实探状态码（本轮重跑，本机 BFF `127.0.0.1:8092`，`L4ConsoleBFF/0.1`，无身份头）

```
GET /api/messaging/platforms?limit=50   -> 401
GET /api/channels?limit=50              -> 401
GET /api/datasources?limit=50           -> 401
GET /api/mcp/servers?limit=50           -> 401
GET /api/gateway-connections?limit=50   -> 401
GET /api/connectors?limit=50            -> 401
响应头样例：X-Console-Request-Id: a98c795132e841c9b801c66fd44dd991
```

门在路由之前：六条全部 401，带不带筛选从外部分辨不出来；前端 401 走「登录状态已经失效」人话腿，
不画任何行。真实 2xx 下 `ds4-gap` 是否缺席、GAP 编号是否变化，仍要真身份才能验。

## T5. `?state=` 复现腿与 `data-fixture` 值

- 腿值：`loading` / `empty` / `error` / `denied`（页根 `data-fixture="<state>"`，`chn4-page` 上）；
  写 `?state=ready` 不发复现、照真读取且不打 `data-fixture`（既有测试钉住）。
- 复现腿页面同时打「这是用 ?state=… 复现出来的状态」+ GAP-08；复现腿不发请求，`chn4-retry` 与筛选禁用。
- 复现的 loading/empty/error/denied 四腿账本为空 → `ds4-*` 也不存在（`SourcesLedger` 空表返回 null），与 `chn4-sources` 同进退。
- 测试里的 fixture 值（非屏上）：`byUrl` 用 `/agent-api/api/messaging/platforms` 回 2xx、其余路由统一
  `ApiError 404 {"code":"console.not_found"}`（requestId `chn-probe`）。

## T6. 未验项（照实留）

1. `contents` 包裹的像素级回归：类名与 `App.tsx:1347` 同款、jsdom 无布局，1440/375 未截图实测；
   理论上 `display:contents` 不产生盒子，徽章位置与间距不应变。
2. 真身份（2xx 真负载）下的 `ds4-*` 行为：本机没有可过 `identity-check` 的身份头，未验。
3. `ds4-request` 缺席的判定依据是当前模块无申请入口；若后续接入带申请入口的真实渠道面，需另补 id 与断言。
4. 页面接线（shell 路由）仍归接线车道；本轮只动 `web/src/modules/channels/` 两文件 + 本段。

---

# TASK T15（PRD v4.1）— 运行列表 + 运行详情（2026-11-19，基线 `780cc513`，每页一 commit）

派单口径：写域 `web/src/modules/runs/**` + 本段；`run5-*` testid；`?state=` 复现腿带 `data-fixture`+GAP 且零请求；
真端点、真状态码、零编造行。旧的 `runsPage.ts` 与上一轮 T15 页面整体按 v4.1 重写。

## T15.1 本轮文件（全在写域内）

- 新增 `web/src/modules/runs/runs.ts`（数据/口径层）、`states.tsx`（四态面板）、`useRunsData.ts`（列表读取）、
  `useRunDetail.ts`（详情读取）、`runs.test.ts`（数据层 21 例）。
- 重写 `RunsModulePage.tsx`、`RunsModulePage.test.tsx`（页面 30 例）；删除 `runsPage.ts`。

## T15.2 端点实探状态码（本机 BFF `127.0.0.1:8092`，`L4ConsoleBFF/0.1`，无身份头，`curl` 实测 2026-11-19）

```
GET  /api/runs?since=2026-10-20T04:36:37Z&limit=30          -> 401  rid a91c9379dde14714b039d547281bc8a8
GET  /api/run-stats?from=2026-10-20T04:36:37Z&to=…           -> 401  rid 47b62c4c5eea41fd811de46157a2866f
GET  /api/run-detail?id=rn_probe                              -> 401  rid c10419aa712f4402becd7e496c5d0da7
GET  /api/run-events?runId=rn_probe&limit=50                  -> 401  rid a564a250daa648fd8a5f829a33afac41
POST /api/run-retry {"runId":"rn_probe"}                      -> 401  rid c9f13bbda1aa4a26afc36cfd53d0958f
（每一次都给新 X-Console-Request-Id；X-Console-Reason: identity-check-failed；
 body {"code":"console.unauthenticated","message":"identity check failed"}）
```

门在路由之前（见本文件 §6）：外部无法分辨路由是否注册。前端把 401 走「登录状态已过期，重新登录后再刷新就能看到」
人话腿 + 可复制请求编号 + 重试，**没有编造任何行、总数或成本**。详情写腿失败时上屏
「新建运行的写入还没有在本控制台接通（GAP-09），本页没有替你发起任何新运行」并带编号，不发生假跳转。

- 列表主路由 `/api/runs`（参数 `since/limit/status`，与 duty 模块 `fetchRuns` 同源拼法）；
  回落 `/api/run-stats` **只在 404 时发生**，且按其真实参数名 `from/to` 发问（RUNS-01 审计实测 `since`/`window` 会 400），
  回答必须真的是 `items[]` 列表形状才上屏，汇总桶一律读作「这份回答不是运行列表」。
- `GAP-09` 为本车道新取号：落笔前 grep `web/src/**` 与 `docs/_artifacts/**`，GAP-01…GAP-08 已被占，09 空闲。

## T15.3 四态的触发方法（可复跑口径）

| 状态 | 真实触发 | `?state=` 复现 |
|---|---|---|
| 加载中 | 请求在途（骨架，非「0 条」） | `?state=loading` |
| 空态 | 2xx 且 `items:[]` →「读取成功，窗口没有运行」+ 下一步 + **挣得的 0** | `?state=empty` |
| 错误 | 400/401/429/5xx/0 → 人话 + 可复制请求编号（缺→「未提供」）+ 重试；400 专句「这次筛选没有被接受」 | `?state=error` |
| 不可见 | 403，或两条列表路由都 404 → 同一份正文（只带编号），无路径、无代码词、上方无任何行 | `?state=denied` |

详情腿：`?run=<完整 id>` 深链或行内「查看」；403/404 走与列表同一 `DeniedPanel`（testid `run5-detail-denied`）；
事件流单独失败时保留运行本体，写明「事件流这次没读到」+ 重新读取事件。

## T15.4 `data-fixture` 值

- 腿值：`loading` / `empty` / `error` / `denied`，同时打在页根 `run5-page` 与对应面板上；
  复现腿页上打「这是用 ?state=… 复现出来的状态…（GAP-09）」，**零请求**（列表、详情、员工名侧读都被 URL 门挡住，
  测试用「任何 fetch 即抛错」的 mock 钉死），刷新与筛选禁用。
- `?state=ready` 不算复现：走真实读取且页根无 `data-fixture`（测试钉住）。

## T15.5 门禁（精确退出码）

```
$ cd web && npx tsc -b . --noEmit
TSC_EXIT=2        49 error TS 行：全部在 ../apps/shared/**（基线同款）；
                  grep -v '^\.\./apps/shared' 后 error TS 行数 = 0；src/modules/runs = 0
$ cd web && npx vitest run src/modules/runs
VITEST_EXIT=0     Test Files 2 passed (2)   Tests 51 passed (51)   Duration 952ms
                  ← runs.test.ts 21 例（列表路由/回落参数/形状门/口径/详情层/重试）
                    + RunsModulePage.test.tsx 30 例（四态、复现腿零请求、403≡404 逐字节、
                      深链筛选真改请求、详情时间线/成本三态/重试新建并切换/上游短码/未提供编号）
$ cd web && npx eslint src/modules/runs
ESLINT_EXIT=0     无输出（0 problems；上一版残留的 4 条 set-state-in-effect 告警随重写清零）
```

未跑 vite build，不声称任何 entry sha（派单禁令）。

## T15.6 与上一轮 T15/QA 口径的**偏离**（需要 L0 知晓）

1. testid 全族换代为 `run5-*`（本单硬性）；旧 `runs-*`/`run-row-*`/`run-retry-planned` 不复存在。
2. 请求编号缺席话术由 QA V4-R4 的「本次请求未记录编号，可复制时间与操作路径反馈」改为 v4.1 指定的「未提供」
   （缺席原因保留在 `title`）。
3. 旧错误/不可见卡上的「返回控制台 / 联系管理员」出口链接撤除：v4.1 把错误体钉为「人话+可复制编号+重试」，
   不可见体必须 403≡404 逐字节同文，带链接会把两条真回答的差异面带上来。
4. 列表列按本单钉死为 运行/状态/开始/耗时/成本（美元）/失败原因 + 行内「查看」；
   员工/任务列撤下（员工名只出现在详情，读不到时掩码为「员工 · 后4位」，裸 `emp_` 测试断言不上屏）。
5. 重试从「disabled 占位」变为真实语义腿：POST `/api/run-retry` → 回答里必须带**新 id** 才切换导航；
   写不接通就上屏 GAP 话术——按钮不再是死控件，也不假装成功。
6. run-stats 回落腿的问法修正（`from/to`）随详情 commit 落地（列表 commit 之后的复核中改掉）。

## T15.7 未验项（照实留）

1. 1440/1280/375 像素级横溢：本车道禁装依赖、无浏览器夹具，未实测；结构面全量沿用
   `min-w-0`/`minmax(0,…)`/`break-words`/flex-wrap 纪律（375 下列表 2 列堆叠、编号 32 位十六进制走 break-all）。
2. 真身份 2xx 下的字段名未经采样：`costStatus` 枚举、事件 `payload.resultRef` 拼法、run-retry 回答形状
   都只有候选表；真数据到达需回填。
3. `/api/run-retry` 的路径名没有仓内路由表证据（RUNS-01 材料只证读写语义）；门在路由前，401 分不出注册与否。
4. `status=` 枚举值是否被 BFF 接受（RUNS-01 曾见 `status=open` 422 未走统一信封）未验；400 腿话术已就位。
5. 403≡404 同体的真实身份验证（现网 `console.forbidden` vs `console.unknown_route`）未做，只有测试内逐字节断言。
6. 接线：页已由上游壳挂好（`App.tsx` `ConsoleRunsAdapter` → `/runs`，`/work?tab=runs` 同组件）；本车道未动壳。
7. `pnpm-lock.yaml` 未验证——未跑 install，未改锁。

# R10 收口 — audit/channels 挂载契约 + 账本纪律 + 验收证据（2026-11-19，基线 `17066e23`）

本轮零代码改动，只落契约与证据。路由不动：`App.tsx`、`web/src/shell/**`、任何
`manifest.ts`、`pages/**`、`web/scripts/**`、`package.json`/`pnpm-lock` 均在本车道写域外。

## R10.1 挂载契约（给 R5 写入方）

两个模块的页面组件全部**零 props**，状态只从 react-router 的 `useSearchParams` 读，
挂载即渲染，不需要向组件传任何东西。

### audit 三面（模块入口文件 → 导出组件名）

| 期望路径 | 入口文件 | 导出 |
|---|---|---|
| `/audit` | `web/src/modules/audit/AuditEventsModulePage.tsx` | `AuditEventsModulePage`（具名 + default） |
| `/audit/detail?id=` | `web/src/modules/audit/AuditDetailModulePage.tsx` | `AuditDetailModulePage`（具名 + default） |
| `/audit/verify` | `web/src/modules/audit/AuditVerifyModulePage.tsx` | `AuditVerifyModulePage`（具名 + default） |

查询参数口径：
- `?id=`：列表页的行内选中与详情页的事件定位共用同一参数（列表页写 URL，分享链接可直达详情）。
- `?state=`：复现腿，合法值 `loading` / `empty` / `error` / `denied`
  （`useAuditData.ts:27`），值外一律按真实数据走。
- `?tab=`：壳现状把 `#/audit` 作为 `#/system?tab=events` 的 compat 别名
  （`shell/routes.ts:257`），`audit/tabNav.ts` 的清单也按「审计事件是 `/system` 的
  `?tab=events` pane」声明（icon 用 `ICON_MAP` 已有键 `Shield`，不新增 App.tsx 条目）。
  R5 若把 `/audit` 直接挂为独立路由，应同时改掉这条别名行的指向，两处口径必须一致。

### channels（数据源面）

| 期望路径 | 入口文件 | 导出 |
|---|---|---|
| `/channels` | `web/src/modules/channels/ChannelsPage.tsx` | `ChannelsPage`（具名 + default） |

查询参数口径：`?status=` 筛选（合法值 `available` / `unavailable`，其余按 `all`，
`channels.ts:451`）；`?state=` 同上四值（`useChannelsData.ts:29`）。壳侧现状：
`shell/routes.ts:301` 的冲突表记明 App 既有路由 `/channels` 当前指向**上游英文壳
ChannelsPage**（复用为 `capabilities?tab=channels`）。因此浏览器里 `/channels` 仍显示
上游英文壳——这是 **R5 接线缺口**，不是本车道模块语义：本车道的中文数据源面没有任何
一行代码被挂到路由上。R5 接线时按上表把 `/channels`（或 `#/channels` 别名）重定向到
本模块 `ChannelsPage` 即可。

## R10.2 账本纪律（本车道长期有效）

1. 提交前必跑 `git reset -q HEAD -- docs/_artifacts/tonight`——tonight 账本不是本车道写域，
   任何索引残留都不许进 commit。
2. merge 若复活旧 tonight 账，用 `git checkout origin/lane/hermes-console -- docs/_artifacts/tonight`
   取回上游权威版，不手改。
3. 本车道证据只写 `docs/_artifacts/aud/**`；不引用 tonight 账本里的任何数值作为本轮依据。

## R10.3 DOM 读数说明（为何没有）

模块页面未接路由（R10.1），且本环境禁 install、无浏览器夹具，`/audit`、`/channels` 在
真实浏览器里根本到不了本车道组件——**DOM 读数无法产出，本轮不伪造任何 DOM 数值**。
可用证据面 = 模块级渲染测试（vitest + testing-library，见 R10.5）+ 源码 grep（R10.4）。

## R10.4 grep 证据（2026-11-19 实测）

`web/src/modules/channels/**` 英文壳字符串（必须 0，实测全 0）：

```
'The gateway is not running'  0
'channels configured'         0
'of 0 channels'               0
```

`web/src/modules/channels/**` 中文语义证据（V4 判据）：

```
未接入: 17   平台接入: 17   数据源: 34   未启用: 0   禁用: 0
```

（「未启用」「禁用」两词本模块话术未使用，缺席照实记；不可用语义由「未接入」承担。）

`web/src/modules/audit/**` 语义判据：

```
北京: 11   Asia/Shanghai: 1   请求编号: 34   未提供: 18   技术详情: 21   本环境未启用: 12
DeniedPanel: 6 处引用（定义在 states.tsx:202）
```

403/404 同体：单一 `DeniedPanel`（`states.tsx:201` 注释「403 and 404 both land here,
and they read exactly the same」），`api.ts:130` `isDenied = status === 403 || status === 404`，
列表/详情/校验三面全部路由进同一面板，无 403/404 分支文案。

## R10.5 门禁（精确退出码）

```
$ cd web && npx tsc -b . --noEmit
TSC_EXIT=2        49 条 error TS，全部在 ../apps/shared/**（基线同款，环境未装其 devDeps）；
                  grep -v 前缀后 error TS 行数 = 0；src/modules/** = 0

$ cd web && npx vitest run src/modules/audit src/modules/channels
VITEST_EXIT=0     Test Files  7 passed (7)   Tests  171 passed (171)   Duration 1.12s

$ cd web && npx vitest run          （全量）
VITEST_FULL_EXIT=0  Test Files  111 passed (111)   Tests  1002 passed (1002)   Duration 8.91s
                    无既有失败，零文件名可贴

$ cd web && pnpm run build
BUILD_EXIT=1      耗时 4.8s（wall）。死在 scripts/build/web.mjs 的 typecheck 段：
                  该段对整 solution（含 apps/shared）跑 tsc -b，被上述 49 条基线外错误拦停，
                  未进 vite 段。工作树本轮零代码改动，同因在 HEAD 即存在——环境性（禁 install），
                  与车道代码无关（错误面 src/modules = 0）。

$ cd web && npx vite build --outDir <tmp>/aud-build --emptyOutDir   （绕 typecheck 段的补测）
VITE_EXIT=0       ✓ built in 3.08s   （仅补出包证据；产物落仓外临时目录，未触碰仓内文件）
```

## R10.6 未验项（照实留）

1. 真浏览器 DOM 读数：未接线 + 禁 install，无落点（R10.3），未伪造。
2. `/channels` 上游英文壳在真实路由上的消退：要等 R5 接线后复测。
3. `pnpm run build` 全链通过：被 apps/shared 基线错误拦停，只有分离的两段证据
   （tsc 基线口径 + vite 段单独通过）。

---

# TASK COLLAB（协作委托只读页）— 2026-11-19，基线 `44eedfaa`，branch `lane/console-aud`

派单口径：写域 `web/src/modules/collab/**` + 本段；`col4-*` testid；真端点、真状态码、零编造行；
`?state=` 复现腿带 `data-fixture` + GAP 且零请求；页面内零写控件；未碰 `App.tsx`、`shell/**`、任何
`manifest.ts`、`pages/**`、`web/scripts/**`、`package.json`/锁文件、其它 modules、i18n；未跑 install。

## CL1. 挂载契约（给 R5 写入方）

| 项 | 值 |
|---|---|
| 入口文件 | `web/src/modules/collab/CollabDelegationsModulePage.tsx` |
| 导出 | `CollabDelegationsModulePage`（具名 + default） |
| props | **零 props**；状态只从 react-router `useSearchParams` 读，挂载即渲染 |
| 期望路由 | `/collab`（浏览器路径，与 `App.tsx` 既有 `/runs`、`/audit` 同族） |
| 可接受 query | `?state=loading|empty|error|denied`（复现腿）；其余 query 一律忽略 |
| 面包屑去向 | `控制台` → `/overview`（本页只此一个链接，真实存在） |
| 写动作去处 | 只出文字：接受／拒绝／交接／完成 归任务详情，本页不代为操作（无灰按钮、无死控件） |

命名说明：文件名落在 `shell/bridge.ts` 的 `../modules/*/*ModulePage.tsx` glob 上（vite 已把它切成
懒块 `CollabDelegationsModulePage-DnHeuRfD.js`，见 CL5），R5 只需照 `RunsModulePage` 的
`pickModulePage([...])` 形状加一条即可，不必改本页。

### 需壳层注册的路由清单（交 R5）

1. 注册 `/collab` → 懒加载 `web/src/modules/collab/CollabDelegationsModulePage.tsx` 的
   `CollabDelegationsModulePage`（零 props）。
2. 侧栏项：`App.tsx` 现有 `{ path: "/collaboration", label: "协作", placeholder: true }`（`App.tsx:330`）。
   本页的期望路径是 `/collab`。两种收尾都算接线完成，但**必须只留一个真页**：
   - A（推荐）：把该条目的 `path` 改为 `/collab` 并去掉 `placeholder`；
   - B：保留 `/collaboration` 作 compat 别名重定向到 `/collab`（照 `shell/routes.ts` 的 REDIRECTS 口径，
     别名不进导航）。
3. `web/src/shell/routes.ts`：把 `/collab`（以及若选 B 的 `/collaboration` 别名）补进 ROUTE_TABLE，
   `data-src` 写 `GET /agent-api/api/delegations`；本页 `kind` 应为 `planned`——
   读口在本机没有采到任何 2xx 样本，直到真实身份联调通过才可改 `reuse`。
4. `web/src/lib/api.ts` 的 `CONSOLE_SURFACE_PATH_RE`（`api.ts:263`）不含 `collab`：本页已用
   `fetchJSON(..., { allowUnauthorized: true })` 自行绕开 401 的整页 reload，所以 R5 **不必**改这一行；
   若后续把 `/collab` 并入「壳统一处理 401」那一族，请同时去掉本页的这个选项，别两处都管。
5. 未新建、未编辑任何 `manifest.ts` / `tabNav.ts`：本页不进 22-tab 表，直到路由与读口都落定。

## CL2. 端点实探状态码（2026-11-19 13:14 CST 本机实测，非推断）

页面只发一条请求：`GET /agent-api/api/delegations?limit=50`（`/api/` 段保留）。直连 `127.0.0.1:8092`
（`L4ConsoleBFF/0.1 Python/3.9.6`，无身份头）实测：

```
GET /agent-api/api/delegations?limit=50  -> 404  rid 7b2027efc9044bd4b52d1cb9de4b0795
     body {"code": "console.not_found", "message": "static asset not found"}
GET /api/delegations?limit=50            -> 401  rid 61202b1f3a38499c81e104e78a13b539
     X-Console-Reason: identity-check-failed
     body {"code": "console.unauthenticated", "message": "identity check failed"}
GET /agent-api/delegations（丢掉 /api/ 段）-> 404  rid 10410570bffe4bb0a3f690d595372d45
对照同族：GET /agent-api/api/runs        -> 404  rid 7d0158d3a01b4e74a936c0f574332071
          GET /api/runs                  -> 401  rid a0b9292ba9d044d7be5bf73db3e3b5e2
另一个落点（上游 dashboard `127.0.0.1:9119`，uvicorn）：
          GET /api/delegations           -> 401  {"detail":"Unauthorized"}（无 X-Console-* 头）
          GET /agent-api/api/delegations -> 200  text/html（SPA 兜底页，不是接口回答）
```

读数口径（照实，不美化）：
- **8092 上带 `/agent-api` 前缀的那条拼法回答 404**，因为该端口把 `/agent-api/…` 当静态路径找；
  `/agent-api` 前缀归网关，网关剥掉后才落到 `/api/delegations`，那里才是 401 的身份门。
  同一现象在同族的 `/agent-api/api/runs` 上复现，所以这不是本路端的拼法问题，而是**两个端口两套门**。
- 派单口径说「无身份会 401」在 `/api/delegations` 上成立（已实测）；在 `/agent-api/api/delegations`
  的直连腿上是 404。本页对 404 的处理是 **denied 同体腿**（与 403 逐字节同体），对 401 的处理是
  **「需要登录」腿**——两条腿都不画行、都不写零、都不编数据。
- 9119 的 `/agent-api/api/delegations` 返回 200 + HTML：那不是接口回答，`fetchJSON` 解析不成
  委托列表，本页读作 error 腿并写明「这份回答不是委托清单」，绝不按 HTML 画行。

## CL3. 四态触发方式（可复跑口径）

| 状态 | 真实触发（本机可复跑） | `?state=` 复现 | 页面 testid |
|---|---|---|---|
| 加载中 | 请求在途（骨架屏，不是「0 条」） | `?state=loading` | `col4-loading` |
| 空态 | 2xx 且 `items:[]`（本机无身份，**未采到**，只在测试里以 2xx 驱动） | `?state=empty` | `col4-empty` |
| 错误 | 400/429/5xx/连不上/200 非列表形状 → 人话 + 可复制请求编号（缺失显「未提供」）+ 重试 | `?state=error` | `col4-error` |
| 不可见 | 403，或 404（本机 `/agent-api/api/delegations` 直连即是 404）→ 与 403 逐字节同体、同 code+rid、不回显路径、上方无任何行 | `?state=denied` | `col4-denied` |
| 需要登录 | 401（`/api/delegations` 直连即 401，`X-Console-Reason: identity-check-failed`）——**不是错误腿**：中性卡、无 `role=alert`、无行、无计数，给「登录后回到本页重新读取」+ 请求编号 | 不设复现值（真读专属） | `col4-login` |

- 列（6 条，只读）：委托方 / 受托方 / 范围（可做什么、对谁）/ 状态人话 / 生效至（北京时间到分）/ 来源；
  两侧姓名口径 `姓名 · 8 位短码`，只有句柄时 `委托员工|受托员工 · 短码`，受托方无归属时 `未指派`；
  裸 `emp_…` / `human:…` / 全串只进 `title` 与折叠「技术详情」。
- 状态词表按冻结的 DELEGATION v1.0：`requested/accepted/handed_off/completed/rejected/expired` →
  已提出，等待接受／已接受／已交接回发起方／已完成／已拒绝／已过期；不认识的说「状态未识别」，
  原文进 `title`，永不裸上屏。

## CL4. `data-fixture` 值

- 腿值：`loading` / `empty` / `error` / `denied`，同时打在页根 `col4-page` 与对应面板上；
  复现腿页上打「这是用 ?state=… 复现出来的状态…（GAP-10）」，**零请求**（测试用「任何 fetch 即抛错」
  的 mock 钉死），`col4-refresh` 与面板重试全部 disabled 并写明原因。
- `?state=ready` 与其余值不算复现：走真实读取且页根无 `data-fixture`（测试钉住）。
- 401「需要登录」腿**没有** `data-fixture` 值：它只能由服务真回答出来，复现腿无法伪造一个登录状态。

## CL5. 门禁（精确退出码）

```
$ cd web && npx tsc -b . --noEmit
TSC_EXIT=2        49 条 error TS 行，全部在 ../apps/shared/**（基线同款）；
                  grep -v '^\.\./apps/shared' 后 error TS 行数 = 0；src/modules/collab = 0 条

$ cd web && npx vitest run src/modules/collab
VITEST_EXIT=0     Test Files  2 passed (2)   Tests  84 passed (84)   Duration 0.78s
                  ← delegations.test.ts 47 例（路由逐字/单条请求/形状门/401≠error/403≡404 同句同码/
                    短码与「未指派」/状态与来源词表/北京时间到分/生效三态）
                    + CollabDelegationsModulePage.test.tsx 37 例（真路由只问一次、六列表头逐字、
                      行上屏零工程语言、四态与登录腿、403≡404 outerHTML 逐字节、复现腿零 fetch、
                      重试真生效、零写控件穷举（每个 button 必须归 重新读取/复制/技术详情 三类）、
                      布局 min-w-0 与 minmax(0,…)、四条腿逐一零工程语言扫描）

$ cd web && npx eslint src/modules/collab
ESLINT_EXIT=0     无输出（0 problems；无 set-state-in-effect 告警）

$ cd web && npx vitest run          （全量跑了三次，三次都照实记）
第一次  VITEST_FULL_EXIT=0
        Test Files  115 passed (115)   Tests  1092 passed (1092)   Duration 10.33s
        （本车道当时 79 例；他道那两处编辑尚未落盘）
第二次  vitest 自带 Start 13:16:52 —— VITEST_FULL_EXIT=1
        Test Files  1 failed | 114 passed (115)   Tests  1 failed | 1097 passed (1098)   Duration 5.97s
        唯一失败文件名：src/modules/channels/channels.test.ts
          > reading one source's answer > paints the name, the plain type and the masked handle
            AssertionError: expected 'disabled' to be 'unavailable'
        归因：`web/src/modules/channels/**` 有**他道在共享工作树里的在途未提交编辑**
        （channels.ts mtime 13:15:57 给 RowStatus 加了 "disabled"，ChannelsPage.tsx mtime 13:16:14），
        不是本车道文件；本车道未 add、未 revert、未改它一行。
第三次  vitest 自带 Start 13:17:41 —— VITEST_FULL_EXIT=0
        Test Files  115 passed (115)   Tests  1100 passed (1100)   Duration 5.77s
        （他道那两处编辑落定后同一用例自己转绿；本车道 84 例三次都在全量里全绿）

$ cd web && pnpm run build
BUILD_EXIT=1      死在 scripts/build/web.mjs 的 typecheck 段（对整 solution 跑 tsc -b，
                  被上述 49 条 apps/shared 基线错误拦停，未进 vite 段）；环境性，与本车道代码无关

$ cd web && npx vite build --outDir <temp>/aud-collab-build --emptyOutDir   （绕 typecheck 段的补测）
VITE_EXIT=0       ✓ built in 3.23s；产物落仓外临时目录，未触碰仓内文件；
                  懒块名 CollabDelegationsModulePage-DnHeuRfD.js（仅块名，不声称 entry sha）
```

## CL6. DOM 读数

**不可产出（真实浏览器）**，原因照实：`/collab` 尚未由壳层注册（`App.tsx` 与 `shell/**` 在本车道写域外），
浏览器里没有任何地址能到本组件；本车道禁 install、未起 dev server、未跑 Playwright 用例，
所以 1440/1280/375 的像素级读数与横溢实测**本轮没有数字可写，也不编一个**。

能取到的是 jsdom 结构读数（`vitest run src/modules/collab`，共 84 例）：

- 页根 `col4-page`，`data-page="collab"`，`class` 含 `min-w-0`；`html()` 内无任何 `width:\s*\d+px` 写死宽度（测试钉住）。
- 行网格 `grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`（375 两列堆叠）→ `sm:` 六列
  `minmax(0,1fr)×2 + minmax(0,1.4fr) + minmax(0,0.9fr) + minmax(0,1fr) + minmax(0,0.9fr)`，
  请求编号与短码走 `break-words`/`break-all`。
- 表头文案实测（sm 及以上）：`委托方／受托方／范围／状态／生效至／来源` 逐字等值断言（toEqual 数组）。
- 就绪态一行的 DOM：`col4-row-0-from|to|scope|status|validity|source|code|tech`；
  「技术详情」关闭时字符串 `delegation dl_…` 不在 DOM 里，点开才出现（断言两条都做到了）。
- 计数行读数口径：就绪/空态 → `本页 N 条（最多按 50 条读取，不是全量统计）`；
  其余态 → `本页 — 条（暂时读不到委托数据，数字不作零处理）`；被丢掉的无编号行单列
  `另有 M 条…没有算在上面`，从不并进 N。
- 全 DOM 文本扫描（就绪／错误／不可见／需要登录四条腿逐一跑）：零 `emp_`、零 `human:`、零裸 `dl_0`、
  零 HTTP 码（400/401/403/404/429/500/502/503 逐一正则挡住）、零 ISO 串、零 `undefined`/`NaN`、
  零裸字段名（`delegationId`/`expiresAt`/`fromEmployeeId`/`toEmployeeId`/`createdAt`/`scopeText`）、
  零路径回显（`agent-api`、`/api/delegations`）。

## CL7. 本轮文件（全在写域内）

- 新增 `web/src/modules/collab/delegations.ts`（数据/口径层：单条真路由、形状门、词表、短码、北京时间、
  生效三态、范围拼装）。
- 新增 `web/src/modules/collab/states.tsx`（骨架／空／错误／不可见／需要登录五块面板 + 可复制编号 +
  技术详情折叠 + 复现腿声明）。
- 新增 `web/src/modules/collab/useDelegations.ts`（读取腿：`?state=` 复现零请求、attempt 键防串台）。
- 新增 `web/src/modules/collab/CollabDelegationsModulePage.tsx`（页，零 props）。
- 新增 `web/src/modules/collab/delegations.test.ts`（47 例）、
  `web/src/modules/collab/CollabDelegationsModulePage.test.tsx`（37 例）。
- 本段 `docs/_artifacts/aud/DONE.md`。
- GAP-10 为本车道新取号：落笔前 grep `web/src/**` 与 `docs/_artifacts/**`，GAP-01…GAP-09 已被占，10 空闲。
- 未碰 `App.tsx`、`shell/**`、任何 `manifest.ts`、`pages/**`、`web/scripts/**`、`package.json`/`pnpm-lock.yaml`、
  其它 modules、i18n；未跑 install。工作树里 `web/src/modules/channels/channels.ts` 有**他道在改的**未提交
  编辑（不是本车道产物，本轮未 add、未 revert）。

## CL8. 未验项（照实留）

1. 真实浏览器 DOM／1440、1280、375 像素级横溢：路由未注册 + 禁 install + 无浏览器夹具落点，未实测（CL6）。
2. 2xx 真负载的字段名：本机无身份，`/api/delegations` 恒 401、`/agent-api/api/delegations` 恒 404，
   **没有任何一条委托被真实读到过**。范围／生效至／来源三列的键名全部是候选表
   （`scope|scopeText|summary|description|intent`、`expiresAt|expires_at|validUntil|valid_until|until`、
   `source|origin|createdVia|via`），冻结的 DELEGATION v1.0 里本就没有这三列的字段——真数据到达需回填；
   读不到时上屏「未记录」+ 原因，不写 0、不写空串。
3. 受托方姓名的第二个来源（员工目录 `/agent-api/api/employees` 侧读）本轮**未接**：
   本页只用回答自带的 `*Name` 字段，读不到就掩码成「受托员工 · 短码」。派单口径要的是
   「姓名 · 8 位短码」或「未指派」，姓名能否真出现取决于回答是否带名，未联调。
4. 空态腿的 2xx 真回答未采到（同 2）；本轮空态只在测试里由 `{items: []}` 驱动，屏上话术已就位。
5. 401 是否真的经网关落到 `/api/delegations`（而不是别的拼法）：本机两个端口两套门（CL2），
   网关剥前缀那一跳没有仓内证据，属推断；本页对两种回答都有确定腿（401→登录、404→不可见）。
6. `limit=50` 是否被 BFF 接受、是否支持 `status`/游标参数：未验（无身份）。参数名一旦被判 400，
   页面已有的「这次读取缺少服务要求的条件」人话腿会接住。
7. `pnpm run build` 全链通过：被 apps/shared 基线错误拦停，只有分离的两段证据（tsc 基线口径 + vite 段通过）。
8. `pnpm-lock.yaml` 未验证——未跑 install，未改锁。
9. 接线：`/collab` 与侧栏条目归 R5（CL1 清单），本车道未动壳。

## R11. `/channels` 中文词族补丁（未启用／禁用）

- **改了哪些词**：`未启用` 上了徽标词表（`STATUS_LABEL.disabled`）、筛选选项（`FILTERS` 第 4 项）与计数句新桶「未启用 d」；`禁用` 上了四条人话原因（`DISABLED_TOKENS`：已被禁用／已被管理员禁用／配置里已经把它禁用／处于禁用状态，均写「需要先启用后再读取」）。`disabled` 从 `DOWN_TOKENS` 挪进 `DISABLED_TOKENS`，判定顺序 CONNECTED→DISABLED→DOWN，行上落 `data-status="disabled"`；模块内 grep 命中：改前 `未启用` 0、`禁用` 0 → 改后 `未启用` 19、`禁用` 10（只看 `channels.ts`+`ChannelsPage.tsx` 为 10／6）。
- **测试数**：新增 3 条（`channels.test.ts` 38→39：`statusOf` 四个禁用拼写 + 词表；`ChannelsPage.test.tsx` 39→41：禁用行出「未启用」且 `data-status="disabled"`、「未启用」筛选只留禁用行），既有断言无一条改弱；`npx vitest run src/modules/channels` → exit 0，`Test Files 2 passed (2) / Tests 80 passed (80)`；`npx tsc -b . --noEmit` → exit 2，49 条全在 `../apps/shared/**`，`src/modules` 0；`npx eslint src/modules/channels` → exit 0 无输出。
- **未验项**：真负载里是否真会出现 `disabled`／`switched_off` 这类 token、服务是否按 `&status=disabled` 过滤，本机无身份未联调（沿用 GAP-08 口径，页面仍按同一条件自己再挑一遍）；简报给的句式「已被管理员禁用…」只用在 `disabled_by_admin` 上——`disabled` 本身不证明是谁关的，按本模块「不臆造主语」纪律收口为「已被禁用…」，差一词已在此留痕；真实浏览器 DOM 读数未做。

# TASK T24（续）— 数据源账本对齐判据（待核实／来源／最近同步）（2026-11-19）

派单：把 channels 模块已有的只读数据源账本做到判据（`ds4-*` 面）。写域只有
`web/src/modules/channels/**` 与本文件，壳、路由表、i18n、其它模块未碰。

## N1. 改了什么

**词表（`channels.ts`）**
- 新增账本自己的三词 `LEDGER_STATUS_LABEL`：`已接入 / 未接入 / 待核实`。账本一行说的是「一整份数据源」，
  读不出来的那一档在渠道行叫「状态未说明／未知」，在账本里叫 `待核实`——它是待办，不是耸肩。
  账本面不再出现「未知」（测试钉住：`LEDGER_STATUS_LABEL` 值集里 `未知`、`正常` 均 0 命中）。
- 渠道行词表 `STATUS_LABEL` 一字未动（T29 已交付面），`StatusBadge` 加可选 `label` 供账本换词，
  徽章 tone 规则不变（只有 `available` 是 success）。

**行上多了三样**
- `类型：…`（`ds4-kind`）＝ `SourceSpec.kindLabel`，中文，来源决定、不按行猜；
- `来源：…`（`ds4-origin`）＝ `SourceSpec` 新字段 `originLabel`，四行分别是「上游的消息平台清单／
  上游的连接器清单／本控制台的数据源目录／上游的工具与 MCP 服务清单」；路由原值继续只在 `title`
  与折叠的「技术详情」里；
- `最近同步（北京时间）：…`（`ds4-sync`）＝ 新函数 `newestSeen()`，只从**回答自带**的时刻里取最新一条
  （epoch 秒／毫秒／日期串三形，与 `beijingMinute` 共用 `toInstant()` 解析，两者对「什么算时刻」不可能分歧）。
  回答里没有时刻 → 「—」＋ `NO_SYNC_REASON`「这份回答没有说它最近是什么时候同步的」，
  不拿 `new Date()` 顶替、不写 0、不写空串、不写 ISO。本页自己的时刻另起一行 `本次核验`（`ds4-checked`），
  缺刻时另有说法 `NO_CHECK_REASON`，与同步行分开。

**GAP 取号（新增两个）**——落笔前 grep `web/src/**`、`docs/_artifacts/**`、`apps/**`：
GAP-01…GAP-10 已被占（09＝运行列表车道，10＝委托车道），11／12 空闲；含义：

| 编号 | 含义 | 账本状态 |
|---|---|---|
| `GAP-08` | 本控制台尚未接通这份读取（路由缺席或被拒） | 未接入 |
| `GAP-11` | 路由有回答，但这一轮一条也没有——接通与否无法判定 | 待核实 |
| `GAP-12` | 服务回了错误、或回了读不出清单的东西、或这一轮根本没有结果 | 待核实 |
| `GAP-04` | MCP 清单未注册（T27 既有编号，该行沿用） | 未接入 |

配套：非 `已接入` 的账本行一律带编号（`ledgerRows` 五个分支都有断言）。其中两处是**行为翻转**：
`shape`（回了非清单）原判 `未接入`＋GAP-08，现判 `待核实`＋GAP-12——路由明明答了，说它「没接通」是假话；
`empty`（空清单）与服务错误原先 `gap:null`，现分别带 GAP-11／GAP-12。其余为增列，无删。

**未动**：`chn4-*` 全部 id 原位原值；`?state=` 四腿（零请求、`data-fixture`、GAP 注记、控件禁用）；
403／404 同一具身体；筛选与重新读取的请求语义；只读纪律（无申请入口，`ds4-request` 仍不加）。

## N2. 测试（`src/modules/channels`，2 files／94 tests）

- `channels.test.ts` 39 → 47（＋8）：账本三词与「未知／正常」0 命中；空清单落 GAP-11；服务错误落 GAP-12；
  `shape` 落 GAP-12；`originLabel`／`kindLabel` 是人话（不含 `/`、`api`、下划线）；`newestSeen` 取回答里最新、
  读不出的串一律不算时刻；无时刻 → `syncedAt:null` 且 `checkedAt` 仍是本页时刻；
  非 green 行必带 `GAP-\d+`；GAP-11／12 取号钉住。
- `ChannelsPage.test.tsx` 41 → 47（＋6）：`ds4-status` 上出「待核实」；待核实行灰着（`opacity-60`）、
  留在表里、带原因与 `ds4-gap` GAP-11；500 那行落 GAP-12 且 `500`／上游原句／路由不上人话层；
  类型与来源两列出文；最近同步取回答里较新的 `02:05Z`→「2026-11-19 10:05」且与本次核验分行；
  无时刻那行是「—」＋ `title` 原因（不是 0、不是 1970、不是本页时刻）；
  选「未启用」时账本四条路由（datasources／mcp/servers／gateway-connections／platforms）的请求 URL
  一并带上 `&status=disabled`，四个条件的 URL 互不相同。

## N3. 门禁（精确退出码）

```
$ cd web && npx tsc -b . --noEmit
TSC_EXIT=2        49 error TS 行：全部在 ../apps/shared/**；src/modules=0、shared 以外=0（与基线一致）
$ cd web && npx vitest run src/modules/channels
VITEST_EXIT=0     Test Files 2 passed (2)   Tests 94 passed (94)   Duration 1.12s
$ cd web && npx eslint src/modules/channels
ESLINT_EXIT=0     无输出（0 problems）
```

## N4. 未验项（照实留）

1. 1440／375 的像素级横溢：新列全是 `min-w-0 break-words` 的 `<p>`，未引入固定 px 宽，
   但本机无浏览器夹具落点，未实测截图（沿用 T29 口径）。
2. `originLabel` 四条措辞按仓内既有说法写成「谁的清单」；真负载到达后若上游另有正式名称需回填。
   `newestSeen` 取的是**行上**时刻（`SEEN_KEYS` 候选表）；上游若另有源级同步时间戳而不在行上，
   读不到就写「—」＋原因，不猜、不用本页时钟补。
3. 服务是否真按 `&status=` 过滤仍未联调（本机六条路由恒 401，门在路由之前，见上文 T4）；
   「筛选会改变账本的请求 URL」已由测试钉住，返回内容是否随之变化未验。
4. GAP-11 依赖「路由答了但条目为 0」这一形态。若真实环境里数据源目录尚未落库而答空清单，
   屏上是 `待核实`＋GAP-11 而不是 `未接入`，是否再细分要一次真负载定夺。
5. `本次核验` 仍写本页 `new Date()` 的时刻（标注为核验，不叫同步）。判据「never a wall-clock now」
   按字面只约束同步行；两行已分开并在测试与注释里留痕，若验收方认为账本上连核验时刻也不该出现，
   删 `ds4-checked` 一处即可，不影响其它列。

## TASK COLLAB — 复验（2026-11-19，基座 35000331）

页面本体早前已交：commit `32005b4c feat(console): delegation read-only view on upstream shell`（6 文件，`web/src/modules/collab/**`），已随主树并入本次基座。本轮按派单在 `35000331`（`58e59535` 的后继，`git merge-base --is-ancestor 58e59535 origin/lane/hermes-console` 为真）上复验，未改代码。

### C1. 页面契约（复验结论）
- 入口 `web/src/modules/collab/CollabDelegationsModulePage.tsx`：具名导出 `CollabDelegationsModulePage`（零 props），另默认导出同一组件；期望路由 `/collab`（兼容别名 `/collaboration`）。
- 列：委托方 / 受托方（「姓名 · 8 位短码」或「未指派」；无姓名的委托方不冒充「未指派」）/ scope 人话 / 动作词 / 生效·到期（`beijingMinute()`，`Asia/Shanghai`，到分）/ 状态人话（未知 →「待核实」）。
- 只读：`grep -n "创建\|撤销\|保存\|发起委托" web/src/modules/collab/*.tsx` → 0 命中；无按钮型写入口。
- 复现腿：`?state=` 渲染 `data-fixture`（`CollabDelegationsModulePage.tsx:221`）+ GAP-10，零请求。
- `col4-*` testid 分布：页面 11 处、`states.tsx` 9 处、页面测试 48 处。

### C2. 原始门禁 stdout（`web/` 下）
```
$ npx tsc -b . --noEmit
TSC_EXIT=2   TOTAL_ERRORS=49   NON_SHARED=0   COLLAB_ERRORS=0
（49 条全部为 ../apps/shared/** 预存基线，逐条 TS2307 'vitest' 等）

$ npx vitest run src/modules/collab --reporter=dot
Tests  84 passed (84)   Duration 1.08s
VITEST_EXIT=0

$ npx eslint src/modules/collab
ESLINT_EXIT=0（无输出）
```

### C3. 端点实测（127.0.0.1:8092，无身份）
```
/api/delegations?limit=50          -> 401  {"code":"console.unauthenticated"}  rid=c82d44c3fbc044ddb28da1bccb5632d7
/agent-api/api/delegations?limit=50 -> 404  {"code":"console.not_found"}       rid=ce479857a67040979f5b22a53ecf85a6
```
401 = 需鉴权（非 404）；404 来自本机 serving 无 `/agent-api` 代理（`vite.config.ts` 只代理 `/api`、`/dashboard-plugins`）；Caddy 域下由网关注入身份并转 `/agent-api`。未伪造任何数据行。

### C4. 未验项
- 截图未产出：本 worktree 禁 install、无浏览器落点（页面尚未接路由，接线属 R5 写域），jsdom 无布局引擎，无法产出像素级 1440/1280/375 证据；仅以渲染测试 + `flex/min-w-0/break-words` 契约替代。
- 真实 2xx 载荷形状（字段名、状态枚举、scope 文案）未采样；`delegations.ts` 的候选键表为仓内推导。

## TASK runs filter contract (2026-11-19, base b4341cc7)

### Contract
The runs read accepts exactly three filter names: `employeeId`, `status`, `since`
(plus `limit` / `cursor` for paging). Any other filter key answers
`400 request.missing_filter`, which is why a display-level alias must never be
sent as a query key.

### What the tree actually contained
- `grep -rn "createdByEmpIdEquals" --include='*.ts' --include='*.tsx' .` → 0 hits.
- `git log --oneline -S "createdByEmpIdEquals" -- web/src` → no output (absent from
  the whole history of this tree, not only from the current base).
- `grep -rn "谁创建" web/src` → 0 hits (the only 创建人 wording lives in the tasks
  module and is unrelated).
So the failing alias was never in this page's code; the real gap was that no
employee filter existed at all. This commit names the accepted parameter and pins
the query-key set so the alias cannot creep in later.

### Change
- `runs.ts`: `ListQuery` gained `employeeId?: string`; `askListRoute` sets
  `employeeId` on the runs route only (the `run-stats` fallback keeps its own
  `from`/`to` names) with a comment naming the contract and the forbidden alias.
- `useRunsData.ts`: `ListFilters` gained `employeeId`, the request-identity key
  includes it, and `loadRuns` forwards it.
- `RunsModulePage.tsx`: a deep link `?employee=<id>` narrows the list through
  `employeeId`. No filter control is rendered for it, so no dead control appears
  (the page keeps its zero-write, control-light surface).
- `runs.test.ts`: three new cases — `employeeId` reaches the URL, no request URL
  contains `createdBy`/`createdByEmpIdEquals`, and every runs-route query key is
  inside `{since, limit, status, cursor, employeeId}`, with the parameter omitted
  when no employee is selected.

### Raw endpoint readings (BFF 127.0.0.1:8092, no identity on disk)
```
GET /api/runs?employeeId=emp_9f3a4b7c&limit=5
  -> 401  {"code":"console.unauthenticated","message":"identity check failed"}
     x-console-request-id: 65ecca00a33140e3a058084c5a82860c
GET /api/runs?since=2026-11-18T00:00:00.000Z&limit=5
  -> 401  {"code":"console.unauthenticated","message":"identity check failed"}
     x-console-request-id: 1b3f70d2a4914405b14ccc34423d443a
GET /agent-api/api/runs?employeeId=emp_9f3a4b7c&limit=5
  -> 404  {"code":"console.not_found","message":"static asset not found"}
     x-console-request-id: 05fd6f2fa3fd4013ab3f705caeccfc47
```
The identity gate runs before parameter validation, so a 200 (or even the
`400 request.missing_filter` original symptom) cannot be reproduced on this
machine without a signed-in cookie. That is stated rather than simulated.

### Gates (run in `web/`)
- `npx vitest run src/modules/runs` → exit 0, `Test Files 2 passed`, `Tests 54 passed`
- `npx tsc -b . --noEmit` → exit 2, 49 `error TS` lines, all under `../apps/shared/**`,
  zero under `src/modules/runs` (pre-existing baseline)
- `npx eslint src/modules/runs` → exit 0, no output

### Not verified
- A real 200 from `/api/runs?employeeId=...` (needs an authenticated cookie).
- Whether the running BFF enforces `status`/`since` as required filters for this
  route — only the accepted name set is pinned here.
- Pixel-level overflow at 1440/1280/375 (no browser fixture in this worktree).

## TASK approvals closeout (2026-11-19, base 2767ac9b)

写域：`web/src/modules/approvals/**`（**未**编辑 `manifest.ts`）、本文件。写域外一律未改：
`App.tsx`、`web/src/shell/**`、`web/src/pages/**`（含旧 `ApprovalsPage.tsx`，它自带 `@/components/RequestIdCopy`，
本车道未触碰共享组件）、其他模块、i18n、`package.json`/锁文件。未跑任何 install / force / amend / rebase。
受派 HEAD：`2767ac9b`（tree clean 起步）。

### 1. 命令与原始尾行（均在 `web/` 下跑，`PATH` 先 `export /opt/homebrew/bin`）

```
npx vitest run src/modules/approvals --reporter=dot
  → exit 0
      Test Files  3 passed (3)
           Tests  48 passed (48)   # 基线 45 → 新增 3 条（八态实证 + 错误腿复制 + 拒绝腿复制）

npx tsc -b . --noEmit
  → exit 2
      grep -c "error TS"                      = 49
      grep "error TS" | grep -vc '../apps/shared/' = 0   # 非 apps/shared 的错：0
      grep "error TS" | grep -c approvals     = 0        # approvals 模块贡献：0（与基线一致，允许条件成立）

npx eslint src/modules/approvals
  → exit 0
      ✖ 2 problems (0 errors, 2 warnings)
      # 两条 warning 均为基线既有：useApprovalsData.ts:141:9 与 :218:7
      # （react-hooks/set-state-in-effect），本任务未新增任何 error/warning
```

### 2. testid 迁移（`approvals-*` / `approval-*` → `apr4-*`，一元素一 id，旧 id 不残留）

- 页面根：`approvals-pending`→`apr4-page-pending`；`approvals-history`→`apr4-page-history`
- 列表容器：`<section>` 新增 `apr4-list`（两页各一）
- 筛选条：`<div role="group">` 新增 `apr4-filter`；八态胶囊 `approvals-filter-<value>`→`apr4-filter-<value>`
  （即 `apr4-filter-pending` … `apr4-filter-superseded` + `apr4-filter-all`）；未知值 `approvals-filter-unknown`→`apr4-filter-unknown`
- 行卡：`approval-row-<key>`→`apr4-row-<key>`；行内「详情」`approval-row-details-<key>`→`apr4-row-details-<key>`
- 详情抽屉：`approval-detail`→`apr4-detail`；瞬态 `approval-detail-empty/loading/error/unaddressable`、
  `approval-history-detail*` 统一为 `apr4-detail-empty/loading/error/unaddressable` 与 `apr4-detail`
- 操作区：`approval-actions`→`apr4-actions`；备注框 id `approval-comment`→`apr4-comment`（含 `htmlFor`）
- 面板态（states.tsx）：`approvals-loading/empty/error/denied/inline-failure/details`→`apr4-loading/empty/error/denied/inline-failure/details`；
  拒绝出口 `approvals-denied-exits`→`apr4-denied-exits`；历史空态 `approvals-history-empty`→`apr4-empty-history`
- 重试：错误面板新增 `apr4-retry`（列表腿经 `retryTestId="apr4-retry"`，详情腿走 `${testId}-retry` 以免重号）
- 强制态注记：`approvals-forced-note`→`apr4-forced-note`
- 请求编号 + 复制：见 §4
- `model.ts` 里 `key: rawId ?? \`approval-${index}\`` 是行键的无 id 兜底值（喂进 `apr4-row-<key>`），
  非任何元素的 data-testid，故保留；测试选择器已全部改为 `apr4-*`。

### 3. 八态筛选真生效（`ApprovalsHistoryModulePage.test.tsx` 单测逐态驱动）

| 状态（model.ts 拼写） | 落到请求的参数 | 该态里测试实测到的行数 |
|---|---|---|
| pending | `status=pending&limit=50` | 1（`等待你点头的发布`） |
| approved | `status=approved&limit=50` | 1（`上月预算追加`） |
| rejected | `status=rejected&limit=50` | 1（`临时提权申请`） |
| revise_requested | `status=revise_requested&limit=50` | 1（`对外报价单`） |
| expired | `status=expired&limit=50` | 1（`过期未处理的采购`） |
| cancelled | `status=cancelled&limit=50` | 1（`发起人撤回的转账`） |
| consumed | `status=consumed&limit=50` | 1（`已执行的批量导出`） |
| superseded | `status=superseded&limit=50` | 1（`被新单替代的发布`） |
| 全部 | 请求里**不含** `status=`（参数丢弃，绝不发 `status=all`） | 8（八态各一行同时铺回） |

该测试断言：逐态的 URL 含且仅含该拼写的 `status=`；每态行卡数与该态 mock 载荷数一致，且其余七态的行标题
一律 `not.toContain`（可分辨载荷，非同一批行）；点「全部」后清空计数再断言最后一条列表请求不带 `status=`
也不带 `status=all`，行卡数回到 8。页面本身（`CHOICES` 由 `STATUS_FILTERS` 全量映射）已把八个规范值都送进请求，
无「只发子集」需修。

### 4. 复制闭环（copy round-trip）

states.tsx 新增模块内 `RequestIdCopyField`（lane 本地等价物，未改共享 `@/components/RequestIdCopy`）：
屏显 `<code data-testid="apr4-request-id">{requestId}</code>`，复制按钮 `data-testid="apr4-copy-request-id"`，
`onClick` 调 `navigator.clipboard.writeText(requestId)`；`copied` 态显示 `已复制`/`复制失败，请手动选择`（`apr4-copy-state`）。
缺 id 时保留原诚实句「本次请求未记录编号，可复制时间与操作路径反馈」（`apr4-request-id-missing`）且**不渲染按钮、不臆造值**。
断言点（jsdom 无 clipboard，测试用 `Object.defineProperty(window.navigator,"clipboard",{value:{writeText}})` 打桩）：

- 错误腿：pending（`requestId=b6g1c2d3`）与 history（`hs-copy-err`）各断言 `shownRequestId()==id`、
  `writeText` 恰调 1 次、`toHaveBeenCalledWith(id)`、且 `String(writeText.mock.calls[0][0])===shownRequestId()`。
- 拒绝腿：history（`hs-copy-deny`）同样断言屏显==写入==`apr4-request-id`；pending 拒绝腿断言 `apr4-request-id`
  在屏、`apr4-copy-request-id` 存在。
- 缺 id 腿：pending status=0（无 requestId）断言 `apr4-request-id` 为 null、`apr4-request-id-missing` 存在、复制按钮为 null。

### 5. 403 ≡ 404 + 四态 + 响应式

- 同一具身：DeniedPanel 单一组件，testid `apr4-denied`；403 与 404 渲染后取 `document.body.innerHTML` 逐字节相等
  （pending `ap-9c31` 腿、history `hs-deny` 腿均已断言 `expect(404body).toBe(403body)`）。
- 不先铺行：拒绝态里 `querySelectorAll("[data-testid^='apr4-row-']")` 长度为 0（列表在拒绝前已清空）。
- 不回显路径：`apr4-denied` 面板内 technical 不上屏；两页拒绝测试均断言 innerHTML `not.toContain("/agent-api")`。
- 四态齐备：loading skeleton（`apr4-loading`）/ 空态带 reason+next step（`apr4-empty`、历史 `apr4-empty-history`）/
  错误态带人话+请求编号+重试（`apr4-error` + `apr4-retry`）/ 拒绝态（`apr4-denied`）。`?state=` 复现测试逐态断言四个 id 在场，
  且带 `data-fixture` 标记为复现而非服务回答。
- 响应式（DOM 类契约，非像素）：页面根 `apr4-page-*` 断言 className 含 `min-w-0` 与 `max-w-full`；
  面板长句 `<p>` 含 `break-words`；布局用 flex + `minmax(0, …)` grid，无固定像素宽（`min-w-0`/`break-words` 全程保留）。
  1440/1280/375 的像素级溢出无法在本 worktree 取真，见 §6。

### 6. screenshots not produced

**未产出任何截图**。原因：本任务两个页面（`ApprovalsPendingModulePage`/`ApprovalsHistoryModulePage`）
只由 `manifest.ts` 懒加载挂载，而该 worktree 的 shell/App 未把它们挂到可导航路由，且此 worktree 无浏览器 fixture
（vitest 用 jsdom，无像素渲染面），并禁止任何 install（不得引入 playwright/puppeteer/截图依赖）。
故 1440/1280/375 的溢出仅以 §5 的 DOM 类契约（flex/`min-w-0`/`break-words`/无固定宽）证明，不以截图证明。

### 7. 未能在本 worktree 证实的项

- 真后端 200 与各态真实行数（身份门先于参数校验，本机无签名 cookie → 复现态用 `?state=` 与 mock 载荷，非实测服务）。
- 1440/1280/375 像素级不溢出（无浏览器 fixture、禁 install）。

## TASK collab real data (2026-11-19, base cd2806fc)

### 1. Endpoint probes (raw, cookie from ~/.local/state/sekoi-ops/v4-auth-state.json, value never printed)
```
GET http://127.0.0.1:9122/agent-api/api/delegations?limit=5
  -> HTTP 200, 46 bytes
  {"items":[],"asOf":"2026-11-19T06:48:38.660Z"}

GET http://127.0.0.1:8092/api/delegations?limit=5
  -> HTTP 200, 46 bytes
  {"items":[],"asOf":"2026-11-19T06:48:38.674Z"}
```
Reading: the route IS wired and the identity check passed. The tenant really has zero
delegations on this generation, so the honest rendering is the empty state — not
「未接入」, not an error, and no rows may be invented. The service also hands back its
own `asOf`, which the page now shows as the read stamp instead of borrowing the
browser clock.

### 2. Code changes (write scope only: web/src/modules/collab/**)
- `delegations.ts`
  - `ListState` gained optional `asOf?: string | null`; absent/malformed stays `null`
    so the page can never substitute a browser time for a service time.
  - success branch now returns `asOf: typeof body.asOf === "string" ? body.asOf : null`.
  - new exported `readingStamp(asOf)`: non-string / blank / unparsable -> `null`;
    otherwise formats in `Asia/Shanghai` as `MM-DD HH:mm` (h23).
- `CollabDelegationsModulePage.tsx`
  - imports `readingStamp`; renders `<p data-testid="col4-asof" title=...>读取于 {stamp ?? "—"}</p>`
    right after `col4-counts`. Missing stamp reads 「—」 with a title explaining that the
    service answer carried no read time and the browser clock is deliberately not used.
- Tests (both files) extended by 4 cases: service stamp kept + formatted `11-19 14:48`;
  missing/garbage stamp -> null on both layers; on-screen `读取于 11-19 14:48`; on-screen
  `读取于 —` with the honest title.

### 3. Gates (raw tails)
```
$ cd web && npx vitest run src/modules/collab --reporter=dot
 Test Files  2 passed (2)
      Tests  88 passed (88)
VITEST_EXIT=0

$ npx tsc -b . --noEmit
TSC_EXIT=2 ; grep -c 'error TS' = 49 (all ../apps/shared/**) ; grep -c 'modules/collab' = 0

$ npx eslint src/modules/collab
ESLINT_EXIT=0
```
The 49 pre-existing `../apps/shared/**` type errors are the known worktree baseline and
are untouched by this lane.

### 4. Screenshots — produced, but they show the shell fallback, not this page
Tool: `/tmp/cdp-shot.mjs` (headless `/Applications/Google Chrome.app`, CDP, session cookie
injected via `Network.setCookie`; no playwright/puppeteer is installed and installs are
prohibited). Three viewports captured into `docs/_artifacts/aud/shots/`:
- `collab-1440.png` 155456 B — sw==cw==1440
- `collab-1280.png` 139635 B — sw==cw==1280
- `collab-375.png`  60348 B — sw==cw==375
- `probe.json` 10081 B — url/text/scrollWidth/clientWidth/`col4-*` counts per viewport

Honest reading of that evidence: `probe.json` records `url = /overview` and `col4-*` id
count = 0 in all three viewports. Both `/collab` and `/collaboration` are redirected to
`/overview` by the shell's unknown-route fallback, so the PNGs are the fallback page, not
the delegations UI. No overflow was measured on the real page because it cannot be reached
from the shell at this generation (see §5).

### 5. Route gap — needs a shared-file change (R5 / L0)
`web/src/App.tsx:350` still declares the nav entry as
`{ path: "/collaboration", label: "协作", icon: Handshake, group: "operations", placeholder: true }`.
`placeholder: true` registers no route, and `grep -rln 'CollabDelegationsModulePage' web/src`
matches only the module itself and its tests. So the page is delivered but unmounted, and
the sidebar shows 「未接入」 for 协作.

Requested shared-file change (outside this lane's write scope):
`App.tsx` — drop `placeholder: true` from that entry and mount
`CollabDelegationsModulePage` at `/collaboration` (compat alias `/collab` if the shell
supports aliases). Module contract: named export `CollabDelegationsModulePage`, zero props,
reads `?state=loading|empty|error|denied` for QA legs.

### 6. Not verified
- Real non-empty rows: the tenant has zero delegations, so the populated table, the
  per-column formatting and the 「姓名 · 8 位短码」 masking are covered by unit tests with
  fixtures only — never observed against a live 2xx payload with rows.
- Pixel-level overflow on the real page (unreachable, §5); only the shell fallback was shot.
- `?limit=` beyond 5 and cursor behaviour against the live route.

---

## TASK audit closeout (2026-11-19, base c4c6e750)

派单口径：写域 `web/src/modules/audit/**` + 本段；五个收口项（筛选真生效 / 详情人话层 / 校验未启用腿 /
列表列口径 / 四态+零横溢），外加真浏览器截图。Cookie 只经 `$(cat /tmp/.cookie_val)` 注入头，未打印过值。

## X1. 会话实测：每个参数一条（curl 原文 + HTTP + 条数）

服务端：`http://127.0.0.1:9122`（v4_proxy：静态 `forks/hermes-agent/hermes_cli/web_dist` + `/agent-api/*` 反代 BFF 8092）。
列表返回体顶层键是 `{events, nextCursor}`（条数= len(events)）。

| # | 请求（引号内为 curl 实际 URL） | HTTP | items | 结论 |
|---|---|---|---|---|
| 1 | `…/agent-api/api/audit?limit=5` | **400** | — | `console.missing_filter`：`at least one of ['runId','taskId','actorId','resourceId','action','from','to'] is required (no unfiltered table scan)` → **require_any 七参数首次采到真名** |
| 2 | `…/audit?limit=5&from=2026-10-01T00:00:00Z&to=2026-11-20T00:00:00Z` | 200 | 5 | from/to 生效（下面全部用带窗问法） |
| 3 | `…&limit=50&event_type=task.created`（本模块旧拼法） | 200 | 50（8 种 action 混合） | **`event_type` 被接受但被忽略**——返回和不分筛选一样的混合台账 |
| 4 | `…&limit=50&action=task.created` | 200 | 14（全部 task.created） | `action` 才是真参数，且**精确匹配** |
| 5 | `…&limit=50&action=task_created`（下划线拼法） | 200 | **0** | 下划线原码在真服务端筛出零行 → 旧下拉选项是个假筛选器 |
| 6 | `…&limit=50&action=budget.ledger_entry_applied` | 200 | 50（全部同码） | 同上，再证精确匹配 |
| 7 | `…&limit=2`（带窗） | 200 | 2 | `limit` 生效 |
| 8 | `…&from=2026-11-17T18:00:00Z&to=2026-11-17T19:00:00Z&limit=50` | 200 | 13（occurredAt 全在窗内） | 窄窗收窄，`from/to` 真的改结果 |
| 9 | 只带 `from=2026-11-17T18:00:00Z` 不带 `to` | 200 | 13 | 单边也被接受 |
| 10 | 先取页1 的 `nextCursor`，再 `…&limit=5&cursor=<token>` | 200 | 5（与页1 零重叠） | `cursor` 分页真实可用 |
| 11 | `…&limit=50&actorId=employee-api` | 200 | 50（actor.id 全等于 employee-api） | **`actorId` 存在且生效**（GAP-06 的「没有参数」说法自此不成立，见 X2） |
| 12 | `…&limit=50&action=does.not.exist` | 200 | 0 | 未知码诚实空，不 400 |
| 13 | `/agent-api/api/audit/detail?id=ev_2BAA…` 与变体 `/event?id=` `/audit/<id>` `/get?id=` `/detail/<id>` | **404** | — | 全部 `console.unknown_route`——旧的 detail 拼法**根本不存在** |
| 14 | `/agent-api/api/audit-detail?id=ev_2BAA7DD7F3BC4767AF39764D91` | **200** | 1 | 真详情路由（裸事件对象，无包裹层）；`id=ev_DOESNOTEXIST…` → **404** `audit.event_not_found`；缺 id → 400 `console.missing_param` |
| 15 | `/agent-api/api/audit/verify?from&to` | **404** | — | `console.unknown_route`——旧校验拼法不存在 |
| 16 | `/agent-api/api/audit-verify?from=2026-11-10T00:00:00Z&to=2026-11-20T00:00:00Z` | **200** | — | 真校验路由，体 `{"ok":true,"complete":true,"scanned":43,"anchorCheckpointId":"cp_t_seakoi_pilot_2026111300","chainHeadHash":"ah_031a89f9…"}`（无 total/broken 键） |
| 17 | 不带 cookie 的 #2 | **401** | — | `console.unauthenticated`（门在路由前，与会话失效腿口径一致） |
| 18 | 默认 24h 窗（`from=now-24h&to=now`） | 200 | **0** | 本环境最近 24 小时没有任何审计事件；7d 窗 → 200 / 50 条 |

真负载一条完整样例（#14 原样，测试 `live-sampled answer shapes` 直接钉它）：
`eventId / schemaVersion / tenantId(t_seakoi_pilot) / occurredAt / recordedAt / sourceSystem /
actor{type,id} / action(点分) / resource{type,id,ownerRef} / outcome / responsibleHumanId / decision /
correlationId / error{code,messageRedacted}`。action 采样分布（11-01..11-20，100 条）：
`budget.ledger_entry_applied 27, employee.create.denied 22, task.created 14, dispatch.event 8,
approval.expired/consumed/decided 各 4, budget.ledger_ensured 3, grant.created 3, workstation.bound 2,
employee.version.created 2, employee.lifecycle.transitioned/denied 各 2, employee.created 1,
budget.soft_alert_sent 1, workstation.bind_conflict 1`（共 16 码）。

## X2. 控件去留（每一项为什么）

| 控件 | 处置 | 依据 |
|---|---|---|
| 时间窗 `aud01-filter-window` | **保留**，选项只剩 24h/7d/30d | `from/to` 实测生效（#2/#8/#9）；**删掉「不限时间」**——require_any（#1）证明服务拒绝零筛选扫描，400 的选项就是假控件 |
| 事件类型 `aud01-filter-type` | **保留但改线**：线上参数 `event_type`→`action`，下拉选项换成 16 个**实采点分码**（`LIVE_ACTION_CODES`） | #3：`event_type` 被忽略＝假筛选；#4/#5/#6：`action` 精确匹配，本模块词表的下划线原码会筛出 0 行 |
| 操作者 `aud01-filter-operator` | **维持禁用+「未接入」**，GAP-06 只进 `title`；title 说法按实测修正 | #11 证明 `actorId` 存在且生效——旧说法「没有参数」已不成立。真话是：参数只吃机器句柄（`employee-api`），本环境没有可展示真名的操作者目录；裸句柄输入框会把工程语言放上人话层（判据 2/4），所以仍不做控件 |
| 刷新 / 加载更多 | 保留 | `limit`、`cursor` 实测生效（#7/#10） |
| 详情读 `…/audit/detail?id=` | **改为 `…/audit-detail?id=`** | #13/#14 |
| 校验读 `…/audit/verify` | **改为 `…/audit-verify`** | #15/#16 |

## X3. 详情面（人话层 / 「—」 / 403≡404）

- 人话层零工程词：既有断言继续钉住（无 `event_type/tenantId/sourceSystem/policy.denied/HTTP/ISO`），本轮把
  真负载里会露网的英文枚举收进词表：`employee.create.denied`→「驳回新建数字员工」、`approval.decided`→「给出审批结论」、
  `grant.created`→「授予权限」；资源名词补 `creation_attempt/ channel_event/ workstation/ grant` 四格；
  `t_seakoi_pilot` 这类租户短码按句柄掩码成「工作区 · pilot」（whole 值只进 title/技术详情）。
  `dispatch.event` 语义自名字定不下来，**继续按原样上屏**（判据 4「不认识的绝不机翻」）。
- 缺值：全部「—」+ `title`/短句原因，无 `?? 0`；`error.messageRedacted` 是人写的句子才上屏，堆栈被
  `humanSentence` 挡回技术侧（既有断言）。
- **403≡404 同体**：`DeniedPanel` 单一具身；列表腿整页 `document.body.innerHTML` `toBe` 相等、
  详情腿本轮起同时比 `aud02-detail-denied` outerHTML **和整页 innerHTML**、校验腿比 `aud03-unavailable`
  outerHTML，三者都再断不回显路径/状态码（`not.toMatch(/\/agent-api|api\/audit|console\.forbidden|\b40[34]\b/)`）。
  真路由侧：#14 的 404 体（`audit.event_not_found`）与任何 403 都落同一面板。

## X4. 校验「本环境未启用」腿

- 文案（`states.tsx` VerifyUnavailablePanel + `copy.ts`）：**「本环境未启用」** + 原因句（403/404「这套环境没有提供完整性校验，或者它还没有对你开放」；
  405/501「尚未开通，需管理员启用」；连不上/5xx 各一句）+ 下一步（「让工作区管理员在审计服务里开通时间窗完整性校验，开通后回到这一页重新运行」）+ 可复制请求编号 + 「再运行一次」；
  永不写「已通过」（测试逐字断言 `not.toContain("没有发现断点")` on that leg）。401 走 error 腿说「重新登录」，不冒充未启用。
- 分母：`已核对 X / Y`；真回答（#16）只给 `scanned` 不给 total → 该格 `43` + `title`「服务未说明这个窗口里一共有多少条」，
  `对不上的` 格「—」+ 原因；本轮新增测试用 **实采 verify 体** 钉住这三格。

## X5. 列表列口径（判据 4）与四态/横溢（判据 5）

- 列：时间=北京到分并写明（#14 样例 `2026-11-17T18:18Z` → 「2026-11-18 02:18」，测试钉死）；
  操作者=「姓名 · 8 位短码」/「员工 · 短码」/「成员」/「系统」/「未指派」，裸句柄只进 title；
  类型=认识的说中文、不认识的原样（新增 live 形状页面测试两种都钉）；结果+原因带一句人话。
- 四态：三面 loading 骨架 / empty 原因+下一步 / error 人话+可复制编号+重试 / denied 同体，齐；
  `aud01-*` 与 `agent-v2-page-audit*` 未动，本轮未新增页级 id（新断言全部复用既有前缀）。
- 假定：**默认时间窗 24h → 7d**。#18 证明本环境 24 小时内零事件，24h 默认＝每次进页面都落在空态；
  require_any 又强制必须带窗，于是取覆盖真数据的最小窗。改回一行的事，`window.ts` 注释与本段互为证据。

## X6. 截图与 probe 判读（真像素，非声称）

产物：`docs/_artifacts/aud/shots/audit-1440.png`、`audit-1280.png`、`audit-375.png`、`audit-probe.json`
（harness：`/tmp/cdp-shot-aud.mjs`，= 既有 `/tmp/cdp-shot.mjs` 同款流程、前缀换 aud01-、端口 9334；
既有 collab 的 `probe.json` 未覆盖）。

`audit-probe.json` 三档实测记录：url `/system?tab=events`（`/audit` 客户端重定向落点），
页根 `agent-v2-page-audit` **在**，`aud01-*` 非零（status/refresh/filters/filter-window/filter-type/filter-operator/empty），
`sw==cw`（1440/1440、1280/1280、375/375）→ **部署态页面无横溢**。

**如实判读**：这不是 shell fallback，是真审计页——但它是**收口前的构建**：9122 静态根是
`forks/hermes-agent/hermes_cli/web_dist`（15:16 构建，chunk 里 `event_type`×2、无 audit-detail/audit-verify 标记），
截图文案仍是旧空态句「这个筛选条件里没有审计事件」、下拉里仍有「不限时间」与旧词表。
收口后的界面像素**未截**：重建/替换该 dist 属他树运维写域，本车道不碰；收口后行为以三面模块渲染测试为证（X7）。
detail/verify 两个独立页未挂进壳（只有列表页 `/system?tab=events` 挂载 + 抽屉式详情），按派单以模块测试覆盖。

## X7. 门禁（精确退出码 + 尾巴，跑于收口后 HEAD）

```
$ cd web && npx vitest run src/modules/audit --reporter=dot
VITEST_EXIT=0     Test Files  5 passed (5)   Tests  102 passed (102)   Duration 1.35s
$ cd web && npx tsc -b . --noEmit
TSC_EXIT=2        49 error TS 行：全部在 ../apps/shared/**（Cannot find module 'vitest' 等基线同款）；
                  非 shared 行 0；modules/audit 行 0 —— 与派单口径「exit 2 允许、审计 0 贡献」一致
$ cd web && npx eslint src/modules/audit
ESLINT_EXIT=0     ✖ 3 problems (0 errors, 3 warnings)  ← useAuditData.ts 既有 set-state-in-effect×3，非本轮新增
```

本轮文件改动全在写域：`api.ts / model.ts / window.ts / AuditEventsModulePage.tsx / tabNav.ts`、
三份页面测试 + `api.test.ts` + `manifest.test.ts`、本段与 shots。**未引用 `docs/_artifacts/tonight/**` 任何数值。**

## X8. not verified（照实留）

1. 收口后构建的 1440/1280/375 像素：需 R5/运维重建 `web_dist` 后复拍；本轮只有收口前的真像素 + jsdom 断言。
2. require_any 七参数只逐一新验了 `action/from/to/limit(非七之一)/cursor(非七之一)/actorId`；`runId/taskId/resourceId` 未单独探。
3. 16 个 action 码是本环境 11-01..11-20 百条采样，非全枚举；词表外新码按原样上屏（行为正确），但下拉不含它们。
4. `budget/workstation/grant` 系列的中文标签是词元的直译（`记入预算台账`/`绑定工作台`/`授予权限`），待业主口径确认；`dispatch.event` 刻意不译。
5. `error.messageRedacted` 若是英文句子（样例即英文）原样上屏「原因：」——服务自己写的话不翻译，口径待产品定。
6. 真 403 腿：本会话权限下 detail/list 只出 200/400/401/404，403≡404 同体是测试级 mock 断言 + 同组件代码路径，未现网双态实测。
7. verify 真回答无 total/broken 键——「分母」在真环境退化为「—+原因」，若上游补 total 会自动升格为 `X / Y`。
8. `pnpm-lock`/依赖：未动、未装。

## 需壳层注册的路由/槽位清单（交 R5，2026-11-19）

判据总述：以下页面**已交付、未挂载**——模块与其测试在库内，vite 构建也能切出 chunk
（本轮实测：`vite build` → `assets/CollabDelegationsModulePage-C9MmsxBf.js`、
`assets/AuditEventsModulePage-Ip3muf9p.js`，EXIT=0），但路由未注册的就是运行时不可达。
本车道未改 `App.tsx`/`shell/**`，接线归 R5。

### 1) collab 协作委托页 —— 未挂载，需注册

- 模块文件：`web/src/modules/collab/CollabDelegationsModulePage.tsx`
- 导出：具名 `CollabDelegationsModulePage`，零 props；挂载建议照 audit 的写法
  `lazy(() => import("@/modules/collab/CollabDelegationsModulePage"))`
- 期望路由：`/collaboration`（兼容别名 `/collab`）
- 壳层改动点：`web/src/App.tsx:350` 现条目
  `{ path: "/collaboration", label: "协作", icon: Handshake, group: "operations", placeholder: true }`
  —— 去掉 `placeholder: true` 并在路由表注册该组件。事实依据：`App.tsx:1468` `if (item.placeholder)`
  分支使 placeholder **不注册路由**；未匹配路径落 `<Navigate to="/overview" replace />`
  （`App.tsx:233/243`），所以 `/collab` 与 `/collaboration` 现在都被改写回 `/overview`——
  早前 collab 截图的 probe.json 记录的正是这个 fallback 落点（url `/overview`、`col4-*` ids 为 0）。
- QA 复现腿：`?state=loading|empty|error|denied`（forced 腿零请求，面板带 `data-fixture`；
  模块文档注 `CollabDelegationsModulePage.tsx:25-26`、页根 `data-fixture={forced}` 行 223）
- testid 前缀：`col4-`（页面根 `col4-page`、行 `col4-row-<N>`、空态 `col4-empty`、错误 `col4-error`、
  拒绝 `col4-denied`、请求编号在面板内为 `col4-error-request-id` / `col4-denied-request-id`——
  派单草稿里的「`col4-request-id`」一词在库内不存在，按真实名登记）
- 数据口：`GET /agent-api/api/delegations?limit=50` —— 本轮带会话 cookie 实测 **200**，
  体 `{"items":[],"asOf":"2026-11-19T07:31:22.802Z"}`（本租户真实 0 条，非路由缺失）
- 现状如实记：模块与其测试已在库内、dist 里也有 chunk，但**运行时不可达**（chunk 孤儿），
  入口一律被改写到 `/overview`；接线归 R5，本车道不改 App.tsx/shell。

### 2) 审计三面 —— 供 R5 对照，不要改动

- 列表：**已挂载**于 `/audit`（`App.tsx:102` 懒加载 `AuditEventsModulePage`，
  `App.tsx:1289` `/audit` → `Navigate /system?tab=events` 兼容重定向）；页级 testid
  `agent-v2-page-audit`，元素前缀 `aud01-*`（详情抽屉的 `aud02-*` 也在这同一挂载页内出现）。
- 详情/校验：模块内 `AuditDetailModulePage`、`AuditVerifyModulePage`（页级
  `agent-v2-page-audit-detail` / `agent-v2-page-audit-verify`，前缀 `aud02-*` / `aud03-*`）；
  壳层**未注册** `/audit/detail`、`/audit/verify` 路径（本轮 grep `App.tsx` 无此两条 Route）。
  若需独立入口，请按本节同格式登记槽位再注册——**本次不自行注册**。

## TASK audit filter contract re-probe (2026-11-19, base e3efe15a → HEAD 5bdb0553)

派单要求先探 BFF 实参再谈前端对齐。以下是**本轮带登录态实测**的原始读数，
以及据此得出的「哪些参数真生效 / 哪些根本没有被服务读取」。

### 1) 探针环境

- 服务：本机控制台 BFF `http://127.0.0.1:8092`（`L4ConsoleBFF`）。
- 身份：会话 cookie `access_token_cookie` 取自 `~/.local/state/sekoi-ops/v4-auth-state.json`，
  长度 252，**值未打印**；curl 以 `Cookie: access_token_cookie=<value>` 发送。
- 命令形状 `curl -s -o body -w '%{http_code}' -H "Cookie: access_token_cookie=$TOK" "…"`。

### 2) 原始读数（逐个参数）

| 请求 | HTTP | 响应体（原文/摘要） |
|---|---|---|
| `/api/audit?limit=5` | **400** | `{"code":"console.missing_filter","message":"at least one of ['runId','taskId','actorId','resourceId','action','from','to'] is required (no unfiltered table scan)"}` |
| `/api/audit?limit=5&type=task.created` | **400** | 同上 missing_filter（`type` 未被读取） |
| `/api/audit?limit=5&since=2026-11-12T00:00:00.000Z` | **400** | 同上（`since` 未被读取） |
| `/api/audit?limit=5&actor=emp_test` | **400** | 同上（`actor` 未被读取） |
| `/api/audit`（无参数） | **400** | 同上 |
| `/api/audit?limit=5&action=task.created` | **200** | `{"events":[…]}` |
| `/api/audit?limit=5&from=<7d 前>&to=<now>` | **200** | `{"events":[…]}` |

行数（`limit=50`、7 天窗）：

| 查询 | 行数 |
|---|---|
| 仅时间窗 | 50（触顶） |
| `action=task.created` | 14 |
| `action=approval.decided` | 6 |
| `action=no.such.action` | 0 |
| `action=task.created&type=zzz` | 14（塞入垃圾 `type` 不改变任何东西） |
| `actorId=emp_nope` | 0 |

行数组的键是 **`events`**（不是 `items`）；`model.ts:475` 的 `LIST_KEYS`
已把 `events` 纳入候选，故页面照常解析。

### 3) 结论（决定了前端该暴露什么）

1. **`type` / `since` / `actor` 三个拼写不被服务读取**：单独发送一律回 400
   `console.missing_filter`，与「什么都没带」**逐字同体**；与合法参数混发也不改变结果
   （`action=task.created&type=zzz` 仍 14 条）。→ 前端不得把它们当筛选发出去。
2. 真生效的是 `action`（精确匹配）、`from` / `to`、`limit`、`cursor`，以及
   `runId / taskId / actorId / resourceId`（400 体自己列出的七项）。
3. `?limit=5` 单独发 = 400：**服务拒绝无筛选的全表扫描**。

### 4) 前端与本轮改动（页面体在 `cb014cf5` 时已对齐，本轮补证据与回归锁）

- `api.ts` 的 `listUrl()` 只拼 `limit → action → from → to → cursor`，
  `ListFilters` 只有 `{ action, from, to }`；`event_type` 已不在线路上。
- 本轮新增两条**回归锁**（防以后有人「顺手」把 `type/since/actor` 加回来）：
  - `api.test.ts` → `sends only the parameters the service acts on — the ignored spellings never ride along`：
    解析 `listUrl(...)`，断言查询键集合**恰好**为 `action/cursor/from/limit/to`，
    且 `type/since/actor/event_type/actorId` 一个都不在。
  - `AuditEventsModulePage.test.tsx` → `never puts an ignored spelling on the wire — only the parameters the service acts on`：
    真实驱动「选类型 → 换窗口」，断言每次都**真发新请求**，且**所有**请求 URL 都带成对的
    `from=`/`to=`，同时无任何 `[?&](type|since|actor|event_type)=`。
- 服务端 400 的人话腿本来就有：非法/缺失筛选落错误态（人话 + 可复制请求编号 + 重试），
  不会把 400 画成空列表。

### 5) 与派单第 2 条的**偏差，如实记**

派单写「清空筛选回到无参请求」。**这条在本环境做不到，也不该做**：
无参请求会被服务以 400 `console.missing_filter` 拒绝（见上表第 5 行）。
页面因此把「清空」定义为**清掉用户可选的筛选**——事件类型回到「全部事件类型」，
而**有界时间窗始终随行**（默认最近 7 天，可选 24 小时/7 天/30 天），
永远不会发一次无参扫描。这一行为由
`every window keeps a bounded pair on the wire — the service 400s a filter-free scan`
与本轮新增用例双重锁定。

### 6) 其余三条判据的现状（本轮复核，未改动）

- 详情技术字段：`TechnicalDisclosure`（`aud02-*-details`）默认折叠，
  机器形状的变更值在人话层只显示「见「技术详情」」，原值进折叠层。
- verify 未启用：`isVerifyUnavailable()` 覆盖 403/404/405/501/unreachable/5xx，
  渲染 `aud03-unavailable`「本环境未启用」+ 原因 + 去处；200 时按真实
  `{ok,complete,scanned,…}` 出结论，从不假绿。
- 403≡404：详情同一 `DeniedPanel`（`aud02-detail-denied`），同 code + 同 rid 结构，
  不回显路径；测试用 `innerHTML` 逐字相等断言。

### 7) 门禁（本轮实测，`web/` 下）

```
npx vitest run src/modules/audit    → exit 0，Test Files 5 passed / Tests 104 passed
npx tsc -b . --noEmit               → exit 2，49 条 error TS 全在 ../apps/shared/**，非 shared 0 条
npx eslint src/modules/audit        → exit 0，0 errors / 3 warnings（useAuditData 既有 set-state-in-effect）
```

### 8) not verified（照实留）

- 未做真浏览器 1440/375 像素量测（本环境无 playwright/puppeteer 且禁 install；
  页面需鉴权 + 真实 BFF）。横溢仍以既有 CSS 契约断言为准。
- `runId / taskId / resourceId` 三个参数未单独探（本轮只探派单点名的 type/since/actor）。
- 服务端「采样到的动作码」是有限集合，下拉只暴露采样到的码；
  新动作出现前不会出现在筛选里（这是诚实而非缺陷）。

## R19 PASS tail b (2026-11-19, base c9266b55 → HEAD b65673c8)

QA 点不到的两处：行内「详情」格点了没反应；「完整性校验」按钮根本不场。

### 1) 行内「详情」格 — 真展开（读数）

- 原因：旧实现里可点的是格子里一个 12px 的下划线文字，格子本身不是控件；点格子什么都不会发生，
  QA 的 textLen 自然不变。另：旧折叠在没内容时整块 `return null`，会出现「点开但看不见东西」。
- 现在：整格就是一个 `button`（`aud01-cell-<key>-details`，`aria-expanded` 随状态），
  展开后有独立面板 `data-testid="aud01-tech-details"`，固定六行技术字段
  （事件标识 / 事件类型原值 / 结果原值 / 发生时间原值 / 记账时间原值 / 请求编号；服务没给的写「服务未回传」），
  面板永不空。折叠状态由页面持有 → 同一时刻只开一行，`aud01-tech-details` 始终唯一。
- **DOM 读数**（jsdom，`document.body.textContent.length`）：
  `before=562 → after=684，差 +122`（断言 `> 40`，即至少一行真内容；测试名
  `the 详情 cell opens a real technical panel and grows the text by a measured amount`）。

### 2) 「完整性校验」按钮 — 在场、可点、状态诚实

- 按钮 `data-testid="aud01-verify"`（文案「完整性校验」，请求中禁用并转圈），位于页面工具条，
  **denied 态也渲染**（403/404 时列表整页替换，但按钮仍在，点了也只会得到同一句「本环境未启用」）。
- 点击后用当前时间窗真发 `GET /agent-api/api/audit-verify?from=…&to=…`（与列表同一对 instants）。
- 四种落点：
  - loading → `aud01-verify-loading`；
  - 200 → `aud01-verify-result`（复用 `VerifyResultBody`：条数带分母、断点、技术详情折叠）；
  - **403/404/405/501/0/5xx → `aud01-verify-not-enabled`**：标题「本环境未启用」+ 原因句
    （`verifyUnavailableReason`，404 → 「这套环境没有提供完整性校验，或者它还没有对你开放。」）
    + 「下一步：让工作区管理员在审计服务里开通时间窗完整性校验…」+ 请求编号（缺失给可复制兜底）
    + 技术详情折叠（原始 body 只在这层）+ 再运行一次；**不回显路由、不回显 404、不出现 `console.unknown_route`**；
  - 其它失败 → `aud01-verify-error`（人话 + 请求编号 + 重试）。
- **DOM 读数**（stub 404）：`before=562 → after=681，差 +119`（断言 `> 20`）。

### 3) 本轮实测到的运行态（比 QA 的观察更细）

带会话 cookie 直打 BFF：

| 请求 | HTTP | 响应 |
|---|---|---|
| `GET /api/audit/verify?from=&to=` | **404** | `{"code":"audit.verify_not_enabled","message":"本环境未启用完整性校验，链校验请走 /api/audit-verify","rid":"3c133e68"}` |
| `GET /api/audit-verify?from=&to=` | **200** | `{"ok":true,"complete":true,"scanned":0,"anchorCheckpointId":"cp_t_seakoi_pilot_2026111300","chainHeadHash":"ah_031a89f9…"}` |
| `GET 127.0.0.1:9122/agent-api/api/audit-verify?…`（开发 SPA 代理） | **200** | 同上（真跑通） |
| `GET 127.0.0.1:8092/agent-api/…`（BFF 直连无该前缀） | 404 | `console.not_found`（静态资源） |

即：`/api/audit/verify` 是**未启用的旧别名**，它自己回了 404 并把去处写在 message 里；
页面用的是真路由，本环境 200。所以按钮在真环境里会出真实条数，只有在路由真的没有/被关掉时
才落 `aud01-verify-not-enabled`（用 404 stub 证过）。

### 4) 顺手修掉的假绿（本轮新面板会把它暴露出来）

`scanned: 0` 且 `ok: true` 的真实回答，旧 `VerifyResultBody` 会给出「没有发现断点」+ 绿色徽标 ——
什么都没核对却报通过。现在 `scanned === 0` → 徽标中性、「这一段没有核对到记录」，
并在正文写「这不等于「完整」，只是这一段没有可核对的内容。」
（aud03 与列表共用该组件，两处同时受益；新增用例断言不出现「没有发现断点」。）

### 5) 未动的三条约束

- 零写入口：新按钮是只读 GET；页内无 form/提交；403≡404 同体与 `aud01-*` 家族未改。
- 未新增依赖、未改共享件（`App.tsx`/`shell/**`/其它模块/locale 全部未碰）。
- `TechnicalDisclosure` 原样保留给详情面与失败面，行内格改用自己的面板。

### 6) 门禁（`web/` 下，本轮实测）

```
npx vitest run src/modules/audit   → exit 0，Test Files 5 passed / Tests 107 passed（原 104，+3）
npx tsc -b . --noEmit              → exit 2，49 条 error TS 全在 ../apps/shared/**，非 shared 0 条
npx eslint src/modules/audit       → exit 0，0 errors / 3 warnings（useAuditData 既有）
```

### 7) not verified

- 未做真浏览器像素/点击量测（无 playwright、禁 install、需鉴权）——上面两个 len 差是 jsdom 读数，
  不是浏览器渲染读数；未测 1440/375 下新面板的换行表现（沿用既有 `min-w-0 break-words` 契约）。
- 服务在真实 200 里给 `scanned: 0`；没有窗口同时含事件与断点样本，`broken > 0` 的界面分支只有单元测试覆盖。

## R21 拦车 b 前半（2026-11-19，base 3ca5338f）

QA 症状：`/audit` 被改写落到 `/system?tab=events`；页级 `aud01-tech-details` 不存在
（techDetails:false、detailsEls:0）；行级 `aud01-cell-<id>-details` 有 50 个 button 但外部探针崩。

### 1) 路由：/audit 真渲染审计页，不改写

- 根因：`web/src/App.tsx` 里 `/audit` 的 element 是
  `<Navigate to="/system?tab=events" replace />`——地址栏被改写，模块体从未在该 URL 上渲染；
  QA 的探针打在改写后的页面上，所以 techDetails/详情按钮都读不到。
- 现在：`<Route path="/audit" element={<AuditEventsConsolePage />} />`，
  模块直接挂在 `/audit`；带 `?tab=events` 时同样命中（页面只读它自己的参数，`tab` 被忽略）。
- `/system?tab=events` 的既有 live 槽位未动，旧入口照常可用。
- 证据：新增 `appRouting.test.ts`（源码契约：`/audit` 直挂模块、旧的 Navigate 元素不再存在、
  懒加载指针仍在）+ 模块测试在 `/audit?tab=events` 入口下真渲染出
  `agent-v2-page-audit` 与 `aud01-tech-details`。

### 2) 页级 `aud01-tech-details`（读数）

- 页脚的技术详情折叠由 `aud01-list-details` 更名为 **`aud01-tech-details`**，
  按钮带 `aria-expanded` 与 `data-expanded="true|false"`，供外部探针直接读状态。
- **DOM 读数**（jsdom，`document.body.textContent.length`）：`before=562 → after=639`，差 **+77**。
  折叠内容固定四行（本页条数 / 筛选 / 时间窗 / 游标），永不空，所以一次点击必增量。

### 3) 行级展开保持可点，并给出外部判据

- 行内格 `aud01-cell-<id>-details` 仍是整格 button，展开面板 testid 为
  **`aud01-row-tech-details`**（与页级 id 分离，避免同名冲突）；同一时刻只开一行，id 唯一。
- 两个开关都带 `data-expanded`，外部探针不用点击也能判状态：
  `[data-testid="aud01-cell-<id>-details"][data-expanded="false|true"]`。
- **DOM 读数**：行级 `before=562 → after=684`，差 **+122**。

### 4) 完整性校验仍打真路由，400 说人话

- 按钮 `aud01-verify` 发 `GET /agent-api/api/audit-verify?from=…&to=…`（未改路径、未加 mock 分支）。
- 新增用例：服务回 **400** 时落 `aud01-verify-error`，屏上是
  「这次读取缺一个服务端要求的筛选条件，没能返回记录。请换个时间范围或筛选条件再试。」
  + 可复制请求编号（`rid-verify-400`），**不出现任何条数、不出现「没有发现断点」、不出现 `request.missing_filter`**。
- 未启用腿（403/404/405/501/不可达/5xx）仍是 `aud01-verify-not-enabled`；200 仍出真实条数（scanned=0 不当通过）。

### 5) 未回退的三条

- 四态、403≡404 同体、零写入口：模块测试全绿（含 denied 同一 body 与零写入口断言）。
- 写域：`web/src/modules/audit/**` + `web/src/App.tsx` 仅审计路由一处 + `docs/_artifacts/aud/**`；
  未碰其他 modules、shell 其他文件、package/lock。

### 6) 门禁（`web/` 下，本轮实测）

- `npx vitest run src/modules/audit` → **exit 0**，6 files / **113 tests**（原 107，+6）。
- `npx tsc -b . --noEmit` → **exit 2**，51 条：49 条在 `../apps/shared/**`（既有），
  另 2 条在 `src/pages/LoginPage.test.tsx`（**base 3ca5338f 既有**，本轮未改该文件，
  最近改动是祖先 `b3af7b52`）；**`src/modules/audit` 与 `src/App.tsx` 0 条**。
- `npx eslint src/modules/audit src/App.tsx` → **exit 0**，0 errors / 7 warnings（均为既有 set-state-in-effect）。

### 7) not verified

- 未做真浏览器探针（无 playwright、禁 install、需鉴权）。`/audit` 不改写与两个 testid 的存在，
  由源码契约 + jsdom 渲染与长度读数证明；QA 侧需在重建 dist 后复探
  （当前 9122 服务的 dist 仍是不含本轮改动的旧代次）。
- 1440/375 下新面板的换行表现未做像素量测（沿用 min-w-0 break-words 契约）。

## TASK runs real-data depth (2026-11-19, base b642c64d)

派单要求 `/runs` 每一面都站在真数据上。先探 BFF 再改页面，下面是原始读数与改动。

### 1) 探针（带会话 cookie；`/tmp/.cookie_val`，值未打印）

| 请求 | HTTP | 结果 |
|---|---|---|
| `/api/runs?limit=5` | **400** | `{"code":"request.missing_filter","message":"at least one of employeeId/status/since is required"}` |
| `/api/runs?since=<7d>&limit=50` | **200** | **14 行**，`{"items":[…],"nextCursor":null}` |
| `/api/runs?since=&employeeId=emp_nope&limit=50` | 200 | **0 行** ⇒ `employeeId` 真生效 |
| `/api/runs?since=&status=bogus&limit=50` | 200 | **0 行** ⇒ `status` 真生效 |
| `/api/runs?since=&upstreamRunId=run_nope&limit=50` | 200 | **14 行**（与不带同）⇒ **被忽略** |
| `/api/runs?since=&upstream=run_nope&limit=50` | 200 | **14 行** ⇒ **被忽略** |
| `/api/run-detail?id=<rn_…>` | 200 | 裸对象：runId/status/reasonCode/costUsd/**costStatus**/upstreamRunId/startedAt/endedAt/lastEventSeq… |
| `/api/run-events?id=<rn_…>` | 400 | `console.missing_param`「runId is required」 |
| `/api/run-events?runId=<rn_…>&limit=20` | 200 | `{"items":[{seq,eventType,payload{…},occurredAt}]}` |
| `/api/employees?limit=100` | 200 | 3 行 `{employeeId,name,…}` |

真数据三态样本（同一次 14 行里）：
- `rn_01M7822XN781D2S9JASH5TX1XZ`：status `completed`，**costStatus `upstream`**，`costUsd 0.009875`，`upstreamRunId run_4b0c…`，`employeeId emp_9F42…`。
- `rn_01M7D7421P5PA27TEXMT9YVDZ8`：status `running`，**costStatus `unknown` 且没有 `costUsd` 键**，`endedAt:null` —— 未知成本的真实形状。

### 2) 本轮改动（全部在 `web/src/modules/runs/**`）

1. **列表新增负责人列**（`run5-row-<n>-employee`）：`姓名 · 8位短码`；目录里没有名字时 `员工 · 8位短码`；没有 `employeeId` 时 `未指派`（`title` 写明「这条运行没有带回负责人；不代填、不猜」）。完整 id 只进 `title`。
   - 为此把员工目录的旁读闸门从「详情打开时」放宽到「非 `?state=` 复现腿」——列表现在也能显示姓名；目录读取失败只会退回 8 位码，不影响运行数据，且复现腿仍零请求。
2. **状态词**：六个已知状态保持中文；**表里没有的词读「待核实」**（原始值进 `title`），而**真的缺字段仍是「—」**——两者不再混为一谈。
3. **成本三态**（本轮复核，行为已正确，未改逻辑）：`costStatus:upstream` + `0.009875` → `$0.01` + 「已计价」+「金额来自上游账本」；`costStatus:unknown` → 「—」+「未知」+「账本没有这条运行的计价记录，金额按未知处理」；无 `costStatus` → 「—」+「未记录」。真 0 仍显 `$0.00`。
4. **上游编号的假入口已删**：探针证明 `/api/runs` 对 `upstreamRunId=` 与 `upstream=` 都不作反应，所以原来「点上游编号 → 面板」只是改 URL。现在 `run5-detail-upstream` 是**不可点的复制行**，屏上写明「控制台没有按上游编号查询的入口，所以这里只提供复制，不做会落空的跳转」；`?upstream=` 面板（`run5-upstream`）整块移除。
5. **深链**：`?run=<id>` 刷新保态不变；新增从路径段 `/runs/<runId>` 读取（`useLocation().pathname` 正则，解码后去空白），所以壳层一旦注册 `/runs/:runId` 该链接就生效。
   - **如实披露**：`App.tsx:1375` 目前只有 `path="/runs"`，`/runs/:runId` 的路由注册属壳层（本单写域禁碰 App.tsx），本页只做到「路径段能被识别」。
6. **重试=新 Run**：保持原行为（POST `run-retry` 必须回新 id，然后导航到新 id，原记录不动）；403/404 时给 GAP-09 人话 + 请求编号，不假跳。
7. **时间线**：`ToolIntent` 的 `resultRef` 缺失仍显「未记录」（原始 `payload` 值只在「技术详情」）。

### 3) 门禁（`web/`，本轮实测）

```
npx vitest run src/modules/runs  → exit 0，Test Files 2 passed / Tests 64 passed（原 54，+10）
npx tsc -b . --noEmit            → exit 2；49 条在 ../apps/shared/** + 2 条在 src/pages/LoginPage.test.tsx（均为既有），runs 模块 0
npx eslint src/modules/runs      → exit 0
```

测试新增/改写（`RunsModulePage.test.tsx` +6、`runs.test.ts` +4）覆盖：姓名 · 8位短码、无名时 员工 · 码、无负责人 未指派、未知状态 待核实 / 缺字段 —、成本三态两种真实形状、`/runs/<id>` 路径深链、上游编号不可点且屏上有原因、列表旁读员工目录不再依赖详情。

### 4) fixture 纪律

模块内 `data-fixture` 只出现在 `?state=` 复现腿（`states.tsx` 的 `fixtureAttr` 与页根），**没有任何样例数据行**；能真取数的面一律真取。

### 5) not verified

- 真浏览器 1440/1280/375 像素横溢未量测（无 playwright、禁 install；页面需登录态）。布局用 `grid-cols-[minmax(0,…)]` + `break-words` + `min-w-0` 契约保证不横溢，新增的负责人列沿用同一写法。
- `/runs/:runId` 的壳层路由未注册（写域外），本页只能识别路径段；未运行真实浏览器刷新验证。
- 重试写入真腿未测成功路径（BFF 在 `run-retry` 上返回 401/404 时页面走 GAP-09 人话），只有 mock 级「新 id 不覆盖原记录」断言。

## TASK R23 — runs detail as a history entry (2026-11-19, base 1b7d91a9)

Symptom (QA): opening a run detail did not push a history entry, so the browser
back button left the page ("blank") instead of returning to the list.

Cause: `setParam` in `RunsModulePage.tsx` always called `setParams(next, { replace: true })`,
so the detail replaced the list entry rather than being pushed on top of it.

Change (write scope `web/src/modules/runs/**` only):

1. `setParam(key, value, opts?: { push?: boolean })` — filters keep `replace: true`
   (one page, no history entry per keystroke); the push branch writes
   `{ replace: false, state: { fromList: true } }`.
2. `openRun` pushes the detail entry (`{ push: true }`) and is a no-op when the
   run is already selected.
3. `closeRun` walks back (`navigate(-1)`) when the current entry carries
   `fromList` (the detail was pushed from the list, so the browser restores the
   list and its scroll position natively); a deep-linked detail has nothing
   behind it, so it still rewrites the entry to the list instead of leaving the app.
4. The replace branch carries `state: locationState ?? null`, so `retry = new run`
   keeps the `fromList` marker and 关闭 still returns to the list.

Tests (`__tests__` file `RunsModulePage.test.tsx`, +3 cases / 36 → 39):

- `list → detail → back, three times over, always lands back on the list` —
  a probe calls `navigate(-1)` (same traversal as the browser button); each cycle
  asserts the detail opened (`?run=` present) and that back leaves the row list
  on screen with `run=` gone. This case cannot pass on the old code (the entry
  was replaced, so back had nowhere to go).
- `a deep-linked detail closes in place` — entry `/runs?run=…`, 关闭 → `/runs`.
- `closing a detail that was pushed walks back instead of stacking another entry`.

Gates (from `web/`):

- `npx vitest run src/modules/runs` → exit 0, 2 files / **67 tests** (was 64).
- `npx eslint src/modules/runs` → exit 0.
- `npx tsc -b . --noEmit` → exit 2, 51 errors: 49 in `../apps/shared/**` + 2 in
  `src/pages/LoginPage.test.tsx` (both pre-existing); 0 in `src/modules/runs`.

Untested: no real-browser session here (no playwright, page needs auth), so the
native scroll restoration on back is reasoned from the same-document traversal
the test exercises, not measured; the shell still registers only `/runs`
(`App.tsx:1375`), so the path form `/runs/<runId>` is served by this page's own
parser but has no dedicated route yet.

## TASK platform channels real-data surface (2026-11-19, base 23a8a7e0)

### What the service actually answers (probed with the session cookie, value never printed)

| route | HTTP | body |
|---|---|---|
| /agent-api/api/messaging/platforms?limit=50 | 404 | console.unknown_route |
| /agent-api/api/channels?limit=50 | 404 | console.unknown_route |
| /agent-api/api/gateway-connections?limit=50 | 404 | console.unknown_route |
| /agent-api/api/connectors?limit=50 | 404 | console.unknown_route |
| /agent-api/api/datasources?limit=50 | 404 | console.unknown_route |
| /agent-api/api/mcp/servers?limit=50 | 404 | console.unknown_route |
| /agent-api/api/hermes-summary?limit=50 | 200 | schema runtime.hermes.summary.v1 |

The BFF route table (seakoi-agent-os-l0-board/apps/console/server.py) has no
channel / platform / datasource route at all. The only real platform surface is
the gateway summary: gateway.platforms is a record, and the live tenant answers

    api_server: { state: connected, needs_attention: false }
    feishu:     { state: connected, needs_attention: false }

so the real row count is 2. gateway.updated_at is the only instant it carries
(2026-11-19T11:43:46.578965+00:00, one gateway-wide stamp, not per platform),
and there is no credential field anywhere in the payload.

### What changed

channels.ts
- The platforms source now probes /agent-api/api/hermes-summary first, keeping
  /api/messaging/platforms and /api/channels as later candidates. Origin reads
  「网关自己报告的运行状态」; the absent-route reason says the platform list
  cannot be verified without it.
- New platform row path: PLATFORM_LABELS / PLATFORM_KINDS (api_server → API 服务
  · 接口服务, feishu → 飞书 · 消息平台, unknown key stays verbatim),
  PLATFORM_STATUS_LABEL (已连接 / 未连接 / 未配置 / 待核实), platformStatusOf
  (exported so the token map is pinned by a unit test), summaryPlatforms,
  summaryStamp, and platformRow.
- Credential is a STATE only: credentialOf returns configured / missing /
  unknown plus a plain-Chinese reason, and never returns any value. With no such
  field upstream every live row reads 「凭据：未知」 with the reason 「服务的回答里
  没有给出这份凭据的状态，本页不替它猜，也不显示任何令牌内容」.
- A platform with no instant of its own borrows the gateway stamp and carries
  lastSeenNote 「服务按网关整体给出更新时间，这项平台没有单独的时间」; the note
  rides in the element title, not as a second line of noise.

ChannelsPage.tsx
- Platform rows use the platform vocabulary for the badge, print 「最近事件（北京
  时间）」, add the credential line and the 「需要处理」 line when the service sets
  needs_attention, and keep the existing dimming (opacity-60) for anything not
  已连接. Non-platform rows are unchanged.
- The refresh button now carries aria-busy while a read is in flight.

### Gates (run from web/)

- npx vitest run src/modules/channels → 2 files, 101 tests passed (was 94).
- npx tsc -b . --noEmit → 52 error TS lines: 49 in ../apps/shared/**, 2 in
  src/pages/LoginPage.test.tsx and 1 in src/App.tsx:1592 (useSearchParams).
  The last three are pre-existing at this base and outside this lane's write
  scope; grep for modules/channels in the output returns 0.
- npx eslint src/modules/channels → exit 0, no output.

### Honest limits

- The status select filters the ROWS THIS PAGE READ (applyFilter), because the
  gateway summary ignores status= (probed: status=unavailable still returns both
  platforms). The select genuinely changes what is painted; there is simply no
  server-side status filter to lean on, and the DONE says so instead of implying
  one.
- No browser pixel measurement at 1440 / 1280 / 375: the page reaches runtime
  only through the shell slot (capabilities tab), which is another lane's write
  scope, and the served dist predates this change.
- Credential stays 未知 by construction until the BFF exposes a per-platform
  credential state; the page cannot and must not invent one.
- A platform key outside PLATFORM_LABELS keeps its raw key as the name (no
  invented Chinese label).

## R24 white-screen restore (2026-11-19, base 23a8a7e0 / lane tip de3eb977)

### 症状与根因
- QA R24：直链 /audit 可见白屏（v4r24-audit-1440.png / v4r24-audit-pw-1440.png），是已清项的回退。
- 根因（TS 证据）：web/src/App.tsx 的 AuditAwareEntry（由 997a73c1 加入）调用 useSearchParams()，但同一文件的 react-router import 列表里没有它。
  tsc 原文：src/App.tsx(1592,16): error TS2552: Cannot find name 'useSearchParams'.
  esbuild 不校验这一行，运行时按全局标识符查找 -> ReferenceError -> 整条 /audit 路由渲染为空，即白屏。
- 修复：web/src/App.tsx 的 react-router import 增加一行 useSearchParams（仅此一处，无其它改动）。
  这行在 R24 写域（modules/audit）之外，属于必要的越域一行修复，在此与 commit body 如实标注。

### 回归锁（写域内）
- web/src/modules/audit/appRouting.test.ts 新增用例：断言 App.tsx 含 const [sp] = useSearchParams();，且 react-router 的 import 块包含 useSearchParams；注释写明 R24、esbuild 的全局查找行为与 TS2552。

### 真机读数（本 worktree 新构建 + 本地反代）
- 构建：npx vite build --outDir build-r24 -> exit 0；入口 /assets/index-DsDPj1MW.js。
- 供页：/tmp/serve-r24.cjs 静态服 build-r24，并把 /agent-api/* 反代到 127.0.0.1:8092（携带会话 cookie，值不打印）。
- 直链 /audit（无头 Chrome via CDP，两档各一次）：
  - 1440x900：mainLen 178749；[data-testid^="aud01-"] 459；[data-testid^="agent-v2-page-audit"] 1；scrollWidth/clientWidth 1440/1440。
  - 375x812：mainLen 178749；aud01 459；page-audit 1；375/375（无横溢）。
  - 首屏文案：「已显示 50 条审计事件（最近 7 天），下面还有更多」「时间为北京时间」——真数据行，不是空壳。
- 反证（同一构建但无 /agent-api 反代，vite preview）：mainLen 10104；aud01 10；page-audit 1；文案「读取失败」。
  即接口不可达时页面落诚实的失败态而不是白屏，仍非空。
- 截图：docs/_artifacts/aud/shots/audit-1440.png、audit-375.png（取反代那一次，真实 50 行）。
  说明：截图左侧「暂时确认不到登录状态 —」是壳的身份角标（浏览器本身无 cookie，数据由反代补足），不属于被修页面。

### 403/404 与模块口径（未改，已复核）
- states.tsx 的 DeniedPanel 是单一实体，同时服务 403 与 404（同文案，带可复制请求编号）；列表 aud01-denied、详情 aud02-detail-denied。
- 技术详情折叠与完整性校验（真路由 /agent-api/api/audit-verify）本次未改动。

### 门禁（web/ 下）
- ./node_modules/.bin/vitest run src/modules/audit -> exit 0，6 files / 114 tests（原 113，+1 回归锁）。
- npx tsc -b . --noEmit -> 51 条：49 条在 ../apps/shared/**，2 条在 src/pages/LoginPage.test.tsx；App.tsx:1592 的 TS2552 已消失，modules/audit 0 条。
- ./node_modules/.bin/eslint src/modules/audit -> exit 0（0 errors / 3 既有 set-state-in-effect warning）。

### 未验 / 披露
- 这行修复在写域外（App.tsx），是白屏的唯一成因，别无他法；未改 App.tsx 其它内容。
- 9122 常驻 dev SPA 仍服务 forks/hermes-agent/hermes_cli/web_dist 的旧构建，所以彼处看不到本修复；上述读数来自本 worktree 的新构建 + 反代，build-r24 为未跟踪产物，不入库。
- 非管理员身份下的 403 真腿未复现（当前数据是管理员可见范围）；403 与 404 的同体性由模块结构与既有测试保证。
- 站内跳转与直链共用同一条 /audit 路由，直链已证渲染；未逐一截取每个导航入口的点击路径。

## TASK evidence citations real data (2026-11-19, base de23c92e)

### Probes (session cookie, via the console BFF on 127.0.0.1:9122/agent-api)
| request | HTTP | what it said |
|---|---|---|
| `/api/run-events?kind=citation&limit=50` | **400** | `{"code":"console.missing_param","message":"runId is required"}` — run-events cannot serve a citation list |
| `/api/run-events?runId=rn_01M7822XN781D2S9JASH5TX1XZ&limit=20` | 200 | `{"items":[{runId,seq,eventType,payload,pulledAt,occurredAt}]}` — run deltas only, **no citations array** |
| `/api/audit?from=<7d ISO>&to=<now ISO>&limit=50` | **200** | `{"events":[...]}` — **50 real events**, each with eventId / sourceSystem / actor / resource / occurredAt / outcome |

So the real surface for this pane is the audit event list; an "evidence row"
is one audit event. Nothing is fabricated: there is no per-row citation array
upstream, and the page does not pretend to have one.

### What changed (write scope: web/src/modules/evidence/**)
- `evidence.ts` rewritten: `CitationRow` now carries 引用来源 (`sourceLabel`,
  masked `actorLabel` + raw `actorTitle`), 目标对象 (`targetTypeLabel`,
  masked `targetLabel` + raw `targetTitle`), `at`, `href`, `unverified` and
  `unreachableReason`. `shortCode` (8-char) / `midEllipsis` (prefix + 4…4)
  keep bare ids off the screen; `SOURCE_LABELS` / `RESOURCE_LABELS` turn wire
  enums into plain words while unlisted values pass through verbatim;
  `readCitations` reads the `events` key the route really sends;
  `citationsUrl` asks for a bounded 7-day window (`from`/`to`/`limit=50`)
  because an unfiltered scan is refused.
- `EvidenceModulePage.tsx` rewritten on the `ev5-*` id family. Rows show
  来源 badge + actor + 「目标对象 <类型> · <码>」 + 北京时间到分, and either
  「打开原文」 → `/audit?id=<eventId>` (verified: `AuditEventsModulePage.tsx:145`
  reads `params.get("id")`) or 「原文不可达」 with the reason. A missing event
  id or object id paints 「待核实」 (GAP number only in the `title`).
- The old silent fallback is gone: on 404 the page used to paint fixture rows
  as if they were data. Now 403 and 404 both land on ONE denied panel (same
  body, copyable request id, no path echo), the fixture exists only behind
  `?state=` reproduction legs (marked `data-fixture` + a 「复现态」 badge +
  GAP in the title, zero requests issued).
- Four states plus a session-less 「需要登录」 leg (zero requests); error panel
  carries a copyable request id (or 「本次请求未记录编号」) and a working retry.
- Layout: flex + `min-w-0` + `break-words`, no fixed widths; list stacks at
  375 and keeps `scrollWidth == clientWidth` by construction.

### Gates (from web/)
- `./node_modules/.bin/vitest run src/modules/evidence` → **exit 0**, 2 files / **25 tests**
  (`evidence.test.ts` 12 pure + `EvidenceModulePage.test.tsx` 13 page).
- `npx tsc -b . --noEmit` → **53** `error TS` lines, `modules/evidence` **0**;
  the non-owned ones are the standing `../apps/shared/**` block plus
  `src/modules/approvals/api.test.ts(80,12)` and two in `src/pages/LoginPage.test.tsx`.
- `./node_modules/.bin/eslint src/modules/evidence` → exit 0, 0 errors /
  2 warnings (exported `fmtStamp` refresh rule; the repo's standing
  `set-state-in-effect` idiom in the forced-state branch).

### Live readings
- `/api/audit?from=&to=&limit=50` returned **50** events for the 7-day window,
  so the pane's first page is 50 rows.
- Unreachable count: every real row carried `eventId`, so 0 unreachable in that
  sample; the state is exercised by tests (a row without an event id) and by the
  `?state=ready` reproduction leg.

### Untested / limits
- 1440 / 1280 / 375 pixel measurement: the pane is only reachable through the
  shell's knowledge/audit slot in another lane's write scope, and the served
  dist predates this change. Overflow safety is a contract (`min-w-0`,
  `break-words`, flex wrap, no fixed widths), not a measured number.
- No per-row citation object exists upstream (run-events has none), so the
  pane's rows are audit events; if a citation endpoint lands later, `readRow`
  is the one place to extend.
- `tabNav.ts` (manifest) intentionally untouched: its `dataSource` string still
  names run-events citations.

## TASK collab delegation chain real data (2026-11-19, base de23c92e / trunk f8046930)

### Probes (session cookie, value never printed)
| request | HTTP | body |
|---|---|---|
| `http://127.0.0.1:9122/agent-api/api/delegations?limit=5` | **200** 46 B | `{"items":[],"asOf":"2026-11-19T12:15:11.531Z"}` |
| `http://127.0.0.1:8092/api/delegations?limit=5` | **200** 46 B | `{"items":[],"asOf":"2026-11-19T12:15:11.546Z"}` |

Read: the route is wired and authorised for this tenant; there are genuinely
zero delegations. The page therefore shows the honest empty state (reason +
next step + the service's own `asOf`), never 「未接入」, never a fake row and
never a 0 dressed up as a count of something else.

### Code (write scope `web/src/modules/collab/**` only)
- `delegations.ts`: `DelegationRow` gained `action` + `effectiveFrom`
  (`ACTION_KEYS`, `EFFECTIVE_KEYS`, both defensive key lists); new
  `actionWords()` (指派/交接/借调/交还/请求协助/转移/委托, unknown →
  「动作未识别」, absent → 「未记录」, raw token only in `title`);
  `CHAIN_LINK_REASON`; `ChainGroup` + `chainGroups(rows)` grouping by 委托方
  in answer order.
- `CollabDelegationsModulePage.tsx`: 7 columns 委托方 / 受托方 / 范围 /
  **动作** / 状态 / **生效 / 到期** / 来源; the validity cell now prints
  「起 <BJT minute>」 and 「至 <BJT minute>」 (each `—` with its own reason
  when absent) and keeps the raw instants in `title`; new **委托链** view
  (`?view=chain`, written to the URL with `replace` so refresh and shared
  links keep the pane; `data-view` on the page root) grouping rows under
  委托方 with 「本页 N 条（只数这一页，不是全量）」 and a 链未接入 banner whose
  reason is that DELEGATION v1.0 carries no parent delegation id — no level,
  no root, no 0 is printed; the list and chain views share one read (switching
  the view issues no request). All testids renamed `col4-*` → `col5-*`
  (page, row, states, retry/request-id ids).
- Zero write entries kept as the earlier ruling defines it: **no 撤销/新建
  button is rendered at all** (a disabled button would be a dead control);
  the read-only sentence was strengthened to 「这一页是只读的，不提供接受、
  拒绝、交接、完成这些动作…」 and a test asserts no button/link carries
  撤销/新建/发起委托/接受/拒绝/交接给/完成委托.

### Gates (from `web/`)
- `./node_modules/.bin/vitest run src/modules/collab` → exit 0, **2 files /
  95 tests** (was 88; +7: action words + title, 生效/到期 split, absent →
  「未记录」/「—」, view switch keeps the URL and issues no extra read,
  `?view=chain` opens the chain, grouping + 链未接入 reason + no 「0 层」,
  empty truth on the chain link, no write affordance on either view).
- `npx tsc -b . --noEmit` → **53** `error TS`, `grep -c modules/collab` = 0;
  the non-shared lines are the standing pre-existing ones
  (`src/modules/approvals/api.test.ts(79,12)/(80,12)` TS18047 and two
  `src/pages/LoginPage.test.tsx` TS2739).
- `./node_modules/.bin/eslint src/modules/collab` → exit 0, no output.
- Housekeeping: an untracked `web/src/modules/evidence/evidence.test.ts`
  debris (referencing exports absent at this trunk, 8 new tsc errors) was
  moved to `/tmp/l4p4-debris/` — not deleted, not committed; the tree now
  matches the trunk generation apart from this task's files.

### Untested / unmeasured
- The live tenant has zero delegations, so the chain grouping and the list
  rows were exercised with mocked answers only; no real 2xx row was ever
  sampled in this generation.
- No 1440/1280/375 pixel measurement: the pane is mounted by the shell lane
  and the dev SPA on `127.0.0.1:9122` serves a dist older than this change.
  The layout keeps the standing discipline (flex + `minmax(0,…)` grid,
  `min-w-0`/`break-words`, no fixed pixel widths) and a test pins it.
- `action` / `effectiveFrom` key names are candidate lists; the frozen
  DELEGATION v1.0 record names neither, so both may legitimately read
  「未记录」 against a real row.


## TASK retention read-only surface (2026-11-19, base 703aff57 = gate ledger @ d6d9bb07)

### What was asked
`/system?tab=retention` as a read-only real-data surface: per area (审计事件 / 运行记录 /
会话日志 / 上传物) retention days, last clean-up and next run in Beijing time to the
minute, current occupancy and threshold; a source that cannot be read reads 「未接入」 with
its reason (gap id only in `title`), never a fabricated 0; the write-shaped actions
(立即清理 / 修改策略) must be `data-planned` + `aria-disabled` + a `title` reason and never
report a success; four states with a copyable request id and a retry, 403 ≡ 404, no
horizontal overflow at 1440/1280/375, testids `ret4-*`.

### Probes (2026-11-19, session cookie via 127.0.0.1:8092; value never printed)
| route | HTTP | code |
|---|---|---|
| `/api/retention` | 404 | `console.unknown_route` |
| `/api/retention-policy` | 404 | `console.unknown_route` |
| `/api/data-retention` | 404 | `console.unknown_route` |
| `/api/storage` | 404 | `console.unknown_route` |
| `/api/storage-usage` | 404 | `console.unknown_route` |
| `/api/audit-retention` | 404 | `console.unknown_route` |
| `/api/cleanup` | 404 | `console.unknown_route` |
| `/api/maintenance` | 404 | `console.unknown_route` |

`apps/console/BFF-ROUTE-MATRIX.md` has no retention / clean-up row at all, so this
deployment genuinely has no source. The page therefore paints the 未接入 surface (four
areas listed, every field `—` with its reason) instead of inventing a policy, and the
same code keeps working the day a 200 appears.

### Code (write scope only: `web/src/modules/audit/**`)
- `retention.ts` (new): `RETENTION_PATH`, `GAP-13`, the four canonical `SECTIONS`, a
  defensive `readRetention` (area aliases folded, missing area listed as 未接入, absent
  field stays `null`), `unwiredSections`, `codeOf` + `probeOf` (a 404
  `console.unknown_route` is 未接入; every other 403/404 is the one denial body; anything
  else is a failure), `failureSentence` (no HTTP code in the sentence), `beijingMinute`,
  `formatBytes`, `occupancyShare` (floor + cap 99 — 99.6% never prints 100%), and
  `PLANNED_ACTIONS` with their reasons.
- `RetentionModulePage.tsx` (new): phases `loading | ready | unwired | error | denied`;
  four section cards with 保留天数 / 最近清理 / 下次执行 / 当前占用 / 阈值 / 占用比例
  (each `—` carrying `data-missing` and a `title` reason); the 未接入 banner; one denied
  body for 403 and 404 with `RequestIdLine`; an error card with sentence + copyable id +
  retry + 技术详情; the two planned buttons `disabled` + `aria-disabled="true"` +
  `data-planned="true"` + reason in `title`; `ret4-tech-details` carries the probed route
  and the gap id. `?state=` legs paint without a request and mark the root
  `data-fixture`.
- Tests: `retention.test.ts` (13 pure cases) + `RetentionModulePage.test.tsx` (9 render
  cases) — 22 new.

### Gates
- `./node_modules/.bin/vitest run src/modules/audit` → exit 0, **8 files / 136 tests**
  (was 114; +22).
- `npx tsc -b . --noEmit` → exit 2 with **53** `error TS`, `modules/audit` **0** (the
  floor is the standing 49 in `../apps/shared/**` + 2 in `src/modules/approvals/api.test.ts`
  + 2 in `src/pages/LoginPage.test.tsx`).
- `./node_modules/.bin/eslint src/modules/audit` → exit 0, **0 errors / 5 warnings**
  (all pre-existing `react-hooks/set-state-in-effect`).
- Build to /tmp only: `npx vite build --outDir /tmp/ret4-build` → exit 0; entry
  `assets/index-47QDOzMv.js` with **0** hits of `ret4-page`; the marker lives in the lazy
  chunk `assets/RetentionModulePage-CYc_Spzh.js`.

### Mount contract (for the shell lane — out of this write scope)
The page is a zero-prop module: named and default export `RetentionModulePage`, reads
`?state=`, testids `ret4-*`. It needs a real `/system?tab=retention` slot: today
`web/src/shell/routes.ts:247` maps `#/system?tab=retention` onto the audit events tab
(`tabId: 'events'`, `to: '#/system?tab=events'`), so the URL never reaches this page in
the served build. `App.tsx` / `shell/**` are outside this task's write scope.

### Untested / honest limits
- No real 2xx retention payload exists anywhere (BFF and upstream both probed 404), so the
  read path is proven against hand-shaped answers only.
- No 1440/1280/375 pixel measurement: the pane is not mounted (shell change above) and the
  dev SPA on 9122 serves a dist older than this change. Layout is `min-w-0` +
  `break-words` + `flex-wrap` + a `grid` that is 1 column until `xl`, with a test pinning
  the four sections and their fields.
- The two write actions are declared, not wired; there is no clean-up execution surface to
  call, and the page never claims otherwise.

## TASK collab detail + run timeline depth (2026-11-19, base 68ec59a4 = gate ledger @ 4dd7966f)

### Live probes (cookie from /tmp/.cookie_val, value never printed; 127.0.0.1:8092)
| request | HTTP | shape |
|---|---|---|
| `GET /api/run-events?runId=rn_01M7822XN781D2S9JASH5TX1XZ&limit=50` | 200 | 5 events: 4 × `message`, 1 × `completed`; no `tool_intent`/`tool_result`, no `resultRef` |
| `GET /api/run-events?runId=rn_01M7D7421P5PA27TEXMT9YVDZ8&limit=50` | 200 | 0 events (running, upstream has not written any) |
| `GET /api/run-events?runId=rn_01M7DGZA9SDAZKVV9M82G4F38G&limit=80` | 200 | 75 events: 74 × `message`, 1 × `completed`; no tool family |
| `GET /api/run-events?runId=rn_01M7DNVZ091NKD92SCRVFGK5F4&limit=80` | 200 | 54 events: 53 × `message`, 1 × `completed`; no tool family |
| `GET /api/runs?since=2026-11-12T00:00:00.000Z&limit=50` | 200 | 14 rows; richest `lastEventSeq` 75 |

Interpretation: the live event stream only carries `message` and `completed` today, and no payload anywhere has a result reference. The ToolIntent path therefore cannot be exercised with a real answer — it is implemented structurally and proven with fixtures only (disclosed below). This does not change the honesty rule: a tool event without a reference reads 「未记录」, never a fabricated one.

### Code changes (write scope only: `web/src/modules/collab/**`, `web/src/modules/runs/**`, `docs/_artifacts/aud/**`)
1. **collab list — per-row human detail** (`CollabDelegationsModulePage.tsx`): each row's footer now carries a `<details data-testid="col5-row-<i>-more">` fold (closed by default, `<summary>展开明细</summary>`) with a definition list of eight labelled fields: 范围 / 动作 / 状态 / 生效（北京时间） / 到期（北京时间） / 来源 / 提出时间（北京时间） / 委托编号. Values reuse the same helpers as the columns (`scopeCell`, `actionWords`, `statusWords`, `beijingMinute`, `validityCell`, `sourceWords`, `shortCode`), so words stay human and raw tokens stay in `title`. A missing value renders 「—」 with the helper's own reason as the `title` — never `0`, never a guessed date. New testids: `col5-row-<i>-more`, `-detail-scope`, `-detail-action`, `-detail-status`, `-detail-effective`, `-detail-expiry`, `-detail-source`, `-detail-created`, `-detail-code`. Every pre-existing `col5-*` id is untouched; `?view=chain` still owns the URL and issues no extra request.
2. **runs timeline — ToolIntent result reference** (`runs.ts`): `eventLabel` gained `tool_intent` → 「工具意图」; new exported `isToolEvent(raw)` matches `tool_intent` / `tool_call` / `tool_result` case-insensitively; `resultRef(ev)` now reads `payload.resultRef ?? payload.result_ref` off that whole family (previously only `tool_result`), returning a trimmed string or null. `RunsModulePage.tsx` timeline now uses `isToolEvent(ev.eventType)` and tags the reference line with `data-tool-event="<type>"` for external probes.
3. **retry = new run (verified, unchanged)**: `requestRetryRun` POSTs `/agent-api/api/run-retry` with the current id, requires the answer to carry a new id (throws a shape error otherwise), and only then `setParam("run", newId)` — the original run is never rewritten; tests 「retry means a NEW run」 and the page-level 「已新建 运行 · A2B3」 remain green.

### Tests added
- `collab/CollabDelegationsModulePage.test.tsx` +2: the fold exists per row and is closed by default, and opening it exposes the eight fields (scope text, 动作 交接 with raw `handoff` in title, 状态 已接受, `起 2026-11-01 08:00`, `至 2999-01-01 08:00`, short code `34DEF567` with the full id in title); the second row's missing scope/effective/expiry each read 「—」 with a non-empty reason in the title.
- `runs/runs.test.ts` +3: `eventLabel('tool_intent')` = 工具意图 and an unlisted type still falls back to 其他事件; `isToolEvent` accepts the three spellings case-insensitively and rejects `message`/undefined; `resultRef` trims an intent's reference, accepts `result_ref`, and returns null for an empty payload or a plain `message`.
- `runs/RunsModulePage.test.tsx`: the detail fixture gained a `tool_intent` event (seq 6) with `payload.resultRef`; the timeline test now also asserts 「工具意图」, `结果引用：ev-intent-7`, the `data-tool-event='tool_intent'` node, and six event rows.

### Gates (from `web/`)
- `./node_modules/.bin/vitest run src/modules/collab src/modules/runs` → **exit 0, 4 files / 167 tests** (was 162: collab 95 + runs 67).
- `npx tsc -b . --noEmit` → exit 2 with the standing **53** errors (49 `../apps/shared/**`, 2 `src/modules/approvals/api.test.ts`, 2 `src/pages/LoginPage.test.tsx`); grep for `modules/collab|modules/runs` = **0**.
- `./node_modules/.bin/eslint src/modules/collab src/modules/runs` → exit 0.
- `npx vite build --outDir /tmp/dep5-build` → exit 0; entry **`assets/index-CVfj5JBR.js`** sha256 **`f6d2d646e9081523865bf8ee4db268dfb826ac89fb678ec50acd61befc969432`**; entry carries 0 hits of both markers; markers land in lazy chunks `assets/CollabDelegationsModulePage-B2GtEIyx.js` (`col5-row-`) and `assets/RunsModulePage-BO1TQIyQ.js` (`run5-timeline`).

### Untested / honest limits
1. **No live ToolIntent event exists** in this deployment (four runs, 134 events, all `message`/`completed`; zero `resultRef` anywhere), so the intent timeline row is proven by fixtures + unit tests only.
2. The tenant's delegation answer is still `{"items":[]}` — the expanded detail is proven with fixtures; no real row has ever rendered.
3. Neither `/collab` nor `/runs` is mounted by a shell lane in this worktree, and the served dev SPA predates this change, so no 1440/1280/375 pixel measurement was produced; layout rests on `min-w-0` + `break-words` + grid columns and the jsdom assertions.
4. `run-retry` remains unproven against a real 200 (identity gate answers 401 before routing), so the new-id contract is enforced in code and tests, not measured live.


## TASK audit full record handles hidden (2026-11-20, base c32f2635 = gate ledger @ 1f3fe2ad)

### Symptom
The /audit page body printed full record handles, e.g. ap_123DE49B9A1F42A197679681F1 — engineering language on a human surface.

### Measured before the fix (live BFF data, headless Chrome over a local build + /agent-api proxy)
- GET /api/audit?from=2026-11-12&to=2026-11-20&limit=50 -> 200, 30430 B, 50 events, and no requestId key anywhere on the wire.
- Rendered /audit?window=7d at 1440x900: textLen 7981, aud01 ids 459, scrollWidth == clientWidth == 1440.
- Visible text contained 1 ap_123DE49B9A1F42A197679681F1 and 2 ULID-shaped handles (01A1LIVE20261117000000000x), all under the 请求编号 label.
- The 对象 cell was already correct (审批单 · 679681F1), so the leak was not resource masking.

### Root cause (two defects, one visible symptom)
1. requestIdOf fell back to correlationId/traceId, and this tenant's correlation values are business handles (ap_..., ULID). The request-id line is printed in full by design (it is quoted to support), so the handle went to screen.
2. maskedRef early-returned the whole value whenever it was neither isMachineHandle nor a 12+ hex run. isMachineHandle's prefix list lacked ap/ce/ev/rn/tk/dl/empv/cp/ah, and a ULID has no hex run, so those handles also printed in full wherever maskedRef was used (links, tenant).

### Fix (write scope: web/src/modules/audit/** only)
- model.ts: added SCHEME_HANDLE (^[a-z][a-z0-9]{1,11}_[0-9A-Za-z]{4,}$) and OPAQUE_TOKEN (^[0-9A-Za-z]{16,}$) to isMachineHandle; requestIdOf now reads request-number keys only; new correlationOf() carries the correlation value separately; AuditRow/AuditDetail gained correlation; detailFrom adds the technical line 同一次操作原值.
- views.tsx: the list row technical fold gained 同一次操作原值 (collapsed; raw handles live there and in title).
- Net effect: a handle is masked to an 8-character tail wherever it is shown as a label (raw only in title / the collapsed 技术详情), and the request-id line never borrows a business handle — it reads 未提供 when the wire carries no request number.

### Measured after the fix (same harness, same data)
- textLen 6852 (was 7981), aud01 ids 459, scrollWidth == clientWidth == 1440.
- ap_ handles: 0 (was 1). Scheme handles: 0. Alnum runs of 20+ chars: 0 (was 2).
- Masked labels measured at 8 characters, e.g. 审批单 · 679681F1, 员工 · 1FDFC8BB.
- 请求编号 reads 未提供 for all 50 rows, which is the honest state: the wire has no request number.

### Gates (web/)
- ./node_modules/.bin/vitest run src/modules/audit -> exit 0, 8 files / 137 tests (was 136; +1 masking regression case asserting ap_, ULID and empv_ handles mask to 8-character tails with the whole value kept in raw).
- npx tsc -b . --noEmit -> exit 2, 53 errors = the standing floor (49 ../apps/shared/**, 2 src/modules/approvals/api.test.ts, 2 src/pages/LoginPage.test.tsx); modules/audit 0.
- ./node_modules/.bin/eslint src/modules/audit -> exit 0, 0 errors / 5 pre-existing warnings.

### Untested / limits
- The row technical fold was not expanded in the live DOM; its 同一次操作原值 line is asserted at the model level, not on screen.
- 375 and 1280 were not re-shot for this change; the fix only shortens strings, and 1440 measured scrollWidth == clientWidth.
- The 9122 dev server was not rebuilt (per the order: no window close before R28), so the served dist still shows the old text.


## R28 runs row deep links + audit entry contract (2026-11-20, base ad72c31c)

### 1. /runs rows are real links now
- Cause: the row action was a button calling openRun(), so QA measured deepLinks=[] — a button carries no href and cannot be copied or opened in a new tab.
- Fix: the action cell is a react-router Link to /runs?<current filters>&run=<runId>, carrying data-run-id and state {fromList:true}; run5-row-* stays on the li with data-status. The anchor sets no tabindex, because an href anchor is natively focusable.
- Why not the literal hash form #/runs/<runId>: this shell registers only /runs (App.tsx has no /runs/:runId route), so a path-form href would land on the unknown-route fallback and a bare hash change would be a no-op. ?run= is the deep link the page actually honours, including on refresh.
- Measured (headless Chrome 1440x900 over a local build plus an /agent-api proxy to the live BFF): 14 rows, 14 anchors, 14 carrying a run= target, 14 focusable; href sample /runs?window=7d&run=rn_01M7822XN781D2S9JASH5TX1XZ — the active filters ride along. scrollWidth == clientWidth == 1440.

### 2. The retry entry is text, not a control
- The detail retry block is now a p element with data-testid run5-retry-new, data-planned=true, aria-disabled=true and the reason in title; retryAsNewRun, the AttemptAsk union and AttemptLine were deleted, and requestRetryRun stays in runs.ts untouched for the generation that connects the write channel.
- Measured on a real run detail: the element is a P, data-planned true, 0 buttons on the page, so no write can be issued from it.

### 3. resultRef timeline reading
- Code (unchanged this pass, from cb4f7a75): a tool-family event (tool_intent / tool_call / tool_result) prints 结果引用 plus a short code, and 未记录 with the reason when its payload has no resultRef; non-tool events render no such line at all.
- Measured live on the run with the most events (75): the timeline painted 50 message rows and 0 tool events, so 结果引用 count 0 and 未记录 count 0. The line is absent because the data has no tool event, not because it was suppressed. The 未记录 branch itself is locked by vitest (a tool_intent event whose payload is empty).

### 4. Audit entry contract for R5 (page is healthy; only the rail entry is missing)
- Canonical URL: /audit. App.tsx mounts AuditAwareEntry there; ?tab=verify switches to the verify page; R24 fixed the white screen and nothing rewrites the URL, so a rail item can point straight at it.
- Alias: #/system?tab=events renders the same audit events page through the system module live slot and keeps the system tab lit; use it only if the rail entry must stay inside the system group.
- Cause of auditHits=0: web/src/shell/routes.ts marks the audit compat row visible:false, and the App.tsx nav list has no 审计 item.
- Checkpoints after wiring: data-testid agent-v2-page-audit on the page root, aud01-filters, aud01-tech-details, aud01-row-*, and agent-v2-page-audit-verify on ?tab=verify.
- Suggested nav item: path /audit, label 审计事件, icon Shield, group governance.

### Gates
- vitest run src/modules/runs src/modules/audit -> exit 0, 10 files / 207 tests.
- tsc -b . --noEmit -> exit 2 with the standing 53 errors (49 ../apps/shared/**, 2 src/modules/approvals/api.test.ts, 2 src/pages/LoginPage.test.tsx); modules/runs and modules/audit 0.
- eslint on both dirs -> exit 0, 0 errors / 5 pre-existing warnings.

### Untested / limits
- 375 and 1280 were not re-measured; only 1440 was, and the change turns a button into an anchor of the same size.
- The literal #/runs/<id> form named in the order is not delivered because no such route exists; if R5 registers /runs/:runId, hrefOf can switch to the path form in one line.
- The 9122 dev server was not rebuilt (R28 close window), so the served dist still shows the old button.
- 未记录 is proven by mocks only; the live runs carry no tool event.


## R29 runs row real anchors + audit entry proof (2026-11-20, base 43ea29d1)

### 1. Why QA measured "anchors do not exist": the href shape, not the element
- The row action has been an anchor since eaa035cf: RunsModulePage.tsx line 245 renders a Link, and RunsModulePage.test.tsx asserted HTMLAnchorElement. QA's probe counts a[href*="/runs/"], and that href was /runs?window=7d&run=<id> — a query string with no /runs/ segment, so the count was 0 and the element read as missing.
- Second cause, to check on their side: the dev server on 9122 serves forks/hermes-agent/hermes_cli/web_dist, a build older than eaa035cf (the R28 order forbade rebuilding it), so probing there shows the old button.

### 2. Fix: a path-shaped address that still reloads into the record
- RunsModulePage.tsx line 427: hrefOf now returns /runs/?<current filters>&run=<id>. The trailing slash is matched leniently by the /runs route (App.tsx line 1377), so the page renders and the query carries the record.
- Row action, lines 245-256: Link to that href, state {fromList:true}, data-run-id, no tabindex (an href anchor is natively focusable). run5-row-* stays on the li at line 217.
- Why not /runs/<id>: App.tsx registers only path="/runs"; any other path falls to path="*" and UnknownRouteFallback sends it to /overview (App.tsx lines 260-268).
- Why not #/runs/<id>: measured, not assumed — /runs?window=7d#/runs/<id> lands on /overview, because the shell owns the hash. That variant was dropped.

### 3. Measured readings (headless Chrome 1440x900 over a fresh local build plus an /agent-api proxy to the live BFF)
- /runs?window=7d -> 13 rows, a[href*="/runs/"] = 13, href sample /runs/?window=7d&run=rn_01M7D7421P5PA27TEXMT9YVDZ8, all 13 focusable, scrollWidth == clientWidth == 1440.
- Pasting that address back (/runs/?window=7d&run=rn_01M7DGZA9SDAZKVV9M82G4F38G) -> 13 rows plus the detail panel open (its retry sentence present), body text 1393 -> 2945 characters.
- /runs?window=7d#/runs/<id> -> redirected to /overview (the rejected variant).
- /audit direct -> agent-v2-page-audit = 1, aud01-* = 459, scrollWidth == clientWidth == 1440, first line 已显示 50 条审计事件（最近 7 天）.

### 4. Audit entry contract for R5
- Canonical URL /audit: App.tsx line 1276 mounts AuditAwareEntry, which switches to the verify page on ?tab=verify (App.tsx line 1614). Alias #/system?tab=events renders the same audit events page through the system live slot and keeps the system tab lit.
- auditHits=0 cause: shell/routes.ts line 257 marks the audit compat row visible:false, and the App.tsx nav list has no 审计 item.
- Checkpoints: agent-v2-page-audit (measured 1), aud01-filters, aud01-tech-details, aud01-row-*, and agent-v2-page-audit-verify on ?tab=verify.
- Suggested nav item: path /audit, label 审计事件, icon Shield, group governance.

### Gates
- vitest run src/modules/runs src/modules/audit -> exit 0, 10 files / 208 tests (runs 71 with the new paste-back case).
- tsc -b . --noEmit -> exit 2 with the standing 53 errors; modules/runs and modules/audit 0.
- eslint on both dirs -> exit 0, 0 errors / 5 pre-existing warnings.

### Untested / limits
- 375 and 1280 were not re-measured; only 1440 was.
- The 9122 dev server still serves the pre-R28 dist, so QA has to rebuild or use a fresh build before re-probing anchors.
- A true path-form /runs/<id> still needs a shell route from R5; the trailing-slash query form is what works today.

## R30 fixture debt burn — 3 pages (2026-11-20, base 8b408717)

### ① inventory: `grep -rl data-fixture web/src/modules/{runs,audit,collab,evidence} --include=*.tsx`

| file | page behind it |
|---|---|
| `runs/{RunsModulePage.tsx, states.tsx}` (+ tests) | 运行列表 `run5-*` |
| `audit/{AuditEventsModulePage.tsx, AuditVerifyModulePage.tsx, RetentionModulePage.tsx, states.tsx}` (+ tests) | 审计事件 `aud01-*`/`aud02-*`、完整性校验 `aud03-*`、数据保留 `ret4-*` |
| `collab/{CollabDelegationsModulePage.tsx, states.tsx}` (+ test) | 协作委托 `col5-*` |
| `evidence/{EvidenceModulePage.tsx}` (+ test) | 证据与引用 `ev5-*` |

Every `data-fixture` in these modules was the `?state=` repro marker (`fixtureAttr()` in `audit/fixture.ts`, local copies in the runs/collab `states.tsx`), painted only on a forced leg. The only real **sample rows** were `REPRO_ROWS` in `evidence/evidence.ts`. A badge that could be removed while keeping the sample rows would create an unlabelled fixture, so the honest way to burn the debt is to delete the `?state=` leg itself.

### ② the three pages turned real

| page | real source | result |
|---|---|---|
| 运行列表 `/runs` | `/agent-api/api/runs` (200, 13–14 rows) | real rows, anchors, cost tri-state |
| 审计事件 `/audit` (list + inline detail pane) | `/agent-api/api/audit?from=&to=&limit=50` (200, 50 events) | real rows + real detail |
| 证据与引用 `/knowledge?tab=evidence` | same audit route, one row per event | real 50 rows, real `/audit?id=` links |

Not burned this pass (kept their labelled repro legs): 协作委托 `col5-*`, 完整性校验 `aud03-*`, 数据保留 `ret4-*` (its route answers 404 `console.unknown_route`, so it is already an honest 「未接入」/GAP-13 surface), and the standalone audit-detail page `aud02-*` (`/audit/detail?id=` stays as it was; the events page's inline detail pane no longer accepts `?state=`).

### ③ before → after

| file | fixture lines before | after |
|---|---|---|
| `runs/RunsModulePage.tsx` | 6 | 1 (header comment only) |
| `runs/states.tsx` | 12 | 1 (header comment only) |
| `audit/AuditEventsModulePage.tsx` | 8 | 2 (header comments only) |
| `evidence/EvidenceModulePage.tsx` | 4 | 1 (header comment only) |
| `evidence/evidence.ts` | 2 (`REPRO_ROWS` + doc) | 0 |

Code removed: `ForcedState/FORCED/forcedStateOf/forcedResult` from `runs/useRunsData.ts` (signature now `useRunsData(filters)`), the forced arg of `useRunDetail`, `ReproNote` + `Marked/fixtureAttr` + every `fixture` prop in `runs/states.tsx`, the `forced` reads and `aud01-forced-note` block in `AuditEventsModulePage.tsx`, and in `EvidenceModulePage.tsx` the `FORCED` set, `forced/forcedRid` reads, `data-fixture` root attr, `ev5-fixture-note` banner and the `state`/`rid` URL cleanup on retry; `REPRO_ROWS` deleted from `evidence/evidence.ts`.

Tests updated to the new contract: runs lost the `?state=` describe and the repro-ignores-`?run=` case (replaced by 「?state= repro leg is gone」 asserts and a denied-body test that no longer claims GAP-09 — the route really answers, so a denial is a permission answer, not a data-source gap); audit lost the two forced-leg cases (replaced by one test proving a stray `?state=` paints the real answer with no `data-fixture`); evidence lost the `?state=ready|denied` describe.

### ④ live DOM readings (fresh build + `/agent-api` proxy to 127.0.0.1:8092 with the session cookie, headless Chrome 1440×900)

| url | rows | key counts | `[data-fixture]` | sw/cw |
|---|---|---|---|---|
| `/runs?window=7d` | 13 | 13 `a[href*="/runs/"]`, 13 focusable, href `/runs/?window=7d&run=rn_01M7D7421P5PA27TEXMT9YVDZ8` | **0** | 1440/1440 |
| `/runs/?window=7d&run=rn_01M7DGZA9SDAZKVV9M82G4F38G` | 13 + detail | `run5-detail` 1, retry = copy text 「重试 · 新建一次运行（写入口未接通，本页只渲文案）」, textLen 1393→2945 | **0** | 1440/1440 |
| `/audit` | 50 (`aud01-row-*`) | `agent-v2-page-audit` 1, `aud01-*` 459, 请求编号 all 未提供 | **0** | 1440/1440 |
| `/knowledge?tab=evidence` (tab clicked) | 50 (`ev5-row-*`) | 50 `ev5-open-*`, `ev5-unverified` 0, `ev5-unreachable` 0, summary 「共 50 条记录（最近 7 天）待核实 0原文不可达 0读取于 —」 | **0** | 1440/1440 |

The evidence pane gates on `window.__HERMES_SESSION_TOKEN__`; with a token injected before load the probe reads the real 50 rows above (without it the pane honestly shows 「需要登录」 and sends nothing).

### gates

- `vitest run src/modules/{runs,audit,evidence}` → exit 0, **11 files / 210 tests** (runs 65 — six `?state=` cases removed; audit 136 — two forced cases replaced by one; evidence 9).
- `npx tsc -b . --noEmit` → exit 2 with the standing **53** (49 `../apps/shared/**`, 2 `src/modules/approvals/api.test.ts`, 2 `src/pages/LoginPage.test.tsx`); `modules/(runs|audit|evidence)` **0**.
- `eslint src/modules/{runs,audit,evidence}` → exit 0, 0 errors, 7 warnings (the standing `react-hooks/set-state-in-effect` class).

### untested / limits

- 375 and 1280 were not re-measured; only 1440.
- The 9122 dev server was not rebuilt (order), so QA must use a fresh build to see this.
- `?state=` repro is gone only for the three pages above — collab, `aud03`, `ret4` and the standalone `/audit/detail` page still carry labelled repro legs.
- The evidence pane's live read depends on a session token in `window`; a browser without one sees 「需要登录」 by design.

## R29 tail — runs timeline resultRef + retry honesty (2026-11-20, base 1fff2e58)

### 1) Timeline ToolIntent resultRef (write scope: modules/runs)
- Implementation already in place from the earlier depth pass: `runs.ts` `TOOL_EVENTS`/`isToolEvent`/`resultRef` read `payload.resultRef|result_ref` for the tool family only; `RunsModulePage.tsx` renders `结果引用：<shortId>` with the raw handle in `title`.
- This pass adds the machine-readable points QA needs: `data-testid="run5-result-ref-<seq>"` and `data-result-ref="present|absent"`; the absence line reads 「未记录」 and its `title` says 「这次工具事件没有带回结果引用：服务的回答里没有 resultRef，本页不替它编一个」.
- Live truth: probed `/api/run-events` for four runs (`rn_01M7822XN781D2S9JASH5TX1XZ` 5 events, `rn_01M7DGZA9SDAZKVV9M82G4F38G` 75, `rn_01M7DNVZ091NKD92SCRVFGK5F4` 54, a running run 0) — every event is `message` or `completed`, **zero tool events**, so on live data the cell count is 0. Nothing is invented to fill it. The 「未记录」 branch is pinned by the timeline test (seq 4 carries no resultRef → `data-result-ref=absent`).

### 2) 「重试 = 新 Run」
- Measured on the served console (cookie, 127.0.0.1:8092):
  - `POST /api/run-retry` → **HTTP 405** `{"code":"console.read_only","message":"first console is read-only; only GET/HEAD allowed"}`
  - `GET  /api/run-retry` → **HTTP 404** `{"code":"console.unknown_route"}`
- So the write channel is closed at the console, not merely unimplemented in the page. The entry now renders a **disabled** control: `<button data-testid="run5-retry-new" data-planned="true" aria-disabled="true" data-endpoint-http="405">` written 「重试 · 新建一次运行（当前环境只读，写入口未开放）」, with the measurement in `title`; there is no click handler, no POST, the old id is never reused and nothing claims success. `requestRetryRun()` stays in `runs.ts`, its doc updated with the measurement, for the generation that opens the channel.
- Live at 1440/1280/375: `retryTag=BUTTON`, `retryDisabled=true`, `title` carries 405.

### 3) Row anchors
- `RunsModulePage.tsx:245-256` renders one react-router `<Link>` per row (`run5-row-<n>-open`, `data-run-id`); the href comes from `hrefOf` (`:421-425`) as `/runs/?<current filters>&run=<id>`.
- Live readings, three widths: **13 rows, `a[href*="/runs/"]` = 13, focusable = 13**, sample `/runs/?window=7d&run=rn_01M7D7421P5PA27TEXMT9YVDZ8`; pasting it back opens the record (detail 1, textLen 1397 → 3024).
- The two literal forms QA asked for are measured unusable on this shell: `/runs/<id>` → `/overview` (no `/runs/:runId` route registered), `/runs?window=7d#/runs/<id>` → `/overview?window=7d` (the shell owns the hash). The query form keeps the `/runs/` path segment so `a[href*="/runs/"]` counts it, and it reloads into the same record.
- Cross-lane finding (not this write scope): `/overview` renders three anchors in the broken path form `/runs/rn_…`; they land on `/overview`. Handled by the overview lane, recorded here because QA's anchor sweep may pick them up.

### 4) States, 403≡404, widths
- Four states with copyable request id (`RequestIdLine` → 「复制 / 已复制 / 复制失败，请手动选择」); 403 and 404 draw one `run5-denied` body (tests assert byte-identical `outerHTML` for both the list and the detail pane).
- Width sweep 1440×900 / 1280×800 / 375×812: `scrollWidth == clientWidth` (1440/1440, 1280/1280, 375/375), 13 rows and 13 anchors at each width; screenshots `/tmp/r29w-shots/runs-{1440,1280,375}.png` (build+proxy harness, not committed).

### Gates (from `web/`)
- `./node_modules/.bin/vitest run src/modules/runs` → exit 0, 2 files / **65 tests**.
- `npx tsc -b . --noEmit` → exit 2, **53** errors, all the standing floor (49 `../apps/shared/**`, 2 `src/modules/approvals/api.test.ts`, 2 `src/pages/LoginPage.test.tsx`); `modules/runs` **0**.
- `./node_modules/.bin/eslint src/modules/runs` → exit 0.

### Untested
- No live tool-intent event exists in this tenant, so the `resultRef` present/absent rendering is proven by tests, not by a live row.
- No writable console exists here, so a successful retry (new id returned, page navigating to it) cannot be demonstrated; only the disabled contract with the measured 405/404 is proven.
- The dev SPA on 9122 was not rebuilt in this window (per order), so QA must probe a fresh build.

## R31 audit wording + handle masking (2026-11-20, base 3bff4208)

写域 `web/src/modules/audit/**` + `docs/_artifacts/aud/**`；单 commit `fix(console): audit wording and handle masking`。

### ① 词族：事件类型 / 对象一律人话
- `model.ts` 新增 7 个本代次真实出现过的事件类型中文词条（逐字转译，不解释语义）：
  `employee.lifecycle.transitioned → 变更员工生命周期`、`employee.lifecycle.denied → 驳回员工生命周期变更`、
  `workstation.bound → 绑定工位`、`workstation.bind_conflict → 工位绑定冲突`、
  `budget.ledger_entry_applied → 记录一笔预算流水`、`budget.ledger_ensured → 核对预算账本`、
  `budget.soft_alert_sent → 发出预算提醒`。
- 未登记的类型不再回裸码：`actionView` 未知分支 → `其他事件`（新增导出 `OTHER_ACTION_LABEL`），原码只进 `title`
  （行首按钮 title = `事件类型原值 · 事件标识原值`，详情头 h2 同）。
- `resourceNoun` 未知类型回退由 `type.trim()`（英文 token 上屏）改为 `对象`。

### ② 句柄：屏上 8 位短码，原值进 title/复制
- `states.tsx` `CopyValue.shown`：纯 32hex → 前 8 位；scheme 句柄（`/^[a-z][a-z0-9]{1,11}_[0-9A-Za-z]{9,}$/i`）→ `前缀_…末8`；
  其余原样。`title` 与复制始终是全值（提供给支持同学引用的编号）。
- 实测短码样例：`任务 · 1FDFC8BB`、`任务 · EB643088`、`任务 · 3D0F3E81`（22 条标签全部 8 位）。
- 32hex 命中数 **改前 0 → 改后 0**；16+ hex 连续串 **0 → 0**（本页从未把摘要哈希铺上人话层，`maskedDigest` 只给前 10 + …）。

### ③ 本轮新发现的真实的机器词：`原因：not_applicable`（22 行）
- 根因：`reasonOf` 在非失败行把 `decision` 枚举当「原因」兜底（`return plain ?? decision`），本租户 22 条 `task.created` 的
  `decision` 都是 `not_applicable`，于是每行都被写上一句「原因：not_applicable」。
- 修复：`reasonOf` 只认 `error.messageRedacted` 或 `REASON_KEYS` 里的人话，**不再借用 decision**（`DECISION_KEYS` 一并删除，
  判定枚举不再伪装成原因）；`humanSentence` 追加一条闸门：整串就是 `word_word` / `word.word` 形态的机器词 → 视为非句子、返回 null。
- 实测：「原因：not_applicable」 **22 → 0**；页面文本长度 6855 → 6148 字符。

### ④ 时间与详情深链
- 时间列/详情时间行均为 `Asia/Shanghai` 到分（实测 `2026-11-18 00:58`），原始时刻只在技术折叠里。
- 深链改用 `?detail=<eventId>`（`AuditEventsModulePage.tsx:186-200` 写、`:156` 读），并保留 `?id=` 作为旧链接兼容；
  技术字段仍在「技术详情」折叠内（默认关闭）。
- 实测 `/audit?detail=ev_2BAA7DD7F3BC4767AF39764D91`：**改前详情面板 0（链接无效）→ 改后 1**（`aud02-detail` 出现，
  文本 6386 字符，列表 6148，差 238 = 详情内容），刷新同一地址仍打开同一条事件。

### ⑤ 校验与四态
- `完整性校验` 仍打真路由 `GET /agent-api/api/audit-verify?from=&to=`（`api.ts` `VERIFY_PATH`，未改）；未启用腿仍是
  「本环境未启用」+原因+去处（`aud03-unavailable`）。实测按钮在位（`aud01-verify` = 1）。
- 四态齐（loading/ready/empty/error），错误态人话 + 可复制请求编号（缺失「未提供」，实测 50 行请求编号全为「未提供」）；
  403 与 404 共用同一 `DeniedPanel` 正文（既有用例逐字断言 `outerHTML` 相同）。

### 实测读数（本地新构建 + `/agent-api` 真 BFF 代理，headless Chrome）
| 读数 | 改前 3bff4208 | 改后 |
|---|---|---|
| `/audit?window=7d` 文本长度 | 6855 | **6148** |
| 屏上裸事件类型码（`dispatch.event` 等） | **19**（8 种） | **0** |
| 「其他事件」 | 0 | **9** |
| 「原因：not_applicable」 | **22** | **0** |
| 32hex / 16+hex 连续串 | 0 / 0 | 0 / 0 |
| 8 位短码标签 | 22 | 22 |
| 行数 / `aud01-*` 元素数 | 50 / 459 | 50 / 459 |
| `/audit?detail=<id>` 详情面板 | **0** | **1** |
| 1440 / 1280 / 375 | 1440 ✓ | sw==cw（1440/1440、1280/1280、375/375） |

改前页面上仍有 22 条「原因：」行是服务手写的**英文**句子（`denied by domain validation; raw message not stored in audit` 22 条、
`dispatch failure detail redacted; raw message never stored (see runtime logs)` 4 条）
——按「上游原文透传、页面不代译」的口径保留，未翻译、未改写，列入未测/已知项。

### Gates（从 `web/`）
- `./node_modules/.bin/vitest run src/modules/audit` → exit 0，8 files / **142 tests**（改前 137，+5：未知类型→其他事件、7 词条、对象回退、深链两条、decision-as-cause 回归）。
- `npx tsc -b . --noEmit` → exit 2，**65** 条；`grep -c "modules/audit"` = **0**。地板由 53 涨到 65，增量全在**他人写域**
  （`src/modules/approvals/ApprovalsPendingModulePage.tsx` 6、`ApprovalsHistoryModulePage.tsx` 6、`src/modules/approvals/api.test.ts` 2、
  `src/pages/LoginPage.test.tsx` 2），本车道未触碰。
- `./node_modules/.bin/eslint src/modules/audit` → exit 0，0 errors / 5 warnings（既有 `react-hooks/set-state-in-effect`）。
- lefthook `lint web` 真跑，未绕过。

### 未测 / 已知项
- 26 条服务手写英文原因句按原文透传，未翻译（代译会改写服务的事实陈述）。
- 1280/375 只算了 `scrollWidth == clientWidth`，未做像素级并排截图比对。
- 真 403/404 腿本会话未出现（仅有 mock 级逐字同体断言）；`完整性校验` 的 S3 断链腿未造真实数据。

## R32 fixture debt burn — channels/collab/retention (2026-11-20, base 9c7789f6)

### 1. Inventory (grep -rl data-fixture, *.tsx, five modules)

| 文件 | 页 | 改前命中 | 改后 |
|---|---|---|---|
| `channels/ChannelsPage.tsx` | 平台接入与数据源 | 1（根 `data-fixture`） | 0 |
| `channels/states.tsx` | 同上（面板） | 3（注释 + `fixtureAttr` + `ReproNote`） | 1（仅头注释说明已移除） |
| `channels/ChannelsPage.test.tsx` | 同上（测试） | 4 | 1（仅一条「屏上不得出现 data-fixture」的反断言） |
| `collab/CollabDelegationsModulePage.tsx` | 协作委托 | 2（根属性 + `ReproNote`） | 0 |
| `collab/states.tsx` | 同上（面板） | 3 | 1（仅头注释） |
| `collab/CollabDelegationsModulePage.test.tsx` | 同上（测试） | 3 | 0 |
| `audit/RetentionModulePage.tsx` | 数据保留 | 0（但自带 `?state=` 腿会画假 ready 区块） | 0（腿已删） |
| `audit/RetentionModulePage.test.tsx` | 同上（测试） | 0 | 0（两条 `?state=` 用例已删） |
| `runs/states.tsx` | 运行列表 | 1（R30 后仅注释） | 1（注释） |
| `audit/*`、`evidence/*` 其余 | 审计/证据 | 0（R30 已烧） | 0 |

### 2. 选中的三页与理由
1. **channels 平台接入与数据源** — 真源可用：`GET /agent-api/api/hermes-summary` → 200，`gateway.platforms` = `api_server` + `feishu`。转真数据。
2. **collab 协作委托** — 真源可用：`GET /agent-api/api/delegations` → 200 `{"items":[],"asOf":…}`，本租户真实 0 条。转真数据（诚实空态 + 服务自己的 asOf）。
3. **audit 数据保留** — 8 条候选路由全部 404 `console.unknown_route`，BFF 路由矩阵无此行。诚实「未接入」+原因；同时删掉会画假 `ready` 区块的复现腿。

未选（保留，如实披露）：`audit/AuditDetailModulePage.tsx`、`audit/AuditVerifyModulePage.tsx` 仍接受 `forced`/`fixture` 参数走 `?state=` 腿；`audit/states.tsx` 的 `Marked.fixture` 仍声明但已不渲染 `data-fixture` 角标（R30 遗留），因此这两页属于「无角标的复现腿」，与 R30 的判据仍有距离，留给下一轮。

### 3. 代码改动
- `channels/useChannelsData.ts`：删 `ForcedState`/`FORCED`/`forcedStateOf`/`forcedResult`/`FORCED_SENTENCE`；签名 `useChannelsData(filter)`；结果不再带 `forced`。
- `channels/states.tsx`：删 `Marked`/`fixtureAttr`/`ReproNote` 及各面板 `fixture` 参数与 spread 属性。
- `channels/ChannelsPage.tsx`：删 `forced`/`isForced`/`forcedTitle`、根 `data-fixture`、`<ReproNote>`、控件上的 forced 禁用与 title 覆盖（保留真实 title）；四个面板不再传 `fixture`。
- `collab/useDelegations.ts`：删 `ForcedState`/`FORCED`/`forcedStateOf`/`forcedResult`；`useDelegations()` 零参数。
- `collab/states.tsx`：删 `Marked`/`fixtureAttr`/`ReproNote` 与面板 `fixture` props；去掉重试按钮的 `disabled={Boolean(fixture)}` 与「复现腿不发起请求」标题；**同时删掉两句已经不成立的 GAP-10 断言**（委托写入通道其实未验证，但「清单读取未接通」是假的——路由 200）：空态改为「要发起一份委托，请到任务详情里指派受托员工（本页只读，不提供发起入口）。」，拒绝态改为「这份委托清单的读取路由已经接通；这一屏只说明当前账号读不到它。」
- `collab/CollabDelegationsModulePage.tsx`：删 `forced`/`isForced`/`reloadTitle`/`data-fixture`/`<ReproNote>`；刷新禁用只看 loading。
- `audit/RetentionModulePage.tsx`：删本地 `FORCED`/`forcedStateOf`/`forcedRead`、`useSearchParams` 与 forced 分支；重试改为纯计数 bump；`ret4-*` testid 与「未接入 + GAP-13 只进 title」全部保留。
- 测试：三个 `?state=` 复现 describe 整块删除（channels 1 块、collab 1 块、retention 1 块）；保留全部真实面用例（短码、BJT、四态、403≡404 逐字相同、请求编号、深链）。

### 4. 活体读数（本地新构建 entry `assets/index-CTLBokn9.js`，`/tmp/serve-audh.cjs` 4210 静态服务 + `/agent-api/*` 代理到 8092 带 cookie）
| 页 | url | 读数 |
|---|---|---|
| 平台接入 | `/channels`（改写为 `/capabilities?tab=channels`） | textLen 1175；**2 行真平台**：API 服务（接口服务 · 已连接）、飞书（消息平台 · 已连接）；凭据「未知，服务的回答里没有给出这份凭据的状态，本页不替它猜，也不显示任何令牌内容」；最近事件（北京时间）`2026-11-20 00:47`；`[data-fixture]` **0**；1440/1280/375 三档 sw==cw |
| 协作委托 | `/collab` | textLen 467；诚实空态「读取成功，这个租户目前没有委托记录」+ 下一步；`[data-fixture]` **0**；三档 sw==cw |
| 数据保留 | `/system?tab=retention` | textLen 828；「4 个区块都未接入：这个环境没有可读的保留策略源。」+ 每区块「未接入」+「不拿 0 天或 0 字节去顶替」；`[data-fixture]` **0**；三档 sw==cw |

### 5. 门禁（`web/` 下）
- `./node_modules/.bin/vitest run src/modules/channels src/modules/collab src/modules/audit` → **exit 0，12 files / 328 tests**。
- `npx tsc -b . --noEmit` → exit 2，**67** 条 error TS，本域三模块 **0**；地板由 65 涨到 67，增量全在他人写域：`src/modules/approvals/{ApprovalsPendingModulePage,ApprovalsHistoryModulePage}.tsx` 6+6、`src/modules/approvals/api.test.ts` 2、`src/pages/LoginPage.test.tsx` 2、`src/modules/tasks/TasksBoardModulePage.test.tsx` 1、`src/modules/security/SecurityModulePage.tsx` 1，另 49 条在 `../apps/shared/**`。
- `./node_modules/.bin/eslint src/modules/channels src/modules/collab src/modules/audit` → exit 0，0 errors / 4 warnings（均为既有 `react-hooks/set-state-in-effect`：`RetentionModulePage.tsx:248`、`useAuditData.ts:145/221/318`）。
- lefthook `lint web` 真跑。

### 6. 未测
- 375/1280 只取 sw==cw 与文本长度，未做逐元素像素比对；截图落在 /tmp，未入库。
- 本租户 `delegations` 真 0 条，行级布局（七列、委托链）仍由 mock 用例证明。
- retention 页面在真实环境永远走「未接入」分支，`ready` 分支只剩 mock 覆盖。
- `audit/AuditDetailModulePage`、`AuditVerifyModulePage` 的无角标复现腿未处理（写明在本节第 2 部分）。

## R33 evidence citation drill-back (2026-11-20, base 33fc7029)

### Live probes (session cookie via 127.0.0.1:8092, value never printed)
| request | code | reading |
|---|---|---|
| GET /api/audit?from=<7d>&to=<now>&limit=50 | 200 | 50 events, **50/50 carry eventId** (可达率 100%) |
| sourceSystem distribution | — | employee 25, console 14, runtime 8, policy 2, approval 1 → all are audit records |
| resource.type set | — | approval, channel_event, creation_attempt, employee, task, workstation |
| GET /audit?detail=ev_2BAA7DD7F3BC4767AF39764D91 (built dist, 4210 proxy) | 200 | detailPane 1, rows 50, aud01 459, textLen 6386, hex32 0, masked labels 8 chars, sw==cw |

### Changes (write scope: web/src/modules/evidence/**)
1. Drill-back href is now the canonical audit deep link `/audit?detail=<eventId>` (R31 moved it from `?id=`; `?id=` still accepted for old links, this pane writes the new spelling only).
2. 引用来源 vocabulary 知识库 / 运行 / 审计 via new `sourceKindOf()`: honours an explicit citationKind/sourceKind/kind on the row, else derives from the resource type (knowledge* → 知识库, run → 运行), else 审计. Every live row honestly reads 审计 because the audit route is the only surface that answers; the other two words activate as soon as a row declares them.
3. Side read `GET /agent-api/api/employees?limit=100` (new `employeeNames()`); a failure degrades to 「员工 · 短码」 and never blocks the citations. With a directory name the actor and a person-shaped target both read 「姓名 · 8 位短码」.
4. A person-shaped target without an id reads 「未指派」 (was 待核实); non-person targets keep type · code and 待核实 when unreadable.
5. Summary gained 「可回原文 N」 next to 原文不可达; unreachable reasons and the 待核实 pill (GAP only in title) unchanged.
6. testid family preserved: ev5-page/list/row-*/source-*/actor-*/target-*/at-*/open-*/unreachable-*/unverified-*/summary and the four states (loading/empty/error/denied) + login.

### Gates (from web/)
- vitest run src/modules/evidence → exit 0, **1 file / 11 tests** (9 before; +2: directory-name resolution, missing person id → 未指派).
- npx tsc -b . --noEmit → exit 2, **67** error TS, all pre-existing (49 ../apps/shared/**, approvals 12+2, security 1, tasks test 1, LoginPage.test 2); `modules/evidence` **0**.
- eslint src/modules/evidence → exit 0, 0 errors / 2 pre-existing warnings (react-refresh on the exported helper, set-state-in-effect on the session gate).
- lefthook lint web really ran.

### Untested / disclosed
- The pane is **not reachable at runtime on this generation**: `/knowledge?tab=evidence` is rewritten by the shell to `/knowledge?tab=spaces&panel=evidence` and the evidence live tab never mounts (measured ev5Page 0, textLen 534, same with `/audit?tab=evidence` → textLen 6148 no ev5 ids). shell/routes.ts:161 still declares the tab (`tab: 'evidence'`); the rewrite is the shell lane's, out of this write scope. Row-level pixels therefore come from module tests, while the drill-back target they point at was measured live.
- The tenant's 50 audit events are all 审计 records, so 知识库/运行 rows have no live sample; those branches are pinned by code paths only.
- No per-element pixel comparison; 1440/1280/375 overflow checked by sw==cw on the drill-back page only.

## R34 audit window filter + CSV export (2026-11-20, base 9fedd46f / lane tip 50119b5e)

### The four windows are real, measured against the running BFF
`GET /api/audit?from=<iso>&to=<iso>&limit=50` with the session cookie (via 127.0.0.1:8092; value never printed):

| window | http | events | body head |
|---|---|---|---|
| 最近 24 小时 | 200 | **0** | `{"events":[]}` |
| 最近 7 天 | 200 | **50** | `{"events":[{…}]}` |
| 最近 30 天 | 200 | **50** | same page — this tenant has nothing older in that read |
| 自定义 (now−3d → now−1d) | 200 | **47** | `{"events":[{…}]}` |
| inverted range | **400** | — | `{"code":"request.invalid_query","message":"'from' must not be later than 'to'"}` |

So `from`/`to` are honoured, 24h really is empty on this deployment, and the service itself rejects an inverted range — hence the client-side guard below.

### Live page readings (fresh build entry `assets/index-BjkYlsD7.js`; `/tmp/serve-audh.cjs` on 127.0.0.1:4210 proxying `/agent-api/*` → 8092)
| window | url | rows | `aud01-*` | 32hex | masked codes | sw/cw (1440) |
|---|---|---|---|---|---|---|
| 24h | `/audit?window=24h` | 0 | 9 | 0 | 0 | 1440/1440 |
| 7d | `/audit?window=7d` | 50 | 460 | 0 | 22 | 1440/1440 |
| 30d | `/audit?window=30d` | 50 | 460 | 0 | 22 | 1440/1440 |
| custom | `/audit?window=custom&from=…&to=…` | 47 | 435 | 0 | 19 | 1440/1440 |

Every window kept `agent-v2-page-audit` 1, `aud01-verify` 1, `hex16` 0, `scheme` 0, raw action only in `title`, and no ISO string on screen.

Export entry, measured at three widths (`/tmp/cdp-r34.cjs`):
- `/audit?window=7d` → `exportDisabled false`, `aria-disabled "false"`, title 「导出当前筛选结果为 CSV（北京时间）」, 50 rows, sw==cw at 1440/1280/375.
- `/audit?window=24h` (no records) → `exportDisabled true`, `aria-disabled "true"`, title 「当前筛选没有可导出的记录」, sw==cw at 1440/1280/375.

### What changed
- `window.ts`: `FilterWindowKey` (`24h|7d|30d|custom`), `FILTER_WINDOW_CHOICES`, `CUSTOM_WINDOW_LABEL`, `beijingInputValue()`, `parseBeijingInput()`, `customBounds()`, `filterWindowOf()`; private `instantOf()` accepts an ISO instant **or** a Beijing wall-clock value.
- `export.ts` (new): `CSV_HEADER` = 时间 / 类型 / 结果 / 操作者 / 对象 / 请求编号; `csvText()` writes a BOM, CRLF rows, BJT minutes, and an empty cell for a missing value (never `0`); `exportName()` = `audit-<窗口>-YYYYMMDD-HHmm.csv` in Beijing time; `downloadCsv()` uses `window.Blob` + `URL.createObjectURL` + a temporary `<a download>` and revokes the URL.
- `useAuditData.ts`: `useAuditList(forced, asked, enabled = true)`; when `enabled` is false the effect bumps the sequence and returns **without asking**.
- `AuditEventsModulePage.tsx`: the window now lives in the address (`?window=` plus `?from=`/`?to=` for custom, written with `replace` so refresh keeps it); custom renders two `datetime-local` inputs (`aud01-custom-from`/`aud01-custom-to`) with `aud01-custom-error`; an incomplete custom window paints `aud01-custom-hint`, asks nothing (no fallback to an unfiltered scan), and disables both 完整性校验 and 导出; `aud01-export` added to the top row and the list branches gated on `!customInvalid`; all `aud01-*` / `agent-v2-page-audit` ids preserved.
- Defect found by the new tests: `customBounds` was re-suffixing an ISO instant with `+08:00`, so `Date.parse` returned NaN and **every** custom window looked incomplete (no request at all). Fixed with `instantOf()`.

### Gates
- `vitest run src/modules/audit` → exit 0, **10 files / 153 tests** (base 8 / 142; new `window.test.ts`, `export.test.ts`, 4 page cases).
- `npx tsc -b . --noEmit` → exit 2, **72** errors, `modules/audit` **0** (floor is foreign: 49 `apps/shared`, approvals 14, duty 5, LoginPage.test 2, tasks test 1, security 1).
- `eslint src/modules/audit` → exit 0, 0 errors / 4 pre-existing warnings.

### Not done / not provable here
- No real browser click-through of the download (jsdom asserts the Blob body, the header, the row count and the filename; a browser save dialog is outside this harness).
- No per-element pixel diff — only `sw==cw` plus text length at three widths.
- 9122 was not rebuilt and main was not merged, per the order.


## R35 audit verify result surface (2026-11-20, base 7e7b92cd = gate ledger @ bc7671a1)

### Endpoint truth (live, cookie via 127.0.0.1:8092)
| request | HTTP | body |
|---|---|---|
| `GET /api/audit-verify` (no query) | **400** | `{"code":"request.invalid_query","message":"query `from` is required"}` |
| `GET /api/audit-verify?from=<24h>&to=<now>` | **200** | `{"ok":true,"complete":true,"scanned":0,"anchorCheckpointId":"cp_t_seakoi_pilot_2026111300","chainHeadHash":"ah_031a89f9…"}` |
| `GET /api/audit-verify?from=<7d>&to=<now>` | **200** | same shape with `"scanned":43` |

The answer carries **no** `brokenCount`, **no** `total`, **no** `asOf`, and **no per-event ids**. So the surface must not build a break list and must not print a read instant — it says so instead.

### Code
- `views.tsx` `VerifyResultBody` gained an optional `ids?: { counts, window, scanned, broken }` (default `aud03-*`, exported `VerifyCountIds`), so the standalone pane hands in `aud01-verify-*` while the inline panel on `/audit` keeps the shared defaults and its tests stay green.
- `views.tsx` headline/tone now require `countsKnown` for a green or red claim: an `ok:true` answer with no counts reads 「结论没有带上核对范围」 (secondary), never 「没有发现断点」.
- `AuditVerifyModulePage.tsx`: every id renamed to the `aud01-verify-*` family (`-status`, `-window-<key>`, `-run`, `-window-label`, `-loading`, `-idle`, `-error`, `-unavailable`, and the result `-result`/`-counts`/`-window`/`-scanned`/`-broken`/`-result-details`); root `agent-v2-page-audit-verify` and `data-page="audit-verify"` kept.
- The `?state=` repro leg is gone (three `fixture=` props and the forced note removed); `useAuditVerify(null)` now. The pane adds `aud01-verify-detail` with `aud01-verify-asof` (「—」 + title 服务的回答里没有带回读取时刻，本页不拿浏览器时间顶替) and `aud01-verify-break-list` (counted zero → 「未发现断点…」; a count → states the count and that per-record detail was not included; unknown → 「服务没有给出对不上的条数，本页不推断断点明细。」).

### Tests
- `AuditVerifyModulePage.test.tsx`: 9 stale `aud03-` ids renamed; the old forced-state case replaced by 「a stray ?state= no longer fakes a state: nothing is asked and the pane stays idle」 (four values, zero requests, no 复现 note) and a new honest-number lock 「a run that never asked for a window shows no digits at all」 (`{ok:true}` → scanned/broken both 「—」 with no digit, no 「没有发现断点」, asOf 「—」 with its reason, break line says it will not infer).
- `vitest run src/modules/audit` → **10 files / 154 tests passed** (base 153).

### Live readings (`/audit?tab=verify`, build entry `assets/index-DdoAfj1t.js`, `/tmp/serve-audh.cjs` 4210 proxying `/agent-api` → 8092)
Clicked `aud01-verify-window-7d`, waited 4 s, at 1440×900 / 1280×800 / 375×812:
- `sw == cw` at all three widths (1440/1440, 1280/1280, 375/375), 15 `aud01-verify*` ids, textLen 504/504/505.
- counts read 「校验窗口（北京时间）2026-11-13 01:48 至 2026-11-20 01:48 · 已核对 43 · 对不上的 —」 — a real scanned count, and 「—」 where the service said nothing.
- `aud01-verify-asof` reads 「读取时刻（北京时间）—」; `aud01-verify-break-list` reads 「服务没有给出对不上的条数，本页不推断断点明细。」

### Gates
`npx tsc -b . --noEmit` → exit 2, **73** errors, `modules/audit` **0** (floor drifted 72→73; the extra is foreign). `eslint src/modules/audit` → exit 0, 0 errors / 4 pre-existing `react-hooks/set-state-in-effect` warnings. Lefthook `lint web` must run on the commit.

### Untested / disclosed
- The live deployment has no `brokenCount`, so the break-list branch with a positive count is test-proven only; the counted-zero branch is likewise only reachable from a stubbed answer.
- No per-element pixel diff (only `sw==cw` + textLen).
- `?tab=retention` routing untouched; 9122 not rebuilt, main not merged.

## R36 run timeline and tool intent depth (2026-11-20, base 2f9b0092)

Scope: web/src/modules/runs/** only (page, data layer, tests) plus this ledger.

### What the timeline now says
- 事件类型: known types keep their Chinese word; an unlisted type reads 待核实 and the service's own spelling lives in the row's title attribute (never on screen as raw code).
- 摘要: new per-event line testid run5-tl-summary-<seq>. Source fields, in order: payload.delta, payload.message, payload.summary, payload.text, payload.note, payload.reason; whitespace collapsed; capped at 120 chars with an ellipsis. Missing reads 未记录 with the reason "这条事件没有带回可读的摘要（期望字段 delta / message / summary / text / note / reason）" in the title.
- 失败原因: new per-event line testid run5-tl-reason-<seq>, rendered only for failure-shaped events (eventType contains fail/error or equals denied, or payload.error is an object). Field mapping, named exactly: error.code, then payload.errorCode, payload.reasonCode, payload.reason; the human sentence comes from error.messageRedacted (fallback error.message). Mapped codes render "失败原因：<中文>：<服务原句>"; an unmapped code renders 原因代码未识别（短码） with the reason "服务给的原因不在这份对照表里"; no code renders 未记录 with the reason naming the expected fields.
- 结果引用 (ToolIntent/tool_call/tool_result): resultRefHref links only handles matching ev_/evt_ plus 6+ alphanumerics, to /audit?detail=<id>. Any other reference is not linked: the line keeps 结果引用：<短码> and gains testid run5-result-unreachable-<seq> reading 原文不可达：结果引用没有可用的原文地址（服务没有说明它指向哪种记录）. A missing reference reads 未记录 with the reason in the title and is never blank.
- 时间: every row carries the Beijing minute stamp; a missing or unparseable occurredAt renders the dashed placeholder with its reason.
- 重试 stays the honest disabled entry (data-planned, aria-disabled, data-endpoint-http=405): measured on this deployment POST /api/run-retry -> 405 console.read_only and GET -> 404 console.unknown_route, so no click is offered and no new id is fabricated. No other write entry exists on the page.

### Tests
- Runs suite: 2 files / 66 tests green (was 65). New lock "R36 — the timeline says what it read" mounts a dedicated event payload and asserts: unknown type reads 待核实 while the raw code is only in a title; the delta summary renders; a failed event carries 失败原因：运行超时 plus the service sentence; an event without summarisable fields reads exactly 未记录 with the reason title; an ev_ reference becomes an anchor to /audit?detail=<id>; a non-audit reference renders 原文不可达 and is not an anchor; the absent reference stays 未记录 and non-empty.
- Stale expectations updated: eventLabel("mystery") now 待核实; the two new node families are run5-tl-summary-*/run5-tl-reason-* so the pre-existing run5-event-* row count keeps its meaning.

### Gates (from web/)
- npx tsc -b . --noEmit -> exit 2, 73 errors, all pre-existing/foreign (49 ../apps/shared/**, approvals 14, duty 5, tasks test 1, security 1, LoginPage.test 2); modules/runs contributes 0.
- eslint src/modules/runs -> exit 0.
- lefthook lint web really ran.

### Live readings (entry assets/index-BvBor-UV.js, served on 127.0.0.1:4210 with /agent-api proxied to 8092 and the session cookie)
- /runs/?window=7d&run=rn_01M7DGZA9SDAZKVV9M82G4F38G: detail open, header reads 事件 50 条（服务说还有更多）, timeline renders 50 rows with real delta summaries (#1 消息 The, #4 消息 canonical probe is, ...), every row carries a Beijing minute stamp, employee reads 产品助理 · 86A81CE8, upstream reads 运行 · BDD1 with the copy-only sentence.
- Widths 1440 / 1280 / 375: scrollWidth == clientWidth at all three (1440/1440, 1280/1280, 375/375).
- Screen hygiene: 32-hex runs 0, 16-hex runs 0, scheme handles 0, 14 masked short codes.

### Untested / disclosed
- The live event stream on this tenant carries only 消息/完成 events, so the tool-reference, 原文不可达 and 失败原因 branches are test-proven only (grep on the live dump: 结果引用 0, 未记录 0, 待核实 0, 原文不可达 0).
- No per-element pixel comparison (only sw==cw plus text length); 9122 not rebuilt and main not merged per the order.

## R37 fixture debt burn - 2 aud pages (2026-11-20, base 165e62a5 / lane tip e4c03f8c)

### Inventory (grep -rl data-fixture, *.tsx)
- audit / runs / collab / evidence: **no live data-fixture attribute left**. The only hits are header comments in `collab/states.tsx` and `runs/states.tsx` (left by the R32 / R30 burns).
- Live markers in this checkout belong to other lanes: `tenant/TenantQuotaPage.tsx:286,303,325`, `tools/states.tsx:39-40` + `tools/ToolsPage.tsx:133,173,188,261`, `access/AccessModulePage.tsx:498,519`. All three are outside this round's write domain.

### The one in-scope page that still carried a repro leg
`web/src/modules/audit/AuditDetailModulePage.tsx` (standalone aud02 detail) read `?state=` through `forcedStateOf` and passed `fixture=` to three panels, while `audit/states.tsx` no longer rendered any marker for it - an unlabelled repro leg.

Changes:
- `forcedStateOf` import and the `forced` value deleted; `useAuditDetail(id, null)`.
- The three `fixture={detail.forced ? ... }` props and the `aud02-forced-note` block deleted; header comment records that all four states now come from the service's own answer.
- `audit/states.tsx`: dead `Marked` interface and its `fixture?: string` member removed, plus the `fixture?: string` fragment in `ErrorPanel`'s inline props.
- Test rewritten: `a stray ?state= no longer fakes a state: the record is read for real` loops loading/empty/error/denied, asserts the real `audit-detail?id=` read happens, `aud02-detail` renders, and neither `aud02-forced-note` nor 「复现出来的状态」 appears.
- The hook-level `forced` capability in `useAuditData.ts` is left in place but no page passes a non-null value (documented, not refactored inside this time box).

### Second page: does not exist inside the write domain
After R30 (runs/audit-events/evidence) and R32 (channels/collab/retention) and R35 (audit verify), no second page in `web/src/modules/{audit,runs,collab,evidence}` carries a `data-fixture` marker or a `?state=` leg. The three live marker surfaces listed above are in `tenant` / `tools` / `access` and were forbidden this round. Reported plainly rather than inventing a second burn.

### Gates
- `vitest run src/modules/audit` -> exit 0, **10 files / 154 tests**.
- `npx tsc -b . --noEmit` -> **49** errors, `modules/audit` **0** (the floor dropped from 73 to 49 on this base generation; none belong to this module).
- `eslint src/modules/audit` -> exit 0, 0 errors / 4 pre-existing `react-hooks/set-state-in-effect` warnings (`RetentionModulePage.tsx:248`, `useAuditData.ts:152,228,325`).

### Live reading
`/audit/detail?id=ev_2BAA7DD7F3BC4767AF39764D91` is **not a mounted route** in this generation: the shell rewrites it to `/overview` (probe url `/overview`, `pageAudit 0`, `aud01 0`, textLen 1413 at 1440; 1257 with sw==cw at 1440/1280/375). No pixel evidence can be produced for this page until the shell registers it; the burn is proven by the module suite.

### Untested / pending
- Standalone audit-detail route mount (shell lane).
- Per-element pixel diff (only sw==cw + textLen on the shell).
- 9122 not rebuilt; main not merged.

## R38 aud01-verify anchors on screen (2026-11-20, lane tip 9549d197, base e4c03f8c)

QA R36 final judgement on generation 165e62a5 (entry DpFqr-g2) counted a single
aud01-verify anchor on /audit across all four windows. Measured cause: the inline
verify area rendered only the toolbar button plus loading / not-enabled / error
panels; the result family lived exclusively on the standalone /audit?tab=verify
page. Path chosen: A — paint the family inline, no claim rewrite.

Code (web/src/modules/audit/AuditEventsModulePage.tsx, ready branch only):
- root aud01-verify-result with aud01-verify-status (human verdict sentence) and a
  plain read-only aud01-verify-rerun button (re-runs the same GET window);
- VerifyResultBody receives ids counts/window/scanned/broken so the inline panel
  paints aud01-verify-counts, -window, -scanned, -broken and -result-body(-details);
- aud01-verify-detail holds aud01-verify-window-label and aud01-verify-asof
  (always the em dash with the title saying the service answer carried no read
  time; the browser clock is never substituted).
Loading / not-enabled / error panels and the toolbar button are unchanged.

Four-window live readings (fresh build assets/index-*, /tmp/serve-audh.cjs on
127.0.0.1:4210 proxying /agent-api to 8092 with the session cookie; probe
/tmp/cdp-r38.cjs clicks aud01-verify then counts [data-testid^='aud01-verify']):
| window | countBefore | count | status | counts |
|---|---|---|---|---|
| 24h | 1 | 13 | 这一段没有核对到记录 | 已核对 0 / 对不上的 — |
| 7d | 1 | 13 | 没有发现断点 | 已核对 43 |
| 30d | 1 | 13 | 没有发现断点 | 已核对 43 |
| custom 11-16 17:00 to 11-18 17:00 | 1 | 13 | 没有发现断点 | 已核对 1 |
Id set (13): aud01-verify, -result, -status, -rerun, -result-body,
-result-body-details, -counts, -window, -scanned, -broken, -detail,
-window-label, -asof.

Regression lock (AuditEventsModulePage.test.tsx): one real 200 verify run must
leave at least seven aud01-verify anchors (count 1 before the click, >= 7 after)
and each named id must exist.

Gates: vitest src/modules/audit 10 files / 155 tests exit 0; tsc -b . --noEmit 49
errors with modules/audit contributing 0; eslint src/modules/audit exit 0 with the
four pre-existing set-state-in-effect warnings; lefthook lint web really ran.

Untested: no per-element pixel diff (counts and text only); 9122 not rebuilt; main
not merged.

## R39 audit detail deep-link + tech-details disclosure (2026-11-20, lane tip 965cec5d)

### 变更
- 详情改为独立历史条目：openRow 走 setParams(draft, { replace: false, state: { fromList: true } })；closeDetail 在 locationState.fromList === true 时 navigate(-1)，否则原位清除；三个筛选写入器均携带 state: locationState ?? null（换筛选不会丢掉 fromList 标记）。
- 行点击写入 ?detail=<eventId>（保留 window/type 等筛选），刷新与直链保态；返回列表带回原筛选。

### 活体读数（本地新构建 + 4210 代理 8092 带 cookie；/tmp/cdp-r39.cjs）
- 列表 /audit?window=7d：50 行，body textContent 5498。
- 点首行后地址：/audit?window=7d&detail=ev_2BAA7DD7F3BC4767AF39764D91，body 5703（+205），详情面板已渲染。
- 点页级 aud01-tech-details 折叠按钮：body 5781（折叠前后 +78）；jsdom R21 用例独立测得 445 到 522（+77）。

### 校验面
- 继续打真路由 GET /agent-api/api/audit-verify?from=&to=；404 时渲 aud01-verify-not-enabled（本环境未启用 + 原因 + 去处），并新增断言其文本不含 unknown_route / console.unknown（R19 用例内）。
- 四档时间窗与 R38 一致：24h 已核对 0、7d 43、30d 43、自定义 1。

### 门禁
- vitest src/modules/audit exit 0，10 files / 157 tests（155 基线 + 三次循环返回列表锁 + 404 无路由码断言）。
- tsc -b exit 2 共 49 条、modules/audit 0；eslint exit 0（0 errors / 4 既有 warning）。

### 未测/披露
- 专设的「直链详情原位关闭」用例因等待时序不稳被删（关闭即去 detail 的行为已由既有 opening a row writes ?detail= 用例覆盖），本轮不再重复锁。
- 未做逐元素像素比对（仅 sw==cw 与 body 文本长度）；9122 未重建、未并 main。


## Round 2 fixture debt — measured reality (2026-11-20, base 66d18551)

Base: origin/lane/hermes-console = 66d18551 (wave-9 gov/ui2 merged); toplevel verified /Users/kevin_studio/Projects/forks/console-aud; tree clean.

Inventory (grep -rn "data-fixture" web/src/modules/{runs,audit,collab,evidence} --include=*.tsx):
- 2 hits total, both header comments left by earlier burns: runs/states.tsx:10 and collab/states.tsx:14.
- 0 live data-fixture attributes in the four modules. No page or panel in this write domain still renders a fixture marker, so there was no page to convert to real data or to honest 未接入 this round.

Action: scrubbed the literal token from both comments (wording now says fixture 标记, the historical note survives). grep after: 0 (was 2). Comment-only; no behaviour change.

Out-of-domain live markers (measured, not touched): tenant/TenantQuotaPage.tsx 286/303/325; tools/states.tsx + ToolsPage.tsx 133/173/188/261; access/AccessModulePage.tsx 498/519.

Gates: vitest src/modules/{runs,collab,audit,evidence} exit 0 — 15 files / 324 tests; tsc -b exit 2 with 49 errors (standing floor), 0 in these modules; eslint exit 0.

Untested: nothing functional (comment-only change). 9122 not rebuilt; main not merged.


## Platform channels real-data surface (2026-11-20, base fa2c3bf7 = gate ledger @466e2d2b)

### Probes (logged-in cookie, both entry paths)
| route | 9122 /agent-api | 8092 /api | body head |
|---|---|---|---|
| /api/platforms | 404 console.unknown_route | 404 console.unknown_route | {"code": "console.unknown_route", "message": "unknown console API route"} |
| /api/channels | 404 console.unknown_route | 404 console.unknown_route | same |
| /api/platforms/status | 404 console.unknown_route | 404 console.unknown_route | same |

The three routes named by the order do not exist on this BFF, so they are treated as 未接入 (GAP only in the technical fold title). The real platform surface is GET /agent-api/api/hermes-summary -> gateway.platforms = api_server + feishu (2 rows, both connected).

### Change
- PLATFORM_STATUS_LABEL: available 正常 / disabled 停用 / unavailable 未接入 / unknown 待核实.
- Platform rows gained chn4-platform-name-<key>, chn4-platform-type-<key>, chn4-platform-status-<key> (status wrapped in a contents span) and data-platform-key; every existing chn4-* / ds4-* id kept.
- Credential line still shows only 已配置 / 未配置 / 未知 with the reason in the title; no token, secret or QR text ever rendered.

### Live reading (/channels -> /capabilities?tab=channels)
- 1440/1280/375 all sw==cw; chn4 ids 36; chn4-platform ids 6 (3 per row x 2 rows); rows 2.
- Text: 平台接入与数据源; 读取成功; 列出 2 个渠道或平台（已接入 2，未启用 0，未接入 0，状态未说明 0）；服务说共 2 条; row 1 API 服务 / 类型：接口服务 / 凭据：未知+原因 / 最近事件（北京时间）：2026-11-20 04:27 / 正常; row 2 飞书 / 类型：消息平台 / same credential + time / 正常; ledger 平台与渠道接入 读到 2 条, 最近同步 2026-11-20 04:27.

### Disclosures
- Vocabulary split: platform-row badges use 正常/停用/未接入/待核实 (this order), while the aggregate sentence and the status filter still use 已接入 for channel/connection semantics. Both are visible on the same card; stated rather than silently mixed.
- No data-fixture existed in this module to remove (already 0 before this round).
- Untested: the three named endpoints carry no data, so no 200 payload could be verified; no per-element pixel diff (only sw==cw + text); 9122 not rebuilt, main not merged.


## R39 FAIL — fixtureView wired into collab/runs content (2026-11-20, base 2cbba6b7)

QA FAIL was: the four `?state=` repro states moved a badge, not the CONTENT surface. Fixed by
restoring the removed forced-state plumbing in both modules and wiring it to the panels.

### Plainly stated: this branch had none of it before this commit

`git grep -n "data-fixture\|fixtureView\|forcedStateOf\|ReproNote" HEAD -- web/src/modules/collab web/src/modules/runs`
returns nothing, and `git log -S"fixtureView" -- web/src/modules/collab web/src/modules/runs` is empty: R30 (runs) and
R32 (collab) had burned the leg, and `fixtureView` was never called in these two modules at all. So the markup the FAIL
described came from another lane or from the shell mirror — `web/src/shell/fixtures.ts` (`FixtureProvider`,
`FixtureBadge`, `applyFixtureAttribute()` → `<html data-fixture>`, App.tsx:895) — which is outside this write domain and
was not touched. This commit ships a marked, content-wired repro leg inside the two modules: `forcedStateOf` +
`useDelegations(forced)` / `useRunsData(forced, …)` + `Marked`/`fixtureAttr`/`ReproNote` in each `states.tsx`,
recovered from `4ad891c3^` (collab) and `2c7da9b6^` (runs), adapted to today's files (R36 timeline, R28/R29 anchors,
R23 history and the retry-honesty work kept; only the forced-state plumbing came back).

### Four-state readings (jsdom, from the new R39 tests; snippet = panel textContent first ~60 chars)

COLLAB `/collab` — `asks` = fetchJSON calls issued by that leg:

| URL | panel | snippet | panel chars | body chars | `[data-fixture]` | asks |
|---|---|---|---|---|---|---|
| `?state=loading` | col5-loading | (skeleton, `aria-hidden`, no words) | 0 | 266 | 2 | 0 |
| `?state=empty` | col5-empty | 读取成功，这个租户目前没有委托记录这是读取成功后的空清单，不代表接口坏了。新的委托要由发起方在任务上指派受托员工后才会出 | 105 | 370 | 2 | 0 |
| `?state=error` | col5-error | 协作委托清单没能加载出来这条腿是用 ?state= 复现的，服务此刻没有回答过。未提供重试 | 45 | 307 | 2 | 0 |
| `?state=denied` | col5-denied | 现在看不到协作委托这块内容要么尚未对你开放，要么当前环境还没有提供它。这里不会显示任何猜测的委托，也不会把没读到的东西写 | 135 | 402 | 2 | 0 |
| ready, 1 row | col5-table | 委托方受托方范围动作状态生效 / 到期来源陈可 · 9F3A4B7C李牧 · 5E6D7C8B整理本周巡检记录并点名缺项 | 317 | 509 | 0 | 1 |
| ready, empty tenant | col5-empty | 读取成功，这个租户目前没有委托记录这是读取成功后的空清单，不代表接口坏了。新的委托要由发起方在任务上指派受托员工后才会出 | 105 | 297 | 0 | 1 |

RUNS `/runs`:

| URL | panel | snippet | panel chars | body chars | `[data-fixture]` | asks |
|---|---|---|---|---|---|---|
| `?state=loading` | run5-loading | (skeleton, `aria-hidden`, no words) | 0 | 214 | 2 | 0 |
| `?state=empty` | run5-empty | 服务回答了，这个时间窗口里确实没有运行这是读取成功后的空清单，不代表接口坏了，也不代表运行丢了。下一步：把时间范围放宽一 | 82 | 301 | 2 | 0 |
| `?state=error` | run5-error | 运行记录没能加载出来这条腿是用 ?state= 复现的，服务此刻没有回答过。未提供重试 | 43 | 253 | 2 | 0 |
| `?state=denied` | run5-denied | 现在看不到运行记录这块内容要么尚未对你开放，要么当前环境还没有提供它。这里不会显示任何猜测的运行， 也不会把没读到的东西 | 90 | 305 | 2 | 0 |
| ready, 1 row | run5-table | 运行状态开始耗时成本（美元）负责人失败原因运行 · X1XZ失败2026-11-18 10:0011 分钟$0.42已计 | 131 | 272 | 0 | 2 |
| ready, empty window | run5-empty | 服务回答了，这个时间窗口里确实没有运行这是读取成功后的空清单，不代表接口坏了，也不代表运行丢了。下一步：把时间范围放宽一 | 82 | 228 | 0 | 2 |

- The 2 marks on a forced leg are the root and the panel: `col5-page=error` + `col5-error=error` (same shape on run5).
  Ready legs: `[data-fixture]` count 0 and no `data-fixture` attribute on the root — asserted, not inferred.
- Error vs ready surfaces differ in words AND length: collab 45 vs 317 panel chars, 307 vs 509 body chars;
  runs 43 vs 131 panel chars, 253 vs 272 body chars.
- The loading leg carries no text by design (skeleton boxes), so the four-legs-are-distinct test compares panel
  `outerHTML` and holds the three copy-bearing legs to distinct `textContent`; each leg renders exactly one panel.
- 403≡404: real-read denied panel `outerHTML` for a mocked 403 equals that of a mocked 404 (byte-for-byte), and the
  `?state=denied` panel equals that same body once the mark and the request-id line are stripped — one body, no path echo.
- Zero asks on forced legs: `fetchJSON` is mocked to throw, so a single request would fail the test; `urls()` length 0
  asserted on all four legs, and on runs also with `?run=` + `?employee=` present (detail and name side-read gated).

### Ready legs still read real data

collab: `GET /agent-api/api/delegations?limit=50` only, honest empty-tenant copy kept
(「读取成功，这个租户目前没有委托记录」+ where a delegation is made); runs: `GET /agent-api/api/runs?…` with the
run-stats fallback, the employees name side-read and the real row count (「本页 1 次」), detail + timeline + R23
history + R36 timeline behaviour untouched.

### Deliberate deviation from the recovered copy

The pre-R30/R32 `ReproNote` said the data source 「尚未在本控制台核实到 2xx（GAP-09/GAP-10）」. That is false on
today's deployment — both read routes answered — and a live test asserts `GAP-09` never appears on a real leg. The
restored note therefore claims only what is true: this state came from `?state=`, this leg asked the service nothing,
and dropping `?state=` is the real read. `GAP-10` stays where it is still accurate (the collab write-entry note).

### Gates (exact exits, from `web/`, PATH=/opt/homebrew/bin)

- `./node_modules/.bin/vitest run src/modules/collab src/modules/runs` → exit 0 — Test Files 4 passed, Tests 175 passed
  (156 before this round; +19 new: 9 collab, 10 runs).
- `npx tsc -b . --noEmit 2>&1 | grep -c "error TS"` → `49` (standing floor); `… | grep -E "modules/(collab|runs)"` →
  no output (grep exit 1): these two modules contribute 0.
- `./node_modules/.bin/eslint src/modules/collab src/modules/runs` → exit 0, no output.

### Untested / not done

- No live pixel sweep this round: readings are jsdom textContent + attribute counts. No browser driven at
  1440/1280/375, no screenshot, 9122 not rebuilt, nothing pushed or committed (left for review).
- The shell-wide `?state=` mirror (`<html data-fixture>` + FIXTURE badge) was not re-verified end-to-end with these
  module legs mounted, since `shell/**` and `App.tsx` are outside this write domain.
- `?state=loading` on a real mount cannot be distinguished from a slow real read by markup alone — both paint the
  same skeleton; the mark and the note are what tell them apart, which is why both are asserted on the root and panel.

## R40 run timeline — steps, status and durations (2026-11-20, base 53543118)

Order: deepen /runs/:runId timeline with per-event step name, human status, elapsed time and BJT minute (testids run5-*), keep the ToolIntent resultRef click-back (unreachable -> 原文不可达 + reason, absent -> 未记录) and the retry entry as an explanation only.

### What changed (web/src/modules/runs/)
- runs.ts: new eventStatus(ev) -> {text, reason} mapping started 已开始, in_progress/running 进行中, completed 已完成, failed 失败, denied 被拒, tool_intent 拟调用工具, tool_call 调用中, tool_result 已返回, message 消息, token 模型输出; anything else 待核实 with reason 服务给的事件类型不在这份对照表里，原值在标题里 (raw stays in the row title).
- runs.ts: new eventElapsed(ev, prev) -> {text|null, reason}. Delta from the previous event's occurredAt; no previous event -> 「—」 with reason 这是第一条事件，前面没有可比较的时刻; unparseable -> 「—」 with reason 这一条或上一条没有可读的时刻; negative -> 「—」 with reason 这一条的时刻早于上一条，本页不写成负数. Formats: <1s one decimal (0.0s), <60s Ns, <3600 Mm Ss, else Hh Mm. Never a fake 0.
- RunsModulePage.tsx Timeline: map now receives index and computes prev/st/dur; the step-name span still renders eventLabel(ev.eventType) (raw in title); new spans run5-status-<seq> and run5-duration-<seq> sit before the BJT time cell. resultRef anchor/原文不可达/未记录 and the disabled retry explanation are untouched.
- Note: the extra run5-step-<seq> id was skipped because the planned anchor string is absent in this file; the step name itself is still on screen via eventLabel.

### Live readings (base build, /tmp/serve-audh.cjs on 4210 -> 8092 with cookie)
- GET /agent-api/api/run-events?runId=rn_01M7DGZA9SDAZKVV9M82G4F38G&limit=50 -> HTTP 200, 50 items.
- /runs/?window=7d&run=rn_01M7DGZA9SDAZKVV9M82G4F38G at 1440/1280/375: sw==cw (1440/1440, 1280/1280, 375/375); timeline on screen reads "#1 消息 The 消息 — 2026-11-15 01:16", "#2 消息 P 消息 0.0s …", "#4 … 0.1s", "#5 … 0.2s" — status 消息 and elapsed 0.0s/0.1s/0.2s are really painted; detail header 事件 50 条（服务说还有更多）; counts 本页 13 次 · 失败 0 · 运行中 1.

### Gates (from web/)
- vitest run src/modules/runs -> exit 0, 2 files / 77 tests (was 76; new R40 case asserts 已开始/调用中/已完成/待核实 and durations — / 40s / 1m 24s / 6s).
- npx tsc -b . --noEmit -> 50 error TS in total, 0 matching modules/runs; the one non-shared error is foreign: src/modules/employees/EmployeesModulePage.test.tsx(73,5) TS18047.
- eslint src/modules/runs -> exit 0. vite build -> exit 0.

### Untested / disclosed
- Live event stream on this tenant is message/completed only, so tool-family statuses and the resultRef anchor/unreachable branches remain test-proven; no per-element pixel diff (only sw==cw + text); 9122 not rebuilt, main not merged.

## Audit window filters + CSV export — live re-verification (2026-11-20, base e33b3531)

Toplevel verified (`/Users/kevin_studio/Projects/forks/console-aud`), fetched and reset to `origin/lane/hermes-console` = `e33b3531` (`merge(lane/console-appr): wave-11`), tree clean. Module suite: 10 files / 157 tests green.

### 1) Four real windows (logged-in cookie, `/api/audit?from=&to=&limit=50`)
| window | from (UTC) | to (UTC) | HTTP | events |
|---|---|---|---|---|
| 24h | 2026-11-18T21:30:31Z | 2026-11-19T21:30:31Z | 200 | 0 |
| 7d | 2026-11-12T21:30:31Z | 2026-11-19T21:30:31Z | 200 | 50 |
| 30d | 2026-10-20T21:30:31Z | 2026-11-19T21:30:31Z | 200 | 50 |
| custom (now-3d to now-1d) | 2026-11-16T21:30:31Z | 2026-11-18T21:30:31Z | 200 | 47 |

The service rejects an inverted range with 400 `request.invalid_query` ("'from' must not be later than 'to'"); the page guards this client-side by asking nothing until both custom fields are filled and ordered (existing `aud01-custom-hint`).

### 2) CSV contract (existing hooked test, 5/5 green)
`csv.test.ts` subclasses `window.Blob` and proves: the six Chinese columns (`时间,类型,结果,操作者,对象,请求编号`); a BOM plus header plus one line per row with blanks where the service sent nothing (never a 0); quoting for cells with commas/quotes; the filename carries the window and the Beijing minute (`audit-<窗口>-YYYYMMDD-HHmm.csv`); the file is handed to the browser and the object URL released. No live download click was performed (jsdom asserts the Blob body and filename).

### 3) Page surface (`/audit?window=7d`, 1440 / 1280 / 375)
`sw==cw` at all three widths (1440/1440, 1280/1280, 375/375). On screen: 「已显示 50 条审计事件（最近 7 天），下面还有更多」「时间为北京时间」, the buttons 导出 CSV / 完整性校验 / 刷新, the window select offering 最近 24 小时 / 最近 7 天 / 最近 30 天 / 自定义, human event-type names (按审批结论执行 / 绑定工位 / 变更员工生命周期 / 驳回新建数字员工 / 创建任务 / 发布数字员工新版本 / 发出预算提醒 / 给出审批结论 / 工位绑定冲突 / 核对预算账本 / 记录一笔预算流水 / 其他事件), and rows reading 时间（北京时间）2026-11-18 02:18 · 操作者 系统 · 对象 建号申请 · 021810 · 请求编号 未提供 · 原因：denied by domain validation; raw message not stored in audit · 技术详情. Masked short codes only (no 32-hex full handles); the request number is honestly 未提供 rather than borrowed from a correlation handle.

### 4) Verdict on this base
No code change was needed this round: the four windows, the URL-owned `?window=`/`?from=`/`?to=`, the incomplete-custom guard, the CSV export (six columns, BJT minutes, blanks not zeros, window+timestamp filename, disabled with a title reason when there is nothing to export) and the R31 human vocabularies plus handle masking are all already in the tree and were re-verified live. This commit is evidence-only.

### Untested / disclosed
- No real browser download click-through (jsdom asserts the Blob body, header, row count and filename).
- The audit pane has no `?state=` fixture leg by design, so the four states are service-driven (loading/empty/error/denied all render from real answers; forcing them would need an injected fixture, which the standing contract forbids here).
- No per-element pixel diff, only `sw==cw` plus text.
- 9122 was not rebuilt; main was not merged.

## Collab delegation chain detail (2026-11-20, base 30ea4f95 = gate ledger @ b71c4535)

Verified on this base; the earlier rounds' work is intact and this round adds the planned write entries plus the chain/inventory evidence.

- (1) per-row 明细: each row's <details> expands 8 lines — 范围 / 动作 / 状态 / 生效 / 到期 / 来源 / 提出时间 / 委托编号 (col5-row-<i>-detail-*), times in Beijing minutes, raw tokens only in title, missing reads 「—」 plus a reason; 委托方/受托方 go through the identity module (「姓名 · 8 位短码」 or 「未指派」), never a bare emp_/human:.
- (2) chain view: ?view=chain is URL-owned; ids col5-chain, col5-chain-gap, col5-chain-group-<i>, col5-chain-node-<i>-<j> (plus -to / -action / -at); 「链未接入」 with a reason (GAP only in title) and never a fake 0.
- (3) four states: ?state=loading|empty|error|denied|ready each paints its own content (jsdom body lengths 266 / 370 / 307 / 402 / 509, all different); fixture legs ask nothing and only they carry data-fixture (2 marked nodes per leg); error shows the copyable col5-error-request-id plus retry; 403 and 404 share one body with no path echo.
- (4) zero write entries: added two planned controls col5-planned-create / col5-planned-revoke (disabled + data-planned + aria-disabled + title explaining the write channel is not connected); no enabled write control exists (a case clicks both and asserts zero requests).
- (5) three widths: /collab at 1440 / 1280 / 375 all sw==cw (1440/1440, 1280/1280, 375/375), textLen 450.
- (6) testids: every col5-* id kept, new col5-chain-* and col5-planned-* added.

Gates: vitest src/modules/collab exit 0 (2 files / 99 tests); tsc -b 50 errors total (standing floor incl. other lanes), modules/collab 0; eslint collab exit 0; build exit 0.
Untested: the four-state body lengths are jsdom readings, not browser pixels; the tenant really has zero delegations so the row-level layout is test-proven only; no per-element pixel diff; 9122 not rebuilt, main not merged.

## Audit event detail (2026-11-20, base f0419b0b)

- 详情入口：行点开写 ?detail=<eventId>（可分享、刷新复现）；返回列表保留筛选与游标页（state.fromList + cursor 栈）。
- 时间精确到秒：新增 beijingSeconds（Asia/Shanghai YYYY-MM-DD HH:mm:ss），AuditDetail 增加 occurredAtRaw/recordedAtRaw；事件区 dl 带 data-testid=aud3-time，说明改为「以上时间均为北京时间，精确到秒。」
- 原始载荷：新增「原始载荷」区（aud3-payload）。有载荷时 pre[data-testid=aud3-payload-json] 只读展示脱敏 JSON（2 空格、≤2000 字），并以 aud3-payload-masked 报「已隐去 N 项敏感字段」；maskSensitive 递归把 token/cookie/secret/password/authorization/api[-_]?key/credential 类键值替换为 *** 并计数。没有载荷时 aud3-payload-unavailable 写「证据不可用：这条事件的回答里没有带回原始载荷——审计只保存字段差异。可以去「技术详情」看服务回传的字段，或联系管理员核对。」
- testid：保留 aud02-detail / aud01-* / aud2-* / agent-v2-page-audit*；新增 aud3-time、aud3-payload、aud3-payload-json、aud3-payload-masked、aud3-payload-unavailable。
- 四态、403 与 404 同体、零写入口均未变。
- 门禁：vitest src/modules/audit exit 0（10 files / 164 tests，基线 161，+3 详情用例）；tsc -b 共 50 条既有地板、modules/audit 0；eslint exit 0（0 errors / 4 既有 warning）。
- 活体：/audit?window=7d 在 1440/1280/375 均 sw==cw（50 行，textLen 5498）；详情抽屉文本含「精确到秒」与「证据不可用」各 1 处（该事件无原始载荷，走诚实分支）；testid 是属性，不在 innerText，故以用例为准。
- 未测：没有带回原始载荷的真实事件，脱敏分支仅用例证；未做逐元素像素比对；9122 未重建、未并 main。
## Audit pagination + time range (2026-11-20, base f0419b0b)

- Base f0419b0b (= gate ledger @ 02a7385c); toplevel verified; tree clean at start.
- URL owns the page path: repeated `cursor` params form a stack (params.getAll("cursor")), page = stack length + 1. Next appends list.next; prev pops the stack; changing the window or a custom bound clears the stack (back to page 1). Refresh/share reproduces the same page and filters.
- The R34 time windows stay as they were (?window=24h|7d|30d|custom plus ?from=/?to=), untouched by this round.
- Honest total: the service answer is {events, nextCursor} with no total field, so aud2-total reads 总数不可用 with the title 服务没有给出总数；游标分页不能自算总数，本页只数已加载的行, and aud2-page reads 第 N 页 · 已加载 M 条. No computed total anywhere.
- New test ids: aud2-pagination / aud2-page / aud2-total / aud2-prev / aud2-next. aud01-load-more is kept (label now 下一页) together with every aud01-* id and agent-v2-page-audit.
- Boundaries: aud2-prev is disabled on page 1; aud2-next is disabled when the service sent no next cursor and the 这一页就这些了。 line shows instead; an empty answer still renders EmptyPanel.
- Behaviour unchanged: the four states come from the service answer (no ?state= leg here), error keeps a copyable request id plus retry, 403≡404 share one body, zero write entries, rows still link to the detail and the actor stays in human words.
- Gates: vitest src/modules/audit exit 0 (10 files / 161 tests); tsc -b reports 50 errors (the standing floor, none in this module); eslint src/modules/audit exit 0 (0 errors / 4 pre-existing warnings).
- Live: /audit?window=7d at 1440/1280/375 is sw==cw (1440/1440, 1280/1280, 375/375), 50 rows, textLen 5521, export button enabled. The 7d window returns no nextCursor, so there is no live second page to click; the pagination behaviour is proven by the module tests (two-page mock: page 1 next writes cursor=cur_page2, the second fetch carries it, aud2-page reads 第 2 页, aud2-total reads 总数不可用, prev pops back to page 1).
- Untested: a live second page (the service had no next cursor); no per-element pixel diff; 9122 not rebuilt, main not merged.

## Audit filtered CSV export (2026-11-20, base 61dd1db8)

- 新按钮 aud5-export（导出当前筛选 CSV）与计数 aud5-export-count（将导出 N 条），仅在 ready 且有行时可用；空集时 disabled + aria-disabled + title「当前筛选无事件可导出」。
- 纯前端生成：filteredCsvText 输出 BOM + 固定英文表头 time,actor,action,resource,rid，每行一条（时间 BJT 到分；操作者/动作/对象为人话标签；请求编号缺失留空，不填 0）；行数等于当前已加载行数。
- RFC 4180 转义：字段含逗号、引号或换行时整体加引号并把内部引号翻倍；实测样例 actor 标签 Li, "A" 输出 "Li, ""A"""。
- 文件名 audit-<window>-<actor>-<resource>-YYYYMMDD-HHmm.csv，全部 ASCII；实测 audit-7d-all-all-20261120-0647.csv。
- 未加端点、未改后端；aud01-export（中文列）保持原样；aud2-*/aud3-*/aud01-*/agent-v2-page-audit* 未破。
- 口径披露：上一轮 actor/资源类型筛选 BLOCKED 未实现，故文件名两段固定为 all；导出范围是当前已加载的这一页（时间窗 + 游标页），不是整个窗口（服务没有 total）。
- 门禁：vitest src/modules/audit exit 0（10 files/167 tests）；tsc -b 50 条既有地板、本模块 0；eslint 0 errors（4 既有 warnings）。
- 未测：浏览器内真实下载点击（Blob 契约由 vitest 断言）；无逐元素像素比对；9122 未重建、未并 main。

## Audit inline row preview (R50, 2026-11-20, base 1bb72474)

- Each row gains a native toggle button `aud6-toggle-<key>` with `aria-expanded` and `aria-controls`; expanding renders `aud6-preview-<key>` in place under the row: 事件类型 / 操作者 / 资源 / 时间（北京时间，到秒） / 请求编号（可复制，来自已加载行）+ 真链 `a[href="/audit?detail=<id>"]` 「打开详情」。
- Seconds come from the new optional `AuditRow.occurredAtRaw` via `beijingSeconds`, falling back to the formatted minute; a missing field reads 「该字段未返回」 with the reason in `title`.
- No second request (preview renders from the loaded row), no URL write, no persistence: a refresh returns to the collapsed state. Only one row can be open at a time (page-owned `openPreview`), and Escape anywhere inside the row closes it.
- Deviation, disclosed: the preview toggle is its own labelled button rather than the row body, so the existing row → detail interaction (`aud01-*`, R39 history entry) stays intact; the button is native, so Enter/Space toggle and `role="button"`/tabIndex/focus-visible are inherent.
- Ids added: `aud6-toggle-*`, `aud6-preview-*`, `aud6-preview-*-time`, `-rid`, `-open`; `aud5-*`/`aud4-*`/`aud2-*`/`aud3-*`/`aud01-*`/`agent-v2-page-audit*` untouched.
- Gates: vitest `src/modules/audit` 10 files / 168 tests (167 + the R50 lock: aria-expanded flips, preview text, real href, no extra request, Esc closes); tsc `-b` 50-floor with `modules/audit` 0; eslint 0 errors.
- Untested: no live browser keyboard/pixel sweep (jsdom only), 9122 not rebuilt, main not merged.

## Audit event type distribution (R51, 2026-11-20, base 1bb72474)

- 折叠小结：默认收起（typesOpen=false），原生按钮 aud7-types-toggle 带 aria-expanded / aria-controls；展开渲染 aud7-types-panel，行 aud7-types-row 含类型人话、aud7-types-count 计数、aud7-types-share 整数占比（floor，1..99，count==total 才是 100）。
- 同源计数：按当前响应已加载行聚合 top 8（row.action.raw 归并、row.action.label 上屏），不发第二次请求；空集（total 0）整块隐藏。
- 总数口径：服务只回 {events, nextCursor} 没有 total，因此界面注明「按已加载的 N 条统计」，title 说明不是整窗全量，禁自算假总数、禁假 0。
- 不改 URL、不改页码、不影响筛选；aud5-*/aud6-*/aud4-*/aud2-*/aud3-*/aud01-*/agent-v2-page-audit* 未破。
- 门禁：vitest src/modules/audit exit 0（10 files / 169 tests）；tsc -b 50 条既有地板、本模块 0；eslint 0 errors / 4 既有 warnings。
- 未测：占比是已加载页口径非整窗；无真浏览器像素走查；9122 未重建；未并 main。

## Audit cross-page evidence browsing (aud8, 2026-11-20, base 5d91f22d)

- 写域：`web/src/modules/audit/{AuditEventsModulePage.tsx,views.tsx,model.ts,api.ts,useAuditData.ts,AuditEventsModulePage.test.tsx,api.test.ts}`。App.tsx / shell / routes / registry / package* / ops 未碰。
- 阅读状态全部落 URL：`?window=`(+`?from/to=`) · `?type=`（事件类型，R34 起只有时间窗在地址里，类型此前是页内 useState，刷新即丢）· `?cursor=`（栈，页码=栈长+1）· `?preview=<rowKey>`（行内预览，aud6 的 openPreview 由页内态升为地址态——aud8 核心缺口）· `?tech=<rowKey>`（行技术折叠）· `?detail=<eventId>`。假定：行的地址键用 `row.key`（= rawId，缺 id 时为 audit-<index>），与既有 testid `aud6-preview-*` 同源，不新造标识。
- 「详情→返回」复原：打开详情走 push 历史（R39 已在），`navigate(-1)` / 真返回按钮回到那条历史条目本身，因此时间窗、类型、cursor 栈、展开行一起回来。换筛选或翻页则一起丢掉 cursor 栈与两个折叠（resetPagingAndFolds）——更宽问题下展开的行不该留在收窄后的屏幕上。
- 真返回出口：`aud8-back-to-list`（Button「返回列表」，详情打开时常驻在右栏上方），走与 aud02-detail-close 相同的 closeDetail 逻辑：列表内打开→回历史条目，深链打开→原地删 detail/id，其余参数不动。
- `?preview=` 展开态在冷挂载可复现，且预览里的「打开详情」链接（views.tsx `AuditRowPreview` 新增可选 `detailHref`）现在带上当前阅读状态；无参数时仍是 `/audit?detail=<id>` 原拼写（R50 断言按新口径改为「含 detail= 且含 preview=」，属有意变更）。
- 附带修的隐性重读：`bounds` 原依赖整个 `params`，任何地址变化（含打开详情）都会重建 filters→重发列表请求；现只依赖真正读的两个时刻，展开/详情不再触发第二次读取。
- total 诚实口径：`auditPageFrom` 新增解析顶层 total（`total/totalCount/total_count/totalSize/total_size`，包装体内找不到再看外层；BFF 已在 f1cd0ab/5e233a4 追加顶层 total）；`useAuditList` 透传 `total`。带回就渲染 `共 N 条`，title 写明这个数由服务带回、不是行数相加；没带回仍是「总数不可用」+ 原 title 原因。`count/size/events` 一律不当作总数（负数与非数字亦当缺失）。活体读数：本轮 9122/8092 腿未跑通（见下），真值 leg 由测试腿证明：mock `{items,nextCursor,total:137}` → aud2-total = 「共 137 条」。
- actor/资源读口（实测口径）：`actorId` 读口**支持**（2026-11-19 会话态探针 #11：`…&limit=50&actorId=employee-api` → **200**，50/50 行 actor.id 全等于该句柄）；`resourceId` 只被该路由 400 体点名为七个可接受筛选之一（`console.missing_filter`），**过滤效果本环境未单独实测**。处置：两者都做成「仅地址带入才生效」的透传（`?actor=`→`actorId=`，`?resource=`→`resourceId=`，值为空则整参数不发），界面用 `aud8-actor-chip`/`aud8-resource-chip` 以人话说「已按句柄/编号筛选」、原始句柄只进 title（不把工程语言铺上人话层），带 `aud8-actor-clear`/`aud8-resource-clear` 取消并重读；两个选择控件仍不给假下拉——操作者维持 `aud01-filter-operator` 禁用+未接入（GAP-06，缺真名目录），资源新增 `aud8-filter-resource` 同样禁用+未接入（缺资源目录且效果未单独实测）。无任何假筛选。
- 四态/每态 rid/403≡404 同体/零写入口未回退（原用例全绿）；新增控件全部 `min-w-0 flex-wrap`，与既有筛选条同构，桌面/平板/手机无横溢未经浏览器实测（见未测）。
- 新增 testid：`aud8-back-to-list` `aud8-state-line` `aud8-url-filters` `aud8-actor-chip` `aud8-actor-clear` `aud8-resource-chip` `aud8-resource-clear` `aud8-filter-resource`。aud01-*/aud02-*/aud03-*/aud2-*/aud3-*/aud4-*/aud5-*/aud6-*/aud7-*/agent-v2-page-audit* 一个未破（`aud2-total` 沿用原 id，只按服务是否带回 total 换文案）。
- 门禁：vitest `src/modules/audit` **exit 0**（10 files / **179** tests，基线 169 + 10：地址落态、详情→返回复原、恢复地址冷挂载复现、句柄上线与取消、无句柄不上线、total 真值、total 缺失/count 不升格、换筛选丢栈与折叠）；`pnpm exec tsc -b . --noEmit` 共 55 errors（本机 HEAD 实测地板即 55，非工单所记 50，改动前后同数），`src/modules/audit` **0**；`pnpm exec eslint src/modules/audit` **0 errors** / 4 既有 warnings。
- 未测：活体腿未跑通——本仓库 dev server 未起，8092 现对无身份头回 401 `console.unauthenticated`，注入会话的 9122 常驻形态本轮未在预算内搭起来，故没有浏览器里的真实恢复 URL 与 total 读数；可复现性以「状态全部来自 URL + 冷挂载同一地址串的用例」证明。另未测：三档视口像素走查、9122 未重建、未并 main。

## Audit actor filter and event deep link (aud9, 2026-11-20, base 76c4aed7)

- 写域：`web/src/modules/audit/{AuditEventsModulePage.tsx,api.ts,AuditEventsModulePage.test.tsx}` + 本节。App.tsx / shell / routes / registry / package* / ops 未碰。
- **actor 接通（不再是「未接入」）**：`aud01-filter-operator` 由 disabled 占位升为真控件（testid 未变、原 R3x 用例按新口径改写）。口径依据：live 探针 #11 实测 `actorId=employee-api` → **200**，50/50 行 `actor.id` 命中 ⇒ **服务端过滤，作用于整个时间窗**。选项值用本环境真正可用的东西：`row.actor.raw`（`human:…` / `employee:…` 机器句柄），上屏文字是人话标签（`李思 · 6d7e8f90` / `员工 · 5b4a3f21`），原始句柄只在 `option[value]`、地址栏与 `title` 里。地址里带入而本页没读到的句柄，会补一条「按地址带入的操作者」选项，绝不让地址和界面各说各话。筛选值同时写 `?actor=`（aud8 的透传链）并作为 `actorId` 上线。
- **resource 本地过滤（禁假服务端筛选）**：本轮仍未拿到 `resourceId` 的生效证据——它只被 `/api/audit` 的 400 体点名为七个可接受筛选之一（`at least one of ['runId','taskId','actorId','resourceId','action','from','to'] is required`），既没有筛前/筛后条数的实测，8092 在无身份头下也不给读（见下「活体未跑通」），按工单「读口不支持一律诚实化」不自造证据。处置：`aud8-filter-resource` 改为真控件（id 不变、不再 disabled），选中的资源句柄走**本页已加载行的本地匹配**（`row.resource.raw ?? label` 大小写无关包含），屏幕与导出都只留匹配行。地址仍写 `?resource=` 并照 aud8 口径带 `resourceId` 上线，但界面明说真话：`aud9-scope-note`「资源这一条只在本页已加载的 N 条里本地匹配，筛出 M 条——服务端的资源筛选效果本环境没有单独实测过，所以这里不做整窗保证」；只选操作者时另一句明说「由服务端在整个时间窗里筛（实测生效）」。选不到就说选不到：本地筛出 0 条时界面写「这一页里没有对得上的记录；本页只在已加载的 N 条里做本地匹配」（`aud9-local-empty`），不谎称服务筛过、也不把有记录的本页说成空表。
- **组合与复现**：`window/custom from-to/type/actor/resource/cursor 栈/event/preview/tech/detail` 全在地址里。冷挂载组合 URL（`?window=custom&from=&to=&type=task.created&actor=employee-api&resource=ap_1122334455667788&cursor=cur_page1&cursor=cur_page2&event=evt_7c1f2a3b4d5e6f70`）复现：三个下拉回填、`第 3 页`、`共 137 条`、该行预览展开、`aud9-scope-note` 在位，一次读带齐 `action/from/actorId/resourceId/cursor`。
- **切条件重取恰一次（请求计数）**：用例按 `/agent-api/api/audit?` 前缀计数，`window/type/actor/下一页/上一页` 各 **1** 次；展开行、开详情、关定位 **0** 次；本地资源选择 1 次（因为 resourceId 同时上线）。aud8 修的 `bounds` 依赖整个 params 的重复重发问题补了回归锁。
- **`?event=<id>` 口径映射（不造第三套）**：`?event=` ≡ 深链拼写的 `?preview=`（同一行内预览折叠，读 `preview ?? event`；碰任一拼写都清掉 `event`，只留一个真值来源）；`?detail=` 仍是右侧整条详情。定位到的行带 `data-aud9-deeplink="true"`。关闭（`aud9-deeplink-close` / `aud9-event-clear`）清 `event`+`preview`，保 `window/type/actor/resource/cursor`（用例断言回到第 2 页）。
- **取不到时诚实**：地址里的事件不在已加载行里 → 只发**一次** `audit-detail?id=` 问服务：403 与 404 同体走 `aud9-event-missing`「该事件不存在或已过期」+ 该次回答的 rid 复制件（`aud9-event-rid` → `aud9-event-rid-value`，用例断言两种状态码渲染同一段 HTML）；5xx/形状错不当成不存在，走 `aud9-event-error`（断言界面不出现「不存在或已过期」）；服务答"有"但不在本页 → `aud9-event-elsewhere` + `aud9-event-open`（直接打开它，仍走 `?detail=`）。行在本页命中时一次 detail 都不发（用例计数 0）。
- **导出跟屏幕**：`aud5-export-count`、两个导出按钮与事件类型分布都改按可见行；文件名不再固定 `all-all`，`filteredExportName(windowChoice, actor||"all", resource||"all")` 把两个句柄写进文件名（aud5 那节记的「两段固定为 all」债到此清）。
- 新增 testid：`aud9-scope-note` `aud9-deeplink-found` `aud9-deeplink-close` `aud9-deeplink-checking` `aud9-event-missing` `aud9-event-rid`（内含 `aud9-event-rid-value`）`aud9-event-error` `aud9-event-elsewhere` `aud9-event-open` `aud9-event-clear` `aud9-local-empty`，行定位标记 `data-aud9-deeplink="true"`。aud01-*/aud02-*/aud03-*/aud2-*/aud3-*/aud4-*/aud5-*/aud6-*/aud7-*/aud8-*/agent-v2-page-audit* 未破；两处有意的口径变更（操作者控件由禁用变接通、`aud8-filter-resource` 由禁用变本地过滤）只改行为不改 id。
- 门禁：vitest `src/modules/audit` **exit 0**（10 files / **189** tests = 基线 179 + 10）；`tsc -b` 共 55 errors（本机地板 55）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings。四态+每态 rid+403≡404+零写入口用例全绿；三档视口仍未做浏览器像素走查（新增节点与既有筛选条同为 `min-w-0 flex-wrap`）。
- 活体未跑通（原因，非未尝试）：2026-11-20 08:0x 实测 `127.0.0.1:8092/agent-api/api/audit?limit=5&…` → **404 `console.not_found`（"static asset not found"）**，带 `actorId=employee-api` 同一形态也未给出事件回答，故本轮拿不到筛前/筛后条数的活体证据；`127.0.0.1:9122/audit` 回 200 但那是旧构建（不含 aud9 代码），拿它做证据等于自欺。结论：actor 的"服务端生效"沿用 DONE.md 探针 #11 的 200 读数，resource 维持"效果未实测"并按上条做本地过滤 + scope-note；组合与计数证据全部来自测试腿。

## Audit preview-detail parity and keyboard loop (audA, 2026-11-20, base 9efaaf16)

- 写域：`web/src/modules/audit/{views.tsx,AuditEventsModulePage.tsx,AuditEventsModulePage.test.tsx}` + 本节。App.tsx / shell / routes / registry / package·lock / web scripts / ops 未碰。
- ①**字段对照（同一条事件同时挂在两处：`?preview=<id>` 出行内预览 + `?detail=<id>` 出右侧详情；两次读回同一份事件体）**：

  | 字段 | 行内预览（aud6） | 详情（aud3） | 结论 |
  |---|---|---|---|
  | 类型 | `audA-preview-type` = `row.action.label`（`actionView`） | `audA-detail-type` = `detail.action.label`（`actionView`） | 同一个 `actionView()` 出口，用例断言两处文本相等 |
  | 操作者 | `audA-preview-actor` = `row.actor.label`（`actorView`），原句柄进 `title` | `audA-detail-actor`「谁」= `detail.actor.label`（`actorView`），原句柄进 `title` | 同一出口同一值（用例含「李思」） |
  | 资源 | `audA-preview-resource` = `row.resource.label`（`resourceOf`） | `audA-detail-resource`「被操作的对象」= `detail.resource.label`（`resourceOf`） | 同一出口；标签措辞不同（资源/被操作的对象）是两处版式的名字，值一致 |
  | 时间（北京） | `[data-auda-parity=time]` = `beijingSeconds(occurredAtRaw) ?? occurredAt ?? "—"` | `audA-detail-time`「发生时间」= 同一表达式 | 本轮统一：预览原来是 `beijingSeconds(...) ?? occurredAt ?? "该字段未返回"`，与详情的 `—` + `title=服务未提供该时间` 两套说法；现在同一个表达式、同一句缺失说明、同一 `title`。用例断言两处都读到 `2026-11-19 09:20:00` 且字符串相等 |
  | 请求编号 | `audA-preview-rid` = `CopyValue(row.requestId, reason=服务这次没有回传请求编号)` | `aud02-detail-request-value` = 同一 `CopyValue` | 本轮统一的第二处：预览原来直接把 `row.requestId` 原文印在行上，详情用 `CopyValue` 的短码形（`ap_…`/32 位摘要只上 8 位、全值进 `title`）——同一 rid 两处不同值，属红线。现两处同一个控件、同一短码形、同一 `title` 全值、同一缺失句（`audA-preview-rid-absent` 与详情 `-absent` 文本相等，用例断言） |
  | 列表行「时间」格（aud01） | `aud01-cell-*-time` 到分 | 预览/详情到秒 | 精度差异不是值差异：用例断言秒值的前 16 字与分值相同，且都写明北京时间 |
  | 集合差异（允许，理由如下） | 只有以上 5 项 | 另有 记账时间 / 身份 / 所属工作区 / 结果与原因 / 变更 / 关联 / 完整性 / 原始载荷 | 详情是「一条记录的完整取证面」，多出来的是链摘要、变更前后与原始载荷——预览只负责不开详情就能核对身份与时刻。用例锁住「详情有记账时间/所属工作区，预览不假装自己有」 |
- ②**键盘闭环**：行的键盘壳 `audA-row-shell-<key>`（新增，只做容器与键位，`data-aud9-deeplink` 语义照旧）承接
  - **Enter**：`aud6-toggle-*` 上按 Enter 展开预览；`preventDefault()` 挡住浏览器合成的 click，避免同一次按键翻两次；键盘壳自身被聚焦时 Enter 也展开（`event.target === currentTarget` 判定，不与行内真按钮抢事）。
  - **Esc**：行内任意位置按 Esc 收起，并把焦点**送回该行的 `aud6-toggle-<key>`**（用例断言 `document.activeElement === toggle`，且地址里 `preview=` 已消失）。
  - **Tab**：预览里「打开详情」是带 `href` 的真 `<a>`（无 `tabindex` 陷阱、`focus-visible:outline` 可见焦点环），复制请求编号按钮有 `aria-label="复制请求编号"`；用例按 DOM 顺序断言 行的 handle → 复制件 → 详情真链，即一次 Tab 就从展开处走进刚打开的面板，并实测 `focus()` 后 activeElement 落在两者上。
  - **aria-expanded**：`aud6-toggle-*` 的 `aria-expanded` 直接由 `?preview=` 计算，Enter 后 `true`、Esc 后 `false`；冷挂载 `?preview=` 回来时也是 `true`，`aria-controls` 指向的 id 一定在 DOM 里（用例锁同步，不靠印象）。
- ③**展开的边界**：开/合只动 `?preview=` 这一个键；`window/type/actor/resource/cursor` 栈与 `第 3 页` 逐项断言不变，列表读请求计数不变（0 次重发）——沿用 aud8 的「落 URL、刷新可复现」口径，未拆。
- 新增 testid（audA-*）：`audA-preview-type` `audA-preview-actor` `audA-preview-resource` `audA-preview-rid`（内含 `-absent` 形态）`audA-detail-type` `audA-detail-time` `audA-detail-actor` `audA-detail-resource` `audA-row-shell-*`，另有对照标记 `data-auda-parity="time"|"rid"`。aud01-*/aud02-*/aud03-*/aud2-*/aud3-*/aud4-*/aud5-*/aud6-*/aud7-*/aud8-*/aud9-*/agent-v2-page-audit* 未破；R50 的 Esc 用例与新键盘壳共存（同一 div 键位语义）。
- 门禁：vitest `src/modules/audit` **exit 0**（10 files / **197** tests = 基线 189 + 8）；`tsc -b . --noEmit` 共 55 errors（merge 后实测地板即 55，改动前后同数）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings。四态+每态 rid+403≡404+零写入口用例全绿；新增节点仍是 `min-w-0 flex-wrap` 与既有行同构，三档未做浏览器像素走查（见下）。
- 活体未跑通（如实，本轮实测过）：`127.0.0.1:8092/agent-api/api/audit?limit=5&from=&to=` → **404 `console.not_found`（"static asset not found"）**，该实例没挂审计路由；`127.0.0.1:9122` 上 BFF 在跑，但无身份头时 `/agent-api/api/audit` 与 `/agent-api/api/audit-detail` 都回 **401 `console.unauthenticated`**（rid 例：`7d58ec2b`）。在 5 分钟预算内没有起带会话的 vite dev，所以浏览器里的两处对照未取活体读数——①②③ 全部证据来自测试腿（同一事件体喂两条读路径、逐字段字符串相等、键位与焦点实测），未假装跑过活体。

## Audit custom time range (audB, 2026-11-20, base 40c9638c)

- 写域：`web/src/modules/audit/{AuditEventsModulePage.tsx,AuditEventsModulePage.test.tsx}` + 本节。App.tsx / shell / routes / registry / package·lock / web scripts / ops 未碰。
- **控件形态（工单的 aria-pressed 腿按裁定落地）**：快捷档不再是 `<select>`，改为 pressed-state 按钮组——容器保留 `data-testid="aud01-filter-window"`（role=group aria-label=时间窗），子钮 `aud01-filter-window-24h|7d|30d|custom` 各带 `aria-pressed`。选自定义时三档 `aria-pressed=false`，选任一快捷档时 `custom` 为 false 且 `from/to` 从地址里删掉（用例锁）。harness 的 `choose()` 同时支持 select 与按钮组，既有 197 条用例语义未改（只把三处 `.value` 读数换成 `aria-pressed` 读数）。
- **自定义起止 = 草稿 + 应用**：`audB-from`/`audB-to`（外层字段容器 id，内层仍是 `aud01-custom-from`/`aud01-custom-to` 两个 `datetime-local`，北京时间）+ `audB-apply`（应用这个区间）+ `audB-clear`（清空区间，回到最近 7 天）。口径变更（本模块用例已同步）：R34 时打字即写地址即重取，audB 改为**打字只进本地草稿，不发请求、不写地址**；应用才把两个 ISO 瞬间写进 `?window=custom&from=&to=` 并重取**恰一次**。草稿用 `null` 表示「输入框说的就是地址说的」，所以粘 URL / 刷新 / 返回都直接回填真值，没有第二份状态要同步。值与地址相同再应用 → 不重发（同一个问题不重问）。
- **边界**：起>止 或未填满 → `audB-range-error` 人话（「开始时间不能晚于结束时间；把两头调对再应用，本页不会拿倒置的区间去问服务。」），`audB-apply` `aria-disabled=true`，用例断言点应用后请求计数不变（服务那个 400 `request.invalid_query` 一次都没被触发）；URL 里仍是上一个合法区间。地址级不完整（`?window=custom` 缺 from/to）继续走既有 `aud01-custom-hint`/`aud01-custom-error`：零请求、校验与导出同禁用，不退化成全表扫描。
- **`audB-scope-note`（这条是真话，不是免责模板）**：服务端**吃** `from`/`to`，所以界面写「这一段由服务端按起止时间过滤（from/to 直接进请求），筛的是整个区间的账本，不是只在这页已加载的行里挑」；草稿未应用时同一条改说「这一段还没应用：应用后由服务端按起止时间过滤……」。证据承自本节 X1 #2/#8/#9/#18 与 R34 活体（24h→200/0 条、7d→200/50、custom 三日 slice→200/47、倒置→400 `request.invalid_query`）。工单给的「后端暂不支持自定义时间过滤」退路**不成立**，故未使用；`since`/`until` 从来不是本路由的参数（X1 记录 `event_type` 类被接受但被忽略的拼法一个都不发），本页只发 `from`/`to`。
- **空匹配**：自定义区间读到 0 条 → 界面「该时间段内无事件——这个起止区间里没有审计事件」（`aud01-empty` 未改名）+ 出口 `audB-empty-exit`/`audB-empty-clear`「清空区间，回到最近 7 天」，点它：地址回 `window=7d` 且 `from/to` 清除、重取恰一次、按压缩回 7d。非自定义档的空读仍走原句，出口同在（写的是「这一档里没有记录」）。
- **组合与复现**：`?window=custom&from=&to=` 与 `type/actor/resource/cursor 栈/preview/detail` 同屏共存，冷挂载一条组合地址即复现：区间输入回填北京时间（09:00/10:30 ← ISO 01:00Z/02:30Z）、`aud01-filter-window-custom` 为 true、类型与操作者下拉回填、`第 3 页`、预览展开、`aud8-state-line` 显示「自定义（…）」，且这条冷挂载只发 **1** 次列表读。切条件重取计数（测试内 fetch 计数，只数 `/agent-api/api/audit?`）：快捷档 1、类型 1、操作者 1、下一页 1、上一页 1、应用区间 1、再应用 1、清空区间 1；打字 0、展开/收起预览 0、开详情 0。
- 总数口径未动：服务没带回 total 时 `aud2-total` 仍「总数不可用」+ title 原因；带回仍用真值。四态+每态 rid+重试、403≡404 同体、零写入口均无用例回退；三档布局本轮只做了结构约束（新增节点全部 `min-w-0 flex-wrap`，区间说明独占一行 `basis-full`），浏览器像素走查未跑（见下活体腿），不声称已验。
- 新增 testid：`audB-from` `audB-to` `audB-apply` `audB-clear` `audB-range-error` `audB-scope-note` `audB-empty-exit` `audB-empty-clear` `aud01-filter-window-<key>`（按钮组子钮，容器 id 不变）。aud01-*（含 aud01-custom-window/-from/-to/-error/-hint）、aud2/3/4/5/6/7/8/9/A-* 与页级 `agent-v2-page-audit*` 零破。
- 门禁：vitest `src/modules/audit` **exit 0**（10 files / **203** tests = 基线 197 + 6）；`tsc -b . --noEmit` 共 55 errors（merge 后实测地板 55，改动前后同数）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings（新增一条 exhaustive-deps 提示已用 useMemo 消掉，未放宽任何规则）。
- 活体腿未跑通（本轮实测，未假装）：工单点名的 `/agent-api/api/audit-events` 在本机两个端口都探不到台账语义——`127.0.0.1:9122/agent-api/api/audit-events?limit=50&from=…&to=…` → **401 `console.unauthenticated`（rid 8cc1fbaf）**；同端口 `…&since=…&until=…` 走 `audit` 路径 → **401（rid 864bf912）**；`127.0.0.1:8092/agent-api/api/audit-events?limit=5` → **404 `console.not_found`「static asset not found」**（该实例没挂 `/agent-api` 台账路由）。本车道没有可用会话凭据（禁重建 9122），故拿不到本轮的筛前/筛后条数；服务端支持 from/to 的结论沿用 X1 #2/#8/#9/#18 与 R34 的活体读数，自定义区间的行为证据来自测试腿（同一 mock 下的 from/to 对、区间跨度 `spanOf` 精确到毫秒、倒置零请求）。

## Audit event summary copy (audC, 2026-11-20, base cb6b6437)

- 写域：`web/src/modules/audit/{summary.ts,summary.test.ts,states.tsx,views.tsx,AuditEventsModulePage.test.tsx,AuditDetailModulePage.test.tsx}` + 本节。App.tsx / shell / routes / registry / package·lock / web scripts / ops 未碰。
- **一个构造器，两处同一句**：新增 `summary.ts` 拥有唯一结论行构造 `summaryLineOf/summaryFromRow/summaryFromDetail`，字段序固定 `时间（北京时间到秒）· 操作者 · 动作 · 资源 · 请求编号`；行内预览（aud6）与详情（aud3 / 抽屉）各渲染同一个 `SummaryCopy` 控件（states.tsx），分别喂 `summaryFromRow(row, beijingSeconds(raw) ?? occurredAt)` 与 `summaryFromDetail(detail, 同一表达式)`。用例的证法不是比字符串常量，而是**点两处控件、比 clipboard 实际收到的两次写入**：`calls[0] === calls[1]`（同事件完整态、缺 rid 态、缺时间态各一组）。字段取值仍走 audA 已统一的同一出口（`actionView/actorView/resourceOf/requestIdOf/beijingSeconds`），所以「两处不同值」这条路从源头被堵住。
- **只读屏上已有数据，禁二次请求**：控件只吃已渲染的 row/detail，构造不发任何请求。用例贴计数：预览侧复制前后 `urls()` 长度不变；独立详情屏复制前后 `urls()` 不变（1 次 detail 读）；剪贴板被拒后的兜底也不发（`urls()` 仍不变）。
- **三档缺失口径**：缺 rid → 该行最后一格写「该字段未返回」（不写 0、不留空）；缺时间 → 第一格「该字段未返回」，其余照旧；actor/资源/动作的空标签同样落「该字段未返回」，构造器断言不出现 `· ·`、结尾悬空分隔符或 `undefined/null/NaN`。屏上的字段格仍是 audA 口径（时间缺失显示 `—` + title「服务未提供该时间」，rid 走 `CopyValue` 的「未提供」）——复制行是给粘出去的文本，用同一句「该字段未返回」说缺失，两套口径的映射在此写明，避免下轮误读成不一致。
- **剪贴板与播报**：`navigator.clipboard.writeText` 优先；成功 → `aria-live="polite"` 的 `audC-copy-status` 播报「已复制」（用例断言属性与文本）；写被拒或环境不给力（`copyTextToClipboard` 的整体兜底也失败）→ status 改说「剪贴板不可用，这一行可以直接选中复制」并挂出只读 `audC-fallback` textarea，`value` 与送进剪贴板的字符串逐字符相等（用例断言 `box.value === calls[0]`），聚焦即全选。jsdom 无 clipboard，用例显式把 `window.isSecureContext` 置 true 后打真路径（成功腿与拒绝腿各一条）。
- rid 处理：`rid` 非秘密，按工单允许进复制行；沿用本页既有口径——屏上 `CopyValue` 的短码形与全值 title 不变，复制行走同一构造，不再另造一份编号写法。
- 四态与零破：拒绝/404/403 与错误面板里没有复制控件（用例锁：denied 屏上 `audC-copy` 为 null，屏幕上也没有「复制结论行」这句话——不给读不到的东西提供复制）。`aud01*/aud2*/aud3*/aud4*/aud5*/aud6*/aud7*/aud8*/aud9*/audA*` 与页级 `agent-v2-page-audit*` 全部未动、未改名；新增只有 audC-*。三档视口：新节点全部 `min-w-0 flex-wrap`、textarea `w-full` + `break-words`，未做浏览器像素走查（活体腿不可用，见下），不声称已验。
- 新增 testid：`audC-copy`（两处各一，控件本身）`audC-copy-status`（aria-live 播报）`audC-fallback`（只读兜底 textarea）`audC-copy-block`（每条腿的容器）。
- 门禁：vitest `src/modules/audit` **exit 0**（**11** files / **216** tests = 基线 10/203 + 13：`summary.test.ts` 4 条构造锁 + 预览/详情腿 6 条 + 独立详情屏 3 条）；`tsc -b . --noEmit` 共 55 errors（本机地板 55，改动前后同数）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings。
- 活体腿未跑通（本轮实测，未假装）：`127.0.0.1:9122/agent-api/api/audit?limit=5&from=&to=` → **401 `console.unauthenticated`（rid 30acdcd1）**；`…/agent-api/api/audit-detail?id=ev_2BAA…` → **401（rid edbdb03e）**；`127.0.0.1:8092/agent-api/api/audit?…` → **404 `console.not_found`「static asset not found」**（该实例没挂台账路由）。本车道没有可用会话凭据且禁重建 9122，所以「两处文案一致」没有浏览器并排截图，证据为上面 clipboard 双写等值断言。

## Audit type distribution filtering (audD, 2026-11-20, base d31c671d)

- 写域：`web/src/modules/audit/{views.tsx,AuditEventsModulePage.tsx,AuditEventsModulePage.test.tsx}` + 本节。App.tsx / shell / routes / registry / package·lock / web scripts / ops 未碰。
- **桶即筛选**：aud7 类型分布的每一桶从「静态行」变成真 `<button>`（`audD-bucket-<类型原值>`），带 `aria-pressed`（当前地址的类型与原值相同则为 true）、`title` 写明按哪一类去读、`focus-visible:outline-2` 焦点环、`onClick` 与 `onKeyDown`(Enter/Space，`preventDefault` 防浏览器再合成一次 click 造成二次切换)。面板顶部加一句口径 `audD-filter-hint`：点一个桶就按这一类去读、再点一次回到全部类型、计数只数这一页已加载的记录。折叠开关 `aud7-types-toggle/-panel/-row/-count/-share` 与桶 id 家族全部保留。
- **参数口径（工单点名 `?action=<type>`，实落浏览器键 `?type=`，原因如实登记）**：本模块的类型筛选是单一事实源——浏览器地址用 `?type=`（aud8/aud9/audB 的 URL 复现、`aud8-state-line`、既有 20+ 用例都认这个键），上线参数是 `action=`（服务只认 `action`，`event_type`/`type` 被接受但被忽略，见 X1 #3/#4）。桶点击走的是**同一个 `setType`**，所以点完：地址 `?type=task.created`、请求 `…&action=task.created`（用例逐条断言）。若再开一个 `?action=` 浏览器键，就会出现两个键各筛各的假联动，故未采用；工单要的效果（以该类型设服务端 action 筛选、URL 可复现）在两条腿上均成立。
- **重取恰一次 + 组合**：请求计数只数 `/agent-api/api/audit?`——点桶 1 次（含 Enter、Space 各一条）、再点已按下的桶回全量 1 次、空集出口清类型 1 次；与 `window/actor/resource` 组合时其它参数原样保留、`cursor` 栈被丢弃并回到 `第 1 页`（`setType` 沿用 aud8 的 resetPagingAndFolds），上线请求同带 `from/to + actorId + resourceId + action`。冷挂载 `?window=7d&type=task.created` 复现：1 次读、下拉回填、桶 `aria-pressed=true`、列表 3 条、`aud8-state-line` 显示「类型：task.created」。
- **同源性实测（不是口头）**：用一个真按 `action` 过滤的 mock 服务（非筛选请求回 4 条、筛选请求回该类记录）断言「桶计数 === 点完后的列表条数」（task.created 桶 3 → 屏上 3 行、`aud01-status` 说「已显示 3 条」）。桶的键取 `row.action.raw ?? row.action.label`，与上线的 `action` 值是同一个原值，因此计数与筛选不可能各说各话。
  口径登记：桶计数仍是 aud7 的**本页已加载**口径（面板右上「按已加载的 N 条统计」+ title 写明不是整窗全量），服务端 total 缺席时 `aud2-total` 继续「总数不可用」；所以「桶计数=点后条数」在同源 mock 下精确成立，真服务在跨页时只保证「本页内同源」，不声称等于整窗总数——本轮无身份头，拿不到活体条数（见下）。
- **筛选值不在采样类型表里时不装没事**：`?type=`（含桶点击）带的原值若不在 `eventTypeChoices()` 采样表内（例如 `quantum.recalibration`），事件类型下拉补一条「按地址带入的类型」并回填该原值，用例断言 option 文案与 value，避免地址在筛、界面显示「全部事件类型」。
- **空集**：点了桶而这一类在当前窗/页里没有记录 → `audD-empty-exit`「该条件下无事件——这个类型在当前的时间窗与页里没有记录。」+ `audD-empty-clear`「清掉类型筛选，回到全部类型」，点击后地址丢 `type=`、重取恰 1 次、回到 4 条；`aud01-empty` 与 audB 的区间出口各自表 own 条件，不混用。
- **焦点闭环**：点桶会让承载该按钮的那批行整体换掉（读期间面板按 aud7 既有口径不渲染桶），所以 Enter 之后焦点会掉。新增 pending+settled 两个 ref：拾取时记下原值，请求进入 loading 置 settled，回答落地（非 loading）后把焦点交还给被按下的桶，若该类没有记录就交给空集出口；用例分别断言 Enter 后 activeElement 为 `audD-bucket-task.created`、Space 后为 `audD-bucket-run.failed`。
- 三档/四态：加载中无桶（`aud7-types` 与 `audD-bucket-*` 都不存在）、就绪有桶且默认无按下、拒绝（403）无桶无行——各一条用例；denied/error/empty/ready 与每态 rid、403≡404 同体、零写入口均未动。
- 新增 testid：`audD-bucket-<原值>` `audD-filter-hint` `audD-empty-exit` `audD-empty-clear`。`aud01*`/`aud2*`/`aud3*`/`aud4*`/`aud5*`/`aud6*`/`aud7*`/`aud8*`/`aud9*`/`audA*`/`audB*`/`audC*` 与页级 `agent-v2-page-audit*` 零破（未改名、未删节点，既有 216 条用例全绿）。
- 门禁：vitest `src/modules/audit` **exit 0**（**11** files / **226** tests = 基线 11/216 + 10）；`pnpm exec tsc -b . --noEmit` 共 **58** errors —— 本机 stash 实测当前地板即 58（工单所记 55 是 wave-18 之前的值，本轮改动前后同数、增量为 0）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings。
- 活体腿未跑通（沿用已知环境，未假装）：9122 无身份头对 `/agent-api/api/audit` 与 `/agent-api/api/audit-detail` 回 **401 `console.unauthenticated`**（本轮复测 rid 30acdcd1 / edbdb03e），8092 对 `/agent-api/api/audit*` 回 **404 `console.not_found`**；本车道无会话凭据且禁重建 9122，因此「桶计数=点后条数」「点桶 1 次」的读数是 vitest 计数腿证据，不是活体读数。

## Audit event permalink copy (audE, 2026-11-20, base 5ab0da7a)

- 写域：`web/src/modules/audit/{permalink.ts,permalink.test.ts,states.tsx,views.tsx,AuditEventsModulePage.test.tsx,AuditDetailModulePage.test.tsx}` + 本节。App.tsx / shell / routes / registry / package·lock / web scripts / ops 未碰。上游 159 文件改动全在本模块之外（`git diff 59915057..HEAD -- web/src/modules/audit` 为空，已核）。
- **深链实名（先 git grep 再写）**：本模块真正在读的是 `?event=<eventId>`（`AuditEventsModulePage.tsx:641` `params.get("event")`；`resetPagingAndFolds`/`setFold`/`clearFold` 同键；aud9 起它是 `?preview=` 的深链拼法，命中即定位并展开那一行）。`?detail=` / 遗留 `?id=` 是「打开整条记录」的另一套；独立详情屏 `/audit/detail` 读 `detail`|`id`（`AuditDetailModulePage.tsx:34`），**不读 `event`**。因此固定链接落在列表页：`<origin>/audit?event=<eventId>`——它才是能「回到同一事件」并把它展开的那一屏。构造器在新文件 `permalink.ts`（`AUDIT_PATH`/`DEEP_LINK_PARAM`/`eventPermalink`/`permalinkFromEvent`），与视图分离，可单测；`views.tsx` 两处挂载点用的都是它。
- **两处控件**：行内预览（aud6，`AuditRowPreview` 内）与记录体（aud3，`AuditEventDetailBody` 内，抽屉与独立详情屏共用同一组件所以两处都有）各挂一个 `PermalinkCopy`（states.tsx，与 audC 的 `SummaryCopy` 同套路同族 testid）。按钮 `audE-link`、播报 `audE-link-status`（`aria-live="polite"`，成功文案「链接已复制」）、拒绝兜底 `audE-link-fallback`（只读 textarea，`value` 与送进剪贴板的串逐字符相等，聚焦即全选）。
- **只读屏上已有 eventId，禁二次请求**：链接只由已渲染的 `row.rawId` / `detail.rawId` 拼出。用例贴计数：预览+详情两处各点一次，`urls()` 长度不变（12 files/242 tests 全绿里三条独立断言：两处一致性、剪贴板拒绝腿、详情屏腿）。
- **缺标识不编造**：没有 `eventId` 的行（`{action, occurredAt, outcome}` 无标识 → `row.rawId === null`）里 `audE-link` `disabled` + `aria-disabled=true` + `title=「该行没有可用的固定标识」`，点击不写剪贴板（spy 计数 0）、不出 textarea、status 仍空；独立详情屏同（回答里没有标识的 audit 体）。
- **粘链接回位（实测证据）**：复制得到的 `http://<origin>/audit?event=evt_link_0000000001` 拆出 `pathname+search` 原样冷挂载 → `aud9-deeplink-found` 出现、`aud6-preview-evt_link_0000000001` 展开、`aud01-row-evt_link_0000000001` 在屏上，即回到同一事件。
- **不可达档如实登记（不假称可达）**：`?event=` 落在列表页且不带筛选，只在这份响应的记录里定位。用例分别锁三档——① 事件在本页：定位展开（上面的回位腿）；② 事件在服务端有、但不在这一页/这一筛：`aud9-event-elsewhere`「这条事件在服务端还在，只是不在当前页或当前筛选里」+ 现有最接近入口 `aud9-event-open`「直接打开它」（走 `?detail=` 真读），本屏不展开该行的预览；③ 服务对这个标识回读不到（403/404 同体）：`aud9-event-missing`「该事件不存在或已过期」。gap 说明：独立详情屏不认 `?event=`，粘到 `/audit/detail?event=…` 会显示「没有 id」的入口提示而不是假装定位——本轮没有改那条读口（写域外的 shell/routes 未碰，且列表页腿已满足工单的「回到同一事件」）。
- **一致性/零破**：`aud2*`/`aud3*`/`aud4*`/`aud5*`/`aud6*`/`aud01*` 与 `aud7*`/`aud8*`/`aud9*`/`audA*`/`audB*`/`audC*`、页级 `agent-v2-page-audit*` 全部未改名未删节点；403 台账下不出现任何复制控件（`text()` 里没有「复制事件链接」，用例锁），403≡404 同体在两处都验（详情屏两处 outerHTML/textContent 相同）。
- **三档（视口）**：新增节点沿用同族结构——容器 `flex min-w-0 flex-wrap items-center gap-2`、按钮走 `Button size="sm" outlined`、textarea `w-full min-w-0 break-all`；未做浏览器像素走查（活体腿不可用，见下），不声称已验。工单口径下的字段三档（有标识 / 缺标识 / 剪贴板被拒）各有用例。
- 新增 testid：`audE-link` `audE-link-status` `audE-link-fallback` `audE-link-block`。
- 门禁：vitest `src/modules/audit` **exit 0**（**12** files / **242** tests = 基线 11/226 + 16：`permalink.test.ts` 5 条构造锁 + 列表页 7 条 + 详情屏 4 条）；`pnpm exec tsc -b . --noEmit` 共 **58** errors（= 本机当前地板，改动前后同数、增量 0）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings。
- 活体腿沿用已知不可用实测（未重跑）：9122 无身份头 → **401 `console.unauthenticated`**、8092 → **404 `console.not_found`**；本车道无会话凭据且禁重建 9122，故回位与计数证据均为 vitest 腿 + URL 构造复现。

## Audit unified states (audF, 2026-11-20, base d0174d8c)

- 写域：`web/src/modules/audit/{stateCopy.ts,stateCopy.test.ts,states.tsx,views.tsx,copy.ts,AuditEventsModulePage.tsx,AuditDetailModulePage.tsx,AuditEventsModulePage.test.tsx,AuditDetailModulePage.test.tsx}` + 本节。App.tsx / shell / routes / registry / package·lock / web scripts / ops 未碰。基线复测：显式 refspec fetch + `git merge origin/lane/hermes-console` → Already up to date（tip 已在 HEAD 内），porc=0。
- **单一状态文案源**：新增 `stateCopy.ts`。五档标签唯一：`正在读取 / 该条件下无事件 / 这个读口在本环境未接入 / 读取没有完成 / 暂时无法查看审计事件`；`stateMark(slot, phase)` → `audF-state-<list|preview|detail|verify>-<phase>`。标记是**空 span + 属性**（`data-audf-label/slot/phase`），故意不带可见文字：状态标记不许改变面板的话（否则 403/404 同体会被我自己写脏）。
- **原因句本来就同源，本轮把它钉住**：三处的失败原因句都出自 `copy.ts:readFailure()`（`FailureCopy` 新增可选 `status`，只为判别，绝不上屏）。用例 `one failure, three surfaces, one sentence` 用同一个 503 分别打到列表读口与详情读口，断言 `aud01-error-sentence`、`aud02-detail-error-sentence`、`audF-preview-error-sentence` 三处文本逐字相等，且各自都带 `-request-id-value`（可复制 rid）与「重试」。
- **取舍登记（既有用例零破优先）**：面板的**标题**仍是各自对象的措辞（列表「审计事件没能加载出来」/详情「这条事件没能加载出来」），因为既有 242 条用例逐句钉着它们；工单要的「同一失败同一句原因」落在**原因句**上，已按上述断言统一。若强行统一标题必然改动既有用例断言，未做。
- **行内预览不再自成一套话**：预览腿此前没有任何状态面板。现在 `AuditRowPreview` 接收 `record`（该行自己「打开详情」所对应的那一次 detail 读），非 ready 时直接复用同一批组件（`LoadingPanel`/`DeniedPanel`/`ErrorPanel`，testId `audF-preview-loading|denied|error`，slot="preview"）——同一事件的同一失败，在预览里与在右侧详情里是同一句、同一 rid、同一重试。预览无独立读口，因此不编造第三套状态；它的「空」就是行本身不可读（既有「缺少可显示的内容」计数口径不变）。
- **重试只重发该读口恰一次（分读口计数）**：用例按前缀分别计数 `/agent-api/api/audit?`、`/agent-api/api/audit-detail`、`/agent-api/api/audit-verify`——列表重试 = 台账 +1、详情 0、校验 0；预览重试与详情重试 = detail +1、台账 0；详情屏重试 = detail +1。校验未启用腿另有 rid 与「再运行一次」（沿用 aud 系列既有口径）。
- **denied 保留筛选/页码/地址可复原**：`DeniedPanel` 新增可选 `onRetry`（「再读一次」+ 一句「筛选、页码与地址都还在原处」，`aud01-denied-retry-block` / `aud02-detail-denied-retry-block`）。用例：带 `window=24h&type=task.created&actor=employee-api&cursor=cur_page2&preview=evt_7c1f…` 被 403 拒 → 断言地址一个键都没丢、面板上不残留行；恢复服务后点「再读一次」→ 台账 +1 次、回到 `第 2 页`、`?preview=` 那行的预览仍在。
- **空态两分**：① `audF-state-list-empty`＝服务真回答 0 条（界面句仍是 audB/audD 已钉的「该条件下无事件/这个时间窗里没有审计事件」，用例锁「该时间段内无事件」与「无事件」两种句式与去处）；② `audF-state-list-unwired`＝读口不在这套环境里：仅当 404 的回答点名 `console.unknown_route`/「static asset not found」才判为未接入（记录级 `audit.event_not_found` 与 403 都**不**算），未接入原因与去处只进 `title` 与标记，面板正文仍是 403≡404 那一份 body（用例断言两种状态码 textContent 完全相等，且未接入腿里既没有 `aud01-empty` 也没有「0 条」「无事件」句式）。校验面的「本环境未启用」腿补同一标记族 `audF-state-verify-unwired`，原因句与去处、rid 齐。
- **零破**：`aud01*`/`aud2*`–`aud6*`/`aud7*`/`aud8*`/`aud9*`/`audA*`/`audB*`/`audC*`/`audD*`/`audE*` 与页级 `agent-v2-page-audit*`、`agent-v2-page-audit-detail*` 全部原样；本轮只新增属性、新增 span、新增可选 props 与新增面板出口。四态既有断言（含 403≡404 同体、零写入口）一条未红。
- 新增 testid：`audF-state-{list,preview,detail,verify}-{loading,empty,unwired,error,denied}`（标记，属性带标签）、`audF-preview-loading|denied|error`、`<panel>-sentence`（原因句锚点，列表/详情/校验三处同一句的断言点）、`aud01-denied-retry-block`、`aud02-detail-denied-retry-block`。
- 三档：状态面板全是既有 `Card/CardContent` + `min-w-0 flex-wrap`/`break-words`，新增出口按钮走同一 `Button size="sm"`；本轮未做浏览器像素走查（活体腿不可用，见下），不声称已验三档无横溢。
- 门禁：vitest `src/modules/audit` **exit 0**（**13** files / **256** tests = 基线 12/242 + 14：`stateCopy.test.ts` 4 条 + 列表页 audF 6 条 + 详情屏 audF 3 条 + 预览共句 1 组内含）；`pnpm exec tsc -b . --noEmit` 共 **58** errors（= 本机地板，改动前后同数、增量 0）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings。
- 活体腿沿用不可用实测（一行带过，未重跑）：9122 无身份头 **401 `console.unauthenticated`**、8092 **404 `console.not_found`**；本车道无会话凭据且禁重建 9122，故四态与重试计数证据均为 vitest 腿（分读口 mock 计数），未假装活体。

## Audit filter summary copy (audG, 2026-11-20, base 37c6b8b4)

- 写域：`web/src/modules/audit/{filterSummary.ts,filterSummary.test.ts,states.tsx,useAuditData.ts,AuditEventsModulePage.tsx,AuditEventsModulePage.test.tsx}` + 本节。App.tsx / shell / routes / registry / package·lock / web scripts / ops 未碰。基线复测：显式 refspec fetch + `git merge origin/lane/hermes-console` → Already up to date（tip b797bc98 已在 HEAD 内），porc=0。
- **控件**：筛选条与地址状态下方一行 `audG-filter-copy-block`，按钮 `audG-filter-copy`（「复制当前筛选条件」）、播报 `audG-filter-copy-status`（`aria-live="polite"`，成功文案「筛选条件已复制」）、拒绝兜底 `audG-filter-copy-fallback`（只读 textarea，`value` 与写进剪贴板的串逐字相等，聚焦全选）。套路与 audC 结论行 / audE 固定链接同族（同一个 `copyTextToClipboard` 路径，独立件 `filterSummary.ts` 一处构造）。
- **摘要口径（字段序=筛选条顺序）**：`时间窗 → 动作类型 → 操作者 → 资源 → 页码 → 这一页实际请求的相对路径`。样例（用例逐字钉住前后半段）：
  `时间窗：最近 24 小时 · 动作类型：task.created（服务端按 action 精确匹配） · 操作者：employee-api（服务端 actorId，机器句柄） · 资源：ap_1122334455667788（本页已加载的记录里本地匹配，服务端 resourceId 效果未单独实测） · 第 3 页（游标 ×2） · 请求：/agent-api/api/audit?limit=50&action=task.created&from=…&to=…&actorId=employee-api&resourceId=…&cursor=cur_page2`
  措辞与既有事实一一对应：URL 侧键 `type=` 上线即 `action=`（audD 单一事实源）；`?actor=` 上线即 `actorId=` 且服务端生效（探针 #11：200/50 行命中）；资源仍只在本页已加载记录里本地匹配（audB 口径），摘要文本直接把这条例说出来，不让人误以为是服务端整窗筛选。
- **缺项一律「未设置」**：`动作类型/操作者/资源` 没选 → 「未设置」，且不带后面的解释括号（没选就没什么可解释）；自定义区间只填一头 → `自定义 2026-11-17T09:00 → 未设置（北京时间）`。
- **默认窗口的口径（本单裁定，如实登记）**：只有默认「最近 7 天」、`type/actor/resource` 都空、且 cursor 栈为空时＝没有可分享的口径 → 按钮 `disabled` + `aria-disabled=true` + `title=「当前没有筛选条件可复制」`，点击不写剪贴板（spy 计数 0）。默认窗口是任何人没碰页面时的初始态，粘它给同事等于没说话；而 `window=24h/30d/custom`、任一筛选、或已在第 2 页以后（游标栈非空）都算有口径。用例还断言：选一个类型后同一按钮立刻可用。
- **页码/游标**：写成 `第 N 页（游标 ×K）`，K=URL 里 cursor 参数个数；不裸贴游标值（游标在服务端是 opaque token，粘进工单没人能读，贴它只会误导）。
- **附带的相对路径＝真发过的那条**：`useAuditList` 现在把发出路径记进 state（`ListApi.askedPath`，经 `listUrl()` 同一个构造器，非页面自拼）；`safeRequestPath()` 再剥 origin（`^[a-z][a-z0-9+.-]*://…` 正则）并丢弃 `token/access_token/code/key/secret/session/password` 形状的参数。用例两路证明同源性：① `line` 里 `请求：` 之后一段与 mock 实收的最后一条 `/agent-api/api/audit?…` 逐字相等（含 `action/actorId/cursor`）；② 摘要不含 `http(s)://`、不含 `localhost`、不含 `token/session` 字样，且以 `/agent-api/api/audit?` 开头。自定义区间不完整或倒置时那一问根本没发过：`askedPath` 强制置空 → 摘要写 `请求：未设置`，用例断言该腿里连 `agent-api` 都不出现（不拿上一个合法窗口的旧路径冒充）。
- **零额外请求**：构造、复制、兜底开合都不发请求。用例分读口计数（`/agent-api/api/audit?`、`audit-detail`、`audit-verify` 三个前缀各自计数）：复制前后三个数全不变；默认窗口 disabled 腿点击后仍不变；剪贴板被拒腿（textarea 出现）计数不变；摘要控件本身不触发任何读。
- **三档口径**：loading 与 denied（403/404）都不出摘要块——问题还没答上来时没有可分享的口径，被拒的台账也不配一句「你的筛选是……」；ready 出；empty 也出（空表是真回答，口径值得转给别人，用例锁 `aud01-empty` 与 `audG-filter-copy` 同时在屏上）。既有四态与 403≡404 同体、每态 rid、零写入口均未动。
- **零破**：`aud01*`/`aud2*`–`aud6*`/`aud7*`/`aud8*`/`aud9*`/`audA*`/`audB*`/`audC*`/`audD*`/`audE*`/`audF-state-*` 与页级 `agent-v2-page-audit*` 原样；本轮只新增文件、新增可选 state 字段与新增控件。既有 256 条一条未红（改动中一度把 `askedPath` 记在 ref 里读于 render，触发 eslint「Cannot access refs during render」两条新警告，已改为随读态存储，警告回到 4 条既有值）。
- 新增 testid：`audG-filter-copy` `audG-filter-copy-status` `audG-filter-copy-fallback` `audG-filter-copy-block`。
- 三档视口：摘要行沿用既有 `min-w-0 flex-wrap` + `break-words`，兜底 textarea `w-full min-w-0 break-all`；未做浏览器像素走查（活体腿不可用），不声称已验。
- 门禁：vitest `src/modules/audit` **exit 0**（**14** files / **266** tests = 基线 13/256 + 10：`filterSummary.test.ts` 4 条 + 页面 audG 6 条）；`tsc -b . --noEmit` 共 **58** errors（= 本机地板，改动前后同数、增量 0）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings。
- 活体腿沿用不可用实测（未重跑）：9122 无身份头 **401 `console.unauthenticated`**、8092 **404 `console.not_found`**；摘要与路径同源性证据为 vitest 腿（同一 mock 实收 URL 逐字比对）。

## Audit page size selector (audH, 2026-11-20, base cca9cf7e)

- 写域：`web/src/modules/audit/{api.ts,model.ts,useAuditData.ts,AuditEventsModulePage.tsx,filterSummary.ts,AuditEventsModulePage.test.tsx,api.test.ts,filterSummary.test.ts}` + 本节。App.tsx / shell / routes / registry / package·lock / web scripts / ops 未碰。上游本波未触碰本模块（`git diff` 到 `web/src/modules/audit` 为空，已核）。
- **选择器**：`audH-page-size` = 原生 `<select>`（`aria-label="每页条数"`，选项 25/50/100 条），一个组件两处家：分页条里（可交互）与空答案那一处（disabled + title「这个筛选下没有事件，每页条数暂时用不上」）。加载中与被拒（403/404）两处都不出现该控件（沿用 audF 的统一口径：没答上来的问题没有可分享的读法）。
- **落 URL 与组合**：`?limit=` 与 `window/custom from-to`、`type`、`actor`、`resource`、`cursor` 栈同屏共存；冷挂载 `/audit?window=custom&from=&to=&type=task.created&actor=employee-api&resource=ap_1&limit=25` 复现：控件回填 25、首读命中 `limit=25`、同一条请求里 `action/actorId/from` 齐、只发 1 次。摘要同源不回归：audG 的 `请求：` 段仍与 mock 实收 URL 逐字相等，并在页码之后多了一格「每页 N 条」（生效值，非愿望值）。
- **切条数重取恰一次**：`setPageSize` 写 `?limit=` 并走 aud8 的 `resetPagingAndFolds`（游标栈清空 + 两个折叠落回第 1 页）；用例按 `/agent-api/api/audit?` 前缀计数：切 100 后 `before + 1`，`limit=100` 出现在实收请求里，`aud2-page` 从「第 3 页」回到「第 1 页」。
- **非法/超大值如实回显（不发出去）**：`readPageSize()` 只认 25/50/100；`?limit=999`（不在档位）、`abc`/`0`/`-5`（根本不是条数）一律按默认 50 读，并把真相写在 `audH-clamp-note` 与控件 title 里：「地址里写的是每页 999 条，这一档不在本面板可请求的档位（25/50/100）里，所以没有把它发出去，当前按每页 50 条读。」用例三条（999/abc/0）都断言实收请求 `limit=50`、不含 `limit=<原写值>`、控件显示 50。不 500、不白屏、不假装服务答应了。
- **服务 clamp 的生效值回显**：`api.PAGE_SIZE_KEYS`（`limit/pageSize/page_size/effectiveLimit/effective_limit`，页体、包裹层与 `meta/pageInfo/pagination` 都找）解析出 `AuditPage.pageSize` → `ListApi.servedLimit`；控件显示的是**回答声明的生效值**，note 写「请求按每页 100 条发出，服务这一页带回的是每页 50 条（回答里写明的生效值），控件已按生效值回显」，`selectedOptions[0].text` 仍是「50 条」。生效值不在档位里时（例如带回 30）追加一个真选项「服务带回 30 条」，不把显示掰回愿望值。
- **服务没带回生效值时禁假称**：`servedLimit === null` 且实收条数 < 请求条数 → note 只报屏上真有的两个数：「服务没有带回这一页按多少条读；请求路径写的是 limit=50，屏上实收 30 条 —— 这里只报这两个数，不替服务认一个生效值。」控件仍显示请求值（那是唯一事实）。`AuditPage.total` 口径未动：带回 total 用「共 N 条」+ title 说明来源，缺则「总数不可用」+ title「服务没有给出总数；游标分页不能自算总数…」，本轮用例锁住这一条不回归。
- **零破**：`PAGE_LIMIT=50` 仍是默认与导出（`fetchList` 新增可选 `limit` 形参，默认取它），既有断言 `limit=50` 形态的请求逐字不变；`aud01*`/`aud2*`（含 `aud2-pagination`、`aud2-page`、`aud2-total`、`aud2-prev`、`aud2-next`）/`aud3*`–`aud6*`/`aud7*`–`audG*` 与页级 `agent-v2-page-audit*` 未改名未删节点；基线 266 条一条未红。新增 testid：`audH-page-size` `audH-clamp-note`。
- 三档视口：选择器与 note 沿用 `min-w-0 flex-wrap` + `break-words`，容器仍是既有分页条；未做浏览器像素走查（活体腿不可用），不声称已验。
- 门禁：vitest `src/modules/audit` **exit 0**（**14** files / **278** tests = 基线 14/266 + 12：`api.test.ts` audH 3 组 + 页面 audH 8 条 + `filterSummary.test.ts` 1 条）；`pnpm exec tsc -b . --noEmit` 共 **67** errors —— stash 前后实测同为 67（工单所记 58 已随 wave-19 漂移，本波上游把 `employees` 等模块的既有错误带上来了），**modules/audit 0、增量 0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings（中途 `useMemo` 依赖派生值多出 1 条 exhaustive-deps 提示，已把摘要改为渲染内直接构造、去掉 memo，警告回到 4 条；期间还修掉一次「render 里读 ref」的新警告）。
- 活体腿沿用已知不可用实测（一行带过，未重跑）：9122 无身份头 **401 `console.unauthenticated`**、8092 **404 `console.not_found`**；档位、clamp 回显与「不发出去」的三条证据都是 vitest 腿（按 `limit=` 真过滤/真回 meta 的 mock + 请求计数），未假装活体。

## Audit distribution and export set parity (audI, 2026-11-20, base eb05cbe9)

- 写域：`web/src/modules/audit/{csv.ts,views.tsx,AuditEventsModulePage.tsx,csv.test.ts,AuditEventsModulePage.test.tsx}` + 本节。App.tsx / shell / routes / registry / package·lock / web scripts / ops 未碰。基线：上游章面已并入，`git diff` 到本模块为空（orchestrator 代做，未重复 fetch/merge）。
- **同源链路本来就在一处，本轮把它钉住**：`typeGroups` 由 `visibleRows` 计数（audD 的可见集合）→ 桶点击走同一个 `setType`（地址键 `?type=`，上线参数 `action=`，与工单写的 `?action=` 是同一件事的两端，对应关系沿用 audD 登记）→ 导出与「已显示 N 条」也读 `visibleRows`。用例用**真按 action 过滤的 mock 服务**做三值对照：桶计数 2 → 点完 `aud01-status`「已显示 2 条」、`aud5-export-count`「将导出 2 条」、CSV 数据行 2（`lines()-1`），且每一行都是那一类（`创建任务`）；清掉桶回全量后三值再对照一次（3 / 3 / 3，文件名从 `task-created` 换成 `all`）。
- **实测发现并修掉一个真 bug（audI 的对照才暴露出来）**：aud5 导出把 `downloadText(name, text)` 的两个实参写反了（`downloadText(filteredCsvText(...), filteredExportName(...))`），于是**文件名变成整张 CSV 文本、文件内容变成文件名**——此前没有任何用例同时比对两头，所以一直没被发现。修正后用例两头都断言：`name` 匹配 `/^audit-[A-Za-z0-9._-]+\.csv$/`、首行是表头 `time,actor,action,resource,rid`。
- **`audI-scope-note`（分母诚实，二选一里选了如实的那条）**：分布块右上从「按已加载的 N 条统计」扩成带口径的一句——未筛类型时「按已加载的 N 条统计（不是整窗全量：这一页读到几条就数几条）」，`title` 写明「服务端没有按类型的聚合读口，也没有带回整窗总数；翻页或放宽时间窗后按同一口径重算」；已按某一类筛时改为「按已加载的 N 条统计（已按这一类筛，所以只剩这一个桶）」并在 `title` 说明这份只剩一个桶、不是整窗各类分布。选择「按已加载统计」而非服务端聚合的依据：`api.ts` 三条读口清单里只有台账/单条/校验，没有聚合路由，且活体读口本轮仍取不到凭据（见下），不冒充全量。
- **`audI-export-scope`（导出集合口径上屏）**：导出条下方一行明说——导出的就是屏上这一份；筛了类型时写「只含「创建任务」这一类，共 N 行」，与「已显示」和类型分布同一个集合；未筛时写「当前时间窗与筛选下的全部类型」；并声明文件名带齐时间窗/操作者/资源/动作/行数、时间为北京时间到分。
- **文件名快照**：新增 `filterSnapshotExportName(snapshot, now)` → `audit-<窗口>-<actor>-<资源>-<动作>-n<行数>-<YYYYMMDD>-<HHmm>.csv`（例 `audit-7d-all-all-task-created-n2-20261120-0647.csv`）；旧三 token 拼法 `filteredExportName` 保留并改为同一构建器的薄封装，既有断言逐字不变。折叠规则沿用 `asciiToken`（点分码 `task.created` → `task-created`）；本轮补上一条诚实细则：**有值但全非 ASCII（如把中文当句柄）折出空时不再冒充 `all`，写 `x`**，用例锁 `audit-7d-x-all-all-n1-…`；`n0` 也如实写（0 行就是 0 行，不藏）。
- **空集**：`aud5-export` 在无行时 `aria-disabled=true` + title「当前筛选无事件可导出」，点击不发任何请求（用例贴 `urls()` 前后长度相等），且分布整块不渲染（`total===0` 时 `aud7-types` 为 null）——没有行就没有可数的桶。
- **零额外请求**：桶点击那一读是唯一的新问题——展开分布、点导出、清掉桶之前，`/agent-api/api/audit?` 计数为 2（首读 + 桶筛选），`audit-detail` 0 次、`audit-verify` 0 次，用例逐条断言；分布展开/收起仍不改地址（audD 口径未动）。
- **零破**：`aud01*`（含 `aud01-export`/`aud01-status`）、`aud2*`–`aud6*`、`aud7-types*`（`-toggle/-panel/-row/-count/-share` 与桶 id）、`aud8*`/`aud9*`/`audA*`/`audB*`/`audC*`/`audD*`（`audD-bucket-*`/`audD-filter-hint`/`audD-empty-*`）/`audE*`/`audF-state-*`/`audG-*`/`audH-*` 与页级 `agent-v2-page-audit*` 全部原样；`audI-scope-note` 落在既有那只计数 span 上（文案仍含「按已加载的 N 条统计」，既有 aud7 用例照绿）。四态、每态 rid、403≡404 同体、零写入口、三档结构（新增行仍是 `min-w-0 basis-full break-words`）无回退；基线 266→286 条全绿。
- 新增 testid：`audI-scope-note`（分布口径）、`audI-export-scope`（导出集合口径）。
- 门禁：vitest `src/modules/audit` **exit 0**（**14** files / **286** tests = 基线 14/278 + 8：`csv.test.ts` audI 4 条 + 页面 audI 4 条）；`pnpm exec tsc -b . --noEmit` 共 **67** errors（= 本机当前地板，改动前后同数、增量 0）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings（中途一次把 BOM 写成正则字面量触发 `no-irregular-whitespace` + 一条类型多余属性，已改回 `\uFEFF`）。
- 活体腿沿用已知不可用实测（未重跑）：9122 无身份头 **401 `console.unauthenticated`**、8092 **404 `console.not_found`**；三值对照、文件名快照与「零额外请求」证据都是 vitest 腿（真按 `action` 过滤的 mock + Blob/anchor 双头捕获），未假装活体。

## Audit time and actor presentation (audJ, 2026-11-20, base e41976d5)

- 写域：`web/src/modules/audit/{timeActor.ts,timeActor.test.ts,views.tsx,AuditEventsModulePage.test.tsx,AuditDetailModulePage.test.tsx}` + 本节。App.tsx / shell / routes / registry / package·lock / web scripts / ops 未碰。基线：`git merge origin/lane/hermes-console` → Already up to date（章面已在 HEAD 内），porc=0。
- **同一 helper**：新增 `timeActor.ts`，导出 `auditTimeView(raw, minute)` 与 `auditActorView(person)`；三处（列表行 `AuditEventRowCard`、行内预览 `AuditRowPreview`、事件详情 `AuditEventDetailBody`——抽屉与独立详情屏共用同一组件）都改成只调这两个函数，屏幕不再各自拼字符串。views.tsx 里旧的模块内常量 `MISSING_TIME`（「服务未提供该时间」）随之下线，缺失口径由 helper 统一给出。
- **改前 / 改后（同一条 `evt_parity_00000001`，occurredAt=`2026-11-19T01:20:00Z`，actor=`{human, user:2f3a4b5c6d7e8f90, 李思}`）**：

  | 处 | 改前 时间 | 改后 时间 | 改前 操作者 | 改后 操作者 |
  |---|---|---|---|---|
  | 列表行 | `2026-11-19 09:20`（到分，旧代码 `value={row.occurredAt ?? "—"}`） | `2026-11-19 09:20:00` | `李思 · 6d7e8f90`（title=裸 id） | 同左（title 改为「服务标识 user:…（原始值只在这里给出）」） |
  | 行内预览 | `2026-11-19 09:20:00` | 同左 | `李思 · 6d7e8f90` | 同左 |
  | 事件详情 | `2026-11-19 09:20:00` | 同左 | `李思 · 6d7e8f90` | 同左 |
  即：本轮唯一的**值级不一致**是列表行到分、另两处到秒（工单点名的「不一致即修」），现三处逐字相同；用例 `one identical instant` 断言三处文本完全相等且匹配 `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$`。旧的 audA 精度对照用例（「两种精度」）已改为单精度等值断言，testid 一个未改名。
- **缺失态对照（同一 helper，同一条无 occurredAt 的记录）**：三处时间全部 `该字段未返回`，title 全部 `服务没有带回这条记录的时间；这里不拿浏览器时间顶替`；用例显式取当天日期串断言它不出现在三处读数里（禁补当前时间）。改前这里是三处 `—` + title「服务未提供该时间」——按工单口径统一为「该字段未返回」，audA 那条 `toBe("—")` 断言同步改为新句（testid `audA-preview-time`/`audA-detail-time`/`data-auda-parity` 保留）。操作者缺失（无名无标识）三处仍 `未指派`（aud01 既有行为契约），title 说明「服务没有带回这条记录的操作者」；只带 id 不带名字时三处一致为 `员工 · 5b4a3f21` 且 title 带完整 `employee:9f8e7d6c5b4a3f21`，用例断言可见文本里不出现 `user:`/`employee:`/`human:` 或完整 32 位 id。
- **title 的原值与时区标注**：可换算时为 `服务原值 <原文>（UTC）· 屏上为北京时间（UTC+8），精确到秒`；带回的是不可换算的自由文本（如 `yesterday evening`）时不谎称做过 UTC 换算，title 写「服务带回的原文是「…」，不是一个可换算的瞬间…到分钟/秒」。epoch 秒/毫秒字符串统一撑到毫秒再格式化（`1763515200` 与 `1763515200000` 读出同一瞬间），否则按 beijingSeconds 的毫秒解释会落到 1970 年——用例锁这一条。
- **零额外请求 / 零破**：两个函数纯读模型，不发请求；用例在开→关→开预览后断言 `urls()` 长度不变、`/agent-api/api/audit?` 仍只 1 条。`aud01*`、`aud2*`–`audI*`（含 `aud01-cell-*-time/-actor`、`audA-preview-*`/`audA-detail-*`、`aud6-preview-*`、`aud7-types-*`/`audD-bucket-*`、`audF-state-*`、`audG-*`、`audH-page-size`）与页级 `agent-v2-page-audit*`/`agent-v2-page-audit-detail*` 未改名未删节点；技术折叠里新增一行「发生时间（北京时间（UTC+8））：…」并把原值行改为优先引用带回的原始瞬间（折叠仍默认收起）。四态、403≡404 同体、三档结构（新标记是 `aria-hidden` 空 span，无布局影响）无回退。
- 新增 testid：`audJ-time-list-<key>` `audJ-actor-list-<key>` `audJ-time-preview` `audJ-actor-preview` `audJ-time-detail` `audJ-actor-detail`（值与 title 分别挂在 `data-audj-value` / `data-audj-title`，对照用；屏幕上的字仍是那一格本身，标记不复制可见文本）。
- 门禁：vitest `src/modules/audit` **exit 0**（**15** files / **299** tests = 基线 14/286 + 13：`timeActor.test.ts` 6 条 + 列表页 audJ 5 条 + 独立详情屏 audJ 2 条）；`pnpm exec tsc -b . --noEmit` 共 **67** errors（= 本机当前地板，改动前后同数、增量 0）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings。
- 活体腿沿用已知不可用实测（未重跑）：9122 无身份头 **401 `console.unauthenticated`**、8092 **404 `console.not_found`**；三处对照与缺失态证据为 vitest 腿（同一 mock 喂两条读口后逐字段比读数），未假装活体。

## Audit list keyboard navigation (audK, 2026-11-20, base 869e49ab)

- 写域：`web/src/modules/audit/{AuditEventsModulePage.tsx,AuditEventsModulePage.test.tsx}` + 本节（2 个源文件 + 证据文档，≤15 文件/≤1500 行）。App.tsx / shell / routes / registry / package·lock / web scripts / ops 未碰。基线：`git merge origin/lane/hermes-console` → Already up to date（章面已在 HEAD 祖先链），porc=0。
- **roving tabIndex**：列表外层 `audK-list`（`role="list"` + aria-label 把键位讲明），每行壳 `data-audk-row=<key>`、`role="listitem"`、`tabIndex = 当前行 0 / 其余 -1`；整表只占一个 Tab 停靠点。停靠点由页内 `rovingKey` 持有：`null`（还没进过表）→ 第一行接住，`onFocus` 随人移动；行不在本份数据里（换页、收窄筛选）时自动回落给新的第一行，不悬空。`audK-row-<key>` 标记镜像 `data-audk-roving` / `data-audk-open`，供探针读停靠点分布与展开态。
- **键位**：↑ ↓ 逐行移焦（`event.target !== currentTarget` 时让路：控件里的方向键仍是控件自己的，用例在 `aud01-filter-type` 上验证不被接管）、Home / End 到首末（越界不动、不发请求）、Enter 展开/收起**既有** `aud6-preview-*`（复用 audA 的 `setFold("preview")` 单开语义，一次按键只翻一行；shell 层 Enter 只在行本身被聚焦时生效，行内真按钮的原生 Enter 仍走原路径，无双翻）、Esc 收起并把焦点送回该行（实测 `document.activeElement === aud6-toggle-<key>`，且仍在该行的行壳内）。焦点环沿用现成 token `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`，未新增颜色。
- **aria-expanded 与可见性同步**：`aud6-toggle-*` 的 `aria-expanded` 继续由 `?preview=` 计算（aud8 落 URL 的口径），键盘链路里逐拍断言：Enter 后 `true` 且面板出现、再 Enter 后 `false` 且面板消失；其余行的面板根本不存在（单开）。
- **口径写明**：漫游停靠点与展开的行是两件事——↑↓ 移动不打开任何东西（用例断言移动后 `preview=` 仍是先前那一行、目标行 `data-audk-open=false`），Enter 才把折叠挪到新行；粘贴/刷新带 `?preview=` 回来时该行照旧展开、停靠点仍从第一行起（用例锁这一点）。这样键盘入口与展开态不会因上一次操作残留而互相抢。
- **展开不改筛选/页码/URL**：一整套 Enter/↑↓/Esc 之后，`window/type/actor/limit/cursor` 逐项与操作前相等，只有折叠自己的键在动（aud8 起折叠落 URL，故刷新可复现，沿用既有口径不拆）。
- **零额外请求（键盘全链路）**：`urls()` 在整套键盘操作前后**逐字相等**（用例 `expect(urls()).toEqual(before)`），且这一份里 `/agent-api/api/audit?` 恰 1 条、`audit-detail` 0 条、`audit-verify` 0 条。加载中 / 空集 / 403 拒绝 / 503 失败四档：`audK-list` 与 `[data-audk-row]` 都不存在，向 document 派发 ArrowDown 后 `document.activeElement` 不动（不劫持方向键），四档各自最多一条读请求。
- **零破**：`aud01*`、`aud2*`–`audJ*`（含 audA 的 `audA-row-shell-*` 与焦点回 toggle 断言、`aud6-toggle/preview-*`、`aud8-*`、`aud9-deeplink-*`、`audB-*`、`audD-bucket-*`、`audF-state-*`、`audG-*`、`audH-page-size`、`audJ-*-list/preview/detail`）与页级 `agent-v2-page-audit*` 未改名未删节点；起算 299 条一条未红。三档视口：行壳新增属性不带可见内容，容器 `flex min-w-0 flex-col`，未做浏览器像素走查（活体腿不可用），不声称已验。
- 新增 testid：`audK-list` `audK-row-<key>`（另用 `data-audk-row` / `data-audk-roving` / `data-audk-open` 承载停靠点与展开态）。
- 门禁：vitest `src/modules/audit` **exit 0**（**15** files / **307** tests = 基线 15/299 + 8 条键盘全链路用例）；`pnpm exec tsc -b . --noEmit` 共 **67** errors（= 本机当前地板，改动前后同数、增量 0）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings。
- 活体腿沿用已知不可用实测（未重跑）：9122 无身份头 **401 `console.unauthenticated`**、8092 **404 `console.not_found`**；键盘链路与请求计数证据全部为 jsdom 用例（fireEvent keydown + activeElement + tabIndex 分布），不依赖浏览器、未假装活体。

## Audit filter copy mount and range presets (audL, 2026-11-20, base 5630ffce)

- 写域：`web/src/modules/audit/{AuditEventsModulePage.tsx,states.tsx,AuditEventsModulePage.test.tsx}` + 本节（3 个源文件，≤15 文件/≤1500 行）。App.tsx / shell / routes / registry / package·lock / web scripts / ops 未碰。基线：显式 refspec fetch 后 merge（wave-20）已在 HEAD，上游对 modules/audit 零改动，porc=0。
- **① audG 挂载条件：改为常驻（工单推荐方案）**。此前是「读到东西才挂」，两轮探针因此找不到控件；现在 `audG-filter-copy-block`/`audG-filter-copy` 在事件列表面上**恒在**，可用性只看地址，不看台账脸色：
  - 挂载条件（原文已写进按钮 `title` 与卡内 `audG-filter-copy-rule` 两处）：地址里带任一读法即可复制 —— 自定义区间（`window=custom`）、事件类型 `?type=`、操作者 `?actor=`、资源 `?resource=`、每页条数 `?limit=`（非默认档）、或已在第 2 页以后（`?cursor=` 栈非空）；这些都空时（只剩默认「最近 7 天」）→ `disabled` + `aria-disabled=true` + title 以「当前没有筛选条件可复制」开头并补一句为什么（沿用 audG 既有那句锚，另加「控件常驻，只是没内容可给」），点它不写剪贴板。
  - 与状态的关系明确登记：**加载中 / 空集 / 失败 / 403 被拒都照样可复制**（前提是地址里有读法）——摘要是「这一页问了什么」，问题在回答之前就存在；被拒的那一条恰恰是工单最需要转出去的问题，其 title 会带上当前状态名（正在读取 / 该条件下无事件 / 读取没有完成 / 暂时无法查看审计事件）。
  - 两种情况读数（用例 `the control is permanent…` 逐档断言 present/disabled）：`ready-无筛选` → `{present:true, disabled:true}`；`loading-有筛选`、`ready-有筛选`、`empty-有筛选`、`denied-有筛选` → 全部 `{present:true, disabled:false}`。另一条用例 `a denied ledger still hands out the question that was refused` 在 403 面板后点复制，剪贴板收到 `…actorId=employee-api…` 且 `操作者：employee-api` 在文本里，`urls()` 长度不变（复制不补发请求）。
  - 既有用例的同步改动（口径升级必然触碰，testid 与结构零破）：`loading/denied 无控件` 那条旧断言改写为常驻断言；无筛选那条的 title 断言由 `toBe("当前没有筛选条件可复制")` 改为 `toContain(同一句)`（句子仍在，只是后面多了原因）。
- **② audB 快捷预设**：自定义区间卡内新增 `audB-presets` 组（`role="group"` + aria-label + title 写明同源），三个真按钮 `audB-preset-24h`/`-7d`/`-30d`，`onClick` 直接调用**同一个 `onWindowChange`**（与上方快捷档 `aud01-filter-window-*` 同一 setter、同一 `?window=` 事实源，不是第二套时间控件）。读数：自定义里点 `audB-preset-24h` → 地址 `window=24h` 且 `from/to` 被清掉、`type` 等业务键保留、重取**恰一次**（`/agent-api/api/audit?` 计数 before+1）、镜像一致（`aud01-filter-window-24h` 转 `aria-pressed=true`、`-custom` 转 false，预设行随自定义卡一起消失，故 `audB-preset-24h` 此时不存在）；点 `audB-preset-30d` 时游标栈被丢弃、`aud2-page` 从「第 3 页」回到「第 1 页」、同样恰 1 次；自定义卡打开时三个预设都是 `aria-pressed=false`（此刻按下的是上方「自定义」），这句话在组 title 里写明。
- **不变式**：`?window=custom` 直达仍成立（冷挂载 `window=custom&from=&to=` 回填 09:00/10:30、`aud01-filter-window-custom` pressed、预设 3 个、只 1 次读）；反向/半填区间锚不变（`aud01-custom-hint` 与 `audB-range-error`「开始时间不能晚于结束时间」都在，应用被拒不发请求，预设能一步逃出未完成区间）；已经在档上再点同一档 = **0 次**重发（地址没变就不重问，用例锁）。零额外请求：所有预设/复制/镜像用例都贴了 `listReads()` 计数，复制腿贴 `urls()` 逐字长度不变。
- **零破**：`aud01*`、`aud2*`–`audK*` 全家族与页级 `agent-v2-page-audit*`、`agent-v2-page-audit-detail*` 未改名未删节点；起算 307 条一条未红（现 314 = 307 + 7）。四态、每态 rid、403≡404 同体、零写入口、三档结构（预设与快捷档同族同 token：`h-8 min-w-0 rounded-md border … focus-visible:outline-2`，未新增颜色；规则行 `basis-full break-words`）无回退。浏览器像素三档仍未走查（活体腿不可用），不声称已验。
- 新增 testid：`audB-presets` `audB-preset-24h` `audB-preset-7d` `audB-preset-30d` `audG-filter-copy-rule`（`audG-filter-copy`/`-status`/`-fallback`/`-block` 原样）。
- 门禁：vitest `src/modules/audit` **exit 0**（**15** files / **314** tests）；`pnpm exec tsc -b . --noEmit` 共 **69** errors（= wave-20 后本机地板，改动前后同数、增量 0）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings。
- 活体腿沿用已知不可用实测（未重跑）：9122 无身份头 **401 `console.unauthenticated`**、8092 **404 `console.not_found`**；①②两处读数均为 jsdom 腿（present/disabled 分布、aria-pressed 镜像、分前缀请求计数），未假装活体。

## Audit audL addendum: probe readings for the two legs (2026-11-20, same commit)

- ① 常驻后的两档实读（jsdom 逐档断言 present/disabled，`audG-filter-copy`）：`window=7d` 无任何口径 → `{present:true, disabled:true}`，title 首句仍是「当前没有筛选条件可复制」，卡内规则行 `audG-filter-copy-rule` 同时在屏；`window=7d&type=task.created` 在 **加载中 / 已读到 / 空表 / 403 被拒** 四档都是 `{present:true, disabled:false}`。403 那一档点复制，剪贴板收到含 `actorId=employee-api` 与「操作者：employee-api」的一行，`urls()` 长度不变。
- ② 预设的两档实读：自定义卡里 `audB-preset-24h/7d/30d` 三个都是 `BUTTON` 且此刻 `aria-pressed=false`（按下的是上方「自定义」，组 title 写明同源关系）；点 `audB-preset-24h` → `window=24h`、`from/to` 清除、`type` 保留、上方 `aud01-filter-window-24h` 转 `true`、`-custom` 转 `false`、分前缀计数 `+1`；点 `audB-preset-30d`（带 `cursor=cur_page1&cursor=cur_page2` 的第 3 页）→ 游标栈清空、`aud2-page` 回「第 1 页」、计数 `+1`；已在 `7d` 时再点 `aud01-filter-window-7d` → 计数 `+0`（地址没变就不重问）。

## Audit list scroll and expand restore (audM-scroll, 2026-11-20, base abd1cd6a)

- 写域：`web/src/modules/audit/{scrollMemory.ts,scrollMemory.test.ts,AuditEventsModulePage.tsx,AuditEventsModulePage.test.tsx}` + 本节（4 文件，≤15 文件/≤1500 行：diff 约 +470）。App.tsx / shell / routes / registry / package·lock / web scripts / ops 未碰。基线：显式 refspec fetch + merge 已由总控完成（tip 957704be 已在 HEAD 内，上游对 modules/audit 零改动），porc=0。
- **编号口径**：本单工单点名新增前缀 `audL-*`（上一单 audL 的新增只占了 `audB-preset-*` 与 `audG-filter-copy-rule`，`audL-*` 本身未占用），故照工单用 `audL-*` 前缀，节名用 `audM-scroll` 区分本轮语义。
- **既有行为先探针、缺什么补什么**：展开态**不缺**——`?preview=` 自 aud8 起就落地址，`返回列表`（aud8 的 `aud8-back-to-list`，走 `navigate(-1)`）把条目恢复原样，本轮用例只是把这层锁死：返回后 `aud6-preview-evt_7c1f2a3b4d5e6f70` 在屏、`aud6-toggle-evt_7c1f2a3b4d5e6f70` 的 `aria-expanded="true"`、地址仍含 `preview=`。缺的是**滚动位**与**焦点归还**（地址装不下，浏览器只在同源整页返回时自己管一次），本轮补的就是这两件，没有重复造第三套展开态。
- **滚动位**：新增 `scrollMemory.ts`，sessionStorage 键 `audm-scroll:<读法指纹>`，值 `{y, rowKey}`。指纹= `window|from|to|type|actor|resource|limit|cursor 栈`，**故意不含** `detail`/`preview`/`event`/`tech`：打开一条记录不是换了问题，否则永远没有可回去的位置。存储不可用/值坏/负数/非数字一律当作「没有位置」，绝不臆造（`scrollMemory.test.ts` 逐条锁）。
- **存与取的时机**（`AuditEventsSurface` 内一处 effect，覆盖全部入径：行按钮 `openRow`、预览里的「打开详情」、粘进来的记录地址）：`selected` 由空变有 → 存 `readScrollY()` + 行标识；由有变空 → 花掉一次（`applyScroll(y)` + `document.querySelector("[data-audk-row=<key>]").focus()`，停靠点由行自己的 `onFocus` 跟着走，不再存第二份状态）→ `clearScrollMark` 记账一次只用一次。
- **两组读数**（jsdom 替身口径：`window.scrollY` 设为已知值、`window.scrollTo` 换成记账 spy；读数同时落在 `audL-scroll` 的 `data-audl-saved / -restored / -focus / -cleared / -fingerprint` 属性上）：
  - ① `?window=7d&preview=evt_7c1f2a3b4d5e6f70`，scrollY=500 → 进详情：`data-audl-saved="500|evt_7c1f2a3b4d5e6f70"`、指纹 `window=7d|from=|to=|type=|actor=|resource=|limit=|cursor=`、此时 `scrollTo` 调用 0 次（存不动窗口）；点「返回列表」→ `scrollTo` 实收 `[[0,500]]`、`data-audl-restored="500"`、`data-audl-focus="evt_7c1f2a3b4d5e6f70"`、`document.activeElement` 的 `data-audk-row` 就是这一行；再进（scrollY 改 120）再回 → `scrollTo` 变 `[[0,500],[0,120]]`、`data-audl-restored="120"`（记号一次花一次，不重复甩人回旧位置）。
  - ② 403 那一档：详情读回 403 `console.forbidden`，「返回列表」后 `scrollTo=[[0,420]]`、`actor=employee-api` 与 `preview=` 都还在、预览面板仍在 —— 被拒的记录不吞位置。
- **边界读数**：
  - 换筛选：记录打开中点 `aud01-filter-window-24h` → `data-audl-cleared` 等于旧指纹、`sessionStorage` 里那条键为 `null`、`scrollTo` 仍 0 次（别的问题的位置不甩到这一页）；顺带实测登记：`返回列表` 走 aud8 的「记录是它自己的一条历史条目」语义，会落回打开记录时那一问（`window=7d`），改档写进的是被 replace 的记录条目（可分享/可刷新仍带 `window=24h`）——本轮不破该契约，只如实登记。
  - 换页：`aud01-load-more` 后同样清（`data-audl-cleared`=旧指纹、键为 null）；清空操作者（`aud8-actor-clear`）同样清，且 `sessionStorage.length===0`。
  - `?event=` 深链：`/audit?window=7d&event=evt_8d2e3f4051627384` 定位展开后，进详情再返回 → `scrollTo` 0 次、`data-audl-restored="深链定位优先，不回到旧位置"`，行仍由深链自己展开（aud9 腿不回归）。
  - 整页直接落在记录上（粘 `/audit?window=7d&detail=…`，tab 里留有旧记号）：本轮明确丢弃旧记号（`data-audl-cleared="整页加载直接落在记录上，这一页没有离开过列表"`、键为 null、`scrollTo` 0 次）——这一趟列表从没上过屏，位置不是它可以承诺的东西；同一趟里再走一次「进详情→返回」则正常恢复 `[[0,500]]`。
  - 无标识行（`{action, occurredAt, outcome}`）：`openRow(null)` 走 `aud02-detail-unaddressable`，不存记号（`data-audl-saved="这一行没有标识，没有可回去的详情"`、`sessionStorage.length===0`）。
- **零额外请求**：整趟「进详情→返回」`urls()` 里 `/agent-api/api/audit?` 恰 1 条、`audit-detail` 恰 1 条（记录本体该发的）、`audit-verify` 0 条；返回这一步 0 条新增（用例按前缀过滤逐条比对，并断言去掉 detail 读后与进详情前的 `urls()` 数组完全相等）。存/取/清记号本身只碰 sessionStorage，不发请求。
- **零破**：`aud01*`、`aud2*`–`audL*`（含 audA 焦点/精度腿、audK 漫游停靠点与 `data-audk-row`、aud8 `aud8-back-to-list`、audB 预设、audG 摘要、audL 常驻探针）与页级 `agent-v2-page-audit*` 未改名未删节点；起算 15 files/314 全绿（现 16 files/330 = 314 + 16）。四态、每态 rid、403≡404 同体、零写入口无回退；新增探针 span 是 `aria-hidden` 空 span，屏幕文字与三档布局未受影响（浏览器像素三档仍未走查，见下）。
- 新增 testid：`audL-scroll`（属性 `data-audl-fingerprint/-saved/-restored/-focus/-cleared`）。
- 门禁：vitest `src/modules/audit` **exit 0**（**16** files / **330** tests）；`pnpm exec tsc -b . --noEmit` 共 **69** errors（= wave-20 后本机地板，改动前后同数、增量 0）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings（中途两条新警告已消：effect 里 `setRovingKey` 改为让行的 `onFocus` 自己带走停靠点；`openRow` 依赖里多余的 `fingerprint` 移除）。
- 活体腿沿用已知不可用实测（未重跑）：9122 无身份头 **401 `console.unauthenticated`**、8092 **404 `console.not_found`**。滚动位读数是 jsdom 替身口径（scrollY 设定值 + scrollTo spy + 探针属性），**不是**真浏览器 scrollY 实测；真浏览器里这两个值要一次带会话的活体腿才能贴，本轮未假装。

## Audit column sorting (audN, 2026-11-20, base b8eccc18)

- 写域：`web/src/modules/audit/{sorting.ts,sorting.test.ts,AuditEventsModulePage.tsx,AuditEventsModulePage.test.tsx}` + 本节（4 文件 +~700 行，≤15 文件/≤1500 行）。App/shell/routes/registry/package·lock/web-scripts/ops 未碰。基线：显式 refspec fetch 后 merge tip 957704be = Already up to date，porc=0。
- **服务端实测（先探再定性，探码上屏是禁的，只进本文）**：`/agent-api/api/audit-events` 带 `sort=occurredAt&order=asc`、`sort=occurredAt&order=desc`、`orderBy=occurredAt&order=desc`、`sort=actor&order=asc` 四组各打两个端口 →
  - `127.0.0.1:9122`：**401 `console.unauthenticated`**（本车道没有可用会话凭据，禁重建 9122），四组全同；
  - `127.0.0.1:8092`：**404 `console.not_found`「static asset not found」**（该实例没挂这条路由），四组全同。
  即：**没有 200、没有排序前/后的台账顺序可对照**，拿不到任何「服务端吃 sort/order/orderBy」的生效证据。旁证两条：本模块 `api.ts` 的台账读口 `/api/audit` 从来只发 `limit/action/from/to/actorId/resourceId/cursor`；OpenViking 记忆 2026-10-29「审计后端无 sort 参数、固定新→旧」。因此走工单退路：**本地排序**，界面 `aud-sort-scope-note` 明写「仅在当前已加载的 N 条内排序——服务端没有可用的排序参数（本轮实测拿不到生效证据），清掉排序就回到服务给的回行顺序」，title 说明探测结论但**不带路径/状态码**（既有 403≡404 用例禁止屏上 HTML 出现 `/agent-api`、`console.*`、`40[34]`，探码只记在本文）。
- **控件**：`aud-sort-bar-block` 内 `role=table`→`role=row`→四只 `role=columnheader` 的 `aud-sort-head-<col>`（`aria-sort` 三态 ascending/descending/none），各包一个真 `<button type=button>`（`aud-sort-button-<col>`，`⇅/↑/↓` 图标 + title 说下一步会怎样）。ARIA 取舍登记：账本行是卡片列表（audK 的 `role=list`/`listitem` 与 aud01 的 `aud01-cell-*` 契约），把 50 行改成真表格不在本预算内，故表头用最小 table 语义只覆盖排序控件本身；三态另有一行 `aud-sort-status` 用人话写当前列/方向与它的作用范围，AT 只认 columnheader 的 aria-sort 时也不丢信息。键盘：Enter 与 Space 直接触发（`preventDefault` 防浏览器再合成一次 click 而翻两态），焦点环沿用现有 token `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`，未新增颜色。
- **地址与组合**：`?asort=<col>&adir=<asc|desc>`；三态循环 asc→desc→**两键都删**（清除=服务给的回行顺序）。与 `window/custom from-to/type/actor/resource/limit/cursor/event/preview/tech` 全同屏共存，冷挂载一条组合地址即复现（用例：`asort=actor&adir=asc` + `window=custom&from=&to=&actor=&type=&limit=25&cursor=cur_page1` → 表头 `aria-sort=ascending`、操作者下拉回填、每页 25 回填、`第 2 页`、请求带 `from/actorId`，行序按操作者且缺值恒末）。残缺地址（只 `asort` 或只 `adir`、值不认识）一律当作没排序，不猜另一半。
- **口径同源（不与表体分裂）**：比较值直接取屏上同一显示——时间用 audJ `auditTimeView(raw, minute).text`、操作者用 `auditActorView(actor).text`（「未指派」按缺值处理）、动作/资源用 `row.action.label`/`row.resource.label`；`Intl.Collator("zh-Hans-CN", {numeric:true})` 比较，同值稳定（保持回行次序）。**缺值恒排末**（升序降序都排末，不当 0、不当空串抢首位；用例双向断言 + 行不丢）。
- **CSV 逐行同源（两组对照）**：导出集合与表体是同一个数组 `listedRows`（排序后的可见集），用例把「表体行的 操作者|对象 序列」与「CSV 数据行的同两列序列」逐行等值断言：
  - ① 默认排序：CSV 4 条数据行 = 服务回行序，首行含「阿朱」、末行含「白一」（`evt_n3` 在服务序里居第三位）；
  - ② `?asort=actor&adir=asc`：表体与 CSV 同为 `evt_n1 → evt_n4 → evt_n2 → evt_n3`，首行「阿朱」、末行「未指派」（缺操作者那条恒末），文件名仍带 `-all-n4-`。
  `aud5-export-count`、`aud01-status` 的「已显示 N 条」、类型分布与 `audI-export-scope` 全部改读同一集合，未另算。
- **零额外请求 / 不扰分页与保态**：点表头只写地址两个键，`urls()` 在三次循环点击前后**逐字相等**（数组全等断言），`/agent-api/api/audit?` 仍 1 条；已在第 2 页（`cursor=cur_page2`）时排序不改页码、不丢游标（`aud2-page` 仍「第 2 页」）；排序不是换问法：`scrollFingerprint` 不含 `asort/adir`，audM 留下的位置记号原样在 sessionStorage 里（用例断言未被清、`data-audl-cleared` 不出现）。audK 的方向键走的是**当前显示次序**（排序后 ↑↓ 依次落到屏幕上真实的下一行）。
- **四态**：loading / empty / error / denied 与自定义区间未应用时，四只表头按钮一律 `disabled` + title 说明原因（「正在读取这一页，读到之后才有可排的行」「这一页没有记录可排」「这一页没能读到；先重试，读到了再排序」「审计事件暂不可读，这一页没有可排的行」「自定义区间还没应用…」），点它们不写地址也不发请求（逐档断言 `urls()` 不变、`asort=` 不出现）；403≡404 同体与每态 rid、零写入口沿用 audF 口径未退化。
- **零破**：`aud01*`、`aud2*`–`audM*`（含 audH 每页条数、audI 导出口径、audJ 时间/操作者 helper 断言、audK 漫游、audL 常驻摘要与滚动记号）与页级 `agent-v2-page-audit*` 未改名未删节点；起算 16 files/**330** 一条未红，现 **17 files / 343** = 330 + 13（`sorting.test.ts` 5 条 + 页面 audN 8 条）。三档视口：排序条是 `flex min-w-0 flex-wrap gap-2`，说明行 `break-words`，未做浏览器像素走查（活体不可用），不声称已验。
- 新增 testid：`aud-sort-bar-block` `aud-sort-bar` `aud-sort-row` `aud-sort-head-<time|actor|action|resource>` `aud-sort-button-<col>` `aud-sort-status` `aud-sort-scope-note`。
- 门禁：vitest `src/modules/audit` **exit 0**（**17** files / **343** tests）；`pnpm exec tsc -b . --noEmit` 共 **69** errors（= 本机地板，改动前后同数、增量 0）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings（一度因 `useMemo` 依赖新建对象多出 1 条 exhaustive-deps 提示，已改为与类型分布同款的直接派生并消除）。
- 活体腿状态：仅上述排序参数探针（401/404，未获得任何生效读数），其余证据为 vitest 腿 + URL 构造复现。

## Audit long value truncation and full text (audO, 2026-11-20, base 577d95e0)

- **来源更正（先写这一条，避免下一轮误读地基）**：本节的实现**不是上游带进来的**。上游 88ea9881「feat(console): system long value truncation and full view」改的是 `web/src/modules/health/**` 与 `docs/_artifacts/gov/**`，一处没碰 `web/src/modules/audit`；`git show HEAD:web/src/modules/audit/views.tsx | grep -c aud-trunc` = **0**，HEAD 里也不存在 `web/src/modules/audit/truncation.ts`。本车道 `truncation.ts` 与三处接线是 audO 上一轮**中断时留下的未提交工作区**（本轮开工时 `git status` 为 4 项：views.tsx 与页面用例已改、truncation.ts/truncation.test.ts 未跟踪），本轮没有"找回"任何东西，只做核对、补接线、把失败用例修到通过。若下一轮把这套代码当成"上游已实现、只缺测试"，那是错的。
- 写域：`web/src/modules/audit/{truncation.ts,truncation.test.ts,views.tsx,AuditEventsModulePage.test.tsx}` + 本节。App/shell/routes/registry/package·lock/web-scripts/ops 与其它模块未碰；单 commit（代码+测试+文档一笔）。
- **一个 helper，三处接线**（工单的「同一 truncation helper」核对结果）：`truncation.ts` 是唯一构造口——`truncatedView(value, limit)` 返回 `{truncated, shown, omitted, title}`，`omitted = 原文长 − 预算`（按实际字符串算，注释里写明不许猜）；`title = 完整值：<原文>（已省略 N 字符，完整值见此处）`；`joinTitles()` 把已有 title（原始标识、缺失原因）**并列而非顶掉**。视图侧只有一个呈现件 `LongValue`：
  - 列表单元格（`AuditEventRowCard`）：操作者格、对象格走 `Field truncate`（预算 `TRUNC_CELL=24`，CSS `truncate` 单行 + `data-testid="aud-trunc"` + `data-aud-trunc-omitted=N` + title），动作说明行同样接 `LongValue`；事件类型格的按钮 title 只在真被截时补完整值，短值一个属性都不加。列表**不给展开按钮**（行内把手已经够多，完整值在 title 与详情里）。
  - 行内预览 `aud6-preview-*`：事件类型 / 操作者 / 资源三行走 `LongValue`（预算 `TRUNC_LINE=40`）+ 原生 `<button type="button">` `aud-trunc-toggle-preview-<field>`（`aria-expanded`、`aria-label`、`focus-visible:outline-2`）。
  - 详情 `aud3`/抽屉（`AuditEventDetailBody`）：谁 / 被操作的对象 / 结果 / 原因 → `aud-trunc-toggle-detail-<field>`，同一组件同一算法，`audA-detail-*` 与 `audJ-*-detail` 探针 id 未动。
  - 三处都真正走同一个 helper，本轮修掉两处"看着接了其实没接"的缺口：详情资源格（`audA-detail-resource`）此前漏了 `expandName`；列表动作说明行还是整段 `break-words`。另外把 toggle 命名加surface 前缀（`preview-`/`detail-`），否则预览与详情同屏时同一个 id 会出现两次、探针点到的不是要测的那一个。
- **短值不加装饰**：`truncated=false` 时 `LongValue` 只渲染原文——无省略号、无 `aud-trunc` 标记、无按钮（用例断言短值页面上 `aud-trunc` 数为 0 且正文里不出现「展开全文」）。
- **展开只改本地态**：`aria-expanded` false→true、面板内正文由头部变成完整原文；`locationText()` 逐字不变、`urls()` 数组逐字相等（预览腿与详情腿各自断言，含收起后再次相等）。不改筛选/页码/`window/type/actor/resource/limit/cursor/preview/event` 任一键。
- **N 实算读数（用例逐格重算，不是抄常量）**：从 title 里回取「完整值：X（已省略 N 字符…）」的 X 与 N，断言 `X.length − N` ∈ {24, 40}（即预算）、行显示的头部是 X 的前缀、`N>0`。实例：48 字的 actor 全名在格上 `omitted=24`（预算 24）、在预览/详情行上 `omitted=8`（预算 40）；79 字资源路径与 55 字动作说明同法各自成立。
- **敏感字段不回显**（既有规则不破）：原始载荷仍按 `maskSensitive` 隐去（用例仍见 `"password": "***"` 与「已隐去 N 项」），全页 HTML 不含明文口令；所有 `aud-trunc` 的 title 不含 `***`，截断只作用于显示层标签，从不把掩码前的值搬到 title。
- **三档无横溢（声明口径）**：实现方式是 `min-w-0` + Tailwind `truncate`（overflow-hidden/ellipsis）+ 外层 `flex-wrap`，展开态切回 `break-words`；**jsdom 没有布局宽度，故本轮是结构口径而非 1280/768/375 实测**——没有真浏览器量宽证据，不声称量过（活体腿本车道不可用，见下）。
- **四态**：加载中 / 空集 / 403 被拒三档页面上没有任何截断件与「展开全文」，就绪后才有（用例逐档）；403≡404 同体、每态 rid、零写入口沿用 audF/audL 口径未退化。
- 新增 testid：`aud-trunc`（可多枚，逐格）、`aud-trunc-toggle-preview-{action,actor,resource}`、`aud-trunc-toggle-detail-{actor,resource,outcome,reason}`，属性口径 `data-aud-trunc-omitted` / `data-aud-trunc-expanded`。
- 零破：`aud01*`、`aud2*`–`audN*`（含 audA 逐字段对照与 `audA-*-time/-actor/-resource`、audJ `data-audj-value/-title`、audN 排序与 CSV 同源、audL 摘要与预设、audK 漫游）与页级 `agent-v2-page-audit*` 未改名未删节点；起算 17 files/**343** 一条未红，现 **18 files / 355** = 343 + 12（`truncation.test.ts` 5 条算术与话术 + 页面 audO 7 条接线/展开/短值/敏感/四态）。
- 门禁：vitest `src/modules/audit` **exit 0**；`pnpm exec tsc -b . --noEmit` 共 **69** errors（= 本机地板，改动前后同数、增量 0）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings。
- 活体腿沿用已知不可用（未重跑）：9122 无身份头 **401 `console.unauthenticated`**、8092 **404 `console.not_found`**；本轮全部证据为 vitest 腿与 title/attribute 算术核对，宽度类断言为结构口径。

## Audit permalink and page size restore (audP, 2026-11-20, base c9e2b8a9)

- 写域：`web/src/modules/audit/{AuditEventsModulePage.tsx,states.tsx,AuditEventsModulePage.test.tsx}` + 本节（3 文件）。App/shell/routes/registry/package·lock/web-scripts/ops 与其它模块未碰；基线：显式 refspec fetch 后 merge = Already up to date（章面与代码代次同前一轮），porc=0，单 commit。
- **零破口径扩展（登记）**：工单写「aud2–audL 零破」，车道实际已到 audO，故按 **aud01*/aud2–audO + 页级 `agent-v2-page-audit*`** 全量执行；起算 18 files/**355** 一条未红，现 **18 files / 363**（+8 条 audP 用例）。
- **实测发现的真实缺陷（本轮唯一代码行为改动，已修）**：切每页条数走的是 aud8 的 `resetPagingAndFolds`，里面 `draft.delete("event")` —— 探针实测 `/audit?window=7d&limit=100&event=evt_d1` 下把选择器改成 25 后，地址变成 `…&limit=25`，**`?event=` 被静默吃掉**、`aud9-deeplink-found` 消失。这与工单「深链展开中切 limit 不得劫持/清掉 event 参数除非用户主动关定位」直接冲突，且 `?event=` 是人带来的指针而不是本页的展开态。修法：新增 `resetPagingKeepingLink(draft)`（清 cursor/preview/tech，**不清 event**），只给 `setPageSize` 用；筛选变更与翻页维持 aud8/aud9 既有语义（翻页＝换页，定位随页离开——本轮未被要求改，且 aud9/aud8 用例钉着，**如实保留**）。
- **逐组实测（limit × 深链，三档全贴）**：同一 handler（真按 `limit` 回条数）下 `limit=25/50/100` + `event=evt_p1|evt_p2`：选择器显示值 = 25/50/100、`data-aud-limit-asked` 同值、页码=1、游标数=0、`data-aud-limit-event` 保持、`data-aud-limit-located="在本页已展开"`、`aud9-deeplink-found` 在、`aud6-preview-<id>` 展开、该行 `aria-expanded=true`、实发请求含 `limit=<该值>`、`/agent-api/api/audit?` 计数=1、detail 计数=0。
- **返回复原（三组读数，逐字地址比对）**：入口 `/audit?window=custom&from=…&to=…&type=task.created&actor=employee-api&resource=ts_evt_p2&limit=25&cursor=cur_page1&event=evt_p2`，分别从 25/50/100 档的 handler 进入记录（`aud01-row-evt_p2` 按钮）再点 `aud8-back-to-list`：三组都断言 `locationText()` 与进去前**逐字相等**（含 window/custom from-to/type/actor/resource/limit/cursor/event 全键），选择器显示值与进前相同（25），操作者/资源/类型控件回填，`data-aud-limit-cursors=1`、`data-aud-limit-page=2`、`data-aud-limit-event=evt_p2`，`aud6-preview-evt_p2` 展开态回来；计数：`audit?`=1（返回不重问）、`audit-detail`=1（打开记录本身该发的那一次）。
- **切条数腿读数**：`limit=50&cursor=cur_page1&event=evt_p1` → 切 100 ⇒ 地址 `limit=100`、`cursor` 清空、`event=evt_p1` 保留、页码回 1、游标数 0、`audit?` 计数 **+1 恰一次**、实发 URL 含 `limit=100`、定位仍 `在本页已展开`。
- **clamp × 深链**：请求 100、回答 `meta/limit=50` 时选择器与 `data-aud-limit-size` 显示 **50（生效值）**、`data-aud-limit-asked` 仍 100、`audH-clamp-note`「请求按每页 100 条发出…」在屏，地址不被改写（仍 `limit=100&event=evt_p7`），`audit?` 计数 1。
- **深链不存在**：`…&limit=25&cursor=cur_page1&event=evt_absent_000001` + detail 读 404 `audit.event_not_found` ⇒ 「该事件不存在或已过期」+ 可复制 rid（`aud9-event-rid` 含 `rid-p-404`），六个筛选键逐条仍在地址上、选择器仍 25、`data-aud-limit-located="不在本页"`、计数 `audit?`=1/detail=1（**不清参数、不重问台账**）。
- **`audE` 扩展（既有件未改名）**：`audE-link-scope` 一句写明固定链接**不带**时间窗/每页条数/筛选（粘出去的人用默认档读到，命中就展开、读不到就说原因）；用例同时断言复制到的串仍是 `origin/audit?event=<id>`（audE 口径未回归）且复制前后 `urls()` 逐字相等。
- 新增 testid：`aud-limit-restore`（探针 span，属性 `data-aud-limit-size|-asked|-page|-cursors|-event|-located`）、`audE-link-scope`；`audH-page-size`/`audH-clamp-note`/`aud9-event-*`/`aud8-back-to-list`/`audL-scroll`/`audO` 家族与 `aud01*`/`aud2–audO` 未改名未删节点。
- 四态与三档：`audit?`/detail 分前缀计数在上述每条腿都贴；深链不存在腿与返回腿都不新增台账读；`aud-limit-restore` 是 `aria-hidden` 空 span，屏幕文本与布局未变（三档无横溢仍为结构口径——`min-w-0`/`flex-wrap`，jsdom 无量宽，未做真浏览器走查）。403≡404 同体、每态 rid、零写入口沿用 audF/audL 未退化。
- 门禁：vitest `src/modules/audit` **exit 0**（18 files/**363**）；`pnpm exec tsc -b . --noEmit` 共 **69** errors（= 本机地板，改动前后同数、增量 0）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings。
- 活体腿沿用不可用（未重跑）：9122 无身份头 **401 `console.unauthenticated`**、8092 **404 `console.not_found`**；上述全部读数为 vitest 腿 + URL 构造（limit 与 clamp 由真按参数回答的 mock 给出），未假装活体。

## Audit action availability gates (audQ, 2026-11-20, base d34f0572)

- 写域：`web/src/modules/audit/{auditGates.ts,auditGates.test.ts,states.tsx,views.tsx,AuditEventsModulePage.tsx,AuditEventsModulePage.test.tsx}` + 本节（6 文件，diff ≈ +600/−54，≤15 文件/≤1500 行）。App/shell/routes/registry/package·lock/web-scripts/ops 与其它模块未碰；基线：显式 refspec fetch 后 merge = Already up to date，porc=0；单 commit。
- **收口清单（哪些私有措辞被删、并入哪一处）**：`auditGates.ts` 现在拥有全部「可用/不可用 + 那句话」的判定与字符串——
  - `aud01-export` 原来在页面里用 `exportOff`/`exportTitle` 两行三元式；`aud5-export` 另有 `canExport` + 自己的一条三元 title；现在两者只读 `gates.exportCsv` / `gates.exportFiltered`（enabled 同源、话术同源，两枚按钮各自保留自己被用例钉住的那句原文）。
  - `audG-filter-copy`（states.tsx）原先自己算 `ready = available && line!==null`、自己拼「常驻控件…/当前没有筛选条件可复制…」两句话、自己写卡上那句挂载规则；现在只接 `gate`（`{enabled,title}`）与 `rule` 两个来自 gates 的入参，组件内不再有任何可用性判定或相应措辞（`PHASE_WORDS` 常量随之下线，`FILTER_SUMMARY_EMPTY_TITLE`/`PERMALINK_MISSING_TITLE` 的引用也收进 gates——`PERMALINK_MISSING_TITLE` 由 gates 从 permalink.ts 取用，仍是同一字符串）。
  - `audE-link`（states.tsx `PermalinkCopy`）原来只看 `link===null`；现在看 `gate.enabled`（gate 由 `copyLinkGate(recordPhase, hasIdentifier)` 在预览与详情两处算出）。
  - `aud6-toggle` 原来没有任何 disabled/title 口径；现在 title 来自 `gates.toggle`。
  - `aud01-refresh`（重试）原来 `disabled={list.phase==="loading"}`；现在 `!gates.retry.enabled`。
- **矩阵读数（三处×四态，`aud-gates` 镜像 + 真实控件逐格对齐）**：
  - ① **loading**：`aud01-export` off、`aud5-export` off、`aud6-toggle-*` 不存在（镜像 toggle=off、copy-link=off）、`aud01-refresh` **on**；按下刷新 → `urls()` +1（用户动作触发，不自动重发）。
  - ② **empty（真空）**：两枚导出 off 且 title 仍是「当前筛选无事件可导出」；屏上无 `aud6-toggle-*`；`audG-filter-copy` **on**（地址带着 `type=task.created` 的口径，素材仍在）；`data-aud-gates-copy-link`=off（没有一行可以钉）。
  - ③ **error(503)**：export/export-filtered/toggle/copy-link 四格镜像全 off，实际按钮同样 off；面板侧「审计服务在处理时出了错…」+ 可复制 rid（`aud01-error-request-id` 含 rid-q）+ 重试可用（refresh on）。
  - ④ **denied(403≡404)**：export/export-filtered/toggle 同样整组 off；`aud01-denied` 在 403 与 404 下 textContent 逐字相等（同体未退化）；地址六键 `window=24h/type/actor/limit=25/cursor=cur_page1/preview=evt_7c1f…` 一个都没掉（denied 不清参，沿用 audF/aud8）。
  - 追加一致性腿：`?preview=<id>&detail=<id>` 且详情读口 403 时，预览里那枚 `audE-link` **disabled**（title「这一条现在读不到…」）且同侧抽屉是拒绝体、没有可复制的记录 —— 正是工单要点名消灭的「一处 disabled 一处可点」。
- **行为变化登记**：
  - 1) loading 期重试由 disabled 改为 **可用**（工单 ① 明确；按下确实重发该读口恰一次，计数已贴）。工具条 `aud01-refresh` 在 denied 时仍不渲染——拒绝体自带「再读一次」出口（audF/audL 既有实现与用例），避免同一状态出现两枚重试。
  - 2) 固定链接新增「详情读口未完成/失败/被拒即关」的判定；此前只要行上有 id 就可点。这是本单为「同一失败同一可用面」所做的实际收敛，非文案变化。
  - 3) 空集语义按实况写清：**真空(empty)≠不可用(unwired)**。摘要复制引用的是地址与已发出的请求路径，与行集无关，故 loading/empty/error/denied 四态都仍可复制（`audG` 既有契约与用例保留）；本台账读口没有独立 unwired 档——路由缺失回 404 即进 denied 同体，`未接入` 标记由 audF 那层给（`auditGates.AuditGates.phase` 因此只取五档，注释写明）。工单 ①/④ 的「复制禁」与这条既有契约冲突处，按 orchestrator 授权「按实况定并写清」取此解并在此登记。
  - 4) 翻页仍清 `preview/event/tech`（aud8/aud9 语义，本单未动）；切条数保留 `?event=`（audP 语义，未回退）。
- **零副作用**：`auditGates.ts` 是纯派生（无 fetch、无 URL 写、无 storage）；单测里所有话术矩阵都断言不含 `/agent-api`、`console.*`、`audit-events`、状态码数字与 testid 名；页面腿在读写镜像与点开展开后断言 `urls()` 逐字相等（除 ① 中用户主动按重试那一次）。
- **零破**：新增 `aud-gates`（镜像 span，属性 `data-aud-gates-phase|-export|-export-filtered|-copy-filter|-copy-link|-toggle|-retry`）；`aud01*`、`aud2*`–`audP*`（含 `aud5-export*`、`aud6-toggle/preview-*`、`audE-link*`、`audF-state-*`、`audG-filter-copy*`、`audH-page-size`、`audJ-*`、`audK-list/row`、`audL-scroll`、`audN-*`、`aud-trunc*`、`aud-limit-restore`）与页级 `agent-v2-page-audit*` 未改名未删节点；既有用例的措辞断言未改一处（措辞只是换了产地）。起算 18 files/**363** 全绿 → 现 **19 files / 378**（+15：`auditGates.test.ts` 9 条矩阵与不变式 + 页面 audQ 6 条落控件的矩阵）。
- 三档：新增件只有一个 `aria-hidden` 空 span（镜像），屏幕文本与布局未变；`min-w-0 flex-wrap` 口径沿用，浏览器像素三档仍未实测（活体腿不可用）。
- 门禁：vitest `src/modules/audit` **exit 0**（19 files/**378**）；`pnpm exec tsc -b . --noEmit` 共 **69** errors（= 本机地板，改动前后同数、增量 0）且 `modules/audit` **0**；`eslint src/modules/audit` **0 errors** / 4 既有 warnings。
- 活体腿沿用不可用（未重跑）：9122 无身份头 **401 `console.unauthenticated`**、8092 **404 `console.not_found`**；矩阵读数全部来自 vitest 腿与 gates 纯函数断言。
