# Q7 · 知识三屏（库 / 来源 / 引用）核验交付

写域：`hermes-agent` → `web/src/modules/knowledge/**`
结论：**三屏已实现并接既有 BFF，无 fixture；本次零代码改动，交付为验证证据。**

---

## 0. 基线与新鲜度自证

分支自当拍 origin 现取，未使用陈旧 remote-tracking 判断。

```
$ git worktree add /Users/kevin_studio/Projects/tasks/Q7-kb-screens -b task/Q7-kb-screens origin/lane/hermes-console
$ git rev-parse --abbrev-ref HEAD
task/Q7-kb-screens
$ git rev-parse HEAD
571011616189edbb153c6fd2203c03882a2f9f39
$ git status --porcelain
（空）
```

- 集成分支：`origin/lane/hermes-console`（**创建基线** `571011616189edbb153c6fd2203c03882a2f9f39`）
- 本分支：`task/Q7-kb-screens`
- 核验期间本机 tracking ref 已随他人 fetch 推进到 `42dcd7983f56ec39fbdaf5aac92841b6b1816d38`（我落后 18 个集成交付单），故一并核对了「我的结论对当前集成 tip 是否仍成立」：

```
$ git merge-base --is-ancestor 5710116 42dcd798 ; echo $?
0                       # 我的基点仍是集成线祖先
$ git rev-list --count 5710116..42dcd798
18
$ git diff --stat 5710116 42dcd798 -- web/src/modules/knowledge
（空）                   # 三屏代码在两者之间零改动 ⇒ 结论对当前集成 tip 同样成立
```

- 未做 rebase/merge（合并与验收不归本车道）。
- node_modules 未安装，沿用符号链接（禁 `npm install`）：
  `node_modules -> forks/hermes-agent/node_modules`、`web/node_modules -> forks/hermes-agent/web/node_modules`

---

## 1. 工单现状盘点（命令原始输出）

```
$ echo "files_total=$(ls web/src/modules/knowledge | wc -l | tr -d ' ')"
files_total=88
$ echo "test_tsx=$(ls web/src/modules/knowledge/*.test.tsx | wc -l | tr -d ' ')"
test_tsx=77

$ grep -rn "fixture\|mockData" web/src/modules/knowledge --include=*.ts --include=*.tsx
web/src/modules/knowledge/KnowledgeModulePage.test.tsx:580:    expect(attr("knw5-page", "data-fixture")).toBeNull();
web/src/modules/knowledge/KnowledgeModulePage.test.tsx:951:    expect(attr("knw5-page", "data-fixture")).toBeNull();
web/src/modules/knowledge/KnowledgeModulePage.test.tsx:1739:  it("?state=ready is live data, not a fixture", async () => {
web/src/modules/knowledge/knowledge.ts:25: * fabricates a row, a count or a sample, no fixture stands in for a missing read, and
web/src/modules/knowledge/knowledge.counts.parity.test.tsx:148:  it("② same fixture, both faces comparable: detail rows are the honest subset; first-column texts byte-equal row by row", async () => {
web/src/modules/knowledge/KnowledgeModulePage.tsx:8: * sample row, no invented count, and no forced fixture badge: the four states
FIXTURE_HITS=6            # 6 条全部是「反例声明/断言」（数据 attribute 必为 null、单测名、注释），零条 fixture 数据源

$ grep -n "SPACES_URL\|DOCUMENTS_URL\|RECORDS_URL\|CITATIONS_URL\|TASKS_URL\|UNWIRED_HEAD" web/src/modules/knowledge/knowledge.ts
106:export const SPACE_DOC_UNWIRED_HEAD = "空间不存在或未授权";
110:export const SPACES_UNWIRED_HEAD = "知识空间未接入";
119:export const TASKS_UNWIRED_HEAD = "数据源接入读口未接入";
123:export const INGEST_STATUS_UNWIRED_HEAD = "入库状态未接入";
131:export const SEARCH_UNWIRED_HEAD = "检索未接入";
139:export const DOC_DETAIL_UNWIRED_HEAD = "文档详情未接入";
143:export const DOCUMENTS_UNWIRED_HEAD = "文档登记读口未接入";
164:export const SPACES_URL = "/agent-api/api/knowledge/spaces?limit=20";
177:export const DOCUMENTS_URL = `/agent-api/api/documents?limit=${DOCUMENTS_LIMIT}`;
219:export const RECORDS_URL = "/agent-api/api/audit?action=kb.read&limit=50";
227:export const CITATIONS_URL = "/agent-api/api/knowledge/citations?limit=20";
239:export const TASKS_URL = "/agent-api/api/knowledge/sources?limit=20";

$ ls -ld node_modules web/node_modules
node_modules -> /Users/kevin_studio/Projects/forks/hermes-agent/node_modules
web/node_modules -> /Users/kevin_studio/Projects/forks/hermes-agent/web/node_modules
```

证据文件：`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/q7-evidence3.txt`、`q7-evidence4.txt`

`KnowledgeModulePage.tsx` 共 4060 行；`knowledge.ts`（URL 与文案常量）、`sourceReads.ts`（读口适配）、`knowledge.css` 同目录。

---

## 2. 实况与工单差异（关键判定）

工单假设「三屏需新建并接线」。实况：**三屏（库 / 来源 / 引用）已在 `knowledge` 模块内实现，四个内层面板齐全，数据全部走真实 BFF 路径，无任何 fixture/样例数据。**

- 外层三入口（命名不得与内层撞名）：`知识空间` / `数据源` / `证据与引用`
- 内层四面板（`?panel=` 可寻址）：
  | 面板 | 文案 | `?panel=` |
  |---|---|---|
  | 空间台账 | 知识空间 | `spaces` |
  | 数据接入 | 数据源 | `ingest` / `sources` |
  | 检索 | 检索 | `retrieval` / `search` |
  | 运行事件引用 | 证据与引用 | `evidence` / `citations` |
- 请求统一走 `fetchJsonStrict`（`@/modules/models/fetchJson`）+ `ApiError`，无 mock 分支。
- 「无口处显式未接」由两层保证：
  1. 前端 `knowledge.ts` 的 `*_UNWIRED_HEAD` 显式文案（`SPACES_UNWIRED_HEAD`「知识空间未接入」、`TASKS_UNWIRED_HEAD`、`INGEST_STATUS_UNWIRED_HEAD`、`SEARCH_UNWIRED_HEAD`、`DOC_DETAIL_UNWIRED_HEAD`、`DOCUMENTS_UNWIRED_HEAD`）；
  2. BFF 侧 `sekoi-agent-os/apps/console/server.py` 的 `_KNOWLEDGE_NOT_WIRED_ROUTES = {/api/knowledge/spaces, /api/knowledge/sources, /api/knowledge/citations}` 精确匹配返回 `404 {"code":"knowledge.not_wired","message":"本环境未接入知识库读口"}`（鉴权门先于此），前端据此渲染「未接入」而非样例。

### 三屏 ↔ BFF 端点对应

| 屏 | 主读口 | 旁证读口 | 无口时表现 |
|---|---|---|---|
| 库（知识空间） | `GET /agent-api/api/knowledge/spaces?limit=20` | — | 404 `knowledge.not_wired` → 「知识空间未接入」 |
| 来源（数据源） | `GET /agent-api/api/knowledge/sources?limit=20` | `GET /agent-api/api/documents?limit=N` | 404 `knowledge.not_wired` → 「数据源接入读口未接入」/「文档登记读口未接入」 |
| 引用（证据与引用） | `GET /agent-api/api/knowledge/citations?limit=20` | `GET /agent-api/api/audit?action=kb.read&limit=50` | 404 `knowledge.not_wired` → 「检索未接入」/「运行事件引用」空态 |

---

## 3. 改动

**无代码改动。** 本分支唯一新增文件为本 `DONE.md`。

理由：DoD 三条（接既有 BFF / 无口处显式未接 / 不许 fixture）现状已全部满足，任何代码改动都会超出 Q7 写域目标或重复既有实现。

---

## 4. 测试原始输出

```
$ cd web && ./node_modules/.bin/vitest run src/modules/knowledge --reporter=dot
…
 Test Files  80 passed (80)
      Tests  312 passed (312)
   Duration  7.78s
$ echo $?
0
```

- 日志：`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/q7-vitest.log`
- 日志内 `Not implemented: navigation to another Document` 为 jsdom 噪音，非失败。

---

## 5. 截图取证

### 5.1 认证态三屏：**NOT MEASURED**（原始证据如下，未伪造）

```
$ node /private/var/folders/…/opencode/q7-shots.cjs
BASE=http://127.0.0.1:9122/agent-v2
auth-state=~/.local/state/sekoi-ops/ui-qa-auth-state.json (access_token_cookie)
cookie domain rewrite: 100.117.184.117 -> 127.0.0.1:9122
fetch /auth/whoami -> 401
NOT_MEASURED reason=whoami_401
SHOT_EXIT=3
```

根因（磁盘证据）：

- 该 auth-state 内 JWT `exp=2026-11-23T01:12:26Z`，取图时刻为 2026-11-23T10:59Z，**已过期**。
- 本机仅存两份 state：`ui-qa-auth-state.json`（01:12Z 过期）与 `v4-auth-state.json`（11-20 过期），无任何未过期登录态。
- 本机无 opsadmin 凭据（口令 24h 轮换、无凭据文件），viewer01 无控制台入口权限 ⇒ 无法现签 cookie。
- 已知坑：`storageState` 内 cookie domain 与目标 host 不一致会**静默匿名**，故脚本先改写 domain 并紧贴 `whoami==200` 断言，未过则不出图（避免匿名伪像当认证态证据）。

### 5.2 匿名态留证图（真实渲染，非 fixture）

- 路径：`/private/var/folders/2b/bnpsyz450pn98w375q_803yw0000gn/T/opencode/q7-shots/kb-anon-spaces.png`
- 尺寸/字节：1440×900 视口图，131,734 bytes
- 页面实读（第三方读图描述，逐字引用关键文案）：
  - 左栏含「知识与数据」高亮；面包屑「治理 · 控制台」+ 页面名「知识与数据」
  - 页签「知识空间」（选中）/「数据源」/「审计证据」；子页签「空间台账」（选中）/「数据接入」/「检索」/「运行事件引用」
  - 顶部橙红警示横幅：「**会话已过期，请重新登录后继续。**」（含「重新登录」按钮）
  - 各块诚实降级态：「需要登录」「登录状态已经失效，重新登录后就能再看这块知识数据。」「这次没有读到数据，数据截至时间未知。」「当前不可复制：登录状态已经失效」
  - **无骨架占位条、无样例数字、无 fixture 数据**

即：无登录态时三屏呈现的是「显式未接 / 需要登录」的诚实空态，符合 DoD 第二条；认证态的真数据取图因登录态过期而 NOT MEASURED。

### 5.3 playwright 环境坑（供后续车道复用）

- playwright 包在 `web/node_modules/playwright`（1.64.0，CJS `index.js`），默认索要 `chromium_headless_shell-1248`（本机无）。
- 本机实装 `1255`，必须显式：
  `chromium.launch({ executablePath: '/Users/kevin_studio/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell' })`

---

## 6. 边界自查

```
$ git status --porcelain
?? DONE.md
```

- 写域内仅 `web/src/modules/knowledge/**` 与本文件；未触碰 Q6 / Q8 其它 worktree。
- 未安装依赖、未改构建配置、未碰 `9122` 服务（只读访问）。

---

## 7. 交付

- 分支：`task/Q7-kb-screens`
- 创建基线（`origin/lane/hermes-console` 当时 tip）：`571011616189edbb153c6fd2203c03882a2f9f39`；核验期该集成分支已推进到 `42dcd798`（知识模块零 diff，见 §0）
- 提交 message：`docs(q7): knowledge screens verification evidence (zero-code)`
- push 目标：`git push origin task/Q7-kb-screens:refs/heads/task/Q7-kb-screens`
- 推送后的 tip sha 与定向 ref 回读结果见会话回执（本文档不能内嵌自身提交 sha；此节不预勾）。