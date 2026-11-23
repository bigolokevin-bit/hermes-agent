# Q8｜五高频页 375 视口只读验收 — DONE

- 生成时间：2026-11-23 19:13:18 +0800
- 范围：375×812 视口，三判据只读取证（**只测量不改码**，web/src/** 未触碰）
- worktree：/Users/kevin_studio/Projects/tasks/Q8-375-pages  分支 task/Q8-375-pages  基线 42dcd7983f
- 取证脸：vite dev 127.0.0.1:5199（本 worktree 源码），`/agent-api/*` 经一次性 dev 代理转发至受管预览入口 9122（l7-ops v4_proxy：剥 /agent-api 前缀 → 控制台 BFF 8092，鉴权上游 7860）
- 登录态：opsadmin `access_token_cookie`（域改写 127.0.0.1），逐页 in-page 断言 `GET /agent-api/api/console-sessions` = **200**（未登录基线=401，证明鉴权成立，非骨架伪像）

## 0. 路由口径修正（派单 spec 与本树不符）

派单称路由在 `web/src/app/router.tsx`、URL 形如 `?mod=<id>&view=list`、组件在 `modules/{knowledge,documents,tasks,sessions,runs}`。
**本树（基线 42dcd7983f）实为 react-router 浏览器路径**，无 `app/router.tsx`、无 `?mod=` 方案、无独立 `documents`/`sessions` 模块。五页据实映射如下：

| 点名页 | 本树真实入口 | 渲染判定 |
|---|---|---|
| 知识库 | `/knowledge` | KnowledgeModulePage（知识空间 tab） |
| 知识问答 | `/knowledge?tab=spaces&panel=retrieval` | **本树无独立问答页**；检索面（kn6）内联在知识空间 tab，与知识库同源同形制（见 §2） |
| 文档 | `/docs` | 上游 DocsPage = 外部 `hermes-agent.nousresearch.com` **跨域 iframe**（结构上不可测，见 §3） |
| 任务 | `/tasks` → 重定向 `/work?tab=board` | 任务看板（work board） |
| 会话 | `/sessions` | 上游 SessionsPage |

## 1. 逐页 × 逐判据矩阵

| 页 | ①横溢 | ②触控<44（产品件） | ③hover-only | 离屏抽屉件(排除) | whoami |
|---|---|---|---|---|---|
| 知识库(knowledge-base) | PASS scrollW=375≤375, 命中0 | 6 个 | 0 | 35 | 200 |
| 知识问答(knowledge-qa) | PASS scrollW=375≤375, 命中0 | 6 个 | 0 | 33 | 200 |
| 文档(docs) | PASS scrollW=375≤375, 命中0 | 0 个 | 0 | 17 | 200 |
| 任务(tasks) | PASS scrollW=375≤375, 命中0 | 8 个 | 0 | 37 | 200 |
| 会话(sessions) | PASS scrollW=375≤375, 命中0 | 8 个 | 0 | 17 | 200 |

**全局结论**：五页在 375 下**均无横向溢出**、**无 hover-only 交互**；触控判据登记 **28 个产品件 <44px**（另每页有 4 个 <44px 为全局遥测同意横幅，属共享 chrome，单列不计入产品缺陷）。

## 2. 判据①横溢（逐元素 right>375 + scrollWidth）

- **知识库**：`scrollingElement.scrollWidth=375`，`documentElement.clientWidth=375`，rect.right>375 命中=**0**。
- **知识问答**：`scrollingElement.scrollWidth=375`，`documentElement.clientWidth=375`，rect.right>375 命中=**0**。
- **文档**：`scrollingElement.scrollWidth=375`，`documentElement.clientWidth=375`，rect.right>375 命中=**0**。
- **任务**：`scrollingElement.scrollWidth=375`，`documentElement.clientWidth=375`，rect.right>375 命中=**0**。
- **会话**：`scrollingElement.scrollWidth=375`，`documentElement.clientWidth=375`，rect.right>375 命中=**0**。

判据口径：fixed/absolute 离屏抽屉等设计内元素已在 `isFixedOrAbsOffscreen` 中排除；本树侧栏在 375 为屏外抽屉（translate-x），逐页排除 17–37 个离屏导航件（见矩阵）。

## 3. 判据②触控（rect min(w,h)<44，逐条选择器+实测 rect）

> 阈值=44px（iOS HIG / WCAG 2.5.5 AA）。注：下列件均 ≥24px，满足 WCAG 2.5.8 AAA 的最小 24px，但未达 44px 触控目标口径——按派单口径登记为命中。

### 知识库（knowledge-base）— 产品件 6
- min=**28px** rect 342×28 @(11,573)  `button "刷新"`
- min=**28px** rect 63×28 @(11,657)  `button[data-testid=kn6-search-submit] "搜索"`
- min=**34px** rect 342×34 @(11,614)  `input#kn6-input[data-testid=kn6-search-input]`
- min=**35px** rect 77×35 @(11,487)  `a[role=tab] "知识空间"`
- min=**35px** rect 64×35 @(92,487)  `a[role=tab] "数据源"`
- min=**35px** rect 77×35 @(159,487)  `a[role=tab] "审计证据"`

### 知识问答（knowledge-qa）— 产品件 6
- min=**28px** rect 342×28 @(11,573)  `button "刷新"`
- min=**28px** rect 63×28 @(11,657)  `button[data-testid=kn6-search-submit] "搜索"`
- min=**34px** rect 342×34 @(11,614)  `input#kn6-input[data-testid=kn6-search-input]`
- min=**35px** rect 77×35 @(11,487)  `a[role=tab] "知识空间"`
- min=**35px** rect 64×35 @(92,487)  `a[role=tab] "数据源"`
- min=**35px** rect 77×35 @(159,487)  `a[role=tab] "审计证据"`

### 文档（docs）— 产品件 0
- 文档页为跨域 iframe：壳层内仅遥测横幅（见下）；**iframe 内部件跨域不可枚举**，记为结构性不可测，非零命中=PASS。

### 任务（tasks）— 产品件 8
- min=**25px** rect 137×25 @(11,663)  `button[data-testid=tsk4-filter-status][role=combobox] "按状态筛选"`
- min=**25px** rect 104×25 @(156,663)  `button[data-testid=tsk4-filter-assignee][role=combobox] "按负责人筛选"`
- min=**25px** rect 126×25 @(11,696)  `button[data-testid=tsk4-filter-priority][role=combobox] "按优先级筛选"`
- min=**25px** rect 65×25 @(145,695)  `button[data-testid=tsk4-filter-clear] "清空筛选"`
- min=**28px** rect 65×28 @(11,621)  `button[data-testid=tsk4-create-open] "新建任务"`
- min=**28px** rect 63×28 @(84,621)  `button "刷新"`
- min=**35px** rect 51×35 @(11,487)  `a[role=tab] "任务"`
- min=**35px** rect 51×35 @(66,487)  `a[role=tab] "运行"`

### 会话（sessions）— 产品件 8
- min=**26px** rect 128×26 @(149,705)  `button "Import exported sessions"`
- min=**28px** rect 155×28 @(11,505)  `button "Prune old sessions"`
- min=**30px** rect 53×30 @(12,664)  `button[role=radio] "Chats"`
- min=**30px** rect 80×30 @(65,664)  `button[role=radio] "Automation"`
- min=**30px** rect 35×30 @(146,664)  `button[role=radio] "All"`
- min=**30px** rect 162×30 @(189,664)  `button "Session source"`
- min=**30px** rect 70×30 @(12,703)  `button[role=radio] "Overview"`
- min=**30px** rect 58×30 @(83,703)  `button[role=radio] "History"`

### 全局遥测横幅（共享 chrome，每页都出现，单列不计入产品缺陷）
来源：`App.tsx:959 <SharedMetricsConsentBanner/>`。逐页一致的 4 个 <44px 件：
- `a "Details"` 37×13、`button "Dismiss"` 13×13、`button "Share with Nous"` 104×21、`button "No thanks"` 71×21

## 4. 判据③hover-only

**全部五页 0 命中**。判据口径：元素有 hover 视觉反馈但同时具备 (a) 原生键盘可聚焦（`button`/`a[href]`/`input`/`select`，`tabIndex>=0`）+ 浏览器默认焦点环（设计令牌 `tokens.css` 明文「禁 outline:none」），或 (b) 自带 `focus-visible:`/`active:` 等价类，则不计为 hover-only。
- 实测焦点环证据（命中页样式表内 `:focus-visible{outline|box-shadow}` 选择器抽样）：
    - `.knw5-input:focus-visible`
    - `.k3-docs-name:focus-visible`
    - `.knw5-page a[data-testid$="-name"]:focus-visible, .knw5-page a[data-testid="kn-s`
    - `.knB-link:focus-visible, .knB-current:focus-visible`
    - `.knC-sort:focus-visible`
    - `.kn-group-toggle:focus-visible`
    - `.kn-doc-preview-toggle:focus-visible`
    - `.kn-type-bucket:focus-visible`
    - `.knM-toggle:focus-visible`
    - `.kn-space-toggle:focus-visible`
    - `.knw5-req-toggle:focus-visible`
    - `.ha-share-trigger:focus-visible`
    - `.hermes-kanban-textarea:focus`
    - `.hermes-kanban-docs-link:hover, .hermes-kanban-docs-link:focus-visible`
- 源码层 hover-reveal 审计：全仓仅 `web/src/pages/SkillsPage.tsx:822` 使用 `group-hover:opacity-100`，且同行已配 `focus-visible:opacity-100` 等价（SkillsPage 不在本五页范围）。无 `peer-hover`/裸 `group-hover` 揭示无焦点等价的操作件。

## 5. 截图清单（视口图 375×812，非 fullPage；均 whoami=200 后拍摄）

| 页 | 路径 | 渲染佐证（main 文本/首屏标题） |
|---|---|---|
| 知识库 | `docs/_artifacts/Q8-375/shots/knowledge-base.png` | 知识空间 tab，含检索/数据源/审计证据（textLen=1124） |
| 知识问答 | `docs/_artifacts/Q8-375/shots/knowledge-qa.png` | 同知识库（retrieval 内联）（textLen=1084） |
| 文档 | `docs/_artifacts/Q8-375/shots/docs.png` | 跨域 iframe 壳层（内部不可测）（textLen=419） |
| 任务 | `docs/_artifacts/Q8-375/shots/tasks.png` | 任务看板：状态/负责人/优先级筛选+新建（textLen=2197） |
| 会话 | `docs/_artifacts/Q8-375/shots/sessions.png` | 会话列表：Total 122 / Messages 447（textLen=571） |

## 6. 结构性不可测点（如实登记，不造数）

- **文档 /docs**：`DocsPage` 渲染 `<iframe src=https://hermes-agent.nousresearch.com/docs/>`，跨域。壳层本身 scrollWidth=375 无溢出，但 iframe 内文档站的横溢/触控/hover **无法从父页枚举**，判据②③对该页仅覆盖控制台壳层，不覆盖文档正文。
- **知识问答**：本树无独立问答路由，retrieval 面板内联在知识空间 tab，故与「知识库」实测读数一致，非重复采样错误。

## 7. 控制台告警（取证观察，非本单修复范围，仅登记）

- 知识库（knowledge-base）：
    - Failed to load resource: the server responded with a status of 404 (No
- 知识问答（knowledge-qa）：
    - Failed to load resource: the server responded with a status of 404 (No
- 文档（docs）：
    - Failed to load resource: the server responded with a status of 403 (Fo
- 任务（tasks）：
    - Failed to load resource: the server responded with a status of 403 (Fo
- 会话（sessions）：
    - Each child in a list should have a unique "key" prop.%s%s See https://
    - Failed to load resource: the server responded with a status of 403 (Fo

说明：403 为部分 `/api/*`（非 `/agent-api` 控制台读侧）在本脸未授权；页面主体已渲染真实计数（见 §5 textLen 与截图），故非「未登录骨架伪像」。React `key` 告警在 sessions 出现，属上游件，登记不改。

## 8. 复现命令

```bash
cd web && node_modules/.bin/vite --config ../docs/_artifacts/Q8-375/scripts/vite.q8.config.ts  # 一次性 dev 代理（非产品码）
Q8_AUTH_STATE=<temp>/q8-auth-state.json NODE_PATH=$PWD/web/node_modules node docs/_artifacts/Q8-375/scripts/probe-375.cjs
```
- 探针：`docs/_artifacts/Q8-375/scripts/probe-375.cjs`
- 原始读数：`docs/_artifacts/Q8-375/raw/readings.json`
- 登录态（已脱敏，token 不落本目录明文副本）：`raw/auth-state.json` 指向 opsadmin cookie 域 127.0.0.1

## 9. 截图人工判读（双档复核纪律）

逐张以图判读 375 视口截图，确认非骨架/非空白、无可见横向溢出：

- `knowledge-base.png`：菜单/Hermes Agent 头 → 遥测横幅 → 治理·控制台「知识与数据」→ 知识空间/数据源/审计证据 tab → 刷新 → 搜索框 → 文档命中说明。内容全部落在 375 内。
- `knowledge-qa.png`：与 knowledge-base 同形制（retrieval 内联于知识空间 tab），符合 §6 判定。
- `tasks.png`：运营·控制台「任务与运行」→ 任务/运行 tab → 任务看板 → 新建任务/刷新 → 状态/负责人/优先级筛选 + 清空筛选 → 待处理 17 · 阻塞 1（真实计数）。无溢出。
- `sessions.png`：「数字员工」头（上游 SessionsPage 自题）→ Sessions 1 → Prune old sessions → 122 Total/122 Active/0 Archived/447 Messages/4 Sources → Chats/Automation/All → Any chat source → Overview/History → Import sessions → RECENT SESSIONS。无溢出。
- `docs.png`：壳层「Documentation」+ 已加载的外部文档 iframe（Hermes Agent 官网正文可见）。iframe 外框受 375 约束不溢出；**iframe 内部判据跨域不可枚举**（见 §6）。

结论：判据①（横溢）经逐元素 rect + scrollWidth + 截图三重一致，五页 PASS；判据③（hover-only）经样式表焦点环 + 源码 group-hover 审计，五页 0 命中；判据②（触控）逐页命中已登记为缺陷，未修复。

---

## 9. FIX-Q8 补拍（2026-11-23，回应 QA R319#3 FAIL：缺 1440 全高截图）

基线：本分支已并入现脸 `648233693d0e3cf04c0e9726bc8a9a0cdaf28186`（fetch 定向核过，42dcd798 为其祖先，fast-forward 无冲突）。写域仅 `docs/_artifacts/Q8-375/**`，`web/src` 零改动（本拍对产品的唯一触碰是一个未提交的临时 vite 配置副本，已删）。

取图法（视口加高，非 fullPage——后者在该脸为 no-op 且属超时高危族）：goto `domcontentloaded` + settle 1.8s → 页内 whoami(`/agent-api/api/console-sessions?limit=1`)=200 紧贴断言（401 即弃拍）→ 量 `max(doc scrollHeight, 滚动壳 top+scrollHeight)` → `setViewportSize(1440, H+60)` → 复量确认 `fits=true`（内容全高入视口，无裁切）→ 视口截图。脸 = vite dev 127.0.0.1:5199 本树源码，/agent-api 代理 9122。脚本 `scripts/shot-1440.cjs`，逐条原始读数 `raw/readings-1440.json`，SHOT_EXIT=0 全 OK。

| 页 | PNG 路径（docs/_artifacts/Q8-375/shots-1440/） | 尺寸 px | 字节 | whoami | fits |
|---|---|---|---|---|---|
| 知识库 | knowledge-base.png | 1440×1227 | 232423 | 200 | true |
| 知识问答 | knowledge-qa.png | 1440×1322 | 224619 | 200 | true |
| 文档 | docs.png | 1440×960 | 178528 | 200 | true |
| 任务 | tasks.png | 1440×3096 | 317393 | 200 | true |
| 会话 | sessions.png | 1440×960 | 72645 | 200 | true |

声明（对应 FAIL 判定的"DONE 对 1440 零声明"）：五页 1440 全高图在架；任务页 3096px 高证真全高非首屏；文档页仍为跨域 iframe 结构限制（§6 口径不变）；三判据矩阵仍指 375 口径，本拍不改判。
