# UX r2 工单 — 审批列表 + 运行列表（派实现车道由 L0 分发；本车道不改码）

## P0（当轮修，阻塞 PASS）
- **P0-1 [待复验→审批]** 环境自述「控制台只接受 GET/HEAD，POST 一律 405」（runs 面原话，同 build），但审批详情右栏「批准/驳回」呈现为可点、无禁用无提示——若复验坐实提交必败，即为可执行控件误导。复现：1440 登录→#/approvals→点首行→右栏底部两按钮（截图 r2/shots/approvals-row-detail-1440-r2.png）。落点建议：web/src/modules/approvals/ 详情栏 action 区（矩阵判定处，与 runs retry 禁用同源判定）。处置：L0 用一次性申请实测归因；坐实则实现车道按矩阵禁用+原因句。

## P1（下轮修）
- **P1-A1 [审批/层级]** 9 条控制带先于内容（页签/筛选/汇总/重置/导出+文件名/排序chips/三行元说明/复制预览/刷新），375 首屏几乎全是元控件。复现：#/approvals 双档。截图 approvals-list-1440-r2.png、assert375/approvals-375.png。落点：ApprovalsPendingModulePage 页头区合并带（汇总与 chips 收拢、元说明移入折叠）。
- **P1-A2 [审批/数据口径]** 列表「提交 11 小时前」vs 详情「提交 2026-11-21 09:09（剩 12 小时 52 分）」换算不自洽；「总数不可用」与「已到末页」并存；miss 空态下页尾仍残留「加载更多」。截图 approvals-row-detail-1440-r2.png、approvals-search-miss-1440-r2b.png。落点：审批面时间格式化单点+分页 footer 状态机（过滤态隐藏加载更多）。
- **P1-B1 [runs/层级]** 两级页头+两条面包屑+同位三名（侧栏/H1/H2）；「刷新」（shell）与「重新读取」（模块）同屏无主次；「读取动作/列表操作」两组无组标签可见文本（role=group 有 aria-label 但屏上无标题）。截图 runs-list-1440-r2.png。落点：RunsModulePage 页头段去重+组标题上屏（aria-label→可见 label）。
- **P1-B2 [runs/数据口径]** 同一运行详情头「耗时 —」vs 列表「165 小时 53 分钟」活值，耗时列全列无口径说明；成本「未知+预算 $10」并存无告警分级。截图 runs-row-open-1440-r2.png。落点：RunsModulePage 耗时字段口径单点（与采集时刻同款诚实策略成文），异常大值行加上下文标记。
- **P1-B3 [runs/反馈]** 切「近 30 天」后「本页 30 次·失败 0·运行中 1」统计纹丝不动（仅多 1 行），疑似统计缓存或口径与窗口无关但未说明。截图 runs-range30-1440-r2b.png vs runs-list-1440-r2.png。落点：统计行随窗口重算或补「统计仅覆盖已加载行」口径句（后者已有则前置到统计行本身）。
- **P1-B4 [runs/降级]** 375 卡片化丢失全部列头标签，值裸堆（日期/耗时/$0.01+已计价/负责人·hexid/—），无「开始/耗时/成本」字段名；页尾成本口径注释在 1440 大档不可见（长表 2600px 裁切外）。截图 assert375/work-tab-runs-375.png。落点：RunsModulePage 窄档卡内 label 还原（复用 apr 卡片模式）。
- **P1-S1 [shell/键盘]** 375 闭合 off-canvas 抽屉 left=−240 无 aria-hidden/inert，Tab 第 2~6 停靠点进入屏外（r1 P1-2 两轮复现未修）。证据 r2b drawerFocus375（两节点 inert=false ariaHidden=null）+ focus 探针 clipped=true。落点：web/src/shell 抽屉容器 closed 态加 inert（React 19 支持 inert 属性）。
- **P1-T1 [双页/触点]** main 内交互件 <44px：审批 35/21、runs 82/48（1440/375）。样本：筛选 chip h23-25、导出 h28、行内小按钮、页签 h35。截图 6 张主图。落点：tokens/shell 按钮最小高度令牌（h-8→h-11 分级），chip 类给 py 下限。

## P2（设计债）
- **P2-A1** 术语漂移：待处理/待办、批准驳回/已批已拒、负责人/员工/值前缀、历史决策/决策回放；runs 单页 H1=英文「Runs」。
- **P2-A2** 汇总「已批 — 已拒 —」破折号与「0」混用无口径注释。
- **P2-A3** 搜索清除后与面板初始态像素级同构，无「已清除」确认（cleared 截图 vs panel 截图）。
- **P2-B1** 「读取成功」纯文本反馈无图标/时间戳/收敛策略。
- **P2-B2** 元规范/协议段当用户文案：键盘快捷键成段说明、POST 405 协议段、「当前筛选可分享形态 /runs」「采集时刻 —（上游给了才显示…）」；建议折叠或移 help。
- **P2-B3** 表格视觉：成本徽章悬浮越出本行基线、「165 小时 52 分钟」折行掉「钟」字。
- **P2-S1** 导出长文件名 `approvals-pending-pending-…-20261121-2017.csv` 上屏并 375 折 3 行（文件名模板与展示解耦）。
- **P2-A4** 审批「复制预览详情」「重置筛选」置灰无原因句（对齐 runs 复制链接的正例）。

## 挂账（非本轮新增）
- r1 P0-1 knowledge token 门禁：码未动（git 验证），继续阻塞 knowledge 面。
- r1 P0-2 环境接线：性质已变（假 200→显式 knowledge.not_wired 404 码），归 L0 环境处置。
