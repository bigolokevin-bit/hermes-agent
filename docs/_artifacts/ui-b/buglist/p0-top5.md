# P0 前 5 条（按用户受损严重度 · L0 催办 @2026-11-22）

- 来源：`buglist.md` 20 条全集；本文件只取前 5 并给 before/after 计划。36 面首轮读数为唯一取证面（按令**未扩面**）。
- 排序裁量：#4(全集#5) 胜 channels GAP 刷屏与 pricing 三页——「冒充名录」是**假印象**，后两者是诚实降级；#5(全集#8) 胜 audit 折行——钮完全不可见 vs 折行仍可读。
- 实施前提交冻结令解除（A 车道 styles/components 冻结中）：第 2/5 条在 UI-B 写域解冻即修；第 1 条修复已在脸队列；第 3/4 条主修在后端读口（l0-board 线），前端只做降级面。

## 1. [P0] 匿名态 401 风暴环：#/sessions 与 #/capabilities?tab=channels 卡骨架
- 复现：cookie 失效/匿名态打开任一路由 → 观察 Network 与页面。
- 期望：一次登录引导或稳定「需要登录」态；请求有界。
- 实际：整页 reload 风暴。15s→30s 窗口 nav 645→1255、401 1930→3759 线性翻倍；骨架 mainTextLen=10。
- 截图：`shots/sessions@1440.png`、`shots/sessions@375.png`、`shots/capabilities-tab-channels@1440.png`、`shots/capabilities-tab-channels@375.png`
- before：上述 4 图 + `../401-face/real-9122-probe.txt`（A 组翻倍数）。
- after：并脸 `f3c72902ff` 后在新脸复跑 `../401-face/storm-window-probe.mjs` 同口径——判据 = 窗口翻倍时 nav/401 **不再翻倍** 且 mainTextLen≥30 出图（销账轮 aud 执行；我不再动 `lib/api.ts`）。

## 2. [P1] sessions 会话卡把内部占位串直接上屏「msgs · NaNd ago」
- 页面：`#/sessions`（RECENT SESSIONS 唯一卡副行）
- 复现：登录态打开 sessions → 看「Untitled」卡副行。
- 期望：「Untitled · 0 条消息 · 时间」或诚实缺失态。
- 实际：未格式化英文占位 + NaN 计算上屏（probe visible=true rect[259,226]，`text-dump.txt:481`；卡无 data-testid，测试面未覆盖）。
- 截图：`shots/sessions@1440.png`、`shots/sessions@375.png`
- before：现图 + text-dump 行锚。
- after（UI-B 写域，解冻即修）：修时间/计数格式化 + 补 testid + vitest 钉「sessions main 全文无 `NaN` 字串」；同页同档复拍 + 全文扫描 NaN 计数=0 读数入单。

## 3. [P1] 知识与数据页两个核心读口 404，整页无内容可看
- 页面：`#/knowledge`
- 复现：登录态打开 → 文档区与空间区。
- 期望：读口接入；或导航层明示该页暂无数据，不让人进来撞两堵墙。
- 实际：`GET /agent-api/api/documents` 404、`GET /api/knowledge/spaces` 404；两块「文档登记读口未接入 / 知识空间未接入」（`text-dump.txt:21,22,47`）。文案诚实但主功能全不可用。
- 截图：`shots/knowledge@1440.png`、`shots/knowledge@375.png`
- before：现图 + scan.json consoleError 样例。
- after：主修=后端读口（l0-board 线）；落地后复拍双列表渲染 + 该页 consoleErrors=0。前端备选（读口长期缺时）：导航项降级标注，UI-B/shell 小改。

## 4. [P1] 人员目录拿数字员工台账冒充名录，全员「— 上游未提供账号/部门」
- 页面：`#/identity`
- 复现：登录态打开人员目录。
- 期望：表头随数据源变化，给不出的列不显示。
- 实际：`/api/v1/user/list`、`/api/v1/user/all` 404 → 回退台账（注明「不冒充真人名单」），但表头仍是「姓名/账号/部门/状态/最后活跃」，账号列全「— 上游未提供账号」、长注记挤爆单元格（text-dump identity 段）。
- 截图：`shots/identity@1440.png`、`shots/identity@375.png`
- before：现图 + text-dump 段。
- after（前端部分 UI-B 可修）：按数据源裁列（缺列即隐藏）+「最后更新」长注记收进 tooltip/脚注；复拍表头-列值匹配读数。真人读口本体归后端线。

## 5. [P1] system@375 行操作钮（复制 rid）默认不可见，藏横滚壳外 250px
- 页面：`#/system` @375
- 复现：375 档打开，看任意行操作列。
- 期望：行级操作不进横滚区（先例：wave-125 runs 详情钮 375 独立整行）。
- 实际：`sys-row-copy-0..2` rect=[624,683]；祖先 overflow-x 壳（scrollW680>clientW310）可滚达但默认不可见、无滚动提示；逐元素判据（right>376）违规 3（`overflow-probe-reading.txt` SYSTEM375 行）。
- 截图：`shots/system@375.png`、`shots/system@1440.png`
- before：现图 + probe 读数。
- after（UI-B/health 面可修）：钮迁出滚动壳或 375 独立行收纳；复拍 system@375 真 fullPage + 逐元素 right≤376 && left≥-1 违规=0 读数入单。

---
后位候补（未入前五，读数在册）：全集 #4 channels GAP 卡刷屏、#7 pricing 一口打穿三页、#17 audit@375 三钮折行 h44。
