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
