# UI-C2 回执：员工详情首屏（一页一刀）

- 基线：合并 `origin/lane/hermes-console` 至 t=`916b943b` 代次（合并点 `a669a980`）；只动 `web/src` 表现层（`modules/employee-detail/EmployeeDetailModulePage.tsx`、`styles/detail.css`）；未改 testid/路由表/取数逻辑；未新增可见 Tab；未 `npm install`。

## 问题 → 改法 → 文件

1. 问题：详情首屏头部只有 姓名·短码 + 岗位 + 在岗徽标，缺「部门」。
   改法：头部副行补「部门 · <值>」；三态（真值/未标注/该字段未返回）复用列表与身份卡同一 `departmentView` helper（禁第二套判据），未 ready 不渲不占位。
   文件：`EmployeeDetailModulePage.tsx`（page header）。

2. 问题：首屏无「身份/组织/生命周期/权限/最近活跃」五区导航；概览字段混在一张「身份与组织」dl 里（1440 三列），扫读不分层。
   改法：概览区顶部加五区锚点条 `.ui-c-anchors`（非 tab、不改路由：前三区为在页滚动锚 `#uic2-zone-*`；「权限」区 HEAD 无首屏承载，如实落已接线的 `?zone=capability` 真分区 Link；「最近活跃」锚到在岗卡包裹层）。
   文件：`EmployeeDetailModulePage.tsx`（`AnchorChip` + `OverviewZone`）、`detail.css`（`.ui-c-anchors/.ui-c-anchor/.uic2-target`）。

3. 问题：身份区字段单 dl 混排、无分区小标题、1440 撞三列不符「两列标签值栅格」。
   改法：同一卡内按区拆三段（身份：姓名/工号/角色/请求编号；组织：部门/汇报对象；生命周期：在职态/创建时间），字段、`data-testid`（`ed1-identity-*`）、缺值话术、`title` 悬停零改动，仅归组；三段各挂锚点 id 与 `.ui-c-subhead`；`.ui-c-fields--two` 在 ≥640 钉两列（1440 不放宽三列，375 单列堆叠）。
   文件：`EmployeeDetailModulePage.tsx`（`IdentityCard`）、`detail.css`。

## 边界如实

- 五区中「组织」「生命周期」HEAD 承载本就与「身份」同卡（`/agent-api/api/employees/:id` 回包字段），本次只分组不造数；「权限」无首屏独立数据面，锚点跳真分区页而非伪造空段——均已在代码注释与本文件注明。
- 工号短码沿用 `shortCode(empId)` 单点；徽标沿用既有 `lifecycleTone/lifecycleLabel`。

## 验证

- `cd web && node_modules/.bin/vite build` → exit 0（代码笔 `5ef66ccf`，已推 `lane/console-ui-c`）。
- `tsc --noEmit`：employee-detail 域 0 红。
- `vitest run src/modules/employee-detail`：62/62 ✔（字段归组未动 testid/文案契约）。
- testid 不变式：`git diff -U0` data-testid 增删改名 0。

## 取图卡点（如实）

- 改前/改后 1440/375 截图被现网登录态过期阻塞：`100.117.184.117:8183/agent-api/api/*` 匿名与本地 dashboard token（Bearer/三种 cookie/X-Session-Token 头）全 401 `console.unauthenticated`；ego 会话页面显示「会话已过期，请重新登录」。拍法与脚本已备好（`/tmp/uic2-shots2.mjs`，路由为 path 形 `/employees/<id>` 非 hash；就绪判据 `ed5-overview-wrap`），现网重新登录后可直接重跑，命名 `uic2-{before,after}-employees-{1440,375}.png` 落本目录。
- 布局验收不受影响：三段两列栅格与锚点条为纯 CSS/DOM 归组，`ui-c-fields--two` 钉 640+ 两列、375 单列。

## 追加一区：权限区回条（本笔）

- 问题：锚点条「权限」跳入 `?zone=capability` 后无回程，四区回不去。
  改法：权限区顶部加分区回条（当前区高亮 `aria-current`，其余四区如实回链总览顶部，不造本页假锚）；未动 testid/路由/取数。
  文件：`EmployeeDetailModulePage.tsx`（page return）、`detail.css`（`.ui-c-anchor--active`）。

## 追加一区：预算区（本笔）

- 问题：`?zone=usage` 预算区无区块头、运行数/实扣/采集时刻数字非等宽（ui-c 数字口径缺口）。
  改法：加 `.ui-c-head`「预算与成本」；三个数值腿挂 `.ui-c-num`（tabular）；文案/title/测试值零改动。
  文件：`EmployeeDetailModulePage.tsx`（UsageZone）。testid 集合前后逐行相等。
