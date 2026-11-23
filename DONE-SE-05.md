# DONE-SE-05 · 续跑（A 半实装）＋ 状态机/压缩态（B 半提案）

分支 `task/SE-05-continuation` ｜ 基线 HEAD `7fa6a7c140`（＝SE-03 tip，父 face `689e8d46d1`）
工单正典：`seakoi-agent-os-l0-board/docs/product/backlogs/knowledge-audit-sessions.md` §SE-05（L200-208）
契约参照：`seakoi-agent-os-l0-board/services/runtime/CONSOLE-SESSIONS-SHAPE.md` §1-§5
写域：`web/src/modules/employee-detail/**` ＋ 本文件。`evidence/` 不提交。
主仓 `seakoi-agent-os`（含其 `openspec/`）、approvals/**、duty/**、colima/docker/共享栈 **零触碰**（只读核对源码）。
`node_modules`/`web/node_modules` 沿用 symlink，**未跑 pnpm install**。中途被外部取消一次，恢复后原地续完（未重做、未新建 worktree）。

---

## 1. 数据腿：opsadmin 真登录实测（原始响应落 `evidence/`，不提交）

BFF＝现网 `127.0.0.1:8092`（pid 740，`apps/console/server.py`）。登录腿＝`~/.seakoi/opsadmin-token.txt`（cookie `access_token_cookie`）。
真会话仅一条：`cs_01M80F82TJCHKCKQWPBSE8K54R`（员工 `emp_86A81CE8FF6F42E187BCF2B540`）。

| # | 请求（逐字原文摘要） | HTTP | 响应（`evidence/` 同名件） |
|---|---|---|---|
| ① | `GET /api/console-sessions/cs_01M80F…E8K54R` | 200 | `curl-detail.txt`：`messageCount:2`，`seq1 user`＋`seq2 assistant`（assistant **无 citations 键**），并回 `Set-Cookie: console_csrf=…; Path=/; SameSite=Lax`（＝双提交腿的浏览器侧来源） |
| ② | `POST …/cs_01M80F…E8K54R`（**裸详情路径**） | **405** | `curl-post-bare.txt`：`{"code": "console.read_only", "message": "first console is read-only; only GET/HEAD allowed"}` ＋ `Allow: GET, HEAD` ＋ rid `add166a97b6d…` ⇒ **既有服务端事实**（`server.py` `do_POST`→`_reject_write`），非审批写开关 |
| ③ | `POST …/cs_01M80F…E8K54R/messages` 体 `{"requestId":"se05-probe-a1","content":"SE-05 续跑探针（幂等重放验证用）"}` ＋ CSRF 头 ＋ Origin=同源 8092 | **201** | `curl-post-messages.txt`：`userMessage.seq=3` / `assistantMessage.seq=4`（同 requestId），`createdAt=2026-11-23T19:33:07.643Z` —— **写门真活、真落库** |
| ④ | 同体再发一次（同 requestId） | **200** | `curl-post-replay.txt`：载荷与 ③ **逐字相同**、`createdAt` 未变 ⇒ 重放走库回读，**零上游二次调用**（形状文档 §4 第 2 行） |
| ⑤ | 同体再发但**加** `Idempotency-Key: se05-probe-a1` 头 | **200** | `curl-post-idemheader.txt`：仍是首次载荷逐字回读 ⇒ 该头**不被读取也不致错**（`_session_messages_write` docstring 自述「不要求 Idempotency-Key 头」）；真凭据只有体里的 `requestId` |
| ⑥ | `POST …/messages` 带体带 Origin 但**无 CSRF 头** | **403** | `curl-post-nocsrf.txt`：`{"code": "console.csrf_token_mismatch", …, "rid": "53380c8f"}`，rid 头 `53380c8fcff4` |
| ⑦ | 匿名（无 cookie）`POST …/messages` | **401** | `curl-post-anon.txt`：`{"code": "console.unauthenticated", …}` ＋ `X-Console-Reason: identity-check-failed` |
| ⑧ | 不存在会话 `POST …/cs_NONEXISTENT…/messages` | **404** | `curl-post-404.txt`：`{"code":"console_session.not_found","message":"console session not found"}` —— 与读腿 404 **逐字同体**（防枚举） |
| ⑨ | 写腿后 `GET` 详情 | 200 | `curl-detail-after.json`/`curl-detail-live-now.json`：`messageCount=4`，seq 连续 `1,2,3,4`（3/4 的 requestId=探针值）⇒ DoD「服务端 seq 连续」有凭 |
| ⑩ | `POST …/messages` 且 `Origin: http://127.0.0.1:9413`（预览反代口径） | **403** | `curl-post-origin9413.txt`：`{"code": "console.csrf_origin", "message": "跨源写入被拒绝，请从控制台页面操作"}`；`CONSOLE_ALLOWED_ORIGINS` 实值＝`http://127.0.0.1:9122,http://localhost:9122,http://100.117.184.117:8183,http://100.117.184.117:8182`（`ps eww 740` 只读核）——**截图腿被门拒的根因**（§4） |

**写路径净效果如实报**：本轮真写＝③/④/⑤ 同一 `requestId` ⇒ 库里只增 **一对** 消息（seq 3/4，幂等已证）；⑥⑦⑧⑩ 全被门拒、零落库。

## 2. A 半实装（工单①②④）

| 文件 | 改动 |
|---|---|
| `web/src/modules/employee-detail/sessionContinuation.ts`（新建，api 封装） | `sessionMessagesUrl()`（唯一续跑写口＝`/messages`，裸详情路径不在面上）、`newRequestId()`（`se05-<uuid>`，≤200）、`sendSessionMessage()`（体恒两键 `requestId`+`content`、**无 role**；头 `Idempotency-Key`＝body requestId ＋ `X-Console-CSRF` 复用 `@/lib/csrf` 单点；缺 CSRF cookie ⇒ **网络之前**拦）、`CONTENT_MAX=4000`（BFF 关三口径）、`parseTurnPayload()`（未知字段忽略、缺 seq 不折 0）、`sendFailureCopy()`（403 拆 CSRF 两码/授权、405、409、404 同体、422、502/503、0＝结果未知，各一句专句；裸码永不上屏）、B 半哨兵 `FORBIDDEN_STATUS_BADGES`＋`SESSION_STATUS_FIELDS`（恒 null） |
| `web/src/modules/employee-detail/SessionDrawer.tsx` | 底部续跑表单 `se05-form`（label 显式写「以用户身份发一轮 · 服务端成对落 user/assistant，别无第三种角色」，`maxLength=4000`）；**乐观占位气泡** `se05-pending`（seq 位恒显「待服务端回执」，不预填号码）；成功后 **重取详情**（`nonce+1`）而非本地拼行，回执句 `se05-send-note` 逐字用服务端 `userMessage.seq`/`assistantMessage.seq`；载荷没带可解析 seq ⇒ 句子改说「没带可解析的 seq…以重取的详情为准」；回执/拒答横幅移到表单外（重取失败时两件事分得开）；失败 ⇒ 撤占位、**草稿留在框内**、同文本重试沿用同一 requestId、改文本自动换新的一把；`sd-scope` 口径行改为「消息流只读上屏 · …· 续跑走 /messages 写口」 |
| `web/src/modules/employee-detail/EmployeeDetailModulePage.tsx` | 会话区页脚一句改口径（SE-03 读 / SE-05 写），其余零改动 |
| `web/src/modules/employee-detail/SessionDrawerContinuation.test.tsx`（新建） | 20 例（点名见 §3） |

工单①「仅 assistant/user 两角色输入」的落法：契约体根本没有 role 键（§4 只有 `requestId`/`content`，角色由服务端成对落库决定），因此表单**不给角色入口**——测试钉 DOM 无 `select`/`input[name=role]`，并钉屏上角色词汇只有 用户/助手（未知值走读腿既有「待核实」句）。

## 3. 门禁（磁盘原始 stdout）

```
$ cd web && node_modules/.bin/vitest run src/modules/employee-detail --reporter=dot
 Test Files  3 passed (3)
      Tests  100 passed (100)
   Duration  1.29s
```

基线 2 件/80 例 → **3 件/100 例**（只增不减；基线 80 例原文一字未改，`git status` 里 `SessionDrawer.test.tsx`/`EmployeeDetailModulePage.test.tsx` 不在改动集）。
新增 `SessionDrawerContinuation.test.tsx` 20 例（标题逐条对盘）：
①只 POST `/messages`；体恒 requestId+content 两键（无 role）；`Idempotency-Key`＝body requestId；CSRF 双提交头在场
②表单不供第三种角色：屏上无 role 输入项，未知 role 只照实+待核实
③缺 CSRF 双提交令牌 ⇒ 网络之前拦下、一句人话、零 POST
④空内容不发；上限 4000 字与 BFF 关三同口径
⑤在途占位气泡在场且不带本地 seq；成功后重取详情、按回执 seq 收敛（在途时 GET 恒一次、成功后第二次 GET＝详情读口）
⑥服务端 seq 漂移（回 #9/#10）⇒ 屏上照实报服务端数，绝不折算成本地连续号
⑦turn 载荷缺可解析 seq ⇒ 不猜号，句子里明说以重取详情为准
⑧重放（200 同载荷）也收敛，且两次发送之间不留第二条占位
⑨同文本重试沿用同一 requestId；改文本换新的一把（502 后草稿留在框内）
⑩断连＝结果未知：既不称成功也不称失败，屏上无「已发送」字样
⑪405 `console.read_only` ⇒ 专句逐字带服务端答复口径；占位撤下、草稿保留、不谎称排队
⑫403 CSRF 两种码走 `lib/csrf` 单点句；授权拒绝 403 走专句（另含 Origin 不在白名单同码腿）
⑬409 `console_session.conflict` ⇒ 专句「同一请求号已落库、本次零新增」
⑭写腿 404 与读腿 404 同体防枚举：句子同样不区分不存在/跨租户
⑮屏上永不出现裸码/裸枚举（405·409·403·502 逐码扫 DOM）
⑯详情带未知字段（`status/compressed/未来键`）⇒ 照常渲染、不崩、不显徽章
⑰turn 载荷未知字段忽略、seq 照收；缺载荷不编造（`parseTurnPayload`）
⑱B 半红线：状态机/压缩态占位契约恒 null，DOM 零徽章
⑲重取详情失败也不谎称已落库上屏：回执句在、错误态各自说话
⑳api 直腿：成功腿回 turn 载荷；空内容与超长内容零网络（首尾空白裁掉再发）

```
$ cd web && node_modules/.bin/vitest run src --reporter=dot
 Test Files  1 failed | 534 passed (535)
      Tests  1 failed | 4100 passed (4101)
 FAIL  src/shell/e1Contract.test.ts > E1 取证自报: 端口 + entry 文件名（L0 硬规矩）
   → served entry drifted from the dist on disk: expected 'assets/index-BoWDBxUF.js' to be 'assets/index-BKiZMkc-.js'
```

唯一红＝`e1Contract`（9122 部署漂移环境红，工单单列、禁消解禁改，未触碰）。两 hash 独立复测：
`served(9122)=assets/index-BoWDBxUF.js` ｜ `disk(hermes_cli/web_dist)=assets/index-BKiZMkc-.js`。

```
$ cd web && node_modules/.bin/vite build
BUILD_EXIT=0                     # 禁 pnpm run build；产物＝hermes_cli/web_dist
```

```
$ cd web && node scripts/lint-fake-success.mjs
  "violations": [],
  "ok": true
LINT_EXIT=0
```

```
$ cd web && npx tsc --noEmit -p tsconfig.app.json
TOTAL=49        # 全仓 49＝基线（../apps/shared 预存 vitest 类型红）
TSC_ED=0        # 写域 employee-detail 零错 ⇒ delta 0
```

（首轮我曾报 `TSC_TOTAL=50/ED=1`＝我自己测试件的未用 import，已改掉后复测 49/0，非基线漂移。）

## 4. 截图（`evidence/`，不提交）

脚本 `evidence/se05-shoot.mjs`：build 产物 + 临时 v4_proxy（`V4_SERVE_PORT=9413`，`/agent-api→8092`；9413 非黑名单且启动前实测 free，用完按 pid 精确 kill，回读 `lsof -iTCP:9413`=不监听）+ opsadmin cookie 注入 + **每图前 whoami==200**（原始行 `[A]/[B]/[C]/[D] whoami=200 display=opsadmin`）+ `domcontentloaded` + settle（禁 networkidle）+ 视口图。

- `se05-1440-form.png`：续跑表单实态（label 角色词汇句、22/4000 计数、幂等凭据注记、发送钮）。
- `se05-1440-optimistic.png`：**乐观上屏真拍**——在途占位盒 `{x:896,y:381,w:528,h:86}`，屏上逐字「seq 待服务端回执 ＋ requestId se05-26ab7215-… ＋ 这条是本地占位…以详情读口重取为准」。做法＝对真 POST 只加 1.6s 延迟让在途态可拍，**答复内容一字不改**（放行后仍是那发真 403）。
- `se05-1440.png`：放行后的真答复态——`403 POST …/messages`，屏上拒答句「当前访问来源不被允许写入，请联系管理员开通后再试。请求编号：19491212a75f」；同帧上屏四行真数据，尾两行 `#3/#4`＝§1③ 真落库那对（`占位气泡已撤=true`）。
- `se05-1440-negative.png`：负例态（同一真门第二腿，rid `c6c918013164`）。
- `se05-375.png`：375 档抽屉全宽；溢出判据逐字＝`{"docScrollW":375,"innerW":375,"drawer":{"x":0,"w":375},"form":{"x":12,"w":351,"right":363},"bodyOverflow":{"scrollW":239,"clientW":239}}` ⇒ 无横向溢出。

**「发送成功回执」的浏览器实态不可拍（如实交付）**：预览反代的浏览器 Origin＝`http://127.0.0.1:9413`，而现网 BFF 的 `CONSOLE_ALLOWED_ORIGINS` 实值只含 9122/ tailscale 两址（§1⑩ 逐字 403 `console.csrf_origin` 为凭）；同体同腿换成 Origin＝`8092` 立刻 201/200（§1③④⑤）。两把钥匙都不在我写域内（改部署 env＝禁碰共享栈；伪改 Origin＝拿假成功冒充，工单红线禁止）。成功腿的**服务端实态**由 §1③④⑨ 原文＋屏上真 seq 3/4 交付；**客户端实态**由 `SessionDrawerContinuation.test.tsx` 收敛例钉住。禁 stub 冒充成功，未造会话、未改白名单。

## 5. 偏差清单

1. **成功回执浏览器实态不可拍**：见 §4 根因与两把钥匙，禁改禁伪。
2. **`Idempotency-Key` 头是形制对齐、不是第二把锁**：实测（§1⑤）服务端只认体里 `requestId`；我仍按工单带上该头（值＝同一 requestId），源码注释与本文都不谎称另有一把门。
3. **乐观占位不显本地 seq**：工单②要求防 seq 漂移，我把占位的 seq 位钉成「待服务端回执」，真号码只在成功句里用**服务端回执值**，行本身来自重取的详情。
4. **重放 200 与首送 201 在屏上不可分**：`fetchJSON` seam 只回载荷、不回状态码，两次的体逐字相同（§1③④）；要显「这是重放」需 seam 扩状态码——未扩（基线 seam 属写域外），改用文本口径不区分两态。
5. **`e1Contract` 红**：环境红单列，禁消解，未触碰。
6. **工单「改动文件」列的 openspec 目录不落主仓**：见 §6 交付路径说明（G1 治理＋`task/*` 钩子拦，等 AP-05b 同款裁定）。
7. `FORBIDDEN_STATUS_BADGES` 首版误收裸词「活跃」，与本模块既有「最近活跃」锚点词汇（EMP-03 在岗区）撞面 ⇒ 已收窄为状态机/压缩断言词汇，避免误伤与假绿。

## 6. B 半 · openspec 提案草案（正文全在此节；主仓未落一笔）

**草案位置**＝本文件本节（`DONE-SE-05.md` §6，worktree `task/SE-05-continuation`）。
**待投递交割路径**＝Orchestrator/用户拍板后，由主仓 `seakoi-agent-os` 的 `openspec/changes/<change-id>/proposal.md` ＋ `specs/console-sessions/spec.md` 承载；本卡**不写主仓**（G1 治理门＋`task/*` 分支被钩子拦，与 AP-05b 同款待裁定），也**不动** `docs/product/backlogs/knowledge-audit-sessions.md` 台账行（总控负责）。

### 6.1 Why（证据，非推断）

- 控制台侧形状**零状态词汇**：`008_runtime_console_sessions.sql` 的 `console_session` 只有 `session_id/tenant_id/employee_id/created_at/updated_at`；`services/runtime/console_sessions.py::_session_api()` 出五键＋`messageCount`；`CONSOLE-SESSIONS-SHAPE.md` §1-§3 同口径。⇒ 前端任何「活跃/已压缩/已归档」徽章都是凭空造（工单红线）。
- 上游 Hermes **有**可观测压缩信号（fork 源码盘点，非猜测）：
  - `agent/compaction_events.py`：内容无关的 `hermes.compaction` v1 记录，逐条带 `kind/scope/official/method/trigger/trigger_class/overflow_reason/outcome/failure_class/attempt_id/session_id/tokens_before/tokens_after/tokens_reclaimed/…`，覆盖 summarize / micro_summarize / prune_tool_results / provider_native 四类；docstring 明写「committed record 也触发 `post_compaction` 插件钩，插件无需从历史变短反推」。
  - `hermes_state_compression.py`：SessionDB 压缩血统（`end_reason='compression'`、`parent_session_id` 链、root→tip 走法、cooldown/失败连击计数、压缩锁与租约）。
  - 关键耦合：压缩**会换会话号**（`agent/context_compressor.py` 的 "the session was NOT rotated" 反向语义 ＋ `api_server.py` 响应体 `session_id` 取 `effective_session_id`）——控制台库里的 `cs_…` 对上的是**被轮换后的段**，历史血统不在控制台面。
- 链路缺口：`seakoi-agent-os/services/runtime/**` 对 compaction 信号**零消费**（grep `compaction|compress|lineage` 无命中）；层B 只透传 content/citations（`ConsoleChatReply`）。⇒ 状态机/压缩态是**后端投影缺失**，不是前端能补的账。

### 6.2 What Changes（提案条文）

1. **运行时补投影**（`services/runtime/console_sessions.py`）：session 形状新增**可空**字段——`status`（词汇表封闭集：`open|archived|unknown`，未映射值一律 `unknown`，不折叠）、`lastCompactionAt`（ISO8601，无记录＝键省略）、`compactionCount`（int，无记录＝键省略）、`segmentSessionId`（当前血统段位对应的 Hermes 会话号）。全部「有才出现」，沿用 citations 的诚实纪律：**绝不**用 `null`/`0`/`"unknown"` 冒充"查过没有"。
2. **投影来源**＝`hermes.compaction` 记录（committed 语义）＋ SessionDB 压缩血统；数据面归属由 runtime 持有，**不进 AGENTRUN 公开契约**（与形状文档 §0 同边界）。
3. **读口面**＝只扩 §3 详情形状（列表 §2 不加，避免计数放大）；BFF 无新增门、无新写路由，透传即可。
4. **前端占位契约（本卡已落）**＝`sessionContinuation.ts::SESSION_STATUS_FIELDS` 恒 `{status:null, compressed:null}`，唯一挂载点在 `SessionDrawer`；字段真到位后只换成读真值，仍**不推断**。
5. **不做**：会话域 replay/重放端点（`agentrun.py` 重试链属 Run 域、PRD §5 链3 属运行车道）；搜索/全局 q（并入 SE-06 同批）。

### 6.3 Impact

- Spec：`console-sessions` 形状新增四可空键（向后兼容，缺键＝今天的样子）。
- Code：runtime 一处投影＋迁移读侧；前端在字段落地前**零改动**（徽章继续不显）。
- Tests：runtime 投影例（有记录/无记录/词汇未映射三态）＋控制台读腿「缺键不显」契约例。

### 6.4 口径声明（红字）

**后端不可得 ⇒ 控制台永久不显**：在第 6.2 条 1-2 落地并有实测原文之前，控制台面**不出现任何**会话状态机或压缩态徽章；未知词汇不折叠、不反推、不用「历史变短」当信号。本期交付的前端只有「缺字段 ⇒ 什么都不显」一条路径。

## 7. 交付

- commit：`feat(employee-detail): SE-05 session continuation (optimistic + server-seq convergence) + status/compression proposal draft`
- push：`git push origin task/SE-05-continuation`（无 force、无 --no-verify）
- 定向 ref 回读与 tip 全长见会话回执；`evidence/` 与 49/0 hash 读数件不提交。
