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
