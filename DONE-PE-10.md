# DONE-PE-10 人员目录服务端搜索 + org 树搜索

分支 `task/PE-10-search-server`，基线 HEAD `689e8d46d1f87b35fa6e5035eacae0257ffe0b66`（= live face）。
写域：`web/src/modules/people/PeopleModulePage.tsx`、其测试件 + 新增 `people.search.chain.test.tsx`、
`web/src/modules/org/OrgModulePage.tsx`、`OrgModulePage.test.tsx`、`org.css`。
employees / employee-detail / duty / approvals / shell / 主仓 = 零触碰（见文末 git 台账）。

---

## 1. opsadmin 真登录腿 curl 实测（原始 JSON，全部落 `evidence/`，未提交）

链路：curl → console BFF `127.0.0.1:8092`（`bff-v4-serve/apps/console/server.py`，pid 740 LISTEN 实测）。
鉴权：`Authorization: Bearer $(cat ~/.seakoi/opsadmin-token.txt)`（同一 token 带
`Cookie: access_token_cookie=` 亦 200，两条腿都验过）。

打的路由 = 前端实际读取路由 `/api/employees`（`server.py:42` 白名单行
`GET /api/employees?keyword=&lifecycleState=&limit=&cursor=`，转发上游 `/v1/employees`）。
未打任何不存在的路由；org 侧三根候选逐一实测（见 §1.4）。

### 1.1 首页无关键词 — `evidence/pe10-page1.json`

```
$ curl -s -H "Authorization: Bearer <opsadmin>" "http://127.0.0.1:8092/api/employees?limit=20"
top-keys ['items']  count 3  nextCursor None  total None
  0 emp_217A91BA995044DFBB3E2E940B  QA2 契约验证 1794894768
  1 emp_86A81CE8FF6F42E187BCF2B540  AgentOS 产品助理
  2 emp_0166858D562149938FBDA22649  AgentOS 产品助理
```

**现网在册员工台账存量 = 3 人**（不是 20+）。这条读数直接决定了 §5 偏差 D-1。

### 1.2 keyword 服务端真过滤 — `evidence/pe10-kw-qa2.json` / `pe10-kw-miss.json` / `pe10-kw-percent.json`

```
?limit=20&keyword=QA2            → keys ['items'] n=1  ['QA2 契约验证 179489476…']
?limit=20&keyword=不存在无此名    → keys ['items'] n=0  []
?limit=20&keyword=%              → keys ['items'] n=0  []   ← 通配符按字面处理，未退化成 LIKE 全命中
```

同一 limit 下 3→1→0 的变化只可能发生在服务端：**keyword 是真过滤参数，不是本地切片**。

### 1.3 游标链 — `evidence/pe10-page-l1.json` / `pe10-page2-l1.json`

```
?limit=1                    → items[0]=QA2…, nextCursor=eyJjcmVhdGVkQXQiOiIyMDI2LTExLTE3VDA1OjUyOjQ4LjAzMFoiLCJpZCI6ImVtcF8yMTdBOTFCQTk5NTA0NERGQkIzRTJFOTQwQiJ9
?limit=1&cursor=<上面那个>  → items[0]=AgentOS 产品助理（第 2 名）, nextCursor=eyJjcmVhdGVkQXQiOiIyMDI2LTExLTEzVDIyOjE1OjExLjY0MVoiLCJpZCI6ImVtcF84NkE4MUNFOEZGNkY0MkUxODdCQ0YyQjU0MCJ9
```

跨页关键词（首页窗口外的行可被检索命中）— `evidence/pe10-kw-boundary-p1.json` / `pe10-kw-boundary-p2.json`：

```
?limit=1&keyword=产品助理   → n=1 ['AgentOS 产品助理'] next=True     ← 第 1 页给的是台账第 2 名
?limit=1&keyword=产品助理&cursor=<p1.nextCursor> → n=1 ['AgentOS 产品助理'] next=False   ← 台账第 3 名
```

即：**命中结果不落在无关键词首页窗口内**，`keyword` 是在全量上算的，游标链能把命中行逐页取回。

### 1.4 org 三根候选（`OrgModulePage.tsx:228-232` 实际读取路由）

```
GET /api/v1/departments → 404 {"code":"departments.read_not_wired",
  "message":"该读口尚未接入：部门名册无可用上游端点，归 L0/BFF 读口","asOf":"2026-11-23T19:12:24Z"}
GET /api/v1/dept/list   → 404 {"code":"console.unknown_route"}
GET /api/v1/dept/tree   → 404 {"code":"console.unknown_route"}
```

原文落 `evidence/pe10-org-*.json`。结论：部门树在现网是**未接入**态（不是本卡能改的读口），
所以 org 搜索的活体取图不可得，见 §5 偏差 D-2。

---

## 2. 实装

### 2.1 PeopleModulePage（①③④⑤）

* 删掉 `limit=20` 写死 + 本地 `roster.filter(...)` 切片；候选端点表改成 base 路径
  （`PEOPLE_ENDPOINTS` 三项，第三项 `/agent-api/api/employees`），每页请求由
  `pageUrl(base, keyword, cursor)` 生成：`?limit=20` + 非空才带 `keyword=` + 续页才带 `cursor=`。
* `usePeopleRoster(nonce, enabled, debounced)`：300ms 防抖后的关键词进依赖；
  `generation` 号让关键词/刷新作废在途请求（旧游标页迟到也不写回列表）；
  `sourceIndex` ref 在挂载内记住命中端点 → 换关键词不重跑探针链，
  一个防抖窗恰好 1 根检索请求；`inflight` 门保证翻页在途时不并发第二根游标。
* 游标续页钮 `ppl5-more`：只用服务端 `nextCursor`，在途 `disabled + aria-disabled + title` 原因，
  到末页（nextCursor 为 null）钮消失；追加按记录号去重。
* 三态可辨（③）：`ppl5-unwired`（未接入，GAP-02 只在 title）/
  `ppl5-nomatch`（检索空，句子里写明「服务端已在在册全量里检索……不是只翻过已加载的 20 行」+ 清空主操作）/
  `ppl5-empty`（真为空，无关键词且台账 0 行），三条腿互斥。
* 口径句（④）：新增 `ppl5-scope-note`
  「搜索为服务端检索在册全量（关键词随请求上送，翻页走服务端游标），不是本地过滤已加载行。」；
  来源注记 `ppl5-source` 的台账口径保留；计数句按状态分「共 N 人 / 已加载 N 人（在册更多，可继续加载）/ 检索命中 N 人」。
* 列在场性仍是**数据源**属性：`Roster.shape`（`shapeOf()`）在无关键词的整册读取时定档，
  换关键词的重置只清行与游标、保留 shape，检索子集不得让整列闪没（P0-4 口径保留）。
  形制判定走响应数据本身，不在 render 期读写 ref。
* 搜索框补 `aria-label="搜索人员"`。

### 2.2 OrgModulePage + org.css（②③）

* 头部新增 `org5-search`（`type=search`，`aria-label="按部门名搜索"`），仅在树 ready 且非预览态渲染。
* `locateHits()`：命中节点 + 其全部祖先进展开集；`visibleCollapsed` 由展开集扣减，
  因此 `aria-expanded` 是**真态**（渲染与属性同源，用户手动收起的无关分支不被波及）。
* 高亮禁 innerHTML：`highlightName()` 用 `indexOf` 分段，命中片段渲染成
  `<mark className="org5-hit">` 文本节点；命中行加 `data-hit="true"` + `.org5-node-hit`。
* `org5-search-note`「命中 N 个部门，已自动展开所在路径。」；
  无命中走 `org5-nomatch` 腿（原因句 + 单主操作 `org5-search-clear`「清除搜索」）。
* 树搜索是已加载树上的本地定位（部门读口没有检索参数，§1.4 实测 404），键入零新请求。
* CSS 只吃主题令牌（`--color-warning/--color-muted/--color-border/--radius-*`），
  ≤720 工具条换行、搜索框吃满剩余宽度、刷新钮仍整行（`.org5-tools > button` 补进既有规则）。

---

## 3. 门禁（原始 stdout）

### 3.1 点名件（基线 4 件/45 例 → 只增不减）

```
$ cd web && node_modules/.bin/vitest run src/modules/people src/modules/org
rc=0
 Test Files  5 passed (5)
      Tests  56 passed (56)
   Duration  1.31s
```

新增/扩展的搜索链测试：

* `src/modules/people/people.search.chain.test.tsx`（新增 6 例）
  1. 防抖：连打 5 字在 300ms 窗内 0 请求，过窗恰好 1 根 `keyword=` 请求；
  2. 首页只带 `limit=20` 不带 keyword，命中第 21+ 名靠服务端 keyword（25 行台账假服务端，`员工021` 可搜到）；
  3. 游标链：加载更多恰 1 根 `cursor=c%3A20` 续页，25 行齐，末页无钮；
  4. 翻页在途换关键词：钮在途 disabled、全程只有一根（已作废的）游标请求 + 1 根 keyword 请求，
     迟到的旧游标页不污染检索结果；
  5. 三态互斥：未接入 / 检索空 / 真为空 各自专属腿与原因句；
  6. 清空搜索只发 1 根无关键词请求。
* `src/modules/people/PeopleModulePage.test.tsx`：`column presence is a property of the source,
  not of the search filter` 改写为服务端 keyword 形制（假服务端按 `keyword=` 过滤），
  并新增断言「最后一根请求 URL 含 `keyword=%E9%98%BF%E6%BE%9C`」。
* `src/modules/org/OrgModulePage.test.tsx`：新增 `PE-10 组织树按名搜索` 5 例
  （祖先路径自动展开 + 命中节点 `aria-expanded=true`；`mark.org5-hit` 高亮与命中计数；
  无命中腿 + 清除后树回来且零新请求；未接入腿不出现搜索框；可及名称 + 无关支不受影响）。

### 3.2 全量

```
$ cd web && node_modules/.bin/vitest run src
 Test Files  1 failed | 533 passed (534)
      Tests  1 failed | 4076 passed (4077)
 FAIL  src/shell/e1Contract.test.ts > verifies the acceptance face when both sides exist…
 AssertionError: served entry drifted from the dist on disk:
   expected 'assets/index-BoWDBxUF.js' to be 'assets/index-CuFf78vV.js'
```

唯一红 = `e1Contract`（9122 在架脸与本 worktree dist 入口换代差，环境红单列，禁消解，本卡未动它）。

### 3.3 构建 / 假成功闸 / 类型

```
$ cd web && node_modules/.bin/vite build
build-exit=0
✓ built in 6.05s
（未用 pnpm run build；tsc -b 的既有 49 错与本卡无关，见下）

$ node web/scripts/lint-fake-success.mjs
{"script":"lint-fake-success","file":"docs/console-v4-skeleton.html","linesScanned":9252,
 "allowedInfo":{"规划中":188,"不会保存":1,"未接入":22},"violations":[],"ok":true}
lint-exit=0

$ cd web && node_modules/.bin/tsc -p tsconfig.app.json --noEmit
error TS 计数 = 49（= 基线，delta 0）
写域（modules/people / modules/org）命中 = 0

$ pnpm exec eslint src/modules/people/PeopleModulePage.tsx src/modules/org/OrgModulePage.tsx \
      src/modules/people/people.search.chain.test.tsx
✖ 3 problems (0 errors, 3 warnings)
  # PeopleModulePage.tsx:56  react-refresh/only-export-components（既有：本件导出 PEOPLE_* 常量，形制未变）
  # PeopleModulePage.tsx:288 / OrgModulePage.tsx:289  react-hooks/set-state-in-effect
  #   （与两件既有 loader 同形制：进 loading 档再取数；org 那条是本卡未触碰的原代码行）
```

---

## 4. 截图（build 产物 + 临时反代 + opsadmin 腿）

脚本 `evidence/pe10-shoot.mjs`（ap01-shoot 形制）：本 worktree `vite build` 产物
（`hermes_cli/web_dist`）经临时 `l7-ops/ops/v4_proxy.py` 于 **127.0.0.1:9377**（自选 loopback，
跑前 `lsof` 确认无 LISTEN；9122/9341/9351 及一切在听端口拉黑）同源提供并反代 `/agent-api→8092`；
`domcontentloaded` + settle 2.2s（禁 networkidle）；**每图前断言 `/auth/whoami==200`**；视口图非 fullPage；
收尾按 pid 精确 kill（`proxy killed by pid 52601`，跑后 `lsof -iTCP:9377` 空）。

```
whoami=200 user=opsadmin
首屏已加载行=3  请求=/agent-api/api/employees?limit=20
检索命中=["AgentOS 产品助理 · BCF2B540","AgentOS 产品助理 · BDA22649"] 检索请求数=1
  /agent-api/api/employees?limit=20&keyword=%E4%BA%A7%E5%93%81%E5%8A%A9%E7%90%86   （HTTP 200）
口径句=搜索为服务端检索在册全量（关键词随请求上送，翻页走服务端游标），不是本地过滤已加载行。
计数句=在册人员名录 · 姓名 / 部门 / 状态 · 检索命中 2 人
```

* `evidence/pe10-1440.png` — 服务端搜索结果态（1440×900，关键词「产品助理」，
  浏览器实发 1 根带 `keyword=` 的请求并 200，命中 2 人，口径句与来源注记同屏在场）。
* `evidence/pe10-375.png` — 同态 375×812（搜索框与结果卡堆叠，无横向溢出）。

两图在最后一笔改动（列形制改由响应数据定档）之后重拍：读数与上面逐字相同
（`whoami=200 user=opsadmin`、`检索请求数=1`、`检索命中 2 人`），代理端口跑后
`lsof -iTCP:9377` 空。

`evidence/` 全程未提交（`git status` 里只作为未跟踪项存在）。

---

## 5. 偏差清单

* **D-1（DoD 第 21 名腿：现网存量不足，未造数）**
  DoD 原文要「第 21 名之后既有真员工可被搜到（试点台账现存量，不造数）」。
  §1.1 实测现网在册员工台账**只有 3 人**（`limit=20` 首页 `count 3`、`nextCursor None`），
  不存在第 21 名，造数被工单明令禁止。等价证据三条，全部磁盘可查：
  ① 同 limit 下 `keyword=QA2`→1 条、`keyword=不存在无此名`→0 条（§1.2）——过滤发生在服务端全量而非已加载行；
  ② `keyword=产品助理&limit=1` 的第一页给的是台账**第 2 名**、游标续页给第 3 名（§1.3）——
  命中行落在窗口外也能被检索并逐页取回；
  ③ 25 行台账的游标+关键词链测试钉住「第 21 名可搜到」的形制（`people.search.chain.test.tsx` 例 2）。
  台账涨到 21+ 后无需改码即可复跑现网腿。
* **D-2（org 搜索活体取图不可得）**：部门三根候选现网全 404（§1.4，
  `departments.read_not_wired` 归 L0/BFF 读口），树是未接入态，搜索框按设计不渲染，
  因此 org 命中路径展开只有 vitest 证据（`OrgModulePage.test.tsx` 新增 5 例），无活体截图。
  读口接入后本卡形制直接可用。
* **D-3（探针链每挂载仍走 3 候选）**：PE-14 的会话级探测缓存未落，本卡只在**挂载内**记住命中端点
  （换关键词不重跑探针链，满足「防抖窗内搜索请求≤1」）；二次挂载仍 3 请求属 PE-14 写域，未越界改。
* **D-4（org 搜索不加 300ms 防抖）**：树搜索是对已加载树的本地定位、零请求，防抖只服务于
  「搜索请求≤1/防抖窗」这条针对网络请求的纪律；给零请求的输入加计时器是空转，故不加。
* **D-5（`vitest run src` 全量 4077 例 > 工单口径）**：全量基线本就 534 件，本卡只保证
  点名件 4→5 件 / 45→56 例只增不减，且全量唯一红是 e1Contract 环境红。
