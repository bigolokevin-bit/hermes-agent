# OM-03 交付证据 — 总览 KPI 卡数与网格裁定

日期：2026-11-23（北京 21:4x）· 基线：**stacked on task/OM-01**（tip 60dc76d87e，因本项依赖 OM-01 挂载裁定；lane 合并顺序须 OM-01 → OM-03）。
改动：`web/src/modules/overview/overview.css`（+5/−7，仅此一文件）。

## 裁定（回写 deep/01-overview.md D-2 的裁决记录，deep 文档归 L0 写域，此处为待回写正文）

- KPI 行数 = **5 卡**：在岗员工(ov6-kpi-employees) / 今日运行(runs) / 待审批(pending) / 今日成本(cost) / 健康检查(health)。
  依据：deep D-2 设计为 4 卡，但健康卡承载「本页数据源实时聚合 + 独立健康探针未接入（GAP-OV6-HEALTH）」的诚实状态，其去留由 OM-10（假探针裁定：接 /api/hermes-summary 或撤卡）决定；OM-03 提前撤卡=在裁定前销毁特性，违反「fixes 不得销毁被保护特性」。故 OM-03 只修网格缺陷，不动卡片集合。
- 网格缺陷修复：`.ov5-kpis` 基线 `repeat(4, minmax(0,1fr))` 使第 5 卡在 >1100px 落孤列；改 `repeat(auto-fit, minmax(208px, 1fr))` 并删除 ≤1100px `repeat(2)` 与 ≤560px `1fr` 两处覆盖，分档由 minmax 自适应（DoD 明示 auto-fit 可接受）。

## DoD 对账

- 卡数 grep（源码，注意 testid 走 prop 形制，backlog 静态扫须用 `testid="ov6-kpi-` 而非 `data-testid="ov6-kpi`，后者在源文件恒 0）：
  `grep -c 'testid="ov6-kpi-' OverviewPage.tsx` → 5（L387-397 显式 5 张 KpiCard）。
- 每卡 `.ov5-source`：Source 组件无条件渲染（OverviewPage.tsx L44-46），5 卡皆含。
- 视口实测（真实 BFF 脸 9122 注入登录 cookie，employee-stats 200 total=3 前置断言；本地 dist 服务 9179 + playwright 系统 Chrome，domcontentloaded+settle）：
  - 1440：5 轨 ×1 行，卡宽 225 全等 —— 孤列消除。
  - 1100：3 轨 → 3+2，行内等宽 269，无拉满孤儿。
  - 560：2 轨 → 2+2+1，末卡保持 255 标准宽（不拉满）。
  - 375：1 轨堆叠。
  - 四档均 `ov6-page`=有、`duty-page`=无（OM-01 挂载保持）。
- 截图：overview-1440.png / overview-1100.png / overview-560.png / overview-375.png（本目录）。

## 测试与构建

- `node_modules/.bin/vitest run src/modules/overview src/modules/duty src/shell`（build 前）：26 files，**279 passed | 1 skipped**（skip=e1Contract 未部署态自跳）。
- 同 suite（build 后再跑）：e1Contract 由 skip 转 fail —— 该测试比对 **9122 已部署脸** 与本树 **盘上 dist** 的 entry hash（served index-DmN1Xzu3 ≠ disk index-VT8FzbB5）。fork 车道树结构性红，判环境不判 diff（既有裁定），非本改动引入。
- `node_modules/.bin/vite build`：exit 0。
- 纯 css 改动：OverviewPage.test 行为契约不受影响。

## 备注

- deep 文档回写：board 仓 docs/product/design/console-v2/deep/01-overview.md 属 L0 写域且该检出有未提交改动，本车道不代笔；上面「裁定」两段即回写正文，待 L0 合并。
- Q11 会话若在 task/Q11-overview-kpi 并树，合并顺序注意 OverviewPage.tsx 交集。
