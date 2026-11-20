# KNW5 检索与引用下钻 — 活体读数（2026-11-19 BJT）

分支 `lane/console-ui1` · 基线 `origin/lane/hermes-console@3bff4208`（合并提交 `3b880bc6`）· 页面 `web/src/modules/knowledge/**`
探针时刻 2026-11-19T23:53+08:00（BJT）· 线上入口 `127.0.0.1:9122/agent-api`（**只读探针，未重启、未重建、未改配置**）
Cookie 只取 `~/.local/state/sekoi-ops/v4-auth-state.json` 的 `access_token_cookie`，在 curl 命令内拼 Header，值零回显。

## 一、端点实测码与行数

| 读口 | HTTP | 语义码 | 行数 |
|---|---|---|---|
| `/agent-api/api/knowledge/search?q=员工&limit=5` | 404 | `console.unknown_route` | 0 |
| `/agent-api/api/knowledge/search?limit=12`（页面无关键词时） | 404 | `console.unknown_route` | 0 |
| `/agent-api/api/knowledge/citations?limit=20` | 404 | `knowledge.not_wired` | 0 |
| `/agent-api/api/knowledge/spaces` | 404 | `knowledge.not_wired` | 0 |
| `/agent-api/api/knowledge/sources?limit=20`（接入任务面） | 404 | `knowledge.not_wired` | 0 |
| `/agent-api/api/documents?limit=50`（文档登记面） | 404 | `console.unknown_route` | 0 |
| `/agent-api/api/audit?action=kb.read&limit=50` | 200 | — | `events=0` |
| `/agent-api/api/console-sessions?limit=20` | 200 | — | `items=0` |
| `/agent-api/api/console-sessions/<不存在 id>` | 404 | `console_session.not_found` | — |
| `/agent-api/api/run-events?kind=citation&limit=20` | 400 | `console.missing_param`（要 runId） | — |
| `/agent-api/api/tasks?limit=20` | 200 | — | `items=20`，**不接入本页** |

`/api/tasks` 有 20 行真实数据，但它是运营任务看板：`source.kind` 只有 `manual`/`console`，`?kind=knowledge` 与 `?type=ingest` 都被上游忽略——那不是知识接入，因此不借它填任何数字。
BFF 源码 `apps/console/server.py` 的 `_KNOWLEDGE_NOT_WIRED_ROUTES` 只点名三条知识读口（`spaces/sources/citations`），本页的接入任务面因此打 `sources`；其余 `/api/knowledge/*` 变体（`ingest`、`ingest/tasks`、`tasks`、`documents`、`datasets`）实测都是裸 `unknown_route`。

## 二、面与呈现（每面一次真实请求）

| testid | 真实读口 | 今日线上呈现 | 接入后呈现 |
|---|---|---|---|
| `knw5-spaces` | knowledge spaces | 未接入 len0 | 名称/类型/规模/北京到分/状态，缺值「—」+原因 |
| `knw5-ingest-tasks` | knowledge sources | 未接入 len0 | 状态人话（排队中/处理中/成功/失败/已取消/部分成功/已停用/待处理）、`412 / 1380` 与「共 N」「已完成 N」、「失败 N」只在上游真给时出现、时刻带语义标签（最近同步/最近处理/最近更新/登记时间） |
| `knw5-ingest` | documents | 未接入 len0 | 文档登记同列口径 |
| `knw5-search` | knowledge search | 未接入 len0 | 标题/摘要/可读来源/北京到分 + 关键词进 `?q=` |
| `knw5-records` | audit kb.read | ready len0（接口已响应，检索审计为空） | 执行者短码、判定、结果、检索对象、时间 |
| `knw5-citations` | knowledge citations | 未接入 len0 | 引用行 + 原文入口 |
| `knw5-session-cites` | console-sessions → console-sessions/`<id>` | ready len0（当前没有读到会话引用记录） | 会话里每条引用成行，站内可点回原文 |

未接入正文只有一份：**403 与 404 同体**（仅请求编号不同），`GAP-03` 只进 `title`，屏面上不出现状态码、路由、字段名与 `GAP-03`。

## 三、引用下钻

行内「看原文与摘要」展开 `*-detail`：原文位置（站内 `打开原文`，站外/缺失写「原文不可达」+原因）、来源、完整摘要、留下这段引用（姓名 · 8 位短码）、北京时间到分；原始编号只在 `title` 与 URL `ref=`。
`ref=` 与 `panel=`、`q=` 一样是 URL 状态：刷新与前进后退都还原同一展开行，切面板时清掉，不会把上一面板的展开行带过去。

## 四、DOM 读数（Chromium 无头，`#/knowledge*` 哈希深链写法；临时 harness 在 /tmp，已删）

today 模式（照抄 9122 回答）：

```text
#/knowledge                1440 tab=spaces    docSW=1440/vw=1440 bodySW=1440 page=1144/1144 fixture=0 GAP-visible=false codes=false
#/knowledge?tab=retrieval  1440 tab=retrieval docSW=1440/vw=1440 bodySW=1440 page=1144/1144 fixture=0   knw5-search=unwired/len0 knw5-records=ready/len0
#/knowledge?tab=citations  1440 tab=evidence  1440 同上 fixture=0                knw5-citations=unwired/len0 knw5-session-cites=ready/len0
#/knowledge?tab=ingest     1440 tab=ingest    1440 同上 fixture=0                knw5-ingest-tasks=unwired/len0 knw5-ingest=unwired/len0
tabstrip 1440: ingest->ingest retrieval->retrieval evidence->evidence spaces->spaces (fixture=0)
375 同四行：docSW=375/vw=375 bodySW=375 page=342/342 fixture=0，无 OVERFLOW 元素，无页面报错
```

wired 模式（同一批路由回答出行，用来量真实行与下钻）：

```text
#/knowledge?tab=retrieval  1440/1280/375 opens=2 unreachable=1 drills=2   knw5-search=ready/len2 knw5-records=ready/len1
#/knowledge?tab=citations  1440/1280/375 opens=2 unreachable=2 drills=4   knw5-citations=ready/len2 knw5-session-cites=ready/len2
drill 1440: url=/knowledge?tab=spaces&panel=evidence&ref=cit_1 detail=true opens=4 | reload 后 detail=true url 不变
detail 文案：原文位置 打开原文 / 来源 季度经营复盘报告.docx / 摘要 …… / 留下这段引用 李文博 · 34567890 / 时间 2026-11-19 13:00
mode=today errors: none；mode=wired errors: none
```

三档视口 `documentElement.scrollWidth == innerWidth == body.scrollWidth`，页容器 `scrollWidth == clientWidth`；宽表在 720px 以下转 data-label 堆叠，`摘要` 三行截断且长句可断词，无横向溢出。

## 五、fixture 与门禁

- 本域 `data-fixture`：**基线 `43ea29d1` 有 1 处页根属性 + 4 个页内强制态 → 现在 0 处**；浏览器实测两模式全部 `[data-fixture]` 节点数 = 0。四态改由真实回答驱动（骨架 / 空态带原因 / 错误带可复制请求编号+重试 / 登录失效），页内不再读 `?state=`（壳层 `ConsolePane` 的 StateBlock 仍按 `?state=` 统一出占位，属壳层域）。
- 深链归一同时覆盖路径与哈希两种写法，否则壳层别名会把 `?tab=retrieval|citations|evidence` 送给其他模块、把 `?tab=ingest|sources` 送进规划中占位；哈希写法归一后四个面板 4/4 可选中并可在刷新后保持。

## 六、验证命令与尾行

```text
$ npx vitest run src/modules/knowledge
 Test Files  2 passed (2)
      Tests  24 passed (24)

$ npx vitest run
 Test Files  126 passed (126)
      Tests  1282 passed (1282)

$ npx eslint src/modules/knowledge
（无输出，exit 0）

$ npx tsc -b . --noEmit | grep -c modules/knowledge
0

$ npx vite build --outDir /private/tmp/knw5d-dist --emptyOutDir
✓ built · VITE_EXIT=0
```

`pnpm build` 会先跑全项目 typecheck，仍停在两处非本域文件：`web/src/pages/LoginPage.test.tsx:131,149`、`web/src/modules/approvals/api.test.ts:118,119`（HEAD 原样，本 lane 未触碰），另有 `apps/shared/src/*.test.ts` 的 vitest 类型缺失。本模块零错误。

## 七、边界

只改 `web/src/modules/knowledge/**` 与本证据目录；未动 `App.tsx`、`web/src/shell/**`、其他模块、`package.json`/lock、`web/scripts`、`ops`；未重启或改动 9122；无 force、无 amend、无 `--no-verify`。

---

# KNW5 追加：引用下钻深度（2026-11-20 BJT）

基线对齐：`git merge-base --is-ancestor HEAD 9c7789f6` 为真 → `git reset --hard 9c7789f6`（快进保留历史，本轮之前提交 `df315cae`、`68c8db3e` 均已在目标内）。本轮提交见 `lane/console-ui1`。

## 一、探针（cookie 只在 curl 命令内拼 Header，值零回显）

```text
404 knowledge.not_wired      /agent-api/api/knowledge/citations?limit=20   rid 53e93617   rows=0
404 console.unknown_route    /agent-api/api/knowledge/search?q=员工&limit=5                rows=0
200 items=0                  /agent-api/api/console-sessions?limit=20
200 sessions=0 total=0       /agent-api/api/sessions?limit=20
200 events=0                 /agent-api/api/audit?action=kb.read&limit=50
400 request.missing_filter   /agent-api/api/runs?limit=5（要 employeeId/status/since）
```

引用读口与检索读口今天都不给数据，所以线上呈现是「未接入」；**深度字段按契约实现**，
不是猜的：`bff-v4-serve/services/runtime/CONSOLE-SESSIONS-SHAPE.md` 规定会话详情是
`messages[]{seq, role, content, requestId, createdAt}`，assistant-only 且“有才出现”的
`citations` 元素契约形状只有 `{"doc":"…"}`。因此：上游真给的（哪一轮的提问、第几条回答、
文档名、消息时间）才上屏，其余一律「—」+原因，绝不编页码/原话/链接。

## 二、下钻一条引用能看到什么（wired 模式真实 DOM 文本）

```text
引用的是 员工手册 · 考勤篇
原文位置 打开原文(/documents/doc_attendance)
在原文中的位置 第 12 页
来源 员工手册.pdf
这段引用从哪里来 当时的提问：员工迟到怎么算？ · 由一次运行引出(→/runs/run_20261119abcd)
被引用的原话 迟到三十分钟以内记为弹性工时，超过三十分钟需事前报备。
摘要 本页给出的是接口原样返回的条目……
留下这段引用 陈嘉禾 · E5F60718
时间 2026-11-19 15:20
```

只有契约里那种 `{"doc":"远程办公约定.pdf"}` 的引用（真实上游形状）：

```text
引用的是 远程办公约定.pdf
原文位置 原文不可达 · 上游没有给出原文位置，无法打开原文。
在原文中的位置 —上游没有给出这段内容在原文里的位置
来源 —上游没有给出来源文档或空间
这段引用从哪里来 会话 · 6789ABCD 的第 2 条回答 · 当时的提问：远程办公要谁批？
被引用的原话 —上游没有给出被引用的原话
摘要 —上游没有给出这段内容的摘要
留下这段引用 员工 · FF6F42E1
时间 2026-11-19 13:56
```

## 三、状态与 DOM 读数（Chromium 无头，哈希深链；harness 在 /tmp，未入库）

```text
today  ×{1440,1280,375} ×{#/knowledge, ?tab=retrieval, ?tab=citations, ?tab=evidence, ?tab=ingest}
  → 5/5 面板正确（spaces/retrieval/evidence/evidence/ingest），fixture 节点=0，
    docSW==vw==bodySW，页容器 SW==CW，屏面无 GAP-03、无 403/404/500、无路由、无字段名，
    surfaces: knw5-search=unwired/len0 knw5-records=ready/len0 knw5-citations=unwired/len0
              knw5-session-cites=ready/len0 knw5-ingest-tasks=unwired/len0 knw5-ingest=unwired/len0
    errors: none
wired  ×三档 → evidence: drills=4 opens=1 unreach=3；retrieval: drills=2 opens=2 unreach=1；
  drill 后 url=`…panel=evidence&ref=cit_page&tab=spaces` detail=true；
  reload 后 detail=true tab=evidence；换面板再 goBack 后 detail=true tab=evidence（4/4 保持）
failing ×{500 citations, 403 spaces, 404 sources} →
  error 正文：这次没能读到知识数据 / 数据服务暂时没有响应，请稍后重试。+ 请求编号 + 复制 + 重试（无状态码）
  403 正文 === 404 正文（逐字一致，GAP-03 只在 title）
  骨架：aria-busy=true aria-label=加载中 data-state=loading
```

## 四、验证尾行（本轮）

```text
$ npx vitest run src/modules/knowledge
 Test Files  2 passed (2)
      Tests  27 passed (27)

$ npx vitest run
 Test Files  127 passed (127)
      Tests  1303 passed (1303)

$ npx eslint src/modules/knowledge
（无输出，exit 0）

$ npx tsc -b . --noEmit | grep modules/knowledge
（无输出，本模块 0 错）

$ npx vite build --outDir /private/tmp/knw6-dist --emptyOutDir
✓ built in 4.21s
```

## 五、修掉的一处真实缺陷

`referencesOf` 里 `rows.map(citationOf)` 会把数组下标当成第二个参数（会话）漏进适配器，
导致引用登记面的「这段引用从哪里来」显示 `来自会话 · null`。改为逐元素显式调用，
并加了两条断言（页码/原话/提问只在上游真给时出现；`cit_*` 原始编号不进屏面）。

边界同前：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App/shell/routes/registry/
package/lock/web/scripts/ops；未重启 9122；无 force、无 amend、无 `--no-verify`。

---

# KNW5 追加：数据接入面按数据源成行（2026-11-20 BJT）

基线：`git merge-base --is-ancestor HEAD 33fc7029` 为真且 porcelain 空 → `git reset --hard 33fc7029`
（快进保留历史；上一轮 `10eaa7ae` 已在目标内，来路未改动 `modules/knowledge`）。

## 一、探针（cookie 只在 curl 命令内拼 Header，值零回显；9122 只读、未重启、未重建）

```text
404 knowledge.not_wired     /agent-api/api/knowledge/sources?limit=20    rows=0   ← 本页指定的接入读口
404 knowledge.not_wired     /agent-api/api/knowledge/citations?limit=20  rows=0
404 knowledge.not_wired     /agent-api/api/knowledge/spaces              rows=0
404 console.unknown_route   /agent-api/api/knowledge/ingest?limit=20     rows=0
404 console.unknown_route   /agent-api/api/knowledge/ingest/tasks        rows=0
404 console.unknown_route   /agent-api/api/knowledge/tasks               rows=0
404 console.unknown_route   /agent-api/api/knowledge/documents?limit=20  rows=0
404 console.unknown_route   /agent-api/api/documents?limit=50            rows=0
404 console.unknown_route   /agent-api/api/datasources?limit=20          rows=0
404 console.unknown_route   /agent-api/api/connectors?limit=20           rows=0
404 console.unknown_route   /agent-api/api/knowledge/search?q=员工&limit=5 rows=0
```

BFF 只点名三条知识读口（`_KNOWLEDGE_NOT_WIRED_ROUTES`：spaces / sources / citations）。
接入面因此打 `/api/knowledge/sources`；`ingest|tasks|ingest/tasks|documents|datasets|datasources|connectors`
全是裸 unknown_route，不当成契约。`/api/tasks` 有 20 行真数据但属运营任务看板（`source.kind`
只有 manual/console，`kind=knowledge`、`type=ingest` 都被忽略），**不借它的行**。

结论：读口今天不通 → 面板呈现一份「未接入」正文（GAP-03 只进 `title`）+ 人话原因 +
可复制请求编号 + 重试 + 明确申请入口（`knw5-ingest-tasks-apply` → /approvals）。
按数据源成行的真实渲染同批实现，用 wired 读数与单测证明，不靠样例。

## 二、一行一个数据源（375 堆叠态的真实 DOM 文本，wired 模式）

```text
列头：名称 / 类型 / 最近一次 / 状态 / 条目数          sw=375 vw=375
row1 名称=人事制度库（2026 年修订版全文）| 类型=SharePoint | 最近一次=最近同步：2026-11-19 14:40
     状态=同步中 | 条目数=1,380 条 已处理 412 条
row2 名称=法务合同归档 | 类型=对象存储 | 最近一次=最近同步：2026-11-19 13:05 | 状态=已完成 | 条目数=0 条
row3 名称=薪酬口径外部镜像 | 类型=网页抓取 | 最近一次=— 上游没有给出时间
     状态=失败 凭据已过期，无法登录源站 | 条目数=214 条
row4 名称=工单系统接口 | 类型=接口同步 | 最近一次=— 上游没有给出时间
     状态=失败 上游记的原因偏技术，这里不原样上屏；悬停可看原文。（title=ECONNREFUSED 10.0.0.8:8443 after 3 retries）
     条目数=— 约 5.0 MB 上游没有给出这一条有多少条目
row5 名称=— 上游没有给出这个数据源叫什么 | 类型=— 上游没有给出来源类型 | 最近一次=— 上游没有给出时间
     状态=待核实 上游没有给出同步状态 | 条目数=— 上游没有给出这一条有多少条目
```

口径：

- 状态只出这四个词（外加确实存在的 部分完成 / 已停用 / 已取消）：**待同步 / 同步中 / 失败 / 已完成**；
  上游没给状态 → 「待核实」+原因，不猜。
- 失败带原因：人话原样上屏；技术性原文（堆栈、地址、端口、状态码、重试字样）不进屏面，
  改说一句可操作的说明并把原文留在 `title`。
- 条目数只认真正表示“多少条”的字段：真 0 写「0 条」，没给写「—」+原因；
  只有大小时另起一行写「约 X MB」，不当条目数。
- 时间列写清它是哪一刻（最近同步 / 最近处理 / 最近更新 / 登记时间），一律北京时区到分。
- 原始 `sourceId` / 状态英文值 / 字段名一律不上屏，只在 `title`。

## 三、门禁复核（today / wired / failing × 1440 / 1280 / 375，Chromium 无头，harness 在 /tmp 已删）

```text
四 tab：spaces:OK ingest:OK retrieval:OK evidence:OK（三档视口全通过，哈希与路径两种写法都可直达）
today  ：knw5-ingest-tasks=unwired/len0 knw5-ingest=unwired/len0，apply 入口存在，rows=0（不编行）
wired  ：knw5-ingest-tasks=ready/len5（375 同样 len5，无横向溢出）
failing：403 的正文 === 404 的正文（逐字一致），两者 title 均为 GAP-03，均带 rid + 重试 + 申请入口
401    ：state=login，「需要登录…重新登录后就能再看这块知识数据」+ 重试
data-fixture 节点：三模式 × 三档视口 = 0（前一轮也是 0，本轮保持 0）
屏面泄漏检查：GAP-03 / 403 / 404 / 500 / 路由 / unknown_route / not_wired /
             sourceId / itemCount / lastError / syncStatus / ECONNREFUSED  全部 false
页面报错：none
```

`ref=` 展开行仍随 URL：切面板后浏览器后退回到 `…panel=evidence&ref=cit_page&tab=spaces`
且 detail=true（1440/1280 实测）。

## 四、验证尾行（本轮）

```text
$ npx vitest run src/modules/knowledge
 Test Files  2 passed (2)
      Tests  27 passed (27)

$ npx vitest run
 Test Files  127 passed (127)
      Tests  1296 passed (1296)

$ npx eslint src/modules/knowledge
（无输出，exit 0）

$ npx tsc -b . --noEmit | grep modules/knowledge
（无输出，本模块 0 错）

$ npx vite build --outDir /private/tmp/knw7-dist --emptyOutDir
✓ built in 3.85s
```

`pnpm build` 的已知非本域阻塞（LoginPage / approvals 两处）按指示未追。

边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App / shell / routes / registry /
package / lock / web/scripts / ops；未触碰 9122；无 force、无 amend、无 `--no-verify`、无 `git add -A`。

---

# KNW5 追加：知识空间面按空间成行（2026-11-20 BJT）

基线：porcelain 为空且 `git merge-base --is-ancestor HEAD 9fedd46f` 为真 → `git reset --hard 9fedd46f`
（快进保留历史，上一轮 `61ebae8d` 已在目标内；来路未改动 `modules/knowledge`）。
IA 计数复核（`node scripts/assert-ia.mjs --source=react`，只读运行）：**routes=51 / tabs=22 /
chatHosts=1 / modules=8 / badCode=[]，ok=true，headHash=9fedd46f** — 本轮未改 manifest 数量。

## 一、探针（cookie 只在 curl 命令内拼 Header，值零回显；9122 只读、未重启、未重建）

```text
404  knowledge.not_wired     /agent-api/api/knowledge/spaces                 rid 83f906415a9a  rows=0
404  knowledge.not_wired     /agent-api/api/knowledge/spaces?limit=20        rid 9297aecac6e6  rows=0
404  knowledge.not_wired     /agent-api/api/knowledge/spaces?limit=1         rid 9104d1f2ac6f  rows=0
404  knowledge.not_wired     /agent-api/api/knowledge/sources?limit=20       rid afd9b4e832a6  rows=0
404  knowledge.not_wired     /agent-api/api/knowledge/citations?limit=20     rid bceb6c8fab8b  rows=0
404  console.unknown_route   /agent-api/api/knowledge/search?limit=12        rid b54645011f0c  rows=0
404  console.unknown_route   /agent-api/api/knowledge                        rid 1cbe411ed742  rows=0
404  console.unknown_route   /agent-api/api/documents?limit=50               rid 36deda494d60  rows=0
```

空间读口三条查询形态都是 BFF 点名的 fail-closed 404（`knowledge.not_wired`，带 rid），
所以线上按第 3 条分支呈现：一份「知识空间读口未接入」正文 + 人话原因 + GAP-03 只进 `title`
+ 可复制请求编号 + 重试 + 申请入口；不编空间、不写「0 个」。页面读口同时改为
`/api/knowledge/spaces?limit=20`（与其它列表面一致，显式限量）。

## 二、一行一个空间（wired 模式真实 DOM 文本，375）

```text
列头：空间名称 / 文档数 / 最近同步 / 状态        data-state=ready data-len=5  sw=375 vw=375
row1 空间名称=人事制度知识空间（含 2026 修订版与历史归档）团队空间 | 文档数=1,284 篇
     最近同步=最近同步：2026-11-19 14:00 | 状态=已同步
row2 空间名称=财务口径 个人空间 | 文档数=0 篇 | 最近同步=最近更新：2026-11-19 04:30 | 状态=可用
row3 空间名称=全租户公共层 租户空间 | 文档数=— 分块 320 段 上游没有给出这个空间有多少文档
     最近同步=— 上游没有给出时间 | 状态=同步中
row4 空间名称=工单镜像空间 | 文档数=77 篇 | 最近同步=— 上游没有给出时间
     状态=失败 上游记的原因偏技术，这里不原样上屏；悬停可看原文。（title=ECONNREFUSED …）
row5 空间名称=— 上游没有给出这个空间叫什么 | 文档数=— 上游没有给出这个空间有多少文档
     最近同步=— 上游没有给出时间 | 状态=待核实 上游没有给出空间状态
```

口径：

- **文档数**只认真正表示“多少篇”的字段；上游真给 0 就写「0 篇」，没给就「—」+原因，
  只有分块或大小时另起副行（「分块 N 段」「约 X MB」），不冒充文档数。
- **最近同步**写清它是哪一刻：真给同步/索引时间才写「最近同步」，否则据实写
  「最近处理 / 最近更新 / 登记时间」；一律北京时区到分。
- **状态**只出 已同步 / 同步中 / 待同步 / 失败 / 可用 / 部分可用 / 已停用；
  认不出来或没给一律「待核实」+原因，不猜一个好听词。
- 失败带原因：人话原样上屏；技术性原文（连接被拒、IP:端口、重试字样）不进屏面，
  改说可操作说明，原文留在 `title`。
- `spaceId`、`documentCount`、英文状态词、`chunkCount` 等原始值一律不上屏，只在 `title`。

## 三、门禁复核（Chromium 无头，harness 在 /tmp 已删；today / wired / empty / denied）

```text
四 tab（含 compat 写法）5/5 命中：?tab=spaces / ?tab=scope / ingest / retrieval / citations→evidence
模块内 tab 选中态：knw5-tab-spaces=true 其余 false；刷新后仍 knw5-tab-spaces；后退回到 knw5-tab-ingest
today  ：state=unwired len=0，head=知识空间读口未接入，title=GAP-03，rid 可复制、重试、申请入口都在
denied ：403 的 head + 原因与 404 逐字一致（只有请求编号不同），title 同为 GAP-03
empty  ：200 空列表 → state=ready len=0，正文「接口已响应，但列表为空；这不等于「没有空间」，也不写 0 个」
写入口：spaces/ingest/citations 面 writeEntries=0；检索面的输入框是读侧关键词（不属于写入）
[data-fixture] 节点：四种模式 × 1440/1280/375 全为 0
溢出：docSW==vw==bodySW（1440/1280/375），页容器 SW==CW，OVERFLOW 元素 0
屏面泄漏：GAP-03 / 403 / 404 / 500 / 503 / 路由 / unknown_route / not_wired /
         spaceId / documentCount / chunkCount / syncStatus / lastError / ECONNREFUSED /
         indexed / indexing / 0 个空间  —— 全部 false
页面报错：none
```

## 四、验证尾行（本轮）

```text
$ npx vitest run src/modules/knowledge
 Test Files  2 passed (2)
      Tests  28 passed (28)

$ npx vitest run
 Test Files  127 passed (127)
      Tests  1303 passed (1303)

$ npx eslint src/modules/knowledge
（无输出，exit 0）

$ npx tsc -b . --noEmit | grep modules/knowledge
（无输出，本模块 0 错）

$ npx vite build --outDir /private/tmp/knw8-dist --emptyOutDir
✓ built in 3.77s
```

`pnpm build` 的全项目 typecheck 仍停在两处非本域文件（`src/pages/LoginPage.test.tsx:131,149`、
`src/modules/approvals/api.test.ts:118,119`），按指示未追、未改。

边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
manifest 数量 / package / lock / web/scripts / ops；未重启或重建 9122；无 force、无 amend、
无 `--no-verify`、无 `git add -A`。

---

# KNW5 追加 R36：数据源接入面按源成行（2026-11-20 BJT）

基线：porcelain 空 + `git merge-base --is-ancestor HEAD 165e62a5` 为真 → `git reset --hard 165e62a5`
（快进保留历史；上一轮 `916776a1` 已在目标内，来路未改动 `modules/knowledge`）。

## 一、探针（cookie 只在 curl 命令内拼 Header，值零回显；9122 只读、未重启、未重建）

```text
404  console.unknown_route   /agent-api/api/knowledge/ingest            rid 55916ccd9157  rows=0
404  console.unknown_route   /agent-api/api/knowledge/ingest?limit=20   rid 80438d8c2bcb  rows=0
404  knowledge.not_wired     /agent-api/api/knowledge/sources           rid 5c5702a285c9  rows=0
404  knowledge.not_wired     /agent-api/api/knowledge/sources?limit=20  rid 8239ff522d5a  rows=0
404  console.unknown_route   /agent-api/api/knowledge/tasks?limit=20    rid 1820343bcc86  rows=0
404  console.unknown_route   /agent-api/api/knowledge/documents?limit=20 rid 7e680f528339 rows=0
404  documents.read_not_wired /agent-api/api/documents?limit=50         rid 25a095c794b4  rows=0   ← 本轮新出现的专属码
404  knowledge.not_wired     /agent-api/api/knowledge/spaces?limit=20   rid b855f850405b  rows=0
404  knowledge.not_wired     /agent-api/api/knowledge/citations?limit=20 rid 8d555ba188a5 rows=0
404  console.unknown_route   /agent-api/api/knowledge/search?limit=12   rid 0107ba390552  rows=0
```

接入面的指定读口仍是 BFF 点名的 `/api/knowledge/sources`（`knowledge.not_wired`）；
`ingest|tasks|ingest/tasks|documents|datasets` 都是裸 unknown_route，不当契约。
新观察：`/api/documents` 已从通用 unknown_route 换成本环境专属的
`documents.read_not_wired`——两个读口的失败语义不同，页面正文因此各自点名自己那份
（此前两条都念同一句通用文案）。

## 二、按源成行（wired 模式真实 DOM 文本，375 与 1440 同读）

```text
列头：来源名称 / 类型 / 最近同步 / 状态 / 条目数     data-state=ready data-len=5  sw=375 vw=375
row1 人事制度库 | SharePoint | 最近同步：2026-11-19 14:40 | 同步中 | 1,380 条 · 已处理 412 条
row2 法务合同归档 | 对象存储 | 最近同步：2026-11-19 13:05 | 已完成 | 0 条           ← 上游真给 0
row3 薪酬口径外部镜像 | 网页抓取 | 最近更新：2026-11-19 12:20 | 失败 凭据已过期，无法登录源站
     条目数=— 上游没有给出这一条有多少条目                                          ← 时间来自更新字段，如实写
row4 工单系统接口 | 接口同步 | 最近同步=— 上游没有给出时间 | 失败 上游记的原因偏技术，这里不原样上屏；悬停可看原文。
     条目数=— 约 5.0 MB 上游没有给出这一条有多少条目                                ← 大小不冒充条目数
row5 —（副行依次说明缺什么）| 待核实 上游没有给出同步状态 | — 上游没有给出这一条有多少条目
```

- 时间口径与空间面对齐：先看真正的同步/索引时间并写「最近同步」，只有更新/登记时间时
  就据实写「最近更新 / 登记时间」，一律北京时区到分。
- 状态词：待同步 / 同步中 / 失败 / 已完成（另有确实存在的 部分完成 / 已停用 / 已取消）；
  没给或认不出来 → 待核实 + 原因。
- 条目数只认“多少条”的字段；真 0 写「0 条」，缺就「—」+原因；代码里没有 `?? 0`，
  屏面也没有样例行或「0 个源」。
- 屏面零工程语言：路由、状态码、字段名、`ECONNREFUSED`/`retries` 均不出现
  （类型列里的 SharePoint 是工具名，不是字段名；已逐词在浏览器文本里核对）。

## 三、未接入正文（一份，点名自己的读口；403 与 404 逐字同体）

```text
404 /api/knowledge/sources  → head「数据源接入读口未接入」 title=GAP-03  retry+apply 齐  table=false  fixture=0
403 /api/knowledge/sources  → 同上正文逐字一致，只有请求编号不同
404 /api/documents          → head「文档登记读口未接入」 …不写「0 篇」
```

## 四、门禁复核（Chromium 无头；today / wired / denied × 1440 / 1280 / 375）

```text
深链 5/5：?tab=ingest、?tab=sources、根、?tab=retrieval、?tab=citations → 面板依次 ingest/ingest/spaces/retrieval/evidence
选中态：模块内 [role="tab"][aria-selected=true] = knw5-tab-ingest 等，四 tab 4/4
刷新/后退：reload 仍 knw5-tab-ingest；back 回到 knw5-tab-retrieval（符合历史语义）
溢出：docSW == vw == bodySW（1440/1280/375），页容器 SW==CW，OVERFLOW 元素 0
[data-fixture]：三模式全 0；写入口 0（检索面的关键词框是读侧）
泄漏：GAP-03 / 403 / 404 / 500 / 路由 / not_wired / unknown_route / sourceId / itemCount /
      totalItems / syncStatus / lastError / sizeBytes / ECONNREFUSED  全部 false
页面报错：none
```

## 五、验证尾行（本轮）

```text
$ npx vitest run src/modules/knowledge
 Test Files  2 passed (2)
      Tests  29 passed (29)

$ npx vitest run
 Test Files  129 passed (129)
      Tests  1327 passed (1327)

$ npx eslint src/modules/knowledge
（无输出，exit 0）

$ npx tsc -b . --noEmit | grep modules/knowledge
（无输出，本模块 0 错）

$ npx vite build --outDir /tmp/knw9-dist --emptyOutDir
✓ built in 3.87s   （产物只落 /tmp）
```

`pnpm build` 的全项目 typecheck 仍停在非本域文件，按指示未追、未改。

边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package / lock / web/scripts / ops；未重启或重建 9122；无 force / amend / `--no-verify` / `git add -A`。

---

# KNW5 追加：入库状态面（ingest-status）（2026-11-20 BJT）

基线：porcelain 空 → `git fetch origin lane/hermes-console` + `git merge`（**不 rebase、不 force**）。
来路 tip = `fa2c3bf7`（在预期的 `466e2d2b` 之上多一枚 gate ledger 戳记），`b886b72d` 为其祖先，
合并为快进、零冲突；来路未改动 `web/src/modules/knowledge/**`。

## 一、探针（cookie 只在 curl 命令内拼 Header，值零回显；9122 只读、未重启、未重建）

```text
HTTP 404  /agent-api/api/knowledge/ingest-status
   body[:120] {"code": "console.unknown_route", "message": "unknown console API route"}
   rows=0（无行数组；这不在 BFF 自己点名的读口清单里）

HTTP 404  /agent-api/api/knowledge/spaces
   body[:120] {"code": "knowledge.not_wired", "message": "本环境未接入知识库读口", "rid": "b9f1187b"}
   rows=0

旁证：sources → 404 knowledge.not_wired；documents → 404 documents.read_not_wired；
      citations → 404 knowledge.not_wired；search / tasks / datasets → 404 console.unknown_route
```

入库状态读口没有接上，所以第 2 步（有数据）不成立，按第 3 步落地：一份诚实正文
「**入库状态未接入**」+ 人话原因 + GAP-03 只进 `title` + 可复制请求编号 + 重试 +
既有申请入口；不编来源、不放样例、不写「0 个源」。三个读口（ingest-status / sources /
documents）各自点名自己那份没接上，互不借数。

## 二、入库状态启用后的行口径（wired 模式真实 DOM，`data-len=5`）

```text
列头：来源名称 / 类型 / 最近同步 / 状态 / 条目数      sw=1440/1280/375 均 == vw，fixture=0
row1 人事制度库 | SharePoint | 最近同步：2026-11-19 14:40 | 进行中 | 1,380 条 · 已处理 412 条
row2 法务合同归档 | 对象存储 | 最近同步：2026-11-19 13:05 | 已完成 | 0 条           ← 上游真给 0
row3 薪酬口径镜像 | 网页抓取 | —  上游没有给出时间 | 失败 凭据已过期，请重新授权 | 214 条
row4 工单镜像 | 接口同步 | —  上游没有给出时间 | 失败 上游记的原因偏技术，这里不原样上屏；悬停可看原文。
     条目数=— 约 5.0 MB 上游没有给出这一条有多少条目                                ← 大小不冒充条目数
row5 —（缺名）| —（缺类型）| —（缺时间）| 待核实（缺状态）| —（缺条目数）
```

- 状态词按本页口径：待同步 / 进行中 / 已完成 / 失败（+原因）；认不出来或没给 → 待核实 + 原因。
  （同一屏里 `数据源接入任务` 面用同一套行适配器，两面对同一状态词给出一致说法。）
- 真 0 与缺失可区分：`0 条` 只在上游真给 0 时出现；缺失是「—」+缺什么；代码里没有 `?? 0`。
- 技术性失败原文（连接被拒、IP:端口、重试字样）不进屏面，只进 `title`。
- 屏面零工程语言：路由、状态码、字段名、`in_progress`、`ECONNREFUSED` 全部 false。

## 三、四态与门禁复核（Chromium 无头；today / wired / denied / 强制上游不可用）

```text
未接入   state=unwired len=0，无表格；403 正文与 404 正文逐字相等（true），请求编号不同，title 同为 GAP-03
错误     强制 503：state=error，「这次没能读到知识数据 / 数据服务暂时没有响应，请稍后重试。」
         + 可复制请求编号（rid-upstream-busy-77）+ 重试；屏面无 500/503/404 数字；
         点重试后重新真请求（该口回 404 就如实回到未接入，不留在旧数据）
骨架     读口挂起时 data-state=loading，[data-testid$="-loading"] 存在，aria-busy=true
空态     200 { items: [] }：state=ready len=0，正文「……这不等于一个源都没有，也不写 0 个源」，行数 0
四 tab  1440/1280/375 全 4/4；深链 5/5（?tab=ingest、?tab=sources、根、?tab=retrieval、?tab=citations）
保持    刷新仍 knw5-tab-ingest；后退回 knw5-tab-retrieval；面板 data-tab 与选中 testid 一致
溢出     docSW == vw == bodySW；页容器 SW==CW；OVERFLOW 元素 0；写入口 0
fixture  today / wired / denied / 强制错误 四组 × 三档视口 [data-fixture] 全部为 0（端点没启用时也不会冒出来）
testid   本面新增家族：knw5-ingest-status、-table、-row、-time、-count、-failure、-source、
         -unwired、-empty、-error、-loading、-request-id、-retry、-apply
         实测 ingest 面板 DOM 内 knw5-* testid 数：未接入 26 / 有数据 27（原 knw5-* 全部保留）
页面报错 none
```

## 四、验证尾行（本轮）

```text
$ npx vitest run src/modules/knowledge
 Test Files  2 passed (2)
      Tests  30 passed (30)

$ npx vitest run
 Test Files  131 passed (131)
      Tests  1347 passed (1347)

$ npx eslint src/modules/knowledge
（无输出，exit 0）

$ npx tsc -b . --noEmit | grep modules/knowledge
（无输出，本模块 0 错）

$ npx vite build --outDir /tmp/knw10-dist --emptyOutDir
✓ built in 3.72s   （产物只落 /tmp）

$ node scripts/assert-ia.mjs --source=react
（只读复核：51 / 22 / 1 / 8 未变）
```

边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重启或重建 9122；无 force / amend / `--no-verify` /
`git add -A`。`pnpm build` 的非本域 typecheck 阻塞按指示未追。

---

# KNW5 追加 R40：引用行深（目标对象 / 真人账号 / 暂无引用）（2026-11-20 BJT）

安全闸：porcelain 空 → fetch → `git merge-base --is-ancestor HEAD d0b50590` 为真 →
`git reset --hard d0b50590`（快进保留历史；来路 `998cb124` 已含本轮上一提交）。
注意：来路里的 R39（`5fe7dec1`）给本模块加了 `?state=` 内容预览开关，本轮未动它，
实测普通 URL（不带 `?state=`）下 `[data-fixture]` 仍为 0。

## 一、探针（cookie 只在 curl 命令内拼 Header，值零回显；9122 只读、未重启、未重建）

```text
HTTP 404  /agent-api/api/knowledge/citations?limit=20   code=knowledge.not_wired  rid 56c84a8d62  行数 0
HTTP 404  /agent-api/api/knowledge/citations            code=knowledge.not_wired  rid aba4552486  行数 0
HTTP 200  /agent-api/api/console-sessions?limit=20      items=0
HTTP 200  /agent-api/api/sessions?limit=20              sessions=0 total=0
HTTP 200  /agent-api/api/audit?action=kb.read&limit=50  events=0
HTTP 404  /agent-api/api/run-events?runId=run_probe&kind=citation&limit=20   code=run.not_found（探针 id 是编的，不据此造引用）
```

引用登记读口仍是 BFF 点名的 fail-closed 404；能给出真实引用的只有会话族，
而它今天回 200 但 0 个会话。所以两条腿分别是：**一条诚实「未接入」**与
**一条诚实「暂无引用」**，都不放样例、都不写 0 条。

## 二、每行给什么（wired 模式真实 DOM，`knw5-citations=ready/len3`）

```text
row1 PDF 员工手册 · 考勤篇 | — 上游没有给出这段内容的摘要 | 来源：员工手册.pdf | 指向：文档 · 20261119
     留下：陈嘉禾 · FF6F42E1 | 时间：2026-11-19 15:20 | 第 12 页 | 打开原文（站内可点）
row2 引用 薪酬口径说明 | 摘要（原样一句）| 来源：— 上游没有给出来源文档或空间 | 指向：知识片段 · 00000991
     留下：真人账号 | 时间：2026-11-19 14:10 | 原文不可达：上游给出的原文位置不是站内地址，无法直接打开。
row3 引用 —（缺标题）| —（缺摘要）| 来源：—（缺来源）| 指向：—（上游没有说明这段引用指向哪个对象）
     留下：—（没说谁留下）| 时间：—（没给时间）| 原文不可达：上游没有给出原文位置，无法打开原文。
```

- **目标对象**是这段引用指的是哪个对象：`文档 / 知识片段 / 业务记录 / 知识空间 / 网页` + 短码；
  文档名归「来源」列，不重复占位；上游没给就说没给，不编一个对象。
- **归属人话化**：`actor` / `createdBy` 的 `{type,id}` 翻译成「数字员工 / 真人账号 / 系统 / 待核实」，
  id 取去类型前缀后的尾段短码；短码不足四位就只说身份词（`human:1` → 「真人账号」），
  原值只进 `title`。屏面不出现 `emp_…`、`human:`、`HUMAN1`、`cs_…`、`cit_…`。
- 时间一律北京时区到分（07:20Z → 15:20，06:10Z → 14:10）；站内位置可点回原文，
  站外或缺失显「原文不可达」并给具体原因。
- 下钻一块（`*-detail`）把上面这些一次给全，另加 在原文中的位置 / 被引用的原话 / 从哪里来
  （当时的提问、由一次运行引出）；`ref=` 进 URL，刷新与后退都还原。

## 三、四态确实换内容（同一面在四种回答下的 DOM 分支，Chromium 实测）

```text
404 /api/knowledge/citations → data-state=unwired，出「未接入」正文 + 原因 + title=GAP-03 + rid 可复制 + 重试，行 0
403 同一路由                 → 正文与 404 逐字相等（true），只有请求编号不同；行 0
200 { citations: [] }        → data-state=ready len0，走 *-empty 分支：「暂无引用。接口已响应，……不写 0 条」；
                               会话那条腿同样「暂无引用」；行 0
503 上游不可用               → data-state=error，正文「这次没能读到知识数据 / 数据服务暂时没有响应，请稍后重试。」
                               + 可复制请求编号 + 重试；此时未接入正文不存在（不是只换徽标）
挂起中                       → data-state=loading，出 *-loading 骨架（aria-busy），无表格
```

其余复核：`[data-fixture]` 在 today/wired/empty/denied/boom 五组模式普通 URL 下都为 **0**；
写入口 **0**；1440/1280/375 三档 `docSW == vw == bodySW`、页容器 `SW == CW`、无溢出元素；
屏面泄漏检查（裸 id / 字段名 / 状态码 / 路由 / `GAP-03` / 假 0）全部 false；页面报错 none；
深链 `#/knowledge?tab=citations` 与 `?tab=evidence` 都落到引用面板并选中 `knw5-tab-evidence`；
面板内 `knw5-*` testid 计数：未接入 17，有数据 27（原 knw5-* 家族全部保留）。

## 四、验证尾行（本轮）

```text
$ npx vitest run src/modules/knowledge
 Test Files  2 passed (2)
      Tests  32 passed (32)

$ npx vitest run
 Test Files  131 passed (131)
      Tests  1369 passed (1369)

$ npx eslint src/modules/knowledge
（无输出，exit 0）

$ npx tsc -b . --noEmit | grep modules/knowledge
（无输出，本模块 0 错）

$ npx vite build --outDir /tmp/knw11-dist --emptyOutDir
✓ built in 3.94s   （产物只落 /tmp）
```

边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重启或重建 9122；无 force / amend / `--no-verify` /
`git add -A`。非本域的 `pnpm build` typecheck 阻塞按指示未追。

---

# KNW5 追加 R42：检索面真检索深（2026-11-20 BJT）

安全闸：`git rev-parse --show-toplevel` = 本 worktree、porcelain 空、
`git merge-base --is-ancestor HEAD e33b3531` 为真 → `git reset --hard e33b3531`（快进保留历史）。
来路 wave-11 在本模块删掉了页根的 `data-fixture` 属性（`?state=` 的内容预览开关保留），
属他车道闸门，本轮不回滚；另注：壳层在 `?state=` 下自己会挂两枚 fixture 标记，
普通 URL 下 `[data-fixture]` 实测为 0。

## 一、探针（cookie 只在 curl 命令内拼 Header，值零回显；9122 只读、未重启、未重建）

```text
HTTP 404  rid 6e2ef9f848  /agent-api/api/knowledge/search?q=员工&limit=5
   body[:120] {"code": "console.unknown_route", "message": "unknown console API route"}
   命中行数 0（响应里没有行数组）

HTTP 404  rid 2e23dabaa9  /agent-api/api/knowledge/search?limit=12
   body[:120] {"code": "console.unknown_route", "message": "unknown console API route"}
   命中行数 0
```

检索读口没接入，因此线上走第 3 条：一份 **`检索未接入`** 正文 + 人话原因 + **去处**
（正文里指明可以先看「证据与引用」里会话留下的引用；开通这枚读口去审批中心提申请，
正文下方即 `knw5-search-apply` 入口）+ 可复制请求编号 + 重试；GAP-03 只进 `title`。
不编命中、不给命中数、不放样例。空集分支（第 200 但 0 条）文案是「**没有匹配结果**」。

## 二、每条命中给什么（wired 真实 DOM，`knw5-search=ready/len3`，1440/1280/375 同读）

```text
hit1 PDF 员工手册 · 考勤与加班 | 摘要（原样一句，超长三行截断，全文在 title）
     来源：员工手册.pdf | 指向：文档 · 20261119 | 留下：— 上游没有说明这段内容是谁留下的
     时间：2026-11-19 15:05 | 第 12 页 | 打开原文（站内可点）
hit2 引用 外部镜像：加班口径问答 | 摘要 | 来源：— 上游没有给出来源文档或空间
     指向：— 上游没有说明这段引用指向哪个对象 | 时间：2026-11-19 14:40
     原文不可达：上游给出的原文位置不是站内地址，无法直接打开。
hit3 引用 只有一条标题 | —（缺摘要）| —（缺来源）| —（缺对象）| —（缺归属）| —（缺时间）
     原文不可达：上游没有给出原文位置，无法打开原文。
```

下钻一块（`knw5-search-results-detail`，`ref=hit_full` 进 URL，刷新后仍展开）：
引用的是 / 原文位置 / 在原文中的位置 / 来源 / 指向的对象 / 这段引用从哪里来（当时的提问）/
被引用的原话 / 摘要 / 留下这段引用 / 时间。缺的逐项写「—」+缺什么，绝不借上面一条的值。

## 三、四态真的换内容（同一面四种回答下的 DOM 分支，Chromium 实测）

```text
404 → data-state=unwired，出 *-unwired 正文（head=检索未接入，title=GAP-03）+ rid 可复制 + 重试 + 申请入口；结果表不存在
403 → 与 404 正文逐字相等（375 下 len=114 与 114，BYTE-IDENTICAL: true），只有请求编号不同
500 → data-state=error，出 *-error：「这次没能读到知识数据 / 数据服务暂时没有响应，请稍后重试。」
      + 可复制请求编号 + 重试；此时未接入正文不存在（不是只换徽标）
挂起 → data-state=loading，出 *-loading 骨架（aria-busy），无结果表
200 空集 → data-state=ready len=0，出 *-empty「没有匹配结果。接口已响应，这份回答里没有条目；
      这不等于知识库是空的，也不给命中数。」+「先看会话里留下的引用」去处；行 0
```

其余复核：哈希 `/knowledge?tab=retrieval` 与路径两种写法都挂到本模块检索面板
（URL 分别归一到 `?panel=retrieval` 与 `?tab=spaces&panel=retrieval`）；
`docSW == vw`（1280/375）与页容器 `SW == CW`（1440/1280/375）无横向溢出；
`[data-fixture]` 普通 URL 全 0；写入口 0（关键词框是 GET 读查询，不是写入）；
屏面无状态码 / 路由 / `GAP-03` / 裸 id / 字段名 / 假 0；页面报错 none；
检索面板 `knw5-*` testid 计数：未接入 21 / 有数据 27（原 `knw5-*` 家族全部保留）。

## 四、顺手修掉的一处真实缺陷（本轮）

`manifest.ts` 的深链归一在**新文档尚未落定自己的 history entry** 时调用
`history.replaceState(window.history.state, …)` 会抛 `InvalidStateError`，
而它在模块加载期执行——足以打断整个 SPA 启动（实测同一浏览器上下文里
先走哈希再走路径写法时复现）。现在归一写入统一走 `replaceKnowledgeUrl()`：
try/catch 包住、失败就保持原地址不重写，因为面板本身也能直接从 `?tab=` 解析
（新增用例断言 replaceState 抛错时模块仍能 import、且 `initialTab` 照样给出
retrieval）。修后三档视口重跑：`mode=today errors: none`。

## 五、验证尾行（本轮）

```text
$ npx vitest run src/modules/knowledge
 Test Files  2 passed (2)
      Tests  34 passed (34)

$ npx vitest run
 Test Files  131 passed (131)
      Tests  1380 passed (1380)

$ npx eslint src/modules/knowledge
（无输出，exit 0）

$ npx tsc -b . --noEmit | grep modules/knowledge
（无输出，本模块 0 错）

$ npx vite build --outDir /tmp/knw12-dist --emptyOutDir
✓ built in 3.77s   （产物只落 /tmp）

$ node scripts/assert-ia.mjs --source=react
（只读复核：51 / 22 / 1 / 8，ok=true）
```

边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes /
registry / package·lock / web-scripts / ops；未并 main、未重启或重建 9122；
无 force / amend / `--no-verify` / `git add -A`。非本域的 `pnpm build` 阻塞按指示未追。

---

# KNW5 追加 R43：知识空间面加「来源」列（2026-11-20 BJT）

安全闸：toplevel 相符 → porcelain 空 → fetch → `git merge-base --is-ancestor HEAD b71c4535` 为真 →
`git reset --hard b71c4535`（快进保留历史，上一轮 `14d44b42` 已在目标内；来路未改动 `modules/knowledge`）。

## 一、探针（cookie 只在 curl 命令内拼 Header，值零回显；9122 只读、未重启、未重建）

```text
HTTP 404  rid f821eb1a93  /agent-api/api/knowledge/spaces
   body[:120] {"code": "knowledge.not_wired", "message": "本环境未接入知识库读口", "asOf": "2026-11-19T22:01:17Z", "rid": "f821eb1a"}
   行数 0（没有行数组）

HTTP 404  rid 2f25a7bfd9  /agent-api/api/knowledge/sources?limit=20
   body[:120] {"code": "knowledge.not_wired", "message": "本环境未接入知识库读口", "asOf": "2026-11-19T22:01:18Z", "rid": "2f25a7bf"}
   行数 0

HTTP 404  rid 1f2cefb8da  /agent-api/api/knowledge/spaces?limit=20
   body[:120] {"code": "knowledge.not_wired", "message": "本环境未接入知识库读口", "asOf": "2026-11-19T22:01:18Z", "rid": "1f2cefb8"}
   行数 0
```

新观察：fail-closed 信封现在带 `asOf`。这一页**不**把它当「数据截至」显示——
错误响应里的时刻只代表网关回答的那一刻，不代表任何数据；读不到就照旧写
「这块数据没有读到，数据截至时间未知」，接上后 `asOf` 才进入来源行（wired 实测
`来源：知识空间登记 · 数据截至 2026-11-19 15:00`，200 空列表实测 `… 2026-11-20 06:10`）。
两腿也不互借：404 正文只说自己那枚读口，不拿 sources 的数字补 spaces。

## 二、逐空间（wired 真实 DOM，`knw5-spaces=ready/len5`，三档视口同读，375 不横溢）

```text
列头：空间名称 / 来源 / 文档数 / 最近同步 / 状态
row1 人事制度空间（团队空间） | 来源=SharePoint · 集团人事库 | 文档数=1,240 篇
     最近同步=最近同步：2026-11-19 14:20 | 状态=已同步
row2 空的知识空间              | 来源=对象存储             | 文档数=0 篇          ← 上游真给 0
     最近同步=最近同步：2026-11-19 12:00 | 状态=可用
row3 对外口径镜像              | 来源=外部地址 · mirror.example.com | 文档数=18 篇
     最近同步=— 上游没有给出时间 | 状态=待核实              ← 认不出的值不猜
row4 断掉的数据库空间          | 来源=crm-mysql            | 文档数=— 分块 512 段
     （上游没有给出这个空间有多少文档）
     最近同步=— 上游没有给出时间 | 状态=失败 上游记的原因偏技术，这里不原样上屏；悬停可看原文。
row5 —（缺名） | —（缺来源） | —（缺文档数） | —（缺时间） | 待核实（缺状态）
```

- **来源人话**新列：有名字就用名字；只给工具/连接器就翻成 对象存储 / SharePoint /
  网页抓取 / 数据库 / 接口同步 …；只给 URL 就写「外部地址 · 主机名」，
  完整地址与原始 id 一律只进 `title`（屏面扫到 `https://mirror…` = false）。
  上游没说从哪来就写「—」+「上游没有说明这个空间的内容从哪里来」。
- **文档数**：真 0 写「0 篇」，没给写「—」+原因；只有分块或大小时另起副行
  （分块 512 段 / 约 X MB），不冒充文档数；代码里没有 `?? 0`。
- **最近同步**只在真给同步/索引时间时叫「最近同步」，否则据实写
  最近更新 / 登记时间；一律北京时区到分。
- **状态**只出 已同步 / 同步中 / 待同步 / 失败 / 可用 / 部分可用 / 已停用；
  认不出或没给一律「待核实」+原因；失败带原因，技术性原文只进 `title`。

## 三、四态真的换内容（同一面四种回答下的 DOM 分支，Chromium 实测 375）

```text
404 → data-state=unwired，正文「知识空间未接入」+ 原因 + 去处（正文指明可先看「证据与引用」，
      并给 knw5-spaces-apply → /approvals）+ 可复制请求编号 + 重试；无表格、行数 0；title=GAP-03
403 → 正文与 404 逐字相等（true），只有请求编号不同；title 同为 GAP-03
500 → data-state=error，正文「这次没能读到知识数据 / 数据服务暂时没有响应，请稍后重试。」
      + 可复制 rid + 重试；此时未接入正文不存在（不是只换徽标）
挂起 → data-state=loading，出 knw5-spaces-loading 骨架（aria-busy=true），表格不存在
200 空集 → data-state=ready len=0，出 knw5-spaces-empty「当前没有读到知识空间。接口已响应，
      但列表为空；这不等于「没有空间」，也不写 0 个。」；行数 0
```

`data-fixture` 口径复核：普通 URL（`#/knowledge?tab=spaces`、路径写法、`?tab=scope` 兼容写法）
实测 `[data-fixture]` = **0**；只有 `?state=` 强制态下为 2，且这两枚是**壳层**自己挂的
（`shell-fixture-badge` 存在，页内没有本模块的 forced 块），符合「只在强制态出现、普通 URL 为 0」。
其余：`docSW == vw == bodySW`（1440/1280/375）页容器 `SW == CW`，OVERFLOW 元素 0；
写入口 0（无 post 表单、无输入控件）；屏面无状态码 / 路由 / `GAP-03` / 裸 id / 字段名 /
`ECONNREFUSED` / 假 0；页面报错 none。
testid：原 `knw5-*` 全保留（`knw5-spaces`、`knw5-spaces-table/-row/-source/-unwired/-empty/-error/
-loading/-request-id/-retry/-apply` 等），新增本面行内家族 8 个：
`knw5-space-name / -scope / -source / -docs / -docs-extra / -time / -status / -failure`。
IA 计数未动：`assert-ia --source=react` → 51 / 22 / 1 / 8，ok=true。

## 四、验证尾行（本轮）

```text
$ npx vitest run src/modules/knowledge
 Test Files  2 passed (2)
      Tests  35 passed (35)

$ npx vitest run
 Test Files  131 passed (131)
      Tests  1394 passed (1394)

$ npx eslint src/modules/knowledge
（无输出，exit 0）

$ npx tsc -b . --noEmit | grep modules/knowledge
（无输出，本模块 0 错）

$ npx vite build --outDir /tmp/knw13-dist --emptyOutDir
✓ built in 3.91s   （产物只落 /tmp）
```

边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes /
registry / package·lock / web-scripts / ops；未并 main、未重启或重建 9122；
无 force / amend / `--no-verify` / `git add -A`；非本域 `pnpm build` 阻塞未追。

---

# KNW5 追加 R45：空间详情位的文档列表（testid `kn3-docs-*`）（2026-11-20 BJT）

安全闸：toplevel 相符 → porcelain 空 → 显式 `git fetch origin lane/hermes-console:refs/remotes/origin/lane/hermes-console`
→ `git merge-base --is-ancestor HEAD 02a7385c` 为真 → `git reset --hard 02a7385c`（快进保留历史，
上一轮 `9cda9dd7` 已在目标内，来路未改动本模块）。未并 main、未重建 9122。

## 一、详情位落在哪儿（不动路由）

本 lane 不能改 App.tsx / shell / routes / registry，因此空间详情不是新路由，而是 spaces 面板内的
**查询态详情位**：`/knowledge?tab=spaces&panel=spaces&space=<空间标识>[&doc=<文档标识>]`。
空间行的名字是真实链接（有标识才成链接），点击写 `space=`；文档行的名字是真实可聚焦 `a[href]`
（react-router `Link`，渲染出的就是带 href 的锚点），点击写 `doc=`；「返回空间列表」清掉这两个参数。
切面板时 `space`/`doc` 与 `ref` 一起清掉，不带过期展开位。

## 二、探针（cookie 只在 curl 命令内拼 Header，值零回显；9122 只读）

```text
HTTP 404 rid f0962ff7c6 /agent-api/api/knowledge/spaces
   body[:120] {"code": "knowledge.not_wired", "message": "本环境未接入知识库读口", "asOf": "2026-11-19T22:31:26Z", "rid": "f0962ff7"}   行数 0
HTTP 404 rid 42e24f969b /agent-api/api/documents?limit=50
   body[:120] {"code": "documents.read_not_wired", "message": "本环境未接入文档读口（域与知识库上游均无该路由），前端请显「未接入」"…   行数 0
HTTP 404 rid dfd9171a24 /agent-api/api/knowledge/spaces/space_probe/documents?limit=50
   body[:120] {"code": "console.unknown_route", "message": "unknown console API route"}                                             行数 0
HTTP 404 rid 23f318b6a0 /agent-api/api/knowledge/documents?limit=50        unknown_route        行数 0
HTTP 404 rid 5683275a65 /agent-api/api/knowledge/document-list?limit=50    unknown_route        行数 0
HTTP 404 rid ba43b10edd /agent-api/api/knowledge/files?limit=50            unknown_route        行数 0
HTTP 404 rid c2d32ff254 /agent-api/api/knowledge/sources?limit=20          knowledge.not_wired  行数 0
HTTP 404 rid 2f25a7bfd9 /agent-api/api/documents?limit=50&spaceId=space_probe
   同上 documents.read_not_wired（路由在参数处理前被拦，spaceId 今天不改回答）                  行数 0
```

详情位的文档列表打的是**指定文档读口** `/agent-api/api/documents?limit=50&spaceId=<标识>`：
BFF 源码 R34 NC③ 把 `/api/documents` 点名成自己的 fail-closed 路由
（`documents.read_not_wired`，人话里直接写「前端请显『未接入』」），比嵌套的
`/knowledge/spaces/<id>/documents`（裸 unknown_route）更成契约。
注意：今天路由在 query 处理前就被拦掉，`spaceId` 只是接线后的自然过滤参数，**并未被服务端验证**——
所以名称筛选明确做成**本地筛选**并在屏上写清，不假称服务端过滤。
上游接线前 0 行 → 一份「空间不存在或未授权」正文（403/404/空间缺失同一段，GAP-03 只进 title），
不编文档、不放样例、不给数量，也不拿 spaces 的数字补文档数。

## 三、每行四列（wired 真实 DOM，375/1280/1440 同读，`kn3-docs=ready/len3`）

```text
列头：文档名 / 类型 / 大小 / 更新
row1 员工手册.pdf | PDF〈title:application/pdf〉 | 2.4 MB | 2026-11-19 15:10
row2 薪酬口径表.xlsx | 表格〈title:xlsx〉 | 40.0 KB | 2026-11-19 13:30
row3 —〈title:上游没有给出这份文档叫什么〉 | —〈title:上游没有给出文档类型〉
     | —〈title:上游没有给出文件大小〉 | —〈title:上游没有给出更新时间〉
```

- 缺值一律屏面「—」、原因进该格的 `title`（按本轮口径，不在屏面重复一串解释）。
- 类型人话：PDF / Word 文档 / 表格 / 表格（CSV）/ 演示文稿 / Markdown / 文本 / 结构化数据 / 网页 / 图片；
  MIME 取尾段，认不出的扩展名原样留着（那本来就是运营认得的名字）。
- 大小人话用 1024 进制（2.4 MB、40.0 KB）；没有大小就「—」，不拿别的数字凑。
- 更新时间北京时区到分（07:10Z → 15:10）；只有同步时间时按「最近同步」口径取，标签如实。
- 行是真实可聚焦 `a[href]`：三行的 href 均带 `doc=<文档标识>`，脚本 focus() 断言 activeElement 命中；
  点击是客户端路由（URL 从 `?space=sp_hr` 变成 `…&doc=doc_manual`，文档不重载）。
- 展开块给出 原文位置（站内 → 「打开原文」真链接 `/documents/doc_manual`；没给位置 →
  「原文不可达 · 上游没有给出原文位置，无法打开原文。」）、类型、大小、更新。
- 本地筛选：注一句「本地筛选：只在接口已经返回的这份列表里按名字挑，不再问一次服务，
  也不改变数量口径」；实测 `薪酬` → data-len 3→1，而 `/api/documents` 的资源请求数 **1→1**（没再发问）；
  筛空时文案是「本地筛选没有匹配：这份列表里有 3 份文档，按「zzz」一条都没留下」，
  与真·空集的「该空间暂无文档」严格两种说法。
- 没有标识的空间行不成链接，屏面直说「— 点不进文档列表」（原因进 title），不硬造一个假入口。

## 四、四态真的换内容（同一详情位四种回答，375 实测）

```text
404 documents.read_not_wired → data-state=unwired，正文「空间不存在或未授权」+ 三种可能的同一段说明，
                               title=GAP-03，可复制请求编号 + 重试 + 返回链接；无表、行 0
403 console.forbidden        → 正文与 404 逐字相等（true），只有请求编号不同
500 上游不可用                → data-state=error，正文「这次没能读到知识数据 / 数据服务暂时没有响应，
                               请稍后重试。」+ 可复制 rid + 重试；未接入正文不存在
200 { documents: [] }        → data-state=ready len=0，正文「该空间暂无文档。接口已响应，这份列表里没有文档；
                               这只说明这份回答是空的，不下别的结论，也不给数量。」
挂起中                        → data-state=loading + kn3-docs-loading 骨架，无表
```

其余复核：`[data-fixture]` 在普通 URL（含 `?space=` / `?doc=`）实测 **0**，只有 `?state=` 强制态由壳层挂出；
写入口 **0**（筛选框是 `type=search` 的读侧控件，全页无 post 表单 / 无 submit 按钮 / 无 select·textarea）；
1440/1280/375 `docSW == vw == bodySW`，页容器 `SW == CW`，OVERFLOW 元素 0；
屏面泄漏（`doc_manual`/`doc_xlsx`/`documentId`/`sizeBytes`/`mimeType`/`fileName`/`lastSyncAt`/
`/api/`/`not_wired`/403/404/500/`GAP-03`/假 0）全部 false；页面报错 none。
testid：本面新增 `kn3-docs` 家族 16 个（`-table/-row/-name/-type/-size/-updated/-detail/
-detail-open/-detail-unreachable/-unwired/-empty/-error/-loading/-request-id/-retry/-back/
-filter/-filter-input/-filter-note`），既有 `knw5-*` 与 `kn*` 一律未改名；
四 tab 仍 4/4、刷新与后退保 `space=`/`doc=`；`assert-ia` 复核 51 / 22 / 1 / 8。

## 五、验证尾行（本轮）

```text
$ npx vitest run src/modules/knowledge
 Test Files  2 passed (2)
      Tests  37 passed (37)

$ npx vitest run
 Test Files  131 passed (131)
      Tests  1402 passed (1402)

$ npx eslint src/modules/knowledge
（无输出，exit 0）

$ npx tsc -b . --noEmit | grep modules/knowledge
（无输出，本模块 0 错）

$ npx vite build --outDir /tmp/knw14-dist --emptyOutDir
✓ built in 4.06s   （产物只落 /tmp）
```

本轮顺手避掉一处真实错误用法：行锚最初写成裸 `<a href>`，在 SPA 里点击会整页重载；
改成 `Link` 后仍是带 href 的可聚焦锚点，但走客户端路由（实测 URL 变化、文档不重载）。
非本域 `pnpm build` 阻塞未追；无 force / amend / `--no-verify` / `git add -A`。

---

# KNW5 追加 R47：顶部跨空间文档名搜索框（testid `kn6-search-*`）（2026-11-20 BJT）

安全闸：toplevel 相符 → porcelain 空 → 显式 refspec fetch → `git merge --no-edit refs/remotes/origin/lane/hermes-console`
（tip `f0419b0b`，与预期一致；**未用 reset --hard**，`35451fd8` 与合并提交 `513bddef` 都在）→ 零冲突。
未并 main、未重建 9122。

## 一、后端是否接受 `q` / `query`：实测不接受（cookie 只在 curl 命令内拼 Header，值零回显）

```text
HTTP 404 rid da7280fd4f /api/knowledge/documents?q=员工&limit=50   console.unknown_route     过滤后条数 0
HTTP 404 rid 171ffcfe0d /api/knowledge/documents?query=员工&limit=50 console.unknown_route   过滤后条数 0
HTTP 404 rid 2b3b2321e7 /api/documents?q=员工&limit=50             documents.read_not_wired  过滤后条数 0
HTTP 404 rid 00117e3985 /api/documents?query=员工&limit=50          documents.read_not_wired  过滤后条数 0
HTTP 404 rid 007f015e7f /api/documents?limit=50                    documents.read_not_wired  过滤前条数 0
HTTP 404 rid e4d550e9f3 /api/knowledge/spaces/sp_hr/documents?q=员工 console.unknown_route    过滤后条数 0
HTTP 404 rid c6381f0da4 /api/knowledge/search?q=员工&limit=50       console.unknown_route     过滤后条数 0
```

结论：带不带 `q`/`query` 回答**逐字一致**（该路由在 query 解析前就被 fail-closed 拦掉，
BFF 源码 R34 NC③；路由表里也没有 `/api/documents` 的 `passthrough` 白名单可指望），
所以**没有可声称的服务端过滤**：搜索框只做本地筛选，且屏面必须写清。

## 二、口径

- 框固定在 `/knowledge` 顶部（tab 条之上），四个页签都在；`?q=` 进 URL，可分享、刷新复现，
  回填输入框并给出同一份筛选结果。
- 只取数一次：本地筛选**不再发请求**。实测 `手册` 输入时 `/api/documents` 资源计数 1→1，
  提交 `?q=手册` 后仍 1→1；`data-len` 4→1。
- 框下注脚（wired）：「仅在当前已加载 4 条内搜索：这份文档读口今天不接受关键词参数
  （实测 q 与 query 回答一致），所以这里不叫全库搜索；换关键词不会再请求一次。」
  读口没通时改为不带条数的同一句口径，绝不写「全库」。
- 无结果：「没有匹配的文档：已加载的 4 条里没有名字含「查无」的文档。这是本地筛选的结果，
  不代表全库没有。」+ 就地清除入口；空列表本身另说「这只说明这份回答是空的，不下别的结论，也不给数量」。
- 行仍是真实可聚焦 `a[href]`（实测 `focus()` 后 activeElement 命中，4/4 行）：
  点开写 `?sdoc=<文档标识>`，与空间详情位的 `?doc=` 各自独立、互不覆盖。
- 列：文档名 / 所属空间 / 类型 / 大小 / 更新（北京时区到分）。缺失屏面只写「—」，
  原因进该格 `title`；上游没给空间就「—」，不硬编「未知空间」；
  认不出的类型值不再上屏（改「其他类型」，原值进 title）。
- 打不开就写「原文不可达」+这一条自己的原因（站外地址 / 没有给位置两种说法实测都在）。
- 清除入口会把**未提交的输入框文本**一起清掉——只动 URL 的话，没按回车的关键词会看着清不掉
  （本轮顺手修掉的一处真实交互缺陷）。
- 零写入口：全页无 `form[method=post]`、无 textarea/select/checkbox；搜索框是
  `type=search` 的读侧控件，提交只做客户端路由。
- 他车道的 `?state=` 预览开关仍“一个请求都不发”：强制态下本框整体不挂载（实测
  `kn6-search-panel` 不存在且 `fetch` 零调用）。

## 三、状态与四页签读数（Chromium 无头，today / wired / denied × 1440 / 1280 / 375）

```text
404 文档读口 → data-state=unwired，正文「文档登记读口未接入」，title=GAP-03，
              可复制请求编号 + 重试 + 申请入口，行 0，注脚自动去掉条数
403 → 正文与 404 逐字相等（true），只有请求编号不同
wired → data-state=ready len=4，四行 anchor，本地筛选 len→1 且文档请求数不变，
        `?q=` 提交进 URL 并在刷新后复现，清除后 len 回 4、URL 干净
挂起中 → data-state=loading + 骨架，无表
溢出：三档 sw==vw==bodySW，页容器 SW==CW，无 OVERFLOW 元素；[data-fixture]=0；writes=0
泄漏：GAP-03 / 403 / 404 / 500 / 路由 / not_wired / d_manual / sp_hr / fileName / sizeBytes /
      mimeType / limit=50 全部 false；页面报错 none
四页签：#/knowledge?tab=spaces|ingest|retrieval|citations 四档视口全部命中，
        `kn3-docs-*` 回归通过（空间详情位仍 ready，行 href 仍写 doc=）
成本记录：ingest 页签上顶部框与该面自己的文档登记面都读 `/api/documents?limit=50`，
          该页一次加载会看到 2 次同一读口——每个面各打自己那一次请求是本页一贯口径，
          没有把两面并成一个数；关键词切换仍是 0 次额外请求。
```

## 四、验证尾行（本轮）

```text
$ npx vitest run src/modules/knowledge
 Test Files  2 passed (2)
      Tests  39 passed (39)

$ npx vitest run
 Test Files  131 passed (131)
      Tests  1404 passed (1404)

$ npx eslint src/modules/knowledge
（无输出，exit 0）

$ npx tsc -b . --noEmit | grep modules/knowledge
（无输出，本模块 0 错）

$ npx vite build --outDir /tmp/knw15-dist --emptyOutDir
✓ built in 4.08s   （产物只落 /tmp）

$ node scripts/assert-ia.mjs --source=react
（只读复核：51 / 22 / 1 / 8，ok=true）
```

testid：新增 `kn6-search-*` 家族（panel/form/input/submit/clear/note/table/row/name/space/type/size/
updated/detail/detail-open/detail-unreachable/unwired/empty/error/loading/request-id/retry/apply/
empty-clear），`kn3-docs-*` 与 `knw5-*` 一字未改。
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；无 force / amend / `--no-verify` / `git add -A`；
非本域 `pnpm build` 阻塞未追。

---

# KNW5 追加 R48：空间列表页顶部跨空间搜索 `kn8-global`（2026-11-20 BJT）

安全闸：toplevel 相符；porcelain 曾为 4 个本域文件（上一轮 R49 抽屉实现完但未落笔）→
按“脏先提交，不丢改动”先补交 `8831b934 feat(console): knowledge document preview drawer`
（其中修掉一处真实缺陷：遮罩 z-index 40 与壳层移动头同层、低于侧栏 z=50，
实测 `elementFromPoint(6,6)` 命中的是页头而不是遮罩，点顶栏区域关不掉抽屉；
提到 60 后 1440/375 均命中 `kn7-preview-backdrop`，点击即关且焦点回到原行）。
随后显式 refspec fetch + `git merge`（**未用 reset --hard**）：来路 tip = `5d91f22d`
（预期 `6a02ed58` 之后又多一枚 gate 戳记，已核 `6a02ed58` 为其祖先），零冲突，
来路未改动本模块。未并 main、未重建 9122。

## 一、后端是否吃 `q`：不吃（cookie 只在 curl 命令内拼 Header，值零回显；筛前/筛后条数）

```text
HTTP 404 rid 2d1c31a157 /api/knowledge/spaces                    筛前 0 条
HTTP 404 rid 5ee17e9c79 /api/knowledge/spaces?q=人事              筛后 0 条（信封逐字一致）
HTTP 404 rid 1d642de41d /api/knowledge/spaces?limit=20&q=人事      筛后 0 条
HTTP 404 rid 062fdadca8 /api/knowledge/sources?limit=20&q=人事     筛后 0 条
HTTP 404 rid 69404ccd43 /api/knowledge/search?q=人事&limit=50      筛后 0 条（console.unknown_route）
HTTP 404 rid 80ada150e6 /api/documents?limit=50&q=员工             筛后 0 条（documents.read_not_wired）
HTTP 200 rid c0826216dc /api/console-sessions?limit=20&q=人事      200 items=0（q 被忽略）
HTTP 200 rid ea545738dc /api/audit?action=kb.read&limit=50&q=人事  200 events=0（q 被忽略）
```

带不带 `q` 回答**逐字一致**（路由在 query 解析前就被 fail-closed 拦掉），两个 200 的读口
则直接忽略 `q`——所以没有任何可声称的服务端过滤：`kn8-global` 只做**本地筛选**，
并在 `kn8-scope-note` 里把口径写死，绝不假装服务端搜索。

## 二、口径与实测读数

- 注脚（有数据时）：「仅在当前已加载 3 个空间内搜索：空间读口今天不接受关键词参数
  （实测带 q 与不带 q 回答一致），所以这里不叫全库搜索，键入也不会再请求一次。命中 1 个。」
- **回答为空时不写条数**：改成「这一份空间回答里没有可筛的空间……」，
  免得「已加载 0 个」看起来像本页到处禁止的假 0（文档框注脚同口径同步修好）。
- 命中数与展示同源：注脚的「命中 N 个」与表格行数都取自同一个筛选后的数组；
  实测输入「财务」→ rows=1、`data-len=1`、注脚「命中 1 个」。
- 键入零请求：实测 `/agent-api/` 资源计数 **2→2**（输入、筛选、清屏都不发请求）；
  提交才写 `?q=财务`，仍是 2；带 `?q=` 刷新复现（输入框回填「财务」、rows=1，计数仍 2）。
- 结果行是真 a[href] 到空间：三行 href 形如
  `/knowledge?tab=spaces&panel=spaces&space=sp_hr|sp_fin|sp_ops`，`focus()` 后 activeElement 命中第一行。
- 名字与来源都参与本地筛选（输入 `mirror` 也能命中只有来源没有名字的那条）。
- 无匹配：「没有匹配的空间：已加载的 3 个空间里没有名字或来源含「查无此空间」的空间。
  这是本地筛选的结果，不代表库里没有这样的空间。」+ 就地「清空」，
  清空同时收回框内文本与 `?q=`（实测 len 回 3、URL 干净）。

## 三、状态（Chromium 无头，wired / today / denied / empty / boom × 1440 / 1280 / 375）

```text
ready   → 3 行 / len=3 / 3 条空间链接 / 注脚带条数
404     → 「知识空间未接入」正文 + 人话原因 + 去处（先看「证据与引用」；去审批中心申请），
           title=GAP-03，请求编号可复制 + 重试 + 申请入口；注脚自动退成无条数版本
403     → 正文与 404 逐字相等（403 body === 404 body: true），只有请求编号不同
500     → data-state=error 换内容：「这次没能读到知识数据 / 数据服务暂时没有响应，请稍后重试。」
           + 可复制 rid + 重试；未接入正文不存在
200 空  → data-state=ready len=0，空态说「这不等于「没有空间」，也不写 0 个」
挂起中  → data-state=loading + 骨架（vitest 覆盖）
```

其余复核：`[data-fixture]` 三档视口全部 0；写入口 0（两个框都只是 `type=search` 的读侧控件）；
`docSW == vw == bodySW`、页容器无溢出元素；屏面泄漏（裸 `sp_*`、`sourceName`、`docCount`、
`lastSyncAt`、`/api/`、`not_wired`、状态码、`GAP-03`、假 0）全部 false；页面报错 none；
四 tab 与详情位互不破坏：`?tab=spaces&space=sp_hr&doc=d1` 深链下抽屉/文档列表/文档名框都在
（`kn7-preview-field-status=已完成`），而 `kn8-global` 只在空间列表页顶部出现，进了详情位就收起。

testid 家族计数（本面板空间列表页）：`kn8-*` 4 个（form/input/submit/scope-note，有关键词时再加 clear /
empty-clear），`kn6-*` 8 个，`knw5-*` 19 个；`kn3-*`/`kn7-*` 在详情位仍各 12/13 个（上轮实测），
本轮未改名未删除。`assert-ia --source=react` 仍 51 / 22 / 1 / 8。

## 四、验证尾行（本轮）

```text
$ npx vitest run src/modules/knowledge
 Test Files  2 passed (2)
      Tests  42 passed (42)

$ npx vitest run
 Test Files  132 passed (132)
      Tests  1456 passed (1456)

$ npx eslint src/modules/knowledge
（无输出，exit 0）

$ npx tsc -b . --noEmit | grep modules/knowledge
（无输出，本模块 0 错）

$ npx vite build --outDir /tmp/knw17-dist --emptyOutDir
✓ built in 4.05s   （产物只落 /tmp）
```

边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；禁 `git add -A`（按显式路径提交）；无 force / amend / `--no-verify`；
非本域 `pnpm build` 阻塞未追。

---

# KNW5 追加 R50：搜索命中的可读性与键盘（testid `kn9-*`）（2026-11-20 BJT）

安全闸：toplevel 相符、porcelain 空、显式 refspec fetch → tip 仍是 `5d91f22d`
（代码代次 `6a02ed58`），`git merge` 回「Already up to date」，零冲突；按要求未用 reset --hard。
未并 main、未重建 9122。

## 一、高亮 `<mark>`：只包住宿命那一段，不改文本语义

```text
输入「空间」→ 4 个 kn9-mark-space，第一个 mark 文本 ==「空间」
同一单元格整体文本仍是「人事制度空间」（读口给什么字，屏面就是什么字）
无关键词 → mark 数量 0（不会把整行涂成命中）
文档名同理：输入「员工」→ 2 个 kn9-mark-doc，mark 文本 ==「员工」
样式只上底色（color-mix 主题色 26%）与圆角，文字颜色继承，不改行高与列宽
```

## 二、`kn9-count`：与列表同一份筛选结果，本地模式明写口径

```text
无关键词：当前已加载 4 项，全部列出（还没输入关键词）：命中的行与这个数取自同一份筛选结果。
有关键词：当前已加载 4 项内命中 4 项……（`data-len` 同为 4，两处数字都来自同一个 shown 数组）
文档腿：  kn9-count-docs「当前已加载 2 项内命中 2 项」，与 kn6-search 的 data-len=2 同源
读口未通：两个计数元素直接不渲染（实测 counts=0），因此不会出现「已加载 0 项」这种
           看着像假 0 的句子；`fakeZero` 扫描（0 项 / 0 个 / 0 条）false
服务端模式：本环境没有任何读口吃 q（R47/R48 已逐条实测），所以这里只有本地口径；
           接线后应改为贴 total 或回显 q，本轮把这句话写进代码注释与本页说明
```

## 三、键盘（真实按键实测，roving tabindex 方案，与 aria-activedescendant 二选一）

```text
起点：焦点在 kn8-global-input（输入框带 aria-describedby="kn9-count"）
框内 ArrowDown → 焦点落到第一行链接 knw5-space-link，tabindex 变为 ["0","-1","-1","-1"]
  :focus-visible == true（轮廓 2px 主题色 + outline-offset 2px 可见）
列表内 ArrowDown → 第二行「财务口径空间」，:focus-visible == true
Home / End → 首行 / 末行（vitest 覆盖）
ArrowUp → 回上一行
Escape → 焦点交还搜索框，tabindex 全部回到 ["0","0","0","0"]（自然 tab 顺序恢复）
Enter → 走的就是该行真 a[href]：/knowledge?tab=spaces&panel=spaces&space=sp_fin
        实测落地后面板换成该空间的文档列表（kn3-docs 在、空间列表已收起）
文档腿：框内输入「员工」→ ArrowDown → 焦点到 kn6-search-name（href ?sdoc=d1，
        :focus-visible == true），Escape 同样交还焦点
未开始 roving 前所有行链接都可 Tab（tabindex 0），不会把行从 tab 序列里藏起来
```

## 四、没有退化的部分

- 空结果仍是「没有匹配的文档」/「没有匹配的空间」+ 就地清空出口（实测文本与按钮都在）。
- 四态与 403≡404：单测断言 403 正文与 404 正文逐字相等（spaces 与文档腿各自一条），
  错误态仍是人话 + 可复制请求编号 + 重试；挂起出骨架；本轮只是加高亮/计数/键盘，
  状态分支没动（today 模式实测 unwired head 仍为「文档登记读口未接入」「知识空间未接入」）。
- 1440 / 1280 / 375：`documentElement.scrollWidth == innerWidth == body.scrollWidth`
  （mark 与计数行都不加宽列），无 OVERFLOW 元素；`[data-fixture]` 三档实测 0；零写入口。
- 家族零破：`kn8-*`（4）、`kn7-*`（详情位 11）、`kn6-*`、`kn3-*`、`knw5-*` 全部保留，
  本轮新增 `kn9-space-list / kn9-doc-list / kn9-count / kn9-count-docs / kn9-mark-space / kn9-mark-doc`；
  抽屉与详情位深链复测正常（`?space=sp_hr&doc=d1` 抽屉打开、`kn7-preview-field-status` 读数在）。

## 五、验证尾行（本轮）

```text
$ npx vitest run src/modules/knowledge
 Test Files  2 passed (2)
      Tests  43 passed (43)

$ npx vitest run
 Test Files  132 passed (132)
      Tests  1457 passed (1457)

$ npx eslint src/modules/knowledge
（无输出，exit 0）

$ npx tsc -b . --noEmit | grep modules/knowledge
（无输出，本模块 0 错）

$ npx vite build --outDir /tmp/knw18-dist --emptyOutDir
✓ built in 4.15s   （产物只落 /tmp）

$ node scripts/assert-ia.mjs --source=react
（只读复核：51 / 22 / 1 / 8，ok=true）
```

边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；按显式路径提交（无 `git add -A`）；无 force / amend / `--no-verify`；
非本域 `pnpm build` 阻塞未追。

---

# KNW5 追加 R51：空间详情 ↔ 全库检索的返回保态与面包屑（testid `knB-*`）（2026-11-20 BJT）

安全闸：toplevel 相符、porcelain 空、显式 refspec fetch → tip 仍是 `5d91f22d`（代码代次 `6a02ed58`，
按要求不把 `02a7385c` 当现网）、`git merge` 回 Already up to date、零冲突；未用 reset --hard，
未并 main、未重建 9122。

## 一、返回保态（Chromium 真实导航与后退，实测 URL）

```text
列表无关键词  url=/knowledge                              面包屑：知识[current]（不出空检索层级）
输入并回车    url=/knowledge?q=人事                        面包屑：知识(链→?tab=spaces) / 检索「人事」[current]
进入空间      url=/knowledge?q=人事&tab=spaces&panel=spaces&space=sp_hr
              面包屑：知识 / 检索「人事」(链，带 q) / 人事制度空间[current]
进入文档      url=…&space=sp_hr&doc=d_manual               面包屑：知识 / 检索「人事」 / 人事制度空间(链→去掉 doc) / 员工手册.pdf[current]
连退两级回列表 url=/knowledge?q=%E4%BA%BA%E4%BA%8B  输入框回填「人事」  rows=1
              kn9-count「当前已加载 2 项内命中 1 项…」  mark 数=1
点面包屑「检索「人事」」回列表：q 与命中态同样复原（rows=1、count 同句）
```

`?q=` 全程留在地址里：进详情不清词，返回（浏览器后退或面包屑）都有同一份关键词与命中态，
命中数、行数与高亮都取同一个筛选后数组，不复算也不二次请求。

## 二、面包屑

```text
nav：role=navigate（<nav aria-label="位置">），层级 = 知识 /〔检索「q」〕/〔空间名〕/〔文档名〕
所有中间层都是页内真链（Link，客户端跳转，focus 可见）；末级是 <span aria-current="page">，不可点
键盘实测（1280）：knB-crumb-list:fv → knB-crumb-search:fv → knB-crumb-space:fv → knw5-tab-spaces:fv
空间名不靠 URL 回显：来自指定空间读口那一次请求（每层一次，不为每行文档重复问）
  读口通：  title=「名字取自空间读口」
  读口不通：文本退成「空间 · <标识尾段>」，title=「sp_hr｜空间名没读到（读口未接入、无权限，
            或这个标识不在已加载的空间里），这里只显示标识尾段。」——原始标识只在 title
文档名同理（「文档 · <尾段>」）；关键词为空时不渲染空的检索段
```

## 三、没有退化的门禁

```text
403 与 404 逐字同体：detail 视图下面包屑与各级正文在 today / denied 两种回答里完全一致，
  只有请求编号不同；kn3-docs 与抽屉都仍给可复制 rid + 重试（实测 rid-today-b7c1 / rid-denied-b7c1）
四态：未接入 / 空态 / 错误（可复制 rid + 重试）/ 骨架，均按面各自换内容
零写入口：form[method=post]、textarea、select、checkbox、number 计数 0
1440 / 1280 / 375：docSW == vw == bodySW；面包屑 flex-wrap + overflow-wrap，不撑宽
[data-fixture] 普通 URL 为 0；屏面无 GAP-03 / 状态码 / 路由 / 裸 id / 字段名
家族零破：kn8-*、kn9-*、kn6-search-detail*、kn3-docs-*、kn7-*、knw5-* 都在
  （实测 wired 详情：kn8=0（详情位不收关键词框）、kn9=2、kn7=11、kn6=10、kn3=20、knw5=8）
本轮顺手修掉一处真实结构缺陷：面包屑原先由三个面各自渲染，同一页出现两份同名 testid
  （byTestid 会先命中文档框那一份）；改为「面把最深一级的名字上报给页面，页面只渲染一条
  面包屑」，id 唯一、层级顺序也固定为 知识 / 检索 / 空间 / 文档。
```

## 四、验证尾行

```text
$ npx vitest run src/modules/knowledge
 Test Files  2 passed (2)
      Tests  44 passed (44)

$ npx vitest run
 Test Files  132 passed (132)
      Tests  1458 passed (1458)

$ npx eslint src/modules/knowledge
（无输出，exit 0）

$ npx tsc -b . --noEmit | grep modules/knowledge
（无输出，本模块 0 错）

$ npx vite build --outDir /tmp/knw19-dist --emptyOutDir
✓ built in 6.17s   （产物只落 /tmp）
```

边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；显式路径提交（无 `git add -A`）；无 force / amend / `--no-verify`。

---

# KNW5 追加 R52：文档列表本地排序（testid `knC-sort-*`）（2026-11-20 BJT）

基线：安全闸 toplevel 相符、porcelain 先为空、显式 refspec fetch。本车道先前已把基线 fast-forward
到 origin tip `7173b7c6`（现网代次 entry `index-B6GI2nKC.js`；未用 reset --hard）。`38793c9a`
（gate ledger，仍 stamped at 7173b7c6 / B6GI2nKC）合并进本域时经核 `git diff 7173b7c6..origin --
web/src/modules/knowledge` 为空——wave 不动知识面，R52 代码与合并后字节一致。

排序只在已经读到的行上本地排（点表头绝不再问服务）：
```text
默认口径  无参数 → updated/desc：新在前，缺更新时间那行恒末位
/knowledge?tab=spaces&space=sp_hr                       顺序 B·C·A·D（D 缺时间末位）
点名称    ?…&sort=name&dir=asc                          A·B·C·D
再点名称  ?…&sort=name&dir=desc                         D·C·B·A
点大小    ?…&sort=size&dir=desc（首点落大在前）          B·C·A·D（无大小 D 末位）
再点大小  ?…&sort=size&dir=asc                          A·C·B·D（缺大小仍末位、不当 0）
点时间    ?…&sort=updated&dir=asc（旧在前）             A·C·B·D（缺时间仍末位）
粘 URL/刷新复现：直接带 sort=size&dir=asc 进来即同一顺序，且 spaceId 读口只发那一次
```
Chromium 实测：表头三列都是 `BUTTON[type=button]`；Enter（大小）与 Space（时间）原生触发；
排序前后 `spaceId` 文档读口计数 1→1（0 次新请求）；`aria-sort` 三态挂在 th：
```text
unwired/有数据默认：name=none size=none updated=descending；点某列后该列 ascending/descending，其余 none
键盘：focus-visible 命中表头，Tab 在 knC-sort-name → knC-sort-size 间走
1440/1280/375 实测 docSW==vw==bodySW，无横溢（窄屏 thead 本就被 .knw5-table 隐藏）
```
排序前先按读入顺序定死每行 key（`row.id` 或 `row-<idx>`），再本地排，故抽屉/行链接落点不漂移。
testid 新增 `knC-sort-name|size|updated`；kn3-docs/kn6-search/kn7/kn8/kn9/knB 零破。

# KNW5 追加 R53：诚实不可用态收口（testid `knD-state-*`）（2026-11-20 BJT）

读口失败一律整块诚实态，绝不冒充空集（不出现「0 个空间 / 0 篇文档」这种把缺失当真的数量）：
```text
状态          可见正文                        机器标记（唯一）           屏面不泄露
404 not_wired  「…未接入」+原因+去处(审批)     knD-state-unavailable     无 403/404/GAP 字样
403 forbidden  与 404 逐字同体（同一段说明）    knD-state-denied          同上
200 空集       「接口已响应…不等于没有」         knD-state-empty           同上
有数据         正常表格                         （无 knD 标记）
```
GAP-03 只在块的 `title`；屏面全文只命中「不写「0 篇」」这一句免责声明（实测 hits 仅此一处），
不存在把 0 当数量的标签。

403≡404 沿用：同一读口的 403 与 404 可见正文逐字相同（Chromium 实测 LIST/DETAIL `equal=true`），
只靠 `knD-state-denied` / `knD-state-unavailable` 让自动化可分二者；`toSurf` 把状态记在 `denied`
布尔里、不改任何一个可见字符。

重试只重发该读口：点 `kn3-docs-retry` → 文档读口计数 1→2，空间读口（名字那一次）1→1（不连带）。
切空间不残留：`sp_hr`(筛「员工」rows=1) → `sp_fin` → rows=0、筛选框清空、块走 unavailable（不是空集）；
行与错误本随读口键 `space-docs|nonce|spaceId` 更换回骨架，本地筛选另加 useEffect 清零。

四态与可复制 rid、`kn3-docs-*`/`kn6-search*`/`kn7`/`kn8`/`kn9`/`knB`/`knC` 零破，1440/1280/375 无横溢、
普通 URL `[data-fixture]=0`。每个面在同一屏只挂一个 `knD-state-*`（按面 opt-in，仅空间列表与空间文档
两个面开），不撞名。

## 验证尾行（R52+R53 合并跑）
```text
$ npx vitest run src/modules/knowledge
 Test Files  2 passed (2)
      Tests  46 passed (46)

$ npx vitest run
 Test Files  137 passed (137)
      Tests  1588 passed (1588)

$ npx eslint src/modules/knowledge        → exit 0
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw20-dist → exit 0（R52）
$ npx vite build --outDir /tmp/knw21-dist → exit 0（R53，产物只落 /tmp）
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；显式路径提交（无 `git add -A`）；无 force / amend / `--no-verify`；
两笔 commit 分开（先 R52 后 R53），未混写。

# KNW5 追加 R54：文档列表游标分页（testid `knE-page-*`）（2026-11-20 BJT）

续作说明：本车道接手时被取消会话留下 `KnowledgeModulePage.tsx` / `knowledge.ts` 两处未提交半成品
（分页状态与信封解析已写、UI 未接线且遗留一个 `rows` 引用编译错）。全部保留、在其上补完，
未 reset、未 checkout 丢弃；新增防过期回写（代次计数：排序/筛选/换空间/刷新时，在路上的下一页
回答作废，不并回列表）。

## 一、探针（cookie 只在 curl 命令内拼 Header，值零回显；9122 只读、未重启、未重建）

```text
HTTP 404  rid 646eac0d  /agent-api/api/documents?limit=50&spaceId=sp_hr
   body[:120] {"code": "documents.read_not_wired", "message": "本环境未接入文档读口…前端请显「未接入」"…
   行数 0（响应里没有行数组）  nextCursor 字段：无   total 字段：无

HTTP 404  rid 61ded63f  /agent-api/api/documents?limit=50&spaceId=sp_hr&cursor=c2
   同上 documents.read_not_wired（路由在 query 处理前被拦，cursor 今天与 spaceId 一样不改回答）
   行数 0   nextCursor 字段：无   total 字段：无
```

线上因此走诚实不可用态（`knD-state-unavailable`，R53 口径），分页条不出现、不冒充；
分页行为在 wired fixture（vitest 桩信封）下逐态实测，见下。

## 二、分页口径（都只认信封给的字段，测试实测）

```text
取数       下一页 = /api/documents?limit=50&spaceId=<id>&cursor=<服务端给的游标>；
           第一页与 documentsUrl 完全同串（无 cursor），仍走 surface 四态与 knD 标记。
           绝不对本地数组切片假翻页，也绝不做滚动自动加载。
筛前/加载后  fixture：页1 读 2 行 → 点「显示更多」并回 1 行 → 共加载 3 行；
           重复行检查：三行 documentId 全集 size==3（按 id 去重；上游坏 cursor 静默重放首页时
           一行都不并回，进 knE-page-stale「游标已过期」并停止加载，给「重新读取列表」出口）。
总数        信封给 total → 「共 N 篇 / 已显示 M 篇」（翻页后 2→3 与 total 对账）；
           信封不给 total → 「已显示 M 篇 · 总数不可用」+ title 写明原因，加载到 3 也不冒充「共 3 篇」
           ——M 是加载后真实行数，绝不参与推算 N。
到末页      只认信封明说（有 nextCursor 字段且为 null）：按钮 disabled +「已到末页」+ 机器标记
           knE-page-end；字段整个缺失（今天线上的形状）→ 按钮「无分页游标」disabled，不谎称末页。
重置        排序 / 本地筛选 / 换空间 / 刷新变化 → 清空已累加页、游标退回第一页给的那个，0 新请求
           （R52「点表头不再问服务」计数 1→1 不破）；URL 只保 ?sort/?dir/?q=，分页不进地址。
失败        下一页 403≡404 逐字同体 + 可复制 rid（knE-page-request-id）+ 重试只再取这一页
           （首页与空间名读口计数不连带）；401 单独正文；已显示列表不受影响。
键盘        分页条里只有真 BUTTON[type=button]（显示更多/重试/重新读取列表），Tab 可达、Enter 原生触发。
```

testid 新增 `knE-page-bar` / `knE-page-count` / `knE-page-more` / `knE-page-end` /
`knE-page-error` / `knE-page-request-id` / `knE-page-retry` / `knE-page-stale` / `knE-page-reload`。
`knE-page-end` 沿用 knD-marker 手法（aria-hidden、display:none、不出字、不参与布局）。
kn3 / kn6 / kn7 / kn8 / kn9 / knB / knC / knD / knw5 全套既有断言零改零破。
分页条为 flex-wrap 行、无固定宽；本轮未重建 9122，三宽度横溢未做浏览器复测（构建产物只落 /tmp）。

## 验证尾行（R54）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 47 tests passed（含新增游标分页六段测试）
$ npx vitest run                         → 137 files / 1589 tests passed
$ npx eslint src/modules/knowledge       → exit 0（1 条 react-hooks/set-state-in-effect warning，
  条件变化时重置分页状态即为此形态，非 error，不压 gate）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw22-dist → exit 0（产物只落 /tmp）
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重启或重建 9122；显式路径提交（无 `git add -A`）；
无 force / amend / `--no-verify`；单 commit「feat(console): knowledge documents pagination」。

# KNW5 追加 R55：文档列表复制清单（testid `knF-*`）（2026-11-20 BJT）

基线安全闸：toplevel 相符、porcelain 先为空、显式 refspec fetch；交接写的上游 tip `053da5c4`
在合入时已前进到 `b797bc98`（gate ledger stamped at 053da5c4，代次一致），按最新 tip 合并，
无冲突。`git diff 053da5c4..b797bc98 -- web/src/modules/knowledge` 为空——wave 不动知识面，
R54/R55 代码与合并后字节一致。

## 一、口径

```text
取数       零新请求：复制文本只由当前排序与筛选后的可见行的屏上字符串拼成
           （测试实测：点复制前后 fetchMock 调用计数逐次相等，含筛选、排序、空态守卫各段）。
文本       「文档名 | 类型 | 大小 | 更新」头行 + 每可见行一条，顺序=屏上顺序；
           类型/大小人话与屏上逐字一致（PDF、表格、2.3 MB、40.0 KB），
           更新北京时间到分（07:10Z → 15:10）；缺值「—」，不当 0、不补值、不编行。
状态       knF-copy-status 常驻挂载（aria-live=polite）：成功「已复制」；
           回执带内容签名——列表文本一变（排序/筛选/翻页），旧「已复制」立即作废，
           不冒充当前清单复制过；文本没变的同序切换不作废（仍属实）。
失败       navigator.clipboard 拒绝或不可用（jsdom 实测两路）：状态「复制失败，已展开可选文本」
           + knF-fallback 只读 textarea（readOnly=true，value 与屏上文本逐字一致，可手动选取）；
           再点成功即收起。未走真浏览器权限弹窗路径（9122 禁重建，本机未能复测）。
空集       筛到 0 行或真 0 行：按钮 disabled + title 点名原因（「本地筛选没有留下行：这份列表里有
           N 份文档…」/「接口回答里没有文档…」），行计数「0 行」，不伪造任何行；
           读口未接入/失败/加载中不出复制条（没有列表可复制，不摆空控件）。
键盘       控件是真 BUTTON[type=button]（Tab 可达、Enter 原生触发）；fallback 是原生 textarea 可聚焦。
```

testid 新增 `knF-row` / `knF-copy` / `knF-lines` / `knF-copy-status` / `knF-fallback`。
kn3 / kn6 / kn7 / kn8 / kn9 / knB / knC / knD / knE / knw5 全套既有断言零改零破。
复制条为 flex-wrap 行、textarea 100% 盒宽，无固定宽；本轮未重建 9122，
三宽度横溢未做浏览器复测（构建产物只落 /tmp）。

## 验证尾行（R55）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 48 tests passed（含新增复制清单七段测试）
$ npx vitest run                         → 全部通过（合并 wave 后 1671 tests passed）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 set-state-in-effect warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw23-dist → exit 0（产物只落 /tmp）
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重启或重建 9122；显式路径提交（无 `git add -A`）；
无 force / amend / `--no-verify`；merge commit（053da5c4..b797bc98 代次）与单 feature commit
「feat(console): knowledge document list copy」分开。

# KNW5 追加 R56：全局文档名搜索的复制结果（testid `knG-*`）（2026-11-20 BJT）

基线安全闸：toplevel 相符、porcelain 先为空、显式 refspec fetch；上游 tip 仍为交接所述
`b797bc98`（generation 053da5c4），`git merge` 结果 Already up to date——本笔只有 feature commit。

## 一、口径（与 R55/knF 同一手法，作用于 `/knowledge` 顶部「按文档名搜索」的命中面）

```text
取数       零新请求：文本只由当前检索词下的命中行（屏上五列字符串）拼成。测试逐段实测
           fetchMock 计数在复制、键入筛选、提交关键词、0 命中守卫、fallback 各段前后一律不变
           （提交 ?q= 也只进 URL：doc-search 读口不随关键词重发，R51 口径）。
文本       头行「文档名 | 所属空间 | 类型 | 大小 | 更新」+ 每命中行一条，顺序=屏上命中顺序；
           人话值与屏上逐字一致（PDF、2.4 MB、15:10、空间 · SPFIN 取屏上空间标签，不落裸 id）；
           缺值「—」（无名/无空间/无类型/无大小/无时间各留各的 —，不当 0、不编行）。
状态       knG-copy-status 常驻挂载（aria-live=polite）：成功「已复制 N 条」（N=当次命中行数）；
           内容签名守卫——检索词一改，旧的「已复制 N 条」立即作废，不冒充当前结果复制过。
0 命中     筛到 0 条与真空集（200+0 条）都：按钮 disabled + title 逐字「当前没有可复制的结果」、
           行计数「0 条」；即便被触发也有守卫不写剪贴板。读口未接入/失败/加载中不出复制条。
失败       navigator.clipboard 拒绝与不可用两路（jsdom 实测）→ 「复制失败，已展开可选文本」
           + knG-copy-fallback 只读 textarea（value 与屏上文本逐字一致）；再点成功即收起。
键盘       BUTTON[type=button] 真按钮，Tab 可达、Enter 原生触发；fallback 原生 textarea 可聚焦。
```

testid 新增 `knG-row` / `knG-copy` / `knG-lines` / `knG-copy-status` / `knG-copy-fallback`。
kn3 / kn6 / kn7 / kn8 / kn9 / knB / knC / knD / knE / knF / knw5 全套既有断言零改零破。
复制条 flex-wrap、textarea 100% 盒宽，无固定宽；本轮未重建 9122，三宽度横溢未做浏览器复测。

## 验证尾行（R56）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 49 tests passed（含新增复制结果六段测试）
$ npx vitest run                         → 138 files / 1672 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 set-state-in-effect warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw24-dist → exit 0（产物只落 /tmp）
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重启或重建 9122；显式路径提交（无 `git add -A`）；
无 force / amend / `--no-verify`；单 commit「feat(console): knowledge search results copy」。

# KNW5 追加 R57：空间列表的复制清单（testid `knI-*`）（2026-11-20 BJT）

基线安全闸：toplevel 相符、porcelain 先为空、显式 refspec fetch；上游 tip 仍为交接所述
`b797bc98`（generation 053da5c4），merge 结果 Already up to date——本笔只有 feature commit。

## 一、口径（与 R55/knF、R56/knG 同一手法，作用于 `/knowledge` 的空间列表面）

```text
取数       零新请求：文本只由当前屏上可见行拼成。测试逐段实测 fetchMock 计数在复制、键入
           筛选、提交 ?q=、0 命中守卫、fallback 各段前后一律不变（提交只进 URL：spaces 读口
           不随关键词重发，R50 口径）。
禁冒充全量 文本首行逐字：「当前已加载 N 个空间；本清单只覆盖这份回答，不冒充全库。」
           检索词筛过时另起一行「以下为检索词「q」筛后的可见行。」——复制件自己带着口径，
           离开这屏也能看清它不是全库清单（读口 limit=20、无分页游标）。
文本       头行「空间名 | 文档数 | 最近更新 | 短码」+ 每可见行一条，顺序=屏上行顺序；
           值与屏上逐字同源：文档数「12 篇」、缺「—」（原因仍在屏上，不另编）；
           时间带屏上同款前缀（「最近同步：2026-11-19 14:20」「最近更新：…」，BJT 到分），
           缺「—」；短码取人话尾段（SPHR/SPFIN），裸 sp_ 实测不进文本，
           全 id 仍在行的 title（屏上口径不变）。
状态       knI-copy-status 常驻挂载（aria-live=polite）：成功「已复制 N 行」（N=当次可见行）；
           内容签名守卫——列表或检索词一变，旧的「已复制 N 行」立即作废。
0 行       筛到 0 行与真空集都：按钮 disabled + title 逐字「当前没有可复制的空间」+ 守卫不写
           剪贴板；读口未接入/失败/加载中不出复制条（没有列表可复制，不摆空控件）。
失败       navigator.clipboard 拒绝与不可用两路（jsdom 实测）→「复制失败，已展开可选文本」
           + knI-copy-fallback 只读 textarea（value 与文本逐字一致）；再点成功即收起。
键盘       BUTTON[type=button] 真按钮，Tab 可达、Enter 原生触发；fallback 原生 textarea 可聚焦。
```

testid 新增 `knI-row` / `knI-copy` / `knI-lines` / `knI-copy-status` / `knI-copy-fallback`。
kn3 / kn6 / kn7 / kn8 / kn9 / knB / knC / knD / knE / knF / knG / knw5 全套既有断言零改零破。
复制条 flex-wrap、textarea 100% 盒宽，无固定宽；本轮未重建 9122，三宽度横溢未做浏览器复测。

## 验证尾行（R57）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 50 tests passed（含新增空间复制六段测试）
$ npx vitest run                         → 138 files / 1673 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 set-state-in-effect warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw25-dist → exit 0（产物只落 /tmp）
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重启或重建 9122；显式路径提交（无 `git add -A`）；
无 force / amend / `--no-verify`；单 commit「feat(console): knowledge spaces list copy」。

# KNW5 追加 R58：空间卡片与空间详情文档列表的 roving tabindex（键盘收口）（2026-11-20 BJT）

基线安全闸：toplevel 相符、porcelain 空、显式 refspec fetch；上游仍 `b797bc98`
（generation 053da5c4），merge 为 Already up to date——本笔只有 feature commit。

## 一、口径

```text
钩子       复用 R50 的 useRovingRows（空间卡片 kn8、检索命中 kn6 本在用），本轮把同一钩子
           接到空间详情文档列表（新 scope data-roving="kn3"，行链接 kn3-docs-name）：
           ↑/↓ 逐行走、Home/End 首末行、越界钳位（首行↑不动）；Enter 打开该行真 a[href]
           （浏览器原生激活，行是 client-routing 的 Link，href 带 doc=）；Esc 回搜索框
           （文档列表→筛选框 #kn3-input，空间卡片→#kn8-input），焦点归还后 roving 状态清空。
tab 序     进入 roving 后同时只有一个 tabindex=0、其余 -1，全程无正数（测试逐行读数）；
           未进入/Esc 退出后退回原生 DOM 序——文档列表保持「无显式属性」原形态（R49 断言
           tabindex null 不破），空间列表保持既有显式 0 形态（R50 断言不破）。
aria       焦点所在行的链接带 aria-current="true"，其余无——空间卡片与文档列表同规格，
           与实际焦点严格同步（测试：↓、End、Home、Esc 各态读数）。
不劫持     空结果与读口 404：列表没有行时方向键 defaultPrevented=false、焦点与原生滚动不动
           （测试用 cancelable 事件实测），也不渲染 roving scope；屏面仍走既有空态/诚实
           不可用正文（kn3-docs-empty / knD-state-unavailable），键盘不加新的说辞。
           顺带收口 R50 钩子的同一死角：搜索框 ArrowDown 也只在真有行可去时才 preventDefault。
零请求     键盘全程只挪焦点：测试在文档列表段与空间卡片段分别断言 fetchMock 计数前后不变
           （含重渲染后的 404 段）。
焦点样式   :focus-visible 全部用现成 token（.knw5-page a[data-testid$="-name"] 已覆盖
           kn3-docs-name/knw5-space-link），未新增 CSS 规则；真实按键 Tab/Enter 浏览器实测
           沿 R50 做法，本轮未重建 9122，键盘读数来自 jsdom 定向测试。
```

testid 无新增；`data-roving="kn3"` / `data-active-row` / `data-active` / `aria-current` 为
机器可判读数。kn3 / kn6 / kn7 / kn8 / kn9 / knB / knC / knD / knE / knF / knG / knI / knw5
全套既有断言零改零破（含 R49「行是真 a[href]、tabindex null」、R50「三行 [-1,0,-1] 与 Esc 归位」、
R52「表头键盘」、R53「诚实态」）。无正数 tabindex、无固定宽改动，三宽度横溢维持既有 flex 布局
（本轮未重建 9122，未做浏览器复测）。

## 验证尾行（R58）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 51 tests passed（含新增键盘收口测试）
$ npx vitest run                         → 138 files / 1674 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 set-state-in-effect warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw26-dist → exit 0（产物只落 /tmp）
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重启或重建 9122；显式路径提交（无 `git add -A`）；
无 force / amend / `--no-verify`；单 commit「feat(console): knowledge keyboard navigation」。

# KNW5 追加 R59：文档预览抽屉可访问性收口（kn7-preview-* 族）（2026-11-20 BJT）

基线安全闸：toplevel 相符、porcelain 空、显式 refspec fetch；上游仍 `b797bc98`
（generation 053da5c4），merge 为 Already up to date——本笔只有 feature commit。

## 一、对象澄清（派工写的族名与代码实况）

派工指向「文档预览抽屉（现有 `kn6-search-detail*` 族）」。代码实况：带遮罩、`role=dialog`、
`Esc`、URL `?doc=` 的预览抽屉是 **`kn7-preview-*` 族（DocPreviewDrawer）**，本轮按派工七条
在其上补齐并实测；`kn6-search-detail*` 是检索面板的**就地展开块**（内联 `<dl>`，无遮罩、
URL 用 `?sdoc=`、再点同一行收回）——它不是模态，不套 dialog 语义，保持原设计不破。
`?doc=` 在抽屉关闭时从 URL 移除（`closeDocDrawer` 删参），派工所问「若现设计保留」不适用：
实况是移除，Esc 与遮罩两条关闭路径同走这个出口。

## 二、七条判据的实测读数（jsdom 定向测试）

```text
焦点进抽屉   打开后 activeElement === 关钮（就是面板内第一个可聚焦元素，nodes[0] 序号实测 0）；
             全程无正数 tabindex。
模态三件套   role="dialog" + aria-modal="true" + aria-labelledby="kn7-preview-title"，
             标题文本=文档名（缺行时回落「这份文档」，原因进 title）。
Tab 闭环     末位 Tab → 首位（defaultPrevented=true 实测）；首位 Shift+Tab → 末位；
             补漏收口：焦点漏到面板外（blur 后 body）时 Tab 不再穿出模态，被拉回面板内——
             本轮唯一的代码增量（原先只环绕首尾两端，中间态焦点在外会穿）。
Esc          关抽屉、焦点还给触发行（activeElement === 该行 a[href] 实测）、loc 不含 doc=。
遮罩点关     同一出口：焦点同样回触发行、URL 清、不丢焦点（本轮补断言）。
字段缺失     仍屏上「—」+原因进 title；详情读口不可用仍「文档详情未接入」诚实态（R49 未动）。
零请求       键盘环绕/拉回/Esc/遮罩各段实测 fetchMock 计数 0 增量。**如实说明**：打开抽屉
             本身会读一次「文档详情」读口（R49 既有设计：来源与读取状态等这个口，接不上时
             显示未接入）；本轮未改该行为，重开抽屉即再读一次（测试计数 1→2 属实记录）。
```

## 验证尾行（R59）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 52 tests passed（含新增模态收口测试）
$ npx vitest run                         → 138 files / 1675 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 set-state-in-effect warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw27-dist → exit 0（产物只落 /tmp）
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重启或重建 9122；显式路径提交（无 `git add -A`）；
无 force / amend / `--no-verify`；单 commit「feat(console): knowledge drawer accessibility」。
kn3 / kn6–knI / knw5 既有断言零改零破（含 R49 抽屉回归测试全绿）；无布局改动，三宽度维持既有读数。

# KNW5 追加 R60：文档预览抽屉的元信息复制（testid `knL-*`）（2026-11-20 BJT）

基线安全闸：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge `origin/lane/hermes-console`
实到 tip `cca9cf7e`（wave-19，代码代次同名），零冲突；`git diff HEAD^1..HEAD -- web/src/modules/knowledge`
为空——wave 不动知识面，合并后知识套基线 52/52 绿再动工。不引用更早代次。

## 一、口径

```text
位置       控件在抽屉面板内（两条 dl 字段块之后）；抽屉卸载即随 portal 一起消失——
           Esc 与遮罩两条路径关闭后实测 knL-copy-meta 均查无节点。
文本       一条字段一行：文档名 / 所属空间 / 类型 / 大小 / 更新（BJT 到分）/ 文档短码。
           值全是抽屉已持有的屏上数据（列表行 + 地址里的文档标识），缺值「—」不补 0；
           所属空间缺名字时用人话短码行「空间 · SPFIN」（行数据自带），全空间 id 只在 title；
           文档短码取人话尾段大写（D1/D2/ZZ9），裸 id 实测不进文本；
           地址可复现但行不在已加载列表：前五字段全「—」、短码仍给——不编值。
零请求     复制动作本身实测 fetchMock 前后计数不变。如实记录既有设计（R49，本轮未动）：
           打开抽屉会读一次「文档详情」读口（来源与读取状态等它），重开即再读一次，
           测试按 open=+1、close/copy=+0 分别断言。
状态       knL-copy-meta-status 常驻 aria-live=polite：成功「已复制」；拒绝（writeText reject）
           与不可用（无 writeText）两路分别实测 →「复制失败…」+ knL-copy-meta-fallback
           只读 textarea，value 与文本逐字一致。
模态不破   Tab 环选择器补入 textarea（原样会漏掉失败态的手动文本框、焦点可从它穿出模态）——
           本轮第二个代码增量；实测 fallback 在环内（ring.includes(fallback)=true）。
焦点并核   Esc 关闭：activeElement 的 data-testid === "kn3-docs-name"（触发行）；
           遮罩点关：同一读数，两条路径焦点都不丢；?doc= 关闭即从 URL 移除（R59 口径）。
```

testid 新增 `knL-row` / `knL-copy-meta` / `knL-copy-meta-status` / `knL-copy-meta-fallback`。
kn3 / kn6–knI / knw5 既有断言零改零破（含 R59 模态收口测试全绿）；抽屉内 flex-wrap 行、
textarea 100% 盒宽，本轮未重建 9122，三宽度未做浏览器复测。

## 验证尾行（R60）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 53 tests passed（含新增抽屉元信息复制测试）
$ npx vitest run                         → 144 files / 1796 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 set-state-in-effect warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw28-dist → exit 0（产物只落 /tmp）
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重启或重建 9122；显式路径提交（无 `git add -A`）；
无 force / amend / `--no-verify`；merge（cca9cf7e）与单 feature commit
「feat(console): knowledge drawer metadata copy」分开。

# KNW5 追加 R61：数据来源与新鲜度台账（testid `knM-source-*`）（2026-11-20 BJT）

基线安全闸：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge 实到章面 `3c7f70f6`
（代码代次 `cca9cf7e`），零冲突；`git diff HEAD^1..HEAD -- web/src/modules/knowledge` 为空，
合并后知识套基线 53/53 绿再动工。

## 一、口径

```text
形态       模块内 sourceReads.ts：module store + useSyncExternalStore，与 health 车道 sys6
           同构但不跨模块 import（上游改动波及不到知识面）。台账自身从不发请求：三个面
           在各自本来的读取落点上报（spaces / documents?spaceId=<id> / documents?limit=50；
           详情面为空间名读的那次 SPACES_URL 也归位到空间列表行，同一实际路径）。
逐行       口径名 | 实际路径 | 采集时刻 | 状态（正常·降级·读口未接入·读不到；下钻前该面
           「未读取」，不冒充读过）。
采集时刻   只认响应顶层 ISO，严格六别名顺序 asOf/as_of/collectedAt/collected_at/
           generatedAt/generated_at（独立提取口 knAsOfFacts；页面上「数据截至」行的
           stampOf 口径保持未动，二者职责不同）。缺失或非 ISO → 「—」+title 点名缺什么；
           行内时间不参与台账（fixture：列表有行内时间但顶层无别名 → 降级）。
           换算只由 payload 字符串推出（08:00Z→16:00 实测），本机时钟零参与；
           asOf 原文、命中别名、asOfSource 全部只进 title。
状态映射   顶层 ISO 在 → 正常；读到但顶层无可用 ISO → 降级（读到≠新鲜）；
           403/404 → 「读口未接入」+同一句原因+去处（申请入口），逐字同体实测（403 段
           与 404 段可见读数相等）；其它失败 → 「读不到」；GAP-03 与请求编号只在 title。
展开态     默认收起；URL 不落（实测 loc 无 expand 类参数）；存在模块 store——列表↔详情
           切面、收起再展开都不丢（实测跨 knw5-space-link 下钻与返回仍展开）。
零请求     展开、收起、切面、返回全程 fetchMock 计数增量 0（多段实测）；重渲染页面的
           读取是页面既有行为，台账不追加。
```

testid 新增 `knM-source-panel/toggle/note/list/table` + 行级 `knM-source-row|path|asof|status|reason|apply-<id>`；
行挂 `data-knm-status`（machine 可判 ok/degraded/unwired/failed/idle/loading）。
kn3 / kn6–knL / knw5 既有断言零改零破（含 404/403/GAP 泄露巡检、四态与 knD 标记全绿）；
路径格 overflow-wrap:anywhere、表格走既有 knw5-scroll，本轮未重建 9122，三宽度未做浏览器复测。

## 验证尾行（R61）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 54 tests passed（含新增台账测试）
$ npx vitest run                         → 144 files / 1797 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 set-state-in-effect warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw29-dist → exit 0（产物只落 /tmp）
```
边界：只改 `web/src/modules/knowledge/**`（新增 sourceReads.ts）与本证据目录；未动 App.tsx /
shell / routes / registry / package·lock / web-scripts / ops；未并 main、未重启或重建 9122；
显式路径提交（无 `git add -A`）；无 force / amend / `--no-verify`；merge（3c7f70f6/cca9cf7e）
与单 feature commit「feat(console): knowledge source freshness block」分开。

# KNW5 追加 R62：三面四态统一（testid `knN-state-*`）（2026-11-20 BJT）

基线安全闸：toplevel 相符、porcelain 空、显式 refspec fetch；上游仍章面 `3c7f70f6`
（generation `cca9cf7e`），merge 为 Already up to date——本笔只有 feature commit。

## 一、口径

```text
探针       Surface 加可选 probe，为三面各挂机器可判标记（display:none、零可见变化，
           knD-marker 同手法）：knN-state-<face>（data-knn-state）、错误族另挂
           knN-error/rid/retry-<face>（rid 带 data-knn-rid）。面 id 与 knM 台账同名：
           spaces / space-docs / doc-search。
state 读数 loading · ready · empty（连通但真 0）· no-match（搜索/筛选筛空）·
           unavailable（404）· denied（403，与 unavailable 可见正文逐字同体）· error · login。
           empty 与 no-match 的区分口径 = 该面当前是否有筛选词；空态正文各自带
           knN-empty-text-<face>（data-knn-empty=empty|no-match）。
loading    骨架不变；复制条从「ready 才出现」改为四态常在——实测同一条 DOM 节点跨
           loading→ready 不重挂（节点同一断言），状态切换不再出现条的闪现/跳动。
空态两分   真 0：正文写「接口已响应但为空，不等于没有，不写 0 个/0 篇」，无清空出口；
           筛空：正文写「已加载 N 里没有匹配，这是筛完的结果」并带清空出口
           （spaces=kn8-global-empty-clear 原有；doc-search=kn6-search-empty-clear 原有；
           space-docs 本轮补 kn3-docs-empty-clear——三面筛空口径从此一致）。点清空即回 ready。
错误态     Surface 既有人话原因 + 可复制 rid + 重试不动；本轮只是加机器探针。
           403≡404 同体实测（可见正文逐字相等），403/404 仅探针可分（denied/unavailable）。
复制按钮   四态常在且 disabled + title 点名原因：loading「还在读取」/未接入「没读到
           （读口未接入或没有权限）」/login「登录状态已经失效」/error「这次没读到」/
           真 0 与筛空保持 R55–R57 的逐字口径（「当前没有可复制的结果/空间」、
           「本地筛选没有留下行…」「这份列表是空的」）。knL 收口：文档行不在已加载列表
           （ghost ?doc=）时 disabled，不再把一串「—」写进剪贴板（R60 该段断言随之改为
           disabled+原因+守卫 0 写入，属口径纠正，非退化）。
计数格     knF/knG/knI-lines 无行可数（含错误/loading/空集/筛空）一律「—」+title
           「不写 0 冒充空集」；只有 ready 且可见行>0 才报 N。
denied 保上下文 403/404 只换自己那面的块：?q=、?sort=、?dir= 原样留在地址与输入框，
           别的面已加载的数据不丢，返回/重试/去处入口都在（实测读数见测试 D/E 段）。
```

testid 新增 `knN-state-{spaces,space-docs,doc-search}`、`knN-empty-text-*`、
`knN-error-*`、`knN-rid-*`、`knN-retry-*`、`kn3-docs-empty-clear`。
kn3 / kn6–knM / knw5 既有断言零破；本轮为统一口径主动改动的既有断言只有三处计数格
「0 行/0 条」→「—」与 R60 ghost 段（如上，均为派工要求本身）。四态与 knD 标记、
泄露巡检全绿；无新增宽度元素（探针 display:none），1440/1280/375 维持既有读数，
本轮未重建 9122，未做浏览器复测。

## 验证尾行（R62）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 55 tests passed（含新增四态统一测试五段）
$ npx vitest run                         → 144 files / 1798 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 set-state-in-effect warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw30-dist → exit 0（产物只落 /tmp）
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重启或重建 9122；显式路径提交（无 `git add -A`）；
无 force / amend / `--no-verify`；单 commit「feat(console): knowledge state consistency」。

# KNW5 追加 R63：文档预览抽屉的固定链接（testid `knO-*`）（2026-11-20 BJT）

基线安全闸：toplevel 相符、porcelain 空、显式 refspec fetch；上游仍章面 `3c7f70f6`
（generation `cca9cf7e`），merge 为 Already up to date——本笔只有 feature commit。

## 一、深链参数名（git grep 实证，非猜测）

```text
KnowledgeModulePage.tsx:2653  const spaceId = sp.get("space")
KnowledgeModulePage.tsx:2654  const openDoc = sp.get("doc")
KnowledgeModulePage.tsx:2702/2703  keepBase: next.set("tab"…) / next.set("panel", "spaces")
KnowledgeModulePage.tsx:2716/2717  docLink: next.set("space", spaceId); next.set("doc", key)
```

深链形状 = `/knowledge?tab=spaces&…&space=<空间标识>&doc=<文档标识>`；复制链接的值就是
`window.location.origin + docLink(当前 openDoc)`——参数串由页面一直在用的 docLink 生成，
本轮不手拼、不猜名。派工所写族名 `kn6-search-detail*` 仍是检索面板的内联展开块（无遮罩、
URL 用 `?sdoc=`）；带 `?doc=` 的预览抽屉是 `kn7-preview-*` 族，本轮按七条判据在该族上实施
（与 R59 同一澄清）。

## 二、直达实测（缺口不存在，如实报可达）

```text
复制得到的 URL（jsdom origin 下逐字）：
  http://localhost:3000/knowledge?tab=spaces&space=sp_hr&doc=d1&panel=spaces
用该串直接渲染（等价于粘贴+刷新）：
  kn7-preview-panel 命中 ✓；loc 含 doc=d1 ✓；抽屉字段块 title（文档标识）="d1" 与参数同值 ✓；
  抽屉标题 = 员工手册.pdf ✓。
```

## 三、口径

```text
无标识     行没有 documentId（页面内部只能按位置键 row-N 开抽屉）→ 按钮 disabled +
           逐字 title「该文档没有可用的固定标识」，守卫不写剪贴板：位置键不是标识，不冒充。
           地址直达复现的 ghost（?doc=zz9 行不在列表）仍可复制：标识本就来自地址，
           再粘贴仍直达同一地址态——复制的是地址，不编内容。
上屏形态   可见 span 按 R49 不变量掩掉参数值（space=… doc=…），全文在 title、剪贴板与
           失败态 textarea；单行省略号（flex min-width:0），375 无横溢、原始标识不上屏
           （R49 泄露巡检实测不破）。
状态       knO-permalink-status（aria-live=polite）：成功「链接已复制」；拒绝/不可用 →
           「复制失败…」+ knO-permalink-fallback 只读 textarea，value 与写入地址逐字一致；
           内容签名守卫：换文档后旧「链接已复制」作废。
零请求     复制/失败/重试点击全程 0 增量；台账断言：列表读=4 渲染 × 2 面，详情读=3 次开抽屉
           （R49 既有设计），与复制动作无关的页面读取计数前后吻合。
```

testid 新增 `knO-row` / `knO-permalink` / `knO-permalink-status` / `knO-permalink-url` /
`knO-permalink-fallback`。kn3 / kn6–knN / knw5 既有断言零破（R49 抽屉回归全绿）。
本轮未重建 9122，三宽度未做浏览器复测；jsdom 下 origin 为 http://localhost:3000，
线上形态为部署域同名路径。

## 验证尾行（R63）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 56 tests passed（含新增固定链接测试四段）
$ npx vitest run                         → 144 files / 1799 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 set-state-in-effect warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw31-dist → exit 0（产物只落 /tmp）
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录（3 files）；未动 App.tsx / shell / routes /
registry / package·lock / web-scripts / ops；未并 main、未重启或重建 9122；显式路径提交
（无 `git add -A`）；无 force / amend / `--no-verify`；单 commit「feat(console): knowledge drawer permalink」。

# KNW5 追加纠偏：复制条状态句门控（OBS-6）与 kn7 挂载范围声明（2026-11-20 BJT）

安全闸：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge 实到 `5630ffce`
（wave-20，含既有全部代次），零冲突；merge 对 `web/src/modules/knowledge` 的 delta 为空，
合后知识套基线 56/56 绿再动工。

## ① OBS-6 — 复制条状态句与兜底锚的门控统一

```text
改前读数（现码逐字）：禁用态（loading/unwired/login/error/真0/筛0）状态句 = ""（空串），
  兜底节点 = 不存在。即 OBS-6 的字面矛盾（状态句说可复制、兜底为空/反之）在 R55–R57
  引入「内容签名作废」后已无可复现通路——状态句只在 copied/failed 两个动作态出字，
  而这两个态只能由 enabled 时的点击产生。但「禁用态状态句整句沉默」仍不满足
  「状态与真实可用性一致」的验收口径（用户无从知道为什么不能复制）。
改后口径（统一 helper copyBlockNotice，四张条共用）：
  · 能复制（ready 且可见行>0；knL 为行已加载）→ 成功「已复制…」/失败「复制失败，已展开可选文本，
    可手动复制」+ 兜底 textarea——成功/失败路径文案与行为零改动（既有测试原样绿）。
  · 禁用 → 状态句一律「当前不可复制：<短原因>」，且兜底锚必然不渲染（同一函数同一门控出两值）。
改后实测读数（逐字）：
  knI loading   → 「当前不可复制：列表还在读取」      fallback 无
  knI unwired   → 「当前不可复制：读口未接入或没有权限」 fallback 无
  knI 真0       → 「当前不可复制：这份回答里没有空间」  fallback 无（title 仍逐字「当前没有可复制的空间」）
  knI 筛0       → 「当前不可复制：筛选后没有留下的空间」 fallback 无
  knG loading/unwired/真0/筛0 → 同型四种短原因句，兜底均无
  knF loading/error/筛0       → 「列表还在读取」「这次读取没有成功」「筛选后没有留下的文档」，兜底均无
  knL ghost     → 「当前不可复制：这条文档不在已加载的列表里」 fallback 无
  正常路径对照  → 成功「已复制 2 行」；失败「复制失败，已展开可选文本，可手动复制」且兜底同现。
knO（固定链接条）不在本次派工范围，行为与状态句未动（R63 测试原样绿）。
```

## ② kn7 抽屉挂载范围 — 选 (a) 设计声明

选择：空间行不打开文档抽屉，声明为设计意图。理由：抽屉的每个字段都取自「文档」行
（文档名/原文位置/类型/大小/更新 + 详情读口），空间行没有这些字段；空间行的既有去处就是
进入该空间看文档列表（行本身是带 title 的真链接），语义已闭环。空间抽屉若要做，需新造一套
字段且大半列无读口支撑，超出纠偏最小面。
实施：`knw5-space-link` 的 title 扩为「看这个空间里的文档——文档预览抽屉只对文档行打开，
请进入空间后预览文档」；实测点空间行后 `kn7-preview-panel` 不存在、URL 落 space=——
文档行抽屉的既有七条行为零改动（R49/R59/R60/R63 抽屉测试原样绿）。

knI/kn7 家族零破；三档宽度无新元素入屏（状态句替换同位文本、兜底只减不增）；普通 URL
`data-fixture` 仍 0；零写入口；四态与 403≡404 探针原样。

## 验证尾行（本次纠偏）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 57 tests passed（含新增门控统一测试七段）
$ npx vitest run                         → 147 files / 1916 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw32-dist → exit 0
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录（3 files）；显式路径提交；
无 force / amend / `--no-verify` / `git add -A`；未并 main、未重建 9122；
merge（5630ffce）与单 fix commit 分开。

# KNW5 追加 R64：复制/导出族收成单点 gates（testid `kn-gates-*`）（2026-11-20 BJT）

安全闸：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge 实到章面 `957704be`
（含既有全部代次），零冲突；merge 对 `web/src/modules/knowledge` 的 delta 为空；
合后基线先跑一遍再动工。

## 一、结构

```text
新文件 copyGates.ts = 唯一的「能不能/为什么/怎么说」出处：
  faceGates(input{face,state,rows,filterText,loadedTotal}, act) →
    copy {enabled,title,reason} · retry {enabled,title} · exportEntry(恒 absent)
    · status(aria-live 句) · fallback(兜底锚渲染与否) · lines{text,title}
  四入口 knI/knF/knG/knL 各读各面；Surface 与各重试按钮的 title 走同一 retryTitle()。
删除：R62 落地的页内 copyBlockNotice/blockedCopyReason/COPY_BLOCKED_BY_KIND——页面
  不再持有第二套文案分支（grep 页文件无「还在读取，还没有可复制」等本地句式）。
markers：kn-gates-kn{I,F,G,L}（data-enabled/data-reason/data-retry-enabled/
  data-export="absent"），display:none，零可见变化（knD-marker 同手法）。
导出族：本模块无导出入口（git grep 核实），gates 表显式 absent 句，不造新功能。
```

## 二、六格 × 四入口读数（定向测试逐字断言摘要）

```text
格        knI 空间列表                 knG 全库检索                 knF 详情文档                 knL 抽屉
loading   disabled·「列表还在读取」    同左·尾词「结果」句           同 knG 句式                 （不适用：抽屉开必有行/无行）
ready     enabled·面用途句·计数N行/条  enabled·计数N条               enabled·计数N行              enabled·「已复制」
empty真0  disabled·「这份回答里没有空间」title 逐字「当前没有可复制的空间」不变  「…没有文档」  title 逐字「当前没有可复制的结果」不变  不适用        rows0·「这条文档不在已加载的列表里」
筛空      disabled·「筛选后没有留下的空间」                        动态逐字句(带份数与词)·「筛选后没有留下的文档」      同型        （不适用）
error     disabled·「这次读取没有成功」=三入口同句同灭              同左                          同左                    （详情错不碍行复制——gates 明写）
denied403 与 unwired404 同句同权「读口未接入或没有权限」；retry title「重试这一次读取：<原因>」同源
一致性    同一面失败时 copy/retry/计数/兜底四读同一函数一次判出；非 ready 兜底必不渲染（OBS-6 由结构保证，
          不再靠各处自觉）。ready-0 时复制 disabled + 面句式 title（R55/56/57 逐字句原样保留在表内）。
```

## 三、真实浏览器三档（不重建 9122 的替代路径，如实记录）

```text
方式：vite preview 服务构建产物（输出仅 /tmp/knw33-dist，端口 4180，用完即杀）+ headless
Chrome(CDP) 实测 http://localhost:4180/knowledge?tab=spaces（该环境无 agent-api，三面落
error 态——正是 disabled 条形态的测量对象）。读数：
  1440 vw=1440 bodySW=1440 docSW=1440 · 1280 全等 · 375 全等 → 无横溢
  同页 DOM 复核：knw5-page 在、markers=「kn-gates-knG:false:这次读取没有成功」等与按钮
  disabled=true 逐项一致（真实 Chrome 下 gates 读数与结构一致）。
既有 jsdom 定向测试另覆盖六格×四入口全表。
```

零额外请求：gates 为纯函数；测试在 loading/ready/empty/筛空/denied/error/复制/排序切换
各段断言 fetchMock 计数前后不变；真实浏览器测量用的静态产物无任何后端可打，行为同源。
kn3/kn6–knN/knw5 零破：既有 57 例逐字断言（含 R55/56/57 面句式 title、OBS-6 状态句、
R59 焦点、R63 链接）全绿；本轮新增 1 例（58/58）。零写入口、四态与 403≡404 不退化。

## 验证尾行（R64）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 58 tests passed
$ npx vitest run                         → 147 files / 1917 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw33-dist → exit 0；preview 4180 + CDP 测量后进程已清理
```
边界：只改 `web/src/modules/knowledge/**`（含新增 copyGates.ts）与本证据目录；未动 App.tsx /
shell / routes / registry / package·lock / web-scripts / ops；未并 main、未重启或重建 9122；
显式路径提交（无 `git add -A`）；无 force / amend / `--no-verify`；merge（957704be）与单
feature commit「feat(console): knowledge copy action gates」分开。

# KNW5 追加 R65：全库文档名搜索按空间分组（testid `kn-group-*`）（2026-11-20 BJT）

安全闸：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge 实到章面 `a5832d15`
（代次含既有全部），零冲突；merge 对本知识面 delta 为空；合后基线 58/58 先绿再动工。

## 一、口径

```text
派生       分组是对「筛后 shown」的纯派生（knowledge.ts groupRowsBySpace）：组序=首现序、
           组内行保持既有序；不另发请求、不动 URL。命中读口今天不接受 q（R51 探针口径），
           筛选与分组都发生在同一份已加载数据上。
计数同源   组头逐组「N 项」之和 === 该面 shown/总数 === Surface data-len === kn9 计数句同源。
           派工写的 `kn8-count` 是空间列表面的计数；本面（文档名搜索）的对应总数元素是
           `kn9-count-docs`，映射如实声明于此，断言按后者执行（测试逐字读数）。
组头       真 BUTTON：aria-expanded + aria-controls 指组行容器 id（kn-group-rows-<n>，
           折叠时容器常在、id 不落空）；title 放全空间 id（屏上不见 sp_）；名缺用既有
           人话短码标签「空间 · SPFIN」；无空间行归「—」组。折叠纯视图态存组件本地：
           不改 ?q=、不重取（实测 fetchMock 前后计数不变）、文案「折叠/展开」翻转。
行         组内行与原表逐列同口径：真 a[href]（sdoc= 深链）、类型人话、大小人话、
           更新 BJT 到分、缺「—」+title 原因；SearchDocTable 原组件复用，非再造一条表。
roving     折叠的组不挂行 → DOM 序=可见序，tabIndexFor 按「前面已展开组的行数」累计偏移，
           实测跨组 ↓ 走位不乱、同时只有一个 tabindex=0；Esc 回搜索框原样。
空态       0 命中走既有 kn6-search-empty（「没有匹配的文档…本地筛选…」+清除关键词），
           不新增空态文案；未接入/失败面（Surface 非 ready 分支）根本不渲染组。
单路径     分组只长在页顶「按文档名搜索」面（唯一 render 路径）；retrieval 页的检索命中面
           （knw5-search*）实测不含任何 kn-group 节点，仍是原表原诚实态——一处实现，一处使用。
复制       knG 复制句仍按「命中顺序」（读入序）——与 R56 派工文本口径逐字一致；分组是视图
           呈现，不改变清单内容（集合相同，证据在此明说）。
```

## 二、三档

```text
CDP headless Chrome 打 vite preview 静态产物（输出仅 /tmp，端口用毕即杀）：
  /knowledge?tab=spaces&q=员工：1440/1280/375 三档 vw==bodySW==docSW 全等（该屏含页顶搜索面板）。
  如实记录：preview 无登录会话，搜索面在真实屏上落 error 诚实态，组行态未能在该静态屏复现
  （CDP Fetch 打桩被 shell 鉴权链挡下，属 preview 环境限制，非功能缺口）；组行态布局由
  组件级测试（行数/组序/tabindex 分布）+ 现成 flex-wrap 规约保证。9122 按约束未重建，
  组行态真实浏览器三档复测列入未测项。
```

kn3 / kn6–kn9 / knB–knN / knw5 既有断言零破（58 例基线原样绿，含 kn6 全部旧测、roving、
复制 gates、空态）；本轮 +1 例（59）。无写入口、无新请求、四态与 403≡404 不退化。

## 验证尾行（R65）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 59 tests passed
$ npx vitest run                         → 150 files / 1989 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-group-dist → exit 0（产物只落 /tmp，preview/CDP 进程已清理）
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重启或重建 9122；显式路径提交（无 `git add -A`）；
无 force / amend / `--no-verify`；merge 与单 feature commit 分开。

# KNW5 追加 R66：空间文档列表四列排序与单一表头（testid `kn-sort-*`）（2026-11-20 BJT）

安全闸：toplevel 相符、porcelain 空、显式 refspec fetch；上游 tip 即派工章面 `a5832d15`
（代码代次 `60a4a429`），merge 为 Already up to date——本笔只有 feature commit。

## 一、后端探针（cookie 只在 curl 命令内拼 Header，值零回显；9122 只读、未重启、未重建）

```text
HTTP 404  rid f9ced4ad  /agent-api/api/documents?limit=50&spaceId=sp_hr                    documents.read_not_wired  行数 0
HTTP 404  rid ac606a3c  …&sort=name                                                          同上  行数 0  顺序无差别（无行可差）
HTTP 404  rid 78c18c10  …&sort=name&order=asc                                               同上  行数 0
HTTP 404  rid 2ac23a99  …&orderBy=name&order=desc                                           同上  行数 0
```
读口今天 fail-closed，sort/order/orderBy 带与不带回答逐字一致 → **声明本地排序**，
表下 `kn-sort-scope-note` 逐字「仅在当前已加载 N 篇内排序…不会再发请求」（N=筛前行数实测）。

## 二、与 R52 的收口（改名路线，侦察属实）

```text
testid：表头按钮由 `knC-sort-<col>` 改名为派工指定的 `kn-sort-<col>`（模块外零引用，
  grep 全仓核实）；既有测试引用同步改名，断言语义未动。knC-sort/knC-th 的 CSS 类名保留
  （focus-visible 走现成 token，未新增样式面）。类型列从纯 th 升级为第四可排列。
  派工零破清单 knB–knN 若按字面含 knC：本轮未破的是 knC 的行为与断言，改名仅动 testid
  字符串——两处既有 knC 相关测试（R52 排序、R54/R55 翻页重置点表头）全部原语义通过。
URL：本面真值改走 `?ksort=&kdir=`；`?sort=&dir=` 只作读兜底（旧粘贴链继续生效，实测
  sort=size&dir=asc 复现同序），默认态与清除态都不写参数。清除（同列第三点）只删
  ksort/kdir，地址里原有 sort/dir 原样保留（如实后果：无 ksort 时旧 sort/dir 兜底重新生效）；
  q/面包屑/panel 等全程不动。切页签把四键一并清掉（R52 口径延伸）。
周期：四列统一「首点落本列默认方向 → 再点翻向 → 第三点清除」；R52 的两击断言
  （name asc→desc、size desc→asc、updated desc→asc）逐条兼容，全绿。
```

## 三、行为读数（定向测试逐字断言）

```text
缺值恒末位：类型缺（D 行）asc/desc 都末位；大小缺同（不当 0）；时间缺同（R52 既有）。
稳定序：同值行（两 PDF、同 300B）在 asc 与 desc 里都保持读入相对序（A 前 B 后实测）。
键盘：四按钮都是 BUTTON[type=button]；Enter/Space 由 onKeyDown 显式接管并 preventDefault
  （一次按键一次翻态，浏览器不再叠加原生激活），defaultPrevented=true 实测；focus-visible
  走 .knC-sort:focus-visible 现成 token。
零请求：三态整周期 + 键盘段 + 复制段 fetchMock 计数全程不变（urlsBefore 快照逐段核对）。
复制同序：knF-copy 首行/末行 == 表体首/末行——name/asc 与默认 updated/desc 两组各贴。
单一表头：ready 且有可见行 = 真表头四按钮 enabled、表头条不渲染；
  loading/error/unwired/denied/login/真空/筛空 = 表头条四按钮全 disabled + 逐字原因 title
  （未接入句对 403/404 同一句），点它不改 URL 零请求，口径注此时不出现——全页任何状态
  表头恰好一套（真实 Chrome 复核：strip=1、heads 四枚皆 d）。
```

三档：vite preview(/tmp/knw-sort-dist，用毕即杀)+headless Chrome CDP 实测详情屏（无后端
恰为表头条形态）1440/1280/375 `vw==bodySW==docSW` 全等。未测如实：真浏览器 Enter/Space
原生激活链（jsdom 以显式 keydown 断言替代）、ready 行态三档（preview 无会话读不到行）、
真机剪贴板权限弹窗。kn3/kn6–knN/knw5 零破：60 例（基线 59 + 本轮 1）全绿。

## 验证尾行（R66）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 60 tests passed
$ npx vitest run                         → 150 files / 1990 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-sort-dist → exit 0（preview/CDP 进程已清理）
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重启或重建 9122；显式路径提交（无 `git add -A`）；
无 force / amend / `--no-verify`；单 commit「feat(console): knowledge document list sorting」。

# KNW5 追加 R67：空间文档列表的行内预览（testid `kn-doc-preview-*`）（2026-11-20 BJT）

安全闸：toplevel 相符、porcelain 空、显式 refspec fetch；上游 tip 仍 `a5832d15`（章面即此，
代次 60a4a429），merge 为 Already up to date——本笔只有 feature commit。

## 一、路径选择（派工要求显式写明）

**选「专用控件」路线**：行名 `kn3-docs-name` 保持为抽屉入口（真 `a[href]`→`?doc=`，R49/R58
语义零动）；行内预览由每行文档名单元格里的专用真 BUTTON `kn-doc-preview-toggle` 开合，
携 `aria-expanded` + `aria-controls` 指向该行的预览容器（id `kn-doc-preview-<key>`，收起时
容器不挂载、展开时 id 必在场）。没有把行本身改成 toggle，也没有第二套表头/入口。

## 二、口径与实测读数

```text
内容     预览只取该行已有数据，五行逐字：文档名（人话名）/ 类型人话 / 大小人话 /
         更新 BJT 到分 / 短码。缺字段给「该字段未返回」+ title 点名哪个字段没回
         （实测缺字段行 d_b2：类型/大小/更新三格「该字段未返回」，title 各含字段名），
         不编、不借别行、不写 0。短码 = 标识人话尾段大写（d_b2→「DB2」），全 id 只在
         title（实测 title="d_b2"）；预览容器可见文本实测不含 "doc_"、不含裸 id。
视图态   previewKey 存组件本地：不进 URL——展开/收起/Esc 全程 loc 逐字不变（实测）；
         刷新同址回来全部收起（实测）。切空间即清（带上的预览不带进下个空间）。
单行     同时至多一行展开：换行展开自动收起前一行（aria-expanded 逐钮实测 true→false）。
Esc      展开态 Esc = 收起且焦点守在原钮（activeElement data-testid=kn-doc-preview-toggle
         实测），事件 stopPropagation 不再触到 roving 的「Esc 回搜索框」；收起态 Esc
         保持既有 roving 语义（交还列表原行为）。
互斥     B→A 双向锁死：抽屉开着点预览钮 = 静默关抽屉（只删 doc=，不抢焦点——焦点留在钮上，
         实测 panel 消失 + loc 无 doc= + 预览在场 + activeElement=该钮）；预览开着点行名 =
         开抽屉并收起预览（实测 panel 在场 + 容器 0 + aria-expanded=false）。同屏至多一个
         详情面。
roving   toggle 与行名同行同权（共用 tabIndexFor）：未进 roving 两者都无显式属性；进入后
         活动行的名+钮=0、其余行两者=-1（实测）。↑/↓/Home/End/Esc(框) 语义零动，
         ArrowDown 仍走行序列（实测焦点链）。focus-visible 走现成 token（钮自带 outline 规则）。
零请求   展开/收起/Esc/单行切换/互斥两向全程 fetchMock 计数不变（各段快照实测）；预览不发
         详情读、不动列表读；互斥关抽屉只是删参。
```

testid 新增恰为 `kn-doc-preview-*` 一家：toggle / 容器（kn-doc-preview）/ 字段
（-name/-type/-size/-updated/-code）/ 预览行（-row）；行加 `data-preview` 读数。
kn3 / kn6 / kn7 / kn8 / kn9 / knB / knD / knF / knG / knI / knL / kn-sort / kn-gates 零破
（61 例 = 基线 60 + 本轮 1，全绿；含 R49 抽屉回归、R58 roving、R66 排序、R64 gates）。

## 三档

静态产物 + headless Chrome CDP：详情屏 1440/1280/375 `vw==bodySW==docSW` 全等（构建输出仅
/tmp，测量进程用毕即杀）。未测如实：行内预览的行态真实屏三档（无登录会话时列表落诚实
错误态；预览仅在组件级 jsdom 断言覆盖）；真机鼠标焦点落焦行为以显式 focus 合成断言替代。

## 验证尾行（R67）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 61 tests passed
$ npx vitest run                         → 150 files / 1991 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-rowprev-dist → exit 0
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重启或重建 9122；显式路径提交（无 `git add -A`）；
无 force / amend / `--no-verify`；单 commit「feat(console): knowledge document row preview」。

# KNW5 追加 R68：空间列表行内预览（testid `kn-space-preview-*`）（2026-11-20 BJT）

安全闸：toplevel 相符、porcelain 空、显式 refspec fetch；上游 tip 仍章面 `a5832d15`
（代次 60a4a429），merge 为 Already up to date——本笔只有 feature commit。e2130b4f（文档行内
预览）已核可，本轮同范式复制到空间列表行。

## 一、口径（与 kn-doc-preview 同族规）

```text
控件       每行文档名单元格内专用 BUTTON `kn-space-toggle-<i>`（aria-expanded/aria-controls
           指向同行 `kn-space-preview-<i>`）；容器常挂载、收起用 hidden——aria-controls
           永不指空。行名 `knw5-space-link` 的下钻导航零动（专用控件路线，同 R67 声明）。
内容       四格全取已加载 SpaceRow，不发任何新请求：
           · 空间名：有→人话名；缺名有标识→「空间 · 短码」+ title 全 id；全缺→「该字段未返回」
             + title 点名空间名缺。屏面实测无裸 sp_。
           · 文档数：有（含真 0 逐字「0 篇」——真实零值口径不动）；缺→「—」+title 原因。
           · 最近更新：有→屏上同款前缀 +BJT 到分（「最近同步：2026-11-19 14:20」）；
             缺→「该字段未返回」+title。
           · 短码：标识尾段大写（sp_hr→SPHR），全 id 只在 title；无标识→「该字段未返回」。
视图态     previewKey 存本面本地：开/关/Esc 全程 loc 逐字不变（快照比对）；刷新同址全收起；
           进详情、切页签随组件卸载自然清零。同时至多一行（换行自动收前一行，逐钮 aria 实测）。
Esc        展开态：收起 + 焦点守本钮（activeElement=kn-space-toggle-3 实测）+ stopPropagation
           （不触 roving 的「Esc 回搜索框」）；收起态：Esc 交还既有列表语义。
互斥锁     四方逐对：
           · vs 检索行内展开（?sdoc=）：开预览→静默删 sdoc=（实测 URL 落净）；点命中行开
             sdoc→预览作废（state 比较的渲染期调整形态，非 effect 非 ref）。双向实测。
           · vs 文档行预览 / kn7 抽屉：路由结构互斥（列表与详情不同屏；进详情列表卸载、
             预览态清零），实测 DOM 无 kn-space-toggle-*。
           任何互斥切换都不清不属于被关面的参数（q/ksort/kdir/space 原样）。
roving     toggle 与行名同行同权（共用 tabIndexFor，0/-1 分布实测），无正数 tabindex；
           ↑/↓/Home/End/Esc(框) 语义零动；ArrowDown 焦点仍落行名链接。
```

## 三档与零破

真实浏览器（headless Chrome + 静态产物预览，端口/进程用毕即杀）：`/knowledge?tab=spaces`
1440/1280/375 `vw==bodySW==docSW` 全等。预览行为态本身在 preview 无会话屏落错误态，
行态真实屏三档由 hidden 容器+既有表格布局保证、jsdom 断言覆盖，未复测项如下如实列出。
kn3 / kn6 / kn7 / kn8 / kn9 / knB / knD / knF / knG / knI / knL / kn-sort / kn-gates /
kn-doc-preview 零破：62 例 = 基线 61 + 本轮 1 全绿；全仓 150 files / 1992 passed。
本轮修 lint 一处形态问题：渲染期互斥调整先写成 ref 比较（触发 3 条
no-access-ref-during-render warning），改为官方 state 比较形态后回到既有 1 条 warning。

未测如实：行态（展开预览）真实浏览器三档与真机鼠标聚焦行为（静态预览无登录会话；以 jsdom
断言替代）；真机剪贴板不在本单范围。

## 验证尾行（R68）
```text
$ npx vitest run src/modules/knowledge   → 2 files / 62 tests passed
$ npx vitest run                         → 150 files / 1992 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-sp-dist → exit 0
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重启或重建 9122；显式路径提交（无 `git add -A`）；
无 force / amend / `--no-verify`；单 commit「feat(console): knowledge space row preview」。

# KNW5 追加 R70：检索 ↔ 详情文档的跨面同值 parity（测试波 + 两处真缺陷收口）（2026-11-20 BJT）

安全闸：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge 实到 `9813d7af`
（比交接章面 `a5832d15` 更新，含既有全部代次；如实记录）。merge 对本知识面 delta 为空；
合后基线 62/62 先绿再动工。新增 `kn.parity.test.ts`（纯测试），产品改动仅限测出的真缺陷收口。

## 一、映射（派工名 → 实际面，与文件头注释一致）

```text
「全库检索结果行」  = kn6-search-*（DocumentNameSearch 表）+ 行内展开 kn6-search-detail（?sdoc=）
「空间内文档行」    = kn3-docs-*（SpaceDetailSurface 表）+ 行内预览 kn-doc-preview-*
「空间侧预览」kn-space-preview-* 属空间列表面、对象是空间不是文档，与详情面路由互斥不同屏；
互斥矩阵按「同屏可达」锁定（sdoc/详情预览/抽屉三面同屏，四对全测）。
设计性差异（不改动，只断言+记录）：检索表有「所属空间」列、详情表无；详情预览有「短码」列、
检索展开有「原文位置」列而无短码；表格单元格缺值仍是屏上「—」口径（预览句式不适用）。
```

## 二、测出的真缺陷与收口（同单修，逐字改前/改后）

```text
缺陷①  同一 MISSING 记录在两个「预览类表面」缺值话术分裂：
  改前  检索展开 d_m：类型格 文本「—」title「上游没有给出文档类型」；
        详情预览 d_m：类型格 文本「该字段未返回」title「类型：上游没有给出」；
        （大小/更新同状）——同一条记录、两种呈现不一致。
  改后  两面同走共享 helper previewField(label, present, value, reason, shownTitle)：
        类型格 文本「该字段未返回」title「类型：上游没有给出文档类型」，两面逐字相等
        （parity 测试 1/2 段断言；在场字段的原始 MIME 仍只进 title，两面同值）。
        表格单元格未动（「—」口径属表，不属预览——exclusion 3）。
缺陷②  详情行内预览（kn-doc-preview）与检索行内展开（?sdoc=）没有互斥：
  改前  预览开着点检索命中：sdoc 展开、预览仍展开——三面互斥承诺只锁了两面。
  改后  SpaceDetailSurface 接 sdocOpen/onCloseOverlays：开 sdoc 时预览作废（state 比较的
        渲染期调整，同 R68 形态）；开预览时 doc=/sdoc= 一并静默删除。
缺陷③  互斥删除的双重 setSp 覆盖（实现缺陷②时暴露、如实记）：
  改前  onCloseDocQuietly()+onCloseSdoc() 连调各建一份 URLSearchParams(sp 同一陈旧基)，
        后者覆盖前者——实测 sdoc 删了 doc= 还在。
  改后  页面合并为一次 closeOverlaysQuietly({doc,sdoc}) 构造删除；测试锁 URL 双清。
        （备注：setSearchParams 不支持函数式 updater，第一次修复尝试因此无效。）
```

## 三、断言读数（新增 3 例，全绿）

```text
表对表   同一记录在 kn6-search-* 与 kn3-docs-* 的 name/type/size/updated 文本+title、
         行 title 全 id 逐字相等；缺值行两面表格都是「—」；行序两面同为 d_p 前、d_m 末。
预览对   kn-doc-preview 与 kn6-search-detail 对同一记录四项（文档名/类型/大小/更新）
         文本+title 逐字相等（分两轮读数：互斥使两者不能同时在场——这本身由矩阵段锁定）。
互斥矩阵 预览→抽屉（+仅 R49 既有详情一读 1）；命中→sdoc（抽屉保留=现状如实：doc/sdoc 可共存，
         预览不复活）；sdoc+抽屉→开预览（doc=/sdoc= 双清、两面卸载、0 新请求）；
         预览开→关 URL 逐字不变；详情屏无 kn-space-toggle（路由互斥）。
零请求   全 parity 读数段 fetchMock 计数与快照逐字相等；唯一 +1 是开抽屉既有详情一读（断言锁定）。
```

## 验证尾行（R70）
```text
$ npx vitest run src/modules/knowledge   → 3 files / 65 tests passed（基线 62 + parity 3；原 62 例零改全绿）
$ npx vitest run                         → 160 files / 2174 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-parity-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
```
未测如实：带行态数据的三档真实屏（静态预览无登录会话）；真机鼠标聚焦与剪贴板路径（本波无新增
可交互可见布局，仅措辞与状态机收口）。
边界：只改 `web/src/modules/knowledge/**`（新增 kn.parity.test.ts）与本证据目录；未动
App.tsx / shell / routes / registry / package·lock / web-scripts / ops；未并 main、未重建 9122；
显式路径提交（无 `git add -A`）；无 force / amend / `--no-verify`；merge（9813d7af）与
test commit 分开。

# KNW5 追加 R71：复制行单点派生 docLine（knF/knG 字段与口径统一）（2026-11-20 BJT）

安全闸：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge 实到 `ee64b4f0`——
**比派工章面更新**（章面 `0c1b94c3`/HEAD `3e94876c`/代次 `9813d7af` 的下游），如实记录。
merge 对本知识面 delta 为空；合后基线 65/65 先绿再动工。

## 一、单点派生

```text
新函数集（knowledge.ts）：
  DOC_LINE_HEADER = 文档名 | 类型 | 大小 | 更新 | 短码
  docLineFields(doc) = [name, type, size, at, shortId(id) ?? "—"]   ← 唯一一份字段序与缺值规则
  docLine(doc) = fields.join(" | ")
调用方（只此三处，全部经同一函数）：
  knF docCopyText：头行=DOC_LINE_HEADER；每行=docLine(row)。
  knG docHitCopyText：头行=DOC_LINE_HEADER 第 1 列后插入固定「所属空间」；
      每行=docLineFields(row) 第 1 列后插入 spaceLabel ?? "—"——唯一 recorded 列差异。
  kn.parity.test.ts：新增守卫例，逐行断言「knG 行去第 2 列 === knF 行」字节相等。
缺值统一「—」不补 0；短码=shortId 人话尾段大写（d_a→DA、d_p→DP），全 id 只在屏上 title 不进文本。
```

## 二、title 同句（改前 → 改后，逐字）

```text
knF 改前：复制当前排序与筛选后在屏幕上的这些行：文档名 | 类型 | 大小 | 更新。屏上数据，不会再发请求。
knF 改后：复制当前排序与筛选后在屏幕上的这些行：文档名 | 类型 | 大小 | 更新 | 短码。当前已加载 2 条，不是全量；屏上数据，不会再发请求。
knG 改前：复制当前检索词下的命中行：文档名 | 所属空间 | 类型 | 大小 | 更新。屏上数据，不会再发请求。
knG 改后：复制当前检索词下的命中行：文档名 | 所属空间 | 类型 | 大小 | 更新 | 短码。当前已加载 2 条，不是全量；屏上数据，不会再发请求。
「当前已加载 N 条，不是全量；」为两处同一句；N=本面已加载数（与计数位/命中注同源），
由 copyGates 的 FACE_TABLE.enabledTitle(loadedTotal) 单点拼装（gate 表仍是唯一文案出处）。
用户可见改动仅此两处 title + 复制正文短码列——其余字节级不变；成功状态句未动。
```

## 三、粘贴对照（同值记录 d_p；两组首末行）

```text
knF 首行：文档名 | 类型 | 大小 | 更新 | 短码
knF 末行：— | — | — | — | DM                ← d_m 行在 knF 面为…（见下注）
knG 首行：文档名 | 所属空间 | 类型 | 大小 | 更新 | 短码
knG 末行：— | — | — | — | — | DM
按列对齐：knG 每行去第 2 列 === knF 同行（parity 守卫例逐行断言字节相等）。
注：两面行集同为 [d_p, d_m]（读入序=默认序），d_m 的 name 有值「缺值文档.md」——
    上面末行取自守卫例实测串，完整行 knF=「同值文档.pdf | PDF | 2.4 MB | 2026-11-19 15:10 | DP」。
```

既有测试同步（属派工统一口径本身，非回归）：R55 knF 三组 EXPECTED、R56 knG 两组 EXPECTED
改为含短码列；title contains 断言原样通过。knI/knL 复制与 R57/R60 断言零动。

## 验证尾行（R71）
```text
$ npx vitest run src/modules/knowledge   → 3 files / 66 tests passed（基线 65 + parity 守卫 1）
$ npx vitest run                         → 160 files / 2175 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-copydist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零额外请求：复制动作与 parity 全程 fetchMock 计数与快照逐字相等（守卫例与 R55/R56 段各自锁定）。
未测如实：带登录态的真机三档行态（静态预览无会话）、真机剪贴板权限路径。
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重建 9122；显式路径提交（无 `git add -A`）；
无 force / amend / `--no-verify`；merge（ee64b4f0）与单 feature commit 分开。

# KNW5 追加 R72：文档行与文档抽屉的固定链接（testid `kn-doc-permalink*`）（2026-11-20 BJT）

安全闸：toplevel 相符、porcelain 空、显式 refspec fetch 实测 tip 即 `ee64b4f0`（与 R71 已并入
的同一 tip，merge 为 Already up to date——基线已最新，不追旧、不造空 merge）。合后基线
66/66 先绿再动工。

## 一、结构：一个字符串、两处入口（派工 ④ 的「谁在哪」显式说明）

```text
行入口   每行文档名单元格的按钮 `kn-doc-permalink`（「复制链接」）：点一次即复制该行文档的
         链接，**不需要先打开抽屉**（派工 ③ 两句的 reconciled 读法：disabled 的条件是
         「该行没有真标识」，而不是「抽屉未开」——否则与「不得先开抽屉才可用」自相矛盾）。
         读数条（`kn-doc-permalink-status`/`-fallback`）随表体一条，供行入口播报与兜底。
抽屉入口 新族 `kn-doc-permalink/-status/-fallback` 一套在抽屉内（「复制文档固定链接」），
         与保留的老族 `knO-permalink*` 共用同一个 linkText/copyLink 状态——两个入口一根串，
         knO 族不删（其掩码 URL span 原样）。同文档实测：行、抽屉新钮、knO 三个 captured 逐字节相等。
builder  两侧同走 origin + docLink(key)：keepBase 带 tab/panel/space，其余参数（q、
         ksort/kdir，以及旧地址里存在的 sort/dir）原样继承、不删不改；无 documentId 的行
         （页面内部位置键 row-N）不是标识 → disabled + 逐字 title「该文档没有可用的固定标识」，
         守卫连剪贴板都不写。
```

## 二、复现读数（测试逐字）

```text
在场地址 ?tab=spaces&space=sp_hr&q=同值&ksort=size&kdir=asc
行 0 复制得：<origin>/knowledge?tab=spaces&space=sp_hr&q=%E5%90%8C%E5%80%BC&ksort=size&kdir=asc&doc=d_p
（参数解析读数：space=sp_hr、doc=d_p、q=同值、ksort=size、kdir=asc——检索与排序参数全带上）
粘贴该串直接渲染：kn7-preview-panel 在场；loc 含 doc=d_p；抽屉字段块 title="d_p"（标识同值）；
ksort=size 复现。aria-live：成功「链接已复制」，无失败即无兜底节点；拒绝路径行侧与抽屉侧
fallback textarea 的 value 与写入串逐字节相等（scoped 查询，避免双侧同名串扰）。
掩码不变量：屏上可见 URL（抽屉 knO span）实测含 "doc=…"、不含 "doc=d_p"；行入口按钮无可见
URL 文本；全串只出现在 title、剪贴板与兜底 textarea。
零请求：复制/拒绝/兜底/三入口切换全程 fetchMock 计数与快照逐字不变（行侧与抽屉侧两段各自锁定）。
```

既有零破：kn3 / kn6–kn9 / knB / knD / knF / knG / knI / knL / knO（R63 全段原样绿）/
kn-sort / kn-gates / kn-doc-preview / kn-space-preview / kn.parity——66 例基线全绿 + 本轮 1 例
= 67；四态、403≡404、零写入口不动。三档（vite preview /tmp 产物 + headless Chrome CDP，
用毕即杀）1440/1280/375 `vw==bodySW==docSW` 全等。

未测如实：真机剪贴板权限弹窗与真实鼠标复制；行态登录会话下的三档真实屏。

## 验证尾行（R72）
```text
$ npx vitest run src/modules/knowledge   → 3 files / 67 tests passed（基线 66 + 本轮 1）
$ npx vitest run                         → 160 files / 2176 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-permalink-dist → exit 0
```
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重建 9122；显式路径提交（无 `git add -A`）；
无 force / amend / `--no-verify`；单 commit「feat(console): knowledge document permalink」。

# KNW5 追加 R64：空间文档列表类型桶筛选（testid `kn-type-*`）（2026-11-20 BJT）

安全闸：toplevel 相符、porcelain 空、显式 refspec fetch `lane/hermes-console`；上游 tip
`ee64b4f0` 已在基线链，merge `Already up to date`。当前 HEAD `9e3c56df`（R63 固定链接）=远端
tip，工作树干净；未 reset、未并 main、未重建 9122。

## 一、口径

```text
桶       docTypeBuckets(combined) 纯派生：「全部」置首（计数=已加载行数）、其余按屏上人话
         类型（docTypeLabel 词表：PDF / Word 文档 / 表格 / 演示文稿 / Markdown / 文本 /
         结构化数据 / 网页 / 图片 / 其他类型）首现序；缺类型行归「未归类」；每桶真
         button[type=button]，data-testid `kn-type-<i>`（全部=`kn-type-all`），文本含计数，
         aria-pressed 反映选中态，同点=清除回全部；禁新造英文枚举上屏。
过滤     本地过滤 combined（游标分页累加后的全集）∩ 名字筛选 → shown；?type=<人话值> 进
         URL，与 q/ksort/kdir/面包屑组合互不清除；粘 ?type=表格&… 刷新复现选中态+行数；
         默认态（全部）不写参数。
游标     切类型触发 R54 重置 effect（deps 增补 typeKey）：累加页清空、游标退回第一页
         信封信；切桶本身 0 新请求。
计数同源 桶计数、kn9 计数句、Surface data-len、表格行数同一份数据；非 ready 聚合不到
         类型只剩「全部」桶且计数「—」；真空集不写 0。
空态     ?type=压缩包 无匹配 → `kn-type-empty` 文案 + 清除出口 `kn-type-clear`（只删
         ?type=，q/sort/dir 不动）；与「该空间暂无文档」真空句严格可分。
非 ready  loading / error / denied / 未接入 / login 态：类型桶 disabled + title 逐字
         「当前不可筛选：<短原因>」——原因读自 copyGates blockedReasonByState 同表
         （403≡404 同句；未造第二套措辞）；点禁用桶不改 URL、零请求。
键盘     真 button、Tab 走原生、:focus-visible 走现成 token（.kn-type-bucket:focus-visible）；
         不新增 tabindex，roving（kn3）行链接不受影响。
```

## 验证尾行（R64）
```text
$ npx vitest run src/modules/knowledge   → 3 files / 68 tests passed（基线 67 + 本轮 1）
$ npx vitest run                         → 160 files / 2177 passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-type-dist → exit 0（preview/CDP 进程已清理）
```
三档（vite preview + headless Chrome CDP 真实屏）：1440/1280/375 `vw==bodySW==docSW` 全等。
未测如实：带会话的登录态桶读数（preview 无后端会话）、真机鼠标/剪贴板权限弹窗。
kn3 / kn6–knN / knw5 / kn-sort / kn-gates / kn-doc-preview / kn-space-preview / kn-doc-permalink /
kn.parity 既有断言零改零破（含 R72 knC→kn-sort 改名后续测试）。

边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重启或重建 9122；显式路径提交（无 `git add -A`）；
无 force / amend / `--no-verify`；单 commit「feat(console): knowledge document type filter」。

# KNW5 追加 R74：类型筛选接真数据复验（BFF 换代后活体实测 → 走向 A）（2026-11-20 BJT）

安全闸：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge 实到 tip `f54b8a37`
（比 R73 的 `0ac8bf4b` 基线更新，按实测合并，零冲突、知识面 delta 空）。merge commit 与本
feature commit 分笔。

## 一、活体实测原始读数（cookie 只在 curl 内拼 header，零打印；9122 只读未动）

```text
GET /agent-api/api/knowledge/spaces?limit=20
  HTTP 200 · 顶层键 [asOf, asOfSource, count, cursor, hasMore, probe_notes, rows, source, spaces]
  spaces 长度 3 · 首条键 [description, document_count, kind, last_sync_at, name, space_id]
  取 space_id=1（seakoi-p0-8-probe）继续探文档：

GET /agent-api/api/knowledge/spaces/1/documents?limit=50   → HTTP 404（嵌套形态仍不认）
GET /agent-api/api/documents?limit=50&spaceId=1           → HTTP 200 ← 主读口通了
GET /agent-api/api/knowledge/documents?limit=50&spaceId=1 → HTTP 200（别名口同形）
  200 体顶层键 [asOf, asOfSource, count, cursor, documents, hasMore, rows, source]
  documents 长度 1 · item 原始键 [collection_name, created_at, description, document_id, id,
    is_released, kind, name, state, status, type, updatedAt, updated_at]
  样例值：name="seakoi-p08-doc-1.txt"；type=0、kind=0（**数字枚举，不是 mime/扩展名字符串**）；
    size/sizeBytes 无此键；时间 updated_at=updatedAt="2026-11-14T06:33:18+08:00"；
    信封 hasMore=false、cursor=null、count=1、asOfSource="bff-read-time"。
```

判读与不臆造边界：
- 上一轮记的两形态 404 已不复现——本轮重新实测，按新事实走**走向 A**（读口可用）。
- `type: 0` 是数字：前端 pickString 原本会把它读成缺失、谎报「该字段未返回」。修正为
  数字照原样转字符串进 raw → 人话映射查不到 → 「其他类型」，`title="0"`。**不猜 0 的
  含义**（不映射成 txt，尽管文件名带 .txt）。
- 无 size 键 → 大小格如实「—」/「该字段未返回」，不编 0。
- 时间键 `updated_at/updatedAt` 带 +08:00：现有 momentOf 别名已覆盖，BJT 到分原样
  （2026-11-14 06:33）。
- 信封别名差距：BFF 给 `count/hasMore/cursor`，前端 R54 页信封读的是
  `nextCursor/next_cursor/total/totalCount/total_count`——不匹配，knE 诚实显示
  「无分页游标 / 总数不可用」（测试锁读数）。本轮**不扩分页别名**（不在单内，避免顺手改），
  差距如实挂账。

## 二、本笔改动（在 R73 桶基础上收敛口径，非新功能）

```text
参数口径  本面真值键改 ?ktype=：读取 ktype→旧 type 兜底（旧粘贴链继续生效）；写只写 ktype；
          清除时 ktype/type 一并删（防兜底读让旧参数复活）；q/ksort/kdir/space/doc 全程
          不动（组合实测）；换页签两键都清。
桶名      缺/空类型桶按派工定名「未标注类型」；标签单点 typeBucketLabel(row)——桶聚合与
          过滤比较共用一个函数（R73 曾两处各写字面量，测出「未归类/未标注类型」分裂：
          桶显示 1 行、过滤 0 行——本笔修复，改前读数见测试提交注）。
数字类型  docOf 的 typeRaw 兼容数字枚举（String(0)）→「其他类型」+title 原始值。
空态两句  ktype 在场且组合后无行：「该类型下没有文档：当前已加载 N 条里没有「X」类型的
          文档。」（同覆盖单桶为 0 与筛无匹配两种，非真空句「该空间暂无文档」可分）+ 清除出口。
非 ready  计数「—」+title；原因句走 copyGates 同表；不造桶不造数。
```

## 验证尾行（R74）
```text
$ npx vitest run src/modules/knowledge   → 3 files / 69 tests passed（基线 68 + 活体契约夹具 1）
$ npx vitest run                         → 166 files / 2306 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-type2-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 全等
零额外请求：切桶/清桶/组合粘链各段 fetchMock 与前后快照逐字相等（render 自带的既有读取
按段单列，不误计入动作）。
kn3 / kn6–kn9 / knB / knD / knF / knG / knI / knL / knO / kn-sort / kn-gates / kn-doc-preview /
kn-space-preview / kn.parity 零破。
```
未测如实：真实登录态下 space=1 端到端屏（preview 无会话，落未接入诚实态，由活体 curl +
组件级真契约夹具两路覆盖）；BFF 分页信封别名差距留待单开一轮（不在本单范围，读数已挂账）。
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；未动 App.tsx / shell / routes / registry /
package·lock / web-scripts / ops；未并 main、未重建 9122；显式路径 add；无 force / amend /
`--no-verify`；单 commit「feat(console): knowledge document type filter」。

# KNW5 追加 R75（wave-29）：知识三面「最近更新」呈现收单一 helper（updated.ts）（2026-11-20 BJT）

安全闸：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge 实测 tip 即预期 `54f3dcfc`
（纯账本章笔，代次 `86cb2ede`），零冲突、知识面 delta 空；merge 与 feature 分笔不成立——
本次为 fast-forward 链上的单 commit。

## 一、收口位点与语义保留位点（按派工写清）

```text
收口（值+title 全出 updatedText）：
  ① 空间列表时间格 knw5-space-time（前缀标签「最近同步/最近更新」按记录键仍由 syncMomentOf
     选择，保留在调用方；值本体与 title 来自 helper）
  ② 空间详情文档更新列 kn3-docs-updated
  ③ 全库检索命中更新列 kn6-search-updated
  knowledge.ts 内 spaceOf/docOf 的 .at 字段值同步走 updatedText（复制文本、计数口径
  因此与三列天然同值）；atReason/atHint 判定从「at 真值」改为「at 非 —」——修掉一处
  因接入 helper 而引入的回归（缺失句被恒真值吞掉，测试当场抓到）。
按语义保留（不硬套）：
  · knM 台账与「数据截至」行的 asOf（knAsOfFacts/stampOf/newestOf）——数据截至语义；
  · ingest 任务时间（taskOf）与检索记录时间（retrievalOf）——登记/处理时间语义；
  · 行内预览与复制文本里「更新」字段的 title 仍走 hint 句（预览面不在三处表格列范围）。
```

## 二、口径与逐字读数

```text
updatedText(iso)：合法 ISO → 北京时间到分 `YYYY-MM-DD HH:mm` + title `时间 <原样ISO>（UTC）`；
缺失/非法 → 值「—」+ title 逐字「上游未返回时间；不用本机时间顶替。」（两句固定，由同一
函数决定；本机时钟零参与）。
三面同一记录（2026-11-14T06:33:18+08:00）实测：检索列与详情列值逐字等、title 逐字等
（`时间 2026-11-14T06:33:18+08:00（UTC）`）；空间列剥前缀后同值、title 同句。
非 ISO（yesterday）与缺失：三处同落「—」+同一缺失句（parity 用例断言）。
```

## 三、有意口径改动（测试 pin 同步，非回归）

```text
检索列在场 title：旧 null（不写理由不写原样）→ 新「时间 <ISO>（UTC）」（R75 在场句）。
三列缺失 title：旧「上游没有给出更新时间/上游没有给出时间」→ 新统一缺失句；
  hint 字段本身保留原句（预览/复制等位点不动）。
```

## 验证尾行（R75）
```text
$ npx vitest run src/modules/knowledge   → 3 files / 70 tests passed（基线 69 + 三面时间 parity 1）
$ npx vitest run                         → 169 files / 2352 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-updatedist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零额外请求：helper 纯函数；parity 用例全程 fetchMock 只有两轮 render 的既有读取。
kn3 / kn6–kn9 / knB / knD–knN / kn-sort / kn-gates / kn.parity / kn-doc-preview /
kn-space-preview / knL / knM 零破。
```
未测如实：带登录会话的三面真实数据屏（静态 preview 无会话，落诚实非 ready 态；真实值口径
由 parity 夹具 + 单测逐字锁定）；行内预览/复制位点的 title 本单明确不收口（语义保留）。
边界：只改 `web/src/modules/knowledge/**` 与本证据目录；显式路径 add；无 force/amend/
`--no-verify`/`git add -A`；未并 main、未重建 9122；单 commit
「feat(console): unify knowledge updated-at presentation」。

# KNW5 追加 R76：「最近更新」口径护栏（纯测试单）（2026-11-20 BJT）

安全门：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge 实测 tip 即预期 `1683d467`
（wave 内容在他模块，知识面 delta 空）。本单**零产品文件改动**（提交仅新增
`knowledge.updated.test.tsx` 与本证据追加）。

## 护栏与读数

```text
① 三面同值：喂同一 ISO `2026-11-14T06:33:18+08:00`——检索命中列与详情文档列渲染逐字相等，
   且 === updatedText(ISO).value === `2026-11-14 06:33`；空间列剥语义前缀（最近同步）后同值。
   口径注：+08:00 的原生就是北京时区，到分钟仍 06:33；测试初稿把它当 UTC 期望成 14:33，
   两处失败全部是**测试期望错、产品正确**，按 helper 实际输出修正期望（改前/改后=期望值，
   非产品改动）。
② 三态：非法 `yesterday`、空串 ""、字段缺失——两张表各 3 行落「—」、title 逐字
   「上游未返回时间；不用本机时间顶替。」×3；列表面同样 3 行同句。假系统时钟
   vi.useFakeTimers 钉在 2031-03-04 渲染：整页（详情面与列表面两轮）文本均无 "2031"——
   本机时钟零参与有实证。
③ title 对应：在场 cell title 逐字 `时间 2026-11-14T06:33:18+08:00（UTC）`（含原样 ISO），
   值 = 同一时刻北京到分 06:33；三面同一 title 句式。
④ 零额外请求：三面渲染后，连点排序两下、类型桶开合、行内预览开合、台账展开收起、复制
   共 9 个只读动作——fetchMock 计数与 urls() 排序快照逐字不变。
```

## 验证尾行（R76）
```text
$ npx vitest run src/modules/knowledge   → 4 files / 74 tests passed（基线 70 + 护栏 4）
$ npx vitest run                         → 174 files / 2395 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning；本单新增的
  4 条 unused 变量错误为测试文件自身残留，提交前已清零）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-upd-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
```
未测如实：带登录会话的真实数据屏（静态 preview 无会话；口径由本护栏的显式 ISO 夹具逐字锁定）。
边界：只动 `web/src/modules/knowledge/knowledge.updated.test.tsx`（新增）与本证据文件；
零产品行为改动；显式路径 add；无 force / amend / `--no-verify` / `git add -A`；
单 commit「test(console): knowledge updated-at caliber guards」。

# KNW5 追加 R102：空间行 → 空间详情真锚点 deep link（kn-space-open / kn-space-nolink）（2026-11-20 BJT）

安全门：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge 实测 tip `f1b509b9`
（预期章笔；知识面 delta 空——150 文件全在他模块），零冲突。

## 一、入口机制现查（回执贴命中）

```text
$ git grep -n "panel=spaces" -- web/src/modules/knowledge
  KnowledgeModulePage.test.tsx:3594:    expect(pasted).toContain("panel=spaces");
$ grep -n "spaceLink" KnowledgeModulePage.tsx（节选）
  3334:  const spaceLink = (id: string) => { keepBase() → set panel=spaces → set space=id → delete doc }
  935:  data-testid="knw5-space-link" to={spaceLink(row.id)}   ← 改前
结论：空间详情是查询态槽位（无 /knowledge/:spaceId 路由），落点 /knowledge?tab=spaces
&panel=spaces&space=<id>；行内早已是真 <a href>（react-router Link），kn3-docs-* 由
?space= 挂载的 SpaceDetailSurface 渲染。
```

## 二、本轮改动（改名收口，不造第二个链接）

```text
① testid 更名 knw5-space-link → kn-space-open（页面×2：Link + roving 选择器
   a[data-testid=…]；CSS focus-visible 选择器×1；测试×13 全同步）。一行一链不重复。
② 无标识行副文本加 data-testid="kn-space-nolink"，title 改逐字「该空间没有可用标识」
   （原「上游没有给出这个空间的标识」；2848 行另一处空间组标签不在本单范围，保留）。
③ 不加 target="_blank"：react-router 对带 target 的 Link 跳过拦截，会砸掉同页 Enter/
   点击进详情；真 a[href] + 未修饰点击本身即支持 Ctrl/Cmd/中键新标签（等同可新标签方案）。
```

## 三、R102 新用例（4 条，KnowledgeModulePage.test.tsx 末 describe）

```text
锚点：2 有标识行各 1 真 A、href 逐字 /knowledge?tab=spaces&panel=spaces&space=sp_hr、
  roving tabindex 含 0 且全在 {0,-1}、点击后 loc 含 space=sp_hr（Enter 走同一真 href，
  jsdom 不模拟原生回车激活，按本文件既有口径以 href+click 同源断言）。
互斥：先开 kn-space-preview-0 再点链接 → 预览节点全树（含 portal）0 个、详情 loc 落定；
  直接点链接 → 预览从未挂载、kn3-docs-row 在场。反向不互斥成立。
nolink：无 id 行 0 链接、kn-space-nolink SPAN、title 逐字「该空间没有可用标识」、
  点击不写剪贴板（writeText 未调用）、行内无伪造 space= 链接、URL 不变。
零额外请求：列表面渲染后 urls()=[documents?limit=50|spaces?limit=20]（R52 预载口径），
  预览开合 + 本地关键词键入后逐字不变；点链后新增读取仅详情槽位既有集
  {spaces 复读给面包屑, 该空间文档表}，未知 URL 零出现。
```

过程记录（非缺陷）：批量替换 `kn-sort-name` 双点行时误伤两处既有测试（str.replace 全量
替换），当场被 knF/kn-sort 两条测试抓到并按 HEAD 原文恢复；本单未改动任何产品行为
（testid/文案/选择器之外零逻辑改动），全仓测试为证。

## 验证尾行（R102）
```text
$ npx vitest run src/modules/knowledge   → 4 files / 78 tests passed（基线 74 + R102 4）
$ npx vitest run                         → 174 files / 2399 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r102-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3、kn6–kn9、knB–knO、kn-sort、kn-gates、kn.parity、kn-space-preview 全族在
  78/78 与全仓 2399/2399 中逐条通过（knw5 族测试同步更名后语义原样，非放宽断言）。
```
未测如实：带登录会话的真实列表面（静态 preview 无会话落非 ready 态；href/互斥/nolink
由 jsdom 用例逐字锁定）；浏览器原生「Enter 激活 a[href]」与 Ctrl/Cmd/中键新标签是 UA
行为，jsdom 不模拟，按 href 在场 + 同源 click 落点断言代替。
边界：只改 web/src/modules/knowledge/**（页面/CSS/测试）与本证据；显式路径 add；
无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「feat(console): knowledge space row deep link」。

# KNW5 追加 R108：空间详情文档列表单页上限诚实化（kn3-page-cap）（2026-11-20 BJT）

安全门：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge 实测 tip `f1b509b9`
（即预期章笔，Already up to date）。

## 一、limit 现查（N 的来源）

```text
$ git grep -n "limit" -- web/src/modules/knowledge（非测试命中节选）
  knowledge.ts:138  DOCUMENTS_URL = "/agent-api/api/documents?limit=50"   ← 改前字面量
  knowledge.ts:164  documentsUrl():      params.set("limit", "50")
  knowledge.ts:175  documentsPageUrl():  params.set("limit", "50")
N = 50。本轮把三处收成单一常量 DOCUMENTS_LIMIT=50（knowledge.ts:139），取数 URL 与
屏上限句同源；URL 输出字符串逐字不变（测试 URL 常量零改动）。
与 knE-page-*（R54 游标分页条）口径关系：两 bar 并存但语义不同、互不矛盾——
  knE 说「总数/已显示与游标信封」（total/nextCursor 只认信封字段，缺则「总数不可用/
  无分页游标」）；kn3-page-cap 说「本次请求的单页上限 N=50 与屏上可见行数 M」。
  上限句的游标半句直接读同一个 cursorOffered（信封游标字段在场否），措辞跟分页条一致
  （「暂不支持翻页」），不另起第二套翻页说法。testid 保留双轨不合并：knE-page-count
  （信封读数）与 kn3-page-cap（请求上限）回答的是两个问题，弃任一都会丢既有 pin。
```

## 二、常驻句与读数（逐字）

```text
值：本页最多显示 50 篇（当前已加载 M 篇；复制清单也只含这些篇）
  ——M=shown.length（屏上可见行，与复制清单同一集合）；M 为 0/未读到渲染「—」，不写 0
  （实现上 ready-空集走 knN 空态分支，上限句整体不渲染，「—」为防御分支）。
追加句（M==N 才在场）：可能还有更多，改用全库检索或收窄类型筛选（kn3-page-cap-more）
title：limit=50；上游回答没给可用的分页游标：暂不支持翻页，本页上限句不假装还有下一页。
  （cursorOffered 为真时换「翻页走旁边的分页条」句——两句由同一在场判定选出，不编造。）
三同源实证（测试断言）：复制清单数据行数 == kn3-docs 表 data-len == 屏上
  kn3-docs-row 计数 == 常驻句里的 M（夹具 3 行：3==3==3==3）。
三态不渲染：empty（ready 0 行）/ error(500) / denied(403) 下 kn3-page-cap 与
  -more 均 toBeNull（常驻句在 gate 的 render 分支内，非 ready-非空 即整段缺席）。
零额外请求：上限句为纯屏上派生——ready 渲染后 DOCS_SPACE 计数 +1 是详情槽位自身
  既有读取，点常驻句后 urls() 排序快照逐字不变。
```

## 验证尾行（R108）
```text
$ npx vitest run src/modules/knowledge   → 4 files / 82 tests passed（基线 78 + R108 4）
$ npx vitest run                         → 174 files / 2403 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r108-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3、kn6–kn9、knB–knO（含 knE-page-*）、kn-sort、kn-gates、kn.parity、
kn-space-preview 全族 82/82 通过；DOCUMENTS_URL 重构后输出串逐字不变，URL pin 零改动。
```
未测如实：带登录会话的真实详情屏（静态 preview 无会话；句文本/三同源/三态由夹具逐字
锁定）；「读口是否真吃 cursor」本轮仍未实测（R74 只证信封别名错位），故 title 用
「信封在场判定」的动态措辞而非断言服务端能力。
边界：只改 web/src/modules/knowledge/** 与本证据；显式路径 add；无 force/amend/
--no-verify/git add -A；未并 main、未重建 9122；单 commit
「feat(console): knowledge space docs page cap honesty」。

# KNW5 追加 R114：预览/命中展开块内的行复制（kn-doc-copy-*，单 helper 复用）（2026-11-20 BJT）

安全门：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge 实测 tip 即预期 `9014f6ba`
（代次 `608148d3` 账本链；知识面 delta 空）。

## 一、族名映射（按任务要求写清）

```text
派工文本的「①检索命中的内联展开块（kn6-search-detail*，URL ?sdoc=）」= 实际族
  kn6-search-detail（KnowledgeModulePage.tsx:2895 起，?sdoc= 驱动，命中行点文档名展开）✔ 存在。
「②文档行内预览（kn-doc-preview-*）」= 实际族 kn-doc-preview（同文件 1910 起，DocTable
  行内预览，previewKey 单开互斥）✔ 存在。
真正带遮罩的抽屉是 kn7-preview-*（?doc=）——本单未动（任务文本已注明该历史命名差异）。
testid：kn-doc-copy / kn-doc-copy-status / kn-doc-copy-fallback（+容器 kn-doc-copy-row）
  全模块 grep 零冲突（knF/knG 是清单级复制，本族是行级复制，前缀天然分族，无需让号）。
```

## 二、实现（单点复用，禁第二套格式）

```text
knowledge.ts 新增 docSingleCopy(doc) = `DOC_LINE_HEADER.join(" | ")\n + docLine(doc) + "\n`
——行体逐字走 R71 单点 docLine（文档名|类型|大小|更新|短码，缺值「—」，短码=shortId 大写尾8、
全 id 只在 title；时间列值是 spaceOf/docOf 接入的 updatedText，R75 口径自动继承）。
页面新增共享控件 <DocLineCopy doc>，两处落点各挂一次；控件零请求：只读 navigator.clipboard，
拒写/无剪贴板 → 只读 textarea（value 与目标串逐字同）；aria-live 状态句
（成功「已复制」/失败「剪贴板没接受：文本在下方，可手动选取。」）；
空行（文档名与标识都没给）disabled + title「这一行没有可复制的文档内容：文档名与标识都没给出。」。
JSX 落点①的 dl+控件包进 Fragment（相邻 JSX 修一次，非行为改动）。
```

## 三、逐字读数（同一条 d_manual 两处复制）

```text
表头：文档名 | 类型 | 大小 | 更新 | 短码
行体：员工手册.pdf | PDF | 2.4 MB | 2026-11-19 15:10 | DMANUAL
缺项条（d_bare2）：缺项文档.pdf | — | — | — | DBARE2（类型/大小/更新三列皆「—」，不补 0）
测试断言：两处 writeText 实参 toBe 逐字相等，且 === docSingleCopy(readSpaceDocuments(同夹具).rows[0])
（走产品同一派生链直出）；两处 fallback textarea value 逐字相等（拒写态，rows=3 含尾换行）。
屏上 title 规则沿用 R70/R75（预览 dd「更新」=「更新：上游没有给出更新时间」hint 句；
测试初稿误按 updatedText 缺失句断言，属期望错、产品对，按 R75「预览位点语义保留」证据修正期望）。
```

## 验证尾行（R114）
```text
$ npx vitest run src/modules/knowledge   → 4 files / 86 tests passed（基线 82 + R114 4）
$ npx vitest run                         → 183 files / 2473 tests passed（较上轮 +9 文件来自
  merge 的 wave 内容在他模块，全绿非退化）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r114-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零额外请求：命中展开 + 复制 + 预览开关全程 fetchMock 计数与 urls() 排序快照逐字不变
  （测试断言 c0/u0 两端相等）。
零破：kn3、kn6–kn9、knB、knD、knF、knG、knI、knL、kn-sort、kn-gates、kn.parity、
kn-doc-preview、kn-space-preview、kn-type 全族 86/86 通过。
```
未测如实：带登录会话真实数据屏（静态 preview 无会话；两处同值/缺项/fallback 由夹具逐字
锁定）；浏览器真实剪贴板权限弹窗路径（jsdom 以 writeText reject 代证）。
边界：只改 web/src/modules/knowledge/** 与本证据；显式路径 add；无 force/amend/
--no-verify/git add -A；未并 main、未重建 9122；单 commit
「feat(console): knowledge document copy in preview」。

# KNW5 追加 R118：类型与筛选 URL 保参护栏（纯测试单）（2026-11-20 BJT）

安全门：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge 实测 tip 即预期 `9014f6ba`
（Already up to date）。本单**零产品文件改动**（提交仅新增 knowledge.filters.test.tsx
与本证据追加）。

## 一、参数现状核实（grep 命中行）

```text
KnowledgeModulePage.tsx:3345  const query = sp.get("q") ?? "";
  :3353-3354  sortCol = docSortCol(sp.get("ksort") ?? sp.get("sort")); sortDirRaw = sp.get("kdir") ?? sp.get("dir")
  :3359       typeKey = sp.get("ktype") ?? sp.get("type") ?? ""      ← 旧键只读兜底
  :3468-3476  写只写 ktype；清除时 next.delete("ktype") + next.delete("type") 双删
  :2215-2222  分页复位 effect：[spaceId,nonce,sort,dir,filter,typeKey,kind,meta1] 变化 →
              setMoreRows([]); setCursor(meta1?.nextCursor ?? null)（游标只在组件 state，URL 无 cursor 参数）
  :2401-2402  kn-type-all / kn-type-<i> 真 button + aria-pressed；:2429 kn-type-empty 空态
派工补正确认：?source= 在本模块无对应控件（source 只是空间行列标签），本单以
ktype 新键 + type 旧键覆盖，未造参数。
```

## 二、五项护栏与读数

```text
① 深链回填：?ktype=表格 → 该桶 aria-pressed="true"、PDF 桶 "false"；旧键 ?type=PDF 同值
   回填且 ktype 不被静默写入；?space=sp_x → 请求 URL 的 spaceId 与地址参数 toBe 逐字同；
   ?q=人事 → kn8-global-input 与 kn6-search-input value 均逐字「人事」。
② 改一不动余：ktype=表格 态下点 PDF 桶 → 只写 ktype=PDF、type 键不冒头，
   q/ksort/kdir/space/tab/panel 逐字不动；先翻到末页（knE-page-end 在场）再切桶 →
   end 标记消失、「显示更多」回可点、data-len 回第一页口径（1）——游标复位有行级+状态级
   双证；URL 全程无 cursor 参数（断言 has("cursor")===false）。
③ 复原：同 URL 二次 render → loc 逐字同、桶 pressed 同、data-len 同。
④ 非法枚举：?ktype=__nope__ 与旧键 ?type=__nope__ 两路 → loc 与传入逐字等（不改写）、
   kn-type-empty「该类型下没有文档…「__nope__」…」在场、kn-type-all/kn-type-clear/
   kn3-docs 锚全在。
⑤ 请求计数：ktype 三跳+本地名筛+排序双点后 fetchMock 计数与 urls() 逐字不变（+0）；
   非法与合法枚举两轮 render 的增量读取 toEqual 逐字同；space= 切换（不重挂、查询态导航）
   增量恰为 docsUrlFor(sp_y)×1，sp_x 读取与 SPACES 均 +0——如实：这不是零请求，是该空间
   文档的既有读取。
过程记录（均测试自身期望错，产品行为无改动）：初稿把「页码归 1」后行集期望成 d1+d3=2，
实测复位同时弃第二页累加行（combined 退回 baseRows，len=1）——按产品语义（复位即回第一
页行集）修正期望；初稿合法/非法对照误比累计计数，改为比每轮增量。
```

## 验证尾行（R118）
```text
$ npx vitest run src/modules/knowledge   → 5 files / 91 tests passed（基线 86 + 护栏 5）
$ npx vitest run                         → 184 files / 2478 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning；本单曾有的
  1 条 unused(DETAIL_Y) error 提交前已清零）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r118-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort/kn-gates/kn-doc-copy*/kn-space-preview
全族在 91/91 与全仓 2478/2478 中通过。
```
未测如实：带登录会话真实数据屏（护栏用显式夹具，游标翻页走 mock 信封 nextCursor=c2 代证）；
`ref=` 参数在场性只做「不动」侧断言未单独回填（本模块 ref 为锚点提示参数，无控件回填语义）。
边界：只新增 web/src/modules/knowledge/knowledge.filters.test.tsx 与本证据；零产品改动；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge filter url guards」。

# KNW5 追加 R125：跨面同值护栏纳入 kn7 抽屉 + 抽屉缺值句式收口（2026-11-20 BJT）

安全门：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge 实测 tip 即预期
`d7965c2a`（wave-33 代次，知识面 delta 空）。

## 一、既有覆盖核查（先查后写，未造重复用例）

```text
$ git grep -n kn7 -- kn.parity.test.ts
  :188  holds the mutex matrix (doc preview / kn7 drawer / sdoc expand) …   ← 只锁互斥，无逐字段
$ 主测试 :212-217 / :806 / :2257 —— 抽屉断言全是固定夹具绝对值（PDF/2.4 MB/15:10），无跨面对账
$ knowledge.updated.test.tsx（R76）三面 updatedText——表格/行内预览口径，抽屉不在其列
结论：抽屉的逐字段跨面 parity = 真缺口（维度 A）；抽屉缺值句式独立一套 = 真缺陷（维度 B）；
「打开预览零额外请求」对行内预览成立、对抽屉不成立（R49 详情读，维度 C 按实测口径断言）。
```

## 二、真缺陷与修复（同单，前后对照）

```text
缺陷：DocPreviewDrawer 四字段（文档名/类型/大小/更新）缺值时自一套文案——文本「—」、
  title 裸 hint（如「上游没有给出文档类型」）或「这条不在当前已加载的列表里」；
  而两处行内预览按 R70 走 previewField：「该字段未返回」+「<字段>：<原因>」。
  同一条记录、同为预览面，两套缺值话术并存在屏。
修复（仅动抽屉这一处，复用同一 helper previewField，零新文案）：
  改前 dd：title={row ? (row.atHint ?? undefined) : "…列表里"} > {row?.at ?? "—"}
  改后 dd：title={fUpdated.title} > {fUpdated.text}
    fUpdated = previewField("更新", row !== null && row.atHint === null, row?.at ?? "—",
                            row?.atHint ?? "这条不在当前已加载的列表里")
  在场值文本与 title 逐字不变（type 在场 title 仍=typeRaw；名/大小/更新在场 title 仍=无）
  ——91 条既有用例（含 :212-217/:806/:2257 在场值 pin）修复后原样全绿，未改一条断言。
表格列不在收口范围：表格口径是「—」+ updatedText/hint title（R75/R76 设计），维持。
```

## 三、新护栏（knowledge.parity.test.tsx，3 用例）

```text
A) 四面在场值逐字同（检索表列=详情表列=行内预览=抽屉，toBe 链 + 逐字示例锁
   PDF / 2.4 MB / 2026-11-19 15:10 / 员工手册.pdf）；短码三源一致：
   kn-doc-preview-code === docLine 第 5 列 === shortId("d_p1")="DP1"；
   抽屉 dl title 逐字 "d_p1"（全 id 只在 title）；表体+抽屉正文零裸 id。
B) 缺字段（d_p2 无名外全缺）：两处行内预览与抽屉三预览面「该字段未返回」逐字同、
   title 逐字同（如「更新：上游没有给出更新时间」）；表列仍「—」+R76 缺失句（设计差）。
C) 请求计数实测（与派工字面差异声明）：行内预览开合 +0（复用已载）；抽屉每次打开
   +1 == /agent-api/api/documents/d_p1（R49 既有详情读，非本单引入、纯测试单不改产品）；
   开着不动零追加；关闭 +0；关→开不叠加（两次打开=该 URL 恰 2 次）；SPACES/文档表
   读取全程不随抽屉复读。
```

## 验证尾行（R125）
```text
$ npx vitest run src/modules/knowledge   → 6 files / 94 tests passed（基线 91 + 护栏 3）
$ npx vitest run                         → 192 files / 2519 tests passed（+8 文件为 merge 的
  wave-33 他模块内容，全绿非退化）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning；本单曾有
  1 条 unused(click) error 提交前清零）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r125-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort/kn-gates/kn-doc-copy*/kn-space-preview/
kn-type 全族在 94/94 与全仓 2519/2519 中通过（抽屉修复后的在场值路径零测试改动即证同值）。
```
未测如实：带登录会话真实屏（详情读真实信封 404 未接入态与 mock 同构；护栏锁渲染口径）；
抽屉对「不在已加载列表」doc 的缺值句（row=null 分支）仅由 previewField 直调语义覆盖，
DOM 路径未单测（需构造列表外 doc=，本单夹具未含）。
边界：改 web/src/modules/knowledge/{KnowledgeModulePage.tsx(仅 DocPreviewDrawer 四 dd 渲染),
knowledge.parity.test.tsx(新增)} 与本证据；显式路径 add；无 force/amend/--no-verify/
git add -A；未并 main、未重建 9122；单 commit「test(console): knowledge cross-face parity guards」
（含 B 维度一处真缺陷修复，按派工「测出真缺陷同单修并注明前后」条款）。

# KNW5 追加 R131：分页×筛选组合护栏（纯测试单）（2026-11-20 BJT）

安全门：toplevel 相符、porcelain 空、显式 refspec fetch 后 merge 实测 tip 即预期 `76090480`
（知识面 delta 空）。零产品文件改动（提交仅新增 knowledge.paging.test.tsx 与本证据追加）。

## 复用边界（先 grep 后写，锁过的不重写）

```text
主测 knE 段（KnowledgeModulePage.test.tsx :2503-2667）已锁：第一页不带 cursor（:2514）、
排序/名称筛选重置+计数文本（:2556-2563）、无 total「总数不可用」（:2573-2578）、
无游标字段态（:2588-2592）、坏 cursor 不并回（:2596-2610）、403≡404 同体/rid 在场/
旧行保留/重试后并回（:2612-2667）、末页文案「已到末页」（:2541）。
R118（knowledge.filters.test.tsx）已锁：切类型后游标复位翻转、URL 无 cursor 参数。
R108 已锁：kn3-page-cap 49/50 边界与单页三值。
派工两个名字核实不存在：kn-list-copy 无（清单复制是 knF-copy 族）；导出族无——
页面仅 data-export="absent" 标记（KnowledgeModulePage.tsx:1297/:1630/:2630），
第④项按三值相等落，且加锁 gate 的 data-export==="absent"。
本文件新增组合：①第 2 页后切 ktype 的行替换（第 2 页独有行按标识出局 +
「无旧 cursor 重放」全程计数 + 计数文本回 M=2）；②末页态 cap 与 knE 计数同屏互等
（M 两句 toBe 对账）+ more 按钮实测「在场、disabled、文本已到末页」（非隐藏）；
③失败窗口静置零自动重发 + 重试整段增量恰 1 条且 URL 逐字 ==P2URL + 并入行按身份断言；
④两页合并态 knF-copy 行数==可见行==data-len==cap M（R108 只测了单页态）。
```

## 关键读数

```text
①切桶「表格」后：knE-page-count 逐字「已显示 2 篇 · 总数不可用」、屏上零「C 说明」零 d_c、
  cursor= 请求全程恰 1 次（无旧 cursor 重放）；本地切桶增量 0。
②末页：disabled=true + txt「已到末页」+ knE-page-end 在场；cap「本页最多显示 50 篇
  （当前已加载 3 篇；复制清单也只含这些篇）」，-more 不在场（3<50），cap M==count 读数=3。
③500 后 rid「请求编号：rid-r131-500」在场、旧 2 行仍在、静置零重发；重试 added 恰
  [P2URL]、P1 计数不涨；成功后 3 行且含「C 说明.txt」行。
④复制行数 3 == rowCount 3 == data-len "3" == cap M；gate data-export="absent"。
```

## 验证尾行（R131）
```text
$ npx vitest run src/modules/knowledge   → 7 files / 98 tests passed（基线 94 + 组合 4）
$ npx vitest run                         → 196 files / 2540 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r131-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort/kn-gates/kn-doc-copy*/kn-doc-preview/
kn-space-preview/kn-type/kn3-page-cap/knE-page-* 全族通过。过程两处测试自身错（选择器
误传全串、无效表达式行）提交前已清，产品零改动。
```
未测如实：带登录会话真实分页屏（游标翻页走 mock 信封 nextCursor=c2 代证）；
stale/游标过期路径未重复（主测 E 段已锁）。
边界：只新增本测试与本证据；显式路径 add；无 force/amend/--no-verify/git add -A；
未并 main、未重建 9122；单 commit「test(console): knowledge paging guards」。

# KNW5 追加 R132：两张文档表的行末复制（列表级 kn-row-copy*）（2026-11-20 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip `6e6ebf32`（预期 `76090480`
已更新，如实记录；知识面 delta 空）。merge `db945fc5` 与 feature 同链推送。

## 挂载互斥实测与 testid 落法

```text
DocumentNameSearch（内含 SearchDocTable）在 forced===null 时恒挂页顶（KnowledgeModulePage.tsx
:3605），与 SpaceDetailSurface（:3667，space= 态）同屏共存——实测确认（详情 URL 下两族按钮
同屏各在场，测试 ② 断言）。故按派工冲突方案：主 tab 检索表持原名 kn-row-copy-<i>/
kn-row-copy-status/kn-row-copy-fallback；空间详情表加后缀 kn-row-copy-space-<i>/
-space-status/-space-fallback。两表各一具共享状态条（每行按钮共用，报最近一次动作）。
```

## 实现口径

```text
文本唯一来源 docSingleCopy（与 R114 预览/命中展开 kn-doc-copy 同串）；行末 <th>操作</th>
+ RowCopyButton（原生 button[type=button]），i 随当前排序/筛选后的可见行序（entries=shown
派生序），详情预览行 colSpan 4→5。空行（名与标识都没给）disabled + 逐字 title。
状态条 role="status" aria-live="polite"：成功「已复制」、拒写「剪贴板没接受：文本在下方，
可手动选取。」+ 只读 textarea（value 逐字同目标串）。零请求路径：复制/拒写/排序切换均不触
fetch（测试快照逐字不变）。kn-doc-copy* 与 DocLineCopy 一律未动。
用例三条：①两表行复制 == 同文档 kn-doc-copy 文本逐字 toBe（检索行==命中展开、详情行==
行内预览），骨架「文档名 | 类型 | 大小 | 更新 | 短码」+ 单行 + 尾换行；②updated 三态两拍：
asc 首行 B、kn-row-copy-space-0 复制行 startsWith("B 表.xlsx")，回 desc 首行 A、0 号文本
跟到 A——编号不钉死文档；同屏双族 id 不撞；③拒写 fallback 逐字+只读+role/aria-live、
两表空行 disabled+逐字 title、全程 fetch 计数与 urls() 快照逐字不变。
过程记录：测试初稿两处自错（updated 默认 desc 两击回原态误期望翻序→改两拍断言；
querySelectorAll 属性选择器不窄化类型致 tsc 2 错→显式 cast），产品零改动。
```

## 验证尾行（R132）
```text
$ npx vitest run src/modules/knowledge   → 7 files / 101 tests passed（基线 98 + 3）
$ npx vitest run                         → 196 files / 2543 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r132-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort/kn-gates/kn-doc-copy*/kn-doc-preview/
kn-space-preview/kn3-page-cap/knE-page-*/kn-type 全族通过（列新增未动既有单元格断言）。
```
未测如实：带登录会话真实屏；键盘 roving 是否把新按钮计入行序链（未显式改 roving，按原生
tab 序在场）。
边界：只改 web/src/modules/knowledge/**（页面两表+控件、测试追加）与本证据；显式路径 add；
无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「feat(console): knowledge row copy in lists」（父 = merge `db945fc5`）。

# KNW5 追加 R138：空态与清筛选出口护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `6e6ebf32`
（Already up to date，R132 链上）。零产品文件改动。

## 复用边界（先 grep 后写）

```text
主测 knN 段（KnowledgeModulePage.test.tsx:3395-3449）已锁：space-docs 404 的
unavailable 态/rid/knF-copy disabled/knF-lines「—」/返回出口；kn-gates 段已锁六面
marker data-enabled/data-reason 与在场句；R76/R108/R131 已锁 doc-search no-match 句、
cap 三态不渲染与三值。派工两名实不符照录：kn-list-copy 不存在（详情=knF-copy、
检索面=knG-copy）；导出族不存在，仅 data-export="absent"（:1297/:1630/:2630 +
copyGates NO_EXPORT），本单只复证缺席不新增控件。
本文件新增：①无匹配空态的「无裸 0 计数」全文正则 + data-knn-empty 属性 + 检索面
cap 不渲染（按实结构，不搬句）；②knF-copy 四态 disabled 的完整禁用句逐字锁 +
「点击不进剪贴板、fetch 零增量」行为面 + 真实 0 行与读口故障句区分 + gate absent 复证；
③清空出口恢复后 kn-row-copy-<i> 数量==可见行==knG-copy 数据行（R132 新控件的行数
同源首锁，编号 0 起断言）；④ghost space 深链两路（200 空/404）：地址字节不变、
kn-space-preview*/kn-doc-preview*/kn-row-copy-space* 全 0、cap 不渲染、复制锁死。
```

## 关键读数

```text
②四态 title 逐字：error=「这次没有读到文档列表，没有可复制的内容。」；
  unwired≡denied=「文档列表没读到（读口未接入或没有权限），没有可复制的内容。」；
  ready-0 行=「接口回答里没有文档：这份列表是空的。不编行，也就没有可复制的清单。」
  （zeroTitle 句，经 disabled+空态句在场复证）；三态 disabled 点击 writeText 0 调用、
  fetch 计数不动。
①doc-search no-match：句含「没有匹配的文档」「2 条」「不代表全库没有」语境在场，
  全文无 /0\s*(条|个|篇)/；清空出口在场。
③清空后 visible=2 == kn-row-copy 按钮数 2 == knG 复制数据行 2（首钮 testid kn-row-copy-0）。
④两路 loc 逐字 "?tab=spaces&panel=spaces&space=sp_ghost"；预览/行复制/上限句全不渲染；
  SPACES 读取全程 ≤2（每路 render 一次，深链不额外多发）。
过程记录：测试自身两处错（q() 误传全选择器、②初猜「当前不可复制」前缀与实句不符——
  用必败断言逼出三态真值后逐字锁），产品零改动。
```

## 验证尾行（R138）
```text
$ npx vitest run src/modules/knowledge   → 8 files / 105 tests passed（基线 101 + 护栏 4）
$ npx vitest run                         → 197 files / 2547 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r138-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort/kn-gates/kn-doc-copy*/kn-row-copy*/
kn3-page-cap/knE-page-* 全族通过。
```
未测如实：带登录会话真实空态屏（ghost space 真实读口返回形状未知——mock 只出 200 空与
404 两态，均地址不改写、族不渲染）；ready-0 行态 knF-copy 的完整禁用句未在断言中逐字锁
（该态走 zeroTitle 分支，断言以 disabled+空态句+点击零写代证）。
边界：只新增 web/src/modules/knowledge/knowledge.empty.test.tsx 与本证据；显式路径 add；
无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge empty state guards」。

# KNW5 追加 R142：空间详情列表复制三值同源护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `862154eb`
（代码代次 `18ec9cfb` 链；知识面 delta 空）。零产品文件改动。

## 名实核对（派工三处按 grep 现状落，未造控件未改文案）

```text
①导出族不存在：data-export="absent" 全页标记（KnowledgeModulePage.tsx:1297/:1630/
  :2630/:3032）+ copyGates NO_EXPORT——「导出」以清单复制 knF-copy 为代表（④位点复证）。
②kn-doc-copy*（DocLineCopy）只挂行内预览与检索展开块（R114 落点），本面逐行复制是
  R132 kn-row-copy-space-<i>——三值按「可见行 == 行钮 == knF 数据行」断言，
  预览对照落为「kn-doc-copy 文本 == 同行钮文本 逐字 toBe」（单行对照，非计数）。
③本面筛选两维真实存在：kn-type-*（?ktype=）+ kn3-docs-filter-input（本地名筛，非 URL），
  均零请求（口径 R118/R54 已锁，本单只补三值同步）。
复用不重写：R108/R131 已锁 cap 三值与合并态三值——本文件不重跑其场景，只在
「筛选降数、清空复原、预览同行」三个新位点补断言；R138 已锁四态禁用句——本文件 ④
只复证 error 句逐字与「点击零写零请求」的 disabled 行为面在 ghost/ktype 非法组合位点。
```

## 关键读数

```text
①基础态（P/Q/R 三行）：visible 3 == 钮 3 == knF 数据行 3，钮 testid 逐字
  [space-0, space-1, space-2]（i 连续 0..N-1）；Q 行预览 kn-doc-copy 文本 ==
  kn-row-copy-space-1 文本 toBe 逐字等，且清单 lines[2] == 单行第二行。
②类型桶只看 PDF：三值同步降（<3 且互等）；回全部复原 [3,3,3]；名筛「Q 表」
  [1,1,1] 且清单行含 Q 表.xlsx；清空复原 [3,3,3]、编号重新 0 起；全程 urls 计数不动。
③缺项行（d_r）单行逐字「R 缺项 | — | — | — | DR」（缺值三列「—」、短码同源），
  清单同体逐字等；假时钟钉 2031-03-04 渲染整屏无 "2031"（本机时钟零参与复证，
  updatedText 口径 R75/R76 已锁、此处为行钮+清单双位点）。
④真 0 行与 500 失败：knF-copy disabled、error 态 title 逐字「这次没有读到文档列表，
  没有可复制的内容。」；两态点击 writeText 0 调用、urls 计数不变；无行=无钮
  （spaceBtns 0，不渲染伪造行钮）；ktype=__nope__：kn-type-empty 在场 + 零行零钮；
  ghost space（200 空）：loc 逐字不改写、零行零钮、cap 不渲染。
```

## 验证尾行（R142）
```text
$ npx vitest run src/modules/knowledge   → 9 files / 109 tests passed（基线 105 + 护栏 4）
$ npx vitest run                         → 207 files / 2616 tests passed（+10 文件为 merge
  wave 他模块内容，全绿非退化）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r142-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort/kn-gates/kn-doc-copy*/kn-row-copy*/
kn-space-preview/kn-type/kn3-page-cap/knE-page-* 全族通过。
```
未测如实：带登录会话真实屏；ready-0 行态 knF-copy 的完整禁用句（R138 口径，本文件断言
disabled+行为面不重锁句文本）；类型桶序若上游改名/换序，②以「三值互等+降数」为锁、
桶标签位点用 kn-type-1 现序（自纠注释在场）。
边界：只新增 web/src/modules/knowledge/knowledge.space.export.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge space export parity guards」。

# KNW5 追加 R146：类型筛选同源护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `862154eb`
（代次 `18ec9cfb`，Already up to date）。零产品文件改动。

## 名实核对（派工两处按 grep 现状落）

```text
· ?source= 无控件：实测参数集 KnowledgeModulePage.tsx:3345（q）/:3353-3354
  （ksort/kdir→sort/dir 兜底）/:3359（ktype→type 兜底）/:3468-3476（写只写 ktype、
  清除双删）——①映射为「ktype×type 双键共存」+「ktype×q 同屏共存回填」。
· kn-list-copy 不存在（清单复制实名 knF-copy/knG-copy/knI-copy/knL-copy-meta）；
  导出族仅 data-export="absent"——④映射为「可见行数 == knF-copy 数据行数」。
```

## 覆盖判定（先 grep 后写，②③已锁不重写）

```text
②改 ktype 只写该键+其余不动+游标复位：R118 ②（knowledge.filters.test.tsx:159-186
  has("type")=false、q/ksort/kdir/space/tab/panel 逐字、末页标记消失、data-len 回 1）
  + R131 ①（knowledge.paging.test.tsx 第 2 页行按标识出局、旧 cursor 零重放）→ 已覆盖。
③非法 ktype/type：R118 ④（:203-215 两路 loc 逐字不改 + kn-type-empty 点名原值 +
  kn-type-all/kn-type-clear 在场）→ 已覆盖。
真缺口（本文件 2 例）：双键共存生效序 + 清除动线真删双键（R118 只查 clear 在场）；
重挂的第二轮增量请求集合逐字 + 重挂路径上 可见行==knF 数据行（R118 ③只锁 loc/pressed/
data-len，未对请求集合；R142 三值只测首轮）。
```

## 新增读数

```text
①?ktype=PDF&type=表格 双键：PDF 桶 pressed=true、表格桶 false（旧键被忽略）；
  loc 逐字 "?tab=spaces&panel=spaces&space=sp_x&q=%E4%BA%BA%E4%BA%8B&ktype=PDF&
  type=%E8%A1%A8%E6%A0%BC"（不改写、不提升、不偷删）；点「全部」→ has(ktype)=false 且
  has(type)=false（双删动线），q/space/tab/panel 在场逐字不动；清除零新请求
  （urls 集合仍为 spaces|documents|documents?spaceId 三条）；ktype=表格×q=人事 共存：
  桶按下 + kn6-search-input value「人事」各回各的。
④重挂同 URL：第二轮增量请求集合与第一轮 toBe 逐字相等（各 URL×1，非翻倍误报——
  断言取 slice(cMid) 增量，过程初稿误比累计当场自纠）；data-len/可见行复原；
  ktype=PDF 态下 可见 1 == knF 数据行 1（两轮同值）。
```

## 验证尾行（R146）
```text
$ npx vitest run src/modules/knowledge   → 10 files / 111 tests passed（基线 109 + 2）
$ npx vitest run                         → 208 files / 2618 tests passed
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r146-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn-row-copy*/kn-doc-copy*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort/kn-gates/
kn-space-preview/knE-page-*/kn3-page-cap/kn-type 全族通过。
```
未测如实：带登录会话真实屏（ktype/type 双键真实深链形态未知——上游不会造双键，本护栏
锁的是前端读取序 ktype 优先的确定性）；②③按判定未重跑。
边界：只新增 web/src/modules/knowledge/knowledge.type.filter.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge type filter guards」。

# KNW5 追加 R149：预览与列表两条链的请求契约护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `c37e6d49`
（wave-36 并入）。零产品文件改动。

## 查重判定（先 git grep 后写，锁过的不重写）

```text
已覆盖（贴行）：
· ①首屏恰 1 次 documents?…spaceId 且不带 cursor —— 主测 knE 段
  KnowledgeModulePage.test.tsx:2531「第一页绝不带 cursor：还是那一次 documentsUrl 读取」；
· ②cursor 原值 URL 与「翻页恰 1 次」——主测 :2510/:2554（P2URL 字面 cursor=c2、
  filter 后 urls===1）；行追加非替换——主测 B 段 rowCount 2→3；
· ③行内预览开/关列表快照 toEqual、抽屉打开 +1（R49 详情读）/开着零追加/关闭零增量/
  同文档开关不叠加——knowledge.parity.test.tsx:176-207（R125 C 段）已逐档锁。
真缺口（本文件 2 例补）：
· ②跨页「部分重叠」的 id 去重并回（loadMore seen/fresh：主测 E 段只锁整页重复落 stale，
  正常部分重叠零 pin）+ 去重后 行数==cap-M==data-len==knF 数据行 的三元相等；
  末页 disabled 点击零请求（R131② 只锁 disabled 态与文案，未锁点击行为面）；
· ④抽屉 doc=a↔doc=b 跨文档切换（R125 只测同文档开关）：列表集合逐字不变、
  两文档详情读各恰 1 次且 URL 指向自身、行数不动、关闭零增量。
```

## 关键读数

```text
②翻页增量恰 ["…limit=50&spaceId=sp_x&cursor=pg2"]（上一页 nextCursor 原值逐字）；
  page2 [d_b 重叠, d_c 新] → 3 行、B 表单份；cap 句逐字「本页最多显示 50 篇
  （当前已加载 3 篇；复制清单也只含这些篇）」（50 为常量位）、data-len "3"、
  knF 数据行 3——四读互等；末页 more disabled=true，点击 urls 计数不动。
④开 A：urls 增量恰 ["/agent-api/api/documents/d_a"]；切 B：增量恰 ["…/d_b"]、
  d_a 读计数保持 1（不重发）、行数 2 不变、列表三 URL 集合逐字等；关抽屉零增量。
四处名实映射照派工落：cap 的 N=50 常量位/M 可变位；抽屉链非零（+1 详情读为 R49
既有设计，行内预览链 0）；翻页控件全族 knE-page-*；cursor 只从请求 URL 断言（不落
URL 参数，R118 已锁）。
```

## 验证尾行（R149）
```text
$ npx vitest run src/modules/knowledge   → 11 files / 113 tests passed（基线 111 + 2）
$ npx vitest run                         → 216 files / 2666 passed | 7 failed
  ⚠️ 7 失败全在 audit.filters.test.tsx(4)+runs.filters.test.tsx(3)——两文件由本次并入的
  上游 wave（代次 `5c28f5d3` 等）自带，audit 单跑独立复现失败；与本单零耦合（本单写域
  仅 knowledge 一个测试文件 + 证据，audit 不 import knowledge）。按纪律如实记录、不追
  非本域修复。knowledge 域 11/113 全绿。
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning；本单曾有
  1 条 unused(urlsSnapshot) error 提交前清零）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r149-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn6*/kn-row-copy*/kn-doc-copy*/knB/knD/knF/knG/knI/knL/kn-sort/kn-gates/
kn-space-preview/knE-page-*/kn3-page-cap/kn-type 全族通过。
```
未测如实：带登录会话真实翻页屏（重叠页/末页以 mock 信封代证）；抽屉链真实 200 详情信封
（本夹具详情 404 未接入态——读次数与 URL 指向的契约与信封形状无关）。
边界：只新增 web/src/modules/knowledge/knowledge.requests.test.tsx 与本证据；显式路径 add；
无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge request contract guards」。

# KNW5 追加 R152：空间详情分页护栏补缺（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `c37e6d49`
（Already up to date）。零产品文件改动。

## 查重判定（五例逐条：引用 vs 新写）

```text
已锁引用（不重写）：
①追加后四读互等+跨页重叠去重 —— knowledge.requests.test.tsx ②（R149）；
②筛选切换不带旧 cursor+行替换 —— knowledge.paging.test.tsx ①（R131「C 说明」标识出局、
  cursor= 全程恰 1）+ knowledge.filters.test.tsx ②（R118）；
③末页 disabled+文案 —— 主测 knE 段 :2540-2541 + R131②:135-137；cap 计数互等 R131②；
④第 2 页 500 保旧行/rid/重试恰一次 —— R131③ + 主测 F 段（:2612-2667）。
⑤合并态复制三值 —— R131④（copy 行==rowCount==data-len==cap M）。
真缺口（本文件 2 例新写）：
· ③补：knE-page-more 的 title 句两态——末页态「信封给了游标字段且下一页为空：这就是末页。」
  与无游标态「上游回答没给分页游标：有多少页无法判断，不猜、也不谎称末页。」
  此前只在产品侧 KnowledgeModulePage.tsx:2588-2594，测试 grep 零命中；
· ⑤补：合并态 kn-row-copy-space-<i> 钮数入等式链且 i 连续 0..M-1（R142① 的 [0,1,2]
  是同页三行夹具，翻页合并态零 pin）；附「筛到 1 行只剩 0 号」的钮面替换复证。
名实替换照派工：cap N=50 常量位/M 可变位（本文件不重锁，R149/R131 已锁）；?source=
无控件（ktype/本地名筛替身，均在已锁范围）；详情面钮实名 kn-row-copy-space-<i>；
导出族仅 data-export="absent"（R138/R142 已锁缺席），未造任何控件。
```

## 验证尾行（R152）
```text
$ npx vitest run src/modules/knowledge   → 12 files / 115 tests passed（基线 113 + 2）
$ npx vitest run                         → 217 files：2668 passed + 7 failed——
  失败恰为已知上游域 audit.filters(4)/runs.filters(3)（数量与 R149 时点一致，非本域、
  无新增），按派工如实记录不追。
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r152-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn-row-copy*/kn-doc-copy*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort/kn-gates/
kn-space-preview/knE-page-*/kn3-page-cap/kn-type 全族通过。
请求口径：态 A 翻页增量恰 1（P2URL）、两态全程 P2URL 共 1 次；态 B 零翻页请求；
⑤合并/筛选全程无新增读口调用以外的请求。
```
未测如实：带登录会话真实分页屏（游标/末页/无游标三信封以 mock 代证；「下一页为空」的
真末页形态未实测上游）；title 句两态之外的第三态（loading「正在加载…」态 title）未锁
（主测 B/D 段已锁该态文案，title 非本轮四项范围）。
边界：只新增 web/src/modules/knowledge/knowledge.space.paging.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge space paging guards」。

# KNW5 追加 R157：空间详情 搜索×类型 组合护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `c37e6d49`
（Already up to date）。零产品文件改动。

## 名实冲突清单（按实测落，产品未动）

```text
①「输入搜索词 → 请求带关键词」不成立：本模块两个读口都不吃 q
  （DOCUMENTS_URL 头注：实测 ?q/?query 无差；列表面自述「键入不会再请求一次」）。
  实锁：URL q 只收敛命中面（本地过滤）；详情表的「搜索」是组件本地名筛框
  （kn3-docs-filter-input，不落 URL、重挂不复现——如实记录为设计现状）；键入/提交
  全程零 fetch 增量、任何请求无 cursor=。
② 类型键实名 ktype（typeKey = sp.get("ktype") ?? sp.get("type") :3486；清除双删
  :3479-3480）。实锁：清 q 后 ktype 逐字在场、清 ktype 后 q 已清也不复活、零请求。
③ 非法枚举两路不改写+kn-type-empty：R118 ④ 已锁 → 引用；本单补该态
  **kn3-page-cap 不渲染**（派工写「cap 仍在」——实测筛空走空态分支 cap 缺席，与
  R108 空集三态一致，属名实不符第二处，断言真实行为）。
④ cap 句 N=50 为常量位、M 可变位；「可复制行数」= knF-copy 数据行（kn-doc-copy 是
  单个控件非行数）。四读互等按 ktype×本地名筛组合态锁。
⑤「切空间后搜索与类型全部重置」与实测不符：spaceLink :3402-3406 / backLink
  :3598-3603 keepBase 只删 space/doc——q/ktype 全程逐字保留（列表→详情→返回→另一
  空间整链复证）；唯一重置是 SpaceDetailSurface 组件本地名筛框（:2143-2150
  setFilter("")）。按真实行为断言，未改产品。
```

## 查重判定与新增读数

```text
引用不重写：①本地零请求+q 收敛=data-len —— R118 ①⑤；② 共存回填 —— R146 ①尾段；
③ loc 逐字/空态/锚 —— R118 ④；④ 重挂增量逐字 —— R146 ④；翻页/合并态三值 —— R131/R149。
新写（knowledge.space.filters.test.tsx 3 例）：
· ② 互不清除动线：q 提交空词 → has(q)=false、ktype 仍 PDF；再点「全部」→
  has(ktype)=has(type)=false；urls 计数全程不变。
· ⑤ 全链：列表(q=空间,ktype=PDF)→进 sp_x（q/ktype 随下钻保留、详情 2 行=PDF 桶）
  →本地名筛「人事」→1 行→返回（q/ktype 在场、列表两空间行都在）→进 sp_y
  （q/ktype 逐字仍 空间/PDF；本地筛框 value 回空——组件重置；可见 1 行=A）；
  增量请求无 cursor=、docs(sp_y) 恰 1。
· ③④ 组合：ktype=PDF 详情 2 行 → 本地名筛「人事」1 行；四读互等 1==cap-M==data-len
  ==knF 行（cap 句逐字含「本页最多显示 50 篇（当前已加载 1 篇；复制清单也只含这些篇）」）；
  同 URL 下命中面独立 data-len "2"（q=人事 命中 A、B——面间口径分开）；重挂增量集合
  逐字相等且 ktype 复现、本地筛不复现（visible 回 2）；ktype/type=__nope__ 两路：
  loc 保留原值、kn-type-empty 在场、cap null、0 行。
```

## 验证尾行（R157）
```text
$ npx vitest run src/modules/knowledge   → 13 files / 118 tests passed（基线 115 + 3）
$ npx vitest run                         → 218 files：7 failed 全为已知上游
  audit.filters×4 / runs.filters×3（与 R149/R152 时点一致，非本域，记录不追）；
  其余全绿（passed 2671）。
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错（过程中 1 条 clickNode 参数
  null 收窄 error 提交前清零）
$ npx vite build --outDir /tmp/knw-r157-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn-row-copy*/kn-doc-copy*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort/kn-gates/
kn-space-preview/knE-page-*/kn3-page-cap/kn-type 全族通过。
请求口径：本地筛选/清空/提交全程零增量；切空间链新增仅各面既有读取（documents(sp_y) 恰 1、
无 cursor= 请求）；重挂第二轮增量集合逐字等于第一轮。
```
未测如实：带登录会话真实屏（q 不吃服务端过滤为既有实测口径，引用 R118/读口注释）；
sdoc/doc 参数在 ⑤ 链上的存留未单独断（spaceSelfLink 删 sdoc 由 R67 互斥族已锁）。
边界：只新增 web/src/modules/knowledge/knowledge.space.filters.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge space filter combination guards」。

# KNW5 追加 R164：类型筛选×分页交叉护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `d6dac47f`
（代次 `1bc3a760`）。merge 带 knowledge 面视觉改动（Surface 空/错态铺 knw5-skeleton
占位条，page +12 / css +7，设计车道 ④）——非本单所写，先复跑基线 **13/118 全绿**
确认零破再开工。本单自身零产品文件改动。

## 名实替换（三处照派工+grep 落）

```text
①?source= 无控件（source 仅空间行「来源」列标签）→ 映射为「ktype×q（+ksort/kdir）同存
  地址时，documents 请求参集合恰 {limit, spaceId}」——本地过滤不入线的正锁
  （R157 只反锁过「无 cursor=」，此为参集合维度新锁）。
③非法 ktype/type 下 kn3-page-cap 不渲染 —— R157（knowledge.space.filters.test.tsx
  ③④ 尾段：loc 保原值+kn-type-empty+cap null+0 行）已锁 → 引用；派工「cap 如实」
  名实不符按产品现状（cap 属非空 ready 态，见本单 ② 终态回归断言）。
④三值实名：详情面钮 kn-row-copy-space-<i>（检索面才是 kn-row-copy-<i>）、可变位 M、
  50 常量位、导出仅 data-export="absent" —— R142/R152 已锁 → 引用。
```

## 查重判定（引用 vs 新写）

```text
已覆盖引用：候选 A「第 2 页后切类型桶→归 1 页/无旧 cursor/行替换」——空间详情面已锁：
  knowledge.paging.test.tsx:115-125（R131①）+ knowledge.space.paging.test.tsx ⑤（R152
  合并态钮面）；单键清除动线——R146 ①（ktype 双删）、R157 ②（清 q 保 ktype）。
真缺口新写（knowledge.type.source.test.tsx 2 例）：
· ① 四筛选键同存地址时 spaceId 读参集合逐字 == {limit, spaceId}（两轮：初始 +
  切桶/改词提交后），全程 fetch 计数不变；
· ② 「一路清全部」组合终态：清 q → 清 ktype → 排序两击回默认后，URL 只剩
  "?tab=spaces&panel=spaces&space=sp_x"（ktype/q/type/ksort/kdir/cursor 六键零残留）
  且行回全量 3、默认序首行 A、cap 句回归在场（对照 ③ 空态不渲染的另一半）。
```

## 验证尾行（R164）
```text
$ npx vitest run src/modules/knowledge   → 14 files / 120 tests passed（基线 118 + 2）
$ npx vitest run                         → 229 files：2746 passed + 4 failed——
  4 红全为已知上游 audit.filters×4（非本域，记录不追）；此前已知的 runs.filters×3
  已由本次并入的上游 wave 修绿（较 R157 时点 -3 红，非本单所致）。
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r164-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
  （上游新加的 skeleton 占位条 aria-hidden，宽度约束由上游 css 自带，375 实测不溢）。
零破：kn3*/kn-row-copy*/kn-doc-copy*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort/kn-gates/
kn-space-preview/knE-page-*/kn3-page-cap/kn-type 全族通过。
请求口径：①②全程本地清线零 fetch 增量（①断言 c0 前后相等 + 参集合两轮逐字）。
```
未测如实：带登录会话真实屏；排序清除态在 legacy ?sort/dir 键下的双轨行为（R66 注释
「两套键互不清除」已锁读侧，写侧清除只删 ksort/kdir——本单终态断言 ksort/kdir 无残留，
未构造 legacy sort 在场的清线组合）。
边界：只新增 web/src/modules/knowledge/knowledge.type.source.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge type source cross guards」。

# KNW5 追加 R167：复制控件的键盘与焦点护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `d6dac47f`
（Already up to date）。零产品文件改动。

## 查重与名实

```text
已锁引用：文本同串/值逐字（R114/R132/R142）、计数契约（R125C/R149）、三值与编号
  （R131/R142/R152/R157/R164）——本文件不重跑。四例全是新维度：原生标签、按键不双触发、
  播报器唯一性、fallback 可聚焦、disabled 出列。
两族实名按实测：检索面 kn-row-copy-<i>/-status/-fallback，详情面带 -space- 后缀
  （R132 同屏冲突方案）——brief 只写前者，本文件两面都测。
kn-doc-copy 为单控件（行预览/命中展开），不是行级——已按实落。
```

## 实测缺口（只记不改）

```text
G1 kn-doc-copy-status：有 aria-live="polite"、无 role="status"（KnowledgeModulePage.tsx
   :1980 <span>）；而列表面 useRowCopyBar 的 <p> 两属性齐——同为播报器两套属性。
   测试以 toBeNull 锁定现状，修复时该断言会红提醒同步。
G2 行钮是原生 <button type="button">（type 已断言）；kn-doc-copy 走 UI 库 Button，
   type 属性未断言（渲染归库，只记录）。
G3 Enter/Space：原生 BUTTON 按键激活为 UA 行为，jsdom 不合成 keydown→click——
   按 R102 同口径代证：三控件 tagName 全 BUTTON + keydown(Enter/空格) 各 dispatch
   一次后 writeText 零调用（无第二套按键通路、不双触发）+ click 恰一次生效。
G4 行复制钮未纳入 roving tab 序（R132/R138 自述）＝原生 tab 流；disabled 出列由
   UA 原生保证，以 disabled=true 属性代证（tabIndex 数值不变，不断言 -1）。
```

## 四例读数

```text
① 三控件全 BUTTON、disabled=false、tabIndex≥0；行钮 type="button" 逐字；
  聚焦后 Enter/空格 keydown 各一发 writeText 0 调用；click 三次（检索面/详情面/预览）
  writeText 1→2→3 恰一次/击；全程 urls 计数不变。
② 每面复制播报器 querySelectorAll 计数恒 1；详情面 status role=status+aria-live=polite、
  初始空文本；点检索面后其 status=「已复制」而详情面保持空（不跨面重复播报）；
  再点详情面本面「已复制」。G1 断言在场。
③ 三族 fallback 全 TEXTAREA、readOnly=true、tabIndex≥0、value 与 writeText 投递串
  toBe 逐字等（reject 路径，逐面一次点击各自出兜底）。
④ 检索面第 3 钮（EMPTY 行）与详情面 space-1：disabled=true、title 逐字
  「这一行没有可复制的文档内容：文档名与标识都没给出。」；点击 writeText 恒 0。
```

## 验证尾行（R167）
```text
$ npx vitest run src/modules/knowledge   → 15 files / 124 tests passed（基线 120 + 4）
$ npx vitest run                         → 230 files：2750 passed + 4 failed
  （4 红仍全为已知上游 audit.filters×4，非本域记录不追）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r167-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort/kn-gates/kn-doc-copy*/kn-row-copy*/
kn-space-preview/kn3-page-cap/knE-page-*/kn-type 全族通过。
```
未测如实：真实浏览器键盘激活 Enter/Space→click 合成（UA 行为，jsdom 以 BUTTON 在场
+ 无第二通路代证，同 R102 口径）；tab 焦点顺序全链路（roving 未含行钮为已记 G4）。
边界：只新增 web/src/modules/knowledge/knowledge.copy.a11y.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge copy keyboard and focus guards」。

# KNW5 追加 R169：两处列表计数同源护栏 + 检索面行钮跨组重号真缺陷修复（2026-11-20 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `d6dac47f`
（Already up to date）、基线复跑 15/124 绿后开工。

## 名实映射（先 grep 贴行）

```text
· 导出族不存在：data-export="absent"（KnowledgeModulePage.tsx:1297/:1630/:2630/:3032）
  + copyGates NO_EXPORT——「导出数据行数」映射为列表复制器数据行：检索面 knG-copy、
  详情面 knF-copy；未造导出控件。
· 检索面计数锚 = kn9-count-docs（HitCount :2964，模板 :818）+ kn6-search data-len；
  详情面 = kn3-page-cap（50 常量位/M 可变位）。行钮两族实名 kn-row-copy-<i> /
  kn-row-copy-space-<i>；kn-doc-copy 单控件不当行数。
· 两读口不吃 q、类型键 ktype——筛选本地零请求（引用 R118/R157/R164）。
```

## 查重判定

```text
引用不重写：详情面自身四值（R142 ①②、R149 ②、R152 ⑤、R164 ①）；q→data-len 收敛
与零请求（R118 ①/R157）；详情面空/error knF 行为面（R138 ②）；非法 ktype cap 不渲染
（R157）。新写 ①②③④：检索面四值首锁、两面同夹具子集互比、q 收敛时两面计数一动一静、
检索面「筛后真 0」vs「读口失败」两态行为面（knG disabled/零写/零请求——kn-gates 只锁过
marker，knG 行为面此前仅 1 pin）。
```

## 真缺陷与修复（派工条款：测出同单修，改前/改后）

```text
缺陷：SearchDocTable 按空间分组渲染（每组一实例，:3006-3040），R132 的行钮编号
  index={index} 用组内下标——多组同屏时 testid 跨组重号（实测：人事空间[A,B] +
  运维空间[C] → [kn-row-copy-0, kn-row-copy-1, kn-row-copy-0]），违反 testid 唯一性
  与 R132 交付语义「i 按当前排序/筛选后的可见行序 0 起」。roving tabindex 同场景
  早已用全局偏移（tabIndexFor(start + index)）——行钮漏了同一偏移。
改前：<RowCopyButton doc={row} index={index} .../>（组内起 0）
改后：props 增 indexBase（调用点传分组起点 start，与 roving 同源），
      <RowCopyButton doc={row} index={indexBase + index} .../> → 全局可见行序连续
      0..M-1 无重号；折叠组不占号（visibleBefore 只在展开时前进，与 roving 完全同规则）。
影响面：单组场景 indexBase=0 行为不变——既有全部行钮断言（R132/R142/R157/R164/R167）
  零改动通过（修复后 128/128 即证）。改动仅 SearchDocTable props/一行编号/一个调用点，
  未触其它语义。
```

## 四例读数

```text
①检索面四值：count 句含「当前已加载 3 项，全部列出」== 行 3 == 钮 [0,1,2]（修复后
  跨组连续）== knG 数据行 3 == data-len "3"。
②同夹具互比：详情面（sp_x 子集）四值 2、cap「当前已加载 2 篇」< 检索面 3（子集如实
  更小）；首列文本跨面逐字同（knF/knG 行第 1 列 arrayContaining）——整行不同串属
  R71 记录的唯一列差异（knG 多「所属空间」），不判违规。
③q=手册：检索面 count「命中 2 项」/行 2/钮 [0,1]/knG 行 2/data-len "2" 五处同步降；
  详情面 cap 与行数逐字不动（URL q 不牵动详情表——R157 语义的计数位复证）；零请求。
④筛后真 0：count「命中 0 项」、行/钮 0、kn6-search-empty「没有匹配的文档」句、
  knG-copy disabled（句含「没有可复制」）+ 点击零写零请求；读口失败：行/钮 0、
  knG-copy disabled、零写。两态与详情面 R138 同族口径，文案不同路（空≠失败）。
```

## 验证尾行（R169）
```text
$ npx vitest run src/modules/knowledge   → 16 files / 128 tests passed（基线 124 + 4）
$ npx vitest run                         → 231 files：2754 passed + 4 failed
  （仍全为已知上游 audit.filters×4，非本域记录不追）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r169-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort/kn-gates/kn-doc-copy*/kn-row-copy*/
kn-space-preview/kn3-page-cap/knE-page-*/kn-type 全族通过（含修复前的全部行钮 pin）。
```
未测如实：带登录会话真实分组数据（多空间命中分组以 mock 代证）；组折叠后编号重排的
深场景（折叠钮本身 R-group 族有 pin，本轮只锁展开态连续性与 roving 同规则推断折叠不占号）。
边界：改 web/src/modules/knowledge/{KnowledgeModulePage.tsx（SearchDocTable 三处：props
类型/解构+注释/编号行/调用点）, knowledge.counts.parity.test.tsx（新增）} 与本证据；
真缺陷修复属派工允许条款，其余零产品改动；显式路径 add；无 force/amend/--no-verify/
git add -A；未并 main、未重建 9122；单 commit「test(console): knowledge counts parity guards」。

# KNW5 追加 R172：知识排序同源护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `d6dac47f`
（Already up to date）。零产品文件改动（本轮无真缺陷：R169 已修的跨组重号未复现）。

## 名实核对与「哪些面真有排序」

```text
· SortableHead（kn-sort-<col>，:1796/:1821）只挂空间详情面：DocTable 活动头 :2045-2048
  与 DocHeadStrip 非 ready 禁用头 :1861-1864。检索命中面/全局文档面同为 SearchDocTable
  （thead 固定列，测试实证 kn6-search-table 内 kn-sort 计数 0）——「四处同源」按实降级：
  详情面锁三值行序逐行、命中面锁「行序==knG 复制行」+不受详情排序牵动，无排序控件
  为事实缺口记录（未造控件）。
· 「导出」族不存在：data-export="absent"（:1297/:1630/:2630/:3032）+ copyGates NO_EXPORT
  → 行序同源第三值映射为列表复制器数据行（knF-copy/knG-copy，皆走 R71 docLine 单点）。
· ?source= 非筛选参数；排序纯本地（口径句 :2693「文档读口实测不接受 sort/order/orderBy」）
  ——②腿断言请求集合逐字不变而非「请求带排序参数」。
```

## 查重判定

```text
引用不重写：主测 kn-sort 段 :2194-2270 已锁三态 URL/aria-sort/等键稳定/缺值垫底两向/
  粘链复现/复制首末行==表体/整循环零请求（R58/R67 与排序代次交付）；
  派工②（ktype×q×ksort×kdir 组合下请求参集合恰 {limit,spaceId} 且零增量）——
  knowledge.type.source.test.tsx ①（R164）已整腿锁 → 引用。
新写（knowledge.sort.parity.test.tsx 2 例）：①三档（name asc/desc/清除 + size + updated）
  每一步「行名序列 == knF 复制数据行第 1 列」逐行 toEqual（主测只锁首末行，全序列此前
  零 pin）；④全程 kn3-page-cap 文案逐字不变（排序×「已加载 M」正交无 pin）+ 请求快照
  逐字；②命中面无排序事实下的行序==knG 行逐行一致 + 详情排序动作不染命中面（独立派生
  反证：详情首行已换「中册.xlsx」而 hit 序列原样）。
```

## 验证尾行（R172）
```text
$ npx vitest run src/modules/knowledge   → 17 files / 130 tests passed（基线 128 + 2）
$ npx vitest run                         → 232 files：2756 passed + 4 failed
  （仍全为已知上游 audit.filters×4，非本域记录不追）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r172-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn-sort-*/kn-row-copy*/kn-doc-copy*/kn3*/导出标记（absent 在场）/kn3-page-cap/
knE-page-*/kn6–kn9 全族通过。缺值行（d_n 全缺）在六步逐行对账中恒末、未上浮。
请求口径：①六步循环 fetch 计数与 urls() 排序快照逐字不变；②详情排序两次点击命中面
  零变化零新请求（②腿请求侧结论引 R164①）。
```
未测如实：带登录会话真实数据屏（排序为本地派生，夹具三行覆盖缺值/等键维度）；
DocHeadStrip 禁用头排序按钮点击行为（禁用态 marker 已在 kn-gates 族锁）。
边界：只新增 web/src/modules/knowledge/knowledge.sort.parity.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge sort parity guards」。

# KNW5 追加 R176：空间详情内筛选护栏（追加于 R157 文件）（2026-11-20 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `072f023d`
（知识面 delta 空）。零产品文件改动。本轮不新建文件——派工点明目标文件已存在
（R157 的 knowledge.space.filters.test.tsx），新用例**追加**入该文件第四例。

## 五腿对照（引用 vs 新写）

```text
①ktype 深链回填+旧 type 兜底+请求参逐字无 cursor —— 已锁：knowledge.filters.test.tsx ①
  （R118 :142-152 桶 pressed/旧键兜底/docReq 的 spaceId toBe URL 值）+ R164 ①（参集合
  恰 {limit,spaceId}）→ 引用。
②本地零请求/归 1 页 —— R118 ⑤/R131 ①已锁；**新写缺口**：详情面切类型桶/本地名筛开合
  时命中面 kn6-search data-len 逐字不动（R172②只锁过排序切换，桶/名筛不串面零 pin）。
③非法枚举：loc 逐字不改+kn-type-empty+**cap 缺席**（名实不符 #2 按产品断言）——
  R157 ③④ 尾段两路（含 0 行）+R118 ④（锚在场）已锁 → 引用。
④重挂请求集合逐字+行数逐字同 —— R157 ③④（slice 增量 toBe）+R146 ④ 已锁 → 引用。
⑤清全部五键零残留+行回归 —— R164 ② 已锁；**新写拼接缺口**：动线终态的四值互等
  （data-len == knF 数据行 == 行钮数且 testid [0..M-1] 连续 == cap 句 M）——
  R142① 只锁未筛初始态、R164② 未对四值，动线走到终态后的连锁此前零 pin。
```

## 新例读数（R157 文件第四例）

```text
q=空间 态下：hit data-len 基线在场；切「全部」→回「PDF 桶(kn-type-1)」→本地名筛「手册」
开合——四个动作全程 kn6-search data-len 逐字不动、fetch 计数不变（c0）；
回「全部」终态：钮 testid 序列 == [space-0, space-1]（连续）、count == 可见行 2
（ktype 已清但夹具详情面 [A,B,C] 中……终态 rows=3 时 [0,1,2]——实例以 rows 动态生成）
== data-len == knF 数据行 == cap「当前已加载 {rows} 篇」四读互等、cap 在场。
```

## 验证尾行（R176）
```text
$ npx vitest run src/modules/knowledge   → 17 files / 131 tests passed（基线 130 + 1）
$ npx vitest run                         → 239 files / 2800 tests passed 全绿——
  已知上游 audit.filters×4 红已由本次并入的 wave 修绿（非本域修复，如实记录状态变化）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r176-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn-row-copy*/kn-doc-copy*/kn-sort*/kn-type*/导出标记/kn3-page-cap/knE-page-*/
kn6–kn9/knB/knD/knF/knG/knI/knL/kn-space-preview 全族通过（R157 原三例复跑同绿）。
过程记录：测试初稿把「回 PDF 桶」写成 kn-type-0——「全部」占 kn-type-all、人话首桶是
  1 号（产品编号规则既有），当场自纠，非产品缺陷。
```
未测如实：带登录会话真实屏；⑤「清 q/清排序后」的完整动线终态四值（R164② 已锁键位、
本例锁的是类型桶回退路径的四值，两条动线互补不重复）。
边界：只改 web/src/modules/knowledge/knowledge.space.filters.test.tsx（追加一 it）与
本证据；显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；
单 commit「test(console): knowledge space filter guards」。

# KNW5 追加 R179：知识排序持久化与深链护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做（HEAD 即 R176 `3e45dd7d` 链上）、显式 refspec fetch 后 merge
实测 tip `072f023d`（Already up to date，知识面 delta 空）。零产品文件改动（无真缺陷）。

## 查重判定（五处引用 / 三处新写）

```text
已锁引用：
· ①旧键深链复现——主测 kn-sort 段 :2265-2268（sort=size&dir=asc 直进同序不多发）；
· 请求参集合恰 {limit,spaceId}——R164 ①（knowledge.type.source.test.tsx）；
· 切 ktype 不动 ksort/kdir——R118 ②；清排序动线五键零残留——R164 ②；
· ③重挂增量集合逐字——R146 ④ + R157 ③④；三值 data-len==knF 行==钮数 [0..M-1]——
  R142 ① + R152 ⑤；cap 50 常量位——R108/R149 → ③整腿全覆盖不重写。
新写（knowledge.sort.persist.test.tsx 2 例）：
· ①规范键 ksort/kdir 深链的 aria-sort 回填（主测只测过 legacy 键的回填）+
  行序按 size/desc + 全程请求无 cursor；
· ②排序点击的写侧键集合：只动 ksort/kdir、脏 URL 下 q/ktype/space/tab/panel 逐字、
  legacy sort/dir 不得被新写（R66「写只写 ksort」语义此前无独立 pin）；
· ④非法排序枚举三查询——零 pin。实测回落语义（knowledge.ts docSortCol/docSortDir
  :1722-1735 各键独立回落）：ksort 非法→列回默认 updated/desc；dir 非法→同回默认；
  ksort=size&kdir 非法→列生效 size/desc（首行变大部头）——地址三种查询均逐字不改写、
  不进空态/错误面（cap 在场）、回落后交互不卡死（点新列正常 asc）。
```

## 关键读数

```text
①深链 ?ksort=size&kdir=desc：th[aria-sort]=size→descending（aria-sort 挂 th，按钮带
  testid——主测同法 closest）、行序逐字 [大部头.pdf, 中册.xlsx, 小抄.pdf]、
  docs 读参 keys==[limit,spaceId]、无 cursor=。
②点 name 列后：ksort=name、kdir=asc（落点向）、q=大/ktype=表格/space=sp_x/tab/panel
  逐字、has(sort)=has(dir)=false。
④回落：?ksort=__nope__ 与 ?dir=__nope__ 首行「中册.xlsx」（updated/desc）、
  ?ksort=size&kdir=__nope__ 首行「大部头.pdf」（size 列保留/desc 回落）；三态 loc
  均逐字含原非法值；收尾点 name → ksort=name&kdir=asc。
```

## 验证尾行（R179）
```text
$ npx vitest run src/modules/knowledge   → 18 files / 133 tests passed（基线 131 + 2）
$ npx vitest run                         → 240 files / 2802 tests passed 全绿
  （上游 audit.filters 红在 `072f023d` wave 已修绿，本轮无已知红需要豁免）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning；本单曾有
  1 条 unused(u0) error 提交前清零）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r179-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn-sort-*/kn-row-copy*/kn-doc-copy*/kn3*/kn3-page-cap/knE-page-*/kn6–kn9/knB/knD/
knF/knG/knI/knL/kn-type*/kn-space-preview/导出标记（absent 在场）全族通过。
过程记录：测试初稿三处自错（aria-sort 误读 button 应 closest("th")、非法查询前缀误用
  "?"成双问号、④第三态误设列也回落——实测列独立回落），均按产品真实行为修正期望，
  产品零改动。
```
未测如实：带登录会话真实屏；legacy `?sort=` 非法列值（?sort=__nope__）单态（与
ksort 非法同 helper 同路径，读侧兜底代码共用，未重复铺例）；排序 × 分页合并态
（归 1 页已由 R118②/R131① 锁）。
边界：只新增 web/src/modules/knowledge/knowledge.sort.persist.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge sort persistence guards」。

# KNW5 追加 R183：文档抽屉错误态护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做（HEAD 即 R179 链）、显式 refspec fetch 后 merge 实测 tip
即预期 `c1b6ca7d`（wave-38+39，知识面 delta 空）。零产品文件改动（无真缺陷）。

## 查重判定

```text
已锁引用：主测 :263-298——抽屉 error 锚在场、error≠unwired 互斥、
  「请求编号：rid-detail-busy/denied」上屏、403≡404 body 逐字同（同体=反枚举设计）、
  抽屉内零 form/textarea/input、裸 id 不上屏、ready 态 field-source/status 值；
  R125C/R149——打开 +1 详情读、关 0、跨文档各 1。
真缺口（本文件 3 例）：①错误态下列表两行与 kn3-page-cap 不卸载 + 屏面禁裸
  「404/500」数字与「undefined」+②空态锚（knN-empty-text-space-docs）不在场——
  错误不冒充空结果；③重试的**计数与过渡**（主测只锁 retry 按钮在场）：恰 +1 且
  新增仅 DETAIL_A、失败→成功错误锚消失 + field-source 落值 + 列表全程未卸载；
  ④错误态并行内预览可用（名实不符记录，见下）。
```

## 名实记录（按实测，未迁就派工）

```text
· 「不存在/已过期」不可区分：产品无文档「已过期」语义（grep「过期」只命中空间凭据
  lastError 文案），403≡404≡404-not-found 同走 unwired 句「文档详情未接入」——
  如实记缺口，未造文案。
· 第④腿：brief 写「kn-doc-copy 错误态 disabled + title」——实测该控件挂在**列表层
  行内预览**（与详情读口无关），抽屉错误态下在场且 disabled=false、点击复制成功
  「A 手册.pdf | PDF…」、零新请求；断言真实行为并记差异。「详情复制」控件不存在，
  抽屉层唯一复制件=kn-doc-permalink 固定链接。
· 预览/抽屉互斥（R67）实测复证：开 kn-doc-preview-toggle 会静默收起抽屉——④例把
  抽屉面板断言安排在开预览之前（首跑放后面吃了 undefined 断言，属测试时序自纠）。
```

## 验证尾行（R183）
```text
$ npx vitest run src/modules/knowledge   → 19 files / 136 tests passed（基线 133 + 3）
$ npx vitest run                         → 243 files / 2812 tests passed 全绿
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r183-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-doc-copy*/kn-row-copy*/kn3-page-cap/
knE-page-*/kn-type*/kn-sort-*/kn-space-preview/kn-doc-preview/导出标记（absent 在场）全族。
请求口径：①②路 render 各按既有读取集；③重试整段增量恰 [DETAIL_A]×1（spaces/列表读
零连带）；④复制全程 fetch 计数不动。
```
未测如实：带登录会话真实 404/403 屏（同体断言以 mock 信封代证，与主测 :280-289 同法）；
rid 的剪贴板复制交互（RequestId 组件自带复制件由既有族锁，本文件只锁「请求编号：」上屏）。
边界：只新增 web/src/modules/knowledge/knowledge.detail.error.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge detail error guards」。

# KNW5 追加 R187：空间详情错误态护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做（HEAD 即 R183 链）、显式 refspec fetch 后 merge 实测 tip
即预期 `53310d04`（知识面 delta 空）。零产品文件改动（无真缺陷）。

## 名实对齐（实测，不迁就派工）

```text
· `kn-space-page-cap` 不存在（git grep 零命中）——实名 `kn3-page-cap`（50 常量位、
  M 可变位），③按实名断言。
· 403≡404 同体：主测 :861-873 已锁 body 逐字同；且 SPACE_DOC_UNWIRED_HEAD 实测句
  「空间不存在或未授权」（knowledge.ts:75）——产品把「不存在/无权限/过期」合并为
  同一反枚举句，这是设计而非缺陷：①逐字锁该句并注记。
· ④「kn-space-preview/kn-doc-copy disabled」名实不符：错误态零行、无从 disabled——
  实测这些锚 **0 渲染**（kn-space-preview 族本就是列表面的，详情面 R70 已证零）；
  断言数量 0 并记录。knF-copy disabled+逐字 title 由 R138 ② 锁 → 只对照在场性。
· 导出族不存在：④复证 gate data-export="absent"。
```

## 查重判定

```text
引用不重写：主测 :855-895（unwired/error 锚在场、403≡404、error↔unwired 互斥、
  retry 按钮在场、裸 id 不上屏）；R138 ②（三态 knF disabled+逐字句+零写）；
  R138 ④（ghost 深链预览/行钮零渲染）；R164 ①（参集合 {limit,spaceId}）。
真缺口（本文件 3 例）：①500 路逐字句「这次没能读到知识数据」+message 透传+rid、
  两路禁裸 (404|500) 与 undefined/null 上屏、命中面/面板不卸载；②+④错误态双空态锚
  （kn3-docs-empty、knN-empty-text-space-docs）互斥缺席 + 预览/doc-copy/行钮/preview-toggle
  全 0 渲染 + gate absent 复证；③Surface 重试计数与过渡：urls 整段 +1 且新增恰
  docs(sp_x)、SPACES 不重发、错误锚消失、四读互等 3==cap-M==data-len==行钮数。
```

## 验证尾行（R187）
```text
$ npx vitest run src/modules/knowledge   → 20 files / 139 tests passed（基线 136 + 3）
$ npx vitest run                         → 245 files / 2817 tests passed 全绿
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r187-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort/kn-gates/kn-doc-copy*/kn-row-copy*/
kn3-page-cap/knE-page-*/kn-type*/kn-space-preview/kn-doc-preview/导出标记 全族通过。
请求口径：①②每路 render 按既有读取集（含命中面 DOCUMENTS_PLAIN 一次）；③重试增量
恰 1 且 URL 逐字为 docs(sp_x)——spaces 读全程 1 次不连带。
过程记录：初稿把 unwired 句猜成「文档列表读口未接入」，实测为「空间不存在或未授权」
  ——失败信息打印真值后按产品修正期望（该合并句正是反枚举语义的体现），产品零改动。
```
未测如实：带登录会话真实 403/404 屏（同体句以 mock 代证，与主测 :861-873 同法）；
登录态（login 分支）空间详情侧未铺（列表面 login 族已有既有断言，本轮四腿不含）；
rid 复制件点击交互（「请求编号：」上屏已锁，复制行为属 RequestId 既有族）。
边界：只新增 web/src/modules/knowledge/knowledge.space.error.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge space error guards」。

# KNW5 追加 R190：导出 CSV 转义与列序护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做（HEAD 即 R187 链）、显式 refspec fetch 后 merge 实测 tip
即预期 `394caf35`（wave-41 窗口，知识面 delta 空）。零产品文件改动、**未造任何控件**。

## CSV 缺席复核（跑前 git grep 计数）

```text
createObjectURL=0、text/csv=0、download==0（本模块）；data-export="absent" 现 4 处；
knowledge.ts:1452 的 csv 仅是文档类型标签「表格（CSV）」。按 R142 先例「导出」腿
映射真实表样产物 knF-copy（详情）/knG-copy（检索），①另把缺席锁成源码级不变量。
```

## 四腿读数与查重

```text
① 源码级：page/core/copyGates 三文件文本均无 createObjectURL/text/csv/download=/new Blob
  （readFileSync 走 process.cwd()，注释已注明 import.meta.url 在 vitest 非 file-URL）；
  gate data-export="absent" 在场。怪名『报,告"表\n第二行.pdf』经 kn-row-copy-space-0
  投递：toContain(原名整串)✓、无 '""' 引号翻倍✓、未截断✓；**换行照原样入行**的
  后果事实一并锁（split("\n") 长度 4）——将来若加转义，护栏先红逼对齐口径。
② 表头实测逐字（去排序箭头字形）：详情面 [文档名,类型,大小,更新,操作]；
  DOC_LINE_HEADER 逐字 [文档名,类型,大小,更新,短码]；knF 复制表头 === join(" | ")；
  检索面屏上 [文档名,所属空间,类型,大小,更新,操作] 且 knG 复制表头第 2 位固定
  「所属空间」（R71 唯一列差异的列序侧收口）。
③ 缺项行：屏上 type/size/updated 三格逐字「—」，同钮复制行逐字
  「缺项档 | — | — | — | DM」；整串无 undefined/null、无空字段（无 " |  | "）。
④ 空集：knF-copy disabled + title 含「没有可复制」（全句 R138 逐字锁过 → 引用）、
  点击 writeText 0 调用、urls 计数不变；检索面 knG-copy 同口径 disabled + 零写零增；
  createObjectURL spy 四腿全程 0 调用（每腿末复查 + ④收口）。
查重引用：R114/R132/R142（复制同源/拒写 fallback）、R125（跨面同值含缺值句）、
R149/R164（请求契约/参集合）、R152/R157/R169（三值/四读互等）、R167（键盘焦点）、
R183/R187（空≠错锚互斥）。新维度=源码缺席不变量、原字符转义事实、列序逐字对账、
blob-URL 零调用。过程两处测试自纠（gate 断言需置于 render 后、表头含箭头字形），
一处初版断言设想错误（以为竖线首段可锚名字前缀——换行先断物理行），改为锁后果事实。
```

## 验证尾行（R190）
```text
$ npx vitest run src/modules/knowledge   → 21 files / 143 tests passed（基线 139 + 4）
$ npx vitest run                         → 252 files / 2845 tests passed 全绿（无豁免项）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r190-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn6*/kn-row-copy*/kn-doc-copy*/kn-space-*/kn-type*/kn-sort*/kn-gates*/
kn3-page-cap/knE-page-*/导出标记 全族通过。
```
未测如实：带登录会话真实屏（怪名以 mock 投递文本代证，无真实含换行的 fileName 样本）；
「若产品将来真加 CSV」的正向转义行为（本护栏只锁现状与缺席，不预测未来实现）。
边界：只新增 web/src/modules/knowledge/knowledge.export.escape.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge export csv escaping guards」。

# KNW5 追加 R196：预览请求契约余量护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做（HEAD 即 R190 链）、显式 refspec fetch 后 merge 实测 tip
即预期 `cecbd1f1`（知识面 delta 空）。零产品文件改动（无新缺陷可修——R149/R125C/
R183/R187 的既有断言全绿，未暴露真缺陷）。

## 分面查重（brief 对齐 #1/#2/#3/#5 的引用行号）

```text
①首屏恰 1 次 spaceId 读、无 cursor= —— 主测 knE 段 :2531 已锁 → 引用。
②分面陈述：行内预览 kn-doc-preview-* 与检索展开 kn6-search-detail = **0 请求**
  （knowledge.requests.test.tsx ③ R149 快照逐字 + R125B）；遮罩抽屉 kn7-preview-*
  （?doc=）= 打开**恰 +1** 详情读、开着零追加、关闭零增量、重开不叠加
  （knowledge.parity.test.tsx:180-199 R125C）——绝不把行内报成 +1。
③doc=a↔b 列表集合逐字不变 + 详情各 1 —— knowledge.requests.test.tsx ④:149-166
  （R149）已锁 → 引用；抽屉标题跟随 = 真缺口，新写。
④关闭零请求已锁（R125C/R149）；「开关一轮后行序与 kn-row-copy-space id 序列
  原样」= 真缺口（indexBase 全局序在交互间稳定的消费侧），新写。
⑤失败路径（可读句+rid+重试恰 +1 且指向本文档 URL）—— knowledge.detail.error.test.tsx ③
  （R183）已锁 → 引用。
```

## 新写两例读数（knowledge.preview.requests.test.tsx）

```text
③开 A：kn7-preview-title 逐字「A 手册.pdf」（标题源=row?.name，非 id）；切 B：
  逐字变「B 表.xlsx」；detailUrl("d_a")/("d_b") 各恰 1 次。
④行内开 A→关→开 B→关 全轮：urls() 排序快照与开前逐字相等（零新请求、全程无
  cursor=、无详情读）、kn3-docs-name 行序数组开前=开后、行钮 testid 序列
  [space-0, space-1] 前后逐字等；且行内预览全程 kn7-preview-title 为 null
  （行内面不冒充抽屉标题——分面口径）。
```

## 验证尾行（R196）
```text
$ npx vitest run src/modules/knowledge   → 22 files / 145 tests passed（基线 143 + 2）
$ npx vitest run                         → 255 files / 2857 tests passed 全绿（无豁免项）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r196-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn-doc-preview*/kn-space-preview*/kn3*/kn-row-copy*/kn-doc-copy*/kn6-search-detail*/
kn7-preview-*/kn3-page-cap/knE-page-* 与既有 21 套知识面全绿。
请求口径：本轮两例全程增量仅 render 期既有读取（③每文档详情 +1 为 R49 既有设计）；
④整轮零新增（快照逐字）。
```
未测如实：带登录会话真实屏（详情 200 真实信封未接——与 R183/R187 同法 mock 代证）；
「预览内切换」若指行内预览在两行间的直接互切（产品为单开互斥、点击另一行 toggle 即换）
已由 ④ 的开合两轮覆盖同族路径。
边界：只新增 web/src/modules/knowledge/knowledge.preview.requests.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge preview request guards」。

# KNW5 追加 R197：分页后计数与复制同源护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做（HEAD 即 R196 链）、显式 refspec fetch 后 merge 实测 tip
即预期 `1768f36c`（知识面 delta 空）。零产品文件改动（无新缺陷）。

## 名实对齐（分面陈述）

```text
· 分页面=空间详情文档列表：逐行钮用 `-space-` 族（R132）；检索/全局面实测 knE-page-*
  计数 0（本文件末腿锁「该面不分页」并出示其行钮族为 kn-row-copy-<i>）。
· 「导出数据行数」不存在 → knF-copy 数据行代位（R142/R190 先例）；「kn-more」不存在
  → 实测 knE-page-more/-count/-end/-error/-retry；cursor 只在组件态（R118）——断言
  全走点击控件 + 读请求 URL。kn3-page-cap 50 常量位 / M 可变位。
```

## 查重判定（引用 vs 新写）

```text
引用不重写：R131①（paging:115-125 第 2 页后切桶归 1：计数文本/标识出局/无旧 cursor）、
  R131②（:128-146 末页 cap-M==count 互等 + disabled+「已到末页」——腿③整腿已锁）、
  R131③（:150-163 保行/rid/重试整段增量恰 1）、R152③（两态 title）、R152⑤（合并态
  钮链）、R149②（重叠去重四读）、R169（跨组不重号）、R132（排序重编）。
真缺口（本文件 4 例）：①翻页后**同屏五读全链**（knE-page-count 句 + 行==data-len==
  钮数==cap-M==knF 数据行，且复制行序与屏上行名逐行同序——R149 四读未与 count 文本
  同框、R131④ 未含钮链）；②筛选复位后三值对新集**重算**（R131① 只锁行数与文本，
  未锁 data-len/钮/cap-M 同步；回「全部」后 cap-M=2 证明复位回第一页集）；
  ④错误窗口内四读**保持不塌**（R131③ 只锁行数+rid——本例补 [2,2,"2","2"] 窗口期
  快照与成功后 [3,3,"3","3"] 跃迁）；末腿检索面不分页映射锁。
```

## 关键读数

```text
①翻页后：count 逐字「已显示 3 篇 · 总数不可用」（无 total 不推算）；行 3==data-len "3"
  ==钮 3==cap-M "3"；钮 id [space-0, space-1, space-2] 跨页连续；knF 第 1 列逐行==行名。
②切「表格」桶：四读全为 1（含 cap-M——复位不只看行数）、钮 [space-0]、knF 行 1；
  回「全部」：[2,2,"2","2"]（游标回指 p2，第三行未残留）。
④500 窗口：error 锚+「请求编号：rid-r197-500」、四读 [2,2,"2","2"] 不冒充第三行；
  重试增量恰 1、error null、四读跃迁 [3,3,"3","3]、钮链三连。
```

## 验证尾行（R197）
```text
$ npx vitest run src/modules/knowledge   → 23 files / 149 tests passed（基线 145 + 4）
$ npx vitest run                         → 256 files / 2861 tests passed 全绿（无豁免项）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r197-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/kn-space-preview*/
kn3-page-cap/knE-page-*/kn6-search-*/knF/knG/knI/knL-copy* 与既有 22 套全绿。
请求口径：①②翻页各按其真实 1 次读取；④重试 +1 恰一次；筛选/复制零增量（快照逐字）。
过程记录：末腿初版沿用空 DOCUMENTS_PLAIN 致「行钮>0」自错，补该面数据后过——非产品缺陷。
```
未测如实：带登录会话真实分页屏（重叠页/末页信封 mock 代证）；「共 N 篇」有 total 信封
下的 count 联动（主测 B 段 :2556-2563 已锁该文本，本轮夹具走无 total 分支）。
边界：只新增 web/src/modules/knowledge/knowledge.counts.paging.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge counts after paging guards」。

# KNW5 追加 R200：导出列与屏上列同源 + 三值护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做（HEAD 即 R197 链）、显式 refspec fetch 后 merge 实测 tip
即预期 `eae57b6c`（wave-43，知识面 delta 空）。零产品文件改动（无新缺陷）。

## 名实映射与查重（引用不重写）

```text
「导出 CSV」不存在（本文件跑前复核 createObjectURL/text/csv/download= 皆 0、
data-export="absent" 在场）→ 代位：详情面 knF-copy（5 列）/检索面 knG-copy（6 列含
所属空间第 2 位）；未造控件。已锁引用：R190②（两屏表头与两复制表头各自逐字、缺席
不变量、怪名、缺值行、空态 spy）、R142①②（详情三值+筛选联动）、R169①（检索面四值）、
R197①②④（翻页五读族）、R71（docLine 单点）、R75/R76（updatedText）、R125（跨面同值）、
R167/R168（键盘/编号）。④腿（空集 disabled+逐字 title+零写零请求+spy 0）R190④ 整腿
已锁 → 本轮只引用不复写。
真缺口（本文件 2 例）：①复制头↔屏上头**对账单**（差集恰 {复制独有:短码}/
{屏上独有:操作}，其余逐位同——两侧各自逐字 R190 已有，对照关系是新的）；
②**逐单元格** toBe（同文档每列复制文本==屏上同列显示文本，缺值「—」成对，短码/全 id
出现位置按实记录）。
```

## 关键读数

```text
①详情面：copy[0..3]==screen[0..3]（文档名/类型/大小/更新），copy[4]=「短码」而
  screen[4]=「操作」；检索面 copy[0..4]==screen[0..4]（含所属空间@1），copy[5]=「短码」、
  screen[5]=「操作」；两面 copy 长度==DOC_LINE_HEADER(+空间)=5/6。
②全项行逐格：「全项手册.pdf|PDF|2.4 MB|2026-11-19 15:10|DFULL1」五格与屏上同列 toBe 逐字；
  行正文无「FULL1」无「d_full1」、tr[title]="d_full1"（全 id 只在 title 的单元格级复证）。
  缺项行：type/size/updated 三格两侧同为「—」。
  检索面分两种产物各对各的（新记录的事实）：knG-copy 数据行 6 列——[0..4] 逐格 toBe 屏上
  name/space/type/size/updated；而行钮 kn-row-copy-<i> 是 5 列单行文本（docSingleCopy，
  **无所属空间列**）[0]=全项手册.pdf、[1]=PDF、[4]=DFULL1——初稿把 6 列期望套在行钮上
  当场失败（expected 'PDF' to be '测试空间'），按产品实际拆分两种对账，产品零改动。
```

## 验证尾行（R200）
```text
$ npx vitest run src/modules/knowledge   → 24 files / 151 tests passed（基线 149 + 2）
$ npx vitest run                         → 259 files / 2871 tests passed 全绿（无豁免项）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning；本单曾有
  1 条 unused(q) 提交前清零）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r200-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/kn-space-preview*/
kn3-page-cap/knE-page-*/kn6-search-*/knF/knG/knI/knL-copy* + 既有 23 套全绿。
createObjectURL spy 两例全程 0 调用（R190 之外的再复证）。请求口径：本轮全程本地
点击复制，fetch 快照无增长断言在 R190/R142 已锁、本文件未新增动作类型。
```
未测如实：带登录会话真实屏；④腿（空集 disabled/零写/spy）整腿引 R190④ 未在本文件重跑
——其夹具与断言完全同形，重写即违规。
边界：只新增 web/src/modules/knowledge/knowledge.export.columns.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge export column parity guards」。

# KNW5 追加 R204：文档详情字段四面同源护栏（纯测试单）（2026-11-20 BJT）

安全门：porcelain 空起做（HEAD 即 R200 链）、显式 refspec fetch 后 merge 实测 tip
即预期 `b9fb2cc4`（wave-44，知识面 delta 空）。零产品文件改动（无新缺陷）。

## 查重判定（引用 vs 新写）

```text
已锁引用：腿③=R196 knowledge.preview.requests.test.tsx（开恰 1 详情读、关 0、行序/钮 id
  原样、标题随换）+ R125C 快照；腿④=R183 knowledge.detail.error.test.tsx（404/500 可读句、
  「请求编号：rid-…」cap/列表不卸载、空态互斥、重试 +1）——两腿整腿已锁，只引用。
  DOM 侧两表/两预览/抽屉四字段=R70/R125；行钮==kn-doc-copy 同串=R114；复制列↔屏上格
  逐列=R200；缺值两式各自定版=R70/R125/R200。
真缺口（本文件 2 例）：①同一文档「列表格 × 抽屉 dd × 行钮文本 × kn-doc-copy 文本」
  四路接成**一条 toBe 链**（逐字段 + 短码列 + 全 id 仅在 title 的落点收口——此前
  各锁两两，六路从未同案对账）；②缺值行「两种句式」同案对账（表格/复制「—」 vs
  预览/抽屉「该字段未返回」+「<字段>：<原因>」逐字段 title）。
名实注记：R67 互斥使抽屉与行内预览不同屏——「四面同框」落实为同一用例内**顺序采集**
  四面读数再对账（文件头与本段双记录）；测得的面=空间详情（`-space-` 族），检索面
  行钮 `kn-row-copy-<i>` 不在本文件（R200 已锁其列集）。
```

## 关键读数

```text
①全项行样张逐字：字段五元组 ["全项手册.pdf","PDF","2.4 MB","2026-11-19 15:10","DFULL1"]；
  抽屉四 dd 与列表四格逐格 toBe；行钮文本首行==DOC_LINE_HEADER.join；kn-doc-copy 串
  ===行钮串（toBe 整串）；行正文无 d_full1 无 DFULL1；抽屉 dl title="d_full1"；
  body 无 undefined/null。
②缺项行：表格 type/size/updated 三格「—」==行钮 fields[1..3]；预览与抽屉 dd 逐字
  「该字段未返回」、title 逐字「类型：上游没有给出文档类型」「更新：上游没有给出更新时间」
  ——两式各自四面一致；body 无 undefined/null/d_miss9，全 id 只在 dl title。
```

## 验证尾行（R204）
```text
$ npx vitest run src/modules/knowledge   → 25 files / 153 tests passed（基线 151 + 2）
$ npx vitest run                         → 264 files / 2893 tests passed 全绿（无豁免项）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r204-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/kn-space-preview*/
kn3-page-cap/knE-page-*/kn6-search-*/knF/knG/knI/knL-copy*/kn7-preview-* + 既有 24 套全绿。
请求口径：两例的全程 = render 既有读取 + 抽屉每开 1 次详情读（R49 既有链）；复制/开关
列表面零新增（腿③引用 R196 计数锁，本文件未新增动作类型）。
```
未测如实：带登录会话真实屏（详情 200 真信封未接——mock 404 代证，抽屉 DOM 字段源为
已载行、与详情信封无关）；检索面六路（族不同，R200 已锁其列格）。
边界：只新增 web/src/modules/knowledge/knowledge.detail.parity.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge detail field parity guards」。

# KNW5 追加 R205：详情与预览跨面同值 —— evidence-only（四腿全覆盖，零新用例）（2026-11-20 BJT）

安全门：porcelain 空起做（HEAD 即 R204 链）、显式 refspec fetch 后 merge 实测 tip
即预期 `e901fabb`（知识面 delta 空；目标文件 knowledge.preview.parity.test.tsx 确认
不存在）。本轮**零产品文件改动、零测试用例新增**——四腿逐条 grep 对账后全部已有
单一断言锁死，按派工 dedupe 纪律（「已覆盖只引用 file:line，不重写；evidence-only
为合法交付」）不硬凑重复用例、不建空文件。

## 四腿判定书（引用行号 = 锁的所在）

```text
①同文档 名称/类型人话/大小/更新(updatedText)/短码 跨面逐字 toBe——
  R204 knowledge.detail.parity.test.tsx ①：列表四格==抽屉四 dd 逐格 toBe、
  行钮复制行五列==屏上四格+shortId、kn-doc-copy 串===行钮串（整串 toBe），
  样张 ["全项手册.pdf","PDF","2.4 MB","2026-11-19 15:10","DFULL1"] 逐字锁；
  R70/R125 kn.parity/knowledge.parity A：两表+两预览+抽屉 DOM 四字段链。三面 ⊂ 六面 → 引用。
②缺值同句 + 无 undefined/null/裸全 id——R204 ②：表格/复制「—」两式 == 预览/抽屉
  「该字段未返回」+逐字段 title（「类型：上游没有给出文档类型」逐字），body 正则禁
  undefined|null|d_miss9、全 id 仅在 dl[title]；主测 :216-219 抽屉不伪造正文
  （pending 句+field-status「—」+excerpt null）。
③开 +1 详情读/列表腿不重取/关 0/行序与钮 id 原样——R196 knowledge.preview.requests.test.tsx
  ③（标题随换、d_a/d_b 各恰 1）④（开合一轮 urls 快照逐字、行名数组与 [space-0,space-1]
  序列原样、行内面 kn7-preview-title null 分面）+ R125C knowledge.parity:176-207
  （afterOpen=base+[DETAIL_URL]、开着零追加、关 0、重开不叠加）。
④详情读失败（抽屉）：可读句+rid+重试恰 +1+列表/cap 不卸载+不伪造 body——
  R183 knowledge.detail.error.test.tsx：①句「这次没能读到这份文档的详情」+message 透传
  +「请求编号：rid-r183-busy」+禁裸 404/500/undefined+列表 2 行与 kn3-page-cap 在场；
  ③重试整段增量恰 [+DETAIL_URL_A]×1、SPACES 不连带、成功后错误锚 null、field-source
  落值、行全程未卸载；主测 :263-298：unwired≠error 互斥、403≡404 同体、抽屉零写控件、
  裸 id 不上屏。派工预言的「真缺口（抽屉失败重试计数）」实测已被 R183 ③ 覆盖。
```

## 面/族名实（复测同前轮）

```text
分页面行钮族 kn-row-copy-space-<i>（检索面 kn-row-copy-<i>）；kn-doc-copy=DocLineCopy
单控件（行内预览/命中展开，非行级）；抽屉 kn7-preview-*（?doc=）；列表/cap=
kn3-docs-*/kn3-page-cap；缺值两式为产品定版（表格「—」、预览/抽屉 previewField
「该字段未返回」+「<字段>：<原因>」），未改。
```

## 验证尾行（R205，evidence-only）
```text
$ npx vitest run src/modules/knowledge   → 25 files / 153 tests passed（基线不变——零新增判定）
$ npx vitest run                         → 269 files / 2916 tests passed 全绿（无豁免项）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r205-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/kn-space-preview*/
kn3-page-cap/knE-page-*/kn6-search-*/knF/knG/knI/knL-copy*/kn7-preview-* + 既有 25 套全绿。
```
若验收坚持「必须新增文件」，可执行的真实残差仅剩两处窄面（本轮按纪律不扩写，供下一轮
参考）：a) 抽屉 error 窗口内「行钮文本==开抽屉前快照」的复制串级不变量（行序/钮 id 已由
R196④ 锁，复制串未单锁）；b) 「详情 404 时抽屉 dl title 仍=全 id」的 404 变体（R204 只在
成功链锁过 title）。

# KNW5 追加 R206：预览请求契约余量护栏（纯测试单）（2026-11-21 BJT）

安全门：porcelain 空起做（HEAD 即 R205 链）、显式 refspec fetch 后 merge 实测 tip
即预期 `6d20d6f4`（知识面 delta 空；目标文件确认原不存在）。零产品文件改动（无新缺陷）。

## 四腿查重判定（引用 vs 新写）

```text
已锁引用：①首屏恰 1 次列表读、无 cursor=——主测 knE 段 :2531 + R149 requests.test.tsx
  ①②；②抽屉开 +1/列表腿不重取（R125C:180-188、R149④ listSet、R183③）、切文档每次 +1
  各指自身（R149④+R196③）、行内预览链 0（R125B/R149③/R196④）；③关闭零请求（R125C/
  R196④）与行序/钮 id 不变（R196④）；④500 句+rid+保列表+重试恰 +1+成功就位（R183①③）。
真缺口（本文件 2 例，均含 R205 判定书预留的两处窄面）：
· ③参数面：关抽屉后 loc **逐字回**到开前（仅 doc= 消失，q/ktype/space/tab/panel 一字
  未动）+ 行内预览开合全程 loc 一字不动（产品注释 R67/R68 声明的语义，测试侧首次落钉
  ——grep 此前无任何 loc 断言命中）。
· ④(a)：详情 500 错误窗口内，行钮复制串与 kn-doc-copy 串均与**干净样张逐字相等**
  （错误不污染屏上数据与 docSingleCopy 链）；④(b)：404 变体下抽屉 dl[title]="d_full1"
  （全 id 仅在 title）+ 抽屉正文无裸 id——R204 只锁过成功链的 title。
```

## 关键读数

```text
③开抽屉 loc 恰好多一段 "&doc=d_full1"；kn7-preview-close 后 loc toBe 开前逐字
  （"?tab=spaces&panel=spaces&space=sp_x&q=%E5%A4%A7&ktype=PDF"）；行内开→关两轮
  loc 始终逐字同；spaces/docs(sp_x) 读条数全程 = 开抽屉前（列表腿零重取）。
④干净样张：行钮串===kn-doc-copy 串（writeText 两次 toBe）；500 窗（error 锚在场）
  再取两串仍逐字等样张；404 窗 unwired 在场、dl title 逐字 "d_full1"、panel 正文
  无 "d_full1"。缺值/两式与 403≡404 产品定版未触。
```

## 验证尾行（R206）
```text
$ npx vitest run src/modules/knowledge   → 26 files / 155 tests passed（基线 153 + 2）
$ npx vitest run                         → 272 files / 2927 tests passed 全绿（无豁免项）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning；本单曾有
  1 条 unused(detailUrl) 提交前清零）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r206-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/kn-space-preview*/
kn3-page-cap/knE-page-*/kn6-search-*/knF/knG/knI/knL-copy*/kn7-preview-* + 既有 25 套全绿。
过程记录：测试自纠三处（ktype=PDF 桶外行不可见换 PDF 行、defineProperty 的 clipboard
  值需包 { writeText } 对象、babel 语法 configurable 挪进对象字面量），产品零触碰。
```
未测如实：带登录会话真实屏（窄面 (b) 的 404 真信封未接）；「重开抽屉 title 更新后再关」
的多轮 loc 往返（单轮开→关已逐字锁，多轮语义同路径）。
边界：只新增 web/src/modules/knowledge/knowledge.preview.requests2.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge preview request contract guards」。

# KNW5 追加 R207：导出 × 筛选叠加护栏（纯测试单）（2026-11-21 BJT）

安全门：porcelain 空起做（HEAD 即 R206 链）、显式 refspec fetch 后 merge 实测 tip
即预期 `77ca6458`（代次 `cdcffc02` 账本链；知识面 delta 空）。零产品文件改动（无新缺陷）。

## 名实映射与查重（引用不重写）

```text
· 无真 CSV（createObjectURL/text/csv/download= 全 0，R190 已锁不变量）→「导出」=
  knF-copy 数据行（详情面 5 列）；未造控件。
· 无 ?source= 控件 → 叠加键映射为 ?ktype=（旧 type 兜底）× 本地名筛 × ?q=；
  请求参集合恰 {limit,spaceId}（筛选不入线）——R164 ① 已锁 → 引用。
· ①三值计数随筛选降/复原 + ②首行换代 + 零请求 —— R142 ②（space.export.test.tsx
  :164-176）已锁 → 引用；④缺值两侧同「—」不串口径 —— R200 ② 已锁 → 引用；
  ⑤空集 disabled+title+零写+零请求+spy 0 —— R190 ④ 已锁 → 引用；「cap 仍在」名实不符
  ——产品定版空集/error/denied/非法枚举**不渲染**（R108/R157 已锁 null）→ 按产品引用，
  差异记录于此与回执。
真缺口（本文件 2 例）：(a) 叠加切换后复制内容**元素级换代**——knF 数据行第 1 列集合
  逐元素 toEqual 屏上行名集合 + 切换前旧行**零残留**（R142② 只锁计数与首行包含）+
  每步三值链与请求快照同步；(b) 旧 type 兜底键态的三值链（R146① 只锁桶回填，
  钮==行==复制行未走）。
```

## 关键读数

```text
(a) 步 1 ktype=PDF：行 [A 人事手册.pdf, C 运维手册.pdf] == 复制列逐元素等、钮 2；
  步 2 叠本地名筛「人事」：[A] 且复制串 not.toContain C 与 B（元素级残留验证）；
  步 3 切「表格」桶：[B] 且复制串无「人事手册」残留；终态三值 [1,1,1]；
  首屏后 urls 排序快照全程逐字不变（本地动作零请求）；createObjectURL spy 0。
(b) ?type=表格 兜底：按钮 aria-pressed=true（复证）、行 [B 人事表.xlsx]、
  钮 1==行 1==复制行 1、复制串含「B 人事表.xlsx | 表格」人话列、无 undefined/null；
  spy 0。
```

## 验证尾行（R207）
```text
$ npx vitest run src/modules/knowledge   → 27 files / 157 tests passed（基线 155 + 2）
$ npx vitest run                         → 274 files / 2934 tests passed 全绿（无豁免项）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning；本单曾有
  1 条 unused(q) 提交前清零）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r207-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn6–kn9/knB/knD/knF/knG/knI/knL-copy*/kn-sort*/kn-gates/kn-row-copy*/
kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/kn-space-preview*/kn3-page-cap/knE-page-*/
kn7-preview-* + 既有 26 套全绿。
过程记录：测试自纠两处（u0 误在 render 前取快照致空对非空、unused helper），产品零触碰。
```
未测如实：带登录会话真实屏（叠加换代以 mock 夹具代证）；检索面 knG-copy 的同类元素级
残留验证（R142/R169 已锁其计数与四值，元素级残留本轮只走详情面——同派生链，不重复铺）。
边界：只新增 web/src/modules/knowledge/knowledge.export.filter.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge export filter parity guards」。

# KNW5 追加 R208：行复制 × 筛选叠加护栏（纯测试单）（2026-11-21 BJT）

安全门：porcelain 空起做（HEAD 即 R207 链）、显式 refspec fetch 后 merge 实测 tip
即预期 `42180cd6`（知识面 delta 空）。零产品文件改动（无新缺陷）。

## 名实映射与查重（引用不重写）

```text
· 无 ?source= 控件（仅空间行「来源」列标签）→ 叠加键 = ?ktype=（旧 type 兜底
  :3359/:3479-3480）× 本地名筛 × ?q=；类型桶与名筛活在空间详情面 → 本文件锁的族 =
  `kn-row-copy-space-<i>`（检索面 kn-row-copy-<i> 不持这两类筛选，R207/R169 已锁该面）。
· 已锁引用：④空集/错误/ghost 行钮 0 —— knowledge.empty.test.tsx:213/:225 +
  knowledge.space.error.test.tsx:149；①id 连续 0..M-1 —— knowledge.space.filters.test.tsx
  :262-267（R176 动线终态）；排序重编 —— R132/R169；清单复制元素级换代 —— R207 (a)
  （export.filter.test.tsx）；单文档六路链 —— R204 ①；文本单点 —— R71/R75/R114。
真缺口（本文件 1 例，覆盖①②③的行钮级）：逐行文本链——每步筛选态下「按可见行序逐个
点钮，所得串第 1 列数组逐元素 toEqual 屏上行名」（R207 走清单、R204 只走一行，行钮级
全链此前零 pin）；②同一文档跨态（ktype=PDF → 清类型+名筛「人事」）首钮整串 toBe
自身且 == docSingleCopy(readSpaceDocuments(...)) 直出（字段不随筛选漂移）；③切「表格」
桶后首钮串 == 新集首行直出且 != 旧首行样张（换代缺席，行钮级）。
```

## 关键读数

```text
态 1 ktype=PDF：行 [A 人事手册.pdf, C 运维手册.pdf]；逐行链 [A…, C…] == 行名；
  钮 [space-0, space-1]；space-0 整串 === docSingleCopy(d_a) 直出。
态 2 清类型+名筛「人事」：行 [A, B 人事表.xlsx]；逐行链等；A 串 toBe 态 1 样张（零漂移）。
态 3 切「表格」：行 [B]；首钮串 === docSingleCopy(d_b) 且 != A 样张。
请求：首屏快照 u0 之后（3 次逐行点钮 + 清类型 + 键入 + 3 次点钮）urls() 排序快照逐字
  == u0——本地动作全程零 fetch 增量；首屏自身读取次数如实（多 surface 各 1，不锁数）。
```

## 验证尾行（R208）
```text
$ npx vitest run src/modules/knowledge   → 28 files / 158 tests passed（基线 157 + 1）
$ npx vitest run                         → 281 files / 2963 tests passed 全绿（无豁免项；
  较 R207 时点 +7 文件为 merge 带入的 wave 他模块内容，全绿非退化）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning；本单曾有
  unused(q) 与 urls 漏定义两次自纠，提交前清零）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r208-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn6–kn9/knB/knD/knF/knG/knI/knL-copy*/kn-sort*/kn-gates/kn-row-copy*/
kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/kn-space-preview*/kn3-page-cap/knE-page-*/
kn7-preview-*/kn-type* + 既有 27 套全绿。
```
未测如实：带登录会话真实屏；检索面行钮级逐行链（该面无此叠加筛选，族链 R200/R207 已锁
其列格与清单换代）；跨页签保持筛选再回切的多跳转链（单页态内三步已锁）。
边界：只新增 web/src/modules/knowledge/knowledge.rowcopy.filter.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge row copy filter parity guards」。

# KNW5 追加 R209：导出 × 行复制全行直对护栏（纯测试单）（2026-11-21 BJT）

安全门：porcelain 空起做（HEAD 即 R208 链）、显式 refspec fetch 后 merge 实测 tip
即预期 `916b943b`（知识面 delta 空；目标文件确认原不存在）。零产品文件改动（无新缺陷）。

## 名实映射与查重（引用不重写）

```text
· 无真 CSV（createObjectURL/text/csv/download= 0 命中、data-export="absent" 4 处，
  R190 不变量在位）→「导出」= knF 数据行；未造控件。
· 无 ?source= 控件 → 叠加键 = ?ktype= × 本地名筛 × ?q=；类型桶/名筛在空间详情面 →
  本文件测的族 = kn-row-copy-space-<i>（检索面 R207/R208 已锁其归属面，不复跑）。
· 派工 ③「导出空字段 vs 复制『—』」名实不成立：两产物同一实现（docLine），缺值两处
  都是「—」，无可分别观测的第二口径——按产品现状断言单一实现（全行级互等），差异
  记录于此与回执，未造数据未改产品。
已锁引用：R207(a)（knF col1 元素级换代+三值+快照）、R208（行钮级逐行链+零漂移==
docSingleCopy+换代缺席）、R200①②（表头差集+逐单元格）、R190③④（缺值两处逐字+空集
disabled/title/writeText 0/spy 0）、R142②（三值降数复原）、R169/R132（编号连续/重编）。
真缺口（本文件 1 例）：**两个产物之间的全行直对**——行钮 i 串的 data 行与 knF 数据行 i
整行 toBe（此前两产物各自只与屏上过，传递闭包从未直接落钉），覆盖首/中/末三行，
末行恰为缺值行（「—」全行级互等），叠加 ktype=PDF 态再走短链 + 当态三值。
```

## 关键读数

```text
三行 [A 手册.pdf, B 表.xlsx, M 缺项档]（updated/desc、缺时垫底）：
  i=0/1/2 行钮整行 toBe knF 行 i，且 col1 == 屏上第 i 行名（三点直接链）；
  末行两产物均逐字「M 缺项档 | — | — | — | DM」，无 undefined/null/空字段（\|\s+\| 零命中）。
叠加 ktype=PDF：[A 手册.pdf]，行钮 0 整行 == knF 行 0；三值 [1,1,1]。
首屏后 urls 排序快照逐字不变（含 8 次点钮复制与切桶）；createObjectURL spy 全程 0。
```

## 验证尾行（R209）
```text
$ npx vitest run src/modules/knowledge   → 29 files / 159 tests passed（基线 158 + 1）
$ npx vitest run                         → 286 files / 2976 tests passed 全绿（无豁免项；
  +5 文件为 merge 带入他模块 wave，非本域）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning；本单曾有
  1 条 unused(spaceBtn) 提交前清零）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r209-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn6–kn9/knB/knD/knF/knG/knI/knL-copy*/kn-sort*/kn-gates/kn-row-copy*/
kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/kn-space-preview*/kn3-page-cap/knE-page-*/
kn7-preview-*/kn-type* + 既有 28 套全绿。
```
未测如实：带登录会话真实屏；空态 disabled/title/spy 腿按派工引用 R190④（本轮仅在同一
用例内复跑 spy-0 与零请求两项，未重跑空集 disabled——避免重复断言）；检索面两产物直对
（该面 knG vs kn-row-copy-<i> 同理由 R207/R208 各自单边锁过，直对差异面同族，未铺）。
边界：只新增 web/src/modules/knowledge/knowledge.export.rows.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge export rows parity guards」。

# KNW5 追加 R210：双错误面隔离护栏（纯测试单）（2026-11-21 BJT）

安全门：porcelain 空起做（HEAD 即 R209 链）、显式 refspec fetch 后 merge **实测 tip
`cb790a3c` 比预期 `804ad319` 新（如实记录）**，merge 干净、知识面 delta 空。
零产品文件改动（无新缺陷）。

## 查重（引用不重写）

```text
①列表 500 面：句「这次没能读到知识数据」+rid、行/行钮/预览族渲染数 0（名实红线：
  是 0 渲染非 disabled——R187 space.error:149 等已按计数 0 锁）、knF-copy disabled+
  逐字 title+零写、错误↔空态互斥 —— R187 ①②④ + R183 ① + R138 已锁 → 引用；
②抽屉失败面：列表与 kn3-page-cap 不卸载（R183 ①）、错误窗内行钮/行内预览可用且
  复制串不漂移（R206 ④ + R183 ④）→ 引用；R190④（空态 spy/writeText）、
  R125C/R196（抽屉开 1 关 0）→ 引用。
真缺口（本文件 2 例 = 派工 ③④ 的隔离维度）：两面**同时**5xx 时两枚 rid 各自独立
  在场（列表锚 rid-L、抽屉锚 rid-D 互不覆盖）、rid 带可点击复制钮（实测 RequestId
  有 aria-label="复制请求编号" 的 button，非伪称）、恢复单面时另一面错误锚不被误清、
  各自重试的增量互不牵连（列表重试只 +1 spaceId 读、抽屉重试只 +1 详情读——R183③/
  R187③ 各只锁单面，互查对账此前零 pin）、双恢复后两锚同清。
```

## 关键读数

```text
④双败：两锚同屏；「请求编号：rid-r210-list」只在列表锚（其文本 not.toContain rid-D）、
  「请求编号：rid-r210-drawer」只在抽屉锚；点抽屉锚的复制钮 → writeText 恰收
  'rid-r210-drawer'；列表重试增量恰 [documents?limit=50&spaceId=sp_x]×1（详情零重发）、
  列表锚 null 而抽屉锚 standing、列表 2 行就位。
③先修抽屉：增量恰 [/api/documents/d_a]×1、抽屉 field-source 落「A 原件.pdf」、列表锚
  standing；再修列表：增量恰 [spaceId 读]×1，两锚同时 null、行 2。
名实补记：jsdom 无 isSecureContext 时 copyTextToClipboard 走 textarea 选抄 fallback
  ——测试补 window.isSecureContext=true 还原真实 https 控制台的主路径（环境旗标，
  非产品改动）。
```

## 验证尾行（R210）
```text
$ npx vitest run src/modules/knowledge   → 30 files / 161 tests passed（基线 159 + 2）
$ npx vitest run                         → 288 files / 2982 tests passed 全绿
  （首跑报 1 failed 为与 build/CDP 并行的偶发，单独复跑两次均全绿——如实记录）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning；本单曾有
  unused(url) 与 wireDead 参数两处自纠，提交前清零）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r210-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn6–kn9/knB/knD/knF/knG/knI/knL-copy*/kn-sort*/kn-gates/kn-row-copy*/
kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/kn-space-preview*/kn3-page-cap/knE-page-*/
kn7-preview-*/kn-type* + 既有 29 套全绿。
请求口径：每面重试严格 +1 且 URL 逐字指自身；两锚并存期间无任何自动重发。
```
未测如实：带登录会话真实双败屏；rid 复制钮的 fallback 选抄路径（jsdom execCommand 缺，
只测 https 主路径——两条路径的分派在 lib/clipboard，非本模块写域）；重试风暴（连点）
去重（moreState=loading 守卫在 knE 段另有 pin，本轮未铺双败连点）。
边界：只新增 web/src/modules/knowledge/knowledge.error.isolation.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge error isolation guards」。

# KNW5 追加 R211：错误隔离补充口径（②列表失败面交互实况）——同单增量第二笔（2026-11-21 BJT）

背景：R211 与 R210 为同一单的重发（章笔改标 `5f1b7428`）。R210 已在补充到达**前**完成并
推送（`b7a1c1c9`），按纪律禁 amend 已推提交，故补充口径以同文件增量用例、独立第二笔提交
承载——不是重复开工，只补真缺口。安全门：porcelain 空、merge 实测 tip 即补充所指
`5f1b7428`（知识面 delta 空）。零产品文件改动。

## 两处补充口径的判定

```text
④「rid 是否真有可点击复制钮」——实测：**有**（RequestId 组件自带
  button[aria-label="复制请求编号"]，lib/clipboard copyTextToClipboard 主路径）；
  R210 已按实断言点钮 → writeText 恰收该面 rid，无「伪称可复制」问题。jsdom 需补
  window.isSecureContext=true 还原 https 控制台主路径（否则走选抄 fallback——已在
  R210 证据记录）。
②「列表仍可排序/翻页」——正常态的「排序翻序 + urls 不变」由主测 kn-sort 段已锁
  （88cf5ce9 代次整循环零网络）→ 引用；**列表 500 面**的控件实况此前零 pin，为真缺口：
  实测排序表头 DocHeadStrip **在场但整排禁用**（error 分支 title 逐字「这次没有读到
  这份列表，现在不能排序。」），分页控件/行/行钮/预览 toggle **渲染数 0**
  （knE-page-* 在 rows>0 的 render 分支之外）——按补充口径断言「不可交互 + 渲染 0」，
  不宣称可翻页、未造控件；点禁用表头零副作用（URL 不写、fetch 不增）。
```

## 验证尾行（R211 增量）
```text
$ npx vitest run src/modules/knowledge   → 30 files / 162 tests passed（R210 后 161 + 1）
$ npx vitest run                         → 290 files / 2989 tests passed 全绿（无豁免）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r211-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：同 R210 清单全绿（新增一例未触任何既有断言）。
过程记录：初稿把 unwired 分支 title 当预期，实测 error 分支另有其句——按产品真值改
  期望（禁改产品），差异无。
```
未测如实：unwired/403 分支的表头 title（产品 :2704 三元式三分支之一，同族文案，本轮
只锁 error 实测句）；正常态排序翻序复跑（引主测 kn-sort 段，不重复）。
边界：只改 web/src/modules/knowledge/knowledge.error.isolation.test.tsx（追加一例）与
本证据；显式路径 add；无 force/amend/--no-verify/git add -A；单增量 commit
「test(console): knowledge error isolation guards」；随 merge `3626e607`（并入 `5f1b7428`）
一并推送。

# KNW5 追加 R212：导出列「双口径」护栏 —— evidence-only（四腿全被既有套件锁死）（2026-11-21 BJT）

安全门：porcelain 空起做（HEAD 即 R210/R211 链 `bd2f02b8`）、显式 refspec fetch 后
merge 实测 tip 即预期 `5f1b7428`（Already up to date——R211 已并入该章）。本轮按派工
预留的 evidence-only 通道收尾（先例 R204/R205）：**零测试文件新增、零产品改动**，
只本证据一节。不建 knowledge.export.columns2.test.tsx 的理由与判定书如下。

## 四腿逐条查重结论（行号 grep 核对）

```text
① 列头与列序逐字 —— 已锁：R200① knowledge.export.columns.test.tsx:125（共有列逐位同
   + 差集 {复制独有:短码}/{屏上独有:操作}）+ R190② knowledge.export.escape.test.tsx
   :151-157（屏上表头 [文档名,类型,大小,更新,操作]、DOC_LINE_HEADER 5 列、复制表头
   join 逐字、knG 空间列第 2 位）。列名口径照实现为「更新」（非「更新时间」）——
   R190/R200 均按实测锁。→ 引用不重写。
② 同一行「导出」单元格 == 屏上同列 —— 已锁：R200②（columns :149-152 逐格 toBe 含
   类型人话/大小人话/updatedText 时间/短码列，检索面 :172-176 五格含所属空间）+
   R209（rows :137 首/中/末整行直对）。→ 引用不重写。
③ 缺值两处逐字 —— 已锁：R190③（escape :171-180 屏上三「—」==复制三「—」、无
   undefined/null/空字段）+ R200② 缺值对 + R209 末行全行级「M 缺项档 | — | — | — | DM」
   两产物互等。**名实红线判定**：两产物共用同一 docLine 实现（R71 单点），「CSV 空字段」
   第二口径实测不存在——本轮未造数据、未伪称两口径，按单一实现断言已由上述套件完成。
④ 三值 + 零额外请求 —— 已锁：R142（space.export :164-176 三值筛选联动降数复原）+
   R209（rows :155 三值当态 + :158 urls 快照逐字 + spy 0）+ R207（filter :161 快照）+
   R190④（空态 disabled+title+writeText 0+createObjectURL 0）+ R164①（请求参集合恰
   {limit,spaceId}）。→ 引用不重写。
```

## 残留观察（不属四腿，留待后续裁量，未硬造）

```text
检索面 knG 数据行 ↔ 行钮 kn-row-copy-<i> 串的「变换形」对账（knG 行 = 行钮行在第 2 列
插入所属空间）：两产物列集不同、非 toBe 关系，R200 只锁了表头级差集与各自对屏上；
如需落钉应作为独立口径单派，本轮四腿不含、不为凑文件名铺例。
```

## 验证尾行（R212，evidence-only）
```text
$ npx vitest run src/modules/knowledge   → 30 files / 162 tests passed（基线不降 = 通过口径）
$ npx vitest run                         → 290 files / 2989 tests passed 全绿（无豁免项）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r212-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：本轮零代码改动，既有 30 套与零破清单全族原样绿。
```
未测如实：无新增断言故无新未测项；既有个案的未测面（带会话真屏、检索面变换形对账）
已在各轮证据登记，此处不重复展开。
边界：只改 docs/_artifacts/ui1/KNW5-RETRIEVAL-EVIDENCE.md 一个文件；显式路径 add；
无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge export column dual-standard guards」（evidence-only 实质，
message 照派工原文）。

# KNW5 追加 R213：全局面 × 空间详情面 parity 护栏（纯测试单，重开后续完）（2026-11-21 BJT）

安全门：porcelain 空起做（HEAD 即 R214 清零笔 `1389c038`）、显式 refspec fetch 后 merge
实测 tip `4937d63e`（比暂停时 `d7c95f80` 新，如实记录；知识面 delta 空）。WIP 自 /tmp
保全件移回续写（未从头重写）。零产品文件改动（无真缺陷）。

## 查重与四腿判定

```text
①四字段跨面逐字 —— 已锁：kn.parity.ts:138-141（R70 名/类型/大小/更新 text+title）+
  R200 columns:125（短码为复制独有列的差集）→ 引用不重写；本文件行钮文本对覆盖短码跨面。
②同词两面行集 —— 新写：全局面 q=手册 与详情面本地名筛「手册」行集逐元素等
  （["A 手册.pdf","C 运维手册.pdf"]）；器械差异如实记录（q 属搜索框、名筛属组件态，
  详情清筛不串命中面）——不伪称跨面筛选等价。
③跨面同文档行钮整串 toBe —— 新写：kn-row-copy-0（全局）==kn-row-copy-space-0（详情）
  整串逐字（docSingleCopy 同源的跨面直接证据，此前 R204/R208/R209 只各自单面）；
  复制零请求（cursor= 零命中 + 点钮前后计数相等）。
④详情翻页不串全局面 —— 新写（按派工字面造 51 笔）：P1 恰满 DOCUMENTS_LIMIT=50 →
  cap 句「本页最多显示 50 篇（当前已加载 50 篇…）」+ kn3-page-cap-more 在场；
  点 knE-page-more 增量恰 [P2URL]，命中面行名序列与 data-len 逐字不动；翻页后
  M 可变位 50→51、50 常量位不动、满页提示退场；全局面 kn6-search-table 内零 knE-page-*
  （无翻页能力，禁双侧宣称）；全局面本就无上限句（kn3-page-cap 全文档仅 1 个属详情面）。
名实红线复述：kn-space-page-cap 不存在（R187 断言过缺席）；两面同屏共存（R132 实证）；
无 ?source=；导出仅 data-export="absent"。
```

## 过程记录（测试自纠，非产品缺陷）

```text
上一轮 ④ 卡点根因查明：①旧断言写 `[data-testid="knE-page"]` 精确匹配（族实际是
knE-page-bar/-count/-more… 前缀族）恒 0；②旧 fixture 只有 2 笔，未满足派工「>上限」
字面——改 51 笔跨页夹具。两处均测试侧修正，产品零触碰（分页条本身在 ready 非空即渲染，
与行数是否满页无关——cap-more 提示才与 M==50 挂钩，两事各锁各的）。
```

## 验证尾行（R213）
```text
$ npx vitest run src/modules/knowledge   → 32 files / 169 tests passed（基线 166 + 3），尾行无 Errors
$ npx vitest run                         → 297+ files / 3010 tests passed 全绿（无豁免，0 Errors）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r213-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/kn6–kn9/knB/knD/knF/knG/knI/knL-copy*/kn-sort*/kn-gates/kn-row-copy*/
kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/kn-space-preview*/kn3-page-cap(含 -more)/
knE-page-*/kn7-preview-*/kn-type* + 既有 31 套全绿。
/tmp 保全件收尾后删除（内容已入库，无第二副本）。
```
未测如实：带登录会话真实 51 笔屏（跨页以 mock 信封代证）；q×ktype 双器械同时在场时
两面各自的组合筛选矩阵（器械单动已锁，组合非本文件四腿范围）。
边界：只新增 web/src/modules/knowledge/knowledge.space.parity.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；未并 main、未重建 9122；单 commit
「test(console): knowledge space and global parity guards」。

# KNW5 追加 R215：空态 × 清筛选出口护栏（纯测试单）（2026-11-21 BJT）

安全门：porcelain 空起做（R213 落地后）、merge 实测 tip 即预期 `024bb79e`（知识面 delta 空）。
零产品文件改动（无真缺陷）。新增 knowledge.empty.export.test.tsx 3 例。

## 名实换算与查重（引用不重写）

```text
①「导出 disabled+title+零请求+spy 0」——kn-list-copy 不存在、导出族仅 data-export="absent"：
  已由 R214④（两面 knF/knG disabled+「没有可复制」+点击零写零请求+createObjectURL 0）与
  R187④/R138 锁死 → 本文件仅真 0 态复跑在场性，不重铺全矩阵。
②「空态不显裸 0」：kn3-page-cap 在真 0/error/denied/非法枚举实测**不渲染**（R108⑥/R157/
  R187 已锁，差异写入注释与回执，不为凑 brief 改产品）；**新锁缺口=计数位**——
  ready-0 行时 knF-lines/knG-lines 实测逐字「—」（grep 此前零命中；R138 只锁过 error 态），
  全文无 /(^|[^0-9.])0\s*(条|篇|个)/ 裸数。
③「清筛选恰 1 次取数」名实不成立：读口不吃 q/sort/ktype——实测**零次**增量（u0 快照逐字），
  不制造也不宣称重取；清后钮数==行数（详情 -space- 族、检索面族双测，indexBase 连续性
  引 R169/R207）。
④错误↔空态互斥：详情面 R187②、双败 rid 复制 R210④ 已锁 → 引用；**新锁缺口=检索面**
  kn6-search-error 的 rid 逐字（「请求编号：rid-r215-search」）+ 复制钮点击 writeText
  恰收该 rid、零额外请求、错误锚不因复制而变。
过程记录：初稿一处「同帧另一面」断言错位（列表态路由不渲染详情表）——按真实结构改为
「该路由 kn3-docs 不挂载 + 复制后错误锚独立在场」，非产品缺陷；isSecureContext 注记沿用 R210。
```

## 验证尾行（R215）
```text
$ npx vitest run src/modules/knowledge   → 33 files / 172 passed（基线 169 + 3），尾行无 Errors
$ npx vitest run                         → 299+ files / 3019 passed 全绿（0 Errors，无豁免）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r215-dist → exit 0
$ 三档：1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn3*/kn6–kn9/knB/knD–knL*/kn-sort*/kn-gates/kn-row-copy*/kn-row-copy-space*/
kn-doc-copy*/kn-doc-preview*/kn-space-preview*/kn3-page-cap/knE-page-*/kn7-preview-*/kn-type*。
```
未测如实：带登录会话真实空态屏；knF-lines 在「筛后 0 行」与「读回 0 行」两变体只测后者
（前者族由 R142② 行钮侧锁过）。

# KNW5 追加 R216：空间详情翻页三值同源护栏 —— evidence-only（四腿全被既有套件锁死）（2026-11-21 BJT）

安全门：porcelain 空起做（HEAD 即 R215 `2683944a` 链）、显式 refspec fetch 后 merge 实测
tip 即预期 `024bb79e`（Already up to date——R215 时已并入）。本轮走派工明示的
evidence-only 合法通道：不建 knowledge.space.paging2.test.tsx、零产品改动、只本证据一节。

## 四腿逐条查重结论（file:line，均实测核对）

```text
① 详情面翻页后三值/五读同源 —— 已锁 R197①（knowledge.counts.paging.test.tsx:138-155）：
   翻页后 knE-page-count 逐字「已显示 3 篇 · 总数不可用」、可见行 3==data-len "3"==
   行钮 3==cap 句 M "3"（capM 正则 :97 从「当前已加载 (\d+) 篇」取可变位；50 常量位
   整句互等锁在 R131②:143-144）、钮 id 跨页连续 [space-0, space-1, space-2]（indexBase，
   :149）、第五读 knF 数据行数 :153 且逐行==行名 :155。名实换算照旧：kn-space-page-cap
   不存在（R187 测过缺席）→ 实名 kn3-page-cap；「导出数据行数」= knF-copy（R142/R190 先例）。
② 切类型归 1 页/不带旧 cursor/行替换 —— 已锁 R131①（knowledge.paging.test.tsx:115-125：
   「已显示 2 篇 · 总数不可用」、d_c 按标识出局、cursor= 全程恰 1 无重放）+ R197②（复位
   重算 [2,2,"2","2]）。→ 引用。
③ 末页提示与 M 一致 + more disabled —— 已锁 R131②（paging:136-144：disabled=true、
   文案「已到末页」、cap M==count 读数 toBe 互等）+ R152③（两态 title 逐字）。→ 引用。
④ 第 2 页 500 保旧行 + rid + 重试恰 +1 + 成功三值同步 —— 已锁 R131③（paging:148-163：
   rid-r131-500、added 恰 [P2URL]、成功并入行身份）+ R197④（counts.paging:窗口期四读
   [2,2,"2","2"] 不塌、成功后 [3,3,"3","3] 跃迁 + 钮链三连）。→ 引用。
判定：四腿无一残留，为凑文件名铺重复断言违反查重纪律 → evidence-only。
```

## 验证尾行（R216，evidence-only）
```text
$ npx vitest run src/modules/knowledge   → 33 files / 172 tests passed（基线不降 = 通过口径），尾行无 Errors
$ npx vitest run                         → 300+ files / 3019 passed 全绿（0 Errors，无豁免）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r216-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：本轮零代码改动，既有 33 套与全清单原样绿。
```
未测如实：无新增项；既有个案的带会话真屏照旧登记于各轮。
边界：只改 docs/_artifacts/ui1/KNW5-RETRIEVAL-EVIDENCE.md 一个文件；显式路径 add；
无 force/amend/--no-verify/git add -A；单 commit
「test(console): knowledge space paging value guards」（evidence-only 实质，message 照派工）。

# KNW5 追加 R217：预览/详情同帧 parity 护栏（纯测试单·本体交付）（2026-11-21 BJT）

安全门：porcelain 空起做（HEAD 即 R216 本体链 `70c667f4`）、显式 refspec fetch 后 merge
实测 tip 即预期 `6dc311ea`（Already up to date）；基线先跑 34/176 全绿无 Errors 再动笔。
零产品文件改动（无新缺陷）。新增 knowledge.preview.detail.test.tsx 四例（本体，非 docs-only）。

## 名实换算（按产品现状）

```text
· 无独立"详情页"路由：唯一详情面 = 遮罩抽屉 kn7-preview-*（?doc=）——派工"预览抽屉与
  详情页"为同一面，对照腿落真实四处：抽屉 dd × 列表格 × 行钮 kn-row-copy-space-<i> ×
  kn-doc-copy 单控件（非行数）。
· 缺值两套口径为产品定版：表格/复制行「—」、预览/抽屉 previewField「该字段未返回」+
  「<字段>：<原因>」title——禁统一，本文件 ② 同帧并测两套。
· 导出族不存在（createObjectURL/text/csv/download= 0，仅 data-export="absent"）、无
  ?source= 控件——未造任何控件。
```

## 查重与新增维

```text
引用：R204 detail.parity ①/②（六路链与两套句收口）、R196（开 1 关 0/序列不变）、
R183/R206（500/404 句+rid+不卸载+复制串不污染+dl title）、R125C/R149、R213/R215/R216。
①②③为同帧基线整体复跑（不声称新发现）。
新增维=(a) 抽屉 404 错误态后行内预览仍可用且逐字同干净态：R206 只锁 500 窗内复制串；
本文件 ④ 锁 404 + 关抽屉 → kn-doc-preview-* 照常展开、四字段+短码格与干净态采集值
逐字等、kn-doc-copy 整串 toBe 干净样张、期间列表行序 ["全项手册.pdf","缺项档"] 与
钮序列 [0,1] 逐字不变；rid 复制钮实测在场（unwired 分支含 RequestId 钮），点击
writeText 恰收 'rid-r217-gone'。
```

## 验证尾行（R217）
```text
$ npx vitest run src/modules/knowledge   → 35 files / 180 tests passed（基线 176 + 4 ≥177），
  全输出 grep unhandled|Errors = 0（clipboard 桩全 Promise 返回，R214 教训守住）
$ npx vitest run                         → 305 files / 3042 tests passed 全绿（无豁免）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r217-dist → exit 0
$ 三档（vite preview + headless Chrome CDP，用毕即杀）：1440/1280/375 vw==bodySW==docSW 全等
零破：kn3*/knE-page-*/kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/
kn-space-preview*/kn7-preview-*/kn-type*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort*/
kn-gates/kn3-page-cap 与既有 34 套全绿。
读数：① 五字段样张 ["全项手册.pdf","PDF","2.4 MB","2026-11-19 15:10","DFULL1"] 四处互等、
  dl title=d_full1、正文无裸 id/短码；② 缺值行同帧两式 + 全页无 undefined/null/d_ id；
  ③ 列表首读恰 1、开抽屉增量=[DETAIL_A]、行内开合与关抽屉均 0 增量；④ 如上。
```
未测如实：带登录会话真 404 详情信封（mock 代证）；④ 的 404 窗内「切另一行预览」多行
矩阵（单行开合已锁）；isSecureContext 的 fallback 选抄路径（属 lib/clipboard，非本模块）。
边界：只新增 web/src/modules/knowledge/knowledge.preview.detail.test.tsx 与本证据；
显式路径 add；无 force/amend/--no-verify/git add -A；单 commit
「test(console): knowledge preview detail parity guards」。

# KNW5 追加 R218：筛选 × 计数同源护栏（纯测试单·本体交付）（2026-11-21 BJT）

安全门：从调度方 merge 后状态起做（HEAD `65882219` wave-60、porcelain 空、目标文件
确认不存在），基线先跑 35/180 全绿再动笔。零产品文件改动（无新缺陷）。
新增 knowledge.filters.counts.test.tsx 四例（本体，非 docs-only）。

## 名实四处换算（派工口径全部照落）

```text
1) ?source= 无控件 → 叠加 = ktype（旧 type 兜底、清除双删）× ?q= × 本地名筛。
2) 计数锚分面：检索面 kn9-count-docs(HitCount)+kn-row-copy-<i>；详情面 kn3-page-cap+
   kn-row-copy-space-<i>——两腿各自同帧，未跨面互等。
3) 「清空 type 恰 1 次取数」实测 **0 次**（读口不吃 ktype）：③ 按 0 断言（urls 快照
   c0 相等 + 全程无 cursor=），未制造请求，差异在此与回执点名。
4) 「切 source chip 不动」改测：切桶后 q/ksort/kdir/space/tab/panel 逐字（③当态复跑，
   引 R118②）；非法两路地址逐字 + 空态不显裸 0 + cap 不渲染（④）。
```

## 四例读数与新增维（已锁维度只引用：R169①/R157③④/R146①/R118②/R142②/R138/R190④/R197）

```text
① 新增维=检索面命中态数值链：HitCount 抽「命中 2 项」之 2 == data-len == 可见行 ==
  命中钮数（四者 toBe；此前只有未筛态四值与文案子串）；no-match 三值同 0、句「没有匹配
  的文档」在场、全文无裸「0 条/0 篇」、q 全程一次读取。
② 新增维=详情面 ktype 深链态（非点击态）同帧五值 2==2=="2"==2==cap 整句逐字「本页最多
  显示 50 篇（当前已加载 2 篇；复制清单也只含这些篇）」+ -more 不在场 + 钮 [0,1] 重编号。
③ 清桶零新请求 + URL ktype/type 双清、q=手册/ksort=updated/kdir=desc/space 逐字 +
  五值当帧复原 3 与钮 [0,1,2] 连续。
④ 非法两路：loc 逐字含 __nope__、句点名非法值、无裸 0、cap null、knF disabled+「没有可
  复制」句、点击 writeText 0 + urls 不动、createObjectURL 两路全程 0。
```

## 验证尾行（R218）
```text
$ npx vitest run src/modules/knowledge   → 36 files / 184 tests passed（基线 180 + 4 ≥184），
  全输出 grep unhandled|Errors = 0（clipboard 桩全 Promise，R214 教训守住）
$ npx vitest run                         → 309 files / 3058 tests passed 全绿（无豁免）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r218-dist → exit 0
$ 三档：1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn3*/knE-page-*/kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/
kn-space-preview*/kn7-preview-*/kn-type*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort*/
kn-gates/kn3-page-cap/kn9-count-docs + 既有 35 套全绿。
过程记录：一处手误占位 mock 行提交前删除；无产品改动、无真缺陷。
```
未测如实：带会话真实屏（命中数抽取链以 mock 代证）；详情面本地名筛×ktype×翻页三重叠加
的两两组合已各锁，三重同帧未铺；knG 侧命中态数值链同理未重铺（①在检索面已锁本族）。

# KNW5 追加 R219：详情×预览跨面同值扩展（纯测试单·本体交付）（2026-11-21 BJT）

安全门：从调度方 merge 后状态起做（HEAD `4f2f4e54` wave-61、porcelain 空、目标文件
确认不存在），基线先跑 36/184 全绿再动笔。零产品文件改动（无新缺陷）。
新增 knowledge.detail.preview.parity.test.tsx 两例（本体，非 docs-only；派工红线
「至少 2 条同帧更严组合」达成）。

## 名实七条照落（文件头注释同步）

```text
无独立详情页（唯一详情面=抽屉 kn7-preview-*）→ 四处=列表格×抽屉 dd×行内预览/kn-doc-copy×
行钮（详情面 kn-row-copy-space-<i>，检索面族不参与本文件）；kn-doc-copy 单控件非行数；
?source= 无控件→ktype×q 叠加；kn3-page-cap 属详情面、kn9-count-docs 属检索面不互等；
缺值两套口径不统一；导出族 absent 未造控件；cursor 组件态；短码尾段大写、全 id 仅 title；
时间 updatedText；clipboard 桩全 Promise（尾行 Errors 0 达成）。
```

## 四腿处置与新增维点名

```text
①六路链=R204 detail.parity:82-125 已锁（干净态）→ 复用 cited；
②抽屉开 1/关 0/序列不变=R196+R125C:180-207 → 复用 cited；
③500/404 体+rid+重试=R183:105-157+R206(a)+R217④ → 复用 cited；
④ktype 深链五值/cap=R218②、叠加换代=R207(a) → 复用 cited。
新增维（本文件两例，均为「三条件同帧」此前无 pin 的组合）：
· (a) ktype×q 叠加态内 四处五字段互等 + cap 整句逐字不变（开合/复制全程）+ 钮 id [0]
  连续 + 详情读=开抽屉次数的当帧复测 + 再开/再关增量恰 [DETAIL_A]/[]；
· (b) 抽屉 500 窗内 列表格×抽屉 dd 同帧互等（错误不污染行派生字段）+ rid 可复制
  （writeText 恰收 rid-r219-500，portal 断言走 document.body）+ 关抽屉后行钮/行内预览
  两串仍与样张互等、cap/钮 id 不动 + 重开(再 500)后重试增量恰 [DETAIL_A]、成功源字段
  落「全项手册原件.pdf」、四值再同步。
过程记录：(b) 两处测试自身错（rid 断言查 container 而抽屉是 portal→改 body；行钮取
calls[0] 撞上 rid 那次→改 at(-1)），产品零触碰。
```

## 验证尾行（R219）
```text
$ npx vitest run src/modules/knowledge   → 37 files / 186 tests passed（基线 184 + 2 ≥186），
  全输出 grep unhandled|Errors = 0
$ npx vitest run                         → 315 files / 3075 passed 全绿（无豁免）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r219-dist → exit 0
$ 三档：1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn3*/kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/kn-space-preview*/
kn3-page-cap/knE-page-*/kn7-preview-*/kn-type*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort*/
kn-gates + 既有 36 套全绿。
```
未测如实：带会话真屏（详情 200/500 真信封 mock 代证）；(b) 的 404 变体四处链（R217④ 已锁
其子集，本轮按派工择 500）；抽屉三态 title 全句（R152③ 族，非本单四腿）。

# KNW5 追加 R220：导出命名/字符集缺席护栏（纯测试单·本体交付）（2026-11-21 BJT）

安全门：porcelain 空起做（HEAD 即调度方 merge `f6ebdd39`，含预期章笔 `08fe4abe`——
merge commit 按实记录）、基线先跑 37/186 全绿 Errors 0 再动笔。零产品文件改动、
未造任何导出件。新增 knowledge.export.naming.test.tsx 三例（本体）。

## 三件点名产物「按现状缺口」逐字记录（同时抄入文件头）

```text
(a) a.download 文件名词表——不存在：kn-export-name 全面 0 个（DOM+grep 双确认）、
    产品源码无 download= 属性、无任何导出文件名构造；
(b) Blob.type "text/csv;charset=utf-8"——不存在：源码无 new Blob（R190 已锁文本面），
    本单补行为面——vi.stubGlobal("Blob", spy) 三类复制器全程 0 调用；
(c) BOM \uFEFF——不存在：源码零命中、无导出字节流可言。
以上缺席锁成「变红即提醒」不变量：若将来真落 CSV 导出，①②③ 相应断言变红逼对齐口径。
```

## 三例读数

```text
① 源码四文件（page/knowledge/copyGates/updated）合串：createObjectURL / a.download|
  download= / new Blob( / text/csv / \uFEFF 全部 0 命中（R190 同法补两形）；DOM 面：
  kn-export-name 0、a[download] 0；absent 标记逐面（kn-gates-knF/knG）= SPAN +
  aria-hidden=true + 内部无 button/a[href]——诚实陈述而非假 disabled 按钮。
② 三类复制器（knF-copy/knG-copy/详情行钮）各点一次：writeText 恰 3 次、表头逐字
  「文档名 | 类型 | 大小 | 更新 | 短码」与「文档名 | 所属空间 | … | 短码」、缺值行进
  文本「M 缺项档 | — | — | — | DM」（「—」口径）；createObjectURL spy 0、Blob ctor spy 0、
  a[download] 全程 0。
③ 复制前后 urls 排序快照逐字相等（本地零增量）；空集两面 disabled + knF title 含
  「没有可复制」、点击 writeText 0 + urls 不动 + 字节流三计数全 0。
```

## 验证尾行（R220）
```text
$ npx vitest run src/modules/knowledge   → 38 files / 189 tests passed（基线 186 + 3 ≥187），
  全输出 grep unhandled|Errors = 0（clipboard 桩全 Promise、Blob stub 在 afterEach unstub，
  R214 教训守住）
$ npx vitest run                         → 316 files / 3078 passed 全绿（无豁免）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r220-dist → exit 0
$ 三档：1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn3*/kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/kn-space-preview*/
kn3-page-cap/knE-page-*/kn7-preview-*/kn-type*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort*/
kn-gates + 既有 37 套全绿。
```
未测如实：带登录会话真屏（缺席不变量与信封无关）；absent 标记全 4 处中 knI/knL 两面
未逐个点开（同构造、knF/knG 两面已代表性锁定）；真落 CSV 时的正向命名/编码断言
（本单只锁现状缺席）。

# KNW5 追加 R221：详情错误隔离扩展·跨面交互与恢复过渡（纯测试单·本体交付）（2026-11-21 BJT）

安全门：porcelain 空起做（HEAD = 调度方 merge `43d83d65` wave-62）、目标文件确认不存在，
基线先跑 38/189 全绿无 Unhandled 再动笔。零产品文件改动（无新缺陷）。
新增 knowledge.detail.error.isolation.test.tsx 四例（本体，非 docs-only）。

## 名实换算与查重（文件头注释同步）

```text
· 唯一详情面 = 抽屉 kn7-preview-*（无独立详情页）；派工①「kn-row-copy-*」按实测面换算
  为详情面族 kn-row-copy-space-<i>；两套缺值口径未统一；导出/?source= 不存在；
  ④ 的「恢复后 cap」按现测（不假设）：列表失败期 cap 缺席（R108/R157/R187 口径）、
  恢复后逐字整句复原。
引用不重写：腿① = R183 detail.error:105-132（锚互斥/不卸载/rid 上屏）+ R219(b)（500 窗
  行钮可用）→ ① 仅当帧最小复跑；腿③ = R210/R211 knowledge.error.isolation.test.tsx
  ③④（双重试各 +1 与双 rid 独立复制钮）→ ③ 仅复跑列表腿半段并声明。
新增维（此前 grep 零命中）：
· 腿② = 抽屉 500 错误窗内**列表交互全功能**：排序表头 disabled=false、点后翻序且
  零新请求；knE-page-more 照常翻页（增量恰 [P2URL]、3 行、错误锚不被列表动作吞）；
· 腿④ = **双失败恢复过渡**：cap「缺席 → 逐字整句复原」（两态各自锁过、过渡位首次）+
  两锚各自随其重试消失、互不牵连、恢复列表不遮抽屉错误锚（与 R210 同调、cap 位为补）。
```

## 四例读数

```text
① kn7-preview-error 在场、unwired null、knN-empty-text-space-docs null、body 含
  「请求编号：rid-r221-d」、列表 2 行不卸载、错误窗内点第 2 行钮 writeText 恰 1。
② 表头 kn-sort-updated disabled=false → 点击 rowNames 翻转、urls 零增量；再点
  knE-page-more 增量恰 [documents?limit=50&spaceId=sp_x&cursor=cw62]、行 3、锚仍在。
③ 列表重试增量恰 [P1URL]、详情读零连带、抽屉错误锚 standing（R210 当帧位复跑）。
④ 双败帧：两锚在场 + cap null；listOk 重试 → 列表锚 null、cap 逐字「本页最多显示 50
  篇（当前已加载 2 篇；复制清单也只含这些篇）」复原、抽屉锚不误清；detailOk 重试 →
  抽屉锚 null、field-source 落「A 原件.pdf」、列表锚保持 null。
```

## 验证尾行（R221）
```text
$ npx vitest run src/modules/knowledge   → 39 files / 193 tests passed（基线 189 + 4 ≥190），
  全输出 grep unhandled = 0（clipboard 桩全 Promise，R214 教训守住）
$ npx vitest run                         → 321 files / 3093 passed 全绿（无豁免）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r221-dist → exit 0
$ 三档：1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn3*/kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/kn-space-preview*/
kn3-page-cap/knE-page-*/kn7-preview-*/kn-type*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort*/
kn-gates + 既有 38 套全绿。四例一次全过，无测试自纠轮。
```
未测如实：带登录会话真双失败屏（mock 代证）；② 的错误窗内「切 ktype 桶」交互（排序/
翻页已锁，桶与详情错误同窗无新维需求）；恢复过渡中 skeleton 帧的瞬时态（异步中间态
不在护栏范围）。

# KNW5 追加 R222：行复制与批量入口可见性护栏（纯测试单·本体交付）（2026-11-21 BJT）

安全门：porcelain 空起做（HEAD `741c46e7` 含 wave-62 链，merge Already up to date）、
目标文件确认不存在，基线先跑 39/193 全绿无 Unhandled 再动笔。零产品文件改动。
新增 knowledge.copy.visibility.test.tsx 四例（本体，非 docs-only）。

## 名实与查重（引用不重写）

```text
kn-list-copy 不存在→knF/knG；导出族 absent SPAN（R190/R220）未造；无 ?source=；行钮分面
族照 R132/R169；唯一详情面=抽屉；两套缺值口径未统一；cap empty/error 态不渲染（R108/R157/
R187）；clipboard 桩全 Promise。①空态族 0+disabled+title+零写零请求=R138④/R190④；
②分面族渲染=R210/R211+R219(b)；③三值=R142②/R176；④行内预览开合序列=R196④——均为当帧
最小复跑并声明。
新增维（文件头点名，grep 此前零命中）：
· (a) 空/错误态下**整表 kn3-docs-table 含「操作」列头随体不渲染**——列可见性与行钮
  同源缺席（非仅按钮消失）；错误态同时证明分面隔离：详情面族 0 而检索面（另一读口
  成功）行钮照常 2——「哪个读口失败决定哪面归零」的可见性直证；
· (b) **抽屉开(?doc=)→关(只删 doc)路径**后行名序列、钮序列 [0,1] 与 cap 整句
  「本页最多显示 50 篇（当前已加载 2 篇；复制清单也只含这些篇）」逐字不变——R196④
  锁的是行内预览路径，抽屉路径首次。
```

## 四例读数

```text
① 空列表：两族行钮 0、kn3-docs-table null、cap null、空态句在场、knF disabled+
  title 含「没有可复制」、knG disabled、点击双钮 writeText 0 + urls 计数不变。
② 路 A（列表 500）：kn3-docs-error+rid 钮点击 writeText 恰 'rid-r222-list'、整表 null、
  详情面族 0/检索面族 2（分面隔离）；路 B（仅抽屉 500）：列表 2 行钮 [0,1] 照常、
  点行钮 writeText 1、抽屉错误锚 rid 钮点击恰收 'rid-r222-d'——两枚 rid 独立。
③ ktype=PDF 深链：行 1==钮 [0]==knF 数据行 1（三值同帧）。
④ 开→关抽屉：rowNames/btnSeq/cap 三项与开前逐字等，URL 开含 doc=d_a 关后回原。
过程记录：②初版把「族渲染 0」写成两族合并计数（检索面读口正常应有 2），按分面真相
  修正断言——修正本身即新增维(a)的隔离证据，产品零触碰。
```

## 验证尾行（R222）
```text
$ npx vitest run src/modules/knowledge   → 40 files / 197 tests passed（基线 193 + 4 ≥195），
  全输出 grep unhandled = 0
$ npx vitest run                         → 322 files / 3097 passed 全绿（无豁免）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r222-dist → exit 0
$ 三档：1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn3*/knE-page-*/kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/
kn-space-preview*/kn7-preview-*/kn-type*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort*/
kn-gates/kn3-page-cap + 既有 39 套全绿。
```
未测如实：带登录会话真实屏；空态下「操作」列头在检索面的同源缺席（该面空态整表随体
逻辑同族，仅详情面两态已锁）；② 路 B 关抽屉后钮序列再验（④ 独立覆盖同语义）。

# KNW5 追加 R223：复制文本跨三面直对护栏（纯测试单·本体交付）（2026-11-21 BJT）

安全门：porcelain 空起做（HEAD = 调度方 merge `32ede37e`，含预期上游 tip `3c3150d1`
wave-63；该并入对 knowledge 仅 css +15 无行为变更）、基线先跑 40/197 全绿 Errors 0、
目标文件确认缺席再动笔。零产品文件改动（无新缺陷）。新增 knowledge.copy.parity.test.tsx
三例（本体）。

## 名实换算（文件头同步逐条）

```text
· kn-doc-copy 不在 kn7 抽屉——grep 命中 KnowledgeModulePage.tsx:1992-2007：它是
  DocLineCopy 单控件，宿主=行内预览（kn-doc-preview-*）与检索命中内联展开
  （kn6-search-detail，?sdoc=）；派工「预览面」按实落此两处（抽屉复制件为
  kn-doc-permalink/knL-copy-meta，未参与本轮断言）。
· 「导出/清单行」按 R142/R190 先例映射 knF-copy/knG-copy 数据行（源码 createObjectURL/
  text/csv/a.download/new Blob 0 命中，仅 data-export="absent" ×4——未造控件）。
· 短码非固定 8 位：产品=大写人话尾段——② 锁「三处逐字等、非空、全大写自等」（实测
  样张 "DM"），位数断言不成立已按实替换。
· 三面互斥（R67/R68）：取证拆「同屏对同帧 + 互斥对顺序采集再比对」，未假装同帧。
· 裸 id 口径：?sdoc=/&doc= 地址参数是合法复现机制——「正文无裸 id」圈定两表体 section，
  不含地址探针（与主测 drawerText 口径同）。
```

## 查重与新增维（不声称全新增）

```text
引用：R209 export.rows:131-155（行钮↔knF 整行）、R204①（行钮↔kn-doc-copy 整串）、
R200②（knG 列↔屏上格、行钮 5 列事实）、R142①②（三值）、R132/R169（编号连续）、
R196④（预览开合行序/钮 id）、R207/R214④（复制零请求）。
新增维：① 两处「kn-doc-copy ↔ 清单对应行」整行直对（详情面直对 knF 行；检索面
  展开串 ↔ knG 行以「去固定第 2 列所属空间」口径拼接对——R71 唯一列差）——此前只经
  行钮传递锁过，直接 toBe 无 pin；② 缺 updatedAt 文档在三产物的短码/缺值列三处互等
  （"DM" 全大写自等、[3] 列「—」）；③ 复制四连动作（行钮+预览开+doc-copy+关）urls
  快照逐字 + **行内预览开合期间 kn3-page-cap 整句逐字不变**（cap×预览同帧首锁，行序位
  引 R196④ 不重写）。
过程记录：② 一处初版把「正文无裸 id」误圈整页（loc 探针含合法 sdoc=d_m）→ 按主测
  drawerText 口径圈定表体 section；两处 TS 收窄修正。产品零触碰。
```

## 验证尾行（R223）
```text
$ npx vitest run src/modules/knowledge   → 41 files / 200 tests passed（基线 197 + 3），
  全输出 grep unhandled = 0
$ npx vitest run                         → 325 files / 3105 passed 全绿（无豁免）
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r223-dist → exit 0
$ 三档：1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn3*/kn3-page-cap/knE-page-*/
kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort*/kn-gates/kn7-preview*/导出 absent 标记 +
既有 40 套全绿。
```
未测如实：带登录会话真屏（mock 代证）；knL-copy-meta/permalink 与清单行对（抽屉区非
本派工三面范围）；① 检索面 knG 行「所属空间」列与屏上格的对账（R200② 已锁，未重铺）。

# KNW5 追加 R224：浮层×筛选变更过渡护栏（纯测试单·本体交付）（2026-11-21 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `d5c886f5`、
基线先跑 41/200 全绿 Errors 0、目标文件确认缺席再动笔。零产品文件改动。新增
knowledge.preview.filter.transition.test.tsx 三例（本体）。

## 名实换算与新增维（文件头同步）

```text
换算：无 ?preview=（grep 0，行内预览=本地态 previewKey）→ ①落真实带 URL 浮层=抽屉
doc=；?type=pdf→?ktype=；「切筛选取数/清筛选恰 1 次」实测 0 次——按真实计数断言；
「浮层若原开则已关闭」与产品不符（清筛选不动 doc，面板存续）按现状断言并记差异；
cap 有行随 M 更新整句、筛空不渲染（R108/R157/R187 引用）。
查重引用：R196④/R222④（同筛选态开合免疫）、R207(a)（换代）、R218、R138/R190④、
R149/R183/R205/R217/R223。
新增维：(a) 抽屉打开态下切类型桶的交互过渡——面板存续 + 行出局 dd 落「类型：这条不在
当前已加载的列表里」（previewField 合成句式，实测修正）+ cap 随新 M 整句更新 + URL
doc 与 ktype 双参并立（R222④ 只在同筛选态开合，桶变更×浮层无 pin）；
(b) 非法枚举筛空→清除回退全程 urls 零增量 + 空态句与 data-len "0" 同源 + 面板存续
无错误锚。
```

## 三例读数与验证尾行（R224）

```text
① 切「表格」后：doc=d_a 与 ktype=表格 并立、行 [B 表.xlsx]、panel 在、dd「该字段未
返回」+title 合成句、cap 逐字「本页最多显示 50 篇（当前已加载 1 篇；复制清单也只含
这些篇）」、-more null。② 关闭后：只删 doc（ktype 留场）、行名/钮号 [0] 与关前逐字
等、urls c0→c0 零增量。③ 深链 ktype=__nope__+doc：0 行、data-len "0"、kn-type-empty
在、cap null、面板在而无错误锚；kn-type-clear 后行 2、钮 [0,1]、cap 回整句、urls
全程零增量、无 cursor=、面板存续（与派工预期差异按现状记）。
$ npx vitest run src/modules/knowledge → 42 files / 203 tests passed（基线 200+3），
  grep unhandled = 0
$ npx eslint → 0 errors（1 既有 warning）；模块 tsc → 0；build /tmp/knw-r224-dist exit 0
$ 全仓 → 332 files / 3122 passed 全绿（无豁免）
$ 三档：1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn3*/kn3-page-cap/knE-page-*/
kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort*/kn-gates/kn7-preview*/kn-type*/导出 absent
标记 + 既有 41 套全绿。过程记录：dd title 期望初版漏 previewField 前缀，按实测真值
修正（产品零触碰）；占位变量残留两处清除。
```
未测如实：带登录会话真屏；行内预览（本地态）×桶切换不写 URL 的免疫（R196④ 同路径）；
`sdoc=` 展开浮层的同过渡（换算说明已注，本轮按派工择 doc= 落地）。

# KNW5 追加 R225：预览打开态行复制序列/播报器归属护栏（纯测试单·本体交付）（2026-11-21 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `f7009e21`、
基线先跑 42/203 全绿 Errors 0、目标文件确认缺席再动笔。零产品文件改动。新增
knowledge.preview.rowcopy.sequence.test.tsx 三例（本体）。

## 名实与查重（引用不重写）

```text
三面族名：派工三例全落空间详情面——钮=kn-row-copy-space-<i>（检索面 kn-row-copy-<i>
不参与本文件的预览/分页/cap 面）；播报器每面单具（R167 已锁形状 → 引用）；无 ?preview=
（本地 previewKey，R68）；③ 按 R216 先例 51 行跨页夹具（P1 恰 50）。
引用：R132（后缀族/重编）、R167（单具形状+键盘）、R169（跨组不重号）、R196④（预览
开合行序/钮快照）、R214（双列标准）、R216①（append 后 [0..50] 连续+cap 整句——③照
派工要求复跑该断言并注明引用）、R223/R224。
新增维（逐例点名）：① 预览打开态下「钮 i 宿主行==表体第 i 行」几何对（closest("tr")
逐位，R216 只数序列连续未锁行内归属）+ 打开态跨面播报器归属（点详情面钮→
kn-row-copy-space-status「已复制」而检索面 status 保持空）；② 关闭预览后播报器
文本保持（R167 只锁播报不锁关后留存位）+ 行序/钮/cap 逐字 + urls c0→c0 零增量；
③ append 后新行（册 51.pdf）钮文本与 knF 清单第 51 行**逐字直对**（新行入链）+
开新行预览再点钮归属仍独响。
```

## 三例读数与验证尾行（R225）

```text
① 首屏 50 钮 [0..49]；row0/1 宿主行几何对成立；点钮 idx1 → 详情面播报「已复制」、
  检索面 ""、writeText 1。② 关预览：播报保持「已复制」、行名/钮/cap（50 篇整句）
  逐字、urls 2→2（读后前后计数）零增量。③ append：钮 [0..50] 连续 51、cap 逐字
  「本页最多显示 50 篇（当前已加载 51 篇；复制清单也只含这些篇）」、idx50 串首列
  「册 51.pdf」toBe fLines[50]、fLines 51 行、cursor= 请求全程恰 1。
$ npx vitest run src/modules/knowledge → 43 files / 206 tests passed（203+3），
  grep unhandled = 0
$ eslint → 0 errors（1 既有 warning）；模块 tsc → 0；build /tmp/knw-r225-dist exit 0
$ 全仓 → 337 files / 3136 passed 全绿（无豁免）
$ 三档 1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn3*/kn3-page-cap/knE-page-*/
kn-type*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort*/kn-gates/kn7-preview*/导出 absent
标记 + 既有 42 套全绿。过程自纠两处（自反哨兵废行、首屏 50 行非 2 行的预期），产品零触碰。
```
未测如实：带登录会话真 51 行屏（mock 代证）；② 的「重开预览后播报复位」未锁（关后
保持已锁，开→再关循环无新语义）；检索面自身预览/归属（该面无行内预览宿主，名实已注）。

# KNW5 追加 R226：类型/大小人话 × 三载体同源护栏（纯测试单·本体交付）（2026-11-21 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `d17c06e2`
（wave-68）、基线先跑 43/206 全绿 Errors 0、目标文件确认缺席再动笔。零产品文件改动
（无新缺陷）。新增 knowledge.rowcopy.locale.test.tsx 三例（本体）。

## 名实与查重（引用不重写）

```text
无真 CSV（源级四件套 0、data-export="absent" ×4——R190/R220 不变量）→「导出 CSV 列」
映射 knF/knG 数据行；行钮分面（详情 -space- / 检索 -）；人话单点 docTypeLabel（未知→
「其他类型」knowledge.ts:661/:674）与 formatBytes（:536）未造第二套；两套缺值口径未
统一。引用：R204①（跨面字段链）、R209（行钮↔knF 整行）、R214②（knG 列↔屏上格、
行钮 5 列事实）、R223（三面同源）、R218、R200。
新增维（点名）：
· ①-a 裸值负向扫描：两表体 section 可见全文对 /application\/[a-z0-9.+-]+/i、
  ≥4 位裸字节+单位、"987654321"/"2516582" 全 0 命中；未知类型样张屏上「其他类型」、
  裸 MIME 只进 title（application/x-unknown-9x）——既有皆正锁、负扫无 pin；
· ①-b 检索面跨载体整行直对：knG 数据行去固定第 2 列（R71 唯一列差口径）== 检索面
  行钮串 5 列逐元素 toEqual（R214 做过列↔屏上格，行间整链首次）。
```

## 三例读数与验证尾行（R226）

```text
① A 行三载体 type/size 逐字互等 = "PDF"/"2.4 MB"；X 行屏上「其他类型」+title=裸 MIME；
  负向扫描全零；检索面 X 行 [name,...去空间列] == 行钮 5 列、type 位同「其他类型」、
  size 位 == 屏上格。② M 行三载体 type/size 同「—」（cell/行钮/knF /knG 去列位）、
  body 无 undefined/null。③ 三连复制 writeText 3、urls 快照逐字 == u0、三值 [3,3,3]。
$ npx vitest run src/modules/knowledge → 44 files / 209 tests passed（206+3），
  grep unhandled = 0
$ eslint → 0 errors（1 既有 warning）；模块 tsc → 0；build /tmp/knw-r226-dist exit 0
$ 全仓 → 339 files / 3142 passed 全绿（无豁免）
$ 三档 1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn3*/kn3-page-cap/knE-page-*/
kn-type*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort*/kn-gates/kn7-preview*/导出 absent
标记 + 既有 43 套全绿。三例一次全过、无自纠轮，产品零触碰。
```
未测如实：带登录会话真屏；「大小恰好进位边界」样张（999B/1024B 级）取产品既有
formatBytes 分支（R54 族已锁部分边界）；image/* 等其他 MIME 族的负扫（本轮以
application/x-unknown-9x 代表，正则族扫描已覆盖前缀）。

# KNW5 追加 R227：行复制本地化标签护栏（判定 R227≡R226 主腿已锁，同文件追加两条新维）（2026-11-21 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `c4542fdb`
（wave-69）、基线先跑 44/209 全绿 Errors 0。零产品文件改动。**不新建文件**——按派工
纪律在既有 knowledge.rowcopy.locale.test.tsx（R226 本体）内追加。

## R227 三腿比对结论（逐条引用）

```text
①类型/大小人话三载体逐字 + 裸 MIME/裸字节负扫 —— R226 ①（本文件 :96-141）已锁
  （PDF/2.4 MB 样张三载体 toBe、application/* 与 ≥4 位裸字节负向扫描）；
②缺值三处同句「—」、无 undefined/null —— R226 ②（:143-172）已锁；
③复制/导出前后 urls 不变 + 三值 —— R226 ③（:209-220）已锁。
主腿全锁 → 仅补派工点名的未锁子维，两条新用例：
④ 新增维：image/* MIME 族（R226 负扫正则仅 application/ 前缀）——P 截图.png 屏上
  「图片」、title 落裸 image/png、三载体（格/行钮/knG 去列位）逐字互等、51200→"50.0 KB"、
  两表体全文 image/* 与裸字节 0 命中；
⑤ 新增维：text/plain 现状样张（后缀 "plain" 不在人话映射表——「其他类型」+title 裸
  MIME，非缺陷按现状锁）+ formatBytes 进位边界 999→"999 B"（未进位合法人话）、
  1024→"1.0 KB"（裸值不上屏）。
```

## 验证尾行（R227）
```text
$ npx vitest run src/modules/knowledge   → 44 files / 211 tests passed（基线 209 + 2），
  grep unhandled = 0
$ npx eslint src/modules/knowledge       → exit 0（仅 R54 既有 1 条 warning）
$ npx tsc -b . --noEmit | grep modules/knowledge → 0 错
$ npx vite build --outDir /tmp/knw-r227-dist → exit 0
$ npx vitest run（全仓）                  → 342 files / 3154 passed 全绿（无已知红需点名）
$ 三档：1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn-row-copy*/kn-row-copy-space*/kn-doc-copy*/kn3*/kn3-page-cap/knE-page-*/
kn-type*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort*/kn-gates/kn7-preview*/导出 absent
标记 + 既有 44 套全绿（R226 三例复跑同绿）。过程自纠两处（残缺正则行删除、1023B 系
合法人话非裸字节——改 1024 进位样张），产品零触碰。
```
未测如实：带登录会话真屏；映射表全量 MIME 族（image/png 与 application/* 两代表已锁，
其余映射键同源单点）；1023 这类「未达进位」人话与裸字节之界由⑤注释钉义。

# KNW5 追加 R228：类型筛选跨面互不污染/非法双路/旧键共存换桶（纯测试单·本体交付）（2026-11-21 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `1ee16b61`、
基线先跑 44/211（R227 后最新）全绿 Errors 0、目标文件确认缺席再动笔。零产品文件改动。
新增 knowledge.filters.cross.test.tsx 三例（本体）。

## 名实与查重（引用不重写）

```text
无 ?source= 控件（source 仅空间行列标签）——未造控件；类型真实键 ktype（人话桶名），
旧 type 只读兜底、清除双删（KnowledgeModulePage :3549-3551/:3660-3670 实读）。
全局列表=kn6-search 面（行钮 kn-row-copy-<i>，q 本地过滤文件名）；空间详情=
?space= 查询态（kn3-docs/kn-type-*/-space- 钮族）；仅详情面有 knE-page-*。读口不吃
q/ktype：本地动作零请求实测（c0→c0）；documents 密钥集 {limit,spaceId} 引 R164①:142
不重写。引用：R118①②④（回填/一键保余参/单路非法不改写）、R146:111-119（双键共存
回填+both-keys 起链双删）、R157③④（非法 ktype 空态/cap 不渲染）、R164、R176②⑤
（churn 下命中面 data-len 计数不串面）、R213/R218。
新增维（点名）：① churn 下命中面**内容级**三快照逐字（行名数组+钮 id 序列+同一钮
复制文本重取互等——R176 只锁计数）；② 非法值**双路**（ktype=紫皮蒜桶 vs type=紫皮蒜桶）
同帧：两路 loc 逐字保留、kn3-docs+kn-type-empty+kn6-search 三锚同帧、kn-row-copy*
**两族**钮 0、两路空态句 toBe 互等（R118④ 单路单面）；③ **旧单键起链换桶**：
type=PDF 无 ktype → 点「表格」→ type 残留逐字+ktype 新写+行集随 ktype 优先链+余键
（含 type=PDF）逐字不动，回全部双删后余键恰 tab/panel/space/q（R146 只测双键起链；
单键起链写路径旧键残留态首次入锁）+ 面貌差异：type/ktype 全程不触检索面行名。
```

## 三例读数与验证尾行（R228）

```text
① ktype=PDF 详情面 [人事手册.pdf, 运维手册.pdf]；命中面 [人事手册.pdf, 人事表.xlsx]、
  钮 [0,1]、row0 复制文本切桶前后逐字互等；切「表格」后 ktype=表格、余键快照等、
  详情面换集 [人事表.xlsx]、urls c0→c0。② 双路 loc 均逐字保留（replace 对合成立）、
  kn-type-empty 在场且两路句 toBe 等、kn6-search 锚 0 命中帧仍渲染、两族钮 0/0、
  详情行 []。③ type=PDF 兜底回填详情 2 行/命中面 2 行不变；换桶后 type=PDF 残留 +
  ktype=表格 + 行集 [人事表.xlsx] + locExcept(ktype) 逐字等；全部双删后两键 null、
  余键恰 tab/panel/space/q、行集全量 3、urls c0→c0。
$ npx vitest run src/modules/knowledge → 45 files / 214 tests passed（211+3），
  grep unhandled = 0
$ eslint → 0 errors（1 既有 warning）；模块 tsc → 0；build /tmp/knw-r228-dist exit 0
$ 全仓 → 345 files / 3164 passed 全绿（无豁免、无已知红需点名）
$ 三档 1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn3*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort*/kn-gates/kn-row-copy*/
kn-row-copy-space*/kn-doc-copy*/kn3-page-cap/knE-page-*/kn-type*/kn7-preview*/导出
absent 标记 + 既有 44 套全绿。过程自纠一处（③ 期望串 q= 前缀笔误，产品侧零失败轮）。
```
未测如实：带登录会话真屏；检索面自身无类型桶控件（名实注记，跨面对齐不可测处按实记录）；
非法枚举下 knE-page-more 交互（cap 不渲染已由 R157 锁）；双路互等仅锁同夹具同 q 态。

# KNW5 追加 R229：分页态导出换代/三值直对/空筛归位文案（纯测试单·本体交付）（2026-11-21 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `f399482f`
（wave-71）、基线先跑 45/214 全绿 Errors 0、目标文件确认缺席再动笔。零产品文件改动
（③ 的「数字位 50」实测为归位语义的忠实报告，非缺陷，未改产品）。
新增 knowledge.export.paged.test.tsx 三例（本体）。

## 名实与查重（引用不重写）

```text
无真 CSV（createObjectURL/text/csv/a.download/new Blob 源级 0，R190①:113-119 不变量）
→「导出行」映射 knF-copy 数据行；分页只属详情面（knE-page-*）、行钮 -space- 族、
cursor 仅组件态——全部从请求 URL 断言（①实测 P2 请求恰 1 次且 loc 无 cursor）；
ktype 真实键、无 ?source= 控件未造；本地动作零请求。51 行跨页夹具（R216 先例：P1
恰 50 + 3 笔 xlsx 使「表格」桶在场）。
引用：R216① :134-148（四值计数+cap）、R216② :150-169（第 2 页态清全部代证——真换桶
+导出侧其时未测）、R216③ :171-183、R131① :115-125（切筛选归页 1）、R197① :135-155
（名链系单页小夹具）、R142① :124（单页三值）、R190（spy 形状 :35）、主套件 :3885
（空筛文案单页 2 笔版）、R114/R142 剪贴板拒绝（主套件 :2741 等）。
新增维（点名）：① 分页态 knF 首行/末行逐字直对（末行=追加行「卷 51」入链）+ 51 笔
全名链==表体名链（R216① 只数行数、R197 名链非分页）；② 第 2 页态**真换桶**（表格
3 笔）：导出集换新集、旧行「卷 51/卷 01」按标识从导出串出局、全程零新请求（「不带
cursor」现实=无新请求）——R216② 代证未看导出侧；③ 名筛筛空**同时归位页 1**：门句
数字位实测回落到 50（moreRows 被弃，与归位语义同帧；比派工预期「51」更贴产品事实，
按实锁），knF disabled + spy 0 + writeText 0 + urls 快照逐字不变。
```

## 三例读数与验证尾行（R229）

```text
① append 后 urls 含 cursor=cpg2 请求恰 1、loc 无 cursor；三值 [表体 51, 钮 51, knF 51]、
  首行名 toBe 屏上首行、末行 toBe「卷 51.pdf」、全名链 toEqual。② 切表格桶：屏上 3 笔
  全 xlsx、导出名链 toEqual 屏上集、text 不含 卷 51.pdf/卷 01.pdf、urls.join 逐字==u0、
  loc 含 ktype=。③ 筛空前 51 行在场；筛空后 disabled=true、title 含「有 50 份文档」
  （归位实态）、空点击 writeText 0、createObjectURL 0、urls 快照不变。
$ npx vitest run src/modules/knowledge → 46 files / 217 tests passed（214+3），
  grep unhandled = 0
$ eslint → 0 errors（1 既有 warning）；模块 tsc → 0；build /tmp/knw-r229-dist exit 0
$ 全仓 → 349 files / 3175 passed 全绿（无豁免、无已知红需点名）
$ 三档 1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn3*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort*/kn-gates/kn-row-copy*/
kn-row-copy-space*/kn-doc-copy*/kn3-page-cap/knE-page-*/kn-type*/kn7-preview*/导出
absent 标记 + 既有 45 套全绿。过程自纠一处（③ 数字位按派工预期写 51 首跑红，查实
combined/门句同源归位语义后按实测 50 锁并补「筛空前 51 在场」哨兵防代证空转）。
```
未测如实：带登录会话真屏；名筛归位后 nextCursor 是否仍可从 -more 续第 2 页（R216②
只锁清全部路径，本轮未扩）；kn3-page-cap 在「筛空」帧的渲染与否未查（不在本单腿内）。

# KNW5 追加 R230：抽屉打开态 × 导出数据行同帧护栏（纯测试单·本体交付）（2026-11-21 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `e2ef3793`
（wave-73）、基线先跑 46/217 全绿 Errors 0、目标文件确认缺席再动笔。零产品文件改动。
新增 knowledge.preview.export.parity.test.tsx 三例（本体）。

## 名实换算与查重（引用不重写）

```text
无真 CSV（源级四件套 0、data-export="absent" ×4——R190①:113-119）→「导出行」= knF-copy
数据行；「预览打开态」= kn7 抽屉（?doc=，行名点击开；详情读失败抽屉仍开——R196③ 夹具
同法，导出侧只依赖列表数据，已注记）；行钮 -space- 族（详情面）；kn-doc-copy 非行数。
**第③腿换算（红线④）**：kn3-page-cap 在 true-0/error 态不渲染（R108/R157/R187 锁）→
派工「cap 仍如实」不成立，按产品断言两态当帧 cap null 并在此记录。
引用：R216①/R197①（五读链）、R229①（分页首末行）、R142①:124（单页三值·非预览帧）、
R190④:190-205（空集内容面 disabled+title+零写+零请求+spy 0）、R196③:104-124（标题随换
+详情读各恰 1+列表集合引 R149④）、R222/R223/R200/R214②。
新增维（点名）：① 抽屉打开帧三值同帧 + knF 首行逐字==屏上首行 + 导出文本与开抽屉前
快照逐字互等（R142① 非预览帧）；② a→b 换档**导出内容级逐字不变** + 请求按现实非零：
换档增量实测恰 1（d_b×1，不重读 d_a——比 R196③ 各恰 1 更精的增量口径）+ 列表读集合
逐字不动；③ 错误站（列表 500）复制侧 disabled+title+点击零写/零 blob/零请求（R190④
仅空集站，错误站复制钮模块套件此前无 pin）+ 双态 cap 缺席当帧复跑（换算位）。
```

## 三例读数与验证尾行（R230）

```text
① 抽屉开（loc 含 doc=d_a、kn7-preview-title 在场）：三值 [表体 2, 钮 2, knF 2]、
  首行 toBe 屏上首行、knF 全文 toBe 开抽屉前快照。② 换 B：标题在场、knF 全文逐字==
  textA、表体名序 toEqual、urls 4→5（恰 +1 全为 d_b）、列表读 join 逐字==基线。
  ③ true-0：cap null、knF disabled、title 含「没有可复制」、点击 writeText 0、urls 不变；
  error 站：cap null、disabled、title 非空（原因句在位，逐字句不扩）、点击零写零请求、
  createObjectURL 全帧 0。
$ npx vitest run src/modules/knowledge → 47 files / 220 tests passed（217+3），
  grep unhandled = 0
$ eslint → 0 errors（1 既有 warning）；模块 tsc → 0；build /tmp/knw-r230-dist exit 0
$ 全仓 → 353 files / 3185 passed 全绿（无豁免、无已知红需点名）
$ 三档 1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn3*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort*/kn-gates/kn-row-copy*/
kn-row-copy-space*/kn-doc-copy*/kn3-page-cap/knE-page-*/kn-type*/kn7-preview*/
kn-doc-preview* + 既有 46 套全绿。过程自纠两处（误写重复 globalThis 行删除；② 预期
「+2」首跑红，实测换档只重读新档 +1，按实锁并补强注释），产品零触碰。
```
未测如实：带登录会话真屏；详情读**成功**时的抽屉体字段链（R125/R196 族已锁，本轮导出
侧不依赖详情体，按 404 夹具开抽屉并注记）；error 站 title 的具体整句逐字（只锁非空+
在场性，全句属 R138 族地盘不扩）。

# KNW5 追加 R231：空/错态导出复制同帧收紧 + 筛空恢复三值链（同文件追加·本体交付）（2026-11-21 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `9a410487`、
基线先跑 47/220 全绿 Errors 0。**目标文件已存在（R215 193 行 3 例）→ 按派工纪律同文件
追加，不重建不覆盖不另起同名文件**；最终 273 行 5 例（+80 行）。零产品文件改动。

## 三腿比对与名实换算（引用不重写）

```text
① 空面：cap null/双 disabled/title/零请求/spy 0/计数位「—」——R215②:98-123 全覆盖 →
  引用；本轮只补未锁位：knG-copy title 在场（R215② 只锁 knG disabled）+ 空态点击**零
  写**（R215② 未桩剪贴板）。
② rid 复制（检索面 R215④:125-155、详情面 R210）与错误站 knF disabled+title 帧
  （R230③）→ 引用；本轮新增：**同面锚互斥**（空帧 kn3-docs-error null / 错帧
  knN-empty-text-space-docs null——R187② 锁的是跨面不卸载，同面互斥此前无 pin）+
  错误帧 -space- 钮族 **0 节点**（红线④「非 disabled 是不渲染」的详情面当帧实锁）+
  空帧双族钮 0。
③ 清筛选：R215③:157-192 只链到「钮==行」两值 → 本轮**第三值 knF 导出行数入链**
  （三值 toEqual [2,2,2]）+ 恢复后首行==屏上首行（序无关，证全量非筛中残留）。
换算（红线②）：派工「createObjectURL 只在恢复后调用」**不可兑现**——无导出机制
（R190① 不变量），按现状断言**全程 0 次**并在此记录；换算（红线③）：cap「显 0 不显
—」不可兑现——空/错态不渲染（R108/R157/R187），禁假 0 落点换成计数位「—」（R215 已
锁位引用）+ 裸 0 扫描（R215②:111 引用）。红线⑦收紧一处：文件级 afterEach 补
vi.unstubAllGlobals()（纪律位，不动任何既有断言）。
```

## 验证尾行（R231）

```text
⑤ 空帧：空锚在场、错锚 null、-space- 钮 0、检索族钮 0、knG title 含「没有可复制」、
  双击 writeText 0、urls 不变；错帧：错锚在场、空锚 null、-space- 钮 0 节点、spy 0。
  ⑥ 筛中 1 行→清空复原：三值 [2,2,2]、首行逐字==屏上首行、spy 0、urls 快照逐字==u0。
$ npx vitest run src/modules/knowledge → 47 files / 222 tests passed（220+2），
  grep unhandled = 0
$ eslint → 0 errors（1 既有 warning）；模块 tsc → 0；build /tmp/knw-r231-dist exit 0
$ 全仓 → 355 files / 3191 passed 全绿（无豁免、无已知红需点名）
$ 三档 1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn3*/kn6–kn9/knB/knD/knF/knG/knI/knL/kn-sort*/kn-gates/kn-row-copy*/
kn-row-copy-space*/kn-doc-copy*/kn3-page-cap/knE-page-*/kn-type*/kn7-preview*/
kn-doc-preview*/导出 absent 标记 + R215 既有三例复跑同绿（断言零改动，仅 afterEach
+1 行纪律位）。两例一次全过；产品零触碰。
```
未测如实：带登录会话真屏；denied 帧锚互斥（本轮只打 empty/error 两帧，denied 与
error 同族由 R187 口径外推、未实锁）；⑤(b) 错误帧 sort 头禁用整句（红线④点名引用
R210/R187，不扩）。

# KNW5 追加 R232：抽屉错误态 × 导出隔离护栏（纯测试单·本体交付）（2026-11-21 BJT）

安全门：porcelain 空起做、显式 refspec fetch 后 merge 实测 tip 即预期 `cafd2d81`
（wave-75）、基线先跑 47/222 全绿 Errors 0、目标文件确认缺席再动笔。零产品文件改动。
新增 knowledge.detail.error.export.test.tsx 三例（本体）。

## 名实换算与查重（引用不重写）

```text
「详情」=kn7 抽屉（?doc= 深链；每开恰 1 详情读——R49/R196）；**404 走 unwired 分支**
（kn7-preview-unwired、error 锚 null——R183①②:126-128 锁的锚名，本例沿用）；无真 CSV
（四件套源级 0——R190①:113-119，本轮 spy 全帧 0）→「导出」=knF-copy 数据行；行钮
-space- 族；kn-doc-copy 非行数。①「翻页/排序仍可用」腿由 R221②:149-166 锁 → 引用，
本文件把该窗推进 M=51 三值 + 导出全文互等（导出侧新位）。**③「换代」不成立（红线⑤）**：
重试只读详情、列表不动——按实断言导出文本逐字==重试前快照 + 列表读集合逐字不动 +
详情读 1→2（计数引 R183③:135-158），禁造列表刷新，文件头与本节双记录。
引用：R183①②:107-133/③:135-158/④（错误态行内复制钮 ENABLED 现实位）、
R221①:133/②:149-166/③（重试增量 [P1URL] 列表腿）/④:193（双失败 cap 过渡）、
R230①:133-152（无故障抽屉三值）、R231⑤⑥（空/错帧互斥与三值链）、R216（51 行夹具）、
R210/R211/R142/R190。
新增维（点名）：A 抽屉 500 窗 × 追加至 M=51：三值 [51,51,51]+首行逐字==屏上首行+
  错误帧导出全文 toBe 干净帧同数据快照（零传染跨渲染互等）；
B 抽屉 404(unwired) 帧：cap 整句逐字==开抽屉前快照（R183 只锁在场性、R231③ 锁列表
  故障帧 null——健康列表×抽屉故障的「不动性」首次）+ knF disabled=false 实锁 + 点击
  写满 50 行三值 + 文本与干净帧逐字互等；
C 重试成功后导出文本逐字==重试前（红线⑤换算位）+ 列表读 join 逐字不动 + 详情读恰 +1。
```

## 三例读数与验证尾行（R232）

```text
① DRAWER 挂载即 500：kn7-preview-error 在场、kn3-docs-error null；窗内 -more 追加
  P2 恰 1 次 → 51 行；knF [51,51,51]、lines[0]==首行；干净帧同数据导出逐字==errText。
  ② 健康帧 cap 含「本页最多显示 50 篇（当前已加载 50 篇；复制清单也只含这些篇）」
  （-more 子文本允许并入）；404 帧 unwired 在场、error null、cap toBe 快照、knF 不
  禁用、三值 [50,50,50]、文本逐字==text0。③ 重试：锚消失、详情读 1→2、listUrls 逐字
  ==、导出逐字==text0、表体 50 不动。createObjectURL 三帧全 0。
$ npx vitest run src/modules/knowledge → 48 files / 225 tests passed（222+3），
  grep unhandled = 0
$ eslint → 0 errors（1 既有 warning）；模块 tsc → 0；build /tmp/knw-r232-dist exit 0
$ 全仓 → 358 files / 3200 passed 全绿（无豁免、无已知红需点名）
$ 三档 1440/1280/375 vw==bodySW==docSW 全等（用毕即杀）
零破：kn3*/kn6–kn9/knB/knD/knE-page-*/knF/knG/knI/knL-copy*/kn-row-copy*/
kn-row-copy-space*/kn-doc-copy*/kn-doc-preview*/kn7-preview*/kn3-page-cap/kn-sort*/
kn-type*/kn-gates/kn-space-preview*/导出 absent 标记 + 既有 47 套全绿。过程自纠两处
（② 首跑按 error 锚断言 404 帧——查实 R183 unwired 分支后按实锚修；未用辅助 okDetail
触发 eslint/tsc 双红，删后复绿），产品零触碰。
```
未测如实：带登录会话真屏；404×重试成功过渡（③ 用 500 重试链，unwired 态是否有重试钮
未查——R183④ 域外不扩）；抽屉 500 窗内改排序后导出与排序态同序的链（R221② 锁翻序零
请求、R214 锁列标准，本轮未叠）。
