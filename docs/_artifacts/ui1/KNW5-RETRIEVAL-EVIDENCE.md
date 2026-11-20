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
