# UX r3 销项复审（基线 lane/hermes-console@03fcc769 · 现网 entry index-DzYbPXfO.js）

- 车道：lane/UX-total（常驻 UX 总审，只审不改产品码）
- 窗口：2026-11-21 ≈13:04–14:0x UTC（90 分钟盒，L0 r3 派单：勿开新评分面）
- 取证：ux-capture-r3.mjs（主腿，EXIT=0）+ ux-capture-r3b.mjs（gate-detail 补腿，EXIT=0）；图 8 张于 shots/；entry 首尾一致无漂移；r3/r3b 全程 badResponses=0（知识页 404 见 P0-2 行，为业务显式码非噪声缺失）、consoleErrors=0（产品级）
- 纪律执行：375 只用逐元素新判据（right>376&&left>=-1），无 document 级读数；决定钮零点击（只读 DOM 断言）；双档取更差

## 一、P0 销项表

| 编号 | 事项 | 判定 | 证据 |
|---|---|---|---|
| r2 P0-1 | 审批「批准/驳回」无确认即可点（POST 405 矛盾） | **CLOSED（验收通过）** | r3b gate-detail 腿点开首行（ap_85119755436347F1864B96F6A8，URL /approvals?id=…）：`apr5-actions-readonly-note` 在场，文案「当前环境的控制台是只读的：批准、驳回在这里点了也不会生效…走它原本产生决定的渠道。」；批准/驳回两钮 disabled=true + aria-disabled=true + title 人话原因（实测决定提交一律被拒…写请求没有入口）；与 runs run5-retry-new 同口径（源码 ApprovalsPendingModulePage.tsx:440-459/:467-468，码 06bb7429）。图：shots/approvals-gate-detail-1440-r3b.png。注：备注框 disabled 探针选择器落空（remark=null），不作为缺陷也不作为通过证据 |
| r1 P0-1 | 证据页「需要登录」与 opsadmin 登录态矛盾 | **OPEN（仍未修）** | 双证：① git log b24de09f..03fcc769 对 web/src/modules/knowledge/session.ts、EvidenceModulePage.tsx = 0 提交；② r3 实测点击进入证据 Tab loginContra=true（屏上现「需要登录」）。图：shots/evidence-click-1440-r3.png |
| r1 P0-2 | 知识 API 未接线 | **标注行（env 轨，L0 令不评）** | curl 带 cookie 现码：/agent-api/api/knowledge/spaces?limit=20 → 404 显式业务码 {"code":"knowledge.not_wired","message":"上游 Bisheng(7860) 知识空间逐 id 读口不可达","rid":"df00886b"}；性质已从 r1 时代「SPA fallback 假 200」变为「显式 not_wired」。页面腿 404×documents/spaces/citations 与之对应。L7 处理中 |

## 二、P1 delta 全列（只列，不写码不改码）

| 编号 | 事项 | 状态 | 证据（git / DOM / 图） |
|---|---|---|---|
| UX-R1-P1-1 | 知识冷深链 ?tab=evidence 双页问题 | **OPEN（判图确证未修）** | URL 归一仍 /knowledge?panel=evidence（与 r1 同形态）；knowledge 模块 2c72c54f..03fcc769 仅 91bffe62 css 一条；判图：深链只切动内层 tab 选中态，顶部整套文档登记读口块原样保留（含 hex 6ba80bc9…），黄块下又现第二个 hex（a4abbdd7…）屏面 hex×2；外层 tab 选中项仍是「知识空间」未随深链走；「暂无引用」下并存 3 条灰骨架条（空态与加载态视觉并存）；内容止于 y≈800、下方 ~69% 死白（加高视口摄法口径，与 r1 同法可横比）。图 shots/knowledge-deeplink-1440-r3.png |
| UX-R1-P1-2 / r2 P1-S1 | 375 幽灵抽屉（闭合 off-canvas 仍可 Tab 进入） | **OPEN（未动）** | web/src/shell 0 提交；r3 drawer375 两节点 left=-240、ariaHidden=null、inert=false（与 r2 完全同态） |
| UX-R1-P1-3 | 知识搜索三态屏面无差异 | 未动 | knowledge 仅 css 一条；文案/结构零改动；r3 未重跑交互腿，图证复验挂 r4 |
| UX-R1-P1-4 | 外层 Tab 与内层模块 Tab 双导航堆叠+术语漂移 | **OPEN（仍在）** | r3 innerTabs 实测=[知识空间,数据源,证据与引用]+[知识空间,数据接入,检索,证据与引用]；结构件零提交 |
| UX-R1-P1-5 | 知识触点 <44px（r1 计 22） | 部分（数量波动，问题仍在） | r3 精计：1440=16；375=22（r3b 复测，样本含 搜索钮63×28、复制请求编号48×21、去审批中心链接134×16、复制清单340×28 等）；主腿 r3 曾报 375=0 系渲染前采样，已在 r3b 更正并复测 |
| UX-R1-P1-6 | 「未接入 或 没有权限」两态混写 | **OPEN（仍在）** | r3 mixedState=true 实测命中；KnowledgeModulePage.tsx:2712 零提交 |
| r2 P1-A1 | 审批页 9 控制带堆叠 | 未动 | approvals 两条新提交仅 06bb7429（决定钮 gate）与 45853240（375 history chips 宽度，非本项） |
| r2 P1-A2 | 审批时间口径三处不一致 | 未动 | 同上，无时间口径提交 |
| r2 P1-B1 | runs 双页头/无名组 | 未动 | web/src/modules/runs 0 提交 |
| r2 P1-B2 | 耗时 165h53m 无口径 | 未动 | 同上 |
| r2 P1-B3 | 近30天切换统计不变 | 未动 | 同上 |
| r2 P1-B4 | 375 卡片丢列头标签 | 未动 | 同上 |
| r2 P1-T1 | 触点 <44px（审批35/runs82@1440；21/48@375） | 未动（审批仅 gate 钮态变化） | runs 0 提交；approvals 提交不涉触点尺寸 |

附注（本轮新观察，不入档期）：45853240 把 375 history 状态 chips 改为 content-width 条——属 r2 assert375 已 PASS 路由的观感优化，r4 顺带按图复核即可。

## 三、知识两页密度重评（仅维度 7，不开新评分面）——observer 读图结论已合入

- **定档：维度7 = 2**（1440=2、375=2，双档取更差；与 r1 持平，**未销项**）。
- knowledge-list-1440-r3.png：两套读口块纵向堆叠、双导航、屏面 hex×2、三组微文案各复读 ×2（「这块数据没有读到…」×2、「只在已加载的…里搜索…」×2、「当前不可复制：读口未接入或没有权限」×2）、~70% 死白全部在屏；**进步项**：块内间距收紧（91bffe62 生效）+ 新增「数据来源与新鲜度」折叠组（默认收起）——判语「收紧了皮、没减结构」。正文 ~11px/辅文 ~10-11px 几乎同尺寸（行字号 10.8px 实测一致），仅页头 ~18px/节标题 ~14px 分层，整体需凑近读。
- knowledge-list-375-r3.png（首屏 800px 证据）：首屏塞两套完整读口块+折叠头+页脚声明；**「搜索」按钮换行孤悬整幅 ×2 处（新增可见）**；刷新/复制结果/复制清单满幅；内层 tab 折 2×2；页尾「看证据与引用 →」贴边被压掉半行。375 整页死白此图不可证（判读口径已声明）。
- 关联更正：r1 P2「hex 铺屏」屏面同样未销（list 与 deeplink 两图均 ×2）。
- **探针口径坑（登记）**：DOM 实测低估——hexOnScreen=1 vs 屏面 ×2（两套块各自渲染请求编号）、读口字样 DOM=4 vs 屏面 ≈6。销项判定以**读图为准、DOM 只作辅证**；与「已并码≠已验收，以读图为准」既有纪律一致。r1 P1-5 触点计数 16/22 亦属 DOM 腿，屏面小钮观感（375 首屏孤悬行）以图为准补强。

## 四、board 行建议

UX r3 销项 approvals/待处理 P0-1 CLOSED；knowledge P0-1 OPEN(双证)、P0-2 env 标注；P1 delta=OPEN 4 / 未动 8 / 部分 1；知识维度7 重评=2/3（1440=2、375=2 取更差，与 r1 持平未销项，CSS 二改未销密度结构）
