# 审批批量 P0 台账腿（wave-175 · L0 已并窗 face b0788533a7）

日期：2026-11-23（本地 05:02-05:06）。车道：aud（console-aud）。代码笔：70ff2c6446（L0 merge --no-ff 并入 face b0788533a737afb7e2935c442a7c93e783924490，face 时刻 2026-11-23 04:57:34 +0800）。
内容判据（规矩①）：`git show b0788533a7:web/src/modules/approvals/batch.ts | grep -c BatchGateKey` = 4 ✓；writeGate.ts DECISION_GATE = 2 ✓。

## ① H2 五件（src>0 并入⇒产物换代，本拍重建）

- 重建：`cd web && node_modules/.bin/vite build` VITE=0，时刻 05:01（晚于定脸 04:57:34，无抢跑）。
- entry：`assets/index-Cv4DBs--.js` bytes=173255 sha256=`fdb48719ab048632f10e77d6b3ed7a9284d22a170d8ce92a18da707f6c192628` mtime=2026-11-23 05:01（换代，前代 index-kWaJfTXV.js/42ff9d00… 退役）。
- main CSS：**换代** `assets/index-JdSzyvxf.css` bytes=148959 sha256=`631d3d61a5d9026d16448fbf177b88edaa6a0edefb8c643205b231260ed71d2c` mtime 05:01（前代 BuNLfk0U 退役）。
- served==disk：curl `:9122/agent-v2/` 引用同名两枚 ✓；`/assets/` 逐字节 sha256 比对 js/css 双 MATCH ✓（旧坑：`/agent-v2/assets` 是 SPA 回退页，不作数）。
- lazy chunk 特征（memory 口径：chunk 级特征而非仅 entry hash）：`apv-batch-bar` 字符串实测在 `assets/ApprovalsPendingModulePage-DEVm_aKm.js` ✓——批量码在该脸懒加载块内。

## ② 同脸 1440/375 真 fullPage 复拍（端口 9122）

配方承 wave-172（memory f74c2d2c）：storageState cookie 域 100.117.184.117→127.0.0.1 改写注入（token 未动、未代登）；urllib 带 cookie 预检 whoami=200@05:02:38；**紧贴每次截帧前浏览器内 `fetch('/auth/whoami')===200` 断言**：1440 拍 200@05:02:44、375 拍 200@05:02:47。

census（两档一致，`readings.json`）：batchBar present=false、selectAll=false、checkbox 族（`input[type=checkbox][data-testid^=apv-select-]`）=0、apv-batch-approve/reject/clear/result 全部 present=false、mainLen=694。
数据侧背书（`census2.json` + BFF 现查）：活队列实渲 3 行（apv-trunc-row-title-ap_1086009D46EB4A88A88333DFEA / ap_1F6C3B7040834C5E82D40980F6 / ap_07CF33AAB3264A61AEF57CF1F8，页脚「共 3 行」「待办 3 高风险 3」）；`GET /agent-api/api/approvals?status=pending` 200 items=3 **全部 risk=high**。
生效性边界（如实，非缺陷）：批量区/勾选按实现只在存在积极可批量行时渲染——高风险不可批量（B2 表 P0 行规则「高风险的对外发送/删除不可批量」），现网队列 3/3 高风险 ⇒ 批量 UI 合法隐藏、加分帧（勾选→批量批准/驳回→失败即停）跳过并如实记 `afterSelectAll.skipped`。该流动路径由 vitest 行级钉测 14 例覆盖（红→绿：改前 14 failed → 改后 14 passed，目录 85 files/403 tests 全绿，见代码笔 70ff2c6446 与其回执）。
真 fullPage：png 1440→1440×900、375→375×812；内容一屏内（mainLen 694、无折叠高差），视口高即全页高，非骨架（whoami 200+行实渲+apv 族 testid 齐）。

## ③ console 零新增面判据串

两拍 jsErrors=0、res4xx=0（page 自带收集器）；对照 156/166 既有鉴权外业务端点 401 面（overview 脸 11 条基线）：本腿 approvals 面 401 集合=∅ ⊆ 已知面 ⇒ **零新增面达成**（JS 新增异常 0 + 无超族 4xx）。

## 幻影与纪律

- 前记录幻影不采：c07e1f7552/D69mY8iN/PID47164-as-ran 等（详见各更正笔）；本腿所有 sha 均 ls-remote 定向落文件现查、读数均盘上实测。
- 375 总 PASS 放行权归 UX 总审（ses_e02192ce8ffeOClSfwe4Iq6QAK），本账不宣称全绿；审计排序本地降级 P1 候 L0 另派。
- 新基线记录：L0 并窗后全量 487 files/3612 tests（含本 14 例逐位吻合）；板纪律笔 33d1e5e8。
