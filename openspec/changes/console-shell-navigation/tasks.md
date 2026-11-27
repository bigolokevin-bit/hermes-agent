# Tasks: console-shell-navigation

## 1. 面包屑与返回（已交付）

- [x] 1.1 `web/src/shell/TopBar.tsx`：`consoleSurface()` 返回 `{trail, title}`，
  层级来自路由解析（模块/详情/分区三段），上级段渲染为可点 `Link`；
  详情页新增显式返回钮（`shell-topbar-back`，`navigate(-1)`），模块页不渲染
  （提交 `c3b83fbca2`）
- [x] 1.2 `web/src/shell/routes.ts`：新增 `ZONE_TITLE` 分区中文名表，
  供顶栏末段与 h1 使用，与页内分区条词表口径一致（提交 `c3b83fbca2`）

## 2. 查询串形制对齐（已交付）

- [x] 2.1 顶栏同时读 `pathname + search` 解析路由，并显式读查询串 `zone` 参数：
  路径匹配先命中工作台行的问题由此兜住；别名（`ZONE_ALIAS`）与非法值归一后
  才参与层级拼装（提交 `03dd183ba4`）

## 3. 测试与契约

- [x] 3.1 `web/src/shell/topbar.contract.test.ts`：钉住面包屑可点、返回钮存在、
  分区标题取自 `ZONE_TITLE`、查询串形制与路径段形制读同一分区名
  （`c3b83fbca2`、`03dd183ba4`）
- [x] 3.2 补行为用例（非源码契约）：两种形制打开同一分区，断言面包屑末段与
  h1 逐字相等；非法 `zone` 值断言落回工作台层级读数 —— `topbar.surface.test.ts` 5 用例；顺带修真缺陷：非法 zone 此前让 `findRoute` 整体落空、顶栏掉到 off-shell 标题（现按工作台层级兜住），`src/shell` 129 passed

## 4. 实机证据

- [ ] 4.1 9122 构建下截图三脸：列表页 / 详情工作台 / `?zone=config` 分区，
  核对面包屑段数、可点性与返回钮可见性（375 与 1440 各一）

## 5. 收尾

- [ ] 5.1 归档本 change（`openspec archive console-shell-navigation`），
  把 `console-navigation` 能力并入主 specs
