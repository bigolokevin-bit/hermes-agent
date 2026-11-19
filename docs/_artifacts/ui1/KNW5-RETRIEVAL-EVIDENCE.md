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
