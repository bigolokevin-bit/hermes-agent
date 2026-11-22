# UI-B 用户可见 bug 清单（首轮 36 面读数 · L0 战略直令 C 车道）

- 取证脸：`lane/ui-b-401-stormfix2` 集成的 `index-CCLAG-mZ.js`（=401 三闸代次，**未含**假 200 复位修复 `f3c72902ff`）；经 9122 活部署代理，后端 = 现网 8183。
- 登录态：`ui-qa-auth-state.json` opsadmin cookie 部分有效（runs/audit/employees/usage 返回真实数据 200）；下列 404 均为**读口缺失**（后端未挂路由），非权限态——401/403 才会是权限。
- 口径：每条附可复核读数（scan.json / overflow-probe-reading.txt / text-dump.txt 行号）与 1440+375 playwright 真 fullPage 截图（shots/<slug>@<vw>.png）。观感偏好不入账；已排雷项单列。
- 状态：本清单为首轮可证 16 条；observer 36 图视觉审查与二巡补充在途，凑不满 20 条不水（纪律）。

## P0

### 1. 匿名态 401 风暴环：#/sessions 与 #/capabilities?tab=channels 卡骨架 + 请求风暴
- 页面：`#/sessions`、`#/capabilities?tab=channels`（会话失效/匿名态）
- 复现：清 cookie 或 cookie 失效 → 打开上述任一路由 → 观察 Network 与页面。
- 期望：一次登录引导或一个稳定「需要登录」态；请求有界。
- 实际：整页 reload 风暴。实测 15s→30s 窗口 nav 645→1255、401 1930→3759 线性翻倍（`../401-face/real-9122-probe.txt`）；页面停在骨架 mainTextLen=10。
- 根因定案（点单二选一已答）：9122 反代不转发 `/api/status` → SPA 兜底返回 200+index.html 的**假 200**，每次加载把 reload-once/redirect-once 风暴闸复位成环；现网信封 `{code:'console.unauthenticated'}` 无 `login_url`，闸①在生产不触发。修复 `f3c72902ff`（content-type 判据）+忠实回放红绿双证在 `lane/ui-b-401-stormfix2`，**待并脸**。
- 佐证：`../401-face/wave154-skeleton-attribution.md`、`../401-face/replay-red-cclag.txt`（745→1475 翻倍复现）、`../401-face/replay-green-duhon-render.txt`（修复脸 3→3 且真渲染 104/155≥30）、`../401-face/real-9122-logged-in-stable.txt`（活会话同未修脸不翻倍：nav 2→2，读数 116/969——aud 的 authState=provided 轮用了早衰 cookie，provided≠alive）。
- 截图：`shots/sessions@1440.png`、`shots/sessions@375.png`、`shots/capabilities-tab-channels@1440.png`、`shots/capabilities-tab-channels@375.png`
- 写域归属：`web/src/lib/api.ts`（修复已在途）+ 部署脸代次（L0 并脸）+ l7-ops v4_proxy 缺 `/api/status` 转发（旁因，归属 ops）。

## P1

### 2. sessions 会话卡把内部占位串直接上屏「msgs · NaNd ago」
- 页面：`#/sessions`（RECENT SESSIONS 卡）
- 复现：登录态打开 sessions → 看唯一一张卡「Untitled」副行。
- 期望：「Untitled · 0 条消息 · 时间」或诚实缺失态。
- 实际：`msgs · NaNd ago`——未格式化的英文占位 + NaN 计算上屏（overflow-probe 实测 visible=true rect[259,226]；text-dump.txt:481）。卡片无 data-testid（探针 cardCount=0），测试面也未覆盖。
- 截图：`shots/sessions@1440.png`（1440 即现）、`shots/sessions@375.png`
- 写域归属：sessions/Chats 面组件（shell 挂载的 Chat 列表卡）+ i18n 口径。

### 3. 知识与数据页两个核心读口 404，整页无内容可看
- 页面：`#/knowledge`
- 复现：登录态打开 → 文档区与空间区。
- 实际：`GET /agent-api/api/documents` 404、`GET /api/knowledge/spaces` 404（scan.json consoleError 样例）；两块显示「文档登记读口未接入 / 知识空间未接入…去审批中心提交开通申请」（text-dump.txt:21,22,47）。文案诚实，但页面主功能（文档列表/空间列表）对用户完全不可用。
- 期望：读口接入，或在入口/导航层面明示该页暂无数据而不是让人进来撞两堵墙。
- 截图：`shots/knowledge@1440.png`、`shots/knowledge@375.png`
- 写域归属：后端/BFF 读口（l0-board 线）；前端可做的导航降级属 shell/knowledge。

### 4. 能力与接入 · 平台接入 tab 四个读口 404，GAP 卡刷屏
- 页面：`#/capabilities?tab=channels`
- 实际：`/agent-api/api/mcp/servers`、`/api/gateway-connections`、`/api/datasources`、`/api/connectors` 全 404（scan.json）；页面挂 GAP-08/GAP-04 未接入卡两张（text-dump.txt:135,152,169），仅 2 个渠道真实可读。
- 期望：接入缺失集中一处说明，而不是同屏多张重复 GAP 卡。
- 截图：`shots/capabilities-tab-channels@1440.png`、`shots/capabilities-tab-channels@375.png`
- 写域归属：后端读口 + capabilities 模块收纳。

### 5. 人员目录拿数字员工台账冒充名录，全员「— 上游未提供账号/部门」
- 页面：`#/identity`
- 复现：登录态打开人员目录。
- 实际：`/api/v1/user/list`、`/api/v1/user/all` 404 → 回退「来源：数字员工台账；真人用户中心接口尚未接入，这里不冒充真人名单」（text-dump identity 段），表头却是「姓名/账号/部门/状态/最后活跃」，3 行里账号列全「— 上游未提供账号」、部门两行「上游未提供部门」、活跃时间全缺（含「最后更新」括号长文挤爆单元格）。
- 期望：表头随数据源变化，不显示给不出的列。
- 截图：`shots/identity@1440.png`、`shots/identity@375.png`
- 写域归属：identity 模块（前端可裁列）+ 真人读口（后端）。

### 6. 模型与单价页双卡「未接入」，页面只剩账本一块
- 页面：`#/models`
- 实际：`/api/models` 404 + pricing 404 → 目录卡与单价卡双降级（scan consoleError=1；text-dump models 段），mainTextLen 仅 493。标题叫「模型与单价」但两个同名主块都无数据。
- 截图：`shots/models@1440.png`、`shots/models@375.png`
- 写域归属：后端读口（与 #8 同族）。

### 7. `models/pricing` 一个读口 404 打穿三页
- 页面：`#/system?tab=version`、`#/metrics`、`#/models`
- 实际：同一端点三页各挂一个错误/降级条：version 页红条带 rid `4dfd22db…`+重试（text-dump version 段）；metrics 顶部「有 1 项数据暂时读不到，卡片上写着原因」（text-dump.txt:372 段）；models 单价卡「未接入」。用户每换一个页面都重新看到这个缺口。
- 期望：一个缺口一处说明，或读口补上。
- 截图：`shots/system-tab-version@1440.png`、`shots/metrics@1440.png`、`shots/models@1440.png`（各含 375 同面对）
- 写域归属：后端 pricing 读口；三页前端重复呈现口径可收敛。

### 8. system@375 行操作钮（复制 rid）默认不可见，藏在横滚壳外 250px
- 页面：`#/system` @375
- 实际：`sys-row-copy-0..2` rect=[624,683]，祖先有 overflow-x 壳（scrollW680>clientW310）可滚达，但默认视口看不到、无滚动提示；按门禁逐元素判据（right>376）计违规 3（scan.json + overflow-probe SYSTEM375 行）。与板项 #24 重叠，本条给现测读数。
- 期望：行级操作在 375 不进横滚区（先例：runs 详情钮 col-span-2 独立行，wave-125）。
- 截图：`shots/system@375.png`、`shots/system@1440.png`
- 写域归属：`modules/health/SystemHealthSurface` / UI-KD（板项在册）。

## P2

### 9. 版本页信息量为零：四个构建标识 + 组件版本表全占位
- 页面：`#/system?tab=version`
- 实际：构建号/运行代码/提交号/构建时间四项均为「构建时没有写入这项信息；请让发布流程补齐构建标识」（text-dump.txt:309-313），组件版本表全「—」（:301-306 口径注在案）。整页无一个真实版本值。
- 期望：发布流程写 build 标识（注入 __BUILD_INFO__），或该 tab 合并进行级页。
- 截图：`shots/system-tab-version@1440.png`、`shots/system-tab-version@375.png`
- 写域归属：构建/发布流程（vite define）——不是页面代码的锅，但用户可见。

### 10. metrics 页把「可用性一句话」内部规格文案整段上屏
- 页面：`#/metrics`
- 实际：一段 ~120 字内部行为口径直接渲染：「可用性一句话：整页都读不出来的时候，只留『刷新』可用，导出与复制一起停下；…」（text-dump.txt metrics 段，登录态 1440 即见）。这是写给评审看的行为契约，不是写给使用者的文案。
- 期望：行为照做，文案撤下或收进折叠帮助。
- 截图：`shots/metrics@1440.png`、`shots/metrics@375.png`
- 写域归属：`modules/metrics`。

### 11. metrics 空态「合计：该窗口无可渲染行」与统计卡「21 次运行」并排矛盾
- 页面：`#/metrics`（默认视图：24h + 按模型）
- 实际：统计卡显示最近 24 小时运行 21、成功率 100%（text-dump metrics 段），同一屏明细区显示「合计：该窗口无可渲染行」（text-dump.txt:380）。用户无法分辨是模型明细缺失还是整窗无数据；「回到默认视图」说明默认视图就是这个空视图。
- 期望：空态点名维度（如「本窗口的运行都没有记账到模型」）。
- 截图：`shots/metrics@1440.png`、`shots/metrics@375.png`
- 写域归属：`modules/metrics` 空态文案（数据侧按模型分组缺失为后端账本口径）。

### 12. 在册人员名录混入测试数据行「QA2 契约验证 1794894768 · 3E2E940B」
- 页面：`#/identity`（回退台账）与 `#/employees`
- 实际：名录第一行即测试残留「QA2 契约验证 1794894768 · 3E2E940B」状态=草稿（text-dump.txt:196 亦出现在 channels 段台账引用中）。对外页面暴露 QA 夹具数据。
- 期望：夹具数据隔离（状态=草稿应可过滤或沉底，命名不应含时间戳残骸）。
- 截图：`shots/identity@1440.png`、`shots/employees@1440.png`
- 写域归属：数据面清理（ops/后端）+ 前端默认过滤口径。

### 13. 用量页三个 Token 卡全「—」，唯独成本有值
- 页面：`#/overview?tab=usage`
- 实际：输入/输出/缓存三卡「—」，成本「$1.27 账本实测 · 85 条账目」，模型明细「这个窗口没有可读的模型明细（用量源降级或未随回答发送）」，数据截至「—」（text-dump usage 段，mainTextLen 338）。85 条真实账目对应 0 条 token 读数——同窗同源却一边有一边无，页面无解释去哪核实。
- 期望：token 读口接通，或卡上点名是哪条腿未接入（现在的口径只在页脚一句话）。
- 截图：`shots/overview-tab-usage@1440.png`、`shots/overview-tab-usage@375.png`
- 写域归属：usage 数据腿（后端）+ 用量卡文案。

### 14. 能力矩阵恒空，与员工/技能页有数据并存，判别靠猜
- 页面：`#/matrix`
- 实际：「还没有可展示的矩阵 / 要么还没有员工被授过能力，要么后端只返回了空表」（text-dump matrix 段，mainTextLen 203）；同期 identity 台账显示 2 名「在岗」员工、capabilities skills tab 可读。两种可能文案二选一让用户自己排查。
- 期望：读口给「上游返回 0 行」的判别读数（有在岗员工且授权表非空但矩阵空 = bug 级信号，需后端配合）。
- 截图：`shots/matrix@1440.png`、`shots/matrix@375.png`
- 写域归属：matrix 模块 + 后端聚合读口。

### 15. runs 详情「输入/输出」空态文案自指实现（可指到具体缺失字段）
- 页面：`#/runs` 行详情
- 实际：详情区事件流缺 payload 时的说明含内部词（work/runs 段可见「未随回答发送」「上游给了才显示」类口径多处），且空态长文与「—」占位混排；对照 runs 事件本身有 34 行可读（401 修复时验证）。
- 期望：面向用户说「这条运行没有记录请求内容」。
- 截图：`shots/runs@1440.png`、`shots/runs@375.png`
- 写域归属：`modules/runs` 文案（低优先，量大后才提级）。

### 16. 375 档全站导航收纳：汉堡抽屉项全在屏外负坐标（判据噪声源）
- 页面：所有页 @375
- 实际：off-canvas 抽屉项 left∈[-240,-16] 每页 14 个（scan.json off=14 全站一致）；抽屉收起时这些节点仍在 DOM 且被逐元素扫描命中——本轮已按 wave-125 先例归类为「非裁切」，但它同时意味着抽屉**不可聚焦可达性**依赖 aria-hidden/inert 正确性，值得一次专项核查（含 Tab 焦点是否误入屏外项）。
- 期望：收起态抽屉对焦点与读屏完全 inert（或从 DOM 移出）。
- 截图：任一 `shots/*@375.png`（抽屉收起态）
- 写域归属：shell/App.tsx 抽屉（先例记忆：抽屉容器住 App.tsx 与 inert 双门口径）。

## 已排雷（不列 bug，防复审再报）
- metrics@375 热力网格 162「越界」：在 overflow-x 壳内（scrollW620>clientW338，probe 实测），日历热力横滚为设计态。
- 「跳到主要内容」与四段数据源注记在 innerText 出现：computed 实测 w=1px 的 sr-only 元素，非可见文本。
- ConsoleSelect「原生 select」口径：运行时 `select` 计数全页 =0（button 自绘），板上「6 文件 8 处」为源码 grep 旧口径。
- overview 三卡文字重叠：1440 fullPage 读数无 clip 违规、截图无叠字（上轮观感项，撤销）。
- work 页长滚 1594px、审批「下一页」双现：复核为滚动壳视差与分页文案设计态，无 DOM 重复。

## 第二批（verify-probe.mjs 定向核验后补，读数为证）

### 17. [P1] audit@375 工具条三钮全部折行两行（导出 CSV / 完整性校验 / 刷新）
- 页面：审计 @375
- 实际：按钮 rect 高全部 44px、文本折两行（verify-probe：`导出 CSV r=[96,125,182,169]`、`完整性校验 r=[190,125,283,169]`（86px 宽放 5 字）、`刷新 r=[291,125,353,169]`）；observer 目测「方块字」成立。
- 期望：375 档工具条收纳为图标钮+aria-label，或允许整行换行布局，钮内不折字。
- 截图：`shots/audit@375.png`（顶部工具条）、`shots/audit@375-tall.png`（补拍全页 10908px）。
- 写域归属：modules/audit 工具条（UI-B/车道可修）。

### 18. [P2] 版本页『未知』徽标与『未知』文字同一行双份并排
- 页面：`system?tab=version` @1440
- 实际：组件版本表每行状态徽标「未知」+ 单元格文字「未知」成对出现（verify-probe unknowns 8 个 rect：徽标 [708,*,761,*] + 文字 [769,*,795,*] ×4 行）。信息重复且与 #9 的构建标识占位叠加，整页无有效读数。
- 期望：徽标与文字一源；读不到时合并为单个语义态。
- 截图：`shots/system-tab-version@1440.png`。
- 写域归属：SystemHealthSurface/version 表（与 #9 同修）。

### 19. [P2] runs@1440 行尾「展开预览」按钮折行（66px 宽容 4 字，高 44px）
- 页面：运行列表 @1440
- 实际：每行按钮 rect [1340,*,1406,*] 宽 66px，文本折两行（verify-probe wrapBtns 连续 6 行命中）。桌面主路径按钮文字断裂。
- 期望：按钮 `whitespace-nowrap` + 自适应宽（先例 wave-125 时间窗 chips 同法）。
- 截图：`shots/runs@1440.png`、`shots/runs@375-tall.png`（375 全页补拍 9971px）。
- 写域归属：modules/runs 行操作区（UI-B 写域，可并入按钮分层后续单）。

### 20. [P2] 侧栏分组标题与组内首个菜单项全量同名（6 组）
- 页面：全站（1440 侧栏 / 375 抽屉）
- 实际：navDup 探针每页一致命中：`运营总览/运营总览、数字员工/数字员工、任务与运行/任务与运行、审批与发布门/审批与发布门、人员与访问/人员与访问、知识与数据/知识与数据`——分组名与子项名逐字相同，导航读起来是重复两行。
- 期望：分组名与项名区分（如「平台/运营总览」），或单子项组直接拍平。
- 截图：`shots/overview@1440.png` 左侧栏。
- 写域归属：shell/routes.ts 导航元数据 + 侧栏渲染（信息架构级，建议 UI-KD/框架道统一处置，勿逐页改）。

## 第二批排雷（observer claim 未过 DOM 实证，不入单）
- 「375 吸顶 header 压标题残影」「≡ 菜单图标压字」：live 900px 视口 stickyHits 全页 =0；全页图上的残影系壳撑高拼接 + sticky 绘制位置的取证工件，非现网重叠。
- 「sessions@375 标题半切」：sessions main 内无 h1/h2/title 节点（fallback 命中 Chats 按钮），标题元素形态待二巡确认，暂不列。
- 「approvals@375 导出文件名与共 4 行互侵」「identity@375 标签值粘连」：siblingOverlap/tallNarrow 均 0 命中（探针内两条 0,0,0,0 rect 记录为 SVG/零尺寸节点回退值，判废）。
