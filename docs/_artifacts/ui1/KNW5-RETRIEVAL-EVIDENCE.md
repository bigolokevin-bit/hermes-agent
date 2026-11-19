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
